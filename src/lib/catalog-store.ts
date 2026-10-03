/**
 * R390 (issue #13, korak R170 iz §14) — strežniška (transakcijska) plast
 * PRODUKTNEGA KATALOGA: ProductFamily → Product → ProductVariant →
 * ProductApplication → ProductCompatibility → ProductAccessory +
 * ProductCatalogVersion (effective dates) + ProductSupplierMapping.
 * ---------------------------------------------------------------------------
 * Problem, ki ga ta plast zapira (issue #13 §14): pravila produktov so se v
 * UI-jih podvajala kot hardcode — katalog zdaj živi v BAZI, rute NE smejo
 * pisati direktno v te tabele (EN VIR vseh mutacij, revizija ATOMSKA §19).
 *
 * Načela (delovni kanon repozitorija — enako kot crm-store R382):
 *   • fail-closed — neznan tip aplikacije/orientacije/kategorije/pravic →
 *     JAVNA napaka 400 s seznamom; dedup (unikatna kombinacija) → 409;
 *     manjkajoč vir (družina/verzija/produkt/dodatek/dobavitelj) → 404;
 *   • honest NULL (§8) — maxRazmakMm/okrepitevOpis/veljavnostDo NULL, ko
 *     neznani; veljavnostDo = "velja do preklica" (odprt interval);
 *   • statusni stroj verzije = pariteta PriceBookVersion R373: DRAFT →
 *     ACTIVE → RETIRED; aktivacija TRANSAKCIJSKO upokoji prejšnjo ACTIVE
 *     (dve ACTIVE = pokvarjeno stanje → javna napaka); RETIRED terminalno;
 *   • JSON kolone validirane ob VSAKI sestavi DTO (zod — catalog-domain);
 *   • §14 "ne hardcodirati v UI-jih": nabori živijo v catalog-domain,
 *     izpeljava podatkov pa IZKLJUČNO iz teh tabel prek snapshot/detajl
 *     funkcij (enosmerna odvisnost UI ← API ← store ← domena);
 *   • R294 F4 — stena ure živi v ruti: `now` je obvezen argument.
 *
 * Plast je STREŽNIŠKA (uvozi db); čisto jedro (nabori + validacije) živi v
 * src/lib/catalog-domain.ts.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type { SessionPayload } from './session'
import { auditInTx } from './audit'
import {
  APLIKACIJE,
  APLIKACIJE_OZNAKE,
  barvnaPaletaSchema,
  kompatibilnostImaNatankoEnCilj,
  intervalaSePrekrivata,
  jeSamoKompatibilnost,
  preberiJsonKolono,
  razmakKvalifikatorjiSchema,
  resolveAktivnaVerzija,
  rocajSchema,
  splosnaPravilaSchema,
  standardLengthsSchema,
  validateAplikacija,
  validateKategorija,
  validateMaxRazmakMm,
  validateOrientacija,
  validatePravice,
  viriSchema,
  zapriInterval,
  type Aplikacija,
  type Orientacija,
} from './catalog-domain'

/** Napaka plasti — sporočilo je JAVNO (slovensko), status določi ruta. */
export class CatalogStoreError extends Error {
  /** 400 validacija; 404 manjka vir; 409 poslovno stanje; 500 pokvarjen PODATEK (JSON). */
  readonly suggestedStatus: 400 | 404 | 409 | 500
  constructor(message: string, suggestedStatus: 400 | 404 | 409 | 500) {
    super(message)
    this.name = 'CatalogStoreError'
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

// ── Verzija kataloga (§14 catalog version + effective dates) ───────────────

export interface UstvariVerzijoVhod {
  opomba?: string | null
}

/** Ustvari NOVO DRAFT verzijo kataloga (zaporedna številka = max + 1). */
export async function ustvariVerzijoKatalogaVTx(
  tx: Tx,
  vhod: UstvariVerzijoVhod,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  const zadnja = await tx.productCatalogVersion.findFirst({
    orderBy: { verzija: 'desc' },
    select: { verzija: true },
  })
  const novaVerzija = (zadnja?.verzija ?? 0) + 1
  const ustvarjena = await tx.productCatalogVersion.create({
    data: {
      verzija: novaVerzija,
      status: 'DRAFT',
      veljavnostOd: now,
      opomba: vhod.opomba ?? null,
      createdById: revizija.userId,
    },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'KATALOG_VERZIJA_CREATED',
    newValue: { id: ustvarjena.id, verzija: novaVerzija, status: 'DRAFT' },
  })
  return ustvarjena
}

/**
 * Aktivacija DRAFT verzije (pariteta price-book R373): prejšnja ACTIVE →
 * RETIRED (veljavnostDo = now) + nova ACTIVE (veljavnostOd = now) — VSE v
 * isti transakciji. Dve ACTIVE hkrati = pokvarjeno stanje → javna napaka.
 */
export async function aktivirajVerzijoKatalogaVTx(
  tx: Tx,
  id: string,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  const verzija = await tx.productCatalogVersion.findUnique({ where: { id } })
  if (!verzija) {
    throw new CatalogStoreError(`Verzija kataloga '${id}' ne obstaja`, 404)
  }
  if (verzija.status !== 'DRAFT') {
    throw new CatalogStoreError(
      `Aktivirati se da SAMO DRAFT verzijo (trenutni status: ${verzija.status})`,
      409,
    )
  }
  const prejsnjaAktivna = await tx.productCatalogVersion.findFirst({
    where: { status: 'ACTIVE' },
  })
  if (prejsnjaAktivna) {
    await tx.productCatalogVersion.update({
      where: { id: prejsnjaAktivna.id },
      data: { status: 'RETIRED', veljavnostDo: now, approvedById: revizija.userId },
    })
    await auditInTx(tx, {
      ...revizija,
      akcija: 'KATALOG_VERZIJA_UPOKJENA',
      oldValue: { id: prejsnjaAktivna.id, verzija: prejsnjaAktivna.verzija, status: 'ACTIVE' },
      newValue: { id: prejsnjaAktivna.id, verzija: prejsnjaAktivna.verzija, status: 'RETIRED' },
    })
  }
  const aktivna = await tx.productCatalogVersion.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      veljavnostOd: now,
      veljavnostDo: null,
      approvedById: revizija.userId,
      approvedAt: now,
    },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'KATALOG_VERZIJA_AKTIVIRANA',
    oldValue: { id, verzija: verzija.verzija, status: 'DRAFT' },
    newValue: { id, verzija: verzija.verzija, status: 'ACTIVE' },
  })
  return aktivna
}

/** Upokojitev ACTIVE verzije (ACTIVE → RETIRED, veljavnostDo = now). */
export async function upokojiVerzijoKatalogaVTx(
  tx: Tx,
  id: string,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  const verzija = await tx.productCatalogVersion.findUnique({ where: { id } })
  if (!verzija) {
    throw new CatalogStoreError(`Verzija kataloga '${id}' ne obstaja`, 404)
  }
  if (verzija.status !== 'ACTIVE') {
    throw new CatalogStoreError(
      `Upokojiti se da SAMO ACTIVE verzijo (trenutni status: ${verzija.status})`,
      409,
    )
  }
  const upokojena = await tx.productCatalogVersion.update({
    where: { id },
    data: { status: 'RETIRED', veljavnostDo: now, approvedById: revizija.userId },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'KATALOG_VERZIJA_UPOKJENA',
    oldValue: { id, verzija: verzija.verzija, status: 'ACTIVE' },
    newValue: { id, verzija: verzija.verzija, status: 'RETIRED' },
  })
  return upokojena
}

// ── Produkt (§14 Product) ──────────────────────────────────────────────────

export interface UstvariProduktVhod {
  familySifra: string
  /** Verzija kataloga (id) — izpust = trenutno ACTIVE (fail-closed če ni). */
  catalogVersionId?: string | null
  sifra: string
  naziv: string
  kategorija: string
  faceWidthMm: number
  thicknessMm: number
  standardLengthsMm: number[]
  fixingMetoda: string
  screwsVisible: boolean
  interniOkrepitev: boolean
  okrepitevOpis?: string | null
  maxPostSpacingH?: number | null
  maxPostSpacingV?: number | null
  maxRailSpacingV?: number | null
  razmakKvalifikatorji?: Array<{ key: string; maxSpacingMm: number }>
  gapMinMm: number
  gapMaxMm: number
  rocaj: unknown
  posebnosti: string[]
  pravice: string
  viri: string[]
}

function zahtevajBesedilo(v: unknown, polje: string, min: number, max: number): string {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) {
    throw new CatalogStoreError(
      `Polje "${polje}" mora biti niz z ${min}–${max} znaki`,
      400,
    )
  }
  return v.trim()
}

function zahtevajPozitivnoInt(v: unknown, polje: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
    throw new CatalogStoreError(`Polje "${polje}" mora biti pozitivno celo število`, 400)
  }
  return v
}

function zahtevajNeodvednoInt(v: unknown, polje: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new CatalogStoreError(`Polje "${polje}" mora biti nenegativno celo število`, 400)
  }
  return v
}

/** Ustvari produkt (§14 polja VSA — dimenzije/pritrditev/vijaki/okrepitev/razmaki). */
export async function ustvariProduktVTx(
  tx: Tx,
  vhod: UstvariProduktVhod,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  const family = await tx.productFamily.findUnique({ where: { sifra: vhod.familySifra } })
  if (!family) {
    throw new CatalogStoreError(`Družina '${vhod.familySifra}' ne obstaja (EXACT šifra)`, 404)
  }

  let versionId = vhod.catalogVersionId ?? null
  if (!versionId) {
    const vse = await tx.productCatalogVersion.findMany()
    const res = resolveAktivnaVerzija(vse, now)
    if (!res) {
      throw new CatalogStoreError(
        'Ni ACTIVE verzije kataloga — produkt potrebuje verzijo (ustvari/aktiviraj prek /api/catalog/versions)',
        409,
      )
    }
    if ('napaka' in res) {
      throw new CatalogStoreError(res.napaka, 409)
    }
    versionId = res.verzija.id
  } else {
    const verzija = await tx.productCatalogVersion.findUnique({ where: { id: versionId } })
    if (!verzija) {
      throw new CatalogStoreError(`Verzija kataloga '${versionId}' ne obstaja`, 404)
    }
    if (verzija.status === 'RETIRED') {
      throw new CatalogStoreError(
        `Verzija ${verzija.verzija} je RETIRED — nove produkte vežemo na DRAFT/ACTIVE`,
        409,
      )
    }
  }

  const obstojeci = await tx.product.findUnique({ where: { sifra: vhod.sifra } })
  if (obstojeci) {
    throw new CatalogStoreError(`Produkt s šifro '${vhod.sifra}' že obstaja (EXACT)`, 409)
  }

  const kategorija = validateKategorija(vhod.kategorija)
  if (!kategorija.ok) throw new CatalogStoreError(kategorija.error, 400)
  const pravice = validatePravice(vhod.pravice)
  if (!pravice.ok) throw new CatalogStoreError(pravice.error, 400)

  const faceWidthMm = zahtevajPozitivnoInt(vhod.faceWidthMm, 'faceWidthMm')
  if (typeof vhod.thicknessMm !== 'number' || !Number.isFinite(vhod.thicknessMm) || vhod.thicknessMm <= 0) {
    throw new CatalogStoreError('Polje "thicknessMm" mora biti pozitivno število', 400)
  }
  const gapMinMm = zahtevajNeodvednoInt(vhod.gapMinMm, 'gapMinMm')
  const gapMaxMm = zahtevajNeodvednoInt(vhod.gapMaxMm, 'gapMaxMm')
  if (gapMaxMm < gapMinMm) {
    throw new CatalogStoreError('gapMaxMm mora biti ≥ gapMinMm', 400)
  }
  const std = standardLengthsSchema.safeParse(vhod.standardLengthsMm)
  if (!std.success) {
    throw new CatalogStoreError('standardLengthsMm mora biti neprazen seznam pozitivnih celih števil', 400)
  }
  const rocaj = rocajSchema.safeParse(vhod.rocaj)
  if (!rocaj.success) {
    throw new CatalogStoreError('rocaj ni veljaven (available + neobvezne dimenzije)', 400)
  }
  const viri = viriSchema.safeParse(vhod.viri)
  if (!viri.success) {
    throw new CatalogStoreError('viri mora biti neprazen seznam URL-jev', 400)
  }
  const kv = razmakKvalifikatorjiSchema.safeParse(vhod.razmakKvalifikatorji ?? [])
  if (!kv.success) {
    throw new CatalogStoreError('razmakKvalifikatorji morajo biti {key, maxSpacingMm>0}', 400)
  }
  if (!Array.isArray(vhod.posebnosti) || vhod.posebnosti.some((x) => typeof x !== 'string')) {
    throw new CatalogStoreError('posebnosti mora biti seznam nizov', 400)
  }
  const spacing = (
    [vhod.maxPostSpacingH, vhod.maxPostSpacingV, vhod.maxRailSpacingV] as Array<number | null | undefined>
  ).map((v) => {
    if (v === undefined || v === null) return null
    const r = validateMaxRazmakMm(v)
    if (!r.ok) throw new CatalogStoreError(r.error, 400)
    return r.value
  })
  if (vhod.interniOkrepitev && !vhod.okrepitevOpis) {
    throw new CatalogStoreError(
      'interniOkrepitev = true zahteva okrepitevOpis (citat vira — NE izmišljamo)',
      400,
    )
  }

  const ustvarjen = await tx.product.create({
    data: {
      familyId: family.id,
      catalogVersionId: versionId,
      sifra: zahtevajBesedilo(vhod.sifra, 'sifra', 2, 120),
      naziv: zahtevajBesedilo(vhod.naziv, 'naziv', 2, 200),
      kategorija: kategorija.value,
      faceWidthMm,
      thicknessMm: vhod.thicknessMm,
      standardLengthsJson: JSON.stringify(std.data),
      fixingMetoda: zahtevajBesedilo(vhod.fixingMetoda, 'fixingMetoda', 2, 2000),
      screwsVisible: vhod.screwsVisible === true,
      interniOkrepitev: vhod.interniOkrepitev === true,
      okrepitevOpis: vhod.okrepitevOpis?.trim() || null,
      maxPostSpacingH: spacing[0],
      maxPostSpacingV: spacing[1],
      maxRailSpacingV: spacing[2],
      razmakKvalifikatorjiJson: JSON.stringify(kv.data),
      gapMinMm,
      gapMaxMm,
      rocajJson: JSON.stringify(rocaj.data),
      posebnostiJson: JSON.stringify(vhod.posebnosti),
      pravice: pravice.value,
      viriJson: JSON.stringify(viri.data),
    },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'PRODUKT_CREATED',
    newValue: { id: ustvarjen.id, sifra: ustvarjen.sifra, family: family.sifra },
  })
  return ustvarjen
}

// ── Aplikacijski kontekst (§14 Application) ────────────────────────────────

export interface DodajAplikacijoVhod {
  aplikacija: string
  orientacija: string
  maxRazmakMm?: number | null
  vir: string
}

/** Doda EKSPPLICITNO aplikacijo produktu (unikatna kombinacija; dedupe 409). */
export async function dodajAplikacijoVTx(
  tx: Tx,
  productId: string,
  vhod: DodajAplikacijoVhod,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  void now // createdAt nosi DB default; argument ostaja za podpisno pariteto plasti
  const produkt = await tx.product.findUnique({ where: { id: productId } })
  if (!produkt) {
    throw new CatalogStoreError(`Produkt '${productId}' ne obstaja`, 404)
  }
  const aplikacija = validateAplikacija(vhod.aplikacija)
  if (!aplikacija.ok) throw new CatalogStoreError(aplikacija.error, 400)
  const orientacija = validateOrientacija(vhod.orientacija)
  if (!orientacija.ok) throw new CatalogStoreError(orientacija.error, 400)
  const maxRazmak = validateMaxRazmakMm(vhod.maxRazmakMm ?? null)
  if (!maxRazmak.ok) throw new CatalogStoreError(maxRazmak.error, 400)
  const vir = zahtevajBesedilo(vhod.vir, 'vir', 2, 2000)

  const obstojeca = await tx.productApplication.findFirst({
    where: {
      productId,
      aplikacija: aplikacija.value,
      orientacija: orientacija.value,
    },
  })
  if (obstojeca) {
    throw new CatalogStoreError(
      `Aplikacija ${aplikacija.value}/${orientacija.value} je za produkt '${produkt.sifra}' že zapisana`,
      409,
    )
  }
  const ustvarjena = await tx.productApplication.create({
    data: {
      productId,
      aplikacija: aplikacija.value,
      orientacija: orientacija.value,
      maxRazmakMm: maxRazmak.value,
      vir,
    },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'PRODUKT_APLIKACIJA_ADDED',
    newValue: {
      productId,
      sifra: produkt.sifra,
      aplikacija: aplikacija.value,
      orientacija: orientacija.value,
    },
  })
  return ustvarjena
}

// ── Varianta (§14 ProductVariant) ──────────────────────────────────────────

export interface UstvariVariantoVhod {
  sifra: string
  naziv: string
  barvaId?: string | null
  barvaHex?: string | null
  povrsina?: string | null
}

/** Ustvari varianto; barvaId MORA obstajati v družinski paleti (fail-closed). */
export async function ustvariVariantoVTx(
  tx: Tx,
  productId: string,
  vhod: UstvariVariantoVhod,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  void now
  const produkt = await tx.product.findUnique({
    where: { id: productId },
    include: { family: true },
  })
  if (!produkt) {
    throw new CatalogStoreError(`Produkt '${productId}' ne obstaja`, 404)
  }
  const paletaRes = preberiJsonKolono(produkt.family.barvnaPaletaJson, barvnaPaletaSchema, 'barvnaPaleta')
  if (!paletaRes.ok) throw new CatalogStoreError(paletaRes.error, 500)

  const obstojeca = await tx.productVariant.findUnique({ where: { sifra: vhod.sifra } })
  if (obstojeca) {
    throw new CatalogStoreError(`Varianta s šifro '${vhod.sifra}' že obstaja (EXACT)`, 409)
  }
  let barvaHex: string | null = vhod.barvaHex ?? null
  if (vhod.barvaId) {
    const barva = paletaRes.value.find((c) => c.id === vhod.barvaId)
    if (!barva) {
      throw new CatalogStoreError(
        `Barva '${vhod.barvaId}' ni v paleti družine '${produkt.family.sifra}' (dovoljene: ${paletaRes.value
          .map((c) => c.id)
          .join(', ')})`,
        400,
      )
    }
    // §8: hex iz palete SAMO kadar uradno obstaja — NE izmišljen.
    if (barvaHex !== null && barvaHex !== (barva.approxHex ?? null)) {
      throw new CatalogStoreError(
        `barvaHex '${barvaHex}' je v nasprotju s paletno vrednostjo za '${barva.id}' (${
          barva.approxHex ?? 'NULL — uradni hex ne obstaja'
        })`,
        400,
      )
    }
    barvaHex = barva.approxHex
  }
  const ustvarjena = await tx.productVariant.create({
    data: {
      productId,
      sifra: zahtevajBesedilo(vhod.sifra, 'sifra', 2, 160),
      naziv: zahtevajBesedilo(vhod.naziv, 'naziv', 2, 200),
      barvaId: vhod.barvaId ?? null,
      barvaHex,
      povrsina: vhod.povrsina?.trim() || null,
    },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'PRODUKT_VARIANTA_CREATED',
    newValue: { productId, sifra: produkt.sifra, varianta: ustvarjena.sifra },
  })
  return ustvarjena
}

// ── Kompatibilnost (§14 Compatibility) ─────────────────────────────────────

export interface DodajKompatibilnostVhod {
  productId: string
  kompatibilenProductId?: string | null
  kompatibilenDodatekId?: string | null
  opis?: string | null
}

/** Doda kompatibilnost — cilj produkt ALI dodatek (XOR), NE samemu sebi. */
export async function dodajKompatibilnostVTx(
  tx: Tx,
  vhod: DodajKompatibilnostVhod,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  void now
  const produkt = await tx.product.findUnique({ where: { id: vhod.productId } })
  if (!produkt) {
    throw new CatalogStoreError(`Produkt '${vhod.productId}' ne obstaja`, 404)
  }
  const cilj = {
    kompatibilenProductId: vhod.kompatibilenProductId ?? null,
    kompatibilenDodatekId: vhod.kompatibilenDodatekId ?? null,
  }
  if (!kompatibilnostImaNatankoEnCilj(cilj)) {
    throw new CatalogStoreError(
      'Kompatibilnost potrebuje NATANKO en cilj: kompatibilenProductId ALI kompatibilenDodatekId',
      400,
    )
  }
  if (jeSamoKompatibilnost(vhod.productId, cilj)) {
    throw new CatalogStoreError('Produkt ni kompatibilen samemu sebi', 400)
  }
  if (cilj.kompatibilenProductId) {
    const ciljni = await tx.product.findUnique({ where: { id: cilj.kompatibilenProductId } })
    if (!ciljni) {
      throw new CatalogStoreError(`Ciljni produkt '${cilj.kompatibilenProductId}' ne obstaja`, 404)
    }
    const dupl = await tx.productCompatibility.findFirst({
      where: { productId: vhod.productId, kompatibilenProductId: cilj.kompatibilenProductId },
    })
    if (dupl) {
      throw new CatalogStoreError(
        `Kompatibilnost '${produkt.sifra}' → '${ciljni.sifra}' je že zapisana`,
        409,
      )
    }
  }
  if (cilj.kompatibilenDodatekId) {
    const dodatek = await tx.productAccessory.findUnique({
      where: { id: cilj.kompatibilenDodatekId },
    })
    if (!dodatek) {
      throw new CatalogStoreError(`Dodatek '${cilj.kompatibilenDodatekId}' ne obstaja`, 404)
    }
    const dupl = await tx.productCompatibility.findFirst({
      where: { productId: vhod.productId, kompatibilenDodatekId: cilj.kompatibilenDodatekId },
    })
    if (dupl) {
      throw new CatalogStoreError(
        `Kompatibilnost '${produkt.sifra}' → dodatek '${dodatek.sifra}' je že zapisana`,
        409,
      )
    }
  }
  const ustvarjena = await tx.productCompatibility.create({
    data: {
      productId: vhod.productId,
      kompatibilenProductId: cilj.kompatibilenProductId,
      kompatibilenDodatekId: cilj.kompatibilenDodatekId,
      opis: vhod.opis?.trim() || null,
    },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'PRODUKT_KOMPATIBILNOST_ADDED',
    newValue: {
      productId: vhod.productId,
      sifra: produkt.sifra,
      kompatibilenProductId: cilj.kompatibilenProductId,
      kompatibilenDodatekId: cilj.kompatibilenDodatekId,
    },
  })
  return ustvarjena
}

// ── Preslikava na dobavitelja (§14 supplier mapping + effective dates) ─────

export interface DodajDobaviteljaVhod {
  productId: string
  supplierId: string
  veljavnostOd: Date
  veljavnostDo?: Date | null
  opomba?: string | null
}

/** Doda preslikavo produkt → dobavitelj; prekrivanje intervalov → 409. */
export async function dodajDobaviteljaVTx(
  tx: Tx,
  vhod: DodajDobaviteljaVhod,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  void now
  const produkt = await tx.product.findUnique({ where: { id: vhod.productId } })
  if (!produkt) {
    throw new CatalogStoreError(`Produkt '${vhod.productId}' ne obstaja`, 404)
  }
  const dobavitelj = await tx.supplier.findUnique({ where: { id: vhod.supplierId } })
  if (!dobavitelj) {
    throw new CatalogStoreError(`Dobavitelj '${vhod.supplierId}' ne obstaja`, 404)
  }
  if (vhod.veljavnostDo && vhod.veljavnostDo <= vhod.veljavnostOd) {
    throw new CatalogStoreError('veljavnostDo mora biti > veljavnostOd', 400)
  }
  const obstojece = await tx.productSupplierMapping.findMany({
    where: { productId: vhod.productId, supplierId: vhod.supplierId },
  })
  for (const m of obstojece) {
    if (
      intervalaSePrekrivata(
        { od: vhod.veljavnostOd, do: vhod.veljavnostDo ?? null },
        { od: m.veljavnostOd, do: m.veljavnostDo },
      )
    ) {
      throw new CatalogStoreError(
        `Preslikava na '${dobavitelj.naziv}' se prekriva z obstoječim intervalom (${m.veljavnostOd.toISOString()} – ${
          m.veljavnostDo?.toISOString() ?? 'odprto'
        })`,
        409,
      )
    }
  }
  const ustvarjena = await tx.productSupplierMapping.create({
    data: {
      productId: vhod.productId,
      supplierId: vhod.supplierId,
      veljavnostOd: vhod.veljavnostOd,
      veljavnostDo: vhod.veljavnostDo ?? null,
      opomba: vhod.opomba?.trim() || null,
      createdById: revizija.userId,
    },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'PRODUKT_DOBAVITELJ_ADDED',
    newValue: {
      productId: vhod.productId,
      sifra: produkt.sifra,
      supplier: dobavitelj.naziv,
      veljavnostOd: vhod.veljavnostOd.toISOString(),
      veljavnostDo: vhod.veljavnostDo?.toISOString() ?? null,
    },
  })
  return ustvarjena
}

/** Prekliče (zapre) ODPRTO preslikavo — veljavnostDo = now. */
export async function prekliciDobaviteljaVTx(
  tx: Tx,
  id: string,
  revizija: RevizijskiKontekst,
  now: Date,
) {
  const mapping = await tx.productSupplierMapping.findUnique({ where: { id } })
  if (!mapping) {
    throw new CatalogStoreError(`Preslikava '${id}' ne obstaja`, 404)
  }
  if (mapping.veljavnostDo !== null) {
    throw new CatalogStoreError('Preslikava je že zaprta (veljavnostDo je nastavljena)', 409)
  }
  const zaprtje = zapriInterval(mapping.veljavnostOd, now)
  if ('napaka' in zaprtje) throw new CatalogStoreError(zaprtje.napaka, 400)
  const zaprta = await tx.productSupplierMapping.update({
    where: { id },
    data: { veljavnostDo: zaprtje.do },
  })
  await auditInTx(tx, {
    ...revizija,
    akcija: 'PRODUKT_DOBAVITELJ_PREKLICAN',
    oldValue: { id, veljavnostDo: null },
    newValue: { id, veljavnostDo: zaprtje.do.toISOString() },
  })
  return zaprta
}

// ── Branja (§14: UI bere IZKLJUČNO tu — ne lastnih hardcode pravil) ────────

/** Decimal → number (DTO pravilo R380 — decToPlain/number na API meji). */
function dec(v: Prisma.Decimal | null): number | null {
  return v === null ? null : Number(v)
}

export interface KatalogSnapshot {
  verzija: {
    id: string
    verzija: number
    status: string
    veljavnostOd: string
    veljavnostDo: string | null
    opomba: string | null
  }
  družine: Array<{
    id: string
    sifra: string
    naziv: string
    material: string
    garancija: string | null
    uradnaStran: string | null
    pravice: string
    barvnaPaleta: unknown
    splosnaPravila: string[]
  }>
  produkti: Array<{
    id: string
    familySifra: string
    sifra: string
    naziv: string
    kategorija: string
    faceWidthMm: number
    thicknessMm: number | null
    standardLengthsMm: number[]
    fixingMetoda: string
    screwsVisible: boolean
    interniOkrepitev: boolean
    okrepitevOpis: string | null
    maxPostSpacingH: number | null
    maxPostSpacingV: number | null
    maxRailSpacingV: number | null
    razmakKvalifikatorji: Array<{ key: string; maxSpacingMm: number }>
    gapMinMm: number
    gapMaxMm: number
    rocaj: unknown
    posebnosti: string[]
    pravice: string
    viri: string[]
    aktivna: boolean
    aplikacije: Array<{
      aplikacija: string
      oznaka: string
      orientacija: string
      maxRazmakMm: number | null
      vir: string
    }>
    kompatibilniDodatki: Array<{ sifra: string; naziv: string; opis: string | null }>
    kompatibilniProdukti: Array<{ sifra: string; naziv: string }>
    dobavitelji: Array<{ naziv: string; veljavnostOd: string; veljavnostDo: string | null }>
  }>
  dodatki: Array<{
    id: string
    sifra: string
    naziv: string
    dimenzije: number[] | null
    notranjeMere: number[] | null
    opis: string | null
  }>
}

function sestaviProdukt(
  p: {
    id: string
    sifra: string
    naziv: string
    kategorija: string
    faceWidthMm: number
    thicknessMm: Prisma.Decimal
    standardLengthsJson: string
    fixingMetoda: string
    screwsVisible: boolean
    interniOkrepitev: boolean
    okrepitevOpis: string | null
    maxPostSpacingH: number | null
    maxPostSpacingV: number | null
    maxRailSpacingV: number | null
    razmakKvalifikatorjiJson: string
    gapMinMm: number
    gapMaxMm: number
    rocajJson: string
    posebnostiJson: string
    pravice: string
    viriJson: string
    aktivna: boolean
    family: { sifra: string }
    applications: Array<{
      aplikacija: string
      orientacija: string
      maxRazmakMm: number | null
      vir: string
    }>
    compatSource: Array<{
      opis: string | null
      kompatibilenProduct: { sifra: string; naziv: string } | null
      kompatibilenDodatek: { sifra: string; naziv: string } | null
    }>
    supplierMappings: Array<{
      supplier: { naziv: string }
      veljavnostOd: Date
      veljavnostDo: Date | null
    }>
  },
  fail: (msg: string) => never,
): KatalogSnapshot['produkti'][number] {
  const std = preberiJsonKolono(p.standardLengthsJson, standardLengthsSchema, 'standardLengthsMm')
  if (!std.ok) return fail(`Produkt '${p.sifra}': ${std.error}`)
  const kv = preberiJsonKolono(p.razmakKvalifikatorjiJson, razmakKvalifikatorjiSchema, 'razmakKvalifikatorji')
  if (!kv.ok) return fail(`Produkt '${p.sifra}': ${kv.error}`)
  const rocaj = preberiJsonKolono(p.rocajJson, rocajSchema, 'rocaj')
  if (!rocaj.ok) return fail(`Produkt '${p.sifra}': ${rocaj.error}`)
  const posebnosti = preberiJsonKolono(p.posebnostiJson, splosnaPravilaSchema, 'posebnosti')
  if (!posebnosti.ok) return fail(`Produkt '${p.sifra}': ${posebnosti.error}`)
  const viri = preberiJsonKolono(p.viriJson, viriSchema, 'viri')
  if (!viri.ok) return fail(`Produkt '${p.sifra}': ${viri.error}`)
  return {
    id: p.id,
    familySifra: p.family.sifra,
    sifra: p.sifra,
    naziv: p.naziv,
    kategorija: p.kategorija,
    faceWidthMm: p.faceWidthMm,
    thicknessMm: dec(p.thicknessMm),
    standardLengthsMm: std.value,
    fixingMetoda: p.fixingMetoda,
    screwsVisible: p.screwsVisible,
    interniOkrepitev: p.interniOkrepitev,
    okrepitevOpis: p.okrepitevOpis,
    maxPostSpacingH: p.maxPostSpacingH,
    maxPostSpacingV: p.maxPostSpacingV,
    maxRailSpacingV: p.maxRailSpacingV,
    razmakKvalifikatorji: kv.value,
    gapMinMm: p.gapMinMm,
    gapMaxMm: p.gapMaxMm,
    rocaj: rocaj.value,
    posebnosti: posebnosti.value,
    pravice: p.pravice,
    viri: viri.value,
    aktivna: p.aktivna,
    aplikacije: p.applications.map((a) => ({
      aplikacija: a.aplikacija,
      oznaka: APLIKACIJE_OZNAKE[a.aplikacija as Aplikacija] ?? a.aplikacija,
      orientacija: a.orientacija,
      maxRazmakMm: a.maxRazmakMm,
      vir: a.vir,
    })),
    kompatibilniDodatki: p.compatSource
      .filter((c) => c.kompatibilenDodatek)
      .map((c) => ({
        sifra: c.kompatibilenDodatek!.sifra,
        naziv: c.kompatibilenDodatek!.naziv,
        opis: c.opis,
      })),
    kompatibilniProdukti: p.compatSource
      .filter((c) => c.kompatibilenProduct)
      .map((c) => ({ sifra: c.kompatibilenProduct!.sifra, naziv: c.kompatibilenProduct!.naziv })),
    dobavitelji: p.supplierMappings.map((m) => ({
      naziv: m.supplier.naziv,
      veljavnostOd: m.veljavnostOd.toISOString(),
      veljavnostDo: m.veljavnostDo?.toISOString() ?? null,
    })),
  }
}

/**
 * POLJNI snapshot kataloga (§14 branje za UI — ENA točka brez hardcode
 * pravil): aktivna verzija na `asOf` + vse družine/produkti/aplikacije/
 * dodatki/kompatibilnost/dobavitelji. Brez ACTIVE verzije → 409 (NE mešaj
 * upokojenih produktov v "aktualni" katalog — to bi bila laž). Pokvarjena
 * JSON kolona → javna napaka (NE tihi odvzem podatka).
 * R294 F4: asOf je OBVEZEN argument — stena ure živi v ruti.
 */
export async function katalogSnapshot(asOf: Date): Promise<KatalogSnapshot> {
  const verzije = await db.productCatalogVersion.findMany()
  const res = resolveAktivnaVerzija(verzije, asOf)
  if (!res) {
    throw new CatalogStoreError(
      'Ni ACTIVE verzije kataloga (ustvari/aktiviraj prek /api/catalog/versions)',
      409,
    )
  }
  if ('napaka' in res) {
    throw new CatalogStoreError(res.napaka, 409)
  }
  const aktivna = res.verzija

  const families = await db.productFamily.findMany({ orderBy: { sifra: 'asc' } })
  const products = await db.product.findMany({
    where: { catalogVersionId: aktivna.id },
    orderBy: { sifra: 'asc' },
    include: {
      family: { select: { sifra: true } },
      applications: { orderBy: { aplikacija: 'asc' } },
      compatSource: {
        include: {
          kompatibilenProduct: { select: { sifra: true, naziv: true } },
          kompatibilenDodatek: { select: { sifra: true, naziv: true } },
        },
      },
      supplierMappings: { include: { supplier: { select: { naziv: true } } } },
    },
  })
  const accessories = await db.productAccessory.findMany({ orderBy: { sifra: 'asc' } })

  const fail = (msg: string): never => {
    throw new CatalogStoreError(msg, 500)
  }

  return {
    verzija: {
      id: aktivna.id,
      verzija: aktivna.verzija,
      status: aktivna.status,
      veljavnostOd: aktivna.veljavnostOd.toISOString(),
      veljavnostDo: aktivna.veljavnostDo?.toISOString() ?? null,
      opomba: aktivna.opomba ?? null,
    },
    družine: families.map((f) => {
      const paleta = preberiJsonKolono(f.barvnaPaletaJson, barvnaPaletaSchema, 'barvnaPaleta')
      if (!paleta.ok) return fail(`Družina '${f.sifra}': ${paleta.error}`)
      const pravila = preberiJsonKolono(f.splosnaPravilaJson, splosnaPravilaSchema, 'splosnaPravila')
      if (!pravila.ok) return fail(`Družina '${f.sifra}': ${pravila.error}`)
      return {
        id: f.id,
        sifra: f.sifra,
        naziv: f.naziv,
        material: f.material,
        garancija: f.garancija,
        uradnaStran: f.uradnaStran,
        pravice: f.pravice,
        barvnaPaleta: paleta.value,
        splosnaPravila: pravila.value,
      }
    }),
    produkti: products.map((p) => sestaviProdukt(p, fail)),
    dodatki: accessories.map((a) => ({
      id: a.id,
      sifra: a.sifra,
      naziv: a.naziv,
      dimenzije: a.dimenzijeJson ? (JSON.parse(a.dimenzijeJson) as number[]) : null,
      notranjeMere: a.notranjeMereJson ? (JSON.parse(a.notranjeMereJson) as number[]) : null,
      opis: a.opis,
    })),
  }
}

/**
 * PRODUKTI ZA APLIKACIJO (§14 anti-hardcode čtivo): kateri produkti so
 * DOKUMENTIRANI za aplikacijo (npr. POKONCNA_OGRAJA) — izključno iz
 * ProductApplication vrstic AKTIVNE verzije kataloga (NE upokojenih —
 * kanon katalogSnapshot). Neznan tip → 400 (seznam v sporočilu); brez
 * ACTIVE verzije → 409. R294 F4: asOf je OBVEZEN argument — stena ure
 * živi v ruti.
 */
export async function produktiZaAplikacijo(
  aplikacija: string,
  asOf: Date,
  orientacija?: string,
): Promise<KatalogSnapshot['produkti']> {
  const valid = validateAplikacija(aplikacija)
  if (!valid.ok) throw new CatalogStoreError(valid.error, 400)
  let orient: Orientacija | undefined
  if (orientacija !== undefined) {
    const o = validateOrientacija(orientacija)
    if (!o.ok) throw new CatalogStoreError(o.error, 400)
    orient = o.value
  }
  const verzije = await db.productCatalogVersion.findMany()
  const resVerzija = resolveAktivnaVerzija(verzije, asOf)
  if (!resVerzija) {
    throw new CatalogStoreError(
      'Ni ACTIVE verzije kataloga (ustvari/aktiviraj prek /api/catalog/versions)',
      409,
    )
  }
  if ('napaka' in resVerzija) throw new CatalogStoreError(resVerzija.napaka, 409)

  const rows = await db.product.findMany({
    where: {
      aktivna: true,
      catalogVersionId: resVerzija.verzija.id,
      applications: {
        some: { aplikacija: valid.value, ...(orient ? { orientacija: orient } : {}) },
      },
    },
    orderBy: { sifra: 'asc' },
    include: {
      family: { select: { sifra: true } },
      applications: { orderBy: { aplikacija: 'asc' } },
      compatSource: {
        include: {
          kompatibilenProduct: { select: { sifra: true, naziv: true } },
          kompatibilenDodatek: { select: { sifra: true, naziv: true } },
        },
      },
      supplierMappings: { include: { supplier: { select: { naziv: true } } } },
    },
  })
  const fail = (msg: string): never => {
    throw new CatalogStoreError(msg, 500)
  }
  return rows.map((p) => sestaviProdukt(p, fail))
}

/** Detajl produkta (vse aplikacije/kompatibilnost/dobavitelji/variante). */
export async function produktDetajl(id: string) {
  const p = await db.product.findUnique({
    where: { id },
    include: {
      family: true,
      catalogVersion: { select: { id: true, verzija: true, status: true } },
      applications: { orderBy: { aplikacija: 'asc' } },
      variants: { orderBy: { sifra: 'asc' } },
      compatSource: {
        include: {
          kompatibilenProduct: { select: { id: true, sifra: true, naziv: true } },
          kompatibilenDodatek: { select: { id: true, sifra: true, naziv: true } },
        },
      },
      compatTarget: {
        include: {
          product: { select: { id: true, sifra: true, naziv: true } },
        },
      },
      supplierMappings: { include: { supplier: true } },
    },
  })
  if (!p) return null
  const fail = (msg: string): never => {
    throw new CatalogStoreError(msg, 500)
  }
  const osnovni = sestaviProdukt(
    {
      ...p,
      compatSource: p.compatSource.map((c) => ({
        opis: c.opis,
        kompatibilenProduct: c.kompatibilenProduct
          ? { sifra: c.kompatibilenProduct.sifra, naziv: c.kompatibilenProduct.naziv }
          : null,
        kompatibilenDodatek: c.kompatibilenDodatek
          ? { sifra: c.kompatibilenDodatek.sifra, naziv: c.kompatibilenDodatek.naziv }
          : null,
      })),
      supplierMappings: p.supplierMappings.map((m) => ({
        supplier: { naziv: m.supplier.naziv },
        veljavnostOd: m.veljavnostOd,
        veljavnostDo: m.veljavnostDo,
      })),
    },
    fail,
  )
  return {
    ...osnovni,
    katalogVerzija: p.catalogVersion,
    variante: p.variants.map((v) => ({
      id: v.id,
      sifra: v.sifra,
      naziv: v.naziv,
      barvaId: v.barvaId,
      barvaHex: v.barvaHex,
      povrsina: v.povrsina,
      aktivna: v.aktivna,
    })),
    kompatibilnostZaNj: p.compatTarget.map((c) => ({
      produkt: c.product,
      opis: c.opis,
    })),
  }
}

/** Seznam verzij kataloga (administracija). */
export async function seznamVerzij() {
  const verzije = await db.productCatalogVersion.findMany({
    orderBy: { verzija: 'desc' },
    include: { _count: { select: { products: true } } },
  })
  return verzije.map((v) => ({
    id: v.id,
    verzija: v.verzija,
    status: v.status,
    veljavnostOd: v.veljavnostOd.toISOString(),
    veljavnostDo: v.veljavnostDo?.toISOString() ?? null,
    opomba: v.opomba,
    steviloProduktov: v._count.products,
    approvedAt: v.approvedAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
  }))
}

/** Besednjak aplikacij (UI dropdown — iz ENega vira, R390 §14). */
export function aplikacijeBesednjak(): Array<{ aplikacija: string; oznaka: string }> {
  return APLIKACIJE.map((a) => ({ aplikacija: a, oznaka: APLIKACIJE_OZNAKE[a] }))
}
