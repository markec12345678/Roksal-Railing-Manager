#!/bin/bash
# R222 prod probe — R221 deploy recheck (žig > 15:34:10 = ŽIVO).
# Kontekst (worklog R221): R221 (5a6a0d6) pushan ~16:11 UTC; R220 žig 15:34:10.
# Dokazi (fingerprints iz workloga R221):
#   Z1 R221 F1 ŽIVO: tretji čip 'Brez dobavitelja' v Zalogi — klik →
#      aria-pressed=true, 'Pod minimumom' + 'Na minimumu' ponižana (trio
#      izključnost ŽIVO), toggle OFF nazaj.
#   Z2 medsebojna izključnost TROJCA ena smer: klik 'Pod' → brez ponižan.
#   Z3 paleta: 'brez-dobavitelja' vrstica (vidna LE ko brezCount>0 v prod —
#      v prod NEZNANO, po oblikovanju) + regresija 'nizka zaloga pokaži vse'.
#   Z4 sejni chunk scan (R221 needleji ×4 + regresije) + temna + __err.
# ZERO-MUTACIJA: vse interakcije so odjemalski filtri pogleda — nič ne piše v DB.
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "=== version + health (javno) ==="
curl -s "$PROD/api/public/version"; echo
curl -s "$PROD/api/public/health"; echo

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 15
# čakanje na prijavo (nav 'Zaloga' viden) — do 20 s dodatno
for i in $(seq 1 10); do
  R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('nav button, nav a')].some(b=>b.textContent.trim()==='Zaloga');})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then echo "  prijava OK (poskus $i)"; break; fi
  sleep 2
done
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

pocakaj_na() {
  local pred="$1" maks="${2:-10}" R
  for i in $(seq 1 "$maks"); do
    R=$(agent-browser eval "$pred" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then echo "  najdeno (poskus $i)"; return 0; fi
    sleep 1.5
  done
  echo "  NI NAJDENO (zadnji: $R)"; return 1
}

echo "=== Z1 R221 ŽIVO: Zaloga — tretji čip 'Brez dobavitelja' ==="
agent-browser eval "(()=>{const n=[...document.querySelectorAll('nav button, nav a')].find(b=>b.textContent.trim()==='Zaloga'); if(n){n.click(); return 'klik Zaloga';} return 'ni Zaloga v nav';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja'));})" 12
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); const cls=brez?brez.className:''; return JSON.stringify({brezAria:brez?brez.getAttribute('aria-pressed'):'BREZ',brezTekst:brez?brez.textContent.trim():null,brezTitle:brez?brez.getAttribute('title'):null,brezLabel:brez?brez.getAttribute('aria-label'):null,amberDruzina:cls.includes('amber'),podAria:pod?pod.getAttribute('aria-pressed'):'BREZ',naAria:na?na.getAttribute('aria-pressed'):'BREZ'});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); if(!brez) return 'ni čipa'; brez.click(); return 'klik Brez dobavitelja';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>!d.textContent.includes('Ni artiklov')); const prazno=[...document.querySelectorAll('div,p')].some(e=>e.textContent.trim()==='Ni artiklov brez vpisane dobaviteljske cene v izbranem tipu'); return JSON.stringify({brezPritisnjen:brez?brez.getAttribute('aria-pressed'):null,podPritisnjen:pod?pod.getAttribute('aria-pressed'):null,naPritisnjen:na?na.getAttribute('aria-pressed'):null,vrstic:vrstice.length,iskrenoPrazno:prazno,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r222-brez-chip-zivo.png" > /dev/null 2>&1
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); if(!brez) return 'ni čipa'; brez.click(); return 'klik izklop';})()" 2>&1 | tail -1
sleep 2

echo "=== Z2 trio izključnost ena smer: klik 'Pod' → 'Brez' ponižan ==="
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); if(!pod) return 'ni čipa'; pod.click(); return 'klik Pod';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); return JSON.stringify({podPritisnjen:pod?pod.getAttribute('aria-pressed'):null,brezPritisnjen:brez?brez.getAttribute('aria-pressed'):null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); if(!pod) return 'ni čipa'; pod.click(); return 'klik izklop Pod';})()" 2>&1 | tail -1
sleep 2

echo "=== Z3 paleta: 'brez-dobavitelja' vrstica + R219 regresija ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return !!document.querySelector('[cmdk-input]');})" 8
sleep 3
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='brez-dobavitelja'); const vse=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nizka zaloga pokaži vse'); return JSON.stringify({brezVrstica:brez?brez.textContent.trim().slice(0,70):'SKRITA (brezCount=0 v prod — po oblikovanju)',vseVrstica:vse?vse.textContent.trim().slice(0,70):'SKRITA'});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 1

echo "=== Z4 sejni chunk scan (R221 needleji + regresije) ==="
agent-browser eval "(async()=>{const u=window.performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')); const iz={}; const needli=['Brez dobavitelja — pokaži v Zalogi','brez-dobavitelja','Pokaži samo artikle brez vpisane dobaviteljske cene','Ni artiklov brez vpisane dobaviteljske cene v izbranem tipu','Na minimumu — pokaži v Zalogi','Pod minimumom','nizka zaloga pokaži vse','Naročilnica kot osnutek naročila','Nizka zaloga','Naroči material','Shrani kot osnutek','Material — Naročila (V5)','Meritev ni bilo mogoče naložiti','Osveženo ob']; for(const url of u){try{const t=await (await fetch(url)).text(); for(const n of needli){if(t.includes(n)) iz[n]=(iz[n]||0)+1;}}catch(e){}} return JSON.stringify({chunkov:u.length,zadetki:iz,err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5 temna preklop + __err ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Preklopi na temno temo'); if(t){t.click(); return 'temna klik';} return 'že temna ali ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const html=document.documentElement; const temna=html.classList.contains('dark')||(html.style.colorScheme==='dark')||getComputedStyle(html).backgroundColor==='rgb(15, 23, 36)'; return JSON.stringify({temna,ozadje:getComputedStyle(html).backgroundColor,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r222-temna.png" > /dev/null 2>&1
agent-browser close --all > /dev/null 2>&1
echo "KONEC R222 probe"
