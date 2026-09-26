#!/bin/bash
# R150 E2E živo na lokalnem buildu — kalkulator inženirska ovojnica (DEL 1).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r150-e2e-server.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/api/auth/demo

AB="agent-browser"
$AB close --all >/dev/null 2>&1
sleep 1

echo "=== [1] Prijava (forma) ==="
$AB open "http://127.0.0.1:3100/login" >/dev/null 2>&1
sleep 3
if ! $AB is visible "input[type=email]" >/dev/null 2>&1; then
  echo "  (ponovni odprtji poskus)"
  $AB open "http://127.0.0.1:3100/login" >/dev/null 2>&1
  sleep 3
fi
$AB fill "input[type=email]" "ci@roksal.si" >/dev/null
$AB fill "input[type=password]" "DimniSmoke139!" >/dev/null
$AB click "button[type=submit]" >/dev/null
sleep 4
$AB get url

echo "=== [2] Odpri Montažna orodja ==="
$AB eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Montažna orodja/.test(x.textContent||x.getAttribute('aria-label')||'')); if(b){b.click(); return 'tools-open'} return 'TOOLS NOT FOUND'})()"
sleep 3
$AB eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Kalkulator'); if(b){b.click(); return 'kalk-open'} return 'KALK NOT FOUND'})()"
sleep 3

echo "=== [3] Railing: veljaven izračun → pričakuj prstni odtis ==="
$AB eval "(()=>{const btn=[...document.querySelectorAll('button')].find(x=>/Izračunaj razmike/.test(x.textContent||'')); if(btn){btn.click(); return 'clicked'} return 'BTN NOT FOUND'})()"
sleep 2
$AB eval "(()=>{const s=document.body.innerText; const m=s.match(/Formula rail-v1 · vhod [0-9a-f]{8}/); return m ? 'FINGERPRINT_OK: '+m[0] : 'FINGERPRINT_MISSING'})()"

echo "=== [4] Railing: dolžina 0.02 m (20 mm < 100 mm min) → fail-closed napaka ==="
$AB eval "(()=>{const inp=[...document.querySelectorAll('input')].filter(i=>i.type==='number'||i.inputMode==='decimal'); const len=inp.find(i=>parseFloat(i.value)>=1); if(!len) return 'INPUT NOT FOUND: '+JSON.stringify(inp.map(i=>i.value)); const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(len,'0.02'); len.dispatchEvent(new Event('input',{bubbles:true})); len.dispatchEvent(new Event('change',{bubbles:true})); return 'set to 0.02: '+len.value})()"
$AB eval "(()=>{const btn=[...document.querySelectorAll('button')].find(x=>/Izračunaj razmike/.test(x.textContent||'')); if(btn){btn.click(); return 'clicked'} return 'BTN NOT FOUND'})()"
sleep 2
$AB eval "(()=>{const s=document.body.innerText; return s.includes('Izračun zavrnjen') ? 'FAIL_CLOSED_OK: '+s.match(/Izračun zavrnjen[^\n]*/)[0].slice(0,80) : 'FAIL_CLOSED_MISSING'})()"
$AB eval "(()=>{const s=document.body.innerText; const err=s.match(/izven območja umerjenosti[^\n]*/); return err ? 'CAL_ERROR: '+err[0].slice(0,100) : 'CAL_ERROR_TEXT_MISSING'})()"
$AB eval "(()=>{const s=document.body.innerText; const fp=s.match(/Formula rail-v1 · vhod [0-9a-f]{8}/); return fp ? 'OLD FINGERPRINT STILL VISIBLE (napaka!)' : 'FINGERPRINT_CLEARED_OK (ni rezultata)'})()"

echo "=== [5] Konzola ==="
$AB console 2>&1 | tail -5
echo "e2e-part1-done"
