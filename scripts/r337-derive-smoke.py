#!/usr/bin/env python3
# R337 — derive r337-run-smoke.sh iz r336 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije: glava (64. člen opis), sekret, log poti, /tmp poti,
# footer.
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r336-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r337-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (R336 opis → R337 opis) ──
zam('''# R336 dimni test (vzorec r273/r296-r335) — standalone :3100 + javni health +
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
# koncna-verifikacija.csv; format kanon R136 toCsv; fail-closed kanon R299];''',
'''# R337 dimni test (vzorec r273/r296-r336) — standalone :3100 + javni health +
# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
# Potrjuje, da build z R337 spremembami (64. ČLEN issue #1 IZVOZI:
# AI RABA PREGLED CSV — CSV brat zaslona ai-raba-dokaz R311 [ZADNJI vodja
# dokazni blok brez izvoza; NOVI lib ai-raba-csv — EN VIR: handler poda že
# IZRISANI pregled aiRabaCsv(aiRaba) — zaslon in CSV NE moreta divergirati
# po konstrukciji; žive AI površine verbatim + kandidati verbatim +
# 'AI-obveznih' IZPELJAN stAi − stNadomestkov = 0 po konstrukciji; BREZ
# časa — kanon R334/R336 brez-časa: katalog je statična resnica
# repozitorija, isti katalog = bajtno identična datoteka, nič 'Izvoženo
# ob'; filename ai-raba.csv — brez datuma, bratska simetrija z
# koncna-verifikacija.csv / sistem-zdravje.csv; format kanon R136 toCsv;
# fail-closed kanon R299];''')

# ── 2. Sekret + poti ──
zam('R336-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R337-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!')
zam('/tmp/R336-server-smoke.log', '/tmp/R337-server-smoke.log')
zam('/tmp/r336-smoke-', '/tmp/r337-smoke-', 7)
zam('--- R336 SMOKE KONEC ---', '--- R337 SMOKE KONEC ---')

# ── 3. čistost ──
for ostanek in ['/tmp/r336-', 'R336-smoke', 'R336 SMOKE']:
    if ostanek in text:
        print(f'FAIL-CLOSED: {ostanek!r} ostanek v r337-run-smoke.sh')
        sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print('r337-run-smoke.sh: OK (derive iz r336)')
