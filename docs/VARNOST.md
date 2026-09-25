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
hitrosti — skupaj 135 preverjanj, tečejo v CI ob vsakem pushu.

## Kaj še NI narejeno

| | Zakaj je pomembno |
|---|---|
| **CSRF** | `SameSite=Lax` pokriva večino, ne pa vseh primerov (GET z vrhnje ravni). Za mutacije je `SameSite=Strict` ali dvojni žeton varnejši. |
| **Omejevanje hitrosti na drugih rutah** | Zaščitena je prijava; pisanje po ostalih rutah ima pripravljen `WRITE_LIMIT`, a še ni vklopljen. |
| **Revizijski dnevnik na vseh mutacijah** | Piše se na prijavi, geslu, razporedu in ponudbi; `deal-lock`, `measurements` in `projects` imajo svoje stare klice, ki jih velja poenotiti. |
| **Rotacija `SESSION_SECRET`** | Menjava razveljavi vse seje naenkrat. To je v redu, a mora biti znano. |
| **Šifriranje baze v mirovanju** | SQLite datoteka je v jasni besedi. Na VPS reši šifriran disk (LUKS). |
| **Odvisnosti** | `bun audit` / Dependabot. `npm audit` trenutno javlja ranljivosti v posrednih odvisnostih. |
| **`examples/` in `tool-results/`** | Ostanki AI graditelja; `tool-results/` je zdaj izven gita, `examples/` izven `tsconfig`. |
