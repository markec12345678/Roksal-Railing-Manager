#!/bin/bash
# R261 E2E ŽIVO (lokalni :3100, ADMIN) — RAČUNI PO PROJEKTIH PDF (17. člen
# 'izvozi' družine: presek ponudbe (shranjen estimatedPrice) IN realizacije
# (računi) — vodja ŽE fetcha oba vira; route NIČ) + regresije R258
# (dobičkonost), R257 (naročila pregled), R256 (tedenski), R254 (aria).
# SEED/RESTORE runda: USPEŠNA pot PREJ z naravnim stanjem (3 projekti VSE z
# estimatedPrice: Kokalj 1980 + Novak 2850 + Terasa 4320 = 9150.00; 1 račun
# 2026-TEST IZDAN 893.04 na Terasa → realizirano 893.04, odstopanje -8256.96),
# potem raw SQL seed (1 projekt BREZ ponudbe 'E2E R261 Brez Ponudbe' +
# računa 2026-E2E261-1 IZDAN 250 na njem + 2026-E2E261-2 PLACAN 50 na Terasa)
# → realizirano 1193.04, odstopanje -8206.96, brez ponudbe 1,
# RESTORE → fp pre==post BAJTNATO (ZERO-MUTACIJA — SAMO INSERT/DELETE novih
# vrstic, NIČ UPDATE obstoječih).
# DOKAZANE RESNICE (R255 lekcija 7 — vsak dokument svoja iskrena resnica):
#   prej  toast '3 projektov, ponudba 9150.00 €, realizirano 893.04 €, odstopanje -8256.96 €.'
#   potem toast '4 projektov, ponudba 9150.00 €, realizirano 1193.04 €, odstopanje -8206.96 €.'
#        (brez-ponudbe projekt = '—' NIKOLI lažna ničla — sicer bi ponudba
#        bila 9150+izmišljen znesek; i2 PLACAN šteje v realizacijo)
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r261-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R261-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (Project polno + Invoice + MaterialOrder/Supplier resnica) ---"
node scripts/r261-db-e2e.cjs fp > /tmp/r261-fp-pre.json
cat /tmp/r261-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: VODJA tab — R261 pill ŽIVO (VEDNO viden + press-scale + aria-hidden) + legenda append + F2 mini-vrstica ==="
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi račune po projektih kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const rp=id('Izvozi račune po projektih kot PDF'); const dob=id('Izvozi dobičkonosnost projektov kot PDF'); const t=document.body.textContent; const mini=t.includes('Ponudbe v izvedbi'); const zig=t.includes('brez vpisane ponudbe'); const leg261=t.includes('Odstopanje = realizirano − ponudba'); const leg258=t.includes('Brez projekta = izključeni iz preseka'); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({rpPill:!!rp, rpPS:rp?rp.className.includes('press-scale'):false, rpAriaHidden:rp?!!rp.querySelector('svg[aria-hidden=\"true\"]'):false, rpDisabled:rp?rp.disabled:null, dobPill:!!dob, miniVrstica:mini, zigBrezPonudbe:zig, legenda261:leg261, legenda258StaroIntaktno:leg258, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r261-e2e-pilli.png" > /dev/null 2>&1

echo "=== Z1b: R261 uspešna pot PREJ (naravno stanje: 3 projekti z ponudbo 9150, 1 račun 893.04) ==="
eb_zajem_pdf rp261
eb_csv_reset rp261
eb_klik_gumb "Izvozi račune po projektih kot PDF"
eb_pocakaj_tekst "Računi po projektih prenešeni v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agregat=/3 projektov, ponudba 9150\\.00 €, realizirano 893\\.04 €, odstopanje -8256\\.96 €\\./.test(t); return JSON.stringify({toastTitle:t.includes('Računi po projektih prenešeni v PDF'), toastAgregat:agregat, err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__rp261==='string'&&window.__rp261.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__rp261; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r261-e2e-toast.png" > /dev/null 2>&1

echo "=== Z2: SEED (1 projekt brez ponudbe + 2 računa) + reload — presek resnica PO seedu ==="
node scripts/r261-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 2
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi račune po projektih kot PDF\"]');})()" 24
eb_cakaj 3
eb_csv_reset rp261b
eb_zajem_pdf rp261b
eb_klik_gumb "Izvozi račune po projektih kot PDF"
eb_pocakaj_tekst "Računi po projektih prenešeni v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agregat=/4 projektov, ponudba 9150\\.00 €, realizirano 1193\\.04 €, odstopanje -8206\\.96 €\\./.test(t); const zig=/1 brez vpisane ponudbe/.test(t); return JSON.stringify({toastTitle:t.includes('Računi po projektih prenešeni v PDF'), toastAgregat:agregat, zigBrezPonudbePoSeedu:zig, err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__rp261b==='string'&&window.__rp261b.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__rp261b; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), drugacnaOdPrej:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r261-e2e-po-seedu.png" > /dev/null 2>&1

echo "=== Z2b: R258 regresija — dobičkonost pill ŠE VEDNO ŽIVO (isti vir, brat nespremenjen) ==="
eb_klik_gumb "Izvozi dobičkonosnost projektov kot PDF"
eb_pocakaj_tekst "Dobičkonost prenešena v PDF" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r258Toast:t.includes('Dobičkonost prenešena v PDF'), r258Agregat:/2 projektov, prihodki 1193\\.04 €, stroški 0\\.00 €, marža 1193\\.04 €\\./.test(t), err:window.__err??null});})()" 2>&1 | tail -1

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
node scripts/r261-db-e2e.cjs restore
node scripts/r261-db-e2e.cjs fp > /tmp/r261-fp-post.json
cat /tmp/r261-fp-post.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('POST:', d['stevci'])"
if cmp -s /tmp/r261-fp-pre.json /tmp/r261-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — seed/restore bajtnato)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r261-fp-pre.json) <(python3 -m json.tool /tmp/r261-fp-post.json) | head -20; fi

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R261 E2E KONEC ---"
