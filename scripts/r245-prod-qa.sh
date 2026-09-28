#!/bin/bash
# R245 prod QA — recheck R244 deploy (žig MORA biti > R244 commit 09:32:51Z).
# JEDRO (worklog R245 točke a-f): spot (MONTER) R244 ŽIVO:
# (a) Material → Cene card: cenik pilli VIDNA (bralni tok, VEDNO vidna) +
#     klik CSV → fail-closed toast 'Ni vpisanih cen za izvoz' (prod = 0 cen);
# (b) Logistika: 'Nov termin montaže' + 'Nova oprema' ODSOTNA + vodiči VIDNI
#     (production.manage);
# (c) ADMIN ciljni reprobe = LOKALNA pot (lokalni E2E, ne tukaj);
# (d) 'Nov projekt' hero press-scale = LOKALNA pot (ADMIN; MONTER ga nima —
#     R239 ogledalo, prod spot je MONTER);
# (e) needleji R244 v odposlanih čankih;
# (f) regresije R243/R242/R241/R240/R238/R237.
# Samo bralni pogledi + dialogi odpri/Escape — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z0: prod health žig (MORA biti > R244 commit 09:32:51Z) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

echo "=== Z1: Domov — fingerprint (brez 8, pod 1) + R239 ogledalo (Nov projekt ODSOTEN za MONTER) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); const m=k?k.getAttribute('aria-label').match(/Brez dobavitelja \\((\\d+)\\)/):null; const pod=document.body.textContent.match(/(\\d+)\\s*pod\\b/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); return JSON.stringify({brezSt:m?m[1]:null, podSt:pod?pod[1]:null, zamujenaOdsotna:!zam, novProjektOdsoten:!np, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r245-prod-domov.png" > /dev/null 2>&1

echo "=== Z2: R244 JEDRO (a) — Material/Cene za MONTER: cenik pilli VIDNA + klik → fail-closed toast (0 cen) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi cenik materiala kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const csv=document.querySelector('button[aria-label=\"Izvozi cenik materiala kot CSV\"]'); const pdf=document.querySelector('button[aria-label=\"Izvozi cenik materiala kot PDF\"]'); return JSON.stringify({csvViden:!!csv, pdfViden:!!pdf, csvDisabled:csv?csv.disabled:null, pdfDisabled:pdf?pdf.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1
# klik CSV → fail-closed toast (prod ima 0 cen)
eb_csv_reset csv
eb_klik_gumb "Izvozi cenik materiala kot CSV"
eb_pocakaj_tekst "Ni vpisanih cen za izvoz" 12
# klik PDF → isti fail-closed toast
eb_klik_gumb "Izvozi cenik materiala kot PDF"
eb_pocakaj_tekst "Ni vpisanih cen za izvoz" 12
eb_cakaj 1
agent-browser eval "(()=>{const fail=document.body.textContent.includes('Ni vpisanih cen za izvoz'); return JSON.stringify({failClosedToastPri0Cen:fail, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r245-prod-cenik-monter.png" > /dev/null 2>&1

echo "=== Z3: R244 JEDRO (b) — Logistika za MONTER: 'Nov termin montaže' + 'Nova oprema' ODSOTNA + vodiči VIDNI ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Termini montaž') || document.body.textContent.includes('Logistika');})()" 24
sleep 3
agent-browser eval "(()=>{const termin=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().includes('Nov termin montaže')); const oprema=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().includes('Nova oprema')); const b=document.body.textContent; const vodicT=b.includes('Pregled terminov je samo za branje'); const vodicO=b.includes('Pregled opreme je samo za branje'); const pravica=b.includes('production.manage'); const noteT=[...document.querySelectorAll('[role=\"note\"]')].some(n=>(n.getAttribute('aria-label')||'').includes('Ustvarjanje terminov zahteva pravico')); const noteO=[...document.querySelectorAll('[role=\"note\"]')].some(n=>(n.getAttribute('aria-label')||'').includes('Upravljanje opreme zahteva pravico')); return JSON.stringify({novTerminOdsoten:!termin, novaOpremaOdsotna:!oprema, vodicTerminiViden:vodicT, vodicOpremaViden:vodicO, pravicaVidna:pravica, noteTerminiAria:noteT, noteOpremaAria:noteO, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r245-prod-logistika-monter.png" > /dev/null 2>&1

echo "=== Z4: R243 regresija — Zaloga za MONTER: 'Dodaj gibanje zaloge' ODSOTEN + vodič VIDEN ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const gumb=[...document.querySelectorAll('button')].some(x=>(x.getAttribute('aria-label')||'')==='Dodaj gibanje zaloge'); const b=document.body.textContent; const vodic=b.includes('Pregled zaloge je samo za branje'); return JSON.stringify({dodajGibanjeOdsoten:!gumb, vodicViden:vodic, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5: R242 regresija — Naročila ogledalo za MONTER (vodič + 4 pisalne ODSOTNE + CSV) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const csv=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); const b=document.body.textContent; const vodic=b.includes('Pregled naročil je samo za branje'); const poslji=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().startsWith('Označi kot poslano')); const potrdi=[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Potrdi'); const dobljeno=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().startsWith('Dobljeno')); return JSON.stringify({csvViden:!!csv, vodicViden:vodic, pisneOdsotne:{poslji:!poslji, potrdi:!potrdi, dobljeno:!dobljeno}, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z6: R240 regresija — 'Moja vloga in dovoljenja' (fingerprint: MONTER 11 od 28) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Moja vloga in dovoljenja'));})()" 10
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Moja vloga in dovoljenja')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const d=document.body.textContent; return d.includes('Moja vloga in dovoljenja') && d.includes('od 28 dovoljenj');})()" 14
sleep 1
agent-browser eval "(()=>{const dialog=document.querySelector('[role=\"dialog\"]'); if(!dialog) return JSON.stringify({dialog:false, err:window.__err??null}); const vsebina=dialog.textContent; const povzetek=vsebina.match(/Imate (\\d+) od (\\d+) dovoljenj/); let vloga='NEZNANA'; for (const [chip,ime] of [['Admin','ADMIN'],['Vodja','VODJA'],['Monter','MONTER'],['Skladišče','SKLADISCE']]) { if (vsebina.includes(chip)) { vloga=ime; break; } } return JSON.stringify({dialog:true, vloga, povzetek:povzetek?[povzetek[1],povzetek[2]]:null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z7: R238 regresija — prodajna plošča CSV fail-closed (CRM TAB! — r243 lekcija) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('(FURS)');})()" 24
sleep 2
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_pocakaj_tekst "Ni projektov na plošči za izvoz" 12
agent-browser eval "(()=>{const fail=document.body.textContent.includes('Ni projektov na plošči za izvoz'); return JSON.stringify({failClosedToastPri0:fail, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z8: needleji R244 (23) + R243/R242 regresije v odposlanih čankih ==="
OUT=/tmp/r245-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
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
echo "--- R244 (cenik + wave 6 + stil) ---"
need "Izvozi cenik materiala kot CSV" "R244 cenik CSV pill aria"
need "Izvozi cenik materiala kot PDF" "R244 cenik PDF pill aria"
need "Cenik-materiala-" "R244 cenik filename prefix"
need "Ni vpisanih cen za izvoz" "R244 cenik fail-closed toast"
need "Odgovora /api/material-prices ni mogoče prebrati" "R244 cenik fail-verbose oblika"
need "CENIK MATERIALA" "R244 cenik PDF glava"
need "samo trenutno veljavne cene" "R244 cenik PDF iskren podpis"
need "Ustvarjanje terminov zahteva pravico" "R244 vodič terminov aria"
need "Pregled terminov je samo za branje. Ustvarjanje terminov in" "R244 vodič terminov besedilo"
need "Upravljanje opreme zahteva pravico" "R244 vodič opreme aria"
need "Pregled opreme je samo za branje. Dodajanje opreme in statusni" "R244 vodič opreme besedilo"
need "Beleženje dogodkov zahteva pravico" "R244 vodič dogodkov aria"
need "production.manage" "R244 ime pravice v klientu"
need "flex-1 bg-roksal-navy text-white shadow-sm press-scale" "R244 Nov termin CTA"
need "w-full bg-roksal-navy text-white shadow-sm press-scale" "R244 Nova oprema CTA"
need "bg-roksal-navy hover:bg-roksal-navy/90 text-white press-scale" "R244 ekipa dialog CTA"
need "flex-1 h-9 bg-roksal-navy hover:bg-roksal-navy/90 text-white press-scale" "R244 Shrani meritev CTA"
need "shadow-sm press-scale btn-shine" "R244 Nov projekt hero CTA"
need "accent-roksal-navy" "R244 accent žeton"
echo "--- R243/R242/R240/R238 regresije ---"
need "Premiki zaloge so za branje — beleženje zahteva pravico" "R243 vodič premikov aria"
need "Pregled zaloge je samo za branje" "R243 vodič premikov besedilo"
need "inventory.write" "R243 pravica 1"
need "Shranjevanje osnutka naročila zahteva pravico" "R243 vodič Osnutka aria"
need "procurement.create" "R243 pravica 2"
need "Dobavitelji so za branje — urejanje zahteva pravico" "R243 vodič dobaviteljev aria"
need "catalog.manage" "R243 pravica 3"
need "Vpisi cen zahtevajo pravico" "R243 vodič cen aria"
need "price.override" "R243 pravica 4"
need "Pregled naročil je samo za branje" "R242 vodič"
need "Moja vloga in dovoljenja" "R240 meni + dialog"
need "Izvozi prodajno ploščo kot CSV" "R238 CSV aria"
need "Ni projektov na plošči za izvoz" "R238 fail-closed toast"
need "text-2xs" "P1-e žeton 2xs"
echo "NEEDLE FAIL=$FAIL"

echo "=== Z9: R237 regresija — Osnutek PDF (glifni razred) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
sleep 4
OSN_OK=0
for poskus in 1 2 3; do
  eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
  if eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 10; then
    OSN_OK=1; echo "  dialog odprt (poskus $poskus)"; break
  fi
  echo "  poskus $poskus: dialog NI odprt — ponovim"
  sleep 5
done
[ "$OSN_OK" = "1" ] || { echo "Z9 FAIL: Osnutek dialog se ni odprl po 3 poskusih"; }
sleep 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const bajtov=bin.length; const magic=[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','); const razredi=[30057,30119,30191,30253]; const razredOk=razredi.includes(bajtov); return JSON.stringify({pdf:true, magic, bajtov, razredOk, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z10: temna + err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r245-prod-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R245 PROD QA KONEC ==="
