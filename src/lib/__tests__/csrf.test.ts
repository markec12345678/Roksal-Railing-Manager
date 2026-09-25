// Roksal — testi centralne CSRF/Origin preverbe (R130 — issue #5 §6)
// ---------------------------------------------------------------------------
// Dokazuje na čistem jedru (brez Next) IN na pravi vstopni točki (csrfGuard
// prek pravega NextRequest):
//   • varne metode (GET/HEAD/OPTIONS) so vedno dovoljene — branje brez stranskih
//     učinkov ni CSRF površina;
//   • Bearer/API-key klienti so IZJETI (ni ambientnega piškotka; napadalec ne
//     more nastaviti tujega Authorization — ločena obravnava po §6);
//   • Origin prisoten → odloča IZKLJUČNO on (Referer je slabši signal);
//   • Origin manjka → Referer rezerva; oboje manjka → 403 (fail-closed);
//   • Origin "null", nesposobni shemi (data:/blob:/ftp:), napačen gostitelj,
//     napačna vrata → vse zavrnjeno;
//   • x-forwarded-host ima prednost pred Host (proxy/prembla);
//   • privzeta vrata (:443/:80) se normalizirajo, neprivzeta morajo odgovarjati;
//   • CSRF_ALLOWED_ORIGINS razširi dostop na točno določene gostitelje;
//   • stran (ne-/api/) mutacija ni predmet te preverbe (Next server actions
//     se ne uporabljajo, Next jih ščiti sam).

import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  csrfGuard,
  hostFromOriginish,
  isMutationOriginAllowed,
  isSafeMethod,
  normalizeHostHeader,
  parseAllowlist,
  firstForwardedHost,
} from '@/lib/csrf'

/** Privzeti vhod: mutacija, brez Bearer, Host = app.roksal.si. */
function input(overrides: Partial<Parameters<typeof isMutationOriginAllowed>[0]> = {}) {
  return {
    method: 'POST',
    hasBearer: false,
    origin: null,
    referer: null,
    host: 'app.roksal.si',
    forwardedHost: null,
    ...overrides,
  }
}

describe('isSafeMethod', () => {
  it('GET, HEAD in OPTIONS so varne; mutacije niso', () => {
    expect(isSafeMethod('GET')).toBe(true)
    expect(isSafeMethod('head')).toBe(true)
    expect(isSafeMethod('OPTIONS')).toBe(true)
    expect(isSafeMethod('POST')).toBe(false)
    expect(isSafeMethod('patch')).toBe(false)
    expect(isSafeMethod('DELETE')).toBe(false)
    expect(isSafeMethod('PUT')).toBe(false)
  })
})

describe('hostFromOriginish / normalizeHostHeader — razčlenjevanje', () => {
  it('Origin in Referer v normaliziranega gostitelja', () => {
    expect(hostFromOriginish('https://app.roksal.si')).toBe('app.roksal.si')
    expect(hostFromOriginish('https://app.roksal.si/pot?x=1')).toBe('app.roksal.si')
    expect(hostFromOriginish('http://localhost:3000/app')).toBe('localhost:3000')
  })

  it('privzeta vrata se odrežejo, neprivzeta ostanejo', () => {
    expect(hostFromOriginish('https://app.roksal.si:443')).toBe('app.roksal.si')
    expect(hostFromOriginish('http://app.roksal.si:80')).toBe('app.roksal.si')
    expect(hostFromOriginish('https://app.roksal.si:8443')).toBe('app.roksal.si:8443')
  })

  it('literala "null", prazno in nesposobne sheme so null', () => {
    expect(hostFromOriginish('null')).toBeNull()
    expect(hostFromOriginish('NULL')).toBeNull()
    expect(hostFromOriginish('')).toBeNull()
    expect(hostFromOriginish(null)).toBeNull()
    expect(hostFromOriginish('data:text/html,pozor')).toBeNull()
    expect(hostFromOriginish('blob:https://app.roksal.si/abc')).toBeNull()
    expect(hostFromOriginish('ftp://app.roksal.si')).toBeNull()
    expect(hostFromOriginish('app.roksal.si')).toBeNull() // brez sheme ni veljaven URL
  })

  it('Host glava in x-forwarded-host (prvi vnos iz seznama)', () => {
    expect(normalizeHostHeader('APP.Roksal.si')).toBe('app.roksal.si')
    expect(normalizeHostHeader('app.roksal.si:443')).toBe('app.roksal.si')
    expect(firstForwardedHost('prvi.roksal.si, drugi.roksal.si')).toBe('prvi.roksal.si')
    expect(firstForwardedHost('samo.roksal.si')).toBe('samo.roksal.si')
    expect(firstForwardedHost(null)).toBeNull()
  })
})

describe('isMutationOriginAllowed — jedro pravil', () => {
  it('varne metode so dovoljene tudi cross-origin in brez vseh glav', () => {
    expect(isMutationOriginAllowed(input({ method: 'GET', origin: 'https://zlonameren.example' }))).toBe(true)
    expect(isMutationOriginAllowed(input({ method: 'OPTIONS', origin: null, referer: null }))).toBe(true)
    expect(isMutationOriginAllowed(input({ method: 'HEAD', host: null }))).toBe(true)
  })

  it('Bearer klient je izjema (ni ambientnega piškotka)', () => {
    expect(isMutationOriginAllowed(input({ hasBearer: true, origin: 'https://zlonameren.example' }))).toBe(true)
    expect(isMutationOriginAllowed(input({ hasBearer: true, origin: null, referer: null, host: null }))).toBe(true)
  })

  it('isti izvor prek Origin je dovoljen', () => {
    expect(isMutationOriginAllowed(input({ origin: 'https://app.roksal.si' }))).toBe(true)
    expect(isMutationOriginAllowed(input({ origin: 'https://APP.ROKSAL.SI' }))).toBe(true) // neobčutljivo na velikost
  })

  it('cross-origin Origin je zavrnjen', () => {
    expect(isMutationOriginAllowed(input({ origin: 'https://zlonameren.example' }))).toBe(false)
    expect(isMutationOriginAllowed(input({ origin: 'https://app.roksal.si.zlonameren.example' }))).toBe(false)
  })

  it('Origin odloča izključno — odložen Referer ne reši cross-origin zahteve', () => {
    expect(
      isMutationOriginAllowed(
        input({ origin: 'https://zlonameren.example', referer: 'https://app.roksal.si/stran' }),
      ),
    ).toBe(false)
  })

  it('brez Origin je Referer rezerva (isti izvor da, tuj ne)', () => {
    expect(isMutationOriginAllowed(input({ referer: 'https://app.roksal.si/prijava' }))).toBe(true)
    expect(isMutationOriginAllowed(input({ referer: 'https://zlonameren.example/forma' }))).toBe(false)
  })

  it('Origin in Referer manjkata → ZAVRNJENO (fail-closed)', () => {
    expect(isMutationOriginAllowed(input({}))).toBe(false)
    expect(isMutationOriginAllowed(input({ origin: '', referer: '   ' }))).toBe(false)
  })

  it('Origin "null" in nesposobne sheme so zavrnjene', () => {
    expect(isMutationOriginAllowed(input({ origin: 'null' }))).toBe(false)
    expect(isMutationOriginAllowed(input({ origin: 'data:text/html,x' }))).toBe(false)
    expect(isMutationOriginAllowed(input({ origin: 'blob:https://app.roksal.si/abc' }))).toBe(false)
  })

  it('brez Host (in brez forwarded) ni primerjave → fail-closed', () => {
    expect(isMutationOriginAllowed(input({ host: null, origin: 'https://app.roksal.si' }))).toBe(false)
  })

  it('x-forwarded-host ima prednost pred Host', () => {
    // forwarded ustreza Origin (kljub zmedenemu Host) → dovoljeno
    expect(
      isMutationOriginAllowed(
        input({ origin: 'https://pravi.si', forwardedHost: 'pravi.si', host: 'med-premblom.si' }),
      ),
    ).toBe(true)
    // forwarded NE ustreza (kljub ustreznemu Host) → zavrnjeno
    expect(
      isMutationOriginAllowed(
        input({ origin: 'https://pravi.si', forwardedHost: 'tuj.si', host: 'pravi.si' }),
      ),
    ).toBe(false)
  })

  it('vrata: privzeta se normalizirajo, neprivzeta morajo odgovarjati', () => {
    expect(isMutationOriginAllowed(input({ origin: 'https://app.roksal.si:443' }))).toBe(true)
    expect(isMutationOriginAllowed(input({ origin: 'http://app.roksal.si:80' }))).toBe(true)
    expect(isMutationOriginAllowed(input({ origin: 'https://app.roksal.si:8443' }))).toBe(false)
    expect(isMutationOriginAllowed(input({ origin: 'http://localhost:3000', host: 'localhost:3000' }))).toBe(true)
  })

  it('CSRF_ALLOWED_ORIGINS: dovoli samo navedene gostitelje; pokvarjeni vnosi ne razširijo ničesar', () => {
    const allowlist = parseAllowlist('https://app.roksal.si, https://roksal.si, neveljavno!!!, data:x')
    expect(allowlist).toEqual(['app.roksal.si', 'roksal.si'])
    expect(isMutationOriginAllowed(input({ origin: 'https://roksal.si', allowlist }))).toBe(true)
    expect(isMutationOriginAllowed(input({ origin: 'https://druge.si', allowlist }))).toBe(false)
    expect(isMutationOriginAllowed(input({ origin: 'https://app.roksal.si.zlonameren.example', allowlist }))).toBe(false)
    expect(parseAllowlist(null)).toEqual([])
    expect(parseAllowlist('  ')).toEqual([])
  })
})

describe('csrfGuard — prava vstopna točka (NextRequest)', () => {
  function req(
    method: string,
    url: string,
    headers: Record<string, string> = {},
  ): NextRequest {
    return new NextRequest(url, { method, headers })
  }

  it('GET in OPTIONS grejo skozi (null = nadaljuj)', () => {
    expect(csrfGuard(req('GET', 'https://app.roksal.si/api/projects'))).toBeNull()
    expect(csrfGuard(req('OPTIONS', 'https://app.roksal.si/api/projects'))).toBeNull()
  })

  it('isti izvor gre skozi', () => {
    expect(
      csrfGuard(
        req('POST', 'https://app.roksal.si/api/projects', {
          host: 'app.roksal.si',
          origin: 'https://app.roksal.si',
        }),
      ),
    ).toBeNull()
  })

  it('cross-origin mutacija → 403 z jasnim sporocilom', () => {
    const res = csrfGuard(
      req('DELETE', 'https://app.roksal.si/api/projects', {
        host: 'app.roksal.si',
        origin: 'https://zlonameren.example',
      }),
    )
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it('manjkajoč Origin/Referer na mutaciji → 403 (fail-closed)', () => {
    const res = csrfGuard(req('POST', 'https://app.roksal.si/api/auth', { host: 'app.roksal.si' }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it('Bearer klient gre skozi kljub tujemu Origin', () => {
    expect(
      csrfGuard(
        req('POST', 'https://app.roksal.si/api/sync', {
          host: 'app.roksal.si',
          origin: 'https://zlonameren.example',
          authorization: 'Bearer rkm_test',
        }),
      ),
    ).toBeNull()
  })

  it('mutacija na strani (ne-/api/) ni predmet preverbe', () => {
    expect(
      csrfGuard(
        req('POST', 'https://app.roksal.si/nekaj', {
          host: 'app.roksal.si',
          origin: 'https://zlonameren.example',
        }),
      ),
    ).toBeNull()
  })

  it('CSRF_ALLOWED_ORIGINS env razširi dovoljene izvore', () => {
    vi.stubEnv('CSRF_ALLOWED_ORIGINS', 'https://landinja.roksal.si')
    try {
      expect(
        csrfGuard(
          req('POST', 'https://app.roksal.si/api/projects', {
            host: 'app.roksal.si',
            origin: 'https://landinja.roksal.si',
          }),
        ),
      ).toBeNull()
      expect(
        csrfGuard(
          req('POST', 'https://app.roksal.si/api/projects', {
            host: 'app.roksal.si',
            origin: 'https://se-vedno-tuj.si',
          }),
        )?.status,
      ).toBe(403)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
