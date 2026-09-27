#!/bin/bash
# R219 E2E ŽIVO (vzorec r218): F1 'pod minimumom' čip + 'Vse' deep-link (P1-f)
# + F2 zvonček digest badge (P1-e, 5. signalec) + regresije.
# ZERO-MUTACIJA zaloge: 5 artiklov ZAČASNO višji minimalnaZaloga (raise,
# reuse r218-min-tmp.cjs) → bajtnato obnovljeno (restore + DB check).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r219-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R219-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- RAISE: 5 artiklov pod minimum (nizka = 6) ---"
node scripts/r218-min-tmp.cjs raise || { echo "RAISE FAIL — abort"; exit 1; }

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

zapri_vodic() {
  for i in 1 2 3 4 5; do
    agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
    sleep 1
  done
}
odpri_palet() {
  for i in 1 2 3 4; do
    agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'klik';} return 'ni gumba';})()" > /dev/null 2>&1
    sleep 3
    ODPRT=$(agent-browser eval "(()=>{return !!document.querySelector('[cmdk-input]');})()" 2>&1 | tail -1)
    if [ "$ODPRT" = "true" ]; then echo "paleta odprta (poskus $i)"; return 0; fi
    zapri_vodic
  done
  return 1
}
prijava() {
  agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
  agent-browser wait 'input[type="email"]' > /dev/null 2>&1
  agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
  agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
  agent-browser click 'button[type="submit"]' > /dev/null 2>&1
  sleep 8
  zapri_vodic
}

echo "--- Z0: prijava + vodič ---"
prijava

echo "--- Z1 (F1 ŽIVO): paleta 'Vse' → Zaloga s ČIPOM 'Pod minimumom' (aria-pressed + števec 6) ---"
odpri_palet
agent-browser eval "(()=>{const vse=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Pokaži vse s nizko zalogo v Zalogi')); if(!vse) return 'ni Vse vrstice'; vse.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik Vse';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const cip=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const dlg=[...document.querySelectorAll('[role=dialog]')].filter(d=>d.getAttribute('data-state')!=='closed'&&d.textContent.includes('Naročilnica kot osnutek naročila')); const pal=document.querySelector('[cmdk-root]'); return JSON.stringify({aktivniTab:cur?cur.textContent.trim():null,cipObstaja:!!cip,cipPritisnjen:cip?cip.getAttribute('aria-pressed'):null,cipStevilo:cip?cip.textContent.trim():null,cipAria:cip?cip.getAttribute('aria-label'):null,dialogOdprt:dlg.length>0,paletaZaprta:!pal,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>d.textContent.includes('minimum')); const badge=[...document.querySelectorAll('.divide-y span')].filter(s=>s.textContent.trim()==='DA').length; return JSON.stringify({vidnihVrsticZMinimumom:vrstice.length,zapiskiDA:badge});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r219-cip-deeplink.png" > /dev/null 2>&1

echo "--- Z2 (F1 čip toggle): klik čip → OFF (vsi artikli) → klik → ON (6) ---"
agent-browser eval "(()=>{const cip=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); if(!cip) return 'ni čipa'; cip.click(); return 'klik čip';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const cip=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const vrstice=[...document.querySelectorAll('.divide-y > div')].length; return JSON.stringify({stanje:cip?cip.getAttribute('aria-pressed'):null,steviloNaCipu:cip?cip.textContent.includes(String(vrstice)):null,vidnihVrstic:vrstice});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const cip=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); if(!cip) return 'ni čipa'; cip.click(); return 'klik čip nazaj';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const cip=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>d.textContent.includes('minimum')); return JSON.stringify({stanje:cip?cip.getAttribute('aria-pressed'):null,podMinVrstice:vrstice.length});})()" 2>&1 | tail -1

echo "--- Z3 (F1 kompozicija): tip 'Inox' + čip → iskren kompozitni števec ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Inox'&&b.getAttribute('aria-pressed')===null); if(!t) return 'ni Inox taba'; t.click(); return 'klik Inox';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const cip=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')==='true'&&b.textContent.includes('Pod minimumom')); const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>d.textContent.includes('minimum')); const st=cip?cip.textContent.replace(/[^0-9]/g,''):null; return JSON.stringify({tipInox:true,cipStevilo:st,podMinVrstice:vrstice.length,konsistentno:cip&&st!==null?Number(st)===vrstice.length:null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Vse'&&b.getAttribute('aria-pressed')===null); if(t){t.click(); return 'nazaj Vse';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z4 (F2 ŽIVO): zvonček stock item nosi badge 'Nizka zaloga' (5. signalec) ---"
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label*=\"Obvestila\"]'); if(b){b.click(); return 'zvonček';} return 'ni zvončka';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const it=[...document.querySelectorAll('button')].filter(e=>e.textContent.includes('Naroči material')&&e.textContent.includes('minimum')); if(!it.length) return 'NI STOCK VRSTIC'; const el=it[it.length-1]; const badge=el.textContent.includes('Nizka zaloga'); const red=!!el.querySelector('[class*=\"roksal-red\"]'); el.click(); return 'KLIK stock | badge:'+badge+' | roksal-red:'+red+' | '+el.textContent.trim().slice(0,80);})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.getAttribute('data-state')!=='closed'&&d.textContent.includes('Naročilnica kot osnutek naročila')); return JSON.stringify({r216regresijaDialog:!!dlg});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano';} return 'ni gumba';})()" > /dev/null 2>&1
sleep 2
agent-browser press Escape > /dev/null 2>&1
sleep 2

echo "--- Z5 (R218 regresija): iskanje 'Inox' → badge → zgodovina z žigom ---"
odpri_palet
agent-browser eval "(()=>{const inp=document.querySelector('[cmdk-input]'); if(!inp) return 'ni inputa'; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,'Inox'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno Inox';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')]; const hit=items.find(el=>(el.getAttribute('aria-label')||'').includes('odpre naročilni tok')); if(!hit) return 'ZADETEK NI VIDEN'; hit.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik M12';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.getAttribute('data-state')!=='closed'&&d.textContent.includes('Naročilnica kot osnutek naročila')); return JSON.stringify({r217regresijaDialog:!!dlg});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano';} return 'ni';})()" > /dev/null 2>&1
sleep 2
odpri_palet
agent-browser eval "(()=>{const zi=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.trim().startsWith('Inox')&&!e.textContent.includes('Vijak')); return JSON.stringify({zgodovinaInox:!!zi,ziBadge:zi?zi.textContent.includes('Nizka zaloga'):null});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 2

echo "--- Z6: RESTORE + DB check + temna + health + port ---"
node scripts/r218-min-tmp.cjs restore || { echo "RESTORE FAIL — ROČNO POPRAVI"; exit 1; }
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.inventory.findMany({ where: { sifraMateriala: { in: ['ALU-PROF-40','ALU-PROF-60','EPDM-TESNILO','SID-HILTI-330','WPC-120-A','INOX-M12-A4'] } }, select: { sifraMateriala: true, kolicinaZaloga: true, minimalnaZaloga: true }, orderBy: { sifraMateriala: 'asc' } }).then(r => { console.log('DB:', JSON.stringify(r)); return db.\$disconnect(); }).catch(e => { console.error('DB CHECK NAPAKA:', e.message); process.exit(1); });
"
prijava
odpri_palet
agent-browser eval "(()=>{const h=[...document.querySelectorAll('[cmdk-group-heading]')].map(e=>e.textContent).find(t=>t.includes('Nizka zaloga')); const vse=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Pokaži vse s nizko zalogo v Zalogi')); return JSON.stringify({stevec1:h?h.includes('1'):false,vseNiVidna:!vse});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na temni način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const bg=getComputedStyle(document.body).backgroundColor; return JSON.stringify({temnaBg:bg,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na svetli način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('svetl')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 2
curl -s --max-time 10 "http://127.0.0.1:3100/api/public/health"; echo
agent-browser eval "(()=>{const o=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Odjava')); if(o){o.click(); return 'odjava';} return 'ni gumba';})()" > /dev/null 2>&1
sleep 2
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R219 E2E KONEC ---"
