// r370-stil-val53.test.ts — R370 MANDATORY STIL val 53: ring OBLIKOVNA
// pariteta navy/40 OFFSET-1 REP — normalizacija 1→2 (per-barvni split
// kanon nadaljevanje: navy = val 43–49 + val 52 pari, red = val 50,
// amber = val 51, navy offset-1 rep = val 53) + FEATURE QA-infra
// hardening 3. val (r370-window-scan.py — LEKCIJA R369 (2)
// formalizirana) + iskren IZPUST e2e-lib dedup 10. val.
//
// Disk resnica (LEKCIJA R364 (4) — census iz diska scripts/r369-census.py
// RE-POGNAN v R370, pred = po = isti skript):
//   navy/40 PRED: {'O2': 184, 'O1': 8, 'NONE': 54, '?INTERP': 3} gap 65
//   navy/40 PO:   {'O2': 192, 'O1': 0, 'NONE': 54, '?INTERP': 3} gap 57
//   val 53 = 8 × offset-1→2: calculator L4382, dashboard L2666,
//   invoice L1045/L1061/L1182, vodja L1274/L1290/L1306 — VSE
//   focus-visible gumbi; precedens val 47 (meritve 24×), val 49
//   (material 24×+2), val 51 (3× 1→2).
//   NONE ×54 + ?INTERP ×3 ISKRENO izven (val 54+ triaža); D2 spot dokaz:
//   'Izvozi CSV' dashboard L1678 = shadcn Button + brand barvni override
//   = val 52 namerna izjema #1 (kit fokus jezik ring-[3px], brez offseta
//   po dizajnu) — NI val 54 gap kandidat po doktrini izjem.
//
// Substitucija DOLŽINSKO NEVTRALNA (13→13 znakov) = 0 okenskih premikov;
// orodje r370-window-scan.py: 65 okenskih kvantifikatorjev enumeriranih
// nad 4 tarčami, 0 preozkih ob delta (PRED in PO apply — 1. uporaba V
// ISTI rundi, kanon LEKCIJE R362 (3): orodje ne sme biti papir).
// In-place = 0 novih vrstic (wcLinije — LEKCIJA R367 (1): \n semantika);
// 0 novih hex (števci 16/0/6/1 = HEAD); aria/title ZAMRZNJENI.
//
// Stale-pini: 6 SHIFTOV V ISTI RUNDI z žigi [PIN SHIFT R370 val 53] —
// r236 test L276 + r236-build L47/L48/L49 (L48 Izdaj/Plačan + L49 Prejem
// ŽE zastarela PRED R370 — najdba: legacy needleja izven trenutne
// needles verige [TSV registri r340+ edini vir qa-round needles faze];
// osvežena na disk resnico) + r237-build L43 + r237-prod-core L64
// (legacy, proaktiven shift — kanon R368 r244-prod-qa).
//
// FEATURE e2e-lib dedup 10. val: ISKRENO IZPUŠČEN — python skan
// r370-dedup-scan.py nad r365–r369 spot skriptami: 13 eval blokov, 13
// unikatnih (whitespace-normalizirano), 0 ponovitev ≥2 → NI kandidata
// (kanon R368: 'NI prag — iskreno izpustiti če ni ponovitve'; test (E)
// ponovno izračuna dokaz V TESTU).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const R = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')
const pod = (src: string, needle: string): number =>
  (src.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
// LEKCIJA R367 (1): wc -l šteje \n znake — split('\n') da +1 ob končni
// prazni vrstici; guard mora šteti ISTO semantiko kot orodje (wc -l).
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const DATOTEKE = [
  { f: 'roksal/calculator-tab.tsx', vrstice: 4489, navy40: 4, offset2: 3, hex: 16, aria: 16, title: 19 },
  { f: 'roksal/dashboard-tab.tsx', vrstice: 3188, navy40: 9, offset2: 4, hex: 0, aria: 13, title: 22 },
  { f: 'roksal/invoice-manager.tsx', vrstice: 1722, navy40: 10, offset2: 10, hex: 6, aria: 14, title: 18 },
  { f: 'roksal/vodja-dashboard.tsx', vrstice: 2199, navy40: 4, offset2: 4, hex: 1, aria: 25, title: 34 },
]

const NAVY = 'focus-visible:ring-roksal-navy/40'

describe('R370 stil val 53 — navy/40 offset-1 rep normalizacija 1→2', () => {
  it('(A) PARITETA guard: offset-1 = 0 v vseh 4 tarčah + navy/40 števci nespremenjeni (4/9/10/4) + offset-2 po pričakovanju (3/4/10/4 — [PIN SHIFT R371 val 54: števec +2 calculator L860/L4439 in +2 dashboard L1628/L1756 — val 54 NONE triaža je dodala offset-2 na novih surovih vrsticih ISTIH datotek]) + barvni žigi nespremenjeni', () => {
    for (const { f, vrstice, navy40, offset2 } of DATOTEKE) {
      const src = R(`src/components/${f}`)
      const vrstice2 = src.split('\n')
      let navy = 0, o2 = 0, o1 = 0
      for (const v of vrstice2) {
        if (v.includes(NAVY)) {
          navy++
          if (v.includes('focus-visible:ring-offset-2')) o2++
          if (v.includes('focus-visible:ring-offset-1')) o1++
        }
      }
      expect(o1, `${f}: offset-1 rep mora biti 0`).toBe(0)
      expect(navy, `${f}: navy/40 žetonov`).toBe(navy40)
      expect(o2, `${f}: vrstic z offset-2`).toBe(offset2)
      // barvni žigi bajtno nespremenjeni (shape-only runda — val 44–52 precedens)
      expect(pod(src, NAVY), `${f}: navy žeton pojavitve`).toBe(navy40)
      expect(wcLinije(src), `${f}: in-place vrstice`).toBe(vrstice)
    }
  })

  it('(B) era-diskriminatorji val 53: N1 ×1 / N2 ×1 / N3 ×1 / N4 ×1 (POJAVITVE per-datoteka — LEKCIJA R368 (6): cat brez ločila laže) + 2 izpuščena kandidata DOKAZANA (vodja niz = material ×8; invoice pill niz = crm ×1)', () => {
    const N1 = 'hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const N2 = 'bg-roksal-navy hover:bg-roksal-navy/90 text-white h-9 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const N3 = 'text-2xs font-medium press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const N4 = 'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 transition-colors'
    expect(pod(R('src/components/roksal/calculator-tab.tsx'), N1)).toBe(1)
    expect(pod(R('src/components/roksal/dashboard-tab.tsx'), N2)).toBe(1)
    expect(pod(R('src/components/roksal/invoice-manager.tsx'), N3)).toBe(1)
    expect(pod(R('src/components/roksal/dashboard-tab.tsx'), N4)).toBe(1)
    // izpuščeni kandidat 1: vodja L1274/1290/1306 niz = ISTI kot material (R242
    // press-scale pariteta ×8) — className-only needle NE diskriminira ere
    const VODJA_NIZ = 'h-6 gap-1 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    expect(pod(R('src/components/roksal/vodja-dashboard.tsx'), VODJA_NIZ)).toBe(3)
    expect(pod(R('src/components/roksal/material-intelligence-tab.tsx'), VODJA_NIZ)).toBe(8)
    // izpuščeni kandidat 2: invoice L1045/L1061 pill niz = ISTI kot crm ×1
    const PILL_NIZ = 'h-8 gap-1.5 px-2.5 text-[11px] font-medium press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    expect(pod(R('src/components/roksal/invoice-manager.tsx'), PILL_NIZ)).toBe(2)
    expect(pod(R('src/components/roksal/crm-tab.tsx'), PILL_NIZ)).toBe(1)
    // dokumentirana izjema: 'Izvozi CSV' L1678 = shadcn kit override (BREZ
    // offseta po dizajnu — ring-[3px] jezik) — NI val 54 gap, ostaja NONE
    const D = R('src/components/roksal/dashboard-tab.tsx')
    expect(D).toContain('h-7 px-2 text-[11px] focus-visible:ring-roksal-navy/40')
  })

  it('(C) stale-pini: 6 SHIFTOV z žigi [PIN SHIFT R370 val 53] (novi prisotni, stari odsotni) + 2 ŽE zastarela legacy needleja osvežena + preživetja (r366 bere r242 TEST, r364 MERITVE-only)', () => {
    const ZIG = '[PIN SHIFT R370 val 53'
    // (1) r236 test: offset-2" + žig, star odsoten
    const T236 = R('src/lib/__tests__/r236-dobavitelji-pdf.test.ts')
    expect(T236).toContain("focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2\"")
    expect(T236).toContain(ZIG)
    expect(T236.includes('ring-offset-1')).toBe(false)
    // (2)(3)(4) r236-build-needles: 3 nova labela z žigi; offset-1 = 0
    const B236 = R('scripts/r236-build-needles.sh')
    expect(pod(B236, ZIG)).toBe(3)
    expect(B236).toContain('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2" "R236 invoice CSV pill navy/40 [PIN SHIFT R370 val 53')
    expect(B236).toContain('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2" "R236 Prejem navy/40 [PIN SHIFT R370 val 53')
    expect(B236).toContain('bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
    expect(B236.includes('ring-offset-1')).toBe(false)
    // (5) r237-build-needles L43
    const B237 = R('scripts/r237-build-needles.sh')
    expect(B237).toContain('focus-visible:ring-offset-2 transition-colors')
    expect(B237).toContain('R237 dashboard navy gumb fokus [PIN SHIFT R370 val 53')
    expect(B237.includes('ring-offset-1')).toBe(false)
    // (6) r237-prod-core L64 (legacy, proaktiven — kanon R368)
    const PC237 = R('scripts/r237-prod-core.sh')
    expect(PC237).toContain('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')
    expect(PC237).toContain('[PIN SHIFT R370 val 53')
    expect(PC237.includes('ring-offset-1')).toBe(false)
    // preživetja: r366 (C) not.toContain bere r242 TEST datoteko (nespremenjena)
    const R242T = R('src/lib/__tests__/r242-narocila-rbac.test.ts')
    expect(R242T).toContain('"h-8 text-xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"')
    expect(R242T.includes('ring-offset-1')).toBe(false)
    // r364 (A) MERITVE-only offset-1 = 0 (measurements nedotaknjen — še vedno 0)
    const MERITVE = R('src/components/roksal/measurements-tab.tsx')
    expect(MERITVE.split('ring-offset-1').length - 1).toBe(0)
  })

  it('(D) 0 novih hex s ŠTETJEM per datoteka (16/0/6/1 = HEAD) + aria/title ZAMRZNJENI', () => {
    for (const { f, hex, aria, title } of DATOTEKE) {
      const src = R(`src/components/${f}`)
      // hex števec po NEŽELJENEM regexu direktno (pod() je za LITERALE —
      // escapal bi znakovne razrede; LEKCIJA R368 (2))
      expect((src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, `${f} hex`).toBe(hex)
      expect(pod(src, 'aria-label='), `${f} aria-label`).toBe(aria)
      expect(pod(src, 'title='), `${f} title`).toBe(title)
    }
  })

  it('(E) FEATURE QA-infra hardening 3. val: window-scan orodje ŽIVO + 65 okenskih kvantifikatorjev RE-ENUMERIRANIH V TESTU (0 preozkih) + dolžinska nevtralnost dokazana (13→13) + dedup 10. val IZPUST dokaz V TESTU (13/13/0) + era klon kanon', () => {
    // orodje ŽIVO z žigoma kanona
    const ORODJE = R('scripts/r370-window-scan.py')
    expect(ORODJE).toContain('\\{0,(\\d+)\\}')
    expect(ORODJE).toContain('r370-window-scan.py')
    expect(ORODJE).toContain('LEKCIJE R369 (2)')
    // re-enumeracija V TESTU (ISTA logika kot orodje — PER-TARČNA
    // enumeracija: test, ki bere 2 tarči, se šteje 2×, kanon orodja):
    // teste, ki berejo tarčo, regex literali z {0,N}/{M,N} okni
    const WIN = /\{0,(\d+)\}|\{(\d+),(\d+)\}/
    const TARCE = ['calculator-tab.tsx', 'dashboard-tab.tsx', 'invoice-manager.tsx', 'vodja-dashboard.tsx']
    let skupaj = 0
    const vsiTesti = readdirSync(join(process.cwd(), 'src/lib/__tests__')).filter((t) => t.endsWith('.test.ts'))
    for (const b of TARCE) {
      for (const t of vsiTesti) {
        const tsrc = R(`src/lib/__tests__/${t}`)
        if (!tsrc.includes(`/${b}`)) continue
        for (const line of tsrc.split('\n')) {
          if (!WIN.test(line)) continue
          for (const m of line.matchAll(/\/((?:[^/\\\n]|\\.)+)\//g)) {
            if (WIN.test(m[1])) skupaj++
          }
        }
      }
    }
    expect(skupaj).toBe(65)
    // dolžinska nevtralnost: polna žetona imata ISTO dolžino (27; sam rep
    // 'ring-offset-N' = 13) — 0 okenskih premikov
    expect('focus-visible:ring-offset-1'.length).toBe('focus-visible:ring-offset-2'.length)
    expect('focus-visible:ring-offset-1'.length).toBe(27)
    expect('ring-offset-1'.length).toBe('ring-offset-2'.length)
    expect('ring-offset-1'.length).toBe(13)
    // dedup 10. val IZPUST — dokaz V TESTU: 13 eval blokov, 13 unikatnih
    // [\s\S]*? = re.S semantika brez 's' flaga (TS1501 — target < es2018)
    const BLOKI = /agent-browser eval "JSON\.stringify\(\{([\s\S]*?)\}\)"/g
    const zetoni: string[] = []
    for (const s of ['r365', 'r366', 'r367', 'r368', 'r369']) {
      const src = R(`scripts/${s}-qa-spot.sh`)
      for (const m of src.matchAll(BLOKI)) {
        zetoni.push(createHash('md5').update((m[1] as string).replace(/\s+/g, '')).digest('hex'))
      }
    }
    expect(zetoni.length).toBe(13)
    expect(new Set(zetoni).size).toBe(13) // 0 ponovitev ≥2 → IZPUST utemeljen
    // era klon kanon: r370-era-harvest.sh ŽIV z 23. registrom + pragom 97
    const ERA = R('scripts/r370-era-harvest.sh')
    expect(ERA).toContain('REG_W="scripts/qa-needles/r369.tsv"')
    expect(ERA).toContain('[ "$need_n" -lt 97 ]')
    expect(ERA).toContain('TRIINDVJSETIJNA')
  })
})
