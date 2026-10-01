#!/usr/bin/env python3
# R331 — derive r331-prod-qa.sh iz r330 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE;
# LEKCIJA R328: meja-zamenjave spreminjajo števec splošne zamenjave).
# Transformacije:
#   1. Glava: R331 zapis (58. člen ponudbe-spomniki CSV) PO 🆕 R330
#   2. EPOCH: R330_COMMIT_ISO/R330_PUSH → R331_*, guard → R32[9]|R330[_],
#      awk '^R330 —' → '^R331 —', R330_TABS → R331_TABS, Z0/UNION/footer
#   3. Generacijske poti: /tmp/r330- (36) → /tmp/r331- + __r329val (4) →
#      __r330val
#   4. R331 needle blok: splice PO R330 (CSV aria + testid + TODO-R331)
#   5. ESKALACIJA banner generacijski žig R330 → R331 (popravljen R330 —
#      nevtralen nosi SAMO številko runde)
#   6. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — R331 NE doda vodja
#      amber gumba; ponudbe CSV je navy/40 na CRM kartici)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r330-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r331-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R330 — PRVA naloga (worklog R330): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330 SKUPAJ na produ.',
    '''# R331 — PRVA naloga (worklog R331): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331 SKUPAJ na produ.
#   🆕 R331 = 58. člen issue #1 (IZVOZI družina — PONUDBE — SPOMNIKI CSV):
#   NOVI lib ponudbe-spomniki-csv (CSV brat PDF R267 — vzorec R330/R297:
#   LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR ponudbeSpomnikiPregled,
#   NIČ podvojenih pravil; glava VERBATIM PDF autoTable head ×8; celice =
#   ISTI izpisi kot PDF body — status label R161, spomnik/montaža po
#   cenikDatumIso EN VIR, '—' iskren odpad, podpisano/odprto; meta kanon
#   R172→R296 — Obseg + števci ×12 + Sklep VERBATIM PDF sklepu [stanjeSklep
#   oznake + statusi] + Izvoženo ob; filename Ponudbe-spomniki-YYYY-MM-DD.csv
#   — bratska simetrija z PDF imenom); quote-followup: ENA izpeljava vira
#   pridobiPonudbeSpomnikiVnosi ×2 (oba brata — NIČ dvojnega med bralci) +
#   izvozna PAR (CSV pill navy/40 ring + press-scale — val 8 register 64).
#   STIL val 18: izvozna PAR pariteta + TROJICA press-scale [R161 gumb dobi
#   press-scale — iskrena nekonsistentnost odpravljena] + definicijski
#   naslov medija + legenda medija + obrnjene regresije (val 17 PAR, val 16
#   alarm, zgodovina par bajtno, vodja ×4/×4).''', 1)

# ── 2. EPOCH (meja-zamenjave PRVE — LEKCIJA R328: števec PO meja) ──
zam('R330 commit meja ($R330_PUSH)', 'R331 commit meja ($R331_PUSH)', 1)
zam('R330 deploy potrjen (build $BUILD > R330 commit meja $R330_PUSH)', 'R331 deploy potrjen (build $BUILD > R331 commit meja $R331_PUSH)', 1)
zam('R330_COMMIT_ISO', 'R331_COMMIT_ISO', 3)
zam('R330_PUSH', 'R331_PUSH', 3)  # ×3 PO meja-zamenjavah ×2 (LEKCIJA R312: zaporedne zamenjave spreminjajo števec)
zam("$2 ~ /^R330 —/", "$2 ~ /^R331 —/", 1)
zam('R330_TABS', 'R331_TABS', 3)
zam("R32[8]_PUSH|R329[_]COMMIT_ISO", "R32[9]_PUSH|R330[_]COMMIT_ISO", 1)
zam("('R32[8]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R32[9]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R329 PUSH/COMMIT meje v r330-prod-qa.sh',
    'derive ostanki R330 PUSH/COMMIT meje v r331-prod-qa.sh', 1)
zam('derive čistost: OK (nič R329 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R330 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R330 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R331 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r330-', '/tmp/r331-', 36)
zam('__r329val', '__r330val', 4)

# ── 4. R331 needle blok (splice PO R330 bloku) ──
R331_BLOK = '''
echo "--- R331 MANDATORY — 58. člen: pregled spomnikov ponudb CSV (IZVOZI družina — CSV brat PDF R267; LIVE) ---"
# IZVOZI: NOVI lib ponudbe-spomniki-csv — CSV brat PDF R267 (vzorec
# R330/R297: LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR
# ponudbeSpomnikiPregled, NIČ podvojenih pravil; glava VERBATIM PDF
# autoTable head ×8; meta kanon R172→R296; filename
# Ponudbe-spomniki-YYYY-MM-DD.csv — bratska simetrija). quote-followup:
# ENA izpeljava vira pridobiPonudbeSpomnikiVnosi ×2 (oba brata) + izvozna
# PAR (navy/40 ring + press-scale — val 8 register 64; TROJICA press-scale
# — R161 gumb dobi press-scale). STIL val 18: PAR pariteta + definicijski
# naslov medija + legenda medija + obrnjene regresije.
need "Izvozi pregled spomnikov ponudb kot CSV" "R331 ponudbe-spomniki CSV gumb aria (quote-followup chunk) — LIVE"
need "ponudbe-spomniki-csv-pill" "R331 ponudbe-spomniki CSV gumb testid (quote-followup chunk) — LIVE"
must_miss "TODO-R331" "R331 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R330" "R330 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R330" "R330 — brez razvojnih ostankov"\n' + R331_BLOK, 1)

# ── 5. ESKALACIJA banner žig R330 → R331 (nevtralen vzorec iz R330 fixa) ──
zam('  echo "██ R330 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"',
    '  echo "██ R331 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"', 1)

# ── 6. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — nič novih vodja amber gumbov) ──
# (brez zamenjave — register ostane ×8; R331 ponudbe CSV je navy/40)

# ── 7. Footer ──
zam('=== R330 PROD QA — R290+…+R330 ŽIVO SKUPAJ ===',
    '=== R331 PROD QA — R290+…+R331 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r331-prod-qa.sh zapisan ({len(text)} znakov)')
