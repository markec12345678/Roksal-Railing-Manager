// r369-stil-val52.test.ts — R369 MANDATORY STIL val 52: ring OBLIKOVNA
// pariteta navy+ink PARIŠKIH vrstic (svetlo+temno dvojčki na ISTIH
// elementih — per-barvni split kanon nadaljevanje: navy = val 43–49
// površinsko, red = val 50, amber = val 51, navy+ink pari = val 52) +
// FEATURE e2e-lib dedup 9. val.
//
// Disk resnica (LEKCIJA R364 (4) — census iz diska scripts/r369-census.py):
//   roksal-ink/40 ×12 = VSI dark: dvojčki navy/40 na istih vrsticah
//   (termini-card ×6, bottom-nav ×2, notification-center ×3,
//   quick-actions-fab ×1), VSE 12 vrstic brez focus-visible:ring-offset
//   PRED rundi. PO rundi: 12 × EN ` focus-visible:ring-offset-2` TIK ZA
//   navy/40 (offset žeton je TEMA-NEODVISEN — pokrije svetlo navy/40 IN
//   temno ink/40 varianto ISTEGA elementa; kanon R368 notification L748
//   'EN offset pokrije svetlo+temno'); census po: ink/40 = {'O2': 12}
//   razcep = 0; navy gap 77 → 65 (točno 12 parov rešenih — ostali navy
//   rep = val 53+ kandidat, iskreno dokumentirano).
//
// In-place = 0 novih vrstic (wcLinije — LEKCIJA R367 (1): \n semantika);
// 0 novih hex (števci 4/0); aria/title ZAMRZNJENI (ring-only runda —
// val 44–51 precedens).
//
// Stale-pin PRED-skan ČIST (iskreno NIČ shiftano): r167 regexa preživita
// (vstavljanje je ZA navy/40, NE za ink/40); r214 števca navy/40=2 in
// ink/40=2 (bottom-nav) nespremenjena; r268 pin = team-tab (izven tarče);
// r361 (E) = crm-tab (izven tarče).
//
// DOKUMENTIRANI NAMERNI IZJEMI (iskreno, ne tiho — LEKCIJA R366 (5)):
//  - ui/* kit ring/50 ×14 (shadcn fokus jezik ring-[3px] brez offseta —
//    drugačen dizajn sistemski sloj, ni brand površina);
//  - top-bar white/60 + ring-offset-0 ×3 (namerna gosta površina —
//    iskalni gumb v top bar).
//
// FEATURE e2e-lib dedup 9. val: eb_sonda_red_stetje — rdeči trio
// (mainRed + mainRedOffset2 + mainRedBrezOffset) byte-identičen ×2 v
// zamrznjenem r368-qa-spot.sh (A + C — per-blok md5
// 03c8497dc9baf54c87e78a7dcb6f8ad8 nad 449 bajti, potrjeno prek python
// r369-trio-identity.py) IN skrajšani 2-poljni par byte-identičen ×3 (md5
// 640fec6de79293af75c9b021268b8a15 nad 278 bajti — prag LEKCIJE R352 (×3)
// IZENAČEN; polni trio ×2 = precedens eb_sonda_status_chipi R367
// proaktiven pri ×2). Kanon = POLNI trio 3-poljni samostojen eval
// (B-okrnjena oblika se NE kanonizira — 2 polja izgubita BrezOffset
// resnico); regex /ring-red-\d+\// ohranjen natanko iz inline blokov
// (rdeči žetoni so heterogeni: red-400/50, red-400/60, red-500,
// red-600/40 — regex je INLINE resnica); 1. uporaba v r369-qa-spot.sh V
// ISTI rundi (LEKCIJA R362 (3): kanon ne sme biti papir); zamrznjeni
// spot skripti NI mutirani (kanon R361–R368).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const R = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')
const pod = (src: string, needle: string): number =>
  (src.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
// LEKCIJA R367 (1): wc -l šteje \n znake — split('\n') da +1 ob končni
// prazni vrstici; guard mora šteti ISTO semantiko kot orodje (wc -l).
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const DATOTEKE = [
  ['roksal/termini-card.tsx', 539],
  ['roksal/bottom-nav.tsx', 207],
  ['roksal/notification-center.tsx', 969],
  ['roksal/quick-actions-fab.tsx', 122],
] as const
const VIRI = DATOTEKE.map(([f]) => [f, R(`src/components/${f}`)] as const)

describe('r369 stil val 52 — navy+ink PARIŠKA pariteta + e2e-lib dedup 9. val', () => {
  it('(A) PARITETA guard: vsaka pariška vrstica (navy/40 + ink/40) nosi ring-offset-2 (razcep = 0; 12 vrstic) + barvni žigi nespremenjeni (navy 6/2/3/1, ink 6/2/3/1) + offset-1 = 0', () => {
    let parskih = 0
    for (const [f, src] of VIRI) {
      for (const [i, v] of src.split('\n').entries()) {
        const pari = v.includes('focus-visible:ring-roksal-navy/40') && v.includes('dark:focus-visible:ring-roksal-ink/40')
        if (!pari) continue
        parskih++
        expect(
          v.includes('focus-visible:ring-offset-2'),
          `${f}:${i + 1} pariška vrstica brez offset-2`,
        ).toBe(true)
        expect(
          v.includes('ring-offset-1'),
          `${f}:${i + 1} pariška vrstica še vedno offset-1`,
        ).toBe(false)
      }
    }
    expect(parskih).toBe(12)
    // barvni žigi nespremenjeni (shape-only runda — le offset vstavljen)
    const zigi: Array<[string, number, number]> = [
      ['roksal/termini-card.tsx', 6, 6],
      ['roksal/bottom-nav.tsx', 2, 2],
      ['roksal/notification-center.tsx', 3, 3],
      ['roksal/quick-actions-fab.tsx', 1, 1],
    ]
    for (const [f, navy, ink] of zigi) {
      const src = R(`src/components/${f}`)
      expect(pod(src, 'focus-visible:ring-roksal-navy/40'), `${f} navy/40`).toBe(navy)
      expect(pod(src, 'dark:focus-visible:ring-roksal-ink/40'), `${f} ink/40`).toBe(ink)
    }
    // vsaka ink/40 pojavitev je na vrstici, ki zdaj nosi offset (tema-neodvisen
    // žeton pokrije tudi temno varianto — preverba per vrstica)
    for (const [f, src] of VIRI) {
      for (const [i, v] of src.split('\n').entries()) {
        if (!v.includes('dark:focus-visible:ring-roksal-ink/40')) continue
        expect(
          v.includes('focus-visible:ring-offset-2'),
          `${f}:${i + 1} ink/40 brez offseta (temna varianta pokrita)`,
        ).toBe(true)
      }
    }
  })

  it('(B) era-diskriminatorji val 52: N1 ×10 / N2 ×1 / N3 ×1 / N4 ×1 (POJAVITVE grep -o — LEKCIJA R365 (2)) + izpuščeni kandidat NI ×0 dokumentirano + 2 namerni izjemi', () => {
    const vse = VIRI.map(([, s]) => s).join('')
    // N1: 10 kontiguirnih pariških vrstic (termini ×6, bottom-nav ×2,
    // notification L881 ×1, quick-actions ×1) — offset MED svetlo in temno
    expect(pod(vse, 'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 dark:focus-visible:ring-roksal-ink/40')).toBe(10)
    // N2: notification L855 split vrstica (offset pred disabled:)
    expect(pod(vse, 'hover:text-roksal-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed')).toBe(1)
    // N3: notification L940 split vrstica (offset pred active:)
    expect(pod(vse, 'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 active:scale-[0.97]')).toBe(1)
    // N4: bottom-nav L123 file-diskriminator (outline-none + ring-2 MED
    // md:text-[11px] in navy/40 — žeton vrstnega reda, LEKCIJA R363)
    expect(pod(vse, 'md:text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')).toBe(1)
    // izpuščen kandidat (iskreno v registru dokumentiran): 'navy/40 offset-2
    // disabled:' BREZ hover prefixa — NI ×0 v HEAD (×1 starejša era v
    // inclinometer-tab, izven tarče val 52); nad 4 tarčnih datotek ×1 (nov
    // L855). Disk resnica per datoteka, ne zlita (LEKCIJA R368 (1)):
    expect(pod(vse, 'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed')).toBe(1)
    const inclinometer = R('src/components/roksal/inclinometer-tab.tsx')
    expect(pod(inclinometer, 'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed')).toBe(1)
    // NAMERNA IZJEMA 1 (dokumentirana, ne tiho): ui kit ring/50 fokus jezik
    // ring-[3px] BREZ offseta — shadcn sistemski sloj, ni brand površina
    const gumb = R('src/components/ui/button.tsx')
    expect(pod(gumb, 'focus-visible:ring-ring/50')).toBe(1)
    expect(pod(gumb, 'focus-visible:ring-offset-2')).toBe(0)
    const vhod = R('src/components/ui/input.tsx')
    expect(pod(vhod, 'focus-visible:ring-ring/50')).toBe(1)
    expect(pod(vhod, 'focus-visible:ring-offset-2')).toBe(0)
    // NAMERNA IZJEMA 2: top-bar white/60 + ring-offset-0 ×3 (gosta površina)
    const topBar = R('src/components/roksal/top-bar.tsx')
    expect(pod(topBar, 'ring-white/60 focus-visible:ring-offset-0')).toBe(3)
  })

  it('(C) stale-pini: 1 PIN SHIFTAN (r167 okno 400→430 z žigom — ulovljen s FULL vitestom, LEKCIJA) + ostali PRED-skan čist (r167 sosledja, r214 števca 2/2, r268/r361 izven tarče)', () => {
    const termini = R('src/components/roksal/termini-card.tsx')
    // r167-termini-filtri-dark.test.ts:197 — ink/40 + dark:hover sosledje
    // (vstavljanje ZA navy/40 → ink/40 sosledje z dark:hover NI dotaknjeno)
    expect(termini.match(/dark:focus-visible:ring-roksal-ink\/40 dark:hover:text-roksal-ink/)).not.toBeNull()
    // r167:199 — ink/40 + zapirajoči narekovaj + onClick setSamoMoje
    expect(termini.match(/dark:focus-visible:ring-roksal-ink\/40"\s*\n\s*onClick=\{\(\) => setSamoMoje/)).not.toBeNull()
    // PIN SHIFT r167 okno (edini shiftani pin te runde): dejansko okno
    // <Button → 'Samo moje' 380→408 (val 52 vstavil 28 znakov) — kvantifikator
    // {0,400} bi FAILAL; shiftan na {0,430} z žigom [PIN SHIFT R369 val 52]
    // (iskreno: PRED-skan ga NI ulovil — ulov ga je FULL vitest; LEKCIJA:
    // pre-skan mora enumerirati VSE okenske kvantifikatorje nad tarčnimi
    // datotekami, ne samo sosledja operacijskega žetona)
    const r167 = R('src/lib/__tests__/r167-termini-filtri-dark.test.ts')
    expect(r167).toContain('[PIN SHIFT R369 val 52: okno 400→430')
    expect(r167).toContain('{0,430}?Samo moje')
    expect(termini.match(/\{myUserId && \(\s*<Button[\s\S]{0,430}?Samo moje/)).not.toBeNull()
    expect((termini.match(/\{myUserId && \(\s*<Button[\s\S]{0,400}?Samo moje/) ?? [])).toHaveLength(0) // stari pin res ne gre več — shift potreben
    // r214-central-navigate-strazar.test.ts:145 — bottom-nav števca 2/2
    const bottomNav = R('src/components/roksal/bottom-nav.tsx')
    expect(bottomNav.match(/focus-visible:ring-roksal-navy\/40/g)?.length).toBe(2)
    expect(bottomNav.match(/dark:focus-visible:ring-roksal-ink\/40/g)?.length).toBe(2)
    // r268-ekipa-stanje-pdf.test.ts:290 — team-tab pin (izven tarče, ŽIV)
    const teamTab = R('src/components/roksal/team-tab.tsx')
    expect(teamTab).toContain('className="h-8 px-2.5 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"')
    // r361-stil-val44 (E) — crm-tab pariteta 13/13 (izven tarče, ŽIV)
    const crm = R('src/components/roksal/crm-tab.tsx')
    expect(pod(crm, 'focus-visible:ring-roksal-navy/40')).toBe(13)
    expect(pod(crm, 'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')).toBe(13)
  })

  it('(D) 0 novih hex s ŠTETJEM per datoteka + in-place vrstice (wcLinije — LEKCIJA R367 (1)) + aria/title ZAMRZNJENI', () => {
    for (const [f] of DATOTEKE) {
      const src = R(`src/components/${f}`)
      // hex števec po NEŽELJENEM regexu direktno (pod() je za LITERALE —
      // escapal bi znakovne razrede; LEKCIJA R368 (2))
      expect((src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, `${f} hex`).toBe(0)
    }
    const vrstice: Array<[string, number]> = [
      ['roksal/termini-card.tsx', 539],
      ['roksal/bottom-nav.tsx', 207],
      ['roksal/notification-center.tsx', 969],
      ['roksal/quick-actions-fab.tsx', 122],
    ]
    for (const [f, baza] of vrstice) {
      expect(wcLinije(R(`src/components/${f}`)), `${f} vrstice`).toBe(baza)
    }
    const ariaTitle: Array<[string, number, number]> = [
      ['roksal/termini-card.tsx', 5, 7],
      ['roksal/bottom-nav.tsx', 2, 0],
      ['roksal/notification-center.tsx', 7, 6],
      ['roksal/quick-actions-fab.tsx', 3, 0],
    ]
    for (const [f, aria, title] of ariaTitle) {
      const src = R(`src/components/${f}`)
      expect(pod(src, 'aria-label='), `${f} aria-label`).toBe(aria)
      expect(pod(src, 'title='), `${f} title`).toBe(title)
    }
  })

  it('(E) FEATURE dedup 9. val: helper ŽIV + IIFE invariant + ENOVRSTIČNI rep + prag dokaz (trio ×2 in par ×3 byte-identična) + poraba V ISTI RUNDI + zamrznjeni NI mutirani', () => {
    const lib = R('scripts/e2e-lib.sh')
    // helper definicija natanko ×1 + navy predhodnik ostaja (nespremenjen)
    expect(pod(lib, 'eb_sonda_red_stetje() {')).toBe(1)
    expect(pod(lib, 'eb_sonda_navy_stetje() {')).toBe(1)
    // IIFE ovojnica OBVEZNA (r231 invariant) + kanon = POLNI trio
    expect(pod(lib, '(()=>{return JSON.stringify({mainRed:')).toBe(1)
    expect(lib).toContain('mainRedBrezOffset:')
    // ENOVRSTIČNI IIFE rep — definicijsko telo je 1 vrstica eval + 1 vrstica }
    const vrstice = lib.split('\n')
    const defIdx = vrstice.findIndex((v) => v.startsWith('eb_sonda_red_stetje() {'))
    expect(defIdx).toBeGreaterThan(-1)
    expect(vrstice[defIdx + 1]).toContain('agent-browser eval "(()=>{return JSON.stringify({mainRed:')
    expect(vrstice[defIdx + 2]).toBe('}')
    // prag dokaz iz zamrznjenega r368-qa-spot.sh: polni trio windows ×2
    // (per-blok — LEKCIJA: per-blok okno, ne križno-bločni ulov) + par ×3
    const spot = R('scripts/r368-qa-spot.sh')
    const spotVrstice = spot.split('\n')
    const trioj: string[] = []
    for (let i = 0; i < spotVrstice.length; i++) {
      if (!spotVrstice[i].includes('mainRed:') || spotVrstice[i].includes('mainRedBrezOffset:')) continue
      for (let j = i; j < Math.min(i + 4, spotVrstice.length); j++) {
        if (spotVrstice[j].includes('mainRedBrezOffset:')) {
          trioj.push(spotVrstice.slice(i, j + 1).join('\n'))
          i = j
          break
        }
      }
    }
    expect(trioj.length).toBe(2)
    expect(new Set(trioj.map((w) => createHash('md5').update(w).digest('hex'))).size).toBe(1)
    // par okna: regex semantika ISTA kot python dokaz (r369-trio-identity.py)
    // — okno se konča pri 1. '.length', brez končne vejice (LEKCIJA R368 (1):
    // okenska semantika dokaznega orodja, ne celovrstična — celovrstična bi
    // vključila vejico A/C in brez vejice B → lažni 2-md5 razcep)
    const pari = [...spot.matchAll(/mainRed:[\s\S]*?mainRedOffset2:[\s\S]*?\.length/g)].map((m) => m[0])
    expect(pari.length).toBe(3)
    expect(new Set(pari.map((w) => createHash('md5').update(w).digest('hex'))).size).toBe(1)
    // poraba V ISTI RUNDI (LEKCIJA R362 (3): kanon ne sme biti papir) —
    // števec KLIČNIH vrstic ^eb_sonda_red_stetje$ /m (pojavitve ≠ klici —
    // LEKCIJA R368 (3): omembe v komentarjih ne štejejo)
    const r369spot = R('scripts/r369-qa-spot.sh')
    expect((r369spot.match(/^eb_sonda_red_stetje$/gm) ?? []).length).toBe(1)
    expect((r369spot.match(/^eb_sonda_navy_stetje$/gm) ?? []).length).toBe(2)
    // zamrznjeni spot skripti NI mutirani (kanon R361–R368): ne vsebujejo
    // novega helperja
    expect(spot.includes('eb_sonda_red_stetje')).toBe(false)
    expect(R('scripts/r367-qa-spot.sh').includes('eb_sonda_red_stetje')).toBe(false)
  })
})
