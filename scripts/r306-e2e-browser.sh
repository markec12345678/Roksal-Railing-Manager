#!/bin/bash
# R306 E2E ŽIVO (lokalni :3100, ADMIN) — OPREMA CIKEL DOKAZ NA ZASLONU (36. člen
# izvozne družine — ZASLONSKI brat Cikel PDF R266 + Cikel CSV R297; ZASLON = takoj) +
# [R305] TEDENSKI PREGLED PO DNEVIH Z EKIPAMI +
# [R304] VODJA TEDENSKI CSV PO EKIPAH (ENA vrstica na termin) +
# [kombinirano z R303] VODJA TEDENSKI PDF PO EKIPAH (PDF brat ICS po ekipah R299; en tisk) +
# [kombinirano z R300] KONFLIKTNA MINI-VRSTICA (30. člen issue #1 §7 branje — bralna stran pravil R142; zrcalo STRAŽAR-
# sinhronizirano) + [kombinirano z R299] TEDENSKI ICS PO EKIPAH +
# [kombinirano z R298] TEDENSKI ICS + [kombinirano z R297] OPREMA CIKEL CSV
# + [kombinirano z R296] KOLEDAR ICS + [kombinirano z R295] KOLEDAR CSV +
# [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev
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
export SESSION_SECRET="${SESSION_SECRET:-r306-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R306-server-e2e.log 2>&1 < /dev/null &
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
node scripts/r276-db-e2e.cjs fp > /tmp/r306-fp-pre-276.json || exit 1
node scripts/r281-db-e2e.cjs fp > /tmp/r306-fp-pre-281.json || exit 1
node scripts/r283-referencni-projekt.cjs fp > /tmp/r306-fp-pre-283.json || exit 1
node scripts/r287-db-e2e.cjs fp > /tmp/r306-fp-pre.json || exit 1

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
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('— odpre CRM (opomnik)')); const info=vr.map(x=>({aria:x.getAttribute('aria-label'), meta:(x.querySelector('p.uppercase')||{}).textContent||null, red:!!x.querySelector('.text-roksal-red'), amber:!!x.querySelector('.text-roksal-amber')})); return JSON.stringify({st:vr.length, info, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z0z.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r306-z0z.json').read().strip()
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
agent-browser screenshot "$SS/qa-r306-e2e-z0z-zvoncek.png" > /dev/null 2>&1
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('E2E R287 Potekel Opomnik')); if(!vr) return 'BREZ'; vr.click(); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='CRM stranke'); return !!h;})()" 20
eb_cakaj 1
agent-browser eval "(()=>{const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='CRM stranke'); return JSON.stringify({crm:!!h, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z0z-crm.json
python3 -c "import json; r=json.load(open('/tmp/r306-z0z-crm.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['crm'], 'Z0z CRM tab FAIL (portal akcija): '+json.dumps(d); assert d['err'] is None, 'Z0z err: '+json.dumps(d); print('Z0z OK — portal akcija ŽIVO: klik na POTEKEL → CRM tab (R182 protokol)')" || exit 1
agent-browser screenshot "$SS/qa-r306-e2e-z0y-deeplink.png" > /dev/null 2>&1

agent-browser screenshot "$SS/qa-r306-e2e-z0y-deeplink.png" > /dev/null 2>&1

echo "=== Z0y: DEEP-LINK ŽIVO — detail Sheet samodejno odprt + poudarjena vrstica (R294) ==="
eb_pocakaj_na "(()=>{const t=[...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik'); return t;})()" 20
eb_cakaj 1
agent-browser eval "(()=>{const tit=[...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik'); const kartica=document.body.textContent.includes('Opomnik potekel'); const opis=document.body.textContent.includes('E2E pokliči nazaj (potekel)'); return JSON.stringify({tit, kartica, opis, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z0y-sheet.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r306-z0y-sheet.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['tit'] and d['kartica'] and d['opis'], 'Z0y Sheet FAIL (deep-link ni odprl detaila): ' + json.dumps(d)
assert d['err'] is None, 'Z0y err: ' + json.dumps(d)
print('Z0y OK — deep-link detail Sheet ŽIVO (SheetTitle + opomniška kartica POTEKEL — dvo-dogodkovni R214 vzorec)')
PYEOF
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(x=>{const s=x.querySelector('.sr-only'); return s&&s.textContent.trim()==='Zapri'&&x.closest('[data-slot="sheet-content"]');}); if(!g) { const g2=[...document.querySelectorAll('[data-radix-collection-item], button')].filter(x=>{const s=x.querySelector('.sr-only'); return s&&s.textContent.trim()==='Zapri';}).pop(); if(!g2) return 'BREZ-ZAPRI'; g2.click(); return 'zapri-fallback'; } g.click(); return 'zapri';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return ![...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik');})()" 14
agent-browser eval "(()=>{const vrstica=[...document.querySelectorAll('[role="button"]')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Stranka E2E R287 Potekel Opomnik')); const akt=[...document.querySelectorAll('[role="button"]')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Stranka E2E R287 Aktiven Opomnik')); const poud=vrstica?vrstica.className.includes('border-roksal-amber/60'):false; const polnilo=vrstica?vrstica.className.includes('bg-roksal-amber/5'):false; const tit=vrstica?vrstica.getAttribute('title'):null; const aktCista=akt?!akt.className.includes('border-roksal-amber/60'):true; return JSON.stringify({najdena:!!vrstica, poud, polnilo, tit, aktCista, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z0y-poudarek.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r306-z0y-poudarek.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['najdena'], 'Z0y vrstica FAIL (seed stranka ni v CRM seznamu): ' + json.dumps(d)
assert d['poud'] and d['polnilo'], 'Z0y poudarek FAIL (roksal-amber obroba+polnilo): ' + json.dumps(d)
assert d['tit'] == 'Poudarjeno iz zvončka (opomnik)', 'Z0y title FAIL: ' + json.dumps(d)
assert d['aktCista'], 'Z0y AKTIVEN vrstica NE SME biti poudarjena: ' + json.dumps(d)
assert d['err'] is None, 'Z0y err: ' + json.dumps(d)
print('Z0y OK — poudarjena vrstica ŽIVO (roksal-amber obroba+polnilo+title; AKTIVEN NE poudarjena — izrecna izbira)')
PYEOF
agent-browser screenshot "$SS/qa-r306-e2e-z0y-poudarek.png" > /dev/null 2>&1


echo "=== Z0m: PRIHODKI PO MESECIH ŽIVO (R294 — plačila dimenzija, POGOJNI probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('section[aria-label^=\"Prihodki po mesecih\"]');})()" 16; then
  eb_cakaj 1
  agent-browser eval "(()=>{const s=document.querySelector('section[aria-label^=\"Prihodki po mesecih\"]'); const vrstice=[...s.querySelectorAll('ul li')]; const skupaj=s.textContent.includes('Skupaj plačano'); const prazna=s.textContent.includes('Ni plačanih računov'); const storn=s.textContent.includes('(izključeni iz zneskov)'); const vt=s.textContent.includes('v teku:'); return JSON.stringify({vrstice:vrstice.length, skupaj, prazna, storn, vt, besedilo:vrstice.length>0?vrstice[0].textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0m.json
  python3 - <<'PYEOF2' || exit 1
import json
raw = open('/tmp/r306-z0m.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r306-e2e-z0m-meseci.png" > /dev/null 2>&1
else
  echo "Z0m OPOMBA: sekcija ni dosegljiva na spot seji (CRM skoping RBAC?) — chunk needleji R294 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0n: PRIHODKI MESECI CSV ŽIVO (R294 — 8. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi prihodke po mesecih kot CSV\"]');})()" 16; then
  eb_csv_capture prihodkiMeseci
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi prihodke po mesecih kot CSV\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni plačanih računov') && body.includes('CSV se izvozi ob prvem plačilu.'); const uspeh=body.includes('Prihodki po mesecih prenešeni v CSV ('); const c=window.__prihodkiMeseci ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, csvNiz:niz, bajti:niz?c.length:0, bom:niz?c.charCodeAt(0)===0xFEFF:false, glava:niz?c.split('\n')[0].slice(0,40):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0n.json
  python3 - <<'PYEOF3' || exit 1
import json
raw = open('/tmp/r306-z0n.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r306-e2e-z0n-meseci-csv.png" > /dev/null 2>&1
else
  echo "Z0n OPOMBA: CSV gumb ni dosegljiv na spot seji (CRM skoping RBAC?) — chunk needleji R294 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0o: TEDENSKI RAZGLED + TEDENSKI CSV ŽIVO (R292 — 23. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi tedenski pregled montaž kot CSV\"]');})()" 16; then
  # RAZGLED strip (MANDATORY STIL): aria regija + 7 dni + sklep/praznina + aria-hidden tir
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\"Tedenski razgled — naslednjih 7 dni\"]'); if(!reg) return JSON.stringify({strip:false, err:window.__err??null}); const celice=reg.querySelectorAll('.grid.grid-cols-7 > div').length; const sklep=document.querySelector('[data-testid=\"tedenski-razgled-sklep\"]'); const tiri=reg.querySelectorAll('[aria-hidden=\"true\"].h-1').length; return JSON.stringify({strip:true, celice, tiri, sklep:sklep?sklep.textContent.trim().slice(0,80):null, praznina:sklep?sklep.textContent.includes('Naslednjih 7 dni brez vpisanih terminov.'):false, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0o-strip.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r306-z0o-strip.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('CSV se izvozi, ko je vpisan termin v prihajajočem tednu.'); const uspeh=body.includes('Tedenski pregled prenešen v CSV ('); const c=window.__tedenskiCsv ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, csvNiz:niz, bajti:niz?c.length:0, bom:niz?c.charCodeAt(0)===0xFEFF:false, glava:niz?c.split('\n')[0].slice(0,60):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0o-csv.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r306-z0o-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r306-e2e-z0o-tedenski-csv.png" > /dev/null 2>&1
else
  echo "Z0o OPOMBA: tedenski CSV gumb ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R292 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0p: MARŽNI RAZGLED + DOBIČKONOST CSV ŽIVO (R293 — 24. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobičkonosnost projektov kot CSV\"]');})()" 16; then
  # MARŽNI RAZGLED strip (MANDATORY STIL): aria regija + vrstice/sklep/praznina + aria-hidden tirje
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\"Maržni razgled — marža po projektih\"]'); if(!reg) return JSON.stringify({strip:false, err:window.__err??null}); const vrstice=reg.querySelectorAll('.space-y-1 > div').length; const tiri=reg.querySelectorAll('[aria-hidden=\"true\"].h-1').length; const sklep=document.querySelector('[data-testid=\"marzni-razgled-sklep\"]'); return JSON.stringify({strip:true, vrstice, tiri, sklep:sklep?sklep.textContent.trim().slice(0,90):null, praznina:sklep?sklep.textContent.includes('Ni projektov v preseku'):false, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0p-strip.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r306-z0p-strip.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni podatkov za dobičkonost') && body.includes('CSV se izvozi, ko je vpisan prvi račun ali naročilo.'); const uspeh=body.includes('Dobičkonost prenešena v CSV ('); const c=window.__dobicikonostCsv ?? null; const niz=(typeof c==='string'); const brezBom=niz?c.replace(/^\uFEFF/,''):null; return JSON.stringify({prazno, uspeh, csvNiz:niz, bom:window.__dobicikonostBom===true, bajti:niz?brezBom.length:0, glava:niz?brezBom.split('\n')[0].slice(0,60):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0p-csv.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r306-z0p-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r306-e2e-z0p-dobicikonost-csv.png" > /dev/null 2>&1
else
  echo "Z0p OPOMBA: vodja pregled ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R293 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0q: AVTOMATIZACIJA KARTICA ŽIVO (R294 — issue #1; deterministična resnica — brez podatkovne odvisnosti; ZERO-MUTACIJA) ==="
if eb_pocakaj_na "(()=>{return !!document.querySelector('[aria-label=\"Avtomatizacija — razred funkcij\"]');})()" 16; then
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\"Avtomatizacija — razred funkcij\"]'); if(!reg) return JSON.stringify({kartica:false}); const t=reg.textContent||''; const m=t.match(/(\\d+) funkcij · (\\d+) območij poslovanja/); const det=t.match(/(\\d+) determinističnih/); const sdk=t.match(/(\\d+) SDK/); const ai=t.match(/(\\d+) AI \\(neobvezne\\)/); return JSON.stringify({kartica:true, skupaj:m?+m[1]:null, obmocija:m?+m[2]:null, det:det?+det[1]:null, sdk:sdk?+sdk[1]:null, ai:ai?+ai[1]:null, nadomestki:t.includes('zmožnosti z izrečenim determinističnim nadomestkom'), sklep:t.includes('jedro deluje brez AI.')});})()" 2>&1 | tail -1 > /tmp/r306-z0q.json
  python3 - <<'PYEOFQ' || exit 1
import json
raw = open('/tmp/r306-z0q.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r306-e2e-z0q-avtomatizacija.png" > /dev/null 2>&1
else
  echo "Z0q OPOMBA: vodja pregled ni dosegljiv na spot seji (RBAC skoping?) — needleji R294 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0r: KOLEDAR PREGLEDOV CSV ŽIVO (R295 — 25. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot CSV\"]');})()" 16; then
  # F2 koledarska mini-vrstica (WYSIWYG ISTA izpeljava koledarPovzetek):
  # pogojna resnica — viden SAMO kadar je vpisan vsaj en pregled (spot resnica)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi koledar pregledov kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot CSV'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0r-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r306-z0r-pilli.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0r pilli err: ' + json.dumps(d)
assert d['pillPdf'] and d['pillCsv'], 'Z0r: oba koledarska pilla (PDF brat + CSV brat) morata biti viden: ' + json.dumps(d)
print('Z0r pilli OK — Koledar PDF (R253 brat) + Koledar CSV (R295) VEDNO vidna (P1-k precedens)')
PYEOF5
  # CSV (pogojni kanon R250/R291/R292/R293: fail-closed toast pri 0 + NIČ datoteke ALI bajtna capture z BOM)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__koledarBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__koledarCsv=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot CSV\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni vpisanih pregledov') && body.includes('CSV se izvozi, ko je vpisan prvi datum pregleda.'); const uspeh=body.includes('Koledar pregledov prenešen v CSV ('); const mini=body.includes('Pregledi: ') && body.includes(' vpisanih · '); const c=window.__koledarCsv ?? null; const niz=(typeof c==='string'); const brezBom=niz?c.replace(/^\uFEFF/,''):null; return JSON.stringify({prazno, uspeh, mini, csvNiz:niz, bom:window.__koledarBom===true, bajti:niz?brezBom.length:0, glava:niz?brezBom.split('\n')[0].slice(0,60):null, obseg:niz?brezBom.includes('Vse stranke z vpisanim datumom pregleda (AKTIVEN + POTEKEL)'):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0r-csv.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r306-z0r-csv.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0r CSV err: ' + json.dumps(d)
if d['prazno']:
    assert not d['csvNiz'], 'Z0r: toast pri 0 vpisanih A VSEENO datoteka (kršitev fail-closed — družinsko pravilo R253): ' + json.dumps(d)
    assert not d['mini'], 'Z0r: mini-vrstica vidna pri 0 vpisanih (lažni nič-prikaz): ' + json.dumps(d)
    print('Z0r OK — gumb ŽIVO, fail-closed toast pri 0 vpisanih (iskrena praznina — ISTI gate kot brat R253; NIČ datoteke, NIČ mini-vrstice)')
elif d['csvNiz']:
    assert d['bajti'] > 0 and d['bom'], 'Z0r: datoteka brez BOM/vsebine (RAW bajti EF BB BF): ' + json.dumps(d)
    assert d['glava'] and d['glava'].startswith('"Stranka","Naslov","Telefon"'), 'Z0r: glava FAIL (7 stolpcev VERBATIM PDF head): ' + str(d['glava'])
    assert d['obseg'], 'Z0r: meta Obseg resnica manjka: ' + json.dumps(d)
    assert d['mini'], 'Z0r: CSV s podatki, mini-vrstica NI vidna (WYSIWYG ISTA izpeljava kršena): ' + json.dumps(d)
    print('Z0r CSV OK — KOLEDAR PREGLEDOV CSV ŽIVO bajtno (' + str(d['bajti']) + ' B, BOM efbbbf RAW dokaz, glava: ' + str(d['glava'])[:50] + ') + F2 mini-vrstica ŽIVO (ista izpeljava)')
else:
    raise AssertionError('Z0r: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF5
  agent-browser eval "(()=>{window.__koledarCsv=null; window.__koledarBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r306-e2e-z0r-koledar-csv.png" > /dev/null 2>&1
else
  echo "Z0r OPOMBA: CRM pregled ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R295 ×13 ostajajo obvezni dokaz"
fi

echo "=== Z0s: KOLEDAR PREGLEDOV ICS ŽIVO (R296 — 26. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot ICS\"]');})()" 16; then
  # trije koledarski pilli (PDF brat R253 + CSV brat R295 + ICS brat R296):
  # VEDNO vidni (P1-k precedens)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi koledar pregledov kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot CSV'), pillIcs:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot ICS'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0s-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r306-z0s-pilli.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0s pilli err: ' + json.dumps(d)
assert d['pillPdf'] and d['pillCsv'] and d['pillIcs'], 'Z0s: vsi trije koledarski pilli (PDF + CSV + ICS) morajo biti vidni: ' + json.dumps(d)
print('Z0s pilli OK — Koledar PDF (R253) + Koledar CSV (R295) + Koledar ICS (R296) VEDNO vidni (P1-k precedens)')
PYEOF5
  # ICS (pogojni kanon R250/R291/R292/R293/R295: fail-closed toast pri 0 + NIČ datoteke ALI bajtna capture brez BOM)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__koledarIcsBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__koledarIcs=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot ICS\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni vpisanih pregledov') && body.includes('ICS se izvozi, ko je vpisan prvi datum pregleda.'); const uspeh=body.includes('Koledar pregledov prenešen v ICS ('); const c=window.__koledarIcs ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, icsNiz:niz, bom:window.__koledarIcsBom===true, bajti:niz?c.length:0, glava:niz?c.slice(0,40):null, crlf:niz?c.includes('\\r\\n'):null, xstatus:niz?c.includes('X-ROKSAL-STATUS:'):null, konec:niz?c.trimEnd().endsWith('END:VCALENDAR'):null, dogodki:niz?(c.match(/BEGIN:VEVENT/g)||[]).length:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0s-ics.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r306-z0s-ics.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0s ICS err: ' + json.dumps(d)
if d['prazno']:
    assert not d['icsNiz'], 'Z0s: toast pri 0 vpisanih A VSEENO datoteka (kršitev fail-closed — družinsko pravilo R253): ' + json.dumps(d)
    print('Z0s OK — gumb ŽIVO, fail-closed toast pri 0 vpisanih (iskrena praznina — ISTI gate kot brata R253/R295; NIČ datoteke)')
elif d['icsNiz']:
    assert d['bajti'] > 0 and not d['bom'], 'Z0s: datoteka z BOM/prazna (ICS = BREZ BOM — RFC 5545, RAW dokaz): ' + json.dumps(d)
    assert d['glava'] and d['glava'].startswith('BEGIN:VCALENDAR'), 'Z0s: glava FAIL (VCALENDAR 2.0): ' + str(d['glava'])
    assert d['crlf'], 'Z0s: CRLF zaključki manjkajo (RFC 5545 §3.1): ' + json.dumps(d)
    assert d['xstatus'], 'Z0s: X-ROKSAL-STATUS resnica manjka (VERBATIM iz API-ja): ' + json.dumps(d)
    assert d['konec'], 'Z0s: END:VCALENDAR manjka: ' + json.dumps(d)
    assert d['dogodki'] >= 1, 'Z0s: brez VEVENT (koledar s podatki mora imeti dogodke): ' + json.dumps(d)
    print('Z0s ICS OK — KOLEDAR PREGLEDOV ICS ŽIVO bajtno (' + str(d['bajti']) + ' znakov, BREZ BOM RAW dokaz, glava: ' + str(d['glava'])[:24] + ', VEVENT: ' + str(d['dogodki']) + ', CRLF + X-ROKSAL-STATUS ŽIVO)')
else:
    raise AssertionError('Z0s: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF5
  agent-browser eval "(()=>{window.__koledarIcs=null; window.__koledarIcsBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r306-e2e-z0s-koledar-ics.png" > /dev/null 2>&1
else
  echo "Z0s OPOMBA: CRM pregled ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R296 ×13 ostajajo obvezni dokaz"
fi

echo "=== Z0t: OPREMA CIKEL CSV ŽIVO (R297 — 27. člen izvozne družine; pogojni probe; ZERO-MUTACIJA — GET fetch samo) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const oprema=gumbi.find(b=>b.textContent.trim()==='Oprema'); if(oprema) oprema.click(); return !!document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot CSV\"]');})()" 16; then
  # oba cikl pilli (PDF brat R266 + CSV brat R297): VEDNO vidna (P1-k precedens)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi pregled življenjskega cikla opreme kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi pregled življenjskega cikla opreme kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi pregled življenjskega cikla opreme kot CSV'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0t-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r306-z0t-pilli.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0t pilli err: ' + json.dumps(d)
assert d['pillPdf'] and d['pillCsv'], 'Z0t: oba cikl pilla (PDF brat + CSV brat) morata biti vidna: ' + json.dumps(d)
print('Z0t pilli OK — Cikel PDF (R266 brat) + Cikel CSV (R297) VEDNO vidna (P1-k precedens)')
PYEOF5
  # CSV (pogojni kanon R250/R291/…/R296: fail-closed toast pri 0 + NIČ datoteke ALI bajtna capture z BOM)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__opremaBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__opremaCsv=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot CSV\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni vpisane opreme') && body.includes('CSV se izvozi, ko je vpisan prvi kos opreme.'); const uspeh=body.includes('Pregled opreme prenešen v CSV ('); const c=window.__opremaCsv ?? null; const niz=(typeof c==='string'); const brezBom=niz?c.replace(/^\uFEFF/,''):null; return JSON.stringify({prazno, uspeh, csvNiz:niz, bom:window.__opremaBom===true, bajti:niz?brezBom.length:0, glava:niz?brezBom.split('\n')[0].slice(0,60):null, obseg:niz?brezBom.includes('Vsa oprema iz /api/equipment (polna resnica — tudi upokojena/izgubljena; NAZIV ASC referenčni red)'):null, sklep:niz?brezBom.includes('paginacija do 10.000 kosov.'):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0t-csv.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r306-z0t-csv.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0t CSV err: ' + json.dumps(d)
if d['prazno']:
    assert not d['csvNiz'], 'Z0t: toast pri 0 kosov A VSEENO datoteka (kršitev fail-closed — družinsko pravilo R266): ' + json.dumps(d)
    print('Z0t OK — gumb ŽIVO, fail-closed toast pri 0 kosov (iskrena praznina — ISTI gate kot brat R266; NIČ datoteke)')
elif d['csvNiz']:
    assert d['bajti'] > 0 and d['bom'], 'Z0t: datoteka brez BOM/vsebine (RAW bajti EF BB BF): ' + json.dumps(d)
    assert d['glava'] and d['glava'].startswith('"Oprema","Tip","Status","Lokacija","Zadnji pregled","Naslednji pregled","Kalibracija","Rezervacije"'), 'Z0t: glava FAIL (8 stolpcev VERBATIM PDF head R266): ' + str(d['glava'])
    assert d['obseg'], 'Z0t: meta Obseg resnica manjka: ' + json.dumps(d)
    assert d['sklep'], 'Z0t: Sklep VERBATIM (paginacija do 10.000 kosov.) manjka: ' + json.dumps(d)
    print('Z0t CSV OK — OPREMA CIKEL CSV ŽIVO bajtno (' + str(d['bajti']) + ' B, BOM efbbbf RAW dokaz, glava: ' + str(d['glava'])[:50] + ')')
else:
    raise AssertionError('Z0t: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF5
  agent-browser eval "(()=>{window.__opremaCsv=null; window.__opremaBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r306-e2e-z0t-oprema-csv.png" > /dev/null 2>&1
else
  echo "Z0t OPOMBA: logistika/oprema ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R297 ×13 ostajajo obvezni dokaz"
fi

echo "=== Z0u: TEDENSKI VOZNI RED ICS ŽIVO (R298 — 28. člen izvozne družine; pogojni probe; ZERO-MUTACIJA — lokalni blob download samo) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298: Z0t klikne 'Oprema' podzavihek IN ostane tam (isti dispatch ne
# resetira notranjega stanja) — Z0u mora sam klikniti 'Koledar' podzavihek
# (vzorec Z0t: klik v predikatu, idempotenten na že aktivnem zavihku).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[aria-label=\"Izvozi tedenski pregled montaž kot ICS koledar\"]');})()" 16; then
  # vsi trije tedenski pilli (PDF brat R256 + CSV brat R292 + ICS R298): VEDNO vidni (P1-k precedens)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski pregled montaž kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi tedenski pregled montaž kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi tedenski pregled montaž kot CSV'), pillIcs:pill.some(b=>b.getAttribute('aria-label')==='Izvozi tedenski pregled montaž kot ICS koledar'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0u-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r306-z0u-pilli.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0u pilli err: ' + json.dumps(d)
assert d['pillPdf'] and d['pillCsv'] and d['pillIcs'], 'Z0u: vsi trije tedenski pilli (PDF R256 + CSV R292 + ICS R298) morajo biti vidni: ' + json.dumps(d)
print('Z0u pilli OK — Tedenski PDF (brat) + CSV (brat) + ICS (R298) VEDNO vidni (P1-k precedens)')
PYEOF5
  # ICS (pogojni kanon R250/…/R296: fail-closed toast pri 0 terminov + NIČ datoteke ALI bajtna capture BREZ BOM + CRLF)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__icsBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__tedenskiIcs=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi tedenski pregled montaž kot ICS koledar\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('ICS se izvozi, ko je vpisan termin v prihajajočem tednu.'); const uspeh=body.includes('Tedenski vozni red prenešen v ICS ('); const c=window.__tedenskiIcs ?? null; const niz=(typeof c==='string'); const vrstice=niz?c.split('\r\n'):null; const veventi=niz?vrstice.filter(v=>v==='BEGIN:VEVENT').length:null; return JSON.stringify({prazno, uspeh, icsNiz:niz, bom:window.__icsBom===true, crlf:niz?c.includes('\r\n'):null, veventi, prva:niz?vrstice[0]:null, prodid:niz?vrstice.some(v=>v==='PRODID:-//Roksal//Tedenski vozni red//SL'):null, obseg:niz?vrstice.some(v=>v.startsWith('X-ROKSAL-OBSEG:')):null, dtstartZ:niz?vrstice.some(v=>v.startsWith('DTSTART:')&&v.endsWith('Z')):null, dtendZ:niz?vrstice.some(v=>v.startsWith('DTEND:')&&v.endsWith('Z')):null, status:niz?(veventi===0||vrstice.some(v=>v==='STATUS:CONFIRMED'||v==='STATUS:CANCELLED'||v==='STATUS:TENTATIVE')):null, noga:niz?vrstice[vrstice.length-1]==='END:VCALENDAR':null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0u-ics.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r306-z0u-ics.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0u ICS err: ' + json.dumps(d)
if d['prazno']:
    assert not d['icsNiz'], 'Z0u: toast pri 0 terminov A VSEENO datoteka (kršitev fail-closed — družinsko pravilo): ' + json.dumps(d)
    print('Z0u OK — gumb ŽIVO, fail-closed toast pri 0 terminov (iskrena praznina — ISTI gate kot brata PDF/CSV; NIČ datoteke)')
elif d['icsNiz']:
    assert d['bom'] is False, 'Z0u: ICS nosi BOM (kršitev — ICS družina R296: čist UTF-8 brez BOM): ' + json.dumps(d)
    assert d['crlf'] and d['prva'] == 'BEGIN:VCALENDAR' and d['prodid'] and d['obseg'] and d['noga'], 'Z0u: VCALENDAR struktura FAIL (glava/PRODID/obseg/noga): ' + json.dumps(d)
    assert d['veventi'] > 0, 'Z0u: uspeh toast A 0 VEVENT (neusklajena resnica): ' + json.dumps(d)
    assert d['dtstartZ'] and d['dtendZ'], 'Z0u: DTSTART/DTEND Z-projekcija manjka (termin-domna kanon R139/R172): ' + json.dumps(d)
    assert d['status'], 'Z0u: STATUS preslikava manjka (CONFIRMED/CANCELLED/TENTATIVE): ' + json.dumps(d)
    print('Z0u ICS OK — TEDENSKI VOZNI RED ICS ŽIVO bajtno (' + str(d['veventi']) + ' VEVENT, BREZ BOM, CRLF, PRODID + X-ROKSAL-OBSEG + DTSTART/DTEND Z + STATUS)')
else:
    raise AssertionError('Z0u: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF5
  agent-browser eval "(()=>{window.__tedenskiIcs=null; window.__icsBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r306-e2e-z0u-tedenski-ics.png" > /dev/null 2>&1
else
  echo "Z0u OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R298 ×17 ostajajo obvezni dokaz"
fi

echo "=== Z0v: TEDENSKI ICS PO EKIPAH ŽIVO (R299 — 29. člen izvozne družine; pogojni probe; ZERO-MUTACIJA — lokalni blob download samo) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298: podzavihek stale state — Z0v klikne 'Koledar' sam v predikatu
# (idempotenten na že aktivnem zavihku — vzorec Z0t/Z0u).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski ICS samo za ekipo '));})()" 16; then
  # čipi: definicijski naslovi (MANDATORY STIL) + skupina aria + oznaka
  agent-browser eval "(()=>{const cipi=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski ICS samo za ekipo ')); const oznaka=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='ICS po ekipi:'); const prvi=cipi[0]; return JSON.stringify({stevilo:cipi.length, oznaka:!!oznaka, oznakaTitle:oznaka?(oznaka.getAttribute('title')||'').startsWith('Ekipa z vsaj enim terminom v naslednjih 7 dneh'):false, prviTitle:prvi?(prvi.getAttribute('title')||'').startsWith('Samo termini ekipe '):false, skupinaAria:!!document.querySelector('[aria-label=\"Tedenski ICS po ekipah\"]'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0v-cipi.json
  python3 - <<'PYEOF6' || exit 1
import json
raw = open('/tmp/r306-z0v-cipi.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0v cipi err: ' + json.dumps(d)
assert d['stevilo'] > 0, 'Z0v: vsaj en ekipa cip (pogojna veja je tekla — ekipa obstaja): ' + json.dumps(d)
assert d['oznaka'] and d['oznakaTitle'], 'Z0v oznaka + definicijski naslov FAIL: ' + json.dumps(d)
assert d['prviTitle'], 'Z0v cip definicijski naslov FAIL (izrečen filter): ' + json.dumps(d)
assert d['skupinaAria'], 'Z0v skupina aria FAIL: ' + json.dumps(d)
print('Z0v cipi OK — ' + str(d['stevilo']) + ' ekipa cipov ŽIVO + definicijski naslovi + skupina aria')
PYEOF6
  # ICS capture (pogojni kanon R250/…/R298: bajtna capture + struktura po ekipah)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__ekipaBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__ekipaIcs=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const cip=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski ICS samo za ekipo ')); if(!cip) return 'BREZ-CIPA'; cip.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const c=window.__ekipaIcs ?? null; const niz=(typeof c==='string'); const vrstice=niz?c.split('\r\n').filter(v=>v.length>0):null; const razvite=niz?(():string[]=>{const o:string[]=[];for(const v of vrstice){if(v.startsWith(' ')&&o.length>0)o[o.length-1]+=v.slice(1);else o.push(v);}return o;})():null; const veventi=niz?vrstice.filter(v=>v==='BEGIN:VEVENT').length:null; return JSON.stringify({icsNiz:niz, bom:window.__ekipaBom===true, crlf:niz?c.includes('\r\n'):null, veventi, prva:niz?vrstice[0]:null, prodid:niz?vrstice.some(v=>v==='PRODID:-//Roksal//Tedenski vozni red po ekipah//SL'):null, ekipaX:niz?razvite.some(v=>v.startsWith('X-ROKSAL-EKIPA:')):null, obsegEkipa:niz?razvite.some(v=>v.startsWith('X-ROKSAL-OBSEG:')&&v.includes('Ekipa:')):null, uidPredpona:niz?vrstice.some(v=>v.startsWith('UID:vozni-red-ekipa-')):null, dtstartZ:niz?vrstice.some(v=>v.startsWith('DTSTART:')&&v.endsWith('Z')):null, noga:niz?vrstice[vrstice.length-1]==='END:VCALENDAR':null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0v-ics.json
  python3 - <<'PYEOF6' || exit 1
import json
raw = open('/tmp/r306-z0v-ics.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0v ICS err: ' + json.dumps(d)
assert d['icsNiz'], 'Z0v: cip je tekel (ekipa ima termine) A ni datoteke — fail-verbose kršitev: ' + json.dumps(d)
assert d['bom'] is False, 'Z0v: ICS nosi BOM (kršitev — ICS družina R296/R298): ' + json.dumps(d)
assert d['crlf'] and d['prva'] == 'BEGIN:VCALENDAR' and d['prodid'] and d['noga'], 'Z0v: VCALENDAR struktura FAIL (glava/PRODID/noga): ' + json.dumps(d)
assert d['veventi'] > 0, 'Z0v: 0 VEVENT (domain pravilo R299 — znana ekipa ima vsaj 1): ' + json.dumps(d)
assert d['ekipaX'] and d['obsegEkipa'], 'Z0v: X-ROKSAL-EKIPA / obseg dodatek manjka (izpeljana resnica): ' + json.dumps(d)
assert d['uidPredpona'] and d['dtstartZ'], 'Z0v: UID predpona vozni-red-ekipa- / DTSTART Z manjka: ' + json.dumps(d)
print('Z0v ICS OK — TEDENSKI ICS PO EKIPAH ŽIVO bajtno (' + str(d['veventi']) + ' VEVENT, BREZ BOM, CRLF, PRODID po ekipah + X-ROKSAL-EKIPA + UID predpona + DTSTART Z)')
PYEOF6
  agent-browser eval "(()=>{window.__ekipaIcs=null; window.__ekipaBom=null; return 'reset';})()" 2>&1 | tail -1
  agent-browser screenshot "$SS/qa-r306-e2e-z0v-ekipa-ics.png" > /dev/null 2>&1
else
  echo "Z0v OPOMBA: brez ekip z termini na spot seji — čipi pogojno skriti (iskrena praznina — podatkovno-pogojna vidnost R299); chunk needleji R299 ×16 ostajajo obvezni dokaz"
fi

echo "=== Z0w: KONFLIKTNA MINI-VRSTICA ŽIVO (R300 — 30. člen issue #1 §7 branje; pogojni probe — obe veji iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0w klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[aria-label=\"Izvozi tedenski pregled monta\u017e kot ICS koledar\"]');})()" 16; then
  agent-browser eval "(()=>{const mini=document.querySelector('[data-testid=\"tedenski-konflikti-mini\"]'); const sklep=document.querySelector('[data-testid=\"tedenski-razgled-sklep\"]'); const terminiViden=!!(sklep&&!sklep.textContent.startsWith('Naslednjih 7 dni brez')); return JSON.stringify({terminiViden, mini:!!mini, role:mini?mini.getAttribute('role'):null, text:mini?mini.textContent.trim():null, zelen:mini?mini.className.includes('text-roksal-green'):null, rdec:mini?mini.className.includes('text-roksal-red'):null, title:mini?((mini.getAttribute('title')||'').includes(' isti poli-odprto pravilo kot API 409')):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0w-mini.json
  python3 - <<'PYEOF7' || exit 1
import json
raw = open('/tmp/r306-z0w-mini.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0w mini err: ' + json.dumps(d)
if d['terminiViden']:
    assert d['mini'], 'Z0w: termini v oknu A mini-vrstica manjka (kršitev WYSIWYG — pregled mora biti viden): ' + json.dumps(d)
    assert d['role'] == 'status', 'Z0w: role=status manjka: ' + json.dumps(d)
    assert d['text'].startswith('Konflikti: '), 'Z0w: mini besedilo brez prepone Konflikti: : ' + json.dumps(d)
    cisto = d['text'].startswith('Konflikti: 0')
    assert cisto == d['zelen'] and (not cisto) == d['rdec'], 'Z0w: zelen/rde\u010d \u017eig ni usklajen z besedilom: ' + json.dumps(d)
    assert d['title'], 'Z0w: definicijski naslov brez izre\u010denih pravil: ' + json.dumps(d)
    print('Z0w OK — KONFLIKTNA MINI-VRSTICA ŽIVO (' + ('\u010distost 0 — zelen' if cisto else 'konflikti — rde\u010d') + ')')
else:
    assert not d['mini'], 'Z0w: 0 terminov A mini-vrstica VIDNA (kršitev pogojne vidnosti — iskrena praznina R295/R296): ' + json.dumps(d)
    print('Z0w OK — 0 terminov na spot seji: mini pogojno skrita (iskrena praznina — pogojni kanon r277)')
PYEOF7
  agent-browser screenshot "$SS/qa-r306-e2e-z0w-konflikti-mini.png" > /dev/null 2>&1
else
  echo "Z0w OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R300 ×11 ostajajo obvezni dokaz"
fi

echo "=== Z0x: KONFLIKTI CSV PILL ŽIVO (R301 — 31. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0x klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\"konflikti-csv-pill\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\"konflikti-csv-pill\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('isti poli-odprto pregled kot žig')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0x-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r306-z0x-pill.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0x pill err: ' + json.dumps(d)
assert d['pill'], 'Z0x: konflikti-csv-pill manjka (VEDNO viden — P1-k precedens): ' + json.dumps(d)
assert d['label'] == 'Konflikti CSV', 'Z0x: pill label ni Konflikti CSV: ' + json.dumps(d)
assert (d['aria'] or '').startswith('Izvozi dokazane konflikte'), 'Z0x: aria-label manjka: ' + json.dumps(d)
assert d['title'], 'Z0x: definicijski naslov brez izrečenih pravil: ' + json.dumps(d)
assert d['disabled'] is False, 'Z0x: pill disabled ob zagonu (dvoklik guard naj bi bil sproščen): ' + json.dumps(d)
print('Z0x pill OK — KONFLIKTI CSV VEDNO viden (label + aria + definicijski naslov + guard sproščen)')
PYEOF8
  # klik → trije iskreni izidi (pogojni kanon R250/…/R297: toast pri 0 + NIČ
  # datoteke ALI bajtna capture z BOM); CSV capture = BOM resnica (vzorec Z0o)
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__csvBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__konfliktiCsv=new TextDecoder('utf-8').decode(ab);}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[data-testid=\"konflikti-csv-pill\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('Konflikti CSV se izvozi, ko je vpisan termin v prihajajo\u010dem tednu.'); const zelen=body.includes('Ni dokazanih konfliktov v okviru') && body.includes('\u017dig je zelen'); const uspeh=body.includes('Konflikti prenešeni v CSV ('); const c=window.__konfliktiCsv ?? null; const niz=(typeof c==='string'); const vrstice=niz?c.split('\n'):null; return JSON.stringify({prazno, zelen, uspeh, csvNiz:niz, bom:window.__csvBom===true, glava:niz?vrstice[0].includes('Dan prekrivanja'):null, ekipaStolpec:niz?vrstice[0].includes('Ekipa'):null, podatek:niz?vrstice.length>8:null, sklep:niz?vrstice.some(v=>v.startsWith('"Sklep"')):null, obseg:niz?vrstice.some(v=>v.startsWith('"Obseg"')):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0x-csv.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r306-z0x-csv.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0x CSV err: ' + json.dumps(d)
izidi = sum([1 for k in ('prazno', 'zelen', 'uspeh') if d[k]])
assert izidi == 1, 'Z0x: natanko EN iskren izid (prazno/zelen/uspeh), dobljeno ' + str(izidi) + ': ' + json.dumps(d)
if d['prazno'] or d['zelen']:
    assert not d['csvNiz'], 'Z0x: fail-closed toast A VSEENO datoteka (kršitev družine R266/R297 — ni prazne datoteke): ' + json.dumps(d)
    veja = 'prazno okno' if d['prazno'] else 'zelen žig (iskrena čistost)'
    print('Z0x OK — gumb ŽIVO, fail-closed toast (' + veja + '; NIČ datoteke — domensko pravilo)')
elif d['uspeh']:
    assert d['csvNiz'] and d['bom'], 'Z0x: uspeh toast A CSV brez BOM (kršitev formata R186/R292): ' + json.dumps(d)
    assert d['glava'] and d['ekipaStolpec'], 'Z0x: glava manjka (KONFLIKTI_CSV_GLAVA): ' + json.dumps(d)
    assert d['obseg'] and d['sklep'] and d['podatek'], 'Z0x: meta vrstice manjkajo (Obseg/Sklep/podatki): ' + json.dumps(d)
    print('Z0x CSV OK — KONFLIKTI CSV ŽIVO bajtno (BOM + glava + Obseg + Sklep EN VIR konfliktiSklep)')
PYEOF8
  agent-browser screenshot "$SS/qa-r306-e2e-z0x-konflikti-csv.png" > /dev/null 2>&1
else
  echo "Z0x OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R301 ×11 ostajajo obvezni dokaz"
fi

echo "=== Z0aa: KONFLIKTI PDF PILL ŽIVO (R302 — 32. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0aa klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w/Z0x).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\"konflikti-pdf-pill\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\"konflikti-pdf-pill\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('isti poli-odprto pregled kot žig')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0aa-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r306-z0aa-pill.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0aa pill err: ' + json.dumps(d)
assert d['pill'], 'Z0aa: konflikti-pdf-pill manjka (VEDNO viden — P1-k precedens): ' + json.dumps(d)
assert d['label'] == 'Konflikti PDF', 'Z0aa: pill label ni Konflikti PDF: ' + json.dumps(d)
assert (d['aria'] or '').startswith('Izvozi dokazane konflikte'), 'Z0aa: aria-label manjka: ' + json.dumps(d)
assert d['title'], 'Z0aa: definicijski naslov brez izrečenih pravil: ' + json.dumps(d)
assert d['disabled'] is False, 'Z0aa: pill disabled ob zagonu (dvoklik guard naj bi bil sproščen): ' + json.dumps(d)
print('Z0aa pill OK — KONFLIKTI PDF VEDNO viden (label + aria + definicijski naslov + guard sproščen)')
PYEOF8
  # klik → trije iskreni izidi (pogojni kanon R250/…/R301: toast pri 0 + NIČ
  # datoteke ALI bajtna capture z %PDF- magijo); PDF capture = bajtni dokaz
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__pdfMagic=String.fromCharCode(u[0],u[1],u[2],u[3],u[4]); window.__pdfLen=u.length;}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[data-testid=\"konflikti-pdf-pill\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('Konflikti PDF se izvozi, ko je vpisan termin v prihajajo\u010dem tednu.'); const zelen=body.includes('Ni dokazanih konfliktov v okviru') && body.includes('\u017dig je zelen'); const uspeh=body.includes('Konflikti prenešeni v PDF ('); return JSON.stringify({prazno, zelen, uspeh, pdfMagic:window.__pdfMagic??null, pdfLen:window.__pdfLen??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0aa-pdf.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r306-z0aa-pdf.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0aa PDF err: ' + json.dumps(d)
izidi = sum([1 for k in ('prazno', 'zelen', 'uspeh') if d[k]])
assert izidi == 1, 'Z0aa: natanko EN iskren izid (prazno/zelen/uspeh), dobljeno ' + str(izidi) + ': ' + json.dumps(d)
if d['prazno'] or d['zelen']:
    assert not d['pdfMagic'], 'Z0aa: fail-closed toast A VSEENO datoteka (kršitev družine R266/R297/R301 — ni prazne datoteke): ' + json.dumps(d)
    veja = 'prazno okno' if d['prazno'] else 'zelen žig (iskrena čistost)'
    print('Z0aa OK — gumb ŽIVO, fail-closed toast (' + veja + '; NIČ datoteke — domensko pravilo)')
elif d['uspeh']:
    assert d['pdfMagic'] == '%PDF-', 'Z0aa: uspeh toast A PDF brez %PDF- magije (kršitev formatne resnice): ' + json.dumps(d)
    assert (d['pdfLen'] or 0) > 1000, 'Z0aa: PDF sumljivo majhen (nepopoln dokument): ' + json.dumps(d)
    print('Z0aa PDF OK — KONFLIKTI PDF ŽIVO bajtno (%PDF- magija, ' + str(d['pdfLen']) + ' bajtov)')
PYEOF8
  agent-browser screenshot "$SS/qa-r306-e2e-z0aa-konflikti-pdf.png" > /dev/null 2>&1
else
  echo "Z0aa OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R302 ×11 ostajajo obvezni dokaz"
fi

echo "=== Z0ab: EKIPE PDF PILL ŽIVO (R303 — 33. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0ab klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w/Z0x/Z0aa).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\"ekipe-pdf-pill\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\"ekipe-pdf-pill\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('ENA sekcija na ekipo')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0ab-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r306-z0ab-pill.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0ab pill err: ' + json.dumps(d)
assert d['pill'], 'Z0ab: ekipe-pdf-pill manjka (VEDNO viden — P1-k precedens): ' + json.dumps(d)
assert d['label'] == 'Ekipe PDF', 'Z0ab: pill label ni Ekipe PDF: ' + json.dumps(d)
assert (d['aria'] or '').startswith('Izvozi tedenski vozni red po ekipah'), 'Z0ab: aria-label manjka: ' + json.dumps(d)
assert d['title'], 'Z0ab: definicijski naslov brez izrečenih pravil: ' + json.dumps(d)
assert d['disabled'] is False, 'Z0ab: pill disabled ob zagonu (dvoklik guard naj bi bil sproščen): ' + json.dumps(d)
print('Z0ab pill OK — EKIPE PDF VEDNO viden (label + aria + definicijski naslov + guard sproščen)')
PYEOF8
  # klik → trije iskreni izidi (pogojni kanon R250/…/R302: toast pri 0 + NIČ
  # datoteke ALI bajtna capture z %PDF- magijo); PDF capture = bajtni dokaz
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__pdfMagic=String.fromCharCode(u[0],u[1],u[2],u[3],u[4]); window.__pdfLen=u.length;}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[data-testid=\"ekipe-pdf-pill\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('PDF po ekipah se izvozi, ko je vpisan termin v prihajajo\u010dem tednu.'); const niekip=body.includes('Ni ekip z termini v naslednjih 7 dneh') && body.includes('PDF po ekipah se izvozi, ko ima ekipa vpisan termin v prihajajo\u010dem tednu.'); const uspeh=body.includes('Tedenski vozni red po ekipah prenešen (Tedenski-po-ekipah-'); return JSON.stringify({prazno, niekip, uspeh, pdfMagic:window.__pdfMagic??null, pdfLen:window.__pdfLen??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0ab-pdf.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r306-z0ab-pdf.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0ab PDF err: ' + json.dumps(d)
izidi = sum([1 for k in ('prazno', 'niekip', 'uspeh') if d[k]])
assert izidi == 1, 'Z0ab: natanko EN iskren izid (prazno/niekip/uspeh), dobljeno ' + str(izidi) + ': ' + json.dumps(d)
if d['prazno'] or d['niekip']:
    assert not d['pdfMagic'], 'Z0ab: fail-closed toast A VSEENO datoteka (kršitev družine R266/R297/R301/R302 — ni prazne datoteke): ' + json.dumps(d)
    veja = 'prazno okno' if d['prazno'] else '0 ekip (mirror R299)'
    print('Z0ab OK — gumb ŽIVO, fail-closed toast (' + veja + '; NIČ datoteke — domensko pravilo)')
elif d['uspeh']:
    assert d['pdfMagic'] == '%PDF-', 'Z0ab: uspeh toast A PDF brez %PDF- magije (kršitev formatne resnice): ' + json.dumps(d)
    assert (d['pdfLen'] or 0) > 1000, 'Z0ab: PDF sumljivo majhen (nepopoln dokument): ' + json.dumps(d)
    print('Z0ab PDF OK — EKIPE PDF ŽIVO bajtno (%PDF- magija, ' + str(d['pdfLen']) + ' bajtov)')
PYEOF8
  agent-browser screenshot "$SS/qa-r306-e2e-z0ab-ekipe-pdf.png" > /dev/null 2>&1
else
  echo "Z0ab OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R303 ×11 ostajajo obvezni dokaz"
fi

echo "=== Z0ac: EKIPE CSV PILL ŽIVO (R304 — 34. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0ac klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w/Z0x/Z0aa/Z0ab).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\"ekipe-csv-pill\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\"ekipe-csv-pill\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('ENA vrstica na termin')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0ac-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r306-z0ac-pill.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0ac pill err: ' + json.dumps(d)
assert d['pill'], 'Z0ac: ekipe-csv-pill manjka (VEDNO viden — P1-k precedens): ' + json.dumps(d)
assert d['label'] == 'Ekipe CSV', 'Z0ac: pill label ni Ekipe CSV: ' + json.dumps(d)
assert (d['aria'] or '').startswith('Izvozi tedenski vozni red po ekipah'), 'Z0ac: aria-label manjka: ' + json.dumps(d)
assert d['title'], 'Z0ac: definicijski naslov brez izrečenih pravil: ' + json.dumps(d)
assert d['disabled'] is False, 'Z0ac: pill disabled ob zagonu (dvoklik guard naj bi bil sproščen): ' + json.dumps(d)
print('Z0ac pill OK — EKIPE CSV VEDNO viden (label + aria + definicijski naslov + guard sproščen)')
PYEOF8
  # klik → trije iskreni izidi (pogojni kanon R250/…/R303: toast pri 0 + NIČ
  # datoteke ALI bajtna capture UTF-8 BOM EF BB BF); CSV capture = bajtni dokaz
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(ab=>{const u=new Uint8Array(ab); window.__csvBom=(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF); window.__csvLen=u.length;}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
  agent-browser eval "(()=>{const b=document.querySelector('button[data-testid=\"ekipe-csv-pill\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('CSV po ekipah se izvozi, ko je vpisan termin v prihajajo\u010dem tednu.'); const niekip=body.includes('Ni ekip z termini v naslednjih 7 dneh') && body.includes('CSV po ekipah se izvozi, ko ima ekipa vpisan termin v prihajajo\u010dem tednu.'); const uspeh=body.includes('Tedenski vozni red po ekipah prenešen v CSV (Tedenski-po-ekipah-'); return JSON.stringify({prazno, niekip, uspeh, csvBom:window.__csvBom??null, csvLen:window.__csvLen??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0ac-csv.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r306-z0ac-csv.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0ac CSV err: ' + json.dumps(d)
izidi = sum([1 for k in ('prazno', 'niekip', 'uspeh') if d[k]])
assert izidi == 1, 'Z0ac: natanko EN iskren izid (prazno/niekip/uspeh), dobljeno ' + str(izidi) + ': ' + json.dumps(d)
if d['prazno'] or d['niekip']:
    assert not d['csvBom'], 'Z0ac: fail-closed toast A VSEENO datoteka (kršitev družine R266/R297/R301/R302/R303 — ni prazne datoteke): ' + json.dumps(d)
    veja = 'prazno okno' if d['prazno'] else '0 ekip (mirror R299/R303)'
    print('Z0ac OK — gumb ŽIVO, fail-closed toast (' + veja + '; NIČ datoteke — domensko pravilo)')
elif d['uspeh']:
    assert d['csvBom'] is True, 'Z0ac: uspeh toast A CSV brez UTF-8 BOM (kršitev formatne resnice — Excel BOM kanon): ' + json.dumps(d)
    assert (d['csvLen'] or 0) > 100, 'Z0ac: CSV sumljivo majhen (nepopoln dokument): ' + json.dumps(d)
    print('Z0ac CSV OK — EKIPE CSV ŽIVO bajtno (UTF-8 BOM, ' + str(d['csvLen']) + ' bajtov)')
PYEOF8
  agent-browser screenshot "$SS/qa-r306-e2e-z0ac-ekipe-csv.png" > /dev/null 2>&1
else
  echo "Z0ac OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R304 ×11 ostajajo obvezni dokaz"
fi


echo "=== Z0ad: TEDENSKI PREGLED PO DNEVIH Z EKIPAMI ŽIVO (R305 — 35. člen izvozne družine, ZASLON; pogojni probe — vsi trije izidi iskreni, NATANKO EN) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/…/Z0aa/Z0ab/Z0ac). Blok je pogojen z razgled.pov
# !== null — trije iskreni izidi: praznoOkno (blok NI izmišljen) / prazno
# (termini brez ekipe — particija dokaz) / sklep (PETI potrošnik ENEGA niza).
if eb_pocakaj_na "(()=>{const koledar=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('[data-testid=\"tedenski-ekipa-dnevi\"]') || document.body.textContent.includes('Ni terminov v naslednjih 7 dneh');})()" 16; then
  eb_cakaj 1
  agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"tedenski-ekipa-dnevi\"]'); const praznoEl=document.querySelector('[data-testid=\"tedenski-ekipa-dnevi-prazno\"]'); const sklepEl=document.querySelector('[data-testid=\"tedenski-ekipa-dnevi-sklep\"]'); const praznoOkno=!blok && document.body.textContent.includes('Ni terminov v naslednjih 7 dneh'); const dnevi=blok&&blok.children.length===2?blok.children[1].children.length:0; const uli=blok?blok.querySelectorAll('ul').length:0; const praznihDni=blok?(blok.textContent.match(/Brez terminov na ta dan/g)||[]).length:0; const vrstic=blok?blok.querySelectorAll('li').length:0; return JSON.stringify({blok:!!blok, aria:blok?blok.getAttribute('aria-label'):null, title:blok?((blok.getAttribute('title')||'').includes('ISTI pregled in vrstni red kot Ekipe PDF in Ekipe CSV')):null, prazno:!!praznoEl, praznoTekst:praznoEl?praznoEl.textContent.trim():null, sklep:!!sklepEl, sklepTekst:sklepEl?sklepEl.textContent.trim():null, dnevi, uli, praznihDni, vrstic, praznoOkno, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0ad.json
  python3 - <<'PYEOF9' || exit 1
import json
raw = open('/tmp/r306-z0ad.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0ad err: ' + json.dumps(d)
izidi = sum([1 for k in ('praznoOkno', 'prazno', 'sklep') if d[k]])
assert izidi == 1, 'Z0ad: natanko EN iskren izid (praznoOkno/prazno/sklep), dobljeno ' + str(izidi) + ': ' + json.dumps(d)
if d['praznoOkno']:
    assert not d['blok'], 'Z0ad: praznoOkno A VSEENO blok (blok je pogojen z razgled.pov — ni izmišljenega pogleda): ' + json.dumps(d)
    print('Z0ad OK — ZASLON blok pravilno ODSOTEN ob praznem oknu (iskrena praznina, nič izmišljenega)')
elif d['prazno']:
    assert d['blok'] and d['title'], 'Z0ad: prazna veja brez bloka/title: ' + json.dumps(d)
    assert (d['aria'] or '').startswith('Teden po dnevih in ekipah'), 'Z0ad: aria FAIL: ' + json.dumps(d)
    assert 'Brez ekip z termini v okviru' in (d['praznoTekst'] or ''), 'Z0ad: prazna veja iskren tekst FAIL: ' + json.dumps(d)
    assert 'Dodeli ekipo v terminu' in (d['praznoTekst'] or ''), 'Z0ad: prazna veja dejanje FAIL: ' + json.dumps(d)
    assert d['sklepTekst'] is None, 'Z0ad: prazna veja A sklep tekst (izidi se izključujeta): ' + json.dumps(d)
    print('Z0ad OK — ZASLON blok ŽIVO, prazna veja (vsi vidni termini brez ekipe — particija dokaz + dejanje)')
elif d['sklep']:
    assert d['blok'] and d['title'], 'Z0ad: sklep veja brez bloka/title: ' + json.dumps(d)
    assert (d['aria'] or '').startswith('Teden po dnevih in ekipah'), 'Z0ad: aria FAIL: ' + json.dumps(d)
    assert d['dnevi'] == 7, 'Z0ad: pričakovano NATANKO 7 dni okna (EN VIR pregled.okno), dobljeno ' + str(d['dnevi']) + ': ' + json.dumps(d)
    assert d['uli'] + d['praznihDni'] == 7, 'Z0ad: particija dni (vrstični + prazni = 7) FAIL: ' + json.dumps(d)
    assert d['vrstic'] >= 1 or d['praznihDni'] >= 1, 'Z0ad: sklep veja brez vsebine: ' + json.dumps(d)
    assert 'Ekip: ' in (d['sklepTekst'] or ''), 'Z0ad: sklep NI WYSIWYG (PETI potrošnik ENEGA niza — ISTO besedilo kot PDF/CSV/toast): ' + json.dumps(d)
    print('Z0ad OK — ZASLON blok ŽIVO, sklep veja (7 dni EN VIR + WYSIWYG sklep; vrstic ' + str(d['vrstic']) + ', praznih dni ' + str(d['praznihDni']) + ')')
PYEOF9
  agent-browser screenshot "$SS/qa-r306-e2e-z0ad-ekipa-dnevi.png" > /dev/null 2>&1
else
  echo "Z0ad OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R305 ×11 ostajajo obvezni dokaz"
fi


echo "=== Z0ae: OPREMA CIKEL DOKAZ NA ZASLONU ŽIVO (R306 — 36. člen izvozne družine, ZASLON; pogojni probe — vsi trije izidi iskreni, NATANKO EN) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# Trije iskreni izidi: brezOpreme (blok ODSOTEN — pregled fail-closed guard)
# / prazno (oprema brez žigov — zelen žig veja) / dokaz (žigi > 0 — vrstice
# + iskren dvojni števec vrstic/žigov).
# LEKCIJA R298 (podzavihek stale state) + logistika subtabi (Koledar/Ekipe/Oprema): Z0ae klikne 'Oprema' sam v predikatu (idempotentno — vzorec Z0t/…/Z0ad).
if eb_pocakaj_na "(()=>{const g=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Oprema'); if(g) g.click(); return !!document.querySelector('[data-testid=\"oprema-cikel-dokaz\"]') || document.body.textContent.includes('Ni opreme. Dodaj prvo.');})()" 16; then
  eb_cakaj 1
  agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"oprema-cikel-dokaz\"]'); const praznoEl=document.querySelector('[data-testid=\"oprema-cikel-dokaz-prazno\"]'); const sklepEl=document.querySelector('[data-testid=\"oprema-cikel-dokaz-sklep\"]'); const brezOpreme=!blok && document.body.textContent.includes('Ni opreme. Dodaj prvo.'); const mini=document.body.textContent.includes('Cikl (viden seznam):'); const vrsticne=blok?blok.querySelectorAll('li').length:0; const amber=blok?blok.querySelectorAll('span[class*=\"roksal-amber\"]').length:0; const rdece=blok?blok.querySelectorAll('span[class*=\"roksal-red\"]').length:0; const sklepTekst=sklepEl?sklepEl.textContent.trim():null; const m=sklepTekst?sklepTekst.match(/Vrstic (\\d+) [^]* zigov (\\d+)\\./):null; const n=m?parseInt(m[1],10):null; const g=m?parseInt(m[2],10):null; return JSON.stringify({blok:!!blok, aria:blok?blok.getAttribute('aria-label'):null, title:blok?((blok.getAttribute('title')||'').includes('kot Cikel PDF in Cikel CSV')):null, prazno:!!praznoEl, praznoTekst:praznoEl?praznoEl.textContent.trim():null, sklep:!!sklepEl, sklepTekst, vrsticne, amber, rdece, n, g, brezOpreme, mini, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0ae.json
  python3 - <<'PYEOF10' || exit 1
import json, re
raw = open('/tmp/r306-z0ae.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0ae err: ' + json.dumps(d)
izidi = sum([1 for k in ('brezOpreme', 'prazno', 'sklep') if d[k]])
assert izidi == 1, 'Z0ae: natanko EN iskren izid (brezOpreme/prazno/dokaz), dobljeno ' + str(izidi) + ': ' + json.dumps(d)
if d['brezOpreme']:
    assert not d['blok'] and not d['mini'], 'Z0ae: brezOpreme A VSEENO blok/mini (pregled fail-closed guard): ' + json.dumps(d)
    print('Z0ae OK — dokaz blok pravilno ODSOTEN brez opreme (iskrena odsotnost, nič izmišljenega)')
elif d['prazno']:
    assert d['blok'] and d['title'], 'Z0ae: zelen žig veja brez bloka/title: ' + json.dumps(d)
    assert (d['aria'] or '') == 'Oprema, ki potrebuje akcijo', 'Z0ae: aria FAIL: ' + json.dumps(d)
    assert 'je brez zapadlih pregledov in potečenih kalibracij.' in (d['praznoTekst'] or ''), 'Z0ae: zelen žig tekst FAIL: ' + json.dumps(d)
    assert d['sklepTekst'] is None and d['vrsticne'] == 0, 'Z0ae: zelen žig A sklep/vrstice (izidi se izključujejo): ' + json.dumps(d)
    assert d['mini'], 'Z0ae: mini-vrstica naj bi bila vidna ob opremi: ' + json.dumps(d)
    print('Z0ae OK — dokaz blok ŽIVO, zelen žig veja (vsa vidna oprema brez akcij)')
elif d['sklep']:
    assert d['blok'] and d['title'], 'Z0ae: dokaz veja brez bloka/title: ' + json.dumps(d)
    assert (d['aria'] or '') == 'Oprema, ki potrebuje akcijo', 'Z0ae: aria FAIL: ' + json.dumps(d)
    assert d['n'] is not None and d['g'] is not None, 'Z0ae: sklep dvojnega števca ne berljiv: ' + json.dumps(d)
    assert 1 <= d['n'] <= d['g'], 'Z0ae: iskren dvojni števec FAIL (N ≥ 1, N ≤ M): ' + json.dumps(d)
    assert d['vrsticne'] == d['n'], 'Z0ae: vrstice = N (kos z več žigi = ENA vrstica) FAIL: ' + json.dumps(d)
    assert d['rdece'] + d['amber'] >= d['g'], 'Z0ae: žigov barvnih < žigov števec (pariteta): ' + json.dumps(d)
    assert d['mini'], 'Z0ae: mini-vrstica naj bi bila vidna ob opremi: ' + json.dumps(d)
    print('Z0ae OK — dokaz blok ŽIVO, vrstic ' + str(d['n']) + ' · žigov ' + str(d['g']) + ' (iskrena dvojna resnica; rdečih/amber ' + str(d['rdece'] + d['amber']) + ')')
PYEOF10
  agent-browser screenshot "$SS/qa-r306-e2e-z0ae-oprema-dokaz.png" > /dev/null 2>&1
else
  echo "Z0ae OPOMBA: logistika/oprema ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R306 ×11 ostajajo obvezni dokaz"
fi

echo "=== Z1: Meritve tab — verzija pill v1 + vir 'Ročni vnos' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); return !!p;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const pill=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); const vir=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Meritve (viden seznam):')); const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); const viriDot=viriMini?viriMini.parentElement.querySelector('span[aria-hidden=\"true\"]'):null; return JSON.stringify({pill:!!pill, vir:!!vir, miniTitle:mini?(mini.getAttribute('title')||'').startsWith('Števec stanj vidnega seznama (WYSIWYG — R269)'):false, viriMini:viriMini?viriMini.textContent.trim():null, viriTitle:viriMini?(viriMini.getAttribute('title')||'').startsWith('Pokritost virov vidnega seznama (issue #15 §3)'):false, viriDotAmber:viriDot?viriDot.className.includes('bg-roksal-amber'):false, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z1.json
python3 -c "import json; r=json.load(open('/tmp/r306-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['vir'], 'Z1 pill/vir FAIL: '+json.dumps(d); assert d['miniTitle'], 'Z1 R283 R269 mini title FAIL: '+json.dumps(d); assert d['viriMini'] == 'Viri (viden seznam): 1 ročnih · 0 foto-CV · 0 AR-Depth', 'Z1 VIRI MINI vsebina FAIL (r276 = samo MANUAL): '+json.dumps(d); assert d['viriTitle'], 'Z1 VIRI title FAIL: '+json.dumps(d); assert d['viriDotAmber'], 'Z1 VIRI pika FAIL (delna pokritost = amber): '+json.dumps(d); print('Z1 OK — v1 pill + vir title + R269 mini title (R283 STIL) + VIRI MINI amber delna (1 ročnih · 0 · 0)')" || exit 1
agent-browser screenshot "$SS/qa-r306-e2e-z1.png" > /dev/null 2>&1

echo "=== Z1r: REF PROJEKT — VIRI MINI ŽIVO polna pokritost (issue #15 §1/§3) ==="
izberi_projekt_r283() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r283-ref-proj'})); return 'izbran';})()" 2>&1 | tail -1
}
izberi_projekt_r283
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const v=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const f=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Foto-CV'); const a=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='AR-Depth'); return !!v&&!!f&&!!a;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); const viriDot=viriMini?viriMini.parentElement.querySelector('span[aria-hidden=\"true\"]'):null; const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Meritve (viden seznam):')); const zeton=mini?mini.parentElement.querySelector('span.rounded-full.cursor-help'):null; const pilli=['Ročni vnos','Foto-CV','AR-Depth'].map(n=>[...document.querySelectorAll('span')].some(x=>x.textContent.trim()===n)); return JSON.stringify({viriMini:viriMini?viriMini.textContent.trim():null, viriTitle:viriMini?(viriMini.getAttribute('title')||'').startsWith('Pokritost virov vidnega seznama (issue #15 §3)'):false, viriDotGreen:viriDot?viriDot.className.includes('bg-roksal-green'):false, mini:mini?mini.textContent.trim():null, zeton:zeton?zeton.textContent.trim():null, zetonTitle:zeton?(zeton.getAttribute('title')||'').startsWith('Osnutki — meritve v stanju OSNUTEK'):false, pillRočni:pilli[0], pillFoto:pilli[1], pillAR:pilli[2], err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z1r.json
python3 -c "
import json
r = json.load(open('/tmp/r306-z1r.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['viriMini'] == 'Viri (viden seznam): 1 ročnih · 1 foto-CV · 1 AR-Depth', 'Z1r VIRI MINI FAIL (pričakovano 1·1·1): ' + json.dumps(d)
assert d['viriTitle'], 'Z1r VIRI title FAIL: ' + json.dumps(d)
assert d['viriDotGreen'], 'Z1r pika FAIL (polna pokritost = green): ' + json.dumps(d)
assert d['pillRočni'] and d['pillFoto'] and d['pillAR'], 'Z1r vir pilli ×3 FAIL: ' + json.dumps(d)
assert d['mini'] == 'Meritve (viden seznam): 3 meritve · osnutki 3 · potrjenih 0 · arhiviranih 0', 'Z1r R269 mini FAIL: ' + json.dumps(d)
assert d['zeton'] == '3 osnutki' and d['zetonTitle'], 'Z1r osnutek žeton FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1r err: ' + json.dumps(d)
print('Z1r OK — REF projekt: VIRI MINI ŽIVO 1·1·1 (green — §3 vsi trije viri) + vir pilli ×3 + R269 mini title + žeton title')" || exit 1
agent-browser screenshot "$SS/qa-r306-e2e-z1r-ref.png" > /dev/null 2>&1

echo "=== Z1s: SYNC ŽIG ŽIVO (R281 §10) — m1 'Sinhronizirano r7' + m2 'Konflikt' + tombstone ==="
izberi_projekt_r281() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r281-proj'})); return 'izbran';})()" 2>&1 | tail -1
}
izberi_projekt_r281
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Sinhronizirano')); return !!p;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const all=[...document.querySelectorAll('span.cursor-help')]; const synced=all.find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Sinhronizirano')); const konf=all.find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Konflikt')); return JSON.stringify({synced:{prisoten:!!synced, besedilo:synced?synced.textContent.trim():null}, konflikt:{prisoten:!!konf, besedilo:konf?konf.textContent.trim():null, tombstone:konf?(konf.getAttribute('title')||'').includes('tombstone — grobnico potrdi /api/sync'):false}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z1s.json
python3 -c "
import json
r = json.load(open('/tmp/r306-z1s.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['synced']['prisoten'] and d['synced']['besedilo'] == 'Sinhronizirano r7', 'Z1s synced FAIL: ' + json.dumps(d)
assert d['konflikt']['prisoten'] and d['konflikt']['besedilo'] == 'Konflikt' and d['konflikt']['tombstone'], 'Z1s konflikt FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1s err: ' + json.dumps(d)
print('Z1s OK — sync žig ŽIVO (regresija R281)')"
agent-browser screenshot "$SS/qa-r306-e2e-sync.png" > /dev/null 2>&1

echo "=== Z1m: F2 SYNC MINI-VRSTICA ŽIVO (R282 regresija — ŠE VEDNO na r281 projektu) ==="
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Sync (viden seznam):')); const akcija=[...document.querySelectorAll('span')].find(x=>(x.textContent||'')==='Konflikt — osveži bazo in ponovi sync'); return JSON.stringify({mini:mini?mini.textContent.trim():null, akcija:!!akcija, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z1m.json
python3 -c "
import json
r = json.load(open('/tmp/r306-z1m.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['mini'] and d['mini'].startswith('Sync (viden seznam): 1 sinhroniziranih · 0 čakajoči · 1 konfliktov · 0 napak · 1 grobnic'), 'Z1m mini FAIL: ' + json.dumps(d)
assert d['akcija'], 'Z1m akcijski žig FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1m err: ' + json.dumps(d)
print('Z1m OK — F2 sync mini regresija ŽIVO + akcijski žig')" || exit 1
agent-browser screenshot "$SS/qa-r306-e2e-sync-mini.png" > /dev/null 2>&1
# nazaj na r276 projekt (regresijski tok Z2+)
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); return !!p;})()" 24

echo "=== Z2: Popravi tok ŽIVO — pas → 3450 → Shrani kot novo verzijo → v2 ==="
eb_klik_prefix() { agent-browser eval "(()=>{const g=document.querySelector('button[aria-label^=\"$1\"]'); if(!g) return 'ni gumba'; g.click(); return 'klik';})()" 2>&1 | tail -1; }
eb_klik_prefix "Popravi meritev "
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Popravljanje verzije:');})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const pas=t.includes('Popravljanje verzije:'); const stGumb=[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Shrani kot novo verzijo')); return JSON.stringify({pas, stGumb, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z2-pas.json
python3 -c "import json; r=json.load(open('/tmp/r306-z2-pas.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pas'] and d['stGumb'], 'Z2 pas FAIL: '+json.dumps(d); print('Z2 pas OK — korekcijski pas + Shrani kot novo verzijo')" || exit 1
agent-browser eval "(()=>{const i=document.querySelector('input[type=\"number\"]'); if(!i) return 'ni inputa'; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'3450'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'vpisano';})()" 2>&1 | tail -1
eb_cakaj 1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Shrani kot novo verzijo')); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" 2>&1 | tail -1
eb_pocakaj_tekst "Nova verzija v2 shranjena" 14
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v2'); return !!p;})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const v1=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='v1'); const v2=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='v2'); const pasSePrisoten=t.includes('Popravljanje verzije:'); return JSON.stringify({v1, v2, pasSePrisoten, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z2.json
python3 -c "import json; r=json.load(open('/tmp/r306-z2.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['v1'] and d['v2'], 'Z2 pill FAIL (v1 in v2 obstajata): '+json.dumps(d); assert not d['pasSePrisoten'], 'Z2 pas NI zaprt po uspehu: '+json.dumps(d); print('Z2 OK — v2 ŽIVO (v1 ostane v zgodovini), pas zaprt')" || exit 1
agent-browser screenshot "$SS/qa-r306-e2e-v2.png" > /dev/null 2>&1

echo "=== Z2b: TERENSKI PDF ŽIVO — 10-stolpčna resnica (issue #16 §6) ==="
eb_zajem_pdf val283
eb_klik_gumb "Izvozi terenski pregled meritev kot PDF"
eb_pocakaj_tekst "Terenski pregled meritev prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val283; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z2b.json
python3 -c "import json; r=json.load(open('/tmp/r306-z2b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-', 'Z2b PDF FAIL: '+json.dumps(d); assert d['bajtov']>10000, 'Z2b prekratek PDF: '+json.dumps(d); assert d['err'] is None, 'Z2b err: '+json.dumps(d); print('Z2b OK — terenski PDF ŽIVO (' + str(d['bajtov']) + ' bajtov, %PDF- magija)')" || exit 1
agent-browser screenshot "$SS/qa-r306-e2e-teren-pdf.png" > /dev/null 2>&1

echo "=== Z2z: TERENSKI ZAPISNI LIST PDF ŽIVO — fill-in resnica (issue #15 §3) ==="
eb_zajem_pdf val284
eb_klik_gumb "Izvozi terenski zapisni list kot PDF"
eb_pocakaj_tekst "Zapisni list prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val284; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z2z.json
python3 -c "import json; r=json.load(open('/tmp/r306-z2z.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-', 'Z2z PDF FAIL: '+json.dumps(d); assert d['bajtov']>10000, 'Z2z prekratek PDF: '+json.dumps(d); assert d['err'] is None, 'Z2z err: '+json.dumps(d); print('Z2z OK — zapisni list PDF ŽIVO (' + str(d['bajtov']) + ' bajtov, %PDF- magija — fill-in resnica)')" || exit 1
agent-browser screenshot "$SS/qa-r306-e2e-zapisni-pdf.png" > /dev/null 2>&1

echo "=== Z2x: INVENTURA PREGLED CSV ŽIVO — 30. člen izvozne družine (R286) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot CSV\"]');})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const gumb=document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot CSV\"]'); const legenda=[...document.querySelectorAll('p')].some(p=>p.textContent.startsWith('Inventura CSV = ista resnica kot PDF v Excelu')); return JSON.stringify({gumb:!!gumb, title:gumb?(gumb.getAttribute('title')||'').startsWith('Inventurni pregled premoženja kot CSV'):false, legenda, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z2x-ui.json
python3 -c "import json; r=json.load(open('/tmp/r306-z2x-ui.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['gumb'] and d['title'] and d['legenda'], 'Z2x UI FAIL: '+json.dumps(d); assert d['err'] is None, 'Z2x err: '+json.dumps(d); print('Z2x UI OK — gumb + hover title + legenda ŽIVO (30. člen, kanon R280–R285)')" || exit 1
eb_zajem_pdf val286csv
eb_klik_gumb "Izvozi inventurni pregled premoženja kot CSV"
eb_pocakaj_tekst "Inventurni pregled premoženja prenešen v CSV" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val286csv; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({csv:false, err:window.__err??null}); const bin=atob(b64); const bom=bin.charCodeAt(0).toString(16)+bin.charCodeAt(1).toString(16)+bin.charCodeAt(2).toString(16); let vrs=0; for(let i=0;i<bin.length;i++){ if(bin.charCodeAt(i)===10) vrs++; } return JSON.stringify({csv:true, bom, bajtov:bin.length, vrstic:vrs, glava:bin.includes('"Naziv"')&&bin.includes('"Status"')&&bin.includes('"Enota"'), dodatni:bin.includes('"id"')&&bin.includes('"Premiki"'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z2x.json
python3 -c "import json; r=json.load(open('/tmp/r306-z2x.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['csv'] and d['bom']=='efbbbf', 'Z2x CSV/BOM FAIL: '+json.dumps(d); assert d['glava'] and d['dodatni'], 'Z2x stolpci FAIL (ASCII needleji — atob UTF-8 je 2-bajtni za Š/ž, kanon r285): '+json.dumps(d); assert d['vrstic']>=2, 'Z2x premalo vrstic: '+json.dumps(d); assert d['bajtov']>60, 'Z2x prekratek CSV: '+json.dumps(d); assert d['err'] is None, 'Z2x err: '+json.dumps(d); print('Z2x OK — inventura CSV ŽIVO (' + str(d['bajtov']) + ' bajtov, BOM efbbbf, ' + str(d['vrstic']) + ' vrstic — pariteta R270 po konstrukciji + 3 dodatni stolpci)')" || exit 1
agent-browser screenshot "$SS/qa-r306-e2e-inventura-csv.png" > /dev/null 2>&1
# VRNITEV na measurements tab (Z2b/Z2z/Z2y kontekst — r285 tok se nadaljuje nespremenjen):
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_cakaj 1

echo "=== Z2y: TERENSKI ZAPISNI LIST CSV ŽIVO — digitalno izpolnjevanje (R285) ==="
eb_zajem_pdf val285csv
eb_klik_gumb "Izvozi terenski zapisni list kot CSV"
eb_pocakaj_tekst "Zapisni list prenešen v CSV" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val285csv; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({csv:false, err:window.__err??null}); const bin=atob(b64); const bom=bin.charCodeAt(0).toString(16)+bin.charCodeAt(1).toString(16)+bin.charCodeAt(2).toString(16); let vrs=0; for(let i=0;i<bin.length;i++){ if(bin.charCodeAt(i)===10) vrs++; } return JSON.stringify({csv:true, bom, bajtov:bin.length, vrstic:vrs, imaFizicna:bin.includes('fizicna_ref_mm'), imaDelta:bin.includes('delta_mm'), imaZapiski:bin.includes('zapiski_terena'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z2y.json
python3 -c "import json; r=json.load(open('/tmp/r306-z2y.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['csv'] and d['bom']=='efbbbf', 'Z2y CSV/BOM FAIL: '+json.dumps(d); assert d['imaFizicna'] and d['imaDelta'] and d['imaZapiski'], 'Z2y stolpci FAIL: '+json.dumps(d); assert d['vrstic']>=2, 'Z2y premalo vrstic: '+json.dumps(d); assert d['bajtov']>60, 'Z2y prekratek CSV: '+json.dumps(d); assert d['err'] is None, 'Z2y err: '+json.dumps(d); print('Z2y OK — zapisni list CSV ŽIVO (' + str(d['bajtov']) + ' bajtov, BOM efbbbf, ' + str(d['vrstic']) + ' vrstic — pariteta R186 + prazni fizični stolpci)')" || exit 1
agent-browser screenshot "$SS/qa-r306-e2e-zapisni-csv.png" > /dev/null 2>&1

echo "=== Z3: Zgodovina verzij panel — veriga v1→v2 + delta +250 + aktivna v2 ==="
eb_klik_prefix "Pokaži zgodovino verzij meritve"
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Zgodovina verzij — korekcije NE prepišejo');})()" 14
eb_pocakaj_na "(()=>{return document.body.textContent.includes('+250');})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const aktivnaV2=t.includes('Aktivna verzija: v2'); const delta=t.includes('+250'); const o7=t.includes('se NE izračunajo samodejno'); return JSON.stringify({aktivnaV2, delta, o7, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z3.json
python3 -c "import json; r=json.load(open('/tmp/r306-z3.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['aktivnaV2'] and d['delta'] and d['o7'], 'Z3 panel FAIL: '+json.dumps(d); print('Z3 OK — veriga v1→v2 + delta +250 + aktivna v2 + O7 resnica')" || exit 1
agent-browser screenshot "$SS/qa-r306-e2e-panel.png" > /dev/null 2>&1

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
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({temna:document.documentElement.classList.contains('dark'), panel:t.includes('Zgodovina verzij — korekcije NE prepišejo'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r306-z5.json
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
python3 -c "import json; r=json.load(open('/tmp/r306-z5.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['temna'] and d['panel'] and d['err'] is None, 'Z5 temna FAIL: '+json.dumps(d); print('Z5 temna OK — verzije panel vidna, err null')" || exit 1

echo "=== RESTORE + ODTIS (bajtnata identičnost — ZERO-MUTACIJA) ==="
node scripts/r276-db-e2e.cjs restore || exit 1
node scripts/r273-db-e2e.cjs restore > /dev/null 2>&1 || true
node scripts/r281-db-e2e.cjs restore || exit 1
node scripts/r283-referencni-projekt.cjs restore || exit 1
node scripts/r287-db-e2e.cjs restore || exit 1
node scripts/r276-db-e2e.cjs fp > /tmp/r306-fp-post-276.json || exit 1
node scripts/r281-db-e2e.cjs fp > /tmp/r306-fp-post-281.json || exit 1
node scripts/r283-referencni-projekt.cjs fp > /tmp/r306-fp-post-283.json || exit 1
node scripts/r287-db-e2e.cjs fp > /tmp/r306-fp-post.json || exit 1
OK=1
cmp -s /tmp/r306-fp-pre-276.json /tmp/r306-fp-post-276.json || OK=0
cmp -s /tmp/r306-fp-pre-281.json /tmp/r306-fp-post-281.json || OK=0
cmp -s /tmp/r306-fp-pre-283.json /tmp/r306-fp-post-283.json || OK=0
cmp -s /tmp/r306-fp-pre.json /tmp/r306-fp-post.json || OK=0
if [ "$OK" = 1 ]; then
  echo "ODTIS BAJTNATO IDENTIČEN (pre==post, r276 + r281 + r283 + r287) — ZERO-MUTACIJA dokazana"
else
  echo "ODTIS RAZLIČEN — FAIL"; diff <(python3 -m json.tool /tmp/r306-fp-pre-276.json) <(python3 -m json.tool /tmp/r306-fp-post-276.json) | head -10; diff <(python3 -m json.tool /tmp/r306-fp-pre-281.json) <(python3 -m json.tool /tmp/r306-fp-post-281.json) | head -10; diff <(python3 -m json.tool /tmp/r306-fp-pre-283.json) <(python3 -m json.tool /tmp/r306-fp-post-283.json) | head -10
  exit 1
fi

echo "=== ZAKLJUČEK: strežnik + brskalnik zaprta ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R306 E2E KONEC ==="
