#!/bin/bash
# R232 E2E ŽIVO: Naročila CSV gumb VEDNO viden + fail-closed klik pri 0 naročil
# (r232 prod-probe lekcija: r231 gumb je bil v veji orders>0 — v prodi
# neviden; R232 ga dvigne nad ternarij). P1-d: skripta JEDE e2e-lib.sh in
# DOKAZUJE nova helperja eb_csv_capture/eb_csv_reset ŽIVO.
# NIČ MUTACIJ: r232 lastnost se dokaže pri 0 naročil (čista baza) — brez
# raise/restore, samo DB identična končnica (najmočnejši ZERO-MUTACIJA dokaz).
# Z1 Domov regresija: Brez 8 + kartica Zamujena ODSOTNA (fail-closed, 0 naročil);
# Z2 Material → Naročila (0 naročil): gumb Viden + NI disabled + klik → toast
#    'Ni naročil za izvoz' + window.__csv ostane null (NIČ se ne izvozi);
# Z3 vodja CSV regresija (R228) prek eb_csv_capture helperja: '"Opozorila",
#    "Zamujena dobava","0"' + brez8;
# Z4 temna + __err null + health 200;
# DB bajtnato identična končnica (8/8/120-50/0/0) + port sproščen.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r232-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R232-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov regresija — Brez 8 + Zamujena ODSOTNA (0 naročil, fail-closed) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, amber:k.className.includes('roksal-amber'), zamujenaOdsotna:!zam, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: Material → Naročila (0 naročil) — R232 gumb VEDNO viden + fail-closed klik ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
eb_pocakaj_na "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Naročila')); return !!b;})()" 12
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 12
# R232 JEDRO: gumb viden TUDI ko je 'Ni naročil' prazno stanje na zaslonu
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); if(!g) return JSON.stringify({gumb:false}); const prazno=document.body.textContent.includes('Ni naročil'); return JSON.stringify({gumb:true, title:g.getAttribute('title'), disabled:g.disabled, praznoStanje:prazno, err:window.__err??null});})()" 2>&1 | tail -1
# fail-closed klik prek NOVEGA helperja (P1-d živi dokaz): capture + reset + klik
eb_csv_capture csv
eb_csv_reset csv
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); if(!g) return 'ni gumba'; g.click(); return 'klik';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "(()=>{const toast=[...document.querySelectorAll('[data-sonner-toast], li, [role=\"status\"]')].some(t=>t.textContent&&t.textContent.includes('Ni naročil za izvoz')); const toastKje=document.body.textContent.includes('Ni naročil za izvoz'); return JSON.stringify({toast:toast||toastKje, csvNastal:typeof window.__csv==='string', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-e2e-orders-prazno-csv.png" > /dev/null 2>&1

echo "=== Z3: vodja CSV regresija (R228) prek eb_csv_capture helperja ==="
eb_dispatch '{"tab":"more","more":"vodja"}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]');})()" 12
eb_csv_capture csvV
eb_csv_reset csvV
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]'); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__csvV==='string'&&window.__csvV.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__csvV; if(typeof t!=='string') return JSON.stringify({csv:false}); const cist=t.replace(/^\uFEFF/,''); return JSON.stringify({csv:true, zamujena0:cist.includes('\"Opozorila\",\"Zamujena dobava\",\"0\"'), brez8:cist.includes('\"Opozorila\",\"Brez dobavitelja\",\"8\"'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-e2e-vodja-csv.png" > /dev/null 2>&1

echo "=== Z4: temna + __err + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r232-e2e-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "--- DB bajtnato identična končnica (NIČ mutacij — brez raise/restore) + port sproščen ---"
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
echo "=== R232 E2E KONEC ==="
