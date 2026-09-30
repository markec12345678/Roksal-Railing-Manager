#!/usr/bin/env python3
# R323 — derive r323-prod-qa.sh iz vzporedne r322 generacije (kanon kolizija
# LEKCIJA 1). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed;
# LEKCIJA R312: štetje na POJAVITVE). Transformacije:
#   1. Glava: R323 zapis (51. člen CSV + STIL val 11)
#   2. EPOCH: R322_COMMIT_ISO/R322_PUSH → R323_*, awk '^R322 —' → '^R323 —',
#      guard 'R32[0]_PUSH|R321[_]COMMIT_ISO' → 'R32[1]_PUSH|R322[_]COMMIT_ISO'
#   3. Generacijske poti: /tmp/r322- → /tmp/r323- (36) + __r321val →
#      __r322val (4) + R322_TABS → R323_TABS
#   4. R323 needle blok: splice PO R322 (CSV izvoz aria/title + TODO-R323)
#   5. val8 labela ×6 → ×7 (register R323; obrnjena regresija)
#   6. Izhodna-stran asercija
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r322-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r323-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R322 — PRVA naloga (worklog R322): potrditi R290+…+R321+R322 SKUPAJ na produ.',
    '# R323 — PRVA naloga (worklog R323): potrditi R290+…+R321+R322+R323 SKUPAJ na produ.\n'
    '#   🆕 R323 = 51. člen issue #1 (IZVOZI družina): izvoz meritev zmogljivosti\n'
    '#   kot DETERMINISTIČNI CSV (Deliverable 6 prenosljiv artifact — družinska\n'
    '#   simetrija kanon: Del. 4 = CSV+PDF, Del. 7 = JSON+PDF, Del. 6 = PDF+CSV;\n'
    '#   CSV brat PDF R321; EN VIR kontrakt R323 v bratu: glave\n'
    '#   ZMOGLJIVOST_IZVOZ_GLAVE + validacija preveriZmogljivostPregledZaIzvoz +\n'
    '#   formatirajMs + VIR_NIZ — PDF in CSV ne moreta divergirati po\n'
    '#   konstrukciji; toCsv kanon R136; sklep = ČETRTI potrošnik ENEGA niza).\n'
    '#   STIL val 11: dokazni bloki sekcija hover (transition-colors + amber/30\n'
    '#   — 3 bloki enoten žeton, MEKŠI od vrstičnega amber/40 val 10; val8 amber\n'
    '#   ×6→×7 + val9 press-scale ×13→14 PIN SHIFTI).')

# ── 2. EPOCH ──
zam('R322_COMMIT_ISO', 'R323_COMMIT_ISO', 3)
zam('R322_PUSH', 'R323_PUSH', 5)
zam("$2 ~ /^R322 —/", "$2 ~ /^R323 —/", 1)
zam('R322_TABS', 'R323_TABS', 3)
zam("R32[0]_PUSH|R321[_]COMMIT_ISO", "R32[1]_PUSH|R322[_]COMMIT_ISO", 1)
zam("('R32[0]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R32[1]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R321 PUSH/COMMIT meje v r322-prod-qa.sh',
    'derive ostanki R322 PUSH/COMMIT meje v r323-prod-qa.sh', 1)
zam('derive čistost: OK (nič R321 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R322 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R322 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R323 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r322-', '/tmp/r323-', 36)
zam('__r321val', '__r322val', 4)

# ── 4. R323 needle blok (splice PO R322 bloku, PRED Z2b) ──
R323_BLOK = '''
echo "--- R323 MANDATORY — 51. člen: izvoz meritev zmogljivosti (CSV) + STIL val 11 (LIVE) ---"
# IZVOZI družina: CSV gumb v zmogljivost-dokaz bloku (vodja chunk) —
# deterministični CSV izvoz (pregled = POSREDOVANA resnica; EN VIR kontrakt
# R323 — glave + validacija + formatirajMs + Vir niz iz brata; CSV NE uvaža
# jsPDF; toCsv kanon R136 [BOM + podpičje + CRLF]; vitest
# r323-zmogljivost-pregled-csv ×15; E2E Z0as DETERMINIZEM ŽIVO NA BAJTIH:
# dva izvoza bajtno enaka + BOM magija + glave EN VIR pin). STIL val 11:
# dokazni bloki sekcija hover žeton ×3 (r323-stil-val11 STRAŽAR; utility
# klas = build-nivo SAMO — LEKCIJA R316 signature).
need "Izvozi meritve zmogljivosti kot CSV" "R323 CSV izvoz gumb aria (vodja chunk) — LIVE"
need "kot deterministični CSV" "R323 CSV izvoz title fragment (vodja chunk) — LIVE"
must_miss "TODO-R323" "R323 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R322" "R322 — brez razvojnih ostankov"\n\necho "=== Z2b:',
    'must_miss "TODO-R322" "R322 — brez razvojnih ostankov"\n' + R323_BLOK + 'echo "=== Z2b:', 1)

# ── 5. val8 labela ×6 → ×7 (register R323; obrnjena regresija) ──
zam('focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×6 — register R321) — LIVE"',
    'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×7 — register R323) — LIVE"', 1)
zam('# blok glave ×6 [dnevni', '# blok glave ×7 [dnevni', 1)

# ── 6. Izhodna stran ──
zam('=== R322 PROD QA — R290+…+R322 ŽIVO SKUPAJ ===',
    '=== R323 PROD QA — R290+…+R323 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r323-prod-qa.sh zapisan ({len(text)} znakov)')
