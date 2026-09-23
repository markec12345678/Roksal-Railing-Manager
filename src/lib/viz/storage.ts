/**
 * VIZ — storage driver (runda S+3). Spec: docs/VIZ_CONTRACTS.md
 *
 * ENA abstrakcija, dva driverja — klicna koda ne ve, kateri teče:
 *   • `local` — datotečni sistem `public/viz/…` (dev/test v sandboxu; javni URL
 *     `/viz/…` se streže statično iz public/). Deluje tudi brez kakršnihkoli
 *     environment spremenljivk.
 *   • `blob`  — Vercel Blob (`@vercel/blob`, ključi = poti brez vodilnega
 *     poševnika). Trajno na Vercelu — filesystem na serverless je bralni.
 *
 * Izbira driverja: `VIZ_STORAGE_DRIVER=local|blob` preglasi; sicer `blob`,
 * če obstaja `BLOB_READ_WRITE_TOKEN`, sicer `local`.
 *
 * Ključi (kanonična imena datotek po MVP spec):
 *   viz/staging/<token>/<ime>      — začasne staged datoteke (ena klic = en token)
 *   viz/projects/<id>/<ime>        — shranjeni projekti (+ project.json v blob načinu)
 *   viz/render-jobs/<jobId>.json   — render job dokumenti (blob način)
 *
 * Varnost: token/id pridejo od klienta — vedno preverimo safe segment
 * (samo [A-Za-z0-9_-], brez pik, brez poti) pred uporabo v ključu/poti.
 */
import { mkdir, rm, copyFile, access, readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,100}$/
/** Imena datotek smejo imeti piko (original.jpg, project.json). */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/

/** Kanonična imena datotek po MVP spec (docs/VIZ_CONTRACTS.md). */
export const VIZ_FILE_NAMES = {
  original: 'original.jpg',
  product: 'product.jpg',
  productMask: 'product-mask.png',
  mask: 'mask.png',
  placement: 'placement.json',
  preview: 'preview.jpg',
  result: 'result.json',
  /** Blob način: metadata dokument projekta (local način = Prisma vrstica). */
  projectDoc: 'project.json',
} as const

/** Metadata dokumenti render jobov (blob način; local = Prisma). */
export const RENDER_JOBS_PREFIX = 'viz/render-jobs'

function assertSafeSegment(segment: string, label: string): string {
  if (!SAFE_SEGMENT.test(segment)) {
    throw new Error(`Neveljaven ${label}`)
  }
  return segment
}

// ── Ključi ───────────────────────────────────────────────────────────────────

/** Ključ staged datoteke. */
export function stagingKey(token: string, name: string): string {
  assertSafeSegment(token, 'staging token')
  if (!SAFE_NAME.test(name)) throw new Error('Neveljavno ime datoteke')
  return `viz/staging/${token}/${name}`
}

/** Ključ datoteke shranjenega projekta. */
export function projectKey(id: string, name: string): string {
  assertSafeSegment(id, 'projekt id')
  if (!SAFE_NAME.test(name)) throw new Error('Neveljavno ime datoteke')
  return `viz/projects/${id}/${name}`
}

/** Ključ metadata dokumenta render joba. */
export function renderJobKey(jobId: string): string {
  assertSafeSegment(jobId, 'render job id')
  return `${RENDER_JOBS_PREFIX}/${jobId}.json`
}

/** Prevera imena datoteke (izvožena za orodja/teste). */
export function assertSafeFileName(name: string): string {
  if (!SAFE_NAME.test(name)) throw new Error('Neveljavno ime datoteke')
  return name
}

/** Varnostna prevera za client-podan ključ (stagingKey/projectKey/output). */
export function assertSafeKey(key: string): string {
  if (!key.startsWith('viz/') || key.includes('..') || key.includes('\\')) {
    throw new Error('Neveljaven ključ shrambe')
  }
  for (const part of key.split('/')) {
    if (!part) continue
    if (SAFE_SEGMENT.test(part)) continue
    // imena datotek vsebujejo piko (original.jpg) — dovolimo pike znotraj segmenta
    if (/^[A-Za-z0-9_.-]{1,120}$/.test(part) && !part.startsWith('.')) continue
    throw new Error('Neveljaven ključ shrambe')
  }
  return key
}

// ── Izbira driverja ──────────────────────────────────────────────────────────

export type VizStorageMode = 'local' | 'blob'

/** Kateri driver teče (preglas: VIZ_STORAGE_DRIVER; sicer avtomatsko po tokenu). */
export function storageMode(): VizStorageMode {
  const forced = process.env.VIZ_STORAGE_DRIVER
  if (forced === 'blob' || forced === 'local') return forced
  return process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local'
}

/** Content-type po končnici (blob zahteva izrecen contentType pri put). */
export function contentTypeForName(name: string): string {
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

// ── Javni vmesnik (driver-agnostičen) ────────────────────────────────────────

export interface VizPutResult {
  key: string
  url: string
}

export interface VizListItem {
  key: string
  url: string
}

/**
 * S+4 — URL za KLIENTE: vedno skozi aplikacijo (`/api/viz/files/…`), kjer
 * ruta preveri sejo + lastništvo projekta. Surovi blob URL-ji nikoli ne gredo
 * k klientu (audit S+4: prej so bile fotografije balkona javno dostopne brez
 * avtentikacije — CORS `*`).
 *
 * Local način: `/viz/…` (statično iz public/, samo dev/test).
 */
export function clientUrlFor(key: string): string {
  if (storageMode() === 'blob') return `/api/viz/files/${key}`
  return `/${key}`
}

/**
 * S+4 — pretvori POLJUBNO shranjeno pot (zapuščinski surovi blob URL,
 * proxy pot ali local pot) v URL za kliente.
 */
export function clientUrlForPath(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('/api/viz/files/')) return path
  if (path.startsWith('http')) {
    const idx = path.indexOf('/viz/')
    if (idx >= 0) return `/api/viz/files${path.slice(idx)}`
    return path
  }
  return path
}

/** Napaka, če vizCreate zapiše pod ključ, ki že obstaja (atomic test-and-set). */
export class VizAlreadyExistsError extends Error {
  constructor(key: string) {
    super(`Ključ že obstaja: ${key}`)
    this.name = 'VizAlreadyExistsError'
  }
}

/**
 * S+4 — USTVARI datoteko SAMO, če ključ še ne obstaja (atomic test-and-set).
 *
 * To je edini resnično atomarni primitiv, ki ga shrambi nudita:
 *   • blob  — put BREZ allowOverwrite vrže napako "already exists", če ključ
 *     obstaja (obnašanje dokazano na produkciji v S+3).
 *   • local — writeFile s flag 'wx' (EEXIST, če datoteka obstaja).
 *
 * Uporaba: zaklepanje render jobov (sodobni update brez izgube zapisa).
 * Vrže VizAlreadyExistsError, če ključ že obstaja; druge napake so neujete.
 */
export async function vizCreate(
  key: string,
  data: Buffer,
  contentType?: string
): Promise<VizPutResult> {
  assertSafeKey(key)
  if (storageMode() === 'blob') {
    const { put } = await importBlob()
    try {
      const res = await put(key, data, {
        access: 'public',
        addRandomSuffix: false,
        // NAMERNO brez allowOverwrite → atomic create-if-not-exists.
        contentType: contentType ?? contentTypeForName(key),
      })
      return { key, url: clientUrlFor(key) }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.toLowerCase().includes('already exists')) throw new VizAlreadyExistsError(key)
      throw error
    }
  }
  const p = localPath(key)
  await mkdir(path.dirname(p), { recursive: true })
  try {
    await writeFile(p, data, { flag: 'wx' })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'EEXIST') throw new VizAlreadyExistsError(key)
    throw error
  }
  return { key, url: clientUrlFor(key) }
}

/** Zapiši datoteko pod ključ; vrne javni URL (relativen ali absoluten blob URL). */
export async function vizPut(
  key: string,
  data: Buffer,
  contentType?: string
): Promise<VizPutResult> {
  assertSafeKey(key)
  if (storageMode() === 'blob') {
    const { put } = await importBlob()
    const res = await put(key, data, {
      access: 'public',
      addRandomSuffix: false,
      // Isti ključ se legalno prepisuje: result.json/preview.jpg ob ponovnem
      // predogledu istega tokena, project.json ob preimenovanju, render job
      // ob prehodu queued → processing. Brez tega bi posodobitev metadata
      // vrgla "blob already exists" (najdeno na produkciji, S+3).
      allowOverwrite: true,
      contentType: contentType ?? contentTypeForName(key),
    })
    // S+4: klientom damo vedno proxy URL (avtorizacija na aplikaciji), ne
    // surovega blob URL-ja.
    return { key, url: clientUrlFor(key) }
  }
  const p = localPath(key)
  await mkdir(path.dirname(p), { recursive: true })
  await writeFile(p, data)
  return { key, url: `/${key}` }
}

/** Preberi datoteko; vrne null, če ne obstaja. */
export async function vizGet(key: string): Promise<Buffer | null> {
  assertSafeKey(key)
  if (storageMode() === 'blob') {
    try {
      const { head } = await importBlob()
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

/** Preberi in parsaj JSON; vrne null, če ne obstaja ali je pokvarjen. */
export async function vizGetJson<T>(key: string): Promise<T | null> {
  const buf = await vizGet(key)
  if (!buf) return null
  try {
    return JSON.parse(buf.toString('utf8')) as T
  } catch {
    return null
  }
}

/** Zapiši JSON (pretty, 2 zamika). */
export async function vizPutJson(key: string, data: unknown): Promise<VizPutResult> {
  return vizPut(key, Buffer.from(JSON.stringify(data, null, 2), 'utf8'), 'application/json')
}

/** Ali ključ obstaja. */
export async function vizHas(key: string): Promise<boolean> {
  assertSafeKey(key)
  if (storageMode() === 'blob') {
    try {
      const { head } = await importBlob()
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

/** Zbriši en ključ (tolerantno, če ne obstaja). */
export async function vizDel(key: string): Promise<void> {
  assertSafeKey(key)
  if (storageMode() === 'blob') {
    try {
      const { head, del } = await importBlob()
      const meta = await head(key)
      await del(meta.url)
    } catch {
      // ne obstaja — tolerantno
    }
    return
  }
  await rm(localPath(key), { force: true })
}

/** Zbriši VSE ključe pod predpono (npr. cel staging token ali cel projekt). */
export async function vizDelPrefix(prefix: string): Promise<void> {
  assertSafeKey(prefix.endsWith('/') ? prefix : `${prefix}/`)
  if (storageMode() === 'blob') {
    const { del, list } = await importBlob()
    let cursor: string | undefined
    do {
      const page = await list({ prefix, limit: 1000, cursor })
      if (page.blobs.length > 0) {
        await del(page.blobs.map((b) => b.url))
      }
      cursor = page.cursor
    } while (cursor)
    return
  }
  await rm(localPath(prefix), { recursive: true, force: true })
}

/** Naštej ključe pod predpono (rekurzivno). */
export async function vizList(prefix: string): Promise<VizListItem[]> {
  assertSafeKey(prefix.endsWith('/') ? prefix : `${prefix}/`)
  if (storageMode() === 'blob') {
    const { list } = await importBlob()
    const out: VizListItem[] = []
    let cursor: string | undefined
    do {
      const page = await list({ prefix, limit: 1000, cursor })
      out.push(...page.blobs.map((b) => ({ key: b.pathname, url: b.url })))
      cursor = page.cursor
    } while (cursor)
    return out
  }
  const root = localPath(prefix)
  const out: VizListItem[] = []
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile()) {
        const key = `${prefix}${path.relative(root, full).split(path.sep).join('/')}`
        out.push({ key, url: `/${key}` })
      }
    }
  }
  await walk(root)
  return out
}

export interface VizListItemWithTime extends VizListItem {
  /** Čas nastanka (blob = uploadedAt, local = mtime). */
  uploadedAt: Date
}

/**
 * S+4 — naštej ključe s časom nastanka (za staging GC).
 * Blob: list() vrača uploadedAt. Local: stat mtime.
 */
export async function vizListWithTimes(prefix: string): Promise<VizListItemWithTime[]> {
  assertSafeKey(prefix.endsWith('/') ? prefix : `${prefix}/`)
  if (storageMode() === 'blob') {
    const { list } = await importBlob()
    const out: VizListItemWithTime[] = []
    let cursor: string | undefined
    do {
      const page = await list({ prefix, limit: 1000, cursor })
      out.push(...page.blobs.map((b) => ({ key: b.pathname, url: b.url, uploadedAt: new Date(b.uploadedAt) })))
      cursor = page.cursor
    } while (cursor)
    return out
  }
  const items = await vizList(prefix)
  const { stat } = await import('node:fs/promises')
  const out: VizListItemWithTime[] = []
  for (const item of items) {
    try {
      const st = await stat(localPath(item.key))
      out.push({ ...item, uploadedAt: st.mtime })
    } catch {
      // izgubljen med branjem — izpusti
    }
  }
  return out
}

// ── Blob driver internals ────────────────────────────────────────────────────

/** Dinamični import — lokalni način ne sme zahtevati @vercel/blob ob zagonu. */
async function importBlob(): Promise<typeof import('@vercel/blob')> {
  return import('@vercel/blob')
}

// ── Local driver internals ───────────────────────────────────────────────────

/** Ključ → pot na disku: <cwd>/public/<ključ>. */
function localPath(key: string): string {
  return path.join(process.cwd(), 'public', key)
}

// ── Pomožniki (compat — uporabljajo jih testi in orodja) ────────────────────

/** Rekurzivno kopiraj drevo map (local način, orodja/backup). */
export async function copyTreeLocal(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyTreeLocal(srcPath, destPath)
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath)
    }
  }
}

/** Kopiraj datoteko znotraj iste shrambe (ključ → ključ), driver-agnostično. */
export async function vizCopy(srcKey: string, destKey: string): Promise<VizPutResult> {
  const data = await vizGet(srcKey)
  if (!data) throw new Error(`Manjka vir za kopiranje: ${srcKey}`)
  return vizPut(destKey, data, contentTypeForName(destKey))
}

/** Preostali fs pomočniki, ki jih (za zdaj) še uporabljajo orodja. */
export { mkdir, rm, access }
