#!/usr/bin/env python3
# R330 — derive r330-prod-qa.sh iz r329 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE;
# LEKCIJA R328: meja-zamenjave spreminjajo števec splošne zamenjave).
# Transformacije:
#   1. Glava: R330 zapis (57. člen projekti-termini CSV) PO 🆕 R329
#   2. EPOCH: R329_COMMIT_ISO/R329_PUSH → R330_*, guard → R32[8]|R329[_],
#      awk '^R329 —' → '^R330 —', R329_TABS → R330_TABS, Z0/UNION/footer
#   3. Generacijske poti: /tmp/r329- (36) → /tmp/r330- + __r328val (4) →
#      __r329val
#   4. R330 needle blok: splice PO R329 (CSV aria + testid + TODO-R330)
#   5. 🆕 QA-ORODJE POPRAVEK (bug najden v R330 prvi nalogi): stale
#      ESKALACIJA banner še z R294 dobe ("R294 PROD QA", "4. zapis, stale od
#      20:46:30Z", "R290+…+R314") — generacijsko nevtralen R330 banner
#   6. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — R330 NE doda vodja
#      amber gumba; projekti CSV je navy/40 na logistiki)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r329-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r330-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R329 — PRVA naloga (worklog R329): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329 SKUPAJ na produ.',
    '''# R330 — PRVA naloga (worklog R330): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330 SKUPAJ na produ.
#   🆕 R330 = 57. člen issue #1 (IZVOZI družina — PROJEKTI — TERMINI CSV):
#   NOVI lib projekti-termini-csv (CSV brat PDF R265 — vzorec R297
#   oprema-cikel-csv: LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR
#   projektiTerminiPregled, NIČ podvojenih pravil; glava VERBATIM PDF
#   autoTable head ×8; celice = ISTI izpisi kot PDF body — stranka '—',
#   ure '—', obdobje po cenikDatumIso EN VIR; meta kanon R172→R296 — Obseg
#   + števci ×10 + Sklep VERBATIM PDF sklepu + Izvoženo ob; filename
#   Projekti-termini-YYYY-MM-DD.csv — bratska simetrija z PDF imenom);
#   logistics-tab: ENA izpeljava vira pridobiProjektiTerminiVnosi ×2 (oba
#   brata — NIČ dvojnega med bralci, vzorec R297 pridobiOpremoVnosi) +
#   izvozna PAR (CSV pill navy/40 ring + press-scale — val 8 register 63).
#   STIL val 17: izvozna PAR pariteta + definicijski naslov medija (PDF =
#   tisk za vodjo, CSV = Excel za filtriranje) + obrnjene regresije (val 16
#   alarm, val 15 hierarhija, zgodovina par bajtno, vodja ×4/×4).''', 1)

# ── 2. EPOCH (meja-zamenjave PRVE — LEKCIJA R328: števec Po meja) ──
zam('R329 commit meja ($R329_PUSH)', 'R330 commit meja ($R330_PUSH)', 1)
zam('R329 deploy potrjen (build $BUILD > R329 commit meja $R329_PUSH)', 'R330 deploy potrjen (build $BUILD > R330 commit meja $R330_PUSH)', 1)
zam('R329_COMMIT_ISO', 'R330_COMMIT_ISO', 3)
zam('R329_PUSH', 'R330_PUSH', 3)  # ×3 PO meja-zamenjavah ×2 (LEKCIJA R312: zaporedne zamenjave spreminjajo števec)
zam("$2 ~ /^R329 —/", "$2 ~ /^R330 —/", 1)
zam('R329_TABS', 'R330_TABS', 3)
zam("R32[7]_PUSH|R328[_]COMMIT_ISO", "R32[8]_PUSH|R329[_]COMMIT_ISO", 1)
zam("('R32[7]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R32[8]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R328 PUSH/COMMIT meje v r329-prod-qa.sh',
    'derive ostanki R329 PUSH/COMMIT meje v r330-prod-qa.sh', 1)
zam('derive čistost: OK (nič R328 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R329 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R329 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R330 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r329-', '/tmp/r330-', 36)
zam('__r328val', '__r329val', 4)

# ── 4. R330 needle blok (splice PO R329 bloku) ──
R330_BLOK = '''
echo "--- R330 MANDATORY — 57. člen: pregled projektov in terminov CSV (IZVOZI družina — CSV brat PDF R265; LIVE) ---"
# IZVOZI: NOVI lib projekti-termini-csv — CSV brat PDF R265 (vzorec R297
# oprema-cikel-csv: LOČEN lib ki UVAŽA projekcijo PDF brata — EN VIR
# projektiTerminiPregled, NIČ podvojenih pravil; glava VERBATIM PDF
# autoTable head ×8; meta kanon R172→R296; filename
# Projekti-termini-YYYY-MM-DD.csv — bratska simetrija). Logistics-tab:
# ENA izpeljava vira pridobiProjektiTerminiVnosi ×2 (oba brata) + izvozna
# PAR (navy/40 ring + press-scale — val 8 register 63). STIL val 17:
# PAR pariteta + definicijski naslov medija + obrnjene regresije.
need "Izvozi pregled projektov in terminov kot CSV" "R330 projekti-termini CSV gumb aria (logistics chunk) — LIVE"
need "projekti-termini-csv-pill" "R330 projekti-termini CSV gumb testid (logistics chunk) — LIVE"
must_miss "TODO-R330" "R330 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R329" "R329 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R329" "R329 — brez razvojnih ostankov"\n' + R330_BLOK, 1)

# ── 5. QA-ORODJE POPRAVEK: stale ESKALACIJA banner generacijsko nevtralen ──
# (bug najden v R330 prvi nalogi: banner še z R294 dobe — napačno "R294 PROD
# QA", "4. zapis, stale od 20:46:30Z", "R290+…+R314" — zavajajoče pri
# poznih generacijah; r330 popravi, derive fail-closed ujame ×1 vsako)
zam('''  echo "██ R294 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"
  echo "██ stale build ($BUILD) sam po sebi ZDRAV"
  echo "██ (needleji + Z1b + Z3 ŽIVO; ZERO must_miss — skew protection lekcija R294)."
  echo "██ ESKALACIJA LASTNIKU: Vercel dashboard — deploy stuck/limit (4. zapis, stale od 20:46:30Z)."
  echo "██ Runda nadaljuje LOKALNO (kanon R280/R284: naslednji push nosi"
  echo "██ vse generacije — needleji pokrijejo R290+…+R314 — kanon R280/R284)."''',
'''  echo "██ R330 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"
  echo "██ stale build ($BUILD) sam po sebi ZDRAV"
  echo "██ (needleji + Z1b + Z3 ŽIVO; ZERO must_miss — skew protection lekcija R294)."
  echo "██ ESKALACIJA LASTNIKU: Vercel dashboard — deploy stuck/limit (iskren stale-dokaz zgoraj)."
  echo "██ Runda nadaljuje LOKALNO (kanon R280/R284: naslednji zeleni deploy"
  echo "██ nosi VSE generacije — UNION harvest; precedens R313/R314)."''', 1)

# ── 6. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — nič novih vodja amber gumbov) ──
# (brez zamenjave — register ostane ×8; R330 projekti CSV je navy/40)

# ── 7. Footer ──
zam('=== R329 PROD QA — R290+…+R329 ŽIVO SKUPAJ ===',
    '=== R330 PROD QA — R290+…+R330 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r330-prod-qa.sh zapisan ({len(text)} znakov)')
