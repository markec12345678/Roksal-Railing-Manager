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
 *  POST + osnutek-ne-ok + osnutek-napaka = 9 podvojenih literalov). */
export type VnosMereTelo = {
  readonly projectId: string
  readonly dolzinaMm: number
  readonly visinaMm: number
  readonly arMetadata: ArMetadata
  readonly gpsLokacija: { readonly lat: number; readonly lng: number }
}

/** Zahteva ENEGA vnosa mere — končne vrednosti (klicatelj izračuna
 *  Math.max/round pretvorbe; orkestracija jih NE podvaja). */
export interface VnosMereZahteva {
  readonly projectId: string
  readonly dolzinaMm: number
  readonly visinaMm: number
  readonly arMetadata: ArMetadata
}

/** Diskriminiran rezultat — VSE veje VIDNE (R152: neuspeh = EKSPLICITEN
 *  osnutek, ni fake-success). Veja 'osnutek' nosi telo — ISTI payload kot
 *  POST (klicatelj ga posreduje createMeasurementDraft; brez ponovnega
 *  literala, brez nevarnosti razhajanja POST/osnutek telesa). */
export type RezultatVnosaMere =
  | { readonly izid: 'uspeh'; readonly podatki: Measurement }
  | { readonly izid: 'osnutek'; readonly telo: VnosMereTelo }

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
