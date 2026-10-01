// R341 — dekompozicija calculator-tab FAZA 3: EN VIR oznake načinov
// (vzorec R322/R325/R338 dekompozicijskih rund + R339 auditActionTitles).
// ---------------------------------------------------------------------------
//  • prej 3× podvojen inline `Record<CalcMode, string>` (getCurrentKeyResult,
//    addToHistory, Save-Calculation onClick) — vsi trije bloki bajtno
//    identični; zdaj EN VIR `modeLabels` v calculator/shared.ts;
//  • čist premik VERBATIM (kanon dekompozicij): pari nespremenjeni;
//  • poravnava z modeTabs oznakami (isti niz 10 parov) — divergenca
//    med tabelo zavihkov in zgodovino nemogoča;
//  • 0 ostankov starega imena modeLabelMap (dedup dokaz);
//  • 100 % determinizem: mapa je statična resnica repozitorija.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { modeLabels, modeTabs } from '@/components/roksal/calculator/shared'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const SHARED = join(process.cwd(), 'src/components/roksal/calculator/shared.ts')

const tab = readFileSync(TAB, 'utf8')
const shared = readFileSync(SHARED, 'utf8')

describe('r341 calc FAZA 3 — EN VIR modeLabels: dedup + čist premik', () => {
  it('shared.ts definira modeLabels NATANKO enkrat (EN VIR)', () => {
    expect(shared.match(/export const modeLabels/g)?.length).toBe(1)
  })

  it('calculator-tab: 0 inline definicij Record<CalcMode, string> (dedup)', () => {
    expect(tab).not.toContain('modeLabelMap')
    expect(tab).not.toContain('Record<CalcMode, string> = {')
  })

  it('calculator-tab: uvoz modeLabels iz shared (EN VIR potrošnja)', () => {
    expect(tab).toContain('  modeLabels,')
    // R347 FAZA 7: fallback `return modeLabels[mode]` je selil v history.ts
    // modul (getCurrentKeyResult) — v tabu ostanejo 2 potrošnika (entry.modeLabel
    // + saved.modeLabel); modulni fallback = 1 potrošnik (EN VIR ohranjen).
    expect(tab.match(/modeLabels\[/g)?.length).toBe(2)
    const hist = readFileSync(join(process.cwd(), 'src/components/roksal/calculator/history.ts'), 'utf8')
    expect(hist.match(/modeLabels\[/g)?.length).toBe(1)
  })

  it('izčerpnost: 10 ključev = CalcMode bijekcija (modeTabs ids)', () => {
    expect(Object.keys(modeLabels).sort()).toEqual([...modeTabs.map((m) => m.id)].sort())
    expect(Object.keys(modeLabels)).toHaveLength(10)
  })

  it('dogovor z modeTabs: oznake IDENTIČNE (tabela zavihkov ≡ zgodovina ≡ shrani)', () => {
    for (const m of modeTabs) {
      expect(modeLabels[m.id]).toBe(m.label)
    }
  })

  it('determinizem: statična resnica — natančni pari (snapshod)', () => {
    expect(modeLabels).toEqual({
      railing: 'Razmiki letev',
      anchoring: 'Kemično sidranje',
      wind: 'Vetrna obremenitev',
      baluster: 'Razmak palic',
      angled: 'Kotni izračun',
      material: 'Skupni material',
      compliance: 'Predpisi',
      cnc: 'CNC rez',
      windLocation: 'Veter po lokaciji',
      glass: 'Steklena balustrada',
    })
  })

  it('čist premik VERBATIM: vseh 10 parov živi v shared.ts (vir resnice)', () => {
    const pari = [
      "railing: 'Razmiki letev'",
      "anchoring: 'Kemično sidranje'",
      "wind: 'Vetrna obremenitev'",
      "baluster: 'Razmak palic'",
      "angled: 'Kotni izračun'",
      "material: 'Skupni material'",
      "compliance: 'Predpisi'",
      "cnc: 'CNC rez'",
      "windLocation: 'Veter po lokaciji'",
      "glass: 'Steklena balustrada'",
    ]
    for (const p of pari) {
      expect(shared).toContain(p)
    }
  })

  it('potrošniki so na pričakovanih mestih (R347 FAZA 7: fallback selil v history.ts)', () => {
    // R347 FAZA 7: `return modeLabels[mode]` (fallback) je sedaj v modulu
    // getCurrentKeyResult (calculator/history.ts) — EN VIR ohranjen, samo
    // lokacija selila; v tabu ostane saved.modeLabel potrošnik.
    const hist = readFileSync(join(process.cwd(), 'src/components/roksal/calculator/history.ts'), 'utf8')
    expect(hist).toContain('return modeLabels[mode]')
    expect(tab).toContain('modeLabel: modeLabels[mode],')
    // R341 kanon ohranjen: modul uvozi modeLabels iz shared (EN VIR potrošnja)
    expect(hist).toContain("from './shared'")
  })

  it('registrska usklajenost: r339 postavitev nedotaknjena (measurements/labels.ts ostaja njihova resnica)', () => {
    const mLabels = readFileSync(
      join(process.cwd(), 'src/components/roksal/measurements/labels.ts'),
      'utf8',
    )
    expect(mLabels).toContain('export const auditActionTitles')
    expect(mLabels).toContain("ADD: 'Revizija: Dodano — nova meritev vnesena v ta projekt")
  })
})
