// Roksal — avtorizacija globalnega iskanja (issue #5 §21, R138)
// ---------------------------------------------------------------------------
// BUG (najden s produkcijo QA R138): /api/search je za VSAKEGA prijavljenega
// uporabnika vračal zadetke po VSEH strankah in VSEH projektih — tudi MONTER
// z 0 projekti je prek iskanja ("ja") videl tuje projekte + imena strank.
// /api/projects pravilno filtrira (projectWhereForPrincipal), iskanje pa je
// obšlo avtorizacijo. To je bila luknja: iskanje ne sme biti obvoz
// dovoljenj (§21).
//
// Matrika vidnosti sekcij iskanja (usklajeno z MATRIKA PRINCIPALOV v
// src/lib/access.ts + katalogom scope-ov v src/lib/api-keys.ts):
//
//   | Principal            | Projekti                    | Stranke | Material |
//   |----------------------|-----------------------------|---------|----------|
//   | ADMIN/VODJA (seja)   | vse                         | da      | da       |
//   | MONTER (seja)        | SAMO svoje (monter/vodja)   | da      | da       |
//   | SKLADISCE (seja)     | vse (material kontekst)     | da      | da       |
//   | API ključ + projects:read | where (projectScope/ali vse) | NE | NE     |
//   | API ključ brez scope-a    | NE                     | NE      | NE       |
//
// Stranke/material za API ključ: v katalogu scope-ov NE obstajata
// customers:read / inventory:read — fail-closed, sekcija skrita. (GET
// /api/customers za API ključe je ločeno vprašanje — sledi v naslednjih
// rundah; tu prižgemo vsaj NOVO površino pravilno.)

import type { AuthContext } from '@/lib/auth'
import { hasApiKeyScope } from '@/lib/api-keys'
import type { Prisma } from '@prisma/client'
import { projectWhereForPrincipal } from '@/lib/access'

/** Katere sekcije globalnega iskanja sme ta principal videti. */
export interface SearchVisibility {
  /** Zadetki po projektih (where določa projectWhereForPrincipal). */
  projects: boolean
  /** Zadetki po strankah (ime, naslov). */
  customers: boolean
  /** Zadetki po zalogi (naziv, šifra materiala). */
  inventory: boolean
}

export function searchVisibilityFor(principal: AuthContext): SearchVisibility {
  // API ključ: vidnost projekta zahteva izrecen scope projects:read.
  if (principal.kind === 'apikey') {
    const projects = hasApiKeyScope(principal, 'projects:read')
    return { projects, customers: false, inventory: false }
  }
  // Seje: vse vloge smejo iskati stranke in material (matrika: read);
  // vidnost PROJEKTOV pa vedno določa where (MONTER = samo svoji).
  return { projects: true, customers: true, inventory: true }
}

/**
 * Prisma where za iskanje projektov — identičen pristop kot GET /api/projects,
 * tako da iskanje nikoli ne pokaže več kot glavni seznam.
 */
export function projectSearchWhereFor(
  principal: AuthContext
): Prisma.ProjectWhereInput {
  return projectWhereForPrincipal(principal)
}

/**
 * Escapa LIKE nadomestne znake (% _ \) v uporabniškem vnosu za Prisma
 * `contains` — preprečuje, da bi `%`/`_` delovala kot wildcard namesto
 * dobesednih znakov (deterministično vedenje, enako prejšnjemu JS
 * `.includes()`).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}
