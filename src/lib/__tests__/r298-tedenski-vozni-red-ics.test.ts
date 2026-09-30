// ---------------------------------------------------------------------------
// R298 — TEDENSKI VOZNI RED ICS (28. člen 'izvozi' družine) — ICS brat PDF
// R256 + CSV R292. Dokazi:
//  • glava = VERBATIM VCALENDAR 2.0 (VERSION/PRODID/CALSCALE/METHOD) +
//    X-ROKSAL-OBSEG (ISTI obseg izpis kot CSV meta 'Obseg');
//  • dogodki = tedenskiRazgled EN VIR (TRETJI potrošnik ISTEGA razgleda:
//    strip R292 + CSV R292 + ICS R298) — f(MNOŽICA): premešan vhod = bajtno
//    isti ICS; termini IZVEN okna izključeni (okno = resnica izvoza);
//  • DTSTART projekcija ISTEGA trenutka (UTC 'Z' — nič preslikave v pas);
//    DTEND = ISTA semantika kot R139/R172 (resničn konec → predvidene ure →
//    zero-length marker — NIKOLI izmišljen konec brez kanona);
//  • STATUS preslikava ISTA kot R139/R172 (CANCELLED/TENTATIVE/CONFIRMED) +
//    X-ROKSAL-STATUS VERBATIM;
//  • UID/DTSTAMP deterministična (now KOT PARAMETER — F4); prazno okno =
//    VELJAVEN vhod (domain pravilo tedenske družine R256/R292 — okno VEDNO
//    obstaja; DOKUMENTIRANA divergenca od R296, ki je koledar-domain);
//  • RFC 5545 §3.3.11 izpustni znaki (, ; \ \n) + §3.1 zavijanje ≤ 75
//    oktetov (UTF-8 — čšž se nikoli ne preseka) + CRLF + BREZ BOM;
//  • fail-closed: ne-polje / pokvaren vnos (indeks krivca) / pokvaren now →
//    TypeError;
//  • STRAŽAR nad REALNIM logistics-tab: ICS izvoz ostaja (import + handler +
//    pill + MIME + dvoklik guard + fail-closed toast + legenda + definicijski
//    naslovi R298) — tihe odstranitve NE gredo skozi; ENA-izpeljava gete nad
//    ICS libom (tedenskiRazgled + koledar-pregledov-ics mašinerija UVOŽENA).
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  tedenskiVozniRedIcs,
  tedenskiVozniRedIcsVrstice,
  tedenskiVozniRedIcsFilename,
  tedenskiVozniRedIcsNajdaljsaVrsticaOkteti,
  TEDENSKI_VOZNI_RED_ICS_PRODID,
} from '../tedenski-vozni-red-ics'
import { icsUtc } from '../ics'
import { SCHEDULE_TERMINI_STATUS_LABELS } from '../termini-prikaz'
import { vozniRedCasOkno } from '../logistika-vozni-red-pdf'
import { cenikDatumIso } from '../cenik-pdf'
import type { VozniRedTermin } from '../logistika-vozni-red-pdf'

/** UTC referenčni trenutek — okno = 2026-09-21 .. 2026-09-27 (danes + 6, UTC). */
const NOW_UTC = new Date('2026-09-21T10:00:00Z')
/** Lokalni referenčni trenutek za ime datoteke (ISTI vzorec kot R296 brat). */
const NOW_LOCALNO = new Date(2026, 8, 21, 10, 0, 0) // 21. 9. 2026, 10:00

/** Konstruktor vzorca — privzeti = iskrena manjkajoča resnica (null). */
function termin(p: Partial<VozniRedTermin> & { datumZacetka: string }): VozniRedTermin {
  return {
    datumKonca: null,
    status: 'NAVRTENO',
    predvideneUre: null,
    projekt: null,
    stranka: null,
    ekipa: null,
    lokacija: null,
    ...p,
  }
}

const VHODI: VozniRedTermin[] = [
  // A — 22. 9., resničn konec (datumKonca) + vse resnice vpisane
  termin({
    datumZacetka: '2026-09-22T08:00:00Z',
    datumKonca: '2026-09-22T11:00:00Z',
    status: 'NAVRTENO',
    predvideneUre: 3,
    projekt: 'Ograja Kranj',
    stranka: 'Kokalj',
    ekipa: 'Ekipa A',
    lokacija: 'Cesta 1, Kranj',
  }),
  // B — ISTI dan kot A, prej (06:00) — dokaz dnevnega reda (sortirajVozniRed)
  termin({
    datumZacetka: '2026-09-22T06:00:00Z',
    status: 'V_TEKU',
    predvideneUre: 4,
    projekt: 'Balkon, Ljubljana',
  }),
  // C — 23. 9., preklicani + vse manjkajoče ('—' resnica) + sekunde v ISO
  termin({
    datumZacetka: '2026-09-23T14:30:30Z',
    status: 'PREKlicANO',
  }),
  // D — 25. 9., ISO BREZ sekund (privzeti '00') + 0 ur (zero-length DTEND)
  termin({
    datumZacetka: '2026-09-25T07:15',
    status: 'PRELOZENO',
    predvideneUre: 0,
  }),
  // E — IZVEN okna (pred oknom) — izključen
  termin({ datumZacetka: '2026-09-20T08:00:00Z', projekt: 'Zunaj okno prej' }),
  // F — IZVEN okna (za oknom) — izključen
  termin({ datumZacetka: '2026-09-28T08:00:00Z', projekt: 'Zunaj okno za' }),
]

/** Vrne LOGIČNO vrstico po predponi lastnosti (unfold: odstrani RFC zavijanje). */
function lastnost(ics: string, ime: string): string | undefined {
  const unfolded = ics.replace(/\r\n /g, '')
  const vrstice = unfolded.split('\r\n')
  return vrstice.find((v) => v.startsWith(ime))
}

describe('R298 — glava + struktura (VERBATIM)', () => {
  it('glava: VERSION:2.0 + PRODID konstanta + CALSCALE + METHOD + X-ROKSAL-OBSEG', () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    const vrstice = ics.split('\r\n').filter((v) => v !== '')
    expect(vrstice[0]).toBe('BEGIN:VCALENDAR')
    expect(vrstice[1]).toBe('VERSION:2.0')
    expect(vrstice[2]).toBe(`PRODID:${TEDENSKI_VOZNI_RED_ICS_PRODID}`)
    expect(vrstice[3]).toBe('CALSCALE:GREGORIAN')
    expect(vrstice[4]).toBe('METHOD:PUBLISH')
    // X-ROKSAL-OBSEG = ISTI obseg izpis kot CSV meta vrstica 'Obseg'
    // (RFC §3.3.11: vejica v TEXT vrednosti je IZPUŠTENA — vsebina ISTA)
    expect(lastnost(ics, 'X-ROKSAL-OBSEG:')).toBe(
      `X-ROKSAL-OBSEG:Naslednjih 7 dni: ${cenikDatumIso('2026-09-21')} – ${cenikDatumIso('2026-09-27')} (danes + 6 dni\\, UTC)`,
    )
    expect(vrstice[vrstice.length - 1]).toBe('END:VCALENDAR')
  })

  it('CRLF zaključki + BREZ BOM + zaključi z END:VCALENDAR + CRLF (družina ICS)', () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    expect(ics.startsWith('\ufeff')).toBe(false)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.includes('\n')).toBe(true) // CRLF obvezno prisoten
    for (const v of ics.split('\r\n')) {
      if (v !== '') expect(v.endsWith('\r')).toBe(false) // nič UKRATKIH \n
    }
  })

  it('VEVENT števec = termini v oknu; izven okna IZKLJUČENI; dogodki števec = ISTI', () => {
    const { ics, dogodki } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    const vevent = ics.split('\r\n').filter((v) => v === 'BEGIN:VEVENT')
    expect(vevent.length).toBe(4)
    expect(dogodki).toBe(4)
    expect(ics).not.toContain('Zunaj okno prej')
    expect(ics).not.toContain('Zunaj okno za')
  })

  it('red = okno ASC × sortirajVozniRed znotraj dneva (B 06:00 pred A 08:00)', () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    const indeks = (del: string) => ics.indexOf(del)
    // NOTE: vejica v vrednosti je RFC-izpuščena (\,) — primerjamo po predponi
    expect(indeks('Balkon')).toBeGreaterThan(-1)
    expect(indeks('Balkon')).toBeLessThan(indeks('Ograja Kranj'))
    expect(indeks('Ograja Kranj')).toBeLessThan(indeks('UID:vozni-red-003'))
    expect(indeks('UID:vozni-red-003')).toBeLessThan(indeks('UID:vozni-red-004'))
  })
})

describe('R298 — DTSTART/DTEND projekcija (termin-domna kanon R139/R172)', () => {
  it("DTSTART = UTC Basic Z projekcija ISTEGA trenutka (sekunde privzeti 00)", () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    expect(lastnost(ics, 'DTSTART:20260922T080000Z')).toBe('DTSTART:20260922T080000Z')
    // D — ISO brez sekund → privzeti '00' (ISTA projekcija, nič izmišljenega)
    expect(lastnost(ics, 'DTSTART:20260925T071500Z')).toBe('DTSTART:20260925T071500Z')
  })

  it('DTEND (1): datumKonca ≠ null → resnično vpisan konec', () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    expect(lastnost(ics, 'DTEND:20260922T110000Z')).toBe('DTEND:20260922T110000Z')
  })

  it('DTEND (2): konec manjka + predvideneUre ≥ 1 → DTSTART + ure (R172 icsKonec EN VIR)', () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    // B: 06:00 + 4 h = 10:00 — pričakovanje IZ ISTEGA vira kot R172 (icsUtc)
    expect(lastnost(ics, 'DTEND:20260922T100000Z')).toBe('DTEND:20260922T100000Z')
    expect(icsUtc(new Date('2026-09-22T06:00:00Z'))).toBe('20260922T060000Z')
  })

  it('DTEND (3): konec + ure neznana (null/0) → zero-length marker = DTSTART', () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    // C: ure null → DTSTART (zero-length marker — konec vir NE pozna)
    expect(lastnost(ics, 'DTEND:20260923T143030Z')).toBe('DTEND:20260923T143030Z')
    // D: ure 0 → prav tako zero-length (0 ni > 0)
    expect(lastnost(ics, 'DTEND:20260925T071500Z')).toBe('DTEND:20260925T071500Z')
  })
})

describe('R298 — iskrene celice (WYSIWYG ISTA resnica kot PDF/CSV bratje)', () => {
  it("SUMMARY = projekt, '—' pri null; LOCATION = lokacija, '—' pri null", () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    expect(lastnost(ics, 'SUMMARY:Ograja Kranj')).toBe('SUMMARY:Ograja Kranj')
    // C: projekt null → iskren '—' (NIKOLI izmišljen naziv)
    expect(lastnost(ics, 'SUMMARY:—')).toBe('SUMMARY:—')
    expect(lastnost(ics, 'LOCATION:Cesta 1\\, Kranj')).toBe('LOCATION:Cesta 1\\, Kranj')
  })

  it('DESCRIPTION = ISTI prikazi kot CSV stolpci (status label · ekipa · stranka · čas · ure)', () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    const a = VHODI[0]
    expect(lastnost(ics, `DESCRIPTION:Status: ${SCHEDULE_TERMINI_STATUS_LABELS[a.status]}`)).toBe(
      `DESCRIPTION:Status: ${SCHEDULE_TERMINI_STATUS_LABELS[a.status]} · Ekipa: Ekipa A · Stranka: Kokalj · Čas: ${vozniRedCasOkno(a)} · Predvidene ure: 3`,
    )
    // C: vse manjkajoče → '—' resnica (status label + tri '—' + '—' ure)
    expect(
      lastnost(ics, `DESCRIPTION:Status: ${SCHEDULE_TERMINI_STATUS_LABELS.PREKlicANO}`),
    ).toBe(
      `DESCRIPTION:Status: ${SCHEDULE_TERMINI_STATUS_LABELS.PREKlicANO} · Ekipa: — · Stranka: — · Čas: 14:30 · Predvidene ure: —`,
    )
  })

  it('STATUS = preslikava R139/R172 (CANCELLED/TENTATIVE/CONFIRMED) + X-ROKSAL-STATUS VERBATIM', () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    expect(lastnost(ics, 'STATUS:CANCELLED')).toBe('STATUS:CANCELLED') // PREKlicANO (C)
    expect(lastnost(ics, 'STATUS:TENTATIVE')).toBe('STATUS:TENTATIVE') // PRELOZENO (D)
    expect(lastnost(ics, 'STATUS:CONFIRMED')).toBe('STATUS:CONFIRMED') // A/B (NAVRTENO/V_TEKU)
    // X- = VIR resnica (VERBATIM API status — ob LASTNIM STATUS-om)
    expect(lastnost(ics, 'X-ROKSAL-STATUS:PREKlicANO')).toBe('X-ROKSAL-STATUS:PREKlicANO')
    expect(lastnost(ics, 'X-ROKSAL-STATUS:PRELOZENO')).toBe('X-ROKSAL-STATUS:PRELOZENO')
  })
})

describe('R298 — determinizem (F4 + f(množica))', () => {
  it('UID determinističen + unikaten (vozni-red-<nnn>-<start>@roksal); DTSTAMP iz now parametra', () => {
    const { ics } = tedenskiVozniRedIcs(VHODI, NOW_UTC)
    const uidi = ics.split('\r\n').filter((v) => v.startsWith('UID:'))
    expect(uidi.length).toBe(4)
    expect(new Set(uidi).size).toBe(4)
    expect(uidi[0]).toBe('UID:vozni-red-001-20260922T060000Z@roksal')
    expect(lastnost(ics, 'DTSTAMP:')).toBe('DTSTAMP:20260921T100000Z')
    // F4: DTSTAMP sledi now parametru (NE strojni uri) — ISTI dan, druga
    // sekunda (okno NE sme obstati: DTSTAMP je lastnost VSAKEGA VEVENT-a)
    const drugiNow = new Date('2026-09-21T10:00:01Z')
    const { ics: ics2 } = tedenskiVozniRedIcs(VHODI, drugiNow)
    expect(lastnost(ics2, 'DTSTAMP:')).toBe('DTSTAMP:20260921T100001Z')
  })

  it('premešan vhod = bajtno ISTI ICS (f(MNOŽICA) — sort + okno filtrirata)', () => {
    const ena = tedenskiVozniRedIcs(VHODI, NOW_UTC).ics
    const premesano = [VHODI[5], VHODI[2], VHODI[0], VHODI[4], VHODI[3], VHODI[1]]
    const dva = tedenskiVozniRedIcs(premesano, NOW_UTC).ics
    expect(dva).toBe(ena)
  })

  it('ime datoteke deterministično: Tedenski-vozni-red-YYYY-MM-DD.ics (F4)', () => {
    expect(tedenskiVozniRedIcsFilename(NOW_LOCALNO)).toBe('Tedenski-vozni-red-2026-09-21.ics')
    expect(tedenskiVozniRedIcsFilename(new Date(2027, 0, 2))).toBe('Tedenski-vozni-red-2027-01-02.ics')
  })
})

describe('R298 — RFC 5545 oblika (izpustni znaki + zavijanje)', () => {
  it('§3.3.11 izpustni znaki: ; , \\ v vrednostih (SUMMARY/LOCATION/DESCRIPTION)', () => {
    const vtisi = termin({
      datumZacetka: '2026-09-22T08:00:00Z',
      projekt: 'Ograja; "verzija" 2, pohištvo \\ test',
      lokacija: 'Cesta; 5, Kranj',
    })
    const { ics } = tedenskiVozniRedIcs([vtisi], NOW_UTC)
    expect(lastnost(ics, 'SUMMARY:')).toBe('SUMMARY:Ograja\\; "verzija" 2\\, pohištvo \\\\ test')
    expect(lastnost(ics, 'LOCATION:')).toBe('LOCATION:Cesta\\; 5\\, Kranj')
  })

  it('§3.1 zavijanje: VSAKA fizična vrstica ≤ 75 oktetov; čšž se ne preseka; unfold obnovi vsebino', () => {
    const dolgi = termin({
      datumZacetka: '2026-09-22T08:00:00Z',
      projekt: 'Ščuka čež žep ' + 'dolg opis čšžČŠŽ '.repeat(30),
    })
    const vrstice = tedenskiVozniRedIcsVrstice([dolgi], NOW_UTC)
    expect(tedenskiVozniRedIcsNajdaljsaVrsticaOkteti(vrstice)).toBeLessThanOrEqual(75)
    // zavitek = nadaljevanje s presledkom (RFC §3.1) — vsaj ena fizična vrstica
    // se začne s presledkom
    expect(vrstice.some((v) => v.startsWith(' '))).toBe(true)
    // unfold obnovi logično vrstico brez izgube (čšž celotna)
    const { ics } = tedenskiVozniRedIcs([dolgi], NOW_UTC)
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain('dolg opis čšžČŠŽ')
  })
})

describe('R298 — prazno okno + fail-closed', () => {
  it('PRAZNO okno = VELJAVEN vhod: VCALENDAR z 0 VEVENT (domain pravilo R256/R292)', () => {
    const { ics, dogodki } = tedenskiVozniRedIcs([], NOW_UTC)
    const vrstice = ics.split('\r\n').filter((v) => v !== '')
    expect(vrstice[0]).toBe('BEGIN:VCALENDAR')
    expect(vrstice[vrstice.length - 1]).toBe('END:VCALENDAR')
    expect(dogodki).toBe(0)
    expect(ics).not.toContain('BEGIN:VEVENT')
    // obseg okna je IZKAZAN tudi pri praznem oknu (iskrena ničla)
    expect(lastnost(ics, 'X-ROKSAL-OBSEG:')).toContain('21.09.2026')
  })

  it('fail-closed: ne-polje → TypeError', () => {
    expect(() => tedenskiVozniRedIcs('ni polje' as unknown as VozniRedTermin[], NOW_UTC)).toThrow(
      TypeError,
    )
  })

  it('fail-closed: pokvaren vnos → TypeError z indeksom krivca (uvožen pregled)', () => {
    const pokvaren = termin({ datumZacetka: '22.09.2026 08:00', projekt: 'X' })
    expect(() => tedenskiVozniRedIcs([pokvaren], NOW_UTC)).toThrow(/preveriVozniRedTermin \(0\)/)
  })

  it('fail-closed: pokvaren now → TypeError (vse tri vstopne točke)', () => {
    const pokvarenNow = new Date('ni datum') as Date
    expect(() => tedenskiVozniRedIcs(VHODI, pokvarenNow)).toThrow(TypeError)
    expect(() => tedenskiVozniRedIcsVrstice(VHODI, pokvarenNow)).toThrow(TypeError)
    expect(() => tedenskiVozniRedIcsFilename(pokvarenNow)).toThrow(TypeError)
  })
})

describe('R298 — STRAŽAR nad realnim logistics-tab (tihe odstranitve NE gredo skozi)', () => {
  const TAB = readFileSync(
    resolve(__dirname, '../../components/roksal/logistics-tab.tsx'),
    'utf-8',
  )

  it('import + handler + dvoklik guard + MIME resnica so ŽIVO ožičeni', () => {
    expect(TAB).toContain("from '@/lib/tedenski-vozni-red-ics'")
    expect(TAB).toContain('const handleTedenskiIcs = () => {')
    expect(TAB).toContain('if (tedenskiIcsVTeku) return')
    expect(TAB).toContain('disabled={tedenskiIcsVTeku}')
    expect(TAB).toContain("downloadTextFile(ime, ics, 'text/calendar;charset=utf-8')")
    expect(TAB).toContain('tedenskiVozniRedIcsFilename(now)')
  })

  it('pill VEDNO viden + fail-closed toast pri praznem oknu (P1-k/R232 kanon)', () => {
    expect(TAB).toContain('aria-label="Izvozi tedenski pregled montaž kot ICS koledar"')
    expect(TAB).toContain('Ni terminov v naslednjih 7 dneh')
    expect(TAB).toContain('ICS se izvozi, ko je vpisan termin v prihajajočem tednu.')
    expect(TAB).toContain('Izvoz ICS ni uspel')
    expect(TAB).toContain('Tedenski vozni red prenešen v ICS')
  })

  it('legenda + definicijski naslovi R298 (MANDATORY STIL — izrečene izpeljave)', () => {
    expect(TAB).toContain('Tedenski ICS = naslednjih 7 dni v telefonov koledar')
    expect(TAB).toContain('Brez terminov — iskreno prazen dan')
    expect(TAB).toContain('preklicani ŠTETI — viden odpad')
    expect(TAB).toContain('(danes + ${razgled.okno.indexOf(d.dan)} dni, UTC)')
  })

  it('ENA izpeljava gete: ICS lib uvaža tedenskiRazgled (TRETJI potrošnik) + R296 mašinerijo + icsUtc EN VIR', () => {
    const LIB = readFileSync(resolve(__dirname, '../tedenski-vozni-red-ics.ts'), 'utf-8')
    expect(LIB).toContain("import { tedenskiRazgled } from './tedenski-vozni-red-csv'")
    expect(LIB).toContain("from './koledar-pregledov-ics'")
    expect(LIB).toContain("import { icsUtc } from './ics'")
    // R296 brat mora ostati mirujoč potrošnik teh izvozov (additivni export)
    const BRAT = readFileSync(resolve(__dirname, '../koledar-pregledov-ics.ts'), 'utf-8')
    expect(BRAT).toContain('export function icsBesedilo')
    expect(BRAT).toContain('export function zavijVrstico')
    expect(BRAT).toContain('export function icsZigUtc')
    expect(BRAT).toContain('export function utf8Okteti')
  })
})
