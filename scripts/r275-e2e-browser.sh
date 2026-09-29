#!/bin/bash
# R275 E2E ŽIVO (lokalni :3100, ADMIN) — UNION verifikacija dveh polovic rundi:
#   (a) a11y sweep: role="status" na F2 mini-vrsticah (R263–R273 družina —
#       async resnica oznanjena bralniku; 0 novih hex);
#   (b) R273 zaloga-vrednost regresija: pill + legenda + mini + fail-closed +
#       seed dinamična resnica + toast + PDF (bajtna reprodukcija 58525 —
#       determinizem, R273 handover fingerprint).
# ZERO-MUTACIJA: seed-base + seed-vrednost + RESTORE; ⚠️ lekcija 5 (tretjič):
# RESTORE PRED fp-pre (idempotentno — crash-ostanki ne pokvarijo pre-odtisa).
# fail-fast guard || exit 1 na vsakem kriticnem koraku (r271 lekcija 4).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r275-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R275-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

izberi_projekt() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r273-proj'})); return 'izbran';})()" 2>&1 | tail -1
}

echo "--- HIGIENA: RESTORE pred fp-pre (lekcija 5 — idempotentno, nič mutacij) ---"
node scripts/r273-db-e2e.cjs restore || exit 1

echo "--- PRSTNI ODTIS PRE (Inventory + MaterialPrice + Supplier POLNA resnica) ---"
node scripts/r273-db-e2e.cjs fp > /tmp/r275-fp-pre.json || exit 1
cat /tmp/r275-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])" || exit 1

echo "--- SEED-BASE (1 stranka + 1 projekt — za projekt-gated regresije) ---"
node scripts/r273-db-e2e.cjs seed-base || exit 1

echo "--- PRIJAVA ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Zaloga — R273 pill ŽIVO + mini 'Σ —' + RED dot + role=\"status\" (a11y sweep) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled vrednosti zaloge kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const s=[...document.querySelectorAll('span')].find(x=>x.textContent.indexOf('Vrednost (viden seznam)')===0); return !!s && s.textContent.includes('Σ —');})()" 24
eb_cakaj 2
agent-browser eval "(()=>{const t=document.body.textContent; const vredKont=[...document.querySelectorAll('div[role=\"status\"]')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Vrednost (viden seznam)')===0;}); const invKont=[...document.querySelectorAll('div[role=\"status\"]')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Inventura (viden seznam)')===0;}); const legenda=t.includes('PDF = polna denarna resnica skladišča (FRESH /api/inventory + /api/material-prices ob kliku — samo trenutno veljavne cene; ne zastarel state)'); return JSON.stringify({vredRole:!!vredKont, invRole:!!invKont, vredDotRed:vredKont?!!vredKont.querySelector('span[aria-hidden].bg-roksal-red'):false, invDotRed:invKont?!!invKont.querySelector('span[aria-hidden].bg-roksal-red'):false, vredTitle:vredKont?(vredKont.getAttribute('title')||'').includes('Σ — pomeni: nič artiklov nima trenutno veljavne cene'):false, vredHelp:vredKont?vredKont.className.includes('cursor-help'):false, invTitle:invKont?(invKont.getAttribute('title')||'').includes('pod minimumom = akcija naročila'):false, legenda, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r275-z1.json
python3 -c "import json; r=json.load(open('/tmp/r275-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['vredRole'] and d['invRole'], 'Z1 role=\"status\" FAIL: '+json.dumps(d); assert d['vredDotRed'] and d['invDotRed'], 'Z1 dot FAIL (brez cene/pod minimumom > 0 → RED): '+json.dumps(d); assert d['legenda'], 'Z1 legenda FAIL: '+json.dumps(d)
assert d['vredTitle'] and d['vredHelp'] and d['invTitle'], 'Z1 title/cursor-help FAIL (R275 razložljivost): '+json.dumps(d); print('Z1 OK — role=\"status\" na OBEH mini (Vrednost + Inventura) + RED dot + legenda pariteta')" || exit 1
agent-browser screenshot "$SS/qa-r275-e2e-role-status.png" > /dev/null 2>&1

echo "=== Z1b: fail-closed veja prek fetch stuba [] (stub restavriran — NIČ DB mutacij) ==="
eb_zajem_pdf val275pre
eb_csv_reset val275pre
agent-browser eval "(()=>{if(!window.__origFetch) window.__origFetch=window.fetch; window.fetch=function(u,o){ if(String(u).includes('/api/inventory')){ return Promise.resolve(new Response(JSON.stringify([]),{status:200,headers:{'Content-Type':'application/json'}})); } return window.__origFetch.apply(this,[u,o]); }; return 'stub';})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi pregled vrednosti zaloge kot PDF"
eb_pocakaj_tekst "Ni vpisanih artiklov" 14
eb_cakaj 1
agent-browser eval "(()=>{window.fetch=window.__origFetch; delete window.__origFetch; const t=document.body.textContent; return JSON.stringify({stubRestavriran:!window.__origFetch, toastTitle:t.includes('Ni vpisanih artiklov'), toastOpis:t.includes('Pregled vrednosti zaloge se izvozi, ko je vpisan prvi artikel zaloge.'), niDokumenta:!(typeof window.__val275pre==='string'&&window.__val275pre.length>0), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r275-z1b.json
python3 -c "import json; r=json.load(open('/tmp/r275-z1b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['stubRestavriran'] and d['toastTitle'] and d['toastOpis'] and d['niDokumenta'], 'Z1b fail-closed FAIL: '+json.dumps(d); print('Z1b fail-closed veja OK (ni dokumenta, stub restavriran)')" || exit 1

echo "=== Z2: SEED-VREDNOST + POLN reload — mini DINAMIČNO iz ISTEGA API (Σ 239.85) + role=\"status\" + žetona ==="
node scripts/r273-db-e2e.cjs seed-vrednost || exit 1
agent-browser open "$EB_BASE" > /dev/null 2>&1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Odjava\"]');})()" 24
eb_zapri_vodic
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled vrednosti zaloge kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const s=[...document.querySelectorAll('span')].find(x=>x.textContent.indexOf('Vrednost (viden seznam)')===0); return !!s && s.textContent.includes('239.85');})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const vredKont=[...document.querySelectorAll('div[role=\"status\"]')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Vrednost (viden seznam)')===0;}); const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Vrednost (viden seznam)')===0); const zetoni=vredKont?[...vredKont.querySelectorAll('span.rounded-full')].map(x=>x.textContent.trim()).filter(x=>x!==''):[]; return JSON.stringify({vredRole:!!vredKont, miniTekst:mini?mini.textContent.trim():null, zetoni, dotRed:vredKont?!!vredKont.querySelector('span[aria-hidden].bg-roksal-red'):false, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r275-z2.json
python3 - <<'PYEOF' || exit 1
import json
r = json.load(open('/tmp/r275-z2.json'))
d = json.loads(r) if isinstance(r, str) else r
assert d['vredRole'], 'Z2 role="status" FAIL: ' + json.dumps(d)
assert d['miniTekst'] == 'Vrednost (viden seznam): 13 artiklov · Σ 239.85 EUR', 'Z2 mini FAIL: ' + json.dumps(d)
assert d['zetoni'] == ['pretečena 1', 'brez cene 9'], 'Z2 žetona FAIL: ' + json.dumps(d)
assert d['dotRed'], 'Z2 dot FAIL (brez cene 9 > 0 → RED prioritetni — kanon RED nad AMBER): ' + json.dumps(d)
print('Z2 OK — role="status" ŽIVO + dinamična resnica IZ ISTEGA API: 13 artiklov · Σ 239.85 EUR + žetona + RED dot')
PYEOF
agent-browser screenshot "$SS/qa-r275-e2e-mini.png" > /dev/null 2>&1

echo "=== Z2b: POST klik — toast agregat + PDF bajtna reprodukcija 58525 (R273 determinizem) ==="
eb_zajem_pdf val275
eb_csv_reset val275
eb_klik_gumb "Izvozi pregled vrednosti zaloge kot PDF"
eb_pocakaj_tekst "Pregled vrednosti zaloge prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=t.includes('Zaloga-vrednost-…pdf — 13 artiklov, Σ 239.85 EUR, pretečena 1, brez cene 9.')?'13 artiklov, Σ 239.85 EUR, pretečena 1, brez cene 9':null; const b64=window.__val275; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, agg:agg, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, agg:agg, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r275-z2-pdf.json
python3 - <<'PYEOF' || exit 1
import json
r = json.load(open('/tmp/r275-z2-pdf.json'))
d = json.loads(r) if isinstance(r, str) else r
assert d['pdf'] and d['magija'] == '%PDF-', 'Z2b PDF FAIL: ' + json.dumps(d)
assert d['bajtov'] == 58525, f"Z2b determinizem FAIL: {d['bajtov']} ≠ 58525 (R273 fingerprint — ista seme → isti dokument)"
assert d['agg'] == '13 artiklov, Σ 239.85 EUR, pretečena 1, brez cene 9', "Z2b agg FAIL: " + str(d['agg'])
print(f"Z2b OK — PDF {d['bajtov']} bajtov = bajtnata reprodukcija R273 (determinizem) + agg ISTA resnica")
PYEOF
agent-browser screenshot "$SS/qa-r275-e2e-pdf.png" > /dev/null 2>&1

echo "=== Z3: regresije ŽIVO — R272 nagibi + R271 zapisnik + R269 meritve + role=\"status\" družinski pilli ==="
izberi_projekt
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled nagibov kot PDF\"]');})()" 24
R272_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi terenski pregled nagibov kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R272: $R272_OK"
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]');})()" 24
R271_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R271: $R271_OK"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
R269_OK=$(agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]'); return JSON.stringify({pill:!!b, err:window.__err??null});})()" 2>&1 | tail -1)
echo "  R269: $R269_OK"
python3 - "$R272_OK" "$R271_OK" "$R269_OK" <<'PYEOF' || exit 1
import json, sys

def parse(raw):
    d = json.loads(raw)
    return json.loads(d) if isinstance(d, str) else d

r272, r271, r269 = parse(sys.argv[1]), parse(sys.argv[2]), parse(sys.argv[3])
assert r272['pill'] and r271['pill'] and r269['pill'], f'Z3 regresije FAIL: {r272} {r271} {r269}'
print('Z3 regresije OK — R272 + R271 + R269 pill ŽIVO (vsak na svojem tabu)')
PYEOF
agent-browser screenshot "$SS/qa-r275-e2e-regresije.png" > /dev/null 2>&1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({temna:document.documentElement.classList.contains('dark'), legendaTemna:t.includes('PDF = polna denarna resnica skladišča'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r275-z4.json
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
python3 -c "import json; r=json.load(open('/tmp/r275-z4.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['temna'] and d['legendaTemna'] and d['err'] is None, 'Z4 temna FAIL: '+json.dumps(d); print('Z4 temna OK — legenda vidna, err null')" || exit 1

echo "=== RESTORE + ODTIS (bajtnata identičnost — ZERO-MUTACIJA) ==="
node scripts/r273-db-e2e.cjs restore || exit 1
node scripts/r273-db-e2e.cjs fp > /tmp/r275-fp-post.json || exit 1
if cmp -s /tmp/r275-fp-pre.json /tmp/r275-fp-post.json; then
  echo "ODTIS BAJTNATO IDENTIČEN (pre==post) — ZERO-MUTACIJA dokazana"
else
  echo "ODTIS RAZLIČEN — FAIL"; diff <(python3 -m json.tool /tmp/r275-fp-pre.json) <(python3 -m json.tool /tmp/r275-fp-post.json) | head -20
  exit 1
fi

echo "=== ZAKLJUČEK: strežnik + brskalnik zaprta ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R275 E2E KONEC ==="
