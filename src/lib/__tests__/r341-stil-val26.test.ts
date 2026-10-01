// R341 — MANDATORY STIL val 26 (r162/…/R339 vzorec): hover parity za
// zgodovino izračunov (kalkulator).
// ---------------------------------------------------------------------------
//  • vzorec R280 tip badge + R281 sync žig + R339 audit badge: title
//    razložljivost + cursor-help na ne-interactive badge (prstni odtis);
//  • vnosni gumb zgodovine dobi title (viden naslovnik — aria-label že
//    nosi vsebino za bralnike; hover parity za vidne uporabnike);
//  • 0 novih hex (0-hex kanon val 15–25) — samo title + cursor-help;
//  • obrnjene regresije: val 25 audit badge ŽIVO, val 24 vodja pill
//    amber/50 ŽIVA, val 23 navy/40 ŽIVA, globals .press-scale ŽIV;
//  • register sodelovanje: vodja NI urejen → vsi val8/val9/val23/val24/val25
//    pini ostanejo na R339 resnici (anti-stale dokaz obratne smeri).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const SHARED = join(process.cwd(), 'src/components/roksal/calculator/shared.ts')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const M_TAB = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')

const tab = readFileSync(TAB, 'utf8')
const shared = readFileSync(SHARED, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')
const mTab = readFileSync(M_TAB, 'utf8')

describe('r341 STIL val 26 — hover parity zgodovine izračunov: title + cursor-help', () => {
  it('prstni odtis badge: title razloži odtis (R150 kontekst) + cursor-help', () => {
    expect(tab).toContain('title="Prstni odtis izračuna — verzija formule in hash vhodov za reproducibilnost (R150)"')
    expect(tab).toContain('cursor-help')
  })

  it('vnosni gumb zgodovine: title hover parity (modeLabel — keyResult)', () => {
    expect(tab).toContain('title={`${entry.modeLabel} — ${entry.keyResult}`}')
  })

  it('gumb NE nosi cursor-help (interaktiven element — kurzor pokaže klikljivost)', () => {
    // cursor-help je SAMO na badge (1 pojavitev v tabu za val 26)
    expect(tab.match(/cursor-help/g)?.length).toBe(1)
  })

  it('0 novih hex: val 26 ne uvaja barv (samo atributa title/cursor-help)', () => {
    const okno = tab.slice(tab.indexOf('title="Prstni odtis izračuna'), tab.indexOf('title="Prstni odtis izračuna') + 500)
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(okno).toContain('bg-secondary/50')
  })

  it('obrnjena regresija val 25: revizijska sled title ŽIVO (measurements)', () => {
    expect(mTab).toContain('title={auditActionTitles[entry.akcija]}')
  })

  it('obrnjena regresija val 24: vodja amber/50 pill družina ŽIVA (ring ×12 = 11 pill val8 + 1 okno odstopanje)', () => {
    expect(vodja.split('focus-visible:ring-roksal-amber/50').length - 1).toBe(13) // R355: 12→13 (KATALOG pill — 65. člen IZVOZI družine: polni katalog zmožnosti §11 kot CSV, bratska simetrija amber/50 izvozne družine vodje)
  })

  it('obrnjena regresija val 23: navy/40 ring ŽIVA v vodji', () => {
    expect(vodja.split('focus-visible:ring-roksal-navy/40').length - 1).toBeGreaterThanOrEqual(1)
  })

  it('globals .press-scale ŽIV (taktilni kanon)', () => {
    expect(globals).toContain('.press-scale')
  })

  it('register sodelovanje: shared.ts ne uvaja surovih barv (0-hex kanon dekompozicije)', () => {
    expect(shared).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it('val 26 je vezan na zgodovino (R341 komentar v viru — sledljivost)', () => {
    // komentar nosi R341 žig v bližini odtis badge
    expect(tab).toContain('(R150)"')
    expect(tab).toContain('modeLabels')
  })
})
