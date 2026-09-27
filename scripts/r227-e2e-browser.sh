#!/bin/bash
# R227 E2E ŽIVO (vzorec r226): DESETI signalec konvergence — naročilni tok
# per vrstica 'Brez dobavitelja' + [Mandatory] stil: geselne površine → žetoni.
# Z1 Zaloga → Osnutek dialog: vrstic 8 (r218+r220 raises), badge 'Brez
#    dobavitelja' na VSEH 8 (brez cene = 8) — dialog ŽIVO;
# Z2 EN VIR ŽIVO — r221 temp cena na WPC-120-A → reload → dialog badge 7 →
#    (ISTI /api/inventory vir; EN VIR zasidranje);
# Z3 geselni dialog: odprt prek 'Odjava' dropdown → 'Zamenjaj geslo' — vnosi
#    imajo žeton obrobo (computed ≠ stone rgb(214,211,209)), jakostna vrstica
#    se pokaže ob vnosu (bg-muted prazni segmenti);
# Z4 temna + __err null + health 200;
# RESTORE: r221 + r220 + r218 (VSE pred DB checkom — R226 lekcija), DB bajtnato.
# ZERO-MUTACIJA: vse začasne mutacije obnovljene z guardi; naročil 0 / dobaviteljev 0.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r227-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R227-server-e2e.log 2>&1 < /dev/null &
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

echo "--- PRIJAVA: ci@roksal.si (lokalni E2E ADMIN) ---"
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 20
sleep 2
zapri_vodic

echo "=== Z1: Zaloga → Osnutek dialog — badge 'Brez dobavitelja' per vrstica ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 12
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]'); if(!b) return 'ni'; b.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{const d=[...document.querySelectorAll('[role=\"dialog\"]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); return !!d;})()" 10
sleep 1
agent-browser eval "(()=>{const d=[...document.querySelectorAll('[role=\"dialog\"]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); if(!d) return JSON.stringify({dialog:false}); const badge=[...d.querySelectorAll('span')].filter(s=>s.textContent.trim()==='Brez dobavitelja'&&s.className.includes('roksal-amber')); const vrstice=[...d.querySelectorAll('div.flex.items-center.justify-between.gap-2')]; const prva=vrstice[0]?vrstice[0].textContent.trim().slice(0,80):null; return JSON.stringify({dialog:true, vrstic:vrstice.length, badgeov:badge.length, prva, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r227-osnutek-badge.png" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=\"dialog\"] button')].find(x=>x.textContent.trim()==='Zapri'||x.getAttribute('aria-label')==='Zapri'); if(b){b.click(); return 'zaprt';} const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "=== Z2: EN VIR ŽIVO — r221 temp cena → dialog badge 8→7 ==="
node scripts/r221-brez-tmp.cjs raise || { echo "RAISE221 FAIL — abort (restore min)"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
sleep 2
# reload s svežim mountom (EN VIR = svež /api/inventory fetch)
agent-browser open "http://127.0.0.1:3100/" > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 20
sleep 2
zapri_vodic
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 12
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]'); if(!b) return 'ni'; b.click(); return 'klik';})()" > /dev/null 2>&1
pocakaj_na "(()=>{const d=[...document.querySelectorAll('[role=\"dialog\"]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); return !!d;})()" 10
sleep 1
agent-browser eval "(()=>{const d=[...document.querySelectorAll('[role=\"dialog\"]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); if(!d) return JSON.stringify({dialog:false}); const badge=[...d.querySelectorAll('span')].filter(s=>s.textContent.trim()==='Brez dobavitelja'&&s.className.includes('roksal-amber')); const vrstice=[...d.querySelectorAll('div.flex.items-center.justify-between.gap-2')]; const wpcA=[...d.querySelectorAll('div')].some(x=>x.textContent.trim().startsWith('WPC')); return JSON.stringify({dialog:true, vrstic:vrstice.length, badgeov:badge.length, wpcAVrstica:wpcA, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r227-osnutek-badge-7.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "=== Z3: geselni dialog — žetoni (computed obroba ≠ stone) ==="
# Radix DropdownMenuTrigger se odpre na pointerdown — JS .click() NE zadosti
# (r199 dokazani vzorec: pointerdown + pointerup + click na središču gumba).
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
sleep 1
pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Zamenjaj geslo'));})()" 8
# Radix menuitem: polna pointer sekvenca (r200 dokazani vzorec — goli click ne zadošča)
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Zamenjaj geslo')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return !!document.querySelector('#pwd-current');})()" 8
sleep 1
agent-browser eval "(()=>{const inp=document.querySelector('#pwd-current'); if(!inp) return JSON.stringify({dialog:false}); const barva=getComputedStyle(inp).borderTopColor; const label=document.querySelector('label[for=\"pwd-current\"]'); const lbarva=label?getComputedStyle(label).color:null; return JSON.stringify({dialog:true, obroba:barva, obrobaNiStone:barva!=='rgb(214, 211, 209)'&&barva!=='rgb(231, 229, 228)', labelBarva:lbarva, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r227-geslo-tokeni.png" > /dev/null 2>&1
# jakostna vrstica: vpiši geslo → prazni segmenti bg-muted (computed ≠ stone)
agent-browser fill '#pwd-next' 'Abc123!d' > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const seg=[...document.querySelectorAll('span.h-1')]; const prazen=seg[seg.length-1]; if(!prazen) return JSON.stringify({seg:seg.length}); return JSON.stringify({seg:seg.length, praznaPovrsina:getComputedStyle(prazen).backgroundColor, niStone: getComputedStyle(prazen).backgroundColor!=='rgb(231, 229, 228)'});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
sleep 1

echo "=== Z4: temna + __err + health ==="
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r227-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "--- RESTORE: r221 temp cena + minimumi (r220 + r218) — OBVEZNO pred DB checkom ---"
node scripts/r221-brez-tmp.cjs restore || { echo "RESTORE221 FAIL"; node scripts/r220-min-tmp.cjs restore; node scripts/r218-min-tmp.cjs restore; exit 1; }
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
echo "=== R227 E2E KONEC ==="
