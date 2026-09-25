/**
 * R143 (issue #5 §29 — Notifications): življenjski cikel + dispatch + naslavljanje.
 *
 * §29 pogodba (addendum): lifecycle QUEUED → SENT → DELIVERED → OPENED (+ FAILED),
 * template version, recipient, entity, correlation ID, retry, failure reason.
 *
 * Zasnovano po obstoječih vzorcih:
 *   • DETERMINISTIČNO — prehodi samo NAPREJ po strogi tabeli (ALLOWED_TRANSITIONS);
 *     predloge so registrirane z EKSPLOCITNO verzijo (brez ugibanja); okno retry
 *     politike je konstanta (ali ekspliciten argument).
 *   • PostgreSQL-only fail-closed — noben zunanji kanal (e-pošta/SMS NI v projektu,
 *     ne izmišljujemo); dispatch korak je lenobno-proceduralen (precedens: lenobno
 *     čiščenje sej ob prijavi, §2) in se izvede ob GET /api/notifications.
 *   • fail-verbose — napaka dispatcha pusti vrstico QUEUED (retryCount+1) ali FAILED
 *     (po maxRetries) z SANITIZIRANIM lastError (§22, brez stacka).
 *
 * Semantika statusov (in-app kanal, edini, ki ga projekt ima):
 *   • QUEUED    — vrstica zapisana, dispatch je ni še oddal
 *   • SENT      — dispatch jo je oddal v kanal (in-app: zapisana in vidna)
 *   • DELIVERED — klient jo je dejansko POBRAL prek GET /api/notifications
 *   • OPENED    — uporabnik jo je odprl (POST /api/notifications/read) — terminalno
 *   • FAILED    — dispatch je po maxRetries spodletel — terminalno
 *
 * Naslavljanje: XOR — ALI posamezen profil (userId), ALI vloga (recipientRole).
 * Role-naslovljena vrstica je vidna VSEM članom vloge; DELIVERED/OPENED status je
 * SKUPEN (prvi član, ki pobere/odpre, nastavi status vsem — dokumentirano, majhna
 * ekipa). Legacy 'skladisce' vrstice ostanejo orphan (schema.prisma, R143).
 */
import { db } from '@/lib/db'
import { correlationErrorSummary } from '@/lib/correlation'
import type { UserRole } from '@prisma/client'

/** Registrirane predloge z verzijo — NOVA predloga MORA tu imeti ključ + verzijo. */
export const NOTIFICATION_TEMPLATES = {
  LOW_STOCK: { version: 1 },
  JOB_FAILED: { version: 1 },
} as const

export type NotificationTemplate = keyof typeof NOTIFICATION_TEMPLATES

/** Privzeta retry politika dispatcha (poskusi na vrstico). */
export const NOTIFICATION_MAX_RETRIES = 3

/** Dispatch paket: koliko NAJSTAREJŠIH QUEUED vrstic obravnavamo na poteh. */
export const NOTIFICATION_DISPATCH_BATCH = 200

export class NotificationTemplateError extends Error {}
export class NotificationRecipientError extends Error {}
export class NotificationTransitionError extends Error {}

/** Stroga tabela prehodov — samo naprej (§29: brez vračanja nazaj). */
export const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  QUEUED: ['SENT', 'FAILED'],
  SENT: ['DELIVERED', 'OPENED'],
  DELIVERED: ['OPENED'],
  OPENED: [],
  FAILED: [],
}

/** Deterministično preveri prehod (čista funkcija — testabilna). */
export function transitionAllowed(
  from: string,
  to: string,
): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to)
}

export interface Recipient {
  /** Naslavljanje na profil (cuid Profile.id). */
  userId?: string
  /** Naslavljanje na vlogo (UserRole). */
  recipientRole?: UserRole
}

export interface QueueNotificationInput {
  template: NotificationTemplate
  naslov: string
  sporocilo?: string | null
  recipients: Recipient[]
  templateVersion?: number
  entity?: { type: string; id: string } | null
  correlationId?: string | null
  maxRetries?: number
}

/** Vrsta prejemnika za notranjo uporabo (XOR preverba). */
function recipientOf(r: Recipient): { userId: string | null; recipientRole: UserRole | null } {
  const hasUser = typeof r.userId === 'string' && r.userId.length > 0
  const hasRole = typeof r.recipientRole === 'string' && r.recipientRole.length > 0
  if (hasUser === hasRole) {
    throw new NotificationRecipientError(
      'Prejemnik mora biti NATANČNO ena vrsta: userId ALI recipientRole (XOR).',
    )
  }
  return { userId: r.userId ?? null, recipientRole: r.recipientRole ?? null }
}

/**
 * Vrsti obvestilo v redu (status QUEUED) — ena vrstica na prejemnika.
 * Fail-closed: neznana predloga → NotificationTemplateError (brez tihega zapisa).
 */
export async function queueNotifications(input: QueueNotificationInput): Promise<number> {
  const tpl = NOTIFICATION_TEMPLATES[input.template]
  if (!tpl) {
    throw new NotificationTemplateError(`Neznana predloga obvestila: ${input.template}`)
  }
  const version = input.templateVersion ?? tpl.version
  if (version !== tpl.version) {
    throw new NotificationTemplateError(
      `Verzija predloge ${input.template} je ${tpl.version}, prejeta pa ${version}.`,
    )
  }
  if (input.recipients.length === 0) {
    throw new NotificationRecipientError('Obvestilo brez prejemnikov ni dovoljeno.')
  }
  const rows = input.recipients.map((r) => {
    const { userId, recipientRole } = recipientOf(r)
    return {
      userId,
      recipientRole,
      naslov: input.naslov,
      sporocilo: input.sporocilo ?? null,
      status: 'QUEUED' as const,
      template: input.template,
      templateVersion: version,
      entityType: input.entity?.type ?? null,
      entityId: input.entity?.id ?? null,
      correlationId: input.correlationId ?? null,
      maxRetries: input.maxRetries ?? NOTIFICATION_MAX_RETRIES,
    }
  })
  const res = await db.notification.createMany({ data: rows })
  return res.count
}

/**
 * Čista funkcija: stanje vrstice po NEUSPEŠNEM dispatch poskusu.
 * retryCount+1 < maxRetries → ostane QUEUED (naslednji poskus); sicer FAILED
 * z sanitiziranim lastError (§22 — brez stacka, brez skrivnosti).
 */
export function nextDispatchState(row: { retryCount: number; maxRetries: number }, error: unknown): {
  status: 'QUEUED' | 'FAILED'
  retryCount: number
  lastError: string
} {
  const retryCount = row.retryCount + 1
  if (retryCount < row.maxRetries) {
    return { status: 'QUEUED', retryCount, lastError: correlationErrorSummary(error) }
  }
  return { status: 'FAILED', retryCount, lastError: correlationErrorSummary(error) }
}

export interface DispatchSummary {
  dispatched: number
  failed: number
  retried: number
}

/**
 * Odda VSE QUEUED vrstice (najstarejše najprej, paket NOTIFICATION_DISPATCH_BATCH)
 * → SENT (sentAt). Napaka na vrstici = retry politika (nextDispatchState).
 * Lenobno proceduralen — kliče ga GET /api/notifications (precedens lenobne
 * čistke sej) in bodoči posli (§23 registry, če bo kanal asinhron).
 */
export async function dispatchQueuedNotifications(): Promise<DispatchSummary> {
  const queued = await db.notification.findMany({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    take: NOTIFICATION_DISPATCH_BATCH,
    select: { id: true, retryCount: true, maxRetries: true },
  })
  let dispatched = 0
  let failed = 0
  let retried = 0
  for (const row of queued) {
    try {
      await db.notification.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: new Date() },
      })
      dispatched += 1
    } catch (error) {
      const next = nextDispatchState(row, error)
      await db.notification
        .update({
          where: { id: row.id },
          data: {
            status: next.status,
            retryCount: next.retryCount,
            lastError: next.lastError,
          },
        })
        .catch(() => {
          // Tudi FAILED zapis je padel — vrstica ostane QUEUED, naslednji
          // dispatch poskusi znova (retry po politiki); brez tihe izgube.
        })
      if (next.status === 'FAILED') failed += 1
      else retried += 1
    }
  }
  return { dispatched, failed, retried }
}

/** Filtro obseg za prejemnika: lastne vrstice ALI vrstice moje vloge. */
export function visibleScope(me: { userId: string; vloga: UserRole }): {
  OR: { userId?: string; recipientRole?: UserRole }[]
} {
  return {
    OR: [{ userId: me.userId }, { recipientRole: me.vloga }],
  }
}

/**
 * Ack klienta: vrstice, ki jih je uporabnik POCEL, grejo SENT → DELIVERED
 * (idempotentno — samo SENT se prestavi; DELIVERED/OPENED ostanejo).
 */
export async function markNotificationsDelivered(opts: {
  userId: string
  vloga: UserRole
  ids?: string[]
  now?: Date
}): Promise<number> {
  const now = opts.now ?? new Date()
  const res = await db.notification.updateMany({
    where: {
      status: 'SENT',
      ...(opts.ids && opts.ids.length > 0 ? { id: { in: opts.ids } } : {}),
      ...visibleScope({ userId: opts.userId, vloga: opts.vloga }),
    },
    data: { status: 'DELIVERED', deliveredAt: now },
  })
  return res.count
}

/**
 * Odpiranje: SENT|DELIVERED → OPENED (isRead=true, openedAt).
 * Že OPENED → idempotenten no-op (vrne obstoječe). QUEUED/FAILED → napaka
 * (fail-closed: odpreti se da samo oddano obvestilo).
 */
export async function markNotificationOpened(opts: {
  id: string
  userId: string
  vloga: UserRole
  now?: Date
}): Promise<{ id: string; status: 'OPENED' }> {
  const row = await db.notification.findUnique({ where: { id: opts.id } })
  if (!row) throw new NotificationNotFoundError()
  const scope = visibleScope({ userId: opts.userId, vloga: opts.vloga })
  const visible =
    scope.OR.some((cond) =>
      cond.userId ? row.userId === cond.userId : row.recipientRole === cond.recipientRole,
    ) || false
  if (!visible) throw new NotificationNotFoundError()
  if (row.status === 'OPENED') return { id: row.id, status: 'OPENED' }
  if (!transitionAllowed(row.status, 'OPENED')) {
    throw new NotificationTransitionError(
      `Obvestila v stanju ${row.status} ni mogoče odpreti (stroga tabela prehodov).`,
    )
  }
  await db.notification.update({
    where: { id: opts.id },
    data: { status: 'OPENED', isRead: true, openedAt: opts.now ?? new Date() },
  })
  return { id: row.id, status: 'OPENED' }
}

export class NotificationNotFoundError extends Error {
  constructor() {
    super('Obvestilo ne obstaja ali ni dostopno tej seji.')
  }
}

/**
 * §23 × §29 povezava: neuspešni posli vzdrževanja obvestijo ADMIN-e
 * (role-naslovljeno, entity = jobrun, correlationId run-a). lastError je ŽE
 * sanitiziran v JobRun (§23) — prenos je varen.
 */
export async function queueJobFailureNotifications(
  outcomes: readonly { jobId: string; type: string; status: string; lastError: string | null }[],
  opts: { correlationId: string },
): Promise<number> {
  const failures = outcomes.filter((o) => o.status === 'FAILED')
  if (failures.length === 0) return 0
  return queueNotifications({
    template: 'JOB_FAILED',
    naslov: `Vzdrževanje: posel ${failures[0].type} spodletel`,
    sporocilo:
      failures.length === 1
        ? (failures[0].lastError ?? 'Posel je spodletel brez razloga.')
        : `${failures.length} poslov je spodletelo: ${failures.map((f) => f.type).join(', ')}.`,
    recipients: [{ recipientRole: 'ADMIN' }],
    entity: { type: 'jobrun', id: failures[0].jobId },
    correlationId: opts.correlationId,
  })
}
