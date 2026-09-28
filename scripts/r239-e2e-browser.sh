#!/bin/bash
# R239 E2E ŽIVO: RBAC UI ogledalo (P1-a) — 'Nov projekt' gumb VIDEN vodstvu
# (ci@roksal.si = ADMIN) + dialog odpri/Prekliči (brez pošiljanja —
# ZERO-MUTACIJA) + fail-verbose handler obstaja + regresije R237/R238.
# Čista baza SKOZI celoten E2E (brez raise/restore — noben zapis ne nastane).
# Z1 Domov: Brez 8 + Zamujena ODSOTNA + Nov projekt VIDEN (vodstvena veja);
# Z2 R239 JEDRO: klik 'Nov projekt' → dialog odprt ('Naziv projekta' label)
#    → Escape (Prekliči — brez mutacije) → dialog zaprt;
# Z2b R238 regresija: prodajna plošča CSV gumb + toast + glava (3 vrstice);
# Z2c R237 regresija: Osnutek dialog PDF pill + %PDF + 30191 bajtov;
# Z3 temna + __err null + health;
# Z4 DB bajtnato identična končnica (8/8/120-50/0/0) + port sproščen.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r239-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R239-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena ODSOTNA + R239 'Nov projekt' VIDEN (ADMIN) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, novProjektViden:!!np, novProjektBesedilo:np?np.textContent.trim().slice(0,20):null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r239-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: R239 JEDRO — dialog odpri → Prekliči (brez mutacije) ==="
# gumb nima aria-labela (besedilni gumb) — klik po besedilu (plain onClick,
# ni Radix trigger — g.click() zadošča; vzorec r199 le za DropdownMenu).
agent-browser eval "(()=>{const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); if(!np) return 'ni gumba'; np.click(); return 'klik';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return !!document.querySelector('#proj-name');})()" 8
sleep 1
agent-browser eval "(()=>{const naziv=!!document.querySelector('#proj-name'); const stranka=!!document.querySelector('#proj-date'); const preklici=[...document.querySelectorAll('[role=\"dialog\"] button')].some(b=>b.textContent.trim()==='Prekliči'); return JSON.stringify({dialogOdprt:naziv, datumPolje:stranka, prekliciGumb:preklici, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r239-e2e-dialog.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1
agent-browser eval "(()=>{return JSON.stringify({dialogZaprt:!document.querySelector('#proj-name'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2b: R238 regresija — prodajna plošča CSV (glava + vrstice) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi prodajno ploščo kot CSV\"]'); return !!g && !g.disabled;})()" 24
eb_csv_capture csvP
eb_csv_reset csvP
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_cakaj 2
agent-browser eval "(()=>{const csvP=window.__csvP; if(typeof csvP!=='string'||csvP.length===0){const fail=document.body.textContent.includes('Ni projektov na plošči za izvoz'); return JSON.stringify({csvNastal:false, failClosedPri0:fail});} const cist=csvP.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r?\n/).filter(l=>l.includes(';')); return JSON.stringify({csvNastal:true, glavaOK:cist.startsWith('Naziv projekta;Status;Stranka;Vrednost (€);Spomnik;Datum montaže;Podpisano'), vrstic:Math.max(0,vrstice.length-1), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2c: R237 regresija — Osnutek dialog PDF pill + %PDF ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const g=document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]'); return !!g && !g.disabled;})()" 24
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 12
sleep 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 12
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 12
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string') return JSON.stringify({pdf:false}); const bin=atob(b64); return JSON.stringify({pdf:true, magic:[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z3: temna + err null + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "=== Z4: DB bajtnato identična končnica + port sproščen (čista baza) ==="
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
echo "=== R239 E2E KONEC ==="
