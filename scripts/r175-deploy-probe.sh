#!/bin/bash
# R175 deploy-probe (robustni retry — 1. QA tek je flaknil na VizTab izhodu):
# pot Montažna orodja → Domov → CRM (focus) → Ekipa → Logistika → chunki.
# Kriterij: vsaj EN R173/R174 needle = deploy živ; vsi NIČ = kavček → eskalacija.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r175-chunks2
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 14

echo "--- P0: VizTab izhod z retry (do 3 poskusa) ---"
OKVIHOD=0
for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
  sleep 8
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  echo "  poskus $i: Domov viden=$DOMOV"
  if [ "$DOMOV" = "true" ]; then OKVIHOD=1; break; fi
done
if [ "$OKVIHOD" != "1" ]; then echo "VIZTAB IZHOD NEUSPEŠEN ×3"; agent-browser close --all > /dev/null 2>&1; echo "R175 PROBE KONEC (NEDELOUČEN)"; exit 1; fi

agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const tc=document.body.textContent; return JSON.stringify({dashboard: tc.includes('Termini')||tc.includes('Projekti'), temno: getComputedStyle(document.body).backgroundColor});})()" 2>&1 | tail -1

echo "--- P1: Več → CRM stranke + PRVI focus dogodek NA TABU ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM stranke')||b.textContent.trim().includes('CRM stranke')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const plosca=document.body.innerText.includes('Prodajna plošča'); const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({plosca, errPanel});})()" 2>&1 | tail -1
agent-browser eval "window.__r175Pre={c:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/crm')).length,p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaCrm: g('/api/crm')-(window.__r175Pre.c||0), deltaProjekti: g('/api/projects')-(window.__r175Pre.p||0)});})()" 2>&1 | tail -1

echo "--- P2: Več → Ekipa (R174 chunk) ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const glava=document.body.innerText.includes('Ekipa'); const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].length; const seznam=document.body.innerText.includes('@roksal.si'); return JSON.stringify({glava, errPanel, seznam});})()" 2>&1 | tail -1

echo "--- P3: Več → Logistika (R173 log chunk) ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('Logistika')||b.textContent.trim().includes('Logistika V6')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7

echo "--- P4: temna + ringOffset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ringOffset=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset, err: window.__err || null});})()" 2>&1 | tail -1

echo "--- P5: chunk kolekcija + needleji ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
echo "--- R173/R174 needle (odločilno) ---"
for needle in "Ponovno naloži prodajno ploščo" "vnosov preskočenih (neveljaven vnos)" "Filtrirano na projekt" "Ponovno naloži seznam ekipe" "Strežnik ni vrnil ekipe"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done
echo "--- regresija R166-R172 ---"
for needle in "Izvozi prikazane termine v koledarsko" "Koledarska datoteka izvožena" "Termini-7-dni_" "Izvozi prikazane termine v CSV" "CSV izvožen" "Osveženo ob" "naslednjih 7 dni" "Samo moje termine" "Kopiraj podrobnosti termina"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r175-probe.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R175 PROBE KONEC"
