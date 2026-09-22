# FIXES — kaj je bilo spremenjeno v tem repozitoriju

Vse spremembe so v delovnem drevesu; pregledaš jih z `git diff` (spremenjeno) in
`git status` (novo). **Nič ni commitano**, da se lahko odločiš, kaj obdržiš.

Povzetek: **15 → 0 tipskih napak**, **9 od 16 API endpointov, ki so vračali 500 → vsi 200**,
**0 → 78 testov**, **3 pravi izračunski hrošči popravljeni**, aplikacija se zažene.

Analiza in utemeljitev: [`docs/PRIMERJAVA.md`](docs/PRIMERJAVA.md).

---

## 0. Varnost (dodano kasneje — glej [`docs/VARNOST.md`](docs/VARNOST.md))

Pregled produkcijske pripravljenosti je našel, da aplikacija **ni bila varna za javno
namestitev**: 27 od 28 API rut je bilo javnih, `/api/auth` je za poljuben e-mail ustvaril
ADMIN račun (gesla sploh ni preverjal), `/api/sync` je "avtenticiral" s predpono ključa,
ki je bila zapisana v javnem repu, `db/custom.db` je bila v git zgodovini, `Caddyfile`
pa je vseboval odprt proxy (`?XTransformPort=` → SSRF).

Narejeno: prijava s scrypt gesli in HMAC podpisanimi sejnimi žetoni, `src/proxy.ts`
(Next 16 konvencija, ne zastareli `middleware.ts`), `authenticate()` v vseh 24
podatkovnih rutah (57 handlerjev), API ključi s hashem v bazi in preklicem, stran
`/login`, `tools/create-admin.ts`, `tools/create-api-key.ts`, `tools/backup-db.ts`
(`VACUUM INTO` + preverba berljivosti), baza izven gita, produkcijski Caddyfile,
systemd enota, 26 testov kriptografije in **`tools/security-smoke.py` (48 preverjanj
na živem strežniku, 48/48 zelenih)**. Podrobnosti v `docs/VARNOST.md`.

## 1. Blokator: aplikacija se ni zagnala s podatki

| Datoteka | Sprememba | Zakaj |
|---|---|---|
| `.env` | `file:/home/z/my-project/db/custom.db` → `file:../db/custom.db` | Pot je bila **absolutna na sandbox AI graditelja**. Na tvojem računalniku je dala `PrismaClientInitializationError: Error code 14: Unable to open the database file` → 9 od 16 endpointov je vračalo 500 |
| `.env.example` | `file:./db/custom.db` → `file:../db/custom.db` + komentar | Relativne SQLite poti Prisma rešuje glede na **`prisma/schema.prisma`**, ne glede na koren projekta. Tudi primer je bil napačen |
| `.zscripts/build.sh` | `NEXTJS_PROJECT_DIR="/home/z/my-project"` → izpeljano iz lokacije skripte | Isti trdi zapis poti; build script ni deloval nikjer drugje |

**Preverjeno:** `prisma db push` → `SQLite database "custom.db" at "file:../db/custom.db"` ✅
`next dev` → `/api/projects` 200 (16.395 B pravih podatkov), `/api/customers` 200,
`/api/profili` 200, `/api/inventory` 200, `/api/crm` 200, `/` 200 (42.979 B).

> **Naredi še to:** `git rm --cached .env` in dodaj `.env` v `.gitignore`.
> Strojna pot (in morebitni skrivni ključi) ne sodita v git.

## 2. Izračunski hrošči

| Datoteka | Hrošč | Popravek |
|---|---|---|
| `src/lib/calculator.ts` | `calculateMaterialTotal`: `Math.floor(L/S)+1` je podštelo stebre → L=4000, max 1500 je dalo **2000 mm razpone** (33 % čez maksimum) | `spans = ceil(L/S)`, `posts = spans + 1`; novo polje `perSegment[].actualPostSpacingMm` |
| `src/lib/calculator.ts` | `checkCompliance`: pri padcu ≤ 1 m je zahtevala samo **900 mm** višine — pod predpisanim minimumom | `minHeight = dropHeightMm > 20_000 ? 1100 : 1000` |
| `src/lib/glass-model.ts` *(novo)* | `calculateGlassBalustrade`: `σ = 6·w·L²/(8·t²)` je zamenjala vodoravni razpon z višino konzole → za **vsak** vhod vrnila 864–8437 MPa (nad trdnostjo jekla), `isSafe = false` in priporočilo 24/25 mm | Konzolni model `σ = 6·w·h/t²` + `δ = 4·w·h³/(E·t³)`, model visokega nosilca za 2/4 robove, preverba deformacije, faktor folije, `governing`, `modelNote`. Rezultat: 12 mm ESG / 16 mm VSG pri 0,5 kN/m in 1 m — tržni standard |
| `src/lib/calculator.ts` | — | Stari `calculateGlassBalustrade` odstranjen, nadomeščen z **re-izvozom** iz `glass-model.ts`, zato `import { calculateGlassBalustrade } from '@/lib/calculator'` deluje naprej brez sprememb v `calculator-tab.tsx` |

**Nedotaknjeno, ker je bilo pravilno:** `calculateEqualSpacing` (odlična formula in
enakomerna porazdelitev s centri za vrtalno šablono), `calculateAngledSpacing`,
`calculateHoleTemplate`, `calculateWindLoad`, `calculateAnchoring`, `calculateCncCutting`,
`formatSI`, `formatEUR`, `calculateDDV`, `calculateAkontacija`, `applyReserve`.
Ti so zdaj pokriti z regresijskimi testi.

## 3. Tipske napake (15 → 0)

`next.config.ts` ima `typescript: { ignoreBuildErrors: true }`, zato se napake niso nikoli
pokazale ob gradnji. `eslint.config.mjs` ima izklopljena vsa smiselna pravila.

| Datoteka | Napaka | Popravek |
|---|---|---|
| `src/lib/types.ts` *(novo)* | `Project` je bil **lokalno redefiniran v 3 datotekah** z različnimi oblikami → `Type 'Project' is not assignable to type 'Project'`, `customer.telefon` ni obstajal | En kanoničen `Project`, `ProjectCustomer`, `ProjectMonter`, `SignatureAuditEntry` |
| `src/app/page.tsx` | 3 napake (`telefon`, dva tipa `Project`, `string \| null` v `SketchCanvas`) | uvoz iz `@/lib/types`; `SketchCanvas` se izriše samo, ko `selectedProjectId` ni null; `customerPhone: … ?? undefined` |
| `src/components/roksal/post-signature-panel.tsx` | 6× `geoLatitude`/`geoLongitude` ne obstajata | lokalna vmesnika odstranjena, uvoz iz `@/lib/types` (API ju **že** vrača — manjkala sta samo v tipu) |
| `src/components/roksal/pdf-export.tsx` | lokalni `Project` | uvoz iz `@/lib/types` |
| `src/app/api/ai-takeoff/route.ts` | `createVision` brez obveznega `model` | `model: process.env.ZAI_VISION_MODEL \|\| 'glm-4.5v'` |
| `src/app/api/material-orders/route.ts` | pisal `orderId` na `InventoryMovement`, ki ga ni bilo v shemi → vsaka dobava je bila 500 | glej §4 |
| `src/app/api/sync/route.ts` | 2× `const syncedProjects = []` → `never[]` | `Array<Record<string, unknown>>` |
| `tsconfig.json` | `examples/websocket/*` brez nameščenih odvisnosti (`socket.io`) | `examples` dodan v `exclude` |

**Preverjeno:** `npx tsc --noEmit` → **0 napak**.

## 4. Shema baze

| Datoteka | Sprememba |
|---|---|
| `prisma/schema.prisma` | `InventoryMovement.orderId String?` + `@@index([orderId])` |
| `db/custom.db` | posodobljena z `prisma db push` (dodan stolpec; obstoječi podatki nedotaknjeni, 442.368 → 446.464 B) |

`material-orders/route.ts` je `orderId` **že ves čas pisal** — brez polja v shemi je bil
vsak prehod naročila v `DOBLJENO` napaka 500 in zaloga se ni povečala.

## 5. Novo: testi (0 → 78)

| Datoteka | Vsebina |
|---|---|
| `vitest.config.mts` | alias `@` → `./src`, `environment: 'node'`, samo `src/lib` (čista aritmetika, brez jsdoma) |
| `package.json` | `"test": "vitest run"`, `"test:watch": "vitest"`, devDep `vitest ^4.1.11` |
| `src/lib/__tests__/calculator.test.ts` | **36 testov** — regresija za vse tri popravke + lastnostni testi (90 kombinacij dolžin/razmikov) + varovalke za že pravilne funkcije |
| `src/lib/__tests__/railing-layout.test.ts` | **42 testov** za novi modul (§6) |

```bash
npm test
# Test Files  2 passed (2)
#      Tests  78 passed (78)
#   Duration  1.11s
```

Brez testov se noben od treh hroščev ni mogel pokazati: vsi trije vrnejo **veljavno**
številko, ki je samo napačna.

## 6. Novo: `src/lib/railing-layout.ts` (~900 vrstic)

Manjkajoči vezni člen med izmero in naročilom. Zvest prenos preverjenega motorja iz
Android aplikacije BalkonAR (80 testov), `--strict`, brez uvozov iz projekta —
**ničesar obstoječega ne spreminja**.

```ts
import { layoutRailing, defaultRailingSpec, cutList, summarise } from '@/lib/railing-layout'

const spec   = defaultRailingSpec({ system: 'POST_BARS', postSpacingMaxMm: 1100 })
const layout = layoutRailing(perimeter, spec)

layout.posts          // lege, razmiki, oznake S1..S12, vogalni/prosti konci
layout.panels         // širine stekel/mreže/lesa po robovih
layout.handrails      // dolžine + koti žage + notranji koti
cutList(layout)       // "žaga 45,0° desno (notranji kot 90°)"
summarise(layout, spec)
```

Zna: 7 sistemov ograj, **enakomerno** delitev robov (nikoli 40 mm ostanka v vogalu),
kote žage z nedvoumno smerjo, dve dolžini na rob (AR + trak), 8 vrst opozoril,
lokalni koordinatni okvir za ponovno postavitev in slovensko oblikovanje števil,
neodvisno od locale-a naprave.

**Kje bi ga uporabil:** `floor-plan-tab` (iz narisanih zidov → razpored → rezalni seznam),
`bom-draft` / `material-intelligence-tab` (količine iz obsega, ne iz ročnega vnosa),
`measurements-tab` (samodejni razpored po izmerjenih robovih).

## 7. Dokumentacija

| Datoteka | Vsebina |
|---|---|
| `docs/PRIMERJAVA.md` | popolna analiza: zakaj aplikacija ni delovala, 3 hrošči s številkami, kaj ima Roksal in česa BalkonAR nima (in obratno), priporočila po vrsti vrednosti |
| `FIXES.md` | ta datoteka |

---

## Predlagan vrstni red commitov

```bash
git add .env.example .zscripts/build.sh prisma/schema.prisma db/custom.db
git commit -m "fix: DATABASE_URL relativna na prisma/ + InventoryMovement.orderId"

git add src/lib/types.ts src/app/page.tsx src/app/api src/components/roksal \
        src/lib/calculator.ts src/lib/glass-model.ts tsconfig.json
git commit -m "fix: 15 tipskih napak + razmik stebrov, statika stekla, min. višina ograje"

git add vitest.config.mts src/lib/__tests__ package.json
git commit -m "test: 78 testov izračunskega jedra (vitest)"

git add src/lib/railing-layout.ts docs/PRIMERJAVA.md FIXES.md
git commit -m "feat: railing-layout — razpored ograje po izmerjenem obsegu"

git rm --cached .env && echo ".env" >> .gitignore
git commit -m "chore: .env izven gita (vseboval je strojno pot graditelja)"
```

## Še priporočeno (ni narejeno, ker spreminja tvojo arhitekturo)

1. Odstrani `typescript.ignoreBuildErrors: true` iz `next.config.ts` — zdaj je 0 napak.
2. Vklopi vsaj nekaj ESLint pravil, ki so izklopljena (posebej `react-hooks/exhaustive-deps`).
3. Razbij `measurements-tab.tsx` (7.543 vrstic) in `calculator-tab.tsx` (5.791).
   `next build` je bil v okolju z 1 GB RAM ubit zaradi pomanjkanja pomnilnika.
4. Odstrani iz gita: `tool-results/` (2,8 MB dnevnikov AI orodij), `.zscripts/`,
   `dev.log`, `server.log`, `qa-meritve.png` v korenu.
5. Dodaj CI: `tsc --noEmit && npm test && next build`.
