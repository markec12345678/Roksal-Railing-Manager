// R345 — MANDATORY STIL val 28 (r162/…/R343 val 27 vzorec): hover + a11y
// parity zaglavij zgodovine in predlog (kalkulator).
// ---------------------------------------------------------------------------
//  • vzorec R291/R293 a11y družina + val 25/26/27 title parity: zaglavjni
//    destruktivni/izvozni gumbi dobijo title (razlaga posledice) in
//    aria-label (razločitev za bralnike zaslona — vidno besedilo "Počisti"
//    je dvoumno: zgodovina ALI predloge?);
//  • Izvozi CSV → title (razlaga kaj izvozi — 7-stolpčni kanon 65. člena);
//  • Počisti (zgodovina) → aria-label + title;
//  • Počisti vse (predloge) → aria-label + title;
//  • 0 novih hex (0-hex kanon val 15–27);
//  • obrnjene regresije: val 27 badge title ŽIVO, val 26 prstni odtis title
//    ŽIVO, val 24 vodja ring amber/50 ×12, globals .press-scale ŽIV,
//    cursor-help še vedno točno ×1 (val 26 badge izven gumba).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const M_TAB = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')
const CALC = join(process.cwd(), 'src/components/roksal/calculator/calculations.ts')

const tab = readFileSync(TAB, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')
const mTab = readFileSync(M_TAB, 'utf8')
const calc = readFileSync(CALC, 'utf8')

describe('r345 STIL val 28 — parity zaglavij: izvoz + čiščenje', () => {
  it('Izvozi CSV: razlagalni title (7-stolpčni kanon 65. člena)', () => {
    expect(tab).toContain('title="Izvoz zgodovine izračunov kot CSV datoteka"')
  })

  it('Počisti (zgodovina): aria-label razločitev + title posledice', () => {
    expect(tab).toContain('aria-label="Počisti zgodovino izračunov"')
    expect(tab).toContain('title="Pobriši celotno zgodovino izračunov"')
    // privzeti niz "Počisti" sam po sebi ne zadošča — obe lastnici sta vezani na clearHistory
    const i = tab.indexOf('onClick={clearHistory}')
    const okno = tab.slice(i, i + 220)
    expect(okno).toContain('Počisti zgodovino izračunov')
    expect(okno).toContain('Pobriši celotno zgodovino izračunov')
  })

  it('Počisti vse (predloge): aria-label razločitev + title posledice', () => {
    expect(tab).toContain('aria-label="Počisti vse predloge"')
    expect(tab).toContain('title="Pobriši vse shranjene predloge"')
    const i = tab.indexOf("odstraniIzSkladisca(SKLADISCE_PREDLOGE)")
    const okno = tab.slice(i, i + 400)
    expect(okno).toContain('Počisti vse predloge')
    expect(okno).toContain('Pobriši vse shranjene predloge')
  })

  it('0 novih hex: val 28 ne uvaja barv (samo title/aria atributi)', () => {
    const i = tab.indexOf('title="Izvoz zgodovine izračunov')
    const okno = tab.slice(i, i + 300)
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(calc).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it('obrnjena regresija val 27: badge title predlog ŽIVO + izbriši parity ŽIVO', () => {
    expect(tab).toContain('title="Predloga shranjenega izračuna — nalaganje zapolni vsa vnosna polja načina"')
    expect(tab).toContain('aria-label="Izbriši predlogo"')
    expect(tab).toContain('title="Izbriši predlogo"')
  })

  it('obrnjena regresija val 26: prstni odtis title ŽIVO + cursor-help točno ×1', () => {
    expect(tab).toContain('title="Prstni odtis izračuna — verzija formule in hash vhodov za reproducibilnost (R150)"')
    expect(tab.match(/cursor-help/g)?.length).toBe(1)
  })

  it('obrnjena regresija val 24: vodja amber/50 ring ×12 + globals press-scale ŽIV', () => {
    expect(vodja.split('focus-visible:ring-roksal-amber/50').length - 1).toBe(13) // R355: 12→13 (KATALOG pill — 65. člen IZVOZI družine: polni katalog zmožnosti §11 kot CSV, bratska simetrija amber/50 izvozne družine vodje)
    expect(globals).toContain('.press-scale')
  })

  it('obrnjena regresija val 25: revizijska sled title ŽIVO (measurements)', () => {
    expect(mTab).toContain('title={auditActionTitles[entry.akcija]}')
  })

  it('a11y družina R291/R293: vnosni gumb zgodovine še vedno nosi aria-label (nedotaknjen)', () => {
    expect(tab).toContain('aria-label={`Naloži izračun: ${entry.modeLabel}, ${entry.keyResult}`}')
  })
})
