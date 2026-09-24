/**
 * R121 — Object storage za glavno aplikacijo (fotografije, skice, AR posnetki,
 * PDF artefakti). Spec: issue #7 + docs/STORAGE.md.
 *
 * NAČELA (iz lastniške revizije, Problems 5/6):
 *   • DB hrani SAMO metadata (storageKey, mime, sizeBytes, sha256, createdAt);
 *     bajti živijo v object storage.
 *   • Adapter je backend-agnostičen — EN vmesnik, DVA driverja:
 *       – `local` — datotečni sistem `<STORAGE_LOCAL_ROOT | .storage>/files/…`
 *         (dev/test v sandboxu). Datoteke NISO pod public/ — statično
 *         streženje je nemogoče, dostop vedno skozi avtorizirano
 *         /api/files ruto (za razliko od viz lokalnega načina).
 *       – `blob` — Vercel Blob (`@vercel/blob`, ključi `files/…`); klienti
 *         NIKOLI ne dobijo surovega blob URL-ja, vedno proxy
 *         `/api/files/…` (isti varnostni vzorc kot viz S+4).
 *   • SHA-256 računamo ob ZAPISU (crypto) — vsak artefakt je sledljiv in
 *     preverljiv (pravna integriteta PDF, dedup osnova).
 *   • Fail-closed: pisanje brez driverja NE pade na "samo DB zapis" — vrže
 *     napako. Klicna ruta mora transakcijo odjaviti.
 *
 * Ključi (kanonični prostor):
 *   files/photos/<photoId>/slika.jpg
 *   files/sketches/<sketchId>/skica.png
 *   files/ar-snapshots/<snapshotId>/posnetek.png
 *   files/gallery/<galleryItemId>/pred.jpg | po.jpg
 *   files/documents/<documentId>/v<version>.pdf
 *   files/signatures/<signatureAuditId>/podpis.png
 *
 * OgrajaVizija (src/lib/viz/*) je NEDOTAKNJENA — to je ločen modul z ločenim
 * prostorom ključev (viz/…), svojim driver-jem in lastnim namenom.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile, access, stat } from 'node:fs/promises'
import path from 'node:path'

/** Varnostna prevera segmenta ključa: brez pik-pik, brez ločil poti. */
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/

/** Dovoljeni prostori ključev (resource del). */
const RESOURCES = ['photos', 'sketches', 'ar-snapshots', 'gallery', 'documents', 'signatures'] as const
export type StorageResource = (typeof RESOURCES)[number]

/** Ključ mora biti files/<resource>/<id>/<ime>. */
export function assertSafeObjectKey(key: string): string {
  const parts = key.split('/')
  if (parts.length !== 4 || parts[0] !== 'files') {
    throw new Error(`Neveljaven ključ shrambe: ${key}`)
  }
  const [, resource, id, name] = parts
  if (!RESOURCES.includes(resource as StorageResource)) {
    throw new Error(`Neveljaven resource v ključu: ${resource}`)
  }
  for (const segment of [id, name]) {
    if (!SAFE_SEGMENT.test(segment)) {
      throw new Error(`Neveljaven segment ključa: ${segment}`)
    }
  }
  return key
}

/** Sestavi ključ iz kanoničnih delov (preveri varnost). */
export function objectKey(resource: StorageResource, id: string, name: string): string {
  return assertSafeObjectKey(`files/${resource}/${id}/${name}`)
}

/** Razčleni ključ nazaj na kanonične dele (za avtorizacijo na /api/files). */
export function parseObjectKey(key: string): { resource: StorageResource; id: string; name: string } | null {
  try {
    assertSafeObjectKey(key)
  } catch {
    return null
  }
  const [, resource, id, name] = key.split('/')
  return { resource: resource as StorageResource, id, name }
}

// ── Izbira driverja ───────────────────────────────────────────────────────────

export type ObjectStorageMode = 'local' | 'blob'

/**
 * Kateri driver teče:
 *   • preglašena z `OBJECT_STORAGE_DRIVER=local|blob`;
 *   • sicer `blob`, če obstaja `BLOB_READ_WRITE_TOKEN` (produkcija);
 *   • sicer `local` (dev/test).
 */
export function objectStorageMode(): ObjectStorageMode {
  const forced = process.env.OBJECT_STORAGE_DRIVER
  if (forced === 'blob' || forced === 'local') return forced
  return process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local'
}

/** Lokalni koren (NISO pod public/ — streži izključno /api/files). */
function localRoot(): string {
  return process.env.STORAGE_LOCAL_ROOT ?? path.join(process.cwd(), '.storage')
}

function localPath(key: string): string {
  return path.join(localRoot(), key)
}

/** Content-type po končnici imena (blob zahteva izrecen contentType). */
export function contentTypeForName(name: string): string {
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}

/** URL za KLIENTE: vedno skozi avtorizirano aplikacijsko ruto. */
export function objectUrlFor(key: string): string {
  return `/api/files/${key}`
}

// ── Javni vmesnik ─────────────────────────────────────────────────────────────

export interface PutObjectResult {
  key: string
  /** SHA-256 bajtov (hex). */
  sha256: string
  sizeBytes: number
  /** Proxy URL za kliente (/api/files/…), nikoli surov blob URL. */
  url: string
}

/** SHA-256 Buffer-ja (hex) — uporablja tudi orodja/testi za preverjanje. */
export function sha256Of(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Zapiši objekt pod ključ. Povoji obstoječi ključ (isti record id = isti
 * artefakt; verzioniranje dokumentov dela NOVE ključe v<N>.pdf).
 * Vrne metadata + proxy URL. Fail-closed: napaka driverja gre klicatelju.
 */
export async function putObject(
  key: string,
  data: Buffer,
  contentType?: string
): Promise<PutObjectResult> {
  assertSafeObjectKey(key)
  if (data.length === 0) throw new Error('Prazen objekt ni dovoljen')
  const sha256 = sha256Of(data)
  if (objectStorageMode() === 'blob') {
    const { put } = await import('@vercel/blob')
    await put(key, data, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: contentType ?? contentTypeForName(key),
    })
  } else {
    const p = localPath(key)
    await mkdir(path.dirname(p), { recursive: true })
    await writeFile(p, data)
  }
  return { key, sha256, sizeBytes: data.length, url: objectUrlFor(key) }
}

/** Preberi bajte; null, če ne obstaja (klicatelj odloči o politiki). */
export async function getObject(key: string): Promise<Buffer | null> {
  if (!key.startsWith('files/')) return null
  if (objectStorageMode() === 'blob') {
    try {
      const { head } = await import('@vercel/blob')
      const meta = await head(key)
      const res = await fetch(meta.url, { cache: 'no-store' })
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    } catch {
      return null
    }
  }
  try {
    return await readFile(localPath(key))
  } catch {
    return null
  }
}

/** Ali objekt obstaja. */
export async function hasObject(key: string): Promise<boolean> {
  if (!key.startsWith('files/')) return false
  if (objectStorageMode() === 'blob') {
    try {
      const { head } = await import('@vercel/blob')
      await head(key)
      return true
    } catch {
      return false
    }
  }
  try {
    await access(localPath(key))
    return true
  } catch {
    return false
  }
}

/** Zbriši objekt (tolerantno do neobstoječega — brisanje je idempotentno). */
export async function deleteObject(key: string): Promise<void> {
  if (!key.startsWith('files/')) return
  if (objectStorageMode() === 'blob') {
    try {
      const { head, del } = await import('@vercel/blob')
      const meta = await head(key)
      await del(meta.url)
    } catch {
      // ne obstaja — tolerantno (idempotenca brisanja)
    }
    return
  }
  await rm(localPath(key), { force: true })
}

// ── Data URI pomožniki (rute sprejemajo data URI iz klientov) ────────────────

/** Poišči extiz končnico iz mime (za imena artefaktov). */
export function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'application/pdf':
      return 'pdf'
    default:
      return 'bin'
  }
}

export interface ParsedDataUri {
  bytes: Buffer
  mime: string
}

/**
 * Razčleni data URI (`data:image/png;base64,…`) ALI surovi base64.
 * Vrne null, če vhod ni prepoznaven base64 (fail-closed: klicatelj vrže 400).
 * Omejitev velikosti: maxBytes (privzeto 15 MB) — zaščita pred zalogo DB/diska.
 */
export function parseDataUri(input: string, maxBytes = 15 * 1024 * 1024): ParsedDataUri | null {
  if (typeof input !== 'string' || input.length === 0) return null
  let mime = 'application/octet-stream'
  let b64 = input
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(input)
  if (match) {
    mime = match[1]
    b64 = match[2]
  } else if (/^data:/i.test(input)) {
    // nepodprti data URI parametri (brez base64) — zavrnemo
    return null
  }
  if (b64.length % 4 !== 0) {
    // base64 mora biti poravnan; nekateri klienti pošiljajo URL-safe — ne sprejemamo
    return null
  }
  const bytes = Buffer.from(b64, 'base64')
  if (bytes.length === 0 || bytes.length > maxBytes) return null
  // Vračunaj mime iz magičnih bajtov, če je bil splošen (varnost: mime za serving)
  if (mime === 'application/octet-stream') {
    if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) mime = 'image/png'
    else if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) mime = 'image/jpeg'
    else if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp'
    else if (bytes.length > 5 && bytes.toString('ascii', 0, 5) === '%PDF-') mime = 'application/pdf'
  }
  return { bytes, mime }
}

/** Lokalna stat pomožnika za orodja/backup. */
export async function objectStatLocal(key: string): Promise<{ sizeBytes: number } | null> {
  try {
    const st = await stat(localPath(key))
    return { sizeBytes: st.size }
  } catch {
    return null
  }
}

/**
 * Izpiši vse ključe pod `files/` prefixom (GC orodje + integritetna preverba).
 * local: rekurzivni sprehod po disku; blob: @vercel/blob list (paginirano).
 * Vrne samo ključe iz dovoljenih resource prostorov (signatures vključeno).
 */
export async function listObjects(prefix = 'files/'): Promise<string[]> {
  if (objectStorageMode() === 'blob') {
    const { list } = await import('@vercel/blob')
    const out: string[] = []
    let cursor: string | undefined = undefined
    do {
      const page = await list({ prefix, cursor, limit: 1000 })
      for (const b of page.blobs) {
        const parsed = parseObjectKey(b.pathname)
        if (parsed) out.push(b.pathname)
      }
      cursor = page.cursor
    } while (cursor)
    return out.sort()
  }
  const rootDir = path.join(localRoot(), 'files')
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        await walk(full)
      } else if (e.isFile()) {
        const rel = path.relative(localRoot(), full).split(path.sep).join('/')
        const parsed = parseObjectKey(rel)
        if (parsed) out.push(rel)
      }
    }
  }
  await walk(rootDir)
  return out.sort()
}
