#!/usr/bin/env python3
# r369-readme-update.py — R369 README disk resnica:
#  (1) števec 5229 (332 datotek) → 5234 (333 datotek);
#  (2) R369 bullet VSTAVLJEN kot CELOTO PRED val 44 sidro
#      (LEKCIJA R366 (3) / R367 (3) / R368: nikoli old_str=predhodna
#      glava); po vstavitvi preverba vrstnega reda 45→…→51→52→44
#      (val 44 zgodovinski append na koncu — disk resnica R368 (5)).
import pathlib, re

p = pathlib.Path("README.md")
src = p.read_text(encoding="utf-8")

# (1) števec — ena sama zamenjava v tabeli zmogljivosti
stari = "| Testi (vitest) | **5229** (332 datotek, vključno z globalSetup embedded PG) |"
novo = "| Testi (vitest) | **5234** (333 datotek, vključno z globalSetup embedded PG) |"
assert src.count(stari) == 1, f"števec vrstica: {src.count(stari)} pojavitev (pričakovano 1)"
src = src.replace(stari, novo)

# (2) R369 bullet — vstavi PRED val 44 sidro (kanon python vstavljanja)
sidro = "- **Ring pariteta val 44 + e2e-lib dedup 1. val** (R361): (1) **prva naloga**"
assert src.count(sidro) == 1, f"sidro: {src.count(sidro)} pojavitev (pričakovano 1)"
bullet = """- **Ring pariteta val 52 + e2e-lib dedup 9. val** (R369): (1) **prva naloga**
  — prod-qa re-run prek kanona `r359-prod-qa-retry.sh 368`: **ZELEN ob
  poskusu 1 FOREGROUND** (2 skuska detachanega nohup teka je ubilo
  okolje — proces kill, NI skriptnega faila; iskreno poročano) + **DVAINDVJSETIJNA
  era preverba** `r369-era-harvest.sh` EXIT=0 ob 1. teku: 22 registrov
  r347–r368 (≥93 need_static = 89 + 4), **R368 val 51 vsi 4 ŽIVO DIREKTNO**
  (chunk_045/chunk_014/chunk_026/chunk_018) → val 51 deploy potrjen v
  celoti; 2 R353 needleja prek hash rezolucije (a0911d4a… + 1085983b…,
  HTTP 200); must_miss ×22 čisto; era kontrole R340/R341/R343/R345 ŽIV;
  (2) **val 51 POST-deploy verifikacija** (spot-r167/14, mounted +
  className LOČENO): **12 MONTIRANIH amber površin z offset-2** —
  inclinometer 'Vklopi libelo' ×1 (permission idle), obvestilne kartice
  **×10** (Sheet odprt — demo NI prazen; L748 amber/60), viz ročaj ×1
  (demo način); pogojne iskreno NEmontirane z vrati iz vira (photo
  kategorija/debelina/orodja — 'Ni fotografij'; measurements amber/40 ×0
  — mera foto/cenovni kontekst); top-bar iskalnik white/60 + offset-0 =
  dokumentirana gosta površina ŽIVO; navy pariteta 27/27 offset-2
  (BrezOffset 0); 1. uporaba eb_sonda_red_stetje (rdeči 0/0/0 — iskrena
  praznina); kolektor 0 errorjev; (3) **MANDATORY STIL val 52** — ring
  OBLIKOVNA pariteta navy+ink PARIŠKIH vrstic (svetlo+temno dvojčki na
  ISTIH elementih; per-barvni census iz diska prek `scripts/r369-census.py`:
  roksal-ink/40 ×12 = VSI dark: dvojčki navy/40 brez offseta → **12 × EN
  focus-visible:ring-offset-2 TIK ZA navy/40** — tema-neodvisen žeton
  pokrije obe varianti ISTEGA elementa; termini-card ×6, bottom-nav ×2,
  notification-center ×3, quick-actions-fab ×1); census po: ink/40 =
  {'O2': 12} razcep = 0, navy gap 77→65 (točno 12 parov; ostali navy rep =
  val 53+ kandidat); **2 namerni izjemi dokumentirani** — ui/* kit
  ring/50 ×14 (shadcn ring-[3px] fokus jezik) + top-bar white/60
  offset-0 ×3 (gosta površina); in-place 0 novih vrstic; 0 novih hex
  (4/0); aria/title ZAMRZNJENI; **stale-pini: 1 SHIFTAN** — r167 okenski
  kvantifikator {0,400}→{0,430} z žigom [PIN SHIFT R369 val 52] (okno
  380→408; PRED-skan sosledja ga NI ulovil — ulov ga je FULL vitest;
  LEKCIJA: pre-skan mora enumerirati VSE okenske kvantifikatorje); r167
  sosledja ink preživita, r214 2/2, r268/r361 izven tarče; (4) **FEATURE
  e2e-lib dedup 9. val** — NOV pomočnik `eb_sonda_red_stetje` (rdeči trio
  byte-identičen ×2 v r368-qa-spot A/C — per-blok md5 03c8497d…; skrajšani
  par ×3 — md5 640fec6d…, prag R352 IZENAČEN; kanon = POLNI trio 3-poljni
  eval, B-okrnjena oblika se ne kanonizira; regex /ring-red-\\d+\\// = INLINE
  resnica heterogenih rdečih žetonov) s porabo ob 1. uporabi v
  `r369-qa-spot.sh` V ISTI rundi (zamrznjeni NI mutirani). VERIFIKACIJA
  (na KONČNI viri): tsc 0 · eslint 0 (FULL) · vitest **5234/5234 (333)** =
  R368 baza 5229/332 + mojih +5/+1 − 0 [tek 1: 1 fail = r167 okenski pin
  (zgoraj) → shift V ISTI RUNDI; tek 2 zeleno] · build svež EXIT=0 ·
  `qa-round.sh 369 needles` VSE OK [4 need_static ŽIVO + TODO-R369
  odsoten; veriga + union registri r340–r369] · smoke EXIT=0 · e2e EXIT=0
  [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 —
  ZERO-MUTACIJA] · leak-check čist. NOVO: scripts/qa-needles/r369.tsv [4
  need_static ×10/×1/×1/×1 pojavitve grep -o, vsi ×0 v HEAD 686c379
  fetch-first git grep GLASNO potrjeno; izpuščen kandidat 'navy/40
  offset-2 disabled:' NI ×0 (inclinometer starejša era); must_miss;
  python validacija NF=3] + README disk resnica [5234/333 + R369 bullet].
"""
src = src.replace(sidro, bullet + sidro)
p.write_text(src, encoding="utf-8")

# preverba vrstnega reda (disk resnica: val 44 bullet NA KONCU)
red = re.findall(r"^- \*\*Ring pariteta val (\d+)", src, re.M)
print("Ring pariteta val vrstni red:", red)
assert red == ['45', '46', '47', '48', '49', '50', '51', '52', '44'], red
assert red.index('52') == red.index('51') + 1, "R369 ni takoj za R368"
print("README posodobljen: 5234/333 + R369 bullet na pravem mestu")
