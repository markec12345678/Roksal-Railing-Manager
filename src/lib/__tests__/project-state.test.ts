// S+9 (issue #4 §14) — Project State Machine: matrika prehodov + role gating.
import { describe, it, expect } from 'vitest'
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  transitionAllowed,
  InvalidTransitionError,
  isProjectStatus,
  initialStatusFor,
  isInitialProjectStatus,
} from '@/lib/project-state'
import type { AuthContext } from '@/lib/auth'

function user(vloga: string, sub = 'u1'): AuthContext {
  return {
    kind: 'user',
    session: { sub, email: `${vloga.toLowerCase()}@x.si`, ime: vloga, vloga, exp: 9999999999 },
  }
}

const apiKey: AuthContext = { kind: 'apikey', name: 'test-key' }

describe('ALLOWED_TRANSITIONS — matrika', () => {
  it('vse vrednosti so znani statusi in ne vsebujejo samega sebe', () => {
    for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(isProjectStatus(from)).toBe(true)
      for (const to of tos) {
        expect(isProjectStatus(to)).toBe(true)
        expect(to).not.toBe(from)
      }
    }
  })

  it('ZAKLJUCENO je končno stanje', () => {
    expect(ALLOWED_TRANSITIONS.ZAKLJUCENO).toEqual([])
  })

  it('ni preskoka NACRTOVANO → MONTIRANO', () => {
    expect(ALLOWED_TRANSITIONS.NACRTOVANO).not.toContain('MONTIRANO')
  })
})

describe('assertTransition — vloge', () => {
  it('vodstvo (ADMIN/VODJA) sme vse, tudi iz končnih stanj', () => {
    expect(() =>
      assertTransition({ from: 'ZAKLJUCENO', to: 'V_TEKU', principal: user('ADMIN') })
    ).not.toThrow()
  })

  it('R120: servisni principal (MOBILE_SYNC) NI vodstvo — obhod iz končnega stanja → 409', () => {
    expect(() =>
      assertTransition({ from: 'MONTIRANO', to: 'NACRTOVANO', principal: apiKey })
    ).toThrow(InvalidTransitionError)
  })

  it('MONTER: veljaven prehod NACRTOVANO → V_TEKU', () => {
    expect(() =>
      assertTransition({ from: 'NACRTOVANO', to: 'V_TEKU', principal: user('MONTER') })
    ).not.toThrow()
  })

  it('MONTER: preskok NACRTOVANO → MONTIRANO → 409', () => {
    expect(() =>
      assertTransition({ from: 'NACRTOVANO', to: 'MONTIRANO', principal: user('MONTER') })
    ).toThrow(InvalidTransitionError)
  })

  it('SKLADISCE: nikoli ne spreminja statusa', () => {
    expect(() =>
      assertTransition({ from: 'NACRTOVANO', to: 'V_TEKU', principal: user('SKLADISCE') })
    ).toThrow(InvalidTransitionError)
  })

  it('MONTER: dealLocked projekt iz ZA_MONTAZO → blokiran, vodstvo ne', () => {
    expect(() =>
      assertTransition({
        from: 'ZA_MONTAZO',
        to: 'V_IZDELAVI',
        principal: user('MONTER'),
        dealLocked: true,
      })
    ).toThrow(/Zaklenjen dogovor/)
    expect(() =>
      assertTransition({
        from: 'ZA_MONTAZO',
        to: 'V_IZDELAVI',
        principal: user('VODJA'),
        dealLocked: true,
      })
    ).not.toThrow()
  })

  it('MONTER: iz ZAKLJUCENO in USTAVLJENO samo vodstvo', () => {
    expect(() =>
      assertTransition({ from: 'USTAVLJENO', to: 'V_TEKU', principal: user('MONTER') })
    ).toThrow(/končnega stanja/)
  })

  it('R120: servisni principal sme SAMO veljavne prehode (NACRTOVANO → V_TEKU)', () => {
    expect(() =>
      assertTransition({ from: 'NACRTOVANO', to: 'V_TEKU', principal: apiKey })
    ).not.toThrow()
    expect(() =>
      assertTransition({ from: 'NACRTOVANO', to: 'MONTIRANO', principal: apiKey })
    ).toThrow(InvalidTransitionError)
  })

  it('R120: servisni principal + dealLocked iz ZA_MONTAZO → blokiran', () => {
    expect(() =>
      assertTransition({
        from: 'ZA_MONTAZO',
        to: 'V_IZDELAVI',
        principal: apiKey,
        dealLocked: true,
      })
    ).toThrow(/Zaklenjen dogovor/)
  })

  it('R120: initialStatusFor — nov projekt se rodi samo kot NACRTOVANO', () => {
    expect(initialStatusFor(undefined)).toEqual({ status: 'NACRTOVANO', clampedFrom: null })
    expect(initialStatusFor('NACRTOVANO')).toEqual({ status: 'NACRTOVANO', clampedFrom: null })
    // obhod poskus: mobilni klient pošlje MONTIRANO/ZAKLJUCENO/neumnost → korekcija + javljanje
    expect(initialStatusFor('MONTIRANO')).toEqual({ status: 'NACRTOVANO', clampedFrom: 'MONTIRANO' })
    expect(initialStatusFor('ZAKLJUCENO')).toEqual({ status: 'NACRTOVANO', clampedFrom: 'ZAKLJUCENO' })
    expect(initialStatusFor('NEZNAN_STATUS')).toEqual({ status: 'NACRTOVANO', clampedFrom: 'NEZNAN_STATUS' })
    expect(isInitialProjectStatus('NACRTOVANO')).toBe(true)
    expect(isInitialProjectStatus('MONTIRANO')).toBe(false)
  })

  it('neznan status → napaka', () => {
    expect(() =>
      assertTransition({ from: 'NIZZNAN', to: 'V_TEKU', principal: user('VODJA') })
    ).toThrow(/Neznan status/)
  })

  it('transitionAllowed (ne-metajoča) se ujema z assertTransition', () => {
    expect(
      transitionAllowed({ from: 'NACRTOVANO', to: 'V_TEKU', principal: user('MONTER') })
    ).toBe(true)
    expect(
      transitionAllowed({ from: 'NACRTOVANO', to: 'MONTIRANO', principal: user('MONTER') })
    ).toBe(false)
  })
})
