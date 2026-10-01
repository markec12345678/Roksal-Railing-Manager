#!/usr/bin/env python3
# R338 — derive r338-prod-qa.sh iz NJIHOVE r337 generacije (KOLIZIJA #12
# [12. potrditev]: vzporedna cron seja je vzela številko R337 — commit
# 1a3e776, 64. člen AI raba pregled CSV + NJIHOVI scripts/r337-* skripti
# zabetonirani v git; po kanonu LEKCIJA 1: NJIHOVI r337-* OSTAJOJO, moji
# artefakti se re-derivirajo kot r338-* IZ NJIHOVE r337 generacije).
# VSAKA zamenjava je NATANKO n-točkovna (fail-closed; LEKCIJA R312: štetje
# na POJAVITVE — text.count NE grep -c; LEKCIJA R328: meja-zamenjave
# izvedi PRVE ker spreminjajo števec splošne zamenjave; LEKCIJA R332 6:
# guard razred = (N−2)_PUSH|(N−1)[_]COMMIT_ISO — za R338 =
# 'R33[6]_PUSH|R337[_]COMMIT_ISO').
# Pojavitveni števci PREJ (python3 text.count na VIR-u r337-prod-qa.sh):
#   - naslovna vrstica: STALE '# R336 — PRVA naloga (worklog R336): …
#     +R335+R336 SKUPAJ na produ.' (NJIHOVA r337 derive je naslovne
#     vrstice NE posodobila — DEVIACIJA; popravljen DIREKTNO R336→R338 +
#     veriga +R337+R338) + 🆕 R336 prva vrstica: ×1
#   - 'R337 commit meja ($R337_PUSH)': ×1 | 'R337 deploy potrjen (build
#     $BUILD > R337 commit meja $R337_PUSH)': ×1 (meja-zamenjavi PRVE)
#   - 'R337_COMMIT_ISO': ×3 (def + guard + date -d)
#   - 'R337_PUSH': ×5 skupno → ×3 PO mejah (def + meja echo + python argv)
#   - 'R337 meja (commit čas, UTC): $R337_PUSH': ×1
#   - 'R337 commita ni v git zgodovini': ×1
#   - '$2 ~ /^R337 —/': ×1 | 'R337_TABS': ×3
#   - guard 'R336[_]COMMIT_ISO|R336[_]PUSH|R336[_]TABS': ×1 (NJIHOV
#     tri-žetonski format — DEVIACIJA od kanona, enak vzorec kot NJIHOVA
#     r335/r336 [takrat 'R335[_]…'/'R336[_]…'] → LEKCIJA R332 6 kanon
#     format)
#   - "('R335[_]PUSH') — preverba ne sme ujeti svojega vzorca
#     (samozadetek).": ×1 (STALE R335 komentar — usklajen z novim guardom)
#   - 'derive ostanki R336 PUSH/COMMIT/TABS meje v r337-prod-qa.sh': ×1 |
#     'nič R336 PUSH/COMMIT/TABS ostankov': ×1
#   - 'R334 deploy detekcija' (Z0 banner — STALE v NJIHOVEM r337, njihova
#     derive ga je izpustila ŽE od r335 naprej): ×1
#   - 'R335+R336+R337 pričakujejo SKUPNI deploy': ×1 (UNION vrstica v
#     ESKALACIJI)
#   - 'OPOMBA: deploy je nosil VSE generacije (R290+…+R335 — kanon
#     R280/R284)': ×1 (STALE R335 — NJIHOVA r337 derive je OPOMBO
#     pozabila posodobit; popravljen direktno R335→R338)
#   - '██ R337 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:': ×1
#   - '/tmp/r337-': ×36 | '__r336val': ×4
#   - 'must_miss "TODO-R337" "R337 — brez razvojnih ostankov"'+LF: ×1
#   - '=== R337 PROD QA — R290+…+R337 ŽIVO SKUPAJ ===': ×1
#   - val8 labela: NJIHOVA R337 stanje (amber/50 register ×11, val8 drevo
#     70, val9 taktilni ×18) — NEPREMIKNJENA
# Transformacije:
#   1. Glava: [stale R336 naslovna → R338 + veriga +R337+R338] + R338
#      dekompozicija zapis PO naslovni vrstici, PRED NJIHOVIM 🆕 R336
#      zapisom (NJIHOV 🆕 R336 zapis VERBATIM — dedovina; NJIHOV R337
#      needle blok v Z2 ostaja kot 64. člen dedovina dokaz)
#   2. EPOCH: meja-zamenjave PRVE ×2, R337_COMMIT_ISO/R337_PUSH → R338_*,
#      awk '^R337 —' → '^R338 —', R337_TABS → R338_TABS, meja/commita
#      labeli, guard → R33[6]_PUSH|R337[_]COMMIT_ISO (LEKCIJA R332 6)
#   3. Bannerji: Z0 [stale R334 — direktno na R338] + UNION deploy vrstica
#      +R338 + OPOMBA [stale R335 — direktno na R338] + ESKALACIJA žig
#   4. Generacijske poti: /tmp/r337- (36) → /tmp/r338- + __r336val (4) →
#      __r337val
#   5. R338 needle blok: splice PO NJIHOVEM R337 bloku (3 premik needleja
#      + TODO-R338)
#   6. val8 labela: NEPREMIKNJENA (NJIHOVA R337: AI raba pill JE v vodja
#      datoteki [amber/50 ×11 register, val8 drevo 70] — dekompozicija NE
#      dodaja gumbov, NE shiftaj!)
#   7. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r337-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r338-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (STALE naslovna R336 → R338 [DEVIACIJA: NJIHOVA r337 derive
#    naslovne vrstice ni posodobila — direktno R336→R338 + veriga
#    +R337+R338] + 🆕 R338 dekompozicija zapis PO njej; NJIHOV 🆕 R336
#    zapis VERBATIM naprej) ──
zam('# R336 — PRVA naloga (worklog R336): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334+R335+R336 SKUPAJ na produ.\n#   🆕 R336 = 63. člen issue #1 (IZVOZI družina — SISTEM ZDRAVJE CSV):',
'''# R338 — PRVA naloga (worklog R338): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334+R335+R336+R337+R338 SKUPAJ na produ.
#   🆕 R338 = DEKOMPOZICIJA measurements-tab FAZA 3 (regression-only runda —
#   PRIROJENIŠKA, vzorec R322/R325; KOLIZIJA #12: rename R337→R338 +
#   re-derivacija iz NJIHOVE r337 generacije): measurements-tab.tsx
#   7.153 → 6.809 vrstic — NOVA mapa measurements/ ×2: labels.ts (202
#   vrstic — GroundType + AuditEntry + 17 Record zbirk oznak/barv/ikon
#   VERBATIM) + format.ts (217 vrstic — ArMetadata + 13 čistih
#   parse/format funkcij VERBATIM) — ČIST PREMIK bajtno identično
#   (verify_r338.py NULPREMIK dokaz; ekstrakcija fail-closed ~70 asercij
#   mej PRED spremembo); osiroteli ikonski uvozi odstranjeni
#   (Gauge/Triangle/Mountain/RefreshCw/CornerDownRight); PIN SHIFTI ×6
#   (r172 6976→6632 + r316-stil-val7 register [2 amber → labels/format,
#   skupno NATANKO 30] + r311-ai-raba [isti premik, skupno NATANKO 6] +
#   r231/r234/r235 → labels.ts); NOV Z-blok NI dodan (vzorec R322 — iskren
#   razlog: premik bajtno identične vsebine nima nove žive interakcije;
#   pokritost = needle blok spodaj [3 premik needlejev] + r338-build-needles
#   [8 premik needlejev ŽIVIH v čankih] + polne E2E regresije; NJIHOV R337
#   64. člen [AI raba pregled CSV] needle blok ostaja v verigi — DEDOVINA).
#   🆕 R336 = 63. člen issue #1 (IZVOZI družina — SISTEM ZDRAVJE CSV):''', 1)

# ── 2. EPOCH (meja-zamenjave PRVE — LEKCIJA R328: števec PO meja) ──
zam('R337 commit meja ($R337_PUSH)', 'R338 commit meja ($R338_PUSH)', 1)
zam('R337 deploy potrjen (build $BUILD > R337 commit meja $R337_PUSH)', 'R338 deploy potrjen (build $BUILD > R338 commit meja $R338_PUSH)', 1)
zam('R337_COMMIT_ISO', 'R338_COMMIT_ISO', 3)
zam('R337_PUSH', 'R338_PUSH', 3)  # ×3 PO meja-zamenjavah ×2 (LEKCIJA R312: zaporedne zamenjave spreminjajo števec)
zam('R337 meja (commit čas, UTC): $R338_PUSH', 'R338 meja (commit čas, UTC): $R338_PUSH', 1)  # meja echo labela (zam PO splošnem PUSH zamu — ne pusti stale R337)
zam('R337 commita ni v git zgodovini', 'R338 commita ni v git zgodovini', 1)
zam("$2 ~ /^R337 —/", "$2 ~ /^R338 —/", 1)
zam('R337_TABS', 'R338_TABS', 3)

# ── 2b. Guard razred znakov (LEKCIJA R332 6: (N−2)_PUSH|(N−1)[_]COMMIT_ISO;
#    NJIHOV tri-žetonski format 'R336[_]COMMIT_ISO|R336[_]PUSH|R336[_]TABS'
#    → kanon format za R338) ──
zam("R336[_]COMMIT_ISO|R336[_]PUSH|R336[_]TABS", "R33[6]_PUSH|R337[_]COMMIT_ISO", 1)
zam("('R335[_]PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "('R33[6]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).", 1)
zam('derive ostanki R336 PUSH/COMMIT/TABS meje v r337-prod-qa.sh',
    'derive ostanki R336 PUSH/COMMIT meje v r338-prod-qa.sh', 1)
zam('nič R336 PUSH/COMMIT/TABS ostankov', 'nič R336 PUSH/COMMIT ostankov', 1)

# ── 3. Bannerji (Z0 — stale R334 v NJIHOVEM r337 [njihova derive izpust ŽE
#    od r335], popravljen DIREKTNO R334→R338; UNION vrstica +R338; OPOMBA —
#    stale R335, direktno R335→R338; ESKALACIJA žig) ──
zam('R334 deploy detekcija', 'R338 deploy detekcija', 1)
zam('R335+R336+R337 pričakujejo SKUPNI deploy', 'R335+R336+R337+R338 pričakujejo SKUPNI deploy', 1)
zam('OPOMBA: deploy je nosil VSE generacije (R290+…+R335 — kanon R280/R284)',
    'OPOMBA: deploy je nosil VSE generacije (R290+…+R338 — kanon R280/R284)', 1)
zam('██ R337 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:',
    '██ R338 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:', 1)

# ── 4. Generacijske poti ──
zam('/tmp/r337-', '/tmp/r338-', 36)
zam('__r336val', '__r337val', 4)

# ── 5. R338 needle blok (splice PO NJIHOVEM R337 bloku) ──
R338_BLOK = '''
echo "--- R338 MANDATORY — dekompozicija measurements-tab FAZA 3: premaknjena vsebina ŽIVA (LIVE) ---"
# Dekompozicija FAZA 3 = ČIST PREMIK (kanon R319/R322/R325): telesa
# VERBATIM, edina sprememba export predpona — needleji dokazujejo, da NOV
# deploy ni izgubil premaknjene measurements vsebine (regresijska zaščita
# premika; r338-build-needles ×8 brat lokalno + measurements dispatch ŽE v
# harvestu — pokritost needle pokritosti, LEKCIJA R314 1).
need "Lesena podlaga" "R338 labels.ts groundTypeLabels (premik živ) — LIVE"
need "WPC pokončne palice" "R338 labels.ts segmentTypeLabels (premik živ) — LIVE"
need "roksal_primary_unit" "R338 format.ts loadPrimaryUnit ključ (premik živ) — LIVE"
must_miss "TODO-R338" "R338 — brez razvojnih ostankov"

'''
zam('must_miss "TODO-R337" "R337 — brez razvojnih ostankov"\n',
    'must_miss "TODO-R337" "R337 — brez razvojnih ostankov"\n' + R338_BLOK, 1)

# ── 6. val8 labela: NEPREMIKNJENA (NJIHOVA R337: AI raba pill JE v vodja
#    datoteki — amber/50 register ×11, val8 drevo 70, val9 taktilni ×18;
#    dekompozicija NE dodaja gumbov, NE shiftaj; preverba = vitest
#    r317-stil-val8 — prod-qa NE ponavlja vitest pravil, LEKCIJA R316) ──

# ── 7. Footer ──
zam('=== R337 PROD QA — R290+…+R337 ŽIVO SKUPAJ ===',
    '=== R338 PROD QA — R290+…+R338 ŽIVO SKUPAJ ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r338-prod-qa.sh zapisan ({len(text)} znakov)')
