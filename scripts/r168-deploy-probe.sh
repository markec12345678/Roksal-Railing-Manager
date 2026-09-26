#!/bin/bash
# R168: definitiven deploy fingerprint — pravi DASHBOARD tab (aria-label 'Domov'),
# potem DOM igle + chunk kolekcija po nalaganju dashboard-tab chunka.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r168-chunks2
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

echo "--- klik na DASHBOARD tab ('Domov'):"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"tab\"]')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'||(b.textContent||'').trim()==='Domov'); if(t) t.click(); return t?'klik OK':'NI najden';})()" 2>&1 | tail -1
sleep 8

echo "--- DOM igle na dashboard tabu (unicode-escape):"
agent-browser eval "JSON.stringify({terminiKartica: document.body.innerText.includes('Termini \\u2014 naslednjih 7 dni'), osvezi: !!document.querySelector('button[aria-label=\"Osve\\u017ei termine\"]'), samoMoje: !![...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Samo moje termine')||(b.textContent||'').includes('Samo moje termine')), kopiraj: [...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Kopiraj podrobnosti termina')).length, mojaMontaza: document.body.innerText.includes('Moja monta'), errorPanels: [...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,70))})" 2>&1 | tail -1

echo "--- chunk kolekcija PO dashboard nalaganju:"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"

echo "--- igle v chunkih (ASCII byte varne):"
for needle in "naslednjih 7 dni" "Samo moje termine" "Kopiraj podrobnosti termina" "Izvozi prikazane projekte" "Moja monta"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r168-dashboard.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R168 DEPLOY PROBE KONEC"
