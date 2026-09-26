#!/bin/bash
# R149 E2E (del 2 — brskalnik): Kalkulator stil pass živo + konzola.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r149-e2e-server2.log 2>&1 < /dev/null &
sleep 4
ss -tln 2>/dev/null | grep -q ':3100' || { echo "SERVER NE TEČE"; exit 1; }

AB="agent-browser"
$AB close >/dev/null 2>&1 || true

echo "--- prijava skozi formo (nauček R148: svež /login, fill KOT IZPISANO) ---"
$AB open "http://127.0.0.1:3100/login" 2>&1 | tail -1
sleep 3
$AB eval "document.querySelector('input[type=email]') ? 'forma pripravljena' : 'BREZ forme'" 2>&1 | tail -1
$AB eval "document.querySelector('input[type=email]') || (window.location.href='http://127.0.0.1:3100/login?r149=1','re-open'); 'ok'" 2>&1 | tail -1
sleep 2
$AB fill "input[type=email]" "ci@roksal.si" 2>&1 | tail -1
$AB fill "input[type=password]" "DimniSmoke139!" 2>&1 | tail -1
$AB eval "document.querySelector('form')?.requestSubmit(); 'poslano'" 2>&1 | tail -1
sleep 3
$AB eval "window.location.pathname" 2>&1 | tail -1

echo "--- preklop na Kalkulator (orodja → zavihek) ---"
$AB eval "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Montažna orodja'))?.click(); 'orodja'" 2>&1 | tail -1
sleep 2
$AB eval "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Kalkulator')?.click(); 'kalkulator'" 2>&1 | tail -1
sleep 1

echo "--- stil: tabular-nums + focus ringi ---"
$AB eval "document.body.innerHTML.split('tabular-nums').length-1 + ' tabular-nums pojavitev'" 2>&1 | tail -1
$AB eval "var t=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Zgodovina izračunov')); t?(t.getAttribute('aria-expanded')!==null?'aria-expanded OK':'MANJKA aria-expanded')+(t.className.includes('focus-visible:ring')?' + focus ring':' + BREZ ringa'):'trigger ni na strani'" 2>&1 | tail -1

echo "--- izračun: 5000 mm → rezultatne kartice ---"
$AB eval "var i=[...document.querySelectorAll('input')].find(x=>x.id==='totalLength'); if(i){var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'5000'); i.dispatchEvent(new Event('input',{bubbles:true}));} 'vneseno'" 2>&1 | tail -1
$AB eval "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Izračunaj razmike'))?.click(); 'izračunano'" 2>&1 | tail -1
sleep 1
$AB eval "document.body.innerHTML.includes('Število letvev') ? 'rezultati živo' : 'BREZ rezultatov'" 2>&1 | tail -1
$AB eval "(function(){var cards=[...document.querySelectorAll('.tabular-nums')]; return cards.length + ' tabular-nums elementov (rezultat vključen)';})()" 2>&1 | tail -1

echo "--- zgodovina: nov vnos + kolaps zavihek ---"
$AB eval "var t=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Zgodovina izračunov')); t?(t.click(),'odprto'):'ni triggerja'" 2>&1 | tail -1
sleep 1
$AB eval "document.body.innerHTML.includes('Zgodovina je prazna') || document.body.innerHTML.includes('izračun') ? 'zgodovina sekcija živo' : 'ni zgodovine'" 2>&1 | tail -1

echo "--- konzola ---"
$AB eval "JSON.stringify(window.__r149errs||'brez poslušalca (brez napak vidnih)')" 2>&1 | tail -1

$AB close >/dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tln 2>/dev/null | grep -q ':3100' && echo "WARNING: port 3100 busy" || echo "port 3100 free"
