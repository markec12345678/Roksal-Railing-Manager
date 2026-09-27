#!/bin/bash
# R185 produkcija probe2: dopolni r185-prod-probe.sh — (a) seje dialog (MONTER,
# menjni preverjen), (b) Ekipa meja prek 'Več' menija + team-tab chunk byte.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r185-probe
mkdir -p "$OUT"

echo "--- MONTER prijava (ponovno, čista seja) ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
echo "po prijavi: $(agent-browser eval "JSON.stringify({url: location.pathname, bodyLen: document.body.innerText.length})()" 2>&1 | tail -1)"

echo "-- S0fix: meni → 'Aktivne seje' (preverjeno odpiranje menija) --"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!g) return JSON.stringify({sprozilec:false, meni:false}); g.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); g.click(); return JSON.stringify({sprozilec:true});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const meni=[...document.querySelectorAll('[role=\"menu\"]')].length; const items=[...document.querySelectorAll('[role=\"menuitem\"]')].map(x=>x.textContent.trim().slice(0,20)); return JSON.stringify({meni, itemsN: items.length, items: items.slice(0,8)});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Aktivne seje')); if(m){m.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); m.click(); return true;} return false;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); if(!dlg) return JSON.stringify({dialog:false}); const p=[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const vrstice=dlg.querySelectorAll('li').length; const flexwrap=!!dlg.querySelector('span.sm\\\\:flex'); return JSON.stringify({dialog:true, pecatSeje:p?p.textContent.trim():null, sejeVrstic:vrstice, flexwrapVrstica:flexwrap});})()" 2>&1 | tail -1

echo "-- S1fix: fokus (dialog odprt) → pečat SEJ se SPREMENI --"
PRES=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat seje PRE:  $PRES"
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus S1'" > /dev/null 2>&1
sleep 7
POSTS=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat seje POST: $POSTS"
[ -n "$PRES" ] && [ -n "$POSTS" ] && [ "$PRES" != "$POSTS" ] && echo "SEJE FOKUS DELTA: DOKAZANA" || echo "SEJE FOKUS DELTA: NI"

echo "-- zapri dialog --"
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const z=dlg?[...dlg.querySelectorAll('button')].find(b=>b.textContent.trim()==='Zapri'):null; if(z) z.click(); return !!z;})()" > /dev/null 2>&1
sleep 2

echo "-- E0fix: Več → Ekipa (MONTER) — meja ADMIN-only --"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().includes('Ekipa')||b.textContent.trim().includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 8
agent-browser eval "(()=>{const panel=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); const posliPanel=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — posli v ozadju'); const ekipaGlava=document.body.innerText.includes('Ekipa — življenjski cikl računov'); const postnoStanje=document.body.innerText.includes('403')||document.body.innerText.includes('Prepovedano'); return JSON.stringify({panelADMINonlyViden: panel, posliPanelViden: posliPanel, ekipaGlavaVidna: ekipaGlava, postnoStanjeVidno: postnoStanje});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r185-ekipa-meja.png > /dev/null 2>&1 && echo "screenshot MEJA OK"

echo "-- BYTE: team-tab chunk → lazy panel chunk needleji --"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"' | tr ',' '\n' | tr -d '\\' | sed 's/^\[//; s/\]$//' | grep "_next" > "$OUT/chunks2.txt"
echo "naloženih chunkov (2. tek): $(wc -l < "$OUT/chunks2.txt")"
while read -r u; do
  f="$OUT/2-$(basename "$u")"
  curl -s "$u" -o "$f" 2>/dev/null
done < "$OUT/chunks2.txt"
TT=$(grep -l "Ekipa — življenjski" "$OUT"/2-*.js 2>/dev/null | head -1)
echo "team-tab chunk: ${TT:-NI NAJDEN}"
if [ -n "${TT:-}" ]; then
  grep -o '[0-9a-f]\{16\}' "$TT" | sort -u > "$OUT/tt-ids.txt"
  : > "$OUT/manjkajoci2.txt"
  while read -r id; do
    if ! grep -q "$id" "$OUT/chunks2.txt"; then
      echo "$id" >> "$OUT/manjkajoci2.txt"
    fi
  done < "$OUT/tt-ids.txt"
  echo "kandidatov za lazy chunk: $(wc -l < "$OUT/manjkajoci2.txt")"
  N1=0; N2=0; HITFILE=""
  while read -r id; do
    f="$OUT/lazy2-$id.js"
    curl -s "$PROD/_next/static/chunks/$id.js" -o "$f" 2>/dev/null
    if grep -q "Vzdrževanje — omejevanje hitrosti" "$f" 2>/dev/null; then
      N1=$((N1+1)); HITFILE="$id"
    fi
    grep -q "Telemetrije omejevanja hitrosti ni bilo mogoče naložiti" "$f" 2>/dev/null && N2=$((N2+1))
  done < "$OUT/manjkajoci2.txt"
  echo "R184 needle 'Vzdrževanje — omejevanje hitrosti': $N1 chunkov (v: ${HITFILE:--})"
  echo "R184 needle 'Telemetrije omejevanja hitrosti ni bilo mogoče naložiti': $N2 chunkov"
  [ -n "$HITFILE" ] && grep -o 'Blokade brute-force zaščite[^"]*' "$OUT/lazy2-$HITFILE.js" | head -1
else
  echo "team-tab chunk NI bil naložen — API 403 dokaz kompenzira"
fi

agent-browser close --all > /dev/null 2>&1 || true
echo "R185 PROD PROBE2 KONEC"
