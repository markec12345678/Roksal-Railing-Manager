// R166 — termini-prikaz enote + FAIL-VERBOSE + DARK stražar (TerminiCard).
// ---------------------------------------------------------------------------
// Nova kartica "Termini — naslednjih 7 dni" (dashboard) je bralni agregat nad
// GET /api/schedules. Testi pokrivajo:
//  (1) iskrene statusne oznake (vodja-csv.terminStatusLabel NE pozna
//      PREKlicANO/PRELOZENO — tam bi lažno pokazal 'Načrtovano');
//  (2) fail-closed normalizacijo (neznan status / neveljaven datum →
//      preskočeno števec, nikoli izmišljena vrstica);
//  (3) determinizem okna + skupin (now kot parameter, brez skite ure);
//  (4) FAIL-VERBOSE stražar (padec APIja je viden panel — vzorec R161–R163);
//  (5) DARK stražar (brez golih bg-white na izvedljivih vrsticah; barve
//      statusov imajo dark: variante — nauček R162–R165);
//  (6) žičenje v dashboard-tab (fail-closed openTerminiProject: klik odpre
//      podrobnosti SAMO za projekt iz naloženega seznama).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SCHEDULE_TERMINI_STATUSI,
  SCHEDULE_TERMINI_STATUS_COLORS,
  SCHEDULE_TERMINI_STATUS_LABELS,
  groupTermini,
  normalizirajTermin,
  scheduleTerminiStatusColor,
  scheduleTerminiStatusLabel,
  terminCasLabel,
  terminDatumLabel,
  terminiOkno,
} from '../termini-prikaz'

// Referenčni trenutek: sobota 26. 9. 2026, 12:00 po LOKALNEM koledarju.
const NOW = new Date(2026, 8, 26, 12, 0, 0)
const danesOsem = new Date(2026, 8, 26, 8, 0, 0).toISOString()
const jutriDevet = new Date(2026, 8, 27, 9, 30, 0).toISOString()
const cezMesec = new Date(2026, 9, 26, 8, 0, 0).toISOString()

function termin(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 't1',
    projectId: 'p1',
    datumZacetka: danesOsem,
    status: 'NAVRTENO',
    lokacija: 'Cesta na tam 12',
    project: { id: 'p1', nazivProjekta: 'Projekt A', customer: { ime: 'Stranka 1', naslov: 'Naslov 1' } },
    crew: { id: 'c1', naziv: 'Ekipa 1', barva: '#ff0000' },
    monter: { id: 'm1', ime: 'Miha' },
    ...overrides,
  }
}

describe('R166 statusne oznake — iskrene, brez lažnega "Načrtovano"', () => {
  it('vseh 5 prisma statusov ima besedilo in barvo (schema.prisma InstallationSchedule.status)', () => {
    expect(SCHEDULE_TERMINI_STATUSI).toEqual([
      'NAVRTENO',
      'V_TEKU',
      'ZAKLJUCENO',
      'PREKlicANO',
      'PRELOZENO',
    ])
    for (const s of SCHEDULE_TERMINI_STATUSI) {
      expect(SCHEDULE_TERMINI_STATUS_LABELS[s].length).toBeGreaterThan(2)
      expect(SCHEDULE_TERMINI_STATUS_COLORS[s]).toContain('dark:')
    }
  })

  it('PREKlicANO NI "Načrtovano" (vodja-csv preslikava bi lažala — zato ločena mapa)', () => {
    expect(scheduleTerminiStatusLabel('PREKlicANO')).toBe('Preklicano')
    expect(scheduleTerminiStatusLabel('PRELOZENO')).toBe('Preloženo')
    expect(scheduleTerminiStatusLabel('NAVRTENO')).toBe('Načrtovano')
    expect(scheduleTerminiStatusLabel('V_TEKU')).toBe('V teku')
    expect(scheduleTerminiStatusLabel('ZAKLJUCENO')).toBe('Zaključeno')
  })

  it('neznan status → TypeError (fail-closed; lowercase "navrteno" tudi)', () => {
    expect(() => scheduleTerminiStatusLabel('MONTIRANO')).toThrow(TypeError)
    expect(() => scheduleTerminiStatusLabel('navrteno')).toThrow(TypeError)
    expect(() => scheduleTerminiStatusLabel('')).toThrow(TypeError)
    expect(() => scheduleTerminiStatusColor('NEZNAN')).toThrow(TypeError)
  })
})

describe('R166 terminiOkno — deterministično 7-dnevno okno', () => {
  it('od = polnoč danes (lokalno), do = 7 dni kasneje minus 1 ms', () => {
    const okno = terminiOkno(NOW)
    const od = new Date(okno.od)
    expect(od.getFullYear()).toBe(2026)
    expect(od.getMonth()).toBe(8)
    expect(od.getDate()).toBe(26)
    expect(od.getHours()).toBe(0)
    const razlika = new Date(okno.do).getTime() - od.getTime()
    expect(razlika).toBe(7 * 86400000 - 1)
  })

  it('ista sekunda vnosa → isto okno (determinizem); neveljaven now → TypeError', () => {
    expect(terminiOkno(NOW)).toEqual(terminiOkno(new Date(2026, 8, 26, 23, 59, 59)))
    expect(() => terminiOkno(new Date('ne-veljaven'))).toThrow(TypeError)
  })
})

describe('R166 normalizacija + skupine — fail-closed, brez izmišljanja', () => {
  it('veljaven vnos → prikazna vrstica z imeni; moja montaža po monter.id', () => {
    const r = normalizirajTermin(termin(), 'm1')
    expect('vnos' in r && r.vnos.moja).toBe(true)
    const r2 = normalizirajTermin(termin(), 'drugi')
    expect('vnos' in r2 && r2.vnos.moja).toBe(false)
    const r3 = normalizirajTermin(termin(), null)
    expect('vnos' in r3 && r3.vnos.moja).toBe(false)
  })

  it('manjkajoča imena → null (UI pokaže "Ni …"), NIKOLI izmišljeni nizi', () => {
    const r = normalizirajTermin(termin({ project: { id: 'p1', nazivProjekta: null, customer: null }, crew: null, monter: null }), 'm1')
    if (!('vnos' in r)) throw new Error('pričakovan veljaven vnos')
    expect(r.vnos.projektIme).toBeNull()
    expect(r.vnos.strankaIme).toBeNull()
    expect(r.vnos.ekipaIme).toBeNull()
    expect(r.vnos.monterId).toBeNull()
  })

  it('neznan status → preskočen kot "status"; neveljaven/okrnjen vnos → "oblika"', () => {
    const g = groupTermini(
      [termin({ status: 'MONTIRANO' }), termin({ id: 'x', datumZacetka: '2026-13-99T08:00:00Z' }), null, 'besedilo', termin({ id: '' })],
      NOW,
      'm1'
    )
    expect(g.preskoceniNeznanStatus).toBe(1)
    expect(g.preskoceniNeveljaven).toBe(4)
    expect(g.danes.length + g.kasneje.length).toBe(0)
  })

  it('danes vs. kasneje po LOKALNEM koledarju; sortacija po času nato po id', () => {
    const g = groupTermini(
      [
        termin({ id: 'b', datumZacetka: danesOsem }),
        termin({ id: 'a', datumZacetka: danesOsem }), // izenačen čas → id 'a' prej
        termin({ id: 'c', datumZacetka: jutriDevet }),
        termin({ id: 'd', datumZacetka: cezMesec }), // izven okna — vrnjen kot kasneje (API filtrira)
      ],
      NOW,
      'm1'
    )
    expect(g.danes.map((t) => t.id)).toEqual(['a', 'b'])
    expect(g.kasneje.map((t) => t.id)).toEqual(['c', 'd'])
  })

  it('ne-polje vnosov → TypeError (klicatelj pokaže fail-verbose panel)', () => {
    expect(() => groupTermini('ni polje' as unknown as unknown[], NOW, null)).toThrow(TypeError)
    expect(() => groupTermini([], new Date('x'), null)).toThrow(TypeError)
  })
})

describe('R166 časovne oznake — sl-SI, deterministično glede na now', () => {
  it('ura iz vnosa (08:00), ne iz trenutka branja', () => {
    expect(terminCasLabel(danesOsem)).toBe('08:00')
    expect(terminCasLabel(jutriDevet)).toBe('09:30')
    expect(() => terminCasLabel('napaka')).toThrow(TypeError)
  })

  it('Danes / Jutri / krajši datum — lokalni koledar, nikoli obrnjeno', () => {
    expect(terminDatumLabel(danesOsem, NOW)).toBe('Danes')
    expect(terminDatumLabel(jutriDevet, NOW)).toBe('Jutri')
    expect(terminDatumLabel(cezMesec, NOW)).toMatch(/\d{2}\. \d{2}\./)
    expect(() => terminDatumLabel('napaka', NOW)).toThrow(TypeError)
    expect(() => terminDatumLabel(danesOsem, new Date('napaka'))).toThrow(TypeError)
  })
})

describe('R166 FAIL-VERBOSE + DARK + žičenje stražar (TerminiCard)', () => {
  const raw = readFileSync(join(process.cwd(), 'src/components/roksal/termini-card.tsx'), 'utf8')
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '') // block komentarji
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '')) // vrstični komentarji
    .join('\n')

  it('padec APIja ima vidno vlogo z razlogom (prej ni kartice — zdaj fail-verbose)', () => {
    expect(src).toContain('role="alert"')
    expect(src).toContain('razlogIzOdgovora')
    expect(src).toContain('Poskusi znova')
  })

  it('neveljaven JSON/odgovor NI tiho prazno stanje (Array.isArray preverba)', () => {
    expect(src).toContain('Neveljaven odgovor strežnika (ni seznam terminov).')
    expect(src).toContain('Array.isArray(data)')
    // Nauček E2E R166: `res.json().catch(() => null)` MASKIRA AbortError
    // (abort sredi branja telesa → lažno "Neveljaven odgovor" med nalaganjem).
    // Pravilno: json() v lastnem try/catch z eksplicitno signal preverbo.
    expect(src).not.toContain('res.json().catch')
    expect(src).toContain('if (controller.signal.aborted) return')
  })

  it('myUserId NI odvisnost fetcha (useMemo izračun — brez dvojnega branja ob prihodu id-ja)', () => {
    expect(src).toContain('useMemo(')
    const naloziDeps = src.slice(src.indexOf('const nalozi = useCallback')).slice(0, 2200)
    expect(naloziDeps).toContain('}, [])')
    expect(naloziDeps).not.toContain('[myUserId])')
  })

  it('omrežna napaka ima lastno sporočilo + prekinjene zahteve se ne prikažejo kot napaka', () => {
    expect(src).toContain('Ni povezave — termini niso naloženi')
    expect(src).toContain('controller.signal.aborted')
    expect(src).toContain("credentials: 'same-origin'")
  })

  it('BARVE statusov iz knjižnice (EN VIR RESNICE) — brez lastnih besedilnih oznak', () => {
    expect(src).toContain('scheduleTerminiStatusColor(t.status)')
    expect(src).toContain('scheduleTerminiStatusLabel(t.status)')
    // vodja-csv.terminStatusLabel NE sme zaživeti v kartici (ne pozna PREKlicANO)
    expect(src).not.toContain('terminStatusLabel(')
  })

  it('DARK: brez golih bg-white na izvedljivih vrsticah; roki so semantični', () => {
    const surove = raw.split('\n').map((l) => l.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, ''))
    const kršitve = surove.filter((l) => /(^|[\s"'])bg-white(\s|["']|$)/.test(l))
    expect(kršitve).toEqual([])
    expect(src).toContain('border-l-roksal-amber bg-roksal-amber/10')
    expect(src).toContain('focus-visible:ring-roksal-ink/40')
  })

  it('dashboard-tab: kartica žičena z myUserId + fail-closed openTerminiProject (find, brez sinteze)', () => {
    const dash = readFileSync(join(process.cwd(), 'src/components/roksal/dashboard-tab.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .join('\n')
    expect(dash).toContain('<TerminiCard myUserId={myUserId} onOpenProjectId={openTerminiProject} />')
    const fn = dash.slice(dash.indexOf('function openTerminiProject'))
    expect(fn).toContain('projects.find((p) => p.id === projectId)')
    expect(fn).toContain('if (projekt) openProjectDetail(projekt)')
    expect(dash).toContain("if (typeof uid === 'string' && uid.length > 0) setMyUserId(uid)")
  })
})

describe('R166 DARK obrobni stražar — border-roksal-navy/N mora imeti dark: varianto', () => {
  // Nauček R163–R166: obrobe roksal-navy v temni temi izginejo (#1d2b3e na
  // #1a2744). Sweep R166 (scripts/r166-navy-border-sweep.py) je dodal
  // dark:border-roksal-ink/M po konvenciji obstoječih vrstic. IZJEME = svetla
  // platna / kamera overlayji (NAMERNO svetli v OBEH temah, ocenjeno R166):
  // floor-plan-tab (risalna platno), cv-studio, fence-3d-viewer (3D scena),
  // webxr-scanner, ar-scanner (kamera). Stražar gleda IZVEDLJIVE vrstice
  // (brez komentarjev — nauček R163) in prizna vsako dark:...border- zasnovo
  // (tudi namerni dark:border-roksal-amber v crm-tab).
  const izjeme = new Set([
    'floor-plan-tab',
    'cv-studio',
    'fence-3d-viewer',
    'webxr-scanner',
    'ar-scanner',
  ])

  it.each([
    'calculator-tab',
    'measurements-tab',
    'dashboard-tab',
    'vodja-dashboard',
    'bottom-nav',
    'quote-followup',
    'post-signature-panel',
    'signature-quote',
    'invoice-manager',
    'jobs-panel',
    'roksal-catalog',
    'photo-tab',
    'reference-gallery',
    'material-intelligence-tab',
    'logistics-tab',
    'pdf-export',
    'inventory-tab',
    'site-survey-tab',
    'team-tab',
    'notification-center',
    'crm-tab',
    'deal-pipeline',
    'measurement-studio',
    'inclinometer-tab',
  ])('%s: vsaka izvedljiva vrstica z border-roksal-navy/ ima dark: obrobno varianto', (f) => {
    const raw = readFileSync(join(process.cwd(), 'src/components/roksal', `${f}.tsx`), 'utf8')
    const vrstice = raw
      .split('\n')
      .map((l) => l.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, ''))
    const kršitve = vrstice
      .map((l, i) => ({ l, n: i + 1 }))
      .filter(({ l }) => l.includes('border-roksal-navy/'))
      .filter(({ l }) => !/dark:(?:[a-z-]+:)*border-/.test(l))
    expect(kršitve).toEqual([])
  })

  it('izjemne datoteke (svetla platna) so DOKUMENTIRANE in obstajajo', () => {
    for (const f of izjeme) {
      expect(() =>
        readFileSync(join(process.cwd(), 'src/components/roksal', `${f}.tsx`), 'utf8')
      ).not.toThrow()
    }
  })
})
