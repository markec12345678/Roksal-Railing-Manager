// r384-sorojenci-par.test.ts — R384 FEATURE: PAR-SOROJENCI ČUVAJ (kanon
// R384 handover kandidat 3; LEKCIJA R382 (2): 'ISTI jezik čez kontekste'
// je STAREJŠI, močnejši kanon od družinske triaže — sorojenec dobi FB, če
// brat nosi; precedens val 20/21/22 material CSV sorojenec).
//
// DISK RESNICA: sorojenci = vrstici v ISTI datoteki z BAJTNO enako
// strukturo po normalizaciji barvnih tokenov (roksal-navy/red/amber →
// {BARVA}) in RAZLIČNO barvo. Čuvaj uveljavlja UNIFORMOST
// focus-visible:border-* znotraj takega para: ALI vsi nosijo FB, ALI
// nihče — polovica govora = kršitev (obrantjena regresija na R382 (2)).
//
// Stanje ob nastanku (r384-triaza.py + val 62): ENA večbarvna skupina
// (top-bar meni: 3 navy + 2 red DropdownMenuItem — vsi BREZ FB, ker so
// brez borderja = uniformost ✓); red-red dvojčka dashboard L1914↔L2059
// (val 62 oba parirana ✓). Nič drugega ni bajtni PAR čez barve.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const BARVE = ['roksal-navy', 'roksal-red', 'roksal-amber'] as const
const FB_PAT = /(?<!dark:)focus-visible:border-roksal-[a-z]+\/\d+/

function normalizirajBarvo(vrstica: string): string {
  let out = vrstica
  for (const b of BARVE) out = out.replace(new RegExp(b, 'g'), '{BARVA}')
  return out
}

describe('R384 FEATURE — PAR-sorojenci čuvaj: FB uniformost znotraj barvnih parov', () => {
  it('(A) vsak bajtni PAR različnih barv ima UNIFORMO FB stanje (vsi ali nihče) čez VSE roksal render datoteke', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    const kršitve: string[] = []
    let večbarvnih = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      const skupine = new Map<string, { n: number; barva: string; fb: boolean }[]>()
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        if (!l.includes('focus-visible:ring-2')) continue
        const barve = BARVE.filter((b) => l.includes(b))
        if (barve.length === 0) continue
        const ključ = normalizirajBarvo(l)
        const seznam = skupine.get(ključ) ?? []
        seznam.push({ n: i + 1, barva: barve[0], fb: FB_PAT.test(l) })
        skupine.set(ključ, seznam)
      }
      for (const [ključ, vrstice] of skupine) {
        const barve = new Set(vrstice.map((v) => v.barva))
        if (vrstice.length < 2 || barve.size < 2) continue
        večbarvnih += 1
        const fbStanja = new Set(vrstice.map((v) => v.fb))
        if (fbStanja.size > 1) {
          const podrobnosti = vrstice.map((v) => `L${v.n}(${v.barva},FB=${v.fb ? 'DA' : 'NE'})`).join(' ')
          kršitve.push(`${z}: ${podrobnosti}`)
        }
        void ključ
      }
    }
    expect(večbarvnih, 'pričakovano število večbarvnih bajtnih PAR skupin (top-bar meni)').toBe(1)
    expect(kršitve, 'PAR-sorojenci z neuniformnim FB:\n' + kršitve.join('\n')).toEqual([])
  })

  it('(B) top-bar meni skupina (3 navy + 2 red) — vsi BREZ FB (brez borderja: uniformno brez, val 60 kanon)', () => {
    const TB = readFileSync(join(process.cwd(), 'src/components/roksal/top-bar.tsx'), 'utf-8')
    const NAVY_ITEM = 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const RED_ITEM = 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
    expect(TB.split(NAVY_ITEM).length - 1).toBe(3)
    expect(TB.split(RED_ITEM).length - 1).toBe(2)
    expect(TB.includes(NAVY_ITEM + ' focus-visible:border'), 'navy itemi brez FB').toBe(false)
    expect(TB.includes(RED_ITEM + ' focus-visible:border'), 'red itemi brez FB').toBe(false)
  })

  it('(C) red-red dvojčka dashboard L1914↔L2059 (val 62) — BAJTNO enaka in OBÁ parirana (sorojenec kanon)', () => {
    const lines = readFileSync(join(process.cwd(), 'src/components/roksal/dashboard-tab.tsx'), 'utf-8').split('\n')
    const a = lines[1913]
    const b = lines[2058]
    expect(a, 'dvojčka bajtno enaka').toBe(b)
    expect(a.includes('focus-visible:border-roksal-red/40 dark:focus-visible:border-roksal-red/50'), 'oba parirana').toBe(true)
  })
})
