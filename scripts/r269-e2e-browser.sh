#!/bin/bash
# R269 E2E ŽIVO (lokalni :3100, ADMIN) — MERITVE — TERENSKI PREGLED PDF (25.
# člen 'izvozi' družine: FRESH /api/measurements?projectId — polna resnica
# projekta, tudi arhivirane; route NIČ) + regresije R268 (ekipa-stanje), R267
# (spomniki), R266 (oprema-cikel), R254 (aria).
# SEBE-VSEBUJOČ seed v DVEH FAZAH (lekcija iz 1. teka: projekt MORA obstajati
# PRED fail-closed preizkusom, drugače endpoint vrne 404 'Projekt ne obstaja'
# — toast 'Izvoz ni uspel', NE naravna prazna veja!): seed-base PRVN (1
# stranka + 1 projekt 'E2E Teren Blok A', BREZ meritev) → Z1 pill + legenda +
# mini SKRITA pri 0 meritev (iskrena praznina); Z1b fail-closed veja NARAVNA
# (projekt resnično brez meritev): 'Ni vpisanih meritev' + NIČ dokumenta.
# seed-meritve (4: OSNUTEK z oznako / OSNUTEK brez oznake — iskren odpad,
# prazen arMetadata → tip fallback RAZDALJA / POTRJENA / ARHIVIRANA
# zgodovina) → POLN reload → roksal:select-project → mini 'Meritve (viden
# seznam): 4 meritve · osnutki 2 · potrjenih 1 · arhiviranih 1' + AMBER dot +
# žeton '2 osnutki' → POST toast 'Meritve-teren-…pdf — 4 meritve, osnutki 2,
# potrjenih 1, arhiviranih 1.' (FRESH = ISTA resnica — endpoint brez
# paginacije) + PDF NOV razred ≠ 34 znanih, RESTORE → fp pre==post BAJTNATO
# (ZERO-MUTACIJA; Measurement + Customer + Project POLNA resnica).
# ⚠️ lekcije: agent-browser eval DVOLIČNO kodiran JSON (python dvojni
# json.loads); POLN reload po seedu + PONOVNA izbira projekta (page state se
# resetira — roksal:select-project detail = string id, page.tsx pogodba);
# mini-vrstica: mini span DIREKTNO (startsWith) + dot = class query v
# vsebniku (R266/R267 lekcije 3/4); async fetch v eval = dvokorki vzorec
# (window.__var + sleep + drugi eval — NIČ await v eval, R268 lekcija 7);
# quoted camelCase stolpci v raw SQL.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r269-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R269-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

# pomožnica: izbira projekta prek page.tsx dogodka (detail = string id)
izberi_projekt() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r269-proj1'})); return 'izbran';})()" 2>&1 | tail -1
}

echo "--- PRSTNI ODTIS PRE (Measurement + Customer + Project POLNA resnica + regresija širine) ---"
node scripts/r269-db-e2e.cjs fp > /tmp/r269-fp-pre.json
cat /tmp/r269-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])" || exit 1

echo "--- SEED-BASE (1 stranka + 1 projekt — BREZ meritev; Z1b = naravna fail-closed veja) ---"
node scripts/r269-db-e2e.cjs seed-base

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Meritve — R269 pill ŽIVO (VEDNO viden pri izbranem projektu + press-scale + FileDown aria-hidden) + legenda; mini SKRITA pri 0 meritev (iskrena praznina) ==="
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; const pk=id('Izvozi terenski pregled meritev kot PDF'); return JSON.stringify({pill:!!pk, ps:pk?pk.className.includes('press-scale'):false, ariaHidden:pk?!!pk.querySelector('svg[aria-hidden=\"true\"]'):false, disabled:pk?pk.disabled:null, title:pk?pk.getAttribute('title'):null, legenda:t.includes('PDF = VSE meritve projekta (tudi arhivirane — polna resnica, ne samo viden seznam filtrov)'), miniSkrita0Meritev:!t.includes('Meritve (viden seznam)'), ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r269-z1.json
python3 -c "import json; r=json.load(open('/tmp/r269-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['ps'] and d['ariaHidden'] and d['disabled']==False and d['legenda'] and d['miniSkrita0Meritev'] and d['ariaR254']['vsePokrite'], 'Z1 resnice FAIL: '+json.dumps(d); print('Z1 preverba OK — pill ŽIVO + legenda pariteta + mini SKRITA pri 0 meritev (iskrena praznina)')" || exit 1
agent-browser screenshot "$SS/qa-r269-e2e-pill.png" > /dev/null 2>&1

echo "=== Z1b: fail-closed veja NARAVNA (seed projekt resnično brez meritev — NIČ stuba, NIČ mutacij) ==="
eb_zajem_pdf pon269pre
eb_csv_reset pon269pre
eb_klik_gumb "Izvozi terenski pregled meritev kot PDF"
eb_pocakaj_tekst "Ni vpisanih meritev" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({toastTitle:t.includes('Ni vpisanih meritev'), toastOpis:t.includes('Terenski pregled se izvozi, ko je vpisana prva meritev projekta.'), niDokumenta:!(typeof window.__pon269pre==='string'&&window.__pon269pre.length>0), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r269-z1b.json
python3 -c "import json; r=json.load(open('/tmp/r269-z1b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['toastTitle'] and d['toastOpis'] and d['niDokumenta'], 'Z1b fail-closed FAIL: '+json.dumps(d); print('Z1b fail-closed veja OK (naravno prazen projekt — ni dokumenta, ni prazne datoteke)')" || exit 1
agent-browser screenshot "$SS/qa-r269-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: SEED-MERITVE (4 meritve — vse veje statusov; projekt obstaja od seed-base) + POLN reload + ponovna izbira projekta — mini-vrstica + žeton + AMBER dot ==="
node scripts/r269-db-e2e.cjs seed-meritve
agent-browser open "$EB_BASE" > /dev/null 2>&1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Odjava\"]');})()" 24
eb_zapri_vodic
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
# Čakamo na SEED PODATEK (mini-vrstica = state — zraste po naloženih meritvah).
eb_pocakaj_na "(()=>{const s=[...document.querySelectorAll('span')].find(x=>x.textContent.indexOf('Meritve (viden seznam)')===0); return !!s && s.textContent.includes('4 meritve');})()" 24
sleep 1
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Meritve (viden seznam)')===0); const kont=[...document.querySelectorAll('div')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Meritve (viden seznam)')===0;}); const dotAmber=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-amber'):false; const dotGreen=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-green'):false; const zeton=/\d+ osnutk/.test(kont?kont.textContent:''); return JSON.stringify({miniTekst:mini?mini.textContent.trim():null, dotAmber, dotGreen, zeton, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r269-z2-mini.json
python3 -c "
import json
r=json.load(open('/tmp/r269-z2-mini.json')); d=json.loads(r) if isinstance(r,str) else r
assert d['miniTekst']=='Meritve (viden seznam): 4 meritve · osnutki 2 · potrjenih 1 · arhiviranih 1', 'Z2 mini FAIL: '+json.dumps(d)
assert d['dotAmber'] and not d['dotGreen'], 'Z2 dot FAIL: '+json.dumps(d)
assert d['zeton'], 'Z2 žeton FAIL: '+json.dumps(d)
print('Z2 mini-vrstica OK — 4 meritve · osnutki 2 · potrjenih 1 · arhiviranih 1 + AMBER dot + žeton ŽIVO')
" || exit 1
agent-browser screenshot "$SS/qa-r269-e2e-mini.png" > /dev/null 2>&1

echo "=== Z2b: POST klik — FRESH polna resnica + toast agregat + PDF NOV glifni razred ==="
eb_zajem_pdf pon269
eb_csv_reset pon269
eb_klik_gumb "Izvozi terenski pregled meritev kot PDF"
eb_pocakaj_tekst "Terenski pregled meritev prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Meritve-teren-…pdf — (.+?)\./.exec(t); const b64=window.__pon269; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, agg:agg?agg[1]:null, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228,39094,41009,37560,38744,43572,51142,45074]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), agg:agg?agg[1]:null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r269-z2-pdf.json
python3 -c "import json; r=json.load(open('/tmp/r269-z2-pdf.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-' and d['novGlifniRazred'] and d['agg']=='4 meritve, osnutki 2, potrjenih 1, arhiviranih 1', 'Z2b PDF FAIL: '+json.dumps(d); print('Z2b PDF OK —', d['bajtov'], 'bajtov, NOV razred (34 znanih), FRESH polna resnica: 4 meritve (vse veje statusov), osnutki 2, potrjenih 1, arhiviranih 1')" || exit 1
agent-browser screenshot "$SS/qa-r269-e2e-pdf.png" > /dev/null 2>&1

echo "=== Z3: regresije ŽIVO lokalno — R268 ekipa pill (ADMIN canRead) + R267 CRM pill + R266 oprema pill (mini SKRITA pri 0 opreme — iskrena praznina) ==="
eb_dispatch '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled stanja ekipe kot PDF\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; return JSON.stringify({r268Pill:!!id('Izvozi pregled stanja ekipe kot PDF'), r268Legenda:t.includes('PDF = celotna ekipa (trenutna resnica ob kliku — FRESH /api/users, ne zastarel state)'), err:window.__err??null});})()" 2>&1 | tail -1
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled spomnikov ponudb kot PDF\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); return JSON.stringify({r267Pill:!!id('Izvozi pregled spomnikov ponudb kot PDF'), err:window.__err??null});})()" 2>&1 | tail -1
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled projektov in terminov kot PDF\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Oprema'); if(!b) return 'ni subtaba'; b.click(); return 'klik';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot PDF\"]');})()" 14
sleep 1
agent-browser eval "(()=>{const oc=document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot PDF\"]'); const t=document.body.textContent; return JSON.stringify({r266Pill:!!oc, r266Legenda:t.includes('PDF = življenjski cikl VSE opreme (pregledi · kalibracije · statusi — polna resnica, ne samo viden seznam)'), r266MiniSkrita0Opreme:!t.includes('Cikl (viden seznam)'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r269-z3.json
python3 -c "import json; r=json.load(open('/tmp/r269-z3.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['r266Pill'] and d['r266Legenda'] and d['r266MiniSkrita0Opreme'], 'Z3 FAIL: '+json.dumps(d); print('Z3 regresije OK — R266 pill + legenda ŽIVO, mini skrita pri 0 opreme (iskrena praznina)')" || exit 1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== RESTORE + prstni odtis POST (bajtnata identičnost = ZERO-MUTACIJA) ==="
node scripts/r269-db-e2e.cjs restore
node scripts/r269-db-e2e.cjs fp > /tmp/r269-fp-post.json
if cmp -s /tmp/r269-fp-pre.json /tmp/r269-fp-post.json; then echo "ODTIS BAJTNATO IDENTIČEN (pre==post) — ZERO-MUTACIJA OK"; else echo "ODTIS RAZLIČEN — FAIL!"; diff <(python3 -m json.tool /tmp/r269-fp-pre.json) <(python3 -m json.tool /tmp/r269-fp-post.json) | head -20; fi

echo "=== ZAKLJUČEK: brskalnik + strežnik zaprti ==="
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R269 E2E KONEC ==="
