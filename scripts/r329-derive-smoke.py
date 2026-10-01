#!/usr/bin/env python3
# R329 — derive r329-run-smoke.sh iz r328 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R329 zapis (56. člen PDF brat primerjava dobaviteljev + STIL val 16)
#   2. Generacijske poti: /tmp/r328- ×7 → /tmp/r329-
#   3. SESSION_SECRET generacija (R328-smoke → R329-smoke)
#   4. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r328-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r329-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R328 dimni test (vzorec r273/r296-r327) — standalone :3100 + javni health +',
    '# R329 dimni test (vzorec r273/r296-r328) — standalone :3100 + javni health +', 1)
zam('''# Potrjuje, da build z R328 spremembami (55. ČLEN issue #1 §5: PRIMERJAVA
# DOBAVITELJEV — NOVI lib cena-dobavitelji: drugo grupiranje ISTEGA pregleda
# zgodovine R326 [EN VIR — pregled kot PROP, nič drugega fetcha; iskren
# agregat ŠTEVCEV smeri; NOVI pod panel CenaDobaviteljiPanel — LOČEN
# datoteka; CSV gumb navy/40 ring + press-scale]; STIL val 15 dvonivojska
# hierarhija na novi površini; R327 dedovina: 54. ČLEN issue #1 IZVOZI:
# ZGODOVINA CEN PDF — deterministični PDF BRAT CSV-ju R326 [NOVI lib
# cena-zgodovina-pdf; EN VIR cenaParVrstice; panel izvozni PAR CSV+PDF na
# isti blok glavi — OBA gumba navy/40 ring + press-scale, iskrena ničelna
# veja]; R326 dedovina: 53. ČLEN issue #1 §5: ZGODOVINA''',
'''# Potrjuje, da build z R329 spremembami (56. ČLEN issue #1 IZVOZI:
# PRIMERJAVA DOBAVITELJEV PDF — deterministični PDF BRAT CSV-ju R328 [NOVI
# lib cena-dobavitelji-pdf; EN VIR cenaDobaviteljiVrstice = skupni potrošnik
# CSV+PDF tabel; FNV soli 0xd5–0xd8; panel izvozni PAR CSV+PDF na isti blok
# glavi — OBA gumba navy/40 ring + press-scale, iskrena ničelna veja];
# STIL val 16 iskren alarm WYSIWYG — narašča roksal-red / pada roksal-green;
# R328 dedovina: 55. ČLEN issue #1 §5: PRIMERJAVA DOBAVITELJEV — NOVI lib
# cena-dobavitelji: drugo grupiranje ISTEGA pregleda zgodovine R326 [EN VIR
# — pregled kot PROP; iskren agregat ŠTEVCEV smeri; NOVI pod panel
# CenaDobaviteljiPanel — LOČEN datoteka; CSV gumb navy/40 ring +
# press-scale]; R327 dedovina: 54. ČLEN issue #1 IZVOZI: ZGODOVINA''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r328-', '/tmp/r329-', 7)
zam('/tmp/R328-server-smoke.log', '/tmp/R329-server-smoke.log', 1)

# ── 3. SESSION_SECRET ──
zam('R328-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R329-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)

# ── 4. Footer ──
zam('echo "--- R328 SMOKE KONEC ---"', 'echo "--- R329 SMOKE KONEC ---"', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r329-run-smoke.sh zapisan ({len(text)} znakov)')
