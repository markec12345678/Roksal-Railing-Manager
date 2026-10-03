#!/usr/bin/env python3
# r398-register-write.py — R398 REGISTER needlejev (fail-closed, kanon
# r361/r389/r391/r392/r394/r396/r397): TSV točno 3 polja; needle ŽIVO v
# buildu (.next/static/chunks CSS — val 73 je CSS-nivojska, kanon LEKCIJA
# R396 (7): build PREJ pred register-write, ker šivni needle rabi
# minificirani CSS); 0 v HEAD (d8dc884); need_static=1 usklajeno z era
# verigo (51. preverba r347–r397 = 194 ŽIVO ×2 [ta runda]; TA needle
# (r398.tsv) je v 52. preverbi r347–r398 ≥195 = 194 + 1 [R399]).
#
# ⭐ LEKCIJA R397 (3) — lightningcss ZLIJE media-guard selektorje z ENAKIMI
# deklaracijami v ENO pravilo: src pretty dva ločena bloka (.animate-
# fade-in-up + .slide-in-right) → build zliti selector list
# `.animate-fade-in-up,.slide-in-right{animation:none}`.
# ⭐ LEKCIJA R398 (4) — lightningcss SERIALIZIRA deklaracije v kanoničnem
# redu (opacity PRED animation): .stagger-children>* guard src
# `animation: none; opacity: 1` → build `{opacity:1;animation:none}`
# (minificirana oblika ≠ vrstni red v src).
import pathlib
import subprocess
import sys

REPO = pathlib.Path("/home/z/my-project")
REG = REPO / "scripts/qa-needles/r398.tsv"
HEAD = "d8dc884"

N1 = ".animate-fade-in-up,.slide-in-right{animation:none}"
D1 = ("R398 val 73 vstopne animacije reduced-motion zaključek (×1 pojavitev "
      "v build CSS chunku; globals.css — lightningcss zliti selector list, "
      "LEKCIJA R397 (3)) — ob prefers-reduced-motion: reduce mirujeta tudi "
      "vstopni animaciji fadeInUp (.animate-fade-in-up ×55 rab) + "
      "slideInRight (.slide-in-right ×14 rab); kandidat 1 iz R397 "
      "handoverja — iskreno dokumentirana meja iz R397 (A)/(B) rešena; "
      ".stagger-children>* dobi opacity:1 spremljevalca (statično opacity:0 "
      "bi ostal neviden; build oblika {opacity:1;animation:none} — "
      "LEKCIJA R398 (4) kanonični redeklaracij); forwards končno stanje = "
      "statično, vizualno identično; interaktivna družina (btn-shine-sweep "
      ":hover) ostaja kanon val 69 meja; 0 novih hex; CSS nivo, 0 className "
      "žetonov, 0 pinov na src (0 v HEAD d8dc884)")

VRSTICE = [
    "# qa-needles/r398.tsv — REGISTER needlejev runde R398 (STIL val 73:",
    "# VSTOPNE ANIMACIJE reduced-motion zaključek — 100 % pokritost",
    "# neinterakcijskih animacij; CSS-nivojska sprememba v globals.css",
    "# (+25 vrstic v OBSTOJEČEM .more-tile media guard bloku — media",
    "# guardov ostane TOČNO 3, zamrznjen kanon r397 (A); 0 className",
    "# žetonov → 0 pinov na src); rešuje kandidat 1 iz R397 handoverja:",
    "# .animate-fade-in-up (fadeInUp 0.3s forwards; ×55 TSX rab) +",
    "# .slide-in-right (slideInRight 300ms forwards; ×14 rab) mirujeta ob",
    "# prefers-reduced-motion: reduce; .stagger-children > * (×0 rab —",
    "# slovarska para, iskreno) dobi opacity:1 spremljevalca (isti vzorec",
    "# kot .more-tile guard). 1 need_static (šivni needle — lightningcss",
    "# ZLITI selector list je NOV = 0-v-HEAD kanon; ×1 pojavitev);",
    "# TODO-R398 must_miss.",
    "# FEATURE ENAJSTI STRAŽAR: gibanje-pariteta zaključek (strukturiran",
    "# dokaz pokritosti) — r398-gibanje-zakljucek.test.ts ×7; komplet",
    "# varuhov r385…r394 + r395 + r396 (HEX cenzus) + r397 + r398.",
    "#",
    "# KOLIZIJE: brez (fetch-first origin/main == HEAD d8dc884 ob startu).",
    "# Era: 51. preverba (r347–r397) 194/194 ŽIVO ×2 [LEKCIJA R398 (1):",
    "# CSS content-hash čanki NISO deterministični čez build okolja —",
    "# lokalni 698a1900a928a5e6.css ↔ prod f6eba6f080fd091b.css, ista",
    "# vsebina; žive prod .css URL-je iz HTML, ABSOLUTNE]; TA needle",
    "# (r398.tsv) je v 52. preverbi r347–r398 ≥195 [R399].",
]


def fail(msg: str) -> None:
    print(f"FAILOVEDANO: {msg}")
    sys.exit(1)


def main() -> None:
    if REG.exists():
        fail(f"register ŽE obstaja (nikoli prepisuj): {REG}")
    build_css = sorted((REPO / ".next/static/chunks").glob("*.css"))
    if not build_css:
        fail("build CSS manjka — zaženi `npx next build` PREJ pred register-write (LEKCIJA R396 (7))")
    skupaj = sum(f.read_text(encoding="utf-8").count(N1) for f in build_css)
    if skupaj != 1:
        fail(f"needle v build CSS = {skupaj} (pričakovano točno ×1)")
    print(f"OK: needle ×1 v build CSS")
    # val 72 needle MORA ostati bajtno nespremenjen (med-stražarski roki)
    N72 = ".badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,.animate-bounce-subtle{animation:none}"
    skupaj72 = sum(f.read_text(encoding="utf-8").count(N72) for f in build_css)
    if skupaj72 != 1:
        fail(f"val 72 needle v build CSS = {skupaj72} (pričakovano točno ×1 — era veriga se ne sme prelomiti)")
    print("OK: val 72 needle bajtno nespremenjen ×1 (med-stražarski roki)")
    # 0-v-HEAD kanon
    r = subprocess.run(
        ["git", "grep", "-cF", "--", N1, HEAD, "--", "src"],
        cwd=REPO, capture_output=True, text=True,
    )
    if r.returncode == 0 and r.stdout.strip():
        fail(f"needle ŽE v HEAD {HEAD} — NI šiv: {r.stdout.strip()}")
    print(f"OK: 0 v HEAD ({HEAD}) — šivni needle")
    # 0 v src (CSS-nivojska sprememba = 0 className žetonov)
    r2 = subprocess.run(
        ["git", "grep", "-lF", "--", N1, "--", "src"],
        cwd=REPO, capture_output=True, text=True,
    )
    if r2.returncode == 0 and r2.stdout.strip():
        fail(f"needle v src (pričakovano 0 — CSS nivo): {r2.stdout.strip()}")
    vsebina = "\n".join(VRSTICE) + "\n" + "\t".join([N1, D1, "need_static"]) + "\n" + "\t".join([
        "TODO-R398", "must_miss: razvojni ostanki (nesme biti v produkcijskih čankih)", "must_miss",
    ]) + "\n"
    for vrstica in vsebina.splitlines():
        if vrstica.startswith("#"):
            continue
        polja = vrstica.split("\t")
        if len(polja) != 3 or polja[2] not in ("need_static", "must_miss"):
            fail(f"TSV struktura: {vrstica[:60]!r}")
    REG.write_text(vsebina, encoding="utf-8")
    print(f"OK: {REG} zapisan ({len(vsebina)} bajtov; need_static=1 + must_miss=1)")


if __name__ == "__main__":
    main()
