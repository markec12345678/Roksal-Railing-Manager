// R315 — 45. člen issue #1 (Deliverable 7 NA ZASLONU + DOKUMENTIRANO):
// končna verifikacija proti HEAD.
// ─────────────────────────────────────────────────────────────────
// lib koncna-verifikacija.ts = ČISTA projekcija EN VIR resnic
// (AVTOMATIZACIJA_AUDIT + DOKAZI_AUDITA + SPREJEMNI_KRITERIJI) — testi
// dokazujejo: (a) totalen fail-closed join (11/11 območij z vezavo),
// (b) kriteriji ×8 z izpeljavo + dokazom, (c) sklep WYSIWYG (številčno
// nevtralen, izračunan), (d) fail-closed ×8 (ne-polje / prazen audit /
// ne-dokazi / prazni kriteriji / podvojeno območje / brez vezave / neznana
// plast / brez izpeljave-dokaza → TypeError z imenom graditelja),
// (e) determinizem (dva klica bajtno enaka), (f) STRAŽAR: vodja blok žiči
// lib (NIČ dvojnega sklepa) + docs dokument obstaja in nosi EN VIR sklepe,
// (g) diska resnica: vsi dokazi kriterijev (poti) obstajajo na disku.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  koncnaVerifikacija,
  DOKAZI_AUDITA,
  SPREJEMNI_KRITERIJI,
  VERIFIKACIJSKE_PLASTI,
} from '@/lib/koncna-verifikacija'
import { AVTOMATIZACIJA_AUDIT } from '@/lib/avtomatizacija-audit'

/** Rekurzivni sprehod po drevesu (relativne poti) — za glob dokaze 'r*-…'. */
function beriDrevo(rel: string): string[] {
  const koren = join(process.cwd(), rel)
  const izhod: string[] = []
  const sprehod = (abs: string) => {
    for (const e of readdirSync(abs)) {
      const pot = join(abs, e)
      if (statSync(pot).isDirectory()) sprehod(pot)
      else izhod.push(pot.slice(process.cwd().length + 1))
    }
  }
  sprehod(koren)
  return izhod
}

describe('r315 koncna-verifikacija — totalen join + kriteriji (EN VIR projekcija)', () => {
  it('11/11 območij z dokazno vezavo, ISTI vrstni red kot audit, vsaj 1 plast vsako', () => {
    const p = koncnaVerifikacija()
    expect(p.stObmocij).toBe(AVTOMATIZACIJA_AUDIT.length)
    expect(p.stObmocijZDokazi).toBe(p.stObmocij)
    expect(p.vrstice.map((v) => v.obmocje)).toEqual(AVTOMATIZACIJA_AUDIT.map((v) => v.obmocje))
    for (const v of p.vrstice) {
      expect(v.stPlasti, `${v.obmocje}: vsaj 1 plast`).toBeGreaterThan(0)
      expect(v.plasti.length).toBe(v.stPlasti)
      expect(v.opombaDokaza.length, `${v.obmocje}: iskrena opomba`).toBeGreaterThan(10)
      for (const plast of v.plasti) {
        expect(VERIFIKACIJSKE_PLASTI, `${v.obmocje}: znana plast ${plast}`).toContain(plast)
      }
    }
  })

  it('8 sprejemnih kriterijev, vsak z mehanično izpeljavo + konkretnim dokazom', () => {
    const p = koncnaVerifikacija()
    expect(p.stKriterijev).toBe(8)
    expect(p.kriteriji).toEqual(SPREJEMNI_KRITERIJI)
    for (const k of p.kriteriji) {
      expect(k.izpeljava.length, `${k.kriterij}: izpeljava`).toBeGreaterThan(20)
      expect(k.dokaz.length, `${k.kriterij}: dokaz`).toBeGreaterThan(10)
    }
  })

  it('sklep WYSIWYG — izračunani števci + iskren ničelni AI-OBVEZNO sklep', () => {
    const p = koncnaVerifikacija()
    expect(p.sklep).toContain(`Končna verifikacija: ${p.stObmocijZDokazi}/${p.stObmocij} območij z dokaznimi plastmi`)
    expect(p.sklep).toContain(`${p.stKriterijev} sprejemnih kriterijev`)
    const plastiVDokazih = VERIFIKACIJSKE_PLASTI.filter((pl) => p.poPlasti[pl] > 0)
    expect(p.sklep).toContain(`plasti v dokazih: ${plastiVDokazih.join(', ')}`)
    expect(p.sklep).toContain(`AI-OBVEZNO: ${p.stAiObveznih}`)
    // ničelna veja izračunana (nič trdo) — R314 iskrenost
    if (p.stAiObveznih === 0) expect(p.sklep).toContain('— jedro deluje brez AI')
    expect(p.poPlasti['vitest']).toBeGreaterThan(0)
  })

  it('determinizem: dva klica = bajtno enak pregled', () => {
    expect(JSON.stringify(koncnaVerifikacija())).toBe(JSON.stringify(koncnaVerifikacija()))
  })
})

describe('r315 koncna-verifikacija — fail-closed (TypeError z imenom graditelja)', () => {
  it('ne-polje audit / ne-objekt dokazi / ne-polje kriteriji → TypeError', () => {
    expect(() => koncnaVerifikacija(null as unknown as typeof AVTOMATIZACIJA_AUDIT)).toThrow(TypeError)
    expect(() => koncnaVerifikacija(null as unknown as typeof AVTOMATIZACIJA_AUDIT)).toThrow(/koncnaVerifikacija/)
    expect(() => koncnaVerifikacija(AVTOMATIZACIJA_AUDIT, null as unknown as typeof DOKAZI_AUDITA)).toThrow(TypeError)
    expect(() => koncnaVerifikacija(AVTOMATIZACIJA_AUDIT, undefined, null as unknown as typeof SPREJEMNI_KRITERIJI)).toThrow(TypeError)
  })

  it('prazen audit / prazni kriteriji → TypeError', () => {
    expect(() => koncnaVerifikacija([])).toThrow(/audit brez vrstic/)
    expect(() => koncnaVerifikacija(AVTOMATIZACIJA_AUDIT, DOKAZI_AUDITA, [])).toThrow(/kriteriji brez vrstic/)
  })

  it('območje brez dokazne vezave → TypeError (verifikacija ne sme sanjati)', () => {
    const mankajoca = { ...DOKAZI_AUDITA }
    delete (mankajoca as Record<string, unknown>)['§1 Photo/VIZ']
    expect(() => koncnaVerifikacija(AVTOMATIZACIJA_AUDIT, mankajoca)).toThrow(/brez dokazne vezave/)
    expect(() => koncnaVerifikacija(AVTOMATIZACIJA_AUDIT, mankajoca)).toThrow(/§1 Photo\/VIZ/)
  })

  it('neznana verifikacijska plast → TypeError', () => {
    const pokvarena = {
      ...DOKAZI_AUDITA,
      '§1 Photo/VIZ': { plasti: ['magic' as unknown as (typeof VERIFIKACIJSKE_PLASTI)[number]], opomba: 'pokvarena' },
    }
    expect(() => koncnaVerifikacija(AVTOMATIZACIJA_AUDIT, pokvarena)).toThrow(/NEZNANO plastjo/)
  })

  it('podvojeno območje v auditu → TypeError (EN VIR join — nič dvojnikov)', () => {
    const podvojen = [...AVTOMATIZACIJA_AUDIT, AVTOMATIZACIJA_AUDIT[0]]
    expect(() => koncnaVerifikacija(podvojen)).toThrow(/podvojeno območje/)
  })

  it('kriterij brez izpeljave / brez dokaza → TypeError', () => {
    const brezIzpeljave = [
      { kriterij: 'x', izpeljava: '   ', dokaz: 'y' },
    ]
    expect(() => koncnaVerifikacija(AVTOMATIZACIJA_AUDIT, DOKAZI_AUDITA, brezIzpeljave)).toThrow(/brez izpeljave/)
    const brezDokaza = [
      { kriterij: 'x', izpeljava: 'y', dokaz: '' },
    ]
    expect(() => koncnaVerifikacija(AVTOMATIZACIJA_AUDIT, DOKAZI_AUDITA, brezDokaza)).toThrow(/brez dokaza/)
  })
})

describe('r315 STRAŽAR — vodja blok žiči EN VIR + docs dokument + diska resnica', () => {
  const vodja = () => readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')

  it('vodja-dashboard uvaža lib + nosi testide, NIČ dvojnega sklepa', () => {
    const src = vodja()
    // PIN SHIFT R316 (izrecno, precedens R306/R309/R314): import razširjen z
    // koncnaVerifikacijaJson (46. člen — IZVOZI družina); obrnjena regresija:
    // stari enojni import se ne sme vrniti.
    expect(src).toContain("import { koncnaVerifikacija, koncnaVerifikacijaJson } from '@/lib/koncna-verifikacija'")
    expect(src).not.toContain("import { koncnaVerifikacija } from '@/lib/koncna-verifikacija'")
    expect(src).toContain('koncnaVerifikacija()')
    expect(src).toContain('data-testid="koncna-verifikacija-dokaz"')
    expect(src).toContain('data-testid="koncna-verifikacija-vrstica"')
    expect(src).toContain('data-testid="koncna-verifikacija-kriterij"')
    expect(src).toContain('data-testid="koncna-verifikacija-sklep"')
    // EN VIR: ročno prepisan sklep v JSX bi bil dvojnica — lib niz gre verbatim.
    expect(src).not.toContain('območij z dokaznimi plastmi</p>')
    expect(src).toContain('{koncna.sklep}')
  })

  it('docs/koncna-verifikacija-head.md obstaja + nosi EN VIR fraze (dokument ne sme zaostati)', () => {
    const p = koncnaVerifikacija()
    const docsPot = join(process.cwd(), 'docs/koncna-verifikacija-head.md')
    expect(existsSync(docsPot), 'docs dokument manjka').toBe(true)
    const docs = readFileSync(docsPot, 'utf8')
    for (const fr of ['Deliverable 7', 'SPREJEMNI_KRITERIJI', 'DOKAZI_AUDITA', 'docs/automacija-audit.md']) {
      expect(docs, `docs manjka fraza: ${fr}`).toContain(fr)
    }
    // EN VIR: kriteriji v docs verbatim kot v lib (prvi + zadnji — vzorčna preverba)
    expect(docs).toContain(p.kriteriji[0].kriterij)
    expect(docs).toContain(p.kriteriji[p.kriteriji.length - 1].kriterij)
  })

  it('diska resnica: vsi dokazi kriterijev, ki so poti, obstajajo na disku', () => {
    // kriterij dokaz nosi poti (npr. 'src/lib/…' + 'scripts/r*-…'); vsaka
    // MORA obstajati — končna verifikacija ne sme sanjati. Glob 'r*-…' se
    // razstavi na imenik + vzorec (vsaj en zadetek v drevesu = dokaz živ).
    const potiRegex = /(src|docs|scripts)\/[A-Za-z0-9_\-./*[\]]+/g
    for (const k of SPREJEMNI_KRITERIJI) {
      const poti = [...k.dokaz.matchAll(potiRegex)].map((m) => m[0].replace(/[.,)]+$/, ''))
      expect(poti.length, `${k.kriterij}: dokaz nosi poti`).toBeGreaterThan(0)
      for (const pot of poti) {
        if (pot.includes('*')) {
          const imenik = pot.slice(0, pot.lastIndexOf('/'))
          const vzorec = pot.slice(imenik.length + 1)
          const re = new RegExp('^' + vzorec.replace(/[.+()[\]]/g, '\\$&').replace(/\*/g, '.+') + '$')
          // beriDrevo vrača poti s prefiksom imenika — primerjaj samo rep
          const zadetki = beriDrevo(imenik).filter((f) => re.test(f.slice(imenik.length + 1)))
          expect(zadetki.length, `glob dokaz ${pot} (kriterij: ${k.kriterij}) ima 0 zadetkov`).toBeGreaterThan(0)
        } else {
          expect(existsSync(join(process.cwd(), pot)), `dokaz pot manjka: ${pot} (kriterij: ${k.kriterij})`).toBe(true)
        }
      }
    }
  })

  it('DOKAZI_AUDITA ključi = natanko audit območja (totalen join po konstrakciji)', () => {
    const kljuci = Object.keys(DOKAZI_AUDITA).sort()
    const obmocja = AVTOMATIZACIJA_AUDIT.map((v) => v.obmocje).sort()
    expect(kljuci).toEqual(obmocja)
  })
})
