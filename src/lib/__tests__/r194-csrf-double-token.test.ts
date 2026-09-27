// Roksal — testi dvojnega žetona (R194 — issue #5 §6, VARNOST.md vrstica ZAPRTA)
// ---------------------------------------------------------------------------
// Trije nivoji, kot pri R130:
//   1. čisto jedro (`csrf-core.ts`, brez Next) — razčlenjevanje piškotka,
//      odločitev vezave (not-required / ok / rejected), atributi piškotka;
//   2. prava vstopna točka (`csrfGuard` prek pravega NextRequest) — vrstni red
//      plasti (R130 preverba izvora → žeton), Bearer izjema, grace za stare
//      seje, fail-closed pri neujemanju;
//   3. brskalniški ovoj (`installCsrfFetch` s špioniranim oknom) — glava se
//      prilepi SAMO isti-izvornim mutacijam, nikoli cross-origin, nikoli
//      preglašena, brez piškotka pa sploh ni poslana.

import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'
import { CSRF_COOKIE, CSRF_HEADER, cookieValue, csrfCookieAttributes, csrfTokenVerdict } from '@/lib/csrf-core'
import { csrfGuard } from '@/lib/csrf'
import { installCsrfFetch, type CsrfWindow } from '@/lib/csrf-client'

const TOKEN = 'abc-123-vzorec-zeton'
const SESSION = 'sejni-podpis.zeton'

function cookieJar(extra: Record<string, string> = {}): string {
  const parts = [`${SESSION_COOKIE}=${SESSION}`, `${CSRF_COOKIE}=${TOKEN}`]
  for (const [k, v] of Object.entries(extra)) parts.push(`${k}=${v}`)
  return parts.join('; ')
}

function guardRequest(overrides: {
  method?: string
  cookie?: string | null
  tokenHeader?: string | null
  origin?: string | null
  path?: string
} = {}): NextResponse | null {
  const {
    method = 'POST',
    cookie = cookieJar(),
    tokenHeader = TOKEN,
    origin = 'https://app.roksal.si',
    path = '/api/projects',
  } = overrides
  const headers = new Headers({ host: 'app.roksal.si' })
  if (cookie !== null) headers.set('cookie', cookie)
  if (tokenHeader !== null) headers.set(CSRF_HEADER, tokenHeader)
  if (origin !== null) headers.set('origin', origin)
  const request = new NextRequest(`https://app.roksal.si${path}`, { method, headers })
  return csrfGuard(request)
}

describe('R194 jedro — cookieValue', () => {
  it('prebere vrednost med podpičji, presledki in brez', () => {
    expect(cookieValue('a=1; b=2', 'b')).toBe('2')
    expect(cookieValue('a=1;b=2', 'a')).toBe('1')
    expect(cookieValue(`  ${CSRF_COOKIE}=${TOKEN}  `, CSRF_COOKIE)).toBe(TOKEN)
    expect(cookieValue(null, CSRF_COOKIE)).toBeNull()
    expect(cookieValue('', CSRF_COOKIE)).toBeNull()
  })

  it('ime brez "=" in prazne vrednosti so odsotne', () => {
    expect(cookieValue('roksal_csrf', 'roksal_csrf')).toBeNull()
    expect(cookieValue('roksal_csrf=', 'roksal_csrf')).toBeNull()
    expect(cookieValue('roksal_csrf=; a=1', 'roksal_csrf')).toBeNull()
  })

  it('urejeni zapisi (encodeURIComponent) se dekodirajo; pokvareni ostanejo surovi', () => {
    expect(cookieValue('roksal_csrf=abc%2Fdef', 'roksal_csrf')).toBe('abc/def')
    expect(cookieValue('roksal_csrf=%ZZ', 'roksal_csrf')).toBe('%ZZ')
  })
})

describe('R194 jedro — csrfTokenVerdict', () => {
  it('brez seje → not-required (javni in Bearer klijeji, R130 plast ostaja)', () => {
    expect(csrfTokenVerdict(null, null)).toBe('not-required')
    expect(csrfTokenVerdict('drugi=1', TOKEN)).toBe('not-required')
    expect(csrfTokenVerdict(`${SESSION_COOKIE}=` , TOKEN)).toBe('not-required') // prazna seja = brez
  })

  it('stara seja brez žetona → not-required (grace, dokumentirano v VARNOST.md)', () => {
    expect(csrfTokenVerdict(`${SESSION_COOKIE}=${SESSION}`, null)).toBe('not-required')
    expect(csrfTokenVerdict(`${SESSION_COOKIE}=${SESSION}`, '')).toBe('not-required')
  })

  it('sea + žeton: ujemajoča glava → ok; manjkajoča/neujemajoča → rejected', () => {
    const jar = cookieJar()
    expect(csrfTokenVerdict(jar, TOKEN)).toBe('ok')
    expect(csrfTokenVerdict(jar, null)).toBe('rejected')
    expect(csrfTokenVerdict(jar, '')).toBe('rejected')
    expect(csrfTokenVerdict(jar, 'napacno')).toBe('rejected')
    expect(csrfTokenVerdict(jar, TOKEN + 'x')).toBe('rejected')
  })

  it('primerjava je točna (brez trim/substring zmag)', () => {
    const jar = `${SESSION_COOKIE}=${SESSION};${CSRF_COOKIE}=${TOKEN}`
    expect(csrfTokenVerdict(jar, ` ${TOKEN}`)).toBe('rejected')
    expect(csrfTokenVerdict(`${SESSION_COOKIE}=${SESSION};${CSRF_COOKIE}=${TOKEN};x=1`, TOKEN)).toBe('ok')
  })
})

describe('R194 jedro — csrfCookieAttributes', () => {
  it('berljiv iz JS (brez HttpOnly), SameSite=Lax, Secure na HTTPS', () => {
    const attrs = csrfCookieAttributes(TOKEN, true)
    expect(attrs).toContain(`${CSRF_COOKIE}=${TOKEN}`)
    expect(attrs).toContain('Path=/')
    expect(attrs).toContain('SameSite=Lax')
    expect(attrs).toContain('Max-Age=43200')
    expect(attrs).toContain('Secure')
    expect(attrs).not.toContain('HttpOnly')
    const insecure = csrfCookieAttributes(TOKEN, false)
    expect(insecure).not.toContain('Secure')
  })
})

describe('R194 vstopna točka — csrfGuard z žetonom', () => {
  it('sea + žeton + ujemajoča glava → dovoljeno (null)', () => {
    expect(guardRequest()).toBeNull()
  })

  it('sea + žeton + neujemajoča glava → 403 z izrecnim dvojnopodpisnim sporočilom', () => {
    const res = guardRequest({ tokenHeader: 'napacno' })
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it('sea + žeton + MANJKAJOČA glava → 403 (fail-closed)', () => {
    const res = guardRequest({ tokenHeader: null })
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it('stara seja brez žetona → dovoljeno (grace — R130 plast je edina)', () => {
    expect(guardRequest({ cookie: `${SESSION_COOKIE}=${SESSION}`, tokenHeader: null })).toBeNull()
  })

  it('brez seje → žeton ni zahtevan (javne poti, R130 obnašanje nespremenjeno)', () => {
    expect(guardRequest({ cookie: null, tokenHeader: null })).toBeNull()
    expect(guardRequest({ cookie: 'drugi=1', tokenHeader: null })).toBeNull()
  })

  it('Bearer klient z neujemajočim žetonom → dovoljeno (izjema §6 ostaja)', () => {
    const headers = new Headers({
      host: 'app.roksal.si',
      authorization: 'Bearer rkm_kljuc',
      cookie: cookieJar(),
      [CSRF_HEADER]: 'napacno',
      origin: 'https://app.roksal.si',
    })
    const request = new NextRequest('https://app.roksal.si/api/sync', { method: 'POST', headers })
    expect(csrfGuard(request)).toBeNull()
  })

  it('varna metoda s pokvarjenim žetonom → dovoljeno (GET ni površina)', () => {
    expect(guardRequest({ method: 'GET', tokenHeader: 'napacno' })).toBeNull()
  })

  it('R130 preverba izvora ostane prva — slab izvor → 403 tudi z veljavnim žetonom', () => {
    const res = guardRequest({ origin: 'https://zlobec.example' })
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
    // in pri slabem izvoru brez žetona je sporočilo še vedno izvorno (R130 diagnostika)
    const res2 = guardRequest({ origin: 'https://zlobec.example', tokenHeader: null })
    expect(res2).not.toBeNull()
    expect(res2!.status).toBe(403)
  })
})

// ── brskalniški ovoj ───────────────────────────────────────────────────────────

function stubWindow(cookie: string, crossOrigin: boolean = false): CsrfWindow & { __spiedFetch: ReturnType<typeof vi.fn> } {
  const origin = crossOrigin ? 'https://druga-domena.example' : 'https://app.roksal.si'
  const response = new Response('{}', { status: 200 })
  const spiedFetch = vi.fn(() => Promise.resolve(response))
  return {
    fetch: spiedFetch as unknown as CsrfWindow['fetch'],
    location: { href: `${origin}/`, origin },
    document: { cookie },
    __spiedFetch: spiedFetch,
  }
}

describe('R194 brskalniški ovoj — installCsrfFetch', () => {
  it('isti-izvorna mutacija dobi glavo x-csrf-token iz piškotka', async () => {
    const win = stubWindow(cookieJar())
    expect(installCsrfFetch(win)).toBe(true)
    await win.fetch('/api/projects', { method: 'POST' })
    const [, init] = win.__spiedFetch.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(new Headers(init.headers).get(CSRF_HEADER)).toBe(TOKEN)
  })

  it('varne metode ostanejo nedotaknjene (GET brez glave)', async () => {
    const win = stubWindow(cookieJar())
    installCsrfFetch(win)
    await win.fetch('/api/projects')
    const [, init] = win.__spiedFetch.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined]
    expect(init?.headers).toBeUndefined()
    await win.fetch('/api/projects', { method: 'HEAD' })
    expect(win.__spiedFetch).toHaveBeenCalledTimes(2)
  })

  it('cross-origin mutacija NIKOLI ne dobi žetona (ne odteče tretji strani)', async () => {
    const win = stubWindow(cookieJar())
    installCsrfFetch(win)
    await win.fetch('https://druga-domena.example/api', { method: 'POST' })
    const [, init] = win.__spiedFetch.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined]
    expect(init?.headers).toBeUndefined()
  })

  it('brez piškotka se ne pošilja nič (neprijavljen — R130 plast ostaja)', async () => {
    const win = stubWindow('')
    installCsrfFetch(win)
    await win.fetch('/api/projects', { method: 'POST' })
    const [, init] = win.__spiedFetch.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined]
    expect(init?.headers).toBeUndefined()
  })

  it('stara seja brez žetona → brez glave (strežniški grace se ujema)', async () => {
    const win = stubWindow(`${SESSION_COOKIE}=${SESSION}`)
    installCsrfFetch(win)
    await win.fetch('/api/projects', { method: 'POST' })
    const [, init] = win.__spiedFetch.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined]
    expect(init?.headers).toBeUndefined()
  })

  it('obstoječa glava klicatelja NI preglašena (prihodnost/testi)', async () => {
    const win = stubWindow(cookieJar())
    installCsrfFetch(win)
    await win.fetch('/api/projects', { method: 'POST', headers: { [CSRF_HEADER]: 'moj-zeton' } })
    const [, init] = win.__spiedFetch.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(new Headers(init.headers).get(CSRF_HEADER)).toBe('moj-zeton')
  })

  it('Request objekt kot input: glava se prilepi (method iz Requesta, URL isti-izvorni)', async () => {
    const win = stubWindow(cookieJar())
    installCsrfFetch(win)
    const req = new Request('https://app.roksal.si/api/projects', { method: 'POST', body: '{}' })
    await win.fetch(req)
    const [, init] = win.__spiedFetch.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(new Headers(init.headers).get(CSRF_HEADER)).toBe(TOKEN)
  })

  it('namestitev je idempotentna (drugi klic vrne false, ovoj se ne podvoji)', async () => {
    const win = stubWindow(cookieJar())
    expect(installCsrfFetch(win)).toBe(true)
    expect(installCsrfFetch(win)).toBe(false)
    await win.fetch('/api/projects', { method: 'POST' })
    const [, init] = win.__spiedFetch.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(new Headers(init.headers).get(CSRF_HEADER)).toBe(TOKEN)
  })

  it('pokvaren input ne poruši prometa — pademo na originalni fetch', async () => {
    const win = stubWindow(cookieJar())
    installCsrfFetch(win)
    const problem = {} as unknown as RequestInfo
    await expect(win.fetch(problem, { method: 'POST' })).resolves.toBeDefined()
    expect(win.__spiedFetch).toHaveBeenCalledTimes(1)
  })
})
