// R204 — NAROČILNICA STRAŽAR: izmišljen uspeh je ODPRAVLJEN.
// ---------------------------------------------------------------------------
// Prej je gumb 'Naroči' (inventory-tab handleReorder) pokazal toast
// 'Naročilo bo poslano dobavitelju.' — NIČ ni bilo poslano (integracije z
// dobaviteljem ni). To je laž v UI. R204: pravi izhod = naročilnica v
// odložišče (lib zaloga-povzetek, EN VIR RESNICE za priporočeno količino),
// fail-verbose odložišče (vzorec R167/R203). Ta stražar zagotavlja:
//  (1) stara izmišljena trditev je GONE (toast + 'V redu' akcija + Math.max
//      ponovna implementacija v komponenti);
//  (2) kopirajNarocilnico: iskren prazen seznam + fail-verbose odložišče;
//  (3) glavni gumb 'Naročilnica' (pill družina, aria-label, focus ring);
//  (4) handleMovement: razlog iz odgovora (vzorec R140/R163/R203);
//  (5) dekorativne ikone aria-hidden.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')

const beri = (rel: string): string => readFileSync(join(ROOT, rel), 'utf-8')

/** Okno vrstic med dvema sidroma (vključno) — točna lokalizacija funkcije. */
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  expect(a).toBeGreaterThanOrEqual(0)
  const b = src.indexOf(do_, a)
  expect(b).toBeGreaterThan(a)
  return src.slice(a, b)
}

describe('R204 stražar: izmišljena trditev je GONE', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')

  it('stari lažni toast + lažna akcija + ponovna implementacija formule so ODSOTNI', () => {
    expect(src).not.toContain('Naročilo bo poslano dobavitelju.')
    expect(src).not.toContain("label: 'V redu'")
    expect(src).not.toContain('toast.info(')
    // EN VIR RESNICE: formula živi v lib (narociloKolicina), NE v komponenti
    expect(src).not.toContain('Math.max(deficit')
  })

  it('komponenta uporablja lib zaloga-povzetek (EN VIR RESNICE)', () => {
    expect(src).toContain("from '@/lib/zaloga-povzetek'")
    expect(src).toContain('buildZalogaPovzetek')
    expect(src).toContain('zalogaPovzetekBeseda')
  })
})

describe('R204 stražar: kopirajNarocilnico (fail-verbose + iskren prazen seznam)', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')

  it('iskren prazen seznam, odložišče z razlogoma napaki, kategorija pogojna', () => {
    const okno = oknoMed(
      src,
      '// R204 — naročilnica = PRAVI izhod namesto izmišljenega toasta.',
      'function handleReorder',
    )
    // iskren prazen seznam (nič izmišljenega naročila)
    expect(okno).toContain('Ni artiklov pod minimalno zalogo — nič za naročilo.')
    // fail-verbose odložišče (vzorec R167/R203)
    expect(okno).toContain("err.name === 'NotAllowedError'")
    expect(okno).toContain('Brskalnik je zavrnil dostop do odložišča (dovoljenje).')
    expect(okno).toContain('Kopiranje ni uspelo')
    // kategorija LE pri dejansko aktivnem filtru
    expect(okno).toContain("filter === 'ALL' ? null : (typeLabels[filter] ?? filter)")
    // aplikacija trdi LE to, kar je res
    expect(okno).toContain('kopirana v odložišče')
    expect(okno).toContain('prilepi v e-pošto/SMS dobavitelju.')
  })

  it('handleReorder je prežičen na skupno jedro (posamezen artikel = seznam 1)', () => {
    const okno = oknoMed(src, 'function handleReorder', '// R144 (§24) — odpri/zapri šarže')
    expect(okno).toContain('void kopirajNarocilnico([item], item.naziv)')
  })
})

describe('R204 stražar: glavni gumb Naročilnica (pill družina + a11y)', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')

  it('gumb poleg CSV: aria-label, title, aria-hidden ikona, focus-visible ring', () => {
    const okno = oknoMed(
      src,
      '{/* R204 — naročilnica vidnih artiklov pod minimumom',
      'aria-label="Izvozi vidno zalogo kot CSV"',
    )
    expect(okno).toContain('aria-label="Kopiraj naročilnico vidnih artiklov pod minimalno zalogo"')
    expect(okno).toContain('Naročilnica za dobavitelja (vidni artikli pod minimumom) — prilepi v e-pošto/SMS')
    expect(okno).toContain('<ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />')
    // ista pill družina kot CSV (R136): višina/typografia + focus ring
    expect(okno).toContain('h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale')
    expect(okno).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
    // vidni artikli pod minimumom (WYSIWYG — ista definicija isLow kot vrstice)
    expect(okno).toContain('filtered.filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga)')
  })

  it('CSV ikona je aria-hidden (dekorativna — oznaka nosi besedilo)', () => {
    expect(src).toContain('<Download className="h-3.5 w-3.5" aria-hidden="true" />')
  })
})

describe('R204 stražar: handleMovement fail-verbose z razlogom iz odgovora', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')

  it('else veja pokaže SVET razlog (vzorec R140/R163/R203), ne generične sporočilo', () => {
    const okno = oknoMed(src, '// R204 — fail-verbose z razlogom iz odgovora', '} catch {')
    expect(okno).toContain('res.json().catch(() => null)')
    expect(okno).toContain("data?.error?.trim() || `Napaka pri zapisovanju premika (${res.status})`")
    // stari generični brez razloga je GONE
    expect(src).not.toContain("toast.error('Napaka pri zapisovanju premika')")
  })
})
