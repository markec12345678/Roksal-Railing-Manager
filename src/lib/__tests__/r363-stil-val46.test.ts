import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// R363 — STIL val 46: ring PARITETA inventory-tab družine (R362 kandidat;
// 1 datoteka × 1 družina — LEKCIJA R362 (1): DOM sonda R362 je dokazala
// 'družina ≠ datoteka', zato ta runda skenira TUDI vir datoteko po datoteki:
// fetch-first rg sken pokazal 23 × navy/40 [22 brez offset-2 + 1 že nosi]
// = VSI focus-visible ringi, 0 non-focus navy/40). 22 ×
// focus-visible:ring-offset-2 dodan [12 vrstic-rep + 5 template `${ + 4
// disabled:opacity-50 + 1 active:scale-[0.96]]; aria/title ZAMRZNJENI
// (ring-only runda — val 44 precedens; aria že nosijo akcija+cilj). 0 novih
// hex [iskrena zamrznjena resnica — števec najdišč = 0 pred in po — LEKCIJA
// R360 (4)]. Stale pini shiftani V ISTI RUNDI (proaktiven rg sken po vseh
// testih, ki berejo inventory-tab): r242 L176/177 (eksaktna invSrc className
// pina z zapiralo) + r237:230 (substring pin 'navy/40 disabled:opacity-50' —
// offset se vstavi MED, substring se prelomi; precedens R334/R355–R362).
// Era-diskriminatorji = 4 NOVI className nizi [vsi ×0 v HEAD fetch-first
// git grep; multiplicita ×1/×1/×2/×1 iskreno dokumentirana; LEKCIJA R361:
// statični segmenti BREZ interpolacijske meje — vsi 4 so čisti className
// nizi brez ${]. FEATURE runde: e2e-lib dedup 3. val — NOV pomočnik
// eb_pocakaj_csv_pilli (identičen poll predikat 'Izvozi CSV (' = ×7 v 5
// spot skriptah r361/r362 — prag LEKCIJE R352 (3.) DOLG presežen; helper +
// poraba ob 1. uporabi v r363-qa-spot.sh V ISTI rundi; zamrznjeni spot
// skripti NI mutirani).

const INV = readFileSync(join(process.cwd(), 'src/components/roksal/inventory-tab.tsx'), 'utf8')
const E2ELIB = readFileSync(join(process.cwd(), 'scripts/e2e-lib.sh'), 'utf8')
const SPOT = readFileSync(join(process.cwd(), 'scripts/r363-qa-spot.sh'), 'utf8')
const R242 = readFileSync(join(process.cwd(), 'src/lib/__tests__/r242-narocila-rbac.test.ts'), 'utf8')
const R237 = readFileSync(join(process.cwd(), 'src/lib/__tests__/r237-osnutek-pdf.test.ts'), 'utf8')

describe('R363 — STIL val 46: ring pariteta inventory-tab družine', () => {
  it('(A) PARITETA guard: vsak navy/40 žeton v datoteki nosi ring-offset-2 (razcep števca = 0; 23/23 — LEKCIJA R360 (4))', () => {
    const vsi = INV.split('focus-visible:ring-roksal-navy/40').length - 1
    const zOffsetom = INV.split('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2').length - 1
    expect(vsi).toBe(23)
    expect(vsi - zOffsetom).toBe(0)
  })

  it('(B) era-diskriminatorji ×1/×1/×2/×1 (vsi ×0 v HEAD pred rundo — fetch-first git grep)', () => {
    // [PIN SHIFT R382 val 61 / EVOLVED: FB+dark opcionalna skupina — NASLEDNICA r363 (border-pariteta).]
    expect(INV.match(/h-8 shrink-0 gap-1\.5 text-\[11px\] font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2( focus-visible:border-roksal-navy\/40)?( dark:focus-visible:border-roksal-ink\/40)? active:scale-\[0\.96\]/g) ?? []).toHaveLength(1) // [EVOLVED R390 val 68: press-scale odstranjen]
    expect(INV.match(/inline-flex items-center gap-1\.5 rounded-md px-1\.5 py-1 text-2xs font-semibold text-roksal-ink\/70 transition-colors hover:bg-secondary hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g) ?? []).toHaveLength(1)
    expect(INV.match(/bg-roksal-navy hover:bg-roksal-navy\/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2 disabled:opacity-50/g) ?? []).toHaveLength(2)
    expect(INV.match(/h-8 gap-1\.5 text-\[11px\] press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g) ?? []).toHaveLength(1)
  })

  it('(C) zamrznjeni aria inventory družine (era-kontrakt — ring-only runda, aria že nosijo akcija+cilj)', () => {
    for (const aria of [
      'Dodaj gibanje zaloge',
      'Izvozi vidno zalogo kot CSV',
      'Izvozi vidno zalogo kot PDF',
      'Kopiraj naročilnico vidnih artiklov pod minimalno zalogo',
      'Shrani naročilnico vidnih artiklov kot osnutek naročila',
    ]) {
      expect(INV).toContain(`aria-label="${aria}"`)
    }
  })

  it('(D) 0 novih hex — iskrena zamrznjena resnica (števec najdišč = 0, LEKCIJA R360 (4))', () => {
    expect(INV.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toHaveLength(0)
  })

  it('(E) FEATURE e2e-lib dedup 3. val: eb_pocakaj_csv_pilli ŽIV + poraba v r363-qa-spot.sh + stale pini shiftani V ISTI rundi', () => {
    expect(E2ELIB).toContain('eb_pocakaj_csv_pilli() {')
    expect(SPOT).toContain('eb_pocakaj_csv_pilli')
    // stale pini shiftani (r242 eksaktna invSrc pina ×2 + r237 substring pin):
    expect(R242).toContain('gap-1.5 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40 disabled:opacity-50') // [PIN SHIFT R382 val 61 / EVOLVED]
    expect(R242).toContain('bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:opacity-50')
    expect(R237).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:opacity-50')
  })
})
