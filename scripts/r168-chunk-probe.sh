#!/bin/bash
# R168: byte-level deploy fingerprint — zberi VSE chunk URL-je iz žive seje,
# prenesi vsak in grep po ASCII iglah (R167 nauček: byte-verifikacija PRED sklepi).
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r168-chunks
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

# Zberi vse resource URL-je (performanca vnosi) iz žive seje na dashboardu
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"' | tr ',' '\n' | sed 's/^\[//;s/\]$//' > "$OUT"/chunk-urls.txt
echo "--- chunk URLs:"; wc -l < "$OUT"/chunk-urls.txt

# Prenesi vsak chunk
i=0
while read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1))
  curl -s "$url" -o "$OUT/chunk-$i.js"
done < "$OUT"/chunk-urls.txt
echo "--- prenesenih:"; ls "$OUT"/chunk-*.js 2>/dev/null | wc -l

echo "--- igle (ASCII-only, byte varne):"
for needle in "naslednjih 7 dni" "Samo moje termine" "Kopiraj podrobnosti termina" "Osve"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

# referenca iz prejšnjih rund (R159–R165 fingerprinti, morajo BITI):
for needle in "Izvozi prikazane projekte" "Izvozi prikazane stranke"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  REF [$needle] -> ${hits:-NIČ}"
done

# DOM preverba z unicode-escape em-dash (byte varno skozi pipeline):
echo "--- DOM preverba (unicode-escape):"
agent-browser eval "JSON.stringify({termini: document.body.innerText.includes('Termini \\u2014 naslednjih 7 dni'), naslednjih: document.body.innerText.includes('naslednjih 7 dni'), tabAktiven: !!document.querySelector('[role=\"tabpanel\"], .bg-card')})" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R168 CHUNK PROBE KONEC"
