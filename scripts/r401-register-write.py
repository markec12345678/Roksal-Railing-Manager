#!/usr/bin/env python3
# r401-register-write.py — R401 REGISTER needlejev (fail-closed, kanon
# r361/…/r400): TSV točno 3 polja; needleja ŽIVA v buildu (.next/static/chunks
# CSS — val 75 je CSS-nivojska razglasitev, vzorec r396/val 71: globals.css
# pravilo → build CSS čanek; build PREJ pred register-write, kanon LEKCIJA
# R396 (7)); 0 v HEAD (6abd7b1); need_static=2 usklajeno z era verigo
# (53. preverba r347–r399 tek 1 iskren 194/198 — val 73 + 3× r399 PENDING
# rate-limited deploy; TA registra (r401.tsv ×2) sta v 55. preverbi
# r347–r401 ≥201 = 198 + 1 (r400.tsv val 74) + 2 [R402]).
#
# val 75 = COLOR-SCHEME PARITETA (UA-nativne površine sledijo temi):
#   :root → color-scheme: light;  (izrecna svetla — 100 % determinizem)
#   .dark → color-scheme: dark;   (koledar popup ×10, select popup ×2,
#                                  range sled ×2, autofill — temno-nativno)
# accent-color teh površin NE doseže (UA-lastno krom); ključni besedi,
# 0 novih hex. Disciplina: števca bereta IZ BUILDA (LEKCIJA R398 (4) —
# nikoli napovedana), ×1/×1 potrjena prek grep na svežem buildu.
import pathlib
import subprocess
import sys

REPO = pathlib.Path("/home/z/my-project")
REG = REPO / "scripts/qa-needles/r401.tsv"
HEAD = "6abd7b1"  # moj fetch-first start (needle = 0 v 6abd7b1)

N1 = "color-scheme:dark"
D1 = ("R401 val 75 color-scheme pariteta — temna polovica (×1 pojavitev "
      "v build CSS čanku; globals.css .dark blok) — UA-nativne površine "
      "sledijo temni temi: izbira datuma/časa ×10 mest (koledar popup + "
      "ikona), nativni select popup ×2, range sled ×2, autofill — "
      "accent-color teh NE doseže (UA-lastno krom); brez tega UA odpre "
      "SVETEL koledar popup na temni temi (vidna paritetna vrzel); "
      "ključna beseda, 0 novih hex")

N2 = "color-scheme:light"
D2 = ("R401 val 75 color-scheme pariteta — eksplicitna svetla polovica "
      "(×1 pojavitev v build CSS čanku; globals.css :root blok) — 100 % "
      "determinizem (izrecna razglasitev, nič UA-prislova; enak izris "
      "čez brskalnike); hybridna vrednost „light dark“ PREPOVEDANA "
      "(dvoumna) — r401-color-scheme.test.ts (B)")

VRSTICE = [
    "# qa-needles/r401.tsv — REGISTER needlejev runde R401 (STIL val 75:",
    "# COLOR-SCHEME PARITETA — UA-nativne površine (koledar izbira datuma,",
    "# select popup, range sled, autofill) sledijo temi; CSS-nivojska",
    "# razglasitev (vzorec r396/val 71: globals.css pravilo → build CSS",
    "# čanek). Dodativno v obstoječa bloka :root in .dark (0 novih pravilnih",
    "# blokov, 0 novih hex — ključni besedi light/dark). 2 need_static",
    "# (temna + svetla polovica; 0 v HEAD 6abd7b1; ×1/×1 pojavitev);",
    "# TODO-R401 must_miss.",
    "# FEATURE TRINAJSTI STRAŽAR: color-scheme disciplina —",
    "# r401-color-scheme.test.ts ×7; komplet varuhov r385…r394 + r395 +",
    "# r396 (HEX cenzus) + r397 + r398 + r399 + r400 + r401.",
    "#",
    "# Era: 53. preverba TRETINPETDESETA (r347–r399) tek 1 iskren 194/198",
    "# [val 73 + 3× r399 PENDING — deploy rate-limited 24 h]; TA registra",
    "# (r401.tsv ×2) sta v 55. preverbi r347–r401 ≥201 [R402].",
]


def fail(msg: str) -> None:
    print(f"FAILOVEDANO: {msg}")
    sys.exit(1)


def main() -> None:
    if REG.exists():
        fail(f"register ŽE obstaja (nikoli prepisuj): {REG}")
    chunki = REPO / ".next/static/chunks"
    css = sorted(chunki.glob("*.css"))
    if not css:
        fail("build CSS čanki manjkajo — zaženi `npx next build` PREJ pred register-write (LEKCIJA R396 (7))")
    # števca iz builda (LEKCIJA R398 (4) — nikoli napovedana)
    for needle, pricakovano in [(N1, 1), (N2, 1)]:
        n = sum(f.read_text(encoding="utf-8").count(needle) for f in css)
        if n != pricakovano:
            fail(f"needle v build CSS = {n} (pričakovano točno ×{pricakovano})")
        print(f"OK: needle ×{pricakovano} v build CSS — {needle!r}")
    # nič v JS čankih (čista CSS-nivojska razglasitev — brez JS dvojnic)
    js = sorted(chunki.rglob("*.js"))
    for needle in (N1, N2):
        n = sum(f.read_text(encoding="utf-8", errors="ignore").count(needle) for f in js)
        if n != 0:
            fail(f"needle {needle!r} v build JS = {n} (pričakovano ×0 — čista CSS plast)")
    print("OK: oba needleja ×0 v build JS (čista CSS-nivojska plast)")
    # val 72 + val 73 needleja MORATA ostati bajtno ×1 v build CSS (roki)
    for star, ime in [
        (".badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,.animate-bounce-subtle{animation:none}", "val 72"),
        (".animate-fade-in-up,.slide-in-right{animation:none}", "val 73"),
    ]:
        n = sum(f.read_text(encoding="utf-8").count(star) for f in css)
        if n != 1:
            fail(f"{ime} needle v build CSS = {n} (pričakovano točno ×1 — era veriga se ne sme prelomiti)")
        print(f"OK: {ime} needle bajtno nespremenjen ×1 (med-stražarski roki)")
    # 0-v-HEAD kanon (needle = NOV šiv)
    for needle in (N1, N2):
        r = subprocess.run(
            ["git", "grep", "-cF", "--", needle, HEAD, "--", "src"],
            cwd=REPO, capture_output=True, text=True,
        )
        if r.returncode == 0 and r.stdout.strip():
            fail(f"needle ŽE v HEAD {HEAD} — NI šiv: {needle!r} → {r.stdout.strip()}")
    print(f"OK: 0 v HEAD ({HEAD}) — šivna needleja")
    vsebina = "\n".join(VRSTICE) + "\n" + "\t".join([N1, D1, "need_static"]) + "\n" + "\t".join([N2, D2, "need_static"]) + "\n" + "\t".join([
        "TODO-R401", "must_miss: razvojni ostanki (nesme biti v produkcijskih čankih)", "must_miss",
    ]) + "\n"
    for vrstica in vsebina.splitlines():
        if vrstica.startswith("#"):
            continue
        polja = vrstica.split("\t")
        if len(polja) != 3 or polja[2] not in ("need_static", "must_miss"):
            fail(f"TSV struktura: {vrstica[:60]!r}")
    REG.write_text(vsebina, encoding="utf-8")
    print(f"OK: {REG} zapisan ({len(vsebina)} bajtov; need_static=2 + must_miss=1)")


if __name__ == "__main__":
    main()
