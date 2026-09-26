// R179 — čisto jedro odločbe "na voljo je nova verzija" (vzorec osvezitev-fokus:
// izračunsko jedro je client-safe in 100 % testabilno; komponenta je samo
// žičenje — update-banner.tsx).
// ---------------------------------------------------------------------------
// Motiv: montirer/pisarna ima app odprt VES DAN (PWA/long-lived tab). API
// branja so network-only (§5 — podatki so vedno sveži), a UI koda ostane
// zastarel do remonta taba. Po vsakem deployu (/api/version vrne NOV build
// žig) zastarel tab prejme diskreten banner z gumbom Osveži.
//
// Načela:
//  • Fail-closed: neznana stran (null ali prazen niz) → false — banner ostane
//    SKRIT. Nikoli lažnega "nova verzija" zaradi nastavitvene napake.
//  • Determinizem: čista funkcija nad izrecnimi vhodi — brez skrite
//    Date.now() odvisnosti, brez DOM.

export interface VerzijaVnos {
  /** Build žig TEKUČE tab-seje (vgrajen ob gradnji; null = neznan). */
  mojZig: string | null
  /** Build žig TRENUTNEGA deploya (/api/version; null = neznan). */
  streznikovZig: string | null
}

/** true, če je strežnikov deploy NOVEJŠI od tabovega žiga (različna niza).
 *  Neznana/prazna stran → false (fail-closed: ne znanemo uporabnika brez
 *  razloga; nastavitvena napaka NE sme sprožiti bannerja). */
export function aliJeNovaVerzijaNaVoljo(vnos: VerzijaVnos): boolean {
  if (!vnos || typeof vnos !== 'object') {
    throw new TypeError('aliJeNovaVerzijaNaVoljo: pričakovan vnos (VerzijaVnos)')
  }
  const { mojZig, streznikovZig } = vnos
  for (const [ime, vrednost] of [
    ['mojZig', mojZig],
    ['streznikovZig', streznikovZig],
  ] as const) {
    if (vrednost !== null && typeof vrednost !== 'string') {
      throw new TypeError(`aliJeNovaVerzijaNaVoljo: pričakovan ${ime}: string ali null, ne ${String(vrednost)}`)
    }
  }
  // Prazan niz = pokvarjen žig (nastavitvena napaka) — obravnavaj kot neznan.
  if (mojZig === null || mojZig === '' || streznikovZig === null || streznikovZig === '') {
    return false
  }
  return mojZig !== streznikovZig
}
