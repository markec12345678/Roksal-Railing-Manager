// Test pomožnik — registriran sejni žeton za integracijske teste (issue #5 §2).
// ---------------------------------------------------------------------------
// authenticate() zahteva ŽIVO UserSession vrstico, zato testi, ki kličejo
// rute direktno (brez HTTP strežnika), ne morejo več samo podpisati žetona
// z signSession — najprej morajo ustvariti Profile + UserSession vrstico.
// Ta helper to zapakira.

import { db } from '@/lib/db'
import { createUserSession } from '@/lib/session-registry'

export interface TestUser {
  id: string
  email: string
  ime: string
  vloga: string
}

/** Ustvari testni profil. Če profil s tem id-jem že obstaja (vzporedni suite-i), ga uporabi. */
export async function upsertTestProfile(id: string, vloga: 'ADMIN' | 'VODJA' | 'MONTER' | 'SKLADISCE' = 'MONTER'): Promise<TestUser> {
  const profile = await db.profile.upsert({
    where: { id },
    update: {},
    create: { id, email: `${id}@test.si`, ime: `Test ${id}`, vloga },
  })
  return { id: profile.id, email: profile.email, ime: profile.ime, vloga: profile.vloga }
}

/** Izda registriran (preklicljiv) žeton za testnega uporabnika. */
export async function createTestSessionToken(user: TestUser): Promise<string> {
  const issued = await createUserSession(user, new Request('http://localhost/vitest', { headers: { 'user-agent': 'vitest' } }))
  return issued.token
}

/** Kombinirano: upsert profila + registriran žeton. */
export async function createTestUserWithSession(
  id: string,
  vloga: 'ADMIN' | 'VODJA' | 'MONTER' | 'SKLADISCE' = 'MONTER',
): Promise<{ user: TestUser; token: string }> {
  const user = await upsertTestProfile(id, vloga)
  const token = await createTestSessionToken(user)
  return { user, token }
}
