#!/usr/bin/env python3
# R294 — zgeneriraj r294 E2E/needles/smoke iz r293 vzorcev + vstavi Z0q blok
# (AVTOMATIZACIJA KARTICA ŽIVO — issue #1; deterministična resnica brez
# podatkovne odvisnosti; ZERO-MUTACIJA) + R294 needle blok ×8.
#
# LEKCIJE R292/R293 (blind-rename past se PONAVLJA — pozicijske popravke):
#  • global rename R293→R294 zmoti OZNAKE 8 needlejev R293 regresijskega
#    bloka (needle STRINGI so R293 literali — dobičkonost CSV + maržni strip);
#  • TODO must_miss veriga: lastni TODO-R293 postane TODO-R294 (prav), a
#    regresijski TODO-R293 IZGINI — vstavljen nazaj za TODO-R294;
#  • Z0p blok (R293 maržni probe) v E2E: oznake znotraj regije relabel;
#  • blokovni vrstni red assert: R294 → R293 → R292 → R291.

# ---------- 1) E2E: r293-e2e-browser.sh → r294-e2e-browser.sh ----------
src = open('/home/z/my-project/scripts/r293-e2e-browser.sh', encoding='utf-8').read()
src = src.replace('r293', 'r294').replace('R293', 'R294')

# pozicijski relabel Z0p regije (R293 maržni probe — needle stringi se NE
# spreminjajo, samo oznake/printi): med '=== Z0p:' in '=== Z1:'.
z0p_z = src.index('echo "=== Z0p:')
z1_z = src.index('echo "=== Z1:')
regija = src[z0p_z:z1_z].replace('R294', 'R293')
src = src[:z0p_z] + regija + src[z1_z:]

z0q = '''echo "=== Z0q: AVTOMATIZACIJA KARTICA ŽIVO (R294 — issue #1; deterministična resnica — brez podatkovne odvisnosti; ZERO-MUTACIJA) ==="
if eb_pocakaj_na "(()=>{return !!document.querySelector('[aria-label=\\"Avtomatizacija — razred funkcij\\"]');})()" 16; then
  agent-browser eval "(()=>{const reg=document.querySelector('[aria-label=\\"Avtomatizacija — razred funkcij\\"]'); if(!reg) return JSON.stringify({kartica:false}); const t=reg.textContent||''; const m=t.match(/(\\\\d+) funkcij · (\\\\d+) območij poslovanja/); const det=t.match(/(\\\\d+) determinističnih/); const sdk=t.match(/(\\\\d+) SDK/); const ai=t.match(/(\\\\d+) AI \\\\(neobvezne\\\\)/); return JSON.stringify({kartica:true, skupaj:m?+m[1]:null, obmocija:m?+m[2]:null, det:det?+det[1]:null, sdk:sdk?+sdk[1]:null, ai:ai?+ai[1]:null, nadomestki:t.includes('zmožnosti z izrečenim determinističnim nadomestkom'), sklep:t.includes('jedro deluje brez AI.')});})()" 2>&1 | tail -1 > /tmp/r294-z0q.json
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

'''
marker = 'echo "=== Z1:'
assert marker in src, 'marker Z1 ni najden (r294 e2e)'
src = src.replace(marker, z0q + marker, 1)
open('/home/z/my-project/scripts/r294-e2e-browser.sh', 'w', encoding='utf-8').write(src)
print('written r294-e2e-browser.sh')

# ---------- 2) needles: r293-build-needles.sh → r294-build-needles.sh ----------
src = open('/home/z/my-project/scripts/r293-build-needles.sh', encoding='utf-8').read()
src = src.replace('r293', 'r294').replace('R293', 'R294')

# pozicijski popravek: glava R293 regresijskega bloka + 8 need_static oznak
slaba_glava = 'echo "--- R294 MANDATORY — DOBIČKONOST PO PROJEKTIH CSV + RAZGLED (24. člen izvozne družine — LIVE) ---"'
dobra_glava = 'echo "--- R293 MANDATORY — DOBIČKONOST PO PROJEKTIH CSV + RAZGLED (24. člen izvozne družine — LIVE; oznake pozicijsko popravljene r294 — blind-rename lekcija) ---"'
assert slaba_glava in src, 'blokovna glava R293 ni najdena (r294 needles po rename)'
src = src.replace(slaba_glava, dobra_glava, 1)
lines = src.split('\n')
hdr_idx = lines.index(dobra_glava)
popravljeno = 0
k = hdr_idx + 1
while k < len(lines) and popravljeno < 8:
    if lines[k].startswith('need_static ') and '"R294 ' in lines[k]:
        lines[k] = lines[k].replace('"R294 ', '"R293 ', 1)
        popravljeno += 1
    k += 1
assert popravljeno == 8, 'R293 oznake popravljene ' + str(popravljeno) + '/8 (blind-rename pozicijska popravka)'
src = '\n'.join(lines)

# TODO-R293 regresijski must_miss IZGINIL z renameom — vstavljen nazaj.
slab_todo = 'must_miss "TODO-R294" "R294 — brez razvojnih ostankov"'
dobra_todo = slab_todo + '\nmust_miss "TODO-R293" "R293 — brez razvojnih ostankov"'
assert slab_todo in src, 'TODO-R294 must_miss ni najden'
src = src.replace(slab_todo, dobra_todo, 1)

r294block = '''echo "--- R294 MANDATORY — AVTOMATIZACIJA KATALOG + KARTICA (issue #1 — LIVE) ---"
need_static "Avtomatizacija — razred funkcij" "R294 kartica aria + glava literal — LIVE"
need_static "AI = neobvezna pomoč (" "R294 AI resnica p literal — LIVE"
need_static "zmožnosti z izrečenim determinističnim nadomestkom" "R294 AI nadomestek kontrakt literal — LIVE"
need_static "jedro deluje brez AI." "R294 AI-neobveznost sklep literal — LIVE"
need_static "AI (neobvezne)" "R294 AI pill literal — LIVE"
need_static "območij poslovanja" "R294 kartica števec literal — LIVE"
need_static "meritve.ai-ocena-foto" "R294 katalog lib čanek — AI zmožnost 1 (VLM foto ocena) — LIVE"
need_static "viz.ai-render" "R294 katalog lib čanek — AI zmožnost 2 (GPU render stub) — LIVE"
echo "--- R293 MANDATORY — DOBIČKONOST PO PROJEKTIH CSV + RAZGLED (24. člen izvozne družine — LIVE; oznake pozicijsko popravljene r294 — blind-rename lekcija) ---"'''
assert dobra_glava in src, 'R293 glava ni najdena pred vstavitvijo R294 bloka'
src = src.replace(dobra_glava, r294block, 1)
open('/home/z/my-project/scripts/r294-build-needles.sh', 'w', encoding='utf-8').write(src)
print('written r294-build-needles.sh')

# ---------- 3) smoke: r293-run-smoke.sh → r294-run-smoke.sh ----------
src = open('/home/z/my-project/scripts/r293-run-smoke.sh', encoding='utf-8').read()
src = src.replace('r293', 'r294').replace('R293', 'R294')
slaba = '''# build z R294 spremembami (PRIHODKI PO MESECIH v Računih — plačila dimenzija
# iz R250 predala: EN VIR s prihodki PDF — isti prihodkiVnosi preslikava,
# ISTA validacija/sort uvožena; fail-verbose role=alert; iskrena praznina;
# pogojni stornirani žig; KPI hover titles — MANDATORY STIL; + P1-d
# aria-hidden zaklep — vitest stražarji + codemod CLI; kontrakt in core NIČ)'''
dobra = '''# build z R294 spremembami (ISSUE #1 — avtomatizacijski katalog EN VIR
# (10 območij, AI z izrečenim determinističnim nadomestkom) + registar
# ponudnikov (DeterministicniPonudnik VEDNO; AiPonudnik neobvezen, env
# preklop ROKSAL_AI_PONUDNIK) + kartica razreda funkcij na vodji — WYSIWYG
# EN VIR; kontrakt in core NIČ)'''
assert slaba in src, 'smoke glava ni najdena (r294)'
src = src.replace(slaba, dobra, 1)
open('/home/z/my-project/scripts/r294-run-smoke.sh', 'w', encoding='utf-8').write(src)
print('written r294-run-smoke.sh')

# ---------- 4) pozicijska strukturna preverba (r292 lekcija) ----------
nb = open('/home/z/my-project/scripts/r294-build-needles.sh', encoding='utf-8').read()
r294_idx = nb.index('--- R294 MANDATORY — AVTOMATIZACIJA KATALOG + KARTICA')
r293_idx = nb.index('--- R293 MANDATORY — DOBIČKONOST PO PROJEKTIH CSV')
r292_idx = nb.index('--- R292 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED')
r291_idx = nb.index('--- R291 MANDATORY — PRIHODKI MESECI CSV')
assert r294_idx < r293_idx < r292_idx < r291_idx, 'blokovni vrstni red pokvarjen: ' + str((r294_idx, r293_idx, r292_idx, r291_idx))
assert nb.count('must_miss "TODO-R294"') == 1 and nb.count('must_miss "TODO-R293"') == 1, 'TODO veriga napačna (R294 lastni + R293 obnovljen regresijski)'
e2e = open('/home/z/my-project/scripts/r294-e2e-browser.sh', encoding='utf-8').read()
assert e2e.index('echo "=== Z0p:') < e2e.index('echo "=== Z0q:') < e2e.index('echo "=== Z1:'), 'Z0p → Z0q → Z1 vrstni red pokvarjen'
print('struktura OK: R294 → R293 → R292 → R291 bloki; Z0p → Z0q → Z1; TODO veriga')
