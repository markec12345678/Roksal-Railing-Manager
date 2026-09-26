// R188 — MONTER dom notice pasovi + zgodovina odzivnih časov zdravja.
// ---------------------------------------------------------------------------
// (a) P2 iz R186 QA dodatek: page.tsx skriva UpdateBanner + PwaStatus ob
//     activeTab==='viz' → parkirani MONTER na 'Moji projekti' (VizTab) NI
//     videl deploy pasu niti offline pasa. Zdaj VizTab montažira OBA sama —
//     izključitev z page.tsx pogojem (nikoli dvojni pas).
// (b) Zgodovina odzivnih časov na SISTEM — ZDRAVJE kartici (R187): trak
//     palic TE SEJE — samo realne meritve uspešnih preverb, ring obseg,
//     sklanjatev, aria povzetek — VSA odločitev v čistem jedru
//     src/lib/zdravje-zgodovina.ts (vzorec posodobitev-jedro/meritve-csv).
//     Fail-closed: napaka/omrežje NE dodata palice (nikoli lažna telemetrija).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const viz = (): string => srcOf('src/components/viz/viz-tab.tsx')
const page = (): string => srcOf('src/app/page.tsx')
const kartica = (): string => srcOf('src/components/roksal/sistem-zdravje-card.tsx')
const jedro = (): string => srcOf('src/lib/zdravje-zgodovina.ts')

// Čisto jedro — pravi uvoz (enake runde testi smejo uvažati jedro neposredno)
import {
  ZGODOVINA_MAX,
  dodajMeritev,
  obsegZgodovine,
  odziviPovzetek,
  sejaZgodovinaDodaj,
  sejaZgodovinaPreber,
  visinaPalice,
} from '../zdravje-zgodovina'

describe('R188 (a) — MONTER dom: sistemski notice pasovi v VizTab lupini (P2 iz R186 QA)', () => {
  it('VizTab uvaža OBÉ komponenti EN VIR vrstica (UpdateBanner + PwaStatus)', () => {
    const src = viz()
    expect(src).toContain("import { UpdateBanner } from '@/components/roksal/update-banner'")
    expect(src).toContain("import { PwaStatus } from '@/components/roksal/pwa-status'")
  })

  it('VizTab montažira vsako točko ENKRAT, tik pod <ProductHeader /> (v LASTNI lupini)', () => {
    const src = viz()
    expect(src.match(/<UpdateBanner \/>/g)?.length).toBe(1)
    expect(src.match(/<PwaStatus \/>/g)?.length).toBe(1)
    const headerIdx = src.indexOf('<ProductHeader />')
    const pwaIdx = src.indexOf('<PwaStatus />')
    const bannerIdx = src.indexOf('<UpdateBanner />')
    expect(headerIdx).toBeGreaterThan(-1)
    expect(pwaIdx).toBeGreaterThan(headerIdx)
    expect(bannerIdx).toBeGreaterThan(pwaIdx)
  })

  it('IZKLJUČITEV dvojnega pasa: page.tsx pogoj activeTab !== \'viz\' ostaja (ali page ALI VizTab, nikoli oba)', () => {
    expect(page()).toMatch(/\{activeTab !== 'viz' && <UpdateBanner \/>\}/)
    expect(page()).toMatch(/\{activeTab !== 'viz' && <PwaStatus \/>\}/)
    // VizTab mount je BREZ takega pogoja (pasova sta tam vedno montirana;
    // njun lasten fail-closed render skrije, ko nista relevantna)
    expect(viz()).toMatch(/<UpdateBanner \/>/)
    expect(viz()).not.toMatch(/\{activeTab !==/)
  })

  it('fail-closed render v obeh pasovih: banner null brez nove verzije, PWA pasovi pogojno znotraj AnimatePresence', () => {
    const banner = srcOf('src/components/roksal/update-banner.tsx')
    expect(banner).toMatch(/if \(!vidn\) return null/)
    const pwa = srcOf('src/components/roksal/pwa-status.tsx')
    expect(pwa).toContain('<AnimatePresence mode="wait">')
  })
})

describe('R188 (b) — zdravje zgodovina: čisto jedro (ring + sklanjatev + povzetek + palica)', () => {
  it('dodajMeritev: pripne in ohrani ring obseg ZGODOVINA_MAX (najstarejša pade ven)', () => {
    expect(dodajMeritev([], 120)).toEqual([120])
    const polna = Array.from({ length: ZGODOVINA_MAX }, (_, i) => i + 1)
    const naslednja = dodajMeritev(polna, 99)
    expect(naslednja).toHaveLength(ZGODOVINA_MAX)
    expect(naslednja[0]).toBe(2) // najstarejša (1) ven
    expect(naslednja[naslednja.length - 1]).toBe(99)
    // čisto: vhodna tabela NI spremenjena
    expect(polna[0]).toBe(1)
  })

  it('dodajMeritev: fail-closed TypeError na NaN / negativni / neskončni meritvi', () => {
    expect(() => dodajMeritev([], Number.NaN)).toThrow(TypeError)
    expect(() => dodajMeritev([], -1)).toThrow(TypeError)
    expect(() => dodajMeritev([], Number.POSITIVE_INFINITY)).toThrow(TypeError)
  })

  it('obsegZgodovine: sklanjatev 0/1/2/3/4/5+ (vzorec R162 revizijaLabel)', () => {
    expect(obsegZgodovine(0)).toBe('Ni preverb še.')
    expect(obsegZgodovine(1)).toBe('Zadnja preverba te seje')
    expect(obsegZgodovine(2)).toBe('Zadnji 2 preverbi te seje')
    expect(obsegZgodovine(3)).toBe('Zadnje 3 preverbe te seje')
    expect(obsegZgodovine(4)).toBe('Zadnje 4 preverbe te seje')
    expect(obsegZgodovine(5)).toBe('Zadnjih 5 preverb te seje')
    expect(obsegZgodovine(ZGODOVINA_MAX)).toBe(`Zadnjih ${ZGODOVINA_MAX} preverb te seje`)
    expect(() => obsegZgodovine(-1)).toThrow(TypeError)
    expect(() => obsegZgodovine(1.5)).toThrow(TypeError)
  })

  it('odziviPovzetek: prazno / ena / več meritev — deterministično, z razponom', () => {
    expect(odziviPovzetek([])).toBe('Ni še odzivnih časov — kartica se še preverja.')
    expect(odziviPovzetek([42])).toBe('Odzivni čas zadnje uspešne preverbe te seje: 42 ms.')
    const tri = odziviPovzetek([120, 30, 250])
    expect(tri).toBe('Odzivni časi — zadnje 3 preverbe te seje: od 30 do 250 ms.')
    expect(() => odziviPovzetek([10, Number.NaN])).toThrow(TypeError)
  })

  it('visinaPalice: sorazmerna z maksimumom, min 3 px, fail-closed TypeError', () => {
    expect(visinaPalice(100, 100)).toBe(28)
    expect(visinaPalice(50, 100)).toBe(14)
    expect(visinaPalice(1, 100)).toBe(3) // min clamp
    expect(() => visinaPalice(10, 0)).toThrow(TypeError)
    expect(() => visinaPalice(-5, 100)).toThrow(TypeError)
  })

  it('seja shrama: preživi remonte (modul-level), ring omejitev + fail-closed delegacija', () => {
    // ring je v jedru implliciran prek slice(-ZGODOVINA_MAX) — strážar:
    expect(jedro()).toMatch(/slice\(-ZGODOVINA_MAX\)/)
    // shrama je ZAČETNO prazna (modul se v testu naloži enkrat)
    expect(sejaZgodovinaPreber()).toEqual([])
    const ena = sejaZgodovinaDodaj(42)
    expect(ena).toEqual([42])
    const dva = sejaZgodovinaDodaj(17)
    expect(dva).toEqual([42, 17])
    expect(sejaZgodovinaPreber()).toEqual([42, 17]) // ista referenca stanja
    // fail-closed delegacija: neveljavna meritev NE spremeni shrame
    expect(() => sejaZgodovinaDodaj(-1)).toThrow(TypeError)
    expect(sejaZgodovinaPreber()).toEqual([42, 17])
    // ring omejitev prek shrame
    for (let i = 0; i < ZGODOVINA_MAX + 3; i++) sejaZgodovinaDodaj(i + 100)
    expect(sejaZgodovinaPreber()).toHaveLength(ZGODOVINA_MAX)
    expect(sejaZgodovinaPreber()[0]).not.toBe(42) // najstarejše padle ven
  })
})

describe('R188 (c) — zdravje kartica: zgodovina žičenje (samo uspeh — fail-closed telemetrija)', () => {
  it('EN VIR jedro: uvoz iz zdravje-zgodovina (ring + obseg + povzetek + palica + seja shrama)', () => {
    const src = kartica()
    expect(src).toContain("} from '@/lib/zdravje-zgodovina'")
    expect(src).toContain('sejaZgodovinaDodaj')
    expect(src).toContain('sejaZgodovinaPreber')
    expect(src).toContain('obsegZgodovine')
    expect(src).toContain('odziviPovzetek')
    expect(src).toContain('visinaPalice')
  })

  it('zgodovina raste SAMO v uspešni veji (napaka + omrežje NE dodata palice — fail-closed)', () => {
    const src = kartica()
    expect(src.match(/sejaZgodovinaDodaj\(/g)?.length).toBe(1)
    // klic je znotraj uspešne veje (za if res.ok && json && db === 'ok')
    const uspehIdx = src.indexOf("json.db === 'ok'")
    const setIdx = src.indexOf('sejaZgodovinaDodaj(')
    expect(uspehIdx).toBeGreaterThan(-1)
    expect(setIdx).toBeGreaterThan(uspehIdx)
    // seja shrama: initializacija lenoba iz modula (preživi remonte dashboarda)
    expect(src).toMatch(/useState<number\[\]>\(\(\) => \[\.\.\.sejaZgodovinaPreber\(\)\]\)/)
    expect(src).toMatch(/setZgodovina\(\[\.\.\.sejaZgodovinaDodaj\(Math\.round\(performance\.now\(\) - zacetek\)\)\]\)/)
    // NI ročnega rezanja v komponenti (ring je v jedru)
    expect(src).not.toMatch(/setZgodovina\(\(prej\)/)
  })

  it('render vrata: trak SAMO ob uspehu in vsaj eni meritvi; role="img" + aria EN VIR odziviPovzetek', () => {
    const src = kartica()
    expect(src).toMatch(/!napaka && data && zgodovina\.length > 0/)
    expect(src).toContain('role="img"')
    expect(src).toContain('aria-label={odziviPovzetek(zgodovina)}')
    // višina palice IZključno prek čistega jedra (nikoli ad-hoc razmerje)
    expect(src).toMatch(/visinaPalice\(ms, Math\.max\(\.\.\.zgodovina\)\)/)
    // zadnja palica poudarjena (dva razreda — zadnja vs ostale)
    expect(src).toMatch(/const zadnja = i === zgodovina\.length - 1/)
    expect(src).toContain("zadnja ? 'w-1.5 rounded-sm bg-roksal-amber' : 'w-1.5 rounded-sm bg-roksal-amber/40'")
  })

  it('vidna oznaka obsega z sklanjatvijo + ring obseg iz jedra (nič magic števil v oznaki)', () => {
    const src = kartica()
    expect(src).toContain('Odzivni časi ({obsegZgodovine(zgodovina.length)}, ring {ZGODOVINA_MAX})')
  })

  it('regresija: r187 pečat žičenja ostajajo (1× set, 2× null) + tight-header nespremenjen', () => {
    const src = kartica()
    expect(src.match(/setZdravjeOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    expect(src.match(/setZdravjeOsvezitev\(null\)/g)).toHaveLength(2)
    expect(src).toContain('className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"')
  })
})
