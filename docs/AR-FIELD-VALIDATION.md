# Terenska validacija AR → Roksal (issue #15 — referenčni testni projekt)

**Status: SKELET — pripravljena digitalna resnica + protokol; fizična neodvisna merjenja = LASTNIŠKA AKCIJA.**

Unit testi NISO dokaz terenske natančnosti (issue #14 §18: 'Rezultate zapisati pred trditvijo o terenski natančnosti'). Ta dokument je protokol, ki ga lastnik izpolni na terenu; digitalni skelet referenčnega projekta je pripravljen (seed: `scripts/r283-referencni-projekt.cjs`, fikstura: `scripts/r283-referencni-fiksture.json`).

## 1. Referenčni testni projekt (issue #15 §1)

Projekt v sistemu: **`e2e-r283-ref-proj` — 'REF — Terenska validacija (issue #15)'** (lokalni dev seed; za produkcijo poženi seed proti produkcijski DB z lastnimi ID-ji).

Skelet nosi znane referenčne vrednosti iz nacrta — **NI izmerjene fizične resnice**:

| # | Vir | Segment | Ref. dolžina | Ref. višina | Ref. naklon/kot | Opomba |
|---|-----|---------|--------------|-------------|-----------------|--------|
| m1 | MANUAL | raven A + kot 90° | 3450 mm | 1000 mm | kot 90° | legacy dialekt (tip/kot badge) |
| m2 | PHOTO_CV | raven B | 2100 mm | 1000 mm | — | foto-CV prehod istega obiska |
| m3 | ARCORE_DEPTH | naklon + stopnice + raven C | 4800 / 1750 / 3450 mm | 1100 / 950 / 1000 mm | 8° / 35° / 0° | poln kontrakt v1, ponovni obisk, foto+GLB refs, profil ROMB 67, RAL 7016, ALU/WPC |

Checklist §1 (iz issue): raven segment ✓ · kot 90° ✓ · stopniščni segment ✓ · naklon ✓ · različne dolžine ✓ · višina ✓ · profil ✓ · barva/material ✓ · fotografije ✓ (photoRefs + segment photoIds, T3 integriteta) · ponovni obisk ✓ (sess-3, drug datum).

**Lastniška akcija:** fizične mere z neodvisnim merilnim postopkom (laserni meter + nivojnica/inklinometer) zapisati v tabelo §3.

## 2. Identiteta (issue #15 §2)

Preveriti na terenu, da Android in Manager uporabljata ISTI:

- project identity (`mobileProjectId` = `projectId` v kontraktu),
- measurement/session identity (`sessionId` v kontraktu),
- segment identity (stabilen `segmentId` — preživi re-anchor/offline/migracijo),
- version/contract metadata (`contractVersion` 1, `appVersion`).

**PASS kriterij:** prenos AR meritve NE ustvari novega nepovezanega projekta.

## 3. Meritve — zapisni list (issue #15 §3)

Za ISTI test zapisati rezultat za vsak vir; primerjati z referenčno fizično meritvijo (neodvisni postopek):

| Meritev | Vir | Rezultat | Kalibracija | Quality/confidence | Uncertainty | Timestamp | Fizična ref. | Δ |
|---------|-----|----------|-------------|--------------------|-------------|-----------|--------------|---|
| raven A | MANUAL | ______ | — | — | — | ______ | ______ | ______ |
| raven A | PHOTO_CV | ______ | ______ | ______ | ______ | ______ | ______ | ______ |
| raven A | ARCORE_DEPTH | ______ | ______ | ______ | ______ | ______ | ______ | ______ |
| stopnice | ARCORE_DEPTH | ______ | ______ | ______ | ______ | ______ | ______ | ______ |
| naklon | ARCORE_DEPTH | ______ | ______ | ______ | ______ | ______ | ______ | ______ |
| višina | MANUAL/AR | ______ | ______ | ______ | ______ | ______ | ______ | ______ |

**PASS kriterij:** Δ (odstopanje od fizične reference) zapisan za vsako vrstico — NIČ tiho izpuščenih meritev.

## 4. Propagacija (issue #15 §4)

V Managerju spremeniti AR meritev `3,20 m → 3,45 m` (oz. referenčni primer) in preveriti ponovni izračun:

- [ ] geometrija
- [ ] railing layout (stebri, profili, polnila, ročaj)
- [ ] BOM (količine)
- [ ] kalkulacija/pricing
- [ ] ponudba
- [ ] dokumenti (PDF/XLSX — kjer relevantno)

**PASS kriterij:** nič zastarelih izračunov — vse odvisne resnice sledijo spremembi. Ponoviti za višino, naklon, profil, konfiguracijo.

## 5. Geometrijska konsistenca (issue #15 §5)

Preveriti, da AR prikaz, canonical geometry, Roksal railing layout, native `RoksalFence` in GLB export predstavljajo ISTI potrjeni rezultat:

- [ ] kote (90° prelom)
- [ ] dolžine (3,45 m / 4,80 m / 1,75 m)
- [ ] višine (1,00 m / 1,10 m / 0,95 m)
- [ ] segmentne povezave (startMm/endMm veriga)
- [ ] slope (8° / 35° / 0°)

## 6. Fotografije in dokazljivost (issue #15 §6)

Po ponovnem odprtju projekta preveriti povezavo: Project → MeasurementSession → AR photo → calibration → measurement metadata → resulting geometry.

- [ ] foto refs razvidne (`photoRefs` + `segment.photoIds`)
- [ ] kalibracijski model razviden (`TWO_POINT_SCALE`, referenčna palica 1 m)
- [ ] quality/confidence razviden

## 7. Offline → online (issue #15 §7)

Na Androidu: odpreti projekt → izvesti meritev brez povezave → shraniti → ponovno vzpostaviti povezavo → sync → preveriti v Managerju.

Preveriti: idempotency (Idempotency-Key replay — R282 F replay test kanon), revision (monotone revizije — R282 F parallel test), conflict handling (R282 G scenarij §G 1–9), tombstones, audit, photos, project identity.

## 8. Konflikt (issue #15 §8)

Namenoma ustvariti spremembo istega projekta na obeh straneh (Manager + Android). Preveriti:

- [ ] konflikt NI skrit (UI konflikt žig + akcijski žig 'Konflikt — osveži bazo in ponovi sync' — R281/R282)
- [ ] nič tihega prepisa (obe verziji ohranjeni)
- [ ] revision/identity ohranjena
- [ ] razrešitev prek obstoječega /api/sync (osveži bazo GET delta + ponovi)
- [ ] audit nosi obe spremembi

## 9. Field-test gate (issue #14 §18)

Dejanski test (rezultate zapisati PRED trditvijo o terenski natančnosti):

1. [ ] balkon 3 m + 90°
2. [ ] stopnice
3. [ ] vrtna ograja 10–20 m
4. [ ] drift
5. [ ] re-anchor (2-tap + kalibracijska točka C)
6. [ ] calibration point C
7. [ ] depth confidence
8. [ ] zahtevne/glossy/glass površine
9. [ ] primerjava z dejanskimi meritvami

**Invariant (issue #14 §19):** `ar-android AFTER >= ar-android BEFORE` — noben integracijski korak ne sme poslabšati native AR resnice.

## 10. KEEP / PORT / ADAPT / DEFER / REJECT (issue #14 §16)

Vsaka integracijska sprememba nosi razvrstitev z dejanskim file/function dokazom — zapisovati v worklog ob vsaki rundi, ki se dotakne integracije.
