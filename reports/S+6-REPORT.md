# S+6 — QWEN GPU PROOF-OF-QUALITY (poročilo)

**Datum**: 23. 9. 2026 · **Runda**: S+6 · **Base**: `0eed4f7` (S+5 zaključena)

## 1. Povzetek — odgovor na specifikacijo

Cilj S+6: dokazati z **meritvami in slikami**, ali Qwen-Image-Edit-2509 izboljša
vizualizacijo naše konkretne ograje **brez izgube identitete izdelka** in brez
nepotrebnega spreminjanja originalne fotografije (spec §NAJVAŽNEJŠI CILJ).

**Iskren tehnični rezultat te runde:**

| Stvar | Stanje |
|---|---|
| GPU backend (§1, lasten Docker+FastAPI, §20 pogodba) | ✅ ZGRADEN + POGODBA DOKAZANA (15/15 testov) |
| Realni Qwen-Image-Edit-2509 run (§7 A vs Q) | ⛔ **PENDING GPU / poverilnic** — blokada DOKAZANA, ne ugibana |
| Testni dataset (§5/§6, isti vhodi za A in Q) | ✅ 6 realnih testov, A-stolpec zapolnjen (13=13, ΔE 0.00) |
| Merilni instrument (§8–§13, objektivne metrike) | ✅ VALIDIRAN 14/14 (sintetika + realna A-slika) |
| Evalvacijski cevovod + poročilo (§24 tabela, trakovi) | ✅ REHEARSAL 13/13 (MOCK, jasno označeno) |
| Licenčni audit (§3) | ✅ model Apache-2.0 + celotna veriga BSD/MIT — poslovno OK |
| Vercel produkcija (A-pipeline) | ✅ NIČ sprememb — 228/228, tsc 0, ESLint 0 |

**GO/NO-GO (§23): NE MORE še biti izrečen v nobeno smer** — kriteriji zahtevajo
realne Q-rezultate. Kar je S+6 naredilo: vsi predpogoji za izrekanje so zdaj
zgrajeni, validirani in poravnani s specifikacijo; realni run je **en ukaz**
takoj, ko je GPU dosegljiv (spodaj: 3 poti).

## 2. Kaj je S+6 zgradil in dokazal

### 2.1 Lasten GPU backend (§1, §20) — `gpu-backend/`

```
Vercel (frontend, A-pipeline)  →  POST /render  →  GPU server (gpu-backend/)  →  Qwen-Image-Edit-2509  →  result
```

- **Pogodba §20**: `POST /render` (projectId, original, product, mask?, aPreview?,
  placement{corners}, prompt?, seed, resolution, steps, trueCfg) → `202 {jobId, status:"queued"}`;
  `GET /jobs/{id}` (queued|processing|completed|failed), `/jobs/{id}/result` (PNG; 404 še ne;
  409 failed+error), `/jobs/{id}/metadata` (§13), `/health`.
- **Način finalize (§7 "Qwen finalization")**: vhoda = [A-preview, produkt] — geometrija
  iz našega determinističnega A-pipeline-a, Qwen finalizira robove/sence. Compose je sekundarni.
- **Realni inference (§3/§4)**: diffusers `QwenImageEditPlusPipeline`, bf16, brez
  optimizacij po privzetem (spec §4); `QWEN_CPU_OFFLOAD=1` je izbira ŠELE po izmerjenem vrhu VRAM.
- **Meritve (§13/§14/§15)**: model load ločen od inference, `vram_peak_mib`
  (`torch.cuda.max_memory_allocated`), `vram_total_mib`, vrh RAM, ime GPU, seed, settings,
  prompt — vse SAMO izmerjeno, nič ocenjenega.
- **Fail-safe (§21)**: napaka modela → job `failed`, servis ostane zdrav; statusni stroj
  brez nazaj prehodov; A-preview v aplikaciji je vedno na voljo (Qwen NI na poti do A).
- **Testi (brez GPU, mock §19)**: **15/15 PASS** — življenjski cikel, PNG mere, §13 polja,
  §16 resolucijska profila (preview 896 / final 1408, snap16), §17 kanoničen prompt shranjen,
  §18 determinizem (isti seed → bajtno identičen izhod), fail-safe ob pokvarjenih vhodih.
  Pri tem najden in popravljen pravi bug: race pri ponovnem zagonu workerja (stop brez joina
  → naslednji startup ne ustvari delavca → vrsta brez obdelave).

### 2.2 Testni dataset (§5/§6) — `evaluation/dataset/`

**Isti vhodi za A in Qwen** (spec §6): original, produkt (fence_0 bay 460×660, realna
fotografija Roksal ograje, 13 letvic), maska, placement.json (S+1 dokazani vogali),
A-preview generiran z **NESPREMENJENIM dokazanim A-pipeline-om**:

| Test | §5 kategorija | Vir | A-metrike (izmerjeno) |
|---|---|---|---|
| S6-T1-ravna-antracit | raven balkon + antracitna ograja | S+3 T1 (balcony_3) | 13=13, ΔE 0.00, preshadow 0, 1593 ms |
| S6-T2-perspektiva | balkon pod kotom | S+3 T2 (balcony_2) | 13=13, ΔE 0.00, 744 ms |
| S6-T3-osvetlitev | drugačna osvetlitev | S+3 T3 (balcony_4) | 13=13, ΔE 0.00, 533 ms |
| S6-T4-occlusion-rastlinje | rastlinje / delno zakritje | S+3 T5 (balcony_0) | 13=13, ΔE 0.00, 1182 ms |
| S6-T5-svetlo-ozadje | svetla/drugače obarvana (PROXY) | S+4 T7 (balcony_4) | 13=13, ΔE 0.00, 944 ms |
| S6-T6-occlusion-drevo | bonus §10: deblo v kvadru | S+4 T9 (balcony_6) | 13=13, ΔE 0.00, 2365 ms |

**Iskrena omejitev (§5 TEST 5)**: prava SVETLA ograja kot izdelek ni na voljo med
realnimi fotografijami — fence_1/fence_5 = CGI izdelki, fence_7 = realna fotografija,
vendar z vodnim žigom in svetlimi letvicami, ki so nad `CUTOUT_GRAY_THRESHOLD=115`
(A-pipeline po zasnovi ključi temne letvice — izmerjeno, nič spremenjeno). T5 je
zato PROXY: svetlo sončno belo ozadje za antracitnim produktom = najvišje barvno-drift
tveganje. Zahtevan asset za polni TEST 5: prava svetla ograja iz Roksal kataloga.

### 2.3 Merilni instrument (§8–§13) — `evaluation/metrics.py` — **validiran 14/14**

Pravilo: metrika, ki ne zazna vtaknjene napake, je brezvredna. Validacija na
sintetiki + realni A-sliki:

| Metrika | Spec | Validacija (PASS) |
|---|---|---|
| `background_preservation` (izven maska∪kvader+feather) | §9 | identično → 0.0; pokvarjeno IZVEN → frac 0.25 zaznano; pokvarjeno ZNOTRAJ → 0.0 (brez lažnega alarma); REAL T1: A-vs-original p99 = 13/255 ≈ JPEG šum |
| `color_lab_delta` (CIE LAB ΔE, rektificiran pas) | §12 | enak → 0.0; prebarvana ograja → ΔE 50.36 |
| `letvice_count` (poteke vrstic, kot A rectify_and_count) | §8 | sintetika 13→13, 7→7 |
| `slat_period` (avtokorelacija — robustna pri temnem ozadju) | §8/§11 | sprememba strukture 13→6 letvic → zaznana (perioda 7→30) |
| `edge_profile_correlation` | §11 | enaka struktura → 1.0; spremenjena → 0.18 |
| occlusion regija (posebna meritev za T4/T6) | §10 | izmerjeno ločeno od okolice |

### 2.4 Evalvacijski cevovod + poročilo (§24) — `evaluation/run_suite.py`

- `--backend URL` (pogodba §20: submit → poll → result + metadata) ali `--import DIR`
  (zunaj pridobljene Q slike).
- Izračun metrik za vsak (A → Q) par + `--determinism` (§18: T1 isti seed, bajtna
  primerjava).
- Izhod: `results.json` (§13 zapisi) + `REPORT.md` — **tabela §24**
  (Test | A | Qwen | Identiteta | Geometrija | Barva | Okolica | Occlusion | Čas)
  + trakovi **ORIGINAL | A | QWEN** za vsak test + odločitev iz meritev
  (`verdict()`: okolica < 0.02, ΔE < 6, perioda ±25 %, corr > 0.6 → PASS kandidat).

**REHEARSAL (MOCK, jasno označeno)**: celoten cevovod pognan proti mock backend-u —
**13/13 renderjev skozi pogodbo**, determinizem §18 = `identical: True`, instrument
pravilno ocenil mock-finalize (visoka korelacija 0.98–0.99, nizka ΔE) in mock-compose
(FAIL: barvni odmik + geometrija — pravilno zaznano). Dokaz: `evaluation/REPORT-MOCK-REHEARSAL.md`
+ `evaluation/output-mock-rehearsal/`. **To NE dokazuje kakovosti Qwen-a** — dokazuje,
da bo realni run enkrat deloval in da instrument LOVI napake.

### 2.5 Poskus realne inference — dokazana blokada (iskro, §2/§15)

Merjeno v peskovniku: **ni GPU** (`nvidia-smi`: ne obstaja), 4.1 GB RAM (1.6 prosto),
2.0 GB prostora na disku (model ~40–55 GB bf16 / ~11–13 GB int4 ne gre niti na disk),
ni Dockerja, ni poverilnic za najeto GPU (env audit prazen).

Javni uradni demo Space `Qwen/Qwen-Image-Edit-2509` (ZeroGPU A10G) je imel točno
potrebne parametre (`images` seznam, seed+randomize, cfg, steps, `rewrite_prompt`).
Poskusi:

1. anonimni API klic → `event: error / data: null` v 0.2 s (takoj — ne po GPU delu);
2. brskalniški UI (agent-browser): 2 sliki naloženi ✓, kanoničen prompt ✓, seed 250901
   + randomize OFF ✓, rewrite_prompt OFF ✓, 1024×1024 ✓, "Edit!" → **Error**;
3. diskriminacijski test (FLUX.1-schnell, majhen ZeroGPU Space): API **in** brskalnik
   → enaka takojšnja napaka → **vsa ZeroGPU anonimna uporaba iz tega datacenter IP je
   zavrnjena** (kvota = 0) — ni napaka našega payloada;
4. iskanje ne-ZeroGPU poti: ~60 skupnostnih Space-ov — vsi aktivni = `zero-a10g`;
   Nunchaku varianta = `cpu-basic` (2 vCPU — neuporabno za 20B); HF Inference Providers
   = plačljivi ponudniki (spec §2 izključuje); ModelScope zahteva račun.

Dokazi: `evaluation/BLOCKED-SPACE-INFRA.md`. **Poskusi so bili izvedeni preden smo
jih obupali — po spec §2 je najeta instanca dovoljena kot testna infrastruktura in
to ostaja priporočena pot.**

## 3. Tabela §24 — stanje po S+6

| Test | A (dokazano) | Qwen | Identiteta | Geometrija | Barva | Okolica | Occlusion | Čas |
|---|---|---|---|---|---|---|---|---|
| S6-T1 ravna+antracit | 13=13, ΔE 0.00, 1.59 s | **PENDING GPU** | A ✓ | A ✓ | A ✓ | A ✓ | n/a | 1.59 s |
| S6-T2 perspektiva | 13=13, ΔE 0.00, 0.74 s | **PENDING GPU** | A ✓ | A ✓ | A ✓ | A ✓ | n/a | 0.74 s |
| S6-T3 osvetlitev | 13=13, ΔE 0.00, 0.53 s | **PENDING GPU** | A ✓ | A ✓ | A ✓ | A ✓ | n/a | 0.53 s |
| S6-T4 rastlinje | 13=13, ΔE 0.00, 1.18 s | **PENDING GPU** | A ✓ | A ✓ | A ✓ | ⚠ znana omejitev A | ⚠ 94 % | 1.18 s |
| S6-T5 svetlo ozadje | 13=13, ΔE 0.00, 0.94 s | **PENDING GPU** | A ✓ | A ✓ | A ✓ | A ✓ | n/a | 0.94 s |
| S6-T6 deblo (bonus) | 13=13, ΔE 0.00, 2.37 s | **PENDING GPU** | A ✓ | A ✓ | A ✓ | ⚠ znana omejitev A | ⚠ 67 % | 2.37 s |

A-stolpec = to rundo izmerjeno na istih vhodih (tools/s6-a-baselines.ts, pipeline 1:1).
Qwen-stolpec = čaka realen run; procedure + instrument pripravljeni in validirani.

## 4. Kako izvesti realni run (3 poti)

1. **Najeta GPU instanca (priporočeno, spec §2 = TESTNA INFRASTRUKTURA)** — RunPod/Vast:
   RTX 4090/L40S/A6000 → `git clone … && cd gpu-backend && pip install -r requirements.txt
   && uvicorn app.main:app --port 8000` → od peskovnika/klienta:
   `python3 evaluation/run_suite.py --backend http://<IP>:8000 --determinism`
2. **HF račun s tokenom** → ZeroGPU kvota za uradni demo (UI ali API);
   `run_suite.py --import` za vnos rezultatov.
3. **Lasten strežnik** (Hetzner GPU ~40 €/mes. po S+1 planu) → `docker compose up -d --build`.

Merjenja, ki jih spec §14/§15 zahteva (load, prvi/naslednji render, p95, vrh VRAM),
so vgrajena v backend in se zberejo SAMODEJNO v metadata ob vsakem realnem run-u.

## 5. Regresija (§26)

| Gate | Rezultat |
|---|---|
| Vitest | **228/228 PASS** (nič ničesar manj — aplikacija NI spreminjana) |
| `tsc --noEmit` | **0 napak** |
| ESLint (celoten projekt) | **0 napak** |
| Next.js produkcija | NIČ sprememb v src/ — samo dodani samostojni paketi (gpu-backend/, evaluation/) |
| Vercel | deploy iz GitHub push (preverjeno po pushu) |

## 6. Licenčni audit (§3) — povzetek

- **Model**: Qwen-Image-Edit-2509 = **Apache-2.0** → poslovna uporaba OK.
- **Veriga**: diffusers/transformers/accelerate/safetensors = Apache-2.0; PyTorch BSD-3;
  FastAPI MIT; uvicorn BSD-3; Pillow MIT-CMU; numpy BSD-3 → **celotna produkcijska pot
  poslovno uporabna**.
- **Izključeno**: ComfyUI (GPL-3.0 — samo eksperiment, ne produkcijska komponenta),
  IP-Adapter (CC BY-NC-SA), FLUX.1 Kontext dev (non-commercial), plačljivi API-ji (§2).
- Polni zapis + `pip-licenses` postopek: `gpu-backend/LICENSES.md`.

## 7. GO / NO-GO (§23) — okvir, ki ga izpolni realni run

**GO** (priključimo kot final render): za vse 6 testov Qwen ohrani strukturo letvic
(perioda ±25 %, corr > 0.6), barvo (ΔE < 6), ne spremeni okolice (frac < 0.02),
izboljša robove/sence (vizualno, s slikami), inference čas sprejemljiv (< ~60 s final).

**NO-GO** (ostanemo pri A-pipelineu / iščemo boljši model): Qwen izmišlja letvice,
spremeni profil/barvo (RAL), spremeni balkon/okna/fasado, uniči geometrijo —
tudi če je "lepše". Odločitev bo iz `verdict()` meritev + vizualnega pregleda trakov,
ne iz mnenja.

**Ta runda NE izreka GO in NE NO-GO** — to bi bilo ugibanje brez meritev (spec §25).

## 8. Znane omejitve (iskro)

1. Realni Q rezultati manjkajo — GPU/poverilnice (dokazano, pogl. 2.5).
2. §5 TEST 5 (svetla ograja kot izdelek) = PROXY; potreben asset iz Roksal kataloga.
3. Mock rehearsal NE dokazuje kakovosti — samo pogodbo/cevovod/instrument.
4. A-pipeline cutout po zasnovi ključe temne letvice (svetli izdelki = znana omejitev A, ni S+6 vsebina).
5. ZeroGPU anonimna kvota iz datacenter IP = 0 (ne velja za uporabnikove brskalnike).

## 9. Stop (§26)

Po S+6 se ustavimo — nič dodatnih funkcij ni implementirano, Vercel produkcija
(A-pipeline + S+5 produkt UX) je nespremenjena in zelena. Naslednji korak izbira
lastnik projekta na podlagi tega poročila (priporočilo: izvesti realni run na najeti
instanci po pogl. 4.1 — ~30 min dela, nato §7/§23 tabela zapolnjena z merjenjem).
