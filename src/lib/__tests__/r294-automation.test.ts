// R294 — ISSUE #1 («Professional automation») — testi razvojnega sklopa:
// katalog integriteta (EN VIR audit tabele), fail-closed registar ponudnikov,
// AI-neobveznost (jedro deluje brez AI), determinizem + strazar EN VIR na
// vodja-dashboard kartici.
import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import {
  AUTOMATIZACIJSKI_KATALOG,
  OBMOCJA,
  avtomatizacijaPovzetek,
  type AutomatizacijskaVrsta,
} from '../automation/katalog'
import {
  AI_PONUDNIK_ENV,
  AiPonudnik,
  DeterministicniPonudnik,
  jeZmoznostNaVoljo,
  ponastaviZaTeste,
  ponudnikZaZmoznost,
  privzetaNastavitev,
  registrirajPonudnika,
  registriraniPonudniki,
} from '../automation/ponudniki'

const VELJAVNE_VRSTE: readonly AutomatizacijskaVrsta[] = ['deterministic', 'sdk', 'script', 'ai']

describe('R294 — avtomatizacijski katalog (EN VIR audit tabele, issue #1 predmet 4)', () => {
  it('id-ji so unikatni', () => {
    const ids = AUTOMATIZACIJSKI_KATALOG.map((z) => z.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('id-ji so ASCII (kanon — brez diakritike, brez presledkov)', () => {
    for (const z of AUTOMATIZACIJSKI_KATALOG) {
      expect(z.id).toMatch(/^[a-z0-9.\-]+$/)
    }
  })

  it('vsaka vrsta je veljavna (deterministic / sdk / script / ai)', () => {
    for (const z of AUTOMATIZACIJSKI_KATALOG) {
      expect(VELJAVNE_VRSTE).toContain(z.vrsta)
    }
  })

  it('vsak modul OBSTAJA v repozitoriju (audit proti realni kodi, ne izmišljen)', () => {
    for (const z of AUTOMATIZACIJSKI_KATALOG) {
      expect(existsSync(resolve(process.cwd(), z.modul)), `manjka modul za ${z.id}: ${z.modul}`).toBe(true)
    }
  })

  it('pokritost vseh 10 območij poslovanja (issue #1 §1–§10)', () => {
    const prisotna = new Set(AUTOMATIZACIJSKI_KATALOG.map((z) => z.obmocje))
    for (const o of OBMOCJA) expect(prisotna.has(o), `območje brez zmožnosti: ${o}`).toBe(true)
    expect(prisotna.size).toBe(OBMOCJA.length)
  })

  it('KONTRAKT AI: vsaka AI zmožnost IZRECNO deklarira deterministični nadomestek, ki obstaja v katalogu in NI ai (issue #1 §11 — aplikacija deluje brez AI)', () => {
    const ids = new Set(AUTOMATIZACIJSKI_KATALOG.map((z) => z.id))
    for (const z of AUTOMATIZACIJSKI_KATALOG) {
      if (z.vrsta !== 'ai') {
        expect(z.nadomestek, `ne-ai zmožnost ${z.id} ne sme deklarirati nadomestka`).toBeUndefined()
        continue
      }
      expect(typeof z.nadomestek === 'string' && z.nadomestek.length > 0, `ai zmožnost ${z.id} brez nadomestka`).toBe(true)
      const n = AUTOMATIZACIJSKI_KATALOG.find((x) => x.id === z.nadomestek)
      expect(n, `nadomestek ${z.nadomestek} ne obstaja v katalogu`).toBeDefined()
      expect(n!.vrsta, `nadomestek za ${z.id} ni determinističen`).not.toBe('ai')
    }
    expect(ids.size).toBeGreaterThan(0)
  })

  it('determinizem: katalog je zamrznjen in bajtno stabilen čez klice', () => {
    expect(Object.isFrozen(AUTOMATIZACIJSKI_KATALOG)).toBe(true)
    expect(JSON.stringify(AUTOMATIZACIJSKI_KATALOG)).toBe(JSON.stringify(AUTOMATIZACIJSKI_KATALOG))
  })

  it('povzetek = EN VIR izpeljava (nikoli ročno vpisane številke)', () => {
    const p = avtomatizacijaPovzetek()
    expect(p.skupaj).toBe(AUTOMATIZACIJSKI_KATALOG.length)
    expect(p.deterministicnih + p.sdk + p.skriptov + p.ai).toBe(p.skupaj)
    expect(p.ai).toBeGreaterThan(0)
    expect(p.aiZNadomestkom).toBe(p.ai)
    expect(p.stObmocij).toBe(OBMOCJA.length)
  })

  it('povzetek sprejme poljuben podkatalog (čista funkcija — determinizem)', () => {
    const pod = AUTOMATIZACIJSKI_KATALOG.slice(0, 3)
    const p1 = avtomatizacijaPovzetek(pod)
    const p2 = avtomatizacijaPovzetek(pod)
    expect(JSON.stringify(p1)).toBe(JSON.stringify(p2))
    expect(p1.skupaj).toBe(3)
  })
})

describe('R294 — registar ponudnikov (issue #1 predmet 11 — AI fallback arhitektura)', () => {
  beforeEach(() => {
    ponastaviZaTeste()
  })

  it('deterministični ponudnik = vedno na voljo in servisira VSE ne-ai zmožnosti', () => {
    const d = new DeterministicniPonudnik()
    expect(d.naVoljo).toBe(true)
    const neAi = AUTOMATIZACIJSKI_KATALOG.filter((z) => z.vrsta !== 'ai').map((z) => z.id)
    expect(d.zmoznosti()).toEqual(neAi)
  })

  it('privzeta nastavitev: AI zmožnost NI dosegljiva (jedro deluje brez AI)', () => {
    privzetaNastavitev()
    for (const z of AUTOMATIZACIJSKI_KATALOG.filter((x) => x.vrsta === 'ai')) {
      expect(jeZmoznostNaVoljo(z.id), `ai zmožnost ${z.id} brez env preklopa MORA biti nedosegljiva`).toBe(false)
    }
    // deterministične pa VSE dosegljive
    for (const z of AUTOMATIZACIJSKI_KATALOG.filter((x) => x.vrsta !== 'ai')) {
      expect(jeZmoznostNaVoljo(z.id)).toBe(true)
    }
  })

  it('fail-closed: neznana zmožnost → null + false (nikoli izmišljen odgovor)', () => {
    privzetaNastavitev()
    expect(ponudnikZaZmoznost('neobstojeca.zmoznost')).toBeNull()
    expect(jeZmoznostNaVoljo('neobstojeca.zmoznost')).toBe(false)
  })

  it('env preklop omogoči AI ponudnika (neobvezna pomoč na zahtevo)', () => {
    const prej = process.env[AI_PONUDNIK_ENV]
    process.env[AI_PONUDNIK_ENV] = '1'
    try {
      const stanje = privzetaNastavitev()
      expect(stanje.aiNaVoljo).toBe(true)
      expect(jeZmoznostNaVoljo('viz.ai-render')).toBe(true)
      expect(jeZmoznostNaVoljo('meritve.ai-ocena-foto')).toBe(true)
    } finally {
      if (prej === undefined) delete process.env[AI_PONUDNIK_ENV]
      else process.env[AI_PONUDNIK_ENV] = prej
    }
  })

  it('AiPonudnik brez preklopa je vedno na voljo=false — tudi registriran ne reši zmožnosti', () => {
    registrirajPonudnika(new DeterministicniPonudnik())
    registrirajPonudnika(new AiPonudnik(false))
    expect(ponudnikZaZmoznost('viz.ai-render')).toBeNull()
    expect(registriraniPonudniki().length).toBe(2)
  })

  it('podvojena registracija = napaka (fail-closed determinizem)', () => {
    registrirajPonudnika(new DeterministicniPonudnik())
    expect(() => registrirajPonudnika(new DeterministicniPonudnik())).toThrow(/podvojena registracija/)
  })

  it('privzetaNastavitev je idempotentna (isti rezultat čez klice)', () => {
    const a = privzetaNastavitev()
    const b = privzetaNastavitev()
    expect(a.ponudniki).toBe(b.ponudniki)
    expect(a.aiNaVoljo).toBe(b.aiNaVoljo)
    expect(registriraniPonudniki().map((p) => p.id)).toEqual(['deterministicni'])
  })

  it('vrstni red registracije je fiksna resnica (Map ohranja vstavljanje)', () => {
    registrirajPonudnika(new AiPonudnik(false))
    registrirajPonudnika(new DeterministicniPonudnik())
    expect(registriraniPonudniki().map((p) => p.id)).toEqual(['ai', 'deterministicni'])
  })

  it('zmoznostiPoVrsti = čista izpeljava (ai nabor = 2 znani zmožnosti)', () => {
    // prek javnega vmesnika ponudnika — AiPonudnik zmoznosti()
    const ai = new AiPonudnik(false).zmoznosti()
    expect(ai).toContain('viz.ai-render')
    expect(ai).toContain('meritve.ai-ocena-foto')
    expect(ai.length).toBe(2)
  })
})

describe('R294 — strazar: vodja-dashboard kartica (EN VIR + MANDATORY STIL)', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf-8')

  it('EN VIR: kartica uvaža avtomatizacijaPovzetek iz kataloga (NI ročnih številk)', () => {
    expect(src).toContain("from '@/lib/automation/katalog'")
    expect(src).toContain('avtomatizacijaPovzetek()')
  })

  it('kartica aria regija + glava literal (dostopnost)', () => {
    expect(src).toContain('aria-label="Avtomatizacija — razred funkcij"')
    expect(src).toContain('Avtomatizacija — razred funkcij')
  })

  it('iskrena AI resnica na zaslonu (kontrakt §11 v JSX literalu)', () => {
    expect(src).toContain('jedro deluje brez AI.')
    expect(src).toContain('zmožnosti z izrečenim determinističnim nadomestkom')
    expect(src).toContain('AI (neobvezne)')
  })

  it('pogojni skripti tile (iskrena 0 = ni tile — kanon r277)', () => {
    expect(src).toMatch(/\{avtomatizacija\.skriptov > 0 && \(/)
  })

  it('0 novih hex v vstavljeni sekciji (samo žetoni — baseline pregled r226)', () => {
    const zacetek = src.indexOf('{/* R294 — AVTOMATIZACIJA')
    const konec = src.indexOf('{/* Današnji pregled */}', zacetek)
    expect(zacetek).toBeGreaterThan(-1)
    expect(konec).toBeGreaterThan(zacetek)
    const sekcija = src.slice(zacetek, konec)
    expect(sekcija).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(sekcija).toContain('border-border')
    expect(sekcija).toContain('bg-muted/40')
  })
})
