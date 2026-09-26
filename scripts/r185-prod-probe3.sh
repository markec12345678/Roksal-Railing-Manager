#!/bin/bash
# R185 produkcija probe3: Ekipa meja (MONTER, prek 'Več' menija; pripravljenost
# prek bodyLen pollinga) + team-tab chunk byte needleji.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r185-probe
mkdir -p "$OUT"

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1

echo "-- čakanje na naloženo lupino (bodyLen polling) --"
OK=0
for i in 1 2 3 4 5 6 7 8; do
  sleep 4
  LEN=$(agent-browser eval "document.body.innerText.length" 2>&1 | tail -1)
  VEC=$(agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); return !!v;})()" 2>&1 | tail -1)
  echo "poskus $i: bodyLen=$LEN vecDostopen=$VEC"
  [ "$VEC" = "true" ] && OK=1 && break
done
[ "$OK" = "1" ] || { echo "Več NI dostopen — INTERRUPTEd"; agent-browser close --all > /dev/null 2>&1 || true; exit 1; }

echo "-- Več → Ekipa (MONTER) — meja --"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); v.click(); return true;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().includes('Ekipa')||b.textContent.trim().includes('Življenjski cikl računov')); if(!t) return 'meniEkipa:false'; t.click(); return 'meniEkipa:true';})()" 2>&1 | tail -1
sleep 9
agent-browser eval "(()=>{const panel=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); const posli=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — posli v ozadju'); const glava=document.body.innerText.includes('Ekipa — življenjski cikl računov'); const text=document.body.innerText.slice(0,600); return JSON.stringify({panelADMINonly: panel, posliADMINonly: posli, ekipaGlava: glava, izpisk: text.slice(0,300)});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r185-ekipa-meja.png > /dev/null 2>&1 && echo "screenshot MEJA OK"

echo "-- BYTE: team-tab chunk → lazy panel chunk --"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"' | tr ',' '\n' | tr -d '\\' | sed 's/^\[//; s/\]$//' | grep "_next" > "$OUT/chunks3.txt"
echo "naloženih chunkov (3. tek): $(wc -l < "$OUT/chunks3.txt")"
while read -r u; do
  f="$OUT/3-$(basename "$u")"
  curl -s "$u" -o "$f" 2>/dev/null
done < "$OUT/chunks3.txt"
TT=$(grep -l "Ekipa — življenjski" "$OUT"/3-*.js 2>/dev/null | head -1)
echo "team-tab chunk: ${TT:-NI NAJDEN}"
if [ -n "${TT:-}" ]; then
  grep -o '[0-9a-f]\{16\}' "$TT" | sort -u > "$OUT/tt-ids3.txt"
  : > "$OUT/manjkajoci3.txt"
  while read -r id; do
    grep -q "$id" "$OUT/chunks3.txt" || echo "$id" >> "$OUT/manjkajoci3.txt"
  done < "$OUT/tt-ids3.txt"
  echo "kandidatov za lazy chunk: $(wc -l < "$OUT/manjkajoci3.txt")"
  N1=0; N2=0; HITFILE=""
  while read -r id; do
    f="$OUT/lazy3-$id.js"
    curl -s "$PROD/_next/static/chunks/$id.js" -o "$f" 2>/dev/null
    if grep -q "Vzdrževanje — omejevanje hitrosti" "$f" 2>/dev/null; then N1=$((N1+1)); HITFILE="$id"; fi
    grep -q "Telemetrije omejevanja hitrosti ni bilo mogoče naložiti" "$f" 2>/dev/null && N2=$((N2+1))
  done < "$OUT/manjkajoci3.txt"
  echo "R184 needle 'Vzdrževanje — omejevanje hitrosti': $N1 (chunk: ${HITFILE:--})"
  echo "R184 needle 'Telemetrije omejevanja hitrosti ni bilo mogoče naložiti': $N2"
  [ -n "$HITFILE" ] && grep -o 'Blokade brute-force zaščite[^"]*' "$OUT/lazy3-$HITFILE.js" | head -1
fi

agent-browser close --all > /dev/null 2>&1 || true
echo "R185 PROD PROBE3 KONEC"
