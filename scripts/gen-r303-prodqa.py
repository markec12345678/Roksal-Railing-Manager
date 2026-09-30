#!/usr/bin/env python3
# R303 — generira scripts/r303-prod-qa.sh iz r302-prod-qa.sh (UNION harvest
# + EPOCH git-izpeljan guard dedovana):
#  1. EPOCH guard GIT-IZPELJAN: meja = čas R303 commita (prek git log grep —
#     self-contained);
#  2. NOV R303 LIVE blok (Vodja tedenski PDF po ekipah 33. člen ×11) PRED
#     R302 blokom; R302 postane regresija (oznaka 'LIVE — regresija');
#  3. must_miss dobi TODO-R303 (must_miss veja ostaja samo za LIVE teki);
#  4. poti + probe ID-ji r302 → r303; ZERO-MUTACIJA veriga nespremenjena;
#  5. POPRAVEK dedovanega kozmetičnega buga: končni banner je nosil stale
#     niz 'R300 PROD QA' (kopirano skozi generacije — R302 lekcija) — R303
#     banner izreče PRAVILNO verigo R290+…+R303.
SRC = '/home/z/my-project/scripts/r302-prod-qa.sh'
DST = '/home/z/my-project/scripts/r303-prod-qa.sh'

s = open(SRC).read()

# --- poti + probe ID-ji ---
s = s.replace('/tmp/r302-', '/tmp/r303-')
s = s.replace('r302-ne-obstojeci-id-probe', 'r303-ne-obstojeci-id-probe')
s = s.replace('r302-prod-v99-probe', 'r303-prod-v99-probe')
s = s.replace("'r302 probe v99'", "'r303 probe v99'")

# --- EPOCH guard: meja = R303 commit ---
s = s.replace('R302_COMMIT_ISO', 'R303_COMMIT_ISO')
s = s.replace('R302_PUSH', 'R303_PUSH')
s = s.replace("$2 ~ /^R302 —/", "$2 ~ /^R303 —/")
s = s.replace('R302 commita ni v git zgodovini', 'R303 commita ni v git zgodovini')
s = s.replace('R302 meja (commit čas, UTC)', 'R303 meja (commit čas, UTC)')
s = s.replace('R302 deploy detekcija', 'R303 deploy detekcija')
s = s.replace('R302 commit meja', 'R303 commit meja')
s = s.replace('build $BUILD ≤ R302 commit meja', 'build $BUILD ≤ R303 commit meja')
s = s.replace('deploy je nosil VSE generacije (R290+…+R301+R302', 'deploy je nosil VSE generacije (R290+…+R302+R303')

# --- glava komentarja ---
s = s.replace('# R302 — PRVA naloga (worklog R303): potrditi R290+…+R301+R302 SKUPAJ na produ.',
              '# R303 — PRVA naloga (worklog R304): potrditi R290+…+R302+R303 SKUPAJ na produ.')
s = s.replace('#       → R302 deploy potrjen (nosi R290+…+R302 — kanon R280/R284),',
              '#       → R303 deploy potrjen (nosi R290+…+R303 — kanon R280/R284),')
s = s.replace('#       polni LIVE needle teki (R302 Konflikti PDF ×11 + R301 Konflikti CSV ×11 + R300 Konfliktna mini ×11 + R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).',
              '#       polni LIVE needle teki (R303 Vodja tedenski PDF po ekipah ×11 + R302 Konflikti PDF ×11 + R301 Konflikti CSV ×11 + R300 Konfliktna mini ×11 + R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).')

# --- NOV R303 LIVE blok PRED R302 blokom; R302 postane regresija ---
s = s.replace('echo "--- R302 MANDATORY — TEDENSKI KONFLIKTI PDF (LIVE — PRVA naloga R303) ---"',
'''echo "--- R303 MANDATORY — VODJA TEDENSKI PDF PO EKIPAH (LIVE — PRVA naloga R304) ---"
need "buildTedenskiEkipaPdfDoc" "R303 lib graditelj (EN VIR — LIVE prek TypeError kanona) — LIVE"
need "tedenskiEkipaPdfFilename" "R303 ime datoteke (EN VIR graditelj) — LIVE"
need "ekipe-pdf-pill" "R303 pill testid — LIVE"
need "Ekipe PDF" "R303 pill label — LIVE"
need "TEDENSKI VOZNI RED PO EKIPAH" "R303 PDF naslov — LIVE"
need "Tedenski vozni red po ekipah prenešen" "R303 WYSIWYG toast naslov — LIVE"
need "Tedenski vozni red po ekipah kot PDF" "R303 definicijski naslov — LIVE"
need "Izvoz PDF po ekipah ni uspel" "R303 fail-verbose catch (guard resnica) — LIVE"
need "Ni ekip z termini v naslednjih 7 dneh" "R303 fail-closed toast (0 ekip — mirror R299) — LIVE"
need "ENA sekcija na ekipo" "R303 legenda + definicijski naslov (ENA sekcija na ekipo) — LIVE"
need "Tedenski-po-ekipah-" "R303 ime datoteke kanon (string literal) — LIVE"
echo "--- R302 MANDATORY — TEDENSKI KONFLIKTI PDF (LIVE — regresija) ---"''')

# R302 oznake 'PRVA naloga R303' → 'regresija' (blok ostaja LIVE preverba)
s = s.replace('R302 lib graditelj (EN VIR — LIVE prek TypeError kanona) — LIVE',
              'R302 lib graditelj (EN VIR — LIVE prek TypeError kanona) — LIVE (regresija)')
s = s.replace('R302 ime datoteke (EN VIR graditelj) — LIVE',
              'R302 ime datoteke (EN VIR graditelj) — LIVE (regresija)')

# --- must_miss: TODO-R303 (+ POPRAVEK: TODO-R302 je manjkal — R302
#     generator je zgrešil format z '(izginil)' pripono; dedovana vrzel) ---
s = s.replace('must_miss "TODO-R301" "R301 — brez razvojnih ostankov (izginil)"',
              'must_miss "TODO-R301" "R301 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R302" "R302 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R303" "R303 — brez razvojnih ostankov (izginil)"')

# --- kozmetični popravki stale bannerjev (dedovani iz pred-R302 generacij) ---
s = s.replace('echo "=== R300 PROD QA — R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300 ŽIVO SKUPAJ ==="',
              'echo "=== R303 PROD QA — R290+…+R302+R303 ŽIVO SKUPAJ ==="')

open(DST, 'w').write(s)
print('r303-prod-qa.sh zgeneriran (' + str(len(s.splitlines())) + ' vrstic)')
