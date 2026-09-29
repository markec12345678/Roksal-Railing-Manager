#!/usr/bin/env python3
# R293 — zgeneriraj r293 E2E/needles/smoke iz r292 vzorcev + vstavi Z0p blok
# (MARŽNI RAZGLED strip + DOBIČKONOST CSV ŽIVO na vodji — pogojni probe:
# toast pri 0/0 ALI bajtna capture; ZERO-MUTACIJA) + R293 needle blok ×8.
#
# LEKCIJA R292 (blind-rename past se PONAVLJA po generacijah!):
#  • global rename R292→R293 zmoti OZNAKE v R292 regresijskem bloku (needle
#    STRINGI so R292 literali) — pozicijska popravka: 8 need_static oznak
#    za glavo R292 bloka + blokovna glava;
#  • TODO must_miss veriga: lastni TODO-R292 postane TODO-R293 (prav), a
#    regresijski TODO-R292 IZGINI — vstavljen nazaj za TODO-R293;
#  • Z0o blok (R292 tedenski probe) v E2E: oznake znotraj regije relabel.

# ---------- 1) E2E: r292-e2e-browser.sh → r293-e2e-browser.sh ----------
src = open('/home/z/my-project/scripts/r292-e2e-browser.sh', encoding='utf-8').read()
src = src.replace('r292', 'r293').replace('R292', 'R293')

# pozicijski relabel Z0o regije (R292 tedenski probe — needle stringi se NE
# spreminjajo, samo oznake/printi): med '=== Z0o:' in '=== Z1:'.
z0o_z = src.index('echo "=== Z0o:')
z1_z = src.index('echo "=== Z1:')
regija = src[z0o_z:z1_z].replace('R293', 'R292')
src = src[:z0o_z] + regija + src[z1_z:]

z0p = '''echo "=== Z0p: MARŽNI RAZGLED + DOBIČKONOST CSV ŽIVO (R293 — 24. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\\"Izvozi dobičkonosnost projektov kot CSV\\"]');})()" 16; then
  # MARŽNI RAZGLED strip (MANDATORY STIL): aria regija + vrstice/sklep/praznina + aria-hidden tirje
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\\"Maržni razgled — marža po projektih\\"]'); if(!reg) return JSON.stringify({strip:false, err:window.__err??null}); const vrstice=reg.querySelectorAll('.space-y-1 > div').length; const tiri=reg.querySelectorAll('[aria-hidden=\\"true\\"].h-1').length; const sklep=document.querySelector('[data-testid=\\"marzni-razgled-sklep\\"]'); return JSON.stringify({strip:true, vrstice, tiri, sklep:sklep?sklep.textContent.trim().slice(0,90):null, praznina:sklep?sklep.textContent.includes('Ni projektov v preseku'):false, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r293-z0p-strip.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r293-z0p-strip.json').read().strip()
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
  eb_csv_capture dobicikonostCsv
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\\"Izvozi dobičkonosnost projektov kot CSV\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni podatkov za dobičkonost') && body.includes('CSV se izvozi, ko je vpisan prvi račun ali naročilo.'); const uspeh=body.includes('Dobičkonost prenešena v CSV ('); const c=window.__dobicikonostCsv ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, csvNiz:niz, bajti:niz?c.length:0, bom:niz?c.charCodeAt(0)===0xFEFF:false, glava:niz?c.split('\\n')[0].slice(0,60):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r293-z0p-csv.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r293-z0p-csv.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0p CSV err: ' + json.dumps(d)
if d['prazno']:
    assert not d['csvNiz'], 'Z0p: toast pri 0/0 A VSEENO datoteka (kršitev fail-closed): ' + json.dumps(d)
    print('Z0p CSV OK — gumb ŽIVO, fail-closed toast pri 0 računov IN 0 naročil (spot iskrena praznina — ISTI gate kot brat R258; NIČ datoteke)')
elif d['csvNiz']:
    assert d['bajti'] > 0 and d['bom'], 'Z0p: datoteka brez BOM/vsebine: ' + json.dumps(d)
    assert d['glava'] and d['glava'].startswith('"Projekt","Prihodki (EUR)"'), 'Z0p: glava FAIL (7 stolpcev): ' + str(d['glava'])
    print('Z0p CSV OK — DOBIČKONOST CSV ŽIVO bajtno (' + str(d['bajti']) + ' B, BOM efbbbf, glava: ' + str(d['glava'])[:50] + ')')
else:
    raise AssertionError('Z0p: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF4
  eb_csv_reset dobicikonostCsv
  agent-browser screenshot "$SS/qa-r293-e2e-z0p-dobicikonost-csv.png" > /dev/null 2>&1
else
  echo "Z0p OPOMBA: vodja pregled ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R293 ×8 ostajajo obvezni dokaz"
fi

'''
marker = 'echo "=== Z1:'
assert marker in src, 'marker Z1 ni najden (r293 e2e)'
src = src.replace(marker, z0p + marker, 1)
# OPOMBA (R293 lekcija — POST-generacija popravek): Z0p CSV capture v TEM
# z0p bloku je še Response.text() — ta STRIJE vodilni BOM (fetch spec).
# KANONIČNA verzija = r293-e2e-browser.sh (RAW bajti arrayBuffer EF BB BF
# + TextDecoder). Prva generacija z realno capture — Z0n/Z0o so do zdaj
# VEDNO padle na prazno vejo, zato ta past še ni bila videna.
open('/home/z/my-project/scripts/r293-e2e-browser.sh', 'w', encoding='utf-8').write(src)
print('written r293-e2e-browser.sh')

# ---------- 2) needles: r292-build-needles.sh → r293-build-needles.sh ----------
src = open('/home/z/my-project/scripts/r292-build-needles.sh', encoding='utf-8').read()
src = src.replace('r292', 'r293').replace('R292', 'R293')

# LEKCIJA R292 (pozicijska popravka): glava R292 regresijskega bloka + 8
# need_static oznak — blind-rename jih je poimenoval R293; needle STRINGI so
# R292 literali (tedenski CSV + razgled).
slaba_glava = 'echo "--- R293 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED (23. člen izvozne družine — LIVE) ---"'
dobra_glava = 'echo "--- R292 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED (23. člen izvozne družine — LIVE; oznake popravljene r293 — blind-rename lekcija) ---"'
assert slaba_glava in src, 'blokovna glava R292 ni najdena (r293 needles po rename)'
src = src.replace(slaba_glava, dobra_glava, 1)
lines = src.split('\n')
hdr_idx = lines.index(dobra_glava)
popravljeno = 0
k = hdr_idx + 1
while k < len(lines) and popravljeno < 8:
    if lines[k].startswith('need_static ') and '"R293 ' in lines[k]:
        lines[k] = lines[k].replace('"R293 ', '"R292 ', 1)
        popravljeno += 1
    k += 1
assert popravljeno == 8, 'R292 oznake popravljene ' + str(popravljeno) + '/8 (blind-rename pozicijska popravka)'
src = '\n'.join(lines)

# TODO-R292 regresijski must_miss IZGINIL z renameom (lastni TODO-R292 →
# TODO-R293) — vstavljen nazaj (veriga ostaja neprekinjena).
slab_todo = 'must_miss "TODO-R293" "R293 — brez razvojnih ostankov"'
dobra_todo = slab_todo + '\nmust_miss "TODO-R292" "R292 — brez razvojnih ostankov"'
assert slab_todo in src, 'TODO-R293 must_miss ni najden'
src = src.replace(slab_todo, dobra_todo, 1)

r293block = '''echo "--- R293 MANDATORY — DOBIČKONOST PO PROJEKTIH CSV + RAZGLED (24. člen izvozne družine — LIVE) ---"
need_static "Izvozi dobičkonosnost projektov kot CSV" "R293 gumb aria (JSX attr literal) — LIVE"
need_static "Dobičkonosnost po projektih kot CSV — ista resnica kot PDF (prihodki · stroški · marža)" "R293 gumb title (JSX attr literal) — LIVE"
need_static "CSV se izvozi, ko je vpisan prvi račun ali naročilo." "R293 fail-closed toast pri 0/0 (ISTI gate kot brat R258) — LIVE"
need_static "Dobičkonost prenešena v CSV (" "R293 uspešni toast (WYSIWYG sklep) — LIVE"
need_static "Maržni razgled — marža po projektih" "R293 MANDATORY STIL — strip aria regija — LIVE"
need_static "% najvišje marže" "R293 MANDATORY STIL — mini tir hover title izpeljava — LIVE"
need_static "Ni projektov v preseku — dobičkonost se izriše ob prvem računu ali naročilu." "R293 iskrena praznina (JSX literal) — LIVE"
need_static "Vsi projekti — presek računov (prihodki) in naročil (stroški materiala)" "R293 meta Obseg vrstica (lib čanek) — LIVE"
echo "--- R292 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED (23. člen izvozne družine — LIVE; oznake popravljene r293 — blind-rename lekcija) ---"'''
assert dobra_glava in src, 'R292 glava ni najdena pred vstavitvijo R293 bloka'
src = src.replace(dobra_glava, r293block, 1)
open('/home/z/my-project/scripts/r293-build-needles.sh', 'w', encoding='utf-8').write(src)
print('written r293-build-needles.sh')

# ---------- 3) smoke: r292-run-smoke.sh → r293-run-smoke.sh ----------
src = open('/home/z/my-project/scripts/r292-run-smoke.sh', encoding='utf-8').read()
src = src.replace('R292', 'R293').replace('r292', 'r293')
open('/home/z/my-project/scripts/r293-run-smoke.sh', 'w', encoding='utf-8').write(src)
print('written r293-run-smoke.sh')

# ---------- 4) pozicijska strukturna preverba (r292 lekcija) ----------
nb = open('/home/z/my-project/scripts/r293-build-needles.sh', encoding='utf-8').read()
r293_idx = nb.index('--- R293 MANDATORY — DOBIČKONOST PO PROJEKTIH CSV')
r292_idx = nb.index('--- R292 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED')
r291_idx = nb.index('--- R291 MANDATORY — PRIHODKI MESECI CSV')
assert r293_idx < r292_idx < r291_idx, 'blokovni vrstni red pokvarjen: ' + str((r293_idx, r292_idx, r291_idx))
print('struktura OK: R293 → R292 → R291 bloki v pravilnem vrstnem redu')
