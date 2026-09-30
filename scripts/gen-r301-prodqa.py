#!/usr/bin/env python3
# R301 — generira scripts/r301-prod-qa.sh iz r300-prod-qa.sh (UNION harvest
# + EPOCH git-izpeljan guard dedovana):
#  1. EPOCH guard GIT-IZPELJAN: meja = čas R301 commita (prek git log grep —
#     self-contained);
#  2. NOV R301 LIVE blok (Konflikti CSV 31. člen ×11) PRED R300 blokom; R300
#     postane regresija (oznaka 'LIVE — regresija');
#  3. must_miss dobi TODO-R301 (must_miss veja ostaja samo za LIVE teki);
#  4. poti + probe ID-ji r300 → r301; ZERO-MUTACIJA veriga nespremenjena.
SRC = '/home/z/my-project/scripts/r300-prod-qa.sh'
DST = '/home/z/my-project/scripts/r301-prod-qa.sh'

s = open(SRC).read()

# --- poti + probe ID-ji ---
s = s.replace('/tmp/r300-', '/tmp/r301-')
s = s.replace('r300-ne-obstojeci-id-probe', 'r301-ne-obstojeci-id-probe')
s = s.replace('r300-prod-v99-probe', 'r301-prod-v99-probe')
s = s.replace("'r300 probe v99'", "'r301 probe v99'")

# --- EPOCH guard: meja = R301 commit ---
s = s.replace('R300_COMMIT_ISO', 'R301_COMMIT_ISO')
s = s.replace('R300_PUSH', 'R301_PUSH')
s = s.replace("$2 ~ /^R300 —/", "$2 ~ /^R301 —/")
s = s.replace('R300 commita ni v git zgodovini', 'R301 commita ni v git zgodovini')
s = s.replace('R300 meja (commit čas, UTC)', 'R301 meja (commit čas, UTC)')
s = s.replace('R300 deploy detekcija', 'R301 deploy detekcija')
s = s.replace('R300 commit meja', 'R301 commit meja')
s = s.replace('build $BUILD ≤ R300 commit meja', 'build $BUILD ≤ R301 commit meja')
s = s.replace('R300 deploy potrjen (build $BUILD > R301 commit meja', 'R301 deploy potrjen (build $BUILD > R301 commit meja')
s = s.replace('R299 (ŽIVO) + R300 pričakujeta SKUPNI deploy', 'R300 (ŽIVO) + R301 pričakujeta SKUPNI deploy')

# --- glava ---
s = s.replace(
    '# R300 — PRVA naloga (worklog R301): potrditi R290+…+R299+R300 SKUPAJ na produ.',
    '# R301 — PRVA naloga (worklog R302): potrditi R290+…+R300+R301 SKUPAJ na produ.',
)
s = s.replace(
    '#       polni LIVE needle teki (R300 Konfliktna mini ×11 + R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).',
    '#       polni LIVE needle teki (R301 Konflikti CSV ×11 + R300 Konfliktna mini ×11 + R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).',
)
s = s.replace(
    'R300 deploy potrjen (nosi R290+…+R300 — kanon R280/R284)',
    'R301 deploy potrjen (nosi R290+…+R301 — kanon R280/R284)',
)
s = s.replace(
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300+R301 — kanon R280/R284)"',
)
s = s.replace(
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300)."',
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300+R301)."',
)

# --- R301 LIVE blok (Konflikti CSV 31. člen) pred R300 regresijskim blokom ---
OLD_R300_BLOCK = 'echo "--- R300 MANDATORY — TEDENSKI KONFLIKTNI PREGLED (LIVE — PRVA naloga R301) ---"'
NEW_R301_BLOCK = '''echo "--- R301 MANDATORY — TEDENSKI KONFLIKTI CSV (LIVE — PRVA naloga R302) ---"
need "konfliktiCsvFilename" "R301 lib import (EN VIR graditelj) — LIVE"
need "konflikti-csv-pill" "R301 pill testid — LIVE"
need "Konflikti CSV" "R301 pill label — LIVE"
need "Dan prekrivanja" "R301 glava stolpec — LIVE"
need "Ekip z konflikti" "R301 meta stevec — LIVE"
need "Pregledanih terminov" "R301 meta obseg — LIVE"
need "dokazani pari prekrivanj ekipe" "R301 legenda — LIVE"
need "Ni dokazanih konfliktov v okviru" "R301 zelen žig toast — LIVE"
need "Žig je zelen" "R301 iskrena čistost razlaga — LIVE"
need "isti poli-odprto pregled kot žig" "R301 definicijski naslov — LIVE"
need "Konflikti prenešeni v CSV" "R301 WYSIWYG toast naslov — LIVE"
echo "--- R300 MANDATORY — TEDENSKI KONFLIKTNI PREGLED (LIVE — regresija) ---"'''
assert OLD_R300_BLOCK in s, 'R300 LIVE blok oznaka ni najdena'
s = s.replace(OLD_R300_BLOCK, NEW_R301_BLOCK)

# --- must_miss: dodaj TODO-R301 pred TODO-R300 ---
OLD_MM = 'must_miss "TODO-R300" "R300 — brez razvojnih ostankov (izginil)"'
NEW_MM = 'must_miss "TODO-R301" "R301 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R300" "R300 — brez razvojnih ostankov (izginil)"'
assert OLD_MM in s, 'TODO-R300 must_miss ni najden'
s = s.replace(OLD_MM, NEW_MM)

# --- skupni sklep ---
s = s.replace('R300 lastni needleji', 'R301 lastni needleji')
s = s.replace('R300 SKUPNA RESNICA', 'R301 SKUPNA RESNICA')
s = s.replace('R301 NEEDLES VSE ZELENE (R300 ×11 + regresije)', 'R301 NEEDLES VSE ZELENE (R301 ×11 + regresije)')

open(DST, 'w').write(s)
print(f'OK: {DST} (R301 LIVE ×11 + R300→R290 regresije + UNION harvest + EPOCH guard)')
