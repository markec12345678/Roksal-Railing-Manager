// Roksal — nastavitvena konzola (setup console, R137)
// ---------------------------------------------------------------------------
// PROBLEM (lastnik, R137): na Vercel produkciji ni bilo mogoče pridobiti
// ADMIN računa — registracija daje izključno MONTER, upravljanje uporabnikov
// (/api/users) pa zahteva ADMIN sejo. Če lastnik izgubi geslo ali računa
// sploh ni, je sistem brez pisarniškega dostopa in NIKOMER ni mogoče pomagati
// iz aplikacije same (produkcija baza je dosegljiva izključno prek Vercel env).
//
// REŠITEV: javna `/setup` stran + `POST /api/setup`, zaščitena z žetonom iz
// okolja. Lastnik nastavi DVA env var v Vercel/Render dashboardu:
//   • ROKSAL_SETUP_TOKEN  — dolg naključen žeton (min 16 znakov). Če ni
//     nastavljen (ali je prekratek), je konzola POPOLNOMA IZKLOPLJENA
//     (fail-closed: 404, stran prikaže razlago).
//   • ROKSAL_SETUP_EMAIL  — opcijski ožilje: kadar je nastavljen, sme konzola
//     ustvariti ALI popraviti IZKLJUČNO ta račun. Brez njega sme samo
//     USTVARITI novega uporabnika — obstoječih računov se NIKOLI ne dotakne.
//
// Varnostne lastnosti (vzorec §6–§9):
//   • primerjava žetona v konstantnem času (sha256 + timingSafeEqual);
//   • rate limit 5/uro/IP (šteje TUDI napačne žetone — fail-closed);
//   • vsak zavrnjen poskus → AuditLog SETUP_DENIED z hashiranim IP (brez
//     surovega IP-ja, vzorec §7/§8); uspeh → SETUP_BOOTSTRAP / SETUP_RECOVER;
//   • RECOVER postavi novo geslo, povzdigne vlogo na ADMIN, odpne blokade,
//     počisti povabila in REVOKE-a VSE seje (ukraden žeton ne preživi);
//   • vsi pisi v ENI transakciji (§19);
//   • žeton NIKOLI ni shranjen v repozitoriju ali dnevnikih.

import { createHash, timingSafeEqual } from 'node:crypto'

/** Omejitev poskusov (štejejo tudi napačni žetoni — ugibanje je drago). */
export const SETUP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 } as const

/** Najkrajši sprejemljiv žeton — krajši/nastavljen pomeni IZKLOPLJENO konzolo. */
export const SETUP_TOKEN_MIN_LENGTH = 16

/**
 * Žeton iz okolja ali null (konzola izklopljena). Trim je nameren — lastnik
 * v dashboardu pogosto prilepi vrednost s presledkom; fail-closed pomeni, da
 * praznega/prekratkega NE smatramo kot žetona, temveč kot izklop.
 */
export function setupTokenFromEnv(): string | null {
  const raw = process.env.ROKSAL_SETUP_TOKEN
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length >= SETUP_TOKEN_MIN_LENGTH ? trimmed : null
}

/** Opcijsko ožilje e-pošte (lowercase) ali null. Pokvarjen vnos NE razširi ničesar. */
export function setupEmailFromEnv(): string | null {
  const raw = process.env.ROKSAL_SETUP_EMAIL
  if (!raw) return null
  const trimmed = raw.trim().toLowerCase()
  return trimmed.includes('@') && trimmed.includes('.') ? trimmed : null
}

/** Konstantnočasna primerjava predstavljenega žetona z pričakovanim. */
export function tokenMatches(presented: string | null | undefined, expected: string): boolean {
  if (!presented) return false
  const a = createHash('sha256').update(presented.trim()).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export type SetupMode = 'BOOTSTRAP' | 'RECOVER'

/**
 * Politika dostopa (fail-closed, deterministična):
 *   • račun NE obstaja + (SETUP_EMAIL ni nastavljen ALI se ujema) → BOOTSTRAP;
 *   • račun obstaja  + SETUP_EMAIL se točno ujema                → RECOVER;
 *   • vse ostalo                                                  → null (403).
 * Brez SETUP_EMAIL obstoječih računov NIKOLI ne dotaknemo — žeton ne sme
 * biti mojstrski ključ za prevzem tujih računov, če pa je vendarle potreben
 * (izgubljeno geslo), ga lastnik oži z ROKSAL_SETUP_EMAIL na svoj račun.
 */
export function resolveSetupMode(email: string, exists: boolean): SetupMode | null {
  const scoped = setupEmailFromEnv()
  if (exists) return scoped && scoped === email ? 'RECOVER' : null
  return scoped && scoped !== email ? null : 'BOOTSTRAP'
}
