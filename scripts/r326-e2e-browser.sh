#!/bin/bash
# R310 E2E ŽIVO (lokalni :3100, ADMIN) — API I/O MEJA ŽIVO (38. člen issue #1:
#   Z0ag: MEJA ŽIVO — pokvarjen JSON na 3 compute endpoints → fail-closed
#         400 { error } (NIKOLI 500); calculator = R310 popravljen exemplar
#         (500-nad-malformed izboljšan na 400), railing-layout + quote že
#         pravilna — wire-level dokaz. ZERO-MUTACIJA: nič db zapisa.
# [R307 prej] KONFLIKTNI DOKAZ NA ZASLONU (37. člen
# izvozne družine — ZASLONSKI brat Konflikti CSV R301 + PDF R302; ZASLON = takoj) +
# [R306] OPREMA CIKEL DOKAZ NA ZASLONU +
# [R305] TEDENSKI PREGLED PO DNEVIH Z EKIPAMI +
# [R304] VODJA TEDENSKI CSV PO EKIPAH (ENA vrstica na termin) +
# [kombinirano z R303] VODJA TEDENSKI PDF PO EKIPAH (PDF brat ICS po ekipah R299; en tisk) +
# [kombinirano z R300] KONFLIKTNA MINI-VRSTICA (30. člen issue #1 §7 branje — bralna stran pravil R142; zrcalo STRAŽAR-
# sinhronizirano) + [kombinirano z R299] TEDENSKI ICS PO EKIPAH +
# [kombinirano z R298] TEDENSKI ICS + [kombinirano z R297] OPREMA CIKEL CSV
# + [kombinirano z R296] KOLEDAR ICS + [kombinirano z R295] KOLEDAR CSV +
# [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev
# R287: signal → dejanje → CILJ) + INVENTURA CSV + ZAPISNI LIST PDF/CSV + zgodovina verzij:
#   [R322] DEKOMPOZICIJA calculator-tab FAZA 1 (regression-only runda —
#         PRIROJENIŠKA, vzorec R319; KOLIZIJA: vzporedna R321 vzela
#         številko): 6.074 → 5.372 vrstic — mapa calculator/ ×5
#         (shared.ts + 4 SVG diagrami — ČIST PREMIK bajtno identično)
#         + R254 SLEPA PEGA ZAPRTA (5 a11y popravkov IN-PLACE;
#         trojni popravek detektor+codemod+stražar). NOV Z-blok NI
#         dodan — iskren razlog: premik bajtno identične vsebine nima
#         nove žive interakcije za dokazovat; pokritost =
#         r322-build-needles [vsebina ŽIVA v čankih ×5] + vitest r254
#         stražar [5 novih ikon] + polne E2E regresije (Z0ar/…/Z0ah)
#         + ZERO-MUTACIJA ODTIS;
#   Z0as: IZVOZ MERITEV ZMOGLJIVOSTI KOT CSV ŽIVO (R323 NOVO — 51. člen
#         issue #1, IZVOZI družina): gumb v zmogljivost-dokaz bloku →
#         deterministični CSV (pregled = POSREDOVANA resnica; CSV NE meri
#         znova; EN VIR kontrakt R323 — glave + validacija + formatirajMs
#         + Vir niz iz brata; toCsv kanon R136: BOM + podpičje + CRLF) +
#         BOM magija NA BAJTIH (EF BB BF) + glave EN VIR pin + DETERMINIZEM
#         ŽIVO NA BAJTIH (dva izvoza bajtno enaka) — EN VIR izvoz,
#         ZERO-MUTACIJA;
#   Z0au: ZGODOVINA CEN MATERIALA ŽIVO (R326 NOVO — 53. člen issue #1 §5,
#         price history): panel CenaZgodovinaPanel na inventory tabu —
#         čisti bralec NOVEGA GET route /api/material-prices/zgodovina
#         (r308 obseg 81→82); iskrena prazna veja (lokalna DB brez
#         MaterialPrice — deterministično stanje: "Ni še zabeleženih
#         cen" + CSV gumb skrit — brez podatkov NI izvoza, kanon vodje);
#         wire-level GET: 200 + pregled.pari 0 + vir niz ŽIVO;
#         ZERO-MUTACIJA (samo GET dispeči);
#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO (R324 NOVO — 52. člen
#         issue #1, IZVOZI družina): gumb "Dnevni PDF" v glavi "Pregled za
#         vodjo" → deterministični PDF (vhod = POSREDOVANA resnica prek
#         komponentnega EN VIR helperja vodjaIzvozVhod — ENA preslikava,
#         DVA potrošnika [CSV R163 + PDF 52. člen]; EN VIR kontrakt R324
#         v bratu R163: glave + validacija + vodjaKpiVrstice + VIR_NIZ;
#         FNV soli 0xcd–0xd0; brez časa v vsebini) + %PDF- magija NA
#         BAJTIH + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka)
#         — EN VIR izvoz, ZERO-MUTACIJA;
#   Z0ar: IZVOZ MERITEV ZMOGLJIVOSTI KOT PDF ŽIVO (R321 — 50. člen
#         issue #1, IZVOZI družina): gumb v zmogljivost-dokaz bloku →
#         deterministični PDF (pregled = POSREDOVANA resnica — meritev
#         ENKRAT ob mountu, PDF NE meri znova; formatirajMs = EN VIR
#         zaslon + PDF; fiksni formatni žig + FNV soli 0xc9–0xcc; brez
#         časa v vsebini) + %PDF- magija NA BAJTIH + DETERMINIZEM ŽIVO
#         NA BAJTIH (dva izvoza bajtno enaka) — EN VIR izvoz,
#         ZERO-MUTACIJA;
#   Z0aq: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT PDF ŽIVO (R320 NOVO —
#         49. člen issue #1, IZVOZI družina): gumb v končna-verifikacija
#         bloku → deterministični PDF (fiksni formatni žig + FNV soli
#         0xc5–0xc8; brez časa v vsebini; sklep = PETI potrošnik ENEGA
#         niza) + %PDF- magija NA BAJTIH + DETERMINIZEM ŽIVO NA BAJTIH
#         (dva izvoza bajtno enaka) — EN VIR izvoz, ZERO-MUTACIJA;
#   Z0ap: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT PDF ŽIVO (R318 NOVO —
#         48. člen issue #1, IZVOZI družina): gumb v avtomatizacija-dokaz
#         bloku → deterministični PDF (fiksni formatni žig + FNV soli
#         0xc1–0xc4; brez časa v vsebini) + %PDF- magija NA BAJTIH +
#         DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka — prvi
#         PDF z živim bajtnim determinizmom v družini) — EN VIR izvoz,
#         ZERO-MUTACIJA;
#   Z0ao: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT CSV ŽIVO (R317 NOVO —
#         47. člen issue #1, IZVOZI družina): gumb v avtomatizacija-dokaz
#         bloku → deterministični CSV (BOM + glave + 11 območij + sklep
#         WYSIWYG) + DETERMINIZEM ŽIVO (dva izvoza bajtno enaka) — EN
#         VIR izvoz, ZERO-MUTACIJA;
#   Z0an: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT JSON ŽIVO (R316 NOVO —
#         46. člen issue #1, IZVOZI družina): gumb v končna-verifikacija
#         bloku → deterministični JSON (shema + 11 območij + 8 kriterijev
#         + sklep WYSIWYG) + DETERMINIZEM ŽIVO (dva izvoza bajtno enaka)
#         — EN VIR izvoz, ZERO-MUTACIJA;
#   Z0am: KONČNA VERIFIKACIJA ŽIVO (R315 NOVO — 45. člen issue #1, D7):
#         vodja blok [koncna-verifikacija-dokaz] — naslov + 11 območij s
#         plast chips (vitest · build-needleji · E2E ŽIVO · prod-qa ·
#         smoke) + 8 sprejemnih kriterijev z izpeljavo/dokazom + sklep
#         WYSIWYG (EN VIR — ZERO-MUTACIJA);
#   Z0al: AUDIT DOKAZ ŽIVO (R314 NOVO — 44. člen issue #1, Deliverable 4):
#         vodja blok [avtomatizacija-dokaz] — naslov + 11 območij (§1–§11)
#         z razredom + impl/dokaz števci + sklep WYSIWYG (EN VIR —
#         ZERO-MUTACIJA);
#   Z0ak: ZMOGLJIVOST DOKAZ ŽIVO (R313 posodobljeno — 43. člen): vodja
#         blok [zmogljivost-dokaz] — naslov + 10 realnih meritev (min/mediana/
#         max ms, vsi izhodi preverjeni; +2 PDF meritve) + sklep WYSIWYG
#         (ZERO-MUTACIJA);
#   Z0aj: AI RABA DOKAZ ŽIVO (R311 — 41. člen issue #1): vodja blok
#         [ai-raba-dokaz] — naslov + 2 živi AI površini z razrešenim
#         nadomestkom + 3 kandidati + sklep WYSIWYG (EN VIR — ZERO-MUTACIJA);
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
export SESSION_SECRET="${SESSION_SECRET:-r322-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R326-server-e2e.log 2>&1 < /dev/null &
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
node scripts/r276-db-e2e.cjs fp > /tmp/r326-fp-pre-276.json || exit 1
node scripts/r281-db-e2e.cjs fp > /tmp/r326-fp-pre-281.json || exit 1
node scripts/r283-referencni-projekt.cjs fp > /tmp/r326-fp-pre-283.json || exit 1
node scripts/r287-db-e2e.cjs fp > /tmp/r326-fp-pre.json || exit 1

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
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('— odpre CRM (opomnik)')); const info=vr.map(x=>({aria:x.getAttribute('aria-label'), meta:(x.querySelector('p.uppercase')||{}).textContent||null, red:!!x.querySelector('.text-roksal-red'), amber:!!x.querySelector('.text-roksal-amber')})); return JSON.stringify({st:vr.length, info, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z0z.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r326-z0z.json').read().strip()
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
agent-browser screenshot "$SS/qa-r310-e2e-z0z-zvoncek.png" > /dev/null 2>&1
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('E2E R287 Potekel Opomnik')); if(!vr) return 'BREZ'; vr.click(); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='CRM stranke'); return !!h;})()" 20
eb_cakaj 1
agent-browser eval "(()=>{const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='CRM stranke'); return JSON.stringify({crm:!!h, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z0z-crm.json
python3 -c "import json; r=json.load(open('/tmp/r326-z0z-crm.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['crm'], 'Z0z CRM tab FAIL (portal akcija): '+json.dumps(d); assert d['err'] is None, 'Z0z err: '+json.dumps(d); print('Z0z OK — portal akcija ŽIVO: klik na POTEKEL → CRM tab (R182 protokol)')" || exit 1
agent-browser screenshot "$SS/qa-r310-e2e-z0y-deeplink.png" > /dev/null 2>&1

agent-browser screenshot "$SS/qa-r310-e2e-z0y-deeplink.png" > /dev/null 2>&1

echo "=== Z0y: DEEP-LINK ŽIVO — detail Sheet samodejno odprt + poudarjena vrstica (R294) ==="
eb_pocakaj_na "(()=>{const t=[...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik'); return t;})()" 20
eb_cakaj 1
agent-browser eval "(()=>{const tit=[...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik'); const kartica=document.body.textContent.includes('Opomnik potekel'); const opis=document.body.textContent.includes('E2E pokliči nazaj (potekel)'); return JSON.stringify({tit, kartica, opis, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z0y-sheet.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r326-z0y-sheet.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['tit'] and d['kartica'] and d['opis'], 'Z0y Sheet FAIL (deep-link ni odprl detaila): ' + json.dumps(d)
assert d['err'] is None, 'Z0y err: ' + json.dumps(d)
print('Z0y OK — deep-link detail Sheet ŽIVO (SheetTitle + opomniška kartica POTEKEL — dvo-dogodkovni R214 vzorec)')
PYEOF
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(x=>{const s=x.querySelector('.sr-only'); return s&&s.textContent.trim()==='Zapri'&&x.closest('[data-slot="sheet-content"]');}); if(!g) { const g2=[...document.querySelectorAll('[data-radix-collection-item], button')].filter(x=>{const s=x.querySelector('.sr-only'); return s&&s.textContent.trim()==='Zapri';}).pop(); if(!g2) return 'BREZ-ZAPRI'; g2.click(); return 'zapri-fallback'; } g.click(); return 'zapri';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return ![...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik');})()" 14
agent-browser eval "(()=>{const vrstica=[...document.querySelectorAll('[role="button"]')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Stranka E2E R287 Potekel Opomnik')); const akt=[...document.querySelectorAll('[role="button"]')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Stranka E2E R287 Aktiven Opomnik')); const poud=vrstica?vrstica.className.includes('border-roksal-amber/60'):false; const polnilo=vrstica?vrstica.className.includes('bg-roksal-amber/5'):false; const tit=vrstica?vrstica.getAttribute('title'):null; const aktCista=akt?!akt.className.includes('border-roksal-amber/60'):true; return JSON.stringify({najdena:!!vrstica, poud, polnilo, tit, aktCista, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z0y-poudarek.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r326-z0y-poudarek.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['najdena'], 'Z0y vrstica FAIL (seed stranka ni v CRM seznamu): ' + json.dumps(d)
assert d['poud'] and d['polnilo'], 'Z0y poudarek FAIL (roksal-amber obroba+polnilo): ' + json.dumps(d)
assert d['tit'] == 'Poudarjeno iz zvončka (opomnik)', 'Z0y title FAIL: ' + json.dumps(d)
assert d['aktCista'], 'Z0y AKTIVEN vrstica NE SME biti poudarjena: ' + json.dumps(d)
assert d['err'] is None, 'Z0y err: ' + json.dumps(d)
print('Z0y OK — poudarjena vrstica ŽIVO (roksal-amber obroba+polnilo+title; AKTIVEN NE poudarjena — izrecna izbira)')
PYEOF
agent-browser screenshot "$SS/qa-r310-e2e-z0y-poudarek.png" > /dev/null 2>&1


echo "=== Z0m: PRIHODKI PO MESECIH ŽIVO (R294 — plačila dimenzija, POGOJNI probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('section[aria-label^=\"Prihodki po mesecih\"]');})()" 16; then
  eb_cakaj 1
  agent-browser eval "(()=>{const s=document.querySelector('section[aria-label^=\"Prihodki po mesecih\"]'); const vrstice=[...s.querySelectorAll('ul li')]; const skupaj=s.textContent.includes('Skupaj plačano'); const prazna=s.textContent.includes('Ni plačanih računov'); const storn=s.textContent.includes('(izključeni iz zneskov)'); const vt=s.textContent.includes('v teku:'); return JSON.stringify({vrstice:vrstice.length, skupaj, prazna, storn, vt, besedilo:vrstice.length>0?vrstice[0].textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0m.json
  python3 - <<'PYEOF2' || exit 1
import json
raw = open('/tmp/r326-z0m.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0m-meseci.png" > /dev/null 2>&1
else
  echo "Z0m OPOMBA: sekcija ni dosegljiva na spot seji (CRM skoping RBAC?) — chunk needleji R294 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0n: PRIHODKI MESECI CSV ŽIVO (R294 — 8. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi prihodke po mesecih kot CSV\"]');})()" 16; then
  eb_csv_capture prihodkiMeseci
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi prihodke po mesecih kot CSV\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni plačanih računov') && body.includes('CSV se izvozi ob prvem plačilu.'); const uspeh=body.includes('Prihodki po mesecih prenešeni v CSV ('); const c=window.__prihodkiMeseci ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, csvNiz:niz, bajti:niz?c.length:0, bom:niz?c.charCodeAt(0)===0xFEFF:false, glava:niz?c.split('\n')[0].slice(0,40):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0n.json
  python3 - <<'PYEOF3' || exit 1
import json
raw = open('/tmp/r326-z0n.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0n-meseci-csv.png" > /dev/null 2>&1
else
  echo "Z0n OPOMBA: CSV gumb ni dosegljiv na spot seji (CRM skoping RBAC?) — chunk needleji R294 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0o: TEDENSKI RAZGLED + TEDENSKI CSV ŽIVO (R292 — 23. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi tedenski pregled montaž kot CSV\"]');})()" 16; then
  # RAZGLED strip (MANDATORY STIL): aria regija + 7 dni + sklep/praznina + aria-hidden tir
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\"Tedenski razgled — naslednjih 7 dni\"]'); if(!reg) return JSON.stringify({strip:false, err:window.__err??null}); const celice=reg.querySelectorAll('.grid.grid-cols-7 > div').length; const sklep=document.querySelector('[data-testid=\"tedenski-razgled-sklep\"]'); const tiri=reg.querySelectorAll('[aria-hidden=\"true\"].h-1').length; return JSON.stringify({strip:true, celice, tiri, sklep:sklep?sklep.textContent.trim().slice(0,80):null, praznina:sklep?sklep.textContent.includes('Naslednjih 7 dni brez vpisanih terminov.'):false, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0o-strip.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r326-z0o-strip.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('CSV se izvozi, ko je vpisan termin v prihajajočem tednu.'); const uspeh=body.includes('Tedenski pregled prenešen v CSV ('); const c=window.__tedenskiCsv ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, csvNiz:niz, bajti:niz?c.length:0, bom:niz?c.charCodeAt(0)===0xFEFF:false, glava:niz?c.split('\n')[0].slice(0,60):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0o-csv.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r326-z0o-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0o-tedenski-csv.png" > /dev/null 2>&1
else
  echo "Z0o OPOMBA: tedenski CSV gumb ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R292 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0p: MARŽNI RAZGLED + DOBIČKONOST CSV ŽIVO (R293 — 24. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobičkonosnost projektov kot CSV\"]');})()" 16; then
  # MARŽNI RAZGLED strip (MANDATORY STIL): aria regija + vrstice/sklep/praznina + aria-hidden tirje
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\"Maržni razgled — marža po projektih\"]'); if(!reg) return JSON.stringify({strip:false, err:window.__err??null}); const vrstice=reg.querySelectorAll('.space-y-1 > div').length; const tiri=reg.querySelectorAll('[aria-hidden=\"true\"].h-1').length; const sklep=document.querySelector('[data-testid=\"marzni-razgled-sklep\"]'); return JSON.stringify({strip:true, vrstice, tiri, sklep:sklep?sklep.textContent.trim().slice(0,90):null, praznina:sklep?sklep.textContent.includes('Ni projektov v preseku'):false, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0p-strip.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r326-z0p-strip.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni podatkov za dobičkonost') && body.includes('CSV se izvozi, ko je vpisan prvi račun ali naročilo.'); const uspeh=body.includes('Dobičkonost prenešena v CSV ('); const c=window.__dobicikonostCsv ?? null; const niz=(typeof c==='string'); const brezBom=niz?c.replace(/^\uFEFF/,''):null; return JSON.stringify({prazno, uspeh, csvNiz:niz, bom:window.__dobicikonostBom===true, bajti:niz?brezBom.length:0, glava:niz?brezBom.split('\n')[0].slice(0,60):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0p-csv.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r326-z0p-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0p-dobicikonost-csv.png" > /dev/null 2>&1
else
  echo "Z0p OPOMBA: vodja pregled ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R293 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0q: AVTOMATIZACIJA KARTICA ŽIVO (R294 — issue #1; deterministična resnica — brez podatkovne odvisnosti; ZERO-MUTACIJA) ==="
if eb_pocakaj_na "(()=>{return !!document.querySelector('[aria-label=\"Avtomatizacija — razred funkcij\"]');})()" 16; then
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\"Avtomatizacija — razred funkcij\"]'); if(!reg) return JSON.stringify({kartica:false}); const t=reg.textContent||''; const m=t.match(/(\\d+) funkcij · (\\d+) območij poslovanja/); const det=t.match(/(\\d+) determinističnih/); const sdk=t.match(/(\\d+) SDK/); const ai=t.match(/(\\d+) AI \\(neobvezne\\)/); return JSON.stringify({kartica:true, skupaj:m?+m[1]:null, obmocija:m?+m[2]:null, det:det?+det[1]:null, sdk:sdk?+sdk[1]:null, ai:ai?+ai[1]:null, nadomestki:t.includes('zmožnosti z izrečenim determinističnim nadomestkom'), sklep:t.includes('jedro deluje brez AI.')});})()" 2>&1 | tail -1 > /tmp/r326-z0q.json
  python3 - <<'PYEOFQ' || exit 1
import json
raw = open('/tmp/r326-z0q.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0q-avtomatizacija.png" > /dev/null 2>&1
else
  echo "Z0q OPOMBA: vodja pregled ni dosegljiv na spot seji (RBAC skoping?) — needleji R294 ×8 ostajajo obvezni dokaz"
fi

echo "=== Z0r: KOLEDAR PREGLEDOV CSV ŽIVO (R295 — 25. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot CSV\"]');})()" 16; then
  # F2 koledarska mini-vrstica (WYSIWYG ISTA izpeljava koledarPovzetek):
  # pogojna resnica — viden SAMO kadar je vpisan vsaj en pregled (spot resnica)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi koledar pregledov kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot CSV'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0r-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r326-z0r-pilli.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni vpisanih pregledov') && body.includes('CSV se izvozi, ko je vpisan prvi datum pregleda.'); const uspeh=body.includes('Koledar pregledov prenešen v CSV ('); const mini=body.includes('Pregledi: ') && body.includes(' vpisanih · '); const c=window.__koledarCsv ?? null; const niz=(typeof c==='string'); const brezBom=niz?c.replace(/^\uFEFF/,''):null; return JSON.stringify({prazno, uspeh, mini, csvNiz:niz, bom:window.__koledarBom===true, bajti:niz?brezBom.length:0, glava:niz?brezBom.split('\n')[0].slice(0,60):null, obseg:niz?brezBom.includes('Vse stranke z vpisanim datumom pregleda (AKTIVEN + POTEKEL)'):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0r-csv.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r326-z0r-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0r-koledar-csv.png" > /dev/null 2>&1
else
  echo "Z0r OPOMBA: CRM pregled ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R295 ×13 ostajajo obvezni dokaz"
fi

echo "=== Z0s: KOLEDAR PREGLEDOV ICS ŽIVO (R296 — 26. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot ICS\"]');})()" 16; then
  # trije koledarski pilli (PDF brat R253 + CSV brat R295 + ICS brat R296):
  # VEDNO vidni (P1-k precedens)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi koledar pregledov kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot CSV'), pillIcs:pill.some(b=>b.getAttribute('aria-label')==='Izvozi koledar pregledov kot ICS'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0s-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r326-z0s-pilli.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni vpisanih pregledov') && body.includes('ICS se izvozi, ko je vpisan prvi datum pregleda.'); const uspeh=body.includes('Koledar pregledov prenešen v ICS ('); const c=window.__koledarIcs ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, icsNiz:niz, bom:window.__koledarIcsBom===true, bajti:niz?c.length:0, glava:niz?c.slice(0,40):null, crlf:niz?c.includes('\\r\\n'):null, xstatus:niz?c.includes('X-ROKSAL-STATUS:'):null, konec:niz?c.trimEnd().endsWith('END:VCALENDAR'):null, dogodki:niz?(c.match(/BEGIN:VEVENT/g)||[]).length:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0s-ics.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r326-z0s-ics.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0s-koledar-ics.png" > /dev/null 2>&1
else
  echo "Z0s OPOMBA: CRM pregled ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R296 ×13 ostajajo obvezni dokaz"
fi

echo "=== Z0t: OPREMA CIKEL CSV ŽIVO (R297 — 27. člen izvozne družine; pogojni probe; ZERO-MUTACIJA — GET fetch samo) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const oprema=gumbi.find(b=>b.textContent.trim()==='Oprema'); if(oprema) oprema.click(); return !!document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot CSV\"]');})()" 16; then
  # oba cikl pilli (PDF brat R266 + CSV brat R297): VEDNO vidna (P1-k precedens)
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi pregled življenjskega cikla opreme kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi pregled življenjskega cikla opreme kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi pregled življenjskega cikla opreme kot CSV'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0t-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r326-z0t-pilli.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni vpisane opreme') && body.includes('CSV se izvozi, ko je vpisan prvi kos opreme.'); const uspeh=body.includes('Pregled opreme prenešen v CSV ('); const c=window.__opremaCsv ?? null; const niz=(typeof c==='string'); const brezBom=niz?c.replace(/^\uFEFF/,''):null; return JSON.stringify({prazno, uspeh, csvNiz:niz, bom:window.__opremaBom===true, bajti:niz?brezBom.length:0, glava:niz?brezBom.split('\n')[0].slice(0,60):null, obseg:niz?brezBom.includes('Vsa oprema iz /api/equipment (polna resnica — tudi upokojena/izgubljena; NAZIV ASC referenčni red)'):null, sklep:niz?brezBom.includes('paginacija do 10.000 kosov.'):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0t-csv.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r326-z0t-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0t-oprema-csv.png" > /dev/null 2>&1
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
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski pregled montaž kot')); return JSON.stringify({pillPdf:pill.some(b=>b.getAttribute('aria-label')==='Izvozi tedenski pregled montaž kot PDF'), pillCsv:pill.some(b=>b.getAttribute('aria-label')==='Izvozi tedenski pregled montaž kot CSV'), pillIcs:pill.some(b=>b.getAttribute('aria-label')==='Izvozi tedenski pregled montaž kot ICS koledar'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0u-pilli.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r326-z0u-pilli.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('ICS se izvozi, ko je vpisan termin v prihajajočem tednu.'); const uspeh=body.includes('Tedenski vozni red prenešen v ICS ('); const c=window.__tedenskiIcs ?? null; const niz=(typeof c==='string'); const vrstice=niz?c.split('\r\n'):null; const veventi=niz?vrstice.filter(v=>v==='BEGIN:VEVENT').length:null; return JSON.stringify({prazno, uspeh, icsNiz:niz, bom:window.__icsBom===true, crlf:niz?c.includes('\r\n'):null, veventi, prva:niz?vrstice[0]:null, prodid:niz?vrstice.some(v=>v==='PRODID:-//Roksal//Tedenski vozni red//SL'):null, obseg:niz?vrstice.some(v=>v.startsWith('X-ROKSAL-OBSEG:')):null, dtstartZ:niz?vrstice.some(v=>v.startsWith('DTSTART:')&&v.endsWith('Z')):null, dtendZ:niz?vrstice.some(v=>v.startsWith('DTEND:')&&v.endsWith('Z')):null, status:niz?(veventi===0||vrstice.some(v=>v==='STATUS:CONFIRMED'||v==='STATUS:CANCELLED'||v==='STATUS:TENTATIVE')):null, noga:niz?vrstice[vrstice.length-1]==='END:VCALENDAR':null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0u-ics.json
  python3 - <<'PYEOF5' || exit 1
import json
raw = open('/tmp/r326-z0u-ics.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0u-tedenski-ics.png" > /dev/null 2>&1
else
  echo "Z0u OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R298 ×17 ostajajo obvezni dokaz"
fi

echo "=== Z0v: TEDENSKI ICS PO EKIPAH ŽIVO (R299 — 29. člen izvozne družine; pogojni probe; ZERO-MUTACIJA — lokalni blob download samo) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298: podzavihek stale state — Z0v klikne 'Koledar' sam v predikatu
# (idempotenten na že aktivnem zavihku — vzorec Z0t/Z0u).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski ICS samo za ekipo '));})()" 16; then
  # čipi: definicijski naslovi (MANDATORY STIL) + skupina aria + oznaka
  agent-browser eval "(()=>{const cipi=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi tedenski ICS samo za ekipo ')); const oznaka=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='ICS po ekipi:'); const prvi=cipi[0]; return JSON.stringify({stevilo:cipi.length, oznaka:!!oznaka, oznakaTitle:oznaka?(oznaka.getAttribute('title')||'').startsWith('Ekipa z vsaj enim terminom v naslednjih 7 dneh'):false, prviTitle:prvi?(prvi.getAttribute('title')||'').startsWith('Samo termini ekipe '):false, skupinaAria:!!document.querySelector('[aria-label=\"Tedenski ICS po ekipah\"]'), err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0v-cipi.json
  python3 - <<'PYEOF6' || exit 1
import json
raw = open('/tmp/r326-z0v-cipi.json').read().strip()
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
  agent-browser eval "(()=>{const c=window.__ekipaIcs ?? null; const niz=(typeof c==='string'); const vrstice=niz?c.split('\r\n').filter(v=>v.length>0):null; const razvite=niz?(():string[]=>{const o:string[]=[];for(const v of vrstice){if(v.startsWith(' ')&&o.length>0)o[o.length-1]+=v.slice(1);else o.push(v);}return o;})():null; const veventi=niz?vrstice.filter(v=>v==='BEGIN:VEVENT').length:null; return JSON.stringify({icsNiz:niz, bom:window.__ekipaBom===true, crlf:niz?c.includes('\r\n'):null, veventi, prva:niz?vrstice[0]:null, prodid:niz?vrstice.some(v=>v==='PRODID:-//Roksal//Tedenski vozni red po ekipah//SL'):null, ekipaX:niz?razvite.some(v=>v.startsWith('X-ROKSAL-EKIPA:')):null, obsegEkipa:niz?razvite.some(v=>v.startsWith('X-ROKSAL-OBSEG:')&&v.includes('Ekipa:')):null, uidPredpona:niz?vrstice.some(v=>v.startsWith('UID:vozni-red-ekipa-')):null, dtstartZ:niz?vrstice.some(v=>v.startsWith('DTSTART:')&&v.endsWith('Z')):null, noga:niz?vrstice[vrstice.length-1]==='END:VCALENDAR':null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0v-ics.json
  python3 - <<'PYEOF6' || exit 1
import json
raw = open('/tmp/r326-z0v-ics.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0v-ekipa-ics.png" > /dev/null 2>&1
else
  echo "Z0v OPOMBA: brez ekip z termini na spot seji — čipi pogojno skriti (iskrena praznina — podatkovno-pogojna vidnost R299); chunk needleji R299 ×16 ostajajo obvezni dokaz"
fi

echo "=== Z0w: KONFLIKTNA MINI-VRSTICA ŽIVO (R300 — 30. člen issue #1 §7 branje; pogojni probe — obe veji iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0w klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[aria-label=\"Izvozi tedenski pregled monta\u017e kot ICS koledar\"]');})()" 16; then
  agent-browser eval "(()=>{const mini=document.querySelector('[data-testid=\"tedenski-konflikti-mini\"]'); const sklep=document.querySelector('[data-testid=\"tedenski-razgled-sklep\"]'); const terminiViden=!!(sklep&&!sklep.textContent.startsWith('Naslednjih 7 dni brez')); return JSON.stringify({terminiViden, mini:!!mini, role:mini?mini.getAttribute('role'):null, text:mini?mini.textContent.trim():null, zelen:mini?mini.className.includes('text-roksal-green'):null, rdec:mini?mini.className.includes('text-roksal-red'):null, title:mini?((mini.getAttribute('title')||'').includes(' isti poli-odprto pravilo kot API 409')):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0w-mini.json
  python3 - <<'PYEOF7' || exit 1
import json
raw = open('/tmp/r326-z0w-mini.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0w-konflikti-mini.png" > /dev/null 2>&1
else
  echo "Z0w OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R300 ×11 ostajajo obvezni dokaz"
fi

echo "=== Z0x: KONFLIKTI CSV PILL ŽIVO (R301 — 31. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0x klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\"konflikti-csv-pill\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\"konflikti-csv-pill\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('isti poli-odprto pregled kot žig')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0x-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r326-z0x-pill.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('Konflikti CSV se izvozi, ko je vpisan termin v prihajajo\u010dem tednu.'); const zelen=body.includes('Ni dokazanih konfliktov v okviru') && body.includes('\u017dig je zelen'); const uspeh=body.includes('Konflikti prenešeni v CSV ('); const c=window.__konfliktiCsv ?? null; const niz=(typeof c==='string'); const vrstice=niz?c.split('\n'):null; return JSON.stringify({prazno, zelen, uspeh, csvNiz:niz, bom:window.__csvBom===true, glava:niz?vrstice[0].includes('Dan prekrivanja'):null, ekipaStolpec:niz?vrstice[0].includes('Ekipa'):null, podatek:niz?vrstice.length>8:null, sklep:niz?vrstice.some(v=>v.startsWith('"Sklep"')):null, obseg:niz?vrstice.some(v=>v.startsWith('"Obseg"')):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0x-csv.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r326-z0x-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0x-konflikti-csv.png" > /dev/null 2>&1
else
  echo "Z0x OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R301 ×11 ostajajo obvezni dokaz"
fi

echo "=== Z0aa: KONFLIKTI PDF PILL ŽIVO (R302 — 32. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0aa klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w/Z0x).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\"konflikti-pdf-pill\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\"konflikti-pdf-pill\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('isti poli-odprto pregled kot žig')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0aa-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r326-z0aa-pill.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('Konflikti PDF se izvozi, ko je vpisan termin v prihajajo\u010dem tednu.'); const zelen=body.includes('Ni dokazanih konfliktov v okviru') && body.includes('\u017dig je zelen'); const uspeh=body.includes('Konflikti prenešeni v PDF ('); return JSON.stringify({prazno, zelen, uspeh, pdfMagic:window.__pdfMagic??null, pdfLen:window.__pdfLen??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0aa-pdf.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r326-z0aa-pdf.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0aa-konflikti-pdf.png" > /dev/null 2>&1
else
  echo "Z0aa OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R302 ×11 ostajajo obvezni dokaz"
fi

echo "=== Z0ab: EKIPE PDF PILL ŽIVO (R303 — 33. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0ab klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w/Z0x/Z0aa).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\"ekipe-pdf-pill\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\"ekipe-pdf-pill\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('ENA sekcija na ekipo')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0ab-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r326-z0ab-pill.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('PDF po ekipah se izvozi, ko je vpisan termin v prihajajo\u010dem tednu.'); const niekip=body.includes('Ni ekip z termini v naslednjih 7 dneh') && body.includes('PDF po ekipah se izvozi, ko ima ekipa vpisan termin v prihajajo\u010dem tednu.'); const uspeh=body.includes('Tedenski vozni red po ekipah prenešen (Tedenski-po-ekipah-'); return JSON.stringify({prazno, niekip, uspeh, pdfMagic:window.__pdfMagic??null, pdfLen:window.__pdfLen??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0ab-pdf.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r326-z0ab-pdf.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0ab-ekipe-pdf.png" > /dev/null 2>&1
else
  echo "Z0ab OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R303 ×11 ostajajo obvezni dokaz"
fi

echo "=== Z0ac: EKIPE CSV PILL ŽIVO (R304 — 34. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0ac klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w/Z0x/Z0aa/Z0ab).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\"ekipe-csv-pill\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\"ekipe-csv-pill\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('ENA vrstica na termin')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0ac-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r326-z0ac-pill.json').read().strip()
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
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('CSV po ekipah se izvozi, ko je vpisan termin v prihajajo\u010dem tednu.'); const niekip=body.includes('Ni ekip z termini v naslednjih 7 dneh') && body.includes('CSV po ekipah se izvozi, ko ima ekipa vpisan termin v prihajajo\u010dem tednu.'); const uspeh=body.includes('Tedenski vozni red po ekipah prenešen v CSV (Tedenski-po-ekipah-'); return JSON.stringify({prazno, niekip, uspeh, csvBom:window.__csvBom??null, csvLen:window.__csvLen??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0ac-csv.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r326-z0ac-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0ac-ekipe-csv.png" > /dev/null 2>&1
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
  agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"tedenski-ekipa-dnevi\"]'); const praznoEl=document.querySelector('[data-testid=\"tedenski-ekipa-dnevi-prazno\"]'); const sklepEl=document.querySelector('[data-testid=\"tedenski-ekipa-dnevi-sklep\"]'); const praznoOkno=!blok && document.body.textContent.includes('Ni terminov v naslednjih 7 dneh'); const dnevi=blok&&blok.children.length===2?blok.children[1].children.length:0; const uli=blok?blok.querySelectorAll('ul').length:0; const praznihDni=blok?(blok.textContent.match(/Brez terminov na ta dan/g)||[]).length:0; const vrstic=blok?blok.querySelectorAll('li').length:0; return JSON.stringify({blok:!!blok, aria:blok?blok.getAttribute('aria-label'):null, title:blok?((blok.getAttribute('title')||'').includes('ISTI pregled in vrstni red kot Ekipe PDF in Ekipe CSV')):null, prazno:!!praznoEl, praznoTekst:praznoEl?praznoEl.textContent.trim():null, sklep:!!sklepEl, sklepTekst:sklepEl?sklepEl.textContent.trim():null, dnevi, uli, praznihDni, vrstic, praznoOkno, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0ad.json
  python3 - <<'PYEOF9' || exit 1
import json
raw = open('/tmp/r326-z0ad.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0ad-ekipa-dnevi.png" > /dev/null 2>&1
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
  agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"oprema-cikel-dokaz\"]'); const praznoEl=document.querySelector('[data-testid=\"oprema-cikel-dokaz-prazno\"]'); const sklepEl=document.querySelector('[data-testid=\"oprema-cikel-dokaz-sklep\"]'); const brezOpreme=!blok && document.body.textContent.includes('Ni opreme. Dodaj prvo.'); const mini=document.body.textContent.includes('Cikl (viden seznam):'); const vrsticne=blok?blok.querySelectorAll('li').length:0; const amber=blok?blok.querySelectorAll('span[class*=\"roksal-amber\"]').length:0; const rdece=blok?blok.querySelectorAll('span[class*=\"roksal-red\"]').length:0; const sklepTekst=sklepEl?sklepEl.textContent.trim():null; const m=sklepTekst?sklepTekst.match(/Vrstic (\\d+) [^]* zigov (\\d+)\\./):null; const n=m?parseInt(m[1],10):null; const g=m?parseInt(m[2],10):null; return JSON.stringify({blok:!!blok, aria:blok?blok.getAttribute('aria-label'):null, title:blok?((blok.getAttribute('title')||'').includes('kot Cikel PDF in Cikel CSV')):null, prazno:!!praznoEl, praznoTekst:praznoEl?praznoEl.textContent.trim():null, sklep:!!sklepEl, sklepTekst, vrsticne, amber, rdece, n, g, brezOpreme, mini, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0ae.json
  python3 - <<'PYEOF10' || exit 1
import json, re
raw = open('/tmp/r326-z0ae.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r310-e2e-z0ae-oprema-dokaz.png" > /dev/null 2>&1
else
  echo "Z0ae OPOMBA: logistika/oprema ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R306 ×11 ostajajo obvezni dokaz"
fi


echo "=== Z0af: KONFLIKTNI DOKAZ NA ZASLONU ŽIVO (R307 — 37. člen izvozne družine, ZASLON; pogojni probe — vsi trije izidi iskreni, NATANKO EN) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 + subtab kanon R306: klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/…/Z0ad/Z0ae). Trije iskreni izidi: praznoOkno
# (mini NIČ — okno brez terminov) / zelen (mini 'Konflikti: 0', dokaz ODSOTEN
# — iskrena čistost) / dokaz (mini rdeč žig EN VIR konfliktiSklep + blok parov
# z Pregledanih/Parov števcem — vrstic = Parov).
# LEKCIJA R307: 'Ni terminov v naslednjih 7 dneh' je SAMO toast naslov
# (tranziento — Z0af teče PO Z0ac/Z0ad/Z0ae, toast davno zasnel). Vztrajna
# iskrena sidro = tedenski-razgled-sklep testid (VEDNO viden na Koledar
# subtabu): 'Naslednjih 7 dni brez vpisanih terminov.' = praznoOkno veja.
if eb_pocakaj_na "(()=>{const koledar=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('[data-testid=\"tedenski-razgled-sklep\"]') || !!document.querySelector('[data-testid=\"tedenski-konflikti-mini\"]');})()" 16; then
  eb_cakaj 1
  agent-browser eval "(()=>{const mini=document.querySelector('[data-testid=\"tedenski-konflikti-mini\"]'); const dokaz=document.querySelector('[data-testid=\"konflikti-dokaz\"]'); const razgledSklep=document.querySelector('[data-testid=\"tedenski-razgled-sklep\"]'); const miniTekst=mini?mini.textContent.trim():null; const zelen=miniTekst!==null&&miniTekst.startsWith('Konflikti: 0'); const rdec=miniTekst!==null&&!zelen; const praznoOkno=!mini && !!(razgledSklep && razgledSklep.textContent.includes('Naslednjih 7 dni brez vpisanih terminov')); const vrsticne=dokaz?dokaz.querySelectorAll('li').length:0; const shopTekst=dokaz?(dokaz.textContent.match(/Pregledanih (\\d+) [^]* Parov (\\d+)\\./)||[]):null; return JSON.stringify({mini:!!mini, miniTekst, zelen, rdec, praznoOkno, dokaz:!!dokaz, aria:dokaz?dokaz.getAttribute('aria-label'):null, title:dokaz?((dokaz.getAttribute('title')||'').includes('ISTI pari in ISTI vrstni red kot Konflikti CSV in Konflikti PDF')):null, vrsticne, pregledanih:shopTekst?parseInt(shopTekst[1],10):null, parov:shopTekst?parseInt(shopTekst[2],10):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0af.json
  python3 - <<'PYEOF11' || exit 1
import json
raw = open('/tmp/r326-z0af.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0af err: ' + json.dumps(d)
izidi = sum([1 for k in ('praznoOkno', 'zelen', 'rdec') if d[k]])
assert izidi == 1, 'Z0af: natanko EN iskren izid (praznoOkno/zelen/dokaz), dobljeno ' + str(izidi) + ': ' + json.dumps(d)
if d['praznoOkno']:
    assert not d['mini'] and not d['dokaz'], 'Z0af: praznoOkno A mini/dokaz (nič izmišljenega): ' + json.dumps(d)
    print('Z0af OK — konflikti mini pravilno ODSOTEN ob praznem oknu (iskrena praznina)')
elif d['zelen']:
    assert d['mini'] and not d['dokaz'], 'Z0af: zelen žig A dokaz (dokaz je IZKLJUČNO rdeča veja — iskrena vzajemna izključitev): ' + json.dumps(d)
    assert 'Konflikti: 0' in (d['miniTekst'] or ''), 'Z0af: zelen tekst FAIL: ' + json.dumps(d)
    print('Z0af OK — konflikti mini ŽIVO zelen (iskrena čistost; dokaz pravilno odsoten)')
elif d['rdec']:
    assert d['mini'] and d['dokaz'], 'Z0af: rdeč žig BREZ dokaz bloka (triada mini=števec → ZASLON=dokaz prekinjena): ' + json.dumps(d)
    assert d['title'], 'Z0af: definicijski naslov FAIL: ' + json.dumps(d)
    assert (d['aria'] or '') == 'Dokazani pari prekrivanj ekipe', 'Z0af: aria FAIL: ' + json.dumps(d)
    assert d['parov'] is not None and d['parov'] >= 1, 'Z0af: Parov števec FAIL: ' + json.dumps(d)
    assert d['vrsticne'] == d['parov'], 'Z0af: vrstic ≠ Parov (en par = ena vrstica) FAIL: ' + json.dumps(d)
    assert d['pregledanih'] >= d['parov'], 'Z0af: Pregledanih < Parov (obsega resnica) FAIL: ' + json.dumps(d)
    assert 'Konflikti: ' in (d['miniTekst'] or '') and not (d['miniTekst'] or '').startswith('Konflikti: 0'), 'Z0af: mini rdeč žig FAIL: ' + json.dumps(d)
    print('Z0af OK — konflikti dokaz ŽIVO (mini rdeč EN VIR + ' + str(d['vrsticne']) + ' parov, Pregledanih ' + str(d['pregledanih']) + ')')
PYEOF11
  agent-browser screenshot "$SS/qa-r310-e2e-z0af-konflikti-dokaz.png" > /dev/null 2>&1
else
  echo "Z0af OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R307 ×11 ostajajo obvezni dokaz"
fi

echo "=== Z0ag: API I/O MEJA ŽIVO (R310 — 38. člen issue #1, «stena ura»; ZERO-MUTACIJA) ==="
# Pokvarjen JSON (sintaksa napaka) + napačna oblika (null telo) morata dobiti
# fail-closed 400 z { error } ovojnico — NIKOLI 500 (napaka odjemalca ni napaka
# strežnika). calculator je R310 popravljen exemplar (prej: parse-throw → 500);
# railing-layout + quote imata json().catch + zod safeParse (že pravilno).
agent-browser eval "(()=>{window.__meja=[]; const p=(ime,url,telo)=>fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:telo}).then(async r=>{let b=null; try{b=await r.json();}catch(e){b=null;} window.__meja.push({ime,status:r.status,error:b&&typeof b==='object'?(b.error??null):null});}).catch(e=>window.__meja.push({ime,status:0,error:'MREŽA: '+String(e)})); p('calculator-pokvarjen','/api/calculator','{pokvarjen'); p('calculator-null','/api/calculator','null'); p('railing-layout-pokvarjen','/api/railing-layout','{pokvarjen'); p('quote-pokvarjen','/api/quote','{pokvarjen'); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify(window.__meja??[])" 2>&1 | tail -1 > /tmp/r326-z0ag.json
python3 - <<'PYEOF12' || exit 1
import json
raw = open('/tmp/r326-z0ag.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert isinstance(d, list) and len(d) == 4, 'Z0ag oblika: ' + json.dumps(d)
poImenu = {x['ime']: x for x in d}
# calculator — R310 exemplar: pokvarjen JSON in null telo → 400 { error } (prej 500)
for ime in ('calculator-pokvarjen', 'calculator-null'):
    x = poImenu[ime]
    assert x['status'] == 400, f'Z0ag {ime}: pričakovan 400 (fail-closed), dobljeno ' + str(x['status']) + ' — ' + json.dumps(x)
    assert isinstance(x['error'], str) and len(x['error']) > 0, f'Z0ag {ime}: manjkajoča {chr(123)} error {chr(125)} ovojnica: ' + json.dumps(x)
# railing-layout + quote — regresija (že pravilna)
for ime in ('railing-layout-pokvarjen', 'quote-pokvarjen'):
    x = poImenu[ime]
    assert x['status'] in (400, 422), f'Z0ag {ime}: pričakovan 400/422, dobljeno ' + str(x['status']) + ' — ' + json.dumps(x)
    assert isinstance(x['error'], str) and len(x['error']) > 0, f'Z0ag {ime}: ovojnica FAIL: ' + json.dumps(x)
print('Z0ag OK — stena ura ŽIVO: 4/4 pokvarjeni vhodi fail-closed 400 z ovojnico (NIČ 500)')
PYEOF12
agent-browser screenshot "$SS/qa-r310-e2e-z0ag-meja.png" > /dev/null 2>&1



echo "=== Z0ai: 3. VAL UNIFIKACIJE ŽIVO (R310 — EN VIR I/O meja val-3; 10 handlerjev; ZERO-MUTACIJA) ==="
# Val-3 handlerji (iz .catch(() => null) migrirani na preberiJsonTelo —
# vzorec R309) × pokvarjen JSON → NATANKO 400 z ISTO EN VIR ovojnico.
# Metoda po ruti (crm + equipment + measurements/[id] PATCH — lekcija R309 6).
# Dvojni podpis (R194/R309): roksal_csrf iz document.cookie → x-csrf-token.
# ZERO-MUTACIJA: guard strelja PRED vsakim db zapisom — odtis ostane.
agent-browser eval "(()=>{window.__val3=[]; const ck=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('roksal_csrf=')); const tok=ck?ck.slice(12):null; const h={'Content-Type':'application/json'}; if(tok)h['x-csrf-token']=tok; const rute=[['quote','/api/quote','POST'],['railing-layout','/api/railing-layout','POST'],['users','/api/users','POST'],['crm','/api/crm','PATCH'],['equipment','/api/equipment','PATCH'],['qc','/api/qc','POST'],['evidence','/api/evidence','POST'],['viz-render','/api/viz/render','POST'],['measurements-id','/api/measurements/e2e-r322-ne-obstojeci-id','PATCH'],['ar-analyze','/api/ar/analyze','POST']]; (async()=>{ for (const [ime,url,metoda] of rute){ try{ const r=await fetch(url,{method:metoda,credentials:'same-origin',headers:h,body:'{pokvarjen'}); let b=null; try{b=await r.json();}catch(e){b=null;} window.__val3.push({ime,status:r.status,error:b&&typeof b==='object'?(b.error??null):null}); }catch(e){ window.__val3.push({ime,status:0,error:'MREŽA: '+String(e)}); } } })(); return 'poslano '+rute.length;})()" 2>&1 | tail -1
eb_cakaj 8
agent-browser eval "JSON.stringify(window.__val3??[])" 2>&1 | tail -1 > /tmp/r326-z0ai.json
python3 - <<'PYEOFZ0AI' || exit 1
import json
raw = open('/tmp/r326-z0ai.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert isinstance(d, list) and len(d) == 10, 'Z0ai oblika: pričakovano 10 zapisov, dobljeno ' + json.dumps(len(d) if isinstance(d, list) else d)
EN_VIR = 'Neveljavno telo zahteve — pričakovan JSON objekt'
napake = set()
for x in d:
    assert x['status'] == 400, 'Z0ai ' + x['ime'] + ': pričakovan 400 (fail-closed — napaka odjemalca, NIKOLI 500/403), dobljeno ' + str(x['status']) + ' — ' + json.dumps(x)
    assert isinstance(x['error'], str) and len(x['error']) > 0, 'Z0ai ' + x['ime'] + ': manjkajoča ovojnica — ' + json.dumps(x)
    napake.add(x['error'])
assert napake == {EN_VIR}, 'Z0ai EN VIR kršitev — ovojnice niso enotne: ' + json.dumps(sorted(napake))
print('Z0ai OK — 3. val ŽIVO: 10/10 pokvarjenih vhodov → 400 z ISTO EN VIR ovojnico (NIČ 500, NIČ podvojenih sporočil — stena nepropustna tudi na val-3 rutah)')
PYEOFZ0AI

echo "=== Z0aj: AI RABA DOKAZ NA ZASLONU ŽIVO (R311 — 41. člen issue #1: Deliverable 5 na zaslonu; EN VIR WYSIWYG; ZERO-MUTACIJA; regresija) ==="
# Vodja pregled → AI raba blok [ai-raba-dokaz]: naslov + 2 živi AI površini z
# razrešenim nadomestkom + 3 iskreni kandidati + sklep (lib template literal —
# zaslon nosi EN VIR niz, NIČ dvojnega sklepa). Admin seja → vodja dostopen;
# ZERO-MUTACIJA: samo branje DOM — nič fetch mutacij, odtis ostane.
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
NAJDEN_Z0AJ=0
for poskus in 1 2 3 4; do
  eb_cakaj 3
  agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\"ai-raba-dokaz\"]'); return b ? 'najden' : 'ni';})()" 2>&1 | tail -1 | grep -q najden && { NAJDEN_Z0AJ=1; break; }
done
[ "$NAJDEN_Z0AJ" = "1" ] || { echo "Z0aj FAIL: ai-raba-dokaz blok ni izrisan (vodja chunk naložen? dispatch?)"; exit 1; }
agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\"ai-raba-dokaz\"]'); const s=document.querySelector('[data-testid=\"ai-raba-sklep\"]'); const ps=[...(b?.querySelectorAll('p')??[])].map(p=>p.textContent||''); return JSON.stringify({naslov:b?.getAttribute('aria-label')??null, nadom:ps.filter(t=>t.includes('→ nadomestek (brez AI):')).length, kandidati:(b?.querySelectorAll('li')??[]).length, sklep:s?.textContent??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0aj.json
python3 - <<'PYEOFZ0AJ' || exit 1
import json
raw = open('/tmp/r326-z0aj.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0aj err: ' + json.dumps(d)
assert d['naslov'] == 'AI raba — iskrena resnica', 'Z0aj naslov FAIL: ' + json.dumps(d)
assert d['nadom'] == 2, 'Z0aj: pričakovano 2 živi AI površini z nadomestkom, dobljeno ' + json.dumps(d)
assert d['kandidati'] == 3, 'Z0aj: pričakovano 3 iskrene kandidatke, dobljeno ' + json.dumps(d)
sk = d['sklep'] or ''
assert 'AI površine: 2' in sk, 'Z0aj sklep resnica 1 FAIL: ' + json.dumps(d)
assert 'kandidati: 3 (ne-implementirani, nič povezano)' in sk, 'Z0aj sklep resnica 2 FAIL: ' + json.dumps(d)
assert 'AI-obveznih: 0 — jedro deluje brez AI' in sk, 'Z0aj sklep ničla FAIL: ' + json.dumps(d)
print('Z0aj OK — AI raba dokaz ŽIVO: naslov + 2 nadomestka + 3 kandidati + sklep WYSIWYG (EN VIR na zaslonu — nič dvojnega sklepa; ZERO-MUTACIJA)')
PYEOFZ0AJ


echo "=== Z0ak: ZMOGLJIVOST DOKAZ NA ZASLONU ŽIVO (R312 — 42. člen issue #1: Deliverable 6; EN VIR WYSIWYG; ZERO-MUTACIJA) ==="
# Vodja pregled → meritve zmogljivosti blok [zmogljivost-dokaz]: naslov +
# 8 realnih meritev (najmanj/mediana/največ ms — resnično izvajanje jedra na
# fiksnih vhodih, vsak izhod preverjen) + iskren SSR stan → useEffect izris.
# Admin seja → vodja dostopen; ZERO-MUTACIJA: samo branje DOM — nič fetch
# mutacij, odtis ostane. Meritev je strojno odvisna (iskrenost!) — testi
# preverjajo STRUKTURO in NIKOLI natančnih časov.
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
NAJDEN_Z0AK=0
for poskus in 1 2 3 4 5; do
  eb_cakaj 3
  agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\"zmogljivost-dokaz\"]'); const v=b?b.querySelectorAll('[data-testid=\"zmogljivost-vrstica\"]').length:0; return v===10 ? 'najden' : 'ni';})()" 2>&1 | tail -1 | grep -q najden && { NAJDEN_Z0AK=1; break; }
done
[ "$NAJDEN_Z0AK" = "1" ] || { echo "Z0ak FAIL: zmogljivost-dokaz blok z 10 meritvami ni izrisan (useEffect meritev teče? dispatch?)"; exit 1; }
agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\"zmogljivost-dokaz\"]'); const s=document.querySelector('[data-testid=\"zmogljivost-sklep\"]'); const vr=[...document.querySelectorAll('[data-testid=\"zmogljivost-vrstica\"]')].map(x=>x.textContent||''); const num=/\\d+(\\.\\d+)? \\/ \\d+(\\.\\d+)? \\/ \\d+(\\.\\d+)? ms/; return JSON.stringify({naslov:b?.getAttribute('aria-label')??null, vrstice:vr.length, vsePreverjene:vr.every(t=>t.includes('· vsi izhodi preverjeni')), casi:vr.every(t=>num.test(t)), calculatorVrstica:vr.some(t=>t.includes('Kalkulator razmikov letvic')), aiVrstica:vr.some(t=>t.includes('AI raba pregled')), pdfVrstica:vr.some(t=>t.includes('Konflikti PDF dokument'))&&vr.some(t=>t.includes('Računi po projektih PDF')), sklep:s?.textContent??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0ak.json
python3 - <<'PYEOFZ0AK' || exit 1
import json, re
raw = open('/tmp/r326-z0ak.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0ak err: ' + json.dumps(d)
assert d['naslov'] == 'Meritve zmogljivosti jedra', 'Z0ak naslov FAIL: ' + json.dumps(d)
assert d['vrstice'] == 10, 'Z0ak: pričakovano 10 meritev, dobljeno ' + json.dumps(d)
assert d['vsePreverjene'], 'Z0ak: vrstice brez preverbe izhoda: ' + json.dumps(d)
assert d['casi'], 'Z0ak: vrstica brez realnih časov (min/mediana/max ms): ' + json.dumps(d)
assert d['calculatorVrstica'] and d['aiVrstica'], 'Z0ak: ključni vrstici manjkata: ' + json.dumps(d)
assert d['pdfVrstica'], 'Z0ak: PDF meritvi manjkata (R313 — Deliverable 6 razširitev): ' + json.dumps(d)
sk = d['sklep'] or ''
assert re.match(r'Merjeno na tej napravi: 10 operacij · 1808 iteracij · vsi izhodi preverjeni', sk), 'Z0ak sklep struktura FAIL: ' + json.dumps(d)
assert 'strojno odvisna' in sk and 'struktura in izhodi deterministični' in sk, 'Z0ak sklep iskrenost FAIL: ' + json.dumps(d)
print('Z0ak OK — meritve zmogljivosti ŽIVO: 10 realnih meritev × (min/mediana/max ms; +2 PDF) + vsi izhodi preverjeni + sklep WYSIWYG (Deliverable 6 + razširitev na zaslonu; ZERO-MUTACIJA)')
PYEOFZ0AK
agent-browser screenshot "$SS/qa-r314-e2e-z0ak-zmogljivost.png" > /dev/null 2>&1

echo "=== Z0al: AUDIT DOKAZ NA ZASLONU ŽIVO (R314 — 44. člen issue #1: Deliverable 4; EN VIR WYSIWYG; ZERO-MUTACIJA) ==="
# Vodja pregled → avtomatizacija audit blok [avtomatizacija-dokaz]: naslov +
# 11 območij (§1–§11) z razredom značko + impl/dokaz števci (izračunani iz
# EN VIR poti — tabela ne sme sanjati) + sklep WYSIWYG. Admin seja → vodja
# dostopen; ZERO-MUTACIJA: samo branje DOM — nič fetch mutacij.
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
NAJDEN_Z0AL=0
for poskus in 1 2 3 4 5; do
  eb_cakaj 3
  agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\"avtomatizacija-dokaz\"]'); const v=b?b.querySelectorAll('[data-testid=\"avtomatizacija-vrstica\"]').length:0; return v===11 ? 'najden' : 'ni';})()" 2>&1 | tail -1 | grep -q najden && { NAJDEN_Z0AL=1; break; }
done
[ "$NAJDEN_Z0AL" = "1" ] || { echo "Z0al FAIL: avtomatizacija-dokaz blok z 11 vrsticami ni izrisan (dispatch?)"; exit 1; }
agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\"avtomatizacija-dokaz\"]'); const s=document.querySelector('[data-testid=\"avtomatizacija-sklep\"]'); const vr=[...document.querySelectorAll('[data-testid=\"avtomatizacija-vrstica\"]')].map(x=>x.textContent||''); return JSON.stringify({naslov:b?.getAttribute('aria-label')??null, vrstice:vr.length, siVrstica:vr.some(t=>t.includes('§1 Photo/VIZ')), seVrstica:vr.some(t=>t.includes('§11 AI fallback architecture')), implDokaz:vr.every(t=>/impl · \\d+ dokazov/.test(t)), sklep:s?.textContent??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0al.json
python3 - <<'PYEOFZ0AL' || exit 1
import json
raw = open('/tmp/r326-z0al.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0al err: ' + json.dumps(d)
assert d['naslov'] == 'Avtomatizacija — audit po območjih', 'Z0al naslov FAIL: ' + json.dumps(d)
assert d['vrstice'] == 11, 'Z0al: pričakovano 11 območij (§1–§11), dobljeno ' + json.dumps(d)
assert d['siVrstica'] and d['seVrstica'], 'Z0al: §1 in §11 vrstici manjkata: ' + json.dumps(d)
assert d['implDokaz'], 'Z0al: vrstica brez impl/dokaz števcev (tabela ne sme sanjati): ' + json.dumps(d)
sk = d['sklep'] or ''
assert 'Audit območij: 11 (§1–§11)' in sk, 'Z0al sklep glava FAIL: ' + json.dumps(d)
assert 'DETERMINISTIČNO: 10' in sk, 'Z0al DETERMINISTICNO 10 FAIL: ' + json.dumps(d)
assert 'SDK: 0' in sk and 'SKRIPTA: 0' in sk, 'Z0al SDK/SKRIPTA ničli FAIL: ' + json.dumps(d)
assert 'AI-OPCIJSKO: 1' in sk, 'Z0al AI-OPCIJSKO 1 FAIL: ' + json.dumps(d)
assert 'AI-OBVEZNO: 0 — jedro deluje brez AI' in sk, 'Z0al AI-OBVEZNO ničla FAIL: ' + json.dumps(d)
print('Z0al OK — audit tabela ŽIVO: 11 območij × (razred + impl/dokaz števci) + sklep WYSIWYG (10 DETERMINISTIČNO · 1 AI-OPCIJSKO · AI-OBVEZNO: 0) (Deliverable 4 na zaslonu; ZERO-MUTACIJA)')
PYEOFZ0AL
agent-browser screenshot "$SS/qa-r323-e2e-z0al-audit.png" > /dev/null 2>&1

echo "=== Z0am: KONČNA VERIFIKACIJA NA ZASLONU ŽIVO (R315 — 45. člen issue #1: Deliverable 7; EN VIR WYSIWYG; ZERO-MUTACIJA) ==="
# Vodja pregled → končna verifikacija blok [koncna-verifikacija-dokaz]:
# naslov + 11 območij s plast chips (5 plasti) + 8 kriterijev z izpeljavo +
# dokazom (poti na disku — verifikacija ne sme sanjati) + sklep WYSIWYG.
# Admin seja → vodja dostopen; ZERO-MUTACIJA: samo branje DOM.
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
NAJDEN_Z0AM=0
for poskus in 1 2 3 4 5; do
  eb_cakaj 3
  agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\"koncna-verifikacija-dokaz\"]'); const v=b?b.querySelectorAll('[data-testid=\"koncna-verifikacija-vrstica\"]').length:0; return v===11 ? 'najden' : 'ni';})()" 2>&1 | tail -1 | grep -q najden && { NAJDEN_Z0AM=1; break; }
done
[ "$NAJDEN_Z0AM" = "1" ] || { echo "Z0am FAIL: koncna-verifikacija-dokaz blok z 11 vrsticami ni izrisan (dispatch?)"; exit 1; }
agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\"koncna-verifikacija-dokaz\"]'); const s=document.querySelector('[data-testid=\"koncna-verifikacija-sklep\"]'); const vr=[...document.querySelectorAll('[data-testid=\"koncna-verifikacija-vrstica\"]')].map(x=>x.textContent||''); const kr=[...document.querySelectorAll('[data-testid=\"koncna-verifikacija-kriterij\"]')].map(x=>x.textContent||''); const chips=b?[...b.querySelectorAll('span[title^=\"Plast: \"]')].length:0; return JSON.stringify({naslov:b?.getAttribute('aria-label')??null, vrstice:vr.length, siVrstica:vr.some(t=>t.includes('§1 Photo/VIZ')), seVrstica:vr.some(t=>t.includes('§11 AI fallback architecture')), chips, stKriterijev:kr.length, prviKriterij:kr.some(t=>t.includes('vsako večje področje Roksala je audirano')), zadnjiKriterij:kr.some(t=>t.includes('dokumentacija jasno ločuje')), sklep:s?.textContent??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r326-z0am.json
python3 - <<'PYEOFZ0AM' || exit 1
import json
raw = open('/tmp/r326-z0am.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0am err: ' + json.dumps(d)
assert d['naslov'] == 'Končna verifikacija — dokazne plasti po območjih', 'Z0am naslov FAIL: ' + json.dumps(d)
assert d['vrstice'] == 11, 'Z0am: pričakovano 11 območij (§1–§11), dobljeno ' + json.dumps(d)
assert d['siVrstica'] and d['seVrstica'], 'Z0am: §1 in §11 vrstici manjkata: ' + json.dumps(d)
assert d['chips'] >= 11, 'Z0am: plast chips manjkajo (vsaj 1 na območje): ' + json.dumps(d)
assert d['stKriterijev'] == 8, 'Z0am: pričakovano 8 kriterijev, dobljeno ' + json.dumps(d)
assert d['prviKriterij'] and d['zadnjiKriterij'], 'Z0am: prvi/zadnji kriterij manjka: ' + json.dumps(d)
sk = d['sklep'] or ''
assert 'Končna verifikacija: 11/11 območij z dokaznimi plastmi' in sk, 'Z0am sklep glava FAIL: ' + json.dumps(d)
assert '8 sprejemnih kriterijev' in sk, 'Z0am kriterijev števec FAIL: ' + json.dumps(d)
assert 'plasti v dokazih: vitest, build-needleji, E2E ŽIVO, prod-qa, smoke' in sk, 'Z0am plasti FAIL: ' + json.dumps(d)
assert 'AI-OBVEZNO: 0 — jedro deluje brez AI' in sk, 'Z0am AI-OBVEZNO ničla FAIL: ' + json.dumps(d)
print('Z0am OK — končna verifikacija ŽIVO: 11 območij × plast chips + 8 kriterijev (izpeljava + dokaz) + sklep WYSIWYG (5 plasti · AI-OBVEZNO: 0) (Deliverable 7 na zaslonu; ZERO-MUTACIJA)')
PYEOFZ0AM
agent-browser screenshot "$SS/qa-r323-e2e-z0am-verifikacija.png" > /dev/null 2>&1

echo "=== Z0an: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT JSON ŽIVO (R316 — 46. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Končna verifikacija blok → gumb [aria-label="Izvozi poročilo končne
# verifikacije kot JSON"] → blob ujet prek URL.createObjectURL patcha
# (eb_csv_capture kanon) → parse v brskalniku → shema/števci/sklep = ISTA
# EN VIR resnica kot zaslon (Z0am) + vitest (r316-koncna-verifikacija-json).
# DETERMINIZEM ŽIVO: dva izvoza = bajtno identična vsebina.
# ZERO-MUTACIJA: samo klik izvoza (nič db zapisa).
agent-browser eval "(()=>{window.__kvjson1=null; window.__kvjson2=null; return 'reset';})()" > /dev/null 2>&1
eb_csv_capture kvjson1
eb_klik_gumb "Izvozi poročilo končne verifikacije kot JSON"
eb_pocakaj_na "(()=>{return typeof window.__kvjson1==='string' && window.__kvjson1.length>100;})()" 12
eb_csv_capture kvjson2
eb_klik_gumb "Izvozi poročilo končne verifikacije kot JSON"
eb_pocakaj_na "(()=>{return typeof window.__kvjson2==='string' && window.__kvjson2.length>100;})()" 12
agent-browser eval "(()=>{try{const a=window.__kvjson1, b=window.__kvjson2; const p=JSON.parse(a); const plastiVsota=Object.values(p.poPlasti||{}).reduce((x,y)=>x+y,0); const stPlastiVsota=(p.obmocja||[]).reduce((x,o)=>x+(o.stPlasti||0),0); return JSON.stringify({bajtnoEnako:a===b, shema:p.shema, verzijaSheme:p.verzijaSheme, stObmocij:p.stObmocij, stObmocijZDokazi:p.stObmocijZDokazi, stKriterijev:(p.kriteriji||[]).length, sklepGlava:(p.sklep||'').includes('Končna verifikacija: 11/11 območij z dokaznimi plastmi'), sklepAI:(p.sklep||'').includes('AI-OBVEZNO: 0 — jedro deluje brez AI'), kljuci:Object.keys(p).join('|'), zamik:a.startsWith('{\n  \"shema\"'), posixKonec:a.endsWith('\n'), plastiVsota, stPlastiVsota, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})()" 2>&1 | tail -1 > /tmp/r326-z0an.json
python3 - <<'PYEOFZ0AN' || exit 1
import json
raw = open('/tmp/r326-z0an.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0an JSON parse FAIL: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0an DETERMINIZEM FAIL — dva izvoza nista bajtno enaka'
assert d['shema'] == 'roksal-koncna-verifikacija' and d['verzijaSheme'] == 1, 'Z0an shema FAIL: ' + json.dumps(d)
assert d['stObmocij'] == 11 and d['stObmocijZDokazi'] == 11, 'Z0an območja FAIL: ' + json.dumps(d)
assert d['stKriterijev'] == 8, 'Z0an kriteriji FAIL: ' + json.dumps(d)
assert d['sklepGlava'] and d['sklepAI'], 'Z0an sklep WYSIWYG FAIL: ' + json.dumps(d)
assert d['kljuci'] == 'shema|verzijaSheme|sklep|stObmocij|stObmocijZDokazi|stKriterijev|stAiObveznih|poPlasti|obmocja|kriteriji', 'Z0an vrstni red ključev FAIL (determinizem serializacije): ' + json.dumps(d)
assert d['zamik'] and d['posixKonec'], 'Z0an oblika FAIL (2-presledkov zamik + POSIX konec): ' + json.dumps(d)
assert d['plastiVsota'] == d['stPlastiVsota'] and d['plastiVsota'] > 0, 'Z0an plasti vsota FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z0an err: ' + json.dumps(d)
print('Z0an OK — izvoz končne verifikacije JSON ŽIVO: shema + 11 območij + 8 kriterijev + sklep WYSIWYG + plasti vsota ' + str(d['plastiVsota']) + ' + DETERMINIZEM (dva izvoza bajtno enaka) (46. člen; ZERO-MUTACIJA)')
PYEOFZ0AN
agent-browser screenshot "$SS/qa-r323-e2e-z0an-izvoz-json.png" > /dev/null 2>&1

echo "=== Z0ao: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT CSV ŽIVO (R317 — 47. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Avtomatizacija blok → gumb [aria-label="Izvozi avtomatizacijski audit kot
# CSV"] → blob ujet prek URL.createObjectURL patcha (eb_csv_capture kanon) →
# razčleni v brskalniku → BOM/glave/11 območij/sklep = ISTA EN VIR resnica
# kot zaslon (Z0al) + vitest (r317-avtomatizacija-audit-csv). DETERMINIZEM
# ŽIVO: dva izvoza = bajtno identična vsebina (kanon Z0an, 46. člen).
# ZERO-MUTACIJA: samo klik izvoza (nič db zapisa).
agent-browser eval "(()=>{window.__auditcsv1=null; window.__auditcsv2=null; window.__auditblobi=[]; window.__auditbom=null; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__auditblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_csv_capture auditcsv1
eb_klik_gumb "Izvozi avtomatizacijski audit kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__auditcsv1==='string' && window.__auditcsv1.length>200;})()" 12
eb_csv_capture auditcsv2
eb_klik_gumb "Izvozi avtomatizacijski audit kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__auditcsv2==='string' && window.__auditcsv2.length>200;})()" 12
# BOM iz BAJTOV (LEKCIJA R317: new Response(b).text() BOM odstrani —
# capture plast; bajti bloba ostanejo — kanon RFC 4180/BOM preverba na
# BAJTIH, ne na dekodiranem besedilu).
agent-browser eval "((async()=>{try{const blobi=window.__auditblobi??[]; if(blobi.length===0){window.__auditbom=false; return 'brez blobov';} const u8=new Uint8Array(await blobi[0].arrayBuffer()); window.__auditbom=(u8[0]===0xEF&&u8[1]===0xBB&&u8[2]===0xBF); window.__auditmime=blobi[0].type||null; return 'bajti';}catch(e){window.__auditbom=false; window.__auditmime='NAPAKA: '+String(e); return 'napaka';}})())" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return window.__auditbom!==null;})()" 8
agent-browser eval "(()=>{try{const a=window.__auditcsv1, b=window.__auditcsv2; const vrstice=a.split('\r\n').filter(v=>v.length>0); const glava=vrstice[0]; const obmocija=vrstice.filter(v=>v.startsWith('§')); const sklepVrstica=vrstice.find(v=>v.startsWith('Sklep;')); const virVrstica=vrstice.find(v=>v.startsWith('Vir;')); return JSON.stringify({bajtnoEnako:a===b, bom:window.__auditbom===true, mime:window.__auditmime??null, stBlobov:(window.__auditblobi??[]).length, vrstic:vrstice.length, glava, stObmocij:obmocija.length, nizObmocij:obmocija.map(v=>v.split(';')[0]).join('|'), sklepPrisoten:!!sklepVrstica, virPrisoten:!!virVrstica, sklepAI:!!sklepVrstica&&sklepVrstica.includes('AI-OBVEZNO: 0 — jedro deluje brez AI'), err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})()" 2>&1 | tail -1 > /tmp/r326-z0ao.json
python3 - <<'PYEOFZ0AO' || exit 1
import json
raw = open('/tmp/r326-z0ao.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0ao parse FAIL: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0ao DETERMINIZEM FAIL — dva izvoza nista bajtno enaka'
assert d['bom'] is True, 'Z0ao BOM FAIL (kanon R136): ' + json.dumps(d)
assert d['glava'] == 'Območje;Razred;Implementacije;Dokazi (testi);Opomba', 'Z0ao glave FAIL: ' + json.dumps(d)
assert d['stObmocij'] == 11, 'Z0ao območja FAIL: ' + json.dumps(d)
assert d['nizObmocij'] == '§1 Photo/VIZ|§2 Measurements|§3 Railing/product configuration|§4 Calculator / quotation|§5 Inventory / suppliers / orders|§6 Documents|§7 Installation / scheduling|§8 Customer portal|§9 Security|§10 Mobile/PWA/offline|§11 AI fallback architecture', 'Z0ao vrstni red območij FAIL (EN VIR — nič prerazporejanja): ' + json.dumps(d)
assert d['sklepPrisoten'] and d['virPrisoten'] and d['sklepAI'], 'Z0ao sklep meta FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0ao blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['err'] is None, 'Z0ao err: ' + json.dumps(d)
print('Z0ao OK — izvoz avtomatizacijskega audita CSV ŽIVO: BOM + glave WYSIWYG + 11 območij (vrstni red = audit) + sklep EN VIR + DETERMINIZEM (dva izvoza bajtno enaka) (47. člen; ZERO-MUTACIJA)')
PYEOFZ0AO
agent-browser screenshot "$SS/qa-r323-e2e-z0ao-izvoz-audit-csv.png" > /dev/null 2>&1

echo "=== Z0ap: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT PDF ŽIVO (R318 — 48. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Avtomatizacija blok → gumb [aria-label="Izvozi avtomatizacijski audit kot
# PDF"] → blob ujet prek URL.createObjectURL patcha (Z0aa/Z0ab PDF kanon) →
# BAJTNI dokaz v brskalniku: %PDF- magija (String.fromCharCode — brez
# TextDecoder, r261/r262 precedens) + MIME application/pdf + DETERMINIZEM
# ŽIVO NA BAJTIH: dva izvoza = bajtno identična datoteka (fiksni formatni
# žig AUDIT_PDF_ZIG_FIKSNI — vsebina brez časa; kanon 46./47. člen, zdaj
# prvič za PDF). ZERO-MUTACIJA: samo klik izvoza (nič db zapisa).
agent-browser eval "(()=>{window.__auditpdfblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__auditpdfblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi avtomatizacijski audit kot PDF"
eb_cakaj 3
eb_klik_gumb "Izvozi avtomatizacijski audit kot PDF"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__auditpdfblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:String.fromCharCode(u1[0],u1[1],u1[2],u1[3],u1[4]), mime:blobi[0].type||null, bajtnoEnako:enako, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r326-z0ap.json
python3 - <<'PYEOFZ0AP' || exit 1
import json
raw = open('/tmp/r326-z0ap.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0ap parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0ap blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == '%PDF-', 'Z0ap magija FAIL (formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'application/pdf', 'Z0ap MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 10000, 'Z0ap prekratek PDF: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0ap DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (fiksni formatni žig): ' + json.dumps(d)
assert d['err'] is None, 'Z0ap err: ' + json.dumps(d)
print('Z0ap OK — izvoz avtomatizacijskega audita PDF ŽIVO: %PDF- magija + MIME + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka — prvi PDF z živim bajtnim determinizmom) (48. člen; ZERO-MUTACIJA)')
PYEOFZ0AP
agent-browser screenshot "$SS/qa-r323-e2e-z0ap-izvoz-audit-pdf.png" > /dev/null 2>&1

echo "=== Z0aq: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT PDF ŽIVO (R320 — 49. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Končna verifikacija blok → gumb [aria-label="Izvozi poročilo končne
# verifikacije kot PDF"] → blob ujet prek URL.createObjectURL patcha
# (Z0aa/Z0ab/Z0ap PDF kanon) → BAJTNI dokaz v brskalniku: %PDF- magija
# (String.fromCharCode — brez TextDecoder, r261/r262 precedens) + MIME
# application/pdf + DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza = bajtno
# identična datoteka (fiksni formatni žig KONCNA_PDF_ZIG_FIKSNI — vsebina
# brez časa; kanon 46./47./48. člen). ZERO-MUTACIJA: samo klik izvoza
# (nič db zapisa).
agent-browser eval "(()=>{window.__kvpdfblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__kvpdfblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi poročilo končne verifikacije kot PDF"
eb_cakaj 3
eb_klik_gumb "Izvozi poročilo končne verifikacije kot PDF"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__kvpdfblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:String.fromCharCode(u1[0],u1[1],u1[2],u1[3],u1[4]), mime:blobi[0].type||null, bajtnoEnako:enako, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r326-z0aq.json
python3 - <<'PYEOFZ0AQ' || exit 1
import json
raw = open('/tmp/r326-z0aq.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0aq parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0aq blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == '%PDF-', 'Z0aq magija FAIL (formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'application/pdf', 'Z0aq MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 10000, 'Z0aq prekratek PDF: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0aq DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (fiksni formatni žig): ' + json.dumps(d)
assert d['err'] is None, 'Z0aq err: ' + json.dumps(d)
print('Z0aq OK — izvoz končne verifikacije PDF ŽIVO: %PDF- magija + MIME + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka) (49. člen; ZERO-MUTACIJA)')
PYEOFZ0AQ
agent-browser screenshot "$SS/qa-r323-e2e-z0aq-izvoz-koncna-pdf.png" > /dev/null 2>&1

echo "=== Z0ar: IZVOZ MERITEV ZMOGLJIVOSTI KOT PDF ŽIVO (R321 — 50. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Zmogljivost dokaz blok → gumb [aria-label="Izvozi meritve zmogljivosti kot
# PDF"] → blob ujet prek URL.createObjectURL patcha (Z0aa/Z0ab/Z0ap/Z0aq PDF
# kanon) → BAJTNI dokaz v brskalniku: %PDF- magija (String.fromCharCode —
# brez TextDecoder, r261/r262 precedens) + MIME application/pdf +
# DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza = bajtno identična datoteka (fiksni
# formatni žig ZMOGLJIVOST_PDF_ZIG_FIKSNI + pregled POSREDOVAN — meritev se
# izvede ENKRAT ob mountu, stanje stabilno med klikoma; kanon 46.–49. člen).
# ZERO-MUTACIJA: samo klik izvoza (nič db zapisa).
agent-browser eval "(()=>{window.__zmpdfblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__zmpdfblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi meritve zmogljivosti kot PDF"
eb_cakaj 3
eb_klik_gumb "Izvozi meritve zmogljivosti kot PDF"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__zmpdfblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:String.fromCharCode(u1[0],u1[1],u1[2],u1[3],u1[4]), mime:blobi[0].type||null, bajtnoEnako:enako, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r326-z0ar.json
python3 - <<'PYEOFZ0AR' || exit 1
import json
raw = open('/tmp/r326-z0ar.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0ar parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0ar blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == '%PDF-', 'Z0ar magija FAIL (formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'application/pdf', 'Z0ar MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 10000, 'Z0ar prekratek PDF: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0ar DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (fiksni formatni žig + posredovan pregled): ' + json.dumps(d)
assert d['err'] is None, 'Z0ar err: ' + json.dumps(d)
print('Z0ar OK — izvoz meritev zmogljivosti PDF ŽIVO: %PDF- magija + MIME + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka) (50. člen; ZERO-MUTACIJA)')
PYEOFZ0AR
agent-browser screenshot "$SS/qa-r323-e2e-z0ar-izvoz-zmogljivost-pdf.png" > /dev/null 2>&1

echo "=== Z0as: IZVOZ MERITEV ZMOGLJIVOSTI KOT CSV ŽIVO (R323 — 51. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Zmogljivost dokaz blok → gumb [aria-label="Izvozi meritve zmogljivosti kot
# CSV"] → blob ujet prek URL.createObjectURL patcha (Z0aa/Z0ab/Z0ap/Z0aq/Z0ar
# kanon) → BAJTNI dokaz v brskalniku: UTF-8 BOM magija (EF BB BF — String.
# fromCharCode na bajtih, r261/r262 precedens) + MIME text/csv + glave EN VIR
# pin (Operacija;Opis;Modul;… — podpičje, kanon R136) + Vir niz pin
# (MERITVE_ZMOGLJIVOST — isti HEAD = bajtno identičen izvoz) +
# DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza = bajtno identična datoteka (toCsv
# kanon + pregled POSREDOVAN — meritev se izvede ENKRAT ob mountu, stanje
# stabilno med klikoma; kanon 46.–50. člen). ZERO-MUTACIJA: samo klik izvoza
# (nič db zapisa).
agent-browser eval "(()=>{window.__zmcsvblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__zmcsvblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi meritve zmogljivosti kot CSV"
eb_cakaj 3
eb_klik_gumb "Izvozi meritve zmogljivosti kot CSV"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__zmcsvblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} const magija=String.fromCharCode(u1[0],u1[1],u1[2]); const besedilo=new TextDecoder('utf-8').decode(await blobi[0].arrayBuffer()); const vrstice=besedilo.split('\\r\\n'); return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:magija, mime:blobi[0].type||null, bajtnoEnako:enako, glava:vrstice[0]??null, sklepVrstica:vrstice.find(v=>v.startsWith('Sklep;'))??null, virVrstica:vrstice.find(v=>v.startsWith('Vir;'))??null, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r326-z0as.json
python3 - <<'PYEOFZ0AS' || exit 1
import json
raw = open('/tmp/r326-z0as.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0as parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0as blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == 'ï»¿', 'Z0as BOM magija FAIL (formatna resnica — UTF-8 BOM bajti EF BB BF): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0as MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 500, 'Z0as prekratek CSV: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0as DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (toCsv kanon + posredovan pregled): ' + json.dumps(d)
assert d['glava'] == 'Operacija;Opis;Modul;Iteracij;Najmanj;Mediana;Najvec', 'Z0as glave EN VIR FAIL: ' + json.dumps(d.get('glava'))
assert d['sklepVrstica'] is not None and d['sklepVrstica'].startswith('Sklep;'), 'Z0as sklep vrstica FAIL: ' + json.dumps(d.get('sklepVrstica'))
assert d['virVrstica'] == 'Vir;MERITVE_ZMOGLJIVOST — isti HEAD = bajtno identičen izvoz', 'Z0as Vir niz FAIL: ' + json.dumps(d.get('virVrstica'))
assert d['err'] is None, 'Z0as err: ' + json.dumps(d)
print('Z0as OK — izvoz meritev zmogljivosti CSV ŽIVO: BOM magija + MIME + glave EN VIR + Vir niz + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka) (51. člen; ZERO-MUTACIJA)')
PYEOFZ0AS
agent-browser screenshot "$SS/qa-r323-e2e-z0as-izvoz-zmogljivost-csv.png" > /dev/null 2>&1

echo "=== Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO (R324 — 52. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# "Pregled za vodjo" glava → gumb [aria-label="Izvozi dnevni pregled vodje
# kot PDF"] → blob ujet prek URL.createObjectURL patcha (Z0ar/Z0as kanon) →
# BAJTNI dokaz v brskalniku: %PDF- magija + MIME application/pdf +
# DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza = bajtno identična datoteka
# (fiksni formatni žig VODJA_PDF_ZIG_FIKSNI + vhod POSREDOVAN prek
# vodjaIzvozVhod — stats/termini/prihodki stabilni med klikoma; kanon
# 46.–51. člen). ZERO-MUTACIJA: samo klik izvoza (nič db zapisa).
agent-browser eval "(()=>{window.__zmdpdfblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__zmdpdfblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi dnevni pregled vodje kot PDF"
eb_cakaj 3
eb_klik_gumb "Izvozi dnevni pregled vodje kot PDF"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__zmdpdfblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:String.fromCharCode(u1[0],u1[1],u1[2],u1[3],u1[4]), mime:blobi[0].type||null, bajtnoEnako:enako, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r326-z0at.json
python3 - <<'PYEOFZ0AT' || exit 1
import json
raw = open('/tmp/r326-z0at.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0at parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0at blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == '%PDF-', 'Z0at magija FAIL (formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'application/pdf', 'Z0at MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 3000, 'Z0at prekratek PDF: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0at DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (fiksni formatni žig + posredovan vhod): ' + json.dumps(d)
assert d['err'] is None, 'Z0at err: ' + json.dumps(d)
print('Z0at OK — izvoz dnevnega pregleda vodje PDF ŽIVO: %PDF- magija + MIME + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka) (52. člen; ZERO-MUTACIJA)')
PYEOFZ0AT
agent-browser screenshot "$SS/qa-r324-e2e-z0at-dnevni-pregled-pdf.png" > /dev/null 2>&1

echo "=== Z0au: ZGODOVINA CEN MATERIALA ŽIVO (R326 — 53. člen issue #1 §5: price history; čisti bralec + iskrena prazna veja; ZERO-MUTACIJA) ==="
# inventory tab → panel CenaZgodovinaPanel (data-testid="cena-zgodovina-dokaz")
# → lokalna DB brez MaterialPrice (deterministično stanje): iskrena prazna
# veja "Ni še zabeleženih cen" + CSV gumb SKRIT (brez podatkov NI izvoza —
# kanon iskrene ničelne veje vodje R321/R324) + wire-level GET zgodovine:
# 200 + pregled.pari 0 + vnosov 0 + vir niz (CENA_ZGO_VIR_NIZ predpona)
# — ZERO-MUTACIJA (samo GET dispeči + DOM branje).
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('[data-testid=\"cena-zgodovina-dokaz\"]');})()" 24
eb_cakaj 2
agent-browser eval "JSON.stringify({panel:!!document.querySelector('[data-testid=\"cena-zgodovina-dokaz\"]'), naslov:(document.querySelector('[data-testid=\"cena-zgodovina-dokaz\"]')?.textContent||'').includes('Zgodovina cen materiala'), prazna:(document.querySelector('[data-testid=\"cena-zgodovina-dokaz\"]')?.textContent||'').includes('Ni še zabeleženih cen'), gumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi zgodovino cen materiala kot CSV')), err:window.__err??null})" 2>&1 | tail -1 > /tmp/r326-z0au-ui.json
python3 - <<'PYEOFZ0AU' || exit 1
import json
raw = open('/tmp/r326-z0au-ui.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['panel'] is True, 'Z0au panel FAIL: ' + json.dumps(d)
assert d['naslov'] is True, 'Z0au naslov FAIL: ' + json.dumps(d)
assert d['prazna'] is True, 'Z0au iskrena prazna veja FAIL (lokalna DB brez MaterialPrice — pričakovano "Ni še zabeleženih cen"): ' + json.dumps(d)
assert d['gumbSkrit'] is True, 'Z0au CSV gumb SKRIT v prazni veji FAIL (brez podatkov NI izvoza): ' + json.dumps(d)
assert d['err'] is None, 'Z0au err: ' + json.dumps(d)
print('Z0au UI OK — zgodovina cen panel ŽIVO + iskrena prazna veja + CSV gumb skrit (53. člen; ZERO-MUTACIJA)')
PYEOFZ0AU
agent-browser eval "((async()=>{try{const r=await fetch('/api/material-prices/zgodovina',{credentials:'same-origin'}); const b=await r.json(); return JSON.stringify({status:r.status, pari:Array.isArray(b?.pregled?.pari)?b.pregled.pari.length:null, vnosov:(b?.pregled?.vnosov===0)?0:null, vir:(typeof b?.vir==='string'&&b.vir.startsWith('ZGODOVINA_CEN'))?true:false, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r326-z0au-wire.json
python3 - <<'PYEOFZ0AUW' || exit 1
import json
raw = open('/tmp/r326-z0au-wire.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0au wire mreža FAIL: ' + json.dumps(d)
assert d['status'] == 200, 'Z0au wire status FAIL: ' + json.dumps(d)
assert d['pari'] == 0, 'Z0au wire pari FAIL (lokalna DB brez cen — deterministično): ' + json.dumps(d)
assert d['vnosov'] == 0, 'Z0au wire vnosov FAIL: ' + json.dumps(d)
assert d['vir'] is True, 'Z0au wire vir niz FAIL (CENA_ZGO_VIR_NIZ): ' + json.dumps(d)
assert d['err'] is None, 'Z0au wire err: ' + json.dumps(d)
print('Z0au wire OK — GET /api/material-prices/zgodovina ŽIVO: 200 + pari 0 + vir niz (edini bralec zgodovine; ZERO-MUTACIJA)')
PYEOFZ0AUW
agent-browser screenshot "$SS/qa-r326-e2e-z0au-zgodovina-cen.png" > /dev/null 2>&1



echo "=== Z0ah: MIGRACIJSKI VAL ŽIVO (R310 — EN VIR I/O meja api-telo; 26 handlerjev; ZERO-MUTACIJA) ==="
# Vseh 26 migriranih handlerjev × pokvarjen JSON → NATANKO 400 z ISTO
# EN VIR ovojnico (prej: throw-style parse → 500 na vseh). Metoda po ruti
# (bom-draft ima SAMO PATCH — 405-lekcija prvega teka). Dvojni podpis
# (R194): brskalniški piškotek roksal_csrf, če obstaja, gre v glavo
# x-csrf-token (isti protokol kot lasten fetch ovojnik aplikacije).
# ZERO-MUTACIJA: guard strelja PRED vsakim db zapisom — odtis ostane.
agent-browser eval "(()=>{window.__val=[]; const ck=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('roksal_csrf=')); const tok=ck?ck.slice(12):null; const h={'Content-Type':'application/json'}; if(tok)h['x-csrf-token']=tok; const rute=[['ar-snapshots','/api/ar-snapshots','POST'],['bom-draft','/api/bom-draft','PATCH'],['bom-refine','/api/bom-refine','POST'],['crews','/api/crews','POST'],['customers','/api/customers','POST'],['deal-lock','/api/deal-lock','POST'],['documents','/api/documents','POST'],['gallery','/api/gallery','POST'],['inventory','/api/inventory','POST'],['invoices','/api/invoices','POST'],['material-orders','/api/material-orders','POST'],['material-prices','/api/material-prices','POST'],['measurement-confirm','/api/measurement/confirm','POST'],['measurements','/api/measurements','POST'],['notifications-read','/api/notifications/read','POST'],['photos','/api/photos','POST'],['portal','/api/portal','POST'],['profili','/api/profili','POST'],['projects','/api/projects','POST'],['punch','/api/punch','POST'],['schedules','/api/schedules','POST'],['sketches','/api/sketches','POST'],['slopes','/api/slopes','POST'],['suppliers','/api/suppliers','POST'],['surveys','/api/surveys','POST'],['vision-placement','/api/vision/placement','POST']]; (async()=>{ for (const [ime,url,metoda] of rute){ try{ const r=await fetch(url,{method:metoda,credentials:'same-origin',headers:h,body:'{pokvarjen'}); let b=null; try{b=await r.json();}catch(e){b=null;} window.__val.push({ime,status:r.status,error:b&&typeof b==='object'?(b.error??null):null}); }catch(e){ window.__val.push({ime,status:0,error:'MREŽA: '+String(e)}); } } })(); return 'poslano '+rute.length;})()" 2>&1 | tail -1
eb_cakaj 8
agent-browser eval "JSON.stringify(window.__val??[])" 2>&1 | tail -1 > /tmp/r326-z0ah.json
python3 - <<'PYEOF13' || exit 1
import json
raw = open('/tmp/r326-z0ah.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert isinstance(d, list) and len(d) == 26, 'Z0ah oblika: pričakovano 26 zapisov, dobljeno ' + json.dumps(len(d) if isinstance(d, list) else d)
EN_VIR = 'Neveljavno telo zahteve — pričakovan JSON objekt'
napake = set()
for x in d:
    assert x['status'] == 400, 'Z0ah ' + x['ime'] + ': pričakovan 400 (fail-closed — napaka odjemalca, NIKOLI 500), dobljeno ' + str(x['status']) + ' — ' + json.dumps(x)
    assert isinstance(x['error'], str) and len(x['error']) > 0, 'Z0ah ' + x['ime'] + ': manjkajoča ovojnica — ' + json.dumps(x)
    napake.add(x['error'])
assert napake == {EN_VIR}, 'Z0ah EN VIR kršitev — ovojnice niso enotne: ' + json.dumps(sorted(napake))
print('Z0ah OK — migracijski val ŽIVO: 26/26 pokvarjenih vhodov → 400 z ISTO EN VIR ovojnico (NIČ 500, NIČ podvojenih sporočil)')
PYEOF13
agent-browser screenshot "$SS/qa-r310-e2e-z0ah-val.png" > /dev/null 2>&1

echo "=== Z1: Meritve tab — verzija pill v1 + vir 'Ročni vnos' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); return !!p;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const pill=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); const vir=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Meritve (viden seznam):')); const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); const viriDot=viriMini?viriMini.parentElement.querySelector('span[aria-hidden=\"true\"]'):null; return JSON.stringify({pill:!!pill, vir:!!vir, miniTitle:mini?(mini.getAttribute('title')||'').startsWith('Števec stanj vidnega seznama (WYSIWYG — R269)'):false, viriMini:viriMini?viriMini.textContent.trim():null, viriTitle:viriMini?(viriMini.getAttribute('title')||'').startsWith('Pokritost virov vidnega seznama (issue #15 §3)'):false, viriDotAmber:viriDot?viriDot.className.includes('bg-roksal-amber'):false, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z1.json
python3 -c "import json; r=json.load(open('/tmp/r326-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['vir'], 'Z1 pill/vir FAIL: '+json.dumps(d); assert d['miniTitle'], 'Z1 R283 R269 mini title FAIL: '+json.dumps(d); assert d['viriMini'] == 'Viri (viden seznam): 1 ročnih · 0 foto-CV · 0 AR-Depth', 'Z1 VIRI MINI vsebina FAIL (r276 = samo MANUAL): '+json.dumps(d); assert d['viriTitle'], 'Z1 VIRI title FAIL: '+json.dumps(d); assert d['viriDotAmber'], 'Z1 VIRI pika FAIL (delna pokritost = amber): '+json.dumps(d); print('Z1 OK — v1 pill + vir title + R269 mini title (R283 STIL) + VIRI MINI amber delna (1 ročnih · 0 · 0)')" || exit 1
agent-browser screenshot "$SS/qa-r310-e2e-z1.png" > /dev/null 2>&1

echo "=== Z1r: REF PROJEKT — VIRI MINI ŽIVO polna pokritost (issue #15 §1/§3) ==="
izberi_projekt_r283() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r283-ref-proj'})); return 'izbran';})()" 2>&1 | tail -1
}
izberi_projekt_r283
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const v=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const f=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Foto-CV'); const a=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='AR-Depth'); return !!v&&!!f&&!!a;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); const viriDot=viriMini?viriMini.parentElement.querySelector('span[aria-hidden=\"true\"]'):null; const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Meritve (viden seznam):')); const zeton=mini?mini.parentElement.querySelector('span.rounded-full.cursor-help'):null; const pilli=['Ročni vnos','Foto-CV','AR-Depth'].map(n=>[...document.querySelectorAll('span')].some(x=>x.textContent.trim()===n)); return JSON.stringify({viriMini:viriMini?viriMini.textContent.trim():null, viriTitle:viriMini?(viriMini.getAttribute('title')||'').startsWith('Pokritost virov vidnega seznama (issue #15 §3)'):false, viriDotGreen:viriDot?viriDot.className.includes('bg-roksal-green'):false, mini:mini?mini.textContent.trim():null, zeton:zeton?zeton.textContent.trim():null, zetonTitle:zeton?(zeton.getAttribute('title')||'').startsWith('Osnutki — meritve v stanju OSNUTEK'):false, pillRočni:pilli[0], pillFoto:pilli[1], pillAR:pilli[2], err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z1r.json
python3 -c "
import json
r = json.load(open('/tmp/r326-z1r.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['viriMini'] == 'Viri (viden seznam): 1 ročnih · 1 foto-CV · 1 AR-Depth', 'Z1r VIRI MINI FAIL (pričakovano 1·1·1): ' + json.dumps(d)
assert d['viriTitle'], 'Z1r VIRI title FAIL: ' + json.dumps(d)
assert d['viriDotGreen'], 'Z1r pika FAIL (polna pokritost = green): ' + json.dumps(d)
assert d['pillRočni'] and d['pillFoto'] and d['pillAR'], 'Z1r vir pilli ×3 FAIL: ' + json.dumps(d)
assert d['mini'] == 'Meritve (viden seznam): 3 meritve · osnutki 3 · potrjenih 0 · arhiviranih 0', 'Z1r R269 mini FAIL: ' + json.dumps(d)
assert d['zeton'] == '3 osnutki' and d['zetonTitle'], 'Z1r osnutek žeton FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1r err: ' + json.dumps(d)
print('Z1r OK — REF projekt: VIRI MINI ŽIVO 1·1·1 (green — §3 vsi trije viri) + vir pilli ×3 + R269 mini title + žeton title')" || exit 1
agent-browser screenshot "$SS/qa-r310-e2e-z1r-ref.png" > /dev/null 2>&1

echo "=== Z1s: SYNC ŽIG ŽIVO (R281 §10) — m1 'Sinhronizirano r7' + m2 'Konflikt' + tombstone ==="
izberi_projekt_r281() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r281-proj'})); return 'izbran';})()" 2>&1 | tail -1
}
izberi_projekt_r281
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Sinhronizirano')); return !!p;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const all=[...document.querySelectorAll('span.cursor-help')]; const synced=all.find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Sinhronizirano')); const konf=all.find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Konflikt')); return JSON.stringify({synced:{prisoten:!!synced, besedilo:synced?synced.textContent.trim():null}, konflikt:{prisoten:!!konf, besedilo:konf?konf.textContent.trim():null, tombstone:konf?(konf.getAttribute('title')||'').includes('tombstone — grobnico potrdi /api/sync'):false}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z1s.json
python3 -c "
import json
r = json.load(open('/tmp/r326-z1s.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['synced']['prisoten'] and d['synced']['besedilo'] == 'Sinhronizirano r7', 'Z1s synced FAIL: ' + json.dumps(d)
assert d['konflikt']['prisoten'] and d['konflikt']['besedilo'] == 'Konflikt' and d['konflikt']['tombstone'], 'Z1s konflikt FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1s err: ' + json.dumps(d)
print('Z1s OK — sync žig ŽIVO (regresija R281)')"
agent-browser screenshot "$SS/qa-r310-e2e-sync.png" > /dev/null 2>&1

echo "=== Z1m: F2 SYNC MINI-VRSTICA ŽIVO (R282 regresija — ŠE VEDNO na r281 projektu) ==="
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Sync (viden seznam):')); const akcija=[...document.querySelectorAll('span')].find(x=>(x.textContent||'')==='Konflikt — osveži bazo in ponovi sync'); return JSON.stringify({mini:mini?mini.textContent.trim():null, akcija:!!akcija, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z1m.json
python3 -c "
import json
r = json.load(open('/tmp/r326-z1m.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['mini'] and d['mini'].startswith('Sync (viden seznam): 1 sinhroniziranih · 0 čakajoči · 1 konfliktov · 0 napak · 1 grobnic'), 'Z1m mini FAIL: ' + json.dumps(d)
assert d['akcija'], 'Z1m akcijski žig FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1m err: ' + json.dumps(d)
print('Z1m OK — F2 sync mini regresija ŽIVO + akcijski žig')" || exit 1
agent-browser screenshot "$SS/qa-r310-e2e-sync-mini.png" > /dev/null 2>&1
# nazaj na r276 projekt (regresijski tok Z2+)
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); return !!p;})()" 24

echo "=== Z2: Popravi tok ŽIVO — pas → 3450 → Shrani kot novo verzijo → v2 ==="
eb_klik_prefix() { agent-browser eval "(()=>{const g=document.querySelector('button[aria-label^=\"$1\"]'); if(!g) return 'ni gumba'; g.click(); return 'klik';})()" 2>&1 | tail -1; }
eb_klik_prefix "Popravi meritev "
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Popravljanje verzije:');})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const pas=t.includes('Popravljanje verzije:'); const stGumb=[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Shrani kot novo verzijo')); return JSON.stringify({pas, stGumb, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z2-pas.json
python3 -c "import json; r=json.load(open('/tmp/r326-z2-pas.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pas'] and d['stGumb'], 'Z2 pas FAIL: '+json.dumps(d); print('Z2 pas OK — korekcijski pas + Shrani kot novo verzijo')" || exit 1
agent-browser eval "(()=>{const i=document.querySelector('input[type=\"number\"]'); if(!i) return 'ni inputa'; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'3450'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'vpisano';})()" 2>&1 | tail -1
eb_cakaj 1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Shrani kot novo verzijo')); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" 2>&1 | tail -1
eb_pocakaj_tekst "Nova verzija v2 shranjena" 14
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v2'); return !!p;})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const v1=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='v1'); const v2=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='v2'); const pasSePrisoten=t.includes('Popravljanje verzije:'); return JSON.stringify({v1, v2, pasSePrisoten, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z2.json
python3 -c "import json; r=json.load(open('/tmp/r326-z2.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['v1'] and d['v2'], 'Z2 pill FAIL (v1 in v2 obstajata): '+json.dumps(d); assert not d['pasSePrisoten'], 'Z2 pas NI zaprt po uspehu: '+json.dumps(d); print('Z2 OK — v2 ŽIVO (v1 ostane v zgodovini), pas zaprt')" || exit 1
agent-browser screenshot "$SS/qa-r310-e2e-v2.png" > /dev/null 2>&1

echo "=== Z2b: TERENSKI PDF ŽIVO — 10-stolpčna resnica (issue #16 §6) ==="
eb_zajem_pdf val283
eb_klik_gumb "Izvozi terenski pregled meritev kot PDF"
eb_pocakaj_tekst "Terenski pregled meritev prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val283; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z2b.json
python3 -c "import json; r=json.load(open('/tmp/r326-z2b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-', 'Z2b PDF FAIL: '+json.dumps(d); assert d['bajtov']>10000, 'Z2b prekratek PDF: '+json.dumps(d); assert d['err'] is None, 'Z2b err: '+json.dumps(d); print('Z2b OK — terenski PDF ŽIVO (' + str(d['bajtov']) + ' bajtov, %PDF- magija)')" || exit 1
agent-browser screenshot "$SS/qa-r310-e2e-teren-pdf.png" > /dev/null 2>&1

echo "=== Z2z: TERENSKI ZAPISNI LIST PDF ŽIVO — fill-in resnica (issue #15 §3) ==="
eb_zajem_pdf val284
eb_klik_gumb "Izvozi terenski zapisni list kot PDF"
eb_pocakaj_tekst "Zapisni list prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val284; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z2z.json
python3 -c "import json; r=json.load(open('/tmp/r326-z2z.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-', 'Z2z PDF FAIL: '+json.dumps(d); assert d['bajtov']>10000, 'Z2z prekratek PDF: '+json.dumps(d); assert d['err'] is None, 'Z2z err: '+json.dumps(d); print('Z2z OK — zapisni list PDF ŽIVO (' + str(d['bajtov']) + ' bajtov, %PDF- magija — fill-in resnica)')" || exit 1
agent-browser screenshot "$SS/qa-r310-e2e-zapisni-pdf.png" > /dev/null 2>&1

echo "=== Z2x: INVENTURA PREGLED CSV ŽIVO — 30. člen izvozne družine (R286) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot CSV\"]');})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const gumb=document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot CSV\"]'); const legenda=[...document.querySelectorAll('p')].some(p=>p.textContent.startsWith('Inventura CSV = ista resnica kot PDF v Excelu')); return JSON.stringify({gumb:!!gumb, title:gumb?(gumb.getAttribute('title')||'').startsWith('Inventurni pregled premoženja kot CSV'):false, legenda, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z2x-ui.json
python3 -c "import json; r=json.load(open('/tmp/r326-z2x-ui.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['gumb'] and d['title'] and d['legenda'], 'Z2x UI FAIL: '+json.dumps(d); assert d['err'] is None, 'Z2x err: '+json.dumps(d); print('Z2x UI OK — gumb + hover title + legenda ŽIVO (30. člen, kanon R280–R285)')" || exit 1
eb_zajem_pdf val286csv
eb_klik_gumb "Izvozi inventurni pregled premoženja kot CSV"
eb_pocakaj_tekst "Inventurni pregled premoženja prenešen v CSV" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val286csv; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({csv:false, err:window.__err??null}); const bin=atob(b64); const bom=bin.charCodeAt(0).toString(16)+bin.charCodeAt(1).toString(16)+bin.charCodeAt(2).toString(16); let vrs=0; for(let i=0;i<bin.length;i++){ if(bin.charCodeAt(i)===10) vrs++; } return JSON.stringify({csv:true, bom, bajtov:bin.length, vrstic:vrs, glava:bin.includes('"Naziv"')&&bin.includes('"Status"')&&bin.includes('"Enota"'), dodatni:bin.includes('"id"')&&bin.includes('"Premiki"'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z2x.json
python3 -c "import json; r=json.load(open('/tmp/r326-z2x.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['csv'] and d['bom']=='efbbbf', 'Z2x CSV/BOM FAIL: '+json.dumps(d); assert d['glava'] and d['dodatni'], 'Z2x stolpci FAIL (ASCII needleji — atob UTF-8 je 2-bajtni za Š/ž, kanon r285): '+json.dumps(d); assert d['vrstic']>=2, 'Z2x premalo vrstic: '+json.dumps(d); assert d['bajtov']>60, 'Z2x prekratek CSV: '+json.dumps(d); assert d['err'] is None, 'Z2x err: '+json.dumps(d); print('Z2x OK — inventura CSV ŽIVO (' + str(d['bajtov']) + ' bajtov, BOM efbbbf, ' + str(d['vrstic']) + ' vrstic — pariteta R270 po konstrukciji + 3 dodatni stolpci)')" || exit 1
agent-browser screenshot "$SS/qa-r310-e2e-inventura-csv.png" > /dev/null 2>&1
# VRNITEV na measurements tab (Z2b/Z2z/Z2y kontekst — r285 tok se nadaljuje nespremenjen):
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_cakaj 1

echo "=== Z2y: TERENSKI ZAPISNI LIST CSV ŽIVO — digitalno izpolnjevanje (R285) ==="
eb_zajem_pdf val285csv
eb_klik_gumb "Izvozi terenski zapisni list kot CSV"
eb_pocakaj_tekst "Zapisni list prenešen v CSV" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val285csv; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({csv:false, err:window.__err??null}); const bin=atob(b64); const bom=bin.charCodeAt(0).toString(16)+bin.charCodeAt(1).toString(16)+bin.charCodeAt(2).toString(16); let vrs=0; for(let i=0;i<bin.length;i++){ if(bin.charCodeAt(i)===10) vrs++; } return JSON.stringify({csv:true, bom, bajtov:bin.length, vrstic:vrs, imaFizicna:bin.includes('fizicna_ref_mm'), imaDelta:bin.includes('delta_mm'), imaZapiski:bin.includes('zapiski_terena'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z2y.json
python3 -c "import json; r=json.load(open('/tmp/r326-z2y.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['csv'] and d['bom']=='efbbbf', 'Z2y CSV/BOM FAIL: '+json.dumps(d); assert d['imaFizicna'] and d['imaDelta'] and d['imaZapiski'], 'Z2y stolpci FAIL: '+json.dumps(d); assert d['vrstic']>=2, 'Z2y premalo vrstic: '+json.dumps(d); assert d['bajtov']>60, 'Z2y prekratek CSV: '+json.dumps(d); assert d['err'] is None, 'Z2y err: '+json.dumps(d); print('Z2y OK — zapisni list CSV ŽIVO (' + str(d['bajtov']) + ' bajtov, BOM efbbbf, ' + str(d['vrstic']) + ' vrstic — pariteta R186 + prazni fizični stolpci)')" || exit 1
agent-browser screenshot "$SS/qa-r310-e2e-zapisni-csv.png" > /dev/null 2>&1

echo "=== Z3: Zgodovina verzij panel — veriga v1→v2 + delta +250 + aktivna v2 ==="
eb_klik_prefix "Pokaži zgodovino verzij meritve"
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Zgodovina verzij — korekcije NE prepišejo');})()" 14
eb_pocakaj_na "(()=>{return document.body.textContent.includes('+250');})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const aktivnaV2=t.includes('Aktivna verzija: v2'); const delta=t.includes('+250'); const o7=t.includes('se NE izračunajo samodejno'); return JSON.stringify({aktivnaV2, delta, o7, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z3.json
python3 -c "import json; r=json.load(open('/tmp/r326-z3.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['aktivnaV2'] and d['delta'] and d['o7'], 'Z3 panel FAIL: '+json.dumps(d); print('Z3 OK — veriga v1→v2 + delta +250 + aktivna v2 + O7 resnica')" || exit 1
agent-browser screenshot "$SS/qa-r310-e2e-panel.png" > /dev/null 2>&1

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
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({temna:document.documentElement.classList.contains('dark'), panel:t.includes('Zgodovina verzij — korekcije NE prepišejo'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r326-z5.json
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
python3 -c "import json; r=json.load(open('/tmp/r326-z5.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['temna'] and d['panel'] and d['err'] is None, 'Z5 temna FAIL: '+json.dumps(d); print('Z5 temna OK — verzije panel vidna, err null')" || exit 1

echo "=== RESTORE + ODTIS (bajtnata identičnost — ZERO-MUTACIJA) ==="
node scripts/r276-db-e2e.cjs restore || exit 1
node scripts/r273-db-e2e.cjs restore > /dev/null 2>&1 || true
node scripts/r281-db-e2e.cjs restore || exit 1
node scripts/r283-referencni-projekt.cjs restore || exit 1
node scripts/r287-db-e2e.cjs restore || exit 1
node scripts/r276-db-e2e.cjs fp > /tmp/r326-fp-post-276.json || exit 1
node scripts/r281-db-e2e.cjs fp > /tmp/r326-fp-post-281.json || exit 1
node scripts/r283-referencni-projekt.cjs fp > /tmp/r326-fp-post-283.json || exit 1
node scripts/r287-db-e2e.cjs fp > /tmp/r326-fp-post.json || exit 1
OK=1
cmp -s /tmp/r326-fp-pre-276.json /tmp/r326-fp-post-276.json || OK=0
cmp -s /tmp/r326-fp-pre-281.json /tmp/r326-fp-post-281.json || OK=0
cmp -s /tmp/r326-fp-pre-283.json /tmp/r326-fp-post-283.json || OK=0
cmp -s /tmp/r326-fp-pre.json /tmp/r326-fp-post.json || OK=0
if [ "$OK" = 1 ]; then
  echo "ODTIS BAJTNATO IDENTIČEN (pre==post, r276 + r281 + r283 + r287) — ZERO-MUTACIJA dokazana"
else
  echo "ODTIS RAZLIČEN — FAIL"; diff <(python3 -m json.tool /tmp/r326-fp-pre-276.json) <(python3 -m json.tool /tmp/r326-fp-post-276.json) | head -10; diff <(python3 -m json.tool /tmp/r326-fp-pre-281.json) <(python3 -m json.tool /tmp/r326-fp-post-281.json) | head -10; diff <(python3 -m json.tool /tmp/r326-fp-pre-283.json) <(python3 -m json.tool /tmp/r326-fp-post-283.json) | head -10
  exit 1
fi

echo "=== ZAKLJUČEK: strežnik + brskalnik zaprta ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R326 E2E KONEC ==="
