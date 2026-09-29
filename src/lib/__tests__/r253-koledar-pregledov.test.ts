// ---------------------------------------------------------------------------
// R253 — KOLEDAR PREGLEDOV PDF (10. člen 'izvozi' družine, P1-f) — testi.
// Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN VRSTNI
// RED = bajtno ENAK — sort interno, f(množica); %PDF- magija; glifni razred
// minute — R249 doktrina) + vsebinski dokazi na VIRU liba in komponente
// (oknoMed; PDF content stream je fontno kodiran — izvleka teksta iz bajtov
// NI resnična).
// WYSIWYG dokazi: izbira = opomnikStatus !== 'NI' VERBATIM iz API-ja (AKTIVEN
// + POTEKEL; 'NI' = brez vpisanega datuma → NIČ na koledarju — izmišljen
// pregled NE obstaja); dni do = ISTA formula kot API z now KOT PARAMETER;
// MONOTONIJA: klik ≥ fetch → AKTIVEN dni do ≤ 7 (pregled ne odmik), POTEKEL
// dni do ≤ −1 (R252 dokaz); ROB: pregled lahko poteče med fetchom in klikom —
// AKTIVEN status (fetch resnica) z negativnim 'Dni do' (klik resnica) =
// ISKREN signal, NIKOLI izmišljen pozitiven.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildKoledarPregledovPdfDoc,
  koledarDniDo,
  koledarPregledovPdfFilename,
  koledarPovzetek,
  preveriKoledarVnos,
  sortirajKoledar,
  type KoledarPregledVnos,
} from '@/lib/koledar-pregledov-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med dvema markerjema (r207/…/r252 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/koledar-pregledov-pdf.ts')
const komponenta = beri('src/components/roksal/crm-tab.tsx')
const potekliLib = beri('src/lib/potekli-opomniki-pdf.ts')
const crmCsvLib = beri('src/lib/crm-csv.ts')

const ZDANJ: Date = new Date(2026, 8, 28, 15, 0, 0) // fiksen vhod — determinizem

// Mešane vrstice: 2× POTEKEL (preteklost) + 1× AKTIVEN (v 7-dnevnem oknu).
// ŠČŽ niz za fontni dokaz.
const VRSTE: KoledarPregledVnos[] = [
  {
    ime: 'ŠČŽ Gradnja d.o.o.',
    naslov: 'Cesta Republike 14, 4000 Kranj',
    telefon: '+386 41 234 567',
    kontaktnaOseba: 'Maja Novak',
    opomnikDatum: '2026-09-20T09:00:00.000Z', // POTEKEL — najstarejši (koledarsko prvi)
    opomnikOpis: 'Letni pregled balkonov',
    opomnikStatus: 'POTEKEL',
  },
  {
    ime: 'Alu Center d.o.o.',
    naslov: 'Slovenska cesta 5, 1000 Ljubljana',
    telefon: null,
    kontaktnaOseba: null,
    opomnikDatum: '2026-10-02T09:00:00.000Z', // AKTIVEN — 4 dni do (v tednu)
    opomnikOpis: null, // iskrena '—' resnica
    opomnikStatus: 'AKTIVEN',
  },
  {
    ime: 'Bratovšina Kovač s.p.',
    naslov: 'Kranjska 12, 4000 Kranj',
    telefon: '+386 40 111 222',
    kontaktnaOseba: null,
    opomnikDatum: '2026-09-26T09:00:00.000Z', // POTEKEL — 2 dni prek
    opomnikOpis: 'Dobava ograje',
    opomnikStatus: 'POTEKEL',
  },
]

function zgradi(vnosi: readonly KoledarPregledVnos[] = VRSTE, now: Date = ZDANJ): Buffer {
  const doc = buildKoledarPregledovPdfDoc(vnosi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R253 — koledarDniDo: ISTA formula kot API (Math.floor), now KOT PARAMETER + monotomija', () => {
  it('točne vrednosti (floor rob — ISTA formula kot API days): POTEKEL negativen, AKTIVEN pozitiven ≤ 7', () => {
    // 20.09. 09:00Z vs 28.09. 13:00Z = 8 d 4 h → floor(−8,17) = −9 (delni
    // prvi dan se šteje — ISTI izračun kot API/R252 '9 dni prek')
    expect(koledarDniDo(VRSTE[0], new Date(Date.UTC(2026, 8, 28, 13, 0, 0)))).toBe(-9)
    expect(koledarDniDo(VRSTE[2], new Date(Date.UTC(2026, 8, 28, 13, 0, 0)))).toBe(-3)
    // 02.10. 09:00Z vs 28.09. 13:00Z = 3 d 20 h → floor(3,83) = 3 (dni do)
    expect(koledarDniDo(VRSTE[1], new Date(Date.UTC(2026, 8, 28, 13, 0, 0)))).toBe(3)
  })

  it('MONOTONIJA AKTIVEN: kasnejši now = ISTO ALI MANJ dni do (pregled ne odmik — lastnost čez več točk, NIKOLI > 7 ob fetch ≤ 7)', () => {
    const tocke = [
      new Date(Date.UTC(2026, 8, 28, 10, 0, 0)),
      new Date(Date.UTC(2026, 8, 28, 13, 0, 0)),
      new Date(Date.UTC(2026, 8, 28, 20, 0, 0)),
      new Date(Date.UTC(2026, 8, 29, 9, 0, 0)),
      new Date(Date.UTC(2026, 9, 2, 9, 0, 0)),
    ]
    for (let i = 1; i < tocke.length; i++) {
      const prej = koledarDniDo(VRSTE[1], tocke[i - 1])
      const zdaj = koledarDniDo(VRSTE[1], tocke[i])
      expect(zdaj).toBeLessThanOrEqual(prej)
    }
    // zgornja meja: ob fetch-u z dnmi ≤ 7 je klik vrednost ≤ 7 (ura naprej)
    for (const t of tocke) {
      expect(koledarDniDo(VRSTE[1], t)).toBeLessThanOrEqual(7)
    }
  })

  it('MONOTONIJA POTEKEL: kasnejši now = ISTO ALI VEČ dni prek (dni do ≤ −1 — R252 dokaz v koledarskem orientaciji)', () => {
    const tocke = [
      new Date(Date.UTC(2026, 8, 28, 10, 0, 0)),
      new Date(Date.UTC(2026, 8, 28, 20, 0, 0)),
      new Date(Date.UTC(2026, 8, 29, 9, 0, 0)),
    ]
    for (const p of [VRSTE[0], VRSTE[2]]) {
      for (let i = 1; i < tocke.length; i++) {
        expect(koledarDniDo(p, tocke[i])).toBeLessThanOrEqual(koledarDniDo(p, tocke[i - 1]))
      }
      expect(koledarDniDo(p, tocke[0])).toBeLessThanOrEqual(-1)
    }
  })

  it('ROB (iskreno dokumentiran): pregled poteče med fetchom in klikom — AKTIVEN status (fetch resnica) lahko pokaže negativen Dni do (klik resnica) — NIKOLI obratno laž', () => {
    // 02.10. opomnik, klik 05.10. → dni do = −3 (status ostane AKTIVEN —
    // VERBATIM fetch resnica; klik resnica je iskreno negativna)
    expect(koledarDniDo(VRSTE[1], new Date(Date.UTC(2026, 9, 5, 9, 0, 0)))).toBe(-3)
  })
})

describe('R253 — sortirajKoledar + koledarPovzetek: ENA agregatna izpeljava (WYSIWYG)', () => {
  it('sort: opomnikDatum ASC (koledarski red — najbližji pregled prvi), izenačba ime ASC; premešan vhod = ISTI red (f(množica), localeCompare NIČ)', () => {
    const sortirane = sortirajKoledar([...VRSTE].reverse())
    expect(sortirane.map((p) => p.ime)).toEqual(['ŠČŽ Gradnja d.o.o.', 'Bratovšina Kovač s.p.', 'Alu Center d.o.o.'])
    // izenačba po imenu (dva z ISTIM datumom)
    const izenacba = sortirajKoledar([
      { ...VRSTE[1], ime: 'Ziga s.p.' },
      { ...VRSTE[0], opomnikDatum: VRSTE[1].opomnikDatum, ime: 'Ana d.o.o.' },
    ])
    expect(izenacba.map((p) => p.ime)).toEqual(['Ana d.o.o.', 'Ziga s.p.'])
  })

  it('povzetek: preglediN + vTemTednu (AKTIVEN VERBATIM) + poteklih (POTEKEL VERBATIM) — premešan red = ISTI rezultat (f(množica))', () => {
    const pov = koledarPovzetek(VRSTE)
    expect(pov.preglediN).toBe(3)
    expect(pov.vTemTednu).toBe(1)
    expect(pov.poteklih).toBe(2)
    const pmesano = koledarPovzetek([...VRSTE].reverse())
    expect(pmesano).toEqual(pov)
  })

  it('prazen seznam → TypeError z lažjo POIMENOVANO (prazna množica ne nastaja dokumenta — vzorec R249/R252)', () => {
    expect(() => koledarPovzetek([])).toThrow(TypeError)
    expect(() => koledarPovzetek([])).toThrow(/prazna množica ne nastaja dokumenta/)
  })
})

describe('R253 — fail-closed: pokvaren vnos → TypeError z indeksom krivca (NIKOLI izmišljen pregled)', () => {
  it('vnos \'NI\' → TypeError: koledar je izpeljava iz opomnikStatus, brez datuma ne nastaja pregled', () => {
    const ni = { ...VRSTE[0], opomnikStatus: 'NI' as never, opomnikDatum: '2026-09-20T09:00:00.000Z' }
    expect(() => preveriKoledarVnos(ni, 0)).toThrow(TypeError)
    expect(() => preveriKoledarVnos(ni, 0)).toThrow(/koledar je izpeljava iz opomnikStatus/)
    // build (dokument) validira vrstice — indeks krivca (1) v sporočilu:
    expect(() => buildKoledarPregledovPdfDoc([VRSTE[0], ni], { now: ZDANJ })).toThrow(/\(1\).*izpeljava/)
  })

  it('pokvarjena polja: prazno ime, prazen naslov, ne-ISO datum, prazen telefon niz (null je VELJAVEN) — indeks krivca VEDNO v sporočilu', () => {
    expect(() => preveriKoledarVnos({ ...VRSTE[0], ime: ' ' }, 2)).toThrow(/\(2\).*ime/)
    expect(() => preveriKoledarVnos({ ...VRSTE[0], naslov: '' }, 1)).toThrow(/\(1\).*naslov/)
    expect(() => preveriKoledarVnos({ ...VRSTE[0], opomnikDatum: '28.09.2026' }, 3)).toThrow(/\(3\).*opomnikDatum/)
    expect(() => preveriKoledarVnos({ ...VRSTE[0], telefon: '' }, 4)).toThrow(/\(4\).*telefon/)
    expect(() => preveriKoledarVnos({ ...VRSTE[0], opomnikOpis: '  ' }, 5)).toThrow(/\(5\).*opomnikOpis/)
    expect(() => preveriKoledarVnos({ ...VRSTE[1] }, 0)).not.toThrow() // null resnica OK
  })

  it('PRAZEN KOLEDAR ne nastaja dokumenta (družina: ni prazne datoteke) + pokvarjene opcije → TypeError', () => {
    expect(() => buildKoledarPregledovPdfDoc([], { now: ZDANJ })).toThrow(TypeError)
    expect(() => buildKoledarPregledovPdfDoc([], { now: ZDANJ })).toThrow(/prazen koledar ne nastaja dokumenta/)
    expect(() => buildKoledarPregledovPdfDoc(VRSTE, null as never)).toThrow(/pričakovane opcije/)
    expect(() => buildKoledarPregledovPdfDoc(VRSTE, { now: 'danes' as never })).toThrow(/pričakovan veljaven now/)
  })
})

describe('R253 — PDF bajtni dokazi (determinizem + glifni razred minute — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno — f(množica), vzorec R250/R252); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    expect(zgradi([...VRSTE].reverse()).equals(zgradi(VRSTE))).toBe(true)
    expect(zgradi(VRSTE, ZDANJ).equals(zgradi(VRSTE, new Date(2026, 8, 28, 15, 1, 0)))).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 15 znanih družinskih razredov) + ime datoteke Koledar-pregledov-YYYY-MM-DD.pdf', () => {
    const buf = zgradi()
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    // znani razredi (15): Osnutek ×4, primerjalni ×5, cenik ×2, prihodki,
    // opomnik ×2 (živi + POTEKEL variant), potekli — koledar je NOV dokument
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958]
    expect(znani.includes(buf.length)).toBe(false)
    expect(koledarPregledovPdfFilename(ZDANJ)).toBe('Koledar-pregledov-2026-09-28.pdf')
  })

  it('soli 0x6d–0x70 — UNIKATNE v družini (isti seed v dveh libih NE sme dati isti ID — register)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x6d)')
    expect(lib).toContain('fnv1aHex(seed, 0x70)')
    // sorojenci NE smejo deliti 0x6d–0x70 (potekli 0x69–6c, opomnik 0x65–68, prihodki 0x61–64)
    expect(potekliLib).not.toContain('0x6d')
    expect(potekliLib).not.toContain('0x70')
  })
})

describe('R253 — PDF telesu skozi izpeljavo (KPI + tabela + sklep iz ISTEGA vira)', () => {
  it('KPI trio: Pregledov < V tem tednu < Poteklih + signal barve (NAVY/AMBER/RED — ISTI jezik kot žigi na karticah; 0 novih hex)', () => {
    const kpi = oknoMed(lib, "kpiBox(doc, 14, y, bw, bh, 'Pregledov'", 'y += bh + 8')
    expect(kpi).toContain("'V tem tednu'")
    expect(kpi).toContain("'Poteklih'")
    expect(kpi.indexOf('NAVY')).toBeLessThan(kpi.indexOf('AMBER'))
    expect(kpi.indexOf('AMBER')).toBeLessThan(kpi.indexOf('RED'))
    expect(lib).toContain("String(pov.preglediN), NAVY)")
    expect(lib).toContain("String(pov.vTemTednu), AMBER)")
    expect(lib).toContain("String(pov.poteklih), RED)")
  })

  it('tabela: 7 stolpcev (Stranka, Naslov, Telefon, Datum, Status, Dni do, Opis) + status RED/AMBER + negativen Dni do RED bold + \'—\' sivo (iskrena null resnica)', () => {
    expect(lib).toContain("['Stranka', 'Naslov', 'Telefon', 'Datum', 'Status', 'Dni do', 'Opis']")
    expect(lib).toContain("p.opomnikOpis ?? '—'")
    expect(lib).toContain("p.telefon ?? '—'")
    const didParse = oknoMed(lib, 'didParseCell:', 'lastAutoTable')
    expect(didParse).toContain("data.column.index === 4")
    expect(didParse).toContain("=== 'POTEKEL'")
    expect(didParse).toContain('textColor = RED')
    expect(didParse).toContain("=== 'AKTIVEN'")
    expect(didParse).toContain('textColor = AMBER')
    expect(didParse).toContain('data.column.index === 5')
    expect(didParse).toContain('Number.isFinite(dni) && dni < 0')
    expect(didParse).toContain("=== '—'")
    expect(didParse).toContain('textColor = GRAY')
  })

  it('sklepni podpis pove ISKRENO resnico (pregledi/v tem tednu/potekli + koledarski red + vir)', () => {
    const sklep = oknoMed(lib, 'sklepna vrstica', 'noge na vseh straneh')
    expect(sklep).toContain(' vpisanih pregledov · ')
    expect(sklep).toContain(' v tem tednu (do 7 dni) · ')
    expect(sklep).toContain(' poteklih · koledarski red (najbližji pregled prvi)')
    expect(sklep).toContain('vir = opomnikStatus iz CRM')
  })
})

describe('R253 — komponenta: pill + legenda + toast (WYSIWYG, ENA resnica na treh mestih)', () => {
  it('pill: aria + title + press-scale token + CalendarDays aria-hidden (ISTI žetoni kot ostali pilli — 0 novih hex) + dvoklik guard + VEDNO viden (P1-k precedens)', () => {
    expect(komponenta).toContain('aria-label="Izvozi koledar pregledov kot PDF"')
    expect(komponenta).toContain('Koledar pregledov kot PDF časovna vrsta (vsi vpisani datumi, najbližji prvi)')
    expect(komponenta).toContain('disabled={koledarVTeku}')
    expect(komponenta).toContain('if (koledarVTeku) return')
    const pill = oknoMed(komponenta, 'onClick={handleKoledarPregledovPdf}', '</Button>')
    expect(pill).toContain('press-scale')
    expect(pill).toContain('<CalendarDays className="h-3 w-3" aria-hidden="true" />')
    // pill NI gated na pravice NIma disabled={filtered.length === 0} (bralni dokument)
    expect(pill).not.toContain('filtered.length')
  })

  it('izbira = tip-guard filter (ENA izpeljava točka — type system poveže filter in statusa)', () => {
    expect(komponenta).toContain("(c): c is CrmCustomer & { opomnikStatus: 'AKTIVEN' | 'POTEKEL' }")
    expect(komponenta).toContain('opomnikStatus: c.opomnikStatus')
  })

  it('fail-closed poti: 0 vpisanih → iskren toast; TypeError → viden razlog (nič tihega degradiranja)', () => {
    expect(komponenta).toContain("'Ni vpisanih pregledov'")
    expect(komponenta).toContain('PDF se izvozi, ko je vpisan prvi datum pregleda.')
    expect(komponenta).toContain('Koledar pregledov PDF ni mogoče sestaviti iz teh podatkov')
  })

  it('toast nosi REALNO agregatno resnico (koledarPovzetek — pregledi + v tem tednu + potekli) — EN now za žig + ime', () => {
    // R295: ENA izpeljava memo koledarVnosi (ISTA izpeljava kot CSV brat 25.
    // člen + F2 mini-vrstica — NIČ dvojnega); pin sledi vsebinski resnici.
    expect(komponenta).toContain('koledarPovzetek(koledarVnosi)')
    expect(komponenta).toContain('Koledar pregledov prenešen v PDF')
    expect(komponenta).toContain('koledarPregledovPdfFilename(now)')
    expect(komponenta).toContain('${pov.preglediN} pregledov, ${pov.vTemTednu} v tem tednu, ${pov.poteklih} poteklih.')
  })

  it('legenda imenuje ISTO izpeljavo (R252 needle nepoškodovan + R253 dodatek) — žetoni text-2xs, JSX ohrani ·', () => {
    expect(komponenta).toContain('CSV = prikazani seznam · PDF = potekli opomniki (akcija) · Potekel = prek datuma · Koledar = vsi vpisani pregledi (časovna vrsta)')
  })
})

describe('R253 — ločeni dokumenti se še naprej obrestujejo (družinska bajtna stabilnost)', () => {
  it('potekli opomniki PDF brat NEspremenjen (akcijski seznam živi svoje — ločeni pilli)', () => {
    expect(komponenta).toContain('aria-label="Izvozi potekle opomnike kot PDF"')
    expect(potekliLib).not.toContain('buildKoledarPregledovPdfDoc')
    expect(potekliLib).not.toContain('Koledar-pregledov-')
    expect(potekliLib).not.toContain('koledarPovzetek')
  })

  it('CRM CSV brat NEspremenjen (isti buildCrmCsv klic, brez koledarnih libov)', () => {
    expect(komponenta).toContain('buildCrmCsv(')
    expect(crmCsvLib).not.toContain('koledarPovzetek')
    expect(crmCsvLib).not.toContain('Koledar-pregledov-')
  })
})
