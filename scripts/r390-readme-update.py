#!/usr/bin/env python3
# r390-readme-update.py — R390 README posodobitev (fail-closed):
#   - števec testov 5628 (373) → 5647 (375) [= +19/+2: stil val 68 ×5 +
#     ŠESTI STRAŽAR ×14 (A+B+it.each ×10+D+E... 5 describe testov z it.each
#     ×10 = 14 testnih primerov)];
#   - nov R390 bullet PRED R389 bulletom (njegov bullet ohranjen bajtno).
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
README = REPO / "README.md"

STARA_VRSTICA = "| Testi (vitest) | **5628** (373 datotek, vključno z globalSetup embedded PG) |"
NOVA_VRSTICA = "| Testi (vitest) | **5647** (375 datotek, vključno z globalSetup embedded PG) |"

R389_ZACETEK = "- **LASTNA-PREHOD GLADKOST val 67"

R390_BULLET = (
    "- **PRESS-SCALE DVOJNI MEHANIZEM RESOLUCIJA val 68 (10 × REPL in-place — ko-obstoj custom `.press-scale:active` "
    "{transform: scale(.97)} in Tailwind v4 utility `active:scale-[0.96]` {scale: .96} na ISTEM elementu = MNOŽIČEN "
    "skrček 0.9312 — neodvisni CSS lastnosti!) + FEATURE ŠESTI STRAŽAR: press-scale disciplina GENERALIZACIJA "
    "(EN element = EN press mehanizem) + era orodje UTRJENO (idempotentno kloniranje utrjenih virov + KeyError "
    "popravek) + val 67 POST-deploy MONTIRANO + TRIINŠTIRIDESIJNA era preverba 173/173** (R390): (1) **prva naloga** "
    "— prod-qa re-run prek `r359-prod-qa-retry.sh 389`: **ZELEN ob poskusu 1** (24. runda) + **TRIINŠTIRIDESIJNA era "
    "preverba** `r390-era-harvest.sh` [43 registrov r347–r389, ≥173 = 171 + 2; generiran prek era-clone.py "
    "--src-round 389 --expected-total 173 + VSEH 12 server-probe spec-ov IZRECNO — LEKCIJA R384 (1); ERA_BESODE "
    "GLASNO na 43 — TRIINŠTIRIDESIJNA; COMPANION r390-era-ruta-map.py avtomatsko]: **EXIT=0 ×2** (determinizem, "
    "normirana loga identična) — **173/173 ŽIVO** [147 direktno + 8 hash + 18 server resolucij; val 67 deploy "
    "POTRJEN — 2 needleja r389 razrešena ob R389 pushu]; must_miss ×43 čisto; era kontrole R340/R341/R343/R345 ŽIVE; "
    "⭐ **LEKCIJA R390 (1) — era-clone.py NI zmožen klonirati utrjenega vira**: r389 harvest ŽE nosi CHECKPOINT "
    "GUARD + ODPADNI CENZUS + era-kontrola hash-fallback → (a) guard/cenzus vstavljanje bi bilo DUPLIKAT (POST "
    "check ×2 ≠ 1 bi ujel), (b) era-kontrola rep se je sidral na enovrstični ŽE nadomeščen obliko = FAILOVEDANO 0, "
    "(c) nova vrstica fallback bloka je mešala f-string (%{{http_code}}) z .format(dst) nad celotno implicitno "
    "konkatenacijo = KeyError('http_code') — POPRAVLJENO: idempotentna preverb (vir ŽE utrjen = preskoči vstavljanje, "
    "samo prelabel r{src}-→r{dst}-kontrola- ×2), čista f-string sestava, POST check 'Vercel Security Checkpoint' "
    "2→4 (utrjen blok nosi žig ×4: komentar + 2× grep + abort echo) + nova preverba r{dst}-kontrola- ×2 / "
    "r{src}-kontrola- ×0; (2) **val 67 POST-deploy spot** `r390-qa-spot.sh` (spot-r173/30; ZERO-MUTACIJA — "
    "obvestilne vrstice samo MERJENE, safety-tab 'Kopiraj varnostno poročilo' NI klikljen — clipboard mutacija): "
    "notification L811 ChevronRight **MONTIRANO 10×** (vseh 3 needle žetonov ×10 LOČENO per SVG getAttribute — "
    "⭐ LEKCIJA R390 (3): SVGElement.className je SVGAnimatedString, NE niz — branje po getAttribute('class')); "
    "safety-tab L254 Button **MONTIRANO 1×** — 12/12 tokenov LOČENO (disabled=false, wind data živa); sonde navy "
    "1/1/0 + red 0; kolektor **0**; (3) **MANDATORY STIL val 68** — sveža triaža NOVE družine (transition/hover "
    "IZČRPANA po val 67): ring-offset dark reševanje ŽE v globals.css (R168: --tw-ring-offset-color: var(--background) "
    "— družina zaprta); active:scale census [0.96 ×26 / 0.95 ×7 / 0.99 ×4 / 0.98 ×3 / 0.97 ×3] + disabled:opacity "
    "mešanica = semantični, NI pariteta tema; ⭐ **REALNA družina: press-scale DVOJNI MEHANIZEM** — `r390-triaza.py` "
    "(element-točna, LEKCIJA R388 (1) kanon: span parser, ne vrstični census) = **TOČNO 10 dual elementov** (vsi "
    "active:scale-[0.96] + press-scale; 9× transition-all + inventory L1562 prek cva baze Button — pretok "
    "ohranjen ×10); zgrajen CSS dokaz: `.press-scale:active{transform:scale(.97)}` vs "
    "`.active\\:scale-\\[0\\.96\\]:active{scale:.96}` — transform IN scale sta neodvisni lastnosti → množičen "
    "skrček; `r390-pinscan.py` (pin-shift pre-skan, kanon R368/R387): **TOČNO 1 ogrožen register needle "
    "(r363.tsv:21 — njegov edini vir je dual inventory L1562)** + 19 kontrolnih press-scale needlejev na "
    "ne-dualih ŽIVIH; testni pre-skan: 4 dual-pin testi (r204:90, r269:292, r271:308, r272:309, r363:43 regex); "
    "`r390-val68-apply.py` fail-closed + IDEMPOTENTEN [10 × REPL ' press-scale' odstranitev; EVOLVED ×5 testnih "
    "pinov + r363.tsv NASLEDNICA-3 V ENEM atomskem koraku; POST dual=0 + per-file števec delta + vrstični števci "
    "nespremenjeni + naslednica ŽIVO ×1; ⭐ LEKCIJA R390 (2): 1. tek je imel PATH bug (source zapis v koren "
    "repozitorija = junk tsx datoteke, ki jih tsconfig include **/*.tsx kompilira → 34 lažnih TS2307) + akumulacijski "
    "bug (multi-target datoteke: vsak target ponovno prebral disk = izgubljeni bratski uredi) — 2./3. tek popravljena "
    "in idempotenca DOKAZANA (dual 4→0, nato 0→0 ×2)]; press-scale žetoni 133→123 (−10); `r390-stil-val68.test.ts` "
    "**×5 ZELENO** [(A) PARITETA 10 tarč element-točno, (B) CENZUS dual=0 + žetoni 28 v tarčnih datotekah (prej 38), "
    "(C) EVOLVED žigi, (D) r363 NASLEDNICA ŽIVO ×1 + need_static 4 ohranjene, (E) iskrena meja: .press-scale utility "
    "OSTANE (105 non-dual uporabnikov) + cva baza zamrznjena]; (4) **FEATURE ŠESTI STRAŽAR — press-scale disciplina "
    "GENERALIZACIJA**: `r390-press-disciplina-generalizacija.test.ts` **×14 ZELENO** [(A) globalna kršitev = 0 čez "
    "VSE roksal tsx (element-točno, >2000 elementov sanitarni prag); (B) .press-scale:active definicija zamrznjena "
    "bajtno (transform:scale(0.97)); (C) it.each ×10 val 68 tarče; (D) zamrznjeni števci press-scale 123 / "
    "active:scale ×43; (E) ui-kit cva bazi zamrznjeni bajtno]; KOMPLET ŠESTIH varuhov: r385 (dark FB) + r386 "
    "(O2 pairing) + r387 (FB-border) + r388 (transition pokritost) + r389 (kaskadna disciplina) + r390 "
    "(press-scale disciplina); (5) e2e-lib dedup 23. val ISKRENO IZPUŠČEN (kanon R368 — ni novih ×3 ponovitev). "
    "REGISTER `scripts/qa-needles/r390.tsv` [2 need_static ŠIVNA needleja — sekvenca čez odstranjeni press-scale "
    "žeton je NOVA: calculator L820 'duration-150 shrink-0' šiv + inventory L1562 'tabular-nums→focus-visible' šiv; "
    "0 v HEAD 35edf80 (podspanHead kanon: needle MORA prečkati šiv, sicer je podspan HEAD spana); TODO-R390] prek "
    "`r390-register-write.py` fail-closed; naslednja era ≥175 = 173 + 2. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · "
    "eslint 0 (FULL) · vitest **5647/5647 (375) FULL GREEN TEK 1** [pre-skan ujel vse stale pine — nič EVOLVED "
    "popravkov po teku] · build svež rm -rf .next EXIT=0 · qa-round.sh 390 needles EXIT=0 [r390.tsv 2 ŽIVO + "
    "TODO-R390 odsoten; UNION r340–r390 + veriga r339→…→R227] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO "
    "IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · r390-era-harvest EXIT=0 ×2 [43rd — 173/173 ŽIVO] · "
    "r390-window-scan EXIT=0 [14. gen; REG_DO 390; 304 regexov 0 preozkih + 188 pinov 0 mrtvih + 150 slice-oknen + "
    "0 vrstičnih odstopanj] · r359-prod-qa-retry 389 ZELEN poskus 1 · leak-check čist [ghp_ ×0]. NOVO: "
    "scripts/qa-needles/r390.tsv + skripte [r390-era-harvest.sh (43rd) + r390-era-ruta-map.py (COMPANION), "
    "r390-qa-spot.sh, r390-triaza.py, r390-pinscan.py, r390-val68-apply.py, r390-window-scan.py (14. gen), "
    "r390-register-write.py, r390-readme-update.py, r390-worklog-append.py, r390-commit-msg.txt] + "
    "r390-stil-val68.test.ts [×5] + r390-press-disciplina-generalizacija.test.ts [×14 — FEATURE]; UREJENO: 6 render "
    "datotek [val 68 REPL ×10: calculator L820, dashboard L2426+L2435, inclinometer L341, inventory L1562, "
    "measurements L3496+L5211+L5234+L5258, punch-list L531 — 0 novih vrstic], 5 testnih datotek [EVOLVED: r204:90, "
    "r269:281+292, r271:303+308, r272:304+309, r363-stil-val46:43], r363.tsv [NASLEDNICA-3 — stara vrstica "
    "komentirana dobesedno], era-clone.py [idempotentno kloniranje + KeyError + POST checks], README. Kontrakt "
    "NIČ (/api/sync — probe je samo fail-closed 401 branje); SDK/BOM/pricing/geometry core NIČ; measurement jedro "
    "NIČ [val 68 = render plast className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme s "
    "strani QA [ZERO-MUTACIJA E2E; njihova shema = njihova poslovna odločitev]. ⏰ roksal-fallback-db POTEČE "
    "2026-10-25 (~3 tedne) — obvestiti lastnika (84. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena "
    "ROTACIJA. R391 prva naloga = qa-round.sh 390 prod-qa re-run [prek r359-prod-qa-retry.sh 390] + "
    "štirideseta era preverba r347–r390 [44 registrov, ≥175 = 173 + 2; prek era-clone.py --src-round 390 "
    "--expected-total 175 + VSEH 12 spec-ov IZRECNO; ERA_BESODE GLASNO na 44 — ŠTIRIDESIJNA že obstaja]; "
    "pričakuj 175/175 ŽIVO [r390 2 šivna needleja razrešena ob TEM pushu] + val 68 POST-deploy verifikacija "
    "[2 šivna needleja r390.tsv; mounted + className LOČENO; ZERO-MUTACIJA]. R391 kandidati: 1. stil: disabled: "
    "družina triaža (opacity 50/40/30/70 + cursor-not-allowed/wait — preveriti semantiko vs pariteto; "
    "iskren zaklep če semantično); 2. stil: active:scale heterogenost (0.95–0.99) po VELIKOSTNIM razredom "
    "[samo z disk resnico element-točno; brez jasne paradigme iskreno izpuščeno]; 3. e2e-lib dedup 23. val [po "
    "kanonu]. ⭐ LEKCIJE R390: (1) **orodje MORA klonirati svoj lastni izhod** — era-clone idempotenca (vir ŽE "
    "utrjen = preskoči vstavljanje + prelabel) in f-string/format konkatenacija je KeyError past; (2) **junk "
    "root datoteke = tsconfig false positive** — 34 lažnih TS2307 iz **/*.tsx include; po vsakem fail-closed "
    "abortu preveri delovno drevo PRED ponovnim tekom; (3) **SVG className = SVGAnimatedString** — getAttribute("
    "'class') v eval sonde; (4) **needle MORA prečkati šiv** — podspan starega spana je 'že v HEAD' = 0-v-HEAD "
    "guard ga pravilno zavrne; (5) multi-target apply = akumulacija v eni vsebini, vsak target NE sme znova "
    "brati diska. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: "
    "razvoj > QA]."
)

def main():
    t = README.read_text(encoding="utf-8")
    if t.count(STARA_VRSTICA) != 1:
        sys.exit(f"FAILOVEDANO: števec vrstica = {t.count(STARA_VRSTICA)} (pričakovano 1)")
    if t.count(R389_ZACETEK) != 1:
        sys.exit(f"FAILOVEDANO: R389 bullet začetek = {t.count(R389_ZACETEK)} (pričakovano 1)")
    if "R390" in t and "(R390)" in t:
        sys.exit("FAILOVEDANO: R390 bullet ŽE obstaja (idempotenca)")
    t = t.replace(STARA_VRSTICA, NOVA_VRSTICA, 1)
    t = t.replace(R389_ZACETEK, R390_BULLET + "\n" + R389_ZACETEK, 1)
    # POST preverbe
    if NOVA_VRSTICA not in t or STARA_VRSTICA in t:
        sys.exit("FAILOVEDANO: števec NI posodobljen")
    if t.count("(R390)") != 1 or t.count("(R389)") != 1:
        sys.exit(f"FAILOVEDANO: bullet števci R390={t.count('(R390)')} R389={t.count('(R389)')}")
    README.write_text(t, encoding="utf-8")
    print(f"OK: README posodobljen (5647/375 + R390 bullet, {len(t)} bajtov)")

if __name__ == "__main__":
    main()
