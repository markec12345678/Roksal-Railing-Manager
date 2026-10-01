#!/usr/bin/env python3
# R334 — derive r334-build-needles.sh iz r333 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R334 zapis (61. člen končna verifikacija CSV brat JSON R316 +
#      PDF R320 — izvozna TRIADA)
#   2. OUT pot: /tmp/r333-build-chunks → /tmp/r334-build-chunks
#   3. R334 needle blok (CSV aria + testid + must_miss) — PO R333 bloku
#   4. Footer R333 → R334 (veriga na r324-build-needles trunk ostaja)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r333-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r334-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R333 — build needleji: 60. ČLEN issue #1 «IZVOZI» — DOBAVITELJI —
# POZICIJA CEN CSV (CSV brat PDF R264: NOVI lib dobavitelji-pozicija-csv —
# vzorec R330/R331/R332/R297, LOČEN lib ki UVAŽA projekcijo PDF brata — EN
# VIR preverba + JOIN + min-invarianta + agregat + sort
# [dobaviteljiPozicijaCen — ISTA sekvenca kot buildDobaviteljiPozicijaPdfDoc]
# + odstotekNiz IZVOŽEN iz PDF brata [R333 — ISTI odstotek izpis], NIČ
# podvojenih pravil; glava VERBATIM PDF autoTable head ×6; Sklep VERBATIM
# PDF sklepu; meta kanon R172→R296 — KPI peterica ISTI izpisi; filename
# Pozicija-dobaviteljev-YYYY-MM-DD.csv — bratska simetrija; izvozna PAR na
# Material pregled izvozni coni — navy/40 ring + press-scale +
# ring-offset-1, val 8 register 66; ENA izpeljava preseka pridobiPozicijo
# [definicija ×1 + OBA brata ×2]; STIL val 20) +
# DEDOVINA 59. člena (R332 potekli opomniki CSV needleji ostajajo v verigi) +''',
'''# R334 — build needleji: 61. ČLEN issue #1 «IZVOZI» — KONČNA VERIFIKACIJA
# CSV (CSV brat JSON R316 + PDF R320 — izvozna TRIADA na vodja blok glavi:
# NOVI lib koncna-verifikacija-csv — vzorec R317 audit-csv, ČISTA projekcija
# EN VIR graditelja koncnaVerifikacija R315 — ISTA validacija fail-closed
# brezplačno, NIČ podvojenih pravil; glavi VERBATIM PDF autoTable head T1/T2
# [anti-divergenca — testi pinajo PROTI PDF VIRU]; celice = ISTI izpisi kot
# PDF body — plasti pipe-joined + opomba dokaza iz vezave; meta = KPI ×4
# ISTI izpisi kot PDF kpiBox + Sklep VERBATIM [ŠESTI potrošnik ENEGA niza] +
# Vir niz; BREZ časa — kanon determinizma 46./47. člen [isti HEAD = bajtno
# identična datoteka]; filename koncna-verifikacija.csv — bratska simetrija
# z JSON/PDF imenoma; format kanon R136 toCsv [BOM + podpičje + CRLF + RFC
# 4180]; izvozna TRIADA na vodja blok glavi — amber/50 ring + offset-2 +
# press-scale, ISTI žeton kot brata, val 8 register 66 → 67 + vodja amber
# ×8 → ×9; STIL val 21) +
# DEDOVINA 60. člena (R333 pozicija dobaviteljev CSV needleji ostajajo v
# verigi) +''', 1)

# ── 2. OUT pot ──
zam('OUT=/tmp/r333-build-chunks', 'OUT=/tmp/r334-build-chunks', 1)

# ── 3. R334 needle blok (PO R333 lastni vrstici, PRED REGRESIJAMI) ──
zam('''must_miss "TODO-R333" "R333 — brez razvojnih ostankov"
echo "R333 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"''',
'''must_miss "TODO-R333" "R333 — brez razvojnih ostankov"
echo "R333 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R334 MANDATORY — 61. člen: končna verifikacija CSV izvoz (IZVOZI družina — CSV brat JSON R316 + PDF R320, izvozna TRIADA) ---"
need_static "Izvozi poročilo končne verifikacije kot CSV" "R334 končna verifikacija CSV gumb aria (vodja chunk)"
need_static "koncna-verifikacija-csv-pill" "R334 končna verifikacija CSV gumb testid (vodja chunk)"
echo "--- R334 must_miss (negativni) ---"
must_miss "TODO-R334" "R334 — brez razvojnih ostankov"
echo "R334 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"''', 1)

# ── 4. Footer ──
zam('echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R332 potekli opomniki CSV + R331 ponudbe-spomniki CSV + R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="',
    'echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R333 pozicija dobaviteljev CSV + R332 potekli opomniki CSV + R331 ponudbe-spomniki CSV + R330 projekti-termini CSV + R329 primerjava dobaviteljev PDF + R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="', 1)
zam('echo "R333 NEEDLEJI FAIL"; exit 1; fi', 'echo "R334 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R333 BUILD NEEDLES VSE OK ===', '=== R334 BUILD NEEDLES VSE OK ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r334-build-needles.sh zapisan ({len(text)} znakov)')
