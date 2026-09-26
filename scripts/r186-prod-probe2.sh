#!/bin/bash
# R186 probe2: dopolni r186-prod-probe.sh — (a) seje dialog (diagnostika menija),
# (b) Ekipa tab (diagnostika navigacije) → team-tab chunk → lazy chunk → R185
# izvoz needle. Vzorec R185 probe2/probe3.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r186-probe2
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/*.txt

echo "--- MONTER prijava ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

echo "-- D0: diagnostika — ali smo prijavljeni? kateri gumbi? --"
agent-browser eval "JSON.stringify({url: location.pathname, bodyLen: document.body.innerText.length, tabi: [...document.querySelectorAll('nav button, [role=tablist] button')].map(b=>b.textContent.trim()).slice(0,12)})" 2>&1 | tail -1

echo "-- D1: Ekipa tab — poskus 1: 'Montažna orodja' povezava --"
agent-browser eval "(()=>{const c=[...document.querySelectorAll('button,a')].map(b=>({t:(b.textContent||'').trim().slice(0,30), a:b.getAttribute('aria-label')})); return JSON.stringify(c.filter(x=>(x.t||'').includes('Montažn')||(x.a||'').includes('Montažn')||(x.t||'').includes('Ekipa')||(x.a||'').includes('Ekipa')).slice(0,8));})()" 2>&1 | tail -1

agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')||b.textContent.trim().startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 4
echo "-- D2: po 'Montažna orodja' — katere zavihke vidim? --"
agent-browser eval "(()=>{const k=[...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(t=>t&&t.length<20); return JSON.stringify(k.slice(0,25));})()" 2>&1 | tail -1

echo "-- D3: klik Ekipa (zanka ×3) --"
for i in 1 2 3; do
  OK=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='Ekipa'); if(t){t.click(); return 'kliknil';} return 'ni ga';})()" 2>&1 | tail -1)
  echo "poskus $i: $OK"
  [ "$OK" = "kliknil" ] && break
  sleep 2
done
sleep 7

echo "-- D4: Ekipa glava + team-tab chunk naložen? --"
agent-browser eval "(()=>{const glave=[...document.querySelectorAll('h1,h2,h3')].map(e=>e.textContent.trim()).slice(0,8); const panel=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); return JSON.stringify({glave, panelViden: panel});})()" 2>&1 | tail -1
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"' | tr ',' '\n' | tr -d '\\' | sed 's/^\[//; s/\]$//' | grep "_next" > "$OUT/app-chunks.txt"
echo "naloženih chunkov: $(wc -l < "$OUT/app-chunks.txt")"

while read -r u; do
  f="$OUT/$(basename "$u")"
  curl -s "$u" -o "$f" 2>/dev/null
done < "$OUT/app-chunks.txt"

TT=$(grep -l "Ekipa — življenjski" "$OUT"/*.js 2>/dev/null | head -1)
echo "team-tab chunk: ${TT:-NI NAJDEN}"
if [ -n "${TT:-}" ]; then
  grep -o '[0-9a-f]\{16\}' "$TT" | sort -u > "$OUT/tt-ids.txt"
  : > "$OUT/manjkajoci.txt"
  while read -r id; do
    grep -q "$id" "$OUT/app-chunks.txt" || echo "$id" >> "$OUT/manjkajoci.txt"
  done < "$OUT/tt-ids.txt"
  echo "kandidatov za lazy chunk: $(wc -l < "$OUT/manjkajoci.txt")"
  N1=0; N2=0
  while read -r id; do
    f="$OUT/lazy-$id.js"
    curl -s "$PROD/_next/static/chunks/$id.js" -o "$f" 2>/dev/null
    grep -q "Izvozi telemetrijo omejevanja hitrosti kot CSV" "$f" 2>/dev/null && N1=$((N1+1))
    grep -q "Vzdrževanje — omejevanje hitrosti" "$f" 2>/dev/null && N2=$((N2+1))
    grep -q "Telemetrije omejevanja hitrosti ni bilo mogoče naložiti" "$f" 2>/dev/null && N3=$((N3+1))
  done < "$OUT/manjkajoci.txt"
  echo "R185 needle 'Izvozi telemetrijo omejevanja hitrosti kot CSV': ${N1:-0} chunkov"
  echo "R184 regresija 'Vzdrževanje — omejevanje hitrosti': ${N2:-0} chunkov"
  echo "R184 regresija 'Telemetrije omejevanja hitrosti ni bilo mogoče naložiti': ${N3:-0} chunkov"
fi

echo "-- D5: seje dialog — meni (Odjava gumb = avatar meni?) --"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odjava')||(b.getAttribute('aria-label')||'').includes('meni')||(b.getAttribute('aria-label')||'').includes('Uporabnik')); if(g){g.click(); return 'kliknil '+g.getAttribute('aria-label');} const g2=[...document.querySelectorAll('header button, [data-slot=header] button')]; return 'ni ga; header gumbi: '+JSON.stringify(g2.map(b=>b.getAttribute('aria-label')||b.textContent.trim()).slice(0,8));})()" 2>&1 | tail -1
sleep 2
agent-browser eval "JSON.stringify([...document.querySelectorAll('[role=\"menuitem\"]')].map(x=>x.textContent.trim()))" 2>&1 | tail -1
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Aktivne seje')); if(m) m.click(); return !!m;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); if(!dlg) return JSON.stringify({dialog:false}); const p=[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({dialog:true, pecatSeje:p?p.textContent.trim():null, sejeVrstic:dlg.querySelectorAll('li').length});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R186 PROBE2 KONEC"
