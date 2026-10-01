#!/usr/bin/env python3
# R330 — derive r330-run-smoke.sh iz r329 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R330 zapis (57. člen projekti-termini CSV + STIL val 17)
#   2. Generacijske poti: /tmp/r329- ×7 → /tmp/r330- (+ R329-server ×1)
#   3. SESSION_SECRET generacija (R329-smoke → R330-smoke)
#   4. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r329-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r330-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R329 dimni test (vzorec r273/r296-r328) — standalone :3100 + javni health +',
    '# R330 dimni test (vzorec r273/r296-r329) — standalone :3100 + javni health +', 1)
zam('''# Potrjuje, da build z R329 spremembami (56. ČLEN issue #1 IZVOZI:
# PRIMERJAVA DOBAVITELJEV PDF — deterministični PDF BRAT CSV-ju R328 [NOVI
# lib cena-dobavitelji-pdf; EN VIR cenaDobaviteljiVrstice = skupni potrošnik
# CSV+PDF tabel; FNV soli 0xd5–0xd8; panel izvozni PAR CSV+PDF na isti blok
# glavi — OBA gumba navy/40 ring + press-scale, iskrena ničelna veja];
# STIL val 16 iskren alarm WYSIWYG — narašča roksal-red / pada roksal-green;
# R328 dedovina: 55. ČLEN issue #1 §5: PRIMERJAVA DOBAVITELJEV — NOVI lib
# cena-dobavitelji: drugo grupiranje ISTEGA pregleda zgodovine R326 [EN VIR
# — pregled kot PROP; iskren agregat ŠTEVCEV smeri; NOVI pod panel
# CenaDobaviteljiPanel — LOČEN datoteka; CSV gumb navy/40 ring +
# press-scale]; R327 dedovina: 54. ČLEN issue #1 IZVOZI: ZGODOVINA''',
'''# Potrjuje, da build z R330 spremembami (57. ČLEN issue #1 IZVOZI:
# PROJEKTI — TERMINI CSV — CSV brat PDF R265 [NOVI lib projekti-termini-csv
# — vzorec R297 oprema-cikel-csv: LOČEN lib ki UVAŽA projekcijo PDF brata —
# EN VIR projektiTerminiPregled, NIČ podvojenih pravil; glava VERBATIM PDF
# autoTable head; Sklep VERBATIM PDF sklepu; meta kanon R172→R296; filename
# Projekti-termini-YYYY-MM-DD.csv — bratska simetrija; ENA izpeljava vira
# pridobiProjektiTerminiVnosi ×2 — oba brata]; STIL val 17 izvozna PAR
# pariteta na logistiki + definicijski naslov medija + obrnjene regresije
# val 15/16; R329 dedovina: 56. ČLEN issue #1 IZVOZI: PRIMERJAVA
# DOBAVITELJEV PDF — deterministični PDF BRAT CSV-ju R328 [EN VIR
# cenaDobaviteljiVrstice; FNV soli 0xd5–0xd8; panel izvozni PAR CSV+PDF];
# R328 dedovina: 55. ČLEN issue #1 §5: PRIMERJAVA DOBAVITELJEV — NOVI lib
# cena-dobavitelji [EN VIR — pregled kot PROP; NOVI pod panel
# CenaDobaviteljiPanel — LOČEN datoteka]; R327 dedovina: 54. ČLEN issue #1
# IZVOZI: ZGODOVINA''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r329-', '/tmp/r330-', 7)
zam('/tmp/R329-server-smoke.log', '/tmp/R330-server-smoke.log', 1)

# ── 3. SESSION_SECRET ──
zam('R329-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R330-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)

# ── 4. Footer ──
zam('echo "--- R329 SMOKE KONEC ---"', 'echo "--- R330 SMOKE KONEC ---"', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r330-run-smoke.sh zapisan ({len(text)} znakov)')
