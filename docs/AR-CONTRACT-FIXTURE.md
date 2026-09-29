# AR skupni kontrakt — zlati fixture v1 (BalkonAR ↔ Roksal)

**VIR RESNICE:** `src/lib/__tests__/fixtures/ar-session-golden-v1.json`
(ta datoteka je kanonični primer; testi `r275-ar-fixture.test.ts` ×15 varujejo,
da je veljaven skozi `src/lib/ar-contract.ts` in determinističen round-trip.
Spodnja kopija je IZOBRAŽEVALNA — pri spremembi kontrakta se najprej spremeni
JSON + shema + testi, šele potem dokument.)

Kontrakt: **MeasurementSession v1** — R274 (issue #17 §A/§B/§D), semantične
odločitve 1–8 v glavi `src/lib/ar-contract.ts`; **R277 razširitev (issue
#16 §3)**: `segments[].angleDeg` opcijsko (aditivno — odločitve P1–P6 v glavi
`src/lib/ar-contract.ts`; verzija ostane 1, zlati fixture ostane brez novega
polja — minimalni+polni primer v1); **R278 razširitev (issue #16 §3)**:
`segments[].startMm`/`endMm` opcijsko (aditivno — odločitve Q1–Q6 v glavi
`src/lib/ar-contract.ts`; ista disciplina — verzija ostane 1, fixture brez
novih polj); plus `segments[].confidence`/`uncertaintyMm` opcijsko
(isti kanon — odločitve S1–S6 v glavi `src/lib/ar-contract.ts`); **R279
razširitev (issue #16 §9)**: `segments[].photoIds`/`modelIds` opcijsko —
verbatim reference v session-level nize + superRefine referenčna integriteta
(nič osirotelih referenc; T1–T5 v glavi `src/lib/ar-contract.ts`); **R280
razširitev (issue #16 §3 — ZADNJI ostanki §3)**: `segments[].profile`/
`color`/`material`/`handrail`/`posts`/`configuration` opcijsko (aditivno —
odločitve U1–U6 v glavi `src/lib/ar-contract.ts`; RAZMEJITEV KONTRAKT vs.
BUSINESS: produkt reference = OPAZOVANE/POTRJENE terenske oznake
(provenance), NIKOLI business resnica — BOM/geometry/pricing core NE
importira kontrakta (strukturni test) in parse NE izpeljuje NIČESAR iz teh
polj (invariančni test); NE enumi kataloga = nič vzporednega vira resnice).

---

## Zlati payload (vse polje v1 izkorščeno)

```json
{
  "contractVersion": 1,
  "appVersion": "BalkonAR 0.9.2",
  "projectId": "balkonar-proj-2026-09-29-001",
  "sessionId": "sess-2026-09-29-0730-a4f3",
  "source": "ARCORE_DEPTH",
  "units": "mm",
  "coordinateFrame": {
    "type": "LOCAL_NORMALIZED",
    "note": "prva točka = levi spodnji vogel; prvi rob vzdolž +X (PRIMERJAVA.md §5.4)"
  },
  "transform": {
    "anchorId": "anchor-01",
    "translationMm": [0, 0, 0],
    "rotationQ": [0, 0, 0, 1]
  },
  "calibration": {
    "model": "TWO_POINT_SCALE",
    "referenceMm": 1000,
    "note": "1 m trak med točkama A/B"
  },
  "quality": {
    "confidence": 0.92,
    "uncertaintyMm": 8.5,
    "note": "mat površina, enakomerna svetloba"
  },
  "photoRefs": [
    { "ref": "ar/photo-001.jpg", "sha256": "aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44" },
    { "ref": "ar/photo-002.jpg" }
  ],
  "glbRefs": [
    { "ref": "ar/scan-001.glb", "sha256": "ff00ee11dd22cc33bb44aa55ff00ee11dd22cc33bb44aa55ff00ee11dd22cc33" }
  ],
  "segments": [
    { "segmentId": "seg-001", "lengthMm": 3200.75, "heightMm": 1200, "source": "ARCORE_DEPTH", "measurementIndex": 0 },
    { "segmentId": "seg-002", "lengthMm": 900, "heightMm": 1200, "slopeDeg": -2.5, "source": "MANUAL", "measurementIndex": 1 },
    { "segmentId": "seg-003", "lengthMm": 450.25, "source": "PHOTO_CV" }
  ]
}
```

Minimalni veljaven payload (samo obvezna polja — vse ostalo izpustljivo):

```json
{
  "contractVersion": 1,
  "appVersion": "BalkonAR 0.9.2",
  "projectId": "proj-min",
  "sessionId": "sess-min",
  "source": "MANUAL",
  "units": "mm",
  "coordinateFrame": { "type": "LOCAL_NORMALIZED" },
  "segments": [{ "segmentId": "seg-min", "lengthMm": 3000, "source": "MANUAL" }]
}
```

---

## Preslikavna tabela (žica ↔ Kotlin ↔ Roksal omejitev)

| Žica (JSON ključ) | Kotlin tip | Roksal omejitev (zod) | Opomba |
|---|---|---|---|
| `contractVersion` | `Int` (literal 1) | `z.literal(1)` | OBVEZEN; druga verzija → `AR_CONTRACT_VERSION_UNSUPPORTED` (original ni izgubljen) |
| `appVersion` | `String` | `String 1..64` | provenance Android aplikacije |
| `projectId` | `String` | `String 1..128` | passthrough VERBATIM — brez trim/case-fold (odločitev 6) |
| `sessionId` | `String` | `String 1..128` | stabilen ID seje — passthrough verbatim |
| `source` | enum `SessionSource` | `z.enum(['ARCORE_DEPTH','MANUAL','PHOTO_CV'])` | nizke črke NISO veljavne; SDK enuma `automatic/manual/hybrid` so DRUGI nivo (odločitev 1) |
| `units` | `String` (literal `"mm"`) | `z.literal('mm')` | eksplicitne enote; vrednosti NE zaokrožene (odločitev 2) |
| `coordinateFrame.type` | enum `FrameType` | `z.enum(['LOCAL_NORMALIZED'])` | edini canonical frame v1 (PRIMERJAVA.md §5.4) |
| `coordinateFrame.note` | `String?` | `String ≤ 300` | opcijsko |
| `transform.anchorId` | `String?` | `String 1..128` | opcijsko |
| `transform.translationMm` | `FloatArray?` (dolžina 3) | `z.tuple(finite ×3)` | mm; ne-finite zavrnjeno |
| `transform.rotationQ` | `FloatArray?` (dolžina 4) | `z.tuple(finite ×4)` | kvaternion [x,y,z,w] |
| `calibration.model` | enum `CalibrationModel` | `z.enum(['TWO_POINT_SCALE','KNOWN_OBJECT','MARKER_PLATE'])` | kalibracija se NE izgubi |
| `calibration.referenceMm` | `Float` | `finite > 0` | referenčna dolžina v mm |
| `quality.confidence` | `Float?` | `0..1` | opcijsko |
| `quality.uncertaintyMm` | `Float?` | `finite > 0` | opcijsko |
| `photoRefs[].ref` | `String` | `String 1..300` | stabilna referenca |
| `photoRefs[].sha256` | `String?` | regex `^[0-9a-f]{64}$` | malo črko, 64 hex |
| `glbRefs[]` | kot photoRefs | (ista oblika) | max 100 |
| `sync.mutationId` | `String?` | `String 1..128` | **R281 (issue #16 §10, V1–V6)**: 'mutation identity' — echo klientove mutacije; strop ENAK shemi `/api/sync/route.ts` (V5 — ENA resnica o mejah); verbatim brez trim/case-fold; OPAZOVANO stanje klienta, NIKOLI sync resnica (V3 — ta ostane v obstoječem /api/sync, 'strežnik ne zaupa klientu' R148) |
| `sync.deviceId` | `String?` | `String 1..128` | **R281**: 'device identity' — X-Device-Id resnica naprave; ista disciplina kot `mutationId` |
| `sync.baseRevision` | `Int?` | `Int ≥ 0` | **R281**: 'base revision' — revizija, ki jo je klient videl pred spremembo; 0 veljaven (R148 vzorec); negativno/necelo/niz/null zavrnjeno |
| `sync.baseUpdatedAt` | `String?` | `String 1..64` | **R281**: 'base revision/update timestamp'; strop 64 = shema /api/sync |
| `sync.syncRevision` | `Int?` | `Int ≥ 0` | **R281**: 'revision' — monotona strežniška syncRevision, ki jo je klient nazadnje VIDEL v serverState (echo — nikoli trditev o trenutni strežniški resnici, V3) |
| `sync.syncState` | enum `SyncState` | `z.enum(['synced','pending','conflict','error'])` | **R281**: 'sync state' — zaprt besednjak odjavnega čakalnega vrsta (§13 offline); OBVEZEN kadar je blok prisoten (V4 — blok brez stanja = dvosmerna izjava) |
| `sync.tombstone` | `Boolean?` | `z.boolean()` | **R281**: 'tombstone state' — true = lokalno označeno za brisanje; false = izrecno NE grobnica (oboje realna stanja, V4 — analog 0 iz S5); null zavrnjen |
| `segments[].segmentId` | `String` | `String 1..128` | stabilen ID segmenta |
| `segments[].lengthMm` | `Float` | `finite > 0` | float mm NEzaokrožen (3200.75 preživi) |
| `segments[].heightMm` | `Float?` | `finite > 0` | opcijsko |
| `segments[].slopeDeg` | `Float?` | `finite` | ZNAK = del resnice (negativen naklon legitimen — R272 precedens) |
| `segments[].angleDeg` | `Float?` | `finite` | **R277 (issue #16 §3, P1–P6)**: smer segmenta v vodoravni ravnini — azimut, deg, CCW od +X (prvi segment v LOCAL_NORMALIZED = 0°); izmerjena resnica, NE izpeljana; znak/vrednost verbatim (brez wrapa); izostanek = ni izmerjeno, ekspliciten null zavrnjen |
| `segments[].startMm` | `[Float, Float]?` | `finite ×2` | **R278 (issue #16 §3, Q1–Q6)**: izmerjena začetna točka v LOCAL_NORMALIZED vodoravni ravnini `[x, y]`, mm (enota v imenu); 2D NE 3D (z nosi heightMm/slopeDeg); NE izpeljano in NE križno preverjano proti lengthMm/angleDeg (skladnost = downstream geometrija domena); negativni koordinati veljavni — verbatim; izostanek = ni izmerjeno, ekspliciten null zavrnjen |
| `segments[].endMm` | `[Float, Float]?` | `finite ×2` | **R278 (issue #16 §3, Q1–Q6)**: izmerjena končna točka — ista disciplina kot `startMm` |
| `segments[].confidence` | `Float?` | `finite 0..1` | **R278 (issue #16 §3, S1–S6)**: flat per-segment zaupanje (NE nested quality — S2); meji 0 in 1 VELJAVNI (0 = naprava izrecno poroča nič zaupanja — S5); NE izpeljano iz calibration/session quality (S3); izostanek = ni poročano, ekspliciten null zavrnjen |
| `segments[].uncertaintyMm` | `Float?` | `finite > 0` | **R278 (issue #16 §3, S1–S6)**: flat per-segment negotovost, mm v imenu (kanon odločitev 2); ista disciplina kot `confidence` |
| `segments[].photoIds` | `[String]?` | `1..20 × (1..300)` | **R279 (issue #16 §9, T1–T5)**: verbatim reference v session-level `photoRefs[].ref` — povezava Project → MeasurementSession → Segment → Photo (EN VIR — nič podvajanja sekcije); NE-prazen niz (izostanek = edini 'brez'); fail-closed superRefine — osirotela referenca = zavrnitev (T3); verbatim brez trim/case-fold (T4) |
| `segments[].modelIds` | `[String]?` | `1..20 × (1..300)` | **R279 (issue #16 §9, T1–T5)**: verbatim reference v `glbRefs[].ref` — ista disciplina kot `photoIds` |
| `segments[].profile` | `String?` | `String 1..200` | **R280 (issue #16 §3, U1–U6)**: OPAZOVANA/POTRJENA terenska referenca profila (provenance), NIKOLI business resnica (U3 — core NE bere); verbatim brez trim/case-fold (U5); izostanek = ni opazovano, prazen niz in null zavrnjena (U4) |
| `segments[].color` | `String?` | `String 1..200` | **R280 (issue #16 §3, U1–U6)**: terenska barvna referenca — ista disciplina kot `profile` |
| `segments[].material` | `String?` | `String 1..200` | **R280 (issue #16 §3, U1–U6)**: terenska materialna referenca — ista disciplina kot `profile` |
| `segments[].handrail` | `String?` | `String 1..200` | **R280 (issue #16 §3, U1–U6)**: terenska referenca ročaja ('kjer je del potrjene konfiguracije') — vezna resnica konfiguracije ostane Deal Lock (issue #13); ista disciplina kot `profile` |
| `segments[].posts` | `String?` | `String 1..200` | **R280 (issue #16 §3, U1–U6)**: terenska referenca drogov — §11: posts v Roksalu DERIVED, kontrakt nosi samo oznako; ista disciplina kot `profile` |
| `segments[].configuration` | `String?` | `String 1..200` | **R280 (issue #16 §3, U1–U6)**: terenska konfiguracijska referenca — ista disciplina kot `handrail` |
| `segments[].source` | enum `SessionSource` | kot `source` | per-segment izvor |
| `segments[].measurementIndex` | `Int?` | `Int ≥ 0` | opcijsko |

Stropi: `photoRefs` max 500, `glbRefs` max 100, `segments` min 1 / max 1000.

---

## Kotlin data classes (kotlinx.serialization — imena polj = žica 1:1)

```kotlin
@Serializable
enum class SessionSource { ARCORE_DEPTH, MANUAL, PHOTO_CV }

@Serializable
enum class SyncState { synced, pending, conflict, error }   // R281 (§10): zaprt besednjak čakalnega vrsta

@Serializable
enum class FrameType { LOCAL_NORMALIZED }

@Serializable
enum class CalibrationModel { TWO_POINT_SCALE, KNOWN_OBJECT, MARKER_PLATE }

@Serializable
data class CoordinateFrame(
    val type: FrameType,
    val note: String? = null,
)

@Serializable
data class ArTransform(
    val anchorId: String? = null,
    val translationMm: List<Double>? = null,   // dolžina 3, mm
    val rotationQ: List<Double>? = null,       // dolžina 4, [x,y,z,w]
)

@Serializable
data class ArCalibration(
    val model: CalibrationModel,
    val referenceMm: Double,                   // > 0
    val note: String? = null,
)

@Serializable
data class ArQuality(
    val confidence: Double? = null,            // 0..1
    val uncertaintyMm: Double? = null,         // > 0
    val note: String? = null,
)

@Serializable
data class ArRef(
    val ref: String,                           // 1..300
    val sha256: String? = null,                // ^[0-9a-f]{64}$
)

@Serializable
data class ArSyncMeta(                          // R281 (issue #16 §10, V1–V6):
    // opazovano stanje klienta (provenance) — NIKOLI sync resnica; stropi
    // ENAKI shemi /api/sync (V5); verbatim brez trim/case-fold
    val mutationId: String? = null,             // 1..128
    val deviceId: String? = null,               // 1..128 — X-Device-Id resnica
    val baseRevision: Int? = null,              // ≥ 0 — revizija, ki jo je klient videl
    val baseUpdatedAt: String? = null,          // 1..64
    val syncRevision: Int? = null,              // ≥ 0 — nazadnje viden serverState.syncRevision
    val syncState: SyncState,                   // OBVEZEN kadar je blok prisoten (V4)
    val tombstone: Boolean? = null,             // true/false realni stanji; null ne pošiljati
)

@Serializable
data class ArSegment(
    val segmentId: String,                     // 1..128, verbatim
    val lengthMm: Double,                      // > 0, NEzaokrožen
    val heightMm: Double? = null,
    val slopeDeg: Double? = null,              // znak = del resnice
    val angleDeg: Double? = null,              // R277 (issue #16 §3): azimut CCW od +X, deg; izostanek = ni izmerjeno
    val startMm: List<Double>? = null,         // R278 (issue #16 §3): [x, y] mm — 2D fiksna dolžina; NE izpeljano, NE križno preverjano
    val endMm: List<Double>? = null,           // R278: ista disciplina kot startMm
    val confidence: Double? = null,            // R278 (issue #16 §3): 0..1, meji veljavni; flat — NE nested quality (S2)
    val uncertaintyMm: Double? = null,         // R278: mm > 0 (kanon odločitev 2)
    val photoIds: List<String>? = null,        // R279 (issue #16 §9): verbatim reference v photoRefs[].ref; NE-prazen; osirotela = zavrnitev (superRefine)
    val modelIds: List<String>? = null,        // R279: verbatim reference v glbRefs[].ref — ista disciplina
    val profile: String? = null,               // R280 (issue #16 §3): terenska referenca — provenance, NIKOLI business resnica (U3); verbatim 1..200
    val color: String? = null,                 // R280: ista disciplina kot profile
    val material: String? = null,              // R280: ista disciplina kot profile
    val handrail: String? = null,              // R280: terenska referenca — vezna resnica ostane Deal Lock (issue #13)
    val posts: String? = null,                 // R280: oznaka — posts v Roksalu DERIVED (§11)
    val configuration: String? = null,         // R280: terenska konfiguracijska referenca — ista disciplina kot handrail
    val source: SessionSource,
    val measurementIndex: Int? = null,
)

@Serializable
data class MeasurementSession(
    val contractVersion: Int = 1,              // literal 1 — drugo = zavrnjeno
    val appVersion: String,
    val projectId: String,
    val sessionId: String,
    val source: SessionSource,
    val units: String = "mm",                  // literal "mm"
    val coordinateFrame: CoordinateFrame,
    val transform: ArTransform? = null,
    val calibration: ArCalibration? = null,
    val quality: ArQuality? = null,
    val photoRefs: List<ArRef>? = null,        // max 500
    val glbRefs: List<ArRef>? = null,          // max 100
    val sync: ArSyncMeta? = null,              // R281 (issue #16 §10): opcijsko — izostanek = klient NI poročal sync stanja
    val segments: List<ArSegment>,             // 1..1000
)
```

Serializacija (primer):

```kotlin
val json = Json { encodeDefaults = true; explicitNulls = false }
val payload = json.encodeToString(MeasurementSession.serializer(), session)
// payload gre v arMetadata (POST /api/measurements) — Roksal ga validira
// skozi parseArSessionPayload PRED transakcijo (fail-closed).
```

⚠️ **KOMPATIBILNOST z Roksalovo strogostjo:** Kotlin `explicitNulls = false`
je OBVEZEN — `null` polja se IZPUSTIJO iz žice (Roksal shema je strict:
izpustljivo polje je veljavno, eksplicitni JSON `null` pri strict zod je
neznana vrednost → zavrnjen). Enako: ne pošiljajte polj, ki jih shema ne
pozna — tuj ključ → `AR_CONTRACT_VALIDACIJA` (ni tihega stripa, odločitev 3).

---

## Varnostne lastnosti, ki jih testi dokazujejo (`r275-ar-fixture.test.ts` ×15)

1. zlati fixture preide kanonično shemo (vse opcijske polje izkorščeno);
2. minimalni fixture (samo obvezna polja) prav tako preide;
3. round-trip `serialize(parse(x))` deep-enak vhodu (kanonična forma);
4. determinizem: dva parse-a → bajtno enak izhod;
5. float verbatim: `3200.75` NI zaokrožen;
6. eksotični ID-ji bajtno identični skozi round-trip;
7. neznano polje na korenu → `AR_CONTRACT_VALIDACIJA` (sporočilo nosi ključ);
8. neznano polje v segmentu → sporočilo nosi `segments.0` indeks;
9. tuji source (tudi `automatic/manual/hybrid`, `arcore_depth`) → zavrnjen;
10. napačne enote (`cm`, `m`) → zavrnjene;
11. prazni segments + negativna lengthMm → zavrnjeni;
12. slab sha256 (63 hex / velike črke) → zavrnjen, veljaven preide;
13. rotationQ arnost 3 → zavrnjena, 4 preide;
14. verzija 2 → `AR_CONTRACT_VERSION_UNSUPPORTED` z ORIGINALOM na napaki
    (ni izgube, D) — migracijska kljuka je ISTA vrata;
15. konstante verzij: `AR_CONTRACT_VERSION=1`, podprte `[1]`.

## Prenos (B → Roksal)

Payload gre kot `arMetadata` v `POST /api/measurements` (obstoječa
infrastruktura — NI vzporednega sync protokola, odločitev 7):
resource authorization, API-key scope, rate limiting, `Idempotency-Key`
(exactly-once), audit v ISTI transakciji. Napaka kontrakta → 400
`{error:'Neveljaven AR skupni kontrakt', code, pot, podrobnost}` — nič
zapisov, `Idempotency-Key` NI rezerviran (čist retry po popravku).
Legacy payload (balkonar blok brez `contractVersion`) obrati po stari poti
nespremenjen (nadgrajevljivost, R148 vzorec).

## Naslednji koraki (issue #15/#16)

- ar-android serializacija proti temu fixture-ju (Kotlin test z ISTIM
  zlatim primerom — bajtna pariteta `encodeToString` ↔ JSON datoteka);
- §10 sync metadata = KONTRAKT nivo rešen v R281 (V1–V6: opcijski `sync`
  blok nosi metadata, ki jih obstoječi Roksal Mobile Sync API potrebuje —
  issue #17 F: obstoječi sync model, brez vzporednega protokola). Strežniška
  resnica konfliktov ostane v `/api/sync` (detectSyncConflict — 'strežnik
  ne zaupa klientu'); MOREBITNI nadaljnji korak = per-measurement revizijski
  stolpci (schema-touch) — SAMO z lastniško odločitvijo, NI potrebe za
  obstoječ protokol;
- terenska validacija (J) ostaja lastniška akcija.
