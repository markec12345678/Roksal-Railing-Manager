#!/usr/bin/env python3
# r401-readme-update.py — R401 README posodobitev (fail-closed, kanon
# r400-readme-update.py): števec 5895/394 → 5902/395 [+7/+1: val 75 +
# TRINAJSTI STRAŽAR r401-color-scheme.test.ts ×7]; R401 bullet NAD R400
# bulletom (bajtno ohranjen); R401 naloga/kandidati vrstici (iz R400
# handoverja, izvedene) zamenjani z R402 naloga/kandidati.
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
README = REPO / "README.md"

STAR_STEVEC = "| Testi (vitest) | **5895** (394 datotek, vključno z globalSetup embedded PG) |"
NOV_STEVEC = "| Testi (vitest) | **5902** (395 datotek, vključno z globalSetup embedded PG) |"

R400_BULLET_PREF = "- **SLOVAR-RABA val 74 (TSX-nivojska"

R401_BULLET = ("- **COLOR-SCHEME PARITETA val 75 (CSS-nivojska — globals.css +12 vrstic DODATIVNO v obstoječa bloka :root/.dark — 0 novih pravilnih blokov, 0 className žetonov, 0 novih hex: ključni besedi light/dark; rešuje paritetno vrzel, ki je accent-color NE doseže: UA-nativne površine — izbira datuma/časa ×10 mest v 5 datotekah [koledar popup + ikona: crm ×2, vodja ×1, logistika ×3 + datetime-local ×1, foto ×2, sledenje ponudb ×1], nativni select popup ×2 [foto], range sled ×2 [foto + AR skener], autofill — brez color-scheme UA odpre SVETEL koledar popup na temni temi; :root → eksplicitno `color-scheme: light` = 100 % determinizem [nič UA-prislova], .dark → `color-scheme: dark` = temno-nativno krom; hybridna vrednost „light dark“ PREPOVEDANA [dvoumna]; 0 src needlejev prizadetih — needleja ČISTA minificirana plast, vzorec val 71) + FEATURE TRINAJSTI STRAŽAR color-scheme disciplina (r401-color-scheme.test.ts ×7: [A] anchorji ×1/×1 znotraj obstoječih blokov, [B] pariteta popolnost — točno 2 razglasitvi, .dark PO :root, nič hybridne dvoumnosti, [C] HEX cenzus 7 stoječi stražar, [D] efektne površine disk resnica ×9+1+2+2 + checkbox meja accent ×5 [amber ×1 + navy ×4 — ločena plast], [E] kompilirani CSS dokaz z mtime-SKIP, [F] med-stražarski roki val 72×73×71 bajtno, [G] meje dokumentirane) + era 53. TRETINPETDESETA generirana (r400-era-harvest.sh + COMPANION ruta-map; ERA_BESODE 53 GLASNO; disk resnica 198 = 195 + 3 r399) + LEKCIJA R401 reg_var dvočrkovni popravnik ('A'+chr(65+i-26) je podpiral SAMO A* generacijo — pri i=52/r399 izdelal neveljaven bash identifikator REG_A[, ujet šele ob poganjanju [unexpected EOF]; popravljeno splošno (i-26)//26+(i-26)%26 — GLASNO) + middleware 401-catch-all odkritje (/api/* neznane poti vračajo ISTI 401 body {'Neavtoriziran dostop'} kot žive rute — |401 probe NI deploy-diskriminator; storage/reconcile spec NAMERNO ni dodan — false-ŽIVO zaščita, odločitev R402) + register r401.tsv ×2 CSS needlejev (color-scheme:dark ×1 + color-scheme:light ×1; ×0 v JS, ×0 v HEAD 6abd7b1) + window-scan 23. gen + val 73/74 + r399 needleji ŠE VEDNO PENDING (deploy rate-limited; stamp 12:16:01 tudi ~2 h po R400 pushu — /api/version sonda LEKCIJA R400 (2))** (R401): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 400` ZELEN poskus 1 (31. runda zapored); Z2 needleji ŽIVO + Z3 v99 sync gate ŽIVO (ZERO-MUTACIJA); po REDNEM ZAKONU LEKCIJA R400 (1): +2 ABSOLUTNA .css URL-ja re-dodana žetvenemu seznamu z backupom .bak-r401 [62 URL-jev, 2 .css]; (2) era 52. re-run [r399-era-harvest.sh bajtno] iskren 194/195 EXIT=2 [edini MISS = val 73 needle — deploy PENDING, trojno potrjeno: stamp sonda + UI nogica 'Zgrajeno 03.10.2026 ob 14:16:01' + direktni CDN grep]; (3) era 53. generirana + tek iskren 194/198 EXIT=2 [4 PENDING: val 73 + 3× r399 storage/reconcile nizi — NJIHOVI server čanki ŠE NISO na produ]; (4) val 75 triaža PRED val (kanon R396 (5)): color-scheme ×0 v celotnem src drevesu = prava paritetna vrzel; checkboxi ×5 ŽE imajo izrecen accent-color [ločena plast — meja]; (5) TRINAJSTI STRAŽAR ×7 ZELENO [(E) iskren mtime-SKIP pred svežim buildom — po buildu pokrito]; (6) build svež rm -rf .next EXIT=0 [PRVI — pred registerjem, LEKCIJA R396 (7)]; (7) register r401.tsv fail-closed [×1/×1 iz builda — LEKCIJA R398 (4); ×0 v JS = čista CSS plast; val 72/73 roki bajtno ×1/×1; TODO-R401; ⭐ opažanje: r400.tsv nosi TODO-R399 [njihov copy slip] — ostane bajtno, pristala resnica]; (8) window-scan 23. gen EXIT=0 [304 okenskih 0 preozkih + 214 needle pinov 0 mrtvih + 150 slice + 0 vrstičnih]; (9) KONTRAKT NIČ: SDK/BOM/pricing/geometry/viz/** ZAŠČITENO jedro nič; OgrajaVizija nič; 0 novih hex; nič novih FNV soli; brez sheme s strani QA [ZERO-MUTACIJA].")

R402_NALOGA = ("- R402 prva naloga = **STAMP-GATE najprej** (/api/version mora nositi stamp > 13:02 UTC 3.10. = NOV deploy; če ŠE rate-limited: iskren PENDING dokumentirati — LEKCIJA R400 (2)) + ob pristanku: val 73 POST-deploy verifikacija [prod CDN needle `.animate-fade-in-up,.slide-in-right{animation:none}` ×1 v NOVEM .css čanku + rekurzivni CSSOM walk — vzorec r398-val73-mounted.sh; ZERO-MUTACIJA] + val 74 POST-deploy verifikacija [`shimmer rounded` ×7 v build JS čankih + MONTIRANI dokaz: skelet element z .shimmer + getComputedStyle animationName = shimmer — agent-browser produ, samo isti-origin reload (kanon R396 (4))] + r399 needleji ×3 v 53. re-run [r400-era-harvest.sh bajtno; pričakovano razrešeni — nizi v NJIHOVIH server čankih NOVEGA deploya; ⚠️ storage/reconcile |401 probe NI dodan — middleware 401-catch-all (isti body za žive in neznane rute) bi dal false-ŽIVO; dokumentirano R401, odločitev z lastnikom] + qa-round 401 prod-qa re-run [prek r359-prod-qa-retry.sh 401; REDNI ZAKON: prod-qa PRVI → +ABSOLUTNI .css URL-ji iz živega HTML z backupom → era harvest — LEKCIJA R400 (1)] + **ŠTIRINPETDESETA (54.) era preverba r347–r400** [era-clone.py --src-round 400 --dst-round 401 --expected-total 199; ERA_BESODE 54 ŠTIRINPETDESETA GLASNO; pokrije r400.tsv val 74 ×1] + **PETINPETDESETA (55.) era preverba r347–r401** [--src-round 401 --dst-round 402 --expected-total 201; ERA_BESODE 55 PETINPETDESETA GLASNO; pokrije r401.tsv ×2] + val 75 POST-deploy verifikacija [`color-scheme:dark` ×1 v NOVEM .css čanku + MONTIRANI dokaz: getComputedStyle(document.documentElement).colorScheme = 'dark' v temni temi — agent-browser produ, isti-origin reload].")

R402_KANDIDATI = ("- R402 kandidati: 1. merge-chunkurls.py hardening — UNIJA ohrani .css vnose (prod-qa re-run jih briše; kanon: hardening V NOVI skripti, zamrznjen R297 NI mutiran — odločitev z lastnikom); 2. interaktivni btn-shine hover sweep reduced-motion odločitev [interaktivna družina kanon val 69 — zahteva EVOLVED pin odločitev z lastnikom, previdno]; 3. e2e-lib dedup [po kanonu — ni novih ×3]; 4. era-clone.py reg_var enotski test (reg_var(347…420) znani nizi vs. izpeljava — prepreči ponovitev LEKCIJE R401 REG_A[). ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (91.+ zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. ISSUE #1: ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].")


def fail(msg: str) -> None:
    print(f"FAILOVEDANO: {msg}")
    sys.exit(1)


def main() -> None:
    t = README.read_text(encoding="utf-8")
    if t.count(STAR_STEVEC) != 1:
        fail(f"števec pin = {t.count(STAR_STEVEC)} (pričakovano točno 1)")
    t = t.replace(STAR_STEVEC, NOV_STEVEC)
    lines = t.splitlines(keepends=True)
    idx = [i for i, l in enumerate(lines) if l.startswith(R400_BULLET_PREF)]
    if len(idx) != 1:
        fail(f"R400 bullet pin = {len(idx)} (pričakovano točno 1)")
    i = idx[0]
    if not lines[i].endswith("\n"):
        fail("R400 bullet ni celotna vrstica")
    lines.insert(i, R401_BULLET + "\n")
    t = "".join(lines)
    naloga_idx = [l for l in t.splitlines() if l.startswith("- R401 prva naloga = ")]
    if len(naloga_idx) != 1:
        fail(f"R401 naloga pin = {len(naloga_idx)} (pričakovano točno 1)")
    t = t.replace(naloga_idx[0], R402_NALOGA)
    kand_idx = [l for l in t.splitlines() if l.startswith("- R401 kandidati: ")]
    if len(kand_idx) != 1:
        fail(f"R401 kandidati pin = {len(kand_idx)} (pričakovano točno 1)")
    t = t.replace(kand_idx[0], R402_KANDIDATI)
    if "5902** (395 datotek" not in t or t.count("R401 COLOR-SCHEME" if False else "COLOR-SCHEME PARITETA val 75") != 1:
        fail("po-verifikacija ni uspela")
    README.write_text(t, encoding="utf-8")
    print(f"OK: {README} posodobljen (števec 5902/395; R401 bullet nad R400; R402 naloga/kandidati)")


if __name__ == "__main__":
    main()
