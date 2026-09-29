#!/usr/bin/env python3
# R296 — generira scripts/r296-prod-qa.sh iz r295-prod-qa.sh:
#  1. EPOCH guard GIT-IZPELJAN: meja = čas R296 commita (prek git log grep —
#     self-contained, strožja meja: med commitom in pushom ni Vercel builda);
#  2. NOV R296 LIVE blok (ICS 26. člen ×11) PRED R295 blokom; R295 postane
#     regresija (oznaka 'LIVE — regresija');
#  3. must_miss dobi TODO-R296 (must_miss veja ostaja samo za LIVE teki);
#  4. poti + probe ID-ji r295 → r296; ZERO-MUTACIJA veriga nespremenjena.
SRC = '/home/z/my-project/scripts/r295-prod-qa.sh'
DST = '/home/z/my-project/scripts/r296-prod-qa.sh'

s = open(SRC).read()

# --- poti + probe ID-ji ---
s = s.replace('/tmp/r295-', '/tmp/r296-')
s = s.replace('r295-ne-obstojeci-id-probe', 'r296-ne-obstojeci-id-probe')
s = s.replace('r295-prod-v99-probe', 'r296-prod-v99-probe')
s = s.replace("'r295 probe v99'", "'r296 probe v99'")

# --- EPOCH guard: meja = R296 commit ---
s = s.replace('R295_COMMIT_ISO', 'R296_COMMIT_ISO')
s = s.replace('R295_PUSH', 'R296_PUSH')
s = s.replace("$2 ~ /^R295 —/", "$2 ~ /^R296 —/")
s = s.replace('R295 commita ni v git zgodovini', 'R296 commita ni v git zgodovini')
s = s.replace('R295 meja (commit čas, UTC)', 'R296 meja (commit čas, UTC)')
s = s.replace('R295 deploy detekcija', 'R296 deploy detekcija')
s = s.replace('R295 commit meja', 'R296 commit meja')
s = s.replace('R295 commit meja', 'R296 commit meja')
s = s.replace('build $BUILD ≤ R295 commit meja', 'build $BUILD ≤ R296 commit meja')
s = s.replace('R295 deploy potrjen (build $BUILD > R296 commit meja', 'R296 deploy potrjen (build $BUILD > R296 commit meja')
s = s.replace('R294 (21:53:39Z ŽIVO) + R295 pričakujeta SKUPNI deploy', 'R295 (ŽIVO) + R296 pričakujeta SKUPNI deploy')

# --- glava ---
s = s.replace(
    '# R295 — PRVA naloga (worklog R296): potrditi R290+R291+R292+R293+R294+R295 SKUPAJ na produ.',
    '# R296 — PRVA naloga (worklog R297): potrditi R290+R291+R292+R293+R294+R295+R296 SKUPAJ na produ.',
)
s = s.replace(
    '#       polni LIVE needle teki (R295 koledar CSV + mini-vrstica ×9 + R294 ×9 + regresije).',
    '#       polni LIVE needle teki (R296 ICS ×11 + R295 koledar CSV + mini-vrstica ×9 + R294 ×9 + regresije).',
)
s = s.replace(
    'R295 deploy potrjen (nosi R290+…+R295 — kanon R280/R284)',
    'R296 deploy potrjen (nosi R290+…+R296 — kanon R280/R284)',
)
s = s.replace(
    'R296 deploy potrjen (nosi R290+…+R295 — kanon R280/R284)',
    'R296 deploy potrjen (nosi R290+…+R296 — kanon R280/R284)',
)
s = s.replace(
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295+R296 — kanon R280/R284)"',
)
s = s.replace(
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295)."',
    'echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296)."',
)

# --- R296 LIVE blok (ICS 26. člen) pred R295 regresijskim blokom ---
OLD_R295_BLOCK = 'echo "--- R295 MANDATORY — KOLEDAR PREGLEDOV CSV + F2 MINI-VRSTICA (LIVE — PRVA naloga R296) ---"'
NEW_R296_BLOCK = '''echo "--- R296 MANDATORY — KOLEDAR PREGLEDOV ICS (LIVE — PRVA naloga R297) ---"
need "Izvozi koledar pregledov kot ICS" "R296 gumb aria — LIVE"
need "Koledar pregledov kot ICS (uvoz v koledarsko aplikacijo — Google/Outlook/telefon)" "R296 gumb title — LIVE"
need "koledarPregledovIcsFilename" "R296 lib ime datoteke (čanek) — LIVE"
need "-//Roksal//Koledar pregledov//SL" "R296 PRODID konstanta (čanek) — LIVE"
need "CALSCALE:GREGORIAN" "R296 ICS glava (čanek) — LIVE"
need "X-ROKSAL-STATUS:" "R296 X- status resnica VERBATIM (čanek) — LIVE"
need "ICS se izvozi, ko je vpisan prvi datum pregleda." "R296 fail-closed toast — LIVE"
need "Koledar pregledov prenešen v ICS" "R296 uspeh toast (WYSIWYG) — LIVE"
need "text/calendar;charset=utf-8" "R296 MIME resnica (čanek) — LIVE"
need "Pregledi v naslednjih 7 dneh (kanon opomnika" "R296 stil F2 title 2 — LIVE"
need "opomnikDatum < danes" "R296 stil F2 title 3 — LIVE"
echo "--- R295 MANDATORY — KOLEDAR PREGLEDOV CSV + F2 MINI-VRSTICA (LIVE — regresija) ---"'''
assert OLD_R295_BLOCK in s, 'R295 LIVE blok oznaka ni najdena'
s = s.replace(OLD_R295_BLOCK, NEW_R296_BLOCK)

# --- must_miss: dodaj TODO-R296 pred TODO-R295 ---
OLD_MM = 'must_miss "TODO-R295" "R295 — brez razvojnih ostankov (izginil)"'
NEW_MM = 'must_miss "TODO-R296" "R296 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R295" "R295 — brez razvojnih ostankov (izginil)"'
assert OLD_MM in s, 'TODO-R295 must_miss ni najden'
s = s.replace(OLD_MM, NEW_MM)

# --- skupni sklep ---
s = s.replace(
    'echo "=== R295 PROD QA — R290+R291+R292+R293+R294+R295 ŽIVO SKUPAJ ==="',
    'echo "=== R296 PROD QA — R290+R291+R292+R293+R294+R295+R296 ŽIVO SKUPAJ ==="',
)

open(DST, 'w').write(s)
print('r296-prod-qa.sh zgeneriran:', len(s), 'znakov')
