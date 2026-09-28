#!/bin/bash
# R257 E2E ŽIVO (lokalni :3100, ADMIN) — NAROČILA PREGLED PDF (13. člen
# 'izvozi' družine: agregatna resnica vrstica per naročilo iz ISTEGA DTO kot
# CSV R140/R232; route NIČ; 'odprto' + pretekel rok = EN VIR zamujena-dobava
# R228) + regresije R256/R254/R253/R252/R250 + CSV sorojenec R140/R231.
# SEED/RESTORE runda: fail-closed dokaz PREJ (0 naročil v dev DB → iskren
# toast 'Ni naročil za izvoz'), potem raw SQL seed (1 dobavitelj + 6 naročil
# z EKSPLICITNIMI id-ji 'e2e-r257-o1…o6': o1 OSNUTEK pretekljena obljuba =
# ZAMUJEN žig, o2 POSLANO, o3 POTRJENO NULL obljuba = '—', o4 DOBLJENO,
# o5 PREKlicANO izključen iz vsote, o6 OSNUTEK 0 postavk), uspešna pot,
# RESTORE → fp pre==post BAJTNATO (ZERO-MUTACIJA).
# DOKAZANE RESNICE (R255 lekcija 7 — vsak dokument svoja iskrena resnica):
#   zaslon   statusni čipi 'Vsi (6) / OSNUTEK (2) / …' + žig 'Pretekel rok' na o1
#   PDF      toast '6 naročil, odprtih 4, pretekel rok 1, vrednost
#            ne-preklicanih 2125.49 €.' (vrstica per naročilo)
#   CSV      vrstica per postavka (6 postavk) — kontrakt R140/R231 NESPREMENJEN
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r257-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R257-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (vključuje MaterialOrder/MOItem/Supplier polno resnico) ---"
node scripts/r257-db-e2e.cjs fp > /tmp/r257-fp-pre.json
cat /tmp/r257-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: MATERIAL tab (orders) — pilli ŽIVO + R257 PDF VEDNO viden + fail-closed (0 naročil PREJ) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const pdf=id('Izvozi naročila kot PDF'); const csv=id('Izvozi naročila kot CSV'); const leg257=document.body.textContent.includes('CSV = vrstica per postavka · PDF = vrstica per naročilo · Pretekel rok = pretekljena obljuba, status še odprt'); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({pdfPill:!!pdf, pdfPS:pdf?pdf.className.includes('press-scale'):false, pdfAriaHidden:pdf?!!pdf.querySelector('svg[aria-hidden=\"true\"]'):false, pdfDisabled:pdf?pdf.disabled:null, csvDisabled:csv?csv.disabled:null, legenda257:leg257, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r257-e2e-pilli.png" > /dev/null 2>&1
echo "--- Z1b: PDF klik brez naročil → fail-closed iskren toast ---"
eb_klik_gumb "Izvozi naročila kot PDF"
eb_pocakaj_tekst "Ni naročil za izvoz" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({failClosedToast:t.includes('Ni naročil za izvoz'), opis:t.includes('PDF se izvozi, ko je dodano prvo naročilo.'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r257-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: SEED (1 dobavitelj + 6 naročil) + reload — naročila pregled PDF uspešna pot ==="
node scripts/r257-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 2
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Vsi (6)');})()" 24
eb_cakaj 3
agent-browser eval "(()=>{const t=document.body.textContent; const cip=t.includes('Vsi (6)')&&t.includes('OSNUTEK (2)')&&t.includes('POSLANO (1)')&&t.includes('POTRJENO (1)')&&t.includes('DOBLJENO (1)')&&t.includes('PREKlicANO (1)'); return JSON.stringify({statusCipi:cip, e2eDobavitelj:t.includes('E2E R257 Dobavitelj'), err:window.__err??null});})()" 2>&1 | tail -1
echo "--- Z2b: pretekel rok žig ŽIVO na o1 kartici (ISTI jeZamujenaDobava — badge span, ne legenda) ---"
eb_pocakaj_na "(()=>{return !!document.querySelector('span.text-roksal-red');})()" 10
agent-browser eval "(()=>{const zig=document.querySelector('span.text-roksal-red'); const t=document.body.textContent; return JSON.stringify({zigPretekelRok:!!zig, zigTekst:zig?zig.textContent.trim():null, dobavaVrstice:t.includes('dobava'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r257-e2e-zig.png" > /dev/null 2>&1
echo "--- Z2c: PDF klik → toast realni agregat + bajtni dokaz (NOV glifni razred) ---"
eb_zajem_pdf narpdf
eb_csv_reset narpdf
eb_klik_gumb "Izvozi naročila kot PDF"
eb_pocakaj_tekst "Naročila prenešena v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agregat=/6 naročil, odprtih 4, pretekel rok 1, vrednost ne-preklicanih 2125\\.49 €\\./.test(t); return JSON.stringify({toastTitle:t.includes('Naročila prenešena v PDF'), toastAgregat:agregat, err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__narpdf==='string'&&window.__narpdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__narpdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r257-e2e-toast.png" > /dev/null 2>&1
echo "--- Z2d: R140/R231 sorojenec — naročila CSV še vedno vrstica per postavka (kontrakt NESPREMENJEN) ---"
eb_csv_capture narcsv
eb_csv_reset narcsv
eb_klik_gumb "Izvozi naročila kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__narcsv==='string'&&window.__narcsv.length>0;})()" 14
agent-browser eval "(()=>{const csv=window.__narcsv; if(typeof csv!=='string'||csv.length===0) return JSON.stringify({csv:false}); const vrst=csv.split('\\r\\n').filter(x=>x.length>0); const glava=vrst[0].split(';'); const da=vrst.filter(v=>v.endsWith(';DA')).length; return JSON.stringify({csv:true, stolpcev:glava.length, vrstic:vrst.length-1, pretekelRokDA:da, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: R256/R254 regresije — logistika tedenski + logistika aria ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi tedenski pregled montaž kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const ted=id('Izvozi tedenski pregled montaž kot PDF'); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({tedPill:!!ted, tedDisabled:ted?ted.disabled:null, legenda256:document.body.textContent.includes('Tedenski = naslednjih 7 dni (po dnevih)'), ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi tedenski pregled montaž kot PDF"
eb_pocakaj_tekst "Ni terminov v naslednjih 7 dneh" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r256:t.includes('Ni terminov v naslednjih 7 dneh'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== Z5: RESTORE + prstni odtis post BAJTNATO == pre ==="
agent-browser close --all > /dev/null 2>&1
node scripts/r257-db-e2e.cjs restore
node scripts/r257-db-e2e.cjs fp > /tmp/r257-fp-post.json
cat /tmp/r257-fp-post.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('POST:', d['stevci'])"
if cmp -s /tmp/r257-fp-pre.json /tmp/r257-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — seed/restore bajtnato)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r257-fp-pre.json) <(python3 -m json.tool /tmp/r257-fp-post.json) | head -20; fi

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R257 E2E KONEC ---"
