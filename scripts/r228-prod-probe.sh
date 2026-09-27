#!/bin/bash
# R228 prod probe — recheck R227 ŽIVO (deseti signalec + geselne površine):
#  Z1 Osnutek dialog: vrstica(e) z badgeom 'Brez dobavitelja' (prod fingerprint:
#     brez = 8 artiklov, 'pod' = 1 → dialog 1 vrstica, 1 badge — VSI amber)
#  Z2 geselni dialog (Radix pointer sekvence r199/r200): obroba ≠ stone,
#     label = muted-foreground (žetoni ŽIVO)
#  Z3 Domov regresija: kartica aria 'Brez dobavitelja (8)' + PackageX + amber
#  Z4 temna tema + __err null
# ZERO-MUTACIJA: samo bralni pogledi/dialogi — nič ne piše v DB.
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

echo "=== Z1: Zaloga → Osnutek dialog — badge per vrstica (R227 ŽIVO?) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 12
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]'); if(!b) return 'ni'; b.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{const d=[...document.querySelectorAll('[role=\"dialog\"]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); return !!d;})()" 10
sleep 1
agent-browser eval "(()=>{const d=[...document.querySelectorAll('[role=\"dialog\"]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); if(!d) return JSON.stringify({dialog:false}); const badge=[...d.querySelectorAll('span')].filter(s=>s.textContent.trim()==='Brez dobavitelja'&&s.className.includes('roksal-amber')); const vrstice=[...d.querySelectorAll('div.flex.items-center.justify-between.gap-2')]; return JSON.stringify({dialog:true, vrstic:vrstice.length, badgeov:badge.length, vseBadge:badge.length===vrstice.length&&vrstice.length>0, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r228-prod-osnutek.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "=== Z2: geselni dialog — žetoni ŽIVO? (Radix pointer sekvence) ==="
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
sleep 1
pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Zamenjaj geslo'));})()" 8
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Zamenjaj geslo')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return !!document.querySelector('#pwd-current');})()" 8
sleep 1
agent-browser eval "(()=>{const inp=document.querySelector('#pwd-current'); if(!inp) return JSON.stringify({dialog:false}); const barva=getComputedStyle(inp).borderTopColor; const label=document.querySelector('label[for=\"pwd-current\"]'); const lbarva=label?getComputedStyle(label).color:null; return JSON.stringify({dialog:true, obroba:barva, obrobaNiStone:barva!=='rgb(214, 211, 209)'&&barva!=='rgb(231, 229, 228)', labelBarva:lbarva, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r228-prod-geslo.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
sleep 1

echo "=== Z3: Domov regresija — kartica 'Brez dobavitelja (8)' ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({kartica:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const ikona=!!k.querySelector('svg.lucide-package-x'); return JSON.stringify({kartica:true, stevec:m?m[1]:null, ikonaPackageX:ikona, amber:k.className.includes('roksal-amber'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r228-prod-domov.png" > /dev/null 2>&1

echo "=== Z4: temna tema + __err ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r228-prod-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

agent-browser close --all > /dev/null 2>&1
echo "=== R228 prod probe KONEC ==="
