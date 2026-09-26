#!/usr/bin/env python3
# R192 fixer v2 — popravi stanje po fixerju v1: večvrstični import bloki so
# izgubili odpirajoči `import {`. Zdaj:
#   import { db } from '@/lib/db'
#   import { auditInTx } from '@/lib/audit'
#     MIN_TOKEN_LENGTH,        ← SIROTA (manjka `import {`)
#   } from '@/lib/portal'
# →
#   import { db } from '@/lib/db'
#   import {
#     MIN_TOKEN_LENGTH,
#   } from '@/lib/portal'
#   import { auditInTx } from '@/lib/audit'
import re
from pathlib import Path

ROOT = Path('/home/z/my-project')
FILES = [
    'src/app/api/measurements/route.ts',
    'src/app/api/equipment/events/route.ts',
    'src/app/api/equipment/route.ts',
    'src/app/api/qc/route.ts',
    'src/app/api/customers/route.ts',
    'src/app/api/evidence/route.ts',
    'src/app/api/portal/route.ts',
    'src/app/api/setup/route.ts',
    'src/lib/measure.ts',
]

pat = re.compile(
    r"import \{ ([^}\n]*) \} from '@/lib/audit'\n"  # vstavljen import
    r"((?:[ \t]+[^\n]*\n)+)"                         # sirote vrstice (imena)
    r"\} from '([^']*)'\n"                           # zaključek bloka
)

for rel in FILES:
    p = ROOT / rel
    src = p.read_text()
    m = pat.search(src)
    if not m:
        print(f'{rel}: čisto')
        continue
    helper_names, orphan_names, lib = m.group(1), m.group(2), m.group(3)
    fixed = (
        "import {\n"
        + orphan_names
        + "} from '" + lib + "'\n"
        + "import { " + helper_names + " } from '@/lib/audit'\n"
    )
    src = src[:m.start()] + fixed + src[m.end():]
    p.write_text(src)
    print(f'{rel}: obnovljen blok (lib={lib}, helperji={helper_names})')
print('FIXER2 KONEC')
