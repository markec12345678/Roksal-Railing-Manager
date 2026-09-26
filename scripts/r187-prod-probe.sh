#!/bin/bash
# R187 produkcija probe: R186 ŽIVO? (push 20:28 UTC) — polling žiga, potem
# polni fingerprint: (a) health ruta (javna, brez seje), (b) byte needleji,
# (c) MONTER Meritve CSV gumb + PRAZNA pot toast, (d) regresije.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r187-probe
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/*.txt

echo "--- 0) POLLING: R186 žig (push ~20:28 UTC; vzorec <3 min ob toplih predpomnilnikih, sicer do ~40 min) ---"
ZACETEK=$(date +%s)
R186ZIG=""
for i in $(seq 1 20); do
  Z=$(curl -s "$PROD/api/public/version" | grep -o '"build":"[^"]*"' | cut -d'"' -f4)
  TRENUTNI=$(date -u +%H:%M:%S)
  if [ -n "$Z" ] && [ "$Z" != "2026-09-26T19:41:48.531Z" ]; then
    echo "[$TRENUTNI] NOVI ŽIG: $Z (poskus $i)"
    R186ZIG="$Z"
    break
  fi
  echo "[$TRENUTNI] še R185 ($Z) — poskus $i, čakam 60 s..."
  sleep 60
done
if [ -z "$R186ZIG" ]; then
  echo "R186 ŠE NI ŽIVO po ~20 min — probe končan s statusom 'deploy v teku' (ni napaka, fingerprinti v naslednji rundi)"
  exit 0
fi
KONEC=$(date +%s)
echo "deploy čas: $((KONEC-ZACETEK)) s od začetka pollinga"

echo "--- 1) HEALTH ruta (javna, brez seje) — 200 + no-store + correlation ---"
curl -s -D - "$PROD/api/public/health" -o "$OUT/health.json" | grep -iE "^HTTP|cache-control|x-correlation"
cat "$OUT/health.json"; echo ""

echo "--- 2) MONTER prijava ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12

echo "--- 3) Meritve tab → CSV gumb (R186 F2) + PRAZNA pot ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 9
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({csvGumbViden:!!g, pecat:p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); if(g){g.click(); return 'kliknil';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[data-sonner-toast], li, div')].map(e=>e.textContent||'').find(x=>x.includes('meritev v CSV')||x.includes('Ni meritev za izvoz')||x.includes('Izvoza ni bilo mogoče')); return JSON.stringify({toast:t?t.trim().slice(0,60):null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r187-meritve-csv.png > /dev/null 2>&1 && echo "screenshot MERITVE CSV OK"

echo "--- 4) BYTE: needleji R186 v naloženih chunkih ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"' | tr ',' '\n' | tr -d '\\' | sed 's/^\[//; s/\]$//' | grep "_next" > "$OUT/chunks.txt"
echo "chunkov: $(wc -l < "$OUT/chunks.txt")"
while read -r u; do curl -s "$u" -o "$OUT/$(basename "$u")" 2>/dev/null; done < "$OUT/chunks.txt"
echo "meritve CSV needle: $(grep -l 'Izvozi vidne meritve kot CSV' "$OUT"/*.js 2>/dev/null | wc -l) chunkov"
echo "health needle 'Baza ni dosegljiva': $(grep -l 'Baza ni dosegljiva' "$OUT"/*.js 2>/dev/null | wc -l) chunkov"

echo "--- 5) Regresije: Zaloga (R177) + Material (R182) + banner + temna ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('div')].find(e=>e.textContent.trim().startsWith('Dobavitelji, zaloge, naročila in BOM optimizacija')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({materialVrstica:!!pod, pecatMaterial:p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const b=[...document.querySelectorAll('div')].find(e=>e.textContent.trim()==='Na voljo je nova verzija aplikacije.'); return JSON.stringify({zalogaPecat:p?p.textContent.trim():null, bannerViden:!!b});})()" 2>&1 | tail -1
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({pageBg:getComputedStyle(document.body).backgroundColor, err:window.__err ?? null});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R187 PROD PROBE KONEC"
