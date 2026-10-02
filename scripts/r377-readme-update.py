#!/usr/bin/env python3
# r377-readme-update.py — R377 README disk resnica: števec 5357/345 →
# 5363/346 + R377 bullet kot CELOTO PRED val 44 sidrom (R361 bullet —
# kanon r361+; njihov R376 BOM bullet ŽE prisoten = žig). Fail-closed:
# stare žige obvezni PRED, novi ŽIGI obvezni PO.
import pathlib, sys

R = pathlib.Path("/home/z/my-project/README.md")
src = R.read_text(encoding="utf-8")

STAR_STEVEC = "| Testi (vitest) | **5357** (345 datotek, vključno z globalSetup embedded PG) |"
NOV_STEVEC = "| Testi (vitest) | **5363** (346 datotek, vključno z globalSetup embedded PG) |"
SIDRO = "- **Ring pariteta val 44 + e2e-lib dedup 1. val** (R361): (1) **prva naloga**"
R376_ZIG = "- **Issue #13, korak R166 — KANONIČNI BOM: BOM/BOMVersion/BOMLine + EXACT inventarna vezava + procurement agregacija (§5/§6/§11 +"

if src.count(STAR_STEVEC) != 1:
    sys.exit("FAILOVEDANO: star števec ≠ ×1")
if src.count(SIDRO) != 1:
    sys.exit("FAILOVEDANO: R361 sidro bullet ≠ ×1")
if src.count(R376_ZIG) != 1:
    sys.exit("FAILOVEDANO: njihov R376 BOM bullet žig ≠ ×1")

BULLET = """- **Transition-colors skladnost val 58 + FEATURE era-clone.py --server-probe (6./7. generalizacija era verige) + REGISTER EVOLUCIJA kanon — KOLIZIJA #19** (R377): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 375`: **ZELEN ob poskusu 1**
  (14. runda zapored) + **DEVETINDVJSETIJNA era preverba** `r376-era-harvest.sh`
  [29 registrov r347–r375, ≥121 need_static = 117 + 4, vsota iz diska;
  generiran prek ŽIVEGA orodja `era-clone.py`]: **EXIT=0 ob 1. teku** — 114
  needlejev ŽIVO DIREKTNO + 7 rezolucij ŽIVO [3 hash starejši navy + 3 hash
  r374 client (aee01236 HTTP 200) + **1 SERVER** r374 price-book: needle v
  `.next/server/chunks/_8b39314d._.js` + prod `/api/price-book` HTTP 401
  fail-closed deterministično] — **PRVI EXIT=0 od mešanega r374 registra**
  (r375-era-harvest je bil iskreno EXIT=2); ⭐ **val 57 vsi 4 needleji ŽIVO
  DIREKTNO** (chunk_026 ×4) → val 57 deploy potrjen v celoti; must_miss ×29
  čisto. **val 57 POST-deploy verifikacija** (`r377-qa-spot.sh`
  spot-r167/21; mounted + className LOČENO, dispatch+poll VSAKA, kolektor 0
  errorjev): **N2 'Naloži predlogo meritev' MONTIRANA 5, border-pariteta
  5/5 — ŽIVO DOM dokaz** (predloge niso projekt-gated — disabled=!
  selectedProject a montirane); N1/N3/N4 iskreno NEmontirane z razlogom iz
  diska (vrata: meritve/segmenti projekta — demo 'Ni projektov' testid
  meritve-brez-projektov, kanon r277); navy sonda measurements 27/27
  BrezOffset=0. (2) **MANDATORY STIL val 58 — transition-colors SKLADNOST**:
  disk resnica census [edini gap = nativni <button> 'Počisti iskanje
  projektov' dashboard L1628; KIT <Button> nosi transition-all iz ui/button
  baze; <Input> lastni fokus jezik izjema #2; amber/red bordered ×2 = <span
  cursor-help> chipi — NE fokusabilni, border-pariteta N/A → iskreno
  izpuščeno]: 1 × INS ' transition-colors' PRED 'focus-visible:ring-2'
  (kanon measurements L4754/L4768 precedens; +18 znakov, in-place 0 novih
  vrstic 3189; transition-colors števec 11→12; md5 prijet 37c9e224…);
  `r377-val58-apply.py` fail-closed [1. tek ujel lastno hroščo: replace samo
  na ring-2 bi podvajal ring rep — delta 80 ≠ 18, abort PRED zapisom];
  window-scan delta pre-skan 65 okenskih regexov = 0 preozkih. (3) **FEATURE
  era-clone.py --server-probe — 6./7. korak generalizacije**: (a) labeli
  regex vidi TUDI poslovne runde brez val številke — PRED: FAILOVEDANO
  'zadnji register R373 ≠ R374'; (b) SERVER-NEEDLE razširitev (LEKCIJA R375
  (6) zaprta z orodjem): needle v lokalnem .next/server (kompilirani čanek,
  .map izključen) + determinističen vedenjski probe lastniške rute na produ
  (fail-closed status); (c) **7. korak: --server-probe PONOVLJIV** [veriženje
  harvestov s probe + več mešanih registerjev: r374 price-book + r376 BOM
  rute /api/bom + /api/bom/procurement]; orodje ujelo lastne napačne POST
  števce V ISTI rundi — POST kanon deluje. **TRIDESIJNA era preverba**
  `r377-era-harvest.sh` [30 registrov r347–r376, ≥125 = 121 + 4, vsota iz
  diska]: EXIT=2 = **iskreno deploy-pending stanje** [124/125 ŽIVO: 113
  direktno + 6 hash + **5 SERVER ŽIVO** [r374 price-book + njihovi 4 BOM
  needleji prek /api/bom + /api/bom/procurement HTTP 401]; 1 MISS =
  r371 NASLEDNICA needle [lokalni čanek 8895ee21 ŽIVO, prod HTTP 404 —
  razreši se SAMO ob TEM pushu; lokalno ŽIVO, logično zagotovljeno];
  must_miss ×30 čisto]. (4) **REGISTER EVOLUCIJA kanon (nov)**: FULL vitest
  tek 1 ujel r371 N3 era diskriminator — val 58 je evoluirala ISTO vrstico,
  ki jo je val 54 prijel [dvojni zadetek: test pin + zamrznjena r371.tsv
  vrstica]; mehanizem: stara vrstica KOMENTIRANA dobesedno ('EVOLVED R377'
  žig) + NASLEDNICA need_static vrstica — need_static števec r371 = 4
  NESPREMENJEN (era vsote veljavne); r371 test PIN SHIFT z žigom. (5)
  e2e-lib dedup 15. val ISKRENO IZPUŠČEN [kanon R368]. VERIFIKACIJA: vitest
  5363/5363 (346) [FULL zeleno] · tsc 0 · eslint 0 (FULL) · build svež
  EXIT=0 [prisma generate po njihovi shemi — stale client TS2339 bOMVersion]
  · qa-round.sh 377 needles VSE OK [r377.tsv ŽIVO + TODO-R377 odsoten] ·
  smoke EXIT=0 · e2e EXIT=0 [ZERO-MUTACIJA] · leak-check čist.
"""
src = src.replace(STAR_STEVEC, NOV_STEVEC, 1)
src = src.replace(SIDRO, BULLET + SIDRO, 1)

out = src
if out.count(NOV_STEVEC) != 1:
    sys.exit("FAILOVEDANO: nov števec ≠ ×1 PO")
if out.count(BULLET) != 1:
    sys.exit("FAILOVEDANO: nov bullet ≠ ×1 PO")
if out.count(R376_ZIG) != 1:
    sys.exit("FAILOVEDANO: njihov R376 bullet izginil PO")
R.write_text(out, encoding="utf-8")
print("OK: README 5357/345 → 5363/346 + R377 bullet pred val 44 sidrom")
