// R316 — MANDATORY STIL val 7 STRAŽAR (r162/r308/R310/R311/R312/R313/R314/
// R315 vzorec): ZAKLJUČNI val surove amber harmonizacije — 5 dotikov v 4
// datotekah (fence-3d-viewer ×2 ikoni + notification-center ×1 ikona +
// signature-quote ×1 hint + photo-measure ×1 hint), 0 novih hex.
// ─────────────────────────────────────────────────────────────────
// GLOBALNI zaključni STRAŽAR: vsaka preostala surova amber vrstica v
// src/components/roksal + src/app mora biti V IZRECNEM zaklenjenem registru
// (semantični barvno kodirani sistemi — R308 lekcija; vsaka nova surova
// vrstica = fail). Kanon r310-api-telo-val3 GLOBALNI sken, prenesen na STIL.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SUROVA_AMBER = /amber-(50|100|200|300|400|500|600|700|800|900|950)\b/

// Zaklenjeni register: datoteka → seznam TRIMIRANIH vrstic (bajtno = vir).
const ZAKLENJENO: Record<string, string[]> = {
  // R319 (dekomp. faza 1) + R338 (dekomp. faza 3): measurements-tab izjeme
  // so se RAZDELILE na measurements/ mapo — pin SHIFT po kanonu
  // R180/R201/…/R314; skupno število zaklenjenih vrstic ostaja NATANKO 30
  // (7 v measurements družini; measurements-tab same ima 0 — vse preseljene).
  "src/components/roksal/measurements/labels.ts": [
    "les: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',"
  ],
  "src/components/roksal/measurements/format.ts": [
    "priporociloColor = 'text-amber-600 dark:text-amber-400'"
  ],
  "src/components/roksal/measurements/shared.ts": [
    "WPC: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',"
  ],
  "src/components/roksal/measurements/inline-inclinometer.tsx": [
    "<p className=\"text-center text-[11px] text-amber-600 dark:text-amber-400\">"
  ],
  "src/components/roksal/measurements/inline-kotomer.tsx": [
    "<p className=\"text-center text-[11px] text-amber-600 dark:text-amber-400\">"
  ],
  "src/components/roksal/crm-tab.tsx": [
    "POTENCIALEN: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',"
  ],
  "src/components/roksal/reference-gallery.tsx": [
    "case 'WPC': return 'bg-amber-600';"
  ],
  "src/components/roksal/quote-followup.tsx": [
    "//  • STIL pass: trdo kodirane svetle barve (bg-red-50, bg-amber-50, bg-white,"
  ],
  "src/components/roksal/onboarding-tour.tsx": [
    "barva: 'bg-amber-600',"
  ],
  "src/components/roksal/roksal-catalog.tsx": [
    "'WPC + ALU': { label: 'WPC+ALU', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200' },",
    "'WPC Panel': { label: 'WPC Panel', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200' },"
  ],
  "src/components/roksal/measurement-studio.tsx": [
    "DETECTED: { label: 'DETECTED', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800' },",
    "SCALE_REQUIRED: { label: 'SCALE_REQUIRED', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800' },",
    "cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',"
  ],
  "src/components/roksal/logistics-tab.tsx": [
    "V_TEKU: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',",
    "V_SERVISU: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',"
  ],
  "src/components/roksal/deal-pipeline.tsx": [
    "{ id: 'V_TEKU', label: 'V teku', icon: Hammer, dot: 'bg-amber-500', bar: 'border-l-amber-500', head: 'from-amber-100 dark:from-amber-500/15', over: 'ring-amber-400/70 dark:ring-amber-500/70' }, // R311 — kategorija barvni sistem (amber med orange/violet/blue sorodniki) IZRECNO izven harmonizacije (R308 lekcija)"
  ],
  "src/components/roksal/inclinometer-tab.tsx": [
    "<p className=\"text-center text-sm text-amber-600 dark:text-amber-400\">Ta naprava/brskalnik ne podpira senzorjev orientacije.</p>"
  ],
  "src/components/roksal/cv-studio.tsx": [
    "<span className=\"text-amber-600\">amber</span> = stopnice ·{' '}"
  ],
  "src/components/roksal/safety-tab.tsx": [
    "<div className=\"absolute top-0 bottom-0 w-px bg-amber-400/50\" style={{ left: '60%' }} />",
    "? 'bg-amber-500'"
  ],
  "src/components/roksal/photo-tab.tsx": [
    "{ id: 'MED', label: 'Med montažo', short: 'Med', cls: 'bg-amber-100 text-amber-800' },",
    "<div className=\"text-base font-bold text-amber-700\">{stats.med}</div>"
  ],
  "src/components/roksal/site-survey-tab.tsx": [
    "? 'border-amber-400 dark:border-amber-700 bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200'"
  ],
  "src/components/roksal/photo-measure.tsx": [
    "if (z >= 0.45) return { label: 'srednje zaupanje', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' as const }"
  ],
  "src/app/setup/setup-client.tsx": [
    "<div role=\"status\" className=\"rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-stone-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-stone-300\">"
  ],
  "src/app/portal/[token]/gallery.tsx": [
    "PRED: { label: '1', color: 'bg-amber-100 text-roksal-navy dark:bg-amber-500/15 dark:text-roksal-ink' },"
  ],
  "src/app/portal/[token]/page.tsx": [
    "bg: 'bg-amber-50 dark:bg-amber-950/40',",
    "ring: 'ring-amber-200 dark:ring-amber-800',",
    "<section className=\"rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40\">"
  ],
  // PIN SHIFT R374 (issue #13 R165): V5 signature-quote STATUS_BADGE.SUPERSEDED —
  // semantični statusni badge (SUPERSEDED = opozorilna zamenjava verzije),
  // isti vzorec kot measurement-studio STATE_BADGE lestvica.
  "src/components/roksal/signature-quote.tsx": [
    "SUPERSEDED: { label: 'Zamenjana', cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800' },"
  ]
}

// Razlogi (vsaka datoteka z izjemo IMA izrecno razlago — nič tihih izjem).
const RAZLOGI: Record<string, string> = {
  "src/components/roksal/measurements/labels.ts": "R311 — les kategorija barv (R338 dekomp. faza 3: preseljeno iz measurements-tab groundTypeColors)",
  "src/components/roksal/measurements/format.ts": "R311 — priporociloColor lestvica naklona (R338 dekomp. faza 3: preseljeno iz measurements-tab calculateStairDimensions)",
  "src/components/roksal/measurements/shared.ts": "R311 — WPC kategorija barv (R319 dekomp.: preseljeno iz measurements-tab)",
  "src/components/roksal/measurements/inline-inclinometer.tsx": "R311 — senzorjsko besedilo gola-text lestvica (R319 dekomp.: preseljeno)",
  "src/components/roksal/measurements/inline-kotomer.tsx": "R311 — senzorjsko besedilo gola-text lestvica (R319 dekomp.: preseljeno)",
  "src/components/roksal/crm-tab.tsx": "R234 — POTENCIALEN stanje (izrecno semantična kategorija)",
  "src/components/roksal/reference-gallery.tsx": "R231 — WPC material legenda (barvno kodiranje podatkov)",
  "src/components/roksal/quote-followup.tsx": "komentar-dokumentacija (ni UI rabe)",
  "src/components/roksal/onboarding-tour.tsx": "uvodni vodič — barvna paleta korakov (zaporedje barv)",
  "src/components/roksal/roksal-catalog.tsx": "WPC/WPC+ALU material legenda (barvno kodiranje podatkov, R231 precedens)",
  "src/components/roksal/measurement-studio.tsx": "R313 — STATE_BADGE stanja kakovosti (red/amber/green lestvica, issue #2 §4)",
  "src/components/roksal/logistics-tab.tsx": "R312 — STATUS_COLORS.V_TEKU + EQUIPMENT_STATUS_COLORS.V_SERVISU (semantični sistemi)",
  "src/components/roksal/deal-pipeline.tsx": "R311 — kategorija barvni sistem V_TEKU (amber med orange/violet/blue)",
  "src/components/roksal/inclinometer-tab.tsx": "R315 — senzorjska lestvica (denied=red / unsupported=amber)",
  "src/components/roksal/cv-studio.tsx": "R313 — legenda beseda (amber = stopnice)",
  "src/components/roksal/safety-tab.tsx": "varnostni prag marker + raven lestvice (red/amber/green)",
  "src/components/roksal/photo-tab.tsx": "R314 — MED faza (PRED blue / MED amber / PO green) + stats.med",
  "src/components/roksal/site-survey-tab.tsx": "R315 — PODLAGA kategorija barv (p.barva sistem)",
  "src/components/roksal/photo-measure.tsx": "zaupanje 3-nivojska lestvica (visoko green / srednje amber / nizko red)",
  "src/app/setup/setup-client.tsx": "setup warning vsebnik (semantični warning container — zunaj roksal lupine)",
  "src/app/portal/[token]/gallery.tsx": "portal faza PRED (PRED/MED/PO faze lestvica)",
  "src/app/portal/[token]/page.tsx": "portal warning/faza vsebniki (zunanja portal površina, semantična)",
  "src/components/roksal/signature-quote.tsx": "R374 — STATUS_BADGE.SUPERSEDED (V5 kanonične verzije: opozorilna zamenjena verzija, vzorec measurement-studio STATE_BADGE)"
}

function beriDrevo(dir: string, izhod: string[] = []): string[] {
  for (const ime of readdirSync(dir)) {
    const pot = join(dir, ime)
    const st = statSync(pot)
    if (st.isDirectory()) beriDrevo(pot, izhod)
    else if (/\.tsx?$/.test(ime)) izhod.push(pot)
  }
  return izhod
}

describe('r316 stil val 7 STRAŽAR — zaključni GLOBALNI register surove amber', () => {
  it('GLOBALNI: vsaka surova amber vrstica (roksal + app) je v zaklenjenem registru — nič neznanih', () => {
    const datoteke = [
      ...beriDrevo(join(process.cwd(), 'src/components/roksal')),
      ...beriDrevo(join(process.cwd(), 'src/app')),
    ]
    const nezgodbene: string[] = []
    let najdenihSkupaj = 0
    for (const pot of datoteke) {
      const rel = pot.slice(process.cwd().length + 1)
      const dovoljene = ZAKLENJENO[rel] ?? []
      const vrstice = readFileSync(pot, 'utf8')
        .split('\n')
        .filter((v) => SUROVA_AMBER.test(v) && !v.includes('roksal-amber'))
        .map((v) => v.trim())
      najdenihSkupaj += vrstice.length
      for (const v of vrstice) {
        if (!dovoljene.includes(v)) nezgodbene.push(rel + ': ' + v)
      }
    }
    // vsak registrski vnos SE RES NAHAJA v viru (zastarel test = fail)
    for (const [rel, dovoljene] of Object.entries(ZAKLENJENO)) {
      const vir = readFileSync(join(process.cwd(), rel), 'utf8')
      const vrstice = vir
        .split('\n')
        .filter((v) => SUROVA_AMBER.test(v) && !v.includes('roksal-amber'))
        .map((v) => v.trim())
      for (const d of dovoljene) {
        expect(vrstice.includes(d), rel + ': zaklenjena vrstica manjka (zastarel register): ' + d.slice(0, 60)).toBe(true)
      }
    }
    // PIN SHIFT R374: 30 → 31 (+signature-quote SUPERSEDED badge — V5)
    expect(najdenihSkupaj).toBe(31)
    expect(nezgodbene, 'nove surove amber vrstice IZVEN registra: ' + nezgodbene.join(' | ')).toEqual([])
  })

  it('vsaka datoteka z zaklenjenimi izjemami ima izrecno razlago', () => {
    for (const rel of Object.keys(ZAKLENJENO)) {
      expect(typeof RAZLOGI[rel], 'manjka razlog za ' + rel).toBe('string')
      expect(RAZLOGI[rel].length, 'prazna razlog za ' + rel).toBeGreaterThan(5)
    }
  })

  it('žetoni živi: 5 dotikov val 7 (2 ikoni + 1 ikona dark-par + 2 hint besedili)', () => {
    const beri = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
    const fence = beri('src/components/roksal/fence-3d-viewer.tsx')
    expect(fence).toContain('<AlertTriangle aria-hidden="true" className="h-8 w-8 text-roksal-amber" />')
    expect(fence).toContain('<Smartphone aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber" />')
    const notif = beri('src/components/roksal/notification-center.tsx')
    expect(notif).toContain('<AlertTriangle aria-hidden="true" className="h-3 w-3 shrink-0 text-roksal-amber" />')
    const sigq = beri('src/components/roksal/signature-quote.tsx')
    expect(sigq).toContain('<p className="text-center text-2xs text-roksal-ink">')
    const phm = beri('src/components/roksal/photo-measure.tsx')
    expect(phm).toContain('<p className="text-center text-[9px] text-roksal-ink">Za shranjevanje izberi projekt.</p>')
  })

  it('obrnjena regresija: starih 5 surovih vzorcev NI več v viru', () => {
    const beri = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
    expect(beri('src/components/roksal/fence-3d-viewer.tsx')).not.toContain('text-amber-400')
    expect(beri('src/components/roksal/fence-3d-viewer.tsx')).not.toContain('text-amber-500')
    expect(beri('src/components/roksal/notification-center.tsx')).not.toContain('text-amber-500 dark:text-amber-400')
    expect(beri('src/components/roksal/signature-quote.tsx')).not.toContain('text-2xs text-amber-600 dark:text-amber-400')
    expect(beri('src/components/roksal/photo-measure.tsx')).not.toContain('text-[9px] text-amber-600 dark:text-amber-400')
  })

  it('determinizem: konverzijska skripta je fail-closed in idempotentna (drugi tek = zarja)', () => {
    const vir = readFileSync(join(process.cwd(), 'scripts/r316-stil-val7.py'), 'utf8')
    expect(vir).toContain('sys.exit(1)')
    expect(vir).toContain('VAL 7 KONČAN — 5 dotikov')
  })
})
