#!/bin/bash
# R230 Z1 diag — kje je kartica? (default tab + dashboard dispatch + DOM dump)
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r230-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R230-server-diag.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

node scripts/r228-narocilo-tmp.cjs raise || exit 1

pocakaj_na() {
  local pred="$1" maks="${2:-10}" R
  for i in $(seq 1 "$maks"); do
    R=$(agent-browser eval "$pred" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then echo "  najdeno (poskus $i)"; return 0; fi
    sleep 1.5
  done
  echo "  NI NAJDENO (zadnji: $R)"; return 1
}

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 20
sleep 3
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 1
done

echo "=== DIAG 1: default tab — kateri gumbi aria-pressed? ==="
agent-browser eval "(()=>{const pr=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].map(b=>b.textContent.trim().slice(0,20)); const kartice=[...document.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||'').filter(a=>a.startsWith('Zamujena')||a.startsWith('Brez dobavitelja')); return JSON.stringify({pressedTab:pr, karticeNaZaslonu:kartice, h2:[...document.querySelectorAll('h1,h2')].map(h=>h.textContent.trim().slice(0,30)).slice(0,6)});})()" 2>&1 | tail -1

echo "=== DIAG 2: eksplicitni dispatch dashboard ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const kartice=[...document.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||'').filter(a=>a.startsWith('Zamujena')||a.startsWith('Brez dobavitelja')||a.startsWith('Nizka')); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava ('));
const naro=document.body.textContent.includes('Naročila, ki čakajo na dejanje'); return JSON.stringify({kartice:kartice.slice(0,6), zamujenaAria:zam?(zam.getAttribute('aria-label')||'').slice(0,60):null, naroKartica:naro});})()" 2>&1 | tail -1

node scripts/r228-narocilo-tmp.cjs restore
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
echo "=== DIAG KONEC ==="
