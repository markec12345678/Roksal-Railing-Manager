#!/bin/bash
# R174 produkcija QA: spot-r165@roksal.si (MONTER, precedens R127).
# Cilj: R173 ŽIVO fingerprinti —
#   (a) byte-dokaz v produkcijskih chunkih: 'Filtrirano na projekt' (CSV Obseg),
#       'Izvoženo ob (čas zadnje osvežitve)' (CSV pečat), 'Ponovno naloži prodajno
#       ploščo' (aria-label Poskusi znova), 'vnosov preskočenih (neveljaven vnos)'
#       (Razsirjen priponka);
#   (b) DOM: Več → CRM stranke — plošča + seznam naložena, NIČ error panelov;
#   (c) refetch-on-focus CRM + plošča (P1-c R173): delta /api/crm + /api/projects;
#   (d) temna tema + ring-offset #0f1724 + konzola čista + regresija R166-R172.
# Naučki: pot 'Montažna orodja' → 'Več'; chunk kolekcija ŠELE po navigaciji;
#         textContent pečat; tr -d '"\\' ekstrakcija.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r174-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

echo "--- QA 1: VizTab → 'Montažna orodja' → 'Več' → 'CRM stranke' ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM stranke')||b.textContent.trim().includes('CRM stranke')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5

echo "--- QA 2: CRM + plošča naložena, NIČ error panelov (fail-verbose ne pokvari) ---"
agent-browser eval "(()=>{const plosca=document.body.innerText.includes('Prodajna plošča'); const crmGlava=document.body.innerText.includes('CRM'); const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].map(x=>x.textContent.slice(0,60)); return JSON.stringify({plosca, crmGlava, errPanel});})()" 2>&1 | tail -1

echo "--- QA 3: refetch-on-focus CRM + plošča (P1-c R173 ŽIVO): delta /api/crm + /api/projects ---"
agent-browser eval "window.__r174Pre={c:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/crm')).length,p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaCrm: g('/api/crm')-(window.__r174Pre.c||0), deltaProjekti: g('/api/projects')-(window.__r174Pre.p||0)});})()" 2>&1 | tail -1

echo "--- QA 4: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ringOffset=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset, err: window.__err || null});})()" 2>&1 | tail -1

echo "--- QA 5: chunk kolekcija + byte-dokaz R173 + regresija (R166-R172) ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
echo "--- R173 needle (NOVO — morajo biti NAJDENI) ---"
for needle in "Filtrirano na projekt" "Izvoženo ob (čas zadnje osvežitve)" "Ponovno naloži prodajno ploščo" "vnosov preskočenih (neveljaven vnos)"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done
echo "--- regresija R166-R172 (morajo ostati NAJDENI) ---"
for needle in "Izvozi prikazane termine v koledarsko" "Koledarska datoteka izvožena" "Termini kartica" "Termini-7-dni_" "Izvozi prikazane termine v CSV" "CSV izvožen" "Osveženo ob" "naslednjih 7 dni" "Samo moje termine" "Kopiraj podrobnosti termina" "Vsota predvidenih ur vidnih terminov"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r174-prod.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R174 QA KONEC"
