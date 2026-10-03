#!/usr/bin/env python3
# r384-readme-update.py — R384 fail-closed README posodobitev (kanon
# r383-readme-update): števci 5558/361 → 5567/363 (+9 testov, +2 datoteki:
# r384-stil-val62 ×6 + r384-sorojenci-par ×3) + R384 bullet (R383 bullet ostaja).
import pathlib
import sys

RD = pathlib.Path("/home/z/my-project/README.md")
src = RD.read_text(encoding="utf-8")

STARO_STEV = "| Testi (vitest) | **5558** (361 datotek, vključno z globalSetup embedded PG) |"
NOVO_STEV = "| Testi (vitest) | **5567** (363 datotek, vključno z globalSetup embedded PG) |"
if src.count(STARO_STEV) != 1:
    sys.exit("FAILOVEDANO: števec vrstica ×" + str(src.count(STARO_STEV)) + " ≠ ×1")

R383_ZAC = "- **A/offset + C/border-pariteta zaključek val 61 (168 × INS, dvostopenjsko) + FEATURE era-clone COMPANION (ruta-mapa avtomatsko) + REGISTER EVOLUCIJA (4.+5. uporaba)**"
if src.count(R383_ZAC) != 1:
    sys.exit("FAILOVEDANO: R383 bullet sidro ×" + str(src.count(R383_ZAC)) + " ≠ ×1")

R384_BULLET = """- **RED/40 border-pariteta val 62 (16 × INS s dark PAR v enem koraku) + FEATURE PAR-sorojenci čuvaj (trajen živ test) + LEKCIJA R384 (1) era-clone spec-list** (R384): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 383`: **ZELEN ob poskusu 1** (18. runda) + **SEDEMINTRIDESIJNA era preverba** `r384-era-harvest.sh` [37 registrov r347–r383, ≥151 = vsota iz diska; generiran prek era-clone.py --src-round 383 --dst-round 384 --dst-label "R383 val 61" --dst-chain-seg "IN r382.tsv ×5 IN r383.tsv val 61 ×4 na" + VSEH 12 server-probe spec-ov (11 + nov AK|/api/sync|401); COMPANION r384-era-ruta-map.py avtomatsko]: **EXIT=0 ×2** — **151/151 ŽIVO = 127 direktno + 6 hash + 18 server resolucij**; ⭐ **LEKCIJA R384 (1): era-clone --server-probe MENJA spec list, NE dopolnjuje** — prvotni tek z 1 specom EXIT=2 (18 server needlejev brez pokritih registrakov), popravek z VSEH 12 + fail-closed rm+regeneracija; (2) **val 61 POST-deploy spot** `r384-qa-spot.sh` (mounted + className LOČENO; ZERO-MUTACIJA): calculator izvoz zgodovine **11/11 tokenov MONTIRANO** (vrata: net-zero localStorage semena 'roksal_calc_history' — original obnovljen) + sessions 'Zapri' **6/6 + Escape → 0**; ekipa **iskreno 0** (canRead gate: /api/users HTTP 403 — programatsko dokumentirano) + material **iskreno 0** ('Izberi projekt' — spot račun 0 projektov, kanon r277); kolektor **0**; LEKCIJA: more-tab dispatch zahteva `{"tab":"more","more":"ekipa"}` (tiho brez učinka sicer); (3) **MANDATORY STIL val 62** — disk resnica `r384-triaza.py` [16 tarč z VIDLJIVIM borderjem (border-roksal-red/N override na Button outline ALI eksplicitni border), vseh 16 z O2; 9 N/A iskreno izključenih; 0 anomalij] → **16 × INS ' focus-visible:border-roksal-red/40 dark:focus-visible:border-roksal-red/50' TIK ZA O2 na 9 datotekah, in-place** — **LEKCIJA R383 (2) v apply: PAR v ENEM koraku** (dark /50 po precedensu team L619 — rdeča ostane rdeča, NI ink); `r384-val62-apply.py` fail-closed; ⭐ LEKCIJE: dark: token VSEBUJE light podniz → closure števec rabi `(?<!dark:)`; idempotenca je MED-vrstična (vstavljanje pred končnim navedkom); needle-survival fallback MORA pokrivati .ts server rute (20 API needlejev lažno mrtvih nad .tsx-only); pre-skan `r383-window-scan.py delta 75 'focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'` [eksaktna pozicija] = 0 preozkih + 0 mrtvih → **0 PIN SHIFT** (potrjeno tek 1 GREEN); `r384-stil-val62.test.ts` **×6 ZELENO** [(A) vzorci FB+dark TIK ZA O2, (B) dark PAR 16/16, (C) N/A 9 bajtno, (D) ostanek 0 + in-place, (E) obrnjena regresija navy 159+159 + red KANON ×25 + top-bar 3+2, (F) bordered-brez-FB 0 + NASLEDNICA ŽIVO]; (4) **FEATURE PAR-sorojenci čuvaj** (kandidat 3; LEKCIJA R382 (2) kot ŽIV test): `r384-triaza.py` sorojenska detekcija + `r384-sorojenci-par.test.ts` **×3 ZELENO** [FB uniformost znotraj bajtnih PAR skupin čez VSE roksal; top-bar meni 3 navy + 2 red vsi brez FB = uniformno; red-red dvojčka dashboard L1914↔L2059 oba parirana]; (5) e2e-lib dedup 19. val ISKRENO IZPUŠČEN (kanon R368). REGISTER `scripts/qa-needles/r384.tsv` [4 need_static: dashboard L1914 ×2 dvojček, sessions L316, measurements L5679, vodja L2122; 0 v HEAD d1cb4d2; TODO-R384; NF=2] prek `r384-register-write.py` fail-closed. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5567/5567 (363) FULL GREEN TEK 1** · build svež rm -rf .next EXIT=0 · qa-round.sh 384 needles EXIT=0 [Z-STRUCT 5/0; UNION r340–r384 + veriga] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA] · r384-era-harvest EXIT=0 ×2 · r383-window-scan EXIT=0 · r359-prod-qa-retry 383 ZELEN poskus 1 · leak-check čist. NOVO: scripts/qa-needles/r384.tsv + skripte [r384-era-harvest.sh (37th), r384-era-ruta-map.py (COMPANION), r384-qa-spot.sh, r384-triaza.py, r384-val62-apply.py, r384-register-write.py, r384-readme-update.py, r384-worklog-append.py, r384-commit-msg.txt] + r384-stil-val62.test.ts [×6] + r384-sorojenci-par.test.ts [×3]; UREJENO: 9 render datotek [val 62 INS ×16], README. Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 62 = render plast a11y className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme [ZERO-MUTACIJA E2E]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (81. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R385 prva naloga = qa-round.sh 384 prod-qa re-run [prek r359-prod-qa-retry.sh 384] + osemintrideseta era preverba r347–r384 [38 registrov, ≥155 = 151 + 4; prek era-clone.py --src-round 384 --expected-total 155 --dst-label "R384 val 62" + VSEH 12 spec-ov IZRECNO — LEKCIJA R384 (1)]; pričakuj 155/155 ŽIVO [r384 4 needleji razrešeni ob TEM pushu] + val 62 POST-deploy verifikacija [4 needleji r384.tsv; mounted + className LOČENO]. R385 kandidati: 1. amber/50 border-pariteta [isti vzorec; sveža triaža; dark PAR že v apply]; 2. r166 dark guard GENERALIZACIJA [navy-only → vsi barvni FB pari]; 3. e2e-lib dedup 19. val [po kanonu]. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
"""

src = src.replace(STARO_STEV, NOVO_STEV, 1)
src = src.replace(R383_ZAC, R384_BULLET + R383_ZAC, 1)

RD.write_text(src, encoding="utf-8")

out = RD.read_text(encoding="utf-8")
if out.count(NOVO_STEV) != 1 or out.count("5558** (361") != 0:
    sys.exit("FAILOVEDANO: PO števec preverba")
if out.count("R385 prva naloga =") != 1 or out.count(R384_BULLET[:60]) != 1:
    sys.exit("FAILOVEDANO: PO bullet preverba")
print("OK: README 5558/361 → 5567/363 + R384 bullet (R383 bullet ohranjen)")
