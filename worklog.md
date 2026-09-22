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
