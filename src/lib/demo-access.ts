// Roksal — centralna politika demo dostopa (R127 — issue #5 §1)
// ---------------------------------------------------------------------------
// Issue #5 §1 zahteva: "demo route production privzeto OFF; demo uporabnik
// nikoli ni production ADMIN; credentials niso v source/README; test, da
// demo endpoint ne omogoči privileged access."
//
// Ta modul je EDAINA avtoriteta za obe odločitvi:
//   1. ALI je demo dostop vklopljen (env: DEMO_ACCESS + okolje),
//   2. KAKOŠNO vlogo ima demo profil (nikoli privilegirana).
//
// Vse rute/seme/testi berejo od tod — noben ne sme imeti lastne kopije
// pravil (doslej je demo ruta poznala geslo, seed pa ga je vsak deploy
// znova vpisoval kot ADMIN — to je R127 zaprl).

/**
 * Demo profil je NIKOLI ADMIN/VODJA.
 *
 * MONTER je najmanj privilegirana realna vloga (matrika v access.ts):
 * vidi SAMO svoje projekte (`projectWhereForPrincipal`), ne vidi računov,
 * naročil, zalog ali cen (denyUnlessManager), ne sme brisati/zakleniti
 * ničesar. Za javni "vstop brez prijave" je to točno prava mera: app se
 * vidi, poslovni podatki pa ne.
 */
export const DEMO_ROLE = 'MONTER' as const

/** E-mail demo profila (javno znan po zasnovi — ni skrivnost, gesla pa ne gre z njim). */
export const DEMO_EMAIL = 'demo@roksal.si'
export const DEMO_NAME = 'Demo Uporabnik'

export type DemoAccessReason =
  | 'explicit-off' // DEMO_ACCESS=off — lastnik je izklopil povsod
  | 'explicit-on' // DEMO_ACCESS=on — lastnik je namenoma vklopil (tudi produkcija)
  | 'default-dev' // brez env vrednosti, razvojno okolje → vklopljeno
  | 'default-production-off' // brez env vrednosti, produkcija → IZKLOPLJENO (fail-closed)
  | 'unknown-value-off' // neznana vrednost env → IZKLOPLJENO (fail-closed)

export interface DemoAccessState {
  enabled: boolean
  reason: DemoAccessReason
  /** true, če teče v produkcijskem okolju (Vercel produkcija ali NODE_ENV=production). */
  production: boolean
}

/**
 * Produkcija = Vercel produkcija (`VERCEL_ENV=production`) ALI lokalno
 * `NODE_ENV=production` (npr. `bun run start`). Fail-closed: ob dvomu je
 * produkcija.
 */
export function isProductionEnv(
  env: Partial<Pick<NodeJS.ProcessEnv, 'VERCEL_ENV' | 'NODE_ENV'>> = process.env,
): boolean {
  return env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production'
}

/**
 * Politika demo dostopa:
 *
 * | DEMO_ACCESS | okolje    | rezultat |
 * |-------------|-----------|----------|
 * | `off`       | katerokoli | IZKLOPLJENO (explicit-off) |
 * | `on`        | katerokoli | VKLOPLJENO (explicit-on) |
 * | neznano     | katerokoli | IZKLOPLJENO (unknown-value-off — fail-closed) |
 * | prazno/ni   | produkcija | IZKLOPLJENO (default-production-off) |
 * | prazno/ni   | razvoj     | VKLOPLJENO (default-dev) |
 *
 * Demo je torej na produkciji privzeto OFF (zahteva #5 §1); lastnik ga lahko
 * namenoma vklopi z `DEMO_ACCESS=on` v Vercel env — tudi takrat pa demo
 * profil ostane MONTER (nikoli ADMIN).
 */
export function demoAccessState(
  env: Partial<Pick<NodeJS.ProcessEnv, 'DEMO_ACCESS' | 'VERCEL_ENV' | 'NODE_ENV'>> = process.env,
): DemoAccessState {
  const production = isProductionEnv(env)
  const value = env.DEMO_ACCESS

  if (value === 'on') return { enabled: true, reason: 'explicit-on', production }
  if (value === 'off') return { enabled: false, reason: 'explicit-off', production }
  if (value === undefined || value === '') {
    return production
      ? { enabled: false, reason: 'default-production-off', production }
      : { enabled: true, reason: 'default-dev', production }
  }
  return { enabled: false, reason: 'unknown-value-off', production }
}

/**
 * Naključno geslo za demo profil (hashira se, vrednost se NE prikaže in NE
 * beleži). Namen: demo račun je dosegljiv IZKLJUČNO prek demo rute ("vstop
 * brez prijave") — prijava prek /login forme z demo e-pošto ne deluje, ker
 * gesla nihče ne pozna (vsak demo vstop ga zrotira na novo).
 *
 * Tako izpolnimo zahtevo "credentials niso v source/README": v repozitoriju
 * NE obstaja nobeno demo geslo (stari javni skrivnosti je R127 uničil —
 * migracija nastavi passwordHash NULL, CI pa ima secret scan).
 */
export function randomDemoPassword(): string {
  return `${crypto.randomUUID()}.${crypto.randomUUID()}.${crypto.randomUUID()}`
}
