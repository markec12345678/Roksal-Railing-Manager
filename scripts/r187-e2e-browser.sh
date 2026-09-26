#!/bin/bash
# R187 E2E ŽIVO EN KLIC (vzorec r184-r186): standalone :3100 + ADMIN.
#  Z0: vodja dashboard → kartica 'Sistem — zdravje' VIDNA + značka
#      'Baza odgovarja' + Odziv N ms (realna meritev) + 'Zgrajeno' podrobnost
#      + pečat 'Osveženo ob';
#  Z1: fokus → pečat kartice se SPREMENI (vedenjski refetch — 30 s vrata;
#      zato čakamo 35 s);
#  Z2: 'Poskusi znova' gumb prisoten v fail veji (aria) + regrese: meritve
#      CSV gumb (R186), vodja pečat (R180), temna + __err null.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
export NEXT_PUBLIC_BUILD_STAMP="r187-e2e-$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r187-e2e-server.log 2>&1 < /dev/null &
sleep 5

echo "--- preflight ---"
curl -s -o /dev/null -w "login http: %{http_code}\n" http://127.0.0.1:3100/login
curl -s "http://127.0.0.1:3100/api/public/health" | head -c 120; echo ""

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- NAV: obvezen krog → dashboard → Več → Pregled za vodjo ---"
for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
  sleep 4
  agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Domov'); if(d) d.click(); return !!d;})()" > /dev/null 2>&1
  sleep 4
  VEC=$(agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Več'); return String(v);})()" 2>&1 | tail -1)
  [ "$VEC" = "true" ] && echo "Več dosežen (poskus $i)" && break
done
agent-browser eval "$VECPOMOC" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('vodjo')||b.textContent.trim().includes('Pregled za vodjo')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7

echo "--- Z0: kartica 'Sistem — zdravje' — značka + odziv + Zgrajeno + pečat ---"
agent-browser eval "(()=>{const h3=[...document.querySelectorAll('h1,h2,h3,div')].find(e=>e.textContent.trim().startsWith('Sistem — zdravje')); if(!h3) return JSON.stringify({kartica:false}); const kart=h3.closest('div.rounded-xl')||h3.closest('[class*=card]')||h3.parentElement?.parentElement?.parentElement; const telo=kart?kart.textContent:''; const p=[...kart.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({kartica:true, znackaBaza:telo.includes('Baza odgovarja'), odzivMs:/Odziv: \d+ ms/.test(telo), zgrajeno:telo.includes('Zgrajeno'), pecat:p?p.textContent.trim():null, sondaOpomba:telo.includes('pinguje bazo'), failPanel:telo.includes('Poskusi znova')||telo.includes('Zdravja sistema')});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r187-zdravje-kartica.png > /dev/null 2>&1 && echo "screenshot ZDRAVJE OK"

echo "--- Z1: fokus po 35 s → pečat kartice se SPREMENI (vedenjski) ---"
PRES=$(agent-browser eval "(()=>{const h3=[...document.querySelectorAll('h1,h2,h3,div')].find(e=>e.textContent.trim().startsWith('Sistem — zdravje')); const kart=h3?.closest('div.rounded-xl')||h3?.parentElement?.parentElement?.parentElement; const p=kart?[...kart.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat PRE:  $PRES"
sleep 35
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus'" > /dev/null 2>&1
sleep 8
POSTS=$(agent-browser eval "(()=>{const h3=[...document.querySelectorAll('h1,h2,h3,div')].find(e=>e.textContent.trim().startsWith('Sistem — zdravje')); const kart=h3?.closest('div.rounded-xl')||h3?.parentElement?.parentElement?.parentElement; const p=kart?[...kart.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat POST: $POSTS"
[ -n "$PRES" ] && [ -n "$POSTS" ] && [ "$PRES" != "$POSTS" ] && echo "ZDRAVJE FOKUS DELTA: DOKAZANA" || echo "ZDRAVJE FOKUS DELTA: NI"

echo "--- Z2: regrese — meritve CSV gumb (R186) + temna + __err ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); return JSON.stringify({meritveCsvGumb:g});})()" 2>&1 | tail -1
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({pageBg:getComputedStyle(document.body).backgroundColor, err:window.__err ?? null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r187-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R187 E2E KONEC"
