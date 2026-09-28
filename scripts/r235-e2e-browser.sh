#!/bin/bash
# R235 E2E ŽIVO: NAROČILNICA PDF iz naročila (F1 P1-c 'izvozi' 2. člen) —
# raise/restore vzorec r231 (ZERO-MUTACIJA — bajtnato identična končnica s
# strogimi guardi r231-narocilo-tmp.cjs). P1-d: skripta JEDE NOV helper
# eb_zajem_pdf (byte-exact zajem BINARNE datoteke — arrayBuffer→base64).
# Z1 Domov: zamujena (1 — tmp naročilo včeraj) + Brez 8;
# Z2 Material → Naročila: R235 JEDRO — PDF pill na kartici + klik → toast
#    + atob(__pdf) → %PDF magija [37,80,68,70,45] + dolžina (pravi artefakt);
# Z2b regresija R231: naročila CSV vrstica 'Pretekel rok','DA';
# Z3 temna + __err null + health;
# Z4 restore + DB bajtnato identična končnica (8/8/120-50/0/0) + port sproščen.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r235-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100
export EB_BASE="http://127.0.0.1:3100"
export EB_EMAIL="ci@roksal.si"
export EB_GESLO="DimniSmoke139!"

source scripts/e2e-lib.sh

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R235-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- RAISE (r231 tmp — strog guardi) ---"
node scripts/r231-narocilo-tmp.cjs raise || { echo "RAISE FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; node scripts/r231-narocilo-tmp.cjs restore || true; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — zamujena (1) + Brez 8 ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Zamujena dobava (\"]');})()" 24
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 12
agent-browser eval "(()=>{const z=document.querySelector('button[aria-label^=\"Zamujena dobava (\"]'); const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); return JSON.stringify({zamujena:z?z.getAttribute('aria-label'):null, brez:k?k.getAttribute('aria-label'):null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r235-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: Naročila — R235 JEDRO: PDF pill + klik + byte-exact capture ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Prenesi naročilnico naročila pri R231-TMP-DOBAVITELJ (E2E) kot PDF\"]');})()" 24
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Prenesi naročilnico naročila pri R231-TMP-DOBAVITELJ (E2E) kot PDF\"]'); if(!g) return JSON.stringify({gumb:false}); return JSON.stringify({gumb:true, title:g.getAttribute('title'), err:window.__err??null});})()" 2>&1 | tail -1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico naročila pri R231-TMP-DOBAVITELJ (E2E) kot PDF"
eb_pocakaj_tekst "prenesena v PDF" 12
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 12
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magic:[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r235-e2e-narocilnica-pdf.png" > /dev/null 2>&1

echo "=== Z2b: regresija R231 — naročila CSV vrstica 'Pretekel rok','DA' ==="
eb_csv_capture csv
eb_csv_reset csv
eb_klik_gumb "Izvozi naročila kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__csv==='string'&&window.__csv.length>10;})()" 12
agent-browser eval "(()=>{const t=window.__csv; if(typeof t!=='string') return JSON.stringify({csv:false}); const zadnja=t.replace(/^\uFEFF/,'').trim().split('\n').pop()||''; return JSON.stringify({csv:true, glavaPretekel:t.includes('Pretekel rok'), vrsticaDA:zadnja.endsWith('DA'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: temna + __err null + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$EB_BASE/api/public/health"; echo

echo "=== Z4: restore + DB bajtnato identična končnica + port sproščen ==="
agent-browser close --all > /dev/null 2>&1
node scripts/r231-narocilo-tmp.cjs restore || { echo "RESTORE FAIL"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://roksal:roksal@localhost:5433/roksal_dev' } } });
(async () => {
  const items = await p.inventory.findMany({ select: { _count: { select: { prices: true } } } });
  const wpc = await p.inventory.findFirst({ where: { sifraMateriala: 'WPC-120-B' } });
  console.log(JSON.stringify({ artiklov: items.length, brezCene: items.filter(i=>i._count.prices===0).length, wpc: wpc ? wpc.kolicinaZaloga+'/'+wpc.minimalnaZaloga : null, naročil: await p.materialOrder.count(), dobaviteljev: await p.supplier.count() }));
  await p.\$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1 | tail -1
echo "=== R235 E2E KONEC ==="
