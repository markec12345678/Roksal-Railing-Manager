#!/usr/bin/env python3
# r396-readme-update.py — README posodobitev NA NJIHOVI postavitvi (KOLIZIJA
# #27; fail-closed, kanon r381/r383/r384/r391/r392/r394): njihov števec
# 5845/388 → 5857/390 [+12/+2: val 71 test ×5 + DEVETI STRAŽAR ×7] + R396
# bullet NAD njihovim R395 bulletom (bajtno ohranjen — vključno z njihovim
# inline prispevkom na številski vrstici).
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
README = REPO / "README.md"

STAR_TESTI = "**5845** (388 datotek, vključno z globalSetup embedded PG)"
NOV_TESTI = "**5857** (390 datotek, vključno z globalSetup embedded PG)"

ANCHOR_R395_NJIHOV = "- **Issue #13, korak R172 — SIGNATURE + DOCUMENT CHAIN (§16): NEPREKINJENA veriga QuoteVersion → DocumentVersi"

BULLET_R396 = (
    "- **DARK-MODE SCROLLBAR PARITETA val 71 (CSS-nivojska — globals.css +15 vrstic, 0 className "
    "žetonov → 0 pinov na src; `.scrollbar-thin` ×33 rab je v temni temi nosil SVETEL palec #cbd5e1; "
    "temna govorica družine `.scrollbar-thin-dark` (#475569 + hover #334155) je bila DEFINIRANA a "
    "NIKOLI povezana — ×0 rab mrtvi CSS; val 71 = `.dark .scrollbar-thin` pariteta z VREDNOSTMI IZ "
    "ISTIH ŽETONOV, nič izuma; svetla tema bajtno nespremenjena; ×33 površin dobi temen palec "
    "naenkrat) + FEATURE DEVETI STRAŽAR: tema-pariteta disciplina utilities sloja (komplet varuhov "
    "r385…r391+r392+r394+r396; hex cenzus = 7 dokumentiranih vrednosti — „0 novih hex“ kanon rund "
    "zdaj STOJIČI stražar) + PRVI CSS-nivojski needle v verigi** "
    "(R396; KOLIZIJA #27 — njihova runda R395 [0dd9e12 — §16 SIGNATURE + DOCUMENT CHAIN] = pristala "
    "resnica; vsi moji artefakti preimenovani r395-→r396-, njihovi bajtno ohranjeni): "
    "(1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 394`: **ZELEN ob poskusu 1** "
    "(27. runda) + **ŠESTINŠTIRIDESIJNA era preverba** `r393-era-harvest.sh` [46 registrov "
    "r347–r392, ≥185 = 184 + 1 — disk resnica iz registrov PRED generacijo (LEKCIJA R394 (1)); "
    "era-clone.py --src-round 392 --dst-round 393 --expected-total 185; ERA_BESODE GLASNO na 46+47] "
    "+ **SEDEMINŠTIRIDESIJNA (47.) era preverba** `r394-era-harvest.sh` [47 registrov r347–r393, "
    "≥188 = 185 + 3 njihovih engineering needlejev; era-clone.py --src-round 393 --dst-round 394; "
    "⭐ **LEKCIJA R396 (1): zamrznjeni SERVER_PROBE_SPECS NE sledijo NOVIM REGISTROM** (2. "
    "potrditev LEKCIJE R392 (1)) — 3 r393 engineering needleji so SERVER-side (.next/server/chunks) "
    "→ brez REG_AU spec-a NERAZREŠLJIVI na produ; 1. tek EXIT=2 z iskrenimi MISS-i; 19. spec "
    "`AU|/api/engineering-rules|401`]: **188/188 ŽIVO** EXIT=0 ×2 bajtno (determinizem); must_miss "
    "×47 čisto; COMPANION r393-era-ruta-map.py + r394-era-ruta-map.py EXIT=0; (2) **val 70 "
    "POST-deploy verifikacija** `r396-qa-spot.sh` (spot-r185/33; ZERO-MUTACIJA): **MONTIRANO DOM** "
    "— measurements fvHiddenMounted 38 + šivni 36 + brezNadomestila 0 + stariOstanek 0; inventory "
    "34 + 32; sonde navy 23/23/0 + red 0; kolektor **0**; build-layer NEODVISNO: **val 70 needle "
    "ŽIVO na prod CDN v 9/60 čankov** (era need_static pokrit v 48. preverbi r347–r394 ≥189 "
    "[R397]); (3) **MANDATORY STIL val 71** — triaža `r396-triaza.py` + `r396-triaza2.py` (10 "
    "družin VSE iskreni zaklepi: duration-* semantična+FROZEN; goli outline-none = meja R394; "
    "ring-offset dark = 0 [R168 remap]; hover:scale = 0 [r392]; focus navy/40 = FROZEN kanon val "
    "52/70; fence-3d = R166 izjema; navy gumbi/text-navy/bg-white papir = namerno; text-[11px] = "
    "brez žetona [2xs=10px]; active:scale = ZAMRZNJENO R392; hover-SNAP 203 = lažno pozitivni "
    "[Button base dednost]) — REALNA družina: **scrollbar temna pariteta** (browser dark sweep "
    "`r396-visual-sweep.sh`; LEKCIJA R396 (4): agent-browser open localhost UBIDE sejo); "
    "`r396-val71-apply.py` fail-closed + IDEMPOTENTEN [1. tek abort: POST-check substrinški hrošč "
    "— ':hover' nosi bazo kot predpono; popravljen z zaključnim ' {' — LEKCIJA R396 (2): POST-"
    "checki štejejo z BESEDNIMI MEJAMI; 3. tek abort — idempotenca DOKAZANA]; "
    "`r396-stil-val71.test.ts` **×5 ZELENO**; (4) **FEATURE DEVETI STRAŽAR — tema-pariteta "
    "disciplina**: `r396-tema-pariteta.test.ts` **×7 ZELENO** [(A) val 71 anchorji, (B) HEX CENZUS "
    "7 dokumentiranih vrednosti — STOJIČI stražar, (C) gradient-text ogledalo, (D) card-hover/"
    "glass-card .dark, (E) družina živa ≥30, (F) kompilirani CSS dokaz — ORDER-DEPENDENCA iskreno "
    "rešena, (G) reduced-motion kanon zamrznjen — kontinuirane zanke = P2 meja]; (5) e2e-lib dedup "
    "ISKRENO IZPUŠČEN (kanon R368). REGISTER `scripts/qa-needles/r396.tsv` [1 need_static ŠIVNI "
    "needle — **PRVI CSS-nivojski v verigi**: `.dark .scrollbar-thin::-webkit-scrollbar-thumb"
    "{background-color:#475569}` minificirani kompilirani selector ×1 v build CSS "
    "(dc370602df67e189.css); 0 v HEAD 0dd9e12; TODO-R396] prek `r396-register-write.py` "
    "fail-closed; era veriga: 48. (r347–r394) ≥189; 49. (r347–r395) ≥192 = 189 + njihovih 3; TA "
    "needle pokrit v 50. preverbi (r347–r396) ≥193 [R397]. r396-window-scan.py **18. generacija** "
    "[naslednik NJIHOVEGA r395-window-scan.py 17. gen; REG_DO 396 — DEL 2 BUILD-CSS fallback, "
    "LEKCIJA R396 (3): CSS-nivojski needleji živijo v minificiranih čankih]: **304 okenskih "
    "regexov 0 preozkih + 203 needle pinov 0 mrtvih + 150 slice-oknen + 0 vrstičnih odstopanj — "
    "EXIT=0**; qa-round.sh žeteva razširjena `\\( -name '*.js' -o -name '*.css' \\)` (aktiven "
    "runner R340-konsolidacija). VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL; 1 "
    "lasten error ujet + popravljen) · vitest **5857/5857 (390) FULL GREEN** [njihova baza "
    "5845/388 + mojih +12/+2] · build svež rm -rf .next EXIT=0 [PRVI — pred registerjem — "
    "LEKCIJA R396 (7)] · qa-round.sh 396 needles EXIT=0 [1074 OK, 113×FAIL=0] · smoke EXIT=0 · "
    "e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN — ZERO-MUTACIJA] · era ×2 ×2 · window-scan EXIT=0 · "
    "r359-prod-qa-retry 394 ZELEN poskus 1 · leak-check čist. Kontrakt NIČ (/api/sync + "
    "/api/catalog* + /api/engineering-rules probe = samo fail-closed 401 branje); SDK/BOM/pricing/"
    "geometry core NIČ; measurement jedro NIČ [val 71 = globals.css utilities-only]; viz/** "
    "ZAŠČITENO jedro nič (kanon R167); OgrajaVizija nič; 0 novih hex [STOJIČI stražar (B)]; NIČ "
    "novih FNV soli; brez sheme s strani QA [ZERO-MUTACIJA E2E]."
)

def main():
    src = README.read_text(encoding="utf-8")
    if "**5857** (390 datotek" in src:
        sys.exit("ABORT (idempotenca): README ŽE nosi 5857/390")
    if STAR_TESTI not in src:
        sys.exit("FAILOVEDANO: njihov števec 5845/388 NI v pričakovani obliki (KOLIZIJA #27 disk resnica drugačna)")
    if ANCHOR_R395_NJIHOV not in src:
        sys.exit("FAILOVEDANO: njihov R395 bullet anchor ni najden")
    out = src.replace(STAR_TESTI, NOV_TESTI, 1)
    i = out.index(ANCHOR_R395_NJIHOV)
    out = out[:i] + BULLET_R396 + "\n" + out[i:]
    assert out.count(NOV_TESTI) == 1
    assert out.count(ANCHOR_R395_NJIHOV) == 1
    assert out.index("DARK-MODE SCROLLBAR PARITETA val 71") < out.index(ANCHOR_R395_NJIHOV)
    assert "**5845** (388 datotek" not in out
    README.write_text(out, encoding="utf-8")
    print("OK: README 5845/388 → 5857/390 + R396 bullet NAD njihovim R395 (bajtno ohranjen)")

if __name__ == "__main__":
    main()
