#!/bin/bash
# R262 E2E ŽIVO (lokalni :3100, ADMIN) — ZALOGA — OSNUTEK POKRITOST PDF (18.
# člen 'izvozi' družine: presek zaloge IN OSNUTEK naročil po identiteti
# artikla — tab ŽE fetcha oba vira; route NIČ) + regresije R261 (računi po
# projektih), R257 (naročila pregled + pretekel rok), R256 (tedenski), R254
# (aria).
# SEED/RESTORE runda: USPEŠNA pot PREJ z naravnim stanjem (8 artiklov, 0
# naročil → 1 vrstica INOX-M12-A4 NEPOKRITO 0 %), potem raw SQL seed (SAMO
# INSERT — 1 dobavitelj + o1 OSNUTEK: INOX 40 kos + ALU-PROF-40 100 m; o2
# POSLAN: WPC-120-B 999 m NE ŠTEJE — obljuba ≠ nabava) → 2 artiklov, pokrito
# 140 enot iz 1 osnutkov, nepokritih 0, RESTORE → fp pre==post BAJTNATO
# (ZERO-MUTACIJA).
# DOKAZANE RESNICE (R255 lekcija 7 — vsak dokument svoja iskrena resnica):
#   prej  toast '1 artiklov, pokrito 0 enot iz 0 osnutkov, nepokritih 1.'
#         + F2 žig '1 nepokritih pod minimumom' ŽIVO (naravni deficit)
#   potem toast '2 artiklov, pokrito 140 enot iz 1 osnutkov, nepokritih 0.'
#         (o2 POSLAN 999 NE ŠTEJE — sicer bi pokrito bilo 1139 — agregat je
#         dokaz izključitve; F2 žig skrit — nepokritih 0)
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r262-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R262-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (Inventory + MaterialOrder/MOItem/Supplier polna resnica) ---"
node scripts/r262-db-e2e.cjs fp > /tmp/r262-fp-pre.json
cat /tmp/r262-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: NAROČILA subTab — R262 pill ŽIVO (VEDNO viden + press-scale + aria-hidden) + legenda append + F2 mini-vrstica ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pokritost zaloge in osnutkov kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const pok=id('Izvozi pokritost zaloge in osnutkov kot PDF'); const narp=id('Izvozi naročila kot PDF'); const csv=id('Izvozi naročila kot CSV'); const t=document.body.textContent; const mini=t.includes('Pokritost osnutka:'); const zig=t.includes('nepokritih pod minimumom'); const leg262=t.includes('Pokritost = zaloga × osnutki (OSNUTEK) po identiteti artikla'); const leg257Staro=t.includes('Pretekel rok = pretekljena obljuba, status še odprt'); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({pokPill:!!pok, pokPS:pok?pok.className.includes('press-scale'):false, pokAriaHidden:pok?!!pok.querySelector('svg[aria-hidden=\"true\"]'):false, pokDisabled:pok?pok.disabled:null, narocilaPill:!!narp, csvPill:!!csv, miniVrstica:mini, zigNepokritih:zig, legenda262:leg262, legenda257StaroIntaktno:leg257Staro, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r262-e2e-pilli.png" > /dev/null 2>&1

echo "=== Z1b: R262 uspešna pot PREJ (naravno stanje: 8 artiklov, 0 naročil → 1 NEPOKRITO) ==="
eb_zajem_pdf pok262
eb_csv_reset pok262
eb_klik_gumb "Izvozi pokritost zaloge in osnutkov kot PDF"
eb_pocakaj_tekst "Pokritost prenešena v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agregat=/1 artiklov, pokrito 0 enot iz 0 osnutkov, nepokritih 1\\./.test(t); return JSON.stringify({toastTitle:t.includes('Pokritost prenešena v PDF'), toastAgregat:agregat, err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__pok262==='string'&&window.__pok262.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pok262; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r262-e2e-toast.png" > /dev/null 2>&1

echo "=== Z2: SEED (1 dobavitelj + OSNUTEK 2 postavki + POSLAN 1 postavka) + reload — presek PO seedu ==="
node scripts/r262-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 2
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pokritost zaloge in osnutkov kot PDF\"]');})()" 24
eb_cakaj 3
eb_csv_reset pok262b
eb_zajem_pdf pok262b
eb_klik_gumb "Izvozi pokritost zaloge in osnutkov kot PDF"
eb_pocakaj_tekst "Pokritost prenešena v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agregat=/2 artiklov, pokrito 140 enot iz 1 osnutkov, nepokritih 0\\./.test(t); const zigSkrit=!t.includes('nepokritih pod minimumom'); return JSON.stringify({toastTitle:t.includes('Pokritost prenešena v PDF'), toastAgregat:agregat, zigSkritNepokritih0:zigSkrit, err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__pok262b==='string'&&window.__pok262b.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pok262b; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), drugacnaOdPrej:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r262-e2e-po-seedu.png" > /dev/null 2>&1

echo "=== Z2b: R257 regresija — naročila pregled pill ŠE VEDNO ŽIVO + čipi ==="
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Vsi (2)');})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const cipi=t.includes('Vsi (2)')&&t.includes('OSNUTEK (1)')&&t.includes('POSLANO (1)'); const leg257=t.includes('Pretekel rok = pretekljena obljuba, status še odprt'); return JSON.stringify({statusCipi:cipi, legenda257:leg257, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: R256 regresija — logistika tedenski fail-closed + aria ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi tedenski pregled montaž kot PDF\"]');})()" 24
sleep 2
eb_klik_gumb "Izvozi tedenski pregled montaž kot PDF"
eb_pocakaj_tekst "Ni terminov v naslednjih 7 dneh" 14
agent-browser eval "(()=>{const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({r256:t.includes('Ni terminov v naslednjih 7 dneh'), legenda256:t.includes('Tedenski = naslednjih 7 dni (po dnevih)'), ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== Z5: RESTORE + prstni odtis post BAJTNATO == pre ==="
agent-browser close --all > /dev/null 2>&1
node scripts/r262-db-e2e.cjs restore
node scripts/r262-db-e2e.cjs fp > /tmp/r262-fp-post.json
cat /tmp/r262-fp-post.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('POST:', d['stevci'])"
if cmp -s /tmp/r262-fp-pre.json /tmp/r262-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — seed/restore bajtnato)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r262-fp-pre.json) <(python3 -m json.tool /tmp/r262-fp-post.json) | head -20; fi

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R262 E2E KONEC ---"
