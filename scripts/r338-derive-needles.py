#!/usr/bin/env python3
# R338 — derive r338-build-needles.sh iz NJIHOVE r337 generacije (KOLIZIJA
# #12 [12. potrditev vzporednih sej]: vzporedna cron seja je vzela
# številko R337 — commit 1a3e776, 64. člen AI raba pregled CSV + NJIHOVI
# scripts/r337-* skripti zabetonirani v git; po kanonu LEKCIJA 1: NJIHOVI
# r337-* OSTAJOJO, moji artefakti se re-derivirajo kot r338-* IZ NJIHOVE
# r337 generacije).
# VSAKA zamenjava je NATANKO n-točkovna (fail-closed; LEKCIJA R312: štetje
# na POJAVITVE — text.count NE grep -c).
# Pojavitveni števci PREJ (python3 text.count na VIR-u r337-build-needles.sh):
#   - glava NJIHOVEGA R337 zapisa (64. člen AI raba pregled CSV blok, 20
#     vrstic — od '# R337 — build needleji: 64. ČLEN' do 'DEDOVINA 60.
#     člena (R333 pozicija dobaviteljev CSV needleji ostajajo v verigi) +'):
#     ×1
#   - 'OUT=/tmp/r337-build-chunks': ×1
#   - sidro vstavljanja 'must_miss "TODO-R337" "R337 — brez razvojnih
#     ostankov"' + LF + REGRESIJE echo prefix '[R336 sistem zdravje CSV':
#     ×1 (POZOR — DEVIACIJA: NJIHOV R337 blok NIMA 'echo "R337 lastni
#     needleji: …"' vrstice — NJIHOVA derive jo je izpustila od R335
#     naprej [njihov zadnji blok se konča s samim must_miss]; MOJ R338
#     blok echo vrstice ponovno nosi [vzorec moje r336/r337 generacije])
#   - 'echo "R337 NEEDLEJI FAIL"; exit 1; fi': ×1
#   - '=== R337 BUILD NEEDLES VSE OK ===': ×1
#   - NJIHOV R337 needle blok (R337 MANDATORY — 64. člen + need ×2 +
#     must_miss TODO-R337): ×1 — ostaja BREZ spremembe (DEDOVINA)
# Transformacije:
#   1. Glava: NJIHOV R337 zapis (64. člen AI raba pregled CSV) → R338
#      dekompozicija zapis + DEDOVINA 64. člena (R337 AI raba pregled CSV
#      needleji ostajajo v verigi) + DEDOVINA 63. člena (R336 sistem
#      zdravje CSV) + DEDOVINA 62. člena (R335 mesečni CSV); ostala glava
#      [🩺 OBNOVA R324 bloka + DEDOVINA vzporedne R325 + LEKCIJA
#      R289/R299] ostaja VERBATIM — veriga dedovine
#   2. OUT pot: /tmp/r337-build-chunks → /tmp/r338-build-chunks
#   3. R338 needle blok (8 premik needlejev + TODO-R338 must_miss + lastni
#      echo) — PO NJIHOVEM R337 bloku, PRED REGRESIJAMI (vrstni red:
#      njihov R337 blok → MOJ R338 blok → REGRESIJE echo)
#   4. Footer R337 → R338 (delegacija na r324-build-needles trunk ostaja;
#      REGRESIJE echo: R337 AI raba pregled CSV NA ČELU verige)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r337-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r338-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (64. člen zapis → dekompozicija FAZA 3 zapis; ostala glava
#    [OBNOVA R324 + DEDOVINA R325 + LEKCIJA R289/R299] VERBATIM) ──
zam('''# R337 — build needleji: 64. ČLEN issue #1 «IZVOZI» — AI RABA PREGLED CSV
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
# needleji ostajajo v verigi) +''',
'''# R338 — build needleji: DEKOMPOZICIJA measurements-tab FAZA 3
# (regression-only runda — PRIROJENIŠKA, vzorec R322/R325; KOLIZIJA #12:
# rename R337→R338 + re-derivacija iz NJIHOVE r337 generacije): NOVA mapa
# measurements/ ×2 (labels.ts 202 vrstic — GroundType + AuditEntry + 17
# Record zbirk oznak/barv/ikon; format.ts 217 vrstic — ArMetadata + 13
# čistih parse/format funkcij) — ČIST PREMIK bajtno identično (verify_r338.py
# NULPREMIK dokaz); measurements-tab.tsx 7.153 → 6.809 vrstic; osiroteli
# ikonski uvozi odstranjeni; PIN SHIFTI ×6 (r172 6976→6632 + r316-stil-val7
# register [2 amber → labels/format, skupno 30] + r311-ai-raba [isti premik,
# skupno 6] + r231/r234/r235 → labels.ts); NOV Z-blok NI dodan (vzorec R322
# — iskren razlog: premik nima nove žive interakcije; pokritost = ti
# premik-needleji + polne E2E regresije) + DEDOVINA 64. člena (R337 AI raba
# pregled CSV needleji ostajajo v verigi) + DEDOVINA 63. člena (R336 sistem
# zdravje CSV needleji ostajajo v verigi) + DEDOVINA 62. člena (R335 mesečni
# poročilo CSV needleji ostajajo v verigi) +''', 1)

# ── 2. OUT pot ──
zam('OUT=/tmp/r337-build-chunks', 'OUT=/tmp/r338-build-chunks', 1)

# ── 3. R338 needle blok (PO NJIHOVEM R337 bloku, PRED REGRESIJAMI;
#    NJIHOV blok se konča s samim must_miss TODO-R337 → sidro = must_miss +
#    REGRESIJE echo; Z-STRUCT 0/0 ohranjen — blok je PO definicijah
#    funkcij, IZVEN find loopa) ──
zam('''must_miss "TODO-R337" "R337 — brez razvojnih ostankov"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R336 sistem zdravje CSV''',
'''must_miss "TODO-R337" "R337 — brez razvojnih ostankov"
echo "--- R338 MANDATORY — dekompozicija faza 3: premaknjena vsebina ŽIVA v čankih ---"
need_static "Vrsta meritve: Razdalja — vodoravna dolžina; določa širino segmenta." "R338 labels.ts tipMeritveTitles (premik živ)"
need_static "Sinhronizacijsko stanje: Sinhronizirano — opazovano stanje klienta" "R338 labels.ts syncStanjeTitles (premik živ)"
need_static "Lesena podlaga" "R338 labels.ts groundTypeLabels (premik živ)"
need_static "WPC pokončne palice" "R338 labels.ts segmentTypeLabels (premik živ)"
need_static "roksal_audit_" "R338 format.ts loadAudit ključ (premik živ)"
need_static "roksal_primary_unit" "R338 format.ts loadPrimaryUnit ključ (premik živ)"
need_static "Vnesite veljavne vhodne podatke" "R338 format.ts calculateStairDimensions (premik živ)"
need_static "Nevarno: >40° (prestrmo!)" "R338 format.ts calculateStairDimensions priporocilo (premik živ)"
echo "--- R338 must_miss (negativni) ---"
must_miss "TODO-R338" "R338 — brez razvojnih ostankov"
echo "R338 lastni needleji: FAIL=$FAIL (8 premik + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [R337 AI raba pregled CSV + R336 sistem zdravje CSV''', 1)

# ── 4. Footer ──
zam('echo "R337 NEEDLEJI FAIL"; exit 1; fi', 'echo "R338 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R337 BUILD NEEDLES VSE OK ===', '=== R338 BUILD NEEDLES VSE OK ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r338-build-needles.sh zapisan ({len(text)} znakov)')
