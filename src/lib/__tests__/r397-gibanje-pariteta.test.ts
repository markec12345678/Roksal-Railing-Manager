// r397-gibanje-pariteta.test.ts — R397 FEATURE: DESETI STRAŽAR —
// GIBANJE-PARITETA DISCIPLINA (prefers-reduced-motion pokritost vseh
// kontinuiranih zank v globals.css). Komplet varuhov: r385 (dark FB) +
// r386 (O2 pairing) + r387 (FB-border) + r388 (hover-barvna pokritost) +
// r389 (kaskadna disciplina) + r391 (press-scale disciplina) +
// r392 (hover-transform/senčna disciplina) + r394 (outline/fokus
// disciplina) + r395 (tema-pariteta disciplina) + r396 (HEX cenzus
// stoječi stražar) + r397 (gibanje-pariteta disciplina).
//
// Disk resnica (r397 triaža, kanon LEKCIJA R396 (5) — triaža PRED val):
//   kontinuirane (infinite) zanke BREZ pokritosti PRED val 72:
//     .badge-pulse        → badge-pulse-breathe 2s infinite (×4 žetona, 2 dat.)
//     .shine-effect::after → shine 3s infinite (×3 žetona, 2 dat.)
//     .animate-pulse-soft → pulse-soft 2s infinite (×3 žetona, 3 dat.)
//     .shimmer            → shimmer 1.5s infinite (×4 žetona, 1 dat.)
//   + .animate-bounce-subtle (enojni 0.3s izski, ×1 žeton) — pokrit za
//     popolnost družine (končno stanje vizualno identično).
//   val 72 (R397) rešuje P2 mejo iz R396 (G): ob prefers-reduced-motion:
//   reduce vse zgoraj mirujejo (animation: none) — 0 novih hex, vrednosti
//   se ne dotikamo, samo ustavimo gibanje; svetla/temna tema bajtno.
// Iskrene meje: (1) enojni vstopni animaciji (fadeInUp, slideInRight)
// ostajata brez ločenih guardov — kratek 0.3s vstop, končno stanje
// vizualno identično (forwards), WCAG 2.3.3 ne zahteva ustavitve; (2)
// hover-enojni btn-shine-sweep je uporabniško sprožen (150–200 ms
// interaktivna družina, kanon val 69); (3) viz/** ZAŠČITENO jedro nič
// (kanon R167); (4) hex cenzus izključuje komentarje (nauček R163).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const GS = () => readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')

const DOKUMENTIRANI_HEX = [
  '#cbd5e1', // scrollbar-thin svetli palec (svetla tema)
  '#475569', // temna govorica palec (scrollbar-thin-dark + .dark pariteta)
  '#334155', // temna govorica palec hover
  '#1d2b3e', // gradient-text svetli (roksal-navy hex)
  '#2a4a7f', // gradient-text svetli drugi gradient stopec
  '#f59e0b', // gradient-text .dark (roksal-amber)
  '#fbbf24', // gradient-text .dark drugi stopec
]

function hexIzUtilities(): string[] {
  const celo = GS()
  const start = celo.indexOf('@layer utilities')
  if (start < 0) throw new Error('FAILOVEDANO: @layer utilities manjka')
  const telo = celo.slice(start)
  const brezKomentarjev = telo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return (brezKomentarjev.match(/#[0-9a-fA-F]{6}\b/g) ?? [])
}

/** val 72 blok: od komentarja 'val 72 (R397)' do zaključka media bloka. */
function val72Blok(): string {
  const css = GS()
  const i = css.indexOf('val 72 (R397)')
  expect(i).toBeGreaterThan(0)
  const m = css.indexOf('@media (prefers-reduced-motion: reduce)', i)
  expect(m).toBeGreaterThan(0)
  const konec = css.indexOf('/* Slide in from right */', m)
  expect(konec).toBeGreaterThan(m)
  return css.slice(m, konec)
}

describe('R397 DESETI STRAŽAR — gibanje-pariteta disciplina (reduced-motion pokritost)', () => {
  it('(A) VAL 72 anchorji: vsa 5 družinskih selektorjev nosi animation:none znotraj val 72 media bloka (točno ×1 vsak)', () => {
    const blok = val72Blok()
    for (const sel of [
      '.badge-pulse {',
      '.shine-effect::after {',
      '.animate-pulse-soft {',
      '.shimmer {',
      '.animate-bounce-subtle {',
    ]) {
      expect(blok.split(sel).length - 1, sel).toBe(1)
    }
    expect((blok.match(/animation: none;/g) ?? []).length).toBe(5)
    // celoten globals: 3 media guardi (shake + tile + val 72)
    expect(GS().split('@media (prefers-reduced-motion: reduce)').length - 1).toBe(3)
  })

  it('(B) BESEDIŠČE OSTANE: keyframes + infinite govorica nedotaknjena (ustavimo gibanje, ne brišemo slovarja)', () => {
    const css = GS()
    expect(css).toContain('@keyframes badge-pulse-breathe')
    expect(css).toContain('animation: badge-pulse-breathe 2s ease-in-out infinite;')
    expect(css).toContain('animation: shine 3s ease-in-out infinite;')
    expect(css).toContain('animation: pulse-soft 2s ease-in-out infinite;')
    expect(css).toContain('animation: shimmer 1.5s ease-in-out infinite;')
    expect(css).toContain('animation: bounce-subtle 0.3s ease-in-out;')
  })

  it('(C) HEX CENZUS (stoječi stražar r396 prevzame tudi ta runda): utilities še vedno TOČNO 7 dokumentiranih vrednosti — val 72 nič novih hex', () => {
    const hexi = new Set(hexIzUtilities())
    for (const h of hexi) {
      expect(DOKUMENTIRANI_HEX).toContain(h)
    }
    const prisotni = new Set(hexIzUtilities())
    for (const h of DOKUMENTIRANI_HEX) {
      expect(prisotni.has(h)).toBe(true)
    }
  })

  it('(D) ENOJNI in-file kanon ostane: roksalShake + tilePopIn guardova točno ×1 (r396 (G) bajtno)', () => {
    const css = GS()
    expect(css.split('.animate-shake {\n      animation: none;\n    }').length - 1).toBe(1)
    expect(css.split('.more-tile {\n      animation: none;\n      opacity: 1;\n    }').length - 1).toBe(1)
  })

  it('(E) DRUŽINA ŽIVA: disk resnica rabe — badge-pulse ×1, shine-effect ×1, animate-pulse-soft ×2; shimmer + bounce-subtle = slovar brez klicnih mest (iskreno, guard pokriva vse prihodnje rabe)', () => {
    const žetoni: Record<string, number> = {}
    const obišči = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const pot = join(dir, e.name)
        if (statSync(pot).isDirectory()) obišči(pot)
        else if (pot.endsWith('.tsx') || pot.endsWith('.ts')) {
          const t = readFileSync(pot, 'utf8')
          for (const c of ['badge-pulse', 'shine-effect', 'animate-pulse-soft', 'shimmer', 'animate-bounce-subtle']) {
            žetoni[c] = (žetoni[c] ?? 0) + (t.match(new RegExp(c.replace(/-/g, '\\-') + '(?![-\\w])', 'g')) ?? []).length
          }
        }
      }
    }
    obišči(join(process.cwd(), 'src', 'components'))
    obišči(join(process.cwd(), 'src', 'app'))
    expect(žetoni['badge-pulse'] ?? 0).toBe(1)
    expect(žetoni['shine-effect'] ?? 0).toBe(1)
    expect(žetoni['animate-pulse-soft'] ?? 0).toBe(2)
    // slovarski pari: definicija v globals.css (test (B)), rabe ×0 —
    // dokumentirano tukaj, nič tihega (kanon disk-resnice R396 (6))
    expect(žetoni['shimmer'] ?? 0).toBe(0)
    expect(žetoni['animate-bounce-subtle'] ?? 0).toBe(0)
  })

  it('(F) KOMPILIRANI CSS dokaz (ko .next obstaja): minificiran reduced-motion guard nosi .badge-pulse{animation:none} — order-dependenca iskreno rešena (SKIP ob zastarelem buildu)', () => {
    const chunkDir = join(process.cwd(), '.next', 'static', 'chunks')
    if (!existsSync(chunkDir)) {
      console.log('(F) .next ni zgrajen — preskočeno (build faza ga pokrije)')
      return
    }
    const naji = (dir: string): string[] => {
      const out: string[] = []
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const pot = join(dir, e.name)
        if (statSync(pot).isDirectory()) out.push(...naji(pot))
        else if (pot.endsWith('.css')) out.push(pot)
      }
      return out
    }
    const cssFiles = naji(chunkDir)
    const vsebina = cssFiles.map((f) => readFileSync(f, 'utf8'))
    // LEKCIJA R397 (2): val 72 NI edini vir reduced-motion guardov (shake/tile
    // že obstajata) — prisotnost 'prefers-reduced-motion' NE razloči zastarele
    // gradnje. Zaznavanje zastarelosti prek mtime: BUILD_ID STAREJŠI od
    // globals.css = build pred val 72 → iskren SKIP.
    const buildId = join(process.cwd(), '.next', 'BUILD_ID')
    if (!existsSync(buildId)) {
      console.log('(F) BUILD_ID manjka — preskočeno (build faza ga pokrije)')
      return
    }
    const stale = statSync(buildId).mtimeMs < statSync(join(process.cwd(), 'src', 'app', 'globals.css')).mtimeMs
    if (!stale) {
      // svež build (po val 72) — MORA nositi val 72 pariteto v minificirani
      // obliki: lightningcss ZLIJE 5 selektorjev v ENO pravilo (LEKCIJA
      // R397 (3): minificirana oblika = zliti selector list, src pretty ≠
      // build minificirano — nadgradnja LEKCIJE R396 (3))
      const zlito = '.badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,.animate-bounce-subtle{animation:none}'
      expect(vsebina.some((c) => c.includes(zlito))).toBe(true)
    } else {
      console.log('(F) build je zastarel (pred val 72) — preskočeno; svež build + re-run dokazata')
    }
  })

  it('(G) MED-STRAŽARSKI roki (val 71 × val 72): ta runda se je dotaknila globals.css — scrollbar pariteta val 71 ostane točno ×1 + vrednosti', () => {
    const css = GS()
    expect(css.split('.dark .scrollbar-thin::-webkit-scrollbar-thumb {').length - 1).toBe(1)
    expect(css.split('.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {').length - 1).toBe(1)
    const i = css.indexOf('.dark .scrollbar-thin::-webkit-scrollbar-thumb {')
    expect(css.slice(i, i + 260)).toContain('background-color: #475569;')
  })
})
