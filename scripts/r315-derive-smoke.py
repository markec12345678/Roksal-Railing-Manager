#!/usr/bin/env python3
# r315-derive-smoke.py — derive r315-run-smoke.sh iz r314-run-smoke.sh
# (generacijski vzorec r305→…→r314; NATANKO ena-n-točkovne zamenjave —
# fail-closed: napačno štetje zadetkov → izpisek + exit 1; štetje na
# POJAVITVE — LEKCIJA R312: /tmp poti se pojavijo ×2 [curl -o + grep]).
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r314-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r315-run-smoke.sh')

s = VIR.read_text(encoding='utf-8')

def zam(staro: str, novo: str, pricakuj: int) -> None:
    global s
    n = s.count(staro)
    if n != pricakuj:
        print(f'FAIL: vzorec {n}× (pričakovano {pricakuj}): {staro[:70]!r}')
        raise SystemExit(1)
    s = s.replace(staro, novo)
    print(f'  OK {pricakuj}× {staro[:56]}')

zam('# R314 dimni test (vzorec r273/r296-r314)', '# R315 dimni test (vzorec r273/r296-r315)', 1)
zam('# Potrjuje, da build z R314 spremembami (44. člen issue #1: AUDIT TABELA NA\n# ZASLONU — Deliverable 4: feature-by-feature audit §1–§11 z razredi\n# DETERMINISTICNO/SDK/SKRIPTA/AI_OPCIJSKO/AI_ZAHTEVANO; NOV lib\n# avtomatizacija-pregled = ČISTA projekcija EN VIR audita, fail-closed ×6;\n# STIL harmonizacija val 5: calculator-tab/post-signature-panel/photo-tab\n# surove amber → žetoni; meja I/O UNIFIKACIJA 49 vezav — regresija dokazana\n# na žici: calculator + val-3 quote/evidence pokvarjen JSON = 400, nikoli 500)',
    '# Potrjuje, da build z R315 spremembami (45. člen issue #1: KONČNA\n# VERIFIKACIJA PROTI HEAD — Deliverable 7 NA ZASLONU + DOKUMENTIRANO: NOV lib\n# koncna-verifikacija = vezava območij §1–§11 na verifikacijske plasti + 8\n# sprejemnih kriterijev z mehanično izpeljavo, fail-closed ×8; docs/\n# koncna-verifikacija-head.md; STIL harmonizacija val 6: inclinometer/\n# site-survey/ar-scanner/pwa-status/password-change-banner surove amber →\n# žetoni; meja I/O UNIFIKACIJA 49 vezav — regresija dokazana na žici:\n# calculator + val-3 quote/evidence pokvarjen JSON = 400, nikoli 500)', 1)
zam('# NOVO R314: brez nove API površine (audit tabela je čista klientska\n# projekcija)',
    '# NOVO R315: brez nove API površine (končna verifikacija je čista klientska\n# projekcija)', 1)
zam('R314-smoke-lokalni-sekret', 'R315-smoke-lokalni-sekret', 1)
zam('/tmp/R314-server-smoke.log', '/tmp/R315-server-smoke.log', 1)
zam('/tmp/r314-smoke-cookies.txt', '/tmp/r315-smoke-cookies.txt', 1)
zam('/tmp/r314-smoke-telo.json', '/tmp/r315-smoke-telo.json', 2)
zam('/tmp/r314-smoke-quote.json', '/tmp/r315-smoke-quote.json', 2)
zam('/tmp/r314-smoke-evidence.json', '/tmp/r315-smoke-evidence.json', 2)
zam('--- R314 SMOKE KONEC ---', '--- R315 SMOKE KONEC ---', 1)

DOL.write_text(s, encoding='utf-8')
print('OK — r315-run-smoke.sh izveden (10 zam pravil, vse počete natančne)')
