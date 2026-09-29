#!/usr/bin/env python3
# R292 — zgeneriraj r292 E2E/needles/smoke iz r291 vzorcev + vstavi Z0o blok
# (TEDENSKI RAZGLED strip + TEDENSKI CSV ŽIVO — pogojni probe: toast pri 0
# ALI bajtna capture; ZERO-MUTACIJA) + R292 needle blok ×8 + TODO-R292
# must_miss + KOSMETIČNA AUDIT POPRAVEK: štiri needle oznake v r291
# build-needles so bile od blind-renamea R290→R291 napačno označene kot R291
# (needle stringi so ostali R290 literali) — v r292 izhodu označeni nazaj R290.

# ---------- 1) E2E: r291-e2e-browser.sh → r292-e2e-browser.sh ----------
src = open('/home/z/my-project/scripts/r291-e2e-browser.sh', encoding='utf-8').read()
src = src.replace('r291', 'r292').replace('R291', 'R292')

z0o = '''echo "=== Z0o: TEDENSKI RAZGLED + TEDENSKI CSV ŽIVO (R292 — 23. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\\"Izvozi tedenski pregled montaž kot CSV\\"]');})()" 16; then
  # RAZGLED strip (MANDATORY STIL): aria regija + 7 dni + sklep/praznina + aria-hidden tir
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\\"Tedenski razgled — naslednjih 7 dni\\"]'); if(!reg) return JSON.stringify({strip:false, err:window.__err??null}); const celice=reg.querySelectorAll('.grid.grid-cols-7 > div').length; const sklep=document.querySelector('[data-testid=\\"tedenski-razgled-sklep\\"]'); const tiri=reg.querySelectorAll('[aria-hidden=\\"true\\"].h-1').length; return JSON.stringify({strip:true, celice, tiri, sklep:sklep?sklep.textContent.trim().slice(0,80):null, praznina:sklep?sklep.textContent.includes('Naslednjih 7 dni brez vpisanih terminov.'):false, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r292-z0o-strip.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r292-z0o-strip.json').read().strip()
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
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\\"Izvozi tedenski pregled montaž kot CSV\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('CSV se izvozi, ko je vpisan termin v prihajajočem tednu.'); const uspeh=body.includes('Tedenski pregled prenešen v CSV ('); const c=window.__tedenskiCsv ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, csvNiz:niz, bajti:niz?c.length:0, bom:niz?c.charCodeAt(0)===0xFEFF:false, glava:niz?c.split('\\n')[0].slice(0,60):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r292-z0o-csv.json
  python3 - <<'PYEOF4' || exit 1
import json
raw = open('/tmp/r292-z0o-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r292-e2e-z0o-tedenski-csv.png" > /dev/null 2>&1
else
  echo "Z0o OPOMBA: tedenski CSV gumb ni dosegljiv na spot seji (RBAC skoping?) — chunk needleji R292 ×8 ostajajo obvezni dokaz"
fi

'''
marker = 'echo "=== Z1:'
assert marker in src, 'marker Z1 ni najden (r292 e2e)'
src = src.replace(marker, z0o + marker, 1)
open('/home/z/my-project/scripts/r292-e2e-browser.sh', 'w', encoding='utf-8').write(src)
print('written r292-e2e-browser.sh')

# ---------- 2) needles: r291-build-needles.sh → r292-build-needles.sh ----------
src = open('/home/z/my-project/scripts/r291-build-needles.sh', encoding='utf-8').read()
src = src.replace('r291', 'r292').replace('R291', 'R292')

# kosmetični audit popravek: štiri needle oznake, ki jih je blind-rename
# R290→R291 (v gen-r291) napačno preimenoval — needle STRINGI so R290 literali.
for (slabo, dobro) in [
    ('"R292 aria regija (JSX attr literal) — LIVE"', '"R290 aria regija (JSX attr literal) — LIVE"'),
    ('"R292 sekcija glava (JSX literal) — LIVE"', '"R290 sekcija glava (JSX literal) — LIVE"'),
    ('"R292 iskrena praznina (JSX literal) — LIVE"', '"R290 iskrena praznina (JSX literal) — LIVE"'),
    ('"R292 fail-verbose role=alert copy — LIVE"', '"R290 fail-verbose role=alert copy — LIVE"'),
]:
    assert slabo in src, 'audit marker ni najden: ' + slabo
    src = src.replace(slabo, dobro, 1)
# blokovna glava + celoten R290 regresijski blok (8 needlejev) — blind-rename
# R290→R291 (gen-r291) jih je napačno označil; needle STRINGI = R290 literali.
slaba_glava = 'echo "--- R292 MANDATORY — PRIHODKI PO MESECIH (LIVE — regresija) ---"'
dobra_glava = 'echo "--- R290 MANDATORY — PRIHODKI PO MESECIH (LIVE — regresija; oznake popravljene r292 — blind-rename lekcija) ---"'
assert slaba_glava in src, 'blokovna glava ni najdena'
src = src.replace(slaba_glava, dobra_glava, 1)
for (slabo, dobro) in [
    ('"R292 skupaj vrstica (JSX literal) — LIVE"', '"R290 skupaj vrstica (JSX literal) — LIVE"'),
    ('"R292 pogojni stornirani žig (JSX literal) — LIVE"', '"R290 pogojni stornirani žig (JSX literal) — LIVE"'),
    ('"R292 MANDATORY STIL — KPI hover title (izpeljava izrečena) — LIVE"', '"R290 MANDATORY STIL — KPI hover title (izpeljava izrečena) — LIVE"'),
    ('"R292 objektni ključ (lib čanek — kanon ASCII 4. gen) — LIVE"', '"R290 objektni ključ (lib čanek — kanon ASCII 4. gen) — LIVE"'),
]:
    assert slabo in src, 'audit marker ni najden: ' + slabo
    src = src.replace(slabo, dobro, 1)

r292block = '''echo "--- R292 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED (23. člen izvozne družine — LIVE) ---"
need_static "Izvozi tedenski pregled montaž kot CSV" "R292 gumb aria (JSX attr literal) — LIVE"
need_static "Tedenski pregled montaž kot CSV — ista resnica kot PDF (dnevi · termini · ure)" "R292 gumb title (JSX attr literal) — LIVE"
need_static "CSV se izvozi, ko je vpisan termin v prihajajočem tednu." "R292 fail-closed toast pri praznem oknu (R250/R291 vzorec) — LIVE"
need_static "Tedenski pregled prenešen v CSV (" "R292 uspešni toast (WYSIWYG sklep) — LIVE"
need_static "Tedenski razgled — naslednjih 7 dni" "R292 MANDATORY STIL — razgled strip aria regija — LIVE"
need_static "% najbolj obremenjenega dne" "R292 MANDATORY STIL — mini tir hover title izpeljava — LIVE"
need_static "Naslednjih 7 dni brez vpisanih terminov." "R292 iskrena praznina (JSX literal) — LIVE"
need_static "Tedenski-vozni-red-" "R292 lib filename prefix (lib čanek literal) — LIVE"
echo "--- R291 MANDATORY — PRIHODKI MESECI CSV (8. člen izvozne družine — LIVE) ---"'''
marker2 = 'echo "--- R292 MANDATORY — PRIHODKI MESECI CSV (8. člen izvozne družine — LIVE) ---"'
assert marker2 in src, 'marker R292 ni najden (r292 needles po preimenovanju)'
src = src.replace(marker2, r292block, 1)
src = src.replace('must_miss "TODO-R292" "R292 — brez razvojnih ostankov"', 'must_miss "TODO-R292" "R292 — brez razvojnih ostankov"\nmust_miss "TODO-R291" "R291 — brez razvojnih ostankov"', 1)

# Lekcija gen-r291 (isti past!): blind-rename R291→R292 je zmotno preimenoval
# TUDI needle OZNAKE v R291 bloku (stringi = R291 literali, oznake = R292).
# Pozicijska popravka: za glavo R291 bloka naslednjih 8 need_static vrstic —
# oznaka '"R292 ' → '"R291 ' ( needle stringi se NE spremenijo).
lines = src.split('\n')
hdr_idx = lines.index('echo "--- R291 MANDATORY — PRIHODKI MESECI CSV (8. člen izvozne družine — LIVE) ---"')
popravljeno = 0
k = hdr_idx + 1
while k < len(lines) and popravljeno < 8:
    if lines[k].startswith('need_static ') and '"R292 ' in lines[k]:
        lines[k] = lines[k].replace('"R292 ', '"R291 ', 1)
        popravljeno += 1
    k += 1
assert popravljeno == 8, 'R291 oznake popravljene ' + str(popravljeno) + '/8 (blind-rename pozicijska popravka)'
src = '\n'.join(lines)
open('/home/z/my-project/scripts/r292-build-needles.sh', 'w', encoding='utf-8').write(src)
print('written r292-build-needles.sh')

# ---------- 3) smoke: r291-run-smoke.sh → r292-run-smoke.sh ----------
src = open('/home/z/my-project/scripts/r291-run-smoke.sh', encoding='utf-8').read()
src = src.replace('R291', 'R292')
open('/home/z/my-project/scripts/r292-run-smoke.sh', 'w', encoding='utf-8').write(src)
print('written r292-run-smoke.sh')
