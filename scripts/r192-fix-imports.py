#!/usr/bin/env python3
# R192 fixer — premakni napačno vstavljen import '@/lib/audit' iz NOTRANJOSTI
# večvrstičnega import bloka (`import {\n import {...} from '@/lib/audit'`)
# na pravo mesto: ZA zaključkom `} from '...'` tistega bloka.
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

for rel in FILES:
    p = ROOT / rel
    src = p.read_text()
    lines = src.split('\n')
    out = []
    moved = []
    i = 0
    fixed = False
    while i < len(lines):
        ln = lines[i]
        if ln.strip() == 'import {' and i + 1 < len(lines) and "from '@/lib/audit'" in lines[i + 1]:
            # izloči zgrešeno vrstico, jo oddaj na kasnejši zaključek bloka
            moved.append(lines[i + 1].rstrip())
            i += 2
            # poišči zaključek `} from '...'` TEGA bloka (prvi po tej točki)
            while i < len(lines) and not re.match(r"^\} from '", lines[i]):
                out.append(lines[i])
                i += 1
            if i < len(lines):
                out.append(lines[i])  # `} from '...'`
                i += 1
            fixed = True
            continue
        out.append(ln)
        i += 1
    if moved:
        src = '\n'.join(out)
        # vstavi moved importe ZA zadnjim vrsticnim importom (enovrstični ali
        # zakljucek vecvrsticnega) — torej pred prvo ne-import vrstico
        insert_at = None
        for m in re.finditer(r"^import .*?from '.*?'\n", src, re.M):
            insert_at = m.end()
        assert insert_at, f'{rel}: ni importov'
        src = src[:insert_at] + '\n'.join(moved) + '\n' + src[insert_at:]
        p.write_text(src)
        print(f'{rel}: premaknjeno {len(moved)} × {moved}')
    else:
        print(f'{rel}: čisto (ni zgrešene vstavitve)')
print('FIXER KONEC')
