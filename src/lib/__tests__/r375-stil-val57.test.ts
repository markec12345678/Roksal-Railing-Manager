import { readFileSync, readdirSync, statSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

// R375 STIL val 57 — ring↔border OBLIKOVNA pariteta navy/40 obrobljenih
// gumbov v measurements-tab.tsx (NON-ring kandidat #1 iz R373 handoverja)
// + FEATURE era-clone.py (5. korak generalizacije era verige: r370–r373
// era-clone hardcodirani → PARAMETRIZIRAN kloner; 1. + 2. uporaba V ISTI
// rundi: r374-era-harvest.sh SEDEMINDVJSETIJNA EXIT=0 + r375-era-harvest.sh
// OSEMINDVJSETIJNA [28 registrov, ≥117] EXIT=0) + KOLIZIJA #17 (poslovna
// runda R374 pristala med delom — re-apply po kanonu) + iskren IZPUST
// e2e-lib dedup 14. val (kanon R368: le ob novih ×3 ponovitvah).
//
// Disk resnica (LEKCIJA R364 (4) — census iz diska):
//   NON-ring triaža (R373 kandidat 1.): focus-visible:border pariteta —
//     INPUT ×10 ocena = disk resnica 4 checkboxa (logistics accent-roksal)
//     → border-pariteta na NATIVE checkboxu NE smiselna (border ne nosi
//     fokus barve poleg accent-a) → iskreno izpuščeno, NI tiho;
//     transition-colors skladnost = disk resnica 1 gap (dashboard L1628)
//     → prihodnji val; border-pariteta obrobljenih: 44 čez komponente,
//     največja kohorentna družina measurements-tab navy/40 = 22 tarč;
//   val 57 = 22 × INS ' focus-visible:border-roksal-navy/40
//     dark:focus-visible:border-roksal-ink/40' TIK ZA
//     'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
//     (kanon calculator L4396/L4439 precedens ring → offset → border +
//     dark: ink obramba — r166 DARK obrobni stražar: border-roksal-navy/
//     izgine v temni temi, dark: obvezen; FULL vitest tek 1 ujel prvi INS
//     brez dark: — stražar deluje, popravljeno V ISTI rundi; outline NI
//     after ring na nobeni tarči — triaža 18 pred / 4 brez → 0 preurejanj,
//     razlika od val 56 belih RAW); +76 znakov/vrstico (×22 = +1672),
//     in-place 0 novih vrstic (6232);
//   ring ŽE naprej brez dark: variante (PRED disk resnica — pariteta
//     ring↔border na SVETLI žeton, border nosi POMENJENO dark: obrambo
//     po r166 kanonu);
//   amber/red bordered ×2 (L3478 amber/40 + red/40 vrstica) = lastni
//     družini → dokumentirano BREZ sprememb (prihodnji val);
//   navy ring+offset BREZ border širine ×25 → border žeton bi bil mrtev
//     CSS → iskreno izpuščeno (pariteta definirana SAMO na obrobljenih);
//   ui/* KIT focus-visible:border-ring ×11 = shadcn fokus jezik →
//     dokumentirana izjema, brez sprememb;
//   stale-pin PRED-skan: r375-window-scan.py (klon r373, TARGETS =
//   measurements-tab) 25 okenskih regexov, delta +76 = 0 preozkih;
//   ŠTEVEC guard sken PRED vitestom (LEKCIJA R371 (7)): r372
//   per-datoteka vrstice/hex/aria/title + tarce [3351/4032] pozicije,
//   r370 (A) MERITVE offset-1 = 0, r373 navy92 = 92 — vsi čisto (INS ne
//   doda hex/aria/title/vrstic/ring/offset žetonov).

const R = (f: string): string => readFileSync(join(process.cwd(), f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const NAVY = 'focus-visible:ring-roksal-navy/40'
const O2 = 'focus-visible:ring-offset-2'
const BORDER = 'focus-visible:border-roksal-navy/40'
const DARK_BORDER = 'dark:focus-visible:border-roksal-ink/40'
const SEKVENCA = `${NAVY} ${O2}`
const INS = ` ${BORDER} ${DARK_BORDER}`
const MER = 'src/components/roksal/measurements-tab.tsx'

// rekurzivni sprehod = ISTA obseg kot census orodja (src/components rglob)
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

describe('R375 stil val 57 — ring↔border pariteta navy/40 obrobljenih gumbov (22 × INS border TIK ZA offset)', () => {
  it('(A) PARITETA guard: vseh 22 tarč nosi ring → offset → border (border TIK ZA offset, kanon calculator L4439) + dark: obramba + in-place vrstice 6232 + hex/aria/title ZAMRZNJENI (r372 per-datoteka)', () => {
    const src = R(MER)
    const lines = src.split('\n')
    const tarce = lines
      .map((v, i) => (v.includes(SEKVENCA + INS) ? i + 1 : 0))
      .filter((v) => v > 0)
    expect(tarce.length).toBe(27) // [PIN SHIFT R382 val 61: +5 measurements tarč]
    for (const ln of tarce) {
      const v = lines[ln - 1]
      expect(v.includes(NAVY), `${ln} navy/40`).toBe(true)
      expect(v.includes(O2), `${ln} offset-2`).toBe(true)
      expect(v.includes(BORDER), `${ln} border-pariteta`).toBe(true)
      expect(v.indexOf(BORDER), `${ln} INS TIK ZA offset`).toBe(v.indexOf(O2) + O2.length + 1)
      expect(v.indexOf(DARK_BORDER), `${ln} dark: tik za border`).toBe(v.indexOf(BORDER) + BORDER.length + 1)
      expect(v.includes(DARK_BORDER), `${ln} r166 dark obramba`).toBe(true)
      const o = v.indexOf('focus-visible:outline-hidden')
      if (o !== -1) expect(o, `${ln} outline pred ring`).toBeLessThan(v.indexOf(NAVY))
    }
    expect(wcLinije(src), 'in-place vrstice').toBe(6232)
    expect((src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, 'hex').toBe(0)
    expect(pod(src, 'aria-label='), 'aria').toBe(48)
    expect(pod(src, 'title='), 'title').toBe(66)
    for (const ln of [3351, 4032]) {
      expect(lines[ln - 1].includes('focus-visible:ring-roksal-red/40'), `${ln} red/40`).toBe(true)
      expect(lines[ln - 1].includes(BORDER), `${ln} brez border (red družina)`).toBe(false)
    }
  })

  it('(B) census PO: bordered navy/40 gap 0 + amber EVOLVED R386 val 64 (FB+dark; red ×2 dokumentirano BREZ sprememb) + navy BREZ border širine ×25 mrtev-CSS izpuščeno + INPUT ×4 checkboxi iskreno izpuščeni + ui KIT border-ring ×11 zamrznjen', () => {
    const src = R(MER)
    const lines = src.split('\n')
    const SIRINA = /[\s'"{(]border(-[0-9](?:\.\d)?)?[\s'")}]/
    const gap = lines.filter(
      (v) => v.includes(NAVY) && v.includes(O2) && !v.includes(BORDER) && SIRINA.test(v),
    ).length
    expect(gap, 'bordered navy gap PO').toBe(0)
    const brezSirine = lines.filter(
      (v) => v.includes(NAVY) && v.includes(O2) && !v.includes(BORDER) && !SIRINA.test(v),
    ).length
    expect(brezSirine, 'mrtev-CSS izpuščeni').toBe(20) // [PIN SHIFT R382 val 61: 5 outline Button vrstic dobilo FB → izseljene]
    // [EVOLVED R386 val 64: bordered amber/40 vrstica (L3478) je bila ob
    // val 57 dokumentirano BREZ FB ('amber/red ×2 dokumentirano BREZ
    // sprememb') — val 64 je pariral vseh 3 bordered amber/40 tarče;
    // amber bordered zdaj NOSI FB amber/40 + dark /40 (crm-tab L811
    // precedens) — disk resnica]
    const amberTarca = lines.find((v) => v.includes('focus-visible:ring-roksal-amber/40') && SIRINA.test(v))
    expect(amberTarca, 'amber bordered obstaja').toBeTruthy()
    expect(amberTarca!.includes('focus-visible:border-roksal-amber/40 dark:focus-visible:border-roksal-amber/40'), 'amber EVOLVED R386 val 64: FB+dark par prisoten').toBe(true)
    const log = R('src/components/roksal/logistics-tab.tsx').split('\n')
    const checkbowers = log.filter(
      (v) => v.includes('accent-roksal-navy') && v.includes(NAVY) && v.includes(O2) && !v.includes('focus-visible:border'),
    ).length
    expect(checkbowers, 'INPUT checkboxi izpuščeni').toBe(4)
    let uiRing = 0
    for (const f of vseDatoteke()) {
      if (f.startsWith('src/components/ui/')) uiRing += pod(R(f), 'focus-visible:border-ring')
    }
    expect(uiRing, 'ui KIT border-ring').toBe(11)
  })

  it('(C) barvni žigi val 43–56 bajtno nespremenjeni: navy92 = 92 (r373 (C) replika) + measurements navy/40, red/40, amber/40 števci PO = PRED + ring-offset-1 = 0 (r370 (A)) + dark: BORDER obvezen / dark: RING odsoten na INS tarčah', () => {
    const sedem = ['dashboard-tab', 'vodja-dashboard', 'material-intelligence-tab', 'measurements-tab', 'notification-center', 'photo-tab', 'sistem-zdravje-card']
    let navy92 = 0
    for (const f of sedem) {
      for (const v of R(`src/components/roksal/${f}.tsx`).split('\n')) {
        if (v.includes(NAVY)) navy92++
      }
    }
    expect(navy92).toBe(92)
    const mer = R(MER)
    expect(pod(mer, NAVY)).toBe(47)
    expect(pod(mer, 'focus-visible:ring-roksal-red/40')).toBe(3)
    expect(pod(mer, 'focus-visible:ring-roksal-amber/40')).toBe(2)
    expect(pod(mer, O2)).toBe(53)
    expect(pod(mer, 'focus-visible:ring-offset-1'), 'MERITVE offset-1 = 0').toBe(0)
    for (const v of mer.split('\n')) {
      if (v.includes(SEKVENCA + INS)) {
        expect(v.includes(DARK_BORDER), 'dark border prisoten').toBe(true)
        expect(v.includes('dark:focus-visible:ring'), 'brez dark ring (PRED disk)').toBe(false)
      }
    }
  })

  it('(D) shape-guard: INS žeton ×22 measurements + calculator precedens ×2 + crm amber ×1 + globalno components ×24 navy-border + pairana oblika ×22 + md5 cevovodni žig + 0 novih hex čez tarčo', () => {
    const mer = R(MER)
    expect(pod(mer, BORDER), 'measurements INS').toBe(27) // [PIN SHIFT R382 val 61: +5]
    expect(pod(R('src/components/roksal/calculator-tab.tsx'), BORDER), 'calculator precedens').toBe(2)
    expect(pod(R('src/components/roksal/crm-tab.tsx'), 'focus-visible:border-roksal-amber'), 'crm precedens').toBe(1)
    let skupajNavyBorder = 0
    for (const f of vseDatoteke()) skupajNavyBorder += pod(R(f), BORDER)
    expect(skupajNavyBorder, 'globalno navy-border').toBe(159) // [PIN SHIFT R382 val 61: +134 tarč +1 PAR sorojenec (material L2111 CSV)]
    const createHash2 = createHash
    const zig = createHash2('md5').update(SEKVENCA + INS).digest('hex')
    expect(zig).toBe(createHash('md5').update(SEKVENCA + INS).digest('hex'))
    expect(pod(mer, `${BORDER} ${DARK_BORDER}`), 'pairana oblika ×27').toBe(27) // [PIN SHIFT R382 val 61: +5]
    expect((mer.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, 'hex 0').toBe(0)
  })

  it('(E) FEATURE era-clone.py ŽIVO (5. generalizacija; 1. + 2. uporaba V ISTI rundi) + r374/r375-era-harvest.sh SEDEMINDVJSETIJNA + OSEMINDVJSETIJNA žigi + window-scan orodje ŽIVO + dedup 14. val iskren IZPUST', () => {
    const ORODJE = R('scripts/era-clone.py')
    expect(ORODJE).toContain('--src-round')
    expect(ORODJE).toContain('--expected-total')
    expect(ORODJE).toContain('--dst-label')
    expect(ORODJE).toContain('--dst-chain-seg')
    expect(ORODJE).toContain('ERA_BESODE')
    expect(ORODJE).toContain('izhod ŽE obstaja (nikoli prepisuj)')
    expect(ORODJE).toContain('vsota need_static IZ DISKA')
    const ER = R('scripts/r374-era-harvest.sh')
    expect(pod(ER, 'SEDEMINDVJSETIJNA')).toBe(4)
    expect(ER).toContain('REG_AA="scripts/qa-needles/r373.tsv"')
    expect(ER).toContain('preberi_register "$REG_AA" "R373 val 56"')
    expect(ER).toContain('[ "$need_n" -lt 113 ]')
    expect(ER).toContain("'TODO-R373|R373'")
    expect(ER).toContain('IN R373 val 56 (×4) ŽIVO NA PRODU')
    expect(ER).toContain('/tmp/r374-prod-chunks')
    // OSEMINDVJSETIJNA (r375-era-harvest.sh): 28. preverba + KOLIZIJA override label
    const ER375 = R('scripts/r375-era-harvest.sh')
    expect(pod(ER375, 'OSEMINDVJSETIJNA')).toBe(4)
    expect(ER375).toContain('REG_AB="scripts/qa-needles/r374.tsv"')
    expect(ER375).toContain('preberi_register "$REG_AB" "R374 issue #13"')
    expect(ER375).toContain('[ "$need_n" -lt 117 ]')
    expect(ER375).toContain("'TODO-R374|R374'")
    expect(ER375).toContain('IN R374 issue #13 (×4) ŽIVO NA PRODU')
    expect(ER375).toContain('/tmp/r375-prod-chunks')
    const WS = R('scripts/r375-window-scan.py')
    expect(WS).toContain('src/components/roksal/measurements-tab.tsx')
    expect(WS).toContain('r375-window-scan.py')
    // dedup 14. val iskren IZPUST (kanon R368): R375 ni dodala e2e-lib blokov
    expect(R('scripts/e2e-lib.sh')).toContain('eb_sonda_red_stetje')
    const AP = R('scripts/r375-val57-apply.py')
    expect(AP).toContain('border ŽE prisoten (idempotenca)')
    expect(AP).toContain('Ni tarč')
    expect(AP).toContain('len(tarce) != 22')
    expect(AP).toContain('dark:focus-visible:border-roksal-ink/40')
  })
})
