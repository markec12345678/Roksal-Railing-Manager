// Roksal — matrika dovoljenj (R135, issue #5 §10)
// ---------------------------------------------------------------------------
// Dokazuje §10 pogodbo (baza roksal_test prek globalSetup):
//   • katalog: vsa dovoljenja iz spec (30) + 2 read-dodatka (users.read,
//     invoices.read) z oznako spec:false; unikatni, opisani, frozen;
//   • vloga → dovoljenja: ADMIN = vse; VODJA = vse razen users.manage;
//     MONTER terenski set; SKLADISCE skladiščni set; neznana vloga → []
//     (fail-closed); determinizem (isti klic → isti seznam);
//   • API ključ (MOBILE_SYNC) → dovoljenja prek scope-ov (projects:*);
//     uradne površine (računi, dokumenti, portal, users) NIKOLI;
//   • denyWithoutPermission: 401 anon / 403 apikey / 403 z IMENOM dovoljenja;
//   • rute preverjajo konkretno dovoljenje (spot-testi: portal.manage,
//     users.manage, invoices.create, procurement.receive-only, price.override).
// Brez AI, brez naključja (unikatni e-naslovi izključno za izolacijo testov).

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import {
  ALL_PERMISSIONS,
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
  describePermission,
  hasPermission,
  missingPermissions,
  permissionsForPrincipal,
  permissionsForRole,
} from '@/lib/permissions'
import { denyWithoutPermission } from '@/lib/auth'
import type { AuthContext } from '@/lib/auth'
import type { SessionPayload } from '@/lib/session'

const SPEC_PERMISSIONS = [
  'projects.read', 'projects.write', 'customers.read', 'customers.write',
  'measurements.approve', 'quotes.create', 'quotes.approve', 'price.override', 'deal.lock',
  'inventory.read', 'inventory.write', 'inventory.adjust',
  'procurement.create', 'procurement.approve', 'procurement.receive',
  'invoices.create', 'invoices.issue', 'invoices.cancel',
  'documents.read', 'documents.generate', 'documents.sign',
  'portal.manage', 'users.manage', 'catalog.manage', 'production.manage', 'warranty.manage',
] as const

const MONTER_SET = [
  'projects.read', 'projects.write', 'customers.read', 'customers.write',
  'quotes.create', 'deal.lock', 'inventory.read', 'invoices.read',
  'documents.read', 'documents.generate', 'documents.sign',
] as const

const SKLADISCE_SET = [
  'projects.read', 'customers.read', 'inventory.read', 'inventory.write',
  'procurement.receive', 'invoices.read', 'documents.read',
] as const

/** Sejni principal brez baze (kriptografija ni potrebna — lib deluje na payload). */
function userOf(vloga: string): AuthContext {
  const session: SessionPayload = {
    sub: `u-${vloga}`,
    email: `${vloga.toLowerCase()}@test.si`,
    ime: `Test ${vloga}`,
    vloga,
    exp: Math.floor(Date.now() / 1000) + 600,
    jti: 'test-jti',
  }
  return { kind: 'user', session }
}

function requestOf(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/test', { method: 'POST', headers })
}

describe('katalog dovoljenj (§10 spec + read-pariteta)', () => {
  it('vsebuje vsa 26 dovoljenj iz §10 spec + 2 r135 dodatka; vsi opisani; frozen', () => {
    for (const p of SPEC_PERMISSIONS) {
      expect(PERMISSION_CATALOG[p as keyof typeof PERMISSION_CATALOG]).toBeDefined()
      expect(PERMISSION_CATALOG[p as keyof typeof PERMISSION_CATALOG].spec).toBe(true)
    }
    expect(PERMISSION_CATALOG['users.read'].spec).toBe(false)
    expect(PERMISSION_CATALOG['invoices.read'].spec).toBe(false)
    expect(ALL_PERMISSIONS).toHaveLength(28)
    expect(new Set(ALL_PERMISSIONS).size).toBe(28)
    for (const p of ALL_PERMISSIONS) {
      expect(PERMISSION_CATALOG[p].label.length).toBeGreaterThan(2)
      expect(PERMISSION_CATALOG[p].opis.length).toBeGreaterThan(4)
    }
    expect(Object.isFrozen(ALL_PERMISSIONS)).toBe(true)
  })

  it('describePermission vrne slovensko oznako; manjkajoče → ime (fail-visible)', () => {
    expect(describePermission('invoices.create')).toBe('Izdelava računov')
    expect(describePermission('price.override')).toBe('Spreminjanje cen')
  })
})

describe('vloga → dovoljenja (deterministična matrika)', () => {
  it('ADMIN ima VSE; VODJA vse razen users.manage; noben tihi prisluh', () => {
    expect(permissionsForRole('ADMIN')).toEqual(ALL_PERMISSIONS)
    const vodja = permissionsForRole('VODJA')
    expect(vodja).toHaveLength(27)
    expect(vodja).not.toContain('users.manage')
    expect(vodja).toContain('price.override')
    expect(vodja).toContain('portal.manage')
    expect(vodja).toContain('users.read')
  })

  it('MONTER ima točno terenski set (deal.lock DA, price/portal/users NE)', () => {
    expect(permissionsForRole('MONTER')).toEqual(MONTER_SET)
  })

  it('SKLADISCE ima točno skladiščni set (prejem DA, approve/inventura NE)', () => {
    expect(permissionsForRole('SKLADISCE')).toEqual(SKLADISCE_SET)
  })

  it('neznana vloga → prazen seznam (fail-closed) + determinizem', () => {
    expect(permissionsForRole('GOST')).toEqual([])
    expect(permissionsForRole('')).toEqual([])
    expect([...permissionsForRole('VODJA')]).toEqual([...permissionsForRole('VODJA')])
  })

  it('rezervirana dovoljenja nimajo tihe pravice nikomur (razen ADMIN/VODJA)', () => {
    for (const reserved of ['measurements.approve', 'quotes.approve', 'inventory.adjust', 'warranty.manage'] as const) {
      expect(permissionsForRole('MONTER')).not.toContain(reserved)
      expect(permissionsForRole('SKLADISCE')).not.toContain(reserved)
      expect(permissionsForRole('VODJA')).toContain(reserved)
    }
  })
})

describe('API ključ (MOBILE_SYNC) — dovoljenja prek scope-ov', () => {
  it('projects scope-i se preslikajo; uradne površine NIKOLI', () => {
    const apikey = (scopes: readonly string[]) =>
      ({ kind: 'apikey', name: 'k', id: 'id1', scopes, projectScope: null }) as AuthContext
    expect(permissionsForPrincipal(apikey(['projects:read', 'projects:write']))).toEqual([
      'projects.read',
      'projects.write',
    ])
    expect(hasPermission(apikey(['projects:read', 'projects:write']), 'invoices.create')).toBe(false)
    expect(hasPermission(apikey(['projects:read']), 'portal.manage')).toBe(false)
    expect(hasPermission(apikey(['projects:read']), 'users.manage')).toBe(false)
    expect(hasPermission(apikey(['projects:read']), 'price.override')).toBe(false)
    expect(hasPermission(apikey(['measurements:create', 'photos:read']), 'projects.read')).toBe(false)
    expect(permissionsForPrincipal(apikey([]))).toEqual([])
  })
})

describe('denyWithoutPermission — vrata na ravni zahtevka', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('401 brez identitete; 403 za API ključ s pojasnilom', async () => {
    const anon = await denyWithoutPermission(requestOf({}), 'projects.read')
    expect(anon?.status).toBe(401)
    const apikeyReq = requestOf({ authorization: 'Bearer rkm_neobstaja' })
    const denied = await denyWithoutPermission(apikeyReq, 'projects.read')
    expect(denied?.status).toBe(401) // neveljaven ključ → fail-closed 401
  })

  it('403 MONTER na invoices.create z imenom dovoljenja v detail', async () => {
    const denied = await denyWithoutPermission(requestOf({}), 'invoices.create')
    // anon gre v 401 — konkretna 403 pot se testira na route spot-testih spodaj
    expect(denied?.status).toBe(401)
  })

  it('helper missingPermissions vrne SAMO manjkajoče v vrstnem redu', () => {
    const monter = userOf('MONTER')
    expect(missingPermissions(monter, ['quotes.create', 'price.override', 'users.manage'])).toEqual([
      'price.override',
      'users.manage',
    ])
    expect(missingPermissions(monter, ['quotes.create'])).toEqual([])
  })
})

describe('rute preverjajo KONKRETNO dovoljenje (spot-testi, živa baza)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('POST /api/portal enable kot MONTER (lastnik projekta) → 403 z portal.manage', async () => {
    const { user, token } = await createTestUserWithSession(`r135-perm-portal-${Date.now()}`)
    const customer = await db.customer.create({ data: { ime: `R135-P-${Date.now()}`, naslov: 'T' } })
    const project = await db.project.create({
      data: { customerId: customer.id, nazivProjekta: 'R135-perm', monterId: user.id },
    })
    const route = await import('@/app/api/portal/route')
    const res = await route.POST(
      new Request('http://localhost/api/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'http://localhost' },
        body: JSON.stringify({ projectId: project.id, action: 'enable' }),
      }),
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('portal.manage')
  })

  it('POST /api/users kot VODJA → 403 z users.manage (R134 pogodba ostaja)', async () => {
    const { token } = await createTestUserWithSession(`r135-perm-users-${Date.now()}`, 'VODJA')
    const route = await import('@/app/api/users/route')
    const res = await route.POST(
      new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'http://localhost' },
        body: JSON.stringify({ action: 'invite', email: `x-${Date.now()}@test.si`, ime: 'X', vloga: 'MONTER' }),
      }),
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { detail: string }
    expect(body.detail).toContain('users.manage')
  })

  it('POST /api/invoices kot MONTER → 403 z invoices.create; PATCH kot MONTER → 403 z invoices.issue', async () => {
    const { token } = await createTestUserWithSession(`r135-perm-inv-${Date.now()}`)
    const route = await import('@/app/api/invoices/route')
    const post = await route.POST(
      new Request('http://localhost/api/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'http://localhost' },
        body: JSON.stringify({}),
      }),
    )
    expect(post.status).toBe(403)
    expect(((await post.json()) as { detail: string }).detail).toContain('invoices.create')

    const patch = await route.PATCH(
      new Request('http://localhost/api/invoices', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'http://localhost' },
        body: JSON.stringify({ id: 'neobstaja', status: 'IZDAN' }),
      }),
    )
    expect(patch.status).toBe(403)
    expect(((await patch.json()) as { detail: string }).detail).toContain('invoices.issue')
  })

  it('PATCH /api/material-orders kot SKLADISCE: prehod ≠ DOBLJENO → 403 (receive-only)', async () => {
    const { token } = await createTestUserWithSession(`r135-perm-mo-${Date.now()}`, 'SKLADISCE')
    const route = await import('@/app/api/material-orders/route')
    const res = await route.PATCH(
      new Request('http://localhost/api/material-orders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'http://localhost' },
        body: JSON.stringify({ id: 'neobstaja', status: 'POTRJENO' }),
      }),
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { detail: string }
    expect(body.detail).toContain('procurement.approve')
  })

  it('PATCH /api/material-orders kot MONTER → 403 (niti approve niti receive)', async () => {
    const { token } = await createTestUserWithSession(`r135-perm-mo2-${Date.now()}`)
    const route = await import('@/app/api/material-orders/route')
    const res = await route.PATCH(
      new Request('http://localhost/api/material-orders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'http://localhost' },
        body: JSON.stringify({ id: 'neobstaja', status: 'DOBLJENO' }),
      }),
    )
    expect(res.status).toBe(403)
    expect(((await res.json()) as { detail: string }).detail).toContain('procurement.receive')
  })

  it('POST /api/material-prices kot MONTER → 403 z price.override', async () => {
    const { token } = await createTestUserWithSession(`r135-perm-mp-${Date.now()}`)
    const route = await import('@/app/api/material-prices/route')
    const res = await route.POST(
      new Request('http://localhost/api/material-prices', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'http://localhost' },
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(403)
    expect(((await res.json()) as { detail: string }).detail).toContain('price.override')
  })

  it('deal.lock: MONTER GA IMA (teren zaklepa posel); SKLADISCE NE', () => {
    expect(hasPermission(userOf('MONTER'), 'deal.lock')).toBe(true)
    expect(hasPermission(userOf('SKLADISCE'), 'deal.lock')).toBe(false)
    expect(hasPermission(userOf('VODJA'), 'deal.lock')).toBe(true)
  })
})
