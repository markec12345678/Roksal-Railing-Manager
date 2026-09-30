#!/usr/bin/env python3
# R327 — derive r327-run-smoke.sh iz r326 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R327 zapis (54. člen zgodovina cen PDF + STIL val 14)
#   2. Generacijske poti: /tmp/r326- ×7 → /tmp/r327- (smoke cookies + telo +
#     quote + evidence + server log [R326-server-smoke.log → R327-…])
#   3. SESSION_SECRET generacija (R326-smoke → R327-smoke)
#   4. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r326-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r327-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R326 dimni test (vzorec r273/r296-r325; DEDOVINA KOLIZIJE #7: vzporedna lastniška R325 = PRIROJENIŠKA dekompozicija FAZA 2 — ČIST premik, regression-only) — standalone :3100 + javni health +',
    '# R327 dimni test (vzorec r273/r296-r326) — standalone :3100 + javni health +', 1)
zam('# Potrjuje, da build z R326 spremembami (53. ČLEN issue #1 §5: ZGODOVINA',
    '''# Potrjuje, da build z R327 spremembami (54. ČLEN issue #1 IZVOZI: ZGODOVINA
# CEN PDF — deterministični PDF BRAT CSV-ju R326 [NOVI lib cena-zgodovina-pdf;
# EN VIR cenaParVrstice = skupni potrošnik CSV+PDF tabel; FNV soli 0xd1–0xd4;
# panel izvozni PAR CSV+PDF na isti blok glavi — OBA gumba navy/40 ring +
# press-scale, OBA pod istim pogojem — iskrena ničelna veja]; STIL val 14
# harmonizacija izvoznega para; R326 dedovina: 53. ČLEN issue #1 §5: ZGODOVINA''', 1)
zam('# dvonivojska hierarhija na novi površini [par amber/30 + vrstica amber/40])',
    '# dvonivojska hierarhija na novi površini [par amber/30 + vrstica amber/40])', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r326-', '/tmp/r327-', 7)
zam('/tmp/R326-server-smoke.log', '/tmp/R327-server-smoke.log', 1)

# ── 3. SESSION_SECRET ──
zam('R326-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R327-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)

# ── 4. Footer ──
zam('echo "--- R326 SMOKE KONEC ---"', 'echo "--- R327 SMOKE KONEC ---"', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r327-run-smoke.sh zapisan ({len(text)} znakov)')
