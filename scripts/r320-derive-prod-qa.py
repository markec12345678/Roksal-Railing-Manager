#!/usr/bin/env python3
# R320 — derive r320-prod-qa.sh iz r318-prod-qa.sh (generacijski vzorec
# r305→…→r318). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed:
# napačno število POJAVITEV → izpisek + exit 1; LEKCIJA R312/R314/R315/R316/
# R317/R318: štetje na POJAVITVE, ne grep -c vrstice; LEKCIJA R316: window
# val spremenljivka v Z2b mora slediti generaciji — __r318val → __r319val).
# Transformacije:
#   1. Glava: R320 zapis (49. člen — izvoz končne verifikacije PDF + STIL
#      val 9 register 11→12)
#   2. EPOCH: R318_COMMIT_ISO/R318_PUSH → R320_*, awk '^R318 —' → '^R320 —',
#      guard R31[7] → R31[8], meja/deploy oznake
#   3. Generacijske poti: /tmp/r318- → /tmp/r320- (36) + stari val →
#      novi val (4)
#   4. R320 needle blok: splice PRED Z2b (PDF izvoz aria/title + TODO-R320)
#   5. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r318-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r320-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R318 — PRVA naloga (worklog R318): potrditi R290+…+R317+R318 SKUPAJ na produ.',
    '# R320 — PRVA naloga (worklog R320): potrditi R290+…+R318+R320 SKUPAJ na produ.\n'
    '#   🆕 R320 = 49. člen issue #1 (IZVOZI družina): izvoz poročila končne\n'
    '#   verifikacije kot DETERMINISTIČNI PDF (PDF brat JSON R316 — vzorec R318\n'
    '#   audit-pdf: LOČEN lib; EN VIR prek koncnaVerifikacija validacije; sklep\n'
    '#   = PETI potrošnik ENEGA niza; fiksni formatni žig KONCNA_PDF_ZIG_FIKSNI\n'
    '#   + FNV soli 0xc5–0xc8; brez časa v vsebini — isti HEAD = bajtno identičen\n'
    '#   PDF). STIL val 9 register 11→12 (končna PDF gumb press-scale ×6 —\n'
    '#   taktilna pariteta; val8 amber ×4→×5 — PIN SHIFT z obrnjeno regresijo).')
zam('#   Z0  build-guard (EPOCH): health build > R318 commit čas (git log —',
    '#   Z0  build-guard (EPOCH): health build > R320 commit čas (git log —')
zam('#       R280/R284), polni LIVE needle teki (R318 PDF ×2 + R317 CSV ×3 +',
    '#       R280/R284), polni LIVE needle teki (R320 PDF ×2 + R318 PDF ×2 +\n'
    '#       R317 CSV ×3 +')
zam('#   Z2  čanki needleji: R318 ×2+1 + R317 ×3+1 + R316 ×7+6 + R315 ×21+6 + R314 ×18+6 + R313 ×4+6 + R312 ×5+3 +',
    '#   Z2  čanki needleji: R320 ×2+1 + R318 ×2+1 + R317 ×3+1 + R316 ×7+6 + R315 ×21+6 + R314 ×18+6 + R313 ×4+6 + R312 ×5+3 +')
zam("#   ('R31[7]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "#   ('R31[8]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).")

# ── 2. EPOCH + guard + oznake ──
zam('R318_TABS', 'R320_TABS', 3)
zam('R318_COMMIT_ISO', 'R320_COMMIT_ISO', 3)
zam('R318_PUSH', 'R320_PUSH', 5)
zam("awk -F' ::: ' '$2 ~ /^R318 —/ {print $1; exit}'", "awk -F' ::: ' '$2 ~ /^R320 —/ {print $1; exit}'", 1)
zam('[ -n "$R320_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R318 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }',
    '[ -n "$R320_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R320 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }')
zam('echo "R318 meja (commit čas, UTC): $R320_PUSH"', 'echo "R320 meja (commit čas, UTC): $R320_PUSH"')
zam('R31[7]_PUSH|R317[_]COMMIT_ISO', 'R31[8]_PUSH|R318[_]COMMIT_ISO', 1)
zam('echo "FAIL-CLOSED: derive ostanki R317 PUSH/COMMIT meje v r318-prod-qa.sh — popravi pred tekom"',
    'echo "FAIL-CLOSED: derive ostanki R318 PUSH/COMMIT meje v r320-prod-qa.sh — popravi pred tekom"')
zam('R318 commit meja', 'R320 commit meja', 2)
zam('echo "R318 deploy potrjen (build $BUILD > R320 commit meja $R320_PUSH) — polni LIVE teki"',
    'echo "R320 deploy potrjen (build $BUILD > R320 commit meja $R320_PUSH) — polni LIVE teki"')
zam('echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R318 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R320 — kanon R280/R284)"')

# ── 3. Generacijske poti + val spremenljivka ──
zam('/tmp/r318-', '/tmp/r320-', 36)
zam('__r318val', '__r319val', 4)

# ── 4. Needle blok: R318 labela + R320 splice PRED Z2b ──
zam('need "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×4 — register R318) — LIVE"',
    'need "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×5 — register R320) — LIVE"')
zam('must_miss "TODO-R318" "R318 — brez razvojnih ostankov"',
    'must_miss "TODO-R318" "R318 — brez razvojnih ostankov"\n'
    '\n'
    'echo "--- R320 MANDATORY — 49. člen: izvoz poročila končne verifikacije (PDF) (LIVE) ---"\n'
    '# IZVOZI družina: PDF gumb v končna-verifikacija bloku (vodja chunk) —\n'
    '# deterministični PDF izvoz (EN VIR — buildKoncnaVerifikacijaPdfDoc prek\n'
    '# koncnaVerifikacija validacije; LOČEN lib po vzorcu R318; vitest\n'
    '# r320-koncna-verifikacija-pdf ×9; E2E Z0aq DETERMINIZEM ŽIVO NA BAJTIH:\n'
    '# dva izvoza bajtno enaka + %PDF- magija). STIL val 9 register 11→12:\n'
    '# končna PDF gumb press-scale ×6 (taktilna pariteta — r318-stil-val9\n'
    '# register R320; utility klas = build-nivo SAMO — LEKCIJA R316 signature).\n'
    'need "Izvozi poročilo končne verifikacije kot PDF" "R320 PDF izvoz gumb aria (vodja chunk) — LIVE"\n'
    'need "kot deterministični PDF" "R320 PDF izvoz title fragment (vodja chunk) — LIVE"\n'
    'must_miss "TODO-R320" "R320 — brez razvojnih ostankov"')

# ── 5. Z2 echo števec + izhodna oznaka ──
zam('echo "=== Z2: čanki — klient needleji (R318 ×2+1 + R317 ×3+1',
    'echo "=== Z2: čanki — klient needleji (R320 ×2+1 + R318 ×2+1 + R317 ×3+1')
zam('echo "=== R318 PROD QA — R290+…+R318 ŽIVO SKUPAJ ==="',
    'echo "=== R320 PROD QA — R290+…+R320 ŽIVO SKUPAJ ==="')

DOL.write_text(text, encoding='utf-8')
print(f'OK: r320-prod-qa.sh izpeljan ({len(text.splitlines())} vrstic)')
