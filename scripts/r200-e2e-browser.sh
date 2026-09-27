#!/bin/bash
# R200 E2E ŽIVO: 'Odpri Ekipa' akcija (FAILED_LOGINS_OVERVIEW → Ekipa navigacija)
#                + 'Zadnja aktivnost' z uro (aktivnostOznaka).
#   Z0 UI prijava ADMIN (ci@roksal.si) + POVABILO prek UI fetch → aktivacija obrazec
#   Z1 prijava novega uporabnika → odjava → NAPAČNO geslo (določljiv LOGIN_FAILED audit)
#   Z2 ADMIN prijava → zvonček 'Pregled neuspešnih prijav (24 h)' + NOVI chip
#      'Odpri Ekipa' VIDEN (R200 F1 fingerprint)
#   Z3 (R200) klik 'Odpri Ekipa' → panel zaprt + navigacija na Ekipa zavihek
#      (roksal:navigate {more:'ekipa'}) + vrstica ack (Odprto) po ponovnem odprtju
#   Z4 (R200) Ekipa: 'Zadnja aktivnost: danes ob HH:MM:SS' (R200 F2) + regresije
#      (pečat 'Osveženo ob' v Ekipi, temna, __err null)
#   Z5 javne poti + odjava + čiščenje
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
NOVI="r200-e2e-$(date +%s)@roksal.si"
GESLO="E2eR200Geslo1!"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r200-server-e2e.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12

echo "--- Z0: prijava ADMIN + povabilo (UI fetch) + aktivacija ---"
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})" 2>&1 | tail -1
PATH_ACT=$(agent-browser eval "(async()=>{const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:'$NOVI',ime:'R200 E2E',vloga:'MONTER'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, path:b.activationPath??null});})()" 2>&1 | tail -1)
echo "POVABILO: $PATH_ACT"
TOKEN=$(echo "$PATH_ACT" | grep -oE '/aktivacija/[A-Za-z0-9_-]+' | cut -d/ -f3)
agent-browser open "$BASE/aktivacija/$TOKEN" > /dev/null 2>&1
sleep 4
agent-browser fill '#act-pass' "$GESLO" > /dev/null 2>&1
agent-browser fill '#act-repeat' "$GESLO" > /dev/null 2>&1
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Aktiviraj račun'); if(!g) return 'brez gumba'; g.click(); return 'poslan';})()" 2>&1 | tail -1
sleep 4

echo "--- Z1: prijava novega → odjava → NAPAČNO geslo (garantira LOGIN_FAILED) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' "$NOVI" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' "$GESLO" > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' "$NOVI" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'NarobnoGeslo200' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 4
NAPACNO=$(agent-browser eval "JSON.stringify({napaka:document.body.textContent.includes('Napačen e-naslov ali geslo.')})" 2>&1 | tail -1)
echo "NAPAČNA PRIJAVA (garantira LOGIN_FAILED): $NAPACNO"

echo "--- Z2: ADMIN prijava → zvonček pregled + NOVI chip 'Odpri Ekipa' VIDEN ---"
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
ZVONCEK_ODPRI="(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'brez zvoncka'; const r=b.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; b.dispatchEvent(new PointerEvent('pointerdown',o)); b.dispatchEvent(new PointerEvent('pointerup',o)); b.dispatchEvent(new MouseEvent('click',o)); return 'zvoncek poslan';})()"
agent-browser eval "$ZVONCEK_ODPRI" 2>&1 | tail -1
sleep 4
Z2=$(agent-browser eval "(()=>{const v=document.body.textContent; const chip=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Odpri Ekipa'&&(x.getAttribute('aria-label')||'').includes('Odpri Ekipa')); return JSON.stringify({pregled:v.includes('Pregled neuspešnih prijav (24 h)'), odpriEkipaChip:!!chip, err:window.__err??null});})()" 2>&1 | tail -1)
echo "Z2 ZVONČEK + CHIP: $Z2"
agent-browser screenshot "$SS/e2e-r200-odpri-ekipa-chip.png" > /dev/null 2>&1 && echo "screenshot CHIP OK"

echo "--- Z3: klik 'Odpri Ekipa' → navigacija na Ekipa zavihek + ack ---"
agent-browser eval "(()=>{const c=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Odpri Ekipa'); if(!c) return 'brez chipa'; c.click(); return 'chip kliknjen';})()" 2>&1 | tail -1
sleep 4
Z3=$(agent-browser eval "(()=>{const v=document.body.textContent; const panelZaprt=!v.includes('Poslana obvestila'); return JSON.stringify({panelZaprt,ekipaVidna:v.includes('Življenjski cikl računov')||v.includes('Ekipa'),url:location.pathname,err:window.__err??null});})()" 2>&1 | tail -1)
echo "Z3 NAVIGACIJA: $Z3"
agent-browser screenshot "$SS/e2e-r200-ekipa-tab.png" > /dev/null 2>&1 && echo "screenshot EKIPA OK"

echo "--- Z3b: zvonček znova → vrstica pregleda je ACK (Odprto) ---"
agent-browser eval "$ZVONCEK_ODPRI" > /dev/null 2>&1
sleep 3
Z3B=$(agent-browser eval "(()=>{const li=[...document.querySelectorAll('li')].find(x=>x.textContent.includes('Pregled neuspešnih prijav (24 h)')); return JSON.stringify({vrstica:!!li,odprto:li?li.textContent.includes('Odprto'):false});})()" 2>&1 | tail -1)
echo "Z3b ACK: $Z3B"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(z) z.click(); return 'zapri';})()" > /dev/null 2>&1
sleep 1

echo "--- Z4: Ekipa 'Zadnja aktivnost: danes ob HH:MM:SS' (R200 F2) + regresije ---"
Z4=$(agent-browser eval "(()=>{const spans=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Zadnja aktivnost:')).map(e=>e.textContent.trim()); const danes=spans.filter(t=>t.startsWith('Zadnja aktivnost: danes ob ')).length; const nikoli=spans.filter(t=>t.endsWith('nikoli')).length; const osvezeno=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).length; return JSON.stringify({vrsticAktivnost:spans.length,danesUra:danes,nikoli:nikoli,ekipaPecatOsvezeno:osvezeno,err:window.__err??null});})()" 2>&1 | tail -1)
echo "Z4 AKTIVNOST: $Z4"
agent-browser screenshot "$SS/e2e-r200-aktivnost-ura.png" > /dev/null 2>&1 && echo "screenshot AKTIVNOST OK"
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label*=\"tem\" i], button[aria-label*=\"Tem\"]'); if(t) t.click(); return 'klik';})()" > /dev/null 2>&1
sleep 2
BG=$(agent-browser eval "getComputedStyle(document.body).backgroundColor" 2>&1 | tail -1)
echo "Z4 TEMNA: $BG (pričakovano rgb(15, 23, 36))"
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label*=\"tem\" i], button[aria-label*=\"Tem\"]'); if(t) t.click(); return 'nazaj';})()" > /dev/null 2>&1
sleep 1

echo "--- Z5: javne poti + odjava + čiščenje ---"
curl -sS -m 10 -o /dev/null -w "version:%{http_code} " "$BASE/api/public/version"
curl -sS -m 10 -o /dev/null -w "health:%{http_code}\n" "$BASE/api/public/health"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R200 E2E KONEC ==="
