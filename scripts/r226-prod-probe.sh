#!/bin/bash
# R226 prod probe — R225 ŽIVO potrditev (žig mora biti > 18:56:19 lokalni žig R225):
# (1) health žig + db ok; (2) Zaloga vrstice z R225 badgeom 'Brez dobavitelja'
# (prod fingerprint: brez = 8 → VSE vrstice badge); (3) vodja pregled
# trdeKlas:0 (DOM scan numeričnih barvnih klas); (4) Domov R223 kartica regresija.
# ZERO-MUTACIJA: samo odjemalski filtri pogleda, nič ne piše v DB.
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "=== health žig (mora biti > 18:56:19 = R225) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

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

echo "=== R223 regresija: Domov kartica 'Brez dobavitelja (8)' ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard'}})); return 'domov dispatch';})()" > /dev/null 2>&1
KARTICA="ni"
for i in $(seq 1 12); do
  R=$(agent-browser eval "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then KARTICA="ok"; echo "  kartica najdena (poskus $i)"; break; fi
  sleep 3
done
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({domovKartica:false, err:window.__err??null}); return JSON.stringify({domovKartica:true, aria:k.getAttribute('aria-label'), amber:k.className.includes('roksal-amber'), rdecaSoboj:[...document.querySelectorAll('div')].some(d=>d.textContent.trim()==='Nizka zaloga materiala'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== R225: Zaloga vrstice z badgeom 'Brez dobavitelja' (fingerprint brez = 8) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory'}})); return 'zaloga dispatch';})()" > /dev/null 2>&1
VRSTICE="ni"
for i in $(seq 1 15); do
  R=$(agent-browser eval "(()=>{const bad=[...document.querySelectorAll('span')].filter(s=>s.textContent.trim()==='Brez dobavitelja'&&s.className.includes('roksal-amber')); return bad.length>0;})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then VRSTICE="ok"; echo "  badge najden (poskus $i)"; break; fi
  sleep 3
done
agent-browser eval "(()=>{const bad=[...document.querySelectorAll('span')].filter(s=>s.textContent.trim()==='Brez dobavitelja'&&s.className.includes('roksal-amber')); const vrstice=bad.length>0?bad[0].closest('div.rounded-xl,div[class*=rounded]'):null; return JSON.stringify({steviloBadgeov:bad.length, badgeDruzina:bad.length>0?bad[0].className.slice(0,80):null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r226-prod-zaloga-badge.png" > /dev/null 2>&1

echo "=== R225: vodja pregled trdeKlas:0 (DOM scan numeričnih barvnih klas) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const vzorec=/(bg|text|border)-(red|blue|green|amber|slate|gray|zinc|neutral|stone|yellow|orange|purple|violet|indigo|emerald|teal|cyan|sky|rose|fuchsia|pink|lime|wilderness)-(50|100|200|300|400|500|600|700|800|900)([\\/\\s\"']|$)/; const stevilke=[...document.querySelectorAll('*')].filter(e=>e.className&&typeof e.className==='string'&&vzorec.test(e.className)); const danes=[...document.querySelectorAll('*')].some(e=>e.className&&typeof e.className==='string'&&e.className.includes('roksal-navy')&&e.textContent.trim()!==''); const zapadlo=[...document.querySelectorAll('*')].some(e=>e.className&&typeof e.className==='string'&&e.className.includes('roksal-red')&&/[Zz]apadl/.test(e.parentElement?e.parentElement.textContent:'')); return JSON.stringify({trdeKlas:stevilke.length, prviTrije:stevilke.slice(0,3).map(e=>e.className.slice(0,60)), navyToken:danes, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r226-prod-vodja.png" > /dev/null 2>&1

echo "=== temna tema + __err (zadnje zdravje) ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return document.documentElement.className;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r226-prod-temna.png" > /dev/null 2>&1

agent-browser close --all > /dev/null 2>&1
echo "=== R226 PROD PROBE KONEC ==="
