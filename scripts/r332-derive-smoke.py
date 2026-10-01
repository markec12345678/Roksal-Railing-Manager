#!/usr/bin/env python3
# R332 — derive r332-run-smoke.sh iz r331 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R332 zapis (59. člen potekli opomniki CSV brat)
#   2. Generacijske poti: /tmp/r331- (7) → /tmp/r332-
#   3. SMOKE sekret: R331-smoke → R332-smoke
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r331-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r332-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (58. člen → 59. člen zapis) ──
zam('''# Potrjuje, da build z R331 spremembami (58. ČLEN issue #1 IZVOZI:
# PONUDBE — SPOMNIKI CSV — CSV brat PDF R267 [NOVI lib
# ponudbe-spomniki-csv — vzorec R330/R297: LOČEN lib ki UVAŽA projekcijo
# PDF brata — EN VIR ponudbeSpomnikiPregled, NIČ podvojenih pravil; glava
# VERBATIM PDF autoTable head ×8; Sklep VERBATIM PDF sklepu; meta kanon
# R172→R296; filename Ponudbe-spomniki-YYYY-MM-DD.csv — bratska simetrija;
# ENA izpeljava vira pridobiPonudbeSpomnikiVnosi ×2 — oba brata; TROJICA
# press-scale pariteta — R161 gumb dobi press-scale]; STIL val 18 izvozna
# PAR pariteta na CRM kartici + definicijski naslov medija + legenda
# medija + obrnjene regresije val 15–17; R330 dedovina: 57. ČLEN issue #1''',
'''# Potrjuje, da build z R332 spremembami (59. ČLEN issue #1 IZVOZI:
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
# TROJICA press-scale pariteta]; R330 dedovina: 57. ČLEN issue #1''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r331-', '/tmp/r332-', 7)
zam('/tmp/R331-server-smoke.log', '/tmp/R332-server-smoke.log', 1)  # uppercase log (LEKCIJA R330 5 — banner žetoni del register resnice)
zam('# R331 dimni test (vzorec r273/r296-r330)', '# R332 dimni test (vzorec r273/r296-r331)', 1)

# ── 3. SMOKE sekret ──
zam('R331-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R332-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('--- R331 SMOKE KONEC ---', '--- R332 SMOKE KONEC ---', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r332-run-smoke.sh zapisan ({len(text)} znakov)')
