#!/usr/bin/env python3
# R327 — derive r327-prod-qa.sh iz r326 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R327 zapis (54. člen zgodovina cen PDF brat) PO 🆕 R326
#   2. EPOCH: R326_COMMIT_ISO/R326_PUSH → R327_*, guard → R32[5]|R326[_],
#      awk '^R326 —' → '^R327 —', R326_TABS → R327_TABS, Z0/UNION/footer
#   3. Generacijske poti: /tmp/r326- (36) → /tmp/r327- + __r325val (4) →
#      __r326val
#   4. R327 needle blok: splice PO R326 (PDF aria + filename + TODO-R327)
#   5. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — R327 NE doda vodja
#      amber gumba; panel par je navy/40)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r326-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r327-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R326 — PRVA naloga (worklog R326): potrditi R290+…+R321+R322+R323+R324+R325+R326 SKUPAJ na produ.',
    '''# R327 — PRVA naloga (worklog R327): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327 SKUPAJ na produ.
#   🆕 R327 = 54. člen issue #1 IZVOZI (ZGODOVINA CEN PDF — deterministični
#   PDF BRAT CSV-ju R326): NOVI lib cena-zgodovina-pdf (LOČEN od podatkovnega
#   brata — vzorec vodja-csv/vodja-dnevni-pdf R324; EN VIR cenaParVrstice =
#   skupni potrošnik CSV+PDF tabel — ne moreta divergirati po konstrukciji;
#   FNV soli 0xd1–0xd4; fiksni formatni žig CENA_PDF_ZIG_FIKSNI; filename
#   zgodovina-cen.pdf — zgodovina NIMA referenčnega dneva); panel izvozni
#   PAR CSV+PDF na isti blok glavi (OBA navy/40 ring + press-scale — amber/50
#   register ostane zaklenjen v vodji ×8; OBA pod istim pogojem — iskrena
#   ničelna veja). STIL val 14: harmonizacija izvoznega para + obrnjene
#   regresije val 13 hierarhije (panel /30+/40 ŽIVA, vodja ×4/×4 NEPREMIKNJEN).''', 1)

# ── 2. EPOCH ──
zam('R326 commit meja ($R326_PUSH)', 'R327 commit meja ($R327_PUSH)', 1)
zam('R326 deploy potrjen (build $BUILD > R326 commit meja $R326_PUSH)', 'R327 deploy potrjen (build $BUILD > R327 commit meja $R327_PUSH)', 1)
zam('R326_COMMIT_ISO', 'R327_COMMIT_ISO', 3)
zam('R326_PUSH', 'R327_PUSH', 3)  # ×3 PO stale-zamenjavah ×2 (LEKCIJA R312: zaporedne zamenjave spreminjajo števce)
zam("$2 ~ /^R326 —/", "$2 ~ /^R327 —/", 1)
zam('R326_TABS', 'R327_TABS', 3)
zam("R32[4]_PUSH|R325[_]COMMIT_ISO", "R32[5]_PUSH|R326[_]COMMIT_ISO", 1)
zam("('R32[4]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R32[5]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R325 PUSH/COMMIT meje v r326-prod-qa.sh',
    'derive ostanki R326 PUSH/COMMIT meje v r327-prod-qa.sh', 1)
zam('derive čistost: OK (nič R325 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R326 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R326 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R327 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323+R324+R325+R326 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r326-', '/tmp/r327-', 36)
zam('__r325val', '__r326val', 4)

# ── 4. R327 needle blok (splice PO R326 bloku, PRED naslednjim blokom) ──
R327_BLOK = '''
echo "--- R327 MANDATORY — 54. člen: zgodovina cen materiala PDF izvoz (IZVOZI družina — PDF brat CSV-ju; LIVE) ---"
# IZVOZI družina: NOVI lib cena-zgodovina-pdf — deterministični PDF brat
# CSV-ju R326 (EN VIR cenaParVrstice = skupni potrošnik CSV+PDF tabel;
# FNV soli 0xd1–0xd4; fiksni formatni žig CENA_PDF_ZIG_FIKSNI; filename
# zgodovina-cen.pdf); panel izvozni PAR na isti blok glavi (OBA gumba
# navy/40 ring + press-scale, OBA pod istim pogojem — iskrena ničelna
# veja). STIL val 14: harmonizacija para + val 13 hierarhija ŽIVA.
need "Izvozi zgodovino cen materiala kot PDF" "R327 zgodovina cen PDF gumb aria (panel chunk) — LIVE"
need "zgodovina-cen.pdf" "R327 zgodovina cen PDF izvoz filename (cena-zgodovina-pdf lib) — LIVE"
must_miss "TODO-R327" "R327 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R326" "R326 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R326" "R326 — brez razvojnih ostankov"\n' + R327_BLOK, 1)

# ── 5. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — nič novih vodja amber gumbov) ──
# (brez zamenjave — register ostane ×8/R324; R327 par je navy/40)

# ── 6. Footer ──
zam('=== R326 PROD QA — R290+…+R326 ŽIVO SKUPAJ ===',
    '=== R327 PROD QA — R290+…+R327 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r327-prod-qa.sh zapisan ({len(text)} znakov)')
