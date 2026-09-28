#!/bin/bash
# R244 E2E ŽIVO — cenik materiala izvoz (CSV + PDF pilli, fail-closed pri 0
# cen — lokalna baza ima 8 artiklov BREZ vpisanih cen, iskren toast je TOČNO
# tisto, kar je treba dokazati; PDF bajtni determinizem dokazuje vitest
# r244-cenik-izvoz ×2) + P1-i wave 6 RBAC ogledalo na Logistiki (ADMIN =
# pozitivna veja: 'Nov termin montaže'/'Nova oprema' VIDNA + press-scale +
# vodiči ODSOTNI) + [Mandatory] stil ('Nov projekt' hero press-scale + btn-shine,
# ekipa 'Povabi' press-scale). Regresije: R243 premik ogledalo (ADMIN), R237
# Osnutek PDF (glifni razred), temna + __err null + health, DB bajtnato +
# port sproščen. ZERO-MUTACIJA: vse bralno + dialogi odpri/Escape — shranjevanja
# NIČ, naročil 0, premikov 0, cenik klikov 0 vpisov (fail-closed toast).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r244-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R244-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Nov projekt VIDEN s press-scale tokenom + btn-shine (F2 hero CTA) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja ('));})()" 24
sleep 1
agent-browser eval "(()=>{const k=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja (')); if(!k) return JSON.stringify({brez:false, err:window.__err??null}); const m=(k.getAttribute('aria-label')||'').match(/Brez dobavitelja \\((\\d+)\\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); return JSON.stringify({brezSt:m?m[1]:null, zamujenaOdsotna:!zam, novProjektViden:!!np, novProjektPS:np?np.className.includes('press-scale'):false, novProjektShine:np?np.className.includes('btn-shine'):false, novProjektBespoke:np?np.className.includes('active:scale-[0.98]'):true, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: cenik pilli VIDNA (ADMIN) + press-scale pill razredi ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi cenik materiala kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const csv=document.querySelector('button[aria-label=\"Izvozi cenik materiala kot CSV\"]'); const pdf=document.querySelector('button[aria-label=\"Izvozi cenik materiala kot PDF\"]'); return JSON.stringify({csvPill:!!csv, csvPS:csv?csv.className.includes('press-scale'):false, pdfPill:!!pdf, pdfPS:pdf?pdf.className.includes('press-scale'):false, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-e2e-cenik-pilli.png" > /dev/null 2>&1

echo "=== Z2b: cenik CSV klik — fail-closed toast (0 vpisanih cen v lokalni bazi) + brez datoteke ==="
eb_zajem_pdf csv
agent-browser eval "(()=>{window.__csv=null; return 'reset';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi cenik materiala kot CSV"
eb_pocakaj_tekst "Ni vpisanih cen za izvoz" 14
agent-browser eval "(()=>{const fail=document.body.textContent.includes('Ni vpisanih cen za izvoz'); const datoteka=typeof window.__csv==='string'&&window.__csv.length>0; return JSON.stringify({failClosedToast:fail, datotekaOstalaPrazna:!datoteka, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2c: cenik PDF klik — ISTI fail-closed toast (ni prazne datoteke — R232–R236 družina) ==="
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Izvozi cenik materiala kot PDF"
eb_pocakaj_tekst "Ni vpisanih cen za izvoz" 14
agent-browser eval "(()=>{const fail=document.body.textContent.includes('Ni vpisanih cen za izvoz'); const datoteka=typeof window.__pdf==='string'&&window.__pdf.length>0; return JSON.stringify({failClosedToast:fail, pdfOstaloPrazno:!datoteka, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: wave 6 JEDRO — Logistika/koledar za ADMIN: 'Nov termin montaže' VIDEN + press-scale + vodič ODSOTEN ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Nov termin montaže'));})()" 24
sleep 2
agent-browser eval "(()=>{const cta=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov termin montaže')); const vodic=document.body.textContent.includes('Pregled terminov je samo za branje'); return JSON.stringify({novTerminViden:!!cta, ctaPS:cta?cta.className.includes('press-scale'):false, vodicOdsoten:!vodic, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-e2e-logistika-admin.png" > /dev/null 2>&1

echo "=== Z3b: wave 6 oprema za ADMIN: 'Nova oprema' VIDEN + press-scale + vodič ODSOTEN ==="
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Oprema'); if(!b) return 'ni subtaba'; b.click(); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Nova oprema'));})()" 14
sleep 1
agent-browser eval "(()=>{const cta=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nova oprema')); const vodic=document.body.textContent.includes('Pregled opreme je samo za branje'); return JSON.stringify({novaOpremaViden:!!cta, ctaPS:cta?cta.className.includes('press-scale'):false, vodicOdsoten:!vodic, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-e2e-oprema-admin.png" > /dev/null 2>&1

echo "=== Z4: ekipa — 'Povabi' VIDEN + press-scale (F2 dialog-CTA pariteta) ==="
eb_dispatch '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Povabi'));})()" 24
sleep 1
agent-browser eval "(()=>{const p=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Povabi')); return JSON.stringify({povabiViden:!!p, povabiPS:p?p.className.includes('press-scale'):false, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5: R237 regresija — Osnutek PDF (%PDF + glifni razred: vsak od 30057/30119/30191/30253 LEGITIMEN) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const g=document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]'); return !!g && !g.disabled;})()" 24
sleep 4
OSN_OK=0
for poskus in 1 2 3; do
  eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
  if eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 10; then
    OSN_OK=1; echo "  dialog odprt (poskus $poskus)"; break
  fi
  echo "  poskus $poskus: dialog NI odprt — ponovim"
  sleep 5
done
[ "$OSN_OK" = "1" ] || { echo "Z5 FAIL: Osnutek dialog se ni odprl po 3 poskusih"; }
sleep 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const bajtov=bin.length; const razredi=[30057,30119,30191,30253]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov, razredOk:razredi.includes(bajtov), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z6: R243 regresija — Zaloga za ADMIN: premik gumb VIDEN + press-scale + vodič ODSOTEN ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Dodaj gibanje zaloge\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Dodaj gibanje zaloge\"]'); const vodic=document.body.textContent.includes('Pregled zaloge je samo za branje'); return JSON.stringify({premikViden:!!g, premikPS:g?g.className.includes('press-scale'):false, vodicOdsoten:!vodic, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z7: temna + __err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja ('));})()" 24
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'dark';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser screenshot "$SS/qa-r244-e2e-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'light';})()" > /dev/null 2>&1
agent-browser eval "(()=>{return JSON.stringify({err:window.__err??null});})()" 2>&1 | tail -1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "=== Z8: DB bajtnato identična (ZERO-MUTACIJA) + port sproščen ==="
node scripts/r242-db-qpizza.cjs
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R244 E2E KONEC ==="
