#!/usr/bin/env python3
# r384-worklog-append.py — R384 fail-closed append v worklog.md (EN vnos:
# R384; guard = rep R383 vnosa z GLASNO prefix preverbo '- R384 kandidati: 1.').
import sys
import pathlib

W = pathlib.Path("/home/z/my-project/worklog.md")

src = W.read_text(encoding="utf-8")
vrstice = [l for l in src.splitlines() if l.strip()]
GUARD = vrstice[-1] if vrstice else ""
if not GUARD.startswith("- R384 kandidati: 1."):
    sys.exit(f"FAILOVEDANO: zadnja vrstica NI rep R383: {GUARD[:80]!r}")
if src.count(GUARD) != 1:
    sys.exit(f"FAILOVEDANO: guard ×{src.count(GUARD)} ≠ 1")
if not src.rstrip("\n").endswith(GUARD):
    sys.exit("FAILOVEDANO: guard NI na koncu — abort")

VNOS = """---
Task ID: R384
Agent: Super Z (AI runda, Job 413422, tick 202610030815)
Task: R384 — prva naloga (prod-qa re-run 383 + SEDEMINTRIDESIJNA era preverba r347–r383 + val 61 POST-deploy verifikacija) + MANDATORY STIL val 62 (RED/40 border-pariteta, 16 × INS s dark PAR v enem koraku) + FEATURE PAR-sorojenci čuvaj (kandidat 3) + worklog + push

Work Log:
- START: fetch-first origin/main == HEAD d1cb4d2 (R383) — KOLIZIJA: NI ob startu; delovno drevo čisto; worklog R383 vnos = handover (prebran). ADOPCIJA ni bila potrebna.
- PRVA NALOGA (A): prod-qa re-run prek `r359-prod-qa-retry.sh 383` — **ZELEN ob poskusu 1** (18. runda).
- PRVA NALOGA (B): **SEDEMINTRIDESIJNA era preverba** (37.) `r384-era-harvest.sh` [37 registrov r347–r383, ≥151 = 147 + 4, vsota IZ DISKA; generiran prek era-clone.py --src-round 383 --dst-round 384 --dst-label "R383 val 61" --dst-chain-seg "IN r382.tsv ×5 IN r383.tsv val 61 ×4 na" + **VSEH 12 server-probe spec-ov** (11 prejšnjih + nov AK|/api/sync|401)]; **EXIT=0 ×2** (determinizem) — **151/151 ŽIVO = 127 direktno + 6 hash + 18 server resolucij**; must_miss ×37 čisto.
- ⭐ **LEKCIJA R384 (1) — era-clone --server-probe MENJA spec list, NE dopolnjuje**: prvotna generacija z ENIM specom (AK|/api/sync|401) je tekla **EXIT=2** [24 MISS → 18 server needlejev NI razrešenih — njihovi registri (AB/AD/AF/AH/AJ) NISO bili pokriti; 2b/2c teka sta bila SAMA zdrava, konfiguracija ne]; popravek = VSEH 12 spec-ov izrecno (kanon: popoln spec seznam vsakič) + fail-closed prepis (rm + regeneracija — era-clone nikoli ne prepisuje, 'izhod ŽE obstaja' abort); determinizem potrd ×2 EXIT=0. KOMPANION `r384-era-ruta-map.py` nastal samodejno (R383 feature deluje).
- PRVA NALOGA (C): **val 61 POST-deploy spot** `r384-qa-spot.sh` (spot-r167/24; mounted + className LOČENO; ZERO-MUTACIJA — NIČ klikov na odjavo/preklic; dialog zaprt z Escape NE 'Zapri'): (B) calculator 'Izvozi zgodovino izračunov' — vrata prek **net-zero localStorage semena** 'roksal_calc_history' [HistoryEntry oblika iz calculator/shared.ts; original shranjen → semena → reload → preverba → obnovitev] → **11/11 tokenov MONTIRANO na produ** (h-7/px-2/text-2xs/text-roksal-ink/hover:text-roksal-ink/hover:bg-roksal-navy/5/ring-2/navy/40/O2/FB navy/dark FB ink — vsi LOČENO per className split); (C) top-bar user meni (kanon r186 pointerdown+click) → 'Aktivne seje' → **Zapri outline 6/6 tokenov** + Escape → dialogi 0; (A) ekipa PDF izvoz **iskreno 0** — canRead gate: QA seja /api/users **HTTP 403** (programatsko dokumentirano V frozen skripti; needle ŽIVO v buildu + src — mounted dokaz brez mutacije dovoljenj NE izvedljiv); (D) material chipCls pilule **iskreno 0** — prazno stanje 'Izberi projekt' (spot račun 0 projektov, kanon r277); sonde navy 2/2/0 + red 0 (prejšnja seja) + kolektor **0**; eb_zapri_vodic iskren warning (nehidriran wrapper — v2 kanon).
- ⭐ LEKCIJA (pre-skan vrata): more-tab dispatch zahteva `{"tab":"more","more":"ekipa"}` — handler preverja `tab === 'more' && more` (page.tsx centralNavigate); `{"tab":"ekipa"}` je tiho brez učinka (MAIN_TAB_IDS guard) → prvi dve spot teki A/D inconclusive 0; popravek + disk resnica dokazana.
- MANDATORY STIL **val 62 — RED/40 BORDER-PARITETA** (rdeča simetrija po navy zaključku val 61; kanon R384 handover kandidat 1): disk resnica `r384-triaza.py` [**16 tarč z VIDLJIVIM borderjem** — vse z border-roksal-red/N barvnim overrideom na <Button variant="outline"> ALI eksplicitnim borderom na nativnem gumbu/kartici (dashboard ×6, invoice ×2, sessions ×2, floor-plan/inventory/measurements/roksal-catalog/termini/vodja ×1); vseh 16 z O2 (val 59 pairing že ŽIV); **9 N/A iskreno izključenih** (top-bar ×2, photo, material, notification, measurements ×2, quote-followup, sistem-zdravje — brez borderja in brez sorojenca z FB); 0 anomalij] → **16 × INS ' focus-visible:border-roksal-red/40 dark:focus-visible:border-roksal-red/50' TIK ZA O2 na 9 datotekah, in-place 0 novih vrstic**; **LEKCIJA R383 (2) upoštevana V APPLY: PAR (light + dark) v ENEM koraku** — dark /50 po precedensu team-tab L619 'border-roksal-red/40 dark:border-roksal-red/50' (rdeča ostane rdeča v temni temi — ink je navy nevtralni sorojenec, NE rdeči); `r384-val62-apply.py` fail-closed [kontrakt EMBEDDED bajtno, per-vrstica točno 1 sidro, POST closure + in-place + needle-survival; idempotentna ponovna izvedba po POST abortu].
- ⭐ **LEKCIJA R384 (2) — dark: token VSEBUJE light podniz**: closure števec 'focus-visible:border-roksal-red/' ujame TUDI 'dark:focus-visible:border-roksal-red/' → FB=2 lažna kršitev na prvem POST teku; popravek: negative lookbehind `(?<!dark:)`. **LEKCIJA R384 (3) — idempotenca je MED-vrstična**: vstavljanje poteka PRED končnim navedkom (SIDRO je sredinski) → pričakovano že-parirano stanje = `pricakovano.replace(SIDRO, SIDRO+VSTAVEK)` NE `pricakovano + VSTAVEK`; + ponovni tek MORA izključiti že-parirane iz vstavljanja (sicer dvojni INS). **LEKCIJA R384 (4) — needle-survival fallback MORA pokrivati .ts server rute**: 20 API needlejev (r374/376/378/380/382) lažno 'mrtvih' nad .tsx-only preiskavo; popravek: rglob *.{ts,tsx} nad celotnim src/.
- PRE-SKAN (LEKCIJA R383 (3) — PRED apply, čez VSE tarče): `r383-window-scan.py delta 75 'focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'` [točna pozicija vstavljanja — daljši anchor token = eksaktna simulacija]: **304 okenskih regexov 0 preozkih + 164 needle pinov 0 mrtvih + 133 slice-oknen (vrstično-positional — in-place ne prestavi) + 0 vrstičnih odstopanj** → **0 PIN SHIFT potrebno** (potrjeno: FULL vitest tek 1 GREEN brez enega samega PIN SHIFT žiga).
- **FEATURE PAR-SOROJENCI ČUVAJ** (R384 handover kandidat 3; LEKCIJA R382 (2) kanon 'ISTI jezik čez kontekste' kot TRAJEN ŽIV test): `r384-triaza.py` vgrajena sorojenska detekcija [normalizacija barvnih tokenov navy/red/amber → {BARVA}; bajtni PAR čez barve znotraj datoteke] + **`r384-sorojenci-par.test.ts` ×3 ZELENO**: (A) FB uniformost znotraj bajtnih PAR skupin čez VSE roksal render datoteke [1 večbarvna skupina: top-bar meni 3 navy + 2 red — vsi brez FB = uniformno ✓], (B) top-bar skupina dokumentirana bajtno, (C) red-red dvojčka dashboard L1914↔L2059 bajtno enaka + OBÁ parirana (val 62) — kršitev uniformosti = glasna regresija.
- e2e-lib dedup 19. val ISKRENO IZPUŠČEN (kanon R368 — ni novih ×3 ponovitev).
- REGISTER `scripts/qa-needles/r384.tsv` [4 need_static: dashboard L1914 (×2 bajtni dvojček — sorojenec kanon), sessions-dialog L316 (/30 barvni override), measurements L5679 (nativni gumb + active:scale rep), vodja-dashboard L2122 (kartica); 0 v HEAD d1cb4d2; TODO-R384 must_miss; NF=2] prek `r384-register-write.py` fail-closed [TSV točno 3 polja, bajtno ŽIVO v src, 0-v-HEAD, need_static=4 usklajeno z era verigo].
- README: 5558/361 → **5567/363** [= R383 baza 5558/361 + mojih +9/+2] + R384 bullet (njihov R383 bullet ohranjen) prek `r384-readme-update.py` fail-closed.
- ⭐ LEKCIJA R384 (5) — triaža orodja ima lastne ptičke: r384-triaza.py sorojenski indeks normalizira TUDI red-red dvojčke (isti niz po normalizaciji) — 'SOROJENEC-BREZ-FB' med dvema rdečima = navaden dvojček, ne čezbarvni PAR; kontrakt jih pokrije OBÁ (parity ohranjena po apply).

Stage Summary:
- VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5567/5567 (363) FULL GREEN TEK 1** [= R383 baza 5558/361 + mojih +9/+2; 0 PIN SHIFT] · build svež rm -rf .next EXIT=0 · qa-round.sh 384 needles EXIT=0 [r384.tsv 4 ŽIVO + TODO-R384 odsoten; Z-STRUCT 5 vrstic pokvarjenih 0; UNION r340–r384 + veriga r339→…→R227 VSE ŽIVE] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · r384-era-harvest EXIT=0 ×2 [37th — 151/151 ŽIVO] · r383-window-scan EXIT=0 [DEL 1–4 vsi čisti] · r359-prod-qa-retry 383 ZELEN ob poskusu 1 · leak-check čist [ghp_[A-Za-z0-9]{30,} ×0 na HEAD].
- NOVO: scripts/qa-needles/r384.tsv + skripte [r384-era-harvest.sh (37th) + r384-era-ruta-map.py (COMPANION avtomatsko), r384-qa-spot.sh, r384-triaza.py (s sorojensko detekcijo), r384-val62-apply.py, r384-register-write.py, r384-readme-update.py, r384-worklog-append.py, r384-commit-msg.txt] + r384-stil-val62.test.ts [×6] + **r384-sorojenci-par.test.ts [×3 — FEATURE čuvaj]**; UREJENO: 9 render datotek [val 62 INS ×16], README.
- Kontrakt NIČ (/api/sync — probe je samo fail-closed 401 branje); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 62 = render plast a11y className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme [ZERO-MUTACIJA E2E].
- ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (81. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA.
- R385 prva naloga = qa-round.sh 384 prod-qa re-run [prek r359-prod-qa-retry.sh 384] + osemintrideseta era preverba r347–r384 [38 registrov, ≥155 = 151 + 4; prek era-clone.py --src-round 384 --expected-total 155 --dst-label "R384 val 62" + **VSEH 12 spec-ov IZRECNO** [LEKCIJA R384 (1)]; pričakuj 155/155 ŽIVO [r384 4 needleji razrešeni ob TEM pushu] + val 62 POST-deploy verifikacija [4 needleji r384.tsv; mounted + className LOČENO; NIČ klikov na odjavo/preklic].
- R385 kandidati: 1. amber/50 border-pariteta [isti vzorec kot val 62; sveža triaža obvezna — LEKCIJA R382 (1); dark PAR že v apply — LEKCIJA R383 (2)]; 2. r166 dark guard GENERALIZACIJA [navy-only → vsi barvni FB pari; val 62 je dokazal vzorec — dark par sedaj tudi za red]; 3. e2e-lib dedup 19. val [po kanonu]. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].
"""

VNOS = VNOS.rstrip("\n") + "\n"

if not src.endswith("\n"):
    src += "\n"
nov = src + VNOS
W.write_text(nov, encoding="utf-8")

pre = pathlib.Path("/home/z/my-project/worklog.md").read_text(encoding="utf-8")
if "Task ID: R384" not in pre or pre.count("Task ID: R384") != 1:
    sys.exit("FAILOVEDANO: PO preverba — R384 vnos ni edinstven")
if pre.count(GUARD) != 1:
    sys.exit("FAILOVEDANO: PO preverba — guard ni več unikaten")
print("OK: worklog R384 vnos pripet (guard R383 ohranjen, edinstven)")
