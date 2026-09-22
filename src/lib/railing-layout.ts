// Roksal Railing Manager — razpored ograje po izmerjenem obsegu
// ---------------------------------------------------------------------------
// Prenos preverjenega domenskega motorja iz Android aplikacije BalkonAR
// (si/balkonar/domain/RailingLayoutEngine.kt, 80 enotskih testov) v TypeScript.
//
// ## Zakaj ta modul obstaja
// `calculator.ts` ima odlične posamezne izračune (razmik palic, koti stopnic,
// vrtalne šablone, kemično sidranje, veter, CNC), `floor-plan-tab.tsx` zna
// risati tloris z zidovi in stebri, `measurements-tab.tsx` pa zna meriti
// (tudi z Bluetooth laserskim merilnikom). Manjkal je le še **vezni člen**:
// funkcija, ki iz izmerjenega obsega (polilinije z vogali) in izbrane
// konfiguracije izračuna celoten razpored — kje so stebri, katere panele in
// kakšne širine, katere dolžine letev in pod kakšnim kotom se režejo, koliko
// sider in tesnil — ter opozorila, kadar je izmera neverjetna.
//
// To je tisti izračun, ki povezuje terensko mero z naročilom v delavnico.
// Brez njega se številke ročno prepisujejo, z njim pa so kosovnica, rezalni
// seznam in risba narejeni iz istih podatkov.
//
// ## Konvencije (enake kot v Android različici)
// - svetovne koordinate: **metri**, +Y je navzgor (gru-aligned)
// - izdelavne mere: **milimetri**
// - `yawDegrees(d) = atan2(-dz, dx)` — kot, ki lokalno +X os zasuče na smer roba
// - `signedTurnDegrees` > 0 = zavoj **v levo** (nasprotno urinega kazalca gledano od zgoraj)
// - vsak rob ima dve dolžini: AR (kar je videl telefon) in izdelavno (kar je
//   monter potrdil s trakom). Kosovnica in rezalni seznam uporabljata izdelavno.
//
// Čist TypeScript brez uvozov iz projekta — ničesar obstoječega ne spreminja.

// ══════════════════════════════════════════════════════════════════════════════
// GEOMETRIJA
// ══════════════════════════════════════════════════════════════════════════════

export interface Vec3 {
  x: number
  y: number
  z: number
}

export const v3 = (x: number, y = 0, z = 0): Vec3 => ({ x, y, z })

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function lengthXZ(v: Vec3): number {
  return Math.hypot(v.x, v.z)
}

export function distance(a: Vec3, b: Vec3): number {
  return lengthXZ(sub(b, a)) === 0 ? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) : Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
}

/** Vodoravna (tlorisna) razdalja — dolžina, po kateri se reže profil. */
export function distanceXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
}

/** Enotski vektor a→b v tlorisu; +X kadar sovpadata (brez NaN). */
export function directionXZ(a: Vec3, b: Vec3): Vec3 {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz)
  return len < 1e-6 ? { x: 1, y: 0, z: 0 } : { x: dx / len, y: 0, z: dz / len }
}

/**
 * Kot v stopinjah, ki lokalno +X os zasuče na vodoravno smer `d`.
 * Filament/three.js sta desnosučna z +Y navzgor, zato `R_y(θ)·(1,0,0) = (cos θ, 0, −sin θ)`
 * in torej `θ = atan2(−dz, dx)`.
 */
export function yawDegrees(d: Vec3): number {
  return (Math.atan2(-d.z, d.x) * 180) / Math.PI
}

export function yawBetween(a: Vec3, b: Vec3): number {
  return yawDegrees(directionXZ(a, b))
}

/** Naklon a→b v stopinjah (pozitivno = b je višje). */
export function slopeDegrees(a: Vec3, b: Vec3): number {
  const run = distanceXZ(a, b)
  if (run < 1e-4) return 0
  return (Math.atan2(b.y - a.y, run) * 180) / Math.PI
}

/** Nedoloceni kot med dvema vodoravnima smerema, 0..180°. */
export function angleBetween(d1: Vec3, d2: Vec3): number {
  const dot = Math.max(-1, Math.min(1, d1.x * d2.x + d1.z * d2.z))
  return (Math.acos(dot) * 180) / Math.PI
}

/**
 * Predznačen zasuk v oglišču `b` poti a→b→c, v stopinjah.
 * **Pozitivno = zavoj v LEVO** (nasprotno urinega kazalca gledano od zgoraj).
 * Preverjeno s pravim vektorskim produktom: prava `+Y` komponenta `d1 × d2` je
 * `d1.z*d2.x − d1.x*d2.z`, `crossSign` spodaj pa je ta vrednost z obratnim
 * predznakom — zato je veja obrnjena.
 */
export function signedTurnDegrees(a: Vec3, b: Vec3, c: Vec3): number {
  const d1 = directionXZ(a, b)
  const d2 = directionXZ(b, c)
  const magnitude = angleBetween(d1, d2)
  const crossSign = d1.x * d2.z - d1.z * d2.x
  return crossSign >= 0 ? -magnitude : magnitude
}

/** Kot žage: polovica zasuka. 90° vogal → 45° rez na obeh kosih. */
export function miterDegrees(turnDeg: number): number {
  return Math.abs(turnDeg) / 2
}

/** Notranji kot v oglišču: 180 = ravno, 90 = pravokotni vogal. */
export function interiorDegrees(a: Vec3, b: Vec3, c: Vec3): number {
  return 180 - Math.abs(signedTurnDegrees(a, b, c))
}

/** Shoelace površina tlorisnega mnogokotnika, m². */
export function polygonAreaXZ(points: Vec3[]): number {
  if (points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const q = points[(i + 1) % points.length]
    sum += p.x * q.z - q.x * p.z
  }
  return Math.abs(sum / 2)
}

/** Skupna vodoravna dolžina poti; pri `closed` doda še zaklepno stranico. */
export function pathLengthXZ(points: Vec3[], closed: boolean): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 0; i < points.length - 1; i++) total += distanceXZ(points[i], points[i + 1])
  if (closed && points.length > 2) total += distanceXZ(points[points.length - 1], points[0])
  return total
}

/** `ceil` s toleranco: 1200,00002 mm pri maksimumu 1200 mm je EN kos, ne dva. */
function ceilTolerant(v: number): number {
  const i = Math.floor(v)
  return v - i > 1e-4 ? i + 1 : i
}

/** Razdeli dolžino na enake kose, vsak največ `maxPieceMm`. */
export function splitEqually(lengthMm: number, maxPieceMm: number): number[] {
  if (lengthMm <= 0 || maxPieceMm <= 0) return []
  const count = Math.max(1, ceilTolerant(lengthMm / maxPieceMm))
  const piece = lengthMm / count
  return Array.from({ length: count }, () => piece)
}

/** Notranje delilne točke na 0..lengthMm, da noben razpon ne preseže maxSpanMm. */
export function evenDivisions(lengthMm: number, maxSpanMm: number): number[] {
  if (lengthMm <= 0 || maxSpanMm <= 0) return []
  const spans = Math.max(1, ceilTolerant(lengthMm / maxSpanMm))
  if (spans === 1) return []
  const step = lengthMm / spans
  const out: number[] = []
  for (let i = 1; i < spans; i++) out.push(step * i)
  return out
}

export interface Bounds {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
  widthM: number
  heightM: number
  depthM: number
}

export function bounds(points: Vec3[]): Bounds | null {
  if (points.length === 0) return null
  let minX = points[0].x, maxX = points[0].x
  let minY = points[0].y, maxY = points[0].y
  let minZ = points[0].z, maxZ = points[0].z
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
  }
  return {
    minX, minY, minZ, maxX, maxY, maxZ,
    widthM: Math.abs(maxX - minX),
    heightM: Math.abs(maxY - minY),
    depthM: Math.abs(maxZ - minZ),
  }
}

/** Najbližja točka na daljici a→b (v tlorisu, ohrani višino a). */
export function closestPointOnSegmentXZ(p: Vec3, a: Vec3, b: Vec3): Vec3 {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const lenSq = abx * abx + abz * abz
  if (lenSq < 1e-8) return a
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / lenSq))
  return { x: a.x + abx * t, y: a.y, z: a.z + abz * t }
}

/**
 * Pripenjanje točke na rob zaznane plošče (ali na risano črto tlorisa), če je
 * dovolj blizu. Rob plošče je prilegan čez veliko sličic ali pa ga je monter
 * narisal, zato je boljši približek kot en sam globinski vzorec.
 */
export function snapToBoundary(
  p: Vec3,
  boundary: Vec3[],
  closed: boolean,
  maxDistanceM: number,
): Vec3 {
  if (boundary.length < 2) return p
  let best = p
  let bestDist = maxDistanceM
  const count = closed ? boundary.length : boundary.length - 1
  for (let i = 0; i < count; i++) {
    const a = boundary[i]
    const b = boundary[(i + 1) % boundary.length]
    const candidate = closestPointOnSegmentXZ(p, a, b)
    const d = distanceXZ(p, candidate)
    if (d < bestDist) {
      bestDist = d
      best = candidate
    }
  }
  return best
}

// ══════════════════════════════════════════════════════════════════════════════
// KONFIGURACIJA OGRAJE
// ══════════════════════════════════════════════════════════════════════════════

export type RailingSystem =
  | 'GLASS_CHANNEL'   // steklo v U-profilu, brez stebričkov
  | 'GLASS_POSTS'     // steklo med stebrički
  | 'POST_BARS'       // stebrički + vodoravne palice
  | 'POST_MESH'       // stebrički + mreža
  | 'POST_WOOD'       // stebrički + leseno polnilo
  | 'FRENCH'          // francoski balkon
  | 'CUSTOM'          // lasten profil/element

export type PostShape = 'ROUND' | 'SQUARE' | 'RECT' | 'FLAT'
export type Mounting = 'SLAB_TOP' | 'SLAB_SIDE' | 'PARAPET_TOP'
export type PostFixing = 'BASE_PLATE' | 'SIDE_BRACKET' | 'CORE_DRILLED'
export type GlassType = 'ESG' | 'VSG' | 'ESG_VSG'
export type HandrailType = 'NONE' | 'U_COVER_ALU' | 'ROUND_42' | 'ROUND_48' | 'RECT' | 'WOOD'

export interface PostSection {
  shape: PostShape
  widthMm: number
  depthMm: number
}

export interface GlassSpec {
  type: GlassType
  thicknessMm: number
  maxPanelWidthMm: number
  sideGapMm: number
  bottomGapMm: number
}

export interface BaseProfileSpec {
  enabled: boolean
  widthMm: number
  heightMm: number
  /** Kako globoko je steklo vpeto v profil. Vidna višina stekla = H − profil + vpetje. */
  embedMm: number
  drainageSpacingMm: number
}

export interface HandrailSpec {
  type: HandrailType
  widthMm: number
  heightMm: number
  returnsAtEnds: boolean
}

export interface BarSpec {
  count: number
  diameterMm: number
  shape: PostShape
}

export interface MeshSpec {
  openingMm: number
  heightMm: number
}

export interface CustomSpec {
  spacingMm: number
  heightMm: number
  repeatAsPost: boolean
  assetName: string
}

export interface RailingSpec {
  system: RailingSystem
  /** Skupna višina od hodne površine do vrha letev. */
  heightMm: number
  mounting: Mounting
  /** Odmik polnila od hodne površine (odvodnjavanje, čiščenje). */
  baseOffsetMm: number
  postSpacingMaxMm: number
  postSection: PostSection
  postFixing: PostFixing
  cornerPosts: boolean
  glass: GlassSpec
  baseProfile: BaseProfileSpec
  handrail: HandrailSpec
  bars: BarSpec
  mesh: MeshSpec
  custom: CustomSpec
  wastePercent: number
}

export const ANCHORS_PER_POST: Record<PostFixing, number> = {
  BASE_PLATE: 3,
  SIDE_BRACKET: 2,
  CORE_DRILLED: 1,
}

/** Privzeta konfiguracija: steklo v U-profilu, 1000 mm, ESG/VSG 16,76. */
export function defaultRailingSpec(over: Partial<RailingSpec> = {}): RailingSpec {
  return {
    system: 'GLASS_CHANNEL',
    heightMm: 1000,
    mounting: 'SLAB_TOP',
    baseOffsetMm: 0,
    postSpacingMaxMm: 1100,
    postSection: { shape: 'SQUARE', widthMm: 50, depthMm: 50 },
    postFixing: 'BASE_PLATE',
    cornerPosts: true,
    glass: {
      type: 'ESG_VSG',
      thicknessMm: 16.76,
      maxPanelWidthMm: 1400,
      sideGapMm: 6,
      bottomGapMm: 10,
    },
    baseProfile: { enabled: true, widthMm: 80, heightMm: 150, embedMm: 40, drainageSpacingMm: 300 },
    handrail: { type: 'U_COVER_ALU', widthMm: 50, heightMm: 30, returnsAtEnds: true },
    bars: { count: 4, diameterMm: 12, shape: 'ROUND' },
    mesh: { openingMm: 50, heightMm: 900 },
    custom: { spacingMm: 1000, heightMm: 1000, repeatAsPost: true, assetName: '' },
    wastePercent: 5,
    ...over,
  }
}

// ── Izpeljane višine ──────────────────────────────────────────────────────────
// Eno pravilo za celo aplikacijo: `skupna višina = višina polnila + višina letev`,
// zato je številka, ki jo monter vpiše, tista, ki jo stranka izmeri na objektu.

export function hasPosts(spec: RailingSpec): boolean {
  switch (spec.system) {
    case 'GLASS_CHANNEL':
      return false
    case 'CUSTOM':
      return spec.custom.repeatAsPost
    default:
      return true
  }
}

export function hasBaseProfile(spec: RailingSpec): boolean {
  return (spec.system === 'GLASS_CHANNEL' || spec.system === 'GLASS_POSTS') && spec.baseProfile.enabled
}

export function hasGlass(spec: RailingSpec): boolean {
  return spec.system === 'GLASS_CHANNEL' || spec.system === 'GLASS_POSTS'
}

export function hasHandrail(spec: RailingSpec): boolean {
  return spec.handrail.type !== 'NONE'
}

/** Višina, ki jo letev zasede nad polnilom. */
export function handrailStackMm(spec: RailingSpec): number {
  return hasHandrail(spec) ? spec.handrail.heightMm : 0
}

/** Zgornji rob polnila, merjeno od hodne površine. */
export function infillTopMm(spec: RailingSpec): number {
  return Math.max(0, spec.heightMm - handrailStackMm(spec))
}

/** Kje se polnilo začne: v U-profilu, če ga je, sicer nad drenažno režo. */
export function infillBottomMm(spec: RailingSpec): number {
  return (
    spec.baseOffsetMm +
    (hasBaseProfile(spec)
      ? Math.max(0, spec.baseProfile.heightMm - spec.baseProfile.embedMm)
      : spec.glass.bottomGapMm)
  )
}

export function infillHeightMm(spec: RailingSpec): number {
  return Math.max(0, infillTopMm(spec) - infillBottomMm(spec))
}

// ══════════════════════════════════════════════════════════════════════════════
// IZMERA
// ══════════════════════════════════════════════════════════════════════════════

/** Od kod je mera — trije AR viri niso enako zaupanja vredni, trak pa je tisti pravi. */
export type DimensionSource =
  | 'PLANE'          // AR: zaznana ploskev
  | 'PLANE_SNAPPED'  // AR: pripeto na rob plošče
  | 'DEPTH'          // AR: globinska točka
  | 'DEPTH_IMAGE'    // AR: globinska slika
  | 'FEATURE_POINT'  // AR: značilnica (najhrupnejše)
  | 'MANUAL'         // ročni vnos
  | 'TAPE'           // merjeno s trakom / laserskim merilnikom

export const SOURCE_ACCURACY_MM: Record<DimensionSource, number> = {
  PLANE: 15,
  PLANE_SNAPPED: 10,
  DEPTH: 30,
  DEPTH_IMAGE: 40,
  FEATURE_POINT: 60,
  MANUAL: 0,
  TAPE: 1,
}

export interface MeasuredPoint {
  xM: number
  yM: number
  zM: number
  source: DimensionSource
  confidence: number
}

export function toVec3(p: MeasuredPoint): Vec3 {
  return { x: p.xM, y: p.yM, z: p.zM }
}

export function measured(x: number, y: number, z: number, source: DimensionSource = 'PLANE', confidence = 1): MeasuredPoint {
  return { xM: x, yM: y, zM: z, source, confidence }
}

export interface Perimeter {
  points: MeasuredPoint[]
  closed: boolean
  /** Popravki s trakom po indeksu roba. Nikoli ne premaknejo risbe — spremenijo izdelavo. */
  overridesMm: Record<number, number>
}

export function perimeterOf(points: Vec3[], closed = false, overridesMm: Record<number, number> = {}): Perimeter {
  return {
    points: points.map((p) => measured(p.x, p.y, p.z)),
    closed,
    overridesMm,
  }
}

export function edgeCount(per: Perimeter): number {
  if (per.points.length < 2) return 0
  return per.points.length - 1 + (per.closed ? 1 : 0)
}

// ══════════════════════════════════════════════════════════════════════════════
// REZULTAT RAZPOREDA
// ══════════════════════════════════════════════════════════════════════════════

export type Severity = 'INFO' | 'WARN' | 'ERROR'

export interface LayoutWarning {
  severity: Severity
  code: string
  message: string
  edgeIndex?: number
}

export interface EdgeLayout {
  index: number
  /** A, B, C … — ista oznaka v risbi, v AR in na ponudbi. */
  label: string
  startWorld: Vec3
  endWorld: Vec3
  /** Vodoravna dolžina, kot jo je izmeril telefon. */
  arLengthMm: number
  /** Dolžina, po kateri se reže: popravek s trakom, če obstaja, sicer AR. */
  fabricationLengthMm: number
  isOverridden: boolean
  source: DimensionSource
  slopeDeg: number
  yawDeg: number
  /** Višina osnove tega roba v metrih (rob plošče ni nujno v vodi). */
  baseY: number
  startTurnDeg: number
  endTurnDeg: number
  spanCount: number
  spanSpacingMm: number
}

export type PanelKind = 'GLASS' | 'MESH' | 'WOOD' | 'CUSTOM'

export interface PanelPlacement {
  index: number
  label: string
  kind: PanelKind
  edgeIndex: number
  /** Sredina spodnjega roba, svetovni metri. */
  world: Vec3
  yawDeg: number
  widthMm: number
  heightMm: number
  thicknessMm: number
  bottomOffsetMm: number
  areaM2: number
}

export interface PostPlacement {
  index: number
  label: string
  edgeIndex: number
  world: Vec3
  yawDeg: number
  heightMm: number
  section: PostSection
  isCorner: boolean
  isPathEnd: boolean
  /** Razmik od prejšnjega stebra — za kontrolo, da ni prekoračen maksimum sistema. */
  spacingFromPreviousMm: number
}

export type RailKind = 'HANDRAIL' | 'BAR'

export interface RailPiece {
  index: number
  label: string
  kind: RailKind
  edgeIndex: number
  startWorld: Vec3
  endWorld: Vec3
  lengthMm: number
  /**
   * Predznačen kot žage, stopinje od pravokotnega reza.
   * **Pozitivno = žaga nagnjena v desno** glede na smer poteka (odvzet material
   * na desni). 0 za prosti konec, ki se reže pravokotno.
   */
  startMiterDeg: number
  endMiterDeg: number
  /** Notranji kot, ki ga kosa oklepata: 180 = ravno, 90 = pravokotni vogal. */
  startInteriorDeg: number
  endInteriorDeg: number
  widthMm: number
  heightMm: number
  isRound: boolean
  diameterMm: number
}

export interface BaseProfilePiece {
  index: number
  label: string
  edgeIndex: number
  world: Vec3
  yawDeg: number
  lengthMm: number
  widthMm: number
  heightMm: number
  drainageHoleCount: number
}

export interface CutListRow {
  part: string
  label: string
  dimension: string
  cutStart: string
  cutEnd: string
  qty: number
}

export interface LayoutResult {
  closed: boolean
  edges: EdgeLayout[]
  posts: PostPlacement[]
  panels: PanelPlacement[]
  handrails: RailPiece[]
  bars: RailPiece[]
  baseProfiles: BaseProfilePiece[]
  warnings: LayoutWarning[]
}

export const EMPTY_LAYOUT: LayoutResult = {
  closed: false,
  edges: [],
  posts: [],
  panels: [],
  handrails: [],
  bars: [],
  baseProfiles: [],
  warnings: [],
}

// ── Povzetki ─────────────────────────────────────────────────────────────────

export function totalRunMm(layout: LayoutResult): number {
  return layout.edges.reduce((s, e) => s + e.fabricationLengthMm, 0)
}

export function totalArRunMm(layout: LayoutResult): number {
  return layout.edges.reduce((s, e) => s + e.arLengthMm, 0)
}

export function glassAreaM2(layout: LayoutResult): number {
  return layout.panels
    .filter((p) => p.kind === 'GLASS')
    .reduce((s, p) => s + (p.widthMm / 1000) * (p.heightMm / 1000), 0)
}

export function handrailLengthMm(layout: LayoutResult): number {
  return layout.handrails.reduce((s, r) => s + r.lengthMm, 0)
}

export function barLengthMm(layout: LayoutResult): number {
  return layout.bars.reduce((s, r) => s + r.lengthMm, 0)
}

export function baseProfileLengthMm(layout: LayoutResult): number {
  return layout.baseProfiles.reduce((s, b) => s + b.lengthMm, 0)
}

/** Število vogalov, kjer se potek res lomi — vsak je zvar ali kotni kos v delavnici. */
export function cornerCount(layout: LayoutResult): number {
  return layout.edges.filter((e) => Math.abs(e.startTurnDeg) > 5).length
}

/** Prosta konca odprte poti: 0 pri sklenjeni zanki, sicer 2. */
export function freeEndCount(layout: LayoutResult): number {
  return layout.closed || layout.edges.length === 0 ? 0 : 2
}

// ══════════════════════════════════════════════════════════════════════════════
// MOTOR
// ══════════════════════════════════════════════════════════════════════════════

/** Rob, krajši od tega, ne more nositi panela — skoraj gotovo napačen dotik. */
const MIN_EDGE_MM = 120
/** Panel ožji od tega je ostanek: stane enako kot pravi panel. */
const MIN_PANEL_MM = 150
/** Silikonska fuga med dvema stekloma v neprekinjenem U-profilu. */
const GLASS_JOINT_MM = 10
/** Nad tem naklonom rob ni v vodi in ograje ni mogoče izvesti po risbi. */
const LEVEL_TOLERANCE_DEG = 2

/** A, B, C … Z, AA, AB … */
export function edgeLabel(index: number): string {
  let i = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (i % 26)) + s
    i = Math.floor(i / 26) - 1
  } while (i >= 0)
  return s
}

function signOf(v: number): number {
  return v >= 0 ? 1 : -1
}

function panelLabel(kind: PanelKind, ordinal: number): string {
  switch (kind) {
    case 'GLASS': return `ST${ordinal}`
    case 'MESH': return `MR${ordinal}`
    case 'WOOD': return `LS${ordinal}`
    case 'CUSTOM': return `EL${ordinal}`
  }
}

/**
 * Položi ograjo vzdolž izmerjenega obsega.
 *
 * ## Dve dolžini in zakaj se razlikujeta
 * Rob ima **AR dolžino** (kar je videl telefon, ±1–3 cm) in **izdelavno dolžino**
 * (kar je monter potrdil s trakom). Kosovnica, rezalni seznam in vsaka številka na
 * ponudbi uporabljata izdelavno. Risba postavlja elemente po AR poliliniji, ker je
 * balkon res tam, kjer ga je videl telefon — popravljeni robovi pa so označeni, da
 * razlika nikoli ni nevidna.
 */
export function layoutRailing(per: Perimeter, spec: RailingSpec): LayoutResult {
  const pts = per.points.map(toVec3)
  if (pts.length < 2) {
    return {
      ...EMPTY_LAYOUT,
      warnings: [
        { severity: 'INFO', code: 'NEED_POINTS', message: 'Izmeri vsaj dve točki na robu balkona.' },
      ],
    }
  }

  const n = pts.length
  const nEdges = edgeCount(per)
  const warnings: LayoutWarning[] = []
  const edges: EdgeLayout[] = []

  // ── 1. Robovi ───────────────────────────────────────────────────────────────
  for (let i = 0; i < nEdges; i++) {
    const a = pts[i]
    const j = i === n - 1 ? 0 : i + 1 // na 0 skoči samo pri sklenjeni zanki
    const b = pts[j]
    const arLenMm = distanceXZ(a, b) * 1000
    const override = per.overridesMm[i]
    const fabLenMm = override ?? arLenMm
    const slope = slopeDegrees(a, b)

    // Zasuka na obeh koncih roba določata kot žage za letev. Oglišče brez
    // predhodnika (začetek odprte poti) ali naslednika (konec) je prost konec:
    // pravokoten rez, brez žage.
    const prevIdx = i === 0 ? (per.closed ? n - 1 : -1) : i - 1
    const nextIdx = j === n - 1 ? (per.closed ? 0 : -1) : j + 1
    const startTurn = prevIdx >= 0 ? signedTurnDegrees(pts[prevIdx], a, b) : 0
    const endTurn = nextIdx >= 0 ? signedTurnDegrees(a, b, pts[nextIdx]) : 0

    const spans = hasPosts(spec) ? Math.max(1, ceilTolerant(fabLenMm / spec.postSpacingMaxMm)) : 1

    edges.push({
      index: i,
      label: edgeLabel(i),
      startWorld: a,
      endWorld: b,
      arLengthMm: arLenMm,
      fabricationLengthMm: fabLenMm,
      isOverridden: override !== undefined,
      source: dominantSource(per, i),
      slopeDeg: slope,
      yawDeg: yawBetween(a, b),
      baseY: a.y,
      startTurnDeg: startTurn,
      endTurnDeg: endTurn,
      spanCount: spans,
      spanSpacingMm: fabLenMm / spans,
    })

    if (fabLenMm < MIN_EDGE_MM) {
      warnings.push({
        severity: 'ERROR',
        code: 'EDGE_TOO_SHORT',
        edgeIndex: i,
        message: `Rob ${edgeLabel(i)}: ${fmtMm(fabLenMm)} je prekratko (< ${fmtMm(MIN_EDGE_MM)}). Preveri, ali je točka res na robu plošče.`,
      })
    } else if (Math.abs(slope) > LEVEL_TOLERANCE_DEG) {
      warnings.push({
        severity: 'WARN',
        code: 'EDGE_NOT_LEVEL',
        edgeIndex: i,
        message: `Rob ${edgeLabel(i)} ni v vodi: naklon ${fmtDeg(slope)}. Ograja se gradi v vodoravni ravnini — preveri odtekanje in višino estriha.`,
      })
    } else if (override !== undefined && Math.abs(override - arLenMm) > 25) {
      warnings.push({
        severity: 'INFO',
        code: 'EDGE_OVERRIDDEN',
        edgeIndex: i,
        message: `Rob ${edgeLabel(i)}: uporabljena mera s traku ${fmtMm(override)} (AR je izmeril ${fmtMm(arLenMm)}).`,
      })
    }
  }

  // ── 2. Stebri ───────────────────────────────────────────────────────────────
  const posts: PostPlacement[] = []
  if (hasPosts(spec)) {
    const vertexHasPost = new Array<boolean>(n).fill(false)
    for (const edge of edges) {
      const i = edge.index
      const a = edge.startWorld
      const dir = directionXZ(a, edge.endWorld)
      const edgeRunM = Math.max(1e-4, distanceXZ(a, edge.endWorld))

      // Steber v vsakem vogalu, deljen med roboma, ki se tam stikata.
      // `cornerPosts = false` izpusti samo NOTRANJE vogale — prosta konca odprte
      // poti ga dobita vedno, sicer nič ne zaključi letev.
      const vertexIsFreeEnd = !per.closed && i === 0
      const vertexIsInteriorCorner = per.closed || i > 0
      const placeVertexPost = vertexIsFreeEnd || !vertexIsInteriorCorner || spec.cornerPosts
      if (placeVertexPost && !vertexHasPost[i]) {
        vertexHasPost[i] = true
        posts.push({
          index: posts.length,
          label: `S${posts.length + 1}`,
          edgeIndex: i,
          world: a,
          yawDeg: edge.yawDeg,
          heightMm: spec.heightMm,
          section: spec.postSection,
          isCorner: Math.abs(edge.startTurnDeg) > 5,
          isPathEnd: vertexIsFreeEnd,
          spacingFromPreviousMm: spacingFromPrevious(posts, a),
        })
      }

      // Notranji delilni stebri, enakomerno — da noben razpon ne preseže maksimuma
      // in da v vogalu ne ostane 90 mm ostanek.
      for (const offsetMm of evenDivisions(edge.fabricationLengthMm, spec.postSpacingMaxMm)) {
        const t = offsetMm / 1000 / edgeRunM
        const world = {
          x: a.x + dir.x * (t * edgeRunM),
          y: a.y,
          z: a.z + dir.z * (t * edgeRunM),
        }
        posts.push({
          index: posts.length,
          label: `S${posts.length + 1}`,
          edgeIndex: i,
          world,
          yawDeg: edge.yawDeg,
          heightMm: spec.heightMm,
          section: spec.postSection,
          isCorner: false,
          isPathEnd: false,
          spacingFromPreviousMm: spacingFromPrevious(posts, world),
        })
      }

      // Zadnji rob odprte poti: njegovo končno oglišče je prost konec in dobi steber.
      if (!per.closed && i === edges.length - 1) {
        const endIdx = n - 1
        if (!vertexHasPost[endIdx]) {
          vertexHasPost[endIdx] = true
          posts.push({
            index: posts.length,
            label: `S${posts.length + 1}`,
            edgeIndex: i,
            world: edge.endWorld,
            yawDeg: edge.yawDeg,
            heightMm: spec.heightMm,
            section: spec.postSection,
            isCorner: Math.abs(edge.endTurnDeg) > 5,
            isPathEnd: true,
            spacingFromPreviousMm: spacingFromPrevious(posts, edge.endWorld),
          })
        }
      }
    }
    if (!spec.cornerPosts) {
      warnings.push({
        severity: 'INFO',
        code: 'NO_CORNER_POSTS',
        message: 'Brez vogalnih stebričkov: na notranjih vogalih nosi samo polnilo. Preveri, ali sistem to dopušča.',
      })
    }
    if (spec.postSpacingMaxMm < 200) {
      warnings.push({
        severity: 'ERROR',
        code: 'POST_SPACING',
        message: `Razmik med stebrički (${fmtMm(spec.postSpacingMaxMm)}) je manjši od 200 mm — preveri nastavitev.`,
      })
    }
  }

  // ── 3. Polnilo ──────────────────────────────────────────────────────────────
  const panels: PanelPlacement[] = []

  if (hasGlass(spec)) {
    const glassTopMm = infillTopMm(spec)
    const glassBottomMm = infillBottomMm(spec)
    const glassHeightMm = glassTopMm - glassBottomMm
    if (glassHeightMm < MIN_PANEL_MM) {
      warnings.push({
        severity: 'ERROR',
        code: 'GLASS_HEIGHT',
        message: `Višina stekla je ${fmtMm(glassHeightMm)} — premalo. Zvišaj ograjo ali znišaj osnovni profil.`,
      })
    } else if (hasBaseProfile(spec)) {
      // Neprekinjen niz: vsak rob se razdeli na enake panele s silikonsko fugo.
      for (const edge of edges) {
        let cursorMm = 0
        for (const piece of splitEqually(edge.fabricationLengthMm, spec.glass.maxPanelWidthMm)) {
          const glassWidth = piece - GLASS_JOINT_MM
          if (glassWidth < MIN_PANEL_MM) {
            warnings.push({
              severity: 'WARN',
              code: 'PANEL_SLIVER',
              edgeIndex: edge.index,
              message: `Rob ${edge.label}: panel je širok le ${fmtMm(glassWidth)}. Raje razdeli rob na enake dele ročno.`,
            })
          }
          panels.push(glassPanel(panels.length, edge, spec, glassWidth, glassHeightMm, glassBottomMm, cursorMm + piece / 2))
          cursorMm += piece
        }
      }
    } else {
      // Med stebri: en panel na razpon, minus širina stebra in tesnilo.
      for (const edge of edges) {
        const clear = edge.spanSpacingMm - spec.postSection.widthMm - 2 * spec.glass.sideGapMm
        if (clear < MIN_PANEL_MM) {
          warnings.push({
            severity: 'WARN',
            code: 'PANEL_SLIVER',
            edgeIndex: edge.index,
            message: `Rob ${edge.label}: svetla širina med stebrički je ${fmtMm(clear)} — preozko za steklo. Zmanjšaj razmik stebričkov.`,
          })
        }
        for (let s = 0; s < edge.spanCount; s++) {
          panels.push(glassPanel(panels.length, edge, spec, clear, glassHeightMm, glassBottomMm, edge.spanSpacingMm * (s + 0.5)))
        }
      }
    }
    checkGlassThickness(panels, spec, warnings)
  }

  const infillKind: PanelKind | null =
    spec.system === 'POST_MESH' ? 'MESH'
    : spec.system === 'POST_WOOD' ? 'WOOD'
    : spec.system === 'CUSTOM' ? 'CUSTOM'
    : null

  if (infillKind) {
    const panelHeight =
      infillKind === 'MESH' ? Math.min(spec.mesh.heightMm, infillHeightMm(spec))
      : infillKind === 'WOOD' ? infillHeightMm(spec)
      : spec.custom.heightMm
    const bottom = spec.baseOffsetMm + spec.glass.bottomGapMm
    for (const edge of edges) {
      const clear = hasPosts(spec)
        ? edge.spanSpacingMm - spec.postSection.widthMm - 2 * spec.glass.sideGapMm
        : edge.fabricationLengthMm
      for (let s = 0; s < Math.max(1, edge.spanCount); s++) {
        panels.push({
          index: panels.length,
          label: panelLabel(infillKind, panels.length + 1),
          kind: infillKind,
          edgeIndex: edge.index,
          world: pointAlong(edge, edge.spanSpacingMm * (s + 0.5), bottom),
          yawDeg: edge.yawDeg,
          widthMm: clear,
          heightMm: panelHeight,
          thicknessMm: infillKind === 'MESH' ? 4 : infillKind === 'WOOD' ? 20 : 60,
          bottomOffsetMm: bottom,
          areaM2: (clear / 1000) * (panelHeight / 1000),
        })
      }
    }
  }

  // ── 4. Pokrovna letev ───────────────────────────────────────────────────────
  const handrails: RailPiece[] = []
  if (hasHandrail(spec)) {
    const centreMm = spec.heightMm - spec.handrail.heightMm / 2
    for (const edge of edges) {
      handrails.push({
        index: handrails.length,
        label: `L${handrails.length + 1}`,
        kind: 'HANDRAIL',
        edgeIndex: edge.index,
        startWorld: pointAlong(edge, 0, centreMm),
        endWorld: pointAlong(edge, edge.fabricationLengthMm, centreMm),
        lengthMm: edge.fabricationLengthMm,
        // Zavoj v levo (pozitiven) vrže zunanjost vogala na DESNO glede na potek,
        // zato se kos, ki se tam KONČA, reže desno (+), kos, ki se tam ZAČNE, pa
        // levo (−). Oba kosa istega vogala imata zato enako velikost in nasproten
        // predznak — to je tisto, kar ju naredi spojiva.
        startMiterDeg: -miterDegrees(edge.startTurnDeg) * signOf(edge.startTurnDeg),
        endMiterDeg: miterDegrees(edge.endTurnDeg) * signOf(edge.endTurnDeg),
        startInteriorDeg: 180 - Math.abs(edge.startTurnDeg),
        endInteriorDeg: 180 - Math.abs(edge.endTurnDeg),
        widthMm: spec.handrail.widthMm,
        heightMm: spec.handrail.heightMm,
        isRound: spec.handrail.type === 'ROUND_42' || spec.handrail.type === 'ROUND_48',
        diameterMm: spec.handrail.type === 'ROUND_42' ? 42.4 : spec.handrail.type === 'ROUND_48' ? 48.3 : 0,
      })
    }
    if (spec.handrail.returnsAtEnds && !per.closed) {
      warnings.push({
        severity: 'INFO',
        code: 'HANDRAIL_RETURNS',
        message: 'Odprta konca: predvidena sta zaključna kapica / vračili pokrovne letev.',
      })
    }
  }

  // ── 5. Vodoravne palice ─────────────────────────────────────────────────────
  const bars: RailPiece[] = []
  if (spec.system === 'POST_BARS') {
    const bottom = spec.baseOffsetMm + spec.glass.bottomGapMm
    const top = infillTopMm(spec)
    const count = Math.max(0, Math.round(spec.bars.count))
    const step = count > 0 ? (top - bottom) / (count + 1) : 0
    for (let jIdx = 0; jIdx < count; jIdx++) {
      const yMm = bottom + step * (jIdx + 1)
      for (const edge of edges) {
        bars.push({
          index: bars.length,
          label: `P${jIdx + 1}-${edge.label}`,
          kind: 'BAR',
          edgeIndex: edge.index,
          startWorld: pointAlong(edge, 0, yMm),
          endWorld: pointAlong(edge, edge.fabricationLengthMm, yMm),
          lengthMm: edge.fabricationLengthMm,
          startMiterDeg: -miterDegrees(edge.startTurnDeg) * signOf(edge.startTurnDeg),
          endMiterDeg: miterDegrees(edge.endTurnDeg) * signOf(edge.endTurnDeg),
          startInteriorDeg: 180 - Math.abs(edge.startTurnDeg),
          endInteriorDeg: 180 - Math.abs(edge.endTurnDeg),
          widthMm: spec.bars.diameterMm,
          heightMm: spec.bars.diameterMm,
          isRound: spec.bars.shape === 'ROUND',
          diameterMm: spec.bars.diameterMm,
        })
      }
    }
    const gap = barGapMm(spec, top - bottom)
    if (gap > 120) {
      warnings.push({
        severity: 'WARN',
        code: 'BAR_GAP',
        message: `Svetel razmik med palicami je ${fmtMm(gap)} — več kot 120 mm. Dodaj palico ali zmanjšaj razmik (varnost otrok).`,
      })
    }
  }

  // ── 6. Osnovni profil ───────────────────────────────────────────────────────
  const baseProfiles: BaseProfilePiece[] = []
  if (hasBaseProfile(spec)) {
    for (const edge of edges) {
      const holes =
        spec.baseProfile.drainageSpacingMm > 0
          ? Math.round(edge.fabricationLengthMm / spec.baseProfile.drainageSpacingMm)
          : 0
      baseProfiles.push({
        index: baseProfiles.length,
        label: `U${baseProfiles.length + 1}`,
        edgeIndex: edge.index,
        world: pointAlong(edge, 0, spec.baseOffsetMm),
        yawDeg: edge.yawDeg,
        lengthMm: edge.fabricationLengthMm,
        widthMm: spec.baseProfile.widthMm,
        heightMm: spec.baseProfile.heightMm,
        drainageHoleCount: holes,
      })
    }
  }

  // ── 7. Preverbe na ravni projekta ───────────────────────────────────────────
  if (spec.system === 'FRENCH' && edges.some((e) => e.fabricationLengthMm > 3000)) {
    warnings.push({
      severity: 'WARN',
      code: 'FRENCH_LONG',
      message: 'Francoski balkon daljši od 3 m: preveri pritrditev v fasado in statiko.',
    })
  }

  return { closed: per.closed, edges, posts, panels, handrails, bars, baseProfiles, warnings }
}

// ── pomožne ───────────────────────────────────────────────────────────────────

function glassPanel(
  index: number,
  edge: EdgeLayout,
  spec: RailingSpec,
  widthMm: number,
  heightMm: number,
  bottomMm: number,
  centreOffsetMm: number,
): PanelPlacement {
  return {
    index,
    label: `ST${index + 1}`,
    kind: 'GLASS',
    edgeIndex: edge.index,
    world: pointAlong(edge, centreOffsetMm, bottomMm),
    yawDeg: edge.yawDeg,
    widthMm,
    heightMm,
    thicknessMm: spec.glass.thicknessMm,
    bottomOffsetMm: bottomMm,
    areaM2: (widthMm / 1000) * (heightMm / 1000),
  }
}

/**
 * Svetovna lega vzdolž roba: `offsetMm` od začetka, `heightMm` nad hodno površino.
 * Višina sledi naklonu plošče linearno, da ograja sede tudi na rob, ki ni v vodi.
 */
function pointAlong(edge: EdgeLayout, offsetMm: number, heightMm: number): Vec3 {
  const a = edge.startWorld
  const total = distanceXZ(a, edge.endWorld)
  if (offsetMm === 0 || total < 1e-5) {
    return { x: a.x, y: edge.baseY + heightMm / 1000, z: a.z }
  }
  const t = offsetMm / 1000 / total
  const dir = directionXZ(a, edge.endWorld)
  const slopeLift = (edge.endWorld.y - edge.baseY) * t
  return {
    x: a.x + dir.x * (t * total),
    y: edge.baseY + slopeLift + heightMm / 1000,
    z: a.z + dir.z * (t * total),
  }
}

function spacingFromPrevious(existing: PostPlacement[], world: Vec3): number {
  if (existing.length === 0) return 0
  return distanceXZ(existing[existing.length - 1].world, world) * 1000
}

function dominantSource(per: Perimeter, edgeIndex: number): DimensionSource {
  if (per.overridesMm[edgeIndex] !== undefined) return 'TAPE'
  const a = per.points[edgeIndex]
  if (!a) return 'MANUAL'
  const b = per.points[edgeIndex + 1] ?? per.points[0] ?? a
  // Šibkejši od obeh koncev omejuje, koliko je robu zaupati.
  return SOURCE_ACCURACY_MM[a.source] >= SOURCE_ACCURACY_MM[b.source] ? b.source : a.source
}

/** Svetli razmik med vodoravnimi palicami za dano višino polnila. */
export function barGapMm(spec: RailingSpec, rangeMm: number): number {
  const count = spec.bars.count
  if (count <= 0) return rangeMm
  return Math.max(0, (rangeMm - count * spec.bars.diameterMm) / (count + 1))
}

/**
 * Informativna največja širina panela pri dani debelini, za ~1 m visoko ograjo.
 * **Ni statični izračun** — za pravo dimenzioniranje glej `glass-model.ts` in
 * potrdi pri dobavitelju stekla ali statiku.
 */
function checkGlassThickness(panels: PanelPlacement[], spec: RailingSpec, warnings: LayoutWarning[]): void {
  const t = spec.glass.thicknessMm
  const maxByThickness =
    t <= 8.5 ? 900 : t <= 10.5 ? 1100 : t <= 12.5 ? 1300 : t <= 17.5 ? 1500 : t <= 22 ? 1800 : 2200
  const limit = maxByThickness * (spec.heightMm > 1100 ? 0.9 : 1)
  const tooWide = panels.filter((p) => p.widthMm > limit)
  if (tooWide.length > 0) {
    warnings.push({
      severity: 'WARN',
      code: 'GLASS_TOO_WIDE',
      edgeIndex: tooWide[0].edgeIndex,
      message:
        `${tooWide.length} panelov je širših od ~${Math.round(limit)} mm pri debelini ` +
        `${t.toFixed(2)} mm. Debeljše steklo ali več stebričkov. ` +
        '(Informativno — končno dimenzioniranje potrdi statik.)',
    })
  }
  if (spec.system === 'GLASS_CHANNEL' && spec.glass.type === 'ESG') {
    warnings.push({
      severity: 'WARN',
      code: 'GLASS_NOT_LAMINATED',
      message: 'Brezokvirna ograja s samim ESG: priporočeno je lepljeno steklo (VSG ali ESG/VSG), da ob razbitju ne pade ven.',
    })
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// REZALNI SEZNAM
// ══════════════════════════════════════════════════════════════════════════════

/** Kot žage, kot ga nastaviš na žagi: 0° = pravokoten rez. */
export function cutText(miterDeg: number, interiorDeg = 180): string {
  if (Math.abs(miterDeg) < 0.5) return 'pravokotno (0°)'
  return `žaga ${fmtDeg(miterDeg).replace('-', '')} ${miterDeg > 0 ? 'desno' : 'levo'} (notranji kot ${Math.round(interiorDeg)}°)`
}

/**
 * Rezalni seznam za delavnico: vsak kos, njegova dolžina in oba kota žage.
 * Manjkajoč kot je odpaden kos, zato so koti izračunani iz istih zasukov kot risba.
 */
export function cutList(layout: LayoutResult): CutListRow[] {
  const rows: CutListRow[] = []

  // Paneli, združeni po točni izdelavni meri (zaokroženo na mm — 1179,98 in 1180,02
  // sta za dobavitelja isti panel in ne smeta postati dve poziciji).
  const bySize = new Map<string, PanelPlacement[]>()
  for (const p of layout.panels) {
    const key = `${Math.round(p.widthMm)}x${Math.round(p.heightMm)}`
    const list = bySize.get(key)
    if (list) list.push(p)
    else bySize.set(key, [p])
  }
  const sortedKeys = [...bySize.keys()].sort((a, b) => {
    const [aw, ah] = a.split('x').map(Number)
    const [bw, bh] = b.split('x').map(Number)
    return bw - aw || bh - ah
  })
  for (const key of sortedKeys) {
    const group = bySize.get(key)!
    const [w, h] = key.split('x').map(Number)
    rows.push({
      part: group[0].kind === 'GLASS' ? 'Steklo' : group[0].kind === 'MESH' ? 'Mreža' : group[0].kind === 'WOOD' ? 'Les' : 'Element',
      label: group.map((g) => g.label).join(', '),
      dimension: `${w} × ${h} mm`,
      cutStart: '—',
      cutEnd: '—',
      qty: group.length,
    })
  }

  for (const r of layout.handrails) {
    rows.push({
      part: 'Pokrovna letev',
      label: r.label,
      dimension: fmtMm(r.lengthMm),
      cutStart: cutText(r.startMiterDeg, r.startInteriorDeg),
      cutEnd: cutText(r.endMiterDeg, r.endInteriorDeg),
      qty: 1,
    })
  }

  for (const b of layout.baseProfiles) {
    rows.push({
      part: 'U-profil',
      label: b.label,
      dimension: fmtMm(b.lengthMm),
      cutStart: 'pravokotno (0°)',
      cutEnd: 'pravokotno (0°)',
      qty: 1,
    })
  }

  // Palice iste dolžine v eno vrstico — žaga se nastavi enkrat.
  const barGroups = new Map<string, RailPiece[]>()
  for (const b of layout.bars) {
    const key = `${Math.round(b.lengthMm)}-${b.diameterMm}`
    const list = barGroups.get(key)
    if (list) list.push(b)
    else barGroups.set(key, [b])
  }
  for (const group of barGroups.values()) {
    const r = group[0]
    rows.push({
      part: 'Palica',
      label: group.map((g) => g.label).join(', '),
      dimension: `${Math.round(r.lengthMm)} mm (Ø${r.diameterMm})`,
      cutStart: cutText(r.startMiterDeg, r.startInteriorDeg),
      cutEnd: cutText(r.endMiterDeg, r.endInteriorDeg),
      qty: group.length,
    })
  }

  // Stebri po višini.
  const postGroups = new Map<number, PostPlacement[]>()
  for (const p of layout.posts) {
    const h = Math.round(p.heightMm)
    const list = postGroups.get(h)
    if (list) list.push(p)
    else postGroups.set(h, [p])
  }
  for (const [h, group] of [...postGroups.entries()].sort((a, b) => a[0] - b[0])) {
    rows.push({
      part: 'Stebriček',
      label: group.map((g) => g.label).join(', '),
      dimension: `${h} mm`,
      cutStart: 'pravokotno (0°)',
      cutEnd: 'pravokotno (0°)',
      qty: group.length,
    })
  }

  return rows
}

/** Število sider: po stebrih + na 300 mm pri U-profilu. */
export function anchorCount(layout: LayoutResult, spec: RailingSpec): number {
  const channel = layout.baseProfiles.length > 0 ? Math.ceil(totalRunMm(layout) / 300) : 0
  return channel + layout.posts.length * ANCHORS_PER_POST[spec.postFixing]
}

/** Povzetek za glavo ponudbe in za HUD v AR. */
export function summarise(layout: LayoutResult, spec: RailingSpec) {
  const severityRank: Record<Severity, number> = { INFO: 0, WARN: 1, ERROR: 2 }
  return {
    totalRunMm: totalRunMm(layout),
    postCount: layout.posts.length,
    panelCount: layout.panels.length,
    glassAreaM2: glassAreaM2(layout),
    handrailM: handrailLengthMm(layout) / 1000,
    anchorCount: anchorCount(layout, spec),
    cornerCount: cornerCount(layout),
    freeEndCount: freeEndCount(layout),
    maxSeverity: layout.warnings.reduce<Severity | null>(
      (worst, w) => (worst === null || severityRank[w.severity] > severityRank[worst] ? w.severity : worst),
      null,
    ),
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// LOKALNI KOORDINATNI OKVIR
// ══════════════════════════════════════════════════════════════════════════════
// AR koordinate (WebXR, ARCore) umrejo s sejo. Shranjen obseg zato živi v
// lokalnem okviru: prva točka v izhodišču, prvi rob vzdolž +X. Tako izmera
// preživi konec seje, drugo napravo in JSON — in jo je mogoče kadar koli znova
// postaviti v prostor z dvema dotikoma (začetni vogal + smer prvega roba).

export interface LocalFrame {
  originXM: number
  originYM: number
  originZM: number
  yawDeg: number
}

export const IDENTITY_FRAME: LocalFrame = { originXM: 0, originYM: 0, originZM: 0, yawDeg: 0 }

export function frameOrigin(f: LocalFrame): Vec3 {
  return { x: f.originXM, y: f.originYM, z: f.originZM }
}

export function toLocal(world: Vec3, origin: Vec3, yawDeg: number): Vec3 {
  const rad = (yawDeg * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const dx = world.x - origin.x
  const dz = world.z - origin.z
  return { x: dx * c - dz * s, y: world.y - origin.y, z: dx * s + dz * c }
}

export function toWorld(local: Vec3, frame: LocalFrame): Vec3 {
  const rad = (frame.yawDeg * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return {
    x: frame.originXM + local.x * c + local.z * s,
    y: frame.originYM + local.y,
    z: frame.originZM - local.x * s + local.z * c,
  }
}

/** Normalizira svetovni obseg: izhodišče v prvi točki, +X vzdolž prvega roba. */
export function frameFromWorld(points: Vec3[]): { points: Vec3[]; frame: LocalFrame } {
  if (points.length === 0) return { points: [], frame: IDENTITY_FRAME }
  const origin = points[0]
  const yaw = points.length >= 2 ? yawDegrees(directionXZ(origin, points[1])) : 0
  return {
    points: points.map((p) => toLocal(p, origin, yaw)),
    frame: { originXM: origin.x, originYM: origin.y, originZM: origin.z, yawDeg: yaw },
  }
}

/**
 * Okvir iz dveh dotikov za ponovno postavitev: `start` je prvi izmerjeni vogal,
 * `along` katerakoli točka naprej po prvem robu. Dva dotika sta minimum, ki
 * določi lego IN smer — en bi pustil ograji prosto vrtenje.
 */
export function frameFromTwoPoints(start: Vec3, along: Vec3): LocalFrame {
  const dir = directionXZ(start, along)
  const yaw = lengthXZ(dir) < 1e-4 ? 0 : yawDegrees(dir)
  return { originXM: start.x, originYM: start.y, originZM: start.z, yawDeg: yaw }
}

// ══════════════════════════════════════════════════════════════════════════════
// OBLIKOVANJE (slovensko, neodvisno od locale-a)
// ══════════════════════════════════════════════════════════════════════════════

/** `1234.5` → `1.234,5`. Decimalna vejica in pika za tisočice, vedno. */
export function fmtNumber(value: number, decimals = 1): string {
  const v = Number.isFinite(value) ? value : 0
  const divisor = Math.pow(10, decimals)
  const scaled = Math.round(Math.abs(v) * divisor)
  const intPart = Math.floor(scaled / divisor)
  const fracPart = scaled % divisor
  const grouped = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sign = v < 0 ? '\u2212' : ''
  return decimals > 0 ? `${sign}${grouped},${String(fracPart).padStart(decimals, '0')}` : `${sign}${grouped}`
}

export function fmtMm(value: number): string {
  return `${fmtNumber(value, 0)} mm`
}

export function fmtDeg(value: number): string {
  return `${fmtNumber(value, 1)}°`
}

export function fmtM(valueMetres: number): string {
  return `${fmtNumber(valueMetres, 2)} m`
}

export function fmtM2(value: number): string {
  return `${fmtNumber(value, 2)} m²`
}
