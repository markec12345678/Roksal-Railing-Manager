// R165 — status-options enote + pariteta s strežnikom + FAIL-VERBOSE + DARK strazar.
// ---------------------------------------------------------------------------
// Statusni dropdown (dashboard kartica + podrobnosti) je prej ponudil VSE 7
// statusov — ilegalna izbira je sprožila 409, ki ga je UI TIHO pogoltnil
// (`if (res.ok)` brez else = dvojni bug: dezinformacija + tišina). R165:
// (1) status-options.ts — odsel assertTransition na odjemalcu (dropdown ponudi
//     SAMO prehode, ki jih strežnik sprejme za to vlogo; fail-closed: neznan
//     status → prazne možnosti, neznana vloga → pot ne-vodstva / least privilege);
// (2) handleStatusChange fail-verbose (razlog VEDNO viden — vzorec R161–R163);
// (3) DARK sweep — sistematični bg-white popravki po 13 komponentah (beli kvadrati
//     v temni temi): site-survey, team, notification-center, measurements, pwa-status,
//     password-banner, quick-fab, inclinometer, invoice-manager, inventory,
//     calculator, audit-dialog, signature-quote (podpisno platno = DOKUMENTIRANA
//     izjema — belo v obeh temah, črnilo + PDF izvoz).
// Knjižnica je MIRROR project-state.ts (client-safe: auth.ts vleče strežniške
// module) — pariteto zagotavljata spodnja testa (globoka enakost matrice + vloge
// + dobesedna sporočila napak).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALLOWED_TRANSITIONS_UI,
  PROJECT_STATUS_OPTIONS,
  isManagerRole,
  statusOptionsFor,
  statusOptionsHint,
} from '../status-options'
import { ALLOWED_TRANSITIONS } from '../project-state'
import { MANAGER_ROLES } from '../auth'

const ctx = (over: { vloga?: string | null; dealLocked?: boolean } = {}) => ({
  vloga: over.vloga === undefined ? 'MONTER' : over.vloga,
  dealLocked: over.dealLocked,
})

describe('status-options: PARITETA s strežniškim project-state.ts', () => {
  it('ALLOWED_TRANSITIONS_UI == ALLOWED_TRANSITIONS (globoka enakost, obe smeri)', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS_UI).sort()).toEqual(Object.keys(ALLOWED_TRANSITIONS).sort())
    for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect([...ALLOWED_TRANSITIONS_UI[from as keyof typeof ALLOWED_TRANSITIONS_UI]].sort()).toEqual([...tos].sort())
    }
  })

  it('MANAGER_ROLES_UI == auth MANAGER_ROLES (ADMIN, VODJA) — isManagerRole pariteta', () => {
    expect([...MANAGER_ROLES].sort()).toEqual(['ADMIN', 'VODJA'])
    for (const v of ['ADMIN', 'VODJA']) expect(isManagerRole(v)).toBe(true)
    for (const v of ['MONTER', 'SKLADISCE', 'NEZNANA', '', null, undefined]) expect(isManagerRole(v)).toBe(false)
  })

  it('statusOptionsHint besedila so DOBESEDNO ista kot sporočila InvalidTransitionError', () => {
    const vir = readFileSync(join(process.cwd(), 'src/lib/project-state.ts'), 'utf8')
    for (const besedilo of [
      'Skladišče ne sme spreminjati statusa projekta',
      'Zaklenjen dogovor — sprememba statusa je možna samo preko vodstva',
      'Iz končnega stanja premika samo vodstvo',
    ]) {
      expect(vir).toContain(besedilo) // strežnik
      // UI hinti vračajo ISTO besedilo (prek statusOptionsHint spodaj)
    }
    expect(statusOptionsHint('NACRTOVANO', { vloga: 'SKLADISCE' })).toBe('Skladišče ne sme spreminjati statusa projekta')
    expect(statusOptionsHint('ZA_MONTAZO', { vloga: 'MONTER', dealLocked: true })).toBe(
      'Zaklenjen dogovor — sprememba statusa je možna samo preko vodstva',
    )
    expect(statusOptionsHint('ZAKLJUCENO', { vloga: 'MONTER' })).toBe('Iz končnega stanja premika samo vodstvo')
    expect(statusOptionsHint('NEZNAN', { vloga: 'ADMIN' })).toBe('Neznan status projekta.')
  })

  it('pokriva VSEH 7 statusov prisma enum ProjectStatus', () => {
    expect([...PROJECT_STATUS_OPTIONS].sort()).toEqual(
      ['NACRTOVANO', 'V_TEKU', 'ZA_MONTAZO', 'V_IZDELAVI', 'MONTIRANO', 'ZAKLJUCENO', 'USTAVLJENO'].sort(),
    )
  })
})

describe('statusOptionsFor — matrika za MONTER (ne-vodstvo)', () => {
  it('življenjski cikel: samo dovoljeni nasledniki (nikoli preskoki)', () => {
    expect(statusOptionsFor('NACRTOVANO', ctx())).toEqual(['V_TEKU', 'USTAVLJENO'])
    expect(statusOptionsFor('V_TEKU', ctx())).toEqual(['ZA_MONTAZO', 'V_IZDELAVI', 'USTAVLJENO'])
    expect(statusOptionsFor('ZA_MONTAZO', ctx())).toEqual(['V_IZDELAVI', 'MONTIRANO', 'USTAVLJENO'])
    expect(statusOptionsFor('V_IZDELAVI', ctx())).toEqual(['ZA_MONTAZO', 'MONTIRANO', 'USTAVLJENO'])
    expect(statusOptionsFor('MONTIRANO', ctx())).toEqual(['ZAKLJUCENO'])
  })

  it('končna stanja → prazne možnosti (ponovno odpre samo vodstvo)', () => {
    expect(statusOptionsFor('ZAKLJUCENO', ctx())).toEqual([])
    expect(statusOptionsFor('USTAVLJENO', ctx())).toEqual([])
    expect(statusOptionsHint('ZAKLJUCENO', ctx())).not.toBeNull()
    expect(statusOptionsHint('USTAVLJENO', ctx())).not.toBeNull()
  })

  it('dealLocked: iz ZA_MONTAZO/V_IZDELAVI prazno, DRJAGE stanje normalno (pariteta s strežnikom)', () => {
    // Strežnik blokira SAMO iz ZA_MONTAZO/V_IZDELAVI (assertTransition vrstni red)
    expect(statusOptionsFor('ZA_MONTAZO', ctx({ dealLocked: true }))).toEqual([])
    expect(statusOptionsFor('V_IZDELAVI', ctx({ dealLocked: true }))).toEqual([])
    expect(statusOptionsFor('NACRTOVANO', ctx({ dealLocked: true }))).toEqual(['V_TEKU', 'USTAVLJENO'])
    expect(statusOptionsFor('MONTIRANO', ctx({ dealLocked: true }))).toEqual(['ZAKLJUCENO'])
  })

  it('SKLADISCE → vedno prazno (strežnik: ne sme spreminjati statusa)', () => {
    for (const from of PROJECT_STATUS_OPTIONS) {
      expect(statusOptionsFor(from, { vloga: 'SKLADISCE' })).toEqual([])
    }
  })

  it('neznana vloga (null/undefined) → pot ne-vodstva (least privilege, fail-closed)', () => {
    expect(statusOptionsFor('NACRTOVANO', ctx({ vloga: null }))).toEqual(['V_TEKU', 'USTAVLJENO'])
    expect(statusOptionsFor('ZAKLJUCENO', ctx({ vloga: undefined }))).toEqual([])
  })

  it('neznan status → prazne možnosti (nikoli vse) — obe logi', () => {
    for (const vloga of ['MONTER', 'ADMIN', null]) {
      expect(statusOptionsFor('NEZNAN', { vloga, dealLocked: false })).toEqual([])
      expect(statusOptionsFor('montirano', { vloga, dealLocked: false })).toEqual([]) // lowercase — enum je VEJIKE
      expect(statusOptionsHint('NEZNAN', { vloga, dealLocked: false })).not.toBeNull()
    }
  })
})

describe('statusOptionsFor — vodstvo (ADMIN/VODJA) in UI pogled', () => {
  it('vodstvo: VSE možnosti iz vsakega stanja (strežnik: isManager → karkoli)', () => {
    for (const vloga of ['ADMIN', 'VODJA']) {
      for (const from of PROJECT_STATUS_OPTIONS) {
        expect(statusOptionsFor(from, { vloga })).toEqual([...PROJECT_STATUS_OPTIONS])
        expect(statusOptionsHint(from, { vloga })).toBeNull()
      }
    }
    // Vodstveni obhod: iz končnega stanja in čez deal-lock
    expect(statusOptionsFor('ZAKLJUCENO', { vloga: 'ADMIN' })).toEqual([...PROJECT_STATUS_OPTIONS])
    expect(statusOptionsFor('ZA_MONTAZO', { vloga: 'VODJA', dealLocked: true })).toEqual([...PROJECT_STATUS_OPTIONS])
  })
})

describe('R165 FAIL-VERBOSE strazar (dashboard-tab handleStatusChange)', () => {
  const raw = readFileSync(join(process.cwd(), 'src/components/roksal/dashboard-tab.tsx'), 'utf8')
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '') // block komentarji
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '')) // vrstični komentarji (tudi trailing)
    .join('\n')

  it('neuspešen PATCH ima else vejo z razlogom (prej tiho nič — 409/401/500 pogoltnjen)', () => {
    expect(src).toContain('Status ni bil posodobljen (napaka')
    expect(src).toContain('body?.error?.trim()')
  })

  it('omrežna napaka ima lastno sporočilo (ne generična "Napaka pri posodabljanju statusa")', () => {
    expect(src).toContain('Ni povezave — status ni bil posodobljen')
  })

  it('dropdown uporablja statusOptionsFor (2× : kartica + podrobnosti) in hint pri praznih možnostih', () => {
    const rabi = src.match(/statusOptionsFor\(/g) ?? []
    expect(rabi.length).toBeGreaterThanOrEqual(2)
    expect(src).toContain('statusOptionsHint(')
  })

  it('neznana oznaka nikoli ne izriše "undefined" (?? newStatus / ?? key)', () => {
    expect(src).toContain('statusLabels[newStatus] ?? newStatus')
    expect(src).toContain('statusLabels[key] ?? key')
  })

  it('trenutni status ostane v Selectu (disabled) — Radix SelectValue nikoli prazen', () => {
    expect(src).toContain('opts.includes(detailProject.status)')
  })
})

describe('R165 DARK strazar — sistematični bg-white sweep (14 komponent)', () => {
  // Nauček R163/R164: opisni komentarji smejo omenjati prepovedane vzorce —
  // strazar gleda SAMO izvedljive vrstice (brez komentarjev).
  const datoteke = [
    'dashboard-tab',
    'site-survey-tab',
    'team-tab',
    'signature-quote',
    'notification-center',
    'measurements-tab',
    'pwa-status',
    'password-change-banner',
    'quick-actions-fab',
    'inclinometer-tab',
    'invoice-manager',
    'inventory-tab',
    'calculator-tab',
    'audit-trail-dialog',
  ]

  it('page.tsx: pull-to-refresh indikator ni bel kvadrat v temni temi (bg-card)', () => {
    const raw = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8')
    const src = raw.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
    expect(src).toContain('rounded-full bg-card shadow-lg ring-1 ring-roksal-amber/30')
  })

  it.each(datoteke)('%s: vsaka izvedljiva vrstica z bg-white ima dark: varianto ALI je dokumentirana izjema', (f) => {
    const raw = readFileSync(join(process.cwd(), 'src/components/roksal', `${f}.tsx`), 'utf8')
    // Nauček R165: izjeme (PODPISNO PLATNO) so ZAPISANE kot block komentar —
    // oznako preberemo iz SUROVE vrstice, ŠE Pred stripanjem komentarjev.
    const surove = raw.split('\n')
    const vrstice = surove
      .map((l) => l.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, ''))
    for (let i = 0; i < vrstice.length; i++) {
      const l = vrstice[i]
      if (!l.includes('bg-white')) continue
      const opaka = /bg-white(?![/\w-])/.test(l) // bg-white, ne bg-white/10 overlay na temnem platnu
      if (!opaka) continue
      const izjema = surove[i].includes('PODPISNO PLATNO') // signature-quote — belo v OBEH temah (črnilo + PDF)
      expect(izjema || l.includes('dark:')).toBe(true)
    }
  })

  it('site-survey-tab: red-50 čipi imajo dark: varianti (cevi/vtičnice — R165 dodano)', () => {
    const raw = readFileSync(join(process.cwd(), 'src/components/roksal/site-survey-tab.tsx'), 'utf8')
    const src = raw.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
    expect(src).toMatch(/border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950\/40 dark:text-red-300/)
  })

  it('team-tab: deaktivirani/zaaklenjeni člani imajo dark: obrobe', () => {
    const raw = readFileSync(join(process.cwd(), 'src/components/roksal/team-tab.tsx'), 'utf8')
    const src = raw.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
    expect(src).toContain('border-stone-200 dark:border-stone-700')
    expect(src).toContain('border-roksal-red/40 dark:border-roksal-red/50')
  })

  it('calculator-tab: neizbrani amber čip ima dark: varianti', () => {
    const raw = readFileSync(join(process.cwd(), 'src/components/roksal/calculator-tab.tsx'), 'utf8')
    const src = raw.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
    expect(src).toMatch(
      /border-amber-300 bg-white text-amber-800 dark:border-amber-800\/60 dark:bg-amber-950\/30 dark:text-amber-300/,
    )
  })
})
