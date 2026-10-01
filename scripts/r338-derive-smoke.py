#!/usr/bin/env python3
# R338 — derive r338-run-smoke.sh iz NJIHOVE r337 generacije (KOLIZIJA #12:
# vzporedna cron seja je vzela številko R337 — commit 1a3e776, 64. člen AI
# raba pregled CSV; NJIHOVI scripts/r337-* skripti ostanejo; po kanonu
# LEKCIJA 1: re-derivacija r338-* IZ NJIHOVE r337 generacije). VSAKA
# zamenjava je NATANKO n-točkovna (fail-closed; LEKCIJA R312: štetje na
# POJAVITVE — text.count NE grep -c).
# Pojavitveni števci PREJ (python3 text.count na VIR-u r337-run-smoke.sh):
#   - '# R337 dimni test (vzorec r273/r296-r336)': ×1
#   - glava R337 zapisa ('# Potrjuje, da build z R337 spremembami
#     (64. ČLEN …' do '; R333 dedovina: 60. ČLEN'): ×1 (POZOR — NJIHOVA
#     glava vsebuje STALE pill/val opis 'navy/40 … OSTANE ×10, val8 drevo
#     68 → 69 … STIL val 23' [R336 opis, njihova derive je tega dela
#     glave ne posodobila na amber/50 ×11/70/val 24] — zamenjava z R338
#     dekompozicija zapisom stale opis odstrani)
#   - '/tmp/r337-': ×7 (smoke-cookies ×1 + smoke-telo/quote/evidence ×2
#     vsaka — curl -o + grep preverba)
#   - '/tmp/R337-server-smoke.log': ×1 (uppercase log, LEKCIJA R330 5)
#   - 'R337-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!': ×1
#   - '--- R337 SMOKE KONEC ---': ×1
# Transformacije:
#   1. Glava: R338 zapis (dekompozicija measurements-tab FAZA 3 — ČIST
#      PREMIK, NULPREMIK verify_r338.py; R337/R336/R335/R334 dedovine
#      kondenzirane; R333+ dedovina naprej VERBATIM)
#   2. Generacijske poti: /tmp/r337- (7) → /tmp/r338-
#   3. SMOKE sekret: R337-smoke → R338-smoke
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r337-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r338-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (64. člen zapis → dekompozicija FAZA 3 zapis; R337/R336/R335/
#    R334 dedovine kondenzirane, R333+ dedovina VERBATIM) ──
zam('''# Potrjuje, da build z R337 spremembami (64. ČLEN issue #1 IZVOZI:
# AI RABA PREGLED CSV — CSV brat zaslona ai-raba-dokaz R311 [ZADNJI vodja
# dokazni blok brez izvoza; NOVI lib ai-raba-csv — EN VIR: handler poda že
# IZRISANI pregled aiRabaCsv(aiRaba) — zaslon in CSV NE moreta divergirati
# po konstrukciji; žive AI površine verbatim + kandidati verbatim +
# 'AI-obveznih' IZPELJAN stAi − stNadomestkov = 0 po konstrukciji; BREZ
# časa — kanon R334/R336 brez-časa: katalog je statična resnica
# repozitorija, isti katalog = bajtno identična datoteka, nič 'Izvoženo
# ob'; filename ai-raba.csv — brez datuma, bratska simetrija z
# koncna-verifikacija.csv / sistem-zdravje.csv; format kanon R136 toCsv;
# fail-closed kanon R299];
# pill navy/40 družina [val20 Material precedens — gumb v SESTAVLJENI
# kartici, izven vodja datoteke → amber/50 register OSTANE ×10, val8 drevo
# 68 → 69, val9 taktilni ×17 NEPREMIKNJEN]; STIL val 23 + definicijski
# naslov medija + legenda medija + obrnjene regresije val 17–22; R335
# dedovina: 62. ČLEN issue #1 IZVOZI: MESEČNO POROČILO VODJE CSV [izvozna
# PAR]; R334 dedovina: 61. ČLEN [KONČNA VERIFIKACIJA CSV — TRIADA]; R333 dedovina: 60. ČLEN''',
'''# Potrjuje, da build z R338 spremembami (DEKOMPOZICIJA measurements-tab
# FAZA 3 — PRIROJENIŠKA runda, vzorec R322/R325: NOVA mapa measurements/
# ×2 — labels.ts [GroundType + AuditEntry + 17 Record zbirk] + format.ts
# [ArMetadata + 13 čistih funkcij] — ČIST PREMIK bajtno identično,
# NULPREMIK verify_r338.py; measurements-tab.tsx 7.153 → 6.809 vrstic;
# osiroteli ikonski uvozi odstranjeni; PIN SHIFTI ×6
# [r172/r316/r311/r231/r234/r235]; NOV Z-blok NI dodan — pokritost =
# r338-build-needles premik-needleji + polne E2E regresije; R337 dedovina:
# 64. ČLEN issue #1 IZVOZI: AI RABA PREGLED CSV [EN VIR aiRabaCsv(aiRaba);
# STIL val 24]; R336 dedovina: 63. ČLEN issue #1 IZVOZI: SISTEM ZDRAVJE CSV
# [EN VIR seja zgodovina + odziviStatistika; STIL val 23]; R335 dedovina:
# 62. ČLEN issue #1 IZVOZI: MESEČNO POROČILO VODJE CSV [izvozna PAR; STIL
# val 22]; R334 dedovina: 61. ČLEN [KONČNA VERIFIKACIJA CSV — TRIADA]; R333
# dedovina: 60. ČLEN''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r337-', '/tmp/r338-', 7)
zam('/tmp/R337-server-smoke.log', '/tmp/R338-server-smoke.log', 1)  # uppercase log (LEKCIJA R330 5 — banner žetoni del register resnice)
zam('# R337 dimni test (vzorec r273/r296-r336)', '# R338 dimni test (vzorec r273/r296-r337)', 1)

# ── 3. SMOKE sekret ──
zam('R337-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 'R338-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('--- R337 SMOKE KONEC ---', '--- R338 SMOKE KONEC ---', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r338-run-smoke.sh zapisan ({len(text)} znakov)')
