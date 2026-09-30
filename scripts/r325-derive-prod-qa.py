#!/usr/bin/env python3
# R325 — derive r325-prod-qa.sh iz r323-prod-qa.sh [VZPOREDNA runda — 51.
# člen CSV zmogljivost; kolizija #5 rešena po kanonu LEKCIJA 1 — moja runda
# preimenovana R323→R324, QA re-derivirana iz NJIHOVE generacije; podeduje
# njihove CSV needleje + verigo R322→…→R227]. VSAKA zamenjava je NATANKO
# ena-n-točkovna (fail-closed: napačno število POJAVITEV → izpisek + exit 1;
# LEKCIJA R312/…/R322: štetje na POJAVITVE; LEKCIJA R316: window val
# spremenljivka v Z2b sledi generaciji — __r322val → __r324val).
# KOZMETIKA NJIHOVE GENERACIJE (počiščena pri prehodu — precedens R322
# derive): "R322 meja"/"R322 commita"/"R322 commit meja" oznake [njihov
# derive jih je pustil], Z2 echo brez R323 bloka [dodan R324+R323], OPOMBA
# R290+…+R322 → R324.
# Transformacije:
#   1. Glava: R325 zapis PREDE njihovega R323 (dekompozicija FAZA 2)
#   2. EPOCH: R323_COMMIT_ISO/R323_PUSH → R324_*, awk '^R323 —' → '^R324 —',
#      guard R32[1] → R32[2], meja/deploy oznake + kozmetika
#   3. Generacijske poti: /tmp/r323- → /tmp/r325- (36) + __r322val →
#      __r324val (4)
#   4. R324 needle blok: splice PO njihovem TODO-R323 bloku (dekompozicija
#      premik-živ needleji ×6 + TODO-R324)
#   5. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r324-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r325-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: moj R325 zapis PREDE njihovega R323 ──
zam('# R323 — PRVA naloga (worklog R323): potrditi R290+…+R321+R322+R323 SKUPAJ na produ.',
    '# R325 — PRVA naloga (worklog R324): potrditi R290+…+R321+R322+R323+R324+R325 SKUPAJ na produ.\n'
    '#   🆕 R325 = PRIROJENIŠKA runda (dekompozicija FAZA 2 — vzorec R319\n'
    '#   faza 1 / R322 calculator faza 1; KOLIZIJA #5: vzporedna seja je\n'
    '#   vzela R323 [8857d6e, 51. člen CSV]; NI novi člen issue #1):\n'
    '#   DEKOMPOZICIJA FAZA 2 — measurements 7.604 → 7.153 [−451; laserski BT\n'
    '#   blok → laser-bt.ts + use-laser.ts hook (onMeasurement povratni klic)\n'
    '#   + laser-panel.tsx; template localStorage blok → templates.ts] +\n'
    '#   calculator 5.372 → 4.846 [−526; 5 PDF izvozov → pdf-exports.ts z\n'
    '#   args objekti]; r172 vrstični pin 7427 → 6976 (izrecen R325 komentar).\n'
    '#   🆕 R323 = 51. člen issue #1 (IZVOZI družina): izvoz meritev zmogljivosti')
# njihova druga vrstica glave (nadaljevanje R323 opisa) ostane — samo
# preimenuj oznako vrstice

# ── 2. EPOCH + guard + oznake + kozmetika ──
zam('R323_TABS', 'R325_TABS', 3)
zam('R323_COMMIT_ISO', 'R325_COMMIT_ISO', 3)
zam('R323_PUSH', 'R325_PUSH', 5)
zam("awk -F' ::: ' '$2 ~ /^R323 —/ {print $1; exit}'", "awk -F' ::: ' '$2 ~ /^R325 —/ {print $1; exit}'", 1)
zam('[ -n "$R325_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R322 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }',
    '[ -n "$R325_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R325 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }')
zam('echo "R322 meja (commit čas, UTC): $R325_PUSH"', 'echo "R325 meja (commit čas, UTC): $R325_PUSH"')
zam("grep -qE 'R32[1]_PUSH|R322[_]COMMIT_ISO' \"$0\"", "grep -qE 'R32[3]_PUSH|R324[_]COMMIT_ISO' \"$0\"")
zam('echo "FAIL-CLOSED: derive ostanki R322 PUSH/COMMIT meje v r323-prod-qa.sh — popravi pred tekom"',
    'echo "FAIL-CLOSED: derive ostanki R324 PUSH/COMMIT meje v r325-prod-qa.sh — popravi pred tekom"')
zam('echo "derive čistost: OK (nič R322 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)"',
    'echo "derive čistost: OK (nič R324 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)"')
zam('echo "=== Z0: prod build-guard — R323 deploy detekcija (EPOCH primerjava) ==="',
    'echo "=== Z0: prod build-guard — R325 deploy detekcija (EPOCH primerjava) ==="')
zam('R322 commit meja', 'R325 commit meja', 2)
zam('echo "R322 deploy potrjen (build $BUILD > R325 commit meja $R325_PUSH) — polni LIVE teki"',
    'echo "R325 deploy potrjen (build $BUILD > R325 commit meja $R325_PUSH) — polni LIVE teki"')
zam('echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R322 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R325 — kanon R280/R284)"')
zam('#   Z0  build-guard (EPOCH): health build > R322 commit čas (git log —',
    '#   Z0  build-guard (EPOCH): health build > R325 commit čas (git log —')
zam('#       R280/R284), polni LIVE needle teki (R322 dekomp ×4 + R321 PDF ×2 +',
    '#       R280/R284), polni LIVE needle teki (R325 dekomp ×6 + R324 dnevni PDF ×2 + R323 CSV ×2 +\n'
    '#       R322 dekomp ×4 + R321 PDF ×2 +')
zam('#   Z2  čanki needleji: R322 ×4+1 + R321 ×2+1 + R320 ×2+1 + R318 ×2+1 +',
    '#   Z2  čanki needleji: R325 ×6+1 + R324 ×2+1 + R323 ×2+1 + R322 ×4+1 + R321 ×2+1 +\n'
    '#       R320 ×2+1 + R318 ×2+1 +')

# ── 3. Generacijske poti + val spremenljivka ──
zam('/tmp/r323-', '/tmp/r325-', 36)
zam('__r322val', '__r324val', 4)

# ── 4. Needle blok: R324 splice PO njihovem R323 bloku ──
zam('must_miss "TODO-R323" "R323 — brez razvojnih ostankov"',
    'must_miss "TODO-R323" "R323 — brez razvojnih ostankov"\n'
    '\n'
    'echo "--- R325 MANDATORY — dekompozicija FAZA 2: premaknjena vsebina ŽIVA (LIVE) ---"\n'
    '# Dekompozicija FAZA 2 = refaktor internih sestavljenih struktur (kanon\n'
    '# R319/R322): telesa VERBATIM, closure dostop → args/props — needleji\n'
    '# dokazujejo, da NOV deploy ni izgubil premaknjene measurements/calculator\n'
    '# vsebine (regresijska zaščita premika; r324-build-needles ×9 brat\n'
    '# lokalno + measurements/calculator dispatch ŽE v harvestu — pokritost\n'
    '# needle pokritosti, LEKCIJA R314 1).\n'
    'need "0000feff-0000-1000-8000-00805f9b34fb" "R325 laser-bt.ts Leica UUID (premik živ) — LIVE"\n'
    'need "Poveži laserski daljinec preko Web Bluetooth" "R325 laser-panel.tsx tooltip (premik živ) — LIVE"\n'
    'need "Mera iz laserja: " "R325 use-laser.ts toast (premik živ) — LIVE"\n'
    'need "Standardni balkon 3m" "R325 templates.ts PREDLOGE (premik živ) — LIVE"\n'
    'need "ROKSAL — Razrezni list CNC" "R325 pdf-exports.ts CNC naslov (premik živ) — LIVE"\n'
    'need "ROKSAL — Steklena balustrada specifikacija" "R325 pdf-exports.ts steklo naslov (premik živ) — LIVE"\n'
    'must_miss "TODO-R325" "R325 — brez razvojnih ostankov"')

# ── 5. Z2 echo števec + izhodna oznaka ──
zam('echo "=== Z2: čanki — klient needleji (R322 ×4+1 + R321 ×2+1 + R320 ×2+1 + R318 ×2+1 +\nR317 ×3+1',
    'echo "=== Z2: čanki — klient needleji (R325 ×6+1 + R324 ×2+1 + R323 ×2+1 + R322 ×4+1 + R321 ×2+1 +\n'
    'R320 ×2+1 + R318 ×2+1 + R317 ×3+1')
zam('echo "=== R323 PROD QA — R290+…+R323 ŽIVO SKUPAJ ==="',
    'echo "=== R325 PROD QA — R290+…+R325 ŽIVO SKUPAJ ==="')

DOL.write_text(text, encoding='utf-8')
print(f'OK: r324-prod-qa.sh izpeljan ({len(text.splitlines())} vrstic)')
