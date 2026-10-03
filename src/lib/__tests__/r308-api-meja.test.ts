// ---------------------------------------------------------------------------
// R308 — API I/O MEJA («stena ura») — strazar nad VSI route-handlerji.
//
// Strazar: (a) REALNIM drevo src/app/api/**/route.ts → 0 kršitev na 5
// preverbah (json-guard / prazni-catch / brez-as-any / ovojnice / todo);
// (b) enote preverb na izdelanih vsebinah (pozitiv + lažno-pozitivni
// varovali); (c) fail-closed na pokvarjenem vhodu skenerja; (d) EN VIR —
// lexer uvožen iz avtomatizacija-audit (komentar z json() NE sproži
// kršitve); (e) iskrena resnica v KODI: 2 refactorirana catch bloka
// (material-orders/history + portal/[token]) imata izrecen padec;
// (f) MANDATORY STIL: 4 opozorilne površine harmonizirane na roksal
// žetone (0 novih hex);
// (g) R326 PIN SHIFT (53. člen): NOVI route material-prices/zgodovina
// (price history GET — čisti bralec) → obseg drevesa 81 → 82 routes
// (anti-stale: stari 81 pin je prepovedan — polzaporedje ne sme nazaj).
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  MEJA_PREVERBE,
  pregledajApiMejo,
  type MejaKršitev,
} from '../api-meja-audit'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

/** Zberi VSE route.ts pod src/app/api (rekurzivno — EN VIR obseg pregleda). */
function zberiRute(): { pot: string; vsebina: string }[] {
  const koren = join(process.cwd(), 'src', 'app', 'api')
  const out: { pot: string; vsebina: string }[] = []
  const walk = (dir: string, rel: string) => {
    for ( const f of readdirSync(dir) ) {
      const cel = join(dir, f)
      const relF = rel ? `${rel}/${f}` : f
      if (statSync(cel).isDirectory()) walk(cel, relF)
      else if (f === 'route.ts') out.push({ pot: `src/app/api/${relF}`, vsebina: readFileSync(cel, 'utf8') })
    }
  }
  walk(koren, '')
  return out.sort((a, b) => (a.pot < b.pot ? -1 : 1))
}

const byId = (krš: MejaKršitev[], id: string) => krš.filter((k) => k.preverba === id)

describe('R308 — REALNIM drevo: stena ura ŽIVO (0 kršitev na vseh 5 preverbah)', () => {
  it('vseh 107 route datotek prebranih in pregledanih — obseg pregleda NI tiho skrčen (R326: + zgodovina cen; PIN SHIFT R374: 82→85 — +price-book, +quotes, +quotes/[id]; PIN SHIFT R376: 85→88 — +bom, +bom/[id], +bom/procurement [kanonični BOM #13 R166]; PIN SHIFT R378: 88→92 — +production, +production/[id], +installation-records, +installation-records/[id] [produkcija §10 + as-installed §9 #13 R167]; PIN SHIFT R382: 92→99 — +leads, +leads/[id], +opportunities, +opportunities/[id], +customers/[id], +customer-addresses, +customer-addresses/[id] [CRM lijak §13 #13 R169]; PIN SHIFT R390: 99→107 — +catalog, +catalog/products/[id], +catalog/products/[id]/applications, +catalog/products/[id]/variants, +catalog/versions, +catalog/versions/[id], +catalog/compatibility, +catalog/supplier-mappings [produktini katalog §14 #13 R170])', () => {
    const rute = zberiRute()
    expect(rute).toHaveLength(107)
    expect(new Set(rute.map((r) => r.pot)).size).toBe(107)
    expect(rute.some((r) => r.pot === 'src/app/api/material-prices/zgodovina/route.ts')).toBe(true)
    // R374 (issue #13 R165): nove kanonske rute morajo ostati v obsegu pregleda
    expect(rute.some((r) => r.pot === 'src/app/api/price-book/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/quotes/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/quotes/[id]/route.ts')).toBe(true)
    // R376 (issue #13 R166): kanonični BOM rute morajo ostati v obsegu pregleda
    expect(rute.some((r) => r.pot === 'src/app/api/bom/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/bom/[id]/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/bom/procurement/route.ts')).toBe(true)
    // R378 (issue #13 R167): produkcija + as-installed rute morajo ostati v
    // obsegu pregleda (količinska veriga §9 + §10 nad odobrenim BOM):
    expect(rute.some((r) => r.pot === 'src/app/api/production/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/production/[id]/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/installation-records/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/installation-records/[id]/route.ts')).toBe(true)
    // R382 (issue #13 R169): CRM lijak rute morajo ostati v obsegu pregleda
    // (Lead/Opportunity/Naslovi §13 — vse mutirajoče so žičene z zapisOmejitev):
    expect(rute.some((r) => r.pot === 'src/app/api/leads/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/leads/[id]/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/opportunities/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/opportunities/[id]/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/customers/[id]/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/customer-addresses/route.ts')).toBe(true)
    expect(rute.some((r) => r.pot === 'src/app/api/customer-addresses/[id]/route.ts')).toBe(true)
  })

  it('pregledajApiMejo nad celotnim drevesom → 0 kršitev (stena ura potrjena)', () => {
    const kršitve = pregledajApiMejo(zberiRute())
    expect(kršitve).toEqual([])
  })

  it('determinizem: dva zaporedna teka = bajtno isti rezultat', () => {
    const rute = zberiRute()
    const a = pregledajApiMejo(rute)
    const b = pregledajApiMejo(rute)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('vseh 5 preverb prisotnih (MEJA_PREVERBE je EN VIR kanon)', () => {
    expect(MEJA_PREVERBE.map((p) => p.id)).toEqual([
      'json-guard',
      'prazni-catch',
      'brez-as-any',
      'ovojnice-error',
      'todo-ostanki',
    ])
  })
})

describe('R308 — enote preverb (izdelane vsebine, pozitiv + varovali)', () => {
  it('json-guard: nevarovan klic → kršitev z vrstico; .catch → čisto; try → čisto', () => {
    const slab = "export async function POST(r: Request) {\n  const x = await req.json()\n  return null\n}"
    const krš = byId(pregledajApiMejo([{ pot: 'a/route.ts', vsebina: slab }]), 'json-guard')
    expect(krš).toHaveLength(1)
    expect(krš[0]!.vrstica).toBe(2)
    const zCachem = "const x = await req.json().catch(() => null)"
    const zTry = "try {\n  const x = await request.json()\n} catch (e) {\n  x = null\n}"
    expect(byId(pregledajApiMejo([{ pot: 'a', vsebina: zCachem }, { pot: 'b', vsebina: zTry }]), 'json-guard')).toEqual([])
  })

  it('json-guard: json() v KOMENTARJU ne sproži kršitve (EN VIR lexer — brez lažnega pozitiva)', () => {
    const zKomentarjem = "// primer: const x = await req.json()\nexport const y = 1"
    expect(pregledajApiMejo([{ pot: 'a', vsebina: zKomentarjem }])).toEqual([])
  })

  it('prazni-catch: prazen blok → kršitev; .catch(() => null) NI prazen blok (varovalo)', () => {
    const slab = "try {\n  a()\n} catch (e) {}"
    const krš = byId(pregledajApiMejo([{ pot: 'a', vsebina: slab }]), 'prazni-catch')
    expect(krš).toHaveLength(1)
    expect(krš[0]!.vrstica).toBe(3)
    const dober = "const x = await req.json().catch(() => null)\ntry { a() } catch (e) { x = 'napaka' }"
    expect(byId(pregledajApiMejo([{ pot: 'b', vsebina: dober }]), 'prazni-catch')).toEqual([])
  })

  it('brez-as-any: kast na any → kršitev (validacija vhoda ne sme biti izgubljena)', () => {
    const krš = byId(pregledajApiMejo([{ pot: 'a', vsebina: 'const b = t as any' }]), 'brez-as-any')
    expect(krš).toHaveLength(1)
  })

  it('ovojnice-error: 4xx brez { error } → kršitev; z error → čisto; samo 2xx → čisto', () => {
    const slab = "return NextResponse.json({ zadeva: 1 }, { status: 403 })"
    const krš = byId(pregledajApiMejo([{ pot: 'a', vsebina: slab }]), 'ovojnice-error')
    expect(krš).toHaveLength(1)
    const dober = "return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })"
    const mirno = "return NextResponse.json({ ok: true }, { status: 200 })"
    expect(byId(pregledajApiMejo([{ pot: 'b', vsebina: dober }, { pot: 'c', vsebina: mirno }]), 'ovojnice-error')).toEqual([])
  })

  it('todo-ostanki: TODO-R308 v ruti → kršitev', () => {
    const krš = byId(pregledajApiMejo([{ pot: 'a', vsebina: '// TODO-R308: dokončaj' }]), 'todo-ostanki')
    expect(krš).toHaveLength(1)
  })
})

describe('R308 — fail-closed skener (pokvarjen vhod → TypeError, nikoli tiho)', () => {
  it('ne-polje vhod → TypeError z imenom graditelja', () => {
    expect(() => pregledajApiMejo('ne-polje' as unknown as { pot: string; vsebina: string }[])).toThrow(
      'pregledajApiMejo: pričakovano polje virov',
    )
  })

  it('vir brez poti / z ne-nizno vsebino → TypeError (pot krivca v sporočilu)', () => {
    expect(() =>
      pregledajApiMejo([{ pot: '   ', vsebina: 'x' } as unknown as { pot: string; vsebina: string }]),
    ).toThrow('pregledajApiMejo: vir brez poti (pričakovano { pot, vsebina })')
    expect(() =>
      pregledajApiMejo([{ pot: 'a/route.ts', vsebina: 42 } as unknown as { pot: string; vsebina: string }]),
    ).toThrow('pregledajApiMejo: vsebina ni niz (a/route.ts)')
  })
})

describe('R308 — iskrena resnica v KODI (2 refactorirana prazna catch bloka)', () => {
  it('material-orders/history: catch ima izrecen iskren null padec (return v kodi)', () => {
    const vir = srcOf('src/app/api/material-orders/history/route.ts')
    const blok = vir.slice(vir.indexOf('} catch {'), vir.indexOf('} catch {') + 420)
    expect(blok).toContain('return { orderId: null, status: null }')
    expect(blok).toContain('R308 meja')
  })

  it('portal/[token]: catch ima izrecni iskren padec (title = a.akcija, description = \'\')', () => {
    const vir = srcOf('src/app/api/portal/[token]/route.ts')
    const blok = vir.slice(vir.indexOf('} catch {'), vir.indexOf('} catch {') + 300)
    expect(blok).toContain('title = a.akcija')
    expect(blok).toContain("description = ''")
  })
})

describe('R308 — MANDATORY STIL: opozorilne površine harmonizirane (0 novih hex)', () => {
  const HARMONIZIRANE = [
    'src/components/roksal/punch-list.tsx',
    'src/components/roksal/site-survey-tab.tsx',
    'src/components/roksal/invoice-manager.tsx',
    'src/components/roksal/weather-card.tsx',
  ] as const

  it('vse 4 datoteke uporabljajo roksal-amber žetone na opozorilih (konsistenca tem)', () => {
    for (const pot of HARMONIZIRANE) {
      const vir = srcOf(pot)
      expect(vir, pot).toContain('border-roksal-amber/40 bg-roksal-amber/10')
      expect(vir, pot).toContain('text-roksal-ink')
    }
  })

  it('SUROVI amber vzorec na opozorilnih površinah IZGINIL (must_miss — natančno izločeni vzorci)', () => {
    for (const pot of HARMONIZIRANE) {
      const vir = srcOf(pot)
      // natančno vzorci, ki jih je R308 odstranil (ostali amber uporabi —
      // barvni kategoriji-izbirnik, KPI pari — niso opozorilne površine in
      // so IZRECNO izven obsega; text-roksal-amber na svetli podlazi ni
      // berljiv — r162 lekcija, zato je surovi par amber-800/amber-200
      // drugod dovoljen kot kontrastni par)
      expect(vir, pot).not.toContain('border-amber-300 dark:border-amber-800 bg-amber-50')
      expect(vir, pot).not.toContain('border-amber-300/60 bg-amber-50')
      expect(vir, pot).not.toContain("bg-amber-50 dark:bg-amber-950/40 px-3 py-2 ring-1 ring-amber-200")
    }
  })
})

describe('R308 — STRAŽAR: skener sam je čist (kliento-varna čistost)', () => {
  it('lib ima NIČ baznega uvoza, NIČ lastnega sorta, NIČ stene ure (determinizem)', () => {
    const vir = srcOf('src/lib/api-meja-audit.ts')
    expect(vir).not.toContain('@/lib/db')
    expect(vir).not.toContain('.sort(')
    expect(vir).not.toContain('new Date(')
    expect(vir).not.toContain('Math.random')
  })

  it('EN VIR: lexer je UVOŽEN iz avtomatizacija-audit (NIČ drugega leksra)', () => {
    const vir = srcOf('src/lib/api-meja-audit.ts')
    expect(vir).toContain("import { odstraniKomentarje } from './avtomatizacija-audit'")
  })
})
