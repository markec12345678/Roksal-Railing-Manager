#!/bin/bash
# R263 E2E ŽIVO (lokalni :3100, ADMIN) — STRANKE — OPOMNIŠKA POKRITOST PDF (19.
# člen 'izvozi' družine: presek strank × opomniški status iz ISTEGA /api/crm
# odgovora; route NIČ) + regresije R252 (potekli opomniki), R253 (koledar), R254
# (aria).
# SEED/RESTORE runda: USPEŠNA pot PREJ z naravnim stanjem (3 stranke, vse
# AKTIVEN brez opomnika → brezN 3, pokritost 0,0 %), potem raw SQL seed (SAMO
# INSERT — s1 AKTIVEN brez opomnika (slepa pika +1), s2 AKTIVEN opomnik
# NOW()+5 dni (API AKTIVEN — pokrita +1, pokritost % > 0), s3 ARHIVIRAN brez
# opomnika (iskren odpad — arhiviranihBrezN +1, brez vrstice — dokaz
# izključitve ŽIVO)) → brezN 4, strankN 6, pokritost 16,7 %, RESTORE → fp
# pre==post BAJTNATO (ZERO-MUTACIJA; Customer POLNA resnica v odtisu).
# ⚠️ lekcija rute: opomnikDatum > 7 dni v prihodnje ostane opomnikStatus 'NI'
# — zato s2 uporablja NOW()+5 dni (AKTIVEN vedno, deterministično).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r263-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100
export EB_BASE="http://127.0.0.1:3100"
export EB_EMAIL="ci@roksal.si"
export EB_GESLO="DimniSmoke139!"

source scripts/e2e-lib.sh

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R263-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (Customer POLNA resnica + prejšnje tabele) ---"
node scripts/r263-db-e2e.cjs fp > /tmp/r263-fp-pre.json
cat /tmp/r263-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: CRM tab — R263 pill ŽIVO (VEDNO viden + press-scale + Bell aria-hidden) + legenda append + F2 mini-vrstica ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pokritost opomnikov kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const pok=id('Izvozi pokritost opomnikov kot PDF'); const pot=id('Izvozi potekle opomnike kot PDF'); const kol=id('Izvozi koledar pregledov kot PDF'); const csv=id('Izvozi CSV'); const t=document.body.textContent; const mini=/Pokritost opomnikov: (\\d+) od (\\d+) strank brez vpisanega opomnika · pokritost ([\\d,]+) %/.exec(t); const zig=/\\d+ brez vpisanega opomnika/.test(t); const leg263=t.includes('Pokritost = stranke × opomnikStatus (slepe pike = brez datuma)'); const leg252Staro=t.includes('CSV = prikazani seznam · PDF = potekli opomniki (akcija) · Potekel = prek datuma · Koledar = vsi vpisani pregledi (časovna vrsta)'); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({pokPill:!!pok, pokPS:pok?pok.className.includes('press-scale'):false, pokAriaHidden:pok?!!pok.querySelector('svg[aria-hidden=\"true\"]'):false, pokDisabled:pok?pok.disabled:null, potekliPill:!!pot, koledarPill:!!kol, csvPill:!!csv, miniMatch:mini?[Number(mini[1]),Number(mini[2]),mini[3]]:null, zigBrez:zig, legenda263:leg263, legenda252StaroIntaktno:leg252Staro, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r263-z1.json
python3 -c "import json; r=json.load(open('/tmp/r263-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pokPill'] and d['pokPS'] and d['pokAriaHidden'] and d['legenda263'] and d['legenda252StaroIntaktno'] and d['miniMatch'], 'Z1 resnice FAIL: '+json.dumps(d); print('Z1 preverba OK — mini:', d['miniMatch'])"
agent-browser screenshot "$SS/qa-r263-e2e-pilli.png" > /dev/null 2>&1

echo "=== Z1b: R263 uspešna pot PREJ (naravno stanje: 3 stranke, vse NI → brezN 3, pokritost 0,0 %) ==="
eb_zajem_pdf pok263
eb_csv_reset pok263
eb_klik_gumb "Izvozi pokritost opomnikov kot PDF"
eb_pocakaj_tekst "Pokritost opomnikov prenešena v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Stranke-opomniska-pokritost-…pdf — (.+?)\./.exec(t); const mini=/Pokritost opomnikov: (\\d+) od (\\d+) strank brez vpisanega opomnika · pokritost ([\\d,]+) %/.exec(t); return JSON.stringify({toastTitle:t.includes('Pokritost opomnikov prenešena v PDF'), toastAgregat:agg?agg[1]:null, miniBrez:mini?Number(mini[1]):null, miniStrank:mini?Number(mini[2]):null, miniPokritost:mini?mini[3]:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r263-z1b.json
cat /tmp/r263-z1b.json
python3 -c "
import json, re

def L(p):
    d = json.load(open(p))
    return json.loads(d) if isinstance(d, str) else d

d = L('/tmp/r263-z1b.json')
assert d['toastTitle'] and d['miniBrez'] is not None, 'Z1b resnice FAIL: '+json.dumps(d)
brez, strank = d['miniBrez'], d['miniStrank']
zOp = strank - brez  # naravno stanje: arhiviranihBrezN=0
brezPOST, strankPOST, zOpPOST = brez+1, strank+3, zOp+1
pokr = zOpPOST/strankPOST*100
pokrNiz = ('%.1f'%pokr).replace('.',',')
m = re.search(r'poteklih (\d+)', d['toastAgregat'] or '')
pot = m.group(1) if m else '0'
subj = '1 stranka' if brezPOST == 1 else f'{brezPOST} strank'
exp = {'preBrez':brez,'preStrank':strank,'preToastAgregat':d['toastAgregat'],
       'postBrez':brezPOST,'postStrank':strankPOST,'postPokritostNiz':pokrNiz,
       'postToastAgregat':f'{subj} brez vpisanega opomnika, pokritost {pokrNiz} %, poteklih {pot}'}
json.dump(exp, open('/tmp/r263-expected.json','w'))
print('Z1b PRE:', brez, 'od', strank, '· pričakovan POST:', brezPOST, 'od', strankPOST, '·', pokrNiz, '%')
"
eb_pocakaj_na "(()=>{return typeof window.__pok263==='string'&&window.__pok263.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pok263; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r263-z1b-pdf.json
python3 -c "import json; r=json.load(open('/tmp/r263-z1b-pdf.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-' and d['novGlifniRazred'], 'Z1b PDF FAIL: '+json.dumps(d); print('Z1b PDF OK —', d['bajtov'], 'bajtov, NOV razred')"
agent-browser screenshot "$SS/qa-r263-e2e-toast.png" > /dev/null 2>&1

echo "=== Z2: SEED (3 stranke: slepa pika + pokrita + arhivirana) + reload — presek PO seedu ==="
node scripts/r263-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 2
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pokritost opomnikov kot PDF\"]');})()" 24
eb_cakaj 3
agent-browser eval "(()=>{const t=document.body.textContent; const mini=/Pokritost opomnikov: (\\d+) od (\\d+) strank brez vpisanega opomnika · pokritost ([\\d,]+) %/.exec(t); const skupno=t.includes('Skupno'); return JSON.stringify({miniBrez:mini?Number(mini[1]):null, miniStrank:mini?Number(mini[2]):null, miniPokritost:mini?mini[3]:null, zigBrez:/\\d+ brez vpisanega opomnika/.test(t), skupnoKarta:skupno, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r263-z2.json
cat /tmp/r263-z2.json
python3 -c "
import json, re

def L(p):
    d = json.load(open(p))
    return json.loads(d) if isinstance(d, str) else d

d = L('/tmp/r263-z2.json'); e = json.load(open('/tmp/r263-expected.json'))
assert d['miniBrez']==e['postBrez'] and d['miniStrank']==e['postStrank'] and d['miniPokritost']==e['postPokritostNiz'], 'Z2 mini FAIL: '+json.dumps(d)+' vs '+json.dumps(e)
assert d['zigBrez'], 'F2 žig mora biti ŽIVO (brezN > 0)'
print('Z2 mini OK —', d['miniBrez'], 'od', d['miniStrank'], '·', d['miniPokritost'], '% (arhivirana izključitev ŽIVO: brezN', e['postBrez'], '= strankN', e['postStrank'], '− pokrita 1 − arhivirana 1)')
"
eb_zajem_pdf pok263b
eb_csv_reset pok263b
eb_klik_gumb "Izvozi pokritost opomnikov kot PDF"
eb_pocakaj_tekst "Pokritost opomnikov prenešena v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Stranke-opomniska-pokritost-…pdf — (.+?)\./.exec(t); return JSON.stringify({toastTitle:t.includes('Pokritost opomnikov prenešena v PDF'), toastAgregat:agg?agg[1]:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r263-z2b.json
cat /tmp/r263-z2b.json
python3 -c "
import json, re

def L(p):
    d = json.load(open(p))
    return json.loads(d) if isinstance(d, str) else d

d = L('/tmp/r263-z2b.json'); e = json.load(open('/tmp/r263-expected.json'))
assert d['toastTitle'] and d['toastAgregat']==e['postToastAgregat'], 'Z2 toast FAIL: '+json.dumps(d)+' vs pričakovano: '+e['postToastAgregat']
print('Z2 toast OK —', d['toastAgregat'])
"
eb_pocakaj_na "(()=>{return typeof window.__pok263b==='string'&&window.__pok263b.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pok263b; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r263-z2-pdf.json
python3 -c "
import json
r=json.load(open('/tmp/r263-z2-pdf.json')); d=json.loads(r) if isinstance(r,str) else r
rp=json.load(open('/tmp/r263-z1b-pdf.json')); pre=json.loads(rp) if isinstance(rp,str) else rp
assert d['pdf'] and d['magija']=='%PDF-' and d['novGlifniRazred'], 'Z2 PDF FAIL: '+json.dumps(d)
assert d['bajtov'] != pre['bajtov'], 'Z2 PDF enak PRE?! '+json.dumps(d)
print('Z2 PDF OK —', d['bajtov'], 'bajtov, NOV razred ≠ PRE', pre['bajtov'])"
agent-browser screenshot "$SS/qa-r263-e2e-po-seedu.png" > /dev/null 2>&1

echo "=== Z2b: R252/R253 regresija — potekli + koledar pilli ŠE VEDNO ŽIVO ==="
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; return JSON.stringify({potekliPill:!!id('Izvozi potekle opomnike kot PDF'), koledarPill:!!id('Izvozi koledar pregledov kot PDF'), legendaR252:t.includes('Potekel = prek datuma'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== Z4: RESTORE + prstni odtis post BAJTNATO == pre ==="
agent-browser close --all > /dev/null 2>&1
node scripts/r263-db-e2e.cjs restore
node scripts/r263-db-e2e.cjs fp > /tmp/r263-fp-post.json
cat /tmp/r263-fp-post.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('POST:', d['stevci'])"
if cmp -s /tmp/r263-fp-pre.json /tmp/r263-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — seed/restore bajtnato)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r263-fp-pre.json) <(python3 -m json.tool /tmp/r263-fp-post.json) | head -20; fi

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R263 E2E KONEC ---"
