// ---------------------------------------------------------------------------
// R367 — MANDATORY STIL val 50 (LEKCIJA R346 kanon, per-barvni split —
// precedens R365 (3)): ring OBLIKOVNA pariteta rdeče focus družine —
// 5 članov čez 4 datoteke, vsi nosijo focus-visible:ring-2 +
// focus-visible:ring-offset-2; BARVNI ŽIGI bajtno nespremenjeni
// (destruktivna semantika r236: ring-red-400/50 ×3, ring-red-400/60 ×1,
// ring-red-600/40 ×1 — opacity/tone ostanejo kot so, samo oblika se
// poravna). In-place = 0 novih vrstic (logistics 3294, photo 2684,
// sketch 938, material 2366 — prst varovalka združljiva). 0 novih hex
// (števci 1/12/14/0 pred = po — LEKCIJA R360 (4)).
//
// Disk resnica (šteje iz diska — LEKCIJA R364 (4)):
//   logistics L2732: ring-2 + red-400/50, brez offseta  → +offset-2
//   logistics L3081: red-400/50 BREZ ring-2 (!)         → +ring-2 +offset-2
//   photo L2378:     ring-2 + red-400/50, brez offseta  → +offset-2
//   sketch L602:     ring-2 + red-400/60, brez offseta  → +offset-2
//   material L2352:  ring-2 + red-600/40 + offset-1     → offset-1→2
//     (val 49 jo je iskreno pustil izven — val 50 zaključi per-barvno
//     družino; stale pin lastnega r366 testa shiftan V ISTI rundi)
//
// Stale pini shiftani V ISTI rundi (PRED-scan po VSEH testih na
// ring-red-400/50|60 + ring-red-600/40): r365-stil-val48 (A) offset-2
// števec 0→2, r244-wave6 L236 eksakten pin (ring-2+offset-2 vstavljen MED
// barvo in press-scale — LEKCIJA R363 vzorec), r366-stil-val49 (A)
// material red pričakovanje offset-1→2. r236:301 prefix pin PREŽIVI
// (toContain se ne seká vstavitvi za pinom).
//
// FEATURE (e2e-lib dedup 7. val): NOV pomočnik eb_sonda_status_chipi —
// 2-poljna statusChipi sonda byte-identična ×2 (r365 D + r366 D) —
// PROAKTIVEN kanon pri 2. ponovitvi (LEKCIJA R362 (3); precedens
// eb_sonda_ring_pariteta R362 / eb_pocakaj_zalogo R364); poraba ob 1.
// uporabi v r367-qa-spot.sh C V ISTI rundi; zamrznjeni NI mutirani.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOG = readFileSync(join(process.cwd(), 'src/components/roksal/logistics-tab.tsx'), 'utf8')
const PHOTO = readFileSync(join(process.cwd(), 'src/components/roksal/photo-tab.tsx'), 'utf8')
const SKETCH = readFileSync(join(process.cwd(), 'src/components/roksal/sketch-canvas.tsx'), 'utf8')
const MATERIAL = readFileSync(join(process.cwd(), 'src/components/roksal/material-intelligence-tab.tsx'), 'utf8')

const R365T = readFileSync(join(process.cwd(), 'src/lib/__tests__/r365-stil-val48.test.ts'), 'utf8')
const R244W = readFileSync(join(process.cwd(), 'src/lib/__tests__/r244-wave6-rbac.test.ts'), 'utf8')
const R366T = readFileSync(join(process.cwd(), 'src/lib/__tests__/r366-stil-val49.test.ts'), 'utf8')
const R236T = readFileSync(join(process.cwd(), 'src/lib/__tests__/r236-dobavitelji-pdf.test.ts'), 'utf8')

const E2E_LIB = readFileSync(join(process.cwd(), 'scripts/e2e-lib.sh'), 'utf8')
const SPOT = readFileSync(join(process.cwd(), 'scripts/r367-qa-spot.sh'), 'utf8')
const R365_SPOT = readFileSync(join(process.cwd(), 'scripts/r365-qa-spot.sh'), 'utf8')
const R366_SPOT = readFileSync(join(process.cwd(), 'scripts/r366-qa-spot.sh'), 'utf8')

/** Štej POJAVITVE niza (grep -o semantika — LEKCIJA R365 (2)), ne vrstice. */
function pojavitve(vir: string, niz: string): number {
  return vir.split(niz).length - 1
}

/** Štej VRSTICE kot wc -l (štej znake \n — LEKCIJA R367: split('\n') da +1 ob
 * končni prazni vrstici; wc -l je kanon iz LEKCIJE R364 'ŠTEJ IZ DISKA'). */
function wcLinije(vir: string): number {
  return (vir.match(/\n/g) ?? []).length
}

describe('r367 STIL val 50 — ring OBLIKOVNA pariteta rdeče focus družine (per-barvni)', () => {
  it('(A) PARITETA guard: vseh 5 rdečih focus prstanov čez 4 datoteke nosi ring-2 + ring-offset-2 (razcep = 0); barvni žigi bajtno nespremenjeni (/50 ×3, /60 ×1, /600/40 ×1)', () => {
    // oblikovna pariteta = OBA žetona prisotna (barvni žeton smesta JU
    // mednju — LEKCIJA R363: žeton se vstavi MED dva dela; guard torej
    // preverja žetona LOČENO, ne kot sosednji niz)
    for (const [ime, vir] of [['logistics', LOG], ['photo', PHOTO], ['sketch', SKETCH], ['material', MATERIAL]] as const) {
      const vrstice = vir.split('\n').filter((l) => l.includes('focus-visible:ring-red-'))
      for (const l of vrstice) {
        expect(l.includes('focus-visible:ring-2'), `${ime}: rdeča vrstica brez ring-2: ${l.slice(0, 120)}`).toBe(true)
        expect(l.includes('focus-visible:ring-offset-2'), `${ime}: rdeča vrstica brez ring-offset-2: ${l.slice(0, 120)}`).toBe(true)
      }
    }
    // barvni žigi — števci POJAVITEV nespremenjeni (shape-only runda)
    expect(pojavitve(LOG, 'focus-visible:ring-red-400/50')).toBe(2)
    expect(pojavitve(PHOTO, 'focus-visible:ring-red-400/50')).toBe(1)
    expect(pojavitve(SKETCH, 'focus-visible:ring-red-400/60')).toBe(1)
    expect(pojavitve(MATERIAL, 'focus-visible:ring-red-600/40')).toBe(1)
    // material: offset-1 popolnoma izkoreninjen (val 49 navy + val 50 red)
    expect(pojavitve(MATERIAL, 'focus-visible:ring-offset-1')).toBe(0)
  })

  it('(B) era-diskriminatorji: val 50 NOVI className tokeni (×0 v HEAD pred rundo — fetch-first git grep GLASNO potrjeno ×5); multiplicita ×1 vsak (v POJAVITVAH — LEKCIJA R365 (2))', () => {
    const n1 = 'focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 press-scale'
    const n2 = 'focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:outline-hidden'
    const n3 = 'focus-visible:ring-red-400/60 focus-visible:ring-offset-2'
    const n4 = 'focus-visible:ring-red-600/40 focus-visible:ring-offset-2'
    expect(pojavitve(LOG, n1)).toBe(1)
    expect(pojavitve(PHOTO, n2)).toBe(1)
    expect(pojavitve(SKETCH, n3)).toBe(1)
    expect(pojavitve(MATERIAL, n4)).toBe(1)
    // 5. kandidat (logistics L2732, hover-red kontekst) — isti čanek kot N1
    // (isti chunk), dokumentiran, NE v TSV registru
    const n5 = 'dark:hover:bg-red-950/40 focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2'
    expect(pojavitve(LOG, n5)).toBe(1)
  })

  it('(C) stale pini shiftani V ISTI rundi: r365 (A) offset-2 števec 0→2; r244wave6 nov pin prisoten + star odsoten; r366 (A) material red offset-1→2; r236 prefix pin PREŽIVI', () => {
    // r365: shiftan števec (nov paritetni guard)
    expect(R365T).toContain("expect(LOG.split('focus-visible:ring-red-400/50 focus-visible:ring-offset-2').length - 1).toBe(2)")
    expect(R365T).not.toContain("focus-visible:ring-red-400/50 focus-visible:ring-offset-2').length - 1).toBe(0)")
    // r244wave6: nov eksakten pin z ring-2+offset-2, star odsoten
    expect(R244W).toContain('bg-red-600 text-[11px] text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 press-scale')
    expect(R244W).not.toContain('hover:bg-red-700 focus-visible:ring-red-400/50 press-scale')
    // r366: material red pričakovanje shiftano
    expect(R366T).toContain("expect(pojavitve(MATERIAL, 'ring-red-600/40 focus-visible:ring-offset-2')).toBe(1)")
    expect(R366T).not.toContain("ring-red-600/40 focus-visible:ring-offset-1')).toBe(1)")
    // r236: prefix pin preživi (destruktivna semantika dokumentirana)
    expect(R236T).toContain("toContain('focus-visible:ring-red-400/50')")
  })

  it('(D) 0 novih hex — števci najdišč per datoteka nespremenjeni (LEKCIJA R360 (4): dokaz s ŠTETJEM) + in-place vrstice (wc -l kanon)', () => {
    expect((LOG.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length).toBe(1)
    expect((PHOTO.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length).toBe(12)
    expect((SKETCH.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length).toBe(14)
    expect((MATERIAL.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length).toBe(0)
    // in-place: 0 novih vrstic (prst varovalka združljiva; wc -l semantika)
    expect(wcLinije(LOG)).toBe(3294)
    expect(wcLinije(PHOTO)).toBe(2684)
    expect(wcLinije(SKETCH)).toBe(938)
    expect(wcLinije(MATERIAL)).toBe(2366)
  })

  it('(E) e2e-lib dedup 7. val: eb_sonda_status_chipi ŽIV (proaktiven kanon pri ×2 — LEKCIJA R362 (3)) + poraba v r367-qa-spot C V ISTI rundi + zamrznjeni NI mutirani', () => {
    // helper ŽIV (ENOVRSTIČNI IIFE — r231 invariant vzorec)
    expect(E2E_LIB).toContain('eb_sonda_status_chipi() {')
    expect(E2E_LIB).toContain("return JSON.stringify({statusChipi:[...document.querySelectorAll('button')]")
    // prag ×2: polji byte-identični v obeh zamrznjenih skriptah
    const polje = "filter(b=>(b.getAttribute('aria-label')||'').startsWith('Filtriraj po statusu'))"
    expect(pojavitve(R365_SPOT, polje)).toBe(1)
    expect(pojavitve(R366_SPOT, polje)).toBe(1)
    // poraba V ISTI rundi (kanon ne sme biti papir)
    expect(SPOT).toContain('eb_sonda_status_chipi')
    // zamrznjeni spot skripti NI mutirani (kanon R361–R366)
    expect(R365_SPOT).not.toContain('eb_sonda_status_chipi')
    expect(R366_SPOT).not.toContain('eb_sonda_status_chipi')
  })
})
