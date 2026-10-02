#!/usr/bin/env python3
# r371-readme-update.py — R371 README disk resnica (kanon LEKCIJA R366 (3)):
# števec 5239/334 → 5244/335 + R371 bullet kot CELOTO PRED naslednjim
# bulletom (val 44 sidro — disk resnica reda 45→…→54→44). Fail-closed.
import pathlib, sys

p = pathlib.Path("README.md")
src = p.read_text(encoding="utf-8")

STAR = "| Testi (vitest) | **5239** (334 datotek, vključno z globalSetup embedded PG) |"
NOV = "| Testi (vitest) | **5244** (335 datotek, vključno z globalSetup embedded PG) |"
if src.count(STAR) != 1:
    sys.exit(f"FAILOVEDANO: števec = {src.count(STAR)} (pričakovano 1)")
src = src.replace(STAR, NOV)

SIDRO = "- **Ring pariteta val 44 + e2e-lib dedup 1. val** (R361): (1) **prva naloga**"
if src.count(SIDRO) != 1:
    sys.exit(f"FAILOVEDANO: sidro = {src.count(SIDRO)} (pričakovano 1)")

BULLET = """- **Ring pariteta val 54 (navy NONE triaža) — BRAND GUMB pariteta ZAKLJUČENA** (R371): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 370`: **ZELEN ob poskusu 2**
  (1. teek transient — retry kanon iskreno porabljen, 10. runda zapored) + **STIRIINDVJSETIJNA
  era preverba** NOV kanonski skript `r371-era-harvest.sh` [klon r370 prek python
  `r371-era-clone.py`; 24 registrov r347–r370, ≥101 need_static = 97 + 4, vsota iz
  diska]: **EXIT=0 ob 1. teku** — vseh ŠTIRIINDVJSET er ŽIVO NA PRODU; ⭐ **val 53
  vsi 4 needleji ŽIVO DIREKTNO** (chunk_043/chunk_028/chunk_037) → val 53 deploy
  potrjen v celoti; 2 R353 needleja prek hash rezolucije; must_miss ×24 čisto;
  (2) **val 53 POST-deploy verifikacija** (spot-r167/16 `r371-qa-spot.sh` +
  `r371-vodja-identify.sh`; VSAKA površina z dispatch + pocakaj — LEKCIJA R370
  (6)): vodja izvozni pilli **3/3 offset-2 ŽIVO**, invoice racuniCsv +
  prihodkiPdf **1/1** + meseciCsv iskreno NEmontiran (vrata `meseciPovzetek.ok` —
  kanon r277), calculator zgodovina **1/1**, dashboard 'Izvozi CSV' kit override
  ŽIVO (offset NAMERNO 0 — izjema #1), **4. navy/40 BrezOffset 'Izvozi *' =
  sistem-zdravje-card L204 kit override** (disk dokaz — izjema #1); sonde:
  eb_sonda_navy_stetje 4. uporaba + eb_sonda_red_stetje 3. uporaba; **kolektor 0
  errorjev**; (3) **MANDATORY STIL val 54** — ring OBLIKOVNA pariteta navy/40
  NONE TRIAŽA: disk resnica prek NOVega orodja `scripts/r371-none-triage.py`
  (element klasifikacija z nazaj-hodom do 15 vrstic — LEKCIJA R364 (4) = KODA
  ne oči): navy/40 NONE ×54 = **KIT ×35** (shadcn Button + brand override —
  NAMERNA izjema #1) + **RAW ×13** (val 54 tarče) + **INPUT ×2** (dashboard
  L1623 + roksal-catalog L95 — iskalni vnosi, NE gumbi — iskreno izven) +
  **CMP ×5** (DropdownMenu/Command/Card — lastni fokus jezik, izven) +
  deal-pipeline L219 (drag handle — NE gumb, izven); **13 vrstic × 10 datotek**
  dobi ` focus-visible:ring-offset-2` TIK ZA navy/40 (audit L249/L310,
  calculator L860/L4439, dashboard L1628/L1756, inclinometer L341,
  inline-inclinometer L131, inline-kotomer L185, steber L69, photo L2370,
  punch L531, rate-limit L226; 2 tarči = census ?INTERP template → O2); census
  PRED {'O2': 192, 'NONE': 54, '?INTERP': 3} gap 57 → PO **{'O2': 205, 'NONE':
  43, '?INTERP': 1} gap 44 — vsi 44 DOKUMENTIRANI namerni (35 KIT + 2 INPUT +
  5 CMP + 1 drag) → navy/40 BRAND GUMB pariteta ZAKLJUČENA (razcep = 0;
  milestone val 43–54)**; substitucija DODAJA 27 znakov; **stale-pin PRED-SKAN
  ČIST → 0 PIN SHIFTOV** (prva runda brez shiftov od R367): r370-window-scan.py
  delta +27 = 0 preozkih (65/65), r317 must_miss needle odsoten, r348 steber +
  r346 okno + r271/r272/r268 handler pini preživijo; in-place 0 novih vrstic; 0
  novih hex (10/0/16/0/12/0/0/0/8/0); aria/title ZAMRZNJENI; (4) **e2e-lib
  dedup 11. val ISKRENO IZPUŠČEN** — dokaz V TESTU (13 blokov / 13 unikatnih /
  0 ponovitev ≥2 — kanon R368). VERIFIKACIJA (na KONČNI viri): tsc 0 · eslint 0
  (FULL) · vitest **5244/5244 (335)** = R370 baza 5239/334 + mojih +5/+1 − 0
  [tek 1: 2 faila = (a) preširok must_miss sosledni assert [L262 KIT vrstica
  nosi krajšo sosledje — polni r317 needle edini pravi], (b) r346 okno
  char-based namesto line-based kanon [i-8..i+6] — vsi popravljeni V ISTI
  rundi; tek 2 zeleno 5/5] · build svež EXIT=0 · `qa-round.sh 371 needles` VSE
  OK [4 need_static ŽIVO + TODO-R371 odsoten; veriga + union registri
  r340–r371] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post
  r276+r281+r283+r287 — ZERO-MUTACIJA] · leak-check čist. NOVO:
  scripts/qa-needles/r371.tsv [4 need_static ×1 per-datoteka grep -rlF, vsi ×0
  v HEAD 76fd98d fetch-first GLASNO; izpuščeni kandidati dokumentirani
  [punch-list template compile rep; inline close brata ×2 enak niz — kanon 4
  needleje/rundo; ostale 6 tarč prek vitest (A) guard]; must_miss; NF=3 čisto]
  + NOVE skripte [r371-era-clone.py, r371-era-harvest.sh, r371-qa-spot.sh,
  r371-vodja-identify.sh, r371-none-triage.py, r371-val54-apply.py,
  r371-register-write.py, r371-readme-update.py] + README disk resnica
  [5244/335 + R371 bullet] + LEKCIJE R371: (1) **klon-kanon preverbe morajo
  ločiti PRED-pogoje (vhodni rep) od POST-pogojev (novi žigi)** — TODO-R370 ni
  lahko v must r370-klona (še ne obstaja); (2) **legitimen ostanek stare
  ere-besede v NOVI glavi** [triindvajsete preverbe R370] — števec žigov
  pričakovan natančen [isti vzorec kot R370 klon lekcija, 2. ponovitev —
  LEKCIJA R362 (3) kanon pri ponovitvi]; (3) **era-klasični needle gre z
  `--`/`-e` ob vodilnem pomnilniku** [top-1/2 -translate… je lažno padel kot
  opcija]; (4) **must_miss assert mora uporabiti POLNI needle niz** — krajša
  sosledja laže padejo na KIT vrsticah z ISTO sosledjem [L262]; (5) **okenski
  kanon r346 je LINE-based [i-8..i+6]** — char-based replika z向往 smerjo
  naprej zgreši className PRED aria-jem; replika = ISTA semantika kot
  original [LEKCIJA R364 (4) precizirana]; (6) **spot sonde z dispatch+poll
  na VSAKI površini** [LEKCIJA R370 (6) aplicirana — 4/4 površine ŽIVO brez
  lažne praznine razen iskrenih vrat]. Kontrakt NIČ (/api/sync);
  SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 54 = render
  plast a11y className-only v 10 render datotekah]; OgrajaVizija nič; brez
  sheme (ZERO-MUTACIJA E2E); 0 novih hex; NIČ novih FNV soli. ⏰
  roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (75.
  zapis). R372 prva naloga = qa-round.sh 371 prod-qa re-run [prek
  `r359-prod-qa-retry.sh 371`] + **PETINDVJSETIJNA era preverba r347–r371**
  [25 registrov, ≥105 need_static = 101 + 4 — pričakuj VSE ŽIVO; 2 R353
  needleja prek hash rezolucije; kanonski skript `r372-era-harvest.sh` [klon
  r371; 25 registrov, ≥105] pričakovan] + val 54 POST-deploy verifikacija
  [13 surovih brand vrstic spot — mounted + className LOČENO; audit-trail
  dialog vrata: zgodovina odprta; dashboard iskanje: vnos ≠ prazno → clear
  ŽIVO; punch/inclinometer PDF vrata]. R372 kandidati: **?INTERP triaža ×1
  preostala** [roksal-catalog L110 KIT template — kit override doktrina ali
  ročno offset] ALI **INPUT/LINK fokus jezik odločitev** [2 iskalna vnosa +
  top-bar CMP ×3 — lastniška/usklajena doktrina ali dokumentirano stalno
  izjema] ALI **nov stil val 55 na drugi barvni družini** [census: red/40 gap
  22 = NONE ×20 + O1 ×2 — per-vrstična triaža iz diska PRED odločitvijo;
  ambers/ink zaključeni] — vedno z fetch-first + TSV kanonom + stale-pin
  PRED-skanom prek r370-window-scan.py. ISSUE #1: vsa sprejemna merila ✓;
  ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
"""
src = src.replace(SIDRO, BULLET + SIDRO, 1)
p.write_text(src, encoding="utf-8")

chk = p.read_text(encoding="utf-8")
import re
bullets = re.findall(r"^- \*\*Ring pariteta val (\d+)", chk, re.M)
print("bullet vrstni red:", bullets[:12])
assert "val 54 (navy NONE triaža)" in chk
assert NOV in chk
print("OK: README 5244/335 + R371 bullet")
