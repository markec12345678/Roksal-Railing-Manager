#!/usr/bin/env python3
# r396-register-write.py — R396 REGISTER needlejev (fail-closed, kanon
# r361/r389/r391/r392/r394): TSV točno 3 polja; needle ŽIVO v buildu
# (.next/static/chunks CSS — val 71 je CSS-nivojska); 0 v HEAD (cf71787);
# need_static=1 usklajeno z era verigo (48. preverba r347–r394 ≥189 = 188 + 1
# njihovih? NE — 188 (r347–r393, 47. preverba R396) + 1 r394.tsv val 70
# šivni; TA needle (r396.tsv) je v 50. preverbi r347–r396 ≥193 = 192 + 1 [49. ≥192 = 189 + 3 njihovih r395 ×3]).
import pathlib
import subprocess
import sys

REPO = pathlib.Path("/home/z/my-project")
REG = REPO / "scripts/qa-needles/r396.tsv"
HEAD = "0dd9e12"

# ŠIV (val 71): minificirani .dark .scrollbar-thin palec par — nova sekvenca
# ne obstaja v HEAD (HEAD globals nosi samo svetli palec + mrtvi -dark
# utility; :hover varianta je byte-drugačna — nosi :hover pred { → brez
# lažnega pozitivnega podniza).
N1 = ".dark .scrollbar-thin::-webkit-scrollbar-thumb{background-color:#475569}"
D1 = ("R396 val 71 dark-mode scrollbar pariteta (×1 pojavitev v build CSS "
      "chunku; globals.css @layer utilities) — .dark .scrollbar-thin palec "
      "#475569 (poveže obstoječo temno govorico družine .scrollbar-thin-dark, "
      "×0 rab mrtvi CSS, VREDNOSTI IZ ISTIH ŽETONOV nič izuma; svetla tema "
      "bajtno nespremenjena; ×33 rab scrollbar-thin po app/roksal dobi temen "
      "palec v temni temi naenkrat — CSS nivo, 0 className žetonov, 0 pinov) "
      "(0 v HEAD cf71787)")

VRSTICE = [
    "# qa-needles/r396.tsv — REGISTER needlejev runde R396 (STIL val 71:",
    "# DARK-MODE SCROLLBAR PARITETA — CSS-nivojska sprememba v globals.css",
    "# (+15 vrstic, 0 className žetonov → 0 pinov na src); .scrollbar-thin",
    "# ×33 rab je v temni temi nosil SVETEL palec #cbd5e1; temna govorica",
    "# družine (.scrollbar-thin-dark #475569 + hover #334155) je bila",
    "# definirana a NIKOLI povezana (×0 rab); val 71 = .dark pariteta s",
    "# VREDNOSTMI IZ ISTIH ŽETONOV. 1 need_static (šivni needle — minificirani",
    "# kompilirani CSS selector je NOV = 0-v-HEAD kanon; ×1 pojavitev);",
    "# TODO-R396 must_miss.",
    "# FEATURE DEVETI STRAŽAR: tema-pariteta disciplina utilities sloja",
    "# (hex cenzus = 7 dokumentiranih vrednosti — 0 novih hex zdaj STOJIČI",
    "# stražar; komplet varuhov r385…+r391+r392+r394+r395).",
    "# Era veriga (KOLIZIJA #27): 48. (r347–r394) ≥189; 49. (r347–r395) ≥192 = 189 + 3",
    "# njihovih r395 ×3; TA needle pokrit v 50. preverbi (r347–r396) ≥193.",
    f"{N1}\t{D1}\tneed_static",
    "TODO-R396\tmust_miss: razvojni ostanki (nesme biti v produkcijskih čankih)\tmust_miss",
]

def main():
    if REG.exists():
        sys.exit(f"FAILOVEDANO: {REG} že obstaja (nikoli prepisuj)")
    # needle ŽIVO v build CSS (točno ×1 — :hover varianta je byte-drugačna)
    css_dir = REPO / ".next/static/chunks"
    if not css_dir.exists():
        sys.exit("FAILOVEDANO: .next/static/chunks ne obstaja (build prvi)")
    c = 0
    for f in css_dir.rglob("*.css"):
        c += f.read_text(errors="ignore").count(N1)
    if c != 1:
        sys.exit(f"FAILOVEDANO: needle ×{c} v build CSS (pričakovano 1)")
    # 0 v HEAD
    r = subprocess.run(["git", "grep", "-F", N1, HEAD, "--", "src", ".next"],
                       cwd=REPO, capture_output=True, text=True)
    if r.returncode == 0:
        sys.exit(f"FAILOVEDANO: needle ŽE v HEAD {HEAD}")
    vsebina = "\n".join(VRSTICE) + "\n"
    for l in VRSTICE:
        if l.startswith("#") or l.startswith("TODO-"):
            continue
        if len(l.split("\t")) != 3:
            sys.exit(f"FAILOVEDANO: vrstica ni 3-poljna: {l[:60]}")
    REG.write_text(vsebina, encoding="utf-8")
    print(f"OK: {REG} zapisan ({len(vsebina)} bajtov; needle ×1 v build CSS, 0 v HEAD {HEAD})")

if __name__ == "__main__":
    main()
