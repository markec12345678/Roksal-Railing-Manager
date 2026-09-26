#!/bin/bash
# R179 produkcija probe: R178 ŽIVO? (push 16:02:44 UTC; deploy 15-40 min —
# ta probe teče na koncu runde).
# R178 fingerprinti (MONTER spot; DOM + byte):
#  • byte needle NOV string R178: 'Seznam strank, opomniki in zgodovina sodelovanja'
#  • DOM pečati: CRM glava 'CRM stranke' + plošča pečat; Ekipa = 403 poštno
#    stanje → pečat PRAVILNO ODSOTEN (fail-closed, ni bug); Zaloga pečat (R177).
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r179-probe
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
[ "$OKVIHOD" != "1" ] && { echo "VIZTAB IZHOD NEUSPEŠEN ×3"; agent-browser close --all > /dev/null 2>&1; echo "R179 PROBE KONEC (NEDELOUČEN)"; exit 1; }

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- C-probe: Več → CRM — R178 glava 'CRM stranke' + pečata (plošča + stranke) ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM')||b.textContent.trim().includes('CRM')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const glava=[...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='CRM stranke'); const pecati=[...document.querySelectorAll('span')].filter(s=>s.textContent.trim().startsWith('Osveženo ob')).length; const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({glavaR178: glava, pečatiVidni: pecati, errorPaneli: err});})()" 2>&1 | tail -1

echo "--- E-probe: Več → Ekipa — poštno stanje 403 → pečat PRAVILNO ODSOTEN ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.textContent.trim().includes('Ekipa')||b.textContent.trim().includes('Življenjski cikl računov'))); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const postno=document.body.innerText.includes('Ekipa — ureja pisarna'); const pecat=[...document.querySelectorAll('span')].some(s=>s.textContent.trim().startsWith('Osveženo ob')); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({postnoStanje: postno, pecatOdsoten: !pecat, errorPaneli: err});})()" 2>&1 | tail -1

echo "--- Z-probe: Več → Zaloga — R177 pečat regresija ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const pecat=[...document.querySelectorAll('span')].find(s=>s.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatZaloga: !!pecat, cas: pecat ? pecat.textContent.trim() : null, errorPaneli: [...document.querySelectorAll('[role=\"alert\"]')].length});})()" 2>&1 | tail -1

echo "--- chunki + byte needle (R178 NOV string) ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
for needle in "Seznam strank, opomniki in zgodovina sodelovanja" "Ponovno naloži zalogo" "Ponovno naloži seznam ekipe" "Izvozi prikazane termine v koledarsko"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r179-probe.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R179 PROBE KONEC"
