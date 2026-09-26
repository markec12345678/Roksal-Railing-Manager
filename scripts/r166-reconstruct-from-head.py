#!/usr/bin/env python3
# R166 — REKONSTRUKCIJA swept vrstic iz HEAD z enim samim pravilnim pravilom.
#
# Nauček (dokumentirano v worklogu): chain pass1+pass2+dedupA+dedupB je pustil
# 6 vrstic brez zapirajočega navedka. Ta skripta VSE vrstice swept datotek
# (ki so čisto in-place spremembe — numstat adds == dels) prepiše iz HEAD
# vsebine z deterministično transformacijo:
#   f(line) = line, če ima KAKRŠENKOLI dark:...border- (namerna dark zasnova)
#   f(line) = line + " dark:{prefiks}border-roksal-ink/M" za vsak
#             border-roksal-navy/N žeton (PRESLIKAVA 5→10, 10→15, ostalo N→N)
# Rezultat = kot da bi sweep od začetka delal pravilno, brez podvajanj.
import re
import subprocess
import sys
from pathlib import Path

REPO = Path("/home/z/my-project")

DATOTEKE = [
    "src/components/roksal/calculator-tab.tsx",
    "src/components/roksal/measurements-tab.tsx",
    "src/components/roksal/vodja-dashboard.tsx",
    "src/components/roksal/bottom-nav.tsx",
    "src/components/roksal/quote-followup.tsx",
    "src/components/roksal/post-signature-panel.tsx",
    "src/components/roksal/signature-quote.tsx",
    "src/components/roksal/invoice-manager.tsx",
    "src/components/roksal/jobs-panel.tsx",
    "src/components/roksal/roksal-catalog.tsx",
    "src/components/roksal/photo-tab.tsx",
    "src/components/roksal/reference-gallery.tsx",
    "src/components/roksal/material-intelligence-tab.tsx",
    "src/components/roksal/logistics-tab.tsx",
    "src/components/roksal/pdf-export.tsx",
    "src/components/roksal/inventory-tab.tsx",
    "src/components/roksal/site-survey-tab.tsx",
    "src/components/roksal/team-tab.tsx",
    "src/components/roksal/notification-center.tsx",
    "src/components/roksal/crm-tab.tsx",
    "src/components/roksal/deal-pipeline.tsx",
    "src/components/roksal/measurement-studio.tsx",
    "src/components/roksal/inclinometer-tab.tsx",
]

# dashboard-tab izpuščen (ima tudi druge R166 vpise — prek Edit orodja ročno ×3).
SKIP = re.compile(r"dark:(?:[a-z-]+:)*border-")
TOKEN = re.compile(
    r"(?<![-\w])((?:[a-z-]+:)*)(border(?:-\w+)*-roksal-navy)/(\d+)(?![\d\w-])"
)
PRESLIKAVA = {5: 10, 10: 15}

def f(l: str) -> str:
    if SKIP.search(l) or "border-roksal-navy/" not in l:
        return l
    return TOKEN.sub(
        lambda m: f"{m.group(0)} dark:{m.group(1)}border-roksal-ink/{PRESLIKAVA.get(int(m.group(3)), int(m.group(3)))}",
        l,
    )

def head_lines(rel: str) -> list[str]:
    out = subprocess.run(
        ["git", "show", f"HEAD:{rel}"], cwd=REPO, capture_output=True, text=True, check=True
    )
    return out.stdout.split("\n")

def main() -> int:
    ok = True
    for rel in DATOTEKE:
        p = REPO / rel
        cur = p.read_text(encoding="utf-8").split("\n")
        orig = head_lines(rel)
        if len(cur) != len(orig):
            print(f"OPREZKA: {rel} št. vrstic drugačna od HEAD ({len(cur)} vs {len(orig)}) — preskočeno")
            ok = False
            continue
        novo = [f(l) for l in orig]
        if novo != cur:
            p.write_text("\n".join(novo), encoding="utf-8")
            diff_n = sum(1 for a, b in zip(cur, novo) if a != b)
            print(f"rekonstruirano: {rel} ({diff_n} vrstic)")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
