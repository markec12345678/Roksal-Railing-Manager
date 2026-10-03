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
  namesto vloge: enoten katalog 29 pravic (`src/lib/permissions.ts`; PIN SHIFT R392:
  28→29 — +engineering.manage za issue #13 §15), vloga →
  pravice (ADMIN 29, VODJA 28, MONTER terenskih 11, SKLADISCE skladiščnih 7,
  API ključ izključno iz scope-ov), sporočila 403 imenujejo manjkajočo pravico,
  odjemalec dobi svoje pravice prek `GET /api/auth` — UI skriva akcije brez
  pravic in pošteno pokaže stanje "Ureja pisarna" (portal/ekipa)
- 🗄️ **PostgreSQL** — verzionirane migracije (`migrate deploy`), produkcija Neon

### Statistika projekta (usklajeno z HEAD, R135)

| Metrika | Vrednost |
|---------|----------|
| Vrstic kode (src) | ~91.400 |
| React komponent | 41 roksal modulov + 60+ UI primitivov |
| API končne točke | 180 route handlerjev v 102 skupinah |
| Prisma modelov | 62 (PostgreSQL) |
| Prisma migracij | verzionirane (`migrate deploy`) |
| Testi (vitest) | **5845** (388 datotek, vključno z globalSetup embedded PG) | (R395 (KOLIZIJA #27 preimenovanje R394→R395; njihova QA runda R394 [cf71787 — Super Z, STIL val 70 FORCED-COLORS FOKUS PARITETA 105 × REPL ×24 render datotek + NJIOV r394.tsv + r394-window-scan.py + r394-stil-val70 + r394-outline-disciplina + PIN SHIFT 20 zgodovinskih registrov] je pristala MED mojim delom [fetch ob pushu: 0634c2b..cf71787] → kanon KOLIZIJE #4/R323/#13–#26: njihova runda = pristala resnica, MOJA preimenovana; vsi moji artefakti preimenovani R394→R395 [migraciji, test, register r395.tsv, window-scan r395, žigi v 15 datotekah]; NJIHOVI r394-* artefakti BAJTNATO ohranjeni; _prisma_migrations preimenovana V OBEH lokalnih bazah (novi checksumi — migrate status čist); rebase na zlivenem drevesu) — SIGNATURE + DOCUMENT CHAIN (issue #13, korak R172 iz §16): NEPREKINJENA veriga QuoteVersion → DocumentVersion → DEJANSKI PDF bajti → SHA-256 → SignatureAudit → DealLock — 4 dozdajšnje LUKNJE zaprte: (1) deal-lock pdfHash je bil KLIENTOV ali sintetičen hash pogodbenih podatkov (NI hash dejanskih bajtov); (2) SignatureAudit ni referenciral EXACT verzije dokumenta; (3) /api/signature-audit je vračal ipAddress/userAgent/deviceFingerprint/geoLatitude/geoLongitude (§16 "signature audit DTO ne sme vračati nepotrebnih občutljivih polj" — deal-lock GET allowlist R374 §17 JE bil kanon) + IDOR vrata (prej SAMO prijava!) + POST detajl surova ...audit vrstica; (4) DocumentVersion immutabilnost je bila SAMO konvencija + QuoteVersion vsebina po podpisu mutabilna na DB ravni (r374 TAMPIRANA test je UPDATE delal). REŠITEV — vsaka zagotovitev NA VEČ LINIJAH (store/plast + BAZA, kanon erv_uradno_zahteva_pregled R393): [A] PONUDBA PDF kot STREŽNIŠKI artefakt: nova ruta POST+GET /api/quotes/[id]/pdf [quote-pdf.ts — determinističen renderer kanon R294/R121: setCreationDate ← datum izdaje, setFileId ← sha256 identitete, enak vhod = bajtno enak PDF; vrata: DRAFT → 409 (§3), REJECTED/SUPERSEDED → 409, verifyQuoteVersionIntegrity PRED izdajo, documents.generate + 'read' dostop; Document tip PONUDBA = ZABOJNIK ene verzije (partial UNIQUE Document_ponudba_quote_key); DocumentVersion.quoteVersionId = KANONIČNA veriga; regeneracija = NOVA verzija v2/v3 (append-only); R122 kompenzacija; document-chain.ts = EN VIR (ponudbaKontekst + preveriVerzijoDokumenta — 6 vrata: obstoj/vezava na TISO verzijo/projekt/tip PONUDBA/bajti FIZIČNO v storage/RE-HASH bajtov == zabeležen sha256)]; [B] deal-lock §16 veriga: telo LAHKO prinese documentVersionId [EXACT preverba — prečna verzija → 409, ponaredek v storage → 409 "PDF bajti se ne ujemajo s SHA-256 verzije dokumenta", projekt OSTANE nezaklenjen] ALI strežnik SAM izda PONUDBA PDF [bajti PRE transakcije; Document+DocumentVersion ATOMSKO znotraj zaklepne tx PRED SignatureAudit zapisom — baza trigger zahteva obstoj verzije]; klientov pdfHash DEPRECIERAN [samo preverba ujemanja → 409 ob razliki — odkrito, ne tiho]; SignatureAudit ×2 z documentVersionId + pdfHash = DV.sha256 = SHA-256 DEJANSKIH bajtov [RE-HASH ob zaklepu — getObject → sha256Of]; DEAL_LOCKED revizija + documentVersionId/Number; kompenzacija ×3 vrste artefaktov; POST odgovor + documentVersion {id, versionNumber, sizeBytes}; GET signatures + documentVersionId; [C] 3 BAZA triggerji (migraciji 20261011080000_r395_document_chain_enum + 20261011080100_r395_document_chain — LOČENI transakciji: PostgreSQL "unsafe use of new value" zavrne uporabo SVEŽE enum vrednosti PONUDBA v partial UNIQUE WHERE v isti transakciji — vrednost mora biti commit-ana): (1) document_version_no_update [VSAKA UPDATE DocumentVersion vrstice ZAVRNJENA — immutable artefakt, prej samo konvencija]; (2) quote_version_signed_immutable [PODPISANA (APPROVED) verzija: 10 vsebinskih polj IS DISTINCT FROM + statusni izhod ZAMRZNJENA — "quoteVersion cannot silently change after signing" na DB ravni; DRAFT/ISSUED ostajata mutabilni — r374 TAMPIRANA test (UPDATE nad ISSUED) ostaja veljavna]; (3) signature_audit_document_chain [INSERT/UPDATE z documentVersionId: verzija MORA obstajati IN pdfHash == njen sha256 — pokvarjena vrstica NE pristane, tudi mimo store-plasti]; [D] signature-audit DTO §16: GET [allowlist — ipAddress/userAgent/deviceFingerprint/geoLatitude/geoLongitude ODSTRANJENI; + veriga quoteVersionId/bomVersionId/documentVersionId; + IDOR FIX: assertProjectAccess 'read' — prej je preverjala SAMO prijavo (vsak avtenticiran uporabnik je bral podpisno sled TUJEGA projekta; isti kanon kot deal-lock GET R374); AccessDeniedError catch] + POST detajl [eksplicitni allowlist DTO namesto ...audit surove vrstice]; v bazi polja OSTANEJO (revizijska sled NI izbrisana — dostop = DBA/audit plast); [E] UI: post-signature-panel.tsx [mrtve veje ip/GPS/fingerprint odstranjene iz PDF izvoza + UI; prikazana §16 veriga (Verzija ponudbe/PDF verzija dokumenta)] + types.ts SignatureAuditEntry usklajen [r353 font-counti NEODVISNI — setFont klici zunaj if-blokov, test zelen]. 17 testov v r395-document-chain.test.ts [PDF vrata ×6: 401/403 detail/DRAFT 409/201 + sha256 == hash dejanskih bajtov (getObject → sha256Of — §16 jedro)/regeneracija v2 isti zabojnik + GET seznam/tampirana verzija 409; zaklep veriga ×5: samodejna izdaja + veriga drži (SA ×2 documentVersionId + pdfHash + bajti)/EXACT documentVersionId brez nove izdaje/tampered bajti 409 + projekt nezaklenjen/prečna verzija 409/klientov pdfHash 409; baza triggerji ×3: documentVersion.update rejects + vrstica ostane/APPROVED vsebina+status rejects (po uspešnem zaklepu)/SA create z napačnim pdfHash rejects + števec nespremenjen; DTO ×3: minimalni DTO (7 negativnih assertionov) + veriga vidna/IDOR tujec 403/deal-lock GET signatures documentVersionId]; r374/r376 čistki +PDF artefakti (0 sirot — deleteObject pred brisanjem vrstic); PIN SHIFT ×2: r308-api-meja [111→112 + quotes/[id]/pdf eksplicitno] + r191-val2 [68/85→69/86 handlerjev + 77→78 zapisOmejitev; GET samo-bralni brez vrata — kanon engineering-rules/[id]]; register scripts/qa-needles/r395.tsv [3 need_static ŽIVO + TODO-R395 must_miss; era ≥192 = 189 + mojih 3 — NJIHOVA 48. preverba ≥189 = 188 + njihov val 70 ×1] + r395-window-scan.py [17. generacija — naslednik NJIHOVEGA r394-window-scan.py, REG_DO 395]; README [statistika 180 handlerjev/102 skupin + 5845/388 testov (njihova 5828/387 baza + mojih 17/1 — rebase po KOLIZIJI #27) + R395 bullet]. VERIFIKACIJA (po rebase+rename na zlivenem drevesu): tsc 0 · eslint 0 (FULL) · vitest 5845/5845 (388 datotek) prek 3 foreground shardov · build svež rm -rf .next EXIT=0 · qa-round.sh 395 needles EXIT=0 [BASH_ENV cd-shim kanon R376/R393; r340–r395 VSI FAIL=0 + 3 R395 needleji ŽIVO + TODO-R395 čisto + veriga r339→…→R227 OK] · smoke EXIT=0 [standalone :3100: health/db ok + login 200 + PWA 307 + CSRF 403 + ovojnice 400] · r395-window-scan EXIT=0 · leak-check 0 [ghp_/vcp_ ×0 v diffu]. Naslednji korak #13: R173 (§17 DEAL-LOCK GET — utrjen R374; spec prebrati) ali §18 OBJECT STORAGE PRIVATE BY DEFAULT. ⏰ roksal-fallback-db POTEČE 2026-10-25 — obvestiti lastnika (86. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA po zaključku seje.)
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
- **pdf-seznam glifni popravek + val 34** (R351): (1) **helvetica →
  registerSloPdfFonts** (r269 vzorec — Roboto subset latin-ext, 23 KB na
  varianto): standard WinAnsi NI nosil č/š/ž ('Dolžina' → pokvarjeno); 4 ×
  setFont Roboto (glava bold/normal + povzetek bold/normal, autoTable
  podeduje) — ENA vsebinska sprememba izvoza iskreno dokumentirana
  (izvoženi PDF se spremeni, determinizem čist: /FontFile2 vgrajeni TrueType
  = glifni dokaz, helvetica standard-14 ga nima); (2) **val 34** — a11y
  parity filter čipi družine: status čipi ×4 [Vse/Osnutek/Potrjena/
  Arhivirana] dobi aria-pressed [toggle stanje — bralnik zaslona pove
  stanje] + aria-label `Filtriraj po statusu: ${label} (${count})` + title
  + izrecen ring navy/40 V ISTEM commitu; Foto mere pill dobi aria-pressed
  + NOV aria-label + ring (LEKCIJA R346 kanon); 0 novih hex; (3) vitest
  r351 ×18 (2 NOVI datoteki: r351-pdf-font ×10 [vir dokaz ×4 + determinizem
  čist z Roboto + FontFile2 glifni dokaz + VERBATIM literali + FNV soli
  regresija + družinska konsistenznost r269] + r351-stil-val34 ×8 [4 parity
  skupine + ring struktura + 0-hex + obrnjena regresija val 31/33]) —
  5039/5039 (308); (4) verifikacija: tsc 0 · eslint 0 (FULL) · build svež
  EXIT=0 · needles r351 VSE OK (veriga + union registri r340–r351) · smoke
  EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA].
- **Kalkulator pdf-exports glifni popravek + val 35** (R352): (1)
  **helvetica → registerSloPdfFonts** (r269/R351 vzorec): standard WinAnsi
  NI nosil č/š/ž ('Širina palice', 'Število letvev', 'Širina reza' →
  pokvarjeno); 29 × setFont Roboto (15 bold + 14 normal) prek 5 gradnikov
  [predloga vrtanja / materialni list / razrezni list CNC / vetrno poročilo /
  steklena balustrada] + 5 × registerSloPdfFonts (po new jsPDF, pred prvo
  setFont) — ENA vsebinska sprememba izvoza iskreno dokumentirana (izvoženi
  PDF-i se spremenijo: vgrajeni fonti + pravilni šumniki; vsebina/izračuni
  NESPREMENJENI — kalkulator jedro NIČ; časovni žigi = obstoječa klicateljeva
  resnica); /FontFile2 bajtni dokaz glifne zmogljivosti; (2) **val 35** —
  a11y parity dialog "Shrani" bratov: logistika razpored/ekipa/oprema +
  materialna inteligenca dobavitelj dobi aria-label (akcija + cilj) + title
  + izrecen ring navy/40 V ISTEM commitu (ekipa + dobavitelj NOV ring,
  razpored + oprema že od val 30/32); 0 novih hex; (3) vitest r352 ×18
  (2 NOVI datoteki: r352-kalkulator-font ×10 [vir dokaz ×5 + pozicije per
  gradnik + 0-helvetica counting 15/14 + FontFile2 glifni dokaz na ujetih
  dokumentih prek podrazred-mocka jsPDF 4.x (save = instančna own property
  — LEKCIJA) + getFontList Roboto + VERBATIM regresija + družinska
  konsistenznost 3 potrošniki] + r352-stil-val35 ×8 [4 parity bratje +
  ring struktura + 0-hex + obrnjena regresija val 33/34]) — 5057/5057
  (310); (4) verifikacija: tsc 0 · eslint 0 (FULL) · build svež EXIT=0 ·
  needles r352 VSE OK (veriga + union registri r340–r352) · smoke EXIT=0 ·
  e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA].
- **Komponentni PDF glifni popravek + val 36** (R353): (1) **helvetica →
  registerSloPdfFonts** za ZADNJE 4 potrošnike (fetch-first sken celotnega
  repa: post-signature-panel 11 × setFont, floor-plan-tab 8,
  reference-gallery 6, signature-quote 16 — skupaj 41 setFont mest × Roboto;
  r269/R351/R352 kanon: register po new jsPDF, pred prvo setFont) — ENA
  vsebinska sprememba izvoza na potrošnika iskreno dokumentirana (izvoženi
  PDF-i se SPROTI spremenijo: vgrajeni fonti + pravilni č/š/ž; vsebina
  NESPREMENJENA); posebnost reference-gallery: italic NI registriran →
  placeholder 'Brez slike' izgubi naklon, dobi pravilne glife (fail-closed:
  brez tihega fallbacka, dokumentirano v viru); (2) **val 36** — a11y parity
  Shrani/Dodaj/Uvozi dialog bratov: reference-gallery Dodaj realizacijo +
  sketch-canvas Shrani skico + CRM Shrani spremembe stranke + meritve AR
  uvoz — aria-label (akcija + cilj) + title + izrecen ring navy/40 V ISTEM
  commitu (3 brata NOV ring, CRM ga je že nosil); 0 novih hex; (3) vitest
  r353 ×18 (2 NOVI datoteki: r353-pdf-font ×10 [vir pozicije ×4 + counting
  41 + ŽIV dokaz modula FontFile2 + idempotentnost + fs hoja 0 × helvetica
  + družinska konsistenznost 7 potrošnikov] + r353-stil-val36 ×8 [4 parity
  bratje + 0-hex + obrnjena regresija val 35/34]) — 5075/5075 (312); (4)
  verifikacija: tsc 0 · eslint 0 (FULL) · build svež EXIT=0 · needles r353
  VSE OK (veriga + union registri r340–r353) · smoke EXIT=0 · e2e EXIT=0
  [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA].
- **Measurements FAZA 8 + val 37 + era-harvest hash rezolucija** (R354):
  (1) **FAZA 8** — teren izvozi ORKESTRACIJA izluščena VERBATIM v
  `measurements/teren-izvozi.ts` (vzorec FAZA 5–7): guard/fetch/prazno/
  gradnja/napaka kontrolni tok 3 bratov [teren PDF R269 + zapisni list PDF
  R284 + zapisni list CSV R285] → EN `izvediTerenIzvoz(vrsta, kontekst)` z
  DISKRIMINIRANIM rezultatom (manjka-projekt / prazno / uspeh-pdf / uspeh-csv
  / napaka); lib NE pozna toastov (UI resnica v UI — VERBATIM besedila v
  tabu); bajtni kontrakt izvozov NESPREMENJEN; downloadCsvText ostane v
  tabu; (2) **val 37** — a11y parity dialog akcija bratov: reopen 'Odpri z
  razlogom' [ring parity: prej bos amber → navy/40 + offset] + foto viewer
  'Odpri v slikah' [NOV ring] + onboarding 'Naprej/Zaključi' [pogojna
  aria/title, NOV ring]; 0 novih hex; (3) **era-harvest hash rezolucija**
  (LEKCIJA R354, inverz R351): needle MISS ≠ deploy pending — REZOLUCIJA prek
  lokalnega content-hash čanka → prod CDN (200 + niz = era ŽIVO; hash dokaz:
  enako ime = enaka vsebina); fail-closed: brez lokalnega builda → EXIT=2 z
  glasnim dvoumjem; (4) vitest r354 ×18 (r354-teren-faza8 ×10 [mock dokaz
  diskriminiranih rezultatov + zKotom dialekti + fail-verbose VERBATIM +
  determinizem + EN VIR žičenje 3 klicev + 0 stale lib-uvozov] +
  r354-stil-val37 ×8 [3 bratje + 0-hex + obrnjene regresije val 36/35/34])
  + r172 prst 6214→6217 (17. zapis; ŠTEJ VRSTICE IZ DISKA) — 5093/5093 (314);
  (5) verifikacija: tsc 0 · eslint 0 (FULL) · build svež EXIT=0 · needles
  r354 VSE OK (veriga + union registri r340–r354) · smoke EXIT=0 · e2e
  EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA].
- **Katalog zmožnosti CSV + val 38** (R355): (1) **65. člen issue #1
  (IZVOZI družina)** — NOV `avtomatizacija-katalog-csv.ts`: POLNI katalog
  zmožnosti (§11 AutomationProvider — ENA vrstica na zmožnost: id/vrsta/
  območje/opis/modul + RAZREŠEN nadomestek [id + opis] za AI vnose) kot
  deterministični CSV; EN VIR katalog.ts = ISTI vir kot UI kartice,
  ponudniki in docs/automacija-audit.md; fail-closed ×3 (podvojen id / AI
  brez nadomestka / neobstoječ nadomestek → TypeError — pokvaren katalog ne
  more postati lažno poročilo); toCsv kanon (BOM + podpičje + CRLF); brez
  časa/hash (isti HEAD = bajtno identično); sklep = izpeljava iz
  avtomatizacijaPovzetek (iste številke kot kartica); KATALOG pill na vodji
  (bratska simetrija amber/50 z CSV/PDF sosedom); (2) **val 38** — a11y
  izvozne družine: KATALOG pill aria-label (akcija + cilj) + title +
  amber/50 ring (pini amber/50 12→13 + press-scale 18→19 posodobljeni s
  zgodovino); 0 novih hex; (3) vitest r355 ×18 (r355-katalog-csv ×10
  [determinizem + format + pokritost/vrstni red + AI razrešeni nadomestki +
  fail-closed ×3 + sklep EN VIR + filename + žičenje + 0-hex] +
  r355-stil-val38 ×8 [pill struktura + bratska simetrija + pini + toast
  VERBATIM + obrnjene regresije]) — 5111/5111 (316); (4) verifikacija:
  tsc 0 · eslint 0 (FULL) · build svež EXIT=0 · needles r355 VSE OK (veriga
  + union registri r340–r355) · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO
  IDENTIČEN pre==post — ZERO-MUTACIJA].
- **Status-orkestracija val 42 + QA-infra hardening** (R359): (1) **fetch-first
  sken FAZA 12** — PATCH/status klaster potrjen kot 2 mikro brata
  (patchMeasurementStatus + bulk arhiviranje; ISTI endpoint/headers/odgovor
  `{ changed, measurement }` + ista normalize preslikava, a trivialni 1–2
  ključni telesi) → **FAZA 12 NI utemeljena** (LEKCIJA R352: 2 brata mikro;
  vsiljena abstrakcija ne za šalo) — samo sken, meja dokumentirana za
  prihodnji 3. klic; (2) **QA-infra hardening (feature runde)** —
  dokumentiran transient R358+R359 (Z2 harvest curl ×60 brez retry: EN
  padel chunk = lažni MISSi, tek 1 failal v DVEH zaporednih rundah) rešen z
  DVEMA NOVIMA skriptama (zamrznjeni r339 NI mutiran): `scripts/qa-harvest.sh`
  [kanonska utrjena žetev: retry ×3 z determinističnim backoffom 1s/2s +
  parcialna-žeteva guard + fail-closed vhodi; demo 60/60 EXIT=0 + 2 guard
  EXIT=1] + `scripts/r359-prod-qa-retry.sh` [retry ovoj prod-qa faze: do 3
  poskusi, deterministična pavza 5s, EXIT 0 ob prvem zelenem, vsi poskusi
  poročani; demo poskus 1 zelen EXIT=0]; (3) **val 42** — a11y resnica
  status-orkestracije družine (5 gumbov × 1 datoteko, VSE SPREMEMBE DODATNE):
  verzije toggle + Popravi + bulk trigger ring PARITETA (offset-2 dopolnjen —
  precedens val 40/41) + bulk dialog Prekliči NOVI title (nič se ne arhivira)
  + NOV ring + Arhiviraj NOVI aria + NOVI title (idempotentno) + ring-2
  red-500 offset-2 (destruktivni žig ohranjen); 0 novih hex; **OPOMBA za
  lastnika**: bulk trigger title 'Trajno izbriši' je zgodovinska netočnost
  (handler arhivira, dialog je iskren) — pinan kot need_static v register
  r350.tsv, menjava bi prelomila zamrznjeno era-verigo (potreben register-
  retirement kanon); (4) vitest r359 ×8 (r359-stil-val42: 3 ring parity bloki
  + zamrznjeni nizi r350 bajtno + NOVI title/aria bloki + 0-hex + obrnjena
  regresija val 39/40/41 + enolični era-diskriminatorji) — 5173/5173 (323);
  (5) verifikacija: tsc 0 · eslint 0 (FULL) · build svež EXIT=0 · needles
  r359 VSE OK (veriga + union registri r340–r359) · smoke EXIT=0 · e2e
  EXIT=0 [Z0ax→Z0be ŽIVO + ODTIS — ZERO-MUTACIJA] · r359-era-harvest EXIT=0
  ob 1. teku [DVANAJSTIJNA: 12 er ŽIVO — 54 direktno + 2 R353 hash
  rezolucija; R358 val 41 ×3 direktno].
- **Ring pariteta val 45 + e2e-lib dedup 2. val** (R362): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 361` ZELEN ob poskusu
  1 + **PETNAJSTIJNA era preverba** `r362-era-harvest.sh` EXIT=0 ob 1. teku:
  15 registrov r347–r361 (≥65 need_static = 4+5+8+9+3+8+4+3+3+3+3+3+3+3+3),
  63 ŽIVO direktno + 2 R353 prek hash rezolucije (CDN HTTP 200), R361 val 44
  ×3 ŽIVO DIREKTNO → deploy potrjen v celoti, must_miss ×15 čisto, era
  kontrole R340/R341/R343/R345 ŽIV; (2) **agent-browser QA** spot-r167/5+6+7
  — NIČ runtime errorjev (kolektor 0 ×3 seji); iskreni re-probi (iskalnik
  eksakten aria `'Odpri iskalnik (Ctrl+K)'` — 1. tek eval exact-match
  neprecizen; Zaloga h2 `'Zaloga'` ankor iz vira); iskren NAJDI: 3 izvozna
  brata v `quote-followup.tsx` BREZ ring-offset-2 (val 44 je pokril SAMO
  crm-tab.tsx — isti CRM pogled, druga datoteka); (3) **MANDATORY STIL val
  45** — ring PARITETA zaključek quote-followup družine: 6 ×
  `focus-visible:ring-offset-2` (3 press-scale izvozna brata + 3 h-8 akcije
  Pokliči/+3/+7) + 3 NOVI per-item aria-label z nazivProjekta (kanon
  R346/R356; `'Datum spomnika:'` precedent v isti datoteki; title 'Spomnik
  danes' ZAMRZNJEN); stale pin r267:281 shiftan V ISTI rundi (precedens
  R334/R355–R360); 0 novih hex (števec najdišč = 0 — LEKCIJA R360 (4));
  (4) **FEATURE e2e-lib dedup 2. val** — NOV pomočnik `eb_sonda_ring_pariteta`
  (OŽKA ring-paritetna sonda press-scale + status-filter družine; 2.
  ponovitev bloka → kanon ustvarjen PROAKTIVNO, prag LEKCIJE R352 je 3.) s
  PORABO ob 1. uporabi v `r362-qa-spot3.sh` + refactor `r362-qa-spot.sh`
  (zamrznjeni spot skripti NI mutirani; IIFE ovojnica — r231 invariant);
  PRED-deploy baseline iskreno dokumentiran (brezOffset=3 → po deployu
  pričakovano 0). VERIFIKACIJA (na KONČNI viri): tsc 0 · eslint 0 (FULL,
  `npm run lint`) · vitest **5199/5199 (326)** = R361 baza 5194/325 + mojih
  +5 − 0 [tek 1 zeleno] · build svež EXIT=0 [rm -rf .next;
  max-old-space-size 2560] · `qa-round.sh 362 needles` VSE OK [4 need_static
  ŽIVO v lokalnem buildu + TODO-R362 odsoten; veriga R227→…→R339 + union
  registri r340–r362] · `qa-round.sh 362 smoke` EXIT=0 [ISTA EN VIR] ·
  `qa-round.sh 362 e2e` EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post —
  ZERO-MUTACIJA] · leak-check čist [ghp_[A-Za-z0-9]{36} → 0]. NOVO:
  scripts/qa-needles/r362.tsv [4 need_static = className token ×3-viri + 3
  aria statična segmenta ×1, vsi ×0 v HEAD fetch-first; must_miss; python
  write z \t; awk NF=3 čisto] + README disk resnica [števec 5199/326 + R362
  bullet].
- **Ring pariteta val 46 + e2e-lib dedup 3. val** (R363): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 362` ZELEN ob poskusu
  1 + **ŠESTNAJSTIJNA era preverba** `r363-era-harvest.sh` EXIT=0 ob 1. teku:
  16 registrov r347–r362 (≥69 need_static), 67 ŽIVO direktno + 2 R353 prek
  hash rezolucije, **R362 val 45 vsi 4 needleji ŽIVO DIREKTNO** [chunk_036]
  → deploy potrjen v celoti, must_miss ×16 čisto, era kontrole ŽIV; (2)
  **val 45 post-deploy verifikacija** — spot3 re-run: časovni kontrakt
  IZPOLNJEN (pressScaleBrezOffset 3→**0**, izvoznaTrojicaOffset2
  **[true,true,true]**, pressScaleOffset2 6→9; per-item aria DOM false =
  pogojni render pri 0 ponudbah — iskrena praznina, statični needleji ŽIVO);
  (3) **agent-browser QA** spot-r167/8: helper 1. uporaba ZELEN, val 45
  parity stabilna (9/0/7), Zaloge baseline iskreno dokumentiran
  (sondaPressScale 15/15 brez offset PRED deployom; dodajGibanje ne-mountan
  = per-pravica render, kanon r277); kolektor 0 errorjev; (4) **MANDATORY
  STIL val 46 — ring PARITETA inventory-tab družine** (R362 kandidat;
  LEKCIJA R362 (1) aplikirana: vir sken datoteko po datoteki = 23 × navy/40
  [22 brez + 1 že nosi], 0 non-focus): 22 × `focus-visible:ring-offset-2`
  dodan [12 vrstic-rep + 5 template + 4 disabled + 1 active:scale];
  aria/title ZAMRZNJENI (ring-only); **stale pini shiftani V ISTI rundi**:
  r242 L176/177 (eksaktna invSrc pina) + r237:230 (substring pin — offset
  se vstavi MED; proaktiven rg sken po vseh 10 testih, ki berejo
  inventory-tab); 0 novih hex (števec 0); (5) **FEATURE e2e-lib dedup 3.
  val** — NOV pomočnik `eb_pocakaj_csv_pilli` (identičen poll predikat
  'Izvozi CSV (' ×7 v 5 spot skriptah r361/r362 — prag LEKCIJE R352 DOLG
  presežen) s porabo ob 1. uporabi v `r363-qa-spot.sh` V ISTI rundi
  (zamrznjeni NI mutirani). VERIFIKACIJA (na KONČNI viri): tsc 0 · eslint 0
  (FULL) · vitest **5204/5204 (327)** = R362 baza 5199/326 + mojih +5 − 0
  [tek 1 zeleno] · build svež EXIT=0 [rm -rf .next; max-old-space-size
  2560] · `qa-round.sh 363 needles` VSE OK [4 need_static ŽIVO + TODO-R363
  odsoten; veriga + union registri r340–r363] · smoke EXIT=0 · e2e EXIT=0
  [ODTIS IDENTIČEN — ZERO-MUTACIJA] · leak-check čist. NOVO:
  scripts/qa-needles/r363.tsv [4 need_static ×1/×1/×2/×1, vsi ×0 v HEAD
  fetch-first git grep; must_miss; python write z \t; awk NF=3 čisto] +
  README disk resnica [5204/327 + R363 bullet].
- **Ring pariteta val 47 + e2e-lib dedup 4. val** (R364): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 363` ZELEN ob poskusu 1
  + **SEDMNAJSTIJNA era preverba** `r364-era-harvest.sh` EXIT=0 ob 1. teku:
  17 registrov r347–r363 (≥73 need_static = 4+5+8+9+3+8+4+3+3+3+3+3+3+3+3+4
  +4), 71 ŽIVO direktno + 2 R353 prek hash rezolucije (CDN HTTP 200), R363
  val 46 ×4 ŽIVO DIREKTNO → deploy potrjen v celoti, must_miss ×17 čisto,
  era kontrole R340/R341/R343/R345 ŽIV; (2) **val 46 POST-deploy verifikacija
  — časovni kontrakt IZPOLNJEN** (spot-r167/9: izvoziCsv/Pdf/kopiraj
  NarocilnicoOffset2 false→[true×3], sonnaBrezOffset 15→0; dodajGibanje
  Mounted false = per-pravica render — kanon r277; val 45 parity stabilna
  9/0/7; kolektor 0 errorjev ×2 seje); (3) **MANDATORY STIL val 47** — ring
  PARITETA measurements-tab družine (največji preostali gap po val 43–46;
  LEKCIJA R362 (1) aplikirana — vir sken: 47 × navy/40 [18 že nosi + 29
  brez], 0 non-focus): 29 × popravkov [28 × ring-offset-2 dodan [18
  zaprti niz + 5 ring-inset + 5 template `${] + 1 × ring-offset-1→2
  normalizacija (L3125 status cikel chip — val 44 precedens)];
  aria/title ZAMRZNJENI; **r172 prst 6051 POTRJEN IZ DISKA** (ring-only
  in-place = 0 novih vrstic 6232→6232 — LEKCIJA 'ŠTEJ IZ DISKA'); stale
  pini PRED-SCAN: edina 2 exact-quote pina (r242:157 →
  material-intelligence-tab, r268:290 → team-tab) bereta MIMO
  measurements-tab → 0 shiftov; substring pini preživijo; EN okno
  oknoOkoli 600→800 (r348 bulk CSV — LEKCIJA R359 'test okno ≥800 ob
  dolgih className'); 0 novih hex (števec 0); (4) **FEATURE e2e-lib dedup
  4. val** — NOV pomočnik `eb_pocakaj_zalogo` (identičen poll predikat h2
  'Zaloga' ×2 byte-identična + ×1 O-R brat r362-qa-spot2 — kanon
  PROAKTIVNO pri 2. ponovitvi, LEKCIJA R362 (3)) s porabo ob 1. uporabi v
  `r364-qa-spot.sh` V ISTI rundi (zamrznjeni NI mutirani). VERIFIKACIJA
  (na KONČNI viri): tsc 0 · eslint 0 (FULL) · vitest **5209/5209 (328)** =
  R363 baza 5204/327 + mojih +5 − 0 [tek 1: 1 fail = r348 okno 600; tek 2
  zeleno] · build svež EXIT=0 [rm -rf .next; max-old-space-size 2560] ·
  `qa-round.sh 364 needles` VSE OK [4 need_static ŽIVO + TODO-R364
  odsoten; veriga + union registri r340–r364] · smoke EXIT=0 · e2e EXIT=0
  [ODTIS IDENTIČEN — ZERO-MUTACIJA] · leak-check čist. NOVO:
  scripts/qa-needles/r364.tsv [4 need_static ×1/×1/×5/×1, vsi ×0 v HEAD
  fetch-first git grep; must_miss; python write z \t; awk NF=3 čisto] +
  README disk resnica [5209/328 + R364 bullet].
- **Ring pariteta val 48 + e2e-lib dedup 5. val** (R365): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 364` ZELEN ob poskusu 1
  + **OSEMNAJSTIJNA era preverba** `r365-era-harvest.sh` EXIT=0 ob 1. teku:
  18 registrov r347–r364 (≥77 need_static = 4+5+8+9+3+8+4+3+3+3+3+3+3+3+3+4
  +4+4), 75 ŽIVO direktno + 2 R353 prek hash rezolucije (CDN HTTP 200),
  R364 val 47 ×4 ŽIVO DIREKTNO [chunk_026] → deploy potrjen v celoti,
  must_miss ×18 čisto, era kontrole R340/R341/R343/R345 ŽIV; (2) **val 47
  POST-deploy verifikacija** (spot-r167/10 ×2 teka): statusChipi 4/4 z
  ring-offset-2 [vedno-montirana val 47 površina]; 3 terenska izvozna pilola
  iskreno NEmontirana — vrata `{selectedProject && (` (L5206), demo brez
  projektov = kanon r277 iskrena praznina; val 46 stabilnost 15/0 + true×3
  (1. uporaba kanona eb_sonda_zaloge); val 45 stabilnost 9/0/7; kolektor 0
  errorjev ×2 seje; (3) **MANDATORY STIL val 48** — ring PARITETA
  logistics-tab družine (NAJVEČJI preostali gap po val 43–47; per-barvni
  split sken: navy/40 V TEJ rundi, stray ring-red-400/50 ×2 = LOČENA
  družina [bratje photo-tab/sketch-canvas] — izrecno izven, dokumentirano):
  35 × focus-visible:ring-offset-2 dodan [vedre ŠTEJANE IZ DISKA: 30 zaprti
  niz + 5 disabled bucket; 1 (L1302) že nosil; NI template bucketov]
  → 36/36 parity (razcep = 0); in-place 0 novih vrstic 3294→3294; 0 novih
  hex (števec 1 — r292 baseline); aria/title ZAMRZNJENI; **r244 L231
  substring pin shiftan V ISTI rundi** (števec 5 nespremenjen — precedens
  R362/R363); 0 drugih shiftov čez 43 testnih datotek (r292 prefix pini
  preživijo; r317 okno NE seka navy vrstic); (4) **FEATURE e2e-lib dedup
  5. val** — NOV pomočnik `eb_sonda_zaloge` (byte-identičen eval blok
  md5 d3da5170…: r363 B + r364 B + r365 B = ×3 — prag LEKCIJE R352 natanko
  ob 3.) s porabo ob 1. uporabi v `r365-qa-spot.sh` V ISTI rundi (×2 zeleni
  teka; zamrznjeni NI mutirani). VERIFIKACIJA (na KONČNI viri): tsc 0 ·
  eslint 0 (FULL) · vitest **5214/5214 (329)** = R364 baza 5209/328 + mojih
  +5 − 0 [tek 1: 1 fail = multiplicita h-6 needle ×3→×1 — LEKCIJA R365:
  štej POJAVITVE grep -o, ne vrstice grep -c; tek 2 zeleno] · build svež
  EXIT=0 [rm -rf .next; max-old-space-size 2560] · `qa-round.sh 365
  needles` VSE OK [4 need_static ŽIVO + TODO-R365 odsoten; veriga + union
  registri r340–r365] · smoke EXIT=0 · e2e EXIT=0 [ODTIS IDENTIČEN —
  ZERO-MUTACIJA] · leak-check čist. NOVO: scripts/qa-needles/r365.tsv
  [4 need_static ×1/×1/×3/×5, vsi ×0 v HEAD fetch-first git show grep;
  must_miss; python write z \t; awk NF=3 čisto] + README disk resnica
  [5214/329 + R365 bullet].
- **Ring pariteta val 49 + e2e-lib dedup 6. val** (R366): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 365` ZELEN ob poskusu 1
  (7. runda zapored) + **DEVETNAJSTIJNA era preverba** `r366-era-harvest.sh`
  EXIT=0 ob 1. teku: 19 registrov r347–r365 (≥81 need_static = 77 + 4), 79
  ŽIVO direktno + 2 R353 prek hash rezolucije (CDN HTTP 200), R365 val 48 ×4
  ŽIVO DIREKTNO [chunk_041] → deploy potrjen v celoti, must_miss ×19 čisto,
  era kontrole R340/R341/R343/R345 ŽIV; (2) **val 48 POST-deploy
  verifikacija** (spot-r167/11, mounted + className LOČENO — LEKCIJA R365
  (4)): logistika mainNavy40 12/12 z offset-2, **mainBrezOffset 0**; 3
  izvozna pilola mounted+offset-2 ×3; VES-dokument števec ločen (BrezOffset
  9 = lupina/tab bar ostanki — znani val 49+ kandidati, LEKCIJA R361 (2));
  val 46 stabilnost (2. uporaba kanona eb_sonda_zaloge: 15/0 + true×3);
  val 45 stabilnost 9/0/7; val 47 statusChipi 4/4; kolektor 0 errorjev;
  (3) **MANDATORY STIL val 49** — ring PARITETA material-intelligence-tab
  družine (NAJVEČJI preostali enobarvni gap; **disk resnica = handover
  popravljen**: handover je domneval "offset-1 ×2", disk je pokazal 24 ×
  offset-1 + 2 brez — LEKCIJA R364 (4)): 24 × ring-offset-1→2 normalizacija
  (precedens val 44/47) + 2 × offset-2 dodan → **26/26 navy/40 nosi
  offset-2** (razcep = 0); in-place 0 novih vrstic 2366→2366; 0 novih hex
  (števec 0); aria/title ZAMRZNJENI; per-barvni split: ring-red-600/40 ×1
  (L2352) ostaja offset-1 — izrecno izven; **5 testnih datotek shiftanih V
  ISTI rundi** (PRED-scan čez 40: r242 L155–157 minsko polje ×3, r244-cenik
  ×2, r245 ×2, r333 PAR_ZETON_MATERIAL era žeton, r207 chipCls okno pin;
  r236 offset-1 pin bere invoice-manager — preživi; r361 not.toContain bere
  CRM — preživi); (4) **FEATURE e2e-lib dedup 6. val** — NOV pomočnik
  `eb_pocakaj_meritve` (predikat "Ni projektov || tabela>0" byte-identičen
  ×4 v zamrznjenih r360-spot2/r361/r362/r365 — prag LEKCIJE R352 DOLG
  presežen) s porabo ob 1. uporabi v `r366-qa-spot.sh` D V ISTI rundi
  (zamrznjeni NI mutirani). VERIFIKACIJA (na KONČNI viri): tsc 0 · eslint 0
  (FULL) · vitest **5219/5219 (330)** = R365 baza 5214/329 + mojih +5 − 0
  [tek 1 zeleno — stale pini shiftani proaktivno] · build svež EXIT=0
  [rm -rf .next; max-old-space-size 2560] · `qa-round.sh 366 needles` VSE OK
  [4 need_static ŽIVO + TODO-R366 odsoten; veriga + union registri
  r340–r366] · smoke EXIT=0 · e2e EXIT=0 [ODTIS IDENTIČEN — ZERO-MUTACIJA]
  · leak-check čist. NOVO: scripts/qa-needles/r366.tsv [4 need_static
  ×1/×1/×4/×8 v POJAVITVAH, vsi ×0 v HEAD fetch-first git grep; 5. kandidat
  izpuščen — redundanten z N1; must_miss; python write z \t; NF=3 čisto]
  + README disk resnica [5219/330 + R366 bullet].
- **Ring pariteta val 50 + e2e-lib dedup 7. val** (R367): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 366` ZELEN ob **poskusu
  2** (1. teek je zadetel znani transient — retry kanon PRAVIČNO porabljen,
  8. runda zapored) + **DVAJSETIJNA era preverba** `r367-era-harvest.sh`
  EXIT=0 ob 1. teku: 20 registrov r347–r366 (≥85 need_static = 81 + 4), 83
  ŽIVO direktno + 2 R353 prek hash rezolucije (CDN HTTP 200), R366 val 49 ×4
  ŽIVO DIREKTNO [chunk_036] → deploy potrjen v celoti, must_miss ×20 čisto,
  era kontrole R340/R341/R343/R345 ŽIV; (2) **val 49 POST-deploy
  verifikacija** (spot-r167/12, mounted + className LOČENO): material
  naročila/dobavitelji — izvozna pillola VEDNO vidna z offset-2 (nacrtiCsv,
  dobaCsv, dobaPdf true ×3), **mainBrezOffset 0 na obeh podzavihkih**
  (mainNavy40 3/3 + 8/8); pogojne površine iskreno NEmontirane z razlogom
  iz vira: chipCls filter za `orders.length > 0` vrati (L1646, kanon r277),
  Nov dobavitelj CTA za `lahkoUpravljaKatalog` vrata (fail-closed R242);
  val 46 stabilnost (3. uporaba kanona eb_sonda_zaloge); kolektor 0
  errorjev; (3) **MANDATORY STIL val 50** — ring OBLIKOVNA pariteta rdeče
  focus družine, per-barvni split zaključen (LEKCIJA R365 (3)): 5 članov
  čez 4 datoteke vsi z ring-2 + offset-2 — logistics L2732 (+offset-2),
  L3081 (BREZ ring-2! +oba), photo L2378 (+offset-2), sketch L602
  (+offset-2, red-400/60), material L2352 (offset-1→2 — val 49 jo je
  iskreno pustil izven); **BARVNI ŽIGI bajtno nespremenjeni** (shape-only,
  destruktivna semantika r236 ohranjena); in-place 0 novih vrstic
  (3294/2684/938/2366); 0 novih hex (1/12/14/0); aria/title ZAMRZNJENI;
  **3 testne datoteke shiftane V ISTI rundi** (r365 (A) števec 0→2,
  r244-wave6 eksakten pin — LEKCIJA R363 vzorec, r366 (A) lastni pin
  offset-1→2; r236 prefix pin preživi); (4) **FEATURE e2e-lib dedup 7.
  val** — NOV pomočnik `eb_sonda_status_chipi` (2-poljna sonda ×2
  byte-identična v r365 D + r366 D — PROAKTIVEN kanon pri 2. ponovitvi po
  LEKCIJI R362 (3), precedens eb_sonda_ring_pariteta/eb_pocakaj_zalogo) s
  porabo ob 1. uporabi v `r367-qa-spot.sh` C V ISTI rundi (statusChipi 4/4
  z offset-2; zamrznjeni NI mutirani). VERIFIKACIJA (na KONČNI viri):
  tsc 0 · eslint 0 (FULL) · vitest **5224/5224 (331)** = R366 baza
  5219/330 + mojih +5 − 0 [tek 1: 2 faila = split('\n') vs wc -l +1
  past + sosednji-niz guard past (barvni žeton med ring-2 in offset-2 —
  LEKCIJA R363) → wcLinije helper + žetona LOČENO, V ISTI rundi; tek 2
  zeleno] · build svež EXIT=0 [rm -rf .next; max-old-space-size 2560] ·
  `qa-round.sh 367 needles` VSE OK [4 need_static ŽIVO + TODO-R367
  odsoten; veriga + union registri r340–r367] · smoke EXIT=0 · e2e EXIT=0
  [ODTIS IDENTIČEN — ZERO-MUTACIJA] · leak-check čist. NOVO:
  scripts/qa-needles/r367.tsv [4 need_static ×1 vsak, vsi ×0 v HEAD
  fetch-first git grep; 5. kandidat izpuščen — isti čanek kot N1;
  must_miss; python validacija NF=3] + README disk resnica [5224/331 +
  R367 bullet].
- **Ring pariteta val 51 + e2e-lib dedup 8. val** (R368): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 367` ZELEN ob **poskusu
  2** (1. teek transient — retry kanon pravično porabljen, 9. runda zapored)
  + **ENAINDVJSETIJNA era preverba** `r368-era-harvest.sh` EXIT=0 ob 1. teku:
  21 registrov r347–r367 (≥89 need_static = 85 + 4), R367 val 50 ×4 ŽIVO (3
  direktno + sketch prek hash rezolucije 1085983bcb110e2c.js HTTP 200) →
  deploy potrjen v celoti, must_miss ×21 čisto, era kontrole
  R340/R341/R343/R345 ŽIV; (2) **val 50 POST-deploy verifikacija**
  (spot-r167/13, mounted + className LOČENO): vse rdeče površine pogojene —
  iskreno NEmontirane v demo praznini z vrati iz vira (Upokoji oprema,
  'Zaključi z override' QC dialog, 'Izbriši mero' isPhoto&&photoId,
  'Pobriši celotno skico' projekt+strokes, material cancel dialog
  cancelDialogOrder); val 47/49 stabilnost (mainNavy40 27/27 offset-2,
  BrezOffset 0); kolektor 0 errorjev; (3) **MANDATORY STIL val 51** — ring
  OBLIKOVNA pariteta roksal-AMBER focus družine (per-barvni census iz diska
  prek `scripts/r368-census.py`: 31 žetonov / 30 površin / 11 datotek —
  14 že O2, 3 × offset-1→2, 13 × dodan → **razcep = 0**); in-place 0 novih
  vrstic (19250); 0 novih hex (12/1); aria/title ZAMRZNJENI; **stale pini
  PRED-scan → 25 pojavitev v 14 zamrznjenih skriptah shiftanih V ISTI
  RUNDI** (inventory offset-1 pin ×14 r243–r255+r244-prod-qa; notification
  izjema pin ×11 r245–r255; žig [PIN SHIFT R368 val 51]; r175 regex prefix
  pin preživi — [^"]* flex); (4) **FEATURE e2e-lib dedup 8. val** — NOV
  pomočnik `eb_sonda_navy_stetje` (3-poljni navy/40 števec byte-identičen
  ×3 v r366 B + r367 A/B — md5 d1f0004c299648ab1ff88f06bdafc889; prag
  LEKCIJE R352 IZENAČEN; precedens eb_sonda_status_chipi R367) s porabo ob
  1. uporabi v `r368-qa-spot.sh` A+B V ISTI rundi (kanon ne sme biti
  papir; zamrznjeni NI mutirani). VERIFIKACIJA (na KONČNI viri): tsc 0 ·
  eslint 0 (FULL) · vitest **5229/5229 (332)** = R367 baza 5224/331 +
  mojih +5 − 0 [tek 1: 2 faila = pod() literal-escaper nad regexom hex
  števca + pojavitve ≠ klici v spot skripti → direktni regex + števec
  klicev V ISTI rundi; tek 2 zeleno] · build svež EXIT=0 ·
  `qa-round.sh 368 needles` VSE OK [4 need_static ŽIVO + TODO-R368
  odsoten; veriga + union registri r340–r368] · smoke EXIT=0 · e2e EXIT=0
  [ZERO-MUTACIJA] · leak-check čist. NOVO: scripts/qa-needles/r368.tsv [4
  need_static ×1/×3/×2/×2, vsi ×0 v HEAD fetch-first git grep; 2 kandidata
  izpuščena — inclinometer NI ×0 (vodja prefix), step-corners isti čanek
  kot N4; must_miss; python validacija NF=3] + README disk resnica
  [5229/332 + R368 bullet].
- **Ring pariteta val 52 + e2e-lib dedup 9. val** (R369): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 368`: **ZELEN ob
  poskusu 1 FOREGROUND** (2 skuska detachanega nohup teka je ubilo
  okolje — proces kill, NI skriptnega faila; iskreno poročano) + **DVAINDVJSETIJNA
  era preverba** `r369-era-harvest.sh` EXIT=0 ob 1. teku: 22 registrov
  r347–r368 (≥93 need_static = 89 + 4), **R368 val 51 vsi 4 ŽIVO DIREKTNO**
  (chunk_045/chunk_014/chunk_026/chunk_018) → val 51 deploy potrjen v
  celoti; 2 R353 needleja prek hash rezolucije (a0911d4a… + 1085983b…,
  HTTP 200); must_miss ×22 čisto; era kontrole R340/R341/R343/R345 ŽIV;
  (2) **val 51 POST-deploy verifikacija** (spot-r167/14, mounted +
  className LOČENO): **12 MONTIRANIH amber površin z offset-2** —
  inclinometer 'Vklopi libelo' ×1 (permission idle), obvestilne kartice
  **×10** (Sheet odprt — demo NI prazen; L748 amber/60), viz ročaj ×1
  (demo način); pogojne iskreno NEmontirane z vrati iz vira (photo
  kategorija/debelina/orodja — 'Ni fotografij'; measurements amber/40 ×0
  — mera foto/cenovni kontekst); top-bar iskalnik white/60 + offset-0 =
  dokumentirana gosta površina ŽIVO; navy pariteta 27/27 offset-2
  (BrezOffset 0); 1. uporaba eb_sonda_red_stetje (rdeči 0/0/0 — iskrena
  praznina); kolektor 0 errorjev; (3) **MANDATORY STIL val 52** — ring
  OBLIKOVNA pariteta navy+ink PARIŠKIH vrstic (svetlo+temno dvojčki na
  ISTIH elementih; per-barvni census iz diska prek `scripts/r369-census.py`:
  roksal-ink/40 ×12 = VSI dark: dvojčki navy/40 brez offseta → **12 × EN
  focus-visible:ring-offset-2 TIK ZA navy/40** — tema-neodvisen žeton
  pokrije obe varianti ISTEGA elementa; termini-card ×6, bottom-nav ×2,
  notification-center ×3, quick-actions-fab ×1); census po: ink/40 =
  {'O2': 12} razcep = 0, navy gap 77→65 (točno 12 parov; ostali navy rep =
  val 53+ kandidat); **2 namerni izjemi dokumentirani** — ui/* kit
  ring/50 ×14 (shadcn ring-[3px] fokus jezik) + top-bar white/60
  offset-0 ×3 (gosta površina); in-place 0 novih vrstic; 0 novih hex
  (4/0); aria/title ZAMRZNJENI; **stale-pini: 1 SHIFTAN** — r167 okenski
  kvantifikator {0,400}→{0,430} z žigom [PIN SHIFT R369 val 52] (okno
  380→408; PRED-skan sosledja ga NI ulovil — ulov ga je FULL vitest;
  LEKCIJA: pre-skan mora enumerirati VSE okenske kvantifikatorje); r167
  sosledja ink preživita, r214 2/2, r268/r361 izven tarče; (4) **FEATURE
  e2e-lib dedup 9. val** — NOV pomočnik `eb_sonda_red_stetje` (rdeči trio
  byte-identičen ×2 v r368-qa-spot A/C — per-blok md5 03c8497d…; skrajšani
  par ×3 — md5 640fec6d…, prag R352 IZENAČEN; kanon = POLNI trio 3-poljni
  eval, B-okrnjena oblika se ne kanonizira; regex /ring-red-\d+\// = INLINE
  resnica heterogenih rdečih žetonov) s porabo ob 1. uporabi v
  `r369-qa-spot.sh` V ISTI rundi (zamrznjeni NI mutirani). VERIFIKACIJA
  (na KONČNI viri): tsc 0 · eslint 0 (FULL) · vitest **5234/5234 (333)** =
  R368 baza 5229/332 + mojih +5/+1 − 0 [tek 1: 1 fail = r167 okenski pin
  (zgoraj) → shift V ISTI RUNDI; tek 2 zeleno] · build svež EXIT=0 ·
  `qa-round.sh 369 needles` VSE OK [4 need_static ŽIVO + TODO-R369
  odsoten; veriga + union registri r340–r369] · smoke EXIT=0 · e2e EXIT=0
  [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 —
  ZERO-MUTACIJA] · leak-check čist. NOVO: scripts/qa-needles/r369.tsv [4
  need_static ×10/×1/×1/×1 pojavitve grep -o, vsi ×0 v HEAD 686c379
  fetch-first git grep GLASNO potrjeno; izpuščen kandidat 'navy/40
  offset-2 disabled:' NI ×0 (inclinometer starejša era); must_miss;
  python validacija NF=3] + README disk resnica [5234/333 + R369 bullet].
- **Ring pariteta val 53 (navy offset-1 rep) + QA-infra window-scan orodje** (R370): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 369`: **ZELEN ob poskusu 1
  FOREGROUND** + **TRIINDVJSETIJNA era preverba** NOV kanonski skript
  `r370-era-harvest.sh` [klon r369 prek python; 23 registrov r347–r369, ≥97
  need_static = 93 + 4, vsota potrjena iz diska prek python]: **EXIT=0 ob 1.
  teku** — vseh TRIINDVJSET er ŽIVO NA PRODU; ⭐ **R369 val 52 vsi 4 needleji
  ŽIVO prek hash rezolucije** (3abf34ececedd8ff.js + dc5a9c95ae97123a.js HTTP
  200 + niz prisoten) → val 52 deploy potrjen v celoti; 2 R353 needleja še
  naprej prek hash rezolucije; must_miss ×23 čisto; era kontrole
  R340/R341/R343/R345 ŽIV; (2) **val 52 POST-deploy verifikacija** (spot-r167/15
  `r370-qa-spot.sh` + `r370-spot-reprobe.sh`; mounted + className LOČENO —
  LEKCIJA R365 (4); prijava OK ob poskusu 2 — transient, iskreno): bottom-nav
  **9/9/9/0** (navy40/ink40/offset2/brezOffseta — VEDNO montirane pariške
  vrstice; **znani 'tab bar 9 ostanki' kandidat iz R368 handoverja REŠEN z val
  52**), Sheet kartice navy/40 **51/51** + 'Označi vse' 1/1, FAB sprožilec ŽIVO
  (item vrata: meni odprt), termini pari **4/4/0**, **D2 dokaz**: edini
  navy/40-BrezOffset gumb na dashboardu = 'Izvozi CSV' L1678 = shadcn Button +
  brand barvni override = **val 52 namerna izjema #1** (kit ring-[3px] fokus
  jezik) — NI val 54 gap po doktrini izjem; **kolektor 0 errorjev**; sonde:
  eb_sonda_navy_stetje 3. uporaba + eb_sonda_red_stetje 2. uporaba (iskrena
  praznina ob vzorčenju); (3) **MANDATORY STIL val 53** — ring OBLIKOVNA
  pariteta navy/40 OFFSET-1 REP, normalizacija 1→2 (per-barvni split kanon:
  navy = val 43–49 + val 52 pari, red = val 50, amber = val 51, navy O1 rep =
  val 53; precedens val 47/49/51): census iz diska (`r369-census.py` RE-POGNAN
  — navy/40 PRED {'O2': 184, 'O1': 8, 'NONE': 54, '?INTERP': 3} gap 65 → PO
  {'O2': 192, 'O1': 0, 'NONE': 54, '?INTERP': 3} gap 57 — **O1 razcep = 0**):
  **8 vrstic × 4 datoteke** (calculator L4382, dashboard L2666, invoice
  L1045/L1061/L1182, vodja L1274/L1290/L1306); substitucija **DOLŽINSKO
  NEVTRALNA** (27→27 znakov) = 0 okenskih premikov; NONE ×54 + ?INTERP ×3
  ISKRENO izven (val 54+ triaža; D2 dokaz zgoraj); in-place 0 novih vrstic; 0
  novih hex (16/0/6/1 = HEAD); aria/title ZAMRZNJENI; **stale-pini: 6 SHIFTOV
  V ISTI RUNDI** z žigi [PIN SHIFT R370 val 53] — r236 test L276 + r236-build
  L47/L48/L49 (**L48 Izdaj/Plačan + L49 Prejem ŽE ZASTARELA PRED R370** —
  najdba: legacy needleja IZVEN trenutne needles verige [TSV registri r340+
  edini vir needles faze]; osvežena na disk resnico) + r237-build L43 +
  r237-prod-core L64 (legacy proaktivno — kanon R368 r244-prod-qa); r366 (C)
  bere r242 TEST — preživi, r364 (A) MERITVE-only — preživi; (4) **FEATURE
  QA-infra hardening 3. val** — NOV orodje `scripts/r370-window-scan.py`
  (**LEKCIJA R369 (2) FORMALIZIRANA**: stale-pin PRED-skan enumerira VSE
  okenske kvantifikatorje {0,N}/{M,N} nad tarčnimi datotekami + delta-mode
  simulacija) — **65 okenskih regexov enumeriranih** (per-tarčna enumeracija),
  0 preozkih, PRED + PO apply (1. uporaba V ISTI rundi — kanon ne sme biti
  papir); **e2e-lib dedup 10. val ISKRENO IZPUŠČEN** — python skan
  `r370-dedup-scan.py` nad r365–r369 spot skriptami: 13 eval blokov, 13
  unikatnih (whitespace-normalizirano), 0 ponovitev ≥2 → NI kandidata (kanon
  R368). VERIFIKACIJA (na KONČNI viri): tsc 0 · eslint 0 (FULL) · vitest
  **5239/5239 (334)** = R369 baza 5234/333 + mojih +5/+1 − 0 [tek 1: 3 faila =
  (a) žig 'LEKCIJA' vs 'LEKCIJE' niz, (b) re-enumeracija dedupirana namesto
  per-tarčna [53 vs 65], (c) dolžina polnega žetona 27 vs rep 13 [moja
  aritmetika] — vsi popravljeni V ISTI rundi; tek 2 zeleno] · build svež
  EXIT=0 · `qa-round.sh 370 needles` VSE OK [4 need_static ŽIVO + TODO-R370
  odsoten; veriga + union registri r340–r370] · smoke EXIT=0 · e2e EXIT=0
  [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] ·
  leak-check čist. NOVO: scripts/qa-needles/r370.tsv [4 need_static ×1 vsak
  per-datoteka grep -rlF (LEKCIJA R368 (6): cat brez ločila laže), vsi ×0 v
  HEAD 2628e52 fetch-first git grep GLASNO potrjeno; izpuščena kandidata
  DOKAZANA: vodja niz = material ×8, invoice pill niz = crm ×1 — className-only
  ne diskriminira; must_miss; python validacija NF=3] + NOVE skripte
  [r370-era-clone.py, r370-era-harvest.sh, r370-dedup-scan.py,
  r370-window-scan.py, r370-qa-spot.sh, r370-spot-reprobe.sh,
  r370-val53-apply.sh, r370-pins-shift.py, r370-register-write.py] + README
  disk resnica [5239/334 + R370 bullet] + LEKCIJE R370: (1) **legacy
  build-needle skripti (r227–r339) so IZVEN trenutne needles verige** — njihovi
  zastareli needleji so bili NEVIDNO zastareli (r236 L48/L49 že pred R370);
  needles faza = TSV registri r340+ SAMO — legacy needleje osvežiti ob dotiku
  ALI uradno upokojiti (lastniška odločitev); (2) **per-tarčna enumeracija je
  kanon orodja** — test, ki bere 2 tarči, se šteje 2× (53 dedupirano ≠ 65
  per-tarčno); in-test replika mora upoštevati ISTO semantiko; (3) **cat brez
  ločila laže multiplicito** — sosednji .tsx brez končne noveline skrije
  zadnji/       prvi niz (grep -rlF per datoteka = kanon, LEKCIJA R368 (6)
  precizirana); (4) **poln žeton ≠ rep** — 'focus-visible:ring-offset-N' = 27
  znakov, 'ring-offset-N' = 13; dolžinsko-nevtralni dokaz na polnem žetonu;
  (5) **era-needle potrebuje ×0 v HEAD** — niz, ki ga nosi tudi druga datoteka
  (material ×8 / crm ×1), NI era diskriminator; vitest per-datoteka guard
  pokrije ostale; (6) **spot sonde brez dispatch/poll poročajo lažno
  praznino** — A-section r370-qa-spot je tekla pred montažo (nav 0), re-proba
  z dispatch+wait je pokazala 9/9/9/0 (LEKCIJA R360 poll kanon potrjena).
  Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement
  jedro NIČ [val 53 = render plast a11y className-only v 4 render datotekah];
  OgrajaVizija nič; brez sheme (ZERO-MUTACIJA E2E); 0 novih hex; NIČ novih FNV
  soli. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti
  lastnika (74. zapis). R371 prva naloga = qa-round.sh 370 prod-qa re-run
  [prek `r359-prod-qa-retry.sh 370`] + **STIRIINDVJSETIJNA era preverba
  r347–r370** [24 registrov, ≥101 need_static = 97 + 4 — pričakuj VSE ŽIVO; 2
  R353 needleja prek hash rezolucije; kanonski skript `r371-era-harvest.sh`
  [klon r370; 24 registrov, ≥101] pričakovan] + val 53 POST-deploy
  verifikacija [navy O1-rep površine spot — mounted + className LOČENO;
  calculator/dashboard/invoice/vodja — pričakuj delno montirane (navy
  pariteta per površina)]. R371 kandidati: **ring parity val 54 — navy NONE
  triaža** [54 vrstic per-vrstična klasifikacija iz diska: shadcn-kit override
  (izjema #1 doktrina) vs resnični brand gumbi brez offseta; orodje
  r370-window-scan.py kanon razširjen na NONE sken] ALI **?INTERP ×3 triaža**
  [roksal-catalog/punch-list interpolirani className — ročno ali preskočiti]
  ALI **e2e-lib dedup 11. val** [iskreno: NI kandidata ob ×2/×3 po
  r370-dedup-scan.py — izpustiti če ni ponovitve]. ISSUE #1: vsa sprejemna
  merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj >
  QA].
- **Ring pariteta val 54 (navy NONE triaža) — BRAND GUMB pariteta ZAKLJUČENA** (R371): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 370`: **ZELEN ob poskusu 2**
  (1. teek transient — retry kanon iskreno porabljen, 10. runda zapored) + **STIRIINDVJSETIJNA
  era preverba** NOV kanonski skript `r371-era-harvest.sh` [klon r370 prek python
  `r371-era-clone.py`; 24 registrov r347–r370, ≥101 need_static = 97 + 4, vsota iz
  diska]: **EXIT=0 ob 1. teku** — vseh ŠTIRIINDVJSET er ŽIVO NA PRODU; ⭐ **val 53
  vsi 4 needleji ŽIVO DIREKTNO** (chunk_043/chunk_028/chunk_037) → val 53 deploy
  potrjen v celoti; 2 R353 needleja prek hash rezolucije; must_miss ×24 čisto;
  (2) **val 53 POST-deploy verifikacija** (spot-r167/16 `r371-qa-spot.sh` +
  `r371-vodja-identify.sh`; VSAKA površina z dispatch + pocakaj — LEKCIJA R370
  (6)): vodja izvozni pilli **3/3 offset-2 ŽIVO**, invoice racuniCsv +
  prihodkiPdf **1/1** + meseciCsv iskreno NEmontiran (vrata `meseciPovzetek.ok` —
  kanon r277), calculator zgodovina **1/1**, dashboard 'Izvozi CSV' kit override
  ŽIVO (offset NAMERNO 0 — izjema #1), **4. navy/40 BrezOffset 'Izvozi *' =
  sistem-zdravje-card L204 kit override** (disk dokaz — izjema #1); sonde:
  eb_sonda_navy_stetje 4. uporaba + eb_sonda_red_stetje 3. uporaba; **kolektor 0
  errorjev**; (3) **MANDATORY STIL val 54** — ring OBLIKOVNA pariteta navy/40
  NONE TRIAŽA: disk resnica prek NOVega orodja `scripts/r371-none-triage.py`
  (element klasifikacija z nazaj-hodom do 15 vrstic — LEKCIJA R364 (4) = KODA
  ne oči): navy/40 NONE ×54 = **KIT ×35** (shadcn Button + brand override —
  NAMERNA izjema #1) + **RAW ×13** (val 54 tarče) + **INPUT ×2** (dashboard
  L1623 + roksal-catalog L95 — iskalni vnosi, NE gumbi — iskreno izven) +
  **CMP ×5** (DropdownMenu/Command/Card — lastni fokus jezik, izven) +
  deal-pipeline L219 (drag handle — NE gumb, izven); **13 vrstic × 10 datotek**
  dobi ` focus-visible:ring-offset-2` TIK ZA navy/40 (audit L249/L310,
  calculator L860/L4439, dashboard L1628/L1756, inclinometer L341,
  inline-inclinometer L131, inline-kotomer L185, steber L69, photo L2370,
  punch L531, rate-limit L226; 2 tarči = census ?INTERP template → O2); census
  PRED {'O2': 192, 'NONE': 54, '?INTERP': 3} gap 57 → PO **{'O2': 205, 'NONE':
  43, '?INTERP': 1} gap 44 — vsi 44 DOKUMENTIRANI namerni (35 KIT + 2 INPUT +
  5 CMP + 1 drag) → navy/40 BRAND GUMB pariteta ZAKLJUČENA (razcep = 0;
  milestone val 43–54)**; substitucija DODAJA 27 znakov; **stale-pin PRED-SKAN
  ČIST → 0 PIN SHIFTOV** (prva runda brez shiftov od R367): r370-window-scan.py
  delta +27 = 0 preozkih (65/65), r317 must_miss needle odsoten, r348 steber +
  r346 okno + r271/r272/r268 handler pini preživijo; **2 ŠTEVEC PIN SHIFTA** [PIN SHIFT
  R371 val 54] — r370-stil-val53 (A) offset-2 števec calculator 1→3 +
  dashboard 2→4 (val 54 na ISTIH datotekah; ulovljen s FULL vitestom —
  okno-scan ne vidi števcev); in-place 0 novih vrstic; 0
  novih hex (10/0/16/0/12/0/0/0/8/0); aria/title ZAMRZNJENI; (4) **e2e-lib
  dedup 11. val ISKRENO IZPUŠČEN** — dokaz V TESTU (13 blokov / 13 unikatnih /
  0 ponovitev ≥2 — kanon R368). VERIFIKACIJA (na KONČNI viri): tsc 0 · eslint 0
  (FULL) · vitest **5244/5244 (335)** = R370 baza 5239/334 + mojih +5/+1 − 0
  [tek 1: 2 faila = (a) preširok must_miss sosledni assert [L262 KIT vrstica
  nosi krajšo sosledje — polni r317 needle edini pravi], (b) r346 okno
  char-based namesto line-based kanon [i-8..i+6] — vsi popravljeni V ISTI
  rundi; tek 2 zeleno 5/5] · build svež EXIT=0 · `qa-round.sh 371 needles` VSE
  OK [4 need_static ŽIVO + TODO-R371 odsoten; veriga + union registri
  r340–r371] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post
  r276+r281+r283+r287 — ZERO-MUTACIJA] · leak-check čist. NOVO:
  scripts/qa-needles/r371.tsv [4 need_static ×1 per-datoteka grep -rlF, vsi ×0
  v HEAD 76fd98d fetch-first GLASNO; izpuščeni kandidati dokumentirani
  [punch-list template compile rep; inline close brata ×2 enak niz — kanon 4
  needleje/rundo; ostale 6 tarč prek vitest (A) guard]; must_miss; NF=3 čisto]
  + NOVE skripte [r371-era-clone.py, r371-era-harvest.sh, r371-qa-spot.sh,
  r371-vodja-identify.sh, r371-none-triage.py, r371-val54-apply.py,
  r371-register-write.py, r371-readme-update.py] + README disk resnica
  [5244/335 + R371 bullet] + LEKCIJE R371: (1) **klon-kanon preverbe morajo
  ločiti PRED-pogoje (vhodni rep) od POST-pogojev (novi žigi)** — TODO-R370 ni
  lahko v must r370-klona (še ne obstaja); (2) **legitimen ostanek stare
  ere-besede v NOVI glavi** [triindvajsete preverbe R370] — števec žigov
  pričakovan natančen [isti vzorec kot R370 klon lekcija, 2. ponovitev —
  LEKCIJA R362 (3) kanon pri ponovitvi]; (3) **era-klasični needle gre z
  `--`/`-e` ob vodilnem pomnilniku** [top-1/2 -translate… je lažno padel kot
  opcija]; (4) **must_miss assert mora uporabiti POLNI needle niz** — krajša
  sosledja laže padejo na KIT vrsticah z ISTO sosledjem [L262]; (5) **okenski
  kanon r346 je LINE-based [i-8..i+6]** — char-based replika, usmerjena SAMO
  naprej, zgreši className PRED aria-jem; replika = ISTA semantika kot
  original [LEKCIJA R364 (4) precizirana]; (6) **spot sonde z dispatch+poll
  na VSAKI površini** [LEKCIJA R370 (6) aplicirana — 4/4 površine ŽIVO brez
  lažne praznine razen iskrenih vrat]. Kontrakt NIČ (/api/sync);
  SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 54 = render
  plast a11y className-only v 10 render datotekah]; OgrajaVizija nič; brez
  sheme (ZERO-MUTACIJA E2E); 0 novih hex; NIČ novih FNV soli. ⏰
  roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (75.
  zapis). R372 prva naloga = qa-round.sh 371 prod-qa re-run [prek
  `r359-prod-qa-retry.sh 371`] + **PETINDVJSETIJNA era preverba r347–r371**
  [25 registrov, ≥105 need_static = 101 + 4 — pričakuj VSE ŽIVO; 2 R353
  needleja prek hash rezolucije; kanonski skript `r372-era-harvest.sh` [klon
  r371; 25 registrov, ≥105] pričakovan] + val 54 POST-deploy verifikacija
  [13 surovih brand vrstic spot — mounted + className LOČENO; audit-trail
  dialog vrata: zgodovina odprta; dashboard iskanje: vnos ≠ prazno → clear
  ŽIVO; punch/inclinometer PDF vrata]. R372 kandidati: **?INTERP triaža ×1
  preostala** [roksal-catalog L110 KIT template — kit override doktrina ali
  ročno offset] ALI **INPUT/LINK fokus jezik odločitev** [2 iskalna vnosa +
  top-bar CMP ×3 — lastniška/usklajena doktrina ali dokumentirano stalno
  izjema] ALI **nov stil val 55 na drugi barvni družini** [census: red/40 gap
  22 = NONE ×20 + O1 ×2 — per-vrstična triaža iz diska PRED odločitvijo;
  ambers/ink zaključeni] — vedno z fetch-first + TSV kanonom + stale-pin
  PRED-skanom prek r370-window-scan.py. ISSUE #1: vsa sprejemna merila ✓;
  ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **Ring pariteta val 55 (red/40 RAW) — red BRAND GUMB pariteta ZAKLJUČENA** (R372): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 371`: **ZELEN ob poskusu 2**
  (1. teek transient — retry kanon iskreno porabljen, 11. runda zapored) + **PETINDVJSETIJNA
  era preverba** NOV kanonski skript `r372-era-harvest.sh` [klon r371 prek python
  `r372-era-clone.py`; 25 registrov r347–r371, ≥105 need_static = 101 + 4, vsota iz
  diska; LEKCIJA R371 (2) 3. ponovitev vzorca → zaostanek glave POPRAVLJEN na disk
  resnico — klon preverja OBE smeri ('petindvajsete preverbe R372' ×1 + stari
  zaostanek ×0)]: **EXIT=0 ob 1. teku** — vseh PETINDVJSET er ŽIVO NA PRODU; ⭐ **val 54
  vsi 4 needleji ŽIVO DIREKTNO** (chunk_028/chunk_043) → val 54 deploy potrjen v
  celoti; 3 needleji prek hash rezolucije; must_miss ×25 čisto;
  (2) **val 54 POST-deploy verifikacija** (spot-r167/17 `r372-qa-spot.sh` + re-proba
  spot-r167/17b `r372-spot-reprobe.sh`; mounted + className LOČENO — LEKCIJA R365
  (4); dispatch+poll VSAKA površina — LEKCIJA R370 (6)): **L1628 'Počisti iskanje
  projektov' ŽIVO 1 mounted / 1 navy40 / 1 offset-2**; measurements tab **27 navy/40 =
  27 offset-2** (BrezOffset 0 — val 52/53/54 skupni dokaz); calculator Zgodovina
  sprožilec navy40+offset2 1/1 (val 53 ŽIVO); **demo seja 'Ni projektov' (0 vrstic —
  disk resnica)** → projekt-gated površine (L1756 Arhiviraj, audit chips L249 +
  razpenjanje L310, nagibi PDF L341, steber CSV L69, inline urednika L131/L185,
  Uredi mero L2370, zapisnik PDF L531, telemetrija CSV L226) **iskreno NEmontirane**
  (kanon r277 z razlogom iz diska); 1. teek nauček: vrstica ni bila montirana ob
  pollu (prijava poskus 2) + iskalni filter je izpraznil seznam PRED klikom vrstice
  → re-proba z obrnjenim zaporedjem (sidro → vrstice → klik → šele nato pogojne);
  L860 Počisti uvoz (vrata importedFromMeasurement) + L4439 zgodovina vrstice
  (vrata history.length>0) iskreno NEmontirani; kolektor **0 errorjev** v obeh
  sejah → **NI runtime bugov → development-first**;
  (3) **MANDATORY STIL val 55 — ring OBLIKOVNA pariteta roksal-red/40 RAW** (per-barvni
  split kanon: navy = val 43–49 + 52 pari + 53 O1 rep + 54 NONE triaža, red = val 50
  [red-400/60 trio] + **val 55** [roksal-red/40 družina], amber = val 51; BARVNI ŽIGI
  bajtno nespremenjeni — shape-only runda): census PRED {'NONE': 20, 'O1': 2, 'O2': 3}
  gap 22 → PO **{'NONE': 14, 'O2': 11} gap 14 — vsi 14 = DOKUMENTIRANI namerni
  (12 KIT [shadcn <Button> + brand override — izjema #1] + 2 CMP [top-bar
  DropdownMenuItem odjava — lastni fokus jezik]) → red/40 BRAND GUMB pariteta
  ZAKLJUČENA (razcep na brand gumboh = 0; O1 razcep = 0)**; **RAW ×8**: 2 × SUB
  O1→O2 DOLŽINSKO NEVTRALNO 27→27 (dashboard L1987 'Zamujena dobava', vodja
  L2122 'Brez dobavitelja' — precedent val 53) + 6 × INS ' focus-visible:ring-offset-2'
  TIK ZA red/40 (material-intelligence L1408, measurements L3351/L4032,
  notification-center L703, photo-tab L717, sistem-zdravje L228 — precedent val 54);
  in-place = **0 novih vrstic** (3188/2199/2366/6232/969/2684/307 — wcLinije kanon);
  **0 novih hex** (0/1/0/0/0/12/0 = HEAD); aria/title ZAMRZNJENI (ring-only —
  val 44–54 precedens); apply prek `scripts/r372-val55-apply.py` (fail-closed per
  vrstica: red/40 točno 1×, offset stanje pričakovano, PO pozicijska preverba);
  (4) **FEATURE `scripts/r372-token-triage.py`** — generalizacija r371-none-triage.py
  na POLJUBEN focus-visible:ring- žeton (argv; klasifikacija KIT/RAW/INPUT/LINK/CMP/
  DIV z nazaj-hodom do 15 vrstic; **1. uporaba V ISTI rundi**): 1. teek je 5 'golih'
  `<button` tagov lažno označil DIV?/? [pattern `<button[\s>]` ne ujame taga na
  koncu vrstice] + `<DropdownMenuItem` zgrešil kot CMP → popravljeno V ISTI rundi
  prek `(?![-\w])` + `\w*` → PO popravku: GAP 22 = KIT ×12 + RAW ×8 + CMP ×2, 0
  neopredeljenih; **NOVI `scripts/r372-window-scan.py`** (klon r370, TARGETS = 7 val
  55 datotek) delta +27 = **0 preozkih (121/121, PRED in PO)**; ŠTEVEC guard sken
  PRED vitestom (LEKCIJA R371 (7) aplicirana): r370 (A) navy-obsegani števci
  nedotaknjeni, r371 (A) hex/aria/title/in-place čisto; **1 ŠTEVEC PIN SHIFT**
  [PIN SHIFT R372 val 55]: r371 (B) sistem-zdravje celo-datotečni 'ring-offset'
  absent → navy-vrstični guard z ISTO namero (val 55 offset na RAW red/40 L228;
  kit override L204 ostaja brez offseta); okenski pini 0 shiftov;
  (5) **e2e-lib dedup 12. val ISKRENO IZPUŠČEN** — dokaz V TESTU (E): 26 blokov
  r370–r372 / 21 unikatnih / 5 ponovitev ×2 — **VSE znotraj r372** (r372-qa-spot
  1. teek vs r372-spot-reprobe ISTEGA teka; preverba izvora per hash) → nič
  čez-rundnih ponovitev → ni kandidata (kanon R368).
  VERIFIKACIJA (celotna, FOREGROUND, na KONČNI viri): tsc 0 · eslint 0 (FULL) ·
  vitest 5249/5249 (336) = R371 baza 5244/335 + mojih +5/+1 − 0 · build svež EXIT=0 ·
  qa-round.sh 372 needles VSE OK 0 MISS [4 need_static ŽIVO + TODO-R372 odsoten;
  veriga + union registri r340–r372] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO
  IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · r372-era-harvest.sh
  EXIT=0 [PETINDVJSETIJNA] · leak-check čist. NOVO: scripts/qa-needles/r372.tsv
  [4 need_static ×1 per-datoteka grep -rlF, vsi ×0 v HEAD 810b691 fetch-first GLASNO;
  izpuščeni kandidati dokumentirani: skupni niz 3 bratov material-intelligence/
  notification-center/photo ×3 + measurements L4032 + SUB celotni nizi — pokriti
  prek vitest (A); must_miss TODO-R372; NF=3 čisto] + NOVE skripte [r372-era-clone.py,
  r372-era-harvest.sh, r372-window-scan.py, r372-qa-spot.sh, r372-spot-reprobe.sh,
  r372-token-triage.py, r372-val55-apply.py, r372-readme-update.py,
  r372-worklog-append.py] + LEKCIJE R372: (1) **demo 'Ni projektov' = disk resnica**
  — projekt-gated spot površine iskreno NEmontirane z razlogom, NI bug; (2) **spot
  zaporedje: sidro → vrstice → klik → šele nato pogojne vnose** (iskalni filter PRED
  klikom vrstice izprazni seznam); (3) **triaža-orodje: goli tag na koncu vrstice**
  (`<button\n`) rabi `(?![-\w])`, ne `[\s>]`; (4) **komponentni prefiksi rabijo
  `\w*`** (DropdownMenuItem ≠ DropdownMenu + \s); (5) **celo-datotečni absent
  asserti so krhki ob novih površinah ISTEGA datoteka** — ožji navy-vrstični guard
  z žigom ob prvem stiku; (6) **klon glave: zaostanek ere-besede popraviš, ne
  podeduješ** — 3. ponovitev vzorca, tokrat disk resnica v Novi glavi; (7) vitest
  rabi `import { describe, expect, it } from 'vitest'` (globals izklopljeni).
  Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro
  NIČ [val 55 = render plast a11y className-only v 7 render datotekah];
  OgrajaVizija nič; brez sheme (ZERO-MUTACIJA E2E); 0 novih hex; NIČ novih FNV soli.
  ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (76.
  zapis). R373 prva naloga = qa-round.sh 372 prod-qa re-run [prek
  r359-prod-qa-retry.sh 372] + ŠESTINDVJSETIJNA era preverba r347–r372 [26
  registrov, ≥109 need_static = 105 + 4 — kanonski skript r373-era-harvest.sh
  pričakovan] + val 55 POST-deploy verifikacija [4 needleji r372.tsv — dashboard
  L1987 'Zamujena dobava' VEDNO montiran ob zamujenih dobavah (vrata
  zamujeneDobaveDomov > 0), vodja L2122 'Brez dobavitelja' (vrata stats), ostala
  2 prek vitest (A); mounted + className LOČENO; dispatch+poll VSAKA].
  R373 kandidati: **?INTERP ×1 preostala navy** [roksal-catalog L110 KIT template]
  ALI **ring/50 družina** [census: 14 NONE — VSE ui/* shadcn kit fokus jezik
  (accordion/badge/button/checkbox/input/navigation-menu/radio-group/scroll-area/
  select/switch/tabs/textarea/toggle) — pričakuj KIT 100% → dokumentirati kot
  shadcn jezik, BREZ sprememb] ALI **white/60 družina** [8 NONE — top-bar gosta
  površina, izjema #2 iz val 52] — vedno z fetch-first + TSV kanonom + stale-pin
  PRED-skanom + ŠTEVEC guard skenom (LEKCIJA (7)). ISSUE #1: vsa sprejemna merila ✓;
  ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **LASTNA-PREHOD GLADKOST val 67 (2 × REPL property-list nadgradnja — konflikt transition-transform + hover barvni žeton; snap → gladak BREZ aditivnega konflikta) + FEATURE PETI STRAŽAR: lastna-prehod disciplina GENERALIZACIJA (kaskadni zmagovalec, ne unija — LEKCIJA R389 (3): cva baza pokritost NIČNA, če element sam nosi ožjo transition-* utility) + val 66 POST-deploy MONTIRANO + era veriga utrjena (checkpoint guard + odpadni cenZUS + kontrole hash-fallback)** (R389): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 388`: **ZELEN ob poskusu 1** (23. runda) + **DVAINŠTIRIDESIJNA era preverba** `r389-era-harvest.sh` [42 registrov r347–r388, ≥171 = 167 + 4; generiran prek era-clone.py --src-round 388 --expected-total 171 + VSEH 12 server-probe spec-ov IZRECNO — LEKCIJA R384 (1); **era-clone.py GLASNO razširjen: ERA_BESODE na 42 + CHECKPOINT GUARD + ODPADNI CENZUS + era kontrole hash-rezolucijski fallback]**; COMPANION r389-era-ruta-map.py avtomatsko]: **EXIT=0 ×2** (determinizem) — **171/171 ŽIVO** (val 66 deploy POTRJEN — 4 needleji r388 razrešeni ob R388 pushu); must_miss ×42 čisto; ⭐ **LEKCIJA R389 (1) — Vercel Security Checkpoint**: 1. tek žetve onesnažen [večina 60 čankov = 403 'Vercel Security Checkpoint' strani po velikostni porazdelitvi; natančen števec ni vztrajen (imenik prepisan) — qa-harvest uspeh = ne-prazno telo, 403 stran JE ne-prazna; lažni MISS storm + zavajajoč 'neuspešno razrešeni']; deterministična pavza (~45s) razrešila (transient infra kategorija, NI code-bug); guard zdaj glasno aborta z diagnozo; ⭐ **LEKCIJA R389 (2) — zamrznjen URL seznam iz R339 OPADE**: 5/60 čankov = 'Not Found' telesa (Vercel je počistil 43-rundne stare artefakte) → iskren popis v žetevi + era kontrole R340–R345 dobile ISTI hash-rezolucijski fallback kot need_static (R340 kontrola ŽIV prek hash rezolucije fd2377174053c378.js); (2) **val 66 POST-deploy spot** `r389-qa-spot.sh` (spot-r171/29; ZERO-MUTACIJA): dashboard val 66 Badge navy/15 **MONTIRANO 1×** (celoten span per className split) + red/20 **MONTIRANO 1×**; setup <Link> CTA **iskreno 0** — POGOJNA resnica (CTA renderan SAMO v done stanju po uspešnem bootstrapu — ZERO-MUTACIJA ne sproži bootstrapa; needle ŽIVO v buildu = era need_static); photo PO anchor L2081 **iskreno 0** — POGOJNA (odprta fotografija); sonde navy 27/27/0 + red 0; kolektor **0**; (3) **MANDATORY STIL val 67** — sveža triaža disk resnica `r389-triaza.py` (element-točna, LEKCIJA R388 (1) kanon): handover kandidat 1 (hover-bg na nativnih elementih izven val 66 obsega: step-*/mask-editor/viz-tab/product-*) = **0 REALnih gapov** [122 že pokritih + 239 ui-kit + vse iskrene izključitve R388 potrjene na disku: termini-prikaz COLORS brez .tsx potrošnika (PDF liba uvažata SAMO STATUSI/LABELS — disk preverjeno), material-intelligence L459 baza L457 transition-colors pokritost]; kandidat 2 (notification L811 transform konflikt) = **konfliktna družina TOČNO 2** [sistematični scan: transition-transform + (group-)hover barvni žeton na istem elementu] → **2 × REPL in-place**: notification L811 `transition-transform` → `transition-[transform,color]` (group-hover:text-roksal-amber snap → gladak; aditivni transition-colors bi OVERIL transform — kaskada .transition-colors @117441 < .transition-transform @118190) + safety-tab L254 `transition-transform` → `transition-[transform,background-color,box-shadow]` (ui-kit Button baza transition-all OVERRIDANA s strani elementa @118190 > @117243 → hover:bg-roksal-navy/90 snap; po buildu arbitrary se vrsti PRED transition-all → zmagovalec baza → bg+ring+transform VSI gladki); pre-skan `r389-window-scan.py` (13. generacija; REG_DO 388; notification-center + safety-tab ŽE v TARGETS) delta +8/+30 ×transition-transform = **304 okenskih regexov 0 preozkih + 184 needle pinov 0 mrtvih + 150 slice-oknen + 0 vrstičnih odstopanj**; `r389-val67-apply.py` fail-closed [kontrakt ×2 polna stara vrstica bajtno + EVOLVED ×3 v ENEM atomskem koraku (kanon R368); POST 969+759 vrstic bajtno; ponovni tek = abort]; `r389-stil-val67.test.ts` **×4 ZELENO** [(A) PARITETA 2 tarči nadgrajena lista, (B) CENZUS preostalih 6 transition-transform vrstic NISO konfliktni, (C) EVOLVED žigi R388 testov, (D) in-place disk resnica]; (4) **FEATURE PETI STRAŽAR — lastna-prehod disciplina GENERALIZACIJA**: `r389-lasta-uzkost-generalizacija.test.ts` **×5 ZELENO** [(A) globalna kršitev = 0 čez VSE src z KASKADNO logiko (zmagovalec = najvišji rang med prisotnimi utilityji — R388 unija je bila lažno pozitivna pri ko-obstoju; kaskadni vrstni red iz zgrajenega CSS: transition < arbitrary < all < colors < opacity < shadow < transform < none); (B) ui-kit bazi zamrznjeni; (C) it.each ×2 val 67 tarče preverjene; (D) izjeme ×11 + L811/L254 kaskadno pokriti]; KOMPLET PETIH varuhov: r385 (dark FB) + r386 (O2 pairing) + r387 (FB-border) + r388 (transition pokritost) + r389 (kaskadna disciplina); (5) e2e-lib dedup 23. val ISKRENO IZPUŠČEN (kanon R368 — ni novih ×3 ponovitev). REGISTER `scripts/qa-needles/r389.tsv` [2 need_static: notification L811 + safety-tab L254 najdaljša nova spana; 0 v HEAD 2ccba6c; TODO-R389] prek `r389-register-write.py` fail-closed. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5628/5628 (373) FULL GREEN TEK 1** · build svež rm -rf .next EXIT=0 · qa-round.sh 389 needles EXIT=0 [r389.tsv 2 ŽIVO + TODO-R389 odsoten; UNION r340–r389 + veriga r339→…→R227] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · r389-era-harvest EXIT=0 ×2 [42nd — 171/171 ŽIVO] · r389-window-scan EXIT=0 [DEL 1–4 čisti] · r359-prod-qa-retry 388 ZELEN poskus 1 · leak-check čist [ghp_[A-Za-z0-9]{30,} ×0]. NOVO: scripts/qa-needles/r389.tsv + skripte [r389-era-harvest.sh (42nd) + r389-era-ruta-map.py (COMPANION), r389-qa-spot.sh, r389-triaza.py, r389-val67-apply.py, r389-window-scan.py (13. gen), r389-register-write.py, r389-readme-update.py, r389-worklog-append.py, r389-commit-msg.txt] + r389-stil-val67.test.ts [×4] + r389-lasta-uzkost-generalizacija.test.ts [×5 — FEATURE]; UREJENO: 2 render datoteki [val 67 REPL ×2: notification-center L811, safety-tab L254], r388-stil-val66.test.ts [EVOLVED (C) L811 pin], r388-hover-gladkost-generalizacija.test.ts [EVOLVED izjeme ×12→×11], era-clone.py [ERA_BESODE +42 GLASNO + CHECKPOINT GUARD + ODPADNI CENZUS + kontrole fallback], README. Kontrakt NIČ (/api/sync — probe je samo fail-closed 401 branje); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 67 = render plast className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme s strani QA [ZERO-MUTACIJA E2E; njihova shema = njihova poslovna odločitev]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (83. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R390 prva naloga = qa-round.sh 389 prod-qa re-run [prek r359-prod-qa-retry.sh 389] + triinštirideseta era preverba r347–r389 [43 registrov, ≥173 = 171 + 2; prek era-clone.py --src-round 389 --expected-total 173 + VSEH 12 spec-ov IZRECNO — LEKCIJA R384 (1)]; pričakuj 173/173 ŽIVO [r389 2 needleja razrešena ob TEM pushu] + val 67 POST-deploy verifikacija [2 needleji r389.tsv; mounted + className LOČENO; NIČ klikov na revoke/odjavo; notification sheet vrstice se samo MERIJO (ZERO-MUTACIJA kanon); safety-tab 'Kopiraj varnostno poročilo' gumb je mutacija (clipboard) — SAMO className split MERITEV brez klika]. R390 kandidati: 1. stil družina IZČRPANA za transition/hover-roksal [val 67 disk resnica: 0 realnih gapov preostalih] → sveža triaža nove družine ALI iskreno izpuščeno val [kanon]; 2. L811/L254 POST-deploy spot + arbitrary kaskadna pozicija v SVEŽEM buildu [disk resnica komentar v r389 feature testu — preveriti vrstni red na novem CSS]; 3. e2e-lib dedup 23. val [po kanonu — ni novih ×3 ponovitev]. ⭐ LEKCIJE R389: (1) Security Checkpoint 403 onesnaži žetev (ne-prazno telo!) — glasni guard + deterministična pavza; (2) zamrznjen URL seznam odpada — hash-fallback obvezen POVSEK; (3) cva baza pokritost NIČNA ob ožji elementni utility — kaskadni zmagovalec, ne unija. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **HOVER-BARVNA GLADKOST val 66 (21 × INS transition-colors — snap hover → gladak na nativnih interaktivnih elementih + Badge hover:bg družina) + FEATURE ČETRTI STRAŽAR: hover gladkost GENERALIZACIJA (transition pokritost čez VSE src) + val 65 POST-deploy MONTIRANO 10×** (R388): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 387`: **ZELEN ob poskusu 2** (22. runda; poskus 1 = znana transient kategorija R358/R359) + **ENAINŠTIRIDESIJNA era preverba** `r388-era-harvest.sh` [41 registrov r347–r387, ≥167 = 163 + 4; generiran prek era-clone.py --src-round 387 --expected-total 167 + VSEH 12 server-probe spec-ov IZRECNO — LEKCIJA R384 (1); **era-clone.py ERA_BESODE GLASNO razširjena na 41** (guard zahteval)]; COMPANION r388-era-ruta-map.py avtomatsko]: **EXIT=0 ×2** (determinizem) — **167/167 ŽIVO** (val 65 deploy POTRJEN — 4 needleji r387 razrešeni ob R387 pushu); must_miss ×41 čisto; (2) **val 65 POST-deploy spot** `r388-qa-spot.sh` (spot-r167/28; ZERO-MUTACIJA — NIČ klikov na revoke/izvoz/odjavo/obvestilne vrstice): notification L748 vrstica **MONTIRANO 10×** na produ (vseh 20 tokenov LOČENO per className split incl. FB amber/60 + dark FB amber/40 + dark ring /40) + **seam adjacency 10×** (dokaz vstavitve MED offset-2 in dark ringom) + PAR žeton 10×; photo STROKES 'Debelina črte' (L2113) **iskreno 0** — POGOJNA resnica (uredjevalnik zahteva odprto fotografijo; needle ŽIVO v buildu = era need_static); sonde navy 27/27/0 + red 0; kolektor **0**; (3) **MANDATORY STIL val 66** — sveža triaža disk resnica `r388-triaza*.py` [handover kandidati iskreno ZAMRZNJENI: plain amber ring ostanki = 9 (semantično stanja: izbor/status — NI pariteta tema), mrtev-CSS navy = 82 (ring+offset BREZ border širine → border-pariteta bi bila mrtva CSS; handover ocena ×20 zastarela — disk resnica), dark-only ring pari = 1 (L748 seed; druge družine izčrpane), hover-border transition census 16/16 lažno pozitivnih (baza nosi transition-all)] → NOVA družina z REALnim vizualnim učinkom: **21 × INS ' transition-colors' TIK okoli hover žetona** (PRE anchor ×19 + PO anchor ×2 — dashboard L2941 + photo L2081, kjer je PRE span PINAN v zamrznjenih prod-qa skriptah r313–r339 + r315-stil-val6; PO vstavljanje ohranja span → brez shifta zamrznjenih skript), in-place 0 novih vrstic ×8 datotek [dashboard ×11 Badge hover:bg družina — Badge baza 'transition-[color,box-shadow]' NE pokrije background-color + termini-card ×1 + setup/aktivacija nativna <Link> CTA + viz-tab/product-home mobilni gumbi + photo ×3 + measurements Trash2 ikoni ×2]; iskrene izključitve dokumentirane: mrtvi hover žetoni (hover:bg == bg ×4 + pointer-events-none ×2), mrtvi izvozi termini-prikaz ×4, notification L811 transition-transform konflikt (NI aditivno rešljiv); ⭐ **LEKCIJA R368 KANON (PIN SHIFT V ISTI RUNDI)**: r211-fail-verbose-detail-strazar.test.ts je pinil celoten className L2459+L2602 → **PIN SHIFT ×2 V ISTI RUNDI** (faza 2 `r388-val66-apply.py`, žig [PIN SHIFT R388 val 66]); ⭐ **element-točna triaža** (r388-triaza5.py): per-vrstični census je lažno pozitiven (className pokončinene vrstice + cva baze) — pokritost se preverja na NIVOU ODPIRALNEGA TAGA; pre-skan `r388-window-scan.py` (12. generacija iz r383; TARGETS +4: setup-client/activation-client/viz-tab/product-home; REG_DO 387) delta 18 ×9 hover žetonov = **304 okenskih regexov 0 preozkih + 180 needle pinov 0 mrtvih + 133 slice-oknen + 0 vrstičnih odstopanj**; polni-span pre-skan (pre+hover) ujel 6 pinov → ankor per vrstica izbran po disk resnici; `r388-stil-val66.test.ts` **×6 ZELENO** [(A) PARITETA 21 tarč, (B) CENZUS per datoteka + PO spans ×2, (C) N/A izključitve bajtno, (D) ZAMRZNJENE STATISTIKE plain 9/navy 82/dark-pair 1, (E) r211 PIN SHIFT regresija novi ×2 + stari 0, (F) in-place ×8 + r387 seam needle ŽIVO]; FULL vitest tek 1 ujel **r377-stil-val58 stale števec** (transition-colors 12 → 23) → EVOLVED V ISTI RUNDI [LEKCIJA R386 (2) ponovno potrjena — counter-pini ne nosijo hover žetona, jih boundary pre-skan NE vidi]; (4) **FEATURE ČETRTI STRAŽAR — hover gladkost GENERALIZACIJA**: `r388-hover-gladkost-generalizacija.test.ts` **×10 ZELENO** [(A) globalna kršitev = 0 čez VSE src z element-točno pokritostno logiko (najdiTag + pokritost — zrcali r388-triaza5.py); (B) ui-kit bazi zamrznjeni (Button transition-all + Badge transition-[color,box-shadow] — shadcn jezik NI mutiran); (C) it.each per datoteka val 66 tarče]; KOMPLET ŠTIRIH varuhov: r385 (dark FB) + r386 (O2 pairing) + r387 (FB-border) + r388 (transition pokritost); (5) e2e-lib dedup 22. val ISKRENO IZPUŠČEN (kanon R368 — ni novih ×3 ponovitev). REGISTER `scripts/qa-needles/r388.tsv` [4 need_static: setup/aktivacija <Link> CTA (ožji žeton — m/[token] measure-client L322 nosi ISTI span ŽE v HEAD = obstoječ precedens gladkosti), dashboard Badge navy/15, photo PO anchor dokaz, dashboard red/20 + r211 žig; 0 v HEAD 30f9864; TODO-R388] prek `r388-register-write.py` fail-closed. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5619/5619 (371) FULL GREEN TEK 2** [tek 1 = 5618/5619 — r377 stale števec ujet + EVOLVED V ISTI RUNDI] · build svež rm -rf .next EXIT=0 · qa-round.sh 388 needles EXIT=0 [r388.tsv 4 ŽIVO + TODO-R388 odsoten; UNION r340–r388 + veriga r339→…→R227] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · r388-era-harvest EXIT=0 ×2 [41st — 167/167 ŽIVO] · r388-window-scan EXIT=0 [DEL 1–4 čisti] · r359-prod-qa-retry 387 ZELEN poskus 2 · leak-check čist [ghp_[A-Za-z0-9]{30,} ×0]. NOVO: scripts/qa-needles/r388.tsv + skripte [r388-era-harvest.sh (41st) + r388-era-ruta-map.py (COMPANION), r388-qa-spot.sh, r388-triaza.py, r388-triaza2/3/4/5.py, r388-val66-apply.py, r388-window-scan.py (12. gen), r388-register-write.py, r388-readme-update.py, r388-worklog-append.py, r388-commit-msg.txt] + r388-stil-val66.test.ts [×6] + r388-hover-gladkost-generalizacija.test.ts [×10 — FEATURE]; UREJENO: 8 render datotek [val 66 INS ×21: dashboard ×11, photo ×3, measurements ×2, termini-card ×1, viz-tab ×1, product-home ×1, setup ×1, aktivacija ×1], r211-fail-verbose-detail-strazar.test.ts [PIN SHIFT ×2], r377-stil-val58.test.ts [EVOLVED števec], README. Kontrakt NIČ (/api/sync — probe je samo fail-closed 401 branje); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 66 = render plast className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme s strani QA [ZERO-MUTACIJA E2E; njihova shema = njihova poslovna odločitev]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (82. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R389 prva naloga = qa-round.sh 388 prod-qa re-run [prek r359-prod-qa-retry.sh 388] + dvainštirideseta era preverba r347–r388 [42 registrov, ≥171 = 167 + 4; prek era-clone.py --src-round 388 --expected-total 171 + VSEH 12 spec-ov IZRECNO — LEKCIJA R384 (1)]; pričakuj 171/171 ŽIVO [r388 4 needleji razrešeni ob TEM pushu] + val 66 POST-deploy verifikacija [4 needleji r388.tsv; mounted + className LOČENO; NIČ klikov na revoke/odjavo; PO-anchor needle (photo CSV gumb) montiran NA ODPRTI površini; setup/aktivacija <Link> so PRED prijavo — spot vzorec izklopljenega stanja ali iskreno 0 z razlogom]. R389 kandidati: 1. hover-bg gladkost ZAKLJUČEK — hover:bg-roksal na nativnih elementih še izven val 66 obsega (26 preostalih iz triaze: setup/aktivacija §2 vrste, step-* čarovnik, product-*, mask-editor, viz-tab L143/152/164) [sveža triaža; isti PRE/PO ankor kanon]; 2. notification L811 transition-transform konflikt [property-list nadgradnja 'transition-[transform,color]' — NI aditivno; lasten val z EVOLVED (C)]; 3. e2e-lib dedup 23. val [po kanonu]. ⭐ LEKCIJE R386/R387/R388: lookbehind čez VSE preverbe + pre-skan stil testov VSEH prejšnjih vals + pre-skan TUDI zamrznjenih needle skript scripts/*.sh + PIN SHIFT V ISTI RUNDI + **counter-pini (številski števci žetonov) jih boundary pre-skan NE vidi — FULL vitest tek 1 je mreža; EVOLVED V ISTI RUNDI**. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **AMBER/60 border-pariteta val 65 (2 × INS + 11 × PIN SHIFT zamrznjenih needle skript — amber simetrija TRETJIČ zaključena: /50+/40+/60) + FEATURE FB-BORDER pariteta stražar GENERALIZACIJA (tretji varuh: bordered+O2 ring vrstica nosi FB iste barve) + val 64 POST-deploy MONTIRANO** (R387): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 386`: **ZELEN ob poskusu 2** (21. runda; poskus 1 = znana transient kategorija R358/R359) + **ŠTIRIDESIJNA era preverba** `r387-era-harvest.sh` [40 registrov r347–r386, ≥163 = 159 + 4; generiran prek era-clone.py --src-round 386 --expected-total 163 + VSEH 12 server-probe spec-ov IZRECNO — LEKCIJA R384 (1); COMPANION r387-era-ruta-map.py avtomatsko]: **EXIT=0 ×2** (determinizem) — **163/163 ŽIVO** (val 64 deploy POTRJEN — 4 needleji r386 razrešeni ob R386 pushu); must_miss ×40 čisto; (2) **val 64 POST-deploy spot** `r387-qa-spot.sh` (spot-r167/27; ZERO-MUTACIJA — NIČ klikov na revoke/izvoz/odjavo/filter): dashboard 'Brez dobavitelja' kartica (L1946) **1/1 MONTIRANO** (20 tokenov LOČENO) + vodja kartica (L2093) **1/1 MONTIRANO** (20 tokenov) + measurements 'Poglej foto mero' (L3478) **iskreno 0** — POGOJNA resnica (brez foto mer v seznamu; needle ŽIVO v buildu = era need_static); sonde navy 4/4/0 + red 0; kolektor **0**; (3) **MANDATORY STIL val 65** — disk resnica `r387-triaza.py` [2 tarče border-class (notification L748 border-border/60 + hover amber — ring par light /60 + dark /40 ŽE na vrstici; photo L2113 nativni 'border' s pogojnima veja border-roksal-amber/border-white/20 — trajno temna površina bg-roksal-navy), obe z O2; 1 N/A (photo L2414 — brez borderja in brez sorojenca z FB); 0 anomalij] → **2 × INS ' focus-visible:border-roksal-amber/60 dark:focus-visible:border-roksal-amber/40' TIK ZA O2, in-place** — dark /40 po DVEH skladiščih resnice: notification L748 lasten dark ring JE /40 (FB sledi SVOJI ring pari) + crm-tab L811 precedens val 64; /30 je par /50+/30 (namenjen /50 družini val 63); /60 NIMA lastnega dark border para → /40 UNIFORMNO za celo družino; ⭐ **LEKCIJA R368 KANON (PIN SHIFT V ISTI RUNDI)**: L748 sosednost 'ring-offset-2 dark:focus-visible:ring-roksal-amber/40' je PINANA v 11 zamrznjenih needle skriptah (r245–r255) → **PIN SHIFT VSEH 11 V ISTI RUNDI** (faza 2 `r387-val65-apply.py`, žig [PIN SHIFT R387 val 65]) + r368-stil-val51 (C) novObv EVOLVED; apply fail-closed [kontrakt ×2 + PIN SHIFT ×11 v ENEM atomskem koraku; POST closure lookbehind — LEKCIJA R386 (1); ponovni tek = 0 INS / 0 SHIFT]; pre-skan `r383-window-scan delta 79 'ring-amber/60 offset-2'` = 304 regexov 0 preozkih + 164 pinov 0 mrtvih + 133 slice-oknen + 0 odstopanj; ⭐ **LEKCIJA R386 (2) upoštevana**: r385-stil-val63 (E) + r386-stil-val64 (E) EVOLVED [L748+L2113 izven-obsega → EVOLVED z pozitivno FB preverbo; L2414 ostaja izven]; r368 (A)/(B) ring števci nespremenjeni; `r387-stil-val65.test.ts` **×6 ZELENO** [(A) PARITETA 2 tarče, (B) DARK PAR 2/2 + regresija 15/15+3+16+159, (C) N/A L2414 bajtno, (D) ostanek 0 + in-place 2684/969, (E) REGRESIJA PIN SHIFT 11/11 nov pin + 0 star, (F) amber/60 ring vrstic = 3 + NASLEDNICA navy ŽIVO]; (4) **FEATURE FB-BORDER pariteta stražar GENERALIZACIJA** (TRETJI varuh — skupaj z r385 dark FB + r386 O2 varuhom pokriva celoten FB jezik): `r387-fb-border-generalizacija.test.ts` **×6 ZELENO** [it.each per barva (navy/red/amber): vsaka ring-2+O2+border vrstica z barvnim ringom nosi FB ISTE barve — kršitve 0; števci zamrznjeni navy 159 / red 16 / amber 20; obrnjena regresija 0 sirot FB brez ringa; N/A vrstici iskreno izven]; komplement `r385-fb-dark-generalizacija` **EVOLVED R387** [+družina amber/60→dark/40; deljen dark žeton /40 — skupni PAR 3+2==5; BREZ SIROT svetlobaDružine +amber/60]; (5) e2e-lib dedup 21. val ISKRENO IZPUŠČEN (kanon R368 — ni novih ×3 ponovitev). REGISTER `scripts/qa-needles/r387.tsv` [4 need_static: notification L748, photo L2113, družinski PAR žeton ×2, seam adjacency dark-FB→dark-ring; 0 v HEAD 3969bca; TODO-R387] prek `r387-register-write.py` fail-closed. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5603/5603 (369) FULL GREEN TEK 1** · build svež rm -rf .next EXIT=0 · qa-round.sh 387 needles EXIT=0 [r387.tsv 4 ŽIVO + TODO-R387 odsoten; UNION r340–r387 + veriga r339→…→R227] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA] · r387-era-harvest EXIT=0 ×2 · r383-window-scan EXIT=0 · r359-prod-qa-retry 386 ZELEN poskus 2 · leak-check čist. NOVO: scripts/qa-needles/r387.tsv + skripte [r387-era-harvest.sh (40th) + r387-era-ruta-map.py (COMPANION), r387-qa-spot.sh, r387-triaza.py, r387-val65-apply.py, r387-register-write.py, r387-readme-update.py, r387-worklog-append.py, r387-commit-msg.txt] + r387-stil-val65.test.ts [×6] + r387-fb-border-generalizacija.test.ts [×6 — FEATURE]; UREJENO: 2 render datoteki [val 65 INS ×2: notification-center L748, photo-tab L2113], 11 zamrznjenih needle skript [PIN SHIFT R387 val 65: r245–r255-build-needles.sh], r368-stil-val51.test.ts [EVOLVED (C) novObv], r385-fb-dark-generalizacija.test.ts [EVOLVED amber/60], r385-stil-val63.test.ts [EVOLVED (E)], r386-stil-val64.test.ts [EVOLVED (B)+(E)], README. Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 65 = render plast a11y className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme [ZERO-MUTACIJA E2E]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (81. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R388 prva naloga = qa-round.sh 387 prod-qa re-run [prek r359-prod-qa-retry.sh 387] + enainštirideseta era preverba r347–r387 [41 registrov, ≥167 = 163 + 4; prek era-clone.py --src-round 387 --expected-total 167 + VSEH 12 spec-ov IZRECNO — LEKCIJA R384 (1)]; pričakuj 167/167 ŽIVO [r387 4 needleji razrešeni ob TEM pushu] + val 65 POST-deploy verifikacija [4 needleji r387.tsv; mounted + className LOČENO; NIČ klikov na revoke/odjavo; spot vzorci iz spot-r167/27 — POGOJNE resnice (brezDobavitelja > 0; foto mere) dokumentirane]. R388 kandidati: 1. plain amber ring ostanki ×4 + mrtev-CSS navy ×20 statistika [sveža triaža, morda zamrznjeno — statistika brez vizualnega učinka NE sme biti delana zaradi dela]; 2. dark-only ring pari (notification L748 vzorec /60+/40) čez druge družine [sveža triaža]; 3. e2e-lib dedup 22. val [po kanonu]. ⭐ LEKCIJI R386 (1) + (2) upoštevati: lookbehind čez VSE preverbe + pre-skan stil testov VSEH prejšnjih vals iste družine (r368+r375+r385+r386+r387) + PIN SHIFT zamrznjenih needle skript V ISTI RUNDI (kanon R368). ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **AMBER/40 border-pariteta val 64 (3 × INS s dark PAR v enem koraku — amber simetrija zaključena) + FEATURE O2 pairing stražar GENERALIZACIJA (vsak barvni focus ring nosi O2) + val 63 POST-deploy 5/5 MONTIRANO** (R386): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 385`: **ZELEN ob poskusu 1** (20. runda) + **DEVETINTRIDESIJNA era preverba** `r386-era-harvest.sh` [39 registrov r347–r385, ≥159 = 155 + 4; generiran prek era-clone.py --src-round 385 --expected-total 159 + VSEH 12 server-probe spec-ov — LEKCIJA R384 (1); COMPANION r386-era-ruta-map.py avtomatsko]: **EXIT=0 ×2** — **159/159 ŽIVO** (val 63 deploy POTRJEN — 4 needleji r385 razrešeni); must_miss ×39 čisto; (2) **val 63 POST-deploy spot** `r386-qa-spot.sh` (spot-r167/26; ZERO-MUTACIJA — NIČ klikov na revoke/izvoz/odjavo): vodja 'Izvozi dnevni pregled' (L1213) **1/1 MONTIRANO** (16 tokenov LOČENO) + 'Izvozi pregled AI rabe' CSV pilula (L1475) **1/1** (17 tokenov incl. dark:border-roksal-ink/25 rep) + photo kategorija filtri (L740) **3/3 MONTIRANO** (13 tokenov); inclinometer 'Poskusi znova nagibe' (L539) **iskreno 0** [historyError vrata — needle ŽIVO v buildu = era need_static]; sonde navy 0 + red 0 (izven main na teh površinah); kolektor **0**; (3) **MANDATORY STIL val 64** — disk resnica `r386-triaza.py` [3 tarče border-class (dashboard L1946 + measurements L3478 + vodja L2093 — rdeči dvojček L2122 FB od val 62), vseh 3 z O2; 2 N/A (L1749, L3329); 21 izven obsega (amber/50 zaključen val 63 + amber/60 prihodnji val); 0 anomalij; **⭐ dark-polovica lookbehind fix v triaži**: notification L748 'dark:focus-visible:ring-roksal-amber/40' NI član /40 družine — light ring je /60] → **3 × INS ' focus-visible:border-roksal-amber/40 dark:focus-visible:border-roksal-amber/40' TIK ZA O2 na 3 datotekah, in-place** — dark /40 po družinskem precedensu z ISTO intenziveto: **crm-tab L811 'dark:border-roksal-amber/40' Card** (edini obstoječi dark amber/40 border; amber ostane amber — NI ink); `r386-val64-apply.py` fail-closed [kontrakt ×3, POST closure lookbehind + in-place + needle survival — **0 mrtvih: r368 N3 needle ŽIVO prek L3329** (grep binarno)]; pre-skan `r383-window-scan delta 79 'ring-amber/40 offset-2'` = 0 preozkih + 0 mrtvih + 0 odstopanj; `r386-stil-val64.test.ts` **×6 ZELENO** [(A) PARITETA 3 tarče, (B) DARK PAR 3/3 + val 63 15/15 regresija, (C) N/A 2 bajtno, (D) ostanek 0 + in-place 3188/6232/2199, (E) amber/60 3 nedotaknjene + red 16/16 + navy 159/159, (F) bordered-brez-FB 0 + r368 N3 ŽIVO + NASLEDNICA navy ŽIVO]; ⭐ **LEKCIJA R386 (1) — lookbehind discipline čez cele teste**: (D)/(F) substring check `includes('ring-amber/40')` je lažno ujel L748 dark polovico → AMB40_LIGHT regex `(?<!dark:)` (LEKCIJA R384 (2) generalizacija: dark: token VSEBUJE light podniz VSAKIH preverb, ne samo closure števcev); ⭐ **LEKCIJA R385 (1) upoštevana**: r368-stil-val51 (B) N3 pin PIN SHIFTAN V ISTI RUNDI [stari adjacency 2→1 — L3329 ohrani; EVOLVED adjacency ×1 — L3478]; (4) **FEATURE O2 pairing stražar GENERALIZACIJA**: `r386-ring-o2-generalizacija.test.ts` **×5 ZELENO** [per-družina (navy/red/amber): vsaka focus-ring vrstica nosi O2 — razcep = 0; FROZEN izjema #2 roksal-catalog L95 <Input> dokumentirana + TOČNO 1; globalna števca zamrznjena navy 237 / red 25 / amber 26]; komplement `r385-fb-dark-generalizacija` **EVOLVED** [amber PAR seznam razširjen na /50+/40 — disk 159/16/15+3; sirota preverba na družinski ravni (katerakoli intenziveta)]; komplement `r385-stil-val63` (E) **EVOLVED** [amber/40 tarče prestavljene iz izven-obsega v EVOLVED z FB preverbo]; (5) e2e-lib dedup 20. val ISKRENO IZPUŠČEN (kanon R368 — ni novih ×3 ponovitev). REGISTER `scripts/qa-needles/r386.tsv` [4 need_static: dashboard L1946, measurements L3478, vodja L2093, družinski PAR žeton ×3; 0 v HEAD 666a7cc; TODO-R386] prek `r386-register-write.py` fail-closed. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5590/5590 (367) FULL GREEN** · build svež rm -rf .next EXIT=0 · qa-round.sh 386 needles EXIT=0 [r386.tsv 4 ŽIVO + TODO-R386 odsoten; UNION r340–r386 + veriga] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA] · r386-era-harvest EXIT=0 ×2 · r383-window-scan EXIT=0 · r359-prod-qa-retry 385 ZELEN poskus 1 · leak-check čist. NOVO: scripts/qa-needles/r386.tsv + skripte [r386-era-harvest.sh (39th) + r386-era-ruta-map.py (COMPANION), r386-qa-spot.sh, r386-triaza.py, r386-val64-apply.py, r386-register-write.py, r386-readme-update.py, r386-worklog-append.py, r386-commit-msg.txt] + r386-stil-val64.test.ts [×6] + r386-ring-o2-generalizacija.test.ts [×5 — FEATURE]; UREJENO: 3 render datotek [val 64 INS ×3: dashboard-tab, measurements-tab, vodja-dashboard], r368-stil-val51.test.ts [PIN SHIFT N3], r385-fb-dark-generalizacija.test.ts [EVOLVED amber/40], r385-stil-val63.test.ts [EVOLVED (E)], README. Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 64 = render plast a11y className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme [ZERO-MUTACIJA E2E]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (81. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R387 prva naloga = qa-round.sh 386 prod-qa re-run [prek r359-prod-qa-retry.sh 386] + štirideseta era preverba r347–r386 [40 registrov, ≥163 = 159 + 4; prek era-clone.py --src-round 386 --expected-total 163 + VSEH 12 spec-ov IZRECNO]; pričakuj 163/163 ŽIVO [r386 4 needleji razrešeni ob TEM pushu] + val 64 POST-deploy verifikacija [4 needleji r386.tsv; mounted + className LOČENO; NIČ klikov na revoke/odjavo; vodja/photo vzorci iz spot-r167/26]. R387 kandidati: 1. amber/60 border-pariteta [zadnja amber pod-družina: notification L748 (border-border/60 token + hover amber; ring par svetlo/temno že na vrstici), photo L2113 (border + ring /60 brez dark) — sveža triaža obvezna; dark polovica po precedensu notification ring dark /40]; 2. NADALJEVANJE posameznih ring-only ostankov po statistiki (plain amber ×4, navy dark-only ringi …) [sveža triaža]; 3. e2e-lib dedup 21. val [po kanonu]. ⭐ LEKCIJI R385 (1) + R386 (1) upoštevati: amber dela pre-skaniat r368-stil (B) pine + lookbehind čez VSE preverbe. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **AMBER/50 border-pariteta val 63 (15 × INS s dark PAR v enem koraku) + FEATURE r166 dark stražar GENERALIZACIJA (vsi barvni FB pari) + val 62 POST-deploy 41/41 MONTIRANO** (R385): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 384`: **ZELEN ob poskusu 2** (19. runda; poskus 1 = znana transient kategorija R358/R359, retry wrapper po kanonu) + **OSEMINTRIDESIJNA era preverba** `r385-era-harvest.sh` [38 registrov r347–r384, ≥155 = 151 + 4; generiran prek era-clone.py --src-round 384 --expected-total 155 + **VSEH 12 server-probe spec-ov IZRECNO — LEKCIJA R384 (1)**; COMPANION r385-era-ruta-map.py avtomatsko]: **EXIT=0 ×2** (determinizem) — **155/155 ŽIVO** (direktno + hash + 18 server resolucij); must_miss ×38 čisto; (2) **val 62 POST-deploy spot** `r385-qa-spot.sh` (spot-r167/25; ZERO-MUTACIJA — NIČ klikov na revoke/odjavo/preklic): sessions-dialog 'Prekliči sejo na napravi' **41/41 MONTIRANO** (15 tokenov LOČENO — FB 41/41 + dark 41/41; Escape → 0); dashboard 'Poskusi znova' **iskreno 0** (invError/narocilaError zahtevata padel fetch — ZERO-MUTACIJA: napak ni iskreno sprožiti; needle ŽIVO v buildu = era need_static) + measurements **iskreno 0** (osnutki per-projekt localStorage; spot račun 0 projektov — kanon r277; semena brez projectId NE možna: draftsKey fail-closed) + vodja 'Zamujena dobava' **iskreno 0** (DB resnica; 0 projektov); sonde navy 4/4/0 + red 0; kolektor **0**; (3) **MANDATORY STIL val 63** — disk resnica `r385-triaza.py` [15 tarč z VIDLJIVIM borderjem = 14 border-class (vodja ×13 border-roksal-navy/25 + hover:border-roksal-amber; photo L740 nativni) + 1 outline-variant (inclinometer L539), vseh 15 z O2; 3 N/A iskreno izključeni (inclinometer L433, inventory L1229, photo L1162); **8 IZVEN obsega** — amber/40 + amber/60 pod-družini dokumentirani za prihodnja vala (kanon ena-intenziveta-na-val); 0 anomalij] → **15 × INS ' focus-visible:border-roksal-amber/50 dark:focus-visible:border-roksal-amber/30' TIK ZA O2 na 3 datotekah, in-place** — LEKCIJA R383 (2) v apply: PAR v ENEM koraku; **dark /30 po ISTEM pravilu kot rdeča val 62: sledi družinskemu obstoječemu light+dark border paru z ISTO light intenziveto — audit-trail L53 'border-roksal-amber/50 dark:border-roksal-amber/30'** (amber ostane amber — barva je pomen, NI ink); `r385-val63-apply.py` fail-closed [negativni lookbehind — LEKCIJA R384 (2); mid-line idempotenca — LEKCIJA R384 (3); ponovni tek = 0 INS dokazan]; pre-skan `r383-window-scan.py delta 79 'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2'` = 304 regexov 0 preozkih + 164 pinov 0 mrtvih + 133 slice-oknen + 0 odstopanj → **0 PIN SHIFT**; `r385-stil-val63.test.ts` **×6 ZELENO** [(A) vzorci FB+dark TIK ZA O2, (B) dark PAR 15/15, (C) N/A 3 bajtno, (D) ostanek 0 + in-place 2199/2684/599, (E) izven-obsega 8 + regresija red 16/16 navy 159/159, (F) bordered-brez-FB 0 + NASLEDNICA ŽIVO]; (4) **FEATURE r166 dark stražar GENERALIZACIJA** (kandidat 2): `r385-fb-dark-generalizacija.test.ts` **×5 ZELENO** [per-družina: vsaka vrstica z light FB žetonom nosi dark par NA ISTI vrstici (navy→ink/40, red→red/50, amber→amber/30) + globalna pariteta števcev **159/16/15** light==dark + obrnjena regresija brez sirot]; (5) e2e-lib dedup 19. val ISKRENO IZPUŠČEN (kanon R368 — ni novih ×3 ponovitev). REGISTER `scripts/qa-needles/r385.tsv` [4 need_static: vodja L1213 ×4 (sorojenci kanon), vodja L1475 ×9 (h-6 izvozi), photo L740, inclinometer L539; 0 v HEAD c235e90; TODO-R385] prek `r385-register-write.py` fail-closed. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5578/5578 (365) FULL GREEN** · build svež rm -rf .next EXIT=0 · qa-round.sh 385 needles EXIT=0 [r385.tsv 4 ŽIVO + TODO-R385 odsoten; UNION r340–r385 + veriga] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA] · r385-era-harvest EXIT=0 ×2 · r383-window-scan EXIT=0 · r359-prod-qa-retry 384 ZELEN poskus 2 · leak-check čist. NOVO: scripts/qa-needles/r385.tsv + skripte [r385-era-harvest.sh (38th), r385-era-ruta-map.py (COMPANION), r385-qa-spot.sh, r385-triaza.py, r385-val63-apply.py, r385-register-write.py, r385-readme-update.py, r385-worklog-append.py, r385-commit-msg.txt] + r385-stil-val63.test.ts [×6] + r385-fb-dark-generalizacija.test.ts [×5]; UREJENO: 3 render datotek [val 63 INS ×15: vodja-dashboard, photo-tab, inclinometer-tab], README. Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 63 = render plast a11y className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme [ZERO-MUTACIJA E2E]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (81. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R386 prva naloga = qa-round.sh 385 prod-qa re-run [prek r359-prod-qa-retry.sh 385] + devetintrideseta era preverba r347–r385 [39 registrov, ≥159 = 155 + 4; prek era-clone.py --src-round 385 --expected-total 159 + VSEH 12 spec-ov IZRECNO — LEKCIJA R384 (1)]; pričakuj 159/159 ŽIVO [r385 4 needleji razrešeni ob TEM pushu] + val 63 POST-deploy verifikacija [4 needleji r385.tsv; mounted + className LOČENO; NIČ klikov na revoke/odjavo]. R386 kandidati: 1. amber/40 border-pariteta [pod-družina izven obsega val 63: dashboard L1946, measurements L3478, vodja L2093 — sveža triaža obvezna]; 2. amber/60 border-pariteta [notification L748, photo L2113/L2414 — ring par svetlo/temno že obstaja na L748]; 3. e2e-lib dedup 20. val [po kanonu]. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **RED/40 border-pariteta val 62 (16 × INS s dark PAR v enem koraku) + FEATURE PAR-sorojenci čuvaj (trajen živ test) + LEKCIJA R384 (1) era-clone spec-list** (R384): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 383`: **ZELEN ob poskusu 1** (18. runda) + **SEDEMINTRIDESIJNA era preverba** `r384-era-harvest.sh` [37 registrov r347–r383, ≥151 = vsota iz diska; generiran prek era-clone.py --src-round 383 --dst-round 384 --dst-label "R383 val 61" --dst-chain-seg "IN r382.tsv ×5 IN r383.tsv val 61 ×4 na" + VSEH 12 server-probe spec-ov (11 + nov AK|/api/sync|401); COMPANION r384-era-ruta-map.py avtomatsko]: **EXIT=0 ×2** — **151/151 ŽIVO = 127 direktno + 6 hash + 18 server resolucij**; ⭐ **LEKCIJA R384 (1): era-clone --server-probe MENJA spec list, NE dopolnjuje** — prvotni tek z 1 specom EXIT=2 (18 server needlejev brez pokritih registrakov), popravek z VSEH 12 + fail-closed rm+regeneracija; (2) **val 61 POST-deploy spot** `r384-qa-spot.sh` (mounted + className LOČENO; ZERO-MUTACIJA): calculator izvoz zgodovine **11/11 tokenov MONTIRANO** (vrata: net-zero localStorage semena 'roksal_calc_history' — original obnovljen) + sessions 'Zapri' **6/6 + Escape → 0**; ekipa **iskreno 0** (canRead gate: /api/users HTTP 403 — programatsko dokumentirano) + material **iskreno 0** ('Izberi projekt' — spot račun 0 projektov, kanon r277); kolektor **0**; LEKCIJA: more-tab dispatch zahteva `{"tab":"more","more":"ekipa"}` (tiho brez učinka sicer); (3) **MANDATORY STIL val 62** — disk resnica `r384-triaza.py` [16 tarč z VIDLJIVIM borderjem (border-roksal-red/N override na Button outline ALI eksplicitni border), vseh 16 z O2; 9 N/A iskreno izključenih; 0 anomalij] → **16 × INS ' focus-visible:border-roksal-red/40 dark:focus-visible:border-roksal-red/50' TIK ZA O2 na 9 datotekah, in-place** — **LEKCIJA R383 (2) v apply: PAR v ENEM koraku** (dark /50 po precedensu team L619 — rdeča ostane rdeča, NI ink); `r384-val62-apply.py` fail-closed; ⭐ LEKCIJE: dark: token VSEBUJE light podniz → closure števec rabi `(?<!dark:)`; idempotenca je MED-vrstična (vstavljanje pred končnim navedkom); needle-survival fallback MORA pokrivati .ts server rute (20 API needlejev lažno mrtvih nad .tsx-only); pre-skan `r383-window-scan.py delta 75 'focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'` [eksaktna pozicija] = 0 preozkih + 0 mrtvih → **0 PIN SHIFT** (potrjeno tek 1 GREEN); `r384-stil-val62.test.ts` **×6 ZELENO** [(A) vzorci FB+dark TIK ZA O2, (B) dark PAR 16/16, (C) N/A 9 bajtno, (D) ostanek 0 + in-place, (E) obrnjena regresija navy 159+159 + red KANON ×25 + top-bar 3+2, (F) bordered-brez-FB 0 + NASLEDNICA ŽIVO]; (4) **FEATURE PAR-sorojenci čuvaj** (kandidat 3; LEKCIJA R382 (2) kot ŽIV test): `r384-triaza.py` sorojenska detekcija + `r384-sorojenci-par.test.ts` **×3 ZELENO** [FB uniformost znotraj bajtnih PAR skupin čez VSE roksal; top-bar meni 3 navy + 2 red vsi brez FB = uniformno; red-red dvojčka dashboard L1914↔L2059 oba parirana]; (5) e2e-lib dedup 19. val ISKRENO IZPUŠČEN (kanon R368). REGISTER `scripts/qa-needles/r384.tsv` [4 need_static: dashboard L1914 ×2 dvojček, sessions L316, measurements L5679, vodja L2122; 0 v HEAD d1cb4d2; TODO-R384; NF=2] prek `r384-register-write.py` fail-closed. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5567/5567 (363) FULL GREEN TEK 1** · build svež rm -rf .next EXIT=0 · qa-round.sh 384 needles EXIT=0 [Z-STRUCT 5/0; UNION r340–r384 + veriga] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA] · r384-era-harvest EXIT=0 ×2 · r383-window-scan EXIT=0 · r359-prod-qa-retry 383 ZELEN poskus 1 · leak-check čist. NOVO: scripts/qa-needles/r384.tsv + skripte [r384-era-harvest.sh (37th), r384-era-ruta-map.py (COMPANION), r384-qa-spot.sh, r384-triaza.py, r384-val62-apply.py, r384-register-write.py, r384-readme-update.py, r384-worklog-append.py, r384-commit-msg.txt] + r384-stil-val62.test.ts [×6] + r384-sorojenci-par.test.ts [×3]; UREJENO: 9 render datotek [val 62 INS ×16], README. Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 62 = render plast a11y className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme [ZERO-MUTACIJA E2E]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (81. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R385 prva naloga = qa-round.sh 384 prod-qa re-run [prek r359-prod-qa-retry.sh 384] + osemintrideseta era preverba r347–r384 [38 registrov, ≥155 = 151 + 4; prek era-clone.py --src-round 384 --expected-total 155 --dst-label "R384 val 62" + VSEH 12 spec-ov IZRECNO — LEKCIJA R384 (1)]; pričakuj 155/155 ŽIVO [r384 4 needleji razrešeni ob TEM pushu] + val 62 POST-deploy verifikacija [4 needleji r384.tsv; mounted + className LOČENO]. R385 kandidati: 1. amber/50 border-pariteta [isti vzorec; sveža triaža; dark PAR že v apply]; 2. r166 dark guard GENERALIZACIJA [navy-only → vsi barvni FB pari]; 3. e2e-lib dedup 19. val [po kanonu]. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **A/offset + C/border-pariteta zaključek val 61 (168 × INS, dvostopenjsko) + FEATURE era-clone COMPANION (ruta-mapa avtomatsko) + REGISTER EVOLUCIJA (4.+5. uporaba)** (R383 — KOLIZIJA #23 [runda preimenovana R382→R383 — njihova poslovna R382 c1bac7b, issue #13 R169 §13 CRM LIJAK, je pristala MED mojim delom; backup branch r382-ai-delta + reset --hard origin/main + delta re-aplicirana s preimenovanjem mojih artefaktov r382-*→r383-*; val 61 OSTANE val 61 — kanon R375; njihovi r382-* artefakti ostanejo = njihova zgodovina; r382-era-harvest.sh [35th] + r382-era-ruta-map.py [COMPANION] ostaneta pod izvirnima imenoma]): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 381`: **ZELEN ob poskusu 2** (17. runda; poskus 1 = znana transient kategorija R358/R359, retry wrapper po kanonu) + **PETINTRIDESIJNA era preverba** `r382-era-harvest.sh` [35 registrov r347–r381, ≥142 = vsota iz diska; generiran prek era-clone.py --src-round 381 --dst-round 382 --dst-label "R381 val 60" + VSEH 8 spec-ov — LEKCIJA R381 (5) spec-list ZAMENJAVA]: **EXIT=0 ×2** (determinizem) — 142/142 ŽIVO = 123 direktno + 19 resolucij; **val 60 needleji VSI 4 ŽIVO DIREKTNO** (chunk_015/028/026/045) → **val 60 deploy POTRJEN v celoti**; must_miss ×35 čisto; (2) **val 60 POST-deploy spot** `r383-qa-spot.sh` (spot-r167/24): (A) top-bar meni → **N1 navy evolved 3/3 + red evolved 2/2 na PRODU** (vseh 5 tokenov ločeno), stara oblika **0** — meni-notranja pariteta v OBEH smeri + Escape → 0; **DISK RESNICA: spot račun ima 0 projektov na produ** (CSV '(0 projektov)' + prazno stanje) → (B) audit-trail, (C) measurements stopnične predloge, (D) photo 'Uredi mero' — **iskreno 0 montiranih** (kanon r277 + razlogi iz virov: projekt-detajl / stair-form L4006 / odprta slika z merjenjem); kolektor **0**; (3) **MANDATORY STIL val 61** — disk resnica `r383-triaza.py` [C/border-pariteta: 134 tarč z VIDLJIVIM borderjem = 19 border-class + **115 × <Button variant="outline">** (border iz baze ui/button.tsx) + 78 N/A; A/ostanki = 35 navy brez O2, prekrivanje 25]: **STEP 1** 34 × INS ' focus-visible:ring-offset-2' TIK ZA navy/40 (val 52 pairing kanon; FROZEN izjema #2: roksal-catalog L95 <Input>) + **STEP 2** 134 × INS ' focus-visible:border-roksal-navy/40' TIK ZA O2 (val 57 kanon R375) — in-place 0 novih vrstic; `r383-val61-apply.py` fail-closed [kontrakt vrstičnih list bajtno, POST closure + in-place + **needle survival ujel 2 mrtva needleja**]; stale-pin pre-skan delta = 0 preozkih; `r383-stil-val61.test.ts` **×6 ZELENO** [(A) STEP 1 vzorci O2 TIK ZA navy/40, (B) FROZEN Input nespremenjen, (C) STEP 2 vzorci FB TIK ZA O2 [programatsko verificirani iz kontrakta], (D) negative-lookahead ostanek 0 + in-place, (E) obrnjena regresija val 60/59/58/amber, (F) bordered-brez-FB = 0 + NASLEDNICA r363/r364 ŽIVI]; (4) **REGISTER EVOLUCIJA** (kanon r371 N3/R377, **4.+5. uporaba** prek `r383-evolucija.py` fail-closed): val 61 prelomil **r363 needle** ('…ring-offset-2 active:scale…') + **r364 needle** ('…ring-offset-2\"') → obe EVOLVED R383 val 61 + NASLEDNICA (**števca 4/4 NESPREMENJENA**); **PIN SHIFT žigi 'PIN SHIFT R383 val 61 / EVOLVED'**: r381 (D) [inventory L2121/L2272 Button outline FB; L2226 Input frozen], r372 (C) [szc guard obrnjen — vse navy vrstice zdaj z O2 + navyO2 census 4→7]; (5) **FEATURE era-clone COMPANION integracija** (handover kandidat 3): era-clone.py ob generaciji harvesta AVTOMATSKO generira `r383-era-ruta-map.py` companion [klon r381 vzorca z žigi r381→r382: HARVEST pot + REG window + opisi; tolerantno preskočen za poslovne runde; fail-closed preverba PRED zapisom]; harvest re-generacija **BAJTNATO IDENTIČNA** = determinizem dokazan; ruta-mapa: 155 needlejev, /api/price-book 8, /api/installation-records 4, /api/inventory 2 …; (6) `r383-window-scan.py` (11. — REG window 382): 159/159 needle pinov ŽIVIH, 0 preozkih, 0 odstopanj; (7) e2e-lib dedup 18. val ISKRENO IZPUŠČEN (kanon R368). REGISTER `scripts/qa-needles/r383.tsv` [4 need_static: calculator L4396 S1 vzorec, team L497 + sessions L363 + material-intelligence L456 S2 vzorci; 0 v HEAD 7a92097; must_miss TODO-R383; NF=3] prek `r383-register-write.py` fail-closed. VERIFIKACIJA (celotna, FOREGROUND, PO KOLIZIJI #23 re-aplikaciji): tsc 0 · eslint 0 (FULL) · vitest **5558/5558 (361) FULL GREEN** [= njihova baza 5552/360 + mojih +6/+1] · build svež rm -rf .next EXIT=0 · qa-round.sh 383 needles EXIT=0 [r383.tsv 4 ŽIVO + TODO-R383 odsoten + r363/r364 NASLEDNICA ŽIVO; UNION r340–r383 + veriga r339→…→R227] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · r382-era-harvest EXIT=0 [35th ×2 — ime ohranjeno] · r383-era-harvest **EXIT=2 ×2 [36th — iskreno deploy-pending: 144/147 ŽIVO = 121 direktno + 23 resolucij; njihovi 5 CRM needleji ŽIVO prek /api/leads 401; 3 vrzeli razrešene ob TEM pushu]** · r383-window-scan EXIT=0 [159/159] · r382-era-ruta-map EXIT=0 · r359-prod-qa-retry 381 ZELEN ob poskusu 2 · leak-check čist. NOVO: scripts/qa-needles/r383.tsv + skripte [r382-era-harvest.sh, r382-era-ruta-map.py (COMPANION), r382-qa-spot.sh, r383-triaza.py, r382-val61-apply.py, r382-window-scan.py, r382-evolucija.py, r383-register-write.py, r382-readme-update.py, r382-worklog-append.py, r382-commit-msg.txt] + r383-stil-val61.test.ts [×6] + UREJENO: era-clone.py [COMPANION integracija], ~30 render datotek [val 61 INS], r363.tsv + r364.tsv [EVOLVED+NASLEDNICA], r372-stil-val55.test.ts [PIN SHIFT ×2], r381-stil-val60.test.ts [PIN SHIFT], README. Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 61 = render plast a11y className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme [ZERO-MUTACIJA E2E]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~2 tedna) — obvestiti lastnika (81. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R383 prva naloga = qa-round.sh 382 prod-qa re-run [prek r359-prod-qa-retry.sh 382] + šestintrideseta era preverba r347–r382 [36 registrov, ≥146 = 142 + 4; prek era-clone.py --src-round 382 --expected-total 146 --dst-label "R383 val 61" + VSEH spec-ov + nov AJ|/api/sync|401 [LEKCIJA R381 (5)]]; pričakuj 146/146 ŽIVO [r382 4 needleji razrešeni ob TEM pushu] + val 61 POST-deploy verifikacija [4 needleji r382.tsv; mounted + className LOČENO]. R383 kandidati: 1. red/40 border-pariteta družina [navy FB zaključen — rdeča simetrija: bordered red/40 vrstice brez focus-visible:border-roksal-red/40 — sveža triaža obvezna]; 2. amber/50 border-pariteta [isti vzorec]; 3. e2e-lib dedup 19. val [po kanonu]; 4. era-clone COMPANION za poslovne runde [tolerantni preskok → GLASNA oznaka]. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **Issue #13, korak R172 — SIGNATURE + DOCUMENT CHAIN (§16): NEPREKINJENA veriga QuoteVersion → DocumentVersion → DEJANSKI PDF bajti → SHA-256 → SignatureAudit → DealLock** (R395 — KOLIZIJA #27 [kanon KOLIZIJE #4/R323/#13–#26, 27. potrditev]: vzporedna lastniška QA R395 [cf71787 — STIL val 70 forced-colors fokus pariteta] je pristala med mojim delom → moja runda preimenovana R395→R395): (1) **PONUDBA PDF — strežniški artefakt** [nova ruta POST+GET /api/quotes/[id]/pdf — renderer quote-pdf.ts (determinističen kanon R294/R121: setCreationDate + setFileId, enak vhod = bajtno enak PDF); Document tip PONUDBA = ZABOJNIK ene verzije ponudbe (partial UNIQUE Document_ponudba_quote_key — zadnja linija za vzporedne zapise); DocumentVersion.quoteVersionId = KANONIČNA veriga; regeneracija = NOVA verzija (v2, v3 …); vrata: DRAFT → 409 (§3 — osnutek ni ponudba), REJECTED/SUPERSEDED → 409, verifyQuoteVersionIntegrity PRED izdajo (pokvarjena verzija se NE izda), documents.generate + 'read' dostop (kanon documents POST); dokument-chain.ts = EN VIR skupne logike]; (2) **deal-lock §16 veriga** [telo LAHKO prinese documentVersionId — EXACT preverba: vezava na TISO verzijo ponudbe (prečna → 409) + projekt + tip PONUDBA + bajti FIZIČNO v storage + RE-HASH bajtov == zabeležen sha256 (jedro §16 'PDF hash = hash dejanskih PDF bajtov' — ponaredek v storage → 409 'PDF bajti se ne ujemajo', projekt OSTANE nezaklenjen); BREZ njega strežnik SAM izda PONUDBA PDF iz kanonične verzije (bajti PRE transakcije, R122 kompenzacija — 0 sirot tudi za PDF); klientov pdfHash DEPRECIERAN — samo preverba ujemanja (409 ob razliki, odkrito ne tiho); SignatureAudit ×2 z documentVersionId + pdfHash = DV.sha256; atomarno: zaklep + BOMVersion + Document/DocumentVersion + podpisa + verzija → APPROVED v ENI transakciji]; (3) **BAZA linije (migraciji 20261011080000_r395_document_chain_enum + 20261011080100_r395_document_chain — LOČENI transakciji: PostgreSQL 'unsafe use of new value' nad partial UNIQUE z novim enum členom PONUDBA)** [trigger document_version_no_update — VSAKA UPDATE vrstice ZAVRNJENA (immutable DocumentVersion, prej SAMO konvencija); trigger quote_version_signed_immutable — PODPISANA (APPROVED) verzija: vsebina (10 polj IS DISTINCT FROM) IN status ZAMRZNJENA (tiha sprememba po podpisu zavrnjena NA RAVNI BAZE; DRAFT/ISSUED ostajata mutabilni — r374 TAMPIRANA test nespremenjena); trigger signature_audit_document_chain — vrstica z documentVersionId + pdfHash ≠ sha256 vezane verzije NE pristane (kanon erv_uradno_zahteva_pregled R393 — tudi mimo store-plasti)]; (4) **signature-audit DTO §16** [GET+POST: ipAddress/userAgent/deviceFingerprint/geoLatitude/geoLongitude ODSTRANJENI iz obeh DTO-jev (v bazi ostanejo — revizijska sled NI izbrisana; dostop = DBA/audit plast); + veriga quoteVersionId/bomVersionId/documentVersionId; + IDOR fix — prej je GET preverjal SAMO prijavo (vsak avtenticiran uporabnik je bral podpisno sled TUJEGA projekta), zdaj vrata 'read' na ravni vira kanon deal-lock GET R374; POST detajl: eksplicitni allowlist DTO namesto surovega `...audit` spreada]; (5) **UI** [post-signature-panel: mrtve veje ip/GPS/fingerprint odstranjene (DTO jih ne nosi več), prikazana §16 veriga (PDF/ponudba verzija); SignatureAuditEntry tip usklajen]; 17 testov [r395-document-chain: PDF vrata ×6 + zaklep veriga ×5 + baza triggerji ×3 + DTO ×3]; r374/r376 čistki +PDF artefakti (0 sirot). **Iskrena odločitev (§8)**: deal-lock GET DTO NI vračal 'sha256' imena polja že prej (r374 test) — PDF verzija v odgovoru nosi {id, versionNumber, sizeBytes}, hash živi v pdfHash (isti kanon). PIN SHIFT: r308-api-meja [111→112 rut + quotes/[id]/pdf eksplicitno] + r191-val2 [68/85→69/86 handlerjev + 77→78 zapisOmejitev; GET je samo-bralni, brez vrata]; register r395.tsv [3 need_static ŽIVO + TODO-R395 must_miss; naslednja era ≥183 = 180 + mojih 3] + r395-window-scan.py [17. generacija, REG_DO 394].
- **FORCED-COLORS FOKUS PARITETA val 70 (105 × REPL in-place — roksal render plast ×24 datotek: `focus-visible:outline-none` → `focus-visible:outline-hidden`; normal-mode kompilirani CSS IDENTIČNA — oba outline-style:none — razlika ŠELE v forced-colors mode, kjer ring/box-shadow NE preživi in outline-hidden obnovi 2px outline = WCAG 2.4.7; družinski precedens viz ×3) + FEATURE OSMI STRAŽAR: outline/fokus indikator disciplina GENERALIZACIJA (vsak outline-none element nosi nadomestni indikator v katerikoli focus paradigmi; komplet varuhov r385…r391+r392+r394) + 45. era preverba PETINŠTIRIDESIJNA 184/184 (handover aritmetika 183 GLASNO popravljena na disk resnico) + val 69 needle ŽIVO v prod chunku** (R394; KOLIZIJA #26 — runda preimenovana R393→R394, njihova R393 [0634c2b engineering rules] = pristala resnica; vsi moji artefakti preimenovani r393-→r394-, njihovi bajtnato ohranjeni; rebase na zlivenem drevesu): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 392`: **ZELEN ob poskusu 1** (26. runda) + **PETINŠTIRIDESIJNA era preverba** `r392-era-harvest.sh` [45 registrov r347–r391, **≥184 = 182 + 2** — ⭐ **LEKCIJA R394 (1): handover aritmetika NI disk resnica** („≥183 = 182 + 1“) — disk resnica r391.tsv nosi 2 need_static; era-clone disk-vsota fail-closed guard bi 183 zavrnil; POPRAVLJENO na 184]: era-clone.py --src-round 391 --dst-round 392 --expected-total 184 --dst-label "R391 val 68" --dst-chain-seg "IN r390.tsv ×9 IN r391.tsv val 68 ×2 na" + 18 spec-ov; ERA_BESODE GLASNO na 45 — PETINŠTIRIDESIJNA; COMPANION r392-era-ruta-map.py: **EXIT=0 ×3** (pass2 ≡ pass3 bajtno — determinizem) — **184/184 ŽIVO** [149 direktno + hash + AR katalog server resolucije + 18 server]; must_miss ×45 čisto; era kontrole R340/R341/R343/R345 ŽIVE; (2) **val 69 POST-deploy verifikacija** `r394-qa-spot.sh` (spot-r184/32; ZERO-MUTACIJA): material/orders subtab AKTIVEN (aria-pressed=true + bg-roksal-navy) → **DOM 0 + 0 POGOJNA resnica** („Ni naročil. Pretvori BOM draft v naročilo.“ + „Ni dobaviteljev“ — prazna stanja; ZERO-MUTACIJA ne fabricira podatkov — kanon R392 spot A) — build-layer dokaz NEODVISNO: **val 69 needle ŽIVO v prod chunk_036.bin** (transition-[…,box-shadow] + hover par ×2 Card sorojenci); sonde navy 8/8/0 + red 0; kolektor **0**; (3) **MANDATORY STIL val 70** — triaža `r394-triaza.py` (element-točna; D-check: nadomestilo = ring/border v KATERIKOLI focus paradigmi focus-visible:/focus:/focus-within: — preozek focus-visible-only guard lažno zastal 17 vnosnih polj): fv_none ×103 roksal + goli ×14 roksal + ×10 app + ×2 ui + outline-hidden ×3 ui + ×3 viz + brez_nadomestila = 0 (ui/tabs.tsx Radix = FROZEN upstream); ⭐ **REALNA družina: forced-colors fokus pariteta** — kompilirani CSS disk dokaz (outline-none ≡ outline-hidden normal-mode; outline-hidden nosi @media(forced-colors:active) 2px outline podaljšek) → **105 × REPL** `focus-visible:outline-none` → `focus-visible:outline-hidden` (roksal ×24 datotek; 103 className spanov + 2 helper/template žetona); iskrene meje: ui-kit cva baze (shadcn jezik FROZEN), goli outline-none vnosnih polj (focus: paradigma — outline-hidden bi v forced-colors risal STALNI outline), viz ×3 NESPREMENJENI; pre-skan `r394-pinscan.py` [RENDER 24×105 + TESTI 27×51 PRESENCE + REGISTRI 32 ŽIVIH]; `r394-val70-apply.py` fail-closed + IDEMPOTENTEN [1. tek abort: pre-guard kontrakt iz pričakovanj — popravljen; 2. tek: RENDER 105 × REPL (0 novih vrstic) + TESTI 48 × token-for-token + 3 pričakovane NIČLE ostale (r368:86, r381:87+88 — .toBe(0) absence discriminatorji) + REGISTRI 32 × NASLEDNICA-2 (×18 datotek — zgodovina komentirana dobesedno + EVOLVED anotacija; need_static per-register NESPREMENJENI); 3. tek abort — idempotenca DOKAZANA]; ⭐ **LEKCIJA R394 (2) — pre-skan MORA pokriti legacy needle-skripte**: FULL vitest tek 1 ujel r370-stil-val53 (C) B236 legacy needle + qa-round ujel 1 MISS v r317 + REGRESIJA kaskada ×7 (union veriga) → EVOLVED ×15 legacy needlejev [r236 ×2 + r237-prod-core ×1 + r317 ×1 + r245–r255 ×11]; r368 (C)/r387 (E) exact-label pini na notification vrstici prisilijo žig v TRAILING komentar (notranji žig bi prelomil bajtno pin) — LEKCIJA R394 (3); `r394-stil-val70.test.ts` **×5 ZELENO** [(A) PARITETA 105 ×24 (measurements 33/inventory 14/invoice 12), (B) CENZUS fv_none 0 + goli ×14, (C) vsak fv_hidden nosi indikator, (D) viz ×3 + ui-kit bajtno, (E) NASLEDNICA disk resnica]; (4) **FEATURE OSMI STRAŽAR — outline/fokus disciplina**: `r394-outline-disciplina.test.ts` **×7 ZELENO** [(A) globalna kršitev = 0 (>2000 elementov; ui-kit FROZEN), (B) žetoni zamrznjeni, (C) viz kanon ×3 bajtno, (D) ui-kit shadcn bajtno, (E) fv_hidden VSI nosijo ring/border — ring primaren, outline-hidden = SAMO forced-colors rezerva, (F) kompilirani CSS dokaz zamrznjen (3 regexa), (G) NASLEDNICE ×32 + zgodovina ×32 + need_static 185]; (5) e2e-lib dedup 23. val ISKRENO IZPUŠČEN (kanon R368). REGISTER `scripts/qa-needles/r394.tsv` [1 need_static ŠIVNI needle ×64: focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-navy/40; 0 v HEAD 0634c2b; TODO-R394] prek `r394-register-write.py` fail-closed; era veriga: 46. (r347–r392) ≥185; TA needle pokrit v 48. preverbi (r347–r394) ≥189. r394-window-scan.py **17. generacija** [REG_DO 394 — njihov r393 ×3 + moj r394 ×1 v DEL 2]: **304 okenskih regexov 0 preozkih + 202 needle pinov 0 mrtvih + 150 slice-oknen + 0 vrstičnih odstopanj — EXIT=0**. VERIFIKACIJA (celotna, FOREGROUND, na ZLIVENEM drevesu): tsc 0 · eslint 0 (FULL) · vitest **5828/5828 (387) FULL GREEN** [njihova baza 5816/385 + mojih +12/+2; tek na R392 drevesu 5750/5750 (383) + KOLIZIJA popravki] · build svež rm -rf .next EXIT=0 · qa-round.sh 394 needles EXIT=0 [r394.tsv 1 ŽIVO ×64; UNION r340–r394 + STRAGGLERS + anchor veriga — po 15 legacy EVOLVED] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · r392-era-harvest EXIT=0 ×3 [45th — 184/184] · r394-window-scan EXIT=0 [17. gen] · r359-prod-qa-retry 392 ZELEN poskus 1 · leak-check čist [ghp_ ×0]; + prisma migrate deploy na njihovi migraciji 20261009080000_r393_engineering_rules (stale client — LEKCIJA R391 (7); .env DATABASE_URL pokvarjen — eksplicitni URL, .env NI mutiran — LEKCIJA R392). NOVO: scripts/qa-needles/r394.tsv + skripte [r392-era-harvest.sh (45th) + r392-era-ruta-map.py (COMPANION), r394-qa-spot.sh, r394-triaza.py, r394-pinscan.py, r394-val70-apply.py, r394-window-scan.py (17. gen), r394-register-write.py, r394-readme-update.py, r394-worklog-append.py, r394-commit-msg.txt] + r394-stil-val70.test.ts [×5] + r394-outline-disciplina.test.ts [×7 — FEATURE]; UREJENO: 24 roksal render datotek [val 70 REPL ×105], 27 testnih datotek [EVOLVED ×48 + 3 ničelni ostali], 18 registrskih datotek [NASLEDNICA-2 ×32], 14 legacy needle skript, era-clone.py [ERA_BESODE +45], README. Kontrakt NIČ (/api/sync — probe je samo fail-closed 401 branje); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 70 = render plast className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme s strani QA [ZERO-MUTACIJA E2E]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~2 tedna) — obvestiti lastnika (86. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R395 prva naloga = qa-round.sh 394 prod-qa re-run [prek r359-prod-qa-retry.sh 394] + šestinštirideseta era preverba r347–r392 [46 registrov, ≥185 = 184 + 1; era-clone.py --src-round 392 --dst-round 393 --expected-total 185 + 18 spec-ov; ERA_BESODE 46 ŠESTINŠTIRIDESIJNA GLASNO] + sedeminštirideseta (47.) r347–r393 [47 registrov, ≥188 = 185 + 3 njihovih engineering needlejev — era-clone --src-round 393 --dst-round 394; ERA_BESODE 47] + val 70 POST-deploy verifikacija [1 šivni needle r394.tsv ×64; mounted + className LOČENO; ZERO-MUTACIJA]. R395 kandidati: 1. stil: duration-* konsistenca Card hover družina [verjetno iskren zaklep — privzeto 150ms]; 2. stil: goli outline-none vnosna polja [focus: paradigma — verjetno iskren zaklep]; 3. e2e-lib dedup [po kanonu]. ⭐ LEKCIJE R394: (1) handover aritmetika NI disk resnica — era-clone disk-vsota guard jo ujame; preštej need_static PRED generacijo; (2) pre-skan MORA pokriti legacy needle-skripte (r2xx–r3xx build-needles + prod-core) — union veriga jih poganja proti svežemu buildu; (3) exact-label pini (celoten label z zaključnim navedkom) onemogočijo žig znotraj navedka — trailing komentar ohrani dokumentacijo IN pin; (4) expected-0 pini (.toBe(0) za žetonom) se NE evolvirajo; (5) apply pre-guard piši IZ disk resnice; (6) triaža D-check: nadomestilo v KATERIKOLI focus paradigmi; (7) KOLIZIJA rename: untracked artefakti se preimenujejo PRED ff-pull (mv + samoreference), deljene datoteke (README/worklog) se re-aplicirajo na NJIHOVO postavitev. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **Issue #13, korak R171 — ENGINEERING / COMPLIANCE VERSIONING (§15): EngineeringRule + EngineeringRuleVersion z VSO §15 provenanco [rule id, vir/source KATALOG_PROIZVAJALCA|URADNI_STANDARD|INTERNI_INZENIRING|SEKUNDARNI_VIR, standardReferenca + standardVerzija + jurisdikcija (honest NULL — §8: katalog NE citira standardov), calculatorVerzija (sdk-S+8 pri produktnih razmakih; NULL pri ročnih navodilih IN pri calculator.ts citatih — checkCompliance NIMA lastne verzije formule, odkrito zabeleženo), effectiveFrom/veljavnostDo, reviewedAt + reviewerId] + DRAFT→ACTIVE→RETIRED verzioniranje [partial UNIQUE: ENA ACTIVE na pravilo; aktivacija transakcijsko upokoji prejšnjo] + §15 LOČITEV informativnega izračuna od uradne projektantske/statistične preverbe NA TRIH LINIJAH [store ustvarjanje 409 + store aktivacija 409 + BAZA CHECK erv_uradno_zahteva_pregled — nepreverjeno pravilo je lahko SAMO INFORMATIVNO] + /api/calculator GET+POST ŽIG razred INFORMATIVNO + opozorilo ENega vira [DODATNA polja — §1 determinizem NESPREMENJEN] + seed 37 pravil [9 splošnih byte-exact iz generalMountingRules + 23 produktnih razmakov iz profilov + 5 IZ calculator.ts: NEPREVERJENI citati SIST EN 1264/Pravilnik SI/EVS EN 1991-1-1/SIST EN 1991-1-4 odkrito zabeleženi — NEDOSLEDNOST 110 mm odprine vs krogla 100 mm dokumentirana, NE tiho popravljena (popravek = nova verzija prek API-ja); VSA INFORMATIVNO + reviewedAt/reviewerId NULL — NIČ ni uradno preverjeno] + 4 API rute /api/engineering-rules* [GET seznam s skladnostnim povzetkom 0 uradnih + POST ustvari + [id] detajl z zgodovino + [id]/versions POST nova verzija + versions/[id] PATCH aktiviraj/upokoji; RBAC engineering.manage ADMIN/VODJA] + 78 testov [domain ×29 + seed pariteta ×19 + api ×16 + verzije ×14]** (R393; commitiran generator scripts/r392-seed-sql-gen.mjs — dokaz sledljivosti, byte-identičen seedu ×3): issue #13 R171 — vsako tehnično pravilo ima rule id/source/standard/version/jurisdiction/application/effectiveFrom/reviewedAt/reviewer/calculator version; migracija 20261009080000_r392_engineering_rules [CHECK ×8 + partial UNIQUE]; PIN SHIFT r308 [107→111 rut] + r191-val2 [65/82→68/85 handlerjev + 74→77 zapisOmejitev; engineering-rules/[id] je GET-samo, brez rate-limit vrata]; register r392.tsv [3 need_static + TODO-R393 must_miss].
- **HOVER-SENČNA GLADKOST val 69 (2 × REPL in-place — material-intelligence Cards L1690+L1980: transition-colors NE pokriva box-shadow → hover:shadow-sm SNAP; nadgradnja = transition-colors definicija ∪ {box-shadow}, brez izgube pokritosti, brez izuma; edina 2 elementa v CELEM src s senčnim SNAP-om — 40 ostalih pokritih) + FEATURE SEDMI STRAŽAR: hover-transform + senčna pokritost disciplina GENERALIZACIJA (vsak hover:shadow/translate/scale element nosi pokrito transition utility; komplet varuhov r385…r391+r392) + 44. era preverba ŠTIRIDESIJNA 182/182 (njihov katalog r390 ×9 ŽIVO prek NOVIH AR probe spec-ov) + era veriga KOLIZIJA-skip obnovljena (43rd→r390-era-harvest.sh generacijsko ime) + val 68 POST-deploy MONTIRANO** (R392): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 391`: **ZELEN ob poskusu 1** (25. runda) + **štiriinštirideseta era preverba** `r391-era-harvest.sh` [44 registrov r347–r390, ≥182 = 173 + 9 njihovih katalog needlejev — KOLIZIJA #25 veriga: njihova runda NI generirala harvesta → 43rd (r391-era-harvest.sh) obnovljen na GENERACIJSKO ime r390-era-harvest.sh (notranje oznake r390) → era-clone.py --src-round 390 --dst-round 391 --expected-total 182 --dst-label "R390 issue #13 (R170)" --dst-chain-seg "IN r389.tsv val 67 ×2 IN r390.tsv ×9 na"; ERA_BESODE GLASNO na 44 — ŠTIRIDESIJNA; COMPANION r391-era-ruta-map.py]: **EXIT=0 ×2** (determinizem, normirana loga identična) — **182/182 ŽIVO** [147 direktno + 8 hash + 9 NOVIH AR katalog server resolucij + 18 server]; ⭐ **LEKCIJA R392 (1) — zamrznjeni SERVER_PROBE_SPECS ne sledijo novim rutam**: njihovih 9 katalog needlejev (403/400/409 sporočila v /api/catalog* rutah) NISMO razrešljivi prek starih 12 spec-ov (REG_AR ni v nobenem spec-u) → 6 NOVIH AR spec-ov [/api/catalog, /versions, /compatibility, /supplier-mappings, products/000/applications, products/000/variants — vse 401 fail-closed na produ = deploy ŽIVO]; ⭐ **LEKCIJA R392 (2) — KOLIZIJA-skip era veriga**: 1 runda BREZ harvesta = naslednja generacija ne more brati r{src}-era-harvest.sh → obnova GENERACIJSKEGA imena prejšnjega harvesta (chain-top+1 konvencija ohranjena: r390 pokriva r347–r389, r391 pokriva r347–r390) + prisma migrate deploy + generate na njihovi migraciji (stale client = 34 lažnih TS2339 — LEKCIJA R391 (7) potrjena); (2) **val 68 POST-deploy spot** `r392-qa-spot.sh` (spot-r182/31; ZERO-MUTACIJA): inventory L1562 **MONTIRANO 1×** — 13/13 tokenov LOČENO (tabular-nums→focus-visible šiv + active:scale-[0.96], press-scale ×0 — dvojni mehanizem NE obstaja več na produ); calculator L820 **iskreno 0** — POGOJNA resnica (importedFromMeasurement vrata; ZERO-MUTACIJA ne fabricira uvoza; needle ŽIVO v buildu = era need_static); sonde navy 23/23/0 + red 0; kolektor **0**; (3) **MANDATORY STIL val 69** — sveža triaža: disabled: družina SEMANTIČNA (cursor-wait=in-flight vs cursor-not-allowed=nedostopno; opacity 30/40/50/70 resnost) + delno mrtev CSS na Button elementih (pointer-events-none) → iskreno ZAMRZNJENO; active:scale heterogenost po velikostnih razredih → iskreno ZAMRZNJENO (subjektivni kriterij); hover-transform ×16 VSE pokrite; ⭐ **REALNA družina: hover:shadow-sm SNAP ×2** (edina v src) → **2 × REPL**: material-intelligence L1690+L1980 `transition-colors` → `transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow]` (družinski precedens logistics L2360/2466/2659 + roksal-catalog L141 z ožjim seznamom [border-color,box-shadow]); pre-skan `r392` pinscan: 0 ogroženih needlejev (r388-qa-spot zadetek = lažno pozitiven — token-selector eval vrstica, NI subspan) + counter-pini (r377 dashboard/measurements, r372/r373/r383/r384) NESPREMENJENI; `r392-val69-apply.py` fail-closed + idempotenten [POST: NOVO ×2, star ×0, 0 novih vrstic; senčni SNAP ostanki 0]; `r392-stil-val69.test.ts` **×4 ZELENO** [(A) PARITETA 2 tarči + star ×0, (B) CENZUS 0 snap čez VSE src, (C) seznam = colors ∪ box-shadow (brez izgube), (D) in-place + precedens logistics ×3/catalog ×1, (E) Card baza zamrznjena bajtno]; (4) **FEATURE SEDMI STRAŽAR — hover-transform + senčna pokritost disciplina**: `r392-senca-transform-disciplina.test.ts` **×7 ZELENO** [(A) globalna kršitev senca = 0; (B) globalna kršitev transform = 0; (C) it.each ×2 val 69 tarče; (D) zamrznjeni števci senca 45 / transform 16 (roksal+ui+app+viz); (E) ui-kit baze bajtno (Card NIČ transition + Button + Badge)]; (5) e2e-lib dedup 23. val ISKRENO IZPUŠČEN (kanon R368 — ni novih ×3 ponovitev). REGISTER `scripts/qa-needles/r392.tsv` [1 need_static ŠIVNI needle ×2 pojavitvi (Card sorojenci bajtno identična spana): transition-[color,…,box-shadow] hover:border-roksal-navy/25 … hover:shadow-sm; 0 v HEAD 0238292 (logistics precedens nosi OŽJI seznam = byte-drugačen); TODO-R392] prek `r392-register-write.py` fail-closed; naslednja era ≥183 [45., r347–r391 = 182 + 1]. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL; 1 lasten require-import error ujet + popravljen v isti rundi) · vitest **5738/5738 (381) FULL GREEN TEK 1** · build svež rm -rf .next EXIT=0 · qa-round.sh 392 needles EXIT=0 [r392.tsv 1 ŽIVO ×2; UNION r340–r392 + veriga r339→…→R227] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN — ZERO-MUTACIJA] · r391-era-harvest EXIT=0 ×2 [44th — 182/182] · r392-window-scan EXIT=0 [15. gen; REG_DO 392; 304 regexov 0 preozkih + 198 pinov 0 mrtvih] · r359-prod-qa-retry 391 ZELEN poskus 1 · leak-check čist [ghp_ ×0]. NOVO: scripts/qa-needles/r392.tsv + skripte [r391-era-harvest.sh (44th) + r391-era-ruta-map.py (COMPANION), r392-qa-spot.sh, r392-val69-apply.py, r392-window-scan.py (15. gen), r392-register-write.py, r392-readme-update.py, r392-worklog-append.py, r392-commit-msg.txt] + r392-stil-val69.test.ts [×4] + r392-senca-transform-disciplina.test.ts [×7 — FEATURE]; UREJENO: material-intelligence-tab.tsx [val 69 REPL ×2], r390-era-harvest.sh + r390-era-ruta-map.py [obnovljeni generacijski imeni — KOLIZIJA #25 skip], era-clone.py [ERA_BESODE +44], README. Kontrakt NIČ (/api/sync — probe je samo fail-closed 401 branje; /api/catalog* probe = fail-closed 401, brez pisanja); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 69 = render plast className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme s strani QA [ZERO-MUTACIJA E2E]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (85. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R393 prva naloga = qa-round.sh 392 prod-qa re-run [prek r359-prod-qa-retry.sh 392] + petinštirideseta era preverba r347–r391 [45 registrov, ≥183 = 182 + 1; era-clone.py --src-round 391 --dst-round 392 --expected-total 183 + 18 spec-ov (12 zamrznjenih + 6 AR katalog); ERA_BESODE 45 PETINŠTIRIDESIJNA GLASNO]; pričakuj 183/183 ŽIVO + val 69 POST-deploy verifikacija [1 šivni needle r392.tsv ×2; mounted + className LOČENO; ZERO-MUTACIJA]. R393 kandidati: 1. stil: outline mešanica focus-visible:outline-none (104) vs outline-hidden (TW v4 ui-kit) [disk triaža; v4 outline-none = outline-style:none — funkcionalno OK, preveriti vizualno razliko]; 2. stil: duration-* konsistenca na Card hover družini (logistics nosi duration-150, material nadgradnja brez — privzeto 150ms identično; morda brez vizualnega učinka → iskren zaklep); 3. e2e-lib dedup 23. val [po kanonu]. ⭐ LEKCIJE R392: (1) zamrznjeni SERVER_PROBE_SPECS ne sledijo novim rutam — nov registr z novimi server rutami zahteva NOVE probe spec-e v isti generaciji; (2) KOLIZIJA-skip era veriga: obnova generacijskega imena (chain-top+1) omogoči era-clone nad preskočeno rundo; (3) 0-v-HEAD needle mora biti byte-unikaten — družinski precedens z istim seznamom ga onemogoči → konzervativna nadgradnja seznama da unikaten šiv; (4) lastni testi imajo hrošče — nested it.each je prepovedan, ternarna precedence past, števci na ŠIRŠEM nizu korenov; (5) eslint no-require-imports — v testih node:fs readdirSync import, ne require. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].- **PRESS-SCALE DVOJNI MEHANIZEM RESOLUCIJA val 68 (10 × REPL in-place — ko-obstoj custom `.press-scale:active` {transform: scale(.97)} in Tailwind v4 utility `active:scale-[0.96]` {scale: .96} na ISTEM elementu = MNOŽIČEN skrček 0.9312 — neodvisni CSS lastnosti!) + FEATURE ŠESTI STRAŽAR: press-scale disciplina GENERALIZACIJA (EN element = EN press mehanizem; komplet varuhov r385+r386+r387+r388+r389+r391) + era orodje UTRJENO (era-clone.py idempotentno kloniranje utrjenih virov + KeyError f-string/format popravka) + val 67 POST-deploy MONTIRANO + TRIINŠTIRIDESIJNA era preverba 173/173** (R391; KOLIZIJA #25 — runda preimenovana R390→R391, njihov katalog R390 = pristala resnica): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 389`: **ZELEN ob poskusu 1** (24. runda) + **TRIINŠTIRIDESIJNA era preverba** `r391-era-harvest.sh` [43 registrov r347–r389, ≥173 = 171 + 2; era-clone.py --src-round 389 --dst-round 390 --expected-total 173 + VSEH 12 server-probe spec-ov IZRECNO; ERA_BESODE GLASNO na 43 — TRIINŠTIRIDESIJNA; COMPANION r391-era-ruta-map.py]: **EXIT=0 ×2** (determinizem) — **173/173 ŽIVO** [147 direktno + 8 hash + 18 server resolucij; val 67 deploy POTRJEN]; must_miss ×43 čisto; ⭐ **LEKCIJA R391 (1) — era-clone.py NI zmožen klonirati utrjenega vira**: r389 harvest ŽE nosi CHECKPOINT GUARD + ODPADNI CENZUS + era-kontrola hash-fallback → vstavljanje = duplikat, rep sidran na ŽE nadomeščeno enovrstično obliko (FAILOVEDANO 0), **KeyError('http_code')** [f-string %{{http_code}} pusti literal {http_code}, .format(dst) nad celotno implicitno konkatenacijo — konkatenacija se veže PRED metodo]; POPRAVEK: idempotentna preverb (vir utrjen = preskoči vstavljanje + SAMO prelabel r389-→r391-kontrola- ×2) + čista f-string sestava + POST check 'Vercel Security Checkpoint' 2→4 + r391-kontrola- ×2; (2) **val 67 POST-deploy spot** `r391-qa-spot.sh` (spot-r173/30; ZERO-MUTACIJA — obvestilne vrstice samo MERJENE, safety-tab clipboard gumb NI klikljen): notification L811 ChevronRight **MONTIRANO 10×** — 3 needle žetoni ×10 LOČENO [⭐ LEKCIJA R391 (3): SVGElement.className = SVGAnimatedString — getAttribute('class')]; safety-tab L254 Button **MONTIRANO 1×** — 12/12 tokenov LOČENO; kolektor **0**; (3) **MANDATORY STIL val 68** — sveža triaža NOVE družine [transition/hover IZČRPANA po val 67; ring-offset dark rešeno R168; active:scale + disabled: semantično — iskreno ZAMRZNJENO]: ⭐ **REALNA družina: press-scale × active:scale ko-obstoj** — `r391-triaza.py` (element-točna span parser, LEKCIJA R388 (1) kanon) = **TOČNO 10 dual elementov** [calculator L820, dashboard L2426+L2435, inclinometer L341, inventory L1562, measurements L3496+L5211+L5234+L5258, punch-list L531]; zgrajen CSS dokaz: `.press-scale:active{transform:scale(.97)}` vs `.active\:scale-\[0\.96\]:active{scale:.96}` — neodvisni lastnosti → 0.97 × 0.96 = **0.9312 množičen skrček**; `r391-pinscan.py`: **TOČNO 1 ogrožen register needle** (r363.tsv:21 — edini vir dual inventory L1562) + 19 kontrolnih ŽIVIH; `r391-val68-apply.py` fail-closed + IDEMPOTENTEN [10 × REPL ' press-scale' odstranitev, 0 novih vrstic; EVOLVED ×5 testnih pinov + r363.tsv NASLEDNICA-3 v ENEM atomskem koraku; ⭐ **LEKCIJA R391 (2) — dva lastna buga 1. teka**: (i) PATH bug [source zapisan v koren repozitorija → tsconfig include **/*.tsx = 34 lažnih TS2307], (ii) akumulacijski bug [multi-target datoteke ponovno brale disk = izgubljeni bratski uredi 6/10] → per-file grupiranje + EN pomik + idempotentni preskoki; 2./3. tek dual 4→0, 0→0 ×2 DOKAZANO]; press-scale žetoni 133→123 (−10); `r391-stil-val68.test.ts` **×5 ZELENO** [(A) PARITETA 10 tarč element-točno, (B) CENZUS dual=0 + žetoni 28 (prej 38), (C) EVOLVED žigi, (D) r363 NASLEDNICA ŽIVO ×1 + need_static 4, (E) iskrena meja: .press-scale utility OSTANE (105 non-dual) + cva zamrznjena]; (4) **FEATURE ŠESTI STRAŽAR**: `r391-press-disciplina-generalizacija.test.ts` **×14 ZELENO** [(A) globalna kršitev = 0 čez VSE roksal tsx (>2000 elementov); (B) .press-scale:active bajtno; (C) it.each ×10 tarče; (D) števci 123 / ×43; (E) ui-kit cva bazi bajtno]; (5) e2e-lib dedup 23. val ISKRENO IZPUŠČEN (kanon R368). REGISTER `scripts/qa-needles/r391.tsv` [2 need_static **ŠIVNA** needleja — sekvenca čez odstranjeni press-scale žeton je NOVA: calculator L820 šiv duration-150→shrink-0 + inventory L1562 šiv tabular-nums→focus-visible; 0 v HEAD; ⭐ LEKCIJA R391 (4): needle MORA prečkati šiv — podspan starega spana je 'že v HEAD' (0-v-HEAD pravilno zavrnil); TODO-R391] prek `r391-register-write.py` fail-closed; naslednja era ≥184 [44. preverba r347–r390 ≥182 = 173 + 9 njihovih katalog needlejev — KOLIZIJA #25; 45. r347–r391 ≥184]. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5727/5727 (379) FULL GREEN TEK 1** · build svež rm -rf .next EXIT=0 · qa-round.sh 391 needles EXIT=0 [r391.tsv 2 ŽIVO; UNION r340–r391 + veriga r339→…→R227] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN — ZERO-MUTACIJA] · r391-era-harvest EXIT=0 ×2 [43rd — 173/173] · r391-window-scan EXIT=0 [14. gen; REG_DO 391] · r359-prod-qa-retry 389 ZELEN poskus 1 · leak-check čist [ghp_ ×0]. NOVO: scripts/qa-needles/r391.tsv + skripte [r391-era-harvest.sh (43rd) + r391-era-ruta-map.py, r391-qa-spot.sh, r391-triaza.py, r391-pinscan.py, r391-val68-apply.py, r391-window-scan.py (14. gen), r391-register-write.py, r391-readme-update.py, r391-worklog-append.py, r391-kolizija-rename.py] + r391-stil-val68.test.ts [×5] + r391-press-disciplina-generalizacija.test.ts [×14 — FEATURE]; UREJENO: 6 render datotek [val 68 REPL ×10 — 0 novih vrstic], 5 testnih datotek [EVOLVED], r363.tsv [NASLEDNICA-3], era-clone.py [idempotenca + KeyError + POST checks], README. Kontrakt NIČ (/api/sync — probe je samo fail-closed 401 branje); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 68 = render plast className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme s strani QA [ZERO-MUTACIJA E2E; njihova shema = njihova poslovna odločitev]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (84. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R392 prva naloga = qa-round.sh 391 prod-qa re-run [prek r359-prod-qa-retry.sh 391] + štiriinštirideseta era preverba r347–r390 [44 registrov, ≥182 = 173 + 9 njihovih katalog needlejev; era-clone.py --src-round 390 --expected-total 182 + VSEH 12 spec-ov IZRECNO; ERA_BESODE 44 ŠTIRIDESIJNA ŽE v mapi] + val 68 POST-deploy verifikacija [2 šivna needleja r391.tsv; mounted + className LOČENO; ZERO-MUTACIJA]. R392 kandidati: 1. stil: disabled: družina triaža [semantika vs pariteta element-točno; brez paradigme iskren zaklep]; 2. stil: active:scale heterogenost po velikostnih razredih [samo z objektivnim kriterijem]; 3. e2e-lib dedup 23. val [po kanonu]. ⭐ LEKCIJE R391: (1) orodje MORA klonirati svoj lastni izhod — idempotenca + f-string/.format konkatenacija past; (2) junk koren datoteke = tsconfig lažni pozitiv — po abortu preveri git status PRED ponovnim tekom; (3) SVG className = SVGAnimatedString — getAttribute('class'); (4) needle MORA prečkati šiv — podspan = 'že v HEAD'; (5) multi-target apply = akumulacija v EN pomik + idempotentni preskoki; (6) **KOLIZIJA rebase: --theirs/--ours sta OBRNJENA** (v rebase je 'ours' = upstream/njihovo, 'theirs' = tvoj commit) — po rebase preveri, da so NJIHOVI artefakti (r390.tsv ×9, README bullet, worklog vnos) res na disku. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **Issue #13, korak R170 — PRODUKTNI KATALOG: APLIKACIJSKI KONTEKST: ProductFamily → Product → ProductVariant → ProductApplication → ProductCompatibility → ProductAccessory (§14)** (R390 — KOLIZIJA #24 [kanon KOLIZIJE #4/R323/#13–#23, 24. potrditev]: vzporedna lastniška QA R389 [35edf80 — LASTNA-PREHOD GLADKOST val 67 + NJIHOV register r389.tsv + r389-stil-val67.test.ts ×4 + r389-lasta-uzkost-generalizacija.test.ts ×5 — peti stražar] je pristala MED mojim delom [fetch ob zaključni preverbi: 2ccba6c..35edf80] in vzela številko → moja runda preimenovana R389→R390: migracija 20261008080000_r390_product_catalog + 4× r390-*.test.ts + žigi; _prisma_migrations vrstica preimenovana V OBEH bazah (dev + test — novo ime + nov checksum, `migrate status` čist); NJIHOVI r389-* artefakti ostanejo = lastniška zgodovina; NJIHOV r389.tsv NEDOTAKNJEN — TODO-R389 je NJIHOV must_miss, moj je TODO-R390]): (1) **§14 hierarhija 8 modelov** [ProductCatalogVersion — statusni stroj DRAFT→ACTIVE→RETIRED pariteta PriceBookVersion R373: aktivacija TRANSAKCIJSKO upokoji prejšnjo ACTIVE, dve ACTIVE = pokvarjeno stanje → javna napaka; veljavnostOd/Do = §14 "effective dates"; ProductFamily — WoodCore: material/garancija/barvna paleta (JSON 9 barv z approxHex nullable §8) + SPLOŠNA PRAVILA MONTAŽE (JSON 9 pravil) živijo TU [§14: "ne hardcodirati teh pravil v več UI-jih" — pravila so PODATEK vrstice, NE koda komponent]; Product — §14 polja VSA: dimenzije [faceWidthMm/thicknessMm Decimal(8,2)/standardLengths JSON], fixingMetoda + screwsVisible [§14 "fixing method"/"screw constraints"], interniOkrepitev + okrepitevOpis [§14 "internal reinforcement" — true SAMO kjer fixing/posebnosti dokumentirata alu cev v sredini profila: romb ×2, kubo, polna-57-32; opis cita vir, ostali false + NULL §8], maxPostSpacingH/V + maxRailSpacingV [§14 "maximum spacing" po orientaciji — NULL = NI dokumentiran → eksplicitne pozicije obvezne, SDK kanon S+8.1; kubo pokončno NULL honest], razmakKvalifikatorji JSON [NE-baza/h/v ključi: horizontalWithMidConnection/verticalOver150Cm/horizontalUpperBound — brez izgube, brez izuma], gapMin/Max, ročaj/posebnosti/viri JSON, pravice pending|granted|rejected pariteta SDK RightsStatus; ProductApplication — §14 aplikacije EKSPPLICITNE: nabor EXACT HORIZONTALNA_OGRAJA|POKONCNA_OGRAJA|TERASA|PREDELNA_STENA|FASADA|STROP × horizontal|vertical, ODSOTNOST vrstice = aplikacija NI dokumentirana [fail-closed: KUBO uradni vir = FASADNA stran, montaža SAMO vertikalno — "uporaba kot balkonska ograja NI uradno dokumentirana — zabeleženo odkrito" → KUBO ima SAMO FASADO/vertical/1000 (podkonstrukcija razmak do 100 cm), DESKA-150 SAMO TERASA, POLNA-100 SAMO POKONCNA_OGRAJA ("Primerne SAMO za pokončno ograjo"), PREDELNA_STENA/STROP = 0 vrstic za VSE — flat profile dropdown do R390 NI imel tega konteksta: monte bi lahko montiral KUBO na balkon brez opozorila]; UNIQUE(productId, aplikacija, orientacija) + vir citat OBVEZEN; ProductVariant — barvne/površinske izvedbe, barvaId validiran PROTI družinski paleti (neznana → 400 s seznamom), barvaHex preverjen proti paleti (NE izmišljen §8); SEED PRAZEN [§8: colorsCount je ŠTEVEC (4–8 po profilu/orientaciji), NE enumeracija — katere barve veljajo za katere profile katalog NE imenuje → NE izmišljamo; vpiše pisarca prek /api/catalog]; ProductAccessory — čepi/letvica/pokrovček/ročaj/steber, šifra = EXACT id iz kataloga; ProductCompatibility — XOR cilj [CHECK natanko EN: kompatibilenProductId ALI kompatibilenDodatekId], samo-kompatibilnost 400, partial UNIQUE po vrsti cilja [ZADNJA linija za vzporedne zapise, prva = store 409 v isti tx]; ProductSupplierMapping — produkt ↔ Supplier z veljavnostnim intervalom (§14 "supplier mapping" + "effective dates"; prekrivanje → 409 intervalaSePrekrivata polodprto [od, do) — sosednji NI preklik; PATCH preklici zapre odprto, že zaprta 409; RESTRICT na Supplier)]; (2) **SEED = generator, NE ročno prepisovanje** [scripts/r390-seed-sql-gen.mjs — COMMITIRAN generator čita data/roksal-catalog.json in izpiše SQL byte-exact: enak vhod → enak SQL (determinizem preverjen ×3); vrednosti vseh 8 produktov/10 aplikacij/5 dodatkov/12 kompatibilnosti IZKLJUČNO iz JSON vira; izpeljave INTERNI-OKREPIEVANJE/aplikacije/kompatibilnost so DOKUMENTIRANE preslikave katalogovih besedil z citatom vira v vsaki vrstici; verzija v1 'katalog-v1' ACTIVE + opomba z round/retrievedAt/sha256[0:16] vira; test r390-catalog-seed DOKAZUJE pariteto BAZA == JSON za VSA polja VSEH profilov]; (3) **čisto jedro + transakcijska plast** [src/lib/catalog-domain.ts: NIČ baze/ure/IO (stražar vira v testu) — nabori §14 EXACT + validacije fail-closed s seznami + matrika prehodov verzije + resolveAktivnaVerzija (as-of resolucija; več ACTIVE → napaka; [od, do) polodprto) + intervalaSePrekrivata + XOR kompatibilnost + zod sheme JSON kolon (pokvarjen JSON = javna napaka, NE tiho pražen niz); src/lib/catalog-store.ts: EN VIR vseh mutacij — rute NE pisjejo direktno; revizija ATOMSKA §19 [KATALOG_VERZIJA_CREATED/AKTIVIRANA/UPOKJENA + PRODUKT_CREATED/APLIKACIJA_ADDED/VARIANTA_CREATED/KOMPATIBILNOST_ADDED/DOBAVITELJ_ADDED/PREKLICAN]; katalogSnapshot + produktiZaAplikacijo fail-closed BREZ ACTIVE verzije → 409 (NE mešaj upokojenih produktov v "aktualni" katalog — snapshot filtrira na catalogVersionId AKTIVNE verzije); R294 F4: asOf OBVEZEN parameter (stena ure v ruti — prvi tek je ujel new Date() v jedru, LEKCIJA); ustvariProduktVTx: EXACT šifra dedup 409, družina/verzija 404, RETIRED verzija 409, interniOkrepitev brez opisa 400 (NE izmišljamo citata)]; (4) **API rute ×8** [/api/catalog GET (POLNI snapshot: verzija + družine + produkti + aplikacije + dodatki + kompatibilnost + dobavitelji + besednjak aplikacij — §14 EDINA točka iz katere UI bere produktna pravila; ?aplikacija=X[&orientacija=Y] filter — POKONCNA_OGRAJA podmnožica brez terasne/KUBO, FASADA = SAMO KUBO, neznan tip → 400 s seznamom §14) + POST (ustvari produkt — verzija resolucija v store), /api/catalog/products/[id] GET (detajl: aplikacije + kompatibilnost OBE smeri + variante + dobavitelji + kataloška verzija; GET-samo BREZ rate-limit vrata), /[id]/applications GET+POST, /[id]/variants POST, /api/catalog/versions GET+POST (DRAFT z zaporedno številko) + [id] PATCH (discipliniran vnos R378: action 'aktiviraj'|'upokoji'), /api/catalog/compatibility POST, /api/catalog/supplier-mappings POST+PATCH (action 'preklici'); RBAC: pisanje canManageCatalog (catalog.manage — ADMIN/VODJA; MONTER/SKLADISCE samo bereta; apikey ne), branje authenticate (teren potrebuje aplikacijski kontekst); zapisOmejitev R191 na vseh mutirajočih (8 handlerjev); brez idempotenčnega ključa (pisarniški vnos, kanon /api/production POST)]; (5) **80 testov** [r390-catalog-domain ×30: §14 nabor EXACT + oznake + fail-closed validacije (maxRazmak 0/neg/decimal → napaka, null OK §8) + matrika verzije + resolveAktivnaVerzija (6 primerov: znotraj/zaprt/prihodnost/brez ACTIVE/DVE ACTIVE napaka/mejna točka) + intervali (prekrivanje/sosednji/zapriInterval) + XOR + JSON kolone + VIR modula; r390-catalog-seed ×22: pariteta BAZA == roksal-catalog.json VSA polja VSEH 8 profilov (dimenzije/fixing/razmaki/gap/ročaj/posebnosti/pravice/viri/kvalifikatorji) + KUBO FASADA-only + maxPostSpacingV NULL + TERASA samo DESKA-150 + PREDELNA/STROP 0 + dodatki EXACT + 12 kompatibilnosti VSE dodatek-cilj + romb-67 4 dodatki + KUBO 0 + variante/preslikave 0 §8; r390-catalog-api ×15: snapshot (verzija 1/8 produktov/besednjak 6/KUBO FASADA oznaka) + aplikacijski filtri (POKONCNA brez deske/KUBO, FASADA = [kubo], TERASA+horizontal = [deska-150], BALKON → 400 s seznamom, diagonalna → 400) + POST 201/409 dup/404 družina/400 kategorija/400 okrepitev-brez-opisa + RBAC MONTER+SKLADISCE 403 + detajl 200/404 + applications 201/409/400 + variants (201 hex iz palete / neznana barva 400 s seznamom / lažni hex 400 / dup 409); r390-catalog-versions-api ×13: GET seznam + POST DRAFT 2 + RBAC MONTER 403 + aktiviraj (DRAFT→ACTIVE + v1 RETIRED V ISTI TX + snapshot kaže v2 BREZ produktov) + aktiviraj-ACTIVE 409/action 400/id 404 + upokoji (RETIRED + terminalno 409 + snapshot BREZ ACTIVE → 409) + compatibility (201 XOR / oba+noben 400 / self 400 / neznani 404 / dup seed-para 409) + supplier-mappings (201 + preklici zapre + drugič 409 / prekrivanje 409 + sosednji po preklicu 201 / slab interval 400 / neznani 404); POZOR: suite MUTIRA verzije → afterEach OBNOVI seed (v1 nazaj ACTIVE odprt interval, v2 izbrisana) — kanon: testna baza se NE čisti]; PIN SHIFT: r308-api-meja (99→107 route datotek + 8 katalog poti eksplicitno zahtevanih — stena ure 0 kršitev tudi na njih), r191-val2 (58/74→65/82 datotek/handlerjev + 67→74 z zapisOmejitev — +7 katalog rut žičenih, catalog/products/[id] GET-samo BREZ vrata); LEKCIJA R390 (1): R294 F4 stražar ujel new Date() v catalog-store (resolucija verzije "zdaj") → asOf OBVEZEN parameter, stena ure V RUTI (isti vzorec kot crm-store R382 — jedro NE bere ure); LEKCIJA R390 (2): toBe() na nizu JSON.parse je REFERENČNA primerjava — [92,45,5800] === [92,45,5800] false → toEqual za strukture. VERIFIKACIJA: tsc 0 · eslint 0 (FULL) · vitest 5708/5708 (377 = lastniška R389 baza 5628/373 [rebase po KOLIZIJI #24] + mojih +80/+4 — POLN TEK 1 zelen) · build svež rm -rf .next EXIT=0 · qa-round.sh 390 needles EXIT=0 [QA_LEGACY_ROOT + BASH_ENV cd-shim kanon R376; r390.tsv 9 need_static ŽIVO + TODO-R390 must_miss čisto; UNION r340–r390 + lastniška veriga r339→…→R227 VSE ŽIVE] · smoke EXIT=0 [standalone :3100] · leak-check 0 [ghp_ ×0 v diffu] · fetch-first: 2ccba6c..35edf80 pristala MED delom — KOLIZIJA #24 obdelana po kanonu. Naslednji korak #13: R171 (§15 ENGINEERING / COMPLIANCE VERSIONING). ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (84. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA po zaključku.
- **Issue #13, korak R169 — CUSTOMER/LEAD/OPPORTUNITY CRM: Lead + Opportunity + ločeni naslovi stranke (§13)** (R382 — KOLIZIJA #22 [kanon KOLIZIJE #4/R323/#13–#21, 22. potrditev]: vzporedna lastniška QA R381 [30f856e — STIL val 60 nativni prehod-paritetni zaključek + NJIHOV register r381.tsv + r381-stil-val60.test.ts ×6 + era veriga 34. runde] je pristala MED mojim delom [fetch ob needle preverbi: c63ee37..30f856e — žig na njihovi strani govori NJIHOVA KOLIZIJA #22 z NJIHOVO R380→R381 preimenovanjem nad mojo poslovno R380; moja runda je bila v teku kot R381 → preimenovana R381→R382: migracija 20261007080000_r382_crm_lead_opportunity + 4× r382-*.test.ts + žigi + _prisma_migrations vrstica preimenovana V OBEH bazah (dev + test — ista vsebina, novo ime); NJIHOVI r381-* artefakti ostanejo = lastniška zgodovina; NJIHOV r381.tsv NEDOTAKNJEN — TODO-R381 je NJIHOV must_miss, moj je TODO-R382]): (1) **Lead** — surovi stik PRED stranko [§13: "trenutni Customer model je preveč blizu končni stranki" — povpraševanje se je zapisovalo DIREKTNO v stranke brez sledi odkod prihaja]: vir [WEB|TELEFON|EMAIL|PREPOROKA|OBSTOJECA_STRANKA|SEJEM|DRUGO — starter nabor + DRUGO, enaka iskrena odločitev kot prior­itete R378], kontakt [ime/telefon/email — OSEBA, ne stranka], tipPovpraševanja [BALKON|TERASA|STOPNISCE|OGRAJA|DRUGO — konteksti ki jih rep DEJANSKO podpira], status [NOV|KONTAKTIRAN|PRETVORJEN|ZAVRNJEN — PREDkvalifikacijski nabor, ZAVESTNO NI druga kopija prodajne cevi: §13 lifecycle živi na Opportunity.stage, ki ima v specu polje "stage"; Lead.status je manjši], owner [Profile FK SET NULL — odhod lastnika NE pobije sleada, NULL = neprevzet honest §8], nextActionAt [NULL = ni dogovorjene akcije — ne izmišljan datuma]; CHECK ×3 v migraciji; (2) **Opportunity** — poslovna priložnost §13 [leadId NULL = direktna/repeat posel; customerId NULL dokler ni stranka — zgodnja faza pogajanj ŠE NI stranka, ob ACCEPTED OBVEZNO fail-closed 409; naziv/opis = potential project; ocenjenaVrednost Decimal(12,2) — denarna domena R380, >2 decimalki → 400 GLASNO prek zaokroziDenar eksaktnosti, NULL = ocena neznana §8 NIKOLI 0 kot lažni "neznano"; stage lifecycle §13 EXACT: NEW→CONTACTED→SITE_SURVEY→QUOTE→FOLLOW_UP→ACCEPTED|LOST — matrika v crm-pipeline.ts EN VIR z DOKUMENTIRANIMI prepovedanimi robovi: preskoki naprej DOVOLJENI [stranka pride z že opravljenim ogledom NEW→SITE_SURVEY — prisiljevanje lažnih vmesnih korakov bi bilo laž §8], LOST iz VSAKEGA živega stage-a [stranka lahko odkloni kdarkoli] Z obveznim razlogIzgube [400 brez — izguba brez razloga je tiha mutacija zgodovine], ACCEPTED SAMO iz QUOTE|FOLLOW_UP [sprejeti se da PONUDBO — kanonična QuoteVersion R374; NEW→ACCEPTED bi pomenilo "sprejeli smo nič"], nazaj-pažni PREPOVEDANI [revizijska sled usmerjena naprej, kanon R378], ACCEPTED→LOST PREPOVEDAN [razpad sprejetega posla je realnost PROJEKTA/Invoice domene, ne prepis CRM zgodovine], terminalca ne oživita [nova pogajanja = NOVA priložnost]; verjetnost Int 0–100 [§13 IZRECNO: "probability ni potrebna kot napoved, lahko pa kot CRM polje brez poslovne logike" — MNENJE prodajalca, nikoli vhod v izračun: denar/odstotki so domena decimal-policy]; convertedProjectId UNIQUE + FK RESTRICT [invariant stage=ACCEPTED ⇒ projekt OBSTAJA ne more tiho razpasti; DELETE pot za projekt v APIju ne obstaja — pregledano]; (3) **CustomerAddress** — ločitev naslovov §13 ["Customer mora ločiti vsaj: contact/mailing address; billing address; installation/site address" — do R382 EN flat naslov = računski in montažni sta bila ISTA resnica]: tip KONTAKTNI|RACUNSKI|MONTAZNI [CHECK; EXACT kanon §5 — 'kontaktni' lowercase → 400 s seznamom, NE tiha normalizacija], VEČ MONTAZNI naslovov dovoljenih [upravniki stanovanjskih skupnosti imajo več objektov], partial UNIQUE (customerId, tip) WHERE jePrivzet [strežniška plast demote-a V ISTI transakciji — VRSTNI RED KLJUČEN: demote PREJ create/update, sicer index sproži; DB = zadnja linija za vzporedne zapise], LEGACY SINHRON [Customer.naslov flat NOT NULL od init — mobilni klienti/PDF ga berejo, kanon §1 NE rušimo: ostane PRIKAZNO polje, ob spremembi PRIVZETEGA KONTAKTNI ga crm-store posodobi V ISTI transakciji; ob brisanju pade na najstarejši preostali KONTAKTNI; brez privzetega nosi zadnjo znano vrednost — dokumentirana prikazna meja, NE tiha dvojna resnica], backfill [vsak obstoječi Customer.naslov → PRIVZETI KONTAKTNI CustomerAddress, deterministični id 'custaddr-'||customer.id — KONSOLIDACIJA obstoječe resnice, RACUNSKI/MONTAZNI se NE izmišljujejo §8 — vpiše jih pisarna ko jih bo preverila]; tip se NE spreminja ob urejanju [tip je ZAVEZA kam pošiljamo/računamo/mondiramo — naslov drugega tipa = NOVA vrstica]; (4) **čisto jedro + transakcijska plast** [src/lib/crm-pipeline.ts: NIČ baze/ure/IO, stražar vira v testu — production-orders R378 vzorec; src/lib/crm-store.ts: EN VIR vseh mutacij — rute NE pisjejo direktno, revizija ATOMSKA z dogodkom §19: LEAD_CREATED/LEAD_STATUS/LEAD_UPDATED/LEAD_CONVERTED + OPPORTUNITY_CREATED/STAGE/UPDATED/CONVERTED + PROJECT_CREATED [vir: "pretvorba priložnosti" — projekt nastane V ISTI transakciji kot ACCEPTED] + CUSTOMER_ADDRESS_CREATED/UPDATED/DELETED; terminalna stanja ZAMRZNJENA 409 [kontakt, ki je pripeljal do posla/odbitve, se ne retroaktivno prelepi — revizijska sled bi lagala KAJ je bilo takrat]; R294 F4 stena ure v ruti]; (5) **API rute ×6** [/api/leads GET+POST [filtri status/ownerId/search insensitive+escapeLike R138 kanon, limit/offset strop 500 §17], /api/leads/[id] GET+PATCH [discipliniran vnos R378 kanon: action 'transition' {to, pretvorba?} | 'update' {polja} — PRETVORJEN zahteva payload naziv+customerId? → priložnost nastane V ISTI transakciji, stage NEW], /api/opportunities GET+POST [stage filter STROGO iz §13 nabora — 400 sicer, ne tiho prazen seznam], /api/opportunities/[id] GET+PATCH [transition: LOST zahteva razlog, ACCEPTED = transakcijska pretvorba → Projekt NACRTOVANO + convertedProjectId; update: živi stage-i samo], /api/customers/[id] GET [DETAJL VRZEL ZAPRTA — do R382 ni bilo detajl poti stranke: naslovi RAZDELJENI po tipih prek razdeliNaslovePoTipih fail-closed + priložnosti + števci projektov/ponudb/priložnosti + decToPlain Decimal DTO R380], /api/customer-addresses GET+POST + [id] PATCH+DELETE [GET brez customerId → 400 — naslovi brez stranke so IDOR vprašanje]; RBAC: pisanje canManageCustomers [customers.write — R156 CRM precedens, MONTER+ piše/SKLADISCE bere/apikey ne], branje authenticate [enak prag kot GET /api/customers]; zapisOmejitev R191 na vseh pisanjih; brez idempotenčnega ključa [pisarniški vnos, ne offline vrsta — kanon /api/production POST]]; (6) **58 testov** [r382-crm-pipeline ×22: matrika sleada + stage §13 vsak dovoljen/prepovedan rob + terminalnost + requiresLossReason/requiresProjectConversion + verjetnost meje + naslovi EXACT/razdelitev fail-closed + VIR modula; r382-leads-api ×14: privzeti honest NULL + fail-closed viri/tipi/owner 404 + RBAC SKLADISCE 403 + matrika + PRETVORJEN brez naziva 400/z njim 200 + priložnost V ISTI transakciji + terminalna zamrznitev; r382-opportunities-api ×12: honest NULL + verjetnost 101/1.5 → 400 + ocena 3dp → 400 + preskok nazaj 409 + LOST razlog + ACCEPTED brez stranke 409/brez naziva 400/polna pretvorba → PROJEKT V ISTI TRANSAKCIJI [NACRTOVANO + customerId + convertedProjectId vezan] + terminalca 409 + DTO number; r382-customer-addresses-api ×10: trije tipi + več MONTAZNI + EXACT zavrnitve + demote + LEGACY SINHRON ×3 smeri [nov privzeti/sprememba naslova/brisanje → naslednji] + GET grouped + customers/[id] detajl + RBAC]; PIN SHIFT: r191-val2 [52/67→58/74 datotek/handlerjev + 61→67 skupaj z zapisOmejitev — +6 CRM rut žičenih, customers/[id] GET-samo BREZ vrata], r308-api-meja [92→99 route datotek v obsegu pregleda + 7 CRM poti eksplicitno zahtevanih — stena ure 0 kršitev tudi na njih]; LEKCIJA R382 (1): partial UNIQUE vrstni red — create/update z jePrivzet=true PREJ demote-a sproži index → demote PREJ mutacijo (2 testa sta ujela PRED full tekom); LEKCIJA R382 (2): closure zoženje parsed.value ne preživi — lokalna const (R378 lekcija). VERIFIKACIJA: tsc 0 · eslint 0 · vitest 5552/5552 (360 = lastniška R381 baza 5494/356 [rebase po KOLIZIJI #22] + mojih +58/+4 — POLN TEK 1 zelen) · build svež EXIT=0 · qa-round.sh 383 needles EXIT=0 [QA_LEGACY_ROOT + BASH_ENV cd-shim kanon R376; r382.tsv 5 need_static ŽIVO + TODO-R382 must_miss čisto; UNION r340–r382 + lastniška veriga] · fetch-first ×0 v HEAD 30f856e potrjeno za VSE 5 needlejev. Naslednji korak #13: R170 (§14 PRODUCT CATALOG — Application Context). ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (81. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA po zaključku.
- **nativni prehod-paritetni zaključek val 60 + FEATURE r381-era-ruta-map.py (needle→ruta) + r381-window-scan.py (10. generalizacija: +3 tarče, DEL 4 in-place varstvo) + REGISTER EVOLUCIJA (3. uporaba) — KOLIZIJA #22** (R381; runda preimenovana R380→R381 — njihova poslovna R380 [2f5cb30, issue #13 R168 §12 REAL UNITS + DECIMAL + c63ee37 lastni worklog vnos] je pristala MED mojim delom in vzela številko; backup branch r380-ai-delta + reset --hard origin/main + delta re-aplicirana s preimenovanjem mojih artefaktov r380-*→r381-*; val 60 OSTANE val 60 — poslovne runde NE porabijo val, kanon R375; njihovi r380-* artefakti ostanejo = njihova zgodovina; r380-era-harvest.sh [33rd, moja generacija pre kolizije] ostane pod izvirnim imenom — kanon R379/r378-era-harvest.sh): (1) **prva naloga (pre koliziji, aritmetika nespremenjena)** — prod-qa re-run prek `r359-prod-qa-retry.sh 379`: **ZELEN ob poskusu 1** (16. runda zapored) + **TRIINTRIDESIJNA era preverba** `r380-era-harvest.sh` [33 registrov r347–r379, ≥134 = vsota iz diska]: **EXIT=0 ob OBEH tekih** (determinizem) — **val 59 needleji VSI 4 ŽIVO DIREKTNO** (chunk_014/031/028 ×2) → **val 59 deploy POTRJEN v celoti**; must_miss ×33 čisto; (2) **val 59 POST-deploy spot** `r381-qa-spot.sh` (spot-r167/23; mounted + className LOČENO; ZERO-MUTACIJA — NIČ klikov na odjavo/preklic, samo Radix meni/dialog odpiranje po kanonu r186 pointerdown+click): (A) top-bar meni → **N1 2/2 rdeča DropdownMenuItema FULL parity** (ring-2+red/40+offset-2+gap-2 ločeno ×2) + Escape → 0; (B) sessions-dialog → **47 sej: 46 preklici + 1 ostali = 47/47 parity** ločeno ×47 + Escape zaprt (NO revocation — dinamična disk resnica); (C) dashboard N3 **iskreno 0** (invError/narocilaError vrata, kanon r277); (D) catalog N4 **iskreno 0**; navy sonda 10/0/10 (catalog površina — val 52 ne pokriva roksal-catalog navy = znan kandidat, NE regresija); kolektor **0**; (3) **MANDATORY STIL val 60 — NATIVNI PREHOD-PARITETNI ZAKLJUČEK**: disk resnica `r381-triaza.py` [element klasifikacija z retrograde tag-walkom; **LEKCIJA R381 (1): handover kandidat številke = repvidljivi podniz censusa (31) — polna disk resnica 170 vrstic (155 navy + 15 red); triaža pred apply OBVEZNA**; 170 = **154 × <Button> transition-all IZ BAZE → N/A** + **3 × nativni <button>** + 13 drugo (8 input/textarea FROZEN izjema #2 + **5 × top-bar DropdownMenuItem** — ui/dropdown-menu.tsx BREZ transition)]: **11 × INS na 8 vrsticah, in-place 0 novih vrstic** — 3 nativna gumba `INS ' transition-colors' PRED 'focus-visible:ring-2'` (kanon val 58): audit-trail-dialog L310, measurements-tab L4020 ('Naloži stopnično predlogo'), photo-tab L2370 ('Uredi mero') + 5 top-bar meni itemov transition-colors, 3 navy INORE `' focus-visible:ring-offset-2'` (val 52 pairing kanon — meni-notranja pariteta z rdečima sestro iz val 59); `r381-val60-apply.py` fail-closed (scan→11/11, idempotenca 0); stale-pin pre-skan delta ×2 (+18/+28) = 0 preozkih; `r381-stil-val60.test.ts` **×6 ZELENO** [(A) signaturne vrstice 1/5/1/5 + zamrznjeni števci, (B) top-bar meni pariteta evolved ×3+×2 / stara ×0, (C) nativni gumbi evolved ×1 / pre-val ×0, (D) FROZEN izjema #2 natančni podnizi, (E) obrnjena regresija val 59 KANON ×25 + val 55 + val 58 + amber 100%, (F) vrstični brez-transition **170→162**]; **LEKCIJA R381 (2): element vs vrstica disk resnica** — triaža (3+8) se NE preslika na vrstične filtre (SIGNATURA vključuje že-parirane; vrstični brez-transition 162 ne 8 — Button nosi transition-all šele v renderu); 3 faila ujeta PRED FULL tekom, popravljena V ISTI rundi; (4) **REGISTER EVOLUCIJA** (kanon r371 N3/R377, **3. uporaba** prek `r381-evolucija.py` fail-closed): val 60 evoluiral **r379 needle #1** (top-bar CMP par — ISTI vrstici kot val 59 pin) → stara vrstica KOMENTIRANA 'EVOLVED R381 val 60' + **NASLEDNICA** 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2' — **need_static r379 = 4 NESPREMENJEN** (era vsote veljavne); NASLEDNICA ŽIVO ob TEM pushu; **PIN SHIFT žigi 'PIN SHIFT R381 val 60 / EVOLVED'** v r372 (D) + r379 (D) + nova ×0 asercija stare oblike; (5) FEATURE **`r381-era-ruta-map.py` — needle→RUTA mapping** (preciznejši server dokaz): 151 need_static needlejev r340–r381, tri jezika — ruta-direktno (obrnjen app-paths-manifest) / prek-importa (enostopenjsko, iskreno) / probe-ruta (SERVER_PROBE_SPECS); client-only = shared-client-chunk iskreno; REZIME: /api/price-book 4, /api/installation-records 4, /api/bom/[id] 2, /api/bom/procurement 1, /api/deal-lock 1, /api/calculator 1 + shared-client/server iskreno; **LEKCIJA R381 (3): findall capture group brez '.tsv' → None.search abort — poprava int(p[1:]) (orodje ujelo svojo hroščo, 3. ponovitev vzorca R379 (1)/R369)**; (6) **`r381-window-scan.py` — 10. generalizacija** (r379 8. generacije NIKOLI ne mutirana): TARGETS +3 val 60 tarče, REG window 340–381 tolerantno, **DEL 4 NOVO: in-place varstvo** (PRIČAKOVANE_VRSTICE z diska; odstopanje = EXIT 1); končni scan EXIT=0; (7) e2e-lib dedup 17. val ISKRENO IZPUŠČEN (kanon R368). REGISTER `scripts/qa-needles/r381.tsv` [4 need_static: top-bar navy evolved ×3, audit-trail ×1, measurements ×1, photo ×1; 0 v HEAD c63ee37; rdeči par pokrit prek r379 NASLEDNICE — brez duplikata; must_miss TODO-R381; NF=3] prek `r381-register-write.py` fail-closed. **LEKCIJA R381 (5): era-clone reg_var črkovni drift (AG=r379, AH=r380 — 26-črkovni prelom pri AA=r373) + 2c spec-list ZAMENJAVA — ob novem registru ponovno podaj VSE spec-e (2× orodje-lovi-svojo-hroščo: EXIT=2 diagnoza → AH fix → AG izpadel → 7-spec fix → EXIT=0 ×2); prisma generate stale client ×91 toNumber (R377 (1) ponovitev) + migrate deploy URL citat (R377 (8) ponovitev)**. **LEKCIJA R381 (4): PO asercija iskala napačen žig ('R380' namesto 'R381 prva naloga =') — fail-closed abort PO zapisu; datoteka pravilna, popravljen skriptov assertion (4. ponovitev orodje-lovi-svojo-hroščo)**. VERIFIKACIJA (celotna, FOREGROUND, na KONČNI viri PO re-aplikaciji KOLIZIJE #22): tsc 0 · eslint 0 (FULL) · vitest **5494/5494 (356) FULL GREEN** [= njihova baza 5488/355 + mojih +6/+1] · build svež rm -rf .next EXIT=0 [na njihovi shemi — 21 Float→Decimal] · qa-round.sh 381 needles EXIT=0 [r381.tsv 4 ŽIVO + TODO-R381 odsoten + r379 NASLEDNICA ŽIVO + njihov r380.tsv ŽIVO; UNION r340–r381 + veriga r339→…→R227] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · r380-era-harvest EXIT=0 [33rd ×2] + r381-era-harvest **EXIT=0 ×2 [34th — 138/138 ŽIVO: 118 direktno + 20 resolucij; njihovi 4 prek /api/inventory 401; NASLEDNICA prek /api/price-book 401]** · r381-window-scan EXIT=0 · r381-era-ruta-map EXIT=0 · r359-prod-qa-retry 380 ZELEN ob poskusu 1 [njihov deploy] · leak-check čist (ghp_[A-Za-z0-9]{30,} ×0 na HEAD). NOVO: scripts/qa-needles/r381.tsv + skripte [r381-era-harvest.sh, r381-qa-spot.sh, r381-triaza.py, r381-val60-apply.py, r381-window-scan.py, r381-evolucija.py, r381-era-ruta-map.py, r381-register-write.py, r381-readme-update.py, r381-worklog-append.py, r381-commit-msg.txt] + r381-stil-val60.test.ts [×6] + UREJENO: audit-trail-dialog.tsx, measurements-tab.tsx, photo-tab.tsx, top-bar.tsx [val 60 INS], r372-stil-val55.test.ts [PIN SHIFT], r379-stil-val59.test.ts [PIN SHIFT], r379.tsv [EVOLVED+NASLEDNICA], README. Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 60 = render plast a11y className-only v 4 render datotekah]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme [ZERO-MUTACIJA E2E; njihova shema = njihova poslovna odločitev]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (81. zapis). ⚠️ njihova nota: žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R382 prva naloga = qa-round.sh 381 prod-qa re-run [prek r359-prod-qa-retry.sh 381] + petintrideseta era preverba r347–r381 [35 registrov, ≥142 = 138 + 4; prek era-clone.py --src-round 381 --expected-total 142 --dst-label "R381 val 60"; pričakuj 142/142 ŽIVO [r381 4 needleji razrešeni ob TEM pushu]] + val 60 POST-deploy verifikacija [4 needleji r381.tsv; vrata: top-bar meni (pointerdown+click na aria-label="Odjava" — kanon r186; 3 navy itemi zdaj transition+offset-2), audit-trail dialog razpiranje, measurements stopnične predloge, photo 'Uredi mero'; mounted + className LOČENO; NIČ klikov na odjavo/preklic]. R382 kandidati: 1. C/border-pariteta družina [crm-tab ×13 + dashboard ×7 + bottom-nav ×2 + calculator ×2 + audit ×3 + cena paneli ×4 + safety ×2 + team ×6 + termini ×6 + vodja ×4 + site-survey ×1 + sketch ×1 — triaža pred apply OBVEZNA, LEKCIJA R381 (1)]; 2. A/offset ostanki [top-bar navy meni ×3 RESOLVANA; dashboard Input L1623 = izjema #2 zamrznjena + preostanek]; 3. era-harvest ruta stolpec INTEGRACIJA v era-clone.py; 4. e2e-lib dedup 18. val [po kanonu]. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **Issue #13, korak R168 — REAL UNITS + DECIMAL: centralna zaokroževalna politika + kanonične enote + konverzija + 21 Float→Decimal stolpcev (§12)** (R380 — KOLIZIJA #21 [kanon KOLIZIJE #4/R323/#13–#20, 21. potrditev]: vzporedna lastniška QA R379 [9c36c51 — STIL val 59 red/40 offset-2 + era-clone generalizacije + NJIHOV register r379.tsv] pristala MED mojim delom (moj lokalni commit d25d2cf kot 'R379' je bil ob pushu ZAVRNJEN — fetch-first kanon LEKCIJA R344) → moja runda preimenovana R379→R380 [migracija 20261006080000_r380_decimal_units + r380.tsv + 4× r380-*.test.ts + žigi]; njihovi r379-* artefakti ostanejo = lastniška zgodovina; njihov r379.tsv NEDOTAKNJEN): (1) **centralna politika**
  `src/lib/decimal-policy.ts` [ČISTO jedro + direktna odvisnost decimal.js 10.6.0 — ISTA verzija kot Prisma-va transicijska,
  ena kopija]: preciznost po domenu ZAMRZNJENA [denar 2 · količina 3 · faktor 4 · odstotek 2 — pogodba s shemo
  DECIMAL(12,2)/(12,3)/(6,4)/(5,2)]; načini GORI/DOL/NAJBLIZJE [half-up = PG numeric semantika]; EKSAKTNA aritmetika
  prek String(v) najkrajše reprezentacije [0.145 → 0.15; Math.round bi dal 0.14 — float laž ubita] + vsota v Decimal
  [0.1+0.2 = TOČNO 0.3 — ne 0.30000000000000004]; decToNum/decToNumObvezno [honest NULL §8 — null → null, ne izmišljena
  ničla; smeten string → javna napaka, NE Number('')=0 tiha ničla]; decToPlain [globoki DTO serializer — Decimal → number
  v CELEM drevesu; Date/null/primitivi nedotaknjeni; vhod NI mutiran]; fail-closed NaN/Infinity/neveljavne decimalke;
  (2) **kanonične enote** `src/lib/units.ts` [EXACT 8: kos · m · m² · kg · l · komplet · ura · paket — 'm²' ima SUPERSCRIPT
  U+00B2, NE 'm2'; case-sensitive + presledek-občutljivo — kanon §5 BREZ fuzzy: 'm2' → JAVNA 400 s seznamom veljavnih
  vrednosti, NE tiha normalizacija]; nabor zaokroževanja + preciznost 0–6 podedovana iz decimal-policy [EN VIR];
  (3) **konverzija na Inventarju** [7 NULLABLE stolpcev — purchaseUnit/stockUnit/consumptionUnit/supplierPackSize/
  conversionFactor/precision/rounding; VSI honest NULL §8 — obstoječi materiali NIMAJO teh podatkov, izumljanje bi bilo
  laž; CHECK sloj ×7 na DB [kanon ×3 + pozitivni ×2 + precision 0–6 + nabor]; API: delna prisotnost DOVOLJENA
  [neodvisno znano], izračun zahteva POPOLNOST [izracunajKonverzijo — manjka karkoli → null, ne ugibanje]; zod
  NAMENOMA minimalen — units.ts je EDINA avtoriteta; (4) **migracija 20261006080000_r379_decimal_units** [21 ALTER
  TYPE z explicit USING cast — Project.estimatedPrice/marginLocked [issue #13 SRCE — marža vezana na podpis točna do
  centa], Profil.cenaM, Supplier.popust (5,2), MaterialPrice.cena, InventoryLot.purchasePrice, MaterialOrder.skupajCena,
  MaterialOrderItem.cena, Invoice.osnova/ddv/znesek [eRačun centna točnost] → (12,2); Inventory.kolicinaZaloga/
  minimalnaZaloga, MaterialUsage.porabljenaKolicina, InventoryMovement/StockLedger.kolicina+balanceAfter [revizijska
  sled — verižno izpeljevanje zahteva eksaktnost], InventoryLot.quantityInitial/Remaining, LotAllocation.kolicina,
  MaterialOrderItem.kolicina → (12,3)]; GEOGRAFSKE vrednosti [lat/lng/gps/kotStopinje] OSTAJAJO Float — niso poslovne
  vrednosti §12 [dokumentirana meja]; obstoječi CHECK-i R136/R319 prenesejo ALTER TYPE; legacy enota/unit ostajajo
  prosti string [produkcijska data pred kanonom — prisilna normalizacija bi bila fuzzy preslikava §5]; BREZ seeda —
  prazno je iskreno; (5) **FAILO-CLOSED PRECIZNOST premikov**: količina z >3 decimalkami → 400 z javno mejo [DB bi jo
  TIHO zaokrožil = tiha mutacija]; (6) **LOKALNA zaokroževanja IZBRISANA v korist politike**: invoices round2
  [Math.round+EPSILON], procurement Math.round(*1000)/1000 ×11, evidence Math.round ×1, lots round6 → kompatibilnostni
  vzdevek ki delegira na politiko + epsilon 1e-9 ×2 ODSTRANJENA [vsota je zdaj eksaktna — toleranca je pokrivala
  float laž]; (7) **Decimal string-comparison PAST zaprta** [inventory LOW_STOCK: Decimal < Decimal v JS gre prek
  valueOf → STRING primerjava "5"<"10"=false — prehod v number edini varni način; dokumentirano]; (8) **DTO serializacija**
  [decToPlain na vseh rutah ki vračajo surove vrstice: inventory ×4, invoices ×5, material-orders ×4, suppliers ×3,
  profili ×2, projects ×2, crm, search, material-prices ×3 — Decimal v JSON = string → klientova aritmetika NaN;
  r374/r376/r378 rute so imele .toNumber() že od začetka]; (9) 65 novih testov [r380-decimal-policy ×22: half-up
  simetrija, GORI/DOL, 0.145→0.15, vsota 0.1+0.2=0.3 [dokaz float laži + njene odstranitve], enkratna zaokrožitev
  vsote, honest NULL, smeten string, decToPlain drevo/Date/nemutacija + r380-units ×16: nabor bajtno zamrznjen
  [charCodeAt U+00B2 dokaz], EXACT zavrnitve m2/M/presledki, sporočilo s seznamom, konverzija delna/poplena/
  neveljavna, izračun null pri pomanjkljivosti + r380-decimal-db ×7: round-trip 0.1+0.2=0.3 v bilanci IN ledger
  verigi, fail-closed 3dp z nespremenjeno zalogo, Invoice/Project centna točnost, MaterialPrice/Supplier/Profil,
  DB CHECK zavrnitve [m2 + faktor 0] + r380-conversion-api ×9: popolna 201, m2 → 400 s seznamom, KOS → 400,
  faktor 0 → 400, packSize < 0 → 400, precision 7 → 400, NAJBLIŽJE → 400, brez konverzije → VSA NULL, delna →
  samo prisotna]; PIN SHIFT-i: r144-lots [Decimal toNumber ×15 + round6 policy delegacija], inventory-ledger ×9,
  db-integrity ×6, r374-deal-lock ×1, r209 [decToPlain window — PATCH odgovor teče prek mostu], r172 [portal page
  enovrstični komentar — PIN NESPREMENJEN]; decimal.js direktna odvisnost 10.6.0 [ista verzija kot transicijska —
  dedup, ena kopija]; VERIFIKACIJA: tsc 0 · eslint 0 · vitest 5488/5488 (355 = lastniška R379 baza 5423/351 [rebase po KOLIZIJI #21] + mojih +65/+4 —
  POLN TEK 1 zelen) · build svež rm -rf .next EXIT=0 [roksal_dev migrate deploy r379 + podatki preživeli: zaloga
  180.000 exact, purchaseUnit NULL honest — BREZ dropa: ALTER TYPE prireditveni cast ohrani vrstice] · qa-round.sh
  380 needles EXIT=0 [QA_LEGACY_ROOT + BASH_ENV cd-shim kanon R376; lastni register r380.tsv 4 need_static ŽIVO ×1
  .js + TODO-R379 must_miss čisto; UNION r340–r379 + legacy veriga VSE ŽIVE] · fetch-first ×0 v HEAD 9c36c51
  potrjeno za VSE 4 needleje. Naslednji korak #13: R169 (§13 Customer/Lead/Opportunity — CRM konsolidacija).
- **Issue #13, korak R167 — PROIZVODNA + AS-INSTALLED DOMENA: ProductionOrder/Line/Operation + InstallationRecord/Line + količinska veriga QUOTE → BOM → PRODUCTION → INSTALLATION (§9 + §10)** (R378 —
  KOLIZIJA #20 [kanon KOLIZIJE #4/R323/#13–#19]: vzporedna lastniška QA R377 [aea8720 — STIL val 58 + era-clone --server-probe]
  pristala MED mojim delom in vzela številko → moja runda preimenovana R377→R378; reset --hard origin/main, delta re-aplicirana s
  preimenovanjem artefaktov [r378.tsv + r378-*.test.ts ×4 + migracija 20261005080000_r378_production_domain + PIN SHIFT žigi];
  njihovi r377-* artefakti ostanejo = delegirana zgodovina; njihov r377.tsv RESTAVRIRAN nedotaknjen; jedro iz prejšnje prekinjene
  seje ostalo v delovnem drevesu in je bilo KVALITETNO — dokončano, preimenovano in preverjeno v tej rundi): (1) **§10
  ProductionOrder** — proizvodni nalog NAD ODOBRENIM BOM [statusni stroj PLANNED→RELEASED→IN_PRODUCTION→QC→PRODUCED→
  READY_FOR_INSTALLATION + izidi REWORK/REJECTED/SCRAPPED/REPLACED v src/lib/production-orders.ts EN VIR; vsak izid ZAHTEVA
  razlog (odmik brez razloga = tiha mutacija zgodovine); IZRECNO PREPOVEDANI robovi dokumentirani (preskok izpusta, lažni REWORK
  pred izdelavo, oživljanje terminalcev, nazaj-paženi); prioritetna validacija NIZKA/NORMALNA/URGENTNO]; (2) **ProductionOrderLine**
  — vrstica = SNAPSHOT BOMLine [plannedQty = quantity ob ustvarjanju; produced/rejected/scrapped/remaining — remainingQty
  STREŽNIŠKO izračunan (planned − produced − scrapped), klientov total SE NE SPREJME ( forged test); invarianti: rejected ≤
  produced, produced + scrapped ≤ planned (409 — sprememba načrta je change order)]; (3) **ProductionOperation** — operacije
  [operationType prosto ≤ 100 znakov (izumi so izum), sequence, plannedDurationMin/actualDurationMin Int NULL honest §8,
  operatorId FK Profile SetNull, statusni stroj PLANNED→IN_PROGRESS→DONE|FAILED (FAILED→PLANNED ponovni poskus)]; (4) **§9
  InstallationRecord** — VERZIONIRANA tretja resnica [DRAFT→POTRJENO terminalno — sprememba potrjene resnice = NOVA verzija
  zapisa (kanon QuoteVersion/BOMVersion); @@unique([projectId, versionNumber]); vezave na obstoječe entitete (schedule/crew/
  monter/qc/evidence PONOVNA UPORABA QualityControl + InstallationEvidence — brez duplikacije fotografij) vse ENAKO projektno
  področje (prečni dostop 409); VEZANA vrstica dobí internalSku SNAPSHOT strežniško (klientov SKU se PREPISE — testirano);
  bomLineId NULL = vgrajen material IZVEN BOM (iskreno, ne tiho pripet); defectsJson isti fail-closed vzorec kot R147 (≤ 20,
  opomba obvezna); handover dokaz OB potrditvi; actualMeasurementsJson NULL ali VELJAVEN JSON]; (5) **meja zaklepa R167**
  (dokumentirana odločitev): USTVARJANJE naročila/zapisa po zaklepu → 409 (nova zaveza = change-order teritorij §6/§7), IZVEDBA
  obstoječega (prehodi + zapis produkcije + potrditev zapisa) LAHKO teče naprej — fizično delo v teku se ne sme zadaviti z
  zaklepom papirja (monter na zaklenjenem projektu dobi 403 od RBAC — zaklenjen dogovor ne dovoljuje monterjevih sprememb);
  (6) **§9 količinska veriga v /api/bom/procurement** — DODATNO (additivno, bajtno združljivo): producedQty = Σ
  ProductionOrderLine.producedQty VSEH nalogov nad vrstico (BREZ statusnega filtriranja — števec živi na VRSTICI; pravilo
  »samo PRODUCED nalogi« bi tiho izbrisala fizično izdelano v REWORK/REPLACED); installedQty = Σ InstallationRecordLine.
  installedQty SAMO POTRJENIH zapisov (DRAFT NI resnica — osnutek v pisanju OSTANE NEVIDEN, test IZRECNO dokazuje izključitev);
  NEVEZANA vrstica → obe NULL (količinska veriga nad nevezanim materialom ni DOKAZLJIVA — iskreno NULL, nikoli ničle);
  preslikava.viri dokumentira oba vira v odgovoru; (7) **API rute** — POST/GET /api/production + GET/PATCH /api/production/[id]
  (PATCH: action transition | record-production — stroga shema, forged remainingQty → 400 GLASNO) + POST/GET /api/
  installation-records + GET/PATCH /api/installation-records/[id] (SAMO approve; handover ob potrditvi) — hišni vzorec
  authenticate/lacksPermission/assertProjectAccess/zapisOmejitev/preberiJsonTelo/auditInTx/fail-closed (RBAC matrika
  ZAMRZNJENA — quotes.create izpeljava kataloga §10, isti prag kot /api/bom); (8) **§10 STRAŽAR GEOMETRIJE** — produkcija NE
  izračunava (test bere VIR modula: ni uvoza railing-layout/quote) — snapshoti ODOBRENEGA BOM so EDINI vhod; (9) **migracija
  20261005080000_r378_production_domain** [5 tabel + indexi; CHECK vse VALIDATED; brez seeda — prazno je iskreno §8; FK:
  bomVersionId RESTRICT (odobreni BOM je vir), projectId CASCADE, schedule/crew/monter/qc/evidence SET NULL (resnica preživi
  brisanje termina), bomLineId RESTRICT (sled ne laže)]. PIN SHIFT-i: r191 val2 48/63→52/67 handlerjev (skupaj 57/73→61/77 —
  tudi VARNOST.md pokritost vrstica) + r308 88→92 route datotek (+production, +production/[id], +installation-records ×2) —
  legitimna rast obsega novih kanonskih rut, dokumentirana v testih s PIN SHIFT žigi. Verifikacija: tsc 0 · eslint 0 · vitest
  5417/5417 (350 datotek = lastniška R377 baza 5363/346 + mojih +54/+4: r378-production-orders ×23 [matrika VSEH robov —
  dovoljeni + prepovedani + terminalci + rework zanka + razlogi + determinizem + fail-closed izpeljava + strážar geometrije
  iz vira] + r378-production-store ×15 [APPROVED-only vrata 409; prečni 409; zaklenjen 409; forged totali — remainingQty
  strežniški; invarianti 409; terminalno ne zapisuje; izvedba OB zaklepu teče] + r378-installation-records ×10 [SKU snapshot
  PREPISAN; qty 0 → 400; podvojen bomLineId → 400; prečna vrstica 409; zaklenjen 409 (vodja prečka vrata); verzioniranje;
  approve terminalno 409; approve OB zaklepu uspe (vodja); prazen seznam iskren] + r378-quantity-chain ×6 [produced = Σ vsi
  nalogi; installed = Σ SAMO POTRJENIH — DRAFT izrecno NE šteje; seštevanje verzij; NEVEZANO NULL; idempotentna branja;
  preslikava.viri dokumentacija]] · build svež EXIT=0 [roksal_dev DROPPAN + rebuildan iz nič + seed — kanonično sandbox
  stanje po lastniški R377 lekciji] · qa-needles/r378.tsv [4 need_static ŽIVO v .next/server+static + TODO-R378 must_miss
  čisto 0; fetch-first ×0 v HEAD aea8720 potrjeno — po KOLIZIJI #20 re-verify]. Naslednji korak #13: R168 (§12 real units +
  Decimal + centralno zaokroževanje).
- **Issue #13, korak R166 — KANONIČNI BOM: BOM/BOMVersion/BOMLine + EXACT inventarna vezava + procurement agregacija (§5/§6/§11 + §7 vezava)** (R376 —
  KOLIZIJA #18 [kanon KOLIZIJE #4/R323/#13–#17]: vzporedna lastniška QA R375 [f2242729 — val 57 ring↔border + era-clone.py]
  pristala MED mojim delom in vzela številko → moja runda preimenovana R375→R376; reset --hard origin/main, delta
  re-aplicirana s preimenovanjem artefaktov [r376.tsv + r376-*.test.ts + migracija 20261004080000_r376_bom_versions];
  njihovi r375-* artefakti ostanejo = delegirana zgodovina; jedro iz prejšnje prekinjene seje ostalo v delovnem drevesu
  in je bilo KVALITETNO — dokončano, preimenovano in preverjeno v tej rundi): (1) **BOM** — nosilec projekta
  [projectId UNIQUE = EN nosilec na projekt; status AKTIVEN (ZAPRT rezerviran, še brez prehoda — iskreno dokumentirano)];
  (2) **BOMVersion** — NESPREMENLJIVA verzija [statusni stroj DRAFT→APPROVED + SUPERSEDED v src/lib/bom-versions.ts EN VIR;
  APPROVED/SUPERSEDED terminalni — sprememba = nova verzija/change order (nikoli tiha mutacija, §6); @@unique([bomId,
  versionNumber]); SLED IZVORA: sourceQuoteVersionId + priceBookVersionId + productSdkVersion ('quote-v1') + layoutFingerprint
  (= inputHash izvorne verzije ponudbe — geometrijska sledljivost §5) + createdById/approvedById/approvedAt]; (3) **BOMLine** —
  ENA vrstica na materialno postavko [internalSku = QuoteItem.code (strukturna identiteta — NE tekstovna hevristika);
  inventoryId SAMO prek EXACT Inventory.sifraMateriala === code (BREZ fuzzy/includes/normalizacije — neujemana postavka
  ostane NEVEZANA z javnim razlogom); category = BomGroup (CHECK); descriptionSnapshot = 'name — detail' (zmrznjen);
  quantity = qty iz LayoutResult (NIKOLI ocena iz EUR); HONEST NULLs (§8): wasteFactor/grossQuantity/unitCost/totalCost NULL
  dokler vir ne obstaja — nikoli izmišljeni odstotki/cene; quoteLineKey = sourceKey ?? code + geometrySource snapshot;
  calculationRuleVersion = 'quote-v1']; (4) **deal-lock (§7 vezava)** — ob zaklepu strežnik TRANSAKCIJSKO ustvari APPROVED
  BOMVersion iz strukturiranih postavk + veže OBEMA podpisa nanjo (SignatureAudit.bomVersionId, nullable za zapise pred R376
  — brez izmišljanja zgodovine); Project.bomDraftJson se še vedno piše (LEGACY read-model, NI kanoničen); GET/POST
  deal-lock vračata minimalni bomVersion DTO (id/številka/status/št. vrstic); po zaklepu je BOM NESPREMENLJIV
  (POST/PATCH → 403 monter/409 vodja); (5) **API rute** — GET /api/bom (seznam verzij; read RBAC) + POST /api/bom
  (DRAFT iz {projectId, quoteVersionId} — vrata: quotes.create + update dostop + prečni projekt 409 + REJECTED/SUPERSEDED
  409 + integriteta §16 PRED izpeljavo + zaklenjen 409) + GET /api/bom/[id] (detajl + NEVEZANO razlogi) + PATCH /api/bom/[id]
  (SAMO approve DRAFT→APPROVED + audit) + GET /api/bom/procurement (§11: planned/reserved/ordered/received/issued/consumed/
  returned/wasted/variance PO VRSTICI zadnje APPROVED verzije; preslikava DOKUMENTIRANA v odgovoru [viri + nePreslikano tipi
  DAMAGE/ADJUSTMENT/OPENING/PURCHASE/PROJECT_ALLOCATION]; NEVEZANA vrstica → VSE dejanske količine NULL + razlog 'NEZNANE,
  ne nič' — NIKOLI ničle); legacy /api/bom-draft + /api/bom-refine izrecno označeni ZASTARELO (pripisi v glavah);
  bomDraftFromLines označen NEKANONIČEN (comment v quote-versions.ts); (6) **migracija 20261004080000_r376_bom_versions**
  [3 tabele + SignatureAudit.bomVersionId + index ×8; CHECK ×8 vse VALIDATED (status ×3 + category + quantity > 0 +
  stroški ≥ 0 + waste ≥ 0 + gross > 0); brez seeda — prazno je iskreno]. PIN SHIFT-i: r308 85→88 route datotek (+bom, +bom/[id], +bom/procurement) + r191 val2 46/61→48/63 handlerjev (skupaj 55/71→57/73 — tudi VARNOST.md pokritje) — legitimna rast obsega novih rut, dokumentirana v testih. Verifikacija: tsc 0 · eslint 0 ·
  vitest 5357/5357 (345 datotek = R375 QA baza 5299/341 + mojih +58/+4: r376-bom-versions ×14 + r376-canonical-bom ×17 +
  r376-bom-procurement ×17 + r376-bom-deal-lock ×10 — statusni stroj/determinizem/fail-closed generacija/EXACT vezava/
  honest NULL/vrata rut/§11 matematika/NEVEZANO NULL/idempotentna branja/zaklep §17 veriga/dvojni zaklep/immutabilnost po
  zaklepu] · build svež EXIT=0 · qa-needles/r376.tsv [4 need_static ŽIVO v buildu + TODO-R376 must_miss čisto 0;
  fetch-first ×0 v HEAD f2242729 (R375 QA) potrjeno — po KOLIZIJI #18 re-verify]. Naslednji korak #13: R167 (§9 as-installed / §10 produkcija — po vrstnem redu
  issue naloge).
- **Issue #13, korak R165 — KANONIČNA POSLOVNA RESNICA PONUDB: QuoteVersion + PriceBookVersion + kanonični deal-lock** (R374 —
  KOLIZIJA #16 [LEKCIJA 1 16. potrditev]: vzporedna lastniška R373 [a26107d — QA/STIL val 56 runda] pristala MED mojim delom in vzela
  številko → moja runda preimenovana R373→R374 po kanonu KOLIZIJE #4/R323/#13–#15; `git reset --hard origin/main`, delta re-aplicirana
  z preimenovanjem artefaktov [r374.tsv + r374-*.test.ts + migracija 20261003080000_r374_quote_versions]; njihovi r373-* artefakti
  ostanejo = delegirana zgodovina; strežnik je vir denarja; konec klientovega quoteData, lažne marže ×0.6/×0.15 in BOM tekstovne
  hevristike; IDOR na GET deal-lock zaprt; SignatureQuote V5 nad strežniškimi verzijami — konec hardcodiranim ničelnim zaklepom iz
  page.tsx): (1) **PriceBookVersion/PriceBookItem** — strežniško-avtoritativni, verzionirani cenik [GET/POST /api/price-book;
  aktivacija = price.override ADMIN/VODJA, transakcijsko upokoji prejšnjo (R294 F4: now kot parameter — stena ure živi v ruti);
  fail-closed whitelist nad manjkajočimi/neznanimi ključi (reconstruct 409, nikoli default iz kode); seed v1 = defaultPriceBook()
  vrednosti, referenceCost NULL = marža iskreno NEZNANO — 60 %/15 % placeholder IZBRISAN (§8)]; (2) **Quote/QuoteVersion** —
  nemutabilne verzije [POST/GET /api/quotes + GET/PATCH /api/quotes/[id]; seštevki/postavke/odtis izračuna STREŽNIK iz vezane knjige
  — klientov total/prices/lines NIMA učinka (testirano forged); statusni stroj DRAFT→ISSUED→APPROVED (APPROVED SAMO ob zaklepu s
  podpisom, atomarno); nova verzija supersede DRAFT; zaklenjen projekt → 403/409]; (3) **POST /api/deal-lock REWRITE** —
  quoteVersionId OBVEZNO, legacy klientov quoteData → 400; prečni projekt → 409; DRAFT → 409; CELOVITOST: rekonstrukcija iz
  shranjenih vhodov + VEZANE knjige mora dati iste postavke/seštevke/odtis (tampiranje DB → javna napaka 409, testirano); BOM draft
  iz STRUKTURIRANIH postavk [sku = code, konec includes('wpc') hevristike in Math.ceil(EUR/50)]; marginLocked = NULL dokler
  referenceCost manjka (rastna pot: nova knjiga z referencami → marža realna BREZ spremembe kode); SignatureAudit.quoteVersionId +
  quoteInputHash (§16 veriga); estimatedPrice = total verzije; (4) **GET /api/deal-lock IDOR ZAPRT** (§17: assertProjectAccess
  'read' + minimalni DTO — storageKey/ip/UA/fingerprint/geo/sha256 ODHANJENI; SKLADISCE zakonito bere vse — material kontekst);
  (5) **/api/quote** — osnova cenika = AKTIVNA strežniška verzija (override ostane samo PREDogLED kalkulatorja; 503 fail-closed brez
  aktivne knjige); (6) **QuoteItem.sourceKey** — push() v lib/quote.ts je EN VIR odločitve cenik ključa (handrail switch prek
  handrailBookKey — brez vzporedne resnice); (7) **SignatureQuote V5** — seznam verzij projekta + hitra ponudba (dolžina/višina →
  POST /api/quotes) + izdaja (PATCH issue) + zaklep SAMO nad ISSUED/APPROVED; PDF iz postavk verzije; page.tsx NE pošilja več
  HARDCODIRANIH NIČEL (prej: skupajZDDV 0 + ena WPC postavka cena 0 → produkcijski zaklepi so pisali PRAZNO komercialno resnico);
  migracija 20261003080000_r374_quote_versions [4 tabele + SignatureAudit kolone + seed 25 postavk, CHECK ×6 vse VALIDATED].
  PIN SHIFT-i: r191 val2 43/58→46/61 (skupaj 55/71) + r308 82→85 rut + r316 amber register 30→31 (+SUPERSEDED badge) + r167 dark
  fallback badge. Verifikacija: tsc 0 · eslint 0 · vitest 5294/5294 (340 datotek; +40 novih: r374-quote-versions ×22 +
  r374-price-book-store ×9 + r374-canonical-deal-lock ×9 — forged totals/tampiranje/prečni projekt/DRAFT zaklep/dvojni zaklep/IDOR/
  minimalni DTO/dve ACTIVE 409/fail-closed reconstruct] · build svež EXIT=0 · qa-needles/r374.tsv [4 need_static ŽIVO v buildu +
  TODO-R374 must_miss čisto]. Naslednji korak #13: R166 strukturiran BOM + BOMVersion + SKU/inventory vezava (§5/§6/§11).
- **Ring pariteta val 56 (male družine: white + white/60 + roksal-green/40 RAW) — per-barvni split kanon ZAKLJUČEN** (R373): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 372`: **ZELEN ob poskusu 1**
  (12. runda zapored) + **ŠESTINDVJSETIJNA era preverba** NOV kanonski skript
  `r373-era-harvest.sh` [klon r372 prek python `r373-era-clone.py`; 26 registrov
  r347–r372, ≥109 need_static = 105 + 4, vsota iz diska; LEKCIJA R372 (6) 4.
  ponovitev vzorca → zaostanek glave popravljen z dvostransko preverbo]:
  **EXIT=0 ob 1. teku** — vseh ŠESTINDVJSET er ŽIVO NA PRODU; ⭐ **val 55 vsi 4
  needleji ŽIVO DIREKTNO** (chunk_028/chunk_023/chunk_026) → val 55 deploy
  potrjen v celoti; 3 needleji prek hash rezolucije; must_miss ×26 čisto;
  era kontrole R340/R341/R343/R345 ŽIV. **val 55 POST-deploy verifikacija**
  (`r373-qa-spot.sh` spot-r167/18 + `r373-spot-reprobe.sh` 18b; mounted +
  className LOČENO, dispatch+poll VSAKA): vse 4 val 55 površine podatkovno-
  /napačno-gated v demo seji → **iskreno NEmontirane z razlogom iz diska**
  (kanon r277): dashboard L1987 vrata `zamujeneDobaveDomov > 0` [demo 0 +
  'Ni projektov' disk resnica, sidro CSV izvoz ŽIVO], vodja L2122 vrata
  `stats.zamujeneDobave > 0` [demo 0], sistem-zdravje L228 vrata `napaka`
  [zdravje OK — fail-verbose po dizajnu], measurements L3351 vrata merilna
  vrstica [projekt-gated]; vodja sidro 'Sistem — zdravje' ŽIVO; measurements
  27 navy/40 = 27 offset-2 BrezOffset 0; dashboard 1 BrezOffset navy =
  dokumentiran kit override (izjema #1, 'Izvozi prikazane projekte v CSV');
  kolektor 0 errorjev → NI runtime bugov → development-first. (2) **MANDATORY
  STIL val 56 — male družine RAW pariteta**: disk resnica prek NOVEGA orodja
  **`r373-family-census.py`** (4. korak generalizacije: r369-census →
  r371-none-triage → r372-token-triage → TA; poljuben seznam družin + census
  + element triaža v enem prehodu; meja `(?![/\w-])` — 'white' ≠ 'white/60';
  fail-closed 0 pojavitev; **1. uporaba V ISTI rundi**; navzkrižna validacija:
  navy/40 {'O2': 205, 'NONE': 43, '?INTERP': 1} = TOČNO r371 PO census) —
  census PRED → PO: white {'NONE': 3} → {'O2': 3} gap 3→0; white/60
  {'NONE': 8, 'O0': 3} → {'NONE': 4, 'O0': 3, 'O2': 4} gap 8→4 — vsi 4 = KIT
  (izjema #1); roksal-green/40 {'NONE': 1} → {'O2': 1} gap 1→0; **8 × INS
  ' focus-visible:ring-offset-2' TIK ZA žetonom** (photo-tab white RAW ×3
  L978/L1129/L1137 + white/60 RAW ×4 L1414/L2048/L2061/L2071, dashboard
  green RAW ×1 L1742 'Pokliči stranko' — precedent val 55 INS; +28 znakov,
  vrstni red ring → offset → outline pri belih RAW); DOKUMENTIRANE izjeme
  BREZ sprememb: ring/50 ×14 (vse ui/* shadcn kit fokus jezik), white/60 KIT
  ×4, top-bar O0 ×3 (izjema #2, zamrznjena v r369-stil-val52.test.ts),
  destructive/20+/40 ×4 (ui badge/button), resizable ring O1 ×1, navy
  ?INTERP ×1 razrešena v KIT (roksal-catalog L110 = <Button iz ui/button —
  interpolacija je bg variant, ne fokus) → **per-barvni split kanon ZAKLJUČEN
  (MILESTONE val 43–56: navy/red/amber/white/white-60/green RAW pariteta)**;
  in-place = 0 novih vrstic (2684/3188); 0 novih hex; aria/title ZAMRZNJENI;
  apply prek `r373-val56-apply.py` fail-closed per vrstica (anchor ×1, offset
  odsoten PRED, offset tik za žetonom PO, in-place) + 3 bele RAW vrstice
  preurejene v kanonski vrstni red V ISTI rundi. (3) Stale-pin PRED-skan:
  `r373-window-scan.py` (klon r372, TARGETS = photo-tab + dashboard-tab)
  delta +28 ×3 žetona = **0 preozkih (14/14 PRED in PO)**; ŠTEVEC guard sken
  PRED vitestom (LEKCIJA R371 (7)): r370 (A) navy-obsegani števci +
  r371/r372 per-datoteka hex/aria/title čisto; okenski/handler/must_miss
  pini 0 shiftov + e2e-lib dedup **13. val ISKRENO IZPUŠČEN** [dokaz V
  TESTU (E): 32 blokov r370–r373 / 27 unikatnih / 5 ×2 — VSE še zmeraj
  znotraj r372 (1. teek vs re-proba); r373 bloki ×6 vsi NOVI unikati; kanon
  R368]. VERIFIKACIJA (celotna, FOREGROUND, na KONČNI viri): tsc 0 · eslint 0
  (FULL) · vitest **5254/5254 (337)** = R372 baza 5249/336 + mojih +5/+1 − 0
  [suite tek 1: 2 faila = resizable niz ('ring-ring' ne 'ring') + createHash
  import manjkajoč; tek 2: 1 fail = destructive sosledje z dark: varianto
  vmes — vsi popravljeni V ISTI rundi; tek 3 zeleno 5/5; FULL vitest TEK 1
  zeleno] · build svež EXIT=0 [rm -rf .next; max-old-space-size 2560] ·
  `qa-round.sh 373 needles` VSE OK 0 MISS [4 need_static ŽIVO v svežem
  buildu + TODO-R373 odsoten; veriga R227→…→R339 + union registri
  r340–r373] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN
  pre==post r276+r281+r283+r287 — ZERO-MUTACIJA dokazana] ·
  `r373-era-harvest.sh` EXIT=0 [ŠESTINDVJSETIJNA, ob začetku runde] ·
  `r359-prod-qa-retry.sh 372` ZELEN ob poskusu 1 · `r373-qa-spot.sh` +
  re-proba ZELENA [kolektor 0 errorjev] · leak-check čist. NOVO:
  `scripts/qa-needles/r373.tsv` [4 need_static ×1 per-datoteka grep -rlF,
  vsi ×0 v HEAD 777e84f fetch-first GLASNO prek `r373-register-write.py`
  (NF=3 validacija); izpuščeni kandidati dokumentirani: white/60 orodjarna
  bratje ×2 (L2061/L2071) + white RAW puščici ×2 (L1129/L1137) — pokriti
  prek vitest (A); must_miss TODO-R373] + NOVE skripte [r373-era-clone.py,
  r373-era-harvest.sh, r373-family-census.py, r373-val56-apply.py,
  r373-window-scan.py, r373-qa-spot.sh, r373-spot-reprobe.sh,
  r373-register-write.py, r373-readme-update.py, r373-worklog-append.py] +
  LEKCIJE R373: (1) **demo seja = živa disk resnica** — 'Ni projektov' v
  OBEH runah (sidro 'Arhiviraj projekt' = 0, sidro CSV izvoz ŽIVO) →
  projekt-/podatkovno-gated površine iskreno NEmontirane z razlogom iz
  diska [kanon r277; LEKCIJA R372 (1) potrjena v sveži seji]; (2) **vrstni
  red INS: ring → offset → outline** — vstavljeno za celoten fokus niz
  funkcijsko enako, a kanonska vrstni redna pravila zahtevajo offset TIK ZA
  žetonom (r372 N3 needle semantika) — 3 bele RAW vrstice preurejene V ISTI
  rundi; (3) **apply-orodje = transformacijski dokument**: po enkratnem
  prehoju je re-run fail-closed abortiral na 'offset ŽE prisoten'
  (idempotenčna zaščita = pravilno vedenje); (4) **triaža-orodje meja
  družine**: 'white' brez `(?![/\w-])` bi ujel 'white/60' — meja obvezna
  za poljubne družine [LEKCIJA R372 (3)/(4) nadaljevanje]; (5) **navy
  ?INTERP razrešitev = element dokaz, ne besedilo** — template literal z
  interpolacijo bg variant je KIT, ker nosilec nosi <Button iz ui/button
  (L103) — interpolacija NE nosi fokusa; (6) vitest rabi `import {
  describe, expect, it } from 'vitest'` + crypto createHash import —
  globals izklopljeni [LEKCIJA R372 (7) nadaljevanje]. Kontrakt NIČ
  (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ
  [val 56 = render plast a11y className-only v 2 render datotekah];
  OgrajaVizija nič; brez sheme (ZERO-MUTACIJA E2E); 0 novih hex; NIČ novih
  FNV soli. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti
  lastnika (77. zapis). R374 prva naloga = qa-round.sh 373 prod-qa re-run
  [prek `r359-prod-qa-retry.sh 373`] + **SEDEMINDVJSETIJNA era preverba
  r347–r373** [27 registrov, ≥113 need_static = 109 + 4; kanonski skript
  `r374-era-harvest.sh` pričakovan] + val 56 POST-deploy verifikacija
  [4 needleji r373.tsv — photo-tab white RAW ×1 L978 + white/60 RAW ×2
  L1414/L2048 + dashboard green RAW ×1 L1742; photo-tab prek photo
  galerije/pogleda (vrata: projekt + fotografije), dashboard 'Pokliči
  stranko' prek projektne vrstice (vrata: projekt vrstica — demo seja
  'Ni projektov' → pričakuj iskreno NEmontirano z razlogom; mounted +
  className LOČENO; dispatch+poll VSAKA]. R374 kandidati: stylizacija
  brez RAW ostankov — po val 56 je ring gap čez VSE družine = samo
  dokumentirane izjeme [KIT/CMP/INPUT/O0] → 1. kandidat = NON-ring stil
  (npr. focus-visible:border pariteta na INPUT ×10, ALI transition-colors
  skladnost, ALI dark-mode kontrast spot prek agent-browserja); 2.
  kandidat = e2e-lib dedup 14. val [po kanonu le ob novih ×3 ponovitvah];
  3. kandidat = QA-infra: era-clone orodje generalizacija (r373-era-clone
  je 3. klon — python parametriziran cloner za r374+). ISSUE #1: vsa
  sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP
  RULE: razvoj > QA].
- **Ring↔border pariteta val 57 (NON-ring kandidat: navy/40 obrobljeni gumbi measurements) + FEATURE era-clone.py — KOLIZIJA #17 + stale-klon okolje** (R375): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 373`: **ZELEN ob poskusu 1**
  (13. runda zapored) + **SEDEMINDVJSETIJNA era preverba** NOV kanonski skript
  `r374-era-harvest.sh` [27 registrov r347–r373, ≥113 need_static = 109 + 4,
  vsota iz diska; REG_AA izpeljan]: **EXIT=0 ob 1. teku** — vseh 27 er ŽIVO NA
  PRODU; ⭐ **val 56 vsi 4 needleji ŽIVO DIREKTNO** (chunk_045 ×3 + chunk_028 ×1)
  → val 56 deploy potrjen v celoti; must_miss ×27 čisto; era kontrole
  R340/R341/R343/R345 ŽIV. **val 56 POST-deploy verifikacija** (`r375-qa-spot.sh`
  spot-r167/19 + `r375-spot-reprobe.sh` 19b; mounted + className LOČENO,
  dispatch+poll VSAKA, kolektor 0 errorjev v OBEH runah): vse 4 val 56 površine
  podatkovno-gated v demo seji → **iskreno NEmontirane z razlogom iz diska**
  (kanon r277): photo N1 'Izbriši sliko' vrata galerija projekta [loadPhotos
  early-return], N2 'Zapri slikanje' vrata cameraOpen ['Slikaj' disabled=1
  dokumentira vrata], N3 'Zapri urejevalnik anotacij' vrata annotationPhoto,
  dashboard N4 'Pokliči stranko' vrata projekt vrstica ['Ni projektov' disk
  resnica]; sidra ŽIVO ('Slikaj' VEDNO + CSV izvoz + 'Ni projektov'); navy
  sonda dashboard 5 = 4 offset-2 + 1 kit override izjema #1. (2) **MANDATORY
  STIL val 57 — ring↔border OBLIKOVNA pariteta**: disk resnica NON-ring
  triaža [INPUT ×10 ocena = disk 4 accent checkbowerji — border na native
  checkboxu ne nosi fokus barve → iskreno izpuščeno; transition-colors =
  1 gap (dashboard L1628) → prihodnji val; border-pariteta obrobljenih = 44
  čez komponente → največja kohorentna družina measurements navy/40 = 22
  tarč]: **22 × INS ' focus-visible:border-roksal-navy/40
  dark:focus-visible:border-roksal-ink/40' TIK ZA offset** (kanon calculator
  L4396/L4439 precedens ring → offset → border; triaža outline 18 pred / 4
  brez → 0 preurejanj; +76 znakov/vrstico ×22 = +1672, in-place 0 novih
  vrstic; amber/red bordered ×2 lastni družini; navy brez border širine ×25
  mrtev CSS izpuščeno; ui KIT border-ring ×11 zamrznjen); census PRED gap 22
  → PO gap 0; apply prek `r375-val57-apply.py` (fail-closed per vrstica,
  idempotenca 'border ŽE prisoten'). (3) **FEATURE — era-clone.py**: 5. korak
  generalizacije era verige [r370–r373 hardcodirani kloni → PARAMETRIZIRAN
  kloner: --src-round/--expected-total/--dst-round + KOLIZIJA override
  --dst-label/--dst-chain-seg; era besede iz števca (ERA_BESODE do 40.
  preverbe, fail-closed izven mape); vsota need_static IZ DISKA — podatkovne
  vrstice, komentarji ne štejejo; labeli izpeljani iz zadnjega
  preberi_register; PRED rep + PO natančna števca; 2 uporabi V ISTI rundi →
  r374-era-harvest.sh + r375-era-harvest.sh **OSEMINDVJSETIJNA** — 28
  registrov r347–r374, ≥117 = 113 + 4, **EXIT=2 — iskrena strukturna meja**:
  njihov price-book needle = SERVER koda (/api/price-book route), ki je NIKOLI
  v .next/static/chunks → kanonska CDN žeteva je ne more videti [LEKCIJA R375
  (6): prvi mešani register — client + server needleji]; 3/4 njihovih needlejev
  ŽIVO prek hash rezolucije [aee01236 HTTP 200 — njihov deploy POTRJEN],
  price-book ŽIVO v svežem buildu prek needles faze [grep .next/server+static,
  FAIL=0] + njihov prod-qa 374 ZELEN — delegirana verifikacija, NI tiho] +
  `r375-window-scan.py` [klon r373, TARGETS = measurements-tab; 25 okenskih
  regexov, delta +76 = 0 preozkih]. **KOLIZIJA #17 + STALE-KLON OKOLJE**:
  vzporedna lastniška poslovna R374 [8db6a1c — issue #13
  QuoteVersion/PriceBook/deal-lock] pristala MED mojim delom in vzela
  številko → moja runda R374→R375 po kanonu KOLIZIJE #4/R323/#13–#16;
  `git reset --hard origin/main`, delta re-aplicirana s preimenovanjem
  artefaktov [r375.tsv + r375-*.py + r375-stil-val57.test.ts]; njihov
  worklog vnos NI obstajal → adopcijski vnos R374 dopisan [LEKCIJA R369 (1)];
  NADALJE: lokalno okolje je bilo SWAPNIRANO na star klon [R344-era, git
  log kazal R343/R344, backup branch izginil, nekomitirana delta izgubljena]
  → popolna rekonstrukcija iz konteksta + origin/main [fetch-first kanon
  rešil: origin/main NI bil poškodovan 8db6a1c] — LEKCIJA R344 stale-klon
  zdaj tudi za AI seje: PRED delom `git fetch` + `git log --oneline -1
  origin/main` + primerjava z disk resnico. VERIFIKACIJA (celotna,
  FOREGROUND, na KONČNI viri): tsc 0 [po prisma generate — stale client
  TS2339 priceBookVersion po njihovi shemi] · eslint 0 (FULL) · vitest
  **5299/5299 (341)** = R374 poslovna baza 5294/340 + mojih +5/+1 − 0
  [suite tek 1: 1 fail = red/40 števec 5→3 disk resnica — popravljen; FULL
  tek 1: 2 faila = r166 DARK obrobni stražar (INS brez dark: — dodan
  dark:focus-visible:border-roksal-ink/40 V ISTI rundi) + r348 oknoOkoli
  SLICE okno 600 preozko (528→604; PIN SHIFT R375 okno 600→700 headroom 96
  — LEKCIJA R375: slice okna niso regex, window-scan jih ne vidi, FULL
  vitest je mreža); FULL vitest TEK zeleno] · build svež EXIT=0 ·
  `qa-round.sh 375 needles` VSE OK 0 MISS [93 × FAIL=0; 4 need_static ŽIVO
  + TODO-R375 odsoten; veriga R227→…→R339 + union registri r340–r375] ·
  smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post
  r276+r281+r283+r287 — ZERO-MUTACIJA tudi čez njihovo poslovno rundu] ·
  r374-era-harvest.sh EXIT=0 + r375-era-harvest.sh EXIT=2 [strukturna meja,
  zgoraj dokumentirana — NI code/deploy fail] ·
  r359-prod-qa-retry.sh 373 ZELEN ob poskusu 1 · r375-qa-spot.sh + re-proba
  ZELENA [kolektor 0 errorjev] · leak-check čist. NOVO:
  `scripts/qa-needles/r375.tsv` [4 need_static ×1, vsi ×0 v HEAD 8db6a1c
  fetch-first GLASNO prek `r375-register-write.py` (NF=3); izpuščeni
  kandidati dokumentirani: bratje L3763/L3786 + L5154/L5167 +
  L5182/L5194/L5211/L5234 — pokriti prek vitest (A); must_miss TODO-R375] +
  NOVE skripte [era-clone.py [GENERALIZIRANO], r374-era-harvest.sh,
  r375-era-harvest.sh, r375-val57-apply.py, r375-window-scan.py,
  r375-qa-spot.sh, r375-spot-reprobe.sh, r375-register-write.py,
  r375-readme-update.py, r375-worklog-append.py] + LEKCIJE R375: (1) **r166
  DARK obrobni stražar ujel val 57 INS brez dark:** — border-roksal-navy/
  izgine v temni temi [kanon R163–R166] → dark:focus-visible:border-roksal-ink/40
  obvezen [calculator L4439]; PREVERBA dark stražarjev PRED applyom;
  (2) **oknoOkoli SLICE okna niso regex** — window-scan enumerira SAMO
  {0,N} regex literale; slice okna rabi poseben preskan (ali FULL vitest)
  — r348 pin shift 600→700 z žigom; (3) **era-clone generalizacija ujela
  svoj hrošča V ISTI teku** — POST preverba vsake transformacije z
  natančnim števcem obvezna [out.splitlines() vs content.splitlines()];
  (4) **handover ocena ≠ disk resnica** — 'INPUT ×10' = disk 4
  checkbowerji; census PRED obsegom; grep -c šteje komentarje — disk
  resnica r374 = 4 podatkovne vrstice; (5) **KOLIZIJA #17 + stale-klon
  okolje dvakratna rekonstrukcija** — adopcijski kanon (R369 (1)) tudi za
  vzporedne lastniške runde; era-clone --dst-label override razširjen ob
  drugi uporabi; PRED delom vedno `git fetch` + preverba origin/main proti
  disk resnici [LEKCIJA R344 azurirana za AI seje]. Kontrakt NIČ
  (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ
  [val 57 = render plast a11y className-only v 1 render datoteki];
  OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli. ⏰
  roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika
  (78. zapis). R376 prva naloga = qa-round.sh 375 prod-qa re-run [prek
  `r359-prod-qa-retry.sh 375`] + **DEVETINDVJSETIJNA era preverba
  r347–r375** [29 registrov, ≥121 need_static = 117 + 4; prek
  `era-clone.py --src-round 375 --expected-total 121`] + val 57
  POST-deploy verifikacija [4 needleji r375.tsv — vse measurements-tab;
  vrata: merilne površine z izbranim projektom (demo seja 'Ni projektov'
  → pričakuj iskreno NEmontirano z razlogom, kanon r277; mounted +
  className LOČENO; dispatch+poll VSAKA)]. R376 kandidati: 1.
  transition-colors skladnost [disk resnica 1 gap: dashboard L1628
  'Počisti iskanje projektov'] ALI amber/red bordered border-pariteta
  [lastni družini ×2] ALI window-scan generalizacija [slice okno preskan
  — LEKCIJA R375 (2)]; 2. e2e-lib dedup 15. val [po kanonu le ob novih ×3
  ponovitvah]. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner
  'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
- **Transition-colors skladnost val 58 + FEATURE era-clone.py --server-probe (6./7. generalizacija era verige) + REGISTER EVOLUCIJA kanon — KOLIZIJA #19** (R377): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 375`: **ZELEN ob poskusu 1**
  (14. runda zapored) + **DEVETINDVJSETIJNA era preverba** `r376-era-harvest.sh`
  [29 registrov r347–r375, ≥121 need_static = 117 + 4, vsota iz diska;
  generiran prek ŽIVEGA orodja `era-clone.py`]: **EXIT=0 ob 1. teku** — 114
  needlejev ŽIVO DIREKTNO + 7 rezolucij ŽIVO [3 hash starejši navy + 3 hash
  r374 client (aee01236 HTTP 200) + **1 SERVER** r374 price-book: needle v
  `.next/server/chunks/_8b39314d._.js` + prod `/api/price-book` HTTP 401
  fail-closed deterministično] — **PRVI EXIT=0 od mešanega r374 registra**
  (r375-era-harvest je bil iskreno EXIT=2); ⭐ **val 57 vsi 4 needleji ŽIVO
  DIREKTNO** (chunk_026 ×4) → val 57 deploy potrjen v celoti; must_miss ×29
  čisto. **val 57 POST-deploy verifikacija** (`r377-qa-spot.sh`
  spot-r167/21; mounted + className LOČENO, dispatch+poll VSAKA, kolektor 0
  errorjev): **N2 'Naloži predlogo meritev' MONTIRANA 5, border-pariteta
  5/5 — ŽIVO DOM dokaz** (predloge niso projekt-gated — disabled=!
  selectedProject a montirane); N1/N3/N4 iskreno NEmontirane z razlogom iz
  diska (vrata: meritve/segmenti projekta — demo 'Ni projektov' testid
  meritve-brez-projektov, kanon r277); navy sonda measurements 27/27
  BrezOffset=0. (2) **MANDATORY STIL val 58 — transition-colors SKLADNOST**:
  disk resnica census [edini gap = nativni <button> 'Počisti iskanje
  projektov' dashboard L1628; KIT <Button> nosi transition-all iz ui/button
  baze; <Input> lastni fokus jezik izjema #2; amber/red bordered ×2 = <span
  cursor-help> chipi — NE fokusabilni, border-pariteta N/A → iskreno
  izpuščeno]: 1 × INS ' transition-colors' PRED 'focus-visible:ring-2'
  (kanon measurements L4754/L4768 precedens; +18 znakov, in-place 0 novih
  vrstic 3189; transition-colors števec 11→12; md5 prijet 37c9e224…);
  `r377-val58-apply.py` fail-closed [1. tek ujel lastno hroščo: replace samo
  na ring-2 bi podvajal ring rep — delta 80 ≠ 18, abort PRED zapisom];
  window-scan delta pre-skan 65 okenskih regexov = 0 preozkih. (3) **FEATURE
  era-clone.py --server-probe — 6./7. korak generalizacije**: (a) labeli
  regex vidi TUDI poslovne runde brez val številke — PRED: FAILOVEDANO
  'zadnji register R373 ≠ R374'; (b) SERVER-NEEDLE razširitev (LEKCIJA R375
  (6) zaprta z orodjem): needle v lokalnem .next/server (kompilirani čanek,
  .map izključen) + determinističen vedenjski probe lastniške rute na produ
  (fail-closed status); (c) **7. korak: --server-probe PONOVLJIV** [veriženje
  harvestov s probe + več mešanih registerjev: r374 price-book + r376 BOM
  rute /api/bom + /api/bom/procurement]; orodje ujelo lastne napačne POST
  števce V ISTI rundi — POST kanon deluje. **TRIDESIJNA era preverba**
  `r377-era-harvest.sh` [30 registrov r347–r376, ≥125 = 121 + 4, vsota iz
  diska]: EXIT=2 = **iskreno deploy-pending stanje** [124/125 ŽIVO: 113
  direktno + 6 hash + **5 SERVER ŽIVO** [r374 price-book + njihovi 4 BOM
  needleji prek /api/bom + /api/bom/procurement HTTP 401]; 1 MISS =
  r371 NASLEDNICA needle [lokalni čanek 8895ee21 ŽIVO, prod HTTP 404 —
  razreši se SAMO ob TEM pushu; lokalno ŽIVO, logično zagotovljeno];
  must_miss ×30 čisto]. (4) **REGISTER EVOLUCIJA kanon (nov)**: FULL vitest
  tek 1 ujel r371 N3 era diskriminator — val 58 je evoluirala ISTO vrstico,
  ki jo je val 54 prijel [dvojni zadetek: test pin + zamrznjena r371.tsv
  vrstica]; mehanizem: stara vrstica KOMENTIRANA dobesedno ('EVOLVED R377'
  žig) + NASLEDNICA need_static vrstica — need_static števec r371 = 4
  NESPREMENJEN (era vsote veljavne); r371 test PIN SHIFT z žigom. (5)
  e2e-lib dedup 15. val ISKRENO IZPUŠČEN [kanon R368]. VERIFIKACIJA: vitest
  5363/5363 (346) [FULL zeleno] · tsc 0 · eslint 0 (FULL) · build svež
  EXIT=0 [prisma generate po njihovi shemi — stale client TS2339 bOMVersion]
  · qa-round.sh 377 needles VSE OK [r377.tsv ŽIVO + TODO-R377 odsoten] ·
  smoke EXIT=0 · e2e EXIT=0 [ZERO-MUTACIJA] · leak-check čist.
- **red/40 offset-2 pariteta val 59 + FEATURE r379-window-scan.py (8. generalizacija: needle pini iz registrov) + era-clone.py podniz-hrošča + verižni-rep generalizacija + eb_zapri_vodic 2-fazni post-pogoj — KOLIZIJA #21** (R379; runda preimenovana R378→R379 — njihova poslovna R378 [73d57b0, PROIZVODNA DOMENA] je pristala MED mojim delom in vzela številko): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 377`: **ZELEN ob poskusu 1**
  (15. runda zapored) + **ENAINTRIDESIJNA era preverba** `r378-era-harvest.sh`
  [31 registrov r347–r377, ≥126 = 125 + 1, vsota iz diska]: **EXIT=0 ob 1. teku**
  — 115 ŽIVO DIREKTNO + 11 rezolucij [6 hash + 5 SERVER] — **r371 NASLEDNICA
  ŽIVO** (razrešena ob R377 pushu); ⭐ **val 58 needle ŽIVO DIREKTNO**
  (chunk_028) → val 58 deploy potrjen; must_miss ×31 čisto. PO KOLIZIJI #21:
  **DVAINTRIDESIJNA era preverba** `r379-era-harvest.sh` [32 registrov
  r347–r378, ≥130 = 126 + 4]: **EXIT=0** — njihovi 4 produkcija needleji
  ŽIVO prek SERVER resolucije [production-store_ts chunk + prod /api/production
  HTTP 401]; era-clone generalizacije: (a) **podniz-hrošča** [LEKCIJA R378 (1):
  ENAINTRIDESIJNA ⊃ TRIDESIJNA — 31. preverba = prvi prehod v INTRIDESIJNA
  družino; 'expected 0' preverbe z levo črkovno mejo], (b) **verižni-rep +
  banner dejanski segment** [ročni chain-seg + multiplicita ≠ ×4 — regex
  detekcija 'IN r{N}.tsv … na' z count-checkom], (c) ** oznaka konvencija**
  [r377.tsv = lastna oznaka 'R377 val 58']. **val 58 POST-deploy spot**
  (`r379-qa-spot.sh` spot-r167/22; mounted + className LOČENO; kolektor 0):
  bazna resnica 0 montiranih pri praznem iskanju → fill → **MONTIRAN 1 z
  VSEH 5 needle klas** → **PRAVI klik OK** (scrollintoview — disk resnica:
  search bar POD fixed bottom-nav z-50 na 577px viewportu) → od-montiran =
  funkcionalni dokaz v OBEH smereh. **eb_zapri_vodic UTRDITEV** [LEKCIJA
  R378 (2): vodič ~10s+ PO prijavi — stara ×3 klik race = vodič ODPRT celo
  sejo, ozadje fixed inset-0 z-[100] BLOKALO VSE prave klike (eval sonde
  niso prizadele); v2 = 2-fazni post-pogoj ozadje=0 IN storage='true'].
  (2) **MANDATORY STIL val 59 — red/40 offset-2 PARITETA**: disk census
  [`r379-census.sh`: rdeča 25 = O2 11 + NONE 14; amber/50 100%]; 14 × INS
  ' focus-visible:ring-offset-2' TIK ZA red/40 [8 datotek: dashboard ×5,
  floor-plan ×1, inventory ×1, quote-followup ×1, roksal-catalog ×1,
  sessions-dialog ×2, termini-card ×1, top-bar ×2; +28 znakov/vrstico,
  in-place; r372 val 55 izjema #1 RESOLVANA]; `r379-val59-apply.py`
  fail-closed [scan→14, idempotenca 0]; `r379-stil-val59.test.ts` ×6;
  r372 (D)/(E) PIN SHIFT/EVOLVED žigi [o2 11→25, none 14→0; klasifikacija
  obrnjena = {KIT:12, CMP:2, RAW:1}]. (3) **FEATURE r379-window-scan.py —
  8. generalizacija** [LEKCIJA R377 (4) formalizacija]: DEL 1 regex okna 53
  + **DEL 2 NOVO: needle pini iz registrov r340–r379 — 147 need_static,
  147/147 ŽIVIH v src** + DEL 3 slice-okna 17; delta 28 → 0 preozkih.
  (4) e2e-lib dedup 16. val ISKRENO IZPUŠČEN [kanon R368].
  VERIFIKACIJA (PO re-aplikaciji KOLIZIJE #21): vitest **5423/5423 (351)**
  FULL zeleno [njihova baza 5417/350 + mojih +6/+1; njihov README števec
  zastarel — popravljen tukaj] · tsc 0 · eslint 0 (FULL) · build svež
  EXIT=0 [prisma generate + migrate deploy 20261005080000_r378 — njihova
  shema] · qa-round.sh 379 needles EXIT=0 [97× FAIL=0; r379.tsv ŽIVO +
  TODO-R379 odsoten + njihov r378.tsv ŽIVO] · smoke EXIT=0 · e2e EXIT=0
  [ZERO-MUTACIJA] · r379-era-harvest EXIT=0 · leak-check čist.
- **Ring pariteta val 44 + e2e-lib dedup 1. val** (R361): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 360` ZELEN ob poskusu
  1 + **ŠTIRINAJSTIJNA era preverba** `r361-era-harvest.sh` EXIT=0 ob 1. teku
  (×2): 14 registrov r347–r360 (≥62 need_static = 4+5+8+9+3+8+4+3+3+3+3+3+3
  +3), 60 ŽIVO direktno + 2 R353 prek hash rezolucije (CDN HTTP 200), R360
  val 43 ×3 ŽIVO DIREKTNO → deploy potrjen v celoti, must_miss ×14 čisto,
  era kontrole R340/R341/R343/R345 ŽIV; (2) **fetch-first sken** — FAZA 13
  3. isti-endpoint klic NE obstaja (L627+L672 edina normalizeMeasurements
  brata) → NI utemeljena (samo sken); e2e-lib prag DOSEŽEN za kolektor (3
  identična inline bloka r358/r359/r360); (3) **MANDATORY STIL val 44** —
  ring PARITETA crm-tab družine (1 datoteka × 1 družina; 9 popravkov: 6
  izvoznih bratov + CSV pill + status filter bratje [8 × manjkajoč
  focus-visible:ring-offset-2] + opomnik PDF [offset-1→2]; 13/13 navy/40 z
  offset-2; aria/title ZAMRZNJENI; 0 novih hex); **NOV tip era needleja** =
  className token nizi (r361.tsv, iskreno dokumentiran; ⭐ LEKCIJA R361:
  SWC transpilira template literal v konkatenacijo — needle = statičen
  segment BREZ interpolacijske meje; 1. kandidat MISSAL v 1. build teku,
  zamenjan); (4) **FEATURE — e2e-lib dedup 1. val**: NOVA pomočnika
  `eb_kolektor_napak` + `eb_preberi_kolektor` (3. identični inline blok =
  prag LEKCIJA R352 → EN VIR; IIFE ovojnica obvezna — r231 invariant;
  LEKCIJA R358 zaprta v helperju; zamrznjeni spot skripti NI mutirani) —
  **kanon PORABLJEN ob 1. uporabi** v `r361-qa-spot.sh` + re-probi
  `r361-qa-spot2.sh` (ožji obseg: prod DOM še stari crm-tab — deploy
  pending, produkcijska verifikacija val 44 = R362 era preverba); kolektor
  0 errorjev ×2 seji; (5) vitest r361 ×11 (r361-stil-val44: paritetni
  bloki A–F + 0-hex števec + era-kontrakt r353 + obrnjena regresija val
  41/42/43 + era-diskriminatorji ×1/×1/×2) — 5194/5194 (325); (6)
  verifikacija: tsc 0 · eslint 0 (FULL) · build svež EXIT=0 · needles r361
  VSE OK (veriga + union registri r340–r361) · smoke EXIT=0 · e2e EXIT=0
  [ODTIS — ZERO-MUTACIJA] · leak-check čist · r172 prst 6051 potrjen iz
  diska (val 44 ni premaknil measurements-tab).
- **Računovodske akcije val 43 + QA-infra hardening 2. val** (R360): (1)
  **prva naloga** — prod-qa re-run prek NOVEGA kanona `r359-prod-qa-retry.sh
  359` ZELEN ob poskusu 1 + **TRIJESTIJNA era preverba** `r360-era-harvest.sh`
  EXIT=0 ob 1. teku: 13 registr r347–r359 (≥59 need_static = 4+5+8+9+3+8+4
  +3+3+3+3+3+3), 57 ŽIVO direktno + 2 R353 prek hash rezolucije (CDN HTTP
  200), R359 val 42 ×3 ŽIVO DIREKTNO → deploy potrjen v celoti, must_miss
  ×13 čisto, era kontrole R340/R341/R343/R345 ŽIV; (2) **fetch-first sken
  FAZA 13** — GET/verzije + portal klaster: 6 fetchi (projects,
  measurements ×2, verzije, ar-snapshots, photos) na 5 RAZLIČNIH endpointih
  z 5 različnimi oblikami odgovorov in 5 state stroji (portal: 0 client
  fetchi) → **FAZA 13 NI utemeljena** (LEKCIJA R352/R359 — heterogeni viri,
  vsiljena abstrakcija ne za šalo; 2 isti-endpoint brata v strukturno
  različnih funkcijah), samo sken; (3) **MANDATORY STIL val 43** — a11y
  resnica računovodskih akcij (invoice-manager.tsx, 9 gumbov × 1 datoteko,
  0 novih hex, VSE DODATNO): Izdaj/Briši/Plačan/Storno/Uredi/PDF NOVI
  aria+title (iskrene posledice: rollback pri statusnih, PRAVI DELETE pri
  Briši [za razliko od bulk meritev arhiviranja], izbriši+zaključi pri
  Uredi, dvoklik 3-s okno pri Storno) + ring kanon navy/40 ali roksal-red/40
  (destruktivni žig barva ohranjena) + ring PARITETA pri Opomnik/QR/XML
  (zamrznjeni aria/title byte-identični); stale pini shiftani V ENI rundi:
  r241 'Briši' + r236 'Izdaj' className (precedens R334/R355–R359); (4)
  **FEATURE — QA-infra hardening 2. val: kanon PORABLJEN** —
  `r360-era-harvest.sh` žetev faza pokliče kanonski `qa-harvest.sh` (retry
  ×3 + parcialna guard + fail-closed; R359: "r360+ ga lahko pokličejo
  namesto lastnega inline curla") — demo 60/60 čankov, 0 failov, EXIT=0 ×2
  + guard demo EXIT=1; **spot-probe poll kanon**: `r360-qa-spot.sh` (fiksna
  spanja → poll do znane glave, LEKCIJA R359 aplikirana) + re-probe
  `r360-qa-spot2.sh` (poll do NAJZAKASNEJŠEGA elementa — 'AI raba' /
  'Ni projektov' — refined lekcija; katalog probe substring popravljen na
  'katalog avtomatizacijskih' — LEKCIJA R359 (2)); spot-r167: kolektor 0
  errorjev, Meritve iskrena praznina, vodja vse ŽIVO (csvPills 9); (5)
  vitest r360 ×10 (r360-stil-val43: 7 blokov + zamrznjeni nizi +
  zamrznjen hex seznam [3 × QR par — edini hex v datoteki] + obrnjena
  regresija val 41/42 + enolični era-diskriminatorji) — 5183/5183 (324);
  (6) verifikacija: tsc 0 · eslint 0 (FULL) · build svež EXIT=0 · needles
  r360 VSE OK (veriga + union registri r340–r360) · smoke EXIT=0 · e2e
  EXIT=0 [ODTIS — ZERO-MUTACIJA] · leak-check čist · r172 prst 6051
  potrjen iz diska (val 43 ni premaknil measurements-tab).
- **Repost družine EN VIR + val 41** (R358): (1) **measurements FAZA 11** —
  iskrena meja FAZA 10 prevzeta: 3 preostali per-item re-post tokovi
  (sinhronizacija osnutka syncSingleDraft [draft.payload VERBATIM, kontrakt
  R152 "točno telo"], podvojenost handleDuplicateMeasurement, kopiranje v
  segment handleBulkCopyToSegment [batch]) → EN gradnik
  `posljiRepostMere(telo)` + EN builder `teloRepostaIzMeritve(m, fallback)`
  (prej 2 podvojena stale payload telesa ×5 vrstic); KLJUČNA meja:
  repost telo GRADI KLICATELJ — RepostTelo nosi NULLABLE
  arMetadata/gpsLokacija (vir brez AR/GPS) in gpsLokacija NI vsiljena
  TERENSKA_GPS_TOCKA (no fabricated data — kopija nosi izvorno točko,
  null ostane null); korekcijski osnutek ohrani predhodnikId (R276);
  preslikava + audit + toasti ostanejo pri klicatelju (UI resnica v UI);
  tab zdaj ima 0 × POST fetch na /api/measurements (vse telesa gradi ALI
  nosi gradnik); (2) **val 41** — a11y parity FAZA 11 družine (5 gumbov ×
  1 datoteko): syncAll + per-draft Sinhroniziraj + discard X NOVI titleji
  (iskrena posledica; aria že nosi akcija+cilj) + Podvoji/Kopiraj ring
  PARITETA (offset-2 dopolnjen — precedens val 40 InlineInclinometer);
  0 novih hex; (3) vitest r358 ×18 (r358-vnos-faza11 ×10 [builder 5-ključni
  vrstni red + null/null + body bajtno + ne-ok/omrežna → osnutek z ISTIM
  telesom + no-fabricated-gps + EN VIR 3 repost klici + 0 POST fetch v
  tabu + determinizem + modul čist + stale stringify izginil] +
  r358-stil-val41 ×8 [3 bloki strukturno + 2 ring pariteta + 0-hex +
  obrnjena regresija val 38/39/40 + enolični era-diskriminatorji]) —
  5165/5165 (322); (4) verifikacija: tsc 0 · eslint 0 (FULL) · build svež
  EXIT=0 · needles r358 VSE OK (veriga + union registri r340–r358) ·
  smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post —
  ZERO-MUTACIJA].
- **Vnosnih tokov EN VIR + val 40** (R357): (1) **measurements FAZA 10** —
  preostalih 5 enojnih vnosnih tokov migriranih na FAZA 9 gradnik
  `posljiVnosMere` (vnos forma handleSubmitMeasurement + nagib
  saveInclinometerReading + kotomer saveKotomerReading + predloge
  handleApplyPredloga + AR uvoz handleImportFromAr ×2 zanki = 6 klicnih
  mest, 9 klicev skupaj s FAZA 9): 15 gps literalov → 0 (24 → 15 R356 → 0;
  TERENSKA_GPS_TOCKA ENA definicija); gradnik razširjen z OPCIJONALNIM
  `predhodnikId` (R276 korekcijska veriga) — **popravek stale buga**:
  catch-veja handleSubmitMeasurement je telo rekonstruirala BREZ
  predhodnikId (sinhronizacija bi ustvarila standalone namesto verzije —
  kršitev kontrakta R276); zdaj osnutek korekcije NOSI predhodnikId v OBEH
  neuspešnih vejah (ne-ok IN omrežna napaka); predhodnikId = ZADNJI ključ v
  telesu (bajtno isti vrstni red kot stale telo korekcije); preslikava
  odgovora + toasti ostanejo pri klicatelju (UI resnica v UI); iskrena
  meja: 3 preostali POST fetchi [sinhronizacija osnutka re-pošlje
  draft.payload VERBATIM, podvojenost/kopiranje re-pošljeta obstoječo
  meritev] NE gradijo teles — izven FAZA 10; (2) **val 40** — a11y parity
  FAZA 10 družine (4 gumbi v 3 datotekah): vnos forma submit POGOJNA title
  (2 stanji — verzija vs. običajna) + NOV ring brez aria (vidno besedilo že
  nosi cilj); Scaniraj aria+title (iskren stub — 'kmalu na voljo') + NOV
  ring; InlineKotomer title + NOV ring; InlineInclinometer ring pariteta
  (offset-2 dopolnjen) + title; 0 novih hex; (3) vitest r357 ×18
  (r357-vnos-faza10 ×10 [predhodnikId vrstni red + brez ključa + popravek
  obeh vej + EN VIR 9 klici + gps 0 + determinizem + regresijski stražar
  rekonstrukcije] + r357-stil-val40 ×8 [4 bloki + 0-hex + obrnjena
  regresija val 38/39]) — 5147/5147 (320); (4) verifikacija: tsc 0 ·
  eslint 0 (FULL) · build svež EXIT=0 · needles r357 VSE OK (veriga + union
  registri r340–r357) · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN
  pre==post — ZERO-MUTACIJA].
- **Vnos meritve orkestracija + val 39** (R356): (1) **measurements FAZA 9**
  — NOV `measurements/vnos-meritve.ts`: kontrolni tok treh bratov izluščen
  VERBATIM (stopniščni čarovnik batch ×5 + WPC palice batch ×stPalic + ročni
  steber single — ISTI per-item tok POST → uspeh = preslikava + prepend;
  ne-ok ALI omrežna napaka = ekspliciten osnutek R152, ni fake-success) →
  EN `posljiVnosMere(zahteva)` z diskriminiranim rezultatom
  uspeh+podatki / osnutek+telo (telo = ISTI payload kot POST — brez
  ponovnega literala, brez razhajanja POST/osnutek); 9 podvojenih payload
  literalov + 9× gps literal → ENA definicija (TERENSKA_GPS_TOCKA, Kranj
  R166 izvor — nič novih podatkov); UI resnica v UI (LEKCIJA R354):
  preslikava odgovora + osnutki + toasti ostanejo v tabu, gradnik NE pozna
  toastov; (2) **val 39** — a11y parity FAZA 9 družine (4 gumbi):
  steber per-segment + WPC palice + stopniščni čarovnik aria (akcija+cilj) +
  title + NOV izrecen ring navy/40+offset-2; steber submit title+ring brez
  aria (vidno besedilo že nosi cilj S# — brez dvojnega besedila); 0 novih
  hex; (3) vitest r356 ×18 (r356-vnos-faza9 ×10 [bajtni POST kontrakt +
  osnutek R152 ×2 + determinizem + EN VIR 3 klici + UI resnica + kontrakt
  oblike + 0-hex] + r356-stil-val39 ×8 [4 bloki strukturno + ring kanon +
  0-hex + obrnjena regresija val 38]) — 5129/5129 (318); (4) verifikacija:
  tsc 0 · eslint 0 (FULL) · build svež EXIT=0 · needles r356 VSE OK (veriga
  + union registri r340–r356) · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO
  IDENTIČEN pre==post — ZERO-MUTACIJA].
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
| **Testiranje** | [Vitest 4](https://vitest.dev/) (5129 testov + globalSetup embedded PG) |
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
| `bun run test` | Vsi testi (vitest, 5129, embedded PG prek globalSetup) |
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
| `measurements-tab.tsx` | 6.391 | Meritve (9 tipov, stopniščni čarovnik, WPC, štebricki; dekompozicija faza 1+2+3+4+5+6+7 R319/R325/R338/R340/R348/R349/R350) |
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
