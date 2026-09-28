#!/bin/bash
# R234 E2E ŽIVO: Zaloga PDF izvoz (F1 P1-c 'izvozi' PDF dimenzija) —
# ZERO-MUTACIJA (brez raise/restore — lastnost dokazana pri čisti bazi, r232
# lekcija št. 5). P1-d: skripta JEDE NOV helper eb_pocakaj_tekst (živi dokaz).
# Z1 Domov regresija: Brez 8 + zamujena ODSOTNA (0 naročil v čisti bazi);
# Z2 Zaloga (Vse, 8 artiklov): PDF gumb viden + klik → capture %PDF magija +
#    toast 'Izvoženih 8 artiklov v PDF.';
# Z2b fail-closed: čip 'na minimumu' (na=0 v čisti bazi) → PRAZNO stanje →
#    PDF klik → toast 'Ni artiklov za izvoz.' + __pdf ostane null (NI prazne
#    datoteke — R232/R233 družina);
# Z2c CSV regresija (R136/R226): zaloga CSV capture — glava z 'Brez
#    dobavitelja' (ENA resnica);
# Z3 temna + __err null + health;
# Z4 DB bajtnato identična končnica (8/8/120-50/0/0) + port sproščen.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r234-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R234-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov regresija — Brez 8 + Zamujena ODSOTNA ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r234-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: Zaloga (Vse, 8) — PDF gumb + capture %PDF + toast ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot PDF\"]');})()" 24
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot PDF\"]'); if(!g) return JSON.stringify({gumb:false}); return JSON.stringify({gumb:true, title:g.getAttribute('title'), err:window.__err??null});})()" 2>&1 | tail -1
eb_csv_capture pdf
eb_csv_reset pdf
eb_klik_gumb "Izvozi vidno zalogo kot PDF"
# P1-d — NOV helper ŽIVO: čakanje na toast besedilo (IIFE pogodba zaprta).
eb_pocakaj_tekst "Izvoženih 8 artiklov v PDF." 10
agent-browser eval "(()=>{const t=window.__pdf; if(typeof t!=='string') return JSON.stringify({pdf:false, err:window.__err??null}); return JSON.stringify({pdf:true, magic:[t.charCodeAt(0),t.charCodeAt(1),t.charCodeAt(2),t.charCodeAt(3),t.charCodeAt(4)].join(','), dolzina:t.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r234-e2e-zaloga-pdf.png" > /dev/null 2>&1

echo "=== Z2b: fail-closed — čip 'na minimumu' (na=0) → toast 'Ni artiklov za izvoz.' ==="
eb_klik_gumb "Pokaži samo artikle na minimalni zalogi"
eb_pocakaj_tekst "Ni artiklov za izvoz" 10
eb_csv_reset pdf
eb_klik_gumb "Izvozi vidno zalogo kot PDF"
eb_cakaj 2
agent-browser eval "(()=>{const prazno=document.body.textContent.includes('Ni artiklov za izvoz'); const cip=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].some(x=>(x.getAttribute('aria-label')||'').includes('na minimalni zalogi')); return JSON.stringify({praznoStanje:prazno, cipAktiven:cip, pdfNastal:typeof window.__pdf==='string', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r234-e2e-zaloga-prazno.png" > /dev/null 2>&1
# Izklop čipa (nazaj na Vse — za Z2c CSV regression na polnem pogledu).
eb_klik_gumb "Pokaži samo artikle na minimalni zalogi — aktiven (0); klik za izklop"

echo "=== Z2c: zaloga CSV regresija (R136/R226) — glava z 'Brez dobavitelja' ==="
eb_csv_capture zal
eb_csv_reset zal
eb_klik_gumb "Izvozi vidno zalogo kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__zal==='string'&&window.__zal.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__zal; if(typeof t!=='string') return JSON.stringify({csv:false}); const cist=t.replace(/^\uFEFF/,''); return JSON.stringify({csv:true, glava:cist.includes('Šifra;Naziv;Tip;Enota;Zaloga;Min. zaloga;Nizka;Brez dobavitelja'), vrstic:cist.split('\n').length-1, brez8:(cist.split('\n').filter(v=>v.endsWith(';DA')).length), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: temna + __err null + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$EB_BASE/api/public/health"; echo

echo "=== Z4: DB bajtnato identična končnica + port sproščen ==="
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
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R234 E2E KONEC ==="
