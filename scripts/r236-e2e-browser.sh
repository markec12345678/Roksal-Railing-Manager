#!/bin/bash
# R236 E2E ŽIVO: DOBAVITELJI PDF (F1 P1-c 'izvozi' 3. člen) — raise/restore
# vzorec r231 (ZERO-MUTACIJA — bajtnato identična končnica s strogimi guardi
# r231-narocilo-tmp.cjs). P1-d: obstoječa e2e-lib pokrije VSE (eb_zajem_pdf
# byte-exact, eb_klik_gumb, eb_pocakaj_tekst — NOV helper NI potreben).
# Z2-pre (čista baza, 0 dobaviteljev): gumb VEDNO viden + fail-closed klik →
#    toast 'Ni dobaviteljev za izvoz' + __pdf null (R233/R232 družina);
# Z1 Domov (po raise): zamujena (1 — tmp naročilo včeraj) + Brez 8;
# Z2 Material → Dobavitelji: R236 JEDRO — PDF pill + CSV gumb oba VIDA +
#    klik PDF → toast 'Izvoženih 1 dobavitelj v PDF' (sklanjatev
#    dobaviteljBeseda) + eb_zajem_pdf → %PDF magija [37,80,68,70,45] + bajti;
# Z2b CSV brat regresija (R233) + naročila CSV 'Pretekel rok','DA' (R231);
# Z3 temna + __err null + health;
# Z4 restore + DB bajtnato identična končnica (8/8/120-50/0/0) + port sproščen.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r236-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R236-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z2-pre: Dobavitelji (0 v čisti bazi) — gumb VEDNO viden + fail-closed klik ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
eb_pocakaj_na "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Dobavitelji')); return !!b;})()" 12
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]');})()" 12
agent-browser eval "(()=>{const p=document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]'); const c=document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]'); if(!p||!c) return JSON.stringify({pill:false, csv:!!c}); return JSON.stringify({pill:true, csv:true, title:p.getAttribute('title'), disabled:p.disabled, err:window.__err??null});})()" 2>&1 | tail -1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Izvozi dobavitelje kot PDF"
eb_cakaj 3
agent-browser eval "(()=>{const toast=document.body.textContent.includes('Ni dobaviteljev za izvoz'); return JSON.stringify({failClosedToast:toast, pdfNastal:typeof window.__pdf==='string', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r236-e2e-dobavitelji-prazno.png" > /dev/null 2>&1

echo "--- RAISE (r231 tmp — strog guardi) ---"
node scripts/r231-narocilo-tmp.cjs raise || { echo "RAISE FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }

echo "=== Z1: Domov — zamujena (1) + Brez 8 ==="
# ISTI subTab dvakrat = brez refetcha (lekcija r233) — dispatch na Domov je
# prava sprememba zavihka → sveži podatki.
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Zamujena dobava (\"]');})()" 24
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 12
agent-browser eval "(()=>{const z=document.querySelector('button[aria-label^=\"Zamujena dobava (\"]'); const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); return JSON.stringify({zamujena:z?z.getAttribute('aria-label'):null, brez:k?k.getAttribute('aria-label'):null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r236-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: Dobavitelji — R236 JEDRO: PDF pill + klik + byte-exact capture ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('R231-TMP-DOBAVITELJ (E2E)');})()" 15
sleep 2
eb_csv_reset pdf
eb_klik_gumb "Izvozi dobavitelje kot PDF"
eb_pocakaj_tekst "Izvoženih 1 dobavitelj v PDF" 12
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 12
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magic:[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r236-e2e-dobavitelji-pdf.png" > /dev/null 2>&1

echo "=== Z2b: CSV brat regresija (R233) + naročila CSV 'DA' (R231) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 12
sleep 2
eb_csv_capture csv
eb_csv_reset csv
eb_klik_gumb "Izvozi naročila kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__csv==='string'&&window.__csv.length>10;})()" 12
agent-browser eval "(()=>{const t=window.__csv; if(typeof t!=='string') return JSON.stringify({csv:false}); const cist=t.replace(/^\uFEFF/,''); const zadnja=cist.trim().split('\n').pop()||''; return JSON.stringify({csv:true, glavaPretekel:cist.includes('Pretekel rok'), vrsticaDA:zadnja.endsWith('DA'), err:window.__err??null});})()" 2>&1 | tail -1

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
echo "=== R236 E2E KONEC ==="
