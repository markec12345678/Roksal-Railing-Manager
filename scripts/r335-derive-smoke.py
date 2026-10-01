#!/usr/bin/env python3
# R335 — derive r335-run-smoke.sh iz r334 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R335 zapis (62. člen mesečno poročilo CSV) — R334 opis postane
#      skrčen dedovina zapis
#   2. Sekret + log + tmp poti: R334 → R335
#   3. Footer R334 → R335
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r334-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r335-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R334 dimni test (vzorec r273/r296-r333) — standalone :3100 + javni health +
# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
# Potrjuje, da build z R334 spremembami (61. ČLEN issue #1 IZVOZI:
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
# + legenda medija + obrnjene regresije val 15–20; R333 dedovina: 60. ČLEN''',
'''# R335 dimni test (vzorec r273/r296-r334) — standalone :3100 + javni health +
# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
# Potrjuje, da build z R335 spremembami (62. ČLEN issue #1 IZVOZI:
# MESEČNO POROČILO VODJE CSV — CSV brat Poročilo PDF rundi M [NOVI lib
# vodja-mesecni-csv — vzorec R330–R334: LOČEN lib ki UVAŽA resnico PDF
# brata — EN VIR: ISTI ReportData vhod prek komponentne izpeljave
# mesecniPregledData (DVA potrošnika: generateMonthlyReport +
# vodjaMesecniCsv — divergenca nemogoča, vzorec vodjaIzvozVhod R293);
# mesecIme + STATUS_SL UVOŽENA iz PDF brata — anti-divergenca po
# konstrukciji; celice = ISTI izpisi kot PDF body — eur/eur0 EN VIR
# csv-export, zapadli 'Dni zapadlo' = ISTA izpeljava kot PDF; glave
# VERBATIM PDF autoTable head ×3 + predstavitvena prihodki glava;
# sklep = VERBATIM PDF sklepna vrstica; 'Izvoženo ob' = PODATKOVNI izvoz
# z referenčnim mesecem [kanon R330–R333]; filename porocilo-YYYY-MM.csv
# — bratska simetrija z PDF imenom; format kanon R136 toCsv]; STIL val 22
# izvozna PAR pariteta na vodja blok glavi + definicijski naslov medija
# + legenda medija + obrnjene regresije val 16–21; R334 dedovina: 61. ČLEN
# issue #1 IZVOZI: KONČNA VERIFIKACIJA CSV [izvozna TRIADA]; R333 dedovina: 60. ČLEN''')

# ── 2. Sekret + log + tmp poti ──
zam('R334-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R335-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!')
zam('/tmp/R334-server-smoke.log', '/tmp/R335-server-smoke.log')
zam('/tmp/r334-smoke-cookies.txt', '/tmp/r335-smoke-cookies.txt')
zam('/tmp/r334-smoke-telo.json', '/tmp/r335-smoke-telo.json', 2)
zam('/tmp/r334-smoke-quote.json', '/tmp/r335-smoke-quote.json', 2)
zam('/tmp/r334-smoke-evidence.json', '/tmp/r335-smoke-evidence.json', 2)

# ── 3. Footer ──
zam('echo "--- R334 SMOKE KONEC ---"', 'echo "--- R335 SMOKE KONEC ---"')

DOL.write_text(text, encoding='utf-8')
print('r335-run-smoke.sh: OK (derive iz r334)')
