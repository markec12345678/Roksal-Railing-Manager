/**
 * R149 (issue #5 §37 — Upload security): deterministično jedro za preverjanje
 * vsebine naloženih datotek.
 *
 * §37 zahteva: MIME + magic-byte validation, max size, extension allowlist,
 * image bomb protection, SVG/script protection, filename normalization,
 * random object keys, path traversal protection, private-by-default,
 * malware scanning policy, EXIF/GPS policy.
 *
 * VRZEL PREJ (iskreno): `parseDataUri` (object-storage.ts) je zaupal
 * deklariranemu MIME, dokler je bil specifičen — `data:image/jpeg;base64,`
 * nad KATERIKOLI bajti je bil shranjen kot slika. Novo pravilo je
 * FAIL-CLOSED: deklaracija se PREVERI proti magičnim bajtom; neskladje je
 * 400 z izrecnim razlogom (nikoli tiho prevzemanje, nikoli tiho preimenovanje).
 *
 * Pravila (čisto jedro — ni baze, ni ure, deterministično za iste vhode):
 *   • Dovoljen seznam vrst vsebine je ZAPRT: PNG, JPEG, WebP, PDF.
 *     Vse drugo (SVG = vektor s skripti, HTML, GIF, ZIP …) je zavrnjeno
 *     z izrecnim razlogom — SVG je vektorski XSS nosilec, zato je izrecno
 *     prepovedan tudi, če bi ga nekdo deklariral.
 *   • `application/octet-stream` (splošna deklaracija) → vrsta se IZVEDE iz
 *     magičnih bajtov; neznana vsebina → zavrnitev (prej bi šla skozi kot
 *     octet-stream — vrzel).
 *   • Specifična deklaracija ≠ magični bajti → zavrnitev z obema imenoma
 *     (deklarirano X, dejansko Y). Klient ni zaupan; brskalnikov canvas
 *     data URI vedno pošilja pravo deklaracijo, zato neskladje pomeni
 *     pokvarjen ALI zlonamerni klient — v obeh primerih odkloniten.
 *   • Image bomb zaščita: iz GLAVE slike (brez dekodiranja!) se prebereta
 *     širina/višina (PNG IHDR, JPEG SOF, WebP VP8/VP8L/VP8X). Nad
 *     MAX_IMAGE_DIMENSION ali MAX_IMAGE_PIXELS → zavrnitev. Dekodiranje
 *     je tako drago, da ga izključno izvedemo šele po preverbi glave.
 *   • Max size ostane v `parseDataUri` (maxBytes) — tu se ne podvaja.
 *
 * Bajti se NIKOLI ne spreminjajo (ni tihe EXIF stripping poti — pošten
 * policy je dokumentiran v docs/VARNOST.md §37: canvas data URIs so že
 * brez EXIF; strežniško stripanje je izrecno odloženo, ne utišano).
 */

/** Zaprto dovoljen seznam vrst vsebine za uploade (§37 extension allowlist). */
export const UPLOAD_ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const

export type UploadAllowedMime = (typeof UPLOAD_ALLOWED_MIMES)[number]

/** Strop dimenzij slike (§37 image bomb protection). */
export const MAX_IMAGE_DIMENSION = 12000
/** Strop števila pikslov (12000×12000 bi bilo 144 MP — to preseže vsak smiselni zaslon; 40 MP je velikodušen strop za fotodokumentacijo). */
export const MAX_IMAGE_PIXELS = 40 * 1024 * 1024

/** Človeku berljiva imena vrst za fail-verbose napake. */
const MIME_LABELS: Record<UploadAllowedMime, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'application/pdf': 'PDF',
}

/**
 * Preberi vrsto vsebine iz magičnih bajtov. Vrne null, če glava ni
 * prepoznavna (klicatelj fail-closed).
 */
export function detectMimeFromBytes(bytes: Buffer): UploadAllowedMime | null {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return null
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  // JPEG: FF D8 FF (vsi JPEG spoji)
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  // WebP: "RIFF" @0 + "WEBP" @8
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  // PDF: "%PDF-"
  if (bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf'
  }
  return null
}

export interface ImageDimensions {
  width: number
  height: number
}

/**
 * Preberi dimenzije slike iz GLAVE (brez dekodiranja — poceni, deterministično).
 * Podprti kontejnerji: PNG (IHDR @16), JPEG (SOF0/SOF1/SOF2/… skeniranje oznak),
 * WebP (VP8/VP8L/VP8X chunk). Vrne null, če glave ne morem zanesljivo prebrati
 * (klicatelj odloči, ali je to napaka — za dovoljene vrste jo obravnavamo kot
 * nerazumljivo/pokvarjeno vsebino).
 */
export function readImageDimensions(bytes: Buffer): ImageDimensions | null {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return null
  const mime = detectMimeFromBytes(bytes)
  if (mime === 'image/png') return readPngDimensions(bytes)
  if (mime === 'image/jpeg') return readJpegDimensions(bytes)
  if (mime === 'image/webp') return readWebpDimensions(bytes)
  return null
}

/** PNG: IHDR je prvi chunk — širina @16, višina @20 (big-endian). */
function readPngDimensions(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 24) return null
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (width === 0 || height === 0) return null
  return { width, height }
}

/** JPEG: sprehod po oznakah do SOFn (0xFFC0–0xFFCF brez C4/C8/CC). */
function readJpegDimensions(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 4) return null
  let offset = 2
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      // SOI / TEM / RSTn — brez dolžinskega polja
      offset += 2
      continue
    }
    if (offset + 4 > bytes.length) return null
    const length = bytes.readUInt16BE(offset + 2)
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) {
      if (offset + 9 > bytes.length) return null
      const height = bytes.readUInt16BE(offset + 5)
      const width = bytes.readUInt16BE(offset + 7)
      if (width === 0 || height === 0) return null
      return { width, height }
    }
    if (length < 2) return null
    offset += 2 + length
  }
  return null
}

/** WebP: chunk glava @12 ("VP8 ", "VP8L", "VP8X"). */
function readWebpDimensions(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 30) return null
  const chunk = bytes.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') {
    // lossy: dimenzije @26 (little-endian, 14 bitov + znakovni bit)
    const width = bytes.readUInt16LE(26) & 0x3fff
    const height = bytes.readUInt16LE(28) & 0x3fff
    if (width === 0 || height === 0) return null
    return { width, height }
  }
  if (chunk === 'VP8L') {
    // lossless: 14 bitov širine-1 in višine-1 zaporedoma @21 (biti — beremo 4 bajte)
    const b = bytes.readUInt32LE(21)
    const width = (b & 0x3fff) + 1
    const height = ((b >> 14) & 0x3fff) + 1
    if (width === 0 || height === 0) return null
    return { width, height }
  }
  if (chunk === 'VP8X') {
    // extended: 24-bitna širina-1 @24, višina-1 @27
    const width = bytes.readUIntLE(24, 3) + 1
    const height = bytes.readUIntLE(27, 3) + 1
    if (width === 0 || height === 0) return null
    return { width, height }
  }
  return null
}

export type UploadValidation =
  | { ok: true; mime: UploadAllowedMime; dimensions: ImageDimensions | null }
  | { ok: false; reason: string }

/**
 * §37 glavna preverba: deklarirana vrsta vs. magični bajti vs. dovoljen
 * seznam vs. stropi dimenzij. Fail-closed — vsako zavrnitev spremlja
 * izrecen, človeku berljiv razlog (nikoli tihe degradacije).
 *
 * Poseben primer: `application/octet-stream` (splošna deklaracija) NI na
 * seznamu, ampak se izvede iz magičnih bajtov — če je vsebina prepoznana,
 * je sprejeta s PRAVO vrsto (klicatelj naj uporabi `mime` iz rezultata);
 * neznana vsebina pod splošno deklaracijo je ZAVRNJENA (prej bi šla skozi
 * kot octet-stream — vrzel).
 */
export function validateUploadContent(declaredMime: string, bytes: Buffer): UploadValidation {
  // 1) Splošna deklaracija → izvedi iz magičnih bajtov (brez ugibanja:
  //    prepoznana vsebina sprejeta, neznana odklonitena z razlogom).
  if (declaredMime === 'application/octet-stream') {
    const derived = detectMimeFromBytes(bytes)
    if (!derived) {
      return {
        ok: false,
        reason:
          'Vsebina ni prepoznavna po magičnih bajtih (deklarirano kot splošna octet-stream). ' +
          'Pričakovani so pravi PNG, JPEG, WebP ali PDF bajti.',
      }
    }
    return checkDimensions(derived, bytes)
  }
  // 2) Specifična deklaracija mora biti na zaprtem seznamu (SVG/HTML/GIF → tukaj).
  if (!UPLOAD_ALLOWED_MIMES.includes(declaredMime as UploadAllowedMime)) {
    return {
      ok: false,
      reason:
        `Vrsta vsebine »${declaredMime}« ni dovoljena (dovoljene: PNG, JPEG, WebP, PDF). ` +
        'SVG in HTML sta izrecno prepovedana (nosilca skript).',
    }
  }
  // 3) Magični bajti morajo prepoznati vsebino.
  const actual = detectMimeFromBytes(bytes)
  if (!actual) {
    return {
      ok: false,
      reason:
        `Vsebina ni prepoznavna po magičnih bajtih (deklarirano: ${MIME_LABELS[declaredMime as UploadAllowedMime]}). ` +
        'Pričakovani so pravi PNG, JPEG, WebP ali PDF bajti.',
    }
  }
  // 4) Deklaracija se mora ujemati z dejansko vsebino — klient ni zaupan.
  if (actual !== declaredMime) {
    return {
      ok: false,
      reason: `Vsebina se ne ujema z deklaracijo: prijavljeno ${MIME_LABELS[declaredMime as UploadAllowedMime]}, dejansko ${MIME_LABELS[actual]} (iz magičnih bajtov).`,
    }
  }
  return checkDimensions(actual, bytes)
}

/** Skupna slika/PDF zaključna preverba (stropi dimenzij iz glave). */
function checkDimensions(actual: UploadAllowedMime, bytes: Buffer): UploadValidation {
  // Slike: preveri dimenzije iz glave (image bomb zaščita).
  if (actual !== 'application/pdf') {
    const dimensions = readImageDimensions(bytes)
    if (!dimensions) {
      return {
        ok: false,
        reason: 'Slike ni mogoče zanesljivo prebrati dimenzij iz glave — vsebina je pokvarjena ali nestandardna.',
      }
    }
    if (
      dimensions.width > MAX_IMAGE_DIMENSION ||
      dimensions.height > MAX_IMAGE_DIMENSION ||
      dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
    ) {
      return {
        ok: false,
        reason:
          `Slika presega strop dimenzij (${dimensions.width}×${dimensions.height}; ` +
          `največ ${MAX_IMAGE_DIMENSION}px na stran oz. ${MAX_IMAGE_PIXELS / (1024 * 1024)} MP).`,
      }
    }
    return { ok: true, mime: actual, dimensions }
  }
  // PDF: vrsta je potrjena; strani preverja document-pdf jedro (R124).
  return { ok: true, mime: actual, dimensions: null }
}
