#!/usr/bin/env python3
# R302 — generira scripts/r302-prod-qa.sh iz r301-prod-qa.sh (UNION harvest
# + EPOCH git-izpeljan guard dedovana):
#  1. EPOCH guard GIT-IZPELJAN: meja = čas R302 commita (prek git log grep —
#     self-contained);
#  2. NOV R302 LIVE blok (Konflikti PDF 32. člen ×11) PRED R301 blokom; R301
#     postane regresija (oznaka 'LIVE — regresija');
#  3. must_miss dobi TODO-R302 (must_miss veja ostaja samo za LIVE teki);
#  4. poti + probe ID-ji r301 → r302; ZERO-MUTACIJA veriga nespremenjena.
SRC = '/home/z/my-project/scripts/r301-prod-qa.sh'
DST = '/home/z/my-project/scripts/r302-prod-qa.sh'

s = open(SRC).read()

# --- poti + probe ID-ji ---
s = s.replace('/tmp/r301-', '/tmp/r302-')
s = s.replace('r301-ne-obstojeci-id-probe', 'r302-ne-obstojeci-id-probe')
s = s.replace('r301-prod-v99-probe', 'r302-prod-v99-probe')
s = s.replace("'r301 probe v99'", "'r302 probe v99'")

# --- EPOCH guard: meja = R302 commit ---
s = s.replace('R301_COMMIT_ISO', 'R302_COMMIT_ISO')
s = s.replace('R301_PUSH', 'R302_PUSH')
s = s.replace("$2 ~ /^R301 —/", "$2 ~ /^R302 —/")
s = s.replace('R301 commita ni v git zgodovini', 'R302 commita ni v git zgodovini')
s = s.replace('R301 meja (commit čas, UTC)', 'R302 meja (commit čas, UTC)')
s = s.replace('R301 deploy detekcija', 'R302 deploy detekcija')
s = s.replace('R301 commit meja', 'R302 commit meja')
s = s.replace('build $BUILD ≤ R301 commit meja', 'build $BUILD ≤ R302 commit meja')
s = s.replace('R301 deploy potrjen (build $BUILD > R302 commit meja', 'R302 deploy potrjen (build $BUILD > R302 commit meja')
s = s.replace('deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300+R301', 'deploy je nosil VSE generacije (R290+…+R301+R302')

# --- glava komentarja ---
s = s.replace('# R301 — PRVA naloga (worklog R302): potrditi R290+…+R300+R301 SKUPAJ na produ.',
              '# R302 — PRVA naloga (worklog R303): potrditi R290+…+R301+R302 SKUPAJ na produ.')
s = s.replace('#       → R301 deploy potrjen (nosi R290+…+R301 — kanon R280/R284),',
              '#       → R302 deploy potrjen (nosi R290+…+R302 — kanon R280/R284),')
s = s.replace('#       polni LIVE needle teki (R301 Konflikti CSV ×11 + R300 Konfliktna mini ×11 + R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).',
              '#       polni LIVE needle teki (R302 Konflikti PDF ×11 + R301 Konflikti CSV ×11 + R300 Konfliktna mini ×11 + R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).')

# --- NOV R302 LIVE blok PRED R301 blokom; R301 postane regresija ---
s = s.replace('echo "--- R301 MANDATORY — TEDENSKI KONFLIKTI CSV (LIVE — PRVA naloga R302) ---"',
'''echo "--- R302 MANDATORY — TEDENSKI KONFLIKTI PDF (LIVE — PRVA naloga R303) ---"
need "buildKonfliktiPdfDoc" "R302 lib graditelj (EN VIR — LIVE prek TypeError kanona) — LIVE"
need "konfliktiPdfFilename" "R302 ime datoteke (EN VIR graditelj) — LIVE"
need "konflikti-pdf-pill" "R302 pill testid — LIVE"
need "Konflikti PDF" "R302 pill label — LIVE"
need "TEDENSKI KONFLIKTI EKIP" "R302 PDF naslov — LIVE"
need "Konflikti prenešeni v PDF" "R302 WYSIWYG toast naslov — LIVE"
need "Konflikti tedenskega pregleda kot PDF" "R302 definicijski naslov — LIVE"
need "Izvoz konfliktov PDF ni uspel" "R302 fail-verbose catch (guard resnica) — LIVE"
need "Dokazani pari prekrivanj" "R302 PDF sekcija dokaza — LIVE"
need "Konflikti PDF se izvozi, ko je vpisan termin" "R302 prazno okno toast — LIVE"
need "tisk za pisarno" "R302 legenda (razlika medija) — LIVE"
echo "--- R301 MANDATORY — TEDENSKI KONFLIKTI CSV (LIVE — regresija) ---"''')
s = s.replace('R301 lib import (EN VIR graditelj) — LIVE', 'R301 lib import (EN VIR graditelj) — LIVE', 1)

# --- must_miss: TODO-R302 ---
s = s.replace('must_miss "TODO-R301" "R301 — brez razvojnih ostankov"',
              'must_miss "TODO-R302" "R302 — brez razvojnih ostankov"\nmust_miss "TODO-R301" "R301 — brez razvojnih ostankov"')

# --- konec oznaka ---
s = s.replace('=== R301 PROD QA — R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300 ŽIVO SKUPAJ ===',
              '=== R302 PROD QA — R290+…+R301+R302 ŽIVO SKUPAJ ===')

open(DST, 'w').write(s)
print('r302-prod-qa.sh zgeneriran (' + str(len(s.splitlines())) + ' vrstic)')
