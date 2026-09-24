# MEASUREMENT QUALITY — kakovost merjenja (issue #2 §4)

**Ni AI confidence.** Vse metrike so objektivne, izračunane iz pikslov in
geometrije; vsaka je testirana (`src/lib/measurement/__tests__`).

## Stanja (en sam stroj, deterministični prehodi)

| Stanje | Pomen | Pogoj prehoda |
|---|---|---|
| `INSUFFICIENT_DATA` | ograje ni mogoče zaznati | ni veljavnega para linij (Hough) |
| `DETECTED` | struktura zaznana (samo iz /detect) | runs > 0 |
| `SCALE_REQUIRED` | zahteva referenčno mero | struktura + brez merila → `geometry = null` |
| `MEASUREMENT_READY` | izmerjeno, čaka potrditev | merilo + geometrija + brez popravk |
| `USER_REVIEW_REQUIRED` | ročni popravki prisotni | manualCorrections > 0 in ni confirmed |
| `VERIFIED` | uporabnik potrdil | `confirmed: true` |

Zakon: **nikoli ni "točne" mm vrednosti brez merila.** `SCALE_REQUIRED`
pomeni `geometry: null` — to je PRAVILNO vedenje, ne napaka.

## Metrike (`MeasurementQualityMetrics`)

| Metrika | Izračun | Cilj |
|---|---|---|
| `edgeDensity` | delež pikslov nad Otsu pragom | 0.02–0.30 (zunaj = sumljiva slika) |
| `lineSupportTop/Bottom` | glasovi črte / max glasovi | ≥ 0.5 |
| `lineCoverage` | delež dolžine črte z robovi (±2 px sonda) | ≥ 0.35 (prag veljavnosti) |
| `postSpacingConsistency` | 1 − (std razmakov / mean) | ≥ 0.8 |
| `temporalStability` | 1 − (povprečni pomik med frame-i / 5 %) | ≥ 0.9 (pri 2+ frame-ih) |
| `frames` | št. analiziranih kadrov | 1..3 |

## Negotovost (uncertainty)

- Osnova: **±1 px** v delovnem prostoru (480 px daljša stranica) =
  ±1/480 normalizirane enote.
- `uncertaintyMm = 2 px × mmPerUnit` za dolžine (rob začetka + rob konca),
  `2 px × mmPerUnitY` za višino.
- Izotropno merilo (fronto-parallel v1): če je referenca pod kotom ali
  kratka, je realna negotovost večja od navedene — zato je minimalna
  dolžina reference 2 % slike in UI vodi uporabnika k dolgi referenci
  (celotna širina slike).

## Merilo (scale) — sledljivost

`ResolvedScale = { mmPerUnitX, mmPerUnitY, reference: { p1, p2, knownMm, kind },
referenceLengthUnits }` — `kind` dokumentira VIR merila
(`user-known-measure` danes; `roksal-marker`, `known-object`, `depth-sensor`
pripravljena tipa). Vsaka izmerjena vrednost nosi `provenance` z virom
merila (npr. `detekcija (Hough runs × merilo iz user-known-measure)`).

## Neuspešni primeri — obnašanje

| Primer | Obnašanje |
|---|---|
| unifomna slika | NI robov → `INSUFFICIENT_DATA` |
| ograja brez reference | `SCALE_REQUIRED`, geometry null |
| referenca < 2 % slike | merilo zavrnjeno z razlogom |
| mm ≤ 0 ali > 100 000 | merilo zavrnjeno |
| meritev brez merila + projectId | 422, ni shranjeno |
| detekcija odbijena s strani uporabnika | ročni način vedno na voljo (fail-safe) |

## Test metodologija

Sintetične slike z znano geometrijo (temna ograja na svetlem ozadju: 2
pasova + N stebrov na determinističnih položajih): toleranca zaznave ±2 %
slike; pariteta samodejno ≡ ročno; determinizem 100× (SHA-256); zavrnitveni
primeri. Glej `src/lib/measurement/__tests__/measurement-sdk.test.ts`.
