// ---------------------------------------------------------------------------
// R307 — KONFLIKTNI DOKAZ NA ZASLONU (37. člen 'izvozi' družine, P1, bralni
// ZASLONSKI član) — testi. Preslikavni dokazi (vrstice = pari pregleda R300
// EN VIR — ISTI objekti, ISTI red f(množica); Čas = vozniRedCasOkno R255
// VERBATIM; statusi SCHEDULE_TERMINI_STATUS_LABELS VERBATIM) + fail-closed
// (ne-pregled / pokvarjena skupina / pokvarjen par → TypeError z imenom
// graditelja — string kanon R302 lekcija 1) + EN VIR sklep (mini-vrstica
// rdeč žig = konfliktiSklep R301 — NIČ več dvojnega besedila v komponenti)
// + STRAŽAR klientske čistosti + REALNIM logistics-tab (memo EN VIR + blok
// testidi + Pregledanih/Parov števci + definicijski naslov pravila).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { konfliktiDokaz } from '../konflikti-dokaz'
import { tedenskiKonflikti, type TedenskiKonfliktPregled } from '../tedenski-konflikti'
import { konfliktiSklep } from '../konflikti-csv'
import { vozniRedCasOkno } from '../logistika-vozni-red-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from '../termini-prikaz'
import type { VozniRedTermin } from '../logistika-vozni-red-pdf'

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

/** Dokazani par iste ekipe (ISTI vzorec kot R301/R302 brat testi): A
 *  08:00–12:00, B 10:00–14:00 → prekrivanje 10:00–12:00, dan 2026-09-22. */
function parAlfa(ekipa = 'Ekipa Alfa'): VozniRedTermin[] {
  return [
    termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa, projekt: 'Projekt A' }),
    termin({ datumZacetka: '2026-09-22T10:00:00Z', datumKonca: '2026-09-22T14:00:00Z', ekipa, projekt: 'Projekt B', status: 'V_TEKU' }),
  ]
}

/** Drugi par (druga ekipa, drug dan) — red dokaza čez skupine. */
function parBeta(): VozniRedTermin[] {
  return [
    termin({ datumZacetka: '2026-09-23T08:00:00Z', datumKonca: '2026-09-23T12:00:00Z', ekipa: 'Ekipa Beta', projekt: 'Projekt C' }),
    termin({ datumZacetka: '2026-09-23T09:00:00Z', datumKonca: '2026-09-23T13:00:00Z', ekipa: 'Ekipa Beta', projekt: 'Projekt D', status: 'PRELOZENO' }),
  ]
}

const pregledOsnova = (): TedenskiKonfliktPregled =>
  tedenskiKonflikti([...parAlfa(), ...parBeta()], NOW_UTC)!

const lib = readFileSync(resolve(__dirname, '../konflikti-dokaz.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/logistics-tab.tsx'), 'utf8')

describe('R307 — preslikavni dokazi (pari pregleda EN VIR + ohranjen red)', () => {
  it('vrstice = pari pregleda R300 VERBATIM: en par = ena vrstica (ekipa + dan + OBA člena), red OHRANJEN (skupine ASC × pari čas ASC — NIČ re-sorta)', () => {
    const pregled = pregledOsnova()
    const vrstice = konfliktiDokaz(pregled)
    expect(vrstice).toHaveLength(pregled.stPrekrivanj)
    expect(vrstice).toHaveLength(2)
    expect(vrstice.map((v) => v.ekipa)).toEqual(['Ekipa Alfa', 'Ekipa Beta']) // skupine ASC UTF-16
    expect(vrstice[0]!.dan).toBe('2026-09-22') // max začetek — pregledova resnica VERBATIM
    expect(vrstice[1]!.dan).toBe('2026-09-23')
  })

  it('celice VERBATIM: Čas = uvožen vozniRedCasOkno R255 (oba člena); projekt null ohranjen (nikoli izmišljen); statusi = SCHEDULE_TERMINI_STATUS_LABELS', () => {
    const pregled = pregledOsnova()
    const parA = pregled.skupine[0]!.pari[0]!
    const vrstice = konfliktiDokaz(pregled)
    expect(vrstice[0]!.aOkno).toBe(vozniRedCasOkno(parA.a))
    expect(vrstice[0]!.aOkno).toBe('08:00–12:00')
    expect(vrstice[0]!.bOkno).toBe('10:00–14:00')
    expect(vrstice[0]!.aProjekt).toBe('Projekt A')
    expect(vrstice[0]!.bProjekt).toBe('Projekt B')
    expect(vrstice[0]!.aStatus).toBe(SCHEDULE_TERMINI_STATUS_LABELS.NAVRTENO)
    expect(vrstice[0]!.bStatus).toBe(SCHEDULE_TERMINI_STATUS_LABELS.V_TEKU)
    expect(vrstice[1]!.bStatus).toBe(SCHEDULE_TERMINI_STATUS_LABELS.PRELOZENO)
  })

  it('null projekta → null v modelu (komponenta izpiše "—"; lib NIKOLI ne izmišljuje besedila)', () => {
    const pregled = tedenskiKonflikti([
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T09:00:00Z', datumKonca: '2026-09-22T13:00:00Z', ekipa: 'Ekipa Alfa' }),
    ], NOW_UTC)!
    const vrstice = konfliktiDokaz(pregled)
    expect(vrstice[0]!.aProjekt).toBeNull()
    expect(vrstice[0]!.bProjekt).toBeNull()
  })

  it('determinizem: isti pregled = ISTI vrstici (preslikava f(pregled) — brez ure, brez slučaja)', () => {
    expect(konfliktiDokaz(pregledOsnova())).toEqual(konfliktiDokaz(pregledOsnova()))
  })

  it('EN VIR triangulacija: stPrekrivanj = vrstic + konfliktiSklep pregleda = ISTO besedilo kot rdeč žig mini-vrstice (ŠTIRI→PET potrošnikov ENEGA sklepa)', () => {
    const pregled = pregledOsnova()
    const vrstice = konfliktiDokaz(pregled)
    expect(vrstice).toHaveLength(pregled.stPrekrivanj)
    expect(konfliktiSklep(pregled)).toBe('Konflikti: 2 · ekipe: Ekipa Alfa, Ekipa Beta — dvojne rezervacije v okviru (poli-odprto pravilo).')
  })
})

describe('R307 fail-closed (družinska pravila — string kanon R302 lekcija 1)', () => {
  it('ne-pregled / ne-polje skupine → TypeError z imenom graditelja', () => {
    expect(() => konfliktiDokaz(null as unknown as TedenskiKonfliktPregled)).toThrow(TypeError)
    expect(() => konfliktiDokaz(null as unknown as TedenskiKonfliktPregled)).toThrow(/konfliktiDokaz:/)
    expect(() => konfliktiDokaz('ne-pregled' as unknown as TedenskiKonfliktPregled)).toThrow(/konfliktiDokaz:/)
    expect(() => konfliktiDokaz({ skupine: 'ne-polje' } as unknown as TedenskiKonfliktPregled)).toThrow(TypeError)
  })

  it('pokvarjena ekipa skupina (brez ekipa / brez pari) → TypeError', () => {
    expect(() => konfliktiDokaz({ skupine: [null] } as unknown as TedenskiKonfliktPregled)).toThrow(TypeError)
    expect(() => konfliktiDokaz({ skupine: [{ ekipa: 42, pari: [] }] } as unknown as TedenskiKonfliktPregled)).toThrow(/neusklajena ekipa skupina/)
    expect(() => konfliktiDokaz({ skupine: [{ ekipa: 'Ekipa Alfa', pari: 'ne-polje' }] } as unknown as TedenskiKonfliktPregled)).toThrow(TypeError)
  })

  it('pokvarjen par (brez a / brez b / brez ISO začetka) → TypeError z ekipa krivca', () => {
    const skupina = { ekipa: 'Ekipa Alfa', pari: [{}] }
    expect(() => konfliktiDokaz({ skupine: [skupina] } as unknown as TedenskiKonfliktPregled)).toThrow(/neusklajen par ekipe Ekipa Alfa/)
    const polpar = { ekipa: 'Ekipa Alfa', pari: [{ a: parAlfa()[0]!.datumZacetka ? { datumZacetka: '2026-09-22T08:00:00Z' } : null }] }
    expect(() => konfliktiDokaz({ skupine: [polpar] } as unknown as TedenskiKonfliktPregled)).toThrow(/neusklajen par/)
  })
})

describe('R307 STRAŽAR ×2', () => {
  it('klientska čistost: lib NE uvaža @/lib/db + NE strežniške domene + uvozi R255/R256 kanon (vozniRedCasOkno + statusi) + NIČ lastnega sorta/ure/FNV (ČISTA preslikava)', () => {
    expect(lib.includes('@/lib/db')).toBe(false)
    expect(lib.includes("from './schedule-conflicts'")).toBe(false)
    expect(lib).toContain("from './logistika-vozni-red-pdf'")
    expect(lib).toContain("from './termini-prikaz'")
    expect(lib).toContain("from './tedenski-konflikti'")
    expect(lib.includes('.sort(')).toBe(false)
    expect(lib.includes('new Date(')).toBe(false)
    expect(lib.includes('fnv')).toBe(false)
    expect(lib.includes('export function tedenskiKonflikti')).toBe(false)
    expect(lib.includes('export function konfliktiSklep')).toBe(false)
  })

  it('REALNIM logistics-tab: memo EN VIR (preslikava memo konfliktiPregled) + mini rdeč žig = konfliktiSklep (NIČ dvojnega besedila) + blok (testid + aria + definicijski naslov pravila) + Pregledanih/Parov števec + guard', () => {
    expect(komponenta.includes("from '@/lib/konflikti-dokaz'")).toBe(true)
    expect(komponenta.includes('konfliktiDokaz(konfliktiPregled)')).toBe(true) // EN VIR — iz memo pregleda
    expect(komponenta.includes(': konfliktiSklep(konfliktiPregled)}')).toBe(true) // R307 čistota — EN VIR rdeč žig
    expect(komponenta).not.toContain('dvojne rezervacije v okviru (poli-odprto pravilo).`}') // star inline dvojnik odstranjen
    expect(komponenta.includes('data-testid="konflikti-dokaz"')).toBe(true)
    expect(komponenta.includes('aria-label="Dokazani pari prekrivanj ekipe"')).toBe(true)
    expect(komponenta.includes('Dokazani pari prekrivanj')).toBe(true)
    expect(komponenta.includes('ISTI pari in ISTI vrstni red kot Konflikti CSV in Konflikti PDF')).toBe(true) // definicijski naslov izreče PRAVILA
    expect(komponenta.includes('ZASLON = takoj na pogled')).toBe(true) // vidna razlika medija
    expect(komponenta.includes('Pregledanih {konfliktiPregled.pregledanih} · Parov {konfliktiPregled.stPrekrivanj}.')).toBe(true)
    expect(komponenta.includes('razgled.pov !== null && konfliktiPregled !== null && (')).toBe(true) // dvojni guard
    expect(komponenta.includes('font-medium text-roksal-red">{v.ekipa}')).toBe(true) // ekipa RED — dokaz resnica
  })
})
