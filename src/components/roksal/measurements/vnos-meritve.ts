// R356 — MEASUREMENTS FAZA 9: vnos meritve POST orkestracija — kontrolni tok
// treh bratov izluščen VERBATIM iz taba (vzorec FAZA 5/R348 izvoz-csv,
// FAZA 6/R349 teren-vnosi, FAZA 7/R350 pdf-seznam, FAZA 8/R354 teren-izvozi):
//   • stopniščni čarovnik (handleStairCreateMeasurements — batch ×5 vnosi),
//   • WPC palice kot stebri (handleAddWpcPaliceAsStebri — batch ×stPalic),
//   • ročni steber (handleAddSteber — EN vnos)
// vsi trije delijo ISTI per-item tok: POST /api/measurements → uspeh =
// preslikava + prepend; ne-ok ALI omrežna napaka = EKSPLICITEN osnutek
// (R152 — ni fake-success). Prej: 9 podvojenih payload literalov + 9× gps
// literal {46.2397, 14.3556} + 3× isti fetch blok; zdaj EN gradnik.
//
// R358 — MEASUREMENTS FAZA 11: REPOST družina — 3 preostali per-item tokovi
// (iskrena meja FAZA 10, zdaj prevzeta):
//   • sinhronizacija osnutka (syncSingleDraft — re-pošlje draft.payload VERBATIM,
//     kontrakt R152: "Točno telo, ki ga je treba ponovno POSTati"),
//   • podvojenost obstoječe meritve (handleDuplicateMeasurement),
//   • kopiranje v segment (handleBulkCopyToSegment — batch po izbranih).
// Skupni per-item tok je ISTI kot FAZA 9, a telo GRADI KLICATELJ (re-post
// obstoječih podatkov — NIČ novih teles, NIČ vsiljenih vrednosti): RepostTelo
// nosi NULLABLE arMetadata/gpsLokacija (vir brez AR/GPS) in gpsLokacija NI
// vsiljena TERENSKA_GPS_TOCKA (no fabricated data — kopija nosi IZVORNO
// GPS točko; stale telo podvojenosti/kopiranja je to 1:1 ohranjalo).
// Podvojenost + kopiranje delita EN builder teloRepostaIzMeritve (prej 2
// podvojena stale literalna telesa — bajtno isti ključni vrstni red
// projectId→dolzinaMm→visinaMm→arMetadata→gpsLokacija).
//
// MEJE (vzorec FAZA 8 — lib/orkestracija NE pozna UI):
//   • orkestracija NE pozna toastov IN NE ustvarja osnutkov — vrača
//     DISKRIMINIRAN REZULTAT; veja 'osnutek' nosi Telo = ISTI payload, kot
//     je bil poslan na POST (komponenta ga posreduje svojemu
//     createMeasurementDraft, ki zapira stanje osnutkov + revizijsko sled —
//     UI resnica ostane v UI; NI dvojnega besedila, NI tihe degradacije);
//   • preslikava odgovora (…data + prikazna polja) ostane pri klicatelju —
//     vsak brat ima SVOJA prikazna polja (stopnišče vs. STEBR), bajtno
//     nespremenjena;
//   • telo POST je ENA definicija (isti ključni vrstni red kot stale
//     literali: projectId, dolzinaMm, visinaMm, arMetadata, gpsLokacija) —
//     JSON.stringify izhod je bajtno identičen.
// ---------------------------------------------------------------------------

import type { ArMetadata } from './format'
import type { Measurement } from './shared'

/** Terenska GPS točka — skupna konstanta treh bratov (prej 9× isti literal
 *  { lat: 46.2397, lng: 14.3556 } v POST telesih in osnutkih). Vrednost je
 *  obstoječa (Kranj terenska točka, R166 izvor) — NIč novih podatkov, samo
 *  ENA definicija. */
export const TERENSKA_GPS_TOCKA = { lat: 46.2397, lng: 14.3556 } as const

/** Telo POST /api/measurements — ENA kopija (prej 3 stale telesa ×3 veje:
 *  POST + osnutek-ne-ok + osnutek-napaka = 9 podvojenih literalov; R357
 *  FAZA 10: od tega rounda še 5 enojnih tokov [vnos forma, nagib, kotomer,
 *  predloga, AR uvoz ×2 zanki] — 15 gps literalov → 0).
 *  predhodnikId (R276 korekcijska veriga) je OPCIJONALEN in — kadar je
 *  prisoten — VEDNO ZADNJI ključ v telesu (bajtno isti vrstni red kot stale
 *  telo korekcije, kjer je bil dodeljen PO konstrukciji literal). */
export type VnosMereTelo = {
  readonly projectId: string
  readonly dolzinaMm: number
  readonly visinaMm: number
  readonly arMetadata: ArMetadata
  readonly gpsLokacija: { readonly lat: number; readonly lng: number }
  readonly predhodnikId?: string
}

/** Zahteva ENEGA vnosa mere — končne vrednosti (klicatelj izračuna
 *  Math.max/round pretvorbe; orkestracija jih NE podvaja). predhodnikId
 *  (R276): korekcija meritve — strežnik ustvari NOVO verzijo v verigi;
 *  osnutek korekcije NOSI predhodnikId v VSEH neuspešnih vejah (R357
 *  popravek: stale catch-veja handleSubmitMeasurement je telo
 *  REKONSTRUIRALA BREZ predhodnikId → sinhronizacija bi ustvarila
 *  standalone namesto verzije — kršitev kontrakta R276, zdaj gradnik
 *  nosi telo VEDNO z istim predhodnikom kot POST). */
export interface VnosMereZahteva {
  readonly projectId: string
  readonly dolzinaMm: number
  readonly visinaMm: number
  readonly arMetadata: ArMetadata
  readonly predhodnikId?: string
}

/** Diskriminiran rezultat — VSE veje VIDNE (R152: neuspeh = EKSPLICITEN
 *  osnutek, ni fake-success). Veja 'osnutek' nosi telo — ISTI payload kot
 *  POST (klicatelj ga posreduje createMeasurementDraft; brez ponovnega
 *  literala, brez nevarnosti razhajanja POST/osnutek telesa).
 *  R358 FAZA 11: telo veje 'osnutek' je RepostTelo (nadtip — VnosMereTelo
 *  je zanj dodeljiv: strogi arMetadata/gpsLokacija so podmnožica nullable). */
export type RezultatVnosaMere =
  | { readonly izid: 'uspeh'; readonly podatki: Measurement }
  | { readonly izid: 'osnutek'; readonly telo: RepostTelo }

/** R358 FAZA 11 — telo REPOSTA: obstoječa meritev/osnutek, poslan VERBATIM.
 *  Razlika od strogega VnosMereTelo (gradnja iz vnosnih polj):
 *    • arMetadata/gpsLokacija NULLABLE (meritev brez AR/GPS vira —
 *      stale telo podvojenosti/kopiranja je pošiljalo null, NIČ izmišljenega);
 *    • gpsLokacija NI vsiljena TERENSKA_GPS_TOCKA (kopija nosi izvorno
 *      točko — no fabricated data);
 *    • predhodnikId OPCIONALEN (osnutek korekcijske verige R276 ga NOSI —
 *      re-post ga ohranja, sinhronizacija ustvari verzijo, ne standalone).
 *  Type alias (ne interface) — implicitni indeksni podpis: RepostTelo je
 *  dodeljiv createMeasurementDraft(payload: Record<string, unknown>). */
export type RepostTelo = {
  readonly projectId: string
  readonly dolzinaMm: number
  readonly visinaMm: number
  readonly arMetadata: ArMetadata | null
  readonly gpsLokacija: { readonly lat: number; readonly lng: number } | null
  readonly predhodnikId?: string
}

/** R358 FAZA 11 — telo reposta IZ obstoječe meritve — ENA definicija (prej
 *  2 podvojena stale literalna telesa: podvojenost + kopiranje v segment —
 *  bajtno isti ključni vrstni red projectId→dolzinaMm→visinaMm→arMetadata→
 *  gpsLokacija; vrednosti iz meritve, null = vir brez AR/GPS — nič
 *  izmišljenega, nič vsiljene terenske točke). */
export function teloRepostaIzMeritve(
  m: Pick<
    Measurement,
    'projectId' | 'dolzinaMm' | 'visinaMm' | 'arMetadata' | 'gpsLokacija'
  >,
  fallbackProjekt: string,
): RepostTelo {
  return {
    projectId: m.projectId || fallbackProjekt,
    dolzinaMm: m.dolzinaMm,
    visinaMm: m.visinaMm,
    arMetadata: m.arMetadata ? (JSON.parse(m.arMetadata) as ArMetadata) : null,
    gpsLokacija: m.gpsLokacija
      ? (JSON.parse(m.gpsLokacija) as { lat: number; lng: number })
      : null,
  }
}

/**
 * R358 FAZA 11 — pošlje REPOST obstoječega telesa na POST /api/measurements
 * in vrne diskriminiran rezultat (ISTI per-item tok kot posljiVnosMere, a
 * telo gradi klicatelj — nič novih teles, nič vsiljenih vrednosti):
 * 'uspeh' z odgovorom strežnika ALI 'osnutek' z ISTIM telom (ne-ok ALI
 * omrežna napaka). Klicatelji: syncSingleDraft (osnutek že OBSTAJA —
 * neuspeh NE ustvari novega, vrne false), podvojenost/kopiranje
 * (osnutek = createMeasurementDraft z ISTIM telesom — R152).
 */
export async function posljiRepostMere(
  telo: RepostTelo,
): Promise<RezultatVnosaMere> {
  try {
    const res = await fetch('/api/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telo),
    })
    if (res.ok) {
      // Odgovor strežnika = ustvarjen DTO; klicatelj razširi s svojimi
      // prikaznimi polja (preslikava pri klicatelju — vzorec FAZA 9/10).
      return { izid: 'uspeh', podatki: (await res.json()) as Measurement }
    }
    return { izid: 'osnutek', telo }
  } catch {
    return { izid: 'osnutek', telo }
  }
}

/**
 * Pošlje EN vnos mere na POST /api/measurements in vrne diskriminiran
 * rezultat: 'uspeh' z odgovorom strežnika ALI 'osnutek' s telom (ne-ok
 * odgovor ALI omrežna napaka — R152: ni fake-success, ampak ekspliciten
 * osnutek pri klicatelju). Napaka se NIKOLI ne pogoltne v lažni uspeh —
 * vedno konča kot 'osnutek' z ISTIM telom, ki ga je videl strežnik.
 */
export async function posljiVnosMere(
  zahteva: VnosMereZahteva,
): Promise<RezultatVnosaMere> {
  const telo: VnosMereTelo = {
    projectId: zahteva.projectId,
    dolzinaMm: zahteva.dolzinaMm,
    visinaMm: zahteva.visinaMm,
    arMetadata: zahteva.arMetadata,
    gpsLokacija: TERENSKA_GPS_TOCKA,
    // R276/R357: predhodnikId ZADNJI ključ (bajtno isti vrstni red kot stale
    // telo korekcije — dodeljen PO konstrukciji); odsoten = ključ NE obstaja
    // (JSON.stringify brez ključa — bajtno identično stale telesom brez
    // korekcije).
    ...(zahteva.predhodnikId ? { predhodnikId: zahteva.predhodnikId } : {}),
  }
  try {
    const res = await fetch('/api/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telo),
    })
    if (res.ok) {
      // Odgovor strežnika = ustvarjen DTO; klicatelj razširi s svojimi
      // prikaznimi polji (bajtno ista preslikava kot stale telesa).
      return { izid: 'uspeh', podatki: (await res.json()) as Measurement }
    }
    return { izid: 'osnutek', telo }
  } catch {
    return { izid: 'osnutek', telo }
  }
}
