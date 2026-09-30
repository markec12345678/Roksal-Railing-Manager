#!/usr/bin/env python3
# R318 — derive r318-prod-qa.sh iz r317-prod-qa.sh (generacijski vzorec
# r305→…→r317). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed:
# napačno število POJAVITEV → izpisek + exit 1; LEKCIJA R312/R314/R315/R316/
# R317: štetje na POJAVITVE, ne grep -c vrstice; LEKCIJA R316: window val
# spremenljivka v Z2b mora slediti generaciji — __r317val → __r318val).
# Transformacije:
#   1. Glava: R318 zapis (48. člen — izvoz avtomatizacijskega audita PDF +
#      STIL val 9 press-scale taktilna pariteta vodja izvozne družine)
#   2. EPOCH: R317_COMMIT_ISO/R317_PUSH → R318_*, awk '^R317 —' → '^R318 —',
#      guard R31[6] → R31[7], meja/deploy oznake
#   3. Generacijske poti: /tmp/r317- → /tmp/r318- (36) + stari val →
#      novi val (4)
#   4. R318 needle blok: splice PRED Z2b (PDF izvoz aria/title + TODO-R318;
#      STIL val 9 press-scale = BUILD/TEST nivo — r318-stil-val9 STRAŽAR,
#      press-scale utility klas NOSI čank vendar je needle preozek za
#      live harvest — LEKCIJA R316 signature: build-nivo SAMO)
#   5. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r317-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r318-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R317 — PRVA naloga (worklog R317): potrditi R290+…+R316+R317 SKUPAJ na produ.',
    '# R318 — PRVA naloga (worklog R318): potrditi R290+…+R317+R318 SKUPAJ na produ.\n'
    '#   🆕 R318 = 48. člen issue #1 (IZVOZI družina): izvoz avtomatizacijskega\n'
    '#   audita kot DETERMINISTIČNI PDF (PDF brat CSV R317 — vzorec R302; EN VIR\n'
    '#   prek avtomatizacijaPregled validacije; AUDIT_CSV_GLAVE + AUDIT_VIR_NIZ\n'
    '#   UVOŽENA iz CSV brata — PDF in CSV ne moreta divergirati po konstrukciji;\n'
    '#   brez časa v vsebini — isti HEAD = bajtno identičen PDF, kanon 46./47.\n'
    '#   člen; soli 0xc1–0xc4). STIL val 9: press-scale mikrointerakcija ×5 na\n'
    '#   vodja izvoznih gumbov (taktilna pariteta s pill bratje R258/R261/R293 —\n'
    '#   r318-stil-val9 STRAŽAR; register val8 amber ×3 → ×4 PDF gumb).')
zam('#   Z0  build-guard (EPOCH): health build > R317 commit čas (git log —',
    '#   Z0  build-guard (EPOCH): health build > R318 commit čas (git log —')
zam('#       R280/R284), polni LIVE needle teki (R317 izvoz audit CSV ×3 +',
    '#       R280/R284), polni LIVE needle teki (R318 PDF ×2 + R317 CSV ×3 +')
zam('#   Z2  čanki needleji: R317 ×3+1 + R316 ×7+6 + R315 ×21+6 + R314 ×18+6 + R313 ×4+6 + R312 ×5+3 +',
    '#   Z2  čanki needleji: R318 ×2+1 + R317 ×3+1 + R316 ×7+6 + R315 ×21+6 + R314 ×18+6 + R313 ×4+6 + R312 ×5+3 +')
zam("#   ('R31[6]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "#   ('R31[7]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).")

# ── 2. EPOCH + guard + oznake ──
zam('R317_TABS', 'R318_TABS', 3)
zam('R317_COMMIT_ISO', 'R318_COMMIT_ISO', 3)
zam('R317_PUSH', 'R318_PUSH', 5)
zam("awk -F' ::: ' '$2 ~ /^R317 —/ {print $1; exit}'", "awk -F' ::: ' '$2 ~ /^R318 —/ {print $1; exit}'", 1)
zam('[ -n "$R318_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R317 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }',
    '[ -n "$R318_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R318 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }')
zam('echo "R317 meja (commit čas, UTC): $R318_PUSH"', 'echo "R318 meja (commit čas, UTC): $R318_PUSH"')
zam('R31[6]_PUSH|R316[_]COMMIT_ISO', 'R31[7]_PUSH|R317[_]COMMIT_ISO', 1)
zam('echo "FAIL-CLOSED: derive ostanki R316 PUSH/COMMIT meje v r317-prod-qa.sh — popravi pred tekom"',
    'echo "FAIL-CLOSED: derive ostanki R317 PUSH/COMMIT meje v r318-prod-qa.sh — popravi pred tekom"')
zam('R317 commit meja', 'R318 commit meja', 2)
zam('echo "R317 deploy potrjen (build $BUILD > R318 commit meja $R318_PUSH) — polni LIVE teki"',
    'echo "R318 deploy potrjen (build $BUILD > R318 commit meja $R318_PUSH) — polni LIVE teki"')
zam('echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R317 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R318 — kanon R280/R284)"')

# ── 3. Generacijske poti + val spremenljivka ──
zam('/tmp/r317-', '/tmp/r318-', 36)
zam('__r317val', '__r318val', 4)

# ── 4. Needle bloki: R317 labela ×3 → ×4 (register R318) + R318 splice PRED Z2b ──
zam('# avtomatizacijaPregled validacije; vitest r317-avtomatizacija-audit-csv +',
    '# avtomatizacijaPregled validacije; vitest r317-avtomatizacija-audit-csv +')
zam('# E2E Z0ao DETERMINIZEM: dva izvoza bajtno enaka). STIL val 8: IZRECNI',
    '# E2E Z0ao DETERMINIZEM: dva izvoza bajtno enaka). STIL val 8: IZRECNI')
zam('# blok glave ×3 [dnevni R163 + JSON R316 + CSV R317] — r317-stil-val8',
    '# blok glave ×4 [dnevni R163 + JSON R316 + CSV R317 + PDF R318] — val8\n'
    '# register R318 (PIN SHIFT ×3 → ×4, obrnjena regresija) + r317-stil-val8')
zam('need "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×3) — LIVE"',
    'need "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×4 — register R318) — LIVE"')
zam('must_miss "TODO-R317" "R317 — brez razvojnih ostankov"',
    'must_miss "TODO-R317" "R317 — brez razvojnih ostankov"\n'
    '\n'
    'echo "--- R318 MANDATORY — 48. člen: izvoz avtomatizacijskega audita (PDF) + STIL val 9 (LIVE) ---"\n'
    '# IZVOZI družina: PDF gumb v avtomatizacija-dokaz bloku (vodja chunk) —\n'
    '# deterministični PDF izvoz (EN VIR — buildAvtomatizacijaAuditPdfDoc prek\n'
    '# avtomatizacijaPregled validacije; AUDIT_CSV_GLAVE + AUDIT_VIR_NIZ uvožena\n'
    '# iz CSV brata — WYSIWYG po konstrukciji; vitest r318-avtomatizacija-audit-pdf\n'
    '# ×9; E2E Z0ap DETERMINIZEM ŽIVO: dva izvoza bajtno enaka + %PDF- magija).\n'
    '# STIL val 9: press-scale mikrointerakcija ×5 vodja izvoznih gumbov —\n'
    '# taktilna pariteta s pill bratje (R258/R261/R293) — r318-stil-val9\n'
    '# STRAŽAR ×4 (utility klas je preozek za edinstven live needle — LEKCIJA\n'
    '# R316 signature: build-nivo SAMO, avtoritativni dokaz r318-build-needles).\n'
    'need "Izvozi avtomatizacijski audit kot PDF" "R318 PDF izvoz gumb aria (vodja chunk) — LIVE"\n'
    'need "kot deterministični PDF" "R318 PDF izvoz title fragment (vodja chunk) — LIVE"\n'
    'must_miss "TODO-R318" "R318 — brez razvojnih ostankov"')

# ── 5. Z2 echo števec + izhodna oznaka ──
zam('echo "=== Z2: čanki — klient needleji (R317 ×3+1 + R316 ×7+5',
    'echo "=== Z2: čanki — klient needleji (R318 ×2+1 + R317 ×3+1 + R316 ×7+5')
zam('echo "=== R317 PROD QA — R290+…+R317 ŽIVO SKUPAJ ==="',
    'echo "=== R318 PROD QA — R290+…+R318 ŽIVO SKUPAJ ==="')

DOL.write_text(text, encoding='utf-8')
print(f'OK: r318-prod-qa.sh izpeljan ({len(text.splitlines())} vrstic)')
