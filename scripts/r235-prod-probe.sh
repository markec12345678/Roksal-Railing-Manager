#!/bin/bash
# R235 prod probe — recheck R234 ŽIVO (Zaloga PDF izvoz + nevtralne veje
# žetoni; brez mutacij — 8 artiklov, 0 naročil, 0 dobaviteljev v prodi):
#  Z1 Domov: Brez 8 + Zamujena ODSOTNA (fail-closed);
#  Z2 Material → Zaloga (tab inventory): R234 JEDRO — PDF gumb ŽIVO + klik →
#     toast 'Izvoženih 8 artiklov v PDF.' + capture %PDF magija;
#  Z2b fail-closed: čip 'na minimumu' (na=0 v prodi) → PRAZNO stanje →
#     toast 'Ni artiklov za izvoz.' + __pdf null;
#  Z2c zaloga CSV regresija (R136/R226): glava + 'Brez dobavitelja' stolpec;
#  Z3 CSV vodje regresija (R228): '"Opozorila","Zamujena dobava","0"' + brez8;
#  Z4 geselni žetoni + temna + err null + health;
#  Z5 deployed čanki: needleji R234 + NEGATIVNI (gray unikati ostajajo
#     odsotni) + regresije R229-R233.
# ZERO-MUTACIJA: samo bralni pogledi — nič ne piše v DB.
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

source /home/z/my-project/scripts/e2e-lib.sh

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena ODSOTNA ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); if(!k) return JSON.stringify({brez:false}); const m=k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r235-prod-domov.png" > /dev/null 2>&1

echo "=== Z2: Material → Zaloga — R234 PDF gumb ŽIVO + capture %PDF + toast ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot PDF\"]');})()" 24
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot PDF\"]'); if(!g) return JSON.stringify({gumb:false}); return JSON.stringify({gumb:true, title:g.getAttribute('title'), err:window.__err??null});})()" 2>&1 | tail -1
eb_csv_capture pdf
eb_csv_reset pdf
eb_klik_gumb "Izvozi vidno zalogo kot PDF"
eb_pocakaj_tekst "Izvoženih 8 artiklov v PDF." 12
agent-browser eval "(()=>{const t=window.__pdf; if(typeof t!=='string') return JSON.stringify({pdf:false, err:window.__err??null}); return JSON.stringify({pdf:true, magic:[t.charCodeAt(0),t.charCodeAt(1),t.charCodeAt(2),t.charCodeAt(3),t.charCodeAt(4)].join(','), dolzina:t.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r235-prod-zaloga-pdf.png" > /dev/null 2>&1

echo "=== Z2b: fail-closed — čip 'na minimumu' (na=0) → toast 'Ni artiklov za izvoz.' ==="
eb_klik_gumb "Pokaži samo artikle na minimalni zalogi"
eb_pocakaj_tekst "Ni artiklov za izvoz" 12
eb_csv_reset pdf
eb_klik_gumb "Izvozi vidno zalogo kot PDF"
eb_cakaj 2
agent-browser eval "(()=>{const prazno=document.body.textContent.includes('Ni artiklov za izvoz'); const cip=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].some(x=>(x.getAttribute('aria-label')||'').includes('na minimalni zalogi')); return JSON.stringify({praznoStanje:prazno, cipAktiven:cip, pdfNastal:typeof window.__pdf==='string', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r235-prod-zaloga-prazno.png" > /dev/null 2>&1
eb_klik_gumb "Pokaži samo artikle na minimalni zalogi — aktiven (0); klik za izklop"

echo "=== Z2c: zaloga CSV regresija (R136/R226) — glava z 'Brez dobavitelja' ==="
eb_csv_capture zal
eb_csv_reset zal
eb_klik_gumb "Izvozi vidno zalogo kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__zal==='string'&&window.__zal.length>10;})()" 12
agent-browser eval "(()=>{const t=window.__zal; if(typeof t!=='string') return JSON.stringify({csv:false}); const cist=t.replace(/^\uFEFF/,''); return JSON.stringify({csv:true, glava:cist.includes('Šifra;Naziv;Tip;Enota;Zaloga;Min. zaloga;Nizka;Brez dobavitelja'), vrstic:cist.split('\n').length-1, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: CSV vodje regresija (R228) ==="
eb_dispatch '{"tab":"more","more":"vodja"}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dnevni pregled vodje kot CSV\"]');})()" 12
eb_csv_capture csvV
eb_csv_reset csvV
eb_klik_gumb "Izvozi dnevni pregled vodje kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__csvV==='string'&&window.__csvV.length>10;})()" 12
agent-browser eval "(()=>{const t=window.__csvV; if(typeof t!=='string') return JSON.stringify({csv:false,err:window.__err??null}); const cist=t.replace(/^\uFEFF/,''); return JSON.stringify({csv:true, zamujena0:cist.includes('\"Opozorila\",\"Zamujena dobava\",\"0\"'), brez8:cist.includes('\"Opozorila\",\"Brez dobavitelja\",\"8\"'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r235-prod-vodja.png" > /dev/null 2>&1

echo "=== Z4: geselni žetoni + temna + err null + health ==="
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
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== Z5: deployed čanki — needleji R234 + NEGATIVNI + regresije ==="
OUT=/tmp/r235-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
# Obišči tabe, da se naložijo čanki z R234 needleji (zaloga PDF + stil veje).
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
sleep 3
eb_dispatch '{"tab":"ar","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 4
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | python3 -c "import sys,json
raw=sys.stdin.read().strip()
try:
  arr=json.loads(raw)
  if isinstance(arr,str): arr=json.loads(arr)
  print('\n'.join(arr))
except Exception:
  print('')" > "$OUT"/chunk-urls.txt
echo "  chunk URLs: $(wc -l < "$OUT"/chunk-urls.txt)"
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
echo "  --- R234 pozitivni (Zaloga PDF + stil žetoni) ---"
need "Izvozi vidno zalogo kot PDF" "R234 PDF gumb aria"
need "STANJE ZALOGE" "R234 PDF dokument naslov"
need "Povzetek vidnih artiklov" "R234 PDF KPI sekcija"
need "Izvoz PDF ni uspel:" "R234 fail-verbose catch"
need "NEAKTIVEN:\"bg-muted text-muted-foreground border-border\"" "R234 crm NEAKTIVEN žetoni"
need "UPOKOJENO:\"bg-muted text-muted-foreground border-border\"" "R234 logistics UPOKOJENO žetoni"
need "bg-muted text-muted-foreground border-border line-through" "R234 measurements ARHIVIRANA žeton"
echo "  --- R234 negativni (gray unikati ostajajo odsotni) ---"
must_miss "bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-800" "logistics UPOKOJENO gray (unikatna oblika)"
must_miss "bg-gray-100 dark:bg-gray-500/15 text-gray-800 dark:text-gray-200" "catalog MATERIAL_BADGE fallback gray"
must_miss "bg-gray-600 text-white border-gray-600" "measurements OSNUTEK čip aktiven gray"
must_miss "bg-gray-400 text-white border-gray-400" "measurements ARHIVIRANA čip aktiven gray"
echo "  --- regresije R229-R233 ---"
need "Izvozi dobavitelje kot CSV" "R233 Dobavitelji CSV gumb"
need "Ni dobaviteljev za izvoz" "R233 fail-closed toast"
need '"Opombe","Pretekel rok"]' "R231 CSV glava ZADNJI stolpec"
need "Izvozi naročila kot CSV" "R231/R232 naročila CSV gumb"
need "bg-roksal-navy text-white hover:bg-roksal-navy/90" "R232 cv-studio bbox žeton"
need "bg-muted text-roksal-ink" "R229 Inox chip žeton"
echo "NEEDLE FAIL=$FAIL"

agent-browser close --all > /dev/null 2>&1
echo "=== R235 prod probe KONEC ==="
