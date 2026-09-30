#!/usr/bin/env python3
# R324 — derive r324-prod-qa.sh iz r323 generacije (kanon LEKCIJA 1: QA
# družina sledi generaciji). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed; LEKCIJA R312: štetje na POJAVITVE). Transformacije:
#   1. Glava: R324 zapis (52. člen dnevni PDF + STIL val 12)
#   2. EPOCH: R323_COMMIT_ISO/R323_PUSH → R324_*, awk '^R323 —' → '^R324 —',
#      guard 'R32[2]_PUSH|R323[_]COMMIT_ISO' → 'R32[3]_PUSH|R324[_]COMMIT_ISO'
#   3. Generacijske poti: /tmp/r323- (36) → /tmp/r324- + __r322val (4) →
#      __r323val + R323_TABS → R324_TABS
#   4. R324 needle blok: splice PO R323 (dnevni PDF aria + title fragment +
#      TODO-R324)
#   5. val8 labela ×7 → ×8 (register R324; obrnjena regresija — precedens
#      R323 derive)
#   6. UNION lista + stale sporočilo + footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r323-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r324-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R323 — PRVA naloga (worklog R323): potrditi R290+…+R321+R322+R323 SKUPAJ na produ.',
    '# R324 — PRVA naloga (worklog R324): potrditi R290+…+R321+R322+R323+R324 SKUPAJ na produ.', 1)
zam('#   ×6→×7 + val9 press-scale ×13→14 PIN SHIFTI).',
    '#   ×6→×7 + val9 press-scale ×13→14 PIN SHIFTI).\n'
    '#   🆕 R324 = 52. člen issue #1 (IZVOZI družina): izvoz DNEVNEGA pregleda\n'
    '#   vodje kot DETERMINISTIČNI PDF (PDF brat CSV R163 — vzorec R318/R320/\n'
    '#   R321; NOV lib vodja-dnevni-pdf; komponentni EN VIR vhod vodjaIzvozVhod\n'
    '#   — ENA preslikava, DVA potrošnika; EN VIR kontrakt R324 v bratu R163:\n'
    '#   glave VODJA_KPI_GLAVE + VODJA_TERMINI_GLAVE + validacija\n'
    '#   preveriVodjaIzvozVhod [sporočila VERBATIM, kje = graditelj] +\n'
    '#   vodjaKpiVrstice + VODJA_VIR_NIZ — CSV arhivska oblika ostaje BAJTNO\n'
    '#   nespremenjena; FNV soli 0xcd–0xd0). STIL val 12: današnji termini\n'
    '#   dvonivojski odziv (blok amber/30 + vrstica amber/40 na novi površini;\n'
    '#   PIN SHIFTI ×3: val8 ×7→×8, val9 ×14→15, val10/val11 registra ×3→×4).', 1)

# ── 2. EPOCH ──
zam('R322 commit meja ($R323_PUSH)', 'R323 commit meja ($R324_PUSH)', 1)
zam('R323_COMMIT_ISO', 'R324_COMMIT_ISO', 3)
zam('R323_PUSH', 'R324_PUSH', 4)  # ×4 PO stale-zamenjavi (ena pojavitev je že bila del 'R322 commit meja' zamene — LEKCIJA R312)
zam("$2 ~ /^R323 —/", "$2 ~ /^R324 —/", 1)
zam('R323_TABS', 'R324_TABS', 3)
zam("R32[1]_PUSH|R322[_]COMMIT_ISO", "R32[2]_PUSH|R323[_]COMMIT_ISO", 1)
zam("('R32[1]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R32[2]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R322 PUSH/COMMIT meje v r323-prod-qa.sh',
    'derive ostanki R323 PUSH/COMMIT meje v r324-prod-qa.sh', 1)
zam('derive čistost: OK (nič R322 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)',
    'derive čistost: OK (nič R323 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)', 1)
zam('=== Z0: prod build-guard — R323 deploy detekcija (EPOCH primerjava) ===',
    '=== Z0: prod build-guard — R324 deploy detekcija (EPOCH primerjava) ===', 1)
zam('██ R318+R319+R320+R321+R322+R323 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    '██ R318+R319+R320+R321+R322+R323+R324 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest', 1)

# ── 3. Generacijske poti ──
zam('/tmp/r323-', '/tmp/r324-', 36)
zam('__r322val', '__r323val', 4)

# ── 4. R324 needle blok (splice PO R323 bloku, PRED Z2b) ──
R324_BLOK = '''
echo "--- R324 MANDATORY — 52. člen: izvoz dnevnega pregleda vodje (PDF) + STIL val 12 (LIVE) ---"
# IZVOZI družina: "Dnevni PDF" gumb v glavi "Pregled za vodjo" (vodja chunk)
# — deterministični PDF izvoz (vhod = POSREDOVANA resnica prek vodjaIzvozVhod
# — ENA preslikava, DVA potrošnika; EN VIR kontrakt R324 v bratu R163 —
# glave + validacija + vodjaKpiVrstice + Vir niz; PDF lib LOČEN, NO jsPDF v
# vodja-csv; FNV soli 0xcd–0xd0; vitest r324-vodja-dnevni-pdf ×14; E2E Z0at
# DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza bajtno enaka + %PDF- magija).
# STIL val 12: današnji termini dvonivojski odziv (blok amber/30 + vrstica
# amber/40 — registri ×4/×4; utility klas = build-nivo SAMO — LEKCIJA R316
# signature).
need "Izvozi dnevni pregled vodje kot PDF" "R324 dnevni PDF izvoz gumb aria (vodja chunk) — LIVE"
need "kot deterministični PDF" "R324 dnevni PDF izvoz title fragment (vodja chunk) — LIVE"
must_miss "TODO-R324" "R324 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R323" "R323 — brez razvojnih ostankov"\n\necho "=== Z2b:',
    'must_miss "TODO-R323" "R323 — brez razvojnih ostankov"\n' + R324_BLOK + 'echo "=== Z2b:', 1)

# ── 5. val8 labela ×7 → ×8 (register R324; obrnjena regresija) ──
zam('focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×7 — register R323) — LIVE"',
    'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×8 — register R324) — LIVE"', 1)
zam('# blok glave ×7 [dnevni', '# blok glave ×8 [dnevni', 1)

# ── 6. Footer ──
zam('=== R323 PROD QA — R290+…+R323 ŽIVO SKUPAJ ===',
    '=== R324 PROD QA — R290+…+R324 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r324-prod-qa.sh zapisan ({len(text)} znakov)')
