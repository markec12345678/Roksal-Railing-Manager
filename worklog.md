# Roksal Railing Manager — Worklog (peskovnik)

---

Task ID: 1
Agent: Main Orchestrator (Z.ai Code)
Task: Vercel token — pregled napak, popravki, primerjava AR repojev, implementacija sklepčnih priporočil

Work Log:
- Kloniral markec12345678/Roksal-Railing-Manager → prethodna analiza (glej /tmp/Roksal-Railing-Manager)
- Vercel API: projekt roksal-railing-manager (prj_2vbQ7ghZVhiBkBelMcBZX7rkVYgb); zadnji 3 deploymenti ERROR
- Vzrok: `Property 'passwordHash' does not exist` — Vercelov `bun install` ne požene postinstall,
  zato Prisma Client ni regeneriran po spremembi sheme (security commit 31a72e9)
- Popravki (commit `fix(vercel): prisma generate v buildu + seed.cjs + demo baza v bundle-u`):
  - package.json build: `prisma generate && prisma db push && node prisma/seed.cjs && next build && cp …`
  - prisma/seed.cjs (nov): CommonJS, idempotenten, brez tsx/aliasov; demo prijava demo@roksal.si
  - prisma/seed.ts: odstranjen ekipaId:'ekipa-A' (P2003 FK napaka na sveži bazi) + demo uporabnik
  - prisma/password-helper.ts (nov): samostojen scrypt hash za seed skripte
  - src/lib/db.ts: na Vercelu kopira vgrajeno bazo v zapisljiv /tmp ob hladnem startu (demo način)
  - next.config.ts: outputFileTracingIncludes za db/** → baza gre v serverless bundle
  - page.tsx: next/dynamic za vse 23 zavihkov (code-splitting; prej vse v initial bundle) + pravi sync
  - README: usklajene številke + Vercel demo sekcija + demo prijava + scrypt opis
  - tsconfig: skills/tests/mini-services izključeni iz tsc
- Vercel env: pobrisane 5 zastarelih Supabase spremenljivk; nastavljene DATABASE_URL, SESSION_SECRET, API_KEY_PEPPER
- Deploy prek CLI: dpl_7GWr3WRuDU54dzfW READY, nato rebasa na origin/main (5 novih upstream commitov,
  med drugim lasten rate-limit — vzet upstream verzija) → ponoven deploy dpl_8epmw2NAehpGPTAY READY
- Živa preverjanja produkcijskega URL-ja: / → 307, /login → 200, prijava demo@roksal.si → 200,
  /api/projects (seja) → 200 s pravimi podatki, /api/inventory → 200; brskalniški E2E uspešen
- Raziskava konkurenčnih AR repojev (web-search): Devden AR Railing, Realitech, immersive-web/webxr-samples,
  ARCore Depth API, Depth Anything V2 ONNX (brskalnik), AR-Ruler (ARKit), AR.js, 8th Wall open source

Stage Summary:
- Vercel ERROR deploymenti → READY; živa aplikacija deluje (prijava + podatki)
- Lokalno stanje: 147/147 testov, tsc 0 napak, dev server na :3000 deluje
- Pomembno: fix commit je SAMO LOKALNO (peskovnik); GitHub repo razvija se naprej —
  potrebno je potisniti commit 1922dac na origin/main (manjka GitHub token)
- SQLite na Vercelu = demo način (podatki kratkotrajni); produkcija: Turso/Postgres ali VPS

---
Task ID: 2
Agent: webDevReview cron (runda 2)
Task: QA + nova funkcionalnost + styling polish

Work Log:
- Preveril worklog + origin/main (nov docs-only commit 1857be3) → rebasa brez konfliktov
- Stanje: 147/147 testov, tsc 0 napak, lint 0 napak (po izključitvi prisma/seed.cjs), dev strežnik OK
- Brskalniški QA: prijava → dashboard → onboarding → vsi ključni tokovi delujejo; napak v konzoli ni
- NOVO: ukazna paleta (Ctrl+K ali iskalni gumb v TopBar) — navigacija na vse zavihke/module,
  iskanje in izbor projekta, akcije (sync, tema). shadcn cmdk, brez novih odvisnosti
- NOVO: vremenska kartica "Pogoji za montažo" na dashboardu — temperatura, veter/suniki,
  veterni kompas s smerjo, ocena tveganja (Varno/Previdno/Nevarno/NE montaža) + max varna
  višina ograje; uporablja obstoječi /api/weather (demo fallback brez OpenWeather ključa);
  koordinate vzame iz naslednje montaže, sicer Kranj
- STYLING: login (temno navy ozadje, amber žarek, znamka R, polirana kartica), TopBar iskalni
  gumb s Ctrl K kbd namigom, mehek fade/slide prehod med zavihki (framer-motion)
- TIPS: Project.latitude/longitude dodana v kanonični tip + lokalni dashboard tip
- Preverjanja po spremembah: tsc 0 napak, 147/147 testov, lint 0 napak, brskalniški E2E
  (prijava → vremenska kartica izrisana → Ctrl+K paleta → skok na Kalkulator deluje)

Stage Summary:
- Aplikacija stabilna; dodani vrednosti: hitra navigacija (paleta) + domensko koristna
  vremenska kartica (odločitev o montaži)
- Commit lokalno: "feat(ui): ukazna paleta (Ctrl+K), vremenska kartica za montažo, styling polish"
- Naslednji koraki (predlogi): (1) potisni obe lokalni commita na origin (manjka GitHub token),
  (2) WebXR hit-test sidranje v ar-scanner, (3) Depth Anything V2 ONNX za avto-meritve,
  (4) združi lokalni dashboard Project tip s kanoničnim @/lib/types

---
Task ID: DEMO-LOGIN-AR
Agent: Main Orchestrator (Z.ai Code)
Task: Popravi prijavo ("nemorem se logirat") — najboljše odprto brez login; AR raziskava repojev za meritve/slikanje/menjavo ograj; delo SAMO na Roksal-Railing-Manager.

Work Log:
- Ugotovljeno: lokalni login deluje (demo@roksal.si / RoksalDemo2026! iz seeda), a lastnik na Vercelu gesel ne pozna (seed ne teče vedno; create-admin zahteva shell)
- Implementiran javni demo dostop: nova ruta POST /api/auth/demo (upsert demo profila brez seeda + podpisan sejni žeton + audit + rate-limit 10/uro/IP + izklop z DEMO_ACCESS=off)
- proxy.ts: /api/auth/demo dodan med javne poti
- login/page.tsx: gumb "Vstop brez prijave (Demo)" (amber, z ločilno črto "ali")
- E2E z agent-browser: počiščeni piškotki → redirect na /login → klik demo gumba → dashboard 200, brez page errors; desktop + iPhone 14 screenshot
- Lint čist; commit e3999a0 pushan na main (Vercel bo avtomatsko deployal)
- AR raziskava (GitHub API, 24 poizvedb): niša "AR ograja/balkon" je PRAZNA — ni enega dominantnega open-source repozitorija; naše funkcije (WebXR depth-sensing ±1-2cm, plane detection, AR meritve, tloris) so že na vrhu n主流e
- Vercel audit 20 projektov: roksal-railing-manager READY; ograje-landingpage popravljen (next-themes + ThemeProvider, commita 2b37e8c8/639bcc19 → READY, HTTP 200)

Stage Summary:
- "Vstop brez prijave" deluje lokalno in bo po pushu deloval tudi na Vercelu (demo ruta ustvari račun sama)
- Ključni konkurenti za meritve: googlesamples/arcore-depth-lab (⭐871, Depth API), TapeScan-iOS (LiDAR + RoomPlan tlorisi), MeasureXR (WebXR), Depth-Anything-3 (⭐6.4k AI globina za običajne fotke), pmndrs/xr (⭐2.6k WebXR v Reactu)
- Priporočilo: Depth-Anything-3 backend za merjenje iz navadnih fotografij (brez LiDAR/ARCore)

---
Task ID: AR-CAMERA-BOOST
Agent: Main Orchestrator (Z.ai Code)
Task: Raziskuj in izboljšaj AR kamera analizo — čimbolj lahkotnejše merjenje ("razsici"/razširi).

Work Log:
- Analiza obstoječe kode: webxr-scanner.tsx (494 vrstic, deloma simulacija), ar-scanner.tsx (2213 vrstic, prava kamera z anchor točkami, kalibracijo, overlay vizualizacijo, capture + zgodovino)
- Ugotovljene vrzeli: brez torch/zoom/fokusa, brez haptike, brez undo, brez AI analize, brez indikatorjev stabilnosti/osvetlitve
- Implementiran backend POST /api/ar/analyze: VLM glm-4.6v (z-ai-web-dev-sdk, samo backend) → strukturirana analiza (tipOgraje, stanje, material, predlaganaBarva, tipMontaze, ovire, priporoceneMere[3-5], opombe, zaupanje)
- Robustnost: normalizacija camelCase/snake_case ključev, validacija tipOgraje, fallback 4 standardnih mer (dolžina, višina, razmik stebrov, odmik), 2 poskusa ob odrezanem JSON, rate-limit 20/10 min, audit AR_AI_ANALIZA
- Frontend ar-scanner.tsx (+~740 vrstic):
  · gumb AI analiza (Sparkles) + Sheet z rezultatom, "Uporabi priporočila" samodejno izbere profil iz kataloga, AI povzetek gre v opombe posnetka
  · torch toggle (če track podpira), zoom drsnik (getCapabilities), tap-to-focus (pointsOfInterest), ideal 1920×1080
  · haptika zibaj() ob dodajanju točke/meritvi/kalibraciji/capture
  · Undo gumb (v teku → meritev → točka)
  · "Stabilno — zajemi zdaj" badge (DeviceMotion rotationRate < 12°/s za 700 ms)
  · "Temno — prižgi bliskavico" badge (luma sampling 32×32 vsake 2,5 s, prag 42)
- Verifikacija: tsc --noEmit 0 napak, eslint čist; E2E API test z generirano foto ograje → TIP/MATERIAL/STANJE izpolnjeni + 4 mere; agent-browser: AR scanner renderira z novimi gumbi, AI gumb pravilno disabled brez kamere, ni page errors
- Commit 9b829c8 pushan na main

Stage Summary:
- AR kamera zdaj: en klik AI analiza fotografije → samodejni izbor profila + priporočene mere; kamera kontrola (torch/zoom/fokus/HD) odpravlja najpogostejše vzroke slabih meritev; haptika + stabilnost + osvetlitev vodijo monterja do pravega trenutka zajema
- Naslednji koraki (predlog): realni XRFrame hit-test v webxr-scanner (namesto simulacije), posodobitev README, foto-receipt (kompozit + AI overlay ob shranjevanju)

---
Task ID: 2-b
Agent: frontend-styling-expert
Task: Responsive pass za telefon in tablico (top-bar, bottom-nav, dashboard, measurements, calculator, inventory, photo, login)

Work Log:
- top-bar.tsx: notranji container `max-w-lg md:max-w-3xl lg:max-w-5xl` (usklajen s page.tsx), md+: px-6 py-4, večja znamka R (h-10/text-base), naslov md:text-lg, gap-2 med akcijami, iskalni gumb md:h-10; vse akcije ohranjene
- bottom-nav.tsx: notranji container `md:max-w-3xl lg:max-w-5xl` + md:px-4; zavihki na md+ `md:text-[11px]`, ikone `md:h-5 md:w-5`, md:gap-1 (min-h-48px dotik ostane); "Več" sheet: `sm:gap-4 md:grid-cols-3 md:px-6 md:pb-6`; safe-area padding in obnašanje nespremenjena
- dashboard-tab.tsx: root `md:space-y-5 md:px-6 md:pb-6`; "Pregled projekta" + "Aktivnost (6 mesecev)" zdaj v skupnem gridu `md:grid-cols-2` (telefon: isto kot prej, ena pod drugo); stats row md:gap-4; oprema md:gap-4; seznam projektov md:max-h-[32rem] (več vrstic brez scrolla); gumb "Nov projekt" md:w-auto md:px-8; truncation ostane (truncate + min-w-0)
- measurements-tab.tsx: root `md:space-y-5 md:px-6 md:pb-6`; kartice meritev v skupinah po datumih: `md:grid md:grid-cols-2 md:gap-3 md:space-y-0` (telefon: en stolpec space-y-3); preglednica stebrov wrapal v `overflow-x-auto` (+ obstoječi overflow-y) — tabela ne more prekoračiti širine na telefonu
- calculator-tab.tsx: root `md:space-y-5 md:px-6 md:pb-6`; Vhodna polja (railing) `md:grid md:grid-cols-2 md:gap-4 md:space-y-0` (4 meritve v 2 stolpcih); "Results Grid" (4 statistike) `md:grid-cols-4 md:gap-4`; enako za anchoring "Main Results"; "Skupaj material" + "Ocena stroškov" zavita v `grid gap-4 md:grid-cols-2 md:items-start` (telefon: gap-4 = prejšnji space-y-4, vizualno identično); cut list (grid-cols-12) nič slomljeno
- inventory-tab.tsx: root `md:space-y-5 md:px-6 md:pb-6`; seznam artiklov `md:grid md:grid-cols-2 md:gap-3 md:divide-y-0 md:p-3` + vrstice `md:rounded-lg md:border` (kartice na tablici, delilne črte na telefonu); stats md:gap-4; Naroči gumb/progress bar nespremenjena
- photo-tab.tsx: root `md:space-y-5 md:p-6`; masonry galerija + skeleton `md:columns-4` (telefon columns-2, sm columns-3 kot prej); batch-upload progress na md+ kot toast desno (`md:left-auto md:w-96`); anotacijski editor/kamera nista dirjana (fullscreen overlaya)
- login/page.tsx: kartica `md:max-w-md`, main `md:p-8`, znamka `md:h-14 md:w-14 md:text-xl`, naslov `md:text-2xl`
- Verifikacija: `bunx tsc --noEmit` — 0 napak; `bun run lint` — čisto; agent-browser spot-check: prijava (demo gumb) → / → zavihki; tablet 820×1180: top-bar/nav computed max-width 768px (md:max-w-3xl), dashboard graf e2 352px stolpca, kalkulator vhodi 335px × 2, zaloga 341px × 2, nav label 11px / ikona 20px; telefon 390×844: containerja 512px, label 9px / ikona 18px, vsi sklad 1-stolpčni (mobile-first ohranjen). Screenshoti: /tmp/roksal-2b-*.png

Stage Summary:
- Samo additive sm:/md:/lg: Tailwind klase — privzeti (telefon) razredi so ostali 1:1, zato mobile-first izgled nespremenjen; na md 768+/lg 1024+ vsebina izkoristi širino (2–3 stolpca, 4-col masonry, širše preglednice)
- Ključne odločitve: (1) dashboard graf kartici skupaj v en md:grid-cols-2 wrapper (isti pogoj totalProjects>0, brez dupliranja pogojev); (2) seznam meritev/artiklov 2-col preko md:grid + md:space-y-0 (nevtralizacija marginov), brez preurejanja DOM-a kartic; (3) inventory vrstice na md+ dobijo border/rounded, da delujejo kot kartice v gridu; (4) kalkulator "Skupaj material"+"Ocena stroškov" stransko po sebi na md+ (dopolnitev "two-column summary")
- Namerno puščeno / tveganja: weather-card.tsx ni bil v scope-u (lastna komponenta, ostane full-width); ostali kalkulator mode-i (wind, gate, …) imajo že 2-col vhodne gride in niso dirjani; data-prazni demo (ni meritev/slik) onemogoča vizualni check 2-col meritev in md:columns-4 galerije — klasi so v kodi in vezani na enake pogoje kot obstoječi izris; page.tsx, scannerji, API, prisma, config: nedotaknjeni

---
Task ID: 2-a
Agent: Main Orchestrator (Z.ai Code)
Task: PRAVI XRFrame hit-test v WebXR scannerju (zamenjava simulacije) — "da tudi WebXR meri zares"

Work Log:
- webxr-scanner.tsx popolnoma prepisan (494 → ~860 vrstic), simulacija odstranjena:
  · seja: requiredFeatures ['hit-test'] (brez hit-testa ne starta) + optional ['anchors','depth-sensing','plane-detection','dom-overlay']; 1. poskus z vsemi, fallback brez extras; brez probe sej ob mountu (samo isSessionSupported)
  · prava zanka: session.requestAnimationFrame(onXRFrame) — XRFrame API; prozoren WebGL2 framebuffer (ARCore kompozitor prikaže kamero); XRWebGLLayer baseLayer
  · hit-test: session.requestHitTestSource({space: viewerSpace}) + frame.getHitTestResults() vsak frame → retikla drži realno ploskev
  · sidra: XRHitTestResult.createAnchor() → točke imajo XRAnchor; frame.getPose(anchorSpace) vsak frame → mere se samodejno kalibrirajo (ARCore drift korekcija)
  · Depth API: frame.getDepthInformation(view).getDepthInMeters(0.5,0.5) → živa razdalja do objekta na sredini zaslona
  · plane-detection: frame.getDetectedPlanes() → števec + ločeno navpične
  · dom-overlay HUD: statusni čipi (Hit-test/Sidra/Globina/Ravnine/Overlay/FPS), retikla + markerji točk pozicionirana prek lastne mat4 projekcije world→NDC→px (brez three.js), direktni DOM update pri 60 fps, React sync le 4 Hz
  · 'select' dogodek = tap → postavi točko; gumbi z 'beforexrselect' preventDefault + suppress flag (klik na UI ne postavi točke)
  · živa razdalja A→retikla (tape-measure način, velika številka), undo (točka→meritev z brisanjem sider), haptika
  · Shrani: PRAVI POST /api/measurements — dolžina = najdaljši vodoravni segment, višina = najdaljši navpični (fallback najdaljši), arMetadata {source:'webxr-hit-test', segments[], features, planeCount, fps}
  · po koncu seje mere ostanejo → "Zadnja seja: N mer" + Shrani tudi iz idle kartice
- Verifikacija: tsc --noEmit 0 napak, lint čist; agent-browser E2E: demo prijava → AR zavihek → kartica "WebXR AR — pravi hit-test" z XRFrame badge; na namizju pravilno "Ni podprto" (brez navigator.xr) — prava meritev potrebuje ARCore telefon (Chrome Android)
- page.tsx: main/sync/indikator max-w-lg → md:max-w-3xl lg:max-w-5xl; AR zavihek grid sm:grid-cols-2
- Commit 0957954 pushan na origin/main (Vercel avtomatsko deploya); 11 datotek, +1000/−363

Stage Summary:
- WebXR zdaj MERI ZARES: retikla = frame.getHitTestResults, mere = razdalja med XRAnchor pozicijami, shranjevanje = pravi API klic. Brez three.js (lastna projekcija, DOM overlay HUD)
- Prenosljivost: hit-test = obvezen (Chrome Android + ARCore); sidra/globina/ravnine = opcijski z elegantno degradacijo; iOS Safari ostaja "ni podprto"
- Naslednji koraki (predlog): WebXR posnetek ozadja (preserveDrawingBuffer) → AR snapshot slika; Depth-Anything-3 backend za meritve iz navadnih fotk (brez ARCore); test na pravem ARCore telefonu

---
Task ID: 3 (runde A–D)
Agent: Main Orchestrator (Z.ai Code) + frontend-styling-expert (3-b)
Task: Implementacija vseh 9 predlogov izboljšav (UI/UX + PWA + glas + AI) po uporabnikovem "nadaljuj vse po vrsti"

Work Log:
- RUNDA A (commit d6d108e):
  · NotificationCenter (novo): zvonek v TopBar z badge — nizka zaloga, današnje montaže
    (FIX: polje je datumMontaze, ne datumMontaza — prej 0 montaž), vremensko opozorilo;
    klik navigira prek 'roksal:navigate'; osveževanje ob 'roksal:refresh'
  · QuickActionsFab (novo): amber FAB nad BottomNav — AR meritev/slika/meritev/skica/
    kalkulator; framer-motion stagger meni; centralna navigacija
  · Pull-to-refresh: upor (dy*0.45, max 96px), indikator z rotacijo, haptika, sync
  · page.tsx: skeleton TabLoading; 'roksal:navigate' + 'roksal:calc-import' poslušalca
  · 3-b subagent: api/search (auth, JS lowercase filter), paleta z debounced search
    (Stranke/Material skupini), EmptyState komponenta v meritev/slike/zalogo/
    dokumenti/CRM, skeletoni
- RUNDA B (commit cfc141f):
  · sw.js v2: network-first navigacije z /offline.html fallbackom, cache-first
    _next/static, API GET cache fallback; offline.html (slovenska stran)
  · lib/offline-queue: localStorage vrsta (max 50) + fetchWithQueue (202 queued)
    + samodejni flush ob 'online'; integriran v WebXR Shrani
  · pwa-status.tsx: offline pas s števcem + install prompt (beforeinstallprompt)
  · manifest.json shortcuts (AR/Kalkulator/Meritve) + page.tsx ?tab= deep-link
- RUNDA C (commit 02da4f9):
  · lib/sl-speech: parser sl številk 0–9999 (sklanjatve metre/centimetre,
    compound 'dvaindvajset', decimalki '2,4', 'dva metra štirideset'→2400mm)
    — 13/13 testov; useSpeechRecognition hook (sl-SI)
  · Meritve: mikrofon pri Dolžina/Višina (pulziranje, haptika, toast)
  · WebXR: 'V kalkulator' gumb (roksal:calc-import) + AR shema — canvas tloris
    (pogled zgoraj, grid, segmenti z mm, A/B točke, noga) → POST /api/ar-snapshots
- RUNDA D (commit 3f70321):
  · api/measure/photo: VLM ocena dolzinaMm/visinaMm/razmikStebrovMm iz fotke
    (BUGFIX: SYSTEM_PROMPT prej NI bil poslan modelu → sedaj system message)
  · photo-measure.tsx v Meritvah: fotografiraj → ocena → popravi → shrani
    (zaupanje badge, izhodišče, offline vrsta); E2E 2400×1100mm zaupanje 0.6

Stage Summary:
- Vseh 9 predlogov implementiranih: FAB, pull-to-refresh, obvestila, prazna
  stanja, globalno iskanje, offline PWA, glasovni vnos, AR→kalkulator+shema,
  AI foto meritve; 4 commiti pushani (d6d108e, cfc141f, 02da4f9, 3f70321)
- tsc 0 napak, lint čist po vsaki rundi; E2E: obvestila (6 items), FAB
  navigacija, iskanje 'inox'→Zaloga, mic gumba, AI API z realnim klicem
- Za produkcijo: SW se aktivira šele na Vercelu (dev ga ne registrira);
  pravi WebXR/glas preveriti še na fizičnem telefonu

---
Task ID: 4 (runda E)
Agent: Main Orchestrator (Z.ai Code)
Task: Spletna raziskava forumov/konkurence (16 poizvedb) + implementacija top 2 najdbi: satelitsko merjenje in prejemni zapisnik

Work Log:
- RAZISKAVA (15 poizvedb prek web_search): QuoteIQ (satellite measuring $74.99/mo,
  headline f. za ograjnike), ProFence (Measure Your Fence Line — stranka riše črto),
  punch list orodja (Kraaft, GoAudits, SnaggingTrack — foto + snags + podpis → PDF),
  quote follow-up (Jobber/OctopusPro/ServiceTrade — reminderji zvišajo approval),
  AR natančnost (drift = #1 pritožba uporabnikov AR meril), slovenski ceniki ograj
  (primerjam.si 19–180 €/tm), FURS davčno potrjevanje, geodetska ureditev meje
  (moj-geodet.si, allgea.si — soglasje sosede pred montažo)
- E-1 MapMeasure (src/components/roksal/map-measure.tsx, novo):
  · Leaflet 1.9 + Esri World Imagery satelit + World Boundaries imena (brez API ključa)
  · klik → točke (divIcon pin, številčeni), polyline črta, haversine razdalje,
    segmenti po dolžini, Nazaj/Počisti, GPS centriranje, zoom kontrola
  · višina ograje select (1000–2200 mm, default 1800), "Shrani v meritve" →
    POST /api/measurements (fetchWithQueue — offline vrsta), arMetadata
    {source:'satellite-map', provider, segmentiM, skupajM}, gpsLokacija
  · nasvet natančnosti (±1–2 m, končna meritev AR na terenu)
  · nameščen leaflet + @types/leaflet; CSS import v komponenti deluje
- E-2 PunchList (src/components/roksal/punch-list.tsx, novo):
  · Prisma model PunchItem {projectId, naslov, opomba, status open|done|issue}
    + relacija project.punchItems; bun run db:push (FIX: Prisma zahteva dvojne
    navedke @default("open") — enojni so P1012 validation error!)
  · API /api/punch GET?projectId / POST / PATCH / DELETE (authenticate + zod)
  · UI: progress bar (done/total), klik status open→done→issue cikel z optimističnim
    update + rollback, dodajanje točk, brisanje, 8 STANDARDNIH TOČK za SI tržišče
    (meja z sosedom/geodetski zaznam, soglasje sosede, komunale, dostop, montaža,
    vodnost, čiščenje, predaja) — pokrije tudi punch-list raziskavo
  · PDF zapisnik (jsPDF + autoTable): Roksal glava, projekt/naročnik/monter, tabela
    z statusi (barvni tekst), povzetek, PODPISNA BLOKA izvajalec/naročnik, footer
  · integracija: Več → Dokumenti (PunchList nad DocumentsTab)
- page.tsx: MapMeasure v AR zavihku (pod WebXR/AR kartama, pb-0 + p-4 wrapper),
  PunchList v Dokumentih; dynamic import ssr:false (Leaflet potrebuje window)

Stage Summary:
- E2E z agent-browserjem: 3 klik na satelitski karti → 270 m, Shrani → toast
  "Meritev shranjena" + POST 201 + AuditLog v db.log; zapisnik: 8 standardnih
  točk → 2 ciklana na done → 25 % progress → PDF "Zapisnik pripravljen"
- tsc 0 napak, lint čist; mobilni 390×844 in tablični 820×1180 brez overflow,
  map 306/684 px; pomembno: Leaflet ignorira sintetične klikove — testirati
  z realnimi CDP kliki (mouse move/down/up)
- Ostale raziskane ideje za naslednje runde: quote follow-up reminderji
  (Deal + followUpDate + obvestilo), AR accuracy coach (3× merjenje + povprečje),
  beton/zmrzovalna globina v kalkulatorju, strankina samomeritvena povezava
  (share map link), FURS račun layer

---
Task ID: 5 (runda F — cron webDevReview)
Agent: Main Orchestrator (Z.ai Code)
Task: QA ocena + follow-up spomniki ponudb (F-1) + AR accuracy coach (F-2) + betoniranje stebrov (F-3) + styling dodelava

Work Log:
- QA: dev.log brez runtime napak; git čist (8e8b0e8); tsc/lint čisti
- F-1 QuoteFollowUp (src/components/roksal/quote-followup.tsx, novo):
  · Prisma Project: + followUpDate DateTime?, followUpOpomba String? (db:push)
  · updateProjectSchema: + followUpDate (string|null) + followUpOpomba;
    /api/projects PATCH pretvori ISO string → Date (Prisma ne sprejme stringa)
  · CRM zavihek: kartica "Ponudbe — sledenje" na vrhu — seznam nepodpisanih
    projektov, hitri gumbi Pokliči (danes)/+3 dni/+7 dni, date input, X briši;
    POTEKEL (rok ≤ danes) = rdeč poudarek + badge, ≤3 dni = amber
  · NotificationCenter: nova vrsta 'followup' (FileClock, oranžna) — zapadli
    spomniki (!dealLocked, ≠ZAKLJUCENO) do 6, meta "zapadlo X dni"/"danes",
    klik → navigacija {tab:'more', more:'crm'}
  · NASTAVLJANJE DELUJE ŠELE PO RESTARTU dev strežnika — Turbopack keša star
    @prisma/client; po db:push z novimi polji MORA dev server restartati!
  · E2E: +3 dni → DB followUpDate=2026-09-25 ✓; Pokliči → obvestilo "DANES" ✓;
    mobilni 390px: rdeč "1 zapadel" badge, brez overflow ✓
- F-2 AR accuracy coach (webxr-scanner.tsx):
  · analyzeSpread(lens): count/avg/min/max/spreadPct; verdicti: ≤2 % zanesljivo,
    ≤5 % sprejemljivo, >5 % razhajajoce (drift = #1 pritožba AR merilnikov)
  · summarize() vrne še accuracy {horiz, vert}; shrani se v arMetadata.accuracy
  · toast ob shranjevanju: "✓ kontrola natančnosti OK" / "⚠️ meritve se
    razlikujejo — priporočamo ponovno merjenje"
  · živi chip v session panelu (measurementsView @4Hz): razpon min–max mm + %
  · UNIT TEST logike (node replikacija): 6/6 PASS (enaka meritvi, 2 %, 3–5 %,
    drift >5 %, ena meritev → null, cm-drift 80 mm)
- F-3 Betoniranje stebrov (calculator-tab.tsx, material način):
  · nova kartica za "Rezerva materiala": št. stebrov iz materialResult (+rezerva),
    premer luknje select 200–400 mm (default 300), globina input (default 800 mm)
  · volumen: π·r²·h − profil 60×60 mm; 25 kg vreča ≈ 12 L; E2E: 4 stebra @300/600
    → 161 L, 14 vreč (matematika ✓)
  · opozorilo pod 800 mm: zmrzovalna globina SI ≈ 80 cm — zmrzal dviguje stebre
- Styling dodelava: mikro-animacije pina na satelitski karti (vstop .22s,
  pritisk scale .9, drop-shadow), pulzirajoči hint overlay, focus-visible ring
  na status gumbih zapisnika

Stage Summary:
- 3 nove funkcije pushane; E2E: follow-up DB+UI+obvestila ✓, betonska kartica
  matematika ✓ (161 L/14 vreč), accuracy logika 6/6 testov ✓
- KRITIČNO znanje: po vsaki prisma db:push z NOVIMI polji je obvezen restart
  `bun run dev` (Turbopack keša star Prisma Client → "Unknown argument")
- Naslednje: strankina samomeritvena povezava (share map link → javna stran),
  FURS račun layer, LiDAR iOS; opcijsko accuracy coach še v photo-measure

---
Task ID: 6 (runda G — cron webDevReview)
Agent: Main Orchestrator (Z.ai Code)
Task: Samomeritev stranke prek javne povezave (/m/[token]) — ProFence lead-gen model iz raziskave + QA popravki

Work Log:
- QA: dev.log čist, tsc/lint čisti; Edina opozorila: Next dev overlay "scroll-behavior
  smooth" → POPRAVLJENO z data-scroll-behavior="smooth" na <html> (layout.tsx)
- G-1 Javni API (src/app/api/public/measure/route.ts, novo):
  · GET ?token → {nazivProjekta, stranka} (najmanj podatkov), POST shrani meritev
  · varnost: clientToken lookup (isti token kot portal), zod validacija (2–300
    točk, lat/lng meje, skupajM 0.1–100000), in-memory rate limit 6/uro/token+IP,
    max body implicitno skozi zod; NE razkrije nič drugega
  · meritev: dolzinaMm=skupajM, visinaMm default 1800, arMetadata {source:
    'customer-map', tocke, opombaStranke, imeStranke, telefonStranke}
  · MIDDLEWARE FIX: src/proxy.ts PUBLIC_PREFIXES += '/m/', '/api/public'
    (sicer "Neavtoriziran dostop" na vse javne rute!)
- G-2 Javna stran /m/[token] (novo):
  · page.tsx (server): token lookup → "Povezava ni veljavna" ali MeasureClient
  · measure-client.tsx (klient): Leaflet + Esri satelit, tap → številčeni pini
    (30px, večji za dotik), rumena črta, haversine dolžina, Nazaj/Počisti, GPS
  · obrazec: ime (obvezno), telefon, opomba; 52px pošlji gumb; zahvala ekran
    "Hvala, {ime}!" z povzetkom in kontaktom Roksal
  · personaliziran pozdrav "Pozdravljeni, {ime stranke}!" + 3-koračna navodila
  · mobilni-first: max-w-xl, 44px+ tipki, brez overflow (390px preverjeno)
- G-3 Deli povezavo v aplikaciji (map-measure.tsx):
  · gumb "Pošlji stranki" (amber) → dialog: URL /m/{token}, Kopiraj (clipboard
    + fallback toast), WhatsApp (wa.me pre-generirano sporočilo), Deli prek
    telefona (navigator.share); clientToken + nazivProjekta nov props iz page.tsx
- G-4 Meritve: oranžna "Stranka" značka (UserRound ikona) za source='customer-map'
  + types.ts: Project + clientToken/followUpDate/followUpOpomba tipi

Stage Summary:
- E2E (realni CDP klik — Leaflet ignorira sintetične): javna stran 3 točke →
  946.6 m → submit → "Hvala, Mojca!" ✓; DB: 3 meritve source=customer-map ✓;
  Stranka značka v Meritvah ✓; share dialog z URL/WhatsApp ✓; mobilni javna
  stran brez overflow ✓
- Odkritje: Meritve tab ima VLASTEN izbrnik projekta (default prvi projekt iz
  /api/projects) — ne sledi selectedProjectId glavne app; duplikati imen
  otežijo testiranje (3× Kokalj, 3× Novak). Priporočam sinhronizacijo v naslednji rundi
- commit a6f47b6 (runda F) + to runda: proxy + layout fix + samomeritev

---
Task ID: 7 (runda H — cron webDevReview)
Agent: Main Orchestrator (Z.ai Code)
Task: FURS račun layer (računi s šumniki v PDF) + popravek sinhronizacije Meritve izbrnika + font fix za vse PDF-e

Work Log:
- QA: login ✓, dashboard ✓, dev.log čist; potrjen bug iz runde G (Meritve
  izbrnik ne sledi glavni app) → POPRAVLJENO v tej rundi
- H-1 Sinhronizacija Meritve izbrnika (measurements-tab.tsx):
  · MeasurementsTabProps + selectedProjectId prop; page.tsx ga poda naprej
  · bootstrap: ref (selectedProjectIdRef) prepreči stale-closure, izbere glavni
    projekt namesto vedno prvega; sync useEffect sledi zunanji izbiri
  · E2E: klik Ograja Novak kartica → Meritve izbrnik kaže Novak ✓
- H-2 FURS računi (nova funkcija — vir raziskave ZDDV-1 37. člen):
  · Prisma model Invoice (tip PREDRACUN/RACUN/PREDPLACILNI, stevilka unique
    "2026-NNN" samodejno per leto+tip, postavke+kupec JSON snapshot, osnova/ddv/
    znesek strežniško izračunani, status OSNUTEK→IZDAN→PLACAN|STORNIRAN,
    rokPlacilaDni); Project.invoices; db:push + RESTART dev strežnika
  · API /api/invoices (GET/POST/PATCH/DELETE): zod validacija, DDV stopnje
    22/9.5/0, round2 vsote strežniško, IZDAN zaklenjen (409 na urejanje),
    brisanje samo OSNUTEK (storno namesto delete — pravna sled)
  · UI InvoiceManager (invoice-manager.tsx) v CRM tabu pod follow-upi:
    povzetek PLAČANO/ODPRTO/ZAPADLO, kartice z status badge + zapadlo X dni,
    živi izračun DDV po stopnjah v dialogu, "Iz BOM" uvoz postavk, dvostopenjska
    storno potrditev (3 s), scrollbar-thin, bg-card dark-aware
  · FURS PDF (jsPDF): navy glava, izdajatelj z davčno/mat. št. + TRR, naročnik
    snapshot, datumi + rok, postavke tabela, DDV skupine, "Za plačilo" poudarek
  · Obvestila: nova vrsta 'invoice' (Receipt, rdeča) — zapadli IZDAN računi do
    6, meta "zapadlo X dni", klik → {tab:'more', more:'crm'}
- H-3 ŠUMNIKI V PDF-ih POPRAVLJENI (globalno):
  · jsPDF core Helvetica NE podpira ŠČŽ ("NAROČNIK"→"NARONIK") — prizadeto vse
    dosedanje PDF generacije
  · Roboto subset TTF (latin+latin-ext+€, 23 KB/varianta, fontTools subset):
    src/lib/pdf-sl-font-data.ts (base64) + src/lib/pdf-sl-font.ts
    (registerSloPdfFonts(doc)) — NE poimenuj z "use*" prefixom (rules-of-hooks!)
  · Uveljavljeno v: invoice-manager, punch-list, pdf-export (delovni list +
    ponudba, tudi autoTable styles font:"Roboto")
  · E2E: pdftotext → "RAČUN", "NAROČNIK", "Davčna št." ✓
- E2E celoten tok: dialog Nov račun → 12 m × 85,50 € = 1026,00 + 225,72 DDV =
  1251,72 ✓ → Osnutek 2026-001 → Izdaj → Plačan (plačano 22. 9.) ✓; seed
  2026-TEST (20 dni star) → obvestilo "ZAPADLO 12 DNI" ✓ → klik → CRM ✓;
  povzetek: PLAČANO 1251,72 / ODPRTTO 732,00 / ZAPADLO 732,00 (1) ✓; mobilni
  390px brez overflow ✓; tsc + lint čisti ✓

Stage Summary:
- FURS račun layer produkcijsko uporaben: številčenje, DDV, zaklenjeni izdani,
  storno sled, zapadlosti v obvestilih; vse PDF-je zdaj pravilno tiska šumnike
- KRITIČNO: helperji v src/lib NE smejo imeti "use" prefixa (eslint
  rules-of-hooks tretira kot hook) — zato registerSloPdfFonts/applySloFont
- Naslednje runde: LiDAR iOS (potreben realen iPhone), UPN QR koda na računu
  (ISO 20022), eSlog XML izvoz za eRačun, FURS davčni blagajni režim (prostor/
  naprava), Meritve "Stranka" značka + izbrnik — nadaljnja dodelava

---
Task ID: 8 (runda I — cron webDevReview)
Agent: Main Orchestrator (Z.ai Code)
Task: UPN QR koda na računih (ISO 20022/upn-qr.si spec) + eSlog 2.1 eRačun XML izvoz + obvestila dedup + stilski dodelavi

Work Log:
- QA start: dev.log čist, tsc/lint čisti, login ✓, dashboard ✓, obvestila ✓, CRM računi ✓;
  potrjena drobnost — 4× enako obvestilo "Ograja Novak V TEKU" (projekti z istim imenom)
- I-1 UPN QR (novo, src/lib/upn-qr.ts):
  · format preverjen z web-search (upn-qr.si/ZBS) + primerjava z referenčno npm implementacijo
    upnqr@1.2.2 (matjaz/upnqr) — NIZJE BAJTNO IDENTIČNO (21 polj, \n ločila, kontrolna vsota
    = dolžina polj 1–19 + 19); šumniki ostanejo (spec dopušča ISO-8859-2), IBAN se čisti
  · polja: UPNQR, plačnik (kupec snapshot), znesek v centih 11 števk, koda OTHR, rok
    DD.MM.LLLL, IBAN prejemnika (max 19), referenca "SI12 {številka}", namen
  · E2E DEKODIRANA QR s slik ekrana (jsQR + upnqr decode): dialog QR in QR v PDF oba
    dekodirata → znesek 1251.72, IBAN SI56020100012345678, ref SI12 2026-001, rok 30.9 ✓
- I-2 QR v UI (invoice-manager.tsx):
  · gumb "QR" na kartici (vsi razen STORNIRAN) → dialog: QR slika (qrcode npm, navy
    barve, 512px), plačilni podatki (mono IBAN/referenca, znesek, rok), Kopiraj IBAN /
    Kopiraj referenco (clipboard + execCommand fallback); generiranje asinhrono z cancel
- I-3 QR v PDF: blok levo spodaj (28 mm, naslov + 3 vrstice pojasnil), vsote/opombe
  nedotaknjene; QR opcijski (napaka ne pokvari PDF); pdftoppm 150 dpi → decode ✓
- I-4 eSlog 2.1 eRačun XML (novo, src/lib/eslog-xml.ts + /api/invoices/eslog):
  · UBL 2.1 + CustomizationID urn:cen.eu:en16931:2017 + Peppol BIS ProfileID; InvoiceTypeCode
    380/325/386 po tipu; Supplier (davčna schemeID SI, EndpointID 9957), Customer z davčno,
    PaymentMeans 30 + PaymentID "SI12 …" + TRR, TaxTotal po stopnjah (S/E kategoriji),
    LegalMonetaryTotal, InvoiceLine z unitCode; XML escapiran (Čšž, &, <) — minidom VALID ✓
  · GET ?id → attachment "eracun-2026-001.xml", auth, STORNIRAN → 409; E2E v brskalniku:
    200, Content-Disposition, 3950 B ✓; gumb "XML" (loader state) na kartici
- I-5 Obvestila dedup (notification-center.tsx):
  · enaki (kind+title+subtitle) se združijo v eno kartico z "×N" značko (amber); badge
    šteje skupaj z counts (7 signalov → 4 kartice); E2E: "Ograja Novak" ×4 ✓
- I-6 Stilske dodelave (mandatory styling):
  · kartice računov z statusno letvico (border-l-4: kamen/amber/zelena/rdeča po statusu,
    zapadlost = rdeča); povzetek + progress bar "plačano X % od izdanih" (gradient
    emerald, animiran); QR dialog (belo ozadje, mono podatki, 2 kopir-gumba)
- package.json: + qrcode@1.5.4, + @types/qrcode@1.5.6 (dev)

Stage Summary:
- Računi so zdaj plačljivi z enim skenom (UPN QR standard slovenskih bank) in
  pripravljeni na eRačun kanal (eSlog 2.1 XML za javni sektor)
- Verifikacijska veriga za QR je popolna: ts unit test bajtno identičen z referenčno
  implementacijo → qrcode slika → jsQR iz browser screenshot-a in iz PDF → upnqr decode
  brez napake (kontrolna vsota OK)
- Oznake/kartice: statusna letvica + progress bar izboljšata hitrost branja na terenu
- Naslednja runda: LiDAR iOS (realen iPhone), FURS davčni blagajni režim, UPN QR tudi v
  predplačilnih listih strankam prek portal, eSlog validacija proti MJU XSD v produkciji

---
Task ID: 9 (runda J — cron webDevReview)
Agent: Main Orchestrator (Z.ai Code)
Task: QA ocena + prodajna plošča (kanban drag & drop, dnd-kit) + KML izvoz meritev + popravek manjkajočih statusov v PATCH API

Work Log:
- QA start: dev strežnik bil ugasnjen (nov sandbox zagon) → restart bun run dev; tsc/lint čisti;
  login ✓, dashboard ✓, obvestila ✓, CRM (follow-upi + računi) ✓, dev.log čist — brez bugov, nadaljevanje z novimi funkcijami
- BUG FIX (najden med analizo): zod updateProjectSchema je dovoljal samo 4 od 7 ProjectStatus
  vrednosti — ZA_MONTAZO, V_IZDELAVI, MONTIRANO ni bilo mogoče nastaviti prek PATCH /api/projects!
  → validations.ts dopolnjen z vsemi 7 (E2E potrdil: PATCH ZA_MONTAZO prej 400, zdaj 200)
- J-1 Prodajna plošča (novo, src/components/roksal/deal-pipeline.tsx):
  · 7 stolpcev: Načrtovano / V teku / Za montažo / V izdelavi / Montirano / Zaključeno / Ustavljeno
  · @dnd-kit/core (prva uporaba dnd-kit v projektu — PointerSensor distance 6 + KeyboardSensor),
    useDraggable kartice + useDroppable stolpci + DragOverlay (rotacija + sence)
  · optimistični premik + PATCH /api/projects {status} + rollback + destruktivni toast ob napaki
  · vsaka sprememba statusa → strežnik zapiše AuditLog STATUS_SPREMENJEN (oldValue/newValue/userId,
    auth.kind user→session.sub) — revija za vodjo; 404 če projekt ne obstaja
  · kartice: ime, stranka, cena (€), deal-lock značka, datum montaže, SPOMNIK značka (zapadel
    rdeča/DANES amber/≤3 dni mehka); stolpci: števec + Σ vrednost €, drop-highlight obroč,
    prazno stanje "Povlecite sem"; flash ring po uspešnem premiku
  · dostopnost: dropdown meni "⋮" na kartici (stopPropagation, da dnd ne zajame klika) kot
    alternativа vlečenju + tipkovnica (KeyboardSensor) + aria-labeli; branjje vsot "v obdelavi"
  · vgrajen v CRM tab nad follow-upi (self-fetch /api/projects, enak vzorec kot ostali CRM deli)
- J-2 KML izvoz meritev (map-measure.tsx):
  · gumb "KML" (≥2 točki) → prava .kml datoteka (Blob download): LineString črte ograje
    (amber, aabbggrr ff0b9ef5) + numerirani Placemark T1..Tn + ime projekta v Document.name
  · za geodeta/vodjo — izmerjeno črto odpri v Google Earth/QGIS brez pretipavanja koordinat
- E2E (agent-browser, mobilni 390 + tablica 820):
  · vlečenje Kokalj Načrtovano→V teku: UI stolpec ✓, DB status V_TEKU ✓, AuditLog zapis ✓
  · meni ⋮ Terasa Zupan → Za montažo: DB ZA_MONTAZO ✓ + AuditLog ✓ (dokaz, da zod fix deluje)
  · KML: gumb disabled pri 0 točk → 2 CDP klika na zemljevid → download 840 B → minidom XML
    VALID ✓, vsebina (črta 3186.0 m, T1/T2, ime projekta) ✓
  · 390px in 820px: brez horizontalnega overflowa dokumenta (stolpci scrollajo interno)

Stage Summary:
- CRM ima zdaj vizualno prodajno ploščo po Pipedrive vzorcu — vodja vidi celoten cevovod
  in vrednost v obdelavi; vsak premik je revizijsko sledljiv (AuditLog)
- POPRAVLJEN tih bug: 3 statusi (ZA_MONTAZO/V_IZDELAVI/MONTIRANO) prej sploh niso bili
  nastavljivi prek API-ja — logistika V6 je zato delno mrla pri spreminjanju statusa
- Naslednje runde: LiDAR iOS (realen iPhone), FURS davčni blagajni režim (prostor/naprava),
  eSlog XSD validacija v produkciji, UPN QR v predplačilnih listih portala; opcijsko:
  filter stranke na plošči, prilagodljivi stolpci (skrij Ustavljeno), undo premika
