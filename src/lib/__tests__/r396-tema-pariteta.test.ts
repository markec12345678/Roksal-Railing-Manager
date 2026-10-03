// r396-tema-pariteta.test.ts — R396 FEATURE: DEVETI STRAŽAR — TEMA-PARITETA
// DISCIPLINA utilities sloja (globals.css @layer utilities). Komplet
// varuhov: r385 (dark FB) + r386 (O2 pairing) + r387 (FB-border) +
// r388 (hover-barvna pokritost) + r389 (kaskadna disciplina) +
// r391 (press-scale disciplina) + r392 (hover-transform/senčna disciplina)
// + r394 (outline/fokus disciplina) + r395 (tema-pariteta disciplina).
//
// Disk resnica (r396-triaza.py + r396-triaza2.py + scrollbar cenzus):
//   .scrollbar-thin      ×33 rab — val 71 (R396) je povezal obstoječo
//                        temno govorico družine (.scrollbar-thin-dark,
//                        ×0 rab = mrtvi CSS) na .dark .scrollbar-thin —
//                        VREDNOSTI IZ ISTIH ŽETONOV (#475569 + hover
//                        #334155), svetla tema bajtno nespremenjena.
//   hex cenzus utilities = 7 dokumentiranih vrednosti: #cbd5e1 (svetli
//                        palec) + #475569/#334155 (temna govorica, ×2
//                        mesta: -dark utility + .dark pariteta) +
//                        #1d2b3e/#2a4a7f (gradient-text svetli) +
//                        #f59e0b/#fbbf24 (gradient-text .dark amber).
// Iskrene meje: (1) .scrollbar-thin-dark utility OSTANE (namenski
// Always-dark primeri; NIČ brisanja brez naročila); (2) kontinuirane
// animacije (badge-pulse-breathe, pulse-soft, bounce-subtle, shimmer)
// BREZ prefers-reduced-motion — dokumentirana P2 meja (in-file kanon
// pokriva roksalShake + tilePopIn; guard (G) zamrzne obstoječo
// pokritost, NE zahteva nove); (3) viz/** ZAŠČITENO jedro nič (kanon
// R167); (4) hex cenzus izključuje komentarje (besedila, ne vrednosti).
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

/** hex vrednosti iz utilities sloja BREZ komentarjev (nauček R163: stražar
 *  gleda izvedljive vrstice) — odstrani /* … *​/ in // … bloke. */
function hexIzUtilities(): string[] {
  const celo = GS()
  const start = celo.indexOf('@layer utilities')
  if (start < 0) throw new Error('FAILOVEDANO: @layer utilities manjka')
  const telo = celo.slice(start)
  const brezKomentarjev = telo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return (brezKomentarjev.match(/#[0-9a-fA-F]{6}\b/g) ?? [])
}

describe('R396 DEVETI STRAŽAR — tema-pariteta disciplina utilities sloja', () => {
  it('(A) SCROLLBAR PARITETA (val 71 anchor): .dark .scrollbar-thin thumb + hover točno ×1, vrednosti #475569/#334155; svetli blok bajtno', () => {
    const css = GS()
    expect(css.split('.dark .scrollbar-thin::-webkit-scrollbar-thumb {').length - 1).toBe(1)
    expect(css.split('.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {').length - 1).toBe(1)
    const i = css.indexOf('.dark .scrollbar-thin::-webkit-scrollbar-thumb {')
    const blok = css.slice(i, i + 260)
    expect(blok).toContain('background-color: #475569;')
    expect(blok).toContain('background-color: #334155;')
    // svetla tema nespremenjena
    expect(css.split('.scrollbar-thin::-webkit-scrollbar-thumb {\n    background-color: #cbd5e1;\n    border-radius: 20px;\n  }').length - 1).toBe(1)
  })

  it('(B) HEX CENZUS: utilities sloj nosi TOČNO dokumentiranih 7 vrednosti — 0 novih hex (kanon rund, zdaj STOJIČI stražar)', () => {
    const hexi = new Set(hexIzUtilities())
    for (const h of hexi) {
      expect(DOKUMENTIRANI_HEX).toContain(h)
    }
    // vsa dokumentirana družina je živa (nobena ne izgine tiho)
    const prisotni = new Set(hexIzUtilities())
    for (const h of DOKUMENTIRANI_HEX) {
      expect(prisotni.has(h)).toBe(true)
    }
  })

  it('(C) GRADIENT-TEXT ogledalo: svetli navy gradient NOSI .dark amber parico', () => {
    const css = GS()
    expect(css).toContain('.gradient-text {')
    expect(css).toContain('linear-gradient(135deg, #1d2b3e, #2a4a7f)')
    const d = css.indexOf('.dark .gradient-text {')
    expect(d).toBeGreaterThan(0)
    const blok = css.slice(d, d + 220)
    expect(blok).toContain('linear-gradient(135deg, #f59e0b, #fbbf24)')
  })

  it('(D) POVRŠINSKE KARTE: card-hover in glass-card NOSITA .dark counterparta (obstoječa disciplina, zamrznjena)', () => {
    const css = GS()
    expect(css.split('.dark .card-hover:hover {').length - 1).toBe(1)
    expect(css.split('.dark .card-hover:active {').length - 1).toBe(1)
    expect(css.split('.dark .glass-card {').length - 1).toBe(1)
  })

  it('(E) DRUŽINA ŽIVA: .scrollbar-thin raba ≥30 čez src + .scrollbar-thin-dark definicija ostane (vir vrednosti)', () => {
    let zadetki = 0
    const obišči = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const pot = join(dir, e.name)
        if (statSync(pot).isDirectory()) obišči(pot)
        else if (pot.endsWith('.tsx')) {
          const t = readFileSync(pot, 'utf8')
          zadetki += (t.match(/scrollbar-thin(?![-\w])/g) ?? []).length
        }
      }
    }
    obišči(join(process.cwd(), 'src', 'components'))
    obišči(join(process.cwd(), 'src', 'app'))
    expect(zadetki).toBeGreaterThanOrEqual(30)
    const css = GS()
    expect(css.split('.scrollbar-thin-dark::-webkit-scrollbar-thumb {').length - 1).toBe(1)
  })

  it('(F) KOMPILIRANI CSS dokaz (ko .next obstaja): .dark scrollbar pariteta v buildu — vrednosti iz družine', () => {
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
    // ORDER-DEPENDENCA (kanon R394 (F)): polna vitest faza teče PRED svežim
    // buildom — zastarel build še ne nosi val 71 → iskren SKIP; svež build
    // + ponovni tek guarda po build fazi dokazata POPOLNOSTI.
    const vzorec = /\.dark \.scrollbar-thin[^{]*-webkit-scrollbar-thumb[^{]*\{[^}]*#475569[^}]*\}/
    const najden = cssFiles.some((f) => vzorec.test(readFileSync(f, 'utf8')))
    const starSel = cssFiles.some((f) => /\.dark \.scrollbar-thin/.test(readFileSync(f, 'utf8')))
    if (!najden && !starSel) {
      console.log('(F) build je zastarel (pred val 71) — preskočeno; svež build + re-run dokazata')
      return
    }
    // build nosi .dark .scrollbar-thin pravilo — MORA biti val 71 pariteta
    expect(najden).toBe(true)
  })

  it('(G) REDUCED-MOTION in-file kanon zamrznjen: roksalShake + tilePopIn NOSITA guard (obstoječa pokritost); kontinuirane zanke = dokumentirana meja', () => {
    const css = GS()
    const steviloGuardov = css.split('@media (prefers-reduced-motion: reduce)').length - 1
    expect(steviloGuardov).toBeGreaterThanOrEqual(2)
    // guard bloka vsebuata ustavitveni kanon (animation-play-state / animation: none)
    const prviGuard = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'), css.indexOf('@media (prefers-reduced-motion: reduce)') + 400)
    expect(prviGuard).toMatch(/animation|transition/)
    // kontinuirane zanke ostajajo (P2 meja — dokumentirano, ne zamrznjeno kot napaka)
    expect(css).toContain('badge-pulse-breathe')
    expect(css).toContain('@keyframes shimmer')
  })
})
