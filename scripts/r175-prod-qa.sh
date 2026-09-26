#!/bin/bash
# R175 produkcija QA: spot-r165@roksal.si (MONTER, precedens R127).
# Odločilna preverba: ali sta R173 (push 14:26 UTC) + R174 (push ~14:42 UTC)
# ŽIVO na produkciji? Če R173 tudi 25+ min po pushu NI ŽIV = sistemski deploy
# problem → eskalacija lastniku (2 kavčkana deploya).
# Needleji:
#   R173: 'Ponovno naloži prodajno ploščo' (plošča chunk), 'vnosov preskočenih
#         (neveljaven vnos)' (termini-prikaz lib), 'Filtrirano na projekt' (log chunk)
#   R174: 'Ponovno naloži seznam ekipe' + 'Strežnik ni vrnil ekipe' (team chunk)
#   Regresija R166-R172: termini ICS/CSV/pečati/deljeni tekst.
# Popravek R174 probe napake: CRM focus delta merimo MEDTEM KO SMO NA CRM tabu
# (prvi focus dogodek — rate-limit ne ovira).
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r175-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

echo "--- N0: VizTab → 'Montažna orodja' → tab 'Domov' (R168 nauček) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6

echo "--- N1: Več → CRM stranke (plošča chunk) — brez error panelov ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM stranke')||b.textContent.trim().includes('CRM stranke')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const plosca=document.body.innerText.includes('Prodajna plošča'); const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({plosca, errPanel});})()" 2>&1 | tail -1

echo "--- N2: CRM focus delta NA TABU, PRVI dogodek (P1-c R173 ŽIVO) ---"
agent-browser eval "window.__r175Pre={c:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/crm')).length,p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaCrm: g('/api/crm')-(window.__r175Pre.c||0), deltaProjekti: g('/api/projects')-(window.__r175Pre.p||0)});})()" 2>&1 | tail -1

echo "--- N3: Več → Ekipa (team chunk, R174 needleji + DOM) ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const glava=document.body.innerText.includes('Ekipa'); const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].length; const seznam=document.body.innerText.includes('@roksal.si'); return JSON.stringify({glava, errPanel, seznam});})()" 2>&1 | tail -1

echo "--- N4: Več → Logistika (log chunk, R173 'Filtrirano na projekt') ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('Logistika')||b.textContent.trim().includes('Logistika V6')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7

echo "--- N5: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ringOffset=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset, err: window.__err || null});})()" 2>&1 | tail -1

echo "--- N6: chunk kolekcija + byte-dokaz R173/R174 + regresija ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
echo "--- R173 needle (NOVO) ---"
for needle in "Ponovno naloži prodajno ploščo" "vnosov preskočenih (neveljaven vnos)" "Filtrirano na projekt" "Izvoženo ob (čas zadnje osvežitve)"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done
echo "--- R174 needle (NOVO) ---"
for needle in "Ponovno naloži seznam ekipe" "Strežnik ni vrnil ekipe"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done
echo "--- regresija R166-R172 (morajo ostati NAJDENI) ---"
for needle in "Izvozi prikazane termine v koledarsko" "Koledarska datoteka izvožena" "Termini-7-dni_" "Izvozi prikazane termine v CSV" "CSV izvožen" "Osveženo ob" "naslednjih 7 dni" "Samo moje termine" "Kopiraj podrobnosti termina"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r175-prod.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R175 QA KONEC"
