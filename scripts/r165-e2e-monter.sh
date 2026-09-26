#!/bin/bash
# R165 E2E del 2 (lokalni build): MONTER dropdown — omejeni seznami + hint UI.
# Fixtura (prisma update na DEV bazi): r165-e2e dobi 3 projekte
#   - NACRTOVANO (brez locka) → [V teku, Ustavljeno] + disabled current
#   - MONTIRANO → [Zaključeno]
#   - ZA_MONTAZO + dealLocked → HINT "Zaklenjen dogovor …" (ni opcij)
set -u
cd /home/z/my-project/roksal-repo

cat > e2e-fixture-r165.mjs <<'EOF'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const monter = await db.profile.findUnique({ where: { email: 'r165-e2e@roksal.si' } })
if (!monter) { console.log('MONTER NE OBSTAJA'); process.exit(1) }
// NACRTOVANO brez locka
const nac = await db.project.findFirst({ where: { nazivProjekta: { contains: 'Kokalj' } } })
await db.project.update({ where: { id: nac.id }, data: { monterId: monter.id, status: 'NACRTOVANO', dealLocked: false } })
// MONTIRANO
const mon = await db.project.findFirst({ where: { status: 'MONTIRANO' } })
await db.project.update({ where: { id: mon.id }, data: { monterId: monter.id } })
// ZA_MONTAZO + lock
const lock = await db.project.findFirst({ where: { nazivProjekta: { contains: 'Zupan' } } })
await db.project.update({ where: { id: lock.id }, data: { monterId: monter.id, status: 'ZA_MONTAZO', dealLocked: true } })
console.log('fixture OK:', JSON.stringify({ nac: nac.nazivProjekta, mon: mon.nazivProjekta, lock: lock.nazivProjekta }))
await db.$disconnect()
EOF
DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev" node e2e-fixture-r165.mjs
rm e2e-fixture-r165.mjs

export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
setsid node .next/standalone/roksal-repo/server.js > /tmp/r165-e2e2-server.log 2>&1 < /dev/null &
sleep 4

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'r165-e2e@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'R165E2eMonter!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- E2E M1 (MONTER): NACRTOVANO → [V teku, Ustavljeno] + disabled current ---"
agent-browser eval "(()=>{const badges=[...document.querySelectorAll('.cursor-pointer')].filter(b=>b.textContent.trim()==='Načrtovano'); const b=badges[0]; if(!b) return 'Ni NACRTOVANO značke'; b.click(); return 'kliknil';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const menu=document.querySelector('.absolute.right-3.top-12'); if(!menu) return 'meni NI odprt'; const items=[...menu.querySelectorAll('button')].map(x=>({t:x.textContent.trim().replace('close','').trim(), disabled:x.disabled})); return JSON.stringify(items);})()" 2>&1 | tail -1

echo "--- E2E M2 (MONTER): MONTIRANO → samo [Zaključeno] ---"
agent-browser eval "(()=>{document.body.click(); const badges=[...document.querySelectorAll('.cursor-pointer')].filter(b=>b.textContent.trim()==='Montirano'); const b=badges[0]; if(!b) return 'Ni MONTIRANO značke'; b.click(); return 'kliknil';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const menu=document.querySelector('.absolute.right-3.top-12'); if(!menu) return 'meni NI odprt'; const items=[...menu.querySelectorAll('button')].map(x=>x.textContent.trim().replace('close','').trim()); return JSON.stringify(items);})()" 2>&1 | tail -1

echo "--- E2E M3 (MONTER): ZA_MONTAZO + dealLocked → HINT, ni opcij ---"
agent-browser eval "(()=>{document.body.click(); const badges=[...document.querySelectorAll('.cursor-pointer')].filter(b=>b.textContent.trim()==='Za montažo'); const b=badges[0]; if(!b) return 'Ni ZA_MONTAZO značke'; b.click(); return 'kliknil';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const menu=document.querySelector('.absolute.right-3.top-12'); if(!menu) return 'meni NI odprt'; const note=menu.querySelector('[role=note]'); const gumbi=[...menu.querySelectorAll('button')].length; return JSON.stringify({hint: note?note.textContent.trim():null, gumbi});})()" 2>&1 | tail -1

echo "--- E2E M4 (MONTER): izbrani prehod MONTIRANO→ZAKLJUCENO sproži PATCH (toast) ---"
agent-browser eval "(()=>{const menu=document.querySelector('.absolute.right-3.top-12'); if(!menu) return 'meni NI odprt'; const b=[...menu.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith('Zaključeno')); if(b&&!b.disabled) b.click(); return JSON.stringify({nasel: !!b, disabled: b?.disabled});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toast=document.querySelector('[data-sonner-toast]'); return JSON.stringify({toast: toast?toast.textContent.slice(0,60):null});})()" 2>&1 | tail -1

echo "--- E2E M5: preostala opaka bela površina v temni temi (diagnoza) ---"
agent-browser eval "(()=>{const opake=[...document.querySelectorAll('[class*=bg-white]')].filter(el=>!/bg-white\\//.test(el.className)); return JSON.stringify(opake.map(el=>({cls: el.className.slice(0,80), tag: el.tagName, text: el.textContent.replace(/\\s+/g,' ').slice(0,40)})));})()" 2>&1 | tail -1

echo "--- E2E M6: konzola + screenshot ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r165-local-monter-dropdown.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 sproščen"; fi
echo "R165 E2E DEL2 KONEC"
