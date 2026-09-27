#!/bin/bash
# R183 E2E EN KLIC — živostna družina 16 → 18 (fotografije + meritve) + fail-verbose fotke (ADMIN, standalone :3100):
#  F0: Več → Slike — pečat VIDEN + 'Slikanje projekta' + 0 error panelov
#  F1: focus → pečat čas se SPREMENI (vedenjski dokaz refetcha)
#  F2: (po 30 s vrati FOKUS_MIN_INTERVAL_MS) fetch-patch /api/photos 500 →
#      focus → error panel 'Fotografij ni bilo mogoče naložiti' + pečat IZGINE →
#      restore → 'Poskusi znova' → zdravilna pot (pečat nazaj, warning IZGINIL)
#  M0: Več → Meritve — pečat v glavi + podnaslov + 0 panelov
#  M1: focus → pečat se SPREMENI (vedenjski; svež mount = vrata odprta)
#  V:  regresija — vodja pečat (R180) še vedno živ
#  T:  temna tema + window.__err null
# Vzorec r182-e2e-browser.sh; ⚠️ standalone RABI statiko — graditi z bun run build.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r183-e2e-server.log 2>&1 < /dev/null &
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

echo "--- F0: Več → Slike — pečat VIDEN + 0 panelov ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Slike'||b.textContent.trim()==='Slike'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const glava=[...document.querySelectorAll('h3,h4,div')].some(e=>e.textContent.trim()==='Slikanje projekta'); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const napake=[...document.querySelectorAll('[role=\"alert\"]')].filter(e=>e.textContent.includes('Fotografij ni bilo mogoče')).length; return JSON.stringify({glavaSlikanje: glava, pecatFotke: p?p.textContent.trim():null, fotoNapake: napake});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r183-fotke.png > /dev/null 2>&1 && echo "screenshot FOTKE OK"

echo "--- F1: focus → pečat se SPREMENI (vedenjski refetch) ---"
PRE=$(agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat PRE:  $PRE"
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus F1'" 2>&1 | tail -1
sleep 6
POST=$(agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat POST: $POST"

echo "--- (30 s vrata FOKUS_MIN_INTERVAL_MS) ---"
sleep 31

echo "--- F2: fetch-patch /api/photos 500 → error panel + pečat IZGINE → zdravilna pot ---"
agent-browser eval "(()=>{const orig=window.fetch; window.__origFetch=orig; window.fetch=(u,o)=>{ if(typeof u==='string' && u.includes('/api/photos?')) return Promise.resolve(new Response(JSON.stringify({error:'patch'}),{status:500})); return orig(u,o); }; return 'patch ON';})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus F2 (patch)'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const w=[...document.querySelectorAll('[role=\"alert\"]')].filter(e=>e.textContent.includes('Fotografij ni bilo mogoče')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const gumb=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Ponovno naloži fotografije'); return JSON.stringify({fotoWarning: w.length ? w[0].textContent.trim().slice(0,60) : null, pecatPoNapaki: p?p.textContent.trim():null, retryGumb: !!gumb});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r183-foto-napaka.png > /dev/null 2>&1 && echo "screenshot FOTO-NAPAKA OK"
agent-browser eval "(()=>{window.fetch=window.__origFetch; return 'patch OFF';})()" 2>&1 | tail -1
agent-browser eval "(()=>{const r=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Ponovno naloži fotografije'); if(r) r.click(); return !!r;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const w=[...document.querySelectorAll('[role=\"alert\"]')].filter(e=>e.textContent.includes('Fotografij ni bilo mogoče')).length; const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({warningPoZdravilu: w, pecatNazaj: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- M0: Več → Meritve — pečat v glavi + podnaslov + 0 panelov ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Meritve'||b.textContent.trim()==='Meritve'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const h2=[...document.querySelectorAll('h2')].find(e=>e.textContent.trim()==='Meritve'); const pod=[...document.querySelectorAll('p')].find(e=>e.textContent.includes('Meritve ograj, dimenzije')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({h2Meritve: !!h2, podnaslov: !!pod, pecatMeritve: p?p.textContent.trim():null, errorPaneli: err});})()" 2>&1 | tail -1

echo "--- M1: focus → pečat se SPREMENI (svež mount = vrata odprta) ---"
PREM=$(agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat PRE:  $PREM"
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus M1'" 2>&1 | tail -1
sleep 6
POSTM=$(agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat POST: $POSTM"

echo "--- V: regresija — vodja pečat (R180) še vedno živ ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('vodjo')||b.textContent.trim().includes('Pregled za vodjo')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatVodja: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- T: temna tema (meritve pečat berljiv) + window.__err ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Meritve'||b.textContent.trim()==='Meritve'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const barva=p?getComputedStyle(p).color:null; return JSON.stringify({pecatVidna: !!p, barvaTemna: barva, pageBg: getComputedStyle(document.body).backgroundColor});})()" 2>&1 | tail -1
agent-browser eval "JSON.stringify({err: window.__err ?? null})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r183-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R183 E2E KONEC"
