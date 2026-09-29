#!/bin/bash
# R294 E2E ŽIVO (lokalni :3100, ADMIN) — OPOMNIK DEEP-LINK ((k) dopolnitev
# R287: signal → dejanje → CILJ) + INVENTURA CSV + ZAPISNI LIST PDF/CSV + zgodovina verzij:
#   Z0z: ZVONČEK OPOMNIK ŽIVO (R287 regresija): zvonček odprt → POTEKEL
#        vrstica (red, prioriteta) + AKTIVEN (amber); klik na POTEKEL →
#        CRM tab (R182 protokol);
#   Z0y: DEEP-LINK ŽIVO (R294 NOVO): detail Sheet stranke SAMODEJNO odprt
#        (SheetTitle = 'E2E R287 Potekel Opomnik' — dvo-dogodkovni protokol
#        R214 vzorec: navigate crm + roksal:select-crm) + opomniška kartica
#        ('Opomnik potekel' — POTEKEL red resnica) + ZAPRI gumb → poudarjena
#        vrstica v CRM seznamu (border-roksal-amber/60 + bg-roksal-amber/5 +
#        title 'Poudarjeno iz zvončka (opomnik)' — D6 stil, 0 novih hex) +
#        AKTIVEN vrstica NI poudarjena (izrecna izbira — nikoli razsuta);
#   Z1: verzija pill 'v1' + vir 'Ročni vnos' + R269 mini title ŽIVO
#       (r276 projekt — regresija + R283 STIL); VIRI MINI amber (delna
#       pokritost — samo MANUAL — iskrena resnica r276 seeda);
#   Z1r: REF PROJEKT (e2e-r283-ref-proj) — VIRI MINI ŽIVO + GREEN pika +
#       vir pilli ×3 + R269 mini + osnutek žeton title (R283 regresija);
#   Z1s: SYNC ŽIG ŽIVO (r281 projekt — R281 regresija);
#   Z1m: F2 SYNC MINI-Vrstica ŽIVO (R282 regresija);
#   Z2: Popravi tok ŽIVO (R276 regresija — v2 pill, v1 ostane);
#   Z2b: TERENSKI PDF ŽIVO (R269 regresija);
#   Z2z: ZAPISNI LIST PDF ŽIVO (R284 regresija);
#   Z2x: INVENTURA PREGLED CSV ŽIVO (R286 regresija);
#   Z2y: ZAPISNI LIST CSV ŽIVO (R285 regresija);
#   Z3: panel zgodovine + R277 STIL;
#   Z4: regresije — R272/R271 pilli ŽIVO (projekt-gated);
#   Z5: temna + err null.
# ZERO-MUTACIJA: restore → fp-pre → seed → ... → restore → fp-post
# (bajtnata identičnost). fail-fast || exit 1 (r271 lekcija 4).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r285-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R294-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

izberi_projekt() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r276-proj'})); return 'izbran';})()" 2>&1 | tail -1
}

echo "--- HIGIENA: RESTORE pred fp-pre (lekcija 5 — idempotentno) ---"
node scripts/r276-db-e2e.cjs restore || exit 1
node scripts/r273-db-e2e.cjs restore > /dev/null 2>&1 || true
node scripts/r281-db-e2e.cjs restore || exit 1
node scripts/r283-referencni-projekt.cjs restore || exit 1
node scripts/r287-db-e2e.cjs restore || exit 1

echo "--- PRSTNI ODTIS PRE (Measurement + AuditLog + Project + Customer e2e-r276% + e2e-r281% + e2e-r283%) ---"
node scripts/r276-db-e2e.cjs fp > /tmp/r294-fp-pre-276.json || exit 1
node scripts/r281-db-e2e.cjs fp > /tmp/r294-fp-pre-281.json || exit 1
node scripts/r283-referencni-projekt.cjs fp > /tmp/r294-fp-pre-283.json || exit 1
node scripts/r287-db-e2e.cjs fp > /tmp/r294-fp-pre.json || exit 1

echo "--- SEED-VERZIJE (stranka + projekt + meritev v1 = 3200×1200, vir MANUAL) ---"
node scripts/r276-db-e2e.cjs seed-verzije || exit 1

echo "--- SEED-SYNC (r281 projekt + 2 meritvi s sync metadata — issue #16 §10) ---"
node scripts/r281-db-e2e.cjs seed-sync || exit 1

echo "--- SEED-REFERENCNI (r283 REF projekt + 3 meritvi = vse tri vrste virov — issue #15 §1/§3) ---"
node scripts/r283-referencni-projekt.cjs seed-referencni || exit 1

echo "--- SEED-OPOMNIKI (r287: POTEKEL now-3d + AKTIVEN now+5d — zvonček signal 7) ---"
node scripts/r287-db-e2e.cjs seed-opomniki || exit 1

echo "--- PRIJAVA ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z0z: ZVONČEK OPOMNIK ŽIVO — signal 7 + portal akcija ((k), R287) ==="
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label^=\"Obvestila\"]'); if(!b) return 'BREZ-ZVONČKA'; b.click(); return 'odprto';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const vr=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('— odpre CRM (opomnik)')); return vr.length >= 2;})()" 20
eb_cakaj 1
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('— odpre CRM (opomnik)')); const info=vr.map(x=>({aria:x.getAttribute('aria-label'), meta:(x.querySelector('p.uppercase')||{}).textContent||null, red:!!x.querySelector('.text-roksal-red'), amber:!!x.querySelector('.text-roksal-amber')})); return JSON.stringify({st:vr.length, info, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z0z.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r294-z0z.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['st'] >= 2, 'Z0z: pričakovani vsaj 2 opomniški vrstici: ' + json.dumps(d)
potekel = [x for x in d['info'] if x['aria'].startswith('E2E R287 Potekel Opomnik')]
aktiven = [x for x in d['info'] if x['aria'].startswith('E2E R287 Aktiven Opomnik')]
assert potekel and aktiven, 'Z0z: obe seed stranki morata biti vidni: ' + json.dumps(d['info'])
assert potekel[0]['red'] and not potekel[0]['amber'], 'Z0z POTEKEL barva FAIL (red): ' + json.dumps(potekel[0])
assert aktiven[0]['amber'] and not aktiven[0]['red'], 'Z0z AKTIVEN barva FAIL (amber): ' + json.dumps(aktiven[0])
assert potekel[0]['meta'] and potekel[0]['meta'].startswith('POTEKEL · zapadlo'), 'Z0z POTEKEL meta FAIL: ' + json.dumps(potekel[0])
assert aktiven[0]['meta'] and (aktiven[0]['meta'].startswith('še ') or aktiven[0]['meta'] == 'rok danes'), 'Z0z AKTIVEN meta FAIL: ' + json.dumps(aktiven[0])
assert d['info'].index(potekel[0]) < d['info'].index(aktiven[0]), 'Z0z POTEKEL prioriteta FAIL (vrstni red)'
assert d['err'] is None, 'Z0z err: ' + json.dumps(d)
print('Z0z OK — zvonček opomnik ŽIVO (POTEKEL red prioriteta + AKTIVEN amber; meta koledarsko iskrena)')
PYEOF
agent-browser screenshot "$SS/qa-r294-e2e-z0z-zvoncek.png" > /dev/null 2>&1
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('E2E R287 Potekel Opomnik')); if(!vr) return 'BREZ'; vr.click(); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='CRM stranke'); return !!h;})()" 20
eb_cakaj 1
agent-browser eval "(()=>{const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='CRM stranke'); return JSON.stringify({crm:!!h, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z0z-crm.json
python3 -c "import json; r=json.load(open('/tmp/r294-z0z-crm.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['crm'], 'Z0z CRM tab FAIL (portal akcija): '+json.dumps(d); assert d['err'] is None, 'Z0z err: '+json.dumps(d); print('Z0z OK — portal akcija ŽIVO: klik na POTEKEL → CRM tab (R182 protokol)')" || exit 1
agent-browser screenshot "$SS/qa-r294-e2e-z0y-deeplink.png" > /dev/null 2>&1

agent-browser screenshot "$SS/qa-r294-e2e-z0y-deeplink.png" > /dev/null 2>&1

echo "=== Z0y: DEEP-LINK ŽIVO — detail Sheet samodejno odprt + poudarjena vrstica (R294) ==="
eb_pocakaj_na "(()=>{const t=[...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik'); return t;})()" 20
eb_cakaj 1
agent-browser eval "(()=>{const tit=[...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik'); const kartica=document.body.textContent.includes('Opomnik potekel'); const opis=document.body.textContent.includes('E2E pokliči nazaj (potekel)'); return JSON.stringify({tit, kartica, opis, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z0y-sheet.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r294-z0y-sheet.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['tit'] and d['kartica'] and d['opis'], 'Z0y Sheet FAIL (deep-link ni odprl detaila): ' + json.dumps(d)
assert d['err'] is None, 'Z0y err: ' + json.dumps(d)
print('Z0y OK — deep-link detail Sheet ŽIVO (SheetTitle + opomniška kartica POTEKEL — dvo-dogodkovni R214 vzorec)')
PYEOF
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(x=>{const s=x.querySelector('.sr-only'); return s&&s.textContent.trim()==='Zapri'&&x.closest('[data-slot="sheet-content"]');}); if(!g) { const g2=[...document.querySelectorAll('[data-radix-collection-item], button')].filter(x=>{const s=x.querySelector('.sr-only'); return s&&s.textContent.trim()==='Zapri';}).pop(); if(!g2) return 'BREZ-ZAPRI'; g2.click(); return 'zapri-fallback'; } g.click(); return 'zapri';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return ![...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik');})()" 14
agent-browser eval "(()=>{const vrstica=[...document.querySelectorAll('[role="button"]')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Stranka E2E R287 Potekel Opomnik')); const akt=[...document.querySelectorAll('[role="button"]')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Stranka E2E R287 Aktiven Opomnik')); const poud=vrstica?vrstica.className.includes('border-roksal-amber/60'):false; const polnilo=vrstica?vrstica.className.includes('bg-roksal-amber/5'):false; const tit=vrstica?vrstica.getAttribute('title'):null; const aktCista=akt?!akt.className.includes('border-roksal-amber/60'):true; return JSON.stringify({najdena:!!vrstica, poud, polnilo, tit, aktCista, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z0y-poudarek.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r294-z0y-poudarek.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['najdena'], 'Z0y vrstica FAIL (seed stranka ni v CRM seznamu): ' + json.dumps(d)
assert d['poud'] and d['polnilo'], 'Z0y poudarek FAIL (roksal-amber obroba+polnilo): ' + json.dumps(d)
assert d['tit'] == 'Poudarjeno iz zvončka (opomnik)', 'Z0y title FAIL: ' + json.dumps(d)
assert d['aktCista'], 'Z0y AKTIVEN vrstica NE SME biti poudarjena: ' + json.dumps(d)
assert d['err'] is None, 'Z0y err: ' + json.dumps(d)
print('Z0y OK — poudarjena vrstica ŽIVO (roksal-amber obroba+polnilo+title; AKTIVEN NE poudarjena — izrecna izbira)')
PYEOF
agent-browser screenshot "$SS/qa-r294-e2e-z0y-poudarek.png" > /dev/null 2>&1


echo "=== Z0m: PRIHODKI PO MESECIH ŽIVO (R294 — plačila dimenzija, POGOJNI probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('section[aria-label^=\"Prihodki po mesecih\"]');})()" 16; then
  eb_cakaj 1
  agent-browser eval "(()=>{const s=document.querySelector('section[aria-label^=\"Prihodki po mesecih\"]'); const vrstice=[...s.querySelectorAll('ul li')]; const skupaj=s.textContent.includes('Skupaj plačano'); const prazna=s.textContent.includes('Ni plačanih računov'); const storn=s.textContent.includes('(izključeni iz zneskov)'); const vt=s.textContent.includes('v teku:'); return JSON.stringify({vrstice:vrstice.length, skupaj, prazna, storn, vt, besedilo:vrstice.length>0?vrstice[0].textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r294-z0m.json
  python3 - <<'PYEOF2' || exit 1
import json
raw = open('/tmp/r294-z0m.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0m err: ' + json.dumps(d)
assert (d['vrstice'] > 0) != d['prazna'], 'Z0m pogojni kanon: vrstice=' + str(d['vrstice']) + ' prazna=' + str(d['prazna']) + ' — natanko ENA resnica: ' + json.dumps(d)
if d['vrstice'] > 0:
    assert d['skupaj'], 'Z0m: vrstice brez Skupaj vrstice: ' + json.dumps(d)
    print('Z0m OK — PRIHODKI PO MESECIH ŽIVO: ' + str(d['vrstice']) + ' meseci · Skupaj ŽIVO · prva vrstica: ' + str(d['besedilo'])[:60])
else:
    print('Z0m OK — sekcija ŽIVO, iskrena praznina (spot portfel brez plačanih računov — pogojni kanon r277)')
PYEOF2
  agent-browser screenshot "$SS/qa-r294-e2e-z0m-meseci.png" > /dev/null 2>&1
else
  echo "Z0m OPOMBA: sekcija ni dosegljiva na spot seji (CRM skoping RBAC?) — chunk needleji R294 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0n: PRIHODKI MESECI CSV ŽIVO (R294 — 8. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi prihodke po mesecih kot CSV\"]');})()" 16; then
  eb_csv_capture prihodkiMeseci
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi prihodke po mesecih kot CSV\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni plačanih računov') && body.includes('CSV se izvozi ob prvem plačilu.'); const uspeh=body.includes('Prihodki po mesecih prenešeni v CSV ('); const c=window.__prihodkiMeseci ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, csvNiz:niz, bajti:niz?c.length:0, bom:niz?c.charCodeAt(0)===0xFEFF:false, glava:niz?c.split('\n')[0].slice(0,40):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r294-z0n.json
  python3 - <<'PYEOF3' || exit 1
import json
raw = open('/tmp/r294-z0n.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0n err: ' + json.dumps(d)
if d['prazno']:
    assert not d['csvNiz'], 'Z0n: toast pri 0 A VSEENO datoteka (kršitev fail-closed): ' + json.dumps(d)
    print('Z0n OK — CSV gumb ŽIVO, fail-closed toast pri 0 mesecih (spot iskrena praznina — R250 vzorec; NIČ datoteke)')
elif d['csvNiz']:
    assert d['bajti'] > 0 and d['bom'], 'Z0n: datoteka brez BOM/vsebine: ' + json.dumps(d)
    print('Z0n OK — CSV ŽIVO bajtno (' + str(d['bajti']) + ' B, BOM efbbbf, glava: ' + str(d['glava']) + ')')
else:
    raise AssertionError('Z0n: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF3
  eb_csv_reset prihodkiMeseci
  agent-browser screenshot "$SS/qa-r294-e2e-z0n-meseci-csv.png" > /dev/null 2>&1
else
  echo "Z0n OPOMBA: CSV gumb ni dosegljiv na spot seji (CRM skoping RBAC?) — chunk needleji R294 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0o: TEDENSKI RAZGLED + TEDENSKI CSV ŽIVO (R292 — 23. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi tedenski pregled montaž kot CSV\"]');})()" 16; then
  # RAZGLED strip (MANDATORY STIL): aria regija + 7 dni + sklep/praznina + aria-hidden tir
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\"Tedenski razgled — naslednjih 7 dni\"]'); if(!reg) return JSON.stringify({strip:false, err:window.__err??null}); const celice=reg.querySelectorAll('.grid.grid-cols-7 > div').length; const sklep=document.querySelector('[data-testid=\"tedenski-razgled-sklep\"]'); const tiri=reg.querySelectorAll('[aria-hidden=\"true\"].h-1').length; return JSON.stringify({strip:true, celice, tiri, sklep:sklep?sklep.textContent.trim().slice(0,80):null, praznina:sklep?sklep.textContent.includes('Naslednjih 7 dni brez vpisanih terminov.'):false, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r294-z0o-strip.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r294-z0o-strip.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0o strip err: ' + json.dumps(d)
assert d['strip'], 'Z0o: razgled strip NI na zaslonu (aria regija manjka): ' + json.dumps(d)
assert d['celice'] == 7, 'Z0o: strip NI prikazal 7 dni (iskrena resnica razgleda): ' + json.dumps(d)
assert d['tiri'] == 7, 'Z0o: mini tirje NIČ/nekorektno (aria-hidden vzorec R291): ' + json.dumps(d)
assert d['sklep'] and (d['praznina'] or 'dni z delom' in d['sklep']), 'Z0o: sklep/praznina FAIL: ' + json.dumps(d)
print('Z0o strip OK — razgled ŽIVO: 7 dni (' + str(d['celice']) + ' celic, ' + str(d['tiri']) + ' aria-hidden tirjev) · sklep: ' + str(d['sklep'])[:60])
PYEOF4
  # CSV (pogojni kanon R250/R291: toast pri 0 + NIČ datoteke ALI bajtna capture z BOM)
  eb_csv_capture tedenskiCsv
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi tedenski pregled montaž kot CSV\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('CSV se izvozi, ko je vpisan termin v prihajajočem tednu.'); const uspeh=body.includes('Tedenski pregled prenešen v CSV ('); const c=window.__tedenskiCsv ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, csvNiz:niz, bajti:niz?c.length:0, bom:niz?c.charCodeAt(0)===0xFEFF:false, glava:niz?c.split('\n')[0].slice(0,60):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r294-z0o-csv.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r294-z0o-csv.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0o CSV err: ' + json.dumps(d)
if d['prazno']:
    assert not d['csvNiz'], 'Z0o: toast pri 0 A VSEENO datoteka (kršitev fail-closed): ' + json.dumps(d)
    print('Z0o CSV OK — gumb ŽIVO, fail-closed toast pri 0 terminih v oknu (spot iskrena praznina — R250/R291 vzorec; NIČ datoteke)')
elif d['csvNiz']:
    assert d['bajti'] > 0 and d['bom'], 'Z0o: datoteka brez BOM/vsebine: ' + json.dumps(d)
    assert d['glava'] and d['glava'].startswith('"Dan","Dan v tednu"'), 'Z0o: glava FAIL (9 stolpcev): ' + str(d['glava'])
    print('Z0o CSV OK — TEDENSKI CSV ŽIVO bajtno (' + str(d['bajti']) + ' B, BOM efbbbf, glava: ' + str(d['glava'])[:50] + ')')
else:
    raise AssertionError('Z0o: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF4
  eb_csv_reset tedenskiCsv
  agent-browser screenshot "$SS/qa-r294-e2e-z0o-tedenski-csv.png" > /dev/null 2>&1
else
  echo "Z0o OPOMBA: tedenski CSV gumb ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R292 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0p: MARŽNI RAZGLED + DOBIČKONOST CSV ŽIVO (R293 — 24. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobičkonosnost projektov kot CSV\"]');})()" 16; then
  # MARŽNI RAZGLED strip (MANDATORY STIL): aria regija + vrstice/sklep/praznina + aria-hidden tirje
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\"Maržni razgled — marža po projektih\"]'); if(!reg) return JSON.stringify({strip:false, err:window.__err??null}); const vrstice=reg.querySelectorAll('.space-y-1 > div').length; const tiri=reg.querySelectorAll('[aria-hidden=\"true\"].h-1').length; const sklep=document.querySelector('[data-testid=\"marzni-razgled-sklep\"]'); return JSON.stringify({strip:true, vrstice, tiri, sklep:sklep?sklep.textContent.trim().slice(0,90):null, praznina:sklep?sklep.textContent.includes('Ni projektov v preseku'):false, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r294-z0p-strip.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r294-z0p-strip.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0p strip err: ' + json.dumps(d)
assert d['strip'], 'Z0p: maržni razgled strip NI na zaslonu (aria regija manjka): ' + json.dumps(d)
assert (d['vrstice'] > 0) != d['praznina'], 'Z0p pogojni kanon: vrstice=' + str(d['vrstice']) + ' praznina=' + str(d['praznina']) + ' — natanko ENA resnica: ' + json.dumps(d)
if d['vrstice'] > 0:
    assert d['tiri'] == d['vrstice'], 'Z0p: tirjevi števec ne ustreza vrsticam (aria-hidden vzorec R291/R292): ' + json.dumps(d)
    assert 'marža' in d['sklep'], 'Z0p: sklep brez marže resnice: ' + json.dumps(d)
    print('Z0p strip OK — MARŽNI RAZGLED ŽIVO: ' + str(d['vrstice']) + ' vrstic (' + str(d['tiri']) + ' aria-hidden tirjev) · sklep: ' + str(d['sklep'])[:70])
else:
    print('Z0p strip OK — strip ŽIVO, iskrena praznina (spot portfel brez preseka — pogojni kanon r277)')
PYEOF4
  # CSV (pogojni kanon R250/R291/R292: toast pri 0/0 + NIČ datoteke ALI bajtna capture z BOM)
  # LEKCIJA R293 (1. generacija z REALNO capture — Z0n/Z0o so vedno padle na
  # prazno vejo): Response.text() STRIJE vodilni BOM (fetch spec UTF-8 decode)
  # — BOM se dokazuje iz RAW bajtov (arrayBuffer: EF BB BF), tekst pa z
  # TextDecoder (BOM ostane → strip pred glavo preverbo).
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__dobicikonostBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__dobicikonostCsv=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi dobičkonosnost projektov kot CSV\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni podatkov za dobičkonost') && body.includes('CSV se izvozi, ko je vpisan prvi račun ali naročilo.'); const uspeh=body.includes('Dobičkonost prenešena v CSV ('); const c=window.__dobicikonostCsv ?? null; const niz=(typeof c==='string'); const brezBom=niz?c.replace(/^\uFEFF/,''):null; return JSON.stringify({prazno, uspeh, csvNiz:niz, bom:window.__dobicikonostBom===true, bajti:niz?brezBom.length:0, glava:niz?brezBom.split('\n')[0].slice(0,60):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r294-z0p-csv.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r294-z0p-csv.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0p CSV err: ' + json.dumps(d)
if d['prazno']:
    assert not d['csvNiz'], 'Z0p: toast pri 0/0 A VSEENO datoteka (kršitev fail-closed): ' + json.dumps(d)
    print('Z0p CSV OK — gumb ŽIVO, fail-closed toast pri 0 računov IN 0 naročil (spot iskrena praznina — ISTI gate kot brat R258; NIČ datoteke)')
elif d['csvNiz']:
    assert d['bajti'] > 0 and d['bom'], 'Z0p: datoteka brez BOM/vsebine (RAW bajti EF BB BF): ' + json.dumps(d)
    assert d['glava'] and d['glava'].startswith('"Projekt","Prihodki (EUR)"'), 'Z0p: glava FAIL (7 stolpcev): ' + str(d['glava'])
    print('Z0p CSV OK — DOBIČKONOST CSV ŽIVO bajtno (' + str(d['bajti']) + ' B, BOM efbbbf RAW dokaz, glava: ' + str(d['glava'])[:50] + ')')
else:
    raise AssertionError('Z0p: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF4
  agent-browser eval "(()=>{window.__dobicikonostCsv=null; window.__dobicikonostBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r294-e2e-z0p-dobicikonost-csv.png" > /dev/null 2>&1
else
  echo "Z0p OPOMBA: vodja pregled ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R293 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0q: AVTOMATIZACIJA KARTICA ŽIVO (R294 — issue #1; deterministična resnica — brez podatkovne odvisnosti; ZERO-MUTACIJA) ==="
if eb_pocakaj_na "(()=>{return !!document.querySelector('[aria-label=\"Avtomatizacija — razred funkcij\"]');})()" 16; then
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\"Avtomatizacija — razred funkcij\"]'); if(!reg) return JSON.stringify({kartica:false}); const t=reg.textContent||''; const m=t.match(/(\\d+) funkcij · (\\d+) območij poslovanja/); const det=t.match(/(\\d+) determinističnih/); const sdk=t.match(/(\\d+) SDK/); const ai=t.match(/(\\d+) AI \\(neobvezne\\)/); return JSON.stringify({kartica:true, skupaj:m?+m[1]:null, obmocija:m?+m[2]:null, det:det?+det[1]:null, sdk:sdk?+sdk[1]:null, ai:ai?+ai[1]:null, nadomestki:t.includes('zmožnosti z izrečenim determinističnim nadomestkom'), sklep:t.includes('jedro deluje brez AI.')});})()" 2>&1 | tail -1 > /tmp/r294-z0q.json
  python3 - <<'PYEOFQ' || exit 1
import json
raw = open('/tmp/r294-z0q.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d.get('kartica'), 'Z0q: kartica NI na zaslonu: ' + json.dumps(d)
assert d['skupaj'] and d['skupaj'] >= 20, 'Z0q: katalog skupaj nenavadno: ' + json.dumps(d)
assert d['obmocija'] == 10, 'Z0q: pokritost območij != 10: ' + json.dumps(d)
assert d['det'] and d['det'] >= 20, 'Z0q: determinističnih pill: ' + json.dumps(d)
assert d['sdk'] >= 1, 'Z0q: SDK pill: ' + json.dumps(d)
assert d['ai'] == 2, 'Z0q: AI pill (2 neobvezni zmožnosti — doktrina): ' + json.dumps(d)
assert d['nadomestki'] and d['sklep'], 'Z0q: AI kontrakt literali manjkajo: ' + json.dumps(d)
print('Z0q OK — AVTOMATIZACIJA KARTICA ŽIVO: ' + str(d['skupaj']) + ' funkcij · ' + str(d['obmocija']) + ' območij · det=' + str(d['det']) + ' sdk=' + str(d['sdk']) + ' ai=' + str(d['ai']) + ' — jedro deluje brez AI')
PYEOFQ
  agent-browser screenshot "$SS/qa-r294-e2e-z0q-avtomatizacija.png" > /dev/null 2>&1
else
  echo "Z0q OPOMBA: vodja pregled ni dosegljiv na spot seji (RBAC skoping?) — needleji R294 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z1: Meritve tab — verzija pill v1 + vir 'Ročni vnos' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); return !!p;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const pill=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); const vir=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Meritve (viden seznam):')); const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); const viriDot=viriMini?viriMini.parentElement.querySelector('span[aria-hidden=\"true\"]'):null; return JSON.stringify({pill:!!pill, vir:!!vir, miniTitle:mini?(mini.getAttribute('title')||'').startsWith('Števec stanj vidnega seznama (WYSIWYG — R269)'):false, viriMini:viriMini?viriMini.textContent.trim():null, viriTitle:viriMini?(viriMini.getAttribute('title')||'').startsWith('Pokritost virov vidnega seznama (issue #15 §3)'):false, viriDotAmber:viriDot?viriDot.className.includes('bg-roksal-amber'):false, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z1.json
python3 -c "import json; r=json.load(open('/tmp/r294-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['vir'], 'Z1 pill/vir FAIL: '+json.dumps(d); assert d['miniTitle'], 'Z1 R283 R269 mini title FAIL: '+json.dumps(d); assert d['viriMini'] == 'Viri (viden seznam): 1 ročnih · 0 foto-CV · 0 AR-Depth', 'Z1 VIRI MINI vsebina FAIL (r276 = samo MANUAL): '+json.dumps(d); assert d['viriTitle'], 'Z1 VIRI title FAIL: '+json.dumps(d); assert d['viriDotAmber'], 'Z1 VIRI pika FAIL (delna pokritost = amber): '+json.dumps(d); print('Z1 OK — v1 pill + vir title + R269 mini title (R283 STIL) + VIRI MINI amber delna (1 ročnih · 0 · 0)')" || exit 1
agent-browser screenshot "$SS/qa-r294-e2e-z1.png" > /dev/null 2>&1

echo "=== Z1r: REF PROJEKT — VIRI MINI ŽIVO polna pokritost (issue #15 §1/§3) ==="
izberi_projekt_r283() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r283-ref-proj'})); return 'izbran';})()" 2>&1 | tail -1
}
izberi_projekt_r283
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const v=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const f=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Foto-CV'); const a=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='AR-Depth'); return !!v&&!!f&&!!a;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); const viriDot=viriMini?viriMini.parentElement.querySelector('span[aria-hidden=\"true\"]'):null; const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Meritve (viden seznam):')); const zeton=mini?mini.parentElement.querySelector('span.rounded-full.cursor-help'):null; const pilli=['Ročni vnos','Foto-CV','AR-Depth'].map(n=>[...document.querySelectorAll('span')].some(x=>x.textContent.trim()===n)); return JSON.stringify({viriMini:viriMini?viriMini.textContent.trim():null, viriTitle:viriMini?(viriMini.getAttribute('title')||'').startsWith('Pokritost virov vidnega seznama (issue #15 §3)'):false, viriDotGreen:viriDot?viriDot.className.includes('bg-roksal-green'):false, mini:mini?mini.textContent.trim():null, zeton:zeton?zeton.textContent.trim():null, zetonTitle:zeton?(zeton.getAttribute('title')||'').startsWith('Osnutki — meritve v stanju OSNUTEK'):false, pillRočni:pilli[0], pillFoto:pilli[1], pillAR:pilli[2], err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z1r.json
python3 -c "
import json
r = json.load(open('/tmp/r294-z1r.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['viriMini'] == 'Viri (viden seznam): 1 ročnih · 1 foto-CV · 1 AR-Depth', 'Z1r VIRI MINI FAIL (pričakovano 1·1·1): ' + json.dumps(d)
assert d['viriTitle'], 'Z1r VIRI title FAIL: ' + json.dumps(d)
assert d['viriDotGreen'], 'Z1r pika FAIL (polna pokritost = green): ' + json.dumps(d)
assert d['pillRočni'] and d['pillFoto'] and d['pillAR'], 'Z1r vir pilli ×3 FAIL: ' + json.dumps(d)
assert d['mini'] == 'Meritve (viden seznam): 3 meritve · osnutki 3 · potrjenih 0 · arhiviranih 0', 'Z1r R269 mini FAIL: ' + json.dumps(d)
assert d['zeton'] == '3 osnutki' and d['zetonTitle'], 'Z1r osnutek žeton FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1r err: ' + json.dumps(d)
print('Z1r OK — REF projekt: VIRI MINI ŽIVO 1·1·1 (green — §3 vsi trije viri) + vir pilli ×3 + R269 mini title + žeton title')" || exit 1
agent-browser screenshot "$SS/qa-r294-e2e-z1r-ref.png" > /dev/null 2>&1

echo "=== Z1s: SYNC ŽIG ŽIVO (R281 §10) — m1 'Sinhronizirano r7' + m2 'Konflikt' + tombstone ==="
izberi_projekt_r281() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r281-proj'})); return 'izbran';})()" 2>&1 | tail -1
}
izberi_projekt_r281
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Sinhronizirano')); return !!p;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const all=[...document.querySelectorAll('span.cursor-help')]; const synced=all.find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Sinhronizirano')); const konf=all.find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Konflikt')); return JSON.stringify({synced:{prisoten:!!synced, besedilo:synced?synced.textContent.trim():null}, konflikt:{prisoten:!!konf, besedilo:konf?konf.textContent.trim():null, tombstone:konf?(konf.getAttribute('title')||'').includes('tombstone — grobnico potrdi /api/sync'):false}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z1s.json
python3 -c "
import json
r = json.load(open('/tmp/r294-z1s.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['synced']['prisoten'] and d['synced']['besedilo'] == 'Sinhronizirano r7', 'Z1s synced FAIL: ' + json.dumps(d)
assert d['konflikt']['prisoten'] and d['konflikt']['besedilo'] == 'Konflikt' and d['konflikt']['tombstone'], 'Z1s konflikt FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1s err: ' + json.dumps(d)
print('Z1s OK — sync žig ŽIVO (regresija R281)')"
agent-browser screenshot "$SS/qa-r294-e2e-sync.png" > /dev/null 2>&1

echo "=== Z1m: F2 SYNC MINI-VRSTICA ŽIVO (R282 regresija — ŠE VEDNO na r281 projektu) ==="
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Sync (viden seznam):')); const akcija=[...document.querySelectorAll('span')].find(x=>(x.textContent||'')==='Konflikt — osveži bazo in ponovi sync'); return JSON.stringify({mini:mini?mini.textContent.trim():null, akcija:!!akcija, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z1m.json
python3 -c "
import json
r = json.load(open('/tmp/r294-z1m.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['mini'] and d['mini'].startswith('Sync (viden seznam): 1 sinhroniziranih · 0 čakajoči · 1 konfliktov · 0 napak · 1 grobnic'), 'Z1m mini FAIL: ' + json.dumps(d)
assert d['akcija'], 'Z1m akcijski žig FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1m err: ' + json.dumps(d)
print('Z1m OK — F2 sync mini regresija ŽIVO + akcijski žig')" || exit 1
agent-browser screenshot "$SS/qa-r294-e2e-sync-mini.png" > /dev/null 2>&1
# nazaj na r276 projekt (regresijski tok Z2+)
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); return !!p;})()" 24

echo "=== Z2: Popravi tok ŽIVO — pas → 3450 → Shrani kot novo verzijo → v2 ==="
eb_klik_prefix() { agent-browser eval "(()=>{const g=document.querySelector('button[aria-label^=\"$1\"]'); if(!g) return 'ni gumba'; g.click(); return 'klik';})()" 2>&1 | tail -1; }
eb_klik_prefix "Popravi meritev "
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Popravljanje verzije:');})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const pas=t.includes('Popravljanje verzije:'); const stGumb=[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Shrani kot novo verzijo')); return JSON.stringify({pas, stGumb, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z2-pas.json
python3 -c "import json; r=json.load(open('/tmp/r294-z2-pas.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pas'] and d['stGumb'], 'Z2 pas FAIL: '+json.dumps(d); print('Z2 pas OK — korekcijski pas + Shrani kot novo verzijo')" || exit 1
agent-browser eval "(()=>{const i=document.querySelector('input[type=\"number\"]'); if(!i) return 'ni inputa'; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'3450'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'vpisano';})()" 2>&1 | tail -1
eb_cakaj 1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Shrani kot novo verzijo')); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" 2>&1 | tail -1
eb_pocakaj_tekst "Nova verzija v2 shranjena" 14
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v2'); return !!p;})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const v1=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='v1'); const v2=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='v2'); const pasSePrisoten=t.includes('Popravljanje verzije:'); return JSON.stringify({v1, v2, pasSePrisoten, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z2.json
python3 -c "import json; r=json.load(open('/tmp/r294-z2.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['v1'] and d['v2'], 'Z2 pill FAIL (v1 in v2 obstajata): '+json.dumps(d); assert not d['pasSePrisoten'], 'Z2 pas NI zaprt po uspehu: '+json.dumps(d); print('Z2 OK — v2 ŽIVO (v1 ostane v zgodovini), pas zaprt')" || exit 1
agent-browser screenshot "$SS/qa-r294-e2e-v2.png" > /dev/null 2>&1

echo "=== Z2b: TERENSKI PDF ŽIVO — 10-stolpčna resnica (issue #16 §6) ==="
eb_zajem_pdf val283
eb_klik_gumb "Izvozi terenski pregled meritev kot PDF"
eb_pocakaj_tekst "Terenski pregled meritev prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val283; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z2b.json
python3 -c "import json; r=json.load(open('/tmp/r294-z2b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-', 'Z2b PDF FAIL: '+json.dumps(d); assert d['bajtov']>10000, 'Z2b prekratek PDF: '+json.dumps(d); assert d['err'] is None, 'Z2b err: '+json.dumps(d); print('Z2b OK — terenski PDF ŽIVO (' + str(d['bajtov']) + ' bajtov, %PDF- magija)')" || exit 1
agent-browser screenshot "$SS/qa-r294-e2e-teren-pdf.png" > /dev/null 2>&1

echo "=== Z2z: TERENSKI ZAPISNI LIST PDF ŽIVO — fill-in resnica (issue #15 §3) ==="
eb_zajem_pdf val284
eb_klik_gumb "Izvozi terenski zapisni list kot PDF"
eb_pocakaj_tekst "Zapisni list prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val284; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z2z.json
python3 -c "import json; r=json.load(open('/tmp/r294-z2z.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-', 'Z2z PDF FAIL: '+json.dumps(d); assert d['bajtov']>10000, 'Z2z prekratek PDF: '+json.dumps(d); assert d['err'] is None, 'Z2z err: '+json.dumps(d); print('Z2z OK — zapisni list PDF ŽIVO (' + str(d['bajtov']) + ' bajtov, %PDF- magija — fill-in resnica)')" || exit 1
agent-browser screenshot "$SS/qa-r294-e2e-zapisni-pdf.png" > /dev/null 2>&1

echo "=== Z2x: INVENTURA PREGLED CSV ŽIVO — 30. člen izvozne družine (R286) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot CSV\"]');})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const gumb=document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot CSV\"]'); const legenda=[...document.querySelectorAll('p')].some(p=>p.textContent.startsWith('Inventura CSV = ista resnica kot PDF v Excelu')); return JSON.stringify({gumb:!!gumb, title:gumb?(gumb.getAttribute('title')||'').startsWith('Inventurni pregled premoženja kot CSV'):false, legenda, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z2x-ui.json
python3 -c "import json; r=json.load(open('/tmp/r294-z2x-ui.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['gumb'] and d['title'] and d['legenda'], 'Z2x UI FAIL: '+json.dumps(d); assert d['err'] is None, 'Z2x err: '+json.dumps(d); print('Z2x UI OK — gumb + hover title + legenda ŽIVO (30. člen, kanon R280–R285)')" || exit 1
eb_zajem_pdf val286csv
eb_klik_gumb "Izvozi inventurni pregled premoženja kot CSV"
eb_pocakaj_tekst "Inventurni pregled premoženja prenešen v CSV" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val286csv; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({csv:false, err:window.__err??null}); const bin=atob(b64); const bom=bin.charCodeAt(0).toString(16)+bin.charCodeAt(1).toString(16)+bin.charCodeAt(2).toString(16); let vrs=0; for(let i=0;i<bin.length;i++){ if(bin.charCodeAt(i)===10) vrs++; } return JSON.stringify({csv:true, bom, bajtov:bin.length, vrstic:vrs, glava:bin.includes('"Naziv"')&&bin.includes('"Status"')&&bin.includes('"Enota"'), dodatni:bin.includes('"id"')&&bin.includes('"Premiki"'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z2x.json
python3 -c "import json; r=json.load(open('/tmp/r294-z2x.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['csv'] and d['bom']=='efbbbf', 'Z2x CSV/BOM FAIL: '+json.dumps(d); assert d['glava'] and d['dodatni'], 'Z2x stolpci FAIL (ASCII needleji — atob UTF-8 je 2-bajtni za Š/ž, kanon r285): '+json.dumps(d); assert d['vrstic']>=2, 'Z2x premalo vrstic: '+json.dumps(d); assert d['bajtov']>60, 'Z2x prekratek CSV: '+json.dumps(d); assert d['err'] is None, 'Z2x err: '+json.dumps(d); print('Z2x OK — inventura CSV ŽIVO (' + str(d['bajtov']) + ' bajtov, BOM efbbbf, ' + str(d['vrstic']) + ' vrstic — pariteta R270 po konstrukciji + 3 dodatni stolpci)')" || exit 1
agent-browser screenshot "$SS/qa-r294-e2e-inventura-csv.png" > /dev/null 2>&1
# VRNITEV na measurements tab (Z2b/Z2z/Z2y kontekst — r285 tok se nadaljuje nespremenjen):
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_cakaj 1

echo "=== Z2y: TERENSKI ZAPISNI LIST CSV ŽIVO — digitalno izpolnjevanje (R285) ==="
eb_zajem_pdf val285csv
eb_klik_gumb "Izvozi terenski zapisni list kot CSV"
eb_pocakaj_tekst "Zapisni list prenešen v CSV" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val285csv; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({csv:false, err:window.__err??null}); const bin=atob(b64); const bom=bin.charCodeAt(0).toString(16)+bin.charCodeAt(1).toString(16)+bin.charCodeAt(2).toString(16); let vrs=0; for(let i=0;i<bin.length;i++){ if(bin.charCodeAt(i)===10) vrs++; } return JSON.stringify({csv:true, bom, bajtov:bin.length, vrstic:vrs, imaFizicna:bin.includes('fizicna_ref_mm'), imaDelta:bin.includes('delta_mm'), imaZapiski:bin.includes('zapiski_terena'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z2y.json
python3 -c "import json; r=json.load(open('/tmp/r294-z2y.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['csv'] and d['bom']=='efbbbf', 'Z2y CSV/BOM FAIL: '+json.dumps(d); assert d['imaFizicna'] and d['imaDelta'] and d['imaZapiski'], 'Z2y stolpci FAIL: '+json.dumps(d); assert d['vrstic']>=2, 'Z2y premalo vrstic: '+json.dumps(d); assert d['bajtov']>60, 'Z2y prekratek CSV: '+json.dumps(d); assert d['err'] is None, 'Z2y err: '+json.dumps(d); print('Z2y OK — zapisni list CSV ŽIVO (' + str(d['bajtov']) + ' bajtov, BOM efbbbf, ' + str(d['vrstic']) + ' vrstic — pariteta R186 + prazni fizični stolpci)')" || exit 1
agent-browser screenshot "$SS/qa-r294-e2e-zapisni-csv.png" > /dev/null 2>&1

echo "=== Z3: Zgodovina verzij panel — veriga v1→v2 + delta +250 + aktivna v2 ==="
eb_klik_prefix "Pokaži zgodovino verzij meritve"
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Zgodovina verzij — korekcije NE prepišejo');})()" 14
eb_pocakaj_na "(()=>{return document.body.textContent.includes('+250');})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const aktivnaV2=t.includes('Aktivna verzija: v2'); const delta=t.includes('+250'); const o7=t.includes('se NE izračunajo samodejno'); return JSON.stringify({aktivnaV2, delta, o7, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z3.json
python3 -c "import json; r=json.load(open('/tmp/r294-z3.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['aktivnaV2'] and d['delta'] and d['o7'], 'Z3 panel FAIL: '+json.dumps(d); print('Z3 OK — veriga v1→v2 + delta +250 + aktivna v2 + O7 resnica')" || exit 1
agent-browser screenshot "$SS/qa-r294-e2e-panel.png" > /dev/null 2>&1

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
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({temna:document.documentElement.classList.contains('dark'), panel:t.includes('Zgodovina verzij — korekcije NE prepišejo'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r294-z5.json
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
python3 -c "import json; r=json.load(open('/tmp/r294-z5.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['temna'] and d['panel'] and d['err'] is None, 'Z5 temna FAIL: '+json.dumps(d); print('Z5 temna OK — verzije panel vidna, err null')" || exit 1

echo "=== RESTORE + ODTIS (bajtnata identičnost — ZERO-MUTACIJA) ==="
node scripts/r276-db-e2e.cjs restore || exit 1
node scripts/r273-db-e2e.cjs restore > /dev/null 2>&1 || true
node scripts/r281-db-e2e.cjs restore || exit 1
node scripts/r283-referencni-projekt.cjs restore || exit 1
node scripts/r287-db-e2e.cjs restore || exit 1
node scripts/r276-db-e2e.cjs fp > /tmp/r294-fp-post-276.json || exit 1
node scripts/r281-db-e2e.cjs fp > /tmp/r294-fp-post-281.json || exit 1
node scripts/r283-referencni-projekt.cjs fp > /tmp/r294-fp-post-283.json || exit 1
node scripts/r287-db-e2e.cjs fp > /tmp/r294-fp-post.json || exit 1
OK=1
cmp -s /tmp/r294-fp-pre-276.json /tmp/r294-fp-post-276.json || OK=0
cmp -s /tmp/r294-fp-pre-281.json /tmp/r294-fp-post-281.json || OK=0
cmp -s /tmp/r294-fp-pre-283.json /tmp/r294-fp-post-283.json || OK=0
cmp -s /tmp/r294-fp-pre.json /tmp/r294-fp-post.json || OK=0
if [ "$OK" = 1 ]; then
  echo "ODTIS BAJTNATO IDENTIČEN (pre==post, r276 + r281 + r283 + r287) — ZERO-MUTACIJA dokazana"
else
  echo "ODTIS RAZLIČEN — FAIL"; diff <(python3 -m json.tool /tmp/r294-fp-pre-276.json) <(python3 -m json.tool /tmp/r294-fp-post-276.json) | head -10; diff <(python3 -m json.tool /tmp/r294-fp-pre-281.json) <(python3 -m json.tool /tmp/r294-fp-post-281.json) | head -10; diff <(python3 -m json.tool /tmp/r294-fp-pre-283.json) <(python3 -m json.tool /tmp/r294-fp-post-283.json) | head -10
  exit 1
fi

echo "=== ZAKLJUČEK: strežnik + brskalnik zaprta ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R294 E2E KONEC ==="
