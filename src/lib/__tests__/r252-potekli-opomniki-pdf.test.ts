// ---------------------------------------------------------------------------
// R252 — POTEKELI OPOMNIKI PDF (9. člen 'izvozi' družine, P1-f) — testi.
// Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN VRSTNI
// RED = bajtno ENAK — sort interno, f(množica); %PDF- magija; glifni razred
// minute — R249 doktrina) + vsebinski dokazi na VIRU liba in komponente
// (oknoMed; PDF content stream je fontno kodiran — izvleka teksta iz bajtov
// NI resnična).
// WYSIWYG dokazi: izbira = opomnikStatus === 'POTEKEL' VERBATIM iz API-ja
// (ISTI izračun kot žig na kartici); dni prek = ISTA formula kot API z now
// KOT PARAMETER; MONOTONIJA: klik ≥ fetch → dni prek ≥ 1 (NIKOLI 'prek 0').
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildPotekliOpomnikiPdfDoc,
  potekelDniPrek,
  potekliOpomnikiPdfFilename,
  potekliPovzetek,
  preveriPotekliVnos,
  sortirajPotekle,
  type PotekelOpomnikVnos,
} from '@/lib/potekli-opomniki-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med dvema markerjema (r207/r233/r244/r245/r250/r251 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/potekli-opomniki-pdf.ts')
const komponenta = beri('src/components/roksal/crm-tab.tsx')
const opomnikLib = beri('src/lib/opomnik-pdf.ts')
const crmCsvLib = beri('src/lib/crm-csv.ts')

const ZDANJ: Date = new Date(2026, 8, 28, 15, 0, 0) // fiksen vhod — determinizem

// Vse vrstice so POTEKEL (status VERBATIM). ŠČŽ niz za fontni dokaz.
const VRSTE: PotekelOpomnikVnos[] = [
  {
    ime: 'ŠČŽ Gradnja d.o.o.',
    naslov: 'Cesta Republike 14, 4000 Kranj',
    telefon: '+386 41 234 567',
    kontaktnaOseba: 'Maja Novak',
    opomnikDatum: '2026-09-20T09:00:00.000Z', // najstarejši (8 dni prek)
    opomnikOpis: 'Letni pregled balkonov',
    opomnikStatus: 'POTEKEL',
  },
  {
    ime: 'Alu Center d.o.o.',
    naslov: 'Slovenska cesta 5, 1000 Ljubljana',
    telefon: null,
    kontaktnaOseba: null,
    opomnikDatum: '2026-09-26T09:00:00.000Z', // 2 dni prek
    opomnikOpis: null, // iskrena '—' resnica
    opomnikStatus: 'POTEKEL',
  },
  {
    ime: 'Bratovšina Kovač s.p.',
    naslov: 'Kranjska 12, 4000 Kranj',
    telefon: '+386 40 111 222',
    kontaktnaOseba: null,
    opomnikDatum: '2026-09-23T09:00:00.000Z', // 5 dni prek
    opomnikOpis: 'Dobava ograje',
    opomnikStatus: 'POTEKEL',
  },
]

function zgradi(vnosi: readonly PotekelOpomnikVnos[] = VRSTE, now: Date = ZDANJ): Buffer {
  const doc = buildPotekliOpomnikiPdfDoc(vnosi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R252 — potekelDniPrek: ISTA formula kot API (Math.floor), now KOT PARAMETER + monotomija', () => {
  it('dni prek ≥ 1 za vsak POTEKEL vhod (klik ≥ fetch, floor monotona — NIKOLI \'prek 0 dni\')', () => {
    for (const p of VRSTE) {
      const dni = potekelDniPrek(p, ZDANJ)
      expect(dni).toBeGreaterThanOrEqual(1)
    }
    // točne vrednosti (floor negativni rob — ISTA formula kot API): 20.09. 09:00Z
    // vs 28.09. 13:00Z = 8 d 4 h → floor(−8,17) = −9 → 9 dni prek (NI 8 —
    // delni prvi dan se šteje; ISTI izračun kot API days = −9 → POTEKEL)
    expect(potekelDniPrek(VRSTE[0], new Date(Date.UTC(2026, 8, 28, 13, 0, 0)))).toBe(9)
    expect(potekelDniPrek(VRSTE[1], new Date(Date.UTC(2026, 8, 28, 13, 0, 0)))).toBe(3)
  })

  it('monotomija: kasnejši now = ISTO ALI VEČ dni prek (nikoli manj — lastnost čez več točk)', () => {
    const tocke = [
      new Date(Date.UTC(2026, 8, 28, 10, 0, 0)),
      new Date(Date.UTC(2026, 8, 28, 13, 0, 0)),
      new Date(Date.UTC(2026, 8, 28, 20, 0, 0)),
      new Date(Date.UTC(2026, 8, 29, 9, 0, 0)),
    ]
    for (const p of VRSTE) {
      for (let i = 1; i < tocke.length; i++) {
        expect(potekelDniPrek(p, tocke[i])).toBeGreaterThanOrEqual(potekelDniPrek(p, tocke[i - 1]))
      }
    }
  })
})

describe('R252 — sortirajPotekle + potekliPovzetek: ENA agregatna izpeljava (WYSIWYG)', () => {
  it('sort: opomnikDatum ASC (najstarejši prvi — akcijski red), izenačba ime ASC; premešan vhod = ISTI red (f(množica), localeCompare NIČ)', () => {
    const sortirane = sortirajPotekle([...VRSTE].reverse())
    expect(sortirane.map((p) => p.ime)).toEqual(['ŠČŽ Gradnja d.o.o.', 'Bratovšina Kovač s.p.', 'Alu Center d.o.o.'])
    // izenačba po imenu (dva z ISTIM datumom)
    const izenacba = sortirajPotekle([
      { ...VRSTE[1], ime: 'Ziga s.p.' },
      { ...VRSTE[0], opomnikDatum: VRSTE[1].opomnikDatum, ime: 'Ana d.o.o.' },
    ])
    expect(izenacba.map((p) => p.ime)).toEqual(['Ana d.o.o.', 'Ziga s.p.'])
  })

  it('povzetek: potekliN + najstarejši (max, urejenostna invarianta) + povprečje s prikaznim nizom (vejica) — premešan red = ISTI rezultat (FP, toBeCloseTo …, 10)', () => {
    const pov = potekliPovzetek(VRSTE, new Date(Date.UTC(2026, 8, 28, 13, 0, 0)))
    expect(pov.potekliN).toBe(3)
    expect(pov.najstarejsi).toBe(9)
    expect(pov.povprecje).toBeCloseTo((9 + 3 + 6) / 3, 10)
    expect(pov.povprecjeNiz).toBe('6,0')
    const pmesano = potekliPovzetek([...VRSTE].reverse(), new Date(Date.UTC(2026, 8, 28, 13, 0, 0)))
    expect(pmesano.povprecje).toBeCloseTo(pov.povprecje, 10)
    expect(pmesano.najstarejsi).toBe(pov.najstarejsi)
  })

  it('prazen seznam → TypeError z lažjo POIMENOVANO (max prazne množice ne obstaja — vzorec R249)', () => {
    expect(() => potekliPovzetek([], ZDANJ)).toThrow(TypeError)
    expect(() => potekliPovzetek([], ZDANJ)).toThrow(/max prazne množice ne obstaja/)
    expect(() => potekliPovzetek([], ZDANJ)).toThrow(/-Infinity/)
  })
})

describe('R252 — fail-closed: pokvaren vnos → TypeError z indeksom krivca (NIKOLI izmišljen dokument)', () => {
  it('vnos NI POTEKEL → TypeError: seznam je izpeljava iz opomnikStatus, nepotečen vnos = pokvaren vir', () => {
    const mešan = [{ ...VRSTE[0], opomnikStatus: 'AKTIVEN' as never }]
    expect(() => preveriPotekliVnos(mešan[0], 0)).toThrow(TypeError)
    expect(() => preveriPotekliVnos(mešan[0], 0)).toThrow(/seznam je izpeljava iz opomnikStatus/)
    // build (dokument) validira vrstice — indeks krivca (1) v sporočilu:
    expect(() => buildPotekliOpomnikiPdfDoc([VRSTE[0], mešan[0]], { now: ZDANJ })).toThrow(/\(1\).*POTEKEL/)
  })

  it('pokvarjena polja: prazno ime, prazen naslov, ne-ISO datum, prazen telefon niz (null je VELJAVEN) — indeks krivca VEDNO v sporočilu', () => {
    expect(() => preveriPotekliVnos({ ...VRSTE[0], ime: ' ' }, 2)).toThrow(/\(2\).*ime/)
    expect(() => preveriPotekliVnos({ ...VRSTE[0], naslov: '' }, 1)).toThrow(/\(1\).*naslov/)
    expect(() => preveriPotekliVnos({ ...VRSTE[0], opomnikDatum: '28.09.2026' }, 3)).toThrow(/\(3\).*opomnikDatum/)
    expect(() => preveriPotekliVnos({ ...VRSTE[0], telefon: '' }, 4)).toThrow(/\(4\).*telefon/)
    expect(() => preveriPotekliVnos({ ...VRSTE[0], opomnikOpis: '  ' }, 5)).toThrow(/\(5\).*opomnikOpis/)
    expect(() => preveriPotekliVnos({ ...VRSTE[1] }, 0)).not.toThrow() // null resnica OK
  })

  it('PRAZEN SEZNAM ne nastaja dokumenta (družina: ni prazne datoteke) + pokvarjene opcije → TypeError', () => {
    expect(() => buildPotekliOpomnikiPdfDoc([], { now: ZDANJ })).toThrow(TypeError)
    expect(() => buildPotekliOpomnikiPdfDoc([], { now: ZDANJ })).toThrow(/prazen seznam ne nastaja dokumenta/)
    expect(() => buildPotekliOpomnikiPdfDoc(VRSTE, null as never)).toThrow(/pričakovane opcije/)
    expect(() => buildPotekliOpomnikiPdfDoc(VRSTE, { now: 'danes' as never })).toThrow(/pričakovan veljaven now/)
  })
})

describe('R252 — PDF bajtni dokazi (determinizem + glifni razred minute — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno — f(množica), vzorec prihodki R250); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    expect(zgradi([...VRSTE].reverse()).equals(zgradi(VRSTE))).toBe(true)
    expect(zgradi(VRSTE, ZDANJ).equals(zgradi(VRSTE, new Date(2026, 8, 28, 15, 1, 0)))).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh znanih družinskih razredov) + ime datoteke Potekli-opomniki-YYYY-MM-DD.pdf', () => {
    const buf = zgradi()
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    // znani razredi: Osnutek, primerjalni, cenik, prihodki, opomnik — potekli je NOV dokument
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656]
    expect(znani.includes(buf.length)).toBe(false)
    expect(potekliOpomnikiPdfFilename(ZDANJ)).toBe('Potekli-opomniki-2026-09-28.pdf')
  })

  it('soli 0x69–0x6c — UNIKATNE v družini (isti seed v dveh libih NE sme dati isti ID — register)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x69)')
    expect(lib).toContain('fnv1aHex(seed, 0x6c)')
    // sorojenci NE smejo deliti 0x69–0x6c (opomnik 0x65–68, prihodki 0x61–64)
    expect(opomnikLib).not.toContain('0x69')
    expect(opomnikLib).not.toContain('0x6c')
  })
})

describe('R252 — PDF telesu skozi izpeljavo (KPI + tabela + sklep iz ISTEGA vira)', () => {
  it('KPI trio: Poteklih < Najstarejši < Povprečno + signal barve (RED/RED/AMBER — ISTI signal kot \'(X poteklo)\' na stats; 0 novih hex)', () => {
    const kpi = oknoMed(lib, "kpiBox(doc, 14, y, bw, bh, 'Poteklih'", 'y += bh + 8')
    expect(kpi).toContain("'Najstarejši (dni)'")
    expect(kpi).toContain("'Povprečno (dni)'")
    expect(kpi.indexOf('RED')).toBeLessThan(kpi.indexOf('AMBER'))
    expect(lib).toContain("String(pov.potekliN), RED)")
    expect(lib).toContain("String(pov.najstarejsi), RED)")
    expect(lib).toContain("pov.povprecjeNiz, AMBER)")
  })

  it('tabela: 6 stolpcev (Stranka, Naslov, Telefon, Opomnik, Dni prek, Opis) + \'Dni prek\' RED bold + \'—\' sivo (iskrena null resnica)', () => {
    expect(lib).toContain("['Stranka', 'Naslov', 'Telefon', 'Opomnik', 'Dni prek', 'Opis']")
    expect(lib).toContain("p.opomnikOpis ?? '—'")
    expect(lib).toContain("p.telefon ?? '—'")
    const didParse = oknoMed(lib, 'didParseCell:', 'lastAutoTable')
    expect(didParse).toContain("data.column.index === 4")
    expect(didParse).toContain('textColor = RED')
    expect(didParse).toContain("=== '—'")
    expect(didParse).toContain('textColor = GRAY')
  })

  it('sklepni podpis pove ISKRENO resnico (potekli/najstarejši/povprečno + akcijski red + vir)', () => {
    const sklep = oknoMed(lib, 'sklepna vrstica', 'noge na vseh straneh')
    expect(sklep).toContain('poteklih opomnikov · najstarejši ')
    expect(sklep).toContain(' dni prek · povprečno ')
    expect(sklep).toContain('akcijski seznam za pisarno (najstarejši prvi)')
    expect(sklep).toContain('vir = opomnikStatus iz CRM')
  })
})

describe('R252 — komponenta: pill + legenda + toast (WYSIWYG, ENA resnica na treh mestih)', () => {
  it('pill: aria + title + press-scale token + FileDown (ISTI žetoni kot CSV pill — 0 novih hex) + dvoklik guard + VEDNO viden (P1-k precedens)', () => {
    expect(komponenta).toContain('aria-label="Izvozi potekle opomnike kot PDF"')
    expect(komponenta).toContain('Potekli opomniki kot akcijski PDF seznam za pisarno (najstarejši prvi)')
    expect(komponenta).toContain('disabled={potekliVTeku}')
    expect(komponenta).toContain('if (potekliVTeku) return')
    const pill = oknoMed(komponenta, 'onClick={handlePotekliOpomnikiPdf}', '</Button>')
    expect(pill).toContain('press-scale')
    expect(pill).toContain('<FileDown className="h-3 w-3"')
    // pill NI gated na pravice NIMa disabled={filtered.length === 0} (bralni dokument)
    expect(pill).not.toContain('filtered.length')
  })

  it('izbira = tip-guard filter (ENA izpeljava točka — type system poveže filter in status)', () => {
    expect(komponenta).toContain("(c): c is CrmCustomer & { opomnikStatus: 'POTEKEL' }")
    expect(komponenta).toContain('opomnikStatus: c.opomnikStatus')
  })

  it('fail-closed poti: 0 poteklih → iskren toast; TypeError → viden razlog (nič tihega degradiranja)', () => {
    expect(komponenta).toContain("'Ni poteklih opomnikov'")
    expect(komponenta).toContain('PDF se izvozi, ko opomnik preteče.')
    expect(komponenta).toContain('Potekli opomniki PDF ni mogoče sestaviti iz teh podatkov')
  })

  it('toast nosi REALNO agregatno resnico (potekliPovzetek — potekli + najstarejši + povprečje) — EN now za žig + ime', () => {
    expect(komponenta).toContain('potekliPovzetek(vnosi, now)')
    expect(komponenta).toContain('Potekli opomniki prenešeni v PDF')
    expect(komponenta).toContain('potekliOpomnikiPdfFilename(now)')
    expect(komponenta).toContain('${pov.potekliN} poteklih, najstarejši ${pov.najstarejsi} dni prek, povprečno ${pov.povprecjeNiz} dni.')
  })

  it('legenda imenuje ISTO izpeljavo (CSV prikazani seznam · PDF akcija · Potekel = prek datuma) — žetoni text-2xs, JSX ohrani ·', () => {
    expect(komponenta).toContain('CSV = prikazani seznam · PDF = potekli opomniki (akcija) · Potekel = prek datuma')
  })
})

describe('R252 — ločeni dokumenti se še naprej obrestujejo (družinska bajtna stabilnost)', () => {
  it('opomnik PDF brat NEspremenjen (per-stranko terenski list živi v bloku — ločeni pilli)', () => {
    expect(komponenta).toContain('aria-label="Pripravi opomnik kot PDF"')
    expect(opomnikLib).not.toContain('buildPotekliOpomnikiPdfDoc')
    expect(opomnikLib).not.toContain('Potekli-opomniki-')
    expect(opomnikLib).not.toContain('potekliPovzetek')
  })

  it('CRM CSV brat NEspremenjen (isti buildCrmCsv klic, brez poteklih libi)', () => {
    expect(komponenta).toContain('buildCrmCsv(')
    expect(crmCsvLib).not.toContain('potekliPovzetek')
    expect(crmCsvLib).not.toContain('Potekli-opomniki-')
  })
})
