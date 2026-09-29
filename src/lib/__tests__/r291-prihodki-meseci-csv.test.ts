// R291 — PRIHODKI PO MESECIH CSV (8. člen izvozne družine) + MANDATORY STIL
// strazar.
// ---------------------------------------------------------------------------
//   • lib prihodki-meseci-csv: EN VIR z sekcijo R290 (vhod = ISTI
//     PrihodkiMeseciPovzetek, lib NE računa znova — WYSIWYG po konstrukciji);
//     števila = kolicinaNiz (ISTI strojni kanon kot R286 inventura); meta
//     vrstice po podatkih (kanon R172): Obseg + Skupaj plačano + POGOJNI
//     'V teku' + POGOJNI 'Stornirani' + 'Izvoženo ob' (kanonični ISO —
//     vzorec R286); fail-closed ×8; BOM + '\n'; determinizem (now KOT
//     parameter; vrstice v ISTEM vrstnem redu kot vhod — lib NE preureja).
//   • strazar (statika invoice-manager): gumb VEDNO viden (kanon R232) +
//     fail-closed toast pri 0 mesecih (R250 vzorec) + EN VIR klic (isti
//     meseciPovzetek.p) + FileSpreadsheet aria-hidden + mini stolpci
//     (deterministična širina, žetoni, aria-hidden) + hex baseline 6.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  prihodkiMeseciCsv,
  prihodkiMeseciCsvFilename,
  prihodkiMeseciCsvVrstice,
  PRIHODKI_MESECI_CSV_GLAVA,
} from '@/lib/prihodki-meseci-csv'
import type { PrihodkiMeseciPovzetek } from '@/lib/prihodki-meseci'

const povzetek = (over: Partial<PrihodkiMeseciPovzetek> = {}): PrihodkiMeseciPovzetek => ({
  meseci: [
    { mesec: '2026-08', stRacunov: 2, prihodki: 3500 },
    { mesec: '2026-09', stRacunov: 3, prihodki: 4123.55 },
  ],
  skupajPrihodki: 7623.55,
  skupajRacunov: 5,
  stIzdanih: 1,
  znesekIzdanih: 900.5,
  stOsnutkov: 2,
  stStorniranih: 1,
  ...over,
})

describe('R291 prihodkiMeseciCsvVrstice — tabela + meta', () => {
  it('glava (3 stolpci) + podatkovne vrstice v ISTEM vrstnem redu (lib NE preureja)', () => {
    const v = prihodkiMeseciCsvVrstice(povzetek(), '2026-09-30T10:00:00.000Z')
    expect(v[0]).toBe('"Mesec","Plačani računi","Prihodki (EUR)"')
    expect(v[1]).toBe('"2026-08","2","3500"')
    expect(v[2]).toBe('"2026-09","3","4123.55"')
    expect(PRIHODKI_MESECI_CSV_GLAVA).toHaveLength(3)
  })

  it('števila = kolicinaNiz kanon (celo število brez decimalk, sicer toFixed(2))', () => {
    const v = prihodkiMeseciCsvVrstice(
      povzetek({ meseci: [{ mesec: '2026-01', stRacunov: 1, prihodki: 0 }] }),
      '2026-09-30T10:00:00.000Z',
    )
    expect(v[1]).toBe('"2026-01","1","0"')
    const w = prihodkiMeseciCsvVrstice(
      povzetek({ meseci: [{ mesec: '2026-01', stRacunov: 1, prihodki: 9.1 }] }),
      '2026-09-30T10:00:00.000Z',
    )
    expect(w[1]).toBe('"2026-01","1","9.10"')
  })

  it('meta vrstice: prazna ločilna + Obseg + Skupaj + Izvoženo ob (ISO žig)', () => {
    const v = prihodkiMeseciCsvVrstice(povzetek(), '2026-09-30T10:00:00.000Z')
    const meta = v.slice(v.indexOf(''))
    expect(meta[1]).toBe('"Obseg","Vsi plačani računi po mesecih (iz seznama računov)"')
    expect(meta[2]).toBe('"Skupaj plačano","5","7623.55"')
    expect(meta[meta.length - 1]).toBe('"Izvoženo ob","2026-09-30T10:00:00.000Z"')
  })

  it('POGOJNA vrstica V teku (samo stIzdanih > 0) + POGOJNA Stornirani (samo > 0)', () => {
    const polni = prihodkiMeseciCsvVrstice(povzetek(), '2026-09-30T10:00:00.000Z')
    expect(polni.some((l) => l.startsWith('"V teku (izdani, neplačani)","1","900.50"'))).toBe(true)
    expect(polni.some((l) => l.startsWith('"Stornirani (izključeni iz zneskov)","1",'))).toBe(true)
    const brez = prihodkiMeseciCsvVrstice(
      povzetek({ stIzdanih: 0, znesekIzdanih: 0, stStorniranih: 0 }),
      '2026-09-30T10:00:00.000Z',
    )
    expect(brez.some((l) => l.includes('V teku'))).toBe(false)
    expect(brez.some((l) => l.includes('Stornirani'))).toBe(false)
  })

  it('prazni meseci = veljaven CSV (glava + meta, brez lažnih 0-vrstic)', () => {
    const v = prihodkiMeseciCsvVrstice(
      povzetek({ meseci: [], skupajPrihodki: 0, skupajRacunov: 0, stIzdanih: 0, znesekIzdanih: 0, stStorniranih: 0 }),
      '2026-09-30T10:00:00.000Z',
    )
    expect(v).toHaveLength(5) // glava + ločilna + Obseg + Skupaj + Izvoženo ob
    expect(v.filter((l) => l.startsWith('"2026-'))).toHaveLength(0)
  })
})

describe('R291 prihodkiMeseciCsv / Filename — BOM, determinizem, fail-closed', () => {
  it('BOM + \\n zaključki + vrstic števec', () => {
    const { csv, vrstic } = prihodkiMeseciCsv(povzetek(), new Date('2026-09-30T10:00:00.000Z'))
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.includes('\r')).toBe(false)
    const lines = csv.slice(1).split('\n')
    expect(lines).toHaveLength(vrstic)
    expect(vrstic).toBe(9) // glava + 2 podatkovni + ločilna + Obseg + Skupaj + V teku + Stornirani + Izvoženo
  })

  it('determinizem: isti vhod + isti now = bajtno identičen CSV', () => {
    const a = prihodkiMeseciCsv(povzetek(), new Date('2026-09-30T10:00:00.000Z')).csv
    const b = prihodkiMeseciCsv(povzetek(), new Date('2026-09-30T10:00:00.000Z')).csv
    expect(a).toBe(b)
  })

  it('fail-closed: ne-objektni povzetek / ne-polje meseci / pokvaren mesec / negativno / NaN → TypeError', () => {
    expect(() => prihodkiMeseciCsvVrstice(null as unknown as PrihodkiMeseciPovzetek, '2026-09-30T10:00:00.000Z')).toThrow(TypeError)
    expect(() => prihodkiMeseciCsvVrstice({ ...povzetek(), meseci: 'ne' } as unknown as PrihodkiMeseciPovzetek, '2026-09-30T10:00:00.000Z')).toThrow(TypeError)
    expect(() => prihodkiMeseciCsvVrstice(povzetek({ meseci: [{ mesec: '2026-9', stRacunov: 1, prihodki: 1 }] } as unknown as PrihodkiMeseciPovzetek), '2026-09-30T10:00:00.000Z')).toThrow(TypeError)
    expect(() => prihodkiMeseciCsvVrstice(povzetek({ meseci: [{ mesec: '2026-01', stRacunov: -1, prihodki: 1 }] } as unknown as PrihodkiMeseciPovzetek), '2026-09-30T10:00:00.000Z')).toThrow(TypeError)
    expect(() => prihodkiMeseciCsvVrstice(povzetek({ meseci: [{ mesec: '2026-01', stRacunov: 1, prihodki: Number.NaN }] } as unknown as PrihodkiMeseciPovzetek), '2026-09-30T10:00:00.000Z')).toThrow(TypeError)
    expect(() => prihodkiMeseciCsvVrstice(povzetek(), 'ne-obstojeci-zig')).toThrow(TypeError)
    expect(() => prihodkiMeseciCsv(povzetek(), Number.NaN as unknown as Date)).toThrow(TypeError)
    expect(() => prihodkiMeseciCsvFilename(Number.NaN as unknown as Date)).toThrow(TypeError)
  })

  it('filename = Prihodki-meseci-<YYYY-MM-DD>.csv (družinski vzorec, now KOT parameter)', () => {
    expect(prihodkiMeseciCsvFilename(new Date('2026-09-30T10:00:00.000Z'))).toBe('Prihodki-meseci-2026-09-30.csv')
  })
})

// ---------------------------------------------------------------------------
// STRAŽAR — invoice-manager žičenje (statika)
// ---------------------------------------------------------------------------

const im = readFileSync(
  join(process.cwd(), 'src', 'components', 'roksal', 'invoice-manager.tsx'),
  'utf8',
)

describe('R291 strazar — prihodki-meseci CSV žičenje (invoice-manager)', () => {
  it('EN VIR klic: lib dobi ISTI meseciPovzetek.p (NE računa znova)', () => {
    expect(im).toContain("from '@/lib/prihodki-meseci-csv'")
    expect(im).toContain('prihodkiMeseciCsv(p, now)')
    expect(im).toContain('const p = meseciPovzetek.p!')
  })

  it('gumb VEDNO viden: aria + title + press-scale + focus ring + FileSpreadsheet aria-hidden', () => {
    expect(im).toContain('aria-label="Izvozi prihodke po mesecih kot CSV"')
    expect(im).toContain('Prihodki po mesecih kot CSV — ista resnica kot sekcija (skupaj + v teku + stornirani)')
    expect(im).toContain('FileSpreadsheet aria-hidden="true"')
    expect(im).toContain('press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
  })

  it('fail-closed toast pri 0 mesecih (NIČ datoteke — R250 vzorec)', () => {
    expect(im).toContain("toast({ title: 'Ni plačanih računov', description: 'CSV se izvozi ob prvem plačilu.' })")
  })

  it('uspešni toast z imenom datoteke + resničnim povzetkom (WYSIWYG)', () => {
    expect(im).toContain('Prihodki po mesecih prenešeni v CSV (')
    expect(im).toContain('skupaj plačano')
  })

  it('MANDATORY STIL: mini stolpci — deterministična širina (največji mesec), žetoni, aria-hidden', () => {
    expect(im).toContain('najvecji > 0 ? Math.min(100, (m.prihodki / najvecji) * 100) : 0')
    expect(im).toContain('bg-roksal-navy/30')
    expect(im).toContain('% največjega meseca')
    expect(im).toContain('<div aria-hidden="true" className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">')
  })

  it('hex baseline ostaja 6 (0 novih hex — žetoni)', () => {
    const hexi = im.match(/#[0-9a-fA-F]{6}/g) ?? []
    expect(hexi).toHaveLength(6)
  })
})
