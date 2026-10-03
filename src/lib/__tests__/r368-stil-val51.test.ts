// r368-stil-val51.test.ts — R368 MANDATORY STIL val 51: ring OBLIKOVNA
// pariteta roksal-AMBER focus družine (per-barvni split kanon — navy =
// val 43–49, red = val 50, amber = val 51) + FEATURE e2e-lib dedup 8. val.
//
// Disk resnica (LEKCIJA R364 (4) — census iz diska scripts/r368-census.py):
//   31 žetona / 30 površin čez 11 datotek; PRED rundi: 14 O2 (vodja 13 +
//   crm 1), 3 × offset-1 (vodja 2093, inventory 1229, dashboard 1946),
//   13 × brez offseta. PO rundi: VSI nosijo focus-visible:ring-offset-2
//   (razcep števca = 0). In-place = 0 novih vrstic (wc -l kanon); 0 novih
//   hex (števci 12/1 — photo/vodja); aria/title ZAMRZNJENI (ring-only
//   runda — val 44–50 precedens).
//
// Stale pini PRED-scan → 25 pojavitev v 14 zamrznjenih skriptah shiftanih
// V ISTI RUNDI: inventory offset-1 pin ×14 (r243–r255 build-needles +
// r244-prod-qa) + notification izjema pin ×11 (r245–r255), vsak z žigom
// [PIN SHIFT R368 val 51: …]. r175 regex prefix pin PREŽIVI ([^"]* flex).
//
// FEATURE e2e-lib dedup 8. val: eb_sonda_navy_stetje — 3-poljni navy/40
// števec (mainNavy40 + mainOffset2 + mainBrezOffset) byte-identičen ×3 v
// r366-qa-spot B + r367-qa-spot A/B (md5 d1f0004c299648ab1ff88f06bdafc889
// nad 420-bajtnim oknom) — prag LEKCIJE R352 (×3) IZENAČEN; 1. uporaba v
// r368-qa-spot.sh V ISTI rundi (LEKCIJA R362 (3): kanon ne sme biti
// papir); zamrznjeni spot skripti NI mutirani (kanon R361–R367).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const R = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')
const pod = (src: string, needle: string): number =>
  (src.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
// LEKCIJA R367 (1): wc -l šteje \n znake — split('\n') da +1 ob končni
// prazni vrstici; guard mora šteti ISTO semantiko kot orodje (wc -l).
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const DATOTEKE = [
  ['roksal/inclinometer-tab.tsx', 599],
  ['roksal/dashboard-tab.tsx', 3188],
  ['roksal/measurements-tab.tsx', 6232],
  ['roksal/notification-center.tsx', 969],
  ['roksal/photo-tab.tsx', 2684],
  ['roksal/inventory-tab.tsx', 2299],
  ['roksal/vodja-dashboard.tsx', 2199],
  ['roksal/crm-tab.tsx', -1], // že pariteta (val 44) — split guard brez baseline
  ['viz/before-after.tsx', 217],
  ['viz/step-corners.tsx', 516],
  ['viz/viz-tab.tsx', 347],
] as const
const VIRI = DATOTEKE.map(([f]) => [f, R(`src/components/${f}`)] as const)

describe('r368 stil val 51 — amber OBLIKOVNA pariteta + e2e-lib dedup 8. val', () => {
  it('(A) PARITETA guard: vsaka vrstica z roksal-amber focus ringom nosi ring-offset-2 (razcep = 0; 30 površin) + barvni žigi nespremenjeni (/50=18, /40=6, /60=3, plain=4) + offset-1 = 0 na amber vrsticah', () => {
    let amberVrstic = 0
    for (const [f, src] of VIRI) {
      for (const [i, v] of src.split('\n').entries()) {
        if (!v.includes('focus-visible:ring-roksal-amber')) continue
        amberVrstic++
        expect(
          v.includes('focus-visible:ring-offset-2'),
          `${f}:${i + 1} amber brez offset-2`,
        ).toBe(true)
        expect(
          v.includes('ring-offset-1'),
          `${f}:${i + 1} amber še vedno offset-1`,
        ).toBe(false)
      }
    }
    // 31 žetonov na 30 vrsticah (notification 748 nosi /60 + dark:/40 na ISTI vrstici)
    expect(amberVrstic).toBe(30)
    const vse = VIRI.map(([, s]) => s).join('')
    expect(pod(vse, 'focus-visible:ring-roksal-amber/50')).toBe(18)
    expect(pod(vse, 'focus-visible:ring-roksal-amber/40')).toBe(6)
    expect(pod(vse, 'focus-visible:ring-roksal-amber/60')).toBe(3)
    // plain amber (brez poševnice) = 31 − 27 z opaciteto
    expect(pod(vse, 'focus-visible:ring-roksal-amber ')).toBe(4)
    // vodja blok glave 13× /50 (r339/r345 pin — nedotaknjen)
    const vodja = R('src/components/roksal/vodja-dashboard.tsx')
    expect(vodja.split('focus-visible:ring-roksal-amber/50').length - 1).toBe(13)
  })

  it('(B) era-diskriminatorji val 51: N1 ×1 / N2 ×3 / N3 ×2 / N4 ×2 (POJAVITVE grep -o — LEKCIJA R365 (2)) + izpuščena kandidata dokumentirano', () => {
    const vse = VIRI.map(([, s]) => s).join('')
    // N1: photo L740 — offset-2 MED barvo in outline-none (LEKCIJA R363)
    // [PIN SHIFT R385 val 63: FB amber + dark FB vstavljen MED offset-2 in
    // outline-none (val 57 kanon TIK ZA O2) — stari N1 adjacency = 0; N1
    // EVOLVED: nova adjacency vključuje FB+dark par — disk resnica ×1]
    expect(pod(vse, 'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 focus-visible:outline-none')).toBe(0)
    expect(pod(vse, 'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 focus-visible:border-roksal-amber/50 dark:focus-visible:border-roksal-amber/30 focus-visible:outline-none')).toBe(1)
    // N2: photo L2113/L2414 + notification L748
    expect(pod(vse, 'focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2')).toBe(3)
    // N3: measurements L3329/L3478
    // [PIN SHIFT R386 val 64: FB amber/40 + dark FB vstavljen MED offset-2
    // in outline-none na L3478 (val 57 kanon TIK ZA O2 — bordered tarča
    // val 64); L3329 (N/A, brez borderja) ohrani staro adjacency → stari
    // N3 diskriminator 2→1; N3 EVOLVED: nova adjacency vključuje FB+dark
    // par ×1 — disk resnica]
    expect(pod(vse, 'focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2 focus-visible:outline-none')).toBe(1)
    expect(pod(vse, 'focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2 focus-visible:border-roksal-amber/40 dark:focus-visible:border-roksal-amber/40 focus-visible:outline-none')).toBe(1)
    // N4: before-after L172 + viz-tab L125 (plain amber — poševnica bi bila lažni pozitiv)
    expect(pod(vse, 'outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2')).toBe(2)
    // izpuščen kandidat 1: inclinometer '/50 offset-2' NI ×0 v HEAD (vodja
    // ×13 prefix) — zato NI v registru, a pariteta je pokrita z (A):
    const inc = R('src/components/roksal/inclinometer-tab.tsx')
    expect(pod(inc, 'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2')).toBe(2)
    // izpuščen kandidat 2: step-corners 'transition-colors' plain variant ×1
    // — isti čanek/družina kot N4, redundanten (isti vzorec kot r366 izpuščeni):
    const sc = R('src/components/viz/step-corners.tsx')
    expect(pod(sc, 'transition-colors focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2')).toBe(1)
    expect(pod(sc, 'outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2')).toBe(0)
  })

  it('(C) stale pini shiftani V ISTI RUNDI: 14 × inventory offset-1→2 + 11 × notification izjema zaključena, vsi z žigom [PIN SHIFT R368 val 51] + r175 prefix pin preživi', () => {
    const needleSkripte = [
      'r243-build-needles.sh', 'r244-build-needles.sh', 'r245-build-needles.sh',
      'r246-build-needles.sh', 'r247-build-needles.sh', 'r248-build-needles.sh',
      'r249-build-needles.sh', 'r250-build-needles.sh', 'r251-build-needles.sh',
      'r252-build-needles.sh', 'r253-build-needles.sh', 'r254-build-needles.sh',
      'r255-build-needles.sh', 'r244-prod-qa.sh',
    ]
    const novInv = 'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 press-scale" "R243 Potrdi premik CTA mikro-pritisk [PIN SHIFT R368 val 51: offset-1→2 amber pariteta]"'
    for (const s of needleSkripte) {
      const src = R(`scripts/${s}`)
      expect(src.includes(novInv), `${s}: nov inventory pin manjka`).toBe(true)
      expect(src.includes('focus-visible:ring-offset-1 press-scale'), `${s}: star offset-1 pin še živ`).toBe(false)
    }
    const novObv = 'focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2 dark:focus-visible:ring-roksal-amber/40 active:scale-[0.98]" "R245 notification kartica [PIN SHIFT R368 val 51: offset-2 — izjema zaključena]"'
    for (const s of needleSkripte.slice(2, 13)) {
      const src = R(`scripts/${s}`)
      expect(src.includes(novObv), `${s}: nov notification pin manjka`).toBe(true)
      expect(src.includes('(dokumentirana izjema ostaja)'), `${s}: stara izjema še živa`).toBe(false)
    }
    // r175 regex prefix pin ([^"]* flex) preživi vstavitvi — dokumentirana
    // resnica: regex NI eksakten pin, zato NI potreboval shifta:
    const inc = R('src/components/roksal/inclinometer-tab.tsx')
    expect(
      inc.match(
        /className="[^"]*transition-colors hover:text-roksal-ink[^"]*"\s*\n\s*aria-label="Poskusi znova naložiti zgodovino nagibov"/,
      ),
    ).not.toBeNull()
  })

  it('(D) 0 novih hex s ŠTETJEM per datoteka + in-place vrstice (wcLinije — LEKCIJA R367 (1)) + aria/title ZAMRZNJENI', () => {
    const hexBaze: Array<[string, number]> = [
      ['roksal/inclinometer-tab.tsx', 0], ['roksal/dashboard-tab.tsx', 0],
      ['roksal/measurements-tab.tsx', 0], ['roksal/notification-center.tsx', 0],
      ['roksal/photo-tab.tsx', 12], ['roksal/inventory-tab.tsx', 0],
      ['roksal/vodja-dashboard.tsx', 1], ['roksal/crm-tab.tsx', -1],
      ['viz/before-after.tsx', 0], ['viz/step-corners.tsx', 0], ['viz/viz-tab.tsx', 0],
    ]
    for (const [f, baza] of hexBaze) {
      if (baza < 0) continue
      const src = R(`src/components/${f}`)
      // hex števec gre po NEŽELJENEM regexu direktno (pod() je za LITERALE —
      // escapal bi znakovne razrede in iskal literal; LEKCIJA R368)
      expect((src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, `${f} hex`).toBe(baza)
    }
    for (const [f, baza] of DATOTEKE) {
      if (baza < 0) continue
      expect(wcLinije(R(`src/components/${f}`)), `${f} vrstice`).toBe(baza)
    }
    const ariaTitle: Array<[string, number, number]> = [
      ['roksal/inclinometer-tab.tsx', 26, 2], ['roksal/dashboard-tab.tsx', 117, 22],
      ['roksal/measurements-tab.tsx', 182, 66], ['roksal/notification-center.tsx', 26, 6],
      ['roksal/photo-tab.tsx', 78, 6], ['roksal/inventory-tab.tsx', 57, 20],
      ['roksal/vodja-dashboard.tsx', 68, 34], ['viz/before-after.tsx', 12, 2],
      ['viz/step-corners.tsx', 21, 0], ['viz/viz-tab.tsx', 12, 1],
    ]
    for (const [f, aria, title] of ariaTitle) {
      const src = R(`src/components/${f}`)
      expect((src.match(/aria-[a-z]+=/g) ?? []).length, `${f} aria`).toBe(aria)
      expect((src.match(/title=/g) ?? []).length, `${f} title`).toBe(title)
    }
  })

  it('(E) FEATURE e2e-lib dedup 8. val: eb_sonda_navy_stetje ŽIV + IIFE invariant + prag ×3 dokaz iz zamrznjenih spotov + poraba v r368-qa-spot + zamrznjeni NI mutirani', () => {
    const E2ELIB = R('scripts/e2e-lib.sh')
    expect(E2ELIB).toContain('eb_sonda_navy_stetje()')
    // IIFE invariant (r231 lekcija): eval vrstica brez $pred je klican IIFE
    const evalVrstice = E2ELIB.split('\n').filter((l) => l.includes('agent-browser eval') && !l.includes('$pred'))
    expect(evalVrstice.length).toBeGreaterThan(0)
    for (const l of evalVrstice) {
      expect(l, `predikat ni IIFE: ${l.slice(0, 60)}…`).toContain('})()"')
    }
    // prag ×3 dokaz: 3-poljni segment byte-identičen v r366 B + r367 A + B
    const segment = "mainNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')).length"
    const r366 = R('scripts/r366-qa-spot.sh')
    const r367 = R('scripts/r367-qa-spot.sh')
    const seg = (src: string): string[] => {
      const out: string[] = []
      for (const m of src.matchAll(new RegExp(segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))) {
        out.push(src.slice(m.index, m.index + 420))
      }
      return out
    }
    const bloki = [...seg(r366), ...seg(r367)]
    expect(bloki.length).toBe(3) // prag LEKCIJE R352 IZENAČEN (×3)
    expect(new Set(bloki).size).toBe(1) // byte-identični
    // poraba ob 1. uporabi V ISTI rundi (LEKCIJA R362 (3)) — šteji KLICE
    // (vrstica = klic), ne omemb v komentarjih (LEKCIJA R368: pojavitve ≠ klici)
    const spot = R('scripts/r368-qa-spot.sh')
    expect((spot.match(/^eb_sonda_navy_stetje$/gm) ?? []).length).toBe(2) // 1 klic A + 1 klic B
    // zamrznjeni spot skripti NI mutirani (kanon R361–R367) — ne poznanajo
    // novega helperja, nosijo še inline bloka:
    expect(r366.includes('eb_sonda_navy_stetje')).toBe(false)
    expect(r367.includes('eb_sonda_navy_stetje')).toBe(false)
  })
})
