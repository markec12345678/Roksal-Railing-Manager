// R235 (P1-c 'izvozi' družina — PDF dimenzija, 2. člen) — NAROČILNICA PDF IZ
// NAROČILA: lib narocilnica-pdf (zaloga-pdf R234 vzorec — ROKSAL glava, KPI,
// autoTable, noge, bajtni determinizem z client-safe FNV-1a) + gumb PDF na
// kartici naročila v material-intelligence-tab.
//
// ENA RESNICA: validacija POVSEM delegirana na buildNarocilnicaIzNarocila
// (R206 — tekstovna naročilnica) — pokvaren vhod vrže ISTO TypeError sporočilo
// pri OBEH bratih; tabela nosi ISTA dejstva per postavko kot besedilne vrstice
// `{i+1}. {naziv}: {količina} {enota}`; BREZ cen (R204 — v dokumentu ni €).
//
// Tehnika dokazov (r234 vzorec): bajtni dokazi na bufferju (%PDF magija,
// %%EOF, determinizem); vsebinski dokazi na VIRU liba/komponente (PDF content
// stream je fontno kodiran — izvleka teksta iz bajtov NI resnična).
//
// + [Mandatory] stil (P1-f): measurements UI površine gray → žetoni (status
//   števca Osnutki/Arhivirane + tipPodlage fallback + glasovni disabled veja);
//   SEMANTIČNE legende (SEGMENT/beton/DRUGO) ostanejo — dokumentirana izjema
//   (r231). + skripta r235-dark-scan-gray.py (nov sloj — srednje/solid veje).
// + [Mandatory] infra (P1-d): e2e-lib.sh dobi eb_zajem_pdf (byte-exact zajem
//   BINARNIH datotek — arrayBuffer→base64; Response.text() za PDF ni varen).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildNarocilnicaPdfDoc,
  dobaviteljSlug,
  generateNarocilnicaPdf,
  narocilnicaPdfFilename,
  type NarocilnicaPdfOptions,
} from '@/lib/narocilnica-pdf'
import {
  buildNarocilnicaIzNarocila,
  type NarociloZaDokument,
} from '@/lib/zaloga-povzetek'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const komponenta = beri('src/components/roksal/material-intelligence-tab.tsx')
const meritve = beri('src/components/roksal/measurements-tab.tsx')
const lib = beri('src/lib/narocilnica-pdf.ts')
const e2eLib = beri('scripts/e2e-lib.sh')

const ZDANJ: Date = new Date(2026, 8, 28, 10, 0, 0) // fiksen vhod — determinizem

const NAROCILO: NarociloZaDokument = {
  supplier: { naziv: 'Inox Trade d.o.o.' },
  items: [
    { naziv: 'Inox vijak A2 8x60', kolicina: 12, enota: 'kos' },
    { naziv: 'WPC deska 120', kolicina: 40, enota: 'm' },
  ],
  opombe: 'R235 testna opomba — dostava na gradbišče Kranj.',
}

const OPCIJE: NarocilnicaPdfOptions = { now: ZDANJ }

function pdfBajti(
  order: NarociloZaDokument,
  options?: Partial<NarocilnicaPdfOptions>,
): Buffer {
  const doc = buildNarocilnicaPdfDoc(order, { now: ZDANJ, ...options })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R235 — narocilnica-pdf: pravi artefakt + determinizem (R121/R234 vzorec)', () => {
  it('izhod je veljaven PDF (%PDF magični bajti + %%EOF)', () => {
    const b = pdfBajti(NAROCILO)
    expect(b.length).toBeGreaterThan(1000)
    expect(b.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(b.subarray(-6).toString('ascii').trim()).toBe('%%EOF')
  })

  it('DETERMINIZEM: enak vhod = bajtno enak PDF (setCreationDate + FNV-1a file-ID, NIČ crypto uvoza)', () => {
    const a = pdfBajti(NAROCILO)
    const b = pdfBajti(NAROCILO)
    expect(a.equals(b)).toBe(true)
    expect(lib).not.toContain("from 'node:crypto'")
    expect(lib).not.toContain('Math.random')
  })

  it('različen `now` → različen PDF (žig je del identitete dokumenta)', () => {
    const a = pdfBajti(NAROCILO)
    const b = pdfBajti(NAROCILO, { now: new Date(ZDANJ.getTime() + 60_000) })
    expect(a.equals(b)).toBe(false)
  })

  it('različna postavka → različen PDF (vsebina je del file-ID semena)', () => {
    const a = pdfBajti(NAROCILO)
    const drugo: NarociloZaDokument = {
      ...NAROCILO,
      items: [...NAROCILO.items, { naziv: 'Alu profil 50', kolicina: 3, enota: 'kos' }],
    }
    expect(a.equals(pdfBajti(drugo))).toBe(false)
  })
})

describe('R235 — narocilnica-pdf: fail-closed pogodba (delegirana ENA resnica)', () => {
  it('pokvarjeno naročilo → ISTO TypeError sporočilo kot tekstovna naročilnica (delegacija)', () => {
    const pokvarjeno: NarociloZaDokument = {
      supplier: { naziv: 'Inox Trade d.o.o.' },
      items: [{ naziv: '', kolicina: 2, enota: 'kos' }],
    }
    let odTekstovne = ''
    try {
      buildNarocilnicaIzNarocila(pokvarjeno, { now: ZDANJ })
    } catch (e) {
      odTekstovne = (e as TypeError).message
    }
    expect(odTekstovne).not.toBe('')
    expect(() => buildNarocilnicaPdfDoc(pokvarjeno, OPCIJE)).toThrowError(odTekstovne)
  })

  it('naročilo BREZ postavk → TypeError (ni dokumenta iz praznine — R206/R232 družina)', () => {
    const prazno: NarociloZaDokument = { supplier: { naziv: 'X' }, items: [] }
    expect(() => buildNarocilnicaPdfDoc(prazno, OPCIJE)).toThrowError(TypeError)
  })

  it('prazen dobavitelj → TypeError (fail-closed)', () => {
    const brez: NarociloZaDokument = { supplier: { naziv: '   ' }, items: NAROCILO.items }
    expect(() => buildNarocilnicaPdfDoc(brez, OPCIJE)).toThrowError(TypeError)
  })

  it('neveljaven now → TypeError (determinizem pogodba — filename IN dokument)', () => {
    expect(() =>
      buildNarocilnicaPdfDoc(NAROCILO, { now: new Date(NaN) }),
    ).toThrowError(TypeError)
    expect(() => narocilnicaPdfFilename(NAROCILO, new Date(NaN))).toThrowError(TypeError)
  })

  it('narocilnicaPdfFilename: narocilnica-{slug}-{ISTI dan kot CSV stamp}.pdf', () => {
    expect(narocilnicaPdfFilename(NAROCILO, ZDANJ)).toBe(
      'narocilnica-inox-trade-d-o-o-2026-09-28.pdf',
    )
  })

  it('dobaviteljSlug: ščetke → s/c/z, zloženi lojtre, brez robov (deterministično)', () => {
    expect(dobaviteljSlug('ŠČŽ Žaga d.o.o.')).toBe('scz-zaga-d-o-o')
    expect(dobaviteljSlug('  --Pero--  ')).toBe('pero')
    expect(() => dobaviteljSlug('   ')).toThrowError(TypeError)
  })
})

describe('R235 — ENA resnica: PDF tabela = ISTA dejstva kot tekstovna naročilnica R206', () => {
  it('validacija je delegirana: lib kliče buildNarocilnicaIzNarocila PRED renderingom', () => {
    expect(lib).toContain('buildNarocilnicaIzNarocila(order, { now })')
    // ISTI trimmed vir dobavitelja (brez ponovnega različnega razreza)
    expect(lib).toContain('const dobavitelj = order.supplier.naziv.trim()')
  })

  it('tabela: glava Št./Naziv/Količina/Enota — ISTA per-postavka dejstva kot R206 vrstice', () => {
    expect(lib).toContain("head: [['Št.', 'Naziv', 'Količina', 'Enota']]")
    expect(lib).toContain('String(i + 1)')
    expect(lib).toContain('String(p.kolicina)')
    expect(lib).toContain('p.naziv.trim()')
    expect(lib).toContain('p.enota.trim()')
  })

  it('opomba prisotna LE ko obstaja (R206/R227 pravilo — brez izmišljenega konteksta)', () => {
    expect(lib).toContain("const opombe = typeof order.opombe === 'string' ? order.opombe.trim() : ''")
    expect(lib).toContain("if (opombe !== '')")
  })

  it('BREZ cen v dokumentu (R204 pravilo — vrednosti ostanejo v aplikaciji)', () => {
    // V tabeli NI cenovnega stolpca; handler ne dotika skupajCena.
    expect(lib).not.toContain("'Cena'")
    expect(lib).not.toContain('skupajCena')
    expect(lib).not.toMatch(/item\.cena|p\.cena|\.toFixed/)
  })

  it('sklepna vrstica: ISTA sklanjatev postavk (narociloPostavkaBeseda) + ISTI žig (zalogaPovzetekCasOznaka)', () => {
    expect(lib).toContain('narociloPostavkaBeseda(postavk)')
    expect(lib).toContain('zalogaPovzetekCasOznaka(now)')
  })

  it('generateNarocilnicaPdf shrani z narocilnicaPdfFilename (WYSIWYG ime — r234 vzorec)', () => {
    expect(lib).toContain('doc.save(narocilnicaPdfFilename(order, options.now))')
    expect(typeof generateNarocilnicaPdf).toBe('function')
  })

  it('KPI izračunana IZ postavk (dokument notranje skladen — Set enot, ne izmišljeni števci)', () => {
    expect(lib).toContain('new Set(order.items.map((p) => p.enota.trim()))')
    expect(lib).toContain("String(postavk)")
    expect(lib).toContain('String(enote.size)')
  })
})

describe('R235 — komponenta: PDF pill na kartici naročila (ISTI pill družina R234)', () => {
  it('gumb obstaja z aria + title (a11y družina R231/R233/R234)', () => {
    expect(komponenta).toContain('aria-label={`Prenesi naročilnico naročila pri ${order.supplier.naziv} kot PDF`}')
    expect(komponenta).toContain('Naročilnica kot pravi PDF za dobavitelja — determinističen dokument iz postavk')
  })

  it('handler: EN now za dokument IN ime (dva new Date() = razidan determinizem)', () => {
    const z = komponenta.indexOf('const prenesiNarocilnicoPdf')
    const k = komponenta.indexOf('R140 — izvoz naročil v CSV')
    const h = komponenta.slice(z, k)
    expect(h).toContain('const now = new Date()')
    expect(h).toContain('buildNarocilnicaPdfDoc(order, { now })')
    expect(h).toContain('narocilnicaPdfFilename(order, now)')
  })

  it('fail-verbose: TypeError → viden razlog; ostalo → Prenos PDF ni uspel (R234 družina)', () => {
    expect(komponenta).toContain("title: 'Naročilnice PDF ni mogoče sestaviti iz tega naročila'")
    expect(komponenta).toContain('Prenos PDF ni uspel: ')
  })
})

describe('R235 — [Mandatory] stil (P1-f): measurements UI površine gray → žetoni', () => {
  it('status števca Osnutki/Arhivirane → bg-muted + border-border + muted-foreground (en razred obe temi)', () => {
    expect(meritve).toContain('"rounded-lg bg-muted border border-border p-2 text-center"')
    expect(meritve).toContain('text-sm font-bold text-muted-foreground">{statusCounts.OSNUTEK}')
    expect(meritve).toContain('text-sm font-bold text-muted-foreground line-through">{statusCounts.ARHIVIRANA}')
  })

  it('ARHIVIRANA line-through semantika arhiva OSTANE (R234 pravilo)', () => {
    expect(meritve).toMatch(/text-muted-foreground line-through/)
  })

  it("'Potrjene' sorojec ostane semantično zelen (sorojenci semantični)", () => {
    expect(meritve).toContain('bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800')
  })

  it('tipPodlage neznana veja (fallback) → žetoni (R234 unknown-branch vzorec)', () => {
    // Konverziran fallback (kontekstno sidro — DRUGO legenda ima ISTO staro
    // vrednost in ostaja po r231 odločitvi, zato file-wide negativa NIČ ne dokaže).
    expect(meritve).toContain(
      "groundTypeColors[m.tipPodlage as GroundType] ||\n                      'bg-muted text-muted-foreground border-border'",
    )
  })

  it('glasovni gumb disabled veja → žetoni (R229 Zapadlo vzorec)', () => {
    expect(meritve).toContain("'border-border bg-muted text-muted-foreground cursor-not-allowed'")
    expect(meritve).not.toContain(
      "'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 text-gray-400 cursor-not-allowed'",
    )
  })

  it('NAMERNE IZJEME (r231): semantične legende SEGMENT/beton/DRUGO ostanejo gray (data-viz)', () => {
    expect(meritve).toContain(
      "SEGMENT: 'bg-gray-50 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800'",
    )
    expect(meritve).toContain(
      "beton: 'bg-gray-100 dark:bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-800'",
    )
    expect(meritve).toContain(
      "DRUGO: 'bg-gray-50 dark:bg-gray-950/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800'",
    )
  })

  it('skripta r235-dark-scan-gray.py obstaja + pokriva srednje veje (text 400-600 / bg 400-700) + izjema legenda', () => {
    const skripta = beri('scripts/r235-dark-scan-gray.py')
    expect(skripta).toContain('text-gray-srednji')
    expect(skripta).toContain('bg-gray-solid')
    expect(skripta).toContain('border-gray-srednji')
    expect(skripta).toContain('reference-gallery.tsx')
  })
})

describe('R235 — [Mandatory] infra (P1-d): eb_zajem_pdf v skupni E2E knjižnici', () => {
  it('eb_zajem_pdf obstaja (byte-exact zajem: arrayBuffer → Uint8Array → btoa)', () => {
    expect(e2eLib).toContain('eb_zajem_pdf()')
    expect(e2eLib).toContain('arrayBuffer()')
    expect(e2eLib).toContain('btoa(')
  })

  it('IIFE lekcija (r225/r227) ostaja ZAPRTA — vsi literalni predikati v knjižnici so klicani', () => {
    const predikati = e2eLib.match(/agent-browser eval "\(\(\)=>\{/g) ?? []
    const klicani = e2eLib.match(/\}\)\(\)"/g) ?? []
    expect(predikati.length).toBeGreaterThan(0)
    expect(klicani.length).toBeGreaterThanOrEqual(predikati.length)
  })
})
