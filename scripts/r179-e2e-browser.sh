#!/bin/bash
# R179 E2E (lokalni build, EN klic — nauček R157/R168):
#  A: /api/version JAVNO vrača build žig (brez prijave, no-store);
#  B: banner SKRIT, ko je tab na trenutnem deployu (isti žig);
#  C: fetch-patch → /api/version vrača TUJ žig → banner VIDEN (role=status,
#     'Osveži' gumb, aria-labela) → restore → banner izgine (zdravilna pot);
#  P: /portal/<dev-žeton> SVETLA — bg tokeni (light bajtno enako prej);
#  D: portal FORSIRANO TEMEN — page ozadje #0f1724, NIČ svetlih madežev,
#     window.__err null.
# ⚠️ R171 NAUČEK: standalone RABI statiko — graditi z `npm run build`.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
TOKEN="r179-qa-portal-zeton"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r179-e2e-server.log 2>&1 < /dev/null &
sleep 5

echo "--- A: /api/version javno (brez seje) + no-store ---"
curl -s -o /dev/null -w "api/version status: %{http_code}\n" http://127.0.0.1:3100/api/version
curl -sI http://127.0.0.1:3100/api/version | grep -i "cache-control" || echo "(cache-control manjka!)"
curl -s http://127.0.0.1:3100/api/version | head -c 120; echo ""

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5

echo "--- B: banner SKRIT na trenutnem deployu (isti žig) — IZVEN VizTaba (banner je tam po zasnovi nemontiran, vzorec PwaStatus) ---"
for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
  sleep 4
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && echo "VizTab izhod OK (poskus $i)" && break
done
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); const zig=window.localStorage.getItem('roksal-update-dismissed-zig'); return JSON.stringify({bannerViden: !!pas, skritZig: zig});})()" 2>&1 | tail -1

echo "--- C: fetch-patch TUJ žig → banner VIDEN → restore → izgine ---"
agent-browser eval "window.__r179OrigFetch=window.fetch; window.fetch=(u,o)=>{ if(typeof u==='string'&&u.includes('/api/version')){ return Promise.resolve(new Response(JSON.stringify({build:'1999-01-01T00:00:00.000Z'}),{status:200,headers:{'Content-Type':'application/json'}})); } return window.__r179OrigFetch(u,o); }; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'patched'" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); const osvezi=pas?[...pas.querySelectorAll('button')].find(b=>b.textContent.trim()==='Osveži'):null; return JSON.stringify({bannerViden: !!pas, osveziGumb: !!osvezi, ariaLabel: osvezi?osvezi.getAttribute('aria-label'):null, roleStatus: pas?pas.getAttribute('role'):null});})()" 2>&1 | tail -1
agent-browser eval "window.fetch=window.__r179OrigFetch; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'restored'" 2>&1 | tail -1
# ⚠️ 30 s vrata (FOKUS_MIN_INTERVAL_MS, R170): 2. fokus v 30 s = zavrnjen —
# obnova se DOKAŽE po oknu (deterministično, vedenje po zasnovi).
sleep 31
agent-browser eval "window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'fokus po oknu'" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); return JSON.stringify({bannerVidenPoRestore: !!pas});})()" 2>&1 | tail -1

echo "--- P: /portal/<dev-žeton> SVETLA tema ---"
agent-browser open "http://127.0.0.1:3100/portal/$TOKEN" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const page=document.querySelector('.min-h-screen'); const bg=page?getComputedStyle(page).backgroundColor:null; const glava=document.body.innerText.includes('ROKSAL d.o.o.'); return JSON.stringify({bodyBg: body, pageBg: bg, glavaVidna: glava, htmlDark: document.documentElement.classList.contains('dark')});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r179-portal-svetla.png > /dev/null 2>&1 && echo "screenshot SVETLA OK"

echo "--- D: portal FORSIRANO TEMEN (simulacija osebja s shranjeno temo) ---"
agent-browser eval "document.documentElement.classList.add('dark'); 'temna dodana'" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const page=document.querySelector('.min-h-screen'); const bg=page?getComputedStyle(page).backgroundColor:null; const sekcije=[...document.querySelectorAll('section')].slice(0,4).map(s=>getComputedStyle(s).backgroundColor); return JSON.stringify({pageBgTemna: bg, prveSekcije: sekcije, htmlDark: document.documentElement.classList.contains('dark')});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r179-portal-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R179 E2E KONEC"
