#!/bin/bash
# R198 produkcija QA — R197 fingerprinti ŽIVO (build 01:23:06.560Z):
#   (a) žig + /api/public/health (200 db:'ok') — že curl-potrjeno pred skripto
#   (b) byte probe: 'Vaš račun je aktiviran' server-only (×0 javno), ShieldCheck client ≥1, 'Preveč zahtev.' ×0 client
#   (c) MONTER ŽIVO: prijava → zvonček varnostne vrstice s ščitom (bg-roksal-amber/10)
#   (d) regresije: CSV gumb, offline pas (online skrit), temna rgb(15,23,36), __err null, logout 200
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "=== (b) byte probe: javni chunki /login ==="
HTML=$(curl -sS -m 15 "$PROD/login")
echo "$HTML" | grep -oE '/_next/static/chunks/[a-z0-9]+\.js' | sort -u > /tmp/r198-chunks.txt
ACT=0; SHIELD=0; RATE=0; NEWLOGIN=0
while read -r c; do
  J=$(curl -sS -m 15 "$PROD$c")
  echo "$J" | grep -q 'Vaš račun je aktiviran' && ACT=$((ACT+1))
  echo "$J" | grep -q 'ShieldCheck' && SHIELD=$((SHIELD+1))
  echo "$J" | grep -q 'Preveč zahtev.' && RATE=$((RATE+1))
  echo "$J" | grep -q 'Nova prijava v vaš račun' && NEWLOGIN=$((NEWLOGIN+1))
done < /tmp/r198-chunks.txt
CH=$(wc -l < /tmp/r198-chunks.txt | tr -d ' ')
echo "chunkov pregledanih: $CH"
echo "'Vaš račun je aktiviran' javno: $ACT (pričakovano 0 = server-only)"
echo "'ShieldCheck' client: $SHIELD (pričakovano ≥1 — VARNOSTNE_PREDLOGE set)"
echo "'Preveč zahtev.' client: $RATE (invarianta 0)"
echo "'Nova prijava v vaš račun' javno: $NEWLOGIN (pričakovano 0 = server-only)"

echo "=== (c) UI prijava → zvonček varnostne vrstice ŽIVO ==="
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
ERRJ=$(agent-browser eval "JSON.stringify({__err:!!window.__err, msg: window.__err? String(window.__err.message||window.__err).slice(0,80):null})" 2>&1 | tail -1)
echo "__ERR: $ERRJ"
ZVONCEK=$(agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); return JSON.stringify({zvoncek:!!b, aria:b?b.getAttribute('aria-label'):null});})()" 2>&1 | tail -1)
echo "ZVONCEK: $ZVONCEK"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'brez'; b.click(); return 'kliknjen';})()" > /dev/null 2>&1
sleep 4
SEC=$(agent-browser eval "(()=>{const s=[...document.querySelectorAll('[role=dialog]')].pop(); if(!s) return JSON.stringify({sheet:false}); const telo=s.textContent; const stiri=[...s.querySelectorAll('div')].filter(d=>d.className&&typeof d.className==='string'&&d.className.includes('bg-roksal-amber/10')); return JSON.stringify({sheet:true, novaPrijava:telo.includes('Nova prijava v vaš račun'), poslana:telo.includes('Poslana obvestila'), stitVrstic:stiri.length, prvaVrstica:(stiri[0]? stiri[0].textContent.trim().slice(0,60):null)});})()" 2>&1 | tail -1)
echo "ZVONCEK-SHEET: $SEC"
agent-browser screenshot "$SS/qa-r198-prod-zvoncek.png" > /dev/null 2>&1 && echo "screenshot ZVONCEK OK"

echo "=== (d) regresije ==="
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(z) z.click(); return 'zapri';})()" > /dev/null 2>&1
sleep 1
MERITVE=$(agent-browser eval "(()=>{const n=[...document.querySelectorAll('a,[role=menuitem]')].find(x=>x.textContent.trim().startsWith('Meritve')); if(!n) return 'brez'; n.click(); return 'klik';})()" 2>&1 | tail -1)
echo "NAV Meritve: $MERITVE"
sleep 4
CSVG=$(agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('CSV')||b.textContent.trim().includes('CSV')); return JSON.stringify({csvGumb:!!g, osvezeno:[...document.querySelectorAll('span')].some(e=>e.textContent.trim().startsWith('Osveženo ob'))});})()" 2>&1 | tail -1)
echo "CSV+pečat: $CSVG"
agent-browser screenshot "$SS/qa-r198-prod-meritve.png" > /dev/null 2>&1 && echo "screenshot MERITVE OK"

TEMNA=$(agent-browser eval "(()=>{const t=document.querySelector('button[aria-label*=\"tem\" i], button[aria-label*=\"Tem\"], button[aria-label*=\"temna\"]'); if(!t) return 'brez-gumba'; t.click(); return 'klik';})()" 2>&1 | tail -1)
sleep 2
BG=$(agent-browser eval "getComputedStyle(document.body).backgroundColor" 2>&1 | tail -1)
echo "TEMNA: $TEMNA → bg=$BG (pričakovano rgb(15,23,36))"
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label*=\"tem\" i], button[aria-label*=\"Tem\"], button[aria-label*=\"temna\"]'); if(t) t.click(); return 'nazaj';})()" > /dev/null 2>&1
sleep 1

LO=$(curl -sS -m 15 -X POST "$PROD/api/auth/logout" -H "Origin: $PROD" -o /dev/null -w "%{http_code}" 2>&1)
echo "LOGOUT (brez seje, pričakovano 401/200 — guard živ): $LO"

agent-browser close --all > /dev/null 2>&1
echo "=== R198 probe konec ==="
