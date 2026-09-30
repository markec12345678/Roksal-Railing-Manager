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

# --- R297 POPRAVEK harvesta (prvi resnični stale tek razkril bug): per-tab
# clear+snapshot namesto ENEGA skupnega harvesta nad privzetim bufferjem 250
# (9-12 zavihkov × slike/pisave/chunks preplavi buffer; reload med sejo
# ponastavi vnose — 33/44 čankov = lažni MISS stale-dokaza). Stale dispatch
# lista se hkrati poravna na LIVE 12 zavihkov (pokritost = pokritost).
STALE_OLD = """  OUT=/tmp/r296-prod-chunks
  mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
  for d in '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","subTab2":null,"osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","more2":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"invoices","more2":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","more2":null,"osnutek":null,"filter":null}'; do
    eb_dispatch "$d"
    eb_cakaj 3
  done
  agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 > /tmp/r296-chunkurls-raw.json
  python3 -c "import json; raw=open('/tmp/r296-chunkurls-raw.json').read().strip(); arr=json.loads(raw); arr=json.loads(arr) if isinstance(arr,str) else arr; open('/tmp/r296-chunkurls.txt','w').write('\\n'.join(arr)+'\\n')" || { echo "PY PARSE FAIL — abort"; exit 1; }
  cp /tmp/r296-chunkurls.txt "$OUT"/chunk-urls.txt"""

LIVE_OLD = """OUT=/tmp/r296-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
for d in '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","more2":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"suppliers","subTab2":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"crm","more2":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","subTab2":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","more2":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"invoices","more2":null,"osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","more2":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"teren","more2":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"ekipa","more2":null,"osnutek":null,"filter":null}'; do
  eb_dispatch "$d"
  eb_cakaj 3
done
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 > /tmp/r296-chunkurls-raw.json
python3 -c "import json; raw=open('/tmp/r296-chunkurls-raw.json').read().strip(); arr=json.loads(raw); arr=json.loads(arr) if isinstance(arr,str) else arr; open('/tmp/r296-chunkurls.txt','w').write('\\n'.join(arr)+'\\n')" || { echo "PY PARSE FAIL — abort"; exit 1; }
cp /tmp/r296-chunkurls.txt "$OUT"/chunk-urls.txt"""

# dejanski nizi iz vira (brez subTab2/more2 izmišljotin — EXACT iz r295):
STALE_OLD = STALE_OLD.replace('"subTab":"orders","subTab2":null', '"subTab":"orders"')
STALE_OLD = STALE_OLD.replace('"more2":null', '"subTab":null')
LIVE_OLD = LIVE_OLD.replace('"subTab":"suppliers","subTab2":null', '"subTab":"suppliers"')
LIVE_OLD = LIVE_OLD.replace('"subTab":"orders","subTab2":null', '"subTab":"orders"')
LIVE_OLD = LIVE_OLD.replace('"more2":null', '"subTab":null')

HARVEST_SNAPSHOT = """agent-browser eval "(()=>{{performance.setResourceTimingBufferSize(10000); return 'buf';}})()" 2>&1 | tail -1 > /dev/null
{indent}eb_dispatch "$d"
{indent}eb_cakaj 3
{indent}agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 >> {lines}"""

LIVE_LIST = LIVE_OLD.split("for d in '", 1)[1].split("'; do", 1)[0]
FINAL_SHOT = "{indent}agent-browser eval \"JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))\" 2>&1 | tail -1 >> {lines}"
STALE_NEW = """  OUT=/tmp/r296-prod-chunks
  mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
  : > /tmp/r296-chunkurls-lines-stale.txt
  # R297 lekcija (prvi resnični stale + 2. LIVE tek): EN skupni harvest je
  # NEDETERMINISTIČEN (privzeti ResourceTiming buffer 250 se preplavi pri
  # 9-12 zavihkov; reload med sejo — med Vercel deployom! — ponastavi vnose;
  # per-tab CLEAR pa izbriše že naložene čanke, ker ponovni obisk NE naloga
  # nič novega → 18/44). UNION oblika: buffer 10000 ENKRAT pred zanko +
  # per-tab posamezne slike BREZ clear (zaščita pred reload) + KONČNI en strel
  # (polna akumulacija — zaščita pred poznimi nalaganji) → merge + dedup.
  for d in '{LIST}'; do
{SNAP}
  done
{FINAL}
  python3 /home/z/my-project/scripts/merge-chunkurls.py /tmp/r296-chunkurls-lines-stale.txt /tmp/r296-chunkurls.txt || {{ echo "PY MERGE FAIL — abort"; exit 1; }}
  cp /tmp/r296-chunkurls.txt "$OUT"/chunk-urls.txt""".format(LIST=LIVE_LIST, SNAP=HARVEST_SNAPSHOT.format(indent='  ', lines='/tmp/r296-chunkurls-lines-stale.txt'), FINAL=FINAL_SHOT.format(indent='  ', lines='/tmp/r296-chunkurls-lines-stale.txt'))

LIVE_NEW = """OUT=/tmp/r296-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
: > /tmp/r296-chunkurls-lines-live.txt
# R297 lekcija: ISTA UNION oblika kot stale veja (buffer 10000 + per-tab
# slike brez clear + končni en strel + merge/dedup — glej komentar tam).
for d in '{LIST}'; do
{SNAP}
done
{FINAL}
python3 /home/z/my-project/scripts/merge-chunkurls.py /tmp/r296-chunkurls-lines-live.txt /tmp/r296-chunkurls.txt || {{ echo "PY MERGE FAIL — abort"; exit 1; }}
cp /tmp/r296-chunkurls.txt "$OUT"/chunk-urls.txt""".format(LIST=LIVE_LIST, SNAP=HARVEST_SNAPSHOT.format(indent='  ', lines='/tmp/r296-chunkurls-lines-live.txt'), FINAL=FINAL_SHOT.format(indent='', lines='/tmp/r296-chunkurls-lines-live.txt'))

assert STALE_OLD in s, 'STALE harvest blok ni najden'
s = s.replace(STALE_OLD, STALE_NEW)
assert LIVE_OLD in s, 'LIVE harvest blok ni najden'
s = s.replace(LIVE_OLD, LIVE_NEW)

open(DST, 'w').write(s)
print('r296-prod-qa.sh zgeneriran:', len(s), 'znakov')
