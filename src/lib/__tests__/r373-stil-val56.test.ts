import { readFileSync, readdirSync, statSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

// R373 STIL val 56 — ring OBLIKOVNA pariteta MALIH družin (per-barvni split
// kanon zaključek: navy = val 43–49 + 52 + 53 + 54, red = 50 + 55, amber =
// 51, white + white/60 + roksal-green/40 = 56) + FEATURE r373-family-census.py
// (4. korak generalizacije: r369-census → r371-none-triage →
// r372-token-triage → TA; 1. uporaba V ISTI rundi z navzkrižno validacijo)
// + iskren IZPUST e2e-lib dedup 13. val.
//
// Disk resnica (LEKCIJA R364 (4) — census iz diska, r369-census.py +
// NOVI r373-family-census.py, 1. uporaba V ISTI rundi):
//   navy/40 PRED = PO {'O2': 205, 'NONE': 43, '?INTERP': 1} (249) —
//     navzkrižna validacija: NOVO orodje = TOČNO r371 PO census;
//   white PRED {'NONE': 3} → PO {'O2': 3} gap 3→0 (3 × RAW photo-tab);
//   white/60 PRED {'NONE': 8, 'O0': 3} → PO {'NONE': 4, 'O0': 3, 'O2': 4}
//     gap 8→4 — vsi 4 = KIT (izjema #1); O0 ×3 = top-bar izjema #2
//     (zamrznjena v r369-stil-val52.test.ts L140);
//   roksal-green/40 PRED {'NONE': 1} → PO {'O2': 1} gap 1→0 (dashboard);
//   ring/50 ×14 = VSE ui/* shadcn kit fokus jezik → dokumentirano, BREZ
//     sprememb (izjema #1 plast); destructive/20+/40 ×4 + resizable ring O1
//     ×1 = ui KIT; navy ?INTERP ×1 razrešena v KIT (roksal-catalog L110 —
//     <Button iz ui/button na L103; interpolacija je bg variant, ne fokus).
//   val 56 = RAW ×8: INS ' focus-visible:ring-offset-2' TIK ZA žetonom
//     (photo-tab L978/L1129/L1137 white + L1414/L2048/L2061/L2071
//     white/60, dashboard L1742 green — precedent val 55 INS; +28 znakov,
//     vrstni red ring → offset → outline pri belih RAW);
//   in-place = 0 novih vrstic (photo 2684, dashboard 3188); 0 novih hex;
//   aria/title ZAMRZNJENI.
//   Stale-pin PRED-skan: r373-window-scan.py (klon r372, TARGETS = 2
//   datoteki) delta +28 ×3 žetona = 0 preozkih (14/14 PRED in PO);
//   ŠTEVEC guard sken PRED vitestom (LEKCIJA R371 (7)): r370 (A)
//   navy-obsegani števci + r371/r372 per-datoteka hex/aria/title čisto
//   (INS ne doda hex/aria/title/vrstic); okenski/handler/must_miss pini 0
//   shiftov.

const R = (f: string): string => readFileSync(join(process.cwd(), f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const WHITE = 'focus-visible:ring-white '
const WHITE60 = 'focus-visible:ring-white/60'
const GREEN = 'focus-visible:ring-roksal-green/40'
const NAVY = 'focus-visible:ring-roksal-navy/40'
const RED = 'focus-visible:ring-roksal-red/40'
const AMBER = 'focus-visible:ring-roksal-amber/50'
const O2 = 'focus-visible:ring-offset-2'
const OUTLINE = 'focus-visible:outline-none'

const PHOTO = 'src/components/roksal/photo-tab.tsx'
const DASH = 'src/components/roksal/dashboard-tab.tsx'

const WHITE_RAW = [978, 1129, 1137]
const WHITE60_RAW = [1414, 2048, 2061, 2071]
const GREEN_RAW = [1742]

// rekurzivni sprehod = ISTA obseg kot r373-family-census.py (src/components
// rglob *.tsx; __tests__ ni v drevesu components) — replika semantike
const KOREN = 'src/components'
const vseDatoteke = (): string[] => {
  const out: string[] = []
  const hoja = (d: string): void => {
    for (const e of readdirSync(d)) {
      const polno = join(d, e)
      if (statSync(polno).isDirectory()) hoja(polno)
      else if (e.endsWith('.tsx')) out.push(polno)
    }
  }
  hoja(KOREN)
  return out.sort()
}

describe('R373 stil val 56 — male družine RAW pariteta (white ×3 + white/60 ×4 + green ×1 INS offset-2)', () => {
  it('(A) PARITETA guard: vseh 8 tarč nosi offset-2 TIK ZA žetonom (white: ring → offset → outline; white/60: offset PRED zapirajočim navedkom; green: offset tik za žetonom) + in-place vrstice + hex/aria/title ZAMRZNJENI per datoteka (2 datoteki)', () => {
    const photoLines = R(PHOTO).split('\n')
    for (const ln of WHITE_RAW) {
      const v = photoLines[ln - 1]
      expect(v.includes(WHITE), `${PHOTO}:${ln} white žeton`).toBe(true)
      expect(v.includes(WHITE.trim() + ' ' + O2 + ' ' + OUTLINE), `${PHOTO}:${ln} vrstni red ring → offset → outline`).toBe(true)
    }
    for (const ln of WHITE60_RAW) {
      const v = photoLines[ln - 1]
      expect(v.includes(WHITE60 + ' ' + O2), `${PHOTO}:${ln} white/60 offset tik za žetonom`).toBe(true)
      expect(v.indexOf(O2), `${PHOTO}:${ln} offset tik za white/60`).toBe(v.indexOf(WHITE60) + WHITE60.length + 1)
    }
    const dashLines = R(DASH).split('\n')
    for (const ln of GREEN_RAW) {
      const v = dashLines[ln - 1]
      expect(v.includes(GREEN + ' ' + O2), `${DASH}:${ln} green offset tik za žetonom`).toBe(true)
      expect(v.indexOf(O2), `${DASH}:${ln} offset tik za green`).toBe(v.indexOf(GREEN) + GREEN.length + 1)
    }
    // in-place + hex/aria/title ZAMRZNJENI (r368/r371/r372 kanon per datoteka)
    const photo = R(PHOTO)
    expect(wcLinije(photo), 'photo-tab in-place vrstice').toBe(2684)
    expect((photo.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, 'photo-tab hex').toBe(12)
    expect(pod(photo, 'aria-label='), 'photo-tab aria-label').toBe(17)
    expect(pod(photo, 'title='), 'photo-tab title').toBe(6)
    const dash = R(DASH)
    expect(wcLinije(dash), 'dashboard in-place vrstice').toBe(3188)
    expect((dash.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, 'dashboard hex').toBe(0)
    expect(pod(dash, 'aria-label='), 'dashboard aria-label').toBe(13)
    expect(pod(dash, 'title='), 'dashboard title').toBe(22)
    // disk resnica runde: tarče natanko 3+4+1
    expect(WHITE_RAW.length).toBe(3)
    expect(WHITE60_RAW.length).toBe(4)
    expect(GREEN_RAW.length).toBe(1)
  })

  it('(B) era-diskriminatorji val 56: N1 ×1 / N2 ×1 / N3 ×1 / N4 ×1 (per-datoteka grep -rlF kanon, vsi ×0 v HEAD 777e84f fetch-first GLASNO prek r373-register-write.py) + dokumentirani ne-tarčni ostanki (top-bar OFF0 ×3 izjema #2 + sketch/floor-plan KIT ×4 brez offseta + resizable O1 ×1 + destructive ×4 ui KIT)', () => {
    const N1 = 'group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2'
    const N2 = 'hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2'
    const N3 = 'font-medium hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2'
    const N4 = 'hover:text-roksal-green hover:bg-roksal-green/10 focus-visible:ring-2 focus-visible:ring-roksal-green/40 focus-visible:ring-offset-2 outline-none transition-colors'
    expect(pod(R(PHOTO), N1)).toBe(1)
    expect(pod(R(PHOTO), N2)).toBe(1)
    expect(pod(R(PHOTO), N3)).toBe(1)
    expect(pod(R(DASH), N4)).toBe(1)
    // izjema #2: top-bar white/60 + ring-offset-0 ×3 (gosta površina —
    // zamrznjeno tudi v r369-stil-val52.test.ts; dvojni pokritelj)
    const TB = R('src/components/roksal/top-bar.tsx')
    expect(pod(TB, 'ring-white/60 focus-visible:ring-offset-0')).toBe(3)
    // izjema #1: KIT bratje BREZ offseta (sketch ×2, floor-plan ×2)
    const SK = R('src/components/roksal/sketch-canvas.tsx')
    expect(pod(SK, WHITE60)).toBe(2)
    expect(SK.split('\n').filter((v) => v.includes(WHITE60)).every((v) => !v.includes('ring-offset'))).toBe(true)
    const FP = R('src/components/roksal/floor-plan-tab.tsx')
    expect(pod(FP, WHITE60)).toBe(2)
    expect(FP.split('\n').filter((v) => v.includes(WHITE60)).every((v) => !v.includes('ring-offset'))).toBe(true)
    // ui/* KIT: resizable ring-ring O1 ×1 (nenormaliziran — kit fokus jezik)
    const RZ = R('src/components/ui/resizable.tsx')
    expect(pod(RZ, 'focus-visible:ring-ring')).toBe(1)
    expect(pod(RZ, 'focus-visible:ring-offset-1')).toBe(1)
    // ui/* KIT: destructive/20 + destructive/40 (badge + button; ločena z
    // dark: varianto vmes — census /20 ×2 + /40 ×2 nespremenjena)
    const BG = R('src/components/ui/badge.tsx')
    expect(pod(BG, 'focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40')).toBe(1)
    const BT = R('src/components/ui/button.tsx')
    expect(pod(BT, 'focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40')).toBe(1)
  })

  it('(C) stale-pini ČIST: r317 polni must_miss needle odsoten + r348 steber toContain preživi + r346 line-okno preživi + handler pini + navy/red žigi nespremenjeni (r370 dashboard navy O2 = 4; r372 (D) navy 92 čez 7 datotek; r371 photo L2370 + r372 photo L717 tarče ŽIVO)', () => {
    expect(R('src/components/roksal/rate-limit-panel.tsx').includes('h-8 px-2 transition-colors hover:text-roksal-ink focus-visible:ring-roksal-navy/40')).toBe(false)
    expect(R('src/components/roksal/measurements/steber-table.tsx')).toContain('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')
    const calc = R('src/components/roksal/calculator-tab.tsx').split('\n')
    const idx = calc.findIndex((v) => v.includes('hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'))
    expect(idx).toBeGreaterThan(7)
    expect(calc.slice(idx - 8, idx + 7).some((v) => v.includes('ring-roksal-navy/40'))).toBe(true)
    const dash = R(DASH)
    expect(dash).toContain('onClick={() => setAuditOpen(true)}')
    // r370 (A) navy-obsegani števec dashboard: navy vrstice z offset-2 = 4
    expect(dash.split('\n').filter((v) => v.includes(NAVY) && v.includes(O2)).length).toBe(4)
    // r372 (D) navy vsota čez 7 val 55 datotek = 92 (žig per-datoteka)
    const sedem = ['roksal/dashboard-tab.tsx', 'roksal/vodja-dashboard.tsx', 'roksal/material-intelligence-tab.tsx', 'roksal/measurements-tab.tsx', 'roksal/notification-center.tsx', 'roksal/photo-tab.tsx', 'roksal/sistem-zdravje-card.tsx']
    let navy92 = 0
    for (const f of sedem) {
      for (const v of R('src/components/' + f).split('\n')) {
        if (v.includes(NAVY)) navy92++
      }
    }
    expect(navy92).toBe(92)
    // r371/r372 photo tarče ŽIVO (navy L2370 + red L717 — val 56 jih ni tičal)
    const photo = R(PHOTO).split('\n')
    expect(photo[2369].includes('ring-roksal-navy/40')).toBe(true)
    expect(photo[2369].includes('ring-offset-2')).toBe(true)
    expect(photo[716].includes('ring-roksal-red/40')).toBe(true)
    expect(photo[716].includes('ring-offset-2')).toBe(true)
    // red/40 census r372 (D): 15 nosilk, 25 — nespremenjeno
    const nosilke = ['dashboard-tab', 'vodja-dashboard', 'floor-plan-tab', 'inventory-tab', 'material-intelligence-tab', 'measurements-tab', 'notification-center', 'photo-tab', 'quote-followup', 'roksal-catalog', 'sessions-dialog', 'sistem-zdravje-card', 'termini-card', 'top-bar', 'invoice-manager']
    let red25 = 0
    for (const f of nosilke) {
      for (const v of R('src/components/roksal/' + f + '.tsx').split('\n')) {
        if (v.includes(RED)) red25++
      }
    }
    expect(red25).toBe(25)
  })

  it('(D) census replika (ISTA obseg kot orodje — src/components rglob): white PO {O2: 3} gap 0 + white/60 PO {NONE: 4, O0: 3, O2: 4} gap 4 vsi KIT + green PO {O2: 1} gap 0 + barvni žigi 249/25/18 bajtno nespremenjeni + navy ?INTERP ×1 = KIT razrešena (roksal-catalog L103 <Button)', () => {
    const datoteke = vseDatoteke()
    const vseVrstice = datoteke.flatMap((f) => R(f).split('\n'))
    // meja: žeton ne sme biti daljša družina (white ≠ white/60 ≠ whitish)
    const familija = (v: string, token: string): boolean =>
      new RegExp('focus-visible:ring-' + token.replace('/', '\\/') + '(?![\\/\\w-])').test(v)
    const poDruzini = (token: string): Record<string, number> => {
      const c: Record<string, number> = {}
      for (const v of vseVrstice) {
        if (!familija(v, token)) continue
        const s = v.includes(O2) ? 'O2'
          : v.includes('focus-visible:ring-offset-1') ? 'O1'
          : v.includes('focus-visible:ring-offset-0') ? 'O0'
          : v.includes('${') ? '?INTERP'
          : 'NONE'
        c[s] = (c[s] ?? 0) + 1
      }
      return c
    }
    expect(poDruzini('white')).toEqual({ O2: 3 })
    expect(poDruzini('white/60')).toEqual({ NONE: 4, O0: 3, O2: 4 })
    expect(poDruzini('roksal-green/40')).toEqual({ O2: 1 })
    // barvni žigi bajtno nespremenjeni (shape-only runda — val 44–55 precedens)
    const stevilo = (token: string): number => vseVrstice.filter((v) => v.includes(token)).length
    expect(stevilo(NAVY)).toBe(249)
    expect(stevilo(RED)).toBe(25)
    expect(stevilo(AMBER)).toBe(18)
    // navy ?INTERP razrešena: roksal-catalog L103 nosi <Button (KIT izjema #1),
    // L110 je template z interpolacijo bg variant (NE fokus) in brez offseta
    const kat = R('src/components/roksal/roksal-catalog.tsx').split('\n')
    expect(kat[102].includes('<Button')).toBe(true)
    expect(kat[6].includes("from '@/components/ui/button'")).toBe(true)
    expect(kat[109].includes('focus-visible:ring-roksal-navy/40')).toBe(true)
    expect(kat[109].includes('${')).toBe(true)
    expect(kat[109].includes('ring-offset')).toBe(false)
  })

  it('(E) orodja ŽIVO: r373-family-census.py vir (4. generalizacija — argv družine, census+triaža, meja (?![/\\w-]), fail-closed 0 pojavitev) + r373-val56-apply.py fail-closed žigi (FAILOVEDANO, pred_outline pot, in-place) + r373-window-scan (2 TARGETS) + era klon kanon (ŠESTINDVJSETIJNA ×4, REG_Z, prag 109, TODO-R372) + register 4+1 + dedup 13. val IZPUST dokaz (32 blokov / 27 unikatnih / 5 ×2 — VSE ×2 še zmeraj znotraj r372, nič čez-rundnega)', () => {
    const CEN = R('scripts/r373-family-census.py')
    expect(CEN).toContain('r373-family-census.py')
    expect(CEN).toContain('sys.argv[1:]')
    expect(CEN).toContain('"KIT"')
    expect(CEN).toContain('"RAW"')
    expect(CEN).toContain('"INPUT"')
    expect(CEN).toContain('"LINK"')
    expect(CEN).toContain('"CMP"')
    expect(CEN).toContain('range(0, 16)') // vrstica + nazaj-hod do 15
    expect(CEN).toContain('(?![/\\w-])') // meja družine (white ≠ white/60)
    expect(CEN).toContain('FAILOVEDANO: 0 pojavitev') // fail-closed tipkalka
    const APP = R('scripts/r373-val56-apply.py')
    expect(APP).toContain('FAILOVEDANO')
    expect(APP).toContain('pred_outline')
    expect(APP).toContain('in-place kršen')
    const SCAN = R('scripts/r373-window-scan.py')
    expect(pod(SCAN, 'src/components/roksal/')).toBe(2) // 2 TARGETS
    // era klon kanon (LEKCIJA R371 (1): PRED/POST ločene preverbe)
    const era = R('scripts/r373-era-harvest.sh')
    expect(pod(era, 'ŠESTINDVJSETIJNA')).toBe(4)
    expect(era).toContain('REG_Z="scripts/qa-needles/r372.tsv"')
    expect(era).toContain('[ "$need_n" -lt 109 ]')
    expect(era).toContain('TODO-R372|R372')
    expect(era).toContain('preberi_register "$REG_Z" "R372 val 55"')
    expect(era).toContain('r373-resolucija-')
    // register r373.tsv: 4 need_static + 1 must_miss (kanon 4 needleje/rundo)
    const reg = R('scripts/qa-needles/r373.tsv').split('\n').filter((v) => v && !v.startsWith('#'))
    expect(reg.filter((v) => v.split('\t')[2] === 'need_static').length).toBe(4)
    expect(reg.filter((v) => v.split('\t')[2] === 'must_miss').length).toBe(1)
    // dedup 13. val IZPUST — dokaz V TESTU (kanon R368): 32 blokov r370–r373,
    // 27 unikatnih, 5 ponovitev ×2 — VSE še zmeraj med r372-qa-spot in
    // r372-spot-reprobe (1. teek vs re-proba ISTEGA teka); r373 bloki (×6)
    // vsi NOVI unikati → nič čez-rundnih ponovitev → IZPUST
    const BLOKI = /agent-browser eval "JSON\.stringify\(\{([\s\S]*?)\}\)"/g
    const zetoni: string[] = []
    const izvor: string[] = []
    for (const s of ['r370-qa-spot', 'r370-spot-reprobe', 'r371-qa-spot', 'r371-vodja-identify', 'r372-qa-spot', 'r372-spot-reprobe', 'r373-qa-spot', 'r373-spot-reprobe']) {
      const src = R('scripts/' + s + '.sh')
      for (const m of src.matchAll(BLOKI)) {
        zetoni.push(createHash('md5').update((m[1] as string).replace(/\s+/g, '')).digest('hex'))
        izvor.push(s)
      }
    }
    expect(zetoni.length).toBe(32)
    expect(new Set(zetoni).size).toBe(27)
    const pon = new Map<string, number>()
    for (const z of zetoni) pon.set(z, (pon.get(z) ?? 0) + 1)
    const ponljeni = [...pon.entries()].filter(([, n]) => n >= 2)
    expect(ponljeni.length).toBe(5)
    const poIzvoru = new Map<string, Set<string>>()
    zetoni.forEach((z, i) => {
      if (!poIzvoru.has(z)) poIzvoru.set(z, new Set())
      poIzvoru.get(z)!.add(izvor[i])
    })
    for (const [z] of ponljeni) {
      expect([...(poIzvoru.get(z) ?? new Set<string>())].every((s) => s.startsWith('r372'))).toBe(true)
    }
  })
})
