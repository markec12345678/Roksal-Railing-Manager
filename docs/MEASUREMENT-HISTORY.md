# R276 — Zgodovina verzij meritev (issue #16 §6, register #17-E)

**Status:** SEMANTIČNE ODLOČITVE ZAPISANE PRED RAZVOJEM (kanon R273/R274/R275 —
odločitev vedno pred kodo; sprememba odločitve = nov zapis, ne prepisovanje).

**Vez:** issue #16 §6 „Measurement history" — *„Meritve se ne smejo tiho
prepisovati. Primer: v1 = 3,20 m, v2 = 3,45 m, v3 = 3,42 m. Zgodovina mora
omogočiti ugotoviti aktivno verzijo, kdo/naprava jo je ustvarila, kdaj, vir,
kaj se je spremenilo in kateri odvisni rezultati so bili ponovno izračunani."*
Issue #17 register E — „meritev-history ❌" (edini v-repu neprokazani del poleg
B terenskega in J lastniškega).

## Izhodišče (dokazano stanje pred R276)

- Nobena ruta NE spreminja `dolzinaMm`/`visinaMm` obstoječe meritve
  (`grep measurement.update` = samo PATCH statusa v `[id]/route.ts`) — R153
  kanon: *„merilni podatki so revizijski; popravki gredo skozi vodjo
  (nov vnos)"*. TIHEGA PREPISOVANJA DANES NI.
- A vrzeli ostanejo: vrstice v1/v2/v3 so NEPOVEZANE (ni verige), ni pojma
  „aktivna verzija", ni delt („kaj se je spremenilo"), ni vira po kontraktu.

## Odločitve

### O1 — Zgodovina = veriga vrstic, NE ločena tabelа kopij

Korekcija = **NOVA vrstica** (obstoječe rute ne spreminjajo dimenzij — to se
NE spremeni). Zgodovina JE množica vrstic (R153: revizijski podatki). Ločena
history tabela bi KOPIRALA to, kar vrstice že so = izmišljena redundanca.
Vzorec ni DocumentVersion (R121) — tam verzije nosijo ločene PDF artefakte v
object storage; tu je vsaka verzija polnopravna meritev, ki napaja BOM.

### O2 — Nova polja (aditivno; prvi schema-touch od R154)

- `verzija Int?` — zaporedna številka znotraj verige (1, 2, 3 …).
  `null` = vrstica nastala pred verzioniranjem (**iskrena praznina** —
  nikoli retroaktivno izmišljena verzija; brez backfill, brez izmišljene
  zgodovine).
- `predhodnikId String? @unique` — povezava na prejšnjo verzijo.
  **UNIQUE = enojna veriga brez razvejanja** (vsaka verzija ima največ enega
  naslednika; fork = P2002 → 409, tudi ob vzporednem race — DB nivo,
  ne samo aplikacija).
- `korenId String?` — id prve vrstice verige (koren = `null`, ker je sam
  koren). Omogoča O(1) fetch verige: `OR[{id: korenId}, {korenId: korenId}]`.
- `vir String?` — `MANUAL | PHOTO_CV | ARCORE_DEPTH` (issue #16 §2 enum,
  ENA resnica s kontraktom). Strežniško IZPELJAN (klient ga ne more podati —
  ne ponareljiv): AR kontrakt payload → `source` iz kanonične oblike; brez
  arMetadata → `MANUAL` (edine poti brez arMetadata so ročni vnosi UI);
  legacy ne-kontraktni arMetadata → `null` (iskrena praznina — stari format
  NI vir resnice, nikoli ugibanje).
- Indeksa: `@@index([korenId, verzija])` (fetch verige) +
  `@@index([projectId, verzija])` (pregled verzij projekta).
- FK `predhodnikId` → `Measurement.id`, `onDelete: SetNull` (kaskada projekta
  briše celotno verigo skupaj; SetNull je le varovalo — veriga znotraj
  projekta ni nikoli razporejena čez projekte, O4).

### O3 — Številčenje verzij (deterministično)

- Samostojna nova meritev (brez `predhodnikId`) → `verzija = 1`,
  `korenId = null` (sama je koren).
- Naslednik → `verzija = (predhodnik.verzija ?? 1) + 1`;
  `korenId = predhodnik.korenId ?? predhodnik.id`.
  Legacy predhodnik (verzija `null`) FUNKCIONIRA kot implicitna v1 (zgodnja
  meritev JE prva v verigi), a se PRIKAZUJE brez oznake (O2) — korekcija
  dobi v2. To je resnica: original je obstajal, oznake pa še ni bilo.

### O4 — Pravila verige (fail-closed)

- `predhodnikId` mora kazati na **obstoječo** meritev → sicer 404.
- Predhodnik mora biti **isti projekt** → sicer 400 (veriga ne prečka
  projektov — dostop/avtorizacija je projekt-nivo).
- Predhodnik **ARHIVIRANA** → 409 (arhiva se ne popravlja postrani — najprej
  ponovno odpiranje prek PATCH statusa z opombo, R153 vrata ostanejo edina).
- Predhodnik že ima naslednika (UNIQUE kršitev, tudi race) → 409.
- DELETE meritve ostaja ZAVRTO (R153); verig se ne briše; predhodnikova
  statusa se NE dotikamo (status prehodi so izključno uporabniške akcije
  skozi PATCH — brez tihih stranskih prehodov).

### O5 — Aktivna verzija

`aktivna = vrstica z najvišjo verzijo v verigi, ČE njen status ≠ ARHIVIRANA;
sicer NI aktivne verzije (iskrena praznina)`. Nikoli padec nazaj na nižjo
verzijo — to bi bilo tiho „prepisanje nazaj" na starejšo meritev. Status
ostane avtoriteten za vidnost (R153); verzija je sloj NAD vrsticami.

### O6 — „Kaj se je spremenilo" = deterministična delta

Ob ustvarjanju verzije se izračuna `deltaDolzinaMm = nova − stara` in
`deltaVisinaMm = nova − stara` ter zapiše v AuditLog:

- nova akcija **`MEASUREMENT_VERSION`**;
- `oldValue = {id, verzija, dolzinaMm, visinaMm}` predhodnika;
- `newValue = {id, verzija, dolzinaMm, visinaMm, deltaDolzinaMm,
  deltaVisinaMm, vir, predhodnikId, odvisniRezultati}`.

Delta je zgolj razlika celih števil — nič zaokroževanja, nič ugibanja.

### O7 — „Kateri odvisni rezultati so bili ponovno izračunani" = IZREČNO iskren zapis

Audit nosi **`odvisniRezultati: 'NI PONOVNO IZRAČUNANO — dokumenti/BOM
ustvarjeni pred to verzijo ostajajo na predhodni meri; ponovni izračun je
zgoda lastnika'`**. NIKOLI lažni `recalculated: true` (BOM/pricing/geometry
core se NE spreminja — projektno pravilo; dokler lastnik ne sproži ponovnega
izračuna, je iskren odgovor „niso"). To je WYSIWYG v reviziji.

### O8 — API oblika

- `POST /api/measurements`: opcijski `predhodnikId` (zod, min 1 znak).
  Odgovor 201 vsebuje nova polja (`verzija`, `korenId`, `vir`,
  `predhodnikId`). Idempotenca (R128) NESPREMENJENA — replay vrne original.
- **NOVO** `GET /api/measurements/[id]/verzije`: vrne celotno verigo
  (`{korenId, aktivnaId, steviloVerzij, verzije[]}`), vrstice kronološko po
  verziji (null verzija — legacy koren — prva), z deltami med sosedi.
  Dostop = isti vrata kot branje meritev projekta (assertProjectAccess
  `read`); 401/403/404 fail-closed. Brez paginacije (verige je po O4 enojna
  in kratka; neomejeno findMany tveganje R140 se tu ne pojavlja).

### O9 — Legacy in migracija

Migracija je ČISTO aditivna (4 stolpca + indeksa + FK); **brez backfill** —
null polja so resnica „nastalo pred verzioniranjem". Stare rute/testi
obnašanje NESPREMENJENO (regresija r148/r153/r274 zeleno). Sync meritev NE
obstaja (§F STOP, R274) — verzije zato ne morejo razhajati čez naprave;
prihodnji sync verzij je izrecna prihodnja odločitev.

## Kaj R276 ZAVESNO NE dela

- Ne spreminja BOM / pricing / geometry / Product SDK core.
- Ne uvaja sync protokola za meritve.
- Ne backfill-a verzij na stare vrstice.
- Ne briše ne arhivira predhodnikov avtomatsko.

## Dokaz vrednosti (testno načrtovanje)

Primera iz issue-ja sta NEPOSREDNO testirana: 3200 → 3450 → 3420 mm =
verigi v1 → v2 (+250) → v3 (−30), aktivna v3; plus fail-closed meje (404 /
400 / 409 fork sekvenčno in vzporedno / 409 arhiv / 403 SKLADISCE /
401 anon / ZERO-MUTACIJA neuspešnega fork-a) in vir izpeljava
(kontrakt ARCORE_DEPTH / brez arMetadata MANUAL / legacy null).
