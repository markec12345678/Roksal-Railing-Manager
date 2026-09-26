// R149 — testi (issue #5 §37 — Upload security).
// ---------------------------------------------------------------------------
//   • Lib determinizem: detectMimeFromBytes (PNG/JPEG/WebP/PDF magija),
//     readImageDimensions (glava brez dekodiranja — PNG IHDR, JPEG SOF,
//     WebP VP8/VP8L/VP8X), validateUploadContent matrika:
//       – dovoljene vrste z ujemajočo vsebino → ok;
//       – deklaracija ≠ bajti → zavrnitev z OBEJMA imenoma (klient ni zaupan);
//       – SVG/HTML/GIF → zavrnitev (zaprto dovoljen seznam — nosilci skript);
//       – octet-stream + neznana vsebina → zavrnitev (vrzel prej);
//       – image bomb (13000px PNG, 30000px JPEG, WebP VP8X) → zavrnitev;
//       – pokvarjena/truncirana glava → zavrnitev (ni tihega sprejemanja).
//   • POST /api/photos: JPEG-deklaracija nad PNG bajti → 400 + NIČ zapisano
//     (nobena vrstica, nič v shrambi), octet-stream nad neznanimi bajti →
//     400, SVG data URI → 400, prevelika dimenzija → 400, veljaven PNG →
//     201 (local driver), anon → 401.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R148).
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as photosPost } from '@/app/api/photos/route'
import {
  detectMimeFromBytes,
  readImageDimensions,
  validateUploadContent,
  UPLOAD_ALLOWED_MIMES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
} from '@/lib/upload-security'
import { parseDataUri } from '@/lib/object-storage'

const BASE = 'http://localhost/api'

// 1×1 PNG (magični bajti 89 50 4E 47 …) — determinističen fixture.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

// Sintetični JPEG: SOI + APP0 (JFIF) + SOF0 (višina 2, širina 3) + EOI.
const JPEG_TINY = Buffer.concat([
  Buffer.from([0xff, 0xd8]), // SOI
  Buffer.from([0xff, 0xe0, 0x00, 0x10]), // APP0, dolžina 16
  Buffer.from('JFIF\0'), // identifikator
  Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]), // verzija/enote/gostota
  Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08]), // SOF0, dolžina 17, natančnost 8
  Buffer.from([0x00, 0x02]), // višina = 2
  Buffer.from([0x00, 0x03]), // širina = 3
  Buffer.from([0x03]), // št. komponent
  Buffer.from([0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]), // komponente
  Buffer.from([0xff, 0xd9]), // EOI
])

// Sintetični WebP VP8X (extended): RIFF + WEBP + VP8X + zastavice + 24-bit širina/višina.
function webpVp8x(widthMinus1: number, heightMinus1: number): Buffer {
  const buf = Buffer.alloc(30)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(22, 4)
  buf.write('WEBP', 8, 'ascii')
  buf.write('VP8X', 12, 'ascii')
  buf.writeUInt32LE(10, 16)
  buf.writeUInt32LE(0, 20) // zastavice/rezerva
  buf.writeUIntLE(widthMinus1, 24, 3)
  buf.writeUIntLE(heightMinus1, 27, 3)
  return buf
}

// Sintetični PNG s podanim IHDR (širina/višina) — za stropne in pokvarjene primere.
function pngIhdr(width: number, height: number, truncate = false): Buffer {
  const ihdr = Buffer.alloc(21) // 4 len + 4 'IHDR' + 13 data
  ihdr.writeUInt32BE(13, 0)
  ihdr.write('IHDR', 4, 'ascii')
  ihdr.writeUInt32BE(width, 8)
  ihdr.writeUInt32BE(height, 12)
  ihdr[16] = 8 // bitna globina
  ihdr[17] = 6 // RGBA
  const out = Buffer.concat([PNG_1PX.subarray(0, 8), ihdr])
  return truncate ? out.subarray(0, 20) : out
}

const HTML_BYTES = Buffer.from('<!DOCTYPE html><script>alert(1)</script>')
const SVG_BYTES = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
const GIF_BYTES = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00])

function jsonReq(
  reqPath: string,
  token: string | null,
  init: { method?: string; body?: unknown } = {},
): Request {
  return new Request(`${BASE}${reqPath}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

// ── Lib: detectMimeFromBytes ────────────────────────────────────────────────

describe('R149 §37 detectMimeFromBytes (magični bajti)', () => {
  it('prepozna PNG, JPEG, WebP in PDF glave', () => {
    expect(detectMimeFromBytes(PNG_1PX)).toBe('image/png')
    expect(detectMimeFromBytes(JPEG_TINY)).toBe('image/jpeg')
    expect(detectMimeFromBytes(webpVp8x(1, 1))).toBe('image/webp')
    expect(detectMimeFromBytes(Buffer.from('%PDF-1.7 nebilo'))).toBe('application/pdf')
  })

  it('vrne null za HTML, SVG, GIF, naključne in prazne bajte', () => {
    expect(detectMimeFromBytes(HTML_BYTES)).toBeNull()
    expect(detectMimeFromBytes(SVG_BYTES)).toBeNull()
    expect(detectMimeFromBytes(GIF_BYTES)).toBeNull()
    expect(detectMimeFromBytes(Buffer.from('naključni bajti'))).toBeNull()
    expect(detectMimeFromBytes(Buffer.alloc(0))).toBeNull()
  })

  it('determinizem: isti vhod → ista vrsta (100-krat)', () => {
    const first = detectMimeFromBytes(PNG_1PX)
    for (let i = 0; i < 100; i++) expect(detectMimeFromBytes(PNG_1PX)).toBe(first)
  })
})

// ── Lib: readImageDimensions (glava brez dekodiranja) ──────────────────────

describe('R149 §37 readImageDimensions (iz glave, brez dekodiranja)', () => {
  it('PNG IHDR: 1×1', () => {
    expect(readImageDimensions(PNG_1PX)).toEqual({ width: 1, height: 1 })
  })

  it('JPEG SOF0: 3×2 (sintetična glava)', () => {
    expect(readImageDimensions(JPEG_TINY)).toEqual({ width: 3, height: 2 })
  })

  it('WebP VP8X: prebere 24-bit širino in višino', () => {
    expect(readImageDimensions(webpVp8x(1919, 1079))).toEqual({ width: 1920, height: 1080 })
  })

  it('trunciran PNG (<24 bajtov) → null; PDF → null (ni slika)', () => {
    expect(readImageDimensions(pngIhdr(1, 1, true))).toBeNull()
    expect(readImageDimensions(Buffer.from('%PDF-1.7'))).toBeNull()
  })

  it('determinizem: isti vhod → iste dimenzije (100-krat)', () => {
    const first = readImageDimensions(JPEG_TINY)
    for (let i = 0; i < 100; i++) expect(readImageDimensions(JPEG_TINY)).toEqual(first)
  })
})

// ── Lib: validateUploadContent (matrika) ───────────────────────────────────

describe('R149 §37 validateUploadContent (fail-closed matrika)', () => {
  it('dovoljene vrste z ujemajočo vsebino → ok', () => {
    expect(validateUploadContent('image/png', PNG_1PX)).toEqual({
      ok: true,
      mime: 'image/png',
      dimensions: { width: 1, height: 1 },
    })
    expect(validateUploadContent('image/jpeg', JPEG_TINY)).toEqual({
      ok: true,
      mime: 'image/jpeg',
      dimensions: { width: 3, height: 2 },
    })
    const pdf = validateUploadContent('application/pdf', Buffer.from('%PDF-1.7 test'))
    expect(pdf.ok).toBe(true)
    if (pdf.ok) expect(pdf.dimensions).toBeNull() // PDF ni slika — ni dimenzij
  })

  it('deklaracija ≠ bajti → zavrnitev z OBEJMA imenoma', () => {
    const r1 = validateUploadContent('image/jpeg', PNG_1PX)
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.reason).toContain('JPEG')
    if (!r1.ok) expect(r1.reason).toContain('PNG')
    const r2 = validateUploadContent('image/png', JPEG_TINY)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.reason).toContain('prijavljeno PNG')
    if (!r2.ok) expect(r2.reason).toContain('dejansko JPEG')
  })

  it('SVG in HTML sta izrecno zavrnjena (nosilca skript) — tudi z pravimi SVG bajti', () => {
    expect(validateUploadContent('image/svg+xml', SVG_BYTES).ok).toBe(false)
    expect(validateUploadContent('text/html', HTML_BYTES).ok).toBe(false)
    // Zlonamerni poskus: HTML bajti prikriti kot PNG → magija ne ujema → zavrnitev
    expect(validateUploadContent('image/png', HTML_BYTES).ok).toBe(false)
  })

  it('GIF in nepoznane vrste niso na dovoljenem seznamu', () => {
    expect(validateUploadContent('image/gif', GIF_BYTES).ok).toBe(false)
    expect(validateUploadContent('application/zip', Buffer.from('PK\x03\x04')).ok).toBe(false)
  })

  it('octet-stream: neznana vsebina → zavrnitev (vrzel prej), PNG bajti prek parseDataUri izpeljani → ok', () => {
    const unknown = validateUploadContent('application/octet-stream', Buffer.from('nekaj nepoznanega'))
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.reason).toContain('prepoznavna')
    // Klicateljska pot: parseDataUri izvede mime iz magije, nato preverba potrdi.
    const parsed = parseDataUri(PNG_1PX.toString('base64'))
    expect(parsed!.mime).toBe('image/png')
    expect(validateUploadContent(parsed!.mime, parsed!.bytes).ok).toBe(true)
  })

  it('image bomb: PNG 13000px, JPEG 30000px, WebP VP8X nad stropom → zavrnitev', () => {
    const r1 = validateUploadContent('image/png', pngIhdr(MAX_IMAGE_DIMENSION + 1, 1))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.reason).toContain('strop dimenzij')
    expect(validateUploadContent('image/png', pngIhdr(1, MAX_IMAGE_DIMENSION + 1)).ok).toBe(false)

    const hugeJpeg = Buffer.from(JPEG_TINY)
    hugeJpeg.writeUInt16BE(30000, 27) // SOF0 @20: širina @+7 → 30000
    expect(validateUploadContent('image/jpeg', hugeJpeg).ok).toBe(false)

    // VP8X: 12000×12000 = 144 MP > 40 MP strop
    expect(validateUploadContent('image/webp', webpVp8x(12000 - 1, 12000 - 1)).ok).toBe(false)
    // 40 MP ravnokar pod stropom (8000×5000 = 40.96 MP? NE — 8000×5000 = 40M ≤ 41.94M stropa)
    const okEdge = validateUploadContent('image/webp', webpVp8x(8000 - 1, 5000 - 1))
    expect(okEdge.ok).toBe(true)
    // VP8 lossy z 0 dimenzijo (pokvarjeno) → glava neberljiva → zavrnitev
    const vp8Zero = Buffer.alloc(30)
    vp8Zero.write('RIFF', 0, 'ascii')
    vp8Zero.writeUInt32LE(22, 4)
    vp8Zero.write('WEBP', 8, 'ascii')
    vp8Zero.write('VP8 ', 12, 'ascii')
    vp8Zero.writeUInt32LE(14, 16)
    vp8Zero.writeUInt32LE(0, 20) // frame tag
    vp8Zero[23] = 0x9d; vp8Zero[24] = 0x01; vp8Zero[25] = 0x2a // sync
    vp8Zero.writeUInt16LE(0, 26) // širina 0
    vp8Zero.writeUInt16LE(1, 28)
    const r0 = validateUploadContent('image/webp', vp8Zero)
    expect(r0.ok).toBe(false)
    if (!r0.ok) expect(r0.reason).toContain('dimenzij')
  })

  it('pokvarjena/truncirana slika z veljavno magijo → zavrnitev (ni tihega sprejemanja)', () => {
    const r = validateUploadContent('image/png', pngIhdr(1, 1, true))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('dimenzij')
  })

  it('determinizem: ista matrika 100-krat → isti rezultati', () => {
    const snapshot = [
      validateUploadContent('image/png', PNG_1PX),
      validateUploadContent('image/jpeg', PNG_1PX),
      validateUploadContent('text/html', HTML_BYTES),
      validateUploadContent('image/png', pngIhdr(MAX_IMAGE_DIMENSION + 1, 1)),
    ]
    for (let i = 0; i < 100; i++) {
      expect([
        validateUploadContent('image/png', PNG_1PX),
        validateUploadContent('image/jpeg', PNG_1PX),
        validateUploadContent('text/html', HTML_BYTES),
        validateUploadContent('image/png', pngIhdr(MAX_IMAGE_DIMENSION + 1, 1)),
      ]).toEqual(snapshot)
    }
  })

  it('dovoljen seznam je zaprt in dokumentiran (4 vrste)', () => {
    expect(UPLOAD_ALLOWED_MIMES).toEqual(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
    expect(MAX_IMAGE_DIMENSION).toBe(12000)
    expect(MAX_IMAGE_PIXELS).toBe(40 * 1024 * 1024)
  })
})

// ── Ruta: POST /api/photos (integracija) ───────────────────────────────────

// Local object storage na tmp korenu (vzorec object-storage.test.ts).
const TMP = mkdtempSync(path.join(tmpdir(), 'roksal-r149-'))
beforeAll(() => {
  process.env.OBJECT_STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_ROOT = TMP
})
afterAll(() => {
  rmSync(TMP, { recursive: true, force: true })
})

async function makeProject(tag: string): Promise<string> {
  const customer = await db.customer.create({
    data: { ime: `Stranka ${tag}`, naslov: 'Test 1' },
  })
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: `Projekt ${tag}` },
  })
  return project.id
}

describe('R149 §37 POST /api/photos — vsebina se preveri', () => {
  it('anon brez seje → 401', async () => {
    const res = await photosPost(jsonReq('/photos', null, { method: 'POST', body: {} }))
    expect(res.status).toBe(401)
  })

  it('JPEG deklaracija nad PNG bajti → 400 z izrecnim razlogom, NIČ zapisano', async () => {
    const { token } = await createTestUserWithSession(`r149-sec-a-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(`r149-sec-a-${Date.now()}`)
    const res = await photosPost(
      jsonReq('/photos', token, {
        method: 'POST',
        body: {
          projectId,
          kategorija: 'MED',
          imageData: `data:image/jpeg;base64,${PNG_1PX.toString('base64')}`,
        },
      }),
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('prijavljeno JPEG')
    expect(data.error).toContain('dejansko PNG')
    const rows = await db.projectPhoto.count({ where: { projectId } })
    expect(rows).toBe(0)
  })

  it('HTML bajti prikriti kot PNG → 400 (skriptni nosilec ne gre skozi)', async () => {
    const { token } = await createTestUserWithSession(`r149-sec-b-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(`r149-sec-b-${Date.now()}`)
    const res = await photosPost(
      jsonReq('/photos', token, {
        method: 'POST',
        body: {
          projectId,
          imageData: `data:image/png;base64,${HTML_BYTES.toString('base64')}`,
        },
      }),
    )
    expect(res.status).toBe(400)
    // HTML nima prave magične glave → zavrnitev kot neprepoznana vsebina
    // (striktna veja: dejansko PNG-bajti bi šli v primerjavo deklaracij).
    expect((await res.json()).error).toContain('prepoznavna')
  })

  it('octet-stream nad neznanimi bajti → 400 (vrzel prej)', async () => {
    const { token } = await createTestUserWithSession(`r149-sec-c-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(`r149-sec-c-${Date.now()}`)
    const res = await photosPost(
      jsonReq('/photos', token, {
        method: 'POST',
        body: {
          projectId,
          imageData: Buffer.from('naključna nepoznana vsebina').toString('base64'),
        },
      }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('prepoznavna')
  })

  it('image bomb PNG (13001px) → 400 z stropom v razlogu', async () => {
    const { token } = await createTestUserWithSession(`r149-sec-d-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(`r149-sec-d-${Date.now()}`)
    const bomb = pngIhdr(MAX_IMAGE_DIMENSION + 1, 1)
    const res = await photosPost(
      jsonReq('/photos', token, {
        method: 'POST',
        body: {
          projectId,
          imageData: `data:image/png;base64,${bomb.toString('base64')}`,
        },
      }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('strop dimenzij')
    const rows = await db.projectPhoto.count({ where: { projectId } })
    expect(rows).toBe(0)
  })

  it('veljaven PNG → 201, vrstica + object storage vsebina', async () => {
    const stamp = `r149-sec-e-${Date.now()}`
    const { token } = await createTestUserWithSession(`r149-sec-e-${Date.now()}`, 'VODJA')
    const projectId = await makeProject(stamp)
    const res = await photosPost(
      jsonReq('/photos', token, {
        method: 'POST',
        body: {
          projectId,
          kategorija: 'PRED',
          opomba: `r149 veljavna ${stamp}`,
          imageData: `data:image/png;base64,${PNG_1PX.toString('base64')}`,
        },
      }),
    )
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.mime).toBe('image/png')
    expect(data.storageKey).toMatch(/^files\/photos\//)
    const rows = await db.projectPhoto.count({ where: { projectId } })
    expect(rows).toBe(1)
  })
})
