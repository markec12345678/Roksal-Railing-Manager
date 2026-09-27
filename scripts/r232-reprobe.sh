#!/bin/bash
# R232 reprobe — 3 chunk-MISSi iz prod probe = chunk NI bil v seji (r230/r231
# lekcija; NI regresija). DOM dokazi (hitri reprobe brez prenosa čankov) +
# byte dokazi po obisku manjkajočih zavihkov (ar → map-measure, crm →
# deal-pipeline, catalog → Inox chip):
#  R1 map-measure: zemljevid 'border-border sm:h-[340px]' ŽIVO + stone ODSOTEN;
#  R2 deal-pipeline (CRM): NACRTOVANO head 'from-muted' ŽIVO + stone ODSOTEN;
#  R3 roksal-catalog: Inox chip 'bg-muted text-roksal-ink' ŽIVO;
#  R4 byte dokaz: ponovni zbir čankov po vseh treh zavihkih → needleji.
# ZERO-MUTACIJA: samo bralni pogledi.
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

echo "=== prijava ==="
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

echo "=== R1: map-measure (tab 'ar') — zemljevid žeton ŽIVO ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'ar',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('div[class*=\"sm:h-[340px]\"]');})()" 20
agent-browser eval "(()=>{const z=document.querySelector('div[class*=\"sm:h-[340px]\"]'); if(!z) return JSON.stringify({zemljevid:false}); return JSON.stringify({zemljevid:true, zeton:z.className.includes('border-border'), stone:z.className.includes('stone-'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-reprobe-map.png" > /dev/null 2>&1

echo "=== R2: deal-pipeline (CRM) — NACRTOVANO head from-muted ŽIVO ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'crm'}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return document.body.textContent.includes('Načrtovano');})()" 20
sleep 2
agent-browser eval "(()=>{const h=[...document.querySelectorAll('*')].find(el=>el.className&&typeof el.className==='string'&&el.className.includes('from-muted')); if(!h) return JSON.stringify({head:false}); return JSON.stringify({head:true, fromMuted:h.className.includes('from-muted'), stone:h.className.includes('stone-'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-reprobe-crm.png" > /dev/null 2>&1

echo "=== R3: roksal-catalog — Inox chip bg-muted text-roksal-ink ŽIVO ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'catalog'}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return document.body.textContent.includes('Inox');})()" 20
sleep 2
agent-browser eval "(()=>{const c=[...document.querySelectorAll('*')].find(el=>el.className&&typeof el.className==='string'&&el.className.includes('bg-muted')&&el.className.includes('text-roksal-ink')&&el.textContent.trim()==='Inox'); if(!c) return JSON.stringify({inoxChip:false}); return JSON.stringify({inoxChip:true, cls:c.className.slice(0,80), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-reprobe-katalog.png" > /dev/null 2>&1

echo "=== R4: byte dokaz — zbir čankov po vseh treh zavihkih ==="
OUT=/tmp/r232-reprobe-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'ar',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'crm'}})); return 'nav';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'catalog'}})); return 'nav';})()" > /dev/null 2>&1
sleep 3
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
need "border-border sm:h-[340px]" "R231 map-measure zemljevid žeton (byte)"
need "from-muted" "R230 deal-pipeline NACRTOVANO head žeton (byte)"
need "bg-muted text-roksal-ink" "R229 Inox chip žeton (byte)"
echo "NEEDLE FAIL=$FAIL"

agent-browser close --all > /dev/null 2>&1
echo "=== R232 reprobe KONEC ==="
