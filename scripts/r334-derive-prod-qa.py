#!/usr/bin/env python3
# R334 — derive r334-prod-qa.sh iz r333 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE;
# LEKCIJA R328: meja-zamenjave spreminjajo števec splošne zamenjave;
# LEKCIJA R332 6: guard razred = (N−2)_PUSH|(N−1)[_]COMMIT_ISO — za R334 =
# 'R33[2]_PUSH|R333[_]COMMIT_ISO').
# Transformacije:
#   1. Glava: R334 zapis (61. člen končna verifikacija CSV) PO 🆕 R333
#   2. EPOCH: R333_COMMIT_ISO/R333_PUSH → R334_*, guard → R33[2][_],
#      awk '^R333 —' → '^R334 —', R333_TABS → R334_TABS, Z0/UNION/footer
#   3. Generacijske poti: /tmp/r333- (36) → /tmp/r334- + __r332val (4) →
#      __r333val
#   4. R334 needle blok: splice PO R333 (CSV aria + testid + TODO-R334)
#   5. ESKALACIJA banner generacijski žig R333 → R334 (nevtralen vzorec)
#   6. val8 labela: vodja amber register ×8 → ×9 (R334 DODA vodja amber
#      gumb — končna verifikacija CSV, izvozna TRIADA; val 8 drevo 66→67)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r333-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r334-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R333 — PRVA naloga (worklog R333): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333 SKUPAJ na produ.',
    '''# R334 — PRVA naloga (worklog R334): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334 SKUPAJ na produ.
#   🆕 R334 = 61. člen issue #1 (IZVOZI družina — KONČNA VERIFIKACIJA CSV):
#   NOVI lib koncna-verifikacija-csv (CSV brat JSON R316 + PDF R320 —
#   izvozna TRIADA na vodja blok glavi; vzorec R317 audit-csv: ČISTA
#   projekcija EN VIR graditelja koncnaVerifikacija R315 — ISTA validacija
#   fail-closed brezplačno, NIČ podvojenih pravil; glavi VERBATIM PDF
#   autoTable head T1/T2 — anti-divergenca, testi pinajo PROTI PDF VIRU;
#   celice = ISTI izpisi kot PDF body — plasti pipe-joined + opomba dokaza
#   iz vezave; meta = KPI ×4 ISTI izpisi kot PDF kpiBox + Sklep VERBATIM
#   [ŠESTI potrošnik ENEGA niza] + Vir niz; BREZ časa — kanon determinizma
#   46./47. člen [isti HEAD = bajtno identična datoteka]; filename
#   koncna-verifikacija.csv — bratska simetrija z JSON/PDF imenoma; format
#   kanon R136 toCsv [BOM + podpičje + CRLF + RFC 4180]); vodja-dashboard:
#   exportKoncnaVerifikacijaCsv handler + izvozna TRIADA pill (amber/50
#   ring + offset-2 + press-scale — ISTI žeton kot brata, val 8 register
#   66 → 67 + vodja amber ×8 → ×9) + legenda medija. STIL val 21: izvozna
#   TRIADA pariteta bajtno + oči para + definicijski naslov medija + legenda
#   medija + obrnjene regresije (val 20 PAR, val 19 PAR, val 18 PAR, val 17
#   PAR, val 16 alarm, zgodovina par bajtno, vodja ×4/×4).''', 1)

# ── 2. EPOCH (meja-zamenjave PRVE — LEKCIJA R328: števec PO meja) ──
zam('R333 commit meja ($R333_PUSH)', 'R334 commit meja ($R334_PUSH)', 1)
zam('R333 deploy potrjen (build $BUILD > R333 commit meja $R333_PUSH)', 'R334 deploy potrjen (build $BUILD > R334 commit meja $R334_PUSH)', 1)
zam('R333_COMMIT_ISO', 'R334_COMMIT_ISO', 3)
zam('R333_PUSH', 'R334_PUSH', 3)  # ×3 PO meja-zamenjavah ×2 (LEKCIJA R312: zaporedne zamenjave spreminjajo števec)
zam("$2 ~ /^R333 —/", "$2 ~ /^R334 —/", 1)
zam('R333_TABS', 'R334_TABS', 3)
zam("R33[1]_PUSH|R332[_]COMMIT_ISO", "R33[2]_PUSH|R333[_]COMMIT_ISO", 1)
zam("('R33[1]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R33[2]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R332 PUSH/COMMIT meje v r333-prod-qa.sh',
    'derive ostanki R333 PUSH/COMMIT meje v r334-prod-qa.sh', 1)
zam('derive čistost: OK (nič R332 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R333 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R333 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R334 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r333-', '/tmp/r334-', 36)
zam('__r332val', '__r333val', 4)

# ── 4. R334 needle blok (splice PO R333 bloku) ──
R334_BLOK = '''
echo "--- R334 MANDATORY — 61. člen: končna verifikacija CSV (IZVOZI družina — CSV brat JSON R316 + PDF R320, izvozna TRIADA; LIVE) ---"
# IZVOZI: NOVI lib koncna-verifikacija-csv — CSV brat JSON R316 + PDF R320
# (vzorec R317 audit-csv: ČISTA projekcija EN VIR graditelja
# koncnaVerifikacija R315 — ISTA validacija fail-closed, NIČ podvojenih
# pravil; glavi VERBATIM PDF autoTable head T1/T2 — anti-divergenca;
# celice = ISTI izpisi kot PDF body; meta = KPI ×4 + Sklep VERBATIM +
# Vir niz; BREZ časa — kanon determinizma 46./47. člen; filename
# koncna-verifikacija.csv — bratska simetrija; format kanon R136 toCsv).
# vodja-dashboard: exportKoncnaVerifikacijaCsv handler + izvozna TRIADA
# pill (amber/50 ring + offset-2 + press-scale — val 8 register 67 + vodja
# amber ×9) + legenda medija. STIL val 21: TRIADA pariteta bajtno +
# definicijski naslov medija + legenda medija + obrnjene regresije.
need "Izvozi poročilo končne verifikacije kot CSV" "R334 končna verifikacija CSV gumb aria (vodja chunk) — LIVE"
need "koncna-verifikacija-csv-pill" "R334 končna verifikacija CSV gumb testid (vodja chunk) — LIVE"
must_miss "TODO-R334" "R334 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R333" "R333 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R333" "R333 — brez razvojnih ostankov"\n' + R334_BLOK, 1)

# ── 5. ESKALACIJA banner žig R333 → R334 (nevtralen vzorec iz R330 fixa) ──
zam('  echo "██ R333 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"',
    '  echo "██ R334 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"', 1)

# ── 6. val8: brez preverjanja v prod-qa (register ×8 → ×9 dokumentiran v
#    glavi + R334 needle bloku; preverba = vitest r317-stil-val8 [67 gumbov
#    + vodja amber ×9] — prod-qa NE ponavlja vitest pravil, LEKCIJA R316) ──

# ── 7. Footer ──
zam('=== R333 PROD QA — R290+…+R333 ŽIVO SKUPAJ ===',
    '=== R334 PROD QA — R290+…+R334 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r334-prod-qa.sh zapisan ({len(text)} znakov)')
