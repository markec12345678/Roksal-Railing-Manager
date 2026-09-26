#!/bin/bash
# R166 E2E (lokalni build): TerminiCard — naslednjih 7 dni.
# ADMIN (ci@roksal.si / DimniSmoke139! — precedens R165):
#  1) kartica živa v DOM (naslov, osveži gumb, stanje);
#  2) POST /api/schedules (danes, monterId = jaz) → kartica pokaže "Danes"
#     + "Moja montaža" + status "Načrtovano";
#  3) temna tema brez opakih belih površin; 4) konzola čista.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r166-e2e-server.log 2>&1 < /dev/null &
sleep 5
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/login

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- E2E 1: TerminiCard živa v DOM (naslov + osveži + stanje) ---"
agent-browser eval "(()=>{const kartice=[...document.querySelectorAll('.card')]; const naslov=[...document.querySelectorAll('h3,[data-slot=card-title]')].find(x=>(x.textContent||'').includes('Termini — naslednjih 7 dni')); const osvezi=document.querySelector('button[aria-label=\"Osveži termine\"]'); const prazno=(document.body.textContent||'').includes('Ni terminov v naslednjih 7 dneh'); const alert=document.querySelector('[role=alert]'); return JSON.stringify({naslov: !!naslov, osvezi: !!osvezi, praznoStanje: prazno, errorPanel: alert?alert.textContent.slice(0,60):null});})()" 2>&1 | tail -1

echo "--- E2E 2: POST /api/schedules (danes 14:00, monter = jaz) prek API ---"
agent-browser eval "(async()=>{const a=await fetch('/api/auth',{credentials:'same-origin'}); const me=await a.json(); const p=await fetch('/api/projects',{credentials:'same-origin'}); const projekti=await p.json(); const projekt=(Array.isArray(projekti)?projekti:[])[0]; if(!projekt) return JSON.stringify({napaka:'ni projektov'}); const zacetek=new Date(); zacetek.setHours(14,0,0,0); const konec=new Date(zacetek.getTime()+4*3600000); const r=await fetch('/api/schedules',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':'r166-e2e-termin-1'},body:JSON.stringify({projectId:projekt.id,monterId:me.user.id,datumZacetka:zacetek.toISOString(),datumKonca:konec.toISOString(),lokacija:'E2E testna lokacija R166',predvideneUre:4})}); const body=await r.json().catch(()=>null); return JSON.stringify({status:r.status, id:body&&body.id?body.id:null, err:body&&body.error?body.error.slice(0,80):null});})()" 2>&1 | tail -1
sleep 1

echo "--- E2E 3: osveži kartico → Danes skupina + Moja montaža + Načrtovano ---"
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Osveži termine\"]'); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=document.body.textContent||''; const danes=t.includes('Danes'); const moja=t.includes('Moja montaža'); const nacrtovano=t.includes('Načrtovano'); const lokacija=t.includes('E2E testna lokacija R166'); return JSON.stringify({danesSkupina: danes, mojaMontaza: moja, statusZnacka: nacrtovano, lokacijaVrstica: lokacija});})()" 2>&1 | tail -1

echo "--- E2E 4: temna tema + brez opakih belih + screenshot ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const opake=[...document.querySelectorAll('[class*=bg-white]')].filter(el=>!/bg-white\\//.test(el.className)); const kartica=document.querySelector('[data-slot=card]'); return JSON.stringify({bodyBg: getComputedStyle(document.body).backgroundColor, opakaBelaPovrsina: opake.length, karticaBg: kartica?getComputedStyle(kartica).backgroundColor:null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r166-local-termini-card.png > /dev/null 2>&1 && echo "screenshot OK"

echo "--- E2E 5: konzola ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 sproščen"; fi
echo "R166 E2E KONEC"
