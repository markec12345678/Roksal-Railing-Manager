#!/bin/bash
# R239 prod core — R238 ŽIVO (žig 03:37:23 > push ~03:31, ~6 min): PRODAJNA
# PLOŠČA CSV ŽIVO (Več → CRM; fingerprint projektov v prodi = NEZNAN — če 0
# → fail-closed toast = prav tako zelen; ZAPIŠI fingerprint) + P1-e mikro
# tipografija ŽIVO dokaz (kompilirani CSS: .text-2xs{.625rem} + .text-3xs
# {.5rem} prisotna, ESCAPIRANA arbitrary odsotna — dokaz prek fetch VSEH
# linkov, .includes na VSEBINI — r238 lekcija 4) + needleji R238 v čankih
# + regresije R223–R237 (Osnutek PDF pill + %PDF pri pod=1, Dobavitelji PDF
# fail-closed pri 0, Naročilnica pill odsoten pri 0 naročil, CSV vodje,
# geselni žetoni, Domov 8, temna, err null).
# Samo bralni pogledi — ZERO-MUTACIJA (CSV izvoz = bralni tok, brez raise).
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena odsotna (fingerprint) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2: CRM → prodajna plošča — R238 JEDRO ŽIVO: CSV gumb + capture (fingerprint projektov!) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi prodajno ploščo kot CSV\"]'); return !!g && !g.disabled;})()" 24
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi prodajno ploščo kot CSV\"]'); if(!g) return JSON.stringify({gumb:false}); return JSON.stringify({gumb:true, title:g.getAttribute('title'), disabled:g.disabled, err:window.__err??null});})()" 2>&1 | tail -1
eb_csv_capture csvP
eb_csv_reset csvP
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_cakaj 2
agent-browser screenshot "$SS/qa-r239-prod-plosca.png" > /dev/null 2>&1
agent-browser eval "(()=>{const toasts=[...document.querySelectorAll('[data-sonner-toast],[data-shadcn-toast],[role=\"status\"],[role=\"alert\"]')].map(t=>t.textContent).join('|'); const csvP=window.__csvP; if(typeof csvP!=='string'||csvP.length===0){ const fail=document.body.textContent.includes('Ni projektov na plošči za izvoz'); return JSON.stringify({csvNastal:false, failClosedToastPri0:fail, toasts:toasts.slice(0,300), err:window.__err??null}); } const cist=csvP.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r?\n/).filter(l=>l.includes(';')); const glava='Naziv projekta;Status;Stranka;Vrednost (€);Spomnik;Datum montaže;Podpisano'; const podpisi=vrstice.slice(1).map(l=>l.split(';')[6]); const podpisiOK=podpisi.every(p=>p==='DA'||p==='NE'); return JSON.stringify({csvNastal:true, glavaOK:cist.startsWith(glava), glava:vrstice[0]===undefined?null:cist.split(/\\r?\\n/)[0], vrstic:Math.max(0,vrstice.length-1), podpisiIzkljucnoDANE:podpisiOK, podpisiVzorci:podpisi.slice(0,3), toasts:toasts.slice(0,300), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2b: P1-e kompilirani CSS ŽIVO dokaz (fetch VSEH CSS linkov, .includes na vsebini) ==="
agent-browser eval "(()=>{window.__cssProof=null; const lnki=[...document.querySelectorAll('link[rel=\"stylesheet\"]')].map(l=>l.href).filter(h=>h.includes('/_next/')); if(lnki.length===0){window.__cssProof=JSON.stringify({css:false}); return 'ni-css';} Promise.all(lnki.map(h=>fetch(h).then(r=>r.text()))).then(zi=>{const t=zi.join('\\n'); window.__cssProof=JSON.stringify({css:true, chunkov:lnki.length, dva:t.includes('.text-2xs{'), tri:t.includes('.text-3xs{'), dvaPx:t.includes('font-size:.625rem'), triPx:t.includes('font-size:.5rem'), arbitrary10:t.includes('text-\\\\[10px\\\\]'), arbitrary8:t.includes('text-\\\\[8px\\\\]')});}).catch(e=>{window.__cssProof=JSON.stringify({css:false, napaka:String(e)});}); return 'pognano:'+lnki.length;})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "(()=>{return typeof window.__cssProof==='string'?window.__cssProof:JSON.stringify({pristejalo:false});})()" 2>&1 | tail -1

echo "=== Z3: deployed čanki — needleji R238 + P1-e žetoni + NEGATIVNI arbitrary ==="
OUT=/tmp/r239-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
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
need "Izvozi prodajno ploščo kot CSV" "R238 CSV gumb aria"
need "Izvozi vidne projekte z vrednostjo, spomnikom in podpisom kot CSV za Excel" "R238 CSV gumb title"
need "Ni projektov na plošči za izvoz" "R238 fail-closed toast pri 0"
need "Izvoz ni uspel" "R238 fail-verbose catch (shadcn)"
need "plosca_" "R238 filename prefix (ločen od projekti_)"
need 'Naziv projekta","Status","Stranka","Vrednost (€)","Spomnik","Datum montaže","Podpisano"' "R238 glava (kompilirana oblika)"
need "text-2xs" "P1-e žeton text-2xs v čankih"
need "text-3xs" "P1-e žeton text-3xs v čankih"
must_miss "text-[10px]" "P1-e arbitrary 10px izginil iz JS čankov (migracija 666)"
must_miss "text-[8px]" "P1-e arbitrary 8px izginil iz JS čankov"
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

echo "=== Z5: regresije R236/R235 — Dobavitelji PDF fail-closed pri 0 + Naročilnica pill odsoten pri 0 naročil ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]');})()" 12
eb_zajem_pdf pdfS
eb_csv_reset pdfS
eb_klik_gumb "Izvozi dobavitelje kot PDF"
eb_cakaj 3
agent-browser eval "(()=>{const toast=document.body.textContent.includes('Ni dobaviteljev za izvoz'); return JSON.stringify({failClosedToast:toast, pdfNastal:typeof window.__pdfS==='string', err:window.__err??null});})()" 2>&1 | tail -1
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
eb_cakaj 3
agent-browser eval "(()=>{const pill=document.querySelector('button[aria-label^=\"Prenesi naročilnico naročila pri\"]'); return JSON.stringify({narocilnicaPillOdsotnaPri0:!pill, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z6: CSV vodje regresija + geselni žetoni + temna + err null + health ==="
eb_dispatch '{"tab":"more","more":"vodja"}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]');})()" 12
eb_csv_capture csvV
eb_csv_reset csvV
eb_klik_gumb "Izvozi dnevni pregled vodje kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__csvV==='string'&&window.__csvV.length>10;})()" 12
agent-browser eval "(()=>{const t=window.__csvV; if(typeof t!=='string') return JSON.stringify({csv:false,err:window.__err??null}); const cist=t.replace(/^\uFEFF/,''); return JSON.stringify({csv:true, zamujena0:cist.includes('\"Opozorila\",\"Zamujena dobava\",\"0\"'), brez8:cist.includes('\"Opozorila\",\"Brez dobavitelja\",\"8\"'), err:window.__err??null});})()" 2>&1 | tail -1
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
echo "=== R239 core KONEC ==="
