// R318 — 48. člen (issue #1 IZVOZI družina): izvoz avtomatizacijskega audita
// kot DETERMINISTIČNI PDF. PDF brat CSV-ja (47. člen, vzorec R302 konflikti):
// EN VIR — pregled validacija + AUDIT_CSV_GLAVE + AUDIT_VIR_NIZ + sklep vse
// UVOŽENI (PDF in CSV NE moreta divergirati po konstrukciji). Determinizem
// kanon 46./47. člen: vsebina brez časa, fiksni formatni žig CreationDate,
// FNV fileId soli 0xc1–0xc4 → isti HEAD = bajtno identičen PDF.
// Dokazni plasti (r302 kanon): BAJTNI dokazi (magija + determinizem + razlike
// po vhodu) + SOURCE-level EN VIR pini (uvozi, NIČ redefinicij) — binarno
// iskanje besedila ni kanon (glifni razred podnabora — R249 doktrina).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildAvtomatizacijaAuditPdfDoc,
  avtomatizacijaAuditPdfFilename,
  AUDIT_PDF_ZIG_FIKSNI,
} from '@/lib/avtomatizacija-audit-pdf'
import {
  avtomatizacijaPregled,
  AUDIT_CSV_GLAVE,
  AUDIT_VIR_NIZ,
} from '@/lib/avtomatizacija-pregled'
import { AVTOMATIZACIJA_AUDIT } from '@/lib/avtomatizacija-audit'

function zgradi(
  audit: readonly typeof AVTOMATIZACIJA_AUDIT[number][] = AVTOMATIZACIJA_AUDIT,
  now?: Date,
): Buffer {
  const doc =
    now === undefined
      ? buildAvtomatizacijaAuditPdfDoc(audit)
      : buildAvtomatizacijaAuditPdfDoc(audit, { now })
  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
}

const lib = readFileSync(resolve(__dirname, '../avtomatizacija-audit-pdf.ts'), 'utf8')
const pregledLib = readFileSync(resolve(__dirname, '../avtomatizacija-pregled.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/vodja-dashboard.tsx'), 'utf8')

/** Kraftan mini audit (validen — za različne bajtne odtise po vhodu). */
function kraft(razred: 'DETERMINISTICNO' | 'AI_ZAHTEVANO'): typeof AVTOMATIZACIJA_AUDIT {
  return [
    {
      obmocje: '§X Test',
      razred,
      implementacija: ['src/lib/x.ts', 'src/lib/y.ts'],
      dokaz: ['src/lib/__tests__/x.test.ts'],
      opomba: 'iskrena opomba (kraftan vhod)',
    },
    {
      obmocje: '§Y Test 2',
      razred: 'DETERMINISTICNO',
      implementacija: ['src/lib/z.ts'],
      dokaz: ['src/lib/__tests__/z.test.ts'],
      opomba: 'druga iskrena opomba',
    },
  ]
}

describe('r318 avtomatizacija-audit PDF izvoz (48. člen — IZVOZI družina)', () => {
  it('oblika: %PDF- magija + vsebina NIČ prazna + filename determinističen (brez datuma)', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).toBeGreaterThan(1000)
    expect(avtomatizacijaAuditPdfFilename()).toBe('avtomatizacija-audit.pdf')
    expect(avtomatizacijaAuditPdfFilename()).toBe(avtomatizacijaAuditPdfFilename())
  })

  it('glave EN VIR: PDF stolpci = AUDIT_CSV_GLAVE UVOŽENA iz CSV brata (NIČ redefinicije — PDF in CSV ne moreta divergirati, vzorec R302)', () => {
    expect(lib).toContain("from './avtomatizacija-pregled'")
    expect(lib).toContain('AUDIT_CSV_GLAVE,\n  AUDIT_VIR_NIZ,')
    expect(lib).toContain('head: [[...AUDIT_CSV_GLAVE]]')
    // NI lastne redefinicije glav (EN VIR ostane v pregled modulu)
    expect(lib).not.toContain("export const AUDIT_CSV_GLAVE")
    expect(pregledLib).toContain("export const AUDIT_CSV_GLAVE")
  })

  it('vsebina WYSIWYG po vhodu: kraftan audit → RAZLIČEN bajtni odtis; razred prikazno gre prek pregleda (pipe-join kot CSV brat)', () => {
    const privzeti = zgradi()
    const k1 = zgradi(kraft('AI_ZAHTEVANO'))
    const k2 = zgradi(kraft('DETERMINISTICNO'))
    // različen vhod (razred prikazno: AI-OBVEZNO vs DETERMINISTIČNO) →
    // različen bajtni odtis (vsebina sledi vhodu — NIČ statičnega besedila)
    expect(k1.equals(privzeti)).toBe(false)
    expect(k1.equals(k2)).toBe(false)
    // source pin: vrstice telesa zgrajene z ISTIM pipe-join izrazom kot CSV brat
    expect(lib).toContain("v.implementacija.join(' | ')")
    expect(lib).toContain("v.dokaz.join(' | ')")
    // razred prikazno = pregled.vrstice[i].razredPrikazno (EN VIR — NIČ lokalne preslikave)
    expect(lib).toContain('vrstice[i].razredPrikazno')
    expect(lib).not.toContain("RAZRED_PRIKAZNO[")
  })

  it('sklep + vir EN VIR: UVOŽENA resnica (nič dvojnega sklepa) + brez volatilnega časa v libu (determinizem kanon)', () => {
    // sklep iz pregleda (ISTI niz kot zaslon + CSV meta + testi)
    expect(lib).toContain('doc.splitTextToSize(pregled.sklep, 182)')
    expect(lib).toContain('Vir: ${AUDIT_VIR_NIZ}')
    // NI lastnega dvojnega sklepa (EN VIR ostane v pregled graditelju)
    expect(lib).not.toContain("'Audit območij: '")
    // vir niz EN VIR — ENA definicija (pregled modul), PDF uvaža
    expect(lib).not.toContain("AVTOMATIZACIJA_AUDIT — isti HEAD")
    expect(pregledLib).toContain("export const AUDIT_VIR_NIZ")
    // determinizem: brez 'Izvoženo ob' / 'osveženo' / toISOString v vsebini
    // (toISOString je SAMO v fileId seed — formatni žig, ne vsebina)
    expect(lib).not.toContain('Izvoženo ob')
    expect(lib).not.toContain('osveženo')
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
  })

  it('DETERMINIZEM: dva builda = bajtno identična datoteka; drug now = drugačen (formatni žig); fiksni privzeti žig', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    expect(zgradi(AVTOMATIZACIJA_AUDIT, new Date('2026-06-01T12:00:00.000Z')).equals(zgradi())).toBe(false)
    // privzeti options.now = AUDIT_PDF_ZIG_FIKSNI (produkcija kliče brez argumenta)
    expect(AUDIT_PDF_ZIG_FIKSNI.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(zgradi().equals(zgradi(AVTOMATIZACIJA_AUDIT, AUDIT_PDF_ZIG_FIKSNI))).toBe(true)
  })

  it('KPI izračunani (NIČ trdo kodiranih): številke prihajajo iz pregled.poRazredu (source pin + pošten sklep ničelna veja)', () => {
    // source pin: vsi trije KPI številki iz EN VIR števcev (NIČ literálov)
    expect(lib).toContain('String(pregled.stObmocij)')
    expect(lib).toContain('String(pregled.poRazredu.DETERMINISTICNO)')
    expect(lib).toContain('String(pregled.poRazredu.AI_OPCIJSKO)')
    expect(lib).toContain('String(pregled.poRazredu.AI_ZAHTEVANO)')
    // iskren alarm: AI-OBVEZNO > 0 → rdeč, sicer navy (ničelna veja)
    expect(lib).toContain('pregled.poRazredu.AI_ZAHTEVANO > 0 ? RED : NAVY')
    // kraftan audit z AI_ZAHTEVANO → pregled sklep NIČELNA veja NI več trditev
    // (poštenost — test prek javnega pregleda, r314 kanon)
    expect(avtomatizacijaPregled(kraft('AI_ZAHTEVANO')).sklep).toContain(
      'vsako AI-obvezno območje zahteva izrecno utemeljitev',
    )
  })

  it('fail-closed: pokvaren vhod → TypeError z imenom graditelja (tabela ne sme sanjati — tudi PDF ne)', () => {
    // null (NE undefined — ta bi sprožil privzeti argument EN VIR — lekcija R317 4)
    expect(() => buildAvtomatizacijaAuditPdfDoc(null as unknown as typeof AVTOMATIZACIJA_AUDIT)).toThrow(
      /buildAvtomatizacijaAuditPdfDoc: pričakovan audit/,
    )
    // prazen audit propagira iz EN VIR pregleda (validacija brezplačno)
    expect(() => buildAvtomatizacijaAuditPdfDoc([])).toThrow(/audit brez vrstic/)
    const brezPoti = [{ ...AVTOMATIZACIJA_AUDIT[0], implementacija: [] }] as typeof AVTOMATIZACIJA_AUDIT
    expect(() => buildAvtomatizacijaAuditPdfDoc(brezPoti)).toThrow(/brez implementacijskih poti/)
    // pokvaren now → TypeError z imenom graditelja (fail-closed formatni žig)
    expect(() =>
      buildAvtomatizacijaAuditPdfDoc(AVTOMATIZACIJA_AUDIT, { now: 'ne-date' as unknown as Date }),
    ).toThrow(/buildAvtomatizacijaAuditPdfDoc: pričakovan veljaven now: Date/)
    // pokvaren options objekt
    expect(() =>
      buildAvtomatizacijaAuditPdfDoc(AVTOMATIZACIJA_AUDIT, 'ne-options' as unknown as { now?: Date }),
    ).toThrow(/pričakovane opcije/)
  })

  it('soli 0xc1–0xc4 — UNIKATNE v družini (register: konflikti 0xb9–0xbc, 0xb0–0xc0 zasedeni — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xc1)')
    expect(lib).toContain('fnv1aHex(seed, 0xc4)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xb9)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xb5)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x7d)')
  })

  it('vodja žičenje: PDF gumb + aria + title + handler + fail-verbose toast + filename klic + štirijni import', () => {
    expect(komponenta).toContain('aria-label="Izvozi avtomatizacijski audit kot PDF"')
    expect(komponenta).toContain('kot deterministični PDF')
    expect(komponenta).toContain('function exportAvtomatizacijaAuditPdf()')
    expect(komponenta).toContain('generateAvtomatizacijaAuditPdf()')
    expect(komponenta).toContain('onClick={exportAvtomatizacijaAuditPdf}')
    // fail-verbose kanon (R316/R317 vzorec) + toast z filename
    expect(komponenta).toContain("title: 'Izvoz ni uspel'")
    expect(komponenta).toContain('description: avtomatizacijaAuditPdfFilename()')
    // import žičenje (družinski vzorec R302: PDF lib LOČEN od pregleda):
    //  • pregled trojni import ostane (r314 pin — nespremenjen)
    //  • NOVA PDF import vrstica (pair: generator + filename)
    expect(komponenta).toContain(
      "import { avtomatizacijaPregled, avtomatizacijaAuditCsv, avtomatizacijaAuditCsvFilename } from '@/lib/avtomatizacija-pregled'",
    )
    expect(komponenta).toContain(
      "import { generateAvtomatizacijaAuditPdf, avtomatizacijaAuditPdfFilename } from '@/lib/avtomatizacija-audit-pdf'",
    )
    // obrnjena regresija: PDF funkcij NI v pregled libu (ciklu in duplikatu
    // tiran — ena definicija, EN lib)
    expect(pregledLib).not.toContain('avtomatizacijaAuditPdf')
  })
})
