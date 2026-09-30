// R224 — SEDMI signalec konvergence: kartica 'Brez dobavitelja' v vodjinem
// pregledu (P1-c nadaljevanje po R221 čip, R222 badgei na treh signalcih,
// R223 Domov kartica).
//
// Prej: vodjin pregled (Opozorila sekcija + CSV + PDF) je pokazal SAMO
// prvo dimenzijo (nizka zaloga + odprta naročila) — druga dimenzija
// (nabavna pripravljenost: artikli brez VPISANE cene pri katerem koli
// dobavitelju) je bila vodji nevidna, čeprav jo /api/inventory OD R221
// vrača na vsakem odgovoru (_count.prices).
//
// Zdaj: vodja dobi sorojenico iz ISTEGA /api/inventory fetcha (EN VIR,
// nič nove zahteve) na VSEH treh površinah: zaslon (Opozorila kartica),
// CSV (IZVOŽENO = ZASLON — tudi ko je 0) in PDF poročilo. STROGOST:
// manjkajoči števec NIKOLI ni 'brez' — le izrecna 0 (ISTA dobesedna
// enačba kot čip R221, zvonček R222, Domov R223).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildVodjaCsv } from '../vodja-csv'
import type { VodjaKpi } from '../vodja-csv'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const src = beri('src/components/roksal/vodja-dashboard.tsx')
const csvSrc = beri('src/lib/vodja-csv.ts')
const pdfSrc = beri('src/lib/boss-report-pdf.ts')

describe('R224 — vodja: izpeljanka iz ISTEGA fetcha (strogost === 0)', () => {
  it('števec je v VodjaStats tipu (Material sekcija, ob nizkaZaloga)', () => {
    expect(src).toContain('brezDobavitelja: number')
  })

  it('dobesedna enačba === 0 (ISTA kot čip R221 + zvonček R222 + Domov R223)', () => {
    expect(src).toContain('(i: { _count?: { prices?: number } }) => i._count?.prices === 0')
  })

  it('STROGOST: ohlapnejši izrazi so prepovedani (manjkajoče polje nikoli ne laže)', () => {
    expect(src).not.toContain('_count?.prices ?? 0')
    expect(src).not.toContain('_count?.prices <= 0')
  })

  it('EN VIR: izpeljanka iz ISTEGA inventory state (brez nove zahteve)', () => {
    expect(src).toContain('const brezDobavitelja = inventory.filter(')
  })

  it('setStats nosi števec (potek v stanje za vse tri površine)', () => {
    expect(src).toContain('brezDobavitelja,\n        skupajProjektov: projects.length,')
  })
})

describe('R224 — vodja: iskrena vidnost (brez lažnega 0)', () => {
  it('kartica vidna LE ko števec > 0 (nalagalna napaka je svoja fail-verbose veja)', () => {
    expect(src).toContain('stats.brezDobavitelja > 0')
  })

  it('iskreno "Vse v redu": TUDI brezDobavitelja mora biti 0 (prej laž)', () => {
    expect(src).toContain(
      'stats.potekliOpomniki === 0 && stats.nizkaZaloga === 0 && stats.odprtaNarocila === 0 && stats.brezDobavitelja === 0',
    )
  })
})

describe('R224 — vodja: klik → R221 filter protokol (ISTI dispatch kot Domov R223)', () => {
  it('deep-link nosi filter brez-dobavitelja (whitelist guard v page.tsx)', () => {
    expect(src).toContain("detail: { tab: 'inventory', filter: 'brez-dobavitelja' }")
  })

  it('iskren aria-label pove števec IN dejanje', () => {
    expect(src).toContain(
      'aria-label={`Brez dobavitelja (${stats.brezDobavitelja}) — odpre Zalogo s filtrom brez dobavitelja`}',
    )
  })

  it('opis pove resnico o naročilnem toku (ne samo števec)', () => {
    expect(src).toContain('Naročilni tok postavke ne more oceniti — klik odpre Zalogo s filtrom')
  })

  it('ISTI dispatch protokol kot Domov kartica R223 (EN VIR usmerjanja)', () => {
    const dom = beri('src/components/roksal/dashboard-tab.tsx')
    expect(dom).toContain("detail: { tab: 'inventory', filter: 'brez-dobavitelja' }")
    expect(src).toContain("detail: { tab: 'inventory', filter: 'brez-dobavitelja' }")
  })
})

describe('R224 — [Mandatory] stil: amber družina + semantična harmonizacija', () => {
  it('roksal-amber družina (pozornost, ne alarm — rdeča ostane nizki zalogi)', () => {
    expect(src).toContain('border-roksal-amber/40 bg-roksal-amber/5')
    expect(src).toContain('text-roksal-amber')
  })

  it('PackageX ikona (ISTA kot čip/zvonček/Domov — en vizual en pomen)', () => {
    expect(src).toContain('<PackageX className="h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />')
  })

  it('dostopna interakcija: focus ring + hover + text-left (gumb, ne div)', () => {
    expect(src).toContain('focus-visible:ring-2 focus-visible:ring-roksal-amber/40')
    expect(src).toContain('transition-colors hover:bg-roksal-amber/10')
    expect(src).toContain('p-3 text-left shadow-sm')
  })

  it('števec tabular-nums (sorojenica Domov pill + Zaloga čipov)', () => {
    expect(src).toContain('<span className="tabular-nums">{stats.brezDobavitelja}</span>')
  })

  it('SEMANTIČNA HARMONIZACIJA: nizka zaloga = roksal-red (app-wide pomen, prej amber hardcoded)', () => {
    expect(src).toContain('<Card className="border-roksal-red/20 bg-roksal-red/5">')
    // zožitev na Opozorila sekcijo (druge rabe amber — KPI kartice, statusi
    // terminov — so legitimne drugačne semantike 'v teku', ne opozorila)
    const sectStart = src.indexOf('>Opozorila</h3>')
    const sectEnd = src.indexOf('>Skupno</h3>', sectStart)
    expect(sectStart).toBeGreaterThan(0)
    expect(sectEnd).toBeGreaterThan(sectStart)
    const sect = src.slice(sectStart, sectEnd)
    expect(sect).not.toContain('amber-300')
    expect(sect).not.toContain('bg-amber-50')
  })

  it('0 novih hex — nova kartica uporablja samo tokenne razrede', () => {
    const cardStart = src.indexOf('R224 (P1-c nadaljevanje) — SEDMI signalec konvergence: kartica')
    const cardEnd = src.indexOf('stats.odprtaNarocila > 0', cardStart)
    expect(cardStart).toBeGreaterThan(0)
    expect(cardEnd).toBeGreaterThan(cardStart)
    const card = src.slice(cardStart, cardEnd)
    expect(card).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})

describe('R224 — CSV (IZVOŽENO = ZASLON): vodja-csv', () => {
  it('VodjaKpi tip nosi brezDobavitelja', () => {
    expect(csvSrc).toContain('brezDobavitelja: number')
  })

  it('Opozorila sekcija ima sedmo vrstico (tudi ko je 0 — arhivska resnica)', () => {
    // R324 PIN SHIFT: EN VIR dvig v družini dnevnega pregleda (52. člen) —
    // kpiLine/counter sta v vodjaKpiVrstice/preveriVodjaStevilo (sporočila
    // VERBATIM); VRSTICA ostaje ISTA (bajtna stabilnost — r324 test)
    expect(csvSrc).toContain("s('Opozorila', 'Brez dobavitelja', String(preveriVodjaStevilo(kpi.brezDobavitelja, 'brezDobavitelja', kje)))")
  })

  it('funkcionalno: vrednost 5 pride v CSV natanko kot na zaslonu', () => {
    const kpi: VodjaKpi = {
      danasTermini: 0, danasZakljuceni: 0, danasVpripravi: 0,
      mesecnoProjektov: 0, mesecniPrihodek: 0, mesecnaMarza: 0, mesecnoUr: 0,
      odprtoZnesek: 0, zapadloZnesek: 0, zapadloSt: 0, potekliOpomniki: 0,
      nizkaZaloga: 0, odprtaNarocila: 0, brezDobavitelja: 5, zamujeneDobave: 5,
      skupajProjektov: 0, skupajStrank: 0, skupniLTV: 0,
    }
    const { csv } = buildVodjaCsv({ kpi, termini: [], prihodki: [], danesIso: '2026-09-28' })
    expect(csv).toContain('"Opozorila","Brez dobavitelja","5"')
  })

  it('funkcionalno: vrednost 0 je v arhivu PRAVA meritev (ne šum)', () => {
    const kpi: VodjaKpi = {
      danasTermini: 0, danasZakljuceni: 0, danasVpripravi: 0,
      mesecnoProjektov: 0, mesecniPrihodek: 0, mesecnaMarza: 0, mesecnoUr: 0,
      odprtoZnesek: 0, zapadloZnesek: 0, zapadloSt: 0, potekliOpomniki: 0,
      nizkaZaloga: 0, odprtaNarocila: 0, brezDobavitelja: 0, zamujeneDobave: 0,
      skupajProjektov: 0, skupajStrank: 0, skupniLTV: 0,
    }
    const { csv } = buildVodjaCsv({ kpi, termini: [], prihodki: [], danesIso: '2026-09-28' })
    expect(csv).toContain('"Opozorila","Brez dobavitelja","0"')
  })

  it('STROGOST counter: ne-celo/ne-negativno število → TypeError (fail-closed)', () => {
    const kpi: VodjaKpi = {
      danasTermini: 0, danasZakljuceni: 0, danasVpripravi: 0,
      mesecnoProjektov: 0, mesecniPrihodek: 0, mesecnaMarza: 0, mesecnoUr: 0,
      odprtoZnesek: 0, zapadloZnesek: 0, zapadloSt: 0, potekliOpomniki: 0,
      nizkaZaloga: 0, odprtaNarocila: 0, brezDobavitelja: -1, zamujeneDobave: -1,
      skupajProjektov: 0, skupajStrank: 0, skupniLTV: 0,
    }
    expect(() => buildVodjaCsv({ kpi, termini: [], prihodki: [], danesIso: '2026-09-28' }))
      .toThrow(TypeError)
  })

  it('klicna stran v vodja-dashboardu poda števec v CSV kpi', () => {
    expect(src).toContain('brezDobavitelja: stats.brezDobavitelja,')
  })
})

describe('R224 — PDF poročilo: boss-report-pdf', () => {
  it('stats tip nosi brezDobavitelja', () => {
    expect(pdfSrc).toContain('brezDobavitelja: number')
  })

  it('opozorila vrstica z ISTO dimenzijo besedila (ISTO kot zaslon/CSV)', () => {
    expect(pdfSrc).toContain('if (s.brezDobavitelja > 0) opozorila.push(')
    expect(pdfSrc).toContain('brez vpisane nabavne cene — naročilni tok jih ne more oceniti')
  })
})

describe('R224 — sožitje z obstoječimi signalci (brez regresij)', () => {
  it('nizka zaloga + odprta naročila + potekli opomniki kartice ostanejo', () => {
    expect(src).toContain('materialov z nizko zalogo')
    expect(src).toContain('odprtih naročil')
    expect(src).toContain('poteklih opomnikov')
  })

  it('CSV ostale Opozorila vrstice nespremenjene (brez zamenjave vrstnega reda)', () => {
    // R324 PIN SHIFT: kpiLine → s (vodjaKpiVrstice EN VIR lift; vrstni red vrstic ISTI)
    expect(csvSrc).toContain("s('Opozorila', 'Potekli opomniki'")
    expect(csvSrc).toContain("s('Opozorila', 'Nizka zaloga'")
    expect(csvSrc).toContain("s('Opozorila', 'Odprta naročila'")
  })

  it('PDF ostala opozorila nespremenjena', () => {
    expect(pdfSrc).toContain('material(ov) z nizko zalogo — naroči pri dobavitelju')
    expect(pdfSrc).toContain('odprt(ih) naročil — čaka dobavo')
    expect(pdfSrc).toContain('potekl(ih) opomnik(ov) strank v CRM')
  })
})
