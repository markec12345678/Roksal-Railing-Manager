#!/bin/bash
# R266 E2E ŽIVO (lokalni :3100, ADMIN) — OPREMA — ŽIVLJENJSKI CIKL PDF (22.
# člen 'izvozi' družine: FRESH paginirani /api/equipment — polna resnica,
# tiha rezina prepovedana; route NIČ) + regresije R265 (projekti-termini),
# R264 (pozicija dobaviteljev), R254 (aria), R262 (mini-vrstica).
# SEED/RESTORE runda: OBE veji dokazani — PREJ naravno stanje (0 opreme) →
# fail-closed toast 'Ni vpisane opreme' (veja 1, NI dokumenta); potem raw SQL
# seed (SAMO INSERT — 4 kosi: e1 merski z ZAPADELIM pregledom + POTEČENO
# kalibracijo (RED akcija), e2 merski brez roka + nezabeležen pregled (AMBER
# iskreno neznano), e3 V_SERVISU s prihodnjim pregledom, e4 UPOKOJENO
# (referenčni pregled vključuje mrtve)) → mini-vrstica '4 kosi · zapadel 1 ·
# potečena 1 · brez lokacije 2' + žetona → POST toast 'Oprema-cikel-…pdf —
# 4 kosi, zapadel pregled 1, potečena kalibracija 1.' + PDF NOV razred,
# RESTORE → fp pre==post BAJTNATO (ZERO-MUTACIJA; Equipment POLNA resnica).
# ⚠️ lekcije: agent-browser eval DVOLIČNO kodiran JSON (pomožnica L() /
# python dvojni json.loads); toast agregat non-greedy (.+?)\.; bajtna
# primerjava PRE/POST v cmp; quoted camelCase stolpci v raw SQL (R257).
# Oprema SUBTAB: dispatch namig ne obstaja za logistiko — subtab gumb
# 'Oprema' kliknemo po tekstu (navaden Button — JS .click() deluje).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r266-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100
export EB_BASE="http://127.0.0.1:3100"
export EB_EMAIL="ci@roksal.si"
export EB_GESLO="DimniSmoke139!"

source scripts/e2e-lib.sh

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R266-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

# pomožnica: klik subtaba po tekstu (navaden Button — Radix NI v igri)
klik_subtab() {
  agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='$1'); if(!b) return 'ni subtaba'; b.click(); return 'klik';})()" 2>&1 | tail -1
}

echo "--- PRSTNI ODTIS PRE (Equipment POLNA resnica + regresija širine) ---"
node scripts/r266-db-e2e.cjs fp > /tmp/r266-fp-pre.json
cat /tmp/r266-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])" || exit 1

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: LOGISTIKA → OPREMA subtab — R266 pill ŽIVO (VEDNO viden + press-scale + Activity aria-hidden) + mini-vrstica SKRITA pri 0 opreme ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled projektov in terminov kot PDF\"]');})()" 24
sleep 2
klik_subtab "Oprema"
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot PDF\"]');})()" 14
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const ck=id('Izvozi pregled življenjskega cikla opreme kot PDF'); const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({ckPill:!!ck, ckPS:ck?ck.className.includes('press-scale'):false, ckAriaHidden:ck?!!ck.querySelector('svg[aria-hidden=\"true\"]'):false, ckDisabled:ck?ck.disabled:null, ckTitle:ck?ck.getAttribute('title'):null, ckText:ck?ck.textContent.trim():null, miniSkrita0Opreme:!t.includes('Cikl (viden seznam)'), legendaR266:t.includes('PDF = življenjski cikl VSE opreme (pregledi · kalibracije · statusi — polna resnica, ne samo viden seznam)'), ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r266-z1.json
python3 -c "import json; r=json.load(open('/tmp/r266-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['ckPill'] and d['ckPS'] and d['ckAriaHidden'] and d['ckDisabled']==False and d['miniSkrita0Opreme'] and d['legendaR266'] and d['ariaR254']['vsePokrite'], 'Z1 resnice FAIL: '+json.dumps(d); print('Z1 preverba OK — pill ŽIVO, mini skrita pri 0 opreme (iskrena praznina), legenda pariteta')" || exit 1
agent-browser screenshot "$SS/qa-r266-e2e-pill.png" > /dev/null 2>&1

echo "=== Z1b: fail-closed veja (naravno stanje: 0 opreme → 'Ni vpisane opreme', NI dokumenta) ==="
eb_zajem_pdf poz266pre
eb_csv_reset poz266pre
eb_klik_gumb "Izvozi pregled življenjskega cikla opreme kot PDF"
eb_pocakaj_tekst "Ni vpisane opreme" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({toastTitle:t.includes('Ni vpisane opreme'), toastOpis:t.includes('Pregled življenjskega cikla se izvozi, ko je vpisan prvi kos opreme.'), niDokumenta:!(typeof window.__poz266pre==='string'&&window.__poz266pre.length>0), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r266-z1b.json
python3 -c "import json; r=json.load(open('/tmp/r266-z1b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['toastTitle'] and d['toastOpis'] and d['niDokumenta'], 'Z1b fail-closed FAIL: '+json.dumps(d); print('Z1b fail-closed veja OK (ni dokumenta — ni prazne datoteke)')" || exit 1
agent-browser screenshot "$SS/qa-r266-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: SEED (4 kosi — vse ciklov veje) + POLN reload — uspešna veja + mini-vrstica + žetona ==="
node scripts/r266-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 2
# Lekcija R265: pill je VEDNO viden — viden je PRED podatki; klik OB praznem
# state-u sproži fail-closed toast (iskren, ampak napačna veja). POLN RELOAD
# po seedu = deterministični sveži fetchi; session cookie preživi.
agent-browser open "$EB_BASE" > /dev/null 2>&1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Odjava\"]');})()" 24
eb_zapri_vodic
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled projektov in terminov kot PDF\"]');})()" 24
klik_subtab "Oprema"
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot PDF\"]');})()" 14
# Čakamo na SEED PODATEK (dokaz: equipment state naložen — mini-vrstica je
# state-oka). ⚠️ LEKCIJA R266: pečat 'Osveženo ob' (R170) je KOLEDAR-subtab
# resnica — OPREMA subtab ga NE izriše; čakanje nanj tu = 36 s mrtvega časa.
eb_pocakaj_na "(()=>{return document.body.textContent.includes('E2E Cikel Blok A — Merilec');})()" 24
sleep 1
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Cikl (viden seznam)')===0); const t=document.body.textContent; return JSON.stringify({miniTekst:mini?mini.textContent.trim():null, zetonZapadel:t.includes('1 zapadel pregled'), zetonPotecena:t.includes('1 potečena kalibracija'), dotRed:!!document.querySelector('span[aria-hidden].bg-roksal-red'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r266-z2-mini.json
python3 -c "
import json
r=json.load(open('/tmp/r266-z2-mini.json')); d=json.loads(r) if isinstance(r,str) else r
assert d['miniTekst']=='Cikl (viden seznam): 4 kosi · zapadel pregled 1 · potečena kalibracija 1 · brez lokacije 2', 'Z2 mini FAIL: '+json.dumps(d)
assert d['zetonZapadel'] and d['zetonPotecena'] and d['dotRed'], 'Z2 žetona/dot FAIL: '+json.dumps(d)
print('Z2 mini-vrstica OK — 4 kosi · zapadel 1 · potečena 1 · brez lokacije 2 + kondicionalna žetona + RED dot ŽIVO')
" || exit 1
eb_zajem_pdf poz266
eb_csv_reset poz266
eb_klik_gumb "Izvozi pregled življenjskega cikla opreme kot PDF"
eb_pocakaj_tekst "Pregled opreme prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Oprema-cikel-…pdf — (.+?)\./.exec(t); return JSON.stringify({toastTitle:t.includes('Pregled opreme prenešen v PDF'), toastAgregat:agg?agg[1]:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r266-z2.json
cat /tmp/r266-z2.json
python3 -c "
import json
r=json.load(open('/tmp/r266-z2.json')); d=json.loads(r) if isinstance(r,str) else r
assert d['toastTitle'] and d['toastAgregat']=='4 kosi, zapadel pregled 1, potečena kalibracija 1', 'Z2 toast FAIL: '+json.dumps(d)
print('Z2 toast OK —', d['toastAgregat'], '(sklanjatev ŽIVO: 4 kosi)')
" || exit 1
eb_pocakaj_na "(()=>{return typeof window.__poz266==='string'&&window.__poz266.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__poz266; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228,39094,41009,37560]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r266-z2-pdf.json
python3 -c "import json; r=json.load(open('/tmp/r266-z2-pdf.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-' and d['novGlifniRazred'], 'Z2 PDF FAIL: '+json.dumps(d); print('Z2 PDF OK —', d['bajtov'], 'bajtov, NOV razred (30 znanih)')" || exit 1
agent-browser screenshot "$SS/qa-r266-e2e-po-seedu.png" > /dev/null 2>&1

echo "=== Z3: R265 regresija — Koledar subtab: projekti-termini pill ŠE ŽIVO + legenda dobesedno ==="
klik_subtab "Koledar"
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled projektov in terminov kot PDF\"]');})()" 14
sleep 2
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r265Pill:!!document.querySelector('button[aria-label=\"Izvozi pregled projektov in terminov kot PDF\"]'), legenda265:t.includes('· Projekti = projekti × termini (pokritost po projektih)'), legenda255Staro:t.includes('CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki)'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3b: R264 regresija — material suppliers pozicija pill ŠE ŽIVO ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pozicijo dobaviteljev kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({r264Pill:!!document.querySelector('button[aria-label=\"Izvozi pozicijo dobaviteljev kot PDF\"]'), legenda264:t.includes('Pozicija = dobavitelji × najnižja per artikel'), ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== Z5: RESTORE + prstni odtis post BAJTNATO == pre ==="
agent-browser close --all > /dev/null 2>&1
node scripts/r266-db-e2e.cjs restore
node scripts/r266-db-e2e.cjs fp > /tmp/r266-fp-post.json
cat /tmp/r266-fp-post.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('POST:', d['stevci'])" || exit 1
if cmp -s /tmp/r266-fp-pre.json /tmp/r266-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — seed/restore bajtnato)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r266-fp-pre.json) <(python3 -m json.tool /tmp/r266-fp-post.json) | head -20; fi

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R266 E2E KONEC ---"
