// ---------------------------------------------------------------------------
// R314 — 44. člen issue #1 (Deliverable 4 NA ZASLONU): feature-by-feature
// audit tabela + MANDATORY STIL val 5 (calculator-tab + post-signature-panel
// + photo-tab).
//
// Deli:
//  1. LIB kontrakt (avtomatizacija-pregled): EN VIR projekcija audita —
//     števec izračunani (nikoli trdo kodirani), sklep verbatim, determinizem
//     bajtno, fail-closed ×6.
//  2. STRAŽAR val 5 (r308/R311 lekcija — regex z realno predpono):
//     calculator-tab + post-signature-panel BREZ surove amber (0 izjem);
//     photo-tab NATANKO 2 izjemi (barvno kodirana kategorija faze
//     PRED blue / MED amber / PO green — R308/R312 precedens).
//  3. vodja-dashboard: blok ŽIVI v viru (testidi, EN VIR sklep verbatim —
//     literalski dvojnik prepovedan, vzorec R311/R312 STRAŽAR).
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { avtomatizacijaPregled, RAZRED_PRIKAZNO } from '@/lib/avtomatizacija-pregled'
import type { VrstaAudita } from '@/lib/avtomatizacija-audit'
import { AVTOMATIZACIJA_AUDIT, RAZREDI } from '@/lib/avtomatizacija-audit'

const vodja = () =>
  readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')

describe('r314 — avtomatizacijaPregled (44. člen — Deliverable 4 NA ZASLONU)', () => {
  it('EN VIR: vrstice = audit (isti vrstni red), števec izračunani iz dejanskih poti', () => {
    const p = avtomatizacijaPregled()
    expect(p.vrstice.length).toBe(AVTOMATIZACIJA_AUDIT.length)
    expect(p.stObmocij).toBe(AVTOMATIZACIJA_AUDIT.length)
    for (let i = 0; i < p.vrstice.length; i++) {
      const v = p.vrstice[i]!
      const a = AVTOMATIZACIJA_AUDIT[i]!
      expect(v.obmocje).toBe(a.obmocje)
      expect(v.razred).toBe(a.razred)
      expect(v.stImplementacij).toBe(a.implementacija.length)
      expect(v.stDokazov).toBe(a.dokaz.length)
      expect(v.opomba).toBe(a.opomba)
      expect(v.razredPrikazno).toBe(RAZRED_PRIKAZNO[v.razred])
    }
  })

  it('števci po razredu: vsota = število območij, vsi 5 razredov prisotni v mapi', () => {
    const p = avtomatizacijaPregled()
    const kljuci = Object.keys(p.poRazredu).sort()
    expect(kljuci).toEqual([...RAZREDI].sort())
    const vsota = RAZREDI.reduce((s, r) => s + p.poRazredu[r], 0)
    expect(vsota).toBe(p.stObmocij)
    // EN VIR dokaz: števec izračunan iz audita (ne obratno)
    for (const r of RAZREDI) {
      const dejansko = AVTOMATIZACIJA_AUDIT.filter((v) => v.razred === r).length
      expect(p.poRazredu[r]).toBe(dejansko)
    }
  })

  it('iskren sklep: izračunani števec + ničelna AI-OBVEZNO veja (WYSIWYG z zaslonom)', () => {
    const p = avtomatizacijaPregled()
    expect(p.sklep).toContain(`Audit območij: ${p.stObmocij} (§1–§11)`)
    expect(p.sklep).toContain(`DETERMINISTIČNO: ${p.poRazredu.DETERMINISTICNO}`)
    expect(p.sklep).toContain(`SDK: ${p.poRazredu.SDK}`)
    expect(p.sklep).toContain(`SKRIPTA: ${p.poRazredu.SKRIPTA}`)
    expect(p.sklep).toContain(`AI-OPCIJSKO: ${p.poRazredu.AI_OPCIJSKO}`)
    expect(p.sklep).toContain(`AI-OBVEZNO: ${p.poRazredu.AI_ZAHTEVANO}`)
    // ničelna veja (današnja resnica: AI-obveznih 0 — jedro deluje brez AI)
    if (p.poRazredu.AI_ZAHTEVANO === 0) {
      expect(p.sklep.endsWith(' — jedro deluje brez AI')).toBe(true)
    } else {
      expect(p.sklep.endsWith(' — vsako AI-obvezno območje zahteva izrecno utemeljitev')).toBe(true)
    }
  })

  it('determinizem: isti vhod = bajtno enak izhod (sklep + vrstice)', () => {
    const a = JSON.stringify(avtomatizacijaPregled())
    const b = JSON.stringify(avtomatizacijaPregled())
    expect(a).toBe(b)
  })

  it('fail-closed: ne-polje → TypeError z imenom graditelja', () => {
    // @ts-expect-error — test namenoma krši kontrakt
    expect(() => avtomatizacijaPregled(null)).toThrow('avtomatizacijaPregled:')
  })

  it('fail-closed: prazen audit → TypeError (tabela ne sme sanjati §1–§11)', () => {
    expect(() => avtomatizacijaPregled([])).toThrow('audit brez vrstic')
  })

  it('fail-closed: neznani razred → TypeError z razredi v sporočilu', () => {
    const pokvarjen = [
      {
        obmocje: '§X Test',
        razred: 'NEZNAN' as never,
        implementacija: ['src/lib/avtomatizacija-audit.ts'],
        dokaz: ['src/lib/__tests__/r314-avtomatizacija-pregled.test.ts'],
        opomba: 'test',
      } satisfies VrstaAudita,
    ]
    expect(() => avtomatizacijaPregled(pokvarjen)).toThrow('NEZNANIM razredom')
  })

  it('fail-closed: vrstica brez implementacije / dokaza / opombe → TypeError', () => {
    const brezImpl = [
      { obmocje: '§X', razred: 'SDK' as const, implementacija: [], dokaz: ['src/lib/x.test.ts'], opomba: 'o' },
    ] as unknown as VrstaAudita[]
    expect(() => avtomatizacijaPregled(brezImpl)).toThrow('brez implementacijskih poti')
    const brezDokaza = [
      { obmocje: '§X', razred: 'SDK' as const, implementacija: ['src/lib/avtomatizacija-audit.ts'], dokaz: [], opomba: 'o' },
    ] as unknown as VrstaAudita[]
    expect(() => avtomatizacijaPregled(brezDokaza)).toThrow('brez dokaznih poti')
    const brezOpombe = [
      { obmocje: '§X', razred: 'SDK' as const, implementacija: ['src/lib/avtomatizacija-audit.ts'], dokaz: ['src/lib/x.test.ts'], opomba: '  ' },
    ] as unknown as VrstaAudita[]
    expect(() => avtomatizacijaPregled(brezOpombe)).toThrow('brez opombe')
  })

  it('prikazna imena: vsi 5 razredov preslikani (WYSIWYG vir)', () => {
    expect(RAZREDI.map((r) => RAZRED_PRIKAZNO[r]).length).toBe(5)
    expect(RAZRED_PRIKAZNO.DETERMINISTICNO).toBe('DETERMINISTIČNO')
    expect(RAZRED_PRIKAZNO.AI_OPCIJSKO).toBe('AI-OPCIJSKO')
    expect(RAZRED_PRIKAZNO.AI_ZAHTEVANO).toBe('AI-OBVEZNO')
  })
})

describe('r314 STRAŽAR — MANDATORY STIL val 5 (calculator-tab + post-signature-panel + photo-tab)', () => {
  // R308/R311 lekcija: STRAŽAR regex rabi realno predpono — /amber-(50|…|950)\b/
  const SUROVA_AMBER = /amber-(50|100|200|300|400|500|600|700|800|900|950)\b/
  const vrstice = (dat: string): string[] =>
    readFileSync(join(process.cwd(), 'src/components/roksal', dat), 'utf8')
      .split('\n')
      .filter((v) => SUROVA_AMBER.test(v) && !v.includes('roksal-amber'))
      .map((v) => v.trim())

  it('calculator-tab: BREZ surove amber (vsakih 8 vrstic harmoniziranih val 5 — 0 izjem)', () => {
    const najdene = vrstice('calculator-tab.tsx')
    expect(najdene, `surova amber še prisotna: ${najdene.join(' | ')}`).toEqual([])
    // žetoni val 5 živi (estrih kartica + sidra gumb + zamrzovalna opozorila)
    const vir = readFileSync(join(process.cwd(), 'src/components/roksal/calculator-tab.tsx'), 'utf8')
    expect(vir).toContain("'border-roksal-amber/40 bg-roksal-amber/10'")
    expect(vir).toContain('mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber')
  })

  it('post-signature-panel: BREZ surove amber (vsakih 7 vrstic harmoniziranih — 0 izjem)', () => {
    const najdene = vrstice('post-signature-panel.tsx')
    expect(najdene, `surova amber še prisotna: ${najdene.join(' | ')}`).toEqual([])
    const vir = readFileSync(join(process.cwd(), 'src/components/roksal/post-signature-panel.tsx'), 'utf8')
    expect(vir).toContain('"border-roksal-amber/40 bg-roksal-amber/10"')
    expect(vir).toContain('h-8 w-8 mx-auto text-roksal-amber mb-2')
  })

  it('photo-tab: NATANKO 2 izjemi — barvno kodirana kategorija faze (PRED blue / MED amber / PO green, R308/R312 precedens); ×5 harmoniziranih', () => {
    const IZJEME = [
      // KATEGORIJE MED — amber med blue (PRED) in green (PO): kategorija barv
      "{ id: 'MED', label: 'Med montažo', short: 'Med', cls: 'bg-amber-100 text-amber-800' },",
      // stats.med KPI števec — isti barvni trikotnik kot PRED/PO števca
      '<div className="text-base font-bold text-amber-700">{stats.med}</div>',
    ]
    const najdene = vrstice('photo-tab.tsx')
    expect(najdene.filter((v) => !IZJEME.some((d) => v === d)), `nove surove: ${najdene.join(' | ')}`).toEqual([])
    for (const d of IZJEME) {
      expect(najdene.some((v) => v === d), `izjema manjka: ${d.slice(0, 40)}`).toBe(true)
    }
    const vir = readFileSync(join(process.cwd(), 'src/components/roksal/photo-tab.tsx'), 'utf8')
    expect(vir).toContain('border-roksal-amber/40 bg-roksal-amber/10 p-3 text-xs text-roksal-ink')
    expect(vir).toContain('h-10 w-10 text-roksal-amber')
    expect(vir).toContain('hover:bg-roksal-amber/25')
  })

  it('vodja audit blok: značke 100 % roksal žetoni (R225/R226: NIČ numericnih barvnih klas v vodjinem pogledu)', () => {
    const src = vodja()
    expect(src).toContain("AI_OPCIJSKO: 'border-roksal-amber/40 bg-roksal-amber/10 text-roksal-ink'")
    expect(src).toContain("DETERMINISTICNO: 'border-roksal-green/40 bg-roksal-green/10 text-roksal-green'")
    expect(src).toContain("AI_ZAHTEVANO: 'border-roksal-red/40 bg-roksal-red/10 text-roksal-red'")
    // obrnjena regresija: numerične barvne klase v značkah NE smejo vrniti
    const znackaBlok = src.slice(src.indexOf('AVT_AUDIT_ZNACKA'), src.indexOf('interface VodjaStats'))
    expect(znackaBlok).not.toMatch(/(?:border|bg|text)-(?:blue|green|red|purple|amber|slate|gray|zinc|neutral|stone|yellow|orange|violet|indigo|emerald|teal|cyan|sky|rose|fuchsia|pink|lime)-\d{2,3}/)
  })
})

describe('r314 STRAŽAR — vodja audit blok (EN VIR, NIČ dvojnega sklepa)', () => {
  it('blok živi: testidi + aria + ClipboardList žeton ikona', () => {
    const src = vodja()
    expect(src).toContain('data-testid="avtomatizacija-dokaz"')
    expect(src).toContain('data-testid="avtomatizacija-vrstica"')
    expect(src).toContain('data-testid="avtomatizacija-sklep"')
    expect(src).toContain('aria-label="Avtomatizacija — audit po območjih"')
    expect(src).toContain('<ClipboardList className="h-3 w-3 text-roksal-amber" aria-hidden="true" />')
    expect(src).toContain('Avtomatizacija — audit po območjih')
  })

  it('EN VIR sklep verbatim — literalski dvojnik prepovedan (vzorec R311/R312)', () => {
    const src = vodja()
    expect(src).toContain('{avtAudit.sklep}')
    // NIČ literalskega dvojnika sklepa v komponenti (sklep živi SAMO v lib)
    expect(src).not.toContain('Audit območij: ')
    // števec v glavi prihajajo iz IZRAČUNANE strukture, ne iz trdo kodiranih literálov
    expect(src).toContain('{avtAudit.stObmocij} območij ·')
    expect(src).not.toContain('11 območij ·')
  })

  it('lib import: graditelj klican brez argumenta v komponenti (produkcija = EN VIR)', () => {
    const src = vodja()
    expect(src).toContain("import { avtomatizacijaPregled } from '@/lib/avtomatizacija-pregled'")
    expect(src).toContain('const avtAudit = avtomatizacijaPregled()')
  })
})
