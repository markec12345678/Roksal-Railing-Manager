#!/usr/bin/env python3
# R166 — border-roksal-navy/N dark: sweep (determinističen, idempotenten).
#
# Problem (R163 (d) ostanki): obrobe `border-roksal-navy/N` (temnomodra tint
# na svetli kartici) v TEMNI temi izginejo (#1d2b3e na #1a2744 ≈ kontrast
# ~1.1:1) — kartice/delilniki/hover poudarki so brez robov. Tekst se je
# rešil v R162 (roksal-ink), obrobe še ne.
#
# Pravilo (ENAKO kot obstoječa konvencija v kodi — quick-actions-fab,
# audit-trail-dialog, measurements ×3):
#   border-roksal-navy/N            → + dark:border-roksal-ink/M
#   hover:border-roksal-navy/N      → + dark:hover:border-roksal-ink/M
#   focus-visible:border-roksal-navy/N → + dark:focus-visible:border-roksal-ink/M
#   group-hover: … ostali prefiksi se ohranijo (dark:prefixed:roksal-ink/M)
#
# Preslikava prosojnic: 5→10, 10→15 (konvencija obstoječih vrstic), ostalo
# N→N (istovredna videnost, ker je ink v temni #d7e3f4 = svetel).
#
# IZJEME (svetla platna / prekrivni sloji — NAMERNO svetli v OBEH temah,
# ocenjeno posebej R166): floor-plan-tab (risalna platno), cv-studio,
# fence-3d-viewer (3D scena), webxr-viewer, ar-scanner (kamera overlay).
# Te datoteke orodje NE omeni in regresijski stražar jih ne preverja.
#
# Idempotentnost: vrstica z obstoječim dark:border-roksal-ink ostane nedotaknjena.
import re
import sys
from pathlib import Path

REPO = Path("/home/z/my-project")

# Datoteke za sweep (glavne površine; posebne platne izključene po glavi).
DATOTEKE = [
    "src/components/roksal/calculator-tab.tsx",
    "src/components/roksal/measurements-tab.tsx",
    "src/components/roksal/dashboard-tab.tsx",
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

# Vzorec: opcionalni tailwind prefiksi + border-roksal-navy/N (brez dark: na vrstici).
TOKEN = re.compile(
    r"(?<![-\w])((?:[a-z-]+:)*)(border(?:-\w+)*-roksal-navy)/(\d+)(?![\d\w-])"
)
PRESLIKAVA = {5: 10, 10: 15}

def preslikaj(n: int) -> int:
    return PRESLIKAVA.get(n, n)

SKIP = re.compile(r"dark:(?:[a-z-]+:)*border-")  # KAKRŠNAKOLI dark border na vrstici = namerna zasnova (npr. crm amber)

def procesiraj_vrstico(l: str) -> str:
    if SKIP.search(l):
        return l  # že ima dark border zasnovo — idempotentno, brez posredovanja
    if "border-roksal-navy/" not in l:
        return l

    def zamenjaj(m: re.Match) -> str:
        # Doda dark: varianto TAKOJO za vsak navy žeton (ohrani vrstni red razredov).
        return f"{m.group(0)} dark:{m.group(1)}border-roksal-ink/{preslikaj(int(m.group(3)))}"

    nova = TOKEN.sub(zamenjaj, l)
    return nova

def main() -> int:
    popravljene_vrstice = 0
    datoteke_spremembe = []
    for rel in DATOTEKE:
        p = REPO / rel
        if not p.exists():
            print(f"MANJKA: {rel}")
            sys.exit(1)
        original = p.read_text(encoding="utf-8")
        out_lines = []
        count = 0
        for l in original.split("\n"):
            nova = procesiraj_vrstico(l)
            if nova != l:
                count += 1
            out_lines.append(nova)
        if count:
            p.write_text("\n".join(out_lines), encoding="utf-8")
            datoteke_spremembe.append((rel, count))
            popravljene_vrstice += count
    for rel, c in datoteke_spremembe:
        print(f"{c:3d} vrstic  {rel}")
    print(f"SKUPAJ: {popravljene_vrstice} vrstic v {len(datoteke_spremembe)} datotekah")
    return 0

if __name__ == "__main__":
    sys.exit(main())
