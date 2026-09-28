// ---------------------------------------------------------------------------
// R250 — PRIHODKI PDF poročilo (7. člen 'izvozi' družine, P1-f/g) — testi.
// Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; %PDF- magija;
// glifni razred minute — R249 doktrina) + vsebinski dokazi na VIRU liba in
// komponente (oknoMed; PDF content stream je fontno kodiran — izvleka teksta
// iz bajtov NI resnična).
// WYSIWYG dokazi: ISTA agregatna izpeljava (prihodkiPovzetek) kot summary
// izpeljanka invoice-manager (izdano = IZDAN+PLACAN, plačano = PLACAN,
// odprto = max(0, izdano−plačano), zapadlo = IZDAN prek roka — zapadlaDni
// vzorec z now KOT PARAMETER namesto Date.now()).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildPrihodkiPdfDoc,
  prihodkiPdfFilename,
  prihodkiPovzetek,
  preveriPrihodkiVnos,
  sortirajPrihodki,
  zapadlaDniVnos,
  type PrihodkiPdfVnos,
} from '@/lib/prihodki-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med dvema markerjema (r207/r233/r244/r245 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/prihodki-pdf.ts')
const komponenta = beri('src/components/roksal/invoice-manager.tsx')
const primerjalniLib = beri('src/lib/primerjalni-cenik-pdf.ts')
const cenikLib = beri('src/lib/cenik-pdf.ts')

const ZDANJ: Date = new Date(2026, 8, 28, 15, 0, 0) // fiksen vhod — determinizem

// EN račun = ENA vrstica; pokrije vsa stanja + zapadlost + storno + osnutek.
// ŠČŽ niz za fontni + sortni dokaz.
const VRSTE: PrihodkiPdfVnos[] = [
  {
    stevilka: '2026-001',
    tip: 'RACUN',
    status: 'PLACAN',
    datumIzdaje: '2026-09-01T10:00:00.000Z',
    rokPlacilaDni: 8,
    placanoAt: '2026-09-05T12:00:00.000Z',
    znesek: 1499.99,
    kupec: 'ŠČŽ Gradnja d.o.o.',
    projekt: 'Ograja Kranj',
  },
  {
    stevilka: '2026-002',
    tip: 'RACUN',
    status: 'IZDAN',
    datumIzdaje: '2026-09-19T10:00:00.000Z',
    rokPlacilaDni: 8, // rok 27.09. → 28.09. = 1 dan prek roka (ZAPADL)
    placanoAt: null,
    znesek: 250,
    kupec: 'Alu Center d.o.o.',
    projekt: 'Balustrada Ljubljana',
  },
  {
    stevilka: '2026-003',
    tip: 'PREDRACUN',
    status: 'IZDAN',
    datumIzdaje: '2026-09-27T10:00:00.000Z',
    rokPlacilaDni: 8, // rok 5.10. → NE zapadl
    placanoAt: null,
    znesek: 380,
    kupec: 'Gradbeni material d.o.o.',
    projekt: 'Vrata Domžale',
  },
  {
    stevilka: '2026-004',
    tip: 'RACUN',
    status: 'STORNIRAN',
    datumIzdaje: '2026-09-10T10:00:00.000Z',
    rokPlacilaDni: 8,
    placanoAt: null,
    znesek: 999.99,
    kupec: 'Storno Kupec s.p.',
    projekt: 'Storno projekt',
  },
  {
    stevilka: '2026-005',
    tip: 'PREDPLACILNI',
    status: 'OSNUTEK',
    datumIzdaje: '2026-09-28T10:00:00.000Z',
    rokPlacilaDni: 8,
    placanoAt: null,
    znesek: 120,
    kupec: 'Osnutek Kupec d.o.o.',
    projekt: 'Osnutek projekt',
  },
]

function zgradi(vnosi: readonly PrihodkiPdfVnos[] = VRSTE, now: Date = ZDANJ): Buffer {
  const doc = buildPrihodkiPdfDoc(vnosi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R250 — prihodkiPovzetek: ENA agregatna izpeljava (WYSIWYG s summary izpeljanko invoice-manager)', () => {
  it('izdano/plačano/odprto/zapadlo — točne vsote + premešan vrstni red = ISTI rezultat (sort interno — determinizem f(množica), FP seštevanje je od vrstnega reda)', () => {
    const pov = prihodkiPovzetek(VRSTE, ZDANJ)
    // izdano = IZDAN + PLACAN: 1499.99 + 250 + 380 = 2129.99
    expect(pov.izdano).toBeCloseTo(2129.99, 6)
    // plačano = PLACAN: 1499.99
    expect(pov.placano).toBeCloseTo(1499.99, 6)
    // odprto = max(0, izdano − plačano) = 250 + 380 = 630 (ISTO kot UI 'Odprto')
    expect(pov.odprto).toBeCloseTo(630, 6)
    // zapadlo = IZDAN prek roka: samo 2026-002 (rok 27.09., danes 28.09.)
    expect(pov.zapadlo).toBeCloseTo(250, 6)
    expect(pov.zapadloN).toBe(1)
    expect(pov.osnutki).toBe(1)
    expect(pov.stornirani).toBe(1)
    expect(pov.vseh).toBe(5)
    // premešan red = ISTI rezultat (toBeCloseTo …, 10 — vzorec R248)
    const pmesano = prihodkiPovzetek([...VRSTE].reverse(), ZDANJ)
    expect(pmesano.izdano).toBeCloseTo(pov.izdano, 10)
    expect(pmesano.zapadlo).toBeCloseTo(pov.zapadlo, 10)
  })

  it('zapadlaDniVnos: ISTI vzorec kot zapadlaDni UI (IZDAN only; diff = floor, > 0 strogo) z now KOT PARAMETER — rob točno na meji', () => {
    const izdan = VRSTE[1]
    // rok = 19.09. + 8 dni = 27.09. 10:00 UTC; ZDANJ = 28.09. 15:00 → 1.2 dni → floor 1
    expect(zapadlaDniVnos(izdan, ZDANJ)).toBe(1)
    // točno na roku (due == now) → NI zapadl (diff 0, > 0 strogo — ISTO kot UI)
    const naDan = new Date(2026, 8, 27, 10, 0, 0)
    expect(zapadlaDniVnos(izdan, naDan)).toBeNull()
    // PLACAN in STORNIRAN in OSNUTEK NIKOLI zapadl (ISTO kot UI: status !== 'IZDAN' → null)
    expect(zapadlaDniVnos(VRSTE[0], ZDANJ)).toBeNull()
    expect(zapadlaDniVnos(VRSTE[3], ZDANJ)).toBeNull()
    expect(zapadlaDniVnos(VRSTE[4], ZDANJ)).toBeNull()
  })

  it('sortirajPrihodki: ŠTEVILKA ASC (računovodski red) — premešan vhod = ISTI red (f(množica), localeCompare NIČ)', () => {
    const sortirane = sortirajPrihodki([...VRSTE].reverse())
    expect(sortirane.map((p) => p.stevilka)).toEqual(['2026-001', '2026-002', '2026-003', '2026-004', '2026-005'])
  })

  it('odprto = max(0, izdano − plačano): FP podtek je brez pomena (zneski ≥ 0) — max(0,·) je VEDNO resnica (dokaz izbire v viru)', () => {
    expect(lib).toContain('povzetek.odprto = Math.max(0, povzetek.izdano - povzetek.placano)')
  })
})

describe('R250 — fail-closed: pokvaren vnos → TypeError z indeksom krivca (NIKOLI izmišljen dokument)', () => {
  it('statusna inkonzistenca: PLACAN brez placanoAt → TypeError; placanoAt na ne-PLACAN → TypeError (API zagotavlja — odklon = pokvaren vir)', () => {
    const brezPlacila = [{ ...VRSTE[0], placanoAt: null }]
    expect(() => preveriPrihodkiVnos(brezPlacila[0], 0)).toThrow(TypeError)
    expect(() => preveriPrihodkiVnos(brezPlacila[0], 0)).toThrow(/PLACAN brez placanoAt/)
    // build (dokument) validira vrstice — indeks krivca (0) v sporocilu:
    expect(() => buildPrihodkiPdfDoc(brezPlacila, { now: ZDANJ })).toThrow(/\(0\).*PLACAN brez placanoAt/)
    const sPlacilomNaIzdanem = [{ ...VRSTE[1], placanoAt: '2026-09-28T10:00:00.000Z' }]
    expect(() => preveriPrihodkiVnos(sPlacilomNaIzdanem[0], 0)).toThrow(/placanoAt na statusu IZDAN/)
  })

  it('pokvarjena polja: prazen kupec, neznani status, ne-ISO datum, negativen znesek, pokvarjen rok — indeks krivca VEDNO v sporočilu', () => {
    expect(() => preveriPrihodkiVnos({ ...VRSTE[0], kupec: '  ' }, 3)).toThrow(/\(3\).*kupec/)
    expect(() => preveriPrihodkiVnos({ ...VRSTE[0], status: 'NEZNAN' as never }, 2)).toThrow(/status mora biti eden iz/)
    expect(() => preveriPrihodkiVnos({ ...VRSTE[0], datumIzdaje: '28.09.2026' }, 1)).toThrow(/datumIzdaje mora biti ISO niz/)
    expect(() => preveriPrihodkiVnos({ ...VRSTE[0], znesek: -1 }, 4)).toThrow(/\(4\).*znesek/)
    expect(() => preveriPrihodkiVnos({ ...VRSTE[0], rokPlacilaDni: 1.5 }, 5)).toThrow(/rokPlacilaDni mora biti celo število/)
  })

  it('prazen seznam ne nastaja dokumenta (družina: ni prazne datoteke) — TypeError z iskrenim sporočilom', () => {
    expect(() => buildPrihodkiPdfDoc([], { now: ZDANJ })).toThrow(TypeError)
    expect(() => buildPrihodkiPdfDoc([], { now: ZDANJ })).toThrow(/prazen seznam ne nastaja dokumenta/)
    expect(lib).toContain('Ni računov za prihodke')
  })
})

describe('R250 — PDF bajtni dokazi (determinizem + glifni razred minute — R249 doktrina)', () => {
  it('determinizem: enak vhod + enak now = bajtno enak PDF (document-pdf R121 100× pravilo)', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    // drugačen now → drugačen CreationDate → drugačen dokument (žig je vsebinski)
    expect(zgradi(VRSTE, ZDANJ).equals(zgradi(VRSTE, new Date(2026, 8, 28, 15, 1, 0)))).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh znanih družinskih razredov) + ime datoteke Prihodki-YYYY-MM-DD.pdf', () => {
    const buf = zgradi()
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    // znani razredi: Osnutek [30057,30119,30191,30253], primerjalni [35565,
    // 38753,39927,41519,42798], cenik [37709,37771] — prihodki je NOV dokument
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771]
    expect(znani.includes(buf.length)).toBe(false)
    expect(prihodkiPdfFilename(ZDANJ)).toBe('Prihodki-2026-09-28.pdf')
  })

  it('soli 0x61–0x64 — UNIKATNE v družini (isti seed v dveh libih NE sme dati isti ID — register)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x61)')
    expect(lib).toContain('fnv1aHex(seed, 0x64)')
    // sorojenci NE smejo deliti 0x61–0x64 (cenik 0x41–44, primerjalni 0x51–54)
    expect(cenikLib).not.toContain('0x61')
    expect(primerjalniLib).not.toContain('0x61')
  })
})

describe('R250 — PDF telesu skozi izpeljavo (KPI + tabela + sklep iz ISTEGA vira)', () => {
  it('KPI vrsta: Računov < Plačano < Odprto < Zapadlo < Osnutki + signal barve (odprto amber > 0, zapadlo RED > 0 — ISTI trikot kot Povzetek boxi)', () => {
    const kpi = oknoMed(lib, "kpiBox(doc, 14, y, bw, bh, 'Računov'", 'y += bh + 8')
    expect(kpi).toContain("'Plačano'")
    expect(kpi).toContain("'Odprto'")
    expect(kpi).toContain("'Zapadlo'")
    expect(kpi.indexOf("'Računov'")).toBeLessThan(kpi.indexOf("'Osnutki'"))
    expect(lib).toContain("pov.odprto > 0 ? AMBER : NAVY")
    expect(lib).toContain("pov.zapadlo > 0 ? RED : NAVY")
  })

  it('tabela: 8 stolpcev (Številka, Tip, Izdano, Rok, Kupec, Projekt, Status, Znesek (EUR)) + zapadl status nosi dni resnico', () => {
    expect(lib).toContain("['Številka', 'Tip', 'Izdano', 'Rok', 'Kupec', 'Projekt', 'Status', 'Znesek (EUR)']")
    expect(lib).toContain("STATUSI_SI[p.status] + (dni !== null ? ` (${dni} dni)` : '')")
  })

  it('sklepni podpis pove ISKRENO resnico (izdano/odprto/plačano/zapadlo + stornirani izključeni + osnutki)', () => {
    const sklep = oknoMed(lib, 'sklepna vrstica', 'noge na vseh straneh')
    expect(sklep).toContain('računov prek roka')
    expect(sklep).toContain('storniranih')
    expect(sklep).toContain('(izključeni iz zneskov)')
    expect(sklep).toContain('osnutkov')
  })
})

describe('R250 — komponenta: pill + legenda + toast (WYSIWYG, ENA resnica na treh mestih)', () => {
  it('pill: aria + title + press-scale token + FileDown (ISTI žetoni kot CSV pill — 0 novih hex)', () => {
    expect(komponenta).toContain('aria-label="Izvozi prihodke kot PDF"')
    expect(komponenta).toContain('Prihodki, terjatve in zapadli računi kot pravi PDF')
    const pill = oknoMed(komponenta, 'Izvozi račune kot CSV', "aria-label=\"Izvozi prihodke kot PDF\"")
    expect(pill).toContain('{/* R250')
    expect(komponenta).toContain('disabled={prihodkiVTeku}')
  })

  it('toast nosi REALNO agregatno resnico (plačano/odprto/zapadlo iz prihodkiPovzetek) — ločilo "," (minifier ubeži · v template literalih, R248 lekcija)', () => {
    expect(komponenta).toContain('prihodkiPovzetek(vnosi, now)')
    expect(komponenta).toContain('Prihodki prenešeni v PDF')
    // template deli NE smejo prečkati '·' — ločilo je ',' (čanki med ${})
    expect(komponenta).toContain(' €, odprto ')
    expect(komponenta).toContain(' €, zapadlo ')
  })

  it('fail-closed poti: 0 računov → iskren toast; TypeError → viden razlog (nič tihega degradiranja)', () => {
    expect(komponenta).toContain("'Ni računov za prihodke'")
    expect(komponenta).toContain('Prihodki PDF ni mogoče sestaviti iz teh podatkov')
  })

  it('bralni dokument — brez pravice gate (P1-k precedens): pill NI gated na invoices.* (vsi, ki vidijo Račune, nosijo invoices.read)', () => {
    const pill = oknoMed(komponenta, 'Izvozi prihodke kot PDF', '</Button>')
    expect(pill).not.toContain('lahkoUstvarja')
    expect(pill).not.toContain('lahkoIzdaja')
    // dvoklik guard obstaja (družinski vzorec)
    expect(komponenta).toContain('if (prihodkiVTeku) return')
  })

  it('legenda imenuje ISTO izpeljavo (CSV vrstice, PDF povzetek, Odprto, Zapadlo) — žetoni text-2xs text-muted-foreground', () => {
    expect(komponenta).toContain('CSV = vsi računi (vrstice) · PDF = povzetek za vodstvo')
    expect(komponenta).toContain('· Odprto = izdano, neplačano · Zapadlo = prek roka')
  })
})

describe('R250 — ločeni dokumenti se še naprej obrestujejo (družinska bajtna stabilnost)', () => {
  it('R136 racuni CSV brat NEspremenjen (isti klic, ime datoteke racuni-, brez prihodkove libi)', () => {
    expect(komponenta).toContain("racuni-${todayStamp()}.csv")
    expect(komponenta).toContain('aria-label="Izvozi račune kot CSV"')
  })

  it('cenik/primerjalni bratje NE poznajo prihodkov (ločeni dokumenti — bajtna stabilnost nedotaknjena)', () => {
    expect(cenikLib).not.toContain('prihodkiPovzetek')
    expect(primerjalniLib).not.toContain('prihodkiPovzetek')
    expect(cenikLib).not.toContain('Prihodki-')
    expect(primerjalniLib).not.toContain('Prihodki-')
  })
})
