#!/usr/bin/env python3
# R323 — derive r323-run-smoke.sh iz vzporedne r322 generacije (kanon
# kolizija LEKCIJA 1). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r322-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r323-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── glava: R323 zapis (51. člen CSV) na vrh dedovine ──
zam('# R322 dimni test (vzorec r273/r296-r321) — standalone :3100 + javni health +\n# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).\n# Potrjuje, da build z R322 spremembami (DEKOMPOZICIJA calculator-tab',
    '# R323 dimni test (vzorec r273/r296-r322) — standalone :3100 + javni health +\n# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).\n# Potrjuje, da build z R323 spremembami (51. ČLEN issue #1: IZVOZ MERITEV\n# ZMOGLJIVOSTI KOT CSV — IZVOZI družina: CSV brat PDF R321 — družinska\n# simetrija kanon: Del. 6 = PDF+CSV; NOV lib buildZmogljivostCsv; EN VIR\n# kontrakt R323 v bratu [glave + validacija + formatirajMs + VIR_NIZ];\n# DETERMINIZEM ŽIVO v E2E Z0as [dva izvoza bajtno enaka]; STIL val 11\n# dokazni bloki sekcija hover ×3) + dedovina vzporedne R322 (DEKOMPOZICIJA calculator-tab')
zam('# NOVO R322: brez nove API površine (dekompozicija = čist premik — R319\n# kanon) — meja probei ostanejo OBVEZNA regresija (49 vezav EN VIR).',
    '# NOVO R323: brez nove API površine (izvoz je čista klientska projekcija —\n# blob download po kanonu IZVOZI družine) — meja probei ostanejo OBVEZNA regresija (49 vezav EN VIR).')

# ── generacijske poti ──
zam('/tmp/r322-', '/tmp/r323-', 7)
zam('R322-smoke-lokalni-sekret', 'R323-smoke-lokalni-sekret', 1)
zam('R322-server-smoke.log', 'R323-server-smoke.log', 1)
zam('--- R322 SMOKE KONEC ---', '--- R323 SMOKE KONEC ---', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r323-run-smoke.sh zapisan ({len(text)} znakov)')
