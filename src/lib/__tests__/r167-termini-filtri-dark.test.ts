// R167 — termini filtri + deljeno besedilo + DARK token sweep stražar.
// ---------------------------------------------------------------------------
// Runda R167 doda:
//  (1) filtrirajTermini — "samo moje termine" filter (fail-closed: brez
//      znane identitete → prazen seznam, NIKOLI "vsi");
//  (2) buildTerminShareText — deterministično besedilo za odložišče
//      (EN VIR RESNICE z oznakami kartice; manjkajoči podatki → vrstica
//      izpuščena, nikoli izmišljenih 'Ni …' nizov v deljenem besedilu);
//  (3) žičenje v TerminiCard (aria-pressed stikalo samo z identiteto;
//      kopiraj gumb kot SIBLING, ne gnezden gumb; fail-verbose toast);
//  (4) DARK token sweep stražar — R167 sweep je dodal dark: variante
//      obarvanih svetlih žetonov v 25 datotekah (328 vrstic); ta test
//      onemogoča regresijo (nova vrstica z bg-X-50/100, border-X-200/300,
//      text-X-500..900 BREZ dark: = rdeči test).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildTerminShareText,
  filtrirajTermini,
  scheduleTerminiStatusLabel,
  terminDatumLabel,
  type TerminPrikazVnos,
} from '../termini-prikaz'

// Referenčni trenutek: sobota 26. 9. 2026, 12:00 po LOKALNEM koledarju.
const NOW = new Date(2026, 8, 26, 12, 0, 0)
const danesOsem = new Date(2026, 8, 26, 8, 0, 0).toISOString()
const jutriDevet = new Date(2026, 8, 27, 9, 30, 0).toISOString()

function vnos(overrides: Partial<TerminPrikazVnos> = {}): TerminPrikazVnos {
  return {
    id: 't1',
    projectId: 'p1',
    projektIme: 'Projekt A',
    strankaIme: 'Stranka 1',
    strankaNaslov: 'Naslov 1',
    lokacija: 'Cesta na tam 12',
    ekipaIme: 'Ekipa 1',
    monterId: 'm1',
    monterIme: 'Miha',
    status: 'NAVRTENO',
    datumZacetka: danesOsem,
    predvideneUre: 8,
    moja: false,
    ...overrides,
  }
}

describe('R167 filtrirajTermini — fail-closed "samo moje"', () => {
  it('ne-polje → TypeError (fail-closed)', () => {
    expect(() => filtrirajTermini(null as never, false, 'm1')).toThrow(TypeError)
    expect(() => filtrirajTermini('polno' as never, true, 'm1')).toThrow(TypeError)
  })

  it('samoMoje=false → NOVO polje z vsemi vnosi, vrstni red ohranjen', () => {
    const a = vnos({ id: 'a' })
    const b = vnos({ id: 'b', monterId: 'm2' })
    const izhod = filtrirajTermini([a, b], false, 'm1')
    expect(izhod).toHaveLength(2)
    expect(izhod[0].id).toBe('a')
    expect(izhod[1].id).toBe('b')
    expect(izhod).not.toBe([a, b]) // kopija, ne ista referenca
  })

  it('samoMoje=true + myUserId → samo natanko moji (monterId === myUserId)', () => {
    const moj = vnos({ id: 'moj', monterId: 'm1' })
    const tuj = vnos({ id: 'tuj', monterId: 'm2' })
    const brez = vnos({ id: 'brez', monterId: null })
    const izhod = filtrirajTermini([moj, tuj, brez], true, 'm1')
    expect(izhod).toHaveLength(1)
    expect(izhod[0].id).toBe('moj')
  })

  it('samoMoje=true BREZ identitete (null/prazen) → PRAZEN seznam (nikoli "vsi")', () => {
    const moj = vnos({ id: 'moj', monterId: 'm1' })
    expect(filtrirajTermini([moj], true, null)).toEqual([])
    expect(filtrirajTermini([moj], true, '')).toEqual([])
  })

  it('vhod ostane nespremenjen (čista funkcija — determinizem)', () => {
    const a = vnos({ id: 'a', monterId: 'm1' })
    const kopija = [...[a]]
    filtrirajTermini([a], true, 'm1')
    expect([a]).toEqual(kopija)
    expect(a.monterId).toBe('m1')
  })
})

describe('R167 buildTerminShareText — deterministično, iskreno deljeno besedilo', () => {
  it('poln vnos → fiksni vrstni red vrstic, Danes + ura + status', () => {
    const besedilo = buildTerminShareText(vnos(), NOW)
    const vrstice = besedilo.split('\n')
    expect(vrstice[0]).toBe(`Termin montaže — Danes ob 08:00`)
    expect(vrstice[1]).toBe('Projekt: Projekt A')
    expect(vrstice[2]).toBe('Stranka: Stranka 1')
    expect(vrstice[3]).toBe('Naslov: Naslov 1')
    expect(vrstice[4]).toBe('Lokacija: Cesta na tam 12')
    expect(vrstice[5]).toBe('Ekipa: Ekipa 1')
    expect(vrstice[6]).toBe('Monter: Miha')
    expect(vrstice[7]).toBe('Status: Načrtovano')
    expect(vrstice).toHaveLength(8)
  })

  it('EN VIR RESNICE: status/datum/ura = ISTE funkcije kot na kartici', () => {
    const preklican = vnos({ status: 'PREKlicANO' })
    const besedilo = buildTerminShareText(preklican, NOW)
    expect(besedilo).toContain(`Status: ${scheduleTerminiStatusLabel('PREKlicANO')}`)
    expect(besedilo).toContain('Preklicano') // nikoli lažno 'Načrtovano'
    expect(besedilo).toContain(terminDatumLabel(danesOsem, NOW))
  })

  it('manjkajoči podatki → vrstice IZPUŠČENE (nikoli izmišljeni "Ni …" nizi)', () => {
    const minimalen = vnos({
      projektIme: null,
      strankaIme: null,
      strankaNaslov: null,
      lokacija: null,
      ekipaIme: null,
      monterIme: null,
    })
    const besedilo = buildTerminShareText(minimalen, NOW)
    const vrstice = besedilo.split('\n')
    expect(vrstice).toHaveLength(2) // glava + status
    expect(besedilo).not.toContain('Ni ')
    expect(besedilo).not.toContain('null')
    expect(besedilo).not.toContain('undefined')
  })

  it('Jutri/datum oznake = ISTA terminDatumLabel logika (izvoženo = zaslon)', () => {
    const besedilo = buildTerminShareText(vnos({ datumZacetka: jutriDevet }), NOW)
    expect(besedilo.split('\n')[0]).toBe(
      `Termin montaže — ${terminDatumLabel(jutriDevet, NOW)} ob 09:30`
    )
  })

  it('determinizem: isti (vnos, now) → isti niz, dvakrat', () => {
    const t = vnos()
    expect(buildTerminShareText(t, NOW)).toBe(buildTerminShareText(t, NOW))
  })

  it('fail-closed: pokvarjen vnos / now / datum → TypeError (nikoli lažno besedilo)', () => {
    expect(() => buildTerminShareText(null as never, NOW)).toThrow(TypeError)
    expect(() => buildTerminShareText({} as never, NOW)).toThrow(TypeError)
    expect(() => buildTerminShareText(vnos({ id: '' }), NOW)).toThrow(TypeError)
    expect(() => buildTerminShareText(vnos(), new Date('ne-datuma' as never))).toThrow(TypeError)
    expect(() =>
      buildTerminShareText(vnos({ datumZacetka: '2026-13-99T08:00:00Z' }), NOW)
    ).toThrow(TypeError)
    expect(() =>
      buildTerminShareText(vnos({ status: 'neznano' as never }), NOW)
    ).toThrow(TypeError)
  })
})

describe('R167 žičenje stražar (TerminiCard)', () => {
  const raw = readFileSync(join(process.cwd(), 'src/components/roksal/termini-card.tsx'), 'utf8')

  it('"Samo moje" stikalo: aria-pressed + SAMO z identiteto (least privilege)', () => {
    expect(raw).toContain('aria-pressed={samoMoje}')
    expect(raw).toContain('aria-label="Samo moje termine"')
    // stikalo znotraj pogoja myUserId && — brez identitete se ne izriše
    expect(raw).toMatch(/\{myUserId && \(\s*<Button[\s\S]{0,400}?Samo moje/)
  })

  it('kopiraj gumb je SIBLING, ne gnezden gumb (neveljavni HTML/hidracija)', () => {
    expect(raw).toContain('<div key={t.id} className="relative">')
    // vrstica-button in kopiraj gumb sta ločena elementa v ovojnici
    expect(raw).toContain('aria-label={kopirajLabel}')
    // label izračunan IZVEN JSX (nauček R165 — a11y skener)
    expect(raw).toMatch(/const kopirajLabel = `Kopiraj podrobnosti termina: \$\{t\.projektIme \?\? 'Ni imena projekta'\}`/)
  })

  it('clipboard fail-verbose: uspeh IN napaka sta vidna toasta (sonner)', () => {
    expect(raw).toContain("import { toast } from 'sonner'")
    expect(raw).toContain('navigator.clipboard.writeText(besedilo)')
    expect(raw).toContain("toast.success('Termin kopiran v odložišče')")
    // napaka odložišča NI tiha — NotAllowedError ima lastno, iskreno sporočilo
    expect(raw).toContain("err.name === 'NotAllowedError'")
    expect(raw).toContain('toast.error(')
  })

  it('filter je čista lib funkcija; preskočeni števec ostane RAW (podatkovna resnica)', () => {
    expect(raw).toContain('filtrirajTermini(skupine.danes, samoMoje, myUserId)')
    expect(raw).toContain('filtrirajTermini(skupine.kasneje, samoMoje, myUserId)')
    // preskoceni iz skupine (vsi raw vnosi), ne iz prikazane
    expect(raw).toMatch(/const preskoceni =\s*\n\s*\(skupine\?\.preskoceniNeveljaven/)
    expect(raw).not.toMatch(/prikazane\?\.preskoceniNeveljaven/)
  })

  it('iskreno prazno stanje ob filtru ("Ni vaših terminov")', () => {
    expect(raw).toContain("'Ni vaših terminov v naslednjih 7 dneh.'")
  })

  it('novi UI žetoni imajo dark: variante (nauček R162–R166)', () => {
    // kopiraj gumb
    expect(raw).toMatch(/dark:focus-visible:ring-roksal-ink\/40 dark:hover:text-roksal-ink/)
    // stikalo
    expect(raw).toMatch(/dark:focus-visible:ring-roksal-ink\/40"\s*\n\s*onClick=\{\(\) => setSamoMoje/)
  })
})

// ---------------------------------------------------------------------------
// (4) DARK token sweep stražar — R167 (328 vrstic / 25 datotek).
// Vsaka izvedljiva vrstica, ki vsebuje obarvan svetel žeton BREZ variantne
// predpone, MORA imeti 'dark:' na vrstici (ali biti v dokumentirani izjemi).
const SWEPPANE_DATOTEKE = [
  'audit-trail-dialog',
  'calculator-tab',
  'dashboard-tab',
  'deal-pipeline',
  'documents-tab',
  'inclinometer-tab',
  'invoice-manager',
  'logistics-tab',
  'material-intelligence-tab',
  'measurement-studio',
  'measurements-tab',
  'notification-center',
  'password-change-banner',
  'password-dialog',
  'photo-measure',
  'post-signature-panel',
  'punch-list',
  'pwa-status',
  'roksal-catalog',
  'safety-tab',
  'signature-quote',
  'site-survey-tab',
  'sketch-canvas',
  'team-tab',
  'weather-card',
] as const

const BARVE =
  'gray|stone|slate|zinc|neutral|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

const CILJNI_ZETONI = [
  new RegExp(`\\bbg-(${BARVE})-50\\b`, 'g'),
  new RegExp(`\\bbg-(${BARVE})-100\\b`, 'g'),
  new RegExp(`\\bhover:bg-(${BARVE})-50\\b`, 'g'),
  new RegExp(`\\bhover:bg-(${BARVE})-100\\b`, 'g'),
  new RegExp(`\\bborder-(${BARVE})-200(?:/\\d+)?\\b`, 'g'),
  new RegExp(`\\bborder-(${BARVE})-300(?:/\\d+)?\\b`, 'g'),
  new RegExp(`\\bborder-(${BARVE})-400(?:/\\d+)?\\b`, 'g'),
  new RegExp(`\\btext-(${BARVE})-500(?:/\\d+)?\\b`, 'g'),
  new RegExp(`\\btext-(${BARVE})-600(?:/\\d+)?\\b`, 'g'),
  new RegExp(`\\btext-(${BARVE})-700(?:/\\d+)?\\b`, 'g'),
  new RegExp(`\\btext-(${BARVE})-800(?:/\\d+)?\\b`, 'g'),
  new RegExp(`\\btext-(${BARVE})-900(?:/\\d+)?\\b`, 'g'),
]

/** Ista semantika kot sweep skripta: žeton z variantno predpono (hover:,
 *  group-hover:, md: …) se ne šteje — razen hover:bg/hover:text, ki imajo
 *  svoja pravila (tej vrstici mora biti dark: vseeno na vrstici). */
function kriveVrstice(raw: string): string[] {
  const krive: string[] = []
  const vrstice = raw.split('\n')
  vrstice.forEach((vrstica, i) => {
    const jedro = vrstica.trim()
    if (
      jedro.startsWith('//') ||
      jedro.startsWith('*') ||
      jedro.startsWith('/*') ||
      jedro.startsWith('import ')
    ) {
      return
    }
    if (vrstica.includes('dark:')) return // namerna zasnova ali že swept
    for (const regex of CILJNI_ZETONI) {
      for (const m of vrstica.matchAll(regex)) {
        const start = m.index ?? 0
        // variantna predpona? (znak pred žetonom je ':' → poišči ime)
        if (start > 0 && vrstica[start - 1] === ':') {
          let k = start - 1
          while (k > 0 && (/[a-z0-9-]/.test(vrstica[k - 1]!))) k -= 1
          const predpona = vrstica.slice(k, start - 1)
          if (predpona === 'hover') continue // hover:bg/text pravila — pokrita
          continue // group-hover:/md:/focus: … = namerna, konservativno izjema
        }
        krive.push(`${i + 1}: ${jedro.slice(0, 120)}`)
        break
      }
    }
  })
  return krive
}

describe('R167 DARK token sweep stražar — obarvan svetel žeton mora imeti dark:', () => {
  it.each(SWEPPANE_DATOTEKE)(
    '%s.tsx — brez golih bg-X-50/100, border-X-200/300/400, text-X-500..900',
    (f) => {
      const raw = readFileSync(join(process.cwd(), 'src/components/roksal', `${f}.tsx`), 'utf8')
      const krive = kriveVrstice(raw)
      expect(krive).toEqual([])
    }
  )

  it('izjeme obstajajo in ostajajo dokumentirane (list ne gniije)', () => {
    // ZAŠČITENO jedro + svetla platna/kamera overlayji + namerni badge —
    // sweep jih NIMA dotakniti; če datoteka izgine, se lista posodobi.
    const izjeme = [
      'cv-studio',
      'fence-3d-viewer',
      'webxr-scanner',
      'ar-scanner',
      'photo-tab',
      'map-measure',
      'bottom-nav',
    ]
    for (const f of izjeme) {
      const pot = join(process.cwd(), 'src/components/roksal', `${f}.tsx`)
      expect(() => readFileSync(pot, 'utf8')).not.toThrow()
    }
  })

  it('bottom-nav badge ostane namerno bg-white na navy pilonu (dokumentirano)', () => {
    const raw = readFileSync(join(process.cwd(), 'src/components/roksal/bottom-nav.tsx'), 'utf8')
    expect(raw).toContain("'bg-white text-roksal-navy'")
  })
})
