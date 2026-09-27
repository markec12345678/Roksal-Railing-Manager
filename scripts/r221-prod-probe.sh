#!/bin/bash
# R221 prod probe — R220 deploy recheck (žig 15:34:10 > R218 13:46:46 = ŽIVO).
# Kontekst: R219 NI dobil deploymenta (Vercel je preskočil — ni ga v GitHub
# deployments listi), R220 (9dee715, vsebuje R219 spremembe linearno) je ŽIVO.
# Dokazi (fingerprints iz workloga R220):
#   Z1 R220 F1 ŽIVO: čip 'Na minimumu' v Zalogi — klik → aria-pressed=true,
#      'Pod minimumom' ponižan (medsebojna izključnost ŽIVO), toggle OFF nazaj.
#   Z2 iskreno prazno stanje PER čip (če prod podatki nimajo artikla na min).
#   Z3 paleta: vrstica 'nizka zaloga na minimumu' (vidna LE ko naMin>0 v prod)
#      + regresija 'nizka zaloga pokaži vse' (R219).
#   Z4 sejni chunk scan (R220 needleji + R219 regresije) + temna + __err.
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
sleep 12
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

echo "=== Z1 R220 ŽIVO: Zaloga — čip 'Na minimumu' medsebojna izključnost ==="
agent-browser eval "(()=>{const n=[...document.querySelectorAll('nav button, nav a')].find(b=>b.textContent.trim()==='Zaloga'); if(n){n.click(); return 'klik Zaloga';} return 'ni Zaloga v nav';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom'));})" 12
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); return JSON.stringify({podAria:pod?pod.getAttribute('aria-pressed'):'BREZ',podTekst:pod?pod.textContent.trim():null,naAria:na?na.getAttribute('aria-pressed'):'BREZ',naTekst:na?na.textContent.trim():null,naTitle:na?na.getAttribute('title'):null,naLabel:na?na.getAttribute('aria-label'):null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); if(!na) return 'ni čipa'; na.click(); return 'klik Na minimumu';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>!d.textContent.includes('Ni artiklov')); const prazno=[...document.querySelectorAll('div,p')].some(e=>e.textContent.trim()==='Ni artiklov točno na minimalni zalogi v izbranem tipu'); return JSON.stringify({naPritisnjen:na?na.getAttribute('aria-pressed'):null,podPritisnjen:pod?pod.getAttribute('aria-pressed'):null,vrstic:vrstice.length,iskrenoPrazno:prazno,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r221-naminimumu-chip-zivo.png" > /dev/null 2>&1
agent-browser eval "(()=>{const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); if(!na) return 'ni čipa'; na.click(); return 'klik izklop';})()" 2>&1 | tail -1
sleep 2

echo "=== Z3 paleta: 'nizka zaloga na minimumu' vrstica + R219 regresija ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return !!document.querySelector('[cmdk-input]');})" 8
sleep 3
agent-browser eval "(()=>{const na=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nizka zaloga na minimumu'); const vse=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nizka zaloga pokaži vse'); return JSON.stringify({naVrstica:na?na.textContent.trim().slice(0,70):'SKRITA (naMin=0 v prod — po oblikovanju)',vseVrstica:vse?vse.textContent.trim().slice(0,70):'SKRITA'});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 1

echo "=== Z4 sejni chunk scan (R220 needleji + R219 regresije) ==="
agent-browser eval "(async()=>{const u=window.performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')); const iz={}; const needli=['Na minimumu — pokaži v Zalogi','na-minimumu','Pokaži samo artikle na minimalni zalogi','Ni artiklov točno na minimalni zalogi v izbranem tipu','točno na minimumu','Pod minimumom','nizka zaloga pokaži vse','Naročilnica kot osnutek naročila','Nizka zaloga','Naroči material','Shrani kot osnutek','Material — Naročila (V5)','Meritev ni bilo mogoče naložiti','Osveženo ob']; for(const url of u){try{const t=await (await fetch(url)).text(); for(const n of needli){if(t.includes(n)) iz[n]=(iz[n]||0)+1;}}catch(e){}} return JSON.stringify({chunkov:u.length,zadetki:iz,err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5 temna + __err ==="
agent-browser eval "(()=>{return JSON.stringify({err:window.__err??null});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1
echo "KONEC R221 probe"
