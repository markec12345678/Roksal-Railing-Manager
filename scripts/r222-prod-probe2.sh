#!/bin/bash
# R222 prod probe #2 — robusten login (marker: top-bar iskalnik) + paleta
# quick 'Zaloga' navigacija (dokazana pot, r221 lekcija 5) + roksal:navigate
# fallback (R214 EN VIR usmerjanja — javni protokol aplikacije).
# ZERO-MUTACIJA: vse interakcije so odjemalski filtri pogleda — nič ne piše v DB.
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

echo "=== cakanje na prijavo (marker: 'Odpri iskalnik' v top-bar) ==="
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

echo "=== DIAG: nav vsebina (zakaj 'Zaloga' query ni zadela) ==="
agent-browser eval "(()=>{const nb=[...document.querySelectorAll('nav button, nav a')].map(b=>b.textContent.trim().slice(0,20)); return JSON.stringify({navGumbov:nb.length,prvih:nb.slice(0,10)});})()" 2>&1 | tail -1

echo "=== NAV: paleta quick 'Zaloga' vrstica (data-value auto = tekst) ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" 2>&1 | tail -1
for i in $(seq 1 8); do
  R=$(agent-browser eval "(()=>{return !!document.querySelector('[cmdk-input]');})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then echo "  paleta odprta (poskus $i)"; break; fi
  sleep 1.5
done
sleep 2
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('[cmdk-item]')].filter(e=>e.textContent.trim()==='Zaloga'); if(vr.length){vr[0].dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik quick Zaloga ('+vr.length+')';} return 'ni quick vrstice';})()" 2>&1 | tail -1
sleep 2
R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom'));})()" 2>&1 | tail -1)
if [ "$R" != "true" ]; then
  echo "  quick vrstica ni zadela → roksal:navigate fallback (R214 javni protokol)"
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory',more:null,subTab:null,osnutek:null,filter:null}})); return 'event';})()" 2>&1 | tail -1
  sleep 3
fi

pocakaj_na() {
  local pred="$1" maks="${2:-10}" R
  for i in $(seq 1 "$maks"); do
    R=$(agent-browser eval "$pred" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then echo "  najdeno (poskus $i)"; return 0; fi
    sleep 1.5
  done
  echo "  NI NAJDENO (zadnji: $R)"; return 1
}

echo "=== Z1 R220 ŽIVO (regresija): čip 'Na minimumu' + 'Brez dobavitelja' čaka R221 ==="
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom'));})()" 12
agent-browser eval "(()=>{const st=t=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes(t)); return b?{aria:b.getAttribute('aria-pressed'),tekst:b.textContent.trim().slice(0,40),amber:b.className.includes('amber'),title:b.getAttribute('title')}:null}; return JSON.stringify({pod:st('Pod minimumom'),na:st('Na minimumu'),brez:st('Brez dobavitelja'),err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2 trio izključnost (R220 dežela; R221 trio bo recheck naslednji deploy) ==="
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes('Pod minimumom')); if(!b) return 'ni'; b.click(); return 'klik pod';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const st=t=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes(t)); return b?b.getAttribute('aria-pressed'):null}; const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>!d.textContent.includes('Ni artiklov')); const prazno=[...document.querySelectorAll('div,p')].some(e=>e.textContent.trim()==='Ni artiklov z zalogou pod minimalno v izbranem tipu')||[...document.querySelectorAll('div,p')].some(e=>/Ni artiklov.*minimal/i.test(e.textContent.trim())&&e.children.length===0); return JSON.stringify({pod:st('Pod minimumom'),na:st('Na minimumu'),brez:st('Brez dobavitelja'),vrstic:vrstice.length,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r222-pod-chip-zivo.png" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes('Pod minimumom')); if(!b) return 'ni'; b.click(); return 'izklop pod';})()" 2>&1 | tail -1
sleep 2

echo "=== Z3 paleta: R220/R221 vrstice (brez vrstica LE ko brezCount>0 v prod) ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" 2>&1 | tail -1
for i in $(seq 1 8); do
  R=$(agent-browser eval "(()=>{return !!document.querySelector('[cmdk-input]');})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then break; fi
  sleep 1.5
done
sleep 3
agent-browser eval "(()=>{const vse=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nizka zaloga pokaži vse'); const brez=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='brez dobavitelja pokaži v Zalogi'); const na=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nizka zaloga na minimumu'); return JSON.stringify({vseR219:vse?'ŽIVO':'SKRITA',naR220:na?(na.getAttribute('data-value')?'ŽIVO':'?'):'SKRITA (naMin=0 po oblikovanju)',brezR221:brez?'ŽIVO':'SKRITA (brezCount=0 ali R221 ni živ)'});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 1

echo "=== Z4 sejni chunk scan (R221 needleji + regresije; R221 absent = deploy ni živ) ==="
agent-browser eval "(async()=>{const u=window.performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')); const iz={}; const needli=['Brez dobavitelja — pokaži v Zalogi','brez-dobavitelja','Pokaži samo artikle brez vpisane dobaviteljske cene','Ni artiklov brez vpisane dobaviteljske cene v izbranem tipu','Na minimumu — pokaži v Zalogi','Pod minimumom','nizka zaloga pokaži vse','Naročilnica kot osnutek naročila','Nizka zaloga','Naroči material','Shrani kot osnutek','Material — Naročila (V5)','Meritev ni bilo mogoče naložiti','Osveženo ob']; for(const url of u){try{const t=await (await fetch(url)).text(); for(const n of needli){if(t.includes(n)) iz[n]=(iz[n]||0)+1;}}catch(e){}} return JSON.stringify({chunkov:u.length,zadetki:iz,err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5 temna + __err ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Preklopi na temno temo'); if(t){t.click(); return 'temna klik';} return 'že temna ali ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const html=document.documentElement; const temna=html.classList.contains('dark'); return JSON.stringify({temna,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r222-temna2.png" > /dev/null 2>&1
agent-browser close --all > /dev/null 2>&1
echo "KONEC R222 probe2"
