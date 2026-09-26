#!/bin/bash
# R150 E2E živo — DEL 2 (popravljen): veter fail-closed + zgodovina z odtisom.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r150-e2e-server2.log 2>&1 < /dev/null &
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

$AB eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Montažna orodja/.test(x.textContent||x.getAttribute('aria-label')||'')); if(b){b.click(); return 'tools-open'} return 'TOOLS NOT FOUND'})()" >/dev/null
sleep 3
$AB eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Kalkulator'); if(b){b.click(); return 'kalk-open'} return 'NOT FOUND'})()" >/dev/null
sleep 3

echo "=== [1] Veter: višina 0 m → fail-closed (prej tiho LOW tveganje!) ==="
$AB eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Veter' || /Vetrna obremenitev/.test(x.textContent||'')); if(b){b.click(); return 'wind-mode'} return 'WIND MODE NOT FOUND'})()"
sleep 1
$AB eval "(()=>{const inp=[...document.querySelectorAll('input')].filter(i=>i.type==='number'||i.inputMode==='decimal'); if(!inp.length) return 'NO INPUTS'; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(inp[0],'0'); inp[0].dispatchEvent(new Event('input',{bubbles:true})); inp[0].dispatchEvent(new Event('change',{bubbles:true})); return 'first numeric input set to 0'})()"
$AB eval "(()=>{const btn=[...document.querySelectorAll('button')].find(x=>/Izračunaj vetrno obremenitev/.test(x.textContent||'')); if(btn){btn.click(); return 'clicked'} return 'BTN NOT FOUND'})()"
sleep 2
$AB eval "(()=>{const s=document.body.innerText; return s.includes('Izračun zavrnjen') && s.includes('Višina nad tlemi') ? 'WIND_FAIL_CLOSED_OK' : 'WIND_FAIL_CLOSED_MISSING'})()"

echo "=== [2] Railing: veljaven izračun (zgodovinski vnos z odtisom) ==="
$AB eval "(()=>{const tabs=[...document.querySelectorAll('button')].filter(x=>/razmik/i.test(x.textContent||'')&&x.textContent.trim().length<30); const t=tabs.find(x=>/Razmiki letev/i.test(x.textContent||'')); if(t){t.click(); return 'railing-mode'} return 'RAILING TAB NOT FOUND'})()"
sleep 1
$AB eval "(()=>{const btn=[...document.querySelectorAll('button')].find(x=>/Izračunaj razmike/.test(x.textContent||'')); if(btn){btn.click(); return 'clicked'} return 'BTN NOT FOUND'})()"
sleep 2
$AB eval "(()=>{const s=document.body.innerText; const m=s.match(/Formula rail-v1 · vhod [0-9a-f]{8}/); return m ? 'FINGERPRINT_OK: '+m[0] : 'FINGERPRINT_MISSING'})()"

echo "=== [3] Zgodovina: odpri collapsible → badge z odtisom ==="
$AB eval "(()=>{const trig=[...document.querySelectorAll('button[aria-expanded]')].find(x=>/zgodovin/i.test(x.textContent||x.getAttribute('aria-label')||'')); if(trig){trig.click(); return 'history-open'} return 'HISTORY TRIGGER NOT FOUND'})()"
sleep 2
$AB eval "(()=>{const s=document.body.innerText; const m=s.match(/rail-v1·[0-9a-f]{8}/); return m ? 'HISTORY_BADGE_OK: '+m[0] : 'HISTORY_BADGE_MISSING'})()"

echo "=== [4] Konzola ==="
$AB console 2>&1 | tail -5
echo "e2e-part2-done"
