#!/usr/bin/env python3
# R328 — derive r328-e2e-browser.sh iz r327 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE;
# LEKCIJA R327 4: zamenjave na fragmentih BREZ backslash-escapov).
# Transformacije:
#   1. Glava: Z0au opis + NOVI Z0av opis (55. člen — live podatki + restore)
#   2. Generacijske poti: /tmp/r327- ×146 → /tmp/r328- (+ R327-server ×1)
#   3. NOVI Z0av blok — splice PO Z0au screenshot vrstici (anchor brez
#      backslashov): r328-cena-tmp.cjs raise → re-dispatch → zgodovina +
#      dobavitelji panel ŽIVO s podatki → CSV capture ×2 (DETERMINIZEM
#      ŽIVO NA BAJTIH) → bajtno točne vrstice → restore → prazna veja ZNOVA
#   4. Screenshot + Footer R327 → R328
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r327-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r328-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0av opis PO Z0au ──
zam('''#         wire-level GET: 200 + pregled.pari 0 + vir niz ŽIVO;
#         ZERO-MUTACIJA (samo GET dispeči);''',
'''#         wire-level GET: 200 + pregled.pari 0 + vir niz ŽIVO;
#         ZERO-MUTACIJA (samo GET dispeči);
#   Z0av: PRIMERJAVA DOBAVITELJEV ŽIVO S PODATKI (R328 NOVO — 55. člen
#         issue #1 §5, supplier comparison): r328-cena-tmp.cjs raise
#         (determinističen seed — WPC-120-A: zaprt 10.00 → odprt 12.50 pri
#         'R328-TMP-DOBAVITELJ (E2E)'; fiksni ISO časi) → zgodovina panel
#         + NOVI pod panel CenaDobaviteljiPanel ŽIVO s podatki → CSV izvoz
#         ×2 (bajtna determinizem ŽIVO) → restore → iskrena prazna veja
#         ZNOVA (ZERO-MUTACIJA končnega stanja — restore guard prešteje);''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r327-', '/tmp/r328-', 146)
zam('/tmp/R327-server', '/tmp/R328-server', 1)

# ── 3. NOVI Z0av blok — splice PO Z0au screenshot vrstici ──
Z0AV = r'''

echo "=== Z0av: PRIMERJAVA DOBAVITELJEV ŽIVO S PODATKI (R328 — 55. člen issue #1 §5: supplier comparison; determinističen seed + restore; ZERO-MUTACIJA končnega stanja) ==="
# r328-cena-tmp.cjs raise → lokalna DB dobi ZAČASNO zgodovino (WPC-120-A:
# zaprt 10.00 → odprt 12.50 pri 'R328-TMP-DOBAVITELJ (E2E)'; fiksni ISO
# časi) → re-dispatch (measurements → inventory — prisiljen re-mount) →
# panel zgodovine ŽIVO s podatki (dobavitelj + delta '+2.50 EUR') + NOVI
# pod panel Primerjava dobaviteljev ŽIVO (EN dobavitelj: materialov 1,
# vpisov 2, narašča 1, razpon 12.50/12.50) → CSV izvoz ujet prek
# URL.createObjectURL patcha (Z0as/Z0ar kanon) ×2 klikov → BAJTNO točen
# CSV (glave EN VIR + podatkovna vrstica + meta Sklep/Vir; filename kanon
# v unit testih) → restore → re-dispatch → iskrena prazna veja ZNOVA
# (dobavitelji panel ODSOTEN + gumbi SKRITI — ODTIS pre==post; ZERO-
# MUTACIJA končnega stanja: restore guard prešteje točno 2 cene).
node scripts/r328-cena-tmp.cjs raise || exit 1
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('[data-testid=\"cena-dobavitelji-dokaz\"]');})()" 24
eb_cakaj 2
agent-browser eval "JSON.stringify({zgo:!!document.querySelector('[data-testid=\"cena-zgodovina-dokaz\"]'), dob:!!document.querySelector('[data-testid=\"cena-dobavitelji-dokaz\"]'), dobavitelj:(document.body.textContent||'').includes('R328-TMP-DOBAVITELJ (E2E)'), delta:(document.body.textContent||'').includes('+2.50 EUR'), razpon:(document.body.textContent||'').includes('12.50'), err:window.__err??null})" 2>&1 | tail -1 > /tmp/r328-z0av-ui.json
python3 - <<'PYEOFZ0AV' || exit 1
import json
raw = open('/tmp/r328-z0av-ui.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['zgo'] is True, 'Z0av zgodovina panel FAIL: ' + json.dumps(d)
assert d['dob'] is True, 'Z0av dobavitelji panel FAIL (55. člen — pod panel montiran ob podatkih): ' + json.dumps(d)
assert d['dobavitelj'] is True, 'Z0av dobavitelj naziv FAIL: ' + json.dumps(d)
assert d['delta'] is True, 'Z0av delta +2.50 EUR FAIL (smer narašča iz zgodovine): ' + json.dumps(d)
assert d['razpon'] is True, 'Z0av razpon 12.50 FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z0av err: ' + json.dumps(d)
print('Z0av UI OK — zgodovina + primerjava dobaviteljev ŽIVO s podatki (55. člen; determinističen seed)')
PYEOFZ0AV
agent-browser screenshot "$SS/qa-r328-e2e-z0av-dobavitelji-zivo.png" > /dev/null 2>&1
agent-browser eval "(()=>{window.__zdobcsvblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__zdobcsvblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi primerjavo dobaviteljev kot CSV"
eb_cakaj 3
eb_klik_gumb "Izvozi primerjavo dobaviteljev kot CSV"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__zdobcsvblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} const magija=String.fromCharCode(u1[0],u1[1],u1[2]); const besedilo=new TextDecoder('utf-8').decode(await blobi[0].arrayBuffer()); const vrstice=besedilo.split('\\r\\n'); return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:magija, mime:blobi[0].type||null, bajtnoEnako:enako, glava:vrstice[0]??null, vrstica:vrstice.find(v=>v.startsWith('R328-TMP-DOBAVITELJ'))??null, sklepVrstica:vrstice.find(v=>v.startsWith('Sklep;'))??null, virVrstica:vrstice.find(v=>v.startsWith('Vir;'))??null, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r328-z0av-csv.json
python3 - <<'PYEOFZ0AVCSV' || exit 1
import json
raw = open('/tmp/r328-z0av-csv.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0av parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0av blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == 'ï»¿', 'Z0av BOM magija FAIL (formatna resnica — UTF-8 BOM bajti EF BB BF): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0av MIME FAIL: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0av DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (toCsv kanon + posredovan pregled): ' + json.dumps(d)
assert d['glava'] == 'Dobavitelj;Materialov;Cenovnih vpisov;Narašča;Pada;Stabilna;Prvi vpis;Najnižja trenutna cena EUR;Najvišja trenutna cena EUR', 'Z0av glave EN VIR FAIL: ' + json.dumps(d.get('glava'))
assert d['vrstica'] == 'R328-TMP-DOBAVITELJ (E2E);1;2;1;0;0;0;12.50;12.50', 'Z0av podatkovna vrstica FAIL (števci + razpon deterministično): ' + json.dumps(d.get('vrstica'))
assert d['sklepVrstica'] == 'Sklep;1 dobaviteljev, 1 parov material × dobavitelj, 1 narašča', 'Z0av sklep vrstica FAIL (EN VIR — iskren števec): ' + json.dumps(d.get('sklepVrstica'))
assert d['virVrstica'] == 'Vir;PRIMERJAVA_DOBAVITELJEV — isti HEAD = bajtno identičen izvoz', 'Z0av Vir niz FAIL: ' + json.dumps(d.get('virVrstica'))
assert d['err'] is None, 'Z0av err: ' + json.dumps(d)
print('Z0av CSV OK — primerjava dobaviteljev izvoz ŽIVO: BOM + MIME + glave EN VIR + vrstica + Vir niz + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (55. člen; ZERO-MUTACIJA)')
PYEOFZ0AVCSV
node scripts/r328-cena-tmp.cjs restore || exit 1
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('[data-testid=\"cena-zgodovina-dokaz\"]');})()" 24
eb_cakaj 2
agent-browser eval "JSON.stringify({zgo:!!document.querySelector('[data-testid=\"cena-zgodovina-dokaz\"]'), dobOdsoten:!document.querySelector('[data-testid=\"cena-dobavitelji-dokaz\"]'), prazna:(document.querySelector('[data-testid=\"cena-zgodovina-dokaz\"]')?.textContent||'').includes('Ni še zabeleženih cen'), gumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi zgodovino cen materiala kot CSV')), pdfGumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi zgodovino cen materiala kot PDF')), dobGumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi primerjavo dobaviteljev kot CSV')), err:window.__err??null})" 2>&1 | tail -1 > /tmp/r328-z0av-odtis.json
python3 - <<'PYEOFZ0AVODT' || exit 1
import json
raw = open('/tmp/r328-z0av-odtis.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['zgo'] is True, 'Z0av ODTIS zgodovina panel FAIL: ' + json.dumps(d)
assert d['dobOdsoten'] is True, 'Z0av ODTIS dobavitelji panel ODSOTEN FAIL (iskrena ničelna veja ZNOVA — brez parov NI primerjave): ' + json.dumps(d)
assert d['prazna'] is True, 'Z0av ODTIS prazna veja FAIL: ' + json.dumps(d)
assert d['gumbSkrit'] is True, 'Z0av ODTIS CSV gumb SKRIT FAIL: ' + json.dumps(d)
assert d['pdfGumbSkrit'] is True, 'Z0av ODTIS PDF gumb SKRIT FAIL: ' + json.dumps(d)
assert d['dobGumbSkrit'] is True, 'Z0av ODTIS dobavitelji CSV gumb SKRIT FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z0av ODTIS err: ' + json.dumps(d)
print('Z0av ODTIS OK — po restore iskrena prazna veja ZNOVA (3 izvozna gumba SKRITA + panel odsoten; ZERO-MUTACIJA končnega stanja)')
PYEOFZ0AVODT
agent-browser screenshot "$SS/qa-r328-e2e-z0av-odtis-prazna-veja.png" > /dev/null 2>&1

'''
zam('agent-browser screenshot "$SS/qa-r327-e2e-z0au-zgodovina-cen.png" > /dev/null 2>&1',
    'agent-browser screenshot "$SS/qa-r328-e2e-z0au-zgodovina-cen.png" > /dev/null 2>&1' + Z0AV, 1)

# ── 4. Footer ──
zam('echo "=== R327 E2E KONEC ==="', 'echo "=== R328 E2E KONEC ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r328-e2e-browser.sh zapisan ({len(text)} znakov)')
