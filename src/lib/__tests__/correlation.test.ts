// R139 (issue #5 §22) — testi correlation ID pomožnika.
// ---------------------------------------------------------------------------
// Dokazuje deterministično pogodbo:
//   • veljaven klientov correlation ID se prevzame (isti ID ↔ isti dogodek),
//   • neveljaven (prekratek, tuji znaki, predolg) → crypto.randomUUID rezerva,
//   • logWithCorrelation izpiše ENO obliko JSON ({ event, correlationId, error })
//     — brez stacka in brez Prisma internals (§22 kontrakt),
//   • correlationErrorSummary je varen za Error / string / object / cikličen
//     objekt (nikoli ne vrže).

import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  CORRELATION_HEADER,
  correlationFromRequest,
  correlationErrorSummary,
  logWithCorrelation,
} from '@/lib/correlation'

function reqWith(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/test', { headers })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('correlationFromRequest (§22)', () => {
  it('veljaven klientov ID se prevzame dobesedno', () => {
    const id = 'cron-loop-20260926-abc-123'
    const req = reqWith({ [CORRELATION_HEADER]: id })
    expect(correlationFromRequest(req)).toBe(id)
  })

  it('prekratek ID (< 8) → rezerva UUID', () => {
    const out = correlationFromRequest(reqWith({ [CORRELATION_HEADER]: 'abc' }))
    expect(out).toMatch(UUID_RE)
    expect(out).not.toBe('abc')
  })

  it('ID s tujimi znaki → rezerva UUID (ničesar ne prenese v log)', () => {
    const out = correlationFromRequest(reqWith({ [CORRELATION_HEADER]: 'abc\t<script>alert(1)</script>' }))
    expect(out).toMatch(UUID_RE)
  })

  it('predolg ID (> 128) → rezerva UUID', () => {
    const out = correlationFromRequest(reqWith({ [CORRELATION_HEADER]: 'x'.repeat(129) }))
    expect(out).toMatch(UUID_RE)
  })

  it('točno 128 veljavnih znakov se prevzame', () => {
    const id = 'a'.repeat(128)
    expect(correlationFromRequest(reqWith({ [CORRELATION_HEADER]: id }))).toBe(id)
  })

  it('brez glave → UUID (dev/direktni klici brez proxy plasti)', () => {
    expect(correlationFromRequest(reqWith({}))).toMatch(UUID_RE)
  })
})

describe('correlationErrorSummary', () => {
  it('Error → message', () => {
    expect(correlationErrorSummary(new Error('ne dela'))).toBe('ne dela')
  })

  it('string → dobesedno', () => {
    expect(correlationErrorSummary('banana')).toBe('banana')
  })

  it('object → JSON', () => {
    expect(correlationErrorSummary({ code: 'P2002' })).toBe('{"code":"P2002"}')
  })

  it('cikličen object → varno oznako, NE vrže', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    expect(correlationErrorSummary(a)).toBe('[neznana napaka]')
  })

  it('undefined → varno oznako (JSON.stringify(undefined) je undefined)', () => {
    expect(correlationErrorSummary(undefined)).toBe('[neznana napaka]')
  })
})

describe('logWithCorrelation — ENA oblika loga čez rute', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('izpiše { event, correlationId, error } kot ENO JSON vrstico', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logWithCorrelation('schedules.get', 'corr-123', new Error('konec zaloge'))
    expect(spy).toHaveBeenCalledTimes(1)
    const raw = spy.mock.calls[0][0] as string
    const parsed = JSON.parse(raw)
    expect(parsed).toEqual({ event: 'schedules.get', correlationId: 'corr-123', error: 'konec zaloge' })
  })

  it('v logu NIKOLI stack trace (samo message)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logWithCorrelation('x.y', 'c', new Error('z naključjem 42'))
    const raw = spy.mock.calls[0][0] as string
    expect(raw).not.toContain('at ')
    expect(raw).toContain('z naključjem 42')
  })
})
