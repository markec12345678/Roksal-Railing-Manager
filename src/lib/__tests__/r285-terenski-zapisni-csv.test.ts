// R285 — testi: TERENSKI ZAPISNI LIST CSV (issue #15 §3, worklog i5b).
// (A) STOLPČNA PARITETA z R186 arhivom PO KONSTRUKCIJI (Y2/Y8): glava =
//     arhivska glava + 5 dodatnih; vrstica = arhivska vrstica + 5 dodatnih —
//     EN VIR meritevVrstica/meritveCsvVrstice, NI ponovne implementacije;
// (B) Y3 fail-closed ISTI kontrakt kot R284/R269 (prazen/podvojen/pokvaren
//     → TypeError); fizični stolpci VEDNO prazne celice (NE null/0/—);
// (C) Y4 determinizem (BOM + '\n', čista funkcija); Y5 kode verbatim
//     (status/tip fallbacki kot R186, verzija surovo število, vir koda);
// (D) ime datoteke (pariteta PDF imena — isti stem, drug medij);
// (E) referenčna fikstura r283 (EN VIR — issue #15 §1 skelet) → §3 CSV
//     resnica (m1 kot 90 legacy, m2/m3 brez kota = prazna celica);
// (F) strukturna zaščita: R186 arhiv kontrakt ostaja 19-stolpčen (NIČ).
import { describe, expect, it } from 'vitest'
import {
  zapisniListCsv,
  zapisniListCsvVrstice,
  zapisniListCsvFilename,
  ZAPISNI_CSV_DODATNI,
  ZAPISNI_CSV_STOLPCEV,
} from '@/lib/terenski-zapisni-csv'
import type { TerenskiZapisniVnos } from '@/lib/terenski-zapisni-pdf'
import { meritveCsvVrstice, meritevVrstica } from '@/lib/meritve-csv'
import { terenskiZapisniPdfFilename } from '@/lib/terenski-zapisni-pdf'
import fikstura from '../../../scripts/r283-referencni-fiksture.json'

const NOW = new Date('2026-09-29T08:00:00.000Z')

function meritev(razlik: Partial<TerenskiZapisniVnos>): TerenskiZapisniVnos {
  return {
    id: 'm-x',
    createdAt: '2026-09-20T10:00:00.000Z',
    dolzinaMm: 3450,
    visinaMm: 1000,
    status: 'OSNUTEK',
    tipMeritve: 'RAZDALJA',
    ...razlik,
  }
}

/** Razišči citirano CSV vrstico (narekovaji podvojeni — vzorec vodja-csv). */
function razcelici(vrstica: string): string[] {
  const celice: string[] = []
  let trenutna = ''
  let vNavedkah = false
  for (let i = 0; i < vrstica.length; i++) {
    const c = vrstica[i]
    if (vNavedkah) {
      if (c === '"' && vrstica[i + 1] === '"') {
        trenutna += '"'
        i++
      } else if (c === '"') {
        vNavedkah = false
      } else {
        trenutna += c
      }
    } else if (c === '"') {
      vNavedkah = true
    } else if (c === ',') {
      celice.push(trenutna)
      trenutna = ''
    } else {
      trenutna += c
    }
  }
  celice.push(trenutna)
  return celice
}

describe('R285 — stolpčna pariteta z R186 arhivom po konstrukciji (Y2/Y8)', () => {
  it('glava = arhivska 19-stolpčna glava (startsWith bajtno) + 5 dodatnih', () => {
    const arhiv = meritveCsvVrstice([])
    const zapisni = zapisniListCsvVrstice([meritev({})])
    expect(zapisni[0].startsWith(arhiv[0] + ',')).toBe(true)
    const glava = razcelici(zapisni[0])
    expect(glava).toHaveLength(24)
    expect(glava.slice(0, 19)).toEqual(razcelici(arhiv[0]))
    expect(glava.slice(19)).toEqual([...ZAPISNI_CSV_DODATNI])
  })

  it('vrstica = arhivska vrstica ISTEGA vhoda (startsWith bajtno) + 5 dodatnih — EN VIR', () => {
    const m = meritev({ id: 'm1', oznaka: 'REF-A', vir: 'MANUAL', verzija: 2, kotStopinje: 90 })
    const arhivVrstica = meritveCsvVrstice([m])[1]
    const zapisniVrstica = zapisniListCsvVrstice([m])[1]
    expect(zapisniVrstica.startsWith(arhivVrstica + ',')).toBe(true)
    const celice = razcelici(zapisniVrstica)
    expect(celice).toHaveLength(24)
    expect(celice.slice(0, 19)).toEqual(razcelici(arhivVrstica))
  })

  it('konstanta kontrakta: 24 stolpcev = 19 R186 + 5 dodatnih (verzija, vir, fizicna_ref_mm, delta_mm, zapiski_terena)', () => {
    expect(ZAPISNI_CSV_STOLPCEV).toBe(24)
    expect([...ZAPISNI_CSV_DODATNI]).toEqual([
      'verzija',
      'vir',
      'fizicna_ref_mm',
      'delta_mm',
      'zapiski_terena',
    ])
  })

  it('R186 arhiv kontrakt NI dotaknjen — arhivska vrstica ostaja 19-stolpčna (strukturna zaščita)', () => {
    const m = meritev({ id: 'm1', opomba: 'arhiv ostaja arhiv' })
    const arhiv = meritveCsvVrstice([m])
    expect(arhiv).toHaveLength(2) // glava + 1 vrstica
    expect(razcelici(arhiv[0])).toHaveLength(19)
    expect(razcelici(arhiv[1])).toHaveLength(19)
    // izvoz = ISTI graditelj kot prej (NI drifta skozi novo družino)
    expect(arhiv[1]).toBe(meritevVrstica(m).map((c) => `"${c}"`).join(','))
  })
})

describe('R285 — fizični stolpci + kode verbatim (Y1/Y3/Y5)', () => {
  it('fizični stolpci VEDNO prazne celice "" — NE null, NE 0, NE "—" (izpolni lastnik v Excelu)', () => {
    const vrstice = zapisniListCsvVrstice([
      meritev({ id: 'm1', vir: 'MANUAL', verzija: 1, kotStopinje: 90 }),
    ])
    const celice = razcelici(vrstice[1])
    expect(celice[21]).toBe('') // fizicna_ref_mm
    expect(celice[22]).toBe('') // delta_mm
    expect(celice[23]).toBe('') // zapiski_terena
  })

  it('verzija = surovo število kot niz (NI PDF "v"-predpone); null = prazna celica', () => {
    const zVerz = razcelici(
      zapisniListCsvVrstice([meritev({ id: 'm1', verzija: 3 })])[1],
    )
    expect(zVerz[19]).toBe('3')
    const brezVerz = razcelici(
      zapisniListCsvVrstice([meritev({ id: 'm1', verzija: null })])[1],
    )
    expect(brezVerz[19]).toBe('')
  })

  it('vir = KODA VERBATIM (MANUAL/PHOTO_CV/ARCORE_DEPTH); null = prazna celica (NI prevajanja v labele)', () => {
    for (const vir of ['MANUAL', 'PHOTO_CV', 'ARCORE_DEPTH'] as const) {
      const celice = razcelici(
        zapisniListCsvVrstice([meritev({ id: 'm1', vir })])[1],
      )
      expect(celice[20]).toBe(vir)
    }
    const brez = razcelici(zapisniListCsvVrstice([meritev({ id: 'm1', vir: null })])[1])
    expect(brez[20]).toBe('')
  })

  it('status/tip = ISTI fallbacki kot R186 (izvoženo = zaslon — OSNUTEK/RAZDALJA)', () => {
    const celice = razcelici(zapisniListCsvVrstice([meritev({ id: 'm1' })])[1])
    expect(celice[16]).toBe('OSNUTEK')
    expect(celice[2]).toBe('RAZDALJA')
  })

  it('kot null = prazna celica (R186 fallback pariteta — iskren odpad, NI "—")', () => {
    const celice = razcelici(
      zapisniListCsvVrstice([meritev({ id: 'm1', kotStopinje: null })])[1],
    )
    expect(celice[5]).toBe('') // kot_stopinje — ISTI odpad kot arhiv
  })

  it('citiranje: opomba z narekovajem → podvojen narekovaj (vzorec vodja-csv)', () => {
    const vrstice = zapisniListCsvVrstice([
      meritev({ id: 'm1', opomba: 'ref. "prave" mere' }),
    ])
    expect(vrstice[1]).toContain('"ref. ""prave"" mere"')
  })
})

describe('R285 — fail-closed (Y3 — ISTI kontrakt kot R284/R269)', () => {
  it('prazen seznam → TypeError (iskren toast — nič praznih datotek)', () => {
    expect(() => zapisniListCsvVrstice([])).toThrow(TypeError)
    expect(() => zapisniListCsvVrstice([])).toThrow(/prazen seznam/)
  })

  it('negativna dolžina → TypeError prek R186/R269 validacije (EN VIR — NI lastne tolerance)', () => {
    expect(() =>
      zapisniListCsvVrstice([meritev({ id: 'm1', dolzinaMm: -1 })]),
    ).toThrow(TypeError)
  })

  it('podvojen id → TypeError (dedup EN VIR zapisniListVrste)', () => {
    expect(() =>
      zapisniListCsvVrstice([
        meritev({ id: 'm1' }),
        meritev({ id: 'm1', oznaka: 'dvojnik' }),
      ]),
    ).toThrow(TypeError)
  })

  it('neznani vir → TypeError (pokvaren vir NIKOLI tiho na list)', () => {
    expect(() =>
      zapisniListCsvVrstice([meritev({ id: 'm1', vir: 'NEZNAN_VIR' })]),
    ).toThrow(TypeError)
  })

  it('neznani status → TypeError', () => {
    expect(() =>
      zapisniListCsvVrstice([meritev({ id: 'm1', status: 'ZGODBA' })]),
    ).toThrow(TypeError)
  })

  it('ne-polje → TypeError', () => {
    expect(() =>
      zapisniListCsvVrstice('ne-polje' as unknown as TerenskiZapisniVnos[]),
    ).toThrow(TypeError)
  })
})

describe('R285 — determinizem + sort EN VIR (Y4)', () => {
  it('akcijski sort = R269 EN VIR: OSNUTEK pred POTRJENA ne glede na vrstni red vhoda', () => {
    const vrstice = zapisniListCsvVrstice([
      meritev({ id: 'm-potrjena', status: 'POTRJENA', oznaka: 'B' }),
      meritev({ id: 'm-osnutek', status: 'OSNUTEK', oznaka: 'A' }),
    ])
    // preverba prek oznake (drugi stolpec): OSNUTEK (A) prihaja prvi
    expect(razcelici(vrstice[1])[1]).toBe('A')
    expect(razcelici(vrstice[2])[1]).toBe('B')
  })

  it('BOM + "\\n" zaključki (vzorec meritveCsv R186)', () => {
    const { csv, vrstic } = zapisniListCsv([meritev({ id: 'm1' }), meritev({ id: 'm2', oznaka: 'B' })])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.endsWith('\n')).toBe(false)
    expect(csv.split('\n')).toHaveLength(3)
    expect(vrstic).toBe(3) // glava + 2
  })

  it('determinizem: isti vhod → bajtno enak niz (dve progi)', () => {
    const meritve = [
      meritev({ id: 'm1', vir: 'MANUAL', verzija: 1, kotStopinje: 90 }),
      meritev({ id: 'm2', vir: 'PHOTO_CV', verzija: 2, oznaka: 'B', status: 'POTRJENA' }),
    ]
    expect(zapisniListCsv(meritve).csv).toBe(zapisniListCsv(meritve).csv)
  })
})

describe('R285 — ime datoteke (D — pariteta PDF imena)', () => {
  it('Terenski-zapisni-YYYY-MM-DD.csv — ISTI stem kot PDF, drug medij', () => {
    expect(zapisniListCsvFilename(NOW)).toBe('Terenski-zapisni-2026-09-29.csv')
    expect(terenskiZapisniPdfFilename(NOW)).toBe('Terenski-zapisni-2026-09-29.pdf')
    expect(zapisniListCsvFilename(NOW).replace(/\.csv$/, '.pdf')).toBe(
      terenskiZapisniPdfFilename(NOW),
    )
  })

  it('ne-Date / pokvaren Date → TypeError (fail-closed)', () => {
    expect(() => zapisniListCsvFilename('ne-date' as unknown as Date)).toThrow(TypeError)
    expect(() => zapisniListCsvFilename(new Date('ni-datum'))).toThrow(TypeError)
  })
})

describe('R285 — referenčna fikstura r283 (E — issue #15 §1 skelet → §3 CSV)', () => {
  /** Fikstura meritve → MeritveTerenVnos (zrcali component DTO pruning). */
  function fiksturaVnos(m: {
    id: string
    ts: string
    dolzinaMm: number
    visinaMm: number
    vir: string
    status: string
    verzija: number
    arMetadata: Record<string, unknown>
  }): TerenskiZapisniVnos {
    const ar = m.arMetadata as { tipMeritve?: string; oznaka?: string; opomba?: string; kot?: unknown }
    return {
      id: m.id,
      createdAt: m.ts,
      dolzinaMm: m.dolzinaMm,
      visinaMm: m.visinaMm,
      tipMeritve: ar.tipMeritve ?? null,
      oznaka: ar.oznaka ?? null,
      status: m.status,
      lokacija: null,
      opomba: ar.opomba ?? null,
      verzija: m.verzija,
      vir: m.vir,
      kotStopinje: typeof ar.kot === 'number' ? ar.kot : null,
    }
  }

  it('skelet m1/m2/m3 → 3 vrstice + glava; viri/verzije verbatim; m1 kot 90 legacy', () => {
    const meritve = fikstura.meritve.map(fiksturaVnos)
    const { csv, vrstic } = zapisniListCsv(meritve)
    expect(vrstic).toBe(4) // glava + 3
    const vrstice = csv.split('\n')
    const m1 = razcelici(vrstice[1])
    expect(m1[0]).toBe(new Date(fikstura.meritve[0].ts).toISOString()) // kanonični ISO (R186 arhiv kontrakt)
    expect(m1[19]).toBe(String(fikstura.meritve[0].verzija))
    expect(m1[20]).toBe(fikstura.meritve[0].vir)
    expect(m1[21]).toBe('') // fizicna_ref_mm — prazna (izpolni lastnik)
    expect(m1[22]).toBe('') // delta_mm
    expect(m1[23]).toBe('') // zapiski_terena
    // §3 resnica: vsi trije viri v CSV (pariteta R283 F3 pokritost)
    const viri = vrstice.slice(1).map((v) => razcelici(v)[20])
    expect(viri).toEqual(['MANUAL', 'PHOTO_CV', 'ARCORE_DEPTH'])
  })
})
