#!/bin/bash
# R233 E2E ŽIVO: Dobavitelji CSV izvoz (F1 P1-c) — polni dokaz z r231 tmp
# fixture (1 dobavitelj 'R231-TMP-DOBAVITELJ (E2E)', aktivna=true → 'Aktiven',
# 0 cen / 1 naročilo — resnični _count) + fail-closed ostanek po restore.
# P1-d: skripta JEDE nova helperja eb_klik_gumb + eb_csv_capture (živi dokaz).
# Z1 Domov regresija: Brez 8 + zamujena ODSOTNA (0 naročil v čisti bazi);
# Z2 Dobavitelji (0 naročil baze): gumb Viden + fail-closed klik → toast
#    'Ni dobaviteljev za izvoz' + __csv null;
# Z3 RAISE r231 tmp (1 dobavitelj + 1 naročilo) → Dobavitelji CSV capture:
#    glava + vrstica R231-TMP 'Aktiven' + '0' cen + '1' naročilo + Naročila
#    CSV regresija ('Pretekel rok','DA');
# Z4 temna + __err null + health;
# RESTORE r231 tmp → DB bajtnato identična končnica + port sproščen.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r233-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R233-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov regresija — Brez 8 + Zamujena ODSOTNA ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r233-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: Dobavitelji (0 v čisti bazi) — gumb Viden + fail-closed klik ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
eb_pocakaj_na "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Dobavitelji')); return !!b;})()" 12
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]');})()" 12
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]'); if(!g) return JSON.stringify({gumb:false}); const prazno=document.body.textContent.includes('Ni dobaviteljev'); return JSON.stringify({gumb:true, title:g.getAttribute('title'), disabled:g.disabled, praznoStanje:prazno, err:window.__err??null});})()" 2>&1 | tail -1
eb_csv_capture sup
eb_csv_reset sup
eb_klik_gumb "Izvozi dobavitelje kot CSV"
eb_cakaj 3
agent-browser eval "(()=>{const toast=document.body.textContent.includes('Ni dobaviteljev za izvoz'); return JSON.stringify({toast, csvNastal:typeof window.__sup==='string', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r233-e2e-dobavitelji-prazno.png" > /dev/null 2>&1

echo "=== Z3: RAISE r231 tmp → Dobavitelji CSV capture (polni dokaz) ==="
node scripts/r231-narocilo-tmp.cjs raise || { echo "RAISE231 FAIL — abort"; exit 1; }
# ISTI subTab dvakrat = brez refetcha (loadData deps [projectId, tab] — R182
# vzorec; hint effect samo setTab, isti tab = no-op) → preklop orders in NAZAJ
# suppliers = prava sprememba zavihka → ponovno nalaganje svežih podatkov.
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
eb_pocakaj_na "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Naročila')); return !!b;})()" 12
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('R231-TMP-DOBAVITELJ (E2E)');})()" 15
sleep 2
eb_csv_reset sup
eb_klik_gumb "Izvozi dobavitelje kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__sup==='string'&&window.__sup.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__sup; if(typeof t!=='string') return JSON.stringify({csv:false}); const cist=t.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r?\n/); const glava=vrstice[0]||''; const tmp=vrstice.find(l=>l.includes('R231-TMP-DOBAVITELJ'))||''; const celice=tmp.split(';'); return JSON.stringify({csv:true, glavaOK:glava.includes('Naziv')&&glava.includes('Št. naročil'), vrsticaTmp:!!tmp, statusAktiven:celice[1]==='Aktiven', stCen:celice[7], stCenOK:celice[7]==='0', stNarocil:celice[8], stNarocilOK:celice[8]==='1', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r233-e2e-dobavitelji-csv.png" > /dev/null 2>&1

echo "=== Z3b: Naročila CSV regresija (R231 'Pretekel rok','DA') ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 12
sleep 2
eb_csv_capture ord
eb_csv_reset ord
eb_klik_gumb "Izvozi naročila kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__ord==='string'&&window.__ord.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__ord; if(typeof t!=='string') return JSON.stringify({csv:false}); const cist=t.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r?\n/); const tmp=vrstice.find(l=>l.includes('R231-TMP-DOBAVITELJ'))||''; const zadnja=(tmp.split(';').pop()||'').trim(); return JSON.stringify({csv:true, vrsticaDA:zadnja==='DA', zadnja, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: temna + __err + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r233-e2e-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "--- RESTORE r231 tmp + DB bajtnato identična končnica ---"
node scripts/r231-narocilo-tmp.cjs restore || { echo "RESTORE231 FAIL"; exit 1; }
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
echo "=== R233 E2E KONEC ==="
