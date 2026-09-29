#!/bin/bash
# R270 E2E ŽIVO (lokalni :3100, ADMIN) — INVENTURA — PREMOŽENJSKI PREGLED PDF
# (26. člen 'izvozi' družine: FRESH GET /api/inventory — polna resnica
# skladišča, tudi artikli brez premikov; route NIČ) + regresije R268
# (ekipa-stanje), R267 (spomniki), R262 (pokritost — isti tab sorodnik),
# R254 (aria).
# SEBE-VSEBUJOČ seed v ENI fazi (8 artiklov e2e-r270-inv1…8 — VSE veje:
# POD MINIMUMOM ×3 (inv2 na NIČ / inv1 necela 4.5 → manjka 5.50 / inv3
# največji manjka 6), NA MEJI ×2 (inv4 točno === / inv8 neznana koda tipa),
# ZADOSTNO ×3; premiki VSI 0 — sklep 'iskreno nič' veja ŽIVO; naravni dev
# portfel (8 artiklov) ostane NEDOTAKNjen → skupaj 16).
# Z1 (NARAVNI vir): pill ŽIVO + press-scale + legenda + mini prefix (naravni
# artikli — vrednostno agnostično); Z1b fail-closed veja prek fetch stuba []
# (r211 precedens, restavriran — NIČ DB mutacij): 'Ni vpisanih artiklov' +
# NIČ dokumenta; Z2 (SEED + POLN reload): mini == dinamično izračunana resnica
# IZ ISTEGA API odgovora (R268 lekcija: pričakovanja računana DINAMIČNO —
# dvokorakni eval window.__inv) + dot + žetona; Z2b POST klik → toast agregat
# (ISTA dinamična resnica) + PDF NOV glifni razred ≠ 35 znanih; Z3 regresije
# (R268 ekipa pill + R262 pokritost pill + R267 CRM pill — ADMIN canRead); Z4
# temna; RESTORE → fp pre==post BAJTNATO (ZERO-MUTACIJA; Inventory POLNA
# resnica — seed NIČ premikov, števec premikov dokazan v odtisu).
# ⚠️ lekcije: agent-browser eval DVOLIČNO kodiran JSON (python dvojni
# json.loads); mini-vrstica: mini span DIREKTNO (startsWith) + dot = class
# query v vsebniku (R266/R267 lekcije 3/4); async fetch v eval = dvokorakni
# vzorec (window.__var + sleep + drugi eval — NIČ await v eval, R268 lekcija
# 7); kolicinaNiz python pariteta: necela → f'{v:.2f}' (toFixed(2)).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r270-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R270-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (Inventory POLNA resnica + regresija širine r269 števcev) ---"
node scripts/r270-db-e2e.cjs fp > /tmp/r270-fp-pre.json
cat /tmp/r270-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])" || exit 1

echo "--- PRIJAVA (prek e2e-lib.sh) — NARAVNI vir (brez seeda: Z1 + Z1b) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Zaloga — R270 pill ŽIVO (VEDNO viden — NI gated na filtered.length, pariteta R263–R269) + legenda + mini prefix (naravni artikli) + aria R254 ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; const pk=id('Izvozi inventurni pregled premoženja kot PDF'); const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Inventura (viden seznam)')===0); return JSON.stringify({pill:!!pk, ps:pk?pk.className.includes('press-scale'):false, ariaHidden:pk?!!pk.querySelector('svg[aria-hidden=\"true\"]'):false, disabled:pk?pk.disabled:null, title:pk?(pk.getAttribute('title')||'').includes('VSA zalogovna premoženja'):false, legenda:t.includes('PDF = VSA zalogovna premoženja (tudi artikli brez premikov — polna resnica, ne samo viden seznam filtrov)'), miniPrefix:mini?mini.textContent.trim().startsWith('Inventura (viden seznam): '):false, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r270-z1.json
python3 -c "import json; r=json.load(open('/tmp/r270-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['ps'] and d['ariaHidden'] and d['disabled']==False and d['title'] and d['legenda'] and d['miniPrefix'] and d['ariaR254']['vsePokrite'], 'Z1 resnice FAIL: '+json.dumps(d); print('Z1 preverba OK — pill ŽIVO + legenda pariteta + mini prefix (naravni vir) + aria pokrit')" || exit 1
agent-browser screenshot "$SS/qa-r270-e2e-pill.png" > /dev/null 2>&1

echo "=== Z1b: fail-closed veja prek fetch stuba [] (r211 precedens — NIČ DB mutacij, stub restavriran) ==="
eb_zajem_pdf pon270pre
eb_csv_reset pon270pre
agent-browser eval "(()=>{if(!window.__origFetch) window.__origFetch=window.fetch; window.fetch=function(u,o){ if(String(u).includes('/api/inventory')){ return Promise.resolve(new Response(JSON.stringify([]),{status:200,headers:{'Content-Type':'application/json'}})); } return window.__origFetch.apply(this,[u,o]); }; return 'stub';})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi inventurni pregled premoženja kot PDF"
eb_pocakaj_tekst "Ni vpisanih artiklov" 14
eb_cakaj 1
agent-browser eval "(()=>{window.fetch=window.__origFetch; delete window.__origFetch; const t=document.body.textContent; return JSON.stringify({stubRestavriran:!window.__origFetch, toastTitle:t.includes('Ni vpisanih artiklov'), toastOpis:t.includes('Inventurni pregled se izvozi, ko je vpisan prvi artikel zaloge.'), niDokumenta:!(typeof window.__pon270pre==='string'&&window.__pon270pre.length>0), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r270-z1b.json
python3 -c "import json; r=json.load(open('/tmp/r270-z1b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['stubRestavriran'] and d['toastTitle'] and d['toastOpis'] and d['niDokumenta'], 'Z1b fail-closed FAIL: '+json.dumps(d); print('Z1b fail-closed veja OK (stub [] — ni dokumenta, ni prazne datoteke, stub restavriran)')" || exit 1
agent-browser screenshot "$SS/qa-r270-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: SEED (8 artiklov — vse veje) + POLN reload — mini == DINAMIČNO izračunana resnica IZ ISTEGA API odgovora + dot + žetona ==="
node scripts/r270-db-e2e.cjs seed
agent-browser open "$EB_BASE" > /dev/null 2>&1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Odjava\"]');})()" 24
eb_zapri_vodic
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot PDF\"]');})()" 24
# dvokorakni eval (R268 lekcija 7): FRESH /api/inventory → window.__inv
agent-browser eval "(()=>{window.__inv=null; fetch('/api/inventory',{credentials:'same-origin'}).then(r=>r.json()).then(d=>{window.__inv=d}).catch(e=>{window.__invErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({inv:window.__inv, napaka:window.__invErr??null})" 2>&1 | tail -1 > /tmp/r270-inv-raw.json
python3 - <<'PYEOF' || exit 1
import json, re

raw = open('/tmp/r270-inv-raw.json').read().strip()
d = json.loads(raw)
if isinstance(d, str):
    d = json.loads(d)
inv = d['inv']
assert isinstance(inv, list) and len(inv) >= 8, f'API odgovor: {len(inv) if isinstance(inv,list) else type(inv)}'
assert d['napaka'] is None

def artikel_beseda(n):
    e, z = n % 10, n % 100
    if e == 1 and z != 11: return f'{n} artikel'
    if e == 2 and z != 12: return f'{n} artikla'
    if e in (3, 4) and z not in (13, 14): return f'{n} artikli'
    return f'{n} artiklov'

def kolicina_niz(k):
    return str(int(k)) if float(k).is_integer() else f'{float(k):.2f}'

TIP_LABEL = {'WPC_deska': 'WPC', 'Inox_vijak': 'Inox', 'Kemicno_sidro': 'Kemično', 'Alu_profil': 'Aluminij'}
pod = na_meji = 0
max_manjka = None  # (vrednost, enota) — prvi v (status, sifra) redu
premiki = 0
for a in inv:
    zal, minu = a['kolicinaZaloga'], a['minimalnaZaloga']
    if zal < minu:
        pod += 1
        manjka = minu - zal
        if max_manjka is None or manjka > max_manjka[0]:
            max_manjka = (manjka, a['enota'])
    elif zal == minu:
        na_meji += 1
    cnt = a.get('_count') or {}
    premiki += cnt.get('movements', 0)

# max_manjka po (status cona, sifra ASC) = največji manjka (prvi pri izenačbi)
# — pošten izračun: ponovi sort logiko
vrste = []
for a in inv:
    zal, minu = a['kolicinaZaloga'], a['minimalnaZaloga']
    status = 'POD MINIMUMOM' if zal < minu else ('NA MEJI' if zal == minu else 'ZADOSTNO')
    vrste.append((0 if status == 'POD MINIMUMOM' else (1 if status == 'NA MEJI' else 2), a['sifraMateriala'], max(0, minu - zal), a['enota']))
vrste.sort(key=lambda v: (v[0], v[1]))
nm = None
for v in vrste:
    if v[2] > 0:
        if nm is None or v[2] > nm[0]:
            nm = (v[2], v[3])

mini_pri = f'Inventura (viden seznam): {artikel_beseda(len(inv))} · pod minimumom {pod} · na meji {na_meji} · premiki {premiki}'
agg_pri = f'{artikel_beseda(len(inv))}, pod minimumom {pod}, na meji {na_meji}'
zeton_red = f'manjka {kolicina_niz(nm[0])} {nm[1]}' if nm else None
json.dump({'n': len(inv), 'pod': pod, 'na_meji': na_meji, 'premiki': premiki,
           'mini': mini_pri, 'agg': agg_pri, 'zeton_red': zeton_red,
           'dot': 'bg-roksal-red' if pod > 0 else ('bg-roksal-amber' if na_meji > 0 else 'bg-roksal-green')},
          open('/tmp/r270-priakovano.json', 'w'))
print(f'pričakovano: {mini_pri}')
print(f'agg: {agg_pri} | žeton RED: {zeton_red} | dot: {json.load(open("/tmp/r270-priakovano.json"))["dot"]}')
PYEOF
eb_pocakaj_na "(()=>{const s=[...document.querySelectorAll('span')].find(x=>x.textContent.indexOf('Inventura (viden seznam)')===0); return !!s && s.textContent.includes('artiklov') && s.textContent.includes(' · pod minimumom ');})()" 24
sleep 1
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Inventura (viden seznam)')===0); const kont=[...document.querySelectorAll('div')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Inventura (viden seznam)')===0;}); const dotRed=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-red'):false; const dotAmber=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-amber'):false; const dotGreen=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-green'):false; const zetoni=kont?[...kont.querySelectorAll('span')].filter(x=>x.className.includes('rounded-full')).map(x=>x.textContent.trim()):[]; return JSON.stringify({miniTekst:mini?mini.textContent.trim():null, dotRed, dotAmber, dotGreen, zetoni, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r270-z2-mini.json
python3 - <<'PYEOF' || exit 1
import json
r = json.load(open('/tmp/r270-z2-mini.json'))
d = json.loads(r) if isinstance(r, str) else r
p = json.load(open('/tmp/r270-priakovano.json'))
assert d['miniTekst'] == p['mini'], f"Z2 mini FAIL:\n  dejansko: {d['miniTekst']}\n  pričakovano: {p['mini']}"
assert d.get(p['dot'].replace('bg-roksal-', 'dot').replace('red', 'Red').replace('amber', 'Amber').replace('green', 'Green'), False), f"Z2 dot FAIL: {json.dumps(d)}"
if p['zeton_red']:
    assert any(t == p['zeton_red'] for t in d['zetoni']), f"Z2 žeton RED FAIL: {d['zetoni']} vs {p['zeton_red']}"
print(f"Z2 mini-vrstica OK — {p['mini']} + dot {p['dot']} + žeton ŽIVO")
PYEOF
agent-browser screenshot "$SS/qa-r270-e2e-mini.png" > /dev/null 2>&1

echo "=== Z2b: POST klik — FRESH polna resnica + toast agregat (ISTA dinamična resnica) + PDF NOV glifni razred ==="
eb_zajem_pdf pon270
eb_csv_reset pon270
eb_klik_gumb "Izvozi inventurni pregled premoženja kot PDF"
eb_pocakaj_tekst "Inventurni pregled premoženja prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Inventura-pregled-…pdf — (.+?)\./.exec(t); const b64=window.__pon270; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, agg:agg?agg[1]:null, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228,39094,41009,37560,38744,43572,51142,45074,42769]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), agg:agg?agg[1]:null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r270-z2-pdf.json
python3 - <<'PYEOF' || exit 1
import json
r = json.load(open('/tmp/r270-z2-pdf.json'))
d = json.loads(r) if isinstance(r, str) else r
p = json.load(open('/tmp/r270-priakovano.json'))
assert d['pdf'] and d['magija'] == '%PDF-' and d['novGlifniRazred'], 'Z2b PDF FAIL: ' + json.dumps(d)
assert d['agg'] == p['agg'], f"Z2b agg FAIL: {d['agg']} vs {p['agg']}"
print(f"Z2b PDF OK — {d['bajtov']} bajtov, NOV razred (35 znanih), FRESH polna resnica: {p['agg']}")
PYEOF
agent-browser screenshot "$SS/qa-r270-e2e-pdf.png" > /dev/null 2>&1

echo "=== Z3: regresije ŽIVO lokalno — R268 ekipa pill + R267 CRM pill + R262 pokritost pill (potrditev TAKOJ po vsakem waitu — pill je vezan na tab, r269 vzorec) ==="
eb_dispatch '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled stanja ekipe kot PDF\"]');})()" 24
R268_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi pregled stanja ekipe kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R268: $R268_OK"
sleep 1
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled spomnikov ponudb kot PDF\"]');})()" 24
R267_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi pregled spomnikov ponudb kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R267: $R267_OK"
sleep 1
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pokritost zaloge in osnutkov kot PDF\"]');})()" 24
R262_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi pokritost zaloge in osnutkov kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R262: $R262_OK"
python3 - "$R268_OK" "$R267_OK" "$R262_OK" <<'PYEOF' || exit 1
import json, sys

def parse(raw):
    d = json.loads(raw)
    return json.loads(d) if isinstance(d, str) else d

r268, r267, r262 = parse(sys.argv[1]), parse(sys.argv[2]), parse(sys.argv[3])
assert r268['pill'] and r267['pill'] and r262['pill'], f'Z3 regresije FAIL: {r268} {r267} {r262}'
print('Z3 regresije OK — R268 + R267 + R262 pill ŽIVO (vsak na svojem tabu)')
PYEOF
agent-browser screenshot "$SS/qa-r270-e2e-regresije.png" > /dev/null 2>&1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({temna:document.documentElement.classList.contains('dark'), legendaTemna:t.includes('PDF = VSA zalogovna premoženja'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r270-z4.json
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
python3 -c "import json; r=json.load(open('/tmp/r270-z4.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['temna'] and d['legendaTemna'] and d['err'] is None, 'Z4 temna FAIL: '+json.dumps(d); print('Z4 temna OK — legenda vidna, err null')" || exit 1

echo "=== RESTORE + ODTIS (bajtnata identičnost — ZERO-MUTACIJA) ==="
node scripts/r270-db-e2e.cjs restore
node scripts/r270-db-e2e.cjs fp > /tmp/r270-fp-post.json
if cmp -s /tmp/r270-fp-pre.json /tmp/r270-fp-post.json; then
  echo "ODTIS BAJTNATO IDENTIČEN (pre==post) — ZERO-MUTACIJA dokazana"
else
  echo "ODTIS RAZLIČEN — FAIL"; diff <(python3 -m json.tool /tmp/r270-fp-pre.json) <(python3 -m json.tool /tmp/r270-fp-post.json) | head -20
  exit 1
fi

echo "=== ZAKLJUČEK: strežnik + brskalnik zaprta ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R270 E2E KONEC ==="
