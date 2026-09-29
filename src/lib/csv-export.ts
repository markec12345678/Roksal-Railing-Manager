// R136 — determinističen CSV izvoz (pisarniško orodje).
// ---------------------------------------------------------------------------
// Pogodba oblike (usklajeno s slovenskim Excelom):
//   • ločilo: podpičje (`;`) — Excel SI pričakuje `;` (vejica je decimalna);
//   • decimalna vejica pri številkah (2 decimalki, deterministicen toFixed);
//   • UTF-8 BOM na začetku — Excel sicer napačno dekodira šumnike;
//   • CRLF vrstični zaključki (RFC 4180 + Excel);
//   • citiranje polj po RFC 4180 (narekovaj podvojen; polje citirano, če
//     vsebuje `;`, `"`, novico ali vodilni/končni presledek).
// Brez naključja, brez locale API-jev — ista vhodna data = ista datoteka.
/** Dovoljene vrednosti celic (vse ostalo je programerska napaka). */
export type CsvValue = string | number | null | undefined

const BOM = '\uFEFF'

function quoteField(value: string): string {
  if (/[;"\r\n]|^\s|\s$/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Polje → CSV besedilo (števila z decimalno vejico, null/undefined → prazno). */
export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    // 2 decimalni mesti, vejica kot decimalno ločilo (deterministično)
    return value.toFixed(2).replace('.', ',')
  }
  return quoteField(String(value))
}

/** Vrstice → CSV besedilo (z BOM in CRLF). */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => csvField(cell)).join(';'))
  return BOM + lines.join('\r\n') + '\r\n'
}

/**
 * Sproži prenos ŽE zgrajenega CSV besedila (R171 — izvozi, ki vključujejo
 * povzetke/metapodatke, ki jih oblika headers+rows ne more izraziti;
 * vzorec: Termini kartica P1-d). Isti kontrakt kot downloadCsv.
 */
export function downloadCsvText(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Sproži prenos CSV datoteke v brskalniku. Datum v imenu je `danes` —
 * klicatelj poda že oblikovano `YYYY-MM-DD` (determinizem na ravni UI).
 */
export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]): void {
  downloadCsvText(filename, toCsv(headers, rows))
}

/** Današnji datum kot `YYYY-MM-DD` (lokalni čas, deterministično oblikovan). */
export function todayStamp(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ---------------------------------------------------------------------------
// R294 (issue #1 — determinizem) — EN VIR slovenski prikazni formati:
// zamenjava toLocale*/Intl klicev (ICU-odvisen izpis — lahko divergira čez
// stroje/verzije Node) z BAJTNO ISTIMI čistimi izpeljavami. Format pravila
// izpeljane iz ICU resnice (node 24, sl-SI) — glej r294 testi (bajtna
// pariteta z Intl na kanoničnih primerih).
// ---------------------------------------------------------------------------

/** `DD. MM. YYYY` (2-mestni dan/mesec s presledki — pariteta
 *  toLocaleDateString('sl-SI', { day:'2-digit', month:'2-digit', year:'numeric' })). */
export function slDatum(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}. ${mm}. ${d.getFullYear()}`
}

/** `HH:MM` (pariteta toLocaleTimeString('sl-SI', { hour:'2-digit', minute:'2-digit' })). */
export function slUra(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** `D. M. YYYY` (brez polnjenja — pariteta toLocaleDateString('sl-SI') privzeti format). */
export function slDatumKratko(d: Date): string {
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`
}

/** `DD. MM.` (brez leta — pariteta toLocaleDateString('sl-SI', { day:'2-digit',
 *  month:'2-digit' }) — R295, komponentna UI logika). */
export function slDatumOkrajsava(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}. ${mm}.`
}

/** `HH:MM:SS` (pariteta toLocaleTimeString('sl-SI') privzeti format — R295,
 *  komponentna PDF logika: toLocaleString('sl-SI') = slDatumKratko + ', ' + slCasDolgo). */
export function slCasDolgo(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Število z decimalno vejico in točkovnim tisočilcem (pariteta
 *  Intl.NumberFormat('sl-SI', { minimumFractionDigits, maximumFractionDigits })). */
export function formatSlDecimalno(n: number, minFrac: number, maxFrac: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new TypeError('formatSlDecimalno: pričakovano končno število')
  }
  if (!Number.isInteger(minFrac) || !Number.isInteger(maxFrac) || minFrac < 0 || maxFrac < minFrac || maxFrac > 20) {
    throw new TypeError('formatSlDecimalno: pričakovana 0 ≤ minFrac ≤ maxFrac ≤ 20')
  }
  const neg = n < 0
  const abs = Math.abs(n)
  const fiksno = abs.toFixed(maxFrac)
  const [cela, frack] = fiksno.split('.')
  // sl-SI ICU: tisočilce šele pri ≥ 5 celoštevilčnih mestih (10000 → 10.000,
  // 9999 → 9999 — minimumGroupingDigits = 2; izmerjeno node 24)
  const skupina = cela.length >= 5 ? cela.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : cela
  const frakcija = frack !== undefined && frack.length > 0 ? frack : ''
  // obreži na minFrac (toFixed že zapolni do maxFrac; minFrac < maxFrac obreže
  // končne ničle, ampak NIKOLI pod minFrac)
  const obrezana = frakcija.replace(/0+$/, '').slice(0, Math.max(minFrac, frakcija.replace(/0+$/, '').length))
  const frakPrikaz = obrezana.padEnd(minFrac, '0')
  return (neg ? '-' : '') + skupina + (frakPrikaz.length > 0 ? ',' + frakPrikaz : '')
}

/** Slovenska imena mesecev (index = Date.getMonth() — 0-based; pariteta
 *  toLocaleDateString('sl-SI', { month: 'long' })). */
export const MESCI_SL: readonly string[] = [
  'januar', 'februar', 'marec', 'april', 'maj', 'junij',
  'julij', 'avgust', 'september', 'oktober', 'november', 'december',
]

/** Slovenska kratka imena mesecev (index = Date.getMonth() — 0-based; pariteta
 *  toLocaleDateString('sl-SI', { month: 'short' }) — R295, komponentna PDF/UI
 *  logika; 'maj' brez pike, ostali s piko — izmerjeno node 24 sl-SI). */
export const MESCI_SL_KRATKO: readonly string[] = [
  'jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.',
  'jul.', 'avg.', 'sep.', 'okt.', 'nov.', 'dec.',
]
