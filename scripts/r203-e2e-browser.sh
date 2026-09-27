#!/bin/bash
# R203 E2E ŽIVO (EN klic — nauček R157: procesi ne preživijo bash klicev).
#  Z0: standalone :3100 + ADMIN prijava (ci@roksal.si)
#  Z1: Meritve → 'Povzetek' gumb ŽIVO: clipboard patch → klik →
#      window.__povz struktura (glava/števec/osveženo/mm vrstice) + toast
#  Z2: Domov regresija: 'Zaloga ni na voljo' ×0 (zdravo stanje NI pokvarjeno),
#      invError alert ×0, stara laga NI povrnjena
#  Z3: temna rgb(15,23,36) + __err null skozi
#  Z4: version/health 200 + odjava + port sproščen
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/R203-server-e2e.log 2>&1 < /dev/null &
sleep 4

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

echo "--- Z0: prijava ADMIN ---"
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z0b: zapri uvodni vodič (točen aria-label) ---"
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

echo "--- Z1: Meritve → Povzetek gumb ŽIVO ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
# stanje: koliko meritev je vidnih (vrstice tabele) + ali Povzetek gumb obstaja
agent-browser eval "(()=>{const povzetek=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Kopiraj povzetek vidnih meritev v odložišče'); const csv=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Izvozi vidne meritve kot CSV'); return JSON.stringify({povzetekGumb:!!povzetek,csvGumb:!!csv});})()" 2>&1 | tail -1
# izberi projekt z meritvami prek Radix Select (pointer sekvenca — nauček R190/R199)
agent-browser eval "(()=>{const trg=document.querySelector('button[role=combobox]'); if(!trg) return 'ni trigger'; const r=trg.getBoundingClientRect(); const opts={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}; trg.dispatchEvent(new PointerEvent('pointerdown',opts)); trg.dispatchEvent(new PointerEvent('pointerup',opts)); trg.click(); return 'odprt';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const opt=[...document.querySelectorAll('[role=option]')].find(o=>o.textContent.includes('Ograja Novak')); if(opt){opt.click(); return 'izbran';} return 'ni opcije';})()" 2>&1 | tail -1
sleep 6
# clipboard patch + klik Povzetek
agent-browser eval "window.__povz=null; navigator.clipboard.writeText=(t)=>{window.__povz=t; return Promise.resolve();}; 'patched'" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Kopiraj povzetek vidnih meritev v odložišče'); if(b){b.click(); return 'kliknjen';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=document.querySelector('[data-sonner-toast]'); const p=window.__povz; const vrstice=p?p.split('\n'):[]; const struktura=p?{glava:vrstice[0].startsWith('Meritve — '),stevec:/\\d+ (meritev|meritvi|meritve) · osveženo /.test(vrstice[1]||''),prvaVrstica:/^1\\. /.test(vrstice[3]||''),mmFormat:(p.match(/\\d+×\\d+ mm/g)||[]).length>0}:null; return JSON.stringify({dolzina:p?p.length:0,glava:p?vrstice[0]:null,stevec:vrstice[1]||null,prveTri:vrstice.slice(0,6),struktura,toast:t?t.textContent.trim().slice(0,80):null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r203-e2e-povzetek.png" > /dev/null 2>&1 && echo "screenshot POVZETEK OK"

echo "--- Z2: Domov regresija (zdravo stanje) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Domov')); if(d) d.click(); return !!d;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const invNapaka=[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent).filter(t=>t.includes('Zaloga ni na voljo')).length; const niProjektov=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni projektov').length; const staraVrstica=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni aktivnih projektov').length; const blok=!!document.querySelector('[data-testid=\"domov-brez-projektov\"]'); return JSON.stringify({invNapakaPanel:invNapaka,niProjektov:niProjektov,staraVrstica,blokPrazni:blok,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z3: temna tema ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r203-e2e-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"

echo "--- Z4: odjava + javne poti ---"
agent-browser eval "document.documentElement.classList.remove('dark'); 'svetla'" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Odjava'); if(b){b.click(); return 'klik';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname});})()" 2>&1 | tail -1
curl -s -o /dev/null -w "version: %{http_code}\n" -m 15 "http://127.0.0.1:3100/api/public/version"
curl -s -o /dev/null -w "health: %{http_code}\n" -m 15 "http://127.0.0.1:3100/api/health"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R203 E2E KONEC"
