# Avtomatizacija — pregled po območjih (issue #1)

> EN VIR: `src/lib/avtomatizacija-audit.ts` — strazar test
> `src/lib/__tests__/r294-avtomatizacija-audit.test.ts` dokazuje, da ta
> dokument ne divergira od liba (vsaka vrstica je pripeta), da vse
> referencirane datoteke DEJANSKO obstajajo in da skener nad celotnim
> `src/lib` jedrom najde **0 nedokumentiranih kršitev**.

## Glavna izjava o AI (issue #1 — acceptance: „documentation clearly states where AI is actually used and where it is not")

**AI kot odvisnost: NIČ** (v jedrih — kalkulacije, izvozi, varnost, sync).
Vsi izvozni dokumenti (40+ PDF/CSV generatorjev), kalkulacije, preverbe,
razvrščanja in varnostne odločitve so čiste deterministične funkcije. Zunanji
AI gostitelji (OpenAI/Anthropic/Qwen/…) so prepovedani s skenerjem
(`PREPOVEDANI_VZORCI`). Iskrena resnica AI dotikov: (a) dokumentiran
fail-closed GPU stub `/api/viz/render` (Qwen NI klican — job zapisi čakajo
strežnik), (b) passthrough podatkovno polje `geminiEstimate` (shranjeno,
nikoli klicano), (c) `/api/measure/photo` — VLM ocena terenske fotografije
(z-ai-web-dev-sdk): **neobvezna pomoč uporabniku, NIKOLI vir resnice** —
deterministična ročna meritev (R278 «Ročni vnos») in SDK validacija
pokrijeta celoten proces brez AI; katalog deklarira nadomestek
(`meritve.dolocanje`).

## Pregled po območjih (issue #1 §1–§11)

| Območje | Razred | Implementacija | Dokaz |
|---------|--------|----------------|-------|
| §1 Photo/VIZ | DETERMINISTICNO | photo-measure.tsx · cv-studio.tsx · map-measure.tsx · /api/viz/render (fail-closed stub) | viz-concurrency.test.ts |
| §2 Measurements | DETERMINISTICNO | meritve-povzetek.ts · meritve-csv.ts · verzioniranje R276/R277 | r276-verzije.test.ts |
| §3 Railing/product configuration | DETERMINISTICNO | product-sdk (8 WoodCore profilov, server-authoritative; jedro zaščiteno) | sdk.test.ts |
| §4 Calculator / quotation | DETERMINISTICNO | calculator-tab (pricing jedro zaščiteno) | r166-termini-prikaz.test.ts |
| §5 Inventory / suppliers / orders | DETERMINISTICNO | zaloga-povzetek.ts · zamujena-dobava.ts | r227-narocilnica-brez-strazar.test.ts |
| §6 Documents | DETERMINISTICNO | csv-export.ts · 40+ PDF/CSV libs (FNV-1a, now KOT parameter) | r258-dobicikonost-pdf.test.ts |
| §7 Installation / scheduling | DETERMINISTICNO | logistika-vozni-red-pdf.ts · schedule-conflicts.ts | r256-tedenski-vozni-red-pdf.test.ts |
| §8 Customer portal | DETERMINISTICNO | portal.ts (varni žetoni, deterministična dovoljenja) | portal.test.ts |
| §9 Security | DETERMINISTICNO | auth.ts · api-keys.ts · rate-limit.ts (CSRF 403 fail-closed) | api-key-lifecycle.test.ts |
| §10 Mobile/PWA/offline | DETERMINISTICNO | offline-queue.ts · /api/sync (v99 gate R274, tombstones R281) | r274-issue17-gate.test.ts |
| §11 AI fallback architecture | AI_OPCIJSKO | automation/ponudniki.ts (AutomationProvider vmesnik: DeterministicniPonudnik VEDNO, AiPonudnik neobvezen env-preklop) + automation/katalog.ts (25 zmožnosti z nadomestnim kontraktom) + kartica na vodji | r294-automation.test.ts + r294-avtomatizacija-audit.test.ts |

## Funkcije, ki IZRECNO koristijo AI (kandidati — NIČ povezano)

| Funkcija | Zakaj | Status |
|----------|-------|--------|
| Segmentacija ograje na terenskih fotografijah (VIZ ozadje) | ročno označevanje na divjih posnetkih je počasno; CV hevristike niso dovolj zanesljive — model bi POMAGAL, ne odločal | NE-IMPLEMENTIRANO — kandidat (nič povezano) |
| OCR rokopisnih terenskih zapiskov | rokopis ni čitljiv za deterministični OCR; struktura vseeno ostane človeški vpis | NE-IMPLEMENTIRANO — kandidat (nič povezano) |
| Razčlenjevanje prostega besedila opisa obsega (CRM zapiski) | prosto besedilo ni struktuirano; predlog strukture bi skrajšal vpis — odločitve ostanejo človeške | NE-IMPLEMENTIRANO — kandidat (nič povezano) |

## Skener determinizma (praktična implementacija — issue #1 „implement the practical parts")

- `PREPOVEDANI_VZORCI`: AI gostitelji, `Math.random`, `Date.now`,
  `toLocale*`, `localeCompare`, `new Date()` (brez argumenta) — iskanje po
  viru PO odstranitvi komentarjev (comment- + string- + regex-aware lexer,
  vrstična struktura ohranjena).
- **SEAM pravilo**: `now: Date = new Date()` / `?? new Date()` /
  `= Date.now()` (privzete vrednosti parametrov) so kanon — parameter obstaja,
  klicatelj lahko poda fiksni trenutek (F4); NE štejejo kot kršitev.
- **Izjeme po TOČNI poti** z obveznim razlogom (20 vnosov — operacijska
  stena ura: zapisi v bazo, TTL/preteki, trajanja jobov, ID-ji; prikazni
  helperji). Izvozna jedra (PDF/CSV) so **brez izjem** — bajtni determinizem.
- Strazar test poganja skener nad celotnim `src/lib` (~215 virov) in zahteva
  **0 kršitev** — vsaka nova nedokumentirana odstopitev pade na CI.

## Meritve zmogljivosti (issue #1 točka 6)

Protokol: `npx vitest run r294-avtomatizacija-audit` (vitest, en proces,
node 24, razvojni stroj) — zgornje meje so obvezne trditve (test pade pri
patološki upočasnitvi); izmerjeno R294:

| Operacija | Vhodi | Meja | Opomba |
|-----------|-------|------|--------|
| dobičkonost presek (dobicikonostPoProjektih) | 2000 računov + 1500 naročil | < 200 ms | izmerjeno ~10 ms |
| tedenski razgled + CSV (tedenskiRazgled + tedenskiVozniRedCsv) | 500 terminov | < 200 ms | izmerjeno ~9 ms |
| prihodki po mesecih (prihodkiPoMesecih) | 3000 plačil | < 150 ms | izmerjeno ~4 ms |

Determinizem meritev: isti vhod = bajtno enak izhod (sklep, CSV, PDF) —
dokazano v istih testih.

## R294 popravki (iz skenerja — praktični deli, implementirano zdaj)

1. `wind-service.ts` — demo vetrični vzorec je bil NAKLJUČEN (Math.random ×7)
   in je hranil varnostno oceno (isSafeForInstallation) → fiksne iskrene
   vrednosti + opis izrecno pove 'Demo (brez živih podatkov)'.
2. `survey-pdf.ts` — `new Date()` ×2 + toLocaleDateString v glavi/podpisu →
   `now: Date` KOT parameter (build/generate split; bajtni determinizem).
3. `crm-csv.ts` — `toLocaleDateString('sl-SI')` na polnem ISO → string rezanje
   (isti kalendarček v vsakem časovnem pasu).
4. `termini-prikaz.ts` — `localeCompare` izenačba → navadno `<` po UTF-16
   (R245/R250 kanon).
5. IZVOZNA JEDRA (audit-csv, boss-report-pdf, document-pdf, ekipa-csv,
   nagibi-csv, punch-csv, termini-csv, zaloga-povzetek) — locale-odvisni
   ICU klici → EN VIR čisti formati (`slDatum`/`slUra`/`slDatumKratko`/
   `formatSlDecimalno`/`MESCI_SL` v csv-export.ts) — bajtno ISTI izpisi
   (ICU prag tisočilca: 5 celoštevilčnih mest), dokazano s paritetnimi testi.

## AI fallback arhitektura (§11 — AutomationProvider, revizija R294 unije)

```
AutomationProvider (AutomatizacijskiPonudnik)  — src/lib/automation/ponudniki.ts
├── DeterministicProvider (DeterministicniPonudnik) — VEDNO na voljo, servisira vse ne-ai zmožnosti
├── (prihodnost) OpenCVProvider / OCRProvider — isti vmesnik
└── AIProvider (AiPonudnik) — NEOBVEZEN: privzeto NE registriran; env preklop ROKSAL_AI_PONUDNIK=1
```

- `ponudnikZaZmoznost(id)` je **fail-closed**: neznana zmožnost ali nedosegljiv
  ponudnik → `null` (nikoli izmišljen odgovor, nikoli tiha degradacija).
- `src/lib/automation/katalog.ts` — zmožnostni katalog (EN VIR UI kartice):
  vsaka AI zmožnost IZRECNO deklarira deterministični `nadomestek` —
  **jedro deluje brez AI** po konstrukciji (test vsiljuje kontrakt).
- UI resnica: vodja pregled → kartica «Avtomatizacija — razred funkcij»
  (iste številke kot katalog — WYSIWYG, brez ročnih vrednosti).

## Sprejemna merila (issue #1 — stanje R294)

- [x] vsako glavno območje audirano (§1–§11 — strazar test vsiljuje)
- [x] vsaka funkcija razvrščena (tabela + katalog; NIČ `AI_ZAHTEVANO`)
- [x] deterministične implementacije povsod, kjer tehnično zadostujejo
- [x] AI neobvezna (AiPonudnik privzeto neregistriran; test «jedro deluje brez AI»)
- [x] skener: 0 nedokumentiranih kršitev nad src/lib (izjeme izrecne z razlogom)
- [x] kritični tokovi pod testi + Vercel build/deploy poteka (kanon rund)
- [x] VIZ scenariji funkcionalni (iskren GPU stub — nič lažnega uspeha)
- [x] zmogljivostne meritve ključnih jeder (zgornje meje obvezne — sekcija zgoraj)
- [x] dokumentacija izrecno pove, kje AI je in kje NI (glavna izjava + kandidati)
