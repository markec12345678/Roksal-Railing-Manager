#!/bin/bash
# R180 E2E (lokalni build, EN klic — nauček R157/R168):
#  A: /api/version JAVNO vrača build žig (brez prijave, no-store);
#  B: banner SKRIT na trenutnem deployu v app (isti žig; izven VizTaba);
#  P: /portal/<dev-žeton> — pečat 'Osveženo ob HH:MM:SS' VIDEN in ENAK
#     Intl-izračunu z pasom Europe/Ljubljana (TZ dokaz v DOM!), banner SKRIT;
#  C: na PORTALU fetch-patch TUJ žig → focus → pas VIDEN (role=status, Osveži,
#     aria-labela) → Skrij → pas IZGINE + localStorage žig → restore → po 30 s
#     oknu focus → pas ŠE VEDNO SKRIT (skrit na deploy — strankina zanka čista);
#  D: portal FORSIRANO TEMEN — page ozadje #0f1724, pečat tematsko pravilen,
#     NIČ svetlih madežev.
# ⚠️ R171 NAUČEK: standalone RABI statiko — graditi z `npm run build`.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
TOKEN="r180-qa-portal-zeton"

node scripts/r180-seed-portal-dev.mjs || { echo "SEED NEUSPEŠEN"; exit 1; }

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r180-e2e-server.log 2>&1 < /dev/null &
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

echo "--- B: app banner SKRIT na trenutnem deployu (isti žig) — izven VizTaba ---"
for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
  sleep 4
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && echo "VizTab izhod OK (poskus $i)" && break
done
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); return JSON.stringify({appBannerViden: !!pas});})()" 2>&1 | tail -1

echo "--- P: /portal/<dev-žeton> — pečat VIDEN + TZ dokaz (Ljubljana ≠ UTC) + banner SKRIT ---"
# Retry zanka ×3 (nauček R175: agent-browser open flake) — dokument PRISPEL?
PECAT_OK=0
for i in 1 2 3; do
  agent-browser open "http://127.0.0.1:3100/portal/$TOKEN" > /dev/null 2>&1
  sleep 4
  PREVERBA=$(agent-browser eval "(()=>{const m=document.body.innerText.match(/Osveženo ob (\d{2}):(\d{2}):(\d{2})/); return m?'DOKAZANO':'MANJKA';})()" 2>&1 | tail -1)
  [ "$PREVERBA" = '"DOKAZANO"' ] && PECAT_OK=1 && break
  echo "(poskus $i: pečat manjka — ponovno odpiram)"
done
[ "$PECAT_OK" != "1" ] && { echo "PORTAL PEČAT NEVIDEN ×3"; agent-browser close --all > /dev/null 2>&1; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; echo "R180 E2E KONEC (NEDELOUČEN)"; exit 1; }
# TZ dokaz: pečat je PEČEN ob izrisu strani ( nekaj sekund pred evalom ) —
# primerjamo sekunde-dneva z toleranco ±90 s. Izris v UTC bi odstopal za
# natanko 7200 s (2 h) — daleč izven tolerance; ±90 s dokazuje Europe/Ljubljana.
agent-browser eval "(()=>{const m=document.body.innerText.match(/Osveženo ob (\d{2}):(\d{2}):(\d{2})/); if(!m) return JSON.stringify({pecat:null}); const domS=(+m[1])*3600+(+m[2])*60+(+m[3]); const zdaj=new Intl.DateTimeFormat('sl-SI',{timeZone:'Europe/Ljubljana',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date()); const p=zdaj.match(/(\d{2}):(\d{2}):(\d{2})/); const zdajS=(+p[1])*3600+(+p[2])*60+(+p[3]); const delta=(domS-zdajS+86400)%86400; const ok=delta<=90||delta>=86400-90; const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); const glava=document.body.innerText.includes('ROKSAL d.o.o.'); const tooltip=!!document.querySelector('[title=\"Čas nalaganja podatkov te strani\"]'); return JSON.stringify({pecatCas:m[0].replace('Osveženo ob ',''), ljubljanaZdaj:zdaj, sekundaRazlika:Math.min(delta,86400-delta), TZdokaz: ok?'LJUBLJANA ✓':'NAPAKA', bannerNaPortalu: !!pas, glavaVidna: glava, tooltipObstaja: tooltip});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r180-portal-svetla.png > /dev/null 2>&1 && echo "screenshot SVETLA OK"

echo "--- C: PORTAL fetch-patch TUJ žig → pas VIDEN → Skrij → izgine → (restore) po oknu ŠE VEDNO skrit ---"
agent-browser eval "window.__r180OrigFetch=window.fetch; window.fetch=(u,o)=>{ if(typeof u==='string'&&u.includes('/api/version')){ return Promise.resolve(new Response(JSON.stringify({build:'1999-01-01T00:00:00.000Z'}),{status:200,headers:{'Content-Type':'application/json'}})); } return window.__r180OrigFetch(u,o); }; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'patched'" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); const osvezi=pas?[...pas.querySelectorAll('button')].find(b=>b.textContent.trim()==='Osveži'):null; const skrij=pas?[...pas.querySelectorAll('button')].find(b=>b.textContent.trim()!=='Osveži'):null; return JSON.stringify({pasViden: !!pas, role: pas?pas.getAttribute('role'):null, osveziGumb: !!osvezi, skrijGumb: !!skrij});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const skrij=[...document.querySelectorAll('[role=\"status\"] button')].find(b=>b.getAttribute('aria-label')==='Skrij obvestilo o novi verziji'); if(skrij) skrij.click(); return !!skrij;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); return JSON.stringify({pasPoSkritju: !!pas, skritZig: window.localStorage.getItem('roksal-update-dismissed-zig')});})()" 2>&1 | tail -1
agent-browser eval "window.fetch=window.__r180OrigFetch; 'restored'" 2>&1 | tail -1
sleep 31
agent-browser eval "window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'fokus po oknu'" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); return JSON.stringify({pasPoRestoreInOknu: !!pas});})()" 2>&1 | tail -1
# higiena: počisti skrit žig, da spot ostane čist
agent-browser eval "window.localStorage.removeItem('roksal-update-dismissed-zig'); 'ocisceno'" 2>&1 | tail -1

echo "--- D: portal FORSIRANO TEMEN (simulacija naprave s shranjeno temo) ---"
agent-browser eval "document.documentElement.classList.add('dark'); 'temna dodana'" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const page=document.querySelector('.min-h-screen'); const bg=page?getComputedStyle(page).backgroundColor:null; const pecat=document.querySelector('[title=\"Čas nalaganja podatkov te strani\"]'); const pecatBarva=pecat?getComputedStyle(pecat.querySelector('p')).color:null; const sekcije=[...document.querySelectorAll('section')].slice(0,3).map(s=>getComputedStyle(s).backgroundColor); return JSON.stringify({pageBgTemna: bg, pecatBarvaTemna: pecatBarva, prveSekcije: sekcije, htmlDark: document.documentElement.classList.contains('dark')});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r180-portal-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R180 E2E KONEC"
