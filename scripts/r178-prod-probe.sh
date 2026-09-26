#!/bin/bash
# R178 produkcija probe: R177 ŽIVO? (push 15:39:58 UTC; deploy 15-40 min —
# ta probe teče na koncu runde).
# R177 pečati na Zaloga/Dokumenti/Varnost so DOM-only fingerprint ('Osveženo
# ob' NI nov string — R170): probe preveri PEČAT VIDEN na glavi + VEDENJSKI
# dokaz — focus posodobi čas pečata (NOV timestamp po osvežitvi).
# MONTER spot: Zaloga pečat ✓, Varnost pečat ✓ (Dokumenti pečat ima šele po
# izbiri projekta — 403 meja /api/projects na tej površini, R176 razlaga).
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r178-probe
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
[ "$OKVIHOD" != "1" ] && { echo "VIZTAB IZHOD NEUSPEŠEN ×3"; agent-browser close --all > /dev/null 2>&1; echo "R178 PROBE KONEC (NEDELOUČEN)"; exit 1; }

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- Z-probe: Več → Zaloga — R177 pečat VIDEN + focus posodobi čas ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const pecat=[...document.querySelectorAll('span')].find(s=>s.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatZaloga: !!pecat, cas: pecat ? pecat.textContent.trim() : null, errorPaneli: [...document.querySelectorAll('[role=\"alert\"]')].length});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const pecat=[...document.querySelectorAll('span')].find(s=>s.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatZalogaPoFokusu: !!pecat, cas: pecat ? pecat.textContent.trim() : null});})()" 2>&1 | tail -1

echo "--- W-probe: Več → Varnost — R177 pečat VIDEN + veter ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Varnost'||b.textContent.trim().includes('Varnost')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const pecat=[...document.querySelectorAll('span')].find(s=>s.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatVarnost: !!pecat, cas: pecat ? pecat.textContent.trim() : null, veter: document.body.innerText.includes('m/s'), errorPaneli: [...document.querySelectorAll('[role=\"alert\"]')].length});})()" 2>&1 | tail -1

echo "--- chunki + byte regresija (R176 vedenjski hooki so brez stringov) ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
for needle in "Ponovno naloži zalogo" "Ponovno naloži seznam ekipe" "Izvozi prikazane termine v koledarsko" "Vremenska storitev ni odgovorila" "Osveženo ob"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r178-probe.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R178 PROBE KONEC"
