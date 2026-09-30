// R321 — 50. člen (issue #1 IZVOZI družina): izvoz meritev zmogljivosti kot
// DETERMINISTIČNI PDF (Deliverable 6 kot tisk). PDF brat zaslona R312
// (vzorec R318 audit-pdf / R320 končna-pdf: LOČEN lib): pregled = POSREDOVANA
// resnica (meritev se izvede ENKRAT v brskalniku — R312 kontrakt; PDF NE
// meri znova); sklep VERBATIM (TRETJI potrošnik ENEGA niza — zaslon + testi
// + PDF); formatirajMs = EN VIR formatiranje (UVOŽEN iz brata — zaslon in
// PDF ne moreta divergirati po konstrukciji, vzorec AUDIT_CSV_GLAVE R317).
// Determinizem kanon 46.–49. člen: vsebina brez časa, fiksni formatni žig
// ZMOGLJIVOST_PDF_ZIG_FIKSNI, FNV fileId soli 0xc9–0xcc → isti HEAD + ista
// meritev = bajtno identičen PDF.
// Dokazni plasti (r302/r318/r320 kanon): BAJTNI dokazi (magija + determinizem
// + razlike po vhodu) + SOURCE-level EN VIR pini (uvozi, NIČ redefinicij).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildZmogljivostPdfDoc,
  generateZmogljivostPdf,
  zmogljivostPdfFilename,
  ZMOGLJIVOST_PDF_ZIG_FIKSNI,
} from '@/lib/zmogljivost-pregled-pdf'
import {
  izmeriZmogljivost,
  ZMOGLJIVOST_OPS,
  formatirajMs,
  type ZmogljivostPregled,
} from '@/lib/zmogljivost-pregled'

const lib = readFileSync(resolve(__dirname, '../zmogljivost-pregled-pdf.ts'), 'utf8')
const bratLib = readFileSync(resolve(__dirname, '../zmogljivost-pregled.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/vodja-dashboard.tsx'), 'utf8')

/** Realna meritev (istega HEAD-a — ZMOGLJIVOST_OPS na fiksnih vhodih; časi
 *  so strojno odvisni, STRUKTURA deterministična — EN VIR za bajtne dokaze). */
function zgradi(pregled: ZmogljivostPregled, now?: Date): Buffer {
  const doc = now === undefined ? buildZmogljivostPdfDoc(pregled) : buildZmogljivostPdfDoc(pregled, { now })
  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
}

/** Kraftan pregled — majhen, popolnoma kontrakt-nezdružljivosti prost
 *  (deterministični časi — bajtni razlike po vhodu NE odvisijo od ure). */
function kraftPregled(id = 'kraft.op', najmanj = 1.5, mediana = 2, najvec = 3, iteracij = 4): ZmogljivostPregled {
  return {
    meritve: [
      {
        id,
        opis: 'kraftan opis operacije',
        modul: 'src/lib/kraft.ts',
        iteracij,
        enota: 'ms',
        najmanj,
        mediana,
        najvec,
        preverjeno: true,
      },
    ],
    skupajIteracij: iteracij,
    sklep: 'kraftan sklep — EN VIR niz za zaslon + testi + PDF.',
  }
}

describe('r321 zmogljivost-pregled PDF izvoz (50. člen — IZVOZI družina)', () => {
  it('oblika: %PDF- magija + vsebina NIČ prazna + filename determinističen (brez datuma)', () => {
    const bin = zgradi(kraftPregled())
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).toBeGreaterThan(1000)
    expect(zmogljivostPdfFilename()).toBe('zmogljivost-pregled.pdf')
    expect(zmogljivostPdfFilename()).toBe(zmogljivostPdfFilename())
  })

  it('EN VIR: pregled POSREDOVAN (PDF NE meri znova — R312 kontrakt) + formatirajMs UVOŽEN iz brata + obrnjena regresija', () => {
    // builder NE kliče izmeriZmogljivost (drugi tek = drugi časi = lažna
    // dvojna resnica) — pregled je parameter
    expect(lib).toContain('pregled: ZmogljivostPregled,')
    expect(lib).not.toContain('izmeriZmogljivost(')
    // formatirajMs = EN VIR formatiranje (vzorec AUDIT_CSV_GLAVE R317).
    // 🆕 R323 (51. člen): uvoz razširjen na EN VIR izvozni kontrakt (glave +
    // validacija iz brata) — formatirajMs ostaja UVOŽEN (pin po vsebini).
    expect(lib).toMatch(/import \{[^}]*formatirajMs[^}]*\} from '\.\/zmogljivost-pregled'/)
    expect(lib).toContain('preveriZmogljivostPregledZaIzvoz')
    expect(lib).toContain('ZMOGLJIVOST_IZVOZ_GLAVE')
    expect(lib).toContain('formatirajMs(m.najmanj)')
    // NI lastne definicije formata (EN VIR ostane v bratu)
    expect(lib).not.toContain('export function formatirajMs')
    expect(lib).not.toContain('v >= 100 ? String(Math.round(v))')
    // obrnjena regresija: PDF funkcij NI v bratu (cikel in duplikat tiran —
    // r318 lekcija 1: ena definicija, EN lib)
    expect(bratLib).not.toContain('buildZmogljivostPdfDoc')
    expect(bratLib).not.toContain('zmogljivostPdfFilename')
    expect(bratLib).not.toContain('generateZmogljivostPdf')
  })

  it('sklep EN VIR: VERBATIM niz (TRETJI potrošnik — zaslon + testi + PDF) + brez volatilnega časa v libu', () => {
    expect(lib).toContain('doc.splitTextToSize(pregled.sklep, 182)')
    // determinizem: brez časovnih žigov v vsebini (lib ne nosi 'Izvoženo ob')
    expect(lib).not.toContain('Izvoženo ob')
    expect(lib).not.toContain('osveženo')
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
    // resnica seed nosi meritve (id + iteracij + časi SO del resnice)
    expect(lib).toContain('resnicaSeed(pregled)')
  })

  it('vsebina WYSIWYG po vhodu: kraftan pregled → RAZLIČEN bajtni odtis po idu, opisu IN časih (vsebina sledi vhodu)', () => {
    const a = zgradi(kraftPregled('kraft.op.a', 1.5, 2, 3))
    const b = zgradi(kraftPregled('kraft.op.b', 1.5, 2, 3))
    expect(b.equals(a)).toBe(false)
    // drugi časi → drugačen odtis (meritve SO del resnice)
    const c = zgradi(kraftPregled('kraft.op.a', 2.5, 3, 4))
    expect(c.equals(a)).toBe(false)
    // realni pregled (10 operacij) → precej večji dokument od kraftan 1
    const realni = izmeriZmogljivost()
    const realniBin = zgradi(realni)
    expect(realniBin.length).toBeGreaterThan(zgradi(kraftPregled()).length)
    expect(realni.meritve.length).toBe(ZMOGLJIVOST_OPS.length)
  })

  it('DETERMINIZEM: dva builda istega pregleda = bajtno identična; drug now = drugačen (formatni žig); fiksni privzeti žig', () => {
    const p = kraftPregled()
    expect(zgradi(p).equals(zgradi(p))).toBe(true)
    expect(zgradi(p, new Date('2026-06-01T12:00:00.000Z')).equals(zgradi(p))).toBe(false)
    expect(ZMOGLJIVOST_PDF_ZIG_FIKSNI.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(zgradi(p).equals(zgradi(p, ZMOGLJIVOST_PDF_ZIG_FIKSNI))).toBe(true)
  })

  it('formatirajMs EN VIR: ISTI izraz kot zaslon (parity z r320 zaslon kanonom) + fail-closed na ne-končni vrednosti', () => {
    // < 100 = dve decimalki; ≥ 100 = zaokroženo celo število (ISTI izraz kot
    // zaslon vrstice pred R321 — izpis bajtno nespremenjen)
    expect(formatirajMs(12.34)).toBe('12.34')
    expect(formatirajMs(99.999)).toBe('100.00')
    expect(formatirajMs(100)).toBe('100')
    expect(formatirajMs(1234.56)).toBe('1235')
    expect(formatirajMs(0.001)).toBe('0.00')
    // fail-closed: ne-končna vrednost → TypeError (izmišljena številka NE
    // sme biti izpisana)
    expect(() => formatirajMs(Number.NaN)).toThrow(/formatirajMs: pričakovana končna vrednost/)
    expect(() => formatirajMs(Number.POSITIVE_INFINITY)).toThrow(/pričakovana končna vrednost/)
  })

  it('fail-closed: pokvaren vhod → TypeError z imenom graditelja (meritev ne sme sanjati — tudi PDF ne)', () => {
    // null (NE undefined — lekcija R317 4)
    expect(() => buildZmogljivostPdfDoc(null as unknown as ZmogljivostPregled)).toThrow(
      /buildZmogljivostPdfDoc: pričakovan pregled/,
    )
    // prazne meritve — brez izvedene meritve ni izmišljenih števil
    expect(() =>
      buildZmogljivostPdfDoc({ meritve: [], skupajIteracij: 0, sklep: 'x' } as unknown as ZmogljivostPregled),
    ).toThrow(/pregled brez meritev/)
    // pokvaren now → TypeError (fail-closed formatni žig)
    expect(() => buildZmogljivostPdfDoc(kraftPregled(), { now: 'ne-date' as unknown as Date })).toThrow(
      /buildZmogljivostPdfDoc: pričakovan veljaven now: Date/,
    )
    // pokvaren options objekt
    expect(() => buildZmogljivostPdfDoc(kraftPregled(), 'ne-options' as unknown as { now?: Date })).toThrow(
      /pričakovane opcije/,
    )
    // meritev brez kontrakta: id / preverjeno !== true / notranja neskladja časov
    expect(() => zgradi(kraftPregled('', 1, 2, 3))).toThrow(/pričakovan id/)
    expect(() => zgradi(kraftPregled('kraft.op', 3, 2, 1))).toThrow(/notranja neskladja časov/)
    const nepreverjena = kraftPregled()
    const m0 = nepreverjena.meritve[0] as { preverjeno: boolean }
    ;(m0 as { preverjeno: boolean }).preverjeno = false
    expect(() => zgradi(nepreverjena)).toThrow(/meritev NI preverjena/)
    // neskladje števca resnice (skupajIteracij ≠ vsota po meritvah)
    expect(() => zgradi({ ...kraftPregled(), skupajIteracij: 999 })).toThrow(/notranja neskladja skupajIteracij/)
  })

  it('soli 0xc9–0xcc — UNIKATNE v družini (register: audit-pdf 0xc1–0xc4, končna-pdf 0xc5–0xc8 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xc9)')
    expect(lib).toContain('fnv1aHex(seed, 0xcc)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xc1)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xc5)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xb9)')
  })

  it('vodja žičenje: PDF gumb + aria + title + handler z iskreno ničelno vejo + fail-verbose toast + filename + ločen lib import', () => {
    expect(komponenta).toContain('aria-label="Izvozi meritve zmogljivosti kot PDF"')
    expect(komponenta).toContain('kot deterministični PDF')
    expect(komponenta).toContain('function exportZmogljivostPdf()')
    // iskrena ničelna veja (brez meritve NI izvoza — NIČ izmišljenih števil)
    expect(komponenta).toContain('if (!zmogljivost) {')
    expect(komponenta).toContain("'Meritve še niso izvedene'")
    expect(komponenta).toContain('generateZmogljivostPdf(zmogljivost)')
    expect(komponenta).toContain('onClick={exportZmogljivostPdf}')
    // fail-verbose kanon (R316/R317/R318/R320 vzorec) + toast z filename
    expect(komponenta).toContain("title: 'Izvoz ni uspel'")
    expect(komponenta).toContain('description: zmogljivostPdfFilename()')
    // import žičenje (vzorec R318/R320: PDF lib LOČEN — par vrstic + brat)
    expect(komponenta).toContain(
      "import { generateZmogljivostPdf, zmogljivostPdfFilename } from '@/lib/zmogljivost-pregled-pdf'",
    )
    expect(komponenta).toContain("import { formatirajMs } from '@/lib/zmogljivost-pregled'")
    // zaslon rabi formatirajMs EN VIR (×3 vrstica časa) — stari inline izraz
    // izbrisan (obrnjena regresija dvojnega formata)
    expect(komponenta).not.toContain('Math.round(m.najmanj)')
    expect(komponenta.match(/formatirajMs\(m\./g)?.length).toBe(3)
    // družinski stil: amber/50 ring + press-scale (val8/val9 registri)
    expect(komponenta).toContain('focus-visible:ring-roksal-amber/50')
  })

  it('generateZmogljivostPdf: javna API projekcija build + save (filename EN VIR)', () => {
    // javni API obstaja in je determinističen prek buildZmogljivostPdfDoc
    expect(lib).toContain('export function generateZmogljivostPdf(pregled: ZmogljivostPregled): void')
    expect(lib).toContain('const doc = buildZmogljivostPdfDoc(pregled)')
    expect(lib).toContain('doc.save(zmogljivostPdfFilename())')
  })
})
