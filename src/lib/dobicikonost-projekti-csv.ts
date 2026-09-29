// ---------------------------------------------------------------------------
// R293 (P1-f, 'izvozi' družina — 24. člen) — DOBIČKONOST PO PROJEKTIH CSV iz
// Vodjinega pregleda (vodja-dashboard). CSV BRAT PDF R258 (vzorec
// R284→R285/R291/R292): izvozi TOČNO tisto resnico, ki jo DOBIČKONOST PO
// PROJEKTIH PDF izriše — WYSIWYG po konstrukciji.
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • presek = { vrste, povzetek } — ISTI rezultat dobicikonostPoProjektih
//    (PDF brat R258), ki ga vodja-dashboard ŽE izračuna (memo EN VIR) za
//    MARŽNI RAZGLED strip IN PDF; lib NE računa preseka znova — divergenca
//    med zaslonom, PDF in CSV nemogoča (R291 vzorec);
//  • zneski = znesekNiz (UVOŽEN iz PDF brata — ISTI strojni kanon: 2 decimalni
//    mesti s piko; R293 export — EN VIR, nič dvojnega);
//  • sklanjatev = projektBeseda (UVOŽENA iz projekti-termini-pdf — R265
//    lekcija: sklanjatev NIKOLI zasegana);
//  • marža % = ISTA null resnica kot PDF tabela: marzaOdstotek === null →
//    '—' (NIKOLI izmišljen 0 % — R227 strogost); sicer toFixed(1) (ISTI izpis).
//
// Struktura CSV (ravnina — PDF autoTable tabela je že ravninska):
//  • podatkovne vrstice: Projekt · Prihodki (EUR) · Stroški (EUR) ·
//    Marža (EUR) · Marža (%) · Računov · Naročil — ISTI 7 stolpcev VERBATIM
//    kot PDF autoTable head; NEGATIVNA marža gre v CSV VERBATIM (iskren
//    alarm — NIKOLI utišan, PDF RED bold pariteta);
//  • meta vrstice po podatkih (kanon R172/R291/R292): prazna ločilna +
//    Obseg (presek dveh virov — poimenovan) + Projektov + Prihodki +
//    Stroški + Marža + POGOJNA 'Negativnih marž' (samo > 0 — iskren alarm;
//    odsotnost = resnica nič alarmov, pogojni kanon r277) + POGOJNA
//    'Storniranih računov' + POGOJNA 'Osnutkov računov' (izključeni iz
//    prihodkov — poimenovani, PDF sklep pariteta) + POGOJNA 'Računov brez
//    projekta' + POGOJNA 'Naročil brez projekta' (izključeni iz preseka, z
//    iskrenima vsotama EUR — PDF sklep pariteta) + 'Izvoženo ob' (kanonični
//    ISO 8601 — vzorec R286/R291/R292);
//  • PRAZEN PRESEK (0 vrst) je VELJAVEN vhod (glava + meta z iskrnimi
//    ničlami — brez lažnih 0-vrstic; brez-projektni odpad ŠE VEDNO
//    poimenovan, če je prisoten); komponenta pri 0 računov IN 0 naročil
//    NEOBJAVLJA datoteke (fail-closed toast — ISTI gate kot PDF brat R258).
//
// Načela (družinska pravila):
//  • Fail-closed: ne-objekten presek / ne-polje vrste / pokvarjena vrsta
//    (ne-prazen projekt, negativni prihodki ali stroški, marža ≠ prihodki −
//    stroški [točkovna izpeljava preverba — ISTI FP operaciji], ne-finite
//    marža %, ne-celi števci) / pokvaren povzetek / pokvaren now → TypeError
//    (indeks krivca VEDNO v sporočilu — nikoli tiho spregledano). Marža SME
//    biti negativna (izpeljana resnica — rdeči alarm); prihodki in stroški
//    sta denarna tokova ≥ 0.
//  • Determinizem: `now` pride KOT parameter (jedro ne bere ure — F4);
//    vrstice v ISTEM vrstnem redu kot vhod (MARŽA ASC sort je delo PDF
//    brata — lib NE preureja; f(množica) po R248/R250/R252/R253).
//  • Format: BOM + '\n' zaključki + citiranje besedilnih celic (vzorec
//    vodja-csv / R285 / R286 / R291 / R292 — vsak lib nosi lasten
//    3-vrstični citiraj).
// ---------------------------------------------------------------------------

import {
  znesekNiz,
  type DobicikonostVrsta,
  type DobicikonostPovzetek,
} from './dobicikonost-pdf'
import { projektBeseda } from './projekti-termini-pdf'
import { todayStamp } from './csv-export'

/** Presek, ki ga CSV uvaža (NE računa znova) — ISTI rezultat
 *  dobicikonostPoProjektih kot PDF brat R258 IN maržni razgled strip. */
export interface DobicikonostPresek {
  vrste: readonly DobicikonostVrsta[]
  povzetek: DobicikonostPovzetek
}

/** Glava tabele (7 stolpcev — VERBATIM PDF autoTable head R258). */
export const DOBICIKONOST_PROJEKTI_CSV_GLAVA = [
  'Projekt',
  'Prihodki (EUR)',
  'Stroški (EUR)',
  'Marža (EUR)',
  'Marža (%)',
  'Računov',
  'Naročil',
] as const

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec vodja-csv/R291. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** Fail-closed preverba preseka (indeks krivca VEDNO v sporočilu). Marža SME
 *  biti negativna (izpeljana resnica); prihodki/stroški = tokovi ≥ 0;
 *  marža = prihodki − stroški je TOČKOVNA izpeljava preverba (isti FP
 *  operaciji kot brat — odstopanje = pokvaren presek, NIKOLI tiho). */
function preveriPresek(presek: DobicikonostPresek): void {
  if (!presek || typeof presek !== 'object') {
    throw new TypeError('dobicikonostProjektiCsvVrstice: pričakovan presek (DobicikonostPresek)')
  }
  if (!Array.isArray(presek.vrste)) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: pričakovano polje vrst (DobicikonostVrsta[])')
  }
  const pov = presek.povzetek
  if (!pov || typeof pov !== 'object') {
    throw new TypeError('dobicikonostProjektiCsvVrstice: pričakovan povzetek (DobicikonostPovzetek)')
  }
  presek.vrste.forEach((v, i) => {
    if (!v || typeof v !== 'object') {
      throw new TypeError(`dobicikonostProjektiCsvVrstice (${i}): pričakovana vrsta (DobicikonostVrsta)`)
    }
    if (typeof v.projekt !== 'string' || v.projekt.trim() === '') {
      throw new TypeError(`dobicikonostProjektiCsvVrstice (${i}): projekt mora biti ne-prazen niz, ne ${String(v.projekt)}`)
    }
    if (typeof v.prihodki !== 'number' || !Number.isFinite(v.prihodki) || v.prihodki < 0) {
      throw new TypeError(`dobicikonostProjektiCsvVrstice (${i}): prihodki morajo biti končno ne-negativno število, ne ${String(v.prihodki)}`)
    }
    if (typeof v.stroski !== 'number' || !Number.isFinite(v.stroski) || v.stroski < 0) {
      throw new TypeError(`dobicikonostProjektiCsvVrstice (${i}): stroški morajo biti končno ne-negativno število, ne ${String(v.stroski)}`)
    }
    if (typeof v.marza !== 'number' || !Number.isFinite(v.marza)) {
      throw new TypeError(`dobicikonostProjektiCsvVrstice (${i}): marža mora biti končno število, ne ${String(v.marza)}`)
    }
    if (v.marza !== v.prihodki - v.stroski) {
      throw new TypeError(`dobicikonostProjektiCsvVrstice (${i}): marža ${String(v.marza)} NI izpeljava prihodki − stroški (${String(v.prihodki - v.stroski)}) — pokvaren presek`)
    }
    if (v.marzaOdstotek !== null && (typeof v.marzaOdstotek !== 'number' || !Number.isFinite(v.marzaOdstotek))) {
      throw new TypeError(`dobicikonostProjektiCsvVrstice (${i}): marzaOdstotek mora biti končno število ali null, ne ${String(v.marzaOdstotek)}`)
    }
    if (!Number.isInteger(v.racunov) || v.racunov < 0) {
      throw new TypeError(`dobicikonostProjektiCsvVrstice (${i}): racunov mora biti ne-negativno celo število, ne ${String(v.racunov)}`)
    }
    if (!Number.isInteger(v.narocil) || v.narocil < 0) {
      throw new TypeError(`dobicikonostProjektiCsvVrstice (${i}): narocil mora biti ne-negativno celo število, ne ${String(v.narocil)}`)
    }
  })
  if (!Number.isInteger(pov.projektov) || pov.projektov < 0) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.projektov mora biti ne-negativno celo število, ne ' + String(pov.projektov))
  }
  if (typeof pov.prihodki !== 'number' || !Number.isFinite(pov.prihodki) || pov.prihodki < 0) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.prihodki mora biti končno ne-negativno število, ne ' + String(pov.prihodki))
  }
  if (typeof pov.stroski !== 'number' || !Number.isFinite(pov.stroski) || pov.stroski < 0) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.stroski mora biti končno ne-negativno število, ne ' + String(pov.stroski))
  }
  if (typeof pov.marza !== 'number' || !Number.isFinite(pov.marza)) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.marža mora biti končno število, ne ' + String(pov.marza))
  }
  if (!Number.isInteger(pov.negativnih) || pov.negativnih < 0) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.negativnih mora biti ne-negativno celo število, ne ' + String(pov.negativnih))
  }
  if (!Number.isInteger(pov.racunovBrezProjekta) || pov.racunovBrezProjekta < 0) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.racunovBrezProjekta mora biti ne-negativno celo število, ne ' + String(pov.racunovBrezProjekta))
  }
  if (!Number.isInteger(pov.narocilBrezProjekta) || pov.narocilBrezProjekta < 0) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.narocilBrezProjekta mora biti ne-negativno celo število, ne ' + String(pov.narocilBrezProjekta))
  }
  if (typeof pov.prihodkiBrezProjekta !== 'number' || !Number.isFinite(pov.prihodkiBrezProjekta) || pov.prihodkiBrezProjekta < 0) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.prihodkiBrezProjekta mora biti končno ne-negativno število, ne ' + String(pov.prihodkiBrezProjekta))
  }
  if (typeof pov.stroskiBrezProjekta !== 'number' || !Number.isFinite(pov.stroskiBrezProjekta) || pov.stroskiBrezProjekta < 0) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.stroskiBrezProjekta mora biti končno ne-negativno število, ne ' + String(pov.stroskiBrezProjekta))
  }
  if (!Number.isInteger(pov.storniranih) || pov.storniranih < 0) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.storniranih mora biti ne-negativno celo število, ne ' + String(pov.storniranih))
  }
  if (!Number.isInteger(pov.osnutkiRacunov) || pov.osnutkiRacunov < 0) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: povzetek.osnutkiRacunov mora biti ne-negativno celo število, ne ' + String(pov.osnutkiRacunov))
  }
}

/** Marža % kot PDF tabela: toFixed(1) ALI '—' (null = NI definiran —
 *  NIKOLI izmišljen 0 %). ENA izpeljava za CSV vrstico IN strip stolpec. */
export function marzaOdstotekNiz(v: Pick<DobicikonostVrsta, 'marzaOdstotek'>): string {
  return v.marzaOdstotek === null ? '—' : v.marzaOdstotek.toFixed(1)
}

/** Sklepna vrstica (EN VIR za MARŽNI RAZGLED strip IN toast — WYSIWYG; ISTA
 *  resnica kot PDF KPI: projektov · prihodki · stroški · marža · negativnih).
 *  Sklanjatev UVOŽENA (projektBeseda — R265 lekcija). */
export function dobicikonostSklep(pov: DobicikonostPovzetek): string {
  if (!pov || typeof pov !== 'object') {
    throw new TypeError('dobicikonostSklep: pričakovan povzetek (DobicikonostPovzetek)')
  }
  return [
    `${pov.projektov} ${projektBeseda(pov.projektov)}`,
    `prihodki ${znesekNiz(pov.prihodki)} EUR`,
    `stroški ${znesekNiz(pov.stroski)} EUR`,
    `marža ${znesekNiz(pov.marza)} EUR`,
    `negativnih marž ${pov.negativnih}`,
  ].join(' · ')
}

/** Vrstice CSV (brez BOM) — podatkovne + meta (kanon R172/R291/R292).
 *  Vrstice v ISTEM vrstnem redu kot vhod (MARŽA ASC — bratova sort, lib NE
 *  preureja). `now` = žig + ime (F4). */
export function dobicikonostProjektiCsvVrstice(
  presek: DobicikonostPresek,
  now: Date,
): string[] {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('dobicikonostProjektiCsvVrstice: pričakovan veljaven now: Date')
  }
  preveriPresek(presek)
  const { vrste, povzetek: pov } = presek
  const vrstice: string[] = [DOBICIKONOST_PROJEKTI_CSV_GLAVA.map(citiraj).join(',')]
  for (const v of vrste) {
    vrstice.push(
      [
        v.projekt,
        znesekNiz(v.prihodki),
        znesekNiz(v.stroski),
        znesekNiz(v.marza),
        marzaOdstotekNiz(v),
        String(v.racunov),
        String(v.narocil),
      ]
        .map(citiraj)
        .join(','),
    )
  }
  // --- meta vrstice (kanon R172/R291/R292 — iskrne ničle pri praznem preseku) ---
  vrstice.push('')
  vrstice.push(
    [
      'Obseg',
      'Vsi projekti — presek računov (prihodki) in naročil (stroški materiala)',
    ]
      .map(citiraj)
      .join(','),
  )
  vrstice.push(['Projektov', String(pov.projektov)].map(citiraj).join(','))
  vrstice.push(['Prihodki', znesekNiz(pov.prihodki)].map(citiraj).join(','))
  vrstice.push(['Stroški', znesekNiz(pov.stroski)].map(citiraj).join(','))
  vrstice.push(['Marža', znesekNiz(pov.marza)].map(citiraj).join(','))
  if (pov.negativnih > 0) {
    vrstice.push(
      ['Negativnih marž (iskren alarm)', String(pov.negativnih)].map(citiraj).join(','),
    )
  }
  if (pov.storniranih > 0) {
    vrstice.push(
      ['Storniranih računov (izključeni iz prihodkov)', String(pov.storniranih)].map(citiraj).join(','),
    )
  }
  if (pov.osnutkiRacunov > 0) {
    vrstice.push(
      ['Osnutkov računov (izključeni iz prihodkov)', String(pov.osnutkiRacunov)].map(citiraj).join(','),
    )
  }
  if (pov.racunovBrezProjekta > 0) {
    vrstice.push(
      [
        'Računov brez projekta (izključeni iz preseka)',
        `${pov.racunovBrezProjekta} (${znesekNiz(pov.prihodkiBrezProjekta)} EUR)`,
      ]
        .map(citiraj)
        .join(','),
    )
  }
  if (pov.narocilBrezProjekta > 0) {
    vrstice.push(
      [
        'Naročil brez projekta (izključeni iz preseka)',
        `${pov.narocilBrezProjekta} (${znesekNiz(pov.stroskiBrezProjekta)} EUR)`,
      ]
        .map(citiraj)
        .join(','),
    )
  }
  vrstice.push(['Izvoženo ob', now.toISOString()].map(citiraj).join(','))
  return vrstice
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec R186/R285/R286/R291/R292). */
export function dobicikonostProjektiCsv(
  presek: DobicikonostPresek,
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('dobicikonostProjektiCsv: pričakovan veljaven now: Date')
  }
  const lines = dobicikonostProjektiCsvVrstice(presek, now)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Dobicikonost-projektov-YYYY-MM-DD.csv
 *  (družinski vzorec — referenčni datum pride KOT parameter, F4; brat PDF
 *  imena R258). */
export function dobicikonostProjektiCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('dobicikonostProjektiCsvFilename: pričakovan veljaven now: Date')
  }
  return `Dobicikonost-projektov-${todayStamp(now)}.csv`
}
