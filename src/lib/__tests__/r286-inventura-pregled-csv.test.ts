// ---------------------------------------------------------------------------
// R286 — INVENTURA — PREMOŽENJSKI PREGLED CSV (30. člen 'izvozi' družine)
// Testna družina: pariteta po konstrukciji (F1/F2), fail-closed ISTI
// kontrakt (F3), determinizem (F4), kode verbatim (F5), ime datoteke (F4).
// EN VIR inventuraPregled — NIČ lastne tolerance (worklog R286 F1–F6).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import {
  INVENTURA_CSV_DODATNI,
  INVENTURA_CSV_STOLPCEV,
  inventuraPregledCsv,
  inventuraPregledCsvFilename,
  inventuraPregledCsvVrstice,
} from '@/lib/inventura-pregled-csv'
import { inventuraPregled } from '@/lib/inventura-pregled-pdf'
import { type InventuraArtikel } from '@/lib/inventura-pregled-pdf'

/** Fikstura — pokriva VSE tri cone statusov (ISTI predikati kot R219/R270):
 *  POD MINIMUMOM (12 < 20), NA MEJI (20 === 20), ZADOSTNO (50 > 20). */
const ARTIKLI: InventuraArtikel[] = [
  {
    id: 'a-1',
    sifraMateriala: 'WPC-120-A',
    naziv: 'WPC profil 120',
    tip: 'WPC',
    enota: 'm',
    kolicinaZaloga: 12,
    minimalnaZaloga: 20,
    premiki: 7,
  },
  {
    id: 'a-2',
    sifraMateriala: 'ALU-STEB-60',
    naziv: 'Alu stebre 60',
    tip: 'ALU',
    enota: 'kos',
    kolicinaZaloga: 20,
    minimalnaZaloga: 20,
    premiki: 0,
  },
  {
    id: 'a-3',
    sifraMateriala: 'STEKLO-PAN-900',
    naziv: 'Steklo panel 900',
    tip: 'STEKLO',
    enota: 'kos',
    kolicinaZaloga: 50,
    minimalnaZaloga: 20,
    premiki: 3,
  },
]

const NOW = new Date('2026-09-29T15:30:00Z')

describe('R286 — inventura-pregled CSV: pariteta po konstrukciji (F1/F2)', () => {
  it('kontrakt = 11 stolpcev: 8 R270 tabela + 3 dodatni (id, Premiki, Izvoženo)', () => {
    expect(INVENTURA_CSV_STOLPCEV).toBe(11)
    expect(INVENTURA_CSV_DODATNI).toEqual(['id', 'Premiki', 'Izvoženo'])
  })

  it('glava startsWith bajtno: prvih 8 stolpcev = R270 autoTable head (Šifra…Status)', () => {
    const [glava] = inventuraPregledCsvVrstice(ARTIKLI, NOW.toISOString())
    const glavaCelice = glava.split(',').map((c) => c.replace(/^"|"$/g, ''))
    // R270 autoTable head (buildInventuraPregledPdfDoc) — bajtna pariteta:
    expect(glavaCelice.slice(0, 8)).toEqual([
      'Šifra',
      'Naziv',
      'Tip',
      'Zaloga',
      'Enota',
      'Minimum',
      'Manjka',
      'Status',
    ])
    expect(glavaCelice.slice(8)).toEqual(['id', 'Premiki', 'Izvoženo'])
  })

  it('ENA resnica: vrstice v ISTEM akcijskem redu kot R270 inventuraPregled (POD MINIMUMOM prvi)', () => {
    const { vrste } = inventuraPregled(ARTIKLI)
    const vrstice = inventuraPregledCsvVrstice(ARTIKLI, NOW.toISOString())
    expect(vrstice).toHaveLength(4) // glava + 3
    vrste.forEach((v, i) => {
      const celice = vrstice[i + 1].split(',').map((c) => c.replace(/^"|"$/g, ''))
      expect(celice[0]).toBe(v.sifra)
      expect(celice[7]).toBe(v.status)
      expect(celice[8]).toBe(v.id)
    })
    expect(vrste[0].status).toBe('POD MINIMUMOM')
    expect(vrste[0].sifra).toBe('WPC-120-A')
  })

  it('Premiki EN VIR: join po id nad ISTIMI validiranimi artikli (obrat verbatim)', () => {
    const vrstice = inventuraPregledCsvVrstice(ARTIKLI, NOW.toISOString())
    const poId = new Map(
      vrstice.slice(1).map((l) => {
        const c = l.split(',').map((x) => x.replace(/^"|"$/g, ''))
        return [c[8], c[9]]
      }),
    )
    expect(poId.get('a-1')).toBe('7')
    expect(poId.get('a-2')).toBe('0')
    expect(poId.get('a-3')).toBe('3')
  })

  it('številke = kolicinaNiz EN VIR (F5): ista formatna resnica kot R270 tabela (celo → String)', () => {
    const vrstice = inventuraPregledCsvVrstice(ARTIKLI, NOW.toISOString())
    const a1 = vrstice[1].split(',').map((c) => c.replace(/^"|"$/g, ''))
    expect(a1[3]).toBe('12') // zaloga (celo)
    expect(a1[5]).toBe('20') // minimum (celo)
    expect(a1[6]).toBe('8') // manjka = 20 − 12 (celo)
  })

  it('Izvoženo = kanonični ISO iz now (R186 lekcija — toISOString, ne surov ts)', () => {
    const vrstice = inventuraPregledCsvVrstice(ARTIKLI, NOW.toISOString())
    const a1 = vrstice[1].split(',').map((c) => c.replace(/^"|"$/g, ''))
    expect(a1[10]).toBe('2026-09-29T15:30:00.000Z')
  })
})

describe('R286 — inventura-pregled CSV: kode verbatim (F5)', () => {
  it('status = enum verbatim (vse tri cone — nikoli labela/slovnična oblika)', () => {
    const vrstice = inventuraPregledCsvVrstice(ARTIKLI, NOW.toISOString())
    const statusi = vrstice.slice(1).map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, ''))[7])
    expect(statusi).toEqual(['POD MINIMUMOM', 'NA MEJI', 'ZADOSTNO'])
  })

  it('tip = label resnica verbatim (ISTA preslikava kot handler — neznana koda verbatim)', () => {
    const neznaniTip: InventuraArtikel[] = [
      { ...ARTIKLI[0], id: 'a-x', sifraMateriala: 'X-1', tip: 'NEZNANA-KODA' },
    ]
    const vrstice = inventuraPregledCsvVrstice(neznaniTip, NOW.toISOString())
    const celice = vrstice[1].split(',').map((c) => c.replace(/^"|"$/g, ''))
    expect(celice[2]).toBe('NEZNANA-KODA')
  })

  it('manjka = 0 → "0" strojno (F3: PDF "—" je tiskarska konvencija, CSV je mašinetno berljiv)', () => {
    const vrstice = inventuraPregledCsvVrstice(ARTIKLI, NOW.toISOString())
    const a2 = vrstice[2].split(',').map((c) => c.replace(/^"|"$/g, ''))
    expect(a2[6]).toBe('0') // a-2: NA MEJI — manjka 0
  })

  it('šumniki verbatim (UTF-8 BOM v inventuraPregledCsv — Excel SI dekodira pravilno)', () => {
    const vrstice = inventuraPregledCsvVrstice(ARTIKLI, NOW.toISOString())
    expect(vrstice[0]).toContain('Šifra')
    expect(vrstice[0]).toContain('Izvoženo')
  })
})

describe('R286 — inventura-pregled CSV: fail-closed ISTI kontrakt (F3)', () => {
  it('prazen seznam → TypeError (NI prazne datoteke — družinsko pravilo)', () => {
    expect(() => inventuraPregledCsvVrstice([], NOW.toISOString())).toThrow(TypeError)
    expect(() => inventuraPregledCsvVrstice([], NOW.toISOString())).toThrow(
      /prazen seznam artiklov ne nastaja/,
    )
  })

  it('ne-polje vhod → TypeError', () => {
    expect(() =>
      inventuraPregledCsvVrstice('ni polje' as unknown as InventuraArtikel[], NOW.toISOString()),
    ).toThrow(TypeError)
  })

  it('podvojen id → TypeError (identiteta mora biti edinstvena — EN VIR inventuraPregled)', () => {
    const podvojeni: InventuraArtikel[] = [ARTIKLI[0], { ...ARTIKLI[1], id: 'a-1' }]
    expect(() => inventuraPregledCsvVrstice(podvojeni, NOW.toISOString())).toThrow(
      /podvojen id artikla a-1/,
    )
  })

  it('podvojena šifra → TypeError (šifra @unique v shemi — EN VIR resnica)', () => {
    const podvojene: InventuraArtikel[] = [ARTIKLI[0], { ...ARTIKLI[0], id: 'a-9' }]
    expect(() => inventuraPregledCsvVrstice(podvojene, NOW.toISOString())).toThrow(
      /podvojena šifra materiala WPC-120-A/,
    )
  })

  it('pokvaren artikel (negativna zaloga) → TypeError z indeksom krivca', () => {
    const pokvareni: InventuraArtikel[] = [
      ARTIKLI[0],
      { ...ARTIKLI[1], kolicinaZaloga: -1 },
    ]
    expect(() => inventuraPregledCsvVrstice(pokvareni, NOW.toISOString())).toThrow(
      /preveriInventuraArtikel \(1\)/,
    )
  })

  it('izvozeno prazen niz → TypeError (F4: klicatelj izpelje kanonični ISO iz veljavnega now)', () => {
    expect(() => inventuraPregledCsvVrstice(ARTIKLI, '')).toThrow(/izvozeno/)
  })

  it('now ne-Date / pokvaren Date → TypeError (inventuraPregledCsv + Filename)', () => {
    expect(() => inventuraPregledCsv(ARTIKLI, 'ni datum' as unknown as Date)).toThrow(/veljaven now/)
    expect(() => inventuraPregledCsv(ARTIKLI, new Date('ni datum'))).toThrow(/veljaven now/)
    expect(() => inventuraPregledCsvFilename('ni datum' as unknown as Date)).toThrow(/veljaven now/)
    expect(() => inventuraPregledCsvFilename(new Date('ni datum'))).toThrow(/veljaven now/)
  })
})

describe('R286 — inventura-pregled CSV: determinizem (F4)', () => {
  it('BOM efbbbf + "\\n" zaključki + VSA polja citirana (vodja-csv vzorec)', () => {
    const { csv } = inventuraPregledCsv(ARTIKLI, NOW)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).not.toContain('\r')
    // Vsa polja citirana — vsaka vrstica se začne s '"':
    const lines = csv.slice(1).split('\n')
    for (const l of lines) expect(l.startsWith('"')).toBe(true)
    // Narekovaj podvojen (naziv z '"' → '""'):
    const zNarekovajem: InventuraArtikel[] = [
      { ...ARTIKLI[0], naziv: 'WPC "premium" profil' },
    ]
    const { csv: csv2 } = inventuraPregledCsv(zNarekovajem, NOW)
    expect(csv2).toContain('"WPC ""premium"" profil"')
  })

  it('akcijski sort = f(MNOŽICA) — determinističen tudi ob vmešanem vhodnem redu (EN VIR sortirajInventura)', () => {
    const obrnjeno = [...ARTIKLI].reverse()
    const { csv: csv1 } = inventuraPregledCsv(ARTIKLI, NOW)
    const { csv: csv2 } = inventuraPregledCsv(obrnjeno, NOW)
    expect(csv1).toBe(csv2)
  })

  it('enak vhod (artikli + now) = bajtno enak CSV (dve progi, isti rezultat)', () => {
    const { csv: c1 } = inventuraPregledCsv(ARTIKLI, NOW)
    const { csv: c2 } = inventuraPregledCsv([...ARTIKLI], new Date('2026-09-29T15:30:00Z'))
    expect(c1).toBe(c2)
  })

  it('vrstic = glava + podatkovne vrstice (3 artikli → 4)', () => {
    const { vrstic } = inventuraPregledCsv(ARTIKLI, NOW)
    expect(vrstic).toBe(4)
  })
})

describe('R286 — inventura-pregled CSV: ime datoteke (F4 — pariteta z R270 PDF imenom)', () => {
  it('Inventura-pregled-YYYY-MM-DD.csv — ISTI stem kot PDF, drug medij', () => {
    expect(inventuraPregledCsvFilename(NOW)).toBe('Inventura-pregled-2026-09-29.csv')
  })

  it('dnevi/meseci < 10 z vodilno ničlo (determinističen žig — brez locale)', () => {
    expect(inventuraPregledCsvFilename(new Date('2026-03-05T08:00:00Z'))).toBe(
      'Inventura-pregled-2026-03-05.csv',
    )
  })
})
