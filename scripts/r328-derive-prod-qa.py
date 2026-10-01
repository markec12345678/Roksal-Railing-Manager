#!/usr/bin/env python3
# R328 — derive r328-prod-qa.sh iz r327 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R328 zapis (55. člen primerjava dobaviteljev) PO 🆕 R327
#   2. EPOCH: R327_COMMIT_ISO/R327_PUSH → R328_*, guard → R32[6]|R327[_],
#      awk '^R327 —' → '^R328 —', R327_TABS → R328_TABS, Z0/UNION/footer
#   3. Generacijske poti: /tmp/r327- (34) → /tmp/r328- + __r326val (2) →
#      __r327val
#   4. R328 needle blok: splice PO R327 (CSV aria + VIR niz + TODO-R328)
#   5. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — R328 NE doda vodja
#      amber gumba; panel dobavitelji je navy/40)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r327-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r328-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R327 — PRVA naloga (worklog R327): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327 SKUPAJ na produ.',
    '''# R328 — PRVA naloga (worklog R328): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328 SKUPAJ na produ.
#   🆕 R328 = 55. člen issue #1 §5 (SUPPLIER COMPARISON — primerjava
#   dobaviteljev): NOVI lib cena-dobavitelji (drugo grupiranje ISTEGA
#   pregleda zgodovine R326 — EN VIR, nič drugega fetcha; iskren agregat
#   ŠTEVCEV smeri, nič izmišljenega povprečja; razpon trenutnih cen min/max;
#   sort po nazivu+supplierId UTF-16; filename primerjava-dobaviteljev.csv
#   brez datuma — primerjava NIMA referenčnega dneva); NOVI pod panel
#   CenaDobaviteljiPanel (LOČEN datoteka — LEKCIJA R325 5; pregled kot PROP
#   — EN VIR z zgodovina panelom); CSV gumb izvozne družine (navy/40 ring +
#   press-scale — amber/50 register ostane zaklenjen v vodji ×8). STIL val
#   15: dvonivojska hierarhija na NOVI površini (Card /30 + vrstica /40) +
#   obrnjene regresije (zgodovina par bajtno, vodja ×4/×4).''', 1)

# ── 2. EPOCH ──
zam('R327 commit meja ($R327_PUSH)', 'R328 commit meja ($R328_PUSH)', 1)
zam('R327 deploy potrjen (build $BUILD > R327 commit meja $R327_PUSH)', 'R328 deploy potrjen (build $BUILD > R328 commit meja $R328_PUSH)', 1)
zam('R327_COMMIT_ISO', 'R328_COMMIT_ISO', 3)
zam('R327_PUSH', 'R328_PUSH', 3)  # ×3 PO meja-zamenjavah ×2 (LEKCIJA R312: zaporedne zamenjave spreminjajo števce)
zam("$2 ~ /^R327 —/", "$2 ~ /^R328 —/", 1)
zam('R327_TABS', 'R328_TABS', 3)
zam("R32[5]_PUSH|R326[_]COMMIT_ISO", "R32[6]_PUSH|R327[_]COMMIT_ISO", 1)
zam("('R32[5]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R32[6]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R326 PUSH/COMMIT meje v r327-prod-qa.sh',
    'derive ostanki R327 PUSH/COMMIT meje v r328-prod-qa.sh', 1)
zam('derive čistost: OK (nič R326 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R327 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R327 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R328 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r327-', '/tmp/r328-', 36)
zam('__r326val', '__r327val', 4)

# ── 4. R328 needle blok (splice PO R327 bloku) ──
R328_BLOK = '''
echo "--- R328 MANDATORY — 55. člen: primerjava dobaviteljev (§5 supplier comparison — IZVOZI družina; LIVE) ---"
# §5: NOVI lib cena-dobavitelji — drugo grupiranje ISTEGA pregleda zgodovine
# cen R326 (EN VIR — pregled kot PROP, nič drugega fetcha; iskren agregat
# ŠTEVCEV smeri narašča/pada/stabilna/prvi vpis, nič izmišljenega povprečja;
# razpon trenutnih cen min/max; sort naziv+supplierId UTF-16; filename
# primerjava-dobaviteljev.csv brez datuma). NOVI pod panel
# CenaDobaviteljiPanel (LOČEN datoteka) + CSV gumb (navy/40 ring +
# press-scale — amber/50 register ostane zaklenjen v vodji ×8; fail-verbose
# toast). STIL val 15: Card /30 + vrstica /40 hierarhija + obrnjene
# regresije (zgodovina par ×2/×2 bajtno, vodja ×4/×4).
need "Izvozi primerjavo dobaviteljev kot CSV" "R328 primerjava dobaviteljev CSV gumb aria (panel chunk) — LIVE"
need "PRIMERJAVA_DOBAVITELJEV" "R328 primerjava dobaviteljev VIR niz (cena-dobavitelji lib) — LIVE"
must_miss "TODO-R328" "R328 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R327" "R327 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R327" "R327 — brez razvojnih ostankov"\n' + R328_BLOK, 1)

# ── 5. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — nič novih vodja amber gumbov) ──
# (brez zamenjave — register ostane ×8/R324; R328 panel je navy/40)

# ── 6. Footer ──
zam('=== R327 PROD QA — R290+…+R327 ŽIVO SKUPAJ ===',
    '=== R328 PROD QA — R290+…+R328 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r328-prod-qa.sh zapisan ({len(text)} znakov)')
