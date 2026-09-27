#!/bin/bash
# R218 E2E ŽIVO (vzorec r217-final3): F1 zgodovina žiga (P1-e) + F2 iskren
# števec/'Vse' vrstica (P1-f) + regresije. ZERO-MUTACIJA zaloge: 5 artiklov
# dobi ZAČASNO višji minimalnaZaloga (raise) → bajtnato obnovljen (restore).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r218-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R218-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z0: prijava + vodič ---"
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
zapri_vodic

echo "--- Z1 (P1-e fail-closed): STARA shema zgodovine (goli nizi) → brez žiga, brez padov ---"
agent-browser eval "(()=>{window.localStorage.setItem('roksal:recent-searches', JSON.stringify(['inox vijak','alu profil'])); return 'zapisano staro';})()" > /dev/null 2>&1
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
zapri_vodic
odpri_palet
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')].filter(e=>e.textContent.includes('inox vijak')||e.textContent.includes('alu profil')); if(items.length<2) return JSON.stringify({napaka:'zgodovina ni vidna',err:window.__err??null}); const zBadge=items.map(e=>e.textContent.includes('Nizka zaloga')); return JSON.stringify({vnosi:items.length,zigi:zBadge,pricakovano:[false,false],err:window.__err??null});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 2

echo "--- Z2 (P1-e): NOVA shema — vnos z žigom NOSI badge, brez žiga NE ---"
agent-browser eval "(()=>{window.localStorage.setItem('roksal:recent-searches', JSON.stringify([{q:'inox vijak',nizkaZaloga:true},{q:'alu profil'}])); return 'zapisano novo';})()" > /dev/null 2>&1
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
zapri_vodic
odpri_palet
agent-browser eval "(()=>{const zi=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('inox vijak')); const na=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('alu profil')); if(!zi||!na) return JSON.stringify({napaka:'vnosa mankata',err:window.__err??null}); const red=zi.querySelector('[class*=\"roksal-red\"]'); return JSON.stringify({ziBadge:zi.textContent.includes('Nizka zaloga'),ziRdeca:!!red,naBrezZiga:!na.textContent.includes('Nizka zaloga'),err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r218-zgodovina-badge.png" > /dev/null 2>&1
agent-browser press Escape > /dev/null 2>&1
sleep 2

echo "--- Z3 (P1-f): ISKREN števec 6 + 'Vse' vrstica → klik → Zaloga BREZ dialoga ---"
odpri_palet
agent-browser eval "(()=>{const h=[...document.querySelectorAll('[cmdk-group-heading]')].map(e=>e.textContent).find(t=>t.includes('Nizka zaloga')); const vse=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Pokaži vse s nizko zalogo v Zalogi')); return JSON.stringify({heading:h||null,stevec6:h?h.includes('6'):false,vseVrstica:!!vse,vseStevec:vse?vse.textContent.includes('6'):null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r218-vse-vrstica.png" > /dev/null 2>&1
agent-browser eval "(()=>{const vse=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Pokaži vse s nizko zalogo v Zalogi')); if(!vse) return 'ni Vse'; vse.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik Vse';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const dlg=[...document.querySelectorAll('[role=dialog]')].filter(d=>d.getAttribute('data-state')!=='closed'&&d.textContent.includes('Naročilnica kot osnutek naročila')); const pal=document.querySelector('[cmdk-root]'); return JSON.stringify({aktivniTab:cur?cur.textContent.trim():null,dialogOdprt:dlg.length>0,paletaZaprta:!pal,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z4 (P1-e ŽIVO zapis): Material hit z žigom → zgodovina dobi žig ---"
odpri_palet
agent-browser eval "(()=>{const inp=document.querySelector('[cmdk-input]'); if(!inp) return 'ni inputa'; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,'Inox'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno Inox';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const pal=document.querySelector('[cmdk-root]'); const m12=pal?[...pal.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Inox Vijak M12 A4')&&e.textContent.includes('Nizka zaloga')):null; if(!m12) return 'ni M12 z žigom'; m12.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik M12 (z žigom)';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); const cur=document.querySelector('nav button[aria-current=\"page\"]'); return JSON.stringify({r217regresija:!!dlg,istiArtikel:dlg?dlg.textContent.includes('Inox Vijak M12 A4'):false,aktivniTab:cur?cur.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči';} return 'ni';})()" > /dev/null 2>&1
sleep 2
odpri_palet
agent-browser eval "(()=>{const zi=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.trim().startsWith('Inox')&&!e.textContent.includes('Vijak')); const surovo=window.localStorage.getItem('roksal:recent-searches'); return JSON.stringify({zgodovinaInox:zi?zi.textContent.includes('Inox'):null,ziBadge:zi?zi.textContent.includes('Nizka zaloga'):null,shranjenoZig:surovo?surovo.includes('\"nizkaZaloga\":true'):null,surovo:surovo? surovo.slice(0,120):null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r218-zgodovina-zivo.png" > /dev/null 2>&1
agent-browser press Escape > /dev/null 2>&1
sleep 2

echo "--- Z5: RESTORE + regresija iskrenega števca (nizka = 1, brez 'Vse') ---"
node scripts/r218-min-tmp.cjs restore || { echo "RESTORE FAIL — ROČNO POPRAVI"; exit 1; }
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
zapri_vodic
odpri_palet
agent-browser eval "(()=>{const h=[...document.querySelectorAll('[cmdk-group-heading]')].map(e=>e.textContent).find(t=>t.includes('Nizka zaloga')); const vse=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Pokaži vse s nizko zalogo v Zalogi')); return JSON.stringify({heading:h||null,stevec1:h?h.includes('1'):false,vseNiVidna:!vse,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 1

echo "--- Z6: temna + health + odjava + port ---"
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
echo "--- R218 E2E KONEC ---"
