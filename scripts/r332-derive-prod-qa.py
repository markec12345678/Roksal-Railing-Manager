#!/usr/bin/env python3
# R332 — derive r332-prod-qa.sh iz r331 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE;
# LEKCIJA R328: meja-zamenjave spreminjajo števec splošne zamenjave).
# Transformacije:
#   1. Glava: R332 zapis (59. člen potekli opomniki CSV) PO 🆕 R331
#   2. EPOCH: R331_COMMIT_ISO/R331_PUSH → R332_*, guard → R33[0-1][_],
#      awk '^R331 —' → '^R332 —', R331_TABS → R332_TABS, Z0/UNION/footer
#   3. Generacijske poti: /tmp/r331- (36) → /tmp/r332- + __r330val (4) →
#      __r331val
#   4. R332 needle blok: splice PO R331 (CSV aria + testid + TODO-R332)
#   5. ESKALACIJA banner generacijski žig R331 → R332 (nevtralen vzorec)
#   6. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — R332 NE doda vodja
#      amber gumba; potekli CSV je navy/40 na CRM tabu)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r331-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r332-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R331 — PRVA naloga (worklog R331): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331 SKUPAJ na produ.',
    '''# R332 — PRVA naloga (worklog R332): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332 SKUPAJ na produ.
#   🆕 R332 = 59. člen issue #1 (IZVOZI družina — POTEKLI OPOMNIKI CSV):
#   NOVI lib potekli-opomniki-csv (CSV brat PDF R252 — vzorec R330/R331/R297:
#   LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR preverba + sort +
#   agregat [preveriPotekliVnos + sortirajPotekle + potekliPovzetek +
#   potekelDniPrek — ISTA sekvenca kot buildPotekliOpomnikiPdfDoc], NIČ
#   podvojenih pravil; glava VERBATIM PDF autoTable head ×6; celice = ISTI
#   izpisi kot PDF body — trim, '—' iskren odpad, opomnik po cenikDatumIso
#   EN VIR, dni prek po potekelDniPrek EN VIR ≥ 1 monotona; meta kanon
#   R172→R296 — Obseg + KPI trio ISTI izpisi + Sklep VERBATIM PDF sklepu +
#   Izvoženo ob; filename Potekli-opomniki-YYYY-MM-DD.csv — bratska
#   simetrija z PDF imenom); crm-tab: ENA izpeljava izbora
#   potekliVnosiIzCustomers ×3 (definicija + OBA brata — NIČ dvojnega
#   izbora) + izvozna PAR (CSV pill navy/40 ring + press-scale — val 8
#   register 65). STIL val 19: izvozna PAR pariteta bajtno + oči para +
#   definicijski naslov medija + legenda medija + obrnjene regresije (val
#   18 PAR, val 17 PAR, val 16 alarm, zgodovina par bajtno, vodja ×4/×4).''', 1)

# ── 2. EPOCH (meja-zamenjave PRVE — LEKCIJA R328: števec PO meja) ──
zam('R331 commit meja ($R331_PUSH)', 'R332 commit meja ($R332_PUSH)', 1)
zam('R331 deploy potrjen (build $BUILD > R331 commit meja $R331_PUSH)', 'R332 deploy potrjen (build $BUILD > R332 commit meja $R332_PUSH)', 1)
zam('R331_COMMIT_ISO', 'R332_COMMIT_ISO', 3)
zam('R331_PUSH', 'R332_PUSH', 3)  # ×3 PO meja-zamenjavah ×2 (LEKCIJA R312: zaporedne zamenjave spreminjajo števec)
zam("$2 ~ /^R331 —/", "$2 ~ /^R332 —/", 1)
zam('R331_TABS', 'R332_TABS', 3)
zam("R32[9]_PUSH|R330[_]COMMIT_ISO", "R33[0-1]_PUSH|R332[_]COMMIT_ISO", 1)
zam("('R32[9]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R33[0-1]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R330 PUSH/COMMIT meje v r331-prod-qa.sh',
    'derive ostanki R331 PUSH/COMMIT meje v r332-prod-qa.sh', 1)
zam('derive čistost: OK (nič R330 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R331 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R331 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R332 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r331-', '/tmp/r332-', 36)
zam('__r330val', '__r331val', 4)

# ── 4. R332 needle blok (splice PO R331 bloku) ──
R332_BLOK = '''
echo "--- R332 MANDATORY — 59. člen: potekli opomniki CSV (IZVOZI družina — CSV brat PDF R252; LIVE) ---"
# IZVOZI: NOVI lib potekli-opomniki-csv — CSV brat PDF R252 (vzorec
# R330/R331/R297: LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR preverba
# + sort + agregat, NIČ podvojenih pravil; glava VERBATIM PDF autoTable
# head ×6; meta kanon R172→R296 — KPI trio ISTI izpisi; filename
# Potekli-opomniki-YYYY-MM-DD.csv — bratska simetrija). crm-tab: ENA
# izpeljava izbora potekliVnosiIzCustomers ×3 (definicija + OBA brata) +
# izvozna PAR (navy/40 ring + press-scale — val 8 register 65). STIL val
# 19: PAR pariteta bajtno + definicijski naslov medija + legenda medija +
# obrnjene regresije.
need "Izvozi potekle opomnike kot CSV" "R332 potekli opomniki CSV gumb aria (crm-tab chunk) — LIVE"
need "potekli-opomniki-csv-pill" "R332 potekli opomniki CSV gumb testid (crm-tab chunk) — LIVE"
must_miss "TODO-R332" "R332 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R331" "R331 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R331" "R331 — brez razvojnih ostankov"\n' + R332_BLOK, 1)

# ── 5. ESKALACIJA banner žig R331 → R332 (nevtralen vzorec iz R330 fixa) ──
zam('  echo "██ R331 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"',
    '  echo "██ R332 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"', 1)

# ── 6. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — nič novih vodja amber gumbov) ──
# (brez zamenjave — register ostane ×8; R332 potekli CSV je navy/40)

# ── 7. Footer ──
zam('=== R331 PROD QA — R290+…+R331 ŽIVO SKUPAJ ===',
    '=== R332 PROD QA — R290+…+R332 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r332-prod-qa.sh zapisan ({len(text)} znakov)')
