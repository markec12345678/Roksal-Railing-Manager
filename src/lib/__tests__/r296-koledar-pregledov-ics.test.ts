// ---------------------------------------------------------------------------
// R296 — KOLEDAR PREGLEDOV ICS (26. člen 'izvozi' družine) — ICS brat PDF
// R253 + CSV R295. Dokazi:
//  • glava = VERBATIM VCALENDAR 2.0 (VERSION/PRODID/CALSCALE/METHOD);
//  • dogodki = sortirajKoledar EN VIR (ISTI koledarski red kot bratje) —
//    f(MNOŽICA): premešan vhod = bajtno isti ICS;
//  • DTSTART/DTEND projekcija ISTEGA opomnikDatum (DTEND ekskluziven —
//    naslednji dan); celodnevni dogodek = vir IMA samo datum (nič izmišljene
//    ure);
//  • DTSTAMP/UID deterministična (now KOT PARAMETER — F4);
//  • RFC 5545 §3.3.11 izpustni znaki (, ; \ \n) + §3.1 zavijanje ≤ 75
//    oktetov (UTF-8 — čšž se nikoli ne preseka) + CRLF + BREZ BOM
//    (dokumentiran odstopek od CSV bratov — koledarski potrošniki);
//  • fail-closed: prazen koledar / ne-polje / pokvaren vnos / pokvaren now
//    → TypeError;
//  • STRAŽAR nad REALNIM crm-tab: ICS povezava ostaje (import + handler +
//    pill + MIME resnica) — tihе odstranitve NE gredo skozi.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  koledarPregledovIcs,
  koledarPregledovIcsFilename,
  KOLEDAR_PREGLEDOV_ICS_PRODID,
} from '../koledar-pregledov-ics'
import {
  sortirajKoledar,
  koledarDniDo,
  koledarPovzetek,
  type KoledarPregledVnos,
} from '../koledar-pregledov-pdf'

/** UTC referenčni trenutek (DTSTAMP pričakovanje je odvisno od časa NE od
 *  časovnega pasu — getUTC* kontrakt). */
const NOW_UTC = new Date('2026-09-21T10:00:00Z')
/** Lokalni referenčni trenutek za ime datoteke (ISTI vzorec kot R295 brat). */
const NOW_LOCALNO = new Date(2026, 8, 21, 10, 0, 0) // 21. 9. 2026, 10:00

const VHODI: KoledarPregledVnos[] = [
  {
    ime: 'Kokalj',
    naslov: 'Cesta 1, Kranj',
    telefon: '041 222 333',
    kontaktnaOseba: 'Marko',
    opomnikDatum: '2026-09-24',
    opomnikOpis: 'Letni pregled ograje',
    opomnikStatus: 'AKTIVEN',
  },
  {
    ime: 'Anže Test',
    naslov: 'Ulica 2, Ljubljana',
    telefon: null,
    kontaktnaOseba: null,
    opomnikDatum: '2026-09-14',
    opomnikOpis: null,
    opomnikStatus: 'POTEKEL',
  },
  {
    ime: 'Berta',
    naslov: 'Trg 3, Celje',
    telefon: '041 444 555',
    kontaktnaOseba: null,
    opomnikDatum: '2026-09-23',
    opomnikOpis: 'Pol leta kontrola',
    opomnikStatus: 'AKTIVEN',
  },
]

/** Vrne LOGIČNO vrstico po predponi lastnosti (unfold: odstrani RFC zavijanje). */
function lastnost(ics: string, ime: string): string | undefined {
  const unfolded = ics.replace(/\r\n /g, '')
  const vrstice = unfolded.split('\r\n')
  return vrstice.find((v) => v.startsWith(ime))
}

describe('R296 — glava + struktura (VERBATIM)', () => {
  it('glava: VERSION:2.0 + PRODID konstanta + CALSCALE + METHOD', () => {
    const { ics } = koledarPregledovIcs(VHODI, NOW_UTC)
    const vrstice = ics.split('\r\n')
    expect(vrstice[0]).toBe('BEGIN:VCALENDAR')
    expect(vrstice).toContain('VERSION:2.0')
    expect(vrstice).toContain(`PRODID:${KOLEDAR_PREGLEDOV_ICS_PRODID}`)
    expect(KOLEDAR_PREGLEDOV_ICS_PRODID).toBe('-//Roksal//Koledar pregledov//SL')
    expect(vrstice).toContain('CALSCALE:GREGORIAN')
    expect(vrstice).toContain('METHOD:PUBLISH')
    expect(vrstice[vrstice.length - 2]).toBe('END:VCALENDAR')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('VEVENT števec = vhod = koledarPovzetek.preglediN (EN VIR pariteta)', () => {
    const { ics, dogodki } = koledarPregledovIcs(VHODI, NOW_UTC)
    expect(dogodki).toBe(3)
    expect((ics.match(/BEGIN:VEVENT\r\n/g) ?? []).length).toBe(3)
    expect((ics.match(/END:VEVENT\r\n/g) ?? []).length).toBe(3)
    expect(dogodki).toBe(koledarPovzetek(VHODI).preglediN)
  })

  it('dogodki v koledarskem redu (f(množica) — ISTI sort kot bratje)', () => {
    const { ics } = koledarPregledovIcs(VHODI, NOW_UTC)
    const povzetki = (ics.match(/SUMMARY:Pregled: [^\r]*/g) ?? []).map((s) =>
      s.slice('SUMMARY:Pregled: '.length),
    )
    expect(povzetki).toEqual(['Anže Test', 'Berta', 'Kokalj'])
    // sort identičen klicu brata
    expect(sortirajKoledar(VHODI).map((p) => p.ime)).toEqual([
      'Anže Test',
      'Berta',
      'Kokalj',
    ])
  })

  it('determinizem: premešan vhod = bajtno isti ICS', () => {
    const a = koledarPregledovIcs(VHODI, NOW_UTC).ics
    const premesano = [VHODI[2], VHODI[0], VHODI[1]]
    const b = koledarPregledovIcs(premesano, NOW_UTC).ics
    expect(b).toBe(a)
  })
})

describe('R296 — datum + žig projekcije (EN VIR resnica)', () => {
  it('DTSTART = opomnikDatum basic; DTEND = naslednji dan (ekskluziven)', () => {
    const { ics } = koledarPregledovIcs(VHODI, NOW_UTC)
    expect(lastnost(ics, 'DTSTART;VALUE=DATE:20260914')).toBeDefined() // Anže (najbližji — POTEKEL)
    expect(lastnost(ics, 'DTEND;VALUE=DATE:20260915')).toBeDefined()
    expect(lastnost(ics, 'DTSTART;VALUE=DATE:20260923')).toBeDefined() // Berta
    expect(lastnost(ics, 'DTEND;VALUE=DATE:20260924')).toBeDefined()
    expect(lastnost(ics, 'DTSTART;VALUE=DATE:20260924')).toBeDefined() // Kokalj
    expect(lastnost(ics, 'DTEND;VALUE=DATE:20260925')).toBeDefined()
  })

  it('DTSTAMP = now KOT PARAMETER (UTC basic — odvisno od časa, ne pasa)', () => {
    const { ics } = koledarPregledovIcs(VHODI, NOW_UTC)
    expect(lastnost(ics, 'DTSTAMP:')).toBe('DTSTAMP:20260921T100000Z')
    const drugi = koledarPregledovIcs(VHODI, new Date('2026-12-31T23:59:59Z')).ics
    expect(lastnost(drugi, 'DTSTAMP:')).toBe('DTSTAMP:20261231T235959Z')
  })

  it('UID determinističen iz (koledarski red, datum) — isti vhod = isti UID', () => {
    const { ics } = koledarPregledovIcs(VHODI, NOW_UTC)
    expect(lastnost(ics, 'UID:')).toBe('UID:pregled-001-20260914@roksal.local')
    expect((ics.match(/UID:pregled-002-20260923@roksal.local/g) ?? []).length).toBe(1)
    expect((ics.match(/UID:pregled-003-20260924@roksal.local/g) ?? []).length).toBe(1)
  })

  it("DESCRIPTION = iskrena vrstica: status · 'Dni do' (EN VIR koledarDniDo) · telefon · opis z '—' za null", () => {
    const { ics } = koledarPregledovIcs(VHODI, NOW_UTC)
    // pričakovanja IZ EN VIR funkcij (lekcija R295 — ne iz glave)
    const anzeDni = koledarDniDo(VHODI[1], NOW_UTC) // Anže Test = POTEKEL
    const bertaDni = koledarDniDo(VHODI[2], NOW_UTC) // Berta = 2. v koledarskem redu
    const anzeOpis = lastnost(ics, 'DESCRIPTION:')
    expect(anzeOpis).toContain('Status: POTEKEL')
    expect(anzeOpis).toContain(`Dni do: ${anzeDni}`)
    expect(anzeOpis).toContain('Telefon: —')
    expect(anzeOpis).toContain('Opis: —')
    const opisi = ics
      .replace(/\r\n /g, '')
      .split('\r\n')
      .filter((v) => v.startsWith('DESCRIPTION:'))
    expect(opisi).toHaveLength(3)
    expect(opisi[1]).toContain('Status: AKTIVEN') // Berta
    expect(opisi[1]).toContain(`Dni do: ${bertaDni}`)
    expect(opisi[1]).toContain('Telefon: 041 444 555')
    expect(opisi[1]).toContain('Opis: Pol leta kontrola')
    expect(opisi[2]).toContain('Telefon: 041 222 333') // Kokalj
    expect(opisi[2]).toContain('Opis: Letni pregled ograje')
  })

  it('X-ROKSAL-STATUS = VERBATIM iz API-ja (X- prostor — RFC STATUS semantika NE izmišljena)', () => {
    const { ics } = koledarPregledovIcs(VHODI, NOW_UTC)
    const unfolded = ics.replace(/\r\n /g, '')
    const statusi = unfolded
      .split('\r\n')
      .filter((v) => v.startsWith('X-ROKSAL-STATUS:'))
      .map((v) => v.slice('X-ROKSAL-STATUS:'.length))
    expect(statusi).toEqual(['POTEKEL', 'AKTIVEN', 'AKTIVEN'])
    expect(unfolded).not.toContain('STATUS:CONFIRMED')
    expect(unfolded).not.toContain('STATUS:TENTATIVE')
  })
})

describe('R296 — RFC 5545 oblika (§3.3.11 + §3.1 + CRLF + brez BOM)', () => {
  it('izpustni znaki: vejica, podpičje, poševnica nazaj, nova vrstica', () => {
    const posebni: KoledarPregledVnos[] = [
      {
        ime: 'Novak, d.o.o.; podružnica',
        naslov: 'Cesta \\ 5, Kranj',
        telefon: null,
        kontaktnaOseba: null,
        opomnikDatum: '2026-09-24',
        opomnikOpis: 'Prva vrstica\nDruga vrstica',
        opomnikStatus: 'AKTIVEN',
      },
    ]
    const { ics } = koledarPregledovIcs(posebni, NOW_UTC)
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain('SUMMARY:Pregled: Novak\\, d.o.o.\\; podružnica')
    expect(unfolded).toContain('LOCATION:Cesta \\\\ 5\\, Kranj')
    expect(unfolded).toContain('Opis: Prva vrstica\\nDruga vrstica')
  })

  it('CRLF zaključki — vsak novi vrstici predhodi \\r (brez golih \\n)', () => {
    const { ics } = koledarPregledovIcs(VHODI, NOW_UTC)
    expect(ics.match(/(?<!\r)\n/g)).toBeNull()
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('BREZ BOM (dokumentiran odstopek od CSV bratov — koledarski potrošniki)', () => {
    const { ics } = koledarPregledovIcs(VHODI, NOW_UTC)
    expect(ics.startsWith('\uFEFF')).toBe(false)
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
  })

  it('zavijanje ≤ 75 oktetov (UTF-8) — razvitje rekonstruira logično vrstico; čšž se nikoli ne preseka', () => {
    const dolg: KoledarPregledVnos[] = [
      {
        ime: 'Zgodovinska zadruga kmetijskih in gospodarskih zadrug z dolgim imenom d.d.',
        naslov:
          'Šmartinska cesta čšž 152a, 1000 Ljubljana, Slovenija, področje številka triindvajset, vzidana ograja',
        telefon: null,
        kontaktnaOseba: null,
        opomnikDatum: '2026-09-24',
        opomnikOpis:
          'Dolgi opis pregleda: nadzorstvo nad vgradnjo stebrjev, merjenje razponov, kontrola vijakov in zatesnitve steklenih polč ter končna predaja z zapisnikom',
        opomnikStatus: 'AKTIVEN',
      },
    ]
    const { ics } = koledarPregledovIcs(dolg, NOW_UTC)
    const fyzicne = ics.split('\r\n')
    let nadaljevanja = 0
    for (const v of fyzicne) {
      const okteti = new TextEncoder().encode(v).length
      expect(okteti).toBeLessThanOrEqual(75)
      // vsaka fizična vrstica = veljaven UTF-8 (razrez po mejah znakov —
      // čšž in surrogatni pari se nikoli ne presekajo na polovici)
      expect(new TextDecoder().decode(new TextEncoder().encode(v))).toBe(v)
      if (v.startsWith(' ')) nadaljevanja += 1
    }
    expect(nadaljevanja).toBeGreaterThan(0)
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain(
      'LOCATION:Šmartinska cesta čšž 152a\\, 1000 Ljubljana\\, Slovenija\\, področje številka triindvajset\\, vzidana ograja',
    )
    // resničen kratek vhod (vsaka logična vrstica < 75 oktetov) = brez zavijanja
    const kratki: KoledarPregledVnos[] = [
      {
        ime: 'Kratek',
        naslov: 'Cesta 1',
        telefon: null,
        kontaktnaOseba: null,
        opomnikDatum: '2026-09-24',
        opomnikOpis: null,
        opomnikStatus: 'AKTIVEN',
      },
    ]
    const { ics: kratek } = koledarPregledovIcs(kratki, NOW_UTC)
    expect(kratek.split('\r\n').every((v) => !v.startsWith(' '))).toBe(true)
  })
})

describe('R296 — ime + fail-closed (družinska pravila)', () => {
  it('deterministično ime: Koledar-pregledov-YYYY-MM-DD.ics (družinski vzorec)', () => {
    expect(koledarPregledovIcsFilename(NOW_LOCALNO)).toBe(
      'Koledar-pregledov-2026-09-21.ics',
    )
  })

  it('fail-closed ×5: prazno / ne-polje / pokvaren now / pokvaren status / pokvaren datum', () => {
    expect(() => koledarPregledovIcs([], NOW_UTC)).toThrowError(TypeError)
    expect(() => koledarPregledovIcs([], NOW_UTC)).toThrowError(/prazen koledar/)
    expect(() =>
      koledarPregledovIcs(VHODI as unknown as KoledarPregledVnos[], 'ne-datum' as unknown as Date),
    ).toThrowError(TypeError)
    expect(() =>
      koledarPregledovIcs(VHODI, new Date('neveljaven')),
    ).toThrowError(TypeError)
    const pokvarenStatus = [{ ...VHODI[0], opomnikStatus: 'NI' as unknown as 'AKTIVEN' }]
    expect(() => koledarPregledovIcs(pokvarenStatus, NOW_UTC)).toThrowError(TypeError)
    expect(() => koledarPregledovIcs(pokvarenStatus, NOW_UTC)).toThrowError(/opomnikStatus/)
    const pokvarenDatum = [{ ...VHODI[0], opomnikDatum: '24. 9. 2026' }]
    expect(() => koledarPregledovIcs(pokvarenDatum, NOW_UTC)).toThrowError(TypeError)
    expect(() => koledarPregledovIcs(pokvarenDatum, NOW_UTC)).toThrowError(/opomnikDatum/)
  })
})

describe('R296 — STRAŽAR: ICS povezava v crm-tab (tihe odstranitve NE gredo skozi)', () => {
  const crmSrc = readFileSync(
    resolve(__dirname, '../../../src/components/roksal/crm-tab.tsx'),
    'utf8',
  )

  it('crm-tab uvaža ICS brata + splošni prenosnik (26. člen povezan)', () => {
    expect(crmSrc).toContain("from '@/lib/koledar-pregledov-ics'")
    expect(crmSrc).toContain('koledarPregledovIcs(')
    expect(crmSrc).toContain('koledarPregledovIcsFilename(')
    expect(crmSrc).toContain("downloadTextFile(ime, ics, 'text/calendar;charset=utf-8')")
  })

  it('pill + fail-closed gate + dvoklik guard + F2 definicijski naslovi', () => {
    expect(crmSrc).toContain('Koledar ICS')
    expect(crmSrc).toContain('aria-label="Izvozi koledar pregledov kot ICS"')
    expect(crmSrc).toContain('koledarIcsVTeku')
    expect(crmSrc).toContain('ICS se izvozi, ko je vpisan prvi datum pregleda.')
    // R296 stil — definicijski naslovi F2 mini-vrstice (izrečena resnica)
    expect(crmSrc).toContain(
      'title="Vse stranke z vpisanim datumom pregleda (AKTIVEN + POTEKEL) — koledarski red (najbližji pregled prvi)"',
    )
    expect(crmSrc).toContain(
      'title="Pregledi v naslednjih 7 dneh (kanon opomnika — isto okno kot ruta izračuna AKTIVEN)"',
    )
    expect(crmSrc).toContain(
      'title="Datum pregleda je že pretekel (opomnikDatum < danes)"',
    )
  })
})
