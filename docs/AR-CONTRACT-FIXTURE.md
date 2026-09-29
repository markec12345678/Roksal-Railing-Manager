# AR skupni kontrakt — zlati fixture v1 (BalkonAR ↔ Roksal)

**VIR RESNICE:** `src/lib/__tests__/fixtures/ar-session-golden-v1.json`
(ta datoteka je kanonični primer; testi `r275-ar-fixture.test.ts` ×15 varujejo,
da je veljaven skozi `src/lib/ar-contract.ts` in determinističen round-trip.
Spodnja kopija je IZOBRAŽEVALNA — pri spremembi kontrakta se najprej spremeni
JSON + shema + testi, šele potem dokument.)

Kontrakt: **MeasurementSession v1** — R274 (issue #17 §A/§B/§D), semantične
odločitve 1–8 v glavi `src/lib/ar-contract.ts`.

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
| `segments[].segmentId` | `String` | `String 1..128` | stabilen ID segmenta |
| `segments[].lengthMm` | `Float` | `finite > 0` | float mm NEzaokrožen (3200.75 preživi) |
| `segments[].heightMm` | `Float?` | `finite > 0` | opcijsko |
| `segments[].slopeDeg` | `Float?` | `finite` | ZNAK = del resnice (negativen naklon legitimen — R272 precedens) |
| `segments[].source` | enum `SessionSource` | kot `source` | per-segment izvor |
| `segments[].measurementIndex` | `Int?` | `Int ≥ 0` | opcijsko |

Stropi: `photoRefs` max 500, `glbRefs` max 100, `segments` min 1 / max 1000.

---

## Kotlin data classes (kotlinx.serialization — imena polj = žica 1:1)

```kotlin
@Serializable
enum class SessionSource { ARCORE_DEPTH, MANUAL, PHOTO_CV }

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
data class ArSegment(
    val segmentId: String,                     // 1..128, verbatim
    val lengthMm: Double,                      // > 0, NEzaokrožen
    val heightMm: Double? = null,
    val slopeDeg: Double? = null,              // znak = del resnice
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
- `sinceRevision`/`baseRevision` na session nivoju (E: zgodovina meritev) =
  ločena SEMANTIČNA ODLOČITEV z DB resnico — prvi schema-touch od R154;
- terenska validacija (J) ostaja lastniška akcija.
