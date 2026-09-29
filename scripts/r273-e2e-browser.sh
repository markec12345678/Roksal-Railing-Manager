#!/bin/bash
# R273 E2E ŽIVO (lokalni :3100, ADMIN) — ZALOGA — PREMOŽENJSKA VREDNOST PDF
# (29. člen 'izvozi' družine: FRESH GET /api/inventory + /api/material-prices
# — dva vira ENA resnica; route NIČ) + regresije R272 (nagibi), R271
# (zapisnik), R270 (inventura), R269 (meritve), R254 (aria).
# SEBE-VSEBUJOČ seed v DVEH fazah (R269 lekcija 2 — seed-base PRVN):
#   seed-base = 1 stranka + 1 projekt (za Z3 projekt-gated regresije);
#   seed-vrednost = 1 dobavitelj + 5 artiklov + 4 cene e2e-r273-a1…5/c1,c3-c5 —
#   VSE TRI veje resničnega API-ja: a1/a2/a5 z veljavno ceno (12.50/8.30/3.10),
#   a3 SAMO PRETEČENA cena (veljavnostDo — API ne vrne → 'pretečena' veja skozi
#   REALNO API filtriranje, NIČ stuba), a4 brez cen (R227 žig veja);
#   Σ = 12.50×10 + 8.30×4.5 + 3.10×25 = 239.85 EUR; naravni dev portfel (8
#   artiklov, 0 cen) ostane NEDOTAKNJEN → skupaj 13 (vsi brez cene).
# Z1 (NARAVNI vir): pill ŽIVO + press-scale + legenda + mini VIDLJIVA z 'Σ —' +
# RED dot + žeton 'brez cene N' (iskrena resnica naravnega stanja — N
# vrednostno agnostično); Z1b fail-closed veja prek fetch stuba [] (r211/r270
# precedens, restavriran — NIČ DB mutacij): 'Ni vpisanih artiklov' + NIČ
# dokumenta; Z2 (SEED + POLN reload): mini == dinamično izračunana resnica IZ
# ISTEGA API odgovora (R268 lekcija — dvokorakni eval window.__inv/__cene) +
# RED dot + žetona 'pretečena 1' + 'brez cene N'; Z2b POST klik → toast
# agregat (ISTA dinamična resnica) + PDF NOV glifni razred ≠ 38 znanih; Z3
# regresije (R272 nagibi + R271 zapisnik + R269 meritve — projekt-gated,
# potrditev TAKOJ po waitu); Z4 temna; RESTORE → fp pre==post BAJTNATO
# (ZERO-MUTACIJA; Inventory + MaterialPrice + Supplier POLNA resnica v odtisu).
# ⚠️ lekcije: agent-browser eval DVOLIČNO kodiran JSON (python dvojni
# json.loads); async fetch v eval = dvokorakni vzorec (window.__var + sleep +
# drugi eval — NIČ await v eval); fail-fast guard || exit 1 na VSAKEM python3
# klicu (r271 lekcija 4/5); žeton rounded-full query filtrira dot (prazen
# tekst — r271 lekcija 8); toast agg regex terminira na 'brez cene \d+\.' (Σ
# vsebuje decimalno piko — nekladoča (.*)\. bi se ustavila na 239 — r272
# lekcija 6 varianta).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r273-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R273-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

# pomožnica: izbira projekta prek page.tsx dogodka (detail = string id)
izberi_projekt() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r273-proj'})); return 'izbran';})()" 2>&1 | tail -1
}

echo "--- PRSTNI ODTIS PRE (Inventory + MaterialPrice + Supplier POLNA resnica + regresija širine r272 števcev) ---"
node scripts/r273-db-e2e.cjs fp > /tmp/r273-fp-pre.json
cat /tmp/r273-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])" || exit 1

echo "--- SEED-BASE (1 stranka + 1 projekt — za Z3 projekt-gated regresije) ---"
node scripts/r273-db-e2e.cjs seed-base

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Zaloga — R273 pill ŽIVO (VEDNO viden — NI gated na filtered.length, pariteta R263–R272) + legenda + mini VIDLJIVA z 'Σ —' + RED dot (naravni vir: artikli brez cen = iskrena resnica) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled vrednosti zaloge kot PDF\"]');})()" 24
# mini rabi OBÄ vira: state inventory + FRESH bestCene (mount fetch)
eb_pocakaj_na "(()=>{const s=[...document.querySelectorAll('span')].find(x=>x.textContent.indexOf('Vrednost (viden seznam)')===0); return !!s && s.textContent.includes('Σ —');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; const pk=id('Izvozi pregled vrednosti zaloge kot PDF'); const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Vrednost (viden seznam)')===0); const kont=[...document.querySelectorAll('div')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Vrednost (viden seznam)')===0;}); const dotRed=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-red'):false; const zetoni=kont?[...kont.querySelectorAll('span.rounded-full')].map(x=>x.textContent.trim()).filter(x=>x!==''):[]; return JSON.stringify({pill:!!pk, ps:pk?pk.className.includes('press-scale'):false, ariaHidden:pk?!!pk.querySelector('svg[aria-hidden=\"true\"]'):false, disabled:pk?pk.disabled:null, title:pk?(pk.getAttribute('title')||'').includes('VSA zalogovna premoženja s trenutno veljavnimi cenami'):false, legenda:t.includes('PDF = polna denarna resnica skladišča (FRESH /api/inventory + /api/material-prices ob kliku — samo trenutno veljavne cene; ne zastarel state)'), miniTekst:mini?mini.textContent.trim():null, dotRed, zetoni, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r273-z1.json
python3 - <<'PYEOF' || exit 1
import json, re
r = json.load(open('/tmp/r273-z1.json'))
d = json.loads(r) if isinstance(r, str) else r
assert d['pill'] and d['ps'] and d['ariaHidden'] and d['disabled'] == False and d['title'], 'Z1 pill FAIL: ' + json.dumps(d)
assert d['legenda'], 'Z1 legenda FAIL: ' + json.dumps(d)
assert d['ariaR254']['vsePokrite'], 'Z1 aria FAIL: ' + json.dumps(d)
# mini: iskrena resnica naravnega stanja — Σ '—' (dev DB brez cen) + RED dot
assert d['miniTekst'] and d['miniTekst'].startswith('Vrednost (viden seznam): '), 'Z1 mini FAIL: ' + json.dumps(d)
assert 'Σ —' in d['miniTekst'], 'Z1 mini Σ FAIL (naravni vir brez cen — iskrena praznina): ' + d['miniTekst']
assert d['dotRed'], 'Z1 dot FAIL (brez cene > 0 → RED): ' + json.dumps(d)
assert d['zetoni'] and d['zetoni'][-1].startswith('brez cene '), 'Z1 žeton FAIL: ' + json.dumps(d)
n_naravni = int(d['zetoni'][-1].split(' ')[-1])
print(f"Z1 preverba OK — pill ŽIVO + legenda pariteta + mini 'Σ —' + RED dot + žeton 'brez cene {n_naravni}' (naravni dev vir)")
PYEOF
agent-browser screenshot "$SS/qa-r273-e2e-pill.png" > /dev/null 2>&1

echo "=== Z1b: fail-closed veja prek fetch stuba [] (r211/r270 precedens — NIČ DB mutacij, stub restavriran) ==="
eb_zajem_pdf val273pre
eb_csv_reset val273pre
agent-browser eval "(()=>{if(!window.__origFetch) window.__origFetch=window.fetch; window.fetch=function(u,o){ if(String(u).includes('/api/inventory')){ return Promise.resolve(new Response(JSON.stringify([]),{status:200,headers:{'Content-Type':'application/json'}})); } return window.__origFetch.apply(this,[u,o]); }; return 'stub';})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi pregled vrednosti zaloge kot PDF"
eb_pocakaj_tekst "Ni vpisanih artiklov" 14
eb_cakaj 1
agent-browser eval "(()=>{window.fetch=window.__origFetch; delete window.__origFetch; const t=document.body.textContent; return JSON.stringify({stubRestavriran:!window.__origFetch, toastTitle:t.includes('Ni vpisanih artiklov'), toastOpis:t.includes('Pregled vrednosti zaloge se izvozi, ko je vpisan prvi artikel zaloge.'), niDokumenta:!(typeof window.__val273pre==='string'&&window.__val273pre.length>0), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r273-z1b.json
python3 -c "import json; r=json.load(open('/tmp/r273-z1b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['stubRestavriran'] and d['toastTitle'] and d['toastOpis'] and d['niDokumenta'], 'Z1b fail-closed FAIL: '+json.dumps(d); print('Z1b fail-closed veja OK (stub [] — ni dokumenta, ni prazne datoteke, stub restavriran)')" || exit 1
agent-browser screenshot "$SS/qa-r273-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: SEED-VREDNOST (5 artiklov + 5 cen — vse tri veje; a3 pretečena skozi REALNO API filtriranje) + POLN reload — mini == DINAMIČNO iz ISTEGA API odgovora + RED dot + žetona ==="
node scripts/r273-db-e2e.cjs seed-vrednost
agent-browser open "$EB_BASE" > /dev/null 2>&1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Odjava\"]');})()" 24
eb_zapri_vodic
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled vrednosti zaloge kot PDF\"]');})()" 24
# Čakamo na SEED PODATEK (mini Σ = samo e2e cene — deterministično 239.85).
eb_pocakaj_na "(()=>{const s=[...document.querySelectorAll('span')].find(x=>x.textContent.indexOf('Vrednost (viden seznam)')===0); return !!s && s.textContent.includes('239.85');})()" 24
sleep 1
# dvokorakni eval (R268 lekcija 7): FRESH OBA vira → window.__inv / window.__cene
agent-browser eval "(()=>{window.__inv=null; window.__cene=null; window.__vredErr=null; fetch('/api/inventory',{credentials:'same-origin'}).then(r=>r.json()).then(d=>{window.__inv=d; return fetch('/api/material-prices',{credentials:'same-origin'});}).then(r=>r.json()).then(d=>{window.__cene=d}).catch(e=>{window.__vredErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({inv:window.__inv, cene:window.__cene, napaka:window.__vredErr??null})" 2>&1 | tail -1 > /tmp/r273-viri-raw.json
python3 - <<'PYEOF' || exit 1
import json

raw = open('/tmp/r273-viri-raw.json').read().strip()
d = json.loads(raw)
if isinstance(d, str):
    d = json.loads(d)
inv, cene = d['inv'], d['cene']
assert d['napaka'] is None
assert isinstance(inv, list) and len(inv) == 13, f'inv: {len(inv) if isinstance(inv, list) else type(inv)}'
assert isinstance(cene, dict) and 'bestPerMaterial' in cene, f'cene keys: {list(cene) if isinstance(cene, dict) else type(cene)}'
best = cene['bestPerMaterial']
assert isinstance(best, list), f'bestPerMaterial: {type(best)}'
# API resnica: pretečena cena (e2e-r273-c4, 6.00) NE SME biti v bestPerMaterial
assert all(b['inventoryId'] != 'e2e-r273-a3' for b in best), 'PRETEČENA cena v bestPerMaterial — API filtriranje pokvarjeno!'
assert any(b['inventoryId'] == 'e2e-r273-a1' and abs(b['bestPrice'] - 12.5) < 1e-9 for b in best), 'best a1 NI nižja veljavna 12.50!'

def artikel_beseda(n):
    e, z = n % 10, n % 100
    if e == 1 and z != 11: return f'{n} artikel'
    if e == 2 and z != 12: return f'{n} artikla'
    if e in (3, 4) and z not in (13, 14): return f'{n} artikli'
    return f'{n} artiklov'

bestmap = {b['inventoryId']: b for b in best}
vsota = 0.0
z_ceno = 0
pretecenih = 0
brez_cene = 0
for item in inv:
    stevec = item['_count']['prices']
    b = bestmap.get(item['id'])
    if b is not None:
        vsota += b['bestPrice'] * item['kolicinaZaloga']
        z_ceno += 1
    elif stevec > 0:
        pretecenih += 1
    else:
        brez_cene += 1
n = len(inv)
vsota_s = f'{vsota:.2f}'
mini_pri = f'Vrednost (viden seznam): {artikel_beseda(n)} · Σ {vsota_s} EUR'
agg_pri = f'{artikel_beseda(n)}, Σ {vsota_s} EUR, pretečena {pretecenih}, brez cene {brez_cene}'
zetoni = []
if pretecenih > 0: zetoni.append(f'pretečena {pretecenih}')
if brez_cene > 0: zetoni.append(f'brez cene {brez_cene}')
dot = 'bg-roksal-red' if brez_cene > 0 else ('bg-roksal-amber' if pretecenih > 0 else 'bg-roksal-green')
json.dump({'n': n, 'zCeno': z_ceno, 'pretecenih': pretecenih, 'brezCene': brez_cene,
           'mini': mini_pri, 'agg': agg_pri, 'zetoni': zetoni, 'dot': dot},
          open('/tmp/r273-priakovano.json', 'w'))
print(f'pričakovano: {mini_pri}')
print(f'agg: {agg_pri} | žetoni: {zetoni} | dot: {dot} | zCeno: {z_ceno}')
PYEOF
sleep 1
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Vrednost (viden seznam)')===0); const kont=[...document.querySelectorAll('div')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Vrednost (viden seznam)')===0;}); const dotRed=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-red'):false; const dotAmber=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-amber'):false; const dotGreen=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-green'):false; const zetoni=kont?[...kont.querySelectorAll('span.rounded-full')].map(x=>x.textContent.trim()).filter(x=>x!==''):[]; return JSON.stringify({miniTekst:mini?mini.textContent.trim():null, dotRed, dotAmber, dotGreen, zetoni, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r273-z2-mini.json
python3 - <<'PYEOF' || exit 1
import json
r = json.load(open('/tmp/r273-z2-mini.json'))
d = json.loads(r) if isinstance(r, str) else r
p = json.load(open('/tmp/r273-priakovano.json'))
assert d['miniTekst'] == p['mini'], f"Z2 mini FAIL:\n  dejansko: {d['miniTekst']}\n  pričakovano: {p['mini']}"
dotkey = {'bg-roksal-red': 'dotRed', 'bg-roksal-amber': 'dotAmber', 'bg-roksal-green': 'dotGreen'}[p['dot']]
assert d[dotkey], f"Z2 dot FAIL: {json.dumps(d)}"
assert d['zetoni'] == p['zetoni'], f"Z2 žetona FAIL: {d['zetoni']} vs {p['zetoni']}"
print(f"Z2 mini-vrstica OK — {p['mini']} + dot {p['dot']} + žetona ŽIVO {p['zetoni']}")
PYEOF
agent-browser screenshot "$SS/qa-r273-e2e-mini.png" > /dev/null 2>&1

echo "=== Z2b: POST klik — FRESH polna resnica + toast agregat (ISTA dinamična resnica) + PDF NOV glifni razred ==="
eb_zajem_pdf val273
eb_csv_reset val273
eb_klik_gumb "Izvozi pregled vrednosti zaloge kot PDF"
eb_pocakaj_tekst "Pregled vrednosti zaloge prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Zaloga-vrednost-…pdf — (.*brez cene \d+)\./.exec(t); const b64=window.__val273; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, agg:agg?agg[1]:null, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228,39094,41009,37560,38744,43572,51142,45074,42769,66653,37934,40181]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), agg:agg?agg[1]:null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r273-z2-pdf.json
python3 - <<'PYEOF' || exit 1
import json
r = json.load(open('/tmp/r273-z2-pdf.json'))
d = json.loads(r) if isinstance(r, str) else r
p = json.load(open('/tmp/r273-priakovano.json'))
assert d['pdf'] and d['magija'] == '%PDF-' and d['novGlifniRazred'], 'Z2b PDF FAIL: ' + json.dumps(d)
assert d['agg'] == p['agg'], f"Z2b agg FAIL: {d['agg']} vs {p['agg']}"
print(f"Z2b PDF OK — {d['bajtov']} bajtov, NOV razred (38 znanih), FRESH polna resnica: {p['agg']}")
PYEOF
agent-browser screenshot "$SS/qa-r273-e2e-pdf.png" > /dev/null 2>&1

echo "=== Z3: regresije ŽIVO lokalno — R272 nagibi + R271 zapisnik + R269 meritve (projekt-gated; potrditev TAKOJ po vsakem waitu) ==="
izberi_projekt
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled nagibov kot PDF\"]');})()" 24
R272_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi terenski pregled nagibov kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R272: $R272_OK"
sleep 1
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]');})()" 24
R271_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R271: $R271_OK"
sleep 1
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
R269_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R269: $R269_OK"
python3 - "$R272_OK" "$R271_OK" "$R269_OK" <<'PYEOF' || exit 1
import json, sys

def parse(raw):
    d = json.loads(raw)
    return json.loads(d) if isinstance(d, str) else d

r272, r271, r269 = parse(sys.argv[1]), parse(sys.argv[2]), parse(sys.argv[3])
assert r272['pill'] and r271['pill'] and r269['pill'], f'Z3 regresije FAIL: {r272} {r271} {r269}'
print('Z3 regresije OK — R272 + R271 + R269 pill ŽIVO (vsak na svojem tabu)')
PYEOF
agent-browser screenshot "$SS/qa-r273-e2e-regresije.png" > /dev/null 2>&1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({temna:document.documentElement.classList.contains('dark'), legendaTemna:t.includes('PDF = polna denarna resnica skladišča'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r273-z4.json
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
python3 -c "import json; r=json.load(open('/tmp/r273-z4.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['temna'] and d['legendaTemna'] and d['err'] is None, 'Z4 temna FAIL: '+json.dumps(d); print('Z4 temna OK — legenda vidna, err null')" || exit 1

echo "=== RESTORE + ODTIS (bajtnata identičnost — ZERO-MUTACIJA) ==="
node scripts/r273-db-e2e.cjs restore
node scripts/r273-db-e2e.cjs fp > /tmp/r273-fp-post.json
if cmp -s /tmp/r273-fp-pre.json /tmp/r273-fp-post.json; then
  echo "ODTIS BAJTNATO IDENTIČEN (pre==post) — ZERO-MUTACIJA dokazana"
else
  echo "ODTIS RAZLIČEN — FAIL"; diff <(python3 -m json.tool /tmp/r273-fp-pre.json) <(python3 -m json.tool /tmp/r273-fp-post.json) | head -20
  exit 1
fi

echo "=== ZAKLJUČEK: strežnik + brskalnik zaprta ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R273 E2E KONEC ==="
