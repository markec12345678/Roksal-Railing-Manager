// R163 — vodja-csv enote + fail-verbose/dark regresijski stražar.
// ---------------------------------------------------------------------------
// (1) vodja-csv (izvoz dnevnega pregleda vodje): družinski standard —
//     determinizem (2 klica = enak izhod; referenčni datum kot parameter),
//     RFC 4180 citiranje (CSV injekcija zaščita), IZVOŽENO = ZASLON
//     (EUR format enak formatEUR, statusi enaki značkam prek
//     terminStatusLabel — EN vir resnice za izvoz in UI), fail-closed
//     TypeError na pokvarjenih podatkih, striktno deterministično ime
//     datoteke. Opozorilni števci 0 gredo v izvoz (arhivska resnica).
// (2) FAIL-VERBOSE STRAŽAR: vodja-dashboard ne sme več vsebovati vzorca
//     `res.ok ? await … : []` (lažne ničle) in logistics-tab ne sme več
//     vsebovati `catch { /* ignore */ } finally { setLoading(false) }` —
//     kršitev = rdeči test (isti razred zaščite kot R161/R162).
// (3) DARK STRAŽAR: svetlo-trdo kodirane površine v vodja-dashboard (bg-*-50,
//     border-*-200/300, text-*-700/900) MORAJO imeti dark: varianto na isti
//     vrstici — kršitev = rdeči test (temna tema je bila R162 systematicno
//     popravljena; ta test preprečuje regresijo).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildVodjaCsv,
  vodjaCsvFilename,
  formatEurCsv,
  terminStatusLabel,
  type VodjaKpi,
  type VodjaTerminCsvRow,
} from '../vodja-csv'

const ROOT = join(__dirname, '..', '..')

const kpi = (over: Partial<VodjaKpi> = {}): VodjaKpi => ({
  danasTermini: 3,
  danasZakljuceni: 1,
  danasVpripravi: 1,
  mesecnoProjektov: 5,
  mesecniPrihodek: 12340,
  mesecnaMarza: 3085,
  mesecnoUr: 64,
  odprtoZnesek: 7890,
  zapadloZnesek: 1200,
  zapadloSt: 2,
  potekliOpomniki: 1,
  nizkaZaloga: 2,
  odprtaNarocila: 3,
  skupajProjektov: 42,
  skupajStrank: 17,
  skupniLTV: 98765,
  ...over,
})

const termin = (over: Partial<VodjaTerminCsvRow> = {}): VodjaTerminCsvRow => ({
  datumZacetka: '2026-09-26T07:30:00.000Z',
  status: 'V_TEKU',
  project: { nazivProjekta: 'Balkon Kranj', customer: { ime: 'Janez Novak' } },
  crew: { naziv: 'Ekipa A' },
  ...over,
})

describe('vodja-csv: glava + strukture', () => {
  it('ima BOM + naslov + datum izvoza (DD.MM.YYYY) + sekcijo glave', () => {
    const { csv } = buildVodjaCsv({ kpi: kpi(), termini: [], prihodki: [], danesIso: '2026-09-26' })
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"Pregled za vodjo — dnevni izvoz","26.09.2026"')
    expect(csv).toContain('"Sekcija","Kazalnik","Vrednost"')
  })

  it('vsebuje vse KPI sekcije (Danes ×3, Ta mesec ×6, Opozorila ×3, Skupno ×3)', () => {
    const { csv } = buildVodjaCsv({ kpi: kpi(), termini: [], prihodki: [], danesIso: '2026-09-26' })
    expect(csv).toContain('"Danes","Termini","3"')
    expect(csv).toContain('"Danes","V teku","1"')
    expect(csv).toContain('"Danes","Zaključeni","1"')
    expect(csv).toContain('"Ta mesec","Prihodek (plačano)","12.340 €"')
    expect(csv).toContain('"Ta mesec","Marža (25%)","3.085 €"')
    expect(csv).toContain('"Ta mesec","Projektov","5"')
    expect(csv).toContain('"Ta mesec","Ure","64"')
    expect(csv).toContain('"Ta mesec","Odprto (izdano)","7.890 €"')
    expect(csv).toContain('"Ta mesec","Zapadlo","1.200 € (2)"')
    expect(csv).toContain('"Opozorila","Potekli opomniki","1"')
    expect(csv).toContain('"Opozorila","Nizka zaloga","2"')
    expect(csv).toContain('"Opozorila","Odprta naročila","3"')
    expect(csv).toContain('"Skupno","Projektov","42"')
    expect(csv).toContain('"Skupno","Strank","17"')
    expect(csv).toContain('"Skupno","Skupni LTV","98.765 €"')
  })

  it('je 100 % determinističen (2 klica = enak izhod)', () => {
    const a = buildVodjaCsv({ kpi: kpi(), termini: [termin()], prihodki: [{ label: 'maj', eur: 500 }], danesIso: '2026-09-26' })
    const b = buildVodjaCsv({ kpi: kpi(), termini: [termin()], prihodki: [{ label: 'maj', eur: 500 }], danesIso: '2026-09-26' })
    expect(a.csv).toBe(b.csv)
    expect(a.vrstic).toBe(b.vrstic)
  })

  it('opozorilni števci 0 gredo v izvoz (arhivska resnica — zaslon jih skriva, izvoz ne)', () => {
    const { csv } = buildVodjaCsv({
      kpi: kpi({ potekliOpomniki: 0, nizkaZaloga: 0, odprtaNarocila: 0 }),
      termini: [],
      prihodki: [],
      danesIso: '2026-09-26',
    })
    expect(csv).toContain('"Opozorila","Potekli opomniki","0"')
    expect(csv).toContain('"Opozorila","Nizka zaloga","0"')
    expect(csv).toContain('"Opozorila","Odprta naročila","0"')
  })

  it('prihodki po mesecih so v izvozu (isti podatki kot stolpčni graf)', () => {
    const { csv } = buildVodjaCsv({
      kpi: kpi(),
      termini: [],
      prihodki: [
        { label: 'apr', eur: 0 },
        { label: 'sep', eur: 15000 },
      ],
      danesIso: '2026-09-26',
    })
    expect(csv).toContain('"Prihodki","apr","0 €"')
    expect(csv).toContain('"Prihodki","sep","15.000 €"')
  })
})

describe('vodja-csv: današnji termini (IZVOŽENO = ZASLON)', () => {
  it('glava stolpcev Čas/Projekt/Stranka/Ekipa/Status + vrstica s statusom kot značka', () => {
    const { csv } = buildVodjaCsv({ kpi: kpi(), termini: [termin()], prihodki: [], danesIso: '2026-09-26' })
    expect(csv).toContain('"Čas","Projekt","Stranka","Ekipa","Status"')
    expect(csv).toContain('"07:30","Balkon Kranj","Janez Novak","Ekipa A","V teku"')
  })

  it('status preslikan v ISTA besedila kot UI značke (en vir resnice — terminStatusLabel)', () => {
    const { csv } = buildVodjaCsv({
      kpi: kpi(),
      termini: [termin({ status: 'ZAKLJUCENO' }), termin({ status: 'NACRTOVANO' })],
      prihodki: [],
      danesIso: '2026-09-26',
    })
    expect(csv).toContain('"Zaključeno"')
    expect(csv).toContain('"Načrtovano"')
  })

  it('null stranka/ekipa → PRAZNI stolpci (nikoli "null" ali izmišljeno besedilo)', () => {
    const { csv } = buildVodjaCsv({
      kpi: kpi(),
      termini: [termin({ crew: null, project: { nazivProjekta: 'Balkon Bled', customer: null } })],
      prihodki: [],
      danesIso: '2026-09-26',
    })
    expect(csv).toContain('"07:30","Balkon Bled",,,')
  })

  it('CSV injekcija zaščita: narekovaji in vejice v imenu projekta citirani/podvojeni', () => {
    const { csv } = buildVodjaCsv({
      kpi: kpi(),
      termini: [termin({ project: { nazivProjekta: 'Balkon, "veliki" / vrt', customer: { ime: 'Novak, Janez' } } })],
      prihodki: [],
      danesIso: '2026-09-26',
    })
    expect(csv).toContain('"Balkon, ""veliki"" / vrt"')
    expect(csv).toContain('"Novak, Janez"')
  })
})

describe('formatEurCsv: EUR format = ISTI prikaz kot formatEUR na zaslonu', () => {
  it('grupira tisočice s piko (sl-SI), 0 decimalk, presledek pred €', () => {
    expect(formatEurCsv(0)).toBe('0 €')
    expect(formatEurCsv(999)).toBe('999 €')
    expect(formatEurCsv(1234)).toBe('1.234 €')
    expect(formatEurCsv(1234567)).toBe('1.234.567 €')
    expect(formatEurCsv(123.4)).toBe('123 €')
    expect(formatEurCsv(123.6)).toBe('124 €')
  })

  it('negativni znesek ( credit nota) → znak pred številom', () => {
    expect(formatEurCsv(-1234)).toBe('-1.234 €')
  })

  it('fail-closed na NaN/Infinity/ne-številu', () => {
    expect(() => formatEurCsv(Number.NaN)).toThrow(TypeError)
    expect(() => formatEurCsv(Number.POSITIVE_INFINITY)).toThrow(TypeError)
    expect(() => formatEurCsv('100' as unknown as number)).toThrow(TypeError)
  })
})

describe('terminStatusLabel: pariteta z UI + dokumentiran fallback', () => {
  it('znani statusi → ISTA besedila kot značke v "Današnji termini"', () => {
    expect(terminStatusLabel('ZAKLJUCENO')).toBe('Zaključeno')
    expect(terminStatusLabel('V_TEKU')).toBe('V teku')
    expect(terminStatusLabel('NACRTOVANO')).toBe('Načrtovano')
  })

  it('neznan status → "Načrtovano" (ISTI UI fallback — sintetizirani termini nosijo projektne statuse)', () => {
    expect(terminStatusLabel('PONUDBA')).toBe('Načrtovano')
    expect(terminStatusLabel('NEZMAN')).toBe('Načrtovano')
  })
})

describe('vodja-csv: fail-closed (TypeError na pokvarjenih podatkih)', () => {
  it('ne-polje terminov/prihodkov → TypeError', () => {
    expect(() => buildVodjaCsv({ kpi: kpi(), termini: 'x' as unknown as VodjaTerminCsvRow[], prihodki: [], danesIso: '2026-09-26' })).toThrow(TypeError)
    expect(() => buildVodjaCsv({ kpi: kpi(), termini: [], prihodki: 'x' as unknown as never[], danesIso: '2026-09-26' })).toThrow(TypeError)
  })

  it('neveljaven referenčni datum → TypeError (tudi nemogoč "2026-13-99" — vzorec R161)', () => {
    expect(() => buildVodjaCsv({ kpi: kpi(), termini: [], prihodki: [], danesIso: 'abc' })).toThrow(TypeError)
    expect(() => buildVodjaCsv({ kpi: kpi(), termini: [], prihodki: [], danesIso: '2026-13-99' })).toThrow(TypeError)
  })

  it('termin brez nazivProjekta / z neveljavnim datumZacetek → TypeError', () => {
    expect(() => buildVodjaCsv({
      kpi: kpi(),
      termini: [termin({ project: { nazivProjekta: '  ', customer: null } })],
      prihodki: [],
      danesIso: '2026-09-26',
    })).toThrow(TypeError)
    expect(() => buildVodjaCsv({
      kpi: kpi(),
      termini: [termin({ datumZacetka: 'ne-datum' })],
      prihodki: [],
      danesIso: '2026-09-26',
    })).toThrow(TypeError)
  })

  it('negativen/ne-cel števec → TypeError (količine so celoštevilske resnice)', () => {
    expect(() => buildVodjaCsv({ kpi: kpi({ danasTermini: -1 }), termini: [], prihodki: [], danesIso: '2026-09-26' })).toThrow(TypeError)
    expect(() => buildVodjaCsv({ kpi: kpi({ skupajStrank: 2.5 }), termini: [], prihodki: [], danesIso: '2026-09-26' })).toThrow(TypeError)
  })

  it('ne-končen znesek → TypeError', () => {
    expect(() => buildVodjaCsv({ kpi: kpi({ mesecniPrihodek: Number.NaN }), termini: [], prihodki: [], danesIso: '2026-09-26' })).toThrow(TypeError)
  })

  it('prihodek vrstica brez label → TypeError', () => {
    expect(() => buildVodjaCsv({
      kpi: kpi(),
      termini: [],
      prihodki: [{ label: '  ', eur: 10 }],
      danesIso: '2026-09-26',
    })).toThrow(TypeError)
  })
})

describe('vodjaCsvFilename: deterministično ime (striktno)', () => {
  it('pregled-vodje_<YYYY-MM-DD>.csv', () => {
    expect(vodjaCsvFilename('2026-09-26')).toBe('pregled-vodje_2026-09-26.csv')
  })

  it('zavrne ne-ISO in nemogoče datume', () => {
    expect(() => vodjaCsvFilename('26.09.2026')).toThrow(TypeError)
    expect(() => vodjaCsvFilename('2026-13-99')).toThrow(TypeError)
    expect(() => vodjaCsvFilename('')).toThrow(TypeError)
  })
})

describe('R163 fail-verbose stražar: lažne ničle + tihi catch so PREPOVEDANI', () => {
  const vodja = readFileSync(join(ROOT, 'components', 'roksal', 'vodja-dashboard.tsx'), 'utf8')
  const logistics = readFileSync(join(ROOT, 'components', 'roksal', 'logistics-tab.tsx'), 'utf8')
  /** Koda brez komentarjev — glavni opisni komentarji smejo omenjati pretekel
   *  vzorec (ker ga dokumentirajo); stražar gleda SAMO izvedljive vrstice. */
  const code = (src: string) => src.split('\n').filter((l) => {
    const t = l.trim()
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
  }).join('\n')

  it('vodja-dashboard ne sme več vsebovati vzorca `res.ok ? await` (lažne ničle)', () => {
    expect(code(vodja)).not.toMatch(/res\.ok \? await/)
    expect(code(vodja)).not.toMatch(/\.ok \? await .*: \[\]/)
  })

  it('vodja-dashboard mora imeti error state + Poskusi znova + isti fetch razlog', () => {
    expect(code(vodja)).toContain('setLoadError')
    expect(code(vodja)).toContain('role="alert"')
    expect(code(vodja)).toContain('Poskusi znova')
    expect(code(vodja)).toContain("credentials: 'same-origin'")
  })

  it('logistics-tab ne sme več vsebovati `catch { /* ignore */ } finally { setLoading(false) }`', () => {
    expect(logistics).not.toContain('catch { /* ignore */ } finally { setLoading(false) }')
    expect(code(logistics)).toContain('setLoadError')
    expect(code(logistics)).toContain('role="alert"')
    expect(code(logistics)).toContain('Poskusi znova')
    expect(code(logistics)).toContain("credentials: 'same-origin'")
  })

  it('vodja-dashboard mora imeti izvoz gumb + uporabljati terminStatusLabel (en vir resnice)', () => {
    expect(code(vodja)).toContain('Izvozi dnevni pregled vodje kot CSV')
    expect(code(vodja)).toContain('buildVodjaCsv')
    expect(code(vodja)).toContain('terminStatusLabel(')
  })
})

describe('R163 dark stražar: svetlo-trdo kodirane površine morajo imeti dark: varianto', () => {
  const vodja = readFileSync(join(ROOT, 'components', 'roksal', 'vodja-dashboard.tsx'), 'utf8')
  const lines = vodja.split('\n').filter((l) => {
    const t = l.trim()
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
  })

  const assertDarkVariant = (pattern: RegExp, opis: string) => {
    const hits = lines.filter((l) => pattern.test(l) && !l.includes('dark:'))
    expect(hits, `${opis}: vrstice brez dark: variante:\n${hits.join('\n')}`).toEqual([])
  }

  it('bg-*-50 opozorilne/kartice površine imajo dark:', () => {
    assertDarkVariant(/bg-(red|amber|blue|green)-50\b/, 'bg-*-50')
  })

  it('border-*-200/300 kartični robovi imajo dark:', () => {
    assertDarkVariant(/border-(red|amber|blue|green|purple)-[23]00\b/, 'border-*-200/300')
  })

  it('text-*-700/900 na barvnih površinah ima dark:text-', () => {
    assertDarkVariant(/text-(red|amber|blue|green)-(700|900)\b/, 'text-*-700/900')
  })

  it('text-*-600 ikone na barvnih površinah imajo dark:text-', () => {
    assertDarkVariant(/text-(red|amber|blue|green|purple)-600\b/, 'text-*-600')
  })
})
