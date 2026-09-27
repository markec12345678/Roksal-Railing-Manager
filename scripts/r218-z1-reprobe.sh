#!/bin/bash
# R218 Z1 reprobe — R217 F1 iskalni Material zadetek badge (pravilno tipkanje:
# native value setter + input event; fill NE deluje na cmdk-input).
# Dokaz: 'Inox' → Material zadetek M12 A4 z badgeom 'Nizka zaloga'
#        (roksal-red) + podnapis → klik → Zaloga AKTIVEN + dialog ISTI artikel.
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

agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const inp=document.querySelector('[cmdk-input]'); if(!inp) return 'ni inputa'; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,'Inox'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno Inox';})()" 2>&1 | tail -1
sleep 5

echo "=== dokaz: vsi vidni cmdk-item z besedilom + badge/aria-label ==="
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')].map(el=>({v:(el.getAttribute('value')||'').slice(0,40), t:el.textContent.trim().slice(0,100), al:(el.getAttribute('aria-label')||''), red:!!el.querySelector('.text-roksal-red, [class*=\"roksal-red\"]')})); return JSON.stringify(items);})()" 2>&1 | tail -1

echo "=== klik Material iskalni zadetek (aria-label 'nizka zaloga, odpre naročilni tok' ali value material) ==="
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')]; const hit=items.find(el=>(el.getAttribute('aria-label')||'').includes('odpre naročilni tok')&&!el.textContent.includes('Naroči material')); if(!hit) return 'ISCALNI ZADETEK NI VIDEN'; const al=hit.getAttribute('aria-label'); const red=!!hit.querySelector('[class*=\"roksal-red\"]'); const tn=hit.textContent.includes('Nizka zaloga'); hit.click(); return 'KLIK | aria-label: '+al+' | badge-tekst:'+tn+' | roksal-red:'+red;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const act=document.querySelector('nav [aria-current=\"page\"]'); const dlg=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"]')].map(d=>d.querySelector('[data-slot=\"dialog-title\"]')?.textContent||d.textContent.slice(0,60)); const nav=act?act.textContent.trim():'—'; return JSON.stringify({aktiven:nav, dialog:dlg});})()" 2>&1 | tail -1
agent-browser screenshot /tmp/r218-z1-reprobe.png > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser press Escape > /dev/null 2>&1
agent-browser close --all > /dev/null 2>&1
echo "=== KONEC r218-z1-reprobe ==="
