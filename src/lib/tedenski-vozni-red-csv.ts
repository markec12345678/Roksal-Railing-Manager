// ---------------------------------------------------------------------------
// R292 (P1-f, 'izvozi' družina — 23. člen) — TEDENSKI VOZNI RED CSV iz
// logistike (logistics-tab). CSV BRAT PDF R256 (vzorec R284→R285, R291):
// izvozi TOČNO tisto resnico, ki jo TEDENSKI VOZNI RED MONTAŽ PDF izriše —
// WYSIWYG po konstrukciji.
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • okno 7 dni = tedenskiOknoDnevi (UVOŽENO iz tedenski-vozni-red-pdf —
//    ISTA UTC aritmetika danes..danes+6, determinizem čez pasove);
//  • ime dneva = tedenskiDanIme (UVOŽENO — ISTI fiksni slovenski seznam kot
//    sekcije PDF; NIKOLI locale-odvisen izpis);
//  • validacija vnosa = preveriVozniRedTermin (UVOŽENA — ISTI fail-closed
//    pregled kot PDF: ISO oblika, status VERBATIM 5 znanih, ure, nizi);
//  • red znotraj dneva = sortirajVozniRed (UVOŽEN — čas ASC, izenačba
//    projekt ASC, null projekt ZADNJI — ISTA izpeljava kot PDF sekcije);
//  • vsote/KPI = tedenskiPregledPovzetek + tedenskiUreKpi (UVOŽENA — ISTI
//    '≥' signal 'brez ure' kot PDF KPI AMBER in sklepna vrstica);
//  • sklanjatev = terminBeseda (UVOŽENA iz termini-prikaz — R168 kanon,
//    R265 lekcija: sklanjatev NIKOLI zasegana);
//  • datum v meta vrstici = cenikDatumIso (UVOŽEN — IZPIŠE isti 'DD.MM.YYYY'
//    kot PDF naslov okna 'Naslednjih 7 dni: …').
//
// Struktura CSV (ravnina — PDF sekcije postanejo stolpca Dan + Dan v tednu):
//  • podatkovne vrstice: Dan (ISO YYYY-MM-DD) · Dan v tednu · Čas · Projekt ·
//    Stranka · Ekipa · Status (label VERBATIM, ISTI kot PDF autoTable) ·
//    Ure ('—' ko je null — iskrena null resnica, NIKOLI izmišljena 0) ·
//    Lokacija ('—' ko je null);
//  • meta vrstice po podatkih (kanon R172/R291): prazna ločilna + Obseg
//    (okno — ISTI izpis kot PDF naslov) + Dni z delom + Terminov +
//    Načrtovane ure (≥ signal UVOŽEN) + POGOJNA 'Brez ure' (samo > 0) +
//    POGOJNA 'Preklicani' (samo > 0 — viden odpad, PDF RED bold pariteta) +
//    'Izvoženo ob' (kanonični ISO 8601 — vzorec R286/R291);
//  • PRAZNO OKNO je VELJAVEN vhod (glava + meta z resničnimi ničlami —
//    iskren dokument brez lažnih 0-vrstic); komponenta pri 0 terminov
//    NEOBJAVLJA datoteke (fail-closed toast, R250/R291 vzorec).
//
// Načela (družinska pravila):
//  • Fail-closed: ne-polje / pokvaren vnos (uvožen pregled — indeks krivca
//    VEDNO v sporočilu) / pokvaren now / pokvaren izvozZig → TypeError
//    (nikoli tiho spregledano).
//  • Determinizem: `now` pride KOT parameter (jedro ne bere ure, F4);
//    dnevi v ISTEM vrstnem redu kot okno (ASC — lib NE preureja okna);
//    vrstice znotraj dneva v ISTEM redu kot sortirajVozniRed (f(množica)
//    po R248/R250/R252/R253 — premešan odgovor = bajtno ISTI CSV).
//  • Format: BOM + '\n' zaključki + citiranje besedilnih celic (vzorec
//    vodja-csv / R285 / R286 / R291 — vsak lib nosi lasten 3-vrstični
//    citiraj).
// ---------------------------------------------------------------------------

import {
  tedenskiOknoDnevi,
  tedenskiDanIme,
  tedenskiPregledPovzetek,
  tedenskiUreKpi,
  type TedenskiPregledPovzetek,
} from './tedenski-vozni-red-pdf'
import {
  preveriVozniRedTermin,
  sortirajVozniRed,
  vozniRedCasOkno,
  type VozniRedTermin,
} from './logistika-vozni-red-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS, terminBeseda } from './termini-prikaz'
import { cenikDatumIso } from './cenik-pdf'
import { todayStamp } from './csv-export'

/** Glava tabele (9 stolpcev — PDF avtoTable stolpci + Dan/Dan v tednu kot
 *  ravninska resnica sekcij). */
export const TEDENSKI_VOZNI_RED_CSV_GLAVA = [
  'Dan',
  'Dan v tednu',
  'Čas',
  'Projekt',
  'Stranka',
  'Ekipa',
  'Status',
  'Ure',
  'Lokacija',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec vodja-csv/R291. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** Razgled na dan — ENA resnica za CSV vrstice IN zasonski razgled strip
 *  (logistics-tab R292 MANDATORY STIL). terminov šteje VSE vidne termine
 *  dneva (preklicani ŠTETI — viden odpad, PDF pariteta); preklicani nosi
 *  števec odpada; vrstice = sortirajVozniRed (ISTI red kot PDF sekcija). */
export interface TedenskiRazgledDan {
  /** ISO datum (YYYY-MM-DD) — strojna resnica. */
  dan: string
  /** Ime dneva (tedenskiDanIme — fiksni slovenski seznam, UVOŽEN). */
  ime: string
  /** Vsi termini dneva (preklicani šteti) — 0 = iskreno prazen dan. */
  terminov: number
  /** Od tega preklicanih (iskren odpad — NIKOLI tiho izpuščen). */
  preklicani: number
  /** Sortirane vrstice dneva (sortirajVozniRed — ISTI red kot PDF). */
  vrstice: VozniRedTermin[]
}

/** Agregatna izpeljava tedenskega razgleda — EN VIR za CSV (23. člen) IN
 *  zasonski razgled strip (R292 MANDATORY STIL). Vrne VSEH 7 dni okna
 *  (prazni = 0 — razgled mora pokazati, kateri dnevi so polni in kateri
 *  prazni; to JE resnica razgleda) + povzetek (null, ko je okno prazno) +
 *  maxTerminov (merilo za mini stolpce — ISTO merilo za VSE dneve, 0 pri
 *  praznem oknu). Pokvaren vnos KJERKOLI → TypeError z indeksom krivca
 *  (uvožen preveriVozniRedTermin — fail-closed, NIKOLI tiho izpuščen). */
export interface TedenskiRazgled {
  /** Okno (7 ISO datumov ASC — uvoženo tedenskiOknoDnevi). */
  okno: string[]
  /** Vseh 7 dni v oknu (istega reda kot okno — prazni = 0). */
  dnevi: TedenskiRazgledDan[]
  /** Povzetek (uvožen tedenskiPregledPovzetek) — null pri praznem oknu. */
  pov: TedenskiPregledPovzetek | null
  /** Največji terminov čez dneve (merilo za delež — 0 pri praznem oknu). */
  maxTerminov: number
}

export function tedenskiRazgled(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): TedenskiRazgled {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('tedenskiRazgled: pričakovano polje terminov (VozniRedTermin[])')
  }
  // Fail-closed pregled VSEH vhodov (ne samo okna — pokvaren vnos = pokvaren
  // vir, NIKOLI tiho izpuščen; indeks krivca je VEDNO v sporočilu — ISTI
  // pregled kot PDF, UVOŽEN, nič dvojnega).
  vnosi.forEach((t, i) => preveriVozniRedTermin(t, i))
  const okno = tedenskiOknoDnevi(now)
  const vOknu = new Set(okno)
  const poDneh = new Map<string, VozniRedTermin[]>()
  for (const t of vnosi) {
    const dan = t.datumZacetka.slice(0, 10)
    if (!vOknu.has(dan)) continue
    const vr = poDneh.get(dan)
    if (vr) vr.push(t)
    else poDneh.set(dan, [t])
  }
  const dnevi: TedenskiRazgledDan[] = okno.map((dan) => {
    const vrstice = sortirajVozniRed(poDneh.get(dan) ?? [])
    let preklicani = 0
    for (const t of vrstice) {
      if (t.status === 'PREKlicANO') preklicani++
    }
    return { dan, ime: tedenskiDanIme(dan), terminov: vrstice.length, preklicani, vrstice }
  })
  const pov = tedenskiPregledPovzetek(vnosi, now)
  const maxTerminov = dnevi.reduce((m, d) => Math.max(m, d.terminov), 0)
  return { okno, dnevi, pov, maxTerminov }
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172/R291). `izvozZig` =
 *  kanonični ISO 8601 žig izvoza (iz `now.toISOString()` na klicni strani). */
export function tedenskiVozniRedCsvVrstice(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): string[] {
  if (typeof now !== 'object' || !(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiVozniRedCsvVrstice: pričakovan veljaven now: Date')
  }
  const razgled = tedenskiRazgled(vnosi, now)
  const vrstice: string[] = [TEDENSKI_VOZNI_RED_CSV_GLAVA.map(citiraj).join(',')]
  for (const d of razgled.dnevi) {
    for (const t of d.vrstice) {
      vrstice.push(
        [
          d.dan,
          d.ime,
          vozniRedCasOkno(t),
          t.projekt ?? '—',
          t.stranka ?? '—',
          t.ekipa ?? '—',
          SCHEDULE_TERMINI_STATUS_LABELS[t.status],
          t.predvideneUre === null ? '—' : String(t.predvideneUre),
          t.lokacija ?? '—',
        ]
          .map(citiraj)
          .join(','),
      )
    }
  }
  // --- meta vrstice (kanon R172/R291 — iskrne ničle pri praznem oknu) ---
  vrstice.push('')
  vrstice.push(
    [
      'Obseg',
      `Naslednjih 7 dni: ${cenikDatumIso(razgled.okno[0])} – ${cenikDatumIso(razgled.okno[6])} (danes + 6 dni, UTC)`,
    ]
      .map(citiraj)
      .join(','),
  )
  const pov = razgled.pov
  vrstice.push(['Dni z delom', String(pov === null ? 0 : pov.dniN)].map(citiraj).join(','))
  vrstice.push(
    ['Terminov', String(pov === null ? 0 : pov.terminovN)].map(citiraj).join(','),
  )
  vrstice.push(
    ['Načrtovane ure', pov === null ? '0' : tedenskiUreKpi(pov)].map(citiraj).join(','),
  )
  if (pov !== null && pov.brezUre > 0) {
    vrstice.push(
      ['Brez ure (izključene iz vsote)', String(pov.brezUre)].map(citiraj).join(','),
    )
  }
  if (pov !== null && pov.preklicanih > 0) {
    vrstice.push(
      ['Preklicani (viden odpad)', String(pov.preklicanih)].map(citiraj).join(','),
    )
  }
  vrstice.push(['Izvoženo ob', now.toISOString()].map(citiraj).join(','))
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286/R291). */
export function tedenskiVozniRedCsv(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiVozniRedCsv: pričakovan veljaven now: Date')
  }
  const lines = tedenskiVozniRedCsvVrstice(vnosi, now)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Tedenski-vozni-red-YYYY-MM-DD.csv (družinski
 *  vzorec — referenčni datum pride KOT parameter, F4; brat PDF imena R256). */
export function tedenskiVozniRedCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiVozniRedCsvFilename: pričakovan veljaven now: Date')
  }
  return `Tedenski-vozni-red-${todayStamp(now)}.csv`
}

/** Sklepna vrstica razgleda (EN VIR za zaslon IN toast — WYSIWYG; ISTA
 *  resnica kot PDF KPI trio + sklep: dni · termini · ure z '≥' signalom +
 *  pogojni preklicani odpad). Sklanjatev UVOŽENA (terminBeseda — R168). */
export function tedenskiRazgledSklep(pov: TedenskiPregledPovzetek): string {
  const deli: string[] = [
    `${pov.dniN} dni z delom`,
    `${pov.terminovN} ${terminBeseda(pov.terminovN)}`,
    `${tedenskiUreKpi(pov)} h`,
  ]
  if (pov.brezUre > 0) deli.push(`${pov.brezUre} brez ure`)
  if (pov.preklicanih > 0) deli.push(`preklicanih ${pov.preklicanih}`)
  return deli.join(' · ')
}
