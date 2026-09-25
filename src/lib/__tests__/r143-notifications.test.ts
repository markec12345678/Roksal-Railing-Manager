// R143 — integracijski testi (issue #5 §29 — Notifications lifecycle).
// ---------------------------------------------------------------------------
//   • Stroga tabela prehodov (samo naprej): QUEUED → SENT → DELIVERED → OPENED,
//     QUEUED → FAILED; OPENED/FAILED sta terminalna (brez vračanja nazaj).
//   • queueNotifications: fail-closed predloge (neznana → napaka), XOR
//     naslavljanje (userId ALI recipientRole), verzija predloge je eksplicitna.
//   • nextDispatchState (čista): retry politika — retryCount+1 < max → QUEUED,
//     sicer FAILED z sanitiziranim lastError (§22 — brez stacka).
//   • dispatch: QUEUED → SENT (sentAt), idempotentno (drugi prehod nič).
//   • Delivery ack: SENT → DELIVERED za vidni obseg (lastne + moje vloge).
//   • Open ack: SENT|DELIVERED → OPENED + isRead; idempotentno; QUEUED → 409;
//     tuj id → 404 (ne razkriva obstoja).
//   • API matrica: GET/POST read anon 401 + correlation; MONTER vidi samo svoj
//     obseg; inventory integracija (premik pod minimumom → SKLADISCE vrsta).
//   • §23 × §29: FAILED posel → ADMIN role-naslovljena vrstica (entity=jobrun).
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R142).
// Brez AI, brez naključja — testne vrstice so označene z correlationId
// 'r143-test-…' in se počistijo v beforeEach (izolacija od drugih run-ov).
import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { GET as notificationsGet } from '@/app/api/notifications/route'
import { POST as notificationsReadPost } from '@/app/api/notifications/read/route'
import { POST as inventoryPost } from '@/app/api/inventory/route'
import {
  NOTIFICATION_TEMPLATES,
  NOTIFICATION_MAX_RETRIES,
  transitionAllowed,
  queueNotifications,
  nextDispatchState,
  dispatchQueuedNotifications,
  markNotificationOpened,
  queueJobFailureNotifications,
  NotificationTemplateError,
  NotificationRecipientError,
  NotificationTransitionError,
  NotificationNotFoundError,
} from '@/lib/notifications'

const BASE = 'http://localhost/api'

function req(
  path: string,
  token: string | null,
  method = 'GET',
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const TEST_CORR = 'r143-test'

/** Počisti testne vrstice (correlationId pripada izključno testu). */
async function cleanup() {
  await db.notification.deleteMany({ where: { correlationId: { startsWith: TEST_CORR } } })
}

beforeEach(cleanup)

describe('R143 §29 — predloge in strogi prehodi', () => {
  it('predloge so registrirane z eksplicitno verzijo (deterministično)', () => {
    expect(NOTIFICATION_TEMPLATES.LOW_STOCK.version).toBe(1)
    expect(NOTIFICATION_TEMPLATES.JOB_FAILED.version).toBe(1)
    expect(NOTIFICATION_MAX_RETRIES).toBe(3)
  })

  it('tabela prehodov dovoljuje SAMO naprej', () => {
    expect(transitionAllowed('QUEUED', 'SENT')).toBe(true)
    expect(transitionAllowed('QUEUED', 'FAILED')).toBe(true)
    expect(transitionAllowed('SENT', 'DELIVERED')).toBe(true)
    expect(transitionAllowed('SENT', 'OPENED')).toBe(true)
    expect(transitionAllowed('DELIVERED', 'OPENED')).toBe(true)
    // nazaj ali mimo stroga tabela NE dovoli:
    expect(transitionAllowed('QUEUED', 'OPENED')).toBe(false)
    expect(transitionAllowed('DELIVERED', 'SENT')).toBe(false)
    expect(transitionAllowed('SENT', 'QUEUED')).toBe(false)
    expect(transitionAllowed('OPENED', 'SENT')).toBe(false)
    expect(transitionAllowed('FAILED', 'SENT')).toBe(false)
    expect(transitionAllowed('NEZNAN', 'SENT')).toBe(false)
  })

  it('neznana predloga → NotificationTemplateError (fail-closed, brez tihega zapisa)', async () => {
    await expect(
      queueNotifications({
        // @ts-expect-error — namenoma neznana predloga (runtime preverba)
        template: 'NEOBSTOJEC',
        naslov: 'x',
        recipients: [{ recipientRole: 'ADMIN' }],
        correlationId: TEST_CORR,
      }),
    ).rejects.toBeInstanceOf(NotificationTemplateError)
  })

  it('verzija predloge se mora ujemati z registrom', async () => {
    await expect(
      queueNotifications({
        template: 'LOW_STOCK',
        templateVersion: 99,
        naslov: 'x',
        recipients: [{ recipientRole: 'ADMIN' }],
        correlationId: TEST_CORR,
      }),
    ).rejects.toBeInstanceOf(NotificationTemplateError)
  })

  it('naslavljanje je XOR: oboje ALI nič → NotificationRecipientError', async () => {
    await expect(
      queueNotifications({
        template: 'LOW_STOCK',
        naslov: 'x',
        recipients: [{ userId: 'u1', recipientRole: 'ADMIN' }],
        correlationId: TEST_CORR,
      }),
    ).rejects.toBeInstanceOf(NotificationRecipientError)
    await expect(
      queueNotifications({
        template: 'LOW_STOCK',
        naslov: 'x',
        recipients: [{}],
        correlationId: TEST_CORR,
      }),
    ).rejects.toBeInstanceOf(NotificationRecipientError)
    await expect(
      queueNotifications({
        template: 'LOW_STOCK',
        naslov: 'x',
        recipients: [],
        correlationId: TEST_CORR,
      }),
    ).rejects.toBeInstanceOf(NotificationRecipientError)
  })

  it('vrsta: ena vrstica na prejemnika, status QUEUED, z entiteto + korelacijo', async () => {
    const count = await queueNotifications({
      template: 'LOW_STOCK',
      naslov: 'R143 vrsta test',
      sporocilo: 'pod minimumom',
      recipients: [{ recipientRole: 'SKLADISCE' }, { recipientRole: 'VODJA' }],
      entity: { type: 'inventory', id: 'inv-1' },
      correlationId: TEST_CORR,
    })
    expect(count).toBe(2)
    const rows = await db.notification.findMany({ where: { correlationId: TEST_CORR } })
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r.status).toBe('QUEUED')
      expect(r.template).toBe('LOW_STOCK')
      expect(r.templateVersion).toBe(1)
      expect(r.entityType).toBe('inventory')
      expect(r.entityId).toBe('inv-1')
      expect(r.maxRetries).toBe(NOTIFICATION_MAX_RETRIES)
      expect(r.isRead).toBe(false)
      expect(r.sentAt).toBeNull()
    }
  })
})

describe('R143 §29 — dispatch + retry politika', () => {
  it('nextDispatchState: retry do max, potem FAILED z sanitiziranim lastError', () => {
    const err = new Error('neka napaka')
    const retried = nextDispatchState({ retryCount: 0, maxRetries: 3 }, err)
    expect(retried.status).toBe('QUEUED')
    expect(retried.retryCount).toBe(1)
    expect(retried.lastError).toBe('neka napaka')
    const terminal = nextDispatchState({ retryCount: 2, maxRetries: 3 }, err)
    expect(terminal.status).toBe('FAILED')
    expect(terminal.retryCount).toBe(3)
    expect(terminal.lastError).toBe('neka napaka')
    // brez stacka — samo message (§22)
    expect(terminal.lastError).not.toContain('at ')
  })

  it('dispatch: QUEUED → SENT z sentAt; drugi prehod = nič (idempotentno)', async () => {
    await queueNotifications({
      template: 'JOB_FAILED',
      naslov: 'R143 dispatch test',
      recipients: [{ recipientRole: 'ADMIN' }],
      correlationId: TEST_CORR,
    })
    const first = await dispatchQueuedNotifications()
    expect(first.dispatched).toBeGreaterThanOrEqual(1)
    const row = await db.notification.findFirstOrThrow({ where: { correlationId: TEST_CORR } })
    expect(row.status).toBe('SENT')
    expect(row.sentAt).not.toBeNull()
    const second = await dispatchQueuedNotifications()
    expect(second.dispatched).toBe(0)
    const after = await db.notification.findFirstOrThrow({ where: { correlationId: TEST_CORR } })
    expect(after.status).toBe('SENT')
    // Prisma vrača nove Date instance — primerjaj INSTANT, ne identiteto.
    expect(after.sentAt?.getTime()).toBe(row.sentAt?.getTime())
  })
})

describe('R143 §29 — delivery + open ack (lib)', () => {
  it('open: SENT → OPENED + isRead; že OPENED = idempotentno; QUEUED → napaka', async () => {
    const userId = 'r143-lib-user'
    const created = await db.notification.create({
      data: {
        userId,
        naslov: 'R143 open test',
        template: 'LOW_STOCK',
        status: 'SENT',
        sentAt: new Date(),
        correlationId: TEST_CORR,
      },
    })
    await markNotificationOpened({ id: created.id, userId, vloga: 'MONTER' })
    const opened = await db.notification.findUniqueOrThrow({ where: { id: created.id } })
    expect(opened.status).toBe('OPENED')
    expect(opened.isRead).toBe(true)
    expect(opened.openedAt).not.toBeNull()
    // idempotentno — drugi open je no-op
    await markNotificationOpened({ id: created.id, userId, vloga: 'MONTER' })
    const still = await db.notification.findUniqueOrThrow({ where: { id: created.id } })
    expect(still.status).toBe('OPENED')
    // QUEUED ni odirljivo (stroga tabela)
    const queued = await db.notification.create({
      data: {
        userId,
        naslov: 'R143 open queued',
        template: 'LOW_STOCK',
        status: 'QUEUED',
        correlationId: TEST_CORR,
      },
    })
    await expect(
      markNotificationOpened({ id: queued.id, userId, vloga: 'MONTER' }),
    ).rejects.toBeInstanceOf(NotificationTransitionError)
    // tuj id → NotFound (ne razkriva obstoja)
    await expect(
      markNotificationOpened({ id: created.id, userId: 'drug-profil', vloga: 'MONTER' }),
    ).rejects.toBeInstanceOf(NotificationNotFoundError)
  })

  it('tuj/neznan id → NotificationNotFoundError', async () => {
    await expect(
      markNotificationOpened({ id: 'ne-obstaja', userId: 'u', vloga: 'MONTER' }),
    ).rejects.toBeInstanceOf(NotificationNotFoundError)
  })
})

describe('R143 §29 — API matrica', () => {
  it('GET anon → 401 + x-correlation-id; POST read anon → 401', async () => {
    const anonGet = await notificationsGet(req('/api/notifications', null))
    expect(anonGet.status).toBe(401)
    expect(anonGet.headers.get('x-correlation-id')).toBeTruthy()
    const anonRead = await notificationsReadPost(
      req('/api/notifications/read', null, 'POST', { id: 'x' }),
    )
    expect(anonRead.status).toBe(401)
    expect(anonRead.headers.get('x-correlation-id')).toBeTruthy()
  })

  it('GET s sejo: dispatch + delivery ack; MONTER ne vidi tujih vlog', async () => {
    const { user, token } = await createTestUserWithSession('r143monter', 'MONTER')
    // lastna vrstica (QUEUED → dispatch → SENT → ack DELIVERED v ISTI zahtevi)
    await queueNotifications({
      template: 'LOW_STOCK',
      naslov: 'R143 lastna',
      recipients: [{ userId: user.id }],
      correlationId: TEST_CORR,
    })
    // tujčena vrstica (druga vloga — MONTER je NE vidi)
    await queueNotifications({
      template: 'LOW_STOCK',
      naslov: 'R143 skladiščna',
      recipients: [{ recipientRole: 'SKLADISCE' }],
      correlationId: TEST_CORR,
    })
    const res = await notificationsGet(req('/api/notifications?limit=10', token))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-correlation-id')).toBeTruthy()
    const data = (await res.json()) as {
      notifications: { id: string; naslov: string; status: string }[]
    }
    const mine = data.notifications.find((n) => n.naslov === 'R143 lastna')
    expect(mine).toBeDefined()
    expect(mine!.status).toBe('DELIVERED') // dispatch + ack v isti zahtevi
    expect(data.notifications.find((n) => n.naslov === 'R143 skladiščna')).toBeUndefined()
    const mineRow = await db.notification.findUniqueOrThrow({ where: { id: mine!.id } })
    expect(mineRow.status).toBe('DELIVERED')
    expect(mineRow.deliveredAt).not.toBeNull()
  })

  it('POST read: veljaven id → 200 OPENED; tuj id → 404; napačno telo → 400; QUEUED → 409', async () => {
    const { user, token } = await createTestUserWithSession('r143monter2', 'MONTER')
    const row = await db.notification.create({
      data: {
        userId: user.id,
        naslov: 'R143 read test',
        template: 'LOW_STOCK',
        status: 'SENT',
        sentAt: new Date(),
        correlationId: TEST_CORR,
      },
    })
    const ok = await notificationsReadPost(
      req('/api/notifications/read', token, 'POST', { id: row.id }),
    )
    expect(ok.status).toBe(200)
    expect(ok.headers.get('x-correlation-id')).toBeTruthy()
    expect(((await ok.json()) as { status: string }).status).toBe('OPENED')
    // tuj id (druga seja) → 404
    const { token: other } = await createTestUserWithSession('r143monter3', 'MONTER')
    const foreign = await notificationsReadPost(
      req('/api/notifications/read', other, 'POST', { id: row.id }),
    )
    expect(foreign.status).toBe(404)
    // napačno telo → 400
    const bad = await notificationsReadPost(
      req('/api/notifications/read', token, 'POST', { id: '' }),
    )
    expect(bad.status).toBe(400)
    // QUEUED → 409 (stroga tabela prehodov)
    const queued = await db.notification.create({
      data: {
        userId: user.id,
        naslov: 'R143 read queued',
        template: 'LOW_STOCK',
        status: 'QUEUED',
        correlationId: TEST_CORR,
      },
    })
    const conflict = await notificationsReadPost(
      req('/api/notifications/read', token, 'POST', { id: queued.id }),
    )
    expect(conflict.status).toBe(409)
  })
})

describe('R143 §29 — integracije (inventory × §23 jobs)', () => {
  it('premik zaloge pod minimum → SKLADISCE vrsta (LOW_STOCK v1, entity, korelacija)', async () => {
    // Upsert na unique sifraMateriala: ostanki prejšnjih run-ov (FK veriga
    // InventoryMovement/MaterialUsage preprečuje delete) se RE-STANJE nastavijo
    // na testno stanje 5/10 — idempotentno, brez boja s tujimi ključi.
    const inv = await db.inventory.upsert({
      where: { sifraMateriala: 'R143-TEST' },
      update: { kolicinaZaloga: 5, minimalnaZaloga: 10 },
      create: {
        sifraMateriala: 'R143-TEST',
        naziv: 'R143 Test Artikel',
        tip: 'material',
        enota: 'kos',
        kolicinaZaloga: 5,
        minimalnaZaloga: 10,
      },
    })
    // R144 (§24): re-stanira šaržo (vzorec backfill migracije LOT-LEGACY-<id>) —
    // upsert bilance NE zravna s quantityRemaining šarže; brez tega bi ponovni
    // run Issue 409-al ("šarže ne pokrijejo"). Idempotentno per run.
    await db.inventoryLot.upsert({
      where: {
        inventoryId_lotNumber: { inventoryId: inv.id, lotNumber: `LOT-LEGACY-${inv.id}` },
      },
      update: { quantityRemaining: 5, quantityInitial: 5, status: 'ACTIVE' },
      create: {
        inventoryId: inv.id,
        lotNumber: `LOT-LEGACY-${inv.id}`,
        quantityInitial: 5,
        quantityRemaining: 5,
        status: 'ACTIVE',
        note: 'Zaloga pred uvedbo šarž (§24 backfill) — poreklo neznano',
      },
    })
    try {
      const { token } = await createTestUserWithSession('r143vodja', 'VODJA')
      const res = await inventoryPost(
        req(
          '/api/inventory',
          token,
          'POST',
          {
            tipPremika: 'PORABA',
            inventoryId: inv.id,
            kolicina: 2,
          },
          { 'x-correlation-id': TEST_CORR + '-inv' },
        ),
      )
      expect(res.status).toBe(201)
      const rows = await db.notification.findMany({
        where: { correlationId: TEST_CORR + '-inv', template: 'LOW_STOCK', entityType: 'inventory' },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].recipientRole).toBe('SKLADISCE')
      expect(rows[0].userId).toBeNull()
      expect(rows[0].entityId).toBe(inv.id)
      expect(rows[0].templateVersion).toBe(1)
      expect(rows[0].correlationId).not.toBeNull()
    } finally {
      // Ostane kot dev-test peskovnik v roksal_test (vzorec R140 naročila) —
      // naslednji run ga upsertom re-stanira na 5/10.
    }
  })

  it('FAILED posel → ADMIN vrstica (JOB_FAILED v1, entity=jobrun); uspešni → nič', async () => {
    const queued = await queueJobFailureNotifications(
      [
        { jobId: 'job-1', type: 'test-fail', status: 'FAILED', lastError: 'kaj je šlo narobe' },
        { jobId: 'job-2', type: 'idempotency-gc', status: 'SUCCEEDED', lastError: null },
      ],
      { correlationId: TEST_CORR },
    )
    expect(queued).toBe(1)
    const row = await db.notification.findFirstOrThrow({
      where: { correlationId: TEST_CORR, template: 'JOB_FAILED' },
    })
    expect(row.recipientRole).toBe('ADMIN')
    expect(row.entityType).toBe('jobrun')
    expect(row.entityId).toBe('job-1')
    expect(row.sporocilo).toBe('kaj je šlo narobe')
    // samo uspešni → brez vrstic
    const none = await queueJobFailureNotifications(
      [{ jobId: 'job-3', type: 'session-gc', status: 'SUCCEEDED', lastError: null }],
      { correlationId: TEST_CORR },
    )
    expect(none).toBe(0)
  })
})
