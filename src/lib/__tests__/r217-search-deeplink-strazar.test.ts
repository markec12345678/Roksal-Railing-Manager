// R217 — P1-d konvergenca TRETJEGA signalca (iskanje → naročilni tok) +
// P1-f dostopnost resnica (Naroči KPIRA, zvonček stock pove kam vodi).
//
// Prej: iskalni zadetek Materiala je bil EDINI signal, ki je videl artikel
// pod minimumom in ga NI povezal z naročilnim tokom (paleta R215/R216 in
// zvonček R216 sta imela deep-link; iskanje je znalо samo skočiti v Zalogo).
// Hkrati je bil vidni napis 'Naroči' v Zalogi za zaslonkski bralnik LAŽ —
// gumb kopira naročilnico, ne odpre naročila. Zdaj: EN VIR presojanja
// (osnutekIzIskanja — fail-closed brez polj), iskren badge + podnapis,
// aria-label = resnično dejanje.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { osnutekIzIskanja, type IskalniMaterial } from '@/lib/search-osnutek'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const zadetek: IskalniMaterial = {
  id: 'inv-1',
  naziv: 'Inox Vijak M8 A2',
  sifra: 'VIJ-M8',
  kolicinaZaloga: 199,
  minimalnaZaloga: 200,
  enota: 'kos',
}

describe('R217 — osnutekIzIskanja (EN VIR, fail-closed)', () => {
  it('pod minimumom + vsa polja → POPOLN artikel (sifra → sifraMateriala)', () => {
    expect(osnutekIzIskanja(zadetek)).toEqual({
      id: 'inv-1',
      sifraMateriala: 'VIJ-M8',
      naziv: 'Inox Vijak M8 A2',
      kolicinaZaloga: 199,
      enota: 'kos',
      minimalnaZaloga: 200,
    })
  })

  it('meja <= — NA minimumu je tudi nizka (ista semantika kot R215/R216)', () => {
    expect(osnutekIzIskanja({ ...zadetek, kolicinaZaloga: 200 })?.kolicinaZaloga).toBe(200)
  })

  it('nad minimumom → null (brez lažnega badgea)', () => {
    expect(osnutekIzIskanja({ ...zadetek, kolicinaZaloga: 201 })).toBeNull()
  })

  it('manjkajoča/napačna polja → null (fail-closed, ne ugibamo)', () => {
    expect(osnutekIzIskanja({ id: 'x', naziv: 'n', sifra: 's' })).toBeNull()
    expect(osnutekIzIskanja({ ...zadetek, kolicinaZaloga: Number.NaN })).toBeNull()
    expect(osnutekIzIskanja({ ...zadetek, kolicinaZaloga: Number.POSITIVE_INFINITY })).toBeNull()
    expect(osnutekIzIskanja({ ...zadetek, enota: '' })).toBeNull()
  })
})

describe('R217 — /api/search vrača zaloga polja (route.ts)', () => {
  const src = beri('src/app/api/search/route.ts')

  it('select razširjen s kolicinaZaloga/minimalnaZaloga/enota', () => {
    expect(src).toContain('kolicinaZaloga: true')
    expect(src).toContain('minimalnaZaloga: true')
    expect(src).toContain('enota: true')
  })

  it('odgovor vključuje ista polja (map inventory)', () => {
    expect(src).toContain('kolicinaZaloga: i.kolicinaZaloga')
    expect(src).toContain('minimalnaZaloga: i.minimalnaZaloga')
    expect(src).toContain('enota: i.enota')
  })

  it('visibility meja NESPREMENJENA (fail-closed — inventory samo seje)', () => {
    expect(src).toContain('visibility.inventory')
    expect(src).toContain('searchVisibilityFor(auth)')
  })
})

describe('R217 — paleta Material deep-link (command-palette.tsx)', () => {
  const src = beri('src/components/roksal/command-palette.tsx')

  it('EN VIR uvoz osnutekIzIskanja (+ tip za iskalne zadetke)', () => {
    // R218 PIN posodobitev: uvoz je zdaj večvrstični blok (prišla zgodovina —
    // preberiZgodovinoVnose/zdruziZgodovino); R217 simboli ostajajo EN VIR.
    expect(src).toContain("} from '@/lib/search-osnutek'")
    expect(src).toContain('  osnutekIzIskanja,')
    expect(src).toContain('  type IskalniMaterial,')
    expect(src).toContain('inventory: IskalniMaterial[]')
  })

  it('deep-link: klik low-stock zadetka pošlje 4. argument (osnutek)', () => {
    expect(src).toContain("if (osnutek) onNavigate('inventory', null, null, osnutek)")
  })

  it('fail-closed veja: brez osnutka navadna navigacija (regresija R215)', () => {
    expect(src).toContain("else onNavigate('inventory')")
  })

  it('iskren badge + podnapis (barva ni edini nosilec, tabular-nums)', () => {
    // R219 PIN posodobitev: badge tekst je EN VIR komponenta
    // (badge-nizka-zaloga.tsx — dobesedni 'Nizka zaloga' tam; paleta jo uvozi)
    expect(src).toContain('{osnutek && <BadgeNizkaZaloga />}')
    const badge = beri('src/components/roksal/badge-nizka-zaloga.tsx')
    expect(badge).toMatch(/>\s*Nizka zaloga\s*<\/span>/)
    // podnapis (zaloge/minimum, tabular-nums) ostane v paleti
    expect(src).toMatch(/font-medium tabular-nums text-roksal-red">\{osnutek\.kolicinaZaloga\}/)
    expect(src).toContain('minimum <span className="tabular-nums">{osnutek.minimalnaZaloga}</span>')
  })

  it('aria-label: low-stock zadetek pove dejanje (odpre naročilni tok)', () => {
    expect(src).toContain('nizka zaloga, odpre naročilni tok')
  })

  it('0 novih hex v paleti (token družina — regresija R214)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R217 — dostopnost resnica (inventory-tab + notification-center)', () => {
  const inv = beri('src/components/roksal/inventory-tab.tsx')
  const bell = beri('src/components/roksal/notification-center.tsx')

  it("Naroči gumb: aria-label pove KOPIRANJE (ne laži 'odpre naročilo')", () => {
    expect(inv).toContain('aria-label={`Kopiraj naročilnico za artikel ${item.naziv} — besedilo za e-pošto/SMS`}')
  })

  it('zvonček stock vrstica: aria-label pove kam vodi (fail-closed brez osnutka)', () => {
    expect(bell).toContain('`${item.title} — odpre Zalogo in naročilni tok`')
    expect(bell).toContain('`${item.title} — odpre Zalogo`')
  })

  it('deep-link dispatch NESPREMENJEN (R216 regresija)', () => {
    expect(bell).toContain("detail: item.osnutek ? { tab: 'inventory', osnutek: item.osnutek } : { tab: 'inventory' }")
  })
})
