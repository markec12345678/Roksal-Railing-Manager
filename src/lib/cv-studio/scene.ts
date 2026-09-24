/**
 * CV STUDIO SDK — scene understanding (issues #10 + #11 §2).
 *
 * DETERMINISTIČNI CEVOVOD (brez AI):
 *   slika → siva → downscale → Sobel → Otsu robovi → dilacija
 *   → Hough → [reuse detectFeatures: runs/posts/corners]
 *   → diagonalne družine (stopniščni predlogi)
 *   → povezane komponente v pasu (predlogi ovir)
 *
 * PONOVNA UPORABA (issue #10: "ponovno uporabi obstoječe ... namesto
 * podvajanja"): primitivi iz @/lib/measurement/cv + kanonične značilke
 * prek detectFeatures (ISTE strukture kot Measurement SDK) + povezane
 * komponente iz @/lib/viz/imageops (čista funkcija — modul viz NI spremenjen).
 *
 * ISKRENOST: semantične površine (FLOOR/GROUND/WALL/OPENING/DOOR) CV NE
 * predlaga — deterministično niso zanesljive; ostanejo ročna označitev.
 * Stopnice/ovire so predlogi z NEEDS_CONFIRMATION, nikoli potrjene resnice.
 */
import { createHash } from 'node:crypto'
import type { ImageBuffer } from '@/lib/viz/types'
import { connectedComponents } from '@/lib/viz/imageops'
import {
  edgesFromGradient,
  dilate1,
  houghPeaks,
  houghTransform,
  sobel,
  toWorkGray,
  type GrayImage,
  type GradientImage,
} from '@/lib/measurement/cv'
import { MEASUREMENT_CONSTANTS } from '@/lib/measurement'
import { detectFeatures } from '@/lib/measurement/detect'
import { assessImageQuality, round4 } from './quality'
import {
  AUTO_SCENE_TYPES,
  SCENE_ALGORITHM_VERSION,
  type SceneAnalysis,
  type SceneElement,
  type SceneElementType,
} from './types'

export class SceneValidationError extends Error {
  readonly code: string
  constructor(message: string, code = 'INVALID_IMAGE') {
    super(message)
    this.name = 'SceneValidationError'
    this.code = code
  }
}

/** Diagonalni kotni pas (ni horizontalen ±12°, ni vertikalen ±12°). */
function isDiagonalTheta(thetaDeg: number): boolean {
  const horiz = Math.abs(thetaDeg - 90) <= 12
  const vert = thetaDeg <= 12 || thetaDeg >= 168
  return !horiz && !vert
}

/** Kot linearnih točk (determinističen pretvorbe ρ' nazaj v px). */
function diagonalEndpoints(
  thetaDeg: number,
  rhoPx: number,
  w: number,
  h: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const th = (thetaDeg * Math.PI) / 180
  const cosT = Math.cos(th)
  const sinT = Math.sin(th)
  const pts: Array<[number, number]> = []
  // presek z x=0 in x=w (če sinT ≠ 0)
  if (Math.abs(sinT) > 1e-9) {
    const y0 = rhoPx / sinT
    const y1 = (rhoPx - w * cosT) / sinT
    if (y0 >= -1 && y0 <= h + 1) pts.push([0, y0])
    if (y1 >= -1 && y1 <= h + 1) pts.push([w, y1])
  }
  // presek z y=0 in y=h (če cosT ≠ 0)
  if (Math.abs(cosT) > 1e-9) {
    const x0 = rhoPx / cosT
    const x1 = (rhoPx - h * sinT) / cosT
    if (x0 >= -1 && x0 <= w + 1) pts.push([x0, 0])
    if (x1 >= -1 && x1 <= w + 1) pts.push([x1, h])
  }
  if (pts.length < 2) return null
  // najdaljši par po kvadratu razdalje — deterministično
  let best = pts[0]
  let bestB = pts[1]
  let bestD = -1
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i][0] - pts[j][0]
      const dy = pts[i][1] - pts[j][1]
      const d = dx * dx + dy * dy
      if (d > bestD) {
        bestD = d
        best = pts[i]
        bestB = pts[j]
      }
    }
  }
  return { x0: best[0], y0: best[1], x1: bestB[0], y1: bestB[1] }
}

interface DiagonalPeak {
  thetaDeg: number
  rhoPx: number
  votes: number
}

/**
 * Stopniščne družine: ≥3 vzporednih diagonalnih črt z nenaključno
 * pravilnim ρ razmakom (std/mean ≤ 0.35). Vrne predloge z
 * NEEDS_CONFIRMATION — NIKOLI potrjene stopnice.
 */
function detectStairFamilies(
  bin: Uint8Array,
  w: number,
  h: number,
): Array<{ edges: DiagonalPeak[]; thetaDeg: number }> {
  const hs = houghTransform(bin, w, h, 1)
  let maxVotes = 0
  for (let i = 0; i < hs.acc.length; i++) maxVotes = Math.max(maxVotes, hs.acc[i])
  if (maxVotes === 0) return []

  const peaks = houghPeaks(hs, Math.max(6, Math.round(maxVotes * 0.15)), MEASUREMENT_CONSTANTS.maxHoughPeaks * 2)

  // diagonalni vrhovi, razvrščeni v 5° košare
  const buckets = new Map<number, DiagonalPeak[]>()
  for (const p of peaks) {
    const thetaDeg = (p.thetaIdx * 180) / hs.thetaBins
    if (!isDiagonalTheta(thetaDeg)) continue
    const votes = p.votes
    if (votes < Math.max(6, maxVotes * 0.25)) continue
    const bucket = Math.round(thetaDeg / 5) * 5
    const list = buckets.get(bucket) ?? []
    list.push({ thetaDeg, rhoPx: p.rhoIdx - hs.rhoOffset, votes })
    buckets.set(bucket, list)
  }

  const families: Array<{ edges: DiagonalPeak[]; thetaDeg: number }> = []
  for (const [bucket, list] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    if (list.length < 3) continue
    const sorted = [...list].sort((a, b) => a.rhoPx - b.rhoPx)
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].rhoPx - sorted[i - 1].rhoPx)
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const variance = gaps.reduce((s, g) => s + (g - mean) * (g - mean), 0) / gaps.length
    const std = Math.sqrt(variance)
    const regular = mean >= 8 && mean <= 0.5 * Math.min(w, h) && std / mean <= 0.35
    if (!regular) continue
    families.push({ edges: sorted, thetaDeg: bucket })
  }
  return families
}

/**
 * Predlogi ovir: povezane komponente robov znotraj glavnega pasu, IZVEN
 * stolpcev zaznanih stebrov. Komponenta = ovira le, če je dovolj velika
 * in ni tanka vertikalna linija (to bi bil izpuščen steber).
 */
function detectObstacles(
  bin: Uint8Array,
  w: number,
  h: number,
  yTopPx: number,
  yBottomPx: number,
  postXsPx: number[],
): Array<{ x0: number; y0: number; x1: number; y1: number; density: number }> {
  const bandTop = Math.round(yTopPx + (yBottomPx - yTopPx) * 0.1)
  const bandBottom = Math.round(yBottomPx - (yBottomPx - yTopPx) * 0.1)
  if (bandBottom - bandTop < 4) return []

  // maska: samo pas, brez stolpcev stebrov (±18 px)
  const mask = new Uint8Array(w * h)
  for (let y = bandTop; y <= bandBottom; y++) {
    for (let x = 0; x < w; x++) {
      if (!bin[y * w + x]) continue
      let nearPost = false
      for (const px of postXsPx) {
        if (Math.abs(x - px) <= 18) {
          nearPost = true
          break
        }
      }
      if (!nearPost) mask[y * w + x] = 1
    }
  }

  const { labels, sizes, count } = connectedComponents(mask, w, h)
  const bandArea = (bandBottom - bandTop + 1) * w
  const minSize = Math.max(40, Math.round(bandArea * 0.0015))

  const comps: Array<{ x0: number; y0: number; x1: number; y1: number; size: number }> = []
  for (let id = 1; id <= count; id++) {
    if (sizes[id - 1] < minSize) continue
    let x0 = w
    let y0 = h
    let x1 = 0
    let y1 = 0
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] !== id) continue
      const x = i % w
      const y = (i / w) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    const compW = x1 - x0 + 1
    const compH = y1 - y0 + 1
    // tanka vertikalna linija = izpuščen rob stebra, NE ovira
    if (compW <= 4 && compH >= (bandBottom - bandTop) * 0.5) continue
    comps.push({ x0, y0, x1, y1, size: sizes[id - 1] })
  }

  // največ 6 največjih (tie-break: y, nato x — deterministično)
  comps.sort((a, b) => b.size - a.size || a.y0 - b.y0 || a.x0 - b.x0)
  return comps.slice(0, 6).map((c) => ({
    x0: c.x0,
    y0: c.y0,
    x1: c.x1,
    y1: c.y1,
    density: c.size / Math.max(1, (c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1)),
  }))
}

/** Urejen seznam tipov (determinističen izpis). */
const TYPE_ORDER: SceneElementType[] = [...AUTO_SCENE_TYPES]

/** Id zaznave — determinističen. */
function elementId(type: SceneElementType, seq: number): string {
  const slug = type.toLowerCase().replace(/_/g, '-')
  return `${slug}-${String(seq).padStart(2, '0')}`
}

/**
 * Polna deterministična analiza prizora (issue #10/#11).
 * Enak vhod → bajtno enak izhod (sessionId = sha256 pikslov).
 */
export function analyzeScene(img: ImageBuffer): SceneAnalysis {
  // 1) Validacija vhoda (fail-closed)
  if (!Number.isInteger(img.w) || !Number.isInteger(img.h) || img.w <= 0 || img.h <= 0) {
    throw new SceneValidationError('Neveljavne dimenzije slike.')
  }
  const expected = img.w * img.h * 4
  if (!img.data || img.data.length !== expected) {
    throw new SceneValidationError(
      `Neveljavna dolžina pikselnega pramena (${img.data?.length ?? 0} ≠ ${expected}).`,
    )
  }

  // 2) Determinističen session id = sha256 vhodnih pikslov
  const sessionId = createHash('sha256')
    .update(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength))
    .digest('hex')

  // 3) Delovna slika + robovi (isti cevovod kot Measurement SDK)
  const gray: GrayImage = toWorkGray({ data: img.data, w: img.w, h: img.h })
  const grad: GradientImage = sobel(gray)
  const bin = dilate1(edgesFromGradient(grad), gray.w, gray.h)

  // 4) Kanonične značilke (REUSE detectFeatures — kompatibilno s confirm API)
  const detection = detectFeatures({
    frames: [{ data: img.data, w: img.w, h: img.h }],
  })

  // 5) Kakovost (dopolni metrike z detection rezultatom)
  const quality = assessImageQuality(gray, grad)
  quality.metrics = detection.metrics

  const warnings: string[] = [...quality.reasons]
  // opozorila kakovosti (svetloba/šum/ostrost) — dodaj, če še niso
  if (quality.brightness < 0.08) {
    warnings.push('Zelo temna slika — zaznava je lahko nezanesljiva; pričakuj ročni popravek.')
  } else if (quality.brightness > 0.92) {
    warnings.push('Zelo svetla (prežgana) slika — zaznava je lahko nezanesljiva; pričakuj ročni popravek.')
  }

  const elements: SceneElement[] = []
  const features = detection.features

  if (features) {
    const run = features.runs[0]
    const yTopPx = run.yTop * gray.h
    const yBottomPx = run.yBottom * gray.h
    const x0Px = run.x0 * gray.w
    const x1Px = run.x1 * gray.w

    // RAILING: glavni pas (geometrija trdna, semantika = predlog)
    elements.push({
      id: elementId('RAILING', 1),
      type: 'RAILING',
      state: 'PROPOSED',
      geometry: {
        kind: 'band',
        yTop: round4(run.yTop),
        yBottom: round4(run.yBottom),
        x0: round4(run.x0),
        x1: round4(run.x1),
      },
      support: round4((run.supportTop + run.supportBottom) / 2),
      warnings: ['Semantiko (ograja) potrdi uporabnik.'],
    })

    // BALCONY_EDGE: spodnja črta glavnega pasu
    elements.push({
      id: elementId('BALCONY_EDGE', 1),
      type: 'BALCONY_EDGE',
      state: 'PROPOSED',
      geometry: {
        kind: 'line',
        pos: round4(run.yBottom),
        from: round4(run.x0),
        to: round4(run.x1),
        thetaDeg: 90,
      },
      support: round4(run.supportBottom),
      warnings: ['Rob balkona = predlog; končna geometrija je potrjena meritev.'],
    })

    // RAILING_POST: posamezni stebri
    for (let i = 0; i < features.posts.length; i++) {
      const post = features.posts[i]
      elements.push({
        id: elementId('RAILING_POST', i + 1),
        type: 'RAILING_POST',
        state: 'PROPOSED',
        geometry: {
          kind: 'line',
          pos: round4(post.x),
          from: round4(run.yTop),
          to: round4(run.yBottom),
          thetaDeg: 0,
        },
        support: round4(post.support),
        warnings: [],
      })
    }

    // OBSTACLE: komponente znotraj pasu, izven stolpcev stebrov
    const postXsPx = features.posts.map((p) => p.x * gray.w)
    const obstacles = detectObstacles(bin, gray.w, gray.h, yTopPx, yBottomPx, postXsPx)
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i]
      elements.push({
        id: elementId('OBSTACLE', i + 1),
        type: 'OBSTACLE',
        state: 'NEEDS_CONFIRMATION',
        geometry: {
          kind: 'bbox',
          x0: round4(o.x0 / gray.w),
          y0: round4(o.y0 / gray.h),
          x1: round4(o.x1 / gray.w),
          y1: round4(o.y1 / gray.h),
        },
        support: round4(Math.min(1, o.density)),
        warnings: ['Ovira = predlog (prekrivanje); potrdi ali odstrani ročno.'],
      })
    }
    if (obstacles.length > 0) {
      warnings.push(`Zaznanih ${obstacles.length} predlog(ov) ovir — prekrivanje lahko vpliva na zaznave.`)
    }

    // perspektivni predlog (kotniki glavnega run-a)
    if (features.corners) {
      warnings.push('Kotniki zaznani — perspektivna predbljiža je možna. To NI dokaz mere.')
    }
  } else {
    warnings.push('Ni zaznane ograjne strukture (pas z dvema vzporednima črtama).')
  }

  // 6) Stopnice: diagonalne družine (vedno NEEDS_CONFIRMATION)
  const stairFamilies = detectStairFamilies(bin, gray.w, gray.h)
  let stairSeq = 0
  for (const fam of stairFamilies) {
    stairSeq++
    const endpoints = fam.edges
      .map((e) => diagonalEndpoints(e.thetaDeg, e.rhoPx, gray.w, gray.h))
      .filter((e): e is NonNullable<typeof e> => e !== null)
    if (endpoints.length === 0) continue
    let bx0 = gray.w
    let by0 = gray.h
    let bx1 = 0
    let by1 = 0
    for (const e of endpoints) {
      bx0 = Math.min(bx0, e.x0, e.x1)
      by0 = Math.min(by0, e.y0, e.y1)
      bx1 = Math.max(bx1, e.x0, e.x1)
      by1 = Math.max(by1, e.y0, e.y1)
    }
    const maxVotes = fam.edges.reduce((m, e) => Math.max(m, e.votes), 1)
    elements.push({
      id: elementId('STAIR', stairSeq),
      type: 'STAIR',
      state: 'NEEDS_CONFIRMATION',
      geometry: {
        kind: 'bbox',
        x0: round4(bx0 / gray.w),
        y0: round4(by0 / gray.h),
        x1: round4(bx1 / gray.w),
        y1: round4(by1 / gray.h),
      },
      support: round4(fam.edges.reduce((s, e) => s + e.votes / maxVotes, 0) / fam.edges.length),
      warnings: [
        `Družina ${fam.edges.length} vzporednih diagonalnih črt (θ≈${fam.thetaDeg}°) — možne stopnice. POTRDI ali odstrani.`,
      ],
    })
    for (let i = 0; i < endpoints.length; i++) {
      const e = endpoints[i]
      const line = fam.edges[i]
      elements.push({
        id: elementId('STAIR_EDGE', i + 1),
        type: 'STAIR_EDGE',
        state: 'NEEDS_CONFIRMATION',
        geometry: {
          kind: 'line',
          pos: round4(line.rhoPx / Math.max(gray.w, gray.h)),
          from: round4(Math.min(e.x0, e.x1) / gray.w),
          to: round4(Math.max(e.x0, e.x1) / gray.w),
          thetaDeg: round4(line.thetaDeg),
        },
        support: round4(line.votes / maxVotes),
        warnings: ['Stopniščna linija = predlog; potrdi/popravi ročno.'],
      })
    }
    warnings.push(`Stopniščni predlog (${fam.edges.length} linij, θ≈${fam.thetaDeg}°) — potrebna potrditev.`)
  }

  // 7) Deterministična ureditev + id-ji
  const orderOf = (t: SceneElementType): number => {
    const i = TYPE_ORDER.indexOf(t)
    return i === -1 ? TYPE_ORDER.length : i
  }
  elements.sort((a, b) => {
    const o = orderOf(a.type) - orderOf(b.type)
    if (o !== 0) return o
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  // ponovna dodelitev id-jev po sortu (brez dvojnikov)
  const counters = new Map<string, number>()
  for (const el of elements) {
    const slug = el.type.toLowerCase().replace(/_/g, '-')
    const n = (counters.get(slug) ?? 0) + 1
    counters.set(slug, n)
    el.id = `${slug}-${String(n).padStart(2, '0')}`
  }

  // 8) Usmerjanje (iskreno, brez ugibanja)
  const guidance = features
    ? {
        seen: `Ograjni pas + ${features.posts.length} stebrov${stairFamilies.length > 0 ? ` + ${stairFamilies.length} stopniščnih predlogov` : ''}.`,
        missing: 'Potrditve zaznav + referenčna mera (absolutne mm brez nje NISO mogoče).',
        nextAction:
          'Potrdi/odstrani predloge, popravi geometrijo ročno, nato vpiši referenčno mero in potrdi meritev prek obstoječe verige.',
      }
    : {
        seen: 'Ni zanesljive ograjne strukture.',
        missing: 'Jasen horizontalni pas ograje (dve vzporedni črti).',
        nextAction: 'Posnemi jasnejšo fotografijo ali začni v ročnem načinu — CV neuspeh NE blokira projekta.',
      }

  return {
    version: 1,
    algorithmVersion: SCENE_ALGORITHM_VERSION,
    sessionId,
    image: {
      width: img.w,
      height: img.h,
      workWidth: gray.w,
      workHeight: gray.h,
    },
    elements,
    features,
    quality,
    perspectiveHint: features?.corners != null,
    warnings,
    guidance,
  }
}
