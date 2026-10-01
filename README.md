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
- 📴 **Deluje offline** — PWA s service workerjem; zapisi se vrstijo v IndexedDB
  vrsto (idempotentno pošiljanje z `Idempotency-Key`, retry/backoff, 4xx ni
  nikoli tiho izgubljen) in pošljejo samodejno ob povezavi; zapisi drugega
  uporabnika se NE pošljejo pod tvojo sejo (lastništvo vrste + ekspliciten
  prevzem); odjava počisti SW cache in sejske podatke; API odgovori so vedno
  `Cache-Control: no-store` (uporabnik A → odjava → uporabnik B ne vidi A-jevih
  podatkov iz cache-a)
- 🌐 **Portal stranke** — javna stran za sledenje projekta z življenjskim ciklom
  povezave: kripto žeton (90 dni potek, revokacija, obnova), dostopni dnevnik z
  hashiranim IP, skupna omejitev hitrosti in enotna 404 za vsa neveljavna stanja
- 👥 **Ekipa — življenjski cikl računov** (R134, issue #5 §9): povabila z enkratno
  aktivacijsko povezavo (hash v bazi, 7 dni), deaktivacija/zaklep z TAKOJŠNJO
  revokacijo že izdanih žetonov (preverba ob vsakem zahtevku), sprememba vloge,
  reset gesla z začasnim geslom + prisilno zamenjavo, menjava e-pošte s
  trenutnim geslom — vse samo ADMIN, vse v dnevniku
- 📏 **Merilna povezava (samomeritev)** (R133, issue #5 §8) — LOČEN scoped žeton za
  javno samomeritev (/m/[token]): lasten potek/revokacija/onemogočeno, Idempotency-Key
  (strežniški exactly-once replay), duplicate protection (dedupeHash, 30 min), strop
  telesa 8 kB, dva rate žebrka (IP + žeton), audit vsakega poskusa z hashiranim IP,
  ownership marker 'public:measure' + upravljanje v dashboardu (izdaja/izklop/preklic)
- 🛡️ **Matrika dovoljenj** (R135, issue #5 §10) — vsaka poslovna ruta preverja
  KONKRETNO pravico (`invoices.create`, `price.override`, `portal.manage`, …)
  namesto vloge: enoten katalog 28 pravic (`src/lib/permissions.ts`), vloga →
  pravice (ADMIN 28, VODJA 27, MONTER terenskih 11, SKLADISCE skladiščnih 7,
  API ključ izključno iz scope-ov), sporočila 403 imenujejo manjkajočo pravico,
  odjemalec dobi svoje pravice prek `GET /api/auth` — UI skriva akcije brez
  pravic in pošteno pokaže stanje "Ureja pisarna" (portal/ekipa)
- 🗄️ **PostgreSQL** — verzionirane migracije (`migrate deploy`), produkcija Neon

### Statistika projekta (usklajeno z HEAD, R135)

| Metrika | Vrednost |
|---------|----------|
| Vrstic kode (src) | ~91.400 |
| React komponent | 41 roksal modulov + 60+ UI primitivov |
| API končne točke | 61 route handlerjev v 41 skupinah |
| Prisma modelov | 45 (PostgreSQL) |
| Prisma migracij | verzionirane (`migrate deploy`) |
| Testi (vitest) | **5021** (306 datotek, vključno z globalSetup embedded PG) |
| Varnostni smoke | 143 preverjanj na zagnanem strežniku (`tools/security-smoke.py`, del pogojno) |
| Product SDK katalog | 8 WoodCore profilov (server-authoritative) |
| Katalog profilov (Profil) | 20 sejanih (WPC, ALU, Inox, Steklo) |
| Jezik vmesnika | Slovenščina |

> Številke se osvežujejo ob Documentation Truth Pass — zadnjič R122.

---

## ✨ Funkcije

Aplikacija ima **9 glavnih zavihkov** (Domov, Vizualizacija, AR kamera, Slike,
Kalkulator, Meritve, Nagib, Zaloga, Več) + **15 podzavihkov** v meniju "Več"
(Merilni studio, Ponudba s podpisom, Post-Signature, CRM, Material, Logistika (oprema: kalibracija + prekrivanja),
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

#### 📄 Izvoz PDF/CSV/ICS
- **Delovni list monterja** — glava Roksal, podatki projekta, meritve, slike pred/med/po, opombe, podpisi
- **Ponudba za stranko** — postavke, DDV, skupaj, pogoji, podpis
- **Koledar pregledov (PDF + CSV + ICS, 10./25./26. člen izvozne družine)** — ISTA koledarska resnica v treh oblikah: PDF časovna vrsta (najbližji pregled prvi), CSV ravnina za Excel (BOM, isti 7 stolpcev) in ICS (RFC 5545 — uvoz v Google/Outlook/telefon, celodnevni dogodki, CRLF, brez BOM, zavijanje ≤ 75 oktetov)
- **Oprema cikel (PDF + CSV + dokaz na zaslonu, 22./27./36. člen izvozne družine)** — ISTA življenjska cikl resnica: pregledi, kalibracije (4 iskrene veje), statusi VSE opreme (NAZIV ASC referenčni red) — PDF dokument IN CSV ravnina za Excel/revizijo (8 stolpcev VERBATIM, Sklep VERBATIM, fail-closed pri praznem seznamu) **+ dokaz NA ZASLONU** (36. člen R306 — bralni ZASLONSKI član: mini-vrstica pokaže ŠTEVCE žigov, dokaz pokaže KATERA oprema potrebuje akcijo — delavnica/pisarna vidi nazive TAKOJ, brez tiska in Excela; ČIST filter pregleda R266 EN VIR — ISTI 4 žigi kot PDF/CSV celice [zapadel pregled rdeče, nezabeležen pregled amber, potečena kalibracija rdeče z rokom, manjkajoč kalibracijski rok amber]; nemerska oprema sivo 'ne zahteva' — NI alarm, brez lokacije NI akcija; kos z več žigi = ENA vrstica — iskren dvojni števec 'vrstic N · žigov M' [N ≤ M, pariteta mini-vrstice per žig]; 0 žigov = iskren zelen žig — nikoli skrit; 0 opreme = blok pravilno odsoten — pregled fail-closed)
- **Konflikti tedenskega vozni reda (pregled 30. člen + CSV izvoz 31. člen + PDF izvoz 32. člen + dokaz na zaslonu 37. člen izvozne družine, issue #1 §7 branje)** — determinističen pregled dvojnih rezervacij ekipe v 7-dnevnem okviru NA ZASLONU (mini-vrstica zelen/rdeč) **+ Konflikti CSV** (dokazani pari prekrivanj za Excel/revizijo — en par = ena vrstica: oba člena z VERBATIM ISO časom, status labeli, meta Konfliktov/Ekip z konflikti/Pregledanih/Sklep EN VIR; zelen žig = ni datoteke, iskren toast — fail-closed) **+ Konflikti PDF** (32. člen R302 — ISTI dokaz na tisku za pisarno/revizijo: glava tabele ×10 UVOŽENA iz CSV brata, Sklep = ISTO besedilo kot rdeč žig + CSV meta + toast — ŠTIRI potrošniki ENEGA niza; KPI Konfliktov/Ekip/Pregledanih/Okvir; dan prekrivanja rdeče bold; bajtni determinizem FNV-1a soli 0xb9–0xbc; zelen žig = ni datoteke — fail-closed) **+ dokaz NA ZASLONU** (37. člen R307 — bralni ZASLONSKI član: mini-vrstica pokaže ŠTEVEC (rdeč žig EN VIR konfliktiSklep — NIČ dvojnega besedila), dokaz pokaže PAROVE TAKOJ — en par = ena vrstica z OBA člena (čas okna vozniRedCasOkno R255, projekt '—' iskren, status labeli VERBATIM), ekipa rdeče, dan prekrivanja ISO; ISTI pari in ISTI vrstni red kot Konflikti CSV/PDF — WYSIWYG; Pregledanih/Parov števec = resnica obsega; dokaz je IZKLJUČNO rdeča veja — zelen žig = iskrena čistost brez dokaza; 0 terminov = blok pravilno odsoten): isti poli-odprto pravilo kot API 409 (nazaj-na-nazaj dovoljen; Preklicano/Zaključeno ne zasede; brez konca = brez dokazanega prekrivanja) — EN VIR tedenskiKonflikti, zrcalna sinhronizacija s strežniškim pravilom pod STRAŽAR testom
- **Tedenski vozni red (PDF + CSV + ICS + ICS po ekipah + PDF po ekipah + CSV po ekipah + po dnevih na zaslonu, 12./23./28./29./33./34./35. člen izvozne družine)** — ISTA 7-dnevna resnica v treh oblikah: PDF razgled po dnevih (pisarna/vodstvo), CSV ravnina za Excel (BOM, 9 stolpcev) in ICS (RFC 5545 — ekipa uvozi razpored v telefon; DTSTART/DTEND = resnične ure + predvideno trajanje po R139/R172 kanonu, STATUS CANCELLED/TENTATIVE/CONFIRMED, X-ROKSAL-STATUS/X-ROKSAL-OBSEG VERBATIM, CRLF, brez BOM) **+ ICS po ekipi** (29. člen R299 — isti 7-dnevni okvir filtriran na eno ekipo: čipi za vsako ekipo z vsaj enim terminom, X-ROKSAL-EKIPA VERBATIM, lasten PRODID + UID predpona z FNV-1a hashom — ni trkov z osnovnim ICS ob sočasnem uvozu; neznana/prazna ekipa = fail-closed TypeError, nikoli prazna datoteka) **+ Ekipe PDF** (33. člen R303 — VODJA tisk: ENA sekcija na ekipo na ENEM dokumentu, isti seznam in vrstni red kot ICS po ekipi EN VIR tedenskiEkipaImena; Dan/Čas/Projekt/Stranka/Status/Ure/Lokacija, preklicani vidno rdeče, '—' sivo; KPI Ekip/Terminov po ekipah/Načrtovane ure '≥'/Okvir; brez-ekipe termini NISO sekcije — iskren števec 'brez ekipe: N' v sklepu (ISTO besedilo v toastu — dva potrošnika ENEGA niza); bajtni determinizem FNV-1a soli 0xbd–0xc0; 0 ekip = ni datoteke, iskren toast — fail-closed mirror R299) **+ Ekipe CSV** (34. člen R304 — VODJA strojna resnica: ENA VRSTICA na termin z Ekipa STOLPCEM namesto PDF sekcij, ISTI pregled EN VIR tedenskiEkipaPregled R303 — skupine ASC UTF-16, termini sortirajVozniRed f(množica); glava ×9 [Ekipa/Dan ISO/Dan v tednu/Čas vozniRedCasOkno/Projekt/Stranka/Status/Ure/Lokacija], '—' sivo; meta kanon Obseg/Ekip/Terminov po ekipah/Načrtovane ure '≥' + pogojni Brez ure/Preklicani/Brez ekipe (iskren števec — vidni odpad) + Terminov skupaj + Sklep UVOŽEN tedenskiEkipaPdfSklep (ŠTIRI potrošniki ENEGA niza: PDF sklep + PDF/toast + CSV meta + CSV/toast) + Izvoženo ob; ime Tedenski-po-ekipah-YYYY-MM-DD.csv; 0 ekip = ni datoteke, iskren toast — fail-closed mirror R299/R303; Ekipe PDF = tisk za vodjo, Ekipe CSV = Excel filtriranje po ekipi) **+ Ekipe po dnevih NA ZASLONU** (35. člen R305 — bralni ZASLONSKI član: vodja vidi teden TAKOJ NA POGLED — brez tiska (Ekipe PDF = tisk) in brez Excela (Ekipe CSV = filtriranje), ZASLON = takoj; EN VIR pregled R303, ČISTA pregrupacija po dnevih: 7 dni okna ASC VERBATIM, vsak dan vrstice ekipa ASC × čas ASC (ohranjen pregledov sort), preklicani rdeče in šteti per dan (iskren odpad — pariteta PDF), prazni dnevi VIDNI ('—' / 'Brez terminov na ta dan' — nikoli skriti); brez-ekipe termini NISO vrstice — iskren števec v sklepu (PETI potrošnik ENEGA niza: PDF sklep + PDF/toast + CSV meta + CSV/toast → ZASLON, WYSIWYG); 0 ekip = iskrena prazna veja z dejanjem 'Dodeli ekipo v terminu' — particija okna dokazana)

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
- Politika občutljivih podatkov: [docs/PODATKI.md](docs/PODATKI.md) (§38 — inventar + zaščita + kaj se NE hrani)

#### ⚙️ Avtomatizacija (issue #1 — deterministično jedro)
- 100 % deterministična jedra: kalkulacije, izvozi (40+ PDF/CSV + ICS koledar — 26./27./28./29. člen izvozne družine R296/R297/R298/R299), varnost, sync — enaki vhodi = bajtno enak izhod
- AI = neobvezna pomoč, NIKOLI vir resnice (iskren GPU stub + VLM foto ocena z determinističnim nadomestkom)
- **AI raba — iskrena resnica na zaslonu** (R311, 41. člen — issue #1 Deliverable 5): vodjin pregled
  nosi per-površinski dokaz (`src/lib/ai-raba-pregled.ts`, ČISTA projekcija katalog × AI_KANDIDATI —
  NIČ nove resnice): 2 živi AI površini [VLM foto ocena + GPU render stub], obe z IZREČENIM
  determinističnim nadomestkom razrešenim iz ISTEGA kataloga; 3 iskreni kandidati
  (NE-IMPLEMENTIRANO, nič povezano — nikoli lažna implementacija); 0 AI-obveznih — jedro deluje
  brez AI; fail-closed: AI vnos brez nadomestka / nadomestek brez razrešitve → TypeError; WYSIWYG
  sklep (zaslon + testi + docs berejo ISTI niz)
- **Meritve zmogljivosti — iskrene meritve jedra** (R312+R313, 42./43. člen — issue #1 Deliverable 6):
  vodjin pregled nosi blok `zmogljivost-dokaz` (`src/lib/zmogljivost-pregled.ts`) — 10 realnih
  meritev pomembnih determinističnih operacij (kalkulator razmiki/vetrna, konfliktni pregled/
  dokaz/CSV/**PDF**, termini urAgregat/CSV, AI raba projekcija, računi po projektih **PDF**) na
  fiksnih predstavitvenih vhodih; vsak izhod vsake iteracije PREVERJEN (PDF z %PDF- magijo;
  merjenje pokvare funkcije = lažna resnica → TypeError);
  fail-closed: ne-polje / brez kontrakta / < 3 iteracij / ura tekla nazaj / izhod ne preveri;
  časi (min/mediana/max ms) so strojno odvisna resnica izrecno označena 'na tej napravi' —
  izris ŠELE v brskalniku (nič SSR hydration laži); struktura deterministična (DI ura — testi
  dokazujejo bajtno enakost); WYSIWYG sklep (zaslon + testi berejo ISTI niz)
- **Avtomatizacija — audit tabela na zaslonu** (R314, 44. člen — issue #1 Deliverable 4):
  vodjin pregled nosi blok `avtomatizacija-dokaz` (`src/lib/avtomatizacija-pregled.ts`) —
  feature-by-feature pregled vseh območij poslovanja (§1–§11), vsako IZRECNO klasificirano
  (DETERMINISTIČNO / SDK / SKRIPTA / AI-OPCIJSKO / AI-OBVEZNO) s KONKRETIMA potmi
  implementacije + dokaza in iskreno opombo; ČISTA projekcija EN VIR audita
  (`AVTOMATIZACIJA_AUDIT` — števec izračunani, NIČ trdo kodiranih števil; strazar R294
  dokazuje, da poti obstajajo na disku — tabela ne sme sanjati); fail-closed ×6
  (ne-polje / prazen audit / prazno območje / neznani razred / vrstica brez poti ali
  opombe → TypeError); značke 100 % roksal žetoni (R225/R226 čisto — nič numeričnih
  barvnih klas v vodjinem pogledu); WYSIWYG sklep: 11 območij · 10 DETERMINISTIČNO ·
  1 AI-OPCIJSKO · AI-OBVEZNO: 0 (zaslon + testi berejo ISTI niz — nič dvojnega sklepa)
- **Stil val 5** (R314): calculator-tab ×8 + post-signature-panel ×7 + photo-tab ×5 =
  20 mest harmoniziranih na roksal žetone (0 novih hex); 2 izrecni izjemi zaklenjeni
  (photo-tab kategorija faze PRED blue / MED amber / PO green — barvno kodirana
  kategorija med sorodniki, R308/R312 precedens)
- **Končna verifikacija proti HEAD** (R315, 45. člen — issue #1 **Deliverable 7**):
  vodjin pregled nosi blok `koncna-verifikacija-dokaz` (`src/lib/koncna-verifikacija.ts`) —
  vsako območje audita (§1–§11) z IZRECNO vezavo na verifikacijske plasti
  (vitest · build-needleji · E2E ŽIVO · prod-qa · smoke) + 8 sprejemnih kriterijev
  iz issue #1 z mehanično izpeljavo in KONKRETNIM dokazom (poti na disku — strazar
  dokazuje obstoj, glob dokazi 'r*-…' preverjeni proti drevesu); totalen fail-closed
  join (manjkajoča vezava / neznana plast / kriterij brez izpeljave ali dokaza →
  TypeError z imenom graditelja); dokumentirano v `docs/koncna-verifikacija-head.md`
  (veza na HEAD iskrena: delovno drevo = byte-določeno s HEAD, verifikacija per runda,
  dokument NE laže o števcih/hashih); WYSIWYG sklep izračunan (11/11 območij ·
  8 kriterijev · AI-OBVEZNO: 0 — zaslon + testi + docs berejo ISTI niz)
- **Stil val 6** (R315): inclinometer-tab ×5 + site-survey-tab ×4 + ar-scanner ×3 +
  pwa-status ×3 + password-change-banner ×3 (+2 ikona žetoni) = 19 dotikov —
  surove amber → roksal žetoni (0 novih hex); 2 novi izjemi zaklenjeni
  (inclinometer senzorjska lestvica denied=red/unsupported=amber; site-survey
  PODLAGA kategorija barv z rdečim bratom — R308/R311 precedens); mrtva ternara
  v site-survey poenostavljena (obe veji isti žeton)
- **Izvoz poročila končne verifikacije kot JSON** (R316, 46. člen — issue #1
  **IZVOZI družina**): vodjin končna-verifikacija blok dobi gumb `JSON`
  (a11y družina: aria-label + title, R291/R293 precedens) — `koncnaVerifikacijaJson`
  (`src/lib/koncna-verifikacija.ts`) = ČISTA projekcija `koncnaVerifikacija` —
  **determinističen** JSON (shema + 11 območij + 8 kriterijev + sklep WYSIWYG,
  fiksni vrstni red ključev, 2-presledkov zamik, POSIX konec; brez metapodatkov
  časa/hash/števca testov — isti HEAD = bajtno identična datoteka); fail-closed
  propagacija TypeError graditelja; DETERMINIZEM ŽIVO dokazan v E2E (Z0an: dva
  izvoza bajtno enaka)
- **Izvoz avtomatizacijskega audita kot CSV** (R317, 47. člen — issue #1
  **IZVOZI družina**, Deliverable 4 kot prenosljiv artifact): vodjin
  avtomatizacija-dokaz blok dobi gumb `CSV` (isti a11y/gumb vzorec kot JSON
  brat) — `avtomatizacijaAuditCsv` (`src/lib/avtomatizacija-pregled.ts`) =
  ČISTA projekcija `AVTOMATIZACIJA_AUDIT` prek `avtomatizacijaPregled`
  validacije (fail-closed brezplačno — NIČ podvojenih pravil) — **determinističen**
  CSV po kanonu R136 (BOM + podpičje + CRLF + RFC 4180 citiranje; glave
  WYSIWYG + 11 območij z potmi implementacije/dokaza pipe-joined + sklep EN
  VIR meta vrstica; brez časa/hash — isti HEAD = bajtno identična datoteka);
  DETERMINIZEM ŽIVO v E2E Z0ao (dva izvoza bajtno enaka + BOM preverjen NA
  BAJTIH — capture plast Response.text() BOM odstrani, blob bajti ne)
- **Stil val 8 — izvozna družina focus-visible ring žetoni** (R317): IZRECNI
  roksal ring žetoni po vseh 53 izvoznih gumbih (ui baza nosi generičen
  ring-ring/50 — družina nosi žetone): site-survey PDF gumb harmoniziran
  (edini brez izrecnega žetona) + deal-pipeline/rate-limit ring-2 širine
  popravljene + NOV audit CSV gumb (amber/50 + offset — bratska simetrija vodja
  blok glav ×3: dnevni R163 + JSON R316 + CSV R317); r317-stil-val8 STRAŽAR
  (GLOBALNI sken: vsak izvozni gumb nosi izrecen ring žeton, barva = roksal
  navy/40 ALI amber/50, amber SAMO v zaklenjenem registru — anti-stale)
- **Izvoz avtomatizacijskega audita kot PDF** (R318, 48. člen — issue #1
  **IZVOZI družina**, Deliverable 4 kot tisk za pisarno/revizijo): vodjin
  avtomatizacija-dokaz blok dobi gumb `PDF` (PDF brat CSV R317 — vzorec R302
  konflikti; isti a11y/gumb vzorec kot CSV brat) —
  `buildAvtomatizacijaAuditPdfDoc` (`src/lib/avtomatizacija-audit-pdf.ts`,
  LOČEN lib — družinski vzorec R302) = ČISTA projekcija `AVTOMATIZACIJA_AUDIT`
  prek `avtomatizacijaPregled` validacije (EN VIR — `AUDIT_CSV_GLAVE` +
  `AUDIT_VIR_NIZ` UVOŽENA iz CSV brata: PDF in CSV ne moreta divergirati po
  konstrukciji) — **determinističen** PDF (KPI ×4 izračunani iz
  `pregled.poRazredu`; tabela po območjih z razredom prikazno + poti
  pipe-joined + sklep verbatim; fiksni formatni žig
  `AUDIT_PDF_ZIG_FIKSNI` + FNV soli 0xc1–0xc4; brez časa v vsebini — isti
  HEAD = bajtno identična datoteka); **DETERMINIZEM ŽIVO NA BAJTIH** v E2E
  Z0ap (dva izvoza bajtno enaka — prvi PDF z živim bajtnim determinizmom v
  družini; %PDF- magija + MIME application/pdf na blob bajtih)
- **Izvoz poročila končne verifikacije kot PDF** (R320, 49. člen — issue #1
  **IZVOZI družina**, Deliverable 7 kot tisk za pisarno/revizijo; KOLIZIJA:
  vzporedna seja je vzela številko R319 — runda preimenovana po kanonu
  vzporednih sej): vodjin končna-verifikacija blok dobi gumb `PDF` (PDF brat
  JSON R316 — vzorec R318 audit-pdf, LOČEN lib `src/lib/koncna-verifikacija-pdf.ts`) —
  `buildKoncnaVerifikacijaPdfDoc` = ČISTA projekcija `koncnaVerifikacija`
  validacije (EN VIR — sklep = PETI potrošnik ENEGA niza [zaslon + JSON +
  testi + docs + PDF]; kriteriji verbatim) — **determinističen** PDF (KPI ×4
  izračunani iz kv; tabela dokaznih plasti po območjih [plasti pipe-joined]
  + tabela 8 kriterijev; fiksni formatni žig `KONCNA_PDF_ZIG_FIKSNI` + FNV
  soli 0xc5–0xc8 [register — bratje NE delijo semen]; brez časa v vsebini —
  isti HEAD = bajtno identična datoteka); **DETERMINIZEM ŽIVO NA BAJTIH** v
  E2E Z0aq (dva izvoza bajtno enaka; %PDF- magija + MIME application/pdf na
  blob bajtih)
- **Izvoz meritev zmogljivosti kot PDF** (R321, 50. člen — issue #1
  **IZVOZI družina**, Deliverable 6 kot tisk za pisarno/revizijo): vodjin
  zmogljivost-dokaz blok dobi gumb `PDF` (brat zaslona R312 — vzorec
  R318/R320, LOČEN lib `src/lib/zmogljivost-pregled-pdf.ts`) —
  `buildZmogljivostPdfDoc` = ČISTA projekcija **POSREDOVANEGA** pregleda
  (meritev se izvede ENKRAT v brskalniku — PDF NE meri znova; drugi tek bi
  izkazal druge čase in lažno dvojno resnico); **EN VIR**: `formatirajMs`
  (NOV izvoz iz brata R312 — ISTI format izraz za zaslon vrstice + PDF
  tabela; zaslon in PDF ne moreta divergirati po konstrukciji, vzorec
  AUDIT_CSV_GLAVE R317) + sklep = TRETJI potrošnik ENEGA niza (zaslon +
  testi + PDF); iskrena ničelna veja v handlerju (brez izvedene meritve NI
  izvoza — NIČ izmišljenih števil); fail-closed ×7 (meritev brez kontrakta /
  notranja neskladja časov / preverjeno ≠ true / pokvaren števec …);
  **determinističen** PDF (KPI ×4 izračunani iz pregled; fiksni formatni
  žig `ZMOGLJIVOST_PDF_ZIG_FIKSNI` + FNV soli 0xc9–0xcc [register: 0xc1–0xc4
  audit, 0xc5–0xc8 končna — bratje NE delijo semen]; brez časa v vsebini);
  **DETERMINIZEM ŽIVO NA BAJTIH** v E2E Z0ar (dva izvoza bajtno enaka —
  51008 bajtov; %PDF- magija + MIME application/pdf na blob bajtih)
- **Izvoz meritev zmogljivosti kot CSV** (R323, 51. člen — issue #1
  **IZVOZI družina**, Deliverable 6 kot prenosljiv artifact; **družinska
  simetrija kanon**: Del. 4 = CSV+PDF [R317/R318], Del. 7 = JSON+PDF
  [R316/R320], Del. 6 = PDF+CSV [R321/R323]): vodjin zmogljivost-dokaz blok
  dobi gumb `CSV` (CSV brat PDF R321 — vzorec R317 audit-csv, LOČEN lib
  `src/lib/zmogljivost-pregled-csv.ts` — NO jsPDF teža) —
  `buildZmogljivostCsv` = ČISTA projekcija **POSREDOVANEGA** pregleda;
  **EN VIR kontrakt R323 v bratu R312**: glave `ZMOGLJIVOST_IZVOZ_GLAVE` +
  validacija `preveriZmogljivostPregledZaIzvoz` (×7 skupin — dvignjena iz
  PDF brata, sporočila verbatim; NIČ podvojenih pravil v družini) +
  `formatirajMs` + `ZMOGLJIVOST_VIR_NIZ` — PDF in CSV ne moreta divergirati
  po konstrukciji; toCsv kanon R136 (BOM + podpičje + CRLF + RFC 4180);
  sklep = ČETRTI potrošnik ENEGA niza (zaslon + testi + PDF + CSV);
  iskrena ničelna veja + fail-verbose toast (vzorec PDF brata);
  **DETERMINIZEM ŽIVO NA BAJTIH** v E2E Z0as (dva izvoza bajtno enaka —
  1386 bajtov; BOM magija EF BB BF + MIME text/csv + glave EN VIR pin +
  Vir niz pin na blob bajtih)
- **Stil val 11 — dokazni bloki sekcija hover mikrointerakcija** (R323):
  ENOTEN `transition-colors hover:border-roksal-amber/30` žeton na vseh
  treh vodja dokaznih blokih (zmogljivost + avtomatizacija + končna
  verifikacija) — blok odgovori z MEKŠIM bratskim amber žetonom (amber/30 <
  vrstica amber/40 val 10 — dve ravnini odgovora, jasna hierarhija
  kontejner → vrstica); brez premikanja layouta (transition-colors, NE
  transform); r322-stil-val11 STRAŽAR ×4 (vseh 3 sekcij + roksal žeton +
  hierarhija preverba + val 10 obrnjena regresija ×3 + register 3 pojavitve);
  PIN SHIFTI ×2 izrecno (val8 amber ×6→×7 + anti-stale 56→57; val9
  press-scale ×13→14 pojavitev, 7→8 gumbov)
- **Izvoz poteklih opomnikov kot CSV** (R332, 59. člen — issue #1
  **IZVOZI** družina): NOVI lib `src/lib/potekli-opomniki-csv.ts` (CSV brat
  PDF R252 — vzorec R330/R331/R297: LOČEN lib ki UVAŽA projekcijo PDF
  brata — EN VIR preverba + sort + agregat [preveriPotekliVnos +
  sortirajPotekle + potekliPovzetek + potekelDniPrek — ISTA sekvenca kot
  buildPotekliOpomnikiPdfDoc], NIČ podvojenih pravil; glava VERBATIM PDF
  autoTable head ×6; celice = ISTI izpisi kot PDF body — trim, '—' iskren
  odpad, opomnik po cenikDatumIso EN VIR, dni prek po potekelDniPrek EN
  VIR ≥ 1 monotona; meta kanon R172→R296 — Obseg + KPI trio ISTI izpisi +
  Sklep VERBATIM PDF sklepu + Izvoženo ob; filename
  `Potekli-opomniki-YYYY-MM-DD.csv` — bratska simetrija); crm-tab: ENA
  izpeljava izbora `potekliVnosiIzCustomers` ×3 (definicija + OBA brata —
  NIČ dvojnega izbora) + izvozna PAR (CSV pill navy/40 ring +
  press-scale); vitest r332-potekli-opomniki-csv ×18 (BAJTNI dokazi +
  ANTI-DIVERGENCA source pini + eksakt 30 dni prek po konstrukciji +
  determinizem + fail-closed ×6 + STRAŽAR žičenja); E2E Z0az ŽIVO S
  PODATKI (568 bajtov bajtno, seed r332-po-tmp [POTEKEL resnica],
  DETERMINIZEM ŽIVO na podatkovnih bajtih, restore + ODTIS ZERO-MUTACIJA)
- **Izvoz pozicije dobaviteljev kot CSV** (R333, 60. člen — issue #1
  **IZVOZI** družina): NOVI lib `src/lib/dobavitelji-pozicija-csv.ts` (CSV
  brat PDF R264 — vzorec R330/R331/R332/R297: LOČEN lib ki UVAŽA projekcijo
  PDF brata — EN VIR preverba + JOIN + min-invarianta + agregat + sort
  [dobaviteljiPozicijaCen — ISTA sekvenca kot buildDobaviteljiPozicijaPdfDoc]
  + odstotekNiz IZVOŽEN iz PDF brata [ISTI odstotek izpis, NIČ podvojenega
  formatiranja], NIČ podvojenih pravil; glava VERBATIM PDF autoTable head
  ×6; celice = ISTI izpisi kot PDF body — '—' iskren odpad pri povprečnem
  odstotku vseh najnižjih, najširši razpon VEDNO definiran; meta kanon
  R172→R296 — Obseg + KPI peterica ISTI izpisi kot PDF kpiBox + Sklep
  VERBATIM PDF sklepu + Izvoženo ob; filename
  `Pozicija-dobaviteljev-YYYY-MM-DD.csv` — bratska simetrija);
  material-intelligence-tab: ENA izpeljava preseka `pridobiPozicijo`
  (definicija ×1 + OBA brata ×2 — EN fetch, NIČ dvojnega preseka) +
  izvozna PAR (CSV pill navy/40 ring + press-scale + ring-offset-1 — ISTI
  žeton kot PDF brat); vitest r333-dobavitelji-pozicija-csv ×17 (BAJTNI
  dokazi + ANTI-DIVERGENCA source pini + determinizem + fail-closed ×8 +
  STRAŽAR žičenja); E2E Z0ba ŽIVO S PODATKI (797 bajtov bajtno, seed
  r333-pz-tmp [2 ceni na 2 artiklih — material_price_no_overlap
  invarianta], DETERMINIZEM ŽIVO na podatkovnih bajtih, restore + ODTIS
  ZERO-MUTACIJA ×2)
- **Stil val 20 — izvozna PAR pariteta na Material izvozni coni** (R333):
  Pozicija dobaviteljev PDF + NOVI Pozicija dobaviteljev CSV = PAR z ISTIM
  žetonom (h-6 gap-1 text-2xs press-scale navy/40 ring-offset-1 — pariteta
  bajtno); oči para FileText/FileSpreadsheet (PAR spinner-prosta — disabled
  žig pariteta loading + svoj state); definicijski naslov medija (isti
  pregled EN VIR + PDF = tisk za pogajanja, CSV = Excel za filtriranje po
  dobavitelju) + legenda medija ('Pozicija CSV = ista pozicijska resnica
  kot PDF (Excel)'); r333-stil-val20 STRAŽAR ×8 (PAR pariteta bajtno + oči
  para + naslov + legenda + val 19/18/17/16 obrnjene regresije + vodja
  ×4/×4 + globals press-scale + 0 surovih barv); val8 anti-stale drevo
  65→66 (R333 PIN SHIFT — izrecno)
- **Izvoz pregleda AI rabe kot CSV** (R337, 64. člen — issue #1
  **IZVOZI** družina): NOVI lib `src/lib/ai-raba-csv.ts` (CSV brat
  zaslona ai-raba-dokaz R311 — **ZADNJI vodja dokazni blok brez izvoza**;
  EN VIR: handler poda že IZRISANI pregled `aiRabaCsv(aiRaba)` — zaslon in
  CSV NE moreta divergirati po konstrukciji; žive AI površine verbatim
  [opis/modul/nadomestek*] + kandidati verbatim [funkcija/zakaj/status] +
  vrstica statusa = ISTA formula kot zaslon + 'AI-obveznih' IZPELJAN
  stAi − stNadomestkov = 0 po konstrukciji [NIČ trdo kodirane ničle] +
  Sklep = ISTI niz kot zaslon/testi/docs; **BREZ časa** — kanon R334/R336
  brez-časa: katalog je statična resnica repozitorija, isti katalog =
  bajtno identična datoteka, nič 'Izvoženo ob'; filename `ai-raba.csv` —
  brez datuma, bratska simetrija z `koncna-verifikacija.csv` /
  `sistem-zdravje.csv`; format kanon R136 toCsv [BOM + podpičje + CRLF +
  RFC 4180]; fail-closed po imenu polja — kanon R299)
  + vodja žičenje (exportAiRabaCsv handler — sinhron EN VIR, BREZ
  spinnerja [vzorec TRIADA R334/R335/R336]; toast REALNO resnico [števci
  ISTI kot zaslon vrstica]; fail-verbose TypeError toast; izvozna pill
  amber/50 družina [ISTI žeton kot končna verifikacija CSV pill —
  byte-paritet]; testid ai-raba-csv-pill; definicijski naslov medija +
  legenda medija) + STIL val 24 (amber/50 byte-paritet + oči para
  FileSpreadsheet + obrnjene regresije val 23/22/21 + globals + PIN
  SHIFTI ×4 izrecno: val8 drevo 69→70 + amber/50 register ×10→×11 + val9
  taktilni ×17→×18 + val21/val22/val23 sodelovanje pini — vsi čez-valovni
  pini shiftani V ENI rundi)
- **Izvoz sistema zdravja kot CSV** (R336, 63. člen — issue #1
  **IZVOZI** družina): NOVI lib `src/lib/sistem-zdravje-csv.ts` (CSV brat
  zaslona SistemZdravjeCard R187/R188/R189 — **ZADNJA vodja kartica brez
  izvoza**; EN VIR: ISTA seja zgodovina [zdravje-zgodovina] + ISTI
  `odziviStatistika` izračun [divergenca nemogoča] + ISTI `zigIzpis` klic
  kot kartica [fail-soft vzorec R185] + `BAZA_NIZ` kartica UVAŽA
  [precedens R335 STATUS_SL: const → export, zero-behavior]; **BREZ
  časa** — kanon R334 brez-časa: statičen izvoz te seje, isti zgodovina +
  build = bajtno identična datoteka, nič 'Izvoženo ob'; filename
  `sistem-zdravje.csv` — brez datuma, bratska simetrija z
  `koncna-verifikacija.csv`; format kanon R136 toCsv [BOM + podpičje +
  CRLF + RFC 4180]; fail-closed po imenu polja — kanon R299)
  + SistemZdravjeCard žičenje (handleZdravjeCsv handler — sinhron EN VIR
  graditelj, BREZ spinnerja [vzorec TRIADA R334/R335]; fail-verbose toast;
  izvozna pill navy/40 družina [val20 Material precedens — gumb v
  SESTAVLJENI kartici, izven vodja datoteke]; testid
  sistem-zdravje-csv-pill; definicijski naslov medija + legenda medija) +
  STIL val 23 (navy/40 token byte-paritet + oči para FileSpreadsheet +
  obrnjene regresije val 22/21 + globals + val 9 taktilni ×17
  NEPREMIKNJEN — file-scoped register; val 8 drevo 68→69 + amber/50
  register OSTANE ×10 — vsi pini shiftani V ENI rundi)
- **Izvoz mesečnega poročila vodje kot CSV** (R335, 62. člen — issue #1
  **IZVOZI** družina): NOVI lib `src/lib/vodja-mesecni-csv.ts` (CSV brat
  Poročilo PDF rundi M — EN VIR: ISTI `ReportData` vhod prek komponentne
  izpeljave `mesecniPregledData`, DVA potrošnika [generateMonthlyReport +
  vodjaMesecniCsv — divergenca nemogoča]; mesecIme + STATUS_SL UVOŽENA iz
  PDF brata — anti-divergenca po konstrukciji; celice = ISTI izpisi kot
  PDF body — eur/eur0 EN VIR csv-export, zapadli 'Dni zapadlo' = ISTA
  izpeljava kot PDF; glave VERBATIM PDF autoTable head ×3 + predstavitvena
  prihodki glava; sklep = VERBATIM PDF sklepna vrstica; 'Izvoženo ob' =
  PODATKOVNI izvoz z referenčnim mesecem [kanon R330–R333]; filename
  `porocilo-YYYY-MM.csv` — bratska simetrija, mesec IZ VHODA; format kanon
  R136 toCsv [BOM + podpičje + CRLF + RFC 4180]; fail-closed po imenu polja)
  + vodja žičenje (handleMesecniCsv handler + izvozna PAR pill — amber/50
  ring + offset-2 + press-scale, ISTI žeton kot PDF brat; testid
  vodja-mesecni-csv-pill; definicijski naslov medija + legenda medija) +
  STIL val 22 (PAR pariteta bajtno + oči para + obrnjene regresije val
  21/20/19/18/17/16 + vodja ×4/×4 + globals; val 8 drevo 67→68 + vodja
  amber ×9→×10 + val 9 taktilni 16→17 — vsi pini shiftani V ENI rundi)
- **Izvoz poročila končne verifikacije kot CSV** (R334, 61. člen — issue #1
  **IZVOZI** družina): NOVI lib `src/lib/koncna-verifikacija-csv.ts` (CSV
  brat JSON R316 + PDF R320 — **izvozna TRIADA** na vodja blok glavi;
  vzorec R317 audit-csv: ČISTA projekcija EN VIR graditelja
  `koncnaVerifikacija` R315 — ISTA validacija fail-closed brezplačno, NIČ
  podvojenih pravil; glavi VERBATIM PDF autoTable head T1/T2 —
  anti-divergenca, testi pinajo PROTI PDF VIRU; celice = ISTI izpisi kot
  PDF body — plasti pipe-joined + opomba dokaza iz vezave; meta = KPI ×4
  ISTI izpisi kot PDF kpiBox + Sklep VERBATIM [ŠESTI potrošnik ENEGA
  niza] + Vir niz; **BREZ časa** — kanon determinizma 46./47. člen [isti
  HEAD = bajtno identična datoteka]; filename `koncna-verifikacija.csv`
  — bratska simetrija z JSON/PDF imenoma; format kanon R136 toCsv [BOM +
  podpičje + CRLF + RFC 4180]); vodja-dashboard: handler
  `exportKoncnaVerifikacijaCsv` + izvozna TRIADA pill (amber/50 ring +
  offset-2 + press-scale — ISTI žeton kot brata) + legenda medija; vitest
  r334-koncna-verifikacija-csv ×9 (BAJTNI dokazi + ANTI-DIVERGENCA source
  pini + determinizem FULL + fail-closed podedovan + STRAŽAR žičenja);
  E2E Z0bb ŽIVO **brez seeda** (statična EN VIR registra — NIČ DB
  dotikov: 4043 bajtov + 27 vrstic + DETERMINIZEM ŽIVO FULL — OBA izvoza
  bajtno enaka; ODTIS ZERO-MUTACIJA)
- **Stil val 21 — izvozna TRIADA pariteta na vodja blok glavi** (R334):
  Končna verifikacija JSON (R316) + PDF (R320) + NOVI CSV = TRIADA z ISTIM
  žetonom (h-6 press-scale amber/50 ring offset-2 — pariteta bajtno); oči
  para Download ×2 / FileSpreadsheet (TRIADA spinner-prosta — EN VIR
  sinhron + fail-closed, vsak klik bajtno identičen); definicijski naslov
  medija (isti pregled EN VIR + PDF = tisk za pisarno, CSV = Excel za
  filtriranje po območju/plasti) + legenda medija ('Končna verifikacija
  CSV = ista dokazna resnica kot PDF in JSON (Excel — dve tabeli +
  sklep)'); r334-stil-val21 STRAŽAR ×8 (TRIADA pariteta bajtno + oči para
  + naslov + legenda + val 20/19/18/17/16 obrnjene regresije + vodja
  ×4/×4 + globals press-scale + 0 surovih barv); val8 anti-stale drevo
  66→67 + vodja amber/50 register ×8→×9 + val9 taktilni register 15→16
  (R334 PIN SHIFTI — izrecno)
- **Stil val 19 — izvozna PAR pariteta na CRM izvozni coni** (R332):
  Potekli opomniki PDF + NOVI Potekli opomniki CSV = PAR z ISTIM žetonom
  (h-7 press-scale navy/40 — pariteta bajtno); oči para
  FileDown/FileSpreadsheet (PAR spinner-prosta — disabled žig pariteta);
  definicijski naslov medija (isti pregled EN VIR + PDF = tisk za
  pisarno, CSV = Excel za filtriranje) + legenda medija ('Potekli CSV =
  isti akcijski pregled kot PDF (Excel)'); r332-stil-val19 STRAŽAR ×8
  (PAR pariteta bajtno + oči para + naslov + legenda + val 18/17/16
  obrnjene regresije + zgodovina PAR bajtno + vodja ×4/×4 + globals + 0
  surovih barv); PIN SHIFT izrecno (val8 anti-stale 64→65 [NOVI CSV gumb])
- **Izvoz pregleda spomnikov ponudb kot CSV** (R331, 58. člen — issue #1
  **IZVOZI** družina): NOVI lib `src/lib/ponudbe-spomniki-csv.ts` (CSV brat
  PDF R267 — vzorec R330/R297: LOČEN lib ki UVAŽA projekcijo PDF brata —
  EN VIR ponudbeSpomnikiPregled, NIČ podvojenih pravil; glava VERBATIM PDF
  autoTable head ×8; celice = ISTI izpisi kot PDF body — status label R161,
  spomnik/montaža po cenikDatumIso EN VIR, '—' iskren odpad,
  podpisano/odprto; meta kanon R172→R296 — Obseg + števci ×12 + Sklep
  VERBATIM PDF sklepu [stanjeSklep oznake + statusi] + Izvoženo ob; filename
  `Ponudbe-spomniki-YYYY-MM-DD.csv` — bratska simetrija); quote-followup:
  ENA izpeljava vira `pridobiPonudbeSpomnikiVnosi` ×2 (oba brata — NIČ
  dvojnega med bralci) + izvozna PAR (CSV pill navy/40 ring + press-scale);
  iskrena ločnica od R161 izvoza: R161 = prikazani seznam (prvih 12
  odprtih), TA = polna resnica vloge (VSE ponudbe, tudi podpisane); vitest
  r331-ponudbe-spomniki-csv ×16 (BAJTNI dokazi + ANTI-DIVERGENCA source
  pini + VSA stanja spomnika [Zapadel/Danes/Kmalu/Planirano/Brez] +
  determinizem + fail-closed ×6 + STRAŽAR žičenja); E2E Z0ay ŽIVO S
  PODATKI (1267 bajtov bajtno, 17 podatkovnih vrstic — polna resnica
  vloge, DETERMINIZEM ŽIVO na podatkovnih bajtih, ZERO-MUTACIJA)
- **Stil val 18 — izvozna PAR pariteta na CRM kartici + TROJICA
  press-scale** (R331): Ponudbe PDF + NOVI Ponudbe CSV = PAR z ISTIM
  žetonom (h-7 press-scale navy/40 — pariteta bajtno); oči para
  FileDown/FileSpreadsheet + Loader2 spinner pariteta; **TROJICA
  press-scale**: R161 'Izvozi CSV' gumb dobi press-scale (do zdaj edini
  izvozni gumb brez njega — iskrena nekonsistentnost odpravljena; disabled
  pogoj NEPREMIKNJEN); definicijski naslov medija (isti pregled EN VIR +
  iskrena ločnica od prikazanega seznama) + legenda medija ('PDF/CSV = VSE
  ponudbe … · prikazani seznam CSV = samo odprte prvih 12'); r331-stil-val18
  STRAŽAR ×8 (PAR pariteta bajtno + oči para + TROJICA + naslov + legenda +
  val 17/16 obrnjene regresije + zgodovina PAR bajtno + globals + 0 surovih
  barv); PIN SHIFT izrecno (val8 anti-stale 63→64 [NOVI CSV gumb])
- **Izvoz pregleda projektov in terminov kot CSV** (R330, 57. člen — issue #1
  **IZVOZI** družina): NOVI lib `src/lib/projekti-termini-csv.ts` (CSV brat
  PDF R265 — vzorec R297 oprema-cikel-csv: LOČEN lib ki UVAŽA projekcijo
  PDF brata — EN VIR projektiTerminiPregled, NIČ podvojenih pravil; glava
  VERBATIM PDF autoTable head ×8; celice = ISTI izpisi kot PDF body —
  stranka '—', ure '—' kadar nič ne šteje v vsoto, obdobje po cenikDatumIso
  EN VIR; meta kanon R172→R296 — Obseg + števci ×10 + Sklep VERBATIM PDF
  sklepu + Izvoženo ob; filename `Projekti-termini-YYYY-MM-DD.csv` —
  bratska simetrija z PDF imenom); logistics-tab: ENA izpeljava vira
  `pridobiProjektiTerminiVnosi` ×2 (oba brata — NIČ dvojnega med bralci,
  vzorec R297 pridobiOpremoVnosi) + izvozna PAR (CSV pill navy/40 ring +
  press-scale, fail-verbose toast ×2); vitest r330-projekti-termini-csv
  ×17 (BAJTNI dokazi + ANTI-DIVERGENCA source pini — Sklep segmenti in
  glava dobesedno PROTI PDF VIRU + determinizem premešan vhod + fail-closed
  ×8 + STRAŽAR žičenja); E2E Z0ax ŽIVO S PODATKI (r330-pt-tmp.cjs
  determinističen seed — 963 bajtov bajtno, glava EN VIR VERBATIM,
  DETERMINIZEM ŽIVO na podatkovnih bajtih, restore ODTIS bajtnato)
- **Stil val 17 — izvozna PAR pariteta na logistiki + definicijski naslov
  medija** (R330): Projekti PDF + NOVI Projekti CSV = PAR z ISTIM žetonom
  (shrink-0 press-scale navy/40 — pariteta, nič drugega občutka znotraj
  istega para); oči para ClipboardList/FileSpreadsheet (ISTA h-4 w-4
  mr-1); definicijski naslov izreče PRAVILA (isti pregled EN VIR; prazen
  seznam → iskren toast, nikoli prazna datoteka) + vidno razliko medija
  (PDF = tisk za vodjo, CSV = Excel za filtriranje); r330-stil-val17
  STRAŽAR ×8 (PAR pariteta bajtno + oči para + naslov + dvoklik guard
  pariteta + val 16 alarm obrnjena regresija + zgodovina PAR ×2/×2 bajtno
  + vodja ×4/×4 + globals + 0 surovih barv); PIN SHIFT izrecno (val8
  anti-stale 62→63 [NOVI CSV gumb])
- **Izvoz primerjave dobaviteljev kot PDF** (R329, 56. člen — issue #1
  **IZVOZI** družina): NOVI lib `src/lib/cena-dobavitelji-pdf.ts`
  (deterministični PDF BRAT CSV-ju R328 — LOČEN lib, vzorec vodja-csv/
  vodja-dnevni-pdf R324 / zgodovina-cen-pdf R327; EN VIR
  cenaDobaviteljiVrstice = skupni potrošnik CSV+PDF tabel — ne moreta
  divergirati po konstrukciji; FNV soli 0xd5–0xd8 [register 0xc1–0xd4
  zaseden]; fiksni formatni žig DOBAVITELJI_PDF_ZIG_FIKSNI — vsebina brez
  časa; KPI ×4 izračunani iz vhoda [narašča rdeči alarm če > 0]; WYSIWYG
  celice — narašča RED / pada NAVY; fail-closed [pokvaren now/options →
  TypeError z imenom graditelja — null NE undefined, lekcija R317 4]);
  filename `primerjava-dobaviteljev.pdf` brez datuma (bratska simetrija);
  panel izvozni PAR CSV+PDF na isti blok glavi (OBA navy/40 ring +
  press-scale, fail-verbose toast ×2 — pokvaren vhod odklonjen PREJ
  pošiljanja); vitest r329-cena-dobavitelji-pdf ×12 (BAJTNI dokazi +
  SOURCE EN VIR pini + kje VERBATIM + arhivska stabilnost CSV R328)
- **Stil val 16 — PDF brat + iskren alarm na zaslonu** (R329): izvozni PAR
  = DVA gumba (CSV + PDF — bratska simetrija z zgodovina PAR R327);
  WYSIWYG iskren alarm — Narašča > 0 = text-roksal-red + font-medium (ISTI
  pomen kot TrendingUp ikona + RED KPI v PDF), Pada > 0 = text-roksal-green
  (TrendingDown ikona — zaslonska družina rdeč/zelen, PDF rdeč/navy);
  tabelska glava border-b border-border/60; r329-stil-val16 STRAŽAR ×8
  (alarm ×2 + glava + val 15 hierarhija obrnjena regresija + zgodovina PAR
  ×2/×2 bajtno + vodja ×4/×4 + globals + 0 surovih barv); PIN SHIFT izrecno
  (val8 anti-stale 61→62 [NOVI PDF gumb])
- **Primerjava dobaviteljev (CSV izvoz + zaslon)** (R328, 55. člen — issue
  #1 §5 **supplier comparison**): NOVI lib `src/lib/cena-dobavitelji.ts`
  (drugo grupiranje ISTEGA pregleda zgodovine R326 — EN VIR, pregled kot
  PROP, nič drugega fetcha; iskren agregat ŠTEVCEV smeri narašča/pada/
  stabilna/prvi vpis — NI izmišljenega povprečnega trenda; razpon trenutnih
  cen min/max; sort naziv+supplierId po UTF-16 kodnih enotah — 100 %
  ponovljivo; kontrolna vsota parov brani sama; fail-closed ×6 skupin,
  sporočila VERBATIM z kje); filename `primerjava-dobaviteljev.csv` brez
  datuma (primerjava NIMA referenčnega dneva — kanon družine); NOVI pod
  panel `cena-dobavitelji-panel.tsx` (LOČEN datoteka — LEKCIJA R325 5:
  vodja registri se NE premaknejo; tabelska resnica + CSV gumb izvozne
  družine — navy/40 ring + press-scale, fail-verbose toast); vitest ×34
  (r328-cena-dobavitelji ×27: projekcija + CSV kanon bajtno + determinizem
  ×2 + permutacija + fail-closed ×6 + EN VIR žičenje + ARHIVSKA stabilnost
  zgodovina CSV R326; r328-stil-val15 ×7); E2E Z0av ŽIVO S PODATKI
  (determinističen seed r328-cena-tmp.cjs raise/restore — WPC-120-A: zaprt
  10.00 → odprt 12.50; CSV 321 bajtov DETERMINIZEM ŽIVO NA BAJTIH ×2
  klika; ODTIS pre==post — ZERO-MUTACIJA končnega stanja)
- **Stil val 15 — dvonivojska hierarhija na panelu Primerjava
  dobaviteljev** (R328): Card kontejner MEKŠI amber/30 + tabelska vrstica
  IZRAZITEJŠI amber/40 (val 11/12/13/14 kanon na NOVI površini);
  r328-stil-val15 STRAŽAR ×7 (hierarhija /40 > /30 + izvozni gumb navy/40
  + press-scale + zgodovina PAR obrnjena regresija bajtno ×2/×2 + vodja
  val 11/12 register ×4/×4 NEPREMIKNJEN + globals .press-scale ŽIV + 0
  surovih barv); PIN SHIFT izrecno (val8 anti-stale 60→61 [NOVI CSV gumb
  — amber/50 register ostane zaklenjen v vodji ×8])
- **Izvoz zgodovine cen materiala kot PDF** (R327, 54. člen — issue #1
  **IZVOZI** družina): NOVI lib `src/lib/cena-zgodovina-pdf.ts`
  (deterministični PDF BRAT CSV-ju R326 — LOČEN lib, jsPDF teža ne
  obremenjuje podatkovnega brata, vzorec vodja-csv/vodja-dnevni-pdf R324);
  EN VIR `cenaParVrstice` = skupni potrošnik CSV+PDF tabel (ne moreta
  divergirati po konstrukciji — vzorec vodjaKpiVrstice R324); dokument:
  ROKSAL navy glava + KPI ×4 (Narašča rdeči alarm če > 0) + tabela parov
  (ISTE glave kot CSV) + časovna vrstica (ISTI stolpci kot zaslon, '—'
  fallback za odprte cene) + Sklep/Vir sklepni vrstici; DETERMINIZEM:
  vsebina brez časa (zgodovina NIMA referenčnega dneva — filename
  `zgodovina-cen.pdf` brez datuma), fiksni žig CENA_PDF_ZIG_FIKSNI, FNV
  soli 0xd1–0xd4 (register nadaljuje R324 0xcd–0xd0); panel izvozni PAR
  CSV+PDF na isti blok glavi (OBA navy/40 ring + press-scale, OBA pod
  istim pogojem — iskrena ničelna veja); r327-cena-pdf vitest ×13 +
  CSV bajtna stabilnost (refactor NE premakne bajta); E2E Z0au razširjen
  (OBA gumba skrita v prazni veji)
- **Stil val 14 — izvozni PAR harmonizacija** (R327): OBA gumba zgodovine
  cen (CSV + PDF) z IZRECNIM navy/40 ringom + press-scale pod ISTIM
  pogojem; r327-stil-val14 STRAŽAR ×7 (para + ničelna veja skupina + val
  13 hierarhija ŽIVA + vodja ×4/×4 NEPREMIKNJEN + press-scale ŽIV + ikoni
  FileText/FileDown); PIN SHIFT izrecno (val8 anti-stale 59→60 [NOVI PDF
  gumb — amber/50 register ostane zaklenjen v vodji ×8])
- **Zgodovina cen materiala** (R325, 53. člen — issue #1 §5 **price
  history**): NOVI lib `src/lib/cena-zgodovina.ts` (ČISTA projekcija
  MaterialPrice vključno z ZAPRTO zgodovino `veljavnostDo != null` — POST
  R136 §19 že zapira stare cene, a GET je vračal samo trenutne: zgodovina
  je bila piškot brez bralca); NOVI GET route `material-prices/zgodovina`
  (r308 obseg 81→82 — edini bralec zgodovine); NOVI panel
  `CenaZgodovinaPanel` na inventory tabu (par = material × dobavitelj
  časovnica + iskrene smeri narašča/pada/stabilna/prvi vpis + Δ EUR/%
  zaokroženo na 2 decimalki + CSV gumb izvozne družine z navy/40 ringom);
  EN VIR: `CENA_ZGODOVINA_CSV_GLAVE` + `CENA_ZGODOVINA_TIMELINE_GLAVE` +
  `CENA_SMER_NIZ` + `cenaZgoSklep` + `CENA_ZGO_VIR_NIZ`; EXCLUDE ogledalo
  (NATANKO ena odprta cena per par); Date.parse razvrščanje (ISO dolžinska
  past '39Z' > '39.401Z'); fail-closed ×7 + iskrena prazna veja (brez
  podatkov NI izvoza); r325-cena-zgodovina vitest ×20 + DETERMINIZEM
  bajtno ×2; E2E Z0au ŽIVO (iskrena prazna veja + wire GET); pre-existing
  HEAD bug popravljen (r324 test /s flag vs target ES2017)
- **Stil val 13 — zgodovina cen panel dvonivojski odziv** (R325): val 11/12
  hierarhija (blok amber/30 < vrstica amber/40) razširjena na NOVO
  površino — CenaZgodovinaPanel (par-Card + časovna vrstica);
  r325-stil-val13 STRAŽAR ×5 (površina + žetona + hierarhija + vodja
  obrnjena regresija ×4/×4 + navy/40 ring dokaz); PIN SHIFTI ×2 izrecno
  (val8 anti-stale 58→59 [NOVI CSV gumb — amber/50 register ostane
  zaklenjen v vodji ×8]; r308 route obseg 81→82)
- **Izvoz dnevnega pregleda vodje kot PDF** (R324, 52. člen — issue #1
  **IZVOZI družina**): vodja "Pregled za vodjo" dobi gumb `Dnevni PDF`
  (brat CSV R163 — vzorec R318/R320/R321, LOČEN lib
  `src/lib/vodja-dnevni-pdf.ts`); vhod = POSREDOVANA resnica prek
  komponentnega EN VIR helperja `vodjaIzvozVhod` (ENA preslikava KPI/
  terminov/prihodkov, DVA potrošnika — NIČ podvojenega preslikave);
  **EN VIR kontrakt R324 dvignjen v brat R163**: glave `VODJA_KPI_GLAVE` +
  `VODJA_TERMINI_GLAVE`, validacija `preveriVodjaIzvozVhod` (sporočila
  VERBATIM, kje = graditelj), števci/zneski/ura EN VIR + KPI vrstice
  `vodjaKpiVrstice` (17 arhivskih meritev + prihodki — ISTI vrstni red kot
  CSV) + `VODJA_VIR_NIZ` (CSV arhivska oblika ostaja BAJTNO nespremenjena);
  determinističen PDF (KPI ×4 izračunani; fiksni žig `VODJA_PDF_ZIG_FIKSNI`
  + FNV soli 0xcd–0xd0 [register: 0xc9–0xcc zmogljivost]; iskren prazen
  termini blok); a11y izvozne družine (aria + title) + fail-verbose toast +
  iskrena ničelna veja; r324-vodja-dnevni-pdf vitest ×14 (bajtni dokazi +
  CSV bajtna stabilnost + kje VERBATIM ×2 + EN VIR pini)
- **Stil val 12 — današnji termini dvonivojski odziv** (R324): val 11
  hierarhija (blok amber/30 < vrstica amber/40) razširjena na NOVO
  površino — Današnji termini (Card + vrstice); r324-stil-val12 STRAŽAR ×5
  (površina + žetona + hierarhija + obrnjena regresija dokaznih blokov +
  registra ×4/×4); PIN SHIFTI ×3 izrecno (val8 amber/50 ×7→×8 + anti-stale
  57→58; val9 press-scale ×14→15 pojavitev, 8→9 gumbov; val11 blok/vrstica
  ×3→×4)
- **Stil val 10 — dokazni bloki vrstični hover mikrointerakcija** (R321):
  ENOTEN `transition-colors hover:border-roksal-amber/40` žeton na vrsticah
  vseh treh vodja dokaznih blokov (meritve zmogljivosti R312 +
  avtomatizacijski audit R314 + končna verifikacija R315) — vrstica odgovori
  z bratskim amber žetonom (ISTI žeton kot izvozna družina gumbov v ISTIH
  blokih — val8 register); brez premikanja layouta (transition-colors, NE
  transform); r321-stil-val10 STRAŽAR ×4 (vseh 3 vrstic + roksal žeton
  preverba + pill obrnjena regresija + register 3 pojavitve — R312 lekcija
  na pojavitve); PIN SHIFTI ×2 izrecno (val8 amber ×5→×6 + anti-stale
  55→56; val9 press-scale ×12→13 pojavitev, 6→7 gumbov)
- **Stil val 9 — press-scale taktilna pariteta vodja izvozne družine** (R318):
  `press-scale` mikrointerakcija ×5 na vodja izvoznih gumbov (dnevni CSV R163
  + Poročilo PDF + JSON R316 + audit CSV R317 + audit PDF R318) — taktilna
  pariteta s pill bratje (R258/R261/R293 — v ISTI datoteki že nosijo);
  amber/50 register ×3 → ×4 (PDF gumb — bratska simetrija blok glave, PIN
  SHIFT z obrnjeno regresijo); r318-stil-val9 STRAŽAR ×4 (vseh 5 gumbov
  nosi press-scale + pill obrnjena regresija + utility anti-stale + register
  11 pojavitev — R312 lekcija na pojavitve)
- **VALIDATE CHECK — zaprtje R136 obljube** (R319, issue #5 §18): migracija
  `r319_validate_checks` končno VALIDIRA vseh 8 CHECK omejitev iz R136
  (invoice_amounts_nonnegative, invoice_status_allowed, invoice_tip_allowed,
  inventory_stock_nonnegative, order_item_quantity_positive,
  order_total_nonnegative, usage_quantity_positive, price_nonnegative) —
  `convalidated = TRUE`; STRAŽAR r319-validate-checks dokazuje VERIGO
  (globalSetup gradi bazo iz nič z migrate deploy — pobrisana migracija = javna
  napaka); fail-closed poraz po zasnovi: legacy kršitev = javno padel deploy
- **GPU backend avtentikacija (S+7)** (R319): `X-API-Key` OBVEZNA glava na
  VSEH poslovnih končnih točkah FastAPI (`/render`, `/jobs/*`) —
  konstantno-časna primerjava (`hmac.compare_digest`); brez/napačna glava →
  401 (ista koda — brez razkrivanja); NE-nastavljen `QWEN_API_KEY` → 503
  (fail-closed — servis NI nikoli anonimno izpostavljen); `/` in `/health`
  odprta (Docker HEALTHCHECK); 5 novih testov pogodbe (401/401/503/health/
  full-flow) + docker-compose zahteva ključ; aplikacija pošilja glavo iz
  `VIZ_GPU_TOKEN` (URL brez žetona = fail-closed odklon, ne pošiljanje)
- **Viz render GPU integracija — POLL-ON-READ** (R319, S+7): POST pošlje
  VELJAVEN payload §20 (base64 original/product/aPreview iz shrambe — prej
  napačen `fileUrls`) + shrani `gpuJobId` (nova migracija
  `r319_viz_render_gpu`); GET `/api/viz/render/[jobId]` naredi EN korak
  polling na GPU: `completed` → PNG prenesen v viz shrambo → zakoniti prehodi
  (queued→processing→completed, državni stroj NEPOVRNJEN); `failed`/404
  (restart/TTL) → iskreno failed; prehodne napake stanja NE dotikajo —
  nikoli lažno `completed`; odjemalska poll zanka (3 s, max 6 min, cleanup)
  + prikaz PNG ob koncu; 19 novih testov (gpu-client + route)
- **Dekompozicija calculator-tab — FAZA 1** (R322 — KOLIZIJA: vzporedna seja je vzela R321, po kanonu vzporednih sej preimenovana): 6.074 → 5.372 vrstic
  (−702); mapa `calculator/` ×5 datotek — `shared.ts` (5 tipov + 7
  interfejsov + 15 konstant VERBATIM + `export`; dvig importov na vrh =
  struktura, ne vsebina) + 4 SVG diagrami (BalusterSvg, AngledSvg,
  SloveniaWindMapSvg, GlassLayersSvg — ČIST PREMIK bajtno identično, kanon
  R319 measurements faza 1); lucide uvozi ostanejo (vseh 10 ikon v rabi
  tudi v glavni komponenti); NIČ pin shiftov potrebnih (vsi stražarji po
  VSEBINI — lekcija R319 #3 potrdjena); vsebina ŽIVA v čankih dokazana
  (r322-build-needles ×5 + delegirana veriga r321[vzporedna]→R320→…→R227 FAIL=0)
- **R254 slepa pega aria-hidden detektorja ZAPRTA** (R322 — odkrita v R319,
  izboljšava takrat odložena kot kandidat): vejica v uvoznem komentarju je
  razdelila import blok pri `split(',')` → ikona NEVIDNA detektorju;
  TROJNI popravek (r254-aria-detektor.py + r254-aria-codemod.py +
  r254-aria-hidden.test.ts — strip `//` komentarjev PRED split, enaka
  logika v treh virih, kanon ENA resnica); 8 novo-vidnih ikon (5
  measurements + 3 dashboard), 5 PRAVIH a11y vrzeli odkritih in popravljenih
  IN-PLACE (Bluetooth ×2 + Mic ×3 — aria-hidden na obstoječi vrstici, BREZ
  novih vrstic → r172 vrstični pin 7427 NEPREMAKNJEN); pokritost 1430 →
  1435, 0 manjkajočih
- **QA dispatcher `scripts/qa.sh`** (R319 — konsolidacija ~891 skriptov):
  PARAMETRIZIRANA vstopna točka (`needles|smoke|e2e|prodqa|chain [runda]`,
  privzeto zadnja) — zamrznjene skripte ostajajo dokazi (kanon: NIČ brisanja);
  PRENOSLJIV zagon (substitucija legacy poti v temp kopiji + obvezen `bash -n`
  — originali nedotaknjeni); fail-closed izstopi (2 neznana faza / 3 manjka /
  4 sintaksa); STRAŽAR r319-qa-konzola zaklepa preslikavo faz
- **Dekompozicija measurements-tab — FAZA 1** (R319): 9.086 → 7.604 vrstic
  (−1.482); 6 samostojnih komponent izluščenih v `measurements/` mapo
  (CalibrationPhotoPicker, InlineInclinometer, StairDiagram, InlineKotomer,
  SteberTable, WpcDiagram) + `shared.ts` (tipi/konstante/čisti helper) — ČIST
  PREMIK brez spremembe obnašanja (bajtno identični bloki); PIN SHIFT ×5
  STRAŽARjev (r172/r231/r311/r316/r235) po kanonu R180/…/R314; BONUS:
  dekompozicija je ODKRILA slepo pego R254 codemoda (vejica v uvoznem
  komentarju je skrila `CornerDownRight` detektorju — aria-hidden dodan)
- **Dekompozicija FAZA 2 — measurements + calculator** (R325 — nadaljevanje
  odobrene Roadmap "razbitje monsterskih komponent", vzorec R319/R322):
  `measurements-tab` 7.604 → 7.153 (−451) — laserski BT blok (Web Bluetooth
  tipi/konstante/pomožne → `measurements/laser-bt.ts` ČIST PREMIK; stanje +
  GATT povezava + odklop + auto-reconnect → `measurements/use-laser.ts` hook
  — REFAKTOR: edina semantična sprememba = polnjenje forme prek
  onMeasurement povratnega klica; UI → `measurements/laser-panel.tsx` s
  props) + template localStorage blok (PREDLOGE + stopniške predloge + WPC
  konstante → `measurements/templates.ts` ČIST PREMIK); osiroteli
  Bluetooth/Radio/Unplug uvozi odstranjeni (štetje POJAVITEV, kanon R322);
  `calculator-tab` 5.372 → 4.846 (−526) — 5 PDF izvozov →
  `calculator/pdf-exports.ts` (telesa VERBATIM; closure dostop do stanja →
  eksplicitni args objekti — čiste projekcije posredovanega stanja); tipa
  CncSegment + GlassType preseljena; osirotela jsPDF/autoTable uvoza
  odstranjena; PIN SHIFT r172 vrstičnega prsta 7427 → 6976 (izrecen R323
  komentar); mikrotask vzorec PwaStatus za začetna branja v hooku (omejitev
  pravila react-hooks/set-state-in-effect — prej skrito z bailoutom compiler
  analize na 7,6k vrstični datoteki); vsebina ŽIVA v čankih dokazana
  (r323-build-needles ×9 + delegirana veriga R322→…→R227)
- **Kalkulator FAZA 7 + val 30** (R347): (1) NOV EN VIR `calculator/history.ts` →
  `getCurrentKeyResult(mode, rezultatiNacinov())` (10 načinov + fallback na
  oznako načina; args objekt `RezultatiNacinov` — 10 rezultatov + 2 rezervi
  + stekleni vhod; vzorec R325/R345/R346); **unifikacija stale kopij**:
  "Shrani izračun" gumb je nosil stale inline kopijo z STAREJŠIMI formati
  (baluster brez rezerve, material z surovim toFixed(2)€, cnc brez ostanka,
  windLocation brez cone, glass brez slojev) — zdaj ISTA resnica kot
  zgodovina; **popravek pogreše**: nalaganje shranjenih izračunov je bilo
  3-načinsko (railing/anchoring/wind) — ostalih 7 načinov = tih no-op z
  toastom, brez nalaganja; zdaj applyInputs EN VIR (vsi 10 načinov,
  konsistentno z zgodovino); `calculator-tab` 4.551 → 4.489 (−62);
  (2) **val 30** — a11y parity shranjenih izračunov + tipografija: Shrani
  izračun aria-label + title, Počisti vse (shranjeni izračuni) aria-label +
  title (parity z val 28 predloge), Naloži shranjeni izračun aria-label
  (parity zgodovina + predloga), "Shrjeni izračuni" → "Shranjeni izračuni"
  (tipografski popravek vidnega besedila, ×1, brez needle zaščite);
  0 novih hex; (3) vitest r347 ×21 (2 NOVI datoteki: r347-calc-faza7 ×13
  [10 načinov + fallback + determinizem + unifikacija stale kopij + popravka
  pogreše + FAZA 6 regresija + 0-hex] + r347-stil-val30 ×8 [3 parity
  skupine + tipografija + 0-hex + obrnjene regresije val 29/28 + R291/R293])
  — 4940/4940 (300); (4) verifikacija: tsc 0 · eslint 0 (FULL) · build svež
  EXIT=0 · needles r347 VSE OK (veriga + union registri r340–r347) ·
  smoke EXIT=0 · e2e EXIT=0 (ZERO-MUTACIJA)
- **Meritve FAZA 5 + val 31** (R348): (1) NOV EN VIR
  `measurements/izvoz-csv.ts` — `csvEsc` (podvajanje navedkov; 15 inline
  kopij izginilo), `csvDokument` (BOM + zaglavje + LF; 4 inline kopije
  izginile), `MERITVE_CSV_HEADER` + `zgradiMeritveVrstice` (17-stolpčni P1
  kontrakt — stale telesi handleExportCSV ≡ handleBulkExportCSV sta bila
  bajtno identična 2. resnica; zdaj 1 gradnik, vhodni seznam = klicateljeva
  resnica); 4 × inline Blob prenos → kanon `downloadCsvText` (R171/R296;
  MIME 'text/csv;charset=utf-8;' izgubi navlečno piko — vsebina bajtno
  ista); `measurements-tab` 6.702 → 6.652 (−50); (2) **val 31** — a11y
  parity izvozne družine meritev: 5 gumbov (CSV vse / PDF / bulk CSV /
  zgodovina CSV / steber-table CSV) dobi aria-label + title; 3 gola
  <button> + steber-table dobi izrecen focus ring navy/40 (LEKCIJA R346
  val 8 stražar potrjen ×2: nov aria gumb v družinskem skenu razkrije
  manjkajoč ring); 0 novih hex; (3) vitest r348 ×26 (2 NOVI datoteki:
  r348-meritve-faza5 ×18 [realni labeli + determinizem + EN VIR dokaz +
  stale-izginili + žičenje + R186 regresija + 0-hex] + r348-stil-val31 ×8
  [5 parity skupin + 0-hex + obrnjene regresije R186/R269/R284/R285 +
  val 30/28]) — 4966/4966 (302); (4) verifikacija: tsc 0 · eslint 0 (FULL) ·
  build svež EXIT=0 · needles r348 VSE OK (veriga + union registri
  r340–r348) · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN
  pre==post — ZERO-MUTACIJA].
- **Meritve FAZA 6 + val 32** (R349): (1) NOV EN VIR
  `measurements/teren-vnosi.ts` (132 vrstic; vzorec FAZA 5 + kalkulator
  FAZA 5–7) — `pruneMeritveTerenVrstice` (fail-verbose DTO pruning, ENA
  kopija prej 3 stale telesa; R284 ≡ R285 bajtno identični, razen
  komentarjev) + `fetchMeritveTerenVnosi` (FRESH fetch + res.ok + ne-polje
  guard); dialektno stikalo `zKotom` nosi OBA bajtna kontrakta EKSPLICITNO:
  R269 false (DTO brez kotStopinje ključa + brez kot validacije) ALI
  R284/R285 true (kotStopinje + legacy arMetadata.kot fallback R283);
  `measurements-tab` 6.652 → 6.448 (−204; LEKCIJA R347 2 potrjena: stale
  kopije dihajo v function telesih ×3); (2) **val 32** — a11y parity
  AKCIJSKIH gumbov, kjer vidno besedilo NE razlaga akcije: predloga
  meritev apply + hitro dodajanje ×2 + glavna enota + stopnična predloga
  dobi aria-label + title (parity val 29/R203/R186) + izrecen ring
  navy/40 V ISTEM commitu (LEKCIJA R346); 0 novih hex; (3) vitest r349
  ×26 (2 NOVI datoteki: r349-meritve-faza6 ×18 [oba dialekta + legacy
  fallback + fail-verbose VERBATIM ×5 + toleranca + determinizem + fetch
  wrapper ×3 + EN VIR dokaz + 0-hex] + r349-stil-val32 ×8 [4 parity
  skupine z okni + 0-hex + obrnjena regresija val 31/30]) + 3 stale
  testa iskreno preusmerjena na novo resnico (r269 okno handler → modul
  + žičenje; r277 DTO trditve → modul; r172 prst 6475 → 6271) — 4992/4992
  (304); (4) verifikacija: tsc 0 · eslint 0 (FULL) · build svež EXIT=0 ·
  needles r349 VSE OK (veriga + union registri r340–r349) · smoke EXIT=0 ·
  e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA].
- **Meritve FAZA 7 + val 33** (R350): (1) FAZA 7 ostanki starejše izvozne
  družine EN VIR — izvoz-csv.ts razširitev (94 → 158): STEBRI_CSV_HEADER +
  zgradiStebriVrstice (8-stolpčni R156 per-segment) + ZGODOVINA_CSV_HEADER +
  zgradiZgodovinaVrstice (6-stolpčni lokalni zgodovina kontrakt; NI kolizija
  s sistemskim lib/audit-csv.ts R162 — druga družina) — VERBATIM iz taba;
  + NOV measurements/pdf-seznam.ts (196; vzorec FAZA 2/R325 pdf-exports +
  r269 build/generate razcep): buildSeznamPdfDoc (čist gradnik — 85-vrstični
  inline jsPDF blok izluščen IZ taba, zadnji veliki inline izvozni gradnik)
  + exportSeznamPdf (tanki wrapper; guard + toasti ostanejo v klicatelju);
  ENA eksplicitna odstopka od VERBATIM (kanon r269/R121 determinizem):
  setCreationDate(izvozenoOb) + setFileId(FNV-1a NOVI soli 0xd9–0xdc —
  register: do sedaj 0xd8); glifna resnica helvetica ostane obstoječa (izven
  FAZA kontrakta; kandidat za naslednjo rundu prek registerSloPdfFonts);
  `measurements-tab` 6.448 → 6.386; (2) **val 33** — a11y parity skupinske
  akcije / izbira: bulk orodna vrstica 4 brata (Izberi vse / Počisti /
  Kopiraj / Izbriši izbrane) dobi aria-label + title + izrecen ring navy/40
  V ISTEM commitu (LEKCIJA R346 kanon; parity val 31 brata Izvozi izbrane
  CSV); 0 novih hex; (3) vitest r350 ×29 (2 NOVI datoteki:
  r350-meritve-faza7 ×21 [stebri/zgodovina gradniki realni labeli +
  fallbacki + determinizem + buildSeznamPdfDoc bajtni determinizem +
  %PDF- magija + VERBATIM dokaz + EN VIR stale-izginili + žičenje +
  FAZA 5/6 regresija + 0-hex] + r350-stil-val33 ×8 [4 parity skupine z
  okni + LEKCIJA R346 strukturni dokaz + 0-hex + obrnjena regresija
  val 31/32]) + 1 stale test iskreno posodobljen (r348 žičenje csvEsc
  5 → 0 v tabu z zgodovino — 15. premik prsta) — 5021/5021 (306); (4)
  verifikacija: tsc 0 · eslint 0 (FULL) · build svež EXIT=0 · needles
  r350 VSE OK (veriga + union registri r340–r350) · smoke EXIT=0 · e2e
  EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA].
- **Kalkulator FAZA 6 + val 29** (R346): (1) NOV `calculator/inputs.ts` —
  zbiranje/nalaganje vhodov izluščeno VERBATIM iz taba (args objekti —
  vzorec R325/R345): `collectCurrentInputs(mode, vhodnaStanja)` (zapis za
  predloge/zgodovino — String() + JSON.stringify pretvorbe nespremenjene) in
  `applyInputs(targetMode, inputs, nastavljalci)` (nalaganje prek 49
  eksplicitnih nastavljalcev — isti if-guardi, isti parseFloat/isFinite +
  JSON.parse guardi); 4 klicna mesta (saveTemplate + zgodovina collect ×2 +
  loadTemplate/loadFromHistory); `calculator-tab` 4.643 → 4.551 (−92);
  (2) **val 29** — a11y parity nalaganja/shranjevanja predlog: Naloži
  predlogo aria-label (parity z zgodovinskim "Naloži izračun: …"), Izvozi
  CSV aria-label (parity z lastnim title iz val 28), Shrani predlogo
  aria-label + title ×4 načini (a11y družina R291/R293 + parity val 25–28);
  0 novih hex; (3) vitest r346 ×23 (2 NOVI datoteki: r346-calc-faza6 ×15
  [collect ×5 + apply ×6 + žičenje ×4: EN VIR 1 definicija/4 klica + args
  objekta + 0-hex + FAZA 5 regresija] + r346-stil-val29 ×8 [3 parity
  skupine + 0-hex okno + navy/40 ring vstop izvozne družine val 8 STRAŽAR
  + obrnjene regresije val 28/27/26 + R291/R293]) — 4919/4919 (298); (4) verifikacija: tsc 0 · eslint 0 (FULL) · build svež
  EXIT=0 · needles r346 VSE OK (veriga + union registri r340–r346) ·
  smoke EXIT=0 · e2e EXIT=0 (ZERO-MUTACIJA)
- **Kalkulator FAZA 5 + val 28** (R345): (1) NOV `calculator/calculations.ts`
  — dispatch logika 10 načinov izluščena VERBATIM iz taba (args objekti —
  vzorec R325 pdf-exports): ovonični načini (railing/anchoring/wind) vračajo
  `CalcEngineeringResult<T>` nespremenjen, guard načini vračajo `T | null`;
  komponenta samo zapiše rezultat v state (tanke ovojnice); EN VIR veriga
  dispatchev — prej 2× podvojen if/else blok (handleCalculate + auto-calc
  useEffect) → 1 `izvediIzracunZaAktivniNacin()` + 2 klica;
  `calculator-tab` 4.796 → 4.643 (−153); izračunska jedra (run*V1 + lib
  kalkulator funkcije) ostanejo IZVEN taba — jedro NESPREMJENO (hard rule);
  (2) **val 28** — parity zaglavij zgodovine/predlog: Izvozi CSV title,
  Počisti (zgodovina) aria-label + title, Počisti vse (predloge) aria-label
  + title (a11y družina R291/R293 + title parity val 25–27); 0 novih hex;
  (3) vitest r345 ×26 (2 NOVI datoteki: r345-calc-faza5 ×17 [ovonjice +
  guardi + determinizem FULL + žičenje + EN VIR veriga + 0-hex + FAZA 4
  regresija] + r345-stil-val28 ×9 [3 parity pari + 0-hex okna + obrnjene
  regresije val 27/26/25/24]) — 4896/4896 (296); (4) verifikacija: tsc 0 ·
  eslint 0 (FULL) · build svež EXIT=0 · needles r345 VSE OK (celotna veriga
  R227→…→R339 + union registri r340–r345) · smoke EXIT=0 · e2e EXIT=0
  (ODTIS bajtno identičen pre==post — ZERO-MUTACIJA); (5) LEKCIJE: izvoz
  `[m` v orodnem izhodu je pojedla prikaz (`const [mode` → `const ode` —
  lažni alarm korozijske preverbe: `grep -c` + `git diff` so razkrili
  resnico, datoteka NIKOLI bila pokvarjena); pesek-reset je spral prisma
  client + .env + bazo → `prisma generate` + restore .env (konvencija
  .env.example) + `db:deploy` + `seed.cjs` + `create-admin` fixture (vzorec
  R344 incident)
- **Kalkulator FAZA 4 + val 27** (R343 — KOLIZIJA #15: vzporedna lastniška
  R342 [75fd188 — QA-izvedbena runda brez kode] pristala med mojim delom in
  vzel številko; moja runda preimenovana R342→R343 po kanonu KOLIZIJE
  #4/R323/#13/#14; moja delta = čista koda, brez prekrivanja z njihovo):
  (1) NOV `calculator/history.ts` — skladišče zgodovine/predlog EN VIR:
  localStorage ključi (prej 7× podvojeni literali), fail-closed nalagalnik
  (ENA funkcija namesto 2 kopij inicializatorjev; pokvaren JSON = privzeto,
  NIČ metanja), varni zapisovalnik/brisač (ENA namesto 5 kopij plesa),
  zmogljivostni limiti 30/50 EN VIR (prej magic števila ×3 + UI besedilo),
  `zgodovinaCsvVrstice` + `ZGODOVINA_CSV_GLAVE` (čista podatkovna resnica
  65. člena; mehanika toCsv/downloadCsvText ostaja v tabu); (2) STIL
  val 27 — hover parity prihranjenih predlog: load gumb `title`, način
  badge razlagalni `title` (edini nov needle-niz; iskreno BREZ cursor-help
  — badge je znotraj kliknega gumba), izbriši gumb `title` (0 novih hex);
  vitest r343 ×19 + `qa-needles/r343.tsv`
- **QA-izvedbena runda — dolg R340/R341 poravnan + PROD mejnik R339+R340+R341** (R342 —
  KOLIZIJA #15 [LEKCIJA 1 15. potrditev]: vzporedna lastniška R341 [6fd3f6e,
  12:52:00Z] pristala MED mojimi QA teki [smoke/e2e/prod-qa/sweep nad R340
  buildom 4da09b9] — moja runda preimenovana R341→R342 po kanonu KOLIZIJE
  #4/R323/#13/#14; `pull --ff-only`, moja delta BREZ kode [register + dokumentacija]
  → nič re-aplikacije): (1) **QA dolg zaprt** — `qa-round.sh 342 smoke` EXIT=0
  [health/login/CSRF 403 + fail-closed ovojnice ×3 → 400] + `qa-round.sh 342
  e2e` EXIT=0 [delegacija r339-e2e-browser.sh: Z0a→Z0be ŽIVO + sejdi
  raise/RESTORE + **ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA**] +
  POST-commit `prod-qa` EXIT=0 **LIVE veja** [Z2 needleji R276→R339 ŽIVO + Z3
  v99 sync gate ŽIVO; footer R290+…+R339 ŽIVO SKUPAJ]; (2) **NOVA ERA TEHNIKA —
  prod-needle preverba era rund** (dokumentirana v worklogu R342; nadgradnja
  kanona R280/R284): ker je r339-prod-qa.sh zamrznjena pri generaciji R339 (EPOCH
  meja ne loči rund 340+), so lastni needleji era rund preverjeni NEPOSREDNO na
  produkcijskih čankih [žetev URL-jev /tmp/r339-chunkurls.txt iz prod-qa teka →
  curl ×62 čankov → grep -rqF po registrih]: R340 ×4 ('letvev × 80mm = razmik',
  '✓ SKLADNO', '✗ NESKLADNO', 'Z-line') + R341 ×1 (val 26 badge title) VSI ŽIVI
  + TODO-R340/R341/R342 odsotni → **R339+R340+R341 ŽIVO SKUPAJ na produ**
  [prod build 12:52:26.150Z > R341 commit 12:52:00Z — ⏳ Deploy PENDING iz
  R341 worklog ZAPRT]; (3) **disk-resnica verifikacija združenega drevesa**
  6fd3f6e v lastnem klonu [LEKCIJA R338 5 — ne zaupaj commit sporočilu]: tsc 0 ·
  eslint 0 (FULL) · vitest **4851/4851 (292)** · build svež EXIT=0 (rm -rf
  .next, max-old-space 2560) · `qa-round.sh 342 needles` VSE OK [era registri
  r340 ×4 + r341 ×1 + r342 TODO + delegirana veriga r339→…→R227] · sweep
  31/31 err null [26 sidro TRUE + 1 transiento potrjen z 8s čakanjem (vodja
  `koncna-verifikacija-dokaz` — kanon LEKCIJA R337 6: interpretacija po 2.
  teku) + 4 znana R326–R329 veja]; (4) register `qa-needles/r342.tsv` [must_miss
  TODO-R342 — QA runda brez nove kode, iskrena omejitev pokritosti vzorec
  R340/R341] + popravek stale tabele: calculator-tab 4.828 → 4.796 (R341 FAZA 3
  zamudil posodobitev vrstične tabele — disk resnica)
- **Kalkulator FAZA 3 + 65. člen + val 26** (R341 — KOLIZIJA #14: vzporedna
  lastniška R340 pristala med mojim delom; moja runda preimenovana R340→R341
  po kanonu KOLIZIJE #4/R323/#13; delta re-aplicirana na njihovo postavitev
  [modeLabelMap ×6, new Blob, brez val 26 — vsi dokazano edinstveni]):
  (1) EN VIR `modeLabels` v `calculator/shared.ts` — prej 3× podvojen inline
  `Record<CalcMode, string>` (getCurrentKeyResult / addToHistory /
  Save-Calculation onClick; vsi trije bloki bajtno identični — čist premik
  VERBATIM, vzorec R339 `auditActionTitles`; dogovor z modeTabs oznakami
  testiran); (2) 65. člen issue #1 (IZVOZI družina): zgodovina izračunov CSV
  → kanon EN VIR `toCsv` (R136: BOM + podpičje + CRLF + RFC 4180) +
  `downloadCsvText` (R296) — glave/vrstice/ime/toasti NESPREMENJENI, ročni
  blob/anchor ples odstranjen (iskren presledek: `\n` → CRLF); (3) STIL
  val 26 — hover parity zgodovine: prstni odtis badge `title` +
  `cursor-help` (vzorec R339/R280) + vnosni gumb `title` (0 novih hex);
  vitest r341 ×27 (faza3 EN VIR izčerpnost + zgodovina-csv kanon + val 26
  obrnjene regresije val 24/25) + `qa-needles/r341.tsv` (NOVI registrski
  kanon qa-round.sh — needleji kot PODATEK)
- **Dekompozicija FAZA 4 + VALIDATE residual + QA konsolidacija runner** (R340 —
  KOLIZIJA #14: vzporedna lastniška R339 [STIL val 25] pristala med delom —
  delta prenesena na R340 po kanonu KOLIZIJE #4/R323/#13):
  `measurements-tab` 6.817 → 6.702 (−115) — `normalizeMeasurements` +
  `getQuickSpacing` → `measurements/normalize.ts` in `renderRailingDiagram` →
  `measurements/railing-diagram.tsx` (ČIST PREMIK VERBATIM; osiroteli uvoz
  parseArMetadata odstranjen); `calculator-tab` 4.846 → 4.828 (−18) —
  `getCutList`/`getPostPositions` → `calculator/cut-list.ts` (R325 vzorec:
  telesa VERBATIM, closure → eksplicitni args) + `profileLabels` →
  `calculator/shared.ts`; **VALIDATE CONSTRAINT `equipment_status_allowed`**
  (R145 NOT VALID izpust, najdba analize — migracija
  20261001200000_r340_validate_equipment + stražar ×3: convalidated=TRUE +
  CHECK nabor ≡ aplikacijski EQUIPMENT_STATUSES); **qa-round.sh** —
  parameteriziran QA runner z needle REGISTROM (`qa-needles/rNNN.tsv`) —
  prihodnje runde NE generirajo več 11 skriptov (needleji = podatek);
  UNION harvest + delegacija na r339→…→R227 verigo; r172 pin 6640→6525;
  vitest r340-validate-equipment ×3 (4824 skupaj)
- **STIL val 25 — hover parity revizijske sledi** (R339 — KOLIZIJA #13:
  vzporedna lastniška seja je oddala identično FAZA 3 dekompozicijo kot
  R338; moja izvedba SUPERSEDIRANA po kanonu KOLIZIJE #4/R323 — ohranjena
  SAMO val 25 plast): NOVI EN VIR `auditActionTitles` v
  `measurements/labels.ts` (ADD/EDIT/DELETE/STATUS — vsak naslov z
  utemeljitvijo) + revizijski badge dobi `title` EN VIR + `cursor-help`
  (vzorec R280 tip badge + R281 sync žig; 0 novih hex); vitest r339 ×24
  (r339-measurements-faza3 +16 — izčerpnost ključev/determinizem/fail-closed
  adaptirana na R338 postavitev + r339-stil-val25 +8 — EN VIR + obrnjene
  regresije val 24/23 + register sodelovanje); r172 pin 6632→6640 (+7
  vrstic badge bloka)
- **Dekompozicija measurements-tab — FAZA 3** (R338 — nadaljevanje odobrene
  Roadmap "razbitje monsterskih komponent", vzorec R319/R322/R325):
  7.153 → 6.809 vrstic (−344); NOVA mapa `measurements/` ×2 — `labels.ts`
  (202 vrstic: GroundType + AuditEntry tipa + 17 Record zbirk
  oznak/barv/ikon — tipMeritve/syncStanje/groundType/segmentType/status/
  audit/enota) + `format.ts` (217 vrstic: ArMetadata tip + 13 čistih
  parse/format funkcij — parseArMetadata, parseGPS, formatDimension,
  calculateStairDimensions, loadAudit, loadPrimaryUnit …) — ČIST PREMIK
  bajtno identično (verify_r338.py NULPREMIK dokaz: bloki bajtno identični,
  glava/rep enaki, 33 identifikatorjev točno 1×); osiroteli ikonski uvozi
  odstranjeni (Gauge/Triangle/Mountain/RefreshCw/CornerDownRight →
  measurements/labels); PIN SHIFT ×6 (r172 6976→6632, r316-stil-val7
  register [2 amber vrstici → labels.ts/format.ts — skupno 30 ostaja],
  r311-ai-raba IZJEME [isti premik — skupno 6 ostaja], r231/r234/r235 pini
  na labels.ts); vsebina ŽIVA v čankih — r338-build-needles (8 premik
  needlejev + must_miss); regression-only runda (NOV Z-blok NI dodan —
  vzorec R322: premik nima nove žive interakcije; polne E2E regresije
  Z0aa–Z0ba ŽIVE po premiku + ODTIS ZERO-MUTACIJA)
- **Stil val 7 — ZAKLJUČNI** (R316): fence-3d-viewer ×2 (ikoni) +
  notification-center ×1 (ikona, dark-par odpade) + signature-quote ×1 (hint
  ink) + photo-measure ×1 (hint ink) = 5 dotikov — surove amber → roksal
  žetoni (0 novih hex); **GLOBALNI zaklenjeni register** (r316-stil-val7
  STRAŽAR): vsaka preostala surova amber vrstica v src/components/roksal +
  src/app (natanko 30) je IZRECNO v registru z razlogom (semantične
  lestvice/kategorije/palete — R308 lekcija); vsaka nova surova vrstica = fail
- Skener determinizma: 0 nedokumentiranih odstopanj nad src/lib IN src/components (komponentni sloj R295 — locale* v ARTIFACT domeni NIČ, izjeme izrecne z razlogom)
- **API I/O meja («stena ura»)** (R308+R309+R310, issue #1 — failure cases + malformed-input) — determinističen
  skener VSEH 81 route-handlerjev (`src/lib/api-meja-audit.ts`, EN VIR lexer avtomatizacija-audit):
  vsak `json()` klic varovan (.catch/try), NIČ praznih catch blokov (iskrena resnica je IZRAZ v kodi,
  ne komentar — 2 realna primera refactorirana), NIČ `as any`, 4xx/5xx nosi `{ error }` ovojnico;
  pokvarjen JSON → **400** na VSEH mutirajočih rutah (EN VIR guard `src/lib/api-telo.ts` —
  49 klicnih mest: R309 26 handlerjev z throw-style parse + R310 22 handlerjev s surovim
  `.catch(() => null)` — tiha degradacija v null je izkoreninjena — vsi na izrecen fail-closed
  400 guard; izjeme z izrecnim razlogom: `/api/sync` kontrakt NIČ, `auth/logout` toleranca,
  `vision/scene` + `measurement/detect` + `public/measure` bespoke 413 size-guardi; wire-level
  dokaz v E2E: Z0ah 26/26 + Z0ai 10/10 → 400 z ISTO ovojnico, NIČ 500 — napaka odjemalca ni
  napaka strežnika); strazar test pregleda realno drevo GLOBALNO (vsak telo-bralnik je ALI
  migriran ALI na izrecnem izjemnem seznamu z razlogom — 0 kršitev, fail-closed pri novi kršitvi)
- Pregled: [docs/automacija-audit.md](docs/automacija-audit.md) (EN VIR pripet na lib + strazar testi) · kartica «Avtomatizacija — razred funkcij» v vodjinem pregledu

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
| **Testiranje** | [Vitest 4](https://vitest.dev/) (5021 testov + globalSetup embedded PG) |
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
| `bun run test` | Vsi testi (vitest, 5021, embedded PG prek globalSetup) |
| `bun run check` | tsc --noEmit + vitest run (en ukaz za vse) |
| `bunx tsc --noEmit` | Tipska kontrola celotnega projekta (trenutno 0 napak) |
| `bun run lint` | ESLint preverjanje |
| `bun run smoke` | Varnostni smoke na zagnanem strežniku (143 preverjanj) |
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
| `demo@roksal.si` | MONTER | — **nobeno geslo ne obstaja** (prijava prek forme ni mogoča; R127) |

### Demo dostop ("vstop brez prijave") — R127, issue #5 §1

Demo račun je **varnostno nevtralen**: vloga MONTER (vidi samo svoje projekte,
brez cen/računov/zalog/naročil), geslo ne obstaja (`passwordHash = NULL`), edini
vhod je gumb **"Vstop brez prijave"** na `/login`. Politika okolja:

| `DEMO_ACCESS` | Razvoj | Produkcija (Vercel) |
|---------------|--------|---------------------|
| ne nastavljeno | ✅ vklopljen | ❌ **privzeto IZKLOPLJEN** (fail-closed) |
| `on` | ✅ | ✅ (namerna odločitev lastnika; še vedno MONTER) |
| `off` | ❌ | ❌ |

Na produkciji demo torej privzeto **ne dela** — to je zahtevano varnostno
stanje (javna ruta nikoli ne izda privilegirane seje). Za javno demonstracijo
lastnik nastavi `DEMO_ACCESS=on` v Vercel env var. CI vsebuje secret scan
(demo geslo ne sme obstajati v repozitoriju) in dimni test, ki dokazuje, da
demo seja ni ADMIN in da prijava prek forme za demo račun ne uspe.

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
| `Equipment` / `EquipmentAssignment` / `EquipmentEvent` | Oprema: življenjski cikl (statusne tranzicije, kalibracija merske opreme, pregledi) in dodelitve terminom (R145, §31) |
| `QualityControl` | Preverba kakovosti: verzirana deterministična predloga (qc-v1), vrata na zaključitvi + reviziran override (R146, §27) |
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
| `/api/measurements` | GET, POST | Klasične meritve z AR metapodatki; GET `?status=` strežniški filter (R154, indeks projectId+status) |
| `/api/measurements/[id]` | PATCH | Perzistenten status meritve z revizijo (R153); ponovno odprtje arhiva = obvezna opomba |
| `/api/slopes` | GET, POST | Nagibi (libela) z dostopom na ravni vira (R154 — read/update, fail-closed) |
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
| `/api/crm` | GET, PATCH | CRM (LTV, opomniki) — PATCH: customers.write vrata + stroga validacija + revizija (R156) |
| `/api/punch` | GET, POST, PATCH, DELETE | Prejemni zapisnik |
| `/api/deal-lock` | GET, POST | Zaklep dogovora (audit v transakciji) |
| `/api/portal` | GET, POST | Portal stranke (clientToken) |
| `/api/audit` | GET | Revizijska sled (vodja/monter-lastni) |
| `/api/calculator` · `/api/weather` | POST · GET | Izračuni · vetrni podatki |
| `/api/auth` (+`demo`, `logout`, `password`, `register`) | GET/POST | Prijava/seja (scrypt + HMAC žeton) |
| `/api/profili` · `/api/search` · `/api/surveys` · `/api/viz/*` | CRUD | Katalog, iskanje, terenski pregled, vizualizacija (vse z vrati na ravni projekta — R155) |
| `/api/route.ts` | GET | Health check |

---

## 🧩 Komponente

41 glavnih modulov v `src/components/roksal/` (~44.000 vrstic) + 60+ shadcn/ui
primitivov. Največji:

| Komponenta | Vrstice | Funkcija |
|-----------|---------|----------|
| `measurements-tab.tsx` | 6.386 | Meritve (9 tipov, stopniščni čarovnik, WPC, štebricki; dekompozicija faza 1+2+3+4+5+6+7 R319/R325/R338/R340/R348/R349/R350) |
| `calculator-tab.tsx` | 4.489 | Kalkulator (7 načinov + 6 izpolnitev; dekompozicija faza 1+2+3+4+5+6+7 R322/R325/R340/R341/R345/R346/R347) |
| `ar-scanner.tsx` | 2.789 | AR kamera z vizualizacijo ograje + AI sugestija |
| `webxr-scanner.tsx` | 2.377 | WebXR poskus (kjer podprt) |
| `photo-tab.tsx` | 2.570 | Slike z annotation editor, batch, pred/po |
| `dashboard-tab.tsx` | 2.101 | Domov s projekti, iskalnikom, filtri |
| `measurement-studio.tsx` | 1.630 | **Merilni studio** (deterministični CV + ročni način) |
| … | | skice, zaloga, dokumenti, PDF, CRM, logistika, tloris, galerija … |

> Opomba (R120/Problem 9 → R319/R322/R325/R338/R340): `measurements-tab` (9.086 →
> 7.604 → 7.153 → 6.809 → 6.702) in `calculator-tab` (6.074 → 5.372 → 4.846 → 4.828 → 4.796) sta bila razbita
> po fazah — faza 1 ČISTIH PREMIKOV (kanon: bajtno identični bloki, brez
> spremembe obnašanja; vsebina ŽIVA v čankih — r319/r322-build-needles) +
> FAZA 2 REFAKTORJA internih sestavljenih struktur (R325: laserski BT hook z
> onMeasurement povratnim klicem + PDF izvozi z args objekti — vsebina ŽIVA v
  čankih — r325-build-needles) + FAZA 3 ČISTIH PREMIKOV podatkovnih blokov
  (R338: labels.ts + format.ts — NULPREMIK verify_r338.py; vsebina ŽIVA v
  čankih — r338-build-needles).

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
- **CSRF / Origin preverba** (R130, issue #5 §6): vsaka `/api/*` mutacija (tudi prijava/demo)
  mora dokazati izvor — glava `Origin` (ali `Referer` rezerva) se preveri proti gostitelju;
  manjkata → 403 fail-closed; Bearer/API-key klienti so izjema (ni ambientnega piškotka);
  razširljivo z `CSRF_ALLOWED_ORIGINS` — `src/lib/csrf.ts`, prva vrsta v proxy
- **CSRF dvojni žeton** (R194, issue #5 §6): poleg preverbe izvora še double-submit cookie —
  prijava/bootstrap izda `roksal_csrf` (berljiv iz JS), isti-izvorne mutacije samodejno nosijo
  glavo `x-csrf-token` (fetch ovoj, 43+ točk brez spremembe kode), `csrfGuard` zahteva
  ujemanje za seje z žetonom (fail-closed 403); Bearer izjema in grace za stare seje
  dokumentirana — `src/lib/csrf-core.ts` + `src/lib/csrf-client.ts`
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
