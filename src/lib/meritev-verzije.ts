// R276 — Zgodovina verzij meritev (issue #16 §6; register #17-E).
// Čiste deterministične funkcije — brez I/O, brez ura, brez ugibanja.
// Semantične odločitve O1–O9: docs/MEASUREMENT-HISTORY.md (zapisane PRED
// razvojem). Kanon projekta: meritve se NE tiho prepisujejo — korekcija =
// NOVA vrstica v verigi; zgodovina JE množica vrstic (R153), veriga jo
// naredi berljivo (aktivna verzija, delta, vir).

/**
 * Izvor meritve po skupnem kontraktu (issue #16 §2; ar-contract
 * AR_SESSION_SOURCES — ENA resnica, DVA nivoja zaščite: zod enum pri
 * kontraktu + ta enumeracija za izpeljavo `vir` na vrstici).
 * Strežniško IZPELJAN — klient ga ne more podati (ne ponareljiv).
 */
export const MERITEV_VIRI = ['MANUAL', 'PHOTO_CV', 'ARCORE_DEPTH'] as const
export type MeritevVir = (typeof MERITEV_VIRI)[number]

/** Človeku berljive oznake vira (UI + PDF); ključi = žične vrednosti. */
export const MERITEV_VIR_LABELS: Record<MeritevVir, string> = {
  MANUAL: 'Ročni vnos',
  PHOTO_CV: 'Foto-CV',
  ARCORE_DEPTH: 'AR-Depth',
}

/**
 * O3 — naslednja verzija v verigi. Legacy predhodnik (verzija null,
 * nastal pred verzioniranjem) FUNKCIONIRA kot implicitna v1 — korekcija
 * dobi v2 (original je obstajal, oznake pa še ni bilo).
 * Deterministično: nič ugibanja, nič zaokroževanja.
 */
export function izracunajNaslednjoVerzijo(predhodnikVerzija: number | null): number {
  return (predhodnikVerzija ?? 1) + 1
}

/**
 * O3 — koren verige za naslednika: prevzemi predhodnikov koren; če je
 * predhodnik SAM koren (korenId null), je koren predhodnik sam.
 * Koren vrstice (prva v verigi) ima korenId = null (iskreno: ni predhodnika).
 */
export function izracunajKorenIdNaslednika(predhodnik: {
  id: string
  korenId: string | null
}): string {
  return predhodnik.korenId ?? predhodnik.id
}

/**
 * O6 — deterministična delta med verzijama (nova − stora, cela števila mm).
 * Zapis v AuditLog MEASUREMENT_VERSION (newValue) — "kaj se je spremenilo".
 */
export function izracunajDelti(
  stara: { dolzinaMm: number; visinaMm: number },
  nova: { dolzinaMm: number; visinaMm: number },
): { deltaDolzinaMm: number; deltaVisinaMm: number } {
  return {
    deltaDolzinaMm: nova.dolzinaMm - stara.dolzinaMm,
    deltaVisinaMm: nova.visinaMm - stara.visinaMm,
  }
}

/** Ekspliziten znak delte (UI/PDF): +250 / -30 — nič implicitnega '+0'. */
export function formatirajDeltaMm(deltaMm: number): string {
  return deltaMm >= 0 ? `+${deltaMm}` : String(deltaMm)
}

/**
 * O5 — aktivna verzija: vrstica z najvišjo verzijo v verigi, ČE njen status
 * ≠ ARHIVIRANA; sicer NI aktivne verzije (iskrena praznina) — NIKOLI padec
 * nazaj na nižjo verzijo (to bi bilo tiho "prepisanje nazaj").
 * Vrstice z verzijo null (legacy) so NIKOLI aktivna verzija — aktivnost
 * je pojem verzioniranega dela verige.
 *
 * @param veriga vrstice verige (poljuben vrstni red — funkcija sama vzame
 *               najvišjo verzijo; dvojne verzije v verigi so nemogoče po O4)
 */
export function aktivnaVerzijaIzVerige(
  veriga: Array<{ id: string; verzija: number | null; status: string | null }>,
): { id: string; verzija: number } | null {
  let najboljša: { id: string; verzija: number; status: string | null } | null = null
  for (const vrstica of veriga) {
    if (vrstica.verzija === null) continue
    if (najboljša === null || vrstica.verzija > najboljša.verzija) {
      najboljša = { id: vrstica.id, verzija: vrstica.verzija, status: vrstica.status }
    }
  }
  if (najboljša === null) return null
  if (najboljša.status === 'ARHIVIRANA') return null
  return { id: najboljša.id, verzija: najboljša.verzija }
}

/**
 * O7 — IZREČNO iskren zapis odvisnih rezultatov v reviziji. NIKOLI lažni
 * "recalculated: true" (BOM/pricing/geometry core se NE spreminja; dokler
 * lastnik ne sproži ponovnega izračuna, je iskren odgovor "niso").
 */
export const ODVISNI_REZULTATI_OPOMBA =
  'NI PONOVNO IZRAČUNANO — dokumenti/BOM ustvarjeni pred to verzijo ostajajo na predhodni meri; ponovni izračun je zgoda lastnika'
