# 🏗️ Roksal Railing Manager

**Profesionalno orodje za monterje balkonskih in stopniščnih ograj**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwind-css)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](./LICENSE)
[![CI](https://github.com/markec12345678/Roksal-Railing-Manager/actions/workflows/ci.yml/badge.svg)](https://github.com/markec12345678/Roksal-Railing-Manager/actions/workflows/ci.yml)

> **Začetek v 5 minutah:** [`NAVODILA.md`](NAVODILA.md) — `bash tools/setup.sh` naredi vse
> (odvisnosti, `.env` s skrivnostmi, baza, tvoj račun, API ključ, preverjanje).

> Aplikacija za podjetje **Roksal d.o.o. Kranj** (izdelava in montaža alu/kovinskih/inox/WPC balkonskih in stopniščnih ograj po meri). Nadomešča ročne skice, papirne beležke in nepregledno dokumentacijo — od mere na terenu do arhivirane realizacije.

---

## 📑 Kazalo

- [Pregled](#-pregled)
- [Funkcije](#-funkcije)
- [Posnetki zaslona](#-posnetki-zaslona)
- [Tehnološki sklad](#-tehnološki-sklad)
- [Arhitektura](#-arhitektura)
- [Navodila v 5 minutah](NAVODILA.md)
- [Namestitev (lokalni razvoj)](#-namestitev-lokalni-razvoj)
- [Podatkovni model (Prisma)](#-podatkovni-model-prisma)
- [API končne točke](#-api-končne-točke)
- [Komponente](#-komponente)
- [Knjižnica izračunov](#-knjižnica-izračunov)
- [Uporaba](#-uporaba)
- [Deploy](#-deploy)
- [Diferenciacija od konkurence](#-diferenciacija-od-konkurence)
- [Varnost](#-varnost)
- [Licenca](#-licenca)

---

## 🎯 Pregled

**Roksal Railing Manager** je mobilna (PWA) aplikacija, zasnovana za monterje balkonskih ograj, ki delajo na terenu. Aplikacija pokriva celoten delovni tok — od mere na balkonu do arhivirane realizacije s PDF dokumentacijo.

### Ključne prednosti

- 📐 **Deterministični Merilni studio** — foto → samodejna CV zaznava (Sobel + Hough,
  **brez AI**) ali ročne točke → obvezno referenčno merilo → izmerjena geometrija
  z izvorom + negotovostjo. AI NIKOLI ni vir resnice (glej [`docs/MEASUREMENT.md`](docs/MEASUREMENT.md)).
- 🔭 **CV Studio (nov, issues #10/#11)** — samostojen scene understanding + PWC
  postavitev: PHOTO/LIVE način, zaznave (pas/stebri/rob/stopnice/ovire) kot
  POPRAVLJIVI predlogi, capability-based AR abstrakcija, deterministični
  placement iz Product SDK + fence-engine. CV = predlog, Measurement/Geometry =
  vir resnice (glej [`docs/CV-STUDIO.md`](docs/CV-STUDIO.md) + [`docs/PWC-ASSETS.md`](docs/PWC-ASSETS.md)).
- 🏛️ **En vir geometrijske resnice** — Meritev → fence-engine / railing-layout →
  BOM → ponudba; vsaka plast je funkcija prejšnje (kanonična veriga je testirana,
  `src/lib/__tests__/canonical-chain.test.ts`).
- 🖼️ **AR vizualizacija ograj** — Monter vidi ograjo preko kamere, preden jo montira.
  Tehnično gre za **2D risbo na sliki kamere** (`getUserMedia` + Canvas 2D) z ročno
  kalibracijo px→mm preko znane dolžine, plus poskus WebXR (`webxr-scanner.tsx`).
  Risba ni prostorsko sidrana: premakneš telefon in ostane na istem mestu na sliki.
  Za pravi 6DoF AR (ograja, sidrana na rob plošče, po kateri se sprehodiš) glej
  [`docs/PRIMERJAVA.md`](docs/PRIMERJAVA.md) in Android aplikacijo BalkonAR.
- 🧮 **Profesionalni kalkulatorji** — razmik palic, kotni izračuni stopnic, skupni material, skladnost s predpisi
- 📏 **Specifične meritve za ograje** — stopniščni čarovnik, štebricki, WPC orientacije, koti
- 📷 **Dokumentacija s kamero** — slike pred/med/po montaži z annotacijami in GPS
- 📄 **PDF izvoz** — delovni list monterja, ponudba za stranko, materialni list
- 📴 **Deluje offline** — PWA s service workerjem, sinhronizacija ko je povezava
- 🗄️ **PostgreSQL** — verzionirane migracije (`migrate deploy`), produkcija Neon

### Statistika projekta (usklajeno z HEAD, R125)

| Metrika | Vrednost |
|---------|----------|
| Vrstic kode (src) | ~91.400 |
| React komponent | 41 roksal modulov + 60+ UI primitivov |
| API končne točke | 61 route handlerjev v 41 skupinah |
| Prisma modelov | 35 (PostgreSQL) |
| Prisma migracij | verzionirane (`migrate deploy`) |
| Testi (vitest) | **586** (37 datotek, vključno z globalSetup embedded PG) |
| Varnostni smoke | 52 preverjanj na zagnanem strežniku (`tools/security-smoke.py`, del pogojno) |
| Product SDK katalog | 8 WoodCore profilov (server-authoritative) |
| Katalog profilov (Profil) | 20 sejanih (WPC, ALU, Inox, Steklo) |
| Jezik vmesnika | Slovenščina |

> Številke se osvežujejo ob Documentation Truth Pass — zadnjič R122.

---

## ✨ Funkcije

Aplikacija ima **9 glavnih zavihkov** (Domov, Vizualizacija, AR kamera, Slike,
Kalkulator, Meritve, Nagib, Zaloga, Več) + **15 podzavihkov** v meniju "Več"
(Merilni studio, Ponudba s podpisom, Post-Signature, CRM, Material, Logistika,
Tloris, Izvoz PDF, Galerija, Katalog, Skice, Dokumenti, Varnost, …).

### 🏠 1. Domov (Dashboard)

- Seznam projektov z iskalnikom in filtri (Vsi/V teku/Načrtovano/Zaključeni)
- Aktivni projekt z amber obrobo (klik za izbiro)
- Hitre akcije: Pokliči stranko, Uredi, Arhiviraj
- Statusni badge z relativnimi datumi (danes/včeraj/pred 3 dnevi)
- Povzetek: aktivni projekti, načrtovani, zaključeni, stanje zalog
- Nov projekt dialog (naziv, stranka, datum, opombe)

### 📷 2. AR kamera

Polnozaslonska AR vizualizacija ograj na balkonu:

- **Kamera zadaj** (`getUserMedia({facingMode:'environment'}})`) čez cel zaslon
- **Dodajanje točk** — tap na zaslon doda sidrno točko (stebriček) z zaporedno številko
- **Mikanje točk** — tap obstoječo točko jo izbriše; long-press za vleko
- **Vizualizacija ograje** — med točkami se izriše profil (prečke, palice, stebri) glede na izbran profil iz kataloga
- **Sprememba profila v realnem času** (WPC vodoravno, WPC pokončno, Inox, Steklo, ALU)
- **Kalibracija** — uporabnik vnese znano dolžino (npr. ploščica 600mm) → faktor px→mm
- **AR meritve** — dvotapni način: točka A, točka B → izračunana razdalja v mm/cm/m
- **Capture** — screenshot (video frame + canvas overlay) shrani v projekt
- **Zgodovina** — pregled shranjenih AR posnetkov za projekt

### 🖼️ 3. Slike

- **Kamera znotraj aplikacije** — `MediaDevices.getUserMedia` (ne sistem kamera)
- **Kategorije**: PRED / MED / PO montaži (barvno kodirani badge-i)
- **GPS lokacija** avtomatsko (geolocation API, high accuracy)
- **JPEG kompresija** — max 1280px širina, 0.75 quality (pred prevelikimi slikami)
- **Annotation editor** — 8 orodij (puščica, črta, pravokotnik, krog, besedilo, prostoro risanje, mera, radiraj), 5 barv, 3 debeline, native Canvas
- **Batch upload** iz galerije (multi-file, kompresija, GPS)
- **Pred/Po pari** z before/after sliderjem
- **Masonry layout** (CSS columns, responsive)
- **Filtri** — datumski range, search po opombah, kategorije
- **Enhanced preview** — navigacija prev/next, urejanje, izvoz, GPS link na Google Maps
- **Statistika** — št. slik po kategorijah, skupna velikost

### 🧮 4. Kalkulator

7 načinov izračuna + 6 izpolnitev:

| Način | Funkcija |
|-------|----------|
| **Razmak palic** | Equal spacing z SVG diagramom + pozicije od prve točke (drilling template) |
| **Kotni izračun** | Stopnišče/rake angle z diagramom |
| **Skupni material** | Multi-segment: palice + stebri + prečke + vijaki + sidra + cena |
| **Predpisi** | SIST EN: 110mm razmik, 900mm višina, 1500mm stebri, horizontal load |
| **Vetrna obremenitev** | Eurocode EN 1991-1-4 z regijami |
| **Kemično sidranje** | Prostornina smole, čas strjevanja, št. kartuš |
| **Railing spacing** | Osnovni razmik letev |

**Dodatne funkcije:**
- **Prihranjene predloge** — save/load konfiguracij z imenom
- **Strošek dela** — urna postavka × ur × monterjev + transport
- **Rezerva materiala** — 0/5/10/15/20% (privzeto 10%)
- **DDV ločeno** — 22% / 9.5% (gradnja) / 0%
- **Akontacija** — 0/30/50/70% z datumom plačila
- **Zgodovina izračunov** — timeline 30 zadnjih, klik = reload

### 📏 5. Meritve

Najobsežnejši modul (7.800+ vrstic):

#### Tipi meritev (9)
- `RAZDALJA` — razdalja med dvema točkama
- `VISINA` — višina od tal
- `KOT` — splošni kot
- `KOT_VOGAL` — notranji/zunanji vogal L-oblike (α = 180° − β)
- `KOT_STOPNISCE` — kot posamezne stopnice
- `NAGIB` — nagib tal/podkonstrukcije
- `GLOBINA` — globina (npr. vrtanja)
- `PREMER` — premer (npr. palice)
- `STEBR` — stebriček/paliza z avto-številko (S1, S2, S3...)
- `SEGMENT` — označitev odseka

#### Stopniščni čarovnik
- 4 vhodi (skupna višina, št. stopnic, globina, širina)
- Real-time izračun: višina posamezne stopnice, kot (atan), dolžina kosa (√), skupna dolžina
- Priporočilo barvno kodirano (30-35° zeleno / >37° oranžno / >40° rdeče)
- SVG diagram stopnišča z dimenzijami
- "Ustvari meritve" (5 tipov) + "Shrani kot predlogo"

#### WPC orientacije
3 novi segment tipi z avtomatskim izračunom števila palic:
- **WPC_POKOCNE** — navpične palice, razmak 110mm
- **WPC_VODORAVNE** — ležeče palice, razmak 110mm
- **WPC_POSEVNE** — palice pod kotom 45° (ali custom)
- SVG diagram orientation-specific
- "Dodaj WPC palice kot materiale" — kreira STEBR meritev za vsako (P1, P2...)

#### Ostale funkcije
- **Hitre predloge** — 4 template-i (balkon 3m, stopnišče, L-oblika, terasa 5m)
- **Multi-segment** — ravni/kotni/stopnišče/lokan z povzetki
- **Kalibracija reference** — A4 list, ploščica, znana dolžina → px/mm
- **Inline inclinometer** za kot/nagib (Device Orientation API)
- **Skupinske akcije** — checkbox mode, izberi več, izvozi/kopiraj/izbriši
- **Status meritev** — OSNUTEK/POTRJENA/ARHIVIRANA
- **Zgodovina sprememb** — audit trail (ADD/EDIT/DELETE/STATUS)
- **Glasovni vnos opomb** — Web Speech API (sl-SI)
- **Multi-unit prikaz** — 3000mm · 300cm · 3.00m
- **Vnos v katerikoli enoti** — Select mm/cm/m ob inputih
- **Povzetek projekta** — skupna dolžina, površina, št. segmentov
- **Izvoz CSV in PDF**

### 📐 Merilni studio (Več → Merilni studio) — deterministični, brez AI

Naslednja generacija merjenja (issue #2, [`docs/MEASUREMENT.md`](docs/MEASUREMENT.md)):

- **Samodejni način** — CV zaznava ograje na fotografiji (Sobel → Otsu → Hough):
  horizontalni pasovi (runs), stebri, kotniki; objektivne metrike kakovosti
  (pokritost, podpora, konsistentnost razmakov, temporalna stabilnost).
- **Ročni način (fail-safe)** — uporabnik tapne točke poti (spodnja linija) in
  zgornje linije; engine izračuna segmente (raven, L, U balkon).
- **Merilo je OBVEZNO** — brez veljavne referenčne mere sistem vrača
  `SCALE_REQUIRED` in **NIČ izmišljenih milimetrov**. Vsaka vrednost nosi
  izvor (`source`) + `provenance` + negotovost (±mm).
- **Server-avtoritativno** — merilo, končne mm in geometrijo izračuna STREŽNIK
  (`buildSession`); klientski izračuni ne vstopajo v sistem (meje zaupanja).
- **Takeoff predogled** — geometrija → Product SDK → fence-engine: št. desk,
  linearni metri, rezi, stebri.
- **Validacijski harness** — `bun run bench:measurement`: 12 sintetičnih
  terenskih scenarijev (L/U, perspektiva, zakritost, tema/šum, napačno merilo)
  z HARD zakoni in INFO signali (R118).

> V AR kameri in Merilnem studiu obstajata tudi dve AI (VLM) **sugestivni**
> orodji (`/api/ar/analyze`, `/api/measure/photo`) — njuna ocena je IZRECNO
> samo predlog za uporabnika in NIKOLI ni vir geometrije/BOM/cene.

### 🔭 CV Studio (Več → CV Studio) — scene understanding + PWC postavitev (brez AI)

Samostojen CV modul (issues #10 + #11, [`docs/CV-STUDIO.md`](docs/CV-STUDIO.md)):

- **PHOTO način** — upload/kamera → deterministična analiza prizora
  (`POST /api/vision/scene`): pas ograje, balkonni rob, stebri, stopniščne
  družine, ovire — vse kot SPREJMLJIVI/ZAVRLJIVI/VLECLJIVI predlogi;
  površine (FLOOR/WALL/DOOR/…) so izključno ročna označba (CV jih ne simulira).
- **LIVE način** — zadnja kamera, 2D CV predogled (throttled analiza, zadnji
  rezultat stabilen), zajem kadra → PHOTO; capability-based (brez WebXR =
  iskren frame-relative fallback, brez fake 3D).
- **ROČNO** — popoln fail-safe brez CV (CV neuspeh ne blokira projekta).
- **PWC Placement** — produkt iz realnega kataloga (8 profilov,
  [`docs/PWC-ASSETS.md`](docs/PWC-ASSETS.md)) → strežnik-avtoritativna ocena
  (`/api/vision/placement`): katalog pravila razmakov/stebrov, layout iz
  fence-engine; **invalid → razlog, brez layouta, brez BOM-a**. Projekcija:
  homografija (4 kotniki) ali iskren 2D približek z opozorilom.
- **Kanonična veriga ostane** — zapis meritve izključno prek
  `/api/measurement/confirm`; CV brez potrditve ne spremeni resnice.
- Determinizem: enaka slika → enak `sessionId` + bajtno enak odgovor (test 100×).
- Realne fotografije (#8): `bun run bench:vision` — poročilo za ročno sprejembo.

### 🧭 6. Nagib (Inclinometer)

- Digitalna libela z `deviceorientation` API
- Krožna libela z mehurčkom
- Prikaz kotov L↔D (levo-desno) in N↔Z (naprej-nazaj)
- iOS `requestPermission` podpora
- Shranjevanje nagiba v `/api/slopes` (kotStopinje, smer, lokacija)
- Zgodovina nagibov za projekt

### 📦 7. Zaloga (Inventory)

- Seznam materialov z low-stock badge v navigaciji
- Filter pills po kategorijah (WPC, Inox, Kemično, Aluminij)
- Mini stock chart z barvami (zelena OK, rdeča nizko)
- Premiki zaloge (dodaj/odvzemi)
- Poraba materiala na projekt

### ⋯ 8. Več (meni)

Sheet z 6 podzavihki:

#### 📄 Izvoz PDF
- **Delovni list monterja** — glava Roksal, podatki projekta, meritve, slike pred/med/po, opombe, podpisi
- **Ponudba za stranko** — postavke, DDV, skupaj, pogoji, podpis

#### 🖼️ Galerija realizacij
- Masonry layout (CSS columns, responsive)
- Lightbox s pred/po/drsnik + navigacija (←/→/ESC)
- Filtri (material pills, profil, lokacija, leto) + iskalnik
- PDF katalog realizacij (jsPDF, 2/stran, Roksal branding)
- Statistika + featured badge + sort opcije

#### 📚 Katalog profilov
- 10 Roksal profilov (WPC H-Line, V-Line, Panel, Steklo, Inox Line/Trosse, ALU Klasik/Modern, Steklo Full/Mini)
- Iskanje po nazivu/šifri/materialu
- Filtri po 10 kategorijah
- Vizualni preview profila (vodoravne/pokončne letve, steklo)
- RAL barvni indikator, cena €/m, dimenzije

#### ✏️ Skice
- Full-screen canvas z ročnim risanjem
- 3 načini (Pogled/Risanje/Mera)
- 6 barv, slider debeline
- Undo/clear
- Save/load/delete preko `/api/sketches`

#### 📋 Dokumenti
- Tehnični listi, primopredaja, e-računi, zapisniki

#### 🛡️ Varnost
- 8-točkovni kontrolni seznam
- SVG vetrni kompas
- Temperaturni indikator z digitalno termometrom
- Ghost Mode toggle

---

## 📸 Posnetki zaslona

![Domov](docs/screenshots/01-domov.png)
*Domov — dashboard s projekti*

![Meritve](docs/screenshots/02-meritve.png)
*Meritve — stopniščni čarovnik, segmenti, hitre predloge*

![Kalkulator](docs/screenshots/03-kalkulator.png)
*Kalkulator — razmak palic z SVG diagramom*

![AR kamera](docs/screenshots/04-ar-kamera.png)
*AR kamera — vizualizacija ograje na balkonu*

![Slike](docs/screenshots/05-slike.png)
*Slike — kategorije pred/med/po, masonry*

---

## 🛠️ Tehnološki sklad

| Plast | Tehnologija |
|-------|-------------|
| **Ogrodje** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| **Jezik** | [TypeScript 5](https://www.typescriptlang.org/) (strict) |
| **Stil** | [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (New York) |
| **Ikone** | [Lucide React](https://lucide.dev/) |
| **Baza** | [Prisma ORM 6](https://www.prisma.io/) + **PostgreSQL** (produkcija Neon; lokalno embedded PG 18 — `bun run db:up`) |
| **Avtentikacija** | Lastna seja: scrypt gesla + HMAC-SHA256 podpisani žetoni (NextAuth v4 na voljo, ni v uporabi) |
| **Stanje** | React hooks (Zustand na voljo) + TanStack Query |
| **Kamera/AR** | MediaDevices API + Canvas 2D + WebXR (kjer podprt) |
| **Nagib** | Device Orientation API |
| **Skice** | HTML5 Canvas z ročnim risanjem |
| **Glas** | Web Speech API (sl-SI) |
| **PDF** | [jsPDF](https://github.com/parallax/jsPDF) + jspdf-autotable |
| **PWA** | Service Worker + Web Manifest |
| **Temnitveni način** | [next-themes](https://github.com/pacocoursey/next-themes) |
| **Validacija** | [Zod 4](https://zod.dev/) |
| **Testiranje** | [Vitest 4](https://vitest.dev/) (586 testov + globalSetup embedded PG) |
| **Paketni upravitelj** | [Bun](https://bun.sh/) |
| **Linting** | ESLint 9 + eslint-config-next |

---

## 🏛️ Arhitektura

```
roksal-railing-manager/
├── prisma/
│   ├── schema.prisma          # 35 modelov (PostgreSQL)
│   ├── migrations/            # verzionirane migracije (migrate deploy)
│   ├── build-prepare.cjs      # build: generate + migrate deploy + seed (fail-closed)
│   └── seed.cjs               # Demo podatki (profili, stranke, projekti)
├── src/
│   ├── app/
│   │   ├── page.tsx           # Glavna SPA (9 zavihkov + Več meni)
│   │   └── api/               # 61 route handlerjev v 41 skupinah
│   │       ├── measurement/   # deterministični Merilni SDK API (detect/confirm/products)
│   │       ├── sync/          # mobilna sinhronizacija (SERVICE principal MOBILE_SYNC)
│   │       ├── quote/         # ponudba iz layouta (BOM + cena)
│   │       ├── railing-layout/# razpored ograje (railing-layout)
│   │       ├── ...            # glej tabelo API spodaj
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitivi (60+)
│   │   └── roksal/            # 41 glavnih modulov
│   ├── lib/
│   │   ├── measurement/       # MEASUREMENT SDK — CV detekcija + merilo + engine (brez AI)
│   │   ├── product-sdk/       # Product SDK — server-authoritative katalog + pravila
│   │   ├── procedural/        # fence-engine (panel layout + render)
│   │   ├── railing-layout.ts  # proizvodni layout (robovi, paneli, rezi, sidra)
│   │   ├── quote.ts           # BOM + ponudba iz LayoutResult
│   │   ├── project-state.ts   # statusni stroj projektov (prehodi + vloge)
│   │   ├── access.ts          # resource-level avtorizacija (matrika vlog + SERVICE)
│   │   ├── audit.ts           # revizijski dnevnik (auditInTx = atomska enota)
│   │   ├── inventory.ts       # StockLedger (transakcijska zaloga + idempotenca)
│   │   ├── auth.ts / session.ts / password.ts  # seja + scrypt + API ključi
│   │   ├── calculator.ts      # izračunne funkcije (razmak, sidra, veter, …)
│   │   ├── db.ts / db-url.ts  # Prisma Client (fail-closed na postgres://)
│   │   └── viz/               # vizualizacijska plast (VizProject/render)
│   └── hooks/
├── tools/                     # setup, smoke, benchmark, backup, pg
├── docs/                      # MEASUREMENT, SECURITY-POLICY, QUALITY, PRIMERJAVA …
└── deploy/                    # VPS runbook (Caddy + systemd + backup)
```

### Vloge uporabnikov (Prisma `Profile`)

- `ADMIN` — polni dostop, ureja cenik, katalog, vse projekte
- `VODJA` — vodi ekipo, dodeljuje projekte
- `MONTER` — vidi svoje projekte, ustvarja/ureja meritve, skice, slike
- `SKLADISCE` — upravlja zalogo

### Servisni principal (API ključ)

`rkm_…` ključ = **MOBILE_SYNC** z najmanjšimi pravicami, od R126 izrazno
scopiran: `projects:read` / `projects:write` (sync prek statusnega stroja),
`measurements:create`, `photos:read` / `photos:write`. Ključ nosi tudi namen,
projektne omejitve (`--projects id1,id2`), potek (`--expires`) in per-key
omejitev hitrosti; rotacija z `--rotate`. NE sme cen/dobaviteljev/zaloge/
naročil/računov/brisanja/zaklepa. Glej [`docs/SECURITY-POLICY.md`](docs/SECURITY-POLICY.md).

---

## 🚀 Namestitev (lokalni razvoj)

### Zahteve

- [Node.js](https://nodejs.org/) 20+ ali [Bun](https://bun.sh/) 1.1+
- Git

### Koraki

```bash
# 1. Kloniraj repo
git clone https://github.com/markec12345678/Roksal-Railing-Manager.git
cd Roksal-Railing-Manager

# 2. Namesti odvisnosti
bun install

# 3. Pripravi okoljske spremenljivke
cp .env.example .env  # DATABASE_URL="postgresql://…" — vir je izključno PostgreSQL
#                       (S+8.2: prehodni SQLite način ne obstaja več). Lokalno
#                       priporočeno: `bun run db:up` (embedded PG :5433) in
#                       URL postgres://roksal:roksal@localhost:5433/roksal_dev.

# 4. Inicializiraj bazo (verzionirane migracije, brez db push)
bun run db:deploy       # prisma migrate deploy
bun run db:seed         # demo podatki (+ OPENING ledger vnosi)

# 5. Ustvari svoj račun z geslom (prijava je obvezna)
#    V .env mora biti SESSION_SECRET — brez njega prijava ne dela (fail closed).
bunx tsx tools/create-admin.ts ti@roksal.si ADMIN 'TvojeGeslo'

# 6. API ključ za mobilni klient (BalkonAR) — vidiš ga samo enkrat
#    Možnosti: --purpose --scopes --projects id1,id2 --expires 2027-06-30
#              --expires-in-days 365 --rate-limit 120 · rotacija: --rotate <id>
bunx tsx tools/create-api-key.ts "Moj telefon" --expires-in-days 365

# 7. Zaženi razvojni server
bun run dev
# → http://localhost:3000  (preusmeri na /login)

# 8. Preveri, da varnost res deluje
BASE_URL=http://localhost:3000 EMAIL=ti@roksal.si PASSWORD='TvojeGeslo' \
  python3 tools/security-smoke.py     # mora biti 48/48 zelenih
```

> **Produkcijska namestitev** (VPS + Caddy + HTTPS + systemd + backup) je opisana
> v [`deploy/README.md`](deploy/README.md). Korenski `Caddyfile` je samo za lokalni
> razvoj — prejšnja različica je vsebovala odprt proxy (`?XTransformPort=`),
> ki je bil ostanek preview-mehanizma AI graditelja.

### Skripte

| Skripta | Opis |
|---------|------|
| `bun run dev` | Zažene Next.js dev server (port 3000) |
| `bun run build` | Produkcijska build (build-prepare: generate + migrate deploy + seed) |
| `bun run start` | Zažene produkcijski server |
| `bun run test` | Vsi testi (vitest, 565, embedded PG prek globalSetup) |
| `bun run check` | tsc --noEmit + vitest run (en ukaz za vse) |
| `bunx tsc --noEmit` | Tipska kontrola celotnega projekta (trenutno 0 napak) |
| `bun run lint` | ESLint preverjanje |
| `bun run smoke` | Varnostni smoke na zagnanem strežniku (52 preverjanj) |
| `bun run bench:measurement` | R118 validacijski harness Merilnega SDK (12 scenarijev) |
| `bun run db:deploy` | `prisma migrate deploy` (verzionirane migracije) |
| `bun run db:seed` | Demo podatki |
| `bun run db:up` / `db:down` | Embedded PostgreSQL 18 na :5433 (lokalni razvoj) |
| `bun run db:reset` | Ponastavi bazo (migrate reset) |
| `bun run apikey` | API ključi: ustvari (scope-i/potek/omejitev projektov), `--rotate`, `--revoke`, `--list` — poln ključ viden samo enkrat |
| `bun run backup` | pg_dump backup (glej `tools/backup-db.ts`) |

### Privzeti uporabniki (po seed-u)

| Email | Vloga | Geslo |
|-------|-------|-------|
| `marko@roksal.si` | MONTER | — (nastavi s `tools/create-admin.ts`) |
| `admin@roksal.si` | ADMIN | — (nastavi s `tools/create-admin.ts`) |
| `peter@roksal.si` | VODJA | — (nastavi s `tools/create-admin.ts`) |
| `demo@roksal.si` | ADMIN | `RoksalDemo2026!` **(samo za javni deploy — pred produkcijo odstrani)** |

---

## 🗄️ Podatkovni model (Prisma)

35 modelov v PostgreSQL (verzionirane migracije):

| Model | Namen |
|-------|-------|
| `Profile` | Uporabniki z vlogami (ADMIN/VODJA/MONTER/SKLADISCE) |
| `Customer` | Stranke (ime, naslov, telefon, email) |
| `Project` | Projekti — statusni stroj (NACRTOVANO → V_TEKU → ZA_MONTAZO → V_IZDELAVI → MONTIRANO → ZAKLJUCENO; USTAVLJENO) |
| `Measurement` | Meritve (dolzinaMm, visinaMm, session JSON z provenance v arMetadata) |
| `Inventory` | Materialna zaloga (sifra, kolicina, minimalnaZaloga) |
| `MaterialUsage` | Poraba materiala na projektu |
| `InventoryMovement` | Premiki zaloge |
| `StockLedger` | Transakcijski knjigovodski dogodki zaloge (balanceAfter, idempotencyKey) |
| `NumberSequence` | Atomske številčne sekvence (računi, ponudbe) |
| `Document` | Dokumenti (pravi PDF artefakt v object storage, sha256, verzije) |
| `DocumentVersion` | Verzije PDF artefaktov (storageKey/mime/size/sha256, neizbrisna sled) |
| `AuditLog` | Revizijska sled (kdo/kaj/kdaj/IP, stara→nova vrednost) |
| `Notification` | Obvestila uporabnikom |
| `Profil` | Katalog profilov ograj (20 sejanih) |
| `ArSnapshot` | AR posnetki (imageUrl, točke, meritve, kalibracija) |
| `Sketch` | Skice (PNG base64) |
| `GalleryItem` | Galerija realizacij (pred/po, javno/privatno) |
| `Slope` | Meritve nagibov (kotStopinje, smer, lokacija) |
| `ProjectPhoto` | Slike projektov (PRED/MED/PO, GPS) |
| `SignatureAudit` | Pravno sledenje podpisov (IP, UA, hash PDF-a) |
| `Supplier` / `MaterialPrice` | Dobavitelji in zgodovina cen |
| `MaterialOrder` / `MaterialOrderItem` | Naročila materiala (BOM → naročilo) |
| `Crew` | Ekipe monterjev (barva za koledar) |
| `Equipment` / `EquipmentAssignment` | Oprema in dodelitve terminom |
| `InstallationSchedule` | Koledar montaže (ekipa, ure, GPS) |
| `PunchItem` | Prejemni zapisnik (closeout kontrolni seznam) |
| `Invoice` | Računi (eslog e-računi, številčenje) |
| `SiteSurvey` | Terenski pregled pred montažo |
| `ApiKey` | API ključi (MOBILE_SYNC) — pepper+SHA-256 hash, scope-i, projectScope, potek, rotacija |
| `UserSession` | Sejni register (R125): jti/naprava/potek/revoke — revokacija žetonov |
| `VizProject` / `VizRenderJob` | Vizualizacijska plast (render jobi) |

> R121: bajti slik/AR/skic/PDF živijo v **object storage** (`files/…` — local
> FS v dev, Vercel Blob v produkciji); DB hrani SAMO metadata
> (`storageKey/mime/sizeBytes/sha256`). Dostop izključno skozi avtorizirano
> ruto `GET /api/files/[…key]` (ETag = sha256). Arhitektura + restore drill:
> [`docs/STORAGE.md`](docs/STORAGE.md).

---

## 🔌 API končne točke

56 Route Handlerjev v 38 skupinah (Next.js App Router). Vse podatkovne rute
zahtevajo sejo ali servisni ključ + resource-level avtorizacijo — glej
[Varnost](#-varnost) in [`docs/SECURITY-POLICY.md`](docs/SECURITY-POLICY.md).

| Skupina | Metode | Namen |
|--------------|--------|-------|
| `/api/projects` | GET, POST, PATCH | Projekti s strankami + state machine + audit |
| `/api/measurements` | GET, POST | Klasične meritve z AR metapodatki |
| `/api/measurement/detect · confirm · products` | POST/GET | **Merilni SDK** (CV detekcija, potrditev, katalog) |
| `/api/quote` | GET, POST | Ponudba iz layouta (BOM + cena iz cenika) |
| `/api/railing-layout` | GET, POST | Razpored ograje (robovi, paneli, rezi) |
| `/api/bom-draft` · `/api/bom-refine` | GET, POST | BOM osnutek + izpopolnitve |
| `/api/sync` | GET, POST | **Mobilna sinhronizacija** (SERVICE MOBILE_SYNC; statusni stroj; audit v transakciji) |
| `/api/photos` | GET, POST, DELETE | Slike pred/med/po z GPS (resource-guard, R120) |
| `/api/ar-snapshots` · `/api/ar/analyze` | GET/POST/DELETE · POST | AR posnetki · AI sugestija (NI vir resnice) |
| `/api/measure/photo` | POST | AI ocena mere iz fotke — SAMO predlog |
| `/api/sketches` · `/api/slopes` · `/api/gallery` | GET/POST/DELETE | Skice, nagibi, galerija |
| `/api/inventory` | GET, POST | Zaloga + StockLedger premiki (idempotenca) |
| `/api/material-prices` · `suppliers` · `material-orders` | CRUD | Ceniki, dobavitelji, naročila (vodstvo) |
| `/api/documents` · `/api/invoices` (+`eslog`) · `/api/signature-audit` | CRUD | Dokumenti, računi, e-SLOG, podpisi |
| `/api/crews` · `/api/schedules` | CRUD | Ekipe in koledar montaže |
| `/api/crm` | GET, POST | CRM (LTV, opomniki) |
| `/api/punch` | GET, POST, PATCH, DELETE | Prejemni zapisnik |
| `/api/deal-lock` | GET, POST | Zaklep dogovora (audit v transakciji) |
| `/api/portal` | GET, POST | Portal stranke (clientToken) |
| `/api/audit` | GET | Revizijska sled (vodja/monter-lastni) |
| `/api/calculator` · `/api/weather` | POST · GET | Izračuni · vetrni podatki |
| `/api/auth` (+`demo`, `logout`, `password`, `register`) | GET/POST | Prijava/seja (scrypt + HMAC žeton) |
| `/api/profili` · `/api/search` · `/api/surveys` · `/api/viz/*` | CRUD | Katalog, iskanje, terenski pregled, vizualizacija |
| `/api/route.ts` | GET | Health check |

---

## 🧩 Komponente

41 glavnih modulov v `src/components/roksal/` (~44.000 vrstic) + 60+ shadcn/ui
primitivov. Največji:

| Komponenta | Vrstice | Funkcija |
|-----------|---------|----------|
| `measurements-tab.tsx` | 7.818 | Meritve (9 tipov, stopniščni čarovnik, WPC, štebricki) |
| `calculator-tab.tsx` | 6.010 | Kalkulator (7 načinov + 6 izpolnitev) |
| `ar-scanner.tsx` | 2.789 | AR kamera z vizualizacijo ograje + AI sugestija |
| `webxr-scanner.tsx` | 2.377 | WebXR poskus (kjer podprt) |
| `photo-tab.tsx` | 2.570 | Slike z annotation editor, batch, pred/po |
| `dashboard-tab.tsx` | 2.101 | Domov s projekti, iskalnikom, filtri |
| `measurement-studio.tsx` | 1.630 | **Merilni studio** (deterministični CV + ročni način) |
| … | | skice, zaloga, dokumenti, PDF, CRM, logistika, tloris, galerija … |

> Opomba (R120/Problem 9): `measurements-tab` in `calculator-tab` sta zelo
> velika — razcep je načrtovan ŠELE po validacijskem passu (najprej dokazati
> kanonično verigo, potem refaktoriranje).

---

## 🧮 Knjižnica izračunov

16 izvoženih funkcij v `src/lib/calculator.ts` (razmak, sidranje, veter,
material, skladnost) — poleg tega vsebuje poslovno jedro tudi
`railing-layout.ts` (razpored), `quote.ts` (BOM/cena) in
`measurement/` (merilni engine). Pomožno: `formatEUR`, `formatSI`,
`calculateLaborCost`, `applyReserve`, `calculateDDV`, `calculateAkontacija`.

---

## 📱 Uporaba

### Glavni delovni tok monterja

1. **Na terenu** → odpri aplikacijo na telefonu (PWA)
2. **Domov** → izberi projekt (ali ustvari nov)
3. **Meritve** → uporabi stopniščni čarovnik ali hitro predlogo, dodaj meritve z glasom
4. **AR kamera** → vizualiziraj ograjo na balkonu, shrani posnetek
5. **Slike** → fotografiraj pred montažo, dodaj annotacije
6. **Kalkulator** → izračunaj razmik palic, material, ceno
7. **Nagib** → preveri vodoravnost tal
8. **Več → Izvoz PDF** → generiraj delovni list za monterja + ponudbo za stranko

### Namestitev kot PWA na telefon

1. Odpri aplikacijo v mobilnem brskalniku (Chrome/Safari)
2. Meni → **"Dodaj na domači zaslon"**
3. Aplikacija se odpre v fullscreen načinu z ikono Roksal

### Offline delovanje

- Service Worker cache-a statične resurse in navigacije
- API zahteve gredo preko omrežja (network-first), fallback na cache
- Ko povezava ni na voljo, meritve/slike ostanejo v lokalnem stanju in se sinhronizirajo ko povezava vrne

---

## 🚢 Deploy

### Produkcija (samostojno)

```bash
bun run build
bun run start
```

### Z Dockerjem (priporočeno)

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
RUN bun run db:push
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

### Na Vercel (produkcija: Neon PostgreSQL)

`bun run build` na Vercelu sam poskrbi za vse (glej `prisma/build-prepare.cjs`):

1. `prisma generate` — Vercelov `bun install` ne požene postinstall, brez tega so tipi zastareli (to je bil vzrok ERROR deploymentov),
2. `prisma migrate deploy` — verzionirane migracije na zunanjo bazo,
3. `prisma/seed.cjs` — naseli demo podatke (`SEED_ON_DEPLOY=false` izklopi),
4. brez `postgres://` URL-a build FAIL-CLOSED pade (prehodni SQLite način NE obstaja več — S+8.2).

Baza je **Neon PostgreSQL** (Vercel integration), podatki so trajni. Runbook
prehoda + backup: [`docs/POSTGRES-MIGRATION.md`](docs/POSTGRES-MIGRATION.md).

Potrebne env spremenljivke na Vercelu: `DATABASE_URL` (postgres:// URL,
**obvezen**), `SESSION_SECRET` in `API_KEY_PEPPER` (oba generiraj z
`openssl rand -base64 32`).

### Environment spremenljivke

| Spremenljivka | Opis | Privzeto |
|---------------|------|----------|
| `DATABASE_URL` | Povezava na PostgreSQL (produkcija: Vercel Postgres/Neon; lokalno: embedded PG — `bun run db:up`) | `postgresql://roksal:roksal@localhost:5433/roksal_dev` |
| `SESSION_SECRET` | Skrivnost za podpisovanje sej (**obvezno**, min 16 znakov — fail closed) | (generiraj) |
| `API_KEY_PEPPER` | Sol za hashe API ključev | (generiraj) |
| `NEXTAUTH_URL` | URL aplikacije | `http://localhost:3000` |
| `OPENWEATHER_API_KEY` | API ključ za vetrne podatke | (opcijsko) |
| `ZAI_VISION_MODEL` | VLM model za DVE sugestivni AI orodji (`/api/ar/analyze`, `/api/measure/photo`) — NI vir resnice | `glm-4.5v` |

---

## 🆚 Diferenciacija od konkurence

### Najbližji konkurenti

| Funkcija | AR Railing (Devden) | Baluster Calculator | AR Ruler | Joist | **Roksal** |
|----------|:-------------------:|:-------------------:|:--------:|:-----:|:----------:|
| AR vizualizacija ograj | ✅ | — | — | — | ✅ |
| Dodajanje/mikanje točk | ✅ | — | — | — | ✅ |
| AR meritve razdalj | — | — | ✅ | — | ✅ |
| Stopniščni čarovnik | — | — | — | — | ✅ |
| Štebricki z oštevilčenjem | — | — | — | — | ✅ |
| WPC orientacije (pokončne/vodoravne/poševne) | — | — | — | — | ✅ |
| Kalkulator materiala | — | delno | — | — | ✅ |
| Skladnost s predpisi (SIST EN) | — | — | — | — | ✅ |
| Slikanje z annotacijami | — | — | — | — | ✅ |
| Pred/po pari | — | — | — | — | ✅ |
| PDF delovni list + ponudba | — | — | — | delno | ✅ |
| Galerija realizacij | — | — | — | — | ✅ |
| Katalog profilov po meri | — | — | — | — | ✅ |
| Nagib/libela | — | — | — | — | ✅ |
| Glasovni vnos | — | — | — | — | ✅ |
| PWA offline | — | — | — | — | ✅ |
| Namensko za Roksal Kranj | — | — | — | — | ✅ |

**Zaključek:** AR Railing je potrošniška aplikacija za lastnike stanovanj; Roksal Railing Manager je **profesionalno orodje za monterja** s celovitim delovnim tokom.

---

## 🔒 Varnost

> Od 2026-09-22: prijava s scrypt gesli in podpisanimi sejnimi žetoni, zaščitene
> vse podatkovne API rute (resource-level avtorizacija), API ključi s hashem v
> bazi kot servisni principal MOBILE_SYNC z najmanjšimi pravicami (R120).
> Preveri z `python3 tools/security-smoke.py`. Podrobnosti v
> [`docs/SECURITY-POLICY.md`](docs/SECURITY-POLICY.md) in [`FIXES.md`](FIXES.md).

### Avtentikacija

- **Lastna seja** (namensko brez next-auth@4 — peer range `next ^12||^13||^14`, projekt teče na Next 16):
  HMAC-SHA256 podpisan žeton, 12 h veljavnost, `HttpOnly` + `SameSite=Lax` piškotek
- **Sejni register + revokacija** (R125, issue #5 §2): vsak žeton nosi `jti` = vrstica v
  `UserSession`; odjava / odjava vseh naprav / menjava gesla / brisanje profila prekličejo
  žeton TAKOJ (ukraden žeton ne preživi). Active-session pregled + revoke posamezne naprave
  prek `/api/auth/sessions`; UI gumb Odjava v TopBar. Fail-closed: žeton brez `jti` ni veljaven.
- Gesla: **scrypt** (N=16384, r=8, p=1) z `timingSafeEqual` primerjavo
- Brute-force zaščita: 10 poskusov / 15 min na (IP, e-mail) par — `src/lib/rate-limit.ts`
- API ključi `rkm_…` samo s pepper-hashem v bazi, preklicljivi
- Vloge: ADMIN, VODJA, MONTER, SKLADISCE
- Audit log vseh sprememb (kdaj, kdo, stara/nova vrednost)

### Podatki

- Baza: **PostgreSQL** (produkcija Neon; lokalno embedded PG 18 na :5433;
  brez `postgres://` URL-a sistem fail-closed — SQLite ni podprt od S+8.2)
- Gesla: **scrypt** (N=16384, r=8, p=1) — bcrypt NI v uporabi
- Slike/AR/skice/PDF: bajti v **object storage**, DB samo metadata — R121
  DOKONČANO (`docs/STORAGE.md`); idempotentna migracija iz base64 =
  `bun tools/migrate-base64-to-storage.ts --commit`
- GPS: samo ob eksplicitni uporabnikovi privolitvi
- Backup: `bun run backup` (pg_dump) + runbook v `docs/POSTGRES-MIGRATION.md`

### HTTPS obvezno

Aplikacija uporablja:
- Kamera (`getUserMedia`) — zahteva HTTPS
- Device Orientation (iOS) — zahteva HTTPS + gesto
- Geolocation — zahteva HTTPS
- Service Worker — zahteva HTTPS

---

## 📄 Licenca

**Proprietary** — lastništvo Roksal d.o.o. Kranj.

Vse pravice pridržane. Nedovoljena uporaba, kopiranje ali distribucija brez pisnega dovoljenja Roksal d.o.o. je prepovedana.

© 2024–2025 Roksal d.o.o., Kranj, Slovenija.

---

## 📞 Kontakt

**Roksal d.o.o. Kranj**
- Spletna stran: [roksal.si](https://roksal.si) (opcijsko)
- Email: info@roksal.si
- Telefon: +386 4 XX XX XXX

---

## 🙏 Zahvale

- [Next.js](https://nextjs.org/) — ogrodje
- [Prisma](https://www.prisma.io/) — ORM
- [shadcn/ui](https://ui.shadcn.com/) — UI komponente
- [Tailwind CSS](https://tailwindcss.com/) — stil
- [Lucide](https://lucide.dev/) — ikone
- [jsPDF](https://github.com/parallax/jsPDF) — PDF generacija

---

**Razvito s ❤️ za monterje balkonskih ograj.**
