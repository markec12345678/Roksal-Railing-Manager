// R311 — 41. člen issue #1 (Deliverable 5 NA ZASLONU): AI raba — iskrena
// resnica po površinah
// ─────────────────────────────────────────────────────────────────
// lib ai-raba-pregled.ts = ČISTA projekcija DVEH EN VIR resnic
// (automation/katalog 'ai' vnosi + avtomatizacija-audit AI_KANDIDATI) —
// testi dokazujejo: (a) projektna resnica (2 živi površini z RAZREŠENIM
// nadomestkom iz ISTEGA kataloga), (b) kandidati verbatim ×3 z iskrenim
// statusom, (c) sklep WYSIWYG (številčno nevtralen), (d) fail-closed ×4
// (brez-katalog / AI-brez-nadomestka / nadomestek-ne-obstaja / kandidat-
// brez-zakaj — TypeError z imenom graditelja), (e) determinizem (dva klica
// bajtno enaka), (f) STRAŽAR: UI vodja-dashboard žiči lib (NIČ dvojnega
// sklepa) + surova amber izjeme v 3 harmoniziranih datotekah so ŠTEVČNO
// ZAKLENJENE (6 izrecnih vrstic — vsaka nova = fail).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { aiRabaPregled } from '@/lib/ai-raba-pregled'
import { AUTOMATIZACIJSKI_KATALOG } from '@/lib/automation/katalog'
import { AI_KANDIDATI } from '@/lib/avtomatizacija-audit'

const vodja = () => readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')

describe('r311 ai-raba-pregled — projektna resnica (EN VIR projekcija)', () => {
  it('2 živi AI površini, obe z razrešenim nadomestkom iz ISTEGA kataloga', () => {
    const p = aiRabaPregled()
    expect(p.stAi).toBe(2)
    expect(p.stNadomestkov).toBe(2)
    expect(p.zive.map((z) => z.id).sort()).toEqual(['meritve.ai-ocena-foto', 'viz.ai-render'])
    const katalogPoId = new Map(AUTOMATIZACIJSKI_KATALOG.map((z) => [z.id, z] as const))
    for (const z of p.zive) {
      const vir = AUTOMATIZACIJSKI_KATALOG.find((x) => x.id === z.id)
      expect(vir, `${z.id}: vnos manjka`).toBeTruthy()
      expect(z.opis, `${z.id}: opis NI verbatim katalog`).toBe(vir!.opis)
      expect(z.modul, `${z.id}: modul NI verbatim katalog`).toBe(vir!.modul)
      const nad = katalogPoId.get(z.nadomestekId)
      expect(nad, `${z.id}: nadomestek ${z.nadomestekId} manjka v katalogu`).toBeTruthy()
      expect(nad!.vrsta, `${z.id}: nadomestek NI determinističen (${nad!.vrsta})`).toBe('deterministic')
      expect(z.nadomestekOpis).toBe(nad!.opis)
      expect(z.nadomestekModul).toBe(nad!.modul)
    }
  })

  it('kandidati verbatim ×3 — iskren status, vsak z utemeljitvijo', () => {
    const p = aiRabaPregled()
    expect(p.stKandidatov).toBe(3)
    expect(p.kandidati).toEqual(AI_KANDIDATI)
    expect(p.kandidatiStatus).toBe('NE-IMPLEMENTIRANO — kandidat (nič povezano)')
    for (const k of p.kandidati) {
      expect(k.status).toBe('NE-IMPLEMENTIRANO — kandidat (nič povezano)')
      expect(k.zakaj.length, `${k.funkcija}: zakaj prazno`).toBeGreaterThan(10)
    }
  })

  it('sklep WYSIWYG — številčno nevtralen, nosi tri resnice + ničla AI-obveznih', () => {
    const p = aiRabaPregled()
    expect(p.sklep).toContain(`AI površine: ${p.stAi}`)
    expect(p.sklep).toContain('vse neobvezne z izrecnim determinističnim nadomestkom')
    expect(p.sklep).toContain(`kandidati: ${p.stKandidatov} (ne-implementirani, nič povezano)`)
    expect(p.sklep).toContain('AI-obveznih: 0 — jedro deluje brez AI')
  })

  it('determinizem: dva klica = bajtno enak pregled', () => {
    expect(JSON.stringify(aiRabaPregled())).toBe(JSON.stringify(aiRabaPregled()))
  })
})

describe('r311 ai-raba-pregled — fail-closed (TypeError z imenom graditelja)', () => {
  it('ne-seznam katalog → TypeError', () => {
    expect(() => aiRabaPregled(null as unknown as typeof AUTOMATIZACIJSKI_KATALOG)).toThrow(TypeError)
    expect(() => aiRabaPregled(null as unknown as typeof AUTOMATIZACIJSKI_KATALOG)).toThrow(/aiRabaPregled/)
  })

  it('AI vnos brez nadomestka → TypeError (kontrakt §11)', () => {
    const pokvaren = [
      ...AUTOMATIZACIJSKI_KATALOG,
      { id: 'test.ai-brez', vrsta: 'ai' as const, obmocje: 'Meritve' as const, opis: 'pokvaren', modul: 'src/lib/test.ts' },
    ]
    expect(() => aiRabaPregled(pokvaren)).toThrow(TypeError)
    expect(() => aiRabaPregled(pokvaren)).toThrow(/brez izrecnega nadomestka/)
  })

  it('nadomestek, ki ne obstaja v katalogu → TypeError', () => {
    const pokvaren = [
      ...AUTOMATIZACIJSKI_KATALOG,
      { id: 'test.ai-slab', vrsta: 'ai' as const, obmocje: 'Meritve' as const, opis: 'pokvaren', modul: 'src/lib/test.ts', nadomestek: 'ne-obstaja.id' },
    ]
    expect(() => aiRabaPregled(pokvaren)).toThrow(TypeError)
    expect(() => aiRabaPregled(pokvaren)).toThrow(/ne obstaja v katalogu/)
  })

  it('kandidat brez zakaj → TypeError (iskrena utemeljitev obvezna)', () => {
    const pokvarenKandidati = [
      ...AI_KANDIDATI,
      { funkcija: 'pokvaren kandidat', zakaj: '   ', status: 'NE-IMPLEMENTIRANO — kandidat (nič povezano)' as const },
    ]
    expect(() => aiRabaPregled(AUTOMATIZACIJSKI_KATALOG, pokvarenKandidati)).toThrow(TypeError)
    expect(() => aiRabaPregled(AUTOMATIZACIJSKI_KATALOG, pokvarenKandidati)).toThrow(/brez 'zakaj'/)
  })
})

describe('r311 STRAŽAR — zaslon žiči EN VIR, izjeme zaklenjene', () => {
  it('vodja-dashboard uvaža lib + nosi testidi, NIČ dvojnega sklepa', () => {
    const src = vodja()
    expect(src).toContain("import { aiRabaPregled } from '@/lib/ai-raba-pregled'")
    expect(src).toContain('aiRabaPregled()')
    expect(src).toContain('data-testid="ai-raba-dokaz"')
    expect(src).toContain('data-testid="ai-raba-sklep"')
    // EN VIR: ročno prepisan sklep v JSX bi bil dvojnica — lib niz gre verbatim.
    expect(src).not.toContain('jedro deluje brez AI</p>') // literalski dvojnik sklepa
    expect(src).toContain('{aiRaba.sklep}')
  })

  it('surova amber v harmoniziranih datotekah = NATANKO 6 izrecnih izjem (kategorije/lestvice — R308 lekcija)', () => {
    // R319 (dekomp. faza 1): measurements-tab izjeme so se RAZDELILE na
    // measurements/ mapo (shared.ts + inline-inclinometer + inline-kotomer)
    // — pin SHIFT po kanonu R180/R201/…/R314. Skupno število izjemnih
    // VRSTIC ostaja NATANKO 6 (les, WPC, priporociloColor, senzor ×2, V_TEKU);
    // nova mapa je s tem IZRECNO varovana (nič nevidnega amber).
    const IZJEME: Record<string, string[]> = {
      'measurements-tab.tsx': [
        // kategorija barv (les med beton/plosca/gramoz/metal) — R308 lekcija
        "  les: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',",
        // gola text lestvica naklona (red/orange/amber sorodniki) — brez vsebnika
        "    priporociloColor = 'text-amber-600 dark:text-amber-400'",
      ],
      'measurements/shared.ts': [
        // kategorija barv (WPC med ALU/INOX/DRUGO) — R308 lekcija (R319: preseljeno iz measurements-tab)
        "  WPC: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',",
      ],
      'measurements/inline-inclinometer.tsx': [
        // gola text lestvica senzorjev (denied=red sorodnik) — brez vsebnika (R319: preseljeno)
        '          <p className="text-center text-[11px] text-amber-600 dark:text-amber-400">',
      ],
      'measurements/inline-kotomer.tsx': [
        // gola text lestvica senzorjev (denied=red sorodnik) — brez vsebnika (R319: preseljeno)
        '          <p className="text-center text-[11px] text-amber-600 dark:text-amber-400">',
      ],
      'deal-pipeline.tsx': [
        // kategorija statusov (V_TEKU med orange/violet/teal/emerald) — R308 lekcija
        "  { id: 'V_TEKU', label: 'V teku', icon: Hammer, dot: 'bg-amber-500', bar: 'border-l-amber-500', head: 'from-amber-100 dark:from-amber-500/15', over: 'ring-amber-400/70 dark:ring-amber-500/70' }, // R311 — kategorija barvni sistem (amber med orange/violet/blue sorodniki) IZRECNO izven harmonizacije (R308 lekcija)",
      ],
      'material-intelligence-tab.tsx': [],
    }
    const SUROVA_AMBER = /amber-(50|100|200|300|400|500|600|700|800|900|950)\b/
    const najdene: string[] = []
    for (const [dat, dovoljene] of Object.entries(IZJEME)) {
      const vir = readFileSync(join(process.cwd(), 'src/components/roksal', dat), 'utf8')
      const vrstice = vir
        .split('\n')
        .filter((v) => SUROVA_AMBER.test(v) && !v.includes('roksal-amber'))
        .map((v) => v.trim())
      najdene.push(...vrstice.filter((v) => !dovoljene.some((d) => v === d.trim())))
      // vsaka dovoljena izjema SE RES NAHAJA (izjema brez vrstice = zastarel test)
      for (const d of dovoljene) {
        expect(vrstice.some((v) => v === d.trim()), `${dat}: izjema manjka v viru: ${d.slice(0, 60)}`).toBe(true)
      }
    }
    expect(najdene, `nove surove amber vrstice (izven zaklenjenih izjem): ${najdene.join(' | ')}`).toEqual([])
  })
})
