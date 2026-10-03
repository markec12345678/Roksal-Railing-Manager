// r391-press-disciplina-generalizacija.test.ts — R391 FEATURE: ŠESTI STRAŽAR
// — PRESS-SCALE DISCIPLINA GENERALIZACIJA.
// Komplet varuhov: r385 (dark FB polovica) + r386 (O2 pairing) + r387
// (FB-border istobarvnost) + r388 (transition pokritost) + r389 (kaskadna
// disciplina) + TA (dvojni mehanizem: custom :active transform vs Tailwind
// `scale` LASTNOST — ko-obstoj = MNOŽIČEN skrček 0.97 × 0.9X).
//
// Disk resnica (zgrajen CSS):
//   .press-scale:active { transform: scale(.97) }        → LASTNOST transform
//   .active\:scale-\[0\.96\]:active { scale: .96 }        → LASTNOST scale
// `transform` in `scale` sta NEODVISNI lastnosti — element z obema mehanizma
// se ob pritisku skrči MNOŽIČNO (0.9312 namesto 0.96). PRAVILO stražarja:
// EN element = EN press mehanizem (custom class ALI utility, nikoli oba).
// Globalna kršitev čez VSE src/components/roksal = 0 (element-točno —
// LEKCIJA R388 (1): per-vrstični census je lažno pozitiven).
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROK = join(process.cwd(), 'src', 'components', 'roksal')
const UI = join(process.cwd(), 'src', 'components', 'ui')

const RE_SPAN = /className=(\{`|`|"|')/g

function spanKonec(text: string, po: number, odprt: string): number {
  const zakljuc = odprt === '{`' || odprt === '`' ? '`' : odprt
  let i = po
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue }
    if (text[i] === zakljuc) return i + 1
    i += 1
  }
  return text.length
}

interface Element {
  file: string
  vrstica: number
  kodni: string
}

function beriElemente(): Element[] {
  const out: Element[] = []
  const obdelaj = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const pot = join(dir, f)
      if (statSync(pot).isDirectory()) { obdelaj(pot); continue }
      if (!f.endsWith('.tsx')) continue
      const text = readFileSync(pot, 'utf8')
      for (const m of text.matchAll(RE_SPAN)) {
        const odprt = (m[1] || '') as string
        const e = spanKonec(text, (m.index || 0) + m[0].length, odprt)
        const kodni = text.slice(m.index || 0, e).replace(/\/\*[\s\S]*?\*\//g, '')
        out.push({ file: f, vrstica: text.slice(0, m.index || 0).split('\n').length, kodni })
      }
    }
  }
  obdelaj(ROK)
  return out
}

const ACT = /active:scale-\[?[0-9.]+\]?/

describe('R391 FEATURE ŠESTI STRAŽAR — press-scale disciplina (dvojni mehanizem = 0)', () => {
  it('(A) globalna kršitev = 0: noben element ne nosi press-scale + active:scale sočasno (element-točno čez VSE roksal tsx)', () => {
    const elementi = beriElemente()
    expect(elementi.length).toBeGreaterThan(2000) // disk resnica: sanitični prag
    const kršitve = elementi.filter((e) => e.kodni.includes('press-scale') && ACT.test(e.kodni))
    expect(kršitve, kršitve.map((k) => `${k.file}:${k.vrstica}`).join(', ')).toHaveLength(0)
  })

  it('(B) utility definicija zamrznjena: .press-scale ostane transform-mehanizem (105 non-dual uporabnikov) — globals.css bajtno', () => {
    const globals = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')
    expect(globals).toContain('.press-scale:active {\n    transform: scale(0.97);\n  }')
  })

  it.each([
    ['calculator-tab.tsx', 820],
    ['dashboard-tab.tsx', 2426],
    ['dashboard-tab.tsx', 2435],
    ['inclinometer-tab.tsx', 341],
    ['inventory-tab.tsx', 1562],
    ['measurements-tab.tsx', 3496],
    ['measurements-tab.tsx', 5211],
    ['measurements-tab.tsx', 5234],
    ['measurements-tab.tsx', 5258],
    ['punch-list.tsx', 531],
  ])('(C) %s:%i nosi EN mehanizem — active:scale-[0.96], brez press-scale', (file, vrstica) => {
    const text = readFileSync(join(ROK, file), 'utf8')
    const okno = text.split('\n').slice(vrstica - 1, vrstica + 5).join('\n')
    expect(okno).toContain('active:scale-[0.96]')
    const vrsticaTekst = text.split('\n')[vrstica - 1]
    // press-scale NE SME biti na isti vrstici kot active:scale (vrstični
    // diskriminator; element-točna resnica je (A))
    expect(vrsticaTekst.includes('press-scale') && vrsticaTekst.includes('active:scale-[0.96]')).toBe(false)
  })

  it('(D) zamrznjeni števci sorodnih mehanizmov: press-scale žetoni 123 / active:scale-[0.96] utility ×43 elementov — disk resnica', () => {
    const elementi = beriElemente()
    let ps = 0
    for (const f of readdirSync(ROK)) {
      if (!f.endsWith('.tsx')) continue
      ps += readFileSync(join(ROK, f), 'utf8').split('press-scale').length - 1
    }
    expect(ps).toBe(123)
    const act = elementi.filter((e) => ACT.test(e.kodni))
    expect(act.length).toBe(43)
  })

  it('(E) ui-kit cva bazi zamrznjeni bajtno — shadcn jezik NI mutiran (LEKCIJA R389 kanon)', () => {
    const button = readFileSync(join(UI, 'button.tsx'), 'utf8')
    expect(button).toContain('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50')
    const badge = readFileSync(join(UI, 'badge.tsx'), 'utf8')
    expect(badge).toContain('transition-[color,box-shadow]')
  })
})
