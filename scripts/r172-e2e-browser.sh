#!/bin/bash
# R172 E2E (lokalni build, EN klic — nauček R157/R168): .ics koledarski izvoz
# IZVOŽENO=ZASLON (P1-d) + regresija CSV/dark/refetch-on-focus.
# ADMIN (ci@roksal.si / DimniSmoke139!):
#  S0: Termini kartica — ICS gumb omogočen (4 termini v dev bazi), pečat živo;
#  I1: KLIK ICS gumba (eval-klik; blob ujet z URL.createObjectURL patchem,
#      MIME text/calendar) → bajtni pregled ICS: VCALENDAR glava, 4 VEVENT,
#      UID termin-*, DTSTAMP = pečat, STATUS:CANCELLED (1 preklicani v bazi),
#      DTEND = DTSTART + predvideneUre, 'Dan: Danes', PRODID Termini kartica;
#  C1: regresija — CSV ujetje še vedno deluje (r171 pot nedotaknjena);
#  T:  temna tema + ring-offset #0f1724 (R168 fix) + window.__err null.
# ⚠️ R171 NAUČEK: standalone RABI statiko — graditi z `npm run build`.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r172-e2e-server.log 2>&1 < /dev/null &
sleep 5
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/login

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5

# Izhod iz VizTab v interni app (R168 nauček):
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Domov'); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 5

echo "--- S0: ICS gumb omogočen (podatki) + pečat + povzetek ---"
agent-browser eval "(()=>{const kartica=document.body.innerText.includes('Termini \\u2014 naslednjih 7 dni'); const btn=document.querySelector('button[aria-label^=\"Izvozi prikazane termine v koledarsko\"]'); const omogocen=btn?!btn.disabled:null; const label=btn?btn.getAttribute('aria-label'):null; const pecat=document.body.innerText.match(/Osve\\u017eeno ob\\s+\\d{1,2}:\\d{2}:\\d{2}/); const povzetek=([...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj'))||{textContent:null}).textContent; return JSON.stringify({kartica, icsGumb: !!btn, omogocen, label, pecat: pecat?pecat[0]:null, povzetek});})()" 2>&1 | tail -1

echo "--- I1: ICS ujetje prek blob (MIME text/calendar) ---"
agent-browser eval "(()=>{window.__r172ics=null; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(blob){const u=orig(blob); if(blob instanceof Blob && blob.type.includes('calendar')) blob.text().then(t=>{window.__r172ics=t;}); return u;}; document.querySelector('button[aria-label^=\"Izvozi prikazane termine v koledarsko\"]').click(); return 'klikano';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=window.__r172ics; if(!t) return JSON.stringify({ujetje:null, toast: document.body.innerText.includes('Koledarska datoteka izvo\\u017eena')}); const ev = (t.match(/BEGIN:VEVENT/g)||[]).length; const canc = (t.match(/STATUS:CANCELLED/g)||[]).length; const dtendDrugi = [...t.matchAll(/DTSTART:(\\S+)\\r\\nDTEND:(\\S+)/g)].map(m=>m[1]!==m[2]); return JSON.stringify({ujetje: true, bajtov: t.length, glava: t.startsWith('BEGIN:VCALENDAR\\r\\nVERSION:2.0'), prodid: t.includes('PRODID:-//Roksal Railing Manager//Termini kartica//SL'), dogodki: ev, preklicanih: canc, uidVzorec: t.includes('UID:termin-'), dtstamp: /DTSTAMP:\\d{8}T\\d{6}Z/.test(t), trajanjeOdUre: dtendDrugi.filter(Boolean).length, danDanes: t.includes('Dan: Danes'), crlf: t.endsWith('\\r\\n'), toast: document.body.innerText.includes('Koledarska datoteka izvo\\u017eena')});})()" 2>&1 | tail -1

echo "--- C1: regresija CSV (r171 pot) — blob ujetje ---"
agent-browser eval "(()=>{window.__r172csv=null; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(blob){const u=orig(blob); if(blob instanceof Blob && blob.type.includes('csv')) blob.text().then(t=>{window.__r172csv=t;}); return u;}; document.querySelector('button[aria-label^=\"Izvozi prikazane termine v CSV\"]').click(); return 'klikano';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=window.__r172csv; if(!t) return JSON.stringify({csvUjetje:null}); const vrstice=t.replace(/^\\uFEFF/,'').split('\\r\\n'); return JSON.stringify({csvUjetje: vrstice.length, povzetek: vrstice.find(x=>x.startsWith('Povzetek;'))});})()" 2>&1 | tail -1

echo "--- T: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ro=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset: ro, err: window.__err || null});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r172-e2e-dashboard.png > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R172 E2E KONEC"
