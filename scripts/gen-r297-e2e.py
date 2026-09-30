#!/usr/bin/env python3
# R297 — generira scripts/r297-e2e-browser.sh iz r296-e2e-browser.sh:
#  1. NOV Z0t blok: OPREMA CIKEL CSV ŽIVO (27. člen) — oba pilli (PDF + CSV)
#     VEDNO vidna + CSV bajtna capture (BOM RAW dokaz, glava 8 stolpcev
#     VERBATIM, meta Obseg resnica) — pogojni kanon r277 (obe veji iskreni;
#     FRESH paginirani fetch = GET samo, ZERO-MUTACIJA);
#  2. poti + oznake r296 → r297;
#  3. ZERO-MUTACIJA veriga nespremenjena (fp pre/post ×4 + restore).
SRC = '/home/z/my-project/scripts/r296-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r297-e2e-browser.sh'

s = open(SRC).read()

s = s.replace('/tmp/r296-', '/tmp/r297-')
s = s.replace('qa-r296-e2e-', 'qa-r297-e2e-')
s = s.replace(
    '# R296 E2E ŽIVO (lokalni :3100, ADMIN) — KOLEDAR PREGLEDOV ICS (26. člen\n# izvozne družine — ICS brat PDF R253 + CSV R295 EN VIR; RFC 5545 CRLF/brez\n# BOM) + [kombinirano z R295] KOLEDAR CSV + F2 mini-vrstica\n# + [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
    '# R297 E2E ŽIVO (lokalni :3100, ADMIN) — OPREMA CIKEL CSV (27. člen\n# izvozne družine — CSV brat PDF R266 EN VIR; ENA izpeljava vira\n# pridobiOpremoVnosi) + [kombinirano z R296] KOLEDAR ICS\n# + [kombinirano z R295] KOLEDAR CSV + F2 mini-vrstica\n# + [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
)
s = s.replace('echo "=== R296 E2E KONEC ==="', 'echo "=== R297 E2E KONEC ==="')

Z0T = '''echo "=== Z0t: OPREMA CIKEL CSV ŽIVO (R297 — 27. člen izvozne družine; pogojni probe; ZERO-MUTACIJA — GET fetch samo) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const oprema=gumbi.find(b=>b.textContent.trim()==='Oprema'); if(oprema) oprema.click(); return !!document.querySelector('button[aria-label=\\"Izvozi pregled življenjskega cikla opreme kot CSV\\"]');})()" 16; then
  # oba cikl pilli (PDF brat R266 + CSV brat R297): VEDNO vidna (P1-k precedens)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi pregled življenjskega cikla opreme kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi pregled življenjskega cikla opreme kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi pregled življenjskega cikla opreme kot CSV'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r297-z0t-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r297-z0t-pilli.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0t pilli err: ' + json.dumps(d)
assert d['pillPdf'] and d['pillCsv'], 'Z0t: oba cikl pilla (PDF brat + CSV brat) morata biti vidna: ' + json.dumps(d)
print('Z0t pilli OK — Cikel PDF (R266 brat) + Cikel CSV (R297) VEDNO vidna (P1-k precedens)')
PYEOF5
  # CSV (pogojni kanon R250/R291/…/R296: fail-closed toast pri 0 + NIČ datoteke ALI bajtna capture z BOM)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__opremaBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__opremaCsv=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\\"Izvozi pregled življenjskega cikla opreme kot CSV\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni vpisane opreme') && body.includes('CSV se izvozi, ko je vpisan prvi kos opreme.'); const uspeh=body.includes('Pregled opreme prenešen v CSV ('); const c=window.__opremaCsv ?? null; const niz=(typeof c==='string'); const brezBom=niz?c.replace(/^\\uFEFF/,''):null; return JSON.stringify({prazno, uspeh, csvNiz:niz, bom:window.__opremaBom===true, bajti:niz?brezBom.length:0, glava:niz?brezBom.split('\\n')[0].slice(0,60):null, obseg:niz?brezBom.includes('Vsa oprema iz /api/equipment (polna resnica — tudi upokojena/izgubljena; NAZIV ASC referenčni red)'):null, sklep:niz?brezBom.includes('paginacija do 10.000 kosov.'):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r297-z0t-csv.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r297-z0t-csv.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0t CSV err: ' + json.dumps(d)
if d['prazno']:
    assert not d['csvNiz'], 'Z0t: toast pri 0 kosov A VSEENO datoteka (kršitev fail-closed — družinsko pravilo R266): ' + json.dumps(d)
    print('Z0t OK — gumb ŽIVO, fail-closed toast pri 0 kosov (iskrena praznina — ISTI gate kot brat R266; NIČ datoteke)')
elif d['csvNiz']:
    assert d['bajti'] > 0 and d['bom'], 'Z0t: datoteka brez BOM/vsebine (RAW bajti EF BB BF): ' + json.dumps(d)
    assert d['glava'] and d['glava'].startswith('"Oprema","Tip","Status","Lokacija","Zadnji pregled","Naslednji pregled","Kalibracija","Rezervacije"'), 'Z0t: glava FAIL (8 stolpcev VERBATIM PDF head R266): ' + str(d['glava'])
    assert d['obseg'], 'Z0t: meta Obseg resnica manjka: ' + json.dumps(d)
    assert d['sklep'], 'Z0t: Sklep VERBATIM (paginacija do 10.000 kosov.) manjka: ' + json.dumps(d)
    print('Z0t CSV OK — OPREMA CIKEL CSV ŽIVO bajtno (' + str(d['bajti']) + ' B, BOM efbbbf RAW dokaz, glava: ' + str(d['glava'])[:50] + ')')
else:
    raise AssertionError('Z0t: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF5
  agent-browser eval "(()=>{window.__opremaCsv=null; window.__opremaBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r297-e2e-z0t-oprema-csv.png" > /dev/null 2>&1
else
  echo "Z0t OPOMBA: logistika/oprema ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R297 ×13 ostajajo obvezni dokaz"
fi

'''

ANCHOR = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="'
assert ANCHOR in s, 'anchor Z1 ni najden'
s = s.replace(ANCHOR, Z0T + ANCHOR)

open(DST, 'w').write(s)
print('r297-e2e-browser.sh zgeneriran:', len(s), 'znakov')
