// r389-lasta-uzkost-generalizacija.test.ts — R389 FEATURE: PETI STRAŽAR —
// LASTNA-PREHOD (transition property-list) disciplina GENERALIZACIJA.
// Komplet varuhov: r385 (dark FB polovica) + r386 (O2 pairing) + r387
// (FB-border istobarvnost) + r388 (transition pokritost) + TA (kaskadna
// disciplina: ožja elementna utility OVERI ui-kit bazo — LEKCIJA R389 (3)).
//
// Kaskadni vrstni red (disk resnica, zgrajen CSS 437bdcb4b4a2e58f.css;
// absolutne pozicije se spreminjajo per build, VRSTNI RED je determinističen
// per Tailwind različica — kasnejši v stylesheetu ZMAGA pri enaki specifičnosti):
//   .transition < .transition-[...] arbitrary < .transition-all <
//   .transition-colors < .transition-opacity < .transition-shadow <
//   .transition-transform < .transition-none
// (arbitrary disk resnica: [border-color,box-shadow] @115627 +
//  [color,box-shadow] @115870 < transition-all @117243).
//
// PRAVILO stražarja: element z hover barvnim žetonom (bg/text/border-roksal-)
// je POKRIT, če je dotična lastnost v property listi ZMAGOVALNEga transition-
// utilityja elementa (lastne utilityje + ui-kit baza za Button/Badge);
// ZMAGOVALEC = utility z najvišjim kaskadnim rangom med prisotnimi.
// R388 pokritost() je bila UNIJA vseh matchov — R389 jo popravi na kaskadno
// (unija je lažno pozitivna pri ko- obstoju ožjega in širšega utilityja).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(process.cwd(), 'src')
const UI_KIT_BAZA: Record<string, string> = {
  Button: 'transition-all',
  Badge: 'transition-[color,box-shadow]',
}

// kaskadni rangi (višji = zmaguje) — disk resnica zgrajenega CSS (glej glavo)
const RANG: Array<[RegExp, number]> = [
  [/^transition$/, 0],
  [/^transition-\[/, 1],
  [/^transition-all$/, 2],
  [/^transition-colors$/, 3],
  [/^transition-opacity$/, 4],
  [/^transition-shadow$/, 5],
  [/^transition-transform$/, 6],
  [/^transition-none$/, 7],
]
const rang = (u: string): number => RANG.find(([re]) => re.test(u))?.[1] ?? -1

function lastnosti(utility: string): Set<string> {
  const s = new Set<string>()
  if (utility === 'transition' || utility === 'transition-all' || utility === 'transition-colors') {
    s.add('bg'); s.add('text'); s.add('border')
  } else if (utility.startsWith('transition-[')) {
    for (const del of utility.slice('transition-['.length, -1).split(',')) {
      const q = del.trim()
      if (q === 'background-color') s.add('bg')
      else if (q === 'color') s.add('text')
      else if (q === 'border-color') s.add('border')
    }
  }
  return s
}

function zmagovalec(utilityji: string[]): string | null {
  if (utilityji.length === 0) return null
  return utilityji.reduce((a, b) => (rang(b) > rang(a) ? b : a))
}

const ZAMRZNJENE_IZJEME = new Set([
  'components/viz/before-after.tsx:182',
  'components/viz/before-after.tsx:185',
  'components/viz/step-product.tsx:275',
  'components/roksal/measurements-tab.tsx:5609',
  'components/roksal/sessions-dialog.tsx:292',
  'components/roksal/quote-followup.tsx:409',
  // finder omejitev: vrnitev je template literal BREZ JSX sidra — baza (L457)
  // nosi transition-colors (pokritost resnično prisotna), iskalnik ne more
  // vezati elementa (disk resnica r388-triaza5.py — isti artefakt)
  'components/roksal/material-intelligence-tab.tsx:459',
  'lib/termini-prikaz.ts:47',
  'lib/termini-prikaz.ts:49',
  'lib/termini-prikaz.ts:51',
  'lib/termini-prikaz.ts:53',
])

function* tsxTs(dir: string): Generator<string> {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (e === '__tests__') continue
      yield* tsxTs(p)
    } else if (/\.tsx?$/.test(e)) yield p
  }
}

function najdiTag(vrstice: string[], hitIdx: number): { ime: string; tekst: string } | null {
  for (let j = hitIdx; j >= 1; j--) {
    const v = vrstice[j - 1]
    if (j < hitIdx && (/\/>\s*$/.test(v) || /<\/[A-Za-z][A-Za-z0-9]*>\s*$/.test(v))) return null
    const m = /<([A-Za-z][A-Za-z0-9]*)/.exec(v)
    if (m) {
      const ime = m[1]
      const tekst: string[] = []
      for (let k = j - 1; k < Math.min(vrstice.length, j + 11); k++) {
        tekst.push(vrstice[k])
        if (/\/>\s*$/.test(vrstice[k]) || /(?:^|[^=\-])>\s*$/.test(vrstice[k])) break
      }
      return { ime, tekst: tekst.join('\n') }
    }
  }
  return null
}

describe('R389 FEATURE — lastna-prehod disciplina stražar GENERALIZACIJA (5. varuh)', () => {
  it('(A) GLOBALNO: hover barvni žeton je pokrit s property listo ZMAGOVALNEga transition utilityja (kaskadno, ne unija) — kršitve 0', () => {
    const kršitve: string[] = []
    for (const f of tsxTs(ROOT)) {
      if (f.includes('__tests__')) continue
      const rel = f.slice(ROOT.length + 1)
      const vrstice = readFileSync(f, 'utf-8').split('\n')
      for (let i = 1; i <= vrstice.length; i++) {
        const m = /hover:(bg|text|border)-roksal-/.exec(vrstice[i - 1])
        if (!m) continue
        const vrsta = m[1]
        const ključ = `${rel}:${i}`
        const tag = najdiTag(vrstice, i)
        if (!tag) continue
        const lastne = [...tag.tekst.matchAll(/transition(?:-\[[^\]]+\]|-(?:all|colors|opacity|shadow|transform|none))(?![\w-])/g)].map(x => x[0])
        // LEKCIJA R389 (3): ožja lastna utility OVERI ui-kit bazo — baza šteje
        // SAMO, če element nima NOBENE lastne transition utility
        const baza = lastne.length === 0 ? UI_KIT_BAZA[tag.ime] : undefined
        const vsi = baza ? [...lastne, baza] : lastne
        if (vsi.length === 0) continue // brez transition = statični element (ven iz stražarja)
        const zmaga = zmagovalec(vsi)
        if (!zmaga) continue
        if (!lastnosti(zmaga).has(vrsta)) {
          if (ZAMRZNJENE_IZJEME.has(ključ)) continue
          kršitve.push(`${ključ} (zmagovalec ${zmaga}, rabi ${vrsta})`)
        }
      }
    }
    expect(kršitve, `kaskadno nepokrite hover vrstice: ${kršitve.join('; ')}`).toEqual([])
  })

  it('(B) ui-kit bazi zamrznjeni (disk resnica): Button transition-all + Badge transition-[color,box-shadow] — shadcn jezik NI mutiran', () => {
    const gumb = readFileSync(join(ROOT, 'components/ui/button.tsx'), 'utf-8')
    const značka = readFileSync(join(ROOT, 'components/ui/badge.tsx'), 'utf-8')
    expect(gumb).toContain('transition-all')
    expect(značka).toContain('transition-[color,box-shadow]')
  })

  it.each([
    ['components/roksal/notification-center.tsx', 'transition-[transform,color]', 811, 'group-hover:text-roksal-amber'],
    ['components/roksal/safety-tab.tsx', 'transition-[transform,background-color,box-shadow]', 254, 'hover:bg-roksal-navy/90'],
  ] as Array<[string, string, number, string]>)(
    '(C) val 67 tarča %s nosi nadgrajeno listo (pokritost resnična — stražar jo PREVERJA, izjema NI)',
    (f, lista, ln, hover) => {
      const v = readFileSync(join(ROOT, f), 'utf-8').split('\n')[ln - 1]
      expect(v.includes(lista), `${f}:${ln} nosi ${lista}`).toBe(true)
      expect(v.includes(hover), `${f}:${ln} hover žeton ohranjen`).toBe(true)
      expect(v.includes('transition-transform'), `${f}:${ln} star ožji token ×0`).toBe(false)
    },
  )

  it('(D) izjeme ×11 (L811 EVOLVED izven — pokritost resnična) + L811/L254 kaskadno pokriti v glavnem skanu', () => {
    expect(ZAMRZNJENE_IZJEME.size).toBe(11)
    expect(ZAMRZNJENE_IZJEME.has('components/roksal/notification-center.tsx:811')).toBe(false)
    // kaskadna disk resnica: L811 zmagovalec = lastna arbitrary [transform,color]
    const nc = readFileSync(join(ROOT, 'components/roksal/notification-center.tsx'), 'utf-8').split('\n')[810]
    const lastneNc = [...nc.matchAll(/transition(?:-\[[^\]]+\]|-(?:all|colors|opacity|shadow|transform|none))(?![\w-])/g)].map(x => x[0])
    expect(lastnosti(zmagovalec(lastneNc)!).has('text')).toBe(true)
    // L254: zmagovalec = baza transition-all (arbitrary se vrsti PRED all —
    // disk resnica @115870 < @117243) → bg pokrit PREK BAZE; lastna lista
    // je eksplicitna dokumentacija namena (transform+bg+ring)
    const st = readFileSync(join(ROOT, 'components/roksal/safety-tab.tsx'), 'utf-8').split('\n')[253]
    const lastneSt = [...st.matchAll(/transition(?:-\[[^\]]+\]|-(?:all|colors|opacity|shadow|transform|none))(?![\w-])/g)].map(x => x[0])
    const zmagaSt = zmagovalec([...lastneSt, UI_KIT_BAZA.Button])
    expect(lastnosti(zmagaSt!).has('bg')).toBe(true)
  })
})
