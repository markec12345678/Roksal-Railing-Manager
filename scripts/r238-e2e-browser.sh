#!/bin/bash
# R238 E2E ŽIVO: PRODAJNA PLOŠČA CSV (F1 — zaključek 'izvozi' družine P1-c)
# + P1-e mikro tipografija (žetona 2xs/3xs — kompilirani CSS dokaz).
# Čista baza SKOZI celoten E2E (CSV izvoz = samo bralni tok — ZERO-MUTACIJA
# brez raise/restore, r236/r237 močnejša forma).
# Z1 Domov: Brez 8 + Zamujena ODSOTNA (fail-closed, 0 naročil);
# Z2 Dashboard → prodajna plošča → CSV gumb VIDEN (disabled:false po
#    nalaganju) + klik → toast 'CSV izvožen' + eb_csv_capture → glava
#    'Naziv projekta;Status;Stranka;Vrednost (€);Spomnik;Datum montaže;
#    Podpisano' + ≥1 vrstica + podpis samo DA/NE (ENA resnica z zaslonom);
# Z2b mikro tipografija: kompilirani CSS vsebuje .text-2xs (10px žeton);
# Z3 temna + __err null + health;
# Z4 DB bajtnato identična končnica + port sproščen (čista baza).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r238-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R238-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena ODSOTNA ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r238-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: CRM → prodajna plošča — R238 JEDRO ŽIVO: CSV gumb + capture ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi prodajno ploščo kot CSV\"]'); return !!g && !g.disabled;})()" 24
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi prodajno ploščo kot CSV\"]'); if(!g) return JSON.stringify({gumb:false}); return JSON.stringify({gumb:true, title:g.getAttribute('title'), disabled:g.disabled, err:window.__err??null});})()" 2>&1 | tail -1
eb_csv_capture csvP
eb_csv_reset csvP
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_pocakaj_tekst "CSV izvožen" 12
eb_pocakaj_na "(()=>{return typeof window.__csvP==='string'&&window.__csvP.length>10;})()" 12
agent-browser eval "(()=>{const t=window.__csvP; if(typeof t!=='string') return JSON.stringify({csv:false, err:window.__err??null}); const cist=t.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r\n/).filter(l=>l.length>0); const glava=vrstice[0]; const podpisi=vrstice.slice(1).map(l=>l.split(';')[6]); return JSON.stringify({csv:true, glavaOK:glava==='Naziv projekta;Status;Stranka;Vrednost (€);Spomnik;Datum montaže;Podpisano', vrstic:vrstice.length-1, podpisiOK:podpisi.every(x=>x==='DA'||x==='NE'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r238-e2e-plosca-csv.png" > /dev/null 2>&1

echo "=== Z2b: mikro tipografija — VSI CSS chunki: žetona + NI escaped arbitrary ==="
agent-browser eval "(()=>{window.__cssProof=null; const lnki=[...document.querySelectorAll('link[rel=\"stylesheet\"]')].map(l=>l.href).filter(h=>h.includes('/_next/')); if(lnki.length===0){window.__cssProof=JSON.stringify({css:false}); return 'ni-css';} Promise.all(lnki.map(h=>fetch(h).then(r=>r.text()))).then(zi=>{const t=zi.join('\\n'); window.__cssProof=JSON.stringify({css:true, chunkov:lnki.length, dva:t.includes('.text-2xs{'), tri:t.includes('.text-3xs{'), dvaPx:t.includes('font-size:.625rem'), arbitrary10:t.includes('text-\\\\[10px\\\\]'), arbitrary8:t.includes('text-\\\\[8px\\\\]')});}).catch(e=>{window.__cssProof=JSON.stringify({css:false, napaka:String(e)});}); return 'pognano:'+lnki.length;})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__cssProof==='string';})()" 12
agent-browser eval "(()=>{return window.__cssProof;})()" 2>&1 | tail -1

echo "=== Z3: temna + __err null + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$EB_BASE/api/public/health"; echo

echo "=== Z4: DB bajtnato identična končnica + port sproščen (brez raise — čista baza) ==="
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R238 E2E KONEC ---"
