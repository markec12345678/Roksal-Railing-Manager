#!/usr/bin/env python3
# R334 — derive r334-run-smoke.sh iz r333 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R334 zapis (61. člen končna verifikacija CSV brat)
#   2. Generacijske poti: /tmp/r333- (7) → /tmp/r334-
#   3. SMOKE sekret: R333-smoke → R334-smoke
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r333-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r334-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (60. člen → 61. člen zapis) ──
zam('''# Potrjuje, da build z R333 spremembami (60. ČLEN issue #1 IZVOZI:
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
# 57. ČLEN issue #1''',
'''# Potrjuje, da build z R334 spremembami (61. ČLEN issue #1 IZVOZI:
# KONČNA VERIFIKACIJA CSV — CSV brat JSON R316 + PDF R320 — izvozna TRIADA
# na vodja blok glavi [NOVI lib koncna-verifikacija-csv — vzorec R317
# audit-csv: ČISTA projekcija EN VIR graditelja koncnaVerifikacija R315 —
# ISTA validacija fail-closed brezplačno, NIČ podvojenih pravil; glavi
# VERBATIM PDF autoTable head T1/T2 — anti-divergenca, testi pinajo PROTI
# PDF VIRU; celice = ISTI izpisi kot PDF body — plasti pipe-joined +
# opomba dokaza iz vezave; meta = KPI ×4 ISTI izpisi kot PDF kpiBox +
# Sklep VERBATIM [ŠESTI potrošnik ENEGA niza] + Vir niz; BREZ časa — kanon
# determinizma 46./47. člen; filename koncna-verifikacija.csv — bratska
# simetrija z JSON/PDF imenoma; format kanon R136 toCsv]; STIL val 21
# izvozna TRIADA pariteta na vodja blok glavi + definicijski naslov medija
# + legenda medija + obrnjene regresije val 15–20; R333 dedovina: 60. ČLEN
# issue #1 IZVOZI: DOBAVITELJI — POZICIJA CEN CSV [EN VIR preverba + JOIN +
# min-invarianta + agregat + sort; KPI peterica]; R332 dedovina: 59. ČLEN
# issue #1 IZVOZI: POTEKLI OPOMNIKI CSV [EN VIR preverba + sort + agregat;
# KPI trio]; R331 dedovina: 58. ČLEN issue #1 IZVOZI: PONUDBE — SPOMNIKI
# CSV [EN VIR ponudbeSpomnikiPregled]; R330 dedovina: 57. ČLEN issue #1''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r333-', '/tmp/r334-', 7)
zam('/tmp/R333-server-smoke.log', '/tmp/R334-server-smoke.log', 1)  # uppercase log (LEKCIJA R330 5 — banner žetoni del register resnice)
zam('# R333 dimni test (vzorec r273/r296-r332)', '# R334 dimni test (vzorec r273/r296-r333)', 1)

# ── 3. SMOKE sekret ──
zam('R333-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R334-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('--- R333 SMOKE KONEC ---', '--- R334 SMOKE KONEC ---', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r334-run-smoke.sh zapisan ({len(text)} znakov)')
