// R236 (P1-c 'izvozi' družina — PDF dimenzija, 3. člen) — DOBAVITELJI PDF:
// lib dobavitelji-pdf (zaloga-pdf R234 / naročilnica-pdf R235 vzorec — ROKSAL
// glava, KPI, autoTable, noge, bajtni determinizem z client-safe FNV-1a,
// LASTNI soli 0x21–0x24) + PDF pill v zavihku Dobavitelji v
// material-intelligence-tab.
//
// ENA RESNICA: stolpci tabele = TOČNO ISTI prerez kot CSV R233 (Naziv, Status,
// Kontakt, Telefon, Email, Dobavni rok (dni), Popust (%), Št. cen, Št.
// naročil); Status = ISTA resnica kot pika R144; manjkajoči _count = PRAZNI
// celici (NIKOLI izmišljen 0 — CSV R233/R227 strogost); KPI RAČUNANI iz
// obveznih polj (cen/naročil NISO KPI — manjkajoči bi lažno učinkoval kot 0).
//
// Tehnika dokazov (r234/r235 vzorec): bajtni dokazi na bufferju (%PDF magija,
// %%EOF, determinizem); vsebinski dokazi na VIRU liba/komponente (PDF content
// stream je fontno kodiran — izvleka teksta iz bajtov NI resnična).
//
// + [Mandatory] stil (P1-f): focus-visible prstan revizija — 4 odstopanja od
//   app glavnega fokusa (roksal-navy/40) → ENA fokusrna družina; NAMERNE
//   izjeme: white/60 na temnih canvas/površinah (sketch/top-bar/floor-plan/
//   photo — visokokontrastna funkcija na temnem ozadju) ostanejo.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildDobaviteljiPdfDoc,
  dobaviteljBeseda,
  dobaviteljiPdfFilename,
  preveriDobaviteljPdfVnos,
  type DobaviteljPdfVnos,
} from '@/lib/dobavitelji-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const komponenta = beri('src/components/roksal/material-intelligence-tab.tsx')
const racuni = beri('src/components/roksal/invoice-manager.tsx')
const lib = beri('src/lib/dobavitelji-pdf.ts')
const csvLib = beri('src/lib/csv-export.ts')

const ZDANJ: Date = new Date(2026, 8, 28, 10, 0, 0) // fiksen vhod — determinizem

const DOBAVITELJI: DobaviteljPdfVnos[] = [
  {
    naziv: 'Inox Trade d.o.o.',
    aktivna: true,
    kontakt: 'Maja Novak',
    telefon: '041 234 567',
    email: 'maja@inoxtrade.si',
    dobavniRok: 7,
    popust: 5,
    _count: { materialPrices: 3, orders: 1 },
  },
  {
    naziv: 'ŠČŽ Žaga d.o.o.',
    aktivna: false,
    kontakt: null,
    telefon: null,
    email: null,
    dobavniRok: 14,
    popust: 0,
    _count: { materialPrices: 0, orders: 0 },
  },
  {
    naziv: 'Brez števca d.o.o.',
    aktivna: true,
    dobavniRok: 10,
    popust: 2.5,
    // _count manjka (starejši hint, sekanc med deployema) → PRAZNI celici.
  },
]

function pdfBajti(
  seznam: readonly DobaviteljPdfVnos[],
  options?: Partial<{ now: Date }>,
): Buffer {
  const doc = buildDobaviteljiPdfDoc(seznam, { now: ZDANJ, ...options })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R236 — dobavitelji-pdf: pravi artefakt + determinizem (R121/R234/R235 vzorec)', () => {
  it('izhod je veljaven PDF (%PDF magični bajti + %%EOF)', () => {
    const b = pdfBajti(DOBAVITELJI)
    expect(b.length).toBeGreaterThan(1000)
    expect(b.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(b.subarray(-6).toString('ascii').trim()).toBe('%%EOF')
  })

  it('DETERMINIZEM: enak vhod = bajtno enak PDF (setCreationDate + FNV-1a, NIČ crypto uvoza)', () => {
    const a = pdfBajti(DOBAVITELJI)
    const b = pdfBajti(DOBAVITELJI)
    expect(a.equals(b)).toBe(true)
    expect(lib).not.toContain("from 'node:crypto'")
    expect(lib).not.toContain('Math.random')
  })

  it('različen `now` → različen PDF (žig je del identitete dokumenta)', () => {
    const a = pdfBajti(DOBAVITELJI)
    const b = pdfBajti(DOBAVITELJI, { now: new Date(ZDANJ.getTime() + 60_000) })
    expect(a.equals(b)).toBe(false)
  })

  it('različen vnos → različen PDF (vsebina je del file-ID semena)', () => {
    const a = pdfBajti(DOBAVITELJI)
    const drugi = pdfBajti([...DOBAVITELJI, { naziv: 'Nova X', aktivna: true, dobavniRok: 5, popust: 0 }])
    expect(a.equals(drugi)).toBe(false)
  })

  it('file-ID soli so LASTNE družini (0x21–0x24 — ista semena v bratih NE smejo dati isti ID)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x21)')
    expect(lib).toContain('fnv1aHex(seed, 0x24)')
  })
})

describe('R236 — dobavitelji-pdf: fail-closed pogodba (družina R232–R235)', () => {
  it('PRAZEN seznam → TypeError (ni prazne datoteke — komponenta pokaže iskren toast)', () => {
    expect(() => buildDobaviteljiPdfDoc([], { now: ZDANJ })).toThrowError(
      /prazen seznam ne nastaja dokumenta/,
    )
  })

  it('pokvaren vnos → TypeError z indeksom krivca (naziv/aktivna/dobavniRok/popust)', () => {
    expect(() =>
      preveriDobaviteljPdfVnos({ naziv: '  ', aktivna: true, dobavniRok: 5, popust: 0 }, 2),
    ).toThrowError(/preveriDobaviteljPdfVnos \(2\): naziv/)
    expect(() =>
      preveriDobaviteljPdfVnos({ naziv: 'X', aktivna: 'da' as unknown as boolean, dobavniRok: 5, popust: 0 }, 0),
    ).toThrowError(/aktivna mora biti boolean/)
    expect(() =>
      preveriDobaviteljPdfVnos({ naziv: 'X', aktivna: true, dobavniRok: -1, popust: 0 }, 0),
    ).toThrowError(/dobavniRok mora biti ne-negativno/)
    expect(() =>
      preveriDobaviteljPdfVnos({ naziv: 'X', aktivna: true, dobavniRok: 5, popust: Number.NaN }, 0),
    ).toThrowError(/popust mora biti ne-negativno/)
    expect(() =>
      buildDobaviteljiPdfDoc(
        [{ naziv: 'OK', aktivna: true, dobavniRok: 5, popust: 0 }, { naziv: '', aktivna: true, dobavniRok: 5, popust: 0 }],
        { now: ZDANJ },
      ),
    ).toThrowError(TypeError)
  })

  it('opcijski kontakt/telefon/email = string|null|undefined; številka → TypeError', () => {
    expect(() =>
      preveriDobaviteljPdfVnos({ naziv: 'X', aktivna: true, dobavniRok: 5, popust: 0, telefon: 42 as unknown as string }, 1),
    ).toThrowError(/telefon mora biti niz, null ali manjkajoč/)
  })

  it('neveljaven now → TypeError (determinizem pogodba — filename IN dokument)', () => {
    expect(() => buildDobaviteljiPdfDoc(DOBAVITELJI, { now: new Date(NaN) })).toThrowError(TypeError)
    expect(() => dobaviteljiPdfFilename(new Date(NaN))).toThrowError(TypeError)
  })

  it('dobaviteljiPdfFilename: dobavitelji-{ISTI dan kot CSV stamp}.pdf (brother of Dobavitelji-…csv)', () => {
    expect(dobaviteljiPdfFilename(ZDANJ)).toBe('dobavitelji-2026-09-28.pdf')
    expect(csvLib).toContain("todayStamp")
  })

  it('dobaviteljBeseda: sklanjatev vzorec zalogaPovzetekBeseda (1/2/3-4/5+ + fail-closed)', () => {
    expect(dobaviteljBeseda(0)).toBe('dobaviteljev')
    expect(dobaviteljBeseda(1)).toBe('dobavitelj')
    expect(dobaviteljBeseda(2)).toBe('dobavitelja')
    expect(dobaviteljBeseda(3)).toBe('dobavitelji')
    expect(dobaviteljBeseda(4)).toBe('dobavitelji')
    expect(dobaviteljBeseda(8)).toBe('dobaviteljev')
    expect(() => dobaviteljBeseda(-1)).toThrowError(TypeError)
    expect(() => dobaviteljBeseda(1.5)).toThrowError(TypeError)
  })
})

describe('R236 — ENA resnica: PDF tabela = ISTI prerez kot CSV R233 (WYSIWYG)', () => {
  it('tabela: glava NAZIVNOSTNO enaka CSV R233 (9 stolpcev, ISTI vrstni red)', () => {
    expect(lib).toContain(
      "head: [['Naziv', 'Status', 'Kontakt', 'Telefon', 'Email', 'Dobavni rok (dni)', 'Popust (%)', 'Št. cen', 'Št. naročil']]",
    )
    // CSV R233 nosi ISTI prerez (komponenta — vir resnice za izvozni družini).
    expect(komponenta).toContain(
      "['Naziv', 'Status', 'Kontakt', 'Telefon', 'Email', 'Dobavni rok (dni)', 'Popust (%)', 'Št. cen', 'Št. naročil']",
    )
  })

  it('Status = ISTA resnica kot pika R144 (aktivna → Aktiven / sicer Neaktiven)', () => {
    expect(lib).toContain("s.aktivna ? 'Aktiven' : 'Neaktiven'")
  })

  it('manjkajoči _count → PRAZNI celici (NIKOLI izmišljen 0 — CSV R233/R227 strogost)', () => {
    expect(lib).toContain(
      "s._count?.materialPrices !== undefined ? String(s._count.materialPrices) : ''",
    )
    expect(lib).toContain("s._count?.orders !== undefined ? String(s._count.orders) : ''")
    expect(lib).not.toContain('_count?.materialPrices ?? 0')
    expect(lib).not.toContain('_count?.orders ?? 0')
  })

  it('kontakt/telefon/email manjkajo → PRAZNA celica (celica() helper, trim LE na nizu)', () => {
    expect(lib).toContain('function celica(v: string | null | undefined): string')
    expect(lib).toContain('celica(s.kontakt)')
    expect(lib).toContain('celica(s.telefon)')
    expect(lib).toContain('celica(s.email)')
  })

  it('števci String (celo števila so celo števila — CSV R233 lekcija), popust ostane brez formatiranja', () => {
    expect(lib).toContain('String(s.dobavniRok)')
    expect(lib).toContain('String(s.popust)')
    expect(lib).not.toContain('.toFixed')
  })

  it('KPI računana IZ obveznih polj (skupaj/aktivni/neaktivni) — cen/naročil NISO KPI (manjkajoči bi lažno učinkoval kot 0)', () => {
    expect(lib).toContain('const aktivnih = dobavitelji.filter((s) => s.aktivna).length')
    expect(lib).toContain('const neaktivnih = dobavitelji.length - aktivnih')
    expect(lib).toContain("kpiBox(doc, 14, y, bw, bh, 'Dobavitelji', String(dobavitelji.length), NAVY)")
    expect(lib).toContain("kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Aktivni', String(aktivnih)")
    expect(lib).toContain("kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Neaktivni', String(neaktivnih), NAVY)")
  })

  it('sklepna vrstica: ISTA sklanjatev (dobaviteljBeseda) + ISTI žig (zalogaPovzetekCasOznaka) + noge na vseh straneh', () => {
    expect(lib).toContain('dobaviteljBeseda(dobavitelji.length)')
    expect(lib).toContain('zalogaPovzetekCasOznaka(now)')
    expect(lib).toContain('Roksal Field Manager v2.5')
  })

  it('generateDobaviteljiPdf shrani z dobaviteljiPdfFilename (WYSIWYG ime — r234/r235 vzorec)', () => {
    expect(lib).toContain('doc.save(dobaviteljiPdfFilename(options.now))')
  })

  it('ROKSAL dokumentna družina: glava + DOBAVITELJI naslov (ISTI vzorec kot zaloga/naročilnica)', () => {
    expect(lib).toContain("doc.text('DOBAVITELJI', 196, 12, { align: 'right' })")
    expect(lib).toContain("doc.text('ROKSAL', 14, 12)")
    expect(lib).toContain('registerSloPdfFonts(doc)')
  })
})

describe('R236 — komponenta: PDF pill v zavihku Dobavitelji (ISTI pill družina R234/R235)', () => {
  it('gumb obstaja z aria + title (a11y družina R231/R233/R234/R235)', () => {
    expect(komponenta).toContain('aria-label="Izvozi dobavitelje kot PDF"')
    expect(komponenta).toContain('Dobavitelji kot pravi PDF — arhivski pregled kontaktnih in sodelovalnih podatkov')
  })

  it('handler: VEDNO viden (disabled LE loading) + fail-closed pri 0 + EN now za dokument IN ime', () => {
    const z = komponenta.indexOf('const handleSuppliersPdf')
    const k = komponenta.indexOf('return (')
    const h = komponenta.slice(z, k)
    expect(h).toContain('if (loading) return')
    expect(h).toContain("if (suppliers.length === 0) {")
    expect(h).toContain('PDF se izvozi, ko je dodan prvi dobavitelj.')
    expect(h).toContain('const now = new Date()')
    expect(h).toContain('buildDobaviteljiPdfDoc(suppliers, { now })')
    expect(h).toContain('dobaviteljiPdfFilename(now)')
  })

  it('fail-verbose: TypeError → viden razlog; ostalo → Izvoz PDF ni uspel (R234/R235 družina)', () => {
    expect(komponenta).toContain("title: 'Dobavitelji PDF ni mogoče sestaviti iz tega seznama'")
    expect(komponenta).toContain('Izvoz PDF ni uspel: ')
  })

  it('uspeh toast: sklanjatev prek dobaviteljBeseda (brez ročnega množilnika)', () => {
    expect(komponenta).toContain('dobaviteljBeseda(suppliers.length)')
  })
})

describe('R236 — [Mandatory] stil (P1-f): focus-visible prstan revizija — ENA fokusrna družina', () => {
  it('app glavni fokus = roksal-navy/40 (revizija: 4 odstopanja konvertirana)', () => {
    expect(racuni).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"')
    expect(racuni).toContain("className=\"h-7 text-xs bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-roksal-navy/40\"")
    expect(komponenta).toContain('bg-green-50 dark:bg-green-950/40 focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
    // Konvertirana odstopanja NE obstajajo več (amber/emerald/green fokusrni žetoni).
    expect(racuni).not.toContain('focus-visible:ring-amber-500/50')
    expect(racuni).not.toContain('focus-visible:ring-emerald-400/50')
    expect(komponenta).not.toContain('focus-visible:ring-green-600/40')
  })

  it('NAMERNE IZJEME: white/60 na temnih canvas/površinah ostane (visokokontrastna funkcija)', () => {
    // sketch-canvas / top-bar / floor-plan / photo-tab — bele pike na temnem
    // ozadju (kamera/risalna plošča) — navy/40 tam NI viden; dokumentirana
    // izjema (r231 data-viz vzorec).
    for (const f of ['sketch-canvas.tsx', 'top-bar.tsx', 'floor-plan-tab.tsx', 'photo-tab.tsx']) {
      expect(beri(`src/components/roksal/${f}`)).toContain('focus-visible:ring-white/60')
    }
  })

  it('NAMERNE IZJEME (dokumentirane): destructive ring-red = a11y semantika brisanja (sorojenci ostanejo semantični)', () => {
    // Rdeči fokus ob destruktivnih akcijah je pomenovana barva (ISTA družina
    // kot rdeči zavihki/žetoni — r231 data-viz odločitev); navy/40 tam bi
    // utišal opozorilno semantiko. Konverzija zajema LE ne-semantična
    // odstopanja (amber CSV pill, emerald statusni gumbi, green Prejem).
    expect(beri('src/components/roksal/logistics-tab.tsx')).toContain('focus-visible:ring-red-400/50')
  })

  it('revizija je token-na-token (ring-roksal-navy/40 — brez novih hex na konvertiranih vrsticah)', () => {
    // File-wide hex negativa NE gre (r235 lekcija 3: sorojenci #1d2b3e v
    // invoice-manager so PDF/chart semantika že pred revizijo) — dokaz je
    // per-kontekst: konvertirani classi so NAVADNI tokeni (že preverjeno
    // zgoraj); tukaj še negativa starih odstopanj po vrstici z aria.
    const vrstica = racuni.split('\n').find((l) => l.includes('Izvozi račune kot CSV') === false && l.includes('press-scale')) ?? ''
    expect(vrstica).toContain('focus-visible:ring-roksal-navy/40')
    expect(vrstica).not.toContain('amber')
    expect(vrstica).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})
