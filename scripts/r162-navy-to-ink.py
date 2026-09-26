#!/usr/bin/env python3
"""
R162 — pretvorba text-roksal-navy → text-roksal-ink (adaptivno besedilo).

Ozadje: roksal-navy (#1d2b3e) je v .dark ostal ist (temen) — 700+ uporab
text-roksal-navy je v temni temi NEBERSLJIVih (kontrast ~1.15:1 na temni
kartici). Nov token roksal-ink: svetla tema = #1d2b3e (ista vrednost),
temna tema = #d7e3f4 (svetla niansa, kontrast ~10:1).

PRAVILA PREKLICE:
  1. Vse text-roksal-navy → text-roksal-ink (tudi alpha variante /NN).
  2. IZJEMA (obrzatno povracano na navy): vrstice, kjer besedilo stoji na
     povrsini, ki ostane SVETLA v temni temi:
       - bg-white / bg-white/NN  (beli "papirnati" overlayji na canvasu/map)
       - solid bg-roksal-amber   (amber #f59e0b ostane amber v obeh temah)
       - bg-amber-100 / bg-amber-50 (svetle chips, ostanejo svetle)
Pretvorba je deterministiena, idempotentna (2. zagon = 0 sprememb) in
izpise porocilo po datotekah + seznam vseh izjem za rocni pregled.
"""
import re
import sys
from pathlib import Path

SRC = Path('/home/z/my-project/src')

NAVY = 'text-roksal-navy'
INK = 'text-roksal-ink'

# Vzorca za IZJEME (besedilo na VEDNO svetli podlagi)
RE_WHITE = re.compile(r'bg-white(?:/\d+)?(?![\w-])')
RE_AMBER_SOLID = re.compile(r'bg-roksal-amber(?![/\w-])')
RE_AMBER_LIGHT = re.compile(r'bg-amber-(?:100|50)(?![\w-])')

def is_exempt_line(line: str) -> bool:
    return bool(RE_WHITE.search(line) or RE_AMBER_SOLID.search(line) or RE_AMBER_LIGHT.search(line))

def main():
    if '--revert-check' in sys.argv:
        # Idempotencna preverba: koliko je se navy/ink parov na istih vrsticah
        pass
    changed_files = []
    exempt_lines = []
    total_renamed = 0
    total_exempt = 0
    for path in sorted(SRC.rglob('*.tsx')) + sorted(SRC.rglob('*.ts')):
        if 'node_modules' in str(path):
            continue
        text = path.read_text(encoding='utf-8')
        if NAVY not in text:
            continue
        out_lines = []
        f_renamed = 0
        f_exempt = 0
        for i, line in enumerate(text.split('\n'), 1):
            if NAVY in line:
                if is_exempt_line(line):
                    # ostane navy — izjema
                    f_exempt += len(re.findall(NAVY, line))
                    exempt_lines.append(f'{path.relative_to(SRC.parent)}:{i}: {line.strip()[:160]}')
                    out_lines.append(line)
                    continue
                n = len(re.findall(NAVY, line))
                f_renamed += n
                out_lines.append(line.replace(NAVY, INK))
            else:
                out_lines.append(line)
        if f_renamed > 0:
            path.write_text('\n'.join(out_lines), encoding='utf-8')
            changed_files.append((str(path.relative_to(SRC.parent)), f_renamed, f_exempt))
            total_renamed += f_renamed
        total_exempt += f_exempt
    print(f'PREIMENOVANO: {total_renamed} pojavitev v {len(changed_files)} datotekah')
    print(f'IZJEME (ostane navy): {total_exempt} vrstic')
    for f, r, e in changed_files:
        print(f'  {f}: +{r} ink, {e} izjem')
    print('\n--- IZJEME (rocni pregled) ---')
    for e in exempt_lines:
        print('  ' + e)

if __name__ == '__main__':
    main()
