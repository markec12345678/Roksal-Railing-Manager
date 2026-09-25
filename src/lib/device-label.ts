// Roksal — opis naprave iz User-Agenta (R137, issue #5 §2/§9 podpora).
// ---------------------------------------------------------------------------
// Zakaj: seje v registru (UserSession) hranijo surov `userAgent`. Za UI
// "Aktivne seje" želimo človeku razumljiv opis ("Telefon · Android · Chrome"),
// NE pa razkrivanje polnega UA niza (površinski fingerprint — §17 duh:
// minimizacija odgovorov tudi v prikazu).
//
// Kontraktno:
//   • ČISTO deterministično: isti niz → isti opis, vedno (brez Intl, brez
//     Date, brez naključja). Testirano.
//   • Fail-verbose za neznane vhode: prazen/neznani UA → "Neznana naprava" /
//     "Neznan sistem" / "Neznan brskalnik" — NIKOLI izmišljen podatek
//     (pravilo "brez izmišljanja podatkov" velja tudi za prikaz).
//   • Varnost: vhod je TUJ niz (HTTP header) — izhod je zgolj iz bele seznam
//     znanih tokenov; nikoli ne vrne dela surovega niza.

export interface DeviceLabel {
  device: string
  os: string
  browser: string
}

const UNKNOWN: DeviceLabel = {
  device: 'Neznana naprava',
  os: 'Neznan sistem',
  browser: 'Neznan brskalnik',
}

/**
 * Razčleni User-Agent v kratek prikazni opis naprave.
 * Vrstem red pravil je pomemben (Edge/Opera vsebujejo "Chrome" token,
 * Android tablice vsebujejo "Android", iOS brskalniki vsebujejo "like Gecko").
 */
export function describeDevice(ua: string | null | undefined): DeviceLabel {
  if (typeof ua !== 'string') return { ...UNKNOWN }
  const s = ua.trim()
  if (s.length === 0 || s.length > 512) return { ...UNKNOWN }

  // ── Naprava ──────────────────────────────────────────────────────────────
  // Tablica: iPad, izrecno "Tablet", Android BREZ "Mobile" (Android telefon
  // nosi "Mobile"; tablica ne — zanesljiv kontraktni znak).
  const isTablet =
    /iPad/.test(s) ||
    /Tablet/.test(s) ||
    (/Android/.test(s) && !/Mobile/.test(s))
  const isPhone =
    /iPhone/.test(s) ||
    /iPod/.test(s) ||
    /Windows Phone/.test(s) ||
    (/Android/.test(s) && /Mobile/.test(s)) ||
    (/\bMobi\b/.test(s) && !isTablet)

  const device = isTablet ? 'Tablica' : isPhone ? 'Telefon' : 'Računalnik'

  // ── Sistem ───────────────────────────────────────────────────────────────
  let os: string
  if (/Windows NT|Windows Phone/.test(s)) os = 'Windows'
  else if (/iPhone|iPad|iPod/.test(s)) os = 'iOS'
  else if (/Mac OS X|Macintosh/.test(s)) os = 'macOS'
  else if (/Android/.test(s)) os = 'Android'
  else if (/CrOS/.test(s)) os = 'ChromeOS'
  else if (/Linux|X11/.test(s)) os = 'Linux'
  else os = 'Neznan sistem'

  // ── Brskalnik ────────────────────────────────────────────────────────────
  // Vrstem red: Edg/ pred Chrome/ (Edge pošilja oba), OPR/ pred Chrome/,
  // Samsung (SamsungInternet) pred Chrome/, Firefox je svoj token,
  // Safari/ZADNJI (Chrome pošilja tudi "Safari" token — loči prek Version/).
  let browser: string
  if (/Edg(A|iOS|e)?\//.test(s)) browser = 'Edge'
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera'
  else if (/SamsungBrowser\//.test(s)) browser = 'Samsung Internet'
  else if (/Firefox\/|FxiOS/.test(s)) browser = 'Firefox'
  else if (/CriOS/.test(s)) browser = 'Chrome'
  else if (/Chrome\//.test(s)) browser = 'Chrome'
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = 'Safari'
  else browser = 'Neznan brskalnik'

  return { device, os, browser }
}

/**
 * enovrstični prikaz: "Telefon · Android · Chrome".
 * Neznani deli ostanejo izrecno vidni (brez tihe izgube informacije).
 */
export function deviceLabelLine(ua: string | null | undefined): string {
  const d = describeDevice(ua)
  return `${d.device} · ${d.os} · ${d.browser}`
}
