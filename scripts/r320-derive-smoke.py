#!/usr/bin/env python3
# r320-derive-smoke.py — derive r320-run-smoke.sh iz r318-run-smoke.sh
# (generacijski vzorec r305→…→r318; NATANKO ena-n-točkovne zamenjave —
# fail-closed: napačno štetje zadetkov → izpisek + exit 1; štetje na
# POJAVITVE — LEKCIJA R312: /tmp poti se pojavijo ×2 [curl -o + grep]).
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r318-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r320-run-smoke.sh')

s = VIR.read_text(encoding='utf-8')

def zam(staro: str, novo: str, pricakuj: int) -> None:
    global s
    n = s.count(staro)
    if n != pricakuj:
        print(f'FAIL: vzorec {n}× (pričakovano {pricakuj}): {staro[:70]!r}')
        raise SystemExit(1)
    s = s.replace(staro, novo)
    print(f'  OK {pricakuj}× {staro[:56]}')

zam('# R318 dimni test (vzorec r273/r296-r318)', '# R320 dimni test (vzorec r273/r296-r319)', 1)
zam('# Potrjuje, da build z R318 spremembami (48. člen issue #1: IZVOZ\n# AVTOMATIZACIJSKEGA AUDITA KOT PDF — IZVOZI družina: PDF brat CSV R317\n# (vzorec R302): NOV lib buildAvtomatizacijaAuditPdfDoc = čista projekcija\n# AVTOMATIZACIJA_AUDIT prek avtomatizacijaPregled validacije (EN VIR —\n# AUDIT_CSV_GLAVE + AUDIT_VIR_NIZ UVOŽENA iz CSV brata), determinističen\n# PDF (fiksni formatni žig + FNV soli 0xc1–0xc4, brez časa v vsebini);\n# DETERMINIZEM ŽIVO v E2E Z0ap (dva izvoza bajtno enaka); STIL val 9:\n# press-scale mikrointerakcija ×5 vodja izvoznih gumbov (r318-stil-val9\n# STRAŽAR); meja I/O UNIFIKACIJA 49 vezav — regresija dokazana na žici:\n# calculator + val-3 quote/evidence pokvarjen JSON = 400, nikoli 500)',
    '# Potrjuje, da build z R320 spremembami (49. člen issue #1: IZVOZ POROČILA\n# KONČNE VERIFIKACIJE KOT PDF — IZVOZI družina: PDF brat JSON R316 (vzorec\n# R318 audit-pdf: LOČEN lib): NOV lib buildKoncnaVerifikacijaPdfDoc = čista\n# projekcija koncnaVerifikacija validacije (EN VIR — sklep = PETI potrošnik\n# ENEGA niza), determinističen PDF (fiksni formatni žig + FNV soli\n# 0xc5–0xc8, brez časa v vsebini); DETERMINIZEM ŽIVO v E2E Z0aq (dva izvoza\n# bajtno enaka); STIL val 9 register 11→12 (končna PDF gumb press-scale ×6,\n# r318-stil-val9 register R320); meja I/O UNIFIKACIJA 49 vezav — regresija\n# dokazana na žici: calculator + val-3 quote/evidence pokvarjen JSON = 400,\n# nikoli 500)', 1)
zam('# NOVO R318: brez nove API površine (izvoz je čista klientska projekcija —\n# blob download po kanonu IZVOZI družine)',
    '# NOVO R320: brez nove API površine (izvoz je čista klientska projekcija —\n# blob download po kanonu IZVOZI družine)', 1)
zam('R318-smoke-lokalni-sekret', 'R320-smoke-lokalni-sekret', 1)
zam('/tmp/R318-server-smoke.log', '/tmp/R320-server-smoke.log', 1)
zam('/tmp/r318-smoke-cookies.txt', '/tmp/r320-smoke-cookies.txt', 1)
zam('/tmp/r318-smoke-telo.json', '/tmp/r320-smoke-telo.json', 2)
zam('/tmp/r318-smoke-quote.json', '/tmp/r320-smoke-quote.json', 2)
zam('/tmp/r318-smoke-evidence.json', '/tmp/r320-smoke-evidence.json', 2)
zam('echo "--- R318 SMOKE KONEC ---"', 'echo "--- R320 SMOKE KONEC ---"', 1)

# izhodna asercija (LEKCIJA R310 5/6)
assert '/tmp/r318-' not in s, 'ostanki /tmp/r318-'
assert 'R320-smoke-lokalni-sekret' in s, 'sekret manjka'
assert 'set -u' in s or 'set -euo pipefail' in s or '-u' in s, 'strogost manjka'

DOL.write_text(s, encoding='utf-8')
print(f'OK — {DOL.name} zapisan ({len(s.splitlines())} vrstic)')
