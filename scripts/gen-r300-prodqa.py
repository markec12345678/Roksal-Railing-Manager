#!/usr/bin/env python3
# R300 — generira scripts/r300-prod-qa.sh iz r299-prod-qa.sh (UNION harvest
# + EPOCH git-izpeljan guard dedovana):
#  1. EPOCH guard GIT-IZPELJAN: meja = čas R300 commita (prek git log grep —
#     self-contained);
#  2. NOV R300 LIVE blok (Konfliktna mini-vrstica 30. člen ×11) PRED R299
#     blokom; R299 postane regresija (oznaka 'LIVE — regresija');
#  3. must_miss dobi TODO-R300 (must_miss veja ostaja samo za LIVE teki);
#  4. poti + probe ID-ji r299 → r300; ZERO-MUTACIJA veriga nespremenjena.
SRC = '/home/z/my-project/scripts/r299-prod-qa.sh'
DST = '/home/z/my-project/scripts/r300-prod-qa.sh'

s = open(SRC).read()

# --- poti + probe ID-ji ---
s = s.replace('/tmp/r299-', '/tmp/r300-')
s = s.replace('r299-ne-obstojeci-id-probe', 'r300-ne-obstojeci-id-probe')
s = s.replace('r299-prod-v99-probe', 'r300-prod-v99-probe')
s = s.replace("'r299 probe v99'", "'r300 probe v99'")

# --- EPOCH guard: meja = R300 commit ---
s = s.replace('R299_COMMIT_ISO', 'R300_COMMIT_ISO')
s = s.replace('R299_PUSH', 'R300_PUSH')
s = s.replace("$2 ~ /^R299 —/", "$2 ~ /^R300 —/")
s = s.replace('R299 commita ni v git zgodovini', 'R300 commita ni v git zgodovini')
s = s.replace('R299 meja (commit čas, UTC)', 'R300 meja (commit čas, UTC)')
s = s.replace('R299 deploy detekcija', 'R300 deploy detekcija')
s = s.replace('R299 commit meja', 'R300 commit meja')
s = s.replace('build $BUILD ≤ R299 commit meja', 'build $BUILD ≤ R300 commit meja')
s = s.replace('R299 deploy potrjen (build $BUILD > R300 commit meja', 'R300 deploy potrjen (build $BUILD > R300 commit meja')
s = s.replace('R298 (ŽIVO) + R299 pričakujeta SKUPNI deploy', 'R299 (ŽIVO) + R300 pričakujeta SKUPNI deploy')

# --- glava ---
s = s.replace(
    '# R299 — PRVA naloga (worklog R300): potrditi R290+…+R298+R299 SKUPAJ na produ.',
    '# R300 — PRVA naloga (worklog R301): potrditi R290+…+R299+R300 SKUPAJ na produ.',
)
s = s.replace(
    '#       polni LIVE needle teki (R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).',
    '#       polni LIVE needle teki (R300 Konfliktna mini ×11 + R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).',
)
s = s.replace(
    'R299 deploy potrjen (nosi R290+…+R299 — kanon R280/R284)',
    'R300 deploy potrjen (nosi R290+…+R300 — kanon R280/R284)',
)
s = s.replace(
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296+R297+R298+R299 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300 — kanon R280/R284)"',
)
s = s.replace(
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296+R297+R298+R299)."',
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300)."',
)

# --- R300 LIVE blok (Konfliktna mini-vrstica 30. člen) pred R299 regresijskim blokom ---
OLD_R299_BLOCK = 'echo "--- R299 MANDATORY — TEDENSKI ICS PO EKIPAH (LIVE — PRVA naloga R300) ---"'
NEW_R300_BLOCK = '''echo "--- R300 MANDATORY — TEDENSKI KONFLIKTNI PREGLED (LIVE — PRVA naloga R301) ---"
need "tedenskiKonflikti" "R300 lib EN VIR graditelj (canek) — LIVE"
need "tedenski-konflikti-mini" "R300 mini testid (canek) — LIVE"
need '["NAVRTENO","V_TEKU","PRELOZENO"]' "R300 aktivni statusi zrcalo (canek) — LIVE"
need "Konflikti: " "R300 mini resnica prepona (canek) — LIVE"
need "Konflikti: 0" "R300 čistost veja (canek) — LIVE"
need "dvojne rezervacije v okviru" "R300 konflikt veja (canek) — LIVE"
need "Pregled dvojnih rezervacij ekipe v 7-dnevnem okviru" "R300 definicijski naslov (canek) — LIVE"
need " isti poli-odprto pravilo kot API 409" "R300 pravilo v naslovu (canek) — LIVE"
need "text-roksal-green" "R300 čistost žig (canek) — LIVE"
need "text-roksal-red" "R300 konflikt žig (canek) — LIVE"
need "Preklicano/Zaključeno ne zasede" "R300 statusi v naslovu (canek) — LIVE"
echo "--- R299 MANDATORY — TEDENSKI ICS PO EKIPAH (LIVE — regresija) ---"'''
assert OLD_R299_BLOCK in s, 'R299 LIVE blok oznaka ni najdena'
s = s.replace(OLD_R299_BLOCK, NEW_R300_BLOCK)

# --- must_miss: dodaj TODO-R300 pred TODO-R299 ---
OLD_MM = 'must_miss "TODO-R299" "R299 — brez razvojnih ostankov (izginil)"'
NEW_MM = 'must_miss "TODO-R300" "R300 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R299" "R299 — brez razvojnih ostankov (izginil)"'
assert OLD_MM in s, 'TODO-R299 must_miss ni najden'
s = s.replace(OLD_MM, NEW_MM)

# --- skupni sklep ---
s = s.replace(
    'echo "=== R299 PROD QA — R290+R291+R292+R293+R294+R295+R296+R297+R298+R299 ŽIVO SKUPAJ ==="',
    'echo "=== R300 PROD QA — R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300 ŽIVO SKUPAJ ==="',
)

open(DST, 'w').write(s)
print('r300-prod-qa.sh zgeneriran:', len(s), 'znakov')
