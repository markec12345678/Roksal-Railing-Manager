#!/usr/bin/env python3
# R326 — derive r326-run-smoke.sh iz r324 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R326 zapis (53. člen zgodovina cen + val 13)
#   2. Generacijske poti: /tmp/r324- ×7 → /tmp/r326- (smoke cookies + telo +
#     quote + evidence + server log [R324-server-smoke.log → R326-…])
#   3. SESSION_SECRET generacija (R324-smoke → R326-smoke)
#   4. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r324-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r326-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R324 dimni test (vzorec r273/r296-r323) — standalone :3100 + javni health +\n# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).\n# Potrjuje, da build z R324 spremembami (52. ČLEN issue #1: IZVOZ DNEVNEGA\n# PREGLEDA VODJE KOT PDF — IZVOZI družina: PDF brat CSV R163 — vzorec\n# R318/R320/R321; NOV lib vodja-dnevni-pdf; EN VIR kontrakt R324 v bratu\n# R163 [glave + validacija + vodjaKpiVrstice + VIR_NIZ — CSV arhivska\n# oblika bajtno nespremenjena]; DETERMINIZEM ŽIVO v E2E Z0at [dva izvoza\n# bajtno enaka]; STIL val 12 današnji termini dvonivojski odziv)',
    '# R326 dimni test (vzorec r273/r296-r324) — standalone :3100 + javni health +\n# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).\n# Potrjuje, da build z R326 spremembami (53. ČLEN issue #1 §5: ZGODOVINA\n# CEN MATERIALA — price history: NOVI lib cena-zgodovina [ČISTA projekcija\n# MaterialPrice vključno z zaprto zgodovino; EN VIR glave + CENA_SMER_NIZ\n# + sklep + VIR_NIZ]; NOVI GET route material-prices/zgodovina [r308 obseg\n# 81→82]; NOVI panel CenaZgodovinaPanel na inventory tabu; STIL val 13\n# dvonivojska hierarhija na novi površini [par amber/30 + vrstica amber/40])')

# ── 2. Generacijske poti ──
zam('/tmp/r324-', '/tmp/r326-', 7)
zam('/tmp/R324-server-smoke.log', '/tmp/R326-server-smoke.log', 1)

# ── 3. SESSION_SECRET ──
zam('R324-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R326-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)

# ── 4. Footer ──
zam('echo "--- R324 SMOKE KONEC ---"', 'echo "--- R326 SMOKE KONEC ---"', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r326-run-smoke.sh zapisan ({len(text)} znakov)')
