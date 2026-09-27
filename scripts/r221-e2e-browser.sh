#!/bin/bash
# R221 E2E ŽIVO (vzorec r220 + lekcije: data-value NE value; poll namesto
# fiksnih sleepov; native setter za cmdk input): F1 'brez dobavitelja'
# TRETJI whitelist vnos — paleta lastna skupina → deep-link → čip (trio
# medsebojna izključnost) → iskren števec → dimenzijska ločitev →
# EN VIR zasidranje (začasna cena 8→7) → restore bajtnato.
# ZERO-MUTACIJA: r218/r220 raise + r221 temp cena/dobavitelj — vse obnovljeno.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r221-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R221-server-e2e.log 2>&1 < /dev/null &
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
prijava() {
  agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
  agent-browser wait 'input[type="email"]' > /dev/null 2>&1
  agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
  agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
  agent-browser click 'button[type="submit"]' > /dev/null 2>&1
  sleep 8
  zapri_vodic
}

echo "--- Z0: prijava ---"
prijava

echo "--- Z1 (F1 ŽIVO): paleta 'Brez dobavitelja' skupina + vrstica (iskren števec 8) ---"
odpri_palet
pocakaj_na "(()=>{return !![...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='brez dobavitelja pokaži v Zalogi');})()" 12
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='brez dobavitelja pokaži v Zalogi'); if(!vr) return 'NI VRSTICE'; return JSON.stringify({tekst:vr.textContent.trim().slice(0,60), aria:vr.getAttribute('aria-label'), ikona:!!vr.querySelector('svg')});})()" 2>&1 | tail -1

echo "--- Z2: klik vrstice → Zaloga + čip ON (amber) + 8 vrstic + sorojena OFF + dialog NE odprt ---"
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='brez dobavitelja pokaži v Zalogi'); if(!vr) return 'ni vrstice'; vr.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik Brez dobavitelja';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')==='true'&&b.textContent.includes('Brez dobavitelja'));})()" 10
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>!d.textContent.includes('Ni artiklov')); const dlg=[...document.querySelectorAll('[role=dialog]')].filter(d=>d.getAttribute('data-state')!=='closed'&&d.textContent.includes('Naročilnica kot osnutek naročila')); const pal=document.querySelector('[cmdk-root]'); return JSON.stringify({brezPritisnjen:brez?brez.getAttribute('aria-pressed'):null,brezStevilo:brez?brez.textContent.trim():null,brezAmber:!!(brez&&brez.className.includes('roksal-amber')),podPritisnjen:pod?pod.getAttribute('aria-pressed'):null,naPritisnjen:na?na.getAttribute('aria-pressed'):null,vrstic:vrstice.length,dialogOdprt:dlg.length>0,paletaZaprta:!pal,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r221-brezzdobavitelja-deeplink.png" > /dev/null 2>&1

echo "--- Z3: trio izključnost ŽIVO — klik 'Pod' poniža 'brez', klik 'Na' poniža 'pod', klik 'brez' poniža 'na' ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes('Pod minimumom')); b.click(); return 'klik pod';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const st=t=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes(t)); return b?b.getAttribute('aria-pressed'):null}; return JSON.stringify({pod:st('Pod minimumom'),na:st('Na minimumu'),brez:st('Brez dobavitelja')});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes('Na minimumu')); b.click(); return 'klik na';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const st=t=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes(t)); return b?b.getAttribute('aria-pressed'):null}; return JSON.stringify({pod:st('Pod minimumom'),na:st('Na minimumu'),brez:st('Brez dobavitelja')});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes('Brez dobavitelja')); b.click(); return 'klik brez';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const st=t=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-pressed')!==null&&x.textContent.includes(t)); return b?b.getAttribute('aria-pressed'):null}; return JSON.stringify({pod:st('Pod minimumom'),na:st('Na minimumu'),brez:st('Brez dobavitelja')});})()" 2>&1 | tail -1

echo "--- Z4: dimenzijska ločitev — brez čip pokaže tudi visoke zaloge (WPC-120-A 450/100) ---"
agent-browser eval "(()=>{const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>!d.textContent.includes('Ni artiklov')); return JSON.stringify({vrstic:vrstice.length, wpcA:vrstice.some(d=>d.textContent.includes('WPC-120-A')), wpcB:vrstice.some(d=>d.textContent.includes('WPC-120-B'))});})()" 2>&1 | tail -1

echo "--- Z5: EN VIR zasidranje — temp cena na WPC-120-A → remount → brez števec 8→7, WPC tip 2→1 ---"
node scripts/r221-brez-tmp.cjs raise || { echo "RAISE221 FAIL — abort"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
agent-browser eval "(()=>{const n=[...document.querySelectorAll('nav button, nav a')].find(b=>b.textContent.trim()==='Moji projekti'); if(n){n.click(); return 'domov';} return 'ni nav';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const z=[...document.querySelectorAll('nav button, nav a')].find(b=>b.textContent.trim()==='Zaloga'); if(z){z.click(); return 'zaloga';} return 'ni nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja'));})" 10
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); brez.click(); return 'klik brez ON';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>!d.textContent.includes('Ni artiklov')); return JSON.stringify({brezStevilo:brez?brez.textContent.trim():null, vrstic:vrstice.length, wpcA:vrstice.some(d=>d.textContent.includes('WPC-120-A')), wpcB:vrstice.some(d=>d.textContent.includes('WPC-120-B'))});})()" 2>&1 | tail -1

echo "--- Z6: paleta števec po ponovnem odprtju = 7 (ISTI vir) ---"
odpri_palet
pocakaj_na "(()=>{return !![...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='brez dobavitelja pokaži v Zalogi');})()" 12
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='brez dobavitelja pokaži v Zalogi'); return vr?('vrstica: '+vr.textContent.trim().slice(0,50)):'NI VRSTICE';})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 1

echo "--- RESTORE: temp cena/dobavitelj + minimumi ---"
node scripts/r221-brez-tmp.cjs restore || { echo "RESTORE221 FAIL"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r220-min-tmp.cjs restore || { echo "RESTORE220 FAIL"; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r218-min-tmp.cjs restore || { echo "RESTORE218 FAIL"; exit 1; }

echo "--- Z7: temna + __err + health ---"
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('tema')||(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(d){d.click(); return 'tema klik';} return 'ni gumba za temo';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({tema:document.documentElement.getAttribute('class'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r221-temna.png" > /dev/null 2>&1
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
echo "--- R221 E2E KONEC ---"
