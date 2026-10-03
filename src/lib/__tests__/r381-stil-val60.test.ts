// r381-stil-val60.test.ts — R381 MANDATORY STIL val 60: NATIVNI
// PREHOD-PARITETNI ZAKLJUČEK (11 × INS na 8 vrsticah, in-place, 0 novih
// vrstic; kanon R380 handover kandidat 1 (runda R381 po KOLIZIJI #22) — B/transition-colors družina,
// nativni <button> triaža po kanonu val 58).
//
// Disk resnica rundi (r380-triaza.py — 170 vrstic obeh barvnih družin):
//  - 154 × <Button>  → transition-all IZ BAZE (ui/button.tsx L8) → N/A;
//  -     3 × <button> → NATIVNI GAP → val 58 kanon INS ' transition-colors'
//      PRED 'focus-visible:ring-2' (audit-trail L310, measurements L4020,
//      photo L2370 — vsi navy);
//  -     5 × DropdownMenuItem (top-bar 3 navy + 2 red) → base
//      (ui/dropdown-menu.tsx) NIMA transition → INS ' transition-colors';
//      navy itemi INORE ' focus-visible:ring-offset-2' (val 52 pairing
//      kanon — meni-notranja pariteta z rdečima sestro iz val 59);
//  -     8 × input/textarea/Input → FROZEN izjema #2 (kanon R377 —
//      besedilna polja, zamrznjen števec);
//  - REGISTER EVOLUCIJA (kanon r371 N3 / R377): val 60 evoluiral r379
//    needle #1 (top-bar CMP par) → stara vrstica KOMENTIRANA 'EVOLVED
//    R381 val 60' + NASLEDNICA need_static (števec 4 NESPREMENJEN);
//  - in-place (0 novih vrstic), 0 novih hex, 0 novih aria/title.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const R = (f: string): string => readFileSync(join(process.cwd(), 'src/components', f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const RING2 = 'focus-visible:ring-2'
const NAVY = 'focus-visible:ring-roksal-navy/40'
const RED = 'focus-visible:ring-roksal-red/40'
const O2 = 'focus-visible:ring-offset-2'
const TRANS = 'transition-colors'
const NAVY_KANON = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'

describe('R381 stil val 60 — nativni prehod-paritetni zaključek (11 × INS, val 58 kanon + val 52 pairing)', () => {
  it('(A) TRANS PARITETA: signaturne vrstice (transition-colors TIK PRED ring-2 + navy|red/40) per tarčna datoteka — val 60 jih je dvignilo z 0→1 (audit), 4→5 (measurements), 0→1 (photo), 0→5 (top-bar) + zamrznjeni števci (vrstice/hex/aria/title)', () => {
    const TARČE = [
      { f: 'roksal/audit-trail-dialog.tsx', vrstice: 344, hex: 0, aria: 4, title: 1, n: 1 },
      { f: 'roksal/measurements-tab.tsx', vrstice: 6232, hex: 0, aria: 48, title: 66, n: 5 },
      { f: 'roksal/photo-tab.tsx', vrstice: 2684, hex: 12, aria: 17, title: 6, n: 1 },
      { f: 'roksal/top-bar.tsx', vrstice: 282, hex: 0, aria: 4, title: 4, n: 5 },
    ]
    const SIGNATURA = TRANS + ' ' + RING2
    for (const { f, vrstice, hex, aria, title, n } of TARČE) {
      const src = R(f)
      const lines = src.split('\n')
      const zadete = lines
        .map((_, i) => i + 1)
        .filter((ln) => {
          const v = lines[ln - 1]
          return v.includes(SIGNATURA) && (v.includes(NAVY) || v.includes(RED))
        })
      expect(zadete.length, `${f} število val 60 vrstic (natančno — tuje TRANS vrstice izključene)`).toBe(n)
      for (const ln of zadete) {
        const v = lines[ln - 1]
        expect(v.indexOf(SIGNATURA), `${f}:${ln} signatura prisotna`).toBeGreaterThanOrEqual(0)
      }
      expect(wcLinije(src), `${f} in-place vrstice`).toBe(vrstice)
      expect((src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, `${f} hex`).toBe(hex)
      expect(pod(src, 'aria-label='), `${f} aria`).toBe(aria)
      expect(pod(src, 'title='), `${f} title`).toBe(title)
    }
  })

  it('(B) TOP-BAR MENI PARITETA: 3 navy itemi z evolved kanonom (gap-2 + TRANS + ring-2 + navy/40 + O2) in 2 rdeča itema z evolved kanonom (gap-2 + TRANS + ring-2 + red/40 + O2) — stara oblika ×0', () => {
    const TB = R('roksal/top-bar.tsx')
    const NAVY_EVOLVED = 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const RED_EVOLVED = 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
    expect(pod(TB, NAVY_EVOLVED), 'top-bar navy itemi ×3').toBe(3)
    expect(pod(TB, RED_EVOLVED), 'top-bar red itemi ×2').toBe(2)
    // stara oblika (brez TRANS) — ×0 po val 60 (meni-notranja pariteta dokazana v OBEH smeri)
    expect(pod(TB, 'gap-2 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"'), 'stara navy ×0').toBe(0)
    expect(pod(TB, 'gap-2 focus-visible:ring-2 focus-visible:ring-roksal-red/40'), 'stara red ×0').toBe(0)
    // red O2-pariteta iz val 59 ostaja (nikoli dotaknjena med RED in O2)
    expect(pod(TB, RED + ' ' + O2), 'red/40 + O2 sosledje ostaja').toBe(2)
  })

  it('(C) NATIVNI GUMBI EVOLVED: audit/measurements/photo vsak nosi val 60 evolved podniz ×1; pre-val podniz ×0', () => {
    const AUDIT_EVOLVED = 'hover:text-roksal-ink focus-visible:outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40'
    const MERITVE_EVOLVED = 'flex-1 text-left min-w-0 focus-visible:outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40'
    const PHOTO_EVOLVED = 'hover:bg-muted hover:text-roksal-ink transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40'
    expect(pod(R('roksal/audit-trail-dialog.tsx'), AUDIT_EVOLVED)).toBe(1)
    expect(pod(R('roksal/measurements-tab.tsx'), MERITVE_EVOLVED)).toBe(1)
    expect(pod(R('roksal/photo-tab.tsx'), PHOTO_EVOLVED)).toBe(1)
    // pre-val oblike ×0 (idempotenca)
    expect(pod(R('roksal/audit-trail-dialog.tsx'), 'hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2')).toBe(0)
    expect(pod(R('roksal/measurements-tab.tsx'), 'min-w-0 focus-visible:outline-none focus-visible:ring-2')).toBe(0)
    expect(pod(R('roksal/photo-tab.tsx'), 'hover:bg-muted hover:text-roksal-ink focus-visible:ring-2')).toBe(0)
  })

  it('(D) FROZEN IZJEMA #2: besedilna polja ostajajo bajtno nespremenjena — natančni podnizi po vrsti (inventory Input ×1+×3, logistics native input ×1+×3, textarea ×1, catalog Input ×1)', () => {
    const INV = R('roksal/inventory-tab.tsx')
    expect(pod(INV, 'tabular-nums focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')).toBe(1)
    // [PIN SHIFT R382 val 61 / EVOLVED: L2121 + L2272 = <Button variant="outline"> (border iz baze) —
    // val 61 INS ' focus-visible:border-roksal-navy/40' ZA O2; L2226 = <Input> ostaja FROZEN izjema #2.]
    expect(pod(INV, 'className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"')).toBe(1)
    expect(pod(INV, 'className="focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40"')).toBe(2) // [PIN SHIFT R382 val 61: dark polovica]
    const LOG = R('roksal/logistics-tab.tsx')
    expect(pod(LOG, 'mt-0.5 h-3.5 w-3.5 accent-roksal-navy focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')).toBe(3)
    expect(pod(LOG, 'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')).toBe(1)
    const KAT = R('roksal/roksal-catalog.tsx')
    expect(pod(KAT, 'h-10 pl-9 focus-visible:ring-2 focus-visible:ring-roksal-navy/40')).toBe(1)
  })

  it('(E) OBRNJENA REGRESIJA: val 59 KANON ×25 + N1–N4 needleji ×1 + val 58 transition-colors + NAVY_KANON + amber/50 100% — vse nedotaknjeno', () => {
    const KANON = 'focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
    let kanoni = 0
    const koren = join(process.cwd(), 'src/components/roksal')
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      kanoni += pod(readFileSync(join(koren, z), 'utf-8'), KANON)
    }
    expect(kanoni, 'rdeča družina kanonov (val 59 resnica)').toBe(25)
    // val 55 N1–N4 (podnizi iz r379 (E) — nedotaknjeni)
    expect(pod(R('roksal/dashboard-tab.tsx'), 'animate-fade-in-up cursor-pointer transition-colors hover:bg-roksal-red/10')).toBe(1)
    expect(pod(R('roksal/vodja-dashboard.tsx'), 'shadow-sm animate-fade-in-up transition-colors hover:bg-roksal-red/10')).toBe(1)
    expect(pod(R('roksal/measurements-tab.tsx'), 'p-1.5 rounded-lg hover:bg-roksal-red/10')).toBe(1)
    expect(pod(R('roksal/sistem-zdravje-card.tsx'), 'flex items-center gap-1 transition-colors hover:text-roksal-ink')).toBe(1)
    // val 58 (dashboard 'Počisti iskanje') + NAVY_KANON vzorec
    expect(R('roksal/dashboard-tab.tsx')).toContain(TRANS + ' ' + RING2 + ' ' + NAVY + ' ' + O2 + ' rounded')
    expect(R('roksal/dashboard-tab.tsx')).toContain(NAVY_KANON)
    // amber/50 pariteta ostaja 100%
    const amb = new RegExp('focus-visible:ring-roksal-amber/50(?! ' + O2 + ')', 'g')
    let ambSk = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      ambSk += (readFileSync(join(koren, z), 'utf-8').match(amb) ?? []).length
    }
    expect(ambSk, 'ne-pariranih amber/50').toBe(0)
  })

  it('(F) SKUPNA RESNICA: vrstični brez-transition števec čez VSE roksal = 162 (pre-val 170 − 8 val 60 vrstic = zaključek; ostanki = Button vrstice s transition-all iz baze + frozen izjema #2 — disk resnica, NE element klasifikacija)', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let sk = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      sk += lines.filter((l) => l.includes(RING2) && (l.includes(NAVY) || l.includes(RED)) && !l.includes('transition')).length
    }
    expect(sk, 'skupno brez-transition vrstic (162 = 170 − 8 +1 R402)').toBe(163) // [PIN SHIFT R402 §19: +1 invoice-manager gumb Poslan (outline vrstica brez transition — ISTA oblika kot družinski outline gumbi)]
  })
})
