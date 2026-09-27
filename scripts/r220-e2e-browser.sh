#!/bin/bash
# R220 E2E ŽIVO v2 (vzorec r219 + polling lekcije): F1 'na minimumu' drugi
# čip + paleta vrstica + F2 cross-tab zgodovina ('storage' poslušalec).
# Lekcije v1: (1) paleta fetch pride POCAS ob prvem odprtju → POLL namesto
# fiksnega sleepa; (2) preklop taba mora imeti IDENTITETNI preverjanji.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r220-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R220-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- RAISE: 5 artiklov pod minimum (r218) + WPC-120-B === (r220) ---"
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
odpri_palet() {
  for i in 1 2 3 4; do
    agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'klik';} return 'ni gumba';})()" > /dev/null 2>&1
    sleep 3
    ODPRT=$(agent-browser eval "(()=>{return !!document.querySelector('[cmdk-input]');})()" 2>&1 | tail -1)
    if [ "$ODPRT" = "true" ]; then echo "paleta odprta (poskus $i)"; return 0; fi
    zapri_vodic
  done
  return 1
}
# pocakaj_na "<js predicate>" [poskusi] — poll dokler eval ne vrne 'true'
pocakaj_na() {
  local pred="$1" maks="${2:-10}" R
  for i in $(seq 1 "$maks"); do
    R=$(agent-browser eval "$pred" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then echo "  najdeno (poskus $i)"; return 0; fi
    sleep 1.5
  done
  echo "  NI NAJDENO (zadnji: $R)"; return 1
}
prijava() {
  agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
  agent-browser wait 'input[type="email"]' > /dev/null 2>&1
  agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
  agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
  agent-browser click 'button[type="submit"]' > /dev/null 2>&1
  sleep 8
  zapri_vodic
}

echo "--- Z0: prijava + vodič ---"
prijava

echo "--- Z1 (F1 ŽIVO): paleta 'Na minimumu' vrstica → klik → čip ON, 'Pod' OFF, 1 vrstica ---"
odpri_palet
pocakaj_na "(()=>{return !![...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nizka zaloga na minimumu');})()" 12
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nizka zaloga na minimumu'); if(!vr) return 'NI VRSTICE'; return 'vrstica: '+vr.textContent.trim().slice(0,60)+' | aria: '+(vr.getAttribute('aria-label')||'');})()" 2>&1 | tail -1
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nizka zaloga na minimumu'); if(!vr) return 'ni vrstice'; vr.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik Na minimumu';})()" 2>&1 | tail -1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')==='true'&&b.textContent.includes('Na minimumu'));})()" 10
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const dlg=[...document.querySelectorAll('[role=dialog]')].filter(d=>d.getAttribute('data-state')!=='closed'&&d.textContent.includes('Naročilnica kot osnutek naročila')); const pal=document.querySelector('[cmdk-root]'); const vrstice=[...document.querySelectorAll('.divide-y > div')]; return JSON.stringify({aktivniTab:cur?cur.textContent.trim():null,naPritisnjen:na?na.getAttribute('aria-pressed'):null,naStevilo:na?na.textContent.trim():null,podPritisnjen:pod?pod.getAttribute('aria-pressed'):null,vrstic:vrstice.length,wpcB:vrstice.some(d=>d.textContent.includes('WPC Deska 120mm Brown')),dialogOdprt:dlg.length>0,paletaZaprta:!pal,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r220-naminimumu-deeplink.png" > /dev/null 2>&1

echo "--- Z2 (kompozicija): tip 'Inox' + čip 'Na minimumu' → 0 → iskreno prazno stanje ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Inox'&&b.getAttribute('aria-pressed')===null); if(!t) return 'ni Inox taba'; t.click(); return 'klik Inox';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')==='true'&&b.textContent.includes('Na minimumu')); const prazno=[...document.querySelectorAll('p')].some(p=>p.textContent.includes('Ni artiklov točno na minimalni zalogi v izbranem tipu')); const vrstice=[...document.querySelectorAll('.divide-y > div')].filter(d=>d.textContent.includes('minimum')).length; return JSON.stringify({naPritisnjen:na?na.getAttribute('aria-pressed'):null,iskrenoPrazno:prazno,vrstic:vrstice});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Vse'&&b.getAttribute('aria-pressed')===null); if(t){t.click(); return 'nazaj Vse';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z3 (medsebojna izključnost ročno): 'Pod' → pod ON + na OFF (7); 'Na' → na ON + pod OFF (1) ---"
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); if(!pod) return 'ni pod čipa'; pod.click(); return 'klik Pod';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); const vrstice=[...document.querySelectorAll('.divide-y > div')].length; return JSON.stringify({pod:pod?pod.getAttribute('aria-pressed'):null,na:na?na.getAttribute('aria-pressed'):null,vrstic:vrstice});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); if(!na) return 'ni na čipa'; na.click(); return 'klik Na';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const pod=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Pod minimumom')); const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); const vrstice=[...document.querySelectorAll('.divide-y > div')].length; return JSON.stringify({pod:pod?pod.getAttribute('aria-pressed'):null,na:na?na.getAttribute('aria-pressed'):null,vrstic:vrstice});})()" 2>&1 | tail -1

echo "--- Z4 (toggle OFF): klik 'Na' → OFF → vseh 8 vrstic ---"
agent-browser eval "(()=>{const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); if(!na) return 'ni na čipa'; na.click(); return 'klik Na (izklop)';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const na=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-pressed')!==null&&b.textContent.includes('Na minimumu')); const vrstice=[...document.querySelectorAll('.divide-y > div')].length; return JSON.stringify({na:na?na.getAttribute('aria-pressed'):null,vsehVrstic:vrstice});})()" 2>&1 | tail -1

echo "--- Z5 (F2 ŽIVO): sinhroni StorageEvent (isti API kot pravi cross-tab dispatch) → NOVA odprtina pokaže vnos z badgeom ---"
agent-browser press Escape > /dev/null 2>&1
sleep 1
odpri_palet
pocakaj_na "(()=>{return [...document.querySelectorAll('[cmdk-item]')].filter(e=>(e.getAttribute('data-value')||'').startsWith('nedavno ')).length === 0;})()" 6
agent-browser press Escape > /dev/null 2>&1
sleep 1
echo "  (zgodovina potrjeno prazna; paleta zaprta — useSyncExternalStore cache drži [])"
agent-browser eval "(()=>{try{window.localStorage.setItem('roksal:recent-searches', JSON.stringify([{q:'wpc deska',nizkaZaloga:true}])); window.dispatchEvent(new StorageEvent('storage',{key:'roksal:recent-searches'})); return 'zapisano + storage dogodek (kot iz tujega taba)';}catch(e){return 'napaka: '+e.message;}})()" 2>&1 | tail -1
sleep 2
odpri_palet
pocakaj_na "(()=>{return !![...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nedavno wpc deska');})()" 12
agent-browser eval "(()=>{const zi=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nedavno wpc deska'); return JSON.stringify({zgodovinaVidna:!!zi,zBadge:zi?zi.textContent.includes('Nizka zaloga'):null,red:zi?!!zi.querySelector('[class*=roksal-red]'):null,ls:window.localStorage.getItem('roksal:recent-searches')});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r220-crosstab-zgodovina.png" > /dev/null 2>&1
echo "--- Z5b: clear + storage → zgodovina spet prazna (obrnjena smer) ---"
agent-browser press Escape > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{window.localStorage.removeItem('roksal:recent-searches'); window.dispatchEvent(new StorageEvent('storage',{key:'roksal:recent-searches'})); return 'pobrisano + dogodek';})()" 2>&1 | tail -1
sleep 2
odpri_palet
pocakaj_na "(()=>{return [...document.querySelectorAll('[cmdk-item]')].filter(e=>(e.getAttribute('data-value')||'').startsWith('nedavno ')).length === 0;})()" 10
agent-browser press Escape > /dev/null 2>&1
sleep 1

echo "--- Z6: RESTORE + DB check + nizka=1 + temna + health + port ---"
node scripts/r220-min-tmp.cjs restore || { echo "RESTORE220 FAIL — ROČNO POPRAVI"; exit 1; }
node scripts/r218-min-tmp.cjs restore || { echo "RESTORE FAIL — ROČNO POPRAVI"; exit 1; }
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.inventory.findMany({ where: { sifraMateriala: { in: ['ALU-PROF-40','ALU-PROF-60','EPDM-TESNILO','INOX-M12-A4','INOX-M8-A2','SID-HILTI-330','WPC-120-A','WPC-120-B'] } }, select: { sifraMateriala: true, kolicinaZaloga: true, minimalnaZaloga: true }, orderBy: { sifraMateriala: 'asc' } }).then(r => { console.log('DB:', JSON.stringify(r)); return db.\$disconnect(); }).catch(e => { console.error('DB CHECK NAPAKA:', e.message); process.exit(1); });
"
prijava
odpri_palet
pocakaj_na "(()=>{return !![...document.querySelectorAll('[cmdk-group-heading]')].find(e=>e.textContent.includes('Nizka zaloga'));})()" 10
agent-browser eval "(()=>{const h=[...document.querySelectorAll('[cmdk-group-heading]')].map(e=>e.textContent).find(t=>t.includes('Nizka zaloga')); const na=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nizka zaloga na minimumu'); const vse=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.getAttribute('data-value')==='nizka zaloga pokaži vse'); return JSON.stringify({stevec1:h?h.includes('1'):false,naVrsticaSkrita:!na,vseVrsticaSkrita:!vse});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na temni način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const bg=getComputedStyle(document.body).backgroundColor; return JSON.stringify({temnaBg:bg,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na svetli način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('svetl')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 2
curl -s --max-time 10 "http://127.0.0.1:3100/api/public/health"; echo
agent-browser eval "(()=>{const o=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Odjava')); if(o){o.click(); return 'odjava';} return 'ni gumba';})()" > /dev/null 2>&1
sleep 2
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R220 E2E v2 KONEC ---"
