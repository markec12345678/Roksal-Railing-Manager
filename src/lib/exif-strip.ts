// R193 (issue #5 §37 — EXIF/GPS stripping na strežniku)
// ---------------------------------------------------------------------------
// VARNOST.md §37 je doslej iskreno dokumentiral VRZEL: canvas data URI-ji so
// brez EXIF (brskalnik re-enkodira), NEPOSREDNI API uploadi JPEG pa EXIF/GPS
// lahko ohranijo (telefon vpiše koordinate). Strežniško stripanje je bilo
// izrecno odloženo, ker zahteva dekodiranje — sharp je ZDAJ izrecna
// odvisnost (package.json, prevzem lastnika dokumentiran v rundi), zato je
// vrzel zaprta z jasno politiko, NE tiho:
//
//   • Strpi se SAMO image/jpeg (izrecni §37 nosilec EXIF/GPS): re-enkodiranje
//     z .rotate() (EXIF orientacija zapečena v piksle — slika NI več
//     nagnjena po brisanju metapodatkov), .keepIccProfile() (barvni profil
//     ostane — brez tihe barvne premike), .jpeg({ quality: 90 }).
//   • PNG/WebP ostajata validate-only (dokumentirana izbira): PNG je
//     canvas-dominantna pot (že brez EXIF), lossless re-enkodiranje pa lahko
//     BLOATIRA velikost; EXIF v WebP je redkost brez terenske poti.
//   • Fail-closed: če dekodiranje ne uspe (pokvarjen/napačen JPEG, ki je
//     sicer prešel magične bajte), je upload ZAVRNJEN z izrecnim razlogom —
//     NIKOLI tihi prehod originalnih bajtov (brez utišanja, brez fabrikanterije).
//   • Determinizem: isti vhod → isti izhod (libvips je determinističen; brez
//     ur, brez naključij). Klicatelj shrani hash/velikost IZ STRIPANIH bajtov
//     — DB vedno opisuje TOČNO tisto, kar je v object storage.
//   • Stropi: limitInputPixels = MAX_IMAGE_PIXELS (isti §37 strop kot glava)
//     — obramba v globini, tudi če bi glava zavajala.
//
// Zunaj obsega (namenoma): PDF (ni slika), sketchi/AR/signature (PNG canvas),
// slike iz /api/gallery URL-vrednosti (gredo mimo bajtov).

import sharp from 'sharp'
import { MAX_IMAGE_PIXELS } from './upload-security'

/** Kvaliteta re-enkodiranja — vizualno prosojna za fotodokumentacijo. */
const JPEG_QUALITY = 90

export interface ExifStripSuccess {
  ok: true
  /** Stripani bajti za object storage (NI original). */
  bytes: Buffer
  /** EXIF orientacija je bila ≠ 1 in je zapečena z rotate() — W/H se lahko zamenata. */
  orientationApplied: boolean
  /** Dimenzije STRIPANE slike (po orientaciji) — klicatelj shrani te. */
  width: number
  height: number
}

export interface ExifStripFailure {
  ok: false
  /** Izrecen, človeku berljiv razlog (fail-verbose, nikoli tiho). */
  reason: string
}

export type ExifStripResult = ExifStripSuccess | ExifStripFailure

/**
 * Stripaj EXIF/GPS/IPTC/XMP (in vgrajen thumbnail) iz JPEG bajtov.
 * Orientation ≠ 1 se zapeče v piksle (rotate); ICC profil ostane.
 * Ne vrže napak — vrača { ok: false, reason } (klicatelj 400 z razlogom).
 */
export async function stripExifJpeg(bytes: Buffer): Promise<ExifStripResult> {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    return { ok: false, reason: 'EXIF strip: prazni ali neveljavni bajti.' }
  }
  try {
    const input = sharp(bytes, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    })
    const meta = await input.metadata()
    const orientation = meta.orientation ?? 1
    const output = await sharp(bytes, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    })
      .rotate() // EXIF orientacija → piksli (brez nje bi slika po stripanju stala nagnjena)
      .keepIccProfile() // barvni profil ostane — brez tihe barvne premike
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer()
    const outMeta = await sharp(output).metadata()
    return {
      ok: true,
      bytes: output,
      orientationApplied: orientation !== 1,
      width: outMeta.width ?? 0,
      height: outMeta.height ?? 0,
    }
  } catch (error) {
    return {
      ok: false,
      reason:
        'JPEG ni mogoče dekodirati za čiščenje metapodatkov (pokvarjena ali nestandardna vsebina). ' +
        `Detail: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
