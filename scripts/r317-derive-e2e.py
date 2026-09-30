#!/usr/bin/env python3
# R317 — derive r317-e2e-browser.sh iz r316-e2e-browser.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed: napačno
# število POJAVITEV → izpisek + exit 1; kalibracija na POJAVITVE — lekcija
# R312/R314/R315/R316).
# Transformacije:
#   1. Glava: NOV Z0ao opomba (izvoz avtomatizacijskega audita kot CSV —
#      47. člen)
#   2. Generacijske poti: /tmp/r316- → /tmp/r317- (121), sekret, marker id,
#      screenshot qa-r316 → qa-r317, server log, E2E KONEC label
#   3. Z0ao blok: splice PO Z0an screenshot vrstici (izvoz CSV ŽIVO — glave/
#      11 območij/sklep EN VIR + DETERMINIZEM: dva izvoza bajtno enaka)
#   4. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r316-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r317-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0ao opomba (pred Z0an vnosom) ──
zam('#   Z0an: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT JSON ŽIVO (R316 NOVO —',
    '#   Z0ao: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT CSV ŽIVO (R317 NOVO —\n'
    '#         47. člen issue #1, IZVOZI družina): gumb v avtomatizacija-dokaz\n'
    '#         bloku → deterministični CSV (BOM + glave + 11 območij + sklep\n'
    '#         WYSIWYG) + DETERMINIZEM ŽIVO (dva izvoza bajtno enaka) — EN\n'
    '#         VIR izvoz, ZERO-MUTACIJA;\n'
    '#   Z0an: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT JSON ŽIVO (R316 NOVO —')

# ── 2. Generacijske poti + oznake (PRED spliceom — Z0ao nosi r317 poti) ──
# 130 = /tmp/r316- POJAVITVE (ne vrstice! rg -c šteje vrstice 121 — lekcija
# R312/R314/R315/R316 PETIČ potrjena: kalibracija na pojavitve)
zam('/tmp/r316-', '/tmp/r317-', 130)
zam('r316-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r317-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('/tmp/R316-server-e2e.log', '/tmp/R317-server-e2e.log', 1)
zam('e2e-r316-ne-obstojeci-id', 'e2e-r317-ne-obstojeci-id', 1)
zam('echo "=== R316 E2E KONEC ==="', 'echo "=== R317 E2E KONEC ==="', 1)
zam('qa-r316', 'qa-r317', 3)

# ── 3. Z0ao blok: splice PO (preimenovani) Z0an screenshot vrstici ──
SIDRO = 'agent-browser screenshot "$SS/qa-r317-e2e-z0an-izvoz-json.png" > /dev/null 2>&1\n'
Z0AO = '''agent-browser screenshot "$SS/qa-r317-e2e-z0an-izvoz-json.png" > /dev/null 2>&1

echo "=== Z0ao: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT CSV ŽIVO (R317 — 47. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Avtomatizacija blok → gumb [aria-label="Izvozi avtomatizacijski audit kot
# CSV"] → blob ujet prek URL.createObjectURL patcha (eb_csv_capture kanon) →
# razčleni v brskalniku → BOM/glave/11 območij/sklep = ISTA EN VIR resnica
# kot zaslon (Z0al) + vitest (r317-avtomatizacija-audit-csv). DETERMINIZEM
# ŽIVO: dva izvoza = bajtno identična vsebina (kanon Z0an, 46. člen).
# ZERO-MUTACIJA: samo klik izvoza (nič db zapisa).
agent-browser eval "(()=>{window.__auditcsv1=null; window.__auditcsv2=null; window.__auditblobi=[]; window.__auditbom=null; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__auditblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_csv_capture auditcsv1
eb_klik_gumb "Izvozi avtomatizacijski audit kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__auditcsv1==='string' && window.__auditcsv1.length>200;})()" 12
eb_csv_capture auditcsv2
eb_klik_gumb "Izvozi avtomatizacijski audit kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__auditcsv2==='string' && window.__auditcsv2.length>200;})()" 12
# BOM iz BAJTOV (LEKCIJA R317: new Response(b).text() BOM odstrani —
# capture plast; bajti bloba ostanejo — kanon RFC 4180/BOM preverba na
# BAJTIH, ne na dekodiranem besedilu).
agent-browser eval "((async()=>{try{const blobi=window.__auditblobi??[]; if(blobi.length===0){window.__auditbom=false; return 'brez blobov';} const u8=new Uint8Array(await blobi[0].arrayBuffer()); window.__auditbom=(u8[0]===0xEF&&u8[1]===0xBB&&u8[2]===0xBF); window.__auditmime=blobi[0].type||null; return 'bajti';}catch(e){window.__auditbom=false; window.__auditmime='NAPAKA: '+String(e); return 'napaka';}})())" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return window.__auditbom!==null;})()" 8
agent-browser eval "(()=>{try{const a=window.__auditcsv1, b=window.__auditcsv2; const vrstice=a.split('\\r\\n').filter(v=>v.length>0); const glava=vrstice[0]; const obmocija=vrstice.filter(v=>v.startsWith('§')); const sklepVrstica=vrstice.find(v=>v.startsWith('Sklep;')); const virVrstica=vrstice.find(v=>v.startsWith('Vir;')); return JSON.stringify({bajtnoEnako:a===b, bom:window.__auditbom===true, mime:window.__auditmime??null, stBlobov:(window.__auditblobi??[]).length, vrstic:vrstice.length, glava, stObmocij:obmocija.length, nizObmocij:obmocija.map(v=>v.split(';')[0]).join('|'), sklepPrisoten:!!sklepVrstica, virPrisoten:!!virVrstica, sklepAI:!!sklepVrstica&&sklepVrstica.includes('AI-OBVEZNO: 0 — jedro deluje brez AI'), err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})()" 2>&1 | tail -1 > /tmp/r317-z0ao.json
python3 - <<'PYEOFZ0AO' || exit 1
import json
raw = open('/tmp/r317-z0ao.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0ao parse FAIL: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0ao DETERMINIZEM FAIL — dva izvoza nista bajtno enaka'
assert d['bom'] is True, 'Z0ao BOM FAIL (kanon R136): ' + json.dumps(d)
assert d['glava'] == 'Območje;Razred;Implementacije;Dokazi (testi);Opomba', 'Z0ao glave FAIL: ' + json.dumps(d)
assert d['stObmocij'] == 11, 'Z0ao območja FAIL: ' + json.dumps(d)
assert d['nizObmocij'] == '§1 Photo/VIZ|§2 Measurements|§3 Railing/product configuration|§4 Calculator / quotation|§5 Inventory / suppliers / orders|§6 Documents|§7 Installation / scheduling|§8 Customer portal|§9 Security|§10 Mobile/PWA/offline|§11 AI fallback architecture', 'Z0ao vrstni red območij FAIL (EN VIR — nič prerazporejanja): ' + json.dumps(d)
assert d['sklepPrisoten'] and d['virPrisoten'] and d['sklepAI'], 'Z0ao sklep meta FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0ao blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['err'] is None, 'Z0ao err: ' + json.dumps(d)
print('Z0ao OK — izvoz avtomatizacijskega audita CSV ŽIVO: BOM + glave WYSIWYG + 11 območij (vrstni red = audit) + sklep EN VIR + DETERMINIZEM (dva izvoza bajtno enaka) (47. člen; ZERO-MUTACIJA)')
PYEOFZ0AO
agent-browser screenshot "$SS/qa-r317-e2e-z0ao-izvoz-audit-csv.png" > /dev/null 2>&1
'''
n = text.count(SIDRO)
if n != 1:
    print(f'FAIL-CLOSED: Z0an screenshot sidro najdeno {n}× (pričakovano 1)')
    sys.exit(1)
text = text.replace(SIDRO, Z0AO)

# ── 4. Izhodna-stran asercija ──
assert 'Z0ao' in text and 'qa-r317-e2e-z0ao-izvoz-audit-csv.png' in text
for ostarelo in ('/tmp/r316-', 'qa-r316', 'r316-e2e-lokalni-sekret', 'R316 E2E KONEC'):
    if ostarelo in text:
        print(f'FAIL-CLOSED: ostalo {ostarelo!r} v izhodu')
        sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print(f'r317-e2e-browser.sh zapisan ({len(text.splitlines())} vrstic)')
