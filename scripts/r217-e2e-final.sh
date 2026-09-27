#!/bin/bash
# R217 E2E FINAL — Z2 (fail-closed iskanje) + Z4 (R216 regresija) z
# samozdravilnim ponovnim odpiranjem/priavo (lekcija: headless brskalnik
# lahko resetira sejo sredi teka — about:blank, prosojno telo).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r217-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
setsid node .next/standalone/server.js > /tmp/R217-server-e2e3.log 2>&1 < /dev/null &
sleep 4

prijava() {
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
  agent-browser eval "(()=>{const h=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h){h.click(); return 'app';} return 'ni';})()" > /dev/null 2>&1
  sleep 5
}

echo "--- Z2: fail-closed — iskanje visokega artikla → navadna navigacija ---"
prijava
agent-browser eval "(async()=>{const inv=await (await fetch('/api/inventory')).json(); const nad=inv.filter(x=>x.kolicinaZaloga>x.minimalnaZaloga).sort((a,b)=>(b.kolicinaZaloga-b.minimalnaZaloga)-(a.kolicinaZaloga-a.minimalnaZaloga)||a.naziv.localeCompare(b.naziv)); window.__r217High={naziv:nad[0].naziv,sifra:nad[0].sifraMateriala}; window.__r217HighQ=nad[0].naziv.slice(0,13); return 'high: '+nad[0].naziv+' q='+window.__r217HighQ;})()" 2>&1 | tail -1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const i=document.querySelector('[cmdk-input]'); if(!i) return 'ni inputa'; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(i, window.__r217HighQ); i.dispatchEvent(new Event('input',{bubbles:true})); return 'tipal: '+window.__r217HighQ;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const item=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes(window.__r217High.sifra)); if(!item){const heads=[...document.querySelectorAll('[cmdk-group-heading]')].map(e=>e.textContent.trim()); const n=[...document.querySelectorAll('[cmdk-item]')].length; const empty=document.querySelector('[cmdk-empty]'); return 'NI zadetka (glave: '+heads.join('|')+' itemov:'+n+' prazno:'+(empty?empty.textContent.trim().slice(0,30):'—')+')';} const badge=item.textContent.includes('Nizka zaloga'); item.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'KLIK visok zadetek (brez badgea: '+(!badge)+')';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); return JSON.stringify({lokacija:location.pathname, aktivniTab:cur?cur.textContent.trim():null, osnutekDialog:!!dlg, brezDialoga:!dlg, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r217-e2e-visok-navadna.png" > /dev/null 2>&1

echo "--- Z4: regresija R216 — paleta skupina 'Nizka zaloga' (brez poizvedbe) ---"
prijava
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('· minimum')&&e.textContent.includes('Zaloga ')); if(!it) return 'ni vnosa nizke zaloge'; it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik skupina nizka zaloga';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); const m12=dlg?dlg.textContent.includes('Inox Vijak M12'):false; return JSON.stringify({osnutekDialog:!!dlg, istiArtikel:m12, aktivniTab:cur?cur.textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči (brez zapisa)';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z5: temna + health + port ---"
agent-browser eval "(()=>{const bg=getComputedStyle(document.body).backgroundColor; document.documentElement.classList.add('dark'); const tm=getComputedStyle(document.body).backgroundColor; document.documentElement.classList.remove('dark'); return JSON.stringify({svetla:bg, temna:tm, lokacija:location.pathname});})()" 2>&1 | tail -1
curl -s -m 10 "http://127.0.0.1:3100/api/public/health"; echo
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
REST=$(ss -tlnp 2>/dev/null | grep ':3100' | wc -l)
echo "PORT_3100_OSTANKI=$REST"
echo "=== KONEC r217-e2e-final ==="
