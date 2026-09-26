// R193 — EXIF/GPS stripping na strežniku (issue #5 §37, VARNOST.md ZAPRTA).
// ---------------------------------------------------------------------------
// Doslej je VARNOST.md iskreno dokumentiral vrzel: canvas data URI-ji so brez
// EXIF (brskalnik re-enkodira), neposredni API uploadi JPEG pa EXIF/GPS lahko
// ohranijo. sharp je izrecna odvisnost (package.json) — R193 zapre vrzel:
//   • stripExifJpeg: re-enkodiranje z rotate() (orientacija zapečena — slika
//     NE ostane nagnjena po brisanju EXIF), keepIccProfile() (barvni profil
//     ostane — brez tihe barvne premike), jpeg({ quality: 90 });
//   • fail-closed: dekodiranje ne uspe → { ok: false, reason } (klicatelj 400)
//     — NIKOLI tihi prehod originalnih bajtov;
//   • determinizem: isti vhod → identični izhodni bajti;
//   • ožičenje: /api/photos + /api/gallery (direktni JPEG poti); PNG poti
//     (sketchi, AR, podpisi) ostanejo validate-only (dokumentirana izbira).
// Testi uporabijo REALEN sharp: EXIF z GPS zapiše sharp (withExif), orientacijo
// pa trpljuže ročno sestavljen APP1 segment (TIFF SHORT tag 0x0112 = 6).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { stripExifJpeg } from '../exif-strip'
import { MAX_IMAGE_PIXELS } from '../upload-security'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

/** Čist 4×6 JPEG brez metapodatkov (deterministična vsebina). */
async function cistJpeg(width = 4, height = 6): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 80, b: 40 } } })
    .jpeg()
    .toBuffer()
}

/** JPEG z EXIF (IFD0 opis + IFD3 GPS) — zapisan z realnim sharp zapisovalnikom. */
async function exifGpsJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 6, channels: 3, background: { r: 120, g: 80, b: 40 } } })
    .withExif({
      IFD0: { ImageDescription: 'r193 exif test' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '46/1 3/1 0/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '14/1 30/1 0/1',
      },
    })
    .jpeg()
    .toBuffer()
}

/** Ročno sestavljen APP1 z Orientation SHORT=6, vstavljen takoj za SOI. */
async function orientiranJpeg(): Promise<Buffer> {
  const clean = await cistJpeg()
  const tiff = Buffer.concat([
    Buffer.from('II', 'ascii'),
    Buffer.from([0x2a, 0x00]),
    Buffer.from([0x08, 0x00, 0x00, 0x00]),
    Buffer.from([0x01, 0x00]), // 1 vnos
    Buffer.from([0x12, 0x01]), // tag 0x0112 Orientation
    Buffer.from([0x03, 0x00]), // tip SHORT
    Buffer.from([0x01, 0x00, 0x00, 0x00]), // count 1
    Buffer.from([0x06, 0x00, 0x00, 0x00]), // vrednost 6 (rotiraj 90° CW)
    Buffer.from([0x00, 0x00, 0x00, 0x00]), // naslednji IFD
  ])
  const payload = Buffer.concat([Buffer.from('Exif', 'ascii'), Buffer.from([0x00, 0x00]), tiff])
  const len = Buffer.alloc(2)
  len.writeUInt16BE(payload.length + 2)
  const segment = Buffer.concat([Buffer.from([0xff, 0xe1]), len, payload])
  return Buffer.concat([clean.subarray(0, 2), segment, clean.subarray(2)])
}

describe('R193 — stripExifJpeg (realen sharp)', () => {
  it('odstrani EXIF/GPS: izhod NIMA exif, dimenzije ostanejo', async () => {
    const withExif = await exifGpsJpeg()
    const before = await sharp(withExif).metadata()
    expect(before.exif).toBeTruthy() // predpogoj: EXIF res prisoten (vključno z GPS)

    const rez = await stripExifJpeg(withExif)
    expect(rez.ok).toBe(true)
    if (!rez.ok) return
    expect(rez.orientationApplied).toBe(false)
    expect(rez.width).toBe(4)
    expect(rez.height).toBe(6)

    const after = await sharp(rez.bytes).metadata()
    expect(after.exif).toBeUndefined() // EXIF/GPS odpadla
    expect(rez.bytes.toString('latin1').includes('Exif')).toBe(false) // brez APP1 Exif markerja
  })

  it('orientacija 6 → zapečena v piksle (W/H zamenana), EXIF odpade', async () => {
    const nagnjena = await orientiranJpeg()
    const before = await sharp(nagnjena).metadata()
    expect(before.orientation).toBe(6) // predpogog: slika je "nagnjena"

    const rez = await stripExifJpeg(nagnjena)
    expect(rez.ok).toBe(true)
    if (!rez.ok) return
    expect(rez.orientationApplied).toBe(true)
    expect(rez.width).toBe(6) // po zapečeni rotaciji sta dimenziji zamenani
    expect(rez.height).toBe(4)
    const after = await sharp(rez.bytes).metadata()
    expect(after.orientation ?? 1).toBe(1) // orientacija NI več v metapodatkih
    expect(after.exif).toBeUndefined()
  })

  it('čist JPEG brez EXIF → ok, re-enkodiran, brez exif (kanonizem za vse)', async () => {
    const cist = await cistJpeg()
    const rez = await stripExifJpeg(cist)
    expect(rez.ok).toBe(true)
    if (!rez.ok) return
    expect(rez.orientationApplied).toBe(false)
    expect(rez.width).toBe(4)
    expect(rez.height).toBe(6)
    const after = await sharp(rez.bytes).metadata()
    expect(after.exif).toBeUndefined()
  })

  it('fail-closed: pokvarjen JPEG (magični bajti OK, telo razbito) → ok:false z razlogom', async () => {
    const polomljen = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('r193 polomljena vsebina brez pravega JPEG telesa'.repeat(4), 'latin1'),
    ])
    const rez = await stripExifJpeg(polomljen)
    expect(rez.ok).toBe(false)
    if (rez.ok) return
    expect(rez.reason.length).toBeGreaterThan(10)
    expect(rez.reason).toContain('JPEG')
  })

  it('determinizem: isti vhod → identični izhodni bajti', async () => {
    const withExif = await exifGpsJpeg()
    const a = await stripExifJpeg(withExif)
    const b = await stripExifJpeg(withExif)
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(Buffer.compare(a.bytes, b.bytes)).toBe(0)
    expect(a.bytes.equals(withExif)).toBe(false) // re-enkodiranje je poteklo
  })
})

describe('R193 — ožičenje + politika (static)', () => {
  it('/api/photos in /api/gallery kličeta stripExifJpeg za image/jpeg', () => {
    const photos = srcOf('src/app/api/photos/route.ts')
    expect(photos).toContain("stripExifJpeg")
    expect(photos).toContain("parsedImage.mime === 'image/jpeg'")
    expect(photos).toContain('x-exif-stripped')
    const gallery = srcOf('src/app/api/gallery/route.ts')
    expect(gallery).toContain("stripExifJpeg")
    expect(gallery).toContain("parsed.mime === 'image/jpeg'")
  })

  it('PNG poti (sketchi, AR) ostanejo validate-only — brez stripa (dokumentirana izbira)', () => {
    expect(srcOf('src/app/api/sketches/route.ts')).not.toContain('stripExifJpeg')
    expect(srcOf('src/app/api/ar-snapshots/route.ts')).not.toContain('stripExifJpeg')
  })

  it('strop pikslov je ISTI §37 strop (MAX_IMAGE_PIXELS) — obramba v globini', () => {
    const lib = srcOf('src/lib/exif-strip.ts')
    expect(lib).toContain('MAX_IMAGE_PIXELS')
    expect(lib).toContain('keepIccProfile')
  })

  it('VARNOST.md §37 vrstica je posodobljena (ZAPRTA, ne odloženo)', () => {
    const varnost = srcOf('docs/VARNOST.md')
    expect(varnost).toContain('R193')
    expect(varnost).not.toMatch(/EXIF[^\n]*izrecno odloženo[^\n]*\|/)
  })

  it('UI: vidna politika zasebnosti (ShieldCheck vrstica + toast opomina)', () => {
    const tab = srcOf('src/components/roksal/photo-tab.tsx')
    expect(tab).toContain('EXIF/GPS metapodatki se pri nalaganju samodejno odstranijo')
    expect(tab).toContain('EXIF/GPS odstranjeno na strežniku')
    const galerija = srcOf('src/components/roksal/reference-gallery.tsx')
    expect(galerija).toContain('EXIF/GPS odstranjeno na strežniku')
  })
})
