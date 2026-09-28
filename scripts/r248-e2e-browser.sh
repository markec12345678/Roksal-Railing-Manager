#!/bin/bash
# R248 E2E ŽIVO (lokalni :3100, ADMIN) — POVPREČNI RAZPON % (agregat
# razponske dimenzije: vsota razlik / vsota najboljših × 100 — R248, P1-g
# nadaljevanje) + regresija R247/R246/R245 na bazi Z REALNIMI cenami.
# SEED = 2 dobavitelja + 3 cene (r245-db-e2e.cjs, fiksni PK-ji) → zajem
# CSV/PDF bajtnih dokazov → RESTORE (točno te PK-je) → prstni odtis
# pre==post BAJTNATO IDENTIČEN (ZERO-MUTACIJA z restore bajtnato).
# Resnica sejanca: razlika 1,25; najboljše 9,25 + 3,80 = 13,05
# → 1,25/13,05 × 100 = 9,578… → prikaz '9,6'.
# Dokazi: (1) primerjalni CSV NEspremenjen = 3 vrstice (glava + 2), 9
# stolpcev, % razlike '13,5' + '0,0' — agregat NE v CSV (R246 precedens);
# (2) PDF toast nosi agregat 'povprečni razpon 9,6 %' (WYSIWYG s KPI boxom);
# (3) primerjalni PDF = %PDF magija + NOV glifni razred (≠ 39927 R247, ≠
# 38753 R246, ≠ 35565 R245 — druga KPI vrsta = nov dokument); (4) cenik PDF
# **37709 = ISTI razred kot R245/R246/R247** — bajtna stabilnost brata 4.
# rundo; (5) RESTORE → DB bajtnato; (6) po restore: fail-closed toast; (7)
# temna + err null + brezSt=8.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r248-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R248-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE + SEED (2 dobavitelja + 3 cene) ---"
# restore PRED pre (idempotentna varnost — skript je samo-vsebujoč: tudi če je
# od prej ostal r245 seed, je pre = PRAVO izhodišče 0 dobaviteljev/0 cen)
node scripts/r245-db-e2e.cjs restore
node scripts/r245-db-e2e.cjs fp > /tmp/r248-fp-pre.json
node scripts/r245-db-e2e.cjs seed
cat /tmp/r248-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; node scripts/r245-db-e2e.cjs restore; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: 4 pilli + razširjena legenda (R247 % resnica) VIDNI (ADMIN) s press-scale ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi primerjalni cenik kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const cC=id('Izvozi cenik materiala kot CSV'); const cP=id('Izvozi cenik materiala kot PDF'); const pC=id('Izvozi primerjalni cenik kot CSV'); const pP=id('Izvozi primerjalni cenik kot PDF'); const leg=document.body.textContent.includes('Cenik = vse ponudbe · Primerjalni = najnižja per artikel · % = razpon do najvišje'); const leg248=document.body.textContent.includes('· Povprečni razpon = vsota razlik / vsota najboljših'); return JSON.stringify({cenikCsv:!!cC, cenikPdf:!!cP, primCsv:!!pC, primPdf:!!pP, vsePS:[cC,cP,pC,pP].every(b=>b&&b.className.includes('press-scale')), legenda247:leg, legenda248:leg248, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r248-e2e-pilli.png" > /dev/null 2>&1

echo "=== Z2: primerjalni CSV NEspremenjen — 3 vrstice (glava+2), 9 stolpcev, '13,5' + '0,0', BREZ agregatne vrstice ==="
eb_csv_capture primcsv
eb_csv_reset primcsv
eb_klik_gumb "Izvozi primerjalni cenik kot CSV"
eb_pocakaj_tekst "Primerjalni cenik prenešen" 14
eb_pocakaj_na "(()=>{return typeof window.__primcsv==='string'&&window.__primcsv.length>0;})()" 14
agent-browser eval "(()=>{const t=window.__primcsv||''; const v=t.split('\\n').filter(x=>x.trim()!==''); const st=v.map(x=>x.replace(/^\\uFEFF/,'').split(';').length); const glava=v[0]||''; const procVr1=(v[1]||'').replace(/^\\uFEFF/,'').split(';')[6]??null; const procVr2=(v[2]||'').replace(/^\\uFEFF/,'').split(';')[6]??null; const brezAgregata=v.length===3 && !glava.includes('Povpre\u010dni razpon'); return JSON.stringify({vrstic:v.length, stStolpcev:st, glava:glava, procVr1:procVr1, procVr2:procVr2, brezAgregatneVrstice:brezAgregata, vr1:(v[1]||'').replace(/^\\uFEFF/,''), vr2:(v[2]||'').replace(/^\\uFEFF/,''), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: primerjalni PDF — %PDF magija + NOV glifni razred (R248, ≠ 39927 R247) + toast nosi agregat '9,6 %' ==="
eb_zajem_pdf primpdf
eb_csv_reset primpdf
eb_klik_gumb "Izvozi primerjalni cenik kot PDF"
eb_pocakaj_tekst "Primerjalni cenik prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({toastAgregat:t.includes('povpre\u010dni razpon 9,6 %'), toastR247Ostaja:t.includes('z dobaviteljem in razponom v %'), err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__primpdf==='string'&&window.__primpdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__primpdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const stari=[35565,38753,39927]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novRazred:!stari.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: cenik CSV — 3 ponudbe (vse, ne samo najboljše) ==="
eb_csv_capture cenk
eb_csv_reset cenk
eb_klik_gumb "Izvozi cenik materiala kot CSV"
eb_pocakaj_tekst "Cenik prenešen" 14
eb_pocakaj_na "(()=>{return typeof window.__cenk==='string'&&window.__cenk.length>0;})()" 14
agent-browser eval "(()=>{const t=window.__cenk||''; const v=t.split('\\n').filter(x=>x.trim()!==''); return JSON.stringify({vrstic:v.length, glava:v[0]||null, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5: cenik PDF — **37709 ISTI razred** (bajtna stabilnost brata 4. rundo) ==="
eb_zajem_pdf cenkpdf
eb_csv_reset cenkpdf
eb_klik_gumb "Izvozi cenik materiala kot PDF"
eb_pocakaj_tekst "Cenik prenešen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__cenkpdf==='string'&&window.__cenkpdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__cenkpdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, istiRazredKotR245R246R247:bin.length===37709, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z6: RESTORE + prstni odtis post BAJTNATO == pre ==="
node scripts/r245-db-e2e.cjs restore
node scripts/r245-db-e2e.cjs fp > /tmp/r248-fp-post.json
if cmp -s /tmp/r248-fp-pre.json /tmp/r248-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r248-fp-pre.json) <(python3 -m json.tool /tmp/r248-fp-post.json) | head -20; fi

echo "=== Z7: po restore — fail-closed toast 'Ni vpisanih cen za primerjavo' ==="
eb_klik_gumb "Izvozi primerjalni cenik kot CSV"
eb_pocakaj_tekst "Ni vpisanih cen za primerjavo" 14
eb_cakaj 1
agent-browser eval "(()=>{const fail=document.body.textContent.includes('Ni vpisanih cen za primerjavo'); return JSON.stringify({failClosedToastPoRestore:fail, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z8: regresija Domov brezSt=8 + temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); const m=k?(k.getAttribute('aria-label')||'').match(/Brez dobavitelja \\((\\d+)\\)/):null; document.documentElement.classList.add('dark'); return JSON.stringify({brezSt:m?m[1]:null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r248-e2e-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'light';})()" > /dev/null 2>&1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "=== ZAKLJUČEK: port sproščen + brskalnik zaprt ==="
node scripts/r245-db-e2e.cjs fp | python3 -c "import json,sys; d=json.load(sys.stdin); print('FINAL stevci:', d['stevci'])"
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R248 E2E KONEC ==="
