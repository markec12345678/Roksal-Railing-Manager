// ---------------------------------------------------------------------------
// R300 — TEDENSKI KONFLIKTNI PREGLED (30. člen, issue #1 §7 branje) —
// deterministična bralna stran pravil R142/R145. Dokazi:
//  • konfliktPrekrivanje = poli-odprto [zacetek, konec): nazaj-na-nazaj
//    (konec 12:00 + začetek 12:00) NIKOLI konflikt; isti začetek = konflikt;
//    vsebovan/partial = konflikt; null/obrnjen konec = NIKOLI (nič
//    izmišljenega — isti izid kot strežniški stavek);
//  • konfliktStatusDrzi: NAVRTENO/V_TEKU/PRELOZENO držita; PREKlicANO IN
//    ZAKLJUCENO ne (zgodovina ne blokira načrtovanja);
//  • tedenskiKonflikti: samo termini v oknu (tedenskiOknoDnevi EN VIR),
//    samo z ekipo (null = brez vira — ISTO pravilo kot API), pari po
//    sortiranem času ASC, skupine ASC po ekipi (UTF-16 < — kanon R245/R250);
//    f(množica) — premešan vhod = ISTI pregled; čez-polnoč par nosi dan
//    ZAČETKA prekrivanja (max začetek); 0 konfliktov = null (iskrena
//    čistost); fail-closed ×3 (ne-polje / pokvaren vnos z indeksom /
//    pokvaren now);
//  • STRAŽAR ×3: (1) REALNIM logistics-tab — mini-vrstica (role=status,
//    testid, zelen/rdeč kondicional, definicijski naslov z izrečenimi
//    pravili, pogojna vidnost na razgled.pov); (2) ZRCALNA SINHRONIZACIJA
//    z schedule-conflicts.ts — dobesedna primerjava STATUS literal + poli-
//    odprta primerjava (schedule-conflicts.ts je strežniški: @/lib/db —
//    klientski lib NE uvaža; zrcalo = vzorec quote-repro 'ločena kopija,
//    da jedri ostanejo neodvisna'; sprememba strežniškega pravila brez
//    zavestne posodobitve zrcala NE gre skozi); (3) EN VIR gete — lib
//    uvaža okno + pregled iz tedenske družine, NE iz strežniške domene.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  tedenskiKonflikti,
  konfliktPrekrivanje,
  konfliktStatusDrzi,
  KONFLIKT_AKTIVNI_STATUSI,
} from '../tedenski-konflikti'
import type { VozniRedTermin } from '../logistika-vozni-red-pdf'

/** UTC referenčni trenutek — okno = 2026-09-21 .. 2026-09-27 (danes + 6, UTC). */
const NOW_UTC = new Date('2026-09-21T10:00:00Z')

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

describe('R300 primitiva — zrcalo R142 pravil', () => {
  it('poli-odprto: nazaj-na-nazaj (12:00 konec + 12:00 začetek) NIKOLI konflikt', () => {
    expect(konfliktPrekrivanje(new Date('2026-09-21T08:00:00Z'), new Date('2026-09-21T12:00:00Z'), new Date('2026-09-21T12:00:00Z'), new Date('2026-09-21T16:00:00Z'))).toBe(false)
  })

  it('poli-odprto: isti začetek / vsebovan / delni = konflikt', () => {
    expect(konfliktPrekrivanje(new Date('2026-09-21T08:00:00Z'), new Date('2026-09-21T12:00:00Z'), new Date('2026-09-21T08:00:00Z'), new Date('2026-09-21T16:00:00Z'))).toBe(true)
    expect(konfliktPrekrivanje(new Date('2026-09-21T08:00:00Z'), new Date('2026-09-21T16:00:00Z'), new Date('2026-09-21T09:00:00Z'), new Date('2026-09-21T10:00:00Z'))).toBe(true)
    expect(konfliktPrekrivanje(new Date('2026-09-21T08:00:00Z'), new Date('2026-09-21T12:00:00Z'), new Date('2026-09-21T11:00:00Z'), new Date('2026-09-21T13:00:00Z'))).toBe(true)
  })

  it('statusi: aktivni trije držijo, PREKlicANO in ZAKLJUCENO ne (kanon R142)', () => {
    expect(KONFLIKT_AKTIVNI_STATUSI).toEqual(['NAVRTENO', 'V_TEKU', 'PRELOZENO'])
    expect(konfliktStatusDrzi('NAVRTENO')).toBe(true)
    expect(konfliktStatusDrzi('V_TEKU')).toBe(true)
    expect(konfliktStatusDrzi('PRELOZENO')).toBe(true)
    expect(konfliktStatusDrzi('PREKlicANO')).toBe(false)
    expect(konfliktStatusDrzi('ZAKLJUCENO')).toBe(false)
  })
})

describe('R300 tedenskiKonflikti — pregled okna', () => {
  it('dvojna rezervacija iste ekipe (delno prekrivanje) = 1 par, ekipa ASC', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T11:00:00Z', datumKonca: '2026-09-22T15:00:00Z', ekipa: 'Ekipa Alfa' }),
    ]
    const rez = tedenskiKonflikti(vnosi, NOW_UTC)
    expect(rez).not.toBeNull()
    expect(rez!.skupine).toHaveLength(1)
    expect(rez!.skupine[0]!.ekipa).toBe('Ekipa Alfa')
    expect(rez!.skupine[0]!.pari).toHaveLength(1)
    expect(rez!.skupine[0]!.pari[0]!.dan).toBe('2026-09-22')
    expect(rez!.pregledanih).toBe(2)
    expect(rez!.stPrekrivanj).toBe(1)
  })

  it('nazaj-na-nazaj NI konflikt (null — iskrena čistost, API 409 pariteta)', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T12:00:00Z', datumKonca: '2026-09-22T16:00:00Z', ekipa: 'Ekipa Alfa' }),
    ]
    expect(tedenskiKonflikti(vnosi, NOW_UTC)).toBeNull()
  })

  it('PREKlicANO in ZAKLJUCENO ne zasedeta; brez-ekipe in brez-konca izključeni; druga ekipa NI konflikt', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa', status: 'PREKlicANO' }),
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa', status: 'ZAKLJUCENO' }),
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: null }),
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: null, ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Bela' }),
    ]
    expect(tedenskiKonflikti(vnosi, NOW_UTC)).toBeNull()
  })

  it('izven okna NE sodeluje (okno = resnica pregleda; 2026-09-28 = izven)', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-21T08:00:00Z', datumKonca: '2026-09-21T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-21T12:00:00Z', datumKonca: '2026-09-21T16:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-28T08:00:00Z', datumKonca: '2026-09-28T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-28T08:00:00Z', datumKonca: '2026-09-28T12:00:00Z', ekipa: 'Ekipa Alfa' }),
    ]
    expect(tedenskiKonflikti(vnosi, NOW_UTC)).toBeNull()
  })

  it('trije hkratni termini iste ekipe = 3 pari (a-b, a-c, b-c), skupine 1', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'A' }),
      termin({ datumZacetka: '2026-09-22T09:00:00Z', datumKonca: '2026-09-22T13:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'B' }),
      termin({ datumZacetka: '2026-09-22T10:00:00Z', datumKonca: '2026-09-22T14:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'C' }),
    ]
    const rez = tedenskiKonflikti(vnosi, NOW_UTC)!
    expect(rez.stPrekrivanj).toBe(3)
    expect(rez.skupine[0]!.pari.map((p) => p.a.projekt)).toEqual(['A', 'A', 'B'])
    expect(rez.skupine[0]!.pari.map((p) => p.b.projekt)).toEqual(['B', 'C', 'C'])
  })

  it('dve ekipi = dve skupini ASC (UTF-16 <), ločena štetja', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Bela' }),
      termin({ datumZacetka: '2026-09-22T09:00:00Z', datumKonca: '2026-09-22T13:00:00Z', ekipa: 'Ekipa Bela' }),
      termin({ datumZacetka: '2026-09-23T08:00:00Z', datumKonca: '2026-09-23T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-23T08:00:00Z', datumKonca: '2026-09-23T12:00:00Z', ekipa: 'Ekipa Alfa' }),
    ]
    const rez = tedenskiKonflikti(vnosi, NOW_UTC)!
    expect(rez.skupine.map((s) => s.ekipa)).toEqual(['Ekipa Alfa', 'Ekipa Bela'])
    expect(rez.stPrekrivanj).toBe(2)
    expect(rez.pregledanih).toBe(4)
  })

  it('čez-polnoč prekrivanje: par nosi dan ZAČETKA prekrivanja (max začetek)', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T23:00:00Z', datumKonca: '2026-09-23T01:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-23T00:30:00Z', datumKonca: '2026-09-23T02:00:00Z', ekipa: 'Ekipa Alfa' }),
    ]
    const rez = tedenskiKonflikti(vnosi, NOW_UTC)!
    expect(rez.skupine[0]!.pari[0]!.dan).toBe('2026-09-23')
  })

  it('f(množica): premešan vhod = ISTI pregled (pari po času ASC)', () => {
    const osnova = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'A' }),
      termin({ datumZacetka: '2026-09-22T09:00:00Z', datumKonca: '2026-09-22T13:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'B' }),
      termin({ datumZacetka: '2026-09-22T11:30:00Z', datumKonca: '2026-09-22T15:00:00Z', ekipa: 'Ekipa Bela' }),
      termin({ datumZacetka: '2026-09-22T11:00:00Z', datumKonca: '2026-09-22T14:00:00Z', ekipa: 'Ekipa Bela' }),
    ]
    const cisto = tedenskiKonflikti(osnova, NOW_UTC)
    const premesano = tedenskiKonflikti([...osnova].reverse(), NOW_UTC)
    expect(premesano).toEqual(cisto)
  })

  it('prazno polje = null (iskrena čistost praznega okna — domain pravilo tedenske družine)', () => {
    expect(tedenskiKonflikti([], NOW_UTC)).toBeNull()
  })

  it('fail-closed ×3: ne-polje / pokvaren vnos (indeks krivca) / pokvaren now', () => {
    expect(() => tedenskiKonflikti('ne-polje' as unknown as VozniRedTermin[], NOW_UTC)).toThrow(TypeError)
    expect(() =>
      tedenskiKonflikti([termin({ datumZacetka: 'pokvaren' })], NOW_UTC),
    ).toThrow(/\(0\).*datumZacetka/)
    expect(() => tedenskiKonflikti([], 'ne-date' as unknown as Date)).toThrow(TypeError)
  })
})

// ---------------------------------------------------------------------------
// STRAŽAR ×3
// ---------------------------------------------------------------------------
const TAB = readFileSync(resolve(__dirname, '../../components/roksal/logistics-tab.tsx'), 'utf-8')
const KONFLIKT_LIB = readFileSync(resolve(__dirname, '../tedenski-konflikti.ts'), 'utf-8')
const SERVER_CONF = readFileSync(resolve(__dirname, '../schedule-conflicts.ts'), 'utf-8')

describe('R300 STRAŽAR', () => {
  it('REALNIM logistics-tab: mini-vrstica + role=status + kondicionalni žig + definicijski naslov + pogojna vidnost', () => {
    expect(TAB).toContain("import { tedenskiKonflikti } from '@/lib/tedenski-konflikti'")
    expect(TAB).toContain('data-testid="tedenski-konflikti-mini"')
    expect(TAB).toContain('role="status"')
    expect(TAB).toContain('Konflikti: 0 — brez dvojnih rezervacij ekipe v okviru.')
    expect(TAB).toContain("konfliktiPregled === null ? 'text-roksal-green' : 'text-roksal-red'")
    expect(TAB).toContain(' isti poli-odprto pravilo kot API 409')
    expect(TAB).toContain('{razgled.pov !== null && (')
  })

  it('ZRCALNA SINHRONIZACIJA z schedule-conflicts.ts (strežniško pravilo = klientsko zrcalo, dobesedno)', () => {
    // STATUS literal — dobesedno isti niz v OBEH datotekah.
    expect(SERVER_CONF).toContain("['NAVRTENO', 'V_TEKU', 'PRELOZENO']")
    expect(KONFLIKT_LIB).toContain("['NAVRTENO', 'V_TEKU', 'PRELOZENO']")
    // Poli-odprta primerjava — dobesedno ista izjava v OBEH datotekah.
    expect(SERVER_CONF).toContain('aStart < bEnd && bStart < aEnd')
    expect(KONFLIKT_LIB).toContain('aZacetek < bKonec && bZacetek < aKonec')
    // Klientski lib NE sme uvažati strežniške domene (@/lib/db) — preverba
    // na import-nizu (komentar v glavi omenja odvisnost namenoma).
    expect(KONFLIKT_LIB).not.toContain("from '@/lib/db'")
    expect(KONFLIKT_LIB).not.toContain("from './schedule-conflicts'")
  })

  it('ENA izpeljava: lib uvaža okno + pregled iz tedenske družine (nič dvojnega okna/validacije)', () => {
    expect(KONFLIKT_LIB).toContain("tedenskiOknoDnevi,")
    expect(KONFLIKT_LIB).toContain("preveriVozniRedTermin,")
    expect(KONFLIKT_LIB).toContain("from './tedenski-vozni-red-pdf'")
  })
})
