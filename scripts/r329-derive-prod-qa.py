#!/usr/bin/env python3
# R329 — derive r329-prod-qa.sh iz r328 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R329 zapis (56. člen PDF brat primerjava dobaviteljev) PO 🆕 R328
#   2. EPOCH: R328_COMMIT_ISO/R328_PUSH → R329_*, guard → R32[7]|R328[_],
#      awk '^R328 —' → '^R329 —', R328_TABS → R329_TABS, Z0/UNION/footer
#   3. Generacijske poti: /tmp/r328- (36) → /tmp/r329- + __r327val (4) →
#      __r328val
#   4. R329 needle blok: splice PO R328 (PDF aria + filename + TODO-R329)
#   5. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — R329 NE doda vodja
#      amber gumba; panel dobavitelji PDF je navy/40)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r328-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r329-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R328 — PRVA naloga (worklog R328): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328 SKUPAJ na produ.',
    '''# R329 — PRVA naloga (worklog R329): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329 SKUPAJ na produ.
#   🆕 R329 = 56. člen issue #1 (IZVOZI družina — PRIMERJAVA DOBAVITELJEV
#   PDF): NOVI lib cena-dobavitelji-pdf (deterministični PDF BRAT CSV-ju
#   R328 — LOČEN od podatkovnega brata, vzorec R324/R327; EN VIR
#   cenaDobaviteljiVrstice = skupni potrošnik CSV+PDF tabel — ne moreta
#   divergirati po konstrukciji; FNV soli 0xd5–0xd8; fiksni formatni žig
#   DOBAVITELJI_PDF_ZIG_FIKSNI — vsebina brez časa; filename
#   primerjava-dobaviteljev.pdf brez datuma — bratska simetrija); panel
#   izvozni PAR CSV+PDF na isti blok glavi (navy/40 ring + press-scale —
#   amber/50 register ostane zaklenjen v vodji ×8; fail-verbose toast ×2).
#   STIL val 16: izvozni PAR drugi gumb + WYSIWYG iskren alarm (narašča
#   text-roksal-red / pada text-roksal-green — zaslonska družina) + tabelska
#   glava border-b + obrnjene regresije (val 15 hierarhija, zgodovina par
#   bajtno, vodja ×4/×4).''', 1)

# ── 2. EPOCH ──
zam('R328 commit meja ($R328_PUSH)', 'R329 commit meja ($R329_PUSH)', 1)
zam('R328 deploy potrjen (build $BUILD > R328 commit meja $R328_PUSH)', 'R329 deploy potrjen (build $BUILD > R329 commit meja $R329_PUSH)', 1)
zam('R328_COMMIT_ISO', 'R329_COMMIT_ISO', 3)
zam('R328_PUSH', 'R329_PUSH', 3)  # ×3 PO meja-zamenjavah ×2 (LEKCIJA R312: zaporedne zamenjave spreminjajo števec; ESKALACIJA vrstica = 1. meja-zamenjava)
zam("$2 ~ /^R328 —/", "$2 ~ /^R329 —/", 1)
zam('R328_TABS', 'R329_TABS', 3)
zam("R32[6]_PUSH|R327[_]COMMIT_ISO", "R32[7]_PUSH|R328[_]COMMIT_ISO", 1)
zam("('R32[6]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R32[7]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R327 PUSH/COMMIT meje v r328-prod-qa.sh',
    'derive ostanki R328 PUSH/COMMIT meje v r329-prod-qa.sh', 1)
zam('derive čistost: OK (nič R327 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R328 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R328 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R329 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r328-', '/tmp/r329-', 36)
zam('__r327val', '__r328val', 4)

# ── 4. R329 needle blok (splice PO R328 bloku) ──
R329_BLOK = '''
echo "--- R329 MANDATORY — 56. člen: primerjava dobaviteljev PDF (IZVOZI družina — PDF brat CSV-ju R328; LIVE) ---"
# IZVOZI: NOVI lib cena-dobavitelji-pdf — deterministični PDF BRAT CSV-ju
# R328 (LOČEN od podatkovnega brata, vzorec R324/R327; EN VIR
# cenaDobaviteljiVrstice = skupni potrošnik CSV+PDF tabel; FNV soli
# 0xd5–0xd8; fiksni formatni žig — vsebina brez časa; filename
# primerjava-dobaviteljev.pdf brez datuma — bratska simetrija). Panel
# izvozni PAR CSV+PDF na isti blok glavi (navy/40 ring + press-scale;
# fail-verbose toast ×2). STIL val 16: izvozni PAR drugi gumb + WYSIWYG
# iskren alarm (narašča roksal-red / pada roksal-green) + tabelska glava
# border-b + obrnjene regresije (val 15 hierarhija, zgodovina par bajtno,
# vodja ×4/×4).
need "Izvozi primerjavo dobaviteljev kot PDF" "R329 primerjava dobaviteljev PDF gumb aria (panel chunk) — LIVE"
need "primerjava-dobaviteljev.pdf" "R329 primerjava dobaviteljev PDF filename (cena-dobavitelji-pdf lib) — LIVE"
must_miss "TODO-R329" "R329 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R328" "R328 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R328" "R328 — brez razvojnih ostankov"\n' + R329_BLOK, 1)

# ── 5. val8 labela NEPREMIKNJENA ×8 (iskrena resnica — nič novih vodja amber gumbov) ──
# (brez zamenjave — register ostane ×8/R324; R329 panel PDF je navy/40)

# ── 6. Footer ──
zam('=== R328 PROD QA — R290+…+R328 ŽIVO SKUPAJ ===',
    '=== R329 PROD QA — R290+…+R329 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r329-prod-qa.sh zapisan ({len(text)} znakov)')
