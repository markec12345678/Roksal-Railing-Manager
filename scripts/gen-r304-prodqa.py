#!/usr/bin/env python3
# R304 — generira scripts/r304-prod-qa.sh iz r303-prod-qa.sh (UNION harvest
# + EPOCH git-izpeljan guard dedovana):
#  1. EPOCH guard GIT-IZPELJAN: meja = čas R304 commita (prek git log grep —
#     self-contained);
#  2. NOV R304 LIVE blok (Vodja tedenski CSV po ekipah 34. člen ×11) PRED
#     R303 blokom; R303 postane regresija (oznaka 'LIVE — regresija');
#  3. must_miss dobi TODO-R304 (must_miss veja ostaja samo za LIVE teki);
#  4. poti + probe ID-ji r303 → r304; ZERO-MUTACIJA veriga nespremenjena;
#  5. končni banner izreče PRAVILNO verigo R290+…+R303+R304.
SRC = '/home/z/my-project/scripts/r303-prod-qa.sh'
DST = '/home/z/my-project/scripts/r304-prod-qa.sh'

s = open(SRC).read()

# --- poti + probe ID-ji ---
s = s.replace('/tmp/r303-', '/tmp/r304-')
s = s.replace('r303-ne-obstojeci-id-probe', 'r304-ne-obstojeci-id-probe')
s = s.replace('r303-prod-v99-probe', 'r304-prod-v99-probe')
s = s.replace("'r303 probe v99'", "'r304 probe v99'")

# --- EPOCH guard: meja = R304 commit ---
s = s.replace('R303_COMMIT_ISO', 'R304_COMMIT_ISO')
s = s.replace('R303_PUSH', 'R304_PUSH')
s = s.replace("$2 ~ /^R303 —/", "$2 ~ /^R304 —/")
s = s.replace('R303 commita ni v git zgodovini', 'R304 commita ni v git zgodovini')
s = s.replace('R303 meja (commit čas, UTC)', 'R304 meja (commit čas, UTC)')
s = s.replace('R303 deploy detekcija', 'R304 deploy detekcija')
s = s.replace('R303 commit meja', 'R304 commit meja')
s = s.replace('build $BUILD ≤ R303 commit meja', 'build $BUILD ≤ R304 commit meja')
s = s.replace('deploy je nosil VSE generacije (R290+…+R302+R303', 'deploy je nosil VSE generacije (R290+…+R303+R304')

# --- glava komentarja ---
s = s.replace('# R303 — PRVA naloga (worklog R304): potrditi R290+…+R302+R303 SKUPAJ na produ.',
              '# R304 — PRVA naloga (worklog R305): potrditi R290+…+R303+R304 SKUPAJ na produ.')
s = s.replace('#       → R303 deploy potrjen (nosi R290+…+R303 — kanon R280/R284),',
              '#       → R304 deploy potrjen (nosi R290+…+R304 — kanon R280/R284),')
s = s.replace('#       polni LIVE needle teki (R303 Vodja tedenski PDF po ekipah ×11 + R302 Konflikti PDF ×11 + R301 Konflikti CSV ×11 + R300 Konfliktna mini ×11 + R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).',
              '#       polni LIVE needle teki (R304 Vodja tedenski CSV po ekipah ×11 + R303 Vodja tedenski PDF po ekipah ×11 + R302 Konflikti PDF ×11 + R301 Konflikti CSV ×11 + R300 Konfliktna mini ×11 + R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).')

# --- NOV R304 LIVE blok PRED R303 blokom; R303 postane regresija ---
s = s.replace('echo "--- R303 MANDATORY — VODJA TEDENSKI PDF PO EKIPAH (LIVE — PRVA naloga R304) ---"',
'''echo "--- R304 MANDATORY — VODJA TEDENSKI CSV PO EKIPAH (LIVE — PRVA naloga R305) ---"
need "tedenskiEkipaCsvVrstice" "R304 lib vrstice (EN VIR — LIVE prek TypeError kanona) — LIVE"
need "tedenskiEkipaCsvFilename" "R304 ime datoteke (EN VIR graditelj) — LIVE"
need "ekipe-csv-pill" "R304 pill testid — LIVE"
need "Ekipe CSV" "R304 pill label — LIVE"
need "Tedenski vozni red po ekipah prenešen v CSV" "R304 WYSIWYG toast naslov — LIVE"
need "Tedenski vozni red po ekipah kot CSV" "R304 definicijski naslov — LIVE"
need "Izvoz CSV po ekipah ni uspel" "R304 fail-verbose catch (guard resnica) — LIVE"
need "CSV po ekipah se izvozi, ko je vpisan termin" "R304 fail-closed toast (prazno okno) — LIVE"
need "CSV po ekipah se izvozi, ko ima ekipa vpisan termin" "R304 fail-closed toast (0 ekip — mirror R299/R303) — LIVE"
need "vir = ISTI pregled kot Ekipe PDF" "R304 meta Obseg EN VIR dokaz — LIVE"
need "Terminov po ekipah" "R304 meta števec (capital T — EN VIR pregleda) — LIVE"
echo "--- R303 MANDATORY — VODJA TEDENSKI PDF PO EKIPAH (LIVE — regresija) ---"''')

# R303 oznake 'PRVA naloga R304' → 'regresija' (blok ostaja LIVE preverba)
s = s.replace('R303 lib graditelj (EN VIR — LIVE prek TypeError kanona) — LIVE',
              'R303 lib graditelj (EN VIR — LIVE prek TypeError kanona) — LIVE (regresija)')
s = s.replace('R303 ime datoteke (EN VIR graditelj) — LIVE',
              'R303 ime datoteke (EN VIR graditelj) — LIVE (regresija)')

# --- must_miss: TODO-R304 ---
s = s.replace('must_miss "TODO-R303" "R303 — brez razvojnih ostankov (izginil)"',
              'must_miss "TODO-R303" "R303 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R304" "R304 — brez razvojnih ostankov (izginil)"')

# --- končni banner (pravilna veriga) ---
s = s.replace('echo "=== R303 PROD QA — R290+…+R302+R303 ŽIVO SKUPAJ ==="',
              'echo "=== R304 PROD QA — R290+…+R303+R304 ŽIVO SKUPAJ ==="')

open(DST, 'w').write(s)
print('r304-prod-qa.sh zgeneriran (' + str(len(s.splitlines())) + ' vrstic)')
