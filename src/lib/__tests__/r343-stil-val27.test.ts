// R343 — MANDATORY STIL val 27 (r162/…/R341 vzorec): hover parity za
// prihranjene predloge (kalkulator).
// ---------------------------------------------------------------------------
//  • vzorec R280 tip badge + R281 sync žig + R339 audit badge + R341 val 26:
//    load gumb dobi title (viden naslovnik — vsebina = naziv + način);
//  • način badge dobi razlagalni title (edini NOV minifikacijo-preživeči
//    niz te runde — needle v qa-needles/r343.tsv);
//  • badge je znotraj kliknega gumba → cursor-help bi zavedel (klik še
//    vedno naloži predlogo) — ZATO brez cursor-help (iskrena razlika od
//    val 25/26, kjer je badge bil izven gumba);
//  • izbriši gumb dobi title hover parity (aria-label že nosi vsebino);
//  • 0 novih hex (0-hex kanon val 15–26);
//  • obrnjene regresije: val 26 zgodovina title ŽIVO, val 25 audit badge
//    ŽIVO, val 24 vodja ring amber/50 ×12, globals .press-scale ŽIV.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const M_TAB = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')

const tab = readFileSync(TAB, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')
const mTab = readFileSync(M_TAB, 'utf8')

describe('r343 STIL val 27 — hover parity prihranjenih predlog: title parity', () => {
  it('load gumb predloge: title = naziv — način (hover parity)', () => {
    expect(tab).toContain('title={`${tpl.naziv} — ${templateModeLabels[tpl.mode]}`}')
  })

  it('način badge: razlagalni title (edini nov needle-niz runde)', () => {
    expect(tab).toContain('title="Predloga shranjenega izračuna — nalaganje zapolni vsa vnosna polja načina"')
  })

  it('iskrena razlika od val 25/26: badge znotraj gumba NE nosi cursor-help (klik še vedno naloži)', () => {
    // cursor-help je v tabu točno ×1 (R341 val 26 prstni odtis badge — izven gumba)
    expect(tab.match(/cursor-help/g)?.length).toBe(1)
  })

  it('izbriši gumb predloge: title hover parity (aria-label že nosi vsebino)', () => {
    expect(tab).toContain('aria-label="Izbriši predlogo"')
    expect(tab).toContain('title="Izbriši predlogo"')
  })

  it('0 novih hex: val 27 ne uvaja barv (samo title atributi)', () => {
    const i = tab.indexOf('title="Predloga shranjenega izračuna')
    const okno = tab.slice(i, i + 500)
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(okno).toContain('bg-roksal-navy/5')
  })

  it('obrnjena regresija val 26: zgodovina title ŽIVO (prstni odtis badge + vnosni gumb)', () => {
    expect(tab).toContain('title="Prstni odtis izračuna — verzija formule in hash vhodov za reproducibilnost (R150)"')
    expect(tab).toContain('title={`${entry.modeLabel} — ${entry.keyResult}`}')
  })

  it('obrnjena regresija val 25: revizijska sled title ŽIVO (measurements)', () => {
    expect(mTab).toContain('title={auditActionTitles[entry.akcija]}')
  })

  it('obrnjena regresija val 24: vodja amber/50 ring ×12 (11 pill + 1 okno) + globals press-scale ŽIV', () => {
    expect(vodja.split('focus-visible:ring-roksal-amber/50').length - 1).toBe(12)
    expect(globals).toContain('.press-scale')
  })

  it('register sodelovanje: history.ts ne uvaja surovih barv (0-hex kanon dekompozicije)', () => {
    const hist = readFileSync(join(process.cwd(), 'src/components/roksal/calculator/history.ts'), 'utf8')
    expect(hist).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })
})
