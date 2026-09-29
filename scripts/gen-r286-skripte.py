#!/usr/bin/env python3
# R286 — generator r286-{build-needles,run-smoke,e2e-browser}.sh iz r285
# vzorca (kanon: gen-* pišejo NOVE datoteke, ne patchajo izvornih;
# surgical replace + assert anchorji — r284 lekcija 2: NIKOLI ponovni
# zagon drugega generatorja nad ISTO datoteko).
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


# ---------- 1) r286-build-needles.sh ----------
src = read(S + '/r285-build-needles.sh')
src = src.replace(
    "# R285 — build needleji: (0) TERENSKI ZAPISNI LIST CSV (issue #15 §3,\n"
    "# worklog i5b — DIGITALNO izpolnjevanje v Excelu: ISTA zapisana resnica +\n"
    "# ISTI prazni fizični stolpci fizicna_ref_mm/delta_mm/zapiski_terena;\n"
    "# pariteta R186 arhiva PO KONSTRUKCIJI — EN VIR meritevVrstica; Y1–Y8);",
    "# R286 — build needleji: (0) INVENTURA — PREMOŽENJSKI PREGLED CSV (P1-f\n"
    "# (f), 30. člen 'izvozi' družine: ISTA resnica kot R270 PDF, drug medij —\n"
    "# Excel/računovodski uvoz; EN VIR inventuraPregled — pariteta PO\n"
    "# KONSTRUKCIJI, 8 R270 tabelnih + id/Premiki/Izvoženo = 11; F1–F6);\n"
    "#       + ISSUE #15 §12 dokaz (testna družina r286-ar-depth-izkljucitev\n"
    "#       ×11 — vitest pin, docs/AR-FIELD-VALIDATION.md §11 — NI build\n"
    "#       površine, zato NI needleja: surov Depth = odsotnost na žici);",
)
src = src.replace('OUT=/tmp/r285-build-chunks', 'OUT=/tmp/r286-build-chunks')
ANCHOR_BN = 'need_static "Zapisni list prenešen v CSV" "R285 uspeh toast (WYSIWYG)"'
assert ANCHOR_BN in src, 'build-needles R285 anchor manjka'
R286_BLOCK_BN = ANCHOR_BN + '''
echo "--- R286 MANDATORY — INVENTURA PREGLED CSV (P1-f (f), 30. člen) ---"
need_static "inventuraPregledCsvVrstice" "R286 CSV lib graditelj (EN VIR inventuraPregled)"
need_static '["id","Premiki","Izvoženo"]' "R286 dodatni stolpci verbatim (kontrakt 8+3=11 — vitest pin; INVENTURA_CSV_STOLPCEV je test-only — tree-shaken)"
need_static "inventuraPregledCsvFilename" "R286 ime datoteke (pariteta R270 stem)"
need_static "inventuraPregledCsv: pričakovan veljaven now: Date" "R286 lib fail-closed now (F4)"
echo "--- R286 MANDATORY STIL — CSV gumb + legenda (kanon R280–R285) ---"
need_static "Izvozi inventurni pregled premoženja kot CSV" "R286 gumb aria-label"
need_static "Inventura CSV = ista resnica kot PDF v Excelu" "R286 legenda (pariteta R285 legenda)"
need_static "Inventurni pregled (CSV) se izvozi, ko je vpisan prvi artikel" "R286 iskren toast opis (F3 — NI prazne datoteke)"
need_static "Inventurni pregled premoženja prenešen v CSV" "R286 uspeh toast (WYSIWYG)"'''
src = src.replace(ANCHOR_BN, R286_BLOCK_BN)
ANCHOR_MM = 'must_miss "TODO-R285" "R285 — brez razvojnih ostankov"'
assert ANCHOR_MM in src, 'must_miss R285 anchor manjka'
src = src.replace(ANCHOR_MM, ANCHOR_MM + '\nmust_miss "TODO-R286" "R286 — brez razvojnih ostankov"')
src = src.replace(
    'echo "NEEDLE FAIL=$FAIL (R285 ×11 novih; R284 ×16 novih;',
    'echo "NEEDLE FAIL=$FAIL (R286 ×8 novih; R285 ×11 novih; R284 ×16 novih;',
)
write(S + '/r286-build-needles.sh', src)

# ---------- 2) r286-run-smoke.sh ----------
src = read(S + '/r285-run-smoke.sh')
src = src.replace('# R285 dimni test (vzorec r273)', '# R286 dimni test (vzorec r273)')
src = src.replace(
    '# build z R285 spremembami (TERENSKI ZAPISNI LIST PDF — issue #15 §3 fill-in\n'
    '# resnica + MANDATORY STIL gumb/legenda/bulk-toggle — kontrakt in core NIČ)',
    '# build z R286 spremembami (INVENTURA PREGLED CSV — P1-f (f), 30. člen:\n'
    '# ISTA resnica kot R270 PDF v Excelu + ISSUE #15 §12 dokaz — vitest pin;\n'
    '# kontrakt in core NIČ)',
)
src = src.replace('R285-server-smoke.log', 'R286-server-smoke.log')
src = src.replace('R285-smoke-lokalni-sekret', 'R286-smoke-lokalni-sekret')
src = src.replace('echo "--- R285 SMOKE KONEC ---"', 'echo "--- R286 SMOKE KONEC ---"')
write(S + '/r286-run-smoke.sh', src)

# ---------- 3) r286-e2e-browser.sh ----------
src = read(S + '/r285-e2e-browser.sh')
src = src.replace('/tmp/r285-', '/tmp/r286-')
src = src.replace('R285-server-e2e.log', 'R286-server-e2e.log')
src = src.replace('R285-e2e-lokalni-sekret', 'R286-e2e-lokalni-sekret')
src = src.replace(
    '# R285 E2E ŽIVO (lokalni :3100, ADMIN) — TERENSKI ZAPISNI LIST CSV + ISSUE #15 §1 referenčni testni',
    '# R286 E2E ŽIVO (lokalni :3100, ADMIN) — INVENTURA PREGLED CSV (30. člen) + TERENSKI ZAPISNI LIST CSV + ISSUE #15 §1 referenčni testni',
)
src = src.replace('echo "=== R285 E2E KONEC ==="', 'echo "=== R286 E2E KONEC ==="')
src = src.replace('qa-r285-', 'qa-r286-')
# header: dodaj Z2x v opis (za Z2y vrstico)
ANCHOR_H = '#   Z2y: ZAPISNI LIST CSV ŽIVO — digitalno izpolnjevanje (issue #15 §3, R285):'
assert ANCHOR_H in src, 'e2e header anchor manjka'
src = src.replace(
    ANCHOR_H,
    "#   Z2x: INVENTURA PREGLED CSV ŽIVO — 30. člen 'izvozi' družine (R286):\n"
    '#        gumb → toast "Inventurni pregled premoženja prenešen v CSV" +\n'
    '#        BOM efbbbf + glava 11 stolpcev (Šifra…Status + id/Premiki/Izvoženo);\n' + ANCHOR_H,
)
# Z2x block: vstavimo PRED Z2y (inventura je neodvisna od meritev tab —
# potrebujemo inventory tab dispatch + klik + zajem CSV)
ANCHOR_Z2Y = 'echo "=== Z2y: TERENSKI ZAPISNI LIST CSV ŽIVO — digitalno izpolnjevanje (R285) ==="'
assert ANCHOR_Z2Y in src, 'Z2y anchor manjka'
Z2X_BLOCK = '''echo "=== Z2x: INVENTURA PREGLED CSV ŽIVO — 30. člen izvozne družine (R286) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\\"Izvozi inventurni pregled premoženja kot CSV\\"]');})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const gumb=document.querySelector('button[aria-label=\\"Izvozi inventurni pregled premoženja kot CSV\\"]'); const legenda=[...document.querySelectorAll('p')].some(p=>p.textContent.startsWith('Inventura CSV = ista resnica kot PDF v Excelu')); return JSON.stringify({gumb:!!gumb, title:gumb?(gumb.getAttribute('title')||'').startsWith('Inventurni pregled premoženja kot CSV'):false, legenda, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z2x-ui.json
python3 -c "import json; r=json.load(open('/tmp/r286-z2x-ui.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['gumb'] and d['title'] and d['legenda'], 'Z2x UI FAIL: '+json.dumps(d); assert d['err'] is None, 'Z2x err: '+json.dumps(d); print('Z2x UI OK — gumb + hover title + legenda ŽIVO (30. člen, kanon R280–R285)')" || exit 1
eb_zajem_pdf val286csv
eb_klik_gumb "Izvozi inventurni pregled premoženja kot CSV"
eb_pocakaj_tekst "Inventurni pregled premoženja prenešen v CSV" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val286csv; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({csv:false, err:window.__err??null}); const bin=atob(b64); const bom=bin.charCodeAt(0).toString(16)+bin.charCodeAt(1).toString(16)+bin.charCodeAt(2).toString(16); let vrs=0; for(let i=0;i<bin.length;i++){ if(bin.charCodeAt(i)===10) vrs++; } return JSON.stringify({csv:true, bom, bajtov:bin.length, vrstic:vrs, glava:bin.includes('"Naziv"')&&bin.includes('"Status"')&&bin.includes('"Enota"'), dodatni:bin.includes('"id"')&&bin.includes('"Premiki"'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z2x.json
python3 -c "import json; r=json.load(open('/tmp/r286-z2x.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['csv'] and d['bom']=='efbbbf', 'Z2x CSV/BOM FAIL: '+json.dumps(d); assert d['glava'] and d['dodatni'], 'Z2x stolpci FAIL (ASCII needleji — atob UTF-8 je 2-bajtni za Š/ž, kanon r285): '+json.dumps(d); assert d['vrstic']>=2, 'Z2x premalo vrstic: '+json.dumps(d); assert d['bajtov']>60, 'Z2x prekratek CSV: '+json.dumps(d); assert d['err'] is None, 'Z2x err: '+json.dumps(d); print('Z2x OK — inventura CSV ŽIVO (' + str(d['bajtov']) + ' bajtov, BOM efbbbf, ' + str(d['vrstic']) + ' vrstic — pariteta R270 po konstrukciji + 3 dodatni stolpci)')" || exit 1
agent-browser screenshot "$SS/qa-r286-e2e-inventura-csv.png" > /dev/null 2>&1
# VRNITEV na measurements tab (Z2b/Z2z/Z2y kontekst — r285 tok se nadaljuje nespremenjen):
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\\"Izvozi terenski pregled meritev kot PDF\\"]');})()" 24
eb_cakaj 1

''' + ANCHOR_Z2Y
src = src.replace(ANCHOR_Z2Y, Z2X_BLOCK)
write(S + '/r286-e2e-browser.sh', src)

print('R286 skripte zgenerirane.')
