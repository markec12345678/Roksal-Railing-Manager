#!/usr/bin/env python3
# r394-register-write.py — R394 REGISTER needlejev (fail-closed, kanon
# r361/r389/r391/r392): TSV točno 3 polja; needle ŽIVO v src; 0 v HEAD
# (5d37176); need_static=1 usklajeno z era verigo (naslednja preverba 46.,
# r347–r392, ≥186 = 185 + 1).
import pathlib
import subprocess
import sys

REPO = pathlib.Path("/home/z/my-project")
REG = REPO / "scripts/qa-needles/r394.tsv"
HEAD = "0634c2b"

# ŠIV (val 70 swap): fv_hidden + ring-navy par — nova sekvenca ne obstaja
# nikjer v HEAD (HEAD nosi izključno outline-none; viz precedens nosi goli
# outline-hidden + ring-ROKSAL-AMBER = byte-drugačen → 0-v-HEAD ✓).
N1 = ("focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-navy/40")
D1 = ("R394 val 70 forced-colors fokus pariteta (×64 pojavitev v 24 datotekah, roksal render) — šiv "
      "outline-none→outline-hidden (normal-mode CSS identična: oba outline-style:none; forced-colors "
      "mode: ring/box-shadow NE preživi, outline-hidden obnovi 2px outline = WCAG 2.4.7; družinski "
      "precedens viz ×3 z ring-roksal-amber; swap ×105 čez roksal — ta šiv najpogostejši par z "
      "ring-navy/40) (0 v HEAD 0634c2b)")

VRSTICE = [
    "# qa-needles/r394.tsv — REGISTER needlejev runde R394 (STIL val 70:",
    "# FORCED-COLORS FOKUS PARITETA — 105 × REPL in-place, 0 novih vrstic;",
    "# roksal render plast ×24 datotek; normal-mode kompilirani CSS identična",
    "# (disk dokaz .next/static/chunks), forced-colors: outline-hidden obnovi",
    "# 2px outline ker ring/box-shadow NE preživi forced-colors). 1 need_static",
    "# (šivni needle — sekvenca čez zamenjan žeton je NOVA = 0-v-HEAD kanon;",
    "# ×64 pojavitve — najpogostejši fv_hidden+ring-navy/40 par);",
    "# TODO-R394 must_miss.",
    "# FEATURE OSMI STRAŽAR: outline/fokus indikator disciplina (globalna",
    "# kršitev = 0; komplet varuhov r385…+r391+r392+r394).",
    "# EVOLVED ISTI KORAK (kanon R368): 48 testnih pinov ×27 datotek",
    "# (token-for-token; 3 pričakovane NIČLE ostale) + 32 NASLEDNIC ×18",
    "# registrskih datotek (stare vrstice komentirane dobesedno).",
    "# Naslednja era preverba ≥186 = 185 + 1 [46., r347–r392].",
    f"{N1}\t{D1}\tneed_static",
    "TODO-R394\tmust_miss: razvojni ostanki (nesme biti v produkcijskih čankih)\tmust_miss",
]

def main():
    if REG.exists():
        sys.exit(f"FAILOVEDANO: {REG} že obstaja (nikoli prepisuj)")
    src_all = ""
    for f in sorted((REPO / "src/components/roksal").rglob("*.tsx")):
        src_all += f.read_text(encoding="utf-8")
    c = src_all.count(N1)
    if c != 64:
        sys.exit(f"FAILOVEDANO: needle ×{c} (pričakovano 64 — fv_hidden+ring-navy/40 par)")
    r = subprocess.run(["git", "grep", "-F", N1, HEAD, "--", "src"],
                       cwd=REPO, capture_output=True, text=True)
    if r.returncode == 0:
        sys.exit(f"FAILOVEDANO: needle ŽE v HEAD {HEAD}")
    vsebina = "\n".join(VRSTICE) + "\n"
    for l in VRSTICE:
        if l.startswith("#") or l.startswith("TODO-"):
            continue
        if len(l.split("\t")) != 3:
            sys.exit(f"FAILOVEDANO: vrstica brez 3 polj: {l[:60]}…")
    REG.write_text(vsebina, encoding="utf-8")
    print(f"OK: {REG} zapisan (need_static=1 ×64 pojavitev; naslednja era veriga: 46. (r347–r392) ≥185; ta needle pokrit v 48. preverbi (r347–r394) ≥189)")

if __name__ == "__main__":
    main()
