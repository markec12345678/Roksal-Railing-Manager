#!/usr/bin/env python3
# r397-readme-update.py — README posodobitev (fail-closed, kanon
# r381/r383/r384/r391/r392/r394/r396): števec 5857/390 → 5864/391
# [+7/+1: val 72 + DESETI STRAŽAR gibanje-pariteta ×7] + R397 bullet
# NAD R396 bulletom (bajtno ohranjen).
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
README = REPO / "README.md"

STAR_TESTI = "**5857** (390 datotek, vključno z globalSetup embedded PG)"
NOV_TESTI = "**5864** (391 datotek, vključno z globalSetup embedded PG)"

ANCHOR_R396 = "- **DARK-MODE SCROLLBAR PARITETA val 71 (CSS-nivojska — globals.css +15 vrstic"

BULLET_R397 = (
    "- **REDUCED-MOTION PARITETA val 72 (CSS-nivojska — globals.css +26 vrstic, 0 className "
    "žetonov → 0 pinov na src; rešuje P2 mejo iz R396 (G): kontinuirane zanke `.badge-pulse` "
    "(badge-pulse-breathe 2s infinite) + `.shine-effect::after` (shine 3s infinite) + "
    "`.animate-pulse-soft` (pulse-soft 2s infinite) + `.shimmer` (shimmer 1.5s infinite) + "
    "enojni `.animate-bounce-subtle` (popolnost družine — končno stanje vizualno identično) "
    "NOSIJO `@media (prefers-reduced-motion: reduce)` guard (`animation: none`); 0 novih hex — "
    "vrednosti se ne dotikamo, samo ustavimo gibanje; svetla/temna tema bajtno) + FEATURE "
    "DESETI STRAŽAR: gibanje-pariteta disciplina (komplet varuhov r385…r394 + r395 + r396 + r397; "
    "`r397-gibanje-pariteta.test.ts` ×7: (A) val 72 anchorji ×5 + skupaj 3 media guardi, (B) "
    "besedišče/keyframes ostane, (C) HEX CENZUS 7 vrednosti prevzet od r396, (D) enojni in-file "
    "kanon (shake/tile) bajtno, (E) disk resnica rabe — shimmer + bounce-subtle = slovarska ×0 "
    "klicnih mest (iskreno), (F) kompilirani CSS dokaz z mtime-staleness SKIP, (G) "
    "med-stražarski roki val 71 × val 72)** (R397; KOLIZIJE: brez — fetch-first origin/main == "
    "HEAD 9cf275d ob startu; STALE-SUMMARY opomba #46: seja je podedovala R370 plan iz povzetka — "
    "disk resnica = R396, 26+ rund naprej; kanon KOLIZIJE #4/R323; worklog na disku = edina "
    "resnica): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 396`: **ZELEN ob "
    "poskusu 1** (28. runda) + **OSEMINŠTIRIDESIJNA (48.) era preverba** `r395-era-harvest.sh` "
    "[48 registrov r347–r394, disk resnica 189 = 188 + 1 (r394 val 70 šivni); era-clone.py "
    "--src-round 394 --dst-round 395 --expected-total 189 + 19 spec-ov; ERA_BESODE GLASNO na "
    "48+49+50] **189/189 ŽIVO** EXIT=0 ×2 + **DEVETINŠTIRIDESIJNA (49.) era preverba** "
    "`r396-era-harvest.sh` [49 registrov r347–r395, disk resnica 192 = 189 + 3 njihovih r395 "
    "document-chain needlejev; era-clone.py --src-round 395 --dst-round 396; ⭐ LEKCIJA R397 (1): "
    "spec regvar MORA kazati na registr, ki NOSI needle — 1. generacija z `AV|…` (r394) → 3 MISS; "
    "regvar validacija generatorja preveri samo OBSTOJ var, ne semantiko; pravilno `AW|/api/quotes/000/pdf|401` "
    "(20. spec) → **192/192 ŽIVO** EXIT=0 ×2 — 3. potrditev LEKCIJE R396 (1)] + **PETDESIJNA (50.) "
    "era preverba** `r397-era-harvest.sh` [50 registrov r347–r396, disk resnica 193 = 192 + 1 "
    "(r396 val 71 CSS); era-clone.py --src-round 396 --dst-round 397 --expected-total 193; "
    "⭐ LEKCIJA R397 (5): prod .css URL-i MORAJA biti ABSOLUTNI v žetvenem seznamu — qa-harvest "
    "curla URL DIREKTNO (brez BASE-prepend), relativni `/_next/...` padejo po 3 retryih tiho "
    "(OPOMBA vrstica); zamrznjen URL seznam +2 .css (iz živega prod HTML, GLASNO, backup "
    "/tmp/r339-chunkurls.txt.bak-r397)] **193/193 ŽIVO** EXIT=0 ×2 — val 71 needle ŽIVO na prod "
    "CDN prek žetve; (2) **val 71 POST-deploy MONTIRANI dokaz** `r397-val71-mounted.sh` "
    "(ZERO-MUTACIJA): ⭐ LEKCIJA R397 (4): CSSOM probe MORA rekurzirati v layer/media bloke — "
    "pravilo val 71 živi v `@layer utilities` (CSSLayerBlockRule; 1. probe z vrhovno iteracijo = "
    "lažno 0); rekurzivni walk: **2 pravili pod root > utilities** — `.dark .scrollbar-thin::-webkit-scrollbar-thumb "
    "{ background-color: rgb(71, 85, 105) }` (= #475569) + :hover varianta; prod CDN needle ×1 v "
    "5fc36b66bd1b4dfb.css (+ hover ×1; prvi čank čist); dark-mode QA sweep `r397-visual-sweep.sh` "
    "(htmlClass=dark, bodyBg slate-900 — ZERO-MUTACIJA); (3) **REGISTER** `scripts/qa-needles/r397.tsv` "
    "[1 need_static ŠIVNI needle — ⭐ LEKCIJA R397 (3): lightningcss ZLIJE media-guard selektorje v "
    "ENO pravilo — src pretty 5 blokov → build zliti selector list "
    "`.badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,.animate-bounce-subtle{animation:none}` "
    "(::after normaliziran v :after) ×1 v build CSS (698a1900a928a5e6.css); 0 v HEAD 9cf275d; "
    "TODO-R397] prek `r397-register-write.py` fail-closed; era veriga: TA needle pokrit v 51. "
    "preverbi (r347–r397) ≥194 [R398]; (4) build svež rm -rf .next EXIT=0 **PRVI — pred "
    "registerjem** (LEKCIJA R396 (7)); `r397-window-scan.py` **19. generacija** [REG_DO 397; "
    "val 72 = globals-only → TARGETS nespremenjeni]: EXIT=0 (0 preozkih + 0 mrtvih pinov + "
    "0 vrstičnih odstopanj). VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest "
    "**5864/5864 (391) FULL GREEN** [baza 5857/390 + mojih +7/+1; 148.7 s] · qa-round.sh 397 "
    "needles EXIT=0 [r397.tsv 1 ŽIVO v .css + UNION r340–r397 + veriga r339→…→R227] · smoke "
    "EXIT=0 [standalone :3100: health ok + ovojnice 400 + val-3 meja ŽIVO] · e2e EXIT=0 [ODTIS "
    "BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · era ×3 (48.+49.+50.) "
    "EXIT=0 ×2 bajtno · window-scan EXIT=0 · r359-prod-qa-retry 396 ZELEN poskus 1 · guard re-run "
    "po buildu — 19/19 ZELENO, (F) POPOLNOST dokazana · leak-check čist [ghp_ ×0]. Kontrakt NIČ "
    "(/api/quotes/000/pdf probe = samo fail-closed 401 branje); SDK/BOM/pricing/geometry core "
    "NIČ; measurement jedro NIČ [val 72 = globals.css-only]; viz/** ZAŠČITENO jedro nič (kanon "
    "R167); OgrajaVizija nič; 0 novih hex [STOJIČI stražar (C)]; NIČ novih FNV soli; brez sheme "
    "s strani QA [ZERO-MUTACIJA E2E]. ⭐ LEKCIJA R397 (6): handover žeton \"NEDEVETA\" za 49. "
    "preverbo NE sledi vzorcu ERA_BESODE (…INŠTIRIDESIJNA) — vzorcem zvesta oblika "
    "DEVETINŠTIRIDESIJNA, odmik GLASNO (nič tihega)."
)

R398_NALOGA = (
    "- R398 prva naloga = qa-round.sh 397 prod-qa re-run [prek r359-prod-qa-retry.sh 397] + "
    "**ENAINPETDESETA (51.) era preverba r347–r397** [51 registrov, ≥194 = 193 + 1 (r397.tsv val 72 "
    "zliti šivni); era-clone.py --src-round 397 --dst-round 398 --expected-total 194; ERA_BESODE 51 "
    "ENAINPETDESETA GLASNO; pričakuj ŽIVO ob pushu — val 72 needle je CSS-nivojski, razreši se ob "
    "R397 deployu; prod .css URL-i ostanejo v žetvenem seznamu ABSOLUTNI — LEKCIJA R397 (5)] + "
    "val 72 POST-deploy verifikacija [CSS needle v .css čanku + MONTIRANI dokaz: rekurzivni CSSOM "
    "walk `.badge-pulse` + `animation:none` pod prefers-reduced-motion media — vzorec "
    "r397-val71-mounted.sh; ZERO-MUTACIJA]."
)

R398_KANDIDATI = (
    "- R398 kandidati: 1. stil: enojni vstopni animaciji fadeInUp/slideInRight — reduced-motion "
    "odločitev za 100 % pokritost gibanja (trenutno iskreno dokumentirana meja v (A)-testu — WCAG "
    "2.3.3 ne zahteva; previdno, forwards končno stanje je identično); 2. slovarska para "
    "shimmer/bounce-subtle (×0 klicnih mest): uporabiti v UI (loading skeleti) ALI iskreno "
    "označiti kot mrtvi CSS — odločitev z lastnikom; 3. e2e-lib dedup [po kanonu — ni novih ×3]. "
    "⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika. ⚠️ žetona (GitHub + "
    "Vercel) uporabljena — priporočena ROTACIJA. ISSUE #1: ostaja odprt, owner 'Razvoj > QA' "
    "[AGENT STARTUP RULE: razvoj > QA]."
)


def fail(msg: str) -> None:
    print(f"FAILOVEDANO: {msg}")
    sys.exit(1)


def main() -> None:
    besedilo = README.read_text(encoding="utf-8")
    if NOV_TESTI in besedilo and BULLET_R397[:80] in besedilo:
        print("OPOMBA: R397 posodobitev ŽE prisotna — idempotentno, nič")
        return
    if besedilo.count(STAR_TESTI) != 1:
        fail(f"števec {STAR_TESTI!r} = {besedilo.count(STAR_TESTI)} (pričakovano 1)")
    if besedilo.count(ANCHOR_R396) != 1:
        fail(f"anchor R396 bullet = {besedilo.count(ANCHOR_R396)} (pričakovano 1)")
    besedilo = besedilo.replace(STAR_TESTI, NOV_TESTI, 1)
    besedilo = besedilo.replace(ANCHOR_R396, BULLET_R397 + "\n" + ANCHOR_R396, 1)
    # R398 naloga + kandidati: pripni NA KONEC R397 bulleta (isti odstavek-blok)
    konec_r397 = BULLET_R397[-40:]
    if besedilo.count(konec_r397) != 1:
        fail("konec R397 bulleta ni enoličen")
    besedilo = besedilo.replace(konec_r397, konec_r397 + "\n" + R398_NALOGA + "\n" + R398_KANDIDATI, 1)
    README.write_text(besedilo, encoding="utf-8")
    print(f"OK: README posodobljen — števec {NOV_TESTI} + R397 bullet + R398 naloga/kandidati")


if __name__ == "__main__":
    main()
