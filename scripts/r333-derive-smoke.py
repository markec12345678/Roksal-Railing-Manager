#!/usr/bin/env python3
# R333 — derive r333-run-smoke.sh iz r332 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R333 zapis (60. člen pozicija dobaviteljev CSV brat)
#   2. Generacijske poti: /tmp/r332- (7) → /tmp/r333-
#   3. SMOKE sekret: R332-smoke → R333-smoke
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r332-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r333-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (59. člen → 60. člen zapis) ──
zam('''# Potrjuje, da build z R332 spremembami (59. ČLEN issue #1 IZVOZI:
# POTEKLI OPOMNIKI CSV — CSV brat PDF R252 [NOVI lib
# potekli-opomniki-csv — vzorec R330/R331/R297: LOČEN lib ki UVAŽA
# projekcijo PDF brata — EN VIR preverba + sort + agregat
# [preveriPotekliVnos + sortirajPotekle + potekliPovzetek + potekelDniPrek
# — ISTA sekvenca kot buildPotekliOpomnikiPdfDoc], NIČ podvojenih pravil;
# glava VERBATIM PDF autoTable head ×6; Sklep VERBATIM PDF sklepu; meta
# kanon R172→R296 — KPI trio ISTI izpisi; filename
# Potekli-opomniki-YYYY-MM-DD.csv — bratska simetrija; ENA izpeljava izbora
# potekliVnosiIzCustomers ×3 — definicija + OBA brata]; STIL val 19 izvozna
# PAR pariteta na CRM tab izvozni coni + definicijski naslov medija +
# legenda medija + obrnjene regresije val 15–18; R331 dedovina: 58. ČLEN
# issue #1 IZVOZI: PONUDBE — SPOMNIKI CSV [EN VIR ponudbeSpomnikiPregled;
# TROJICA press-scale pariteta]; R330 dedovina: 57. ČLEN issue #1''',
'''# Potrjuje, da build z R333 spremembami (60. ČLEN issue #1 IZVOZI:
# DOBAVITELJI — POZICIJA CEN CSV — CSV brat PDF R264 [NOVI lib
# dobavitelji-pozicija-csv — vzorec R330/R331/R332/R297: LOČEN lib ki
# UVAŽA projekcijo PDF brata — EN VIR preverba + JOIN + min-invarianta +
# agregat + sort [dobaviteljiPozicijaCen — ISTA sekvenca kot
# buildDobaviteljiPozicijaPdfDoc] + odstotekNiz IZVOŽEN iz PDF brata
# [R333 — ISTI odstotek izpis], NIČ podvojenih pravil; glava VERBATIM PDF
# autoTable head ×6; Sklep VERBATIM PDF sklepu; meta kanon R172→R296 —
# KPI peterica ISTI izpisi; filename Pozicija-dobaviteljev-YYYY-MM-DD.csv
# — bratska simetrija; ENA izpeljava preseka pridobiPozicijo — definicija
# ×1 + OBA brata ×2]; STIL val 20 izvozna PAR pariteta na Material pregled
# izvozni coni + definicijski naslov medija + legenda medija + obrnjene
# regresije val 15–19; R332 dedovina: 59. ČLEN issue #1 IZVOZI: POTEKLI
# OPOMNIKI CSV [EN VIR preverba + sort + agregat; KPI trio]; R331
# dedovina: 58. ČLEN issue #1 IZVOZI: PONUDBE — SPOMNIKI CSV [EN VIR
# ponudbeSpomnikiPregled; TROJICA press-scale pariteta]; R330 dedovina:
# 57. ČLEN issue #1''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r332-', '/tmp/r333-', 7)
zam('/tmp/R332-server-smoke.log', '/tmp/R333-server-smoke.log', 1)  # uppercase log (LEKCIJA R330 5 — banner žetoni del register resnice)
zam('# R332 dimni test (vzorec r273/r296-r331)', '# R333 dimni test (vzorec r273/r296-r332)', 1)

# ── 3. SMOKE sekret ──
zam('R332-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R333-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('--- R332 SMOKE KONEC ---', '--- R333 SMOKE KONEC ---', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r333-run-smoke.sh zapisan ({len(text)} znakov)')
