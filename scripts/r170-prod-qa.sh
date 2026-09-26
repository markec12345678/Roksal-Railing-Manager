#!/bin/bash
# R170 produkcija QA: spot-r165@roksal.si (MONTER, precedens R127).
# (1) R168+R169 deploy byte-dokaz: needle v produkcijskih chunkih (kolekcija ŠELE po obisku obeh površin — R168 nauček);
# (2) dashboard Termini kartica po pravilni poti ('Montažna orodja' → 'Domov');
# (3) Logistika V6 → Koledar: R169 povzetek / iskreno prazno stanje (spot brez terminov na produkciji);
# (4) temna tema + ring-offset #0f1724 (R168 halo fix živo) + konzola čista.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r170-chunks
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

echo "--- QA 2: dashboard Termini kartica + povzetek/prazno stanje ---"
agent-browser eval "(()=>{const txt=document.body.innerText; const kartica=txt.includes('Termini \\u2014 naslednjih 7 dni'); const osvezi=!!document.querySelector('button[aria-label=\"Osve\\u017ei termine\"]'); const prazno=txt.includes('Ni terminov v naslednjih 7 dneh.')||txt.includes('Ni va\\u0161ih terminov v naslednjih 7 dneh.'); const povzetek=txt.includes('Skupaj '); const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,70)); return JSON.stringify({kartica, osvezi, praznoStanje: prazno, povzetekViden: povzetek, errorPanels: alerts});})()" 2>&1 | tail -1

echo "--- QA 3: temna tema + ring-offset (R168 halo fix ŽIVO?) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ringOffset=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset, err: window.__err || null});})()" 2>&1 | tail -1

echo "--- QA 4: 'Več' → 'Logistika V6' → Koledar (R169 povzetek / prazno) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Več'||b.textContent.trim()==='Več'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('Logistika')||b.textContent.trim().includes('Logistika V6')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 8
agent-browser eval "(()=>{const tabs=[...document.querySelectorAll('[role=\"tab\"],button')].map(b=>b.textContent.trim()).filter(x=>x&&x.length<30); return JSON.stringify(tabs.slice(0,24));})()" 2>&1 | tail -1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[role=\"tab\"],button')].find(b=>b.textContent.trim()==='Koledar'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const txt=document.body.innerText; const povzetek=txt.includes('Skupaj '); const title=!!document.querySelector('[title=\"Vsota predvidenih ur vidnih terminov (preklicani so izklju\\u010deni)\"]'); const prazno=txt.includes('Ni terminov')||txt.includes('brez terminov'); const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,70)); return JSON.stringify({koledarPovzetekViden: povzetek, titleZiv: title, praznoOmenjeno: prazno, errorPanels: alerts});})()" 2>&1 | tail -1

echo "--- QA 5: chunk kolekcija + byte-dokaz (R168 + R169 needle) ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
for needle in "Skupaj " "predvideneUre" "brez ure" "preklicanega" "Samo preklicani termini" "Vsota predvidenih ur vidnih terminov" "vnos preskočen" "naslednjih 7 dni"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r170-prod.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R170 QA KONEC"
