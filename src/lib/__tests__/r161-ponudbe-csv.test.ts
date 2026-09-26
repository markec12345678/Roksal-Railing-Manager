// R161 — ponudbe-csv enote + regresija (izvoz sledenja ponudbam).
// ---------------------------------------------------------------------------
// Družina izvozov (nagibi R157, zapisnik R158, CRM R159, ekipa R160) — isti
// standard: determinizem (2 klica = enak izhod), status besedila = ISTA kot UI,
// CSV injekcija zaščita, null → prazen stolpec (nikoli 'null' besedilo),
// fail-closed TypeError na pokvarjenih/neznanih podatkih, striktno ime
// datoteke. Novost R161: "Stanje spomnika" je odvisno od časa — zato referenčni
// datum (danes, YYYY-MM-DD) pride kot parameter in je v testih FIKSEN
// (100 % determinizem, neodvisno od časovnega pasu).
import { describe, expect, it } from 'vitest'
import {
  buildPonudbeCsv,
  ponudbeCsvFilename,
  ponudbeLabel,
  PONUDBE_STATUS_LABELS,
  stanjeSpomnika,
  type PonudbaCsvRow,
} from '../ponudbe-csv'

const DANES = '2026-09-26'

const row = (over: Partial<PonudbaCsvRow> = {}): PonudbaCsvRow => ({
  nazivProjekta: 'Ponudba Balkon 12',
  stranka: 'Jure Novak',
  status: 'V_TEKU',
  followUpDate: '2026-09-20T09:00:00.000Z',
  followUpOpomba: 'Pokliči stranko — sledenje ponudbe (+3 dni)',
  datumMontaze: null,
  ...over,
})

describe('ponudbe-csv: status besedila = en vir resnice z UI', () => {
  it('vsebuje natanko štiri znane statuse z istimi besedili kot UI značke', () => {
    expect(Object.keys(PONUDBE_STATUS_LABELS).sort()).toEqual(
      ['NACRTOVANO', 'USTAVLJENO', 'V_TEKU', 'ZAKLJUCENO'].sort(),
    )
    expect(PONUDBE_STATUS_LABELS.NACRTOVANO).toBe('Načrtovano')
    expect(PONUDBE_STATUS_LABELS.V_TEKU).toBe('V teku')
    expect(PONUDBE_STATUS_LABELS.ZAKLJUCENO).toBe('Zaključeno')
    expect(PONUDBE_STATUS_LABELS.USTAVLJENO).toBe('Ustavljeno')
  })
})

describe('buildPonudbeCsv', () => {
  it('BOM + glava + ena vrstica (status preslikan v UI besedilo)', () => {
    const { csv, vrstic } = buildPonudbeCsv([row()], DANES)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Projekt,Stranka,Status,Stanje spomnika,Spomnik datum,Spomnik opomba,Datum montaže')
    expect(vrstic).toBe(1)
    expect(csv).toContain('"Ponudba Balkon 12","Jure Novak","V teku","Zapadel",20.09.2026')
  })

  it('determinizem: isti vhod + isti referenčni datum → enak izhod (2 klica)', () => {
    const a = buildPonudbeCsv([row(), row({ nazivProjekta: 'Z 2', followUpDate: null })], DANES)
    const b = buildPonudbeCsv([row(), row({ nazivProjekta: 'Z 2', followUpDate: null })], DANES)
    expect(a.csv).toBe(b.csv)
    expect(a.vrstic).toBe(b.vrstic)
  })

  it('CSV injekcija: navedki in vejice v imenu/opombi so citirani (narekovaj podvojen)', () => {
    const { csv } = buildPonudbeCsv(
      [row({ nazivProjekta: 'Ponudba "Zelo, posebna"', followUpOpomba: 'Rekla je "pokliči" danes' })],
      DANES,
    )
    expect(csv).toContain('"Ponudba ""Zelo, posebna"""')
    expect(csv).toContain('"Rekla je ""pokliči"" danes"')
  })

  it('null stranka/opomba/spomnik → PRAZNI stolpci (nikoli "null" besedilo)', () => {
    const { csv } = buildPonudbeCsv(
      [row({ stranka: null, followUpDate: null, followUpOpomba: null })],
      DANES,
    )
    const line = csv.split('\n')[1]
    expect(line).toBe('"Ponudba Balkon 12",,"V teku","Brez spomnika",,,')
    expect(csv).not.toContain('null')
  })

  it('stanja spomnika: Zapadel / Danes / Kmalu / Planirano glede na referenčni datum', () => {
    const stanja = (fd: string) =>
      buildPonudbeCsv([row({ followUpDate: fd })], DANES).csv.split('\n')[1].split(',')[3]
    expect(stanja('2026-09-25T10:00:00Z')).toBe('"Zapadel"')
    expect(stanja('2026-09-26T00:00:00Z')).toBe('"Danes"')
    expect(stanja('2026-09-28T00:00:00Z')).toBe('"Kmalu"')
    expect(stanja('2026-09-29T00:00:00Z')).toBe('"Kmalu"')
    expect(stanja('2026-09-30T00:00:00Z')).toBe('"Planirano"')
  })

  it('stanjeSpomnika: null → Brez spomnika, date-only in polni ISO enakovredna', () => {
    expect(stanjeSpomnika(null, DANES)).toBe('Brez spomnika')
    expect(stanjeSpomnika('2026-09-26', DANES)).toBe('Danes')
    expect(stanjeSpomnika('2026-09-26T22:30:00.000Z', DANES)).toBe('Danes')
    expect(stanjeSpomnika('2026-10-01', DANES)).toBe('Planirano')
  })

  it('datumMontaze izpisan ko obstaja (date-only → DD.MM.YYYY)', () => {
    const { csv } = buildPonudbeCsv([row({ datumMontaze: '2026-10-15' })], DANES)
    expect(csv).toContain('20.09.2026,"Pokliči stranko — sledenje ponudbe (+3 dni)",15.10.2026')
  })

  it('prazno polje → samo glava', () => {
    const { csv, vrstic } = buildPonudbeCsv([], DANES)
    expect(vrstic).toBe(0)
    expect(csv).toBe('\uFEFFProjekt,Stranka,Status,Stanje spomnika,Spomnik datum,Spomnik opomba,Datum montaže')
  })

  it('fail-closed: neznani status → TypeError (ne tiho ugibanje)', () => {
    expect(() => buildPonudbeCsv([row({ status: 'POLJUBEN' })], DANES)).toThrow(TypeError)
  })

  it('fail-closed: prazen/brez ime projekta → TypeError', () => {
    expect(() => buildPonudbeCsv([row({ nazivProjekta: '' })], DANES)).toThrow(TypeError)
    expect(() => buildPonudbeCsv([row({ nazivProjekta: '   ' })], DANES)).toThrow(TypeError)
  })

  it('fail-closed: pokvarjen datum → TypeError', () => {
    expect(() => buildPonudbeCsv([row({ followUpDate: 'ni datum' })], DANES)).toThrow(TypeError)
    expect(() => buildPonudbeCsv([row({ datumMontaze: '2026-13-99' })], DANES)).toThrow(TypeError)
  })

  it('fail-closed: ne-polje ali pokvaren referenčni datum → TypeError', () => {
    expect(() => buildPonudbeCsv('ne-polje' as unknown as PonudbaCsvRow[], DANES)).toThrow(TypeError)
    expect(() => buildPonudbeCsv([row()], '26.09.2026')).toThrow(TypeError)
  })
})

describe('ponudbeCsvFilename', () => {
  it('deterministično ime ponudbe_<YYYY-MM-DD>.csv', () => {
    expect(ponudbeCsvFilename('2026-09-26')).toBe('ponudbe_2026-09-26.csv')
    expect(ponudbeCsvFilename('2026-09-26')).toBe(ponudbeCsvFilename('2026-09-26'))
  })
  it('striktna validacija: zavrne drugačne oblike', () => {
    expect(() => ponudbeCsvFilename('')).toThrow(TypeError)
    expect(() => ponudbeCsvFilename('26.09.2026')).toThrow(TypeError)
    expect(() => ponudbeCsvFilename('2026-9-26')).toThrow(TypeError)
  })
})

describe('ponudbeLabel (slovenska sklanjatev za aria-label)', () => {
  it('1/21/31 → ponudba', () => {
    expect(ponudbeLabel(1)).toBe('1 ponudba')
    expect(ponudbeLabel(21)).toBe('21 ponudba')
    expect(ponudbeLabel(101)).toBe('101 ponudba')
  })
  it('2/22 → ponudbi', () => {
    expect(ponudbeLabel(2)).toBe('2 ponudbi')
    expect(ponudbeLabel(22)).toBe('22 ponudbi')
  })
  it('3/4/23/24 → ponudbe', () => {
    expect(ponudbeLabel(3)).toBe('3 ponudbe')
    expect(ponudbeLabel(4)).toBe('4 ponudbe')
    expect(ponudbeLabel(23)).toBe('23 ponudbe')
  })
  it('5–11, 12–14, 12 → ponudb', () => {
    expect(ponudbeLabel(5)).toBe('5 ponudb')
    expect(ponudbeLabel(11)).toBe('11 ponudb')
    expect(ponudbeLabel(12)).toBe('12 ponudb')
    expect(ponudbeLabel(13)).toBe('13 ponudb')
    expect(ponudbeLabel(14)).toBe('14 ponudb')
    expect(ponudbeLabel(0)).toBe('0 ponudb')
  })
  it('fail-closed: negativno/ne-celo število → TypeError', () => {
    expect(() => ponudbeLabel(-1)).toThrow(TypeError)
    expect(() => ponudbeLabel(1.5)).toThrow(TypeError)
  })
})
