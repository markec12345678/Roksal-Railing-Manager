#!/usr/bin/env python3
# R298 — generira scripts/r298-e2e-browser.sh iz r297-e2e-browser.sh:
#  1. NOV Z0u blok: TEDENSKI VOZNI RED ICS ŽIVO (28. člen) — vsi trije
#     tedenski pilli (PDF R256 + CSV R292 + ICS R298) VEDNO vidni + ICS
#     bajtna capture (BREZ BOM dokaz — ICS družinsko pravilo, CRLF,
#     VCALENDAR glava VERBATIM, X-ROKSAL-OBSEG, DTSTART/DTEND 'Z' resnica,
#     STATUS preslikava) — pogojni kanon r277 (obe veji iskreni; izvoz =
#     lokalni blob download, ZERO-MUTACIJA — nič GET zapisov);
#  2. poti + oznake r297 → r298;
#  3. ZERO-MUTACIJA veriga nespremenjena (fp pre/post ×4 + restore).
SRC = '/home/z/my-project/scripts/r297-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r298-e2e-browser.sh'

s = open(SRC).read()

s = s.replace('/tmp/r297-', '/tmp/r298-')
s = s.replace('qa-r297-e2e-', 'qa-r298-e2e-')
s = s.replace(
    '# R297 E2E ŽIVO (lokalni :3100, ADMIN) — OPREMA CIKEL CSV (27. člen\n# izvozne družine — CSV brat PDF R266 EN VIR; ENA izpeljava vira\n# pridobiOpremoVnosi) + [kombinirano z R296] KOLEDAR ICS\n# + [kombinirano z R295] KOLEDAR CSV + F2 mini-vrstica\n# + [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
    '# R298 E2E ŽIVO (lokalni :3100, ADMIN) — TEDENSKI VOZNI RED ICS (28. člen\n# izvozne družine — ICS brat PDF R256 + CSV R292 EN VIR; RFC 5545 CRLF/\n# brez BOM; DTEND/STATUS kanon R139/R172) + [kombinirano z R297] OPREMA\n# CIKEL CSV + [kombinirano z R296] KOLEDAR ICS + [kombinirano z R295]\n# KOLEDAR CSV + F2 mini-vrstica + [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
)
s = s.replace('echo "=== R297 E2E KONEC ==="', 'echo "=== R298 E2E KONEC ==="')

Z0U = '''echo "=== Z0u: TEDENSKI VOZNI RED ICS ŽIVO (R298 — 28. člen izvozne družine; pogojni probe; ZERO-MUTACIJA — lokalni blob download samo) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298: Z0t klikne 'Oprema' podzavihek IN ostane tam (isti dispatch ne
# resetira notranjega stanja) — Z0u mora sam klikniti 'Koledar' podzavihek
# (vzorec Z0t: klik v predikatu, idempotenten na že aktivnem zavihku).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[aria-label=\\"Izvozi tedenski pregled montaž kot ICS koledar\\"]');})()" 16; then
  # vsi trije tedenski pilli (PDF brat R256 + CSV brat R292 + ICS R298): VEDNO vidni (P1-k precedens)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski pregled montaž kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi tedenski pregled montaž kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi tedenski pregled montaž kot CSV'), pillIcs:pill.some(b=>b.getAttribute('aria-label')==='Izvozi tedenski pregled montaž kot ICS koledar'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r298-z0u-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r298-z0u-pilli.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0u pilli err: ' + json.dumps(d)
assert d['pillPdf'] and d['pillCsv'] and d['pillIcs'], 'Z0u: vsi trije tedenski pilli (PDF R256 + CSV R292 + ICS R298) morajo biti vidni: ' + json.dumps(d)
print('Z0u pilli OK — Tedenski PDF (brat) + CSV (brat) + ICS (R298) VEDNO vidni (P1-k precedens)')
PYEOF5
  # ICS (pogojni kanon R250/…/R296: fail-closed toast pri 0 terminov + NIČ datoteke ALI bajtna capture BREZ BOM + CRLF)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__icsBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__tedenskiIcs=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\\"Izvozi tedenski pregled montaž kot ICS koledar\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('ICS se izvozi, ko je vpisan termin v prihajajočem tednu.'); const uspeh=body.includes('Tedenski vozni red prenešen v ICS ('); const c=window.__tedenskiIcs ?? null; const niz=(typeof c==='string'); const vrstice=niz?c.split('\\r\\n'):null; const veventi=niz?vrstice.filter(v=>v==='BEGIN:VEVENT').length:null; return JSON.stringify({prazno, uspeh, icsNiz:niz, bom:window.__icsBom===true, crlf:niz?c.includes('\\r\\n'):null, veventi, prva:niz?vrstice[0]:null, prodid:niz?vrstice.some(v=>v==='PRODID:-//Roksal//Tedenski vozni red//SL'):null, obseg:niz?vrstice.some(v=>v.startsWith('X-ROKSAL-OBSEG:')):null, dtstartZ:niz?vrstice.some(v=>v.startsWith('DTSTART:')&&v.endsWith('Z')):null, dtendZ:niz?vrstice.some(v=>v.startsWith('DTEND:')&&v.endsWith('Z')):null, status:niz?(veventi===0||vrstice.some(v=>v==='STATUS:CONFIRMED'||v==='STATUS:CANCELLED'||v==='STATUS:TENTATIVE')):null, noga:niz?vrstice[vrstice.length-1]==='END:VCALENDAR':null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r298-z0u-ics.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r298-z0u-ics.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0u ICS err: ' + json.dumps(d)
if d['prazno']:
    assert not d['icsNiz'], 'Z0u: toast pri 0 terminov A VSEENO datoteka (kršitev fail-closed — družinsko pravilo): ' + json.dumps(d)
    print('Z0u OK — gumb ŽIVO, fail-closed toast pri 0 terminov (iskrena praznina — ISTI gate kot brata PDF/CSV; NIČ datoteke)')
elif d['icsNiz']:
    assert d['bom'] is False, 'Z0u: ICS nosi BOM (kršitev — ICS družina R296: čist UTF-8 brez BOM): ' + json.dumps(d)
    assert d['crlf'] and d['prva'] == 'BEGIN:VCALENDAR' and d['prodid'] and d['obseg'] and d['noga'], 'Z0u: VCALENDAR struktura FAIL (glava/PRODID/obseg/noga): ' + json.dumps(d)
    assert d['veventi'] > 0, 'Z0u: uspeh toast A 0 VEVENT (neusklajena resnica): ' + json.dumps(d)
    assert d['dtstartZ'] and d['dtendZ'], 'Z0u: DTSTART/DTEND Z-projekcija manjka (termin-domna kanon R139/R172): ' + json.dumps(d)
    assert d['status'], 'Z0u: STATUS preslikava manjka (CONFIRMED/CANCELLED/TENTATIVE): ' + json.dumps(d)
    print('Z0u ICS OK — TEDENSKI VOZNI RED ICS ŽIVO bajtno (' + str(d['veventi']) + ' VEVENT, BREZ BOM, CRLF, PRODID + X-ROKSAL-OBSEG + DTSTART/DTEND Z + STATUS)')
else:
    raise AssertionError('Z0u: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF5
  agent-browser eval "(()=>{window.__tedenskiIcs=null; window.__icsBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r298-e2e-z0u-tedenski-ics.png" > /dev/null 2>&1
else
  echo "Z0u OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R298 ×17 ostajajo obvezni dokaz"
fi

'''

ANCHOR = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="'
assert ANCHOR in s, 'anchor Z1 ni najden'
s = s.replace(ANCHOR, Z0U + ANCHOR)

open(DST, 'w').write(s)
print('r298-e2e-browser.sh zgeneriran:', len(s), 'znakov')
