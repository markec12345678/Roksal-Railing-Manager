#!/bin/bash
# R205 produkcija QA — R204 fingerprinti (push e4130ec 05:13:34 UTC; ta probe 05:15+ UTC veliko kasneje)
#  (a) žig prek /api/public/version + /api/public/health + /login noga 'Zgrajeno'
#  (b) javni chunki (json.loads ×2 — lekcija R203): R204 needleji:
#      'Kopiraj naročilnico vidnih artiklov pod minimalno zalogo' ≥1, 'prilepi v e-pošto/SMS dobavitelju.' ≥1,
#      'Ni artiklov pod minimalno zalogo' ≥1, 'Naročilnica — Zaloga pod minimumom' ≥1;
#      GONE: 'Naročilo bo poslano dobavitelju.' ×0, 'toast.info' ×0;
#      regresije: 'Kopiraj povzetek vidnih meritev' ≥1 (R203), 'Ni projektov za izbrani filter' ≥1 (R202),
#      'domov-brez-projektov' ≥1 (R202), 'keep empty' ×0
#  (c) MONTER spot: Meritve → gumb 'Povzetek' ŽIVO (R203); Zaloga → gumb 'Naročilnica' ŽIVO (R204) + klik → toast
#  (d) regresije: Domov iskren stolpec (R202), Material/Zaloga pečati, zvonček, offline pas, temna, __err null
#  🔴 Lekcije: onboarding zapri prek TOČNO aria-label; MONTER pristane na VIZ → pot prek 'Montažna orodja'
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
echo "--- 3b) R203 fp: Meritve gumb 'Povzetek' ŽIVO ---"
agent-browser eval "(()=>{const pv=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Kopiraj povzetek vidnih meritev v odložišče').length; const csv=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='CSV').length; const blok=document.querySelector('[data-testid=\"meritve-brez-projektov\"]'); return JSON.stringify({povzetekGumb:pv,csvGumb:csv,iskrenBlok:!!blok,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 4) 'Montažna orodja' → 'Domov' (R202 regresija) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Domov')); if(d) d.click(); return !!d;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"domov-brez-projektov\"]'); const ol=document.querySelector('ol[aria-label=\"Kaj naprej\"]'); const nov=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Nov projekt').length; return JSON.stringify({blok:!!blok,kajNaprej:!!ol,novProjektGumb:nov,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 5) Več → Zaloga (R204 fp: gumb 'Naročilnica' ŽIVO + klik) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().startsWith('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const nar=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo').length; const csv=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='CSV').length; const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); const nizke=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Naroči').length; return JSON.stringify({narocilnicaGumb:nar,csvGumb:csv,pecat:p[0]||null,narociVrstic:nizke,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toasts=[...document.querySelectorAll('[data-sonner-toast],li[aria-live]')].map(e=>e.textContent.trim()).filter(t=>t.length>0&&t.length<160); return JSON.stringify({toasts,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r205-prod-zaloga-narocilnica.png" > /dev/null 2>&1 && echo "screenshot ZALOGA PROD OK"

echo "--- 6) sejni chunk byte scan (json.loads ×2) ---"
agent-browser eval "JSON.stringify([...new Set(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')))])" 2>&1 | tail -1 > /tmp/r205-chunks.json
python3 - <<'PYEOF'
import json, urllib.request
raw = open('/tmp/r205-chunks.json').read().strip()
try:
    obj = json.loads(raw)
    if isinstance(obj, str):
        obj = json.loads(obj)
    urls = obj if isinstance(obj, list) else []
except Exception:
    urls = []
hits = {
    "Kopiraj naro\u010dilnico vidnih artiklov pod minimalno zalogo": 0,
    "prilepi v e-po\u0161to/SMS dobavitelju.": 0,
    "Ni artiklov pod minimalno zalogo": 0,
    "Naro\u010dilnica \u2014 Zaloga pod minimumom": 0,
    "Naro\u010dilo bo poslano dobavitelju.": 0,
    "toast.info": 0,
    "Kopiraj povzetek vidnih meritev": 0,
    "Ni projektov za izbrani filter": 0,
    "domov-brez-projektov": 0,
    "meritve-brez-projektov": 0,
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

echo "--- 7) regresije: Material pečat + zvonček ---"
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

echo "--- 8) offline pas regresija (VizTab) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "window.dispatchEvent(new Event('offline')); 'off'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; return JSON.stringify({pasViden:pas>0});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('online')); 'on'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const n=[...document.querySelectorAll('*')].filter(e=>e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')&&e.childElementCount===0).length; return JSON.stringify({pasPoOnline:n});})()" 2>&1 | tail -1

echo "--- 9) temna + odjava ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r205-prod-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
agent-browser click 'button[aria-label="Odjava"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R205 PROD PROBE KONEC"
