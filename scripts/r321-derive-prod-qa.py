#!/usr/bin/env python3
# R321 — derive r321-prod-qa.sh iz r320-prod-qa.sh (generacijski vzorec
# r305→…→r320). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed:
# napačno število POJAVITEV → izpisek + exit 1; LEKCIJA R312/R314/R315/R316/
# R317/R318/R320: štetje na POJAVITVE, ne grep -c vrstice; window val
# spremenljivka v Z2b sledi generaciji — __r319val → __r320val).
# Transformacije:
#   1. Glava: R321 zapis (50. člen — izvoz meritev zmogljivosti PDF + STIL
#      val 10 dokazni bloki hover)
#   2. EPOCH: R320_COMMIT_ISO/R320_PUSH → R321_*, awk '^R320 —' → '^R321 —',
#      guard R31[8] → R31[9], detekcija/skupni-deploy oznake → R320 union
#   3. Generacijske poti: /tmp/r320- → /tmp/r321- (36) + stari val →
#      novi val (4)
#   4. R321 needle blok: splice PRED Z2b (PDF izvoz aria/title + TODO-R321)
#   5. val8 labela ×5 → ×6 (register R321; obrnjena regresija)
#   6. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r320-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r321-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R320 — PRVA naloga (worklog R320): potrditi R290+…+R318+R320 SKUPAJ na produ.',
    '# R321 — PRVA naloga (worklog R321): potrditi R290+…+R318+R319+R320+R321 SKUPAJ na produ.\n'
    '#   🆕 R321 = 50. člen issue #1 (IZVOZI družina): izvoz meritev zmogljivosti\n'
    '#   kot DETERMINISTIČNI PDF (Deliverable 6 tisk; brat zaslona R312 — vzorec\n'
    '#   R318/R320: LOČEN lib; pregled = POSREDOVANA resnica — meritev se izvede\n'
    '#   ENKRAT v brskalniku, PDF NE meri znova; sklep = TRETJI potrošnik ENEGA\n'
    '#   niza; formatirajMs = EN VIR zaslon + PDF iz brata; fiksni formatni žig\n'
    '#   ZMOGLJIVOST_PDF_ZIG_FIKSNI + FNV soli 0xc9–0xcc). STIL val 10: dokazni\n'
    '#   bloki vrstični hover (transition-colors + amber/40 — 3 bloki enoten\n'
    '#   žeton; val8 amber ×5→×6 + val9 press-scale ×12→13 PIN SHIFTI).\n')

# ── 2. EPOCH ──
zam('R320_COMMIT_ISO', 'R321_COMMIT_ISO', 3)
zam('R320_PUSH', 'R321_PUSH', 5)
zam("$2 ~ /^R320 —/", "$2 ~ /^R321 —/", 1)
zam('R31[8]_PUSH', 'R31[9]_PUSH', 2)
zam('R318[_]COMMIT_ISO', 'R320[_]COMMIT_ISO', 1)
zam('=== Z0: prod build-guard — R317 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R320 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R317 pričakuje SKUPNI deploy (kanon R280/R284).',
    '██ R318+R319+R320 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest\n██ ob prvem prostem deployu; precedens R313/R314).', 1)
zam('derive ostanki R318 PUSH/COMMIT meje v r320-prod-qa.sh',
    'derive ostanki R320 PUSH/COMMIT meje v r321-prod-qa.sh', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r320-', '/tmp/r321-', 36)
zam('__r319val', '__r320val', 4)

# ── 4. Z2 inventar + R321 needle blok ──
zam('R320 ×2+1 + R318 ×2+1',
    'R321 ×2+1 + R320 ×2+1 + R318 ×2+1', 2)

R321_BLOK = '''
echo "--- R321 MANDATORY — 50. člen: izvoz meritev zmogljivosti (PDF) + STIL val 10 (LIVE) ---"
# IZVOZI družina: PDF gumb v zmogljivost-dokaz bloku (vodja chunk) —
# deterministični PDF izvoz (pregled = POSREDOVANA resnica — meritev se
# izvede ENKRAT v brskalniku, PDF NE meri znova; formatirajMs = EN VIR zaslon
# + PDF iz brata R312; LOČEN lib po vzorcu R318/R320; vitest
# r321-zmogljivost-pregled-pdf ×10; E2E Z0ar DETERMINIZEM ŽIVO NA BAJTIH:
# dva izvoza bajtno enaka + %PDF- magija). STIL val 10: dokazni bloki
# vrstični hover žeton ×3 (r321-stil-val10 STRAŽAR; utility klas = build-
# nivo SAMO — LEKCIJA R316 signature).
need "Izvozi meritve zmogljivosti kot PDF" "R321 PDF izvoz gumb aria (vodja chunk) — LIVE"
need "kot deterministični PDF" "R321 PDF izvoz title fragment (vodja chunk) — LIVE"
must_miss "TODO-R321" "R321 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R320" "R320 — brez razvojnih ostankov"\n\necho "=== Z2b:',
    'must_miss "TODO-R320" "R320 — brez razvojnih ostankov"\n' + R321_BLOK + 'echo "=== Z2b:', 1)

# ── 5. val8 labela ×5 → ×6 (register R321; obrnjena regresija) ──
zam('focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×5 — register R320) — LIVE"',
    'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×6 — register R321) — LIVE"', 1)
zam('# blok glave ×4 [dnevni R163 + JSON R316 + CSV R317 + PDF R318] — val8\n# register R318 (PIN SHIFT ×3 → ×4, obrnjena regresija) + r317-stil-val8',
    '# blok glave ×6 [dnevni R163 + JSON R316 + CSV R317 + audit PDF R318 +\n# končna PDF R320 + zmogljivost PDF R321] — val8 register R321 (PIN SHIFT\n# ×5 → ×6, obrnjena regresija) + r317-stil-val8', 1)

# ── 6. Izhodna stran ──
zam('=== R320 PROD QA — R290+…+R320 ŽIVO SKUPAJ ===',
    '=== R321 PROD QA — R290+…+R321 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r321-prod-qa.sh zapisan ({len(text)} znakov)')
