#!/bin/bash
# R182 E2E EN KLIC — živostna družina 14 → 16 + fail-verbose agregacije (ADMIN, standalone :3100):
#  N0: zvonek → sheet — pečat VIDEN + podnaslov 'Nizka zaloga, današnje montaže…'
#  N1: focus → pečat čas se SPREMENI (vedenjski dokaz refetcha)
#  N2: fetch-patch /api/weather → warning vrstica (role=alert, viri) + pečat IZGINE →
#      restore → 'Poskusi znova' → zdravilna pot (pečat nazaj, warning IZGINIL)
#  M:  Več → Material V5 — pečat VIDEN + focus → čas se SPREMENI
#  V:  vodja regresija (R180 pečat še vedno živ)
#  T:  temna tema + window.__err null
# Vzorec r181-e2e-browser.sh; ⚠️ standalone RABI statiko — graditi z bun run build.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r182-e2e-server.log 2>&1 < /dev/null &
sleep 5

echo "--- preflight ---"
curl -s -o /dev/null -w "login http: %{http_code}\n" http://127.0.0.1:3100/login
ss -tlnp 2>/dev/null | grep ':3100' | head -1 || echo "!!! 3100 NI poslušal"

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6
echo "po prijavi: $(agent-browser eval "JSON.stringify({url: location.pathname, bodyLen: document.body.innerText.length})()" 2>&1 | tail -1)"

for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
  sleep 4
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && echo "VizTab izhod OK (poskus $i)" && break
done

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- N0: zvonek → sheet: pečat + podnaslov VIDNA ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('p')].find(e=>e.textContent.includes('Nizka zaloga, današnje montaže')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({podnaslov: !!pod, pecat: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r182-obvestila.png > /dev/null 2>&1 && echo "screenshot OBVESTILA OK"

echo "--- N1: focus → pečat se SPREMENI (vedenjski refetch) ---"
PRE=$(agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat PRE:  $PRE"
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus N1'" 2>&1 | tail -1
sleep 6
POST=$(agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat POST: $POST"

echo "--- N2: fetch-patch /api/weather 500 → warning + pečat IZGINE → zdravilna pot ---"
agent-browser eval "(()=>{const orig=window.fetch; window.__origFetch=orig; window.fetch=(u,o)=>{ if(typeof u==='string' && u.includes('/api/weather')) return Promise.resolve(new Response(JSON.stringify({error:'patch'}),{status:500})); return orig(u,o); }; return 'patch ON';})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return 'bell reload';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const w=[...document.querySelectorAll('[role=\"alert\"]')].map(e=>e.textContent.trim().slice(0,80)); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({warningVrstice: w.length, besedilo: w[0]??null, pecat: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r182-warning.png > /dev/null 2>&1 && echo "screenshot WARNING OK"
agent-browser eval "(()=>{window.fetch=window.__origFetch; return 'patch OFF';})()" 2>&1 | tail -1
agent-browser eval "(()=>{const r=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Ponovno naloži obvestila'); if(r) r.click(); return !!r;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const w=[...document.querySelectorAll('[role=\"alert\"]')].length; const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({warningPoZdravilu: w, pecatNazaj: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- M: Več → Material V5 — pečat + focus ---"
agent-browser eval "(()=>{const x=document.querySelector('[role=\"dialog\"],button[aria-label*=Zapri]'); return 'sheet ostaja';})()" > /dev/null 2>&1
agent-browser eval "(()=>{const esc={key:'Escape',code:'Escape'}; document.dispatchEvent(new KeyboardEvent('keydown',esc)); return 'esc';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('div')].find(e=>e.textContent.trim().startsWith('Dobavitelji, zaloge, naročila in BOM optimizacija')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({podnaslovMaterial: !!pod, pecatMaterial: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus M'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({pecatPoFokusu: p?p.textContent.trim():null, errorPaneli: err});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r182-material.png > /dev/null 2>&1 && echo "screenshot MATERIAL OK"

echo "--- V: regresija — vodja pečat (R180) še vedno živ ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('vodjo')||b.textContent.trim().includes('Pregled za vodjo')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatVodja: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- T: temna tema (material pečat berljiv) + window.__err ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const barva=p?getComputedStyle(p).color:null; const w=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({pecatVidna: !!p, barvaTemna: barva, pageBg: getComputedStyle(document.body).backgroundColor, warningPaneli: w});})()" 2>&1 | tail -1
agent-browser eval "JSON.stringify({err: window.__err ?? null})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r182-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R182 E2E KONEC"
