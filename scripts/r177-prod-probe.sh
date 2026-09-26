#!/bin/bash
# R177 produkcija probe: R176 ŽIVO? (push 15:22:21 UTC; deploy 15-40 min —
# ob startu runde še NI bil živ; ta probe teče na koncu runde).
# R176 je bil čist refactor (stabilni loaderji) — brez novih stringov; finger-
# print je VEDENJSKI: focus delta na Dokumenti + Varnost (hook R176 na
# produkciji). Byte regresija: R175 + R174 needleji.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r177-probe
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 14

# VizTab izhod z retry (nauček R175 flake):
OKVIHOD=0
for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
  sleep 8
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && OKVIHOD=1 && break
done
[ "$OKVIHOD" != "1" ] && { echo "VIZTAB IZHOD NEUSPEŠEN ×3"; agent-browser close --all > /dev/null 2>&1; echo "R177 PROBE KONEC (NEDELOUČEN)"; exit 1; }

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- D-probe: Več → Dokumenti — focus delta (R176 hook na produkciji) ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Dokumenti'||b.textContent.trim().includes('Dokumenti')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "window.__p={d:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/documents')).length,p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaDokumenti: g('/api/documents')-(window.__p.d||0), deltaProjekti: g('/api/projects')-(window.__p.p||0)});})()" 2>&1 | tail -1

echo "--- W-probe: Več → Varnost — focus delta (R176 hook na produkciji) ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Varnost'||b.textContent.trim().includes('Varnost')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "window.__pw=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/weather')).length; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/weather')).length; return JSON.stringify({deltaWeather: g-(window.__pw||0)});})()" 2>&1 | tail -1

echo "--- chunki + byte regresija ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
for needle in "Seznam projektov ni bil naložen" "Ponovno naloži zalogo" "Ponovno naloži seznam ekipe" "Izvozi prikazane termine v koledarsko" "Osveženo ob"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r177-probe.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R177 PROBE KONEC"
