import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

// R377 STIL val 58 — transition-colors SKLADNOST na edinem nativnem
// navy/40 fokus gumbu dashboard-tab.tsx BREZ transition žetona (NON-ring
// kandidat #1 iz R375 handoverja) + FEATURE era-clone.py --server-probe
// (6. korak generalizacije era verige: labeli regex vidi poslovne runde
// brez val ['R374 issue #13'] + SERVER-NEEDLE razširitev — dvodelni dokaz
// needle v .next/server + determinističen vedenjski probe lastniške rute;
// DEVETINDVJSETIJNA r376-era-harvest.sh [29 registrov, ≥121] EXIT=0 + TRIDESETIJNA r377-era-harvest.sh [30 registrov, ≥125] EXIT=0 — obe ob 1.
// teku — PRVI EXIT=0 od mešanega r374 registra) + iskren IZPUST e2e-lib
// dedup 15. val (kanon R368: le ob novih ×3 ponovitvah).
//
// Disk resnica (LEKCIJA R364 (4) — census iz diska):
//   transition-colors skladnost znotraj navy/40 fokus družine:
//     KIT <Button> nosi transition-all iz ui/button baze (ni gap na
//     vrstici), <Input> ima lastni INPUT fokus jezik (izjema #2) →
//     edini gap = NATIVNI <button> 'Počisti iskanje projektov' (L1628;
//     disk PRED: 11 'transition-colors' žetonov v datoteki, nativni gumb
//     brez transition = 1);
//   amber/red bordered ×2 (measurements L5326/L5355 PRED val 57 triažo)
//     = <span cursor-help> chipi — NE fokusabilni, border-pariteta N/A
//     → iskreno izpuščeno (r375.tsv komentar ostaja resnica);
//   outline triaža '0 preurejanj' (val 57) se NE dotikamo — le
//     transition-colors INS.
//   val 58 = 1 × INS ' transition-colors' PRED 'focus-visible:ring-2'
//     (kanon measurements L4754/L4768: transition TIK PRED fokus nizom);
//     +18 znakov, in-place 0 novih vrstic, idempotenca prek
//     r377-val58-apply.py (fail-closed: delta ≠ 18 abort; tarča iz diska
//     vsak tek — aria sidro + hoja nazaj).

const R = (f: string): string => readFileSync(join(process.cwd(), f), 'utf-8')
const DASH = 'src/components/roksal/dashboard-tab.tsx'
const MER = 'src/components/roksal/measurements-tab.tsx'

const ARIA = 'aria-label="Počisti iskanje projektov"'
const RING = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
const NOVO = 'transition-colors ' + RING
const NEEDLE = 'absolute right-3 top-1/2 -translate-y-1/2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 rounded'
// r371 evolucija (val 54 era diskriminator N3 — ISTA vrstica kot val 58 tarča)
const STARI = 'top-1/2 -translate-y-1/2 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
const NASLEDNICA_N3 = 'top-1/2 -translate-y-1/2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'

describe('R377 stil val 58 — transition-colors skladnost dashboard nativni gumb', () => {
  it('INS disk resnica: nativni gumb nosi transition-colors TIK PRED fokus nizom (×1 po poznani tarči iz aria sidra)', () => {
    const src = R(DASH)
    const vrstice = src.split('\n')
    const sidra = vrstice.filter((l) => l.includes(ARIA))
    expect(sidra.length).toBe(1)
    const ai = vrstice.findIndex((l) => l.includes(ARIA))
    let tarca = -1
    for (let j = ai; j >= Math.max(0, ai - 8); j--) {
      if (vrstice[j].includes('className') && vrstice[j].includes('focus-visible:ring-roksal-navy/40')) { tarca = j; break }
    }
    expect(tarca).toBeGreaterThan(-1)
    expect(vrstice[tarca].split(NOVO).length - 1).toBe(1)
    expect(vrstice[tarca]).toContain('-translate-y-1/2 transition-colors focus-visible:ring-2')
    // polni className (needle) točno ×1 v datoteki — per-datoteka kanon
    expect(src.split(NEEDLE).length - 1).toBe(1)
  })

  it('števcguards: transition-colors 12→23 [EVOLVED R388 val 66 +11 PRE anchorjev], vrstice in-place 3189, aria + ring-offset rounded zamrznjena', () => {
    const src = R(DASH)
    // R377 žig: transition-colors števec PO val 58 = 12 (PRED = 11, disk resnica)
    // EVOLVED R388 val 66: +11 transition-colors INS na dashboard (hover gladkost)
    expect(src.split('transition-colors').length - 1).toBe(23)
    expect(src.split('\n').length).toBe(3189) // in-place INS — 0 novih vrstic
    expect(src.split(ARIA).length - 1).toBe(1)
    expect(src.split('focus-visible:ring-offset-2 rounded').length - 1).toBe(1)
    // ni dvojitev na tarčni vrstici (r377-val58-apply.py fail-closed ujel
    // zamik replace samo na ring-2 — PO dokaz: RING točno ×1 NA VRSTICI)
    const tarcaVrstica = src.split('\n').find((l) => l.includes(NEEDLE))
    if (!tarcaVrstica) throw new Error('FAILOVEDANO: needle vrstica ni najdena v dashboard-tab')
    expect(tarcaVrstica.split(RING).length - 1).toBe(1)
  })

  it('družinski census: ring-2+navy/40 = 7 vrstic — 4 z transition na vrstici [val 58 tarča + L1756 nativni + 2 KIT inline] + 3 KIT brez žetona na vrstici (transition-all iz baze — dokumentirano)', () => {
    const vrstice = R(DASH).split('\n')
    const ring2 = vrstice.filter((l) => l.includes('focus-visible:ring-2') && l.includes('focus-visible:ring-roksal-navy/40'))
    expect(ring2.length).toBe(7) // R377 disk resnica (LEKCIJA R364 (4): census IZ DISKA, ne ocena)
    const sTransition = ring2.filter((l) => l.includes('transition'))
    const brezTransition = ring2.filter((l) => !l.includes('transition'))
    expect(sTransition.length).toBe(4) // val 58 tarča + nativni L1756 + 2 KIT z inline žetonom
    expect(brezTransition.length).toBe(3) // KIT <Button> — transition-all iz ui/button baze
    // nativni gumbi z ring-2+navy/40: vsak nosi transition (val 58 zapre edini gap)
    const nativniBrez = ring2.filter((l) => !l.includes('transition') && !l.includes('shrink-0') && !l.includes('mt-1 w-full'))
    expect(nativniBrez.length).toBe(0)
    // KIT baza resnično nosi transition-all (dokaz iz vira, ne trditev)
    const kit = R('src/components/ui/button.tsx')
    expect(kit.includes('transition-all')).toBe(true)
    // <Input> izjema #2: ring brez ring-2 (lastni fokus jezik) — ni tarča
    const inputVrstica = vrstice.filter((l) => l.includes('pl-9 h-10 bg-background focus-visible:ring-roksal-navy/40'))
    expect(inputVrstica.length).toBe(1)
    expect(inputVrstica[0].includes('focus-visible:ring-2')).toBe(false)
  })

  it('sestrska datoteka izolirana: needle ×0 v measurements-tab (dashboard-specifični prefix) — amber/red chipi ostajajo spani', () => {
    const mer = R(MER)
    expect(mer.includes(NEEDLE)).toBe(false)
    // amber/red cursor-help chipi: NE fokusabilni — border-pariteta N/A
    // (r375.tsv izjema ostaja disk resnica; brez lažnih 'popravkov')
    expect(mer.split('border-roksal-amber/40 bg-roksal-amber/10 px-2 py-0.5 text-2xs font-medium text-roksal-amber cursor-help').length - 1).toBe(1)
    expect(mer.split('border-roksal-red/40 bg-roksal-red/10 px-2 py-0.5 text-2xs font-medium text-roksal-red cursor-help').length - 1).toBe(1)
  })

  it('determinizem: md5 polnega novtega className pričakovano prijet (drift detekcija)', () => {
    const md5 = createHash('md5').update(NEEDLE).digest('hex')
    // md5(NEEDLE) = 37c9e224a0bcd7f019f5035f10df018a — otis transformacije
    // val 58; vsak prihodnji dotik te vrstice ga premakne GLASNO (kanon
    // val 52 trio md5 prijeti)
    expect(md5).toBe('37c9e224a0bcd7f019f5035f10df018a')
    // apply orodje obstaja na disku in je idempotentno po zasnovi (abort na ŽE prisoten)
    const apply = R('scripts/r377-val58-apply.py')
    expect(apply.includes('idempotenca')).toBe(true)
    expect(apply.includes('FAILOVEDANO: delta')).toBe(true)
  })

  it('r371 register evolucija: stari N3 needle komentiran (EVOLVED R377), naslednica need_static ŽIVO, need_static števec r371 = 4 nespremenjen', () => {
    const tsv = R('scripts/qa-needles/r371.tsv')
    const podatki = tsv.split('\n').filter((l) => l && !l.startsWith('#'))
    // need_static disk števec r371 nespremenjen = 4 (era vsote ≥121 za r347–r375 veljavne)
    expect(podatki.filter((l) => l.split('\t').pop() === 'need_static').length).toBe(4)
    // stari N3: SAMO kot komentirana EVOLVED vrstica (zgodovina dobesedno)
    expect(tsv.split('\n').filter((l) => l.startsWith('# ' + STARI + '\t')).length).toBe(1)
    expect(tsv).toContain('EVOLVED R377')
    // stari niz NI več podatkovna vrstica; naslednica (z transition-colors) JE
    expect(podatki.some((l) => l.startsWith(STARI + '\t'))).toBe(false)
    expect(podatki.filter((l) => l.startsWith(NASLEDNICA_N3 + '\t')).length).toBe(1)
    // N3 naslednica ŽIVO v dashboard viru (bodoči buildi + era žetve)
    expect(R(DASH).split(NASLEDNICA_N3).length - 1).toBe(1)
  })
})
