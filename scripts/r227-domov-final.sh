#!/bin/bash
# R227 Z3 final — Domov kartica 'Brez dobavitelja' precizna potrditev
# (R226 lekcija: async fetch — čakanje na aria-label, ne na body tekst; velikodušno okno).
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots

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
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1

echo "--- čakaj na kartico po aria-label prefixu 'Brez dobavitelja (' (do 60 s) ---"
NAJD="ni"
for i in $(seq 1 40); do
  R=$(agent-browser eval "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then echo "  kartica NAJDENA (poskus $i)"; NAJD="ok"; break; fi
  sleep 1.5
done
if [ "$NAJD" != "ok" ]; then
  echo "  kartica NI v DOM — diag: naslovi + alerts"
  agent-browser eval "(()=>{const hs=[...document.querySelectorAll('h1,h2,h3')].map(h=>h.textContent.trim().slice(0,40)).slice(0,10); const al=[...document.querySelectorAll('[role=\"alert\"]')].map(e=>e.textContent.trim().slice(0,60)); return JSON.stringify({naslovi:hs,alerts:al,err:window.__err??null});})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r227-domov-ni.png" > /dev/null 2>&1
  agent-browser close --all > /dev/null 2>&1
  exit 1
fi
sleep 1
echo "--- precizna potrditev lastnosti kartice ---"
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); const aria=k.getAttribute('aria-label'); const m=aria.match(/Brez dobavitelja \((\d+)\)/); const ikona=!!k.querySelector('svg.lucide-package-x'); const st=k.querySelector('span.tabular-nums'); const title=k.getAttribute('title'); return JSON.stringify({stevcev:m?m[1]:null, ikonaPackageX:ikona, amber:k.className.includes('roksal-amber'), tabularStevcev:!!st, stevecTekst:st?st.textContent.trim():null, imaTitle:!!title, opis:k.textContent.includes('Brez vpisane cene'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r227-domov-kartica.png" > /dev/null 2>&1
agent-browser close --all > /dev/null 2>&1
echo "=== KONEC Z3 final ==="
