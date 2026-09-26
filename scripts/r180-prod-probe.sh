#!/bin/bash
# R180 produkcija probe: R179 ŽIVO? (push 16:26:18 UTC; deploy 15-40 min —
# ta probe teče na koncu runde) + R178/R177 regresije.
# Fingerprinti (MONTER spot; DOM + byte):
#  • /api/version JAVNO 200 + build žig (R179 jedro živo — prej 401 starega deploya);
#  • byte needle R179: 'Na voljo je nova verzija aplikacije.' (banner chunk);
#  • regresije: 'Seznam strank, opomniki...' (R178), 'Ponovno naloži zalogo' (R175),
#    'Ponovno naloži seznam ekipe' (R174), 'Izvozi prikazane termine v koledarsko' (R172);
#  • DOM: CRM glava + pečati (R178), Zaloga pečat (R177), banner SKRIT na
#    trenutnem deployu (isti žig = pravilno stanje, ni bug);
#  • PORTAL v produkciji NI protkan (red line: lastniški žeton — portal stranke
#    se QA-ja IZKLJUČNO lokalno, r180-e2e-browser.sh).
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r180-probe
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

echo "--- /api/version javno (R179 jedro živo?) ---"
curl -s -o /dev/null -w "api/version status: %{http_code}\n" "$PROD/api/version"
curl -sI "$PROD/api/version" | grep -i "cache-control" || echo "(cache-control manjka)"
curl -s "$PROD/api/version" | head -c 120; echo ""

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
[ "$OKVIHOD" != "1" ] && { echo "VIZTAB IZHOD NEUSPEŠEN ×3"; agent-browser close --all > /dev/null 2>&1; echo "R180 PROBE KONEC (NEDELOUČEN)"; exit 1; }

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- B-probe: banner SKRIT na trenutnem deployu (isti žig = pravilno, ni bug) ---"
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); return JSON.stringify({bannerViden: !!pas});})()" 2>&1 | tail -1

echo "--- C-probe: Več → CRM — R178 regresija (glava + pečati) ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM')||b.textContent.trim().includes('CRM')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const glava=[...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='CRM stranke'); const pecati=[...document.querySelectorAll('span')].filter(s=>s.textContent.trim().startsWith('Osveženo ob')).length; const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({glavaR178: glava, pecatiVidni: pecati, errorPaneli: err});})()" 2>&1 | tail -1

echo "--- Z-probe: Več → Zaloga — R177 pečat regresija ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const pecat=[...document.querySelectorAll('span')].find(s=>s.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatZaloga: !!pecat, cas: pecat ? pecat.textContent.trim() : null, errorPaneli: [...document.querySelectorAll('[role=\"alert\"]')].length});})()" 2>&1 | tail -1

echo "--- chunki + byte needle (R179 banner + R178 regresija) ---"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
for needle in "Na voljo je nova verzija aplikacije." "Seznam strank, opomniki in zgodovina sodelovanja" "Ponovno naloži zalogo" "Ponovno naloži seznam ekipe" "Izvozi prikazane termine v koledarsko"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done

agent-browser screenshot /home/z/my-project/screenshots/qa-r180-probe.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R180 PROBE KONEC"
