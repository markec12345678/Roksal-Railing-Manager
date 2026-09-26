// R185 — čisto jedro izvoza telemetrije omejevanja hitrosti (vzorec
// posodobitev-jedro / osvezitev-fokus: izračunsko jedro je client-safe in
// 100 % testabilno; komponenta je samo žičenje — rate-limit-panel.tsx).
// ---------------------------------------------------------------------------
// Motiv: ADMIN vidi telemetrijo blokad samo na zaslonu (Ekipa kartica). Za
// arhiv / poročilo / obdobje večjih napadov pride prav MAŠINETNO BERLJIV
// izvoz (CSV). Izvoz je PONUDBA TRENUTNEGA stanja (isto polje kot panel):
// brez dodatnega API klica, brez strežniške obdelave — ista podatkovna oblika,
// samo drug izris.
//
// Načela:
//  • Determinizem: čista funkcija nad izrecnimi vhodi — brez Date.now(), brez
//    DOM; vrstni red vrstic = vrstni red vhoda (API je že deterministično
//    urejen: count ↓, lastAt ↓, keyHash ↑ — R184).
//  • Fail-closed: pokvarjen vhod → TypeError (nikoli tihega izvoza polpdatk).
//  • PII: odtisi so že v API redakcija (SHA-256, 10 hex, R184) — jedro to
//    UNESCO obliko samo prenese; surov ključ (IP/e-naslov) ne sme priti do
//    izvoza, zato je dolžina odtisa preverjena (10 hex).
//  • Excel (sl-SI): ločilo ';' + BOM na začetku (UTF-8 prepoznava).
//  • Zadnja blokada je ISO 8601 (mašinetno berljivo; UI izris je del panela,
//    ne izvoza).

/** Vrstica blokade — ISTA oblika kot /api/security/rate-limit trips[]. */
export interface TripVrstica {
  kind: string
  keyHash: string
  count: number
  lastAt: number
}

/** Vnos = izsek odgovora /api/security/rate-limit (R184 oblika). */
export interface TelemetrijaVnos {
  stats: { keys: number; hits: number }
  tripsTotal: number
  trips: TripVrstica[]
}

const ODTIS_RE = /^[0-9a-f]{10}$/

/** Ena CSV vrstica: polja z ';', '"' ali novo vrstico se ovijejo v navedke
 *  (navedek v polju → dvojni navedek — RFC 4180). Deterministično. */
function csvPolje(vrednost: string): string {
  if (/[;"\r\n]/.test(vrednost)) {
    return `"${vrednost.replace(/"/g, '""')}"`
  }
  return vrednost
}

/** Niz vrstic CSV tabele (brez BOM): glava + vrstice v vrstnem redu vhoda. */
export function telemetrijaCsvVrstice(vnos: TelemetrijaVnos): string[] {
  if (!vnos || typeof vnos !== 'object') {
    throw new TypeError('telemetrijaCsvVrstice: pričakovan vnos (TelemetrijaVnos)')
  }
  const { stats, tripsTotal, trips } = vnos
  if (!stats || typeof stats !== 'object' || typeof stats.keys !== 'number' || !Number.isFinite(stats.keys) || typeof stats.hits !== 'number' || !Number.isFinite(stats.hits)) {
    throw new TypeError('telemetrijaCsvVrstice: pričakovani stats.keys in stats.hits (končni števili)')
  }
  if (typeof tripsTotal !== 'number' || !Number.isFinite(tripsTotal)) {
    throw new TypeError(`telemetrijaCsvVrstice: pričakovan končen tripsTotal, ne ${String(tripsTotal)}`)
  }
  if (!Array.isArray(trips)) {
    throw new TypeError('telemetrijaCsvVrstice: pričakovan trips (polje)')
  }
  for (const t of trips) {
    if (!t || typeof t !== 'object') {
      throw new TypeError('telemetrijaCsvVrstice: pričakovana vrstica blokade (TripVrstica)')
    }
    if (typeof t.kind !== 'string' || t.kind === '') {
      throw new TypeError(`telemetrijaCsvVrstice: pričakovan kind (ne-prazen string), ne ${String(t.kind)}`)
    }
    if (typeof t.keyHash !== 'string' || !ODTIS_RE.test(t.keyHash)) {
      throw new TypeError(`telemetrijaCsvVrstice: pričakovan keyHash (10-hex odtis, redakcija R184), ne ${String(t.keyHash)}`)
    }
    if (typeof t.count !== 'number' || !Number.isInteger(t.count) || t.count < 1) {
      throw new TypeError(`telemetrijaCsvVrstice: pričakovan count (pozitivno celo število), ne ${String(t.count)}`)
    }
    if (typeof t.lastAt !== 'number' || !Number.isFinite(t.lastAt) || t.lastAt < 0) {
      throw new TypeError(`telemetrijaCsvVrstice: pričakovan lastAt (ne-negativen ms), ne ${String(t.lastAt)}`)
    }
  }
  const glava = 'kategorija;odtis;blokad;zadnja_blokada'
  const vrstice = trips.map((t) =>
    [csvPolje(t.kind), t.keyHash, String(t.count), new Date(t.lastAt).toISOString()].join(';'),
  )
  return [glava, ...vrstice]
}

/** Celoten CSV niz: BOM + vrstice. Prazno polje tripov → SAMO glava
 *  (veljaven CSV — pošten izvoz mirnega obdobja, nič lažnih vrstic). */
export function telemetrijaCsv(vnos: TelemetrijaVnos): string {
  return '\uFEFF' + telemetrijaCsvVrstice(vnos).join('\r\n')
}

/** 'telemetrija-omejitve-20260926-191552.csv' — deterministično iz vhoda,
 *  UTC deli (izpisana je stavna ura izvoza, dokumentirano UTC; pečat
 *  'Osveženo ob' v UI ostane v uporabnikovi uri — izvoz je datoteka za
 *  arhiv, kjer je enoznačnost pomembnejša od lokalne ure). */
export function izvozImeDatoteke(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError(`izvozImeDatoteke: pričakovan veljaven datum: Date, ne ${String(now)}`)
  }
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const y = now.getUTCFullYear()
  const m = pad2(now.getUTCMonth() + 1)
  const d = pad2(now.getUTCDate())
  const hh = pad2(now.getUTCHours())
  const mm = pad2(now.getUTCMinutes())
  const ss = pad2(now.getUTCSeconds())
  return `telemetrija-omejitve-${y}${m}${d}-${hh}${mm}${ss}.csv`
}
