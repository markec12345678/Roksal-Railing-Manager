#!/bin/bash
# R176 mikro-probe: R175 ŽIVO na produkciji (push 15:07:18 UTC; deploy ~40 min —
# ob startu runde ~15:08 še NI bil živ; ta probe teče na koncu runde).
# R175 needleji: 'Seznam projektov ni bil naložen' (zaloga fail-verbose,
# NOVO v R175), 'Ponovno naloži seznam ekipe' (R174, regresija).
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r176-mikro
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
[ "$OKVIHOD" != "1" ] && { echo "VIZTAB IZHOD NEUSPEŠEN ×3"; agent-browser close --all > /dev/null 2>&1; echo "R176 MIKRO KONEC (NEDELOUČEN)"; exit 1; }

# Več → Ekipa (MONTER: poštno stanje brez lažnega alarma — R175 fix fingerprint!)
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
echo "--- Ekipa kot MONTER: poštno stanje (R175 fix) ---"
agent-browser eval "(()=>{const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].length; const lazniAlarm=document.body.innerText.includes('Strežnik ni vrnil ekipe'); const postno=document.body.innerText.includes('Ekipa — ureja pisarna'); return JSON.stringify({errPanel, lazniAlarm, postnoStanje: postno});})()" 2>&1 | tail -1

echo "--- chunki + needleji ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
echo "--- R175 needle (NOVO) ---"
for needle in "Seznam projektov ni bil naložen" "Ponovno naloži seznam ekipe"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done
echo "--- regresija R174 (morajo ostati NAJDENI) ---"
for needle in "Strežnik ni vrnil ekipe" "Izvozi prikazane termine v koledarsko" "Osveženo ob"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r176-mikro.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R176 MIKRO KONEC"
