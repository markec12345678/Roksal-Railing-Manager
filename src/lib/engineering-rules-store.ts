/**
 * R393 (issue #13, korak R171 iz §15) — STORE PLAST inženirskih/compliance
 * pravil: EN VIR vseh mutacij (vzorec catalog-store R390 / bom-store R376).
 *
 * Načela:
 *   • VSAKA mutacija gre skozi transakcijo + ATOMSKI revizijski vpis (§19 —
 *     auditInTx; če audit pade, pade tudi posel);
 *   • DRAFT → ACTIVE → RETIRED stroj (matrika v engineering-rules-domain);
 *     aktivacija TRANSAKCIJSKO upokoji prejšnjo ACTIVE (veljavnostDo = now);
 *     dve ACTIVE = pokvarjeno stanje → 409 (prva linija) + partial UNIQUE
 *     erv v bazi (zadnja linija);
 *   • §15 LOČITEV guard na OBEH točkah: ustvarjanje verzije IN aktivacija —
 *     overitev PROJEKTANTSKA/STATISTICNA ZAHTEVA reviewerId (obstoječi
 *     Profile) + reviewedAt; nepreverjeno pravilo je lahko SAMO INFORMATIVNO;
 *   • NIČ `new Date()` v tej plasti (R294 F4 kanon) — stena ure živi v ruti,
 *     vsak klic prejme `now`/`asOf` parameter;
 *   • honest NULL (§8): standardReferenca/standardVerzija/jurisdikcija/
 *     calculatorVerzija ostanejo NULL, kadar klicatelj ne dokumentira;
 *   • EXACT primerjanje šifer (kanon §5 — brez fuzzy); productId se vezuje
 *     SAMO prek EXACT šifre produkta (404, če ne obstaja).
 */

import { Prisma } from '@prisma/client'
import type { SessionPayload } from './session'
import { db } from './db'
import { auditInTx } from './audit'
import { preberiJsonKolono } from './catalog-domain'
import {
  KATEGORIJE_OZNAKE,
  OVERITVE_OZNAKE,
  SKLADNOST_OPOZORILO,
  VIRI_OZNAKE,
  jeUradnoPreverjeno,
  povzetekSkladnosti,
  preveriUradnoOveritev,
  razredIzpisa,
  resolveAktivnaVerzijoPravila,
  strukturaPravilaSchema,
  validateAplikacijoPravila,
  validateKategorijo,
  validateOrientacijoPravila,
  validateOveritev,
  validateVir,
} from './engineering-rules'

/** Napaka plasti — sporočilo je JAVNO (slovensko), status določi ruta. */
export class EngineeringRulesStoreError extends Error {
  /** 400 validacija; 404 manjka vir; 409 poslovno stanje; 500 pokvarjen PODATEK (JSON). */
  readonly suggestedStatus: 400 | 404 | 409 | 500
  constructor(message: string, suggestedStatus: 400 | 404 | 409 | 500) {
    super(message)
    this.name = 'EngineeringRulesStoreError'
    this.suggestedStatus = suggestedStatus
  }
}

/** Revizijski kontekst — audit je OBVEZEN del vsake mutacije (§19). */
export interface RevizijskiKontekst {
  request: Request
  session: SessionPayload | null
  userId: string | null
}

export function revizijskiKontekst(
  request: Request,
  session: SessionPayload | null,
): RevizijskiKontekst {
  return { request, session, userId: session?.sub ?? null }
}

type Tx = Prisma.TransactionClient

// ── Vhodi ───────────────────────────────────────────────────────────────────

/** Vsebina verzije pravila — VSA §15 provenanca polja (honest NULL dovoljen). */
export interface VsebinaVerzijeVhod {
  vsebina: string
  struktura?: Record<string, unknown> | null
  vir: string
  virZapis?: string | null
  standardReferenca?: string | null
  standardVerzija?: string | null
  jurisdikcija?: string | null
  overitev: string
  calculatorVerzija?: string | null
  reviewedAt?: string | null
  reviewerId?: string | null
}

/** Ustvari pravilo (identiteta) + prvo DRAFT verzijo. */
export interface UstvariPraviloVhod extends VsebinaVerzijeVhod {
  sifra: string
  naziv: string
  kategorija: string
  aplikacija?: string | null
  /** EXACT šifra produkta (Product.sifra) — 404, če ne obstaja. */
  productSifra?: string | null
  orientacija?: string | null
}

// ── Skupne validacije (EN VIR — domain nabori) ──────────────────────────────

function zahtevanNiz(raw: unknown, polje: string): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new EngineeringRulesStoreError(`Polje "${polje}" je obvezno (neprazen niz).`, 400)
  }
  return raw.trim()
}

function neobvezenNiz(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  return raw.trim()
}

function validirajVsebinoVerzije(vhod: VsebinaVerzijeVhod): {
  vir: string
  overitev: string
  reviewedAt: Date | null
  reviewerId: string | null
} {
  const vir = validateVir(vhod.vir)
  if (!vir.ok) throw new EngineeringRulesStoreError(vir.error, 400)
  const overitev = validateOveritev(vhod.overitev)
  if (!overitev.ok) throw new EngineeringRulesStoreError(overitev.error, 400)

  const reviewedAtRaw = neobvezenNiz(vhod.reviewedAt)
  let reviewedAt: Date | null = null
  if (reviewedAtRaw !== null) {
    const parsed = new Date(reviewedAtRaw)
    if (Number.isNaN(parsed.getTime())) {
      throw new EngineeringRulesStoreError(
        `Polje "reviewedAt" ni veljaven ISO datum: '${reviewedAtRaw}'`,
        400,
      )
    }
    reviewedAt = parsed
  }
  const reviewerId = neobvezenNiz(vhod.reviewerId)

  // §15 LOČITEV guard — ustvarjanje: uradna overitev ZAHTEVA pregled.
  const napaka = preveriUradnoOveritev(overitev.value, reviewerId, reviewedAt)
  if (napaka !== null) throw new EngineeringRulesStoreError(napaka, 409)

  return { vir: vir.value, overitev: overitev.value, reviewedAt, reviewerId }
}

async function preveriPregledalca(tx: Tx, reviewerId: string | null): Promise<void> {
  if (reviewerId === null) return
  const obstaja = await tx.profile.findUnique({ where: { id: reviewerId }, select: { id: true } })
  if (!obstaja) {
    throw new EngineeringRulesStoreError(
      `Pregledalec (reviewerId '${reviewerId}') ne obstaja — uradna overitev zahteva sledljivega pregledalca (§15).`,
      404,
    )
  }
}

// ── Ustvari pravilo + verzijo 1 (DRAFT) ──────────────────────────────────────

export async function ustvariPraviloVTx(
  tx: Tx,
  vhod: UstvariPraviloVhod,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  const sifra = zahtevanNiz(vhod.sifra, 'sifra')
  const naziv = zahtevanNiz(vhod.naziv, 'naziv')
  const vsebina = zahtevanNiz(vhod.vsebina, 'vsebina')

  const kategorija = validateKategorijo(vhod.kategorija)
  if (!kategorija.ok) throw new EngineeringRulesStoreError(kategorija.error, 400)
  const aplikacija = validateAplikacijoPravila(vhod.aplikacija ?? null)
  if (!aplikacija.ok) throw new EngineeringRulesStoreError(aplikacija.error, 400)
  const orientacija = validateOrientacijoPravila(vhod.orientacija ?? null)
  if (!orientacija.ok) throw new EngineeringRulesStoreError(orientacija.error, 400)

  const v = validirajVsebinoVerzije(vhod)
  await preveriPregledalca(tx, v.reviewerId)

  // EXACT šifra (kanon §5 — brez fuzzy).
  const obstojeca = await tx.engineeringRule.findUnique({ where: { sifra } })
  if (obstojeca) {
    throw new EngineeringRulesStoreError(
      `Pravilo s šifro '${sifra}' ŽE obstaja (verzija: ${obstojeca.id}) — uporabite novo verzijo obstoječega pravila.`,
      409,
    )
  }

  // Produkt vezava SAMO prek EXACT šifre produkta (404, če ne obstaja).
  let productId: string | null = null
  const productSifra = neobvezenNiz(vhod.productSifra)
  if (productSifra !== null) {
    const produkt = await tx.product.findUnique({ where: { sifra: productSifra }, select: { id: true } })
    if (!produkt) {
      throw new EngineeringRulesStoreError(`Produkt s šifro '${productSifra}' ne obstaja.`, 404)
    }
    productId = produkt.id
  }

  const pravilo = await tx.engineeringRule.create({
    data: {
      sifra,
      naziv,
      kategorija: kategorija.value,
      aplikacija: aplikacija.value,
      productId,
      orientacija: orientacija.value,
      aktivno: true,
    },
  })
  const verzija = await tx.engineeringRuleVersion.create({
    data: {
      ruleId: pravilo.id,
      verzija: 1,
      status: 'DRAFT',
      vsebina,
      strukturaJson: vhod.struktura ? JSON.stringify(vhod.struktura) : null,
      vir: v.vir,
      virZapis: neobvezenNiz(vhod.virZapis),
      standardReferenca: neobvezenNiz(vhod.standardReferenca),
      standardVerzija: neobvezenNiz(vhod.standardVerzija),
      jurisdikcija: neobvezenNiz(vhod.jurisdikcija),
      overitev: v.overitev,
      calculatorVerzija: neobvezenNiz(vhod.calculatorVerzija),
      veljavnostOd: now,
      veljavnostDo: null,
      reviewedAt: v.reviewedAt,
      reviewerId: v.reviewerId,
      createdById: revizija.userId,
    },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'ENGINEERING_RULE_CREATED',
    newValue: {
      id: pravilo.id,
      sifra,
      kategorija: kategorija.value,
      verzija: 1,
      status: 'DRAFT',
      vir: v.vir,
      overitev: v.overitev,
    },
  })
  return { pravilo, verzija }
}

// ── Nova verzija obstoječega pravila (DRAFT, zaporedna) ─────────────────────

export async function novaVerzijaPravilaVTx(
  tx: Tx,
  ruleId: string,
  vhod: VsebinaVerzijeVhod,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  const pravilo = await tx.engineeringRule.findUnique({ where: { id: ruleId } })
  if (!pravilo) {
    throw new EngineeringRulesStoreError(`Pravilo '${ruleId}' ne obstaja.`, 404)
  }
  const vsebina = zahtevanNiz(vhod.vsebina, 'vsebina')
  const v = validirajVsebinoVerzije(vhod)
  await preveriPregledalca(tx, v.reviewerId)

  const zadnja = await tx.engineeringRuleVersion.findFirst({
    where: { ruleId },
    orderBy: { verzija: 'desc' },
    select: { verzija: true },
  })
  const novaVerzija = (zadnja?.verzija ?? 0) + 1

  const verzija = await tx.engineeringRuleVersion.create({
    data: {
      ruleId,
      verzija: novaVerzija,
      status: 'DRAFT',
      vsebina,
      strukturaJson: vhod.struktura ? JSON.stringify(vhod.struktura) : null,
      vir: v.vir,
      virZapis: neobvezenNiz(vhod.virZapis),
      standardReferenca: neobvezenNiz(vhod.standardReferenca),
      standardVerzija: neobvezenNiz(vhod.standardVerzija),
      jurisdikcija: neobvezenNiz(vhod.jurisdikcija),
      overitev: v.overitev,
      calculatorVerzija: neobvezenNiz(vhod.calculatorVerzija),
      veljavnostOd: now,
      veljavnostDo: null,
      reviewedAt: v.reviewedAt,
      reviewerId: v.reviewerId,
      createdById: revizija.userId,
    },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'ENGINEERING_RULE_VERSION_CREATED',
    oldValue: { id: ruleId, sifra: pravilo.sifra, prejsnjaVerzija: zadnja?.verzija ?? null },
    newValue: { id: verzija.id, verzija: novaVerzija, status: 'DRAFT', vir: v.vir, overitev: v.overitev },
  })
  return verzija
}

// ── Aktivacija / upokojitev (pariteta katalog R390 + §15 guard) ─────────────

/**
 * Aktivacija DRAFT verzije: prejšnja ACTIVE → RETIRED (veljavnostDo = now) +
 * nova ACTIVE (veljavnostOd = now) — VSE v isti transakciji. §15 guard še
 * enkrat: uradna overitev brez pregleda = 409 (baza CHECK je zadnja linija).
 */
export async function aktivirajVerzijoPravilaVTx(
  tx: Tx,
  versionId: string,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  const verzija = await tx.engineeringRuleVersion.findUnique({ where: { id: versionId } })
  if (!verzija) {
    throw new EngineeringRulesStoreError(`Verzija pravila '${versionId}' ne obstaja.`, 404)
  }
  if (verzija.status !== 'DRAFT') {
    throw new EngineeringRulesStoreError(
      `Aktivirati se da SAMO DRAFT verzijo (trenutni status: ${verzija.status}).`,
      409,
    )
  }
  // §15 LOČITEV guard — aktivacija: nepreverjeno NE sme postati uradna resnica.
  const napaka = preveriUradnoOveritev(verzija.overitev, verzija.reviewerId, verzija.reviewedAt)
  if (napaka !== null) throw new EngineeringRulesStoreError(napaka, 409)

  const prejsnjaAktivna = await tx.engineeringRuleVersion.findFirst({
    where: { ruleId: verzija.ruleId, status: 'ACTIVE' },
  })
  if (prejsnjaAktivna) {
    await tx.engineeringRuleVersion.update({
      where: { id: prejsnjaAktivna.id },
      data: { status: 'RETIRED', veljavnostDo: now },
    })
    await auditInTx(tx, {
      ...revizija,
      akcija: 'ENGINEERING_RULE_VERSION_UPOKJENA',
      oldValue: { id: prejsnjaAktivna.id, verzija: prejsnjaAktivna.verzija, status: 'ACTIVE' },
      newValue: { id: prejsnjaAktivna.id, verzija: prejsnjaAktivna.verzija, status: 'RETIRED' },
    })
  }
  const aktivna = await tx.engineeringRuleVersion.update({
    where: { id: versionId },
    data: { status: 'ACTIVE', veljavnostOd: now, veljavnostDo: null },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'ENGINEERING_RULE_VERSION_AKTIVIRANA',
    oldValue: { id: versionId, verzija: verzija.verzija, status: 'DRAFT' },
    newValue: { id: versionId, verzija: verzija.verzija, status: 'ACTIVE' },
  })
  return aktivna
}

/** Upokojitev ACTIVE verzije (ACTIVE → RETIRED, veljavnostDo = now). */
export async function upokojiVerzijoPravilaVTx(
  tx: Tx,
  versionId: string,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  const verzija = await tx.engineeringRuleVersion.findUnique({ where: { id: versionId } })
  if (!verzija) {
    throw new EngineeringRulesStoreError(`Verzija pravila '${versionId}' ne obstaja.`, 404)
  }
  if (verzija.status !== 'ACTIVE') {
    throw new EngineeringRulesStoreError(
      `Upokojiti se da SAMO ACTIVE verzijo (trenutni status: ${verzija.status}).`,
      409,
    )
  }
  const upokojena = await tx.engineeringRuleVersion.update({
    where: { id: versionId },
    data: { status: 'RETIRED', veljavnostDo: now },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'ENGINEERING_RULE_VERSION_UPOKJENA',
    oldValue: { id: versionId, verzija: verzija.verzija, status: 'ACTIVE' },
    newValue: { id: versionId, verzija: verzija.verzija, status: 'RETIRED' },
  })
  return upokojena
}

// ── Branje (DTO sestava — JASNA §15 ločitev na vsakem odgovoru) ─────────────

type RuleRow = {
  id: string
  sifra: string
  naziv: string
  kategorija: string
  aplikacija: string | null
  productId: string | null
  orientacija: string | null
  aktivno: boolean
}

type VersionRow = {
  id: string
  ruleId: string
  verzija: number
  status: string
  vsebina: string
  strukturaJson: string | null
  vir: string
  virZapis: string | null
  standardReferenca: string | null
  standardVerzija: string | null
  jurisdikcija: string | null
  overitev: string
  calculatorVerzija: string | null
  veljavnostOd: Date
  veljavnostDo: Date | null
  reviewedAt: Date | null
  reviewerId: string | null
}

/** DTO aktivne verzije pravila — VSA §15 polja + razred (ločitev) odkrito. */
export function verzijaDto(ver: VersionRow) {
  const kontekst = { overitev: ver.overitev, reviewedAt: ver.reviewedAt, reviewerId: ver.reviewerId }
  const strukturaRes =
    ver.strukturaJson === null
      ? null
      : preberiJsonKolono(ver.strukturaJson, strukturaPravilaSchema, 'strukturaJson')
  if (strukturaRes !== null && !strukturaRes.ok) {
    throw new EngineeringRulesStoreError(
      `Verzija ${ver.verzija} pravila ima pokvarjeno kolono strukturaJson: ${strukturaRes.error}`,
      500,
    )
  }
  const struktura = strukturaRes === null ? null : strukturaRes.value
  return {
    verzijaId: ver.id,
    verzija: ver.verzija,
    status: ver.status,
    vsebina: ver.vsebina,
    struktura,
    vir: ver.vir,
    virOznaka: VIRI_OZNAKE[ver.vir as keyof typeof VIRI_OZNAKE] ?? ver.vir,
    virZapis: ver.virZapis,
    standardReferenca: ver.standardReferenca,
    standardVerzija: ver.standardVerzija,
    jurisdikcija: ver.jurisdikcija,
    overitev: ver.overitev,
    overitevOznaka: OVERITVE_OZNAKE[ver.overitev as keyof typeof OVERITVE_OZNAKE] ?? ver.overitev,
    calculatorVerzija: ver.calculatorVerzija,
    veljavnostOd: ver.veljavnostOd.toISOString(),
    veljavnostDo: ver.veljavnostDo?.toISOString() ?? null,
    reviewedAt: ver.reviewedAt?.toISOString() ?? null,
    reviewerId: ver.reviewerId,
    jeUradnoPreverjeno: jeUradnoPreverjeno(kontekst),
    razred: razredIzpisa(kontekst),
  }
}

/** DTO pravila (identiteta) + aktivna verzija na dan asOf. */
export type PraviloDto = ReturnType<typeof verzijaDto> & {
  id: string
  sifra: string
  naziv: string
  kategorija: string
  kategorijaOznaka: string
  aplikacija: string | null
  productId: string | null
  orientacija: string | null
  aktivno: boolean
}

export function praviloDto(rule: RuleRow, ver: VersionRow): PraviloDto {
  return {
    id: rule.id,
    sifra: rule.sifra,
    naziv: rule.naziv,
    kategorija: rule.kategorija,
    kategorijaOznaka: KATEGORIJE_OZNAKE[rule.kategorija as keyof typeof KATEGORIJE_OZNAKE] ?? rule.kategorija,
    aplikacija: rule.aplikacija,
    productId: rule.productId,
    orientacija: rule.orientacija,
    aktivno: rule.aktivno,
    ...verzijaDto(ver),
  }
}

export interface PravilaFiltri {
  kategorija?: string
  aplikacija?: string
  productSifra?: string
  vir?: string
}

/**
 * Seznam pravil z AKTIVNO verzijo na dan asOf + §15 skladnostni povzetek.
 * Filtri: kategorija/aplikacija/vir (EXACT iz naborov — 400 če neveljaven),
 * productSifra (EXACT šifra — 404 če ne obstaja). Če pravilo nima aktivne
 * (veljavne) verzije na dan asOf → NI na seznamu (honest — NE padamo na DRAFT).
 */
export async function pravilaSeznam(asOf: Date, filtri: PravilaFiltri) {
  if (filtri.kategorija !== undefined) {
    const k = validateKategorijo(filtri.kategorija)
    if (!k.ok) throw new EngineeringRulesStoreError(k.error, 400)
  }
  if (filtri.aplikacija !== undefined) {
    const a = validateAplikacijoPravila(filtri.aplikacija)
    if (!a.ok) throw new EngineeringRulesStoreError(a.error, 400)
  }
  if (filtri.vir !== undefined) {
    const v = validateVir(filtri.vir)
    if (!v.ok) throw new EngineeringRulesStoreError(v.error, 400)
  }
  let productId: string | null | undefined
  if (filtri.productSifra !== undefined) {
    const produkt = await db.product.findUnique({
      where: { sifra: filtri.productSifra },
      select: { id: true },
    })
    if (!produkt) {
      throw new EngineeringRulesStoreError(
        `Produkt s šifro '${filtri.productSifra}' ne obstaja.`,
        404,
      )
    }
    productId = produkt.id
  }

  const pravila = await db.engineeringRule.findMany({
    where: {
      aktivno: true,
      ...(filtri.kategorija !== undefined ? { kategorija: filtri.kategorija } : {}),
      ...(filtri.aplikacija !== undefined ? { aplikacija: filtri.aplikacija } : {}),
      ...(productId !== undefined ? { productId } : {}),
    },
    orderBy: { sifra: 'asc' },
    include: { versions: { where: { status: 'ACTIVE' } } },
  })

  const rezultat: PraviloDto[] = []
  for (const rule of pravila) {
    const aktivna = resolveAktivnaVerzijoPravila(
      rule.versions as unknown as VersionRow[],
      asOf,
    )
    if (aktivna === null) continue
    // vir živi na VERZIJI (provenanca) — filter se primerja po aktivni verziji.
    if (filtri.vir !== undefined && aktivna.vir !== filtri.vir) continue
    rezultat.push(praviloDto(rule, aktivna))
  }
  return {
    pravila: rezultat,
    skladnost: povzetekSkladnosti(rezultat),
    opozorilo: SKLADNOST_OPOZORILO,
  }
}

/**
 * Detail pravila (id ALI EXACT šifra) + VSE verzije (kronološko) — zgodovina
 * provenance je javna (§15: verzioniranje = dokaz, ne skrivnost).
 */
export async function praviloDetail(ident: string, asOf: Date) {
  const rule =
    (await db.engineeringRule.findUnique({ where: { id: ident } })) ??
    (await db.engineeringRule.findUnique({ where: { sifra: ident } }))
  if (!rule) {
    throw new EngineeringRulesStoreError(
      `Pravilo '${ident}' ne obstaja (iskano po id in EXACT šifri).`,
      404,
    )
  }
  const verzije = await db.engineeringRuleVersion.findMany({
    where: { ruleId: rule.id },
    orderBy: { verzija: 'asc' },
  })
  if (verzije.length === 0) {
    throw new EngineeringRulesStoreError(
      `Pravilo '${rule.sifra}' nima NOBENE verzije — pokvarjeno stanje (vsaka identiteta se rodi z verzijo 1).`,
      500,
    )
  }
  const aktivna = resolveAktivnaVerzijoPravila(verzije as unknown as VersionRow[], asOf)
  return {
    pravilo: praviloDto(rule, aktivna ?? (verzije[verzije.length - 1] as unknown as VersionRow)),
    aktivnaVerzijaObDatumu: aktivna === null ? null : aktivna.verzija,
    zgodovina: (verzije as unknown as VersionRow[]).map((v) => verzijaDto(v)),
    opozorilo: SKLADNOST_OPOZORILO,
  }
}
