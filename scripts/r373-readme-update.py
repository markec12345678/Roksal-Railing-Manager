#!/usr/bin/env python3
# r373-readme-update.py — R373 README disk resnica (kanon LEKCIJA R366 (3)):
# števec 5249/336 → 5254/337 + R373 bullet kot CELOTO PRED val 44 sidrom
# (disk resnica reda 45→…→56→44). Fail-closed + CJK revizija (LEKCIJA
# R371 (8): roundska besedila brez naključnih CJK znakov).
import pathlib, re, sys

p = pathlib.Path("README.md")
src = p.read_text(encoding="utf-8")

STAR = "| Testi (vitest) | **5249** (336 datotek, vključno z globalSetup embedded PG) |"
NOV = "| Testi (vitest) | **5254** (337 datotek, vključno z globalSetup embedded PG) |"
if src.count(STAR) != 1:
    sys.exit(f"FAILOVEDANO: števec = {src.count(STAR)} (pričakovano 1)")
src = src.replace(STAR, NOV)

SIDRO = "- **Ring pariteta val 44 + e2e-lib dedup 1. val** (R361): (1) **prva naloga**"
if src.count(SIDRO) != 1:
    sys.exit(f"FAILOVEDANO: sidro = {src.count(SIDRO)} (pričakovano 1)")

BULLET = """- **Ring pariteta val 56 (male družine: white + white/60 + roksal-green/40 RAW) — per-barvni split kanon ZAKLJUČEN** (R373): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 372`: **ZELEN ob poskusu 1**
  (12. runda zapored) + **ŠESTINDVJSETIJNA era preverba** NOV kanonski skript
  `r373-era-harvest.sh` [klon r372 prek python `r373-era-clone.py`; 26 registrov
  r347–r372, ≥109 need_static = 105 + 4, vsota iz diska; LEKCIJA R372 (6) 4.
  ponovitev vzorca → zaostanek glave popravljen z dvostransko preverbo]:
  **EXIT=0 ob 1. teku** — vseh ŠESTINDVJSET er ŽIVO NA PRODU; ⭐ **val 55 vsi 4
  needleji ŽIVO DIREKTNO** (chunk_028/chunk_023/chunk_026) → val 55 deploy
  potrjen v celoti; 3 needleji prek hash rezolucije; must_miss ×26 čisto;
  era kontrole R340/R341/R343/R345 ŽIV. **val 55 POST-deploy verifikacija**
  (`r373-qa-spot.sh` spot-r167/18 + `r373-spot-reprobe.sh` 18b; mounted +
  className LOČENO, dispatch+poll VSAKA): vse 4 val 55 površine podatkovno-
  /napačno-gated v demo seji → **iskreno NEmontirane z razlogom iz diska**
  (kanon r277): dashboard L1987 vrata `zamujeneDobaveDomov > 0` [demo 0 +
  'Ni projektov' disk resnica, sidro CSV izvoz ŽIVO], vodja L2122 vrata
  `stats.zamujeneDobave > 0` [demo 0], sistem-zdravje L228 vrata `napaka`
  [zdravje OK — fail-verbose po dizajnu], measurements L3351 vrata merilna
  vrstica [projekt-gated]; vodja sidro 'Sistem — zdravje' ŽIVO; measurements
  27 navy/40 = 27 offset-2 BrezOffset 0; dashboard 1 BrezOffset navy =
  dokumentiran kit override (izjema #1, 'Izvozi prikazane projekte v CSV');
  kolektor 0 errorjev → NI runtime bugov → development-first. (2) **MANDATORY
  STIL val 56 — male družine RAW pariteta**: disk resnica prek NOVEGA orodja
  **`r373-family-census.py`** (4. korak generalizacije: r369-census →
  r371-none-triage → r372-token-triage → TA; poljuben seznam družin + census
  + element triaža v enem prehodu; meja `(?![/\\w-])` — 'white' ≠ 'white/60';
  fail-closed 0 pojavitev; **1. uporaba V ISTI rundi**; navzkrižna validacija:
  navy/40 {'O2': 205, 'NONE': 43, '?INTERP': 1} = TOČNO r371 PO census) —
  census PRED → PO: white {'NONE': 3} → {'O2': 3} gap 3→0; white/60
  {'NONE': 8, 'O0': 3} → {'NONE': 4, 'O0': 3, 'O2': 4} gap 8→4 — vsi 4 = KIT
  (izjema #1); roksal-green/40 {'NONE': 1} → {'O2': 1} gap 1→0; **8 × INS
  ' focus-visible:ring-offset-2' TIK ZA žetonom** (photo-tab white RAW ×3
  L978/L1129/L1137 + white/60 RAW ×4 L1414/L2048/L2061/L2071, dashboard
  green RAW ×1 L1742 'Pokliči stranko' — precedent val 55 INS; +28 znakov,
  vrstni red ring → offset → outline pri belih RAW); DOKUMENTIRANE izjeme
  BREZ sprememb: ring/50 ×14 (vse ui/* shadcn kit fokus jezik), white/60 KIT
  ×4, top-bar O0 ×3 (izjema #2, zamrznjena v r369-stil-val52.test.ts),
  destructive/20+/40 ×4 (ui badge/button), resizable ring O1 ×1, navy
  ?INTERP ×1 razrešena v KIT (roksal-catalog L110 = <Button iz ui/button —
  interpolacija je bg variant, ne fokus) → **per-barvni split kanon ZAKLJUČEN
  (MILESTONE val 43–56: navy/red/amber/white/white-60/green RAW pariteta)**;
  in-place = 0 novih vrstic (2684/3188); 0 novih hex; aria/title ZAMRZNJENI;
  apply prek `r373-val56-apply.py` fail-closed per vrstica (anchor ×1, offset
  odsoten PRED, offset tik za žetonom PO, in-place) + 3 bele RAW vrstice
  preurejene v kanonski vrstni red V ISTI rundi. (3) Stale-pin PRED-skan:
  `r373-window-scan.py` (klon r372, TARGETS = photo-tab + dashboard-tab)
  delta +28 ×3 žetona = **0 preozkih (14/14 PRED in PO)**; ŠTEVEC guard sken
  PRED vitestom (LEKCIJA R371 (7)): r370 (A) navy-obsegani števci +
  r371/r372 per-datoteka hex/aria/title čisto; okenski/handler/must_miss
  pini 0 shiftov + e2e-lib dedup **13. val ISKRENO IZPUŠČEN** [dokaz V
  TESTU (E): 32 blokov r370–r373 / 27 unikatnih / 5 ×2 — VSE še zmeraj
  znotraj r372 (1. teek vs re-proba); r373 bloki ×6 vsi NOVI unikati; kanon
  R368]. VERIFIKACIJA (celotna, FOREGROUND, na KONČNI viri): tsc 0 · eslint 0
  (FULL) · vitest **5254/5254 (337)** = R372 baza 5249/336 + mojih +5/+1 − 0
  [suite tek 1: 2 faila = resizable niz ('ring-ring' ne 'ring') + createHash
  import manjkajoč; tek 2: 1 fail = destructive sosledje z dark: varianto
  vmes — vsi popravljeni V ISTI rundi; tek 3 zeleno 5/5; FULL vitest TEK 1
  zeleno] · build svež EXIT=0 [rm -rf .next; max-old-space-size 2560] ·
  `qa-round.sh 373 needles` VSE OK 0 MISS [4 need_static ŽIVO v svežem
  buildu + TODO-R373 odsoten; veriga R227→…→R339 + union registri
  r340–r373] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN
  pre==post r276+r281+r283+r287 — ZERO-MUTACIJA dokazana] ·
  `r373-era-harvest.sh` EXIT=0 [ŠESTINDVJSETIJNA, ob začetku runde] ·
  `r359-prod-qa-retry.sh 372` ZELEN ob poskusu 1 · `r373-qa-spot.sh` +
  re-proba ZELENA [kolektor 0 errorjev] · leak-check čist. NOVO:
  `scripts/qa-needles/r373.tsv` [4 need_static ×1 per-datoteka grep -rlF,
  vsi ×0 v HEAD 777e84f fetch-first GLASNO prek `r373-register-write.py`
  (NF=3 validacija); izpuščeni kandidati dokumentirani: white/60 orodjarna
  bratje ×2 (L2061/L2071) + white RAW puščici ×2 (L1129/L1137) — pokriti
  prek vitest (A); must_miss TODO-R373] + NOVE skripte [r373-era-clone.py,
  r373-era-harvest.sh, r373-family-census.py, r373-val56-apply.py,
  r373-window-scan.py, r373-qa-spot.sh, r373-spot-reprobe.sh,
  r373-register-write.py, r373-readme-update.py, r373-worklog-append.py] +
  LEKCIJE R373: (1) **demo seja = živa disk resnica** — 'Ni projektov' v
  OBEH runah (sidro 'Arhiviraj projekt' = 0, sidro CSV izvoz ŽIVO) →
  projekt-/podatkovno-gated površine iskreno NEmontirane z razlogom iz
  diska [kanon r277; LEKCIJA R372 (1) potrjena v sveži seji]; (2) **vrstni
  red INS: ring → offset → outline** — vstavljeno za celoten fokus niz
  funkcijsko enako, a kanonska vrstni redna pravila zahtevajo offset TIK ZA
  žetonom (r372 N3 needle semantika) — 3 bele RAW vrstice preurejene V ISTI
  rundi; (3) **apply-orodje = transformacijski dokument**: po enkratnem
  prehoju je re-run fail-closed abortiral na 'offset ŽE prisoten'
  (idempotenčna zaščita = pravilno vedenje); (4) **triaža-orodje meja
  družine**: 'white' brez `(?![/\\w-])` bi ujel 'white/60' — meja obvezna
  za poljubne družine [LEKCIJA R372 (3)/(4) nadaljevanje]; (5) **navy
  ?INTERP razrešitev = element dokaz, ne besedilo** — template literal z
  interpolacijo bg variant je KIT, ker nosilec nosi <Button iz ui/button
  (L103) — interpolacija NE nosi fokusa; (6) vitest rabi `import {
  describe, expect, it } from 'vitest'` + crypto createHash import —
  globals izklopljeni [LEKCIJA R372 (7) nadaljevanje]. Kontrakt NIČ
  (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ
  [val 56 = render plast a11y className-only v 2 render datotekah];
  OgrajaVizija nič; brez sheme (ZERO-MUTACIJA E2E); 0 novih hex; NIČ novih
  FNV soli. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti
  lastnika (77. zapis). R374 prva naloga = qa-round.sh 373 prod-qa re-run
  [prek `r359-prod-qa-retry.sh 373`] + **SEDAMINDVJSETIJNA era preverba
  r347–r373** [27 registrov, ≥113 need_static = 109 + 4; kanonski skript
  `r374-era-harvest.sh` pričakovan] + val 56 POST-deploy verifikacija
  [4 needleji r373.tsv — photo-tab white RAW ×1 L978 + white/60 RAW ×2
  L1414/L2048 + dashboard green RAW ×1 L1742; photo-tab prek photo
  galerije/pogleda (vrata: projekt + fotografije), dashboard 'Pokliči
  stranko' prek projektne vrstice (vrata: projekt vrstica — demo seja
  'Ni projektov' → pričakuj iskreno NEmontirano z razlogom; mounted +
  className LOČENO; dispatch+poll VSAKA]. R374 kandidati: stylizacija
  brez RAW ostankov — po val 56 je ring gap čez VSE družine = samo
  dokumentirane izjeme [KIT/CMP/INPUT/O0] → 1. kandidat = NON-ring stil
  (npr. focus-visible:border pariteta na INPUT ×10, ALI transition-colors
  skladnost, ALI dark-mode kontrast spot prek agent-browserja); 2.
  kandidat = e2e-lib dedup 14. val [po kanonu le ob novih ×3 ponovitvah];
  3. kandidat = QA-infra: era-clone orodje generalizacija (r373-era-clone
  je 3. klon — python parametriziran cloner za r374+). ISSUE #1: vsa
  sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP
  RULE: razvoj > QA].
"""
if src.count(SIDRO) != 1:
    sys.exit("FAILOVEDANO: sidro za vstavitvę manjka")
src = src.replace(SIDRO, BULLET + SIDRO)

# CJK revizija (LEKCIJA R371 (8)): novi bullet brez naključnih CJK znakov
if src.count(BULLET) != 1:
    sys.exit("FAILOVEDANO: bullet ni vstavljen natanko 1×")
cjk = re.findall(r"[\u4e00-\u9fff\u3400-\u4dbf]", BULLET)
if cjk:
    sys.exit(f"FAILOVEDANO: naključni CJK znaki v bulletu: {cjk[:10]}")

p.write_text(src, encoding="utf-8")
print("OK: README posodobljen (5254/337 + R373 bullet pred val 44 sidrom; CJK revizija 0)")
