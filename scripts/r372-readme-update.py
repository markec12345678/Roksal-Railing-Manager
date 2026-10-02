#!/usr/bin/env python3
# r372-readme-update.py — R372 README disk resnica (kanon LEKCIJA R366 (3)):
# števec 5244/335 → 5249/336 + R372 bullet kot CELOTO PRED val 44 sidrom
# (disk resnica reda 45→…→55→44). Fail-closed + CJK revizija (LEKCIJA
# R371 (8): roundska besedila brez naključnih CJK znakov).
import pathlib, re, sys

p = pathlib.Path("README.md")
src = p.read_text(encoding="utf-8")

STAR = "| Testi (vitest) | **5244** (335 datotek, vključno z globalSetup embedded PG) |"
NOV = "| Testi (vitest) | **5249** (336 datotek, vključno z globalSetup embedded PG) |"
if src.count(STAR) != 1:
    sys.exit(f"FAILOVEDANO: števec = {src.count(STAR)} (pričakovano 1)")
src = src.replace(STAR, NOV)

SIDRO = "- **Ring pariteta val 44 + e2e-lib dedup 1. val** (R361): (1) **prva naloga**"
if src.count(SIDRO) != 1:
    sys.exit(f"FAILOVEDANO: sidro = {src.count(SIDRO)} (pričakovano 1)")

BULLET = """- **Ring pariteta val 55 (red/40 RAW) — red BRAND GUMB pariteta ZAKLJUČENA** (R372): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 371`: **ZELEN ob poskusu 2**
  (1. teek transient — retry kanon iskreno porabljen, 11. runda zapored) + **PETINDVJSETIJNA
  era preverba** NOV kanonski skript `r372-era-harvest.sh` [klon r371 prek python
  `r372-era-clone.py`; 25 registrov r347–r371, ≥105 need_static = 101 + 4, vsota iz
  diska; LEKCIJA R371 (2) 3. ponovitev vzorca → zaostanek glave POPRAVLJEN na disk
  resnico — klon preverja OBE smeri ('petindvajsete preverbe R372' ×1 + stari
  zaostanek ×0)]: **EXIT=0 ob 1. teku** — vseh PETINDVJSET er ŽIVO NA PRODU; ⭐ **val 54
  vsi 4 needleji ŽIVO DIREKTNO** (chunk_028/chunk_043) → val 54 deploy potrjen v
  celoti; 3 needleji prek hash rezolucije; must_miss ×25 čisto;
  (2) **val 54 POST-deploy verifikacija** (spot-r167/17 `r372-qa-spot.sh` + re-proba
  spot-r167/17b `r372-spot-reprobe.sh`; mounted + className LOČENO — LEKCIJA R365
  (4); dispatch+poll VSAKA površina — LEKCIJA R370 (6)): **L1628 'Počisti iskanje
  projektov' ŽIVO 1 mounted / 1 navy40 / 1 offset-2**; measurements tab **27 navy/40 =
  27 offset-2** (BrezOffset 0 — val 52/53/54 skupni dokaz); calculator Zgodovina
  sprožilec navy40+offset2 1/1 (val 53 ŽIVO); **demo seja 'Ni projektov' (0 vrstic —
  disk resnica)** → projekt-gated površine (L1756 Arhiviraj, audit chips L249 +
  razpenjanje L310, nagibi PDF L341, steber CSV L69, inline urednika L131/L185,
  Uredi mero L2370, zapisnik PDF L531, telemetrija CSV L226) **iskreno NEmontirane**
  (kanon r277 z razlogom iz diska); 1. teek nauček: vrstica ni bila montirana ob
  pollu (prijava poskus 2) + iskalni filter je izpraznil seznam PRED klikom vrstice
  → re-proba z obrnjenim zaporedjem (sidro → vrstice → klik → šele nato pogojne);
  L860 Počisti uvoz (vrata importedFromMeasurement) + L4439 zgodovina vrstice
  (vrata history.length>0) iskreno NEmontirani; kolektor **0 errorjev** v obeh
  sejah → **NI runtime bugov → development-first**;
  (3) **MANDATORY STIL val 55 — ring OBLIKOVNA pariteta roksal-red/40 RAW** (per-barvni
  split kanon: navy = val 43–49 + 52 pari + 53 O1 rep + 54 NONE triaža, red = val 50
  [red-400/60 trio] + **val 55** [roksal-red/40 družina], amber = val 51; BARVNI ŽIGI
  bajtno nespremenjeni — shape-only runda): census PRED {'NONE': 20, 'O1': 2, 'O2': 3}
  gap 22 → PO **{'NONE': 14, 'O2': 11} gap 14 — vsi 14 = DOKUMENTIRANI namerni
  (12 KIT [shadcn <Button> + brand override — izjema #1] + 2 CMP [top-bar
  DropdownMenuItem odjava — lastni fokus jezik]) → red/40 BRAND GUMB pariteta
  ZAKLJUČENA (razcep na brand gumboh = 0; O1 razcep = 0)**; **RAW ×8**: 2 × SUB
  O1→O2 DOLŽINSKO NEVTRALNO 27→27 (dashboard L1987 'Zamujena dobava', vodja
  L2122 'Brez dobavitelja' — precedent val 53) + 6 × INS ' focus-visible:ring-offset-2'
  TIK ZA red/40 (material-intelligence L1408, measurements L3351/L4032,
  notification-center L703, photo-tab L717, sistem-zdravje L228 — precedent val 54);
  in-place = **0 novih vrstic** (3188/2199/2366/6232/969/2684/307 — wcLinije kanon);
  **0 novih hex** (0/1/0/0/0/12/0 = HEAD); aria/title ZAMRZNJENI (ring-only —
  val 44–54 precedens); apply prek `scripts/r372-val55-apply.py` (fail-closed per
  vrstica: red/40 točno 1×, offset stanje pričakovano, PO pozicijska preverba);
  (4) **FEATURE `scripts/r372-token-triage.py`** — generalizacija r371-none-triage.py
  na POLJUBEN focus-visible:ring- žeton (argv; klasifikacija KIT/RAW/INPUT/LINK/CMP/
  DIV z nazaj-hodom do 15 vrstic; **1. uporaba V ISTI rundi**): 1. teek je 5 'golih'
  `<button` tagov lažno označil DIV?/? [pattern `<button[\\s>]` ne ujame taga na
  koncu vrstice] + `<DropdownMenuItem` zgrešil kot CMP → popravljeno V ISTI rundi
  prek `(?![-\\w])` + `\\w*` → PO popravku: GAP 22 = KIT ×12 + RAW ×8 + CMP ×2, 0
  neopredeljenih; **NOVI `scripts/r372-window-scan.py`** (klon r370, TARGETS = 7 val
  55 datotek) delta +27 = **0 preozkih (121/121, PRED in PO)**; ŠTEVEC guard sken
  PRED vitestom (LEKCIJA R371 (7) aplicirana): r370 (A) navy-obsegani števci
  nedotaknjeni, r371 (A) hex/aria/title/in-place čisto; **1 ŠTEVEC PIN SHIFT**
  [PIN SHIFT R372 val 55]: r371 (B) sistem-zdravje celo-datotečni 'ring-offset'
  absent → navy-vrstični guard z ISTO namero (val 55 offset na RAW red/40 L228;
  kit override L204 ostaja brez offseta); okenski pini 0 shiftov;
  (5) **e2e-lib dedup 12. val ISKRENO IZPUŠČEN** — dokaz V TESTU (E): 26 blokov
  r370–r372 / 21 unikatnih / 5 ponovitev ×2 — **VSE znotraj r372** (r372-qa-spot
  1. teek vs r372-spot-reprobe ISTEGA teka; preverba izvora per hash) → nič
  čez-rundnih ponovitev → ni kandidata (kanon R368).
  VERIFIKACIJA (celotna, FOREGROUND, na KONČNI viri): tsc 0 · eslint 0 (FULL) ·
  vitest 5249/5249 (336) = R371 baza 5244/335 + mojih +5/+1 − 0 · build svež EXIT=0 ·
  qa-round.sh 372 needles VSE OK 0 MISS [4 need_static ŽIVO + TODO-R372 odsoten;
  veriga + union registri r340–r372] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO
  IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · r372-era-harvest.sh
  EXIT=0 [PETINDVJSETIJNA] · leak-check čist. NOVO: scripts/qa-needles/r372.tsv
  [4 need_static ×1 per-datoteka grep -rlF, vsi ×0 v HEAD 810b691 fetch-first GLASNO;
  izpuščeni kandidati dokumentirani: skupni niz 3 bratov material-intelligence/
  notification-center/photo ×3 + measurements L4032 + SUB celotni nizi — pokriti
  prek vitest (A); must_miss TODO-R372; NF=3 čisto] + NOVE skripte [r372-era-clone.py,
  r372-era-harvest.sh, r372-window-scan.py, r372-qa-spot.sh, r372-spot-reprobe.sh,
  r372-token-triage.py, r372-val55-apply.py, r372-readme-update.py,
  r372-worklog-append.py] + LEKCIJE R372: (1) **demo 'Ni projektov' = disk resnica**
  — projekt-gated spot površine iskreno NEmontirane z razlogom, NI bug; (2) **spot
  zaporedje: sidro → vrstice → klik → šele nato pogojne vnose** (iskalni filter PRED
  klikom vrstice izprazni seznam); (3) **triaža-orodje: goli tag na koncu vrstice**
  (`<button\\n`) rabi `(?![-\\w])`, ne `[\\s>]`; (4) **komponentni prefiksi rabijo
  `\\w*`** (DropdownMenuItem ≠ DropdownMenu + \\s); (5) **celo-datotečni absent
  asserti so krhki ob novih površinah ISTEGA datoteka** — ožji navy-vrstični guard
  z žigom ob prvem stiku; (6) **klon glave: zaostanek ere-besede popraviš, ne
  podeduješ** — 3. ponovitev vzorca, tokrat disk resnica v Novi glavi; (7) vitest
  rabi `import { describe, expect, it } from 'vitest'` (globals izklopljeni).
  Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro
  NIČ [val 55 = render plast a11y className-only v 7 render datotekah];
  OgrajaVizija nič; brez sheme (ZERO-MUTACIJA E2E); 0 novih hex; NIČ novih FNV soli.
  ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (76.
  zapis). R373 prva naloga = qa-round.sh 372 prod-qa re-run [prek
  r359-prod-qa-retry.sh 372] + ŠESTINDVJSETIJNA era preverba r347–r372 [26
  registrov, ≥109 need_static = 105 + 4 — kanonski skript r373-era-harvest.sh
  pričakovan] + val 55 POST-deploy verifikacija [4 needleji r372.tsv — dashboard
  L1987 'Zamujena dobava' VEDNO montiran ob zamujenih dobavah (vrata
  zamujeneDobaveDomov > 0), vodja L2122 'Brez dobavitelja' (vrata stats), ostala
  2 prek vitest (A); mounted + className LOČENO; dispatch+poll VSAKA].
  R373 kandidati: **?INTERP ×1 preostala navy** [roksal-catalog L110 KIT template]
  ALI **ring/50 družina** [census: 14 NONE — VSE ui/* shadcn kit fokus jezik
  (accordion/badge/button/checkbox/input/navigation-menu/radio-group/scroll-area/
  select/switch/tabs/textarea/toggle) — pričakuj KIT 100% → dokumentirati kot
  shadcn jezik, BREZ sprememb] ALI **white/60 družina** [8 NONE — top-bar gosta
  površina, izjema #2 iz val 52] — vedno z fetch-first + TSV kanonom + stale-pin
  PRED-skanom + ŠTEVEC guard skenom (LEKCIJA (7)). ISSUE #1: vsa sprejemna merila ✓;
  ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
"""
if src.count(SIDRO) != 1:
    sys.exit("FAILOVEDANO: sidro zginil")

# CJK revizija bulleta (LEKCIJA R371 (8))
cjk = re.findall(r"[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]", BULLET)
if cjk:
    sys.exit(f"FAILOVEDANO: CJK znaki v bulletu: {cjk[:10]}")

src = src.replace(SIDRO, BULLET + SIDRO)
p.write_text(src, encoding="utf-8")
print("OK: README števec 5244→5249 + R372 bullet pred val 44 sidrom")
