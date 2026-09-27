#!/bin/bash
# R198 reprobe — CSV gumb na Meritve (pravilen navigacijski vzorec: 'Več' → Ekipa? NE:
# R190 reprobe ugotovil: aria-label startsWith 'Montažna orodja' → textContent 'Meritve')
set -u
PROD="https://roksal-railing-manager.vercel.app"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12

echo "=== diag: nav struktura ==="
NAV=$(agent-browser eval "(()=>{const n=[...document.querySelectorAll('a,button')].filter(x=>(x.getAttribute('aria-label')||'').startsWith('Montažna orodja')).map(x=>({tag:x.tagName, aria:x.getAttribute('aria-label'), txt:x.textContent.trim().slice(0,30)})); return JSON.stringify(n.slice(0,3));})()" 2>&1 | tail -1)
echo "MONTAZNA-ORODJA: $NAV"

echo "=== klik Meritve prek Montažna orodja ==="
K=$(agent-browser eval "(()=>{const n=[...document.querySelectorAll('a,button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Montažna orodja')&&x.textContent.trim().startsWith('Meritve')); if(!n) return 'brez'; n.click(); return 'klik';})()" 2>&1 | tail -1)
echo "KLIK: $K"
sleep 5
CSVG=$(agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('CSV')||b.textContent.trim().includes('CSV')); const osv=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); return JSON.stringify({csvGumb:!!g, csvLabel:g?(g.getAttribute('aria-label')||g.textContent.trim()).slice(0,40):null, pecat:osv[0]||null});})()" 2>&1 | tail -1)
echo "CSV+pečat: $CSVG"
agent-browser screenshot "/home/z/my-project/screenshots/qa-r198-prod-meritve2.png" > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1
echo "=== reprobe konec ==="
