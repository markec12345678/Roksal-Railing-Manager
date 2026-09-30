#!/usr/bin/env python3
"""R297 — združi per-tab performance snapshot vrstice (ENA JSON array na
vrstico) v ENO dedup nabor čankov (deterministično — vrstni red prve
pojavitve; overflow-varen naslednik ENEGA skupnega harvesta, ki ga je prvi
resnični stale tek r296-prod-qa razkril kot nedeterminističnega: privzeti
ResourceTiming buffer 250 se preplavi pri 9-12 zavihkih in morebitni reload
med sejo ponastavi vnose — repertuar odpade, needleji lažno MISS).

Raba: merge-chunkurls.py <src-lines> <dst-urls>"""
import json
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print('raba: merge-chunkurls.py <src-lines> <dst-urls>')
        return 1
    src, dst = sys.argv[1], sys.argv[2]
    acc: list[str] = []
    for ln in open(src, encoding='utf-8', errors='replace'):
        ln = ln.strip()
        if not ln:
            continue
        try:
            arr = json.loads(ln)
        except Exception:
            continue
        if isinstance(arr, str):
            try:
                arr = json.loads(arr)
            except Exception:
                continue
        if isinstance(arr, list):
            acc.extend(u for u in arr if isinstance(u, str))
    seen = dict.fromkeys(acc)
    with open(dst, 'w', encoding='utf-8') as f:
        f.write('\n'.join(seen) + ('\n' if seen else ''))
    print(f'merge-chunkurls: {len(seen)} enolicnih cankov')
    return 0


if __name__ == '__main__':
    sys.exit(main())
