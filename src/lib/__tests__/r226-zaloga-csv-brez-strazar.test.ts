// R226 — DEVETI signalec konvergence + zadnja trdo kodirana pika v vodjinem
// pregledu (P1-c nadaljevanje po R221 čip+paleta, R222 zvonček+zgodovina,
// R223 Domov kartica, R224 vodja zaslon+CSV+PDF, R225 Zaloga vrstica).
//
// Prej: CSV izvoz Zaloge (R136) je nosil stolpec 'Nizka' (DA/NE), artikli brez
// vpisane nabavne cene pa so bili v polnem izvozu nevidni — arhivska resnica
// o nabavni pripravljenosti je obstajala na zaslonu (badge R225) ni pa v
// izvozu, ki gre v Excel/nadzorne liste.
//
// Zdaj: CSV izvoz dobi stolpec 'Brez dobavitelja' (DA/NE) — VEDNO prisoten
// (arhivska resnica, tudi ko čip NI aktiven — ISTO kot 'Nizka' stolpec),
// vrednost iz dobesedne === 0 — ISTA enačba kot čip R221 / zvonček R222 /
// Domov R223 / vodja R224 / vrstica R225 / paleta+zgodovina R222. WYSIWYG:
// stolpec bere IZ 'filtered' — isti vidni artikli kot zaslon. STROGOST:
// manjkajoči števec NIKOLI ni 'DA' (fail-closed; brez ?? 0 / <= 0 / || 'DA').
//
// + [Mandatory] stil: zadnja trdo kodirana barvna klasa v vodjinem pregledu —
//   Zapadlo nevtralna pika 'bg-stone-400 dark:bg-stone-600' → žeton
//   'bg-muted-foreground' (en razred, OBE temi — žeton se sam prilagodi;
//   izbris dark: dvojčka; 0 novih hex). Prod dokaz R226: trdeKlas je padla
//   1 → 0 (DOM scan numeričnih barvnih klas).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const zaloga = beri('src/components/roksal/inventory-tab.tsx')
const badge = beri('src/components/roksal/badge-brez-dobavitelja.tsx')
const vodja = beri('src/components/roksal/vodja-dashboard.tsx')
const csvLib = beri('src/lib/csv-export.ts')

describe('R226 — F1 (P1-c): CSV izvoz stolpec Brez dobavitelja (DA/NE)', () => {
  it('glava CSV vsebuje stolpec Brez dobavitelja', () => {
    expect(zaloga).toContain("'Nizka', 'Brez dobavitelja'")
  })

  it('vrednost iz dobesedne === 0 (ISTA enačba kot vseh osem prejšnjih signalcev)', () => {
    expect(zaloga).toContain("item._count?.prices === 0 ? 'DA' : 'NE'")
  })

  it('STROGOST fail-closed: brez ?? 0 / <= 0 na števcu cen / || DA (manjkajoči števec NIKOLI DA)', () => {
    expect(zaloga).not.toContain("_count?.prices ?? ")
    expect(zaloga).not.toContain("_count?.prices <= 0")
    expect(zaloga).not.toContain("_count?.prices || 'DA'")
  })

  it('WYSIWYG: CSV bere IZ filtered (isti vidni artikli kot zaslon/seznam)', () => {
    const izvoz = zaloga.slice(zaloga.indexOf('function exportZalogaCsv'))
    expect(izvoz).toContain('filtered.map((item) => [')
  })

  it('regresija R136: originalnih sedem stolpcev ostaja, vrstni red nespremenjen', () => {
    expect(zaloga).toContain(
      "['Šifra', 'Naziv', 'Tip', 'Enota', 'Zaloga', 'Min. zaloga', 'Nizka', 'Brez dobavitelja']",
    )
  })

  it('Nizka stolpec (sorojenik) ostaja na dobesedni <= primerjavi', () => {
    expect(zaloga).toContain("item.kolicinaZaloga <= item.minimalnaZaloga ? 'DA' : 'NE'")
  })

  it('EN VIR: _count.prices prihaja s /api/inventory odgovora (R221 select ostaja)', () => {
    const api = beri('src/app/api/inventory/route.ts')
    expect(api).toContain('_count')
    expect(api).toContain('prices')
  })

  it('badge (osmi signalec R225) ostaja zasidran na ISTO enačbo (sožitje)', () => {
    expect(badge).toContain('Brez dobavitelja')
    expect(badge).toContain('roksal-amber')
  })

  it('CSV orodje nespremenjeno (downloadCsv + todayStamp ostajata vir izvoza)', () => {
    expect(zaloga).toContain("downloadCsv(\n      `zaloga-${todayStamp()}.csv`")
    expect(csvLib).toContain('export function downloadCsv')
  })
})

describe('R226 — [Mandatory] stil: vodja pregled 100 % na žetonih (trdeKlas 0)', () => {
  it('Zapadlo nevtralna pika: bg-muted-foreground (žeton), NI več stone', () => {
    expect(vodja).toContain("stats.zapadloSt > 0 ? 'bg-roksal-red' : 'bg-muted-foreground'")
    expect(vodja).not.toContain('bg-stone-400')
    expect(vodja).not.toContain('bg-stone-600')
  })

  it('NIČ numericnih barvnih klas v celotnem vodjinem pogledu (razširjen R225 vzorec + nevtralne družine)', () => {
    expect(vodja).not.toMatch(
      /(?:border|bg|text)-(?:blue|green|red|purple|amber|slate|gray|zinc|neutral|stone|yellow|orange|violet|indigo|emerald|teal|cyan|sky|rose|fuchsia|pink|lime)-\d{2,3}/,
    )
  })

  it('dark: dvojček pike izbrisan — žeton pokriva OBE temi (en razred, Zapadlo pika)', () => {
    const pika = "stats.zapadloSt > 0 ? 'bg-roksal-red' : 'bg-muted-foreground'"
    expect(vodja).toContain(pika)
    const okolica = vodja.slice(vodja.indexOf(pika) - 120, vodja.indexOf(pika) + 120)
    expect(okolica).not.toContain('dark:')
    expect(vodja).not.toContain('dark:bg-stone')
  })

  it('regresija R225: Zapadlo okvir in napisi ostajajo na žetonih', () => {
    expect(vodja).toContain("stats.zapadloSt > 0 ? 'border-roksal-red/20 bg-roksal-red/5' : 'border-border bg-muted/40'")
    expect(vodja).toContain("text-roksal-red' : 'text-muted-foreground'")
  })

  it('0 novih hex: vodja ne vnaša novih literalnih barv (hex pregled — obstoječi #1d2b3e edini)', () => {
    const hexi = vodja.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    const dovoljeni = new Set(['#1d2b3e'])
    for (const h of hexi) expect(dovoljeni.has(h.toLowerCase()), `nepričakovan hex ${h}`).toBe(true)
  })
})
