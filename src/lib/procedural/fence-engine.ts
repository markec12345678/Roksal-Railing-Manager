/**
 * PROCEDURAL FENCE ENGINE (S+7 §7, §8) — deterministični renderer ograde
 * iz produktnega profila.
 *
 * KLJUČNO PRAVILO (spec §8 — "NE USTVARJAJ AI OGRAD"):
 *   Število desk, dimenzije, razmaki, oblika, orientacija = IZKLJUČNO
 *   deterministična geometrija iz kataloga (data/roksal-catalog.json).
 *   NIČ v tem modulu ne uporablja naključja, AI ali uravnavanja "po občutku".
 *   Enak vhod → enak izhod (bajtno identičen RGBA pomnilniški vsebinski rezultat).
 *
 * Perspektiva (spec §7 "perspektivo"): ta modul renderira ortogonalno
 * čelno ograjo v ciljno pravokotno razmerje. Perspektivo balkona določa
 * izključno 4-točkovni placement (vogali = edini vir geometrije) prek
 * DOKAZANE homografije v A-pipeline (src/lib/viz/homography.ts, NI spremenjen).
 *
 * Material (spec §6): ločeno od geometrije —
 *   'color'   = izmerjena/izkatalogizirana barva (približek, dokumentiran)
 *   'texture' = vzorčenje realne produktne fotografije po determinističnem
 *               preslikavalu (brez naključja).
 */

import { getProduct, type CatalogProfile, type Orientation } from '../product-catalog'

// ---------- Vhodi ----------

export interface FenceMaterialColor {
  kind: 'color'
  /** RGB 0–255 — izmerjen približek odtenka (nima uradnega statusa). */
  rgb: [number, number, number]
}

export interface FenceMaterialTexture {
  kind: 'texture'
  /** Realna produkt/tekstura fotografija (RGBA ImageBuffer). */
  texture: ImageBuffer
  /**
   * 'scan' = deske vzorčijo zaporedne pasove teksture čez celotno višino
   * (deterministično, brez ponavljanja); 'tile' = ponavljanje po modulu.
   */
  mode: 'scan' | 'tile'
}

export type FenceMaterial = FenceMaterialColor | FenceMaterialTexture

export interface FencePost {
  /** Širina stebra v mm (alu steber). */
  widthMm: number
  /** Središča stebrov v mm od levega roba ograje. */
  positionsMm: number[]
}

export interface FenceRequest {
  productId: string
  orientation: Orientation
  /** Širina ograjnega polja v mm (realni svet). */
  fenceWidthMm: number
  /** Višina ograjnega polja v mm (realni svet). */
  fenceHeightMm: number
  /** Razmak med deskami v mm — mora biti znotraj priporočila profila. */
  gapMm: number
  material: FenceMaterial
  /** Izhodna resolucija v px (celotno polje). */
  outWidthPx: number
  outHeightPx: number
  /** Opcijski stebri (deterministične pozicije podane klicatelju odgovorni entiteti). */
  posts?: FencePost | null
  /** Vrhnji ročaj — samo če profil podpira (katalog). */
  handle?: boolean
  /** Če ni podan, se išče v katalogu po productId. */
  profileOverride?: CatalogProfile
}

// ---------- Geometrija (EDINI vir števila desk/razmakov — spec §8) ----------

export interface FenceBoard {
  /** Indeks od spodaj (horizontal) / od leve (vertical), 0-based. */
  index: number
  /** Začetek vidne ploskvice v mm (od spodaj/levo). */
  startMm: number
  /** Vidna višina/širina ploskvice v mm (po rezanju). */
  visibleMm: number
  /** true = zadnja deska je odrezana na poljubno dolžino (katalog: "se lahko reže"). */
  cut: boolean
}

export interface FenceLayout {
  productId: string
  profile: string
  orientation: Orientation
  faceWidthMm: number
  gapMm: number
  pitchMm: number
  fenceWidthMm: number
  fenceHeightMm: number
  /** Ograjno polje (brez ročaja) v mm. */
  fieldHeightMm: number
  boardCount: number
  boards: FenceBoard[]
  handleHeightMm: number
  handlePresent: boolean
  /** Dolžina smeri zlaganja desk v mm (višina pri horizontal, širina pri vertical). */
  fieldSpanMm: number
  /** Opozorila determinističnega razporeda (npr. razmak izven priporočila). */
  warnings: string[]
}

/**
 * Izračuna deterministični razpored desk. Enak vhod → enak izhod (čista funkcija).
 * Pravilo: deske se zlagajo od spodaj (horizontal) / od leve (vertical),
 * zadnja deska se po potrebi odreže (katalog: "se lahko reže na poljubne dolžine").
 */
export function computeFenceLayout(req: FenceRequest): FenceLayout {
  const profile = req.profileOverride ?? getProduct(req.productId)
  if (!profile) throw new Error(`procedural: neznan productId "${req.productId}"`)
  if (!(req.fenceWidthMm > 0) || !(req.fenceHeightMm > 0)) {
    throw new Error('procedural: fenceWidthMm/fenceHeightMm morata biti > 0')
  }
  if (!(req.gapMm >= 0)) throw new Error('procedural: gapMm >= 0')

  const warnings: string[] = []
  const face = profile.faceWidthMm
  const gap = req.gapMm
  const pitch = face + gap

  // Ročaj (katalog: 92 mm visok poln profil kot vrhnji zaključek) — vedno ZGORAJ,
  // torej krajša višino polja pri obeh orientacijah.
  const handlePresent = req.handle === true && profile.handle.available === true
  const handleHeightMm = handlePresent ? (profile.handle.dimensionMm?.[0] ?? 92) : 0
  const fieldHeight = Math.max(face, req.fenceHeightMm - handleHeightMm)

  // Smer zlaganja desk: horizontal = po višini (od spodaj), vertical = po širini (od leve).
  const spanMm = req.orientation === 'horizontal' ? fieldHeight : req.fenceWidthMm

  if (!profile.orientation.includes(req.orientation)) {
    warnings.push(
      `profil "${profile.profile}" po katalogu NE podpira orientacije "${req.orientation}" (dovoljene: ${profile.orientation.join(', ')})`
    )
  }
  if (gap > profile.recommendedGapMm.max || gap < profile.recommendedGapMm.min) {
    warnings.push(
      `razmak ${gap} mm je izven priporočila proizvajalca (${profile.recommendedGapMm.min}–${profile.recommendedGapMm.max} mm)`
    )
  }

  // Število desk: čista aritmetika, brez naključja. Epsilon za plavajočo vejico.
  const EPS = 1e-9
  const raw = spanMm / pitch
  const boardCount = Math.max(1, Math.ceil(raw - EPS))

  const boards: FenceBoard[] = []
  for (let i = 0; i < boardCount; i++) {
    const startMm = i * pitch
    const remaining = spanMm - startMm
    const visibleMm = Math.min(face, Math.max(0, remaining))
    const cut = visibleMm < face - EPS
    boards.push({ index: i, startMm, visibleMm, cut })
  }

  return {
    productId: profile.productId,
    profile: profile.profile,
    orientation: req.orientation,
    faceWidthMm: face,
    gapMm: gap,
    pitchMm: pitch,
    fenceWidthMm: req.fenceWidthMm,
    fenceHeightMm: req.fenceHeightMm,
    fieldHeightMm: fieldHeight,
    fieldSpanMm: spanMm,
    boardCount,
    boards,
    handleHeightMm,
    handlePresent,
    warnings,
  }
}

// ---------- Rasterizacija (deterministična) ----------

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/** Determinističen subtilen lesni vzorec (čista funkcija koordinat — NI naključje). */
function grainModifier(mm: number, periodMm: number, amplitude: number): number {
  const t = Math.sin((2 * Math.PI * mm) / periodMm) * 0.5 + Math.sin((2 * Math.PI * mm) / (periodMm * 2.7)) * 0.5
  return 1 - amplitude * (t * 0.5 + 0.5)
}

/**
 * Renderira ograjo v RGBA ImageBuffer (belo ozadje — združljivo z A-pipeline
 * cutout pravilom: bele vrzeli ⇒ alpha 0). Enak vhod → enak izhod.
 */
export function renderFence(req: FenceRequest, layout?: FenceLayout): ImageBuffer {
  const lay = layout ?? computeFenceLayout(req)
  const W = Math.round(req.outWidthPx)
  const H = Math.round(req.outHeightPx)
  if (W < 4 || H < 4) throw new Error('procedural: izhodni razmor premajhen (min 4 px)')

  const data = new Uint8ClampedArray(W * H * 4)
  // Belo ozadje (razmaki, robovi)
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = 255
    data[i * 4 + 1] = 255
    data[i * 4 + 2] = 255
    data[i * 4 + 3] = 255
  }

  const pxPerMmX = W / lay.fenceWidthMm
  const pxPerMmY = H / lay.fenceHeightMm
  const horizontal = lay.orientation === 'horizontal'
  const tex = req.material.kind === 'texture' ? req.material.texture : null
  const texMode = req.material.kind === 'texture' ? req.material.mode : 'scan'
  const rgb = req.material.kind === 'color' ? req.material.rgb : [128, 128, 128]
  const isRomb = lay.productId.startsWith('woodcore-romb')

  // Višinski razpon polja v mm (ročaj zgoraj odreže polje)
  const fieldTopMm = lay.handlePresent ? lay.fenceHeightMm - lay.handleHeightMm : lay.fenceHeightMm

  // 1) STEBRI najprej — fizično so ZA deskami (deske jih pokrivajo na ploskvicah,
  //    vidni so le v razmakih). Deterministične pozicije iz vhoda.
  if (req.posts && req.posts.widthMm > 0) {
    const halfW = Math.round((req.posts.widthMm / 2) * pxPerMmX)
    for (const pMm of req.posts.positionsMm) {
      const cx = Math.round(pMm * pxPerMmX)
      for (let x = cx - halfW; x <= cx + halfW; x++) {
        if (x < 0 || x >= W) continue
        const edge = Math.min(Math.abs(x - (cx - halfW)), Math.abs(x - (cx + halfW)))
        const m = edge === 0 ? 0.72 : 0.82
        for (let y = 0; y < H; y++) {
          const idx = (y * W + x) * 4
          data[idx] = clamp8(58 * m)
          data[idx + 1] = clamp8(63 * m)
          data[idx + 2] = clamp8(70 * m)
          data[idx + 3] = 255
        }
      }
    }
  }

  // 2) DESKE (nad stebri)
  for (const b of lay.boards) {
    // mm → px mejniki ploskvice
    const startPx = horizontal ? Math.round((lay.fenceHeightMm - (b.startMm + b.visibleMm)) * pxPerMmY) : Math.round(b.startMm * pxPerMmX)
    const sizePx = horizontal ? Math.round(b.visibleMm * pxPerMmY) : Math.round(b.visibleMm * pxPerMmX)
    const spanStart = horizontal ? 0 : startPx
    const spanEnd = horizontal ? W : Math.min(W, startPx + sizePx)
    const crossStart = horizontal ? startPx : 0
    const crossEnd = horizontal ? Math.min(H, startPx + sizePx) : H

    for (let span = spanStart; span < spanEnd; span++) {
      for (let cross = crossStart; cross < crossEnd; cross++) {
        // V OBEH orientacijah: span teče po X (širina), cross po Y (višina).
        // horizontal: deske zlagane po Y → cross = pas ploskvice; vertical: po X.
        const x = span
        const y = cross
        if (x < 0 || y < 0 || x >= W || y >= H) continue

        // mm pozicija znotraj ploskvice (lokalno) in čez ograjo (globalno)
        const localCrossMm = horizontal
          ? (lay.fenceHeightMm - y / pxPerMmY) - b.startMm
          : x / pxPerMmX - b.startMm
        const globalSpanMm = horizontal ? x / pxPerMmX : y / pxPerMmY

        let r: number
        let g: number
        let bl: number

        if (tex) {
          // Deterministično vzorčenje teksture: celotna ograja se preslika na
          // teksturo (scan = zaporedni pasovi, tile = modulo).
          const uN = horizontal ? globalSpanMm / lay.fenceWidthMm : (globalSpanMm / (lay.boardCount * lay.pitchMm))
          let vN: number
          if (texMode === 'scan') {
            const boardStride = lay.pitchMm / (horizontal ? lay.fenceHeightMm : lay.fenceWidthMm)
            const boardBase = (b.index * lay.pitchMm) / (horizontal ? lay.fenceHeightMm : lay.fenceWidthMm)
            const localN = horizontal
              ? (lay.fenceHeightMm - y / pxPerMmY - b.startMm) / lay.faceWidthMm
              : (x / pxPerMmX - b.startMm) / lay.faceWidthMm
            vN = boardBase + Math.min(1, Math.max(0, localN)) * (boardStride * (lay.faceWidthMm / lay.pitchMm))
            vN = Math.min(0.999, Math.max(0, vN))
          } else {
            const localN = (horizontal ? (fieldTopMm - y / pxPerMmY) : x / pxPerMmX) % lay.pitchMm
            vN = localN / lay.pitchMm
          }
          const uNc = Math.min(0.999, Math.max(0, uN))
          const tx = Math.floor(uNc * tex.w)
          const ty = Math.floor(vN * tex.h)
          const ti = (Math.min(tex.h - 1, ty) * tex.w + Math.min(tex.w - 1, tx)) * 4
          r = tex.data[ti]
          g = tex.data[ti + 1]
          bl = tex.data[ti + 2]
        } else {
          // Barvni material + determinističen profilni sencenje
          let m = 1
          if (isRomb) {
            // ROMB profil: rebro na sredini ploskvice (temnejše), svetlejši zgornji rob
            const half = Math.max(1, b.visibleMm / 2)
            const d = Math.abs(localCrossMm - half) / half // 0 = sredina, 1 = rob
            m = 1 - 0.16 * (1 - Math.min(1, d * 2.2)) - 0.05 * (1 - d)
          } else {
            // POLNA/DESKA: rahlo zatemnjeni robovi ploskvice
            const edge = Math.min(localCrossMm, b.visibleMm - localCrossMm)
            m = edge < 1.5 ? 0.9 : 1
            // subtilen lesni vzorec (čista funkcija mm pozicije)
            m *= grainModifier(globalSpanMm, 47, 0.03)
            m *= grainModifier(localCrossMm * 3.1 + globalSpanMm * 0.7, 131, 0.02)
          }
          r = clamp8(rgb[0] * m)
          g = clamp8(rgb[1] * m)
          bl = clamp8(rgb[2] * m)
        }

        const idx = (y * W + x) * 4
        data[idx] = clamp8(r)
        data[idx + 1] = clamp8(g)
        data[idx + 2] = clamp8(bl)
        data[idx + 3] = 255
      }
    }
  }

  // 3) VIDNI VIJAKI (samo če so del realnega modela — katalog; spec §10).
  //    Vijaki se rišejo na ploskvici pri stebrih — smiselno za horizontalno
  //    postavitev (pokončna: pozicije vijakov določajo vodoravne cevi — S+8+).
  if (horizontal && lay.boardCount > 0) {
    const profile = getProduct(lay.productId) ?? (req.profileOverride as CatalogProfile)
    const screwsVisible = profile?.screwsVisible === true
    if (screwsVisible && req.posts && req.posts.positionsMm.length > 0) {
      for (const b of lay.boards) {
        const crossCenterPx = horizontal
          ? Math.round((lay.fenceHeightMm - (b.startMm + b.visibleMm / 2)) * pxPerMmY)
          : Math.round((b.startMm + b.visibleMm / 2) * pxPerMmX)
        for (const pMm of req.posts.positionsMm) {
          const pPx = Math.round(pMm * pxPerMmX)
          drawScrew(data, W, H, pPx, crossCenterPx)
        }
      }
    }
  }

  // 4) ROČAJ (vidni vijaki vsak 500 mm po katalogu — deterministične pozicije)
  if (lay.handlePresent) {
    const hTopPx = 0
    const hBottomPx = Math.round(lay.handleHeightMm * pxPerMmY)
    for (let y = hTopPx; y < Math.min(H, hBottomPx); y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4
        if (req.material.kind === 'color') {
          const m = y - hTopPx < 1 || hBottomPx - y <= 1 ? 0.85 : 1
          data[idx] = clamp8(rgb[0] * 0.92 * m)
          data[idx + 1] = clamp8(rgb[1] * 0.92 * m)
          data[idx + 2] = clamp8(rgb[2] * 0.92 * m)
        }
      }
    }
    // Vidni vijaki ročaja: 250, 750, 1250 ... mm (središča 500 mm intervalov)
    const profile = getProduct(lay.productId) ?? (req.profileOverride as CatalogProfile)
    if (profile?.handle.screwsVisible !== false) {
      const screwEveryMm = profile?.handle.screwsEveryMm ?? 500
      for (let smm = screwEveryMm / 2; smm < lay.fenceWidthMm; smm += screwEveryMm) {
        const sx = Math.round(smm * pxPerMmX)
        const sy = Math.round((lay.handleHeightMm / 2) * pxPerMmY)
        drawScrew(data, W, H, sx, sy)
      }
    }
  }

  return { data, w: W, h: H }
}

/** Majhen temen vijak (determinističen disk). */
function drawScrew(data: Uint8ClampedArray, W: number, H: number, cx: number, cy: number): void {
  const r = Math.max(1, Math.round(Math.min(W, H) * 0.004))
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const idx = (y * W + x) * 4
      data[idx] = clamp8(data[idx] * 0.55)
      data[idx + 1] = clamp8(data[idx + 1] * 0.55)
      data[idx + 2] = clamp8(data[idx + 2] * 0.55)
    }
  }
}
