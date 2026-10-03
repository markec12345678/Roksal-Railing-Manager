#!/usr/bin/env python3
# r398-readme-update.py — README posodobitev (fail-closed, kanon
# r381/r383/r384/r391/r392/r394/r396/r397): števec 5864/391 → 5871/392
# [+7/+1: val 73 + ENAJSTI STRAŽAR gibanje-zaključek ×7] + R398 bullet
# NAD R397 bulletom (bajtno ohranjen) + R399 naloga/kandidati.
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
README = REPO / "README.md"

STAR_TESTI = "**5864** (391 datotek, vključno z globalSetup embedded PG)"
NOV_TESTI = "**5871** (392 datotek, vključno z globalSetup embedded PG)"

ANCHOR_R397 = "- **REDUCED-MOTION PARITETA val 72 (CSS-nivojska — globals.css +26 vrstic, 0 className "

R398_NALOGA_STARA = "- R398 prva naloga = qa-round.sh 397 prod-qa re-run"
R399_NALOGA = (
    "- R399 prva naloga = qa-round.sh 398 prod-qa re-run [prek r359-prod-qa-retry.sh 398] + "
    "**DVAINPETDESETA (52.) era preverba r347–r398** [52 registrov, ≥195 = 194 + 1 (r398.tsv val 73 "
    "zliti šivni); era-clone.py --src-round 398 --dst-round 399 --expected-total 195; ERA_BESODE 52 "
    "DVAINPETDESETA GLASNO; pričakuj ŽIVO ob pushu — val 73 needle je CSS-nivojski, razreši se ob "
    "R398 deployu; prod .css URL-i ABSOLUTNI iz živega HTML — ⭐ LEKCIJE R398 (1)/(2): CSS "
    "content-hash čanki NISO deterministični čez build okolja (lokalni ≠ Vercel; enako ime = enaka "
    "vsebina velja za .js, NE za .css) + /tmp žetveni seznam je Ephemeren čez seje — preveri in "
    "po potrebi ponovno razširi z backupom] + val 73 POST-deploy verifikacija [CSS needle v .css "
    "čanku + MONTIRANI dokaz: rekurzivni CSSOM walk `.animate-fade-in-up,.slide-in-right` + "
    "`animation:none` pod prefers-reduced-motion media — vzorec r398-val73-mounted.sh; "
    "ZERO-MUTACIJA]."
)

R398_KANDIDATI_STARA = "- R398 kandidati: 1. stil: enojni vstopni animaciji fadeInUp/slideInRight"
R399_KANDIDATI = (
    "- R399 kandidati: 1. slovarska para shimmer/bounce-subtle (×0 klicnih mest): uporabiti v UI "
    "(loading skeleti) ALI iskreno označiti kot mrtvi CSS — odločitev z lastnikom; 2. interaktivni "
    "btn-shine hover sweep reduced-motion odločitev [interaktivna družina kanon val 69 — zahteva "
    "EVOLVED pin odločitev z lastnikom, previdno]; 3. e2e-lib dedup [po kanonu — ni novih ×3]. "
    "⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika. ⚠️ žetona (GitHub + "
    "Vercel) uporabljena — priporočena ROTACIJA. ISSUE #1: ostaja odprt, owner 'Razvoj > QA' "
    "[AGENT STARTUP RULE: razvoj > QA]."
)

BULLET_R398 = (
    "- **VSTOPNE ANIMACIJE REDUCED-MOTION ZAKLJUČEK val 73 (CSS-nivojska — globals.css +25 vrstic "
    "v OBSTOJEČEM .more-tile media guard bloku — media guardov ostane TOČNO 3, zamrznjen kanon "
    "r397 (A); 0 className žetonov → 0 pinov na src; rešuje kandidat 1 iz R397 handoverja — "
    "iskreno dokumentirana meja iz R397 (A)/(B): `.animate-fade-in-up` (fadeInUp 0.3s forwards; "
    "×55 TSX rab) + `.slide-in-right` (slideInRight 300ms forwards; ×14 rab) mirujeta ob "
    "`prefers-reduced-motion: reduce`; `.stagger-children > *` (×0 rab — slovarska para, iskreno) "
    "dobi `opacity: 1` spremljevalca — statično opacity:0 bi ob animation:none ostal NEVIDEN "
    "(isti vzorec kot .more-tile guard); forwards končno stanje = statično, vizualno identično; "
    "interaktivna družina (btn-shine-sweep :hover) ostaja kanon val 69 meja; 0 novih hex) + "
    "FEATURE ENAJSTI STRAŽAR: gibanje-pariteta zaključek (komplet varuhov r385…r394 + r395 + "
    "r396 + r397 + r398; `r398-gibanje-zakljucek.test.ts` ×7: (A) val 73 anchorji ×4 v vstopnem "
    "bloku + 3 media guardi zamrznjeno, (B) ZAKLJUČEK strukturiran dokaz — vsaka "
    "ne-interakcijska animation: deklaracija ima guard ujemnega selektorja, (C) HEX CENZUS 7 "
    "vrednosti stoječi stražar, (D) disk resnica rabe ×55/×14/×0, (E) kompilirani CSS dokaz — "
    "val 73 zliti guard ŽIVO + val 72 guard bajtno nespremenjen z mtime-staleness SKIP, (F) "
    "med-stražarski roki val 71 × 72 × 73, (G) interaktivna meja dokumentirana + slovar cel)** "
    "(R398; KOLIZIJE: brez — fetch-first origin/main == HEAD d8dc884 ob startu): (1) **prva "
    "naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 397`: **ZELEN ob poskusu 1** (29. "
    "runda) + **ENAINPETDESETA (51.) era preverba** `r398-era-harvest.sh` [51 registrov "
    "r347–r397, disk resnica 194 = 193 + 1 (r397 val 72 zliti šivni), era-clone.py --src-round "
    "397 --dst-round 398 --expected-total 194 + ekspliciten --dst-chain-seg (mešan rep; "
    "auto-vzorec ×4 ne ujame); ⭐ LEKCIJA R398 (1): CSS content-hash čanki NISO deterministični "
    "čez build okolja — lokalni 698a1900a928a5e6.css ↔ prod f6eba6f080fd091b.css, ISTA vsebina; "
    "'enako ime = enaka vsebina' (LEKCIJA R354) velja za .js, NE za .css — CSS needleji se "
    "rešujejo prek ŽIVIH prod .css URL-jev (absolutni, LEKCIJA R397 (5)); ⭐ LEKCIJA R398 (2): "
    "/tmp žetveni seznam je Ephemeren čez seje — 60 JS-only URL-jev (R397 +2 .css IZGUBLJENI); "
    "razširjeno na 62 z backupom /tmp/r339-chunkurls.txt.bak-r398, odpadni cenzus poroča iskreno] "
    "**194/194 ŽIVO** EXIT=0 ×2 bajtno [33 SERVER-REZOLUCIJA ŽIVO prek 20 specov + 2 CSS needleja "
    "prek žive žetve f6eba6f0] — val 70/71/72 deployi POTRJENI v celoti; (2) **val 72 POST-deploy "
    "MONTIRANI dokaz** `r398-val72-mounted.sh` (ZERO-MUTACIJA): rekurzivni CSSOM walk — zliti "
    "guard `.badge-pulse,.shine-effect:after,…{animation:none}` ŽIVO pod root > media["
    "prefers-reduced-motion: reduce] + slovarski original pod utilities; prod CDN needle ×1 v "
    "f6eba6f080fd091b.css; (3) **REGISTER** `scripts/qa-needles/r398.tsv` [1 need_static ŠIVNI — "
    "zliti vstopni guard `.animate-fade-in-up,.slide-in-right{animation:none}` ×1 v build CSS "
    "(0d49a822af6ff8bf.css); 0 v HEAD d8dc884; ⭐ LEKCIJA R398 (4): lightningcss SERIALIZIRA "
    "deklaracije v kanoničnem redu (opacity PRED animation) — minificirana oblika ≠ vrstni red v "
    "src; register-write preverja tudi val 72 needle bajtno ×1] prek `r398-register-write.py` "
    "fail-closed; era veriga: TA needle pokrit v 52. preverbi (r347–r398) ≥195 [R399]; (4) "
    "`r398-window-scan.py` **20. generacija** [REG_DO 398; val 73 = globals-only → TARGETS "
    "nespremenjeni]: EXIT=0 (304 okenskih 0 preozkih + 208 needle pinov 0 mrtvih + 150 slice + "
    "0 vrstičnih odstopanj); (5) val 73 LOKALNI MONTIRANI dokaz `r398-val73-mounted.sh` "
    "(ZERO-MUTACIJA): zliti guard + .stagger-children spremljevalec ŽIVO pod "
    "media[prefers-reduced-motion] v lokalnem buildu — prod verifikacija sledi ob R399. "
    "VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5871/5871 (392) FULL "
    "GREEN** [baza 5864/391 + mojih +7/+1] · build svež rm -rf .next EXIT=0 [PRVI — pred "
    "registerjem, LEKCIJA R396 (7)] · qa-round.sh 398 needles EXIT=0 [r398.tsv 1 ŽIVO v .css + "
    "UNION r340–r398 + veriga r339→…→R227] · smoke EXIT=0 [standalone :3100: health ok + "
    "ovojnice 400 + val-3 meja ŽIVO] · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post "
    "r276+r281+r283+r287 — ZERO-MUTACIJA] · era 51. EXIT=0 ×2 bajtno · window-scan EXIT=0 [20. "
    "gen] · r359-prod-qa-retry 397 ZELEN poskus 1 · leak-check čist [ghp_ ×0]. Kontrakt NIČ "
    "(/api/quotes/000/pdf probe = samo fail-closed 401 branje); SDK/BOM/pricing/geometry core "
    "NIČ; measurement jedro NIČ [val 73 = globals.css-only]; viz/** ZAŠČITENO jedro nič (kanon "
    "R167); OgrajaVizija nič; 0 novih hex [STOJIČI stražar (C)]; NIČ novih FNV soli; brez sheme "
    "s strani QA [ZERO-MUTACIJA E2E]. ⭐ LEKCIJA R398 (3): `cmd | tail; echo $?` meri EXIT od "
    "tail, ne skripte — prvi dva teka 51. preverbe sta bila EXIT=2 (ne 0) — CSS needleja sta "
    " ČAKALA URL-popravek; meritev z direktnim EC zajemom."
)


def fail(msg: str) -> None:
    print(f"FAILOVEDANO: {msg}")
    sys.exit(1)


def main() -> None:
    besedilo = README.read_text(encoding="utf-8")
    if NOV_TESTI in besedilo and BULLET_R398[:80] in besedilo:
        print("OPOMBA: R398 posodobitev ŽE prisotna — idempotentno, nič")
        return
    if besedilo.count(STAR_TESTI) != 1:
        fail(f"števec {STAR_TESTI!r} = {besedilo.count(STAR_TESTI)} (pričakovano 1)")
    if besedilo.count(ANCHOR_R397) != 1:
        fail(f"anchor R397 bullet = {besedilo.count(ANCHOR_R397)} (pričakovano 1)")
    if besedilo.count(R398_NALOGA_STARA) != 1:
        fail(f"R398 naloga anchor = {besedilo.count(R398_NALOGA_STARA)} (pričakovano 1)")
    if besedilo.count(R398_KANDIDATI_STARA) != 1:
        fail(f"R398 kandidati anchor = {besedilo.count(R398_KANDIDATI_STARA)} (pričakovano 1)")
    besedilo = besedilo.replace(STAR_TESTI, NOV_TESTI, 1)
    besedilo = besedilo.replace(ANCHOR_R397, BULLET_R398 + "\n" + ANCHOR_R397, 1)
    # R398 naloga → R399 naloga (cela vrstica)
    i = besedilo.index(R398_NALOGA_STARA)
    j = besedilo.index("\n", i)
    besedilo = besedilo[:i] + R399_NALOGA + besedilo[j:]
    # R398 kandidati → R399 kandidati (cela vrstica)
    i = besedilo.index(R398_KANDIDATI_STARA)
    j = besedilo.index("\n", i)
    besedilo = besedilo[:i] + R399_KANDIDATI + besedilo[j:]
    README.write_text(besedilo, encoding="utf-8")
    print(f"OK: README posodobljen — števec {NOV_TESTI} + R398 bullet + R399 naloga/kandidati")


if __name__ == "__main__":
    main()
