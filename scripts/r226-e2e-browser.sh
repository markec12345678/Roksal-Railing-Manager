#!/bin/bash
# R226 E2E ŽIVO (vzorec r225): DEVETI signalec konvergence — CSV izvoz Zaloge
# stolpec 'Brez dobavitelja' (DA/NE) + [Mandatory] stil: Zapadlo pika → žeton.
# Z1 Zaloga: vrstični badgei 8/8 (regresija R225);
# Z2 CSV capture (URL.createObjectURL patch) — glava vsebuje 'Brez
#    dobavitelja', vrstic 8, brezDA 8, nizkaDA 7 (r218+r220 raises + M12 A4);
# Z3 EN VIR ŽIVO — r221 temp cena → brezDA 8→7 → restore → 8;
# Z4 WYSIWYG: čip 'Pod minimumom' → CSV SLEDI čipu (vrstic 7, vse DA) → izklop;
# Z5 vodja: pika na žetonu bg-muted-foreground (computed rgb) + NI stone +
#    trdeKlas:0 (razširjen vzorec z nevtralnimi družinami);
# Z6 temna + __err + health + DB bajtnato (orders 0 / suppliers 0 / inventory 8).
# ZERO-MUTACIJA: r218/r220 raises + r221 temp cena — vse obnovljeno z guardi.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r226-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R226-server-e2e.log 2>&1 < /dev/null &
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
patch_capture() {  # R226 — URL.createObjectURL patch (blob → tekst v window.__csv)
  agent-browser eval "(()=>{window.__csv=null; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ new Response(b).text().then(t=>{window.__csv=t;}); return orig(b); }; return 'patched';})()" > /dev/null 2>&1
}
klik_izvoz() {  # reset __csv → klik 'Izvozi vidno zalogo kot CSV'
  agent-browser eval "(()=>{window.__csv=null; const b=document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot CSV\"]'); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" > /dev/null 2>&1
}
remount() {  # EN VIR ŽIVO — po mutaciji DB OBVEZEN remont (sveže fetch podatkov;
             # r225 lekcija: brez remonta CSV izvozi ZASTARELI React state)
  agent-browser open "http://127.0.0.1:3100/" > /dev/null 2>&1
  pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 20
  zapri_vodic
  zaloga
  patch_capture
}
csv_beri() {  # počakaj na capture, potem razčleni (ločilo ;, BOM, CRLF)
  klik_izvoz
  pocakaj_na "(()=>{return typeof window.__csv==='string'&&window.__csv.length>10;})()" 10 > /dev/null 2>&1
  agent-browser eval "(()=>{const t=window.__csv; if(typeof t!=='string') return JSON.stringify({csv:false}); const cist=t.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r\n/).filter(x=>x.trim()!==''); const cel=vrstice.map(v=>v.split(';')); const glava=cel[0].join(';'); const brezIdx=cel[0].indexOf('Brez dobavitelja'); const nizkaIdx=cel[0].indexOf('Nizka'); const telo=cel.slice(1); const brezDA=telo.filter(c=>c[brezIdx]==='DA').length; const nizkaDA=telo.filter(c=>c[nizkaIdx]==='DA').length; const wpcB=telo.find(c=>c[0]==='WPC-120-B'); const wpcA=telo.find(c=>c[0]==='WPC-120-A'); return JSON.stringify({csv:true, glava, vrstic:telo.length, brezDA, nizkaDA, wpcB_nizka:wpcB?wpcB[nizkaIdx]:null, wpcA_brez:wpcA?wpcA[brezIdx]:null, err:window.__err??null});})()" 2>&1 | tail -1
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

echo "--- Z1: Zaloga — badgei 8/8 (regresija R225) ---"
zaloga
S=$(badge_stevec)
echo "  vrstičnih badgeov: $S (pričakovano 8)"

echo "--- Z2: CSV capture — glava + stolpec 'Brez dobavitelja' (DA/NE) ---"
patch_capture
csv_beri

echo "--- Z3: EN VIR ŽIVO — r221 temp cena WPC-120-A → brezDA 8→7 (S REMONTOM) ---"
node scripts/r221-brez-tmp.cjs raise || { echo "RAISE221 FAIL — abort"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
remount
csv_beri
echo "--- RESTORE temp cena → brezDA nazaj 8 (S REMONTOM) ---"
node scripts/r221-brez-tmp.cjs restore || { echo "RESTORE221 FAIL"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
remount
csv_beri

echo "--- Z4: WYSIWYG — čip 'Pod minimumom' → CSV SLEDI čipu (vrstic 7) ---"
agent-browser eval "(()=>{const c=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); if(!c) return 'ni čipa'; c.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{const c=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); return !!c&&c.getAttribute('aria-pressed')==='true';})()" 10
patch_capture
csv_beri
agent-browser eval "(()=>{const c=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); if(c&&c.getAttribute('aria-pressed')==='true'){c.click(); return 'izklop';} return 'že ugasnjen';})()" > /dev/null 2>&1
sleep 1

echo "--- Z5: vodja — pika na žetonu + trdeKlas:0 (razširjen vzorec) ---"
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 15
agent-browser eval "(()=>{const h2=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Pregled za vodjo'&&x.closest('div.space-y-4')); if(!h2) return JSON.stringify({vodja:false}); const root=h2.closest('div.space-y-4'); const trde=[...root.querySelectorAll('*')].filter(el=>{const c=el.getAttribute('class')||''; return /(?:border|bg|text)-(?:blue|green|red|purple|amber|slate|gray|zinc|neutral|stone|yellow|orange|violet|indigo|emerald|teal|cyan|sky|rose)-\\d{2,3}/.test(c);}); const kartice=[...root.querySelectorAll('.rounded-xl')]; const nizkaK=kartice.find(c=>c.textContent.includes('materialov z nizko zalogo')); const zapadlo=root.textContent.includes('Zapadlo'); const pika=[...root.querySelectorAll('span.h-2')].find(s=>{const o=s.closest('.rounded-lg'); return o&&o.textContent.includes('Zapadlo');}); const pikaBarva=pika?getComputedStyle(pika).backgroundColor:null; return JSON.stringify({vodja:true, trdeKlas:trde.length, prviTrje:trde.slice(0,2).map(e=>e.className.slice(0,50)), pikaNajdena:!!pika, pikaStone:!!(pika&&(pika.className.includes('stone'))), pikaBarva, nizkaRed:!!(nizkaK&&nizkaK.className.includes('bg-roksal-red/5')), zapadloBesedilo:zapadlo, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r226-vodja-pika.png" > /dev/null 2>&1

echo "--- Z6: temna + __err + health ---"
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Preklopi na temno temo'); if(d){d.click(); return 'tema klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "--- RESTORE: minimumi (r220 + r218) — OBVEZNO pred DB checkom ---"
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
echo "=== R226 E2E KONEC ==="
