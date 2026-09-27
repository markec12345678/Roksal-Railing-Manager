// R222 — 'brez dobavitelja' druga dimenzija dobi glas v obstoječih signalcih
// konvergence (P1-c nadaljevanje po R221 chip + paleta skupini).
//
// Prej: R221 je 'brez dobavitelja' pokazal SAMO v Zalogi (čip + prazna
// stanja) in paleti (skupina + deep-link). Iskalni Material zadetek (⌘K),
// zgodovina iskanja in zvonček digest so ostali slepi za to dimenzijo —
// uporabnik je na treh mestih videl artikel in ni vedel, da naročilni tok
// postavke ne more oceniti.
//
// Zdaj: ISTI signalci nosijo tudi drugo dimenzijo — Material zadetek z
// cenaVrstic === 0 nosi amber badge 'Brez dobavitelja' (+ žig v zgodovino,
// neodvisno od nizke zaloge — lahko SOBOJITA), zgodovinski vnos z žigom
// nosi ISTI badge, zvonček pa dobi lastne vrstice artiklov brez vpisane
// cene iz ISTEGA /api/inventory fetcha (klik → Zaloga z aktivnim čipom prek
// R221 filter protokola). STROGOST brez izmišljevanja: manjkajoči števec
// NIKOLI ni 'brez' — le izrecna 0 (fail-closed; brez `?? 0` / `<= 0`).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  brezDobaviteljaIzIskanja,
  preberiZgodovinoVnose,
  zdruziZgodovino,
  type RecentSearchVnos,
} from '@/lib/search-osnutek'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

describe('R222 — brezDobaviteljaIzIskanja (EN VIR presojanja, dobesedna strogost)', () => {
  it('izrecna 0 = brez dobavitelja (enanki edini resnični primer)', () => {
    expect(brezDobaviteljaIzIskanja({ id: 'a', naziv: 'X', sifra: 'X1', cenaVrstic: 0 })).toBe(true)
  })

  it('manjkajoči števec NIKOLI ni brez (stari predpomnjeni odgovor ne laže — fail-closed)', () => {
    expect(brezDobaviteljaIzIskanja({ id: 'a', naziv: 'X', sifra: 'X1' })).toBe(false)
    expect(brezDobaviteljaIzIskanja({ id: 'a', naziv: 'X', sifra: 'X1', cenaVrstic: undefined })).toBe(false)
  })

  it('vsak drug števec pomeni zasidranega dobavitelja (tudi 1)', () => {
    expect(brezDobaviteljaIzIskanja({ id: 'a', naziv: 'X', sifra: 'X1', cenaVrstic: 1 })).toBe(false)
    expect(brezDobaviteljaIzIskanja({ id: 'a', naziv: 'X', sifra: 'X1', cenaVrstic: 3 })).toBe(false)
  })

  it('STROGOST: v lib sta prepovedana ohlapnejša izraza (lažno trdita brez pri manjkajočem polju)', () => {
    const src = beri('src/lib/search-osnutek.ts')
    expect(src).toContain('return m.cenaVrstic === 0')
    expect(src).not.toContain('cenaVrstic ?? 0')
    expect(src).not.toContain('cenaVrstic <= 0')
  })
})

describe('R222 — zgodovina: drugi neodvisni žig (fail-closed razčlenjevalnik)', () => {
  it('vnos z dobesedno true nosi žig; vse ostalo je nevtralno (NIKOLI lažnega)', () => {
    const vnosi = preberiZgodovinoVnose(
      [
        { q: 'wpc deska', brezDobavitelja: true },
        { q: 'inox m12', brezDobavitelja: 'true' },
        { q: 'm8 a2', brezDobavitelja: 1 },
      ],
      5,
    )
    expect(vnosi[0]).toEqual({ q: 'wpc deska', brezDobavitelja: true })
    expect(vnosi[1]).toEqual({ q: 'inox m12' })
    expect(vnosi[2]).toEqual({ q: 'm8 a2' })
  })

  it('vnos z OBEMA žigoma je veljaven in ohrani oba (dve neodvisni dimenziji)', () => {
    const vnosi = preberiZgodovinoVnose(
      [{ q: 'wpc deska', nizkaZaloga: true, brezDobavitelja: true }],
      5,
    )
    expect(vnosi[0]).toEqual({ q: 'wpc deska', nizkaZaloga: true, brezDobavitelja: true })
  })

  it('stari vnosi (gol niz, nizkaZaloga shema) ostanejo nespremenjeni — shema pred R222', () => {
    const vnosi = preberiZgodovinoVnose(['inox', { q: 'm12', nizkaZaloga: true }], 5)
    expect(vnosi[0]).toEqual({ q: 'inox' })
    expect(vnosi[1]).toEqual({ q: 'm12', nizkaZaloga: true })
  })
})

describe('R222 — zdruziZgodovino: peti neobvezen argument (starejši klici ostanejo)', () => {
  it('5. argument true → žig na novem vnosu; false/undefined → brez žiga', () => {
    const z = zdruziZgodovino([], 'wpc', false, 5, true)
    expect(z[0]).toEqual({ q: 'wpc', brezDobavitelja: true })
    const brez = zdruziZgodovino([], 'wpc', false, 5, false)
    expect(brez[0]).toEqual({ q: 'wpc' })
    const staro = zdruziZgodovino([], 'wpc', true, 5)
    expect(staro[0]).toEqual({ q: 'wpc', nizkaZaloga: true })
  })

  it('SVEŽA resnica zmaga: ponovno iskanje ISTEGA q brez žiga ZAMENJA prejšnji žig', () => {
    const obstojeca: RecentSearchVnos[] = [{ q: 'wpc', brezDobavitelja: true, nizkaZaloga: true }]
    const rez = zdruziZgodovino(obstojeca, 'WPC', false, 5, false)
    expect(rez).toHaveLength(1)
    // nov vnos nosi poizvedbo v ORIGINALNI obliki (dedup je case-insenzitiven,
    // oblika vnosa se ne spreminja — ISTI vzorec kot pred R218)
    expect(rez[0]).toEqual({ q: 'WPC' })
  })

  it('obema žigoma hkrati true → oba na vnosu (dve dimenziji, ena poizvedba)', () => {
    const rez = zdruziZgodovino([], 'wpc', true, 5, true)
    expect(rez[0]).toEqual({ q: 'wpc', nizkaZaloga: true, brezDobavitelja: true })
  })

  it('krajša poizvedba zgodovino NE spreminja (kopija — tudi s 5. argumentom)', () => {
    const obstojeca: RecentSearchVnos[] = [{ q: 'wpc' }]
    const rez = zdruziZgodovino(obstojeca, 'w', false, 5, true)
    expect(rez).toEqual([{ q: 'wpc' }])
    expect(rez).not.toBe(obstojeca)
  })
})

describe("R222 — /api/search: števec zasidranj za badge (route.ts)", () => {
  const src = beri('src/app/api/search/route.ts')

  it('_count.prices v selectu (ISTI EN VIR zasidranja kot R221 /api/inventory)', () => {
    expect(src).toContain('_count: { select: { prices: true } }')
  })

  it('odgovor nosi cenaVrstic (iskren števec — paleta sodi prek lib)', () => {
    expect(src).toContain('cenaVrstic: i._count.prices')
  })
})

describe('R222 — paleta ⌘K: Material zadetek + zgodovina nosita drugi badge', () => {
  const src = beri('src/components/roksal/command-palette.tsx')

  it('EN VIR presojanje + EN VIR badge (definicija TOČNO ENKRAT)', () => {
    expect(src).toContain('brezDobaviteljaIzIskanja')
    expect(src).toContain("from '@/components/roksal/badge-brez-dobavitelja'")
    expect(src).toContain('{brez && <BadgeBrezDobavitelja />}')
  })

  it('žig v zgodovino zabeležen ob izboru (neodvisno od nizke zaloge)', () => {
    expect(src).toContain('rememberSearch(q, osnutek !== null, brez)')
    expect(src).toContain('saveRecentSearch(q, nizkaZaloga, brezDobavitelja)')
  })

  it('zgodovinski vnos nosi amber badge (lahko soboji z rdečim — vsak pove svoje)', () => {
    expect(src).toContain('r.brezDobavitelja === true && <BadgeBrezDobavitelja />')
  })

  it('iskren aria-label: brez-only pove resnico (naročilni tok postavke ne more oceniti pomeni odpre Zalogo)', () => {
    expect(src).toContain('— brez vpisane dobaviteljske cene, odpre Zalogo')
    expect(src).toContain('— nizka zaloga brez vpisane dobaviteljske cene, odpre naročilni tok')
  })

  it('klik ostane nespremenjen: deep-link nosi SAMO osnutek (badge brez je informativni)', () => {
    expect(src).toContain("if (osnutek) onNavigate('inventory', null, null, osnutek)")
  })
})

describe("R222 — zvonček: 'Brez dobavitelja' vrstice iz ISTEGA fetcha (notification-center.tsx)", () => {
  const src = beri('src/components/roksal/notification-center.tsx')

  it('nova vrsta digesta + strogost === 0 (manjkajoči števec NIKOLI ni brez)', () => {
    expect(src).toContain("'stock' | 'install' | 'weather' | 'followup' | 'invoice' | 'order' | 'brez'")
    expect(src).toContain('i._count?.prices === 0')
    expect(src).not.toContain('_count?.prices ?? 0')
    expect(src).not.toContain('_count?.prices <= 0')
  })

  it('ISTI fetch kot nizka zaloga (brez nove zahteve — _count opcijsko v tipu, fail-closed)', () => {
    expect(src).toContain('_count?: { prices?: number }')
    expect(src).toContain("id: `brez-${i.id}`")
    expect(src).toContain("kind: 'brez'")
    expect(src).toContain('Brez vpisane cene pri katerem koli dobavitelju')
  })

  it('klik → Zaloga z AKTIVNIM čipom (R221 filter deep-link protokol — detail.filter)', () => {
    expect(src).toContain("item.kind === 'brez'")
    expect(src).toContain("detail: { tab: 'inventory', filter: 'brez-dobavitelja' }")
  })

  it('[Mandatory] stil — PackageX + amber družina (pozornost, ne alarm; rdeča ostane nizki zalogi)', () => {
    expect(src).toContain("brez: { icon: PackageX, bg: 'bg-roksal-amber/15', fg: 'text-roksal-amber' }")
    expect(src).toContain('{item.kind === \'brez\' && <BadgeBrezDobavitelja />}')
    expect(src).toContain('odpre Zalogo s filtrom brez dobavitelja')
  })

  it('iskreno prazno stanje omenja tudi drugo dimenzijo (brez lažnega Vse je pod nadzorom)', () => {
    expect(src).toContain('Ni nizke zaloge, ni artiklov brez dobavitelja, danes ni montaž')
  })
})

describe('R222 — BadgeBrezDobavitelja: EN VIR komponenta (sorojenik BadgeNizkaZaloga)', () => {
  const src = beri('src/components/roksal/badge-brez-dobavitelja.tsx')

  it('roksal-amber družina (ISTA struktura kot rdeči badge — 0 novih tokenov)', () => {
    expect(src).toContain('border-roksal-amber/30 bg-roksal-amber/10')
    expect(src).toContain('text-roksal-amber')
    expect(src).toContain('Brez dobavitelja')
  })

  it('barva ni edini nosilec — dobeseden tekst + uppercase + tracking (dostopnost)', () => {
    expect(src).toContain('font-bold uppercase tracking-wide')
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})
