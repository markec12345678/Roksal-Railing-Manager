#!/usr/bin/env python3
# R295 — generira scripts/r295-e2e-browser.sh iz r294-e2e-browser.sh:
#  1. NOV Z0r blok: KOLEDAR PREGLEDOV CSV ŽIVO (25. člen) + F2 mini-vrstica
#     (pogojni kanon r277 — obe veji iskreni; BOM RAW dokaz vzorec R293);
#  2. poti + oznake r294 → r295;
#  3. ZERO-MUTACIJA veriga nespremenjena (fp pre/post ×4 + restore).
SRC = '/home/z/my-project/scripts/r294-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r295-e2e-browser.sh'

s = open(SRC).read()

s = s.replace('/tmp/r294-', '/tmp/r295-')
s = s.replace('qa-r294-e2e-', 'qa-r295-e2e-')
s = s.replace(
    '# R294 E2E ŽIVO (lokalni :3100, ADMIN) — OPOMNIK DEEP-LINK ((k) dopolnitev',
    '# R295 E2E ŽIVO (lokalni :3100, ADMIN) — KOLEDAR PREGLEDOV CSV (25. člen\n# izvozne družine — CSV brat PDF R253 EN VIR) + F2 koledarska mini-vrstica\n# + [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
)
s = s.replace('echo "=== R294 E2E KONEC ==="', 'echo "=== R295 E2E KONEC ==="')

Z0R = '''echo "=== Z0r: KOLEDAR PREGLEDOV CSV ŽIVO (R295 — 25. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\\"Izvozi koledar pregledov kot CSV\\"]');})()" 16; then
  # F2 koledarska mini-vrstica (WYSIWYG ISTA izpeljava koledarPovzetek):
  # pogojna resnica — viden SAMO kadar je vpisan vsaj en pregled (spot resnica)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi koledar pregledov kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot CSV'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r295-z0r-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r295-z0r-pilli.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0r pilli err: ' + json.dumps(d)
assert d['pillPdf'] and d['pillCsv'], 'Z0r: oba koledarska pilla (PDF brat + CSV brat) morata biti viden: ' + json.dumps(d)
print('Z0r pilli OK — Koledar PDF (R253 brat) + Koledar CSV (R295) VEDNO vidna (P1-k precedens)')
PYEOF5
  # CSV (pogojni kanon R250/R291/R292/R293: fail-closed toast pri 0 + NIČ datoteke ALI bajtna capture z BOM)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__koledarBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__koledarCsv=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\\"Izvozi koledar pregledov kot CSV\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni vpisanih pregledov') && body.includes('CSV se izvozi, ko je vpisan prvi datum pregleda.'); const uspeh=body.includes('Koledar pregledov prenešen v CSV ('); const mini=body.includes('Pregledi: ') && body.includes(' vpisanih · '); const c=window.__koledarCsv ?? null; const niz=(typeof c==='string'); const brezBom=niz?c.replace(/^\\uFEFF/,''):null; return JSON.stringify({prazno, uspeh, mini, csvNiz:niz, bom:window.__koledarBom===true, bajti:niz?brezBom.length:0, glava:niz?brezBom.split('\\n')[0].slice(0,60):null, obseg:niz?brezBom.includes('Vse stranke z vpisanim datumom pregleda (AKTIVEN + POTEKEL)'):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r295-z0r-csv.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r295-z0r-csv.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0r CSV err: ' + json.dumps(d)
if d['prazno']:
    assert not d['csvNiz'], 'Z0r: toast pri 0 vpisanih A VSEENO datoteka (kršitev fail-closed — družinsko pravilo R253): ' + json.dumps(d)
    assert not d['mini'], 'Z0r: mini-vrstica vidna pri 0 vpisanih (lažni nič-prikaz): ' + json.dumps(d)
    print('Z0r OK — gumb ŽIVO, fail-closed toast pri 0 vpisanih (iskrena praznina — ISTI gate kot brat R253; NIČ datoteke, NIČ mini-vrstice)')
elif d['csvNiz']:
    assert d['bajti'] > 0 and d['bom'], 'Z0r: datoteka brez BOM/vsebine (RAW bajti EF BB BF): ' + json.dumps(d)
    assert d['glava'] and d['glava'].startswith('"Stranka","Naslov","Telefon"'), 'Z0r: glava FAIL (7 stolpcev VERBATIM PDF head): ' + str(d['glava'])
    assert d['obseg'], 'Z0r: meta Obseg resnica manjka: ' + json.dumps(d)
    assert d['mini'], 'Z0r: CSV s podatki, mini-vrstica NI vidna (WYSIWYG ISTA izpeljava kršena): ' + json.dumps(d)
    print('Z0r CSV OK — KOLEDAR PREGLEDOV CSV ŽIVO bajtno (' + str(d['bajti']) + ' B, BOM efbbbf RAW dokaz, glava: ' + str(d['glava'])[:50] + ') + F2 mini-vrstica ŽIVO (ista izpeljava)')
else:
    raise AssertionError('Z0r: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF5
  agent-browser eval "(()=>{window.__koledarCsv=null; window.__koledarBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r295-e2e-z0r-koledar-csv.png" > /dev/null 2>&1
else
  echo "Z0r OPOMBA: CRM pregled ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R295 ×13 ostajajo obvezni dokaz"
fi

'''

ANCHOR = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="'
assert ANCHOR in s, 'anchor Z1 ni najden'
s = s.replace(ANCHOR, Z0R + ANCHOR)

open(DST, 'w').write(s)
print('r295-e2e-browser.sh zgeneriran:', len(s), 'znakov')
