// R159 — CRM CSV izvoz + i18n regresijski stražar ui/osnovnih elementov.
// ---------------------------------------------------------------------------
// (1) crm-csv enote: BOM + glava, status preslikava = ISTA besedila kot UI
//     (STATUS_LABELS), determinizem, CSV injekcija, null → prazno, datumi
//     (date-only ISO brez Date API-ja = 100 % deterministično), fail-closed.
// (2) i18n stražar: ui primitivi (shadcn) ne smejo vsebovati angleških
//     sr-only/aria-label nizov — bralniki zaslonov morajo slišati slovenščino.
//     Kršitev = rdeči test (isti vzorec kot a11y stražar iz R157/R158).

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCrmCsv, crmCsvFilename, CRM_STATUS_LABELS, type CrmCsvRow } from '../crm-csv'

const __dirname = dirname(fileURLToPath(import.meta.url))

function row(overrides: Partial<CrmCsvRow> = {}): CrmCsvRow {
  return {
    ime: 'Janez Novak',
    naslov: 'Cesta na Murgle 4, 1000 Ljubljana',
    status: 'AKTIVEN',
    kontaktnaOseba: 'Marija Novak',
    telefon: '+386 40 123 456',
    email: 'janez@example.si',
    kategorija: 'Posameznik',
    opomnikDatum: '2026-09-26',
    opomnikOpis: 'Poklicati glede ponudbe',
    zadnjiKontakt: '2026-08-15',
    skupajProjektov: 3,
    ltv: 12500,
    zaklenjeni: 3000,
    opombeCRM: 'Prednostna stranka',
    ...overrides,
  }
}

describe('r159 — buildCrmCsv', () => {
  it('ima BOM + popolno glavo (14 stolpcev)', () => {
    const { csv, vrstic } = buildCrmCsv([row()])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Ime,Naslov,Status,Kontaktna oseba,Telefon,E-pošta,Kategorija,Opomnik datum,Opomnik opis,Zadnji kontakt,Projekti,LTV (EUR),Zaklenjeni (EUR),Opombe CRM')
    expect(vrstic).toBe(1)
  })

  it('status preslika v ISTA besedila kot UI (STATUS_LABELS)', () => {
    expect(CRM_STATUS_LABELS).toEqual({
      AKTIVEN: 'Aktiven',
      NEAKTIVEN: 'Neaktiven',
      POTENCIALEN: 'Potencialen',
      ARHIVIRAN: 'Arhiviran',
    })
    const { csv } = buildCrmCsv([
      row({ status: 'AKTIVEN' }),
      row({ ime: 'B', status: 'NEAKTIVEN' }),
      row({ ime: 'C', status: 'POTENCIALEN' }),
      row({ ime: 'D', status: 'ARHIVIRAN' }),
    ])
    expect(csv).toContain('"Aktiven"')
    expect(csv).toContain('"Neaktiven"')
    expect(csv).toContain('"Potencialen"')
    expect(csv).toContain('"Arhiviran"')
  })

  it('je determinističen — isti vhod = enak izhod (2 klica)', () => {
    const a = buildCrmCsv([row()])
    const b = buildCrmCsv([row()])
    expect(a.csv).toBe(b.csv)
    expect(a.vrstic).toBe(b.vrstic)
  })

  it('escape-ira navedke (CSV injekcija) — narekovaj podvojen', () => {
    const { csv } = buildCrmCsv([row({ ime: 'Stranka "Test" d.o.o.', opombeCRM: 'Opomba z, vejico in "narekovaji"' })])
    expect(csv).toContain('"Stranka ""Test"" d.o.o."')
    expect(csv).toContain('"Opomba z, vejico in ""narekovaji"""')
  })

  it('null polja → prazen stolpec (nikoli "null" besedilo)', () => {
    const { csv } = buildCrmCsv([
      row({
        kontaktnaOseba: null,
        telefon: null,
        email: null,
        kategorija: null,
        opomnikDatum: null,
        opomnikOpis: null,
        zadnjiKontakt: null,
        opombeCRM: null,
      }),
    ])
    expect(csv).not.toContain('null')
    const vrstica = csv.split('\n')[1] ?? ''
    const celice = vrstica.split(',')
    // 14 stolpcev − 6 zapolnjenih (ime, naslov, status, projekti, ltv, zaklenjeni) = 8 praznih
    expect(celice.filter((c) => c === '""').length).toBe(8)
  })

  it('date-only ISO opomnikDatum → DD.MM.YYYY neodvisno od časovnega pasu', () => {
    const { csv } = buildCrmCsv([row({ opomnikDatum: '2026-09-26', zadnjiKontakt: '2026-01-05' })])
    expect(csv).toContain('"26.09.2026"')
    expect(csv).toContain('"05.01.2026"')
  })

  it('števila kot cela števila brez ločil (podatkovni stolpec)', () => {
    const { csv } = buildCrmCsv([row({ skupajProjektov: 12, ltv: 12500, zaklenjeni: 0 })])
    expect(csv).toContain('"12"')
    expect(csv).toContain('"12500"')
    expect(csv).toContain('"0"')
  })

  it('prazno polje → samo glava (0 vrstic)', () => {
    const { csv, vrstic } = buildCrmCsv([])
    expect(vrstic).toBe(0)
    const brezBom = csv.slice(1)
    expect(brezBom.endsWith('\n')).toBe(false)
    expect(brezBom.split(',').length).toBe(14)
  })

  it('fail-closed: neznani status → TypeError', () => {
    expect(() => buildCrmCsv([row({ status: 'POLJUBEN' })])).toThrow(TypeError)
    expect(() => buildCrmCsv([row({ status: '' })])).toThrow(TypeError)
  })

  it('fail-closed: prazno ime / prazen naslov → TypeError', () => {
    expect(() => buildCrmCsv([row({ ime: '' })])).toThrow(TypeError)
    expect(() => buildCrmCsv([row({ ime: '   ' })])).toThrow(TypeError)
    expect(() => buildCrmCsv([row({ naslov: '' })])).toThrow(TypeError)
  })

  it('fail-closed: ne-finite števila → TypeError', () => {
    expect(() => buildCrmCsv([row({ ltv: Number.NaN })])).toThrow(TypeError)
    expect(() => buildCrmCsv([row({ ltv: Number.POSITIVE_INFINITY })])).toThrow(TypeError)
    expect(() => buildCrmCsv([row({ zaklenjeni: Number.NaN })])).toThrow(TypeError)
    expect(() => buildCrmCsv([row({ skupajProjektov: Number.NaN })])).toThrow(TypeError)
  })

  it('fail-closed: neveljaven polni datum → TypeError', () => {
    expect(() => buildCrmCsv([row({ zadnjiKontakt: 'ni datum' })])).toThrow(TypeError)
  })

  it('fail-closed: ne-polje vhod → TypeError', () => {
    // @ts-expect-error — namenoma pokvarjen tip
    expect(() => buildCrmCsv('niz')).toThrow(TypeError)
    // @ts-expect-error — namenoma pokvarjen tip
    expect(() => buildCrmCsv(null)).toThrow(TypeError)
  })

  it('crmCsvFilename: deterministično + striktna validacija', () => {
    expect(crmCsvFilename('2026-09-26')).toBe('crm_stranke_2026-09-26.csv')
    expect(crmCsvFilename('2026-09-26')).toBe(crmCsvFilename('2026-09-26'))
    expect(() => crmCsvFilename('')).toThrow(TypeError)
    expect(() => crmCsvFilename('26.09.2026')).toThrow(TypeError)
    expect(() => crmCsvFilename('2026-9-26')).toThrow(TypeError)
  })
})

describe('r159 — i18n stražar ui primitivov', () => {
  const uiDir = join(__dirname, '..', '..', 'components', 'ui')
  const files = readdirSync(uiDir).filter((f) => f.endsWith('.tsx'))
  const srcs = new Map(files.map((f) => [f, readFileSync(join(uiDir, f), 'utf8')]))

  // Prepovedani angleški nizi (prehodno stanje pred R159) — ne smejo se vrniti.
  const FORBIDDEN: Array<{ needle: string; reason: string }> = [
    { needle: 'sr-only">Close<', reason: 'dialog/sheet zapri gumb (R159: Zapri)' },
    { needle: '"Go to previous page"', reason: 'pagination (R159: Na prejšnjo stran)' },
    { needle: '"Go to next page"', reason: 'pagination (R159: Na naslednjo stran)' },
    { needle: '"Toggle Sidebar"', reason: 'sidebar rail (R159: Preklopi stransko vrstico)' },
    { needle: 'sr-only">More<', reason: 'breadcrumb ellipsis (R159: Več)' },
    { needle: '"Previous slide"', reason: 'carousel (R159: Prejšnja slika)' },
    { needle: '"Next slide"', reason: 'carousel (R159: Naslednja slika)' },
    { needle: 'title = "Command Palette"', reason: 'command dialog naslov (R159: Ukazna paleta)' },
    { needle: 'description = "Search for a command', reason: 'command dialog opis (R159: Poišči ukaz…)' },
  ]

  it('ui primitivi NE vsebujejo znanih angleških sr-only/aria-label nizov', () => {
    const violations: string[] = []
    for (const [file, src] of srcs) {
      for (const { needle, reason } of FORBIDDEN) {
        if (src.includes(needle)) violations.push(`${file}: ${reason}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('dialog + sheet imata slovenski sr-only "Zapri"', () => {
    expect(srcs.get('dialog.tsx')).toContain('sr-only">Zapri<')
    expect(srcs.get('sheet.tsx')).toContain('sr-only">Zapri<')
  })

  it('dialog + sheet zapri gumba imata focus-visible ring + hover ozadje (STIL pass)', () => {
    for (const f of ['dialog.tsx', 'sheet.tsx']) {
      const src = srcs.get(f) ?? ''
      const closeMatch = /<(DialogPrimitive|SheetPrimitive)\.Close[\s\S]*?className="([^"]*)"/.exec(src)
      expect(closeMatch, `${f}: Close element najden`).not.toBeNull()
      const cls = closeMatch?.[2] ?? ''
      expect(cls).toContain('focus-visible:ring-2')
      expect(cls).not.toContain('focus:ring-2')
      expect(cls).toContain('hover:bg-accent')
    }
  })

  it('command dialog privzeti naslov/opis v slovenščini', () => {
    expect(srcs.get('command.tsx')).toContain('title = "Ukazna paleta"')
    expect(srcs.get('command.tsx')).toContain('description = "Poišči ukaz za izvedbo…"')
  })
})
