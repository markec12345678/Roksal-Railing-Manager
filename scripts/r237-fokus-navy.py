#!/usr/bin/env python3
# R237 (P1-f) — fokus revizija 2. faza: 14 osamljenih roksal-amber fokusov
# → navy/40 (skripta r168-dark-scan 'fokus' family — strukturni mirror/tema
# izjeme; ring-2/offset struktura OSTANE, samo barvni token se zamenja).
import re
from pathlib import Path

ROOT = Path('/home/z/my-project')

VRSTICE = [
    ('src/components/roksal/crm-tab.tsx', [522, 715, 724]),
    ('src/components/roksal/dashboard-tab.tsx', [2635]),
    ('src/components/roksal/deal-pipeline.tsx', [212, 228]),
    ('src/components/roksal/inclinometer-tab.tsx', [401]),
    ('src/components/roksal/logistics-tab.tsx', [1000]),
    ('src/components/roksal/measurements-tab.tsx', [4030, 4910, 6478]),
    ('src/components/roksal/onboarding-tour.tsx', [145]),
    ('src/components/roksal/punch-list.tsx', [468, 567]),
]

# Barvni token focus-visible:ring-roksal-amber[/X] → navy/40 (struktura ostane)
TOKEN = re.compile(r'focus-visible:ring-roksal-amber(?:/[\w]+)?(?=\s|$|["\'])')
REPL = 'focus-visible:ring-roksal-navy/40'

sp = 0
for rel, nums in VRSTICE:
    p = ROOT / rel
    lines = p.read_text(encoding='utf-8').splitlines(keepends=True)
    for n in nums:
        old = lines[n - 1]
        new = TOKEN.sub(REPL, old)
        if new == old or 'focus-visible:ring-roksal-amber' in new:
            print(f'PREGLEDATI: {rel}:{n} (ni substitucije ali ostanek)')
        lines[n - 1] = new
        sp += 1
    p.write_text(''.join(lines), encoding='utf-8')
print(f'OK — {sp} vrstic popravljenih')
