// R168 — agregat predvidenih ur + POVZETEK na kartici Termini.
// ---------------------------------------------------------------------------
// Runda R168 doda:
//  (1) normalizirajTermin parse predvideneUre (pomožni podatek: pokvarjen/
//      manjkajoč → null, NE razveljavi vrstice, NIKOLI izmišljen kot 0);
//  (2) vsotaPredvidenihUr — vsota nad FILTRIRANIMI prikazanimi vrsticami
//      (PREKlicANO izključen + vidno preštet; brez znane ure → '≥' meja);
//  (3) terminBeseda / terminUrPovzetek — slovenska množina + EN VIR RESNICE
//      besedilo povzetka (UI pokaže točno to, kar test pravi);
//  (4) žičenje v TerminiCard (agregat nad prikazane, povzetek v viden panel,
//      tabular-nums, title dokumentira izključitev preklicanih).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  normalizirajTermin,
  terminBeseda,
  terminUrPovzetek,
  vsotaPredvidenihUr,
  type TerminPrikazVnos,
  type UrAgregat,
} from '../termini-prikaz'

const NOW = new Date(2026, 8, 26, 12, 0, 0)
const danesOsem = new Date(2026, 8, 26, 8, 0, 0).toISOString()
const jutriDevet = new Date(2026, 8, 27, 9, 30, 0).toISOString()

function surovi(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 't1',
    projectId: 'p1',
    datumZacetka: danesOsem,
    status: 'NAVRTENO',
    predvideneUre: 8,
    lokacija: 'Cesta na tam 12',
    project: { id: 'p1', nazivProjekta: 'Projekt A', customer: { ime: 'Stranka 1', naslov: 'Naslov 1' } },
    crew: { id: 'c1', naziv: 'Ekipa 1', barva: '#ff0000' },
    monter: { id: 'm1', ime: 'Miha' },
    ...overrides,
  }
}

function vnos(overrides: Partial<TerminPrikazVnos> = {}): TerminPrikazVnos {
  return {
    id: 't1',
    projectId: 'p1',
    projektIme: 'Projekt A',
    strankaIme: 'Stranka 1',
    strankaNaslov: 'Naslov 1',
    lokacija: 'Cesta na tam 12',
    ekipaIme: 'Ekipa 1',
    monterId: 'm1',
    monterIme: 'Miha',
    status: 'NAVRTENO',
    datumZacetka: danesOsem,
    predvideneUre: 8,
    moja: false,
    ...overrides,
  }
}

/** Surovi vnos je v testih vedno veljaven — pomagaj TS ožji preverbi. */
function vnosOd(raw: Record<string, unknown>, myUserId: string | null): TerminPrikazVnos {
  const res = normalizirajTermin(raw, myUserId)
  if (!('vnos' in res)) throw new Error('testovni surovi vnos naj bi bil veljaven')
  return res.vnos
}

describe('R168 normalizirajTermin — predvideneUre parse (pomožni podatek)', () => {
  it('celo število ≥ 0 → ohranjeno (8, 0)', () => {
    expect(vnosOd(surovi({ predvideneUre: 8 }), null).predvideneUre).toBe(8)
    // 0 ur je VELJAVEN podatek (kratko delo) — NE 'brez podatka':
    expect(vnosOd(surovi({ predvideneUre: 0 }), null).predvideneUre).toBe(0)
  })

  it('manjkajoče → null (starejši zapisi/prikriti select — brez izmišljevanja)', () => {
    const r = surovi()
    delete r.predvideneUre
    expect(vnosOd(r, null).predvideneUre).toBeNull()
  })

  it('pokvarjeni tipi → null (string, decimalno, negativno, boolean)', () => {
    expect(vnosOd(surovi({ predvideneUre: '8' }), null).predvideneUre).toBeNull()
    expect(vnosOd(surovi({ predvideneUre: 7.5 }), null).predvideneUre).toBeNull()
    expect(vnosOd(surovi({ predvideneUre: -3 }), null).predvideneUre).toBeNull()
    expect(vnosOd(surovi({ predvideneUre: true }), null).predvideneUre).toBeNull()
    expect(vnosOd(surovi({ predvideneUre: NaN }), null).predvideneUre).toBeNull()
  })

  it('pokvarjene ure NE razveljavijo sicer veljavne vrstice (jedro = id/datum/status)', () => {
    const v = vnosOd(surovi({ predvideneUre: 'pokvarjeno' }), 'm1')
    expect(v.projektIme).toBe('Projekt A')
    expect(v.moja).toBe(true)
  })
})

describe('R168 vsotaPredvidenihUr — vsota nad prikazanimi (filtriranimi) vrsticami', () => {
  it('prazno polje → ničelni agregat', () => {
    expect(vsotaPredvidenihUr([])).toEqual({ ure: 0, stTerminov: 0, brezUre: 0, preklicanih: 0 })
  })

  it('točna vsota: 8 + 4 + 8 = 20 h, 3 termina', () => {
    const ag = vsotaPredvidenihUr([
      vnos({ id: 'a', predvideneUre: 8 }),
      vnos({ id: 'b', predvideneUre: 4 }),
      vnos({ id: 'c', predvideneUre: 8 }),
    ])
    expect(ag).toEqual({ ure: 20, stTerminov: 3, brezUre: 0, preklicanih: 0 })
  })

  it('PREKlicANO IZKLJUČEN iz vsote in VIDNO preštet (nikoli tihega izginjanja)', () => {
    const ag = vsotaPredvidenihUr([
      vnos({ id: 'a', predvideneUre: 8 }),
      vnos({ id: 'x', predvideneUre: 100, status: 'PREKlicANO' }),
      vnos({ id: 'y', predvideneUre: 6, status: 'PREKlicANO' }),
    ])
    expect(ag.ure).toBe(8)
    expect(ag.stTerminov).toBe(1)
    expect(ag.preklicanih).toBe(2)
  })

  it('PRELOZENO ŠTEJE (preloženo delo še vedno čaka) — samo PREKlicANO ne', () => {
    const ag = vsotaPredvidenihUr([
      vnos({ id: 'a', predvideneUre: 8 }),
      vnos({ id: 'p', predvideneUre: 4, status: 'PRELOZENO' }),
      vnos({ id: 'v', predvideneUre: 2, status: 'V_TEKU' }),
    ])
    expect(ag.ure).toBe(14)
    expect(ag.stTerminov).toBe(3)
    expect(ag.preklicanih).toBe(0)
  })

  it('brez znane ure → ne prispeva h vsoti, šteje se v brezUre (vsota = spodnja meja)', () => {
    const ag = vsotaPredvidenihUr([
      vnos({ id: 'a', predvideneUre: 8 }),
      vnos({ id: 'b', predvideneUre: null }),
    ])
    expect(ag.ure).toBe(8)
    expect(ag.stTerminov).toBe(2)
    expect(ag.brezUre).toBe(1)
  })

  it('0 ur je VELJAVEN podatek (šteje se v vsoto, NI "brez ure")', () => {
    const ag = vsotaPredvidenihUr([
      vnos({ id: 'a', predvideneUre: 0 }),
      vnos({ id: 'b', predvideneUre: 5 }),
    ])
    expect(ag.ure).toBe(5)
    expect(ag.stTerminov).toBe(2)
    expect(ag.brezUre).toBe(0)
  })

  it('fail-closed: ne-polje → TypeError; pokvarjen vnos (null / brez / prazen id) → TypeError', () => {
    expect(() => vsotaPredvidenihUr(null as never)).toThrow(TypeError)
    expect(() => vsotaPredvidenihUr('polno' as never)).toThrow(TypeError)
    expect(() => vsotaPredvidenihUr([null as never])).toThrow(TypeError)
    expect(() => vsotaPredvidenihUr([{ ...vnos(), id: undefined } as never])).toThrow(TypeError)
    expect(() => vsotaPredvidenihUr([{ ...vnos(), id: '' } as never])).toThrow(TypeError)
  })

  it('čista funkcija: vhod nespremenjen, isti vhod → isti izhod (determinizem)', () => {
    const seznam = [vnos({ id: 'a', predvideneUre: 8 }), vnos({ id: 'b', predvideneUre: null })]
    const kopija = seznam.map((v) => ({ ...v }))
    const ag1 = vsotaPredvidenihUr(seznam)
    const ag2 = vsotaPredvidenihUr(seznam)
    expect(ag1).toEqual(ag2)
    expect(seznam.map((v) => ({ ...v }))).toEqual(kopija)
  })
})

describe('R168 terminBeseda — slovenska množina po konvenciji repo (projektiLabel)', () => {
  it('osnovna pravila: 1 termin; 2 termina (dvojina); 3/4 termini (množina); 0, 5+ terminov', () => {
    expect(terminBeseda(0)).toBe('terminov')
    expect(terminBeseda(1)).toBe('termin')
    expect(terminBeseda(2)).toBe('termina')
    expect(terminBeseda(3)).toBe('termini')
    expect(terminBeseda(4)).toBe('termini')
    expect(terminBeseda(5)).toBe('terminov')
    expect(terminBeseda(11)).toBe('terminov')
    expect(terminBeseda(12)).toBe('terminov')
    expect(terminBeseda(13)).toBe('terminov')
    expect(terminBeseda(14)).toBe('terminov')
    expect(terminBeseda(21)).toBe('termin')
    expect(terminBeseda(22)).toBe('termina')
    expect(terminBeseda(23)).toBe('termini')
    expect(terminBeseda(24)).toBe('termini')
    expect(terminBeseda(25)).toBe('terminov')
    expect(terminBeseda(101)).toBe('termin')
    expect(terminBeseda(112)).toBe('terminov')
  })

  it('fail-closed: negativno / decimalno → TypeError', () => {
    expect(() => terminBeseda(-1)).toThrow(TypeError)
    expect(() => terminBeseda(1.5)).toThrow(TypeError)
    expect(() => terminBeseda(NaN)).toThrow(TypeError)
  })
})

describe('R168 terminUrPovzetek — EN VIR RESNICE besedilo povzetka', () => {
  it('točna vsota: "Skupaj 20 h · 3 termini"', () => {
    const ag: UrAgregat = { ure: 20, stTerminov: 3, brezUre: 0, preklicanih: 0 }
    expect(terminUrPovzetek(ag)).toBe('Skupaj 20 h · 3 termini')
  })

  it('ena termin: "Skupaj 8 h · 1 termin"', () => {
    expect(terminUrPovzetek({ ure: 8, stTerminov: 1, brezUre: 0, preklicanih: 0 })).toBe(
      'Skupaj 8 h · 1 termin'
    )
  })

  it('brez znane ure → "≥" (matematično resnična spodnja meja) + "1 brez ure"', () => {
    expect(terminUrPovzetek({ ure: 8, stTerminov: 2, brezUre: 1, preklicanih: 0 })).toBe(
      'Skupaj ≥ 8 h · 2 termina · 1 brez ure'
    )
  })

  it('preklicani → vidno omenjen: "· brez 1 preklicanega" / "· brez 2 preklicanih"', () => {
    expect(terminUrPovzetek({ ure: 20, stTerminov: 3, brezUre: 0, preklicanih: 1 })).toBe(
      'Skupaj 20 h · 3 termini · brez 1 preklicanega'
    )
    expect(terminUrPovzetek({ ure: 20, stTerminov: 3, brezUre: 0, preklicanih: 2 })).toBe(
      'Skupaj 20 h · 3 termini · brez 2 preklicanih'
    )
  })

  it('kombinirano: ≥ + brez ure + preklicani', () => {
    expect(terminUrPovzetek({ ure: 12, stTerminov: 4, brezUre: 2, preklicanih: 3 })).toBe(
      'Skupaj ≥ 12 h · 4 termini · 2 brez ure · brez 3 preklicanih'
    )
  })

  it('samo preklicani (brez veljavnih) → iskreno posebno besedilo', () => {
    expect(terminUrPovzetek({ ure: 0, stTerminov: 0, brezUre: 0, preklicanih: 2 })).toBe(
      'Samo preklicani termini (2) — brez predvidenih ur'
    )
  })

  it('fail-closed: null, negativne ure, stTerminov < brezUre → TypeError', () => {
    expect(() => terminUrPovzetek(null as never)).toThrow(TypeError)
    expect(() => terminUrPovzetek({ ure: -1, stTerminov: 1, brezUre: 0, preklicanih: 0 })).toThrow(TypeError)
    expect(() => terminUrPovzetek({ ure: 8, stTerminov: 1, brezUre: 2, preklicanih: 0 })).toThrow(TypeError)
    expect(() => terminUrPovzetek({ ure: 1.5, stTerminov: 1, brezUre: 0, preklicanih: 0 })).toThrow(TypeError)
  })
})

describe('R168 žičenje v TerminiCard — agregat nad prikazane, viden povzetek', () => {
  const komponenta = readFileSync(
    join(process.cwd(), 'src/components/roksal/termini-card.tsx'),
    'utf8'
  )

  it('agregat je izračunan iz FILTRIRANEGA prikazane (ne surovih vrstic)', () => {
    expect(komponenta).toContain('vsotaPredvidenihUr([...prikazane.danes, ...prikazane.kasneje])')
    // useMemo — ne izračun pri vsakem renderju:
    expect(komponenta).toMatch(/const urAgregat = useMemo\(/)
  })

  it('povzetek v viden panel: terminUrPovzetek + tabular-nums + title dokumentira izključitev', () => {
    expect(komponenta).toContain('{terminUrPovzetek(urAgregat)}')
    expect(komponenta).toMatch(/tabular-nums font-medium/)
    expect(komponenta).toContain('Vsota predvidenih ur prikazanih terminov (preklicani so izključeni)')
  })

  it('povzetek NIKOLI ob napaki/nalaganju (samo v veji z prikazanimi vrsticami)', () => {
    // vrstni red vej: skeleton/napaka → prazno stanje → podatki s povzetkom
    const napakaIdx = komponenta.indexOf("role=\"alert\"")
    const praznoIdx = komponenta.indexOf('Ni terminov v naslednjih 7 dneh.')
    const povzetekIdx = komponenta.indexOf('terminUrPovzetek(urAgregat)')
    expect(napakaIdx).toBeGreaterThan(-1)
    expect(praznoIdx).toBeGreaterThan(-1)
    expect(povzetekIdx).toBeGreaterThan(-1)
    expect(povzetekIdx).toBeGreaterThan(napakaIdx)
    expect(povzetekIdx).toBeGreaterThan(praznoIdx)
  })

  it('povzetek se izriše TUDI ko je stikalo "Samo moje" vklopljeno (agregat sledi filtru)', () => {
    // urAgregat je odvisen od prikazane (filtriran pogled) — ne od skupine:
    const useMemoIdx = komponenta.indexOf('const urAgregat = useMemo(')
    const body = komponenta.slice(useMemoIdx, useMemoIdx + 300)
    expect(body).toContain('prikazane')
    expect(body).not.toContain('skupine.danes')
  })
})

describe('R168 DARK stil pass — gradient/ring/bg-200 družine + ring-offset halo', () => {
  const read = (rel: string): string =>
    readFileSync(join(process.cwd(), rel), 'utf8')

  it.each([
    ['NACRTOVANO', 'from-stone-100 dark:from-stone-500/15', 'ring-stone-400/70 dark:ring-stone-500/70'],
    ['V_TEKU', 'from-amber-100 dark:from-amber-500/15', 'ring-amber-400/70 dark:ring-amber-500/70'],
    ['ZA_MONTAZO', 'from-orange-100 dark:from-orange-500/15', 'ring-orange-400/70 dark:ring-orange-500/70'],
    ['V_IZDELAVI', 'from-violet-100 dark:from-violet-500/15', 'ring-violet-400/70 dark:ring-violet-500/70'],
    ['MONTIRANO', 'from-teal-100 dark:from-teal-500/15', 'ring-teal-400/70 dark:ring-teal-500/70'],
    ['ZAKLJUCENO', 'from-emerald-100 dark:from-emerald-500/15', 'ring-emerald-400/70 dark:ring-emerald-500/70'],
    ['USTAVLJENO', 'from-rose-100 dark:from-rose-500/15', 'ring-rose-400/70 dark:ring-rose-500/70'],
  ])('deal-pipeline %s: head ima dark:from- in over ima dark:ring-', (_id, head, over) => {
    const src = read('src/components/roksal/deal-pipeline.tsx')
    expect(src).toContain(head)
    expect(src).toContain(over)
  })

  it.each([
    ['src/components/roksal/invoice-manager.tsx', 'bg-stone-200 dark:bg-stone-800'],
    ['src/components/roksal/roksal-catalog.tsx', 'bg-slate-200 dark:bg-slate-500/15 text-slate-800 dark:text-slate-200'],
    ['src/components/roksal/team-tab.tsx', 'bg-stone-200/70 dark:bg-stone-500/15 text-stone-600 dark:text-stone-400'],
  ])('%s: svetli bg žeton ima dark: ogledalo', (rel, zeton) => {
    expect(read(rel)).toContain(zeton)
  })

  it('globals.css: .dark * definira --tw-ring-offset-color (bela obroba halo fix — 40 rab v 19 datotekah; @property inherits:false → univerzalni selektor)', () => {
    const css = read('src/app/globals.css')
    const baseIdx = css.indexOf('@layer base')
    expect(baseIdx).toBeGreaterThan(-1)
    const baseBlock = css.slice(baseIdx, css.indexOf('@layer utilities'))
    expect(baseBlock).toMatch(/\.dark \*,/)
    expect(baseBlock).toContain('--tw-ring-offset-color: var(--background)')
  })

  it('izjeme ostajajo dokumentirane (svetla platna se ne sweepajo)', () => {
    // floor-plan-tab (risalna platno) JE NAMERNO svetel — brez dark: obveznosti
    const src = read('src/components/roksal/floor-plan-tab.tsx')
    expect(typeof src).toBe('string')
  })
})
