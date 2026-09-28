#!/bin/bash
# R256 E2E ŽIVO (lokalni :3100, ADMIN) — TEDENSKI VOZNI RED MONTAŽ PDF (12. člen
# 'izvozi' družine: 7-dnevni razgled po dnevih iz ISTEGA DTO kot vozni red R255;
# okno = danes..danes+6 UTC) + regresije R255 (vozni red + navy-soft), R254
# (aria/žetoni), R253 (koledar), R252 (potekli), R250 (prihodki + racuni CSV),
# R173 (termini CSV sorojenec).
# SEED/RESTORE runda: fail-closed dokaz PREJ (0 terminov v dev DB → iskren
# toast 'Ni terminov v naslednjih 7 dneh'), potem raw SQL seed (5 termini z
# EKSPLICITNIMI id-ji — t1 ZAKLJUČENO včeraj = TEDENSKI okno VEN, t2 V_TEKU
# danes, t3 NAVRTENO +2, t4 PREKlicANO +5, t5 NAVRTENO +6 = okno ZADNJI dan),
# uspešna pot, RESTORE → fp pre==post BAJTNATO (ZERO-MUTACIJA).
# DOKAZANE RESNICE (R255 lekcija 7 — vsak dokument svoja iskrena resnica):
#   zaslon    'Skupaj 22 h · 4 termini · brez 1 preklicanega' (preklicani izključeni R169)
#   tedenski  toast '4 dni, 4 terminov, 21 h.'  (okno: t2+t3+t4+t5 — preklicani VIDNO)
#   vozni red toast '5 terminov, 25 h, 0 ekip.' (vseh 5 vidnih vključno včeraj)
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r256-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R256-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (vključuje InstallationSchedule polno resnico) ---"
node scripts/r256-db-e2e.cjs fp > /tmp/r256-fp-pre.json
cat /tmp/r256-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: LOGISTIKA tab — pilli ŽIVO + R256 tedenski VEDNO viden + fail-closed (0 terminov PREJ) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi tedenski pregled montaž kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const ted=id('Izvozi tedenski pregled montaž kot PDF'); const voz=id('Izvozi vozni red montaž kot PDF'); const csv=id('Izvozi vidne termine kot CSV'); const ics=id('Izvozi termine montaže kot koledarsko datoteko (.ics)'); const leg256=document.body.textContent.includes('CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki) · Tedenski = naslednjih 7 dni (po dnevih)'); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({tedPill:!!ted, tedPS:ted?ted.className.includes('press-scale'):false, tedAriaHidden:ted?!!ted.querySelector('svg[aria-hidden=\"true\"]'):false, tedDisabled:ted?ted.disabled:null, vozDisabled:voz?voz.disabled:null, csvDisabled:csv?csv.disabled:null, icsDisabled:ics?ics.disabled:null, legenda256:leg256, ariaR256:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r256-e2e-pilli.png" > /dev/null 2>&1
echo "--- Z1b: tedenski klik brez terminov → fail-closed iskren toast ---"
eb_klik_gumb "Izvozi tedenski pregled montaž kot PDF"
eb_pocakaj_tekst "Ni terminov v naslednjih 7 dneh" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({failClosedToast:t.includes('Ni terminov v naslednjih 7 dneh'), opis:t.includes('Tedenski pregled se izvozi, ko je vpisan termin v prihajajočem tednu.'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r256-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: SEED (5 terminov) + reload — tedenski PDF uspešna pot ==="
node scripts/r256-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 2
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi tedenski pregled montaž kot PDF\"]');})()" 24
eb_cakaj 3
agent-browser eval "(()=>{const t=document.body.textContent; const pov=t.includes('Skupaj 22 h · 4 termini · brez 1 preklicanega'); const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const ted=id('Izvozi tedenski pregled montaž kot PDF'); const voz=id('Izvozi vozni red montaž kot PDF'); const csv=id('Izvozi vidne termine kot CSV'); return JSON.stringify({povzetek22h:pov, tedDisabled:ted?ted.disabled:null, vozDisabled:voz?voz.disabled:null, csvDisabled:csv?csv.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1
eb_zajem_pdf tedpdf
eb_csv_reset tedpdf
eb_klik_gumb "Izvozi tedenski pregled montaž kot PDF"
eb_pocakaj_tekst "Tedenski pregled prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agregat=/4 dni, 4 terminov, 21 h\\./.test(t); return JSON.stringify({toastTitle:t.includes('Tedenski pregled prenešen v PDF'), toastAgregat:agregat, err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__tedpdf==='string'&&window.__tedpdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__tedpdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r256-e2e-toast.png" > /dev/null 2>&1
echo "--- Z2b: R255 regresija — vozni red toast z REALNIM agregatom (5 terminov, 25 h — t1 včeraj NOTER) ---"
eb_zajem_pdf vozpdf
eb_csv_reset vozpdf
eb_klik_gumb "Izvozi vozni red montaž kot PDF"
eb_pocakaj_tekst "Vozni red prenešen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__vozpdf==='string'&&window.__vozpdf.length>0;})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const b64=window.__vozpdf; const bin=typeof b64==='string'?atob(b64):''; const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555]; return JSON.stringify({toastTitle:t.includes('Vozni red prenešen v PDF'), agregat:/5 terminov, 25 h, 0 ekip\\./.test(t), pdfMagija:bin.substring(0,5), vozBajtov:bin.length, razredR256VozniRed:(bin.length!==38631&&!znani.includes(bin.length)), err:window.__err??null});})()" 2>&1 | tail -1
echo "--- Z2c: R173 sorojenec — termini CSV še vedno 9 stolpcev (NEspremenjen kontrakt) ---"
eb_csv_capture tercsv
eb_csv_reset tercsv
eb_klik_gumb "Izvozi vidne termine kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__tercsv==='string'&&window.__tercsv.length>0;})()" 14
agent-browser eval "(()=>{const csv=window.__tercsv; if(typeof csv!=='string'||csv.length===0) return JSON.stringify({csv:false}); const vrst=csv.split('\\r\\n').filter(x=>x.length>0); const glava=vrst[0].split(';'); return JSON.stringify({csv:true, stolpcev:glava.length, vrstic:vrst.length, metaObseg:csv.includes('Obseg')&&csv.includes('Filtrirano na projekt'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: R254/R253/R252 regresije — CRM fail-closed poti (0 opomnikov v dev DB) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const kol=id('Izvozi koledar pregledov kot PDF'); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({koledarPill:!!kol, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, legenda253:document.body.textContent.includes('Potekel = prek datuma · Koledar = vsi vpisani pregledi (časovna vrsta)'), err:window.__err??null});})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi koledar pregledov kot PDF"
eb_pocakaj_tekst "Ni vpisanih pregledov" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r253:t.includes('Ni vpisanih pregledov'), err:window.__err??null});})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi potekle opomnike kot PDF"
eb_pocakaj_tekst "Ni poteklih opomnikov" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r252:t.includes('Ni poteklih opomnikov'), err:window.__err??null});})()" 2>&1 | tail -1
echo "--- Z3b: R250 regresija — prihodki REALNI PDF (dev DB ima 1 račun; fail-closed pot = prod QA MONTER 0 računov) ---"
eb_zajem_pdf prhpdf
eb_csv_reset prhpdf
eb_klik_gumb "Izvozi prihodke kot PDF"
eb_pocakaj_tekst "Prihodki prenešeni v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__prhpdf==='string'&&window.__prhpdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__prhpdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, razredR250:bin.length===36788, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: R255 F2 navy-soft žeton — top-bar gradient ŽIVO (computed style) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{const tb=document.querySelector('header.sticky.top-0'); if(!tb) return JSON.stringify({topBar:false}); const g=getComputedStyle(tb).backgroundImage; return JSON.stringify({topBar:true, gradientVsebujeSoft:g.includes('42, 63, 95'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5: temna + err null ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== Z6: RESTORE + prstni odtis post BAJTNATO == pre ==="
agent-browser close --all > /dev/null 2>&1
node scripts/r256-db-e2e.cjs restore
node scripts/r256-db-e2e.cjs fp > /tmp/r256-fp-post.json
cat /tmp/r256-fp-post.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('POST:', d['stevci'])"
if cmp -s /tmp/r256-fp-pre.json /tmp/r256-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — seed/restore bajtnato)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r256-fp-pre.json) <(python3 -m json.tool /tmp/r256-fp-post.json) | head -20; fi

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R256 E2E KONEC ---"
