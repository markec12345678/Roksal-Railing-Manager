// R319 — STRAŽAR: scripts/qa.sh (parametriziran QA dispatcher).
// ---------------------------------------------------------------------------
// Konsolidacija ~891 QA skriptov: ENA vstopna točka po rundi + fazi. Ta test
// zaklepa dispatcher pred driftom (fail-closed ×4):
//   1. Datoteka OBSTOJA in je izvršljiva (bash) — anti-stale.
//   2. Preslikava faz (needles/smoke/e2e/prodqa) ima VSE štiri cilje za
//      ZADNJO rundo na disku (discovery — isti algoritem kot qa.sh latest).
//   3. Prenosljivost: substitucija LEGACY_ROOT je prisotna IN obvezno
//      varovana z `bash -n` (nikoli tiho pokvarjena skripta).
//   4. Fail-closed izstopi: neznana faza = 2, manjkajoča skripta = 3,
//      pokvarjena substitucija = 4 — izrecno v viru (anti-stale regresija).
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const QA = join(process.cwd(), 'scripts', 'qa.sh')
const SCRIPTS = join(process.cwd(), 'scripts')

/** Enak algoritem kot `qa.sh latest` — zadnja runda med rN-build-needles.sh. */
function latestRound(): number {
  const rounds = readdirSync(SCRIPTS)
    .map((f) => /^r(\d+)-build-needles\.sh$/.exec(f))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
  expect(rounds.length, 'repozitorij mora imeti vsaj eno rund (rN-build-needles.sh)').toBeGreaterThan(0)
  return Math.max(...rounds)
}

describe('R319 — scripts/qa.sh (QA dispatcher, konsolidacija)', () => {
  it('obstaja, je izvršljiva in je bash skripta (anti-stale)', () => {
    expect(existsSync(QA)).toBe(true)
    const st = statSync(QA)
    expect(st.isFile()).toBe(true)
    expect(st.mode & 0o111, 'izvršljiva (chmod +x)').not.toBe(0)
    expect(readFileSync(QA, 'utf8').startsWith('#!/bin/bash')).toBe(true)
  })

  it('vse ŠIRI faze zadnje runde obstajajo na disku (preslikava je popolna)', () => {
    const r = latestRound()
    const vir = readFileSync(QA, 'utf8')
    for (const [faza, datoteka] of [
      ['needles', `r${r}-build-needles.sh`],
      ['smoke', `r${r}-run-smoke.sh`],
      ['e2e', `r${r}-e2e-browser.sh`],
      ['prodqa', `r${r}-prod-qa.sh`],
    ] as const) {
      expect(vir, `faza ${faza} je izrecno preslikana`).toContain(`${faza})`)
      expect(existsSync(join(SCRIPTS, datoteka)), `${datoteka} obstaja`).toBe(true)
    }
  })

  it('prenosljivost: substitucija LEGACY_ROOT varovana z bash -n (nikoli tiho)', () => {
    const vir = readFileSync(QA, 'utf8')
    expect(vir).toContain('/home/z/my-project')
    // Varnostni uklep: substitucija BREZ sintaksnega pregleda je prepovedana.
    expect(vir).toContain('bash -n')
    // Originali ostanejo nedotaknjeni — substitucija gre v temp kopijo.
    expect(vir).toMatch(/mktemp/)
    expect(vir).toContain('original nedotaknjen')
  })

  it('fail-closed izstopi so izrecni: 2 (neznana faza), 3 (manjka), 4 (sintaksa)', () => {
    const vir = readFileSync(QA, 'utf8')
    expect(vir).toContain('exit 2')
    expect(vir).toContain('exit 3')
    expect(vir).toContain('exit 4')
    // Zamrznjeni kanon: skripte se NE brišejo — dispatcher samo odkriva.
    expect(vir).toContain('se NE')
  })
})
