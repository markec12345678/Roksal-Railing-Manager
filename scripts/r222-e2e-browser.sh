#!/bin/bash
# R222 E2E ŽIVO (vzorec r221 + lekcije: data-value NE value; native setter za
# cmdk input; remount prek paleta quick 'Zaloga' vrstice — nav klik NI veljavna
# pot): F1 'brez dobavitelja' druga dimenzija v obstoječih signalcih —
# Z1 Material zadetek badge (amber; rdeči SOBOJ na na-min artiklu) →
# Z2 izbor zapiše zgodovino z žigom (OBADVA badgea na zgodovinski vrstici) →
# Z3 zvonček brez vrstice (ISTI fetch) + klik → Zaloga z aktivnim čipom
# (R221 filter deep-link protokol ŽIVO) → Z4 EN VIR zasidranje (temp cena →
# WPC-120-A badge izgine iz SVEŽIH podatkov) → restore bajtnato.
# ZERO-MUTACIJA: r218/r220 raise + r221 temp cena/dobavitelj — vse obnovljeno.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r222-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R222-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- RAISE: 5 artiklov pod minimum (r218) + WPC-120-B (r220) ---"
node scripts/r218-min-tmp.cjs raise || { echo "RAISE FAIL — abort"; exit 1; }
node scripts/r220-min-tmp.cjs raise || { echo "RAISE220 FAIL — abort"; node scripts/r218-min-tmp.cjs restore; exit 1; }

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

zapri_vodic() {
  for i in 1 2 3 4 5; do
    agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
    sleep 1
  done
}
odpri_palet() {
  for i in 1 2 3 4; do
    agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'klik';} return 'ni gumba';})()" > /dev/null 2>&1
    sleep 3
    ODPRT=$(agent-browser eval "(()=>{return !!document.querySelector('[cmdk-input]');})()" 2>&1 | tail -1)
    if [ "$ODPRT" = "true" ]; then echo "paleta odprta (poskus $i)"; return 0; fi
    zapri_vodic
  done
  return 1
}
pocakaj_na() {
  local pred="$1" maks="${2:-10}" R
  for i in $(seq 1 "$maks"); do
    R=$(agent-browser eval "$pred" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then echo "  najdeno (poskus $i)"; return 0; fi
    sleep 1.5
  done
  echo "  NI NAJDENO (zadnji: $R)"; return 1
}
vnesi_iskalni() {  # native setter + input event (r220 lekcija — fill NE deluje na cmdk)
  local besedilo="$1"
  agent-browser eval "(()=>{const inp=document.querySelector('[cmdk-input]'); if(!inp) return 'ni inputa'; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,'$besedilo'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno $besedilo';})()" 2>&1 | tail -1
}
remount_zaloga() {  # dokazana pot (r221 lekcija 5 + r222 prod probe2): paleta quick 'Zaloga' vrstica
  agent-browser press Escape > /dev/null 2>&1
  sleep 1
  odpri_palet > /dev/null 2>&1
  sleep 1
  agent-browser eval "(()=>{const vr=[...document.querySelectorAll('[cmdk-item]')].filter(e=>e.textContent.trim()==='Zaloga'); if(vr.length){vr[0].dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik quick Zaloga';} return 'ni quick vrstice';})()" 2>&1 | tail -1
  pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom'));})" 12
}

echo "--- Z0: prijava ---"
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})" 20
zapri_vodic

echo "--- Z1 (F1 ŽIVO): Material zadetki 'WPC' nosita amber badge (rdeči SOBOJ na na-min) ---"
odpri_palet
vnesi_iskalni 'WPC'
pocakaj_na "(()=>{return [...document.querySelectorAll('[cmdk-item]')].some(e=>e.getAttribute('data-value')&&e.getAttribute('data-value').includes('WPC-120-A'));})" 12
sleep 2
agent-browser eval "(()=>{const hit=v=>{const e=[...document.querySelectorAll('[cmdk-item]')].find(x=>x.getAttribute('data-value')===v); if(!e) return null; return {rdec:e.textContent.includes('Nizka zaloga'), amber:e.textContent.includes('Brez dobavitelja'), aria:e.getAttribute('aria-label')||''};}; return JSON.stringify({wpcA:hit('WPC-120-A WPC-120-A')||hit('WPC Desk WPC-120-A')||(()=>{const e=[...document.querySelectorAll('[cmdk-item]')].find(x=>x.getAttribute('data-value')&&x.getAttribute('data-value').includes('WPC-120-A')); return e?{rdec:e.textContent.includes('Nizka zaloga'),amber:e.textContent.includes('Brez dobavitelja'),aria:e.getAttribute('aria-label')||''}:null})(), wpcB:(()=>{const e=[...document.querySelectorAll('[cmdk-item]')].find(x=>x.getAttribute('data-value')&&x.getAttribute('data-value').includes('WPC-120-B')); return e?{rdec:e.textContent.includes('Nizka zaloga'),amber:e.textContent.includes('Brez dobavitelja'),aria:e.getAttribute('aria-label')||''}:null})(), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r222-material-badge.png" > /dev/null 2>&1

echo "--- Z2: izbor WPC-120-B → Osnutek dialog (deep-link) → zgodovina z OBEMA žigoma ---"
agent-browser eval "(()=>{const e=[...document.querySelectorAll('[cmdk-item]')].find(x=>x.getAttribute('data-value')&&x.getAttribute('data-value').includes('WPC-120-B')); if(!e) return 'ni zadetka'; e.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik WPC-120-B';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return !!document.querySelector('[role=dialog]')&&document.body.textContent.includes('Naročilnica kot osnutek naročila');})" 10
agent-browser screenshot "$SS/qa-r222-osnutek-dialog.png" > /dev/null 2>&1
agent-browser press Escape > /dev/null 2>&1
sleep 1
odpri_palet
sleep 2
agent-browser eval "(()=>{const h=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nedavno WPC'); if(!h) return 'ni zgodovinske vrstice'; return JSON.stringify({vrstica:h.textContent.trim().slice(0,40), rdec:h.textContent.includes('Nizka zaloga'), amber:h.textContent.includes('Brez dobavitelja')});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 1

echo "--- Z3: zvonček — brez vrstice (ISTI fetch) + klik → Zaloga z aktivnim čipom ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'ni zvončka'; b.click(); return 'zvonček odprt';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return [...document.querySelectorAll('li button')].some(x=>x.textContent.includes('Brez vpisane cene pri katerem koli dobavitelju'));})" 15
agent-browser eval "(()=>{const vrstice=[...document.querySelectorAll('li button')].filter(x=>x.textContent.includes('Brez vpisane cene pri katerem koli dobavitelju')); const zB=vrstice.filter(x=>x.textContent.includes('Brez dobavitelja')); const aria=vrstice.length?vrstice[0].getAttribute('aria-label'):null; return JSON.stringify({brezVrstic:vrstice.length, zBadgeom:zB.length, prvaAria:aria, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r222-zvoncek-brez.png" > /dev/null 2>&1
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('li button')].find(x=>x.textContent.includes('Brez vpisane cene pri katerem koli dobavitelju')); if(!vr) return 'ni vrstice'; vr.click(); return 'klik brez vrstica';})()" 2>&1 | tail -1
pocakaj_na "(()=>{const c=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); return !!c&&c.getAttribute('aria-pressed')==='true';})" 12
agent-browser eval "(()=>{const c=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); return JSON.stringify({brezPritisnjen:c?c.getAttribute('aria-pressed'):null, brezAmber:!!(c&&c.className.includes('amber')), podPonizen:pod?pod.getAttribute('aria-pressed'):null, vrstic:[...document.querySelectorAll('.divide-y > div')].filter(d=>!d.textContent.includes('Ni artiklov')).length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r222-deeplink-chip.png" > /dev/null 2>&1

echo "--- Z4: EN VIR zasidranje ŽIVO — temp cena na WPC-120-A → sveži podatki: badge izgine ---"
node scripts/r221-brez-tmp.cjs raise || { echo "RAISE221 FAIL — abort"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
remount_zaloga
odpri_palet
vnesi_iskalni 'WPC'
pocakaj_na "(()=>{return [...document.querySelectorAll('[cmdk-item]')].some(e=>e.getAttribute('data-value')&&e.getAttribute('data-value').includes('WPC-120-A'));})" 12
sleep 2
agent-browser eval "(()=>{const a=[...document.querySelectorAll('[cmdk-item]')].find(x=>x.getAttribute('data-value')&&x.getAttribute('data-value').includes('WPC-120-A')); const b=[...document.querySelectorAll('[cmdk-item]')].find(x=>x.getAttribute('data-value')&&x.getAttribute('data-value').includes('WPC-120-B')); return JSON.stringify({wpcA_amber:a?a.textContent.includes('Brez dobavitelja'):null, wpcB_amber:b?b.textContent.includes('Brez dobavitelja'):null});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 1

echo "--- RESTORE: temp cena/dobavitelj + minimumi ---"
node scripts/r221-brez-tmp.cjs restore || { echo "RESTORE221 FAIL"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r220-min-tmp.cjs restore || { echo "RESTORE220 FAIL"; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r218-min-tmp.cjs restore || { echo "RESTORE218 FAIL"; exit 1; }

echo "--- Z5: temna + __err + health ---"
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Preklopi na temno temo'); if(d){d.click(); return 'tema klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "--- DB bajtnato identična končnica + port sproščen ---"
DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev" node - <<'EOF'
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
async function main() {
  const inv = await db.inventory.findMany({ select: { sifraMateriala: true, kolicinaZaloga: true, minimalnaZaloga: true, _count: { select: { prices: true } } }, orderBy: { sifraMateriala: 'asc' } })
  const brez = inv.filter(i => i._count.prices === 0).length
  console.log('artiklov:', inv.length, '| brez cene:', brez, '| WPC-120-B:', JSON.stringify(inv.find(i => i.sifraMateriala === 'WPC-120-B')), '| dobaviteljev:', await db.supplier.count())
}
main().catch(e => { console.error('NAPAKA:', e.message); process.exit(1) }).finally(() => db.$disconnect())
EOF
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R222 E2E KONEC ---"
