// R355 — 65. člen issue #1 (IZVOZI družina): POLNI katalog zmožnosti (§11)
// kot DETERMINISTIČNI CSV (avtomatizacija-katalog-csv.ts). Testi:
// (A) determinizem — isti vhod ×2 → bajtno identična datoteka (BOM + CRLF);
// (B) format kanon — glava = KATALOG_CSV_GLAVE, podpičje ločilo, CRLF končnice;
// (C) pokritost — št. podatkovnih vrstic = katalog.length, vrstni red = ISTI;
// (D) AI vrstice — nadomestek id + opis RAZREŠEN iz kataloga (kontrakt §11);
// (E) ne-AI vrstice — nadomestek stolpci prazni;
// (F) fail-closed ×3 — podvojen id / AI brez nadomestka / neobstoječ
//     nadomestek → TypeError (pokvaren katalog ne more postati lažno
//     poročilo — vzorec avtomatizacijaPregled);
// (G) sklep EN VIR — izpeljava iz avtomatizacijaPovzetek (iste številke kot
//     kartica) + Vir vrstica = KATALOG_VIR_NIZ;
// (H) filename determinističen (brez datuma — vzorec avtomatizacija-audit.csv);
// (I) EN VIR žičenje vodje — import + handler + toast naslov VERBATIM;
// (J) 0 novih hex + družinska konsistenznost (katalog = EN VIR za ponudnike).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  avtomatizacijaKatalogCsv,
  avtomatizacijaKatalogCsvFilename,
  KATALOG_CSV_GLAVE,
  KATALOG_VIR_NIZ,
} from '@/lib/avtomatizacija-katalog-csv'
import {
  AUTOMATIZACIJSKI_KATALOG,
  avtomatizacijaPovzetek,
  type AutomatizacijskaZmoznost,
} from '@/lib/automation/katalog'

const vodja = readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')
const modul = readFileSync(join(process.cwd(), 'src/lib/avtomatizacija-katalog-csv.ts'), 'utf8')
const ponudniki = readFileSync(join(process.cwd(), 'src/lib/automation/ponudniki.ts'), 'utf8')

/** Fail-closed testna zmožnost (kombrez tipa — samo za negativne poti). */
function zmoznost(razlik: Record<string, unknown>): AutomatizacijskaZmoznost {
  return {
    id: 'test.vnos',
    vrsta: 'deterministic',
    obmocje: 'Meritve',
    opis: 'Testna zmožnost',
    modul: 'src/lib/test.ts',
    ...razlik,
  } as unknown as AutomatizacijskaZmoznost
}

describe('r355 — 65. člen: polni katalog zmožnosti kot deterministični CSV', () => {
  it('(A) determinizem: isti vhod ×2 → bajtno identično; BOM na začetku, CRLF končnica', () => {
    const a = avtomatizacijaKatalogCsv()
    const b = avtomatizacijaKatalogCsv()
    expect(a).toBe(b)
    expect(a.charCodeAt(0)).toBe(0xfeff)
    expect(a.endsWith('\r\n')).toBe(true)
    expect(a.includes('\n')).toBe(true)
  })

  it('(B) format kanon: prva vrstica = KATALOG_CSV_GLAVE (podpičje ločilo)', () => {
    const csv = avtomatizacijaKatalogCsv()
    const brezBom = csv.slice(1)
    const glava = brezBom.split('\r\n')[0]
    expect(glava).toBe(KATALOG_CSV_GLAVE.join(';'))
  })

  it('(C) pokritost: podatkovnih vrstic = katalog.length; vrstni red = ISTI kot katalog', () => {
    const csv = avtomatizacijaKatalogCsv()
    const vrstice = csv.slice(1).split('\r\n').filter((v) => v.length > 0)
    // glava + katalog.length podatkovnih + Sklep + Vir (prazna ločilna vrstica
    // je v CSV prisotna, tu pa izločena s filter — kanon R317 meta strukture)
    expect(vrstice.length).toBe(AUTOMATIZACIJSKI_KATALOG.length + 3)
    const podatkovne = vrstice.slice(1, 1 + AUTOMATIZACIJSKI_KATALOG.length)
    for (let i = 0; i < AUTOMATIZACIJSKI_KATALOG.length; i++) {
      expect(podatkovne[i].startsWith(`${AUTOMATIZACIJSKI_KATALOG[i].id};`), AUTOMATIZACIJSKI_KATALOG[i].id).toBe(true)
    }
  })

  it('(D) AI vrstice: nadomestek id + opis RAZREŠEN iz kataloga (kontrakt §11)', () => {
    const ai = AUTOMATIZACIJSKI_KATALOG.filter((z) => z.vrsta === 'ai')
    expect(ai.length).toBeGreaterThan(0)
    const csv = avtomatizacijaKatalogCsv()
    const vrstice = csv.slice(1).split('\r\n')
    for (const z of ai) {
      const vrstica = vrstice.find((v) => v.startsWith(`${z.id};`))
      expect(vrstica, z.id).toBeDefined()
      const nad = z.nadomestek as string
      const nadomestekOpis = AUTOMATIZACIJSKI_KATALOG.find((n) => n.id === nad)?.opis as string
      expect(vrstica, `${z.id} nadomestek id`).toContain(`;${nad};`)
      expect(vrstica, `${z.id} nadomestek opis`).toContain(nadomestekOpis)
    }
  })

  it('(E) ne-AI vrstice: nadomestek stolpci PRAZNI (nič izmišljenih nadomestkov)', () => {
    const csv = avtomatizacijaKatalogCsv()
    const vrstice = csv.slice(1).split('\r\n')
    for (const z of AUTOMATIZACIJSKI_KATALOG.filter((x) => x.vrsta !== 'ai')) {
      const vrstica = vrstice.find((v) => v.startsWith(`${z.id};`))
      expect(vrstica, z.id).toBeDefined()
      // zadnja dva stolpca (nadomestek id + opis) prazna — vrstica se konča z ';;'
      expect(vrstica?.endsWith(';;'), z.id).toBe(true)
    }
  })

  it('(F) fail-closed ×3: podvojen id / AI brez nadomestka / neobstoječ nadomestek → TypeError', () => {
    const dvojen = [zmoznost({}), zmoznost({ id: 'test.vnos', opis: 'Druga' })]
    expect(() => avtomatizacijaKatalogCsv(dvojen)).toThrow(
      "podvojen id zmožnosti 'test.vnos' — fail-closed",
    )
    const brezNad = [zmoznost({ id: 'test.ai', vrsta: 'ai' } as Record<string, unknown>)]
    expect(() => avtomatizacijaKatalogCsv(brezNad)).toThrow(
      "AI zmožnost 'test.ai' brez izrečenega nadomestka (kontrakt §11) — fail-closed",
    )
    const slabeNad = [zmoznost({ id: 'test.ai2', vrsta: 'ai', nadomestek: 'ne.obstaja' })]
    expect(() => avtomatizacijaKatalogCsv(slabeNad)).toThrow(
      "nadomestek 'ne.obstaja' (AI 'test.ai2') ne obstaja v katalogu — fail-closed",
    )
  })

  it('(G) sklep EN VIR: številke = avtomatizacijaPovzetek (karte resnica) + Vir vrstica', () => {
    const pov = avtomatizacijaPovzetek()
    const csv = avtomatizacijaKatalogCsv()
    const sklepVrstica = csv.split('\r\n').find((v) => v.startsWith('Sklep;'))
    expect(sklepVrstica).toBeDefined()
    expect(sklepVrstica).toContain(`${pov.skupaj} zmožnosti`)
    expect(sklepVrstica).toContain(`${pov.ai} AI neobveznih`)
    expect(sklepVrstica).toContain(`${pov.aiZNadomestkom} z izrečenim determinističnim nadomestkom`)
    expect(sklepVrstica).toContain('jedro deluje brez AI')
    expect(csv).toContain(`Vir;${KATALOG_VIR_NIZ}`)
  })

  it('(H) filename determinističen: brez datuma (vzorec avtomatizacija-audit.csv)', () => {
    expect(avtomatizacijaKatalogCsvFilename()).toBe('avtomatizacija-katalog.csv')
    expect(avtomatizacijaKatalogCsvFilename()).toBe(avtomatizacijaKatalogCsvFilename())
  })

  it('(I) EN VIR žičenje vodje: import + klic + filename + toast naslov VERBATIM', () => {
    expect(vodja).toContain("import { avtomatizacijaKatalogCsv, avtomatizacijaKatalogCsvFilename } from '@/lib/avtomatizacija-katalog-csv'")
    expect(vodja).toContain('const csv = avtomatizacijaKatalogCsv()')
    expect(vodja).toContain('a.download = avtomatizacijaKatalogCsvFilename()')
    expect(vodja).toContain("toast({ title: 'Avtomatizacijski katalog izvožen ✓', description: avtomatizacijaKatalogCsvFilename() })")
  })

  it('(J) 0 novih hex v modulu + družinska konsistenznost: ISTI katalog kot ponudniki (EN VIR)', () => {
    expect(modul.match(/#[0-9a-fA-F]{3,8}\b/)).toBeNull()
    expect(ponudniki).toContain('AUTOMATIZACIJSKI_KATALOG,')
    expect(modul).toContain("from './automation/katalog'")
    expect(modul).toContain('R355 — 65. člen')
  })
})
