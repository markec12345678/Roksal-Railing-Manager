#!/bin/bash
# R180 E2E dopolnilo (vodja + računi — moja polovica runde):
#  V: 'Več' → Pregled za vodjo — pečat 'Osveženo ob' VIDEN + focus → čas pečata
#     se SPREMENI (vedenjski dokaz refetch-on-focus, vzorec R178/R179 probe).
#  R: CRM → računi (FURS) — pečat v CardHeader VIDEN + focus → čas se spremeni.
#  T: temna tema na obeh — pečat ostane berljiv (token barve).
# ⚠️ R171 NAUČEK: standalone RABI statiko — graditi z `npm run build`.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r180-e2e-vr-server.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6

for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
  sleep 4
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && echo "VizTab izhod OK (poskus $i)" && break
done

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- V: Pregled za vodjo — pečat VIDEN, focus → čas se SPREMENI (refetch živo) ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('vodjo')||(b.textContent.trim().includes('Pregled za vodjo'))); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span,p')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const glava=[...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='Pregled za vodjo'); return JSON.stringify({glavaVodja: glava, pecat1: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus 1'" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span,p')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({pecat2: p?p.textContent.trim():null, errorPaneli: err});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r180-vodja.png > /dev/null 2>&1 && echo "screenshot VODJA OK"

echo "--- R: CRM → Računi (FURS) — pečat v CardHeader VIDEN, focus → čas se SPREMENI ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM')||b.textContent.trim().includes('CRM')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const racuni=[...document.querySelectorAll('h3,div')].filter(e=>e.textContent.trim().startsWith('Računi (FURS)')).length; const p=[...document.querySelectorAll('span,p')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({racuniGlava: racuni>0, pecat1: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus 2'" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span,p')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({pecat2: p?p.textContent.trim():null, errorPaneli: err});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r180-racuni.png > /dev/null 2>&1 && echo "screenshot RAČUNI OK"

echo "--- T: temna tema na CRM — pečat ostane berljiv ---"
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatBarvaTemna: p?getComputedStyle(p).color:null, htmlDark: document.documentElement.classList.contains('dark')});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R180 E2E (VODJA+RAČUNI) KONEC"
