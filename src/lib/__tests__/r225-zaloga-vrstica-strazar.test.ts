// R225 — OSMI signalec konvergence + zadnja barvna harmonizacija vodjinega
// pregleda (P1-c nadaljevanje po R221 čip+paleta, R222 zvonček+zgodovina,
// R223 Domov kartica, R224 vodja zaslon+CSV+PDF).
//
// Prej: vrstice Zaloge so pokazale nizko zalogo (TrendingDown rdeča ikona +
// 'Naroči' gumb), LE benzine z VPISANO ceno pri dobavitelju pa nič — artikel
// brez vpisane nabavne cene je bil na svoji domači površini neviden, čeprav
// /api/inventory OD R221 vrača _count.prices na vsakem odgovoru.
//
// Zdaj: vsaka vrstica z _count.prices === 0 nosi ISTI badge 'Brez
// dobavitelja' kot paleta ⌘K + zvonček (definicija TOČNO ENKRAT,
// badge-brez-dobavitelja.tsx R222 — en vizual en pomen). STROGOST: dobesedna
// === 0 (manjkajoči števec NIKOLI ni 'brez'; brez ?? 0 / <= 0).
//
// + [Mandatory] stil: vodjin pregled — zadnje trdo kodirane barvne družine
//   (modra/vijolična/rdeča-CRM/zelena + dark: dvojčki) → roksal-žetoni
//   (navy=informacija, amber=pozornost, red=alarm, green=pozitivno).
//   Opacity žetoni delujejo v OBEH temah. 0 novih hex.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const zaloga = beri('src/components/roksal/inventory-tab.tsx')
const badge = beri('src/components/roksal/badge-brez-dobavitelja.tsx')
const vodja = beri('src/components/roksal/vodja-dashboard.tsx')
const dom = beri('src/components/roksal/dashboard-tab.tsx')

describe('R225 — Zaloga vrstica: OSMI signalec (strogost === 0)', () => {
  it('badge je uvožen iz ENE defincije (badge-brez-dobavitelja.tsx R222)', () => {
    expect(zaloga).toContain(
      "import { BadgeBrezDobavitelja } from './badge-brez-dobavitelja'",
    )
  })

  it('per-vrstica pogoj je dobesedno === 0 (ISTA enačba kot čip/zvonček/Domov/vodja)', () => {
    expect(zaloga).toContain('{item._count?.prices === 0 && <BadgeBrezDobavitelja />}')
  })

  it('STROGOST: ohlapnejši izrazi so prepovedani (manjkajoče polje nikoli ne laže)', () => {
    expect(zaloga).not.toContain('_count?.prices ?? 0')
    expect(zaloga).not.toContain('_count?.prices <= 0')
    expect(zaloga).not.toContain('_count?.prices || 0')
  })

  it('EN VIR: _count.prices prihaja z ISTEMU /api/inventory odgovorom (tip od R221)', () => {
    expect(zaloga).toContain('_count?: { usages: number; movements: number; prices?: number }')
  })

  it('badge je informativen — NE nadomešča čipa (čip ostaja edini filter)', () => {
    expect(zaloga).toContain("setBrezDobaviteljaOnly((v) => !v)")
    // badge NIMA onClick (klik vrstice ni navigacija — filtrira čip)
    expect(zaloga).not.toContain('<BadgeBrezDobavitelja onClick')
  })
})

describe('R225 — badge: definicija TOČNO ENKRAT (sožitje signalcev)', () => {
  it('badge datoteka ostaja ENA definicija (roksal-amber družina)', () => {
    expect((badge.match(/export function BadgeBrezDobavitelja/g) ?? []).length).toBe(1)
    expect(badge).toContain('border-roksal-amber/30 bg-roksal-amber/10')
    expect(badge).toContain('Brez dobavitelja')
  })

  it('obstoječi signalci še vedno uvažajo ISTI badge (paleta + zvonček)', () => {
    expect(beri('src/components/roksal/command-palette.tsx')).toContain('BadgeBrezDobavitelja')
    expect(beri('src/components/roksal/notification-center.tsx')).toContain('BadgeBrezDobavitelja')
  })

  it('Domov + vodja kartice nespremenjeni (regresija R223/R224)', () => {
    expect(dom).toContain("detail: { tab: 'inventory', filter: 'brez-dobavitelja' }")
    expect(vodja).toContain("detail: { tab: 'inventory', filter: 'brez-dobavitelja' }")
  })
})

describe('R225 — [Mandatory] stil: vodja pregled brez trdo kodiranih barv', () => {
  it('NIČ numericnih barvnih klas (modra/vijolična/rdeča/zelena/amber + številke)', () => {
    expect(vodja).not.toMatch(/(?:border|bg|text)-(?:blue|green|red|purple|amber)-\d{2,3}/)
  })

  it('Danes kartice: navy (informacija) + amber (pozornost) + green (pozitivno)', () => {
    expect(vodja).toContain(
      'border-roksal-navy/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-roksal-navy/40 dark:border-roksal-ink/20 dark:hover:border-roksal-ink/30',
    )
    expect(vodja).toContain('border-roksal-amber/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-roksal-amber/50')
    expect(vodja).toContain('border-roksal-green/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-roksal-green/50')
  })

  it('žetoni terminov: ISTA struktura kot Domov STATUS_ZETONI (opacity žetoni)', () => {
    expect(vodja).toContain('bg-roksal-green/15 text-roksal-green border-roksal-green/30')
    expect(vodja).toContain('bg-roksal-amber/15 text-roksal-amber border-roksal-amber/30')
    expect(vodja).toContain('bg-roksal-navy/10 text-roksal-ink border-roksal-navy/25')
    // Domov zetoni ostajajo vir strukture (regresija)
    expect(dom).toContain("'bg-roksal-amber/20 text-roksal-ink'")
  })

  it('Ta mesec: vijolična NI družina → navy (informacija, ISTO kot Prihodek)', () => {
    expect(vodja).not.toContain('purple')
    expect(vodja).toContain('border-roksal-navy/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-border')
    expect(vodja).toContain('border-roksal-green/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md')
  })

  it('Zapadlo: roksal-red/20 + /5 (ISTA družina kot harmonizirana nizka zaloga R224)', () => {
    expect(vodja).toContain("stats.zapadloSt > 0 ? 'border-roksal-red/20 bg-roksal-red/5' : 'border-border bg-muted/40'")
  })

  it('Opozorila: potekli=ALARM (red), odprta naročila=INFORMACIJA (navy), vse v redu=POZITIVNO (green)', () => {
    const sectStart = vodja.indexOf('R225 — token harmonizacija Opozoril')
    const sectEnd = vodja.indexOf('>Skupno</h3>', sectStart)
    expect(sectStart).toBeGreaterThan(0)
    expect(sectEnd).toBeGreaterThan(sectStart)
    const sect = vodja.slice(sectStart, sectEnd)
    expect(sect).toContain('<Card className="border-roksal-red/20 bg-roksal-red/5">')
    // navy obroba potrebuje dark: dvojčka (R166 stražar — navy v temni temi
    // izgine; površina bg-roksal-navy/5 ostane ena vrstica, brez ločenih
    // svetlih ozadij)
    expect(sect).toContain('<Card className="border-roksal-navy/20 bg-roksal-navy/5 dark:border-roksal-ink/20">')
    expect(sect).toContain('<Card className="border-roksal-green/20 bg-roksal-green/5">')
  })

  it('števci v harmoniziranih karticah tabular-nums (družina R224)', () => {
    expect(vodja).toContain('<span className="tabular-nums">{stats.potekliOpomniki}</span>')
    expect(vodja).toContain('<span className="tabular-nums">{stats.odprtaNarocila}</span>')
  })

  it('0 novih hex — edini hex v datoteki je stari crew-bar fallback (prej obstoječ)', () => {
    const hexes = vodja.match(/#[0-9a-fA-F]{6}/g) ?? []
    expect(hexes).toEqual(['#1d2b3e'])
  })

  it('sistem-zdravje (notranja površina vodjinega pregleda): Baza odgovarja = roksal-green žeton', () => {
    const zdravje = beri('src/components/roksal/sistem-zdravje-card.tsx')
    expect(zdravje).not.toMatch(/(?:border|bg|text)-green-\d{2,3}/)
    expect(zdravje).toContain('border-roksal-green/30 bg-roksal-green/10')
    expect(zdravje).toContain('text-roksal-green')
  })
})
