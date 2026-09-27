#!/bin/bash
# R203 produkcija QA — R202 fingerprinti (deploy po pushu e002ea7)
#  (a) žig prek /api/public/version + /login noga 'Zgrajeno'
#  (b) sejni chunk byte: 'domov-brez-projektov' ≥1, 'Ni projektov za izbrani filter' ≥1, 'Ni aktivnih projektov' ×0
#  (c) spot (MONTER, 0 projektov): Domov → iskren stolpec ŽIVO (testid + 'Kaj naprej' 3 koraki +
#      korak1 'Ustvari projekt z gumbom Nov projekt (zgoraj).' + gumb 'Nov projekt' prisoten);
#      Meritve → vodič korak 1 'Projekt ustvariš v zavihku Domov (gumb »Nov projekt«).'
#  (d) regresije: zvonček ščit, pečati Material/Zaloga, offline pas, temna, __err null
#  🔴 Lekcije R201/R202: onboarding NI [role=dialog] → zapri prek TOČNO aria-label;
#      MONTER pristane na VIZ pogledu → pot do Domov = 'Montažna orodja' → 'Domov'
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "--- 0) žig prek /api/public/version ---"
curl -s -m 20 "$PROD/api/public/version" | head -c 500; echo

echo "--- 1) JAVNO: /login noga ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const n=[...document.querySelectorAll('p,span,div,small')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Zgrajeno ')); return JSON.stringify({zgrajeno:n||null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 2) MONTER prijava (spot) ---"
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 3) zapri onboarding → 'Montažna orodja' → 'Domov' ---"
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Domov')); if(d) d.click(); return !!d;})()" 2>&1 | tail -1
sleep 8
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

echo "--- 3b) R202 fp: Domov iskren prazni stolpec ŽIVO ---"
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"domov-brez-projektov\"]'); const niP=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni projektov').length; const stara=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni aktivnih projektov').length; const ol=document.querySelector('ol[aria-label=\"Kaj naprej\"]'); const koraki=ol?ol.querySelectorAll('li').length:null; const korak1=ol&&ol.querySelectorAll('li')[0]?ol.querySelectorAll('li')[0].textContent.trim():null; const nov=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Nov projekt').length; const filterP=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni projektov za izbrani filter').length; return JSON.stringify({blok:!!blok,niProjektov:niP,staraVrstica:stara,kajNaprej:!!ol,koraki,korak1,novProjektGumb:nov,filterPrazno:filterP,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r203-prod-domov.png" > /dev/null 2>&1 && echo "screenshot DOMOV PROD OK"

echo "--- 3c) sejni chunk byte scan (needleji + stara vrstica ×0) ---"
agent-browser eval "JSON.stringify([...new Set(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')))])" 2>&1 | tail -1 > /tmp/r203-chunks.json
python3 - <<'PYEOF'
import json, urllib.request
raw = open('/tmp/r203-chunks.json').read().strip()
try:
    urls = json.loads(raw)
except Exception:
    urls = []
hits = {"domov-brez-projektov": 0, "Ni projektov za izbrani filter": 0, "Ni aktivnih projektov": 0}
for u in urls:
    try:
        t = urllib.request.urlopen(u, timeout=15).read().decode('utf-8', 'ignore')
        for k in hits:
            if k in t:
                hits[k] += 1
    except Exception:
        pass
print("chunkov:", len(urls), "zadetki:", json.dumps(hits, ensure_ascii=False))
PYEOF

echo "--- 4) Meritve: vodič korak 1 nov besedilo (R202 F2) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z) z.click(); return !!z;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"meritve-brez-projektov\"]'); const novVodic=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.includes('Projekt ustvariš v zavihku Domov')).length; const starVodic=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.includes('Vodja ustvari projekt')).length; const dodaj=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Dodaj meritev').length; return JSON.stringify({blok:!!blok,novVodicKorak1:novVodic,stariVodicOstanki:starVodic,dodajMeritev:dodaj,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 5) regresije: Material + Zaloga pečati ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); return JSON.stringify({materialPecat:p[0]||null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); return JSON.stringify({zalogaPecat:p[0]||null});})()" 2>&1 | tail -1

echo "--- 6) zvonček ščit regresija ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const lbl=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); const sciti=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&/Nova prijava|neuspešn|aktiviran|geslo je bilo spremenjeno/.test(e.textContent.trim())&&e.textContent.trim().length<90).length; return JSON.stringify({zvoncekLbl:lbl?lbl.getAttribute('aria-label'):null,scitVrstic:sciti});})()" 2>&1 | tail -1
agent-browser eval "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); 'esc'" > /dev/null 2>&1
sleep 1

echo "--- 7) offline pas regresija (VizTab) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "window.dispatchEvent(new Event('offline')); 'off'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; return JSON.stringify({pasViden:pas>0});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('online')); 'on'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const n=[...document.querySelectorAll('*')].filter(e=>e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')&&e.childElementCount===0).length; return JSON.stringify({pasPoOnline:n});})()" 2>&1 | tail -1

echo "--- 8) temna + odjava ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r203-prod-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
agent-browser click 'button[aria-label="Odjava"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R203 PROD PROBE KONEC"
