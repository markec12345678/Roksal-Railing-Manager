#!/bin/bash
# R258 E2E ŽIVO (lokalni :3100, ADMIN) — DOBIČKONOST PO PROJEKTIH PDF (14. člen
# 'izvozi' družine: presek prihodkov računov IN stroškov naročil — vodja ŽE
# fetcha oba vira; route NIČ) + regresije R257 (naročila pregled + pretekel rok
# žig), R256 (tedenski), R254 (aria).
# SEED/RESTORE runda: USPEŠNA pot PREJ z naravnim stanjem (1 račun 2026-TEST
# IZDAN 893.04 na 'Terasa Zupan' + 0 naročil → stroški 0.00 — resnica prazne
# vsote), potem raw SQL seed (1 dobavitelj + 3 naročila e2e-r258-o1…o3: o1
# OSNUTEK 450.50 obljuba -3 dni = ZAMUJEN, o2 PREKlicANO 999.99 IZKLJUČEN iz
# stroškov, o3 POSLANO 700 brez projekta IZKLJUČEN iz preseka) → marža 442.54,
# RESTORE → fp pre==post BAJTNATO (ZERO-MUTACIJA).
# DOKAZANE RESNICE (R255 lekcija 7 — vsak dokument svoja iskrena resnica):
#   prej  toast '1 projektov, prihodki 893.04 €, stroški 0.00 €, marža 893.04 €.'
#   potem toast '1 projektov, prihodki 893.04 €, stroški 450.50 €, marža 442.54 €.'
#        (o2 PREKlicANO IN o3 brez projekta IZKLJUČENA — sicer bi stroški bili
#        1450.49 oz. 1150.50 — agregat je dokaz izključitev)
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r258-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R258-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (vključuje MaterialOrder/MOItem/Supplier/Invoice polno resnico) ---"
node scripts/r258-db-e2e.cjs fp > /tmp/r258-fp-pre.json
cat /tmp/r258-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: VODJA tab — R258 pill ŽIVO (VEDNO viden + press-scale + aria-hidden) + legenda ==="
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobičkonosnost projektov kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const dob=id('Izvozi dobičkonosnost projektov kot PDF'); const por=id('Prenesi mesečno PDF poročilo'); const csv=id('Izvozi dnevni pregled vodje kot CSV'); const leg258=document.body.textContent.includes('Prihodki = izdani + plačani računi · Stroški = ne-preklicana naročila · Marža = prihodki − stroški · Marža (%) = marža / prihodki · Brez projekta = izključeni iz preseka'); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({dobPill:!!dob, dobPS:dob?dob.className.includes('press-scale'):false, dobAriaHidden:dob?!!dob.querySelector('svg[aria-hidden=\"true\"]'):false, dobDisabled:dob?dob.disabled:null, porociloPill:!!por, csvPill:!!csv, legenda258:leg258, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r258-e2e-pilli.png" > /dev/null 2>&1

echo "=== Z1b: R258 uspešna pot PREJ (naravno stanje: 1 račun, 0 naročil → stroški 0.00) ==="
eb_zajem_pdf dobpdf
eb_csv_reset dobpdf
eb_klik_gumb "Izvozi dobičkonosnost projektov kot PDF"
eb_pocakaj_tekst "Dobičkonost prenešena v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agregat=/1 projektov, prihodki 893\\.04 €, stroški 0\\.00 €, marža 893\\.04 €\\./.test(t); return JSON.stringify({toastTitle:t.includes('Dobičkonost prenešena v PDF'), toastAgregat:agregat, err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__dobpdf==='string'&&window.__dobpdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__dobpdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r258-e2e-toast.png" > /dev/null 2>&1

echo "=== Z2: SEED (1 dobavitelj + 3 naročila) + reload — presek resnica PO seedu ==="
node scripts/r258-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 2
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobičkonosnost projektov kot PDF\"]');})()" 24
eb_cakaj 3
eb_csv_reset dobpdf2
eb_zajem_pdf dobpdf2
eb_klik_gumb "Izvozi dobičkonosnost projektov kot PDF"
eb_pocakaj_tekst "Dobičkonost prenešena v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agregat=/1 projektov, prihodki 893\\.04 €, stroški 450\\.50 €, marža 442\\.54 €\\./.test(t); const izkljucena=/9\\.4[0-9]{1,3} €/.test(t); return JSON.stringify({toastTitle:t.includes('Dobičkonost prenešena v PDF'), toastAgregat:agregat, err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__dobpdf2==='string'&&window.__dobpdf2.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__dobpdf2; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), drugacnaOdPrej:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r258-e2e-po-seedu.png" > /dev/null 2>&1

echo "=== Z2b: R257 regresija — material orders tab: čipi + pretekel rok žig ŽIVO ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Vsi (3)');})()" 24
eb_cakaj 2
agent-browser eval "(()=>{const t=document.body.textContent; const cipi=t.includes('Vsi (3)')&&t.includes('OSNUTEK (1)')&&t.includes('POSLANO (1)')&&t.includes('PREKlicANO (1)'); const zig=!!document.querySelector('span.text-roksal-red'); return JSON.stringify({statusCipi:cipi, zigPretekelRok:zig, legenda257:t.includes('CSV = vrstica per postavka · PDF = vrstica per naročilo · Pretekel rok = pretekljena obljuba, status še odprt'), err:window.__err??null});})()" 2>&1 | tail -1

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
node scripts/r258-db-e2e.cjs restore
node scripts/r258-db-e2e.cjs fp > /tmp/r258-fp-post.json
cat /tmp/r258-fp-post.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('POST:', d['stevci'])"
if cmp -s /tmp/r258-fp-pre.json /tmp/r258-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — seed/restore bajtnato)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r258-fp-pre.json) <(python3 -m json.tool /tmp/r258-fp-post.json) | head -20; fi

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R258 E2E KONEC ---"
