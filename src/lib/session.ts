// Roksal — sejni žetoni
// ---------------------------------------------------------------------------
// Namensko brez next-auth: next-auth@4.24 deklarira peer obseg `next ^12||^13||^14`,
// projekt pa teče na Next 16 — namestitev bi bila na opozorilih, obnašanje pa
// nepreverjeno. Lastna seja je ~80 vrstic, nima odvisnosti in jo je mogoče
// enotsko testirati (`src/lib/__tests__/session.test.ts`).
//
// Ta datoteka uporablja SAMO Web Crypto (`crypto.subtle`), zato jo lahko uvozi
// `middleware.ts` (Edge runtime). Za scrypt glej `password.ts` (samo Node).
//
// Žeton: `base64url(JSON payload) . base64url(HMAC-SHA256(payload))`
// Brezstanjski — ni tabele sej, zato ni treba čistiti vrstic; potek veljavnosti
// je v žetonu in se preveri ob vsaki zahtevi.

export const SESSION_COOKIE = 'roksal_session'

/** 12 ur. Monter začne zjutraj na terenu in ne sme sredi dneva izgubiti prijave. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60

export interface SessionPayload {
  /** Profile.id */
  sub: string
  email: string
  ime: string
  /** UserRole: ADMIN | VODJA | MONTER | SKLADISCE */
  vloga: string
  /** Unix sekunde — potek veljavnosti */
  exp: number
  /**
   * #5 §2 — Session revocation: id vrstice v tabeli UserSession. Brez nje je
   * žeton na ravni RUT (authenticate) neveljaven — fail-closed: žetoni izdani
   * pred uvedbo registra ne prenesejo preverjanja živosti in morajo znova
   * pridobiti prijavo. Sama overitev podpisa (verifySession) ostane čista.
   */
  jti?: string
}

/**
 * Skrivnost za podpisovanje.
 *
 * **Fail closed:** če ni nastavljena, vržemo napako namesto da bi podpisovali z
 * празnim nizom. Aplikacija, ki tiho dopusti nepodpisane seje, je slabša od
 * aplikacije, ki se ne zažene.
 */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      'SESSION_SECRET (ali NEXTAUTH_SECRET) ni nastavljen ali je prekratek (min 16 znakov). ' +
        'Generiraj ga z: openssl rand -base64 32',
    )
  }
  return secret
}

// ── base64url ─────────────────────────────────────────────────────────────────

function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// `Uint8Array<ArrayBuffer>` (ne `ArrayBufferLike`): Web Crypto sprejema samo
// BufferSource, TypeScript 5.7+ pa `Uint8Array<ArrayBufferLike>` zavrne, ker bi
// lahko slonel na SharedArrayBuffer. Eksplicitna konstrukcija z ArrayBuffer to reši.
function b64urlDecode(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const normalized = text.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const binary = atob(padded)
    const out = new Uint8Array(new ArrayBuffer(binary.length))
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

const encoder = new TextEncoder()

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Podpiše poljubno besedilo in vrne base64url podpis. */
export async function sign(data: string, secret: string): Promise<string> {
  const key = await hmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return b64urlEncode(new Uint8Array(signature))
}

/** Preveri podpis v konstantnem času (Web Crypto `verify` to že naredi). */
export async function verify(data: string, signatureB64: string, secret: string): Promise<boolean> {
  const signature = b64urlDecode(signatureB64)
  if (!signature) return false
  const key = await hmacKey(secret)
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(data))
}

// ── sejni žeton ───────────────────────────────────────────────────────────────

export type NewSession = Omit<SessionPayload, 'exp'>

/**
 * Ustvari podpisan žeton z vgrajenim potekom veljavnosti.
 * `jti` (id UserSession vrstice) je izbiren na nivoju kriptografije — rute ga
 * VSAKICAKOR zahtevajo (authenticate: fail-closed brez registra seje).
 */
export async function signSession(
  payload: NewSession,
  ttlSeconds: number = SESSION_TTL_SECONDS,
  jti?: string,
): Promise<string> {
  const secret = sessionSecret()
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    ...(jti ? { jti } : {}),
  }
  const body = b64urlEncode(encoder.encode(JSON.stringify(full)))
  const signature = await sign(body, secret)
  return `${body}.${signature}`
}

/**
 * Preveri žeton: obstoj, oblika, podpis, potek veljavnosti.
 * Vrže `null` (ne napake) za karkoli neveljavnega — klicatelj se odloči za 401.
 */
export async function verifySession(token: string | null | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, signature] = parts

  let secret: string
  try {
    secret = sessionSecret()
  } catch {
    return null // brez skrivnosti ni veljavne seje — fail closed
  }

  if (!(await verify(body, signature, secret))) return null

  const decoded = b64urlDecode(body)
  if (!decoded) return null

  let payload: SessionPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(decoded)) as SessionPayload
  } catch {
    return null
  }
  if (!payload?.sub || typeof payload.exp !== 'number') return null
  if (payload.jti !== undefined && typeof payload.jti !== 'string') return null
  if (payload.exp * 1000 <= Date.now()) return null
  return payload
}

/** Lastnosti piškotka: httpOnly (nedosegljiv iz JS), SameSite=Lax, path=/. */
export function sessionCookieAttributes(secure: boolean): string {
  return [
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

/** Prebere žeton iz zahteve (piškotek, ali `Authorization: Bearer` za mobilni klient). */
export function extractToken(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (header) {
    for (const part of header.split(';')) {
      const [name, ...rest] = part.trim().split('=')
      if (name === SESSION_COOKIE && rest.length) return decodeURIComponent(rest.join('='))
    }
  }
  // Mobilni klient (BalkonAR) nima piškotkov — dovoli Bearer z istim žetonom.
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}

/** Ali naj piškotek dobi zastavico Secure (samo HTTPS). */
export function isSecureRequest(request: Request): boolean {
  if (new URL(request.url).protocol === 'https:') return true
  return request.headers.get('x-forwarded-proto') === 'https'
}
