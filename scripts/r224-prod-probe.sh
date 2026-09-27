#!/bin/bash
# R224 prod probe — R223 ŽIVO potrditev (žig 17:32:47 > 17:15:37 lokalni):
# Domov kartica 'Brez dobavitelja (8)' + rdeča 'Nizka zaloga materiala' SOBOJ
# + R224 vodja kartica ŠE NE SME biti v prodi (runda ni pushana).
# ZERO-MUTACIJA: samo odjemalski filtri pogleda, nič ne piše v DB.
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

echo "=== prijava (marker: 'Odpri iskalnik') ==="
PRIJAVA="ni"
for i in $(seq 1 20); do
  R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then echo "  prijava OK (poskus $i)"; PRIJAVA="ok"; break; fi
  sleep 3
done
if [ "$PRIJAVA" != "ok" ]; then echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; fi
sleep 2
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

echo "=== R223: Domov kartica 'Brez dobavitelja' (žig 17:32:47 = R223) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard'}})); return 'domov dispatch';})()" > /dev/null 2>&1
KARTICA="ni"
for i in $(seq 1 12); do
  R=$(agent-browser eval "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then KARTICA="ok"; echo "  kartica najdena (poskus $i)"; break; fi
  sleep 3
done
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({kartica:false, err:window.__err??null}); const pill=k.querySelector('span.tabular-nums'); const rdeca=[...document.querySelectorAll('div')].some(d=>d.textContent.trim()==='Nizka zaloga materiala'); return JSON.stringify({kartica:true, aria:k.getAttribute('aria-label'), stevec:pill?pill.textContent.trim():null, amber:k.className.includes('roksal-amber'), packageX:!!k.querySelector('svg'), rdecaSoboj:rdeca, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r224-prod-r223-kartica.png" > /dev/null 2>&1

echo "=== R224: vodja kartica ŠE NE SME biti v prodi (runda ni pushana) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const stara=[...document.querySelectorAll('div')].some(d=>d.textContent.trim().endsWith('materialov z nizko zalogo')&&d.closest('.rounded-xl')&&d.closest('.rounded-xl').className.includes('amber-')); const nova=[...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja (')&&(b.getAttribute('aria-label')||'').includes('odpre Zalogo s filtrom')); const rdeca=[...document.querySelectorAll('div')].some(d=>d.textContent.trim().endsWith('materialov z nizko zalogo')&&d.closest('.rounded-xl')&&d.closest('.rounded-xl').className.includes('roksal-red')); return JSON.stringify({staraAmberHardcoded:stara, novaR224Kartica:nova, harmoniziranaRdeca:rdeca, err:window.__err??null});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1
echo "=== R224 PROD PROBE KONEC ==="
