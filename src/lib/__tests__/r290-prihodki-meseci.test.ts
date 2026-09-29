// R290 — PRIHODKI PO MESECIH (plačila dimenzija) + MANDATORY STIL strazar.
// ---------------------------------------------------------------------------
//   • lib prihodki-meseci: EN VIR validacija (preveriPrihodkiVnos UVOŽEN iz
//     prihodki-pdf R250) + EN VIR sort (sortirajPrihodki — FP seštevanje
//     f(množica), ne f(vrstni red), vzorec R248) + T1–T6 semantične
//     odločitve (worklog): PLACAN → mesec placanoAt.slice(0,7); IZDAN =
//     v teku (števec + znesek, NE po mesecih); OSNUTEK/STORNIRAN = števca;
//     fail-closed TypeError ×5; prazen seznam = iskrena ničla; determinizem.
//   • strazar (statika invoice-manager): EN VIR preslikava prihodkiVnosi
//     (PDF izvoz R250 + sekcija R290 poganjata iz ISTEGA polja — stara
//     inline preslikava izbrisana), fail-verbose role="alert", iskrena
//     praznina, pogojni stornirani žig, žetoni (0 novih hex — baseline 3 QR
//     barvi ostaja), KPI hover titles (izpeljava izrečena), aria regija.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  prihodkiPoMesecih,
  racunBeseda,
} from '@/lib/prihodki-meseci'
import type { PrihodkiPdfVnos } from '@/lib/prihodki-pdf'

const vnos = (stevilka: string, over: Partial<PrihodkiPdfVnos> = {}): PrihodkiPdfVnos => ({
  stevilka,
  tip: 'RACUN',
  status: 'PLACAN',
  datumIzdaje: '2026-09-01',
  rokPlacilaDni: 30,
  placanoAt: '2026-09-15',
  znesek: 100,
  kupec: 'Kupec d.o.o.',
  projekt: 'Projekt A',
  ...over,
})

describe('R290 prihodkiPoMesecih — agregacija po mesecih', () => {
  it('PLACAN mesec = placanoAt.slice(0,7); istomenski računi se seštejejo', () => {
    const p = prihodkiPoMesecih([
      vnos('2026-001', { placanoAt: '2026-09-15', znesek: 100 }),
      vnos('2026-002', { placanoAt: '2026-09-28', znesek: 250.5 }),
    ])
    expect(p.meseci).toEqual([{ mesec: '2026-09', stRacunov: 2, prihodki: 350.5 }])
    expect(p.skupajPrihodki).toBe(350.5)
    expect(p.skupajRacunov).toBe(2)
  })

  it('meseci NARAŠČajoče (leksikografsko YYYY-MM — tudi preko leta)', () => {
    const p = prihodkiPoMesecih([
      vnos('2026-001', { placanoAt: '2026-01-05', znesek: 10 }),
      vnos('2025-002', { placanoAt: '2025-12-30', znesek: 20 }),
      vnos('2026-003', { placanoAt: '2026-03-01', znesek: 30 }),
    ])
    expect(p.meseci.map((m) => m.mesec)).toEqual(['2025-12', '2026-01', '2026-03'])
  })

  it('IZDAN = v teku (števec + znesek) — NI v mesecih in NI v skupaj', () => {
    const p = prihodkiPoMesecih([
      vnos('2026-001', { status: 'IZDAN', placanoAt: null, znesek: 400 }),
      vnos('2026-002', { znesek: 100 }),
    ])
    expect(p.meseci).toHaveLength(1)
    expect(p.stIzdanih).toBe(1)
    expect(p.znesekIzdanih).toBe(400)
    expect(p.skupajPrihodki).toBe(100)
  })

  it('OSNUTEK in STORNIRAN = števca (iskrena resnica, izključeni iz zneskov)', () => {
    const p = prihodkiPoMesecih([
      vnos('2026-001', { status: 'OSNUTEK', placanoAt: null, znesek: 999 }),
      vnos('2026-002', { status: 'STORNIRAN', placanoAt: null, znesek: 888 }),
      vnos('2026-003', { znesek: 100 }),
    ])
    expect(p.stOsnutkov).toBe(1)
    expect(p.stStorniranih).toBe(1)
    expect(p.skupajPrihodki).toBe(100)
  })

  it('skupajPrihodki = vsota meseci (identiteta po konstrukciji)', () => {
    const p = prihodkiPoMesecih([
      vnos('2026-001', { placanoAt: '2026-08-10', znesek: 120 }),
      vnos('2026-002', { placanoAt: '2026-09-11', znesek: 130 }),
      vnos('2026-003', { placanoAt: '2026-09-12', znesek: 140 }),
    ])
    const vsotaMeseci = p.meseci.reduce((a, m) => a + m.prihodki, 0)
    expect(vsotaMeseci).toBe(p.skupajPrihodki)
    expect(p.skupajRacunov).toBe(3)
  })

  it('determinizem: ISTA množica v drugem vrstnem redu = ISTI rezultat (sort po številki v libu)', () => {
    const a = prihodkiPoMesecih([
      vnos('2026-003', { placanoAt: '2026-09-20', znesek: 0.3 }),
      vnos('2026-001', { placanoAt: '2026-09-10', znesek: 0.1 }),
      vnos('2026-002', { placanoAt: '2026-09-15', znesek: 0.2 }),
    ])
    const b = prihodkiPoMesecih([
      vnos('2026-001', { placanoAt: '2026-09-10', znesek: 0.1 }),
      vnos('2026-002', { placanoAt: '2026-09-15', znesek: 0.2 }),
      vnos('2026-003', { placanoAt: '2026-09-20', znesek: 0.3 }),
    ])
    expect(a).toEqual(b)
  })

  it('prazen seznam = iskrena ničla (brez lažnih mesecov)', () => {
    const p = prihodkiPoMesecih([])
    expect(p).toEqual({
      meseci: [],
      skupajPrihodki: 0,
      skupajRacunov: 0,
      stIzdanih: 0,
      znesekIzdanih: 0,
      stOsnutkov: 0,
      stStorniranih: 0,
    })
  })

  it('znesek 0 je veljaven prihodek (ne-negativno — preveriPrihodkiVnos kanon)', () => {
    const p = prihodkiPoMesecih([vnos('2026-001', { znesek: 0 })])
    expect(p.meseci).toEqual([{ mesec: '2026-09', stRacunov: 1, prihodki: 0 }])
  })

  it('vhod NI spremenjen (čista funkcija)', () => {
    const arr = [vnos('2026-002'), vnos('2026-001')]
    const kopija = JSON.parse(JSON.stringify(arr)) as PrihodkiPdfVnos[]
    prihodkiPoMesecih(arr)
    expect(arr).toEqual(kopija)
  })
})

describe('R290 prihodkiPoMesecih — fail-closed', () => {
  it('ne-polje → TypeError', () => {
    expect(() => prihodkiPoMesecih(null as unknown as PrihodkiPdfVnos[])).toThrow(TypeError)
    expect(() => prihodkiPoMesecih('ne' as unknown as PrihodkiPdfVnos[])).toThrow(TypeError)
  })

  it('pokvaren vnos = prelomljen seznam (EN VIR preveriPrihodkiVnos — indeks v sporočilu)', () => {
    expect(() =>
      prihodkiPoMesecih([vnos('2026-001'), vnos('2026-002', { status: 'PLACAN', placanoAt: null })]),
    ).toThrow(/preveriPrihodkiVnos \(1\)/)
  })

  it('placanoAt na ne-PLACAN = inkonzistenca (nika tihe spregledana)', () => {
    expect(() =>
      prihodkiPoMesecih([vnos('2026-001', { status: 'IZDAN', placanoAt: '2026-09-15' })]),
    ).toThrow(TypeError)
  })

  it('ne-finite znesek → TypeError', () => {
    expect(() => prihodkiPoMesecih([vnos('2026-001', { znesek: Number.NaN })])).toThrow(TypeError)
  })

  it('ne-objektni vnos → TypeError z indeksom', () => {
    expect(() => prihodkiPoMesecih([null as unknown as PrihodkiPdfVnos])).toThrow(TypeError)
  })
})

describe('R290 racunBeseda — slovenska množina po konvenciji repozitorija', () => {
  it.each([
    [0, 'računov'],
    [1, 'račun'],
    [2, 'računa'],
    [3, 'računi'],
    [4, 'računi'],
    [5, 'računov'],
    [11, 'računov'],
    [14, 'računov'],
    [21, 'račun'],
    [22, 'računa'],
    [24, 'računi'],
    [112, 'računov'],
  ])('%i → %s', (n, expected) => {
    expect(racunBeseda(n)).toBe(expected)
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('pokvaren n %s → TypeError', (n) => {
    expect(() => racunBeseda(n as number)).toThrow(TypeError)
  })
})

// ---------------------------------------------------------------------------
// STRAŽAR — invoice-manager žičenje (statika, vzorec r288/r289 strazar)
// ---------------------------------------------------------------------------

const im = readFileSync(
  join(process.cwd(), 'src', 'components', 'roksal', 'invoice-manager.tsx'),
  'utf8',
)

describe('R290 strazar — prihodki po mesecih žičenje (invoice-manager)', () => {
  it('EN VIR preslikava: prihodkiVnosi useMemo obstaja, stara inline preslikava je izbrisana', () => {
    expect(im).toContain('prihodkiVnosi')
    expect(im).toContain('const vnosi = prihodkiVnosi')
    // stara inline preslikava v handlerju NE SME več obstajati (enkrat, ne dvakrat)
    expect(im.match(/invoices\.map\(\(inv\) => \(\{/g)).toHaveLength(1)
  })

  it('sekcija ima poimenovano aria regijo + mesecni seznam + skupaj vrstico', () => {
    expect(im).toContain('aria-label="Prihodki po mesecih — po mesecu plačila"')
    expect(im).toContain('Prihodki po mesecih')
    expect(im).toContain('Skupaj plačano')
  })

  it('fail-verbose napaka: role="alert" z razlogom (nikoli tiha praznina)', () => {
    expect(im).toContain('role="alert"')
    expect(im).toContain('ni mogoče razčleniti')
  })

  it('iskrena praznina + pogojni stornirani žig (izključeni iz zneskov)', () => {
    expect(im).toContain('Ni plačanih računov — prihodki po mesecih se izrišejo ob prvem plačilu.')
    expect(im).toContain('(izključeni iz zneskov)')
  })

  it('žetoni (border-border/60 · bg-muted/40 · text-roksal-ink · tabular-nums) — 0 novih hex', () => {
    expect(im).toContain('border-border/60 bg-muted/40')
    expect(im).toContain('text-roksal-ink')
    const hexi = im.match(/#[0-9a-fA-F]{6}/g) ?? []
    expect(hexi).toHaveLength(6) // baseline: 3 QR vrstice × 2 barvi (dark '#1d2b3e' + light '#ffffff') — 0 novih
  })

  it('MANDATORY STIL: KPI boxi nosijo hover title z izrečeno izpeljavo', () => {
    expect(im).toContain('Plačano = vsi računi s statusom PLACAN (vsota zneskov)')
    expect(im).toContain('Odprto = izdano (IZDAN + PLACAN), neplačano — ISTI trikot kot prihodki PDF')
    expect(im).toContain('Zapadlo = izdani računi prek roka plačila (rok = izdaja + rokPlacilaDni)')
  })

  it('v-teku vrstica je pogojna (IZDAN > 0) — ni lažnega 0 stanja', () => {
    expect(im).toContain('v teku:')
  })
})
