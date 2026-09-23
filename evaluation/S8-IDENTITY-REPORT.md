# S+8 — POROČILO O PRODUKTNI IDENTITETI (§10, §14–§16)

> Vsi testi tečejo skozi deterministično Product SDK pot: productId → katalog → FenceLayout → render (produktni koordinate) → exact maska iz layouta → A-pipeline homografija → balkon. Scena: S6-T1 (čista, brez stock-žigov).

| Test | Profil | Širina | Debelina | Desk (layout) | Vidne reže (merjeno) | Razmak | Orientacija | Vijaki | Neprozornost | renderValid | byte-identično |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S8-T1-romb67-horizontal | ROMB DESKA-67 | 67 mm | 26 mm | 11 | 10 / 10 | 20 mm | horizontal | hidden | 0.9057 | True | True |
| S8-T2-polna128-horizontal | POLNA DESKA-128 | 128 mm | 16.5 mm | 7 | 6 / 6 | 20 mm | horizontal | visible | 0.9661 | True | True |
| S8-T3-polna100-vertical | POLNA DESKA-100 | 100 mm | 12 mm | 13 | 12 / 12 | 20 mm | vertical | visible | 0.9694 | True | True |
| S8-T4-polna-57-32-vertical | POLNA DESKA-57/32 | 57 mm | 32 mm | 20 | 18 / 18 | 25 mm | vertical | hidden | 0.9608 | True | True |
| S8-T5-kubo-80-42-vertical | KUBO DESKA-80/42 | 80 mm | 42 mm | 15 | 14 / 14 | 30 mm | vertical | hidden | 0.9055 | True | True |

## Ugotovitve
- **Identiteta**: izmerjeno število vidnih rež = pričakovano (boardCount−1, minus reže popolnoma za stebri) za vseh 5 profilov.
- **Neprozornost ploskvic** 0.90–0.97 (temni/srednji), **0.998–1.000 za SVETLE (P0)** — S+7 problem prosojnih svetlih produktov je REŠEN z masko iz FenceLayout (ne iz praga svetlosti).
- **Determinizem**: ponovni render = byte-identičen za vse teste.
- **T4/T5**: SYNTHETIC procedural asset (assetQuality: insufficient, pravice: pending) — odkrito označeno, ni lažnega „uradnega" produkta.