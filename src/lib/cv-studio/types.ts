/**
 * CV STUDIO SDK (issues #10 + #11) — tipi in konstante.
 *
 * KLJUČNO ARHITEKTURNKO PRAVILO (issue #10/#11):
 *   Computer Vision = PREDLOG/ZAZNAVA. Measurement/Geometry = VIR RESNICE.
 *   CV nikoli ne določa končne mere, BOM-a, cene ali ponudbe brez potrditve
 *   uporabnika in obstoječe strežniške validacije.
 *
 * ZAKONI (isti kot measurement SDK):
 *  - Ni AI modelov — izključno deterministični algoritmi (Sobel, Hough,
 *    Otsu, morfologija, povezane komponente, homografija).
 *  - Nikoli izmišljenih mer: absolutne mm obstajajo SAMO ob potrjeni
 *    referenčni meri (prek obstoječega resolveScale / buildSession).
 *  - Če tipa prizora ni zanesljivo zaznati deterministično, se NE simulira —
 *    stanje ostane UNKNOWN/NEEDS_CONFIRMATION (ročna označitev je obvezna pot).
 *  - Determinizem: enak vhod → bajtno enak izhod (brez naključja/ur/mreže).
 */
import type {
  DetectedFeatures,
  MeasurementQualityMetrics,
  NormPoint,
  ResolvedScale,
} from '@/lib/measurement'

/** Verzija algoritma scene understanding (sledljivost detekcij). */
export const SCENE_ALGORITHM_VERSION = 'cv-scene@1.0.0'

/** Verzija placement engine-a (sledljivost postavitve). */
export const PLACEMENT_ALGORITHM_VERSION = 'pwc-placement@1.0.0'

/**
 * Tipi prizora — SAMO tisti, ki jih deterministični CV tehnično podpora
 * ali jih uporabnik označi ročno (issue #11 §2: "če ni zanesljivo zaznaveno,
 * ga ne simuliraj").
 *
 *  - AVTOMATSKO zaznano: BALCONY_EDGE, RAILING, RAILING_POST, STAIR,
 *    STAIR_EDGE, OBSTACLE.
 *  - SAMO ROČNO (uporabniška označitev): FLOOR, GROUND, WALL, OPENING, DOOR,
 *    OTHER_SURFACE — deterministična semantična segmentacija teh površin NI
 *    zanesljiva, zato jih CV NE izmišljuje.
 */
export type SceneElementType =
  | 'BALCONY_EDGE'
  | 'RAILING'
  | 'RAILING_POST'
  | 'STAIR'
  | 'STAIR_EDGE'
  | 'OBSTACLE'
  | 'FLOOR'
  | 'GROUND'
  | 'WALL'
  | 'OPENING'
  | 'DOOR'
  | 'OTHER_SURFACE'

/** Tipi, ki jih CV lahko PREDLAGA sam (ostali so izključno ročni). */
export const AUTO_SCENE_TYPES: readonly SceneElementType[] = [
  'BALCONY_EDGE',
  'RAILING',
  'RAILING_POST',
  'STAIR',
  'STAIR_EDGE',
  'OBSTACLE',
]

/**
 * Stanje zaznave — tehnično iskren signal:
 *  - PROPOSED: geometrija je deterministično trdna (črta/pas/stebri),
 *    semantika še čaka potrditev uporabnika.
 *  - NEEDS_CONFIRMATION: geometrija je predlog (npr. stopnišne linije,
 *    ovire) — uporabnik MORA potrditi/popraviti.
 *  - UNKNOWN: sistem ne more zanesljivo sklepati (ni samodejnih zaznav).
 */
export type SceneElementState = 'PROPOSED' | 'NEEDS_CONFIRMATION' | 'UNKNOWN'

/** Geometrija zaznave v NORMALIZIRANEM prostoru slike (0..1). */
export type SceneGeometry =
  | { kind: 'line'; pos: number; from: number; to: number; thetaDeg: number }
  | { kind: 'band'; yTop: number; yBottom: number; x0: number; x1: number }
  | { kind: 'points'; points: NormPoint[] }
  | { kind: 'bbox'; x0: number; y0: number; x1: number; y1: number }

/** Ena zaznava prizora. */
export interface SceneElement {
  /** Determinističen id: '<type>-<zaporedje>' (sort urejen — brez naključja). */
  id: string
  type: SceneElementType
  state: SceneElementState
  geometry: SceneGeometry
  /** Tehnični signal podpore 0..1 — NI dokaz mere, NI "AI confidence". */
  support: number
  warnings: string[]
}

/** Kakovost slike — objektivne metrike + iskren verdikt uporabnosti. */
export interface SceneQuality {
  /** metrike detekcije (isti model kot Measurement SDK) */
  metrics: MeasurementQualityMetrics
  /** povprečna luminanca 0..1 */
  brightness: number
  /** standardni odklon luminance 0..1 */
  contrast: number
  /** povprečna magnituda gradienta (0..1; nizka = mehka/zabrisana slika) */
  sharpness: number
  /** ocena šuma: povprečna visokofrekvenčna residua (0..1) */
  noiseEstimate: number
  /** ali je slika tehnično uporabna za analizo (rezolucija/kontrast) */
  usable: boolean
  /** iskreni razlogi, če usable=false (slovensko, brez ugibanja) */
  reasons: string[]
}

/** Usmerjanje za UI — kaj sistem VIDI, kaj manjka, kaj je naslednji korak. */
export interface SceneGuidance {
  seen: string
  missing: string | null
  nextAction: string
}

/** Poln rezultat analize prizora (issue #10 API contract). */
export interface SceneAnalysis {
  version: 1
  /** deterministična verzija algoritma (sledljivost) */
  algorithmVersion: string
  /** sha256 vhodnih pikslov — enaka slika → enak id (idempotentno) */
  sessionId: string
  image: {
    /** originalna širina/višina (px) */
    width: number
    height: number
    /** delovna (downscale) ločljivost, na kateri je analiza potekala */
    workWidth: number
    workHeight: number
  }
  elements: SceneElement[]
  /**
   * Značilke kompatibilne z Measurement SDK (runs/posts/corners) — reusable
   * v /api/measurement/confirm (canonical chain ostane nedotaknjen).
   */
  features: DetectedFeatures | null
  quality: SceneQuality
  /** perspektivni predlog: kotniki glavnega run-a (ni dokaz mere) */
  perspectiveHint: boolean
  warnings: string[]
  guidance: SceneGuidance
}

// ---------- Placement (issue #11 §7 — PWC Placement Engine) ----------

/** Vhod v deterministično oceno postavitve (strežnik je avtoritativni). */
export interface PlacementInput {
  /** kataloški oz. SDK id produkta (normalizira se prek Product SDK) */
  productId: string
  orientation: 'horizontal' | 'vertical'
  gapMm: number
  postWidthMm: number
  /** širina ograjnega polja v mm — iz POTRJENE meritve/reference */
  fenceWidthMm: number
  /** višina v mm — uporabniški podatek (iz potrditve, ne iz CV ugibanja) */
  fenceHeightMm: number
  /** stebri: širina + pozicije (mm) ali null */
  posts?: { widthMm: number; positionsMm: number[] } | null
  /** vrhnji ročaj — samo če profil podpira */
  handle?: boolean
  /** barva RGB za predogled (opcijsko) */
  colorRgb?: [number, number, number]
}

/** Kršitveni zapis (invalid placement → BREZ layouta, BREZ BOM-a). */
export interface PlacementViolation {
  code: string
  message: string
}

/** Rezultat ocene postavitve (issue #11 §7: invalid = jasen razlog, brez BOM). */
export interface PlacementResult {
  valid: boolean
  /** človeku razumljiv glavni razlog, če invalid */
  reason: string | null
  violations: PlacementViolation[]
  /** deterministični layout — IZKLJUČNO iz obstoječega computeFenceLayout */
  layout: import('@/lib/procedural/fence-engine').FenceLayout | null
  warnings: string[]
  /** sledljivost: verzija + pravila, po katerih je ocena nastala */
  algorithmVersion: string
}

// ---------- Projekcija postavitve na sliko (issue #11 §8) ----------

/** Potrjeni segment ograje v normaliziranih koordinatah (dno ograje). */
export interface ConfirmedSegment {
  start: NormPoint
  end: NormPoint
}

/** Vhod v projekcijo layouta na sliko. */
export interface ProjectionInput {
  layout: import('@/lib/procedural/fence-engine').FenceLayout
  orientation: 'horizontal' | 'vertical'
  /** potrjen segment (dno ograje) — uporabniško potrjen, NE CV ugib */
  segment: ConfirmedSegment
  /** potrjeno merilo (resolveScale) — brez njega NI mm projekcije */
  scale: ResolvedScale
  /** opcijski potrjeni kotniki TL,TR,BR,BL → homografska projekcija */
  corners?: [NormPoint, NormPoint, NormPoint, NormPoint] | null
  /** širina stebra (mm) za projekcijo predlogov stebrov (opcijsko) */
  postsWidthMm?: number
  /** pozicije stebrov (mm od začetka) za projekcijo (opcijsko) */
  postsPositionsMm?: number[]
}

/** Quad postavitvene enote v normaliziranih koordinatah (TL,TR,BR,BL). */
export type PlacementQuad = [NormPoint, NormPoint, NormPoint, NormPoint]

/** Ena projekcija deske/stebra na sliko. */
export interface ProjectedElement {
  /** indeks deske (FenceBoard.index) oziroma pozicija stebra (mm) */
  key: number
  kind: 'board' | 'post' | 'handle'
  /** cut flag deske (samo za boards) */
  cut?: boolean
  quad: PlacementQuad
}

/** Rezultat projekcije (issue #11 §8 — perspektiva oziroma pošten približek). */
export interface ProjectionResult {
  /** 'homography' = 4 potrjeni kotniki; 'affine-approximation' = iskren
   *  2D približek z OPOZORILO (nikoli se ne predstavlja kot prava 3D) */
  kind: 'homography' | 'affine-approximation'
  boards: ProjectedElement[]
  posts: ProjectedElement[]
  handle: ProjectedElement | null
  warnings: string[]
}
