#!/bin/bash
# R189 E2E ŽIVO EN KLIC (vzorec r184-r187): standalone :3100 + ADMIN.
#  Z0: vodja dashboard → kartica 'Sistem — zdravje' + R189 zgodovina trak
#      (1 palica po prvi preverbi + aria povzetek + oznaka obsega);
#  Z1: fokus po 35 s → pečat delta + zgodovina ZRASTE na 2 palici
#      (vedenjski dokaz ringa — samo uspešne preverbe dodajajo);
#  Z3: fetch-patch 503 → role=alert 'Zdravje sistema: simulacija R189'
#      + pečat NULL + zgodovina NESPREMENJENA (fail-closed: napaka NE doda
#      palice) → restore + 'Poskusi znova' → ozdravljen + trak NE lažno narastel
#      med napako (raste šele pri uspešni preverbi);
#  Z4: VizTab (MONTER dom) — dispatch offline → 'Ni povezave' pas VIDEN v
#      produktni lupini (R189 montaža) in točko ENKRAT v dokumentu
#      (izključitev dvojnega pasa proti page.tsx montaži) → online → izginil;
#  Z2: regrese — meritve CSV gumb (R186), temna + __err null.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
export NEXT_PUBLIC_BUILD_STAMP="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"  # R189: VELJAVEN ISO — footer 'Zgrajeno' deterministično (zigIzpis fail-closed sicer SKRIJE)

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r189-e2e-server.log 2>&1 < /dev/null &
sleep 5

echo "--- preflight ---"
curl -s -o /dev/null -w "login http: %{http_code}\n" http://127.0.0.1:3100/login
curl -s "http://127.0.0.1:3100/api/public/health" | head -c 120; echo ""

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1

echo "--- ZL: prijava noga 'Zgrajeno' (R189, EN VIR zigIzpis, javna ruta) ---"
agent-browser eval "(()=>{const f=[...document.querySelectorAll('main p')].find(p=>p.textContent.includes('Zgrajeno')); return JSON.stringify({noga:!!f, izpis:f?f.textContent.trim():null, suroviIso:f?f.textContent.includes('T')&&f.textContent.includes('Z'):false, title:f?f.getAttribute('title'):null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r189-prijava-zgrajeno.png > /dev/null 2>&1 && echo "screenshot PRIJAVA OK"

agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6

echo "--- NAV: obvezen krog → dashboard → Več → Pregled za vodjo ---"
for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
  sleep 4
  agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Domov'); if(d) d.click(); return !!d;})()" > /dev/null 2>&1
  sleep 4
  VEC=$(agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Več'); return String(v);})()" 2>&1 | tail -1)
  [ "$VEC" = "true" ] && echo "Več dosežen (poskus $i)" && break
done
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('vodjo')||b.textContent.trim().includes('Pregled za vodjo')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7

ZDRAVJE_PROBE='(()=>{const h=[...document.querySelectorAll("h1,h2,h3,div")].find(e=>e.textContent.trim().startsWith("Sistem — zdravje")); if(!h) return JSON.stringify({kartica:false}); const kart=h.closest("div.rounded-xl")||h.parentElement?.parentElement?.parentElement; const telo=kart?kart.textContent:""; const trak=kart?kart.querySelector("[role=img]"):null; const palice=trak?trak.querySelectorAll("span").length:0; const p=kart?[...kart.querySelectorAll("span")].find(e=>e.textContent.trim().startsWith("Osveženo ob")):null; return JSON.stringify({kartica:true, znackaBaza:telo.includes("Baza odgovarja"), odzivMs:/Odziv: \d+ ms/.test(telo), zgrajeno:telo.includes("Zgrajeno"), pecat:p?p.textContent.trim():null, paliceN:palice, ariaPovzetek:trak?trak.getAttribute("aria-label"):null, oznakaObsega:/Odzivni časi \(/.test(telo), statistikaR189:/\d+–\d+ ms, povp\. \d+/.test(telo)});})()'

echo "--- Z0: zdravje kartica + zgodovina trak (1 palica) ---"
agent-browser eval "$ZDRAVJE_PROBE" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r189-zdravje-zgodovina.png > /dev/null 2>&1 && echo "screenshot ZDRAVJE OK"

echo "--- Z1: fokus po 35 s → pečat delta + zgodovina 1→2 palici (vedenjski ring) ---"
PRES=$(agent-browser eval "(()=>{const h=[...document.querySelectorAll('h1,h2,h3,div')].find(e=>e.textContent.trim().startsWith('Sistem — zdravje')); const kart=h?.closest('div.rounded-xl')||h?.parentElement?.parentElement?.parentElement; const p=kart?[...kart.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
PALICE_PRE=$(agent-browser eval "$ZDRAVJE_PROBE" 2>&1 | tail -1)
echo "pečat PRE:  $PRES"
echo "trak PRE:   $PALICE_PRE"
sleep 35
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus'" > /dev/null 2>&1
sleep 8
POSTS=$(agent-browser eval "(()=>{const h=[...document.querySelectorAll('h1,h2,h3,div')].find(e=>e.textContent.trim().startsWith('Sistem — zdravje')); const kart=h?.closest('div.rounded-xl')||h?.parentElement?.parentElement?.parentElement; const p=kart?[...kart.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
PALICE_POST=$(agent-browser eval "$ZDRAVJE_PROBE" 2>&1 | tail -1)
echo "pečat POST: $POSTS"
echo "trak POST:  $PALICE_POST"
[ -n "$PRES" ] && [ -n "$POSTS" ] && [ "$PRES" != "$POSTS" ] && echo "ZDRAVJE FOKUS DELTA: DOKAZANA" || echo "ZDRAVJE FOKUS DELTA: NI"
# R189 nauček: EN fokus = 2 realna fetcha (kartica hook pred unmountom + remount
# mount efekt — dashboard if(loading) remontira kartico) → zgodovina zraste za 2
# (obe meritev REALNI). Trditev: rast >= 1, ne točno 2.
echo "$PALICE_POST" | grep -oE 'paliceN.{0,3}[0-9]+' | grep -oE '[0-9]+$' > /tmp/r189-post.txt
echo "$PALICE_PRE" | grep -oE 'paliceN.{0,3}[0-9]+' | grep -oE '[0-9]+$' > /tmp/r189-pre.txt
POSTN=$(cat /tmp/r189-post.txt); PREN=$(cat /tmp/r189-pre.txt)
[ -n "$POSTN" ] && [ -n "$PREN" ] && [ "$POSTN" -gt "$PREN" ] && echo "ZGODOVINA RING RAST ${PREN}→${POSTN}: DOKAZANA" || echo "ZGODOVINA RING RAST: NI"

echo "--- Z3: fetch-patch 503 → fail-verbose + pečat null + zgodovina FAIL-CLOSED ---"
agent-browser eval "(()=>{const orig=window.fetch; window.__r189OrigFetch=orig; window.fetch=async (input,init)=>{const url=typeof input==='string'?input:(input&&input.url)||''; if(url.includes('/api/public/health')){return new Response(JSON.stringify({ok:false,db:'fail',error:'simulacija R189'}),{status:503,headers:{'content-type':'application/json'}});} return orig(input,init);}; return 'patched';})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus za 503'" > /dev/null 2>&1
sleep 6
agent-browser eval "$ZDRAVJE_PROBE" 2>&1 | tail -1
agent-browser eval "(()=>{const btn=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Ponovno preveri zdravje sistema'); if(btn) btn.click(); return !!btn;})()" > /dev/null 2>&1
sleep 4
echo "po 'Poskusi znova' (pod 503 patch):"
agent-browser eval "$ZDRAVJE_PROBE" 2>&1 | tail -1
agent-browser eval "window.fetch=window.__r189OrigFetch; 'restored'" > /dev/null 2>&1
agent-browser eval "(()=>{const btn=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Ponovno preveri zdravje sistema'); if(btn) btn.click(); return !!btn;})()" > /dev/null 2>&1
sleep 6
echo "po restore + 'Poskusi znova':"
agent-browser eval "$ZDRAVJE_PROBE" 2>&1 | tail -1

echo "--- Z4: VizTab (MONTER dom) — offline pas VIDEN v lupini, točko ENKRAT ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Vizualizacija')||b.textContent.trim().startsWith('Vizualizacija')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const sh=document.querySelector('[data-testid=viz-product-shell]'); return JSON.stringify({lupina:!!sh});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('offline')); 'offline'" > /dev/null 2>&1
sleep 3
echo "OFFLINE v VizTab:"
agent-browser eval "(()=>{const sh=document.querySelector('[data-testid=viz-product-shell]'); const vse=document.body.textContent.split('Ni povezave').length-1; return JSON.stringify({pasVLupini:sh?sh.textContent.includes('Ni povezave'):false, vDokumentuN:vse});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r189-viz-offline.png > /dev/null 2>&1 && echo "screenshot VIZ OFFLINE OK"
agent-browser eval "window.dispatchEvent(new Event('online')); 'online'" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const sh=document.querySelector('[data-testid=viz-product-shell]'); return JSON.stringify({pasVLupini:sh?sh.textContent.includes('Ni povezave'):false});})()" 2>&1 | tail -1

echo "--- Z2: regrese — meritve CSV gumb (R186) + temna + __err ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); return JSON.stringify({meritveCsvGumb:g});})()" 2>&1 | tail -1
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({pageBg:getComputedStyle(document.body).backgroundColor, err:window.__err ?? null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r189-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

echo "--- ZD: 429 podrobnost ŽIVO (realna blokada — vzorec R185 sintetična blokada) ---"
agent-browser eval "fetch('/api/auth/logout',{method:'POST'}).then(r=>r.status); 'odjava'" > /dev/null 2>&1
sleep 2
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
# 10 realnih neuspelih prijav (neznan racun = isti 401 kot napačno geslo;
# ne razkrivamo lastništva) → limit trip → 11. poskus = 429 z detail
REZ=$(agent-browser eval "(async()=>{const izidi=[]; for(let i=0;i<10;i++){ const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'r189-rate-probe@roksal.si',password:'napačno-'+i})}); izidi.push(r.status);} return JSON.stringify({izidi});})()" 2>&1 | tail -1)
echo "10 poskusov: $REZ"
echo "$REZ" | grep -q '\[401' && echo "LIMIT TRIP: 10× 401 POTRJENO" || echo "LIMIT TRIP: NI 401 zaporedja"
agent-browser fill 'input[type="email"]' 'r189-rate-probe@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'spretorno-izmišljeno-geslo' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const a=document.querySelector('[role=alert]'); if(!a) return JSON.stringify({alert:false}); const telo=a.textContent; const podrobnost=a.querySelector('span span'); return JSON.stringify({alert:true, glavno:telo.includes('Preveč poskusov prijave.'), podrobnost429:telo.includes('Poskusi znova čez'), podrobnostVrstica:podrobnost?podrobnost.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r189-429-podrobnost.png > /dev/null 2>&1 && echo "screenshot 429 OK"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R189 E2E KONEC"
