#!/bin/bash
# R223 E2E dopolnilni re-probe (lekcija: eval enakost celotnega div textContent
# je preveč stroga — naslov <p> je v ovojnici z opisom <p>): rdeča kartica
# 'Nizka zaloga materiala' SOBOJ z amber kartico na Domovu. ZERO-MUTACIJA:
# r218/r220 raise → probe → restore bajtnato.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r223-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R223-server-reprobe.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- RAISE ---"
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

agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
for i in $(seq 1 20); do
  R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 2>&1 | tail -1)
  [ "$R" = "true" ] && break
  sleep 1.5
done
zapri_vodic
sleep 2

echo "--- RE-PROBE: rdeca (tekst v page) + amber kartica (aria) SOBOJ ---"
# Dokazana pot (r223 E2E Z1/Z3): ekspliciten roksal:navigate tab:'dashboard'
# (privzeti pogled po prijavi NI zagotovo Domov — 2× uspešna Z1/Z3 pot).
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard'}})); return 'domov dispatch';})()" > /dev/null 2>&1
KARTICA=false
for i in $(seq 1 20); do
  R=$(agent-browser eval "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then KARTICA=true; echo "  kartica najdena (poskus $i)"; break; fi
  sleep 1.5
done
[ "$KARTICA" = "true" ] || echo "  kartica NI najdena (poll izčrpan)"
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); const rdeca=document.body.textContent.includes('Nizka zaloga materiala'); const rdecaAlert=document.body.textContent.includes('pod minimalno zalogo'); const zelenoNiVidna=!document.body.textContent.includes('Vsi artikli so nad minimalno zalogo.'); return JSON.stringify({amberKartica:!!k, aria:k?k.getAttribute('aria-label'):null, rdecaNaslov:rdeca, rdecaOpis:rdecaAlert, iskrenaVeja:zelenoNiVidna, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r223-domov-soboj.png" > /dev/null 2>&1

echo "--- RESTORE ---"
node scripts/r220-min-tmp.cjs restore || { echo "RESTORE220 FAIL"; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r218-min-tmp.cjs restore || { echo "RESTORE218 FAIL"; exit 1; }

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
echo "--- R223 RE-PROBE KONEC ---"
