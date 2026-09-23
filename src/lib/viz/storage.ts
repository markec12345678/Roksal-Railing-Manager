/**
 * VIZ — storage helperji (runda S+2). Spec: docs/VIZ_CONTRACTS.md
 *
 * Mape na disku:
 *   staging: public/viz/staging/<token>/  — začasne staged datoteke (ena klic = en token)
 *   projects: public/viz/projects/<id>/   — shranjeni projekti (kanonična imena datotek)
 *
 * Vse poti so relativne na process.cwd() (Next.js standalone/dev — public/ se
 * streže statično, zato so URL-ji '/viz/staging/...' in '/viz/projects/...').
 *
 * Varnost: token/id pridejo od klienta — vedno preverimo safe segment
 * (samo [A-Za-z0-9_-], brez pik, brez poti) pred uporabo v path.join.
 */
import { mkdir, rm, rename, copyFile, access, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,100}$/

/** Kanonična imena datotek po MVP spec (docs/VIZ_CONTRACTS.md). */
export const VIZ_FILE_NAMES = {
  original: 'original.jpg',
  product: 'product.jpg',
  productMask: 'product-mask.png',
  mask: 'mask.png',
  placement: 'placement.json',
  preview: 'preview.jpg',
  result: 'result.json',
} as const

function assertSafeSegment(segment: string, label: string): string {
  if (!SAFE_SEGMENT.test(segment)) {
    throw new Error(`Neveljaven ${label}`)
  }
  return segment
}

/** Koren viz podatkov: <cwd>/public/viz */
export function vizRootPath(): string {
  return path.join(process.cwd(), 'public', 'viz')
}

export function stagingRootPath(): string {
  return path.join(vizRootPath(), 'staging')
}

export function projectsRootPath(): string {
  return path.join(vizRootPath(), 'projects')
}

/** Ustvari staging + projects korena (po potrebi). */
export async function ensureVizDirs(): Promise<void> {
  await mkdir(stagingRootPath(), { recursive: true })
  await mkdir(projectsRootPath(), { recursive: true })
}

/** Mapa staged datotek za token (token je validiran). */
export function stagingDir(token: string): string {
  assertSafeSegment(token, 'staging token')
  return path.join(stagingRootPath(), token)
}

/** Mapa shranjenega projekta za id (id je validiran). */
export function projectDir(id: string): string {
  assertSafeSegment(id, 'projekt id')
  return path.join(projectsRootPath(), id)
}

/** Javni URL staged datoteke. */
export function publicStagingUrl(token: string, name: string): string {
  assertSafeSegment(token, 'staging token')
  return `/viz/staging/${token}/${name}`
}

/** Javni URL datoteke shranjenega projekta. */
export function publicProjectUrl(id: string, name: string): string {
  assertSafeSegment(id, 'projekt id')
  return `/viz/projects/${id}/${name}`
}

/** Ali pot obstaja (datoteka ali mapa). */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/** Rekurzivno kopiraj drevo map. */
async function copyTree(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyTree(srcPath, destPath)
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath)
    }
  }
}

/**
 * Premakni mapo (rename; ob EXDEV — npr. druga naprava — kopiraj + zbriši).
 */
export async function moveDir(src: string, dest: string): Promise<void> {
  try {
    await rename(src, dest)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'EXDEV') {
      await copyTree(src, dest)
      await rm(src, { recursive: true, force: true })
    } else {
      throw error
    }
  }
}

/** Kopiraj eno datoteko v ciljno mapo pod novim imenom. */
export async function copyFileInto(srcFile: string, destDir: string, name: string): Promise<void> {
  await mkdir(destDir, { recursive: true })
  await copyFile(srcFile, path.join(destDir, name))
}

/** Zbriši mapo (tolerantno, če ne obstaja). */
export async function removeDir(p: string): Promise<void> {
  await rm(p, { recursive: true, force: true })
}

/** Preberi in parsaj JSON datoteko; vrne null, če ne obstaja ali je pokvarjena. */
export async function readJsonFile<T>(p: string): Promise<T | null> {
  try {
    const raw = await readFile(p, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Zapiši JSON datoteko (pretty, 2 zamika). */
export async function writeJsonFile(p: string, data: unknown): Promise<void> {
  await writeFile(p, JSON.stringify(data, null, 2), 'utf8')
}
