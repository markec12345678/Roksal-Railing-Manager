// Testi sejnih žetonov in gesel.
// Pokrivajo tisto, kar se v dimnem testu (tools/security-smoke.py) ne da:
// notranje obnašanje — potek veljavnosti, NFKC normalizacija, parametri v hashu.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  extractToken,
  sessionCookieAttributes,
  sessionSecret,
  sign,
  signSession,
  verify,
  verifySession,
} from '../session'
import { hashPassword, verifyPassword } from '../password'

const SECRET = 'test-secret-0123456789abcdef'

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET
})

function req(headers: Record<string, string>, url = 'http://localhost/api/x'): Request {
  return new Request(url, { headers })
}

describe('sessionSecret', () => {
  it('vrže, kadar skrivnost manjka (fail closed, ne fail open)', () => {
    delete process.env.SESSION_SECRET
    delete process.env.NEXTAUTH_SECRET
    expect(() => sessionSecret()).toThrow(/SESSION_SECRET/)
  })

  it('vrže, kadar je skrivnost prekratka', () => {
    process.env.SESSION_SECRET = 'kratk'
    expect(() => sessionSecret()).toThrow(/prekratek/)
  })

  it('sprejme NEXTAUTH_SECRET kot rezervo', () => {
    delete process.env.SESSION_SECRET
    process.env.NEXTAUTH_SECRET = 'nadomestna-skrivnost-1234567890'
    expect(sessionSecret()).toBe('nadomestna-skrivnost-1234567890')
  })
})

describe('signSession / verifySession', () => {
  const user = { sub: 'u1', email: 'marko@roksal.si', ime: 'Marko', vloga: 'MONTER' }

  it('okrogli prehod ohrani identiteto', async () => {
    const token = await signSession(user)
    const payload = await verifySession(token)
    expect(payload?.sub).toBe('u1')
    expect(payload?.email).toBe('marko@roksal.si')
    expect(payload?.vloga).toBe('MONTER')
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('žeton ima dva dela in ne vsebuje berljivega gesla ali skrivnosti', async () => {
    const token = await signSession(user)
    expect(token.split('.')).toHaveLength(2)
    expect(token).not.toContain(SECRET)
  })

  it('spremenjen podpis → null', async () => {
    const token = await signSession(user)
    const [body, sig] = token.split('.')
    const tampered = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA')
    expect(await verifySession(`${body}.${tampered}`)).toBeNull()
  })

  it('spremenjena vsebina (MONTER → ADMIN) → null', async () => {
    const token = await signSession(user)
    const [, sig] = token.split('.')
    const forged = btoa(JSON.stringify({ ...user, vloga: 'ADMIN', exp: 9999999999 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await verifySession(`${forged}.${sig}`)).toBeNull()
  })

  it('potekel žeton → null', async () => {
    const token = await signSession(user, -10) // potekel pred 10 s
    expect(await verifySession(token)).toBeNull()
  })

  it('žeton, podpisan z drugo skrivnostjo → null', async () => {
    const token = await signSession(user)
    process.env.SESSION_SECRET = 'popolnoma-druga-skrivnost-xyz'
    expect(await verifySession(token)).toBeNull()
  })

  it('naključne in prazne vrednosti → null (ne izjema)', async () => {
    for (const bad of [null, undefined, '', 'nesmisel', 'a.b', 'a.b.c', '...', '%00', 'x.']) {
      expect(await verifySession(bad as string | null | undefined)).toBeNull()
    }
  })

  it('brez nastavljene skrivnosti → null, ne izjema', async () => {
    const token = await signSession(user)
    delete process.env.SESSION_SECRET
    delete process.env.NEXTAUTH_SECRET
    expect(await verifySession(token)).toBeNull()
  })

  it('privzeti TTL je 12 ur', async () => {
    expect(SESSION_TTL_SECONDS).toBe(12 * 3600)
    const before = Math.floor(Date.now() / 1000)
    const payload = await verifySession(await signSession(user))
    expect(payload!.exp).toBeGreaterThanOrEqual(before + SESSION_TTL_SECONDS - 5)
    expect(payload!.exp).toBeLessThanOrEqual(before + SESSION_TTL_SECONDS + 5)
  })
})

describe('sign / verify', () => {
  it('podpis je determinističen in preverljiv', async () => {
    const s1 = await sign('isti-podatek', SECRET)
    const s2 = await sign('isti-podatek', SECRET)
    expect(s1).toBe(s2)
    expect(await verify('isti-podatek', s1, SECRET)).toBe(true)
  })

  it('druga skrivnost ne preveri podpisa', async () => {
    const s = await sign('podatek', SECRET)
    expect(await verify('podatek', s, 'druga-skrivnost-123456')).toBe(false)
  })

  it('neveljaven base64url podpis → false, ne izjema', async () => {
    expect(await verify('podatek', '!!!ni-base64!!!', SECRET)).toBe(false)
  })
})

describe('extractToken', () => {
  it('prebere piškotek', () => {
    const r = req({ cookie: `theme=dark; ${SESSION_COOKIE}=abc.def; other=1` })
    expect(extractToken(r)).toBe('abc.def')
  })

  it('prebere Bearer (mobilni klient brez piškotkov)', () => {
    const r = req({ authorization: 'Bearer abc.def' })
    expect(extractToken(r)).toBe('abc.def')
  })

  it('piškotek ima prednost pred Bearer', () => {
    const r = req({ cookie: `${SESSION_COOKIE}=iz-piskotka`, authorization: 'Bearer iz-headerja' })
    expect(extractToken(r)).toBe('iz-piskotka')
  })

  it('brez obeh → null', () => {
    expect(extractToken(req({}))).toBeNull()
  })
})

describe('piškotek', () => {
  it('je HttpOnly in SameSite=Lax, Secure samo na HTTPS', () => {
    const attrs = sessionCookieAttributes(true)
    expect(attrs).toContain('HttpOnly')
    expect(attrs).toContain('SameSite=Lax')
    expect(attrs).toContain('Secure')
    expect(attrs).toContain(`Max-Age=${SESSION_TTL_SECONDS}`)
    expect(sessionCookieAttributes(false)).not.toContain('Secure')
  })
})

describe('hashPassword / verifyPassword (scrypt)', () => {
  it('pravilno geslo se preveri', async () => {
    const hash = await hashPassword('Pravilno123')
    expect(await verifyPassword('Pravilno123', hash)).toBe(true)
  })

  it('napačno geslo se ne preveri', async () => {
    const hash = await hashPassword('Pravilno123')
    expect(await verifyPassword('Pravilno124', hash)).toBe(false)
    expect(await verifyPassword('', hash)).toBe(false)
    expect(await verifyPassword('pravilno123', hash)).toBe(false) // velike črke so pomembne
  })

  it('isto geslo da različen hash (naključna sol)', async () => {
    const a = await hashPassword('Isto1234')
    const b = await hashPassword('Isto1234')
    expect(a).not.toBe(b)
    expect(await verifyPassword('Isto1234', a)).toBe(true)
    expect(await verifyPassword('Isto1234', b)).toBe(true)
  })

  it('hash razkrije parametre, ne gesla', async () => {
    const hash = await hashPassword('SkrivnoGeslo1')
    const parts = hash.split('$')
    expect(parts[0]).toBe('scrypt')
    expect(Number(parts[1])).toBeGreaterThanOrEqual(16384) // N = 2^14
    expect(parts.length).toBe(6)
    expect(hash).not.toContain('SkrivnoGeslo1')
  })

  it('NFKC: enako vidno geslo z različnimi kodnimi točkami se preveri', async () => {
    // 'é' kot predsestavljeni znak (U+00E9) in kot e + kombinirajoči naglas (U+0065 U+0301)
    const hash = await hashPassword('Gesl\u00e9123')
    expect(await verifyPassword('Gesl\u0065\u0301' + '123', hash)).toBe(true)
  })

  it('pokvarjen ali prazen hash → false, ne izjema', async () => {
    for (const bad of [null, undefined, '', 'scrypt', 'scrypt$1$2$3', 'bcrypt$xyz', 'a$b$c$d$e$f$g']) {
      expect(await verifyPassword('karkoli', bad as string | null)).toBe(false)
    }
  })
})
