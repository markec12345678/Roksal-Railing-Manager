#!/usr/bin/env python3
# r375-readme-update.py — R375 README disk resnica: števec 5294/340 →
# 5299/341 + R375 bullet kot CELOTO PRED val 44 sidrom (R361 bullet —
# kanon r361+). Fail-closed: stare žige obvezni PRED, novi ŽIGI obvezni PO.
import pathlib, sys

R = pathlib.Path("/home/z/my-project/README.md")
src = R.read_text(encoding="utf-8")

STAR_STEVEC = "| Testi (vitest) | **5294** (340 datotek, vključno z globalSetup embedded PG) |"
NOV_STEVEC = "| Testi (vitest) | **5299** (341 datotek, vključno z globalSetup embedded PG) |"
SIDRO = "- **Ring pariteta val 44 + e2e-lib dedup 1. val** (R361): (1) **prva naloga**"

if src.count(STAR_STEVEC) != 1:
    sys.exit("FAILOVEDANO: star števec ≠ ×1")
if src.count(SIDRO) != 1:
    sys.exit("FAILOVEDANO: R361 sidro bullet ≠ ×1")

BULLET = """- **Ring↔border pariteta val 57 (NON-ring kandidat: navy/40 obrobljeni gumbi measurements) + FEATURE era-clone.py — KOLIZIJA #17 + stale-klon okolje** (R375): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 373`: **ZELEN ob poskusu 1**
  (13. runda zapored) + **SEDEMINDVJSETIJNA era preverba** NOV kanonski skript
  `r374-era-harvest.sh` [27 registrov r347–r373, ≥113 need_static = 109 + 4,
  vsota iz diska; REG_AA izpeljan]: **EXIT=0 ob 1. teku** — vseh 27 er ŽIVO NA
  PRODU; ⭐ **val 56 vsi 4 needleji ŽIVO DIREKTNO** (chunk_045 ×3 + chunk_028 ×1)
  → val 56 deploy potrjen v celoti; must_miss ×27 čisto; era kontrole
  R340/R341/R343/R345 ŽIV. **val 56 POST-deploy verifikacija** (`r375-qa-spot.sh`
  spot-r167/19 + `r375-spot-reprobe.sh` 19b; mounted + className LOČENO,
  dispatch+poll VSAKA, kolektor 0 errorjev v OBEH runah): vse 4 val 56 površine
  podatkovno-gated v demo seji → **iskreno NEmontirane z razlogom iz diska**
  (kanon r277): photo N1 'Izbriši sliko' vrata galerija projekta [loadPhotos
  early-return], N2 'Zapri slikanje' vrata cameraOpen ['Slikaj' disabled=1
  dokumentira vrata], N3 'Zapri urejevalnik anotacij' vrata annotationPhoto,
  dashboard N4 'Pokliči stranko' vrata projekt vrstica ['Ni projektov' disk
  resnica]; sidra ŽIVO ('Slikaj' VEDNO + CSV izvoz + 'Ni projektov'); navy
  sonda dashboard 5 = 4 offset-2 + 1 kit override izjema #1. (2) **MANDATORY
  STIL val 57 — ring↔border OBLIKOVNA pariteta**: disk resnica NON-ring
  triaža [INPUT ×10 ocena = disk 4 accent checkbowerji — border na native
  checkboxu ne nosi fokus barve → iskreno izpuščeno; transition-colors =
  1 gap (dashboard L1628) → prihodnji val; border-pariteta obrobljenih = 44
  čez komponente → največja kohorentna družina measurements navy/40 = 22
  tarč]: **22 × INS ' focus-visible:border-roksal-navy/40
  dark:focus-visible:border-roksal-ink/40' TIK ZA offset** (kanon calculator
  L4396/L4439 precedens ring → offset → border; triaža outline 18 pred / 4
  brez → 0 preurejanj; +76 znakov/vrstico ×22 = +1672, in-place 0 novih
  vrstic; amber/red bordered ×2 lastni družini; navy brez border širine ×25
  mrtev CSS izpuščeno; ui KIT border-ring ×11 zamrznjen); census PRED gap 22
  → PO gap 0; apply prek `r375-val57-apply.py` (fail-closed per vrstica,
  idempotenca 'border ŽE prisoten'). (3) **FEATURE — era-clone.py**: 5. korak
  generalizacije era verige [r370–r373 hardcodirani kloni → PARAMETRIZIRAN
  kloner: --src-round/--expected-total/--dst-round + KOLIZIJA override
  --dst-label/--dst-chain-seg; era besede iz števca (ERA_BESODE do 40.
  preverbe, fail-closed izven mape); vsota need_static IZ DISKA — podatkovne
  vrstice, komentarji ne štejejo; labeli izpeljani iz zadnjega
  preberi_register; PRED rep + PO natančna števca; 2 uporabi V ISTI rundi →
  r374-era-harvest.sh + r375-era-harvest.sh **OSEMINDVJSETIJNA** — 28
  registrov r347–r374, ≥117 = 113 + 4, EXIT=0 (r374 issue #13 needleji ŽIVO
  prek svežega builda hash rezolucije — njihov deploy potrjen)] +
  `r375-window-scan.py` [klon r373, TARGETS = measurements-tab; 25 okenskih
  regexov, delta +76 = 0 preozkih]. **KOLIZIJA #17 + STALE-KLON OKOLJE**:
  vzporedna lastniška poslovna R374 [8db6a1c — issue #13
  QuoteVersion/PriceBook/deal-lock] pristala MED mojim delom in vzela
  številko → moja runda R374→R375 po kanonu KOLIZIJE #4/R323/#13–#16;
  `git reset --hard origin/main`, delta re-aplicirana s preimenovanjem
  artefaktov [r375.tsv + r375-*.py + r375-stil-val57.test.ts]; njihov
  worklog vnos NI obstajal → adopcijski vnos R374 dopisan [LEKCIJA R369 (1)];
  NADALJE: lokalno okolje je bilo SWAPNIRANO na star klon [R344-era, git
  log kazal R343/R344, backup branch izginil, nekomitirana delta izgubljena]
  → popolna rekonstrukcija iz konteksta + origin/main [fetch-first kanon
  rešil: origin/main NI bil poškodovan 8db6a1c] — LEKCIJA R344 stale-klon
  zdaj tudi za AI seje: PRED delom `git fetch` + `git log --oneline -1
  origin/main` + primerjava z disk resnico. VERIFIKACIJA (celotna,
  FOREGROUND, na KONČNI viri): tsc 0 [po prisma generate — stale client
  TS2339 priceBookVersion po njihovi shemi] · eslint 0 (FULL) · vitest
  **5299/5299 (341)** = R374 poslovna baza 5294/340 + mojih +5/+1 − 0
  [suite tek 1: 1 fail = red/40 števec 5→3 disk resnica — popravljen; FULL
  tek 1: 2 faila = r166 DARK obrobni stražar (INS brez dark: — dodan
  dark:focus-visible:border-roksal-ink/40 V ISTI rundi) + r348 oknoOkoli
  SLICE okno 600 preozko (528→604; PIN SHIFT R375 okno 600→700 headroom 96
  — LEKCIJA R375: slice okna niso regex, window-scan jih ne vidi, FULL
  vitest je mreža); FULL vitest TEK zeleno] · build svež EXIT=0 ·
  `qa-round.sh 375 needles` VSE OK 0 MISS [93 × FAIL=0; 4 need_static ŽIVO
  + TODO-R375 odsoten; veriga R227→…→R339 + union registri r340–r375] ·
  smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post
  r276+r281+r283+r287 — ZERO-MUTACIJA tudi čez njihovo poslovno rundu] ·
  r374-era-harvest.sh + r375-era-harvest.sh EXIT=0 ·
  r359-prod-qa-retry.sh 373 ZELEN ob poskusu 1 · r375-qa-spot.sh + re-proba
  ZELENA [kolektor 0 errorjev] · leak-check čist. NOVO:
  `scripts/qa-needles/r375.tsv` [4 need_static ×1, vsi ×0 v HEAD 8db6a1c
  fetch-first GLASNO prek `r375-register-write.py` (NF=3); izpuščeni
  kandidati dokumentirani: bratje L3763/L3786 + L5154/L5167 +
  L5182/L5194/L5211/L5234 — pokriti prek vitest (A); must_miss TODO-R375] +
  NOVE skripte [era-clone.py [GENERALIZIRANO], r374-era-harvest.sh,
  r375-era-harvest.sh, r375-val57-apply.py, r375-window-scan.py,
  r375-qa-spot.sh, r375-spot-reprobe.sh, r375-register-write.py,
  r375-readme-update.py, r375-worklog-append.py] + LEKCIJE R375: (1) **r166
  DARK obrobni stražar ujel val 57 INS brez dark:** — border-roksal-navy/
  izgine v temni temi [kanon R163–R166] → dark:focus-visible:border-roksal-ink/40
  obvezen [calculator L4439]; PREVERBA dark stražarjev PRED applyom;
  (2) **oknoOkoli SLICE okna niso regex** — window-scan enumerira SAMO
  {0,N} regex literale; slice okna rabi poseben preskan (ali FULL vitest)
  — r348 pin shift 600→700 z žigom; (3) **era-clone generalizacija ujela
  svoj hrošča V ISTI teku** — POST preverba vsake transformacije z
  natančnim števcem obvezna [out.splitlines() vs content.splitlines()];
  (4) **handover ocena ≠ disk resnica** — 'INPUT ×10' = disk 4
  checkbowerji; census PRED obsegom; grep -c šteje komentarje — disk
  resnica r374 = 4 podatkovne vrstice; (5) **KOLIZIJA #17 + stale-klon
  okolje dvakratna rekonstrukcija** — adopcijski kanon (R369 (1)) tudi za
  vzporedne lastniške runde; era-clone --dst-label override razširjen ob
  drugi uporabi; PRED delom vedno `git fetch` + preverba origin/main proti
  disk resnici [LEKCIJA R344 azurirana za AI seje]. Kontrakt NIČ
  (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ
  [val 57 = render plast a11y className-only v 1 render datoteki];
  OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli. ⏰
  roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika
  (78. zapis). R376 prva naloga = qa-round.sh 375 prod-qa re-run [prek
  `r359-prod-qa-retry.sh 375`] + **DEVETINDVJSETIJNA era preverba
  r347–r375** [29 registrov, ≥121 need_static = 117 + 4; prek
  `era-clone.py --src-round 375 --expected-total 121`] + val 57
  POST-deploy verifikacija [4 needleji r375.tsv — vse measurements-tab;
  vrata: merilne površine z izbranim projektom (demo seja 'Ni projektov'
  → pričakuj iskreno NEmontirano z razlogom, kanon r277; mounted +
  className LOČENO; dispatch+poll VSAKA)]. R376 kandidati: 1.
  transition-colors skladnost [disk resnica 1 gap: dashboard L1628
  'Počisti iskanje projektov'] ALI amber/red bordered border-pariteta
  [lastni družini ×2] ALI window-scan generalizacija [slice okno preskan
  — LEKCIJA R375 (2)]; 2. e2e-lib dedup 15. val [po kanonu le ob novih ×3
  ponovitvah]. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner
  'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
"""

out = src.replace(STAR_STEVEC, NOV_STEVEC, 1)
out = out.replace(SIDRO, BULLET + SIDRO, 1)

# POST žigi
for pat, n in [
    (NOV_STEVEC, 1),
    ("**5294** (340", 0),
    ("- **Ring↔border pariteta val 57", 1),
    ("--expected-total 121", 1),  # R376 naloga
    ("OSEMINDVJSETIJNA", 1),  # bullet: era žig
    ("KOLIZIJA #17 + stale-klon okolje", 1),
    ("R376 prva naloga", 1),
]:
    c = out.count(pat)
    if c != n:
        sys.exit(f"FAILOVEDANO: PO '{pat[:50]}' = {c} ≠ {n}")
if "era-clone.py" not in out:
    sys.exit("FAILOVEDANO: PO 'era-clone.py' odsoten")

R.write_text(out, encoding="utf-8")
print(f"OK: README posodobljen ({len(out)} bajtov; števec + R375 bullet pred R361 sidrom)")
