/**
 * PRODUCT SDK — TIPI (runda S+8 §3–§5).
 *
 * KLJUČNO PRAVILO (spec §6/§8/§19): produktna pravila so PODATKI (katalog),
 * geometrija je DETERMINISTIČNI izračun, AI NI vir produkta.
 *
 * Vrstni red transformacije (spec §10 — obratno PREPOVEDANO):
 *   ProductDefinition → FenceConfiguration → FenceLayout (produktni mm)
 *   → perspektiva (homografija A-pipeline) → balkonska slika.
 *
 * Material je LOČEN od geometrije (spec §7): Geometry + Material = Render.
 */

export type Orientation = 'horizontal' | 'vertical'
export type RightsStatus = 'pending' | 'granted' | 'rejected'
export type ProfileShape = 'rhombus' | 'solid' | 'board' | 'kubo'
export type ScrewVisibility = 'visible' | 'hidden'

/** Oblika in mere profila (iz kataloga — NI ugibanje). */
export interface ProductProfile {
  /** Uradno ime profila (katalog: profile). */
  name: string
  shape: ProfileShape
  /** Vidna ploskvica, po kateri se zlagajo deske (mm) — določa pitch. */
  faceWidthMm: number
  thicknessMm: number
  /** Standardne tovarniške dolžine (mm) — katalog. */
  standardLengthsMm: number[]
}

/** Barva iz katalog. palete — approxHex je null, če uradni podatek NE obstaja. */
export interface ProductColor {
  id: string
  name: string
  nameSl: string
  /** null = uradni podatek ne obstaja (NI izmišljen). */
  approxHex: string | null
  evidence: string
}

/** Pravila pritrditve (katalog: fixing/screwsVisible/max razmaki). */
export interface ProductMounting {
  screwVisibility: ScrewVisibility
  fixing: string
  /** Max razmak stebrov za orientacijo (mm) — null, če katalog ne navaja. */
  maxPostSpacingMm: number | null
  /** Max razmak vodoravnih cevi pri pokončni ograji (mm) — null = ni dokumentirano. */
  maxRailSpacingMm: number | null
  /** Pravilo zaključkov (čepi/letvica/pokrovček) — sprotno iz kataloga. */
  capRule: string
  handle: {
    available: boolean
    dimensionMm?: number[]
    screwsEveryMm?: number
    screwsVisible?: boolean
    maxSpliceMm?: number
  }
}

/** Materialna specifikacija — LOČENO od geometrije (spec §7). */
export interface ProductMaterialSpec {
  /** Paleta barv iz kataloga (imena potrjena; hex samo kadar uradno obstaja). */
  colors: ProductColor[]
  /** Površinska izvedba (katalog: material / posebnosti, npr. "rebrasta KLASIK"). */
  surface: string
  /** Server-side pot do teksture — samo ob rights: granted. */
  textureImage: string | null
}

export interface ProductAssets {
  productImage: string | null
  profileImage: string | null
  textureImage: string | null
  referenceImage: string | null
}

/**
 * Kanonična produktna definicija — IZKLJUČNO sestavljena s strani strežnika
 * iz data/roksal-catalog.json (spec §21 server-authoritative). Klient te
 * strukture NE sme poslati — vsak render jo naloži strežnik po productId.
 */
export interface ProductDefinition {
  /** Kanonični SDK id: "roksal.<family>.<profil>" (npr. roksal.woodcore.romb-67). */
  id: string
  /** Ključ v data/roksal-catalog.json (npr. woodcore-romb-67). */
  catalogProductId: string
  manufacturer: string
  family: string
  profile: ProductProfile
  orientations: Orientation[]
  mounting: ProductMounting
  board: {
    minGapMm: number
    maxGapMm: number
    canOverlap: boolean
  }
  material: ProductMaterialSpec
  assets: ProductAssets
  rights: RightsStatus
  sourceUrls: string[]
}

/**
 * Konfiguracija od klienta (spec §21): SAMO productId + konfiguracija +
 * placement — strežnik naloži pravi ProductDefinition iz kataloga.
 */
export interface FenceConfiguration {
  /** Kanonični SDK id ALI katalog productId (deterministično normalizirano). */
  productId: string
  orientation: Orientation
  /** Širina ograjnega polja v mm (realni svet). */
  spanMm: number
  /** Višina ograjnega polja v mm (realni svet). */
  heightMm: number
  /** Razmak med deskami v mm. */
  gapMm: number
  /** Barva iz katalog. palete (id). */
  colorId?: string
  /** Vrhnji ročaj — samo če definicija dovoljuje. */
  handle?: boolean
  /** Stebri: širina + pozicije (mm). Če pozicije niso podane, se izpeljejo
   *  deterministično iz maxPostSpacingMm (samo če katalog navaja vrednost). */
  posts?: { widthMm: number; positionsMm?: number[] } | null
}

// ---------- Geometrija (FenceLayout — spec §9, EDINI vir geometrije) ----------

export interface FenceBoard {
  /** Indeks od spodaj (horizontal) / od leve (vertical), 0-based. */
  index: number
  /** Začetek vidne ploskvice v mm (od spodaj/levo). */
  startMm: number
  /** Vidna višina/širina ploskvice v mm (po rezanju). */
  visibleMm: number
  /** true = zadnja deska odrezana (katalog: "se lahko reže na poljubne dolžine"). */
  cut: boolean
}

export interface FencePost {
  index: number
  /** Središče stebra v mm od levega roba. */
  centerMm: number
  widthMm: number
  role: 'terminal' | 'intermediate'
}

export interface FenceRail {
  index: number
  /** Središče vodoravne cevi v mm od spodaj (samo vertical ograje). */
  centerMm: number
  /** Presek cevi NI v katalogu — ni izmišljen (null = samo pozicija). */
  crossSectionMm: [number, number] | null
  role: 'terminal' | 'intermediate'
}

export interface FenceCap {
  side: 'left' | 'right' | 'top'
  /** Iz katalog accessories (npr. cep-romb-levo-desno, letvica-zakljucna). */
  kind: string
}

export interface FenceFastener {
  /** "board" = vijak ploskvice pri stebru; "handle" = vijak ročaja. */
  type: 'board' | 'handle'
  /** [xMm, yMm] — mm od zgornje-leve točke polja. */
  atMm: [number, number]
  /** Iz definicije (mounting.screwVisibility) — NI odločitev rendererja. */
  visible: boolean
  ref: string
}

export interface FenceLayoutBounds {
  widthMm: number
  heightMm: number
}

/**
 * FenceLayout = EKSPPLICITNA deterministična geometrija (spec §9):
 * boards[] + posts[] + rails[] + caps[] + fasteners[] + bounds + warnings[].
 * Maska (spec §11) se izdelá IZ te strukture — ne iz AI segmentacije.
 */
export interface FenceLayout {
  productId: string
  catalogProductId: string
  profile: string
  orientation: Orientation
  faceWidthMm: number
  gapMm: number
  pitchMm: number
  fenceWidthMm: number
  fenceHeightMm: number
  fieldHeightMm: number
  fieldSpanMm: number
  boardCount: number
  boards: FenceBoard[]
  posts: FencePost[]
  rails: FenceRail[]
  caps: FenceCap[]
  fasteners: FenceFastener[]
  handlePresent: boolean
  handleHeightMm: number
  bounds: FenceLayoutBounds
  warnings: string[]
  /** Izvorna definicija (sledljivost — vzorec "vsak podatek ima vir"). */
  definitionId: string
}

// ---------- Rezultat renderja + invarianta (spec §8) ----------

export interface InvariantCheck {
  group: 'GEOMETRY' | 'PRODUCT' | 'MOUNTING'
  name: string
  ok: boolean
  expected: string
  actual: string
}

export interface InvariantReport {
  renderValid: boolean
  checks: InvariantCheck[]
  failures: string[]
}

export interface RenderResult {
  /** RGBA slika (belo ozadje — združljivo z A-pipeline cutout pravilom). */
  image: { data: Uint8ClampedArray; w: number; h: number }
  layout: FenceLayout
  invariants: InvariantReport
  /** true SAMO če so vse invariante zelene — sicer rezultat NI validen produkt. */
  renderValid: boolean
  /** Od kje je prišla barva (sledljivost, spec §13). */
  materialProvenance: string
}
