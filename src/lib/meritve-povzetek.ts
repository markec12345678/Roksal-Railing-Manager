// ---------------------------------------------------------------------------
// R203 — povzetek meritev za odložišče (delitev SMS/WhatsApp) — vzorec
// buildTerminShareText (R167): čisto client-safe jedro, fail-closed,
// deterministično (referenčni trenutek pride KOT parameter).
// ---------------------------------------------------------------------------
// Motiv: meritve so terenski nabor podatkov — monter jih deli s pisarno ali
// dobaviteljem kar prek telefona (WhatsApp/SMS). CSV izvoz (R186) je za
// Excel/arhiv; povzetek je HITRA človeška oblika. Povzetek = PONUDBA VIDNIH
// meritev (isti seznam, ki ga komponenta prikaže — IZVOŽENO = ZASLON v duhu
// R171/R186).
//
// Načela:
//  • EN VIR RESNICE z meritve-csv (R186): ISTA vmesnica MeritevZaIzvoz in
//    ISTA validacija/fallbacki — vsaka vrstica povzetka nastane prek
//    meritevVrstica (isti fail-closed pregled: ne-negativna končna mm,
//    veljaven ISO datum, ne-prazen id). Povzetek ne more divergirati od
//    izvoza: kar gre v CSV, gre enako v besedilo.
//  • Determinizem: `now` pride KOT parameter — jedro ne bere ure; mere so
//    kanonične (mm); časovni žig = sl-SI Intl z izrecnimi opcijami (isti
//    vzorec kot terminCasLabel R167 — človeška oblika, ne arhiv).
//  • Fail-closed: pokvaren vnos → TypeError (NIKOLI tihega izmišljenega
//    besedila — mere so FIZIKALNE vrednosti; polpdatki ne grejo naprej).
//  • Brez izmišljenih podatkov: manjkajoča oznaka/lokacija/opomba → vrstica
//    brez njih (nikoli 'n/a', nikoli ugibanje); status ≤ privzeti OSNUTEK
//    je impliciten (pošteno izpuščen, ne skrit — tudi CSV ga zapiše tako).

import { meritevVrstica, type MeritevZaIzvoz } from '@/lib/meritve-csv'

/** Možnosti povzetka — projektIme je natančno to, kar pokaže UI (ali null,
 *  če imena ni — NIKOLI izmišljenega imena). */
export interface MeritvePovzetekOptions {
  projektIme?: string | null
  /** Referenčni trenutek za časovni žig 'osveženo …' — KOT PARAMETER
   *  (determinizem, vzorec termini-prikaz/meritve-csv). */
  now: Date
}

/** Slovenska sklanjatev besede 'meritev' za števec (1 meritev, 2 meritvi,
 *  3/4 meritve, 5+ meritev) — isti vzorec sklanjatev kot ponudbeLabel
 *  (R161)/projektiLabel (R164). */
export function meritvePovzetekBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`meritvePovzetekBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`)
  }
  if (n === 1) return 'meritev'
  if (n === 2) return 'meritvi'
  if (n === 3 || n === 4) return 'meritve'
  return 'meritev'
}

/** Časovni žig '27. 09. 2026 ob 14:05' — sl-SI Intl z izrecnimi opcijami
 *  (isti vzorec kot terminCasLabel R167). Pokvaren now → TypeError. */
export function meritvePovzetekCasOznaka(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('meritvePovzetekCasOznaka: pričakovan veljaven now: Date')
  }
  const datum = now.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const ura = now.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  return `${datum} ob ${ura}`
}

/** Besedilni povzetek VIDNIH meritev za odložišče (SMS/WhatsApp).
 *
 *  Struktura:
 *    Meritve — {projektIme | 'Brez imena projekta'}
 *    {n} {meritev/meritvi/meritve} · osveženo {datum} ob {ura}
 *
 *    1. {oznaka | tip}: {dolzina}×{visina} mm[ · kot {kot}°][ · {status}]
 *       [ · {lokacija}][ — {opomba}]
 *    …
 *
 *  Fail-closed: pokvaren vnos vrže TypeError (prek meritevVrstica — EN
 *  VIR RESNICE z izvozom). Prazen seznam je VELJAVEN (iskren 'Ni meritev.'). */
export function buildMeritvePovzetek(
  meritve: readonly MeritevZaIzvoz[],
  options: MeritvePovzetekOptions
): string {
  if (!Array.isArray(meritve)) {
    throw new TypeError('buildMeritvePovzetek: pričakovano polje meritev (MeritevZaIzvoz[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildMeritvePovzetek: pričakovane opcije (MeritvePovzetekOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildMeritvePovzetek: pričakovan veljaven now: Date')
  }
  // Izmišljenih imen NI: prazno/odsotno ime → 'Brez imena projekta' (isto
  // pošteno vedenje kot UI fallback 'Brez imena projekta' pri terminih).
  const ime =
    typeof options.projektIme === 'string' && options.projektIme.trim() !== ''
      ? options.projektIme.trim()
      : 'Brez imena projekta'

  const vrstice: string[] = []
  vrstice.push(`Meritve — ${ime}`)
  vrstice.push(
    `${meritve.length} ${meritvePovzetekBeseda(meritve.length)} · osveženo ${meritvePovzetekCasOznaka(now)}`
  )
  vrstice.push('')

  if (meritve.length === 0) {
    vrstice.push('Ni meritev.')
    return vrstice.join('\n')
  }

  meritve.forEach((m, i) => {
    // EN VIR RESNICE: validacija + fallbacki (tip 'RAZDALJA', status
    // 'OSNUTEK') nastopita ENKRAT — v meritevVrstica (meritve-csv R186).
    const vrstica = meritevVrstica(m)
    const oznaka = vrstica[1]
    const tip = vrstica[2]
    const dolzina = vrstica[3]
    const visina = vrstica[4]
    const kot = vrstica[5]
    const status = vrstica[16]
    const lokacija = vrstica[17]
    const opomba = vrstica[18]

    const deli: string[] = []
    deli.push(`${oznaka !== '' ? oznaka : tip}: ${dolzina}×${visina} mm`)
    if (kot !== '') deli.push(`kot ${kot}°`)
    // Privzeti status OSNUTEK je impliciten (pošteno izpuščen); vsak drugi
    // status se POKAŽE — deljenje ne sme prikriti npr. POTRJENO/ZAVRŽENO.
    if (status !== 'OSNUTEK') deli.push(status)
    if (lokacija !== '') deli.push(lokacija)
    let vrsta = `${i + 1}. ${deli.join(' · ')}`
    if (opomba !== '') vrsta += ` — ${opomba}`
    vrstice.push(vrsta)
  })

  return vrstice.join('\n')
}
