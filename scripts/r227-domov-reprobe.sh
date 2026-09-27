#!/bin/bash
# R227 Z3 reprobe — Domov kartica 'Brez dobavitelja (8)' (sveža prijava → takoj dashboard dispatch,
# R223 dokazana pot; toleranten matcher za kartico).
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots

pocakaj_na() {
  local pred="$1" maks="${2:-10}" R
  for i in $(seq 1 "$maks"); do
    R=$(agent-browser eval "$pred" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then echo "  najdeno (poskus $i)"; return 0; fi
    sleep 1.5
  done
  echo "  NI NAJDENO (zadnji: $R)"; return 1
}

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
  if [ "$R" = "true" ]; then echo "  prijava OK (poskus $i)"; break; fi
  sleep 3
done
sleep 2
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

echo "=== Z3-re: dispatch dashboard (R223 dokazana pot) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return document.body.textContent.includes('Brez dobavitelja');})()" 15
echo "--- diag: kje smo? (h1/h2 naslovi) ---"
agent-browser eval "(()=>{const hs=[...document.querySelectorAll('h1,h2')].map(h=>h.textContent.trim().slice(0,40)).slice(0,8); return JSON.stringify({naslovi:hs, err:window.__err??null});})()" 2>&1 | tail -1
echo "--- kartica (toleranten regex na body) ---"
agent-browser eval "(()=>{const m=document.body.textContent.match(/Brez dobavitelja \((\d+)\)/); const PackageX=[...document.querySelectorAll('svg')].some(s=>(s.getAttribute('class')||'').includes('lucide-package-x')||s.className.baseVal?.includes?.('package-x')); const karticaEl=[...document.querySelectorAll('button')].find(b=>/Brez dobavitelja \(\d+\)/.test(b.textContent)); return JSON.stringify({stevcev:m?m[1]:null, karticaGumb:!!karticaEl, karticaAmber:!!(karticaEl&&karticaEl.className.includes('amber')), lucidePackageX:PackageX, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r227-domov-re.png" > /dev/null 2>&1
agent-browser close --all > /dev/null 2>&1
echo "=== KONEC Z3-re ==="
