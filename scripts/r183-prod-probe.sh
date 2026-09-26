#!/bin/bash
# R183 produkcija probe: R182 ŽIVO? (push 18:22:30 UTC; deploy 15-40 min —
# probe teče na koncu runde, precedens R175-R183) + regresije.
# Fingerprinti R182 (MONTER spot; curl + byte + DOM):
#  • CURL: /api/public/version žig SE SPREMENI (prej 2026-09-26T17:51:59.283Z = R181
#    build) → R182 build; + /api/version (dvopoten pokriva OBA primera);
#  • byte needleji R182: 'Nekateri viri niso bilo naloženi' + 'Ponovno naloži
#    obvestila' + 'Dobavitelji, zaloge, naročila in BOM optimizacija';
#  • DOM (MONTER): zvonek → sheet pečat ('Nizka zaloga, današnje montaže…'),
#    Material V5 vrstica + pečat + fokus → čas se SPREMENI (vedenjski);
#  • regresija: Zaloga pečat (R177), banner SKRIT, temna + window.__err null.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r183-probe
mkdir -p "$OUT" && rm -f "$OUT"/*.js

echo "--- 1) CURL: build žig (R182 = nov žig?) ---"
curl -s -o /dev/null -w "api/public/version status: %{http_code}\n" "$PROD/api/public/version"
echo "telo: $(curl -s "$PROD/api/public/version")"
curl -s -o /dev/null -w "api/version status: %{http_code}\n" "$PROD/api/version"

echo "--- 2) DOM + BYTE (MONTER spot, prijavljena seja) ---"
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

echo "-- Zvonek → sheet: pečat + podnaslov (R182 a) --"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('p')].find(e=>e.textContent.includes('Nizka zaloga, današnje montaže')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({podnaslovR182: !!pod, pecatObvestila: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "-- Material V5: vrstica + pečat + focus (R182 b, vedenjski) --"
agent-browser eval "(()=>{const esc={key:'Escape',code:'Escape'}; document.dispatchEvent(new KeyboardEvent('keydown',esc)); return 'esc';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('div')].find(e=>e.textContent.trim().startsWith('Dobavitelji, zaloge, naročila in BOM optimizacija')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({vrsticaR182: !!pod, pecatMaterial: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatPoFokusu: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "-- Zaloga regresija (R177) + banner SKRIT + temna + __err --"
agent-browser eval "(()=>{const esc={key:'Escape',code:'Escape'}; document.dispatchEvent(new KeyboardEvent('keydown',esc)); return 'esc';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const b=[...document.querySelectorAll('div')].find(e=>e.textContent.trim()==='Na voljo je nova verzija aplikacije.'); return JSON.stringify({zalogaPecat: p?p.textContent.trim():null, bannerViden: !!b});})()" 2>&1 | tail -1
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({pageBg: getComputedStyle(document.body).backgroundColor, err: window.__err ?? null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r183-prod-temna.png > /dev/null 2>&1 && echo "screenshot PROD TEMNA OK"

echo "--- 3) BYTE: R182 needleji v app chunkih (performance API) ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"' | tr ',' '\n' | tr -d '\\' | sed 's/^\[//; s/\]$//' | grep "_next" > "$OUT/app-chunks.txt"
echo "app chunkov: $(wc -l < "$OUT/app-chunks.txt")"

N1=0; N2=0; N3=0
while read -r u; do
  f="$OUT/$(echo "$u" | md5sum | cut -c1-10).js"
  curl -s "$u" -o "$f" 2>/dev/null
  grep -q "Nekateri viri niso bilo naloženi" "$f" 2>/dev/null && N1=$((N1+1))
  grep -q "Ponovno naloži obvestila" "$f" 2>/dev/null && N2=$((N2+1))
  grep -q "Dobavitelji, zaloge, naročila in BOM optimizacija" "$f" 2>/dev/null && N3=$((N3+1))
done < "$OUT/app-chunks.txt"
echo "R182 needle 'Nekateri viri…': $N1 chunkov"
echo "R182 needle 'Ponovno naloži obvestila': $N2 chunkov"
echo "R182 needle 'Dobavitelji, zaloge…': $N3 chunkov"

agent-browser close --all > /dev/null 2>&1 || true
echo "R183 PROD PROBE KONEC"
