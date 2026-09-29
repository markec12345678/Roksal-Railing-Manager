// AR SKUPNI KONTRAKT (issue #17, sekcija A + D) — Roksal-stranski kanonični
// podatkovni kontrakt za MeasurementSession payload med BalkonAR (ar-android,
// Kotlin/ARCore — ločen repozitorij) in Roksal Manager.
// ---------------------------------------------------------------------------
// ISSUE #17 (production-readiness gate) — kaj ta modul dokazuje:
//
//   A. SHARED CONTRACT: canonical schema + stabilen projectId/sessionId/
//      segmentId + contractVersion + appVersion + source enum + eksplicitne
//      enote + coordinate frame + transformacija ARCore → shared frame +
//      calibration model + quality/confidence/uncertainty + photo references
//      + GLB/model references.
//   D. VERSIONING: contractVersion OBVEZEN; združljivostna matrika; napačna
//      verzija se ZAVRNE z izrecno napako (migracijska kljuka je definirana);
//      neznana prihodnja polja NE POVZROČIJO KORUPCIJE (strict — zavrnjena,
//      ne utišano odstranjena); originalni payload se pri neuspešni migraciji
//      NE IZGUBI (napaka nosi referenco na original).
//   B. (del) napaka payload-a NE SPREMINJA obstoječega projekta — modul je
//      ČIST (brez DB, brez ure, brez mreže, brez stranskih učinkov); route
//      /api/measurements validira PRED transakcijo.
//
// ── SEMANTIČNE ODLOČITVE (zapisane PRED razvojem — kanon R272/R273) ───────
//
//   1. SOURCE ENUM = enum iz issue #17 ('ARCORE_DEPTH' | 'MANUAL' |
//      'PHOTO_CV'). NI preslikave v MeasurementSource ('automatic' | 'manual'
//      | 'hybrid') iz src/lib/measurement/types.ts — to sta DVA različna
//      nivoja: skupni kontrakt (žični format) vs. foto-CV SDK (issue #2).
//      Preslikava med njima je IZRECNA odločitev prihajajoče runde, NI tiha
//      konverzija. Measurement SDK core NIČ (issue #17: obstoječa
//      infrastruktura se NE ponovno implementira NE oslabi).
//   2. ENOTE = 'mm' literal, OBVEZEN (issue #17 A: 'eksplicitne enote'; B:
//      'metri/enote ostanejo nespremenjene'). Vrednosti se NE zaokrožujejo:
//      lengthMm je finite pozitivno število (ARCore daje float mm; trak
//      integer mm) — zaokroževanje bi spremenilo pomen meritve (STOP
//      pogoj: 'se spremeni pomen obstoječih meritev').
//   3. NEZNANA POLJA = ZAVRNJENA (zod strict), NE utišano odstranjena.
//      Odločitev: 'unknown future fields ne povzročijo korupcije' iz issue
//      #17 se na fail-closed način doseže z ZAVRNITVO — tiho odstranjevanje
//      bi bilo implicitna degradacija kontrakta. Prihodnja polja se doda z
//      NOVO contractVersion + migracijsko kljuko, ki jih IZRECNO pozna.
//   4. NAPAČNA VERZIJA = zavrnjena z izrecno napako
//      AR_CONTRACT_VERSION_UNSUPPORTED, ki nosi seznam podprtih verzij IN
//      referenco na ORIGINALNI payload (ne izgubi se; D: 'originalni payload
//      se pri neuspešni migraciji ne izgubi'). Migracijska kljuka
//      migrateArSessionPayload: v1 = identiteta (isti reference, brez
//      mutacije); prihodnje verzije = eksplicitna migracija TUKAJ, ne na
//      klicalcu.
//   5. COORDINATE FRAME = 'LOCAL_NORMALIZED' (PRIMERJAVA.md §5.4: prva točka
//      v izhodišču, prvi rob vzdolž +X) kot EDINI canonical frame v1.
//      Transformacija ARCore → shared frame gre v opcijski `transform`
//      (anchorId + translacija v mm + rotacijski kvaternion [x,y,z,w]) —
//      validated passthrough, NIČ izumljenih transformacij.
//   6. ID-JI = passthrough VERBATIM (brez trim/normalize/case-fold — B:
//      'ID-ji ostanejo nespremenjeni'). Testi dokazujejo bajtno identičnost
//      prek round-trip serializacije.
//   7. F (SYNC) = NI vzporednega sync protokola (STOP pogoj: 'podvoji sync
//      protokol brez potrebe'). Kontrakt se vozi na OBSTOJEČI infrastrukturi
//      /api/measurements: resource authorization, API-key scope, rate
//      limiting, Idempotency-Key (exactly-once), audit v ISTI transakciji.
//      Sync-revizija/konflikt za meritve (baseRevision na session nivoju) =
//      ločena odločitev z DB resnico (E: zgodovina) — prihodnja runda, NE
//      tiho izumljeno v tej.
//   8. E (ZGODOVINA) = rešena v R276 (issue #16 §6 — verzije/predhodnikId/
//      korenId/vir + GET verzije + audit MEASUREMENT_VERSION; docs/
//      MEASUREMENT-HISTORY.md O1–O9).
//
// ── SEMANTIČNE ODLOČITVE SEGMENT KOTA (R277, issue #16 §3 — P1–P6, zapisane
//    PRED razvojem po kanonu O1–O9) ──────────────────────────────────────────
//
//   P1. ADITIVNA v1, NE contractVersion 2. angleDeg = OPCIONSKO polje v
//       obstoječi v1. Razlogi: (a) v1 v trenutku R277 NI ima še nobenega
//       produkcijskega writerja/readerja (ar-android integracija ni začeta —
//       issue #17 J je izrecno NI dokazan); (b) opcijsko polje = čista
//       dodatek v shemi — stari writer (v1 brez kota) ostane 100 % veljaven;
//       (c) edini nekompatibilni smer je stari STRICT reader × novi writer —
//       Manager R274–R276 bi tak payload ZAVRNIL z izrecno napako (fail-
//       closed, NIČ tihe izgube) in to okno se zapre z R277 deployom
//       (Manager deploy = minute, Android integracija = prihodnje tedne);
//       (d) dvig na v2 bi razbil zlati fixture + R274 ×31 + R275 ×15 testov
//       brez dejanske koristi. issue #16 §7 dovoljuje 'kompatibilna' sprememba
//       — ta je kompatibilna za VSE obstoječe writerje. Matrika spodaj nosi
//       razširitev izrecno.
//   P2. SEMANTIKA: angleDeg = smer segmenta v vodoravni ravnini (azimut) —
//       kot od LOCAL_NORMALIZED +X osi do smeri segmenta (start → end),
//       nasprotno urinega kazalca pozitiven (desnosučni sistem, +Y gor v
//       ravnini = matematični atan2(dy, dx) v stopinjah). Prvi segment v
//       LOCAL_NORMALIZED okviru je po definiciji 0°. Finite število; vrednost
//       in znak = resnica — kontrakt NE normalizira (brez wrapa na [0,360)
//       ali [−180,180] — normalizacija bi spremenila izmerjeno resnico;
//       precedens: slopeDeg znak = resnica, R272).
//   P3. IZMERJENO, NE IZPELJANO: angleDeg je neodvisna izmerjena resnica od
//       naprave — kontrakt NE izpeljuje kota iz koordinat/dolžin in Manager
//       NE računa nazaj. Izpeljava geometrije je BOM/geometry domena (core
//       NIČ). Start/end koordinat v1 NIMA (samo smer + dolžina) — dovolj za
//       nadaljnjo geometrijo, brez nove identitete (issue #16 §3).
//   P4. ENOTE = stopinje (deg), NE radiani — isti dogovor kot slopeDeg (v1:
//       mm za dolžine, deg za kote).
//   P5. IZOSTANEK ≠ NIČ: brez angleDeg = kot NI bil izmerjen (iskrena
//       praznina). Ekspliciten null = ZAVRJEN (z.number() ne sprejme null —
//       izostanek je edini način 'brez vrednosti'; NIKOLI ugibanje 0, saj je
//       0 realna izmerjena vrednost — prvi segment). NaN/Infinity zavrnjena
//       (finite). Strict ostaja: neznana polja (tudi tipografije 'kotDeg')
//       = zavrnitev, ne utišano odstranjevanje (odločitev 3 nespremenjena).
//   P6. DB/ROUTE NIČ: angleDeg gre v arMetadata JSON verbatim (route že
//       shrani kanonični payload; brez sheme — R276 je že naredil edini
//       schema-touch; ta runda brez migracije).
//
// Determinizem: enak vhod → enak izhod (brez ure, naključja, locale).
// Fail-closed: vsak neveljaven vhod = izrecna ArContractError s kodo.
// ---------------------------------------------------------------------------

import { z } from 'zod'

/** Trenutna kanonična verzija skupnega kontrakta (issue #17 D). */
export const AR_CONTRACT_VERSION = 1

/** Združljivostna matrika (issue #17 D: 'defined compatibility matrix') —
 *  branje: katera contractVersion je sprejeta in v kakšnem stanju je.
 *  Prihodnje verzije se doda SEM, ne z tiho toleranco pri razčlenjevanju. */
export const AR_CONTRACT_COMPATIBILITY = {
  // P1 (R277): v1 razširjen ADITIVNO z segments[].angleDeg (issue #16 §3 —
  // opcijsko; brez spremembe pomena obstoječih polj, brez migracije).
  1: { status: 'aktivna', uvod: 'R274 (issue #17 §A/§D)', razsiritev: 'R277 (issue #16 §3: segments[].angleDeg opcijsko — aditivno, P1–P6)' },
} as const

/** Podprte verzije — izpeljane iz matrike (EN vir). */
export const SUPPORTED_AR_CONTRACT_VERSIONS: readonly number[] =
  Object.keys(AR_CONTRACT_COMPATIBILITY).map(Number).sort((a, b) => a - b)

/** Izvor meritve v skupnem kontraktu (issue #17 B — 'source ostane
 *  ARCORE_DEPTH/MANUAL/PHOTO_CV'). Nižje črke NISO dovoljene. */
export const AR_SESSION_SOURCES = ['ARCORE_DEPTH', 'MANUAL', 'PHOTO_CV'] as const
export type ArSessionSource = (typeof AR_SESSION_SOURCES)[number]

/** Canonical coordinate frame v1 (PRIMERJAVA.md §5.4 — BalkonAR lokalni
 *  normalizirani okvir). Drugi tipi = NOVA contractVersion, ne tiho polje. */
export const AR_FRAME_TYPES = ['LOCAL_NORMALIZED'] as const
export type ArFrameType = (typeof AR_FRAME_TYPES)[number]

/** Kalibracijski modeli v1 (issue #17 A: 'calibration model'). */
export const AR_CALIBRATION_MODELS = ['TWO_POINT_SCALE', 'KNOWN_OBJECT', 'MARKER_PLATE'] as const
export type ArCalibrationModel = (typeof AR_CALIBRATION_MODELS)[number]

/** Izrecna napaka skupnega kontrakta — koda je del žične resnice (route
 *  jo vrača klientu; testi jo preverjajo). `payload` nosi ORIGINALNI vhod,
 *  ko migracija/razčlenjevanje odpove (issue #17 D — ni izgube). */
export class ArContractError extends Error {
  readonly code: string
  readonly pot: string | null
  readonly payload: unknown

  constructor(code: string, sporocilo: string, moznosti: { pot?: string; payload?: unknown } = {}) {
    super(sporocilo)
    this.name = 'ArContractError'
    this.code = code
    this.pot = moznosti.pot ?? null
    this.payload = moznosti.payload
  }
}

const mmStevilo = z.number().finite().positive()
const finiteStevilo = z.number().finite()
const referenca = z.strictObject({
  ref: z.string().min(1).max(300),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
})

/** Kanonična shema MeasurementSession payload-a (issue #17 A). STRICT:
 *  neznana polja = napaka (odločitev 3). */
const arSessionSchema = z.strictObject({
  contractVersion: z.literal(1),
  /** verzija Android aplikacije (provenance — issue #17 A 'appVersion') */
  appVersion: z.string().min(1).max(64),
  /** stabilen projekt — passthrough verbatim (odločitev 6) */
  projectId: z.string().min(1).max(128),
  /** stabilen measurementSessionId — passthrough verbatim (odločitev 6) */
  sessionId: z.string().min(1).max(128),
  source: z.enum(AR_SESSION_SOURCES),
  /** eksplicitne enote — samo mm (odločitev 2) */
  units: z.literal('mm'),
  coordinateFrame: z.strictObject({
    type: z.enum(AR_FRAME_TYPES),
    note: z.string().max(300).optional(),
  }),
  /** transformacija ARCore frame → shared frame (odločitev 5) */
  transform: z
    .strictObject({
      anchorId: z.string().min(1).max(128).optional(),
      translationMm: z.tuple([finiteStevilo, finiteStevilo, finiteStevilo]).optional(),
      rotationQ: z.tuple([finiteStevilo, finiteStevilo, finiteStevilo, finiteStevilo]).optional(),
    })
    .optional(),
  calibration: z
    .strictObject({
      model: z.enum(AR_CALIBRATION_MODELS),
      referenceMm: mmStevilo,
      note: z.string().max(300).optional(),
    })
    .optional(),
  quality: z
    .strictObject({
      confidence: z.number().finite().min(0).max(1).optional(),
      uncertaintyMm: mmStevilo.optional(),
      note: z.string().max(300).optional(),
    })
    .optional(),
  photoRefs: z.array(referenca).max(500).optional(),
  glbRefs: z.array(referenca).max(100).optional(),
  segments: z
    .array(
      z.strictObject({
        segmentId: z.string().min(1).max(128),
        lengthMm: mmStevilo,
        heightMm: mmStevilo.optional(),
        /** znak = del resnice (negativen naklon je legitimen — R272 precedens) */
        slopeDeg: finiteStevilo.optional(),
        /** R277 (issue #16 §3, P1–P6): smer segmenta v vodoravni ravnini
         *  (azimut, deg, CCW od +X; prvi segment v LOCAL_NORMALIZED = 0°).
         *  Izmerjena resnica — NE izpeljana (P3); znak/vrednost verbatim
         *  (P2); izostanek = ni izmerjeno, ekspliciten null zavrnjen (P5). */
        angleDeg: finiteStevilo.optional(),
        source: z.enum(AR_SESSION_SOURCES),
        measurementIndex: z.number().int().min(0).optional(),
      }),
    )
    .min(1)
    .max(1000),
})

export type ArSessionPayload = z.infer<typeof arSessionSchema>

/** Cenen diskriminator: je ta vhod payload skupnega kontrakta? True samo,
 *  če je objekt (ne array/null) z INTEGRALNO `contractVersion`. Route to
 *  uporablja za vrata: kontrakt-payload → strog gate; legacy payload (brez
 *  contractVersion — npr. obstoječi balkonar blok) → obstoječa pot
 *  nespremenjena (nadgrajevljivost, R148 vzorec 'stari klient obrati'). */
export function isArContractPayload(vhod: unknown): boolean {
  if (typeof vhod !== 'object' || vhod === null || Array.isArray(vhod)) return false
  const v = (vhod as Record<string, unknown>)['contractVersion']
  return typeof v === 'number' && Number.isInteger(v)
}

/** Migracijska kljuka (issue #17 D: 'napačna verzija se zavrne ALI
 *  eksplicitno migrira'). v1 → identiteta (ISTI reference — klicalec NE sme
 *  mutirati; testi to varujejo z deepFreeze). Nepodprta verzija →
 *  izrecna napaka z originalnim payload-om (ne izgubi se). */
export function migrateArSessionPayload(vhod: unknown): unknown {
  if (isArContractPayload(vhod)) {
    const verzija = (vhod as Record<string, unknown>)['contractVersion'] as number
    if (verzija === AR_CONTRACT_VERSION) return vhod
    throw new ArContractError(
      'AR_CONTRACT_VERSION_UNSUPPORTED',
      `Nepodprta contractVersion ${verzija} — podprto: ${SUPPORTED_AR_CONTRACT_VERSIONS.join(', ')}. Originalni payload je priložen napaki (ni izgube).`,
      { payload: vhod },
    )
  }
  throw new ArContractError('AR_CONTRACT_VERZIJA_MANJKA', 'Payload skupnega kontrakta mora nositi obvezen contractVersion (issue #17 D).', { payload: vhod })
}

/** Razčleni + validiraj payload skupnega kontrakta (issue #17 B: 'Roksal
 *  lahko payload validira'). ČIST — noben stranski učinek, vhod NI mutiran.
 *  Vrne kanonično (validated) obliko za zapis. */
export function parseArSessionPayload(vhod: unknown): ArSessionPayload {
  if (typeof vhod !== 'object' || vhod === null || Array.isArray(vhod)) {
    throw new ArContractError('AR_CONTRACT_NI_OBJEKT', `Payload skupnega kontrakta mora biti objekt (prejel: ${vhod === null ? 'null' : typeof vhod}${Array.isArray(vhod) ? ', array' : ''}).`)
  }
  if (!('contractVersion' in vhod)) {
    throw new ArContractError('AR_CONTRACT_VERZIJA_MANJKA', 'Payload skupnega kontrakta mora nositi obvezen contractVersion (issue #17 D).', { payload: vhod })
  }
  const verzija = (vhod as Record<string, unknown>)['contractVersion']
  if (typeof verzija !== 'number' || !Number.isInteger(verzija)) {
    throw new ArContractError('AR_CONTRACT_VERZIJA_NEVELJAVNA', `contractVersion mora biti celo število (prejel: ${String(verzija)}).`, { payload: vhod })
  }
  // Migracijska kljuka = ENA vrata za verzije (odločitev 4).
  const preveden = migrateArSessionPayload(vhod)
  const rezultat = arSessionSchema.safeParse(preveden)
  if (!rezultat.success) {
    const napake = rezultat.error.issues
      .map((i) => `${i.path.map(String).join('.') || '(koren)'}: ${i.message}`)
      .join('; ')
    throw new ArContractError(
      'AR_CONTRACT_VALIDACIJA',
      `Payload ne ustreza kanonični shemi skupnega kontrakta v${AR_CONTRACT_VERSION} — ${napake}`,
      { payload: vhod },
    )
  }
  return rezultat.data
}

/** Deterministična serializacija (enak payload → enak niz). Parsed oblika
 *  ima determinističen vrstni red ključev (red definicije sheme) — brez
 *  ure/locale/naključja. Round-trip: serialize(parse(x)) je idempotenten. */
export function serializeArSessionPayload(payload: ArSessionPayload): string {
  return JSON.stringify(payload)
}
