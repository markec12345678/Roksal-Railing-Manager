#!/bin/bash
# R241 prod core — deploy ŽIVO (žig 05:34:46Z > R241 commit 05:34:20Z = ~26 s;
# vsebuje R240 ⊇ R241). JEDRO: (Z1b) R240 'Moja vloga in dovoljenja' dialog —
# ZAPIŠI eksplicitno spot vlogo (MONTER=11 / SKLADISCE=7 — zapre fingerprint
# vprašanje iz R239); (Z2) R241 RBAC ogledalo Računov ŽIVO za spot (read-only):
# 'Nov račun' ODSOTEN + vodič VIDEN + pisalne akcije ODSOTNE + PDF/CSV VIDNI;
# (Z3) needleji R241/R240/R239/R238 v odposlanih čankih (dispač tabov —
# lekcija R240); (Z4) Osnutek PDF regresija (!disabled-wait že v 1. iteraciji);
# (Z5) geselni žetoni + temna + err null + health. Samo bralni pogledi +
# dialogi odpri/Escape — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena odsotna + R239 ogledalo (spot fingerprint) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, novProjektViden:!!np, spotVlogaFingerprint:np?'VODSTVENA':'NE-VODSTVENA (MONTER/SKLADISCE)', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r241-prod-domov.png" > /dev/null 2>&1

echo "=== Z1b: R240 JEDRO — 'Moja vloga in dovoljenja' dialog (ZAPIŠI vlogo!) ==="
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Moja vloga in dovoljenja'));})()" 10
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Moja vloga in dovoljenja')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const d=document.body.textContent; return d.includes('Moja vloga in dovoljenja') && d.includes('od 28 dovoljenj');})()" 14
sleep 1
agent-browser eval "(()=>{const dialog=document.querySelector('[role=\"dialog\"]'); if(!dialog) return JSON.stringify({dialog:false, err:window.__err??null}); const vsebina=dialog.textContent; const povzetek=vsebina.match(/Imate (\d+) od (\d+) dovoljenj/); const zaklepi=dialog.querySelectorAll('.lucide-lock').length; const napaka=!!dialog.querySelector('[role=\"alert\"]'); let vloga='NEZNANA'; for (const [chip,ime] of [['Admin','ADMIN'],['Vodja','VODJA'],['Monter','MONTER'],['Skladišče','SKLADISCE']]) { if (vsebina.includes(chip)) { vloga=ime; break; } } return JSON.stringify({dialog:true, vloga, povzetek:povzetek?[povzetek[1],povzetek[2]]:null, zaklepi, napaka, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r241-prod-vloga-dialog.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z2: R241 JEDRO — CRM → Računi ogledalo ŽIVO za spot (read-only veja) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('(FURS)');})()" 24
sleep 2
agent-browser eval "(()=>{const nov=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov račun')); const vodic=document.body.textContent.includes('Pregled računov je samo za branje'); const vodicImena=document.body.textContent.includes('invoices.create / invoices.issue / invoices.cancel'); const csv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi račune kot CSV'); const izdaj=[...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Izdaj')); const placan=[...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Plačan')); const brisi=[...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Briši')); const storno=[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Storno')); const uredi=[...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Uredi')); const pdf=[...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('PDF')); const qr=[...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('QR')); const xml=[...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('XML')); return JSON.stringify({novRacunViden:!!nov, vodicViden:vodic, vodicImena, csvViden:!!csv, izdaj, placan, brisi, storno, uredi, pdf, qr, xml, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r241-prod-racuni-spot.png" > /dev/null 2>&1

echo "=== Z2b: prodajna plošča — R238 CSV fail-closed fingerprint ==="
eb_csv_capture csvP
eb_csv_reset csvP
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_cakaj 2
agent-browser eval "(()=>{const csvP=window.__csvP; if(typeof csvP!=='string'||csvP.length===0){ const fail=document.body.textContent.includes('Ni projektov na plošči za izvoz'); return JSON.stringify({csvNastal:false, failClosedToastPri0:fail, fingerprintProjektov:fail?'0':'NEZNAN', err:window.__err??null}); } const cist=csvP.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r?\n/).filter(l=>l.includes(';')); return JSON.stringify({csvNastal:true, glavaOK:cist.startsWith('Naziv projekta;Status;Stranka;Vrednost (€);Spomnik;Datum montaže;Podpisano'), vrstic:Math.max(0,vrstice.length-1), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: deployed čanki — needleji R241/R240/R239/R238 (dispač tabov) ==="
OUT=/tmp/r241-chunks
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
echo "--- R241 (RBAC ogledalo Računov) ---"
need "Pregled računov je samo za branje" "R241 vlogo-osveščen vodič"
need "invoices.create / invoices.issue / invoices.cancel" "R241 vodič navaja imena pravic iz vrat"
echo "--- R240 (Moja vloga) ---"
need "Moja vloga in dovoljenja" "R240 meni item + dialog naslov"
need "Kaj vaš račun sme v aplikaciji" "R240 dialog opis"
need "Branje projektov" "R240 katalog label v klientu"
echo "--- R239/R238 regresije ---"
need "Projekt ni bil ustvarjen: " "R239 fail-verbose 403 razlog"
need "Izvozi prodajno ploščo kot CSV" "R238 CSV gumb aria"
need "plosca_" "R238 filename prefix"
need "text-2xs" "P1-e žeton 2xs"
must_miss "text-[10px]" "arbitrary 10px odsoten"
must_miss "text-[8px]" "arbitrary 8px odsoten"
echo "NEEDLE FAIL=$FAIL"

echo "=== Z4: regresija R237 — Osnutek dialog PDF pill + %PDF (!disabled-wait 1. iteracija) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 14
sleep 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
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
eb_cakaj 1
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R241 PROD CORE KONEC ==="
