#!/bin/bash
# R204 produkcija QA — R203 fingerprinti (deploy po pushu ecddafa, push ~04:40 UTC; ta probe 04:45+ UTC)
#  (a) žig prek /api/public/version + /api/public/health + /login noga 'Zgrajeno'
#  (b) MONTER spot: Meritve → R203 fp: gumb 'Povzetek' ŽIVO (aria-label 'Kopiraj povzetek vidnih meritev v odložišče')
#      + klik na praznem seznamu → iskren toast 'Ni meritev za kopiranje.' (brez clipboard dostopa)
#  (c) sejni chunk byte (json.loads ×2 — lekcija R203): 'Kopiraj povzetek vidnih meritev' ≥1,
#      'prilepi v SMS/WhatsApp' ≥1, 'Zaloga ni na voljo' ≥1 (dashboard chunk), 'Ni projektov za izbrani filter' ≥1 (R202),
#      'keep empty' ×0; Ekipa/Fotke/katalog chunki če naloženi
#  (d) regresije: Domov iskren stolpec (R202), Material/Zaloga pečati, zvonček, offline pas, temna, __err null
#  🔴 Lekcije: onboarding zapri prek TOČNO aria-label; MONTER pristane na VIZ → pot do Domov = 'Montažna orodja'
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "--- 0) žig + javni health ---"
curl -s -m 20 "$PROD/api/public/version" | head -c 400; echo
curl -s -m 20 "$PROD/api/public/health" | head -c 200; echo

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

echo "--- 3) zapri onboarding → 'Montažna orodja' → 'Meritve' ---"
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

echo "--- 3b) R203 fp: Meritve gumb 'Povzetek' ŽIVO + prazni seznam iskren toast ---"
agent-browser eval "(()=>{const pv=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Kopiraj povzetek vidnih meritev v odložišče').length; const csv=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').includes('CSV')||b.textContent.trim()==='CSV').length; const blok=document.querySelector('[data-testid=\"meritve-brez-projektov\"]'); return JSON.stringify({povzetekGumb:pv,csvGumb:csv,iskrenBlok:!!blok,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Kopiraj povzetek vidnih meritev v odložišče'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni meritev za kopiranje.').length; return JSON.stringify({iskrenToast:t>0,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r204-prod-meritve-povzetek.png" > /dev/null 2>&1 && echo "screenshot MERITVE PROD OK"

echo "--- 4) 'Montažna orodja' → 'Domov' (R202 regresija) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Domov')); if(d) d.click(); return !!d;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"domov-brez-projektov\"]'); const niP=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni projektov').length; const ol=document.querySelector('ol[aria-label=\"Kaj naprej\"]'); const nov=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Nov projekt').length; return JSON.stringify({blok:!!blok,niProjektov:niP,kajNaprej:!!ol,novProjektGumb:nov,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r204-prod-domov.png" > /dev/null 2>&1 && echo "screenshot DOMOV PROD OK"

echo "--- 5) Več → Ekipa (chunk za 'Ustvarjanje ekipe ni uspelo') ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Ekipa')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const glava=[...document.querySelectorAll('h1,h2,h3,span,p')].map(e=>e.textContent.trim()).filter(t=>t.startsWith('Ekipa')).length; return JSON.stringify({ekipaGlava:glava>0,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 6) sejni chunk byte scan (LEKCIJA R203: json.loads ×2) ---"
agent-browser eval "JSON.stringify([...new Set(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')))])" 2>&1 | tail -1 > /tmp/r204-chunks.json
python3 - <<'PYEOF'
import json, urllib.request
raw = open('/tmp/r204-chunks.json').read().strip()
try:
    obj = json.loads(raw)
    if isinstance(obj, str):
        obj = json.loads(obj)
    urls = obj if isinstance(obj, list) else []
except Exception:
    urls = []
hits = {
    "Kopiraj povzetek vidnih meritev": 0,
    "prilepi v SMS/WhatsApp": 0,
    "Zaloga ni na voljo": 0,
    "Strank ni bilo mogo\u010de nalo\u017eiti": 0,
    "Ni projektov za izbrani filter": 0,
    "domov-brez-projektov": 0,
    "meritve-brez-projektov": 0,
    "Ustvarjanje ekipe ni uspelo": 0,
    "Neuspe\u0161nih prenosov": 0,
    "keep empty": 0,
}
for u in urls:
    try:
        t = urllib.request.urlopen(u, timeout=15).read().decode('utf-8', 'ignore')
        for k in hits:
            if k in t:
                hits[k] += 1
    except Exception:
        pass
print("chunkov:", len(urls))
print("zadetki:", json.dumps(hits, ensure_ascii=False))
PYEOF

echo "--- 7) regresije: Material + Zaloga pečati ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); return JSON.stringify({materialPecat:p[0]||null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); return JSON.stringify({zalogaPecat:p[0]||null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 8) zvonček ščit regresija ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const lbl=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); const sciti=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&/Nova prijava|neuspešn|aktiviran|geslo je bilo spremenjeno/.test(e.textContent.trim())&&e.textContent.trim().length<90).length; return JSON.stringify({zvoncekLbl:lbl?lbl.getAttribute('aria-label'):null,scitVrstic:sciti});})()" 2>&1 | tail -1
agent-browser eval "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); 'esc'" > /dev/null 2>&1
sleep 1

echo "--- 9) offline pas regresija (VizTab) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "window.dispatchEvent(new Event('offline')); 'off'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; return JSON.stringify({pasViden:pas>0});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('online')); 'on'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const n=[...document.querySelectorAll('*')].filter(e=>e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')&&e.childElementCount===0).length; return JSON.stringify({pasPoOnline:n});})()" 2>&1 | tail -1

echo "--- 10) temna + odjava ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r204-prod-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
agent-browser click 'button[aria-label="Odjava"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R204 PROD PROBE KONEC"
