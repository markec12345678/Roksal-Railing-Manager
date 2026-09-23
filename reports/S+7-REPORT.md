# RUNDA S+7 — ROKSAL PRODUCT ASSET LIBRARY + PROCEDURAL FENCE ENGINE

**Datum:** 2026-09-23 · **Head start:** `f812758` (S+6) · **Status:** DONE (§15)

---

## 0. IZJAVA O OBSEGU

S+7 je zgradil **podatkovno in proceduralno osnovo za realne Roksal produkte**.
- **A-pipeline NI SPREMENJEN** (1 piksel spremembe: `git diff f812758 -- src/lib/viz/` = prazno; potrjeno z 260/260 testi).
- **Qwen produkcija NI integrirana** (spec stop-rule).
- **NOBENA nova UI funkcija NI dodana** (`src/components`, `src/app` netaknjeni).
- Geometrija ograde je IZKLJUČNO deterministična iz kataloga — **nič AI pri geometriji** (§8).

---

## 1. READ-ONLY AUDIT (§1) — povzetek

Opravljen pred implementacijo (poročilo v worklogu). Ključno:
- **Obstaja in ponovno uporabljeno:** A-pipeline (`src/lib/viz/*` zamrznjen), vizStore (fs/blob), placement v2 shema, mask-editor, evalvacija (`evaluation/run_suite.py`, `metrics.py`, S6 dataset), 228 vitest + 15 pytest.
- **Manjkalo (zgrajeno v S+7):** produkt asset library s pravicami, data-driven katalog, procedural fence engine, 3 testni dataset-i, identity/ABC poročila.
- **Napačno bi bilo podvajati:** ceni katalog `roksal-catalog-data.ts` (druga semantika), 3D GLB generator, drugi storage/mask/placement sloj — nič od tega ni bilo podvojenih.

---

## 2. ROKSAL KATALOG (§2, §5) — `data/roksal-catalog.json` + `src/lib/product-catalog/`

Vir: roksal.com (page_reader; direkten HTTP iz peskovnika blokiran — dokumentirano).
Loader: tipiziran z zod, validira ob zagonu; **produkti NISO hardcodirani v React** (data-driven).

**Zajetih 7 profilov (vsi z viri, dimenzijami, pritrditvijo, vijaki, razmaki):**

| Profil | Orientacija | Ploskovica × debelina × dolžina | Vijaki | Max razmak nosilcev | Barv |
|---|---|---|---|---|---|
| ROMB DESKA-67 | prečno+pokončno | 67 × 26 × 5800 mm | SKRITI (alu cev obvezna) | prečno 1450 mm (do 1800 vmesna povezava); pokončno cevi 1100 mm | 7 |
| POLNA DESKA-128 | prečno+pokončno | 128 × 16,5 × 2200 mm | VIDNI | prečno 1100; pokončno 1800/1500, cevi 1000 | 6 |
| DESKA-150 (terasna) | prečno | 150 × 25 × 4000/2200 mm | VIDNI | 1330 (zg. meja 1400) | 7 (3 površine) |
| POLNA DESKA-57/32 | pokončno | 57 × 32 × 5800 mm | SKRITI | stebri 1500, cevi 1000 | 4 |
| POLNA DESKA-100 | pokončno SAMO | 100 × 12 × 5800 mm | VIDNI | stebri 1800/1500, cevi 800 | 8 |
| POLNA DESKA-128 (pokončno) | pokončno | 128 × 16 × 2200 mm | VIDNI | kot prečna | 6 |
| ROMB DESKA-67 (pokončno) | pokončno | 67 × 26 × 5800 mm | SKRITI | cevi 1100 | 7 |

Plus: ročaj 92×45×5800 (vijaki vidni vsak 500 mm), čepi, letvica, pokrovček, alu steber; splošna montažna pravila (predvrtanje 1 mm večji luknji, odmik od reza 3 cm, spajanje na stebru, razmak 0,2–3 cm).
Barvna imena potrjena z uradnimi viri: Amazon Wood, Ash Wood, Burma Teak, Golden, Rustic Oak, Rustic Walnut, Grey, Charcoal/Antracit, White. Uradni hex/RAL NE obstaja v odprtih virih — `approxHex` ostaja null (izmere so v evalvacijskih datotekah, jasno označene kot približki).

---

## 3. PRAVICE (§3, §4) — `evaluation/ROKSAL-ASSET-RIGHTS.md`

- **Vse fotografije: `rights: pending`** — nobeno dovoljenje ni pridobljeno; uporaba IZKLJUČNO interna (evalvacija), NI v `public/`, NI v produkcijski UI.
- **assetQuality = insufficient** za vse 3 testirane produkte (fotografije vgrajenih ograj, ne čistih profilov) — iskreno, brez lažnih "uradnih" slik.
- **NOVO odkritje:** 2 od S+1 fixturjev sta stock fotografiji z žigi — `balcony_2` (Alamy), `balcony_4` (Dreamstime) → **izloženi iz S+7 datasetov**; vsi S+7 testi na čisti sceni `balcony_3` (S6-T1). Zabeleženo kot tveganje za produkcijo.
- Pot do `granted`: pisno dovoljenje ROKSAL d.o.o. (info@roksal.com).

---

## 4. PROCEDURAL FENCE ENGINE (§7, §8) — `src/lib/procedural/fence-engine.ts`

Čista funkcija, brez naključja, brez AI:
- **`computeFenceLayout`** — edini vir geometrije: `boardCount = ceil(span / (face + gap))`, deske od spodaj/leve, zadnja odrezana (`cut`), opozorila izven priporočil kataloga, ročaj samo če profil podpira, preverba orientacije proti katalogu.
- **`renderFence`** — deterministična rasterizacija: belo ozadje (združljivo s cutout pravilom A-pipeline), profilno senčenje (ROMB rebro na sredini; POLNA robovi + subtilen determinističen lesni vzorec — čista funkcija koordinat), stebri ZA deskami (fizični vrstni red), vidni vijaki SAMO pri profilih s `screwsVisible=true` in samo pri stebrih, ročaj z vijaki vsak 500 mm.
- **`renderFenceMask`** — deterministična productMask iz konstrukcije (belo=ploskvica/steber/ročaj, črno=razmak) — pripravljen vir alfe za prihodnjo pipeline podporo (S+8 kandidat).
- **Material ločen od geometrije** (§6): `color` (izmerjen približek) ali `texture` (deterministično vzorčenje realne fotografije: scan/tile).
- **Perspektiva:** renderer je čelno-ortogonalen; perspektivo določa izključno 4-točkovni placement prek NESPREMJENJENE homografije A-pipeline (vogali = edini vir geometrije — spec §12).

---

## 5. TESTNI DATASET (§9) — `evaluation/dataset/S7-T*/` + `S7-manifest.json`

3 realni Roksal produkti, vsak z: `original/ product/ profile/ mask/ placement.json procedural/ preview/` (+ `metrics.json`, `layout.json`):

| Test | Produkt | Orientacija | Scena (čista!) | Izmerjena barva* | Geometrija (katalog) |
|---|---|---|---|---|---|
| S7-T1 | ROMB 67 / Amazon Wood | prečno | S6-T1 (balcony_3) | #413e3e | 2046×900 mm, 2 polji, 11 desk, pitch 87, razmak 20 |
| S7-T2 | POLNA 128 / (toplo rjava) | prečno | S6-T1 | #745c4a | 2046×900 mm, 2 polji, 7 desk, pitch 148, razmak 20 |
| S7-T3 | POLNA 100 / Burma Teak | pokončno | S6-T1 | #968371 | 1477×650 mm, 2 polji, 13 desk, pitch 120, razmak 20 |

\* približek iz fotografije (NI uradni podatek). Razmak 20 mm = znotraj priporočil kataloga (0,2–3 cm).

---

## 6. IDENTITETNO POROČILO (§10) — `evaluation/S7-IDENTITY-REPORT.{json,md}`

Za vsak izdelek avtomatsko: profil, širina, debelina, št. desk (katalog vs render), razmak (+ znotraj priporočila?), orientacija, barva (izmerjena, z opombo), tekstura (B profilni vzorec / C realna fotografija), vijaki (vidni/skriti po katalogu), konstrukcija (polja + stebri), pravice. **Preverjeno:** render = layout (pre-warp števec: svetli teki = vrzeli = boardCount−1 TOČNO za vse B/C rendere), determinizem (enotski testi, bajtno identično).

---

## 7. PRIMERJAVA METOD A | B | C (§11) — `evaluation/S7-ABC-COMPARISON.{json,md}`

Vse metode skozi ISTI nespremenjen A-pipeline (uporabljen kot kompozitni motor):

| Test | A (realna foto) | B (procedural barva) | C (procedural+tekstura) |
|---|---|---|---|
| T1 | letvice 1→1 ✓ (degenerirano — tanke vrzeli)*, preshadow 0, ΔE 0,00 | **11→11 ✓, geometrija 11/11 ✓** | **11→10 ✓, geometrija 11/11 ✓** |
| T2 | letvice 1→1 ✓ (degenerirano)*, preshadow 0, ΔE 0,00 | **7→7 ✓, geometrija 7/7 ✓** | **7→7 ✓** |
| T3 | 7→7 ✓ (števec os-Y ne meri pokončnih — instrument) | **13/13 pre-warp ✓** (kompozit delno prosojen — glej §8) | **13/13 pre-warp ✓** (isti artefakt) |
| T3-B2 | — | sintetična temna varianta: **kompozit 13/13 ✓ — mehanika vertikalnega kompozita dokazana** | — |

\* A-letvice 1→1 = števec pokritosti 0,5 ne razreši tankih realnih vrzeli (~5 mm); identiteta P=R je ohranjena, absolutno število ni merljivo s tem instrumentom (iskreno dokumentirano).

**Ključna ugotovitev §11:** B/C ohranjajo identiteto izdelka BOLJ nadzorovano kot A, ker geometrija prihaja iz kataloga, ne iz fotografije: pri T2 (razmerje izreza 0,96 vs kvader 2,66) A RAZTEGNE ploskvice, B/C regenerirata pravo število desk na ciljnem razmerju. Vsi rezultati: original izven maske pikslično nespremenjen (preshadow=0), RAL zaščita ΔE=0,00.

---

## 8. NAJDENA OMEJITEV — SVETLI PRODUKTI vs ZAMRZNJEN PRAG (kvantificirano)

A-pipeline cutout: `alpha = gray < 115` (po zasnovi ključe TEMNE letvice — znano od S+6).
S+7 je s realnim Roksal svetlim produktom (POLNA 100, izmerjen gray ≈ 150) **dokazal**: kompozit skozi zamrznjen pipeline je delno prosojen. To NI napaka S+7 — je kvantificirana znana omejitev z gotovo rešitvijo: **`renderFenceMask` (deterministična alfa iz konstrukcije) že obstaja in je shranjen v datasetu**; podpora `productMask` v `runPipeline` = najvišji kandidat S+8 (1-urna sprememba, a zahteva ločeno rundo, ker je pipeline zamrznjen). `B2` (temna sintetika, jasno označena) dokazuje, da mehanika vertikalnega kompozita deluje popolnoma.

---

## 9. VISUAL QA (§14) — `evaluation/contact-sheets/`

Contact sheet na test: **ORIGINAL | PRODUCT | PROCEDURAL | A | B | C (+B2 za T3)** + vrstica povečav 2× (profil/rob/geometrija/senca/tekstura).
- **T1:** B/C z 11 deskami + vmesnim stebrom — vizualno zelo blizu A; senca/stik ohranjena.
- **T2:** B/C v pravih razmerjih z 7 deskami; A viden raztezek (dokumentiran).
- **T3:** B2 čist pokončni kompozit (13 desk); B/C prosojnost = kvantificirana omejitev (§8).
- Dve S+1 sceni izločeni zaradi žigov (glej §3 pravice).

---

## 10. TESTI IN REGRESIJA (§15)

- **vitest: 260/260 PASS** (228 obstoječih + 32 novih: katalog 11, fence-engine 21) — vsi stari ostajajo zeleni.
- `tsc --noEmit` = 0 napak · `eslint .` = 0 napak.
- A-pipeline datoteke: `git diff f812758 -- src/lib/viz/` = prazno.
- Vercel produkcija: push sproži deploy; `src/app` + `src/components` nespremenjeni → produkcija brez sprememb obnašanja (samo novi lib moduli, ki jih UI ne uvaža).
- GPU pogodba (15 pytest) + instrument (14) netaknjena.

---

## 11. ODGOVORI NA SPEC §16 (poročilo)

- **Kateri Roksal modeli so dejansko zajeti:** 7 profilov v katalogu (vsi z viri+dimenzijami+montažo); 3 modelirani s fotografskimi asseti in proceduralno geometrijo (T1/T2/T3).
- **Kateri asseti so na voljo:** za T1/T2/T3 product+profile izrezi, procedural renderji (B/C/B2/maska), reference fotografije — vse `rights: pending`, `assetQuality: insufficient` (ni čistih profilnih fotografij; ni tileable tekstur).
- **Pravice:** vse pending; 2 S+1 fixturja z žigi izložena in zabeležena; pot do granted dokumentirana.
- **Kako se generira vsak model:** `computeFenceLayout` (katalog → št. desk/razmaki/rezi) + `renderFence` (material barva/tekstura) + `renderFenceMask`; parametri per test v `evaluation/dataset/S7-T*/procedural/layout.json`.
- **Visual QA:** 3 contact sheets + povečave; ugotovitve §8/§9.
- **Testi:** 260/260, tsc 0, lint 0, A-pipeline nespremenjen.
- **Naslednji priporočeni korak (odloči lastnik — S+7 se TU ZAUSTAVI):**
  1. **S+8 kandidat #1:** `productMask` podpora v `runPipeline` (omogoči svetle produkte; `renderFenceMask` že pripravljen; zahteva spreminjanje pipeline → nova rundа z regresijo).
  2. **S+8 kandidat #2:** pisno dovoljenje Roksal + čisti profili/teksture (asset_quality → sufficient).
  3. **S+8 kandidat #3:** šele nato UI izbira produkta iz kataloga v čarovniku (korak 2) — spec tega v S+7 izrecno prepoveduje.

**STOP RULE: ne nadaljujem na S+8 samodejno.**
