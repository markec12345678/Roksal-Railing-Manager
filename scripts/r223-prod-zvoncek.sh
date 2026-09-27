#!/bin/bash
# R223 prod mini-probe: zvonček 'brez' vrstica z amber badgeom = R222 definitivno
# ŽIVO (R222 je edini vir teh vrstic). Če prod brez števec = 0 → vrstice izkreno
# odsotne (neodločljivo — ostane žig timeline). ZERO-MUTACIJA.
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
for i in $(seq 1 20); do
  R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 2>&1 | tail -1)
  [ "$R" = "true" ] && { echo "prijava OK (poskus $i)"; break; }
  sleep 3
done
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

echo "=== ZVONEČEK: brez vrstice z badgeom (R222 edini vir) ==="
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'ni zvončka'; b.click(); return 'zvonček odprt';})()" 2>&1 | tail -1
for i in $(seq 1 10); do
  R=$(agent-browser eval "(()=>{return !!document.querySelector('li button');})()" 2>&1 | tail -1)
  [ "$R" = "true" ] && { echo "  vsebina naložena (poskus $i)"; break; }
  sleep 1.5
done
sleep 2
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('li button')].filter(x=>x.textContent.includes('Brez vpisane cene pri katerem koli dobavitelju')); const zBadge=vr.filter(x=>x.textContent.includes('Brez dobavitelja')); const stock=[...document.querySelectorAll('li button')].filter(x=>x.textContent.includes('Naroči material')); const praznoHonesto=[...document.querySelectorAll('div,p')].some(e=>e.textContent.includes('Ni nizke zaloge, ni artiklov brez dobavitelja')); return JSON.stringify({brezVrstic:vr.length, zR222Badgeom:zBadge.length, stockVrstic:stock.length, iskrenoPrazno:praznoHonesto, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r223-prod-zvoncek.png > /dev/null 2>&1
agent-browser close --all > /dev/null 2>&1
echo "=== KONEC mini-probe ==="
