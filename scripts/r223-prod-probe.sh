#!/bin/bash
# R223 prod probe — določi, KATERI deploy je živ (žig 17:02:16: R221 ali R222?)
# + regresija: R223 Domov kartica ŠE NE SME biti v prodi (runda ni pushana).
# ZERO-MUTACIJA: samo odjemalski filtri pogleda, nič ne piše v DB.
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

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

echo "=== CHUNK SCAN: R221/R222/R223 needleji v naloženih skriptah ==="
agent-browser eval "(()=>{return JSON.stringify([...new Set([...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')))]);})()" 2>&1 | tail -1 > /tmp/r223-prod-scriptrc.json
python3 - <<'EOF'
import json, re
srcs = json.load(open('/tmp/r223-prod-scriptrc.json'))
open('/tmp/r223-prod-scriptrc.txt','w').write('\n'.join(srcs))
print('skript:', len(srcs))
EOF
rm -rf /tmp/r223-prod-chunks && mkdir -p /tmp/r223-prod-chunks && cd /tmp/r223-prod-chunks
while read -r s; do
  f=$(basename "$s"); [ -f "$f" ] || curl -s -m 15 "$PROD$s" -o "$f"
done < /tmp/r223-prod-scriptrc.txt
echo "  preneseno: $(ls *.js 2>/dev/null | wc -l) datotek"
echo "-- R221 needleji (Zaloga čip/paleta) --"
for n in 'Brez dobavitelja — pokaži v Zalogi' 'Na minimumu — pokaži v Zalogi' 'Pokaži samo artikle brez vpisane dobaviteljske cene'; do
  k=$(rg -l --fixed-strings "$n" *.js 2>/dev/null | wc -l); echo "  $n: $k"
done
echo "-- R222 needleji (paleta badge + zgodovina + zvonček) --"
for n in 'Preveri nabavne cene' 'Ni nizke zaloge, ni artiklov brez dobavitelja' '— brez vpisane dobaviteljske cene, odpre Zalogo'; do
  k=$(rg -l --fixed-strings "$n" *.js 2>/dev/null | wc -l); echo "  $n: $k"
done
echo "-- R223 needle (Domov kartica — MORA biti 0, runda ni pushana) --"
for n in 'naročilni tok postavke ne more oceniti'; do
  k=$(rg -l --fixed-strings "$n" *.js 2>/dev/null | wc -l); echo "  $n: $k"
done
cd /home/z/my-project

echo "=== ZALOGA: trio čipov (R221 ŽIVO?) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory',more:null,subTab:null,osnutek:null,filter:null}})); return 'event';})()" > /dev/null 2>&1
for i in $(seq 1 12); do
  R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom'));})()" 2>&1 | tail -1)
  [ "$R" = "true" ] && { echo "  Zaloga pripravljena (poskus $i)"; break; }
  sleep 1.5
done
agent-browser eval "(()=>{const st=t=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes(t)); return b?{pressed:b.getAttribute('aria-pressed'),amber:b.className.includes('amber'),rdeca:b.className.includes('roksal-red')}:null}; return JSON.stringify({pod:st('Pod minimumom'),na:st('Na minimumu'),brez:st('Brez dobavitelja'),err:window.__err??null});})()" 2>&1 | tail -1

echo "=== DOMOV: R223 kartica NE SME obstajati (regresija) + rdeči fingerprint ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard'}})); return 'event';})()" > /dev/null 2>&1
for i in $(seq 1 12); do
  R=$(agent-browser eval "(()=>{return document.body.textContent.includes('Nizka zaloga')||document.body.textContent.includes('Zaloga v redu');})()" 2>&1 | tail -1)
  [ "$R" = "true" ] && { echo "  Domov pripravljen (poskus $i)"; break; }
  sleep 1.5
done
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); return JSON.stringify({r223Kartica:!!k, rdecaNizka:document.body.textContent.includes('Nizka zaloga materiala'), zelenoOk:document.body.textContent.includes('Zaloga v redu'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r223-prod-domov.png" > /dev/null 2>&1

echo "=== temna + health ==="
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Preklopi na temno temo'); if(d){d.click(); return 'tema klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
curl -s --max-time 15 "$PROD/api/public/health"; echo
agent-browser close --all > /dev/null 2>&1
echo "=== KONEC r223-prod-probe ==="
