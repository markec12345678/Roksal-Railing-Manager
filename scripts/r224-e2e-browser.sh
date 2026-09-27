#!/bin/bash
# R224 E2E ŽIVO (vzorec r223 + lekcija: privzeti pogled NI Domov — ekspliciten
# dispatch): SEDMI signalec konvergence — vodja pregled kartica 'Brez
# dobavitelja' —
# Z1 vodja (Več → 'Pregled za vodjo' prek roksal:navigate more protokola):
#    kartica vidna (števec 8) SOBOJ z roksal-red 'nizka zaloga' kartico
#    (SEMANTIČNA HARMONIZACIJA ŽIVO — prej amber hardcoded);
# Z2 klik vodje kartice → Zaloga z AKTIVNIM čipom 'Brez dobavitelja'
#    (R221 filter deep-link protokol ŽIVO + več-list se zapre);
# Z3 EN VIR ŽIVO — temp cena (r221-brez-tmp) → reload → števec 8→7;
# Z4 restore bajtnato + temna + __err + health + DB matematika.
# ZERO-MUTACIJA: r218/r220 raises + r221 temp cena — vse obnovljeno.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r224-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R224-server-e2e.log 2>&1 < /dev/null &
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
vodja() {  # navigacija na vodjin pregled (roksal:navigate more protokol)
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja dispatch';})()" > /dev/null 2>&1
  pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})" 15
}

echo "--- Z0: prijava ---"
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})" 20
zapri_vodic

echo "--- Z1: vodja pregled — kartica 'Brez dobavitelja' (8) SOBOJ z roksal-red nizko zalogo ---"
vodja
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({kartica:false, err:window.__err??null}); const stevec=k.textContent.match(/Brez dobavitelja — (\\d+) artiklov/); const opoz=[...document.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Opozorila'); const sect=opoz?opoz.parentElement:null; const rdeca=sect?[...sect.querySelectorAll('div')].some(d=>d.textContent.trim().endsWith('materialov z nizko zalogo')):false; const rdecaKartica=sect?[...sect.querySelectorAll('.rounded-xl')].find(c=>c.textContent.includes('materialov z nizko zalogo')):null; return JSON.stringify({kartica:true, aria:k.getAttribute('aria-label'), stevec:stevec?stevec[1]:null, amber:k.className.includes('roksal-amber'), packageX:!!k.querySelector('svg'), tabular:!!k.querySelector('span.tabular-nums'), title:k.getAttribute('title')||'', rdecaSoboj:rdeca, rdecaDruzina:!!(rdecaKartica&&rdecaKartica.className.includes('roksal-red')), staraAmberHardcoded:!!(rdecaKartica&&rdecaKartica.className.includes('amber-')), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r224-vodja-kartica.png" > /dev/null 2>&1

echo "--- Z2: klik vodje kartice → Zaloga z AKTIVNIM čipom 'Brez dobavitelja' (R221 protokol ŽIVO) ---"
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return 'ni kartice'; k.click(); return 'klik kartice';})()" 2>&1 | tail -1
pocakaj_na "(()=>{const c=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); return !!c&&c.getAttribute('aria-pressed')==='true';})" 12
agent-browser eval "(()=>{const c=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Brez dobavitelja')); const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const veclistZaprt=!document.body.textContent.includes('Pregled za vodjo — dnevni izvoz')&&!document.querySelector('h2')?.textContent.includes('Pregled za vodjo'); return JSON.stringify({brezPritisnjen:c?c.getAttribute('aria-pressed'):null, brezAmber:!!(c&&c.className.includes('amber')), podPonizen:pod?pod.getAttribute('aria-pressed'):null, veclistZaprt, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r224-deeplink-chip.png" > /dev/null 2>&1

echo "--- Z3: EN VIR ŽIVO — temp cena na WPC-120-A → reload → števec 8→7 ---"
node scripts/r221-brez-tmp.cjs raise || { echo "RAISE221 FAIL — abort"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
agent-browser open "http://127.0.0.1:3100/" > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})" 20
zapri_vodic
vodja
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({kartica:false}); const stevec=k.textContent.match(/Brez dobavitelja — (\\d+) artiklov/); return JSON.stringify({kartica:true, stevec:stevec?stevec[1]:null, aria:k.getAttribute('aria-label')});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r224-vodja-stetje-7.png" > /dev/null 2>&1

echo "--- RESTORE: temp cena/dobavitelj + minimumi ---"
node scripts/r221-brez-tmp.cjs restore || { echo "RESTORE221 FAIL"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r220-min-tmp.cjs restore || { echo "RESTORE220 FAIL"; node scripts/r218-min-tmp.cjs restore; exit 1; }
node scripts/r218-min-tmp.cjs restore || { echo "RESTORE218 FAIL"; exit 1; }

echo "--- Z4: temna + __err + health ---"
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
  console.log('artiklov:', inv.length, '| brez cene:', brez, '| WPC-120-B:', JSON.stringify(inv.find(i => i.sifraMateriala === 'WPC-120-B')), '| dobaviteljev:', await db.supplier.count())
}
main().catch(e => { console.error('NAPAKA:', e.message); process.exit(1) }).finally(() => db.$disconnect())
EOF
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R224 E2E KONEC ---"
