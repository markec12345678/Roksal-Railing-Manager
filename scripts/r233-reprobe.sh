#!/bin/bash
# R233 reprobe — 2 chunk-MISSi iz prod probe = chunk ni v seji (znani vzorec).
# DOM dokazi: cv-studio (more cvstudio — bbox navy gumb ŽIVO) + catalog
# (Inox chip ŽIVO). ZERO-MUTACIJA: samo bralni pogledi.
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

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

echo "=== R1: cv-studio — bbox navy ŽIVO (more cvstudio) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'cvstudio'}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return document.body.textContent.includes('Označi 4 kotnike');})()" 24
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Označi 4 kotnike')); if(!b) return JSON.stringify({gumb:false}); return JSON.stringify({gumb:true, navy:b.className.includes('bg-roksal-navy'), stone:b.className.includes('stone-'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r233-reprobe-cvstudio.png" > /dev/null 2>&1

echo "=== R2: catalog — Inox chip ŽIVO ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'catalog'}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return document.body.textContent.includes('Inox');})()" 20
sleep 2
agent-browser eval "(()=>{const c=[...document.querySelectorAll('*')].find(el=>el.className&&typeof el.className==='string'&&el.className.includes('bg-muted')&&el.className.includes('text-roksal-ink')&&el.textContent.trim()==='Inox'); if(!c) return JSON.stringify({inoxChip:false}); return JSON.stringify({inoxChip:true, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r233-reprobe-katalog.png" > /dev/null 2>&1

agent-browser close --all > /dev/null 2>&1
echo "=== R233 reprobe KONEC ==="
