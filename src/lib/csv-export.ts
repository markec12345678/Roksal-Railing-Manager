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
