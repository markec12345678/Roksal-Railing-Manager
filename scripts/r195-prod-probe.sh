#!/bin/bash
# R195 produkcija QA — R194 CSRF dvojni žeton fingerprinti ŽIVO + MONTER regresije:
#   (a) /login noga 'Zgrajeno …' (R189 F2 regresija)
#   (b) MONTER prijava → document.cookie vsebuje roksal_csrf (R194 ŽIVO — izdaja piškotka)
#   (c) 'Aktivne seje' dialog: seznam + 'Ta naprava' značka (R137 regresija)
#   (d) Meritve: CSV gumb (R186) + Material/Zaloga pečati + banner skrit (R182/R177)
#   (e) VizTab offline pas (R188, startsWith) + temna + __err null
#   (f) FINAL: mutacija skozi ovoj (logout fetch) → 200 NE 403 (dvojni žeton ŽIVO) + oba piškotka pobrisana
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "--- 1) JAVNO: /login noga 'Zgrajeno …' (R189 F2) ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const n=[...document.querySelectorAll('p,span,div,small')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Zgrajeno ')); const v=[...document.querySelectorAll('p,span,div,small')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Verzija:')); return JSON.stringify({zgrajeno:n||null,verzija:v||null});})()" 2>&1 | tail -1

echo "--- 2) MONTER prijava → R194 ŽIVO: roksal_csrf piškotek ---"
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{const c=document.cookie; return JSON.stringify({url:location.pathname, csrfIzdan:c.includes('roksal_csrf='), csrfDolzina:(c.match(/roksal_csrf=([^;]+)/)||[])[1]?.length||0, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 3) 'Aktivne seje' dialog (R137 regresija) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=menuitem]')].find(x=>x.textContent.trim().startsWith('Aktivne seje')); if(m) m.click(); return !!m;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); if(!dlg) return JSON.stringify({dialog:false}); const vrstice=dlg.querySelectorAll('li').length; const znacka=!![...dlg.querySelectorAll('*')].find(e=>e.textContent.trim()==='Ta naprava'&&e.childElementCount===0); const stevec=[...dlg.querySelectorAll('p')].map(p=>p.textContent.trim()).find(t=>/aktivn(a|ih) sej/.test(t)); return JSON.stringify({dialog:true,vrstice,znackaTaNaprava:znacka,stevec});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r195-seje-dialog.png" > /dev/null 2>&1 && echo "screenshot SEJE DIALOG OK"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Zapri'); if(z) z.click(); return !!z;})()" > /dev/null 2>&1
sleep 2

echo "--- 4) Meritve: CSV gumb (R186) + pečat ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({csvGumb:!!g, pecat:p?p.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- 5) Material/Zaloga pečata + banner skrit ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({materialPecat:p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const b=[...document.querySelectorAll('div')].find(e=>e.textContent.trim()==='Na voljo je nova verzija aplikacije.'); return JSON.stringify({zalogaPecat:p?p.textContent.trim():null, bannerViden:!!b});})()" 2>&1 | tail -1

echo "--- 6) VizTab offline pas (R188, startsWith) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Vizualizacija')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "window.dispatchEvent(new Event('offline')); 'offline poslan'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const vDokumentuN=[...document.querySelectorAll('*')].filter(e=>e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')&&e.childElementCount===0).length; return JSON.stringify({pasOffline:vDokumentuN});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('online')); 'online poslan'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const vDokumentuN=[...document.querySelectorAll('*')].filter(e=>e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')&&e.childElementCount===0).length; return JSON.stringify({pasOnline:vDokumentuN});})()" 2>&1 | tail -1

echo "--- 7) temna tema + __err ---"
agent-browser eval "(()=>{const b=document.querySelector('body'); const bg=getComputedStyle(b).backgroundColor; return JSON.stringify({bodyBg:bg, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 8) FINAL — R194 ŽIVO: mutacija skozi ovoj (logout) → NE 403 + oba piškotka pobrisana ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logoutStatus:r.status});})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const c=document.cookie; return JSON.stringify({csrfOstane:c.includes('roksal_csrf='), url:location.pathname});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r195-logout.png" > /dev/null 2>&1 && echo "screenshot LOGOUT OK"

agent-browser close --all > /dev/null 2>&1 || true
echo "=== R195 produkcija QA konec ==="
