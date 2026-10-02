import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// R362 — STIL val 45: ring PARITETA zaključek quote-followup družine + per-item
// aria kanon (R346/R356 precedens). QA-dokazano v R362 spot seji (spot-r167/6,
// OŽKI obseg — LEKCIJA R361): 3 izvozna brata (PDF/CSV spomniki + CSV prikazani,
// press-scale, L423/453/471) in 3 akcije h-8 (Pokliči/+3/+7, L584/597/608) so
// nosili navy/40 ring-2 BREZ focus-visible:ring-offset-2 — val 44 je popravil
// SAMO crm-tab.tsx (1 datoteka × 1 družina), quote-followup = isti CRM pogled,
// druga datoteka. Popravki: 6 × ring-offset-2 + 3 NOVI per-item aria-label z
// nazivProjekta (vidno besedilo ne nosi cilja — 'Datum spomnika:' precedent v
// isti datoteki) + title 'Spomnik danes' ZAMRZNJEN. Era-diskriminatorji = 4
// NOVI nizi (vsi ×0 v HEAD pred rundo, preverjeno fetch-first). 0 novih hex
// [iskrena zamrznjena resnica — LEKCIJA R360 (4): števec najdišč hex v
// quote-followup = 0 pred in po runde]. Pin shift v isti rundi: r267:281
// (stari eksakten className brez offseta → nov z offsetom; precedens
// R334/R355–R360). FEATURE runde: e2e-lib dedup 2. val — NOV pomočnik
// eb_sonda_ring_pariteta (identičen OŽKI ring-pariteta eval blok iz
// r361-qa-spot2.sh + r362-qa-spot.sh = 2. ponovitev → prag LEKCIJA R352 je
// 3.; tu je kanon ustvarjen PROAKTIVNO s Porabo ob 1. uporabi v r362-qa-spot3.sh
// — LEKCIJA R361 'kanon, ki se ne porabi, je le papir' obrnjena na glavo:
// helper + poraba v ISTI rundi); zamrznjeni spot skripti NI mutirani.

const FOLLOWUP = readFileSync(join(process.cwd(), 'src/components/roksal/quote-followup.tsx'), 'utf8')
const E2ELIB = readFileSync(join(process.cwd(), 'scripts/e2e-lib.sh'), 'utf8')
const SPOT3 = readFileSync(join(process.cwd(), 'scripts/r362-qa-spot3.sh'), 'utf8')

describe('R362 — STIL val 45: ring pariteta quote-followup družine', () => {
  it('(A) izvozna trojica: press-scale + navy/40 + offset-2 (števec ×3, ne null — LEKCIJA R360 (4))', () => {
    const bratje = FOLLOWUP.match(
      /h-7 shrink-0 gap-1\.5 text-\[11px\] press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g,
    ) ?? []
    expect(bratje).toHaveLength(3)
    // zamrznjeni aria/title trojice (era-kontrakt — r267/r331/r332 era):
    expect(FOLLOWUP).toContain('aria-label="Izvozi pregled spomnikov ponudb kot PDF"')
    expect(FOLLOWUP).toContain('aria-label="Izvozi pregled spomnikov ponudb kot CSV"')
    expect(FOLLOWUP).toContain('Izvozi prikazani seznam ponudb v CSV (')
  })

  it('(B) h-8 akcije trojica: navy/40 + offset-2 (števec ×3) + NOVI per-item aria (era-diskriminatorji ×1)', () => {
    const akcije = FOLLOWUP.match(
      /h-8 focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g,
    ) ?? []
    expect(akcije).toHaveLength(3)
    // NOVI aria nizi — statični segmenti brez interpolacijske meje
    // (LEKCIJA R361: SWC transpilira template literal v konkatenacijo):
    expect(FOLLOWUP.match(/Pokliči — spomnik za /g) ?? []).toHaveLength(1)
    expect(FOLLOWUP.match(/ na \+3 dni/g) ?? []).toHaveLength(1)
    expect(FOLLOWUP.match(/ na \+7 dni/g) ?? []).toHaveLength(1)
    // zamrznjen title + per-item precedent v isti datoteki:
    expect(FOLLOWUP).toContain('title="Spomnik danes"')
    expect(FOLLOWUP).toContain('aria-label={`Datum spomnika: ${p.nazivProjekta}`}')
  })

  it('(C) PARITETA guard: vsak navy/40 žeton v datoteki nosi ring-offset-2 (razcep števca = 0)', () => {
    const vsi = FOLLOWUP.split('focus-visible:ring-roksal-navy/40').length - 1
    const zOffsetom = FOLLOWUP.split('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2').length - 1
    expect(vsi).toBeGreaterThan(0)
    expect(vsi - zOffsetom).toBe(0)
  })

  it('(D) 0 novih hex — iskrena zamrznjena resnica (števec najdišč = 0, LEKCIJA R360 (4))', () => {
    const hex = FOLLOWUP.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hex).toHaveLength(0)
  })

  it('(E) FEATURE e2e-lib dedup 2. val: NOV pomočnik eb_sonda_ring_pariteta ŽIV + IIFE ovojnica (r231 invariant) + PORABA ob 1. uporabi v r362-qa-spot3.sh', () => {
    expect(E2ELIB).toContain('eb_sonda_ring_pariteta() {')
    // IIFE ovojnica obvezna (r231 invariant — LEKCIJA R361):
    expect(E2ELIB).toContain('(()=>{')
    // poraba v novem spot skriptu (kanon porabljen, ne papir — LEKCIJA R361):
    expect(SPOT3).toContain('eb_sonda_ring_pariteta')
  })
})
