// r392-senca-transform-disciplina.test.ts — R392 FEATURE: SEDMI STRAŽAR —
// HOVER-TRANSFORM + SENČNA POKRITOST DISCIPLINA GENERALIZACIJA.
// Komplet varuhov: r385 (dark FB polovica) + r386 (O2 pairing) + r387
// (FB-border istobarvnost) + r388 (hover-BARVNA pokritost) + r389 (kaskadna
// disciplina) + r391 (press-scale disciplina) + TA (hover TRANSFORM/SENČNA
// pokritost: vsak element z hover:shadow-*/hover:translate*/hover:scale*
// nosi pokrito transition utility — sicer SNAP ob hover).
//
// Disk resnica (r392 triaža čez CEL src):
//   - 16 elementov s hover:translate/scale — VSE pokrite (transition-all/
//     transform/arbitrary) → družina zaprta;
//   - 42 elementov s hover:shadow-* — 40 pokritih + 2 SNAP (material-
//     intelligence L1690/L1980) → val 69 REŠIL oba; nadalje 0 snap;
//   - kaskadna logika (LEKCIJA R389 (3)): element lastne transition utilityje
//     + ui-kit BAZA za Button/Badge/Card — zmagovalec pokriva efekt; Card baza
//     NIMA transition utilityja → element mora sam nositi pokritost.
// PRAVILO stražarja: hover efekt (senca/transform) BREZ pokrite lastnosti v
// zmagovalnem transition utilityju = kršitev (SNAP).
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
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

// pokritost: zmagovalni transition utility elementa pokriva lastnost
function pokritost(span: string, lastnost: 'box-shadow' | 'transform'): boolean {
  const trans = new Set(span.match(/transition-(?:all|shadow|colors|transform|opacity|none|\[[^\]]*\])/g) ?? [])
  // kaskadni zmagovalec: element nima lastnih → ui-kit baza (Card: NIČ;
  // Button/Badge: transition-all / transition-[color,box-shadow] — nista
  // relevantna za senčne/transform hovers na nativnih elementih, ki jih
  // najdemo tu; baza preverjena v (E))
  if (trans.size === 0) return false
  if (trans.has('transition-all')) return true
  if (lastnost === 'box-shadow') {
    return trans.has('transition-shadow') || [...trans].some((x) => x.startsWith('transition-[') && x.includes('box-shadow'))
  }
  return trans.has('transition-transform') || [...trans].some((x) => x.startsWith('transition-[') && (x.includes('transform') || x.includes('translate') || x.includes('scale')))
}

describe('R392 FEATURE SEDMI STRAŽAR — hover-transform + senčna pokritost disciplina', () => {
  it('(A) globalna kršitev = 0: vsak hover:shadow-* element nosi box-shadow pokritost (element-točno čez VSE src)', () => {
    const kr = beriElemente().filter((e) => /(?:group-)?hover:shadow-[a-z0-9-]+/.test(e.span) && !pokritost(e.span, 'box-shadow'))
    expect(kr, kr.map((k) => `${k.file}:${k.vrstica}`).join(', ')).toHaveLength(0)
  })

  it('(B) globalna kršitev = 0: vsak hover:translate/scale element nosi transform pokritost', () => {
    const kr = beriElemente().filter((e) => /(?:group-)?hover:(?:-)?(?:translate|scale)[a-z0-9:\[\].-]+/.test(e.span) && !pokritost(e.span, 'transform'))
    expect(kr, kr.map((k) => `${k.file}:${k.vrstica}`).join(', ')).toHaveLength(0)
  })

  it.each([[1690], [1980]])('(C) material-intelligence.tsx:%i — val 69 tarča nosi nadgrajeni seznam (box-shadow pokrit)', (vrstica) => {
    const el = beriElemente().find((e) => e.file.endsWith('material-intelligence-tab.tsx') && e.vrstica === vrstica)
    expect(el, `span na L${vrstica}`).toBeDefined()
    expect(el!.span).toContain('transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow]')
    expect(pokritost(el!.span, 'box-shadow')).toBe(true)
  })

  it('(D) zamrznjeni števci: hover:shadow elementov 45 / hover:transform elementov 16 — disk resnica (roksal+ui+app+viz)', () => {
    const el = beriElemente()
    expect(el.filter((e) => /(?:group-)?hover:shadow-[a-z0-9-]+/.test(e.span)).length).toBe(45)
    expect(el.filter((e) => /(?:group-)?hover:(?:-)?(?:translate|scale)[a-z0-9:\[\].-]+/.test(e.span)).length).toBe(16)
  })

  it('(E) ui-kit baze zamrznjene bajtno: Card NIČ transition (element sam nosi) + Button transition-all + Badge barvni seznam', () => {
    const card = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'card.tsx'), 'utf8')
    expect(card).toContain('"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm"')
    expect(card).not.toContain('transition')
    const button = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'button.tsx'), 'utf8')
    expect(button).toContain('transition-all disabled:pointer-events-none disabled:opacity-50')
    const badge = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'badge.tsx'), 'utf8')
    expect(badge).toContain('transition-[color,box-shadow]')
  })
})
