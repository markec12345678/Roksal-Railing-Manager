#!/bin/bash
# R228 E2E ŽIVO: NOVA tema 'Zamujena dobava' — vodja kartica + klik →
# Material → Naročila + CSV (IZVOŽENO = ZASLON).
# Z1 vodja (dispatch more:'vodja'): kartica 'Zamujena dobava (1)' — aria +
#    roksal-red + CalendarX (svg.lucide-calendar-x) + slovenska oblika
#    '1 naročilo z pretečenim rokom' + tabular-nums;
# Z2 klik kartice → Material tab + orders subTab aktiven (aria-pressed) +
#    R208 amber pill '1' (aktivna naročila);
# Z3 CSV capture (URL.createObjectURL patch — R226 lekcija 5): glava vrstica
#    '"Opozorila","Zamujena dobava","1"' (IZVOŽENO = ZASLON) + regresija
#    '"Opozorila","Brez dobavitelja","8"';
# Z4 temna + __err null + health 200;
# RESTORE: r228 + r220 + r218 (VSE pred DB checkom — R226 lekcija), DB bajtnato.
# ZERO-MUTACIJA: začasno naročilo + dobavitelj (guardi bajtnato); naročil 0 / dobaviteljev 0.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r228-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R228-server-e2e.log 2>&1 < /dev/null &
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

echo "--- PRIJAVA: ci@roksal.si (lokalni E2E ADMIN) ---"
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 20
sleep 2
zapri_vodic

echo "=== Z1: vodja — kartica 'Zamujena dobava (1)' ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
pocakaj_na "(()=>{const h2=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Pregled za vodjo'&&x.closest('div.space-y-4')); return !!h2;})()" 12
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Zamujena dobava (1) — odpre Material → Naročila\"]');})()" 12
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label=\"Zamujena dobava (1) — odpre Material → Naročila\"]'); if(!k) return JSON.stringify({kartica:false}); const ikona=!!k.querySelector('svg.lucide-calendar-x'); const st=k.querySelector('span.tabular-nums'); const rdecaDruzina=k.className.includes('border-roksal-red/20')&&k.className.includes('bg-roksal-red/5'); const oblika=k.textContent.includes('1 naročilo z pretečenim rokom'); const opis=k.textContent.includes('Obljubljeni datum je pretekel'); return JSON.stringify({kartica:true, ikonaCalendarX:ikona, stevec:st?st.textContent.trim():null, rdecaDruzina, slovenskaOblika:oblika, opis, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r228-zamujena-kartica.png" > /dev/null 2>&1

echo "=== Z2: klik → Material → Naročila (subTab + R208 pill) ==="
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label=\"Zamujena dobava (1) — odpre Material → Naročila\"]'); if(!k) return 'ni kartice'; k.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Naročila')); return !!b;})()" 12
sleep 1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Naročila')); if(!b) return JSON.stringify({subTab:false}); const pill=b.querySelector('span.bg-roksal-amber'); return JSON.stringify({subTab:true, pillAktivna:pill?pill.textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r228-material-orders.png" > /dev/null 2>&1

echo "=== Z3: CSV vodje — 'Opozorila','Zamujena dobava','1' (IZVOŽENO = ZASLON) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]');})()" 12
agent-browser eval "(()=>{window.__csv=null; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ new Response(b).text().then(t=>{window.__csv=t;}); return orig(b); }; return 'patched';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{window.__csv=null; const b=document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]'); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return typeof window.__csv==='string'&&window.__csv.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__csv; if(typeof t!=='string') return JSON.stringify({csv:false,err:window.__err??null}); const cist=t.replace(/^\uFEFF/,''); return JSON.stringify({csv:true, zamujena1:cist.includes('\"Opozorila\",\"Zamujena dobava\",\"1\"'), odprta1:cist.includes('\"Opozorila\",\"Odprta naročila\",\"1\"'), brez8:cist.includes('\"Opozorila\",\"Brez dobavitelja\",\"8\"'), nizka7:cist.includes('\"Opozorila\",\"Nizka zaloga\",\"7\"'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r228-vodja-csv.png" > /dev/null 2>&1

echo "=== Z4: temna + __err + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r228-temna.png" > /dev/null 2>&1
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
echo "=== R228 E2E KONEC ==="
