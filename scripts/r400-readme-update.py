#!/usr/bin/env python3
# r400-readme-update.py — README posodobitev (fail-closed, kanon
# r381/…/r398; KOLIZIJA #28 preimenovanje R399→R400, re-aplicirano na
# NJIHOVO postavitev): števec 5888/393 → 5895/394 [+7/+1: val 74 +
# DVANAJSTI STRAŽAR slovar-raba ×7; njihovih 5888/393 = 5871 + njihovih 17]
# + R400 bullet NAD R398 bulletom (bajtno ohranjen; NJIHOVA R399 povzetka
# ostaja v statistični tabeli) + R399 naloga/kandidati (iz R398 handoverja)
# → R401 naloga/kandidati.
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
README = REPO / "README.md"

STAR_TESTI = "**5888** (393 datotek, vključno z globalSetup embedded PG)"
NOV_TESTI = "**5895** (394 datotek, vključno z globalSetup embedded PG)"

ANCHOR_R398 = "- **VSTOPNE ANIMACIJE REDUCED-MOTION ZAKLJUČEK val 73 (CSS-nivojska — globals.css +25 vrstic "

R399_NALOGA_STARA = "- R399 prva naloga = qa-round.sh 398 prod-qa re-run"
R401_NALOGA = (
    "- R401 prva naloga = **NAJPREJ 52. preverba RE-RUN ×2 do EXIT=0** (r399-era-harvest.sh — bajtno; "
    "val 73 razrešen ob deploy pristanku — ⚠️ Vercel Hobby kvota RATE-LIMITED 24 h iz 13:02 UTC; "
    "/api/version stamp PRED tekom: mora biti > 12:16:01 = nov build — ⭐ LEKCIJA R400 (2)) + val 73 "
    "POST-deploy verifikacija [prod CDN needle ×1 v NOVEM .css čanku + rekurzivni CSSOM walk "
    "`.animate-fade-in-up,.slide-in-right` + animation:none pod prefers-reduced-motion — vzorec "
    "r398-val73-mounted.sh; ZERO-MUTACIJA] + qa-round.sh 400 prod-qa re-run [prek r359-prod-qa-retry.sh "
    "400] + **TRETINPETDESETA (53.) era preverba r347–r399** [53 registrov, ≥198 = 195 + NJIHOVIH 3 "
    "(r399.tsv storage/reconcile server needleji); era-clone.py --src-round 399 --dst-round 401 "
    "--expected-total 198; ERA_BESODE 53 TRETINPETDESETA GLASNO; njihov AZ spec "
    "/api/storage/reconcile|401 — GET-samo brez rate-limit kanon R390/R393; ⭐ LEKCIJA R400 (1) "
    "REDNI ZAKON: prod-qa PRVI → +ABSOLUTNI .css URL-ji iz živega HTML z backupom → era] + val 74 "
    "POST-deploy verifikacija [TSX needle `shimmer rounded` ×7 v build JS čankih + MONTIRANI dokaz: "
    "skelet element z .shimmer + getComputedStyle animationName = shimmer — agent-browser produ, "
    "samo isti-origin reload (kanon R396 (4)); ZERO-MUTACIJA]."
)

R399_KANDIDATI_STARA = "- R399 kandidati: 1. slovarska para shimmer/bounce-subtle (×0 klicnih mest)"
R401_KANDIDATI = (
    "- R401 kandidati: 1. merge-chunkurls.py hardening — UNIJA ohrani .css vnose (prod-qa re-run jih "
    "briše; kanon: hardening V NOVI skripti, zamrznjen R297 NI mutiran — odločitev z lastnikom); "
    "2. interaktivni btn-shine hover sweep reduced-motion odločitev [interaktivna družina kanon "
    "val 69 — zahteva EVOLVED pin odločitev z lastnikom, previdno]; 3. e2e-lib dedup [po kanonu — ni "
    "novih ×3]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika. ⚠️ žetona "
    "(GitHub + Vercel) uporabljena — priporočena ROTACIJA. ⚠️ Vercel deploy RATE-LIMITED 24 h — "
    "val 73/74 + r399 needleji PENDING do pristanka. ISSUE #1: ostaja odprt, owner 'Razvoj > QA' "
    "[AGENT STARTUP RULE: razvoj > QA]."
)

BULLET_R400 = (
    "- **SLOVAR-RABA val 74 (TSX-nivojska — className raba, vzorec r394: needle = string literal v "
    "build JS čankih; kandidat 1 iz R398 handoverja, pot A „uporabiti v UI (loading skeleti)': "
    "slovarska parа shimmer/bounce-subtle z ×0 klicnimi mesti je DEJANSKO V UI — `.shimmer` ×7: vse "
    "ročno valjane nalagalne skelet kartice (roksal-catalog h-28 + vodja-dashboard h-24 + crm-tab "
    "h-24 + notification-center ×3 + photo-tab aspect-square) zamenjajo `animate-pulse … bg-muted` s "
    ".shimmer (premikajoči se gradient = jasnejši nalaganje signal; background: shorthand nadomesti "
    "bg-muted — brez kaskadne dvoumnosti, kanon R396 (2)); `.animate-bounce-subtle` ×1 na bottom-nav "
    "znački (pogojno montirana — badgeCount 0→N prehod remontira element, enojni 0.3s izski naravno "
    "brez JS ožičenja; NI kontinuirana); obe rabi ŽE pokriti z val 72 reduced-motion guardom (bajtno "
    "— guardova napovedana pot); ISKRENE MEJE: ui-kit Skeleton FROZEN K1 (bg-accent animate-pulse "
    "rounded-md) bajtno + animate-pulse ×13 busy/progress/ikon družina ostaja (semantična meja); 0 "
    "novih hex — globals.css samo komentar val 74 (+13 vrstic, 0 pravil)) + FEATURE DVANAJSTI "
    "STRAŽAR: slovar-raba disciplina (komplet varuhov r385…r394 + r395 + r396 + r397 + r398 + r399 + "
    "r400; `r400-slovar-raba.test.ts` ×7: (A) val 74 TSX anchorji — 6 žetonov per-datoteka točno + "
    "POPOLNOST 0 starih skelet vzorcev, (B) slovar NESELJEN — keyframes + definiciji ostajata + "
    "background-size 200% + val 74 komentar, (C) HEX CENZUS 7 stoječi stražar, (D) disk resnica rabe "
    "×7/×1 + semantična meja animate-pulse ×14 (×1 FROZEN K1 + ×13 busy), (E) kompilirani CSS dokaz "
    "— .shimmer + .animate-bounce-subtle pravili ŽIVA + val 72/73 zlita guarda bajtno z "
    "mtime-staleness SKIP→POPOLNOST, (F) med-stražarski roki val 72 × 73 bajtno, (G) meje "
    "dokumentirane — mount-sprožena značka + keyframes slovar cel) + ⭐ EVOLVED PIN (vzorec PIN SHIFT "
    "R394): r397-gibanje-pariteta.test.ts (E) shimmer/bounce-subtle 0→7/1 z zgodovinsko resnico v "
    "komentarju (guardova napovedana pot — raba se je spremenila, guard blok bajtno) (R400; "
    "KOLIZIJA #28: preimenovanje R399→R400 — NJIHOVA runda R399 [d8a76c5 — §18 OBJECT STORAGE "
    "PRIVATE BY DEFAULT] = pristala resnica, bajtno ohranjena; MOJI artefakti preimenovani; moja "
    "r399-era-harvest = bajtno identična NJIHOVI → duplikat izbrisan po njihovi LEKCIJI R399 (5); "
    "fetch-first ob startu == 9c248f9): (1) **prva naloga** — prod-qa re-run prek "
    "`r359-prod-qa-retry.sh 398`: **ZELEN ob poskusu 1** (30. runda) + **DVAINPETDESETA (52.) era "
    "preverba** [52 registrov r347–r398, disk resnica 195 = 194 + 1 (r398 val 73 zliti šivni); "
    "era-clone.py + ekspliciten --dst-chain-seg (auto-vzorec fail-closed ujel); ⭐ LEKCIJA R400 (3): "
    "disk resnica need_static = `rg -v '^#'` — komentar glave nosijo 'need_static', `tail -n +2` da "
    "296 namesto 195 — napačna metoda ujeta PRED generacijo; ⭐ LEKCIJA R400 (1): prod-qa re-run SAM "
    "prepiše /tmp žetveni seznam JS-only (merge-chunkurls.py NE-unija) → REDNI ZAKON: prod-qa PRVI → "
    "+2 ABSOLUTNA .css URL-ja z backupom → era] **tek 1 ISKREN: 194/195 ŽIVO** [153 static + 8 hash "
    "+ 33 SERVER-REZOLUCIJA] EXIT=2 — edini MISS = val 73 [lokalni 0d49a822af6ff8bf.css → prod 404 — "
    "LEKCIJA R398 (1) potrjena; ROOT CAUSE = R398 deploy RATE-LIMITED 24 h (Vercel Hobby kvota — "
    "NJIHOVA diagnoza; moja /api/version-stamp metoda konvergentna — LEKCIJA R400 (2): javna "
    "no-store MISS = svež deploy-stamp sonda, era POGOJEN na stamp > commit]; nič lažnih ŽIVO — "
    "iskren PENDING]; era kontrole R340/R341/R343/R345 ŽIVE + must_miss ×52 čisto — val 70/71/72 "
    "deployi POTRJENI, val 73 PENDING; (2) **REGISTER** `scripts/qa-needles/r400.tsv` [1 need_static "
    "ŠIVNI — `shimmer rounded` ×7 v build JS čankih (×5 datotek — skelet kartice družina; najširši "
    "skupni podniz; `shimmer rounded-lg` ×5 bi bil preozek); 0 v HEAD 9c248f9 (tudi 0 v d8a76c5); "
    "needle iz builda, nikoli napovedan (LEKCIJA R398 (4)); register-write preverja tudi val 72 + "
    "val 73 needleja bajtno ×1 v build CSS] prek `r400-register-write.py` fail-closed; era veriga: "
    "TA needle pokrit v 54. preverbi (r347–r400) ≥199 = 198 (195 + njihovih 3) + 1 [R401]; (3) "
    "`r400-window-scan.py` **22. generacija** [REG_DO 400 — njihov r399.tsv ×3 + moj r400.tsv ×1; "
    "val 74 = IN-PLACE → PRIČAKOVANE_VRSTICE nespremenjene]: EXIT=0 (304 okenskih 0 preozkih + 212 "
    "needle pinov 0 mrtvih + 150 slice + 0 vrstičnih odstopanj). VERIFIKACIJA (celotna, FOREGROUND, "
    "na ZLIVENEM drevesu): tsc 0 · eslint 0 (FULL) · vitest **5895/5895 (394) FULL GREEN** [njihova "
    "baza 5888/393 + mojih +7/+1; moj tek 1 = 1 stale pin r397 (E) iskren fail → EVOLVED PIN] · "
    "build svež rm -rf .next EXIT=0 [PRVI — pred registerjem, LEKCIJA R396 (7)] · qa-round.sh 400 "
    "needles EXIT=0 [r400.tsv 1 ŽIVO ×7 v build JS + njihov r399.tsv ×3 ŽIVO + UNION r340–r400 + "
    "veriga r339→…→R227] · smoke EXIT=0 [standalone :3100] · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN "
    "pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · era 52. tek 1 iskren 194/195 EXIT=2 [PENDING — "
    "re-run ×2 = R401] · window-scan EXIT=0 [22. gen] · r359-prod-qa-retry 398 ZELEN poskus 1 · "
    "leak-check čist [ghp_[A-Za-z0-9]{36} ×0]. Kontrakt NIČ (era probes = samo fail-closed 401 "
    "branje); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 74 = TSX className raba]; "
    "viz/** ZAŠČITENO jedro nič (kanon R167); OgrajaVizija nič; 0 novih hex [stoječi stražar (C)]; "
    "NIČ novih FNV soli; brez sheme s strani QA [ZERO-MUTACIJA E2E]. ⭐ LEKCIJA R400 (4): EVOLVED PIN "
    "mehanizem za zastarele disk-resnica žige v guardianjih (zgodovinska resnica v komentarju, "
    "pričakovanje premaknjeno, GLASNO); ⭐ LEKCIJA R400 (5): TSX needle = NAJŠIRŠI skupni podniz "
    "družine, števec iz builda; ⭐ LEKCIJA R400 (6): identične verige vzporednih sej → duplikat "
    "izbriši, pristala ostane (3. potrditev njihove LEKCIJE R399 (5))."
)


def fail(msg: str) -> None:
    print(f"FAILOVEDANO: {msg}")
    sys.exit(1)


def main() -> None:
    besedilo = README.read_text(encoding="utf-8")
    if NOV_TESTI in besedilo and BULLET_R400[:80] in besedilo:
        print("OPOMBA: R400 posodobitev ŽE prisotna — idempotentno, nič")
        return
    if besedilo.count(STAR_TESTI) != 1:
        fail(f"števec {STAR_TESTI!r} = {besedilo.count(STAR_TESTI)} (pričakovano 1)")
    if besedilo.count(ANCHOR_R398) != 1:
        fail(f"anchor R398 bullet = {besedilo.count(ANCHOR_R398)} (pričakovano 1)")
    if besedilo.count(R399_NALOGA_STARA) != 1:
        fail(f"R399 naloga anchor = {besedilo.count(R399_NALOGA_STARA)} (pričakovano 1)")
    if besedilo.count(R399_KANDIDATI_STARA) != 1:
        fail(f"R399 kandidati anchor = {besedilo.count(R399_KANDIDATI_STARA)} (pričakovano 1)")
    besedilo = besedilo.replace(STAR_TESTI, NOV_TESTI, 1)
    besedilo = besedilo.replace(ANCHOR_R398, BULLET_R400 + "\n" + ANCHOR_R398, 1)
    # R399 naloga → R401 naloga (cela vrstica)
    i = besedilo.index(R399_NALOGA_STARA)
    j = besedilo.index("\n", i)
    besedilo = besedilo[:i] + R401_NALOGA + besedilo[j:]
    # R399 kandidati → R401 kandidati (cela vrstica)
    i = besedilo.index(R399_KANDIDATI_STARA)
    j = besedilo.index("\n", i)
    besedilo = besedilo[:i] + R401_KANDIDATI + besedilo[j:]
    README.write_text(besedilo, encoding="utf-8")
    print(f"OK: README posodobljen — števec {NOV_TESTI} + R400 bullet + R401 naloga/kandidati")


if __name__ == "__main__":
    main()
