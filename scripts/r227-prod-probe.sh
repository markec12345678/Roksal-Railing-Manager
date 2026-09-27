#!/bin/bash
# R227 prod probe — recheck R226 ŽIVO:
#  Z1 Zaloga CSV capture → glava vsebuje 'Brez dobavitelja' + brezDA = 8 (R226 feature)
#  Z2 vodja pregled → trdeKlas:0 (razširjen vzorec) + pika NA ŽETONU (bg-muted-foreground, NI stone) (R226 stil)
#  Z3 Domov regresija → kartica 'Brez dobavitelja (8)' + trio čipi prisotni
#  Z4 temna tema + __err null
# ZERO-MUTACIJA: vse interakcije odjemalski pogled/filtriranje + CSV izvoz (blob) — nič ne piše v DB.
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

echo "=== Z1: Zaloga (roksal:navigate inventory) + CSV capture — R226 stolpec ŽIVO? ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot CSV\"]');})()" 12
# patch capture: R226 lekcija — URL.createObjectURL → Response.text → window.__csv
agent-browser eval "(()=>{window.__csv=null; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ new Response(b).text().then(t=>{window.__csv=t;}); return orig(b); }; return 'patched';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{window.__csv=null; const b=document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot CSV\"]'); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return typeof window.__csv==='string'&&window.__csv.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__csv; if(typeof t!=='string') return JSON.stringify({csv:false,err:window.__err??null}); const cist=t.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r\n/).filter(x=>x.trim()!==''); const cel=vrstice.map(v=>v.split(';')); const brezIdx=cel[0].indexOf('Brez dobavitelja'); const nizkaIdx=cel[0].indexOf('Nizka'); const telo=cel.slice(1); const brezDA=telo.filter(c=>c[brezIdx]==='DA').length; const nizkaDA=telo.filter(c=>c[nizkaIdx]==='DA').length; return JSON.stringify({csv:true, glavaBrez:brezIdx>=0, glavaNizka:nizkaIdx>=0, vrstic:telo.length, brezDA, nizkaDA, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r227-zaloga-csv.png" > /dev/null 2>&1

echo "=== Z2: vodja pregled — trdeKlas:0 + pika žeton (R226 stil ŽIVO?) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
sleep 5
pocakaj_na "(()=>{const h2=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Pregled za vodjo'&&x.closest('div.space-y-4')); return !!h2;})()" 12
agent-browser eval "(()=>{const h2=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Pregled za vodjo'&&x.closest('div.space-y-4')); if(!h2) return JSON.stringify({vodja:false}); const root=h2.closest('div.space-y-4'); const trde=[...root.querySelectorAll('*')].filter(el=>{const c=el.getAttribute('class')||''; return /(?:border|bg|text)-(?:blue|green|red|purple|amber|slate|gray|zinc|neutral|stone|yellow|orange|violet|indigo|emerald|teal|cyan|sky|rose)-\d{2,3}/.test(c);}); const kartice=[...root.querySelectorAll('.rounded-xl')]; const nizkaK=kartice.find(c=>c.textContent.includes('materialov z nizko zalogo')); const pika=[...root.querySelectorAll('span.h-2')].find(s=>{const o=s.closest('.rounded-lg'); return o&&o.textContent.includes('Zapadlo');}); const pikaBarva=pika?getComputedStyle(pika).backgroundColor:null; return JSON.stringify({vodja:true, trdeKlas:trde.length, prviTrje:trde.slice(0,2).map(e=>e.className.slice(0,60)), pikaNajdena:!!pika, pikaStone:!!(pika&&(pika.className.includes('stone'))), pikaBarva, nizkaRed:!!(nizkaK&&nizkaK.className.includes('bg-roksal-red/5')), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r227-vodja.png" > /dev/null 2>&1

echo "=== Z3: Domov regresija — kartica 'Brez dobavitelja (8)' + trio čipi 8/8 ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
sleep 5
pocakaj_na "(()=>{return document.body.textContent.includes('Brez dobavitelja');})()" 12
agent-browser eval "(()=>{const kartica=[...document.querySelectorAll('button,[role=\"button\"],div')].find(e=>/Brez dobavitelja \(\d+\)/.test(e.textContent.trim())&&e.textContent.length<400); const trio=['Pod minimumom','Na minimumu','Brez dobavitelja'].map(t=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes(t)); return b?t+':'+b.getAttribute('aria-pressed'):t+':ni';}); const am=[...document.querySelectorAll('span')].filter(s=>s.className.includes('PackageX')||s.closest('[class*=\"PackageX\"]')); return JSON.stringify({domovKartica:!!kartica, karticaTekst:kartica?kartica.textContent.trim().slice(0,80):null, trio, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r227-domov.png" > /dev/null 2>&1

echo "=== Z4: temna tema + __err ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r227-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

agent-browser close --all > /dev/null 2>&1
echo "=== R227 prod probe KONEC ==="
