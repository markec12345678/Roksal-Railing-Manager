#!/bin/bash
# R197 reprobe — CSV gumb + offline pas (pravilna navigacija: 'Montažna orodja' meni)
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
# 'Montažna orodja' meni odpri (R190 vzorec: pointer sekvence)
agent-browser eval "(()=>{const n=[...document.querySelectorAll('button,a')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(!n) return 'brez-orodij'; const r=n.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; n.dispatchEvent(new PointerEvent('pointerdown',o)); n.dispatchEvent(new PointerEvent('pointerup',o)); n.dispatchEvent(new MouseEvent('click',o)); return 'meni';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const m=[...document.querySelectorAll('a,[role=menuitem]')].find(x=>x.textContent.trim().startsWith('Meritve')); if(!m) return 'brez-meritev'; const r=m.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; m.dispatchEvent(new PointerEvent('pointerdown',o)); m.dispatchEvent(new PointerEvent('pointerup',o)); m.dispatchEvent(new MouseEvent('click',o)); return 'klik';})()" 2>&1 | tail -1
sleep 5
CSV=$(agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('CSV')||b.textContent.trim().includes('CSV')); return JSON.stringify({url:location.pathname, csvGumb:!!g, osvezeno:[...document.querySelectorAll('span')].some(e=>e.textContent.trim().startsWith('Osveženo ob'))});})()" 2>&1 | tail -1)
echo "CSV: $CSV"
# offline pas: VizTab (pregled) → goOffline prek pwa-status komponente ni dostopen programsko;
# namesto tega preveri pas v DOM po navigaciji na pregled (online stanje = pas skrit je PRAVILNO)
VIZ=$(agent-browser eval "(()=>{const n=[...document.querySelectorAll('a,[role=menuitem]')].find(x=>x.textContent.trim().startsWith('Pregled')); if(!n){return 'brez';} n.click(); return 'klik';})()" 2>&1 | tail -1)
sleep 4
PAS=$(agent-browser eval "(()=>{const vidni=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; const vTekstu=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')).length; return JSON.stringify({url:location.pathname, pasVidenOnline:vidni, vTekstu:vTekstu});})()" 2>&1 | tail -1)
echo "OFFLINE PAS (online = skrit je prav): $PAS"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return r.status;})()" > /dev/null 2>&1
agent-browser close --all > /dev/null 2>&1 || true
echo "=== reprobe konec ==="
