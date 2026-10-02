#!/usr/bin/env python3
# r370-readme-update.py — R370 README disk resnica (kanon LEKCIJA R366 (3)):
# (1) števec 5234/333 → 5239/334; (2) R370 bullet vstavljen kot CELOTO s
# python PRED naslednjim bulletom (val 44 bullet @ vrsta 1460 — disk
# resnica: novi bulleti grejo NAD val 44 v tem odseku, ker je val 44
# zgodovinsko appendan na konec odseka). Fail-closed: vsaka zamenjava
# točno 1 pojavitev, sicer abort.
import pathlib, sys

p = pathlib.Path("README.md")
src = p.read_text(encoding="utf-8")

STAR = "| Testi (vitest) | **5234** (333 datotek, vključno z globalSetup embedded PG) |"
NOV = "| Testi (vitest) | **5239** (334 datotek, vključno z globalSetup embedded PG) |"
if src.count(STAR) != 1:
    sys.exit(f"FAILOVEDANO: števec = {src.count(STAR)} pojavitev (pričakovano 1)")
src = src.replace(STAR, NOV)

SIDRO = "- **Ring pariteta val 44 + e2e-lib dedup 1. val** (R361): (1) **prva naloga**"
if src.count(SIDRO) != 1:
    sys.exit(f"FAILOVEDANO: sidro = {src.count(SIDRO)} pojavitev (pričakovano 1)")

BULLET = """- **Ring pariteta val 53 (navy offset-1 rep) + QA-infra window-scan orodje** (R370): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 369`: **ZELEN ob poskusu 1
  FOREGROUND** + **TRIINDVJSETIJNA era preverba** NOV kanonski skript
  `r370-era-harvest.sh` [klon r369 prek python; 23 registrov r347–r369, ≥97
  need_static = 93 + 4, vsota potrjena iz diska prek python]: **EXIT=0 ob 1.
  teku** — vseh TRIINDVJSET er ŽIVO NA PRODU; ⭐ **R369 val 52 vsi 4 needleji
  ŽIVO prek hash rezolucije** (3abf34ececedd8ff.js + dc5a9c95ae97123a.js HTTP
  200 + niz prisoten) → val 52 deploy potrjen v celoti; 2 R353 needleja še
  naprej prek hash rezolucije; must_miss ×23 čisto; era kontrole
  R340/R341/R343/R345 ŽIV; (2) **val 52 POST-deploy verifikacija** (spot-r167/15
  `r370-qa-spot.sh` + `r370-spot-reprobe.sh`; mounted + className LOČENO —
  LEKCIJA R365 (4); prijava OK ob poskusu 2 — transient, iskreno): bottom-nav
  **9/9/9/0** (navy40/ink40/offset2/brezOffseta — VEDNO montirane pariške
  vrstice; **znani 'tab bar 9 ostanki' kandidat iz R368 handoverja REŠEN z val
  52**), Sheet kartice navy/40 **51/51** + 'Označi vse' 1/1, FAB sprožilec ŽIVO
  (item vrata: meni odprt), termini pari **4/4/0**, **D2 dokaz**: edini
  navy/40-BrezOffset gumb na dashboardu = 'Izvozi CSV' L1678 = shadcn Button +
  brand barvni override = **val 52 namerna izjema #1** (kit ring-[3px] fokus
  jezik) — NI val 54 gap po doktrini izjem; **kolektor 0 errorjev**; sonde:
  eb_sonda_navy_stetje 3. uporaba + eb_sonda_red_stetje 2. uporaba (iskrena
  praznina ob vzorčenju); (3) **MANDATORY STIL val 53** — ring OBLIKOVNA
  pariteta navy/40 OFFSET-1 REP, normalizacija 1→2 (per-barvni split kanon:
  navy = val 43–49 + val 52 pari, red = val 50, amber = val 51, navy O1 rep =
  val 53; precedens val 47/49/51): census iz diska (`r369-census.py` RE-POGNAN
  — navy/40 PRED {'O2': 184, 'O1': 8, 'NONE': 54, '?INTERP': 3} gap 65 → PO
  {'O2': 192, 'O1': 0, 'NONE': 54, '?INTERP': 3} gap 57 — **O1 razcep = 0**):
  **8 vrstic × 4 datoteke** (calculator L4382, dashboard L2666, invoice
  L1045/L1061/L1182, vodja L1274/L1290/L1306); substitucija **DOLŽINSKO
  NEVTRALNA** (27→27 znakov) = 0 okenskih premikov; NONE ×54 + ?INTERP ×3
  ISKRENO izven (val 54+ triaža; D2 dokaz zgoraj); in-place 0 novih vrstic; 0
  novih hex (16/0/6/1 = HEAD); aria/title ZAMRZNJENI; **stale-pini: 6 SHIFTOV
  V ISTI RUNDI** z žigi [PIN SHIFT R370 val 53] — r236 test L276 + r236-build
  L47/L48/L49 (**L48 Izdaj/Plačan + L49 Prejem ŽE ZASTARELA PRED R370** —
  najdba: legacy needleja IZVEN trenutne needles verige [TSV registri r340+
  edini vir needles faze]; osvežena na disk resnico) + r237-build L43 +
  r237-prod-core L64 (legacy proaktivno — kanon R368 r244-prod-qa); r366 (C)
  bere r242 TEST — preživi, r364 (A) MERITVE-only — preživi; (4) **FEATURE
  QA-infra hardening 3. val** — NOV orodje `scripts/r370-window-scan.py`
  (**LEKCIJA R369 (2) FORMALIZIRANA**: stale-pin PRED-skan enumerira VSE
  okenske kvantifikatorje {0,N}/{M,N} nad tarčnimi datotekami + delta-mode
  simulacija) — **65 okenskih regexov enumeriranih** (per-tarčna enumeracija),
  0 preozkih, PRED + PO apply (1. uporaba V ISTI rundi — kanon ne sme biti
  papir); **e2e-lib dedup 10. val ISKRENO IZPUŠČEN** — python skan
  `r370-dedup-scan.py` nad r365–r369 spot skriptami: 13 eval blokov, 13
  unikatnih (whitespace-normalizirano), 0 ponovitev ≥2 → NI kandidata (kanon
  R368). VERIFIKACIJA (na KONČNI viri): tsc 0 · eslint 0 (FULL) · vitest
  **5239/5239 (334)** = R369 baza 5234/333 + mojih +5/+1 − 0 [tek 1: 3 faila =
  (a) žig 'LEKCIJA' vs 'LEKCIJE' niz, (b) re-enumeracija dedupirana namesto
  per-tarčna [53 vs 65], (c) dolžina polnega žetona 27 vs rep 13 [moja
  aritmetika] — vsi popravljeni V ISTI rundi; tek 2 zeleno] · build svež
  EXIT=0 · `qa-round.sh 370 needles` VSE OK [4 need_static ŽIVO + TODO-R370
  odsoten; veriga + union registri r340–r370] · smoke EXIT=0 · e2e EXIT=0
  [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] ·
  leak-check čist. NOVO: scripts/qa-needles/r370.tsv [4 need_static ×1 vsak
  per-datoteka grep -rlF (LEKCIJA R368 (6): cat brez ločila laže), vsi ×0 v
  HEAD 2628e52 fetch-first git grep GLASNO potrjeno; izpuščena kandidata
  DOKAZANA: vodja niz = material ×8, invoice pill niz = crm ×1 — className-only
  ne diskriminira; must_miss; python validacija NF=3] + NOVE skripte
  [r370-era-clone.py, r370-era-harvest.sh, r370-dedup-scan.py,
  r370-window-scan.py, r370-qa-spot.sh, r370-spot-reprobe.sh,
  r370-val53-apply.sh, r370-pins-shift.py, r370-register-write.py] + README
  disk resnica [5239/334 + R370 bullet] + LEKCIJE R370: (1) **legacy
  build-needle skripti (r227–r339) so IZVEN trenutne needles verige** — njihovi
  zastareli needleji so bili NEVIDNO zastareli (r236 L48/L49 že pred R370);
  needles faza = TSV registri r340+ SAMO — legacy needleje osvežiti ob dotiku
  ALI uradno upokojiti (lastniška odločitev); (2) **per-tarčna enumeracija je
  kanon orodja** — test, ki bere 2 tarči, se šteje 2× (53 dedupirano ≠ 65
  per-tarčno); in-test replika mora upoštevati ISTO semantiko; (3) **cat brez
  ločila laže multiplicito** — sosednji .tsx brez končne noveline skrije
  zadnji/	prvi niz (grep -rlF per datoteka = kanon, LEKCIJA R368 (6)
  precizirana); (4) **poln žeton ≠ rep** — 'focus-visible:ring-offset-N' = 27
  znakov, 'ring-offset-N' = 13; dolžinsko-nevtralni dokaz na polnem žetonu;
  (5) **era-needle potrebuje ×0 v HEAD** — niz, ki ga nosi tudi druga datoteka
  (material ×8 / crm ×1), NI era diskriminator; vitest per-datoteka guard
  pokrije ostale; (6) **spot sonde brez dispatch/poll poročajo lažno
  praznino** — A-section r370-qa-spot je tekla pred montažo (nav 0), re-proba
  z dispatch+wait je pokazala 9/9/9/0 (LEKCIJA R360 poll kanon potrjena).
  Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement
  jedro NIČ [val 53 = render plast a11y className-only v 4 render datotekah];
  OgrajaVizija nič; brez sheme (ZERO-MUTACIJA E2E); 0 novih hex; NIČ novih FNV
  soli. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti
  lastnika (74. zapis). R371 prva naloga = qa-round.sh 370 prod-qa re-run
  [prek `r359-prod-qa-retry.sh 370`] + **STIRIINDVJSETIJNA era preverba
  r347–r370** [24 registrov, ≥101 need_static = 97 + 4 — pričakuj VSE ŽIVO; 2
  R353 needleja prek hash rezolucije; kanonski skript `r371-era-harvest.sh`
  [klon r370; 24 registrov, ≥101] pričakovan] + val 53 POST-deploy
  verifikacija [navy O1-rep površine spot — mounted + className LOČENO;
  calculator/dashboard/invoice/vodja — pričakuj delno montirane (navy
  pariteta per površina)]. R371 kandidati: **ring parity val 54 — navy NONE
  triaža** [54 vrstic per-vrstična klasifikacija iz diska: shadcn-kit override
  (izjema #1 doktrina) vs resnični brand gumbi brez offseta; orodje
  r370-window-scan.py kanon razširjen na NONE sken] ALI **?INTERP ×3 triaža**
  [roksal-catalog/punch-list interpolirani className — ročno ali preskočiti]
  ALI **e2e-lib dedup 11. val** [iskreno: NI kandidata ob ×2/×3 po
  r370-dedup-scan.py — izpustiti če ni ponovitve]. ISSUE #1: vsa sprejemna
  merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj >
  QA].
"""
src = src.replace(SIDRO, BULLET + SIDRO, 1)
p.write_text(src, encoding="utf-8")

# preverba: bullet naslovi v odseku
chk = pathlib.Path("README.md").read_text(encoding="utf-8")
import re
bullets = re.findall(r"^- \*\*Ring pariteta val (\d+)", chk, re.M)
print("bullet vrstni red (regex):", bullets[:12])
assert "val 53 (navy offset-1 rep)" in chk, "R370 bullet manjka"
assert NOV in chk, "števec ni posodobljen"
print("OK: README 5239/334 + R370 bullet vstavljen pred val 44 sidro")
