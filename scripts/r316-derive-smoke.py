#!/usr/bin/env python3
# r316-derive-smoke.py — derive r316-run-smoke.sh iz r315-run-smoke.sh
# (generacijski vzorec r305→…→r315; NATANKO ena-n-točkovne zamenjave —
# fail-closed: napačno štetje zadetkov → izpisek + exit 1; štetje na
# POJAVITVE — LEKCIJA R312: /tmp poti se pojavijo ×2 [curl -o + grep]).
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r315-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r316-run-smoke.sh')

s = VIR.read_text(encoding='utf-8')

def zam(staro: str, novo: str, pricakuj: int) -> None:
    global s
    n = s.count(staro)
    if n != pricakuj:
        print(f'FAIL: vzorec {n}× (pričakovano {pricakuj}): {staro[:70]!r}')
        raise SystemExit(1)
    s = s.replace(staro, novo)
    print(f'  OK {pricakuj}× {staro[:56]}')

zam('# R315 dimni test (vzorec r273/r296-r315)', '# R316 dimni test (vzorec r273/r296-r316)', 1)
zam('# Potrjuje, da build z R315 spremembami (45. člen issue #1: KONČNA\n# VERIFIKACIJA PROTI HEAD — Deliverable 7 NA ZASLONU + DOKUMENTIRANO: NOV lib\n# koncna-verifikacija = vezava območij §1–§11 na verifikacijske plasti + 8\n# sprejemnih kriterijev z mehanično izpeljavo, fail-closed ×8; docs/\n# koncna-verifikacija-head.md; STIL harmonizacija val 6: inclinometer/\n# site-survey/ar-scanner/pwa-status/password-change-banner surove amber →\n# žetoni; meja I/O UNIFIKACIJA 49 vezav — regresija dokazana na žici:\n# calculator + val-3 quote/evidence pokvarjen JSON = 400, nikoli 500)',
    '# Potrjuje, da build z R316 spremembami (46. člen issue #1: IZVOZ POROČILA\n# KONČNE VERIFIKACIJE KOT JSON — IZVOZI družina: NOV lib izvoz\n# koncnaVerifikacijaJson = čista projekcija koncnaVerifikacija,\n# determinističen JSON (brez časa/hash); DETERMINIZEM ŽIVO v E2E Z0an (dva\n# izvoza bajtno enaka); STIL harmonizacija val 7 (ZAKLJUČNI): fence-3d-\n# viewer/notification-center/signature-quote/photo-measure surove amber →\n# žetoni + GLOBALNI zakljenjeni register; meja I/O UNIFIKACIJA 49 vezav —\n# regresija dokazana na žici: calculator + val-3 quote/evidence pokvarjen\n# JSON = 400, nikoli 500)', 1)
zam('# NOVO R315: brez nove API površine (končna verifikacija je čista klientska\n# projekcija)',
    '# NOVO R316: brez nove API površine (izvoz je čista klientska projekcija —\n# blob download po kanonu IZVOZI družine)', 1)
zam('R315-smoke-lokalni-sekret', 'R316-smoke-lokalni-sekret', 1)
zam('/tmp/R315-server-smoke.log', '/tmp/R316-server-smoke.log', 1)
zam('/tmp/r315-smoke-cookies.txt', '/tmp/r316-smoke-cookies.txt', 1)
zam('/tmp/r315-smoke-telo.json', '/tmp/r316-smoke-telo.json', 2)
zam('/tmp/r315-smoke-quote.json', '/tmp/r316-smoke-quote.json', 2)
zam('/tmp/r315-smoke-evidence.json', '/tmp/r316-smoke-evidence.json', 2)

# izhodna asercija (LEKCIJA R310 5/6)
assert '/tmp/r315-' not in s, 'ostanki /tmp/r315-'
assert 'R316-smoke-lokalni-sekret' in s, 'sekret manjka'
assert 'set -u' in s or 'set -euo pipefail' in s or '-u' in s, 'strogost manjka'

DOL.write_text(s, encoding='utf-8')
print(f'OK — {DOL.name} zapisan ({len(s.splitlines())} vrstic)')
