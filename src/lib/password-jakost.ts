/**
 * R199 — jakost gesla (čista funkcija, brez uvozov — client-safe).
 *
 * Motiv: 'Zamenjaj geslo' dialog (R137) je zahteval 8 znakov, uporabniku pa
 * ni povedal, ALI je izbral dobro geslo. Živa povratna informacija (barvna
 * lestvica) zniža število slabih gesel BREZ vsiljevanja pravil (ostanemo na
 * nasvetu, ne na zapori — izogibamo se agresivnim kompozicijskim pravilom).
 *
 * Določljivo (100% determinizem, testabilno):
 *   • razredi znakov: male/VELIKE/številke/simboli (vse ostalo = simbol);
 *   • ocena 0 — krajše od 8 znakov (neustrezno, gumb je že zaklenjen);
 *   • ocena 1 (Šibko) — ≥ 8 znakov, 1–2 razreda, kratko (< 12);
 *   • ocena 2 (Sprejemljivo) — ≥ 8 znakov, 3 razredi; ALI 2 razreda + dolžina ≥ 12;
 *   • ocena 3 (Močno) — ≥ 8 znakov, 4 razredi; ALI 3 razredi + dolžina ≥ 14;
 *     ALI 2 razreda + dolžina ≥ 18 (dolga gesfraza kljub malo razredom).
 */

export interface GesloJakost {
  /** 0–3 (0 = neustrezno/gumb zaklenjen, 1 šibko, 2 sprejemljivo, 3 močno). */
  ocena: 0 | 1 | 2 | 3
  /** Berljiva oznaka za UI (prazna pri oceni 0 — vrstica se ne prikaže). */
  oznaka: string
}

export function gesloJakost(geslo: string): GesloJakost {
  if (geslo.length < 8) return { ocena: 0, oznaka: '' }
  const razredi =
    (/[a-z]/.test(geslo) ? 1 : 0) +
    (/[A-Z]/.test(geslo) ? 1 : 0) +
    (/[0-9]/.test(geslo) ? 1 : 0) +
    (/[a-zA-Z0-9]/.test(geslo) === false || /[^a-zA-Z0-9]/.test(geslo) ? 1 : 0)
  const dolzina = geslo.length
  if (razredi >= 4 || (razredi >= 3 && dolzina >= 14) || (razredi >= 2 && dolzina >= 18)) {
    return { ocena: 3, oznaka: 'Močno' }
  }
  if (razredi >= 3 || (razredi >= 2 && dolzina >= 12)) {
    return { ocena: 2, oznaka: 'Sprejemljivo' }
  }
  return { ocena: 1, oznaka: 'Šibko' }
}
