#!/usr/bin/env python3
"""R235 (P1-f) — GRAY SREDNJA/solid družina PREGLED (razširitev r168-dark-scan).

r168 pokriva svetle veje (50/100/200) + temna besedila (700-900); MEDROWSKE
gray veje (text-400/500/600, bg-400..700 solid, border-400/500/600) NISO bile
pokrite — r234 lekcija (3): negativni needle ujel measurements OSNUTEK, ki mu
je konverzija ušla ravno v tem slepem kotu. Ta skripta zapre kot.

Izjeme = r168 seznam (zaščiteno jedro / svetla platna / kamera) + dokumentirane
semantične legende (r231/r233/r234: tipMeritveColors.SEGMENT, groundTypeColors
beton/metal, materialStebraColors ALU/INOX/WPC/DRUGO — LEGENDE podatkov, ki
IMEJO dark: mirror in zato legalno preidejo).

Uporaba: python3 r235-dark-scan-gray.py   (dry-run — vedno dry-run: sam pokaže)
"""
import re
import sys
from pathlib import Path

ROOT = Path('/home/z/my-project')
SRC = ROOT / 'src'

IZJEME_DATOTEKE = {
    'src/components/viz/',
    'src/components/roksal/cv-studio.tsx',
    'src/components/roksal/fence-3d-viewer.tsx',
    'src/components/roksal/webxr-scanner.tsx',
    'src/components/roksal/ar-scanner.tsx',
    'src/components/roksal/photo-tab.tsx',
    'src/components/roksal/map-measure.tsx',
    'src/components/roksal/floor-plan-tab.tsx',
    'src/components/roksal/sketch-canvas.tsx',
    # r231/r235 — referenčne realizacije: barColor markerjev Inox (slate-400)
    # / Alu (slate-500) = SEMANTIČNA barvna kodiranja podatkov na zemljevidu
    # (ločljivost legende, r231 odločitev + r233 zaklep data-viz; celoten
    # pregled datoteke pokazal, da so to edina 2 srednja/solid žetona v njej).
    'src/components/roksal/reference-gallery.tsx',
}

NEVTRALNE = r'(?:gray|slate|stone|zinc|neutral)'

# Družina → (vzorec, mirror regex) — mirror na ISTI vrstici = namerna veja.
VZORCI = {
    # srednja besedila 400/500/600 (r235 NOVO — 4513/4514 slepi kot)
    'text-gray-srednji': (
        re.compile(rf"(?<![\w-])text-{NEVTRALNE}-(?:400|500|600)\b"),
        re.compile(r"dark:text-"),
    ),
    # solidna ozadja 400-700 (čip/badge aktivna veja — r234 konverzija)
    'bg-gray-solid': (
        re.compile(rf"(?<![\w-])bg-{NEVTRALNE}-(?:400|500|600|700)\b"),
        re.compile(r"dark:bg-"),
    ),
    # srednje obrobe 400/500/600
    'border-gray-srednji': (
        re.compile(rf"(?<![\w-])border-{NEVTRALNE}-(?:400|500|600)\b"),
        re.compile(r"dark:border-"),
    ),
}


def je_izjema(p: Path) -> bool:
    rel = str(p.relative_to(ROOT))
    return any(rel.startswith(iz) or rel == iz.rstrip('/') for iz in IZJEME_DATOTEKE)


def main() -> None:
    zadetki: dict[str, list[tuple[Path, int, str, str]]] = {}
    for p in sorted(SRC.rglob('*.tsx')) + sorted(SRC.rglob('*.ts')):
        if '__tests__' in p.parts or je_izjema(p):
            continue
        if not (p.name.endswith('.tsx') or 'components' in p.parts):
            continue  # žetoni so relevantni samo v komponentah
        try:
            vrstice = p.read_text(encoding='utf-8').splitlines()
        except Exception:
            continue
        for i, vrsta in enumerate(vrstice, 1):
            if vrsta.strip().startswith('*') or vrsta.strip().startswith('//'):
                continue  # komentarji
            for druzina, (vz, mirror) in VZORCI.items():
                for m in vz.finditer(vrsta):
                    if mirror.search(vrsta):
                        continue  # ima dark: ogledalo — namerna veja
                    zadetki.setdefault(druzina, []).append(
                        (p, i, m.group(0), vrsta.strip()[:110])
                    )

    if not zadetki:
        print('NIČ kandidatov — gray srednja/solid družina popolnoma pokrita.')
        return
    for druzina, seznam in sorted(zadetki.items()):
        print(f"\n=== {druzina}: {len(seznam)} zadetkov ===")
        for p, i, zeton, vrsta in seznam[:25]:
            print(f"  {p.relative_to(ROOT)}:{i}  [{zeton}]")
            print(f"      {vrsta}")
        if len(seznam) > 25:
            print(f"  … in še {len(seznam) - 25}")
    skupaj = sum(len(s) for s in zadetki.values())
    vrstice_zadete = {(str(p), i) for s in zadetki.values() for p, i, _, _ in s}
    print(f"\nSKUPAJ: {skupaj} kandidatov v {len(vrstice_zadete)} vrsticah")
    sys.exit(1 if skupaj else 0)


if __name__ == '__main__':
    main()
