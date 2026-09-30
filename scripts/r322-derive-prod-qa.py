#!/usr/bin/env python3
# R322 — derive r322-prod-qa.sh iz r321-prod-qa.sh (KOLIZIJA: vzporedna
# seja je vzela R321 — RE-DERIVACIJA iz njihove generacije; podeduje njihove
# 50. člen needleje + verigo R320→…→R227). VSAKA zamenjava je NATANKO
# ena-n-točkovna (fail-closed: napačno število POJAVITEV → izpisek + exit 1;
# LEKCIJA R312/…/R321: štetje na POJAVITVE, ne grep -c vrstice; LEKCIJA R316:
# window val spremenljivka v Z2b sledi generaciji — __r320val → __r321val).
# POZOR (kozmetika vzporedne runde, počiščena pri prehodu): R320_TABS ime,
# "R320 commita" v FAIL-CLOSED sporočilu, "R290+…+R320" OPOMBA, Z0 glava
# "R320 commit čas", zastareli "R308 boundary" derive-čistost echo — vsi
# premaknjeni na R322 generacijo.
# Transformacije:
#   1. Glava: R322 zapis (dekompozicija calculator faza 1 + R254 slepa pega)
#   2. EPOCH: R321_COMMIT_ISO/R321_PUSH → R322_*, awk '^R321 —' → '^R322 —',
#      guard R31[9] → R32[0], meja/deploy oznake
#   3. Generacijske poti: /tmp/r321- → /tmp/r322- (36) + stari val →
#      novi val (4)
#   4. R322 needle blok: splice PO R321 bloku (dekompozicija premik-živ
#      needleji ×4 + TODO-R322)
#   5. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r321-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r322-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R321 — PRVA naloga (worklog R321): potrditi R290+…+R318+R319+R320+R321 SKUPAJ na produ.\n#   🆕 R321 = 50. člen issue #1 (IZVOZI družina): izvoz meritev zmogljivosti\n#   kot DETERMINISTIČNI PDF (Deliverable 6 tisk; brat zaslona R312 — vzorec\n#   R318/R320: LOČEN lib; pregled = POSREDOVANA resnica — meritev se izvede\n#   ENKRAT v brskalniku, PDF NE meri znova; sklep = TRETJI potrošnik ENEGA\n#   niza; formatirajMs = EN VIR zaslon + PDF iz brata; fiksni formatni žig\n#   ZMOGLJIVOST_PDF_ZIG_FIKSNI + FNV soli 0xc9–0xcc). STIL val 10: dokazni\n#   bloki vrstični hover (transition-colors + amber/40 — 3 bloki enoten\n#   žeton; val8 amber ×5→×6 + val9 press-scale ×12→13 PIN SHIFTI).',
    '# R322 — PRVA naloga (worklog R322): potrditi R290+…+R321+R322 SKUPAJ na produ.\n'
    '#   🆕 R322 = PRIROJENIŠKA runda (dekompozicija — vzorec R319; KOLIZIJA:\n'
    '#   vzporedna seja je vzela R321 [43f3f7e]; NI novi člen issue #1):\n'
    '#   DEKOMPOZICIJA calculator-tab FAZA 1 — 6.074 → 5.372 vrstic [−702];\n'
    '#   NOV mapa calculator/ ×5 datotek/762 vrstic [shared.ts tipi+konstante\n'
    '#   VERBATIM + export; 4 SVG diagrami ČIST PREMIK bajtno identično].\n'
    '#   + R254 SLEPA PEGA ZAPRTA: vejica v uvoznem komentarju je skrila 8\n'
    '#   ikon detektorju — trojni popravek detektor+codemod+stražar [strip\n'
    '#   // PRED split] odkril 5 PRAVIH a11y vrzeli → popravljenih IN-PLACE\n'
    '#   [Bluetooth ×2 + Mic ×3 — r172 vrstični pin 7427 NEPREMAKNJEN].')
# kozmetika vzporedne runde (njihovi R320 ostanki) — počistim na R322
zam('#   Z0  build-guard (EPOCH): health build > R320 commit čas (git log —',
    '#   Z0  build-guard (EPOCH): health build > R322 commit čas (git log —')
# kozmetika vzporedne runde: vrstica 73 je IZPUSTILA njihovo R321 generacijo
# (piše R320+R318) — moja zamenjava jo DODA (iskrena veriga R322+R321+R320+…)
zam('#       R280/R284), polni LIVE needle teki (R320 PDF ×2 + R318 PDF ×2 +\n#       R317 CSV ×3 +',
    '#       R280/R284), polni LIVE needle teki (R322 dekomp ×4 + R321 PDF ×2 +\n'
    '#       R320 PDF ×2 + R318 PDF ×2 + R317 CSV ×3 +')
zam('#   Z2  čanki needleji: R321 ×2+1 + R320 ×2+1 + R318 ×2+1 + R317 ×3+1 +',
    '#   Z2  čanki needleji: R322 ×4+1 + R321 ×2+1 + R320 ×2+1 + R318 ×2+1 +\n'
    '#       R317 ×3+1 +')
zam("#   ('R31[9]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "#   ('R32[0]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).")

# ── 2. EPOCH + guard + oznake ──
# kozmetika: R320_TABS ime (vzporedna pustila) → R322_TABS
zam('R320_TABS', 'R322_TABS', 3)
zam('R321_COMMIT_ISO', 'R322_COMMIT_ISO', 3)
zam('R321_PUSH', 'R322_PUSH', 5)
zam("awk -F' ::: ' '$2 ~ /^R321 —/ {print $1; exit}'", "awk -F' ::: ' '$2 ~ /^R322 —/ {print $1; exit}'", 1)
zam('[ -n "$R322_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R320 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }',
    '[ -n "$R322_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R322 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }')
zam('echo "R320 meja (commit čas, UTC): $R322_PUSH"', 'echo "R322 meja (commit čas, UTC): $R322_PUSH"')
zam('R31[9]_PUSH|R320[_]COMMIT_ISO', 'R32[0]_PUSH|R321[_]COMMIT_ISO', 1)
zam('echo "FAIL-CLOSED: derive ostanki R320 PUSH/COMMIT meje v r321-prod-qa.sh — popravi pred tekom"',
    'echo "FAIL-CLOSED: derive ostanki R321 PUSH/COMMIT meje v r322-prod-qa.sh — popravi pred tekom"')
# kozmetika: zastareli R308 echo (vzporedna pustila) → iskren R321
zam('echo "derive čistost: OK (nič R308 boundary ostankov — razred znakov, brez samozadetka)"',
    'echo "derive čistost: OK (nič R321 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)"')
# kozmetika: Z0 detekcija oznaka (vzporedna pustila "R320 deploy detekcija")
zam('echo "=== Z0: prod build-guard — R320 deploy detekcija (EPOCH primerjava) ==="',
    'echo "=== Z0: prod build-guard — R322 deploy detekcija (EPOCH primerjava) ==="')
# kozmetika: "R320 commit meja" ×2 (vzporedna pustila) → R322
zam('R320 commit meja', 'R322 commit meja', 2)
zam('echo "R320 deploy potrjen (build $BUILD > R322 commit meja $R322_PUSH) — polni LIVE teki"',
    'echo "R322 deploy potrjen (build $BUILD > R322 commit meja $R322_PUSH) — polni LIVE teki"')
# kozmetika: OPOMBA R290+…+R320 (vzporedna pustila) → R322
zam('echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R320 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R322 — kanon R280/R284)"')

# ── 3. Generacijske poti + val spremenljivka ──
zam('/tmp/r321-', '/tmp/r322-', 36)
zam('__r320val', '__r321val', 4)

# ── 4. Needle blok: R322 splice PO R321 bloku ──
zam('must_miss "TODO-R321" "R321 — brez razvojnih ostankov"',
    'must_miss "TODO-R321" "R321 — brez razvojnih ostankov"\n'
    '\n'
    'echo "--- R322 MANDATORY — dekompozicija calculator faza 1: premaknjena vsebina ŽIVA (LIVE) ---"\n'
    '# Dekompozicija = čist premik (kanon R319 measurements faza 1): vsebina\n'
    '# bajtno identična, bivališče novo — needleji dokazujejo, da NOV deploy\n'
    '# ni izgubil premaknjene calculator vsebine (regresijska zaščita premika;\n'
    '# r322-build-needles ×5 brat lokalno + calculator dispatch v harvestu\n'
    '# od R315 — pokritost needle pokritosti, LEKCIJA R314 1).\n'
    'need "Steklo (float/kaljeno)" "R322 GlassLayersSvg legenda (premik živ) — LIVE"\n'
    'need "PVB folija (varnostna)" "R322 GlassLayersSvg PVB legenda (premik živ) — LIVE"\n'
    'need "Cona 1 — celina (22 m/s)" "R322 SloveniaWindMapSvg cona oznaka (premik živ) — LIVE"\n'
    'need "Hilti HIT-RE 500" "R322 shared.ts anchorTypeLabels (premik živ) — LIVE"\n'
    'must_miss "TODO-R322" "R322 — brez razvojnih ostankov"')

# ── 5. Z2 echo števec + izhodna oznaka ──
zam('echo "=== Z2: čanki — klient needleji (R321 ×2+1 + R320 ×2+1 + R318 ×2+1 + R317 ×3+1',
    'echo "=== Z2: čanki — klient needleji (R322 ×4+1 + R321 ×2+1 + R320 ×2+1 + R318 ×2+1 +\n'
    'R317 ×3+1')
zam('echo "=== R321 PROD QA — R290+…+R321 ŽIVO SKUPAJ ==="',
    'echo "=== R322 PROD QA — R290+…+R322 ŽIVO SKUPAJ ==="')

DOL.write_text(text, encoding='utf-8')
print(f'OK: r322-prod-qa.sh izpeljan ({len(text.splitlines())} vrstic)')
