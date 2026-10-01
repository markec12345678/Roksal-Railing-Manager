#!/usr/bin/env python3
# R338 — derive r338-e2e-browser.sh iz NJIHOVE r337 generacije (KOLIZIJA
# #12 [12. potrditev]: vzporedna cron seja je vzela številko R337 —
# commit 1a3e776, 64. člen AI raba pregled CSV + NJIHOVI scripts/r337-*
# skripti zabetonirani v git; po kanonu LEKCIJA 1: NJIHOVI r337-* OSTAJOJO,
# moji artefakti se re-derivirajo kot r338-* IZ NJIHOVE r337 generacije).
# VSAKA zamenjava je NATANKO n-točkovna (fail-closed; LEKCIJA R312: štetje
# na POJAVITVE — text.count NE grep -c).
# Pojavitveni števci PREJ (python3 text.count na VIR-u r337-e2e-browser.sh):
#   - '#   Z0as: IZVOZ MERITEV ZMOGLJIVOSTI KOT CSV ŽIVO (R323 NOVO — 51.
#     člen' (sidro za glavo, PO [R322] DEKOMPOZICIJI zapisu): ×1
#   - '/tmp/r337-': ×170 (disk resnica — 82 unikatnih izhodnih JSON poti;
#     NJIHOV commit 1a3e776 pravi "170+36" ✓ SOGLAŠA; VSE so izhodni
#     artefakti TEKA vključno z NJIHOVIM Z0be blokom, noben seed skript →
#     popolna zamenjava varna; prejšnja generacija je imela 168 [+2 za
#     NJIHOV Z0be redirect + open])
#   - '/tmp/R337-server-e2e.log': ×1 (uppercase log, LEKCIJA R330 5)
#   - '=== R337 E2E KONEC ===': ×1
#   - NJIHOV Z0be blok ('Z0be: AI RABA PREGLED CSV ŽIVO' glava ×1 + echo
#     banner ×1 + komentarji/asserti s 'R337' — brez-časa kanon
#     R334/R336/R337): ostaja BREZ spremembe (DEDOVINA — njihov R337 živi
#     E2E blok)
#   - 'R337' skupno: ×4 (1 Z0be glava komentar + 1 uppercase log + 1 Z0be
#     echo banner + 1 Z0be OPOMBA vrstica + 1 KONEC banner = 5 pojavitve
#     na 4 vrsticah; od tega menjam SAMO log + KONEC; ostale = dedovina)
# Transformacije:
#   1. Glava: [R338] DEKOMPOZICIJA zapis PO [R322] DEKOMPOZICIJA zapisu
#      PRED 'Z0as:' (NOV Z-blok NI dodan — iskren razlog kanona R322:
#      premik bajtno identične vsebine nima nove žive interakcije;
#      pokritost = r338-build-needles 8 premik needlejev + vitest PIN
#      registra + polne E2E regresije Z0aa…Z0be vključno z NJIHOVIMI
#      Z0bc/bd/be + ZERO-MUTACIJA ODTIS)
#   2. Generacijske poti: /tmp/r337- (170) → /tmp/r338- (VSE tmp poti
#      nosijo generacijski prefix — tudi dedovina Z0bb/Z0bc/Z0bd/Z0be
#      blokov, LEKCIJA R330 5) + uppercase log + KONEC banner
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r337-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r338-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: [R338] zapis (PO [R322] DEKOMPOZICIJI zapisu, PRED Z0as) ──
zam('#   Z0as: IZVOZ MERITEV ZMOGLJIVOSTI KOT CSV ŽIVO (R323 NOVO — 51. člen',
'''#   [R338] DEKOMPOZICIJA measurements-tab FAZA 3 (regression-only runda —
#         PRIROJENIŠKA, vzorec R322/R325; KOLIZIJA #12: rename R337→R338
#         + re-derivacija iz NJIHOVE r337 generacije): 7.153 → 6.809
#         vrstic — mapa measurements/ ×2 (labels.ts 202 vrstic — 17 Record
#         zbirk oznak/barv/ikon + AuditEntry/GroundType tipi; format.ts 217
#         vrstic — ArMetadata + 13 čistih parse/format funkcij) — ČIST
#         PREMIK bajtno identično (verify_r338.py NULPREMIK dokaz);
#         osiroteli ikonski uvozi odstranjeni; PIN SHIFTI ×6 (r172 prst +
#         r316-stil-val7 register + r311-ai-raba IZJEME + r231/r234/r235).
#         NOV Z-blok NI dodan — iskren razlog (kanon R322): premik bajtno
#         identične vsebine nima nove žive interakcije za dokazovat;
#         pokritost = r338-build-needles [8 premik needlejev ŽIVIH v
#         čankih] + vitest PIN registra + polne E2E regresije
#         (Z0aa…Z0be vključno z NJIHOVIMI Z0bc/bd/be) + ZERO-
#         MUTACIJA ODTIS;
#   Z0as: IZVOZ MERITEV ZMOGLJIVOSTI KOT CSV ŽIVO (R323 NOVO — 51. člen''', 1)

# ── 2. Generacijske poti (VSE /tmp/r337- vključno z dedovino
#    Z0bb/Z0bc/Z0bd/Z0be) ──
zam('/tmp/r337-', '/tmp/r338-', 170)  # disk resnica 170 = NJIHOV commit 1a3e776 "170+36" ✓
zam('/tmp/R337-server-e2e.log', '/tmp/R338-server-e2e.log', 1)  # uppercase log (LEKCIJA R330 5 — banner žetoni del register resnice)
zam('=== R337 E2E KONEC ===', '=== R338 E2E KONEC ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r338-e2e-browser.sh zapisan ({len(text)} znakov)')
