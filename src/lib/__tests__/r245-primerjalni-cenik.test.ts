// R245 (P1-g, 'izvozi' družina — 6. člen) — PRIMERJALNI CENIK (CSV + PDF) iz
// Material → Dobavitelji → 'Cene materiala'. LOČEN dokument od cenika R244
// (zavestna odločitev — cenik ostane bajtno STABILEN, njegovi testi pijejo
// točne stolpce): ENA vrstica per artikel = najnižja trenutno veljavna cena.
// Vir = polje `bestPerMaterial` iz GET /api/material-prices brez filtrov —
// API že vrne to resnico (bestPrice/bestSupplier/suppliers), route NIČ
// (client+lib only — izvoz je potrošnik obstoječe resnice).
//
// + lib primerjalni-cenik-pdf (cenik-pdf R244 vzorec): ROKSAL glava, KPI
//   RAČUNANI iz obveznih polj vrstic (artikli, najnižja/najvišja najboljša
//   cena, primerjave = artikli z ≥ 2 ponudbami — NIKOLI izmišljeni števci),
//   autoTable (ISTI stolpci kot CSV), noge, bajtni determinizem (FNV-1a
//   LASTNI soli 0x51–0x54, now KOT parameter), sort V LIBU in IZVOŽEN —
//   CSV brat uporabi ISTI red (WYSIWYG; izboljšava vzorca: cenik R244 CSV
//   je šel po API redu).
// + [Mandatory] stil: ISTI pill razredi kot cenik par (družinska pariteta,
//   press-scale token) + legenda izvozne skupine (želona pariteta) — 0 novih
//   hex.
//
// Tehnika dokazov (r244 vzorec): bajtni dokazi na bufferju (%PDF magija,
// %%EOF, determinizem); vsebinski dokazi na VIRU liba/komponente (PDF
// content stream je fontno kodiran — izvleka teksta iz bajtov NI resnična).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildPrimerjalniPdfDoc,
  primerjalniPdfFilename,
  preveriPrimerjalniVnos,
  sortirajPrimerjalni,
  type PrimerjalniPdfVnos,
} from '@/lib/primerjalni-cenik-pdf'
import { buildCenikPdfDoc } from '@/lib/cenik-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med dvema markerjema (r207/r233/r244 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const material = beri('src/components/roksal/material-intelligence-tab.tsx')
const lib = beri('src/lib/primerjalni-cenik-pdf.ts')
const cenikLib = beri('src/lib/cenik-pdf.ts')
const mpRoute = beri('src/app/api/material-prices/route.ts')

const ZDANJ: Date = new Date(2026, 8, 28, 11, 0, 0) // fiksen vhod — determinizem

// EN artikel = ENA vrstica; 2 artikla z več ponudbami (primerjava RES
// obstaja) + en z eno ponudbo. ŠČŽ niz za fontni + sortni dokaz.
const VRSTE: PrimerjalniPdfVnos[] = [
  {
    artikel: 'Inox palica 40×40',
    sifra: 'WPC-120-A',
    enota: 'm',
    najboljsaCena: 11.9,
    dobavitelj: 'ŠČŽ Žaga d.o.o.',
    stDobaviteljev: 2,
  },
  {
    artikel: 'Aluminijasti profil 25 mm',
    sifra: 'ALU-025-B',
    enota: 'kos',
    najboljsaCena: 4.35,
    dobavitelj: 'Alu Center d.o.o.',
    stDobaviteljev: 3,
  },
  {
    artikel: 'Betonska podlaga 80×80',
    sifra: 'BET-080-C',
    enota: 'kos',
    najboljsaCena: 2,
    dobavitelj: 'Gradbeni material d.o.o.',
    stDobaviteljev: 1,
  },
]

function zgradi(vnosi: readonly PrimerjalniPdfVnos[] = VRSTE, now: Date = ZDANJ): Buffer {
  const doc = buildPrimerjalniPdfDoc(vnosi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R245 — primerjalni-cenik-pdf lib (družina cenik-pdf R244, sal 0x51–0x54)', () => {
  it('izhod je veljaven PDF (%PDF magični bajti + %%EOF)', () => {
    const b = zgradi()
    expect(b.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(b.subarray(-6).toString('ascii').trim()).toBe('%%EOF')
  })

  it('bajtni determinizem: enak vhod (množica) = bajtno enak dokument (R121 100× pravilo)', () => {
    const a = zgradi()
    const b = zgradi()
    expect(a.equals(b)).toBe(true)
  })

  it('sort V LIBU: premešan vrstni red ISTE množice = bajtno ISTI dokument (determinizem = f(množica))', () => {
    const naravni = zgradi(VRSTE)
    const premesano = zgradi([...VRSTE].reverse())
    expect(naravni.equals(premesano)).toBe(true)
  })

  it('skupni red je STROG: artikel asc → najboljša cena asc → dobavitelj asc → šifra asc (izvožen sort)', () => {
    const sortirane = sortirajPrimerjalni([...VRSTE].reverse())
    expect(sortirane[0].artikel).toBe('Aluminijasti profil 25 mm') // 'A' < 'B' < 'I'
    expect(sortirane[1].artikel).toBe('Betonska podlaga 80×80')
    expect(sortirane[2].artikel).toBe('Inox palica 40×40')
    // izboljšava vzorca (WYSIWYG brata): ISTI sort funkcijsko uporabljen
    // v downloadPrimerjalniCsv — CSV ni več po API redu, ampak po skupnem redu
    expect(lib).toContain('export function sortirajPrimerjalni(')
    expect(material).toContain('sortirajPrimerjalni(primerjalniVnosi(vrste))')
    // cenik R244 mora ostati NESPREMENJEN (bajtna stabilnost — API red)
    expect(cenikLib).toContain('function sortirajCenik(')
    expect(oknoMed(material, 'function downloadCenikCsv', '// R207 — stil statusnega filtra')).not.toContain('sortirajCenik')
  })

  it('prazen seznam ne nastaja dokumenta (TypeError — ni prazne datoteke, R232–R244 družina)', () => {
    expect(() => buildPrimerjalniPdfDoc([], { now: ZDANJ })).toThrow(TypeError)
    expect(() => buildPrimerjalniPdfDoc([], { now: ZDANJ })).toThrow(/prazen seznam/)
  })

  it('pokvaren now → TypeError (determinizem ni tišina)', () => {
    expect(() => buildPrimerjalniPdfDoc(VRSTE, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => buildPrimerjalniPdfDoc(VRSTE, { now: undefined as unknown as Date })).toThrow(TypeError)
  })

  it('ime datoteke: Primerjalni-cenik-YYYY-MM-DD.pdf iz ISTEGA now (žig IN ime — lekcija R121/R235/R244)', () => {
    expect(primerjalniPdfFilename(ZDANJ)).toBe('Primerjalni-cenik-2026-09-28.pdf')
  })

  it('preveriPrimerjalniVnos: indeks krivca je VEDNO v sporočilu (artikel/sifra/enota/dobavitelj/najboljsaCena/stDobaviteljev)', () => {
    expect(() => preveriPrimerjalniVnos({ ...VRSTE[0], artikel: '  ' }, 3)).toThrow(/\(3\)/)
    expect(() => preveriPrimerjalniVnos({ ...VRSTE[0], sifra: '' }, 2)).toThrow(/\(2\).*sifra/)
    expect(() => preveriPrimerjalniVnos({ ...VRSTE[0], enota: undefined as unknown as string }, 1)).toThrow(/\(1\).*enota/)
    expect(() => preveriPrimerjalniVnos({ ...VRSTE[0], dobavitelj: null as unknown as string }, 0)).toThrow(/\(0\).*dobavitelj/)
    expect(() => preveriPrimerjalniVnos({ ...VRSTE[0], najboljsaCena: -1 }, 5)).toThrow(/\(5\).*najboljsaCena/)
    expect(() => preveriPrimerjalniVnos({ ...VRSTE[0], najboljsaCena: Number.NaN }, 5)).toThrow(/najboljsaCena/)
    expect(() => preveriPrimerjalniVnos({ ...VRSTE[0], stDobaviteljev: 0 }, 4)).toThrow(/\(4\).*stDobaviteljev/)
    expect(() => preveriPrimerjalniVnos({ ...VRSTE[0], stDobaviteljev: 1.5 }, 4)).toThrow(/stDobaviteljev/)
    expect(() => preveriPrimerjalniVnos({ ...VRSTE[0], stDobaviteljev: undefined as unknown as number }, 4)).toThrow(/stDobaviteljev/)
    expect(() => preveriPrimerjalniVnos(VRSTE[0], 0)).not.toThrow()
  })

  it('LASTNI soli 0x51–0x54 (brez kolizij z brati: zaloga 0x01–04, naročilnica 0x11–14, dobavitelji 0x21–24, osnutek 0x31–34, cenik 0x41–44)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x51)')
    expect(lib).toContain('fnv1aHex(seed, 0x52)')
    expect(lib).toContain('fnv1aHex(seed, 0x53)')
    expect(lib).toContain('fnv1aHex(seed, 0x54)')
    expect(lib).not.toContain('0x41)')
    expect(lib).not.toContain('0x31)')
  })

  it('fileId semenska formula vključuje št. dobaviteljev (#n) — isto najnižja cena z drugačno ponudbami ≠ isti ID', () => {
    expect(lib).toContain('#${p.stDobaviteljev}')
  })

  it('KPI se RAČUNAJO iz vrstic (artikli/najnižja/najvišja/primerjave ≥ 2 ponudb) — NIKOLI izmišljeni števci', () => {
    expect(lib).toContain('const najnizja = Math.min(')
    expect(lib).toContain('const najvisja = Math.max(')
    expect(lib).toContain('const primerjave = sortirane.filter((p) => p.stDobaviteljev >= 2).length')
    // iskren podpis: samo veljavne cene (route filtrira veljavnostDo: null)
    expect(lib).toContain('najnižja vpisana cena per artikel')
    expect(lib).toContain('samo trenutno veljavne cene')
  })

  it('glava PRIMERJALNI CENIK + zelena resnica najboljše cene + amber poudarjeni artikli z ≥ 2 ponudbami (vir)', () => {
    expect(lib).toContain("'PRIMERJALNI CENIK'")
    expect(lib).toContain('data.column.index === 3')
    expect(lib).toContain('data.column.index === 5')
    expect(lib).toContain('Number(v) >= 2')
  })

  it('cena kot stabilen niz na 2 decimalni mesti (ISTI vzorec kot cenik R244)', () => {
    expect(lib).toContain('function cenaNiz(c: number): string {')
    expect(lib).toContain('c.toFixed(2)')
  })

  it('sklanjatev artikelBeseda se PONOVNO uporabi iz cenik-pdf (brez duplikacije — EN vir)', () => {
    expect(lib).toContain("import { artikelBeseda } from './cenik-pdf'")
  })
})

describe('R245 — primerjalni CSV + pilli v material-intelligence-tab', () => {
  it('downloadPrimerjalniCsv: ISTI prerez stolpcev kot PDF (Artikel, Šifra, Enota, Najboljša cena (EUR/enota), Dobavitelj, Št. dobaviteljev)', () => {
    const fn = oknoMed(material, 'function downloadPrimerjalniCsv', '/** R245 — fail-closed preslikava')
    expect(fn).not.toBe('')
    expect(fn).toContain("'Artikel', 'Šifra', 'Enota', 'Najboljša cena (EUR/enota)', 'Dobavitelj', 'Št. dobaviteljev'")
    // ISTI stolpci v PDF tabeli (ENA resnica čez brata)
    expect(lib).toContain("head: [['Artikel', 'Šifra', 'Enota', 'Najboljša cena (EUR/enota)', 'Dobavitelj', 'Št. dobaviteljev']]")
    // CSV ime = ISTA zgodba kot PDF ime (Primerjalni-cenik-…)
    expect(fn).toContain('`Primerjalni-cenik-${todayStamp()}.csv`')
  })

  it('primerjalniVnosi: fail-closed preslikava — pokvarjena oblika API odgovora → TypeError z indeksom (nič izmišljenih polj)', () => {
    expect(material).toContain('manjkajoči inventory v odgovoru API-ja')
    expect(material).toContain("typeof v !== 'object' || !v.inventory")
  })

  it('pridobiPrimerjalni: ISTI endpoint, polje bestPerMaterial, fail-verbose HTTP status + pokvarjena oblika', () => {
    const fn = oknoMed(material, 'const pridobiPrimerjalni', 'const handlePrimerjalniCsv')
    expect(fn).toContain("fetch('/api/material-prices')")
    expect(fn).toContain("'Odgovora /api/material-prices ni mogoče prebrati (manjka polje bestPerMaterial).'")
    expect(fn).toContain('`GET /api/material-prices → HTTP ${res.status}`')
  })

  it('pilli: aria-label + ISTI pill razredi kot cenik par (h-8 text-xs CSV / h-6 gap-1 text-2xs PDF + press-scale)', () => {
    expect(material).toContain('aria-label="Izvozi primerjalni cenik kot CSV"')
    expect(material).toContain('aria-label="Izvozi primerjalni cenik kot PDF"')
    const csvPill = oknoMed(material, 'Izvozi primerjalni cenik kot CSV', 'Izvozi primerjalni cenik kot PDF')
    expect(csvPill).toContain('h-8 text-xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1')
    const pdfPill = oknoMed(material, 'Izvozi primerjalni cenik kot PDF', '</Button>\n                </div>')
    expect(pdfPill).toContain('h-6 gap-1 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1')
  })

  it('pilli VEDNO vidni (bralni tok, P1-k precedens) — NISO znotraj lahkoUrejaCene veje', () => {
    const ceneKartica = oknoMed(material, 'Cene materiala</CardTitle>', 'Izberi material za dodajanje cene')
    expect(ceneKartica).toContain('Izvozi primerjalni cenik kot CSV')
    expect(ceneKartica).toContain('Izvozi primerjalni cenik kot PDF')
    expect(ceneKartica).not.toContain('lahkoUrejaCene')
  })

  it('legenda izvozne skupine: vsak dokument pove svojo resnico (želona pariteta — žetoni, 0 novih hex)', () => {
    const ceneKartica = oknoMed(material, 'Cene materiala</CardTitle>', 'Izberi material za dodajanje cene')
    expect(ceneKartica).toContain('Cenik = vse ponudbe · Primerjalni = najnižja per artikel')
    expect(ceneKartica).toContain('text-2xs text-muted-foreground')
  })

  it('fail-closed toasti: 0 cen → iskren naslov ZA PRIMERJAVO (drugačen od cenika — vsak dokument pove svojo resnico)', () => {
    expect(material).toContain("'Ni vpisanih cen za primerjavo'")
    // cenik R244 toast ostane nespremenjen (bajtna stabilnost sporočil)
    expect(material).toContain("'Ni vpisanih cen za izvoz'")
    expect(material).toContain("'Primerjalni cenik PDF ni mogoče sestaviti iz teh podatkov'")
    expect(material).toContain("'Izvoz primerjalnega cenika ni uspel'")
  })

  it('primerjalniVTeku zavira dvoklik: disabled={loading || primerjalniVTeku} + guard if (primerjalniVTeku) return', () => {
    expect(material).toMatch(/disabled=\{loading \|\| primerjalniVTeku\}/)
    expect((material.match(/if \(primerjalniVTeku\) return/g) || []).length).toBe(2)
  })

  it('EN now za žig IN ime (determinizem — dva new Date() bi razdala žig in ime)', () => {
    const pdf = oknoMed(material, 'const handlePrimerjalniPdf', '  return (')
    expect((pdf.match(/new Date\(\)/g) || []).length).toBe(1)
  })

  it('toast sklanjatev: artikelBeseda za števec artiklov v CSV toastu (ENO vir iz cenik-pdf)', () => {
    const csv = oknoMed(material, 'const handlePrimerjalniCsv', 'const handlePrimerjalniPdf')
    expect(csv).toContain('${count} ${artikelBeseda(count)} v Primerjalni-cenik-')
  })
})

describe('R245 — API pogodba: route NIČ (izvoz je potrošnik obstoječe resnice)', () => {
  it('GET /api/material-prices že vrača bestPerMaterial (brez filtrov) — route NI bil spremenjen', () => {
    expect(mpRoute).toContain('bestPerMaterial: Array.from(byMaterial.values())')
    expect(mpRoute).toContain('veljavnostDo: null, // samo trenutno veljavne')
    expect(mpRoute).toContain('include: { inventory: true, supplier: true }')
  })

  it('route NE vsebuje primerjalne logike izvoza (client+lib only — nič v API plasti)', () => {
    expect(mpRoute).not.toContain('primerjalni')
    expect(mpRoute).not.toContain('Primerjalni')
  })
})

describe('R245 — [Mandatory] stil: press-scale TOKEN — portal CTA migracija (zadnja bespoke trica na CTA vrstici)', () => {
  const portal = beri('src/app/portal/[token]/page.tsx')

  it("portal 'Pokliči' (zeleni CTA) nosi press-scale token, ne bespoke trice", () => {
    // okno sidrano na CTA razred (zgornji tel: link je drug element — topbar)
    const cta = oknoMed(portal, 'bg-roksal-green text-white px-3 py-3', '</a>')
    expect(cta).toContain('press-scale')
    expect(cta).not.toContain('active:scale-[0.98]')
    // barvni hover ostane (ISTI vzorec kot R244 wave-6 CTA: transition-all + press-scale sobivata)
    expect(cta).toContain('hover:bg-roksal-green/90 press-scale transition-all')
  })

  it("portal 'Email' (navy CTA) nosi press-scale token, ne bespoke trice", () => {
    const cta = oknoMed(portal, 'bg-roksal-navy text-white px-3 py-3', '</a>')
    expect(cta).toContain('press-scale')
    expect(cta).not.toContain('active:scale-[0.98]')
    expect(cta).toContain('hover:bg-roksal-navy/90 press-scale transition-all')
  })

  it('portal: nikjer več bespoke active:scale-[0.98] (dokumentirane izjeme ostajajo SAMO v notification-center + site-survey — kartica/hover:-translate-y družina, NE CTA press-družina)', () => {
    expect(portal).not.toContain('active:scale-[0.98]')
    // izjeme so dokumentirane in omejene na NE-CTA kartične vrstice
    const notification = beri('src/components/roksal/notification-center.tsx')
    const siteSurvey = beri('src/components/roksal/site-survey-tab.tsx')
    for (const vrstica of [...notification.split('\n'), ...siteSurvey.split('\n')]) {
      if (vrstica.includes('active:scale-[0.98]')) {
        // kartične vrstice: hover:-translate-y / transition-all kartica — niso CTA press-družina
        expect(
          vrstica.includes('hover:-translate-y') || vrstica.includes('mt-2 h-9 w-full'),
          `nepričakovana bespoke vrstica: ${vrstica.slice(0, 80)}`,
        ).toBe(true)
      }
    }
  })
})
