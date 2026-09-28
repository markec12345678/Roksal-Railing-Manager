#!/bin/bash
# R238 prod core — R237 ŽIVO (žig 02:45:59 > push 02:45:39 — najhitrejši
# deploy doslej ~20 s): Osnutek dialog PDF pill ŽIVO ob CSV (pod=1 v prodi —
# dialog se odpre) + klik → toast 'Osnutek prenesen v PDF' + %PDF capture
# (čista baza — brez raise, ISTA bralna pot kot lokalni E2E) + needleji R237
# v odposlanih čankih + negativni amber/70 + regresije R223–R236
# (Dobavitelji PDF fail-closed pri 0, Naročilnica pill odsoten pri 0 naročil,
# CSV vodje, geselni žetoni, Domov 8, temna, err null).
# Samo bralni pogledi — ZERO-MUTACIJA (brez raise v prodi — r235–r237 pravilo).
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena odsotna (čista baza fingerprint) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2: Material → Zaloga → Osnutek dialog — R237 JEDRO ŽIVO: PDF gumb + byte-exact ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]');})()" 12
sleep 1
agent-browser eval "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); const c=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot CSV\"]'); if(!p||!c) return JSON.stringify({pdfGumb:false, csvGumb:!!c}); return JSON.stringify({pdfGumb:true, csvGumb:true, title:p.getAttribute('title'), disabledP:p.disabled, disabledC:c.disabled, err:window.__err??null});})()" 2>&1 | tail -1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 12
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 12
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magic:[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r238-prod-osnutek-pdf.png" > /dev/null 2>&1

echo "=== Z2b: CSV sorojec regresija (R205) ==="
eb_csv_capture csvO
eb_csv_reset csvO
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__csvO==='string'&&window.__csvO.length>10;})()" 12
agent-browser eval "(()=>{const t=window.__csvO; if(typeof t!=='string') return JSON.stringify({csv:false}); const cist=t.replace(/^\uFEFF/,''); const vrstice=cist.split(/\r?\n/); return JSON.stringify({csv:true, glavaOK:vrstice[0]&&vrstice[0].includes('Naroči'), vrstic:vrstice.filter(l=>l.includes(';')).length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z3: deployed čanki — needleji R237 + NEGATIVNI amber/70 ==="
OUT=/tmp/r238-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
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
need "Prenesi naročilnico vidnih artiklov kot PDF" "R237 dialog PDF gumb aria"
need "Naročilnica osnutka kot pravi PDF — interni pregled pred pošiljanjem" "R237 dialog PDF gumb title"
need "Osnutka PDF ni mogoče sestaviti iz teh artiklov" "R237 fail-closed TypeError toast"
need "Izvoz PDF ni uspel: " "R237 fail-verbose catch (sonner)"
need "NAROČILNICA OSNUTEK" "R237 PDF dokument naslov"
need "Povzetek osnutka" "R237 KPI sekcija"
need "osnutek-narocilnica-" "R237 filename prefix"
need "Interni dokument — priprava naročilnega osnutka" "R237 interni podnaslov"
need 'Šifra","Naziv","Enota","Zaloga","Min. zaloga","Naroči"]' "R237 tabela glava = CSV R205 (kompilirana oblika)"
need "focus-visible:ring-2 focus-visible:ring-roksal-navy/40" "R237 navy/40 fokus (konverzirane vrstice)"
must_miss "focus-visible:ring-roksal-amber/70" "deal-pipeline slider amber fokus (unikatna oblika — izginil)"
echo "NEEDLE FAIL=$FAIL"

echo "=== Z4: regresije R236/R235 — Dobavitelji PDF fail-closed pri 0 + Naročilnica pill odsoten pri 0 naročil ==="
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

echo "=== Z5: CSV vodje regresija + geselni žetoni + temna + err null + health ==="
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
echo "=== R238 core KONEC ==="
