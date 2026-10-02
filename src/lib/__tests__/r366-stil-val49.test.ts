// ---------------------------------------------------------------------------
// R366 — MANDATORY STIL val 49 (LEKCIJA R346 kanon; precedens val 43–48):
// ring PARITETA material-intelligence-tab družine — NAJVEČJI preostali
// enobarvni gap po val 48 (logistics).
//
// Disk resnica PRED rundom (LEKCIJA R364 (4): štej iz diska, ne iz handoverja
// — handover je domneval "offset-1 ×2", disk je pokazal 24 × offset-1 + 2 brez):
//   26 × navy/40, VSE focus-visible (0 non-focus), 24 × ring-offset-1,
//   2 × brez offseta (L1949 Nov dobavitelj CTA + L2198 Shrani dobavitelja).
// val 49: 24 × ring-offset-1→2 normalizacija (precedens val 44 opomnik PDF /
// val 47 status cikel chip) + 2 × focus-visible:ring-offset-2 dodan →
// 26/26 navy/40 nosi ring-offset-2 (razcep števca = 0). In-place = 0 novih
// vrstic (2366→2366 — prst varovalka združljiva). aria/title ZAMRZNJENI
// (ring-only runda — val 44/46/47/48 precedens). 0 novih hex (števec 0
// pred in po — dokazan s ŠTETJEM, LEKCIJA R360 (4)).
//
// Per-barvni split (LEKCIJA R365 (3)): stray ring-red-600/40 ×1 (L2352,
// destruktivni žig) NOSI ring-offset-1 in OSTAJA nespremenjen — ločena
// barvna družina, izrecno izven val 49 (dokumentirano, ne tiho).
//
// Stale pini shiftani V ISTI rundi (PRED-scan čez VSE 40 testnih datotek,
// ki berejo material-intelligence): r242 L155–157 (3 eksaktna quote pina —
// "minsko polje" iz R366 kandidata), r244-cenik L250/256, r245 L515/517,
// r333 PAR_ZETON_MATERIAL (era žeton val 20), r207 chipCls okno pin —
// VSI shiftani na offset-2 z iskrenimi komentarji. r236 offset-1 pin bere
// invoice-manager (NI material) — preživi nespremenjen. r361 (D)
// not.toContain('ring-offset-1') bere CRM — nedotaknjen.
//
// FEATURE (e2e-lib dedup 6. val): NOV pomočnik eb_pocakaj_meritve — predikat
// "Ni projektov || tabela>0" byte-identičen ×4 v zamrznjenih spot skriptah
// (r360-qa-spot2, r361, r362, r365) — prag LEKCIJE R352 (×3) DOLG presežen;
// poraba ob 1. uporabi v r366-qa-spot.sh D V ISTI rundi (LEKCIJA R362 (3)).
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MATERIAL = readFileSync(
  join(process.cwd(), 'src/components/roksal/material-intelligence-tab.tsx'),
  'utf8',
)

const R242 = readFileSync(join(process.cwd(), 'src/lib/__tests__/r242-narocila-rbac.test.ts'), 'utf8')
const R333 = readFileSync(join(process.cwd(), 'src/lib/__tests__/r333-stil-val20.test.ts'), 'utf8')
const R207 = readFileSync(join(process.cwd(), 'src/lib/__tests__/r207-status-filter-strazar.test.ts'), 'utf8')
const E2E_LIB = readFileSync(join(process.cwd(), 'scripts/e2e-lib.sh'), 'utf8')
const SPOT = readFileSync(join(process.cwd(), 'scripts/r366-qa-spot.sh'), 'utf8')
const R365_SPOT = readFileSync(join(process.cwd(), 'scripts/r365-qa-spot.sh'), 'utf8')

/** Štej POJAVITVE niza (grep -o semantika — LEKCIJA R365 (2)), ne vrstice. */
function pojavitve(vir: string, niz: string): number {
  return vir.split(niz).length - 1
}

describe('r366 STIL val 49 — ring PARITETA material-intelligence družine', () => {
  it('(A) PARITETA guard: vsak navy/40 žeton v datoteki nosi ring-offset-2 (razcep števca = 0; 26/26) + ring-offset-1 izkoreninjen iz navy družine; red-600/40 ostaja offset-1 (per-barvni split, nespremenjen)', () => {
    const navy40 = pojavitve(MATERIAL, 'ring-roksal-navy/40')
    expect(navy40).toBe(26)
    const navy40Offset2 = pojavitve(MATERIAL, 'ring-roksal-navy/40 focus-visible:ring-offset-2')
    expect(navy40Offset2).toBe(26)
    // vsi navy/40 so focus-visible prstani (0 non-focus — disk resnica pred in po)
    const nonFocus = MATERIAL.split('\n').filter(
      (l) => l.includes('ring-roksal-navy/40') && !l.includes('focus-visible:ring'),
    ).length
    expect(nonFocus).toBe(0)
    // ring-offset-1 NI več v navy družini (normalizacija) — red-600/40 (×1,
    // destruktivni žig) je bila izrecno izven val 49 (per-barvni split);
    // stale pin shiftan val 50 (R367): red-600/40 je dobila oblikovno pariteto
    // ring-2 + offset-2 (barva ohranjena) — offset-1 v datoteki = 0
    expect(pojavitve(MATERIAL, 'focus-visible:ring-offset-1')).toBe(0)
    expect(pojavitve(MATERIAL, 'ring-red-600/40 focus-visible:ring-offset-2')).toBe(1)
    // in-place: prst varovalka ni na prizadetih (val 49 = material only)
  })

  it('(B) era-diskriminatorji: val 49 NOVI className tokeni (×0 v HEAD pred rundo — fetch-first git grep GLASNO potrjeno ×5); multiplicita ×1/×1/×4/×8 v POJAVITVAH (LEKCIJA R365 (2))', () => {
    const n1 = 'w-full bg-roksal-navy text-white shadow-sm press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const n3 = 'tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const n4 = 'h-8 text-xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const n5 = 'h-6 gap-1 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    expect(pojavitve(MATERIAL, n1)).toBe(1)
    expect(pojavitve(MATERIAL, n3)).toBe(1)
    expect(pojavitve(MATERIAL, n4)).toBe(4)
    expect(pojavitve(MATERIAL, n5)).toBe(8)
    // 5. kandidat (L2198 brez shadow-sm) je ×1 — dokumentiran v registru kot
    // redundanten z N1 (ista dialog površina), NI v TSV registru
    const n2 = 'w-full bg-roksal-navy text-white press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    expect(pojavitve(MATERIAL, n2)).toBe(1)
  })

  it('(C) stale pini shiftani V ISTI rundi: r242 novi offset-2 pini prisotni + stari offset-1 odsoten; r333 PAR_ZETON_MATERIAL shiftan; r207 chipCls pin shiftan', () => {
    // r242 (3 quote pina — "minsko polje" razminirano)
    expect(R242).toContain('"h-8 text-xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"')
    expect(R242).not.toContain('ring-roksal-navy/40 focus-visible:ring-offset-1"')
    // r333 (era žeton val 20 — shiftan z iskrenim komentarjem)
    expect(R333).toContain("const PAR_ZETON_MATERIAL = 'h-6 gap-1 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'")
    expect(R333).toContain('val 49 (R366): ring-offset-1→2 normalizacija')
    // r207 (chipCls okno pin)
    expect(R207).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')
    // r236 offset-1 pin bere invoice-manager (NI material) — NESPREMENJEN pin
    // na NESPREMENJENI datoteki ostaja veljaven (preživi)
    const r236 = readFileSync(join(process.cwd(), 'src/lib/__tests__/r236-dobavitelji-pdf.test.ts'), 'utf8')
    expect(r236).toContain("const racuni = beri('src/components/roksal/invoice-manager.tsx')")
  })

  it('(D) 0 novih hex — števec najdišč 0 pred in po (LEKCIJA R360 (4): dokaz s ŠTETJEM, ne z null)', () => {
    const hex = MATERIAL.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hex.length).toBe(0)
    // press-scale števec nespremenjen (19 pred = 19 po — ring-only runda)
    expect(pojavitve(MATERIAL, 'press-scale')).toBe(19)
  })

  it('(E) e2e-lib dedup 6. val: eb_pocakaj_meritve ŽIV (prag ×3 presežen — ×4 zamrznjeni) + poraba v r366-qa-spot V ISTI rundi + zamrznjeni NI mutirani', () => {
    // helper ŽIV v lib (IIFE predikat v repu — r231 invariant vzorec)
    expect(E2E_LIB).toContain('eb_pocakaj_meritve() {')
    expect(E2E_LIB).toContain("document.body.textContent.includes('Ni projektov') || document.querySelectorAll('table').length > 0")
    // prag: ISTI predikat byte-identičen v 4 zamrznjenih skriptah (×4 > ×3)
    const pred = "document.body.textContent.includes('Ni projektov') || document.querySelectorAll('table').length > 0"
    for (const z of ['scripts/r360-qa-spot2.sh', 'scripts/r361-qa-spot.sh', 'scripts/r362-qa-spot.sh', 'scripts/r365-qa-spot.sh']) {
      const zamrznjen = readFileSync(join(process.cwd(), z), 'utf8')
      expect(pojavitve(zamrznjen, pred)).toBe(1)
    }
    // poraba V ISTI rundi (LEKCIJA R362 (3): kanon ne sme biti papir)
    expect(SPOT).toContain('eb_pocakaj_meritve 15')
    // zamrznjeni spot skripti NI mutirani (kanon R361–R365) — r365 še vedno
    // nosi svoj inline predikat, NE klica helperja
    expect(R365_SPOT).not.toContain('eb_pocakaj_meritve')
    expect(R365_SPOT).toContain(pred)
  })
})
