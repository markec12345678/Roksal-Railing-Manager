#!/bin/bash
# R234 prod probe — recheck R233 ŽIVO (Dobavitelji CSV izvoz + izjeme-map
# popolnost; brez mutacij — 0 naročil in 0 dobaviteljev v prodi):
#  Z1 Domov: Brez 8 + Zamujena ODSOTNA (fail-closed);
#  Z2 Material → Dobavitelji: R233 JEDRO — CSV gumb ŽIVO pri 0 dobaviteljev
#     + fail-closed klik → toast 'Ni dobaviteljev za izvoz' + __sup null;
#  Z2b Material → Naročila: R232 regresija (gumb viden pri 0 + toast);
#  Z3 CSV vodje regresija (R228): '"Opozorila","Zamujena dobava","0"' + brez8;
#  Z4 geselni žetoni + temna + err null + health;
#  Z5 deployed čanki: needleji R233 + NEGATIVNI (stone unikati ostajajo
#     odsotni) + regresije R229-R232.
# ZERO-MUTACIJA: samo bralni pogledi — nič ne piše v DB.
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

source /home/z/my-project/scripts/e2e-lib.sh

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena ODSOTNA ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r234-prod-domov.png" > /dev/null 2>&1

echo "=== Z2: Material → Dobavitelji — R233 CSV gumb ŽIVO pri 0 dobaviteljev + fail-closed klik ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
eb_pocakaj_na "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Dobavitelji')); return !!b;})()" 12
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]');})()" 12
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]'); if(!g) return JSON.stringify({gumb:false}); return JSON.stringify({gumb:true, disabled:g.disabled, praznoStanje:document.body.textContent.includes('Ni dobaviteljev'), err:window.__err??null});})()" 2>&1 | tail -1
eb_csv_capture sup
eb_csv_reset sup
eb_klik_gumb "Izvozi dobavitelje kot CSV"
sleep 3
agent-browser eval "(()=>{return JSON.stringify({toast:document.body.textContent.includes('Ni dobaviteljev za izvoz'), csvNastal:typeof window.__sup==='string', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r234-prod-suppliers-csv.png" > /dev/null 2>&1

echo "=== Z2b: Material → Naročila — R232 regresija (gumb viden pri 0 naročil) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 12
eb_csv_reset csv
eb_klik_gumb "Izvozi naročila kot CSV"
sleep 3
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); return JSON.stringify({gumb:!!g, disabled:g?g.disabled:null, toast:document.body.textContent.includes('Ni naročil za izvoz'), csvNastal:typeof window.__csv==='string', err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: CSV vodje regresija (R228) ==="
eb_dispatch '{"tab":"more","more":"vodja"}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]');})()" 12
eb_csv_capture csvV
eb_csv_reset csvV
eb_klik_gumb "Izvozi dnevni pregled vodje kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__csvV==='string'&&window.__csvV.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__csvV; if(typeof t!=='string') return JSON.stringify({csv:false,err:window.__err??null}); const cist=t.replace(/^\uFEFF/,''); return JSON.stringify({csv:true, zamujena0:cist.includes('\"Opozorila\",\"Zamujena dobava\",\"0\"'), brez8:cist.includes('\"Opozorila\",\"Brez dobavitelja\",\"8\"'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r234-prod-vodja.png" > /dev/null 2>&1

echo "=== Z4: geselni žetoni + temna + err null + health ==="
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
sleep 1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Zamenjaj geslo'));})()" 8
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Zamenjaj geslo')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return !!document.querySelector('#pwd-current');})()" 8
sleep 1
agent-browser eval "(()=>{const inp=document.querySelector('#pwd-current'); if(!inp) return JSON.stringify({dialog:false}); const barva=getComputedStyle(inp).borderTopColor; return JSON.stringify({dialog:true, obroba:barva, obrobaNiStone:barva!=='rgb(214, 211, 209)'&&barva!=='rgb(231, 229, 228)', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== Z5: deployed čanki — needleji R233 + NEGATIVNI + regresije ==="
OUT=/tmp/r234-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"ar","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 4
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | python3 -c "import sys,json
raw=sys.stdin.read().strip()
try:
  arr=json.loads(raw)
  if isinstance(arr,str): arr=json.loads(arr)
  print('\n'.join(arr))
except Exception:
  print('')" > "$OUT"/chunk-urls.txt
echo "  chunk URLs: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1))
  curl -s --max-time 20 "$url" -o "$OUT/chunk-$i.js"
done < "$OUT"/chunk-urls.txt
echo "  prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
FAIL=0
need() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2  (needle: $1)"; FAIL=1; fi
}
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "STAL : $2  (needle: $1)"; FAIL=1; else echo "OK   : $2 (odsoten — pravilno)"; fi
}
echo "  --- R233 pozitivni ---"
need "Izvozi dobavitelje kot CSV" "R233 Dobavitelji CSV gumb aria"
need "Ni dobaviteljev za izvoz" "R233 fail-closed toast title"
need "CSV se izvozi, ko je dodan prvi dobavitelj." "R233 fail-closed toast opis"
need "Aktiven\":\"Neaktiven" "R233 CSV status ENA resnica"
echo "  --- R233 negativni (stone unikati ostajajo odsotni) ---"
must_miss "bg-stone-600 text-white hover:bg-stone-700" "cv-studio bbox stone (unikatna oblika)"
must_miss "min-h-[36px] border-stone-300 text-[11px] text-stone-600 hover:bg-stone-50" "cv-studio Briši stone (unikatna oblika)"
echo "  --- regresije R229-R232 ---"
need '"Opombe","Pretekel rok"]' "R231 CSV glava ZADNJI stolpec"
need "Izvozi naročila kot CSV" "R231 CSV gumb aria"
need "Pretekel rok" "R229 badge tekst"
need "border-border sm:h-[340px]" "R231 map-measure žeton"
need "bg-muted text-roksal-ink" "R229 Inox chip žeton"
need "bg-roksal-navy text-white hover:bg-roksal-navy/90" "R232 cv-studio bbox žeton"
echo "NEEDLE FAIL=$FAIL"

agent-browser close --all > /dev/null 2>&1
echo "=== R234 prod probe KONEC ==="
