// S+9 (issue #4 §3) — Resource-level avtorizacija: matrika vlog + IDOR pravila.
import { describe, it, expect } from 'vitest'
import {
  projectAccessAllowed,
  projectWhereForPrincipal,
  canManageInventory,
  canManageCustomers,
  canDeleteCustomer,
  actorIdOf,
  AccessDeniedError,
  assertProjectAccess,
} from '@/lib/access'
import type { AuthContext } from '@/lib/auth'

function user(vloga: string, sub = 'u1'): AuthContext {
  return {
    kind: 'user',
    session: { sub, email: `${vloga.toLowerCase()}@x.si`, ime: vloga, vloga, exp: 9999999999 },
  }
}

const apiKey: AuthContext = { kind: 'apikey', name: 'test-key' }

const ownProject = { id: 'p1', monterId: 'u1', vodjaId: null, dealLocked: false }
const foreignProject = { id: 'p2', monterId: 'kdo-drug', vodjaId: null, dealLocked: false }
const managerProject = { id: 'p3', monterId: 'kdo-drug', vodjaId: 'u1', dealLocked: false }
const lockedProject = { id: 'p4', monterId: 'u1', vodjaId: null, dealLocked: true }

describe('matrika dostopa do projekta', () => {
  it('MONTER: lasten projekt read/update', () => {
    expect(projectAccessAllowed(user('MONTER'), ownProject, 'read')).toBe(true)
    expect(projectAccessAllowed(user('MONTER'), ownProject, 'update')).toBe(true)
  })

  it('MONTER: tuj projekt NI dostopen (IDOR → 403)', () => {
    expect(projectAccessAllowed(user('MONTER'), foreignProject, 'read')).toBe(false)
    expect(projectAccessAllowed(user('MONTER'), foreignProject, 'update')).toBe(false)
  })

  it('MONTER: vodja projekta (vodjaId) ima dostop', () => {
    expect(projectAccessAllowed(user('VODJA', 'u1'), managerProject, 'read')).toBe(true)
  })

  it('MONTER/SKLADISCE: delete in lock nikoli', () => {
    expect(projectAccessAllowed(user('MONTER'), ownProject, 'delete')).toBe(false)
    expect(projectAccessAllowed(user('MONTER'), ownProject, 'lock')).toBe(false)
    expect(projectAccessAllowed(user('SKLADISCE'), ownProject, 'update')).toBe(false)
  })

  it('SKLADISCE: bere vse, ne piše', () => {
    expect(projectAccessAllowed(user('SKLADISCE'), foreignProject, 'read')).toBe(true)
    expect(projectAccessAllowed(user('SKLADISCE'), foreignProject, 'changeStatus')).toBe(false)
  })

  it('dealLocked: monter ne sme spreminjati zaklenjenega projekta', () => {
    expect(projectAccessAllowed(user('MONTER'), lockedProject, 'update')).toBe(false)
    expect(projectAccessAllowed(user('MONTER'), lockedProject, 'changeStatus')).toBe(false)
    // branje ostane dovoljeno
    expect(projectAccessAllowed(user('MONTER'), lockedProject, 'read')).toBe(true)
  })

  it('vodstvo: vse pravice na vseh projektih', () => {
    for (const access of ['read', 'update', 'delete', 'lock', 'changeStatus'] as const) {
      expect(projectAccessAllowed(user('ADMIN'), foreignProject, access)).toBe(true)
      expect(projectAccessAllowed(user('VODJA'), foreignProject, access)).toBe(true)
      expect(projectAccessAllowed(apiKey, foreignProject, access)).toBe(true)
    }
  })
})

describe('assertProjectAccess — 404 vs 403', () => {
  it('null projekt → 404 (ne razkriva obstoja)', () => {
    try {
      assertProjectAccess(user('ADMIN'), null, 'read')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(AccessDeniedError)
      expect((e as AccessDeniedError).status).toBe(404)
    }
  })

  it('tuj projekt → 403', () => {
    try {
      assertProjectAccess(user('MONTER', 'u9'), foreignProject, 'update')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(AccessDeniedError)
      expect((e as AccessDeniedError).status).toBe(403)
    }
  })
})

describe('filter seznamov + ostalo', () => {
  it('MONTER: WHERE omejen na svoje projekte', () => {
    const where = JSON.parse(JSON.stringify(projectWhereForPrincipal(user('MONTER', 'abc')))) as {
      OR: Array<Record<string, string>>
    }
    expect(where.OR).toContainEqual({ monterId: 'abc' })
    expect(where.OR).toContainEqual({ vodjaId: 'abc' })
  })

  it('vodstvo/skladišče: brez filtra (prazen objekt)', () => {
    expect(projectWhereForPrincipal(user('VODJA'))).toEqual({})
    expect(projectWhereForPrincipal(user('SKLADISCE'))).toEqual({})
    expect(projectWhereForPrincipal(apiKey)).toEqual({})
  })

  it('zaloga: SKLADISCE + vodstvo piše, monter ne', () => {
    expect(canManageInventory(user('SKLADISCE'))).toBe(true)
    expect(canManageInventory(user('ADMIN'))).toBe(true)
    expect(canManageInventory(user('VODJA'))).toBe(true)
    expect(canManageInventory(user('MONTER'))).toBe(false)
    expect(canManageInventory(apiKey)).toBe(true)
  })

  it('stranke: uporabniki ustvarjajo, brisanje samo vodstvo', () => {
    expect(canManageCustomers(user('MONTER'))).toBe(true)
    expect(canManageCustomers(apiKey)).toBe(false)
    expect(canDeleteCustomer(user('MONTER'))).toBe(false)
    expect(canDeleteCustomer(user('VODJA'))).toBe(true)
  })

  it('actorIdOf: apikey nima uporabniške pripisnosti (null za audit)', () => {
    expect(actorIdOf(user('MONTER', 'abc'))).toBe('abc')
    expect(actorIdOf(apiKey)).toBeNull()
  })
})
