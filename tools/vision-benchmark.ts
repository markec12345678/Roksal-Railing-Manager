/**
 * R118-REAL — VISION BENCHMARK NAD PRAVIMI TERENSKIMI FOTOGRAFIJAMI
 * (issues #8 + #11 §14).
 * ---------------------------------------------------------------------------
 * Sintetični benchmark (tools/measurement-benchmark.ts) NE dokazuje obnašanja
 * na pravih kamerah (washout, senca, realen šum). To orodje požene
 * deterministično CV analizo (analyzeScene) nad PRAVIMI fotografijami in
 * pripravi poročilo za ROČNO SPREJEMBO lastnika — SAMODEJNI pass/fail na
 * realnih fotkah se NE izmišljuje (issue #8: "ročna sprejemba").
 *
 * VHOD (repozitorni pristop — fotke ne gredo v git):
 *   benchmarks/vision-real/manifest.json   — scenariji + pričakovanja
 *   benchmarks/vision-real/*.jpg|png       — fotografije (lokalno, gitignored)
 *
 * Manifest format:
 * {
 *   "scenarios": [
 *     { "file": "raven-balkon-01.jpg", "scenario": "raven-balkon",
 *       "expect": { "railing": true, "minPosts": 3 },
 *       "ownerAccepted": null, "notes": "" }
 *   ]
 * }
 *
 * IZHOD:
 *   - konzolno poročilo (na scenarij: elementi, kakovost, opozorila);
 *   - HARD zakoni (exit 1): manjkajoče datoteke, pokvarjen manifest,
 *     neveljavna slika — INFRASTRUKTURA mora biti brez napak;
 *   - MEHKA ocena: expect polje se IZPIŠE kot "udosanjeno/NE udosanjeno"
 *     informacija za ročno sprejembo; exit code NI vezan na to
 *     (dokumentirano: ročna sprejemba je obvezna — docs/MEASUREMENT-QUALITY.md).
 *
 * Zagon:
 *   bun tools/vision-benchmark.ts            # poročilo v konzolo
 *   bun tools/vision-benchmark.ts --json     # stroga JSON poročila
 *
 * Ni AI, ni naključja. Analiza je deterministična (enaka slika → enak hash).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { analyzeScene } from '../src/lib/cv-studio/scene'
import type { SceneAnalysis } from '../src/lib/cv-studio/types'

const ROOT = path.join(process.cwd(), 'benchmarks', 'vision-real')
const JSON_OUT = process.argv.includes('--json')

interface Scenario {
  file: string
  scenario: string
  expect?: { railing?: boolean; minPosts?: number; stair?: boolean; obstacle?: boolean }
  ownerAccepted?: boolean | null
  notes?: string
}

async function decode(file: string) {
  const buf = readFileSync(file)
  const raw = await sharp(buf)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    data: new Uint8ClampedArray(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength),
    w: raw.info.width,
    h: raw.info.height,
  }
}

function summarize(a: SceneAnalysis) {
  const count = (t: string) => a.elements.filter((e) => e.type === t).length
  return {
    sessionId: a.sessionId.slice(0, 12) + '…',
    railing: count('RAILING'),
    balconyEdge: count('BALCONY_EDGE'),
    posts: count('RAILING_POST'),
    stairs: count('STAIR'),
    stairEdges: count('STAIR_EDGE'),
    obstacles: count('OBSTACLE'),
    quality: {
      brightness: a.quality.brightness,
      contrast: a.quality.contrast,
      sharpness: a.quality.sharpness,
      noise: a.quality.noiseEstimate,
      usable: a.quality.usable,
    },
    warnings: a.warnings,
    guidance: a.guidance,
  }
}

async function main(): Promise<number> {
  console.log('=== R118-REAL — vision benchmark nad pravimi fotografijami ===')
  if (!existsSync(ROOT)) {
    console.error(`Manjka mapa ${ROOT} — ustvari jo in dodaj fotografije + manifest.json (glej header tega orodja).`)
    console.error('Status: ŠČAKA LASTNIKOVE FOTKE (issue #8 — ročna sprejemba).')
    return 0
  }
  const manifestPath = path.join(ROOT, 'manifest.json')
  if (!existsSync(manifestPath)) {
    console.error(`Manjka ${manifestPath} — manifest je obvezen.`)
    return 1
  }
  let manifest: { scenarios: Scenario[] }
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (e) {
    console.error('Pokvarjen manifest.json:', e instanceof Error ? e.message : e)
    return 1
  }
  if (!Array.isArray(manifest.scenarios) || manifest.scenarios.length === 0) {
    console.error('Manifest nima scenarijev.')
    return 1
  }

  const files = new Set(readdirSync(ROOT))
  const report: Array<Record<string, unknown>> = []
  let infraErrors = 0
  let softMatched = 0
  let softTotal = 0

  for (const sc of manifest.scenarios) {
    if (!sc.file || !files.has(sc.file)) {
      console.error(`[INFRA NAPAKA] datoteka "${sc.file}" iz manifesta ne obstaja v ${ROOT}`)
      infraErrors++
      report.push({ scenario: sc.scenario, file: sc.file, error: 'missing-file' })
      continue
    }
    try {
      const img = await decode(path.join(ROOT, sc.file))
      const analysis = analyzeScene(img)
      const s = summarize(analysis)

      // MEHKA ocena (informacija za ročno sprejembo — NE exit code)
      let matched: string[] = []
      const un: string[] = []
      const exp = sc.expect ?? {}
      if (exp.railing !== undefined) {
        softTotal++
        if ((s.railing > 0) === exp.railing) matched.push('railing')
        else un.push(`railing (pričakovano ${exp.railing}, dobljeno ${s.railing > 0})`)
      }
      if (exp.minPosts !== undefined) {
        softTotal++
        if (s.posts >= exp.minPosts) matched.push(`posts>=${exp.minPosts}`)
        else un.push(`posts (pričakovano ≥${exp.minPosts}, dobljeno ${s.posts})`)
      }
      if (exp.stair !== undefined) {
        softTotal++
        if ((s.stairs > 0) === exp.stair) matched.push('stair')
        else un.push(`stair (pričakovano ${exp.stair}, dobljeno ${s.stairs > 0})`)
      }
      if (exp.obstacle !== undefined) {
        softTotal++
        if ((s.obstacles > 0) === exp.obstacle) matched.push('obstacle')
        else un.push(`obstacle (pričakovano ${exp.obstacle}, dobljeno ${s.obstacles > 0})`)
      }
      softMatched += matched.length

      const hash = createHash('sha256').update(JSON.stringify(analysis)).digest('hex').slice(0, 12)
      report.push({ scenario: sc.scenario, file: sc.file, hash, ...s, expectMatched: matched, expectUnmatched: un, ownerAccepted: sc.ownerAccepted ?? null, notes: sc.notes ?? '' })
      console.log(`\n[${sc.scenario}] ${sc.file} (hash ${hash})`)
      console.log(`  pasovi=${s.railing} robovi=${s.balconyEdge} stebri=${s.posts} stopnice=${s.stairs} ovire=${s.obstacles}`)
      console.log(`  kakovost: svetlost=${s.quality.brightness} kontrast=${s.quality.contrast} ostrost=${s.quality.sharpness} šum=${s.quality.noise} uporabna=${s.quality.usable}`)
      if (matched.length) console.log(`  udosanjeno: ${matched.join(', ')}`)
      if (un.length) console.log(`  NE udosanjeno (ROČNO PREGLEJ): ${un.join(', ')}`)
      console.log(`  vodstvo: ${s.guidance.nextAction}`)
    } catch (e) {
      console.error(`[INFRA NAPAKA] ${sc.file}:`, e instanceof Error ? e.message : e)
      infraErrors++
      report.push({ scenario: sc.scenario, file: sc.file, error: e instanceof Error ? e.message : String(e) })
    }
  }

  console.log(`\n=== Povzetek === scenariji=${manifest.scenarios.length} infraNapake=${infraErrors} mehkoUdosanjeno=${softMatched}/${softTotal}`)
  console.log('OPOMBA: realne fotografije se NE ocenjujejo samodejno uspešno — ročna sprejemba lastnika je obvezna (issue #8).')
  if (JSON_OUT) console.log('JSON:\n' + JSON.stringify(report, null, 2))
  return infraErrors > 0 ? 1 : 0
}

main().then((code) => process.exit(code))
