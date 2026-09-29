#!/usr/bin/env python3
# R296 — generira scripts/r296-e2e-browser.sh iz r295-e2e-browser.sh:
#  1. NOV Z0s blok: KOLEDAR PREGLEDOV ICS ŽIVO (26. člen) — trije pilli
#     (PDF/CSV/ICS) VEDNO vidni + ICS bajtna capture (BREZ BOM RAW dokaz,
#     BEGIN:VCALENDAR, CRLF, X-ROKSAL-STATUS) — pogojni kanon r277 (obe
#     veji iskreni);
#  2. poti + oznake r295 → r296;
#  3. ZERO-MUTACIJA veriga nespremenjena (fp pre/post ×4 + restore).
SRC = '/home/z/my-project/scripts/r295-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r296-e2e-browser.sh'

s = open(SRC).read()

s = s.replace('/tmp/r295-', '/tmp/r296-')
s = s.replace('qa-r295-e2e-', 'qa-r296-e2e-')
s = s.replace(
    '# R295 E2E ŽIVO (lokalni :3100, ADMIN) — KOLEDAR PREGLEDOV CSV (25. člen\n# izvozne družine — CSV brat PDF R253 EN VIR) + F2 koledarska mini-vrstica\n# + [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
    '# R296 E2E ŽIVO (lokalni :3100, ADMIN) — KOLEDAR PREGLEDOV ICS (26. člen\n# izvozne družine — ICS brat PDF R253 + CSV R295 EN VIR; RFC 5545 CRLF/brez\n# BOM) + [kombinirano z R295] KOLEDAR CSV + F2 mini-vrstica\n# + [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
)
s = s.replace('echo "=== R295 E2E KONEC ==="', 'echo "=== R296 E2E KONEC ==="')

Z0S = '''echo "=== Z0s: KOLEDAR PREGLEDOV ICS ŽIVO (R296 — 26. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\\"Izvozi koledar pregledov kot ICS\\"]');})()" 16; then
  # trije koledarski pilli (PDF brat R253 + CSV brat R295 + ICS brat R296):
  # VEDNO vidni (P1-k precedens)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi koledar pregledov kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot CSV'), pillIcs:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot ICS'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r296-z0s-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r296-z0s-pilli.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0s pilli err: ' + json.dumps(d)
assert d['pillPdf'] and d['pillCsv'] and d['pillIcs'], 'Z0s: vsi trije koledarski pilli (PDF + CSV + ICS) morajo biti vidni: ' + json.dumps(d)
print('Z0s pilli OK — Koledar PDF (R253) + Koledar CSV (R295) + Koledar ICS (R296) VEDNO vidni (P1-k precedens)')
PYEOF5
  # ICS (pogojni kanon R250/R291/R292/R293/R295: fail-closed toast pri 0 + NIČ datoteke ALI bajtna capture brez BOM)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__koledarIcsBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__koledarIcs=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\\"Izvozi koledar pregledov kot ICS\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni vpisanih pregledov') && body.includes('ICS se izvozi, ko je vpisan prvi datum pregleda.'); const uspeh=body.includes('Koledar pregledov prenešen v ICS ('); const c=window.__koledarIcs ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, icsNiz:niz, bom:window.__koledarIcsBom===true, bajti:niz?c.length:0, glava:niz?c.slice(0,40):null, crlf:niz?c.includes('\\\\r\\\\n'):null, xstatus:niz?c.includes('X-ROKSAL-STATUS:'):null, konec:niz?c.trimEnd().endsWith('END:VCALENDAR'):null, dogodki:niz?(c.match(/BEGIN:VEVENT/g)||[]).length:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r296-z0s-ics.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r296-z0s-ics.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0s ICS err: ' + json.dumps(d)
if d['prazno']:
    assert not d['icsNiz'], 'Z0s: toast pri 0 vpisanih A VSEENO datoteka (kršitev fail-closed — družinsko pravilo R253): ' + json.dumps(d)
    print('Z0s OK — gumb ŽIVO, fail-closed toast pri 0 vpisanih (iskrena praznina — ISTI gate kot brata R253/R295; NIČ datoteke)')
elif d['icsNiz']:
    assert d['bajti'] > 0 and not d['bom'], 'Z0s: datoteka z BOM/prazna (ICS = BREZ BOM — RFC 5545, RAW dokaz): ' + json.dumps(d)
    assert d['glava'] and d['glava'].startswith('BEGIN:VCALENDAR'), 'Z0s: glava FAIL (VCALENDAR 2.0): ' + str(d['glava'])
    assert d['crlf'], 'Z0s: CRLF zaključki manjkajo (RFC 5545 §3.1): ' + json.dumps(d)
    assert d['xstatus'], 'Z0s: X-ROKSAL-STATUS resnica manjka (VERBATIM iz API-ja): ' + json.dumps(d)
    assert d['konec'], 'Z0s: END:VCALENDAR manjka: ' + json.dumps(d)
    assert d['dogodki'] >= 1, 'Z0s: brez VEVENT (koledar s podatki mora imeti dogodke): ' + json.dumps(d)
    print('Z0s ICS OK — KOLEDAR PREGLEDOV ICS ŽIVO bajtno (' + str(d['bajti']) + ' znakov, BREZ BOM RAW dokaz, glava: ' + str(d['glava'])[:24] + ', VEVENT: ' + str(d['dogodki']) + ', CRLF + X-ROKSAL-STATUS ŽIVO)')
else:
    raise AssertionError('Z0s: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF5
  agent-browser eval "(()=>{window.__koledarIcs=null; window.__koledarIcsBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r296-e2e-z0s-koledar-ics.png" > /dev/null 2>&1
else
  echo "Z0s OPOMBA: CRM pregled ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R296 ×13 ostajajo obvezni dokaz"
fi

'''

ANCHOR = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="'
assert ANCHOR in s, 'anchor Z1 ni najden'
s = s.replace(ANCHOR, Z0S + ANCHOR)

open(DST, 'w').write(s)
print('r296-e2e-browser.sh zgeneriran:', len(s), 'znakov')
