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
//
// R185 — zigIzpis: banner poleg osnovnega sporočila pokaže TUDI, KDORIKA je
// nov build narejen ('Zgrajeno 26.09.2026 ob 21:15:52 (Europe/Ljubljana)').
// Uporabnik takoj vidi, kako ZASTAREL je njegov tab — 'Zgrajeno 1 min' in
// 'Zgrajeno 3 dni' sta popolnoma različni situaciji. Izpis je determinističen
// (eksplicitni časovni pas — R180 nauček: strežnik riše v UTC, pas mora biti
// izrecen), ura pride iz EN VIR casOznaka (osvezitev-fokus). Pečat družine
// 'Osveženo ob' NI prizadet — to je drugo semantiko (čas gradnje deploya,
// ne zadnje osvežitve podatkov).

import { casOznaka } from '@/lib/osvezitev-fokus'

/** Pas za izris časa gradnje — EKSPPLICITEN (nauček R180: determinističen
 *  izris ne glede na regijo gostitelja). */
const IZPIS_PAS = 'Europe/Ljubljana'

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

/** 'Zgrajeno 26.09.2026 ob 21:15:52 (Europe/Ljubljana)' — izpis časa gradnje
 *  iz ISO build žiga (npr. '2026-09-26T19:15:52.708Z'). Deterministično:
 *  eksplicitni pas IZPIS_PAS, ura iz EN VIR casOznaka. Fail-closed:
 *  ne-string/prazen → TypeError; niz brez veljavnega datuma → TypeError
 *  (nikoli tihega napačnega izpisa). */
export function zigIzpis(zig: string): string {
  if (typeof zig !== 'string' || zig === '') {
    throw new TypeError(`zigIzpis: pričakovan ne-prazen build žig (string), ne ${String(zig)}`)
  }
  const datum = new Date(zig)
  if (Number.isNaN(datum.getTime())) {
    throw new TypeError(`zigIzpis: build žig ni veljaven ISO datum: ${zig}`)
  }
  const deli = new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: IZPIS_PAS,
  }).formatToParts(datum)
  const del = (vrsta: string): string => {
    const najden = deli.find((p) => p.type === vrsta)?.value ?? ''
    if (najden === '') {
      throw new TypeError(`zigIzpis: Intl ni vrnil dela '${vrsta}' za žig ${zig}`)
    }
    return najden
  }
  const dan = del('day')
  const mesec = del('month')
  const leto = del('year')
  const ura = casOznaka(datum, { casovniPas: IZPIS_PAS })
  return `Zgrajeno ${dan}.${mesec}.${leto} ob ${ura} (${IZPIS_PAS})`
}
