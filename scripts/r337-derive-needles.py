#!/usr/bin/env python3
# R337 — derive r337-build-needles.sh iz r336 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R337 zapis (64. člen AI raba pregled CSV)
#   2. OUT pot: /tmp/r336-build-chunks → /tmp/r337-build-chunks
#   3. R337 needle blok (aria + testid + must_miss) — PO R336 bloku
#   4. Regresije echo: +R336 v seznamu; footer R336 → R337
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r336-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r337-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (R336 opis → R337 opis; dedovina/lekcija rep ostane) ──
zam('''# R336 — build needleji: 63. ČLEN issue #1 «IZVOZI» — SISTEM ZDRAVJE CSV
# (CSV brat zaslona SistemZdravjeCard R187/R188/R189 — ZADNJA vodja kartica
# brez izvoza: NOVI lib sistem-zdravje-csv — EN VIR: ISTA seja zgodovina
# [zdravje-zgodovina] + ISTI odziviStatistika izračun [divergenca nemogoča]
# + ISTI zigIzpis klic kot kartica + BAZA_NIZ kartica UVAŽA [precedens R335
# STATUS_SL: const → export, zero-behavior]; BREZ časa — kanon R334
# brez-časa [statičen izvoz te seje: isti zgodovina + build = bajtno
# identična datoteka, nič 'Izvoženo ob']; filename sistem-zdravje.csv —
# brez datuma, bratska simetrija z koncna-verifikacija.csv; format kanon
# R136 toCsv [BOM + podpičje + CRLF + RFC 4180]; fail-closed kanon R299;
# pill navy/40 družina [val20 Material precedens — gumb v SESTAVLJENI
# kartici sistem-zdravje-card.tsx, izven vodja datoteke → amber/50 register
# OSTANE ×10, val8 drevo 68 → 69, val9 taktilni ×17 NEPREMIKNJEN — file-
# scoped]; STIL val 23) +
# DEDOVINA 62. člena (R335 mesečno poročilo vodje CSV needleji ostajajo v
# verigi) + DEDOVINA 61. člena (R334 končna verifikacija CSV needleji
# ostajajo v verigi) + DEDOVINA 60. člena (R333 pozicija dobaviteljev CSV
# needleji ostajajo v verigi) +''',
'''# R337 — build needleji: 64. ČLEN issue #1 «IZVOZI» — AI RABA PREGLED CSV
# (CSV brat zaslona ai-raba-dokaz R311 — ZADNJI vodja dokazni blok brez
# izvoza: NOVI lib ai-raba-csv — EN VIR: handler poda že IZRISANI pregled
# [aiRabaCsv(aiRaba) — zaslon in CSV NE moreta divergirati po konstrukciji];
# žive AI površine verbatim + kandidati verbatim + vrstica statusa = ISTA
# formula kot zaslon + 'AI-obveznih' IZPELJAN stAi − stNadomestkov = 0 po
# konstrukciji + Sklep = ISTI niz kot zaslon/testi/docs; BREZ časa — kanon
# R334/R336 brez-časa [katalog je statična resnica repozitorija: isti
# katalog = bajtno identična datoteka, nič 'Izvoženo ob']; filename
# ai-raba.csv — brez datuma, bratska simetrija z koncna-verifikacija.csv /
# sistem-zdravje.csv; format kanon R136 toCsv [BOM + podpičje + CRLF +
# RFC 4180]; fail-closed kanon R299; pill amber/50 družina [ISTI žeton kot
# končna verifikacija CSV pill — byte-paritet, gumb JE v vodja datoteki →
# val8 drevo 69 → 70, amber/50 ×10 → ×11, val9 taktilni ×17 → ×18];
# STIL val 24) +
# DEDOVINA 63. člena (R336 sistem zdravje CSV needleji ostajajo v verigi) +
# DEDOVINA 62. člena (R335 mesečno poročilo vodje CSV needleji ostajajo v
# verigi) + DEDOVINA 61. člena (R334 končna verifikacija CSV needleji
# ostajajo v verigi) + DEDOVINA 60. člena (R333 pozicija dobaviteljev CSV
# needleji ostajajo v verigi) +''')

# ── 2. OUT pot ──
zam('OUT=/tmp/r336-build-chunks', 'OUT=/tmp/r337-build-chunks')

# ── 3. R337 needle blok PO R336 bloku + 4. regresije echo ──
zam('''echo "--- R336 MANDATORY — 63. člen: sistem zdravje CSV izvoz (IZVOZI družina — CSV brat zaslona SistemZdravjeCard, EN VIR seja zgodovina + odziviStatistika) ---"
need_static "Izvozi sistem zdravje kot CSV" "R336 sistem zdravje CSV gumb aria (sistem-zdravje-card chunk)"
need_static "sistem-zdravje-csv-pill" "R336 sistem zdravje CSV gumb testid (sistem-zdravje-card chunk)"
echo "--- R336 must_miss (negativni) ---"
must_miss "TODO-R336" "R336 — brez razvojnih ostankov"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R335 mesečno poročilo vodje CSV + R334 končna verifikacija CSV''',
'''echo "--- R336 MANDATORY — 63. člen: sistem zdravje CSV izvoz (IZVOZI družina — CSV brat zaslona SistemZdravjeCard, EN VIR seja zgodovina + odziviStatistika) ---"
need_static "Izvozi sistem zdravje kot CSV" "R336 sistem zdravje CSV gumb aria (sistem-zdravje-card chunk)"
need_static "sistem-zdravje-csv-pill" "R336 sistem zdravje CSV gumb testid (sistem-zdravje-card chunk)"
echo "--- R336 must_miss (negativni) ---"
must_miss "TODO-R336" "R336 — brez razvojnih ostankov"
echo "--- R337 MANDATORY — 64. člen: AI raba pregled CSV izvoz (IZVOZI družina — CSV brat zaslona ai-raba-dokaz R311, EN VIR aiRabaCsv(aiRaba)) ---"
need_static "Izvozi pregled AI rabe kot CSV" "R337 AI raba pregled CSV gumb aria (vodja chunk)"
need_static "ai-raba-csv-pill" "R337 AI raba pregled CSV gumb testid (vodja chunk)"
echo "--- R337 must_miss (negativni) ---"
must_miss "TODO-R337" "R337 — brez razvojnih ostankov"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R336 sistem zdravje CSV + R335 mesečno poročilo vodje CSV + R334 končna verifikacija CSV''')

# ── 4. Footer ──
zam('echo "R336 NEEDLEJI FAIL"; exit 1', 'echo "R337 NEEDLEJI FAIL"; exit 1')
zam('echo "=== R336 BUILD NEEDLES VSE OK ==="', 'echo "=== R337 BUILD NEEDLES VSE OK ==="')

# ── 5. čistost: r337 ne sme nositi R336 PUSH/COMMIT/TABS ali /tmp/r336- ──
for vzkaz in ['TODO-R336" "R336', 'r336-']:
    pass
if '/tmp/r336-' in text or 'TODO-R336"' in text.replace('must_miss "TODO-R336" "R336 — brez razvojnih ostankov"', '', 0):
    pass
n_tmp = text.count('/tmp/r336-')
if n_tmp != 0:
    print(f'FAIL-CLOSED: /tmp/r336- ostankov v r337-build-needles.sh: {n_tmp}')
    sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print('r337-build-needles.sh: OK (derive iz r336)')
