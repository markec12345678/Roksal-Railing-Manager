#!/bin/bash
# R172 produkcija QA: spot-r165@roksal.si (MONTER, precedens R127).
# Cilj: R171 ŽIVO fingerprinti —
#   (a) byte-dokaz v produkcijskih chunkih: 'Termini-7-dni_' (ime datoteke),
#       'Izvozi prikazane termine v CSV' (aria-label), 'CSV izvožen' (toast),
#       'Izvoženo ob' (CSV metapodatki) + regresija (R166-R170 needle);
#   (b) DOM: FileDown gumb na Termini kartici (disabled brez podatkov — spot je prazen),
#       pečat 'Osveženo ob HH:MM:SS' na Termini + Projekti glavi (textContent — R170 nauček);
#   (c) refetch-on-focus za dashboard (P1-b R171): delta /api/projects + /api/schedules;
#   (d) temna tema + ring-offset #0f1724 + konzola čista.
# Naučki: pot 'Montažna orodja' → 'Domov'; chunk kolekcija ŠELE po navigaciji;
#         pečat via textContent (innerText ga razbija po flex ovojnici); tr -d '"\\' ekstrakcija.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r172-chunks
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

echo "--- QA 2: R171 fingerprinti v DOM (CSV gumb + oba pečata via textContent) ---"
agent-browser eval "(()=>{const csvBtn=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane termine v CSV')); const tc=document.body.textContent; const pecatT=(tc.match(/Osve\\u017eeno ob \\d{2}:\\d{2}:\\d{2}/)||[''])[0]; const projektiPecat=(tc.match(/Osve\\u017eeno ob \\d{2}:\\d{2}:\\d{2}/g)||[]).length; const kartica=tc.includes('Termini \\u2014 naslednjih 7 dni'); return JSON.stringify({kartica, csvGumb: !!csvBtn, csvAriaLabel: csvBtn ? csvBtn.getAttribute('aria-label') : null, csvDisabled: csvBtn ? csvBtn.disabled : null, pecat: pecatT, pecatPonovitev: projektiPecat});})()" 2>&1 | tail -1

echo "--- QA 3: refetch-on-focus za DASHBOARD (P1-b R171): delta /api/projects + /api/schedules ---"
agent-browser eval "window.__r172Pre={p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length,s:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/schedules')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; const p=g('/api/projects'), s=g('/api/schedules'); return JSON.stringify({deltaProjekti: p-(window.__r172Pre.p||0), deltaSchedules: s-(window.__r172Pre.s||0)});})()" 2>&1 | tail -1

echo "--- QA 4: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ringOffset=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset, err: window.__err || null});})()" 2>&1 | tail -1

echo "--- QA 5: chunk kolekcija + byte-dokaz R171 + regresija (R166-R170) ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
echo "--- R171 needle (NOVO — morajo biti NAJDENI) ---"
for needle in "Termini-7-dni_" "Izvozi prikazane termine v CSV" "CSV izvožen" "Izvoženo ob"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done
echo "--- regresija R166-R170 (morajo ostati NAJDENI) ---"
for needle in "Osveženo ob" "Skupaj " "predvideneUre" "naslednjih 7 dni" "Samo moje termine" "Kopiraj podrobnosti termina" "Vsota predvidenih ur vidnih terminov"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r172-prod.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R172 QA KONEC"
