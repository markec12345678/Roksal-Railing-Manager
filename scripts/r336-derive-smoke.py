#!/usr/bin/env python3
# R336 — derive r336-run-smoke.sh iz r335 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R336 zapis (63. člen sistem zdravje CSV) — R335 opis postane
#      skrčen dedovina zapis
#   2. Sekret + log + tmp poti: R335 → R336
#   3. Footer R335 → R336
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r335-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r336-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R335 dimni test (vzorec r273/r296-r334) — standalone :3100 + javni health +
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
# issue #1 IZVOZI: KONČNA VERIFIKACIJA CSV [izvozna TRIADA]; R333 dedovina: 60. ČLEN''',
'''# R336 dimni test (vzorec r273/r296-r335) — standalone :3100 + javni health +
# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
# Potrjuje, da build z R336 spremembami (63. ČLEN issue #1 IZVOZI:
# SISTEM ZDRAVJE CSV — CSV brat zaslona SistemZdravjeCard R187/R188/R189
# [ZADNJA vodja kartica brez izvoza; NOVI lib sistem-zdravje-csv — EN VIR:
# ISTA seja zgodovina zdravje-zgodovina + ISTI odziviStatistika izračun
# [divergenca nemogoča] + ISTI zigIzpis klic kot kartica [fail-soft vzorec
# R185] + BAZA_NIZ kartica UVAŽA [precedens R335 STATUS_SL: const → export,
# zero-behavior]; BREZ časa — kanon R334 brez-časa: statičen izvoz te seje,
# isti zgodovina + build = bajtno identična datoteka, nič 'Izvoženo ob';
# filename sistem-zdravje.csv — brez datuma, bratska simetrija z
# koncna-verifikacija.csv; format kanon R136 toCsv; fail-closed kanon R299];
# pill navy/40 družina [val20 Material precedens — gumb v SESTAVLJENI
# kartici, izven vodja datoteke → amber/50 register OSTANE ×10, val8 drevo
# 68 → 69, val9 taktilni ×17 NEPREMIKNJEN]; STIL val 23 + definicijski
# naslov medija + legenda medija + obrnjene regresije val 17–22; R335
# dedovina: 62. ČLEN issue #1 IZVOZI: MESEČNO POROČILO VODJE CSV [izvozna
# PAR]; R334 dedovina: 61. ČLEN [KONČNA VERIFIKACIJA CSV — TRIADA]; R333 dedovina: 60. ČLEN''')

# ── 2. Sekret + log + tmp poti ──
zam('R335-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R336-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!')
zam('/tmp/R335-server-smoke.log', '/tmp/R336-server-smoke.log')
zam('/tmp/r335-smoke-cookies.txt', '/tmp/r336-smoke-cookies.txt')
zam('/tmp/r335-smoke-telo.json', '/tmp/r336-smoke-telo.json', 2)
zam('/tmp/r335-smoke-quote.json', '/tmp/r336-smoke-quote.json', 2)
zam('/tmp/r335-smoke-evidence.json', '/tmp/r336-smoke-evidence.json', 2)

# ── 3. Footer ──
zam('echo "--- R335 SMOKE KONEC ---"', 'echo "--- R336 SMOKE KONEC ---"')

DOL.write_text(text, encoding='utf-8')
print('r336-run-smoke.sh: OK (derive iz r335)')
