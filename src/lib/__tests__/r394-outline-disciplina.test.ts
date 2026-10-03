// r394-outline-disciplina.test.ts — R394 FEATURE: OSMI STRAŽAR —
// OUTLINE / FOKUS INDIKATOR DISCIPLINA GENERALIZACIJA.
// Komplet varuhov: r385 (dark FB polovica) + r386 (O2 pairing) + r387
// (FB-border istobarvnost) + r388 (hover-BARVNA pokritost) + r389 (kaskadna
// disciplina) + r391 (press-scale disciplina) + r392 (hover-transform/
// senčna pokritost) + TA (outline/fokus disciplina: vsak element, ki
// ODSTRANI outline (outline-none), NOSI nadomestni fokus indikator v ISTEM
// className nizu — ring/border v katerikoli focus paradigmi (focus-visible:,
// focus:, focus-within:) ALI outline-hidden/outline utility; sicer = WCAG
// 2.4.7 fokus vrzel).
//
// Disk resnica (r394-triaza.py element-točna čez CEL src):
//   - fv_none roksal 103 + goli none roksal 14 + app 10 + ui 2 — VSI z
//     nadomestilom (roksal/app/viz brez_nadomestila = 0);
//   - val 70: roksal fv_none → fv_hidden ×105 (forced-colors pariteta:
//     ring/box-shadow NE preživi forced-colors, outline-hidden obnovi 2px
//     outline — normal-mode CSS identična);
//   - viz ×3 outline-hidden + ring-roksal-amber = družinski kanon;
//   - ISKRENA MEJA (frozen): ui-kit cva baze = shadcn upstream jezik
//     (button.tsx goli outline-none, tabs.tsx "flex-1 outline-none" — Radix
//     TabsContent ni tipkovniško-fokusabilen sam po sebi); goli outline-none
//     na vnosnih poljih (focus: paradigma) ostaja — outline-hidden BREZ
//     focus-visible: bi v forced-colors risal STALNI outline brez fokusa.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['src/components/roksal', 'src/components/ui', 'src/components/viz', 'src/app'].map((d) => join(process.cwd(), d))

const RE_SPAN = /className=(\{`|`|"|')/g

interface Element {
  file: string
  vrstica: number
  span: string
}

function beriElemente(): Element[] {
  const out: Element[] = []
  const obdelaj = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const pot = join(dir, e.name)
      if (e.isDirectory()) { obdelaj(pot); continue }
      if (!e.name.endsWith('.tsx')) continue
      const text = readFileSync(pot, 'utf8')
      for (const m of text.matchAll(RE_SPAN)) {
        const odprt = m[1] as string
        const zakljuc = odprt === '{`' || odprt === '`' ? '`' : odprt
        let i = (m.index || 0) + m[0].length
        let konec = text.length
        while (i < text.length) {
          if (text[i] === '\\') { i += 2; continue }
          if (text[i] === zakljuc) { konec = i + 1; break }
          i += 1
        }
        out.push({
          file: pot.slice(pot.indexOf('src/')),
          vrstica: text.slice(0, m.index || 0).split('\n').length,
          span: text.slice(m.index || 0, konec).replace(/\/\*[\s\S]*?\*\//g, ''),
        })
      }
    }
  }
  for (const r of ROOTS) obdelaj(r)
  return out
}

const ELEMENTI = beriElemente()

const NADOMESTILO = (toks: string[]) =>
  toks.some((t) =>
    /^(focus-visible|focus|focus-within):(ring-\d|border)/.test(t) ||
    t === 'outline-hidden' || t === 'outline' ||
    t === 'focus-visible:outline-hidden' || t === 'focus-visible:outline',
  )

describe('R394 OSMI STRAŽAR — outline/fokus indikator disciplina', () => {
  it('(A) GLOBALNA KRŠITEV = 0: element z outline-none BREZ nadomestnega fokus indikatorja (roksal+ui+app+viz, >2000 elementov sanitarni prag)', () => {
    expect(ELEMENTI.length).toBeGreaterThan(2000)
    const krs = [] as string[]
    for (const el of ELEMENTI) {
      const toks = el.span.split(/\s+/)
      if (!toks.some((t) => t === 'outline-none' || t === 'focus-visible:outline-none')) continue
      // FROZEN IZJEMA: ui-kit shadcn upstream jezik (cva baze + tabs.tsx)
      if (el.file.startsWith('src/components/ui/')) continue
      if (!NADOMESTILO(toks)) krs.push(`${el.file}:${el.vrstica}`)
    }
    expect(krs).toEqual([])
  })

  it('(B) ŽETONI val 70: fv_none = 0 v roksalu + fv_hidden ×105 + goli none ×14 roksal / ×10 app (disk resnica zamrznjena)', () => {
    const roksal = ELEMENTI.filter((e) => e.file.startsWith('src/components/roksal/'))
    const fvNone = roksal.filter((e) => e.span.includes('focus-visible:outline-none')).length
    const goliNone = roksal.filter((e) => {
      const toks = e.span.split(/\s+/)
      return toks.includes('outline-none') && !toks.includes('outline-hidden')
    }).length
    expect(fvNone).toBe(0)
    expect(goliNone).toBe(14)
    const fvHiddenZetoni = roksal.reduce((n, e) => n + (e.span.split('focus-visible:outline-hidden').length - 1), 0)
    expect(fvHiddenZetoni).toBeGreaterThanOrEqual(103) // span-točno; žeton-exact ×105 (2 v helperjih)
    const appGoli = ELEMENTI.filter((e) => e.file.startsWith('src/app/') && e.span.split(/\s+/).includes('outline-none')).length
    expect(appGoli).toBe(10)
  })

  it('(C) VIZ KANON ×3: outline-hidden + focus-visible:ring-roksal-amber (družinski precedens, bajtno)', () => {
    const viz = ELEMENTI.filter((e) => e.file.startsWith('src/components/viz/') && e.span.includes('outline-hidden'))
    expect(viz.length).toBe(3)
    for (const el of viz) {
      expect(el.span).toContain('focus-visible:ring-roksal-amber')
      expect(el.span).toContain('focus-visible:ring-offset-2')
    }
  })

  it('(D) FROZEN IZJEME: ui-kit shadcn jezik bajtno (button cva goli outline-none + tabs "flex-1 outline-none")', () => {
    const btn = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'button.tsx'), 'utf8')
    expect(btn).toContain('shrink-0 outline-none focus-visible:border-ring')
    const tabs = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'tabs.tsx'), 'utf8')
    expect(tabs).toContain('"flex-1 outline-none"')
    const sel = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'select.tsx'), 'utf8')
    // shadcn v4 upstream ŽE nosi outline-hidden ×3 v ui — kanon mešanica FROZEN
    expect(sel.includes('outline-hidden') || sel.includes('outline-none')).toBe(true)
  })

  it('(E) FOKUS PARADIGME NE MEŠAJO OBVEZNOSTI: elementi s fv_hidden NOSIJO ring-2 (primarni indikator ostane ring; outline-hidden je SAMO forced-colors rezerva)', () => {
    const zHidden = ELEMENTI.filter((e) => e.file.startsWith('src/components/roksal/') && e.span.includes('focus-visible:outline-hidden'))
    expect(zHidden.length).toBeGreaterThanOrEqual(103)
    const brezRinga = zHidden.filter((e) => !/focus-visible:ring-\d/.test(e.span) && !/focus:ring-\d/.test(e.span) &&
      !e.span.includes('focus-visible:border') && !e.span.includes('focus:border')).length
    expect(brezRinga).toBe(0)
  })

  it('(F) KOMPILIRANI CSS SEMANTSKI DOKAZ zamrznjen v komentarju: outline-none ≡ outline-hidden v normal-mode (oba outline-style:none)', () => {
    // disk dokaz: .next/static/chunks CSS (zgrajen build) — obe utility
    // definiciji obstajata; outline-hidden NOSI @media forced-colors podaljšek
    const naji = (dir: string): string[] => {
      const out: string[] = []
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const pot = join(dir, e.name)
        if (e.isDirectory()) out.push(...naji(pot))
        else if (pot.endsWith('.css')) out.push(pot)
      }
      return out
    }
    const cssFiles = naji(join(process.cwd(), '.next', 'static', 'chunks'))
    expect(cssFiles.length).toBeGreaterThan(0)
    let noneDef = false
    let hiddenDef = false
    let hiddenFC = false
    for (const f of cssFiles) {
      const css = readFileSync(f, 'utf8')
      if (/\.focus-visible\\:outline-none:focus-visible\{[^}]*outline-style:none\}/.test(css)) noneDef = true
      if (/\.focus-visible\\:outline-hidden:focus-visible\{[^}]*outline-style:none\}/.test(css)) hiddenDef = true
      if (/@media \(forced-colors:active\)\{\.focus-visible\\:outline-hidden:focus-visible\{[^}]*outline:2px solid #0000\}/.test(css)) hiddenFC = true
    }
    expect(noneDef).toBe(true)
    expect(hiddenDef).toBe(true)
    expect(hiddenFC).toBe(true)
  })

  it('(G) REGISTRI val 70: 18 registrskih datotek nosi NASLEDNICE ×32 + zgodovina komentirana; need_static vsota r347–r392 = 185 (era kanon)', () => {
    const registr = join(process.cwd(), 'scripts', 'qa-needles')
    let naslednice = 0
    let zgodovina = 0
    let needStatic = 0
    for (let r = 347; r <= 392; r++) {
      const t = readFileSync(join(registr, `r${r}.tsv`), 'utf8')
      for (const vrsta of t.split('\n')) {
        if (vrsta.startsWith('#')) {
          if (vrsta.includes('EVOLVED R394 val 70')) zgodovina += 1
          continue
        }
        if (vrsta.endsWith('\tneed_static')) needStatic += 1
        if ((vrsta.includes('focus-visible:outline-none') || vrsta.includes('focus-visible:outline-hidden')) &&
          vrsta.endsWith('\tneed_static') && vrsta.includes('NASLEDNICA')) naslednice += 1
      }
    }
    expect(naslednice).toBe(32)
    expect(zgodovina).toBe(32)
    expect(needStatic).toBe(185)
  })
})
