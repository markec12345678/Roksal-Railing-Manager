# Primerjava: Roksal Railing Manager (tvoj) ↔ BalkonAR (Android/ARCore)

**Datum analize:** 22. 9. 2026
**Kaj je bilo narejeno:** tvoj repo je bil kloniran, odvisnosti nameščene (869 paketov),
`prisma generate`, `tsc --noEmit`, `next dev` z dejanskimi klici na API, `next build`,
in **zagon tvoje izračunske kode** z lastnimi testi. Nič od spodaj ni ugibanje.

---

## 0. Odgovor na vprašanje "kaj je boljše"

**Nista si konkurenčni. Rešujeta različen problem in najboljša rešitev je, da se povežeta.**

| | Roksal Railing Manager | BalkonAR |
|---|---|---|
| Platforma | Next.js 16 PWA (brskalnik) | Native Android (Kotlin, ARCore) |
| Vloga | **Pisarniški / poslovni sistem** | **Terenski merilni instrument** |
| Obseg | 44.788 vrstic, 29 API rut, 16 Prisma modelov | 10.939 vrstic, 9 zaslonov |
| AR | 2D prekrivanje kamere + ročna kalibracija px→mm; WebXR poskus | **Pravi ARCore 6DoF**: ploskve, globina, sidra, hojo okoli ograje |
| Poslovni procesi | CRM, ERP, koledar, ekipe, zaloge, dobavitelji, naročila, portal stranke, digitalni podpis, AI takeoff, vodjin dashboard | Samo: izmera → konfiguracija → kosovnica → ponudba |
| Terenske naprave | Bluetooth **laserski merilnik**, prepoznavanje govora (sl-SI), GPS, anotacije slik, inklinometer | ARCore + trak (ročni vnos) |
| Testi | **0** (pred današnjim dnem) | 80 (Android) + zdaj 78 (v tvojem repozitoriju) |
| Stanje ob pregledu | **se ni zagnalo** — napačna pot do baze | prevede se, ni bilo preverjeno na napravi |

### Priporočilo (konkretno)

**Ne zamenjaj ničesar. Poveži ju.** Roksal ostane sistem zapisa (pisarna, ekipa, stranka,
zaloge, podpis), BalkonAR postane terenski klient, ki ga Roksal **že pričakuje**:

> `src/app/api/sync/route.ts` se začne s komentarjem
> *"Roksal Field - API: Sinhronizacija z mobilno aplikacijo"*,
> `Project.mobileProjectId` je stolpec v shemi, obstajata modela `ArSnapshot` in
> `Measurement.arMetadata`. **Mobilni klient za ta endpoint ni obstajal.** Zdaj obstaja.

Implementirano je v `BalkonAR/app/src/main/java/si/balkonar/data/RoksalSync.kt`:

```
BalkonAR (Android)                          Roksal (Next.js)
─────────────────────                       ─────────────────
AR izmera + trak        ──POST /api/sync──▶  Project (mobileProjectId = "balkonar-<id>")
vsak rob posebej        ──POST /api/measurements──▶ Measurement.arMetadata
   (arMetadata: izvor, naklon, lokalni okvir, točke, povzetek, rezalni seznam)
```

- `id` je **stabilen** (`balkonar-<projectId>`), zato ponovna sinhronizacija **posodobi**
  projekt in ga ne podvoji.
- `arMetadata` uporablja **tvoja obstoječa imena polj** (`oznaka`, `source: 'ar_snapshot'`,
  `enota`, `originalnaVrednost`, `steviloStebrov`, `razmikMm`), da jih tvoj
  `measurements-tab.tsx` že zna prikazati, plus blok `balkonar` s celotno AR resnico.
- Semantika popravka s trakom se preslika natančno: **mera s traku = `dolzinaMm`**,
  **AR vrednost = `originalnaVrednost`**.

Nastavitev v BalkonAR: *Nastavitve → Roksal Railing Manager* (naslov + API ključ
`ROKSAL_MOBILE_…`), gumb *Preveri povezavo* in akcija *Sinhroniziraj v Roksal* na projektu.

---

## 1. Zakaj tvoj projekt "ni deloval" — trije konkretni vzroki

### 1.1 Blokator: napačna pot do baze (to je bil pravi razlog)

`.env` je bil **commitan** z absolutno potjo sandboxa, v katerem je aplikacijo zgradil
AI graditelj:

```diff
- DATABASE_URL=file:/home/z/my-project/db/custom.db
+ DATABASE_URL="file:../db/custom.db"
```

Posledica na tvojem računalniku:

```
PrismaClientInitializationError: Error code 14: Unable to open the database file
GET /api/projects     500   {"error":"Napaka pri branju projektov"}
GET /api/customers    500   {"error":"Napaka pri branju strank"}
GET /api/profili      500   GET /api/inventory 500   GET /api/crm 500
GET /api/suppliers    500   GET /api/material-orders 500  GET /api/sync 500 ...
```

**9 od 16 endpointov je vračalo 500.** Aplikacija se je izrisala, a brez podatkov —
izgleda kot "ne dela".

Pomembna podrobnost: **`.env.example` je bil tudi napačen** (`file:./db/custom.db`).
Prisma relativne poti za SQLite rešuje glede na **`prisma/schema.prisma`**, ne glede na
koren projekta, zato mora biti `../db/custom.db`. Preverjeno z `prisma db push`:

```
Datasource "db": SQLite database "custom.db" at "file:../db/custom.db"
🚀 Your database is now in sync with your Prisma schema.
```

Po popravku (dejansko izmerjeno):

```
200  /                     42.979 B   (HTML vsebuje "Roksal", "Kranj", "AR kamera", "Kalkulator")
200  /api/projects         16.395 B   [{"nazivProjekta":"Ograja ...
200  /api/customers         3.104 B   [{"ime":"Andrej Kokalj","naslov":"Cankarjeva 15, 4000 Kranj"
200  /api/profili           3.013 B   [{"sifra":"ALU-CLASSIC","naziv":"ROKSAL ALU Klasik"
200  /api/inventory         2.490 B   [{"sifraMateriala":"ALU-PROF-40"
200  /api/crm               3.916 B
```

### 1.2 `.zscripts/build.sh` je imel trdo zapisano isto pot

```diff
- NEXTJS_PROJECT_DIR="/home/z/my-project"
+ NEXTJS_PROJECT_DIR="${NEXTJS_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
```

### 1.3 `next build` porabi zelo veliko pomnilnika

`next build` je bil v testnem okolju (1 GB RAM) **ubiti zaradi pomanjkanja pomnilnika**
po ~5,5 minute. Vzrok ni Next, ampak **monolitne datoteke**:

| Datoteka | Vrstic |
|---|---|
| `measurements-tab.tsx` | **7.543** |
| `calculator-tab.tsx` | **5.791** |
| `floor-plan-tab.tsx` | 2.890 |
| `photo-tab.tsx` | 2.566 |
| `ar-scanner.tsx` | 2.213 |

Dodatno: `tsc --noEmit` je ob privzeti velikosti kopice **padel z OOM**; šele z
`--max-old-space-size=8192` je dokončal. Na stroju s 16 GB to ni težava, na CI z 2 GB bo.

**Priporočilo:** razbij vsaj ti dve datoteki po zavihkih/podmodulih (npr.
`measurements/stair-wizard.tsx`, `measurements/laser-ble.ts`, `measurements/audit.ts`).
To je največje dolgoročno tveganje v projektu — ne moreš varno spreminjati ene stvari
v datoteki s 7.543 vrsticami, in noben review je ne prebere.

---

## 2. Trije pravi hrošči v izračunih (dokazani z zagonom tvoje kode)

`next.config.ts` ima `typescript: { ignoreBuildErrors: true }`, `eslint.config.mjs` pa ima
izklopljena vsa smiselna pravila (`no-explicit-any`, `no-unused-vars`, `no-non-null-assertion`,
`ban-ts-comment`, `prefer-as-const`, `react-hooks/exhaustive-deps`). Zato se teh 15 napak
ni nikoli pokazalo ob gradnji. `tsc --noEmit` jih je našel 15; **zdaj jih je 0**.

### 2.1 `calculateMaterialTotal` — razmik stebrov je presegel maksimum sistema

```js
const posts = Math.max(2, Math.floor(seg.lengthMm / postSpacingMm) + 1)
```

Kadar dolžina ni večkratnik razmika, `floor` podšteje. Izmerjeno s tvojo kodo:

| Dolžina | Max razmik | Stebri (staro) | Dejanski razpon | |
|---|---|---|---|---|
| 3000 | 1500 | 3 | 1500 mm | ✅ |
| **3100** | 1500 | 3 | **1550 mm** | ❌ |
| **4000** | 1500 | 3 | **2000 mm** | ❌ 33 % čez |
| 4500 | 1500 | 4 | 1500 mm | ✅ |
| **5900** | 1500 | 4 | **1966 mm** | ❌ |

**Posledica na terenu:** stebri naročeni in vrtani na napačen razmik. Popravek:

```js
const spans = Math.max(1, Math.ceil(seg.lengthMm / postSpacingMm - 1e-9))
const posts = spans + 1
const actualPostSpacingMm = seg.lengthMm / spans   // novo polje v perSegment
```

Po popravku: 3100 → 1033 mm, 4000 → 1333 mm, 5900 → 1475 mm. Vedno ≤ maksimum.

### 2.2 `calculateGlassBalustrade` — formula je zamenjala razpon z višino

```js
const stressFor = (t) => (loadNPerMm * Math.pow(spanM, 2) * 6) / (Math.pow(t, 2) * 8)
```

`spanM` je bil **vodoravni razpon med stebri**, `loadNPerMm` pa **linijska obtežba z vrha
ograje**. Linijska obtežba z vrha ne obremenjuje stekla po vodoravnem razponu. Rezultat:

```
8 mm,  razpon 1200, 0,5 kN/m → σ = 8437,5 MPa   NI VARNO
12 mm, razpon 1200, 0,5 kN/m → σ = 3750,0 MPa   NI VARNO
25 mm, razpon 1200, 0,5 kN/m → σ =  864,0 MPa   NI VARNO
```

8437 MPa je nad trdnostjo **jekla** (~500 MPa) — fizikalno nemogoče za steklo. Funkcija je
za **vsak** vhod vrnila `isSafe = false` in priporočila najdebelejše steklo (24/25 mm).
Orodje, ki vedno reče "nevarno, vzemi najdelejše", ni konservativno — je neuporabno in
stranki pove napačno ceno.

**Popravek** (nov modul `src/lib/glass-model.ts`, `calculator.ts` ga re-izvozi, zato vsi
obstoječi uvozi delujejo naprej):

- konzola (brezokvirna, U-profil): `σ = 6·w·h/t²`, `δ = 4·w·h³/(E·t³)`
- dva/štirje robovi: `σ = 6·w·L²/(8·t·h²)` + opozorilo, da nosilnost določajo stebri
- dodana **preverba deformacije**, ki pri ograjah praktično vedno določi debelino
- faktor folije za lepljeno steklo (1,8×), mejna deformacija h/60, `governing`, `modelNote`

Po popravku (0,5 kN/m, h = 1000 mm):

| | Priporočeno | σ | Preverba |
|---|---|---|---|
| kaljeno | **12 mm** | 20,8 MPa | δ = 16,5 mm ≈ h/60 |
| lepljeno | **16 mm** | 11,7 MPa | z faktorjem folije 1,8 |

To sta **tržna standarda** za 1 m visoko brezokvirno ograjo (12 mm ESG oz. 16,76 mm VSG).
Stara formula tega ni mogla dati za noben vhod — to je najboljši dokaz, da je model zdaj pravi.

> Še vedno velja: poenostavljen ročni model. Končno dimenzioniranje po SIST EN 1991-1-1
> in z dovoljenjem sistema opravi pooblaščeni statik.

### 2.3 `checkCompliance` — 900 mm je bilo pod predpisanim minimumom

```js
const minHeight = dropHeightMm > 1000 ? 1000 : 900   // staro
```

Pri padcu ≤ 1 m je orodje dovoljevalo **900 mm**. Slovenski pravilnik za balkone, lože,
terase in podobno nad okolico dvignjene površine zahteva **najmanj 1000 mm** (ograja je
obvezna nad 45 cm razlike). Popravek:

```js
const minHeight = dropHeightMm > 20_000 ? 1100 : 1000
```

To je **varnostna** privzeta vrednost. Če imaš projektni pogoj, ki dovoljuje manj,
jo spremeni — ampak privzeto mora biti konservativno.

### 2.4 Ostalih 12 tipskih napak (popravljene)

| Datoteka | Napaka | Vzrok |
|---|---|---|
| `page.tsx` ×3 | `telefon` ne obstaja, dva različna tipa `Project`, `string \| null` | `Project` je bil **lokalno redefiniran v 3 datotekah** z različnimi oblikami → nov `src/lib/types.ts` |
| `post-signature-panel.tsx` ×6 | `geoLatitude`/`geoLongitude` ne obstajata | API ju vrne, lokalni vmesnik ju ni imel |
| `api/ai-takeoff` | manjka `model` | SDK ga zahteva → `process.env.ZAI_VISION_MODEL \|\| 'glm-4.5v'` |
| `api/material-orders` | `orderId` ne obstaja na `InventoryMovement` | polje dodano v shemo + `prisma db push` (dobava zdaj sledljiva do naročila) |
| `api/sync` ×2 | `never[]` | `const syncedProjects = []` brez tipa |
| `examples/websocket` ×2 | manjkajoča odvisnost | `examples` izločen iz `tsconfig` |

**Rezultat: `tsc --noEmit` → 0 napak (bilo 15).**

---

## 3. Testi: prej 0, zdaj 78

`package.json` ni imel `test` skripte in v repozitoriju ni bilo nobene `*.test.*` datoteke.
Dodano:

```bash
npm test          # vitest run  →  78 testov, 1,1 s
```

- `src/lib/__tests__/calculator.test.ts` — **36 testov**: regresijske za vse tri popravke
  (vključno z lastnostnim testom "razpon nikoli ne preseže maksimuma" za 90 kombinacij
  dolžin in razmikov), plus varovalke za tisto, kar je bilo že pravilno
  (`calculateEqualSpacing` je **odličen** — `n = ceil((L−gap)/(gap+w))` in enakomerna
  porazdelitev, centri za vrtalno šablono, simetrija).
- `src/lib/__tests__/railing-layout.test.ts` — **42 testov** za novi modul (glej §5).

Brez testov se noben od treh hroščev ni mogel pokazati: vsi trije vrnejo **veljavno**
številko, ki je le napačna. `next build` je zaradi `ignoreBuildErrors` molčal. To je
razred napak, ki ga ujamejo samo testi.

**Priporočilo:** odstrani `ignoreBuildErrors: true` iz `next.config.ts` in vklopi `npm test`
v CI. Trenutno stanje je 0 napak, tako da build ne bo padel.

---

## 4. Kaj ima tvoj projekt, česar BalkonAR nima (in je boljše)

Brez olepševanja — teh stvari je veliko in so dragocene:

1. **Celoten poslovni proces.** CRM s statusi in opomniki, ERP/logistika s koledarjem
   montaže in ekipami, zaloge, dobavitelji, naročila materiala z inventurnimi premiki,
   vodjin dashboard, onboarding. BalkonAR se konča pri ponudbi.
2. **Portal stranke** (`/portal/[token]`) z javno galerijo — monter pošlje stranki povezavo,
   stranka vidi napredek. Tega v Android aplikaciji ni mogoče nadomestiti.
3. **Digitalni podpis na ponudbi** z revizijsko sledjo (IP, User-Agent, prstni odtis naprave,
   hash PDF, GPS) + `deal-lock`, ki po podpisu zaklene urejanje. To je pravno pomembno.
4. **Bluetooth laserski merilnik** (`parseDistanceFromDataView` za BLE GATT) — za točnost je to
   **boljši vir kot ARCore** in BalkonAR ga nima. Vredno obratnega prenosa v Android.
5. **2D CAD tloris** (`floor-plan-tab.tsx`): zidovi, vrata, okna, kote, mere, besedila,
   plasti, zgodovina razveljavljanj, `polygonArea`, `projectOnSegment`. BalkonAR ima samo
   samodejno risan tloris za PDF.
6. **Kalkulatorji, ki jih BalkonAR nima:** kotni/stopniščni izračun po rake ravnini, vrtalne
   šablone, kemično sidranje (prostornina smole, čas strjevanja, število kartuš), vetrna
   obtežba po EN 1991-1-4 z regijami, CNC rezanje, WPC orientacije palic.
7. **Dokumentacija s kamero:** kategorije PRED/MED/PO, GPS, anotacije z 8 orodji,
   pred/po drsnik, batch upload.
8. **AI material takeoff** (fotografija → VLM → material → ponudba).
9. **Katalog profilov** z RAL izbirnikom in referenčno galerijo.
10. **PWA + offline sinhronizacija** — deluje brez namestitve, kar je za monterja prednost.
11. **Glasovni vnos (sl-SI)** in inklinometer (Device Orientation).

## 5. Kaj ima BalkonAR, česar tvoj projekt nima

1. **Pravi AR.** Tvoj `ar-scanner.tsx` (2.213 vrstic) je `getUserMedia` + Canvas 2D:
   slika kamere in **2D risba čez njo**, z ročno kalibracijo px→mm preko znane dolžine
   (npr. ploščica 600 mm). To ni AR v smislu 6DoF:
   - risba **ni vezana na prostor** — premakneš telefon in ograja ostane na istem mestu
     na sliki, ne na istem mestu v svetu;
   - točnost je odvisna od tega, kako pravokotno držiš telefon in kako natančna je kalibracija;
   - ni zaznave ploskev, ni globine, ni hoje okoli ograje.

   `webxr-scanner.tsx` (494 vrstic) je poskus pravega AR v brskalniku (`immersive-ar` +
   `depth-sensing` + `plane-detection` + `dom-overlay`). To je prava smer, a `depth-sensing`
   in `plane-detection` sta v Chrome za Android eksperimentalna (zastavice/origin trials) in
   brez WebGL/Three.js ni 3D izrisa — trenutno prikazuje samo status podpor.

   **BalkonAR** uporablja ARCore neposredno: `Frame.hitTest` z vrstnim redom
   ploskev → globinska točka → globinska slika → značilnica, `Plane.isPoseInPolygon`,
   pripenjanje na **rob zaznane ploskve**, sidra, ki jih ARCore sproti popravlja, in
   proceduralno 3D geometrijo (Filament), po kateri se lahko **sprehodiš**.

2. **Razpored ograje po izmerjenem obsegu.** To je tisto, kar je manjkalo — in kar je zdaj
   preneseno v tvoj repo kot `src/lib/railing-layout.ts` (glej §6). Tvoj
   `calculateMaterialTotal` vzame ročno vnesene segmente; ni pa funkcije, ki bi iz
   polilinije z vogali izračunala lege stebrov, širine panelov, kote žage in rezalni seznam.

3. **Dvojna mera (AR + trak) z izvorom.** Vsaka točka nosi izvor in oceno ± mm; prepisana
   mera poganja izdelavo, AR vrednost ostane vidna. `dimensionSource` je v `arMetadata`
   poslan tudi tebi.

4. **Lokalni koordinatni okvir.** AR koordinate umrejo s sejo. BalkonAR shrani obseg
   normaliziran (prva točka v izhodišču, prvi rob vzdolž +X) + posebej lego, zato se da
   ograja **dni kasneje, na drugi napravi, z dvema dotikoma** postaviti nazaj na balkon.
   `frameFromTwoPoints` je prenesen tudi v TS.

5. **Testirano domensko jedro brez odvisnosti.** 80 testov (Kotlin) + 78 (TS).

6. **Posnetek AR brez MediaProjection** (`SurfaceMirrorer`): video, v katerem sta kamera in
   ograja, brez vmesnika in brez sistemskega dovoljenja — pomembno sredi demonstracije stranki.

## 6. Kaj je bilo dodano v tvoj repo

### Nov modul: `src/lib/railing-layout.ts` (~900 vrstic, `--strict`, 42 testov)

Zvest prenos preverjenega motorja iz BalkonAR. Brez uvozov iz projekta — **ničesar
obstoječega ne spreminja**, lahko ga uporabiš kadar koli.

```ts
import { layoutRailing, defaultRailingSpec, cutList, summarise } from '@/lib/railing-layout'

const spec = defaultRailingSpec({ system: 'POST_BARS', postSpacingMaxMm: 1100 })
const layout = layoutRailing(perimeter, spec)

layout.posts        // 12 stebrov z legami, razmiki in oznakami S1..S12
layout.panels       // širine stekel/mreže/lesa po robovih
layout.handrails    // dolžine + startMiterDeg/endMiterDeg + notranji koti
cutList(layout)     // "žaga 45,0° desno (notranji kot 90°)"
summarise(layout, spec)  // { totalRunMm, postCount, panelCount, glassAreaM2, anchorCount, ... }
```

Zna:
- 7 sistemov (steklo v U-profilu, steklo med stebri, palice, mreža, les, francoski, po meri),
- **enakomerno** delitev robov (nikoli dolg kos + 40 mm ostanek v vogalu),
- vogalne kote in **kote žage** z nedvoumno smerjo (pozitivno = desno) in notranjim kotom,
- dve dolžini na rob: AR in izdelavno (trak), z opozorilom, kadar se razlikujeta,
- opozorila: prekratek rob, rob ni v vodi, ostanek panela, pretanko steklo za širino,
  mono ESG v brezokvirni ograji, preširok razmik med palicami, previsoka reža pri tleh,
- lokalni koordinatni okvir (`frameFromWorld`, `frameFromTwoPoints`, `toWorld`) za
  ponovno postavitev in za shranjevanje v bazo,
- slovensko oblikovanje števil, neodvisno od locale-a naprave (`1.234,56`, ne `1,234.56`).

### Seznam vseh sprememb v tvojem repozitoriju

Glej [`FIXES.md`](../FIXES.md) — vsaka datoteka, vsaka sprememba, zakaj.

---

## 7. Kaj predlagam naprej (po vrsti vrednosti)

| # | Predlog | Zakaj | Trud |
|---|---|---|---|
| 1 | **Vklopi tipe in teste v CI**: odstrani `ignoreBuildErrors`, dodaj `npm test` + `tsc --noEmit` | Trenutno 0 napak in 78 zelenih testov — poceni je obdržati, drago izgubiti | 30 min |
| 2 | **`.env` izven gita** (`git rm --cached .env`) + `pre-commit`, ki zavrne `/home/z/` poti | To je bil vzrok, da aplikacija ni delovala | 15 min |
| 3 | **Razbij `measurements-tab.tsx` (7.543) in `calculator-tab.tsx` (5.791)** | Build porabi preveč pomnilnika, review ni mogoč, vsaka sprememba je tvegana | 1–2 dni |
| 4 | **Uporabi `railing-layout.ts` v `floor-plan-tab`**: iz narisanih zidov → razpored ograje → rezalni seznam → `bom-draft` | Poveže risbo z naročilom; danes se številke prepisujejo ročno | 1–2 dni |
| 5 | **BalkonAR kot terenski klient** (že implementirano): namesti APK, vpiši strežnik in ključ, sinhroniziraj | Dobiš pravi AR + 6DoF izmero brez da bi karkoli prepisoval v spletni aplikaciji | 0 (narejeno) |
| 6 | **Obraten prenos: BLE laserski merilnik v BalkonAR** | Laser je natančnejši od AR — tvoj `parseDistanceFromDataView` je že napisan | 0,5 dni |
| 7 | **Prenos tvojih kalkulatorjev v BalkonAR** (stopnice, kemično sidranje, veter, CNC) | Monter jih potrebuje na terenu, ne v pisarni | 1 dan |
| 8 | **Odstrani `tool-results/`, `.zscripts/`, `dev.log`, `qa-meritve.png` iz gita** | Ostanki AI graditelja; `tool-results/` je 2,8 MB dnevnikov orodij | 10 min |

### Kaj predlagam, da NAREDIŠ glede AR

Ne poskušaj narediti pravega AR v brskalniku. `webxr-scanner.tsx` je lep poskus, a
`depth-sensing` in `plane-detection` v Chrome za Android nista zanesljivo na voljo, brez
Three.js/WebGL ni 3D izrisa, in PWA ne dobi dostopa do kamere tako hitro kot native.
**BalkonAR to že dela z ARCore.** Bolj smiselno je:

- teren → BalkonAR (AR izmera, prikaz stranki, video, fotografije),
- pisarna → Roksal (vse ostalo),
- most → `POST /api/sync` + `POST /api/measurements` (že implementirano).

Če vztrajaš na enem samem produktu, je alternativa **WebView v Android aplikaciji**, ki
gosti tvoj Next.js (ali `next export` statično) + nativni AR zaslon za izmero. To je
več dela kot sinhronizacija in dobiš manj — ne priporočam.

---

## 8. Kaj sem preveril in česa nisem

**Preverjeno z zagonom:**
- `npm install` (869 paketov, 4 min) ✅
- `prisma generate` + `prisma db push` ✅
- `tsc --noEmit`: 15 napak → **0** ✅
- `next dev` + 16 HTTP klicev na API: 9× 500 → **vsi 200** ✅
- glavna stran `/`: 200, 43 KB HTML s pravimi podatki iz baze ✅
- `calculator.ts` preveden in **zagnan** — napake dokazane s številkami, popravki potrjeni ✅
- `npm test`: **78/78 zelenih** ✅

**Ni preverjeno (omejitve testnega okolja):**
- `next build` — ubito zaradi pomanjkanja pomnilnika (okolje ima 1 GB RAM). Na tvojem
  stroju bo verjetno uspelo; če ne, je razlog v §1.3.
- Vmesnik v brskalniku — HTML sem preveril po vsebini, ne po izgledu.
- AR/WebXR na pravi napravi — tu ni kamere.
- `ai-takeoff` s pravim API ključem Z.AI — popravljen je tip (`model`), ne preverjeno v živo.
- Statika stekla: popravljen model daje tržno skladne rezultate, **ni pa nadomestek za
  statika**.
