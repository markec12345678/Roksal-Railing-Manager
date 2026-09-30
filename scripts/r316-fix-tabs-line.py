#!/usr/bin/env python3
# r316-fix-tabs-line.py — popravi R315_TABS vrstico v r315-prod-qa.sh:
# ena ENOJNA single-quoted str z GOlimi narekovaji (brez_literalnih_backslashov),
# 15 objektov ločenih s presledkom (word-splitting varno — objekti brez presledkov).
import json

P = '/home/z/my-project/scripts/r315-prod-qa.sh'
items = [
    ('dashboard', None, None),
    ('measurements', None, None),
    ('inventory', None, None),
    ('more', 'documents', None),
    ('more', 'material', 'suppliers'),
    ('more', 'crm', None),
    ('more', 'material', 'orders'),
    ('more', 'logistics', None),
    ('inclinometer', None, None),
    ('calculator', None, None),
    ('photos', None, None),
    ('more', 'cvstudio', None),
    ('more', 'vodja', None),
    ('more', 'teren', None),
    ('more', 'ekipa', None),
]
objs = [{"tab": t, "more": m, "subTab": s, "osnutek": None, "filter": None}
        for t, m, s in items]
line = "R315_TABS='" + ' '.join(json.dumps(o, separators=(',', ':'), ensure_ascii=False) for o in objs) + "'"

src = open(P, encoding='utf-8').read()
lines = src.split('\n')
idx = [i for i, l in enumerate(lines) if l.startswith('R315_TABS=')]
assert len(idx) == 1, 'pričakovana NATANKO 1 R315_TABS vrstica, najdenih ' + str(len(idx))
lines[idx[0]] = line
open(P, 'w', encoding='utf-8').write('\n'.join(lines))
print('OK — vrstica', idx[0] + 1, 'prepisana; dolžina', len(line))
