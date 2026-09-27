#!/bin/bash
# R185 E2E ŽIVO EN KLIC (vzorec r184): standalone :3100 + ADMIN + F3
# sintetična blokada (resnični 429-i) → panel NE-PRAZNA pot živo:
#  T:  telemetrija omejitve — tripsTotal čip RDEČ, seznam blokad VIDEN
#      ('login' jantar značka + 10-hex odtis + '2×'), prazno stanje ODSOTNO,
#      PII: surov e-naslov probe NI v body, gumb izvoza CSV omogočen;
#  V:  vodja regresija (R180 pečat);
#  T2: temna + window.__err null.
# ⚠️ standalone RABI statiko — graditi z bun run build (nauček R171).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
export NEXT_PUBLIC_BUILD_STAMP="r185-e2e-$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r185-e2e-server.log 2>&1 < /dev/null &
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

echo "--- F3: sintetična blokada — 12 napačenih prijav (probe e-naslov) → 2× 429 ---"
SINT=$(agent-browser eval "(async()=>{const e='r185-probe@roksal.si'; const izidi=[]; for(let i=0;i<12;i++){try{const r=await fetch('/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:e,password:'napacno-geslo-'+i})}); izidi.push(r.status);}catch(err){izidi.push('ERR');}} return JSON.stringify({izidi});})()" 2>&1 | tail -1)
echo "izidi: $SINT"
echo "429 št: $(echo "$SINT" | grep -o '429' | wc -l)"

echo "--- API dokaz: /api/security/rate-limit → trips > 0 (ADMIN seja) ---"
agent-browser eval "fetch('/api/security/rate-limit').then(r=>r.json().then(j=>JSON.stringify({status:r.status, keys:j.stats&&j.stats.keys, hits:j.stats&&j.stats.hits, tripsTotal:j.tripsTotal, tripsLen:Array.isArray(j.trips)?j.trips.length:null, prva:(j.trips&&j.trips[0])||null}))).catch(e=>JSON.stringify({status:'ERR',err:String(e).slice(0,60)}))" 2>&1 | tail -1

echo "--- T: Ekipa → panel NE-PRAZNA pot (čip rdeč + seznam + značka + odtis) ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().includes('Ekipa')||b.textContent.trim().includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const hs=[...document.querySelectorAll('h3')].find(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); if(!hs) return JSON.stringify({panel:false}); const kartica=hs.closest('div.rounded-xl'); const telo=kartica?kartica.textContent:''; const vrstice=kartica?[...kartica.querySelectorAll('li')]:[]; const znacka=kartica?[...kartica.querySelectorAll('.font-mono')].map(b=>b.textContent.trim()).slice(0,3):[]; const prazno=telo.includes('Ni zabeleženih blokad'); const izvoz=kartica?[...kartica.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Izvozi')):null; const p=[...kartica.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({panel:true, tripsTotalViden:telo.includes('blokad skupaj'), seznamVrstic:vrstice.length, praznoStanje:prazno, znacke:znacka, odtisViden:/[0-9a-f]{10}/.test(telo), countViden:telo.includes('2×'), piiUcrtal:telo.includes('r185-probe@roksal.si'), izvozGumb:!!izvoz, izvozOmogocen:izvoz?!izvoz.disabled:null, pecat:p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r185-sinteticna-blokada.png > /dev/null 2>&1 && echo "screenshot BLOKADA OK"

echo "--- V: regresija — vodja pečat (R180) ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('vodjo')||b.textContent.trim().includes('Pregled za vodjo')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const glava=document.body.innerText.includes('Pregled za vodjo'); return JSON.stringify({vodjaGlava:glava, vodjaPecat:p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- T2: temna tema + window.__err ---"
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({pageBg: getComputedStyle(document.body).backgroundColor, err: window.__err ?? null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r185-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R185 E2E KONEC"
