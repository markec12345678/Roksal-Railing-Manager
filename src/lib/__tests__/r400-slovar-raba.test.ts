// r400-slovar-raba.test.ts — R400 FEATURE: DVANAJSTI STRAŽAR — (KOLIZIJA #28
// preimenovanje R399→R400; njihova R399 [d8a76c5, §18 OBJECT STORAGE] =
// pristala resnica, bajtno; MOJI artefakti preimenovani)
// SLOVAR-RABA DISCIPLINA (slovarska para shimmer/bounce-subtle je dejansko
// V UI). Komplet varuhov: r385 (dark FB) + r386 (O2 pairing) + r387
// (FB-border) + r388 (hover-barvna pokritost) + r389 (kaskadna disciplina)
// + r391 (press-scale disciplina) + r392 (hover-transform/senčna
// disciplina) + r394 (outline/fokus disciplina) + r395 (tema-pariteta
// disciplina) + r396 (HEX cenzus stoječi stražar) + r397 (gibanje-pariteta
// disciplina) + r398 (zaključek pokritosti) + r399 (slovar-raba disciplina).
//
// Disk resnica (val 74 triaža PRED val, kanon LEKCIJA R396 (5)):
//   slovarska para z ×0 klicnimi mesti (iskreno dokumentirano v R397 (E) /
//   R398 (D)) je OBNOVJENA — kandidat 1 iz R398 handoverja, pot A
//   („uporabiti v UI (loading skeleti)"):
//     .shimmer              → ×7 TSX rab (vse ročno valjane skelet kartice:
//                             katalog ×1 + vodja ×1 + CRM ×1 + obvestila ×3
//                             + foto galerija ×1) — zamenja
//                             `animate-pulse … bg-muted`; gradient premik =
//                             jasnejši „nalaganje" signal; background:
//                             shorthand nadomesti bg-muted (brez kaskadne
//                             dvoumnosti — kanon R396 (2) besedne meje)
//     .animate-bounce-subtle → ×1 TSX raba (bottom-nav značka — pogojno
//                             montirana: badgeCount 0→N prehod remontira
//                             element in animacija se sproži naravno, brez
//                             JS ožičenja; enojni 0.3s, NI kontinuirana)
//   ISKRENE MEJE: (1) ui-kit Skeleton = FROZEN K1 (bg-accent animate-pulse
//   rounded-md) — bajtno, NI del skelet kartice družine; (2) animate-pulse
//   ×13 = busy/progress/ikon družina (uporabniško sproženo: izvoz, odjava,
//   AR točka, sinhronizacija … — NI idle skelet) — semantična meja; (3)
//   viz/** ZAŠČITENO jedro nič (kanon R167); (4) hex cenzus izključuje
//   komentarje (nauček R163).
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

/** val 72 blok: od komentarja 'val 72 (R397)' do zaključka media bloka
 *  (isti rez kot r397/r398 guardianja — med-stražarski roki). */
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

/** vstopni val 73 blok (isti rez kot r398 guardian (A) — era veriga). */
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

describe('R400 DVANAJSTI STRAŽAR — slovar-raba disciplina (shimmer/bounce-subtle V UI)', () => {
  it('(A) VAL 74 TSX anchorji: skelet kartice družina = .shimmer (×7: katalog, vodja, CRM, obvestila ×3, foto) + .animate-bounce-subtle (×1 bottom-nav značka); 0 preostalih `animate-pulse … bg-muted` skeletov', () => {
    const pričakovani: Array<{ datoteka: string; žeton: string; n: number }> = [
      { datoteka: 'roksal-catalog.tsx', žeton: 'h-28 shimmer rounded-lg', n: 1 },
      { datoteka: 'vodja-dashboard.tsx', žeton: 'h-24 shimmer rounded-lg', n: 1 },
      { datoteka: 'crm-tab.tsx', žeton: 'h-24 shimmer rounded-lg', n: 1 },
      { datoteka: 'notification-center.tsx', žeton: 'shimmer rounded', n: 3 },
      { datoteka: 'photo-tab.tsx', žeton: 'aspect-square shimmer rounded-lg', n: 1 },
      { datoteka: 'bottom-nav.tsx', žeton: 'animate-bounce-subtle absolute -top-0.5', n: 1 },
    ]
    for (const p of pričakovani) {
      const t = readFileSync(join(process.cwd(), 'src', 'components', 'roksal', p.datoteka), 'utf8')
      expect(t.split(p.žeton).length - 1, `${p.datoteka}: ${p.žeton}`).toBe(p.n)
    }
    // skelet družina POPOLNOST: 0 ročno valjanih skeletov še nosi stari vzorec
    for (const stari of ['animate-pulse rounded-lg bg-muted', 'animate-pulse rounded bg-muted']) {
      const celo = [join(process.cwd(), 'src', 'components'), join(process.cwd(), 'src', 'app')]
      let najdeni = 0
      const obišči = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const pot = join(dir, e.name)
          if (statSync(pot).isDirectory()) obišči(pot)
          else if (pot.endsWith('.tsx')) najdeni += readFileSync(pot, 'utf8').split(stari).length - 1
        }
      }
      for (const d of celo) obišči(d)
      expect(najdeni, `stari skelet vzorec "${stari}" še ŽIVE`).toBe(0)
    }
  })

  it('(B) SLOVAR NESELJEN: @keyframes shimmer + bounce-subtle + definiciji ostaneeta (ustavimo/posvojimo rabo, ne brišemo slovarja — kanon r397 (B)); .shimmer nosi background-size 200% + 1.5s infinite', () => {
    const css = GS()
    for (const k of ['@keyframes shimmer', '@keyframes bounce-subtle']) {
      expect(css).toContain(k)
    }
    expect(css).toContain('.animate-bounce-subtle {\n    animation: bounce-subtle 0.3s ease-in-out;\n  }')
    // .shimmer definicija: gradient + background-size + infinite (slovar)
    const i = css.indexOf('.shimmer {')
    expect(i).toBeGreaterThan(0)
    const rez = css.slice(i, i + 420)
    expect(rez).toContain('background-size: 200% 100%;')
    expect(rez).toContain('animation: shimmer 1.5s ease-in-out infinite;')
    // val 74 komentar nosi izrecno dokumentacijo adoptiona + mej
    expect(css).toContain('val 74 (R399)')
    expect(css).toContain('SLOVAR-RABA')
    expect(css).toContain('FROZEN K1')
  })

  it('(C) HEX CENZUS (stoječi stražar r396/r397/r398 prevzame tudi ta runda): utilities še vedno TOČNO 7 dokumentiranih vrednosti — val 74 nič novih hex (samo TSX className raba + komentar)', () => {
    const hexi = new Set(hexIzUtilities())
    for (const h of hexi) {
      expect(DOKUMENTIRANI_HEX).toContain(h)
    }
    const prisotni = new Set(hexIzUtilities())
    for (const h of DOKUMENTIRANI_HEX) {
      expect(prisotni.has(h)).toBe(true)
    }
  })

  it('(D) DRUŽINA ŽIVA — disk resnica rabe: shimmer ×7 + animate-bounce-subtle ×1 (slovarska para NI več ×0 — GLASNO obnovljeno); semantična meja: animate-pulse ×14 ostane (×1 ui-kit FROZEN K1 + ×13 busy/progress/ikon)', () => {
    const žetoni: Record<string, number> = {}
    const datoteke: string[] = []
    const obišči = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const pot = join(dir, e.name)
        if (statSync(pot).isDirectory()) obišči(pot)
        else if (pot.endsWith('.tsx') || pot.endsWith('.ts')) {
          datoteke.push(pot)
          const t = readFileSync(pot, 'utf8')
          for (const c of ['shimmer', 'animate-bounce-subtle']) {
            žetoni[c] = (žetoni[c] ?? 0) + (t.match(new RegExp(c.replace(/-/g, '\\-') + '(?![-\\w])', 'g')) ?? []).length
          }
        }
      }
    }
    obišči(join(process.cwd(), 'src', 'components'))
    obišči(join(process.cwd(), 'src', 'app'))
    expect(žetoni['shimmer'] ?? 0).toBe(7)
    expect(žetoni['animate-bounce-subtle'] ?? 0).toBe(1)
    // semantična meja: animate-pulse (brez -soft) ×14 — ui-kit skeleton.tsx
    // ×1 FROZEN K1 + busy/progress/ikon družina ×13 (uporabniško sproženo,
    // NI idle skelet) — ostane animate-pulse, dokumentirano, nič tihega
    let pulse = 0
    let uiKitPulse = 0
    for (const f of datoteke) {
      const t = readFileSync(f, 'utf8')
      const n = (t.match(/animate\-pulse(?![-\w])/g) ?? []).length
      pulse += n
      if (f.endsWith(join('ui', 'skeleton.tsx'))) uiKitPulse += n
    }
    expect(pulse).toBe(14)
    expect(uiKitPulse).toBe(1)
    expect(readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'skeleton.tsx'), 'utf8')).toContain('bg-accent animate-pulse rounded-md')
  })

  it('(E) KOMPILIRANI CSS dokaz (ko .next obstaja): .shimmer + .animate-bounce-subtle pravili ŽIVA + val 72/73 zlita guarda bajtno nespremenjena — mtime-staleness iskren SKIP (LEKCIJA R397 (2))', () => {
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
      console.log('(E) build je zastarel (pred val 74) — preskočeno; svež build + re-run dokazata')
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
    const vse = naji(chunkDir).map((f) => readFileSync(f, 'utf8')).join('\n')
    // slovarski pravili ostajeta (raba se je spremenila, slovar NE)
    expect(vse.split('.shimmer{').length - 1).toBeGreaterThanOrEqual(1)
    expect(vse.split('.animate-bounce-subtle{').length - 1).toBeGreaterThanOrEqual(1)
    // val 72: zliti guard BAJTNATO nespremenjen (era veriga r397.tsv NE sme
    // prelomiti z val 74 — med-stražarski roki)
    expect(vse.split('.badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,.animate-bounce-subtle{animation:none}').length - 1).toBe(1)
    // val 73: zliti vstopni guard BAJTNATO nespremenjen (era veriga r398.tsv)
    expect(vse.split('.animate-fade-in-up,.slide-in-right{animation:none}').length - 1).toBe(1)
  })

  it('(F) MED-STRAŽARSKI roki (val 72 × val 73): val 72 blok bajtno (5 selektorjev ×1 + 5× animation:none) + vstopni blok bajtno (4 anchorji + media guardov TOČNO 3) + scrollbar pariteta #475569', () => {
    const blok72 = val72Blok()
    for (const sel of ['.badge-pulse {', '.shine-effect::after {', '.animate-pulse-soft {', '.shimmer {', '.animate-bounce-subtle {']) {
      expect(blok72.split(sel).length - 1, sel).toBe(1)
    }
    expect((blok72.match(/animation: none;/g) ?? []).length).toBe(5)
    const blok73 = vstopniBlok()
    for (const sel of ['.more-tile {', '.animate-fade-in-up {', '.slide-in-right {', '.stagger-children > * {']) {
      expect(blok73.split(sel).length - 1, sel).toBe(1)
    }
    expect(GS().split('@media (prefers-reduced-motion: reduce)').length - 1).toBe(3)
    const css = GS()
    const i = css.indexOf('.dark .scrollbar-thin::-webkit-scrollbar-thumb {')
    expect(i).toBeGreaterThan(0)
    expect(css.slice(i, i + 260)).toContain('background-color: #475569;')
  })

  it('(G) MEJE DOKUMENTIRANE: bounce-subtle = pogojno montirana značka (enojni 0.3s, mount-sprožen — brez JS ožičenja); shimmer = idle skelet družina (busy/progress ostaja animate-pulse); val 69 interaktivna meja ostaja', () => {
    const css = GS()
    // val 69 interaktivna meja (kanon — ostane bajtno)
    expect(css).toContain('.btn-shine:hover::after {\n    animation: btn-shine-sweep 0.6s ease-out forwards;\n  }')
    // val 74 komentar nosi semantično ločnico idle-skelet vs busy/progress
    expect(css).toContain('busy/progress/ikon družina')
    expect(css).toContain('NI idle skelet')
    // keyframes slovar ostane cel (12 nosilcev + slovar — kanon r398 (G))
    for (const k of ['@keyframes badge-pulse-breathe', '@keyframes shine', '@keyframes pulse-soft', '@keyframes shimmer', '@keyframes bounce-subtle', '@keyframes roksalShake', '@keyframes tilePopIn', '@keyframes fadeInUp', '@keyframes slideInRight']) {
      expect(css).toContain(k)
    }
    // značka pogojna montira (disk resnica — mount-sprožena animacija)
    const bn = readFileSync(join(process.cwd(), 'src', 'components', 'roksal', 'bottom-nav.tsx'), 'utf8')
    expect(bn).toContain('badgeCount !== undefined && badgeCount > 0 && (')
    expect(bn).toContain('animate-bounce-subtle')
  })
})
