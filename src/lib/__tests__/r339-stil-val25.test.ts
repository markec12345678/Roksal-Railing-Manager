// R339 — MANDATORY STIL val 25 (r162/…/R337 vzorec): hover parity za
// revizijsko sled meritev (audit trail badge).
// ---------------------------------------------------------------------------
//  • vzorec R280 tip badge + R281 sync žig: title razložljivost +
//    cursor-help — vsak vnos zgodovine sprememb razloži svojo akcijo;
//  • EN VIR naslov: auditActionTitles v measurements/labels.ts (badge in
//    testi bereta ISTO mapo — divergenca nemogoča);
//  • 0 novih hex (0-hex kanon val 15–24);
//  • obrnjene regresije: val 24 pill ŽIVA (vodja nespremenjen: amber/50 ×11,
//    press-scale ×18) + val 23 navy/40 ŽIVA + globals .press-scale ŽIV;
//  • register sodelovanje: R338 NE ureja vodje → vsi val8/val9/val23/val24
//    pini OSTANEJO na R337 resnici (anti-stale dokaz obratne smeri).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { auditActionLabels, auditActionTitles } from '@/components/roksal/measurements/labels'

const TAB = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')
const LABELS = join(process.cwd(), 'src/components/roksal/measurements/labels.ts')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')
const KARTICA = join(process.cwd(), 'src/components/roksal/sistem-zdravje-card.tsx')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')

const tab = readFileSync(TAB, 'utf8')
const labelsVir = readFileSync(LABELS, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')
const kartica = readFileSync(KARTICA, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')

const AKCIJE = ['ADD', 'EDIT', 'DELETE', 'STATUS'] as const

/** Okno vrstic okoli iskanega niza (ISTA ekstrakcija kot val8 STRAŽAR). */
function oknoOkoli(vir: string, iskalni: string): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(iskalni))
  if (i < 0) return ''
  return vrstice.slice(Math.max(0, i - 8), i + 6).join('\n')
}

describe('r339 STIL val 25 — hover parity revizijske sledi: EN VIR + R280 vzorec', () => {
  it('auditActionTitles EN VIR — vse 4 akcije z razložljivim naslovom (isti niz kot badge)', () => {
    expect(Object.keys(auditActionTitles).sort()).toEqual([...AKCIJE].sort())
    for (const a of AKCIJE) {
      expect(auditActionTitles[a]).toContain('Revizija:')
      expect(auditActionTitles[a].length).toBeGreaterThan(30)
    }
    expect(auditActionTitles.ADD).toContain('nova meritev')
    expect(auditActionTitles.EDIT).toContain('novo verzijo')
    expect(auditActionTitles.DELETE).toContain('iskrena praznina')
    expect(auditActionTitles.STATUS).toContain('perzistentno')
  })

  it('labels.ts nosi val 25 žig + badge je viden v glavni datoteki z title EN VIR', () => {
    expect(labelsVir).toContain('R339 STIL val 25 — hover parity za revizijsko sled')
    expect(labelsVir).toContain('export const auditActionTitles')
    const badge = oknoOkoli(tab, 'title={auditActionTitles[entry.akcija]}')
    expect(badge).toContain('auditActionLabels[entry.akcija]')
    expect(badge).toContain('variant="outline"')
    expect(badge).toContain('cursor-help')
  })

  it('isti vzorec kot R280/R281 hover parity družina (title + cursor-help na žigu)', () => {
    // R280 vzorec: cursor-help + title — enaka kombinacija na novem badge-u
    const badge = oknoOkoli(tab, 'title={auditActionTitles[entry.akcija]}')
    expect(badge).toContain('cursor-help')
    expect(badge).toContain('title=')
    // R338 komentar je institucionalni spomin (LEKCIJA R336 1: zgodovinski
    // zapiski ostanejo)
    expect(tab).toContain('R339 STIL val 25')
    expect(tab).toContain('R280 tip badge + R281 sync žig')
  })

  it('0 surovih hex barv na novem badge-u + v labels.ts (0-hex kanon)', () => {
    const badge = oknoOkoli(tab, 'title={auditActionTitles[entry.akcija]}')
    expect(badge).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(labelsVir).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('obrnjena regresija: val 24 pill ŽIVA (vodja nespremenjen) + val 23 navy/40 ŽIVA + globals .press-scale ŽIV', () => {
    // val 24: AI raba CSV pill v vodji — amber/50 ring + testid ŠE VEDNO ŽIVA
    const aiPill = oknoOkoli(vodja, 'aria-label="Izvozi pregled AI rabe kot CSV"')
    expect(aiPill).toContain('data-testid="ai-raba-csv-pill"')
    expect(aiPill).toContain('press-scale')
    expect(aiPill).toContain('focus-visible:ring-roksal-amber/50')
    // val 23: sistem zdravje pill — navy/40 v kartici
    const zdravjeGumb = oknoOkoli(kartica, 'aria-label="Izvozi sistem zdravje kot CSV"')
    expect(zdravjeGumb).toContain('focus-visible:ring-roksal-navy/40')
    // globals anti-stale
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('transform: scale(0.97)')
  })

  it('register sodelovanje: R339 ureja SAMO measurements → val8/val9/val24 pini OSTANEJO na R337/R338 resnici (anti-stale obratna smer)', () => {
    // val8 register = 11 GUMBOV (bločna okno ekstrakcija val8 — ISTA metoda);
    // surovi niz = 12 pojavitev (11 gumbov + 1 odstopanje okna ekstrakcije
    // na sosednjih blokih — enota gumb ostane kanon, pin na surovi resnici
    // dokumentira obe štetji).
    expect(vodja.split('focus-visible:ring-roksal-amber/50').length - 1).toBe(12)
    // val9 taktilni register ×18 (R337 PIN SHIFT ne-dvig)
    expect(vodja.split('press-scale').length - 1).toBe(18)
  })
})
