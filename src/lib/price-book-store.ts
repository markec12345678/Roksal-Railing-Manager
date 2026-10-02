/**
 * R374 (issue #13, korak R165 iz §32/§2–§8/§16/§17) — strežniška plast
 * cenika: PriceBookVersion + PriceBookItem.
 * ---------------------------------------------------------------------------
 * Problem, ki ga ta plast zapira (issue #13 §4): cenik je bil do R372 samo
 * privzeta konstanta v kodi (defaultPriceBook) — klient ga je lahko poljubno
 * prepisal (priceOverride) in NI bilo strežniško avtoritativne, verzionirane
 * resnice o cenah. Vsaka uradna ponudba (QuoteVersion) mora hraniti TOČNO
 * PriceBookVersion, nad katero je bila izračunana.
 *
 * Načela (delovni kanon repozitorija):
 *   • EN VIR RESNICE — aktivna verzija cenika živi SAMO tu; /api/quote in
 *     /api/quotes berita ISTO funkcijo getActivePriceBookVersion();
 *   • fail-closed — manjkajoča/nezaključena/podvojena verzija je JAVNA napaka
 *     (503/409/400), NIKOLI tiha nadomestitev s privzetimi vrednostmi;
 *   • statusni stroj DRAFT → ACTIVE → RETIRED — matrika prehodov je tu;
 *     aktivacija nove verzije TRANSAKCIJSKO upokoji prejšnjo ACTIVE (dve
 *     ACTIVE hkrati = pokvarjeno stanje → javna napaka, nikoli "izberi
 *     novejšo");
 *   • whitelist ključev = TOČNO numerični ključi defaultPriceBook (izpeljani
 *     iz vira, ne ročno prepisani) — neznani/manjkajoči ključi → javna
 *     napaka; nov cenik mora pokriti VSAK ključ, sicer bi rekonstrukcija
 *     kasneje padla (preprečimo ustvarjanje pokvarjene verzije);
 *   • referenceCost NULL = nabavna cena NEZNANA (§8 iskrena marža) — nikoli
 *     placeholder 0.6/0.15.
 *
 * Plast je STREŽNIŠKA (uvozi db + audit); deterministično jedro izračuna
 * verzij (brez baze) živi v src/lib/quote-versions.ts.
 */

import { db } from '@/lib/db'
import { auditInTx } from './audit'
import { defaultPriceBook, type PriceBook } from './quote'
import type { SessionPayload } from './session'

// ── Statusni stroj cenika (EN VIR) ───────────────────────────────────────────

export const PRICE_BOOK_STATUSES = ['DRAFT', 'ACTIVE', 'RETIRED'] as const
export type PriceBookStatus = (typeof PRICE_BOOK_STATUSES)[number]

/**
 * Dovoljeni prehodi statusa cenika. DRAFT → ACTIVE (aktivacija ob
 * potrditvi), ACTIVE → RETIRED (upokojitev ob aktivaciji naslednika),
 * RETIRED je terminalno (zgodovina cen ostane za revizijo — ne briše se).
 */
export const PRICE_BOOK_TRANSITIONS: Readonly<Record<PriceBookStatus, readonly PriceBookStatus[]>> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['RETIRED'],
  RETIRED: [],
}

export function allowedPriceBookTransitions(from: string): readonly PriceBookStatus[] {
  return PRICE_BOOK_TRANSITIONS[from as PriceBookStatus] ?? []
}

// ── Whitelist ključev (izpeljana IZ vira — src/lib/quote.ts) ────────────────

/**
 * Numerični ključi PriceBook, izpeljani iz defaultPriceBook() ob zagonu
 * modula. EN VIR: ko se cenik v quote.ts razširi, se whitelist samodejno
 * razširi (noben vzporedni ročni seznam, ki bi zaostajal).
 */
export const PRICE_BOOK_NUMERIC_KEYS: readonly string[] = Object.entries(defaultPriceBook())
  .filter(([, v]) => typeof v === 'number')
  .map(([k]) => k)

const PRICE_BOOK_KEY_SET: ReadonlySet<string> = new Set(PRICE_BOOK_NUMERIC_KEYS)

// ── Javna napaka plasti (rute jo preslikajo v 4xx/5xx) ──────────────────────

/** Napaka cenikove plasti — sporočilo je JAVNO (slovensko), status določi ruta. */
export class PriceBookStoreError extends Error {
  /** Predlagani HTTP status (503 = ni aktivne knjige; 409 = pokvarjeno stanje; 400 = validacija). */
  readonly suggestedStatus: 400 | 409 | 503
  constructor(message: string, suggestedStatus: 400 | 409 | 503) {
    super(message)
    this.name = 'PriceBookStoreError'
    this.suggestedStatus = suggestedStatus
  }
}

// ── Naložena (rekonstruirana) verzija cenika ────────────────────────────────

export interface LoadedPriceBookItem {
  key: string
  label: string
  unit: string
  category: string
  salesPrice: number
  /** NULL = NEZNANO (iskrena marža, §8). */
  referenceCost: number | null
}

export interface LoadedPriceBook {
  id: string
  version: number
  status: string
  currency: string
  /** Rekonstruiran PriceBook — TOČNO ta objekt je vhod buildQuote/fingerprint. */
  prices: PriceBook
  items: readonly LoadedPriceBookItem[]
}

type PriceBookVersionRow = { id: string; version: number; status: string; currency: string }
type PriceBookItemRow = { key: string; label: string; unit: string; category: string; salesPrice: unknown; referenceCost: unknown }

/** Decimal → number (Prisma Decimal). Zavrne ne-končne vrednosti (fail-closed). */
function decimalToNumber(value: unknown, key: string): number {
  const n = typeof value === 'object' && value !== null && typeof (value as { toNumber?: unknown }).toNumber === 'function'
    ? (value as { toNumber(): number }).toNumber()
    : Number(value)
  if (!Number.isFinite(n)) {
    throw new PriceBookStoreError(`Postavka cenika '${key}' ni veljavno število — stanje je pokvarjeno.`, 409)
  }
  return n
}

/**
 * Rekonstruira PriceBook iz verzije + postavk. Fail-closed: vsak numerični
 * ključ iz whitelista MORA obstajati (manjkajoč ključ → 409 pokvarjeno
 * stanje, NIKOLI privzeta vrednost iz defaultPriceBook — to bi bila tiha
 * nadomestitev). Neznan ključ v bazi je prav tako pokvarjeno stanje.
 */
function reconstruct(rows: PriceBookItemRow[], currency: string): { prices: PriceBook; items: LoadedPriceBookItem[] } {
  const prices = defaultPriceBook({ currency }) // samo kot TIPOVSKA lupina — vsak numerični ključ spodaj PREPISOMO iz postavk
  const seen = new Set<string>()
  const items: LoadedPriceBookItem[] = []
  for (const row of rows) {
    if (!PRICE_BOOK_KEY_SET.has(row.key)) {
      throw new PriceBookStoreError(`Postavka cenika s ključem '${row.key}' ni v kanonskem whitelistu — stanje je pokvarjeno.`, 409)
    }
    if (seen.has(row.key)) {
      throw new PriceBookStoreError(`Podvojen ključ cenika '${row.key}' — stanje je pokvarjeno.`, 409)
    }
    seen.add(row.key)
    const salesPrice = decimalToNumber(row.salesPrice, row.key)
    const referenceCost = row.referenceCost === null ? null : decimalToNumber(row.referenceCost, `${row.key}.referenceCost`)
    ;(prices as unknown as Record<string, number>)[row.key] = salesPrice
    items.push({
      key: row.key,
      label: row.label,
      unit: row.unit,
      category: row.category,
      salesPrice,
      referenceCost,
    })
  }
  const manjkajoci = PRICE_BOOK_NUMERIC_KEYS.filter((k) => !seen.has(k))
  if (manjkajoci.length > 0) {
    throw new PriceBookStoreError(
      `Verzija cenika je nepopolna — manjkajo ključi: ${manjkajoci.join(', ')}.`,
      409,
    )
  }
  return { prices, items }
}

async function loadVersion(where: { id: string } | { status: string }): Promise<LoadedPriceBook> {
  const version = await db.priceBookVersion.findFirst({
    where,
    orderBy: { version: 'desc' },
    include: { items: true },
  })
  if (!version) {
    // Klicatelj ve, kateri status/kaj išče — sporočilo sestavi on (getActive → 503).
    throw new PriceBookStoreError('Verzija cenika ni najdena.', 404 as 400 | 409 | 503)
  }
  const { prices, items } = reconstruct(version.items, version.currency)
  return { id: version.id, version: version.version, status: version.status, currency: version.currency, prices, items }
}

/**
 * Aktivna verzija cenika + postavke → rekonstruiran PriceBook.
 *
 *   • NI aktivne verzije → `null` (klicatelj MORA fail-closed odkloniti —
 *     npr. /api/quote in /api/quotes vračata 503; privzete cene iz kode
 *     NISO poslovna resnica);
 *   • DVE ali več aktivnih hkrati → PriceBookStoreError 409 (pokvarjeno
 *     stanje; transakcijska aktivacija v createPriceBookVersion preprečuje
 *     nastanek, ta preverba pa odkrije ročne posege).
 */
export async function getActivePriceBookVersion(): Promise<LoadedPriceBook | null> {
  const active = await db.priceBookVersion.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, version: true, status: true, currency: true },
    orderBy: { version: 'desc' },
  })
  if (active.length === 0) return null
  if (active.length > 1) {
    throw new PriceBookStoreError(
      `Stanje cenika je pokvarjeno: ${active.length} aktivnih verzij hkrati (pričakovana natanko ena).`,
      409,
    )
  }
  return loadVersion({ id: active[0]!.id })
}

/**
 * Poljubna verzija cenika po id (za integrity preverbo VEZANE knjige v
 * deal-locku — vezana knjiga je lahko že RETIRED in je kljub temu vir
 * resnice za verzijo ponudbe, ki jo drži).
 */
export async function getPriceBookVersionById(id: string): Promise<LoadedPriceBook | null> {
  try {
    return await loadVersion({ id })
  } catch (error) {
    if (error instanceof PriceBookStoreError && error.message === 'Verzija cenika ni najdena.') return null
    throw error
  }
}

// ── Ustvarjanje nove (aktivirane) verzije ───────────────────────────────────

export interface NewPriceBookItemInput {
  key: string
  salesPrice: number
  referenceCost?: number | null
}

export interface CreatePriceBookVersionInput {
  /** Surovi podatki iz telesa zahteve — validacija (validateItems) je fail-closed. */
  items: unknown
  note?: string | null
  /** Id prijavljenega uporabnika (FK mehka referenca; servisni ključ → null). */
  actorId: string | null
  /** Revizijski kontekst — zapis je ATOMSKO z aktivacijo (§19 vzorec). */
  request?: Request
  session?: SessionPayload | null
  /** R294 F4: jedro ne sme brati stene ure — čas aktivacije OBVEZNO poda KLICATELJ (ruta). */
  now: Date
}

/** Validirana postavka za zapis (tipi + whitelist + meje). */
interface ValidatedItem {
  key: string
  label: string
  unit: string
  category: string
  salesPrice: number
  referenceCost: number | null
}

/** Oznake/enoete/kategorije za ključe (isti vir kot seed migracija r374). */
const ITEM_META: Readonly<Record<string, { label: string; unit: string; category: string }>> = {
  vatPercent: { label: 'DDV', unit: '%', category: 'OTHER' },
  discountPercent: { label: 'Popust', unit: '%', category: 'OTHER' },
  baseProfilePerM: { label: 'Osnovni U-profil', unit: 'm', category: 'PROFILES' },
  coverRailPerM: { label: 'Pokrovna letev (U / pravokotna)', unit: 'm', category: 'PROFILES' },
  roundHandrailPerM: { label: 'Okrogla pokrovna letev', unit: 'm', category: 'PROFILES' },
  woodHandrailPerM: { label: 'Lesena pokrovna letev', unit: 'm', category: 'PROFILES' },
  glassPerM2: { label: 'Steklo', unit: 'm2', category: 'GLASS' },
  polishedEdgePerM: { label: 'Obdelava robov stekla', unit: 'm', category: 'GLASS' },
  postPerEach: { label: 'Stebriček', unit: 'kos', category: 'POSTS' },
  postBasePlatePerEach: { label: 'Osnovna plošča stebrička', unit: 'kos', category: 'POSTS' },
  postSideBracketPerEach: { label: 'Bočni nosilec stebrička', unit: 'kos', category: 'POSTS' },
  anchorPerEach: { label: 'Sidro / vijak M8–M10', unit: 'kos', category: 'FIXINGS' },
  endCapPerEach: { label: 'Zaključna kapica letev', unit: 'kos', category: 'FIXINGS' },
  cornerElementPerEach: { label: 'Kotni element / varjeni vogal letev', unit: 'kos', category: 'FIXINGS' },
  barPerM: { label: 'Palica polnila', unit: 'm', category: 'INFILL' },
  meshPerM2: { label: 'Mreža / polnilo', unit: 'm2', category: 'INFILL' },
  woodPerM2: { label: 'Leseno polnilo', unit: 'm2', category: 'INFILL' },
  gasketPerM: { label: 'Tesnilo / podložna letev', unit: 'm', category: 'FIXINGS' },
  siliconeJointPerM: { label: 'Silikon za steklene fuge', unit: 'm', category: 'FIXINGS' },
  customElementPerEach: { label: 'Element po meri (lasten model)', unit: 'kos', category: 'INFILL' },
  demolitionPerM: { label: 'Demontaža obstoječe ograje', unit: 'm', category: 'LABOUR' },
  mountingPerM: { label: 'Montaža in nastavljanje', unit: 'm', category: 'LABOUR' },
  transportFlat: { label: 'Prevoz in logistika', unit: 'komplet', category: 'LABOUR' },
  surveyFlat: { label: 'Izmera na objektu', unit: 'komplet', category: 'LABOUR' },
  smallMaterialPercent: { label: 'Droben montažni material', unit: '%', category: 'OTHER' },
}

/**
 * Validacija postavk nove verzije — fail-closed:
 *   • polje `items` mora biti ne-prazno polje objektov;
 *   • ključi: TOČNO whitelist množica (neznani → 400 z imeni; manjkajoči →
 *     400 z imeni — nova verzija mora biti popolna, sicer bi rekonstrukcija
 *     padala);
 *   • salesPrice/referenceCost: končni števili ≥ 0 (string z vejico sprejmemo
 *     kot lokaliziran vnos, vzorec material-prices R136).
 */
function validateItems(items: unknown): ValidatedItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new PriceBookStoreError('Pričakovano ne-prazno polje postavk (items).', 400)
  }
  const out: ValidatedItem[] = []
  const seen = new Set<string>()
  for (const raw of items) {
    if (typeof raw !== 'object' || raw === null) {
      throw new PriceBookStoreError('Vsaka postavka mora biti objekt { key, salesPrice, referenceCost? }.', 400)
    }
    const { key, salesPrice, referenceCost } = raw as Record<string, unknown>
    if (typeof key !== 'string' || !PRICE_BOOK_KEY_SET.has(key)) {
      throw new PriceBookStoreError(`Neznan ključ cenika: ${String(key)}.`, 400)
    }
    if (seen.has(key)) {
      throw new PriceBookStoreError(`Podvojen ključ cenika: ${key}.`, 400)
    }
    seen.add(key)
    const meta = ITEM_META[key]!
    const parseNumber = (v: unknown, what: string): number => {
      const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
      if (!Number.isFinite(n) || n < 0) {
        throw new PriceBookStoreError(`${what} za '${key}' mora biti neznegativno število.`, 400)
      }
      return Math.round(n * 100) / 100
    }
    out.push({
      key,
      label: meta.label,
      unit: meta.unit,
      category: meta.category,
      salesPrice: parseNumber(salesPrice, 'salesPrice'),
      referenceCost: referenceCost === undefined || referenceCost === null ? null : parseNumber(referenceCost, 'referenceCost'),
    })
  }
  const manjkajoci = PRICE_BOOK_NUMERIC_KEYS.filter((k) => !seen.has(k))
  if (manjkajoci.length > 0) {
    throw new PriceBookStoreError(`Nova verzija cenika mora pokriti vse ključe — manjkajo: ${manjkajoci.join(', ')}.`, 400)
  }
  return out
}

/**
 * Ustvari novo verzijo cenika in jo AKTIVIRA — v ENI transakciji:
 *   1. prejšnja ACTIVE → RETIRED (effectiveTo = zdaj) — nikoli dve aktivni;
 *   2. nova verzija status ACTIVE (effectiveFrom = zdaj);
 *   3. postavke (validirane, popolne);
 *   4. revizijski vpis ATOMSKO z aktivacijo (§19 — padec revizije podre
 *      tudi aktivacijo).
 *
 * Vrača naloženo (rekonstruirano) novo verzijo.
 */
export async function createPriceBookVersion(input: CreatePriceBookVersionInput): Promise<LoadedPriceBook> {
  const validated = validateItems(input.items)
  const note = typeof input.note === 'string' && input.note.trim().length > 0 ? input.note.trim().slice(0, 500) : null

  const created = await db.$transaction(async (tx) => {
    // Zaporedna številka: max + 1 znotraj TRANSAKCIJE (dva vzporedna POST-a
    // se izstavita isto številko → edinstvenost version odbije drugega).
    const zadnja = await tx.priceBookVersion.aggregate({ _max: { version: true } })
    const versionNumber = (zadnja._max.version ?? 0) + 1
    // R294 F4: now IZKLJUČNO iz argumenta (jedro brez stene ure) — ruta
    // ga vedno poda; tipovno obvezen (prevajalnik prepreči izpust).
    const zdaj = input.now

    // Upokoji prejšnjo aktivno (če obstaja) — prehod ACTIVE → RETIRED po
    // matriki; effectiveTo zapre okno veljavnosti.
    const prejsnjaAktivna = await tx.priceBookVersion.findFirst({ where: { status: 'ACTIVE' } })
    if (prejsnjaAktivna) {
      await tx.priceBookVersion.update({
        where: { id: prejsnjaAktivna.id },
        data: { status: 'RETIRED', effectiveTo: zdaj },
      })
    }

    const nova = await tx.priceBookVersion.create({
      data: {
        version: versionNumber,
        status: 'ACTIVE',
        currency: 'EUR',
        effectiveFrom: zdaj,
        note,
        createdById: input.actorId,
        approvedById: input.actorId,
        approvedAt: zdaj,
      },
    })
    await tx.priceBookItem.createMany({
      data: validated.map((i) => ({
        priceBookVersionId: nova.id,
        key: i.key,
        label: i.label,
        unit: i.unit,
        category: i.category,
        salesPrice: i.salesPrice,
        referenceCost: i.referenceCost,
      })),
    })

    // Revizija (§19 atomsko): stara → nova verzija s števcem postavk.
    await auditInTx(tx, {
      request: input.request,
      session: input.session ?? null,
      userId: input.actorId,
      akcija: 'PRICE_BOOK_VERSION_ACTIVATED',
      oldValue: prejsnjaAktivna
        ? { version: prejsnjaAktivna.version, status: prejsnjaAktivna.status }
        : null,
      newValue: {
        version: versionNumber,
        postavk: validated.length,
        sPreverjenimiStroski: validated.filter((i) => i.referenceCost !== null).length,
        note,
      },
    })

    return nova
  })

  return loadVersion({ id: created.id })
}
