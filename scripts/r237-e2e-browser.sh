#!/bin/bash
# R237 E2E ŽIVO: NAROČILNICA OSNUTEK PDF (F1 P1-c 'izvozi' 4. člen) —
# čista baza SKOZI celoten E2E (dialog + PDF = samo bralni tok — ZERO-MUTACIJA
# brez raise/restore, močnejša r232 lekcija). P1-d: e2e-lib ×9 helperjev
# (eb_zajem_pdf byte-exact, eb_klik_gumb, eb_pocakaj_tekst — NOV NI potreben).
# Z1 Domov: Brez 8 + Zamujena ODSOTNA (fail-closed, 0 naročil);
# Z2 Material → Zaloga → Osnutek dialog (pill 'Shrani naročilnico … kot
#    osnutek naročila'; pod=1 v čisti bazi): dialog PDF gumb VIDEN
#    (disabled:false — 1 artikel) + klik → toast 'Osnutek prenesen v PDF —
#    1 artikel' (sklanjatev zalogaPovzetekBeseda živo) + eb_zajem_pdf →
#    %PDF magija [37,80,68,70,45] + bajti (pravi artefakt);
# Z2b CSV sorojec regresija (R205): capture narocilnica-…csv glava + vrstica;
# Z3 temna + __err null + health;
# Z4 DB bajtnato identična končnica (8/8/120-50/0/0) + port sproščen.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r237-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R237-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena ODSOTNA ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r237-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: Material → Zaloga → Osnutek dialog — R237 JEDRO: PDF gumb + byte-exact ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]');})()" 12
sleep 1
agent-browser eval "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); const c=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot CSV\"]'); if(!p||!c) return JSON.stringify({pdfGumb:false, csvGumb:!!c}); return JSON.stringify({pdfGumb:true, csvGumb:true, title:p.getAttribute('title'), disabledP:p.disabled, disabledC:c.disabled, err:window.__err??null});})()" 2>&1 | tail -1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 12
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 12
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magic:[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r237-e2e-osnutek-pdf.png" > /dev/null 2>&1

echo "=== Z2b: CSV sorojec regresija (R205) ==="
eb_csv_capture csvO
eb_csv_reset csvO
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__csvO==='string'&&window.__csvO.length>10;})()" 12
agent-browser eval "(()=>{const t=window.__csvO; if(typeof t!=='string') return JSON.stringify({csv:false}); const cist=t.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r?\n/); return JSON.stringify({csv:true, glavaOK:vrstice[0]&&vrstice[0].includes('Naroči'), vrstic:vrstice.filter(l=>l.includes(';')).length, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: temna + __err null + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$EB_BASE/api/public/health"; echo

echo "=== Z4: DB bajtnato identična končnica + port sproščen (brez raise — čista baza) ==="
agent-browser close --all > /dev/null 2>&1
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
echo "=== R237 E2E KONEC ==="
