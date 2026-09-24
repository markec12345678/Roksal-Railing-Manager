# MANUAL MEASUREMENT — ročna meritev na zaslonu (issue #2 §2)

UI: `src/components/roksal/measurement-studio.tsx` (zavihek ✋ ROČNO).
Motor: isti `buildSession()` kot samodejni način → **pariteta**: isti vhodni
podatki = identičen rezultat, ne glede na način (test v
`measurement-sdk.test.ts`).

## Pot uporabnika

1. **Vir slike**: upload ali kamera (getUserMedia → zajem kadra → JPEG ≤1280 px).
2. **Referenčna mera** (obvezna za absolutne mm):
   - klik točko P1, klik točko P2 (na sliki, normalizirano 0..1),
   - vpiši znano dolžino v mm (0 < mm ≤ 100 000),
   - izberi vir: `user-known-measure` | `roksal-marker` | `known-object`.
   - Validacija: razdalja P1–P2 ≥ 2 % slike (sicer je merilo nestabilno).
3. **Spodnja linija** (path): klik 2..n prelomov (raven = 2, L = 3, U = 4+).
4. **Zgornja linija** (top): klik ENAKO število točk kot path.
5. **Stebri** (opcijsko): klik položajev.
6. Razveljavi zadnjo točko / počisti — vse točke so vidne na overlay platnu
   s zaporednimi številkami.
7. **IZRAČUNAJ MERITEV** → `POST /api/measurement/confirm` s
   `source: 'manual'`, `manual: { path, top, posts }`, `reference`,
   `confirmed: true`.

## Model geometrije

- `path[i] → path[i+1]` = **noga** (segment). Dolžina noge =
  `hypot(Δx, Δy) × merilo` — pravilno za raven, L in U tloris.
- `startMm` segmentov kumulativno (naraščajoče); vsota segmentov = skupna
  dolžina (invarianta, testirana).
- Višina = razlika max(yBottom) − min(yTop) v mm.
- Stebri: položaji v mm od najbolj levega x0.

## Popravljanje samodejne zaznave (hybrid)

Samodejna zaznava (features iz `/detect`) se lahko ročno popravi: vsak
premik točke šteje kot `manualCorrections`; source postane `hybrid`.
Stanje: `USER_REVIEW_REQUIRED` dokler uporabnik ne potrdi (`confirmed: true`
→ `VERIFIED`).

## Fail-safe (issue #2 §14)

- Brez referenčne mere sistem **ne vrne nobene mm vrednosti** — samo
  `SCALE_REQUIRED` z vodenjem ("Označite znano dolžino …").
- Zaznava ni uspela (`INSUFFICIENT_DATA`) → UI ponudi gumb "Preklopi na
  ročno meritev" — tok se nikoli ne sesuje (načelo iz OgrajaVizija
  fail-safe adapterja, docs/OGRAJEVIZIJA-CV-HARVEST.md §E).
