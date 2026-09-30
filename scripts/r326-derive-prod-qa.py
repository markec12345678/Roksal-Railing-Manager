#!/usr/bin/env python3
# R326 — derive r326-prod-qa.sh iz r324 generacije (kanon LEKCIJA 1: QA
# družina sledi generaciji). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed; LEKCIJA R312: štetje na POJAVITVE). Transformacije:
#   1. Glava: R326 zapis (53. člen zgodovina cen + STIL val 13)
#   2. EPOCH: R324_COMMIT_ISO/R324_PUSH → R326_*, awk '^R324 —' → '^R326 —',
#      guard 'R32[2]_PUSH|R323[_]COMMIT_ISO' → 'R32[3]_PUSH|R324[_]COMMIT_ISO'
#   3. Generacijske poti: /tmp/r324- (36) → /tmp/r326- + __r323val (4) →
#      __r324val + R324_TABS → R326_TABS
#   4. R326 needle blok: splice PO R324 (zgodovina cen aria + naslov +
#      TODO-R326)
#   5. val8 labela NE PREMIKNJENA (×8 register — R326 NIČ novih vodja amber
#      gumbov; CSV gumb je na inventory panelu z navy/40 ringom — register
#      ostane zaklenjen v vodji; iskrena resnica: stari pin ostane)
#   6. UNION lista + footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r324-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r326-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R324 — PRVA naloga (worklog R324): potrditi R290+…+R321+R322+R323+R324 SKUPAJ na produ.',
    '# R326 — PRVA naloga (worklog R326): potrditi R290+…+R321+R322+R323+R324+R326 SKUPAJ na produ.', 1)
zam('#   ×6→×7 + val9 press-scale ×13→14 PIN SHIFTI).\n'
    '#   🆕 R324 = 52. člen issue #1 (IZVOZI družina): izvoz DNEVNEGA pregleda\n'
    '#   vodje kot DETERMINISTIČNI PDF (PDF brat CSV R163 — vzorec R318/R320/\n'
    '#   R321; NOV lib vodja-dnevni-pdf; komponentni EN VIR vhod vodjaIzvozVhod\n'
    '#   — ENA preslikava, DVA potrošnika; EN VIR kontrakt R324 v bratu R163:\n'
    '#   glave VODJA_KPI_GLAVE + VODJA_TERMINI_GLAVE + validacija\n'
    '#   preveriVodjaIzvozVhod [sporočila VERBATIM, kje = graditelj] +\n'
    '#   vodjaKpiVrstice + VODJA_VIR_NIZ — CSV arhivska oblika ostaje BAJTNO\n'
    '#   nespremenjena; FNV soli 0xcd–0xd0). STIL val 12: današnji termini\n'
    '#   dvonivojski odziv (blok amber/30 + vrstica amber/40 na novi površini;\n'
    '#   PIN SHIFTI ×3: val8 ×7→×8, val9 ×14→15, val10/val11 registra ×3→×4).',
    '#   ×6→×7 + val9 press-scale ×13→14 PIN SHIFTI).\n'
    '#   🆕 R326 = 53. člen issue #1 §5 (ZGODOVINA CEN MATERIALA — price\n'
    '#   history): NOVI lib cena-zgodovina (ČISTA projekcija MaterialPrice\n'
    '#   vključno z ZAPRTO zgodovino veljavnostDo != null; EN VIR: glave\n'
    '#   CENA_ZGODOVINA_CSV_GLAVE + TIMELINE_GLAVE + CENA_SMER_NIZ +\n'
    '#   cenaZgoSklep + CENA_ZGO_VIR_NIZ; EXCLUDE ogledalo NATANKO ena odprta\n'
    '#   cena per par; Date.parse razvrščanje — ISO dolžinska past); NOVI GET\n'
    '#   route material-prices/zgodovina (r308 obseg 81→82; edini bralec\n'
    '#   zgodovine); NOVI panel CenaZgodovinaPanel na inventory tabu (par =\n'
    '#   material × dobavitelj časovnica + iskrene smeri + CSV gumb izvozne\n'
    '#   družine z navy/40 ringom — amber/50 register ostane zaklenjen v\n'
    '#   vodji ×8). STIL val 13: dvonivojska hierarhija val 11/12 na NOVI\n'
    '#   površini panela (par amber/30 + časovna vrstica amber/40); val8\n'
    '#   anti-stale 58→59; HEAD pre-existing /s flag v r324 testu popravljen.', 1)

# ── 2. EPOCH ──
zam('R323 commit meja ($R324_PUSH)', 'R324 commit meja ($R326_PUSH)', 1)
zam('R324_COMMIT_ISO', 'R326_COMMIT_ISO', 3)
zam('R324_PUSH', 'R326_PUSH', 4)  # ×4 PO stale-zamenjavi (ena pojavitev je del 'R323 commit meja' zamene — LEKCIJA R312)
zam("$2 ~ /^R324 —/", "$2 ~ /^R326 —/", 1)
zam('R324_TABS', 'R326_TABS', 3)
zam("R32[2]_PUSH|R323[_]COMMIT_ISO", "R32[3]_PUSH|R324[_]COMMIT_ISO", 1)
zam("('R32[2]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R32[3]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R323 PUSH/COMMIT meje v r324-prod-qa.sh',
    'derive ostanki R324 PUSH/COMMIT meje v r326-prod-qa.sh', 1)
zam('derive čistost: OK (nič R323 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R324 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R324 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R326 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323+R324 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324+R326 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r324-', '/tmp/r326-', 36)
zam('__r323val', '__r324val', 4)

# ── 4. R326 needle blok (splice PO R324 bloku, PRED Z2b) ──
R326_BLOK = '''
echo "--- R326 MANDATORY — 53. člen: zgodovina cen materiala (price history) + STIL val 13 (LIVE) ---"
# IZVOZI družina + §5: panel CenaZgodovinaPanel na inventory tabu — čisti
# bralec NOVEGA GET route /api/material-prices/zgodovina (r308 obseg
# 81→82); par = material × dobavitelj časovnica + iskrene smeri
# (narašča/pada/stabilna/prvi vpis); CSV gumb izvozne družine (aria +
# title; navy/40 ring — amber/50 register ostane zaklenjen v vodji ×8;
# fail-verbose toast; iskrena ničelna veja — brez podatkov NI izvoza).
# EN VIR: CENA_ZGODOVINA_CSV_GLAVE + TIMELINE_GLAVE + CENA_SMER_NIZ +
# cenaZgoSklep + CENA_ZGO_VIR_NIZ; vitest r325 ×20 + val13 stražar ×5;
# E2E Z0au ŽIVO (iskrena prazna veja + wire GET).
need "Zgodovina cen materiala" "R326 panel naslov (inventory chunk) — LIVE"
need "Izvozi zgodovino cen materiala kot CSV" "R326 zgodovina cen CSV gumb aria (panel chunk) — LIVE"
must_miss "TODO-R326" "R326 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R324" "R324 — brez razvojnih ostankov"\n\necho "=== Z2b:',
    'must_miss "TODO-R324" "R324 — brez razvojnih ostankov"\n' + R326_BLOK + 'echo "=== Z2b:', 1)

# ── 5. val8 labela: NE PREMIKNJENA — register ×8 je STALEN (R326 NIČ novih
# vodja amber gumbov; iskrena resnica — stari pin ostane ×8/register R324) ──

# ── 6. Footer ──
zam('=== R324 PROD QA — R290+…+R324 ŽIVO SKUPAJ ===',
    '=== R326 PROD QA — R290+…+R326 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r326-prod-qa.sh zapisan ({len(text)} znakov)')
