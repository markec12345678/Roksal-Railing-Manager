#!/bin/bash
# R173 produkcija QA: spot-r165@roksal.si (MONTER, precedens R127).
# Cilj: R172 ŽIVO fingerprinti —
#   (a) byte-dokaz v produkcijskih chunkih: 'Termini-7-dni_' (.ics ime), 'Izvozi prikazane termine v koledarsko'
#       (aria-label ICS), 'Koledarska datoteka izvožena' (toast), 'Termini kartica' (PRODID);
#   (b) DOM: CalendarPlus gumb na Termini kartici (disabled brez podatkov — spot je prazen),
#       CSV gumb regresija, pečati 'Osveženo ob HH:MM:SS' (textContent — R170 nauček);
#   (c) refetch-on-focus za dashboard regresija (P1-b R171): delta /api/projects + /api/schedules;
#   (d) temna tema + ring-offset #0f1724 + konzola čista.
# Naučki: pot 'Montažna orodja' → 'Domov'; chunk kolekcija ŠELE po navigaciji;
#         pečat via textContent (innerText ga razbija po flex ovojnici); tr -d '"\\' ekstrakcija.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r173-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

echo "--- QA 1: VizTab → 'Montažna orodja' → tab 'Domov' (R168 nauček) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6

echo "--- QA 2: R172 fingerprinti v DOM (ICS gumb + CSV gumb + pečati via textContent) ---"
agent-browser eval "(()=>{const icsBtn=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane termine v koledarsko')); const csvBtn=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane termine v CSV')); const tc=document.body.textContent; const pecati=(tc.match(/Osve\\u017eeno ob \\d{2}:\\d{2}:\\d{2}/g)||[]); const kartica=tc.includes('Termini \\u2014 naslednjih 7 dni'); return JSON.stringify({kartica, icsGumb: !!icsBtn, icsAria: icsBtn ? icsBtn.getAttribute('aria-label') : null, icsDisabled: icsBtn ? icsBtn.disabled : null, csvGumb: !!csvBtn, csvDisabled: csvBtn ? csvBtn.disabled : null, pecati});})()" 2>&1 | tail -1

echo "--- QA 3: refetch-on-focus regresija za DASHBOARD: delta /api/projects + /api/schedules ---"
agent-browser eval "window.__r173Pre={p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length,s:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/schedules')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; const p=g('/api/projects'), s=g('/api/schedules'); return JSON.stringify({deltaProjekti: p-(window.__r173Pre.p||0), deltaSchedules: s-(window.__r173Pre.s||0)});})()" 2>&1 | tail -1

echo "--- QA 4: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ringOffset=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset, err: window.__err || null});})()" 2>&1 | tail -1

echo "--- QA 5: chunk kolekcija + byte-dokaz R172 + regresija (R166-R171) ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
echo "--- R172 needle (NOVO — morajo biti NAJDENI) ---"
for needle in "Izvozi prikazane termine v koledarsko" "Koledarska datoteka izvožena" "Termini kartica" "Termini-7-dni_"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done
echo "--- regresija R166-R171 (morajo ostati NAJDENI) ---"
for needle in "Termini-7-dni_" "Izvozi prikazane termine v CSV" "CSV izvožen" "Osveženo ob" "Skupaj " "predvideneUre" "naslednjih 7 dni" "Samo moje termine" "Kopiraj podrobnosti termina" "Vsota predvidenih ur vidnih terminov"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r173-prod.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R173 QA KONEC"
