/**
 * UPN QR koda — slovenski univerzalni plačilni nalog (ISO 20022-based,
 * specifikacija Združenja bank Slovenije, upn-qr.si).
 *
 * Vsebina QR je niz polj ločenih z novo vrstico (\n). Zadnje številčno
 * polje "vsota" je kontrolna vsota znakov: vsota dolžin prvih 19 polj + 19
 * ločil (nova vrstica). QR vsebuje izključno osnovne znake — šumnike
 * pretvorimo (Š→S, Č→C, Ž→Z …), ker jih bralci bank prepričljivo
 * podpirajo le v omejenem naboru.
 *
 * Format polj (1–21):
 *  1  "UPNQR"              identifikator
 *  2  IBAN plačnika        (opcijsko — za PGN ni potrebno)
 *  3  polog                "X" ali ""
 *  4  dvig                 "X" ali ""
 *  5  referenca plačnika   max 26
 *  6  ime plačnika         max 33
 *  7  ulica plačnika       max 33
 *  8  kraj plačnika        max 33
 *  9  znesek               11 števk, centi, leading zeros (npr. 00000125172)
 * 10  datum plačila        "" ali DD.MM.LLLL
 * 11  nujno                "X" ali ""
 * 12  koda namena          4 velike črke (OTHR = drugo)
 * 13  namen plačila        prosto besedilo (42 znakov priporočeno)
 * 14  rok plačila          DD.MM.LLLL
 * 15  IBAN prejemnika      obvezen, max 19 znakov (SIxx…)
 * 16  referenca prejemnika npr. "SI12 2026-001"
 * 17  ime prejemnika
 * 18  ulica prejemnika
 * 19  kraj prejemnika
 * 20  vsota                kontrolna vsota (št. znakov 1–19 + 19 ločil)
 * 21  rezerva              opcijsko
 */

export interface UpnQrData {
  iban: string
  znesek: number
  /** Rok plačila — DD.MM.LLLL se izračuna iz datuma */
  rokPlacila: Date
  imePrejemnika: string
  ulicaPrejemnika: string
  krajPrejemnika: string
  /** Referenca prejemnika, npr. "SI12 2026-001" */
  referencaPrejemnika: string
  /** Namen plačila, npr. "Plačilo računa 2026-001" */
  namenPlacila: string
  /** Podatki plačnika (kupca) — opcijski, izpolnijo QR prej */
  imePlacnika?: string
  ulicaPlacnika?: string
  krajPlacnika?: string
  /** Referenca plačnika (max 26) — običajno prazno pri dohodnem plačilu */
  referencaPlacnika?: string
  kodaNamena?: string
}

/** Šumniki → osnovni latinski znaki (opcijsko za sisteme, ki ne znajo UTF-8). */
export function asciiSanitize(s: string): string {
  return s
    .replace(/Č|Ć/g, 'C')
    .replace(/č|ć/g, 'c')
    .replace(/Š/g, 'S')
    .replace(/š/g, 's')
    .replace(/Ž/g, 'Z')
    .replace(/ž/g, 'z')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Ü/g, 'U')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^ -~]/g, '') // vse kar ni vidni ASCII (npr. desetiška vejica, emoji)
}

/** DD.MM.LLLL */
function formatSlDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

/** IBAN brez presledkov, velike črke. */
export function cleanIban(iban: string): string {
  return asciiSanitize(iban).replace(/\s+/g, '').toUpperCase()
}

/** Razdeli "Ljubljanska cesta 142, 4000 Kranj" → [ulica, kraj]. */
export function splitNaslov(naslov: string): [string, string] {
  const clean = naslov.trim()
  const idx = clean.lastIndexOf(',')
  if (idx === -1) return [clean, '']
  return [clean.slice(0, idx).trim(), clean.slice(idx + 1).trim()]
}

const MAX = {
  referencaPlacnika: 26,
  imePlacnika: 33,
  ulicaPlacnika: 33,
  krajPlacnika: 33,
  imePrejemnika: 33,
  ulicaPrejemnika: 33,
  krajPrejemnika: 33,
  namenPlacila: 42,
  referencaPrejemnika: 26,
} as const

/**
 * Zgradi UPN QR niz (21 polj, \n ločila). Vrže napako, če IBAN manjka,
 * da UI lahko pokaže jasno sporočilo namesto pokvarjene QR kode.
 */
export function buildUpnQrString(data: UpnQrData): string {
  const iban = cleanIban(data.iban)
  if (!iban) throw new Error('IBAN prejemnika je obvezen za UPN QR')
  if (iban.length > 19) throw new Error(`IBAN prejema je predolg (${iban.length}, max 19)`)

  const cents = Math.round(data.znesek * 100)
  if (!Number.isFinite(cents) || cents <= 0 || cents > 99999999999) {
    throw new Error('Neveljaven znesek za UPN QR')
  }
  const znesek = String(cents).padStart(11, '0')

  // Koda namena: točno 4 velike črke (OTHR = "drugo" — vedno veljavna)
  const koda = asciiSanitize(data.kodaNamena ?? 'OTHR').toUpperCase().slice(0, 4)
  if (!/^[A-Z]{4}$/.test(koda)) throw new Error('Koda namena mora imeti 4 velike črke')

  const polja = [
    'UPNQR', // 1 identifikator
    '', // 2 IBAN plačnika
    '', // 3 polog
    '', // 4 dvig
    (data.referencaPlacnika ?? '').slice(0, MAX.referencaPlacnika), // 5
    (data.imePlacnika ?? '').slice(0, MAX.imePlacnika), // 6
    (data.ulicaPlacnika ?? '').slice(0, MAX.ulicaPlacnika), // 7
    (data.krajPlacnika ?? '').slice(0, MAX.krajPlacnika), // 8
    znesek, // 9
    '', // 10 datum plačila (izpolni banka ob plačilu)
    '', // 11 nujno
    koda, // 12
    (data.namenPlacila ?? '').slice(0, MAX.namenPlacila), // 13
    formatSlDate(data.rokPlacila), // 14
    iban, // 15
    (data.referencaPrejemnika ?? '').slice(0, MAX.referencaPrejemnika), // 16
    data.imePrejemnika.slice(0, MAX.imePrejemnika), // 17
    data.ulicaPrejemnika.slice(0, MAX.ulicaPrejemnika), // 18
    data.krajPrejemnika.slice(0, MAX.krajPrejemnika), // 19
  ]

  // Kontrolna vsota: skupna dolžina polj 1–19 + 19 ločil (nova vrstica)
  const vsota = polja.reduce((sum, p) => sum + p.length, 0) + 19
  polja.push(String(vsota)) // 20
  polja.push('') // 21 rezerva

  return polja.join('\n')
}
