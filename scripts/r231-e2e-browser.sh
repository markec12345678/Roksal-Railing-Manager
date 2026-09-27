#!/bin/bash
# R231 E2E ŽIVO: Naročila CSV stolpec 'Pretekel rok' (ENA resnica z zaslonom)
# + P1-g: skripta JEDE iz skupne knjižnice scripts/e2e-lib.sh (prijava →
# dispatch → zapri vodič — dokaz vzorca).
# Z1 Domov regresija: kartica 'Zamujena dobava (2)' (r228 brez postavk +
#    r231 s postavko — vodja šteje VSA zamujena) + Brez 8;
# Z2 Material → Naročila: CSV capture — glava 'Pretekel rok' + vrstica
#    R231-TMP-DOBAVITELJ se konča z ',"DA"' + badge 'Pretekel rok' na kartici;
# Z3 zvonček regresija: vrstici za R228-TMP in R231-TMP (R229 vzorec);
# Z4 temna + __err null + health 200;
# RESTORE: r231 + r228 + r220 + r218 (VSE pred DB checkom), DB bajtnato.
# ZERO-MUTACIJA: začasni dobavitelji/naročila z identifikacijskimi guardi.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r231-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R231-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- RAISE: r218 (5 pod min) + r220 (WPC-120-B) + r228 (naročilo) + r231 (naročilo s postavko) ---"
node scripts/r218-min-tmp.cjs raise || { echo "RAISE FAIL — abort"; exit 1; }
node scripts/r220-min-tmp.cjs raise || { echo "RAISE220 FAIL — abort"; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r228-narocilo-tmp.cjs raise || { echo "RAISE228 FAIL — abort"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r231-narocilo-tmp.cjs raise || { echo "RAISE231 FAIL — abort"; node scripts/r228-narocilo-tmp.cjs restore; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }

echo "--- PRIJAVA (prek e2e-lib.sh — P1-g dokaz) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — kartica 'Zamujena dobava (2)' + regresija Brez 8 ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Zamujena dobava (2) — odpre Material → Naročila\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label=\"Zamujena dobava (2) — odpre Material → Naročila\"]'); if(!k) return JSON.stringify({kartica:false}); const ikona=!!k.querySelector('svg.lucide-calendar-x'); const rdecaDruzina=k.className.includes('border-roksal-red/20')&&k.className.includes('bg-roksal-red/5'); const brez=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); return JSON.stringify({kartica:true, ikonaCalendarX:ikona, rdecaDruzina, regresijaBrez:!!brez, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r231-domov.png" > /dev/null 2>&1

echo "=== Z2: Material → Naročila — CSV glava 'Pretekel rok' + vrstica ,\"DA\" + badge ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
eb_pocakaj_na "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Naročila')); return !!b;})()" 12
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 12
# a11y dokaz: aria-label dejansko na gumbu (R231) + capture prek createObjectURL
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ new Response(b).text().then(t=>{window.__csv=t;}); return orig(b); }; if(!g) return 'ni gumba'; return 'patched + gumb';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{window.__csv=null; const g=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); if(!g) return 'ni gumba'; g.click(); return 'klik';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__csv==='string'&&window.__csv.length>10;})()" 10
agent-browser eval "(()=>{const t=window.__csv; if(typeof t!=='string') return JSON.stringify({csv:false}); const cist=t.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r?\n/); const glava=vrstice[0]||''; const r231=vrstice.find(l=>l.includes('R231-TMP-DOBAVITELJ'))||''; const badge=[...document.querySelectorAll('span')].filter(s=>s.textContent.trim()==='Pretekel rok').length; const zadnjaCelica=r231?(r231.split(';').pop()||'').trim():null; return JSON.stringify({csv:true, glavaVsebuje:glava.includes('Pretekel rok'), vrsticaR231:!!r231, vrsticaDA:zadnjaCelica==='DA', zadnjaCelica, badgeVidna:badge, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r231-orders-csv.png" > /dev/null 2>&1

echo "=== Z3: zvonček — vrstici R228-TMP in R231-TMP (R229 vzorec, EN VIR) ==="
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'ni zvoncka'; b.click(); return 'odprt';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Naročilo pri R231-TMP-DOBAVITELJ (E2E) — odpre Material → Naročila');})()" 15
sleep 1
agent-browser eval "(()=>{const a1=[...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Naročilo pri R231-TMP-DOBAVITELJ (E2E) — odpre Material → Naročila'); const a2=[...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Naročilo pri R228-TMP-DOBAVITELJ (E2E) — odpre Material → Naročila'); const v231=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Naročilo pri R231-TMP-DOBAVITELJ (E2E) — odpre Material → Naročila'); const badge=v231?[...v231.querySelectorAll('span')].some(s=>s.textContent.trim()==='Pretekel rok'):false; return JSON.stringify({vrsticaR231:a1, vrsticaR228:a2, badgeR231:badge, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r231-zvonek.png" > /dev/null 2>&1
agent-browser eval "(()=>{const s=document.querySelector('[data-state=\"open\"]'); if(s){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); s.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
sleep 1

echo "=== Z4: temna + __err + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r231-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "--- RESTORE: r231 + r228 + r220 + r218 — OBVEZNO pred DB checkom ---"
node scripts/r231-narocilo-tmp.cjs restore || { echo "RESTORE231 FAIL"; exit 1; }
node scripts/r228-narocilo-tmp.cjs restore || { echo "RESTORE228 FAIL"; exit 1; }
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
echo "=== R231 E2E KONEC ==="
