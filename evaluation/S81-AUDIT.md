# S+8.1 READ-ONLY AUDIT — PRODUCT SDK HARDENING (§1)

Datum: 2026-09-23 · Start HEAD: f1c2e87 · Metoda: evidence-first (datoteke prebrane v celoti,
NIČ spremenjeno pred izpisom tega poročila). Vir podatkov: `data/roksal-catalog.json`,
`src/lib/product-sdk/*`, `src/lib/product-catalog/index.ts`, `src/lib/procedural/fence-engine.ts`,
`src/app/api/viz/product-preview/route.ts`, vsi S+7/S+8 testi.

## 1. KJE SE PRODUKTNA GEOMETRIJA LAHKO IZPELJE DRUGAČE (popoln seznam poti)

| # | Pot izpeljave | Kliče | Ocena |
|---|---|---|---|
| G1 | `computeFenceLayout` (fence-engine) — deske/pitch/fieldSpan | SDK geometry (edini vir desk) | ✅ OK, determinističen |
| G2 | `derivePostPositions` — stebri iz `mounting.maxPostSpacingMm` | geometry.buildPosts | ❌ **F1** — zrušena orientacijska pravila |
| G3 | eksplicitne `posts.positionsMm` (klient) | geometry.buildPosts | ❌ **F2/F3** — tiho sortiranje, ni hard validacije |
| G4 | `maxSupportSpacingMm` (product-catalog) — POROČILO/S+7 tooling s7-dataset | NI v SDK geometriji | ✅ ločena pot, samo orodja — dokumentirano, ostane |
| G5 | `layoutMask()` — rekonstruira FenceRequest iz FenceLayout | mask.ts → renderFenceMask(req) BREZ layout arg | ❌ **F7** — drugi geometrijski izračun |
| G6 | `renderProductFence` — FenceRequest iz CONFIG (ne layout) | render.ts | ❌ **F7/F8** — konflikt config↔layout tiho |
| G7 | invariants postSpacing — proti zrušeni `maxPostSpacingMm` | invariants.ts | ❌ **F1** — napačen max pri validaciji |

## 2. UGOTOVLJENE NAPAKE (z dokazi)

**F1 (P0, §2/§3) — IZGUBA ORIENTACIJSKIH PRAVIL.** `catalog.ts:68`:
`maxPostSpacingMm: p.maxPostSpacingMm.horizontal ?? p.maxPostSpacingMm.vertical ?? null`.
Dokazane posledice (katalog JSON):
- POLNA 128: katalog H=1100, **V=1800, verticalOver150Cm=1500** → SDK vrne 1100 za VSE orientacije
  (vertikalna ograja dobi preveč stebrov + kvalifikator izgubljen).
- ROMB 67: katalog H=1450, **V NE obstaja** → SDK vrne 1450 tudi za vertical
  = IZMISLJEN podatek (prepovedan fallback smeri H→V, spec §3).
- POLNA 100/57-32/128-V/ROMB-V/KUBO (vertical-only): vertical vrednost postane "maxPostSpacingMm"
  brez orientacije — napačna smer fallbacka (V→H).
- DESKA 150: kvalifikator `horizontalUpperBound: 1400` izgubljen.
- ROMB 67: `horizontalWithMidConnection: 1800` izgubljen.
Potrošniki zrušene vrednosti: derivePostPositions, buildPosts interval check, invariants.postSpacing.

**F2 (P0, §4) — POST IZVEN POLJA = SAMO OPOZORILO.** `geometry.buildPostRailWarnings` doda
warning; layout nastane; invariants NE preveri post bounds → post pri −500 ali 5000 mm lahko
 doseže `renderValid = true`. Krši spec §4 (hard validation → 400/validation error).

**F3 (P0, §4/§5) — TIHA POPRAVILA + MANJKAJOČE VALIDACIJE POSTOV.** Eksplicitne pozicije se
TIHO SORTIRAJO (`sort((a,b)=>a-b)` — spec §10: nikoli silent correction); NaN/Infinity preidejo
vse primerjave (`NaN<0` in `NaN>span` sta false); duplicirane pozicije niso odkrite;
ne-monotono naraščajoče sprejete; interval > katalog max = warning (ne validation error).

**F4 (P1, §6) — CEVI BREZ EKSPPLICITNE VALIDACIJSKE PLAŠČE.** Rails se izpeljejo (edini vir),
crossSectionMm=null ohranjeno ✅, a ni validacije bounds/monotonije/duplikatov/max razmaka in
invarianta "rails ⇒ vertical" je samo posredna.

**F5 (P1, §7) — NEPOPOLNE BOARD INVARIANTE.** Preverjena je samo `0 < visibleMm <= faceWidthMm`.
Manjka: unikaten index, startMm ≥ 0, startMm+visibleMm ≤ fieldSpanMm, zaporedna vrzel == gapMm
(razen terminal/cut), boardCount === boards.length, zadnja deska znotraj fieldSpan.

**F6 (P1, §8) — BOUNDS KONSISTENTNOST NI ZAKLENJENA.** bounds = config.span/height;
fenceWidth/Height/fieldSpan iz engine-a — danes konsistentno po konstrukciji, a brez testov za
horizontal/vertical/handle/odrezana zadnja/exact-fit/en deska/zelo ozko polje.

**F7 (P0, §9) — MASKA IMA DVE GEOMETRIJSKI POTI.** `layoutMask()` sestavi FenceRequest iz
FenceLayout in pokliče `renderFenceMask(req)` BREZ eksplicitnega layout-a → engine Ponovno
izračuna geometrijo iz rekonstruiranega requesta (divergenčna pot iz spec §9). Render podobno
gradi req iz config vrednosti. Če config ≠ layout (spec §10 primer: span 3000 vs bounds 2800)
se render in maska lahko razlikujeta. Engine ŽE podpira podan layout (`renderFence(req, lay)`,
`renderFenceMask(req, lay)`) — popravek je prehod na EEN rasterizacijski vir.

**F8 (P1, §10) — TIHO ZAUPANJE KONFLIKTnim VHODOM.** `renderProductFence(options.layout)` z
drugačnim configom → brez opozorila uporabi layout geometrijo (pxPerMm iz layout), material pa
iz config. Dodatno: `handle: true` pri profilu brez ročaja se TIHO IGNORIRA (brez warninga!).

**F9 (P0, §11) — RIGHTS GATE NIKOLI NE BLOKIRA pending.** Route: `rejected → 403` ✅,
`pending` → dovoljen (samo oznaka v odgovoru). Ni eksplicitnega development/evaluation flaga;
NODE_ENV ni uporabljen (dobro) — ampak pravilnika sploh ni. Komentar v ruti obljublja
"pending → samo interno development/evalvacijo" — izvedba tega NE zagotavlja.

**F10 (P1, §12) — BARVNA IDENTITETA: večinoma trdno, 1 vrzel.** Neznana barva → throw ✅,
approxHex=null → throw (ni izmišljeno) ✅, measuredRgb provenanca "measured/unofficial" ✅,
manjkajoč colorId+brez measuredRgb → throw ✅. VRZEL: route lovi resolveMaterial napako v
zunanjem catch → **500** namesto 400 (API semantika).

**F11 (P1, §13) — KUBO: horizontal = SAMO WARNING.** Layout za nepodprto orientacijo nastane
(z warningom); invarianta orientation pade šele pri renderju (422). Spec: horizontal → invalid
(čisto zavrnjen). KUBO maxPostSpacing=null ✅ (ni izmišljen), rail 1000 ✅.

**F12 (§14) — DETERMINIZEM: jedro čisto, guard ozek.** Engine+SDK brez naključja (grainModifier
= sin, čista funkcija); guard skenira samo 4 žetone (z-ai-web-dev-sdk, createVision,
chat.completions, Math.random) — ne skenira Date.now/UUID/randomBytes/fetch; determinizem test
obstaja za 2 klica, ne ≥100 ponovitev z checksum.

**F13 (§17) — AI TAKEOFF NI SDK ODVISNOST.** /api/ai-takeoff + /api/ar/analyze obstajata
(ostaneta, spec). Import graf: product-sdk → product-catalog → JSON; procedural → product-catalog;
product-preview route → sharp/zod/viz/product-sdk — NI AI uvoza. Guard test to zaklene.

**F14 — OPOMBA o limitaciji (ne napaka).** Layout vsebuje vertical board fasteners (board@rail),
engine jih ne riše (S+7 dokumentirana vizualna limitacija) — maska/render ostajata konsistentna
(maska ne vsebuje vijakov, vijaki so temnejši piksli ZNOTRAJ desk). V S+8.1 NE spreminjam
render algoritma (§16 regresija, §18 brez UI).

## 3. KAJ JE DETERMINISTIČNO / GENERATIVNO / VARNOST (vprašanja iz spec §1)

- Source-of-truth geometrije: `computeFenceLayout` (S+7) + `buildFenceLayout` (S+8) — PODATEK
  (katalog JSON) + čista aritmetika. ✅ generativne poti v tej verigi NI.
- Generativni endpointi (ostanejo izven SDK, nič ne brišem): /api/ai-takeoff (VLM ugiba mere,
  DEPRECATED za geometrijo — issue #2 bo zamenjal), /api/ar/analyze (eksperimentalna sugestija).
- Pravicna vrata: pending → 403 v production načinu (popravek F9), evaluation flag ekspliciten.

## 4. NAČRT POPRAVKOV (po tem poročilu, brez UI sprememb)

P0: F1 (orientacijska pravila + kvalifikatorji), F2+F3 (hard validacija postov), F7 (ena
rasterizacijska pot), F9 (rights gate z ROKSAL_RIGHTS_MODE).
P1: F4 (rail validacija), F5 (board invariants), F6 (bounds testi), F8 (konflikti → hard fail,
ročaj → hard fail), F10 (400 za material), F11 (nepodprta orientacija → throw, KUBO H → invalid).
Testi: §14 determinizem ≥100, §15 adversarial matrika, §16 regresija, §17 guard razširjen.
