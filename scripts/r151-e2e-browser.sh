#!/bin/bash
# R151 E2E brskalnik — iskreni dokumenti (poskus 2: bottom-nav → Več → Dokumenti).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r151-e2e-browser.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/api/auth/demo

AB="agent-browser"
$AB close --all >/dev/null 2>&1
sleep 1

$AB open "http://127.0.0.1:3100/login" >/dev/null 2>&1
sleep 3
if ! $AB is visible "input[type=email]" >/dev/null 2>&1; then
  $AB open "http://127.0.0.1:3100/login" >/dev/null 2>&1
  sleep 3
fi
$AB fill "input[type=email]" "ci@roksal.si" >/dev/null
$AB fill "input[type=password]" "DimniSmoke139!" >/dev/null
$AB click "button[type=submit]" >/dev/null
sleep 4

# Nauček R149: prva prijava lahko obsta na javni strani — ponovi z svežim /login.
IN_APP=$($AB eval "(()=>document.body.innerText.includes('Dobro jutro')||document.body.innerText.includes('Odjava')||!!document.querySelector('input[placeholder*=isk]')?'yes':'no')()" 2>/dev/null | tail -1 | tr -d '"')
if [ "$IN_APP" != "yes" ]; then
  echo "  (ponovni poskus prijave)"
  $AB open "http://127.0.0.1:3100/login" >/dev/null 2>&1
  sleep 3
  $AB fill "input[type=email]" "ci@roksal.si" >/dev/null
  $AB fill "input[type=password]" "DimniSmoke139!" >/dev/null
  $AB click "button[type=submit]" >/dev/null
  sleep 4
fi
$AB get url
$AB eval "(()=>{const s=document.body.innerText.slice(0,300); return 'TEXT: '+s.replace(/\n/g,' | ').slice(0,200)})()"

echo "=== [1] Bottom-nav: Več (skrolaj na dno + klik) ==="
$AB eval "window.scrollTo(0, document.body.scrollHeight); 'scrolled'" >/dev/null
sleep 1
$AB eval "(()=>{const b=[...document.querySelectorAll('nav button, [class*=bottom] button, button')].filter(x=>(x.getAttribute('aria-label')||'')==='Več' || (x.textContent||'').trim()==='Več'); if(b.length){b[b.length-1].click(); return 'več-clicked'} return 'VEČ NOT FOUND'})()"
sleep 2

echo "=== [2] Sheet: Dokumenti ==="
$AB eval "(()=>{const b=[...document.querySelectorAll('button')].filter(x=>/Dokumenti/.test((x.textContent||'').trim())); if(b.length){b[0].click(); return 'docs-clicked'} return 'DOCS NOT FOUND: '+JSON.stringify([...document.querySelectorAll('button')].map(x=>(x.textContent||'').trim()).filter(t=>t&&t.length<20).slice(0,40))})()"
sleep 3

echo "=== [3] Generiranje dokumenta (Tehnični list) ==="
$AB eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Tehnični list/.test(x.textContent||'')); if(b){b.click(); return 'clicked'} return 'BTN NOT FOUND'})()"
sleep 3
$AB eval "(()=>{const s=document.body.innerText; const h=s.match(/odtis [0-9a-f]{8}/); return JSON.stringify({odtis: h ? h[0] : null, verziaBadge: /v1/.test(s)})})()"

echo "=== [4] Download gumb (pravi PDF) ==="
$AB eval "(()=>{const dl=[...document.querySelectorAll('button[aria-label]')].filter(b=>/Prenesi PDF/.test(b.getAttribute('aria-label')||'')); return JSON.stringify({count: dl.length, ariaLabel: dl[0]?.getAttribute('aria-label')?.slice(0,60) ?? null})})()"

echo "=== [5] NI delete X gumbov ==="
$AB eval "(()=>{const rows=document.querySelectorAll('.slide-in-right'); let del=0; rows.forEach(r=>{r.querySelectorAll('button').forEach(b=>{const svg=b.querySelector('svg'); if(svg && (svg.classList.contains('lucide-x'))) del++})}); return JSON.stringify({rows: rows.length, deleteX: del})})()"

echo "=== [6] Konzola ==="
$AB console 2>&1 | tail -5
echo "e2e-browser2-done"
