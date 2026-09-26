# Varnost

Stanje od 2026-09-22. Prejšnje stanje je bilo: **27 od 28 API rut javnih**, `/api/auth` je za
poljuben e-mail ustvaril ADMIN račun, `/api/sync` je "avtenticiral" s predpono ključa, ki je
bila zapisana v javnem repozitoriju, `db/custom.db` je bila v git zgodovini, `Caddyfile` pa je
vseboval odprt proxy.

## Model

```
                      ┌──────────────────────────────────────────┐
   brskalnik ────────▶│ proxy.ts  (Edge, samo Web Crypto)         │
                      │  · preveri podpis + potek sejne ga        │
                      │  · anonimni /api/* → 401                  │
                      │  · anonimni /* → 307 /login?next=…        │
                      └────────────────┬─────────────────────────┘
                                       │
                      ┌────────────────▼─────────────────────────┐
   BalkonAR ────────▶│ API ruta (Node)                           │
   Authorization:     │  · authenticate(request) — DRUGA plast    │
   Bearer rkm_…       │  · seja ali API ključ, nikoli oboje       │
                      │  · vloge: MANAGER_ROLES / ADMIN_ROLES     │
                      └────────────────┬─────────────────────────┘
                                       │
                                 Prisma / SQLite
```

**Zakaj dve plasti:** proxy je hiter in blokira anonimni promet, preden se ruta izvede,
a se ga da obiti (direktni klic handlerja, napačna konfiguracija, `matcher`, ki česa ne
pokrije). Zato vsaka ruta **sama** pokliče `authenticate(request)`. Prva različica proxy-ja
je blokirala ravno prijavo — 32/46 preverjanj je bilo zelenih, aplikacija pa neuporabna.
Obe plasti sta potrebni, nobena ni zadostna.

## Seje

| | |
|---|---|
| Žeton | `base64url(JSON) . base64url(HMAC-SHA256)` |
| Podpis | HMAC-SHA256 s `SESSION_SECRET` (Web Crypto → deluje v Edge in Node) |
| Vsebina | `sub`, `email`, `ime`, `vloga`, `exp` |
| Veljavnost | 12 ur (`SESSION_TTL_SECONDS`) |
| Piškotek | `roksal_session`, `HttpOnly`, `SameSite=Lax`, `Secure` na HTTPS, `Path=/` |
| Shramba | brezstanjska — ni tabele sej, zato ni čiščenja; potek je v žetonu |
| Prenos | piškotek (brskalnik) ali `Authorization: Bearer <žeton>` (skripte) |

**Fail closed:** `sessionSecret()` vrže, če `SESSION_SECRET`/`NEXTAUTH_SECRET` manjka ali je
krajši od 16 znakov. `verifySession` v tem primeru vrne `null` — aplikacija zavrne vse,
namesto da bi podpisovala s praznim nizom.

Zakaj brez next-auth: `next-auth@4.24` deklarira peer obseg `next ^12||^13||^14`, projekt teče
na Next 16. Namestitev bi bila na opozorilih, obnašanje nepreverjeno. Lastna seja je ~150
vrstic, brez odvisnosti, in je enotsko testirana.

## Gesla

| | |
|---|---|
| Hash | **scrypt**, `N=16384, r=8, p=1`, 64-bajtni ključ (OWASP priporočilo) |
| Sol | 16 naključnih bajtov na geslo |
| Format | `scrypt$N$r$p$salt$hash` — parametri so shranjeni, da jih lahko kdaj dvignemo |
| Primerjava | `timingSafeEqual` (konstantni čas) |
| Normalizacija | `NFKC` — enako vidno geslo z različnimi kodnimi točkami se preveri |
| Ustvarjanje računov | **samo** preko `tools/create-admin.ts` na strežniku, nikoli preko API-ja |

Napačno geslo in neobstoječ e-mail vrneta **enako** sporočilo in porabita enak čas
(`verifyPassword(password, null)` se izvede tudi za neznan e-mail), da napadalec ne more
ugotoviti, kateri naslovi so registrirani.

## API ključi (mobilni klient)

| | |
|---|---|
| Oblika | `rkm_<32 naključnih bajtov, base64url>` |
| Shramba | `ApiKey.keyHash` = HMAC-SHA256 s `API_KEY_PEPPER`; viden **samo ob ustvarjanju** |
| Prepoznavo | `keyPrefix` (prvih 12 znakov) za seznam, brez razkritja ključa |
| Preklic | `revokedAt` — posamezen ključ, brez menjave ostalih |
| Sledenje | `lastUsedAt` (neblokirajoče) |
| Obseg | **samo `/api/sync`** — ključ ne sme brati CRM, cen ali zalog |

Ustvarjanje in upravljanje:

```bash
bunx tsx tools/create-api-key.ts "Marko - telefon"
bunx tsx tools/create-api-key.ts --list
bunx tsx tools/create-api-key.ts --revoke <id>
```

## Javne poti (namerno)

| Pot | Zakaj |
|---|---|
| `/login` | brez tega se nihče ne more prijaviti |
| `/api` | health check za uptime monitor (vrne `{message}`) |
| `/api/auth` | POST = prijava (ruta sama preveri geslo), GET = 401 brez seje |
| `/api/auth/logout` | odjava mora delovati tudi s poteklo sejo |
| `/portal/[token]`, `/api/portal/[token]` | sposobnostni URL (`clientToken`, cuid) — stranka nima računa |
| `/sw.js`, `/manifest.json`, ikone | PWA ne deluje brez njih |

## Podatki

- `db/custom.db` **ni v gitu**. Ustvari se z `bunx prisma db push && bunx tsx prisma/seed.ts`.
  V zgodovini repozitorija je že bila (14 commitov) — z demo podatki, zato ni škode, a če bi
  kdaj vanjo pisal prave stranke, bi ostale v javni zgodovini za vedno.
- `.env` **ni v gitu** (`.gitignore` ga je že imel, a je bil commitan prej).
- Kopije: `tools/backup-db.ts` uporablja `VACUUM INTO` (konsistentna kopija med delovanjem)
  in **preveri, da je kopijo mogoče odpreti**. `cp` ni varen. Kopije morajo iti izven strežnika.

## Preverjanje

```bash
# enotsko (kriptografija): 104 testov
bun run test

# end-to-end na živem strežniku: 48 preverjanj
BASE_URL=http://localhost:3000 EMAIL=… PASSWORD=… API_KEY=rkm_… \
  python3 tools/security-smoke.py
```

Oboje teče v CI (`.github/workflows/ci.yml`, job `security` zažene pravi strežnik).

`security-smoke.py` preveri: anonimni dostop do 24 rut → 401, preusmeritev na `/login`,
napačno geslo → 401, **neobstoječ e-mail ne ustvari ADMIN profila**, pravilno geslo → 200 +
`HttpOnly`/`SameSite`/`Max-Age` piškotek, dostop s sejo → 200, spremenjen podpis → 401,
popolnoma ponarejen žeton → 401, naključen žeton → 401, **stara oblika ključa
`ROKSAL_MOBILE_…` → 401**, pravi ključ → 200, ključ ne sme brati CRM → 401, portal s
tokenom ostane dostopen.

## Dodano kasneje (2026-09-22)

Tri vrzeli s seznama spodaj so zdaj zapolnjene:

| | Kaj je narejeno |
|---|---|
| **Omejevanje hitrosti** | `src/lib/rate-limit.ts` — drseče okno, 10 poskusov prijave na 15 min po (IP + e-naslov), 429 z `Retry-After`. Uspešna prijava žetona ne porabi (`releaseRate`), zato pravilen uporabnik ne more biti zaklenjen. Tudi `/api/auth/password` je omejen. |
| **Vloge** | `denyUnless(request, roles)` v `src/lib/auth.ts`; 12 handlerjev v 7 rutah zahteva `ADMIN`/`VODJA` za pisanje. `MONTER`/`SKLADISCE` bereta, pisati ne smeta (403). API ključ ne more v poslovne rute. |
| **Revizijski dnevnik** | `src/lib/audit.ts` — enoten zapis, nikoli ne vrže in ne blokira zahtevka. `LOGIN`, `LOGIN_FAILED`, `PASSWORD_CHANGED`, `RAILING_LAYOUT`, `QUOTE_CALCULATED`. Branje prek `GET /api/audit?projectId=…` (VODJA/ADMIN ali dodeljeni monter). |

Preverjeno v `tools/security-smoke.py`, razdelka [9] Vloge in [10] Omejevanje
hitrosti — skupaj 141 preverjanj, tečejo v CI ob vsakem pushu.

## Upload security (R149 — issue #5 §37)

Vsi uploadi (fotodokumentacija, galerija, skice, AR posnetki, podpisi pri
zaklepu posla) gredo skozi `validateUploadContent`
(`src/lib/upload-security.ts`) — čisto, deterministično jedro:

| | Pravilo |
|---|---|
| **MIME + magični bajti** | Deklarirana vrsta se PREVERI proti magičnim bajtom; neskladje → 400 z izrecnim razlogom (`prijavljeno X, dejansko Y`). Klient NI zaupan — prej je bila specifična deklaracija sprejeta brez preverjanja (vrzel). |
| **Zaprto dovoljen seznam** | Samo PNG, JPEG, WebP, PDF. SVG in HTML sta izrecno prepovedana (nosilca skript); GIF/ZIP/… zavrnjeni. |
| **Image bomb zaščita** | Dimenzije se preberejo IZ GLAVE (PNG IHDR, JPEG SOF, WebP VP8/VP8L/VP8X) brez dekodiranja; strop 12000 px na stran oz. 40 MP. |
| **Max size** | Ostaja v `parseDataUri` (fotografije/AR/skice/galerija ≤ 15 MB, podpisi ≤ 2 MB). |
| **Imena + ključi** | Naključni UUID object keys (`objectKey`), končnica izverjena iz vrste; path traversal preverja `assertSafeObjectKey`. |
| **Private-by-default** | Bajti se servirajo IZKLJUČNO prek avtenticiranih rut (data URI hydrate ali `/api/files`), nikoli javno. |
| **Fail-closed red** | Najprej avtentikacija (401), nato scope, nato validacija vsebine (400) — vrsta napake ne pušča podatkov o vsebini nepooblaščenim. |

Zakaj brez tihega prevzemanja: če deklaracija ne ustreza bajtom, je klient
pokvarjen ALI zlonamernen — v obeh primerih je pravi odgovor odklonitev z
razlogom, ne tiho »popravljanje«. Brskalnikov canvas `toDataURL` vedno
pošlje pravo deklaracijo, zato legitimni tokovi ne pridejo v stik z vrati.

## Inženirska ovojnica kalkulatorja (R150 — issue #5 §32–34)

Kalkulator (razmiki, kemično sidranje, vetrna obremenitev) teče skozi
`src/lib/calc-engineering.ts` — čisto, deterministično jedro:

| | Pravilo |
|---|---|
| **Fail-closed območje umerjenosti** | Vnos izven dokumentiranih mej (npr. ograja 0,1–100 m, veter 0,5–200 m) → eksplicitna napaka, NIČ se ne izračuna. Prej: višina 0 m je tiho dala `heightFactor = 0` → tlak 0 → LOW tveganje (nevaren tihi rezultat); Infinity je preživel do rezultata (`slatCount: Infinity`). |
| **Verzionirane formule** | `CALC_FORMULA_VERSIONS` (rail-v1 / anch-v1 / wind-v1) — sprememba matematike = nova verzija; stare prstne odtisi ostanejo interpretirani s svojo verzijo. Verzija je vezana v hash. |
| **Deterministični prstni odtis** | Kanonični vhod (urejeni ključi, normalizirana števila) + FNV-1a 32-bit; isti vhod + ista verzija = isti odtis (reproducibilnost/audit). Ne-končne vrednosti so vidno označene v odtisu (nNaN), nikoli tiho. |
| **Obrambna plast za klienta** | Zod (v4) že zavrne NaN/Infinity na API-ju; ovojnica dodaja meje umerjenosti in je ista plast v brskalniku, kjer `parseFloat('1e999')` → Infinity (klient NE gre skozi Zod). |
| **API** | POST /api/calculator → 400 z izrecnimi napakami (nič tihega nonsensa), 200 nosi `formulaVersion` + `inputHash`; GET = register formul z mejami (anon → 401). |

## Kaj še NI narejeno

| | Zakaj je pomembno |
|---|---|
| **EXIF stripping na strežniku (§37)** | Uploadi iz canvas data URI so brez EXIF (canvas re-enkodira), neposredni API uploadi JPEG pa EXIF lahko ohranijo. Strežniško stripanje zahteva dekodiranje (sharp) — izrecno odloženo, ne utišano; GPS polja so pri fotodokumentaciji izrecna klientova izbira (opt-in), ne EXIF prenos. |
| **Malware scanning (§37)** | Policy: magični bajti + dovoljen seznam + stropi preprečijo skriptne nosilce (SVG/HTML) in dekompresijske bombe; pravi AV sken bajtov ni implementiran (zahteva zunanji servis) — dokumentirano kot odloženo. |
| **CSRF** | `SameSite=Lax` pokriva večino, ne pa vseh primerov (GET z vrhnje ravni). Za mutacije je `SameSite=Strict` ali dvojni žeton varnejši. |
| **Omejevanje hitrosti na drugih rutah** | Zaščitena je prijava; pisanje po ostalih rutah ima pripravljen `WRITE_LIMIT`, a še ni vklopljen. |
| **Revizijski dnevnik na vseh mutacijah** | Piše se na prijavi, geslu, razporedu in ponudbi; `deal-lock`, `measurements` in `projects` imajo svoje stare klice, ki jih velja poenotiti. |
| **Rotacija `SESSION_SECRET`** | Menjava razveljavi vse seje naenkrat. To je v redu, a mora biti znano. |
| **Šifriranje baze v mirovanju** | SQLite datoteka je v jasni besedi. Na VPS reši šifriran disk (LUKS). |
| **Odvisnosti** | `bun audit` / Dependabot. `npm audit` trenutno javlja ranljivosti v posrednih odvisnostih. |
| **`examples/` in `tool-results/`** | Ostanki AI graditelja; `tool-results/` je zdaj izven gita, `examples/` izven `tsconfig`. |

## Reproducibilnost ponudb (R151 — issue #5 §35)

Dokumenti imajo sha256 + verzije že od R121; ponudbe so odslej povezane
enako — `src/lib/quote-repro.ts` (čisto jedro, brez spremembe
cenik/geometry jedra):

| | Pravilo |
|---|---|
| **Odtis nad UČINKOVITIMI vhodi** | POST /api/quote vrne `reproducibility { quoteVersion, inputHash }` — izračunan nad ZDRUŽENO specifikacijo in ZDRUŽENIM cenikom (tisto, kar je dejansko dalo total), ne nad surovo zahtevo. Neznani preglasitveni ključi cenika ne spremenijo odtisa (učinkoviti vhod je isti — pravilno). |
| **Verzija vezana v odtis** | `quote-v1` — sprememba matematike ponudbe = nova verzija; stare odtisi ostanejo interpretirani s svojo verzijo. |
| **Vrstni red točk je del odtisa** | Ključi objektov so urejeni, vrstni red polja točk OHRANJEN — ista množica točk v drugem vrstnem redu je drugačna ograja in dobi drug odtis. |
| **Revizija** | QUOTE_CALCULATED revizija nosi `inputHash` — vsak izračun je vezan na svoje vhode (audit). |

## Iskreni podatki (R152 — fail-open vzorci odstranjeni)

Celo komponentno fronto je prečiščen vzorec "napaka → izmišljeni podatki":
api napaka ali prazen seznam NI več nadomeščen z demo/fiktivnimi vrsticami.

| | Pravilo |
|---|---|
| **Nič demo podatkov** | `demoProjects` / `demoMeasurements` / `demoInventory` / `demoWindData` IZBRISANI. Napaka API-ja = prazen seznam + vidna napaka (role="alert" panel z "Poskusi znova" + toast.error). Prazno stanje ostane PRAZNO. |
| **Varnost brez ugibanja (Varnost tab)** | Vremenski API neuspešen → EKSPliciten panel "Varnostna ocena ni mogoča" z retry gumbom. PREJ: fiktivni veter 7.2 m/s z `isSafeForInstallation: true` (varnostno kritična fail-open kršitev!). |
| **Iskreni lokalni osnutki (Meritve)** | Neuspel POST meritve → ekspliciten OSNUTEK (localStorage per projekt, `src/lib/measurement-drafts.ts`), viden v ločenem rubinastem razdelku "Lokalni osnutki — ni v bazi" z sinhronizacijo in odstranjevanjem. PREJ: izmišljena vrstica `local_${Date.now()}` + fake-success "(lokalno)" toast — podatki izgubljeni ob reloadu. |
| **Ni lažnega brisanja** | API /api/measurements nima DELETE/PATCH → UI ne laže več, da je brisanje/arhiviranje/status uspel (prej: lokalna sprememba, po reloadu vrnjeno). Zdaj iskren toast z razlago. |
| **NEVIDNI toasti (P1)** | sonner `<Toaster>` NI bil nikoli montiran — vsi `toast.*()` klici iz 10+ komponent (R127–R151 vključno) so bili za uporabnika NEVIDNI. Zdaj montiran z `richColors` (semantične barve) + `closeButton`; radix Toaster ostane za `useToast()` klicatelje. |
| **Regresijski stražarji** | Testa v `r152-measurement-drafts.test.ts`: (1) nobena roksal komponenta ne sme vsebovati `const demo[A-Z]` polja; (2) noben `id: \`local_${Date.now()}\`` vzorec. Kršitev = rdeči test. |
