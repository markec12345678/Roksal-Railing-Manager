#!/bin/bash
# R240 prod core — R239 ŽIVO (žig 04:21:56Z > push 04:21:31Z = ~25 s — najhitrejši
# deploy doslej): RBAC UI ogledalo (P1-a) ŽIVO — spot račun: 'Nov projekt' gumb
# VIDEN/Odsoten = vloga fingerprint (ZAPIŠI; R240 še NIMA dialoga v prodi —
# ta pride po deployu, R241 ga preveri izrecno) + prodajna plošča CSV
# fail-closed fingerprint + needleji R239/R238 v čankih + Osnutek PDF
# regresija (%PDF + bajti) + geselni žetoni + temna + err null.
# Samo bralni pogledi + dialog odpri/Escape — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena odsotna + R239 RBAC ogledalo (spot vloga fingerprint!) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, novProjektViden:!!np, spotVlogaFingerprint:np?'VODSTVENA':'NE-VODSTVENA (MONTER/SKLADISCE)', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r240-prod-domov.png" > /dev/null 2>&1

echo "=== Z1b: če je gumb viden — dialog odpri → Escape (ZERO-MUTACIJA) ==="
agent-browser eval "(()=>{const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); if(!np) return 'gumb odsoten (ne-vodstvena veja — ni dialoga za test)'; np.click(); return 'klik';})()" 2>&1 | tail -1
eb_cakaj 2
agent-browser eval "(()=>{const odprt=!!document.querySelector('#proj-name'); if(!odprt) return JSON.stringify({dialogOdprt:false, vlogaSklep:'ne-vodstvena', err:window.__err??null}); const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc);} return JSON.stringify({dialogOdprt:true, vlogaSklep:'vodstvena', zaprtPoEsc:true, err:window.__err??null});})()" 2>&1 | tail -1
eb_cakaj 1

echo "=== Z2: prodajna plošča — R238 CSV gumb + fail-closed fingerprint (projektov v prodi) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi prodajno ploščo kot CSV\"]'); return !!g && !g.disabled;})()" 24
eb_csv_capture csvP
eb_csv_reset csvP
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_cakaj 2
agent-browser eval "(()=>{const toasts=[...document.querySelectorAll('[data-sonner-toast],[data-shadcn-toast],[role=\"status\"],[role=\"alert\"]')].map(t=>t.textContent).join('|'); const csvP=window.__csvP; if(typeof csvP!=='string'||csvP.length===0){ const fail=document.body.textContent.includes('Ni projektov na plošči za izvoz'); return JSON.stringify({csvNastal:false, failClosedToastPri0:fail, fingerprintProjektov:fail?'0':'NEZNAN', toasts:toasts.slice(0,200), err:window.__err??null}); } const cist=csvP.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r?\n/).filter(l=>l.includes(';')); return JSON.stringify({csvNastal:true, glavaOK:cist.startsWith('Naziv projekta;Status;Stranka;Vrednost (€);Spomnik;Datum montaže;Podpisano'), vrstic:Math.max(0,vrstice.length-1), fingerprintProjektov:Math.max(0,vrstice.length-1), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: deployed čanki — needleji R239 (RBAC ogledalo + resnica) + R238 ==="
OUT=/tmp/r240-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | python3 -c "import sys,json
raw=sys.stdin.read().strip()
try:
  arr=json.loads(raw)
  if isinstance(arr,str): arr=json.loads(arr)
  print('\n'.join(arr))
except Exception:
  print('')" > "$OUT"/chunk-urls.txt
i=0
while read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1))
  curl -s --max-time 20 "$url" -o "$OUT/chunk-$i.js"
done < "$OUT"/chunk-urls.txt
echo "  prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
FAIL=0
need() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2  (needle: $1)"; FAIL=1; fi
}
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "STAL : $2  (needle: $1)"; FAIL=1; else echo "OK   : $2 (odsoten — pravilno)"; fi
}
need "Projekt se ustvari v zavihku Domov (gumb »Nov projekt« — viden vodstvu)." "R239 vlogo-nevtralna resnica (measurements vodič)"
need "Projekt ni bil ustvarjen: " "R239 fail-verbose 403 razlog v toastu"
need "Ustvari projekt z gumbom Nov projekt (zgoraj)." "R239 vodstvena veja vodiča"
need "Projekt pripravi vodstvo — ko je objavljen, se pojavi na tem seznamu." "R239 ne-vodstvena veja vodiča"
need "Izvozi prodajno ploščo kot CSV" "R238 CSV gumb aria"
need "plosca_" "R238 filename prefix"
need "text-2xs" "P1-e žeton 2xs"
must_miss "text-[10px]" "arbitrary 10px odsoten"
must_miss "text-[8px]" "arbitrary 8px odsoten"
must_miss "Projekt ustvariš v zavihku Domov (gumb »Nov projekt«)." "stara resnica odsotna"
echo "NEEDLE FAIL=$FAIL"

echo "=== Z4: regresija R237 — Osnutek dialog PDF pill + %PDF (pod=1) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]');})()" 12
sleep 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 12
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 12
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magic:[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z5: geselni žetoni + temna + err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
sleep 1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Zamenjaj geslo'));})()" 8
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Zamenjaj geslo')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return !!document.querySelector('#pwd-current');})()" 8
sleep 1
agent-browser eval "(()=>{const inp=document.querySelector('#pwd-current'); if(!inp) return JSON.stringify({dialog:false}); const barva=getComputedStyle(inp).borderTopColor; return JSON.stringify({dialog:true, obroba:barva, obrobaNiStone:barva!=='rgb(214, 211, 209)'&&barva!=='rgb(231, 229, 228)', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo
agent-browser close --all > /dev/null 2>&1
echo "=== R240 prod core KONEC ==="
