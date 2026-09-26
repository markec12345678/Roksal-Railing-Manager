#!/bin/bash
# R169 produkcija QA: spot-r165@roksal.si (MONTER, precedens R127).
# (1) R168 deploy byte-dokaz: needle 'Skupaj '/'brez ure'/'preklicanega' v produkcijskih chunkih;
# (2) kartica Termini živa po pravilni poti ('Montažna orodja' → 'Domov' — R168 nauček);
# (3) prazno stanje iskreno (spot nima terminov na produkciji);
# (4) temna tema + konzola čista.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r169-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

echo "--- QA 1: izhod iz VizTab → 'Montažna orodja' → tab 'Domov' (R168 nauček) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6

echo "--- QA 2: kartica Termini + prazno stanje + toggle (R166/R167 fingerprinti) ---"
agent-browser eval "(()=>{const txt=document.body.innerText; const kartica=txt.includes('Termini \\u2014 naslednjih 7 dni'); const osvezi=!!document.querySelector('button[aria-label=\"Osve\\u017ei termine\"]'); const toggle=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Samo moje termine')); const prazno=txt.includes('Ni terminov v naslednjih 7 dneh.')||txt.includes('Ni va\\u0161ih terminov v naslednjih 7 dneh.'); const povzetek=txt.includes('Skupaj '); const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,70)); return JSON.stringify({kartica, osvezi, toggle: !!toggle, pressed: toggle?toggle.getAttribute('aria-pressed'):null, praznoStanje: prazno, povzetekViden: povzetek, errorPanels: alerts});})()" 2>&1 | tail -1

echo "--- QA 3: temna tema + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ringOffset=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset, err: window.__err || null});})()" 2>&1 | tail -1

echo "--- QA 4: chunk kolekcija + R168 needle byte-dokaz ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
for needle in "Skupaj " "brez ure" "preklicanega" "Samo preklicani termini" "predvideneUre" "naslednjih 7 dni"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r169-prod-dashboard.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R169 QA KONEC"
