// Roksal — revizijski dnevnik
// ---------------------------------------------------------------------------
// Model AuditLog je bil v shemi, a so ga uporabljale samo tri rute, vsaka s svojim
// prepisanim klicem. Za sistem, ki ima digitalni podpis ponudbe in zaklepanje
// dogovora (deal-lock), je revizijska sled pravno pomembna: kdo, kaj, kdaj, iz
// katerega IP in z kakšnim brskalnikom.
//
// Načela:
//   1. Dnevnik NIKOLI ne sme podreti zahteve. Zato `audit()` požre vsako napako
//      in se kliče neblokirajoče (`void audit(…)`).
//   2. Beleži se razlika (oldValue → newValue), ne samo "nekdo je nekaj naredil".
//   3. Vrednosti so odrezane na razumno dolžino — v dnevnik ne sodi celotna
//      fotografija v base64.

import { db } from '@/lib/db'
import { clientIp } from './rate-limit'
import type { SessionPayload } from './session'

/** Največja dolžina posamezne vrednosti v dnevniku. */
const MAX_VALUE_LENGTH = 4000

export interface AuditInput {
  request?: Request
  session?: SessionPayload | null
  /**
   * Neposredni ID uporabnika, kadar seje ni — npr. neuspešna prijava, kjer
   * poznamo profil (napačno geslo), a nimamo seje. Prednost pred `session.sub`.
   * AuditLog.userId je obvezen tuji ključ, zato se dejanj brez znanega profila
   * (npr. prijava z neobstoječim e-naslovom) ne da vpisati — ta gredo v dnevnik
   * strežnika namesto v bazo.
   */
  userId?: string | null
  /** Karkoli prepoznavnega: 'LOGIN', 'LOGIN_FAILED', 'QUOTE_CREATED', 'DEAL_LOCK' … */
  akcija: string
  projectId?: string | null
  oldValue?: unknown
  newValue?: unknown
}

function stringify(value: unknown): string | null {
  if (value === undefined || value === null) return null
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    if (text.length > MAX_VALUE_LENGTH) {
      return text.slice(0, MAX_VALUE_LENGTH) + `… [odrezano, skupaj ${text.length} znakov]`
    }
    return text
  } catch {
    return '[nezapisljivo]'
  }
}

/** Zapiše vnos v AuditLog. Nikoli ne vrže — dnevnik ne sme podreti posla. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    const userId = input.userId ?? input.session?.sub
    if (!userId) return // brez uporabnika ni komu pripisati dejanja
    await db.auditLog.create({
      data: {
        userId,
        projectId: input.projectId ?? null,
        akcija: input.akcija,
        oldValue: stringify(input.oldValue),
        newValue: stringify(input.newValue),
        ipAddress: input.request ? clientIp(input.request) : null,
        userAgent: input.request?.headers.get('user-agent')?.slice(0, 300) ?? null,
      },
    })
  } catch (error) {
    console.error('[audit] vpis ni uspel (zahtevek teče naprej):', error)
  }
}

/** Nečakajoča različica za poti, kjer dnevnik ne sme podaljšati odzivnega časa. */
export function auditAsync(input: AuditInput): void {
  void audit(input).catch(() => undefined)
}

/**
 * Bere sled za projekt — za prikaz v vmesniku in za izvoz ob sporu.
 * Vrne zadnjih `limit` vnosov, najnovejši najprej.
 */
export async function readAudit(projectId: string, limit = 100) {
  return db.auditLog.findMany({
    where: { projectId },
    orderBy: { timestamp: 'desc' },
    take: Math.min(Math.max(limit, 1), 500),
    include: { user: { select: { id: true, ime: true, email: true, vloga: true } } },
  })
}
