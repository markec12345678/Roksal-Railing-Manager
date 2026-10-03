// R393 — SEED PARITETA: BAZA == data/roksal-catalog.json + calculator.ts
// citati (issue #13, korak R171 iz §15).
// ---------------------------------------------------------------------------
// Dokaz, da seed migracije 20261009080000 ni izmišljeval: vsaka vsebina je
// ENAKA viru (generator r393-seed-sql-gen.mjs je edini izvor). §15 honesty:
//   • VSA pravila INFORMATIVNO + reviewedAt/reviewerId NULL — NIČ ni uradno
//     preverjeno (§8: NE izmišljamo pregledov);
//   • standardReferenca SAMO pri internih kalkulatorjevih pravilih — TOČNO
//     kot citira vir (vključno z odkrito zabeleženimi nedoslednostmi:
//     110 mm vs krogla 100 mm, "SIST EN" brez številke, EVS namesto SIST);
//   • katalog proizvajalca NE citira standardov → 32 vrstic z NULL (§8);
//   • calculatorVerzija: sdk-S+8 pri produktnih razmakih (Product SDK),
//     NULL pri splošnih (ročna navodila) in kalkulatorjevih (checkCompliance
//     NIMA lastne verzije formule — odkrito zabeleženo);
//   • KUBO pokončno BREZ pravila o razmaku stebrov (katalog ne dokumentira —
//     odkrita odsotnost, pariteta SDK "explicit positions" kanona).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db } from '@/lib/db'

const catalog = JSON.parse(readFileSync('data/roksal-catalog.json', 'utf8')) as {
  round: string
  retrievedAt: string
  generalMountingRules: string[]
  profiles: Array<{
    productId: string
    profile: string
    maxPostSpacingMm: Record<string, number | null>
    maxRailSpacingMm: Record<string, number | null> | null
    recommendedGapMm: { min: number; max: number }
  }>
}

/** Število produktnih razmak-pravil, ki jih katalog dokumentira. */
const pricakaniProduktniRazmaki = catalog.profiles.reduce((vsota, p) => {
  let n = 0
  if (p.maxPostSpacingMm.horizontal !== null && p.maxPostSpacingMm.horizontal !== undefined) n += 1
  if (p.maxPostSpacingMm.vertical !== null && p.maxPostSpacingMm.vertical !== undefined) n += 1
  if (p.maxRailSpacingMm && p.maxRailSpacingMm.vertical !== null && p.maxRailSpacingMm.vertical !== undefined) n += 1
  n += 1 // recommendedGapMm vedno dokumentiran
  return vsota + n
}, 0)

describe('R393 — seed obseg in statusna disciplina', () => {
  it(`točno ${9 + pricakaniProduktniRazmaki + 5} pravil (9 splošnih + ${prikacaniLabel()} + 5 kalkulatorjevih)`, async () => {
    const pravila = await db.engineeringRule.findMany()
    expect(pravila).toHaveLength(9 + pricakaniProduktniRazmaki + 5)
  })

  it('vsako pravilo ima TOČNO ENO verzijo 1 ACTIVE z odprtim intervalom', async () => {
    const verzije = await db.engineeringRuleVersion.findMany()
    expect(verzije).toHaveLength(9 + pricakaniProduktniRazmaki + 5)
    for (const v of verzije) {
      expect(v.verzija).toBe(1)
      expect(v.status).toBe('ACTIVE')
      expect(v.veljavnostDo).toBeNull()
    }
  })

  it('partial UNIQUE: nobeno pravilo nima dveh ACTIVE verzij', async () => {
    const aktivne = await db.engineeringRuleVersion.groupBy({
      by: ['ruleId'],
      where: { status: 'ACTIVE' },
      _count: { _all: true },
    })
    for (const g of aktivne) expect(g._count._all).toBe(1)
  })
})

describe('R393 — seed §15 honesty: NIČ ni uradno preverjeno', () => {
  it('VSE verzije: overitev INFORMATIVNO (§15 ločitev — odkrito)', async () => {
    const verzije = await db.engineeringRuleVersion.findMany({ select: { overitev: true } })
    expect(verzije.every((v) => v.overitev === 'INFORMATIVNO')).toBe(true)
  })

  it('VSE verzije: reviewedAt in reviewerId NULL (§8 — NE izmišljamo pregledov)', async () => {
    const verzije = await db.engineeringRuleVersion.findMany({
      select: { reviewedAt: true, reviewerId: true },
    })
    expect(verzije.every((v) => v.reviewedAt === null && v.reviewerId === null)).toBe(true)
  })

  it('NIČ ne zahteva uradnega CHECK-a (erv_uradno_zahteva_pregled — baza čista)', async () => {
    const uradne = await db.engineeringRuleVersion.count({ where: { overitev: { not: 'INFORMATIVNO' } } })
    expect(uradne).toBe(0)
  })
})

describe('R393 — seed pariteta: 9 splošnih pravil montaže == generalMountingRules', () => {
  it('vsebina vsakega je BYTE-EXACT citat vira (po šifrah MONT/RAZMAK/MATERIAL)', async () => {
    const sifre = [
      'MONT-SPLOSNO-01', 'MONT-SPLOSNO-02', 'MONT-SPLOSNO-03', 'MONT-SPLOSNO-04',
      'MONT-SPLOSNO-05', 'MONT-SPLOSNO-06', 'MONT-SPLOSNO-07',
      'RAZMAK-DESKE-SPLOSNO', 'MATERIAL-WPC-ODTENNEK',
    ]
    for (let i = 0; i < sifre.length; i++) {
      const pravilo = await db.engineeringRule.findUnique({ where: { sifra: sifre[i] } })
      expect(pravilo, `pravilo ${sifre[i]}`).not.toBeNull()
      const verzija = await db.engineeringRuleVersion.findFirst({
        where: { ruleId: pravilo!.id },
      })
      expect(verzija!.vsebina).toBe(catalog.generalMountingRules[i])
    }
  })

  it('vir: 8 × KATALOG_PROIZVAJALCA + 1 × SEKUNDARNI_VIR (WPC odtenek)', async () => {
    const wpc = await db.engineeringRule.findUnique({ where: { sifra: 'MATERIAL-WPC-ODTENNEK' } })
    const wpcVer = await db.engineeringRuleVersion.findFirst({ where: { ruleId: wpc!.id } })
    expect(wpcVer!.vir).toBe('SEKUNDARNI_VIR')
    expect(wpcVer!.virZapis).toContain('montaze-mlakar.si')
    const kataloske = await db.engineeringRuleVersion.count({ where: { vir: 'KATALOG_PROIZVAJALCA' } })
    expect(kataloske).toBe(8 + pricakaniProduktniRazmaki)
  })

  it('splošna pravila: calculatorVerzija NULL (ročna navodila — NE porablja kalkulator)', async () => {
    for (const sifra of ['MONT-SPLOSNO-01', 'RAZMAK-DESKE-SPLOSNO', 'MATERIAL-WPC-ODTENNEK']) {
      const pravilo = await db.engineeringRule.findUnique({ where: { sifra } })
      const verzija = await db.engineeringRuleVersion.findFirst({ where: { ruleId: pravilo!.id } })
      expect(verzija!.calculatorVerzija).toBeNull()
    }
  })

  it('katalog NE citira standardov → standardReferenca NULL pri VSEH kataloških (§8)', async () => {
    const kataloske = await db.engineeringRuleVersion.findMany({
      where: { vir: 'KATALOG_PROIZVAJALCA' },
      select: { standardReferenca: true, standardVerzija: true, jurisdikcija: true },
    })
    expect(kataloske.length).toBeGreaterThan(0)
    expect(
      kataloske.every(
        (v) => v.standardReferenca === null && v.standardVerzija === null && v.jurisdikcija === null,
      ),
    ).toBe(true)
  })
})

describe('R393 — seed pariteta: produktni razmaki == zapisi profilov', () => {
  it('vsak dokumentiran razmak ima pravilo z BYTE-EXACT strukturo', async () => {
    for (const p of catalog.profiles) {
      const primeri: Array<[string, Record<string, unknown>]> = []
      if (p.maxPostSpacingMm.horizontal !== null && p.maxPostSpacingMm.horizontal !== undefined) {
        primeri.push([`RAZMAK-PODSTEBRI-H-${p.productId}`, { maxSpacingMm: p.maxPostSpacingMm.horizontal }])
      }
      if (p.maxPostSpacingMm.vertical !== null && p.maxPostSpacingMm.vertical !== undefined) {
        primeri.push([`RAZMAK-PODSTEBRI-V-${p.productId}`, { maxSpacingMm: p.maxPostSpacingMm.vertical }])
      }
      if (p.maxRailSpacingMm && p.maxRailSpacingMm.vertical !== null && p.maxRailSpacingMm.vertical !== undefined) {
        primeri.push([`RAZMAK-PODCEVI-V-${p.productId}`, { maxSpacingMm: p.maxRailSpacingMm.vertical }])
      }
      primeri.push([
        `RAZMAK-PODDESKAMI-${p.productId}`,
        { minMm: p.recommendedGapMm.min, maxMm: p.recommendedGapMm.max },
      ])
      for (const [sifra, struktura] of primeri) {
        const pravilo = await db.engineeringRule.findUnique({ where: { sifra } })
        expect(pravilo, sifra).not.toBeNull()
        expect(pravilo!.kategorija).toBe('RAZMAK')
        const verzija = await db.engineeringRuleVersion.findFirst({ where: { ruleId: pravilo!.id } })
        expect(JSON.parse(verzija!.strukturaJson!)).toEqual(struktura)
        expect(verzija!.calculatorVerzija).toBe('sdk-S+8')
      }
    }
  })

  it('productId vezava: EXACT na Product.sifra (isti id-ji kot R390 seed)', async () => {
    const pravilo = await db.engineeringRule.findUnique({
      where: { sifra: 'RAZMAK-PODSTEBRI-H-woodcore-romb-67' },
      include: { product: true },
    })
    expect(pravilo!.product).not.toBeNull()
    expect(pravilo!.product!.sifra).toBe('woodcore-romb-67')
  })

  it('orientacije: H pravila horizontal, V pravila vertical, gap NULL', async () => {
    const h = await db.engineeringRule.findUnique({ where: { sifra: 'RAZMAK-PODSTEBRI-H-woodcore-romb-67' } })
    const v = await db.engineeringRule.findUnique({ where: { sifra: 'RAZMAK-PODSTEBRI-V-woodcore-polna-128' } })
    const gap = await db.engineeringRule.findUnique({ where: { sifra: 'RAZMAK-PODDESKAMI-woodcore-romb-67' } })
    expect(h!.orientacija).toBe('horizontal')
    expect(v!.orientacija).toBe('vertical')
    expect(gap!.orientacija).toBeNull()
  })

  it('KUBO pokončno BREZ pravila o razmaku stebrov (odkrita odsotnost — §8)', async () => {
    const h = await db.engineeringRule.findUnique({ where: { sifra: 'RAZMAK-PODSTEBRI-H-woodcore-kubo-80-42' } })
    const v = await db.engineeringRule.findUnique({ where: { sifra: 'RAZMAK-PODSTEBRI-V-woodcore-kubo-80-42' } })
    expect(h).toBeNull()
    expect(v).toBeNull()
    // KUBO ima SAMO podkonstrukcijo (1000 mm) + gap — pariteta SDK kanona.
    const cev = await db.engineeringRule.findUnique({ where: { sifra: 'RAZMAK-PODCEVI-V-woodcore-kubo-80-42' } })
    expect(cev).not.toBeNull()
  })
})

describe('R393 — seed pariteta: 5 pravil iz calculator.ts (nepreverjeni citati)', () => {
  const KALKULATOR_PRAVILA: Array<{
    sifra: string
    standardReferenca: string | null
    jurisdikcija: string | null
    strukturaVsebina: string
  }> = [
    {
      sifra: 'RAZMIK-ODPRINE-110',
      standardReferenca: 'SIST EN 1264',
      jurisdikcija: null,
      strukturaVsebina: 'krogla',
    },
    {
      sifra: 'VISINA-OGRAJE-1000',
      standardReferenca: 'Pravilnik o minimalnih tehničnih zahtevah za graditev stanovanjskih stavb',
      jurisdikcija: 'SI',
      strukturaVsebina: 'preveri',
    },
    {
      sifra: 'RAZMAK-STEBROV-1500',
      standardReferenca: null,
      jurisdikcija: null,
      strukturaVsebina: 'BREZ številke',
    },
    {
      sifra: 'OBREMENITEV-HORIZONTALNA-KNM',
      standardReferenca: 'EVS EN 1991-1-1',
      jurisdikcija: null,
      strukturaVsebina: 'informativno',
    },
    {
      sifra: 'VETER-SIST-1991-1-4',
      standardReferenca: 'SIST EN 1991-1-4',
      jurisdikcija: 'SI',
      strukturaVsebina: 'poenostavljeno',
    },
  ]

  it('standardReferenca TOČNO kot citira vir (NE tiho popravljeno — §15)', async () => {
    for (const p of KALKULATOR_PRAVILA) {
      const pravilo = await db.engineeringRule.findUnique({ where: { sifra: p.sifra } })
      expect(pravilo, p.sifra).not.toBeNull()
      const verzija = await db.engineeringRuleVersion.findFirst({ where: { ruleId: pravilo!.id } })
      expect(verzija!.vir).toBe('INTERNI_INZENIRING')
      expect(verzija!.standardReferenca).toBe(p.standardReferenca)
      expect(verzija!.jurisdikcija).toBe(p.jurisdikcija)
      // NEDOSLEDNOSTI odkrito zabeležene v vsebini (dokaz honesty):
      expect(verzija!.vsebina).toContain(p.strukturaVsebina)
    }
  })

  it('calculatorVerzija NULL — checkCompliance NIMA verzije formule (odkrito)', async () => {
    for (const p of KALKULATOR_PRAVILA) {
      const pravilo = await db.engineeringRule.findUnique({ where: { sifra: p.sifra } })
      const verzija = await db.engineeringRuleVersion.findFirst({ where: { ruleId: pravilo!.id } })
      expect(verzija!.calculatorVerzija).toBeNull()
      expect(verzija!.virZapis).toContain('NIMA lastne verzije formule')
    }
  })

  it('110 mm odprina: struktura odkrito nosi tudi utemeljitev 100 mm krogla', async () => {
    const pravilo = await db.engineeringRule.findUnique({ where: { sifra: 'RAZMIK-ODPRINE-110' } })
    const verzija = await db.engineeringRuleVersion.findFirst({ where: { ruleId: pravilo!.id } })
    expect(JSON.parse(verzija!.strukturaJson!)).toEqual({ maxGapMm: 110, utemeljitevKroglaMm: 100 })
  })
})

describe('R393 — seed kategorije (EXACT porazdelitev)', () => {
  it('MONTAZA 7 · RAZMAK 1+produktni+2 · MATERIAL 1 · OBREMENITEV 2 · GEOMETRIJA 1', async () => {
    const skupine = await db.engineeringRule.groupBy({ by: ['kategorija'], _count: { _all: true } })
    const mapa = Object.fromEntries(skupine.map((g) => [g.kategorija, g._count._all]))
    expect(mapa.MONTAZA).toBe(7)
    expect(mapa.RAZMAK).toBe(1 + pricakaniProduktniRazmaki + 2)
    expect(mapa.MATERIAL).toBe(1)
    expect(mapa.OBREMENITEV).toBe(2)
    expect(mapa.GEOMETRIJA).toBe(1)
  })

  it('aplikacija NULL pri VSEH seed pravilih (splošna — §14 kontekst ni dokumentiran)', async () => {
    const sAplikacijo = await db.engineeringRule.count({ where: { NOT: { aplikacija: null } } })
    expect(sAplikacijo).toBe(0)
  })
})

/** Labela za dinamčen opis testa (pomožnik — izpeljano iz istega vira). */
function prikacaniLabel(): number {
  return pricakaniProduktniRazmaki
}
