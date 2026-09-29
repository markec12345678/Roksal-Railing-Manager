#!/bin/bash
# R272 E2E ŽIVO (lokalni :3100, ADMIN) — NAGIBI — TERENSKI PREGLED PDF
# (28. člen 'izvozi' družine: FRESH GET /api/slopes?projectId — polna resnica
# zgodovine digitalne libele, tudi označeni neveljavni; route NIČ) + regresije
# R271 (zapisnik-stanje), R270 (inventura), R269 (meritve), R254 (aria).
# SEBE-VSEBUJOČ seed v DVEH fazah (R269 lekcija 2 — seed-base PRVN):
#   seed-base = 1 stranka + 1 projekt BREZ nagibov → Z1b NARAVNA fail-closed
#   veja (dev DB ima 0 naravnih Slope — NIČ stuba, NIČ mutacij);
#   seed-nagibi = 4 odčitki e2e-r272-n1…4 — VSE veje: Y pozitiven 2.35°
#   (največji |kot| 2.4°), X negativen −1.42° (znak = del resnice),
#   smer+lokacija null ('—' sivo ×2), NEVELJAVEN 0.8° (AMBER bold vrstica +
#   žeton '1 neveljavnih') → povprečni |kot| 1.3°.
# Z1 (NARAVNI prazni vir): pill ŽIVO + press-scale + legenda + mini SKRITA pri
# 0 odčitkov (iskrena praznina); Z1b POST klik → toast 'Ni vpisanih nagibov'
# + NIČ dokumenta (naravna veja); Z2 (SEED + POLN reload + PONOVNA izbira
# projekta): mini == dinamično izračunana resnica IZ ISTEGA API odgovora
# (R268 lekcija — dvokorakni eval window.__slopes) + AMBER dot + žeton
# '1 neveljavnih'; Z2b POST klik → toast agregat (ISTA dinamična resnica) +
# PDF NOV glifni razred ≠ 37 znanih; Z3 regresije (R271 zapisnik + R270
# zaloga + R269 meritve pill — vsak na svojem tabu, potrditev TAKOJ po
# waitu); Z4 temna; RESTORE → fp pre==post BAJTNATO (ZERO-MUTACIJA; Slope +
# Project + Customer POLNA resnica v odtisu).
# ⚠️ lekcije: agent-browser eval DVOLIČNO kodiran JSON (python dvojni
# json.loads); mini-vrstica: mini span DIREKTNO (startsWith) + dot = class
# query v vsebniku; async fetch v eval = dvokorakni vzorec (window.__var +
# sleep + drugi eval — NIČ await v eval); fail-fast guard || exit 1 na VSAKEM
# python3 klicu (r271 lekcija 4/5); žeton rounded-full query filtrira dot
# (prazen tekst — r271 lekcija 8).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r272-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R271-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

# pomožnica: izbira projekta prek page.tsx dogodka (detail = string id)
izberi_projekt() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r272-proj'})); return 'izbran';})()" 2>&1 | tail -1
}

echo "--- PRSTNI ODTIS PRE (PunchItem + Project + Customer POLNA resnica + regresija širine r270/r269 števcev) ---"
node scripts/r272-db-e2e.cjs fp > /tmp/r272-fp-pre.json
cat /tmp/r272-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- SEED-BASE (1 stranka + 1 projekt — BREZ točk; Z1b = naravna fail-closed veja) ---"
node scripts/r272-db-e2e.cjs seed-base

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Dokumenti — R271 pill ŽIVO (VEDNO viden pri izbranem projektu — NI gated na items.length, pariteta R263–R270) + legenda; mini SKRITA pri 0 točk (iskrena praznina) ==="
izberi_projekt
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled nagibov kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; const pk=id('Izvozi terenski pregled nagibov kot PDF'); return JSON.stringify({pill:!!pk, ps:pk?pk.className.includes('press-scale'):false, ariaHidden:pk?!!pk.querySelector('svg[aria-hidden=\"true\"]'):false, disabled:pk?pk.disabled:null, title:pk?(pk.getAttribute('title')||'').includes('VSI nagibi projekta'):false, legenda:t.includes('PDF = VSI nagibi projekta (tudi označeni neveljavni — polna resnica, ne samo viden seznam)'), miniSkrita0Tock:!t.includes('Nagibi (viden seznam)'), ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r272-z1.json
python3 -c "import json; r=json.load(open('/tmp/r272-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['ps'] and d['ariaHidden'] and d['disabled']==False and d['title'] and d['legenda'] and d['miniSkrita0Tock'] and d['ariaR254']['vsePokrite'], 'Z1 resnice FAIL: '+json.dumps(d); print('Z1 preverba OK — pill ŽIVO + legenda pariteta + mini SKRITA pri 0 točk (iskrena praznina)')" || exit 1
agent-browser screenshot "$SS/qa-r272-e2e-pill.png" > /dev/null 2>&1

echo "=== Z1b: fail-closed veja NARAVNA (seed projekt resnično brez točk — NIČ stuba, NIČ mutacij) ==="
eb_zajem_pdf pon271pre
eb_csv_reset pon271pre
eb_klik_gumb "Izvozi terenski pregled nagibov kot PDF"
eb_pocakaj_tekst "Ni vpisanih nagibov" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({toastTitle:t.includes('Ni vpisanih nagibov'), toastOpis:t.includes('Terenski pregled nagibov se izvozi, ko je vpisan prvi odčitek projekta.'), niDokumenta:!(typeof window.__pon271pre==='string'&&window.__pon271pre.length>0), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r272-z1b.json
python3 -c "import json; r=json.load(open('/tmp/r272-z1b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['toastTitle'] and d['toastOpis'] and d['niDokumenta'], 'Z1b fail-closed FAIL: '+json.dumps(d); print('Z1b fail-closed veja OK (naravno prazen zapisnik — ni dokumenta, ni prazne datoteke)')" || exit 1
agent-browser screenshot "$SS/qa-r272-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: SEED-NAGIBI (4 odčitki — vse veje; projekt obstaja od seed-base) + POLN reload + ponovna izbira projekta — mini == DINAMIČNO iz ISTEGA API odgovora + RED dot + žetona ==="
node scripts/r272-db-e2e.cjs seed-nagibi
agent-browser open "$EB_BASE" > /dev/null 2>&1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Odjava\"]');})()" 24
eb_zapri_vodic
izberi_projekt
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled nagibov kot PDF\"]');})()" 24
# Čakamo na SEED PODATEK (mini-vrstica = state — zraste po naloženih točkah).
eb_pocakaj_na "(()=>{const s=[...document.querySelectorAll('span')].find(x=>x.textContent.indexOf('Nagibi (viden seznam)')===0); return !!s && s.textContent.includes('4 nagibi');})()" 24
sleep 1
# dvokorakni eval (R268 lekcija 7): FRESH /api/punch → window.__punch
agent-browser eval "(()=>{window.__punch=null; fetch('/api/slopes?projectId=e2e-r272-proj',{credentials:'same-origin'}).then(r=>r.json()).then(d=>{window.__punch=d}).catch(e=>{window.__punchErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({punch:window.__punch, napaka:window.__punchErr??null})" 2>&1 | tail -1 > /tmp/r272-punch-raw.json
python3 - <<'PYEOF' || exit 1
import json

raw = open('/tmp/r272-punch-raw.json').read().strip()
d = json.loads(raw)
if isinstance(d, str):
    d = json.loads(d)
punch = d['punch']
assert isinstance(punch, list) and len(punch) == 4, f'API odgovor: {len(punch) if isinstance(punch,list) else type(punch)}'
assert d['napaka'] is None

def nagib_beseda(n):
    e, z = n % 10, n % 100
    if e == 1 and z != 11: return f'{n} nagib'
    if e == 2 and z != 12: return f'{n} nagiba'
    if e in (3, 4) and z not in (13, 14): return f'{n} nagibi'
    return f'{n} nagibov'

def napaka_beseda(n):
    e, z = n % 10, n % 100
    if e == 1 and z != 11: return f'{n} napaka'
    if e == 2 and z != 12: return f'{n} napaki'
    if e in (3, 4) and z not in (13, 14): return f'{n} napake'
    return f'{n} napak'

def odprta_beseda(n):
    e, z = n % 10, n % 100
    if e == 1 and z != 11: return f'{n} odprta'
    if e == 2 and z != 12: return f'{n} odprti'
    if e in (3, 4) and z not in (13, 14): return f'{n} odprte'
    return f'{n} odprtih'

najvecji_abs = max(abs(x['kotStopinje']) for x in punch)
povprecni_abs = sum(abs(x['kotStopinje']) for x in punch) / len(punch)
neveljavnih = sum(1 for x in punch if x.get('veljaven') is False)
n = len(punch)
resenost = f'{najvecji_abs:.1f}'
povp = f'{povprecni_abs:.1f}'
mini_pri = f'Nagibi (viden seznam): {nagib_beseda(n)} · največji {resenost}° · povprečni {povp}°'
agg_pri = f'{nagib_beseda(n)}, največji |kot| {resenost}°, povprečni {povp}°'
zetoni = [f'{neveljavnih} neveljavnih'] if neveljavnih > 0 else []
dot = 'bg-roksal-amber' if neveljavnih > 0 else 'bg-roksal-green'
json.dump({'n': n, 'neveljavnih': neveljavnih,
           'mini': mini_pri, 'agg': agg_pri, 'zetoni': zetoni, 'dot': dot},
          open('/tmp/r272-priakovano.json', 'w'))
print(f'pričakovano: {mini_pri}')
print(f'agg: {agg_pri} | žetoni: {zetoni} | dot: {dot}')
PYEOF
eb_pocakaj_na "(()=>{const s=[...document.querySelectorAll('span')].find(x=>x.textContent.indexOf('Nagibi (viden seznam)')===0); return !!s && s.textContent.includes('4 nagibi') && s.textContent.includes('rešenost');})()" 24
sleep 1
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Nagibi (viden seznam)')===0); const kont=[...document.querySelectorAll('div')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Nagibi (viden seznam)')===0;}); const dotRed=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-red'):false; const dotAmber=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-amber'):false; const dotGreen=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-green'):false; const zetoni=kont?[...kont.querySelectorAll('span.rounded-full')].map(x=>x.textContent.trim()).filter(x=>x!==''):[]; return JSON.stringify({miniTekst:mini?mini.textContent.trim():null, dotRed, dotAmber, dotGreen, zetoni, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r272-z2-mini.json
python3 - <<'PYEOF' || exit 1
import json
r = json.load(open('/tmp/r272-z2-mini.json'))
d = json.loads(r) if isinstance(r, str) else r
p = json.load(open('/tmp/r272-priakovano.json'))
assert d['miniTekst'] == p['mini'], f"Z2 mini FAIL:\n  dejansko: {d['miniTekst']}\n  pričakovano: {p['mini']}"
dotkey = {'bg-roksal-red': 'dotRed', 'bg-roksal-amber': 'dotAmber', 'bg-roksal-green': 'dotGreen'}[p['dot']]
assert d[dotkey], f"Z2 dot FAIL: {json.dumps(d)}"
assert d['zetoni'] == p['zetoni'], f"Z2 žetona FAIL: {d['zetoni']} vs {p['zetoni']}"
print(f"Z2 mini-vrstica OK — {p['mini']} + dot {p['dot']} + žetona ŽIVO {p['zetoni']}")
PYEOF
agent-browser screenshot "$SS/qa-r272-e2e-mini.png" > /dev/null 2>&1

echo "=== Z2b: POST klik — FRESH polna resnica + toast agregat (ISTA dinamična resnica) + PDF NOV glifni razred ==="
eb_zajem_pdf pon271
eb_csv_reset pon271
eb_klik_gumb "Izvozi terenski pregled nagibov kot PDF"
eb_pocakaj_tekst "Terenski pregled nagibov prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Nagibi-teren-…pdf — (.*°)\./.exec(t); const b64=window.__pon271; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, agg:agg?agg[1]:null, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228,39094,41009,37560,38744,43572,51142,45074,42769,66653]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), agg:agg?agg[1]:null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r272-z2-pdf.json
python3 - <<'PYEOF' || exit 1
import json
r = json.load(open('/tmp/r272-z2-pdf.json'))
d = json.loads(r) if isinstance(r, str) else r
p = json.load(open('/tmp/r272-priakovano.json'))
assert d['pdf'] and d['magija'] == '%PDF-' and d['novGlifniRazred'], 'Z2b PDF FAIL: ' + json.dumps(d)
assert d['agg'] == p['agg'], f"Z2b agg FAIL: {d['agg']} vs {p['agg']}"
print(f"Z2b PDF OK — {d['bajtov']} bajtov, NOV razred (36 znanih), FRESH polna resnica: {p['agg']}")
PYEOF
agent-browser screenshot "$SS/qa-r272-e2e-pdf.png" > /dev/null 2>&1

echo "=== Z3: regresije ŽIVO lokalno — R271 zapisnik (Dokumenti + projekt) + R270 zaloga + R269 meritve pill (potrditev TAKOJ po vsakem waitu) ==="
izberi_projekt
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]');})()" 24
R271_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R271: $R271_OK"
sleep 1
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot PDF\"]');})()" 24
R270_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R270: $R270_OK"
sleep 1
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
R269_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R269: $R269_OK"
python3 - "$R271_OK" "$R270_OK" "$R269_OK" <<'PYEOF' || exit 1
import json, sys

def parse(raw):
    d = json.loads(raw)
    return json.loads(d) if isinstance(d, str) else d

r271, r270, r269 = parse(sys.argv[1]), parse(sys.argv[2]), parse(sys.argv[3])
assert r271['pill'] and r270['pill'] and r269['pill'], f'Z3 regresije FAIL: {r271} {r270} {r269}'
print('Z3 regresije OK — R271 + R270 + R269 pill ŽIVO (vsak na svojem tabu)')
PYEOF
agent-browser screenshot "$SS/qa-r272-e2e-regresije.png" > /dev/null 2>&1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({temna:document.documentElement.classList.contains('dark'), legendaTemna:t.includes('PDF = VSI nagibi projekta'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r272-z4.json
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
python3 -c "import json; r=json.load(open('/tmp/r272-z4.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['temna'] and d['legendaTemna'] and d['err'] is None, 'Z4 temna FAIL: '+json.dumps(d); print('Z4 temna OK — legenda vidna, err null')" || exit 1

echo "=== RESTORE + ODTIS (bajtnata identičnost — ZERO-MUTACIJA) ==="
node scripts/r272-db-e2e.cjs restore
node scripts/r272-db-e2e.cjs fp > /tmp/r272-fp-post.json
if cmp -s /tmp/r272-fp-pre.json /tmp/r272-fp-post.json; then
  echo "ODTIS BAJTNATO IDENTIČEN (pre==post) — ZERO-MUTACIJA dokazana"
else
  echo "ODTIS RAZLIČEN — FAIL"; diff <(python3 -m json.tool /tmp/r272-fp-pre.json) <(python3 -m json.tool /tmp/r272-fp-post.json) | head -20
  exit 1
fi

echo "=== ZAKLJUČEK: strežnik + brskalnik zaprta ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R271 E2E KONEC ==="
