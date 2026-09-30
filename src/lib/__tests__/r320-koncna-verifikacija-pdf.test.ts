// R320 — 49. člen (issue #1 IZVOZI družina): izvoz poročila končne
// verifikacije kot DETERMINISTIČNI PDF. PDF brat JSON-ja (46. člen, vzorec
// R318 audit-pdf: LOČEN lib — jsPDF teža NE obremenjuje brata): EN VIR —
// koncnaVerifikacija validacija + sklep + kriteriji vse UVOŽENI (PDF in JSON
// NE moreta divergirati po konstrukciji). Determinizem kanon 46./47./48.
// člen: vsebina brez časa, fiksni formatni žig CreationDate, FNV fileId soli
// 0xc5–0xc8 → isti HEAD = bajtno identičen PDF.
// Dokazni plasti (r302/r318 kanon): BAJTNI dokazi (magija + determinizem +
// razlike po vhodu) + SOURCE-level EN VIR pini (uvozi, NIČ redefinicij).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildKoncnaVerifikacijaPdfDoc,
  koncnaVerifikacijaPdfFilename,
  KONCNA_PDF_ZIG_FIKSNI,
} from '@/lib/koncna-verifikacija-pdf'
import { koncnaVerifikacija, DOKAZI_AUDITA, SPREJEMNI_KRITERIJI, type DokazVezava, type SprejemniKriterij } from '@/lib/koncna-verifikacija'
import { AVTOMATIZACIJA_AUDIT } from '@/lib/avtomatizacija-audit'

function zgradi(
  audit: readonly typeof AVTOMATIZACIJA_AUDIT[number][] = AVTOMATIZACIJA_AUDIT,
  now?: Date,
  dokazi: Readonly<Record<string, DokazVezava>> = DOKAZI_AUDITA,
  kriteriji: readonly SprejemniKriterij[] = SPREJEMNI_KRITERIJI,
): Buffer {
  const doc =
    now === undefined
      ? buildKoncnaVerifikacijaPdfDoc(audit, undefined, dokazi, kriteriji)
      : buildKoncnaVerifikacijaPdfDoc(audit, { now }, dokazi, kriteriji)
  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
}

const lib = readFileSync(resolve(__dirname, '../koncna-verifikacija-pdf.ts'), 'utf8')
const bratLib = readFileSync(resolve(__dirname, '../koncna-verifikacija.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/vodja-dashboard.tsx'), 'utf8')

/** Kraftan mini audit — brez DOKAZI_AUDITA vezav za nova območja (kraftan
 *  dokazi objekt; sprejemni kriteriji ostanejo EN VIR). */
function kraftDokazi(obmocija: readonly string[]): Record<string, DokazVezava> {
  const dokazi: Record<string, DokazVezava> = {}
  for (const o of obmocija) {
    dokazi[o] = {
      plasti: ['vitest'],
      opomba: `kraftan dokaz za ${o}`,
    }
  }
  return dokazi
}

describe('r319 koncna-verifikacija PDF izvoz (49. člen — IZVOZI družina)', () => {
  it('oblika: %PDF- magija + vsebina NIČ prazna + filename determinističen (brez datuma)', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).toBeGreaterThan(1000)
    expect(koncnaVerifikacijaPdfFilename()).toBe('koncna-verifikacija.pdf')
    expect(koncnaVerifikacijaPdfFilename()).toBe(koncnaVerifikacijaPdfFilename())
  })

  it('EN VIR: resnica UVOŽENA iz brata (koncnaVerifikacija) — NIČ redefinicij (vzorec R318)', () => {
    expect(lib).toContain("koncnaVerifikacija,\n  DOKAZI_AUDITA,\n  SPREJEMNI_KRITERIJI,")
    expect(lib).toContain('const kv = koncnaVerifikacija(audit, dokazi, kriteriji)')
    // NI lastnega dvojnega sklepa (EN VIR ostane v bratu R315)
    expect(lib).not.toContain("'Končna verifikacija: '")
    expect(lib).not.toContain('export const DOKAZI_AUDITA')
    expect(lib).not.toContain('export const SPREJEMNI_KRITERIJI')
    // obrnjena regresija: PDF funkcij NI v bratu (cikel in duplikat tiran —
    // r318 lekcija 1: ena definicija, EN lib)
    expect(bratLib).not.toContain('buildKoncnaVerifikacijaPdfDoc')
    expect(bratLib).not.toContain('koncnaVerifikacijaPdfFilename')
  })

  it('vsebina WYSIWYG po vhodu: kraftan audit → RAZLIČEN bajtni odtis (plasti pipe-joined, kriteriji verbatim iz EN VIR)', () => {
    const privzeti = zgradi()
    // kraftan audit (1 območje) + kraftan dokazi (krafta vezava vitest) →
    // drugačen odtis (vsebina sledi vhodu — NIČ statičnega besedila)
    const k = zgradi(kraftAudit(), undefined, kraftDokazi(['§X Kraft']))
    expect(k.equals(privzeti)).toBe(false)
    // kraftan kriterij (1) → drugačen odtis (tabela kriterijev sledi vhodu)
    const k2 = zgradi(AVTOMATIZACIJA_AUDIT, undefined, DOKAZI_AUDITA, kraftKriteriji())
    expect(k2.equals(privzeti)).toBe(false)
    // source pin: plasti pipe-join izraz + kriteriji map verbatim
    expect(lib).toContain('vrstice[i].plasti.join')
    expect(lib).toContain('kv.kriteriji.map((k) => [k.kriterij, k.izpeljava, k.dokaz])')
  })

  it('sklep EN VIR: UVOŽEN niz (PETI potrošnik — zaslon + JSON meta + testi + docs + PDF) + brez volatilnega časa v libu', () => {
    expect(lib).toContain('doc.splitTextToSize(kv.sklep, 182)')
    // determinizem: brez časovnih žigov v vsebini (lib ne nosi 'Izvoženo ob')
    expect(lib).not.toContain('Izvoženo ob')
    expect(lib).not.toContain('osveženo')
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
  })

  it('DETERMINIZEM: dva builda = bajtno identična datoteka; drug now = drugačen (formatni žig); fiksni privzeti žig', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    expect(zgradi(AVTOMATIZACIJA_AUDIT, new Date('2026-06-01T12:00:00.000Z')).equals(zgradi())).toBe(false)
    expect(KONCNA_PDF_ZIG_FIKSNI.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(zgradi().equals(zgradi(AVTOMATIZACIJA_AUDIT, KONCNA_PDF_ZIG_FIKSNI))).toBe(true)
  })

  it('KPI izračunani (NIČ trdo kodiranih): številke prihajajo iz kv + iskren AI alarm ničelna veja', () => {
    expect(lib).toContain('String(kv.stObmocij)')
    expect(lib).toContain('String(kv.stObmocijZDokazi)')
    expect(lib).toContain('String(kv.stKriterijev)')
    expect(lib).toContain('String(kv.stAiObveznih)')
    // iskren alarm: AI-OBVEZNO > 0 → rdeč, sicer navy (ničelna veja)
    expect(lib).toContain('kv.stAiObveznih > 0 ? RED : NAVY')
  })

  it('fail-closed: pokvaren vhod → TypeError z imenom graditelja (verifikacija ne sme sanjati — tudi PDF ne)', () => {
    // null (NE undefined — ta bi sprožil privzeti argument EN VIR — lekcija R317 4)
    expect(() => buildKoncnaVerifikacijaPdfDoc(null as unknown as typeof AVTOMATIZACIJA_AUDIT)).toThrow(
      /buildKoncnaVerifikacijaPdfDoc: pričakovan audit/,
    )
    // prazen audit propagira iz EN VIR brata (validacija brezplačno)
    expect(() => buildKoncnaVerifikacijaPdfDoc([])).toThrow(/audit brez vrstic/)
    // pokvaren now → TypeError z imenom graditelja (fail-closed formatni žig)
    expect(() =>
      buildKoncnaVerifikacijaPdfDoc(AVTOMATIZACIJA_AUDIT, { now: 'ne-date' as unknown as Date }),
    ).toThrow(/buildKoncnaVerifikacijaPdfDoc: pričakovan veljaven now: Date/)
    // pokvaren options objekt
    expect(() =>
      buildKoncnaVerifikacijaPdfDoc(AVTOMATIZACIJA_AUDIT, 'ne-options' as unknown as { now?: Date }),
    ).toThrow(/pričakovane opcije/)
  })

  it('soli 0xc5–0xc8 — UNIKATNE v družini (register: audit-pdf 0xc1–0xc4, 0xb0–0xc0 prej — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xc5)')
    expect(lib).toContain('fnv1aHex(seed, 0xc8)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xc1)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xb9)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x7d)')
  })

  it('vodja žičenje: PDF gumb + aria + title + handler + fail-verbose toast + filename klic + ločen lib import', () => {
    expect(komponenta).toContain('aria-label="Izvozi poročilo končne verifikacije kot PDF"')
    expect(komponenta).toContain('kot deterministični PDF')
    expect(komponenta).toContain('function exportKoncnaVerifikacijaPdf()')
    expect(komponenta).toContain('generateKoncnaVerifikacijaPdf()')
    expect(komponenta).toContain('onClick={exportKoncnaVerifikacijaPdf}')
    // fail-verbose kanon (R316/R317/R318 vzorec) + toast z filename
    expect(komponenta).toContain("title: 'Izvoz ni uspel'")
    expect(komponenta).toContain('description: koncnaVerifikacijaPdfFilename()')
    // import žičenje (vzorec R318: PDF lib LOČEN — JSON brat import ostane)
    expect(komponenta).toContain(
      "import { generateKoncnaVerifikacijaPdf, koncnaVerifikacijaPdfFilename } from '@/lib/koncna-verifikacija-pdf'",
    )
    // JSON brat import dvojni ostane (r316 pin — nespremenjen)
    expect(komponenta).toContain(
      "import { koncnaVerifikacija, koncnaVerifikacijaJson } from '@/lib/koncna-verifikacija'",
    )
  })
})

// ---------- kraftan pomožniki (validni vhodi za bajtno-razlike) ----------
function kraftAudit(): typeof AVTOMATIZACIJA_AUDIT {
  return [
    {
      obmocje: '§X Kraft',
      razred: 'DETERMINISTICNO',
      implementacija: ['src/lib/x.ts'],
      dokaz: ['src/lib/__tests__/x.test.ts'],
      opomba: 'kraftan opomba',
    },
  ]
}
function kraftKriteriji(): typeof SPREJEMNI_KRITERIJI {
  return [
    {
      kriterij: 'kraftan kriterij',
      izpeljava: 'kraftan izpeljava',
      dokaz: 'src/lib/x.ts',
    },
  ]
}
