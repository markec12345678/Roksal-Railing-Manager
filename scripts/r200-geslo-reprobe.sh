#!/bin/bash
# R200 reprobe — geslo dialog živa lestvica ŽIVO (R199 F2 fingerprint)
# Lekcija R195: Radix DropdownMenu potrebuje pointerdown sekvenco — programski
# .click() NE odpre. Zato: pointerdown+pointerup+click v enem eval, prebrati
# menuiteme v ISTI seji, dialog odpreti prek menuitem click (Radix select na pointerup).
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
agent-browser eval "JSON.stringify({url:location.pathname,err:window.__err??null})" 2>&1 | tail -1

echo "--- 1) dropdown odprtje: pointerdown sekvencA (lekcija R195) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Odjava'); if(!t) return 'ni gumba'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',opt)); t.dispatchEvent(new PointerEvent('pointerup',opt)); t.dispatchEvent(new MouseEvent('click',opt)); return 'poslano';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=menuitem]')].map(x=>x.textContent.trim()); return JSON.stringify({menuitemi:mi});})()" 2>&1 | tail -1

echo "--- 2) 'Zamenjaj geslo' menuitem (pointer sekvencA) ---"
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=menuitem]')].find(x=>x.textContent.trim()==='Zamenjaj geslo'); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const d=document.querySelector('#pwd-next'); return JSON.stringify({dialogOdpri:!!d,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 3) lestvica: kratko <8 → skrita ---"
agent-browser eval "(()=>{const el=document.querySelector('#pwd-next'); if(!el) return 'ni inputa'; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,'kratko'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const live=document.querySelector('[role=dialog] [aria-live=polite]'); return JSON.stringify({lestvicaVidna:!!live});})()" 2>&1 | tail -1

echo "--- 4) slabogeslo (1 razred) → 'Šibko' + rdeča ---"
agent-browser eval "(()=>{const el=document.querySelector('#pwd-next'); const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,'slabogeslo'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const live=document.querySelector('[role=dialog] [aria-live=polite]'); if(!live) return JSON.stringify({oznaka:null}); const barva=getComputedStyle(live.querySelector('span:last-child')).color; return JSON.stringify({oznaka:live.textContent.trim(),barvaOznake:barva});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r200-geslo-sibko.png" > /dev/null 2>&1 && echo "screenshot SIBKO OK"

echo "--- 5) MocnoGesloZaQA2026 (3 razredi + ≥14) → 'Močno' + zelena ---"
agent-browser eval "(()=>{const el=document.querySelector('#pwd-next'); const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,'MocnoGesloZaQA2026'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const live=document.querySelector('[role=dialog] [aria-live=polite]'); if(!live) return JSON.stringify({oznaka:null}); const barva=getComputedStyle(live.querySelector('span:last-child')).color; return JSON.stringify({oznaka:live.textContent.trim(),barvaOznake:barva});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r200-geslo-mocno.png" > /dev/null 2>&1 && echo "screenshot MOCNO OK"

echo "--- 6) Prekliči → zapri, brez pošiljanja (spot geslo nespremenjeno) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b) b.click(); return !!b;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "JSON.stringify({dialogZaprt:!document.querySelector('#pwd-next'),url:location.pathname,err:window.__err??null})" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
echo "R200 REPROBE KONEC"
