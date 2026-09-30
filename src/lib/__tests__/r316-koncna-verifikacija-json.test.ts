// R316 — 46. člen (issue #1 IZVOZI družina): izvoz poročila končne
// verifikacije kot DETERMINISTIČNI JSON. EN VIR: koncnaVerifikacijaJson() je
// ČISTA projekcija koncnaVerifikacija() — zaslon + testi + docs + IZVOZ
// berejo ISTI niz (NIČ dvojnega sklepa). Brez metapodatkov časa/hash
// (100 % determinizem — isti HEAD = bajtno identična datoteka).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  koncnaVerifikacija,
  koncnaVerifikacijaJson,
  VERIFIKACIJSKE_PLASTI,
  type KoncnaVerifikacija,
} from '@/lib/koncna-verifikacija'

function beriPorocilo(raw: string) {
  return JSON.parse(raw) as {
    shema: string
    verzijaSheme: number
    sklep: string
    stObmocij: number
    stObmocijZDokazi: number
    stKriterijev: number
    stAiObveznih: number
    poPlasti: Record<string, number>
    obmocja: Array<{ obmocje: string; razred: string; razredPrikazno: string; plasti: string[]; stPlasti: number; opombaDokaza: string }>
    kriteriji: Array<{ kriterij: string; izpeljava: string; dokaz: string }>
  }
}

describe('r316 koncna-verifikacija JSON izvoz (46. člen — IZVOZI družina)', () => {
  const raw = koncnaVerifikacijaJson()
  const p = beriPorocilo(raw)
  const kv: KoncnaVerifikacija = koncnaVerifikacija()

  it('veljaven JSON z izrecno shemo + WYSIWYG števci (11 območij · 8 kriterijev · AI-OBVEZNO 0)', () => {
    expect(p.shema).toBe('roksal-koncna-verifikacija')
    expect(p.verzijaSheme).toBe(1)
    expect(p.stObmocij).toBe(11)
    expect(p.obmocja).toHaveLength(11)
    expect(p.stKriterijev).toBe(8)
    expect(p.kriteriji).toHaveLength(8)
    expect(p.stObmocijZDokazi).toBe(11)
    expect(p.stAiObveznih).toBe(0)
    // EN VIR: števci = izračunani iz ISTEGA graditelja (nič trdo kodiranih)
    expect(p.stObmocij).toBe(kv.stObmocij)
    expect(p.stKriterijev).toBe(kv.stKriterijev)
    expect(p.stAiObveznih).toBe(kv.stAiObveznih)
  })

  it('sklep WYSIWYG — ISTA resnica kot zaslon/testi (verbatim iz EN VIR)', () => {
    expect(p.sklep).toBe(kv.sklep)
    expect(p.sklep).toContain('11/11 območij z dokaznimi plastmi')
    expect(p.sklep).toContain('8 sprejemnih kriterijev')
    expect(p.sklep).toContain('AI-OBVEZNO: 0 — jedro deluje brez AI')
  })

  it('območja: vrstni red = audit (nič prerazporejanja) + plasti znane + opombe ne-prazne', () => {
    expect(p.obmocja.map((o) => o.obmocje)).toEqual(kv.vrstice.map((v) => v.obmocje))
    const znane = new Set<string>(VERIFIKACIJSKE_PLASTI)
    for (const o of p.obmocja) {
      expect(o.plasti.length).toBeGreaterThan(0)
      expect(o.stPlasti).toBe(o.plasti.length)
      for (const plast of o.plasti) expect(znane.has(plast), `neznana plast ${plast}`).toBe(true)
      expect(o.opombaDokaza.trim().length).toBeGreaterThan(0)
      expect(o.razredPrikazno.trim().length).toBeGreaterThan(0)
    }
    // poPlasti = natanko 5 znanih plasti, vsota ustreza vsoti stPlasti
    expect(Object.keys(p.poPlasti).sort()).toEqual([...VERIFIKACIJSKE_PLASTI].sort())
    const vsota = Object.values(p.poPlasti).reduce((a, b) => a + b, 0)
    expect(vsota).toBe(p.obmocja.reduce((a, o) => a + o.stPlasti, 0))
  })

  it('kriteriji verbatim: kriterij + izpeljava + dokaz (nič lepega prepisovanja)', () => {
    expect(p.kriteriji.map((k) => k.kriterij)).toEqual(kv.kriteriji.map((k) => k.kriterij))
    expect(p.kriteriji.map((k) => k.izpeljava)).toEqual(kv.kriteriji.map((k) => k.izpeljava))
    expect(p.kriteriji.map((k) => k.dokaz)).toEqual(kv.kriteriji.map((k) => k.dokaz))
  })

  it('DETERMINIZEM: dva klica = bajtno identična datoteka; brez volatilnih ključev (čas/hash/števec testov)', () => {
    expect(koncnaVerifikacijaJson()).toBe(raw)
    // ključi poročila v FIKSNEM vrstnem redu (determinizem serializacije)
    expect(Object.keys(p)).toEqual([
      'shema', 'verzijaSheme', 'sklep', 'stObmocij', 'stObmocijZDokazi',
      'stKriterijev', 'stAiObveznih', 'poPlasti', 'obmocja', 'kriteriji',
    ])
    const volatilno = /commit|datum|hash|timestamp|generated|uro|testov|datumCasa/i
    for (const kljuc of Object.keys(p)) {
      expect(volatilno.test(kljuc), `volatilen ključ: ${kljuc}`).toBe(false)
    }
    // 2-presledkov zamik + zaključna nova vrstica (POSIX)
    expect(raw.startsWith('{\n  "shema"')).toBe(true)
    expect(raw.endsWith('\n')).toBe(true)
  })

  it('fail-closed: pokvarjeni vhodi propagirajo TypeError graditelja (izvoz ne sme sanjati)', () => {
    expect(() => koncnaVerifikacijaJson([], {}, [])).toThrow(TypeError)
    expect(() => koncnaVerifikacijaJson([], {}, [])).toThrow(/koncnaVerifikacija:/)
    expect(() => koncnaVerifikacijaJson(undefined, undefined, [])).toThrow(TypeError)
  })

  it('vodja žičenje: gumb a11y družina (aria + title) + handler + fail-verbose toast (r162 pini)', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')
    // a11y izvozne družine (R291/R293 precedens: aria-label + title)
    expect(src).toContain('aria-label="Izvozi poročilo končne verifikacije kot JSON"')
    expect(src).toContain('title="Izvozi poročilo končne verifikacije (11 območij + 8 kriterijev + sklep) kot deterministični JSON"')
    // handler: EN VIR klic + blob download kanon + fail-verbose (ne tiho)
    expect(src).toContain('function exportKoncnaVerifikacijaJson()')
    expect(src).toContain('const json = koncnaVerifikacijaJson()')
    expect(src).toContain("a.download = 'koncna-verifikacija.json'")
    expect(src).toContain('URL.revokeObjectURL(url)')
    expect(src).toContain("title: 'Izvoz ni uspel'")
    // ikona na gumbu rabi žeton (r162: token na ikoni, ne numerika)
    expect(src).toContain('<Download className="h-3 w-3" aria-hidden="true" />')
  })
})
