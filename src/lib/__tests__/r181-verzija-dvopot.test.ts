// R181 — DVOPOTNA preverba verzije (P0 popravek produkcije):
// ---------------------------------------------------------------------------
// Ugotovljeno na produkciji: /api/version vrne 401 (telo iz proxy-ja) ŠE PO
// dveh deployih (R179 16:26 UTC, R180 17:11 UTC — 78+ min), medtem ko kontrolni
// eksperimenti dokazujejo, da proxy prepušča vse STARE javne poti:
//   • /api/setup        → 200 (R137 entry prepuščen — ruta odgovorila)
//   • /api/auth/demo    → 200
//   • /api/jobs/run     → 401 z razlogom IZ RUTE (R141 entry prepuščen)
//   • /api/public/probe → 404 (prefix /api/public prepuščen — ni rute)
// Sklep: Vercel poganja STAR (pre-R179) middleware artefakt — "propagacija"
// je izključena (78+ min). Rešitev brez infrastrukturnih posegov: dvojček
// rute pod prefixom /api/public (deluje pod OBAJEMA artefaktoma) + banner
// poskusi primarno, nato rezervno pot.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

describe('R181 P0 — dvojček /api/public/version', () => {
  it('ruta obstaja in vrača IZKLJUČNO build žig (isto polje kot /api/version — brez db/auth)', () => {
    const src = srcOf('src/app/api/public/version/route.ts')
    expect(src).toMatch(/export async function GET\(\)/)
    expect(src).toMatch(/process\.env\.NEXT_PUBLIC_BUILD_STAMP \?\? null/)
    expect(src).toContain('Response.json({ build })')
    // ničesar ne izdaja: v datoteki je SAMO ena ruta, brez uvozov db/auth
    expect(src.match(/export async function/g)).toHaveLength(1)
    expect(src).not.toMatch(/@\/lib\/db|@\/lib\/auth|authenticate/)
  })

  it('razlaga v ruta komentarju omenja kontrolne eksperimente (404 probe — dokaz prefixa)', () => {
    const src = srcOf('src/app/api/public/version/route.ts')
    expect(src).toContain('R181')
    expect(src).toContain('/api/public/probe')
  })
})

describe('R181 P0 — update-banner dvopotno žičenje', () => {
  const banner = (): string => srcOf('src/components/roksal/update-banner.tsx')

  it('primarna pot /api/public/version, rezervna /api/version — v TEM vrstnem redu', () => {
    const src = banner()
    const primarna = src.indexOf("fetch('/api/public/version')")
    const rezervna = src.indexOf("fetch('/api/version')")
    expect(primarna).toBeGreaterThan(-1)
    expect(rezervna).toBeGreaterThan(primarna)
    // rezervna pot se sproži SAMO, če primarna ni uspešna (!res.ok)
    expect(src).toMatch(/let res = await fetch\('\/api\/public\/version'\)\s*\n\s*if \(!res\.ok\) \{\s*\n\s*\/\/ rezervna pot[^\n]*\n\s*res = await fetch\('\/api\/version'\)\s*\n\s*\}/)
  })

  it('fail-closed ostane: neuspeh obeh poti → žig null → banner skrit (nikoli lažnega "nova verzija")', () => {
    const src = banner()
    // setStreznikovZig je samo v uspešni veji (1× set) + Skrij gumb (null reset)
    expect(src.match(/setStreznikovZig\(zig\)/g)).toHaveLength(1)
    expect(src).toMatch(/if \(!res\.ok\) return/)
  })
})

describe('R181 P0 — proxy pokritost prefixa', () => {
  it("PUBLIC_PREFIXES vsebuje '/api/public' (stari artefakt na produkciji ta prefix prepušča — probe 404)", () => {
    const src = srcOf('src/proxy.ts')
    expect(src).toContain("'/api/public',")
  })
})
