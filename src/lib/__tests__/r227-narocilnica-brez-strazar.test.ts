// R227 — DESETI signalec konvergence (P1-c nadaljevanje po R221 čip+paleta,
// R222 zvonček+zgodovina, R223 Domov kartica, R224 vodja zaslon+CSV+PDF,
// R225 Zaloga vrstica, R226 Zaloga CSV izvoz).
//
// Prej: naročilni tok (besedilna naročilnica R204 v odložišče + Osnutek
// dialog R205) je nosil količine, NI pa nabavne pripravljenosti per postavka
// — pisarna, ki v Osnutku izbira dobavitelja, ni videla, katere postavke
// aplikacija ne more oceniti (brez vpisane nabavne cene), in besedilna
// naročilnica za dobavitelja je štala za koliko, ne pa da je cena neznana.
//
// Zdaj: (1) lib buildZalogaPovzetek — vrstica z `_count?.prices === 0`
// (DOBESLEDNO; manjkajoči števec NIKOLI ni žig — fail-closed, brez ?? 0 /
// <= 0) dobi oznako '— brez vpisane nabavne cene' (iskreno v dokumentu za
// dobavitelja — cena ni izmišljena niti v besedilu); (2) Osnutek dialog —
// vrstica brez cene nosi ISTI badge kot vrstica Zaloge (ena definicija
// BadgeBrezDobavitelja, en vizual en pomen); (3) passthrough: zvonček
// (notification-center) in paleta (osnutekIzIskanja: cenaVrstic →
// _count.prices, ENA preslikava) nosita resnico do dialoga/naročilnice.
// Naročilnica CSV (narocilnicaCsvVrstice) ostaja NESPREMENJENA —
// dobaviteljska priloga ostane čista; notranji Zaloga CSV že nosi stolpec
// od R226.
//
// + [Mandatory] stil: password-dialog + password-change-banner — zadnje
//   trdo kodirane stone klase v geselnih površinah → žetoni (en razred obe
//   temi): border-stone-300 dark:border-stone-800 → border-border;
//   text-stone-600 dark:text-stone-400 → text-muted-foreground;
//   text-stone-700 dark:text-stone-300 → text-roksal-ink;
//   bg-stone-200 dark:bg-stone-800 → bg-muted. 0 novih hex; r165 PIN
//   (team-tab) ni v obsegu — team-tab ni dotaknjen.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildZalogaPovzetek, narocilnicaCsvVrstice, narociloKolicina } from '@/lib/zaloga-povzetek'
import { osnutekIzIskanja } from '@/lib/search-osnutek'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const lib = beri('src/lib/zaloga-povzetek.ts')
const osnutekLib = beri('src/lib/search-osnutek.ts')
const inventory = beri('src/components/roksal/inventory-tab.tsx')
const zvoncek = beri('src/components/roksal/notification-center.tsx')
const pwdDialog = beri('src/components/roksal/password-dialog.tsx')
const pwdBanner = beri('src/components/roksal/password-change-banner.tsx')

const NOW = new Date('2026-09-28T10:00:00')

function artikel(overrides: Partial<Parameters<typeof narociloKolicina>[0]> = {}) {
  return {
    id: 'a1',
    sifraMateriala: 'WPC-120-A',
    naziv: 'WPC profil 120',
    kolicinaZaloga: 2,
    enota: 'kos',
    minimalnaZaloga: 10,
    ...overrides,
  }
}

describe('R227 — F1 (P1-c): naročilnica oznaka brez vpisane nabavne cene (lib)', () => {
  it('vrstica z _count.prices === 0 dobi oznako — brez vpisane nabavne cene', () => {
    const besedilo = buildZalogaPovzetek([artikel({ _count: { prices: 0 } })], { now: NOW })
    const vrstica = besedilo.split('\n').find((l) => l.startsWith('1.'))
    expect(vrstica).toContain('— brez vpisane nabavne cene')
    expect(vrstica).toContain('naroči 10 kos')
  })

  it('vrstica z zasidrano ceno (_count.prices > 0) je BREZ oznake', () => {
    const besedilo = buildZalogaPovzetek([artikel({ _count: { prices: 2 } })], { now: NOW })
    expect(besedilo).not.toContain('brez vpisane nabavne cene')
  })

  it('manjkajoči _count = brez oznake (fail-closed — starejši producer ne laže)', () => {
    const besedilo = buildZalogaPovzetek([artikel()], { now: NOW })
    expect(besedilo).not.toContain('brez vpisane nabavne cene')
  })

  it('manjkajoči prices v _count = brez oznake (fail-closed)', () => {
    const besedilo = buildZalogaPovzetek([artikel({ _count: {} })], { now: NOW })
    expect(besedilo).not.toContain('brez vpisane nabavne cene')
  })

  it('pokvarjen tip števca (niz) = brez oznake (fail-closed, brez ?? 0 / <= 0)', () => {
    const besedilo = buildZalogaPovzetek(
      [artikel({ _count: { prices: '0' as unknown as number } })],
      { now: NOW },
    )
    expect(besedilo).not.toContain('brez vpisane nabavne cene')
  })

  it('STROGOST v viru: dobesedna === 0, brez ?? 0 / <= 0 ohlapnosti', () => {
    expect(lib).toContain('a._count?.prices === 0')
    expect(lib).not.toContain('_count?.prices ?? ')
    expect(lib).not.toContain('_count?.prices <= 0')
  })

  it('determinizem: isti vhod → identično besedilo (dva klica)', () => {
    const a = buildZalogaPovzetek(
      [artikel({ _count: { prices: 0 } }), artikel({ id: 'a2', naziv: 'Profil B', sifraMateriala: 'WPC-120-B', _count: { prices: 3 } })],
      { now: NOW },
    )
    const b = buildZalogaPovzetek(
      [artikel({ _count: { prices: 0 } }), artikel({ id: 'a2', naziv: 'Profil B', sifraMateriala: 'WPC-120-B', _count: { prices: 3 } })],
      { now: NOW },
    )
    expect(a).toBe(b)
    expect(a).toContain('1. WPC profil 120 (WPC-120-A): naroči 10 kos (zaloga 2 / min. 10) — brez vpisane nabavne cene')
    expect(a).toContain('2. Profil B (WPC-120-B): naroči 10 kos (zaloga 2 / min. 10)')
  })

  it('regresija R205: naročilnica CSV vrstice ostane brez stolpca dobaviteljske pripravljenosti (6 elementov)', () => {
    const vrstice = narocilnicaCsvVrstice([artikel({ _count: { prices: 0 } })])
    expect(vrstice).toHaveLength(1)
    expect(vrstice[0]).toHaveLength(6)
    expect(vrstice[0][5]).toBe(10)
  })

  it('regresija: narociloKolicina ne gleda _count (ISTA formula kot doslej)', () => {
    expect(narociloKolicina(artikel({ _count: { prices: 0 } }))).toBe(10)
    expect(narociloKolicina(artikel())).toBe(10)
    expect(narociloKolicina(artikel({ kolicinaZaloga: 10, minimalnaZaloga: 10 }))).toBe(10)
  })

  it('regresija fail-closed: artikel NAD minimumom → TypeError (jedro nikoli ne laže)', () => {
    expect(() => narociloKolicina(artikel({ kolicinaZaloga: 12, minimalnaZaloga: 10 }))).toThrow(TypeError)
    expect(() =>
      buildZalogaPovzetek([artikel({ kolicinaZaloga: 12, minimalnaZaloga: 10 })], { now: NOW }),
    ).toThrow(TypeError)
  })
})

describe('R227 — F1: passthrough resnice do dialoga/naročilnice', () => {
  it('osnutekIzIskanja: cenaVrstic 0 → _count.prices 0 (ista resnica, ista strogost)', () => {
    const a = osnutekIzIskanja({
      id: 'm1', naziv: 'WPC profil', sifra: 'WPC-120-A',
      kolicinaZaloga: 2, minimalnaZaloga: 10, enota: 'kos', cenaVrstic: 0,
    })
    expect(a).not.toBeNull()
    expect(a?._count?.prices).toBe(0)
  })

  it('osnutekIzIskanja: cenaVrstic 3 → _count.prices 3 (zasidran)', () => {
    const a = osnutekIzIskanja({
      id: 'm1', naziv: 'WPC profil', sifra: 'WPC-120-A',
      kolicinaZaloga: 2, minimalnaZaloga: 10, enota: 'kos', cenaVrstic: 3,
    })
    expect(a?._count?.prices).toBe(3)
  })

  it('osnutekIzIskanja: manjkajoč cenaVrstic = artikel BREZ _count (fail-closed)', () => {
    const a = osnutekIzIskanja({
      id: 'm1', naziv: 'WPC profil', sifra: 'WPC-120-A',
      kolicinaZaloga: 2, minimalnaZaloga: 10, enota: 'kos',
    })
    expect(a).not.toBeNull()
    expect(a).not.toHaveProperty('_count')
  })

  it('zvonček: osnutek passthrough nosi _count (ISTI objekt = ISTA resnica)', () => {
    expect(zvoncek).toContain('_count: i._count,')
  })

  it('Osnutek dialog: badge per vrstica iz ISTEGA dobesednega === 0 (ena definicija badgea)', () => {
    expect(inventory).toContain('{a._count?.prices === 0 && <BadgeBrezDobavitelja />}')
  })
})

describe('R227 — [Mandatory] stil: geselne površine 100% na žetonih (0 novih hex)', () => {
  it('password-dialog: NI več stone klas (obrobe/teksti/površine na žetonih)', () => {
    expect(pwdDialog).not.toContain('stone-')
    expect(pwdDialog).toContain('border border-border px-3')
    expect(pwdDialog).toContain('text-muted-foreground')
    expect(pwdDialog).toContain('text-roksal-ink')
    expect(pwdDialog).toContain("'bg-muted'")
  })

  it('password-change-banner: NI več stone klas (obrobe na žetonu border)', () => {
    expect(pwdBanner).not.toContain('stone-')
    expect(pwdBanner).toContain('border border-border px-3')
  })

  it('r165 PIN ni kršen: team-tab deaktivirani člani ostajajo nespremenjeni (izven obsega)', () => {
    const team = beri('src/components/roksal/team-tab.tsx')
    expect(team).toContain('border-stone-200 dark:border-stone-700')
  })
})
