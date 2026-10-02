// R376 — KANONIČNA GENERACIJA BOM IZ POSTAVK PONUDBE (issue #13, korak R166
// iz §5/§8). ČISTE enote nad bomVersionFromQuoteVersion — BREZ baze.
// ---------------------------------------------------------------------------
// Testi dokazujejo kanon §5 (konec tekstovne hevristike do R372):
//   (1) EXACT inventarna vezava: SAMO sifraMateriala === QuoteItem.code
//       poveže artikel; velike/male črke, presledki, podniz → NEVEZANO
//       (inventoryId NULL) — BREZ fuzzy, BREZ includes(), BREZ normalizacije;
//   (2) honest NULLs (§8): wasteFactor/grossQuantity sta VEDNO NULL (vir
//       ne obstaja — nikoli izmišljen odstotek); unitCost/totalCost NULL,
//       dokler VEZANA knjiga nima referenceCost za sourceKey postavke;
//   (3) unitCost iz VEZANE knjige PREK sourceKey (postavke brez sourceKey —
//       npr. DROBNI — so iskreno brez stroška); totalCost = unitCost × qty;
//   (4) descriptionSnapshot = `${name} — ${detail}` (zmrznjen opis);
//   (5) calculationRuleVersion = 'quote-v1' na vsaki vrstici (sled pravila);
//   (6) količina = postavkin qty IZKLJUČNO (nikoli ocena iz EUR);
//   (7) VIR MODULA ne vsebuje tekstovnih hevristik (includes('wpc'),
//       toLowerCase, Math.ceil — staticen pregled vira).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { bomVersionFromQuoteVersion, type BomInventoryBinding, type BomPriceSourceItem } from '@/lib/bom-versions'
import { QUOTE_FORMULA_VERSION } from '@/lib/quote-repro'
import type { QuoteItem } from '@/lib/quote'

// VIR modula — komentarji ODHANJENI (dokumentacija mrtvih hevristik v
// komentarjih je ŽELJENA; hevristike v KODI pa so prepovedane):
const VIR_BOM_VERSIONS = readFileSync(
  fileURLToPath(new URL('../bom-versions.ts', import.meta.url)),
  'utf-8',
)
const KODA_BOM_VERSIONS = VIR_BOM_VERSIONS
  .replace(/\/\*[\s\S]*?\*\//g, '') // blok komentarji (glava modula)
  .replace(/^\s*\/\/.*$/gm, '') // vrstični komentarji

/** Realne postavke izračunane ponudbe (4×1 m pravokotnik). */
const POSTAVKE: QuoteItem[] = [
  {
    code: 'STK-1323-860',
    group: 'GLASS',
    name: 'Varnostno steklo',
    detail: '1323×860 mm, 8+8 laminirano',
    qty: 6,
    unit: 'kos',
    unitPrice: 142.5,
    total: 855,
    sourceKey: 'glassPerM2',
  },
  {
    code: 'SIDRA',
    group: 'FIXINGS',
    name: 'Kemično sidro',
    detail: 'M8×80',
    qty: 34,
    unit: 'kos',
    unitPrice: 2.1,
    total: 71.4,
    sourceKey: 'anchorPerEach',
  },
  {
    // Izpeljana postavka BREZ sourceKey (kot DROBNI v pravih ponudbah):
    code: 'DROBNI',
    group: 'OTHER',
    name: 'Droben material',
    detail: 'odstotek materiala',
    qty: 1,
    unit: 'komplet',
    unitPrice: 250,
    total: 250,
  },
]

const VHOD = { linesJson: POSTAVKE as unknown[], inputHash: 'feedbeef' }

describe('R376 — EXACT inventarna vezava (§5: BREZ fuzzy, BREZ includes)', () => {
  it('NATANKO enako šifro poveže (sifraMateriala === code) → inventoryId/supplierId vezan', () => {
    const vezave: BomInventoryBinding[] = [
      { id: 'inv-steklo', sifraMateriala: 'STK-1323-860', supplierId: 'dob-1', supplierSku: null },
      { id: 'inv-sidra', sifraMateriala: 'SIDRA', supplierId: null, supplierSku: null },
    ]
    const out = bomVersionFromQuoteVersion(VHOD, [], vezave, 't')
    expect(out.lines[0]!.inventoryId).toBe('inv-steklo')
    expect(out.lines[0]!.supplierId).toBe('dob-1')
    expect(out.lines[1]!.inventoryId).toBe('inv-sidra')
    // DROBNI ni v inventarju → NEVEZANO (NULL):
    expect(out.lines[2]!.inventoryId).toBeNull()
    expect(out.lines[2]!.supplierId).toBeNull()
  })

  it('NEUJEMANE šifre (velike črke/presledek/podniz) → NEVEZANO — NIKOLI fuzzy', () => {
    // 'SIDRA' v ponudbi; inventar ima samo 'sidra' (male črke), ' SIDRA'
    // (presledek) in 'SID' (podniz) — VSE morajo ostati NEVEZANO:
    const vezave: BomInventoryBinding[] = [
      { id: 'inv-male', sifraMateriala: 'sidra', supplierId: null, supplierSku: null },
      { id: 'inv-presledek', sifraMateriala: ' SIDRA', supplierId: null, supplierSku: null },
      { id: 'inv-podniz', sifraMateriala: 'SID', supplierId: null, supplierSku: null },
    ]
    const out = bomVersionFromQuoteVersion(VHOD, [], vezave, 't')
    expect(out.lines[1]!.inventoryId).toBeNull()
    expect(out.lines[1]!.supplierId).toBeNull()
  })

  it('ISTI code dvakrat v ponudbi → OBE vrstici vezani na ISTI artikel (multiset 1:1)', () => {
    const postavke: QuoteItem[] = [POSTAVKE[1]!, { ...POSTAVKE[1]!, qty: 10 }]
    const vezave: BomInventoryBinding[] = [
      { id: 'inv-sidra', sifraMateriala: 'SIDRA', supplierId: null, supplierSku: null },
    ]
    const out = bomVersionFromQuoteVersion({ linesJson: postavke as unknown[], inputHash: 'x' }, [], vezave, 't')
    expect(out.lines).toHaveLength(2)
    expect(out.lines[0]!.inventoryId).toBe('inv-sidra')
    expect(out.lines[1]!.inventoryId).toBe('inv-sidra')
    // Vsaka postavka svoja vrstica s svojo količino (1:1, ne združevanje):
    expect(out.lines[0]!.quantity).toBe(34)
    expect(out.lines[1]!.quantity).toBe(10)
  })

  it('supplierSku ostaja NULL (vir v bazi ne obstaja — iskreno NEZNANO, §8)', () => {
    const vezave: BomInventoryBinding[] = [
      { id: 'inv-sidra', sifraMateriala: 'SIDRA', supplierId: 'dob-1', supplierSku: null },
    ]
    const out = bomVersionFromQuoteVersion(VHOD, [], vezave, 't')
    for (const l of out.lines) {
      // Nikoli izumljena dobaviteljska šifra:
      expect(l.supplierSku).toBeNull()
    }
  })
})

describe('R376 — honest NULLs (§8: nikoli izmišljeni odstotki/cene)', () => {
  it('wasteFactor in grossQuantity sta VEDNO NULL (vir ne obstaja — brez izumljenih %)', () => {
    const out = bomVersionFromQuoteVersion(VHOD, [], [], 't')
    for (const l of out.lines) {
      expect(l.wasteFactor).toBeNull()
      expect(l.grossQuantity).toBeNull()
    }
  })

  it('unitCost/totalCost NULL, ko knjiga nima referenceCost za sourceKey', () => {
    const knjiga: BomPriceSourceItem[] = [{ key: 'glassPerM2', referenceCost: null }]
    const out = bomVersionFromQuoteVersion(VHOD, knjiga, [], 't')
    expect(out.lines[0]!.unitCost).toBeNull()
    expect(out.lines[0]!.totalCost).toBeNull()
  })

  it('Postavka BREZ sourceKey (DROBNI) → unitCost/totalCost NULL (cena ne živi v knjigi)', () => {
    const knjiga: BomPriceSourceItem[] = [
      { key: 'glassPerM2', referenceCost: 90 },
      { key: 'anchorPerEach', referenceCost: 1.2 },
    ]
    const out = bomVersionFromQuoteVersion(VHOD, knjiga, [], 't')
    expect(out.lines[0]!.unitCost).toBe(90)
    expect(out.lines[2]!.unitCost).toBeNull()
    expect(out.lines[2]!.totalCost).toBeNull()
  })

  it('unitCost iz VEZANE knjige prek sourceKey; totalCost = unitCost × qty (2 decimalki)', () => {
    const knjiga: BomPriceSourceItem[] = [
      { key: 'glassPerM2', referenceCost: 90 },
      { key: 'anchorPerEach', referenceCost: 1.2 },
    ]
    const out = bomVersionFromQuoteVersion(VHOD, knjiga, [], 't')
    expect(out.lines[0]!.unitCost).toBe(90)
    expect(out.lines[0]!.totalCost).toBe(540) // 90 × 6
    expect(out.lines[1]!.unitCost).toBe(1.2)
    expect(out.lines[1]!.totalCost).toBe(40.8) // 1.2 × 34
  })

  it('NEZNAN sourceKey v knjigi → NULL (nikoli default oz. približek)', () => {
    const knjiga: BomPriceSourceItem[] = [{ key: 'nekDrugiKljuč', referenceCost: 5 }]
    const out = bomVersionFromQuoteVersion(VHOD, knjiga, [], 't')
    expect(out.lines[0]!.unitCost).toBeNull()
    expect(out.lines[0]!.totalCost).toBeNull()
  })
})

describe('R376 — snapshoti in sled pravila (§5 sledljivost)', () => {
  it('descriptionSnapshot = `${name} — ${detail}` (zmrznjen opis izvirne postavke)', () => {
    const out = bomVersionFromQuoteVersion(VHOD, [], [], 't')
    expect(out.lines[0]!.descriptionSnapshot).toBe('Varnostno steklo — 1323×860 mm, 8+8 laminirano')
    expect(out.lines[1]!.descriptionSnapshot).toBe('Kemično sidro — M8×80')
    expect(out.lines[2]!.descriptionSnapshot).toBe('Droben material — odstotek materiala')
  })

  it('calculationRuleVersion = QUOTE_FORMULA_VERSION na vsaki vrstici (sled izračuna)', () => {
    const out = bomVersionFromQuoteVersion(VHOD, [], [], 't')
    for (const l of out.lines) {
      expect(l.calculationRuleVersion).toBe(QUOTE_FORMULA_VERSION)
      expect(l.calculationRuleVersion).toBe('quote-v1')
    }
  })

  it('quoteLineKey = sourceKey ?? code; geometrySource nosi OBA (sourceKey + layout odtis)', () => {
    const out = bomVersionFromQuoteVersion(VHOD, [], [], 't')
    expect(out.lines[0]!.quoteLineKey).toBe('glassPerM2')
    expect(out.lines[2]!.quoteLineKey).toBe('DROBNI') // brez sourceKey → code
    expect(out.lines[0]!.geometrySource).toBe('sourceKey=glassPerM2;layout=feedbeef')
    expect(out.lines[2]!.geometrySource).toBe('sourceKey=DROBNI;layout=feedbeef')
  })

  it('internalSku = code, category = group (strukturna identiteta — NE besedilo)', () => {
    const out = bomVersionFromQuoteVersion(VHOD, [], [], 't')
    expect(out.lines[0]!.internalSku).toBe('STK-1323-860')
    expect(out.lines[0]!.category).toBe('GLASS')
    expect(out.lines[1]!.category).toBe('FIXINGS')
    expect(out.lines[2]!.category).toBe('OTHER')
    // Vrstični status = AKTIVEN (PREKINJAN je rezerviran za change-order):
    expect(out.lines[0]!.status).toBe('AKTIVEN')
  })

  it('KOLIČINA = postavkin qty dobesedno (33.6 ostane 33.6 — NE zaokrožena iz EUR)', () => {
    const postavke: QuoteItem[] = [
      { ...POSTAVKE[1]!, qty: 33.6, unit: 'm' as never },
    ]
    const out = bomVersionFromQuoteVersion({ linesJson: postavke as unknown[], inputHash: 'x' }, [], [], 't')
    expect(out.lines[0]!.quantity).toBe(33.6)
    expect(out.lines[0]!.unit).toBe('m')
  })
})

describe('R376 — VIR brez tekstovnih hevristik (staticen pregled modula)', () => {
  it('bom-versions.ts (KODA, brez komentarjev) ne vsebuje includes(...)-hevristik nad besedilom', () => {
    // (Metoda .includes nad POLJI je legitimna v checkBomVersionTransition —
    // tu preverjamo IZKLJUČNO besedilne hevristike po vzorcu R372/§5.
    // Komentarji so ODHANJENI: dokumentacija mrtvih hevristik v komentarjih
    // je željeni kanon-dokaz, hevristike v KODI pa so prepovedane.)
    expect(KODA_BOM_VERSIONS).not.toContain("includes('wpc')")
    expect(KODA_BOM_VERSIONS).not.toContain('includes("wpc")')
    expect(KODA_BOM_VERSIONS).not.toContain("includes('letv')")
    expect(KODA_BOM_VERSIONS).not.toContain("includes('steklo')")
    expect(KODA_BOM_VERSIONS).not.toContain("includes('sidr')")
    expect(KODA_BOM_VERSIONS).not.toContain('includes(text')
    expect(KODA_BOM_VERSIONS).not.toContain('includes(opis')
    expect(KODA_BOM_VERSIONS).not.toContain('includes(name')
    // Preslikava je EXACT prek Map.get — ne iskanje po podnizu:
    expect(KODA_BOM_VERSIONS).not.toContain('indexOf(')
    expect(KODA_BOM_VERSIONS).not.toContain('startsWith(')
  })

  it('bom-versions.ts (KODA) ne vsebuje normalizacije velikih črk', () => {
    expect(KODA_BOM_VERSIONS).not.toContain('toLowerCase(')
    expect(KODA_BOM_VERSIONS).not.toContain('toUpperCase(')
    expect(KODA_BOM_VERSIONS).not.toContain('localeCompare(')
  })

  it('bom-versions.ts (KODA) ne vsebuje Math.ceil (količina NIKOLI iz EUR — §5)', () => {
    expect(KODA_BOM_VERSIONS).not.toContain('Math.ceil(')
    // Ocena količine iz zneska, normalizirana na EUR (hevristika R372):
    expect(KODA_BOM_VERSIONS).not.toContain('/ 50')
    expect(KODA_BOM_VERSIONS).not.toContain('/50')
  })
})
