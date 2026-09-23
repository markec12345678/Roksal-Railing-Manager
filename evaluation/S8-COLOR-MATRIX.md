# S+8 — BARVNA MATRIKA (§15): temen / srednji / svetel × 3 profili

> P0 = svetel test (S+7 ugotovitev). Maska je iz FenceLayout — neodvisna od barve: isti layout, isti render geometrije, različen material.

| Profil | Orientacija | Odtenek | RGB (vir) | Gray | Reže (merjeno/pričakovano) | Neprozornost ploskvic | P0 prosojnost OK | Identiteta |
|---|---|---|---|---|---|---|---|---|
| ROMB DESKA-67 | horizontal | temen | #413e3e (izmerjeno iz S+7 referenčne fotografije …) | 100.1 | 10 / 10 | 0.905 | True | True |
| ROMB DESKA-67 | horizontal | srednji | #745c4a (izmerjeno iz S+7 referenčne fotografije …) | 125.1 | 10 / 10 | 0.9526 | True | True |
| ROMB DESKA-67 | horizontal | svetel (P0) | #f4f2ec (SYNTHETIC WHITE — uradni hex ne obstaja …) | 230.6 | 10 / 10 | 0.9983 | True | True |
| POLNA DESKA-128 | horizontal | temen | #413e3e (izmerjeno (neuradno)…) | 85.6 | 6 / 6 | 0.9088 | True | True |
| POLNA DESKA-128 | horizontal | srednji | #745c4a (izmerjeno iz S+7 (neuradno)…) | 114.5 | 6 / 6 | 0.966 | True | True |
| POLNA DESKA-128 | horizontal | svetel (P0) | #f4f2ec (SYNTHETIC WHITE…) | 236.3 | 6 / 6 | 0.9993 | True | True |
| POLNA DESKA-100 | vertical | temen | #413e3e (izmerjeno (neuradno)…) | 92.9 | 16 / 16 | 0.9035 | True | True |
| POLNA DESKA-100 | vertical | srednji | #968371 (izmerjeno iz S+7 (neuradno)…) | 150.5 | 16 / 16 | 0.9662 | True | True |
| POLNA DESKA-100 | vertical | svetel (P0) | #f4f2ec (SYNTHETIC WHITE…) | 236.7 | 16 / 16 | 0.9989 | True | True |

## Sklep (P0)
- SVETLI (WHITE, rgb 244,242,236 — synthetic, uradni hex ne obstaja): neprozornost ploskvic **0.998–0.999** — produkt NI prosojen.
- Barva ostane IZBRANI material (izmerjen RGB z odkrito neuradno provenanco); harmonizacija je luminance-only (±15 %, kroma a/b NESPREMENJENA — RAL varno, dokazano v A-pipeline testih).
- Maska = geometrija (FenceLayout), ne AI segmentacija, ne globalni prag — maska opisuje KJE je produkt, ne KAKŠNE BARVE je.