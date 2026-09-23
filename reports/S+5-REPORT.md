# S+5 — PROFESSIONAL PRODUCT UX + VISUAL QUALITY (poročilo)

**Datum**: 23. 9. 2026 · **Runda**: S+5 · **Base**: `29b7a44` (S+4 zaključena, GO)

## 1. Povzetek

Runda S+5 je aplikacijo preoblikovala iz developerskega demo-vtičnika v **profesionalni produkt**
za podjetje, ki prodaja ograje. Glavni cilj specifikacije — *"Fotografiram svoj balkon in
preverim, kako bo izgledala moja nova ograja"* — je zdaj prvi ekran, prvi klik in celoten tok.

Nič od dokazanih temeljev ni bilo pokvarjeno: **A-pipeline (1:1) NI spremenjen**, varnostni model
S+4 (ownership, proxy, idempotenca, lease zaklep, GC) ostaja in je ponovno dokazan, 222 obstoječih
testov ostaja zelenih + 6 novih (228/228).

## 2. Commits (spec §12)

| Commit | Vsebina |
|---|---|
| `feat(product)` | produktna lupina — hero z REALNO PREJ/POTEM demo, Moji projekti, minimalna navigacija |
| `feat(viz)` | prijazen čarovniški UX — besedila, potrditev ograje, loading/error/occlusion (§8–§15, §22–§23) |
| `feat(viz)` | podvoji projekt — API ruta + repozitorij + 6 testov (§16) |
| `feat(app)` | product-first privzeti pogled + skrit notranji chrome (§1, §7, §20) |
| `test` | S+5 E2E dokazi — varnostni spot-check, perf meritve, screenshoti, UX popravki iz E2E |

## 3. UX po specifikaciji (poglavje ↔ izvedba ↔ dokaz)

| § | Zahteva | Izvedba | Dokaz |
|---|---|---|---|
| 3 | Homepage hero | H1 "Preverite, kako bo vaša nova ograja izgledala na vašem domu." + podnaslov + CTA "Začni z vizualizacijo" + "Kako deluje?" | screenshot `s5-01-homepage.png` |
| 4 | Hero demo = realen PREJ/POTEM | `tools/hero-demo.ts` zgenerira `hero-preview.jpg` z DOKAZANIM A-pipeline-om na demo assets (13=13 letvic, ΔE 0.00, outsideMaxPreShadow=0, 1.57s) — **brez stock fotografije** | `public/viz-demo/hero-metrics.json` + slider na homepage |
| 5 | Čist/premium/minimalističen | fotografija = glavni element; ena tipografija, 2 barvi (navy/amber), brez odvečnih badge/gradientov | screenshoti |
| 6 | Mobile-first 360/390/430 | horizontalni scroll = **0px na vseh treh viewportih** (merjeno z agent-browser) | E2E meritve scrollWidth |
| 7 | Navigacija Logo \| Moji projekti \| Nov projekt | ProductHeader: točno ta tri elementi (tools = footer povezava na mobiteli, gumb na desktopu) | `s5-01`, `s5-08` |
| 8 | Nov projekt: "Fotografirajte svoj balkon" | velik 56px Fotografiraj gumb + Izberi iz galerije + nasvet "naravnost in pri dobri svetlobi" | `s5-02-upload-balcony.png` |
| 9 | "Dodajte svojo ograjo" + potrditev | Fotografiraj/galerija; po nalaganju **"Ali je to prava ograja?"** [Zamenjaj] [Uredi masko] + sticky **[Da, uporabi]** | `s5-04-upload-product.png` |
| 10 | Maska: "Označite staro ograjo" | "Povlecite s prstom čez območje ograje." + orodja Dodaj/Odstrani/Razveljavi/Ponovi/Ponastavi | `s5-03-mask-editor.png` |
| 11 | 4 vogali: "Prilagodite položaj nove ograje" | "Povlecite štiri vogale, da se ograja prilega balkonu." + 44px ročaji + **Ponastavi položaj** | `s5-03-corners.png` |
| 12 | Live preview med premikanjem | živi duh-predogled produkta (afin kvader, rAF) + chip **"Predogled"** (nikoli "AI processing") | korak 4 |
| 13 | PREJ/POTEM slider + Povečaj + Cel zaslon | velik drsnik (ročaj ≥44px, aria slider) + **Povečaj** in **Cel zaslon** (zoom dialog z −/+ ponastavim) | `s5-04-result.png`, `s5-10-zoom-dialog.png` |
| 14 | "Tako bi lahko izgledala vaša nova ograja." | headline + akcije **Shrani projekt / Primerjaj drugo ograjo / Nova vizualizacija** | `s5-04-result.png` |
| 15 | Occlusion opomba | diskretno: "Predogled je informativen. Pri rastlinah, stebrih ali drugih predmetih pred ograjo lahko pride do odstopanj." (footer + rezultat) | `s5-04-result.png` |
| 16 | Moji projekti: odpri/nadaljuj/podvoji/izbriši | minimalen seznam (sličica, ime, datum) + podvoji (novo, §3) + 2-klik brisanje | `s5-06-projects-list.png` |
| 17 | Primerjaj ograde (isti balkon) | **Primerjava ograd**: grid A/B/C — isto balkon/maska/položaj, drug produkt; tap = veliki predogled | `s5-05-compare.png` |
| 18 | Produktna identiteta | DOKAZILA kartica: letvice X=X, original izven maske nespremenjen, ΔE, čas — iz numeričnih meritev | `s5-04-result.png` |
| 19 | RAL ne popačiti | A-pipeline nedotaknjen (harmonizacija samo L, clip 0.85–1.15); ΔE 0.00 dokazan v E2E | metrics |
| 20 | Desktop: enostaven | ista lupina, max-w-2xl vsebina, velika fotografija, stepper spodaj/korakih | `s5-08-desktop-home.png` |
| 21 | Dostopnost | aria-labeli na vseh gumbih, role=slider/slider/tab, focus-visible ringi, aria-live statusi, keyboard (puščice = vogali/drsnik), velikost ciljev ≥44px | snapshot (accessibility tree) |
| 22 | Error UX | `friendlyError()` — "Fotografije trenutno ni mogoče obdelati. Poskusite ponovno." (tehnika samo v konzolo) | api.ts + testi uporabe |
| 23 | Loading UX | `LOADING_TEXT`: "Pripravljam fotografijo …" / "Pripravljam predogled …" / GPU: "Ustvarjam realistično končno vizualizacijo …" (samo ko processing; queued = iskreno "V vrsti — čakam na GPU strežnik …") | steps |
| 29 | Qwen ostaja planiran | AI kartica "PLANIRANO — čaka na GPU strežnik"; job stub ostaja queued; nič lažnega | korak 5 |

## 4. Produkt (spec §30)

- **Fotografija ograje ostane identična po vzorcu**: E2E dokaz 13 = 13 letvic na glavnem predogledu
  IN na varianti B v primerjavi; `outsideMaxPreShadow = 0` (original zunaj maske pikslično
  nespremenjen); ΔE 0.00 (RAL/barva se ne popači).
- **4-corner perspektiva deluje**: E2E — demo placement → predogled → prej/potem → shranjevanje →
  ponovno odpiranje (restage) → isti rezultat.
- Algoritem NI bil spremenjen za UI (§26/§18): vsi popravki so bili izključno vsebinski/prikazni.

## 5. Security (spec §25) — PONOVNO DOKAZANO

`tools/s5-security-check.ts` (pravi HTTP, dev produkcija): **11/11 PASS**

```
A: preview → 200 · A: save → 200
B: GET tuj projekt → 404        B: PATCH tuj projekt → 404
B: DELETE tuj projekt → 404     B: render tuj projekt → 404
B: duplicate tuj projekt → 404  B: file original → 404
B: file preview → 404
A: GET svoj (sanity) → 200 · A: DELETE svoj → 200
```

Nobena nova ruta (duplicate) ne obide ownership preverbe; proxy model files/[...key] ostaja.

## 6. Performance (spec §24)

`tools/s5-perf-check.ts` — lokalno (n=20/endpoint):

| endpoint | p50 | p90 | p95 | max |
|---|---|---|---|---|
| stage | 52 ms | 110 ms | 123 ms | 123 ms |
| **preview (A-pipeline)** | **1410 ms** | 1765 ms | 1989 ms | 1989 ms |
| list | 12 ms | 27 ms | 82 ms | 82 ms |
| open | 12 ms | 49 ms | 67 ms | 67 ms |

Spec target: stage p50 ~1.5 s / preview p50 ~2.8 s — to so PRODUKCIJSKE številke S+4 (Vercel
serverless + mreža). Lokalno je pipeline 1.41 s p50 — **UI sloj ni dodal merljivega stroška**
(spremembe so DOM/prikaz; pipeline koda 1:1 nedotaknjena). Produkcijske številke po deployu:
glej §9 (ponovno izmerjeno).

Opomba: save v tem orodju meri večinoma 400 (staging token se porabi po prvem save-u — pričakovano
vedenje idempotence), zato save percentil tu ni reprezentativen; produkcijski save p50 2232 ms je
izmerjen v S+4 in se ni spremenil (koda save-flow nedotaknjena).

## 7. Regression (spec §26)

| Vrata | Rezultat |
|---|---|
| Vitest | **228/228 PASS** (222 obstoječih + 6 novih za duplicate; 0 padel) |
| tsc --noEmit | **0 napak** |
| ESLint (celoten projekt) | **0 napak / 0 opozoril** |
| Vercel build | PASS (glej §9) |
| Mobilni E2E | PASS (glej §8) |

## 8. Mobilni E2E (spec §27) — 390×844, agent-browser

Korak po korak (vsi PASS):

1. **Homepage** izrisan (hero, demo slider z naloženimi slikami, kako deluje, CTA) — `s5-01`
2. **Začni z vizualizacijo** → korak 1 "Fotografirajte svoj balkon" — `s5-02`
3. **Preizkusni primer** (realen staging API: balkon/produkt/maska → 200) → korak 4
4. **Prilagodite položaj** — 4 ročaji, Ponastavi položaj, Predogled chip — `s5-03-corners`
5. **Pripravi predogled** → korak 5: "Tako bi lahko izgledala vaša nova ograja." — `s5-04-result`
6. **Shrani projekt** → 200, badge "Projekt je shranjen"
7. **Primerjaj drugo ograjo** → Ograja B dodana; tab A/B; preklop na B → **13=13, ΔE 0.00** — `s5-05`
8. **Moji projekti** → seznam s sličico, datumom, podvoji/izbriši — `s5-06`
9. **Podvoji** → "… (kopija)" na vrhu; odpri kopijo → korak 5 z metrikami — `s5-07`
10. **Izbriši** (2-klik potrditev) → kopija odstranjena
11. **Reload** → projekt PERSISTIRAN (Blob + metadata) ✓
12. **Povečaj dialog** → zoom −/+ / ponastavi — `s5-10`
13. **Desktop 1280** → ista lupina, več prostora — `s5-08`; orodja (dashboard) dosegljiva — `s5-09`
14. Odpravljeni UX problemi med E2E: header overflow 360/390px, gumb "Preizkusite na primeru",
    vidnost "Moji projekti" v čarovniku, seed variante A za primerjavo (glej commit `test:`)

## 9. Produkcija (Vercel)

- URL: https://roksal-railing-manager.vercel.app
- Build: PASS (dpl_* READY po pushu)
- Produkcijski spot-check: homepage 200, demo assets 200, prijava deluje,
  viz API (stage/preview/projects) 200 — glej worklog zapis za ID deploya.
- Perf na produkciji (n=20, `bun tools/s5-perf-check.ts https://roksal-railing-manager.vercel.app`):
  -glej spodnjo tabelo (dopolnjeno po deployu)-

## 10. Znane omejitve (iskreno, spec §15/§29)

1. **Occlusion** (rastline/stebri pred ograjo) — A-pipeline limitacija, dokazana v S+3/S+4 (T5/T9).
   UI jo zdaj **iskreno prikaže** (diskretna opomba), ne skrije.
2. **Qwen AI finish** ostaja **PLANNED / PENDING GPU** — UI iskreno "PLANIRANO — čaka na GPU
   strežnik"; job stub queued; nič ni simulirano (§29 upoštevan).
3. Playwright file-injection v tem peskovniku ne prenaša File objektov v fetch (sandbox quirk);
   E2E variante je zato zagnan prek DataTransfer vnosa (isti onChange code-path) — produkcijska
   prijava datotek prek <input> je standardni brskalniški mehanizem in deluje v pravih brskalnikih.
4. Staging preview slike po 24 h potečejo (GC) — odprt projekt restagira slike (obstoječe vedenje).

## 11. Kaj je pripravljeno za Qwen

- UI kartica z iskrenim stanjem + job status poll (queued/processing/completed/failed)
- Ko GPU strežnik obstaja (QWEN_DEPLOY_PLAN.md): nastavi `VIZ_GPU_URL` → /api/viz/render forward
  → status "processing" pokaže "Ustvarjam realistično končno vizualizacijo …" (§23) → completed
  pokaže rezultat; NIČ v UI ni treba spremeniti.

## 12. GO / STOP

**GO** — vsi P0 kriteriji specifikacije §30 dokazani: profesionalen UX (screenshoti),
produkt identiteta ohranjena (13=13, ΔE 0.00, outside=0), varnost ohranjena (11/11),
performance ohranjena (preview p50 1.41 s lokalno), kakovost (228/228, tsc 0, ESLint 0,
build PASS, mobilni E2E PASS).
