#!/bin/bash
# R206 produkcija QA — R205 fingerprinti (push 3e57013 ~05:55 UTC; deploy običajno +20 s … +2 min)
#  (a) žig prek /api/public/version + /api/public/health + /login noga 'Zgrajeno'
#  (b) MONTER spot: Zaloga → gumb 'Osnutek' ŽIVO (aria 'Shrani naročilnico vidnih
#      artiklov kot osnutek naročila') + klik → dialog (UNIKATEN naslov — lekcija R205)
#      + submit BREZ dobavitelja → zaščitni toast 'Izberite dobavitelja za osnutek
#      naročila.' (nič NE pošlje — brez zapisov v produkcijo) + zapri
#  (c) regresije: Naročilnica (R204 odložišče fail-verbose toast), Meritve Povzetek (R203),
#      Domov blok (R202), Material/Zaloga pečati, zvonček, offline pas, temna, __err null
#  (d) sejni chunk scan (json.loads ×2): 'Shrani naročilnico vidnih artiklov kot osnutek
#      naročila' ≥1, 'Osnutek naročila shranjen (status OSNUTEK)' ≥1, 'Nič še ni poslano
#      dobavitelju.' ≥1, 'Prenesi naročilnico vidnih artiklov kot CSV' ≥1, 'Ni dobaviteljev
#      — najprej dodaj dobavitelja' ≥1; GONE 'Naročilo bo poslano dobavitelju.' ×0
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "--- 0) žig + javni health ---"
curl -s -m 20 "$PROD/api/public/version" | head -c 400; echo
curl -s -m 20 "$PROD/api/public/health" | head -c 200; echo

echo "--- 1) JAVNO: /login noga (TZ žig) ---"
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

echo "--- 3) zapri onboarding → 'Montažna orodja' → 'Meritve' (R203 regresija) ---"
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
agent-browser eval "(()=>{const pv=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Kopiraj povzetek vidnih meritev v odložišče').length; const blok=document.querySelector('[data-testid=\"meritve-brez-projektov\"]'); return JSON.stringify({povzetekGumb:pv,iskrenBlok:!!blok,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 4) 'Montažna orodja' → 'Domov' (R202 regresija) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Domov')); if(d) d.click(); return !!d;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"domov-brez-projektov\"]'); const ol=document.querySelector('ol[aria-label=\"Kaj naprej\"]'); return JSON.stringify({blok:!!blok,kajNaprej:!!ol,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 5) Več → Zaloga (R205 fp: gumb 'Osnutek' + dialog brez zapisov) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().startsWith('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const nar=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo').length; const osn=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila').length; const csv=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='CSV').length; const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); return JSON.stringify({narocilnicaGumb:nar,osnutekGumb:osn,csvGumb:csv,pecat:p[0]||null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); if(!D) return JSON.stringify({mojDialog:false,toast:document.querySelector('[data-sonner-toast]')?.textContent.trim().slice(0,90)??null}); const pregled=[...D.querySelectorAll('*')].filter(e=>e.childElementCount===0&&/naroči \\d+(\\.\\d+)? \\S+/.test(e.textContent.trim())).length; const combobox=!!D.querySelector('button[role=combobox]'); const niDob=[...D.querySelectorAll('p')].some(e=>e.textContent.includes('Ni dobaviteljev')); const opombe=!!D.querySelector('#osnutek-opombe'); const csvPriloga=[...D.querySelectorAll('button')].some(x=>(x.getAttribute('aria-label')||'')==='Prenesi naročilnico vidnih artiklov kot CSV'); return JSON.stringify({mojDialog:true,pregled,combobox,niDobaviteljev:niDob,opombe,csvPriloga});})()" 2>&1 | tail -1
# zaščitna pot: submit BREZ izbranega dobavitelja → iskren toast, NIČ NE pošlje (brez zapisov v produkcijo)
agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); const b=D&&[...D.querySelectorAll('button')].find(x=>x.textContent.trim()==='Shrani osnutek'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[data-sonner-toast]')].map(e=>e.textContent.trim()).find(x=>x.startsWith('Izberite dobavitelja'))||null; const D=[...document.querySelectorAll('[role=dialog]')].some(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); return JSON.stringify({zascitToast:t,dialogSeOdprt:D,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r206-prod-osnutek-dialog.png" > /dev/null 2>&1 && echo "screenshot OSNUTEK PROD OK"
agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); const pr=D&&[...D.querySelectorAll('button')].find(x=>x.textContent.trim()==='Prekliči'); if(pr) pr.click(); return 'zaprt';})()" > /dev/null 2>&1
sleep 1

echo "--- 6) R204 regresija: gumb Naročilnica (odložišče fail-verbose) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[data-sonner-toast]')].map(e=>e.textContent.trim()).find(x=>x.includes('odložišča'))||null; return JSON.stringify({clipboardToast:t,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 7) sejni chunk byte scan (json.loads ×2) ---"
agent-browser eval "JSON.stringify([...new Set(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')))])" 2>&1 | tail -1 > /tmp/r206-chunks.json
python3 - <<'PYEOF'
import json, urllib.request
raw = open('/tmp/r206-chunks.json').read().strip()
try:
    obj = json.loads(raw)
    if isinstance(obj, str):
        obj = json.loads(obj)
    urls = obj if isinstance(obj, list) else []
except Exception:
    urls = []
hits = {
    "Shrani naro\u010dilnico vidnih artiklov kot osnutek naro\u010dila": 0,
    "Osnutek naro\u010dila shranjen (status OSNUTEK)": 0,
    "Ni\u010d \u0161e ni poslano dobavitelju.": 0,
    "Prenesi naro\u010dilnico vidnih artiklov kot CSV": 0,
    "Ni dobaviteljev \u2014 najprej dodaj dobavitelja": 0,
    "Naro\u010dilo bo poslano dobavitelju.": 0,
    "Kopiraj naro\u010dilnico vidnih artiklov pod minimalno zalogo": 0,
    "Kopiraj povzetek vidnih meritev": 0,
    "Ni projektov za izbrani filter": 0,
    "domov-brez-projektov": 0,
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

echo "--- 8) regresije: Material pečat + zvonček ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); return JSON.stringify({materialPecat:p[0]||null,err:window.__err??null});})()" 2>&1 | tail -1
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
agent-browser screenshot "$SS/qa-r206-prod-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
agent-browser click 'button[aria-label="Odjava"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R206 PROD PROBE KONEC"
