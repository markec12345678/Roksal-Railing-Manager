#!/bin/bash
# R236 prod probe — recheck R235 ŽIVO (Naročilnica PDF 2. člen + measurements
# UI površine žetoni; brez mutacij — 0 naročil, 0 dobaviteljev v prodi):
#  Z1 Domov: Brez 8 + Zamujena ODSOTNA (fail-closed);
#  Z2 Material → Naročila (subTab orders): R235 JEDRO — PDF pill iskreno
#     ODSOTEN pri 0 naročil (gumbi so per kartica — fail-closed prazno stanje
#     ŽIVO; NAMERNO brez raise v prodi — r235 worklog priporočilo) +
#     CSV gumb regresija (R232): viden + fail-closed klik → toast + __csv null;
#  Z3 Material → Zaloga (tab inventory): R234 regresija — PDF gumb + klik →
#     toast + capture %PDF magija (eb_zajem_pdf byte-exact);
#  Z4 CSV vodje regresija (R228) + geselni žetoni + temna + err null + health;
#  Z5 deployed čanki: needleji R235 + NEGATIVNI (gray unikati ostajajo
#     odsotni) + regresije R229-R234.
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
agent-browser screenshot "$SS/qa-r236-prod-domov.png" > /dev/null 2>&1

echo "=== Z2: Material → Naročila — R235 PDF pill ODSOTEN pri 0 naročil + CSV fail-closed regresija ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
sleep 4
agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button[aria-label^=\"Prenesi naročilnico naročila pri\"]')]; const csv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Izvozi naročila kot CSV')); const prazno=!document.body.textContent.includes('POS LANO')&&document.body.textContent.includes('Ni naročil za izvoz')===false; return JSON.stringify({narocilnicPdfPillSt:pill.length, priNulOdsoten:pill.length===0, csvGumbViden:!!csv, err:window.__err??null});})()" 2>&1 | tail -1
eb_csv_capture csv
eb_csv_reset csv
eb_klik_gumb "Izvozi naročila kot CSV"
eb_cakaj 2
agent-browser eval "(()=>{const toast=document.body.textContent.includes('Ni naročil za izvoz'); return JSON.stringify({failClosedToast:toast, csvNastal:typeof window.__csv==='string', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r236-prod-narocila.png" > /dev/null 2>&1

echo "=== Z3: Material → Zaloga — R234 PDF regresija (byte-exact) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot PDF\"]');})()" 24
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Izvozi vidno zalogo kot PDF"
eb_pocakaj_tekst "Izvoženih 8 artiklov v PDF." 12
agent-browser eval "(()=>{const t=window.__pdf; if(typeof t!=='string') return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(t); return JSON.stringify({pdf:true, magic:[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','), dolzina:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r236-prod-zaloga-pdf.png" > /dev/null 2>&1

echo "=== Z4: CSV vodje regresija + geselni žetoni + temna + err null + health ==="
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
sleep 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== Z5: deployed čanki — needleji R235 + NEGATIVNI + regresije ==="
OUT=/tmp/r236-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
# Obišči tabe, da se naložijo čanki z R235 needleji (naročilnica PDF + measurements žetoni).
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
sleep 3
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
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
echo "  --- R235 pozitivni (Naročilnica PDF + measurements žetoni) ---"
need "Naročilnica kot pravi PDF za dobavitelja — determinističen dokument iz postavk" "R235 PDF pill title"
need "Naročilnice PDF ni mogoče sestaviti iz tega naročila" "R235 fail-closed toast title (delegirani TypeError)"
need "Prenos PDF ni uspel: " "R235 fail-verbose catch"
need "prava priloga za dobavitelja" "R235 uspeh toast opis"
need "Povzetek naročila" "R235 KPI sekcija"
need "narocilnica-" "R235 filename prefix"
need "dobaviteljSlug" "R235 slug funkcija"
need "bg-muted border border-border p-2 text-center" "R235 status števec škatle žetoni"
need "border-border bg-muted text-muted-foreground cursor-not-allowed" "R235 glasovni gumb disabled žetoni"
echo "  --- R235 negativni (gray unikati ostajajo odsotni) ---"
must_miss "text-gray-500 dark:text-gray-400 uppercase tracking-wide" "Osnutki label gray (unikatna oblika)"
must_miss "font-bold text-gray-600 dark:text-gray-400" "Osnutki vrednost gray (unikatna oblika)"
must_miss "font-bold text-gray-400 line-through" "Arhivirane vrednost gray (unikatna oblika)"
must_miss "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 text-gray-400 cursor-not-allowed" "glasovni disabled gray (unikatna oblika)"
echo "  --- regresije R229-R234 ---"
need "Izvozi vidno zalogo kot PDF" "R234 Zaloga PDF gumb aria"
need "STANJE ZALOGE" "R234 PDF dokument naslov"
need "Izvoz PDF ni uspel:" "R234 fail-verbose catch"
need "NEAKTIVEN:\"bg-muted text-muted-foreground border-border\"" "R234 crm NEAKTIVEN žetoni"
need "UPOKOJENO:\"bg-muted text-muted-foreground border-border\"" "R234 logistics UPOKOJENO žetoni"
need "Izvozi dobavitelje kot CSV" "R233 Dobavitelji CSV gumb"
need "Ni dobaviteljev za izvoz" "R233 fail-closed toast"
need '"Opombe","Pretekel rok"]' "R231 CSV glava ZADNJI stolpec"
need "Ni naročil za izvoz" "R232 fail-closed toast (0 naročil)"
need "bg-roksal-navy text-white hover:bg-roksal-navy/90" "R232 cv-studio bbox žeton"
need "bg-muted text-roksal-ink" "R229 Inox chip žeton"
echo "NEEDLE FAIL=$FAIL"

agent-browser close --all > /dev/null 2>&1
echo "=== R236 prod probe KONEC ==="
