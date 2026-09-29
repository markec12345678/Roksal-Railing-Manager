// ---------------------------------------------------------------------------
// R291 — PRIHODKI PO MESECIH CSV (8. člen 'izvozne' družine — i-družina
// vzorec R232/R233/R285/R286). Izvozi TOČNO tisto, kar sekcija 'Prihodki po
// mesecih' (R290) izriše — WYSIWYG po konstrukciji.
//
// EN VIR resnice:
//  • vhod = PrihodkiMeseciPovzetek (ISTI objekt, ki ga sekcija izriše —
//    prihodkiPoMesecih iz prihodki-meseci.ts; lib NE računa znova, ne more
//    divergirati od zaslona);
//  • števila = kolicinaNiz (UVOŽENA iz zaloga-osnutek-pdf — ISTA strojna
//    konvencija kot R286 inventura: celo število brez decimalk, sicer
//    toFixed(2) s piko — strojno berljivo, deterministično);
//  • meta vrstice po podatkih (kanon logistični CSV R172): Obseg + Skupaj
//    plačano (ISTI trikot kot sekcija) + POGOJNI 'V teku' (samo stIzdanih
//    > 0) + POGOJI 'Stornirani' (samo > 0) + 'Izvoženo ob' (kanonični ISO
//    8601 iz `now` — vzorec R286 'Izvoženo' stolpca);
//  • OSNUTKI NE v CSV: sekcija jih NE prikazuje (samo Povzetek boxi zgoraj)
//    — WYSIWYG pomeni: CSV = resnica sekcije, ne resnica celotnega zaslona
//    (izrecno dokumentirano, nič tihega izpuščanja — obseg vrstica to pove).
//
// Načela (družinska pravila):
//  • Fail-closed: ne-objektni povzetek / ne-polje meseci / pokvarjena
//    vrstica → TypeError z indeksom krivca (nikoli tiho spregledano).
//    PRAZEN SEZNAM meseci je VELJAVEN vhod (glava + meta vrstice — iskren
//    dokument brez lažnih 0-vrstic); komponenta pri 0 mesecih NEOBJAVLJA
//    datoteke (fail-closed toast, R250 vzorec 'Ni računov za prihodke').
//  • Determinizem: `now` pride KOT parameter (jedro ne bere ure, F4);
//    vrstice v ISTEM vrstnem redu kot povzetek.meseci (že ASC po
//    konstrukciji prihodkiPoMesecih).
//  • Format: BOM + '\n' zaključki + citiranje besedilnih celic (vzorec
//    vodja-csv / R285 / R286 — vsak lib nosi lasten 3-vrstični citiraj).
// ---------------------------------------------------------------------------

import {
  kolicinaNiz,
} from './zaloga-osnutek-pdf'
import { todayStamp } from './csv-export'
import type { PrihodkiMeseciPovzetek } from './prihodki-meseci'

/** Glava tabele (3 stolpci — ISTI naslovi kot sekcija: mesec · računi · EUR). */
export const PRIHODKI_MESECI_CSV_GLAVA = [
  'Mesec',
  'Plačani računi',
  'Prihodki (EUR)',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec vodja-csv. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** Fail-closed preverba povzetka (obvezna struktura — indeks krivca v
 *  sporočilu za vrstico meseci). */
function preveriPovzetek(p: PrihodkiMeseciPovzetek): void {
  if (!p || typeof p !== 'object') {
    throw new TypeError('prihodkiMeseciCsvVrstice: pričakovan povzetek (PrihodkiMeseciPovzetek)')
  }
  if (!Array.isArray(p.meseci)) {
    throw new TypeError('prihodkiMeseciCsvVrstice: meseci mora biti polje')
  }
  for (let i = 0; i < p.meseci.length; i++) {
    const m = p.meseci[i]
    if (!m || typeof m !== 'object') {
      throw new TypeError(`prihodkiMeseciCsvVrstice: meseci[${i}] mora biti vrstica (objekt)`)
    }
    if (typeof m.mesec !== 'string' || !/^\d{4}-\d{2}$/.test(m.mesec)) {
      throw new TypeError(`prihodkiMeseciCsvVrstice: meseci[${i}].mesec mora biti 'YYYY-MM', ne ${String(m.mesec)}`)
    }
    if (!Number.isInteger(m.stRacunov) || m.stRacunov < 0) {
      throw new TypeError(`prihodkiMeseciCsvVrstice: meseci[${i}].stRacunov mora biti celo število ≥ 0, ne ${String(m.stRacunov)}`)
    }
    if (typeof m.prihodki !== 'number' || !Number.isFinite(m.prihodki) || m.prihodki < 0) {
      throw new TypeError(`prihodkiMeseciCsvVrstice: meseci[${i}].prihodki mora biti končno ne-negativno število, ne ${String(m.prihodki)}`)
    }
  }
  if (!Number.isInteger(p.skupajRacunov) || p.skupajRacunov < 0) {
    throw new TypeError('prihodkiMeseciCsvVrstice: skupajRacunov mora biti celo število ≥ 0')
  }
  if (typeof p.skupajPrihodki !== 'number' || !Number.isFinite(p.skupajPrihodki) || p.skupajPrihodki < 0) {
    throw new TypeError('prihodkiMeseciCsvVrstice: skupajPrihodki mora biti končno ne-negativno število')
  }
  if (!Number.isInteger(p.stIzdanih) || p.stIzdanih < 0) {
    throw new TypeError('prihodkiMeseciCsvVrstice: stIzdanih mora biti celo število ≥ 0')
  }
  if (typeof p.znesekIzdanih !== 'number' || !Number.isFinite(p.znesekIzdanih) || p.znesekIzdanih < 0) {
    throw new TypeError('prihodkiMeseciCsvVrstice: znesekIzdanih mora biti končno ne-negativno število')
  }
  if (!Number.isInteger(p.stOsnutkov) || p.stOsnutkov < 0) {
    throw new TypeError('prihodkiMeseciCsvVrstice: stOsnutkov mora biti celo število ≥ 0')
  }
  if (!Number.isInteger(p.stStorniranih) || p.stStorniranih < 0) {
    throw new TypeError('prihodkiMeseciCsvVrstice: stStorniranih mora biti celo število ≥ 0')
  }
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172). `izvozZig` =
 *  kanonični ISO 8601 žig izvoza (iz `now.toISOString()` na klicni strani). */
export function prihodkiMeseciCsvVrstice(
  povzetek: PrihodkiMeseciPovzetek,
  izvozZig: string,
): string[] {
  if (typeof izvozZig !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(izvozZig)) {
    throw new TypeError('prihodkiMeseciCsvVrstice: izvozZig mora biti kanonični ISO 8601 niz')
  }
  preveriPovzetek(povzetek)
  const vrstice: string[] = [PRIHODKI_MESECI_CSV_GLAVA.map(citiraj).join(',')]
  for (const m of povzetek.meseci) {
    vrstice.push(
      [
        m.mesec,
        String(m.stRacunov),
        kolicinaNiz(m.prihodki),
      ]
        .map(citiraj)
        .join(','),
    )
  }
  // --- meta vrstice (kanon logistični CSV R172) ---
  vrstice.push('')
  vrstice.push(
    ['Obseg', 'Vsi plačani računi po mesecih (iz seznama računov)']
      .map(citiraj)
      .join(','),
  )
  vrstice.push(
    ['Skupaj plačano', String(povzetek.skupajRacunov), kolicinaNiz(povzetek.skupajPrihodki)]
      .map(citiraj)
      .join(','),
  )
  if (povzetek.stIzdanih > 0) {
    vrstice.push(
      ['V teku (izdani, neplačani)', String(povzetek.stIzdanih), kolicinaNiz(povzetek.znesekIzdanih)]
        .map(citiraj)
        .join(','),
    )
  }
  if (povzetek.stStorniranih > 0) {
    vrstice.push(
      ['Stornirani (izključeni iz zneskov)', String(povzetek.stStorniranih), '']
        .map(citiraj)
        .join(','),
    )
  }
  vrstice.push(
    ['Izvoženo ob', izvozZig]
      .map(citiraj)
      .join(','),
  )
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286). */
export function prihodkiMeseciCsv(
  povzetek: PrihodkiMeseciPovzetek,
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('prihodkiMeseciCsv: pričakovan veljaven now: Date')
  }
  const lines = prihodkiMeseciCsvVrstice(povzetek, now.toISOString())
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Prihodki-meseci-YYYY-MM-DD.csv (družinski
 *  vzorec — referenčni datum pride KOT parameter, F4). */
export function prihodkiMeseciCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('prihodkiMeseciCsvFilename: pričakovan veljaven now: Date')
  }
  return `Prihodki-meseci-${todayStamp(now)}.csv`
}
