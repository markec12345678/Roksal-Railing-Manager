import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

// R372 STIL val 55 — ring OBLIKOVNA pariteta roksal-red/40 (per-barvni split
// kanon nadaljevanje: navy = val 43–49 + val 52 pari + val 53 O1 rep + val 54
// NONE triaža, red = val 50 [red-400/60 trio] + val 55 [roksal-red/40
// družina], amber = val 51) + FEATURE r372-token-triage.py (generalizacija
// r371-none-triage.py na poljuben žeton; 1. uporaba V ISTI rundi) + iskren
// IZPUST e2e-lib dedup 12. val.
//
// Disk resnica (LEKCIJA R364 (4) — census iz diska scripts/r369-census.py
// RE-POGNAN v R372 + NOVI r372-token-triage.py 1. uporaba):
//   red/40 PRED: {'NONE': 20, 'O1': 2, 'O2': 3} gap 22
//   red/40 PO:   {'NONE': 14, 'O2': 11} gap 14 — vsi 14 DOKUMENTIRANI
//     namerni (12 KIT [shadcn <Button> + brand override — izjema #1] +
//     2 CMP [top-bar DropdownMenuItem odjava — lastni fokus jezik])
//     → red/40 BRAND GUMB pariteta ZAKLJUČENA (razcep = 0, O1 razcep = 0)
//   val 55 = RAW ×8: 2 × SUB O1→O2 (dashboard L1987 'Zamujena dobava',
//     vodja L2122 'Brez dobavitelja' — precedent val 53; DOLŽINSKO
//     NEVTRALNO 27→27) + 6 × INS ' focus-visible:ring-offset-2' TIK ZA
//     red/40 (material-intelligence L1408, measurements L3351+L4032,
//     notification-center L703, photo-tab L717, sistem-zdravje L228 —
//     precedent val 54; +28 znakov)
//   in-place = 0 novih vrstic; 0 novih hex; aria/title ZAMRZNJENI.
//   Stale-pin PRED-skan: r372-window-scan.py (klon r370, TARGETS = 7
//   datotek) delta +27 = 0 preozkih (121/121, PRED in PO); ŠTEVEC guard
//   sken (LEKCIJA R371 (7) apliciran PRED vitestom, ne za njim):
//   r370 (A) navy-obsegani števci nedotaknjeni; 1 ŠTEVEC PIN SHIFT v
//   r371 (B) [PIN SHIFT R372 val 55] — sistem-zdravje celo-datotečni
//   'ring-offset' absent → navy-vrstični guard z ISTO namero.

const R = (f: string): string => readFileSync(join(process.cwd(), f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const RED = 'focus-visible:ring-roksal-red/40'
const O2 = 'focus-visible:ring-offset-2'
const O1 = 'focus-visible:ring-offset-1'

const DATOTEKE = [
  { f: 'roksal/dashboard-tab.tsx', vrstice: 3188, hex: 0, aria: 13, title: 22, tarce: [1987] },
  { f: 'roksal/vodja-dashboard.tsx', vrstice: 2199, hex: 1, aria: 25, title: 34, tarce: [2122] },
  { f: 'roksal/material-intelligence-tab.tsx', vrstice: 2366, hex: 0, aria: 23, title: 21, tarce: [1408] },
  { f: 'roksal/measurements-tab.tsx', vrstice: 6232, hex: 0, aria: 48, title: 66, tarce: [3351, 4032] },
  { f: 'roksal/notification-center.tsx', vrstice: 969, hex: 0, aria: 7, title: 6, tarce: [703] },
  { f: 'roksal/photo-tab.tsx', vrstice: 2684, hex: 12, aria: 17, title: 6, tarce: [717] },
  { f: 'roksal/sistem-zdravje-card.tsx', vrstice: 307, hex: 0, aria: 3, title: 3, tarce: [228] },
]

const INS_TARCE = [1408, 3351, 4032, 703, 717, 228]
const SUB_TARCE = [1987, 2122]

describe('R372 stil val 55 — red/40 RAW pariteta (2 SUB O1→O2 + 6 INS offset-2)', () => {
  it('(A) PARITETA guard: vseh 8 tarč nosi offset-2 (SUB: offset-1 ODSOTEN; INS: TIK ZA red/40) + in-place vrstice + hex/aria/title ZAMRZNJENI per datoteka (7 datotek)', () => {
    for (const { f, vrstice, hex, aria, title, tarce } of DATOTEKE) {
      const src = R(`src/components/${f}`)
      const lines = src.split('\n')
      for (const ln of tarce) {
        const v = lines[ln - 1]
        expect(v.includes(RED), `${f}:${ln} red/40`).toBe(true)
        expect(v.includes(O2), `${f}:${ln} offset-2`).toBe(true)
        if (SUB_TARCE.includes(ln)) {
          expect(v.includes(O1), `${f}:${ln} SUB brez offset-1`).toBe(false)
          expect(v.indexOf(O2), `${f}:${ln} SUB offset-2 za red/40`).toBeGreaterThan(v.indexOf(RED))
        } else {
          expect(v.indexOf(O2), `${f}:${ln} INS TIK ZA red/40`).toBe(v.indexOf(RED) + RED.length + 1)
        }
      }
      expect(wcLinije(src), `${f} in-place vrstice`).toBe(vrstice)
      expect((src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, `${f} hex`).toBe(hex)
      expect(pod(src, 'aria-label='), `${f} aria`).toBe(aria)
      expect(pod(src, 'title='), `${f} title`).toBe(title)
    }
    // INS tarče = natanko 6, SUB = natanko 2 (disk resnica runde)
    expect(INS_TARCE.length).toBe(6)
    expect(SUB_TARCE.length).toBe(2)
  })

  it('(B) era-diskriminatorji val 55: N1 ×1 / N2 ×1 / N3 ×1 / N4 ×1 (per-datoteka grep -rlF kanon, vsi ×0 v HEAD 810b691 fetch-first GLASNO) + dokumentirani ne-tarčni ostanki (top-bar CMP DropdownMenuItem ×2 brez offseta + dashboard KIT L1914 brez offseta — izjema #1)', () => {
    const N1 = 'flex w-full items-center gap-3 rounded-xl border border-roksal-red/20 bg-roksal-red/5 p-3 text-left animate-fade-in-up cursor-pointer transition-colors hover:bg-roksal-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
    const N2 = 'shadow-sm animate-fade-in-up transition-colors hover:bg-roksal-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
    const N3 = 'p-1.5 rounded-lg hover:bg-roksal-red/10 focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors'
    const N4 = 'flex items-center gap-1 transition-colors hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
    expect(pod(R('src/components/roksal/dashboard-tab.tsx'), N1)).toBe(1)
    expect(pod(R('src/components/roksal/vodja-dashboard.tsx'), N2)).toBe(1)
    expect(pod(R('src/components/roksal/measurements-tab.tsx'), N3)).toBe(1)
    expect(pod(R('src/components/roksal/sistem-zdravje-card.tsx'), N4)).toBe(1)
    // ne-tarčni ostanki: top-bar CMP (DropdownMenuItem odjava) — lastni fokus jezik
    // [EVOLVED R378 val 59: ostanki RESOLVANI — top-bar ×2 + dashboard KIT
    // L1914 (izjema #1) zdaj nosijo offset-2; asercije ostanejo zelene, ker
    // so podnizi, ki se končajo na red/40, neovirani (INS je ZA njimi).]
    const TB = R('src/components/roksal/top-bar.tsx')
    // [PIN SHIFT R381 val 60 / EVOLVED: val 60 INS ' transition-colors' PRED
    // ring-2 na ISTI vrstici (kanon val 58) — pin evoluiral na nov niz; stara
    // oblika ×0 (meni-notranja pariteta v OBEH smerih).]
    expect(pod(TB, 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-red/40')).toBe(2)
    expect(pod(TB, 'gap-2 focus-visible:ring-2 focus-visible:ring-roksal-red/40')).toBe(0)
    expect(TB).toContain('<DropdownMenuItem')
    // KIT ostanki: shadcn Button + brand override (izjema #1) — red/40 BREZ offseta
    const DB = R('src/components/roksal/dashboard-tab.tsx')
    expect(DB).toContain('h-7 border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40')
    // rdeči trio val 50 (red-400/60 — DRUŽINA, ne roksal-red/40) nedotaknjen
    expect(pod(R('src/components/roksal/sketch-canvas.tsx'), 'focus-visible:ring-red-400/60 focus-visible:ring-offset-2')).toBe(1)
  })

  it('(C) stale-pini ČIST: r317 polni must_miss needle odsoten + r348 steber toContain preživi + r346 line-okno preživi + r371 (B) [PIN SHIFT R372 val 55] navy-vrstični guard ŽIVO + handler pini + r371 (A) photo in-place 2684', () => {
    // r317 must_miss: POLNI needle niz (LEKCIJA R371 (4) — krajša sosledja
    // laže živi na KIT vrsticah) še vedno odsoten
    expect(R('src/components/roksal/rate-limit-panel.tsx').includes('h-8 px-2 transition-colors hover:text-roksal-ink focus-visible:ring-roksal-navy/40')).toBe(false)
    // r348 steber toContain: navy/40 na steber-table L69 (val 54 tarča) preživi
    expect(R('src/components/roksal/measurements/steber-table.tsx')).toContain('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')
    // r346 LINE-okno (i-8..i+6 semantika): anchor vrstica okoli calculator
    // izvoznih gumbov še vedno z offset-2 (val 53)
    const calc = R('src/components/roksal/calculator-tab.tsx').split('\n')
    const idx = calc.findIndex((v) => v.includes('hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'))
    expect(idx).toBeGreaterThan(7)
    expect(calc.slice(idx - 8, idx + 7).some((v) => v.includes('ring-roksal-navy/40'))).toBe(true)
    // [PIN SHIFT R372 val 55] marker ŽIVO v r371 testu + navy-vrstični guard
    const r371 = R('src/lib/__tests__/r371-stil-val54.test.ts')
    expect(r371).toContain('PIN SHIFT R372 val 55')
    const szc = R('src/components/roksal/sistem-zdravje-card.tsx')
    expect(szc.split('\n').filter((v) => v.includes('focus-visible:ring-roksal-navy/40')).every((v) => !v.includes('ring-offset'))).toBe(true)
    // r371 (A) photo-tab in-place 2684 (val 54 tarča L2370 nespremenjena)
    const photo = R('src/components/roksal/photo-tab.tsx').split('\n')
    expect(photo[2369].includes('ring-roksal-navy/40')).toBe(true)
    expect(photo[2369].includes('ring-offset-2')).toBe(true)
    // handler pini (r268/r271/r272 semantika — onClick stil ne sme nositi ringa)
    const dash = R('src/components/roksal/dashboard-tab.tsx')
    expect(dash).toContain('onClick={() => setAuditOpen(true)}')
    // navy/40 P census števci val 54 nespremenjeni (red SUB/INS ne tiče navy vrstic)
    const navyO2 = dash.split('\n').filter((v) => v.includes('focus-visible:ring-roksal-navy/40') && v.includes(O2)).length
    expect(navyO2).toBe(4)
  })

  it('(D) census klasa dokaz: red/40 PO stanje čez vseh 15 nosilnih datotek (skupaj 25 = O2 25 + NONE 0, O1 0 — O1 razcep = 0) + navy/40 vsota 249 nespremenjena [PIN SHIFT R378 val 59: 14 NONE (12 KIT + 2 CMP) → O2 — rdeča družina zaključena]', () => {
    // disk resnica — census semantika (r369-census.py) replika V TESTU
    // (LEKCIJA R364 (4): replika = ISTA semantika kot orodje)
    const nosilke = ['dashboard-tab', 'vodja-dashboard', 'floor-plan-tab', 'inventory-tab', 'material-intelligence-tab', 'measurements-tab', 'notification-center', 'photo-tab', 'quote-followup', 'roksal-catalog', 'sessions-dialog', 'sistem-zdravje-card', 'termini-card', 'top-bar', 'invoice-manager']
    let skupaj = 0
    let o2 = 0
    let o1 = 0
    let none = 0
    for (const f of nosilke) {
      for (const v of R(`src/components/roksal/${f}.tsx`).split('\n')) {
        if (!v.includes(RED)) continue
        skupaj++
        if (v.includes(O2)) o2++
        else if (v.includes(O1)) o1++
        else none++
      }
    }
    expect(nosilke.length).toBe(15)
    expect(skupaj).toBe(25) // žig: val 55 ni dodal/odstranil nobene red/40 vrstice
    expect(o2).toBe(25) // [PIN SHIFT R378 val 59] prej 11 (8 val 55 + 3 že-O2); val 59 pariral 14 (12 KIT + 2 CMP) — družina 25/25
    expect(o1).toBe(0) // O1 razcep = 0 (SUB ×2 normalizirani)
    expect(none).toBe(0) // [PIN SHIFT R378 val 59] prej 14 dokumentiranih — val 59 resolval (r378-stil-val59.test.ts (D) dokaz)
    // navy/40 vsota čez 7 val 55 datotek (disk resnica: 9+4+26+47+3+2+1 =
    // 92 — val 55 jih NI spremenil; žig per-datoteka, red-only runda)
    let navy = 0
    for (const { f } of DATOTEKE) {
      for (const v of R(`src/components/${f}`).split('\n')) {
        if (v.includes('focus-visible:ring-roksal-navy/40')) navy++
      }
    }
    expect(navy).toBe(92)
  })

  it('(E) orodja ŽIVO: r372-token-triage.py vir (generalizacija — argv žeton, klasifikacija KIT/RAW/INPUT/LINK/CMP/DIV, nazaj-hod 15) + r372-window-scan klon (7 TARGETS) + apply fail-closed žigi + era klon kanon (PETINDVJSETIJNA ×4, prag 105, REG_Y) + register 4+1 + dedup 12. val IZPUST dokaz V TESTU (26 blokov / 21 unikatnih / 5 ×2 — VSE znotraj r372: 1. teek vs re-proba, nič čez-rundno)', () => {
    // orodja = disk resnica (kanon r371 (E): vir + žigi, brez subprocessa)
    const TRI = R('scripts/r372-token-triage.py')
    expect(TRI).toContain('r372-token-triage.py')
    expect(TRI).toContain('sys.argv[1:]') // generalizacija: poljuben žeton
    expect(TRI).toContain('"KIT"')
    expect(TRI).toContain('"RAW"')
    expect(TRI).toContain('"INPUT"')
    expect(TRI).toContain('"LINK"')
    expect(TRI).toContain('"CMP"')
    expect(TRI).toContain('range(1, 16)') // nazaj-hod do 15 vrstic
    expect(TRI).toContain('(?![-\\w])') // LEKCIJA: goli tag na koncu vrstice
    const APP = R('scripts/r372-val55-apply.py')
    expect(APP).toContain('FAILOVEDANO')
    expect(APP).toContain('27→27') // SUB dolžinsko nevtralno
    const SCAN = R('scripts/r372-window-scan.py')
    expect(SCAN).toContain('material-intelligence-tab.tsx')
    expect(SCAN).toContain('sistem-zdravje-card.tsx')
    expect(pod(SCAN, 'src/components/roksal/')).toBe(7) // 7 TARGETS
    // in-test klasifikacijska replika (ISTA semantika kot orodje):
    // [EVOLVED R378 val 59] prej: triaža GAP klas (red/40 BREZ O2) =
    // {KIT: 12, CMP: 2}; val 59 je pariral vseh 14 → zanka OBRNJENA:
    // triaža RED+O2 vrstic v 8 tarčnih datotekah = 15 (14 val 59 + L1987
    // val 55 SUB) = {KIT: 12, CMP: 2, RAW: 1} — L1987 = RAW (nativni
    // <button>, val 55 SUB tarča, že O2) — isto orodje, OBRNjen pogoj.
    const CMP_PAT = /<(DropdownMenu|Command|Card|Popover|Sheet|Tabs|Accordion|Dialog|Tooltip|Select|Calendar|Combobox)\w*/
    const DIV_PAT = /<(div|span|li|td|p|Badge|h[1-6])(?![-\w])/
    const klas = (lines: string[], i: number): string => {
      for (let back = 1; back <= 15; back++) {
        const j = i - back
        if (j < 0) break
        const prev = lines[j]
        if (prev.includes('<Button')) return 'KIT'
        if (/<button(?![-\w])/.test(prev)) return 'RAW'
        if (/<(Input|input|Textarea|textarea)(?![-\w])/.test(prev)) return 'INPUT'
        if (/<a(?![-\w])/.test(prev) || prev.includes('<Link')) return 'LINK'
        if (CMP_PAT.test(prev)) return 'CMP'
        if (DIV_PAT.test(prev)) return 'DIV?'
      }
      return '?'
    }
    const klasa: Record<string, number> = {}
    for (const f of ['top-bar', 'dashboard-tab', 'floor-plan-tab', 'inventory-tab', 'quote-followup', 'roksal-catalog', 'sessions-dialog', 'termini-card']) {
      const lines = R(`src/components/roksal/${f}.tsx`).split('\n')
      for (const [i, v] of lines.entries()) {
        if (!v.includes(RED) || !v.includes(O2)) continue // [EVOLVED R378 val 59] obrnjeno: triaža PARIRANIH
        const k = klas(lines, i)
        klasa[k] = (klasa[k] ?? 0) + 1
      }
    }
    // KIT vrstice (val 59 tarče): dashboard ×5, floor-plan ×1, inventory ×1,
    // quote-followup ×1, roksal-catalog ×1, sessions-dialog ×2, termini-card
    // ×1 = 12; CMP: top-bar ×2; RAW ×1 = dashboard L1987 (val 55 SUB, nativni)
    expect(klasa).toEqual({ KIT: 12, CMP: 2, RAW: 1 })
    // era klon kanon: r372-era-harvest.sh nosi PETINDVJSETIJNA + REG_Y + prag 105
    // (LEKCIJA R371 (1): PRED-pogoje od POST-pogojev ločene preverbe)
    const era = R('scripts/r372-era-harvest.sh')
    expect(pod(era, 'PETINDVJSETIJNA')).toBe(4)
    expect(era).toContain('REG_Y="scripts/qa-needles/r371.tsv"')
    expect(era).toContain('[ "$need_n" -lt 105 ]')
    expect(era).toContain('TODO-R371|R371')
    expect(era).toContain('preberi_register "$REG_Y" "R371 val 54"')
    expect(era).toContain('r372-resolucija-')
    // register r372.tsv: 4 need_static + 1 must_miss (kanon 4 needleje/rundo)
    const reg = R('scripts/qa-needles/r372.tsv').split('\n').filter((v) => v && !v.startsWith('#'))
    expect(reg.filter((v) => v.split('\t')[2] === 'need_static').length).toBe(4)
    expect(reg.filter((v) => v.split('\t')[2] === 'must_miss').length).toBe(1)
    // dedup 12. val IZPUST — dokaz V TESTU (kanon R368): 26 blokov r370–r372,
    // 21 unikatnih, 5 ponovitev ×2 — VSE med r372-qa-spot in r372-spot-reprobe
    // (1. teek vs re-proba ISTEGA teka) → nič čez-rundnih ponovitev → IZPUST
    const BLOKI = /agent-browser eval "JSON\.stringify\(\{([\s\S]*?)\}\)"/g
    const zetoni: string[] = []
    const izvor: Array<[string, string]> = []
    for (const s of ['r370-qa-spot', 'r370-spot-reprobe', 'r371-qa-spot', 'r371-vodja-identify', 'r372-qa-spot', 'r372-spot-reprobe']) {
      const src = R(`scripts/${s}.sh`)
      for (const m of src.matchAll(BLOKI)) {
        zetoni.push(createHash('md5').update((m[1] as string).replace(/\s+/g, '')).digest('hex'))
        izvor.push([s, (m[1] as string).slice(0, 24)])
      }
    }
    expect(zetoni.length).toBe(26)
    expect(new Set(zetoni).size).toBe(21)
    const pon = new Map<string, number>()
    for (const z of zetoni) pon.set(z, (pon.get(z) ?? 0) + 1)
    const ponljeni = [...pon.entries()].filter(([, n]) => n >= 2)
    expect(ponljeni.length).toBe(5)
    // vsa ×2 para = r372 notranja (re-proba) — preverba izvora per hash
    const poIzvoru = new Map<string, Set<string>>()
    zetoni.forEach((z, i) => {
      if (!poIzvoru.has(z)) poIzvoru.set(z, new Set())
      poIzvoru.get(z)!.add(izvor[i][0])
    })
    for (const [z] of ponljeni) {
      expect([...(poIzvoru.get(z) ?? new Set<string>())].every((s) => s.startsWith('r372'))).toBe(true)
    }
  })
})
