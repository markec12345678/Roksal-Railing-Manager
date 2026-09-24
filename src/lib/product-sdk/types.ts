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

/**
 * Max razmak konstrukcije za ENO orientacijo (S+8.1 §2 — P0).
 * null = katalog za to orientacijo NE dokumentira pravila → SDK zahteva
 * eksplicitne pozicije in NE ugiba (tudi NE s fallbackom druge orientacije).
 */
export interface OrientationSpacingRule {
  orientation: Orientation
  maxSpacingMm: number | null
}

/**
 * Kvalifikacijsko pravilo IZ kataloga (S+8.1 §2/§3) — ohranjeno 1:1, NIČ izmišljenega.
 * Samodejno se uporabi SAMO pravilo s strukturiranim pogojem (trenutno izključno
 * verticalOver150Cm: višina polja > 1500 mm); ostali so ohranjeni kot PODATKI
 * (npr. horizontalWithMidConnection — pogoj ni modeliran v konfiguraciji).
 */
export interface PostSpacingQualifier {
  /** Ključ TOČNO kot v katalogu (npr. "verticalOver150Cm"). */
  key: string
  orientation: Orientation
  maxSpacingMm: number
  /** Katalog pogoj (besedilo iz vira — sledljivost). */
  condition: string
  /** true = SDK ga uporablja ob izpolnjenem strukturiranem pogoju. */
  autoApplied: boolean
  /** Strukturiran pogoj: velja, ko je višina polja > prag (mm). */
  appliesWhenFieldHeightAboveMm?: number
}

/** Pravila pritrditve (katalog: fixing/screwsVisible/max razmaki). */
export interface ProductMounting {
  screwVisibility: ScrewVisibility
  fixing: string
  /**
   * S+8.1 §2 (P0): orientacijsko-specifična max razmaka stebrov — NI več ene
   * številke (prej: H vrednost zrušena čez V = izguba podatkov + izmišljen
   * fallback smeri H→V). null = za to orientacijo NI dokumentirano → eksplicitne
   * pozicije so OBVEZNE za izpeljavo stebrov.
   */
  maxPostSpacingByOrientation: { horizontal: OrientationSpacingRule; vertical: OrientationSpacingRule }
  /** Kvalifikatorji 1:1 iz kataloga (brez izgube podatkov; glej PostSpacingQualifier). */
  postSpacingQualifiers: PostSpacingQualifier[]
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
   *  deterministično iz orientacijsko-specifičnega maxPostSpacing (S+8.1 —
   *  samo če katalog pravilo dokumentira; sicer eksplicitne pozicije OBVEZNE).
   *  Pozicije morajo biti končne, unikatne, strogo naraščajoče in znotraj
   *  polja — kršitev = validation error (NI tišega popravljanja, S+8.1 §4/§5). */
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
