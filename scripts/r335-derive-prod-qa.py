#!/usr/bin/env python3
# R335 — derive r335-prod-qa.sh iz r334 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R335 zapis (62. člen mesečno poročilo CSV) PO R334 zapisu
#   2. EPOCH guard: R334_TABS/R334_COMMIT_ISO/R334_PUSH → R335_* + awk
#      '^R334 —' → '^R335 —' + stale R325 labeli → R335
#   3. Guard razred znakov: 'R33[2]_PUSH|R333[_]COMMIT_ISO' →
#      'R334[_]COMMIT_ISO|R334[_]PUSH|R334[_]TABS' (prejšnja generacija =
#      R334; LEKCIJA R332 6 vzorec)
#   4. Z2b dispatch variable: __r333val → __r334val (sledi generaciji)
#   5. R335 needle blok (CSV aria + testid + must_miss) — PO R334 bloku
#   6. Bannerji + footer: R334 → R335 (+R335 v UNION seznamih)
#   7. /tmp/r334- → /tmp/r335-
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r334-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r335-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: R335 zapis PO naslovni vrstici, PRED R334 opisom ──
zam('''# R334 — PRVA naloga (worklog R334): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334 SKUPAJ na produ.
#   🆕 R334 = 61. člen issue #1 (IZVOZI družina — KONČNA VERIFIKACIJA CSV):''',
'''# R335 — PRVA naloga (worklog R335): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334+R335 SKUPAJ na produ.
#   🆕 R335 = 62. člen issue #1 (IZVOZI družina — MESEČNO POROČILO VODJE CSV):
#   NOVI lib vodja-mesecni-csv (CSV brat Poročilo PDF rundi M — boss-report-pdf;
#   vzorec R330–R334: LOČEN lib ki UVAŽA resnico PDF brata — EN VIR: ISTI
#   ReportData vhod prek komponentne izpeljave mesecniPregledData [DVA
#   potrošnika: generateMonthlyReport + vodjaMesecniCsv — divergenca nemogoča,
#   vzorec vodjaIzvozVhod R293]; mesecIme + STATUS_SL UVOŽENA iz PDF brata
#   [anti-divergenca po konstrukciji]; celice = ISTI izpisi kot PDF body —
#   eur/eur0 EN VIR csv-export, zapadli 'Dni zapadlo' = ISTA izpeljava kot PDF;
#   glave VERBATIM PDF autoTable head ×3 + predstavitvena prihodki glava [PDF
#   riše graf]; sklep = VERBATIM PDF sklepna vrstica; 'Izvoženo ob' =
#   PODATKOVNI izvoz z referenčnim mesecem [kanon R330–R333 — zapadli dni je
#   odvisen od dneva]; filename porocilo-YYYY-MM.csv — bratska simetrija z PDF
#   imenom [mesec IZ VHODA, nikoli iz ure]; format kanon R136 toCsv [BOM +
#   podpičje + CRLF + RFC 4180]); vodja-dashboard: EN VIR izluščitev
#   mesecniPregledData (downloadReport nespremenjen po vedenju) +
#   handleMesecniCsv handler + izvozna PAR pill (amber/50 ring + offset-2 +
#   press-scale — ISTI žeton kot PDF brat, val 8 register 67 → 68 + vodja amber
#   ×9 → ×10 + val 9 taktilni 16 → 17) + legenda medija. STIL val 22: izvozna
#   PAR pariteta + oči para + definicijski naslov medija + legenda medija +
#   obrnjene regresije (val 21 TRIADA, val 20/19/18/17 PAR, val 16 alarm,
#   zgodovina par bajtno, vodja ×4/×4).
#   🆕 R334 = 61. člen issue #1 (IZVOZI družina — KONČNA VERIFIKACIJA CSV):''')

# ── 2. EPOCH guard ──
zam('R334_TABS', 'R335_TABS', 3)
zam('''R334_COMMIT_ISO="$(git log --format='%cI ::: %s' 2>/dev/null | awk -F' ::: ' '$2 ~ /^R334 —/ {print $1; exit}')"
[ -n "$R334_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R325 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }
R334_PUSH="$(date -u -d "$R334_COMMIT_ISO" +%Y-%m-%dT%H:%M:%S)"
echo "R325 meja (commit čas, UTC): $R334_PUSH"''',
'''R335_COMMIT_ISO="$(git log --format='%cI ::: %s' 2>/dev/null | awk -F' ::: ' '$2 ~ /^R335 —/ {print $1; exit}')"
[ -n "$R335_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R335 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }
R335_PUSH="$(date -u -d "$R335_COMMIT_ISO" +%Y-%m-%dT%H:%M:%S)"
echo "R335 meja (commit čas, UTC): $R335_PUSH"''')
zam('R334_PUSH', 'R335_PUSH', 3)  # preostale uporabe (python argv + ESKALACIJA + LIVE echo; def+meja echo sta v veliki zamenjavi)
zam('$R334_COMMIT_ISO', '$R335_COMMIT_ISO', 0)  # sanity: vse že preimenovane

# ── 3. Guard razred znakov (prejšnja generacija = R334) ──
zam("""#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R33[2]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).""",
"""#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R334[_]PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).""")
zam("""if grep -qE 'R33[2]_PUSH|R333[_]COMMIT_ISO' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R333 PUSH/COMMIT meje v r334-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R333 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)\"""",
"""if grep -qE 'R334[_]COMMIT_ISO|R334[_]PUSH|R334[_]TABS' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R334 PUSH/COMMIT/TABS meje v r335-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R334 PUSH/COMMIT/TABS ostankov — razred znakov, brez samozadetka)\"""")

# ── 4. Z2b dispatch variable sledi generaciji ──
zam('__r333val', '__r334val', 4)

# ── 5. ESKALACIJA + LIVE bannerji + UNION seznami ──
zam('echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R334 commit meja ($R335_PUSH)."',
    'echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R335 commit meja ($R335_PUSH)."')
zam('echo "██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    'echo "██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334+R335 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest')
zam('echo "██ R334 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"',
    'echo "██ R335 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"')
zam('echo "R334 deploy potrjen (build $BUILD > R334 commit meja $R335_PUSH) — polni LIVE teki"',
    'echo "R335 deploy potrjen (build $BUILD > R335 commit meja $R335_PUSH) — polni LIVE teki"')
zam('echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R325 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R335 — kanon R280/R284)"')

# ── 6. /tmp poti ──
zam('/tmp/r334-', '/tmp/r335-', 36)

# ── 7. R335 needle blok PO R334 bloku ──
zam('''need "Izvozi poročilo končne verifikacije kot CSV" "R334 končna verifikacija CSV gumb aria (vodja chunk) — LIVE"
need "koncna-verifikacija-csv-pill" "R334 končna verifikacija CSV gumb testid (vodja chunk) — LIVE"
must_miss "TODO-R334" "R334 — brez razvojnih ostankov"''',
'''need "Izvozi poročilo končne verifikacije kot CSV" "R334 končna verifikacija CSV gumb aria (vodja chunk) — LIVE"
need "koncna-verifikacija-csv-pill" "R334 končna verifikacija CSV gumb testid (vodja chunk) — LIVE"
must_miss "TODO-R334" "R334 — brez razvojnih ostankov"
echo "--- R335 MANDATORY — 62. člen: mesečno poročilo vodje CSV (IZVOZI družina — CSV brat Poročilo PDF rundi M, EN VIR mesecniPregledData; LIVE) ---"
# IZVOZI: NOVI lib vodja-mesecni-csv — CSV brat Poročilo PDF rundi M
# (vzorec R330–R334: LOČEN lib ki UVAŽA resnico PDF brata — EN VIR: ISTI
# ReportData vhod prek komponentne izpeljave mesecniPregledData [DVA
# potrošnika]; mesecIme + STATUS_SL UVOŽENA iz PDF brata — anti-divergenca;
# celice = ISTI izpisi kot PDF body; glave VERBATIM PDF autoTable head ×3;
# sklep = VERBATIM PDF sklepna vrstica; 'Izvoženo ob' = PODATKOVNI izvoz z
# referenčnim mesecem — kanon R330–R333; filename porocilo-YYYY-MM.csv —
# bratska simetrija; format kanon R136 toCsv).
# vodja-dashboard: EN VIR izluščitev mesecniPregledData + handleMesecniCsv
# handler + izvozna PAR pill (amber/50 ring + offset-2 + press-scale — val 8
# register 68 + vodja amber ×10 + val 9 taktilni 17) + legenda medija. STIL
# val 22: PAR pariteta bajtno + definicijski naslov medija + legenda medija +
# obrnjene regresije.
need "Izvozi mesečno poročilo vodje kot CSV" "R335 mesečno poročilo CSV gumb aria (vodja chunk) — LIVE"
need "vodja-mesecni-csv-pill" "R335 mesečno poročilo CSV gumb testid (vodja chunk) — LIVE"
must_miss "TODO-R335" "R335 — brez razvojnih ostankov"''')

# ── 8. Footer ──
zam('echo "=== R334 PROD QA — R290+…+R334 ŽIVO SKUPAJ ==="',
    'echo "=== R335 PROD QA — R290+…+R335 ŽIVO SKUPAJ ==="')

DOL.write_text(text, encoding='utf-8')
print('r335-prod-qa.sh: OK (derive iz r334)')
