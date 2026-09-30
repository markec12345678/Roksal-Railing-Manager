#!/usr/bin/env python3
# R297 — generira scripts/r297-prod-qa.sh iz r296-prod-qa.sh (ŽE s UNION
# harvest popravkom — deduje se samodejno):
#  1. EPOCH guard GIT-IZPELJAN: meja = čas R297 commita (prek git log grep —
#     self-contained, strožja meja: med commitom in pushom ni Vercel builda);
#  2. NOV R297 LIVE blok (Oprema CSV 27. člen ×10) PRED R296 blokom; R296
#     postane regresija (oznaka 'LIVE — regresija');
#  3. must_miss dobi TODO-R297 (must_miss veja ostaja samo za LIVE teki);
#  4. poti + probe ID-ji r296 → r297; ZERO-MUTACIJA veriga nespremenjena.
SRC = '/home/z/my-project/scripts/r296-prod-qa.sh'
DST = '/home/z/my-project/scripts/r297-prod-qa.sh'

s = open(SRC).read()

# --- poti + probe ID-ji ---
s = s.replace('/tmp/r296-', '/tmp/r297-')
s = s.replace('r296-ne-obstojeci-id-probe', 'r297-ne-obstojeci-id-probe')
s = s.replace('r296-prod-v99-probe', 'r297-prod-v99-probe')
s = s.replace("'r296 probe v99'", "'r297 probe v99'")

# --- EPOCH guard: meja = R297 commit ---
s = s.replace('R296_COMMIT_ISO', 'R297_COMMIT_ISO')
s = s.replace('R296_PUSH', 'R297_PUSH')
s = s.replace("$2 ~ /^R296 —/", "$2 ~ /^R297 —/")
s = s.replace('R296 commita ni v git zgodovini', 'R297 commita ni v git zgodovini')
s = s.replace('R296 meja (commit čas, UTC)', 'R297 meja (commit čas, UTC)')
s = s.replace('R296 deploy detekcija', 'R297 deploy detekcija')
s = s.replace('R296 commit meja', 'R297 commit meja')
s = s.replace('build $BUILD ≤ R296 commit meja', 'build $BUILD ≤ R297 commit meja')
s = s.replace('R296 deploy potrjen (build $BUILD > R297 commit meja', 'R297 deploy potrjen (build $BUILD > R297 commit meja')
s = s.replace('R295 (ŽIVO) + R296 pričakujeta SKUPNI deploy', 'R296 (ŽIVO) + R297 pričakujeta SKUPNI deploy')

# --- glava ---
s = s.replace(
    '# R296 — PRVA naloga (worklog R297): potrditi R290+R291+R292+R293+R294+R295+R296 SKUPAJ na produ.',
    '# R297 — PRVA naloga (worklog R298): potrditi R290+R291+R292+R293+R294+R295+R296+R297 SKUPAJ na produ.',
)
s = s.replace(
    '#       polni LIVE needle teki (R296 ICS ×11 + R295 koledar CSV + mini-vrstica ×9 + R294 ×9 + regresije).',
    '#       polni LIVE needle teki (R297 Oprema CSV ×10 + R296 ICS ×11 + R295 koledar CSV + mini-vrstica ×9 + R294 ×9 + regresije).',
)
s = s.replace(
    'R296 deploy potrjen (nosi R290+…+R296 — kanon R280/R284)',
    'R297 deploy potrjen (nosi R290+…+R297 — kanon R280/R284)',
)
s = s.replace(
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296+R297 — kanon R280/R284)"',
)
s = s.replace(
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296)."',
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296+R297)."',
)

# --- R297 LIVE blok (Oprema CSV 27. člen) pred R296 regresijskim blokom ---
OLD_R296_BLOCK = 'echo "--- R296 MANDATORY — KOLEDAR PREGLEDOV ICS (LIVE — PRVA naloga R297) ---"'
NEW_R297_BLOCK = '''echo "--- R297 MANDATORY — OPREMA CIKEL CSV (LIVE — PRVA naloga R298) ---"
need "Izvozi pregled življenjskega cikla opreme kot CSV" "R297 gumb aria — LIVE"
need "Življenjski cikl opreme kot CSV (isti stolpci kot PDF — za Excel/revizijo)" "R297 gumb title — LIVE"
need "opremaCikelCsvVrstice" "R297 lib EN VIR graditelj (čanek) — LIVE"
need "opremaCikelCsvFilename" "R297 ime datoteke (čanek) — LIVE"
need "prazen seznam opreme ne nastaja datoteke" "R297 lib fail-closed — LIVE"
need "Vsa oprema iz /api/equipment (polna resnica — tudi upokojena/izgubljena; NAZIV ASC referenčni red)" "R297 meta Obseg (čanek) — LIVE"
need "CSV se izvozi, ko je vpisan prvi kos opreme." "R297 fail-closed toast — LIVE"
need "Pregled opreme prenešen v CSV" "R297 uspeh toast (WYSIWYG) — LIVE"
need "Cikl videnega seznama opreme — polna resnica prihaja s FRESH fetch izvozom (PDF/CSV — VSA oprema)" "R297 stil F2 mini title — LIVE"
need "Merska oprema z kalibracijskim rokom, ki je že pretekel — akcija" "R297 stil kalibracija žig title — LIVE"
echo "--- R296 MANDATORY — KOLEDAR PREGLEDOV ICS (LIVE — regresija) ---"'''
assert OLD_R296_BLOCK in s, 'R296 LIVE blok oznaka ni najdena'
s = s.replace(OLD_R296_BLOCK, NEW_R297_BLOCK)

# --- must_miss: dodaj TODO-R297 pred TODO-R296 ---
OLD_MM = 'must_miss "TODO-R296" "R296 — brez razvojnih ostankov (izginil)"'
NEW_MM = 'must_miss "TODO-R297" "R297 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R296" "R296 — brez razvojnih ostankov (izginil)"'
assert OLD_MM in s, 'TODO-R296 must_miss ni najden'
s = s.replace(OLD_MM, NEW_MM)

# --- skupni sklep ---
s = s.replace(
    'echo "=== R296 PROD QA — R290+R291+R292+R293+R294+R295+R296 ŽIVO SKUPAJ ==="',
    'echo "=== R297 PROD QA — R290+R291+R292+R293+R294+R295+R296+R297 ŽIVO SKUPAJ ==="',
)

open(DST, 'w').write(s)
print('r297-prod-qa.sh zgeneriran:', len(s), 'znakov')
