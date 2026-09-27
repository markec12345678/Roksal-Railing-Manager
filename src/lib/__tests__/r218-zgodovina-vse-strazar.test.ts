// R218 — Zgodovina kot ČETRTI signalec konvergence (P1-e) + iskren skupni
// števec in 'Vse' povezava v paleti (P1-f).
//
// Prej: nedavna iskanja so nosila SAMO niz (uporabnik je včeraj prek iskanja
// naletel na artikel z nizko zalogo, danes v zgodovini te sledi NE vidi) in
// je heading 'Nizka zaloga' štel PRIKAZANE top 5 — pri 7 artiklih pod
// minimumom je iskreno povedal "5". Zdaj: EN VIR lib za vnose zgodovine z
// opcijskim žigom (fail-closed — goli niz iz sheme pred R218 = brez žiga,
// NIKOLI lažni), badge EN VIR komponenta (Material zadetek + zgodovina = ISTI
// vizual) ter heading s SKUPNIM števcem + 'Vse' vrstica ob > 5 (dialog je za
// EN artikel — 'Vse' gre v Zalogo, kjer je celotna slika).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  osnutekIzIskanja,
  preberiZgodovinoVnose,
  zdruziZgodovino,
  type RecentSearchVnos,
} from '@/lib/search-osnutek'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

describe('R218 — preberiZgodovinoVnose (fail-closed razčlenjevalnik)', () => {
  it('novi vnosi: {q, nizkaZaloga: true} ohrani žig', () => {
    const vnosi = preberiZgodovinoVnose(
      [{ q: 'inox', nizkaZaloga: true }],
      5,
    )
    expect(vnosi).toEqual([{ q: 'inox', nizkaZaloga: true }])
  })

  it('stari vnos (gol niz — shema pred R218): brez žiga, NI napaka', () => {
    const vnosi = preberiZgodovinoVnose(['inox', 'm8 a2'], 5)
    expect(vnosi).toEqual([{ q: 'inox' }, { q: 'm8 a2' }])
  })

  it('mešanica starih in novih vnosov v ENEM nizu', () => {
    const vnosi = preberiZgodovinoVnose(
      ['star vnos', { q: 'nov', nizkaZaloga: true }, { q: 'nov brez' }],
      5,
    )
    expect(vnosi).toEqual([
      { q: 'star vnos' },
      { q: 'nov', nizkaZaloga: true },
      { q: 'nov brez' },
    ])
  })

  it('pokvarjeni vnosi NEPADIČNO spustijo (ostali preživijo)', () => {
    const vnosi = preberiZgodovinoVnose(
      [42, null, { brez: 'q' }, { q: 7 }, 'a', '  ', 'veljaven', { q: 'tudi ta' }],
      5,
    )
    expect(vnosi).toEqual([{ q: 'veljaven' }, { q: 'tudi ta' }])
  })

  it('ne-nizi vhod (pokvarjen JSON): prazna zgodovina, brez metanja', () => {
    expect(preberiZgodovinoVnose('niz', 5)).toEqual([])
    expect(preberiZgodovinoVnose({ q: 'objekt' }, 5)).toEqual([])
    expect(preberiZgodovinoVnose(null, 5)).toEqual([])
  })

  it('žig nosi SAMO dobesedna true (false/"true"/1 = nevtralno — ni laži)', () => {
    const vnosi = preberiZgodovinoVnose(
      [
        { q: 'a1', nizkaZaloga: false },
        { q: 'b2', nizkaZaloga: 'true' },
        { q: 'c3', nizkaZaloga: 1 },
        { q: 'd4', nizkaZaloga: true },
      ],
      5,
    )
    expect(vnosi[0]).toEqual({ q: 'a1' })
    expect(vnosi[1]).toEqual({ q: 'b2' })
    expect(vnosi[2]).toEqual({ q: 'c3' })
    expect(vnosi[3]).toEqual({ q: 'd4', nizkaZaloga: true })
  })

  it('počisti presledke + zahteva ≥ 2 znaka (deterministična normalizacija)', () => {
    const vnosi = preberiZgodovinoVnose(['  inox Vijak  ', 'x'], 5)
    expect(vnosi).toEqual([{ q: 'inox Vijak' }])
  })

  it('omejitev na max (zgodovina ne raste neomejeno)', () => {
    const raw = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg']
    expect(preberiZgodovinoVnose(raw, 5)).toHaveLength(5)
    expect(preberiZgodovinoVnose(raw, 5)[0]).toEqual({ q: 'aa' })
  })
})

describe('R218 — zdruziZgodovino (ena združitev, ISTI vzorec kot pred R218)', () => {
  it('nov vnos gre na ZAČETEK, dedup po malih črkah', () => {
    const obstojeca: RecentSearchVnos[] = [{ q: 'Inox' }, { q: 'kolo' }]
    const zdruzena = zdruziZgodovino(obstojeca, 'inox', undefined, 5)
    expect(zdruzena).toEqual([{ q: 'inox' }, { q: 'kolo' }])
  })

  it('žig se zapiše SAMO ko je true (običajni izbor = čist vnos)', () => {
    const zdruzena = zdruziZgodovino([], 'm12', true, 5)
    expect(zdruzena).toEqual([{ q: 'm12', nizkaZaloga: true }])
    const brez = zdruziZgodovino([], 'm12', false, 5)
    expect(brez).toEqual([{ q: 'm12' }])
    expect(brez[0]).not.toHaveProperty('nizkaZaloga')
  })

  it('krajša od 2 znakov zgodovino NE spremeni (vrne kopijo)', () => {
    const obstojeca: RecentSearchVnos[] = [{ q: 'inox' }]
    const rez = zdruziZgodovino(obstojeca, 'x', true, 5)
    expect(rez).toEqual([{ q: 'inox' }])
    expect(rez).not.toBe(obstojeca)
  })

  it('stari vnos ISTE poizvedbe zamenja nov (žig sveže resnice)', () => {
    const obstojeca: RecentSearchVnos[] = [{ q: 'inox' }, { q: 'kolo' }]
    const zdruzena = zdruziZgodovino(obstojeca, 'INOX', true, 5)
    expect(zdruzena).toEqual([{ q: 'INOX', nizkaZaloga: true }, { q: 'kolo' }])
  })

  it('omejitev na max pri združevanju', () => {
    const obstojeca: RecentSearchVnos[] = [
      { q: 'aa' }, { q: 'bb' }, { q: 'cc' }, { q: 'dd' }, { q: 'ee' },
    ]
    expect(zdruziZgodovino(obstojeca, 'ff', undefined, 5)).toHaveLength(5)
    expect(zdruziZgodovino(obstojeca, 'ff', undefined, 5)[0]).toEqual({ q: 'ff' })
  })
})

describe('R218 — osnutekIzIskanja NESPREMENJEN (regresija R217 fail-closed)', () => {
  it('popolna polja + <= minimum → artikel; sicer null', () => {
    expect(osnutekIzIskanja({
      id: 'a1', naziv: 'M12', sifra: 'INOX-M12-A4',
      kolicinaZaloga: 15, minimalnaZaloga: 50, enota: 'kos',
    })).toEqual({
      id: 'a1', sifraMateriala: 'INOX-M12-A4', naziv: 'M12',
      kolicinaZaloga: 15, enota: 'kos', minimalnaZaloga: 50,
    })
    expect(osnutekIzIskanja({
      id: 'a2', naziv: 'M8', sifra: 'INOX-M8-A2',
      kolicinaZaloga: 800, minimalnaZaloga: 50, enota: 'kos',
    })).toBeNull()
    expect(osnutekIzIskanja({
      id: 'a3', naziv: 'M8', sifra: 'INOX-M8-A2',
    })).toBeNull()
  })
})

describe("R218 — paleta: badge EN VIR + zgodovina + 'Vse' vrstica (command-palette.tsx)", () => {
  const src = beri('src/components/roksal/command-palette.tsx')

  it('EN VIR lib uvožen (preberiZgodovinoVnose + zdruziZgodovino + tip)', () => {
    expect(src).toContain('preberiZgodovinoVnose,')
    expect(src).toContain('zdruziZgodovino,')
    expect(src).toContain('type RecentSearchVnos,')
  })

  it('BadgeNizkaZaloga — EN VIR komponenta (R219 izluščena v svojo datoteko; zvonček = 5. signalec nosi ISTI vizual)', () => {
    // paleta jo UVOZI (ni več lokalne definicije — ENA definicija v
    // badge-nizka-zaloga.tsx, ki jo deli z zvončkom notification-center)
    expect(src).toContain("import { BadgeNizkaZaloga } from '@/components/roksal/badge-nizka-zaloga'")
    expect(src).not.toContain('function BadgeNizkaZaloga()')
    // Material zadetek ga uporablja ob osnutku
    expect(src).toContain('{osnutek && <BadgeNizkaZaloga />}')
    // zgodovina ga uporablja ob zabeleženem žigu
    expect(src).toContain('{r.nizkaZaloga === true && <BadgeNizkaZaloga />}')
  })

  it('Material izbor zabeleži žig (rememberSearch z osnutek !== null; R222 — + neodvisni žig brez)', () => {
    expect(src).toContain('rememberSearch(q, osnutek !== null, brez)')
  })

  it('saveRecentSearch nosi opcijski žig prek EN VIR zdruziZgodovino (R222 — tretji neobvezen argument)', () => {
    expect(src).toContain('function saveRecentSearch(q: string, nizkaZaloga?: boolean, brezDobavitelja?: boolean): void')
    expect(src).toContain('writeRecent(zdruziZgodovino(readRecentFromStorage(), q, nizkaZaloga, RECENT_MAX, brezDobavitelja))')
  })

  it('branje prek fail-closed razčlenjevalnika (gol niz iz sheme pred R218 preživi)', () => {
    expect(src).toContain('return preberiZgodovinoVnose(parsed, RECENT_MAX)')
  })

  it('iskren heading: števec = SKUPNO število pod minimumom (ne top 5)', () => {
    expect(src).toContain("countHeading('Nizka zaloga', nizkaZalogaSkupaj)")
    expect(src).toContain('setNizkaZalogaSkupaj(pod.length)')
  })

  it("'Vse' vrstica: samo ob > 5, hierarhija pl-8, tabular-nums; R219 — deep-link Z filtrom 'pod minimumom'", () => {
    expect(src).toContain('{nizkaZalogaSkupaj > nizkaZaloga.length && (')
    expect(src).toContain('value="nizka zaloga pokaži vse"')
    expect(src).toContain('aria-label={`Pokaži vseh ${nizkaZalogaSkupaj} artiklov s nizko zalogo v Zalogi`}')
    expect(src).toContain('Pokaži vse s nizko zalogo v Zalogi')
    expect(src).toContain('className="pl-8"')
    // R219 (P1-f): klik → Zaloga z AKTIVNIM čipom 'pod minimumom' (peti
    // argument, EN VIR lib inventory-filter) — vrstica ne obljublja ničesar,
    // česar Zaloga ne pokaže; dialog ostane ZA EN artikel (osnutek hint =
    // null). Okno je omejeno NA 'Vse' vrstico (do konca skupine — Material
    // zadetki s svojim deep-linkom so zakoniti in živijo v svoji sekciji).
    const zac = src.indexOf("value=\"nizka zaloga pokaži vse\"")
    const okno = src.slice(zac, src.indexOf('</CommandGroup>', zac))
    expect(okno).toContain("onNavigate('inventory', null, null, null, 'pod-minimumom')")
    expect(okno).not.toContain('osnutek')
  })

  it('zgodovina klik = ponovno iskanje (setQuery r.q — žig je namig, ne ukaz)', () => {
    expect(src).toContain('onSelect={() => setQuery(r.q)}')
    expect(src).toContain('key={r.q}')
    expect(src).toContain('value={`nedavno ${r.q}`}')
  })

  it('cancelled flag ohranjen (regresija R138/R215 vzorca)', () => {
    expect(src).toContain('if (cancelled) return')
  })

  it('0 novih hex v paleti (token družina — regresija R214–R217)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
