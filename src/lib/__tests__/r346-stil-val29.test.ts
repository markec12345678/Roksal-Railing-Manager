// R346 — MANDATORY STIL val 29 (val 25–28 vzorec): a11y parity nalaganja in
// shranjevanja predlog (kalkulator).
// ---------------------------------------------------------------------------
//  • vzorec R291/R293 a11y družina + val 25–28 title/aria parity: gumbi
//    AKCIJ brez razlage dobijo aria-label (nalaganje/shranjevanje — vidno
//    besedilo je kratko in brez konteksta) in/ali title (razlaga akcije);
//  • Naloži predlogo (kartica predloge) → aria-label (parity z zgodovinskim
//    gumbom "Naloži izračun: …", ki jo je imel že od R150 uvedbe);
//  • Izvozi CSV (zgodovina) → aria-label (parity z lastnim title iz val 28
//    in z destruktivnim sosedom "Počisti", ki ima aria+title);
//  • Shrani predlogo (×4 načina: baluster/angled/material/compliance) →
//    aria-label + title (isti akcijski gumb v vseh 4 načinih — enak niz);
//  • 0 novih hex (0-hex kanon val 15–28);
//  • obrnjene regresije: val 28 ×5 nizov ŽIVO, val 27 badge title ŽIVO,
//    val 26 prstni odtis title ŽIVO + cursor-help ×1, R291/R293 vnosni
//    gumb zgodovine aria-label ŽIVO.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const INPUTS = join(process.cwd(), 'src/components/roksal/calculator/inputs.ts')

const tab = readFileSync(TAB, 'utf8')
const inputs = readFileSync(INPUTS, 'utf8')

describe('r346 STIL val 29 — parity nalaganja/shranjevanja predlog', () => {
  it('Naloži predlogo: aria-label razločitev akcije (parity z zgodovinskim gumbom)', () => {
    expect(tab).toContain('aria-label={`Naloži predlogo: ${tpl.naziv} (${templateModeLabels[tpl.mode]})`}')
    // title ostane kot v val 27 era (identifikacija predloga — način)
    const i = tab.indexOf('onClick={() => loadTemplate(tpl)}')
    const okno = tab.slice(i, i + 260)
    expect(okno).toContain('Naloži predlogo:')
    expect(okno).toContain('title={`${tpl.naziv} — ${templateModeLabels[tpl.mode]}`}')
  })

  it('Izvozi CSV: aria-label parity z lastnim title (val 28) — okno okoli exportHistoryCsv', () => {
    expect(tab).toContain('aria-label="Izvozi zgodovino izračunov kot CSV datoteka"')
    const i = tab.indexOf('onClick={exportHistoryCsv}')
    const okno = tab.slice(i, i + 240)
    expect(okno).toContain('aria-label="Izvozi zgodovino izračunov kot CSV datoteka"')
    expect(okno).toContain('title="Izvoz zgodovine izračunov kot CSV datoteka"')
  })

  it('Izvozi CSV: vstop v izvozno družino val 8 = izrecen navy/40 focus ring (STRŽAR kanon R317)', () => {
    // aria-label="Izvozi …" uvrsti gumb v val 8 STRAŽAR scan — window
    // i-8..i+6 MORA nositi izrecen focus-visible:ring-2 žeton (navy/40
    // družina; amber/50 register ostane zaklenjen v vodji ×8).
    const vrstice = tab.split('\n')
    const najdeni: number[] = []
    vrstice.forEach((v, ix) => { if (v.includes('aria-label="Izvozi')) najdeni.push(ix) })
    expect(najdeni.length).toBeGreaterThanOrEqual(1)
    const idx = najdeni.find((ix) => vrstice[ix].includes('Izvozi zgodovino izračunov'))
    if (idx === undefined) throw new Error('needle vrstica "Izvozi zgodovino izračunov" ni najdena')
    const okno = vrstice.slice(Math.max(0, idx - 8), idx + 6).join('\n')
    expect(okno).toContain('focus-visible:ring-2')
    expect(okno).toContain('focus-visible:ring-roksal-navy/40')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('Shrani predlogo: aria-label + title v VSIH 4 načinih (isti akcijski niz)', () => {
    expect((tab.match(/aria-label="Shrani trenutne vnose kot predlogo"/g) ?? []).length).toBe(4)
    expect((tab.match(/title="Shrani trenutne vnose kot predlogo"/g) ?? []).length).toBe(4)
    // vsak onClick={saveTemplate} ima okno z obema lastnicama
    const mesta = tab.split('onClick={saveTemplate}').length - 1
    expect(mesta).toBe(4)
    for (const [i, razbit] of tab.split('onClick={saveTemplate}').slice(1).entries()) {
      const okno = razbit.slice(0, 240)
      expect(okno, `mesto ${i + 1}`).toContain('Shrani trenutne vnose kot predlogo')
    }
  })

  it('0 novih hex: val 29 ne uvaja barv (samo aria/title atributi)', () => {
    const i = tab.indexOf('aria-label="Shrani trenutne vnose kot predlogo"')
    const okno = tab.slice(i, i + 300)
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(inputs).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it('obrnjena regresija val 28: vseh 5 parity nizov ŽIVO (nedotaknjenih)', () => {
    expect(tab).toContain('title="Izvoz zgodovine izračunov kot CSV datoteka"')
    expect(tab).toContain('aria-label="Počisti zgodovino izračunov"')
    expect(tab).toContain('title="Pobriši celotno zgodovino izračunov"')
    expect(tab).toContain('aria-label="Počisti vse predloge"')
    expect(tab).toContain('title="Pobriši vse shranjene predloge"')
  })

  it('obrnjena regresija val 27 + val 26: badge/izbriši/prstni odtis ŽIVO', () => {
    expect(tab).toContain('title="Predloga shranjenega izračuna — nalaganje zapolni vsa vnosna polja načina"')
    expect(tab).toContain('aria-label="Izbriši predlogo"')
    expect(tab).toContain('title="Izbriši predlogo"')
    expect(tab).toContain('title="Prstni odtis izračuna — verzija formule in hash vhodov za reproducibilnost (R150)"')
    expect(tab.match(/cursor-help/g)?.length).toBe(1)
  })

  it('a11y družina R291/R293: vnosni gumb zgodovine aria-label ŽIVO (nedotaknjen)', () => {
    expect(tab).toContain('aria-label={`Naloži izračun: ${entry.modeLabel}, ${entry.keyResult}`}')
  })
})
