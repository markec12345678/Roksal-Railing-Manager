#!/usr/bin/env python3
# r390-register-write.py — R390 REGISTER needlejev (fail-closed, kanon
# r361/r389): TSV točno 3 polja; needle ŽIVO v src (post-fix); 0 v HEAD
# (35edf80) — načelo 0-v-HEAD (needle MORA prečkati šiv, kjer je bil
# press-scale odstranjen, sicer je podspan HEAD spana = lažno 'že v HEAD');
# need_static=2 usklajeno z era verigo (naslednja preverba ≥175 = 173 + 2).
import pathlib
import subprocess
import sys

REPO = pathlib.Path("/home/z/my-project")
REG = REPO / "scripts/qa-needles/r390.tsv"
HEAD = "35edf80"

# ŠIV 1 (calculator L820): press-scale je bil MED 'duration-150' in 'shrink-0'
N1 = ("flex items-center gap-1.5 rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 px-2.5 py-1.5 "
      "text-[11px] font-medium text-roksal-ink hover:bg-roksal-amber/20 active:scale-[0.96] transition-all "
      "duration-150 shrink-0")
D1 = ("R390 val 68 calculator L820 (×1) — šiv duration-150→shrink-0 (press-scale odstranjen; dual mehanizem "
      "transform:scale(.97) × scale:.96 = množičen skrček 0.9312); utility active:scale-[0.96] ostane edini "
      "mehanizem (0 v HEAD 35edf80)")

# ŠIV 2 (inventory L1562): press-scale je bil MED 'tabular-nums' in
# 'focus-visible:outline-none' — ta sekvenca je NOVA (bratje nosijo
# 'tabular-nums press-scale focus-visible' — vrsta ne obstaja v HEAD)
N2 = ("font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40")
D2 = ("R390 val 68 inventory L1562 (×1) — šiv tabular-nums→focus-visible (press-scale odstranjen; "
      "element-specifičen active:scale-[0.96] ostane; NASLEDNICA r363 needleja v isti rundi — kanon R368) "
      "(0 v HEAD 35edf80)")

VRSTICE = [
    "# qa-needles/r390.tsv — REGISTER needlejev runde R390 (STIL val 68:",
    "# PRESS-SCALE DVOJNI MEHANIZEM RESOLUCIJA — 10 × REPL in-place,",
    "# 0 novih vrstic). Disk resnica rundi [r390-triaza.py element-točna +",
    "# r390-pinscan.py pin-shift pre-skan + zgrajen CSS: .press-scale:active",
    "# = transform:scale(.97), .active\\:scale-\\[0\\.96\\]:active = scale:.96 —",
    "# neodvisni lastnosti, ko-obstoj = 0.9312 množičen skrček; LEKCIJA R390:",
    "# EN element = EN press mehanizem]. 2 need_static (šivni needleja —",
    "# sekvenca čez odstranjeni press-scale žeton je NOVA = 0-v-HEAD kanon);",
    "# TODO-R390 must_miss. EVOLVED: r363.tsv NASLEDNICA-3 (press-scale žeton",
    "# iz needleja) + 5 testnih pinov — vse v isti rundi (kanon R368).",
    "# Naslednja era preverba ≥175 = 173 + 2.",
    f"{N1}\t{D1}\tneed_static",
    f"{N2}\t{D2}\tneed_static",
    "TODO-R390\tmust_miss: razvojni ostanki (nesme biti v produkcijskih čankih)\tmust_miss",
]

def main():
    if REG.exists():
        sys.exit(f"FAILOVEDANO: {REG} že obstaja (nikoli prepisuj)")
    src_all = ""
    for f in sorted(list((REPO / "src").rglob("*.tsx")) + list((REPO / "src").rglob("*.ts"))):
        src_all += f.read_text(encoding="utf-8")
    for needle, desc in [(N1, D1), (N2, D2)]:
        c = src_all.count(needle)
        if c < 1:
            sys.exit(f"FAILOVEDANO: needle ni ŽIVO v src ({c}×): {needle[:70]}…")
        # 0-v-HEAD: needle (nov šivni sekvenca) NE obstaja v HEAD blobih
        r = subprocess.run(["git", "grep", "-F", needle, HEAD, "--", "src"],
                           cwd=REPO, capture_output=True, text=True)
        if r.returncode == 0:
            sys.exit(f"FAILOVEDANO: needle ŽE v HEAD {HEAD}:\n{r.stdout[:300]}")
    vsebina = "\n".join(VRSTICE) + "\n"
    for l in VRSTICE:
        if l.startswith("#") or l.startswith("TODO-"):
            continue
        if len(l.split("\t")) != 3:
            sys.exit(f"FAILOVEDANO: vrstica brez 3 polj: {l[:60]}…")
    REG.write_text(vsebina, encoding="utf-8")
    print(f"OK: {REG} zapisan ({len(vsebina)} bajtov; need_static=2, naslednja era ≥175)")

if __name__ == "__main__":
    main()
