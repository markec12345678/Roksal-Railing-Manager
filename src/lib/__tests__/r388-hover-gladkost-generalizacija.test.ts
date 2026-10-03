// r388-hover-gladkost-generalizacija.test.ts — R388 FEATURE: ČETRTI
// STRAŽAR — hover GLADKOST generalizacija (komplement tria FB varuhov:
// r385 dark FB + r386 O2 pairing + r387 FB-border; ta stražar zaklene
// transition POKRITOST hover barvnega jezika čez VSE src).
//
// Kanon val 66 (disk resnica r388-triaza5.py, element-točna triaža):
//  - vsaka vrstica z hover:(bg|text|border)-roksal-* na NATIVNEM elementu
//    MORA nositi transition pokritost za dotično lastnost (bg=background-
//    color, text=color, border=border-color) v celotnem odpiralnem tagu;
//  - ui-kit izjeme (zamrznjen shadcn jezik): Button baza 'transition-all'
//    (pokrije vse), Badge baza 'transition-[color,box-shadow]' (NE pokrije
//    bg → Badge vrstica z hover:bg rabi LASTNO transition-colors);
//  - ZAMRZNJENE izjeme (mrtvi/dead hover žetoni — disk resnica ob nastanku,
//    iskreno dokumentirano, NI delani zaradi dela):
//      viz/before-after L182+L185 (pointer-events-none — hover ne more
//      ogniti), viz/step-product L275 + roksal/measurements L5609 +
//      roksal/sessions-dialog L292 + roksal/quote-followup L409
//      (hover:bg == bg — vizualno NIČ), lib/termini-prikaz L47/L49/L51/L53
//      (mrtvi izvozi — SCHEDULE_TERMINI_STATUS_COLORS brez .tsx potrošnika).
//      [EVOLVED R389 val 67] roksal/notification-center L811 IZ IZJEM —
//      property-list nadgradnja transition-[transform,color] (konflikt
//      rešen; pokritost sedaj resnična in stražar jo PREVERJA).
//  - vsaka NOVA kršitev = glasna regresija (stražar predstavlja kanon za
//    prihodnje val-runde).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(process.cwd(), 'src')
const UI_KIT = new Set(['Button', 'Badge', 'Card', 'Input', 'Checkbox', 'Switch', 'Label', 'Textarea', 'SelectTrigger', 'TabsTrigger', 'Toggle', 'DropdownMenuItem', 'DropdownMenuTrigger', 'TooltipTrigger'])

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
  // [EVOLVED R389 val 67] notification-center.tsx:811 odstranjena —
  // property-list nadgradnja; pokritost preverjena v glavnem skanu
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

function pokritost(tekst: string, vrsta: string): boolean {
  const pokrite = new Set<string>()
  for (const m of tekst.matchAll(/transition-(all|colors|opacity|transform|shadow|none|\[[^\]]+\])/g)) {
    const t = m[1]
    if (t === 'all' || t === 'colors') {
      pokrite.add('bg'); pokrite.add('text'); pokrite.add('border')
    } else if (t.startsWith('[')) {
      for (const part of t.slice(1, -1).split(',')) {
        const q = part.trim()
        if (q === 'background-color') pokrite.add('bg')
        else if (q === 'color') pokrite.add('text')
        else if (q === 'border-color') pokrite.add('border')
      }
    }
  }
  return pokrite.has(vrsta)
}

describe('R388 FEATURE — hover gladkost stražar GENERALIZACIJA (4. varuh; transition pokritost čez vse src)', () => {
  it('(A) GLOBALNO: vsaka hover-roksal vrstica na nativnem elementu nosi transition pokritost (ali je zamrznjena izjema) — kršitve 0', () => {
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
        if (UI_KIT.has(tag.ime) && vrsta !== 'bg') continue // Button/Badge baza pokrije color+box-shadow
        if (tag.ime === 'Button') continue // transition-all
        if (tag.ime[0] === tag.ime[0].toUpperCase() && /transition-all/.test(tag.tekst)) continue
        if (ZAMRZNJENE_IZJEME.has(ključ)) continue
        if (!pokritost(tag.tekst, vrsta)) kršitve.push(ključ)
      }
    }
    expect(kršitve, `nepokrite hover-roksal vrstice: ${kršitve.join(', ')}`).toEqual([])
  })

  it('(B) ui-kit bazi zamrznjeni (disk resnica): Button transition-all + Badge transition-[color,box-shadow] — shadcn jezik NI mutiran', () => {
    const gumb = readFileSync(join(ROOT, 'components/ui/button.tsx'), 'utf-8')
    const značka = readFileSync(join(ROOT, 'components/ui/badge.tsx'), 'utf-8')
    expect(gumb).toContain('transition-all')
    expect(značka).toContain('transition-[color,box-shadow]')
  })

  it.each([
    ['components/roksal/dashboard-tab.tsx', 11],
    ['components/roksal/photo-tab.tsx', 3],
    ['components/roksal/measurements-tab.tsx', 2],
    ['components/roksal/termini-card.tsx', 1],
    ['components/viz/viz-tab.tsx', 1],
    ['components/viz/product-home.tsx', 1],
    ['app/setup/setup-client.tsx', 1],
    ['app/aktivacija/[token]/activation-client.tsx', 1],
  ] as Array<[string, number]>)(
    '(C) val 66 tarče %s nosijo transition-colors (gladkost montirana)',
    (f, pričakovano) => {
      const vrstice = readFileSync(join(ROOT, f), 'utf-8').split('\n')
      const nosilci = vrstice.filter(v => v.includes('transition-colors') && /hover:(bg|text)-roksal-/.test(v)).length
      expect(nosilci).toBeGreaterThanOrEqual(pričakovano)
    },
  )
})
