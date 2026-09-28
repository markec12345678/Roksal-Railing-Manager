// R238 — plosca-csv enote + komponenta + stil strazar (prodajna plošča CSV).
// ---------------------------------------------------------------------------
// Zaključek 'izvozi' družine (P1-c): prodajna plošča (R178 kanban) je bila
// po R237 EDINA podatkovno-gostota površina brez izvoza. Novost proti
// projekti-csv R164: FINANČNA dimenzija lijaka — vrednost (€, decimalna
// vejica — R136 csvField pogodba, zato PODPIČJE dialekt), spomnik
// (IZVORNI datum, nikoli relativni čip — R164 precedens) in podpis
// (deal lock — DA/NE). Fail-closed: ne-polje, manjkajoč naziv, neznan
// status, neveljaven datum (R164 strukturna validacija), ne-končna
// vrednost (csvField bi tiho vrnil '' — silent degradation je prepovedana),
// ne-logičen podpis → TypeError. Determinizem: ista polja = ista datoteka,
// datum v imenu kot parameter (todayStamp).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { twMerge } from 'tailwind-merge'
import {
  buildPloscaCsv,
  ploscaCsvFilename,
  type PloscaCsvRow,
} from '../plosca-csv'
import { PROJEKTI_STATUS_LABELS } from '../projekti-csv'

const beri = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const row = (over: Partial<PloscaCsvRow> = {}): PloscaCsvRow => ({
  nazivProjekta: 'Balkon Novak — Kranj',
  status: 'V_TEKU',
  strankaIme: 'Jure Novak',
  vrednostEur: 2450.5,
  spomnik: '2026-09-20T00:00:00.000Z',
  datumMontaze: '2026-10-15T08:00:00.000Z',
  podpisano: false,
  ...over,
})

describe('R238 — plosca-csv: pravi artefakt + determinizem (R164/R234–R237 vzorec)', () => {
  it('glava: podpičje dialekt z VSEMI sedmimi stolpci (finančna dimenzija — R136 pogodba)', () => {
    const { csv } = buildPloscaCsv([row()])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const prva = csv.replace(/^\uFEFF/, '').split('\r\n')[0]
    expect(prva).toBe('Naziv projekta;Status;Stranka;Vrednost (€);Spomnik;Datum montaže;Podpisano')
  })

  it('enajna vrstica: vrednost decimalna vejica (2450.5 → 2450,50) + datumi DD.MM.YYYY + DA/NE', () => {
    const { csv, vrstic } = buildPloscaCsv([row()])
    expect(vrstic).toBe(1)
    const vrsta = csv.replace(/^\uFEFF/, '').split('\r\n')[1]
    expect(vrsta).toBe(
      'Balkon Novak — Kranj;V teku;Jure Novak;2450,50;20.09.2026;15.10.2026;NE',
    )
  })

  it('determinizem: 2 klica = bajtno isti izhod (brez Date.now/Math.random v libu)', () => {
    const a = buildPloscaCsv([row(), row({ nazivProjekta: 'Merec Kovač' })])
    const b = buildPloscaCsv([row(), row({ nazivProjekta: 'Merec Kovač' })])
    expect(a.csv).toBe(b.csv)
    expect(a.vrstic).toBe(b.vrstic)
  })

  it('filename: plosca_YYYY-MM-DD.csv (ločen prefix od projekti_ R164 — dve rabi)', () => {
    expect(ploscaCsvFilename('2026-09-28')).toBe('plosca_2026-09-28.csv')
    expect(ploscaCsvFilename('2026-09-28')).not.toBe('projekti_2026-09-28.csv')
  })

  it('filename fail-closed: ne-ISO oblike → TypeError', () => {
    expect(() => ploscaCsvFilename('28.09.2026')).toThrow(TypeError)
    expect(() => ploscaCsvFilename('2026-9-28')).toThrow(TypeError)
    expect(() => ploscaCsvFilename('')).toThrow(TypeError)
  })

  it('prazen seznam → glava-only datoteka (lib dovoli; komponenta blokira pri 0 z toastom — R233 družina)', () => {
    const { csv, vrstic } = buildPloscaCsv([])
    expect(vrstic).toBe(0)
    expect(csv.replace(/^\uFEFF/, '')).toBe(
      'Naziv projekta;Status;Stranka;Vrednost (€);Spomnik;Datum montaže;Podpisano\r\n',
    )
  })
})

describe('R238 — plosca-csv: fail-closed pogodba (ni silent degradation)', () => {
  it('ne-polje → TypeError', () => {
    expect(() => buildPloscaCsv(undefined as unknown as PloscaCsvRow[])).toThrow(TypeError)
    expect(() => buildPloscaCsv('polno' as unknown as PloscaCsvRow[])).toThrow(TypeError)
  })

  it('manjkajoč/prazen/ne-niz naziv → TypeError z indeksom krivca', () => {
    expect(() => buildPloscaCsv([row(), row({ nazivProjekta: '' })])).toThrow(
      /manjka nazivProjekta \(vrstica 1\)/,
    )
    expect(() => buildPloscaCsv([row({ nazivProjekta: '   ' })])).toThrow(TypeError)
    expect(() => buildPloscaCsv([row({ nazivProjekta: 42 as unknown as string })])).toThrow(TypeError)
  })

  it('neznan status → TypeError (ISTI seznam kot UI + PDF + R164 — štirje pogledi, ena resnica)', () => {
    expect(() => buildPloscaCsv([row({ status: 'SKRIVNA_FAZA' })])).toThrow(
      /neznan status projekta \(vrstica 0\)/,
    )
  })

  it('vse sedem statusov se preslika v ISTA besedila (PROJEKTI_STATUS_LABELS en vir resnice)', () => {
    const vsi = Object.keys(PROJEKTI_STATUS_LABELS).map((status) =>
      buildPloscaCsv([row({ status })]).csv,
    )
    expect(vsi.length).toBe(7)
    const preslikave = Object.entries(PROJEKTI_STATUS_LABELS)
    for (const [, label] of preslikave) {
      expect(vsi.some((c) => c.includes(`;${label};`))).toBe(true)
    }
  })

  it('neveljaven datum v spomniku/datumMontaze → TypeError (strukturna validacija R164: 2026-13-99)', () => {
    expect(() => buildPloscaCsv([row({ spomnik: '2026-13-99' })])).toThrow(
      /neveljaven datum v polju spomnik \(vrstica 0\)/,
    )
    expect(() => buildPloscaCsv([row({ datumMontaze: 'ne-da-tum' })])).toThrow(
      /neveljaven datum v polju datumMontaze/,
    )
    // strukturno veljaven (02-31) ostane dovoljen — ISTA semantika kot R164
    expect(buildPloscaCsv([row({ spomnik: '2026-02-31' })]).csv).toContain('31.02.2026')
  })

  it('vrednostEur: NaN/∞/ne-number → TypeError (csvField bi tiho vrnil prazno — SILENT DEGRADACIJA prepovedana)', () => {
    expect(() => buildPloscaCsv([row({ vrednostEur: NaN })])).toThrow(/vrednostEur \(vrstica 0\)/)
    expect(() => buildPloscaCsv([row({ vrednostEur: Infinity })])).toThrow(TypeError)
    expect(() => buildPloscaCsv([row({ vrednostEur: '2450' as unknown as number })])).toThrow(TypeError)
  })

  it('podpisano: ne-logična vrednost → TypeError (nikoli tiho pretvarjanje truthy/falsy)', () => {
    expect(() => buildPloscaCsv([row({ podpisano: 'DA' as unknown as boolean })])).toThrow(
      /podpisano \(vrstica 0\)/,
    )
    expect(() => buildPloscaCsv([row({ podpisano: null as unknown as boolean })])).toThrow(TypeError)
  })

  it('stranka: ne-niz ne-null → TypeError; null → PRAZEN stolpec (nikoli null besedilo, nikoli izmišljen 0)', () => {
    expect(() => buildPloscaCsv([row({ strankaIme: 7 as unknown as string })])).toThrow(
      /strankaIme \(vrstica 0\)/,
    )
    const { csv } = buildPloscaCsv([row({ strankaIme: null })])
    const vrsta = csv.replace(/^\uFEFF/, '').split('\r\n')[1]
    expect(vrsta).toBe('Balkon Novak — Kranj;V teku;;2450,50;20.09.2026;15.10.2026;NE')
  })
})

describe('R238 — ENA resnica: izvoz = TOČNO stanje plošče (WYSIWYG R164/R233 vzorec)', () => {
  it('spomnik = IZVORNA resnica (datum), NIKOLI relativni čip (zapadel/DANES je odvisen od trenutka)', () => {
    const { csv } = buildPloscaCsv([row({ spomnik: '2026-01-05T17:30:00.000Z' })])
    expect(csv).toContain('05.01.2026')
    expect(csv).not.toContain('zapadel')
    expect(csv).not.toContain('DANES')
    expect(csv).not.toContain('čez')
  })

  it('podpis = ISTA resnica kot ključavnica na kartici (true → DA, false → NE)', () => {
    expect(buildPloscaCsv([row({ podpisano: true })]).csv.split('\r\n')[1]).toContain(';DA')
    expect(buildPloscaCsv([row({ podpisano: false })]).csv.split('\r\n')[1]).toContain(';NE')
  })

  it('vrednost 0 → 0,00 (jezak 0 € je Dejstvo izhod, ne manjkajoča vrednost — null je prazno)', () => {
    const nula = buildPloscaCsv([row({ vrednostEur: 0 })]).csv.split('\r\n')[1]
    expect(nula).toContain(';0,00;')
    const brez = buildPloscaCsv([row({ vrednostEur: null })]).csv.split('\r\n')[1]
    expect(brez).toContain(';;')
  })

  it('CSV injekcija zaščita: naziv z ; ali " → RFC 4180 citiranje (toCsv quoteField)', () => {
    const zlo = buildPloscaCsv([row({ nazivProjekta: 'Plošča; INJEKCIJA "tukaj"' })]).csv
    expect(zlo).toContain('"Plošča; INJEKCIJA ""tukaj"""')
  })

  it('polni ISO z uro v datumih → samo datumski del (brez ure v stolpcu)', () => {
    const { csv } = buildPloscaCsv([row({ datumMontaze: '2026-03-09T14:00:00.000Z' })])
    expect(csv).toContain('09.03.2026')
    expect(csv).not.toContain('14:00')
  })
})

describe('R238 — komponenta: CSV gumb na prodajni plošči (ISTI družina R232/R233)', () => {
  const komponenta = beri('src/components/roksal/deal-pipeline.tsx')

  it('gumb obstaja: aria + title + VEDNO viden (disabled samo med loadingom/izvozom — R232 družina)', () => {
    expect(komponenta).toContain('aria-label="Izvozi prodajno ploščo kot CSV"')
    expect(komponenta).toContain('Izvozi vidne projekte z vrednostjo, spomnikom in podpisom kot CSV za Excel')
    const z = komponenta.indexOf('aria-label="Izvozi prodajno ploščo kot CSV"')
    const blok = komponenta.slice(Math.max(0, z - 600), z)
    expect(blok).toContain('onClick={handleExportPloscaCsv}')
    expect(blok).toContain('disabled={loading || exportingPlosca}')
  })

  it('handler: IZVOŽENO = ZASLON (vidni množica) + EN now za ime (lekcija R121/R235)', () => {
    const z = komponenta.indexOf('const handleExportPloscaCsv')
    const k = komponenta.indexOf('  return (', z)
    const h = komponenta.slice(z, k)
    expect(h).toContain('buildPloscaCsv(')
    expect(h).toContain('vidni.map((p) => ({')
    expect(h).toContain('vrednostEur: p.estimatedPrice ?? null,')
    expect(h).toContain('spomnik: p.followUpDate ?? null,')
    expect(h).toContain('podpisano: p.dealLocked,')
    expect(h).toContain('ploscaCsvFilename(todayStamp())')
    // EN now: točno EN todayStamp klic v handlerju
    const klicev = h.match(/todayStamp\(\)/g) ?? []
    expect(klicev.length).toBe(1)
  })

  it('fail-closed klik pri 0 → iskren toast (ni prazne datoteke — R232/R233 vzorec)', () => {
    const z = komponenta.indexOf('const handleExportPloscaCsv')
    const h = komponenta.slice(z, z + 800)
    expect(h).toContain("if (vidni.length === 0) {")
    expect(h).toContain('Ni projektov na plošči za izvoz')
    expect(h).toContain('CSV se izvozi, ko je na plošči prvi projekt.')
  })

  it('fail-verbose: TypeError → viden razlog v toastu (R162 vzorec; shadcn API — useToast lekcija R237)', () => {
    const z = komponenta.indexOf('const handleExportPloscaCsv')
    const k = komponenta.indexOf('  return (', z)
    const h = komponenta.slice(z, k)
    expect(h).toContain("'Izvoz ni uspel'")
    expect(h).toContain('err instanceof Error ? err.message')
    expect(h).toContain("variant: 'destructive'")
  })

  it('uspeh toast s sklanjatvijo projektiLabel (ponovna raba — NI nove sklanjatve)', () => {
    const z = komponenta.indexOf('const handleExportPloscaCsv')
    const h = komponenta.slice(z, z + 2500)
    expect(h).toContain('projektiLabel(vrstic)')
    expect(h).toContain('Izvožena prodajna plošča')
  })
})

describe('R238 — [Mandatory] stil (P1-f): nov gumb na družinskih žetonih, 0 novih hex', () => {
  const komponenta = beri('src/components/roksal/deal-pipeline.tsx')
  const lib = beri('src/lib/plosca-csv.ts')

  it('izvozni gumb: fokus roksal-navy/40 (glavna fokusrna družina ×143 — R236/R237 revizija)', () => {
    const z = komponenta.indexOf('aria-label="Izvozi prodajno ploščo kot CSV"')
    const blok = komponenta.slice(Math.max(0, z - 600), z)
    expect(blok).toContain('focus-visible:ring-roksal-navy/40')
    expect(blok).not.toMatch(/focus-visible:ring-(amber|emerald|green|blue|ink)/)
  })

  it('lib in komponenta: 0 hex barv v novi kodi (žetoni samo)', () => {
    expect(lib).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    const z = komponenta.indexOf('R238 — CSV izvoz prodajne plošče')
    const noviBlok = komponenta.slice(z, komponenta.indexOf('Skrči prodajno ploščo'))
    expect(noviBlok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('ikonka FileDown = ISTA družina kot R164 izvozni gumb (konsistentnost ikon)', () => {
    const z = komponenta.indexOf('aria-label="Izvozi prodajno ploščo kot CSV"')
    const blok = komponenta.slice(z, z + 600)
    expect(blok).toContain('<FileDown')
  })
})

describe('R238 — [Mandatory] stil (P1-e): mikro tipografska lestvica — žetona 2xs/3xs', () => {
  const globals = beri('src/app/globals.css')

  it('@theme vsebuje --text-2xs (10px) in --text-3xs (8px) — bare vrednosti brez line-height', () => {
    expect(globals).toContain('--text-2xs: 0.625rem;')
    expect(globals).toContain('--text-3xs: 0.5rem;')
  })

  it('0 ostankov arbitrary text-[10px]/text-[8px] v src/ (migracija 666 mest — r238-tekst-zetoni.py)', () => {
    expect(globals).not.toContain('text-[10px]')
    expect(globals).not.toContain('text-[8px]')
    const najvecje = ['src/components/roksal/measurements-tab.tsx', 'src/components/roksal/calculator-tab.tsx', 'src/components/roksal/dashboard-tab.tsx']
    for (const f of najvecje) {
      const vsebina = beri(f)
      expect(vsebina).not.toContain('text-[10px]')
      expect(vsebina).not.toContain('text-[8px]')
    }
  })

  it('žetona v uporabi: največja mikro datoteka (measurements-tab) nosi text-2xs/text-3xs', () => {
    const vsebina = beri('src/components/roksal/measurements-tab.tsx')
    expect(vsebina).toContain('text-2xs')
    expect(vsebina).toContain('text-3xs')
  })

  it('tailwind-merge: text-2xs/3xs = font-size skupina (ISTI konflikt-profil kot arbitrary — varnost dokaz)', () => {
    // velikost + barva koeksistirata (kakor text-[10px] + text-red-500)
    expect(twMerge('text-2xs text-red-500')).toBe('text-2xs text-red-500')
    expect(twMerge('text-red-500 text-2xs')).toBe('text-red-500 text-2xs')
    // zadnja velikost v skupini zmaguje (kakor text-[8px] + text-xs)
    expect(twMerge('text-3xs text-xs')).toBe('text-xs')
    expect(twMerge('text-2xs text-3xs')).toBe('text-3xs')
  })
})
