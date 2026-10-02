#!/usr/bin/env python3
# r368-readme-update.py — R368 README disk resnica:
#  (1) števec 5224 (331 datotek) → 5229 (332 datotek);
#  (2) R368 bullet VSTAVLJEN kot CELOTO PRED naslednji bullet
#      (LEKCIJA R366 (3) / R367 (3): nikoli old_str=predhodna glava);
#      po vstavitvi rg preverba vrstnega reda R362→…→R367→R368.
import pathlib, re, sys

p = pathlib.Path("README.md")
src = p.read_text(encoding="utf-8")

# (1) števec — ena sama zamenjava v tabeli zmogljivosti (vrstica ~106)
stari = "| Testi (vitest) | **5224** (331 datotek, vključno z globalSetup embedded PG) |"
novo = "| Testi (vitest) | **5229** (332 datotek, vključno z globalSetup embedded PG) |"
assert src.count(stari) == 1, f"števec vrstica: {src.count(stari)} pojavitev (pričakovano 1)"
src = src.replace(stari, novo)

# (2) R368 bullet — vstavi PRED naslednji bullet (R361 line)
sidro = "- **Ring pariteta val 44 + e2e-lib dedup 1. val** (R361): (1) **prva naloga**"
assert src.count(sidro) == 1, f"sidro: {src.count(sidro)} pojavitev (pričakovano 1)"
bullet = """- **Ring pariteta val 51 + e2e-lib dedup 8. val** (R368): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 367` ZELEN ob **poskusu
  2** (1. teek transient — retry kanon pravično porabljen, 9. runda zapored)
  + **ENAINDVJSETIJNA era preverba** `r368-era-harvest.sh` EXIT=0 ob 1. teku:
  21 registrov r347–r367 (≥89 need_static = 85 + 4), R367 val 50 ×4 ŽIVO (3
  direktno + sketch prek hash rezolucije 1085983bcb110e2c.js HTTP 200) →
  deploy potrjen v celoti, must_miss ×21 čisto, era kontrole
  R340/R341/R343/R345 ŽIV; (2) **val 50 POST-deploy verifikacija**
  (spot-r167/13, mounted + className LOČENO): vse rdeče površine pogojene —
  iskreno NEmontirane v demo praznini z vrati iz vira (Upokoji oprema,
  'Zaključi z override' QC dialog, 'Izbriši mero' isPhoto&&photoId,
  'Pobriši celotno skico' projekt+strokes, material cancel dialog
  cancelDialogOrder); val 47/49 stabilnost (mainNavy40 27/27 offset-2,
  BrezOffset 0); kolektor 0 errorjev; (3) **MANDATORY STIL val 51** — ring
  OBLIKOVNA pariteta roksal-AMBER focus družine (per-barvni census iz diska
  prek `scripts/r368-census.py`: 31 žetonov / 30 površin / 11 datotek —
  14 že O2, 3 × offset-1→2, 13 × dodan → **razcep = 0**); in-place 0 novih
  vrstic (19250); 0 novih hex (12/1); aria/title ZAMRZNJENI; **stale pini
  PRED-scan → 25 pojavitev v 14 zamrznjenih skriptah shiftanih V ISTI
  RUNDI** (inventory offset-1 pin ×14 r243–r255+r244-prod-qa; notification
  izjema pin ×11 r245–r255; žig [PIN SHIFT R368 val 51]; r175 regex prefix
  pin preživi — [^"]* flex); (4) **FEATURE e2e-lib dedup 8. val** — NOV
  pomočnik `eb_sonda_navy_stetje` (3-poljni navy/40 števec byte-identičen
  ×3 v r366 B + r367 A/B — md5 d1f0004c299648ab1ff88f06bdafc889; prag
  LEKCIJE R352 IZENAČEN; precedens eb_sonda_status_chipi R367) s porabo ob
  1. uporabi v `r368-qa-spot.sh` A+B V ISTI rundi (kanon ne sme biti
  papir; zamrznjeni NI mutirani). VERIFIKACIJA (na KONČNI viri): tsc 0 ·
  eslint 0 (FULL) · vitest **5229/5229 (332)** = R367 baza 5224/331 +
  mojih +5 − 0 [tek 1: 2 faila = pod() literal-escaper nad regexom hex
  števca + pojavitve ≠ klici v spot skripti → direktni regex + števec
  klicev V ISTI rundi; tek 2 zeleno] · build svež EXIT=0 ·
  `qa-round.sh 368 needles` VSE OK [4 need_static ŽIVO + TODO-R368
  odsoten; veriga + union registri r340–r368] · smoke EXIT=0 · e2e EXIT=0
  [ZERO-MUTACIJA] · leak-check čist. NOVO: scripts/qa-needles/r368.tsv [4
  need_static ×1/×3/×2/×2, vsi ×0 v HEAD fetch-first git grep; 2 kandidata
  izpuščena — inclinometer NI ×0 (vodja prefix), step-corners isti čanek
  kot N4; must_miss; python validacija NF=3] + README disk resnica
  [5229/332 + R368 bullet].
"""
src = src.replace(sidro, bullet + sidro)
p.write_text(src, encoding="utf-8")

# preverba vrstnega reda (LEKCIJA R366 (3): rg po vstavitvi).
# Disk resnica: val 44 (R361) bullet nosi ZGODOVINSKI append — stoji NA
# KONCU (za R367), ne naraščajoče; pričakovano: 45→…→51→44.
red = re.findall(r"^- \*\*Ring pariteta val (\d+)", src, re.M)
print("Ring pariteta val vrstni red:", red)
assert red == ['45', '46', '47', '48', '49', '50', '51', '44'], red
assert red.index('51') == red.index('50') + 1, "R368 ni takoj za R367"
print("README posodobljen: 5229/332 + R368 bullet na pravem mestu")
