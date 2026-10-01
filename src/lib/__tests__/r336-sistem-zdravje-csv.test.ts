// R336 — 63. člen (issue #1 IZVOZI družina): SISTEM — ZDRAVJE CSV testi.
// ---------------------------------------------------------------------------
// Pokritje:
//  • glave VERBATIM + oblika kanona R136 (BOM + podpičje + CRLF + trailing);
//  • WYSIWYG meritve (ISTI surovi ms kot trak palic — zaporedna 1..n);
//  • statistika EN VIR (ISTI izračun kot nasvetna vrstica — odziviStatistika,
//    test pina PROTI jedru, NIČ trdo kodiranih števil);
//  • 'Baza' žeton EN VIR (BAZA_NIZ — kartica UVAŽA ISTO konstanto; test pina
//    da kartica NE nosi več inline literala — precedens R335 STATUS_SL);
//  • 'Zgrajeno' EN VIR (ISTI klic zigIzpis kot kartica; null → prazen
//    stolpec; pokvaren žig → fail-soft prazen — vzorec R185);
//  • vir niz quoting (podpičje znotraj → RFC 4180 citiranje — LEKCIJA R334 2);
//  • DETERMINIZEM FULL (dva klica bajtno enaka — brez-časa kanon R334: nič
//    'Izvoženo ob', zgodovina te seje ni čas-anchored);
//  • filename bratska simetrija (sistem-zdravje.csv, brez datuma);
//  • fail-closed: prazna zgodovina, ne-polje, neveljavna meritev (EN VIR
//    prek odziviStatistika) + graditeljska vrstica (zaporedna + ms) — kanon
//    R299 (TypeError z imenom polja/graditelja).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BAZA_NIZ,
  ZDRAVJE_CSV_GLAVE_MERITEV,
  ZDRAVJE_VIR_NIZ,
  sistemZdravjeCsv,
  sistemZdravjeCsvFilename,
  sistemZdravjeCsvVrstica,
} from '@/lib/sistem-zdravje-csv'
import { odziviStatistika } from '@/lib/zdravje-zgodovina'
import { zigIzpis } from '@/lib/posodobitev-jedro'

const ZGOD = [412, 389, 441, 396, 405, 418, 384, 430, 399, 408, 415, 392]
const BUILD = '2026-10-01T07:58:29.265Z'

function razcleni(csv: string): string[][] {
  return csv
    .replace(/^\uFEFF/, '')
    .replace(/\r\n$/, '')
    .split('\r\n')
    .map((vrstica) => vrstica.split(';'))
}

describe('r336 sistem-zdravje-csv — 63. člen IZVOZI (CSV brat SistemZdravjeCard)', () => {
  it('glave VERBATIM + oblika kanona R136 (BOM + podpičje + CRLF + trailing CRLF)', () => {
    const csv = sistemZdravjeCsv(ZGOD, BUILD)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.startsWith('\uFEFFZaporedna preverba;Odziv (ms)\r\n')).toBe(true)
    expect(ZDRAVJE_CSV_GLAVE_MERITEV).toEqual(['Zaporedna preverba', 'Odziv (ms)'])
    expect(csv.endsWith('\r\n')).toBe(true)
    // podpičje = ločilo (ne vejica — kanon R136); glava po odstranitvi BOM
    expect(razcleni(csv)[0]).toEqual(['Zaporedna preverba', 'Odziv (ms)'])
  })

  it('WYSIWYG meritve: zaporedna 1..n + ISTI surovi ms kot trak palic', () => {
    const vrstice = razcleni(sistemZdravjeCsv(ZGOD, BUILD))
    // vrstice 1..n = meritve (za glavo)
    for (let i = 0; i < ZGOD.length; i++) {
      expect(vrstice[1 + i]).toEqual([String(i + 1), String(ZGOD[i])])
    }
    // n = 12 (ring ZGODOVINA_MAX) — celoten ring v izvozu
    expect(vrstice[ZGOD.length]).toEqual(['12', '392'])
  })

  it('statistika EN VIR: meta vrednosti == odziviStatistika(zgodovina) (pin PROTI jedru — nič trdo kodiranih)', () => {
    const csv = sistemZdravjeCsv(ZGOD, BUILD)
    const stat = odziviStatistika(ZGOD)
    expect(csv).toContain(`Najhitrejša (ms);${stat.najhitrejsa}`)
    expect(csv).toContain(`Povprečna (ms);${stat.povprecna}`)
    expect(csv).toContain(`Najpočasnejša (ms);${stat.najpocasnejsa}`)
    // ISTI izračun kot zaslon: min/povp./max
    expect(stat.najhitrejsa).toBe(384)
    expect(stat.najpocasnejsa).toBe(441)
    expect(stat.povprecna).toBe(407)
  })

  it("'Baza' žeton EN VIR: BAZA_NIZ = ISTI niz kot zaslon; kartica UVAŽA konstanto (nič inline literala)", () => {
    const csv = sistemZdravjeCsv(ZGOD, BUILD)
    expect(csv).toContain(`Baza;${BAZA_NIZ}`)
    expect(BAZA_NIZ).toBe('Baza odgovarja')
    const kartica = readFileSync(
      join(process.cwd(), 'src/components/roksal/sistem-zdravje-card.tsx'),
      'utf8',
    )
    expect(kartica).toContain('BAZA_NIZ')
    // anti-divergenca: JSX besedilno vozlišče NI več inline literala (EN VIR
    // prek konstante; komentarji smetanežijo — regex le na besedilno vozlišče)
    expect(kartica.includes('{BAZA_NIZ}')).toBe(true)
    expect(kartica.match(/>\s*Baza odgovarja\s*</)).toBeNull()
  })

  it("'Zgrajeno' EN VIR: ISTI klic zigIzpis kot kartica; null → prazen stolpec; pokvaren žig → fail-soft prazen (vzorec R185)", () => {
    const csv = sistemZdravjeCsv(ZGOD, BUILD)
    expect(csv).toContain(`Zgrajeno;${zigIzpis(BUILD)}`)
    // null build → prazen stolpec (fail-soft — nasvetna podrobnost)
    const brez = razcleni(sistemZdravjeCsv(ZGOD, null)).find((v) => v[0] === 'Zgrajeno')
    expect(brez).toEqual(['Zgrajeno', ''])
    // pokvaren žig → prazen stolpec (NE razbije izvoza — core meritve ostanejo)
    const pokvaren = razcleni(sistemZdravjeCsv(ZGOD, 'ni-datum')).find((v) => v[0] === 'Zgrajeno')
    expect(pokvaren).toEqual(['Zgrajeno', ''])
  })

  it('vir niz quoting: podpičje znotraj ZDRAVJE_VIR_NIZ → RFC 4180 citiranje (LEKCIJA R334 2)', () => {
    expect(ZDRAVJE_VIR_NIZ).toContain(';')
    const csv = sistemZdravjeCsv(ZGOD, BUILD)
    const vrstica = razcleni(csv).find((v) => v[0] === 'Vir')
    // citirana celica: narekovaj + notranje podpičje ohranjeno kot ENA celica
    expect(vrstica?.[0]).toBe('Vir')
    expect(vrstica?.join(';')).toContain('"')
    expect(csv).toContain(ZDRAVJE_VIR_NIZ)
  })

  it('DETERMINIZEM FULL: dva klica = bajtno identična datoteka (brez-časa kanon R334 — nič Izvoženo ob)', () => {
    const a = sistemZdravjeCsv(ZGOD, BUILD)
    const b = sistemZdravjeCsv(ZGOD, BUILD)
    expect(a).toBe(b)
    expect(a).not.toContain('Izvoženo ob')
  })

  it('filename bratska simetrija: sistem-zdravje.csv (brez datuma — statičen izvoz te seje)', () => {
    expect(sistemZdravjeCsvFilename()).toBe('sistem-zdravje.csv')
    expect(sistemZdravjeCsvFilename()).not.toMatch(/\d{4}-\d{2}/)
  })

  it('fail-closed: prazna zgodovina + ne-polje + neveljavna meritev (EN VIR prek odziviStatistika) — TypeError z imenom', () => {
    expect(() => sistemZdravjeCsv([], BUILD)).toThrowError(/sistemZdravjeCsv/)
    expect(() => sistemZdravjeCsv([], BUILD)).toThrowError(/prazna/)
    // @ts-expect-error — namenoma pokvaren vhod (test fail-closed poti)
    expect(() => sistemZdravjeCsv('ne-polje', BUILD)).toThrowError(/sistemZdravjeCsv/)
    expect(() => sistemZdravjeCsv([400, Number.NaN], BUILD)).toThrowError(/odziviStatistika/)
    expect(() => sistemZdravjeCsv([400, -1], BUILD)).toThrowError(/odziviStatistika/)
    expect(() => sistemZdravjeCsv([400, Number.POSITIVE_INFINITY], BUILD)).toThrowError(
      /odziviStatistika/,
    )
  })

  it('fail-closed graditeljska vrstica: zaporedna (0 / ne-celo) + ms (NaN / negativno) — kanon R299', () => {
    expect(() => sistemZdravjeCsvVrstica(0, 400)).toThrowError(/sistemZdravjeCsvVrstica/)
    expect(() => sistemZdravjeCsvVrstica(1.5, 400)).toThrowError(/sistemZdravjeCsvVrstica/)
    expect(() => sistemZdravjeCsvVrstica(1, Number.NaN)).toThrowError(/sistemZdravjeCsvVrstica/)
    expect(() => sistemZdravjeCsvVrstica(1, -5)).toThrowError(/sistemZdravjeCsvVrstica/)
    expect(sistemZdravjeCsvVrstica(3, 412)).toEqual(['3', '412'])
  })

  it('žičenje: kartica klice EN VIR modul (sejaZgodovinaPreber + data.build) — nič druge resnice', () => {
    const kartica = readFileSync(
      join(process.cwd(), 'src/components/roksal/sistem-zdravje-card.tsx'),
      'utf8',
    )
    expect(kartica).toContain('sistemZdravjeCsv(zgodovinaMerjitve, data?.build ?? null)')
    expect(kartica).toContain('sejaZgodovinaPreber()')
    expect(kartica).toContain('downloadCsvText(sistemZdravjeCsvFilename(), csv)')
    // legenda medija + definicijski naslov medija
    expect(kartica).toContain('Zdravje CSV = iste meritve te seje')
    expect(kartica).toContain('data-testid="sistem-zdravje-csv-pill"')
  })
})
