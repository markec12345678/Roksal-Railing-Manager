# R121 — Document / Storage arhitektura (object storage za bajte, DB = metadata)

> Izvor: lastniška revizija (Problems 5/6) + issue #7. **Brez novih funkcij —
> arhitekturni dolg.** OgrajaVizija (`src/lib/viz/*`) je NEDOTAKNJENA — ima
> svojo, produkcijsko dokazano shrambo (`viz/…` prostor ključev).

## 1. Načelo: EN vir bajtov, DB = metadata

Prej (Problem 5): `ProjectPhoto.imageData`, `ArSnapshot.imageUrl`,
`Sketch.pngData`, `GalleryItem.slikaPred/slikaPo` — base64 DIREKTNO v bazi
(tabela otečena, SELECT vseh slik = prenos megabajtov, backup DB ogromen,
PDF pa sploh ni bil pravi artefakt — `pdfUrl = fileName`, Problem 6).

Zdaj:

```
klient (data URI/base64)
   → ruta (auth + resource authorization + parseDataUri, max 15 MB)
   → object storage  (bajti)          ← EDINI prostor bajtov
   → DB vrstica      (metadata)       ← točka zaveze (transakcija)
      storageKey · mime · sizeBytes · sha256
   → ob napaki DB: kompenzacija deleteObject (0 sirot)
```

Ključi (kanonični prostor `files/…`):

| vir          | ključ                                      |
|--------------|--------------------------------------------|
| fotografije  | `files/photos/<id>/slika.<ext>`            |
| skice        | `files/sketches/<id>/skica.<ext>`          |
| AR posnetki  | `files/ar-snapshots/<id>/posnetek.<ext>`   |
| galerija     | `files/gallery/<id>/pred.<ext>` / `po.<ext>` |
| dokumenti    | `files/documents/<id>/v<n>.pdf`            |

## 2. Adapter (src/lib/object-storage.ts)

Backend-agnostičen — EN vmesnik, DVA driverja:

| mode    | kdaj                          | prostor                          |
|---------|-------------------------------|----------------------------------|
| `local` | dev/test (privzeto brez tokena)| `<STORAGE_LOCAL_ROOT \|\| .storage>/files/…` — NISO pod `public/` (ni statičnega streženja; dostop IZKLJUČNO skozi avtorizirano ruto) |
| `blob`  | produkcija (`BLOB_READ_WRITE_TOKEN`) | Vercel Blob, ključi `files/…`; klienti NIKOLI ne dobijo surovega URL-ja |

Preglas: `OBJECT_STORAGE_DRIVER=local|blob`.

- **SHA-256 ob zapisu** (`crypto`) — vsak artefakt je preverljiv (pravna
  integriteta PDF, restore drill ga preverja).
- **Fail-closed**: pisanje brez driverja NE pade na "samo DB zapis".
- `parseDataUri()` — data URI ALI surovi base64; magični bajti določijo mime
  (klient ni zaupan); max 15 MB; neveljaven vhod → `null` → ruta vrne 400.

## 3. Serviranje: /api/files/[...key]

EDINI dostop klientov do bajtov:

```
GET /api/files/<resource>/<id>/<ime>
```

- avtentikacija obvezna (seja ali API ključ) — anonimno NI dostopa;
- avtorizacija po viru: ključ → zapis v DB → `projectId` →
  `assertProjectAccess('read')` (isti model kot vse business rute, R120);
- `ETag = SHA-256` (integriteta + cache), `X-Content-Type-Options: nosniff`,
  `Cache-Control: private`;
- manjkajoč artefakt = 404 (ne taji, ne ugiba).

## 4. PDF = pravi artefakt (Problem 6)

```
canonical data (projekt, stranka, meritve, navori, račun — vse iz DB)
  → renderer src/lib/document-pdf.ts   (čista funkcija; jsPDF + šumniki)
  → PDF bajti → SHA-256 → object storage (files/documents/<id>/v<n>.pdf)
  → Document (storageKey, sha256) + DocumentVersion (v1, v2 …) + audit
    — VSE v ENI transakciji
```

- **Verzioniranje**: POST `/api/documents` z `documentId` obstoječega
  dokumenta ustvari NOVO verzijo (`v2`, `v3` …); prejšnje ostajajo
  (neizbrisna revizijska sled). Brez `documentId` = nov dokument (v1).
- **Determinizem**: `/CreationDate` izpeljan iz datuma izdaje (del vsebine),
  ne iz trenutka generiranja — enak vhod = bajtno enak PDF = enak SHA-256
  (dokazano z `document-pdf.test.ts`).
- `Document.pdfUrl` je ZASTARELO polje (stare vrstice imajo samo ime brez
  artefakta); nove vrstice pišejo `storageKey`+`sha256`.

## 5. Idempotenten sync (mobileProjectId UNIQUE)

- Pred migracijo preverjeno: **0 duplikatov** v produkciji (E2E-#9 rundа) in
  lokalno — unique constraint dodan varno.
- `Project.mobileProjectId @unique`: replay/vzporedni sync ne more ustvariti
  dvojnika.
- `/api/sync` POST: `findUnique` (ne findFirst); P2002 (kršitev unique) pri
  ustvarjanju = vzporedni zahtevek je že zapisal projekt → obstoječi se
  posodobi (idempotenten rezultat, javljen v `results[].warnings`).

## 6. Migracija obstoječih podatkov

`tools/migrate-base64-to-storage.ts` — idempotentna, deterministična:

```bash
bun tools/migrate-base64-to-storage.ts           # DRY RUN (privzeto)
bun tools/migrate-base64-to-storage.ts --commit  # dejansko
```

- vrstice s `storageKey` preskoči (ponovni zgon = no-op);
- neparsljiv base64 javi in preskoči (ne tiho, ne pokvarjen);
- legacy stolpec NULL-a ŠELE po potrjenem zapisu;
- galerijski URL-ji ostanejo v DB (niso bajti).
- Status na DEV: 4/4 fotografije migrirane (16034 B vsaka, sha256 zapisan).

## 7. Backup / restore DRILL

"Backup, ki ga nikoli ne obnoviš, NI backup." →

```bash
bun tools/restore-drill.ts --target postgresql://…/roksal_restore --create-db
bun tools/restore-drill.ts --target … --drop   # pobriši cilj po drillu
```

1. **DUMP**: vse tabele public sheme → JSONL (kanonični vrstni red po PK;
   datumi/bytea/bigint označeni) — DB je ZDAJ majhna (metadata, brez bajtov).
2. **RESTORE**: cilj MORA biti prazen (fail-closed) → `prisma db push` →
   vnos s `DISABLE TRIGGER ALL` (FK cikel Profile↔Crew, kot pg_dump
   `--disable-triggers`) → `ENABLE TRIGGER ALL`.
3. **VERIFY**: številci vrstic po tabeli = vir; UNIQUE
   `Project.mobileProjectId` obstaja na cilju; SHA-256 lokalnih artefaktov =
   DB metadata.
4. Dokazano lokalno: 34 tabel, 138 vrstic, 4/4 hash ujemanj, exit 0.

**Neon (produkcija)**: naredi branch iz backup točke (Neon console) →
`--target $NEON_BRANCH_URL --create-db` (drill) → preveritve zeleni →
promotion brancha v glavno bazo. Isti orodje, isti zakoni.

## 8. Kaj še NIMA pokritja (iskreno)

- ~~`SignatureAudit.signatureImage` v DB~~ → **REŠENO (R122)**: podpisi živijo
  v object storage (`files/signatures/<id>/podpis.<ext>`, metadata-only DB,
  write-through s kompenzacijo v deal-lock rutи, serving/serving-pravice prek
  `/api/files` + `assertProjectAccess('read')`, hidratacija prek
  `/api/signature-audit?id=…&full=true`; zapuščinski base64 zapisi ostanejo
  branljivi, migracija idempotentna v `tools/migrate-base64-to-storage.ts`).
- `Document.signatureUrl` / `Project.originalImagePath` / `geminiEstimate` —
  zapuščinska polja, brez bajtov v uporabi (URL/ime).
- ~~GC za artefakte pobrisanih projektov~~ → **REŠENO (R122)**:
  `bun run gc:storage` (`tools/storage-gc.ts`) — zbere veljavne ključe iz DB
  (photos/sketches/ar/gallery/documents+versions/signatures), izpiše shrambo
  (`listObjects`, local walk | blob list), SIROTE izbriše z `--commit`
  (samo whitelist `files/<resource>/…`; ključi `viz/…` so nedosegljivi),
  MANJKAJOČE artefakte samo integritetno poroča. DRY RUN privzeto.
- Vercel Blob driver je enak vzorc kot viz (produkcija S+3/S+4 dokazana tudi
  za glavno aplikacijo v R121 produkciskem E2E — foto POST/serving/DELETE).
- Neon backfill nad EXISTING podatki (`migrate-base64-to-storage --commit` z
  Neon URL) je lastniški korak — connection string je namenoma shranjen samo
  v Vercel env (higiena S+8.2; v repozitoriju ni in ne bo).

