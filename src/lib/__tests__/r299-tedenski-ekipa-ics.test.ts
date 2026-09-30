// ---------------------------------------------------------------------------
// R299 — TEDENSKI VOZNI RED ICS PO EKIPAH (29. člen 'izvozi' družine) —
// izpeljani brat ICS R298. Dokazi:
//  • tedenskiEkipaImena = EN VIR ekip v oknu (UNIQUE, ASC UTF-16 < po kanonu
//    R245/R250 — NIKOLI localeCompare; null ekipe izključene — '—' NI ekipa;
//    f(množica) — premešan vhod = ISTI seznam);
//  • tedenskiEkipaIcs = filter TOČEN (samo termini te ekipe v oknu; ostali
//    IZVEN — tudi ekipa izven okna NE prijavi skrite resnice) + PRODID
//    izpeljanega brata + X-ROKSAL-OBSEG z ' · Ekipa: …' + X-ROKSAL-EKIPA
//    VERBATIM (RFC §3.3.11 izpustni znaki tudi tu) + UID predpona z
//    fnv1a32Hex(ekipa) — trije vzporedni uvozi (osnovni R298 + dve ekipi)
//    se NIKOLI združijo v isti dogodek;
//  • EN VIR povezava z R298: ISTA DTSTART/DTEND/STATUS vrstica za ISTI
//    termin (ekipa ICS = R298 ICS nad filtrirano množico — bajtno primerljivo
//    po vrsticah brez UID/PRODID/obseg/glave);
//  • format konstanta: CRLF + BREZ BOM + END:VCALENDAR + zavijanje ≤ 75
//    oktetov (uvožena samopreverba R298);
//  • domain pravilo R299 (DOKUMENTIRANA divergenca od R298): izvoz obstaja
//    samo za ekipa Z vsaj enim terminom v oknu — neznana/prazna → TypeError
//    z imenom (nikoli prazna datoteka);
//  • ime datoteke + slug deterministična (čšž ostanejo; prazen → 'ekipa');
//  • R298 nazaj-kompatibilnost: tedenskiVozniRedIcs BREZ opcij = R298
//    kontrakt (PRODID R298 + NIKOLI X-ROKSAL-EKIPA vrstica); pokvarene
//    opcije → TypeError (fail-closed);
//  • STRAŽAR nad REALNIM logistics-tab: čipi + handler + guard + MIME +
//    fail-closed toast + legenda + definicijski naslovi — tihe odstranitve
//    NE gredo skozi; ENA-izpeljava gete (ekipa lib uvaža R298 mašinerijo +
//    fnv1a32Hex + pregled; tab uvaža ENO izpeljavo — nič dvojnega).
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  tedenskiEkipaImena,
  tedenskiEkipaIcs,
  tedenskiEkipaIcsFilename,
  tedenskiEkipaSlug,
  TEDENSKI_EKIPA_ICS_PRODID,
} from '../tedenski-vozni-red-ekipa-ics'
import {
  tedenskiVozniRedIcs,
  TEDENSKI_VOZNI_RED_ICS_PRODID,
  tedenskiVozniRedIcsNajdaljsaVrsticaOkteti,
} from '../tedenski-vozni-red-ics'
import { fnv1a32Hex } from '../quote-repro'
import type { VozniRedTermin } from '../logistika-vozni-red-pdf'

/** UTC referenčni trenutek — okno = 2026-09-21 .. 2026-09-27 (danes + 6, UTC). */
const NOW_UTC = new Date('2026-09-21T10:00:00Z')
/** Lokalni referenčni trenutek za ime datoteke (ISTI vzorec kot R298 brat). */
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

/** Vzorec: dve ekipi v oknu + tretja IZVEN okna + brez-ekipe vrstici. */
function vzorec(): VozniRedTermin[] {
  return [
    termin({ datumZacetka: '2026-09-21T08:00:00Z', datumKonca: '2026-09-21T12:00:00Z', ekipa: 'Ekipa Bela', projekt: 'Balkon Lipa' }),
    termin({ datumZacetka: '2026-09-22T08:00:00Z', predvideneUre: 4, ekipa: 'Ekipa Alfa', projekt: 'Nadstrešek Vid' }),
    termin({ datumZacetka: '2026-09-23T09:00:00Z', status: 'PREKlicANO', ekipa: 'Ekipa Alfa', projekt: 'Ograja Triglav' }),
    termin({ datumZacetka: '2026-09-21T10:00:00Z', ekipa: null, projekt: 'Brez ekipe' }),
    termin({ datumZacetka: '2026-09-28T08:00:00Z', ekipa: 'Ekipa izven okna', projekt: 'Naslednji teden' }),
  ]
}

/** RFC §3.1 UNFOLD — R298 lekcija 5: iskanje po VSEBINI mora iti po razvitih
 *  logičnih vrsticah (fizična vrstica se začne s presledkom = nadaljevanje). */
function razvij(fyzicne: string[]): string[] {
  const out: string[] = []
  for (const v of fyzicne) {
    if (v.startsWith(' ') && out.length > 0) out[out.length - 1] += v.slice(1)
    else out.push(v)
  }
  return out
}

describe('R299 tedenskiEkipaImena — EN VIR ekip v oknu', () => {
  it('vrne UNIQUE ekipe iz okna, ASC, null ekipe izključene, izven okna ne prištejeta', () => {
    expect(tedenskiEkipaImena(vzorec(), NOW_UTC)).toEqual(['Ekipa Alfa', 'Ekipa Bela'])
  })

  it('f(množica): premešan vhod = ISTI seznam (FP vzorec R248/R250/R252/R253)', () => {
    const premesano = [...vzorec()].reverse()
    expect(tedenskiEkipaImena(premesano, NOW_UTC)).toEqual(tedenskiEkipaImena(vzorec(), NOW_UTC))
  })

  it('UTF-16 < ASC (kanon R245/R250): velika latica pred šumnikom — NIKOLI localeCompare', () => {
    const vnos = [
      termin({ datumZacetka: '2026-09-21T08:00:00Z', ekipa: 'Čebula' }),
      termin({ datumZacetka: '2026-09-21T09:00:00Z', ekipa: 'Alfa' }),
    ]
    expect(tedenskiEkipaImena(vnos, NOW_UTC)).toEqual(['Alfa', 'Čebula'])
  })

  it('fail-closed ×3: ne-polje / pokvaren vnos (uvožen pregled, indeks krivca) / pokvaren now', () => {
    expect(() => tedenskiEkipaImena('ne-polje' as unknown as VozniRedTermin[], NOW_UTC)).toThrow(TypeError)
    expect(() =>
      tedenskiEkipaImena([termin({ datumZacetka: 'ni-iso' })], NOW_UTC),
    ).toThrow(/(0).*datumZacetka/)
    expect(() => tedenskiEkipaImena(vzorec(), 'ne-date' as unknown as Date)).toThrow(TypeError)
  })
})

describe('R299 tedenskiEkipaIcs — filtriran izvoz (izpeljani brat R298)', () => {
  const rez = tedenskiEkipaIcs(vzorec(), 'Ekipa Alfa', NOW_UTC)
  const vrstice = razvij(rez.ics.split('\r\n').filter((v) => v.length > 0))

  it('samo termini te ekipe v oknu (2) — ostali (Bela, null, izven okna) izključeni', () => {
    expect(rez.dogodki).toBe(2)
    const summariji = vrstice.filter((v) => v.startsWith('SUMMARY:'))
    expect(summariji.some((v) => v.includes('Nadstrešek Vid'))).toBe(true)
    expect(summariji.some((v) => v.includes('Ograja Triglav'))).toBe(true)
    expect(summariji.some((v) => v.includes('Balkon Lipa'))).toBe(false)
    expect(summariji.some((v) => v.includes('Brez ekipe'))).toBe(false)
    expect(summariji.some((v) => v.includes('Naslednji teden'))).toBe(false)
  })

  it('PRODID = izpeljani brat (LASTNI — nič podedovanega R298)', () => {
    expect(TEDENSKI_EKIPA_ICS_PRODID).toBe('-//Roksal//Tedenski vozni red po ekipah//SL')
    expect(vrstice).toContain(`PRODID:${TEDENSKI_EKIPA_ICS_PRODID}`)
  })

  it('X-ROKSAL-OBSEG nosi dodatek \' · Ekipa: …\' (izpeljana resnica izvoza)', () => {
    const obseg = vrstice.find((v) => v.startsWith('X-ROKSAL-OBSEG:'))
    expect(obseg).toBeDefined()
    expect(obseg).toContain('(danes + 6 dni\\, UTC) · Ekipa: Ekipa Alfa')
  })

  it('X-ROKSAL-EKIPA VERBATIM (RFC §3.3.11 izpustni znaki tudi v imenu)', () => {
    const lokalno = vzorec().map((t, i) => (i === 1 ? { ...t, ekipa: 'Ekipa, Alfa' } : t))
    const znana = tedenskiEkipaIcs(lokalno, 'Ekipa, Alfa', NOW_UTC)
    const vrsticeVeji = razvij(znana.ics.split('\r\n').filter((v) => v.length > 0))
    expect(vrsticeVeji).toContain('X-ROKSAL-EKIPA:Ekipa\\, Alfa')
    expect(vrstice).toContain('X-ROKSAL-EKIPA:Ekipa Alfa')
  })

  it('UID predpona = vozni-red-ekipa-<fnv1a32Hex(ekipa)>- — deterministična, EN VIR hash', () => {
    const hash = fnv1a32Hex('Ekipa Alfa')
    const uidi = vrstice.filter((v) => v.startsWith('UID:'))
    expect(uidi).toEqual([
      `UID:vozni-red-ekipa-${hash}-001-20260922T080000Z@roksal`,
      `UID:vozni-red-ekipa-${hash}-002-20260923T090000Z@roksal`,
    ])
  })

  it('trki: ekipa datoteka se od R298 osnovne razlikuje ŽE po predponi; dve ekipi imata različni predponi', () => {
    const osnovni = tedenskiVozniRedIcs(vzorec(), NOW_UTC)
    const hashA = fnv1a32Hex('Ekipa Alfa')
    const hashB = fnv1a32Hex('Ekipa Bela')
    expect(hashA).not.toBe(hashB)
    const osnovniUidi = osnovni.ics.split('\r\n').filter((v) => v.startsWith('UID:vozni-red-ekipa-'))
    expect(osnovniUidi).toEqual([])
    expect(rez.ics).toContain(`UID:vozni-red-ekipa-${hashA}-`)
    const bela = tedenskiEkipaIcs(vzorec(), 'Ekipa Bela', NOW_UTC)
    expect(bela.ics).toContain(`UID:vozni-red-ekipa-${hashB}-`)
  })

  it('EN VIR dokaz: DTSTART/DTEND/STATUS vrstice VEVENT = R298 ICS nad ISTO filtrirano množico', () => {
    const filtrirani = vzorec().filter((t) => t.ekipa === 'Ekipa Alfa' && t.datumZacetka.slice(0, 10) >= '2026-09-21' && t.datumZacetka.slice(0, 10) <= '2026-09-27')
    const osnovni = tedenskiVozniRedIcs(filtrirani, NOW_UTC).ics.split('\r\n')
    const jedro = (s: string[]) => s.filter((v) => /^(DTSTART|DTEND|STATUS|X-ROKSAL-STATUS):/.test(v))
    expect(jedro(vrstice)).toEqual(jedro(osnovni))
  })

  it('format konstanta: CRLF zaključki + BREZ BOM + END:VCALENDAR + zavijanje ≤ 75 oktetov', () => {
    expect(rez.ics.endsWith('\r\n')).toBe(true)
    expect(rez.ics.charCodeAt(0)).not.toBe(0xef)
    expect(vrstice[vrstice.length - 1]).toBe('END:VCALENDAR')
    const fyzicneRaw = rez.ics.split('\r\n').filter((v) => v.length > 0)
    expect(tedenskiVozniRedIcsNajdaljsaVrsticaOkteti(fyzicneRaw)).toBeLessThanOrEqual(75)
  })

  it('determinizem: premešan vhod = bajtno ISTI ICS (f(množica))', () => {
    const premesano = [...vzorec()].reverse()
    const rez2 = tedenskiEkipaIcs(premesano, 'Ekipa Alfa', NOW_UTC)
    expect(rez2.ics).toBe(rez.ics)
    expect(rez2.dogodki).toBe(rez.dogodki)
  })

  it('pov = FILTRIRANE množice (terminov 2, preklicanih 1, ure 4 — WYSIWYG toast)', () => {
    expect(rez.pov.terminovN).toBe(2)
    expect(rez.pov.preklicanih).toBe(1)
    expect(rez.pov.nacrtovaneUre).toBe(4)
    expect(rez.pov.dniN).toBe(2)
  })

  it('fail-closed: neznana ekipa (z imenom) / izven okna / prazen niz / ne-niz / ne-polje / pokvaren now / pokvarene opcije', () => {
    expect(() => tedenskiEkipaIcs(vzorec(), 'Neznana ekipa', NOW_UTC)).toThrow(/neznana ekipa/)
    expect(() => tedenskiEkipaIcs(vzorec(), 'Ekipa izven okna', NOW_UTC)).toThrow(/neznana ekipa \(brez termina[\s\S]*Ekipa izven okna/)
    expect(() => tedenskiEkipaIcs(vzorec(), '', NOW_UTC)).toThrow(TypeError)
    expect(() => tedenskiEkipaIcs(vzorec(), 42 as unknown as string, NOW_UTC)).toThrow(TypeError)
    expect(() => tedenskiEkipaIcs('ne-polje' as unknown as VozniRedTermin[], 'Ekipa Alfa', NOW_UTC)).toThrow(TypeError)
    expect(() => tedenskiEkipaIcs(vzorec(), 'Ekipa Alfa', 'x' as unknown as Date)).toThrow(TypeError)
    expect(() =>
      tedenskiVozniRedIcs(vzorec(), NOW_UTC, null as unknown as undefined),
    ).toThrow(TypeError)
  })
})

describe('R299 ime datoteke + slug — deterministično', () => {
  it('Tedenski-vozni-red-<slug>-YYYY-MM-DD.ics (družinski vzorec, F4)', () => {
    expect(tedenskiEkipaIcsFilename('Ekipa Alfa', NOW_LOCALNO)).toBe('Tedenski-vozni-red-Ekipa-Alfa-2026-09-21.ics')
  })

  it('slug: presledki → '-', več presledkov se strne, čšž ostanejo, izven črk/številk izpuščeno, prazen → \'ekipa\'', () => {
    expect(tedenskiEkipaSlug('Ekipa Alfa')).toBe('Ekipa-Alfa')
    expect(tedenskiEkipaSlug('Ekipa   Alfa')).toBe('Ekipa-Alfa')
    expect(tedenskiEkipaSlug('Čišža 1')).toBe('Čišža-1')
    expect(tedenskiEkipaSlug('Ekipa Alfa / B')).toBe('Ekipa-Alfa-B')
    expect(tedenskiEkipaSlug('///')).toBe('ekipa')
  })

  it('fail-closed ×3: pokvaren now / prazen niz / ne-niz ekipa', () => {
    expect(() => tedenskiEkipaIcsFilename('Ekipa Alfa', 'x' as unknown as Date)).toThrow(TypeError)
    expect(() => tedenskiEkipaIcsFilename('', NOW_LOCALNO)).toThrow(TypeError)
    expect(() => tedenskiEkipaIcsFilename(7 as unknown as string, NOW_LOCALNO)).toThrow(TypeError)
  })
})

describe('R298 nazaj-kompatibilnost — brez opcij = R298 kontrakt', () => {
  it('osnovni ICS: PRODID R298 + NIKOLI X-ROKSAL-EKIPA vrstica + UID brez ekipa predpone', () => {
    const osnovni = tedenskiVozniRedIcs(vzorec(), NOW_UTC)
    const vrstice = osnovni.ics.split('\r\n').filter((v) => v.length > 0)
    expect(vrstice).toContain(`PRODID:${TEDENSKI_VOZNI_RED_ICS_PRODID}`)
    expect(vrstice.some((v) => v.startsWith('X-ROKSAL-EKIPA:'))).toBe(false)
    expect(vrstice.some((v) => v.startsWith('UID:vozni-red-001-'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// STRAŽAR nad REALNIM logistics-tab (vzorec R298 ×4): tihe odstranitve
// per-ekipa izvoza NE gredo skozi.
// ---------------------------------------------------------------------------
const TAB = readFileSync(resolve(__dirname, '../../components/roksal/logistics-tab.tsx'), 'utf-8')
const EKIPA_LIB = readFileSync(resolve(__dirname, '../tedenski-vozni-red-ekipa-ics.ts'), 'utf-8')

describe('R299 STRAŽAR nad REALNIM logistics-tab', () => {
  it('čipi + handler + MIME + dvoklik guard ostajajo', () => {
    expect(TAB).toContain("tedenskiEkipaImena,\n  tedenskiEkipaIcs,\n  tedenskiEkipaIcsFilename,")
    expect(TAB).toContain('handleTedenskiEkipaIcs(ekipa)')
    expect(TAB).toContain("downloadTextFile(ime, ics, 'text/calendar;charset=utf-8')")
    expect(TAB).toContain('if (tedenskiEkipaIcsVTeku !== null) return')
  })

  it('fail-closed toast + podatkovno-pogojna vidnost (0 ekip = iskrena praznina)', () => {
    expect(TAB).toContain('Ni ekip z termini v naslednjih 7 dneh')
    expect(TAB).toContain('ICS po ekipi se izvozi, ko ima ekipa vpisan termin v prihajajočem tednu.')
    expect(TAB).toContain('{ekipaImena.length > 0 && (')
  })

  it('MANDATORY STIL: definicijski naslovi + legenda (izrečena resnica filtra)', () => {
    expect(TAB).toContain('Tedenski ICS po ekipah')
    expect(TAB).toContain('Samo termini ekipe')
    expect(TAB).toContain("{' · ICS po ekipi = samo termini te ekipe (isti 7-dnevni okvir)'}")
    expect(TAB).toContain("title=\"Ekipa z vsaj enim terminom v naslednjih 7 dneh (danes + 6 dni, UTC)")
  })

  it('ENA izpeljava: ekipa lib uvaža R298 mašinerijo + fnv1a32Hex + pregled — nič dvojnega', () => {
    expect(EKIPA_LIB).toContain("import { tedenskiVozniRedIcs } from './tedenski-vozni-red-ics'")
    expect(EKIPA_LIB).toContain("import { fnv1a32Hex } from './quote-repro'")
    expect(EKIPA_LIB).toContain("tedenskiPregledPovzetek,")
    expect(EKIPA_LIB).toContain("tedenskiVozniRedIcs(filtrirani, now, {")
  })
})
