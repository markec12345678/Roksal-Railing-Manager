// R172 — RFC 5545 (iCalendar) pomožniki, EN VIR RESNICE za vse .ics izvoze.
// ---------------------------------------------------------------------------
// Izvorno so bili pomožniki zasegani v logistics-tab.tsx (R139). Z prihodom
// .ics izvoza na dashboard Termini kartici (P1-d, R172) so izdvajeni v čisto
// client-safe knjižnico, da LOGISTIKA in KARTICA uporabljata ISTE funkcije —
// escape/fold/UTC pravila se ne moreta razhajati (dva izvoza, en RFC).
//
// Načela:
//  • Vedenje pomožnikov je BYTE-IDENTIČNO R139 verziji (refaktor, ne sprememba
//    formata) — logistični .ics ostane enak po bajtih.
//  • Brez skritih ur: klicatelj podaja izrecne čase (determinizem).
//  • Fail-closed: neveljaven datum → TypeError (nikoli izmišljenega '1970-01-01').

/** RFC 5545 §3.3.11 TEXT: obratna poševnica, podpičje, vejica in nova vrstica. */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** RFC 5545: vrstice največ 75 oktetov — nadaljevanje z začetnim presledkom. */
export function icsFold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 73) {
    out.push(rest.slice(0, 73))
    rest = ' ' + rest.slice(73)
  }
  out.push(rest)
  return out.join('\r\n')
}

/** RFC 5545 DATE-TIME v UTC obliki 'YYYYMMDDTHHMMSSZ' (prenosljivo čez pasove). */
export function icsUtc(d: string | Date): string {
  const t = new Date(d)
  if (Number.isNaN(t.getTime())) {
    throw new TypeError(`icsUtc: neveljaven datum: ${String(d)}`)
  }
  return (
    t.getUTCFullYear().toString().padStart(4, '0') +
    String(t.getUTCMonth() + 1).padStart(2, '0') +
    String(t.getUTCDate()).padStart(2, '0') +
    'T' +
    String(t.getUTCHours()).padStart(2, '0') +
    String(t.getUTCMinutes()).padStart(2, '0') +
    String(t.getUTCSeconds()).padStart(2, '0') +
    'Z'
  )
}

/**
 * Sproži prenos ŽE zgrajene .ics vsebine (vzorec downloadCsvText R171 — en
 * prenosni kontrakt za že zgrajeno besedilo). MIME text/calendar — Google/
 * Apple/Outlook ga uvozijo kot koledar. URL se prekliče po 2 s (probtni
 * brskalniki imajo blob že ujet ob click; R139 vzorec, dokazano v živo).
 */
export function downloadIcsText(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
