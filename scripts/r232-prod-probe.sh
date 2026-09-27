#!/bin/bash
# R232 prod probe — recheck R231 ŽIVO ('izvozi' družina: Naročila CSV stolpec
# 'Pretekel rok' + a11y gumb; map-measure/measurements žetoni; brez mutacij —
# zamujeneDobave = 0 v prodi):
#  Z1 Domov: Brez 8 ŽIVO + kartica Zamujena ODSOTNA (fail-closed) + Nizka 7
#     (prvič v prod probe — opcijska R232 točka iz r231 workloga);
#  Z2 Material → Naročila: CSV gumb aria-label 'Izvozi naročila kot CSV' + title
#     ŽIVO + FAIL-CLOSED klik (0 naročil → nič se ne izvozi, brez __csv, err null);
#  Z3 CSV vodje regresija (R228): '"Opozorila","Zamujena dobava","0"' + brez8;
#  Z4 geselni žetoni regresija (obroba ≠ stone) + temna + err null + health;
#  Z5 deployed čanki: needleji R231 (CSV glava/gumb, map-measure, measurements)
#     + NEGATIVNI (stone dvojčki konvertiranih izginili) + regresije R228–R230.
# ZERO-MUTACIJA: samo bralni pogledi — nič ne piše v DB.
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

pocakaj_na() {
  local pred="$1" maks="${2:-10}" R
  for i in $(seq 1 "$maks"); do
    R=$(agent-browser eval "$pred" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then echo "  najdeno (poskus $i)"; return 0; fi
    sleep 1.5
  done
  echo "  NI NAJDENO (zadnji: $R)"; return 1
}

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1

echo "=== prijava (marker: 'Odpri iskalnik') ==="
PRIJAVA="ni"
for i in $(seq 1 20); do
  R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then echo "  prijava OK (poskus $i)"; PRIJAVA="ok"; break; fi
  sleep 3
done
if [ "$PRIJAVA" != "ok" ]; then echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; fi
sleep 2
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

echo "=== Z1: Domov — Brez 8 + Zamujena ODSOTNA + Nizka 7 (prvič v probe) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({kartica:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const ikona=!!k.querySelector('svg.lucide-package-x');
const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava ('));
const nizka=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Nizka zaliha ('));
const nm=nizka?(nizka.getAttribute('aria-label').match(/Nizka zaliha \((\d+)\)/)||[])[1]:null;
return JSON.stringify({kartica:true, brezSt:m?m[1]:null, ikonaPackageX:ikona, amber:k.className.includes('roksal-amber'), zamujenaOdsotna:!zam, nizkaVidna:!!nizka, nizkaSt:nm, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-prod-domov.png" > /dev/null 2>&1

echo "=== Z2: Material → Naročila — CSV gumb R231 ŽIVO + fail-closed klik (0 naročil) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'material',subTab:'orders'}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Naročila')); return !!b;})()" 12
sleep 2
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); if(!g) return JSON.stringify({gumb:false}); return JSON.stringify({gumb:true, title:g.getAttribute('title'), tekst:g.textContent.trim(), err:window.__err??null});})()" 2>&1 | tail -1
# fail-closed klik: 0 naročil → handleOrdersCsv zgodnji return — NI __csv, NI napake
agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ new Response(b).text().then(t=>{window.__csv=t;}); return orig(b); }; return 'patched';})()" > /dev/null 2>&1
agent-browser eval "(()=>{window.__csv=null; const g=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); if(!g) return 'ni gumba'; g.click(); return 'klik poslan';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{return JSON.stringify({csvNastal:typeof window.__csv==='string', praznoVidno:document.body.textContent.includes('Ni naročil'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-prod-narocila-csv.png" > /dev/null 2>&1

echo "=== Z3: CSV vodje regresija (R228 — 'Zamujena dobava','0') ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]');})()" 12
agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ new Response(b).text().then(t=>{window.__csvV=t;}); return orig(b); }; return 'patched';})()" > /dev/null 2>&1
agent-browser eval "(()=>{window.__csvV=null; const b=document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]'); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return typeof window.__csvV==='string'&&window.__csvV.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__csvV; if(typeof t!=='string') return JSON.stringify({csv:false,err:window.__err??null}); const cist=t.replace(/^\uFEFF/,''); return JSON.stringify({csv:true, zamujena0:cist.includes('\"Opozorila\",\"Zamujena dobava\",\"0\"'), brez8:cist.includes('\"Opozorila\",\"Brez dobavitelja\",\"8\"'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-prod-vodja-csv.png" > /dev/null 2>&1

echo "=== Z4: geselni žetoni regresija ==="
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
sleep 1
pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Zamenjaj geslo'));})()" 8
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Zamenjaj geslo')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return !!document.querySelector('#pwd-current');})()" 8
sleep 1
agent-browser eval "(()=>{const inp=document.querySelector('#pwd-current'); if(!inp) return JSON.stringify({dialog:false}); const barva=getComputedStyle(inp).borderTopColor; return JSON.stringify({dialog:true, obroba:barva, obrobaNiStone:barva!=='rgb(214, 211, 209)'&&barva!=='rgb(231, 229, 228)', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-prod-geslo.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
sleep 1

echo "=== Z4b: temna + __err + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-prod-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== Z5: deployed čanki — needleji R231 (byte-verifikacija) + NEGATIVNI ==="
OUT=/tmp/r232-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'material',subTab:'orders'}})); return 'nav';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
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
echo "  --- R231 pozitivni ---"
need '"Opombe","Pretekel rok"]' "R231 CSV glava stolpec ZADNJI (kompilirana oblika)"
need "Izvozi naročila kot CSV" "R231 CSV gumb aria-label"
need "Izvozi vsa naročila (neodvisno od statusnega filtra) kot CSV za Excel" "R231 CSV gumb title"
need "border-border sm:h-[340px]" "R231 map-measure zemljevid žeton"
need "bg-muted text-muted-foreground border-border" "R231 measurements verdict žeton"
echo "  --- R231 negativni (stone dvojčki izginili iz prodi čankov) ---"
must_miss "border-stone-200 sm:h-[340px]" "map-measure zemljevid stone obroba"
must_miss "border-stone-200 bg-stone-50 p-3 text-xs text-stone-700" "map-measure share polje stone dvojček"
echo "  --- regresije R228-R230 ---"
need "R228: orders mora biti seznam naročil" "R228 lib (kompilirana oblika)"
need '"Opozorila","Zamujena dobava"' "R228 CSV vrstica (kompilirana oblika)"
need "Pretekel rok" "R229 badge tekst"
need "Zamujena dobava (" "R230 Domov kartica aria (delci)"
need "from-muted" "R230 deal-pipeline NACRTOVANO head žeton"
need "bg-muted text-roksal-ink" "R229 Inox chip žeton"
echo "NEEDLE FAIL=$FAIL"

agent-browser close --all > /dev/null 2>&1
echo "=== R232 prod probe KONEC ==="
