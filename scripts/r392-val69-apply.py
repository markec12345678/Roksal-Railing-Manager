#!/usr/bin/env python3
# r392-val69-apply.py — R392 STIL val 69: HOVER-SENČNA GLADKOST (2 × REPL
# in-place, 0 novih vrstic) — material-intelligence Cards L1690 + L1980.
#
# Disk resnica (r392 triaža: edina 2 elementa v CELEM src s hover:shadow-sm
# BREZ shadow/all/arbitrary transition pokritosti — 40 ostalih pokritih):
#   <Card className="transition-colors hover:border-roksal-navy/25
#     dark:hover:border-roksal-ink/25 hover:shadow-sm">
# transition-colors pokriva color/bg/border/… NE box-shadow → hover:shadow-sm
# SNAP. Fix = konzervativna nadgradnja lastnostnega seznama:
#   transition-colors ∪ {box-shadow} =
#   transition-[color,background-color,border-color,text-decoration-color,
#               fill,stroke,box-shadow]
# (brez izgube obstoječe pokritosti, brez izuma;Tailwind v4 transition-colors
# definicija + box-shadow). Družinski precedens: logistics L2360/2466/2659 +
# roksal-catalog L141 uporabljajo ožji [border-color,box-shadow] — tarči imajo
# NAMDENO širši seznam = konzervativno (obstoječa pokritost ohranjena).
# IDEMPOTENTEN: post-fix span = abort na kontraktu (0 novih REPL).
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
F = REPO / "src/components/roksal/material-intelligence-tab.tsx"

STARO_KONTRAKT = 'className="transition-colors hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm"'
NOVO = 'className="transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow] hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm"'
ŽIG = "[EVOLVED R392 val 69"

def main():
    t = F.read_text(encoding="utf-8")
    pre_vrstice = t.count("\n")
    c = t.count(STARO_KONTRAKT)
    if c == 2:
        t = t.replace(STARO_KONTRAKT, NOVO)
    elif c == 0 and t.count(NOVO) == 2:
        print("OPOMBA: val 69 že uporabljen (×2 NOVO) — samo preverba")
    else:
        sys.exit(f"FAILOVEDANO: kontrakt = {c} (pričakovano 2 ali že-uporabljeno)")
    # POST
    if t.count(NOVO) != 2:
        sys.exit(f"FAILOVEDANO: post NOVO = {t.count(NOVO)} (pričakovano 2)")
    if t.count("\n") != pre_vrstice:
        sys.exit("FAILOVEDANO: vrstice spremenjene (0 novih vrstic kanon)")
    if 'transition-colors hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm' in t:
        sys.exit("FAILOVEDANO: star snap span še živ")
    F.write_text(t, encoding="utf-8")
    print(f"OK: val 69 zapisan — 2 × REPL (senčni seznam nadgrajen; {len(t)} bajtov)")

if __name__ == "__main__":
    main()
