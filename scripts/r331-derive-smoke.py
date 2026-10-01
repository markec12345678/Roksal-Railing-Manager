#!/usr/bin/env python3
# R331 — derive r331-run-smoke.sh iz r330 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R331 zapis (58. člen ponudbe-spomniki CSV + STIL val 18)
#   2. Generacijske poti: /tmp/r330- ×7 → /tmp/r331- (+ R330-server ×1)
#   3. SESSION_SECRET generacija (R330-smoke → R331-smoke)
#   4. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r330-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r331-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R330 dimni test (vzorec r273/r296-r329) — standalone :3100 + javni health +',
    '# R331 dimni test (vzorec r273/r296-r330) — standalone :3100 + javni health +', 1)
zam('''# Potrjuje, da build z R330 spremembami (57. ČLEN issue #1 IZVOZI:
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
# IZVOZI: ZGODOVINA''',
'''# Potrjuje, da build z R331 spremembami (58. ČLEN issue #1 IZVOZI:
# PONUDBE — SPOMNIKI CSV — CSV brat PDF R267 [NOVI lib
# ponudbe-spomniki-csv — vzorec R330/R297: LOČEN lib ki UVAŽA projekcijo
# PDF brata — EN VIR ponudbeSpomnikiPregled, NIČ podvojenih pravil; glava
# VERBATIM PDF autoTable head ×8; Sklep VERBATIM PDF sklepu; meta kanon
# R172→R296; filename Ponudbe-spomniki-YYYY-MM-DD.csv — bratska simetrija;
# ENA izpeljava vira pridobiPonudbeSpomnikiVnosi ×2 — oba brata; TROJICA
# press-scale pariteta — R161 gumb dobi press-scale]; STIL val 18 izvozna
# PAR pariteta na CRM kartici + definicijski naslov medija + legenda
# medija + obrnjene regresije val 15–17; R330 dedovina: 57. ČLEN issue #1
# IZVOZI: PROJEKTI — TERMINI CSV — CSV brat PDF R265 [EN VIR
# projektiTerminiPregled; izvozna PAR na logistiki]; R329 dedovina: 56.
# ČLEN issue #1 IZVOZI: PRIMERJAVA DOBAVITELJEV PDF [EN VIR
# cenaDobaviteljiVrstice; FNV soli 0xd5–0xd8]; R328 dedovina: 55. ČLEN
# issue #1 §5: PRIMERJAVA DOBAVITELJEV [EN VIR — pregled kot PROP; NOVI
# pod panel CenaDobaviteljiPanel — LOČEN datoteka]; R327 dedovina: 54.
# ČLEN issue #1 IZVOZI: ZGODOVINA''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r330-', '/tmp/r331-', 7)
zam('/tmp/R330-server-smoke.log', '/tmp/R331-server-smoke.log', 1)

# ── 3. SESSION_SECRET ──
zam('R330-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R331-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)

# ── 4. Footer ──
zam('echo "--- R330 SMOKE KONEC ---"', 'echo "--- R331 SMOKE KONEC ---"', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r331-run-smoke.sh zapisan ({len(text)} znakov)')
