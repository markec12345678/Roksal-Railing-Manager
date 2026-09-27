#!/bin/bash
# R217 E2E ŽIVO v2 (vzorec r206-r216): standalone :3100, ADMIN (ci@roksal.si).
# ZERO-MUTACIJSKI: lokalna baza (seed) IMA artikel pod minimumom
# (Inox Vijak M12 A4 15/50) — ni potrebe po PORABA/DOPOLNITEV paru
# (r217 lekcija: serIALIZACIJSKI 409 + drift tveganje; brez mutacij = čisto).
#  Z0 prijava + app chrome
#  Z1 KLJUČNI DOKAZ F1 (P1-d): iskanje → badge 'Nizka zaloga' → klik →
#     Zaloga aktiven + Osnutek dialog z TOČNO TIM artikelom (TRETJI signalec)
#  Z2 fail-closed: iskanje artikla NAD minimumom → navadna navigacija
#     (BREZ dialoga, BREZ lažnega badgea)
#  Z3 P1-f dostopnost: zvonček stock aria-label + Naroči 'Kopiraj' aria-label
#  Z4 regresija R216: paleta 'Nizka zaloga' SKUPINA (brez poizvedbe) → dialog
#  Z5 temna + health + port sproščen (brez čiščenja — 0 mutacij)
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
setsid node .next/standalone/server.js > /tmp/R217-server-e2e2.log 2>&1 < /dev/null &
sleep 4

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

echo "--- Z0: prijava ADMIN + app chrome ---"
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
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h){h.click(); return 'VizTab → app chrome';} return 'ni Hammer';})()" 2>&1 | tail -1
sleep 6

echo "--- Z1a: branje determinističnih ciljev (brez mutacij) ---"
agent-browser eval "(async()=>{const inv=await (await fetch('/api/inventory')).json(); const pod=inv.filter(x=>x.kolicinaZaloga<=x.minimalnaZaloga).sort((a,b)=>(a.kolicinaZaloga-a.minimalnaZaloga)-(b.kolicinaZaloga-b.minimalnaZaloga)||a.naziv.localeCompare(b.naziv)); if(!pod.length) return JSON.stringify({napaka:'brez artikla pod min — E2E ne more teči iskreno'}); const low=pod[0]; const nad=inv.filter(x=>x.kolicinaZaloga>x.minimalnaZaloga).sort((a,b)=>(b.kolicinaZaloga-b.minimalnaZaloga)-(a.kolicinaZaloga-a.minimalnaZaloga)||a.naziv.localeCompare(b.naziv)); const high=nad[0]; window.__r217Low={naziv:low.naziv,sifra:low.sifraMateriala}; window.__r217High={naziv:high.naziv,sifra:high.sifraMateriala}; return JSON.stringify({low:low.naziv+' ('+low.kolicinaZaloga+'/'+low.minimalnaZaloga+')', high:high.naziv+' ('+high.kolicinaZaloga+'/'+high.minimalnaZaloga+')'});})()" 2>&1 | tail -1

echo "--- Z1: F1 ŽIVO (P1-d) — iskanje → badge 'Nizka zaloga' → klik → dialog ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const i=document.querySelector('[cmdk-input]'); if(!i) return 'ni inputa'; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(i, window.__r217Low.naziv.slice(0,12)); i.dispatchEvent(new Event('input',{bubbles:true})); return 'tipal: '+window.__r217Low.naziv.slice(0,12);})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const item=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes(window.__r217Low.sifra)); if(!item) return 'NI zadetka s sifro'; const badge=item.textContent.includes('Nizka zaloga'); const podnapis=item.textContent.includes('· minimum'); const al=item.getAttribute('aria-label'); return JSON.stringify({zadetek:true, badge, podnapis, ariaLabel:al, besedilo:item.textContent.trim().slice(0,90)});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r217-e2e-iskanje-badge.png" > /dev/null 2>&1
agent-browser eval "(()=>{const item=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes(window.__r217Low.sifra)&&e.textContent.includes('Nizka zaloga')); if(!item) return 'NI zadetka z badgeom'; item.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'KLIK low zadetek (badge + deep-link)';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); const artikel=dlg&&window.__r217Low?dlg.textContent.includes(window.__r217Low.naziv):false; return JSON.stringify({aktivniTab:cur?cur.textContent.trim():null, osnutekDialog:!!dlg, istiArtikel:artikel, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r217-e2e-iskanje-deeplink-dialog.png" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči (brez zapisa)';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z2: fail-closed — iskanje visokega artikla → navadna navigacija ---"
# samozdravilno: ob reloadu je app nazaj na VizTab (nav ni v DOM) —
# Hamer 'Montažna orodja' + osvežitev ciljev (r217 v2 lekcija)
agent-browser eval "(()=>{const nav=document.querySelector('nav button'); if(nav) return 'nav ze'; const h=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h){h.click(); return 'Hamer ponovno';} return 'ni';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(async()=>{if(!window.__r217High){const inv=await (await fetch('/api/inventory')).json(); const nad=inv.filter(x=>x.kolicinaZaloga>x.minimalnaZaloga).sort((a,b)=>(b.kolicinaZaloga-b.minimalnaZaloga)-(a.kolicinaZaloga-a.minimalnaZaloga)||a.naziv.localeCompare(b.naziv)); window.__r217High={naziv:nad[0].naziv,sifra:nad[0].sifraMateriala};} return 'high: '+window.__r217High.naziv;})()" 2>&1 | tail -1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const i=document.querySelector('[cmdk-input]'); if(!i) return 'ni inputa'; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(i, window.__r217High.sifra); i.dispatchEvent(new Event('input',{bubbles:true})); return 'tipal sifro: '+window.__r217High.sifra;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const item=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes(window.__r217High.sifra)); if(!item){const heads=[...document.querySelectorAll('[cmdk-group-heading]')].map(e=>e.textContent.trim()); const n=[...document.querySelectorAll('[cmdk-item]')].length; return 'NI zadetka (glave: '+heads.join('|')+', itemov: '+n+')';} const badge=item.textContent.includes('Nizka zaloga'); item.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'KLIK visok zadetek (brez badgea: '+(!badge)+')';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); return JSON.stringify({aktivniTab:cur?cur.textContent.trim():null, osnutekDialog:!!dlg, brezDialoga:!dlg, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 2

echo "--- Z3: P1-f dostopnost — zvonček stock aria-label + Naroči aria-label ---"
agent-browser eval "(async()=>{if(!window.__r217Low){const inv=await (await fetch('/api/inventory')).json(); const pod=inv.filter(x=>x.kolicinaZaloga<=x.minimalnaZaloga).sort((a,b)=>(a.kolicinaZaloga-a.minimalnaZaloga)-(b.kolicinaZaloga-b.minimalnaZaloga)||a.naziv.localeCompare(b.naziv)); window.__r217Low={naziv:pod[0].naziv,sifra:pod[0].sifraMateriala};} return 'low: '+window.__r217Low.naziv;})()" 2>&1 | tail -1
agent-browser eval "(()=>{const zv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(zv){zv.click(); return 'zvonček';} return 'ni zvoncka';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const stock=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Naroči material')&&b.textContent.includes(window.__r217Low.naziv)); if(!stock) return JSON.stringify({stockViden:false}); return JSON.stringify({stockViden:true, ariaLabel:stock.getAttribute('aria-label')});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const z=[...document.querySelectorAll('nav button,a')].find(b=>b.textContent.trim().startsWith('Zaloga')); if(z){z.click(); return 'klik Zaloga';} return 'ni';})()" > /dev/null 2>&1
sleep 6
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Kopiraj naročilnico za artikel')); return JSON.stringify({narociAriaLabel:!!g, vzorec:g?g.getAttribute('aria-label').slice(0,70):null});})()" 2>&1 | tail -1

echo "--- Z4: regresija R216 — paleta skupina 'Nizka zaloga' (brez poizvedbe) ---"
agent-browser eval "(()=>{if(!window.__r217Low) return 'nizke zaloge globals manjkajo'; return 'globals ok';})()" > /dev/null 2>&1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('· minimum')&&e.textContent.includes('Zaloga ')); if(!it) return 'ni vnosa nizke zaloge'; it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik skupina nizka zaloga';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); const artikel=dlg&&window.__r217Low?dlg.textContent.includes(window.__r217Low.naziv):(dlg&&dlg.textContent.includes('Inox Vijak M12')); return JSON.stringify({osnutekDialog:!!dlg, istiArtikel:artikel, aktivniTab:cur?cur.textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z5: temna + health + port (0 mutacij — brez čiščenja) ---"
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); const bg=getComputedStyle(document.body).backgroundColor; document.documentElement.classList.remove('dark'); return 'temna bg: '+bg;})()" 2>&1 | tail -1
agent-browser eval "window.__err ?? 'err-null'" 2>&1 | tail -1
curl -s -m 10 "http://127.0.0.1:3100/api/public/health"; echo
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
REST=$(ss -tlnp 2>/dev/null | grep ':3100' | wc -l)
echo "PORT_3100_OSTANKI=$REST"
echo "=== KONEC r217-e2e-browser v2 ==="
