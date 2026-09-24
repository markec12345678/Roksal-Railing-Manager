# AUTOMATIC DETECTION — samodejna zaznava ograje (issue #2 §1)

Implementacija: `src/lib/measurement/cv.ts` + `detect.ts`. Čist TypeScript,
brez odvisnosti, brez AI. Vse pragi so v `MEASUREMENT_CONSTANTS` (types.ts).

## Cevovod

1. **Siva (Rec. 601)**: `Y = (299·R + 587·G + 114·B)/1000 / 255`.
2. **Downscale** na delovno ločljivost (daljša stranica ≤ **480 px**, area-average,
   determinističen). Vse koordinate v naprej normaliziramo na 0..1 obeh osi,
   neodvisno od izvorne ločljivosti.
3. **Sobel 3×3** gradient (mag + smer), clamp na robu.
4. **Otsu prag** nad magnitudo → binarni robovi.
   - Degeneratna zaščita 1: max mag < 1e−6 (unifomna slika) → NI robov.
   - Degeneratna zaščita 2: Otsu išče t ∈ [1..255] — pri čisto bimodalnem
     histogramu {0, M} je t=0 trivialna rešitev, ki bi vse razglasila za robove.
5. **Dilacija 1 px** (8-sosednost) — premosti 1px luknje.
6. **Hough transform** (θ korak 1°, ρ kvantizacija 1 px, ρ ∈ [−diag, +diag]).
7. **Izbor vrhov**: lokalni maksimum 3×3 + minVotes = max(6, 0.15·maxVotes),
   nato **požrešna NMS** (±6 θ-binov, ±8 ρ-binov) — debela pasova razmaze isto
   črto čez več ρ-binov in bi sicer izrinila vertikalne stebre iz omejenega
   števila slotov (maxHoughPeaks = 40).
8. **Klasifikacija**: θ ≈ 90° (±12°) → horizontalna črta; θ ≈ 0°/180° (±12°) →
   vertikalna. Reprezentante z ρ izven slike (t≈180° isti veji) zavržemo.
9. **Extent projeksija**: za vsako črto sonda ±2 px vzdolž nje → obseg
   [from, to], pokritost, najdaljši presledek. Zavrnemo: len < 15 % dimenzije,
   gap > 12 % dolžine, coverage < 35 %.
10. **Združevanje horizontalnih**: sosednje črte (≤3 px) = isti rob → uteženo
    povprečje po podpori. **Glavni pas** = par top/bottom z najvišjo oceno
    (podpora + pokritost) in ločevanjem ≥ 6 % višine slike.
11. **Stebri**: vertikalne črte s prekrivanjem ≥ 60 % pasu [top+10 %, bottom−10 %];
    združevanje istega stebra do 14 px (oba roba deske + tiltna reprezentanta).
    Realni razmak stebrov (≥300 mm ≈ ≥24 px) je varno nad toleranco.
12. **Kotniki**: TL/TR/BR/BL glavnega pasa (kandidati za prihodnjo
    perspektivno korekcijo).

## Koordinatni sistemi

- **Delovni prostor**: downscale slika (≤480 px) — samo interno.
- **Normalizirani prostor (0..1)**: vse javne značilke (runs, posts, corners,
  referenčne točke). Neodvisen od ločljivosti fotografije in prikaza.

## Determinizem

Vse operacije so čiste funkcije pikslov: enak vhod → identičen izhod
(test: 100× detekcija + seja, SHA-256 identična). Brez naključja, ure, mreže.

## Znane meje (iskreno)

- Frontalni pogled z izrazitima zgornjo/spodnjo linijo ograje dela najbolje.
- Močno poševna perspektiva, gosta vegetacija ali nizek kontrast →
  `INSUFFICIENT_DATA` (sistem pravilno pove, da ne zna — ne ugiba).
- Višina pasa se bere na robu pasove (prvi rob nad pragom) — pri debelih
  letvicah je to zgornji rob zgornje letvice; ročni popravek točk vedno zmaga.
