#!/usr/bin/env python3
# R299 — generira scripts/r299-prod-qa.sh iz r298-prod-qa.sh (UNION harvest
# + EPOCH git-izpeljan guard dedovana):
#  1. EPOCH guard GIT-IZPELJAN: meja = čas R299 commita (prek git log grep —
#     self-contained);
#  2. NOV R299 LIVE blok (Tedenski ICS po ekipah 29. člen ×16) PRED R298
#     blokom; R298 postane regresija (oznaka 'LIVE — regresija');
#  3. must_miss dobi TODO-R299 (must_miss veja ostaja samo za LIVE teki);
#  4. poti + probe ID-ji r298 → r299; ZERO-MUTACIJA veriga nespremenjena.
SRC = '/home/z/my-project/scripts/r298-prod-qa.sh'
DST = '/home/z/my-project/scripts/r299-prod-qa.sh'

s = open(SRC).read()

# --- poti + probe ID-ji ---
s = s.replace('/tmp/r298-', '/tmp/r299-')
s = s.replace('r298-ne-obstojeci-id-probe', 'r299-ne-obstojeci-id-probe')
s = s.replace('r298-prod-v99-probe', 'r299-prod-v99-probe')
s = s.replace("'r298 probe v99'", "'r299 probe v99'")

# --- EPOCH guard: meja = R299 commit ---
s = s.replace('R298_COMMIT_ISO', 'R299_COMMIT_ISO')
s = s.replace('R298_PUSH', 'R299_PUSH')
s = s.replace("$2 ~ /^R298 —/", "$2 ~ /^R299 —/")
s = s.replace('R298 commita ni v git zgodovini', 'R299 commita ni v git zgodovini')
s = s.replace('R298 meja (commit čas, UTC)', 'R299 meja (commit čas, UTC)')
s = s.replace('R298 deploy detekcija', 'R299 deploy detekcija')
s = s.replace('R298 commit meja', 'R299 commit meja')
s = s.replace('build $BUILD ≤ R298 commit meja', 'build $BUILD ≤ R299 commit meja')
s = s.replace('R298 deploy potrjen (build $BUILD > R299 commit meja', 'R299 deploy potrjen (build $BUILD > R299 commit meja')
s = s.replace('R297 (ŽIVO) + R298 pričakujeta SKUPNI deploy', 'R298 (ŽIVO) + R299 pričakujeta SKUPNI deploy')

# --- glava ---
s = s.replace(
    '# R298 — PRVA naloga (worklog R299): potrditi R290+…+R297+R298 SKUPAJ na produ.',
    '# R299 — PRVA naloga (worklog R300): potrditi R290+…+R298+R299 SKUPAJ na produ.',
)
s = s.replace(
    '#       polni LIVE needle teki (R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + R294 ×9 + regresije).',
    '#       polni LIVE needle teki (R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).',
)
s = s.replace(
    'R298 deploy potrjen (nosi R290+…+R298 — kanon R280/R284)',
    'R299 deploy potrjen (nosi R290+…+R299 — kanon R280/R284)',
)
s = s.replace(
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296+R297+R298 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296+R297+R298+R299 — kanon R280/R284)"',
)
s = s.replace(
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296+R297+R298)."',
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296+R297+R298+R299)."',
)

# --- R299 LIVE blok (Tedenski ICS po ekipah 29. člen) pred R298 regresijskim blokom ---
OLD_R298_BLOCK = 'echo "--- R298 MANDATORY — TEDENSKI VOZNI RED ICS (LIVE — PRVA naloga R299) ---"'
NEW_R299_BLOCK = '''echo "--- R299 MANDATORY — TEDENSKI ICS PO EKIPAH (LIVE — PRVA naloga R300) ---"
need "Tedenski ICS po ekipah" "R299 skupina aria — LIVE"
need "ICS po ekipi:" "R299 skupina oznaka — LIVE"
need "Ekipa z vsaj enim terminom v naslednjih 7 dneh (danes + 6 dni, UTC)" "R299 definicijski naslov oznake — LIVE"
need "Izvozi tedenski ICS samo za ekipo " "R299 cip aria — LIVE"
need "Samo termini ekipe " "R299 definicijski naslov cipa — LIVE"
need "tedenskiEkipaImena" "R299 lib EN VIR ekip seznam (canek) — LIVE"
need "tedenskiEkipaIcs" "R299 lib EN VIR izvoz (canek) — LIVE"
need "tedenskiEkipaIcsFilename" "R299 ime datoteke (canek) — LIVE"
need "-//Roksal//Tedenski vozni red po ekipah//SL" "R299 PRODID literal (canek) — LIVE"
need "X-ROKSAL-EKIPA:" "R299 ekipa meta (canek) — LIVE"
need "Ni ekip z termini v naslednjih 7 dneh" "R299 fail-closed toast — LIVE"
need "ICS po ekipi se izvozi, ko ima ekipa vpisan termin v prihajajočem tednu." "R299 iskren toast opis — LIVE"
need "Tedenski ICS za ekipo " "R299 uspeh toast (WYSIWYG) — LIVE"
need "Izvoz ICS za ekipo " "R299 fail-verbose catch — LIVE"
need " · ICS po ekipi = samo termini te ekipe (isti 7-dnevni okvir)" "R299 legenda — LIVE"
need "vozni-red-ekipa-" "R299 UID predpona (ni trkov; ASCII kanon R289) — LIVE"
echo "--- R298 MANDATORY — TEDENSKI VOZNI RED ICS (LIVE — regresija) ---"'''
assert OLD_R298_BLOCK in s, 'R298 LIVE blok oznaka ni najdena'
s = s.replace(OLD_R298_BLOCK, NEW_R299_BLOCK)

# --- must_miss: dodaj TODO-R299 pred TODO-R298 ---
OLD_MM = 'must_miss "TODO-R298" "R298 — brez razvojnih ostankov (izginil)"'
NEW_MM = 'must_miss "TODO-R299" "R299 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R298" "R298 — brez razvojnih ostankov (izginil)"'
assert OLD_MM in s, 'TODO-R298 must_miss ni najden'
s = s.replace(OLD_MM, NEW_MM)

# --- skupni sklep ---
s = s.replace(
    'echo "=== R298 PROD QA — R290+R291+R292+R293+R294+R295+R296+R297+R298 ŽIVO SKUPAJ ==="',
    'echo "=== R299 PROD QA — R290+R291+R292+R293+R294+R295+R296+R297+R298+R299 ŽIVO SKUPAJ ==="',
)

open(DST, 'w').write(s)
print('r299-prod-qa.sh zgeneriran:', len(s), 'znakov')
