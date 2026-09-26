#!/usr/bin/env python3
# R192 fixer v3 — vstavi manjkajoči `import {` pred sirote imenske vrstice,
# ki sledijo zaključku prejšnjega import bloka (`} from '...'`).
import re
from pathlib import Path

ROOT = Path('/home/z/my-project')
FILES = [
    'src/app/api/measurements/route.ts',
    'src/app/api/portal/route.ts',
]

name_line = re.compile(r'^  [A-Za-z_][A-Za-z0-9_]*,?\s*$')
closer = re.compile(r"^\} from '")

for rel in FILES:
    p = ROOT / rel
    lines = p.read_text().split('\n')
    out = []
    fixed = 0
    i = 0
    while i < len(lines):
        out.append(lines[i])
        if closer.match(lines[i]) and i + 1 < len(lines) and name_line.match(lines[i + 1]):
            # naslednji blok manjka odpirajoči import { — vstavi ga
            out.append('import {')
            fixed += 1
            i += 1
            # kopiraj imena do zaključka tega bloka
            while i < len(lines) and not closer.match(lines[i]):
                out.append(lines[i])
                i += 1
            continue
        i += 1
    p.write_text('\n'.join(out))
    print(f'{rel}: vstavljenih openerjev: {fixed}')
print('FIXER3 KONEC')
