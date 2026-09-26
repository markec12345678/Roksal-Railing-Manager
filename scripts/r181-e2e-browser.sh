#!/bin/bash
# R181 E2E EN KLIC — živostna družina na pod-površinah (ADMIN, standalone :3100):
#  D: Dokumenti → Prejemni zapisnik — pečat VIDEN + focus → čas se SPREMENI
#  J: Ekipa → Vzdrževanje (posli v ozadju) — pečat VIDEN + focus → čas se SPREMENI
#  Q: CRM → Ponudbe — sledenje — pečat VIDEN + focus → čas se SPREMENI
#  V: vodja regresija (R180 pečat še vedno živ)
#  T: temna tema + window.__err null
# Vzorec r180-e2e-vodja-racuni.sh; ⚠️ standalone RABI statiko — graditi z build.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r181-e2e-server.log 2>&1 < /dev/null &
sleep 5

echo "--- preflight ---"
curl -s -o /dev/null -w "login http: %{http_code}\n" http://127.0.0.1:3100/login
ss -tlnp 2>/dev/null | grep ':3100' | head -1 || echo "!!! 3100 NI poslušal"

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
echo "login page stanje: $(agent-browser eval "JSON.stringify({url: location.pathname, imaFormo: !!document.querySelector('input[type=email]'), text: document.body.innerText.slice(0,60)})" 2>&1 | tail -1)"
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
# Poišči pečat v kartici, katere glava se začne z iskano besedilo (h2/h3/div —
# CardTitle je različen element po površinah); plezanje po starših (največ 8).
PECAT_UL='(glava,limit=8)=>{const h=[...document.querySelectorAll("h2,h3,div,span")].find(e=>e.textContent.trim().startsWith(glava)); if(!h) return {najden:false}; let el=h,pecat=null,sken=0; while(el&&sken<limit&&!pecat){el=el.parentElement;sken++;if(el){pecat=[...el.querySelectorAll("span")].find(s=>s.textContent.trim().startsWith("Osveženo ob"));}} return {najden:true,pecat:pecat?pecat.textContent.trim():null};}'

echo "--- D: Dokumenti → Prejemni zapisnik (izberi projekt + pečat + focus) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/projects');const d=await r.json();if(!Array.isArray(d)||d.length===0)return 'BREZ PROJEKTOV';window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:d[0].id}));return 'projekt izbran: '+d.length;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('okument')||b.textContent.trim().includes('Dokumenti')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const r=(${PECAT_UL})('Prejemni zapisnik'); return JSON.stringify(r);})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus D'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const r=(${PECAT_UL})('Prejemni zapisnik'); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({...r, errorPaneli: err});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r181-zapisnik.png > /dev/null 2>&1 && echo "screenshot ZAPISNIK OK"

echo "--- J: Ekipa → Vzdrževanje (posli v ozadju) — pečat + focus ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().includes('Ekipa')||b.textContent.trim().includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const r=(${PECAT_UL})('Vzdrževanje — posli v ozadju'); return JSON.stringify(r);})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus J'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const r=(${PECAT_UL})('Vzdrževanje — posli v ozadju'); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({...r, errorPaneli: err});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r181-posli.png > /dev/null 2>&1 && echo "screenshot POSLI OK"

echo "--- Q: CRM → Ponudbe — sledenje — pečat + focus ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM')||b.textContent.trim().includes('CRM')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const r=(${PECAT_UL})('Ponudbe — sledenje'); return JSON.stringify(r);})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus Q'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const r=(${PECAT_UL})('Ponudbe — sledenje'); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({...r, errorPaneli: err});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r181-ponudbe.png > /dev/null 2>&1 && echo "screenshot PONUDBE OK"

echo "--- V: regresija — vodja pečat (R180) še vedno živ ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('vodjo')||b.textContent.trim().includes('Pregled za vodjo')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatVodja: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- T: temna tema (CRM pečati berljivi) + window.__err ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM')||b.textContent.trim().includes('CRM')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const pecati=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')); const barve=pecati.slice(0,3).map(p=>getComputedStyle(p).color); return JSON.stringify({pečatiVidni: pecati.length, barveTemna: barve, pageBg: getComputedStyle(document.body).backgroundColor});})()" 2>&1 | tail -1
agent-browser eval "JSON.stringify({err: window.__err ?? null})" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r181-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R181 E2E KONEC"
