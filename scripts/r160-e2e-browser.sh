#!/bin/bash
# R160 E2E (lokalni build): izvoz ekipe CSV + vremenska kartica fail-verbose.
# Nauček R157–R159: celoten tok v ENEM klicu (strežnik ne preživi med klici).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r160-e2e-server.log 2>&1 < /dev/null &
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

echo "--- E2E 1: FAB a11y (focus/aria) ---"
agent-browser eval "(()=>{const fab=document.querySelector('button[aria-label=\"Hitre akcije\"]'); return JSON.stringify({fab: !!fab, hasPopup: fab?.getAttribute('aria-haspopup'), ring: /focus-visible:ring/.test(fab?.className||'')});})()" 2>&1 | tail -1

echo "--- E2E 2: vremenska kartica (demo fail-verbose banner) ---"
agent-browser eval "(()=>{const t=document.body.textContent; const demo=/Demo podatki — živi vremenski servis/.test(t); const risk=/Varno za montažo|Previdno|Nevarno|NE montaža/.test(t); return JSON.stringify({demoBannerVisible: demo, riskBadgeVisible: risk});})()" 2>&1 | tail -1

echo "--- E2E 3: Več → Ekipa tab ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('Ekipa')&&x.children.length>0&&x.closest('[data-slot=\"sheet-content\"], [role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 3

echo "--- E2E 4: Izvozi CSV gumb v DOM z aria-label ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Izvozi CSV/.test(x.textContent||'')); return JSON.stringify({found: !!b, aria: b?.getAttribute('aria-label'), title: !!b?.getAttribute('title'), ring: /focus-visible:ring/.test(b?.className||''), statusBadge: /Aktiven/.test(document.body.textContent)});})()" 2>&1 | tail -1

echo "--- E2E 5: klik na izvoz → download dogodek ---"
agent-browser eval "(()=>{let dl=null; window.addEventListener('click', ()=>{}, true); const b=[...document.querySelectorAll('button')].find(x=>/Izvozi CSV/.test(x.textContent||'')); if(b) b.click(); return JSON.stringify({clicked: !!b});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toast=document.querySelector('[data-sonner-toast]'); return JSON.stringify({toastText: toast?toast.textContent.slice(0,90):null});})()" 2>&1 | tail -1

echo "--- E2E 6: konzola čista ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 free"; fi
