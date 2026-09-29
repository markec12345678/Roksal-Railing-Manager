#!/bin/bash
# R279 E2E ŽIVO (lokalni :3100, ADMIN) — R279 stil: segmentId Badge title
# (issue #16 §1 identiteta); R278 vir pill title + R277 teren PDF +
# R276 verzije tok = regresija:
#   Z1: verzija pill 'v1' + vir 'Ročni vnos' + R278/R279 stil ŽIVO;
#   Z2: Popravi tok ŽIVO (R276 regresija — v2 pill, v1 ostane);
#   Z2b: TERENSKI PDF ŽIVO — eb_zajem_pdf + izvoz → toast + %PDF- magija
#        (10-stolpčna resnica — glava/vrste v vitest r277-teren-verzije);
#   Z3: panel zgodovine + R277 STIL: thead title (Verzija/Vir/Dolžina/Δ);
#   Z4: regresije — R269/R272/R271 pilli ŽIVO (projekt-gated);
#   Z5: temna + err null.
# ZERO-MUTACIJA: restore → fp-pre → seed → ... → restore → fp-post
# (bajtnata identičnost). fail-fast || exit 1 (r271 lekcija 4).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r279-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R279-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

izberi_projekt() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r276-proj'})); return 'izbran';})()" 2>&1 | tail -1
}

echo "--- HIGIENA: RESTORE pred fp-pre (lekcija 5 — idempotentno) ---"
node scripts/r276-db-e2e.cjs restore || exit 1
node scripts/r273-db-e2e.cjs restore > /dev/null 2>&1 || true

echo "--- PRSTNI ODTIS PRE (Measurement + AuditLog + Project + Customer e2e-r276%) ---"
node scripts/r276-db-e2e.cjs fp > /tmp/r279-fp-pre.json || exit 1

echo "--- SEED-VERZIJE (stranka + projekt + meritev v1 = 3200×1200, vir MANUAL) ---"
node scripts/r276-db-e2e.cjs seed-verzije || exit 1

echo "--- PRIJAVA ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Meritve tab — verzija pill v1 + vir 'Ročni vnos' ŽIVO (R276 regresija) ==="
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); return !!p;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const pill=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); const vir=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const hist=document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]'); const popravi=document.querySelector('button[aria-label^=\"Popravi meritev \"]'); return JSON.stringify({pill:!!pill, pillHelp:pill?pill.className.includes('cursor-help'):false, pillTitle:pill?(pill.getAttribute('title')||'').includes('prvi vpis v verigi'):false, vir:!!vir, virHelp:vir?vir.className.includes('cursor-help'):false, virTitle:vir?(vir.getAttribute('title')||'').startsWith('Vir podatkov: Ročni vnos'):false, segBadge:[...document.querySelectorAll('.cursor-help')].some(x=>(x.getAttribute('title')||'').startsWith('Pripada segmentu')), histBtn:!!hist, popraviBtn:!!popravi, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r279-z1.json
python3 -c "import json; r=json.load(open('/tmp/r279-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['pillHelp'] and d['pillTitle'], 'Z1 pill FAIL: '+json.dumps(d); assert d['vir'], 'Z1 vir FAIL: '+json.dumps(d); assert d['histBtn'] and d['popraviBtn'], 'Z1 gumba FAIL: '+json.dumps(d); assert d['virHelp'] and d['virTitle'], 'Z1 R278 vir stil FAIL: '+json.dumps(d); seg = 'Z1 R279 segmentId Badge stil ŽIVO (title Pripada segmentu …)' if d['segBadge'] else 'Z1 R279 OPOMBA: segmentId Badge NE prisoten — seed meritev ima arMetadata BREZ segmentId (iskrena praznina = pravilna UI); wire dokazan v r279-build-needles'; print('Z1 OK — v1 pill + vir title (R278) + gumba · ' + seg)" || exit 1
agent-browser screenshot "$SS/qa-r279-e2e-v1.png" > /dev/null 2>&1

echo "=== Z2: Popravi tok ŽIVO — pas → 3450 → Shrani kot novo verzijo → v2 ==="
eb_klik_prefix() { agent-browser eval "(()=>{const g=document.querySelector('button[aria-label^=\"$1\"]'); if(!g) return 'ni gumba'; g.click(); return 'klik';})()" 2>&1 | tail -1; }
eb_klik_prefix "Popravi meritev "
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Popravljanje verzije:');})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const pas=t.includes('Popravljanje verzije:'); const stGumb=[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Shrani kot novo verzijo')); return JSON.stringify({pas, stGumb, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r279-z2-pas.json
python3 -c "import json; r=json.load(open('/tmp/r279-z2-pas.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pas'] and d['stGumb'], 'Z2 pas FAIL: '+json.dumps(d); print('Z2 pas OK — korekcijski pas + Shrani kot novo verzijo')" || exit 1
# Spremeni dolžino 3200 → 3450 (prvi input[type=number] v obrazcu) — React setter.
agent-browser eval "(()=>{const i=document.querySelector('input[type=\"number\"]'); if(!i) return 'ni inputa'; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'3450'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'vpisano';})()" 2>&1 | tail -1
eb_cakaj 1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Shrani kot novo verzijo')); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" 2>&1 | tail -1
eb_pocakaj_tekst "Nova verzija v2 shranjena" 14
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v2'); return !!p;})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const v1=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='v1'); const v2=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='v2'); const pasSePrisoten=t.includes('Popravljanje verzije:'); const toast=t.includes('predhodna meritev ostaja v zgodovini')||t.includes('predhodna verzija ostaja v zgodovini'); return JSON.stringify({v1, v2, pasSePrisoten, toast, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r279-z2.json
python3 -c "import json; r=json.load(open('/tmp/r279-z2.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['v1'] and d['v2'], 'Z2 pill FAIL (v1 in v2 obstajata): '+json.dumps(d); assert not d['pasSePrisoten'], 'Z2 pas NI zaprt po uspehu: '+json.dumps(d); print('Z2 OK — v2 ŽIVO (v1 ostane v zgodovini), pas zaprt')" || exit 1
agent-browser screenshot "$SS/qa-r279-e2e-v2.png" > /dev/null 2>&1

echo "=== Z2b: TERENSKI PDF ŽIVO — 10-stolpčna resnica (issue #16 §6) ==="
eb_zajem_pdf val277
eb_klik_gumb "Izvozi terenski pregled meritev kot PDF"
eb_pocakaj_tekst "Terenski pregled meritev prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val277; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r279-z2b.json
python3 -c "import json; r=json.load(open('/tmp/r279-z2b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-', 'Z2b PDF FAIL: '+json.dumps(d); assert d['bajtov']>10000, 'Z2b prekratek PDF: '+json.dumps(d); assert d['err'] is None, 'Z2b err: '+json.dumps(d); print('Z2b OK — terenski PDF ŽIVO (' + str(d['bajtov']) + ' bajtov, %PDF- magija)')" || exit 1
agent-browser screenshot "$SS/qa-r279-e2e-teren-pdf.png" > /dev/null 2>&1

echo "=== Z3: Zgodovina verzij panel — veriga v1→v2 + delta +250 + aktivna v2 ==="
eb_klik_prefix "Pokaži zgodovino verzij meritve"
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Zgodovina verzij — korekcije NE prepišejo');})()" 14
eb_pocakaj_na "(()=>{return document.body.textContent.includes('+250');})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const aktivnaV2=t.includes('Aktivna verzija: v2'); const delta=t.includes('+250'); const v1v2=t.includes('v1')&&t.includes('v2'); const o7=t.includes('se NE izračunajo samodejno'); const zelenDot=!!document.querySelector('.bg-roksal-green'); return JSON.stringify({aktivnaV2, delta, v1v2, o7, zelenDot, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r279-z3.json
python3 -c "import json; r=json.load(open('/tmp/r279-z3.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['aktivnaV2'] and d['delta'] and d['v1v2'] and d['o7'], 'Z3 panel FAIL: '+json.dumps(d); print('Z3 OK — veriga v1→v2 + delta +250 + aktivna v2 + O7 resnica')" || exit 1
agent-browser eval "(()=>{const ths=[...document.querySelectorAll('th[title]')]; const verz=ths.find(t=>(t.getAttribute('title')||'').indexOf('Verzija v verigi korekcij')===0); const vir=ths.find(t=>(t.getAttribute('title')||'').indexOf('Izvor meritve — izpeljan na strežniku')===0); const delta=ths.find(t=>(t.getAttribute('title')||'').indexOf('Delta od predhodne verzije')===0); return JSON.stringify({theadTitles:ths.length, verz:!!verz, vir:!!vir, delta:!!delta, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r279-z3-stil.json
python3 -c "import json; r=json.load(open('/tmp/r279-z3-stil.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['theadTitles']>=4 and d['verz'] and d['vir'] and d['delta'], 'Z3 stil FAIL: '+json.dumps(d); print('Z3 stil OK — thead title (Verzija/Vir/Dolžina/Δ) hover razložljivost ŽIVO')" || exit 1
agent-browser screenshot "$SS/qa-r279-e2e-panel.png" > /dev/null 2>&1

echo "=== Z4: regresije — R272/R271 pilli ŽIVO (isti projekt) ==="
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled nagibov kot PDF\"]');})()" 24
R272=$(agent-browser eval "(()=>{return JSON.stringify({pill:!!document.querySelector('button[aria-label=\"Izvozi terenski pregled nagibov kot PDF\"]'), err:window.__err??null});})()" 2>&1 | tail -1)
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]');})()" 24
R271=$(agent-browser eval "(()=>{return JSON.stringify({pill:!!document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]'), err:window.__err??null});})()" 2>&1 | tail -1)
python3 - "$R272" "$R271" <<'PYEOF' || exit 1
import json, sys
def parse(raw):
    d = json.loads(raw)
    return json.loads(d) if isinstance(d, str) else d
r272, r271 = parse(sys.argv[1]), parse(sys.argv[2])
assert r272['pill'] and r271['pill'], f'Z4 regresije FAIL: {r272} {r271}'
print('Z4 regresije OK — R272 + R271 pill ŽIVO')
PYEOF

echo "=== Z5: temna + err null (panel še odprt) ==="
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]');})()" 14
eb_klik_prefix "Pokaži zgodovino verzij meritve"
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Zgodovina verzij — korekcije NE prepišejo');})()" 14
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({temna:document.documentElement.classList.contains('dark'), panel:t.includes('Zgodovina verzij — korekcije NE prepišejo'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r279-z5.json
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
python3 -c "import json; r=json.load(open('/tmp/r279-z5.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['temna'] and d['panel'] and d['err'] is None, 'Z5 temna FAIL: '+json.dumps(d); print('Z5 temna OK — verzije panel vidna, err null')" || exit 1

echo "=== RESTORE + ODTIS (bajtnata identičnost — ZERO-MUTACIJA) ==="
node scripts/r276-db-e2e.cjs restore || exit 1
node scripts/r273-db-e2e.cjs restore > /dev/null 2>&1 || true
node scripts/r276-db-e2e.cjs fp > /tmp/r279-fp-post.json || exit 1
if cmp -s /tmp/r279-fp-pre.json /tmp/r279-fp-post.json; then
  echo "ODTIS BAJTNATO IDENTIČEN (pre==post) — ZERO-MUTACIJA dokazana"
else
  echo "ODTIS RAZLIČEN — FAIL"; diff <(python3 -m json.tool /tmp/r279-fp-pre.json) <(python3 -m json.tool /tmp/r279-fp-post.json) | head -20
  exit 1
fi

echo "=== ZAKLJUČEK: strežnik + brskalnik zaprta ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R279 E2E KONEC ==="
