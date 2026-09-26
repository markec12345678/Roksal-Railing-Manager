#!/bin/bash
# R165 E2E (lokalni build): statusni dropdown — SAMO dovoljeni prehodi per vloga
# + fail-verbose toast + DARK sweep (brez belih kvadratov v temni temi).
# Vloge: ci@roksal.si = ADMIN (vseh 7 možnosti), r165-e2e@roksal.si = MONTER
# (registriran živo prek API — precedens R127; omejen seznam).
set -u
cd /home/z/my-project/roksal-repo
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/roksal-repo/server.js > /tmp/r165-e2e-server.log 2>&1 < /dev/null &
sleep 4

# Lokalni MONTER (spot) — registracija prek API (lokalni strežnik)
curl -s -X POST http://127.0.0.1:3100/api/auth/register -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:3100" \
  -d '{"name":"R165 E2E Monter","email":"r165-e2e@roksal.si","password":"R165E2eMonter!Pass"}' | head -c 200
echo ""

agent-browser close --all > /dev/null 2>&1 || true

echo "===== DEL 1: MONTER — omejen dropdown ====="
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'r165-e2e@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'R165E2eMonter!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- E2E 1 (MONTER): dropdown na NACRTOVANO (brez locka) → samo V_TEKU+USTAVLJENO+disabled current ---"
agent-browser eval "(()=>{const badges=[...document.querySelectorAll('.cursor-pointer')].filter(b=>b.textContent.trim()==='Načrtovano'); const b=badges[0]; if(!b) return 'Ni NACRTOVANO značke'; b.click(); return 'kliknil';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const menu=document.querySelector('.absolute.right-3.top-12'); if(!menu) return 'meni NI odprt'; const items=[...menu.querySelectorAll('button')].map(x=>({t:x.textContent.trim().replace('close','').trim(), disabled:x.disabled})); return JSON.stringify(items);})()" 2>&1 | tail -1

echo "--- E2E 2 (MONTER): dropdown na MONTIRANO → samo ZAKLJUCENO ---"
agent-browser eval "(()=>{document.body.click(); const badges=[...document.querySelectorAll('.cursor-pointer')].filter(b=>b.textContent.trim()==='Montirano'); const b=badges[0]; if(!b) return 'Ni MONTIRANO značke (MONTER ne vidi?)'; b.click(); return 'kliknil';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const menu=document.querySelector('.absolute.right-3.top-12'); if(!menu) return 'meni NI odprt'; const items=[...menu.querySelectorAll('button')].map(x=>x.textContent.trim()); return JSON.stringify(items);})()" 2>&1 | tail -1

echo "--- E2E 3 (MONTER): temna tema +_team tab brez belih kvadratov ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const opake=[...document.querySelectorAll('[class*=bg-white]')].filter(el=>!/bg-white\\//.test(el.className)&&!/PODPISNO/.test(el.textContent)); return JSON.stringify({bodyBg: getComputedStyle(document.body).backgroundColor, opakaBelaPovrsina: opake.length});})()" 2>&1 | tail -1

echo "--- E2E 4 (MONTER): odjava ---"
agent-browser eval "(()=>{const m=document.querySelector('[aria-haspopup=menu]'); if(m) m.click(); return !!m;})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const o=[...document.querySelectorAll('[role=menuitem],button')].find(x=>/Odjava/.test(x.textContent||x.getAttribute('aria-label')||'')); if(o) o.click(); return !!o;})()" 2>&1 | tail -1
sleep 2

echo "===== DEL 2: ADMIN — vseh 7 možnosti + fail-verbose je moč poklicati ====="
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- E2E 5 (ADMIN): dropdown na NACRTOVANO → 7 vrstic, current disabled ---"
agent-browser eval "(()=>{const badges=[...document.querySelectorAll('.cursor-pointer')].filter(b=>b.textContent.trim()==='Načrtovano'); const b=badges[0]; if(!b) return 'Ni značke'; b.click(); return 'kliknil';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const menu=document.querySelector('.absolute.right-3.top-12'); if(!menu) return 'meni NI odprt'; const items=[...menu.querySelectorAll('button')].map(x=>({t:x.textContent.trim().replace('close','').trim(), disabled:x.disabled})); return JSON.stringify({stevilo: items.length, items});})()" 2>&1 | tail -1

echo "--- E2E 6 (ADMIN): legalni prehod V_TEKU → toast 'Status posodobljen' ---"
agent-browser eval "(()=>{const menu=document.querySelector('.absolute.right-3.top-12'); if(!menu) return 'meni NI odprt'; const b=[...menu.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith('V teku')); if(b&&!b.disabled) b.click(); return JSON.stringify({nasel: !!b, disabled: b?.disabled});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toast=document.querySelector('[data-sonner-toast]'); return JSON.stringify({toast: toast?toast.textContent.slice(0,70):null});})()" 2>&1 | tail -1

echo "--- E2E 7: konzola + screenshot ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r165-local-dark-dropdown.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 sproščen"; fi
echo "R165 E2E KONEC"
