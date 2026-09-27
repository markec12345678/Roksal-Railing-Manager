#!/bin/bash
# R206 mini reprobe — iskri toasti v Material → Naročila (shadcn useToast DOM,
# ne sonner): klik 'Označi kot poslano' na naslednjem OSNUTEK naročilu →
# pričakuj li[role=status] z naslovom 'Označeno kot poslano (status POSLANO)'
# + razlago 'Aplikacija ne pošilja dokumentov'.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/R206-server-reprobe.log 2>&1 < /dev/null &
sleep 4

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Naročila'); if(t){t.click(); return 'klik';} return 'ni';})()" > /dev/null 2>&1
sleep 5

echo "--- klik 'Označi kot poslano' (naslednji OSNUTEK) + shadcn toast scan ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Označi kot poslano'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const statusi=[...document.querySelectorAll('[role=status],li[data-state]')].map(e=>e.textContent.trim()).filter(t=>t.length>0&&t.length<260); const oznaci=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Označi kot poslano').length; return JSON.stringify({toasti:statusi.slice(0,3),oznaciGumbiPo:oznaci,err:window.__err??null});})()" 2>&1 | tail -1

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R206 REPROBE KONEC"
