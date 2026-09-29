#!/usr/bin/env python3
# R285 — generator r285-{build-needles,run-smoke,prod-qa,e2e-browser}.sh iz
# r284 vzorca (kanon: gen-* pišejo NOVE datoteke, ne patchajo izvornih;
# idempotenten ponovni zagon = iste datoteke).
import re

ROOT = '/home/z/my-project'
S = ROOT + '/scripts'


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def write(p, c):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)
    print('  wrote', p)


# ---------- 1) r285-build-needles.sh ----------
src = read(S + '/r284-build-needles.sh')
# header: R284 prva vrstica → R285 opis + ohrani opis družine
src = src.replace(
    "# R284 — build needleji: (1) TERENSKI ZAPISNI LIST PDF (issue #15 §3,",
    "# R285 — build needleji: (0) TERENSKI ZAPISNI LIST CSV (issue #15 §3,\n"
    "# worklog i5b — DIGITALNO izpolnjevanje v Excelu: ISTA zapisana resnica +\n"
    "# ISTI prazni fizični stolpci fizicna_ref_mm/delta_mm/zapiski_terena;\n"
    "# pariteta R186 arhiva PO KONSTRUKCIJI — EN VIR meritevVrstica; Y1–Y8);\n"
    "# (1) TERENSKI ZAPISNI LIST PDF (issue #15 §3,",
)
src = src.replace('OUT=/tmp/r284-build-chunks', 'OUT=/tmp/r285-build-chunks')
ANCHOR_BN = 'need_static "Zapisni list prenešen v PDF" "R284 uspeh toast (WYSIWYG)"'
assert ANCHOR_BN in src, 'build-needles anchor manjka'
R285_BLOCK_BN = ANCHOR_BN + '''
echo "--- R285 MANDATORY — TERENSKI ZAPISNI LIST CSV (issue #15 §3, worklog i5b) ---"
need_static "fizicna_ref_mm" "R285 CSV fill-in stolpec (Y8 — izpolnjevalna cona)"
need_static "delta_mm" "R285 CSV delta stolpec (Y8)"
need_static "zapiski_terena" "R285 CSV zapiski stolpec (Y8 — NIČ izmišljenih vrednosti)"
need_static "prazen seznam meritev ne nastaja CSV" "R285 lib fail-closed (Y3 — EN VIR)"
echo "--- R285 MANDATORY STIL — CSV gumb + legenda (kanon R280–R284) ---"
need_static "Izvozi terenski zapisni list kot CSV" "R285 gumb aria-label"
need_static "Terenski zapisni list kot CSV (issue #15 §3)" "R285 gumb hover title (pariteta R284)"
need_static "ZAPISNI LIST CSV = ista resnica v Excelu" "R285 legenda (pariteta R284 legenda)"
echo "--- R285 fail-closed (iskren toast — Y3) ---"
need_static "Terenski zapisni list (CSV) se izvozi, ko je vpisana prva meritev" "R285 iskren toast opis (prazen seznam)"
need_static "Terenski zapisni list (CSV) je projekt-obračunski" "R285 ni projekta toast (pariteta R284)"
need_static "Zapisni list prenešen v CSV" "R285 uspeh toast (WYSIWYG)"'''
src = src.replace(ANCHOR_BN, R285_BLOCK_BN)
anchor_mm = 'must_miss "TODO-R284" "R284 — brez razvojnih ostankov"'
assert anchor_mm in src
src = src.replace(anchor_mm, anchor_mm + '\nmust_miss "TODO-R285" "R285 — brez razvojnih ostankov"')
src = src.replace(
    'echo "NEEDLE FAIL=$FAIL (R284 ×16 novih;',
    'echo "NEEDLE FAIL=$FAIL (R285 ×11 novih; R284 ×16 novih;',
)
write(S + '/r285-build-needles.sh', src)

# ---------- 2) r285-run-smoke.sh ----------
src = read(S + '/r284-run-smoke.sh')
src = src.replace('R284', 'R285')
write(S + '/r285-run-smoke.sh', src)

# ---------- 3) r285-prod-qa.sh ----------
src = read(S + '/r284-prod-qa.sh')
# header (prvih 9 vrstic) → R285
old_head = '''# R284 — PRVA naloga (worklog R284): potrditi R284 na produ (R283 deploy
# zamuda > 40 min — P0; R284 vsebuje R283 — en skok z R282 builda) (R282 ŽIVO
# dokazan r282-prod-qa; R283 build po pushu naslednika — meja > R282 build 12:51:36.710Z'''
assert old_head in src, 'prod-qa header manjka'
new_head = '''# R285 — PRVA naloga (worklog R285): potrditi R285 na produ (R284 ŽIVO
# dokazan r284-prod-qa; meja > R284 build 2026-09-29T14:08:24.841Z)'''
src = src.replace(old_head, new_head)
src = src.replace(
    "meja = datetime.fromisoformat('2026-09-29T12:51:36.710+00:00')",
    "meja = datetime.fromisoformat('2026-09-29T14:08:24.841+00:00')",
)
src = src.replace(
    '"R284 NI ŠE DEPLOYAN (build ≤ R282 12:51:36.710Z) — needleji bi lažno FAILali"',
    '"R285 NI ŠE DEPLOYAN (build ≤ R284 14:08:24.841Z) — needleji bi lažno FAILali"',
)
src = src.replace(
    'echo "R284 deploy potrjen (build $BUILD > R282 12:51:36.710Z — vsebuje R283) — probe DOVOLJEN"',
    'echo "R285 deploy potrjen (build $BUILD > R284 14:08:24.841Z) — probe DOVOLJEN"',
)
src = src.replace('/tmp/r284-', '/tmp/r285-')
src = src.replace('OUT=/tmp/r284-prod-chunks', 'OUT=/tmp/r285-prod-chunks')
# R284 LIVE block label → regresija; vstav R285 LIVE blok predenj
old_lbl = 'echo "--- R284 MANDATORY (LIVE — PRVA naloga R285) ---"'
assert old_lbl in src, 'prod-qa R284 label manjka'
R285_LIVE = '''echo "--- R285 MANDATORY (LIVE — PRVA naloga R286) ---"
need "Izvozi terenski zapisni list kot CSV" "R285 gumb aria — LIVE"
need "fizicna_ref_mm" "R285 CSV fill-in stolpec — LIVE"
need "zapiski_terena" "R285 CSV zapiski stolpec — LIVE"
need "ZAPISNI LIST CSV = ista resnica v Excelu" "R285 legenda — LIVE"
echo "--- R284 MANDATORY (LIVE — regresija) ---"'''
src = src.replace(old_lbl, R285_LIVE)
src = src.replace(
    'echo "=== R284 PROD QA — R282+R283+R284 ŽIVO ==="',
    'echo "=== R285 PROD QA — R282+R283+R284+R285 ŽIVO ==="',
)
write(S + '/r285-prod-qa.sh', src)

# ---------- 4) r285-e2e-browser.sh ----------
src = read(S + '/r284-e2e-browser.sh')
# logi / tmp / sekreti / zasloni
src = src.replace('R284-server-e2e.log', 'R285-server-e2e.log')
src = src.replace('r284-e2e-lokalni-sekret', 'r285-e2e-lokalni-sekret')
src = src.replace('/tmp/r284-', '/tmp/r285-')
src = src.replace('qa-r284-', 'qa-r285-')
# header: dopolni Z2y vrstico v opis
old_z2z_doc = '''#   Z2z: ZAPISNI LIST PDF ŽIVO — fill-in resnica (issue #15 §3): gumb →
#        toast 'Zapisni list prenešen v PDF' + %PDF- magija (NOVA družina R284);'''
assert old_z2z_doc in src, 'e2e Z2z doc manjka'
src = src.replace(old_z2z_doc, old_z2z_doc + '''
#   Z2y: ZAPISNI LIST CSV ŽIVO — digitalno izpolnjevanje (issue #15 §3, R285):
#        gumb → toast 'Zapisni list prenešen v CSV' + BOM efbbbf + stolpci
#        fizicna_ref_mm/delta_mm/zapiski_terena (pariteta R186 — Y2/Y8);''')
src = src.replace(
    '# R284 E2E ŽIVO (lokalni :3100, ADMIN) — ISSUE #15 §1 referenčni testni',
    '# R285 E2E ŽIVO (lokalni :3100, ADMIN) — TERENSKI ZAPISNI LIST CSV + ISSUE #15 §1 referenčni testni',
)
# Z2z živi blok: po screenshot vrstici vstav Z2y
anchor_z2z = 'agent-browser screenshot "$SS/qa-r285-e2e-zapisni-pdf.png" > /dev/null 2>&1'
assert anchor_z2z in src, 'e2e Z2z screenshot anchor manjka'
Z2Y_BLOCK = anchor_z2z + '''

echo "=== Z2y: TERENSKI ZAPISNI LIST CSV ŽIVO — digitalno izpolnjevanje (R285) ==="
eb_zajem_pdf val285csv
eb_klik_gumb "Izvozi terenski zapisni list kot CSV"
eb_pocakaj_tekst "Zapisni list prenešen v CSV" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val285csv; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({csv:false, err:window.__err??null}); const bin=atob(b64); const bom=bin.charCodeAt(0).toString(16)+bin.charCodeAt(1).toString(16)+bin.charCodeAt(2).toString(16); let vrs=0; for(let i=0;i<bin.length;i++){ if(bin.charCodeAt(i)===10) vrs++; } return JSON.stringify({csv:true, bom, bajtov:bin.length, vrstic:vrs, imaFizicna:bin.includes('fizicna_ref_mm'), imaDelta:bin.includes('delta_mm'), imaZapiski:bin.includes('zapiski_terena'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r285-z2y.json
python3 -c "import json; r=json.load(open('/tmp/r285-z2y.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['csv'] and d['bom']=='efbbbf', 'Z2y CSV/BOM FAIL: '+json.dumps(d); assert d['imaFizicna'] and d['imaDelta'] and d['imaZapiski'], 'Z2y stolpci FAIL: '+json.dumps(d); assert d['vrstic']>=2, 'Z2y premalo vrstic: '+json.dumps(d); assert d['bajtov']>60, 'Z2y prekratek CSV: '+json.dumps(d); assert d['err'] is None, 'Z2y err: '+json.dumps(d); print('Z2y OK — zapisni list CSV ŽIVO (' + str(d['bajtov']) + ' bajtov, BOM efbbbf, ' + str(d['vrstic']) + ' vrstic — pariteta R186 + prazni fizični stolpci)')" || exit 1
agent-browser screenshot "$SS/qa-r285-e2e-zapisni-csv.png" > /dev/null 2>&1'''
src = src.replace(anchor_z2z, Z2Y_BLOCK)
# Z2z živi label → regresija poimenovanje (ostaja Z2z; Z2y je nova)
write(S + '/r285-e2e-browser.sh', src)

print('OK — r285 skripte generirane')
