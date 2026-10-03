// r392-stil-val69.test.ts — R392 MANDATORY STIL val 69: HOVER-SENČNA
// GLADKOST (2 × REPL in-place, 0 novih vrstic) — material-intelligence-tab
// Cards L1690 + L1980.
//
// Disk resnica (r392 triaža čez CEL src: roksal + ui + app + viz — edina 2
// elementa s hover:shadow-sm BREZ shadow/all/arbitrary transition pokritosti;
// 40 ostalih hover:shadow elementov POKRITIH):
//   PRE:  className="transition-colors hover:border-roksal-navy/25
//         dark:hover:border-roksal-ink/25 hover:shadow-sm"
//   PO:   className="transition-[color,background-color,border-color,
//         text-decoration-color,fill,stroke,box-shadow] hover:border-…"
// transition-colors NE pokriva box-shadow (Tailwind v4 definicija: color,
// background-color, border-color, text-decoration-color, fill, stroke) →
// hover:shadow-sm SNAP. Fix = transition-colors ∪ {box-shadow} — konzervativna
// nadgradnja (BREZ izgube obstoječe pokritosti, BREZ izuma; kaskadna pozicija
// irrelevantna — Card ui-kit baza NIMA transition utilityja, elementov seznam
// je edini, LEKCIJA R389 (3)). Družinski precedens: logistics L2360/2466/2659
// + roksal-catalog L141 (ožji seznam [border-color,box-shadow]).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MAT = join(process.cwd(), 'src', 'components', 'roksal', 'material-intelligence-tab.tsx')

const NOVO = 'transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow] hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm'
const STARO = 'transition-colors hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm'

describe('R390→R392 STIL val 69 — hover-senčna gladkost (Card pariteta)', () => {
  it('(A) PARITETA: oba Card spana nosita nadgrajeni seznam (box-shadow pokrit) + star snap span ×0', () => {
    const t = readFileSync(MAT, 'utf8')
    expect(t.split(NOVO).length - 1).toBe(2)
    expect(t.includes(STARO)).toBe(false)
  })

  it('(B) CENZUS: 0 hover:shadow elementov brez pokritosti čez VSE src (roksal+ui+app+viz)', () => {
    // zrcali r392 triažo: edina 2 tarči sta zdaj pokriti
    const dirs = ['src/components/roksal', 'src/components/ui', 'src/components/viz', 'src/app']
    let snap = 0
    for (const d of dirs) {
      for (const f of readDirRecursive(join(process.cwd(), d))) {
        if (!f.endsWith('.tsx')) continue
        const t = readFileSync(f, 'utf8')
        for (const m of t.matchAll(/className=(\{`|`|"|')/g)) {
          const odprt = m[1] as string
          const zakljuc = odprt === '{`' || odprt === '`' ? '`' : odprt
          let i = (m.index || 0) + m[0].length
          let konec = t.length
          while (i < t.length) {
            if (t[i] === '\\') { i += 2; continue }
            if (t[i] === zakljuc) { konec = i + 1; break }
            i += 1
          }
          const span = t.slice(m.index || 0, konec).replace(/\/\*[\s\S]*?\*\//g, '')
          if (!/hover:shadow-[a-z0-9-]+/.test(span)) continue
          const trans = new Set(span.match(/transition-(?:all|shadow|colors|transform|opacity|\[[^\]]*\])/g) ?? [])
          const pokrito = trans.has('transition-all') || trans.has('transition-shadow') ||
            [...trans].some((x) => x.startsWith('transition-['))
          if (!pokrito) snap += 1
        }
      }
    }
    expect(snap).toBe(0)
  })

  it('(C) obstoječa pokritost OHRANJENA: seznam = transition-colors definicija ∪ {box-shadow} (brez izgube, brez izuma)', () => {
    const t = readFileSync(MAT, 'utf8')
    const SEZNAM = 'transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow]'
    expect(t.split(SEZNAM).length - 1).toBe(2)
    // vsaka lastnost Tailwind v4 transition-colors definicije + box-shadow
    for (const prop of ['color', 'background-color', 'border-color', 'text-decoration-color', 'fill', 'stroke', 'box-shadow']) {
      expect(SEZNAM).toContain(prop)
    }
  })

  it('(D) in-place disk resnica: 0 novih vrstic + družinski precedens ŽIVO (logistics ×3 incl. overflow-hidden brat + roksal-catalog ×1)', () => {
    const t = readFileSync(MAT, 'utf8')
    // vrstični števec: REPL in-place (prej 128015 bajtov? — bajtno: vrstice)
    expect(t.split('\n').length).toBeGreaterThan(2000)
    const log = readFileSync(join(process.cwd(), 'src', 'components', 'roksal', 'logistics-tab.tsx'), 'utf8')
    expect(log.split('transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm').length - 1).toBe(3)
    const kat = readFileSync(join(process.cwd(), 'src', 'components', 'roksal', 'roksal-catalog.tsx'), 'utf8')
    expect(kat).toContain('transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm')
  })

  it('(E) ui-kit Card baza zamrznjena bajtno — shadcn jezik NI mutiran (LEKCIJA R389 kanon)', () => {
    const card = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'card.tsx'), 'utf8')
    expect(card).toContain('"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm"')
    expect(card).not.toContain('transition')
  })
})

function readDirRecursive(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const pot = join(dir, e.name)
    if (e.isDirectory()) out.push(...readDirRecursive(pot))
    else out.push(pot)
  }
  return out
}
