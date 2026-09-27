#!/bin/bash
# R217 FINAL v3 — odporni harness (vodič-ponovitve + paleta-retry), brez premikov.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R217-server-final3.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

echo "--- Z0: prijava + vodič + app ---"
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
zapri_vodic() {
  for i in 1 2 3 4 5; do
    agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
    sleep 1
  done
}
zapri_vodic
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h){h.click(); return 'Hammer klik';} return 'že v app (ni Hammer)';})()" 2>&1 | tail -1
sleep 6
zapri_vodic

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
tipaj() {
  agent-browser eval "(()=>{const inp=document.querySelector('[cmdk-input]'); if(!inp) return 'ni inputa'; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,'Inox'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno Inox';})()" 2>&1 | tail -1
  sleep 5
}

echo "--- Z1: badge hit (M12) → klik → Zaloga + Osnutek dialog ---"
odpri_palet && tipaj
agent-browser eval "(()=>{const pal=document.querySelector('[cmdk-root]'); const m12=pal?[...pal.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Inox Vijak M12 A4')):null; const m8=pal?[...pal.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Inox Vijak M8 A2')):null; return JSON.stringify({m12Zadetek:!!m12,m12Badge:m12?m12.textContent.includes('Nizka zaloga'):null,m12Aria:m12?m12.getAttribute('aria-label'):null,m12Podnapis:m12?m12.textContent.includes('· minimum'):null,m8Badge:m8?m8.textContent.includes('Nizka zaloga'):null,m8BrezAria:m8?(m8.getAttribute('aria-label')===null):null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r217-final3-iskanje-badge.png" > /dev/null 2>&1
agent-browser eval "(()=>{const pal=document.querySelector('[cmdk-root]'); const m12=pal?[...pal.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Inox Vijak M12 A4')):null; if(!m12) return 'ni M12'; m12.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik M12';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); const pal=document.querySelector('[cmdk-root]'); const cur=document.querySelector('nav button[aria-current=\"page\"]'); return JSON.stringify({osnutekDialogOdprt:!!dlg,istiArtikel:dlg?dlg.textContent.includes('Inox Vijak M12 A4'):false,paletaZaprta:!pal,aktivniTab:cur?cur.textContent.trim():null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r217-final3-osnutek-dialog.png" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z2: fail-closed (M8 hit brez badgea) → Zaloga brez dialoga ---"
odpri_palet && tipaj
agent-browser eval "(()=>{const pal=document.querySelector('[cmdk-root]'); const m8=pal?[...pal.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Inox Vijak M8 A2')):null; if(!m8) return 'ni M8'; m8.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik M8';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); const cur=document.querySelector('nav button[aria-current=\"page\"]'); return JSON.stringify({osnutekDialogOdprt:!!dlg,aktivniTab:cur?cur.textContent.trim():null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z3: regresija — skupina 'Nizka zaloga' klik → dialog ponovno ---"
odpri_palet
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('· minimum')&&e.textContent.includes('Zaloga ')); if(!it) return 'ni vnosa skupine'; it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik skupina';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); const cur=document.querySelector('nav button[aria-current=\"page\"]'); return JSON.stringify({osnutekDialogOdprt:!!dlg,istiArtikel:dlg?dlg.textContent.includes('Inox Vijak M12 A4'):false,aktivniTab:cur?cur.textContent.trim():null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r217-final3-regresija.png" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z4: ostanki + temna + health + odjava + port ---"
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); return JSON.stringify({skupaj:(vsi||[]).length,testniAktivniOstanki:(vsi||[]).filter(o=>(o.status==='OSNUTEK'||o.status==='POSLANO')&&(o.opombe||'').includes('E2E')).length});})()" 2>&1 | tail -1
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
echo "--- R217 FINAL v3 KONEC ---"
