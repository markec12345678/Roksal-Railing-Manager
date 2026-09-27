#!/bin/bash
# R227 Z3 reprobe — geselni dialog žetoni (sveža seja, diag z raw izpisi).
set -u
SS=/home/z/my-project/screenshots
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r227-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R227-server-z3.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
PRIJAVA="ni"
for i in $(seq 1 25); do
  R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then echo "  prijava OK (poskus $i)"; PRIJAVA="ok"; break; fi
  sleep 1.5
done
[ "$PRIJAVA" = "ok" ] || { echo "LOGIN FAIL"; agent-browser close --all; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
sleep 2
for i in 1 2 3 4 5; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 1
done

echo "=== Z3-re: dropdown → Zamenjaj geslo → žetoni ==="
R=$(agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; t.click(); return 'dropdown klik';})()" 2>&1 | tail -1)
echo "  trigger: $R"
sleep 2
R=$(agent-browser eval "(()=>{const it=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Zamenjaj geslo')); if(!it) return JSON.stringify({meni:[...document.querySelectorAll('[role=\"menuitem\"]')].length}); it.click(); return 'item klik';})()" 2>&1 | tail -1)
echo "  menuitem: $R"
sleep 2
R=$(agent-browser eval "(()=>{const inp=document.querySelector('#pwd-current'); if(!inp) return JSON.stringify({dialog:false, menui:[...document.querySelectorAll('[role=\"menuitem\"]')].length}); const barva=getComputedStyle(inp).borderTopColor; return JSON.stringify({dialog:true, obroba:barva, niStone:barva!=='rgb(214, 211, 209)'&&barva!=='rgb(231, 229, 228)'});})()" 2>&1 | tail -1)
echo "  dialog: $R"
R=$(agent-browser eval "(()=>{const inp=document.querySelector('#pwd-next'); if(!inp) return 'ni'; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(inp,'Abc123!d'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'vpisano';})()" 2>&1 | tail -1)
echo "  vpis: $R"
sleep 1
R=$(agent-browser eval "(()=>{const seg=[...document.querySelectorAll('span.h-1')]; if(seg.length===0) return JSON.stringify({seg:0}); const prazen=seg[seg.length-1]; const pb=getComputedStyle(prazen).backgroundColor; return JSON.stringify({seg:seg.length, prazna:pb, niStone:pb!=='rgb(231, 229, 228)'});})()" 2>&1 | tail -1)
echo "  jakost: $R"
agent-browser screenshot "$SS/qa-r227-geslo-tokeni.png" > /dev/null 2>&1
R=$(agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" 2>&1 | tail -1)
echo "  zapri: $R"
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== Z3-re KONEC ==="
