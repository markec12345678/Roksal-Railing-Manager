#!/bin/bash
# R184 E2E EN KLIC — telemetrija omejevanja hitrosti + živostna družina 18 → 20 (ADMIN, standalone :3100):
#  A:  API dokaz — in-page fetch /api/security/rate-limit → 200 {stats, trips, note} (ADMIN seja)
#  E0: Več → Ekipa — panel 'Vzdrževanje — omejevanje hitrosti' + pečat + čipi + opomba + posli (R181 regresija)
#  E1: focus → pečat OMEJITVE se SPREMENI (vedenjski dokaz refetcha)
#  S0: meni → 'Aktivne seje' dialog — pečat v opisu VIDEN (20. površina)
#  S1: (po 30 s vrata) focus (dialog odprt) → pečat SEJ se SPREMENI (vedenjski)
#  V:  regresija — vodja pečat (R180) še vedno živ
#  T:  temna tema (Ekipa: panel + posli pečata berljivi) + window.__err null
# Vzorec r183-e2e-browser.sh; ⚠️ standalone RABI statiko — graditi z bun run build.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r184-e2e-server.log 2>&1 < /dev/null &
sleep 5

echo "--- preflight ---"
curl -s -o /dev/null -w "login http: %{http_code}\n" http://127.0.0.1:3100/login
ss -tlnp 2>/dev/null | grep ':3100' | head -1 || echo "!!! 3100 NI poslušal"

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6
echo "po prijavi: $(agent-browser eval "JSON.stringify({url: location.pathname, bodyLen: document.body.innerText.length})" 2>&1 | tail -1)"

for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
  sleep 4
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && echo "VizTab izhod OK (poskus $i)" && break
done

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- A: API dokaz — /api/security/rate-limit (ADMIN seja) ---"
agent-browser eval "fetch('/api/security/rate-limit').then(r=>r.json().then(j=>({status:r.status, keys:j.stats&&j.stats.keys, hits:j.stats&&j.stats.hits, tripsTotal:j.tripsTotal, tripsLen:Array.isArray(j.trips)?j.trips.length:null, note:(j.note||'').slice(0,40)}))).catch(e=>({status:'ERR',err:String(e).slice(0,60)}))" 2>&1 | tail -1
agent-browser eval "fetch('/api/security/rate-limit').then(r=>r.text()).then(t=>t.slice(0,0)+'h2') " > /dev/null 2>&1 || true

echo "--- E0: Več → Ekipa — panel omejitve + posli (R181 regresija) ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().includes('Ekipa')||b.textContent.trim().includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const glava=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); const pod=[...document.querySelectorAll('p span')].some(e=>e.textContent.includes('Blokade brute-force zaščite')); const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')); const chipi={kljuci:document.body.innerText.includes('aktivnih ključev'),zadetki:document.body.innerText.includes('zadetkov v oknih'),blokade:document.body.innerText.includes('blokad skupaj')}; const opomba=document.body.innerText.includes('trenutnega primerka'); const posli=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — posli v ozadju'); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({panelGlava:glava, podnaslov:pod, pecati:p.map(x=>x.textContent.trim()), chipi, poštenaOpomba:opomba, posliRegresija:posli, errorPaneli:err});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r184-panel.png > /dev/null 2>&1 && echo "screenshot PANEL OK"

echo "--- E1: focus → pečat OMEJITVE se SPREMENI (vedenjski refetch) ---"
PRE=$(agent-browser eval "(()=>{const hs=[...document.querySelectorAll('h3')].find(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); if(!hs) return null; const kartica=hs.closest('div.rounded-xl'); const p=kartica?[...kartica.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat omejitve PRE:  $PRE"
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus E1'" 2>&1 | tail -1
sleep 6
POST=$(agent-browser eval "(()=>{const hs=[...document.querySelectorAll('h3')].find(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); if(!hs) return null; const kartica=hs.closest('div.rounded-xl'); const p=kartica?[...kartica.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat omejitve POST: $POST"

echo "--- S0: meni → Aktivne seje — pečat v opisu VIDEN ---"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(g) g.click(); return !!g;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Aktivne seje')); if(m) m.click(); return !!m;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); if(!dlg) return JSON.stringify({dialog:false}); const p=dlg.querySelector('span.sm\\\\:flex')||[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const vrstice=dlg.querySelectorAll('li').length; return JSON.stringify({dialog:true, pecatSeje:p?p.textContent.trim():null, sejeVrstic:vrstice});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r184-seje.png > /dev/null 2>&1 && echo "screenshot SEJE OK"

echo "--- (30 s vrata FOKUS_MIN_INTERVAL_MS; dialog ostane odprt) ---"
sleep 31

echo "--- S1: focus (dialog odprt) → pečat SEJ se SPREMENI (vedenjski) ---"
PRES=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat seje PRE:  $PRES"
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus S1'" 2>&1 | tail -1
sleep 6
POSTS=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat seje POST: $POSTS"

echo "--- zapri dialog ---"
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const z=dlg?[...dlg.querySelectorAll('button')].find(b=>b.textContent.trim()==='Zapri'):null; if(z) z.click(); return !!z;})()" 2>&1 | tail -1
sleep 2

echo "--- V: regresija — vodja pečat (R180) še vedno živ ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('vodjo')||b.textContent.trim().includes('Pregled za vodjo')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatVodja: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- T: temna tema (Ekipa: panel + posli berljiva) + window.__err ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().includes('Ekipa')||b.textContent.trim().includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const barva=p?getComputedStyle(p).color:null; const glava=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); return JSON.stringify({panelVidenTemna: glava, pecatVidna: !!p, barvaTemna: barva, pageBg: getComputedStyle(document.body).backgroundColor});})()" 2>&1 | tail -1
agent-browser eval "JSON.stringify({err: window.__err ?? null})" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r184-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R184 E2E KONEC"
