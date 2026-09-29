#!/bin/bash
# R269 — Z1b diagnoza: klik pill na PRAZNEM projektu → kateri toast SE DEJANSKO prikaže?
set -u
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
setsid node .next/standalone/server.js > /tmp/R269-server-diag.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r269-proj1'})); return 'izbran';})()" 2>&1 | tail -1
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
sleep 2

echo "--- FRESH fetch ročno (dvokorki vzorec — kaj endpoint vrne?) ---"
agent-browser eval "(()=>{window.__diag=null; fetch('/api/measurements?projectId=e2e-r269-proj1',{credentials:'same-origin'}).then(async r=>{const t=await r.text(); window.__diag={status:r.status, telo:t.slice(0,200)}}).catch(e=>{window.__diag={err:String(e)}}); return 'poslan';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "(()=>{return JSON.stringify(window.__diag);})()" 2>&1 | tail -1

echo "--- klik pill + zajem VSEH toastov ---"
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]'); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "(()=>{const toasts=[...document.querySelectorAll('[data-sonner-toast]')].map(t=>({title:t.querySelector('[data-title]')?.textContent??null, desc:t.querySelector('[data-description]')?.textContent??null})); return JSON.stringify({toasts, bodySnižek:document.body.textContent.includes('Ni vpisanih meritev'), err:window.__err??null});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
echo "--- DIAG KONEC ---"
