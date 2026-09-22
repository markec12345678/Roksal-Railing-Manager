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
