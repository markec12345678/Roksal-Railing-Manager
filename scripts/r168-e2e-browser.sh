#!/bin/bash
# R168 E2E (lokalni build): TerminiCard 'Skupaj ur' agregat + filter tujih.
# ADMIN (ci@roksal.si / DimniSmoke139! — precedens R165–R167):
#  1) povzetek 'Skupaj …' viden in ENAK izračunu iz API resnice;
#  2) POST dva termina: moj (3 h) + tuj (5 h, brez monterja) → vsota zraste;
#  3) 'Samo moje' ON → tuj termin SKRIT, povzetek = samo moji;
#  4) temna tema: ring-offset var (R168 halo fix) + povzetek viden;
#  5) konzola čista; port sproščen.
# NAUČEK R157/R166/R167: celoten flow v ENEM bash klicu.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r168-e2e-server.log 2>&1 < /dev/null &
sleep 5
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/login

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5

# VizTab → Montažna orodja → Domov (nauček R168: pravi dashboard tab)
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5

echo "--- E2E 1: API resnica → pričakovani povzetek (filter OFF) ---"
agent-browser eval "(async()=>{const od=new Date(); od.setHours(0,0,0,0); const doD=new Date(od.getTime()+7*86400000-1); const r=await fetch('/api/schedules?od='+encodeURIComponent(od.toISOString())+'&do='+encodeURIComponent(doD.toISOString())+'&limit=50',{credentials:'same-origin'}); const rows=await r.json(); const a=await fetch('/api/auth',{credentials:'same-origin'}); const me=(await a.json()); const uid=me&&me.user?me.user.id:null; let ure=0,st=0,prek=0; for(const x of rows){ if(x.status==='PREKlicANO'){prek++;continue;} st++; if(typeof x.predvideneUre==='number'&&Number.isInteger(x.predvideneUre)&&x.predvideneUre>=0) ure+=x.predvideneUre; } const b=(n)=>n%10===1&&n%100!==11?'termin':(n%10===2&&n%100!==12?'termina':((n%10===3||n%10===4)&&n%100!==13&&n%100!==14?'termini':'terminov')); return JSON.stringify({uid, stVrstic: rows.length, priakovano: 'Skupaj '+ure+' h · '+st+' '+b(st), preklicanih: prek});})()" 2>&1 | tail -1
sleep 1
echo "--- E2E 1b: DOM povzetek (filter OFF) ---"
agent-browser eval "(()=>{const p=[...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj')); const naslov=!![...document.querySelectorAll('[data-slot=card-title]')].find(x=>(x.textContent||'').includes('Termini — naslednjih 7 dni')); return JSON.stringify({naslov, povzetek: p?(p.textContent||'').trim():null});})()" 2>&1 | tail -1

echo "--- E2E 2: POST moj termin (3 h, danes 09:00) + tuj (5 h, brez monterja, 11:00) ---"
agent-browser eval "(async()=>{const pr=await fetch('/api/projects',{credentials:'same-origin'}); const pd=await pr.json(); const projects=Array.isArray(pd)?pd:(pd.projects||[]); const p=projects[0]; if(!p) return JSON.stringify({napaka:'ni projektov'}); const danes=new Date(); const y=danes.getFullYear(),m=danes.getMonth(),d=danes.getDate(); const zacetek=new Date(y,m,d,9,0,0), konec=new Date(y,m,d,12,0,0); const moj=await fetch('/api/schedules',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.id,datumZacetka:zacetek.toISOString(),datumKonca:konec.toISOString(),predvideneUre:3,lokacija:'R168 E2E moja'})}); const zacetek2=new Date(y,m,d,13,0,0), konec2=new Date(y,m,d,18,0,0); const tuj=await fetch('/api/schedules',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:p.id,datumZacetka:zacetek2.toISOString(),datumKonca:konec2.toISOString(),predvideneUre:5,lokacija:'R168 E2E tuj'})}); return JSON.stringify({moj: moj.status, tuj: tuj.status, mojErr: moj.status!==201?await moj.text():null, tujErr: tuj.status!==201?await tuj.text():null});})()" 2>&1 | tail -1
sleep 1

echo "--- E2E 3: osveži → povzetek zraste (moj 3 h + tuj 5 h) ---"
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Osveži termine\"]'); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(async()=>{const od=new Date(); od.setHours(0,0,0,0); const doD=new Date(od.getTime()+7*86400000-1); const r=await fetch('/api/schedules?od='+encodeURIComponent(od.toISOString())+'&do='+encodeURIComponent(doD.toISOString())+'&limit=50',{credentials:'same-origin'}); const rows=await r.json(); let ure=0,st=0; for(const x of rows){ if(x.status==='PREKlicANO')continue; st++; if(typeof x.predvideneUre==='number'&&x.predvideneUre>=0) ure+=x.predvideneUre; } const p=[...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj')); const b=(n)=>n%10===1&&n%100!==11?'termin':(n%10===2&&n%100!==12?'termina':((n%10===3||n%10===4)&&n%100!==13&&n%100!==14?'termini':'terminov')); return JSON.stringify({priakovano:'Skupaj '+ure+' h · '+st+' '+b(st), dom: p?(p.textContent||'').trim():null, enako: p?(p.textContent||'').trim()===('Skupaj '+ure+' h · '+st+' '+b(st)):false});})()" 2>&1 | tail -1

echo "--- E2E 4: 'Samo moje' ON → tuj skrit, povzetek = samo moji ---"
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Samo moje termine\"]'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(async()=>{const a=await fetch('/api/auth',{credentials:'same-origin'}); const me=await a.json(); const uid=me&&me.user?me.user.id:null; const od=new Date(); od.setHours(0,0,0,0); const doD=new Date(od.getTime()+7*86400000-1); const r=await fetch('/api/schedules?od='+encodeURIComponent(od.toISOString())+'&do='+encodeURIComponent(doD.toISOString())+'&limit=50',{credentials:'same-origin'}); const rows=await r.json(); const moji=rows.filter(x=>x.monter&&x.monter.id===uid&&x.status!=='PREKlicANO'); let ure=0; for(const x of moji){ if(typeof x.predvideneUre==='number'&&x.predvideneUre>=0) ure+=x.predvideneUre; } const p=[...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj')); const tujViden=(document.body.innerText||'').includes('R168 E2E tuj'); const mojaViden=(document.body.innerText||'').includes('R168 E2E moja'); const b=(n)=>n%10===1&&n%100!==11?'termin':(n%10===2&&n%100!==12?'termina':((n%10===3||n%10===4)&&n%100!==13&&n%100!==14?'termini':'terminov')); const priakovano= moji.length? 'Skupaj '+ure+' h · '+moji.length+' '+b(moji.length) : 'Ni vaših terminov'; return JSON.stringify({mojiTermini: moji.length, priakovano, dom: p?(p.textContent||'').trim():null, tujSkrit: !tujViden, mojaViden, enako: p?(p.textContent||'').trim()===priakovano:false});})()" 2>&1 | tail -1

echo "--- E2E 5: filter OFF nazaj + temna tema + ring-offset var + konzola ---"
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Samo moje termine\"]'); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ringOffset=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); const p=[...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj')); const povzetekBarva=p?getComputedStyle(p).backgroundColor:null; return JSON.stringify({bodyBg: body, ringOffsetVar: ringOffset, povzetekBarva, belihOpakih: (()=>{let n=0; for(const e of document.querySelectorAll('div,span,p,button')){const bg=getComputedStyle(e).backgroundColor; if(bg&&bg.startsWith('rgb(255, 255, 255)')&&e.offsetParent) n++;} return n;})()});})()" 2>&1 | tail -1
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r168-e2e-termini-ure.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R168 E2E KONEC"
