#!/bin/bash
# R267 E2E ŽIVO (lokalni :3100, ADMIN) — PONUDBE — SPOMNIŠKI PREGLED PDF (23.
# člen 'izvozi' družine: FRESH /api/projects — polna resnica vloge, vključno s
# podpisanimi; route NIČ) + regresije R266 (oprema-cikel), R265 (projekti-
# termini), R254 (aria), R263 (mini-vrstica).
# Naravno stanje dev DB: 3 projekti (1 dealLocked, 0 followUpov) → mini
# state-oka '2 ponudbi · brez spomnika 2' + AMBER žeton + GREEN dot (veja 2a);
# fail-closed veja 'Ni vpisanih ponudb' dokazana z fetch stubom [] (r211
# precedens — NIČ DB mutacij, stub RESTAVRIRAN); SEED (SAMO INSERT — 1
# stranka + 5 projektov: zapadel / danes / kmalu / PODPISANA zgodovina / brez
# spomnika) → POLN reload → mini '4 ponudbe · zapadel 1 · spomnik danes 1 ·
# brez spomnika 1' + RED dot + žetona → POST toast 'Ponudbe-spomniki-…pdf —
# 5 ponudb, zapadel spomnik 1, podpisanih 1.' (FRESH = polna resnica —
# vključno s podpisano!) + PDF NOV razred, RESTORE → fp pre==post BAJTNATO
# (ZERO-MUTACIJA; Customer + Project POLNA resnica).
# ⚠️ lekcije: agent-browser eval DVOLIČNO kodiran JSON (python dvojni
# json.loads); toast agregat non-greedy (.+?)\.; mini-vrstica textContent
# ZLEPI žeton (R266 lekcija 3) — mini span DIREKTNO (startsWith) + dot =
# class query; POLN reload po seedu (R265 lekcija 1); Oprema subtab NE izriše
# pečata 'Osveženo ob' (R266 lekcija 4); quoted camelCase stolpci v raw SQL.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r267-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R267-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

# pomožnica: klik subtaba po tekstu (navaden Button — Radix NI v igri)
klik_subtab() {
  agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='$1'); if(!b) return 'ni subtaba'; b.click(); return 'klik';})()" 2>&1 | tail -1
}

echo "--- PRSTNI ODTIS PRE (Customer + Project POLNA resnica + regresija širine) ---"
node scripts/r267-db-e2e.cjs fp > /tmp/r267-fp-pre.json
cat /tmp/r267-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])" || exit 1

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: CRM — R267 pill ŽIVO (VEDNO viden + press-scale + FileDown aria-hidden) + legenda + mini-vrstica (naravno stanje: 2 odprti brez spomnika) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled spomnikov ponudb kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; const pk=id('Izvozi pregled spomnikov ponudb kot PDF'); const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Spomniki (viden seznam)')===0); const kont=[...document.querySelectorAll('div')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Spomniki (viden seznam)')===0;}); const dotGreen=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-green'):false; const dotRed=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-red'):false; const zetonAmber=t.includes('2 brez spomnika'); return JSON.stringify({pill:!!pk, ps:pk?pk.className.includes('press-scale'):false, ariaHidden:pk?!!pk.querySelector('svg[aria-hidden=\"true\"]'):false, disabled:pk?pk.disabled:null, title:pk?pk.getAttribute('title'):null, legenda:t.includes('PDF = VSE ponudbe (tudi podpisane — polna resnica, ne samo viden seznam)'), miniTekst:mini?mini.textContent.trim():null, dotGreen, dotRed, zetonAmber, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r267-z1.json
python3 -c "import json; r=json.load(open('/tmp/r267-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['ps'] and d['ariaHidden'] and d['disabled']==False and d['legenda'] and d['dotGreen'] and not d['dotRed'] and d['zetonAmber'] and d['ariaR254']['vsePokrite'], 'Z1 resnice FAIL: '+json.dumps(d); assert d['miniTekst']=='Spomniki (viden seznam): 2 ponudbi · zapadel 0 · spomnik danes 0 · brez spomnika 2', 'Z1 mini FAIL (naravno stanje): '+json.dumps(d); print('Z1 preverba OK — pill ŽIVO + legenda pariteta + mini naravno stanje (2 ponudbi brez spomnika, GREEN dot, AMBER žeton)')" || exit 1
print_mini() { python3 -c "import json; r=json.load(open('$1')); d=json.loads(r) if isinstance(r,str) else r; print('mini:', d['miniTekst'])" || exit 1; }
print_mini /tmp/r267-z1.json
agent-browser screenshot "$SS/qa-r267-e2e-pill.png" > /dev/null 2>&1

echo "=== Z1b: fail-closed veja (fetch stub [] — r211 precedens, NIČ DB mutacij; stub RESTAVRIRAN) ==="
eb_zajem_pdf pon267pre
eb_csv_reset pon267pre
agent-browser eval "(()=>{window.__origFetch=window.fetch; window.fetch=(u,...a)=>String(u).includes('/api/projects')?Promise.resolve(new Response(JSON.stringify([]),{status:200})):window.__origFetch(u,...a); return 'stubbed';})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi pregled spomnikov ponudb kot PDF"
eb_pocakaj_tekst "Ni vpisanih ponudb" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({toastTitle:t.includes('Ni vpisanih ponudb'), toastOpis:t.includes('Pregled spomnikov se izvozi, ko je vpisana prva ponudba.'), niDokumenta:!(typeof window.__pon267pre==='string'&&window.__pon267pre.length>0), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r267-z1b.json
python3 -c "import json; r=json.load(open('/tmp/r267-z1b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['toastTitle'] and d['toastOpis'] and d['niDokumenta'], 'Z1b fail-closed FAIL: '+json.dumps(d); print('Z1b fail-closed veja OK (ni dokumenta — ni prazne datoteke)')" || exit 1
agent-browser eval "(()=>{window.fetch=window.__origFetch; return 'restored';})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r267-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: SEED (1 stranka + 5 projektov — vse veje + zgodovinska cona) + POLN reload — mini-vrstica + žetona + RED dot ==="
node scripts/r267-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 2
# Lekcija R265: pill je VEDNO viden — viden je PRED podatki; POLN RELOAD po
# seedu = deterministični sveži fetchi; session cookie preživi.
agent-browser open "$EB_BASE" > /dev/null 2>&1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Odjava\"]');})()" 24
eb_zapri_vodic
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled spomnikov ponudb kot PDF\"]');})()" 24
# Čakamo na SEED PODATEK (dokaz: projects state naložen — zapadla E2E vrstica).
eb_pocakaj_na "(()=>{return document.body.textContent.includes('E2E Spomniki Blok A — Zapadel');})()" 24
sleep 1
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Spomniki (viden seznam)')===0); const kont=[...document.querySelectorAll('div')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Spomniki (viden seznam)')===0;}); const dotRed=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-red'):false; return JSON.stringify({miniTekst:mini?mini.textContent.trim():null, dotRed, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r267-z2-mini.json
python3 -c "
import json
r=json.load(open('/tmp/r267-z2-mini.json')); d=json.loads(r) if isinstance(r,str) else r
# 6 = 4 sejane odprte (proj1 zapadel / proj2 danes / proj3 kmalu / proj5 brez) + 2
# naravna dev projekta (Novak + Kokalj — brez spomnika); proj4 ZAKLJUCENO je
# izključena iz videnega seznama (state = !dealLocked && status !== ZAKLJUCENO).
assert d['miniTekst']=='Spomniki (viden seznam): 6 ponudb · zapadel 1 · spomnik danes 1 · brez spomnika 3', 'Z2 mini FAIL: '+json.dumps(d)
assert d['dotRed'], 'Z2 dot FAIL: '+json.dumps(d)
print('Z2 mini-vrstica OK — 6 ponudb · zapadel 1 · spomnik danes 1 · brez spomnika 3 + RED dot ŽIVO')
" || exit 1
agent-browser screenshot "$SS/qa-r267-e2e-mini.png" > /dev/null 2>&1

echo "=== Z2b: POST klik — FRESH polna resnica (vključno s podpisano!) + toast agregat + PDF NOV glifni razred ==="
eb_zajem_pdf pon267
eb_csv_reset pon267
eb_klik_gumb "Izvozi pregled spomnikov ponudb kot PDF"
eb_pocakaj_tekst "Pregled ponudb prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Ponudbe-spomniki-…pdf — (.+?)\./.exec(t); const b64=window.__pon267; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, agg:agg?agg[1]:null, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228,39094,41009,37560,38744,43572]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), agg:agg?agg[1]:null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r267-z2-pdf.json
python3 -c "import json; r=json.load(open('/tmp/r267-z2-pdf.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-' and d['novGlifniRazred'] and d['agg']=='8 ponudb, zapadel spomnik 1, podpisanih 2', 'Z2b PDF FAIL: '+json.dumps(d); print('Z2b PDF OK —', d['bajtov'], 'bajtov, NOV razred (32 znanih), FRESH polna resnica: 8 ponudb (3 naravne + 5 sejanih), zapadel 1, podpisanih 2 (naravni Zupan + sejana proj4)')" || exit 1
agent-browser screenshot "$SS/qa-r267-e2e-pdf.png" > /dev/null 2>&1

echo "=== Z3: regresije ŽIVO lokalno — R265 projekti-termini pill + R266 oprema pill (mini SKRITA pri 0 opreme — iskrena praznina) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled projektov in terminov kot PDF\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); return JSON.stringify({r265Pill:!!id('Izvozi pregled projektov in terminov kot PDF'), err:window.__err??null});})()" 2>&1 | tail -1
klik_subtab "Oprema"
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot PDF\"]');})()" 14
sleep 1
agent-browser eval "(()=>{const oc=document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot PDF\"]'); const t=document.body.textContent; return JSON.stringify({r266Pill:!!oc, r266Legenda:t.includes('PDF = življenjski cikl VSE opreme (pregledi · kalibracije · statusi — polna resnica, ne samo viden seznam)'), r266MiniSkrita0Opreme:!t.includes('Cikl (viden seznam)'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r267-z3.json
python3 -c "import json; r=json.load(open('/tmp/r267-z3.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['r266Pill'] and d['r266Legenda'] and d['r266MiniSkrita0Opreme'], 'Z3 FAIL: '+json.dumps(d); print('Z3 regresije OK — R266 pill + legenda ŽIVO, mini skrita pri 0 opreme (iskrena praznina)')" || exit 1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== RESTORE + prstni odtis POST (bajtnata identičnost = ZERO-MUTACIJA) ==="
node scripts/r267-db-e2e.cjs restore
node scripts/r267-db-e2e.cjs fp > /tmp/r267-fp-post.json
if cmp -s /tmp/r267-fp-pre.json /tmp/r267-fp-post.json; then echo "ODTIS BAJTNATO IDENTIČEN (pre==post) — ZERO-MUTACIJA OK"; else echo "ODTIS RAZLIČEN — FAIL!"; diff <(python3 -m json.tool /tmp/r267-fp-pre.json) <(python3 -m json.tool /tmp/r267-fp-post.json) | head -20; fi

echo "=== ZAKLJUČEK: brskalnik + strežnik zaprti ==="
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R267 E2E KONEC ==="
