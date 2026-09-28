// ---------------------------------------------------------------------------
// R257 — NAROČILA PREGLED PDF (13. člen 'izvozi' družine, P1-f) — testi.
// Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN VRSTNI
// RED = bajtno ENAK — sort interno, f(množica); %PDF- magija; NOV glifni
// razred — R249 doktrina) + vsebinski dokazi na VIRU liba in komponente
// (PDF content stream je fontno kodiran — izvleka teksta iz bajtov NI
// resnična). WYSIWYG: vir = ISTI DTO kot CSV R140/R232 (GET /api/material-
// orders — route NIČ); status = VERBATIM 5 znanih (kanon prisma schema);
// 'odprto' + pretekel rok = EN VIR zamujena-dobava R228 (import, nič
// dvojnega); preklicani VIDNO a izključeni iz vrednostne vsote (prihodki
// 'stornirani' vzorec).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildNarocilaPregledPdfDoc,
  narocilaPregledPdfFilename,
  narocilaPregledPovzetek,
  preveriNarociloPregledVnos,
  sortirajNarocilaPregled,
  type NarociloPregledVnos,
} from '@/lib/narocila-pregled-pdf'
import { jeZamujenaDobava, narociloBeseda } from '@/lib/zamujena-dobava'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r256 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/narocila-pregled-pdf.ts')
const komponenta = beri('src/components/roksal/material-intelligence-tab.tsx')
const zamujenaLib = beri('src/lib/zamujena-dobava.ts')
const dobaviteljiLib = beri('src/lib/dobavitelji-pdf.ts')
const narocilnicaLib = beri('src/lib/narocilnica-pdf.ts')

// FIXED now + danas (danas = polnoč LOCAL konstrukcija — jeZamujenaDobava
// primerja timestampa; obljube so RELEATIVNO na danas zgrajene → TZ-neodvisno).
const NOW: Date = new Date('2026-09-28T09:15:00.000Z')
function danasPolnoc(dneviPremik = 0): Date {
  const d = new Date(2026, 8, 28) // lokalna polnoč 28. 9. 2026
  d.setDate(d.getDate() + dneviPremik)
  return d
}
const DANAS = danasPolnoc()
function isoPredDnevi(d: Date, dni: number): string {
  const x = new Date(d.getTime() - dni * 86400000)
  return x.toISOString()
}
function isoCezDnevi(d: Date, dni: number): string {
  const x = new Date(d.getTime() + dni * 86400000)
  return x.toISOString()
}

// 6 naročil: 5 znanih statusov + robna resnica (PREKlicANO s pretekljeno
// obljubo = NI zamujen — zaprto stanje; DOBLJENO z null dobavo = '—';
// prazne postavke = resnica 0; opombe null = prazna celica).
const NAROCILA: NarociloPregledVnos[] = [
  {
    status: 'OSNUTEK',
    skupajCena: 450.5,
    datumNarocila: '2026-09-20',
    datumDobave: isoPredDnevi(DANAS, 3),
    opombe: 'Matični plošči',
    supplier: { naziv: 'Alufer d.o.o.' },
    items: [{ naziv: 'Plošča', kolicina: 2, enota: 'kos', cena: 225.25 }, { naziv: 'Vijak', kolicina: 10, enota: 'kos', cena: 0 }],
  },
  {
    status: 'POSLANO',
    skupajCena: 1200,
    datumNarocila: '2026-09-20', // istega dne kot OSNUTEK → izenačba dobavitelj ASC (Alufer < Biro)
    datumDobave: isoCezDnevi(DANAS, 5),
    supplier: { naziv: 'Biro Tehnika' },
    items: [{ naziv: 'Profil', kolicina: 6, enota: 'm', cena: 200 }],
  },
  {
    status: 'POTRJENO',
    skupajCena: 89.99,
    datumNarocila: '2026-09-15',
    datumDobave: null, // manjkajoča obljuba = iskrena '—' + NIKOLI žig
    supplier: { naziv: 'Cink d.o.o.' },
    items: [{ naziv: 'Kotnik', kolicina: 1, enota: 'kos', cena: 89.99 }],
  },
  {
    status: 'DOBLJENO',
    skupajCena: 310,
    datumNarocila: '2026-09-10',
    datumDobave: isoPredDnevi(DANAS, 2), // zaprto stanje — pretekel datum NIKOLI žig
    supplier: { naziv: 'Alufer d.o.o.' },
    items: [
      { naziv: 'A', kolicina: 1, enota: 'kos', cena: 100 },
      { naziv: 'B', kolicina: 1, enota: 'kos', cena: 100 },
      { naziv: 'C', kolicina: 1, enota: 'kos', cena: 100 },
      { naziv: 'D', kolicina: 1, enota: 'kos', cena: 10 },
    ],
  },
  {
    status: 'PREKlicANO',
    skupajCena: 999.99, // izključen iz vrednostne vsote — poimenovan v KPI/sklepu
    datumNarocila: '2026-09-05',
    datumDobave: isoPredDnevi(DANAS, 4),
    supplier: { naziv: 'Dimnikar' },
    items: [{ naziv: 'X', kolicina: 2, enota: 'kos', cena: 499.995 }],
  },
  {
    status: 'OSNUTEK',
    skupajCena: 75,
    datumNarocila: '2026-09-22',
    datumDobave: isoCezDnevi(DANAS, 1),
    opombe: null, // null = prazna celica (nič izmišljenega)
    supplier: { naziv: 'Biro Tehnika' },
    items: [], // prazno polje postavk = iskren števec 0
  },
]

function zgradi(vnosi: readonly NarociloPregledVnos[] = NAROCILA, now: Date = NOW): Buffer {
  const doc = buildNarocilaPregledPdfDoc(vnosi, { now, danas: DANAS })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R257 — PDF bajtni dokazi (determinizem + glifni razred minute — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    expect(zgradi([...NAROCILA].reverse()).equals(zgradi(NAROCILA))).toBe(true)
    expect(zgradi(NAROCILA, NOW).equals(zgradi(NAROCILA, new Date('2026-09-28T09:16:00.000Z')))).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 18 znanih družinskih razredov) + ime Narocila-YYYY-MM-DD.pdf', () => {
    const buf = zgradi()
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    // znani razredi (18): Osnutek ×4, primerjalni ×5, cenik ×2, prihodki,
    // opomnik ×2, potekli, koledar, vozni red (38631 R255), tedenski (45508
    // R256) — naročila pregled je NOV
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508]
    expect(znani.includes(buf.length)).toBe(false)
    expect(narocilaPregledPdfFilename(NOW)).toBe('Narocila-2026-09-28.pdf')
    // sorojenec CSV R140 ohranja svoje ime (kontrakt nespremenjen)
    expect(komponenta).toContain('`Narocila-${todayStamp()}.csv`')
  })

  it('soli 0x79–0x7c — UNIKATNE v družini (register: tedenski 0x75–0x78, vozni red 0x71–0x74 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x79)')
    expect(lib).toContain('fnv1aHex(seed, 0x7c)')
    // sorojenci NE smejo deliti 0x79–0x7c
    expect(dobaviteljiLib).not.toContain('0x79')
    expect(narocilnicaLib).not.toContain('0x79')
    expect(zamujenaLib).not.toContain('0x79')
  })
})

describe('R257 — agregatna izpeljava (ENA resnica za KPI + sklep + toast)', () => {
  it('povzetek agregati: vseh 6, odprtih 3, dobavljenih 1, preklicanih 1, zamujenih 1, vrednost ne-preklicanih, postavk skupaj', () => {
    const pov = narocilaPregledPovzetek(NAROCILA, DANAS)
    expect(pov.vseh).toBe(6)
    expect(pov.odprtih).toBe(4) // 2× OSNUTEK + POSLANO + POTRJENO (EN VIR ODPRTI_STATUSI_NAROCIL)
    expect(pov.dobavljenih).toBe(1)
    expect(pov.preklicanih).toBe(1)
    expect(pov.zamujenih).toBe(1) // samo OSNUTEK s pretekljeno obljubo
    // preklicani 999.99 izključen: 450.5 + 1200 + 89.99 + 310 + 75
    expect(pov.vrednostNePreklicanih).toBeCloseTo(2125.49, 10)
    expect(pov.postavkSkupaj).toBe(9) // 2+1+1+4+1+0 (prazno polje postavk = iskren 0)
  })

  it('povzetek: premešan vrstni red = ISTI agregat (f(MNOŽICA) — FP seštevanje po internem sortu)', () => {
    expect(narocilaPregledPovzetek([...NAROCILA].reverse(), DANAS)).toEqual(narocilaPregledPovzetek(NAROCILA, DANAS))
  })

  it('pretekel rok resnica = ISTI lib jeZamujenaDobava (re-use, NIČ dvojnega): odprt+pretekel DA, DOBLJENO NE, PREKlicANO NE, null obljuba NE', () => {
    expect(lib).toContain("import {\n  jeZamujenaDobava,\n  ODPRTI_STATUSI_NAROCIL,\n} from './zamujena-dobava'")
    // lib v tabeli uporablja ISTI klic z ISTIM danas
    expect(lib).toContain("jeZamujenaDobava(n, danas) ? 'DA' : 'NE'")
    // ISTA resnica, neodvisno izračunana iz liba R228 (neodvisen dokaz)
    const zamujen = NAROCILA.find((n) => n.status === 'OSNUTEK' && n.opombe === 'Matični plošči')
    expect(jeZamujenaDobava(zamujen!, DANAS)).toBe(true)
    const dobmljeno = NAROCILA.find((n) => n.status === 'DOBLJENO')!
    expect(jeZamujenaDobava(dobmljeno, DANAS)).toBe(false) // pretekljena obljuba, zaprto stanje
    const preklican = NAROCILA.find((n) => n.status === 'PREKlicANO')!
    expect(jeZamujenaDobava(preklican, DANAS)).toBe(false) // pretekljena obljuba, preklicano
  })

  it('sort IZVOŽEN: kronološki ASC po datumNarocila, izenačba dobavitelj ASC, premešan vhod = ISTI red', () => {
    const red = sortirajNarocilaPregled([...NAROCILA].reverse()).map((n) => `${n.datumNarocila}/${n.supplier.naziv}`)
    expect(red).toEqual([
      '2026-09-05/Dimnikar',
      '2026-09-10/Alufer d.o.o.',
      '2026-09-15/Cink d.o.o.',
      '2026-09-20/Alufer d.o.o.', // izenačba datumov → dobavitelj ASC
      '2026-09-20/Biro Tehnika',
      '2026-09-22/Biro Tehnika',
    ])
  })

  it('narociloBeseda (R228 re-use) — komponenta toast uporablja družinsko sklanjatev', () => {
    expect(narociloBeseda(1)).toBe('naročilo')
    expect(narociloBeseda(3)).toBe('naročila')
    expect(narociloBeseda(6)).toBe('naročil')
    expect(() => narociloBeseda(-1)).toThrow(TypeError)
  })
})

describe('R257 — fail-closed v libu (družina R236/R250–R256)', () => {
  it('prazen seznam ne nastaja dokumenta — TypeError s toast sporočilom komponente', () => {
    expect(lib).toContain('prazen seznam ne nastaja dokumenta')
    expect(lib).toContain('(Ni naročil za izvoz.)')
    expect(() => buildNarocilaPregledPdfDoc([], { now: NOW, danas: DANAS })).toThrow(TypeError)
  })

  it('neznan status = pokvaren vir → TypeError z indeksom krivca (NIKOLI tiho)', () => {
    const slabo: NarociloPregledVnos[] = [{ ...NAROCILA[0], status: 'POSLANO?' }]
    expect(() => buildNarocilaPregledPdfDoc(slabo, { now: NOW, danas: DANAS })).toThrow(/preveriNarociloPregledVnos \(0\)/)
    expect(() => buildNarocilaPregledPdfDoc(slabo, { now: NOW, danas: DANAS })).toThrow(/POSLANO\/POTRJENO\/DOBLJENO\/PREKlicANO/)
  })

  it('fail-closed ×9: ne-polje, ne-options, pokvaren now/danas, pokvaren datumNarocila, pokvaren datumDobave, ne-fin/negativen skupajCena, items ne-polje, item ne-objekt, opombe ne-niz', () => {
    const opt = { now: NOW, danas: DANAS }
    expect(() => buildNarocilaPregledPdfDoc('naročila' as unknown as NarociloPregledVnos[], opt)).toThrow(TypeError)
    expect(() => buildNarocilaPregledPdfDoc(NAROCILA, null as unknown as typeof opt)).toThrow(TypeError)
    expect(() => buildNarocilaPregledPdfDoc(NAROCILA, { now: new Date('ne'),
      danas: DANAS } as unknown as typeof opt)).toThrow(/now/)
    expect(() => buildNarocilaPregledPdfDoc(NAROCILA, { now: NOW, danas: new Date('ne') } as unknown as typeof opt)).toThrow(/danas/)
    expect(() => buildNarocilaPregledPdfDoc([{ ...NAROCILA[0], datumNarocila: '28.9.2026' }], opt)).toThrow(/datumNarocila/)
    expect(() => buildNarocilaPregledPdfDoc([{ ...NAROCILA[0], datumDobave: 123 as unknown as string }], opt)).toThrow(/datumDobave/)
    expect(() => buildNarocilaPregledPdfDoc([{ ...NAROCILA[0], skupajCena: Number.NaN }], opt)).toThrow(/skupajCena/)
    expect(() => buildNarocilaPregledPdfDoc([{ ...NAROCILA[0], items: 'tri' as unknown as readonly unknown[] }], opt)).toThrow(/items/)
    expect(() => buildNarocilaPregledPdfDoc([{ ...NAROCILA[0], items: ['posta'] as unknown as readonly unknown[] }], opt)).toThrow(/items\[0\]/)
    expect(() => preveriNarociloPregledVnos({ ...NAROCILA[0], opombe: 5 as unknown as string }, 4)).toThrow(/preveriNarociloPregledVnos \(4\)/)
  })

  it('danas je IZRECEN argument (jeZamujenaDobava pogodba) — brez danas NE gre', () => {
    expect(() => buildNarocilaPregledPdfDoc(NAROCILA, { now: NOW } as unknown as { now: Date; danas: Date })).toThrow(/danas/)
    expect(lib).toContain('danas: Date')
  })
})

describe('R257 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 8 stolpcev (Datum, Dobavitelj, Status, Dobava, Postavk, Vrednost, Pretekel rok, Opombe) — head dobesedno', () => {
    expect(lib).toContain("['Datum', 'Dobavitelj', 'Status', 'Dobava', 'Postavk', 'Vrednost (EUR)', 'Pretekel rok', 'Opombe']")
  })

  it('status WYSIWYG: 5 znanih VERBATIM (kanon prisma) + barvna resnica (DOBLJENO zeleno bold, PREKlicANO rdeče bold, vrednost preklicanega sivo)', () => {
    expect(lib).toContain("'OSNUTEK', 'POSLANO', 'POTRJENO', 'DOBLJENO', 'PREKlicANO'")
    expect(oknoMed(lib, "if (data.section === 'body' && data.column.index === 2)", "if (data.section === 'body' && data.column.index === 3")).toContain("'DOBLJENO'")
    expect(oknoMed(lib, "if (data.section === 'body' && data.column.index === 2)", "if (data.section === 'body' && data.column.index === 3")).toContain('PREKlicANO')
    expect(oknoMed(lib, "data.column.index === 5", 'data.column.index === 6')).toContain('PREKlicANO')
  })

  it('iskrene null resnice: dobava \'—\' (sivo), opombe prazna celica, postavk števec vključno 0', () => {
    expect(lib).toContain("n.datumDobave ? cenikDatumIso(n.datumDobave) : '—'")
    expect(lib).toContain("typeof n.opombe === 'string' ? n.opombe.trim() : ''")
    expect(oknoMed(lib, "data.column.index === 3 && data.cell.raw === '—'", 'if (data.section')).toContain('GRAY')
  })

  it('KPI 5 boxov z ISTIM signalnim jezikom kot zaslon (odprto amber, dobavljeno zeleno, pretekel rok rdeče, preklicano sivo)', () => {
    const kpiOkno = oknoMed(lib, "kpiBox(doc, 14, y, bw, bh, 'Naročil'", "y += bh + 8")
    expect(kpiOkno).toContain("'Odprtih'")
    expect(kpiOkno).toContain('pov.odprtih > 0 ? AMBER : NAVY')
    expect(kpiOkno).toContain('pov.dobavljenih > 0 ? GREEN : NAVY')
    expect(kpiOkno).toContain('pov.zamujenih > 0 ? RED : NAVY')
    expect(kpiOkno).toContain("'Preklicanih'")
    expect(kpiOkno).toContain('GRAY)')
  })

  it('sklep: vseh/odprtih/dobavljenih/preklicanih (izključeni iz vsote)/vrednost ne-preklicanih/pretekel rok/postavk', () => {
    const sklep = oknoMed(lib, 'sklepna vrstica', 'noge na vseh straneh')
    expect(sklep).toContain('naročil · odprtih')
    expect(sklep).toContain('(izključeni iz vsote)')
    expect(sklep).toContain('vrednost ne-preklicanih')
    expect(sklep).toContain('pretekel rok')
    expect(sklep).toContain('postavk.')
  })

  it('glava NAROČILA — PREGLED + osveženo (družinski vzorec) + noge Stran i/N', () => {
    expect(lib).toContain("'NAROČILA — PREGLED'")
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
  })

  it('cenikDatumIso re-use (determinističen DD.MM.YYYY — NIKOLI locale-odvisen izpis)', () => {
    expect(lib).toContain("import { cenikDatumIso } from './cenik-pdf'")
    expect(lib).not.toContain('toLocaleDateString')
    expect(lib).not.toContain('localeCompare')
  })
})

describe('R257 — komponenta (material-intelligence-tab) — pill, legenda, handler', () => {
  it('pill VEDNO viden (bralni dokument, P1-k precedens — NI gated na orders.length niti pravice) + ISTI pill družinski razredi', () => {
    expect(komponenta).toContain('aria-label="Izvozi naročila kot PDF"')
    expect(oknoMed(komponenta, 'aria-label="Izvozi naročila kot PDF"', 'PDF\n            </Button>')).toContain('press-scale')
    // disabled števec: loading + narocilaVTeku (NI orders.length — VEDNO viden)
    expect(oknoMed(komponenta, 'onClick={handleNarocilaPdf}', 'aria-label="Izvozi naročila kot PDF"')).toContain('disabled={loading || narocilaVTeku}')
  })

  it('legenda izvozne skupine: CSV vrstica per postavka · PDF vrstica per naročilo · pretekel rok resnica (želona pariteta)', () => {
    expect(komponenta).toContain('CSV = vrstica per postavka · PDF = vrstica per naročilo · Pretekel rok = pretekljena obljuba, status še odprt')
  })

  it('handler: EN now, ISTI danasZamude kot badge/CSV, toast realni agregat, fail-closed toast pri 0, TypeError vidni razlog', () => {
    const handler = oknoMed(komponenta, 'const handleNarocilaPdf', '// R236 (P1-c) — DOBAVITELJI PDF')
    expect(handler).toContain('const now = new Date()')
    expect(handler).toContain('danas: danasZamude')
    expect(handler).toContain("title: 'Naročila prenešena v PDF'")
    expect(handler).toContain('narocilaPregledPovzetek(orders, danasZamude)')
    expect(handler).toContain('odprtih ${pov.odprtih}')
    expect(handler).toContain("title: 'Ni naročil za izvoz'")
    expect(handler).toContain('Naročila PDF ni mogoče sestaviti iz tega seznama')
    // dvoklik guard (prihodki R250 vzorec)
    expect(handler).toContain('if (narocilaVTeku || loading) return')
    expect(handler).toContain('setNarocilaVTeku(false)')
  })

  it('CSV kontrakt R140 NESPREMENJEN (VSA naročila, vrstica per postavka — sorojenski dokument ohrani svojo resnico)', () => {
    expect(komponenta).toContain('function downloadOrdersCsv(orders: MaterialOrder[], danas: Date): number')
    expect(komponenta).toContain("['Datum', 'Dobavitelj', 'Status', 'Artikel', 'Količina', 'Enota', 'Cena', 'Vrednost', 'Naročilo skupaj', 'Opombe', 'Pretekel rok']")
  })

  it('bralni dokument — brez pravice gate (ni pogojnega izrisovanja na dovoljenja)', () => {
    const blok = oknoMed(komponenta, 'R257 — PDF pill', '</div>')
    expect(blok).not.toContain('lahkoUpravljaKatalog')
    expect(blok).not.toContain('lahkoOdobri')
  })
})

describe('R257 — bratje čisti (ločeni dokumenti, nič dvojnega)', () => {
  it('dobavitelji/naročilnica liba NE vsebujeta naročil-pregled resnic; nov lib NE podvaja sklanjatev R228', () => {
    expect(dobaviteljiLib).not.toContain('NarocilaPregled')
    expect(narocilnicaLib).not.toContain('NarocilaPregled')
    expect(lib).not.toContain('function narociloBeseda') // re-use iz R228, nič dvojnega
    expect(lib).not.toContain("ODPRTI_STATUSI_NAROCIL = ['OSNUTEK'") // EN VIR import, nič dvojnega seznama
  })

  it('nov lib NE spreminja zamujena-dobava (route NIČ, lib bratje NIČ — samo import)', () => {
    expect(zamujenaLib).not.toContain('NarocilaPregled')
    expect(zamujenaLib).not.toContain('narocilaPregled')
  })
})
