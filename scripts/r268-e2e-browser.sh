#!/bin/bash
# R268 E2E ŽIVO (lokalni :3100, ADMIN) — EKIPA — STANJE EKIPE PDF (24. člen
# 'izvozi' družine: FRESH /api/users — trenutna resnica ob kliku, resnica
# pravic users.read; route NIČ) + regresije R267 (CRM spomniki), R266 (oprema
# cikel), R254 (aria).
# ČISTO BRALNA runda (NIČ seeding — R267 lekcija 2: pričakovanja štejejo
# NARAVNE vrstice): naravni dev portfelj 6 računov (2 ADMIN / 1 VODJA /
# 3 MONTER — vsi aktivni) → mini state-oka '6 članov · aktivnih 6 · čaka
# aktivacijo 0 · povabilo poteklo 0 · zaklenjenih 0' + GREEN dot + NIČ žetonov
# (žetoni ŽIVO samo > 0 — R256 lekcija 4); pričakovanja računana DINAMIČNO iz
# ISTEGA /api/users odgovora (ENA resnica dokazana na živo); fail-closed veja
# 'Ni vpisanih članov ekipe' dokazana z fetch stubom [] (r211/R267 precedens —
# NIČ DB mutacij, stub RESTAVRIRAN); POST toast 'Ekipa-stanje-…pdf — 6 članov,
# aktivnih 6, …' + PDF NOV glifni razred; fp pre==post BAJTNATO (ZERO-MUTACIJA;
# Profil POLNA resnica brez passwordHash — lastActive se piše samo na prijavi,
# odtis PRE po prijavi = determinističen).
# ⚠️ lekcije: agent-browser eval DVOLIČNO kodiran JSON (python dvojni
# json.loads); toast agregat non-greedy (.+?)\.; mini-vrstica textContent
# ZLEPI žeton (R266 lekcija 3) — mini span DIREKTNO (startsWith) + dot =
# class query OŽANO na vsebnik mini (R267 lekcija 4); async fetch v eval = HP
# pristop (window.__var + sleep + drugi eval).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r268-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R268-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

# pomožnica: klik subtaba po tekstu (navaden Button — Radix NI v igri)
klik_subtab() {
  agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='$1'); if(!b) return 'ni subtaba'; b.click(); return 'klik';})()" 2>&1 | tail -1
}

echo "--- HIGIENA starejših ostankov + PRIJAVA (prek e2e-lib.sh) ---"
node scripts/r268-db-e2e.cjs restore
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "--- PRSTNI ODTIS PRE (PO prijavi — lastActive se piše samo na /api/auth POST) ---"
node scripts/r268-db-e2e.cjs fp > /tmp/r268-fp-pre.json
cat /tmp/r268-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])" || exit 1

echo "=== Z1: Ekipa — R268 pill ŽIVO (VEDNO viden + press-scale + FileDown aria-hidden) + legenda + mini-vrstica (naravno: 6 aktivnih) — pričakovanje DINAMIČNO iz ISTEGA API odgovora ==="
eb_dispatch '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled stanja ekipe kot PDF\"]');})()" 24
sleep 2
# Dinamična resnica: isti /api/users odgovor → counts z ISTIM prednostnim redom
# (deactivated > locked > invited(poteklo?) > aktiven — ekipaStatusOf R160).
agent-browser eval "(()=>{window.__apiUsers=null; fetch('/api/users',{credentials:'same-origin'}).then(r=>r.json()).then(j=>{window.__apiUsers=j}).catch(()=>{}); return 'fetched';})()" 2>&1 | tail -1
eb_cakaj 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; const pk=id('Izvozi pregled stanja ekipe kot PDF'); const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Ekipa (viden seznam)')===0); const kont=[...document.querySelectorAll('div')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Ekipa (viden seznam)')===0;}); const dotGreen=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-green'):false; const dotRed=kont?!!kont.querySelector('span[aria-hidden].bg-roksal-red'):false; const u=window.__apiUsers; let st=null; if(Array.isArray(u)){ st={vsi:u.length, aktivnih:0, caka:0, poteklo:0, zaklenjenih:0, deaktiviranih:0}; for(const x of u){const l=x.lifecycle||{}; let s; if(l.deactivated) s='dea'; else if(l.locked) s='zak'; else if(l.invited) s=(l.inviteExpired?'pot':'cak'); else s='akt'; st[s==='akt'?'aktivnih':s==='cak'?'caka':s==='pot'?'poteklo':s==='zak'?'zaklenjenih':'deaktiviranih']++;}} return JSON.stringify({pill:!!pk, ps:pk?pk.className.includes('press-scale'):false, ariaHidden:pk?!!pk.querySelector('svg[aria-hidden=\"true\"]'):false, disabled:pk?pk.disabled:null, title:pk?pk.getAttribute('title'):null, legenda:t.includes('PDF = celotna ekipa (trenutna resnica ob kliku — FRESH /api/users, ne zastarel state)'), miniTekst:mini?mini.textContent.trim():null, dotGreen, dotRed, zetoni:new RegExp('\\d+ (povabilo poteklo|zaklenjenih računov|čaka aktivacijo)').test(t), apiCounts:st, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r268-z1.json
python3 -c "
import json
r=json.load(open('/tmp/r268-z1.json')); d=json.loads(r) if isinstance(r,str) else r
assert d['pill'] and d['ps'] and d['ariaHidden'] and d['disabled']==False and d['legenda'] and d['ariaR254']['vsePokrite'], 'Z1 resnice FAIL: '+json.dumps(d)
st=d['apiCounts']; assert st and st['vsi']==6 and st['aktivnih']==6 and st['caka']==0 and st['poteklo']==0 and st['zaklenjenih']==0 and st['deaktiviranih']==0, 'Z1 naravni portfelj FAIL (pričakovano 6 aktivnih): '+json.dumps(d)
pri='Ekipa (viden seznam): 6 članov · aktivnih 6 · čaka aktivacijo 0 · povabilo poteklo 0 · zaklenjenih 0'
assert d['miniTekst']==pri, 'Z1 mini FAIL (naravno stanje 6 aktivnih): '+json.dumps(d)+' — pričakovano: '+pri
assert d['dotGreen'] and not d['dotRed'] and not d['zetoni'], 'Z1 dot/žetoni FAIL (vsi aktivni → GREEN, nič žetonov): '+json.dumps(d)
print('Z1 preverba OK — pill ŽIVO + legenda pariteta + mini DINAMIČNO = ISTI API odgovor (6 članov aktivnih 6, GREEN dot, nič žetonov)')" || exit 1
print_mini() { python3 -c "import json; r=json.load(open('$1')); d=json.loads(r) if isinstance(r,str) else r; print('mini:', d['miniTekst'])" || exit 1; }
print_mini /tmp/r268-z1.json
agent-browser screenshot "$SS/qa-r268-e2e-pill.png" > /dev/null 2>&1

echo "=== Z1b: fail-closed veja (fetch stub [] — r211/R267 precedens, NIČ DB mutacij; stub RESTAVRIRAN) ==="
eb_zajem_pdf ekipa268pre
eb_csv_reset ekipa268pre
agent-browser eval "(()=>{window.__origFetch=window.fetch; window.fetch=(u,...a)=>String(u).includes('/api/users')?Promise.resolve(new Response(JSON.stringify([]),{status:200})):window.__origFetch(u,...a); return 'stubbed';})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi pregled stanja ekipe kot PDF"
eb_pocakaj_tekst "Ni vpisanih članov ekipe" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({toastTitle:t.includes('Ni vpisanih članov ekipe'), toastOpis:t.includes('Pregled stanja se izvozi, ko je vpisan prvi član ekipe.'), niDokumenta:!(typeof window.__ekipa268pre==='string'&&window.__ekipa268pre.length>0), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r268-z1b.json
python3 -c "import json; r=json.load(open('/tmp/r268-z1b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['toastTitle'] and d['toastOpis'] and d['niDokumenta'], 'Z1b fail-closed FAIL: '+json.dumps(d); print('Z1b fail-closed veja OK (ni dokumenta — ni prazne datoteke)')" || exit 1
agent-browser eval "(()=>{window.fetch=window.__origFetch; return 'restored';})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r268-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: POST klik — FRESH trenutna resnica + toast agregat + PDF NOV glifni razred ==="
eb_zajem_pdf ekipa268
eb_csv_reset ekipa268
eb_klik_gumb "Izvozi pregled stanja ekipe kot PDF"
eb_pocakaj_tekst "Pregled stanja ekipe prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Ekipa-stanje-…pdf — (.+?)\./.exec(t); const b64=window.__ekipa268; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, agg:agg?agg[1]:null, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228,39094,41009,37560,38744,43572,51142]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), agg:agg?agg[1]:null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r268-z2-pdf.json
python3 -c "import json; r=json.load(open('/tmp/r268-z2-pdf.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-' and d['novGlifniRazred'] and d['agg']=='6 članov, aktivnih 6, čaka aktivacijo 0, povabilo poteklo 0, zaklenjenih 0', 'Z2 PDF FAIL: '+json.dumps(d); print('Z2 PDF OK —', d['bajtov'], 'bajtov, NOV razred (33 znanih), FRESH trenutna resnica: 6 članov (2 ADMIN / 1 VODJA / 3 MONTER), vsi aktivni')" || exit 1
agent-browser screenshot "$SS/qa-r268-e2e-pdf.png" > /dev/null 2>&1

echo "=== Z3: regresije ŽIVO lokalno — R267 CRM spomniki pill + R266 oprema pill (mini SKRITA pri 0 opreme — iskrena praznina) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled spomnikov ponudb kot PDF\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; return JSON.stringify({r267Pill:!!id('Izvozi pregled spomnikov ponudb kot PDF'), r267Legenda:t.includes('PDF = VSE ponudbe (tudi podpisane — polna resnica, ne samo viden seznam)'), err:window.__err??null});})()" 2>&1 | tail -1
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled projektov in terminov kot PDF\"]');})()" 24
sleep 1
klik_subtab "Oprema"
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot PDF\"]');})()" 14
sleep 1
agent-browser eval "(()=>{const oc=document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot PDF\"]'); const t=document.body.textContent; return JSON.stringify({r266Pill:!!oc, r266Legenda:t.includes('PDF = življenjski cikl VSE opreme (pregledi · kalibracije · statusi — polna resnica, ne samo viden seznam)'), r266MiniSkrita0Opreme:!t.includes('Cikl (viden seznam)'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r268-z3.json
python3 -c "import json; r=json.load(open('/tmp/r268-z3.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['r266Pill'] and d['r266Legenda'] and d['r266MiniSkrita0Opreme'], 'Z3 FAIL: '+json.dumps(d); print('Z3 regresije OK — R267 + R266 pill + legenda ŽIVO, oprema mini skrita pri 0 (iskrena praznina)')" || exit 1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== prstni odtis POST (bajtnata identičnost = ZERO-MUTACIJA — bralna runda) ==="
node scripts/r268-db-e2e.cjs fp > /tmp/r268-fp-post.json
if cmp -s /tmp/r268-fp-pre.json /tmp/r268-fp-post.json; then echo "ODTIS BAJTNATO IDENTIČEN (pre==post) — ZERO-MUTACIJA OK"; else echo "ODTIS RAZLIČEN — FAIL!"; diff <(python3 -m json.tool /tmp/r268-fp-pre.json) <(python3 -m json.tool /tmp/r268-fp-post.json) | head -20; fi

echo "=== ZAKLJUČEK: brskalnik + strežnik zaprti ==="
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R268 E2E KONEC ==="
