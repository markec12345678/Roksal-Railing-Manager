// R242 — ZAKLEP ODPRTEGA VPOGLEDA R241-dodatek: dolžinska drifta Osnutek PDF
// (30057 → 30191 lokalni → 30119 prod) NI napaka našega liba in NI odvisnost
// od opomb/vidnega seta — mehanizem je jsPDF-jev GLIF SUBSET vgrajenega Roboto
// subseta (pdf-sl-font: 23 KB na varianto). Statično besedilo dokumenta (šifra
// 'INOX-M12-A4', naziv, enota, 15/50/50, glava, noge, '28. 09. 2026') NE vsebuje
// števk 3 in 7 — časovni žig 'ob HH:MM' pa jih vnese TOČKO, ko je zajem ob
// uri/minuti s to števko:
//   30057 = žig brez 3 in 7 (npr. 04:11, 02:45, 04:21, 04:52)
//   30119 = +števka 3 (prod reprobe 05:43) → Δ3 = +62 B
//   30191 = +3 in +7 (02:37, 03:47, 05:37) → Δ7 = +72 B, Δ3+Δ7 = +134 B
// Torej: determinizem je ZNOTRAJ-VHODN (R121 pravilo drži — isti vhod = bajtno
// isti PDF), dolžina pa je funkcija GLIFSKE MNOŽICE vhoda. 'Bajtno ISTI' iz
// prejšnjih rund je bila dolžinska identiteta ob ISTI glifski množici.
// Eksperiment (kontrolirani pogoji, fiksni now — brez ura od ure):
//   • isti vhod + isti now → bajtno ISTI (determinizem, ×2)
//   • ISTA glifska množica različnih časov (04:11 vs 04:22) → ISTA dolžina,
//     RAZLIČNI bajti (CreationDate vsebina — dolžinska identiteta ≠ vsebinska)
//   • 04:43 (+3), 04:47 (+7), 04:37 (+3+7) → aditivnost prispevkov
//   • dan 26. (brez '8') < dan 28. ('8' nov glif) — datum vnese glif enako
//   • opombe (vsebinska dimenzija) dolžino TVDIJO, a drifta +62/+72 je bila
//     BREZ opomb (E2E jih nikoli ne tipka) → vir drifta = glifi, NE opombe
// Urne izbire so odporne na TZ (UTC in CEST +2h dajeta ISTO glifsko množico:
// 04:xx→06:xx — statična množica {0,1,2,4,5,6} ⊇ vse nove razen 3/7/8).
import { describe, expect, it } from 'vitest'
import { buildOsnutekPdfDoc } from '@/lib/osnutek-pdf'
import type { ZalogaArtikelZaNarocilo } from '@/lib/zaloga-povzetek'

// REALNI vhod lokalnega E2E/prod prerezov (roksal_dev Inventory: edini artikel
// pod minimumom — fingerprint pod=1; INOX-M12-A4, zaloga 15, min 50).
const ARTIKEL: ZalogaArtikelZaNarocilo[] = [
  {
    id: 'inox-m12-a4',
    sifraMateriala: 'INOX-M12-A4',
    naziv: 'Inox Vijak M12 A4',
    kolicinaZaloga: 15,
    enota: 'kos',
    minimalnaZaloga: 50,
  },
]

function pdf(urna: [number, number], dan = 28, opombe?: string): Buffer {
  const now = new Date(2026, 8, dan, urna[0], urna[1], 0)
  const doc = buildOsnutekPdfDoc(ARTIKEL, { now, ...(opombe ? { opombe } : {}) })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R242 — osnutek-pdf dolžinska drifta: glifni subset zaklep (R241-dodatek vpogled)', () => {
  it('določilna meritev: dolžine po urnih variantah (izpis za worklog dokaz)', () => {
    const osnova = pdf([4, 11])
    const d3 = pdf([4, 43])
    const d7 = pdf([4, 47])
    const d37 = pdf([4, 37])
    const istiSet = pdf([4, 22])
    const dan26 = pdf([4, 11], 26)
    // merjene vrednosti grejo v worklog — dokaz na številkah, ne ugibanju
    console.log(
      JSON.stringify({
        osnova: osnova.length,
        d3: d3.length,
        d7: d7.length,
        d37: d37.length,
        istiSet: istiSet.length,
        dan26: dan26.length,
        delta3: d3.length - osnova.length,
        delta7: d7.length - osnova.length,
        delta37: d37.length - osnova.length,
        deltaDan26: dan26.length - osnova.length,
      }),
    )
    expect(osnova.length).toBeGreaterThan(1000)
  })

  it('isti vhod + isti now = bajtno ISTI (determinizem znotraj-vhodn, R121)', () => {
    const a = pdf([4, 11])
    const b = pdf([4, 11])
    expect(a.equals(b)).toBe(true)
  })

  it('ISTA glifska množica (04:11 vs 04:22) = ISTA dolžina, RAZLIČNI bajti', () => {
    const a = pdf([4, 11])
    const b = pdf([4, 22])
    expect(b.length).toBe(a.length) // dolžinska identiteta
    expect(a.equals(b)).toBe(false) // …ne pa vsebinska (CreationDate sekunda/čas)
  })

  it('števka 3 (04:43) in števka 7 (04:47) vsaka poveča dolžino (glifni subset)', () => {
    const osnova = pdf([4, 11])
    const d3 = pdf([4, 43])
    const d7 = pdf([4, 47])
    expect(d3.length).toBeGreaterThan(osnova.length)
    expect(d7.length).toBeGreaterThan(osnova.length)
    expect(d3.equals(osnova)).toBe(false)
  })

  it('aditivnost glifov: 3+7 skupaj (04:37) = Δ3 + Δ7 (neodvisna prispevka)', () => {
    const osnova = pdf([4, 11])
    const d3 = pdf([4, 43])
    const d7 = pdf([4, 47])
    const d37 = pdf([4, 37])
    expect(d37.length - osnova.length).toBe(
      d3.length - osnova.length + (d7.length - osnova.length),
    )
  })

  it('datum vnese glif enako: dan 26 (brez števke 8) je krajši od dan 28', () => {
    const dan28 = pdf([4, 11], 28)
    const dan26 = pdf([4, 11], 26)
    expect(dan26.length).toBeLessThan(dan28.length)
  })

  it('opombe so vsebinska dimenzija dolžine (drifta +62/+72 pa je bila BREZ opomb)', () => {
    const brez = pdf([4, 11])
    const zOpombo = pdf([4, 11], 28, 'dostava do petka')
    expect(zOpombo.length).toBeGreaterThan(brez.length)
  })
})
