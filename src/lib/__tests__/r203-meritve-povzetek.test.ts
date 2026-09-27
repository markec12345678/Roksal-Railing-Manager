// R203 — meritve-povzetek: enote + fail-closed + EN VIR RESNICE z meritve-csv.
// ---------------------------------------------------------------------------
// (1) Struktura: glava (ime projekta / 'Brez imena projekta'), števec s
//     sklanjatvijo, časovni žig 'osveženo …' iz PARAMETRA now (determinizem).
// (2) Vrstice: oznaka ali tip fallback, mm mere, kot, ne-privzeti status,
//     lokacija, opomba — IZVOŽENO/POVZETEK = ZASLON.
// (3) EN VIR RESNICE: vsaka vrstica povzetka nastane prek meritevVrstica
//     (meritve-csv R186) — iste mere, isti fallbacki, ista validacija.
// (4) Fail-closed: negativne/ne-končne mere, pokvaren ISO, neveljaven now,
//     ne-polje → TypeError (NIKOLI tihega izmišljenega besedila).
import { describe, expect, it } from 'vitest'
import {
  buildMeritvePovzetek,
  meritvePovzetekBeseda,
  meritvePovzetekCasOznaka,
} from '../meritve-povzetek'
import { meritevVrstica } from '../meritve-csv'
import type { MeritevZaIzvoz } from '../meritve-csv'

const NOW = new Date('2026-09-27T10:30:00.000Z')

const meritev = (over: Partial<MeritevZaIzvoz> = {}): MeritevZaIzvoz => ({
  id: 'm1',
  createdAt: '2026-09-27T08:00:00.000Z',
  dolzinaMm: 3500,
  visinaMm: 1800,
  tipMeritve: 'RAZDALJA',
  oznaka: 'R1',
  status: 'OSNUTEK',
  lokacija: 'vrt, severna stran',
  opomba: null,
  ...over,
})

describe('meritve-povzetek: glava + sklanjatev + determinizem', () => {
  it('glava vsebuje ime projekta, števec in časovni žig iz parametra now', () => {
    const tekst = buildMeritvePovzetek([meritev()], { projektIme: 'Balkon Kranj', now: NOW })
    const vrstice = tekst.split('\n')
    expect(vrstice[0]).toBe('Meritve — Balkon Kranj')
    expect(vrstice[1]).toContain('1 meritev · osveženo ')
    expect(vrstice[1]).not.toBe('')
  })

  it('dva klica z ISTIM now = IDENTIČEN izhod (determinizem, brez skritih ur)', () => {
    const vhodi = [meritev(), meritev({ id: 'm2', oznaka: 'R2' })]
    const a = buildMeritvePovzetek(vhodi, { projektIme: 'P', now: NOW })
    const b = buildMeritvePovzetek(vhodi, { projektIme: 'P', now: NOW })
    expect(a).toBe(b)
  })

  it('sklanjatev: 1 meritev, 2 meritvi, 3/4 meritve, 5/21 meritev', () => {
    expect(meritvePovzetekBeseda(1)).toBe('meritev')
    expect(meritvePovzetekBeseda(2)).toBe('meritvi')
    expect(meritvePovzetekBeseda(3)).toBe('meritve')
    expect(meritvePovzetekBeseda(4)).toBe('meritve')
    expect(meritvePovzetekBeseda(5)).toBe('meritev')
    expect(meritvePovzetekBeseda(21)).toBe('meritev')
  })

  it('prazno ime / odsotno ime → pošteno "Brez imena projekta" (brez izmišljevanja)', () => {
    const a = buildMeritvePovzetek([meritev()], { projektIme: null, now: NOW })
    const b = buildMeritvePovzetek([meritev()], { projektIme: '   ', now: NOW })
    const c = buildMeritvePovzetek([meritev()], { now: NOW })
    expect(a.split('\n')[0]).toBe('Meritve — Brez imena projekta')
    expect(b.split('\n')[0]).toBe('Meritve — Brez imena projekta')
    expect(c.split('\n')[0]).toBe('Meritve — Brez imena projekta')
  })

  it('prazen seznam je VELJAVEN in iskren ("Ni meritev.", brez izmišljenih vrstic)', () => {
    const tekst = buildMeritvePovzetek([], { projektIme: 'P', now: NOW })
    expect(tekst).toContain('0 meritev · osveženo ')
    expect(tekst).toContain('Ni meritev.')
    expect(tekst.split('\n').length).toBe(4)
  })
})

describe('meritve-povzetek: vrstice — IZVOŽENO = ZASLON', () => {
  it('oznaka je prednostna; brez oznake → tip (isti fallback kot CSV)', () => {
    const z = buildMeritvePovzetek([meritev()], { now: NOW })
    expect(z).toContain('1. R1: 3500×1800 mm')
    const brezOznake = buildMeritvePovzetek([meritev({ oznaka: null })], { now: NOW })
    expect(brezOznake).toContain('1. RAZDALJA: 3500×1800 mm')
  })

  it('privzeti status OSNUTEK je impliciten; drugi statusi se POKAŽEJO', () => {
    const osnutek = buildMeritvePovzetek([meritev()], { now: NOW })
    expect(osnutek).not.toContain('OSNUTEK')
    const potrjen = buildMeritvePovzetek([meritev({ status: 'POTRJENO' })], { now: NOW })
    expect(potrjen).toContain(' · POTRJENO')
  })

  it('kot se pokaže z °; lokacija in opomba v pravem redu', () => {
    const z = buildMeritvePovzetek(
      [meritev({ kotStopinje: 45, opomba: 'preveri nagnjenost' })],
      { now: NOW }
    )
    expect(z).toContain(' · kot 45°')
    expect(z).toContain(' · vrt, severna stran')
    expect(z).toContain(' — preveri nagnjenost')
  })

  it('EN VIR RESNICE: mere/fallbacki v povzetku == meritevVrstica (CSV) izhod', () => {
    const m = meritev({ oznaka: null, status: null, tipMeritve: null })
    const csvVrstica = meritevVrstica(m)
    const povzetek = buildMeritvePovzetek([m], { now: NOW })
    // tip fallback RAZDALJA enak CSV
    expect(csvVrstica[2]).toBe('RAZDALJA')
    expect(povzetek).toContain('1. RAZDALJA: 3500×1800 mm')
    // status fallback OSNUTEK enak CSV (in impliciten v povzetku)
    expect(csvVrstica[16]).toBe('OSNUTEK')
    // mm mere literalo enake CSV poljem
    expect(csvVrstica[3]).toBe('3500')
    expect(csvVrstica[4]).toBe('1800')
    expect(povzetek).toContain('3500×1800 mm')
  })
})

describe('meritve-povzetek: fail-closed (fizične mere ne gredo pokvarjene naprej)', () => {
  it('negativna dolžina → TypeError', () => {
    expect(() =>
      buildMeritvePovzetek([meritev({ dolzinaMm: -1 })], { now: NOW })
    ).toThrow(TypeError)
  })

  it('ne-končna višina (NaN) → TypeError', () => {
    expect(() =>
      buildMeritvePovzetek([meritev({ visinaMm: Number.NaN })], { now: NOW })
    ).toThrow(TypeError)
  })

  it('pokvaren createdAt → TypeError', () => {
    expect(() =>
      buildMeritvePovzetek([meritev({ createdAt: 'ne-datum' })], { now: NOW })
    ).toThrow(TypeError)
  })

  it('ne-polje vnos → TypeError', () => {
    expect(() =>
      buildMeritvePovzetek(meritev() as unknown as MeritevZaIzvoz[], { now: NOW })
    ).toThrow(TypeError)
  })

  it('neveljaven now → TypeError (tudi časovni žig sam)', () => {
    expect(() =>
      buildMeritvePovzetek([meritev()], { now: new Date('ne-datum') })
    ).toThrow(TypeError)
    expect(() => meritvePovzetekCasOznaka(new Date('ne-datum'))).toThrow(TypeError)
  })

  it('ne-negativna sklanjatev števca: negativno/ne-celo → TypeError', () => {
    expect(() => meritvePovzetekBeseda(-1)).toThrow(TypeError)
    expect(() => meritvePovzetekBeseda(1.5)).toThrow(TypeError)
  })
})
