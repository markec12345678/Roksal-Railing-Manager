// R244 (P1 'izvozi' družina — 5. člen) — CENIK MATERIALA IZVOZ (CSV + PDF)
// iz Material → Dobavitelji → 'Cene materiala'. Zadnja površina v Materialu
// brez izvoza (dobavitelji imata CSV R233 + PDF R236, naročila CSV R231,
// BOM Refine naročilnico R206/R235) — cenik zaključuje družino na cenovni
// površini. Vir = GET /api/material-prices (samo trenutno veljavne cene —
// route filtrira veljavnostDo: null; to je ISTA resnica, ki jo izpostavi
// 'Pregled cen' — WYSIWYG).
//
// + lib cenik-pdf (dobavitelji-pdf R236 vzorec): ROKSAL glava, KPI RAČUNANI
//   iz obveznih polj vrstic (artikli/cene/razpon — NIKOLI izmišljeni
//   števci), autoTable (ISTI stolpci kot CSV), noge, bajtni determinizem
//   (FNV-1a LASTNI soli 0x41–0x44, now KOT parameter), sort V LIBU
//   (artikel → cena → dobavitelj → opomba) — determinizem je f(MNOŽICA
//   vhodov), ne f(vrstni red odgovora).
// + [Mandatory] stil: press-scale TOKEN pariteta — bespoke
//   active:scale-[0.98]/hover:scale-[1.02] izkoreninjen z primarnih CTA
//   ('Nov projekt' hero, 'Shrani meritev', ekipa ×3) → ENA press-družina
//   (dokumentirane izjeme: site-survey kartica z transition-all + notification
//   kartici — hover:-translate-y družina, NE CTA press-družina).
//
// Tehnika dokazov (r234/r235/r236 vzorec): bajtni dokazi na bufferju (%PDF
// magija, %%EOF, determinizem); vsebinski dokazi na VIRU liba/komponente
// (PDF content stream je fontno kodiran — izvleka teksta iz bajtov NI
// resnična).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildCenikPdfDoc,
  cenikPdfFilename,
  cenikDatumIso,
  preveriCenikPdfVnos,
  artikelBeseda,
  cenaBeseda,
  type CenikPdfVnos,
} from '@/lib/cenik-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med dvema markerjema (r207/r233 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const material = beri('src/components/roksal/material-intelligence-tab.tsx')
const dashboard = beri('src/components/roksal/dashboard-tab.tsx')
const team = beri('src/components/roksal/team-tab.tsx')
const measurements = beri('src/components/roksal/measurements-tab.tsx')
const lib = beri('src/lib/cenik-pdf.ts')
const mpRoute = beri('src/app/api/material-prices/route.ts')

const ZDANJ: Date = new Date(2026, 8, 28, 10, 0, 0) // fiksen vhod — determinizem

// ŠČŽ niz + dve ceni ISTEGA artikla (dokaz več-ključnega sorta) + opomba
// null (prazna celica — nikoli izmišljen '—').
const CENE: CenikPdfVnos[] = [
  {
    artikel: 'Inox palica 40×40',
    sifra: 'WPC-120-A',
    enota: 'm',
    dobavitelj: 'Inox Trade d.o.o.',
    cena: 12.5,
    opomba: 'akcijska cena',
    vpisan: '2026-09-01T08:00:00.000Z',
  },
  {
    artikel: 'Inox palica 40×40',
    sifra: 'WPC-120-A',
    enota: 'm',
    dobavitelj: 'ŠČŽ Žaga d.o.o.',
    cena: 11.9,
    opomba: null,
    vpisan: '2026-08-15T08:00:00.000Z',
  },
  {
    artikel: 'Aluminijasti profil 25 mm',
    sifra: 'ALU-025-B',
    enota: 'kos',
    dobavitelj: 'Alu Center d.o.o.',
    cena: 4.35,
    opomba: undefined,
    vpisan: '2026-09-20T08:00:00.000Z',
  },
  {
    artikel: 'Betonska podlaga 80×80',
    sifra: 'BET-080-C',
    enota: 'kos',
    dobavitelj: 'Gradbeni material d.o.o.',
    cena: 2,
    opomba: '',
    vpisan: '2026-07-11T08:00:00.000Z',
  },
]

function zgradi(vnosi: readonly CenikPdfVnos[] = CENE, now: Date = ZDANJ): Buffer {
  const doc = buildCenikPdfDoc(vnosi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R244 — cenik-pdf lib (družina dobavitelji-pdf R236, sal 0x41–0x44)', () => {
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

  it('sort V LIBU: premešan vrstni red ISTE množice = bajtno ISTI dokument (determinizem = f(množica), ne f(vrstnega reda odgovora))', () => {
    const naravni = zgradi(CENE)
    const premesano = zgradi([...CENE].reverse())
    expect(naravni.equals(premesano)).toBe(true)
  })

  it('skupni red je STROG: artikel asc → cena asc → dobavitelj asc → opomba asc (vir liba)', () => {
    // Ista sort logika mora postaviti cenejšo ponudbo ISTEGA artikla NAD dražjo
    // (nov vnos API-ja s createdAt desc ne sme prelomiti determinizma nabora).
    const sortirane = [...CENE].sort((a, b) => {
      if (a.artikel !== b.artikel) return a.artikel < b.artikel ? -1 : 1
      if (a.cena !== b.cena) return a.cena - b.cena
      if (a.dobavitelj !== b.dobavitelj) return a.dobavitelj < b.dobavitelj ? -1 : 1
      const oa = typeof a.opomba === 'string' ? a.opomba : ''
      const ob = typeof b.opomba === 'string' ? b.opomba : ''
      if (oa !== ob) return oa < ob ? -1 : 1
      return 0
    })
    expect(sortirane[0].artikel).toBe('Aluminijasti profil 25 mm') // 'A' < 'B' < 'I'
    // cenejša ponudba ISTEGA artikla je NAD dražjo (nov vnos API-ja s
    // createdAt desc ne sme prelomiti determinizma nabora)
    expect(sortirane[2].artikel).toBe('Inox palica 40×40')
    expect(sortirane[2].dobavitelj).toBe('ŠČŽ Žaga d.o.o.') // 11.90 < 12.50
    expect(sortirane[2].cena).toBe(11.9)
    expect(sortirane[3].dobavitelj).toBe('Inox Trade d.o.o.')
    expect(sortirane[3].cena).toBe(12.5)
    // vir: sortiranje se ZGODI v libu (NIKOLI v komponenti — ENA resnica)
    expect(lib).toContain('function sortirajCenik(')
    expect(lib).toContain('const sortirane = sortirajCenik(vnosi)')
  })

  it('prazen seznam ne nastaja dokumenta (TypeError — ni prazne datoteke, R232–R236 družina)', () => {
    expect(() => buildCenikPdfDoc([], { now: ZDANJ })).toThrow(TypeError)
    expect(() => buildCenikPdfDoc([], { now: ZDANJ })).toThrow(/prazen seznam/)
  })

  it('pokvaren now → TypeError (determinizem ni tišina)', () => {
    expect(() => buildCenikPdfDoc(CENE, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => buildCenikPdfDoc(CENE, { now: undefined as unknown as Date })).toThrow(TypeError)
  })

  it('ime datoteke: Cenik-materiala-YYYY-MM-DD.pdf iz ISTEGA now (žig IN ime — lekcija R121/R235)', () => {
    expect(cenikPdfFilename(ZDANJ)).toBe('Cenik-materiala-2026-09-28.pdf')
  })

  it('cenikDatumIso: čista prevrastava niza (brez časovnih con) + zavrača ne-ISO (fail-closed)', () => {
    expect(cenikDatumIso('2026-09-01T08:00:00.000Z')).toBe('01.09.2026')
    expect(cenikDatumIso('2026-09-01')).toBe('01.09.2026')
    expect(() => cenikDatumIso('ne-datum')).toThrow(TypeError)
    expect(() => cenikDatumIso('')).toThrow(TypeError)
  })

  it('preveriCenikPdfVnos: indeks krivca je VEDNO v sporočilu (artikel/sifra/enota/dobavitelj/cena/vpisan)', () => {
    expect(() => preveriCenikPdfVnos({ ...CENE[0], artikel: '  ' }, 3)).toThrow(/\(3\)/)
    expect(() => preveriCenikPdfVnos({ ...CENE[0], sifra: '' }, 2)).toThrow(/\(2\).*sifra/)
    expect(() => preveriCenikPdfVnos({ ...CENE[0], enota: undefined as unknown as string }, 1)).toThrow(/\(1\).*enota/)
    expect(() => preveriCenikPdfVnos({ ...CENE[0], dobavitelj: null as unknown as string }, 0)).toThrow(/\(0\).*dobavitelj/)
    expect(() => preveriCenikPdfVnos({ ...CENE[0], cena: -1 }, 5)).toThrow(/\(5\).*cena/)
    expect(() => preveriCenikPdfVnos({ ...CENE[0], cena: Number.NaN }, 5)).toThrow(/cena/)
    expect(() => preveriCenikPdfVnos({ ...CENE[0], vpisan: '1.9.2026' }, 4)).toThrow(/\(4\).*vpisan/)
  })

  it('preveriCenikPdfVnos: opomba null/undefined/string = VSE veljavne (prazna celica, ne napaka)', () => {
    expect(() => preveriCenikPdfVnos(CENE[1], 0)).not.toThrow() // null
    expect(() => preveriCenikPdfVnos(CENE[2], 0)).not.toThrow() // undefined
    expect(() => preveriCenikPdfVnos(CENE[3], 0)).not.toThrow() // ''
    expect(() => preveriCenikPdfVnos({ ...CENE[0], opomba: 5 as unknown as string }, 0)).toThrow(/opomba/)
  })

  it('slovenska sklanjatev: artikelBeseda + cenaBeseda (1/2/3-4/5+)', () => {
    expect(artikelBeseda(1)).toBe('artikel')
    expect(artikelBeseda(2)).toBe('artikla')
    expect(artikelBeseda(3)).toBe('artikli')
    expect(artikelBeseda(5)).toBe('artiklov')
    expect(cenaBeseda(1)).toBe('cena')
    expect(cenaBeseda(2)).toBe('ceni')
    expect(cenaBeseda(4)).toBe('cene')
    expect(cenaBeseda(9)).toBe('cen')
    expect(() => artikelBeseda(-1)).toThrow(TypeError)
    expect(() => cenaBeseda(1.5)).toThrow(TypeError)
  })

  it('LASTNI soli 0x41–0x44 (brez kolizij z brati: zaloga 0x01–04, naročilnica 0x11–14, dobavitelji 0x21–24, osnutek 0x31–34)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x41)')
    expect(lib).toContain('fnv1aHex(seed, 0x42)')
    expect(lib).toContain('fnv1aHex(seed, 0x43)')
    expect(lib).toContain('fnv1aHex(seed, 0x44)')
    expect(lib).not.toContain('0x21)')
    expect(lib).not.toContain('0x31)')
  })

  it('KPI se RAČUNAJO iz vrstic (artikli/cene/razpon) — NIKOLI izmišljeni števci (notranja skladnost)', () => {
    expect(lib).toContain('const artikli = new Set(')
    expect(lib).toContain('const najnizja = Math.min(')
    expect(lib).toContain('const najvisja = Math.max(')
    // Iskren podpis: samo veljavne cene (route filtrira veljavnostDo: null)
    expect(lib).toContain('samo trenutno veljavne cene')
  })

  it('cena kot stabilen niz na 2 decimalni mesti (String(2.5) = "2.5" bi bila druga resnica kot 2.50)', () => {
    expect(lib).toContain('function cenaNiz(c: number): string {')
    expect(lib).toContain('c.toFixed(2)')
  })
})

describe('R244 — cenik CSV + pilli v material-intelligence-tab', () => {
  it('downloadCenikCsv: ISTI prerez stolpcev kot PDF (Artikel, Šifra, Enota, Dobavitelj, Cena (EUR/enota), Opomba, Vpisan)', () => {
    const fn = oknoMed(material, 'function downloadCenikCsv', '// R207 — stil statusnega filtra')
    expect(fn).not.toBe('')
    expect(fn).toContain("'Artikel', 'Šifra', 'Enota', 'Dobavitelj', 'Cena (EUR/enota)', 'Opomba', 'Vpisan'")
    // ISTI stolpci v PDF tabeli (ENA resnica čez brata)
    expect(lib).toContain("head: [['Artikel', 'Šifra', 'Enota', 'Dobavitelj', 'Cena (EUR/enota)', 'Opomba', 'Vpisan']]")
    // vir CSV: /api/material-prices + prazna opomba (NIKOLI '—')
    expect(fn).toContain('c.opomba ?? ')
    expect(fn).toContain('cenikDatumIso(c.createdAt)')
  })

  it('CSV ime = ISTA zgodba kot PDF ime (Cenik-materiala-…)', () => {
    const fn = oknoMed(material, 'function downloadCenikCsv', '// R207 — stil statusnega filtra')
    expect(fn).toContain('`Cenik-materiala-${todayStamp()}.csv`')
  })

  it('cenikVnosi: fail-closed preslikava — pokvarjena oblika API odgovora → TypeError z indeksom (nič izmišljenih polj)', () => {
    const fn = oknoMed(material, 'function cenikVnosi', '// R207 — stil statusnega filtra')
    expect(fn).toContain('manjkajoči inventory/supplier v odgovoru API-ja')
    expect(fn).toContain('typeof c !== \'object\' || !c.inventory || !c.supplier')
  })

  it('pilli: aria-label + ISTI pill razredi kot Dobavitelji (h-8 text-xs CSV / h-6 gap-1 text-2xs PDF + press-scale)', () => {
    expect(material).toContain('aria-label="Izvozi cenik materiala kot CSV"')
    expect(material).toContain('aria-label="Izvozi cenik materiala kot PDF"')
    const csvPill = oknoMed(material, 'Izvozi cenik materiala kot CSV', 'Izvozi cenik materiala kot PDF')
    expect(csvPill).toContain('h-8 text-xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1')
    // R245 sinhronizacija: izvozna skupina na Cene kartici je dobila notranji
    // ovojnici (space-y-1.5 + drugi pill par + legenda) — pilli so se legitimo
    // premaknili za eno nivo globje (18/16 presledkov); vsebina razredov je
    // NESPREMENJENA (lekcija r172: pin preverjen proti HEAD vsebini).
    const pdfPill = oknoMed(material, 'Izvozi cenik materiala kot PDF', '</Button>\n                </div>')
    expect(pdfPill).toContain('h-6 gap-1 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1')
  })

  it('pilli VEDNO vidni (bralni tok, P1-k precedens) — NISO znotraj lahkoUrejaCene veje', () => {
    const ceneKartica = oknoMed(material, 'Cene materiala</CardTitle>', 'Izberi material za dodajanje cene')
    expect(ceneKartica).toContain('Izvozi cenik materiala kot CSV')
    expect(ceneKartica).not.toContain('lahkoUrejaCene')
  })

  it('fail-closed toasti: 0 cen → iskren naslov; !res.ok → HTTP status v opisu; pokvarjena oblika → TypeError razlog', () => {
    expect(material).toContain("'Ni vpisanih cen za izvoz'")
    expect(material).toContain('`GET /api/material-prices → HTTP ${res.status}`')
    expect(material).toContain("'Odgovora /api/material-prices ni mogoče prebrati (manjka polje prices).'")
    // fail-verbose destruktivna varianta (R241 vzorec)
    expect(material).toContain("'Cenik PDF ni mogoče sestaviti iz teh podatkov'")
  })

  it('cenikVTeku zavira dvoklik: disabled={loading || cenikVTeku} + guard if (cenikVTeku) return', () => {
    expect(material).toMatch(/disabled=\{loading \|\| cenikVTeku\}/)
    expect((material.match(/if \(cenikVTeku\) return/g) || []).length).toBe(2)
  })

  it('EN now za žig IN ime (determinizem — dva new Date() bi razdala žig in ime)', () => {
    const pdf = oknoMed(material, 'const handleCenikPdf', '  return (')
    expect((pdf.match(/new Date\(\)/g) || []).length).toBe(1)
  })

  it('API pogodba ostaja: GET /api/material-prices vraca samo veljavne cene z inventory+supplier (cenik je client-only potrošnik — route NIČ)', () => {
    expect(mpRoute).toContain('veljavnostDo: null, // samo trenutno veljavne')
    expect(mpRoute).toContain('include: { inventory: true, supplier: true }')
    // POST vrata price.override ostajajo (R243 wave 5) — izvoz jih NE dotika
    expect(mpRoute).toContain("'price.override'")
  })
})

describe('R244 — [Mandatory] stil: press-scale TOKEN pariteta (bespoke izkoreninjen)', () => {
  it("'Nov projekt' hero CTA nosi press-scale token (brez bespoke scale trice)", () => {
    const hero = oknoMed(dashboard, 'onClick={() => setNewProjectOpen(true)}', '</Button>')
    expect(hero).toContain('press-scale')
    expect(hero).not.toContain('active:scale-[0.98]')
    expect(hero).not.toContain('hover:scale-[1.02]')
    expect(hero).not.toContain('duration-200')
    // btn-shine (dekoracija) ostane — press je token, sijaj je poseben
    expect(hero).toContain('btn-shine')
  })

  it("'Shrani meritev' CTA (measurements) nosi press-scale token", () => {
    const cta = oknoMed(measurements, 'onClick={handleSubmitMeasurement}', '</Button>')
    expect(cta).toContain('press-scale')
    expect(cta).not.toContain('active:scale-[0.98]')
  })

  it('ekipa: Povabi + Ustvari povabilo + Skopirano — zapri nosijo press-scale (R243 dialog-CTA pariteta)', () => {
    const povabi = oknoMed(team, 'onClick={() => setInviteOpen(true)}', '</Button>')
    expect(povabi).toContain('press-scale')
    const ustvari = oknoMed(team, 'onClick={() => void submitInvite()}', '</Button>')
    expect(ustvari).toContain('press-scale')
    const zapri = oknoMed(team, 'onClick={() => setOneTime(null)}', '</Button>')
    expect(zapri).toContain('press-scale')
  })

  it('nikjer več bespoke active:scale-[0.98] na navy/amber CTA vrstici (dokumentirane izjeme: site-survey 1 + notification kartici 2 = hover:-translate-y družina)', () => {
    const vsi = [material, dashboard, team, measurements]
    for (const src of vsi) {
      for (const vrstica of src.split('\n')) {
        if (vrstica.includes('active:scale-[0.98]')) {
          const jeNavyAmberCta =
            vrstica.includes('bg-roksal-navy') || vrstica.includes('bg-roksal-amber')
          expect(jeNavyAmberCta).toBe(false)
        }
      }
    }
  })
})
