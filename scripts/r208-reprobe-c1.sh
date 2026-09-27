#!/bin/bash
# R208 reprobe C1 — Naročila sub-tab: honest empty state (0 naročil v produkciji spot).
set -u
PROD="https://roksal-railing-manager.vercel.app"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='Več'); if(v){v.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t){t.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 8
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
echo "--- Naročila sub-tab klik + stanje ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Naročila')&&b.querySelector('svg')); if(t){t.click(); return 'klik:'+t.textContent.trim();} return 'ni ga';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const prazno=[...document.querySelectorAll('p')].map(e=>e.textContent.trim()).filter(t=>t.includes('Ni naročil')); const bomAkt=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('BOM Refine'))?.className.includes('bg-roksal-navy'); const narAkt=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Naročila')&&b.querySelector('svg'))?.className.includes('bg-roksal-navy'); return JSON.stringify({url:location.pathname,praznoStanje:prazno,bomAktiven:!!bomAkt,narocilaAktiven:!!narAkt,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
echo "R208 REPROBE C1 KONEC"
