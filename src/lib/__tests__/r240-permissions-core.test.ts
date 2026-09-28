// R240 — permissions-core: čisto jedro matrike dovoljenj (client-safe split)
// ---------------------------------------------------------------------------
// Zakaj: permissions.ts je value-importal auth.ts (next/server) — matrika je
// bila SAMO strežniško varna. R240 dobi klienta "Moja vloga in dovoljenja",
// ki rabi katalog + vloga→dovoljenja preslikavo V BRSKALNIKU. Ločitev = ISTI
// vzorec kot csrf-core/csrf (R194). Ta test zaklene:
//   • pariteto re-eksportov (permissions.ts je še naprej EDINI vhod —
//     noben obstoječi uvoz se ne sme razlikovati);
//   • client-safety fence (jedro NIČ value-importov iz strežniških modulov);
//   • fail-closed semantiko (neznana vloga = prazen seznam);
//   • pariteto isManagerRole ↔ status-options (MANAGER_ROLES mirror).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_PERMISSIONS,
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
  describePermission,
  isManagerRole,
  manjkajocaDovoljenja,
  permissionsForRole,
} from '@/lib/permissions-core'
import {
  ALL_PERMISSIONS as ALL_VIA_SERVER,
  PERMISSION_CATALOG as CATALOG_VIA_SERVER,
  describePermission as describeViaServer,
  isManagerRole as isManagerViaServer,
  manjkajocaDovoljenja as manjkajocaViaServer,
  permissionsForRole as forRoleViaServer,
  permissionsForPrincipal,
  hasPermission,
  missingPermissions,
} from '@/lib/permissions'

const beri = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('R240 — permissions-core: fail-closed matrika (EN VIR z permissions.ts)', () => {
  it('katalog je popoln: vsak Permission iz tipa ima label+opis, ALL_PERMISSIONS = ključi', () => {
    // 26 §10 spec + 2 r135 dodatka = 28 (zapisano tudi v README vrstici matrike).
    expect(ALL_PERMISSIONS.length).toBe(28)
    for (const p of ALL_PERMISSIONS) {
      const vnos = PERMISSION_CATALOG[p]
      expect(vnos, `katalog manjka za ${p}`).toBeDefined()
      expect(vnos.label.length).toBeGreaterThan(0)
      expect(vnos.opis.length).toBeGreaterThan(0)
      expect(typeof vnos.spec).toBe('boolean')
    }
    expect(Object.keys(PERMISSION_CATALOG).length).toBe(ALL_PERMISSIONS.length)
  })

  it('vloga→dovoljenja: ADMIN vse, VODJA brez users.manage, MONTER 11, SKLADISCE 7', () => {
    expect(permissionsForRole('ADMIN')).toEqual(ALL_PERMISSIONS)
    const vodja = permissionsForRole('VODJA')
    expect(vodja.length).toBe(ALL_PERMISSIONS.length - 1)
    expect(vodja).not.toContain('users.manage')
    expect(permissionsForRole('MONTER').length).toBe(11)
    expect(permissionsForRole('SKLADISCE').length).toBe(7)
    // Fail-closed: neznana vloga = PRAZEN seznam (least privilege, nikoli vse).
    expect(permissionsForRole('NEZNANA')).toEqual([])
    expect(permissionsForRole('')).toEqual([])
    expect(permissionsForRole('apikey')).toEqual([])
  })

  it('describePermission: kataloška labela, neznano → surovi ključ (fail-verbose)', () => {
    expect(describePermission('projects.write')).toBe('Pisanje projektov')
    expect(describePermission('users.manage')).toBe('Upravljanje uporabnikov')
    // Zaklep: katalog je totipen, a funkcija mora preživeti tuji niz iz seje.
    expect(describePermission('neznano.dovoljenje' as never)).toBe('neznano.dovoljenje')
  })

  it('isManagerRole pariteta z status-options mirrorjem (ADMIN/VODJA = vodstvo)', () => {
    for (const vloga of ['ADMIN', 'VODJA', 'MONTER', 'SKLADISCE', 'NEZNANA', '']) {
      // Vrednosti se ujemajo; samo undefined/null razliko ima status-options
      // (njegova podpis sprejema null — jedro vzame string, tako kot auth).
      expect(isManagerRole(vloga), `vloga ${vloga}`).toBe(
        vloga === 'ADMIN' || vloga === 'VODJA'
      )
    }
  })

  it('manjkajocaDovoljenja: katalog − owned; neznani nizi v owned NE štejejo', () => {
    expect(manjkajocaDovoljenja(permissionsForRole('ADMIN'))).toEqual([])
    expect(manjkajocaDovoljenja([])).toEqual(ALL_PERMISSIONS)
    const monter = permissionsForRole('MONTER')
    const manjka = manjkajocaDovoljenja(monter)
    expect(manjka.length).toBe(ALL_PERMISSIONS.length - monter.length)
    expect(manjka).toContain('users.manage')
    // Fail-closed: pokvaren/izmišljen niz v owned ne zapolni nobenega dovoljenja.
    expect(manjkajocaDovoljenja(['popraven.zapis', 'ADMIN', 42 as never]).length).toBe(
      ALL_PERMISSIONS.length
    )
    // Determinističen vrstni red = vrstni red kataloga.
    expect(manjka).toEqual(ALL_PERMISSIONS.filter((p) => !monter.includes(p)))
  })

  it('frozen: katalog/matrike niso mutable (tiha inflacija dovoljenj nemogoča)', () => {
    expect(Object.isFrozen(ALL_PERMISSIONS)).toBe(true)
    expect(Object.isFrozen(PERMISSION_CATALOG)).toBe(true)
    expect(Object.isFrozen(ROLE_PERMISSIONS)).toBe(true)
    for (const seznam of Object.values(ROLE_PERMISSIONS)) {
      expect(Object.isFrozen(seznam)).toBe(true)
    }
  })
})

describe('R240 — permissions.ts pariteta: re-eksporti so ISTI predmeti/funkciji', () => {
  it('strežniški vhod re-eksporta IDENTIČNE definicije iz jedra (ni kopij)', () => {
    expect(ALL_VIA_SERVER).toBe(ALL_PERMISSIONS)
    expect(CATALOG_VIA_SERVER).toBe(PERMISSION_CATALOG)
    expect(forRoleViaServer('MONTER')).toBe(permissionsForRole('MONTER'))
    expect(describeViaServer('quotes.create')).toBe(describePermission('quotes.create'))
    expect(isManagerViaServer('VODJA')).toBe(isManagerRole('VODJA'))
    expect(manjkajocaViaServer([])).toEqual(manjkajocaDovoljenja([]))
  })

  it('principal-pomočniki ostanejo v permissions.ts in se obnašajo enako (user seja)', () => {
    const principal = {
      kind: 'user' as const,
      session: {
        sub: 'p1',
        email: 'a@b.si',
        ime: 'A',
        vloga: 'MONTER',
        exp: Math.floor(Date.now() / 1000) + 600,
      },
    }
    const owned = permissionsForPrincipal(principal)
    expect(owned).toEqual(permissionsForRole('MONTER'))
    expect(hasPermission(principal, 'projects.read')).toBe(true)
    expect(hasPermission(principal, 'users.manage')).toBe(false)
    expect(missingPermissions(principal, ALL_PERMISSIONS)).toEqual(
      manjkajocaDovoljenja(owned)
    )
  })
})

describe('R240 — client-safety fence: jedro in strežniški vhod sta varna za brskalnik', () => {
  it('permissions-core.ts NIČ value-importov iz strežniških modulov (auth/db/next)', () => {
    const src = beri('src/lib/permissions-core.ts')
    // Jedro ne sme uvažati NIČESA — niti type (dokumentirano samozadostno).
    expect(src).not.toMatch(/from '\.\/auth'/)
    expect(src).not.toMatch(/from '\.\/db'/)
    expect(src).not.toMatch(/from 'next\/server'/)
    expect(src).not.toMatch(/from '\.\/api-keys'/)
    // ...natančneje: jedro ima NIČ import stavkov (samozadostno čisto jedro).
    expect((src.match(/^import\s/m) || []).length).toBe(0)
  })

  it('permissions.ts auth.ts samo KOT TIP (value-import next/server vidi le auth)', () => {
    const src = beri('src/lib/permissions.ts')
    expect(src).toContain("import type { AuthContext } from './auth'")
    expect(src).not.toMatch(/import \{[^}]*\} from '\.\/auth'/)
    expect(src).toContain("import type { ApiKeyScope } from './api-keys'")
    // Re-eksportna vrstica je prisotna (paritetni pin).
    expect(src).toContain("} from './permissions-core'")
  })

  it('status-options ROLE_CHIP = EN VIR chip-stila (team-tab ga NE definira več)', () => {
    const so = beri('src/lib/status-options.ts')
    expect(so).toContain('export const ROLE_CHIP: Record<string, string> = {')
    expect(so).toContain('bg-roksal-navy/10 text-roksal-ink ring-1 ring-inset ring-roksal-navy/20')
    const team = beri('src/components/roksal/team-tab.tsx')
    expect(team).toContain("from '@/lib/status-options'")
    expect(team).not.toContain('const ROLE_CHIP')
    expect(team).not.toContain('export const ROLE_CHIP')
  })
})
