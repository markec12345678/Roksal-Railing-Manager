#!/bin/bash
# R221 E2E dodatek — Z5 ponovitev z DOKAZANO navigacijo (paleta 'Zaloga'
# vrstica, kot v Z2): temp cena WPC-120-A → remount → čip števec 7, WPC tip
# 2→1 (iskren števec ZNOTRAJ filtra tipa). ZERO-MUTACIJA z restore.
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
setsid node .next/standalone/server.js > /tmp/R221-server-z5.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

node scripts/r221-brez-tmp.cjs raise || { echo "RAISE FAIL — abort"; exit 1; }

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

odpri_palet() {
  for i in 1 2 3 4; do
    agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'klik';} return 'ni gumba';})()" > /dev/null 2>&1
    sleep 3
    ODPRT=$(agent-browser eval "(()=>{return !!document.querySelector('[cmdk-input]');})()" 2>&1 | tail -1)
    if [ "$ODPRT" = "true" ]; then echo "paleta odprta (poskus $i)"; return 0; fi
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

echo "--- Z5a: paleta → vrstica (števec 7 po temp ceni) → klik ---"
odpri_palet
pocakaj_na "(()=>{return !![...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='brez dobavitelja pokaži v Zalogi');})()" 12
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='brez dobavitelja pokaži v Zalogi'); return 'vrstica: '+vr.textContent.trim().slice(0,50);})()" 2>&1 | tail -1
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='brez dobavitelja pokaži v Zalogi'); vr.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')==='true'&&b.textContent.includes('Brez dobavitelja'));})()" 10

echo "--- Z5b: čip števec po FRESH mountu = 7 (EN VIR — API polje) + 7 vrstic ---"
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>!d.textContent.includes('Ni artiklov')); return JSON.stringify({brezStevilo:brez?brez.textContent.trim():null, vrstic:vrstice.length, wpcA:vrstice.some(d=>d.textContent.includes('WPC-120-A'))});})()" 2>&1 | tail -1

echo "--- Z5c: tip WPC_deska + brez čip = 1 vrstica (iskren števec ZNOTRAJ tipa: 2→1) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='WPC'&&b.getAttribute('aria-pressed')===null); if(!t) return 'ni WPC taba'; t.click(); return 'klik WPC';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const brez=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>!d.textContent.includes('Ni artiklov')); return JSON.stringify({brezStevilo:brez?brez.textContent.trim():null, vrstic:vrstice.length, samoWpcB:vrstice.some(d=>d.textContent.includes('WPC-120-B'))&&!vrstice.some(d=>d.textContent.includes('WPC-120-A'))});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r221-wpc-brezz-tip.png" > /dev/null 2>&1

echo "--- RESTORE + končnica ---"
node scripts/r221-brez-tmp.cjs restore || exit 1
DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev" node - <<'EOF'
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
async function main() {
  const inv = await db.inventory.findMany({ select: { sifraMateriala: true, _count: { select: { prices: true } } } })
  console.log('artiklov:', inv.length, '| brez cene:', inv.filter(i => i._count.prices === 0).length, '| dobaviteljev:', await db.supplier.count())
}
main().catch(e => { console.error('NAPAKA:', e.message); process.exit(1) }).finally(() => db.$disconnect())
EOF
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R221 Z5 DODATEK KONEC ---"
