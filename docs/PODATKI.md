# Politika občutljivih podatkov (§38, R155)

> Namen: enoten, preverljiv opis **kateri občutljivi podatki** jih Roksal Railing Manager
> obdeluje, **kje** so shranjeni, **kako** so zaščiteni in **česa namenoma NE hranimo**.
> Vsaka trditev v tem dokumentu je vezana na konkretno kodo (datoteka + mehanizem);
> če se koda spremeni, se ta dokument posodobi v isti rundi (konvencija VARNOST.md).
> Zadnja uskladitev: R155 (commit runda 2026-09-26).

---

## 1. Inventar občutljivih podatkov

| Kategorija | Primeri | Kje nastane | Kje je shranjeno | Zaščita |
|---|---|---|---|---|
| Računi uporabnikov | ime, e-naslov, vloga | registracija (`/api/auth/register`) | tabela `User` | geslo scrypt; branje zaščiteno z vlogami; e-naslov ni javen |
| Gesla | geslo v čistopisu | prijava/registracija | **nikoli** — samo `scrypt$N$r$p$salt$hash` v `User.passwordHash` | scrypt (glej §2), `timingSafeEqual`, min 16 znakov SESSION_SECRET |
| Seje | piškotek `roksal_session` | prijava | piškotek + `Session` v bazi (server-side preklic) | httpOnly, SameSite=Lax (glej §3) |
| Kupec (osebni podatki stranke) | ime, naslov, telefon, e-naslov | projekti/računi | `Customer`, snapshot v `Invoice.kupec` (pravno-aktiven dokument) | dostop na ravni vira (R120/R154/R155 vrata); računi samo z `invoices.read` |
| Meritve, nagibi, skice, fotodokumentacija | dimenzije, koti, fotke objektov | terensko delo | PostgreSQL (+ fotke v object storage) | `assertProjectAccess` — samo člani projekta; deal-lock zavre mutacije |
| Lokacija (GPS) | lat, lng | montažna dokazila | `InstallationEvidence.gpsLat/Lng` **samo z izrecnim soglasjem** | opt-in: brez `gpsConsent` → 400, nič tihega zajema (glej §5) |
| IP naslovi | IP zahtevka | vsaka zahteva | **ne hranimo surovega IP-ja** — samo `sha256(IP + pepper)`, 32 hex (portal); rate-limit vedra samo v pomnilniku procesa (glej §4) | pepper `API_KEY_PEPPER` |
| API ključi | MOBILE_SYNC ključi | kreacija ključa | samo `ApiKey.keyHash` (`@unique`) — čistopis NI shranjen | pepper + scrypt/HMAC izvedba; ključ je viden IZKLJUČNO enkrat ob kreaciji |
| Dnevniki | napake, revizije | runtime | `AuditLog` + logi z correlationId | `lastError` sanitiziran ob zapisu (brez stacka, §22); revizije brez gesel |
| Lokalni osnutki meritev | telo neuspelega POST | R152 osnutki | `localStorage` klienta (`roksal_measurement_drafts_<projectId>`) | ostanejo lokalni; ni skritega pošiljanja; vidna kartica s števcem (glej §7) |

Nič od navedenega ne vsebuje plačilnih kartic — aplikacija ne izvaja plačil in ne
obdeluje kartičnih podatkov (računi so osnutki/izdani dokumenti brez IBAN transakcij).

---

## 2. Gesla (scrypt)

- Izvedba: `src/lib/password.ts` — Node `scrypt`, **N=16384 (2¹⁴), r=8, p=1** (~16 MB,
  50–100 ms) — priporočilo OWASP za scrypt. Namerno brez `bcrypt`/`argon2` odvisnosti.
- Format zapisa: `scrypt$N$r$p$salt$hash` — parametri so del shranjene vrednosti, da jih
  je mogoče kasneje dvigniti brez tihega prevajanja starih zapisov.
- Primerjava poteka s `timingSafeEqual` (ni časovnega uhajanja).
- Seed skripte uporabljajo isti format prek `prisma/password-helper.ts`.
- Geslo v čistopisu obstaja **samo** v zahtevi za prijavo/spremembo gesla; nič ga ne
  zapiše v bazo, dnevnik ali revizijo.

## 3. Seje

- Piškotek `roksal_session`: **httpOnly** (nedosegljiv iz JS), **SameSite=Lax**, `path=/`;
  `Secure` na HTTPS (`sessionCookieAttributes`, `isSecureRequest`).
- Skrivnost: `SESSION_SECRET` (ali `NEXTAUTH_SECRET`), min 16 znakov — manjka/prekratek →
  strežnik zavrže zagon (fail-closed, `src/lib/session.ts`).
- Server-side register (`src/lib/session-registry.ts`): odjava (posamezna seja ali "vse
  naprave") prekliče sejo tudi strežniško — brisanje piškotka ni edina obramba.
- CSFR vrata: `Origin` preverba na mutacijah (anon zahteva brez ustreznega izvora → 403).

## 4. IP naslovi in omejevanje pogostosti

- **Surovega IP-ja ne hranimo v bazi.** Edini obstojni zapis je v portalu:
  `hashIp()` = `sha256(IP:API_KEY_PEPPER)`, obrezano na 32 hex znakov
  (`src/lib/portal.ts` — "§38 duh" že pred tem dokumentom).
- Rate limit (`src/lib/rate-limit.ts`) vodi vedra **samo v pomnilniku procesa** — brez
  perzistence, torej tudi IP ni perzisten. Ključi vedra vsebujejo IP v čistopisu, a živijo
  največ toliko kot okno omejevalnika in izginejo z procesom.
- `x-forwarded-for` se upošteva, ker je v lastni namestitvi za aplikacijo Caddy na istem
  stroju (`deploy/Caddyfile`) — brez tega bi vsi uporabniki delili IP posrednika.

## 5. GPS / lokacija

- Zajem lokacije je **izrecno opt-in**: `POST /api/evidence` brez veljavnega
  `gps.gpsConsent` → 400 z izrecno napako — ni tihega zajema.
- Baza hrani `gpsLat/gpsLng` skupaj z `gpsConsentAt` (čas soglasja) — soglasje je
  dokazljivo, ne samo trditev.
- Fotodokumentacija: EXIF GPS se **ne** prenese po tihih poteh — pri fotodokumentaciji je
  lokacija izrecna klientova izbira, canvas `toDataURL` pa EXIF vseeno re-enkodira stran
  (glej §8 tudi VARNOST.md, sekcija Upload security R149/§37).

## 6. API ključi in pepra

- `ApiKey.keyHash` je `@unique` — strežnik pozna samo izračunani izvod; ključ v čistopisu
  pokaže UI enkrat ob kreaciji, po tem je neobnovljiv.
- `API_KEY_PEPPER` je produkcija obvezen (lokalno/testno znana vrednost sproti opozorjena);
  uporabljata ga izvedba ključev (`src/lib/measure.ts`) in `hashIp` portala.
- Ključi imajo zapisane scope (R126): `projects:read`/`projects:write` + opcijski
  `projectScope` (seznam projektov) — brez scope-a ključ ne dela z uradnimi dokumenti
  (računi, FURS XML).

## 7. Lokalno stanje v brskalniku

| Ključ | Vsebina | Čiščenje |
|---|---|---|
| `roksal_session` | piškotek seje | strežnik ob odjavi + httpOnly |
| `roksal_measurement_drafts_<projectId>` | R152 osnutki meritev (telo neuspelih POST-ov) | ostane dokler jih uporabnik sinhronizira/odstrani; NIKOLI se ne pošljejo po tihih poteh |
| `roksal_open_photo_id` | id odprte fotke (sejski kontekst) | brisan ob odjavi (`top-bar.handleLogout`) |
| `roksal_calibration_*`, `roksal_photo_calibration_*`, `roksal_segments_*` | umeritve naprave + segmenti | napravni kontekst, brez osebnih podatkov |
| `roksal_primary_unit`, `roksal_ar_calc_export`, `roksal_audit_*`, `roksal_featured_gallery_ids` | nastavitve/pomožni zapis | neškodljivi brez seje |

Odjava: SW cache-i z predpono `roksal-` se izbrišejo (`caches.delete`), `sessionStorage`
se počisti popolnoma, sejski `localStorage` ključi se odstranijo. Offline vrsta pred
odjavo EXPLICITNO opozori (neposlani zapisi ostanejo na napravi — uporabnik potrjuje z
dialogom; ni tihe izgube podatkov).

## 8. EXIF in fotografije

- Uploadi iz aplikacije gredo skozi canvas (data URI) → EXIF (vključno z GPS, modelom
  naprave) je odstranjen že pri izvoru.
- Neposredni API uploadi JPEG lahko EXIF ohranijo — strežniško stripanje (sharp) je
  **izrecno odloženo**, dokumentirano v VARNOST.md (R149/§37); ni utišane vrzeli.
- Dostop do fotk = dostop do projekta (`/api/photos`, `/api/ar-snapshots`, … — vrata
  `assertProjectAccess`).

## 9. Dnevniki in revizije

- `AuditLog` (§19): `userId`, `projectId`, `akcija`, `oldValue`/`newValue` (JSON),
  `createdAt` — **brez** gesel, **brez** surovega IP-ja, **brez** skrivnosti.
- Strežniški logi nosijo `correlationId`; `JobRun.lastError` je ob zapisu sanitiziran
  (`correlationErrorSummary` — brez stack tracebackov, §22), zato logi ne hranijo notranjih
  poti ali vsebin spremenljivk.
- Revizije meritev (R153 `MEASUREMENT_STATUS`), ponudb (R151 `inputHash`) in računov
  (R135) so poslovna sled — hranijo se namenoma (revizijski podatki); brisanje meritev po
  zasnovi ne obstaja.
- CRM spremembe (R156 `CRM_UPDATE`): `userId` je vedno seja akterja (nikoli `'system'`),
  `oldValue` vsebuje polno stanje stranke PRED spremembo, `newValue` samo spremenjena
  polja z novimi vrednostmi (`{customerId, spremembe}`). CRM polja so poslovni podatki
  (status, kontakt, kategorija, interne opombe) — sled je namenoma podrobna, saj gre pri
  internih opombah za občutljivo kategorijo, kjer je treba vedeti, kdo je kaj spremenil
  in kakšno je bilo prejšnje stanje. Vrne 403 pred zapisom (SKLADISCE/apikey), zato
  revizija ne nastane za zavrnjene poskuse.

## 10. Dostop na ravni vira (IDOR zaključek — R120 → R155)

Vsaka projektno vezana ruta preverja `assertProjectAccess` (404 neznana, 403 tuja;
SKLADISCE bere vse, mutira nič; apikey po scope R126):

| Ruta | Vrata | Runda |
|---|---|---|
| `/api/sketches`, `/api/sync`, `/api/photos`, `/api/ar-snapshots` | read/update | R120/R126 |
| `/api/measurements` (+ PATCH `[id]`) | read/update | R153 |
| `/api/slopes` | read/update | R154 |
| **`/api/surveys`** | read/update | **R155** |
| **`/api/qc`** | read/update | **R155** |
| **`/api/punch`** (GET/POST/PATCH/DELETE) | read/update | **R155** |
| **`/api/evidence`** (GET/POST/PATCH) | read/update | **R155** |
| **`/api/invoices` GET (`?projectId=`)** | read (MONTER: samo svoji projekti) | **R155** |

Konti, ki niso projektno vezani (auth, kalkulator, vreme, obvestila, ekipe/oprema,
jobs ADMIN-only, portal token), vrata na ravni projekta ne potrebujejo — imajo svoja
(vloge, dovoljenja, token + preklic).

## 11. Kaj namenoma NE hranimo / NE delamo

1. **Geslo v čistopisu** — nikoli, v nobenem dnevniku.
2. **Surovi IP** v bazi — samo pepper-hash (portal) in pomnilniška rate-limit vedra.
3. **GPS brez soglasja** — 400 namesto tihega zajema.
4. **Stack tracebacki** v perzistentnih logih — samo sanitiziran povzetek.
5. **Kartični podatki** — ne obstajajo (ni plačilnega modula).
6. **Izmišljeni/demo podatki** v produkcijskih UI-jih — fail-open vzorci so izkoreninjeni
   (R152–R155): napaka je vidna, prazen pomeni resnično prazno.

## 12. Izrecno odloženo (ne utišano)

| Tema | Stanje | Razlog |
|---|---|---|
| Strežniško stripanje EXIF (sharp) | odloženo | canvas že odstrani EXIF za app uploade; neposredni API uploadi so zaščiteni z vrati + dovoljenim seznamom; dekodiranje velikih JPEG-ov ima strošek |
| AV sken naloženih bajtov | odloženo | magični bajti + dovoljen seznam + stropi preprečijo skriptne nosilce; pravi AV potrebuje zunanji servis |
| Perzisten IP za forenziko | ne načrtujemo | za forenziko so correlationId + AuditLog + strežniški logi ponudnika |
| Retencija/pedjanje dnevnikov | lastniška odločitev | tehnično vse je v `AuditLog`/`JobRun`; politika hrambe je poslovna, ne AI odločitev |
