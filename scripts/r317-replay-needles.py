#!/usr/bin/env python3
"""R317 — r316-prod-qa.sh needle replay (LIVE harvest ze na disku).

Ekstrahira vse need/must_miss literal argumente iz scripts/r316-prod-qa.sh
in jih ponovno preveri proti /tmp/r316-prod-chunks (LIVE produ harvest iz
zadnjega teka). Izhod: seznam MISS/HIT + fail count — brez ponovnega browser
harvesta (identicna preverba, ker need() grepa isti $OUT).
"""
import re
import sys
from pathlib import Path

SCRIPT = Path('/home/z/my-project/scripts/r316-prod-qa.sh')
OUT = Path('/tmp/r316-prod-chunks')

src = SCRIPT.read_text(encoding='utf-8')

# need "ARG" "label"  /  must_miss "ARG" "label"  (ARG = fiksni niz, brez ")
pat = re.compile(r'^(need|must_miss)\s+"([^"]*)"\s+"([^"]*)"', re.M)

checks = []
for m in pat.finditer(src):
    vrsta, needle, label = m.group(1), m.group(2), m.group(3)
    # bash double-quote decoding: \$ -> $ , \" -> " , \\ -> \
    needle = needle.replace(r'\$', '$').replace(r'\"', '"').replace('\\\\', '\\')
    line_no = src[:m.start()].count('\n') + 1
    checks.append((line_no, vrsta, needle, label))

if not OUT.is_dir():
    print(f'OUT manjka: {OUT} — harvest ni na disku, replay ni mogoč')
    sys.exit(2)

files = sorted(OUT.glob('chunk-*.js'))
if not files:
    print('Ni chunk-*.js v OUT — replay ni mogoč')
    sys.exit(2)

blob = '\n'.join(f.read_text(encoding='utf-8', errors='replace') for f in files)

fail = 0
misses = []
hits_bad = []
for line_no, vrsta, needle, label in checks:
    najdeno = needle in blob
    if vrsta == 'need':
        if not najdeno:
            fail += 1
            misses.append(f'L{line_no} MISS : {label}\n        needle: {needle!r}')
    else:
        if najdeno:
            fail += 1
            hits_bad.append(f'L{line_no} HIT  : {label}\n        needle: {needle!r}')

print(f'Preverjenih {len(checks)} needlejev proti {len(files)} LIVE čankom ({OUT})')
for x in misses:
    print(x)
for x in hits_bad:
    print(x)
print(f'RESULT: fail={fail} (need={len(checks) - len(misses) - len(hits_bad)} ok implied)')
sys.exit(1 if fail else 0)
