#!/usr/bin/env python3
# R299 — generira scripts/r299-e2e-browser.sh iz r298-e2e-browser.sh:
#  1. NOV Z0v blok: TEDENSKI ICS PO EKIPAH ŽIVO (29. člen) — čipi (pogojna
#     vidnost: ekipa z vsaj enim terminom v oknu) + ICS bajtna capture
#     (PRODID po ekipah + X-ROKSAL-EKIPA + UID predpona 'vozni-red-ekipa-'
#     + CRLF + BREZ BOM) — pogojni kanon r277 (obe veji iskreni; izvoz =
#     lokalni blob download, ZERO-MUTACIJA — nič GET zapisov);
#  2. poti + oznake r298 → r299;
#  3. ZERO-MUTACIJA veriga nespremenjena (fp pre/post ×4 + restore).
SRC = '/home/z/my-project/scripts/r298-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r299-e2e-browser.sh'

s = open(SRC).read()

s = s.replace('/tmp/r298-', '/tmp/r299-')
s = s.replace('qa-r298-e2e-', 'qa-r299-e2e-')
s = s.replace(
    '# R298 E2E ŽIVO (lokalni :3100, ADMIN) — TEDENSKI VOZNI RED ICS (28. člen\n# izvozne družine — ICS brat PDF R256 + CSV R292 EN VIR; RFC 5545 CRLF/\n# brez BOM; DTEND/STATUS kanon R139/R172) + [kombinirano z R297] OPREMA\n# CIKEL CSV + [kombinirano z R296] KOLEDAR ICS + [kombinirano z R295]\n# KOLEDAR CSV + F2 mini-vrstica + [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
    '# R299 E2E ŽIVO (lokalni :3100, ADMIN) — TEDENSKI ICS PO EKIPAH (29. člen\n# izvozne družine — izpeljani brat ICS R298 EN VIR; filter EN VIR\n# tedenskiEkipaImena; X-ROKSAL-EKIPA + UID predpona z FNV-1a hashom) +\n# [kombinirano z R298] TEDENSKI ICS + [kombinirano z R297] OPREMA CIKEL CSV\n# + [kombinirano z R296] KOLEDAR ICS + [kombinirano z R295] KOLEDAR CSV +\n# F2 mini-vrstica + [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
)
s = s.replace('echo "=== R298 E2E KONEC ==="', 'echo "=== R299 E2E KONEC ==="')

Z0V = '''echo "=== Z0v: TEDENSKI ICS PO EKIPAH ŽIVO (R299 — 29. člen izvozne družine; pogojni probe; ZERO-MUTACIJA — lokalni blob download samo) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298: podzavihek stale state — Z0v klikne 'Koledar' sam v predikatu
# (idempotenten na že aktivnem zavihku — vzorec Z0t/Z0u).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski ICS samo za ekipo '));})()" 16; then
  # čipi: definicijski naslovi (MANDATORY STIL) + skupina aria + oznaka
  agent-browser eval "(()=>{const cipi=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski ICS samo za ekipo ')); const oznaka=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='ICS po ekipi:'); const prvi=cipi[0]; return JSON.stringify({stevilo:cipi.length, oznaka:!!oznaka, oznakaTitle:oznaka?(oznaka.getAttribute('title')||'').startsWith('Ekipa z vsaj enim terminom v naslednjih 7 dneh'):false, prviTitle:prvi?(prvi.getAttribute('title')||'').startsWith('Samo termini ekipe '):false, skupinaAria:!!document.querySelector('[aria-label=\\"Tedenski ICS po ekipah\\"]'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r299-z0v-cipi.json
  python3 - <<'PYEOF6' || exit 1
import json
raw = open('/tmp/r299-z0v-cipi.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0v cipi err: ' + json.dumps(d)
assert d['stevilo'] > 0, 'Z0v: vsaj en ekipa cip (pogojna veja je tekla — ekipa obstaja): ' + json.dumps(d)
assert d['oznaka'] and d['oznakaTitle'], 'Z0v oznaka + definicijski naslov FAIL: ' + json.dumps(d)
assert d['prviTitle'], 'Z0v cip definicijski naslov FAIL (izrečen filter): ' + json.dumps(d)
assert d['skupinaAria'], 'Z0v skupina aria FAIL: ' + json.dumps(d)
print('Z0v cipi OK — ' + str(d['stevilo']) + ' ekipa cipov ŽIVO + definicijski naslovi + skupina aria')
PYEOF6
  # ICS capture (pogojni kanon R250/…/R298: bajtna capture + struktura po ekipah)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__ekipaBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__ekipaIcs=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const cip=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski ICS samo za ekipo ')); if(!cip) return 'BREZ-CIPA'; cip.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const c=window.__ekipaIcs ?? null; const niz=(typeof c==='string'); const vrstice=niz?c.split('\\r\\n').filter(v=>v.length>0):null; const razvite=niz?(():string[]=>{const o:string[]=[];for(const v of vrstice){if(v.startsWith(' ')&&o.length>0)o[o.length-1]+=v.slice(1);else o.push(v);}return o;})():null; const veventi=niz?vrstice.filter(v=>v==='BEGIN:VEVENT').length:null; return JSON.stringify({icsNiz:niz, bom:window.__ekipaBom===true, crlf:niz?c.includes('\\r\\n'):null, veventi, prva:niz?vrstice[0]:null, prodid:niz?vrstice.some(v=>v==='PRODID:-//Roksal//Tedenski vozni red po ekipah//SL'):null, ekipaX:niz?razvite.some(v=>v.startsWith('X-ROKSAL-EKIPA:')):null, obsegEkipa:niz?razvite.some(v=>v.startsWith('X-ROKSAL-OBSEG:')&&v.includes('Ekipa:')):null, uidPredpona:niz?vrstice.some(v=>v.startsWith('UID:vozni-red-ekipa-')):null, dtstartZ:niz?vrstice.some(v=>v.startsWith('DTSTART:')&&v.endsWith('Z')):null, noga:niz?vrstice[vrstice.length-1]==='END:VCALENDAR':null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r299-z0v-ics.json
  python3 - <<'PYEOF6' || exit 1
import json
raw = open('/tmp/r299-z0v-ics.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0v ICS err: ' + json.dumps(d)
assert d['icsNiz'], 'Z0v: cip je tekel (ekipa ima termine) A ni datoteke — fail-verbose kršitev: ' + json.dumps(d)
assert d['bom'] is False, 'Z0v: ICS nosi BOM (kršitev — ICS družina R296/R298): ' + json.dumps(d)
assert d['crlf'] and d['prva'] == 'BEGIN:VCALENDAR' and d['prodid'] and d['noga'], 'Z0v: VCALENDAR struktura FAIL (glava/PRODID/noga): ' + json.dumps(d)
assert d['veventi'] > 0, 'Z0v: 0 VEVENT (domain pravilo R299 — znana ekipa ima vsaj 1): ' + json.dumps(d)
assert d['ekipaX'] and d['obsegEkipa'], 'Z0v: X-ROKSAL-EKIPA / obseg dodatek manjka (izpeljana resnica): ' + json.dumps(d)
assert d['uidPredpona'] and d['dtstartZ'], 'Z0v: UID predpona vozni-red-ekipa- / DTSTART Z manjka: ' + json.dumps(d)
print('Z0v ICS OK — TEDENSKI ICS PO EKIPAH ŽIVO bajtno (' + str(d['veventi']) + ' VEVENT, BREZ BOM, CRLF, PRODID po ekipah + X-ROKSAL-EKIPA + UID predpona + DTSTART Z)')
PYEOF6
  agent-browser eval "(()=>{window.__ekipaIcs=null; window.__ekipaBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r299-e2e-z0v-ekipa-ics.png" > /dev/null 2>&1
else
  echo "Z0v OPOMBA: brez ekip z termini na spot seji — čipi pogojno skriti (iskrena praznina — podatkovno-pogojna vidnost R299); chunk needleji R299 ×16 ostajajo obvezni dokaz"
fi

'''

ANCHOR = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="'
assert ANCHOR in s, 'anchor Z1 ni najden'
s = s.replace(ANCHOR, Z0V + ANCHOR)

open(DST, 'w').write(s)
print('r299-e2e-browser.sh zgeneriran:', len(s), 'znakov')
