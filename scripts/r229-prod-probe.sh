#!/bin/bash
# R229 prod probe — recheck R228 ŽIVO (nova tema 'Zamujena dobava', strogost
# brez mutacij — naročil 0 v prodi):
#  Z1 vodja pregled: kartica 'Zamujena dobava' ODSOTNA (iskreno prazno —
#     vidna LE ko > 0) + Brez dobavitelja (8) ŽIVO + Nizka zaloga kartica
#     (pod 1 + na 0 = 1, rdeča družina) + 'Vse v redu' NE sme biti (brez=8);
#  Z2 CSV capture (createObjectURL patch — R226 lekcija 5): vrstica
#     '"Opozorila","Zamujena dobava","0"' (IZVOŽENO = ZASLON tudi ko 0)
#     + regresiji Brez 8 / Nizka 1;
#  Z3 Domov regresija: kartica 'Brez dobavitelja (8)' + PackageX + amber;
#  Z4 geselni žetoni regresija (obroba ≠ stone, label muted — R227);
#  Z5 temna + __err null + health;
#  Z6 deployed čanki: needleji R228 v odposlanih čankih (vodja kartica,
#     lib števec, CSV vrstica, PDF vrstica) + negativni team-tab stone dvojček.
# ZERO-MUTACIJA: samo bralni pogledi/dialogi — nič ne piše v DB.
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

echo "=== Z1: vodja pregled — strogost R228 (naročil 0 → kartica ODSOTNA) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
pocakaj_na "(()=>{const h2=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Pregled za vodjo'&&x.closest('div.space-y-4')); return !!h2;})()" 12
sleep 2
agent-browser eval "(()=>{const zam = [...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava ('));
const brez = document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');
const nizka = [...document.querySelectorAll('div.text-xs.font-medium')].find(x=>x.textContent.includes('materialov z nizko zalogo'));
const vse = [...document.querySelectorAll('div.text-xs.font-medium')].find(x=>x.textContent.trim()==='Vse v redu — ni opozoril');
const brezM = brez ? (brez.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/)||[])[1] : null;
return JSON.stringify({zamujenaOdsotna:!zam, brezStevilka:brezM, nizkaKartica:!!nizka, nizkaTekst:nizka?nizka.textContent.trim():null, vseVReduOdsotna:!vse, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r229-prod-vodja.png" > /dev/null 2>&1

echo "=== Z2: CSV vodje — 'Zamujena dobava','0' (IZVOŽENO = ZASLON tudi ko 0) ==="
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]');})()" 12
agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ new Response(b).text().then(t=>{window.__csv=t;}); return orig(b); }; return 'patched';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{window.__csv=null; const b=document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]'); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return typeof window.__csv==='string'&&window.__csv.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__csv; if(typeof t!=='string') return JSON.stringify({csv:false,err:window.__err??null}); const cist=t.replace(/^\uFEFF/,''); return JSON.stringify({csv:true, zamujena0:cist.includes('\"Opozorila\",\"Zamujena dobava\",\"0\"'), brez8:cist.includes('\"Opozorila\",\"Brez dobavitelja\",\"8\"'), nizka1:cist.includes('\"Opozorila\",\"Nizka zaloga\",\"1\"'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r229-prod-vodja-csv.png" > /dev/null 2>&1

echo "=== Z3: Domov regresija — kartica 'Brez dobavitelja (8)' ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({kartica:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const ikona=!!k.querySelector('svg.lucide-package-x'); return JSON.stringify({kartica:true, stevec:m?m[1]:null, ikonaPackageX:ikona, amber:k.className.includes('roksal-amber'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r229-prod-domov.png" > /dev/null 2>&1

echo "=== Z4: geselni žetoni regresija (R227) ==="
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
sleep 1
pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Zamenjaj geslo'));})()" 8
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Zamenjaj geslo')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return !!document.querySelector('#pwd-current');})()" 8
sleep 1
agent-browser eval "(()=>{const inp=document.querySelector('#pwd-current'); if(!inp) return JSON.stringify({dialog:false}); const barva=getComputedStyle(inp).borderTopColor; const label=document.querySelector('label[for=\"pwd-current\"]'); const lbarva=label?getComputedStyle(label).color:null; return JSON.stringify({dialog:true, obroba:barva, obrobaNiStone:barva!=='rgb(214, 211, 209)'&&barva!=='rgb(231, 229, 228)', labelBarva:lbarva, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r229-prod-geslo.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
sleep 1

echo "=== Z5: temna + __err + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r229-prod-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== Z6: deployed čanki — needleji R228 (byte-verifikacija) ==="
OUT=/tmp/r229-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
# Obišči še Zalogo (naročilni tok čanki) pred zbiranjem URL-jev
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
sleep 4
# eval vrača JSON kodiran niz ("[\"url\",...]") — python3 parser (r229 lekcija:
# tr/sed iz r168 NE preživi današnje eval izhode z \u0161umom)
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
need "Zamujena dobava — " "R228 vodja kartica naslov"
need "odpre Material → Naročila" "R228 kartica aria dejanje"
need "Obljubljeni datum dobave je pretekel, naročilo pa še ni prejeto" "R228 kartica title"
need "steviloZamujenihDobav" "R228 lib števec (client čanki)"
need "'Opozorila', 'Zamujena dobava'" "R228 CSV vrstica (IZVOŽENO = ZASLON)"
need "z pretečenim rokom dobave — izterjaj dobavo pri dobavitelju" "R228 PDF opozorila vrstica"
need "bg-muted text-muted-foreground" "R228 team-tab žetoni"
if grep -rqF -- "border-stone-200 dark:border-stone-700" "$OUT" 2>/dev/null; then
  echo "MISS : team-tab stone dvojček ŠE VEDNO v odposlanih čankih"; FAIL=1
else
  echo "OK   : team-tab stone dvojček izginil iz odposlanih čankov"
fi
echo "NEEDLE FAIL=$FAIL"

agent-browser close --all > /dev/null 2>&1
echo "=== R229 prod probe KONEC ==="
