#!/usr/bin/env python3
# r379-readme-update.py — R379 README disk resnica: števec 5363/346 →
# 5423/351 [njihov R378 števec je ostal ZASTAREL (disk 5363/346, njihov
# commit trdi 5417/350 — LEKCIJA R369 (5) handover ≠ disk resnica); 5423 =
# 5363 + njihovih 54 (resnica: njihovi 4 testi datoteke +54 it) + mojih 6;
# 351 = 346 + njihove 4 + moja 1] + R379 bullet kot CELOTO PRED val 44
# sidrom (R361 bullet — kanon; njihov R378 bullet ŽE prisoten = žig).
# Fail-closed: stare žige obvezni PRED, novi ŽIGI obvezni PO.
import pathlib, sys

R = pathlib.Path("/home/z/my-project/README.md")
src = R.read_text(encoding="utf-8")

STAR_STEVEC = "| Testi (vitest) | **5363** (346 datotek, vključno z globalSetup embedded PG) |"
NOV_STEVEC = "| Testi (vitest) | **5423** (351 datotek, vključno z globalSetup embedded PG) |"
SIDRO = "- **Ring pariteta val 44 + e2e-lib dedup 1. val** (R361): (1) **prva naloga**"
R378_ZIG = "- **Issue #13, korak R167 — PROIZVODNA + AS-INSTALLED DOMENA: ProductionOrder/Line/Operation + InstallationRecord/Line + količinska veriga QUOTE → BOM → PRODUCTION → INSTALLATION (§9 + §10)** (R378 —"

if src.count(STAR_STEVEC) != 1:
    sys.exit("FAILOVEDANO: star števec ≠ ×1")
if src.count(SIDRO) != 1:
    sys.exit("FAILOVEDANO: R361 sidro bullet ≠ ×1")
if src.count(R378_ZIG) != 1:
    sys.exit("FAILOVEDANO: njihov R378 bullet žig ≠ ×1")

BULLET = """- **red/40 offset-2 pariteta val 59 + FEATURE r379-window-scan.py (8. generalizacija: needle pini iz registrov) + era-clone.py podniz-hrošča + verižni-rep generalizacija + eb_zapri_vodic 2-fazni post-pogoj — KOLIZIJA #21** (R379; runda preimenovana R378→R379 — njihova poslovna R378 [73d57b0, PROIZVODNA DOMENA] je pristala MED mojim delom in vzela številko): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 377`: **ZELEN ob poskusu 1**
  (15. runda zapored) + **ENAINTRIDESIJNA era preverba** `r378-era-harvest.sh`
  [31 registrov r347–r377, ≥126 = 125 + 1, vsota iz diska]: **EXIT=0 ob 1. teku**
  — 115 ŽIVO DIREKTNO + 11 rezolucij [6 hash + 5 SERVER] — **r371 NASLEDNICA
  ŽIVO** (razrešena ob R377 pushu); ⭐ **val 58 needle ŽIVO DIREKTNO**
  (chunk_028) → val 58 deploy potrjen; must_miss ×31 čisto. PO KOLIZIJI #21:
  **DVAINTRIDESIJNA era preverba** `r379-era-harvest.sh` [32 registrov
  r347–r378, ≥130 = 126 + 4]: **EXIT=0** — njihovi 4 produkcija needleji
  ŽIVO prek SERVER resolucije [production-store_ts chunk + prod /api/production
  HTTP 401]; era-clone generalizacije: (a) **podniz-hrošča** [LEKCIJA R378 (1):
  ENAINTRIDESIJNA ⊃ TRIDESIJNA — 31. preverba = prvi prehod v INTRIDESIJNA
  družino; 'expected 0' preverbe z levo črkovno mejo], (b) **verižni-rep +
  banner dejanski segment** [ročni chain-seg + multiplicita ≠ ×4 — regex
  detekcija 'IN r{N}.tsv … na' z count-checkom], (c) ** oznaka konvencija**
  [r377.tsv = lastna oznaka 'R377 val 58']. **val 58 POST-deploy spot**
  (`r379-qa-spot.sh` spot-r167/22; mounted + className LOČENO; kolektor 0):
  bazna resnica 0 montiranih pri praznem iskanju → fill → **MONTIRAN 1 z
  VSEH 5 needle klas** → **PRAVI klik OK** (scrollintoview — disk resnica:
  search bar POD fixed bottom-nav z-50 na 577px viewportu) → od-montiran =
  funkcionalni dokaz v OBEH smereh. **eb_zapri_vodic UTRDITEV** [LEKCIJA
  R378 (2): vodič ~10s+ PO prijavi — stara ×3 klik race = vodič ODPRT celo
  sejo, ozadje fixed inset-0 z-[100] BLOKALO VSE prave klike (eval sonde
  niso prizadele); v2 = 2-fazni post-pogoj ozadje=0 IN storage='true'].
  (2) **MANDATORY STIL val 59 — red/40 offset-2 PARITETA**: disk census
  [`r379-census.sh`: rdeča 25 = O2 11 + NONE 14; amber/50 100%]; 14 × INS
  ' focus-visible:ring-offset-2' TIK ZA red/40 [8 datotek: dashboard ×5,
  floor-plan ×1, inventory ×1, quote-followup ×1, roksal-catalog ×1,
  sessions-dialog ×2, termini-card ×1, top-bar ×2; +28 znakov/vrstico,
  in-place; r372 val 55 izjema #1 RESOLVANA]; `r379-val59-apply.py`
  fail-closed [scan→14, idempotenca 0]; `r379-stil-val59.test.ts` ×6;
  r372 (D)/(E) PIN SHIFT/EVOLVED žigi [o2 11→25, none 14→0; klasifikacija
  obrnjena = {KIT:12, CMP:2, RAW:1}]. (3) **FEATURE r379-window-scan.py —
  8. generalizacija** [LEKCIJA R377 (4) formalizacija]: DEL 1 regex okna 53
  + **DEL 2 NOVO: needle pini iz registrov r340–r379 — 147 need_static,
  147/147 ŽIVIH v src** + DEL 3 slice-okna 17; delta 28 → 0 preozkih.
  (4) e2e-lib dedup 16. val ISKRENO IZPUŠČEN [kanon R368].
  VERIFIKACIJA (PO re-aplikaciji KOLIZIJE #21): vitest **5423/5423 (351)**
  FULL zeleno [njihova baza 5417/350 + mojih +6/+1; njihov README števec
  zastarel — popravljen tukaj] · tsc 0 · eslint 0 (FULL) · build svež
  EXIT=0 [prisma generate + migrate deploy 20261005080000_r378 — njihova
  shema] · qa-round.sh 379 needles EXIT=0 [97× FAIL=0; r379.tsv ŽIVO +
  TODO-R379 odsoten + njihov r378.tsv ŽIVO] · smoke EXIT=0 · e2e EXIT=0
  [ZERO-MUTACIJA] · r379-era-harvest EXIT=0 · leak-check čist.
"""
src = src.replace(STAR_STEVEC, NOV_STEVEC, 1)
src = src.replace(SIDRO, BULLET + SIDRO, 1)

out = src
if out.count(NOV_STEVEC) != 1:
    sys.exit("FAILOVEDANO: nov števec ≠ ×1 PO")
if out.count(BULLET) != 1:
    sys.exit("FAILOVEDANO: nov bullet ≠ ×1 PO")
if out.count(R378_ZIG) != 1:
    sys.exit("FAILOVEDANO: njihov R378 bullet izginil PO")
R.write_text(out, encoding="utf-8")
print("OK: README 5363/346 → 5423/351 (njihov zastarel števec popravljen) + R379 bullet")
