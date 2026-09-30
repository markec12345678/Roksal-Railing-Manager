# Končna verifikacija proti HEAD (issue #1 — Deliverable 7)

> R315 — 45. člen issue #1. Ta dokument je **dokumentirani Deliverable 7**:
> končna verifikacija celotne avtomatizacijske prenove proti trenutnemu HEAD.
> ISTA resnica kot zaslon (vodja — blok »Končna verifikacija«), testi
> (`src/lib/__tests__/r315-koncna-verifikacija.test.ts`) in lib
> (`src/lib/koncna-verifikacija.ts`) — EN VIR, NIČ dvojnega sklepa.

## 1. Kaj ta verifikacija je (in kaj NI)

Verifikacija se izvede **nad delovnim drevesom PRED vsakim commitom** v okviru
obvezne verige runde:

1. `tsc --noEmit` — 0 napak;
2. `eslint` — 0 opozoril;
3. `vitest run` — polna testna zbirka (števec per runda v worklogu; nikoli
   trdo kodiran tukaj — številke zastarajo, poti ne);
4. `next build` — svež produkcijski build + `r*-build-needles.sh` (FAIL=0,
   delegirana generacijska veriga);
5. `r*-run-smoke.sh` — health / prijava / PWA / CSRF vrata;
6. `r*-e2e-browser.sh` — E2E ŽIVO na produkciji, odtis bajtno identičen
   pre==post (ZERO-MUTACIJA);
7. `r*-prod-qa.sh` — UNION harvest na produkciji (EPOCH build-guard, Z2b
   žični probei, must_miss ZERO).

**Veza na HEAD je implicitna in reproduktibilna:** delovno drevo je
byte-določeno s HEAD (isti drevesni hash = isti dokaz). Dokument zavestno
NE nosi commit hash-a, datuma ali števca testov — te vrednosti per runda
zapisuje worklog; tukaj so KONKRETNE POTI, ki ostanejo resnične.

Ta verifikacija **NI**: merjenje hitrosti AI modelov (meritve: R312/R313,
`zmogljivost-pregled`), trditev o deploju v prihodnosti (EPOCH guard je
iskren — ob zastoju piše ESKALACIJA, ne laži), ali obhod fail-closed pravil.

## 2. Dokazne plasti po območjih (§1–§11)

EN VIR: `src/lib/koncna-verifikacija.ts` (`DOKAZI_AUDITA`) — join z
`AVTOMATIZACIJA_AUDIT` je fail-closed totalen (manjkajoča vezava = TypeError).

| Območje | Klasifikacija | Plasti | Opomba dokaza |
|---|---|---|---|
| §1 Photo/VIZ | DETERMINISTIČNO | vitest · build-needleji · E2E ŽIVO · prod-qa | cv-studio/viz jedro + odtis ZERO-MUTACIJA |
| §2 Measurements | DETERMINISTIČNO | vitest · E2E ŽIVO · prod-qa | geometrijska jedra + verzije ruta ŽIVO (Z1b) |
| §3 Railing/product configuration | DETERMINISTIČNO | vitest · build-needleji | SDK jedro ključavica (AI nič) + komponentni skener |
| §4 Calculator / quotation | DETERMINISTIČNO | vitest · build-needleji · E2E ŽIVO · prod-qa | istovhodna reproducibilnost + I/O meja ŽIVO (Z0ai) |
| §5 Inventory / suppliers / orders | DETERMINISTIČNO | vitest · build-needleji · E2E ŽIVO | zalogoslovna jedra + izvozi + E2E ŽIVO material/naročila |
| §6 Documents | DETERMINISTIČNO | vitest · E2E ŽIVO | %PDF- magija + FNV podpisi + E2E izvozi bajtno |
| §7 Installation / scheduling | DETERMINISTIČNO | vitest · build-needleji | urAgregat/konflikti jedra + koledar izvozi |
| §8 Customer portal | DETERMINISTIČNO | vitest · build-needleji · E2E ŽIVO | token vrata + dovoljenja + portal E2E |
| §9 Security | DETERMINISTIČNO | vitest · E2E ŽIVO · prod-qa · smoke | deny-first 403 ŽIVO (Z2b) + v99 gate + kontrakt NIČ + CSRF dimni probei |
| §10 Mobile/PWA/offline | DETERMINISTIČNO | vitest · build-needleji · E2E ŽIVO · smoke | sync vrata + kvota (smoke manifest 307) + E2E pwa-status |
| §11 AI fallback architecture | AI-OPCIJSKO | vitest · build-needleji · prod-qa | DeterministicniPonudnik VEDNO, AiPonudnik IZKLJUČEN fail-closed |

## 3. Sprejemni kriteriji (issue #1 — 8 točk)

EN VIR: `SPREJEMNI_KRITERIJI` v `src/lib/koncna-verifikacija.ts` — vsak
kriterij z mehanično izpeljavo in konkretnim dokazom (zaslon jih izriše
verbatim; testi jih zaklenjejo):

1. **vsako večje področje Roksala je audirano** — izpeljava: audit pokriva
   §1–§11 (števec izračunan); dokaz: `src/lib/avtomatizacija-audit.ts`.
2. **deterministične/SDK/skriptne implementacije povsod, kjer so tehnično
   ustrezne** — izpeljava: razredna porazdelitev audita (skener 0 kršitev);
   dokaz: `src/lib/avtomatizacija-pregled.ts` + skener.
3. **AI je neobvezen — jedro deluje brez AI** — izpeljava: `AI_ZAHTEVANO`
   števec === 0 (izračunan, nič trdo); dokaz:
   `src/lib/automation/katalog.ts` (AiPonudnik privzeto IZKLJUČEN fail-closed).
4. **vsi kritični tokovi gredo skozi teste** — izpeljava: polna vitest
   veriga + needleji per runda; dokaz: `src/lib/__tests__/` +
   `scripts/r*-build-needles.sh`.
5. **Vercel build/deploy uspešen** — izpeljava: EPOCH build-guard per runda
   (build > commit meja); dokaz: `scripts/r*-prod-qa.sh` (ob zastoju
   ESKALACIJA — iskrenost, ne laž).
6. **obstoječi VIZ scenariji ostanejo funkcionalni** — izpeljava: E2E ŽIVO
   VIZ + odtis pre==post; dokaz: `scripts/r*-e2e-browser.sh`.
7. **nič regresij** (prijava, projekti, meritve, kalkulator, dokumenti,
   zaloga, portal, razporejanje, PWA/offline, VIZ) — izpeljava: polne E2E
   regresije + delegirana needle veriga; dokaz: `scripts/r*-e2e-browser.sh`.
8. **dokumentacija jasno ločuje, kjer se AI dejansko uporablja in kjer ne** —
   izpeljava: docs + zaslon + testi berejo ISTI niz; dokaz: `docs/automacija-audit.md` + ta dokument +
   `src/lib/ai-raba-pregled.ts`.

## 4. Kaj je odprto (iskrenost)

- **CSRF vezava** (issue §9): kandidat, IZRECNO čaka na lastniški blagoslov
  (worklog kanon — ZADNJI člen, samo z odobritvijo).
- **`roksal-fallback-db` poteče 2026-10-25** — lastniško obvestilo (ponavljajoča
  se eskalacija; fall-closed PostgreSQL-only pravilo ostane).
- **AI kandidati** (§5 v ai-raba-pregled): 3 NE-IMPLEMENTIRANI kandidati —
  nič povezano, nikoli lažna implementacija; evalvacija po lastniški rabi.

## 5. Protokol obvsake runde (da dokument ne zgniji)

Per runda: chain iz §1 se požene v celoti; worklog nosi števce in EXIT kode;
če katera plast pade → runda NE konča z commitom (fail-closed), razen iskrene
ESKALACIJE (deploy pipeline event — kanon R258), ki se izrecno zapiše.
