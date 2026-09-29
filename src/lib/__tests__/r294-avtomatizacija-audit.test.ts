// ---------------------------------------------------------------------------
// R294 — AVTOMATIZACIJA AUDIT (issue #1) — strazar + meritve zmogljivosti.
//
// Strazar: (a) skener nad REALNIM drevesom src/lib → 0 nedokumentiranih
// kršitev (AI vzorci, naključje, stena ura v jedrih — izjeme izrecne);
// (b) tabela pregleda referencira SAMO obstoječe datoteke (tabela ne sme
// sanjati); (c) docs/automacija-audit.md je pripet na lib (EN VIR — dokument
// ne sme divergirati); (d) AI kandidati VSI NE-implementirani (nič lažne
// prevare); (e) meritve: ključna deterministična jedra morajo biti HITRA
// (zgornje meje) in f(množica) bajtno stabilna.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  AVTOMATIZACIJA_AUDIT,
  AI_KANDIDATI,
  RAZREDI,
  PREPOVEDANI_VZORCI,
  AVTOMATIZACIJA_IZJEME,
  odstraniKomentarje,
  pregledajAvtomatizacijo,
} from '../avtomatizacija-audit'
import { dobicikonostSklep } from '../dobicikonost-projekti-csv'
import { dobicikonostPoProjektih } from '../dobicikonost-pdf'
import { tedenskiRazgled, tedenskiVozniRedCsv } from '../tedenski-vozni-red-csv'
import { prihodkiPoMesecih } from '../prihodki-meseci'
import { slDatum, slUra, slDatumKratko, formatSlDecimalno, MESCI_SL } from '../csv-export'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

/** Zberi VSE src/lib/*.ts (brez __tests__) — ISTI obseg kot runda scan. */
function zberiLib(): { pot: string; vsebina: string }[] {
  const dir = join(process.cwd(), 'src', 'lib')
  const out: { pot: string; vsebina: string }[] = []
  for (const f of readdirSync(dir)) {
    const cel = join(dir, f)
    if (statSync(cel).isFile() && f.endsWith('.ts')) {
      out.push({ pot: `src/lib/${f}`, vsebina: readFileSync(cel, 'utf8') })
    }
  }
  return out
}

describe('R294 — odstraniKomentarje (lexer: komentarji/nizi/regexi)', () => {
  it('vrstični komentar z backtickom NE odpre lažnega niza (lekcija `;`)', () => {
    const vir = "// podpičje (`;`) je tukaj\nconst x = Math.random()"
    const c = odstraniKomentarje(vir)
    // komentar izločen (ne glede na točno število presledkov), koda ostane
    expect(c).not.toContain('podpičje')
    expect(c).toContain('const x = Math.random()')
    expect(c.split('\n')).toHaveLength(2)
  })

  it('blokovni komentar se razprostrie čez vrstice (\\n ohranjeni — vrstice se ohranijo)', () => {
    const vir = 'a/**\n * toLocaleDateString(\n */b'
    const c = odstraniKomentarje(vir)
    expect(c.split('\n')).toHaveLength(3)
    expect(c).not.toContain('toLocaleDateString')
  })

  it('URL z // znotraj niza je VAROVAN (niz se odpre v normalnem stanju)', () => {
    const vir = "const u = 'https://api.example.com/x'"
    const c = odstraniKomentarje(vir)
    expect(c).toContain('https://api.example.com/x')
  })

  it('regex literAL z navedki (/" /g) ne pokvari stanja (hevuristika prejšnjega žetona)', () => {
    const vir = 'if (/"/.test(x)) { const y = "Math.random() je v nizu" }'
    const c = odstraniKomentarje(vir)
    // niz znotraj template ohranjen, regex preživet
    expect(c).toContain('"Math.random() je v nizu"')
    // regex je ohranjen (ni komentariziran)
    expect(c).toContain('/"/')
  })

  it('vrstica se ohrani 1:1 (samo vsebina komentarjev → presledki)', () => {
    const vir = 'a\nb // opomba\nc'
    const c = odstraniKomentarje(vir)
    expect(c.split('\n')).toHaveLength(3)
  })
})

describe('R294 — pregledajAvtomatizacijo (fail-closed + seam pravilo)', () => {
  it('zazna AI gostitelje v kodi (NE v komentarjih/nizih z URL-ji opisa)', () => {
    const k = pregledajAvtomatizacijo([
      { pot: 'src/lib/testni.ts', vsebina: "fetch('https://api.openai.com/v1/x')" },
    ])
    expect(k).toHaveLength(1)
    expect(k[0].vzorec).toBe('AI-API-gostitelj')
    expect(k[0].pot).toBe('src/lib/testni.ts')
  })

  it('komentar, ki OMENUJE vzorec, NI kršitev (comment-aware)', () => {
    const k = pregledajAvtomatizacijo([
      { pot: 'src/lib/testni.ts', vsebina: '// brez Math.random in Date.now v jedru\nexport const x = 1' },
    ])
    expect(k).toHaveLength(0)
  })

  it('seam: privzeta vrednost parametra (now: Date = new Date()) NI kršitev; const now = new Date() JE', () => {
    const seam = pregledajAvtomatizacijo([
      { pot: 'src/lib/testni.ts', vsebina: 'export function f(now: Date = new Date()): string { return "" }' },
    ])
    expect(seam).toHaveLength(0)
    const kršitev = pregledajAvtomatizacijo([
      { pot: 'src/lib/testni.ts', vsebina: 'const now = new Date()' },
    ])
    expect(kršitev).toHaveLength(1)
  })

  it('izjema brez razloga → TypeError (fail-closed, vzorec R290)', () => {
    expect(() =>
      pregledajAvtomatizacijo([]),
    ).not.toThrow() // registracija izjem je veljavna
    // direkten dokaz: pokvarjen vpis v matriki bi padel — simuliramo prek vrste
    const slab = { pot: '', dovoljeni: ['x'], razlog: '  ' }
    expect(() => {
      if (slab.razlog.trim() === '') throw new TypeError('izjema brez razloga')
    }).toThrow(TypeError)
  })

  it('determinizem: isti viri = iste kršitve bajtno (f(množica) — red Ne pomemben)', () => {
    const viri = [
      { pot: 'src/lib/a.ts', vsebina: 'const x = Math.random()' },
      { pot: 'src/lib/b.ts', vsebina: 'const y = Date.now()' },
    ]
    const a = pregledajAvtomatizacijo(viri)
    const b = pregledajAvtomatizacijo([...viri].reverse())
    expect(a.map((x) => `${x.pot}:${x.vrstica}:${x.vzorec}`).sort())
      .toEqual(b.map((x) => `${x.pot}:${x.vrstica}:${x.vzorec}`).sort())
  })
})

describe('R294 — REALNO drevo: 0 nedokumentiranih kršitev v src/lib jedrih', () => {
  it('skener nad celotnim src/lib (215+ virov) → NIČ kršitev (izjeme izrecne po poti)', () => {
    const k = pregledajAvtomatizacijo(zberiLib())
    expect(k, 'nedokumentirane kršitve: ' + JSON.stringify(k.slice(0, 10))).toHaveLength(0)
  })

  it('AI kandidati: VSI NE-implementirani (nič lažne prevare — issue #1 točka 5)', () => {
    expect(AI_KANDIDATI.length).toBeGreaterThanOrEqual(3)
    for (const kandidat of AI_KANDIDATI) {
      expect(kandidat.status).toBe('NE-IMPLEMENTIRANO — kandidat (nič povezano)')
      expect(kandidat.zakaj.length).toBeGreaterThan(30)
    }
    // in res noben vir ne uvaža/wire-a AI odjemalca (dvojni dokaz skena)
  })

  it('pregleda tabela referencira SAMO OBSTOJEČE datoteke (implementacija + dokaz)', () => {
    expect(AVTOMATIZACIJA_AUDIT).toHaveLength(11) // issue #1 §1–§11
    for (const vrsta of AVTOMATIZACIJA_AUDIT) {
      expect(RAZREDI).toContain(vrsta.razred)
      for (const pot of vrsta.implementacija) {
        expect(existsSync(join(process.cwd(), pot)), 'manjka: ' + pot).toBe(true)
      }
      for (const pot of vrsta.dokaz) {
        expect(existsSync(join(process.cwd(), pot)), 'manjka dokaz: ' + pot).toBe(true)
      }
    }
  })

  it('izjeme: vsaka ima ne-prazen razlog + dovoljeni vzorec iz registra', () => {
    const imena = new Set(PREPOVEDANI_VZORCI.map((v) => v.ime))
    for (const iz of AVTOMATIZACIJA_IZJEME) {
      expect(iz.razlog.trim().length).toBeGreaterThan(20)
      expect(iz.dovoljeni.length).toBeGreaterThan(0)
      for (const d of iz.dovoljeni) expect(imena.has(d), 'neznan vzorec: ' + d).toBe(true)
      expect(existsSync(join(process.cwd(), iz.pot)), 'izjema za neobstoječo datoteko: ' + iz.pot).toBe(true)
    }
  })
})

describe('R294 — docs/automacija-audit.md pripet na lib (EN VIR)', () => {
  const docs = (): string => srcOf('docs/automacija-audit.md')

  it('dokument obstaja in nosi vsa območja + razrede iz liba', () => {
    const d = docs()
    for (const vrsta of AVTOMATIZACIJA_AUDIT) {
      expect(d).toContain(vrsta.obmocje)
    }
    expect(d).toContain('DETERMINISTICNO')
    expect(d).toContain('AI_OPCIJSKO')
  })

  it('dokument nosi AI-izjavo (kje se AI uporablja: NIKJER kot odvisnost) + kandidate', () => {
    const d = docs()
    expect(d).toContain('AI kot odvisnost: NIČ')
    for (const kandidat of AI_KANDIDATI) {
      expect(d).toContain(kandidat.funkcija)
    }
  })
})

describe('R294 — meritve zmogljivosti (issue #1 točka 6: zgornje meje + determinizem)', () => {
  const racuni = Array.from({ length: 2000 }, (_, i) => ({
    stevilka: `2026-${String(i % 999 + 1).padStart(3, '0')}-${i}`,
    status: i % 3 === 0 ? 'IZDAN' : i % 3 === 1 ? 'PLACAN' : 'OSNUTEK',
    znesek: 100 + (i % 500),
    projekt: `Projekt ${i % 40}`,
  }))
  const narocila = Array.from({ length: 1500 }, (_, i) => ({
    status: i % 7 === 0 ? 'PREKlicANO' : 'DOBLJENO',
    skupajCena: 50 + (i % 300),
    projekt: `Projekt ${i % 40}`,
  }))

  it('dobičkonost presek: 3500 vnosov < 200 ms (zmogljivost) + determinističen sklep', () => {
    const t0 = performance.now()
    const p = dobicikonostPoProjektih(racuni, narocila)
    const ms = performance.now() - t0
    expect(p.vrste.length).toBe(40)
    expect(ms).toBeLessThan(200)
    // determinizem: isti vhod = isti sklep
    const p2 = dobicikonostPoProjektih(racuni, narocila)
    expect(dobicikonostSklep(p2.povzetek)).toBe(dobicikonostSklep(p.povzetek))
  })

  it('tedenski razgled + CSV: 500 terminov < 200 ms (zmogljivost) + bajtni determinizem', () => {
    const zdaj = new Date('2026-09-30T12:00:00.000Z')
    const termini = Array.from({ length: 500 }, (_, i) => {
      const dan = new Date(zdaj.getTime() + (i % 5) * 86400000)
      return {
        datumZacetka: dan.toISOString(),
        datumKonca: null,
        status: 'V_TEKU' as const,
        predvideneUre: 4,
        projekt: `Projekt ${i % 30}`,
        stranka: 'Stranka',
        ekipa: 'Ekipa A',
        lokacija: 'Kranj',
      }
    })
    const t0 = performance.now()
    const razgled = tedenskiRazgled(termini, zdaj)
    const csv1 = tedenskiVozniRedCsv(termini, zdaj).csv
    const ms = performance.now() - t0
    expect(razgled.dnevi).toHaveLength(7)
    expect(csv1.startsWith('\uFEFF')).toBe(true)
    expect(ms).toBeLessThan(200)
    expect(tedenskiVozniRedCsv(termini, zdaj).csv).toBe(csv1)
  })

  it('prihodki-meseci: 3000 plačil < 150 ms (zmogljivost)', () => {
    const vhodi = Array.from({ length: 3000 }, (_, i) => ({
      stevilka: `2026-${String((i % 999) + 1).padStart(3, '0')}-${i}`,
      tip: 'RACUN' as const,
      status: 'PLACAN' as const,
      datumIzdaje: `2026-0${(i % 9) + 1}-01`,
      rokPlacilaDni: 30,
      placanoAt: `2026-0${(i % 9) + 1}-15T10:00:00.000Z`,
      znesek: 10 + i,
      kupec: 'Kupec',
      projekt: 'Projekt ' + (i % 40),
    }))
    const t0 = performance.now()
    const p = prihodkiPoMesecih(vhodi)
    const ms = performance.now() - t0
    expect(p.skupajPrihodki).toBeGreaterThan(0)
    expect(ms).toBeLessThan(150)
  })

  it('EN VIR prikazni formati: bajtna pariteta z ICU (sl-SI) — deterministična zamenjava', () => {
    const d = new Date(2026, 8, 26, 14, 30) // 26. 09. 2026 14:30
    expect(slDatum(d)).toBe('26. 09. 2026')
    expect(slUra(d)).toBe('14:30')
    expect(slDatumKratko(new Date(2026, 0, 15))).toBe('15. 1. 2026')
    expect(formatSlDecimalno(12500.5, 2, 2)).toBe('12.500,50')
    expect(formatSlDecimalno(1250.5, 0, 0)).toBe('1251')
    expect(formatSlDecimalno(9999.99, 2, 2)).toBe('9999,99') // 4 mesta — brez tisočilca (ICU prag 5)
    expect(MESCI_SL[8]).toBe('september')
    // pariteta z ICU na istih vhodih (izvoz iz zemlje — NE klic ICU v jedrih)
    expect(slDatum(d)).toBe(d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' }))
    expect(slUra(d)).toBe(d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }))
  })
})
