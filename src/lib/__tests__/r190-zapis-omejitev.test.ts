// R190 — omejevanje hitrosti na pisanju (val 1) + `write` telemetrijska družina.
// ---------------------------------------------------------------------------
// VARNOST.md "Omejevanje hitrosti na drugih rutah": WRITE_LIMIT (300/min) je
// bil od R135 pripravljen, a ne vklopljen — pisanje po API-ju je imelo samo
// avtenticirano zaščito, brez ovire za zankaste kliente (tudi neavtenticirane,
// ki do handlerja pridejo pred auth preverbo). R190 val 1: helper
// `zapisOmejitev(request, ruta)` (ključ `write:<ruta>:<ip>`) + guard kot PRVI
// stavek v 10 handlerjih / 9 računsko intenzivnih rutah (calculator, quote,
// viz/render, viz/preview, viz/product-preview, viz/stage, measurement/detect,
// measurement/confirm, sync POST+DELETE).
//
// Družinske pravice, ki jih testi varujejo:
//  (a) 429 telo = ISTA fail-verbose družina kot prijava (R137/R189):
//      { error: 'Preveč zahtev.', detail: 'Poskusi znova čez N s.' } +
//      `Retry-After` glava — brez tihe blokade.
//  (b) telemetrija (R184): zavržen zadetek = trip s kategorijo `write` —
//      ADMIN panel v Ekipi ga prikaže samodejno (modra značka, ne jantar
//      auth družine — tehnična blokada, ne napad na prijavo).
//  (c) izolacija proračuna: po ruti IN po IP (pisarna NAT si deli proračun
//      na rundo — dokumentiran kompromis; različni klienti se ne derejo).
//  (d) determinizem: brez uranja, čisto jedro — resetRateLimit() v beforeEach.
import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  WRITE_LIMIT,
  checkRate,
  zapisOmejitev,
  rateLimitDetail,
  resetRateLimit,
} from '../rate-limit'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

/** Zahteva z določenim IP (vzorec x-forwarded-for, kot ga pošilja proxy). */
const zahtevaIz = (ip: string): Request =>
  new Request('https://roksal.example/api/test', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  })

const VAL1_RUTE: Array<[string, string, string[]]> = [
  ['src/app/api/calculator/route.ts', 'calculator', ['POST']],
  ['src/app/api/quote/route.ts', 'quote', ['POST']],
  ['src/app/api/viz/render/route.ts', 'viz/render', ['POST']],
  ['src/app/api/viz/preview/route.ts', 'viz/preview', ['POST']],
  ['src/app/api/viz/product-preview/route.ts', 'viz/product-preview', ['POST']],
  ['src/app/api/viz/stage/route.ts', 'viz/stage', ['POST']],
  ['src/app/api/measurement/detect/route.ts', 'measurement/detect', ['POST']],
  ['src/app/api/measurement/confirm/route.ts', 'measurement/confirm', ['POST']],
  ['src/app/api/sync/route.ts', 'sync', ['POST', 'DELETE']],
]

beforeEach(() => {
  resetRateLimit()
})

describe('R190 — čisto jedro: zapisOmejitev()', () => {
  it('WRITE_LIMIT ostane velikodušen (300 / 60 s — lovi samo zankaste kliente)', () => {
    expect(WRITE_LIMIT).toEqual({ limit: 300, windowMs: 60 * 1000 })
  })

  it('pod limitom vrne null (handler se nadaljuje) — vzorčnih 5 zahtevkov', () => {
    for (let i = 0; i < 5; i++) {
      expect(zapisOmejitev(zahtevaIz('203.0.113.10'), 'test-ruta')).toBeNull()
    }
  })

  it('na limitu+1 vrne 429: fail-verbose telo (družina prijave) + Retry-After glava', async () => {
    const ip = '203.0.113.20'
    for (let i = 0; i < WRITE_LIMIT.limit; i++) {
      expect(zapisOmejitev(zahtevaIz(ip), 'test-ruta')).toBeNull()
    }
    const zavrnjena = zapisOmejitev(zahtevaIz(ip), 'test-ruta')
    expect(zavrnjena).not.toBeNull()
    expect(zavrnjena!.status).toBe(429)
    expect(zavrnjena!.headers.get('Retry-After')).toMatch(/^\d+$/)
    const telo = (await zavrnjena!.json()) as { error: string; detail: string }
    expect(telo.error).toBe('Preveč zahtev.')
    expect(telo.detail).toMatch(/^Poskusi znova čez \d+ s\.$/)
    // Retry-After se ujema s številom v detail (EN VIR, nič razhajanja):
    const sekunde = Number(zavrnjena!.headers.get('Retry-After'))
    expect(telo.detail).toBe(`Poskusi znova čez ${sekunde} s.`)
    expect(sekunde).toBeGreaterThan(0)
    expect(sekunde).toBeLessThanOrEqual(60)
  })

  it('proračun je izoliran PO RUTI — blokada na eni rundi ne blokira druge', () => {
    const ip = '203.0.113.30'
    for (let i = 0; i < WRITE_LIMIT.limit; i++) {
      zapisOmejitev(zahtevaIz(ip), 'calculator')
    }
    expect(zapisOmejitev(zahtevaIz(ip), 'calculator')).not.toBeNull()
    expect(zapisOmejitev(zahtevaIz(ip), 'quote')).toBeNull()
  })

  it('proračun je izoliran PO IP — dva klienta se ne deresta', () => {
    for (let i = 0; i < WRITE_LIMIT.limit; i++) {
      zapisOmejitev(zahtevaIz('203.0.113.40'), 'test-ruta')
    }
    expect(zapisOmejitev(zahtevaIz('203.0.113.40'), 'test-ruta')).not.toBeNull()
    expect(zapisOmejitev(zahtevaIz('203.0.113.41'), 'test-ruta')).toBeNull()
  })

  it('zavrnjen zadetek = trip v telemetriji s kategorijo `write` (R184 vzorec)', async () => {
    resetRateLimit()
    const ip = '203.0.113.50'
    for (let i = 0; i < WRITE_LIMIT.limit; i++) {
      zapisOmejitev(zahtevaIz(ip), 'test-ruta')
    }
    zapisOmejitev(zahtevaIz(ip), 'test-ruta')
    const detail = rateLimitDetail()
    expect(detail.tripsTotal).toBeGreaterThanOrEqual(1)
    const trip = detail.trips.find((t) => t.kind === 'write')
    expect(trip).toBeDefined()
    expect(trip!.count).toBeGreaterThanOrEqual(1)
    // brez PII: prstni odtis je krajšani hash, NE surov IP:
    expect(trip!.keyHash).toMatch(/^[0-9a-f]{10}$/)
    expect(trip!.keyHash).not.toContain(ip)
  })
})

describe('R190 — val 1 žičenje: guard je prvi stavek v vseh 10 handlerjih', () => {
  for (const [pot, ruta, handlerji] of VAL1_RUTE) {
    for (const handler of handlerji) {
      it(`${pot} — ${handler}: import + guard pred delom handlerja (ruta '${ruta}')`, () => {
        const src = srcOf(pot)
        // import je prisoten (enkrat):
        expect(src.match(/import \{ zapisOmejitev \} from '@\/lib\/rate-limit'/g)?.length).toBe(1)
        // guard dvakrat zapored (const + if), s pravo ruto — realna vrstica,
        // brez regex escape igre (vzorec r190):
        const zaporedje = `const zavrnjeno = zapisOmejitev(request, '${ruta}')
  if (zavrnjeno) return zavrnjeno`
        const stZaporedij = src.split(zaporedje).length - 1
        expect(stZaporedij).toBe(handlerji.length)
        // guard je PRED vsem delom handlerja (auth, JSON parse, prisma …):
        const deklaracija = src.indexOf(`export async function ${handler}(request: Request)`)
        expect(deklaracija).toBeGreaterThanOrEqual(0)
        // iskanje znotraj handlerja (sync ima POST+DELETE — indexOf od deklaracije):
        const teloOd = src.slice(deklaracija)
        const guardVHandlerju = teloOd.indexOf(`zapisOmejitev(request, '${ruta}')`)
        expect(guardVHandlerju).toBeGreaterThan(0)
        expect(guardVHandlerju).toBeLessThan(400)
        const teloPoGuardu = teloOd.slice(guardVHandlerju)
        const authKlic = teloPoGuardu.indexOf('await authenticate(')
        const jsonParse = teloPoGuardu.indexOf('request.json()')
        // kaj koli od tega mora biti ŠELE za guardom (ali pa sploh ni):
        if (authKlic >= 0) expect(authKlic).toBeGreaterThan(0)
        if (jsonParse >= 0) expect(jsonParse).toBeGreaterThan(0)
      })
    }
  }

  it('val 1 pokrije točno 9 datotek — vsaka z natanko takim številom guardov, kot ima handlerjev', () => {
    const skupaj = VAL1_RUTE.reduce((n, [, , h]) => n + h.length, 0)
    expect(skupaj).toBe(10)
    for (const [pot, ruta, handlerji] of VAL1_RUTE) {
      const src = srcOf(pot)
      const stGuardov = src.match(new RegExp(`zapisOmejitev\\(request, '${ruta}'\\)`, 'g'))?.length ?? 0
      expect(stGuardov).toBe(handlerji.length)
    }
  })
})

describe('R190 — ADMIN panel: `write` družina je prvorazredna (značka + legenda)', () => {
  it('kindBadge: `write` = modra značka z dark ogledalom na ISTI vrstici (družina 25)', () => {
    const src = srcOf('src/components/roksal/rate-limit-panel.tsx')
    expect(src).toContain("if (kind === 'write') {")
    // celoten className v eni vrstici — bg + text + ring + dark ogledala:
    expect(src).toMatch(
      /'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-300 dark:bg-blue-500\/15 dark:text-blue-300 dark:ring-blue-500\/30'/,
    )
  })

  it('telemetrija note omenja `write` kategorijo in val 1 rute (poštena legenda)', () => {
    const src = srcOf('src/app/api/security/rate-limit/route.ts')
    expect(src).toMatch(/kategorija `write` = zankasti klient na pisanju/)
    expect(src).toContain('val 1')
  })
})
