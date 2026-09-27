#!/bin/bash
# R229 E2E ŽIVO: ZAMUJENA tema nadaljevanje — zvonček vrstice + Naročila
# per-vrstična oznaka.
# Z1 zvonček (klik Obvestila gumba — controlled onClick, NI Radix trigger):
#    vrstica 'Naročilo pri R228-TMP-DOBAVITELJ (E2E) — odpre Material →
#    Naročila' + CalendarX svg + roksal-red družina + badge 'Pretekel rok'
#    (roksal-red) + podnaslov 'je pretekel — naročilo še ni prejeto' +
#    meta 'Izterjaj dobavo pri dobavitelju';
# Z2 klik vrstice → Material → Naročila subTab aktiven (aria-pressed) +
#    R208 amber pill '1' (aktivna naročila);
# Z3 Naročila seznam — vrstica dobavitelja nosi status chip POSLANO + badge
#    'Pretekel rok' (roksal-red — ENA definicija komponente, ISTA kot
#    zvonček);
# Z4 CSV vodje regresija (R228): '"Opozorila","Zamujena dobava","1"';
# Z5 temna + __err null + health 200;
# RESTORE: r228 + r220 + r218 (VSE pred DB checkom — R226 lekcija), DB bajtnato.
# ZERO-MUTACIJA: začasno naročilo + dobavitelj (guardi bajtnato).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r229-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R229-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- RAISE: 5 artiklov pod minimum (r218) + WPC-120-B (r220) + zamujeno naročilo (r228) ---"
node scripts/r218-min-tmp.cjs raise || { echo "RAISE FAIL — abort"; exit 1; }
node scripts/r220-min-tmp.cjs raise || { echo "RAISE220 FAIL — abort"; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r228-narocilo-tmp.cjs raise || { echo "RAISE228 FAIL — abort"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

zapri_vodic() {
  for i in 1 2 3 4 5; do
    agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
    sleep 1
  done
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

agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2

echo "--- PRIJAVA: ci@roksal.si (lokalni E2E ADMIN) ---"
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 20
sleep 2
zapri_vodic

echo "=== Z1: zvonček — vrstica zamujena dobava (R229) ==="
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'ni zvoncka'; b.click(); return 'odprt';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Naročilo pri R228-TMP-DOBAVITELJ (E2E) — odpre Material → Naročila');})()" 15
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Naročilo pri R228-TMP-DOBAVITELJ (E2E) — odpre Material → Naročila'); if(!b) return JSON.stringify({vrstica:false}); const ikona=!!b.querySelector('svg.lucide-calendar-x'); const badge=[...b.querySelectorAll('span')].some(s=>s.textContent.trim()==='Pretekel rok'&&s.className.includes('text-roksal-red')&&s.className.includes('border-roksal-red/30')); const podn=b.textContent.includes('je pretekel — naročilo še ni prejeto'); const meta=b.textContent.includes('Izterjaj dobavo pri dobavitelju'); const rdecaIkona=!!b.querySelector('.bg-roksal-red\\/15'); return JSON.stringify({vrstica:true, ikonaCalendarX:ikona, badgePretekelRok:badge, podnaslov:podn, metaDejanje:meta, rdecaDruzina:rdecaIkona, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r229-zvonek-zamujena.png" > /dev/null 2>&1

echo "=== Z2: klik vrstice → Material → Naročila (subTab + R208 pill) ==="
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Naročilo pri R228-TMP-DOBAVITELJ (E2E) — odpre Material → Naročila'); if(!b) return 'ni vrstice'; b.click(); return 'klik';})()" 2>&1 | tail -1
pocakaj_na "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Naročila')); return !!b;})()" 12
sleep 1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Naročila')); if(!b) return JSON.stringify({subTab:false}); const pill=b.querySelector('span.bg-roksal-amber'); return JSON.stringify({subTab:true, pillAktivna:pill?pill.textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r229-material-narocila.png" > /dev/null 2>&1

echo "=== Z3: Naročila vrstica — status POSLANO + badge Pretekel rok ==="
pocakaj_na "(()=>{return document.body.textContent.includes('R228-TMP-DOBAVITELJ (E2E)');})()" 12
agent-browser eval "(()=>{const kartice=[...document.querySelectorAll('[data-slot=\"card\"]')]; const k=kartice.find(x=>x.textContent.includes('R228-TMP-DOBAVITELJ (E2E)')); if(!k) return JSON.stringify({kartica:false, alternativno:[...document.querySelectorAll('div')].some(d=>d.textContent.includes('R228-TMP-DOBAVITELJ (E2E)'))}); const badge=[...k.querySelectorAll('span')].some(s=>s.textContent.trim()==='Pretekel rok'&&s.className.includes('text-roksal-red')); const poslano=[...k.querySelectorAll('span')].some(s=>s.textContent.trim()==='POSLANO'); const datum=k.textContent.includes('→ dobava'); return JSON.stringify({kartica:true, badgePretekelRok:badge, statusPoslano:poslano, datumDobaveViden:datum, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r229-vrstica-badge.png" > /dev/null 2>&1

echo "=== Z4: CSV vodje regresija (R228 — 'Zamujena dobava','1') ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]');})()" 12
agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ new Response(b).text().then(t=>{window.__csv=t;}); return orig(b); }; return 'patched';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{window.__csv=null; const b=document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]'); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return typeof window.__csv==='string'&&window.__csv.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__csv; if(typeof t!=='string') return JSON.stringify({csv:false,err:window.__err??null}); const cist=t.replace(/^\uFEFF/,''); return JSON.stringify({csv:true, zamujena1:cist.includes('\"Opozorila\",\"Zamujena dobava\",\"1\"'), brez8:cist.includes('\"Opozorila\",\"Brez dobavitelja\",\"8\"'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r229-vodja-csv.png" > /dev/null 2>&1

echo "=== Z5: temna + __err + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r229-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "--- RESTORE: r228 + r220 + r218 — OBVEZNO pred DB checkom ---"
node scripts/r228-narocilo-tmp.cjs restore || { echo "RESTORE228 FAIL"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r220-min-tmp.cjs restore || { echo "RESTORE220 FAIL"; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r218-min-tmp.cjs restore || { echo "RESTORE218 FAIL"; exit 1; }

echo "--- DB bajtnato identična končnica + port sproščen ---"
DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev" node - <<'EOF'
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
async function main() {
  const inv = await db.inventory.findMany({ select: { sifraMateriala: true, kolicinaZaloga: true, minimalnaZaloga: true, _count: { select: { prices: true } } }, orderBy: { sifraMateriala: 'asc' } })
  const brez = inv.filter(i => i._count.prices === 0).length
  console.log('artiklov:', inv.length, '| brez cene:', brez, '| WPC-120-B:', JSON.stringify(inv.find(i => i.sifraMateriala === 'WPC-120-B')), '| dobaviteljev:', await db.supplier.count(), '| naročil:', await db.materialOrder.count())
}
main().catch(e => { console.error('NAPAKA:', e.message); process.exit(1) }).finally(() => db.$disconnect())
EOF
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R229 E2E KONEC ==="
