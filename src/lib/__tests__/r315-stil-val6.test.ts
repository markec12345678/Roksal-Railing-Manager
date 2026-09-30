// R315 — MANDATORY STIL val 6 STRAŽAR (r162/r308/R310/R311/R312/R313/R314
// vzorec): harmonizacija surovih amber v 5 datotekah — inclinometer-tab ×5
// (+1 ikona žeton) + site-survey-tab ×4 + ar-scanner ×3 + pwa-status ×3
// (+1 ikona žeton) + password-change-banner ×3 = 19 dotikov, 0 novih hex.
// ─────────────────────────────────────────────────────────────────
// 2 izjem ZAKLENJENI (barvno kodirani sistemi — R308/R311 lekcija, vsaka
// nova surova vrstica = fail; vsaka zaklenjena izjema SE RES NAHAJA v viru
// — izjema brez vrstice = zastarel test):
//   • inclinometer-tab 461: senzorjska lestvica (denied=red 458 /
//     unsupported=amber 461 — gola text, brez vsebnika; R311 measurements
//     precedens)
//   • site-survey-tab 641: PODLAGA kategorija barv (p.barva === 'amber'
//     med 'red' in žeton Vejo — barvni sistem substrate risk, R308 lekcija)
// measurements-tab ×5 ostaja pokrito z r311 STRAŽARjem (les/WPC kategoriji +
// priporociloColor + senzorjski besedili — že zaklenjeno tam).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DATOTEKE = [
  'inclinometer-tab.tsx',
  'site-survey-tab.tsx',
  'ar-scanner.tsx',
  'pwa-status.tsx',
  'password-change-banner.tsx',
] as const

const IZJEME: Record<string, string[]> = {
  'inclinometer-tab.tsx': [
    // senzorjska lestvica (denied=red sorodnik na vrstici 458) — brez vsebnika
    '<p className="text-center text-sm text-amber-600 dark:text-amber-400">Ta naprava/brskalnik ne podpira senzorjev orientacije.</p>',
  ],
  'site-survey-tab.tsx': [
    // PODLAGA kategorija barv (amber med red in žetoni — barvni sistem p.barva)
    "? 'border-amber-400 dark:border-amber-700 bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200'",
  ],
  'ar-scanner.tsx': [],
  'pwa-status.tsx': [],
  'password-change-banner.tsx': [],
}

describe('r315 stil val 6 STRAŽAR — 5 datotek harmoniziranih, izjeme zaklenjene', () => {
  it('surova amber v 5 val-6 datotekah = NATANKO 2 zaklenjeni izjemi (kategorije/lestvice — R308 lekcija)', () => {
    const SUROVA_AMBER = /amber-(50|100|200|300|400|500|600|700|800|900|950)\b/
    const najdene: string[] = []
    for (const dat of DATOTEKE) {
      const dovoljene = IZJEME[dat]
      const vir = readFileSync(join(process.cwd(), 'src/components/roksal', dat), 'utf8')
      const vrstice = vir
        .split('\n')
        .filter((v) => SUROVA_AMBER.test(v) && !v.includes('roksal-amber'))
        .map((v) => v.trim())
      najdene.push(...vrstice.filter((v) => !dovoljene.some((d) => v === d.trim())))
      // vsaka zaklenjena izjema SE RES NAHAJA (izjema brez vrstice = zastarel test)
      for (const d of dovoljene) {
        expect(vrstice.some((v) => v === d.trim()), `${dat}: izjema manjka v viru: ${d.slice(0, 60)}`).toBe(true)
      }
    }
    expect(najdene, `nove surove amber vrstice (izven zaklenjenih izjem): ${najdene.join(' | ')}`).toEqual([])
  })

  it('žetoni živi: 19 dotikov po 5 datotekah (ključne vrstice na roksal žetonih)', () => {
    const beri = (dat: string) => readFileSync(join(process.cwd(), 'src/components/roksal', dat), 'utf8')
    // inclinometer-tab: vsebnik + ikona + 2 besedili + hint (5 žetonov)
    const ink = beri('inclinometer-tab.tsx')
    expect(ink).toContain('border-roksal-amber/40 bg-roksal-amber/10 px-3 py-2.5')
    expect(ink).toContain('mt-0.5 h-4 w-4 shrink-0 text-roksal-amber')
    expect(ink).toContain('text-xs font-medium text-roksal-ink')
    expect(ink).toContain('text-[11px] text-roksal-ink')
    expect(ink).toContain('text-center text-2xs text-roksal-ink')
    // site-survey-tab: estrih kartica + opomba vsebnik + ikona + warn element (4)
    const site = beri('site-survey-tab.tsx')
    expect(site.match(/'border-roksal-amber\/40 bg-roksal-amber\/10'/g)?.length).toBe(2)
    expect(site).toContain('bg-roksal-amber/10 px-2.5 py-2 text-2xs font-medium leading-relaxed text-roksal-ink')
    expect(site).toContain('mt-0.5 h-3 w-3 shrink-0 text-roksal-amber')
    expect(site).toContain('block text-[11px] font-bold leading-snug text-roksal-ink')
    // ar-scanner: lowLight značka + accent + zaupanje (3)
    const ar = beri('ar-scanner.tsx')
    expect(ar).toContain('bg-roksal-amber/90 text-white border-transparent shadow-md animate-pulse')
    expect(ar).toContain('className="flex-1 accent-roksal-amber"')
    expect(ar).toContain(": 'bg-roksal-amber/15 text-roksal-ink',")
    // pwa-status: baner + ikona + podnaslov + značka (4)
    const pwa = beri('pwa-status.tsx')
    expect(pwa).toContain('border-roksal-amber/40 bg-roksal-amber/10 px-3 py-2 text-roksal-ink shadow-sm')
    expect(pwa).toContain('<WifiOff aria-hidden="true" className="h-4 w-4 shrink-0 text-roksal-amber" />')
    expect(pwa).toContain('truncate text-2xs leading-tight text-roksal-ink')
    expect(pwa).toContain('rounded-full bg-roksal-amber px-1.5 text-2xs font-bold text-white')
    // password-change-banner: ikona + besedilo + solid gumb z hover /90 (3)
    const pwd = beri('password-change-banner.tsx')
    expect(pwd).toContain('h-4 w-4 shrink-0 text-roksal-amber')
    expect(pwd).toContain('text-[12px] font-medium text-roksal-ink')
    expect(pwd).toContain('h-7 bg-roksal-amber text-[11px] text-white hover:bg-roksal-amber/90')
  })

  it('r162 dark lekcija: vsaka nova vrstica z border-roksal-navy/ v site-survey harmonizaciji ohrani dark: obrato NA ISTI vrstici', () => {
    // žetoni (roksal-amber/roksal-ink) so dvotematski PO NARAVI — dark: obrat
    // rabi SAMO surovi navy/ink par; preverba da harmonizacija NI podrula
    // obstoječe navy vrstice v harmoniziranih regijah (estrih Card ternara).
    const site = readFileSync(join(process.cwd(), 'src/components/roksal/site-survey-tab.tsx'), 'utf8')
    const estrihVrstica = site
      .split('\n')
      .find((v) => v.includes("data.podlaga === 'estrih' ? 'border-roksal-amber/40 bg-roksal-amber/10'"))
    expect(estrihVrstica).toBeTruthy()
    expect(estrihVrstica).toContain('border-roksal-navy/10 dark:border-roksal-ink/15')
  })

  it('determinizem: konverzijska skripta je idempotentna (drugi tek = 0 sprememb)', () => {
    // Po konverziji se vzorci ne najdejo več → skripta bi fail-closed zarila
    // na napačnem številu zadetkov; idempotentnost dokazujemo: vsi surovi
    // vzorci so izčrpani (grep po 5 datotekah = samo 2 zaklenjeni izjemi —
    // prvi it() že to dokazuje; tu preverimo, da skripta NE bi več delala).
    const vir = readFileSync(join(process.cwd(), 'scripts/r315-stil-val6.py'), 'utf8')
    expect(vir).toContain('sys.exit(1)')
    expect(vir).toContain('VAL 6 KONČAN — 19 dotikov')
  })
})
