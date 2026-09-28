// R186 — (a) izvoz meritev CSV (jedro + žičenje) + (b) javno zdravje
// /api/public/health (DB-aliv sonda za zunanje monitore).
// ---------------------------------------------------------------------------
// (a) MERITVE CSV: čisto jedro meritve-csv.ts (družina vodja-csv R157-R163:
// BOM za Excel, vejica, citiranje, deterministično ime datoteke, fail-closed
// TypeErrors) + gumb v filter vrstici measurements-tab (isto mesto/pravilo
// kot zaloga 'Izvozi vidno zalogo kot CSV' — IZVOŽENO = VIDNO, filter
// upoštevan; prazno → viden toast, nič praznih datotek; pokvaren vnos →
// fail-verbose toast z razlogom).
// (b) ZDRAVJE: javna ruta pod /api/public (prefix, brez seje — kot
// /api/public/version R181) pinguje bazo SELECT 1 z 3 s vrati; 200 ok /
// 503 fail-verbose s correlationId; NIČ PII (samo binarno stanje + build
// žig, ki je že javen prek version). Motiv: zunanji monitor (UptimeRobot)
// končno vidi izpad Neon baze PRED uporabniki.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  meritveCsv,
  meritveCsvFilename,
  meritveCsvVrstice,
  meritevVrstica,
  type MeritevZaIzvoz,
} from '../meritve-csv'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const OK: MeritevZaIzvoz = {
  id: 'm1',
  createdAt: '2026-09-27T06:30:00.000Z',
  dolzinaMm: 2400,
  visinaMm: 1100,
  tipMeritve: 'VISINA',
  oznaka: 'Segment A; stebra 1',
  status: 'POTRJENA',
  lokacija: 'Balkon sever',
  opomba: 'Kot "na oko" 5°',
  tipPodlage: 'Beton',
  kotStopinje: 5,
  steviloStebrov: 3,
  enota: 'cm',
  originalnaVrednost: 240,
  tipStebra: 'KONCNI',
  materialStebra: 'INOX',
  visinaStebraMm: 1100,
  pozicijaMm: 1200,
  notranjiKot: 90,
  zunanjiKot: 270,
}

describe('R186 — jedro (meritve-csv.ts): izvoz, determinizem, fail-closed', () => {
  it('prazno polje → SAMO glava (veljaven CSV) + BOM + glava z vsemi 19 stolpci', () => {
    const { csv, vrstic } = meritveCsv([])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(vrstic).toBe(1)
    const vrstice = csv.slice(1).split('\n')
    expect(vrstice[0]).toContain('"datum"')
    expect(vrstice[0]).toContain('"dolzina_mm"')
    expect(vrstice[0]).toContain('"zunanji_kot"')
    expect(vrstice[0]).toContain('"opomba"')
  })

  it('polna vrstica: vseh 19 polj, datum = ISO 8601, IZVOŽENO = ZASLON (status/tip brez fallbacka, ko so znani)', () => {
    const vrstica = meritevVrstica(OK)
    expect(vrstica[0]).toBe('2026-09-27T06:30:00.000Z')
    expect(vrstica[2]).toBe('VISINA')
    expect(vrstica[3]).toBe('2400')
    expect(vrstica[16]).toBe('POTRJENA')
    expect(vrstica[17]).toBe('Balkon sever')
  })

  it('fallbacki = ISTI kot UI: brez tipMeritve → RAZDALJA, brez statusa → OSNUTEK, odprta polja → prazno', () => {
    const vrstica = meritevVrstica({
      id: 'm2',
      createdAt: '2026-09-27T06:30:00.000Z',
      dolzinaMm: 1000,
      visinaMm: 900,
    })
    expect(vrstica[2]).toBe('RAZDALJA')
    expect(vrstica[16]).toBe('OSNUTEK')
    expect(vrstica[1]).toBe('') // oznaka odsotna → prazno (ne 'n/a')
    expect(vrstica[5]).toBe('') // kot odsoten → prazno
    expect(vrstica[17]).toBe('') // lokacija odsotna → prazno
  })

  it('determinizem: isti vnos → IDENTIČEN izpis (×2 klica) + vrstni red = vrstni red vhoda', () => {
    expect(meritveCsv([OK])).toEqual(meritveCsv([OK]))
    const druga: MeritevZaIzvoz = { ...OK, id: 'm3', createdAt: '2026-09-26T10:00:00.000Z' }
    const vrstice = meritveCsv([druga, OK]).csv.split('\n')
    // vrstni red vhoda ohranjen: 1. vrstica = prvi vnos (druga meritev)
    expect(vrstice[1]).toContain('2026-09-26T10:00:00.000Z')
    expect(vrstice[2]).toContain('2026-09-27T06:30:00.000Z')
  })

  it('citiranje: besedilna polja vedno citirana, navedek podvojen (RFC 4180)', () => {
    const vrstice = meritveCsvVrstice([OK])
    expect(vrstice[1]).toContain('"Segment A; stebra 1"')
    expect(vrstice[1]).toContain('"Kot ""na oko"" 5°"')
  })

  it('fail-closed: negativna/ne-končna dolžina ali višina → TypeError', () => {
    expect(() => meritevVrstica({ ...OK, dolzinaMm: -1 })).toThrow(TypeError)
    expect(() => meritevVrstica({ ...OK, visinaMm: Number.NaN })).toThrow(TypeError)
    expect(() => meritevVrstica({ ...OK, dolzinaMm: Number.POSITIVE_INFINITY })).toThrow(TypeError)
  })

  it('fail-closed: manjkajoč id/createdAt + pokvaren datum → TypeError (pred toISOString)', () => {
    expect(() => meritevVrstica({ ...OK, id: '' })).toThrow(TypeError)
    expect(() => meritevVrstica({ ...OK, createdAt: '' })).toThrow(TypeError)
    expect(() => meritevVrstica({ ...OK, createdAt: 'nismo-datum' })).toThrow(TypeError)
    expect(() => meritevVrstica(null as unknown as MeritevZaIzvoz)).toThrow(TypeError)
  })

  it('meritveCsvFilename: deterministično ime (referenčni datum kot parameter) + fail-closed', () => {
    expect(meritveCsvFilename('2026-09-27')).toBe('meritve_2026-09-27.csv')
    expect(meritveCsvFilename('2026-09-27')).toBe(meritveCsvFilename('2026-09-27'))
    expect(() => meritveCsvFilename('27.09.2026')).toThrow(TypeError)
    expect(() => meritveCsvFilename('2026-13-99')).toThrow(TypeError)
  })
})

describe('R186 — žičenje (measurements-tab): gumb izvoza CSV', () => {
  const tab = (): string => srcOf('src/components/roksal/measurements-tab.tsx')

  it('jedro je EN VIR: tab uvaža meritveCsv + meritveCsvFilename + downloadCsvText', () => {
    const src = tab()
    expect(src).toContain("import { meritveCsv, meritveCsvFilename } from '@/lib/meritve-csv'")
    expect(src).toContain("import { downloadCsvText } from '@/lib/csv-export'")
  })

  it('IZVOŽENO = VIDNO: izvoz gradi nad filteredMeasurements (status + foto filter upoštevana)', () => {
    const src = tab()
    expect(src).toContain('meritveCsv(filteredMeasurements)')
  })

  it('fail-closed prazno + fail-verbose napaka: viden toast v OBEH vejah', () => {
    const src = tab()
    expect(src).toContain("toast.error('Ni meritev za izvoz.')")
    expect(src).toContain('Izvoza ni bilo mogoče ustvariti')
    expect(src).toContain(`toast.success(\`Izvoženih \${filteredMeasurements.length} meritev v CSV.\`)`)
  })

  it('gumb: aria-label + tooltip + Download ikona + hover družina (13. površina) + focus ring', () => {
    const src = tab()
    expect(src).toContain('aria-label="Izvozi vidne meritve kot CSV"')
    expect(src).toContain('title="Izvozi vidne meritve (upošteva filter) kot CSV za Excel"')
    // R254 pin shift: codemod P1-d vstavil aria-hidden="true" (dekorativna
    // ikona izven screen-reader drevesa — detektor r254 vzdržuje invarianto).
    expect(src).toMatch(/aria-label="Izvozi vidne meritve kot CSV"[\s\S]{0,400}<Download aria-hidden="true" className="h-3 w-3" \/>/)
    expect(src).toContain('hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
  })

  it('regresija R183: pečat + EN VIR loader ostajata nedotaknjena (živostna površina 18)', () => {
    const src = tab()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toContain('{casOznaka(meritveOsvezitev)}')
    expect(src).toMatch(/useRefetchOnFocus\(loadAll\)/)
  })
})

describe('R186 — javno zdravje (GET /api/public/health): DB-aliv sonda', () => {
  const ruta = (): string => srcOf('src/app/api/public/health/route.ts')

  it('javna ruta: pod /api/public prefix (brez auth uvozov) + runtime nodejs + no-store komentar', () => {
    const src = ruta()
    // prefix pokrit s PUBLIC_PREFIXES '/api/public' v src/proxy.ts — ruta NE
    // uvaža auth (javna po zasnovi); denyUnless bi bil napaka koncepta
    expect(src).not.toContain('denyUnless')
    expect(src).not.toContain("from '@/lib/auth'")
    expect(src).toContain("export const runtime = 'nodejs'")
  })

  it('ping baze: SELECT 1 prek db.$queryRaw + 3 s vrata (obešena baza = 503, ne viseča zahteva)', () => {
    const src = ruta()
    expect(src).toContain('db.$queryRaw`SELECT 1`')
    expect(src).toContain('PING_TIMEOUT_MS = 3000')
    expect(src).toMatch(/Promise\.race\(/)
    expect(src).toContain('unref')
  })

  it('ok pot: 200 { ok: true, db: \'ok\', build, generatedAt } — build iz NEXT_PUBLIC_BUILD_STAMP', () => {
    const src = ruta()
    expect(src).toMatch(/ok: true,\s*\n\s*db: 'ok',/)
    expect(src).toContain('process.env.NEXT_PUBLIC_BUILD_STAMP ?? null')
    expect(src).toContain('generatedAt: new Date().toISOString()')
  })

  it('fail-verbose: 503 { ok: false, db: \'fail\', error, correlationId } + logWithCorrelation (nič tihega zdravja)', () => {
    const src = ruta()
    expect(src).toMatch(/status: 503/)
    expect(src).toMatch(/ok: false,\s*\n\s*db: 'fail',/)
    expect(src).toContain("logWithCorrelation('public.health.error', correlationId, error)")
    expect(src).toContain('correlationId')
    expect(src).toContain(CORRELATION_HEADER_REF)
  })

  it('PII higiena: NIČ uporabniških podatkov v odgovoru (brez findMany, brez e-naslovov)', () => {
    const src = ruta()
    expect(src).not.toContain('findMany')
    expect(src).not.toContain('findFirst')
    expect(src).not.toContain('email')
  })
})

// Lokalna referenca za test zgoraj (brez uvoza — grepi so tekstovni).
const CORRELATION_HEADER_REF = 'CORRELATION_HEADER'
