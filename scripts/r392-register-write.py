#!/usr/bin/env python3
# r392-register-write.py — R392 REGISTER needlejev (fail-closed, kanon
# r361/r389/r391): TSV točno 3 polja; needle ŽIVO v src (×2 — oba val 69
# Card spana bajtno identična); 0 v HEAD (0238292); need_static=1 usklajeno
# z era verigo (naslednja preverba ≥183 = 182 + 1).
import pathlib
import subprocess
import sys

REPO = pathlib.Path("/home/z/my-project")
REG = REPO / "scripts/qa-needles/r392.tsv"
HEAD = "0238292"

# ŠIV (material-intelligence L1690+L1980): transition-colors → nadgrajeni
# seznam (box-shadow dodan) — nova sekvenca ne obstaja nikjer v HEAD
# (logistics/roksal-catalog precedensi nosijo OŽJI seznam [border-color,
# box-shadow] — byte-drugačen → 0-v-HEAD ✓)
N1 = ("transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow] "
      "hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm")
D1 = ("R392 val 69 material-intelligence L1690+L1980 (×2, Card sorojenci) — šiv transition-colors→"
      "transition-[…,box-shadow] (hover:shadow-sm SNAP → gladak; konzervativna nadgradnja = "
      "transition-colors definicija ∪ {box-shadow}, brez izgube pokritosti; družinski precedens "
      "logistics/roksal-catalog z ožjim seznamom) (0 v HEAD 0238292)")

VRSTICE = [
    "# qa-needles/r392.tsv — REGISTER needlejev runde R392 (STIL val 69:",
    "# HOVER-SENČNA GLADKOST — 2 × REPL in-place, 0 novih vrstic; edina 2",
    "# elementa v CELEM src s hover:shadow-sm BREZ senčne pokritosti; fix =",
    "# konzervativna nadgradnja transition-colors ∪ {box-shadow}). 1 need_static",
    "# (šivni needle — sekvenca čez nadgrajen seznam je NOVA = 0-v-HEAD kanon;",
    "# ×2 pojavitvi — Card sorojenci); TODO-R392 must_miss.",
    "# FEATURE SEDMI STRAŽAR: hover-transform + senčna pokritost disciplina",
    "# (globalna kršitev = 0; komplet varuhov r385…+r391+r392).",
    "# Naslednja era preverba ≥183 = 182 + 1 [45., r347–r391].",
    f"{N1}\t{D1}\tneed_static",
    "TODO-R392\tmust_miss: razvojni ostanki (nesme biti v produkcijskih čankih)\tmust_miss",
]

def main():
    if REG.exists():
        sys.exit(f"FAILOVEDANO: {REG} že obstaja (nikoli prepisuj)")
    src_all = ""
    for f in sorted((REPO / "src/components").rglob("*.tsx")):
        src_all += f.read_text(encoding="utf-8")
    c = src_all.count(N1)
    if c != 2:
        sys.exit(f"FAILOVEDANO: needle ×{c} (pričakovano 2 — Card sorojenci v render plasti)")
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
    print(f"OK: {REG} zapisan (need_static=1 ×2 pojavitev; naslednja era ≥183)")

if __name__ == "__main__":
    main()
