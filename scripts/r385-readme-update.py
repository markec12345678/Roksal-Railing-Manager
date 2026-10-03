#!/usr/bin/env python3
# r385-readme-update.py — R385 fail-closed README posodobitev (kanon
# r384-readme-update.py): števec testov 5567/363 → 5578/365 [= R384 baza
# 5567/363 + mojih +11/+2: r385-stil-val63.test.ts ×6 +
# r385-fb-dark-generalizacija.test.ts ×5] + NOV R385 bullet NAD R384
# bulletom (njegov bullet ohranjen — zgodovina dobesedno). Fail-closed:
# vsaka pričakovana vsebina preverjena bajtno PRED zapisom; niti 0 novih.
import pathlib
import sys

README = pathlib.Path("/home/z/my-project/README.md")

STARI_STEVEC = "| Testi (vitest) | **5567** (363 datotek, vključno z globalSetup embedded PG) |"
NOVI_STEVEC = "| Testi (vitest) | **5578** (365 datotek, vključno z globalSetup embedded PG) |"

R384_GLAVA = "- **RED/40 border-pariteta val 62 (16 × INS s dark PAR v enem koraku) + FEATURE PAR-sorojenci čuvaj (trajen živ test) + LEKCIJA R384 (1) era-clone spec-list** (R384):"

R385_BULLET = """- **AMBER/50 border-pariteta val 63 (15 × INS s dark PAR v enem koraku) + FEATURE r166 dark stražar GENERALIZACIJA (vsi barvni FB pari) + val 62 POST-deploy 41/41 MONTIRANO** (R385): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 384`: **ZELEN ob poskusu 2** (19. runda; poskus 1 = znana transient kategorija R358/R359, retry wrapper po kanonu) + **OSEMINTRIDESIJNA era preverba** `r385-era-harvest.sh` [38 registrov r347–r384, ≥155 = 151 + 4; generiran prek era-clone.py --src-round 384 --expected-total 155 + **VSEH 12 server-probe spec-ov IZRECNO — LEKCIJA R384 (1)**; COMPANION r385-era-ruta-map.py avtomatsko]: **EXIT=0 ×2** (determinizem) — **155/155 ŽIVO** (direktno + hash + 18 server resolucij); must_miss ×38 čisto; (2) **val 62 POST-deploy spot** `r385-qa-spot.sh` (spot-r167/25; ZERO-MUTACIJA — NIČ klikov na revoke/odjavo/preklic): sessions-dialog 'Prekliči sejo na napravi' **41/41 MONTIRANO** (15 tokenov LOČENO — FB 41/41 + dark 41/41; Escape → 0); dashboard 'Poskusi znova' **iskreno 0** (invError/narocilaError zahtevata padel fetch — ZERO-MUTACIJA: napak ni iskreno sprožiti; needle ŽIVO v buildu = era need_static) + measurements **iskreno 0** (osnutki per-projekt localStorage; spot račun 0 projektov — kanon r277; semena brez projectId NE možna: draftsKey fail-closed) + vodja 'Zamujena dobava' **iskreno 0** (DB resnica; 0 projektov); sonde navy 4/4/0 + red 0; kolektor **0**; (3) **MANDATORY STIL val 63** — disk resnica `r385-triaza.py` [15 tarč z VIDLJIVIM borderjem = 14 border-class (vodja ×13 border-roksal-navy/25 + hover:border-roksal-amber; photo L740 nativni) + 1 outline-variant (inclinometer L539), vseh 15 z O2; 3 N/A iskreno izključeni (inclinometer L433, inventory L1229, photo L1162); **8 IZVEN obsega** — amber/40 + amber/60 pod-družini dokumentirani za prihodnja vala (kanon ena-intenziveta-na-val); 0 anomalij] → **15 × INS ' focus-visible:border-roksal-amber/50 dark:focus-visible:border-roksal-amber/30' TIK ZA O2 na 3 datotekah, in-place** — LEKCIJA R383 (2) v apply: PAR v ENEM koraku; **dark /30 po ISTEM pravilu kot rdeča val 62: sledi družinskemu obstoječemu light+dark border paru z ISTO light intenziveto — audit-trail L53 'border-roksal-amber/50 dark:border-roksal-amber/30'** (amber ostane amber — barva je pomen, NI ink); `r385-val63-apply.py` fail-closed [negativni lookbehind — LEKCIJA R384 (2); mid-line idempotenca — LEKCIJA R384 (3); ponovni tek = 0 INS dokazan]; pre-skan `r383-window-scan.py delta 79 'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2'` = 304 regexov 0 preozkih + 164 pinov 0 mrtvih + 133 slice-oknen + 0 odstopanj → **0 PIN SHIFT**; `r385-stil-val63.test.ts` **×6 ZELENO** [(A) vzorci FB+dark TIK ZA O2, (B) dark PAR 15/15, (C) N/A 3 bajtno, (D) ostanek 0 + in-place 2199/2684/599, (E) izven-obsega 8 + regresija red 16/16 navy 159/159, (F) bordered-brez-FB 0 + NASLEDNICA ŽIVO]; (4) **FEATURE r166 dark stražar GENERALIZACIJA** (kandidat 2): `r385-fb-dark-generalizacija.test.ts` **×5 ZELENO** [per-družina: vsaka vrstica z light FB žetonom nosi dark par NA ISTI vrstici (navy→ink/40, red→red/50, amber→amber/30) + globalna pariteta števcev **159/16/15** light==dark + obrnjena regresija brez sirot]; (5) e2e-lib dedup 19. val ISKRENO IZPUŠČEN (kanon R368 — ni novih ×3 ponovitev). REGISTER `scripts/qa-needles/r385.tsv` [4 need_static: vodja L1213 ×4 (sorojenci kanon), vodja L1475 ×9 (h-6 izvozi), photo L740, inclinometer L539; 0 v HEAD c235e90; TODO-R385] prek `r385-register-write.py` fail-closed. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5578/5578 (365) FULL GREEN** · build svež rm -rf .next EXIT=0 · qa-round.sh 385 needles EXIT=0 [r385.tsv 4 ŽIVO + TODO-R385 odsoten; UNION r340–r385 + veriga] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post — ZERO-MUTACIJA] · r385-era-harvest EXIT=0 ×2 · r383-window-scan EXIT=0 · r359-prod-qa-retry 384 ZELEN poskus 2 · leak-check čist. NOVO: scripts/qa-needles/r385.tsv + skripte [r385-era-harvest.sh (38th), r385-era-ruta-map.py (COMPANION), r385-qa-spot.sh, r385-triaza.py, r385-val63-apply.py, r385-register-write.py, r385-readme-update.py, r385-worklog-append.py, r385-commit-msg.txt] + r385-stil-val63.test.ts [×6] + r385-fb-dark-generalizacija.test.ts [×5]; UREJENO: 3 render datotek [val 63 INS ×15: vodja-dashboard, photo-tab, inclinometer-tab], README. Kontrakt NIČ (/api/sync); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 63 = render plast a11y className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme [ZERO-MUTACIJA E2E]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (81. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R386 prva naloga = qa-round.sh 385 prod-qa re-run [prek r359-prod-qa-retry.sh 385] + devetintrideseta era preverba r347–r385 [39 registrov, ≥159 = 155 + 4; prek era-clone.py --src-round 385 --expected-total 159 + VSEH 12 spec-ov IZRECNO — LEKCIJA R384 (1)]; pričakuj 159/159 ŽIVO [r385 4 needleji razrešeni ob TEM pushu] + val 63 POST-deploy verifikacija [4 needleji r385.tsv; mounted + className LOČENO; NIČ klikov na revoke/odjavo]. R386 kandidati: 1. amber/40 border-pariteta [pod-družina izven obsega val 63: dashboard L1946, measurements L3478, vodja L2093 — sveža triaža obvezna]; 2. amber/60 border-pariteta [notification L748, photo L2113/L2414 — ring par svetlo/temno že obstaja na L748]; 3. e2e-lib dedup 20. val [po kanonu]. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
"""


def main() -> None:
    src = README.read_text(encoding="utf-8")
    if NOVI_STEVEC in src:
        sys.exit("FAILOVEDANO: nov števec ŽE v README (idempotenca)")
    if src.count(STARI_STEVEC) != 1:
        sys.exit(f"FAILOVEDANO: stari števec = {src.count(STARI_STEVEC)} (pričakovano 1)")
    if src.count(R384_GLAVA) != 1:
        sys.exit(f"FAILOVEDANO: R384 glava = {src.count(R384_GLAVA)} (pričakovano 1)")
    out = src.replace(STARI_STEVEC, NOVI_STEVEC, 1)
    out = out.replace(R384_GLAVA, R385_BULLET + R384_GLAVA, 1)
    README.write_text(out, encoding="utf-8")
    print("OK: README — števec 5567/363 → 5578/365 + R385 bullet nad R384 (zgodovina ohranjena)")


if __name__ == "__main__":
    main()
