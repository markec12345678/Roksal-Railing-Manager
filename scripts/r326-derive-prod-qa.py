#!/usr/bin/env python3
# R326 — derive r326-prod-qa.sh iz vzporedne r325 generacije (kanon LEKCIJA
# 1, 5. potrditev). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed;
# LEKCIJA R312: štetje na POJAVITVE). Transformacije:
#   1. Glava: R326 zapis (53. člen zgodovina cen + STIL val 13) PO 🆕 R325
#   2. EPOCH: R325_COMMIT_ISO/R325_PUSH → R326_*, guard → R32[4]|R325[_],
#      awk '^R325 —' → '^R326 —', R325_TABS → R326_TABS, Z0/UNION/footer
#   3. Generacijske poti: /tmp/r325- (36) → /tmp/r326- + __r324val (4) →
#      __r325val
#   4. 🩺 POPRAVEK VZPOREDNE GENERACIJE: R324 blok (52. člen dnevni PDF —
#      need ×2 + TODO-R324) je v dvakratnem preimenovanju R323→R324→R325
#      IZ verige IZPADEL (r324-build-needles je bil prekrit z
#      dekompozicijo) — tukaj OBNOVLJEN (UNION harvest kanon: noben
#      generacijski needle se ne sme tiho izgubiti)
#   5. 🩺 POPRAVEK val8 labela: vzporedna r325 je ostala na ×7/register
#      R323 (r324 shift ×7→×8 je izpadel) — obnovljeno na disk resnico ×8
#   6. R326 needle blok: splice PO R325 (zgodovina cen ×2 + TODO-R326)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r325-prod-qa.sh')
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
zam('# R325 — PRVA naloga (worklog R324): potrditi R290+…+R321+R322+R323+R324+R325 SKUPAJ na produ.',
    '''# R326 — PRVA naloga (worklog R326): potrditi R290+…+R321+R322+R323+R324+R325+R326 SKUPAJ na produ.
#   🆕 R326 = 53. člen issue #1 §5 (ZGODOVINA CEN MATERIALA — price history):
#   NOVI lib cena-zgodovina (ČISTA projekcija MaterialPrice vključno z
#   ZAPRTO zgodovino; EN VIR glave + CENA_SMER_NIZ + sklep + VIR_NIZ;
#   EXCLUDE ogledalo NATANKO ena odprta cena per par; Date.parse
#   razvrščanje); NOVI GET route material-prices/zgodovina (r308 81→82;
#   edini bralec zgodovine); NOVI panel CenaZgodovinaPanel na inventory
#   tabu (par časovnica + iskrene smeri + CSV gumb navy/40 ring — amber/50
#   register ostane zaklenjen v vodji ×8; iskrena ničelna veja). STIL val
#   13: dvonivojska hierarhija val 11/12 na novi površini panela (amber/30
#   + amber/40). KOLIZIJA #7: runda R325→R326 (vzporedna lastniška seja).''', 1)

# ── 2. EPOCH ──
zam('R325 commit meja ($R325_PUSH)', 'R326 commit meja ($R326_PUSH)', 1)
zam('R325 deploy potrjen (build $BUILD > R325 commit meja $R325_PUSH)', 'R326 deploy potrjen (build $BUILD > R326 commit meja $R326_PUSH)', 1)
zam('R325_COMMIT_ISO', 'R326_COMMIT_ISO', 3)
zam('R325_PUSH', 'R326_PUSH', 3)  # ×3 PO stale-zamenjavah ×2 (LEKCIJA R312: zaporedne zamenjave spreminjajo števce)
zam("$2 ~ /^R325 —/", "$2 ~ /^R326 —/", 1)
zam('R325_TABS', 'R326_TABS', 3)
zam("R32[3]_PUSH|R324[_]COMMIT_ISO", "R32[4]_PUSH|R325[_]COMMIT_ISO", 1)
zam("('R32[1]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R32[4]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R324 PUSH/COMMIT meje v r325-prod-qa.sh',
    'derive ostanki R325 PUSH/COMMIT meje v r326-prod-qa.sh', 1)
zam('derive čistost: OK (nič R324 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R325 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R325 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R326 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324+R325+R326 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r325-', '/tmp/r326-', 36)
zam('__r324val', '__r325val', 4)

# ── 4. 🩺 OBNOVA R324 bloka (izpadel v vzporednem dvakratnem preimenovanju) ──
R324_BLOK = '''
echo "--- R324 MANDATORY — 52. člen: izvoz dnevnega pregleda vodje (PDF) — OBNOVLJEN (izpadel v KOLIZIJI #5+#6 preimenovanjih; UNION harvest kanon) ---"
# IZVOZI družina: "Dnevni PDF" gumb v glavi "Pregled za vodjo" (vodja chunk)
# — deterministični PDF izvoz (vodjaIzvozVhod EN VIR vhod — ENA preslikava,
# DVA potrošnika; EN VIR kontrakt R324 v bratu R163; FNV soli 0xcd–0xd0;
# vitest r324-vodja-dnevni-pdf ×14; E2E Z0at DETERMINIZEM ŽIVO NA BAJTIH).
need "Izvozi dnevni pregled vodje kot PDF" "R324 dnevni PDF izvoz gumb aria (vodja chunk) — LIVE"
need "kot deterministični PDF" "R324 dnevni PDF izvoz title fragment (vodja chunk) — LIVE"
must_miss "TODO-R324" "R324 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R323" "R323 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R323" "R323 — brez razvojnih ostankov"\n' + R324_BLOK, 1)

# ── 5. R326 needle blok (splice PO R325 dekompozicija bloku, PRED Z2b) ──
R326_BLOK = '''
echo "--- R326 MANDATORY — 53. člen: zgodovina cen materiala (price history) + STIL val 13 (LIVE) ---"
# IZVOZI družina + §5: panel CenaZgodovinaPanel na inventory tabu — čisti
# bralec NOVEGA GET route /api/material-prices/zgodovina (r308 obseg
# 81→82); par = material × dobavitelj časovnica + iskrene smeri; CSV gumb
# izvozne družine (aria + title; navy/40 ring — amber/50 register ostane
# zaklenjen v vodji ×8; fail-verbose toast; iskrena ničelna veja — brez
# podatkov NI izvoza). EN VIR: CENA_ZGODOVINA_CSV_GLAVE + TIMELINE_GLAVE +
# CENA_SMER_NIZ + cenaZgoSklep + CENA_ZGO_VIR_NIZ; vitest r326 ×25 (cena
# ×20 + val13 ×5); E2E Z0au ŽIVO (iskrena prazna veja + wire GET).
need "Zgodovina cen materiala" "R326 panel naslov (inventory chunk) — LIVE"
need "Izvozi zgodovino cen materiala kot CSV" "R326 zgodovina cen CSV gumb aria (panel chunk) — LIVE"
must_miss "TODO-R326" "R326 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R325" "R325 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R325" "R325 — brez razvojnih ostankov"\n' + R326_BLOK, 1)

# ── 6. 🩺 val8 labela obnovljena na disk resnico (×7/register R323 → ×8/R324) ──
zam('need "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×7 — register R323) — LIVE"',
    'need "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×8 — register R324) — LIVE"', 1)
zam('# blok glave ×7 [dnevni', '# blok glave ×8 [dnevni', 1)

# ── 7. Footer ──
zam('=== R325 PROD QA — R290+…+R325 ŽIVO SKUPAJ ===',
    '=== R326 PROD QA — R290+…+R326 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r326-prod-qa.sh zapisan ({len(text)} znakov)')
