#!/usr/bin/env python3
# R324 — derive r324-run-smoke.sh iz r323 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R324 zapis (52. člen + val 12)
#   2. Generacijske poti: /tmp/r323- ×7 → /tmp/r324- (smoke cookies + telo +
#     quote + evidence + server log [R323-server-smoke.log → R324-…])
#   3. SESSION_SECRET generacija (R323-smoke → R324-smoke)
#   4. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r323-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r324-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R323 dimni test (vzorec r273/r296-r322) — standalone :3100 + javni health +\n# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).\n# Potrjuje, da build z R323 spremembami (51. ČLEN issue #1: IZVOZ MERITEV\n# ZMOGLJIVOSTI KOT CSV — IZVOZI družina: CSV brat PDF R321 — družinska\n# simetrija kanon: Del. 6 = PDF+CSV; NOV lib buildZmogljivostCsv; EN VIR\n# kontrakt R323 v bratu [glave + validacija + formatirajMs + VIR_NIZ];\n# DETERMINIZEM ŽIVO v E2E Z0as [dva izvoza bajtno enaka]; STIL val 11\n# dokazni bloki sekcija hover ×3)',
    '# R324 dimni test (vzorec r273/r296-r323) — standalone :3100 + javni health +\n# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).\n# Potrjuje, da build z R324 spremembami (52. ČLEN issue #1: IZVOZ DNEVNEGA\n# PREGLEDA VODJE KOT PDF — IZVOZI družina: PDF brat CSV R163 — vzorec\n# R318/R320/R321; NOV lib vodja-dnevni-pdf; EN VIR kontrakt R324 v bratu\n# R163 [glave + validacija + vodjaKpiVrstice + VIR_NIZ — CSV arhivska\n# oblika bajtno nespremenjena]; DETERMINIZEM ŽIVO v E2E Z0at [dva izvoza\n# bajtno enaka]; STIL val 12 današnji termini dvonivojski odziv)')

# ── 2. Generacijske poti ──
zam('/tmp/r323-', '/tmp/r324-', 7)
zam('/tmp/R323-server-smoke.log', '/tmp/R324-server-smoke.log', 1)

# ── 3. SESSION_SECRET ──
zam('R323-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R324-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)

# ── 4. Footer ──
zam('echo "--- R323 SMOKE KONEC ---"', 'echo "--- R324 SMOKE KONEC ---"', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r324-run-smoke.sh zapisan ({len(text)} znakov)')
