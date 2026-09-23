# Evalvacija S+6 — Qwen GPU Proof-of-Quality

Merilni sistem za odgovor na ENO vprašanje (spec S+6):

> Ali Qwen-Image-Edit-2509 izboljša vizualizacijo naše konkretne ograje, brez
> izgube identitete izdelka in brez nepotrebnega spreminjanja originalne fotografije?

## Dataset (dataset/)

6 realnih testov (isti vhodi kot dokazani A-pipeline testi — §5/§6):

| Test | §5 kategorija | Vir | Znana lastnost |
|---|---|---|---|
| S6-T1-ravna-antracit | raven balkon + antracitna ograja | S+3 T1 (balcony_3, mask_C) | S+1 dokazani vogali, 13=13 |
| S6-T2-perspektiva | balkon pod kotom | S+3 T2 (balcony_2) | perspektiva 1,2 % širine |
| S6-T3-osvetlitev | drugačna osvetlitev | S+3 T3 (balcony_4) | sončni gradient |
| S6-T4-occlusion-rastlinje | rastlinje / delno zakritje | S+3 T5 (balcony_0) | A: 94 % rastlin prebarvanih |
| S6-T5-svetlo-ozadje | svetla/drugače obarvana (PROXY) | S+4 T7 (balcony_4) | najvišje barvno-drift tveganje |
| S6-T6-occlusion-drevo | bonus §10: deblo v kvadru | S+4 T9 (balcony_6) | A: 67 % debla prebarvanega |

**Iskreno (§5 TEST 5):** prava SVETLA ograja kot izdelek ni na voljo med realnimi
fotografijami (fence_1/5 = CGI, fence_7 = realna, a z vodnim žigom + svetle letvice
so nad `CUTOUT_GRAY_THRESHOLD=115`, A-pipeline po zasnovi ključe temne letvice).
T5 je zato PROXY (svetlo ozadje, temen produkt). Zahtevan asset: prava svetla
ograja iz Roksal kataloga.

Vsak test ima ENAKE vhode za A in Qwen (§6): `original.jpg`, `mask.png`,
`placement.json`, `a_preview.jpg` (DOKAZAN A-pipeline, 13=13, ΔE 0.00), produkt
`product/product_bay.jpg` (fence_0 bay 460×660, 13 letvic).

## Instrument (metrics.py) — validiran (tests/test_metrics.py, 14/14)

| Metrika | Spec | Garancija |
|---|---|---|
| `background_preservation` (izven maska∪kvader) | §9 | identično→0; pokvarjeno izven→zaznano |
| `color_lab_delta` (LAB ΔE v rektificiranem pasu) | §12 | enak→0; prebarvano→ΔE 50 |
| `letvice_count` / `slat_period` (avtokorelacija) | §8 | sintetika 13→13, 7→7; sprememba strukture→zaznana |
| `edge_profile_correlation` | §11 | enaka struktura→1.0; spremenjena→0.18 |
| occlusion region (posebna regija) | §10 | izmerjeno na T4/T6 |

## Zaganjalnik (run_suite.py)

```bash
# 1) proti LASTNEMU GPU backend-u (spec §20):
python3 evaluation/run_suite.py --backend http://<GPU-IP>:8000 --determinism

# 2) uvoz zunaj pridobljenih Q slik (npr. Space UI / ročni run):
python3 evaluation/run_suite.py --import <dir-s-q-slikami>

# en test / samo finalize:
python3 evaluation/run_suite.py --backend URL --test S6-T1-ravna-antracit --modes finalize
```

Izhod: `output/results.json` (§13 zapisi) + `REPORT.md` (tabela §24 +
trakovi ORIGINAL | A | QWEN + odločitve PASS/FAIL iz meritev, ne mnenja).

`--determinism` (§18): ponovi T1 z istim seedom → bajtna primerjava izhodov.

## Rehearsal (MOCK)

`REPORT-MOCK-REHEARSAL.md` + `output-mock-rehearsal/` = celotna cevovod
preverjena z determinističnim mock backend-om ( Jasno označeno — NE kakovost
Qwen-a). Realni run zahteva GPU (glej gpu-backend/README.md, spec §1/§2).

## Zakaj ni realnih Q rezultatov v tem peskovniku (iskro)

- brez GPU/RAM/diska (merjeno: 0 GPU, 4.1 GB RAM, 2 GB prostora; model ~40 GB)
- brez Dockerja in brez poverilnic za najeto GPU
- ZeroGPU javni Space-i zavrnejo anonimne klice iz datacenter IP (dokazano:
  uradni Qwen 2509 + FLUX schnell, API IN brskalnik → `event: error, data: null`)
- vse skupnostne 2509 Space-i = ZeroGPU (raziskano); ModelScope zahteva račun

→ Glej [BLOCKED-SPACE-INFRA.md](BLOCKED-SPACE-INFRA.md) za dokaze.
