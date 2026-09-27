#!/bin/bash
# R225 E2E ŽIVO (vzorec r224): OSMI signalec konvergence — badge 'Brez
# dobavitelja' na vrstici Zaloge + [Mandatory] harmonizacija vodjinega
# pregleda (tokeni, 0 novih hex).
# Z1 Zaloga: badge na vseh 8 vrsticah (lokalna baza: vsi artikli brez cene);
# Z2 čip 'Brez dobavitelja' → WYSIWYG (badgei ostanejo, aria-pressed);
# Z3 EN VIR ŽIVO — r221 temp cena → WPC-120-A badge IZGINE (8→7) → restore;
# Z4 vodja: r225 temp naročilo (POSLANO) → navy kartica 'odprtih naročil' +
#    NIČ numericnih barvnih klas v vodjinem pogledu → restore;
# Z5 temna + __err + health + DB bajtnato (orders 0 / suppliers 0 / inventory 8).
# ZERO-MUTACIJA: r218/r220 raises + r221 temp cena + r225 temp naročilo —
# vse obnovljeno z guardi.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r225-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R225-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- RAISE: 5 artiklov pod minimum (r218) + WPC-120-B (r220) ---"
node scripts/r218-min-tmp.cjs raise || { echo "RAISE FAIL — abort"; exit 1; }
node scripts/r220-min-tmp.cjs raise || { echo "RAISE220 FAIL — abort"; node scripts/r218-min-tmp.cjs restore; exit 1; }

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
zaloga() {  # navigacija na Zalogo (roksal:navigate protokol)
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory'}})); return 'zaloga dispatch';})()" > /dev/null 2>&1
  pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja'));})()" 15
}
badge_stevec() {  # števec vrstičnih badgeov (SPAN, ne čip-gumb)
  agent-browser eval "(()=>{return [...document.querySelectorAll('span')].filter(s=>s.tagName==='SPAN'&&s.textContent.trim()==='Brez dobavitelja'&&(s.className||'').includes('bg-roksal-amber/10')).length;})()" 2>&1 | tail -1
}

echo "--- Z0: prijava ---"
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 20
zapri_vodic

echo "--- Z1: Zaloga — badge 'Brez dobavitelja' na vseh 8 vrsticah ---"
zaloga
S=$(badge_stevec)
echo "  vrstičnih badgeov: $S (pričakovano 8)"
WPC_A=$(agent-browser eval "(()=>{const p=[...document.querySelectorAll('p')].find(x=>x.textContent.trim()==='WPC-120-A'); if(!p) return JSON.stringify({vrsta:false}); const row=p.closest('div.group'); if(!row) return JSON.stringify({vrsta:false, row:'ni .group'}); const b=[...row.querySelectorAll('span')].some(s=>s.tagName==='SPAN'&&s.textContent.trim()==='Brez dobavitelja'&&(s.className||'').includes('border-roksal-amber/30')); return JSON.stringify({vrsta:true, badge:b, amberDruzina:b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  WPC-120-A vrstica: $WPC_A"
agent-browser screenshot "$SS/qa-r225-vrstice-badge.png" > /dev/null 2>&1

echo "--- Z2: čip 'Brez dobavitelja' → WYSIWYG (badgei ostanejo) ---"
agent-browser eval "(()=>{const c=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); if(!c) return 'ni čipa'; c.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{const c=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); return !!c&&c.getAttribute('aria-pressed')==='true';})()" 10
S2=$(badge_stevec)
echo "  badgeov z aktivnim čipom: $S2 (WYSIWYG — pričakovano 8)"
agent-browser eval "(()=>{const c=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); if(c&&c.getAttribute('aria-pressed')==='true'){c.click(); return 'izklop';} return 'že ugasnjen';})()" > /dev/null 2>&1
sleep 1

echo "--- Z3: EN VIR ŽIVO — temp cena WPC-120-A → badge IZGINE (8→7) ---"
node scripts/r221-brez-tmp.cjs raise || { echo "RAISE221 FAIL — abort"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
agent-browser open "http://127.0.0.1:3100/" > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 20
zapri_vodic
zaloga
S3=$(badge_stevec)
echo "  badgeov po temp ceni: $S3 (pričakovano 7)"
agent-browser eval "(()=>{const p=[...document.querySelectorAll('p')].find(x=>x.textContent.trim()==='WPC-120-A'); if(!p) return JSON.stringify({vrsta:false}); const row=p.closest('div.group'); const b=row?[...row.querySelectorAll('span')].some(s=>s.tagName==='SPAN'&&s.textContent.trim()==='Brez dobavitelja'):null; return JSON.stringify({vrsta:true, badgeSeVidna:b});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r225-badge-izgine.png" > /dev/null 2>&1

echo "--- RESTORE: temp cena/dobavitelj (r221) ---"
node scripts/r221-brez-tmp.cjs restore || { echo "RESTORE221 FAIL"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }

echo "--- Z4: vodja — r225 temp naročilo → navy kartica + NIČ trdo kodiranih barv ---"
node scripts/r225-narocilo-tmp.cjs raise || { echo "RAISE225 FAIL — abort"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
agent-browser open "http://127.0.0.1:3100/" > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 20
zapri_vodic
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 15
agent-browser eval "(()=>{const h2=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Pregled za vodjo'&&x.closest('div.space-y-4')); if(!h2) return JSON.stringify({vodja:false}); const root=h2.closest('div.space-y-4'); if(!root) return JSON.stringify({vodja:false, root:'ni'}); const trde=[...root.querySelectorAll('*')].filter(el=>{const c=el.getAttribute('class')||''; return /(?:border|bg|text)-(?:blue|green|red|purple|amber)-\\d{2,3}/.test(c);}).length; const kartice=[...root.querySelectorAll('.rounded-xl')]; const terminiK=kartice.find(c=>c.textContent.includes('Termini')&&c.textContent.length<200); const odprtaK=kartice.find(c=>c.textContent.includes('odprtih naročil')); const nizkaK=kartice.find(c=>c.textContent.includes('materialov z nizko zalogo')); return JSON.stringify({vodja:true, trdeKlas:trde, terminiNavy:!!(terminiK&&(terminiK.className.includes('border-roksal-navy/20')&&terminiK.className.includes('dark:border-roksal-ink/20'))), odprtaNavy:!!(odprtaK&&(odprtaK.className.includes('bg-roksal-navy/5')&&odprtaK.className.includes('dark:border-roksal-ink/20'))), odprtaStevec:odprtaK?(odprtaK.querySelector('span.tabular-nums')||{}).textContent??null:null, nizkaRed:!!(nizkaK&&nizkaK.className.includes('bg-roksal-red/5')), brezKartica:!!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r225-vodja-harmonizacija.png" > /dev/null 2>&1

echo "--- RESTORE: temp naročilo + minimumi ---"
node scripts/r225-narocilo-tmp.cjs restore || { echo "RESTORE225 FAIL"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r220-min-tmp.cjs restore || { echo "RESTORE220 FAIL"; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r218-min-tmp.cjs restore || { echo "RESTORE218 FAIL"; exit 1; }

echo "--- Z5: temna + __err + health ---"
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Preklopi na temno temo'); if(d){d.click(); return 'tema klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

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
echo "--- R225 E2E KONEC ---"
