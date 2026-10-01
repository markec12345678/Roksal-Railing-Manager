#!/usr/bin/env python3
# R343 — worklog tri-delni append (po KOLIZIJI #15)
V = "/home/z/my-project/worklog.md"
VSEBINA = """

## R343 — 2026-10-01 (cron tick 202610012052 nadaljevanje po KOLIZIJI #15; ⚠️ 15. potrditev LEKCIJE 1: vzporedna lastniška R342 [75fd188, 13:18:58Z — QA-IZVEDBENA runda brez kode: poravnan QA dolg R340/R341 + prod-needle era tehnika + njihov r342.tsv register] pristala MED mojim delom — moja runda preimenovana R342→R343 po kanonu KOLIZIJE #4/R323/#13/#14; njihov R342 = pristala resnica [merge --ff-only]; prekrivanje SAMO v dokumentaciji [README/worklog/r342.tsv ime] — moja koda delta [kalkulator FAZA 4 + val 27] = čisto edinstvena; stash re-kategorizacija LEKCIJA: staged datoteke gredo v stash parent 2, ne parent 3 [git add -A pred stash -u]; dev: kalkulator FAZA 4 [skladišče zgodovine/predlog EN VIR] + MANDATORY STIL val 27 [hover parity prihranjenih predlog])

### Status / ocena (R342 konec [njihov QA] → R343 zagon [moja koda])
- HEAD ob zagonu: `6fd3f6e` (R341) — synced, drevo čisto; fetch-first: 0/0; moja runda razvita lokalno [FAZA 4 + val 27 + r342.tsv register + README/worklog]; ob pripravi pusha `git fetch` razkril KOLIZIJO #15: njihov `75fd188` pristal 13:18:58Z in vzel številko R342
- Odločitev po kanonu: njihov R342 = SUPERSEDIRAJUČI za ŠTEVILO in dokumentacijo; njihova delta = BREZ kode → moja koda delta NIČ prekrivanja; moji artefakti preimenovani R342→R343 [testi ×2 + r343.tsv + worklog skripta]; NJIHOV r342.tsv OSTANE nedotaknjen [moj register → r343.tsv]; stash LEKCIJA R343 4: `git add -A` pred `stash -u` pomeni da 'untracked' grejo v parent 2 [index], ne parent 3 — rekonstrukcija iz stash@{0}^2
- **PRVA NALOGA (izvedena PRED kolizijo, njihov QA dolg soPoravnan)**: `qa-round.sh 341 prod-qa` [fallback r339-prod-qa z GLASNIM bannerjem]: tek 1 abort [NEEDLEJI FAIL — deploy-swap chunk race med ŽIVIM swapom; kanon R330 7], tek 2 **LIVE veja EXIT=0 — MILESTONE**: prod build 12:52:26.150Z > R339 meja 11:24:40 [in > R341 commit 12:52:00Z — zeleni deploy nosi R340+R341 SKUPAJ]; LEKCIJA R337 6 izpolnjena [interpretacija ŠELE po 2. teku]; Z2 vsi needleji R276→R339 ŽIVO + Z3 v99 gate ŽIVO + footer === R339 PROD QA — R290+…+R339 ŽIVO SKUPAJ ===; njihov R342 message neodvisno potrjuje isti mejnik
- **DEPLOY MILESTONE**: R340+R341 ŽIVO na produ; R342 [njihov] + R343 [moj] čakata na naslednji zeleni deploy

### Cilji / izvedene spremembe / verifikacija
- **FAZA 4 dekompozicija — NOV `calculator/history.ts`** (skladišče zgodovine/predlog EN VIR; tab 4796 → 4771 vrstic [−25]):
  (1) **EN VIR ključi** SKLADISCE_PREDLOGE / SKLADISCE_ZGODOVINA — prej 7× podvojeni literali [templates ×4, history ×3] → 0 surovih ostankov v tabu;
  (2) **fail-closed nalagalnik** naloziIzSkladisca<T>(kljuc, privzeto) — ENA funkcija namesto 2 kopij useState inicializatorjev [typeof window guard + try/catch JSON.parse VERBATIM; pokvaren JSON = privzeto, nikoli metanje — R339 vzorec; node = privzeto];
  (3) **varni zapisovalnik/brisač** shraniVSkladisce / odstraniIzSkladisca — ENA namesto 5 kopij try/catch plesa;
  (4) **EN VIR limiti** MAX_ZGODOVINA = 30 / MAX_PREDLOG = 50 — prej magic števila slice ×2 + JSDoc + UI besedilo (max 30) → (max {MAX_ZGODOVINA}) [render identičen];
  (5) **čista podatkovna resnica 65. člena**: ZGODOVINA_CSV_GLAVE (7 stolpcev) + zgodovinaCsvVrstice(history) (7 celic VERBATIM vključno s slDatumKratko/slCasDolgo datumsko celico) — mehanika toCsv/downloadCsvText ostaja v tabu; slCasDolgo uvoz iz taba odstranjen [edina uporaba zdaj v history.ts]
  - **ISKREN SAMO-ULOV**: prva verzija zgodovinaCsvVrstice je imela PRAZNO datumsko celico [nonsense placeholder] — ujeta ob lastni reviziji PRED testi, popravljena na VERBATIM datum; hard rule 'no silent degradation' velja tudi za nove module
- **MANDATORY STIL val 27 — hover parity prihranjenih predlog** (vzorec R280/R281/R339/R341): load gumb predloge title={tpl.naziv — templateModeLabels[tpl.mode]} [hover parity]; način badge title="Predloga shranjenega izračuna — nalaganje zapolni vsa vnosna polja načina" [edini nov minifikacijo-preživeči niz = needle r343.tsv]; izbriši gumb title="Izbriši predlogo" [parity z aria-label]; **iskrena razlika od val 25/26: badge je znotraj kliknega gumba → cursor-help bi zavedel** [klik še vedno naloži] — brez njega; **0 novih hex**
- **vitest r343 ×19** (2 NOVI datoteki): r343-calc-faza4 ×10 [ključi EN VIR + limiti EN VIR [slice + UI] + fail-closed nalagalnik node/simulacija [pokvaren JSON → privzeto; zapis/bris z localStorage stubom] + glave ×7 + determinizem FULL + citiranje prehaja na toCsv kanon + žičenje 2 load/3 save/2 remove + FAZA 3 regresija] · r343-stil-val27 ×9 [3 title parity + cursor-help ×1 točno [iskrena razlika] + 0-hex okno + obrnjene regresije val 26 [oba title ŽIVO]/val 25/val 24 [ring ×12]/press-scale + history.ts 0-hex]
- **r341 test evolucija** (moj lastni test, dokumentirano): r341-zgodovina-csv 3 asercije spremljajo resnico FAZA 4 [glave/vrstice EN VIR v history.ts; tab ne podvaja] — 8/8 ŽIVO
- **`scripts/qa-needles/r343.tsv`** (kanon R340/R341/R342): need_static ×1 [val 27 badge title] + must_miss TODO-R343; iskrena omejitev: FAZA 4 = premik bajtno identičnih blokov → NI edinstvenega needleja za premik [pokritost = tsc + vitest ×19 + E2E regresija]
- **VERIFIKACIJA NA ZDRUŽENEM STANJU (6fd3f6e + 75fd188 + moja delta)**: tsc **0** · eslint **0** [1 stale disable-directive samo-ulovljen in odstranjen] · vitest **4870/4870 (294; 4851/292 + mojih +19/+2)** — NIČ stale pinov · build svež EXIT=0 · `qa-round.sh 342 needles` **VSE OK** [njihov register] · `qa-round.sh 341 needles` **VSE OK** [val 26 needle regresija] · `qa-round.sh 342 smoke` ✓ (**R342 SMOKE KONEC**) · `qa-round.sh 342 e2e` **EXIT=0** [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA dokazana] · README ×4 (4870/294 ×3 + R343 bullet)
- LEKCIJE R343: (1) **KOLIZIJA #15 = 15. potrditev LEKCIJE 1** — fetch pred pushom ujel kolizijo [njihov 75fd188 13:18:58Z]; brez nje → ADD/ADD na r342.tsv + dvojna R342; (2) **stash parent 2 vs 3**: staged datoteke [git add -A pred stash -u] gredo v parent 2 — rekonstrukcija po pravem parentu, ls-tree ^3 je varno prazen; (3) samo-revizija ujela silent degradation [prazna datumska celica] PRED testi — VERBATIM pomeni VERBATIM tudi v novih modulih; (4) cursor-help = SAMO ne-interactive badge izven gumba [iskrena razlika val 27 od val 25/26 dokumentirana v testu]; (5) komentar-žetoni štejejo v contains-asercijah — JSDoc in UI besedilo sta ločeni resnici
- Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ; OgrajaVizija nič; **brez sheme** (ZERO-MUTACIJA E2E); 0 novih hex (val 27 = title atributi); NIČ FNV soli

### Nereseno / tveganja + prioritete R344
- ✅ **Deploy LIVE**: R340+R341 na produ [build 12:52:26.150Z]; R342 [njihov QA-only] + R343 [moja koda] čakata na naslednji zeleni deploy — R344 prva naloga = `qa-round.sh 343 prod-qa` POST-commit re-run [pričakuj LIVE ob zelenem deployu; LEKCIJA R337 6]
- ⚠️ **KOLIZIJSKA VROČINA ostaja**: 15 kolizij; fetch-first PRED dev + pred commitom/pushom
- ⏰ **roksal-fallback-db POTEČE 2026-10-25** (~3.5 tedna) — obvestiti lastnika (47. zapis)
- R344 kandidati: **kalkulator FAZA 5** [10 calculate*ClientSide dispatcherjev → calculator/calculations.ts z args objekti — R325 pdf-exports vzorec; velika, previdno] ALI **measurements FAZA 5** [preveri kolizije najprej] ALI **e2e-lib dedup** [veliko, previdno] — vedno z fetch-first + TSV kanonom
- ISSUE #1: 65 členov izpolnjenih (Deliverables 7/7 ✓); issue ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA]
"""
with open(V, "a", encoding="utf-8") as f:
    f.write(VSEBINA)
print("worklog R343 appended; lines:", sum(1 for _ in open(V, encoding='utf-8')))
