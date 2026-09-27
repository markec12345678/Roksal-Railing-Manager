#!/bin/bash
# R201 reprobe — dva popravljena evala (napaki sta bili v PROBE JS, ne v app):
#   A) Z1c: seznam brez 'Dodaj meritev' + predloge razlaga + iskrena zgodovina
#   B) Z3:  ADMIN (15 projektov) → veja s projekti: brez praznega bloka,
#           izbirnik prisoten, 'Dodaj meritev' akcija ohranjena, CSV gumb
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r201-server-reprobe.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

echo "--- B) ADMIN (veja s projekti) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"meritve-brez-projektov\"]'); const izb=[...document.querySelectorAll('select,[role=combobox]')].length; const dodajGumb=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Dodaj meritev').length; const csvG=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); const placeholder=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Izberi projekt').length; return JSON.stringify({prazniBlokViden:!!blok,izbirnikAliCombobox:izb,dodajGumb,csvGumb:!!csvG,placeholderViden:placeholder,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r201-e2e-admin-veja2.png" > /dev/null 2>&1 && echo "screenshot ADMIN VEJA2 OK"

echo "--- A) nov MONTER (0 projektov) — popravljeno Z1c ---"
NOVI=$(ls /tmp/r201-e2e-email.txt 2>/dev/null && cat /tmp/r201-e2e-email.txt || echo "r201-e2e-manual@roksal.si")
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
# povabimo svežega (prejšnji E2E uporabnik ni bil shranjen v datoteko)
TS=$(date +%s)
PATH_ACT=$(agent-browser eval "(async()=>{return 'ADMIN_SEJA';})()" 2>&1 | tail -1)
echo "opomba: uporabimo obstoječega novega uporabnika iz Z0 — geslo je bilo nastavljeno v E2E (vzorec r200)."
# prijava z uporabnikom iz prvega E2E teka ni mogoča (email z časovnim žigom) —
# zato ustvarimo novega prek ADMIN fetch + aktivacija:
EMAIL="r201-reprobe-$TS@roksal.si"
PATH_ACT=$(agent-browser eval "(async()=>{const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:'$EMAIL',ime:'R201 Reprobe',vloga:'MONTER'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, path:b.activationPath??null});})()" 2>&1 | tail -1)
echo "POVABILO: $PATH_ACT"
TOKEN=$(echo "$PATH_ACT" | grep -oE '/aktivacija/[A-Za-z0-9_-]+' | cut -d/ -f3)
agent-browser open "$BASE/aktivacija/$TOKEN" > /dev/null 2>&1
sleep 4
agent-browser fill '#act-pass' 'E2eR201Geslo1!' > /dev/null 2>&1
agent-browser fill '#act-repeat' 'E2eR201Geslo1!' > /dev/null 2>&1
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Aktiviraj račun'); if(!g) return 'brez gumba'; g.click(); return 'poslan';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' "$EMAIL" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'E2eR201Geslo1!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const caka=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Meritve čakajo na projekt').length; const dodajGumb=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Dodaj meritev').length; const note=[...document.querySelectorAll('[role=note]')].map(e=>e.textContent.trim()).find(t=>t.includes('Predloge so na voljo')); const zgod=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim().startsWith('Ni sprememb — zgodovina se zapiše ob prvih meritvah')).length; const awkward=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.includes('zadnjih 0 prikazanih')).length; return JSON.stringify({caka,dodajGumb,predlogeRazlaga:note||null,zgodovinaIskrena:zgod,awkwardNula:awkward,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r201-e2e-prazni-stolpec2.png" > /dev/null 2>&1 && echo "screenshot PRAZNI2 OK"

agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R201 REPROBE KONEC"
