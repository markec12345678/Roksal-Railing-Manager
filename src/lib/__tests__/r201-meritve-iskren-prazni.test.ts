// R201 — Meritve iskren prazni stolpec (ni projektov)
// ---------------------------------------------------------------------------
// R200 P1 (b): uporabnik brez projektov (spot realnost: /api/projects → 200 [])
// je na zavihku Meritve videl SLEPI izbirnik ('Izberi projekt' brez predmetov)
// in EmptyState 'Ni še meritev' z akcijo 'Dodaj meritev', ki brez projekta NE
// more delovati — navidezni poziv = izmišljeni podatki UI (družina R152).
//
// R201: izpeljanka `brezProjektov = !loading && projects.length === 0` ENKRAT,
// uporabljena na treh mestih:
//  1) izbirnik → iskren EmptyState 'Ni projektov' + 'Kaj naprej' koraki (brez
//     CTA — monter projektov ne ustvari);
//  2) seznam meritev → 'Meritve čakajo na projekt' BREZ akcije;
//  3) hitre predloge → razlaga 'Predloge so na voljo, ko je izbran projekt.'
//     (onemogočeni gumbi imajo kontekst, ni mrtvih gumbov brez razlage).
// Dodatno: zgodovina sprememb brez awkward '0 sprememb • zadnjih 0 prikazanih'.
//
// Testi so source-kontrakti (vzorec R186/R200): beremo izvorno datoteko,
// ker komponenta ni izvožena za enotske teste (7.9k vrstic, dinamični uvoz).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const TAB = 'src/components/roksal/measurements-tab.tsx'

describe('R201 — izpeljanka brezProjektov (en vir resnice)', () => {
  const src = () => srcOf(TAB)

  it('izpeljanka obstaja točno enkrat in je deterministična (!loading && projects.length === 0)', () => {
    const s = src()
    const zadetki = s.match(/const brezProjektov = !loading && projects\.length === 0/g) ?? []
    expect(zadetki).toHaveLength(1)
  })

  it('FolderX ikona uvožena točno enkrat (iskren prazni stolpec)', () => {
    const s = src()
    const uvozi = s.match(/\bFolderX\b/g) ?? []
    expect(uvozi.length).toBeGreaterThanOrEqual(2) // uvoz + vsaj ena uporaba
    expect(s).toMatch(/import \{[^}]*FolderX[^}]*\} from 'lucide-react'/)
  })

  it('data-testid meritve-brez-projektov prisoten (E2E prijemka)', () => {
    expect(src()).toContain('data-testid="meritve-brez-projektov"')
  })
})

describe('R201 — izbirnik: iskren prazni stolpec namesto slepega izbrika', () => {
  const src = () => srcOf(TAB)

  it('iskren naslov in razlaga (ni izmišljenih podatkov; vlogovo-neodvisna oblika — R202 uskladitev z realnostjo UI)', () => {
    const s = src()
    expect(s).toContain('title="Ni projektov"')
    expect(s).toContain('Meritve se vežejo na projekt — ko je projekt ustvarjen in dodeljen tebi, se pojavi tukaj.')
    // R202: stara vlogova trditev ('ko vodja ustvari') ODSTRANJENA — POST
    // /api/projects je seja-omejen (vsakdo z sejo), UI pa prikazuje gumb
    // 'Nov projekt' vsem — besedilo ne sme izmišljati omejitve.
    expect(s).not.toContain('ko vodja ustvari projekt')
  })

  it("'Kaj naprej' vodič: aria-label + natanko 3 koraki v pravilnem vrstnem redu (R202 uskladjeni z realnostjo UI)", () => {
    const s = src()
    expect(s).toContain('aria-label="Kaj naprej"')
    expect(s).toContain('Projekt ustvariš v zavihku Domov (gumb »Nov projekt«).')
    expect(s).toContain('Projekt se samodejno pojavi v tem zavihku.')
    expect(s).toContain('Zajemi meritve z AR kamero ali jih dodaj ročno.')
  })

  it('prazna veja ima NI CTA (brez action= med EmptyState in zaključkom) — monter ne ustvari projekta', () => {
    const s = src()
    const zacetek = s.indexOf('title="Ni projektov"')
    expect(zacetek).toBeGreaterThan(-1)
    const okno = s.slice(zacetek, zacetek + 600)
    expect(okno).not.toContain('action=')
  })

  it('slepi izbirnik ostane za uporabnike s projekti (regresija: placeholder + zemljevid projektov)', () => {
    const s = src()
    expect(s).toContain('placeholder="Izberi projekt"')
    expect(s).toContain('projects.map((p) => (')
  })
})

describe('R201 — seznam meritev: poštena prazna veja brez akcije', () => {
  const src = () => srcOf(TAB)

  it("veja brez projektov: 'Meritve čakajo na projekt' brez 'Dodaj meritev' akcije", () => {
    const s = src()
    const zacetek = s.indexOf('title="Meritve čakajo na projekt"')
    expect(zacetek).toBeGreaterThan(-1)
    const konec = s.indexOf('/>', zacetek)
    const okno = s.slice(zacetek, konec)
    expect(okno).toContain('Meritve se vežejo na projekt.')
    expect(okno).not.toContain('action=')
  })

  it("'Dodaj meritev' akcija ostane NATANKO enkrat (samo v veji s projekti)", () => {
    const s = src()
    const zadetki = s.match(/label: 'Dodaj meritev'/g) ?? []
    expect(zadetki).toHaveLength(1)
  })

  it("stara slepa razlaga 'Zajemi z AR kamero ali dodaj ročno.' ostane vezana na vejo s projekti", () => {
    const s = src()
    expect(s).toContain('Zajemi z AR kamero ali dodaj ročno.')
  })
})

describe('R201 — hitre predloge: onemogočeno = razloženo', () => {
  const src = () => srcOf(TAB)

  it('razlaga pri onemogočenih predlogah (role=note) vezana na brezProjektov', () => {
    const s = src()
    expect(s).toContain('Predloge so na voljo, ko je izbran projekt.')
    const zacetek = s.indexOf('Predloge so na voljo, ko je izbran projekt.')
    const okno = s.slice(Math.max(0, zacetek - 400), zacetek)
    expect(okno).toContain('brezProjektov &&')
    expect(okno).toContain('role="note"')
  })
})

describe('R201 — zgodovina sprememb: brez awkward ničelnega zapisa', () => {
  const src = () => srcOf(TAB)

  it('prazno stanje ima iskreno razlago namesto "0 sprememb • zadnjih 0 prikazanih"', () => {
    const s = src()
    expect(s).toContain('Ni sprememb — zgodovina se zapiše ob prvih meritvah.')
  })

  it('stari brezpogojni JSX zapis je odstranjen (števec samo v ternariju)', () => {
    const s = src()
    expect(s).not.toMatch(/\{auditEntries\.length\} \{auditEntries\.length === 1 \? 'sprememba' : 'sprememb'\} • zadnjih \{Math\.min/)
  })
})

describe('R201 — stilna higiena (družina R200: 0 novih hex, token družine)', () => {
  const src = () => srcOf(TAB)

  it('prazni stolpec uporablja token družine (roksal-navy, roksal-ink, muted-foreground) — brez novih hex', () => {
    const s = src()
    const zacetek = s.indexOf('data-testid="meritve-brez-projektov"')
    const konec = s.indexOf('MERITVE-PRO — LASER', zacetek)
    const okno = s.slice(zacetek, konec)
    expect(okno).toContain('bg-roksal-navy/10')
    expect(okno).toContain('text-roksal-ink')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('EmptyState komponenta (enoten vzorec praznih stanj) je uporabljena v obeh vejah', () => {
    const s = src()
    const zacetek = s.indexOf('data-testid="meritve-brez-projektov"')
    const konec = s.indexOf('MERITVE-PRO — LASER', zacetek)
    expect(s.slice(zacetek, konec)).toContain('<EmptyState')
    // FolderX = 2 veji (izbirnik + seznam)
    expect((s.match(/icon=\{FolderX\}/g) ?? []).length).toBe(2)
  })
})
