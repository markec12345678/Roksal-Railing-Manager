# Navodila — v 5 minutah do delujoče aplikacije

Za podrobnosti: [`README.md`](README.md) (arhitektura, API), [`docs/VARNOST.md`](docs/VARNOST.md)
(prijava, ključi, kaj še manjka), [`deploy/README.md`](deploy/README.md) (produkcija),
[`FIXES.md`](FIXES.md) (kaj je bilo popravljenega in zakaj).

## Namestitev (svež klon)

```bash
git clone https://github.com/markec12345678/Roksal-Railing-Manager.git
cd Roksal-Railing-Manager
bash tools/setup.sh
```

Skripta naredi vse: odvisnosti → `.env` z naključnimi skrivnostmi → shema baze →
demo podatki → **tvoj administratorski račun** (vpraša za e-pošto in geslo) →
API ključ za mobilni klient → preverjanje tipov in testov.

Potem:

```bash
bun run dev          # ali: npm run dev
```

→ http://localhost:3000 (preusmeri na `/login`)

## Vsakodnevna opravila

| Kaj | Ukaz |
|---|---|
| Zaženi razvojno različico | `bun run dev` |
| Preveri vse (tipi + 565 testov) | `bun run check` |
| Samo testi | `bun run test` |
| Merilni SDK benchmark | `bun run bench:measurement` (12 terenskih scenarijev) |
| Varnostni test na živem strežniku | `bun run smoke` (glej spodaj za spremenljivke) |
| Produkcijska gradnja | `bun run build && bun run start` |
| Nov uporabnik / novo geslo | `bun run admin ti@roksal.si` |
| Nov API ključ za telefon | `bun run apikey "Marko - telefon"` |
| Prekliči API ključ | `bunx tsx tools/create-api-key.ts --list` → `--revoke <id>` |
| Kopija baze | `bun run backup` |

### Varnostni test

```bash
BASE_URL=http://localhost:3000 \
EMAIL=ti@roksal.si PASSWORD='TvojeGeslo' \
MONTER_EMAIL=monter@roksal.si MONTER_PASSWORD='…' \
API_KEY=rkm_… \
  python3 tools/security-smoke.py
```

Pričakovano: **vsa preverjanja zelena** (52 definiranih, del pogojnih), exit code 0. V CI teče samodejno ob vsakem pushu.

## Kako je aplikacija zavarovana

- **Prijava je obvezna.** Brez veljavne seje dobiš 401 na vsaki API ruti in
  preusmeritev na `/login` v vmesniku. Javne so samo prijava, health check in
  portal stranke (ta uporablja svoj sposobnostni žeton).
- **Vloge.** `ADMIN` in `VODJA` spreminjata cene, zaloge, naročila, dobavitelje,
  ekipe in razporede. `MONTER` in `SKLADISCE` bereta, ne pišeta (403).
- **Omejevanje hitrosti prijave.** 10 napačnih poskusov na 15 minut na
  (IP + e-naslov), nato 429 z `Retry-After`. Uspešna prijava žetona ne porabi.
- **Revizijska sled.** Prijave, neuspešne prijave, spremembe projektov, zaklepanje
  ponudbe in izračuni se pišejo v `AuditLog` (berljivo prek `GET /api/audit?projectId=…`).

## Mobilni klient (BalkonAR)

BalkonAR je Android aplikacija za terensko AR izmero. V Roksal pošilja prek:

```
POST /api/sync          → projekt (mobileProjectId = "balkonar-<id>", se posodobi, ne podvoji)
POST /api/measurements  → vsak rob posebej, z arMetadata (izvor mere, naklon, razpored, rezalni seznam)
```

Nastavitev v BalkonAR: *Nastavitve → Roksal Railing Manager* → naslov strežnika +
API ključ (`rkm_…`, ustvariš ga z `bun run apikey`).

## Nova API ruta: izračun ograje

Od zdaj naprej je razpored ograje na voljo tudi kot API — ni treba računati v
vmesniku:

```bash
curl -X POST http://localhost:3000/api/railing-layout \
  -H "Authorization: Bearer $SEJA" -H 'Content-Type: application/json' \
  -d '{
    "points": [{"xM":0,"zM":0},{"xM":4,"zM":0},{"xM":4,"zM":-1.5},{"xM":0,"zM":-1.5}],
    "closed": true,
    "spec": { "system": "GLASS_CHANNEL", "heightMm": 1000 }
  }'
```

Vrne: `layout` (robovi, stebri, paneli, letev s koti žage, profili, opozorila),
`cutList`, `summary` in uporabljeno `spec`.

```bash
curl -X POST http://localhost:3000/api/quote …   # + prices → postavke, DDV, skupaj, €/m
```

Količine pridejo iz istega izračuna kot risba — zato se ponudba in tloris ne
moreta razhajati. Podrobnosti o modelu: [`src/lib/railing-layout.ts`](src/lib/railing-layout.ts)
in [`src/lib/quote.ts`](src/lib/quote.ts), oba s testi.

## Če kaj ne dela

| Simptom | Rešitev |
|---|---|
| Vse rute vračajo 500, v dnevniku `DATABASE_URL ni razrešen na postgres:// URL` | `DATABASE_URL` v `.env` mora biti `postgresql://…` — SQLite ni podprt (S+8.2, fail closed). Lokalno: `bun run db:up` (embedded PG :5433) |
| Preusmeri na `/login`, a prijava javi napako | `SESSION_SECRET` manjka ali je prekratek (min 16 znakov). Aplikacija je **fail closed** — brez skrivnosti ne podpisuje sej |
| `Please tell me who you are` | `git config user.name … && git config user.email …` |
| Prijava je zaklenjena (429) | Počakaj 15 minut ali ponovno zaženi strežnik (števec je v pomnilniku) |
| `bun install --frozen-lockfile` pade | `bun.lock` ni posodobljen: `bun install` (brez `--frozen-lockfile`), nato commitaj `bun.lock` |
| Gradnja porabi preveč pomnilnika | `NODE_OPTIONS=--max-old-space-size=4096 bun run build`. Dolgoročno: razbij `measurements-tab.tsx` (7.818 vrstic) in `calculator-tab.tsx` (6.010) |
| Po `git pull` ne dela | `bun install && bunx prisma generate && bun run db:deploy` |
