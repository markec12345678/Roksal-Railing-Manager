#!/usr/bin/env python3
# R322 — derive r322-run-smoke.sh iz r321-run-smoke.sh (KOLIZIJA: vzporedna
# seja je vzela R321 [43f3f7e, 50. člen zmogljivost PDF] — moja runda
# preimenovana R321→R322 po kanonu LEKCIJA 1 vzporednih sej; RE-DERIVACIJA
# iz vzporedne r321 generacije — podeduje njihove needleje + verigo).
# NATANKO ena-n-točkovne zamenjave — fail-closed; štetje na POJAVITVE.
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r321-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r322-run-smoke.sh')

s = VIR.read_text(encoding='utf-8')

def zam(staro: str, novo: str, pricakuj: int) -> None:
    global s
    n = s.count(staro)
    if n != pricakuj:
        print(f'FAIL: vzorec {n}× (pričakovano {pricakuj}): {staro[:70]!r}')
        raise SystemExit(1)
    s = s.replace(staro, novo)
    print(f'  OK {pricakuj}× {staro[:56]}')

zam('# R321 dimni test (vzorec r273/r296-r320)', '# R322 dimni test (vzorec r273/r296-r321)', 1)
zam('# Potrjuje, da build z R321 spremembami (50. člen issue #1: IZVOZ MERITEV\n# ZMOGLJIVOSTI KOT PDF — IZVOZI družina: brat zaslona R312 (vzorec R318/R320:\n# LOČEN lib): NOV lib buildZmogljivostPdfDoc = čista projekcija POSREDOVANEGA\n# pregleda (meritev se izvede ENKRAT v brskalniku — PDF NE meri znova;\n# formatirajMs = EN VIR zaslon + PDF iz brata), determinističen PDF (fiksni\n# formatni žig + FNV soli 0xc9–0xcc, brez časa v vsebini); DETERMINIZEM ŽIVO\n# v E2E Z0ar (dva izvoza bajtno enaka); STIL val 10 dokazni bloki hover ×3\n# (val8 amber ×5→×6 + val9 press-scale ×12→13 PIN SHIFTI); meja I/O\n# UNIFIKACIJA 49 vezav — regresija',
    '# Potrjuje, da build z R322 spremembami (DEKOMPOZICIJA calculator-tab\n# FAZA 1 — PRIROJENIŠKA runda po vzorcu R319: 6.074 → 5.372 vrstic [−702];\n# mapa calculator/ ×5 datotek [shared.ts tipi+konstante VERBATIM + export +\n# 4 SVG diagrami ČIST PREMIK bajtno identično — vsebina ŽIVA v čankih\n# r322-build-needles ×5] + R254 SLEPA PEGA ZAPRTA: vejica v uvoznem\n# komentarju je skrila 5 ikon detektorju — trojni popravek [detektor +\n# codemod + vitest stražar: strip // PRED split] + 5 a11y popravkov IN-PLACE\n# [Bluetooth ×2 + Mic ×3 — aria-hidden, r172 vrstični pin varovan]; pokritost\n# 1430 → 1435, 0 manjkajočih) vstane in odgovarja fail-closed.', 1)
zam('# NOVO R321: brez nove API površine (izvoz je čista klientska projekcija —\n# blob download po kanonu IZVOZI družine) — meja probei ostanejo OBVEZNA regresija (49 vezav EN VIR).',
    '# NOVO R322: brez nove API površine (dekompozicija = čist premik — R319\n# kanon) — meja probei ostanejo OBVEZNA regresija (49 vezav EN VIR).', 1)
zam('/tmp/r321-', '/tmp/r322-', 7)
zam('R321-smoke-lokalni-sekret', 'R322-smoke-lokalni-sekret', 1)
zam('R321-server-smoke.log', 'R322-server-smoke.log', 1)
zam('--- R321 SMOKE KONEC ---', '--- R322 SMOKE KONEC ---', 1)

# izhodna asercija (LEKCIJA R310 5/6)
assert '/tmp/r321-' not in s, 'ostanki /tmp/r321-'
assert 'R322-smoke-lokalni-sekret' in s, 'sekret manjka'
assert 'set -u' in s or '-u' in s, 'strogost manjka'

DOL.write_text(s, encoding='utf-8')
print(f'OK — {DOL.name} zapisan ({len(s.splitlines())} vrstic)')
