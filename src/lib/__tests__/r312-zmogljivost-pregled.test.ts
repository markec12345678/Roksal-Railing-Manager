// R312 — 42. člen issue #1 (Deliverable 6): MERITVE ZMOGLJIVOSTI — iskrene
// meritve pomembnih determinističnih operacij jedra.
// ─────────────────────────────────────────────────────────────────
// Dokazi: (a) registracija ×8 (enolični id, iskren opis, modul OBSTAJA na
// disku — kanon kataloga R294, iteracij ≥ 3), (b) determinizem skozi
// vbrizgano uro (DI) — bajtno enak pregled + natanko 1 ms na operacijo,
// (c) sanitarne resnice z realno uro (najmanj ≤ mediana ≤ najvec, ≥ 0,
// ISTEJEN vrstni red kot operacije), (d) fail-closed ×5 (ne-polje / op brez
// kontrakta / < 3 iteracij / ura tekla nazaj / izhod NE preveri —
// merjenje pokvare funkcije bi bilo lažna resnica), (e) STRAŽAR zaslon:
// vodja-dashboard žiči lib (EN VIR sklep — NIČ dvojnega sklepa), meritev
// ŠELE v brskalniku (useState null + useEffect — nič SSR laži), (f) STRAŽAR
// modulov: vsak 'modul' res obstaja v repozitoriju.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { izmeriZmogljivost, ZMOGLJIVOST_OPS } from '@/lib/zmogljivost-pregled'

const vodja = () => readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')

describe('r312 zmogljivost-pregled — registracija operacij (EN VIR)', () => {
  it('×8 operacij, enolični id-ji, iskreni opisi, iteracij ≥ 3', () => {
    expect(ZMOGLJIVOST_OPS.length).toBe(8)
    const idji = ZMOGLJIVOST_OPS.map((o) => o.id)
    expect(new Set(idji).size).toBe(8)
    expect(idji).toEqual([
      'calculator.razmik',
      'calculator.vetrna',
      'konflikti.pregled',
      'konflikti.dokaz',
      'konflikti.csv',
      'termini.urAgregat',
      'termini.csv',
      'ai-raba.pregled',
    ])
    for (const op of ZMOGLJIVOST_OPS) {
      expect(op.opis.length, `${op.id}: opis prekratko (iskrenost)`).toBeGreaterThan(10)
      expect(op.modul.startsWith('src/lib/'), `${op.id}: modul ni lib pot`).toBe(true)
      expect(op.iteracij, `${op.id}: ≥ 3 iteracij`).toBeGreaterThanOrEqual(3)
      expect(typeof op.izvedi).toBe('function')
      expect(typeof op.preveri).toBe('function')
    }
  })

  it('STRAŽAR modulov: vsak modul res obstaja v repozitoriju (kanon kataloga R294)', () => {
    for (const op of ZMOGLJIVOST_OPS) {
      expect(() => readFileSync(join(process.cwd(), op.modul), 'utf8'), `${op.id}: modul manjka`).not.toThrow()
    }
  })
})

describe('r312 zmogljivost-pregled — determinizem skozi vbrizgano uro (DI)', () => {
  it('fiksna ura (+1 na klic) → natanko 1 ms na operacijo; dva klica bajtno enaka', () => {
    const ura = (() => {
      let t = 0
      return () => (t += 1)
    })()
    const a = izmeriZmogljivost(ZMOGLJIVOST_OPS, ura)
    const b = izmeriZmogljivost(ZMOGLJIVOST_OPS, (() => {
      let t = 0
      return () => (t += 1)
    })())
    for (const m of a.meritve) {
      expect(m.najmanj).toBe(1)
      expect(m.mediana).toBe(1)
      expect(m.najvec).toBe(1)
      expect(m.preverjeno).toBe(true)
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.skupajIteracij).toBe(ZMOGLJIVOST_OPS.reduce((s, o) => s + o.iteracij, 0))
  })

  it('sklep WYSIWYG — nosi števec operacij/iteracij + iskrenost strojne odvisnosti', () => {
    const p = izmeriZmogljivost(ZMOGLJIVOST_OPS, (() => {
      let t = 0
      return () => (t += 1)
    })())
    expect(p.sklep).toContain(`Merjeno na tej napravi: ${p.meritve.length} operacij`)
    expect(p.sklep).toContain(`${p.skupajIteracij} iteracij`)
    expect(p.sklep).toContain('vsi izhodi preverjeni')
    expect(p.sklep).toContain('strojno odvisna')
    expect(p.sklep).toContain('struktura in izhodi deterministični')
  })
})

describe('r312 zmogljivost-pregled — sanitarne resnice z realno uro', () => {
  it('najmanj ≤ mediana ≤ najvec, vse ≥ 0 in končne, vrstni red = operacije', () => {
    const p = izmeriZmogljivost()
    expect(p.meritve.map((m) => m.id)).toEqual(ZMOGLJIVOST_OPS.map((o) => o.id))
    for (const m of p.meritve) {
      expect(m.najmanj).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(m.najmanj), `${m.id}: najmanj končen`).toBe(true)
      expect(Number.isFinite(m.mediana), `${m.id}: mediana končna`).toBe(true)
      expect(Number.isFinite(m.najvec), `${m.id}: najvec končen`).toBe(true)
      expect(m.najmanj).toBeLessThanOrEqual(m.mediana)
      expect(m.mediana).toBeLessThanOrEqual(m.najvec)
      expect(m.enota).toBe('ms')
      expect(m.preverjeno).toBe(true)
    }
  })
})

describe('r312 zmogljivost-pregled — fail-closed (TypeError z imenom graditelja)', () => {
  it('ne-polje operacij → TypeError', () => {
    expect(() => izmeriZmogljivost('ne-polje' as unknown as typeof ZMOGLJIVOST_OPS)).toThrow(TypeError)
    expect(() => izmeriZmogljivost('ne-polje' as unknown as typeof ZMOGLJIVOST_OPS)).toThrow(/izmeriZmogljivost/)
  })

  it('operacija brez kontrakta (preveri manjka) → TypeError', () => {
    const pokvarene = [
      {
        id: 'test.brez-preveri',
        opis: 'pokvarjena operacija brez preverbe izhoda',
        modul: 'src/lib/test.ts',
        iteracij: 5,
        izvedi: () => 1,
      },
    ]
    expect(() => izmeriZmogljivost(pokvarene as unknown as typeof ZMOGLJIVOST_OPS)).toThrow(TypeError)
    expect(() => izmeriZmogljivost(pokvarene as unknown as typeof ZMOGLJIVOST_OPS)).toThrow(/brez kontrakta/)
  })

  it('iteracij < 3 → TypeError (mediana brez njih ni resnica)', () => {
    const pokvarene = [
      {
        id: 'test.malo-iteracij',
        opis: 'pokvarjena operacija z 2 iteracijama',
        modul: 'src/lib/test.ts',
        iteracij: 2,
        izvedi: () => 1,
        preveri: () => true,
      },
    ]
    expect(() => izmeriZmogljivost(pokvarene as unknown as typeof ZMOGLJIVOST_OPS)).toThrow(TypeError)
    expect(() => izmeriZmogljivost(pokvarene as unknown as typeof ZMOGLJIVOST_OPS)).toThrow(/≥ 3 iteracij/)
  })

  it('ura, ki teče nazaj → TypeError (negativen delta = pokvarjena ura, ne meritev)', () => {
    const nazaj = (() => {
      let t = 100
      return () => (t -= 1)
    })()
    expect(() => izmeriZmogljivost(ZMOGLJIVOST_OPS, nazaj)).toThrow(TypeError)
    expect(() => izmeriZmogljivost(ZMOGLJIVOST_OPS, nazaj)).toThrow(/tekla nazaj/)
  })

  it('izhod, ki NE preveri → TypeError (merjenje pokvare funkcije bi bilo lažna resnica)', () => {
    const pokvarene = [
      {
        id: 'test.pokvaren-izhod',
        opis: 'operacija z izhodom, ki ne gre skozi preverbo',
        modul: 'src/lib/test.ts',
        iteracij: 5,
        izvedi: () => null,
        preveri: () => false,
      },
    ]
    expect(() => izmeriZmogljivost(pokvarene as unknown as typeof ZMOGLJIVOST_OPS)).toThrow(TypeError)
    expect(() => izmeriZmogljivost(pokvarene as unknown as typeof ZMOGLJIVOST_OPS)).toThrow(/lažna resnica/)
  })
})

describe('r312 STRAŽAR — zaslon žiči lib, meritev šele v brskalniku', () => {
  it('vodja-dashboard: uvoz + testidi + EN VIR sklep (NIČ dvojnega sklepa)', () => {
    const src = vodja()
    expect(src).toContain("import { izmeriZmogljivost } from '@/lib/zmogljivost-pregled'")
    expect(src).toContain('data-testid="zmogljivost-dokaz"')
    expect(src).toContain('data-testid="zmogljivost-vrstica"')
    expect(src).toContain('data-testid="zmogljivost-sklep"')
    // EN VIR: ročno prepisan sklep v JSX bi bil dvojica — lib niz gre verbatim.
    expect(src).not.toContain('preverjeni — časi so resnična meritev')
    expect(src).toContain('{zmogljivost.sklep}')
  })

  it('meritev ŠELE v brskalniku — useState(null) + useEffect, NIČ render-klica (nič SSR laži)', () => {
    const src = vodja()
    expect(src).toContain('useState<ZmogljivostPregled | null>(null)')
    expect(src).toMatch(/useEffect\(\(\) => \{\s*try \{\s*setZmogljivost\(izmeriZmogljivost\(\)\)/)
    // render-klic bi pri SSR vstavil strojno odvisne čase v HTML = hydration laž
    expect(src).not.toMatch(/const\s+\w+\s*=\s*izmeriZmogljivost\(\)/)
  })

  it('iskren prazni stan: brez meritve ni izmišljenih števil', () => {
    const src = vodja()
    expect(src).toContain('merjenje teče …')
    expect(src).toContain('brez izvedene meritve ni izmišljenih števil')
  })
})

describe('r312 STRAŽAR — MANDATORY STIL val 3 (dashboard-tab + logistics-tab + webxr-scanner)', () => {
  // R308/R311 lekcija: STRAŽAR regex rabi realno predpono — /amber-(50|…|950)\b/
  // (prejšnji /(^|[^-a-z])amber-/ NI videl bg-amber-).
  const SUROVA_AMBER = /amber-(50|100|200|300|400|500|600|700|800|900|950)\b/

  it('dashboard-tab + webxr-scanner: BREZ surove amber (vsakih 24 mest harmoniziranih val 3)', () => {
    for (const dat of ['dashboard-tab.tsx', 'webxr-scanner.tsx']) {
      const vir = readFileSync(join(process.cwd(), 'src/components/roksal', dat), 'utf8')
      const vrstice = vir
        .split('\n')
        .filter((v) => SUROVA_AMBER.test(v) && !v.includes('roksal-amber'))
        .map((v) => v.trim())
      expect(vrstice, `${dat}: surova amber še prisotna: ${vrstice.join(' | ')}`).toEqual([])
    }
  })

  it('logistics-tab: NATANKO 2 izrecni izjemi (kategoriji barv med sorodniki — R308 lekcija + R234 komentar)', () => {
    const IZJEME = [
      // STATUS_COLORS.V_TEKU — amber med blue/green/red/purple (kategorija statusov)
      "V_TEKU: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',",
      // EQUIPMENT_STATUS_COLORS.V_SERVISU — amber med green/blue/red (R234 je
      // UPOKOJENO harmoniziral in IZRECNO pustil V_SERVISU semantično)
      "V_SERVISU: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',",
    ]
    const vir = readFileSync(join(process.cwd(), 'src/components/roksal/logistics-tab.tsx'), 'utf8')
    const vrstice = vir
      .split('\n')
      .filter((v) => SUROVA_AMBER.test(v) && !v.includes('roksal-amber'))
      .map((v) => v.trim())
    expect(vrstice.filter((v) => !IZJEME.some((d) => v === d)), `nove surove vrstice: ${vrstice.join(' | ')}`).toEqual([])
    for (const d of IZJEME) {
      expect(vrstice.some((v) => v === d), `izjema manjka v viru: ${d.slice(0, 40)}`).toBe(true)
    }
  })

  it('žetoni val 3 živi v viru (baner + kalibracijska pilona + Badge žeton besedilo)', () => {
    const dash = readFileSync(join(process.cwd(), 'src/components/roksal/dashboard-tab.tsx'), 'utf8')
    expect(dash).toContain('border border-roksal-amber/40 bg-roksal-amber/10 px-2.5 py-2')
    expect(dash).toContain('bg-roksal-amber/15 text-roksal-amber hover:bg-roksal-amber/25')
    const logistika = readFileSync(join(process.cwd(), 'src/components/roksal/logistics-tab.tsx'), 'utf8')
    expect(logistika).toContain('border-roksal-amber/40 bg-roksal-amber/10 px-1.5 py-0.5 text-roksal-ink')
    const webxr = readFileSync(join(process.cwd(), 'src/components/roksal/webxr-scanner.tsx'), 'utf8')
    expect(webxr).toContain('border-roksal-amber/40 bg-roksal-amber/10 text-roksal-amber')
  })
})
