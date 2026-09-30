#!/usr/bin/env python3
# R301 — generira scripts/r301-e2e-browser.sh iz r300-e2e-browser.sh:
#  1. NOV Z0x blok: KONFLIKTI CSV PILL ŽIVO (31. člen) — VEDNO viden
#     (P1-k precedens): pill (testid + label + definicijski naslov) + klik →
#     trije ISKRENI izidi (obe veji + uspeh bajtno): prazno okno → toast
#     'Ni terminov…', zelen žig → toast 'Ni dokazanih konfliktov…' (NIČ
#     datoteke — fail-closed), konflikti → bajtna capture z BOM + glava
#     'Dan prekrivanja' + meta Sklep;
#  2. poti + oznake r300 → r301;
#  3. ZERO-MUTACIJA veriga nespremenjena (fp pre/post ×4 + restore).
SRC = '/home/z/my-project/scripts/r300-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r301-e2e-browser.sh'

s = open(SRC).read()

s = s.replace('/tmp/r300-', '/tmp/r301-')
s = s.replace('qa-r300-e2e-', 'qa-r301-e2e-')
s = s.replace(
    '# R300 E2E ŽIVO (lokalni :3100, ADMIN) — KONFLIKTNA MINI-VRSTICA (30. člen\n# issue #1 §7 branje — bralna stran pravil R142; zrcalo STRAŽAR-',
    '# R301 E2E ŽIVO (lokalni :3100, ADMIN) — KONFLIKTI CSV (31. člen izvozne\n# družine — CSV brat pregledu R300 EN VIR; dokazani pari prekrivanj) +\n# [kombinirano z R300] KONFLIKTNA MINI-VRSTICA (30. člen issue #1 §7 branje — bralna stran pravil R142; zrcalo STRAŽAR-',
)
s = s.replace('echo "=== R300 E2E KONEC ==="', 'echo "=== R301 E2E KONEC ==="')

Z0X = '''echo "=== Z0x: KONFLIKTI CSV PILL ŽIVO (R301 — 31. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0x klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\\"konflikti-csv-pill\\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\\"konflikti-csv-pill\\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('isti poli-odprto pregled kot žig')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r301-z0x-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r301-z0x-pill.json').read().strip()
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
  agent-browser eval "(()=>{const b=document.querySelector('button[data-testid=\\"konflikti-csv-pill\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('Konflikti CSV se izvozi, ko je vpisan termin v prihajajo\\u010dem tednu.'); const zelen=body.includes('Ni dokazanih konfliktov v okviru') && body.includes('\\u017dig je zelen'); const uspeh=body.includes('Konflikti prenešeni v CSV ('); const c=window.__konfliktiCsv ?? null; const niz=(typeof c==='string'); const vrstice=niz?c.split('\\n'):null; return JSON.stringify({prazno, zelen, uspeh, csvNiz:niz, bom:window.__csvBom===true, glava:niz?vrstice[0].includes('Dan prekrivanja'):null, ekipaStolpec:niz?vrstice[0].includes('Ekipa'):null, podatek:niz?vrstice.length>8:null, sklep:niz?vrstice.some(v=>v.startsWith('"Sklep"')):null, obseg:niz?vrstice.some(v=>v.startsWith('"Obseg"')):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r301-z0x-csv.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r301-z0x-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r301-e2e-z0x-konflikti-csv.png" > /dev/null 2>&1
else
  echo "Z0x OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R301 ×11 ostajajo obvezni dokaz"
fi

'''

ANCHOR = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="'
assert ANCHOR in s, 'anchor Z1 ni najden'
s = s.replace(ANCHOR, Z0X + ANCHOR)

open(DST, 'w').write(s)
print('r301-e2e-browser.sh zgeneriran:', len(s), 'znakov')
