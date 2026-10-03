import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// R365 — STIL val 48: ring PARITETA logistics-tab družine (NAJVEČJI preostali
// parity gap po val 43–47: fetch-first rg sken iz diska = 36 × navy/40 [1 že
// nosi offset-2 (L1302) + 35 brez] + 2 × ring-red-400/50 stray = LOČENA
// barvna družina (bratje v photo-tab/sketch-canvas) — per-barvni split sken
// (LEKCIJA R364 kandidat): navy/40 V TEJ rundi, red-400/40 IZRECNO izven).
// 35 × focus-visible:ring-offset-2 dodan — determinističen perl
// negative-lookahead transform; vedre ŠTEJANE IZ DISKA (LEKCIJA R364 (4)):
// 30 zaprti niz + 5 disabled bucket; NI template literal bucketov v tej
// datoteki. 36/36 navy/40 nosi offset-2 [razcep števca = 0]; in-place =
// 0 novih vrstic 3294→3294 (prst varovalka združljiva — LEKCIJA R364 (5));
// 0 novih hex (števec 1 nespremenjen — r292 hex baseline). aria/title
// ZAMRZNJENI (ring-only runda — val 44/46/47 precedens). Stale pini
// PRED-SCAN čez VSE 43 testnih datotek, ki berejo logistics-tab: EDINI
// prelomljiv pin = r244 L231 substring 'navy/40 disabled:opacity-50' ×5
// (žeton vstavljen MED dva dela pina — LEKCIJA R363 vzorec r237:230) →
// shiftan V ISTI rundi (števec 5 nespremenjen; precedens R362 r242
// L176/177); r292 'pil' prefix pini preživijo; okenske dolžine: r317 okno
// (i-8,i+6) NE seka logistics navy vrstic. Era-diskriminatorji ×1/×1/×3/×5
// [multiplicita = grep -o POJAVITVE, ne grep -c VRSTICE — prvi osnutek je
// napačno dokumentiral ×3 za h-6 needle; rg/-o pojavitve = resnica,
// LEKCIJA R365]. FEATURE runde: e2e-lib dedup
// 5. val — NOV pomočnik eb_sonda_zaloge (byte-identičen eval blok
// md5 d3da517025ad391c3646b0cc572a0045: r363-qa-spot B + r364-qa-spot B +
// r365-qa-spot B = ×3 — prag LEKCIJE R352 natanko ob 3.; poraba ob 1.
// uporabi v r365-qa-spot.sh V ISTI rundi ×2 zeleni teka; zamrznjeni spot
// skripti NI mutirani — kanon R361–R364).

const LOG = readFileSync(join(process.cwd(), 'src/components/roksal/logistics-tab.tsx'), 'utf8')
const E2ELIB = readFileSync(join(process.cwd(), 'scripts/e2e-lib.sh'), 'utf8')
const SPOT = readFileSync(join(process.cwd(), 'scripts/r365-qa-spot.sh'), 'utf8')
const R363SPOT = readFileSync(join(process.cwd(), 'scripts/r363-qa-spot.sh'), 'utf8')
const R364SPOT = readFileSync(join(process.cwd(), 'scripts/r364-qa-spot.sh'), 'utf8')
const R244 = readFileSync(join(process.cwd(), 'src/lib/__tests__/r244-wave6-rbac.test.ts'), 'utf8')

describe('R365 — STIL val 48: ring pariteta logistics-tab družine', () => {
  it('(A) PARITETA guard: vsak navy/40 žeton v datoteki nosi ring-offset-2 (razcep števca = 0; 36/36) + red-400/50 stray družina: val 50 (R367) oblikovna pariteta — ring-2 + offset-2, barva OHRANJENA (per-barvni split; 2/2)', () => {
    const vsi = LOG.split('focus-visible:ring-roksal-navy/40').length - 1
    const zOffsetom = LOG.split('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2').length - 1
    expect(vsi).toBe(36)
    expect(vsi - zOffsetom).toBe(0)
    // red-400/50: števec nespremenjen (val 50 = shape-only, barva bajtno ista);
    // stale pin shiftan val 50 (R367): offset-2 števec 0→2 (oblikovna pariteta
    // rdeče družine — precedens val 44/47 normalizacija)
    expect(LOG.split('focus-visible:ring-red-400/50').length - 1).toBe(2)
    expect(LOG.split('focus-visible:ring-red-400/50 focus-visible:ring-offset-2').length - 1).toBe(2)
  })

  it('(B) era-diskriminatorji ×1/×1/×3/×5 (vsi ×0 v HEAD pred rundo — fetch-first git show grep; multiplicita = grep -o POJAVITVE, ne vrstice — LEKCIJA R365)', () => {
    expect(LOG.match(/h-7 shrink-0 px-2 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g) ?? []).toHaveLength(1)
    expect(LOG.match(/h-6 text-2xs bg-roksal-navy\/5 focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g) ?? []).toHaveLength(1)
    expect(LOG.match(/mt-0\.5 h-3\.5 w-3\.5 accent-roksal-navy focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g) ?? []).toHaveLength(3)
    // [PIN SHIFT R382 val 61 / EVOLVED: 2 od 5 nosi FB+dark — opcionalna skupina, števec 5.]
    expect(LOG.match(/bg-roksal-navy hover:bg-roksal-navy\/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2( focus-visible:border-roksal-navy\/40)?( dark:focus-visible:border-roksal-ink\/40)? disabled:opacity-50/g) ?? []).toHaveLength(5)
  })

  it('(C) zamrznjeni aria/logika + r244 substring pin shiftan V ISTI rundi (števec 5 nespremenjen — precedens R362 r242 L176/177, R363 r237:230)', () => {
    // zamrznjeni aria (ring-only runda — val 44/46/47 precedens; r353/r354 strazar)
    expect(LOG).toContain('aria-label="Shrani nov razpored"')
    expect(LOG).toContain('aria-label="Shrani novo ekipo"')
    expect(LOG).toContain('aria-label="Shrani novo opremo"')
    expect(LOG).toContain('aria-label="Izvozi tedenski pregled montaž kot CSV"')
    // r244 shiftani substring pin (nov niz) + STARI niz NI več prisoten (razcep = 0)
    expect(R244).toContain('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2') // [PIN SHIFT R382 val 61 / EVOLVED: r244 split token skrajšan do O2 — 2/5 submitov nosi FB+dark]
    expect(R244).not.toContain('focus-visible:ring-roksal-navy/40 disabled:opacity-50')
    // prefix pini preživijo (r244 CTA + r292 pil slice)
    expect(LOG).toContain('flex-1 bg-roksal-navy text-white shadow-sm press-scale')
    expect(LOG).toContain('w-full bg-roksal-navy text-white shadow-sm press-scale')
    expect(LOG).toContain('press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')
  })

  it('(D) 0 novih hex — števec iz diska: baseline 1 (r292 kontrakt: dinamični crew fallback)', () => {
    const hexi = LOG.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    expect(hexi).toHaveLength(1)
  })

  it('(E) helper ŽIV + poraba V ISTI rundi + zamrznjeni spot skripti NI mutirani (e2e-lib dedup 5. val — prag R352 natanko ob ×3)', () => {
    // kanon definiran v e2e-lib.sh z md5 dokumentacijo
    expect(E2ELIB).toContain('eb_sonda_zaloge()')
    expect(E2ELIB).toContain('md5 d3da517025ad391c3646b0cc572a0045')
    // poraba ob 1. uporabi v r365-qa-spot.sh (LEKCIJA R362 (3): kanon ne sme biti papir)
    expect(SPOT).toContain('eb_sonda_zaloge')
    // zamrznjeni spot skripti še vedno nosijo svoje inline bloke (NI mutacije — kanon R361–R364)
    expect(R363SPOT).toContain('izvoziCsvOffset2')
    expect(R364SPOT).toContain('izvoziCsvOffset2')
    // kanonska kompozicija: dispatch + poll + sonda ostanejo ločeni kanoni
    expect(SPOT).toContain('eb_pocakaj_zalogo 15')
    expect(SPOT).toContain('eb_pocakaj_csv_pilli 15')
  })
})
