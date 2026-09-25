// R138 (issue #5 §21) — testi avtorizacije globalnega iskanja.
//
// Kontekst buga: /api/search je za vsakega prijavljenega vračal zadetke po
// VSEH projektih/strankah — MONTER z 0 projekti je prek iskanja videl tuje
// projekte (produkcija QA: ?q=ja → 3 tuji projekti). Ti testi zaklennejo
// vidnost sekcij + LIKE escaping, tako da regresija ne more tiho nazaj.
import { describe, it, expect } from 'vitest'
import { searchVisibilityFor, escapeLikePattern } from '@/lib/search-access'
import type { AuthContext } from '@/lib/auth'

function userWithRoles(roles: string[]): AuthContext {
  return {
    kind: 'user',
    session: {
      sub: 'u1',
      email: 'u1@roksal.si',
      ime: 'Uporabnik Ena',
      vloga: roles[0] ?? 'MONTER',
      exp: Math.floor(Date.now() / 1000) + 600,
      jti: 'test-jti',
    },
  } as unknown as AuthContext
}

function apiKeyWithScopes(scopes: readonly string[]): AuthContext {
  return {
    kind: 'apikey',
    name: 'MOBILE_SYNC',
    id: 'k1',
    scopes,
    projectScope: null,
  } as unknown as AuthContext
}

describe('searchVisibilityFor (§21 — iskanje ne obide avtorizacije)', () => {
  it('MONTER (seja) vidi stranke + material, projekti pa se rešijo s where (samo svoji)', () => {
    const v = searchVisibilityFor(userWithRoles(['MONTER']))
    expect(v).toEqual({ projects: true, customers: true, inventory: true })
  })

  it('ADMIN/VODJA (seja) vidi vse sekcije', () => {
    expect(searchVisibilityFor(userWithRoles(['ADMIN']))).toEqual({
      projects: true,
      customers: true,
      inventory: true,
    })
    expect(searchVisibilityFor(userWithRoles(['VODJA']))).toEqual({
      projects: true,
      customers: true,
      inventory: true,
    })
  })

  it('SKLADISCE (seja) vidi vse sekcije (material kontekst)', () => {
    expect(searchVisibilityFor(userWithRoles(['SKLADISCE']))).toEqual({
      projects: true,
      customers: true,
      inventory: true,
    })
  })

  it('API ključ z projects:read vidi SAMO projekte (stranke/material fail-closed)', () => {
    const v = searchVisibilityFor(apiKeyWithScopes(['projects:read']))
    expect(v).toEqual({ projects: true, customers: false, inventory: false })
  })

  it('API ključ brez scope-a ne vidi NIČESA (fail-closed)', () => {
    const v = searchVisibilityFor(apiKeyWithScopes([]))
    expect(v).toEqual({ projects: false, customers: false, inventory: false })
  })

  it('API ključ s photot scope-om (napačen scope) ne vidi NIČESA', () => {
    const v = searchVisibilityFor(apiKeyWithScopes(['photos:read', 'photos:write']))
    expect(v).toEqual({ projects: false, customers: false, inventory: false })
  })
})

describe('escapeLikePattern (deterministično dobesedno ujemanje)', () => {
  it('escapa % kot literal', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%')
  })

  it('escapa _ kot literal', () => {
    expect(escapeLikePattern('inox_m8')).toBe('inox\\_m8')
  })

  it('escapa backslash', () => {
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b')
  })

  it('pušča običajno besedilo nedotaknjeno', () => {
    expect(escapeLikePattern('Inox Vijak M12')).toBe('Inox Vijak M12')
  })

  it('prazen niz ostane prazen', () => {
    expect(escapeLikePattern('')).toBe('')
  })

  it('kombinacija vseh posebnih znakov', () => {
    expect(escapeLikePattern('%_\\')).toBe('\\%\\_\\\\')
  })
})
