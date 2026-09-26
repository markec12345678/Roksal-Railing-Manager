#!/bin/bash
# R161 E2E (lokalni build): izvoz sledenja ponudb CSV + fail-verbose kartica.
# Nauček R157–R160: celoten tok v ENEM klicu (strežnik ne preživi med klici).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r161-e2e-server.log 2>&1 < /dev/null &
sleep 4

# health gate
HEALTH=$(curl -s -m 5 http://127.0.0.1:3100/api/auth/demo || true)
echo "health=$HEALTH"

agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 4

# prijava pristane na viz root — preklopi v "Montažna orodja" (Field Manager)
echo "--- E2E 0: prehod na Montažna orodja ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>/Montažna orodja/.test(b.textContent||'')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- E2E 1: Več → CRM stranke tab ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('CRM stranke')&&x.closest('[data-slot=\"sheet-content\"], [role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 3

echo "--- E2E 2: kartica Ponudbe — sledenje + Izvozi CSV gumb ---"
agent-browser eval "(()=>{const title=[...document.querySelectorAll('*')].find(x=>x.textContent==='Ponudbe — sledenje'); const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')&&x.getAttribute('aria-label').startsWith('Izvozi prikazani seznam ponudb')); return JSON.stringify({cardVisible: !!title, buttonFound: !!b, aria: b?.getAttribute('aria-label'), title: !!b?.getAttribute('title'), ring: /focus-visible:ring/.test(b?.className||''), disabled: b?.disabled});})()" 2>&1 | tail -1

echo "--- E2E 3: klik na izvoz → toast ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Izvozi prikazani seznam ponudb')); if(b && !b.disabled) b.click(); return JSON.stringify({clicked: !!b, wasDisabled: b?.disabled});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toast=document.querySelector('[data-sonner-toast]'); return JSON.stringify({toastText: toast?toast.textContent.slice(0,110):null});})()" 2>&1 | tail -1

echo "--- E2E 4: konzola čista ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 free"; fi
