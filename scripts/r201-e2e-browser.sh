#!/bin/bash
# R201 E2E ŽIVO: iskren prazni stolpec Meritve brez projektov (R200 P1 (b))
#   Z0 prijava ADMIN (ci@roksal.si) + POVABILO MONTER prek UI fetch → aktivacija
#      (svež uporabnik = 0 projektov = natanko spot realnost iz API diagnoze R200)
#   Z1 prijava novega MONTER → Meritve:
#      - data-testid meritve-brez-projektov VIDEN
#      - 'Ni projektov' + iskrena razlaga (ni slepega izbrika)
#      - 'Kaj naprej' vodič (ol, 3 koraki)
#      - seznam: 'Meritve čakajo na projekt' + NI 'Dodaj meritev' akcije
#      - predloge: 'Predloge so na voljo, ko je izbran projekt.' (razloženo)
#      - zgodovina: 'Ni sprememb — …' (brez '0 sprememb • zadnjih 0')
#      - __err null
#   Z2 temna tema na praznem stolpcu + screenshot
#   Z3 ADMIN regresija: Meritve s projekti → slepi izbirnik VEJA (placeholder)
#      + 'Dodaj meritev' akcija ostane + CSV gumb; po potrebi ustvari projekt
#   Z4 javne poti + odjava + čiščenje
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
NOVI="r201-e2e-$(date +%s)@roksal.si"
GESLO="E2eR201Geslo1!"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r201-server-e2e.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12

echo "--- Z0: prijava ADMIN + povabilo MONTER (UI fetch) + aktivacija ---"
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})" 2>&1 | tail -1
PATH_ACT=$(agent-browser eval "(async()=>{const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:'$NOVI',ime:'R201 E2E',vloga:'MONTER'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, path:b.activationPath??null});})()" 2>&1 | tail -1)
echo "POVABILO: $PATH_ACT"
TOKEN=$(echo "$PATH_ACT" | grep -oE '/aktivacija/[A-Za-z0-9_-]+' | cut -d/ -f3)
agent-browser open "$BASE/aktivacija/$TOKEN" > /dev/null 2>&1
sleep 4
agent-browser fill '#act-pass' "$GESLO" > /dev/null 2>&1
agent-browser fill '#act-repeat' "$GESLO" > /dev/null 2>&1
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Aktiviraj račun'); if(!g) return 'brez gumba'; g.click(); return 'poslan';})()" 2>&1 | tail -1
sleep 4

echo "--- Z1: prijava novega MONTER (0 projektov) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' "$NOVI" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' "$GESLO" > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})" 2>&1 | tail -1

echo "--- Z1b: Meritve — ISKREN PRAZNI STOLPEC (R201 F1) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"meritve-brez-projektov\"]'); const niProjektov=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni projektov').length; const razlaga=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim().startsWith('Meritve se vežejo na projekt')).length; const ol=document.querySelector('ol[aria-label=\"Kaj naprej\"]'); const koraki=ol?ol.querySelectorAll('li').length:null; const korak1=ol?ol.querySelectorAll('li')[0]?.textContent.trim():null; return JSON.stringify({blokViden:!!blok,niProjektov,razlaga,kajNaprej:!!ol,koraki,korak1,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z1c: seznam brez akcije + predloge razlaga + zgodovina ---"
agent-browser eval "(()=>{const caka=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Meritve čakajo na projekt').length; const dodajGumb=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Dodaj meritev').length; const note=[...document.querySelectorAll('[role=note]')].map(e=>e.textContent.trim()).find(t=>t.includes('Predloge so na voljo')); const zgod=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim().startsWith('Ni sprememb — zgodovina se zapiše ob prvih meritvah')).length; const awkward=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.includes('zadnjih 0 prikazanih')).length; return JSON.stringify({caka,dodajGumb,predlogeRazlaga:note||null,zgodovinaIskrena:zgodovina,awkwardNič:awkward,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r201-e2e-prazni-stolpec.png" > /dev/null 2>&1 && echo "screenshot PRAZNI OK"

echo "--- Z2: temna tema na praznem stolpcu ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r201-e2e-temna-prazno.png" > /dev/null 2>&1 && echo "screenshot TEMNA PRAZNO OK"

echo "--- Z3: ADMIN regresija — veja s projekti ohranjena ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
# po potrebi ustvari projekt (lokalni E2E DB), da je veja s projekti izvedena
agent-browser eval "(async()=>{const lst=await fetch('/api/projects'); const arr=await lst.json().catch(()=>[]); if(Array.isArray(arr)&&arr.length>0) return JSON.stringify({projekti:arr.length,novo:false}); const r=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nazivProjekta:'R201 E2E regresija',lokacija:'Ljubljana',vrstaOgraje:'RAMNA',dolzinaM:10,višinaM:1.2})}); return JSON.stringify({status:r.status,novo:true});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"meritve-brez-projektov\"]'); const izb=[...document.querySelectorAll('select,[role=combobox]')].length; const dodajGumb=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Dodaj meritev').length; const csvG=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); return JSON.stringify({prazniBlokPRI ProjekTIH:!!blok,izbirnikAliCombobox:izb,dodajGumb,csvGumb:!!csvG,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r201-e2e-admin-veja.png" > /dev/null 2>&1 && echo "screenshot ADMIN VEJA OK"

echo "--- Z4: javne poti + odjava ---"
agent-browser eval "(async()=>{const h=await fetch('/api/public/health'); const v=await fetch('/api/public/version'); const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({health:h.status,version:v.status,logout:r.status});})()" 2>&1 | tail -1

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R201 E2E KONEC"
