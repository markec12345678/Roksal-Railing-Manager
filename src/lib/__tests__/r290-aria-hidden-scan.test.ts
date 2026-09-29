// R290 — P1-d testi: a11y ikonski skenerji + REGRESIJSKI STRAŽARJI, ki
// ZAKLENEJO mega-diff (odprt R242/R243, "629 mest — codemod + izjeme-audit
// + detektorjev test").
//
// EN VIR RESNICE (trije skenerji, brez duplikacije):
//  • a11y-ikon-scan.ts  — polni pregled lucide ikon (kandidatiZaAriaHidden),
//    vstavljanje (vstaviAriaHidden — codemod CLI r290-codemod-aria-hidden.ts),
//    izjeme-audit: role="img" (vsebinska grafika) in {...spread}.
//  • a11y-gumbi-scan.ts — R157 migracija: ikonski <Button>/<button> brez
//    dostopnega imena (popravek r157: self-closing gumb = eksplicitno prazen
//    child, ne lažno območje do naslednjega </Button>).
//  • aria-hidden-scan.ts — OZKI podnabor: ikona brez aria-hidden znotraj
//    imenovanega interaktivnega elementa (semantično VEDNO napačna).
//
// STRAŽARJI držijo celotno drevo (src/components + src/app) na nič.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  kandidatiZaAriaHidden,
  lucideImenaIzVira,
  skenirajIkonAriaHidden,
  vstaviAriaHidden,
} from '@/lib/a11y-ikon-scan'
import { skenirajGumbeBrezImena } from '@/lib/a11y-gumbi-scan'
import { lucideIconsNeedingAriaHidden } from '@/lib/aria-hidden-scan'

// ---------------------------------------------------------------------------
// a11y-ikon-scan — lucideImenaIzVira
// ---------------------------------------------------------------------------

describe('R290 lucideImenaIzVira', () => {
  it('izvleče imena, sortira po pojavljanju; `as` alias = lokalno ime', () => {
    const src = [
      'import { Bell, AlarmClock as Uri } from "lucide-react"',
      '<Uri className="h-3" />',
    ].join('\n')
    expect(lucideImenaIzVira(src)).toEqual(['Bell', 'Uri'])
    expect(kandidatiZaAriaHidden(src)).toHaveLength(1)
  })

  it('drugi uvozi so ignorirani; večvrstični uvoz podprt', () => {
    const src = [
      'import {',
      '  Bell,',
      '  Plus,',
      "} from 'lucide-react'",
      "import { Download } from 'react-icons'",
    ].join('\n')
    expect(lucideImenaIzVira(src)).toEqual(['Bell', 'Plus'])
  })

  it('fail-closed: ne-niz = TypeError', () => {
    expect(() => lucideImenaIzVira(null as unknown as string)).toThrow(TypeError)
  })
})

// ---------------------------------------------------------------------------
// a11y-ikon-scan — kandidatiZaAriaHidden (polni pregled + izjeme-audit)
// ---------------------------------------------------------------------------

describe('R290 kandidatiZaAriaHidden — polni pregled', () => {
  it('ikona z aria-hidden je čista; brez → kandidat s pravo vrstico', () => {
    const src = [
      "import { X } from 'lucide-react'",
      '<X className="h-3" aria-hidden="true" />',
      '<X className="h-3" />',
    ].join('\n')
    const k = kandidatiZaAriaHidden(src)
    expect(k).toHaveLength(1)
    expect(k[0]!.vrstica).toBe(3)
    expect(k[0]!.ime).toBe('X')
  })

  it('generična tipska pozicija useState<Layers>({…}) NI JSX (leksikalna izključitev)', () => {
    const src = [
      "import { Layers } from 'lucide-react'",
      'type Layers = { walls: boolean }',
      'const [layers, setLayers] = useState<Layers>({ walls: true })',
    ].join('\n')
    expect(kandidatiZaAriaHidden(src)).toHaveLength(0)
  })

  it('JSX `<` za ločilom (vrnjen/oklepaj/presledek) JE kandidat', () => {
    const src = "import { X } from 'lucide-react'\nreturn (<X />)"
    expect(kandidatiZaAriaHidden(src)).toHaveLength(1)
  })

  it('izjema role="img" (vsebinska grafika) NI kandidat — ampak je zabeležena', () => {
    const src = "import { Kompas } from 'lucide-react'\n<Kompas role=\"img\" aria-label=\"Smer 180°\" />"
    const vse = skenirajIkonAriaHidden(src)
    expect(vse).toHaveLength(1)
    expect(vse[0]!.roleImg).toBe(true)
    expect(kandidatiZaAriaHidden(src)).toHaveLength(0)
  })

  it('izjema {...spread} NI kandidat (vrstni red atributov ni statično dokazljiv)', () => {
    const src = "import { X } from 'lucide-react'\n<X {...ikonProps} />"
    expect(skenirajIkonAriaHidden(src)[0]!.imaSpread).toBe(true)
    expect(kandidatiZaAriaHidden(src)).toHaveLength(0)
  })

  it('komentarji (// in /* */) niso kandidati', () => {
    const src = [
      "import { X } from 'lucide-react'",
      '// <X className="h-3" /> v komentarju',
      '/* <X /> tudi tukaj */',
      '<X aria-hidden="true" />',
    ].join('\n')
    expect(kandidatiZaAriaHidden(src)).toHaveLength(0)
  })

  it('brace-aware: primerjava znotraj izraza ne prelomi taga', () => {
    const src = "import { X } from 'lucide-react'\n<X className={a > b ? 'x' : 'y'} aria-hidden=\"true\" />"
    expect(kandidatiZaAriaHidden(src)).toHaveLength(0)
  })

  it('fail-closed: ne-niz = TypeError', () => {
    expect(() => skenirajIkonAriaHidden(42 as unknown as string)).toThrow(TypeError)
  })
})

// ---------------------------------------------------------------------------
// a11y-ikon-scan — vstaviAriaHidden (EN VIR vstavljanja — codemod + test)
// ---------------------------------------------------------------------------

describe('R290 vstaviAriaHidden — deterministično vstavljanje', () => {
  it('`<I />` → `<I aria-hidden />` in `<I/>` → `<I aria-hidden />`', () => {
    const a = "import { X } from 'lucide-react'\n<X />"
    const k = kandidatiZaAriaHidden(a)[0]!
    const nov = vstaviAriaHidden(a, k.konecTag, k.selfClosing)
    expect(nov).toContain('<X aria-hidden />')
    const b = "import { X } from 'lucide-react'\n<X/>"
    const kb = kandidatiZaAriaHidden(b)[0]!
    expect(vstaviAriaHidden(b, kb.konecTag, kb.selfClosing)).toContain('<X aria-hidden />')
  })

  it('parni tag: vstavi pred zapiralnim `>`', () => {
    const a = "import { X } from 'lucide-react'\n<X className=\"h-3\">ne</X>"
    const k = kandidatiZaAriaHidden(a)[0]!
    const nov = vstaviAriaHidden(a, k.konecTag, k.selfClosing)
    expect(nov).toContain('<X className="h-3" aria-hidden>ne</X>')
  })

  it('fail-closed: napačen indeks / selfClosing brez `/` = TypeError', () => {
    const src = '<X />'
    // konecTag=1 → src[1] je 'X', ne '>' → TypeError
    expect(() => vstaviAriaHidden(src, 1, false)).toThrow(TypeError)
    // selfClosing zahteva `/` tik pred `>` — '<X >' ga nima → TypeError
    expect(() => vstaviAriaHidden('<X >', 3, true)).toThrow(TypeError)
    expect(() => vstaviAriaHidden(5 as unknown as string, 4, true)).toThrow(TypeError)
  })

  it('idempotenca po vstavitvi: ponovni sken = 0 kandidatov', () => {
    const a = "import { X } from 'lucide-react'\n<X />"
    const k = kandidatiZaAriaHidden(a)[0]!
    const nov = vstaviAriaHidden(a, k.konecTag, k.selfClosing)
    expect(kandidatiZaAriaHidden(nov)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// a11y-gumbi-scan — R157 migracija (ikonski gumbi brez dostopnega imena)
// ---------------------------------------------------------------------------

describe('R290 skenirajGumbeBrezImena — R157 migracija', () => {
  it('ikonski <Button> brez aria-label = kandidat; z aria-label = čist', () => {
    const src = [
      '<Button><Download className="h-4" /></Button>',
      '<Button aria-label="Prenesi"><Download className="h-4" aria-hidden="true" /></Button>',
    ].join('\n')
    const k = skenirajGumbeBrezImena(src)
    expect(k).toHaveLength(1)
    expect(k[0]!.vrstica).toBe(1)
    expect(k[0]!.tag).toBe('Button')
  })

  it('SAMOZAPIRAJOČ gumb brez imena = kandidat (popravek r157 — eksplicitno prazen child)', () => {
    const src = '<button onClick={f} className="x" />'
    expect(skenirajGumbeBrezImena(src)).toHaveLength(1)
  })

  it('besedilni gumb NI kandidat; <ButtonX ni <Button (besedna meja)', () => {
    const src = [
      '<Button>Shrani</Button>',
      '<ButtonX aria-label="x"><X /></ButtonX>',
    ].join('\n')
    expect(skenirajGumbeBrezImena(src)).toHaveLength(0)
  })

  it('fail-closed: ne-niz = TypeError', () => {
    expect(() => skenirajGumbeBrezImena(undefined as unknown as string)).toThrow(TypeError)
  })
})

// ---------------------------------------------------------------------------
// aria-hidden-scan — ozki podnabor (imenovani interaktivni elementi)
// ---------------------------------------------------------------------------

describe('R290 lucideIconsNeedingAriaHidden — ozki podnabor', () => {
  it('ikona v <Button aria-label> brez aria-hidden = kršitelj; z aria-hidden = čist', () => {
    const src = [
      "import { X } from 'lucide-react'",
      '<Button aria-label="Zapri"><X className="h-4" /></Button>',
      '<Button aria-label="Zapri"><X className="h-4" aria-hidden="true" /></Button>',
    ].join('\n')
    const found = lucideIconsNeedingAriaHidden(src, ['X'])
    expect(found).toHaveLength(1)
    expect(found[0]!.line).toBe(2)
  })

  it('ikona v besedilnem gumbu (vidno besedilo) = kršitelj; samostojna NI', () => {
    const a = "import { X } from 'lucide-react'\n<button><X /> Shrani</button>"
    expect(lucideIconsNeedingAriaHidden(a, ['X'])).toHaveLength(1)
    const b = "import { X } from 'lucide-react'\n<div><X /></div>"
    expect(lucideIconsNeedingAriaHidden(b, ['X'])).toHaveLength(0)
  })

  it('aria-labelledby šteje; <ButtonX ni kontejner; nested globina pravilna', () => {
    const a = "import { X } from 'lucide-react'\n<button aria-labelledby=\"x\"><X /></button>"
    expect(lucideIconsNeedingAriaHidden(a, ['X'])).toHaveLength(1)
    const b = "import { X } from 'lucide-react'\n<ButtonX aria-label=\"x\"><X /></ButtonX>"
    expect(lucideIconsNeedingAriaHidden(b, ['X'])).toHaveLength(0)
    const c = [
      "import { X } from 'lucide-react'",
      '<div>',
      '  <Button aria-label="zunanji"><span><X /></span></Button>',
      '</div>',
    ].join('\n')
    expect(lucideIconsNeedingAriaHidden(c, ['X'])).toHaveLength(1)
  })

  it('fail-closed: ne-niz = TypeError; prazen seznam imen = brez kršiteljev', () => {
    expect(() => lucideIconsNeedingAriaHidden(null as unknown as string, ['X'])).toThrow(TypeError)
    expect(lucideIconsNeedingAriaHidden('<X />', [])).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// STRAŽARJI (R290 — P1-d zaklep): celotno drevo na nič.
// ---------------------------------------------------------------------------

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) walkTsx(p, out)
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(p)
  }
  return out
}

const GUARD_ROOTS = [
  join(process.cwd(), 'src', 'components'),
  join(process.cwd(), 'src', 'app'),
]

// R157 kanon: react-day-picker DayButton — aria-label vstavi KNJIŽNICA ob
// teku; statika je lažno pozitivna. IZRECNI seznam izjem (brez tihih izjem).
const GUMBI_IZJEME = ['ui/calendar.tsx']

describe('R290 regresijski stražarji — P1-d + R157 zaklep (celotno drevo)', () => {
  it('nobena lucide JSX raba v src/components + src/app ni brez aria-hidden (polni pregled)', () => {
    const offenders: string[] = []
    for (const root of GUARD_ROOTS) {
      for (const p of walkTsx(root)) {
        if (p.includes('__tests__')) continue
        const src = readFileSync(p, 'utf8')
        for (const k of kandidatiZaAriaHidden(src)) {
          offenders.push(`${p}:${k.vrstica} (${k.ime})`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('ozki podnabor (imenovani interaktivni elementi) je prav tako čist', () => {
    const offenders: string[] = []
    for (const root of GUARD_ROOTS) {
      for (const p of walkTsx(root)) {
        if (p.includes('__tests__')) continue
        const src = readFileSync(p, 'utf8')
        const names = lucideImenaIzVira(src)
        for (const o of lucideIconsNeedingAriaHidden(src, names, p)) {
          offenders.push(`${p}:${o.line} (${o.icon})`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('noben ikonski <Button>/<button> ni brez dostopnega imena (R157 migracija, izjeme izrecne)', () => {
    const offenders: string[] = []
    for (const root of GUARD_ROOTS) {
      for (const p of walkTsx(root)) {
        if (p.includes('__tests__')) continue
        const rel = p.slice(process.cwd().length + 1)
        if (GUMBI_IZJEME.some((iz) => rel.includes(iz))) continue
        const src = readFileSync(p, 'utf8')
        for (const g of skenirajGumbeBrezImena(src)) {
          offenders.push(`${p}:${g.vrstica} (${g.tag}) "${g.childPovzetek.slice(0, 40)}"`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
