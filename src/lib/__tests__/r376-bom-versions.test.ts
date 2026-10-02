// R376 — KANONIČNI BOM: STATUSNI STROJ + DETERMINIZEM (issue #13, korak R166
// iz §5/§6). ČISTE enote nad src/lib/bom-versions.ts — BREZ baze (isti kanon
// kot r374-quote-versions testi).
// ---------------------------------------------------------------------------
// Testi dokazujejo:
//   (1) statusni stroj: natanko DRAFT/APPROVED/SUPERSEDED; DRAFT → APPROVED
//       (odobritev) in DRAFT → SUPERSEDED (nova verzija nadomesti osnutek);
//       APPROVED/SUPERSEDED sta TERMINALNI — odobren BOM se NE spreminja
//       (sprememba = nova verzija/change order, §6);
//   (2) fail-closed matrika: neznan status → PRAZNO (nikoli "vse dovoljeno");
//   (3) determinizem: isti vhodi → BAJTNO identične vrstice (JSON.stringify
//       primerjava); generatedAt se NAMENOMO NE zapiše v vrstice (čas živi na
//       BOMVersion.createdAt — R294 F4 stena ure);
//   (4) vrstni red = lineOrder 1..N po vrstnem redu postavk ponudbe;
//   (5) sled izvora: layoutFingerprint = inputHash izvorne verzije ponudbe
//       (§5 geometrijska sledljivost), productSdkVersion = 'quote-v1';
//   (6) fail-closed generacija: pokvarjen linesJson (ni polje / manjka code /
//       nekanonska kategorija / neveljavna količina) → JAVNA napaka z imenom
//       vrstice — NIKOLI tiho preskočena postavka, nikoli izumljeno polje.
import { describe, expect, it } from 'vitest'
import {
  BOM_VERSION_STATUSES,
  BOM_VERSION_TRANSITIONS,
  allowedBomVersionTransitions,
  checkBomVersionTransition,
  isImmutableBomVersion,
  bomVersionFromQuoteVersion,
  BomGenerationError,
} from '@/lib/bom-versions'
import { QUOTE_FORMULA_VERSION } from '@/lib/quote-repro'
import type { QuoteItem } from '@/lib/quote'

/** Dve realni postavki izračunane ponudbe (strukturni vir — NE besedilo). */
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
]

/** Izvor brez inventarne vezave in brez cenika (iskrene NULL vrednosti). */
const IZHOD_BREZ_VEZAV = {
  linesJson: POSTAVKE as unknown[],
  inputHash: 'abc12345',
}

describe('R376 — statusni stroj verzij BOM (EN VIR, §6)', () => {
  it('STATUSI: natanko DRAFT/APPROVED/SUPERSEDED (drift = javna napaka)', () => {
    expect([...BOM_VERSION_STATUSES]).toEqual(['DRAFT', 'APPROVED', 'SUPERSEDED'])
  })

  it('PREHODI: DRAFT → APPROVED/SUPERSEDED; APPROVED/SUPERSEDED = TERMINALNI (prazno)', () => {
    expect([...BOM_VERSION_TRANSITIONS.DRAFT].sort()).toEqual(['APPROVED', 'SUPERSEDED'])
    // §6: odobren BOM se NE spreminja — APPROVED nima IZHODNIH prehodov
    // (sprememba je nova verzija, ne mutacija; supersede APPROVED bi bil
    // izrecen change-order, ki v R376 še ne obstaja).
    expect(BOM_VERSION_TRANSITIONS.APPROVED).toEqual([])
    expect(BOM_VERSION_TRANSITIONS.SUPERSEDED).toEqual([])
  })

  it('allowedBomVersionTransitions: NEZNAN status → PRAZNO (fail-closed, ne "vse")', () => {
    expect(allowedBomVersionTransitions('DRAFT')).toEqual(['APPROVED', 'SUPERSEDED'])
    expect(allowedBomVersionTransitions('HACKED')).toEqual([])
    expect(allowedBomVersionTransitions('')).toEqual([])
  })

  it('checkBomVersionTransition: DRAFT→APPROVED OK; APPROVED→(karkoli) odklonjen Z dovoljenimi cilji', () => {
    expect(checkBomVersionTransition('DRAFT', 'APPROVED').ok).toBe(true)
    expect(checkBomVersionTransition('DRAFT', 'SUPERSEDED').ok).toBe(true)
    // Nazaj v DRAFT ni podprt (immutable kanon):
    const nazaj = checkBomVersionTransition('DRAFT', 'DRAFT')
    expect(nazaj.ok).toBe(false)
    expect(nazaj.allowed).toEqual(['APPROVED', 'SUPERSEDED'])
    // TERMINALNO: od APPROVED ne vodi nikamor več:
    const izApproved = checkBomVersionTransition('APPROVED', 'DRAFT')
    expect(izApproved.ok).toBe(false)
    expect(izApproved.allowed).toEqual([])
    const izSuperseded = checkBomVersionTransition('SUPERSEDED', 'APPROVED')
    expect(izSuperseded.ok).toBe(false)
    expect(izSuperseded.allowed).toEqual([])
  })

  it('isImmutableBomVersion: SAMO DRAFT je mutable; APPROVED/SUPERSEDED nespremenljivi (§6)', () => {
    expect(isImmutableBomVersion('DRAFT')).toBe(false)
    expect(isImmutableBomVersion('APPROVED')).toBe(true)
    expect(isImmutableBomVersion('SUPERSEDED')).toBe(true)
    // Neznan status = nespremenljiv (fail-closed — nikoli "verjetno mutable"):
    expect(isImmutableBomVersion('CESARJEV')).toBe(true)
  })
})

describe('R376 — determinizem generacije vrstic (isti vhodi → bajtno isti izid)', () => {
  it('ISTI vhodi → JSON.stringify VRSTIC bajtno identičen (dva klica)', () => {
    const a = bomVersionFromQuoteVersion(IZHOD_BREZ_VEZAV, [], [], '2026-10-04T08:00:00Z')
    const b = bomVersionFromQuoteVersion(IZHOD_BREZ_VEZAV, [], [], '2026-10-04T08:00:00Z')
    expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines))
  })

  it('generatedAt se NE zapiše v vrstice — drugačen čas, BAJTNO iste vrstice (R294 F4)', () => {
    const a = bomVersionFromQuoteVersion(IZHOD_BREZ_VEZAV, [], [], '2026-10-04T08:00:00Z')
    const b = bomVersionFromQuoteVersion(IZHOD_BREZ_VEZAV, [], [], '2031-01-01T23:59:59Z')
    // Čas živi SAMO na nosilcu (odmev v glavi izhoda), ne na materialnih
    // vrsticah — sicer bi bil determinizem nemogoč:
    expect(a.generatedAt).not.toBe(b.generatedAt)
    expect(JSON.stringify(a.lines)).toBe(JSON.stringify(b.lines))
  })

  it('lineOrder = 1..N po VRSTNEM REDU postavk (zaporedna številka = identiteta vrstice)', () => {
    const out = bomVersionFromQuoteVersion(IZHOD_BREZ_VEZAV, [], [], '2026-10-04T08:00:00Z')
    expect(out.lines.map((l) => l.lineOrder)).toEqual([1, 2])
    expect(out.lines[0]!.internalSku).toBe('STK-1323-860')
    expect(out.lines[1]!.internalSku).toBe('SIDRA')
  })

  it('SLED IZVORA: layoutFingerprint = inputHash verzije; productSdkVersion = QUOTE_FORMULA_VERSION', () => {
    const out = bomVersionFromQuoteVersion(IZHOD_BREZ_VEZAV, [], [], '2026-10-04T08:00:00Z')
    expect(out.layoutFingerprint).toBe('abc12345')
    expect(out.productSdkVersion).toBe(QUOTE_FORMULA_VERSION)
    expect(out.productSdkVersion).toBe('quote-v1')
    // Sprememba inputHash → DRUG odtis (geometrijska sledljivost, §5):
    const out2 = bomVersionFromQuoteVersion(
      { linesJson: POSTAVKE as unknown[], inputHash: 'deadbeef' },
      [],
      [],
      '2026-10-04T08:00:00Z',
    )
    expect(out2.layoutFingerprint).toBe('deadbeef')
    expect(JSON.stringify(out.lines)).not.toBe(JSON.stringify(out2.lines))
  })
})

describe('R376 — fail-closed generacija (pokvarjen linesJson = javna napaka)', () => {
  it('linesJson NI polje → BomGenerationError (nikoli tiho prazen BOM)', () => {
    expect(() =>
      bomVersionFromQuoteVersion({ linesJson: { karkoli: true }, inputHash: 'x' }, [], [], 't'),
    ).toThrow(BomGenerationError)
  })

  it('Postavka BREZ code → javna napaka z zaporedno številko (internalSku je obvezen)', () => {
    const brez = [{ ...POSTAVKE[0]!, code: '' }, POSTAVKE[1]!] as unknown[]
    expect(() =>
      bomVersionFromQuoteVersion({ linesJson: brez, inputHash: 'x' }, [], [], 't'),
    ).toThrow(/#1.*code/)
  })

  it('NEKANONSKA kategorija → javna napaka z seznamom dovoljenih BomGroup', () => {
    const tuj = [{ ...POSTAVKE[0]!, group: 'WPC_LETVE' }, POSTAVKE[1]!] as unknown[]
    expect(() =>
      bomVersionFromQuoteVersion({ linesJson: tuj, inputHash: 'x' }, [], [], 't'),
    ).toThrow(/WPC_LETVE/)
    expect(() =>
      bomVersionFromQuoteVersion({ linesJson: tuj, inputHash: 'x' }, [], [], 't'),
    ).toThrow(/GLASS/)
  })

  it('NEVELJAVNA količina (0/negativna/NaN) → javna napaka (CHECK > 0 v DB bi sicer 500)', () => {
    for (const slaba of [0, -1, Number.NaN] as const) {
      const postavke = [{ ...POSTAVKE[0]!, qty: slaba }, POSTAVKE[1]!] as unknown[]
      expect(() =>
        bomVersionFromQuoteVersion({ linesJson: postavke, inputHash: 'x' }, [], [], 't'),
      ).toThrow(BomGenerationError)
    }
  })

  it('Postavka, ki NI objekt → javna napaka (brez tihoga preskakovanja)', () => {
    expect(() =>
      bomVersionFromQuoteVersion({ linesJson: [null, POSTAVKE[1]!] as unknown[], inputHash: 'x' }, [], [], 't'),
    ).toThrow(/#1.*ni objekt/)
  })
})
