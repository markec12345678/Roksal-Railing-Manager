#!/bin/bash
# R202 produkcija QA — R201 fingerprinti (deploy VERJETNO ŠE V LETU — žig ob startu R200)
#  (a) žig + javni byte: 'Ni projektov' v lazy Meritve chunku (R201 fp)
#  (b) spot (MONTER, 0 projektov): Meritve → iskren stolpec ŽIVO, 'Dodaj meritev' NE obstaja več
#  (c) regresije: zvonček ščit, pečati Material/Zaloga, offline pas 1→0, temna, __err null
#  🔴 Lekcija R201: onboarding NI [role=dialog] → zapri prek TOČNO aria-label; Radix Select = [role=combobox]
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "--- 1) JAVNO: žig + /login noga ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const n=[...document.querySelectorAll('p,span,div,small')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Zgrajeno ')); return JSON.stringify({zgrajeno:n||null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 2) JAVNI BYTE: 'Ni projektov' v lazy chunkih (R201 fp) ---"
HTML=$(curl -s -m 20 "$PROD/login")
CHUNKS=$(echo "$HTML" | grep -oE '/_next/static/chunks/[a-f0-9]{16}\.js' | sort -u)
NEEDLE_HIT=0; TOTAL=0
for c in $CHUNKS; do
  TOTAL=$((TOTAL+1))
  if curl -s -m 15 "$PROD$c" | grep -q 'Ni projektov'; then NEEDLE_HIT=$((NEEDLE_HIT+1)); fi
done
echo "login chunki: $TOTAL, 'Ni projektov' zadetkov: $NEEDLE_HIT (Meritve je LAZY — 0 na /login je pričakovano; pregled pregleda tudi / strani prek seje spodaj)"

echo "--- 3) MONTER prijava (spot) ---"
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 3b) R201 fp: zapri onboarding (točen aria-label) → Meritve ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"meritve-brez-projektov\"]'); const niP=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni projektov').length; const ol=document.querySelector('ol[aria-label=\"Kaj naprej\"]'); const koraki=ol?ol.querySelectorAll('li').length:null; const dodaj=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Dodaj meritev').length; const note=[...document.querySelectorAll('[role=note]')].map(e=>e.textContent.trim()).find(t=>t.includes('Predloge so na voljo')); const combobox=[...document.querySelectorAll('[role=combobox]')].length; return JSON.stringify({blok:!!blok,niProjektov:niP,kajNaprej:!!ol,koraki,dodajMeritev:dodaj,predlogeNote:note||null,comboboxCount:combobox,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r202-prod-meritve.png" > /dev/null 2>&1 && echo "screenshot MERITVE PROD OK"

echo "--- 4) regresije: Material + Zaloga pečati ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); return JSON.stringify({materialPecat:p[0]||null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); return JSON.stringify({zalogaPecat:p[0]||null});})()" 2>&1 | tail -1

echo "--- 5) zvonček ščit regresija ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return !!b;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const sciti=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&/Nova prijava|neuspešn|aktiviran|geslo je bilo spremenjeno/.test(e.textContent.trim())&&e.textContent.trim().length<90).length; return JSON.stringify({scitVrstic:sciti});})()" 2>&1 | tail -1
agent-browser eval "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); 'esc'" > /dev/null 2>&1
sleep 1

echo "--- 6) offline pas regresija (VizTab) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "window.dispatchEvent(new Event('offline')); 'off'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; return JSON.stringify({pasViden:pas>0});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('online')); 'on'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const n=[...document.querySelectorAll('*')].filter(e=>e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')&&e.childElementCount===0).length; return JSON.stringify({pasPoOnline:n});})()" 2>&1 | tail -1

echo "--- 7) temna + odjava ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r202-prod-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
agent-browser click 'button[aria-label="Odjava"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R202 PROD PROBE KONEC"
