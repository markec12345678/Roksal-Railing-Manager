#!/bin/bash
# R265 E2E ŽIVO (lokalni :3100, ADMIN) — PROJEKTI — TERMINI PREGLED PDF (21.
# člen 'izvozi' družine: presek /api/schedules × /api/projects, oba vira ŽE
# fetchana; route NIČ) + regresije R264 (pozicija dobaviteljev), R263 (CRM
# pokritost), R255/R256 (vozni red + tedenski), R254 (aria).
# SEED/RESTORE runda: OBE veji dokazani — PREJ naravno stanje (3 projekti,
# 0 terminov) → fail-closed toast 'Ni vpisanih terminov' (veja 1, NI dokumenta);
# potem raw SQL seed (SAMO INSERT — 1 stranka + 3 projekti + 5 terminov:
# proj1 × 4 zmes statusov (preklicana 3h izključena iz vsote), proj3 × 1
# V_TEKU; proj2 plan. montaža brez termina — planska luknja RED) → POST toast
# '2 projekta z termini, 5 terminov, brez termina 4.' + PDF NOV razred,
# RESTORE → fp pre==post BAJTNATO (ZERO-MUTACIJA; Customer + Project +
# InstallationSchedule POLNA resnica v odtisu).
# ⚠️ lekcije: agent-browser eval DVOLIČNO kodiran JSON (pomožnica L());
# toast agregat non-greedy (.+?)\.; bajtna primerjava PRE/POST v python
# layerju (ugnezden eb_zajem_pdf patch DVOKRAT zajame — R263 lekcija 5);
# quoted camelCase stolpci v raw SQL (R257/R263 lekcija).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r265-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R265-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (Customer + Project + InstallationSchedule POLNA resnica) ---"
node scripts/r265-db-e2e.cjs fp > /tmp/r265-fp-pre.json
cat /tmp/r265-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])" || exit 1

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: LOGISTIKA — R265 pill ŽIVO (VEDNO viden + press-scale + ClipboardList aria-hidden) + legenda append ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled projektov in terminov kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const pk=id('Izvozi pregled projektov in terminov kot PDF'); const vr=id('Izvozi vozni red montaž kot PDF'); const td=id('Izvozi tedenski pregled montaž kot PDF'); const t=document.body.textContent; const leg265=t.includes('· Projekti = projekti × termini (pokritost po projektih)'); const leg255Staro=t.includes('CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki) · Tedenski = naslednjih 7 dni (po dnevih)'); const disCount=(document.body.innerHTML.match(/disabled=\"\"/g)||[]).length; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({pkPill:!!pk, pkPS:pk?pk.className.includes('press-scale'):false, pkAriaHidden:pk?!!pk.querySelector('svg[aria-hidden=\"true\"]'):false, pkDisabled:pk?pk.disabled:null, pkTitle:pk?pk.getAttribute('title'):null, vozniPill:!!vr, tedenskiPill:!!td, legenda265:leg265, legenda255StaroIntaktno:leg255Staro, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r265-z1.json
python3 -c "import json; r=json.load(open('/tmp/r265-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pkPill'] and d['pkPS'] and d['pkAriaHidden'] and d['pkDisabled']==False and d['legenda265'] and d['legenda255StaroIntaktno'], 'Z1 resnice FAIL: '+json.dumps(d); print('Z1 preverba OK')" || exit 1
agent-browser screenshot "$SS/qa-r265-e2e-pilli.png" > /dev/null 2>&1

echo "=== Z1b: fail-closed veja (naravno stanje: 0 terminov → 'Ni vpisanih terminov', NI dokumenta) ==="
eb_zajem_pdf poz265pre
eb_csv_reset poz265pre
eb_klik_gumb "Izvozi pregled projektov in terminov kot PDF"
eb_pocakaj_tekst "Ni vpisanih terminov" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({toastTitle:t.includes('Ni vpisanih terminov'), toastOpis:t.includes('Pregled projektov in terminov se izvozi, ko je vpisan prvi termin montaže.'), niDokumenta:!(typeof window.__poz265pre==='string'&&window.__poz265pre.length>0), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r265-z1b.json
python3 -c "import json; r=json.load(open('/tmp/r265-z1b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['toastTitle'] and d['toastOpis'] and d['niDokumenta'], 'Z1b fail-closed FAIL: '+json.dumps(d); print('Z1b fail-closed veja OK (ni dokumenta — ni prazne datoteke)')" || exit 1
agent-browser screenshot "$SS/qa-r265-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: SEED (1 stranka + 3 projekti + 5 terminov) + reload — uspešna veja ==="
node scripts/r265-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 2
# Lekcija R265: pill je VEDNO viden (P1-k) — viden je PRED podatki; logistika
# fetcha VEČ virov (schedules+projects+crews+equipment) → klik OB praznem
# schedules state sproži fail-closed toast (iskren, ampak napačna veja).
# POLN RELOAD po seedu = deterministični sveži fetchi (brez SPA stanja) —
# session cookie preživi; vodič se ponovno zapri (idempotentno).
agent-browser open "$EB_BASE" > /dev/null 2>&1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Odjava\"]');})()" 24
eb_zapri_vodic
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled projektov in terminov kot PDF\"]');})()" 24
# Čakamo na PEČAT 'Osveženo ob' (R170 — nastavljen SAMO po uspešnem branju
# VSEH virov) + SEED PODATEK na seznamu (dokaz: schedules state naložen).
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Osveženo ob') && document.body.textContent.includes('E2E Termini Blok A');})()" 24
eb_zajem_pdf poz265
eb_csv_reset poz265
eb_klik_gumb "Izvozi pregled projektov in terminov kot PDF"
eb_pocakaj_tekst "Pregled projektov in terminov prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Projekti-termini-…pdf — (.+?)\./.exec(t); return JSON.stringify({toastTitle:t.includes('Pregled projektov in terminov prenešen v PDF'), toastAgregat:agg?agg[1]:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r265-z2.json
cat /tmp/r265-z2.json
python3 -c "
import json
r=json.load(open('/tmp/r265-z2.json')); d=json.loads(r) if isinstance(r,str) else r
assert d['toastTitle'] and d['toastAgregat']=='2 projekta z termini, 5 terminov, brez termina 4', 'Z2 toast FAIL: '+json.dumps(d)
print('Z2 toast OK —', d['toastAgregat'], '(sklanjatev ŽIVO: 2 projekta, 5 terminov)')
" || exit 1
eb_pocakaj_na "(()=>{return typeof window.__poz265==='string'&&window.__poz265.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__poz265; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228,39094,41009,37560]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r265-z2-pdf.json
python3 -c "import json; r=json.load(open('/tmp/r265-z2-pdf.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-' and d['novGlifniRazred'], 'Z2 PDF FAIL: '+json.dumps(d); print('Z2 PDF OK —', d['bajtov'], 'bajtov, NOV razred (30 znanih)')" || exit 1
agent-browser screenshot "$SS/qa-r265-e2e-po-seedu.png" > /dev/null 2>&1

echo "=== Z2b: R255/R256 regresija — vozni red + tedenski pilli ŠE VEDNO ŽIVO + legenda R255 dobesedno ==="
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; return JSON.stringify({vozniPill:!!id('Izvozi vozni red montaž kot PDF'), tedenskiPill:!!id('Izvozi tedenski pregled montaž kot PDF'), csvPill:!!id('Izvozi vidne termine kot CSV'), icsPill:!!id('Izvozi termine montaže kot koledarsko datoteko (.ics)'), legendaR256:t.includes('Tedenski = naslednjih 7 dni (po dnevih)'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: R264 regresija — material suppliers pozicija pill ŠE ŽIVO ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pozicijo dobaviteljev kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({r264Pill:!!document.querySelector('button[aria-label=\"Izvozi pozicijo dobaviteljev kot PDF\"]'), legenda264:t.includes('Pozicija = dobavitelji × najnižja per artikel'), ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== Z5: RESTORE + prstni odtis post BAJTNATO == pre ==="
agent-browser close --all > /dev/null 2>&1
node scripts/r265-db-e2e.cjs restore
node scripts/r265-db-e2e.cjs fp > /tmp/r265-fp-post.json
cat /tmp/r265-fp-post.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('POST:', d['stevci'])" || exit 1
if cmp -s /tmp/r265-fp-pre.json /tmp/r265-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — seed/restore bajtnato)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r265-fp-pre.json) <(python3 -m json.tool /tmp/r265-fp-post.json) | head -20; fi

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R265 E2E KONEC ---"
