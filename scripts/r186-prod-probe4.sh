#!/bin/bash
# R186 probe4: POLNI obvezen navigacijski krog (nauček R184/R185) + 30 s vrata
# za seje fokus. dom 'Moji projekti' → 'Montažna orodja' → VizTab 'Domov' izhod
# → dashboard → 'Več' → Ekipa → team-tab chunk → lazy chunk → R185 needleji.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r186-probe
mkdir -p "$OUT"

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
echo "po prijavi: $(agent-browser eval "JSON.stringify({url: location.pathname, bodyLen: document.body.innerText.length})" 2>&1 | tail -1)"

echo "-- N1: 'Montažna orodja' → VizTab --"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t){t.click(); return true;} return false;})()" > /dev/null 2>&1
sleep 5
echo "-- N2: VizTab 'Domov' izhod → dashboard --"
for i in 1 2 3; do
  R=$(agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Domov'); if(d){d.click(); return 'izhod';} return 'ni Domov';})()" 2>&1 | tail -1)
  echo "izhod poskus $i: $R"
  [ "$R" = '"izhod"' ] && break
  sleep 2
done
sleep 4
echo "po izhodu: $(agent-browser eval "JSON.stringify({bodyLen: document.body.innerText.length, več: [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Več')})" 2>&1 | tail -1)"

echo "-- S0: meni → 'Aktivne seje' (pointerdown+click) --"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!g) return JSON.stringify({sprozilec:false}); g.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); g.click(); return JSON.stringify({sprozilec:true});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Aktivne seje')); if(m){m.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); m.click(); return true;} return false;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); if(!dlg) return JSON.stringify({dialog:false}); const p=[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({dialog:true, pecatSeje:p?p.textContent.trim():null, sejeVrstic:dlg.querySelectorAll('li').length});})()" 2>&1 | tail -1

echo "-- S1: čakanje 35 s (30 s vrata) → fokus → pečat SEJ se SPREMENI --"
PRES=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat seje PRE:  $PRES"
sleep 35
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus S1'" > /dev/null 2>&1
sleep 8
POSTS=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat seje POST: $POSTS"
[ -n "$PRES" ] && [ -n "$POSTS" ] && [ "$PRES" != "$POSTS" ] && echo "SEJE FOKUS DELTA: DOKAZANA (vedenjski refetch)" || echo "SEJE FOKUS DELTA: NI"

echo "-- zapri dialog --"
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const z=dlg?[...dlg.querySelectorAll('button')].find(b=>b.textContent.trim()==='Zapri'):null; if(z) z.click(); return !!z;})()" > /dev/null 2>&1
sleep 2

echo "-- E1: dashboard 'Več' → Ekipa (MONTER meja) --"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().includes('Ekipa')||b.textContent.trim().includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const ekipaGlava=document.body.innerText.includes('Ekipa — življenjski cikl računov'); const postnoStanje=document.body.innerText.includes('403')||document.body.innerText.includes('Prepovedano')||document.body.innerText.includes('ureja pisarna'); const panel=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); return JSON.stringify({ekipaGlavaVidna: ekipaGlava, postnoStanjeVidno: postnoStanje, panelADMINonlyViden: panel});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r186-ekipa-meja.png > /dev/null 2>&1 && echo "screenshot MEJA OK"

echo "-- BYTE: team-tab chunk → lazy panel chunk → R185 needleji --"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"' | tr ',' '\n' | tr -d '\\' | sed 's/^\[//; s/\]$//' | grep "_next" > "$OUT/chunks4.txt"
echo "naloženih chunkov (4. tek): $(wc -l < "$OUT/chunks4.txt")"
while read -r u; do
  f="$OUT/4-$(basename "$u")"
  curl -s "$u" -o "$f" 2>/dev/null
done < "$OUT/chunks4.txt"
TT=$(grep -l "Ekipa — življenjski" "$OUT"/4-*.js 2>/dev/null | head -1)
echo "team-tab chunk: ${TT:-NI NAJDEN}"
if [ -n "${TT:-}" ]; then
  grep -o '[0-9a-f]\{16\}' "$TT" | sort -u > "$OUT/tt-ids4.txt"
  : > "$OUT/manjkajoci4.txt"
  while read -r id; do
    grep -q "$id" "$OUT/chunks4.txt" || echo "$id" >> "$OUT/manjkajoci4.txt"
  done < "$OUT/tt-ids4.txt"
  echo "kandidatov za lazy chunk: $(wc -l < "$OUT/manjkajoci4.txt")"
  N1=0; N2=0; HITFILE=""
  while read -r id; do
    f="$OUT/lazy4-$id.js"
    curl -s "$PROD/_next/static/chunks/$id.js" -o "$f" 2>/dev/null
    if grep -q "Izvozi telemetrijo omejevanja hitrosti kot CSV" "$f" 2>/dev/null; then
      N1=$((N1+1)); HITFILE="$id"
    fi
    grep -q "Vzdrževanje — omejevanje hitrosti" "$f" 2>/dev/null && N2=$((N2+1))
  done < "$OUT/manjkajoci4.txt"
  echo "R185 needle 'Izvozi telemetrijo omejevanja hitrosti kot CSV': ${N1:-0} chunkov (v: ${HITFILE:--})"
  echo "R184 regresija 'Vzdrževanje — omejevanje hitrosti': ${N2:-0} chunkov"
  if [ -n "$HITFILE" ]; then
    echo "-- R185 F1/F2 strune v panel chunku --"
    grep -o 'Izvozi telemetrijo[^"]\{0,30\}' "$OUT/lazy4-$HITFILE.js" | head -1
  fi
  echo "-- R185 F2 'Zgrajeno' v katerem chunku? --"
  ZG=$(grep -l 'Zgrajeno' "$OUT"/4-*.js 2>/dev/null | head -2)
  for z in $ZG; do grep -o 'Zgrajeno [^"]\{0,50\}' "$z" | head -1; done
fi

agent-browser close --all > /dev/null 2>&1 || true
echo "R186 PROBE4 KONEC"
