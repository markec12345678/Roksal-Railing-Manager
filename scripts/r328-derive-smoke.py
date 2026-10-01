#!/usr/bin/env python3
# R328 — derive r328-run-smoke.sh iz r327 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R328 zapis (55. člen primerjava dobaviteljev + STIL val 15)
#   2. Generacijske poti: /tmp/r327- ×7 → /tmp/r328-
#   3. SESSION_SECRET generacija (R327-smoke → R328-smoke)
#   4. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r327-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r328-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R327 dimni test (vzorec r273/r296-r326) — standalone :3100 + javni health +',
    '# R328 dimni test (vzorec r273/r296-r327) — standalone :3100 + javni health +', 1)
zam('''# Potrjuje, da build z R327 spremembami (54. ČLEN issue #1 IZVOZI: ZGODOVINA
# CEN PDF — deterministični PDF BRAT CSV-ju R326 [NOVI lib cena-zgodovina-pdf;
# EN VIR cenaParVrstice = skupni potrošnik CSV+PDF tabel; FNV soli 0xd1–0xd4;
# panel izvozni PAR CSV+PDF na isti blok glavi — OBA gumba navy/40 ring +
# press-scale, OBA pod istim pogojem — iskrena ničelna veja]; STIL val 14
# harmonizacija izvoznega para; R326 dedovina: 53. ČLEN issue #1 §5: ZGODOVINA''',
'''# Potrjuje, da build z R328 spremembami (55. ČLEN issue #1 §5: PRIMERJAVA
# DOBAVITELJEV — NOVI lib cena-dobavitelji: drugo grupiranje ISTEGA pregleda
# zgodovine R326 [EN VIR — pregled kot PROP, nič drugega fetcha; iskren
# agregat ŠTEVCEV smeri; NOVI pod panel CenaDobaviteljiPanel — LOČEN
# datoteka; CSV gumb navy/40 ring + press-scale]; STIL val 15 dvonivojska
# hierarhija na novi površini; R327 dedovina: 54. ČLEN issue #1 IZVOZI:
# ZGODOVINA CEN PDF — deterministični PDF BRAT CSV-ju R326 [NOVI lib
# cena-zgodovina-pdf; EN VIR cenaParVrstice; panel izvozni PAR CSV+PDF na
# isti blok glavi — OBA gumba navy/40 ring + press-scale, iskrena ničelna
# veja]; R326 dedovina: 53. ČLEN issue #1 §5: ZGODOVINA''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r327-', '/tmp/r328-', 7)
zam('/tmp/R327-server-smoke.log', '/tmp/R328-server-smoke.log', 1)

# ── 3. SESSION_SECRET ──
zam('R327-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R328-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)

# ── 4. Footer ──
zam('echo "--- R327 SMOKE KONEC ---"', 'echo "--- R328 SMOKE KONEC ---"', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r328-run-smoke.sh zapisan ({len(text)} znakov)')
