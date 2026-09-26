#!/bin/bash
# R186 produkcija probe C (MONTER spot, popravljen): R185 fingerprinti, ki so na
# produkciji dokazljivi BREZ lastniškega ADMIN računa (ADMIN = by-design
# privaten — R127; ADMIN_ROLES=['ADMIN'] → panel UI dokaz ostane na lokalnem
# E2E r185-e2e-browser.sh; produkcija dobi BYTE dokaz prek lazy chunk odkritja).
# Naučki vgrajeni: (a) 30 s vrata useRefetchOnFocus → patch/restore+fokus vedno
# po 31 s oknu; (b) Radix meni rabi pointerdown+click (R184 nauček);
# (c) 'null' izpis evala ≠ prazen niz — delta preverjanje je null-varen.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r186-probe
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/*.txt
ZIG_R185="2026-09-26T19:41:48.531Z"

echo "=== FP1: CURL — build žig na OBEH rutah (R185 = $ZIG_R185?) ==="
V1=$(curl -s -m 15 "$PROD/api/public/version")
V2=$(curl -s -m 15 "$PROD/api/version")
echo "public: $V1"
echo "notrani: $V2"
FP1=NE
echo "$V1" | grep -q "$ZIG_R185" && echo "$V2" | grep -q "$ZIG_R185" && FP1=DA
echo "FP1 žig OBE ruti: $FP1"

echo "=== Prijava MONTER spot (produkcija) ==="
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
echo "po prijavi: $(agent-browser eval "JSON.stringify({url: location.pathname, dom: document.body.innerText.includes('Moji projekti')})" 2>&1 | tail -1)"

echo "=== FP7: banner fetch-patch tuj žig (MONTER dom) — patch → 31 s okno → fokus ==="
agent-browser eval "window.__r186OrigFetch=window.fetch; window.fetch=(u,o)=>{ if(typeof u==='string'&&(u.includes('/api/public/version')||u.includes('/api/version'))){ return Promise.resolve(new Response(JSON.stringify({build:'1999-01-01T00:00:00.000Z'}),{status:200,headers:{'Content-Type':'application/json'}})); } return window.__r186OrigFetch(u,o); }; 'patched'" 2>&1 | tail -1
sleep 31
agent-browser eval "window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'fokus patch'" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); if(!pas) return JSON.stringify({pasViden:false}); return JSON.stringify({pasViden:true, role:pas.getAttribute('role'), zgrajeno:pas.textContent.includes('Zgrajeno '), leto1999:pas.textContent.includes('1999'), ura0100:pas.textContent.includes('01:00:00'), pasLjubljana:pas.textContent.includes('(Europe/Ljubljana)'), osnova:pas.textContent.includes('Osvežite za najnovejše funkcije in popravke.')});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r186-banner-zgrajeno.png > /dev/null 2>&1 && echo "screenshot BANNER OK"

echo "=== FP8: restore fetch → 31 s okno → fokus → pas SKRIT (spot čist) ==="
agent-browser eval "window.fetch=window.__r186OrigFetch; 'restored'" 2>&1 | tail -1
sleep 31
agent-browser eval "window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'fokus po restore'" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=\"status\"]')].find(s=>s.textContent.includes('nova verzija')); return JSON.stringify({pasPoRestoreInOknu: !!pas, skritZig: window.localStorage.getItem('roksal-update-dismissed-zig')});})()" 2>&1 | tail -1

echo "=== MEJA: Ekipa (MONTER) — pointerdown meniji → panel ODSOTEN + API 403 ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t){t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); t.click(); return true;} return false;})()" > /dev/null 2>&1
sleep 4
for i in 1 2 3; do
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && echo "VizTab izhod OK (poskus $i)" && break
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t){t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); t.click(); return true;} return false;})()" > /dev/null 2>&1
  sleep 4
done
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(!v) return 'brez Vec'; v.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); v.click(); return 'Vec odprt';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='Ekipa'); if(!t) return JSON.stringify({ekipaMenuitem:false, menuVidna:!!document.querySelector('[role=\"menu\"]')}); t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); t.click(); return JSON.stringify({ekipaMenuitem:true});})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const panel=[...document.querySelectorAll('h3')].some(e=>e.textContent.trim()==='Vzdrževanje — omejevanje hitrosti'); const glava=[...document.querySelectorAll('h1,h2,h3')].some(e=>e.textContent.includes('Ekipa — življenjski cikl računov')); const postno=[...document.querySelectorAll('*')].some(e=>e.children.length===0&&/Ekipa — ureja pisarna/.test(e.textContent||'')); return JSON.stringify({panelViden: panel, ekipaGlava: glava, postnoStanje: postno});})()" 2>&1 | tail -1
agent-browser eval "fetch('/api/security/rate-limit').then(r=>r.text().then(t=>JSON.stringify({status:r.status, detail:(JSON.parse(t).detail||'').slice(0,80)})))" 2>&1 | tail -1

echo "=== FP4: BYTE — team-tab chunk → manjkajoči 16-hex chunki → R185 F1 needle ==="
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"' | tr ',' '\n' | tr -d '\\' | sed 's/^\[//; s/\]$//' | grep "_next" > "$OUT/app-chunks.txt"
echo "naloženih chunkov: $(wc -l < "$OUT/app-chunks.txt")"
while read -r u; do
  f="$OUT/$(basename "$u")"
  curl -s "$u" -o "$f" 2>/dev/null
done < "$OUT/app-chunks.txt"
TT=$(grep -l "Ekipa — življenjski" "$OUT"/*.js 2>/dev/null | head -1)
echo "team-tab chunk: ${TT:-NI NAJDEN}"
N_IZV=$(grep -l "Izvozi telemetrijo omejevanja hitrosti kot CSV" "$OUT"/*.js 2>/dev/null | wc -l)
if [ "$N_IZV" -eq 0 ] && [ -n "${TT:-}" ]; then
  grep -o '[0-9a-f]\{16\}' "$TT" | sort -u > "$OUT/tt-ids.txt"
  : > "$OUT/manjkajoci.txt"
  while read -r id; do
    if ! grep -q "$id" "$OUT/app-chunks.txt"; then
      echo "$id" >> "$OUT/manjkajoci.txt"
    fi
  done < "$OUT/tt-ids.txt"
  echo "kandidatov za lazy chunk: $(wc -l < "$OUT/manjkajoci.txt")"
  while read -r id; do
    f="$OUT/lazy-$id.js"
    curl -s "$PROD/_next/static/chunks/$id.js" -o "$f" 2>/dev/null
    grep -q "Izvozi telemetrijo omejevanja hitrosti kot CSV" "$f" 2>/dev/null && N_IZV=$((N_IZV+1)) && echo "LAZY ZADETEK: $id.js"
  done < "$OUT/manjkajoci.txt"
fi
N_ZGR=$(grep -l "Zgrajeno " "$OUT"/*.js 2>/dev/null | wc -l)
N_R184=$(grep -l "Telemetrije omejevanja hitrosti ni bilo mogoče naložiti" "$OUT"/*.js 2>/dev/null | wc -l)
echo "FP4 R185 F1 'Izvozi telemetrijo…' (z lazy): $N_IZV chunkov"
echo "regresija R184 fail-verbose needle (isti lazy chunk): $N_R184"
echo "FP2 R185 'Zgrajeno ' (banner chunk): $N_ZGR"

echo "=== SEJE regresija (R184): dialog pečat + fokus delta (null-varno) ==="
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!g) return 'brez gumba'; g.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); g.click(); return 'odprt';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Aktivne seje')); if(!m) return 'brez menuitem'; m.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); m.click(); return 'kliknil';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); if(!dlg) return JSON.stringify({dialog:false}); const p=[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({dialog:true, pecat:p?p.textContent.trim():null, vrstic:dlg.querySelectorAll('li').length});})()" 2>&1 | tail -1
SPRE=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; const v=p?p.textContent.trim():null; return v===null?'NULA':v;})()" 2>&1 | tail -1)
echo "seje pečat PRE:  $SPRE"
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus S'" > /dev/null 2>&1
sleep 7
SPOS=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; const v=p?p.textContent.trim():null; return v===null?'NULA':v;})()" 2>&1 | tail -1)
echo "seje pečat POST: $SPOS"
if [ "$SPOS" = "$SPRE" ]; then
  echo "(vrata: čakam 26 s + fokus znova)"
  sleep 26
  agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus S2'" > /dev/null 2>&1
  sleep 7
  SPOS=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; const v=p?p.textContent.trim():null; return v===null?'NULA':v;})()" 2>&1 | tail -1)
  echo "seje pečat POST2: $SPOS"
fi
FP6S=NE
[ "$SPRE" != "NULA" ] && [ "$SPOS" != "NULA" ] && [ "$SPRE" != "$SPOS" ] && FP6S=DA
[ "$SPOS" = "NULA" ] && FP6S=NEJASNO
echo "SEJE fokus delta: $FP6S"
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const z=dlg?[...dlg.querySelectorAll('button')].find(b=>b.textContent.trim()==='Zapri'):null; if(z) z.click(); return !!z;})()" > /dev/null 2>&1
sleep 2

echo "=== FP9: regresije — Material (R182) + Zaloga (R177) + temna + __err ==="
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(!v) return 'brez Vec'; v.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); v.click(); return 'Vec odprt';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(!t) return 'brez menuitem'; t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); t.click(); return 'kliknil';})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('div')].find(e=>e.textContent.trim().startsWith('Dobavitelji, zaloge, naročila in BOM optimizacija')); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({vrsticaR182: !!pod, pecatMaterial: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(!v) return 'brez Vec'; v.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); v.click(); return 'Vec odprt';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(!t) return 'brez menuitem'; t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); t.click(); return 'kliknil';})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const b=[...document.querySelectorAll('div')].find(e=>e.textContent.trim()==='Na voljo je nova verzija aplikacije.'); return JSON.stringify({zalogaPecat: p?p.textContent.trim():null, bannerVidenNaPravemZigu: !!b});})()" 2>&1 | tail -1
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({pageBg: getComputedStyle(document.body).backgroundColor, err: window.__err ?? null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r186-temna.png > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
echo "=== Povzetek R186 probe C ==="
echo "FP1 žig OBE ruti:        $FP1"
echo "FP2 byte 'Zgrajeno ':    $N_ZGR chunkov"
echo "FP4 byte izvoz aria:     $N_IZV chunkov (z lazy odkritjem)"
echo "SEJE fokus delta (R184): $FP6S"
echo "(FP7/FP8/FP9/meja — glej JSON izpise zgoraj)"
echo "R186 PROBE C KONEC"
