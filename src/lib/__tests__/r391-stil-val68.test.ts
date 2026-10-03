// r391-stil-val68.test.ts — R391 MANDATORY STIL val 68: PRESS-SCALE DVOJNI
// MEHANIZEM RESOLUCIJA (10 × REPL in-place, 0 novih vrstic).
//
// Disk resnica (r391-triaza.py element-točna, LEKCIJA R388 (1) kanon —
// per-vrstični census je lažno pozitiven, triaža PARSA className spine):
//   - globals.css `.press-scale:active { transform: scale(0.97) }` — LASTNOST
//     `transform`;
//   - Tailwind v4 `.active\:scale-\[0\.96\]:active { scale: .96 }` — LASTNOST
//     `scale` (neodvisna od transform!);
//   - element z OBEIMA mehanizma: :active → 0.97 × 0.96 = 0.9312 MNOŽIČEN
//     dvojni skrček (realen vizualen bug, brez precedensa v valsih 1–67).
//   Val 68: `press-scale` žeton odstranjen z VSEH 10 dual elementov — ostane
//   element-specifičen active:scale-[0.96]; ui-kit Button cva baza nosi
//   transition-all → pretok `scale` lastnosti ohranjen na VSEH 10 (iskrena
//   meja: kaskadni vrstni red transform-vs-scale utilityjev je Tailwind
//   kanon, absolutne pozicije v CSS se spreminjajo per build —glej r389 (3)).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROK = join(process.cwd(), 'src', 'components', 'roksal')
const TS = join(process.cwd(), 'src', 'lib', '__tests__')

// element-točni parser (isti kontrakt kot r391-triaza.py / r391-pinscan.py)
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

interface Dual {
  file: string
  vrstica: number
  span: string
}

function beriSpine(file: string): Dual[] {
  const text = readFileSync(join(ROK, file), 'utf8')
  const out: Dual[] = []
  for (const m of text.matchAll(RE_SPAN)) {
    const odprt = (m[1] || '') as string
    const e = spanKonec(text, (m.index || 0) + m[0].length, odprt)
    const span = text.slice(m.index || 0, e)
    out.push({
      file,
      vrstica: text.slice(0, m.index || 0).split('\n').length,
      span,
    })
  }
  return out
}

function beriVseSpine(): Dual[] {
  const out: Dual[] = []
  for (const f of ['calculator-tab.tsx', 'dashboard-tab.tsx', 'inclinometer-tab.tsx',
    'inventory-tab.tsx', 'measurements-tab.tsx', 'punch-list.tsx']) {
    out.push(...beriSpine(f))
  }
  return out
}

// val 68 tarče (disk resnica r391-triaza.py; vrstica = className začetek)
const TARCE: Array<[string, number]> = [
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
]

describe('R391 STIL val 68 — press-scale dvojni mehanizem resolucija', () => {
  it('(A) PARITETA: vseh 10 tarč nosi active:scale-[0.96] in NE več press-scale (element-točno, bajtno)', () => {
    for (const [file, vrstica] of TARCE) {
      const span = beriSpine(file).find((s) => s.vrstica === vrstica)
      expect(span, `${file}:${vrstica} span obstaja`).toBeDefined()
      const kodni = span!.span.replace(/\/\*[\s\S]*?\*\//g, '')
      expect(kodni).not.toContain('press-scale')
      expect(kodni).toContain('active:scale-[0.96]')
      // 0 novih vrstic — REPL in-place (span ostaja na isti vrstici)
      expect(span!.vrstica).toBe(vrstica)
    }
  })

  it('(B) CENZUS (disk resnica v tarčnih datotekah): dual = 0; žetonov press-scale = 28 (prej 38)', () => {
    const vsi = beriVseSpine()
    const dual = vsi.filter((s) => s.span.includes('press-scale') && /active:scale-\[?0\.96\]?/.test(s.span))
    expect(dual).toHaveLength(0)
    // žetonov press-scale v 6 target datotekah: zamrznjen po-vrednost
    // (prej 38 → po 28: −10 dualov; disk resnica r391-val68-apply.py;
    // calculator = 0 — njegov edini press-scale JE bil dual)
    let zetoni = 0
    for (const f of ['calculator-tab.tsx', 'dashboard-tab.tsx', 'inclinometer-tab.tsx',
      'inventory-tab.tsx', 'measurements-tab.tsx', 'punch-list.tsx']) {
      zetoni += readFileSync(join(ROK, f), 'utf8').split('press-scale').length - 1
    }
    expect(zetoni).toBe(28)
  })

  it('(C) EVOLVED žigi: 5 testnih datotek bajtno (r204/r269/r271/r272/r363)', () => {
    const pri = (f: string) => readFileSync(join(TS, f), 'utf8')
    expect(pri('r204-narocilnica-strazar.test.ts')).toContain('[EVOLVED R391 val 68')
    expect(pri('r204-narocilnica-strazar.test.ts')).not.toContain("tabular-nums press-scale'")
    expect(pri('r363-stil-val46.test.ts')).toContain('[EVOLVED R391 val 68')
    expect(pri('r269-meritve-teren-pdf.test.ts')).toContain("'active:scale-[0.96] hover:text-roksal-ink'")
    expect(pri('r271-punch-stanje-pdf.test.ts')).toContain("expect(pill).toContain('active:scale-[0.96]')")
    expect(pri('r272-nagibi-teren-pdf.test.ts')).toContain("expect(pill).toContain('active:scale-[0.96]')")
  })

  it('(D) register r363.tsv: NASLEDNICA-3 ŽIVO ×1 v post-fix viru; stara vrstica komentirana (zgodovina dobesedno)', () => {
    const reg = readFileSync(join(process.cwd(), 'scripts', 'qa-needles', 'r363.tsv'), 'utf8')
    const podatkovne = reg.split('\n').filter((l) => l && !l.startsWith('#') && l.split('\t').length >= 3 && l.split('\t')[2].startsWith('need_static'))
    // need_static podatkovne NESPREMENJENE (4 — era vsota 173 ohranjena)
    expect(podatkovne).toHaveLength(4)
    const naslednica = podatkovne.find((l) => l.startsWith('h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums focus-visible:outline-hidden'))
    expect(naslednica).toBeDefined()
    const inv = readFileSync(join(ROK, 'inventory-tab.tsx'), 'utf8')
    expect(inv.split(naslednica!.split('\t')[0]).length - 1).toBe(1)
    expect(reg).toContain('EVOLVED R391 val 68: žeton')
    expect(reg).not.toMatch(/^h-8 shrink-0 gap-1\.5 text-\[11px\] font-medium tabular-nums press-scale\t/m)
  })

  it('(E) iskrena meja: .press-scale utility OSTANE v globals.css (105 non-dual uporabnikov) + transition-all cva baza Button (pretok ohranjen)', () => {
    const globals = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')
    expect(globals).toContain('transform: scale(0.97)')
    const button = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'button.tsx'), 'utf8')
    expect(button).toContain('transition-all disabled:pointer-events-none disabled:opacity-50')
  })
})
