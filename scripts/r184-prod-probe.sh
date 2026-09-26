#!/bin/bash
# R184 produkcija probe: R183 ŽIVO? (push 18:43:53 UTC; deploy 15-40 min —
# probe teče na koncu runde, precedens R175-R184) + regresije.
# Fingerprinti R183 (MONTER spot; curl + DOM + byte):
#  • CURL: /api/public/version žig (če se je spremenil glede na 18:44:19.278Z → nov build);
#  • DOM (MONTER): 'Več' → 'Slike' — glava 'Slikanje projekta' + pečat FOTKE
#    (R183-a) + fokus → čas se SPREMENI (vedenjski dokaz na produkciji);
#  • DOM: 'Več' → 'Meritve' — h2 'Meritve' + podnaslov 'Meritve ograj, dimenzije'
#    + pečat MERITVE (R183-b);
#  • byte needleji R183: 'Fotografij ni bilo mogoče naložiti' + 'Ponovno naloži fotografije';
#  • regresije R182: zvonek sheet pečat + podnaslov, Material V5 vrstica;
#  • regresija R177: Zaloga pečat; banner SKRIT; temna + window.__err null.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r184-probe
mkdir -p "$OUT" && rm -f "$OUT"/*.js

echo "--- 1) CURL: build žig (R183 = nov žig?) ---"
echo "telo: $(curl -s "$PROD/api/public/version")"
curl -s -o /dev/null -w "api/public/version status: %{http_code}\n" "$PROD/api/public/version"
curl -s -o /dev/null -w "api/version status: %{http_code}\n" "$PROD/api/version"

echo "--- 2) DOM (MONTER spot, prijavljena seja) ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8

for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
  sleep 4
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && echo "VizTab izhod OK (poskus $i)" && break
done

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "-- Slike: glava 'Slikanje projekta' + pečat FOTKE (R183 a) --"
agent-browser eval "$VECPOMOC" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Slike'||b.textContent.trim()==='Slike'); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const glava=[...document.querySelectorAll('h3,h4,div')].some(e=>e.textContent.trim()==='Slikanje projekta'); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const napake=[...document.querySelectorAll('[role=\"alert\"]')].filter(e=>e.textContent.includes('Fotografij ni bilo mogoče')).length; return JSON.stringify({glavaSlikanjeR183: glava, pecatFotke: p?p.textContent.trim():null, fotoNapake: napake});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus Slike'" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatFotkePoFokusu: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "-- Meritve: h2 + podnaslov + pečat MERITVE (R183 b) --"
agent-browser eval "$VECPOMOC" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Meritve'||b.textContent.trim()==='Meritve'); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const h2=[...document.querySelectorAll('h2')].find(e=>e.textContent.trim()==='Meritve'); const pod=[...document.querySelectorAll('p')].find(e=>e.textContent.includes('Meritve ograj, dimenzije')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({h2Meritve: !!h2, podnaslovR183: !!pod, pecatMeritve: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "-- Regresije R182: zvonek sheet + Material V5 --"
agent-browser eval "$VECPOMOC" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('div')].find(e=>e.textContent.trim().startsWith('Dobavitelji, zaloge, naročila in BOM optimizacija')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({vrsticaR182: !!pod, pecatMaterial: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const esc={key:'Escape',code:'Escape'}; document.dispatchEvent(new KeyboardEvent('keydown',esc)); return 'esc';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return !!b;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('p')].find(e=>e.textContent.includes('Nizka zaloga, današnje montaže')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({podnaslovR182: !!pod, pecatObvestila: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const esc={key:'Escape',code:'Escape'}; document.dispatchEvent(new KeyboardEvent('keydown',esc)); return 'esc';})()" > /dev/null 2>&1
sleep 2

echo "-- Zaloga regresija (R177) + banner SKRIT + temna + __err --"
agent-browser eval "$VECPOMOC" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const b=[...document.querySelectorAll('div')].find(e=>e.textContent.trim()==='Na voljo je nova verzija aplikacije.'); return JSON.stringify({zalogaPecat: p?p.textContent.trim():null, bannerViden: !!b});})()" 2>&1 | tail -1
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({pageBg: getComputedStyle(document.body).backgroundColor, err: window.__err ?? null});})()" 2>&1 | tail -1

echo "--- 3) BYTE: R183 needleji v app chunkih (performance API; tr -d '\\\\' nauček R183) ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"' | tr ',' '\n' | tr -d '\\' | sed 's/^\[//; s/\]$//' | grep "_next" > "$OUT/app-chunks.txt"
echo "app chunkov: $(wc -l < "$OUT/app-chunks.txt")"

N1=0; N2=0
while read -r u; do
  f="$OUT/$(echo "$u" | md5sum | cut -c1-10).js"
  curl -s "$u" -o "$f" 2>/dev/null
  grep -q "Fotografij ni bilo mogoče naložiti" "$f" 2>/dev/null && N1=$((N1+1))
  grep -q "Ponovno naloži fotografije" "$f" 2>/dev/null && N2=$((N2+1))
done < "$OUT/app-chunks.txt"
echo "R183 needle 'Fotografij ni bilo mogoče naložiti': $N1 chunkov"
echo "R183 needle 'Ponovno naloži fotografije': $N2 chunkov"

agent-browser close --all > /dev/null 2>&1 || true
echo "R184 PROD PROBE KONEC"
