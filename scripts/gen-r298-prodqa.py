#!/usr/bin/env python3
# R298 — generira scripts/r298-prod-qa.sh iz r297-prod-qa.sh (ŽE s UNION
# harvest popravkom — deduje se samodejno):
#  1. EPOCH guard GIT-IZPELJAN: meja = čas R298 commita (prek git log grep —
#     self-contained, strožja meja: med commitom in pushom ni Vercel builda);
#  2. NOV R298 LIVE blok (Tedenski ICS 28. člen ×13) PRED R297 blokom; R297
#     postane regresija (oznaka 'LIVE — regresija');
#  3. must_miss dobi TODO-R298 (must_miss veja ostaja samo za LIVE teki);
#  4. poti + probe ID-ji r297 → r298; ZERO-MUTACIJA veriga nespremenjena.
SRC = '/home/z/my-project/scripts/r297-prod-qa.sh'
DST = '/home/z/my-project/scripts/r298-prod-qa.sh'

s = open(SRC).read()

# --- poti + probe ID-ji ---
s = s.replace('/tmp/r297-', '/tmp/r298-')
s = s.replace('r297-ne-obstojeci-id-probe', 'r298-ne-obstojeci-id-probe')
s = s.replace('r297-prod-v99-probe', 'r298-prod-v99-probe')
s = s.replace("'r297 probe v99'", "'r298 probe v99'")

# --- EPOCH guard: meja = R298 commit ---
s = s.replace('R297_COMMIT_ISO', 'R298_COMMIT_ISO')
s = s.replace('R297_PUSH', 'R298_PUSH')
s = s.replace("$2 ~ /^R297 —/", "$2 ~ /^R298 —/")
s = s.replace('R297 commita ni v git zgodovini', 'R298 commita ni v git zgodovini')
s = s.replace('R297 meja (commit čas, UTC)', 'R298 meja (commit čas, UTC)')
s = s.replace('R297 deploy detekcija', 'R298 deploy detekcija')
s = s.replace('R297 commit meja', 'R298 commit meja')
s = s.replace('build $BUILD ≤ R297 commit meja', 'build $BUILD ≤ R298 commit meja')
s = s.replace('R297 deploy potrjen (build $BUILD > R298 commit meja', 'R298 deploy potrjen (build $BUILD > R298 commit meja')
s = s.replace('R296 (ŽIVO) + R297 pričakujeta SKUPNI deploy', 'R297 (ŽIVO) + R298 pričakujeta SKUPNI deploy')

# --- glava ---
s = s.replace(
    '# R297 — PRVA naloga (worklog R298): potrditi R290+R291+R292+R293+R294+R295+R296+R297 SKUPAJ na produ.',
    '# R298 — PRVA naloga (worklog R299): potrditi R290+…+R297+R298 SKUPAJ na produ.',
)
s = s.replace(
    '#       polni LIVE needle teki (R297 Oprema CSV ×10 + R296 ICS ×11 + R295 koledar CSV + mini-vrstica ×9 + R294 ×9 + regresije).',
    '#       polni LIVE needle teki (R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + R294 ×9 + regresije).',
)
s = s.replace(
    'R297 deploy potrjen (nosi R290+…+R297 — kanon R280/R284)',
    'R298 deploy potrjen (nosi R290+…+R298 — kanon R280/R284)',
)
s = s.replace(
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296+R297 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296+R297+R298 — kanon R280/R284)"',
)
s = s.replace(
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296+R297)."',
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296+R297+R298)."',
)

# --- R298 LIVE blok (Tedenski ICS 28. člen) pred R297 regresijskim blokom ---
OLD_R297_BLOCK = 'echo "--- R297 MANDATORY — OPREMA CIKEL CSV (LIVE — PRVA naloga R298) ---"'
NEW_R298_BLOCK = '''echo "--- R298 MANDATORY — TEDENSKI VOZNI RED ICS (LIVE — PRVA naloga R299) ---"
need "Izvozi tedenski pregled montaž kot ICS koledar" "R298 gumb aria — LIVE"
need "Tedenski pregled montaž kot ICS — naslednjih 7 dni v telefonov koledar (ekipa uvozi razpored; ure in statusi iz iste resnice kot PDF/CSV)" "R298 gumb title — LIVE"
need "tedenskiVozniRedIcsVrstice" "R298 lib EN VIR graditelj (čanek) — LIVE"
need "tedenskiVozniRedIcsFilename" "R298 ime datoteke (čanek) — LIVE"
need "-//Roksal//Tedenski vozni red//SL" "R298 PRODID literal (čanek) — LIVE"
need "X-ROKSAL-OBSEG:" "R298 obseg meta (čanek) — LIVE"
need "ICS se izvozi, ko je vpisan termin v prihajajočem tednu." "R298 fail-closed toast — LIVE"
need "Tedenski vozni red prenešen v ICS" "R298 uspeh toast (WYSIWYG) — LIVE"
need "Izvoz ICS ni uspel" "R298 fail-verbose catch — LIVE"
need "Tedenski ICS = naslednjih 7 dni v telefonov koledar" "R298 legenda — LIVE"
need "Brez terminov — iskreno prazen dan" "R298 stil definicijski naslov števca — LIVE"
need "Vsi vidni termini dneva (preklicani ŠTETI — viden odpad)" "R298 stil definicijski naslov zapolnjen — LIVE"
need "Tedenski ICS" "R298 pill oznaka — LIVE"
echo "--- R297 MANDATORY — OPREMA CIKEL CSV (LIVE — regresija) ---"'''
assert OLD_R297_BLOCK in s, 'R297 LIVE blok oznaka ni najdena'
s = s.replace(OLD_R297_BLOCK, NEW_R298_BLOCK)

# --- must_miss: dodaj TODO-R298 pred TODO-R297 ---
OLD_MM = 'must_miss "TODO-R297" "R297 — brez razvojnih ostankov (izginil)"'
NEW_MM = 'must_miss "TODO-R298" "R298 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R297" "R297 — brez razvojnih ostankov (izginil)"'
assert OLD_MM in s, 'TODO-R297 must_miss ni najden'
s = s.replace(OLD_MM, NEW_MM)

# --- skupni sklep ---
s = s.replace(
    'echo "=== R297 PROD QA — R290+R291+R292+R293+R294+R295+R296+R297 ŽIVO SKUPAJ ==="',
    'echo "=== R298 PROD QA — R290+R291+R292+R293+R294+R295+R296+R297+R298 ŽIVO SKUPAJ ==="',
)

open(DST, 'w').write(s)
print('r298-prod-qa.sh zgeneriran:', len(s), 'znakov')
