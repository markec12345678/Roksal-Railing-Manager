// r401-color-scheme.test.ts — R401 FEATURE: TRINAJSTI STRAŽAR —
// COLOR-SCHEME DISCIPLINA (UA-nativne površine sledijo temi).
// Komplet varuhov: r385 (dark FB) + r386 (O2 pairing) + r387 (FB-border) +
// r388 (hover-barvna pokritost) + r389 (kaskadna disciplina) + r391
// (press-scale disciplina) + r392 (hover-transform/senčna disciplina) +
// r394 (outline/fokus disciplina) + r395 (tema-pariteta disciplina) + r396
// (HEX cenzus stoječi stražar) + r397 (gibanje-pariteta disciplina) + r398
// (zaključek pokritosti) + r399 (slovar-raba disciplina) + r400 (shimmer
// slovar-raba V UI).
//
// Disk resnica (val 75 triaža PRED val, kanon LEKCIJA R396 (5)):
//   color-scheme je bila ×0 v celotnem src/ drevesu — UA-nativne površine so
//   izrisovale SVETLO krom na temni temi (paritetna vrzel). Val 75 doda
//   EKSPlicitno razglasitev v obstoječa bloka (dodativno, 0 mutacij pravil):
//     :root  → color-scheme: light;   (izrecna svetla — 100 % determinizem,
//                                      nič UA-prislova)
//     .dark  → color-scheme: dark;    (nativni kontrolniki temno-nativno)
//   EFFEKTNЕ POVRŠINE (accent-color teh NE doseže — UA-lastno krom):
//     type="date"           ×9 (crm ×2 + vodja ×1 + logistika ×3 + foto ×2
//                             + sledenje ponudb ×1) — koledar popup + ikona
//     type="datetime-local" ×1 (logistika — dogodek) — koledar + čas
//     <select>              ×2 (foto-tab) — nativni seznam popup
//     type="range"          ×2 (foto ×1 + AR skener ×1) — sled/ročaj krom
//     autofill              — UA poudarek sledi shemi
//   ISKRENE MEJE: (1) checkboxi ×5 imajo IZRECEN accent-color (amber ×1 +
//   navy ×4) — ostanejo nespremenjeni (accent-color in color-scheme sta
//   ločeni plasti; meja dokumentirana); (2) val 71 scrollbar pariteta je
//   CUSTOM (::-webkit-scrollbar) — bajtno; (3) ključni besedi light/dark,
//   0 novih hex (hex cenzus 7 dokumentiranih — stoječi stražar); (4)
//   viz/** ZAŠČITENO jedro nič (kanon R167); (5) hybridna vrednost
//   „light dark" je PREPOVEDANA (dvoumna — determinizem zahteva eno
//   ključno besedo na blok).
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

/** vrstni red blokov: :root PRED .dark (kaskadna narava temnega prepisa). */
function blokPozicija(od: string, do_: string): { od: number; do_: number } {
  const css = GS()
  const a = css.indexOf(od)
  const b = css.indexOf(do_, a + 1)
  expect(a).toBeGreaterThan(0)
  expect(b).toBeGreaterThan(a)
  return { od: a, do_: b }
}

describe('R401 TRINAJSTI STRAŽAR — color-scheme disciplina (UA-nativne površine sledijo temi)', () => {
  it('(A) VAL 75 CSS anchorji: :root nosi eksplicitno `color-scheme: light;` ×1 + .dark nosi `color-scheme: dark;` ×1 (dodativno v obstoječa bloka — 0 novih pravilnih blokov)', () => {
    const css = GS()
    expect(css.split('color-scheme: light;').length - 1).toBe(1)
    expect(css.split('color-scheme: dark;').length - 1).toBe(1)
    // razglasitvi sta znotraj obstoječih blokov (med { in } pripadajočega bloka)
    const root = blokPozicija(':root {', '\n}')
    expect(css.slice(root.od, root.do_)).toContain('color-scheme: light;')
    const dark = blokPozicija('.dark {', '\n}')
    expect(css.slice(dark.od, dark.do_)).toContain('color-scheme: dark;')
  })

  it('(B) PARITETA POPOLNOST: točno 2 razglasitvi v celotnem CSS (nič tretjih strani); .dark blok pride PO :root (kaskadni vrstni red temnega prepisa); samo čisti ključi — nič hybridne „light dark" dvoumnosti', () => {
    const css = GS()
    expect(css.split(/color-scheme\s*:/).length - 1).toBe(2)
    const root = blokPozicija(':root {', '\n}')
    const dark = blokPozicija('.dark {', '\n}')
    expect(dark.od).toBeGreaterThan(root.od)
    expect(css).not.toContain('color-scheme: light dark')
    expect(css).not.toContain('color-scheme:dark light')
  })

  it('(C) HEX CENZUS (stoječi stražar r396–r400 prevzame tudi ta runda): utilities še vedno TOČNO 7 dokumentiranih vrednosti — val 75 nič novih hex (samo ključni besedi light/dark)', () => {
    const hexi = new Set(hexIzUtilities())
    for (const h of hexi) {
      expect(DOKUMENTIRANI_HEX).toContain(h)
    }
    const prisotni = new Set(hexIzUtilities())
    for (const h of DOKUMENTIRANI_HEX) {
      expect(prisotni.has(h)).toBe(true)
    }
  })

  it('(D) EFEKTNE POVRŠINE ŽIVE (disk resnica): type="date" ×9 (crm ×2, vodja ×1, logistika ×3, foto ×2, sledenje ×1) + datetime-local ×1 + select ×2 + range ×2 — vse imajo zdaj temno-nativno krom v .dark; checkboxi ×5 z izrecnim accentom ostanejo ločena plast (meja)', () => {
    const preberi = (f: string) => readFileSync(join(process.cwd(), 'src', 'components', 'roksal', f), 'utf8')
    const pričakovaniDatum: Array<[string, number]> = [
      ['crm-tab.tsx', 2],
      ['dashboard-tab.tsx', 1],
      ['logistics-tab.tsx', 3],
      ['photo-tab.tsx', 2],
      ['quote-followup.tsx', 1],
    ]
    let skupajDatum = 0
    for (const [f, n] of pričakovaniDatum) {
      const c = preberi(f).split('type="date"').length - 1
      expect(c, f).toBe(n)
      skupajDatum += c
    }
    expect(skupajDatum).toBe(9)
    expect(preberi('logistics-tab.tsx').split('type="datetime-local"').length - 1).toBe(1)
    expect(preberi('photo-tab.tsx').split('<select').length - 1).toBe(2)
    expect(preberi('photo-tab.tsx').split('type="range"').length - 1).toBe(1)
    expect(preberi('ar-scanner.tsx').split('type="range"').length - 1).toBe(1)
    // meja: checkboxi ×5 z izrecnim accent-color (amber ×1 + navy ×4)
    const survey = preberi('site-survey-tab.tsx')
    const logistics = preberi('logistics-tab.tsx')
    expect(survey.split('type="checkbox"').length - 1 + logistics.split('type="checkbox"').length - 1).toBe(5)
    expect(survey.split('accent-roksal-amber').length - 1).toBe(1)
    expect(logistics.split('accent-roksal-navy').length - 1).toBe(4)
  })

  it('(E) KOMPILIRANI CSS dokaz (ko .next obstaja): color-scheme:light ×1 + color-scheme:dark ×1 v build čankih + val 72/73 zlita guarda bajtno nespremenjena — mtime-staleness iskren SKIP (LEKCIJA R397 (2))', () => {
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
      console.log('(E) build je zastarel (pred val 75) — preskočeno; svež build + re-run dokazata')
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
    expect(vse.split('color-scheme:light').length - 1).toBeGreaterThanOrEqual(1)
    expect(vse.split('color-scheme:dark').length - 1).toBeGreaterThanOrEqual(1)
    // val 72: zliti guard BAJTNATO nespremenjen (era veriga r397.tsv NE sme
    // prelomiti z val 75 — med-stražarski roki)
    expect(vse.split('.badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,.animate-bounce-subtle{animation:none}').length - 1).toBe(1)
    // val 73: zliti vstopni guard BAJTNATO nespremenjen (era veriga r398.tsv)
    expect(vse.split('.animate-fade-in-up,.slide-in-right{animation:none}').length - 1).toBe(1)
  })

  it('(F) MED-STRAŽARSKI roki (val 72 × val 73 × val 71): val 72 blok bajtno (5 selektorjev ×1 + 5× animation:none) + vstopni blok bajtno (4 anchorji + media guardov TOČNO 3) + scrollbar pariteta #475569', () => {
    const css = GS()
    const i72 = css.indexOf('val 72 (R397)')
    expect(i72).toBeGreaterThan(0)
    const m72 = css.indexOf('@media (prefers-reduced-motion: reduce)', i72)
    expect(m72).toBeGreaterThan(0)
    const k72 = css.indexOf('/* Slide in from right */', m72)
    expect(k72).toBeGreaterThan(m72)
    const blok72 = css.slice(m72, k72)
    for (const sel of ['.badge-pulse {', '.shine-effect::after {', '.animate-pulse-soft {', '.shimmer {', '.animate-bounce-subtle {']) {
      expect(blok72.split(sel).length - 1, sel).toBe(1)
    }
    expect((blok72.match(/animation: none;/g) ?? []).length).toBe(5)
    const i73 = css.indexOf('.more-tile {')
    expect(i73).toBeGreaterThan(0)
    const m73 = css.indexOf('@media (prefers-reduced-motion: reduce)', i73)
    expect(m73).toBeGreaterThan(0)
    const k73 = css.indexOf('@keyframes pulse-soft', m73)
    expect(k73).toBeGreaterThan(m73)
    const blok73 = css.slice(m73, k73)
    for (const sel of ['.more-tile {', '.animate-fade-in-up {', '.slide-in-right {', '.stagger-children > * {']) {
      expect(blok73.split(sel).length - 1, sel).toBe(1)
    }
    expect(css.split('@media (prefers-reduced-motion: reduce)').length - 1).toBe(3)
    const i71 = css.indexOf('.dark .scrollbar-thin::-webkit-scrollbar-thumb {')
    expect(i71).toBeGreaterThan(0)
    expect(css.slice(i71, i71 + 260)).toContain('background-color: #475569;')
  })

  it('(G) MEJE DOKUMENTIRANE: val 75 komentar nosi efektne površine + determinizem; accent-color plast ločena; val 69 interaktivna meja ostaja; keyframes slovar cel (9 nosilcev)', () => {
    const css = GS()
    expect(css).toContain('val 75 (R401)')
    expect(css).toContain('COLOR-SCHEME PARITETA')
    expect(css).toContain('accent-color teh površin NE doseže')
    // val 69 interaktivna meja (kanon — ostane bajtno)
    expect(css).toContain('.btn-shine:hover::after {\n    animation: btn-shine-sweep 0.6s ease-out forwards;\n  }')
    // keyframes slovar ostane cel (kanon r398 (G) / r400 (G))
    for (const k of ['@keyframes badge-pulse-breathe', '@keyframes shine', '@keyframes pulse-soft', '@keyframes shimmer', '@keyframes bounce-subtle', '@keyframes roksalShake', '@keyframes tilePopIn', '@keyframes fadeInUp', '@keyframes slideInRight']) {
      expect(css).toContain(k)
    }
  })
})
