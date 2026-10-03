// r394-stil-val70.test.ts — R394 MANDATORY STIL val 70: FORCED-COLORS FOKUS
// PARITETA (105 × REPL in-place, 0 novih vrstic — roksal render plast ×24
// datotek).
//
// Disk resnica (r394-triaza.py element-točna + kompilirani CSS dokaz
// .next/static/chunks/71255bde5e5a73d6.css):
//   .focus-visible\:outline-none:focus-visible { outline-style:none }
//   .focus-visible\:outline-hidden:focus-visible { outline-style:none }
//   @media (forced-colors:active) { …outline-hidden:focus-visible {
//     outline-offset:2px; outline:2px solid #0000 } }
// → normal-mode CSS IDENTIČNA (oba outline-style:none — NI vizualne
// spremembe); razlika ŠELE v forced-colors mode: ring/box-shadow NE preživi
// forced-colors (rings so box-shadow — brskalnik jih zavre), outline-hidden
// obnovi 2px outline = WCAG 2.4.7 fokus indikator v forced-colors. Družinski
// precedens: viz plast ×3 (viz-tab L125 + step-corners L402 + before-after
// L172) ŽE uporablja outline-hidden + ring-roksal-amber kanon.
// Iskrene meje: (1) ui-kit cva baze — shadcn upstream jezik FROZEN (canon
// R391: "shadcn jezik NI mutiran"); (2) goli outline-none na vnosnih poljih
// (focus: paradigma ×24: roksal 14 + app 10) — outline-hidden brez
// focus-visible: bi v forced-colors risal STALNI outline tudi brez fokusa →
// iskren zaklep; (3) ui/tabs.tsx Radix TabsContent — upstream.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ŽETON = 'focus-visible:outline-none'
const NOVO = 'focus-visible:outline-hidden'

function readDirRecursive(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const pot = join(dir, e.name)
    if (e.isDirectory()) out.push(...readDirRecursive(pot))
    else out.push(pot)
  }
  return out
}

function roksalTsxs(): string[] {
  return readDirRecursive(join(process.cwd(), 'src', 'components', 'roksal')).filter((f) => f.endsWith('.tsx'))
}

describe('R392→R394 STIL val 70 — forced-colors fokus pariteta (outline-hidden)', () => {
  it('(A) PARITETA: 106 × fv_hidden v roksal renderu (24 datotek; žeton-exact; per-file top 3: measurements 33, inventory 14, invoice 13; [PIN SHIFT R402 §19: +1 gumb Poslan — fv_hidden + ISTA družinska nadomestna indikatorja ring-2+O2])', () => {
    let vseh = 0
    const per: Record<string, number> = {}
    for (const f of roksalTsxs()) {
      const n = readFileSync(f, 'utf8').split(NOVO).length - 1
      if (n) {
        vseh += n
        per[f.replace(/\\/g, '/').replace(/^\//, '')] = n
      }
    }
    expect(vseh).toBe(106)
    expect(Object.keys(per).length).toBe(24)
    const kljuc = (x: string) => Object.keys(per).find((k) => k.endsWith(x))!
    expect(per[kljuc('measurements-tab.tsx')]).toBe(33)
    expect(per[kljuc('inventory-tab.tsx')]).toBe(14)
    expect(per[kljuc('invoice-manager.tsx')]).toBe(13) // [PIN SHIFT R402 §19: +1 Poslan]
  })

  it('(B) CENZUS: 0 × fv_none v roksal renderu + žeton NI nikoli zraven .toBe(0) preživel kot delno stanje', () => {
    for (const f of roksalTsxs()) {
      const t = readFileSync(f, 'utf8')
      expect(t.includes(ŽETON)).toBe(false)
    }
    // goli outline-none (vnosna polja, focus: paradigma) NESPREMENJENI ×14
    let goli = 0
    for (const f of roksalTsxs()) {
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
        const toks = new Set(t.slice(m.index! + m[0].length, konec - 1).split(/\s+/))
        if (toks.has('outline-none') && !toks.has(NOVO)) goli += 1
      }
    }
    expect(goli).toBe(14)
  })

  it('(C) vsak fv_hidden element OHRANI nadomestni indikator: fv_hidden vedno v spanu s ring/border (swap NE odstrani nič — triaža D=0)', () => {
    const brez = [] as string[]
    let zZetonom = 0
    for (const f of roksalTsxs()) {
      const t = readFileSync(f, 'utf8')
      zZetonom += t.split(NOVO).length - 1
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
        const span = t.slice(m.index! + m[0].length, konec - 1)
        if (!span.includes(NOVO)) continue
        const indikator = /focus-visible:ring-\d/.test(span) || /focus:ring-\d/.test(span) ||
          /focus-within:ring-\d/.test(span) || span.includes('focus-visible:border') ||
          span.includes('focus:border')
        if (!indikator) brez.push(`${f}:${m.index}`)
      }
    }
    expect(zZetonom).toBe(106)
    expect(brez).toEqual([])
  })

  it('(D) družinski precedens zamrznjen bajtno: viz ×3 outline-hidden kanon + ui-kit shadcn jezik NI mutiran', () => {
    const viz = readFileSync(join(process.cwd(), 'src', 'components', 'viz', 'viz-tab.tsx'), 'utf8')
    expect(viz).toContain('rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2')
    const corners = readFileSync(join(process.cwd(), 'src', 'components', 'viz', 'step-corners.tsx'), 'utf8')
    expect(corners).toContain('outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2')
    const ba = readFileSync(join(process.cwd(), 'src', 'components', 'viz', 'before-after.tsx'), 'utf8')
    expect(ba).toContain('shadow-lg outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2')
    // ui-kit cva baze — shadcn upstream jezik (goli outline-none ostaja)
    const btn = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'button.tsx'), 'utf8')
    expect(btn).toContain('shrink-0 outline-none focus-visible:border-ring')
    const tabs = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'tabs.tsx'), 'utf8')
    expect(tabs).toContain('"flex-1 outline-none"')
  })

  it('(E) register NASLEDNICA-2 disk resnica: r363 naslednica ŽIVO ×1 (žeton outline-hidden) + komentirana zgodovina + need_static 4 nespremenjeni', () => {
    const r363 = readFileSync(join(process.cwd(), 'scripts', 'qa-needles', 'r363.tsv'), 'utf8')
    const naslednica = r363.split('\n').filter((l) => l && !l.startsWith('#') && l.includes(NOVO))
    expect(naslednica.length).toBeGreaterThanOrEqual(1)
    expect(naslednica[0]).toContain('R394 val 70 NASLEDNICA')
    const zgodovina = r363.split('\n').filter((l) => l.startsWith('#') && l.includes(ŽETON) && l.includes('EVOLVED R394 val 70'))
    expect(zgodovina.length).toBe(3)
    const needStatic = r363.split('\n').filter((l) => l && !l.startsWith('#') && l.endsWith('\tneed_static'))
    expect(needStatic.length).toBe(4)
  })
})
