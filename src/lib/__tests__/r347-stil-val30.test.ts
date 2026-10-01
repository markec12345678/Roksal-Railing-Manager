// R347 — MANDATORY STIL val 30 (val 25–29 vzorec): a11y parity shranjenih
// izračunov (kalkulator) + tipografski popravek vidnega besedila.
// ---------------------------------------------------------------------------
//  • vzorec R291/R293 a11y družina + val 25–29 parity: kartica "Shranjeni
//    izračuni" je bila edina zgodovinska kartica brez razlagalnih atributov;
//  • Shrani izračun (primarni akcijski gumb) → aria-label + title;
//  • Počisti vse (shranjeni izračuni) → aria-label + title (parity z
//    "Počisti vse predloge" val 28);
//  • vnos nalaganja shranjenega izračuna → aria-label (parity z zgodovinskim
//    "Naloži izračun: …" in val 29 "Naloži predlogo: …");
//  • tipografski popravek: "Shrjeni izračuni" → "Shranjeni izračuni"
//    (vidno besedilo, ×1 — brez needle zaščite, preverjeno);
//  • 0 novih hex (0-hex kanon val 15–29);
//  • obrnjene regresije: val 29 ×2 niza ŽIVO, val 28 ×5 nizov ŽIVO,
//    R291/R293 vnosni gumb zgodovine aria-label ŽIVO.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const HIST = join(process.cwd(), 'src/components/roksal/calculator/history.ts')

const tab = readFileSync(TAB, 'utf8')
const hist = readFileSync(HIST, 'utf8')

describe('r347 STIL val 30 — parity shranjenih izračunov', () => {
  it('Shrani izračun: aria-label + title (primarni akcijski gumb)', () => {
    expect(tab).toContain('aria-label="Shrani trenutni izračun v shranjene izračune"')
    expect(tab).toContain('title="Shrani trenutni izračun z vsemi vnosi načina"')
    const i = tab.indexOf('toast.success(\'Izračun shranjen\')')
    const okno = tab.slice(i, i + 300)
    expect(okno).toContain('Shrani trenutni izračun v shranjene izračune')
  })

  it('Počisti vse (shranjeni izračuni): aria razločitev + title posledice (parity val 28)', () => {
    expect(tab).toContain('aria-label="Počisti vse shranjene izračune"')
    expect(tab).toContain('title="Pobriši celoten seznam shranjenih izračunov"')
    const i = tab.indexOf("localStorage.removeItem('roksal-saved-calculations')")
    const okno = tab.slice(i, i + 300)
    expect(okno).toContain('Počisti vse shranjene izračune')
    expect(okno).toContain('Pobriši celoten seznam shranjenih izračunov')
  })

  it('Naloži shranjeni izračun: aria-label (parity z zgodovino + predlogo)', () => {
    expect(tab).toContain('aria-label={`Naloži shranjeni izračun: ${calc.modeLabel}, ${calc.keyResult}`}')
  })

  it('tipografski popravek: "Shrjeni izračuni" → "Shranjeni izračuni" (×1, brez starke)', () => {
    expect(tab).not.toContain('Shrjeni')
    expect((tab.match(/Shranjeni izračuni/g) ?? []).length).toBe(1)
  })

  it('0 novih hex: val 30 ne uvaja barv (samo aria/title + besedilo)', () => {
    const i = tab.indexOf('aria-label="Počisti vse shranjene izračune"')
    const okno = tab.slice(i, i + 300)
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(hist).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it('obrnjena regresija val 29: oba parity niza ŽIVO (nedotaknjena)', () => {
    expect(tab).toContain('aria-label="Shrani trenutne vnose kot predlogo"')
    expect(tab).toContain('aria-label={`Naloži predlogo: ${tpl.naziv} (${templateModeLabels[tpl.mode]})`}')
  })

  it('obrnjena regresija val 28: vseh 5 parity nizov ŽIVO', () => {
    expect(tab).toContain('title="Izvoz zgodovine izračunov kot CSV datoteka"')
    expect(tab).toContain('aria-label="Počisti zgodovino izračunov"')
    expect(tab).toContain('title="Pobriši celotno zgodovino izračunov"')
    expect(tab).toContain('aria-label="Počisti vse predloge"')
    expect(tab).toContain('title="Pobriši vse shranjene predloge"')
  })

  it('a11y družina R291/R293: vnosni gumb zgodovine aria-label ŽIVO (nedotaknjen)', () => {
    expect(tab).toContain('aria-label={`Naloži izračun: ${entry.modeLabel}, ${entry.keyResult}`}')
  })
})
