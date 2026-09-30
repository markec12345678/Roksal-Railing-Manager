#!/usr/bin/env python3
# R321 — derive r321-run-smoke.sh iz r320-run-smoke.sh (generacijski vzorec).
# VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje
# na POJAVITVE). Transformacije: glava (50. člen + STIL val 10), /tmp/r320- →
# /tmp/r321-, SESSION_SECRET žig, SMOKE KONEC oznaka (LEKCIJA R317 7: derive
# prenese tudi končne oznake).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r320-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r321-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── glava ──
zam('# R320 dimni test (vzorec r273/r296-r319) — standalone :3100 + javni health +',
    '# R321 dimni test (vzorec r273/r296-r320) — standalone :3100 + javni health +')
zam('# Potrjuje, da build z R320 spremembami (49. člen issue #1: IZVOZ POROČILA\n# KONČNE VERIFIKACIJE KOT PDF — IZVOZI družina: PDF brat JSON R316 (vzorec\n# R318 audit-pdf: LOČEN lib): NOV lib buildKoncnaVerifikacijaPdfDoc = čista\n# projekcija koncnaVerifikacija validacije (EN VIR — sklep = PETI potrošnik\n# ENEGA niza), determinističen PDF (fiksni formatni žig + FNV soli\n# 0xc5–0xc8, brez časa v vsebini); DETERMINIZEM ŽIVO v E2E Z0aq (dva izvoza\n# bajtno enaka); STIL val 9 register 11→12 (končna PDF gumb press-scale ×6,\n# r318-stil-val9 register R320); meja I/O UNIFIKACIJA 49 vezav — regresija',
    '# Potrjuje, da build z R321 spremembami (50. člen issue #1: IZVOZ MERITEV\n# ZMOGLJIVOSTI KOT PDF — IZVOZI družina: brat zaslona R312 (vzorec R318/R320:\n# LOČEN lib): NOV lib buildZmogljivostPdfDoc = čista projekcija POSREDOVANEGA\n# pregleda (meritev se izvede ENKRAT v brskalniku — PDF NE meri znova;\n# formatirajMs = EN VIR zaslon + PDF iz brata), determinističen PDF (fiksni\n# formatni žig + FNV soli 0xc9–0xcc, brez časa v vsebini); DETERMINIZEM ŽIVO\n# v E2E Z0ar (dva izvoza bajtno enaka); STIL val 10 dokazni bloki hover ×3\n# (val8 amber ×5→×6 + val9 press-scale ×12→13 PIN SHIFTI); meja I/O\n# UNIFIKACIJA 49 vezav — regresija')
zam('# NOVO R320: brez nove API površine (izvoz je čista klientska projekcija —\n# blob download po kanonu IZVOZI družine) — meja probei ostanejo OBVEZNA regresija (49 vezav EN VIR).',
    '# NOVO R321: brez nove API površine (izvoz je čista klientska projekcija —\n# blob download po kanonu IZVOZI družine) — meja probei ostanejo OBVEZNA regresija (49 vezav EN VIR).')

# ── generacijske poti ──
zam('/tmp/r320-', '/tmp/r321-', 7)
zam('R320-smoke-lokalni-sekret', 'R321-smoke-lokalni-sekret', 1)
zam('R320-server-smoke.log', 'R321-server-smoke.log', 1)
zam('--- R320 SMOKE KONEC ---', '--- R321 SMOKE KONEC ---', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r321-run-smoke.sh zapisan ({len(text)} znakov)')
