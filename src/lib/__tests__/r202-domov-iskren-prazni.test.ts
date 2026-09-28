// R202 — Domov iskren prazni stolpec (ni projektov) + uskladitev Meritve vodiča
// ---------------------------------------------------------------------------
// Inventar R202 (del R201 handover (e)): Fotke (amber opomba), Nagib (R154
// BREZ_PROJEKTA) in Tloris (destruktivni toasti) so ŽE iskreni — edina luknja
// je bila Domov: gola vrstica 'Ni aktivnih projektov' brez razlage, čeprav je
// Domov vozlišče, kamor kažejo vsi zavihki ('Izberite projekt v zavihku
// Domov'). Poleg tega: končna veja je MEŠALA tri primere (res nič / filter /
// iskanje) v eno sporočilo.
//
// R202 F1: trojna veja — (1) projects.length === 0 → EmptyState (družina
// R201: FolderX, 'Ni projektov', poštena razlaga) + 'Kaj naprej' 3 koraki,
// ki kažejo na REALNOST UI (gumb 'Nov projekt' je nad seznamom in POST
// /api/projects je seja-omejen — besedilo ne izmišljuje vlogovih omejitev);
// (2) filter-prazno → 'Ni projektov za izbrani filter' (natančno); (3)
// iskanje-prazno → 'Ni rezultatov za "X"' (nespremenjeno).
//
// R202 F2 (uskladitev): Meritve vodič/razlage iz R201 so omenjale 'vodjo' —
// besedila so zdaj vlogovo-neodvisna in usklađena z realnostjo UI (gumb
// 'Nov projekt' v Domovu). Stare trditve so v testih ZAVRANE (not.toContain).
//
// Testi so source-kontrakti (vzorec R186/R200/R201): beremo izvorne datoteke.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const DASH = 'src/components/roksal/dashboard-tab.tsx'
const TAB = 'src/components/roksal/measurements-tab.tsx'

describe('R202 — Domov: iskren prazni stolpec (družina R201)', () => {
  const src = () => srcOf(DASH)

  it('data-testid domov-brez-projektov prisoten (E2E prijemka)', () => {
    expect(src()).toContain('data-testid="domov-brez-projektov"')
  })

  it('FolderX uvožen točno enkrat v lucide bloku + EmptyState uvoz', () => {
    const s = src()
    expect(s).toMatch(/import \{[^}]*FolderX[^}]*\} from 'lucide-react'/)
    expect(s).toContain("import { EmptyState } from '@/components/ui/empty-state'")
  })

  it('iskren naslov + razlaga (projekti = osnova vseh orodij)', () => {
    const s = src()
    expect(s).toContain('title="Ni projektov"')
    expect(s).toContain('Projekti so osnova vseh orodij — meritve, fotke, nagibi in tloris se vežejo na izbrani projekt.')
  })

  it("'Kaj naprej' vodič: aria-label + natanko 3 koraki, vezani na REALNOST UI (gumb Nov projekt)", () => {
    const s = src()
    expect(s).toContain('aria-label="Kaj naprej"')
    expect(s).toContain('Ustvari projekt z gumbom Nov projekt (zgoraj).')
    expect(s).toContain('Klikni projekt na seznamu — izbira velja za vsa orodja.')
    expect(s).toContain('Zajemi meritve, fotke ali nagibe za projekt.')
  })

  it('trojna veja: res-nič → EmptyState; iskanje → Ni rezultatov; filter → natančno sporočilo', () => {
    const s = src()
    expect(s).toContain(') : projects.length === 0 ? (')
    expect(s).toContain("searchQuery\n                ? 'Ni rezultatov za \"' + searchQuery + '\"'")
    expect(s).toContain("'Ni projektov za izbrani filter'")
  })

  it("stara mešana sporočila ODSTRANJENA ('Ni aktivnih projektov' je mešalo filter in resnično praznino)", () => {
    expect(src()).not.toContain('Ni aktivnih projektov')
  })

  it('iskalni in napačni branchi ohranjena (regresija: Poskusi znova + alert)', () => {
    const s = src()
    expect(s).toContain('aria-label="Ponovno naloži projekte"')
    expect(s).toContain('Poskusi znova')
  })
})

describe('R202 — stilna higiena (token družine, 0 novih hex)', () => {
  const src = () => srcOf(DASH)

  it('prazni stolpec uporablja token družine — brez novih hex v oknu', () => {
    const s = src()
    const zacetek = s.indexOf('data-testid="domov-brez-projektov"')
    expect(zacetek).toBeGreaterThan(-1)
    const konec = s.indexOf('</div>', s.indexOf('</ol>', zacetek))
    const okno = s.slice(zacetek, konec)
    expect(okno).toContain('bg-roksal-navy/10')
    expect(okno).toContain('text-roksal-ink')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('EmptyState komponenta (enoten vzorec praznih stanj) uporabljena', () => {
    const s = src()
    const zacetek = s.indexOf('data-testid="domov-brez-projektov"')
    const okno = s.slice(zacetek, zacetek + 700)
    expect(okno).toContain('<EmptyState')
    expect((s.match(/icon=\{FolderX\}/g) ?? []).length).toBe(1)
  })
})

describe('R202 — Meritve uskladitev (F2): besedila brez izmišljenih vlogovih omejitev', () => {
  const src = () => srcOf(TAB)

  it("stara trditev 'ko vodja ustvari projekt' ODSTRANJENA (vsi opisi vlogovo-neodvisni)", () => {
    const s = src()
    expect(s).not.toContain('ko vodja ustvari projekt')
    expect(s).not.toContain('Vodja ustvari projekt v pisarniškem pogledu.')
    expect(s).not.toContain('Ko vodja ustvari projekt, lahko zajameš prvo meritev.')
  })

  it('nove vlogovo-neodvisne oblike prisotne (izbirnik + seznam + vodič)', () => {
    const s = src()
    expect(s).toContain('Meritve se vežejo na projekt — ko je projekt ustvarjen in dodeljen tebi, se pojavi tukaj.')
    expect(s).toContain('Meritve se vežejo na projekt. Ko je projekt izbran, lahko zajameš prvo meritev.')
    // R239 (P1-a): resnica posodobljena — ustvarjanje = vodstveno dejanje,
    // besedilo je vlogo-nevtralno in pove, KDO gumb vidi (iskrenost).
    expect(s).toContain('Projekt se ustvari v zavihku Domov (gumb »Nov projekt« — viden vodstvu).')
    expect(s).not.toContain('Projekt ustvariš v zavihku Domov (gumb »Nov projekt«).')
  })

  it("regresija R201 nedotaknjena: 'Dodaj meritev' natanko 1× + FolderX natanko 2× + testid", () => {
    const s = src()
    expect((s.match(/label: 'Dodaj meritev'/g) ?? []).length).toBe(1)
    expect((s.match(/icon=\{FolderX\}/g) ?? []).length).toBe(2)
    expect(s).toContain('data-testid="meritve-brez-projektov"')
  })
})
