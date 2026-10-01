#!/usr/bin/env python3
# R333 — derive r333-prod-qa.sh iz r332 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE;
# LEKCIJA R328: meja-zamenjave spreminjajo števec splošne zamenjave;
# LEKCIJA R332 6: guard razred = (N−2)_PUSH|(N−1)[_]COMMIT_ISO — za R333 =
# 'R33[1]_PUSH|R332[_]COMMIT_ISO').
# Transformacije:
#   1. Glava: R333 zapis (60. člen pozicija dobaviteljev CSV) PO 🆕 R332
#   2. EPOCH: R332_COMMIT_ISO/R332_PUSH → R333_*, guard → R33[1][_],
#      awk '^R332 —' → '^R333 —', R332_TABS → R333_TABS, Z0/UNION/footer
#   3. Generacijske poti: /tmp/r332- (36) → /tmp/r333- + __r331val (4) →
#      __r332val
#   4. R333 needle blok: splice PO R332 (CSV aria + testid + TODO-R333)
#   5. ESKALACIJA banner generacijski žig R332 → R333 (nevtralen vzorec)
#   6. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — R333 NE doda vodja
#      amber gumba; pozicija CSV je navy/40 na Material pregledu)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r332-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r333-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R332 — PRVA naloga (worklog R332): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332 SKUPAJ na produ.',
    '''# R333 — PRVA naloga (worklog R333): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333 SKUPAJ na produ.
#   🆕 R333 = 60. člen issue #1 (IZVOZI družina — DOBAVITELJI — POZICIJA CEN
#   CSV): NOVI lib dobavitelji-pozicija-csv (CSV brat PDF R264 — vzorec
#   R330/R331/R332/R297: LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR
#   preverba + JOIN + min-invarianta + agregat + sort [dobaviteljiPozicijaCen
#   — ISTA sekvenca kot buildDobaviteljiPozicijaPdfDoc] + odstotekNiz IZVOŽEN
#   iz PDF brata [R333 — ISTI odstotek izpis, NIČ podvojenega formatiranja],
#   NIČ podvojenih pravil; glava VERBATIM PDF autoTable head ×6; celice =
#   ISTI izpisi kot PDF body — '—' iskren odpad pri povprečnem odstotku vseh
#   najnižjih, najširši razpon VEDNO definiran [0 = vse najnižje]; meta kanon
#   R172→R296 — Obseg + KPI peterica ISTI izpisi kot PDF kpiBox + Sklep
#   VERBATIM PDF sklepu + Izvoženo ob; filename
#   Pozicija-dobaviteljev-YYYY-MM-DD.csv — bratska simetrija z PDF imenom);
#   material-intelligence-tab: ENA izpeljava preseka pridobiPozicijo
#   (definicija ×1 + OBA brata ×2 — EN fetch, NIČ dvojnega preseka) +
#   izvozna PAR (CSV pill navy/40 ring + press-scale + ring-offset-1 — ISTI
#   žeton kot PDF brat, val 8 register 66). STIL val 20: izvozna PAR
#   pariteta bajtno + oči para + definicijski naslov medija + legenda
#   medija + obrnjene regresije (val 19 PAR, val 18 PAR, val 17 PAR, val 16
#   alarm, zgodovina par bajtno, vodja ×4/×4).''', 1)

# ── 2. EPOCH (meja-zamenjave PRVE — LEKCIJA R328: števec PO meja) ──
zam('R332 commit meja ($R332_PUSH)', 'R333 commit meja ($R333_PUSH)', 1)
zam('R332 deploy potrjen (build $BUILD > R332 commit meja $R332_PUSH)', 'R333 deploy potrjen (build $BUILD > R333 commit meja $R333_PUSH)', 1)
zam('R332_COMMIT_ISO', 'R333_COMMIT_ISO', 3)
zam('R332_PUSH', 'R333_PUSH', 3)  # ×3 PO meja-zamenjavah ×2 (LEKCIJA R312: zaporedne zamenjave spreminjajo števec)
zam("$2 ~ /^R332 —/", "$2 ~ /^R333 —/", 1)
zam('R332_TABS', 'R333_TABS', 3)
zam("R33[0]_PUSH|R331[_]COMMIT_ISO", "R33[1]_PUSH|R332[_]COMMIT_ISO", 1)
zam("('R33[0]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R33[1]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R331 PUSH/COMMIT meje v r332-prod-qa.sh',
    'derive ostanki R332 PUSH/COMMIT meje v r333-prod-qa.sh', 1)
zam('derive čistost: OK (nič R331 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R332 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R332 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R333 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r332-', '/tmp/r333-', 36)
zam('__r331val', '__r332val', 4)

# ── 4. R333 needle blok (splice PO R332 bloku) ──
R333_BLOK = '''
echo "--- R333 MANDATORY — 60. člen: pozicija dobaviteljev CSV (IZVOZI družina — CSV brat PDF R264; LIVE) ---"
# IZVOZI: NOVI lib dobavitelji-pozicija-csv — CSV brat PDF R264 (vzorec
# R330/R331/R332/R297: LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR
# preverba + JOIN + min-invarianta + agregat + sort [dobaviteljiPozicijaCen]
# + odstotekNiz IZVOŽEN iz PDF brata, NIČ podvojenih pravil; glava VERBATIM
# PDF autoTable head ×6; meta kanon R172→R296 — KPI peterica ISTI izpisi;
# filename Pozicija-dobaviteljev-YYYY-MM-DD.csv — bratska simetrija).
# material-intelligence-tab: ENA izpeljava preseka pridobiPozicijo
# (definicija + OBA brata) + izvozna PAR (navy/40 ring + press-scale +
# ring-offset-1 — val 8 register 66). STIL val 20: PAR pariteta bajtno +
# definicijski naslov medija + legenda medija + obrnjene regresije.
need "Izvozi pozicijo dobaviteljev kot CSV" "R333 pozicija dobaviteljev CSV gumb aria (material chunk) — LIVE"
need "pozicija-dobaviteljev-csv-pill" "R333 pozicija dobaviteljev CSV gumb testid (material chunk) — LIVE"
must_miss "TODO-R333" "R333 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R332" "R332 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R332" "R332 — brez razvojnih ostankov"\n' + R333_BLOK, 1)

# ── 5. ESKALACIJA banner žig R332 → R333 (nevtralen vzorec iz R330 fixa) ──
zam('  echo "██ R332 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"',
    '  echo "██ R333 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"', 1)

# ── 6. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — nič novih vodja amber gumbov) ──
# (brez zamenjave — register ostane ×8; R333 pozicija CSV je navy/40 na Material pregledu)

# ── 7. Footer ──
zam('=== R332 PROD QA — R290+…+R332 ŽIVO SKUPAJ ===',
    '=== R333 PROD QA — R290+…+R333 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r333-prod-qa.sh zapisan ({len(text)} znakov)')
