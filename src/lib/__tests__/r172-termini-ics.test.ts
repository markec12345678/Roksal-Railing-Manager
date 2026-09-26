// R172 — .ics koledarski izvoz prikazanih terminov (P1-d iz R171) + RFC 5545
// pomožniki izdvojeni v EN VIR (src/lib/ics.ts, refaktor R139).
// ---------------------------------------------------------------------------
// IZVOŽENO = ZASLON: buildTerminiIcs izvozi NATAKO prikazane vrstice (danes +
// kasneje v prikaznem vrstnem redu; filter 'Samo moje' je že v njih), DTSTAMP
// je ISTI pečat `zdaj` kot CSV 'Izvoženo ob'. Iskrenost: manjkajoči podatki →
// vrstica opisa izpuščena (nikoli izmišljenih 'Ni …'); brez znane ure →
// DTEND = DTSTART (zero-length marker, nikoli izmišljenega trajanja); znana
// ura → DTEND = DTSTART + ure. Fail-closed povsod. Determinizem: isti vhod →
// bajtno identična datoteka.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildTerminiIcs, terminiIcsFilename } from '@/lib/termini-ics'
import { icsEscape, icsFold, icsUtc } from '@/lib/ics'
import type { TerminPrikazVnos } from '@/lib/termini-prikaz'

const terminiCard = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/termini-card.tsx'), 'utf8')

const logistics = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/logistics-tab.tsx'), 'utf8')

const icsLib = (): string => readFileSync(join(process.cwd(), 'src/lib/ics.ts'), 'utf8')

const vnos = (over: Partial<TerminPrikazVnos> = {}): TerminPrikazVnos => ({
  id: 't1',
  projectId: 'p1',
  projektIme: 'Nadstropna ograja, Kranj',
  strankaIme: 'Novak d.o.o.',
  strankaNaslov: 'Cesta 1, Kranj',
  lokacija: 'Vhod A',
  ekipaIme: 'Ekipa 1',
  monterId: 'u1',
  monterIme: 'Janez',
  status: 'NAVRTENO',
  datumZacetka: '2026-09-26T08:00:00.000Z',
  predvideneUre: 8,
  moja: true,
  ...over,
})

const ZDAJ = new Date(2026, 8, 26, 12, 0, 0) // 2026-09-26 lokalno poldne

describe('R172 RFC 5545 pomožniki (src/lib/ics.ts) — byte-identičen refaktor R139', () => {
  it('icsEscape: obratna poševnica, podpičje, vejica, nova vrstica', () => {
    expect(icsEscape('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
    expect(icsEscape(' brez sprememb ')).toBe(' brez sprememb ')
  })

  it('icsFold: vrstice > 73 znakov se prelomijo s začetnim presledkom (RFC 5545)', () => {
    const dolga = 'X'.repeat(200)
    const prelomljeno = icsFold(dolga)
    const deli = prelomljeno.split('\r\n')
    expect(deli[0]).toBe('X'.repeat(73))
    expect(deli[1].startsWith(' ')).toBe(true)
    // brez prelomov = brez izgube vsebine (presledki nadomestijo CRLF)
    expect(prelomljeno.replace(/\r\n /g, '').replace(/X/g, '')).toBe('')
    expect(icsFold('kratka')).toBe('kratka')
  })

  it('icsUtc: UTC YYYYMMDDTHHMMSSZ z vodilnimi ničlami; neveljaven datum → TypeError', () => {
    expect(icsUtc('2026-09-26T08:00:00.000Z')).toBe('20260926T080000Z')
    expect(icsUtc(new Date(Date.UTC(2026, 0, 5, 7, 3, 9)))).toBe('20260105T070309Z')
    expect(() => icsUtc('ne-datum')).toThrow(TypeError)
  })

  it('downloadIcsText: MIME text/calendar (isti prenosni kontrakt kot R139 blob)', () => {
    expect(icsLib()).toContain("'text/calendar;charset=utf-8'")
  })
})

describe('R172 buildTerminiIcs — IZVOŽENO = ZASLON', () => {
  it('VCALENDAR glava + VEVENT struktura (UID/DTSTAMP/DTSTART/DTEND/SUMMARY/LOCATION/DESCRIPTION/STATUS)', () => {
    const { ics, dogodkov } = buildTerminiIcs([vnos()], { zdaj: ZDAJ, now: ZDAJ })
    expect(dogodkov).toBe(1)
    expect(ics).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')
    expect(ics).toContain('PRODID:-//Roksal Railing Manager//Termini kartica//SL')
    expect(ics).toContain('X-WR-CALNAME:Roksal termini (7 dni)')
    expect(ics).toContain('UID:termin-t1@roksal')
    expect(ics).toContain('DTSTART:20260926T080000Z')
    // vejica je po RFC 5545 §3.3.11 ubežana (icsEscape)
    expect(ics).toContain('SUMMARY:Montaža: Nadstropna ograja\\, Kranj')
    expect(ics).toContain('LOCATION:Vhod A')
    expect(ics).toContain('END:VEVENT\r\nEND:VCALENDAR\r\n')
  })

  it('DTSTAMP = izrecni zdaj (ISTI pečat kot CSV "Izvoženo ob" — EN VIR RESNICE, determinizem)', () => {
    const { ics } = buildTerminiIcs([vnos()], { zdaj: ZDAJ, now: ZDAJ })
    // TZ-neodvisno: DTSTAMP mora biti TOČNO icsUtc(predanega zdaj)
    expect(ics).toContain(`DTSTAMP:${icsUtc(ZDAJ)}`)
  })

  it('znana predvidena ura → DTEND = DTSTART + ure (predvideno trajanje dela)', () => {
    const { ics } = buildTerminiIcs([vnos({ predvideneUre: 8 })], { zdaj: ZDAJ, now: ZDAJ })
    expect(ics).toContain('DTEND:20260926T160000Z')
  })

  it('brez znane ure → DTEND = DTSTART (zero-length marker, nikoli izmišljenega trajanja)', () => {
    const { ics } = buildTerminiIcs([vnos({ predvideneUre: null })], { zdaj: ZDAJ, now: ZDAJ })
    expect(ics).toContain('DTSTART:20260926T080000Z')
    expect(ics).toContain('DTEND:20260926T080000Z')
  })

  it('SUMMARY brez projektIme → "Montaža" (nikoli izmišljenega "Ni naslova"); LOCATION fallback naslov → prazno', () => {
    const { ics } = buildTerminiIcs(
      [vnos({ projektIme: null, lokacija: null, strankaNaslov: null })],
      { zdaj: ZDAJ, now: ZDAJ }
    )
    expect(ics).toContain('SUMMARY:Montaža\r\n')
    expect(ics).toContain('LOCATION:')
  })

  it('LOCATION fallback: lokacija manjka → strankaNaslov (vzorec R139)', () => {
    const { ics } = buildTerminiIcs([vnos({ lokacija: null })], { zdaj: ZDAJ, now: ZDAJ })
    // vejica ubežana (RFC 5545 §3.3.11 TEXT)
    expect(ics).toContain('LOCATION:Cesta 1\\, Kranj')
  })

  it('DESCRIPTION: fiksni vrstni red, manjkajoči podatki → vrstica IZPUŠČENA (vzorec deljenega besedila R167)', () => {
    const polno = buildTerminiIcs([vnos()], { zdaj: ZDAJ, now: ZDAJ }).ics
    // RFC 5545 unfold (dolge vrstice so prelomljene z CRLF+presledek), potem
    // icsEscape je novico pretvoril v literal \n
    const odvito = polno.replace(/\r\n /g, '')
    const opisPolno = odvito.split('DESCRIPTION:')[1].split('\r\n')[0]
    const dela = opisPolno.split('\\n')
    expect(dela[0]).toBe('Dan: Danes')
    expect(dela[1]).toBe('Stranka: Novak d.o.o.')
    expect(dela[2]).toBe('Ekipa: Ekipa 1')
    expect(dela[3]).toBe('Monter: Janez')
    expect(dela[4]).toBe('Predvidene ure: 8')
    expect(dela[5]).toBe('Status: Načrtovano')

    const redko = buildTerminiIcs(
      [vnos({ strankaIme: null, ekipaIme: null, monterIme: null, predvideneUre: null })],
      { zdaj: ZDAJ, now: ZDAJ }
    ).ics
    const opisRedko = redko.replace(/\r\n /g, '').split('DESCRIPTION:')[1].split('\r\n')[0].split('\\n')
    expect(opisRedko).toEqual(['Dan: Danes', 'Status: Načrtovano'])
  })

  it('STATUS preslikava = ISTA kot R139: PREKlicANO→CANCELLED, PRELOZENO→TENTATIVE, ostalo→CONFIRMED', () => {
    const vrstice = [
      vnos({ id: 'a', status: 'PREKlicANO' }),
      vnos({ id: 'b', status: 'PRELOZENO' }),
      vnos({ id: 'c', status: 'V_TEKU' }),
      vnos({ id: 'd', status: 'ZAKLJUCENO' }),
    ]
    const { ics, dogodkov } = buildTerminiIcs(vrstice, { zdaj: ZDAJ, now: ZDAJ })
    expect(dogodkov).toBe(4)
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics).toContain('STATUS:TENTATIVE')
    expect((ics.match(/STATUS:CONFIRMED/g) || []).length).toBe(2)
  })

  it('kontrakt RFC 5545: CRLF zaključki + zaključni CRLF; prazno polje → samo glava (dogodkov 0)', () => {
    const { ics, dogodkov } = buildTerminiIcs([], { zdaj: ZDAJ, now: ZDAJ })
    expect(dogodkov).toBe(0)
    expect(ics).not.toContain('BEGIN:VEVENT')
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics).not.toMatch(/[^\r]\n/)
  })

  it('determinizem: isti vhod → bajtno identična datoteka (brez skritih ur/naključnih UID)', () => {
    const a = buildTerminiIcs([vnos(), vnos({ id: 't2' })], { zdaj: ZDAJ, now: ZDAJ })
    const b = buildTerminiIcs([vnos(), vnos({ id: 't2' })], { zdaj: ZDAJ, now: ZDAJ })
    expect(a.ics).toBe(b.ics)
  })

  it('fail-closed: pokvarjeni vhodi → TypeError (ne-polje, brez opcij, neveljaven zdaj/now, vnos brez id, neveljaven datum, neznan status)', () => {
    expect(() => buildTerminiIcs(null as unknown as readonly TerminPrikazVnos[], { zdaj: ZDAJ, now: ZDAJ })).toThrow(TypeError)
    expect(() => buildTerminiIcs([vnos()], null as unknown as { zdaj: Date; now: Date })).toThrow(TypeError)
    expect(() =>
      buildTerminiIcs([vnos()], { zdaj: new Date(NaN), now: ZDAJ })
    ).toThrow(TypeError)
    expect(() =>
      buildTerminiIcs([vnos()], { zdaj: ZDAJ, now: 'ne-datum' as unknown as Date })
    ).toThrow(TypeError)
    expect(() =>
      buildTerminiIcs([{ ...vnos(), id: '' }], { zdaj: ZDAJ, now: ZDAJ })
    ).toThrow(TypeError)
    expect(() =>
      buildTerminiIcs([{ ...vnos(), datumZacetka: 'ne-datum' }], { zdaj: ZDAJ, now: ZDAJ })
    ).toThrow(TypeError)
    expect(() =>
      buildTerminiIcs(
        [{ ...vnos(), status: 'NEZNAN' as unknown as TerminPrikazVnos['status'] }],
        { zdaj: ZDAJ, now: ZDAJ }
      )
    ).toThrow(TypeError)
  })

  it('opis/uporablja ISTE oznake kot zaslon: terminDatumLabel (Danes/Jutri) + scheduleTerminiStatusLabel', () => {
    const jutri = new Date(2026, 8, 27, 12, 0, 0)
    const { ics } = buildTerminiIcs(
      [vnos({ datumZacetka: '2026-09-27T08:00:00.000Z' })],
      { zdaj: ZDAJ, now: jutri }
    )
    // gledano z jutrišnjega dne je 27. 09. 'Danes' — ISTA funkcija kot kartica
    expect(ics).toContain('Dan: Danes')
    expect(ics).toContain('Status: Načrtovano')
  })
})

describe('R172 terminiIcsFilename', () => {
  it('deterministično ime, ločeno od logističnega roksal-montaze-*.ics', () => {
    expect(terminiIcsFilename('2026-09-26')).toBe('Termini-7-dni_2026-09-26.ics')
  })

  it('fail-closed: samo ISO datum (YYYY-MM-DD)', () => {
    for (const slab of ['26. 09. 2026', '2026-9-26', '', '20260926', 'abcd-ef-gh']) {
      expect(() => terminiIcsFilename(slab)).toThrow(TypeError)
    }
  })
})

describe('R172 žičenje — Termini kartica .ics + EN VIR RESNICE z logistiko', () => {
  it('kartica importira ISTE lib funkcije (buildTerminiIcs + terminiIcsFilename + downloadIcsText + CalendarPlus)', () => {
    const src = terminiCard()
    expect(src).toContain("from '@/lib/termini-ics'")
    expect(src).toContain('buildTerminiIcs')
    expect(src).toContain('terminiIcsFilename')
    expect(src).toContain("import { downloadIcsText } from '@/lib/ics'")
    expect(src).toContain('CalendarPlus')
  })

  it('izvoziIcs podaja prikazane vrstice + zdaj pečat (EN VIR RESNICE z zaslonom in CSV)', () => {
    const src = terminiCard()
    expect(src).toContain('buildTerminiIcs(vrstice, { zdaj: reference, now: reference })')
    expect(src).toContain('const vrstice = [...prikazane.danes, ...prikazane.kasneje]')
  })

  it('gumb .ics: isti fail-closed vrata kot CSV (brez podatkov onemogočen) + toast potrditev', () => {
    const src = terminiCard()
    expect(src).toContain("aria-label={`Izvozi prikazane termine v koledarsko datoteko (.ics)")
    expect((src.match(/disabled=\{loading \|\| !prikazane \|\| skupnoSkupin === 0\}/g) || []).length).toBe(2)
    expect(src).toContain("'Koledarska datoteka izvožena'")
  })

  it('EN VIR: logistics-tab pomožnike JAME iz src/lib/ics (brez zaseganih kopij — refaktor R172)', () => {
    const src = logistics()
    expect(src).toContain("import { icsEscape, icsFold, icsUtc } from '@/lib/ics'")
    expect(src).not.toContain('function icsEscape(')
    expect(src).not.toContain('function icsFold(')
    expect(src).not.toContain('function icsUtc(')
    // logistični .ics formata NI spremenjen (PRODID + ime datoteke ostajata)
    expect(src).toContain('PRODID:-//Roksal Railing Manager//Logistika//SL')
    expect(src).toContain('roksal-montaze-')
  })
})
