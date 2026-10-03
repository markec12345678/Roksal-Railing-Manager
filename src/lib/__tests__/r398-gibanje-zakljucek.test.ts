// r398-gibanje-zakljucek.test.ts — R398 FEATURE: ENAJSTI STRAŽAR —
// GIBANJE-PARITETA ZAKLJUČEK (100 % pokritost neinterakcijskih animacij v
// globals.css). Komplet varuhov: r385 (dark FB) + r386 (O2 pairing) +
// r387 (FB-border) + r388 (hover-barvna pokritost) + r389 (kaskadna
// disciplina) + r391 (press-scale disciplina) + r392 (hover-transform/
// senčna disciplina) + r394 (outline/fokus disciplina) + r395 (tema-
// pariteta disciplina) + r396 (HEX cenzus stoječi stražar) +
// r397 (gibanje-pariteta disciplina) + r398 (zaključek pokritosti).
//
// Disk resnica (val 73 triaža PRED val, kanon LEKCIJA R396 (5)):
//   vstopne animacije BREZ pokritosti PRED val 73 (kandidat 1 iz R397
//   handoverja — iskreno dokumentirana meja iz R397 (A)/(B)):
//     .animate-fade-in-up    → fadeInUp 0.3s forwards (×55 TSX rab)
//     .slide-in-right        → slideInRight 300ms forwards (×14 TSX rab)
//     .stagger-children > *  → fadeInUp 0.3s forwards + STATIČNO opacity: 0
//                              (×0 TSX rab — slovarska para, iskreno)
//   val 73 (R398) jih nosi v OBSTOJEČEM .more-tile media guard bloku
//   (media guardov ostane TOČNO 3 — zamrznjen kanon r397 (A));
//   .stagger-children > * dobi opacity: 1 spremljevalca (statično
//   opacity: 0 bi ob animation: none ostalo NEVIDNO — isti vzorec kot
//   .more-tile guard). Forwards končno stanje (opacity 1 / translate 0)
//   je vizualno identično statičnemu stanju — nič tihega spremembe.
// Iskrene meje: (1) interaktivna družina ostaja kanon val 69 —
// btn-shine-sweep je :hover-sprožen (uporabniško, ne samodejno gibanje);
// press/tap prehodi so transition, ne animation; (2) viz/** ZAŠČITENO
// jedro nič (kanon R167); (3) hex cenzus izključuje komentarje
// (nauček R163).
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

/** Vstopni-guard blok: media blok, ki nosi .more-tile + val 73 anchorje. */
function vstopniBlok(): string {
  const css = GS()
  const i = css.indexOf('.more-tile {')
  expect(i).toBeGreaterThan(0)
  const m = css.indexOf('@media (prefers-reduced-motion: reduce)', i)
  expect(m).toBeGreaterThan(0)
  const konec = css.indexOf('@keyframes pulse-soft', m)
  expect(konec).toBeGreaterThan(m)
  return css.slice(m, konec)
}

/** val 72 blok: od komentarja 'val 72 (R397)' do zaključka media bloka
 *  (isti rez kot r397-gibanje-pariteta.test.ts — med-stražarski roki). */
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

describe('R398 ENAJSTI STRAŽAR — gibanje-pariteta zaključek (100 % neinterakcijskih animacij)', () => {
  it('(A) VAL 73 anchorji: vstopni guard blok nosi .more-tile + 3 vstopne anchorje (točno ×1 vsak); media guardov ostane TOČNO 3 (zamrznjen kanon r397 (A))', () => {
    const blok = vstopniBlok()
    for (const sel of [
      '.more-tile {',
      '.animate-fade-in-up {',
      '.slide-in-right {',
      '.stagger-children > * {',
    ]) {
      expect(blok.split(sel).length - 1, sel).toBe(1)
    }
    // .more-tile kanon: animation:none + opacity:1 (bajtno, r397 (D))
    expect(blok).toContain('.more-tile {\n      animation: none;\n      opacity: 1;\n    }')
    // .stagger-children > * NOSI opacity: 1 spremljevalca (statično opacity: 0 —
    // brez spremljevalca bi element ob animation: none ostal neviden)
    expect(blok).toContain('.stagger-children > * {\n      animation: none;\n      opacity: 1;\n    }')
    // celoten globals: ŠE VEDNO točno 3 media guardi (shake + tile/val 73 + val 72)
    expect(GS().split('@media (prefers-reduced-motion: reduce)').length - 1).toBe(3)
  })

  it('(B) ZAKLJUČEK: vsaka ne-interakcijska `animation:` deklaracija izven guardov ima guard ujemnega selektorja v prefers-reduced-motion bloku (strukturiran dokaz pokritosti)', () => {
    const css = GS().replace(/\/\*[\s\S]*?\*\//g, '')
    // 1) razreži media bloke (prefers-reduced-motion) — to so guardi
    const guardBlok: string[] = []
    const reMedia = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n  \}/g
    let m: RegExpExecArray | null
    while ((m = reMedia.exec(css)) !== null) guardBlok.push(m[1])
    expect(guardBlok.length).toBe(3)
    const guardi = guardBlok.join('\n')
    // 2) base deleklaracije: css BREZ guard blokov
    const brezGuardov = css.replace(reMedia, '')
    // 3) vse `animation: NAME ...` deklaracije z selektorjem nosilcem
    const deklaracije: Array<{ sel: string; ime: string }> = []
    const rePravilo = /(^|\n)([^\n{}@]+)\{([^{}]*)\}/g
    let p: RegExpExecArray | null
    while ((p = rePravilo.exec(brezGuardov)) !== null) {
      const sel = p[2].trim()
      const telo = p[3]
      const a = telo.match(/animation:\s*([a-zA-Z-]+)/)
      if (a) deklaracije.push({ sel, ime: a[1] })
    }
    // 4) vsak nosilec: :hover/:active = interaktivna družina (kanon val 69,
    //    dokumentirana meja); sicer MORA obstajati guard ujemnega selektorja
    const dovoljeniInteraktivni = new Set(['.btn-shine:hover::after'])
    const normaliziraj = (s: string) => s.replace(/\s+/g, ' ').trim()
    const guardSelektorji = new Set(
      [...guardi.matchAll(/(^\n?|\n)([^\n{}@]+)\{/g)].map((x) => normaliziraj(x[2])),
    )
    expect(deklaracije.length).toBeGreaterThanOrEqual(11) // disk resnica: 12 nosilcev
    for (const d of deklaracije) {
      if (dovoljeniInteraktivni.has(normaliziraj(d.sel))) continue
      expect(
        guardSelektorji.has(normaliziraj(d.sel)),
        `selektor ${d.sel} (animation: ${d.ime}) BREZ reduced-motion guarda`,
      ).toBe(true)
    }
    // 5) vstopni ime-slovar ostane (ustavimo gibanje, ne brišemo slovarja)
    expect(css).toContain('@keyframes fadeInUp')
    expect(css).toContain('@keyframes slideInRight')
  })

  it('(C) HEX CENZUS (stoječi stražar r396/r397 prevzame tudi ta runda): utilities še vedno TOČNO 7 dokumentiranih vrednosti — val 73 nič novih hex', () => {
    const hexi = new Set(hexIzUtilities())
    for (const h of hexi) {
      expect(DOKUMENTIRANI_HEX).toContain(h)
    }
    const prisotni = new Set(hexIzUtilities())
    for (const h of DOKUMENTIRANI_HEX) {
      expect(prisotni.has(h)).toBe(true)
    }
  })

  it('(D) DRUŽINA ŽIVA: disk resnica rabe — animate-fade-in-up ×55, slide-in-right ×14, stagger-children ×0 (slovarska para, iskreno — guard pokriva vse prihodnje rabe)', () => {
    const žetoni: Record<string, number> = {}
    const obišči = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const pot = join(dir, e.name)
        if (statSync(pot).isDirectory()) obišči(pot)
        else if (pot.endsWith('.tsx') || pot.endsWith('.ts')) {
          const t = readFileSync(pot, 'utf8')
          for (const c of ['animate-fade-in-up', 'slide-in-right', 'stagger-children']) {
            žetoni[c] = (žetoni[c] ?? 0) + (t.match(new RegExp(c.replace(/-/g, '\\-') + '(?![-\\w])', 'g')) ?? []).length
          }
        }
      }
    }
    obišči(join(process.cwd(), 'src', 'components'))
    obišči(join(process.cwd(), 'src', 'app'))
    expect(žetoni['animate-fade-in-up'] ?? 0).toBe(55)
    expect(žetoni['slide-in-right'] ?? 0).toBe(14)
    // slovarski par: definicija v globals.css, rabe ×0 — dokumentirano
    // tukaj, nič tihega (kanon disk-resnice R396 (6), vzorec r397 (E))
    expect(žetoni['stagger-children'] ?? 0).toBe(0)
  })

  it('(E) KOMPILIRANI CSS dokaz (ko .next obstaja): val 73 zliti vstopni guard ŽIVO + val 72 zliti guard bajtno nespremenjen — mtime-staleness iskren SKIP (LEKCIJA R397 (2))', () => {
    const chunkDir = join(process.cwd(), '.next', 'static', 'chunks')
    if (!existsSync(chunkDir)) {
      console.log('(E) .next ni zgrajen — preskočeno (build faza ga pokrije)')
      return
    }
    const buildId = join(process.cwd(), '.next', 'BUILD_ID')
    if (!existsSync(buildId)) {
      console.log('(E) BUILD_ID manjka — preskočeno (build faza ga pokrije)')
      return
    }
    const stale = statSync(buildId).mtimeMs < statSync(join(process.cwd(), 'src', 'app', 'globals.css')).mtimeMs
    if (stale) {
      console.log('(E) build je zastarel (pred val 73) — preskočeno; svež build + re-run dokazata')
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
    const vsebina = naji(chunkDir).map((f) => readFileSync(f, 'utf8'))
    const vse = vsebina.join('\n')
    // val 73: zliti vstopni guard (lightningcss zlije sosede z enakimi
    // deklaracijami — LEKCIJA R397 (3); .stagger-children ima drugačne
    // deklaracije (+opacity: 1) → ostane SAMOSTOJNO pravilo; ⭐ LEKCIJA
    // R398 (4): lightningcss SERIALIZIRA deklaracije v kanoničnem redu
    // (opacity PRED animation) — minificirana oblika ≠ vrstni red v src)
    expect(vse.split('.animate-fade-in-up,.slide-in-right{animation:none}').length - 1).toBe(1)
    expect(vse.split('.stagger-children>*{opacity:1;animation:none}').length - 1).toBe(1)
    // val 72: zliti guard BAJTNTO nespremenjen (med-stražarski roki —
    // era veriga r397.tsv needle se NE sme prelomiti z val 73)
    expect(vse.split('.badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,.animate-bounce-subtle{animation:none}').length - 1).toBe(1)
  })

  it('(F) MED-STRAŽARSKI roki (val 71 × val 72 × val 73): val 72 blok bajtno nedotaknjen (5 selektorjev ×1 + 5× animation:none) + scrollbar pariteta ostane ×1 + #475569', () => {
    const blok72 = val72Blok()
    for (const sel of ['.badge-pulse {', '.shine-effect::after {', '.animate-pulse-soft {', '.shimmer {', '.animate-bounce-subtle {']) {
      expect(blok72.split(sel).length - 1, sel).toBe(1)
    }
    expect((blok72.match(/animation: none;/g) ?? []).length).toBe(5)
    const css = GS()
    expect(css.split('.dark .scrollbar-thin::-webkit-scrollbar-thumb {').length - 1).toBe(1)
    const i = css.indexOf('.dark .scrollbar-thin::-webkit-scrollbar-thumb {')
    expect(css.slice(i, i + 260)).toContain('background-color: #475569;')
  })

  it('(G) MEJA DOKUMENTIRANA: interaktivna družina ostaja :hover-sprožena (kanon val 69) — btn-shine-sweep brez samostojnega guarda, keyframes slovar ostane cel', () => {
    const css = GS()
    // interaktivni sweep: :hover nosilec — uporabniško sproženo gibanje
    expect(css).toContain('.btn-shine:hover::after {\n    animation: btn-shine-sweep 0.6s ease-out forwards;\n  }')
    // slovarij keyframes vstopnih + kontinuiranih ostane (ustavimo gibanje,
    // ne brišemo slovarja — kanon r397 (B))
    for (const k of ['@keyframes badge-pulse-breathe', '@keyframes shine', '@keyframes pulse-soft', '@keyframes shimmer', '@keyframes bounce-subtle', '@keyframes roksalShake', '@keyframes tilePopIn']) {
      expect(css).toContain(k)
    }
    // besedilni val 73 komentar nosi izrecno dokumentirano mejo
    expect(css).toContain('val 73 (R398)')
    expect(css).toContain('kanon val 69')
  })
})
