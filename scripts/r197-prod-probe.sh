#!/bin/bash
# R197 produkcija QA — R196 fingerprinti ŽIVO (build 00:46:18.476Z):
#   (a) žig ✓ (že preverjen: 00:46:18.476Z = R196)
#   (b) MONTER ŽIVO: prijava → zvonček 'Nova prijava v vaš račun' (badge ≥1, oznaka naprave)
#   (c) NEW_LOGIN NI v javnih chunkih (server-only)
#   (d) regresije: seje dialog, CSRF toast, CSV gumb, offline pas, temna, __err null
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "=== (c) byte probe: NEW_LOGIN v javnih chunkih? ==="
HTML=$(curl -sS -m 15 "$PROD/login")
echo "$HTML" | grep -oE '/_next/static/chunks/[a-z0-9]+\.js' | sort -u > /tmp/r197-chunks.txt
N1=0; N2=0; N3=0
while read -r c; do
  J=$(curl -sS -m 15 "$PROD$c")
  echo "$J" | grep -q 'Nova prijava v vaš račun' && N1=$((N1+1))
  echo "$J" | grep -q 'roksal:csrf-zavrnjen' && N2=$((N2+1))
  echo "$J" | grep -q 'dvojni podpis' && N3=$((N3+1))
done < /tmp/r197-chunks.txt
CH=$(wc -l < /tmp/r197-chunks.txt | tr -d ' ')
echo "chunkov pregledanih: $CH"
echo "NEW_LOGIN 'Nova prijava' v javnih chunkih: $N1 (pričakovano 0 = server-only)"
echo "'roksal:csrf-zavrnjen' client: $N2 (pričakovano ≥1)"
echo "'dvojni podpis' client: $N3 (pričakovano ≥1)"

echo "=== (b) UI prijava → zvonček NEW_LOGIN ŽIVO ==="
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
ZVONCEK=$(agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); return JSON.stringify({zvoncek:!!b, aria:b?b.getAttribute('aria-label'):null});})()" 2>&1 | tail -1)
echo "ZVONCEK: $ZVONCEK"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'brez'; b.click(); return 'kliknjen';})()" > /dev/null 2>&1
sleep 4
SHEET=$(agent-browser eval "(()=>{const s=[...document.querySelectorAll('[role=dialog]')].pop(); if(!s) return JSON.stringify({sheet:false}); const telo=s.textContent; return JSON.stringify({sheet:true, novaPrijava:telo.includes('Nova prijava v vaš račun'), poslana:telo.includes('Poslana obvestila'), naprava:telo.includes('Računalnik')||telo.includes('Brska')||telo.includes('Naprava')});})()" 2>&1 | tail -1)
echo "SHEET: $SHEET"
agent-browser screenshot "$SS/qa-r197-prod-zvoncek.png" > /dev/null 2>&1 && echo "screenshot ZVONCEK OK"

echo "=== (d) regresije ==="
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(z) z.click(); return 'zapri';})()" > /dev/null 2>&1
sleep 1
MERITVE=$(agent-browser eval "(()=>{const n=[...document.querySelectorAll('a,[role=menuitem]')].find(x=>x.textContent.trim().startsWith('Meritve')); if(!n) return 'brez'; n.click(); return 'klik';})()" 2>&1 | tail -1)
sleep 4
CSVG=$(agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('CSV')||b.textContent.trim().includes('CSV')); return JSON.stringify({csvGumb:!!g, osvezeno:[...document.querySelectorAll('span')].some(e=>e.textContent.trim().startsWith('Osveženo ob'))});})()" 2>&1 | tail -1)
echo "MERITVE($MERITVE): $CSVG"
ERR1=$(agent-browser eval "(()=>{const e=[...document.querySelectorAll('[data-nextjs-error],[data-__err]')]; return JSON.stringify({__err:e.length, alerti:[...document.querySelectorAll('[role=alert]')].length});})()" 2>&1 | tail -1)
echo "__ERR/alerti (Meritve): $ERR1"
TEMNA=$(agent-browser eval "(()=>{const h=document.documentElement; const prej=h.classList.contains('dark'); const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('tema')||(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(t) t.click(); return JSON.stringify({gumb:!!t, prej});})()" 2>&1 | tail -1)
sleep 2
TEMNA2=$(agent-browser eval "JSON.stringify({darkZdaj:document.documentElement.classList.contains('dark'), ozadje:getComputedStyle(document.body).backgroundColor})()" 2>&1 | tail -1)
echo "TEMNA: $TEMNA → $TEMNA2"
agent-browser screenshot "$SS/qa-r197-prod-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('tema')||(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(t) t.click(); return 'nazaj';})()" > /dev/null 2>&1
sleep 1

echo "=== odjava cleanup ==="
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
echo "=== R197 produkcija probe konec ==="
