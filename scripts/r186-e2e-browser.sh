#!/bin/bash
# R186 E2E ŽIVO EN KLIC (vzorec r184/r185): standalone :3100 + ADMIN.
#  H0: curl /api/public/health brez seje → 200 {ok:true, db:'ok', build} +
#      no-store + correlation glava (javna sonda — monitor pot);
#  M0: Meritve — CSV gumb v filter vrstici (aria 'Izvozi vidne meritve kot
#      CSV'), klik → toast 'Izvoženih N meritev v CSV.' (ali 'Ni meritev za
#      izvoz.' na praznem projektu — fail-closed, OBE potezi veljavni);
#  M1: meritve pečat (R183 regresija) + 0 error panelov;
#  V:  vodja regresija (R180 pečat);
#  T2: temna + window.__err null.
# ⚠️ standalone RABI statiko — graditi z bun run build (nauček R171).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
export NEXT_PUBLIC_BUILD_STAMP="r186-e2e-$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r186-e2e-server.log 2>&1 < /dev/null &
sleep 5

echo "--- preflight ---"
curl -s -o /dev/null -w "login http: %{http_code}\n" http://127.0.0.1:3100/login
ss -tlnp 2>/dev/null | grep ':3100' | head -1 || echo "!!! 3100 NI poslušal"

echo "--- H0: /api/public/health brez seje → 200 + no-store + correlation ---"
curl -s -D - "http://127.0.0.1:3100/api/public/health" -o /tmp/r186-health.json | grep -iE "^HTTP|cache-control|x-correlation" 
cat /tmp/r186-health.json; echo ""

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6
echo "po prijavi: $(agent-browser eval "JSON.stringify({url: location.pathname, bodyLen: document.body.innerText.length})()" 2>&1 | tail -1)"

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- NAV: obvezen krog (Montažna orodja → VizTab Domov izhod → dashboard) ---"
for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
  sleep 4
  agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Domov'); if(d) d.click(); return !!d;})()" > /dev/null 2>&1
  sleep 4
  VEC=$(agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Več'); return String(v);})()" 2>&1 | tail -1)
  [ "$VEC" = "true" ] && echo "Več dosežen (poskus $i)" && break
done

echo "--- M0: Montažna orodja → zavihek Meritve → CSV gumb + klik (toast) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({csvGumbViden:!!g, pecat:p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); if(g){g.click(); return 'kliknil';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[data-sonner-toast], li, div')].map(e=>e.textContent||'').find(x=>x.includes('meritev v CSV')||x.includes('Ni meritev za izvoz')||x.includes('Izvoza ni bilo mogoče')); return JSON.stringify({toast:t?t.trim().slice(0,80):null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r186-meritve-csv.png > /dev/null 2>&1 && echo "screenshot MERITVE CSV OK"

echo "--- M1: 0 error panelov + okno brez napak ---"
agent-browser eval "(()=>{const paneli=[...document.querySelectorAll('[role=alert]')].length; return JSON.stringify({alertPaneli:paneli, err:window.__err ?? null});})()" 2>&1 | tail -1

echo "--- V: regresija — vodja pečat (R180): izhod iz VizTaba → Več → Pregled za vodjo ---"
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Domov'); if(d) d.click(); return !!d;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('vodjo')||b.textContent.trim().includes('Pregled za vodjo')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const glava=document.body.innerText.includes('Pregled za vodjo'); return JSON.stringify({vodjaGlava:glava, vodjaPecat:p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- T2: temna tema + window.__err ---"
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({pageBg: getComputedStyle(document.body).backgroundColor, err: window.__err ?? null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r186-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R186 E2E KONEC"
