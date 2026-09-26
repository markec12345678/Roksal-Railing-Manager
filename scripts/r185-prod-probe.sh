#!/bin/bash
# R185 produkcija probe: R184 ŽIVO? (push 19:15:31 UTC, build žig 19:15:52.708Z
# — /api/public/version je ŽE pokazal nov žig ob startu runde; ta probe zbere
# POLNI fingerprint) + regresije.
# Fingerprinti R184 (MONTER spot — panel je ADMIN-only, MONTER dokaže mejo):
#  • CURL: /api/public/version + /api/version → žig R184 build (19:15:52.708Z);
#  • DOM (MONTER): meni → 'Aktivne seje' — pečat v opisu dialoga (R184-c)
#    + fokus (dialog odprt) → čas se SPREMENI (vedenjski dokaz);
#  • DOM (MONTER): Ekipa — kartica 'Vzdrževanje — omejevanje hitrosti' NE
#    obstaja (ADMIN-only — PRAVILNO fail-closed); eval fetch
#    /api/security/rate-limit → 403 (denyUnless ADMIN_ROLES na produkciji);
#  • byte: team-tab chunk (needle 'Ekipa — življenjski') → izvleči 16-hex
#    chunk id-je, dobi MANJKAJOČE (lazy panel chunk) → needleji R184
#    'Vzdrževanje — omejevanje hitrosti' + 'Telemetrije omejevanja hitrosti
#    ni bilo mogoče naložiti';
#  • regresije: Material V5 vrstica + pečat (R182), Zaloga pečat (R177),
#    banner SKRIT, temna rgb(15,23,36), window.__err null.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r185-probe
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/*.txt

echo "--- 1) CURL: build žig (R184 = 2026-09-26T19:15:52.708Z?) ---"
echo "public: $(curl -s "$PROD/api/public/version")"
echo "notrani: $(curl -s "$PROD/api/version")"

echo "--- 2) MONTER prijava ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8

echo "-- S0: meni → 'Aktivne seje' — pečat v opisu dialoga (R184-c) --"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(g) g.click(); return !!g;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Aktivne seje')); if(m) m.click(); return !!m;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); if(!dlg) return JSON.stringify({dialog:false}); const p=[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const vrstice=dlg.querySelectorAll('li').length; return JSON.stringify({dialog:true, pecatSeje:p?p.textContent.trim():null, sejeVrstic:vrstice});})()" 2>&1 | tail -1

echo "-- S1: fokus (dialog odprt) → pečat SEJ se SPREMENI (vedenjski) --"
PRES=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat seje PRE:  $PRES"
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus S1'" > /dev/null 2>&1
sleep 7
POSTS=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat seje POST: $POSTS"
[ -n "$PRES" ] && [ -n "$POSTS" ] && [ "$PRES" != "$POSTS" ] && echo "SEJE FOKUS DELTA: DOKAZANA" || echo "SEJE FOKUS DELTA: NI (preveri 30 s vrata)"

echo "-- zapri dialog --"
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const z=dlg?[...dlg.querySelectorAll('button')].find(b=>b.textContent.trim()==='Zapri'):null; if(z) z.click(); return !!z;})()" > /dev/null 2>&1
sleep 2

echo "-- Ekipa (MONTER): meja ADMIN-only — panel NE obstaja + API 403 --"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='Ekipa'); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const panel=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); const ekipaGlava=[...document.querySelectorAll('h1,h2,h3')].some(e=>e.textContent.includes('Ekipa')); return JSON.stringify({panelVidenADMINonly: panel, ekipaGlava: ekipaGlava});})()" 2>&1 | tail -1
agent-browser eval "fetch('/api/security/rate-limit').then(r=>r.text().then(t=>JSON.stringify({status:r.status, telo:t.slice(0,120)})))" 2>&1 | tail -1

echo "-- Regresije: Material V5 vrstica + pečat (R182) --"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('div')].find(e=>e.textContent.trim().startsWith('Dobavitelji, zaloge, naročila in BOM optimizacija')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({vrsticaR182: !!pod, pecatMaterial: p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "-- Regresija Zaloga (R177) + banner SKRIT + temna + __err --"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const b=[...document.querySelectorAll('div')].find(e=>e.textContent.trim()==='Na voljo je nova verzija aplikacije.'); return JSON.stringify({zalogaPecat: p?p.textContent.trim():null, bannerViden: !!b});})()" 2>&1 | tail -1
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({pageBg: getComputedStyle(document.body).backgroundColor, err: window.__err ?? null});})()" 2>&1 | tail -1

echo "--- 3) BYTE: team-tab chunk → manjkajoči chunki → R184 needleji ---"
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
    if ! grep -q "$id" "$OUT/app-chunks.txt"; then
      echo "$id" >> "$OUT/manjkajoci.txt"
    fi
  done < "$OUT/tt-ids.txt"
  echo "kandidatov za lazy chunk: $(wc -l < "$OUT/manjkajoci.txt")"
  N1=0; N2=0
  while read -r id; do
    f="$OUT/lazy-$id.js"
    curl -s "$PROD/_next/static/chunks/$id.js" -o "$f" 2>/dev/null
    grep -q "Vzdrževanje — omejevanje hitrosti" "$f" 2>/dev/null && N1=$((N1+1))
    grep -q "Telemetrije omejevanja hitrosti ni bilo mogoče naložiti" "$f" 2>/dev/null && N2=$((N2+1))
  done < "$OUT/manjkajoci.txt"
  echo "R184 needle 'Vzdrževanje — omejevanje hitrosti': $N1 chunkov"
  echo "R184 needle 'Telemetrije omejevanja hitrosti ni bilo mogoče naložiti': $N2 chunkov"
else
  echo "LAŽNA NIČLA nevarnost: team-tab chunk ni bil naložen — DOM dokazi zgoraj kompenzirajo"
fi

agent-browser close --all > /dev/null 2>&1 || true
echo "R185 PROD PROBE KONEC"
