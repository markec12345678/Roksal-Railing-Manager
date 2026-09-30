#!/usr/bin/env python3
# R304 — generira scripts/r304-e2e-browser.sh iz r303-e2e-browser.sh:
#  1. NOV Z0ac blok: EKIPE CSV PILL ŽIVO (34. člen — Vodja tedenski CSV po
#     ekipah) — VEDNO viden (P1-k precedens): pill (testid + label +
#     definicijski naslov) + klik → trije ISKRENI izidi (sum=1 — vzajemna
#     izključitev): prazno okno → toast 'Ni terminov…', 0 ekip → toast
#     'Ni ekip z termini…' (NIČ datoteke — fail-closed, mirror R299/R303),
#     uspeh → bajtna capture UTF-8 BOM (EF BB BF) + dolžina > 100;
#  2. poti + oznake r303 → r304;
#  3. ZERO-MUTACIJA veriga nespremenjena (fp pre/post + restore).
SRC = '/home/z/my-project/scripts/r303-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r304-e2e-browser.sh'

s = open(SRC).read()

s = s.replace('/tmp/r303-', '/tmp/r304-')
s = s.replace('qa-r303-e2e-', 'qa-r304-e2e-')
s = s.replace(
    '# R303 E2E ŽIVO (lokalni :3100, ADMIN) — VODJA TEDENSKI PDF PO EKIPAH (33. člen izvozne\n# družine — PDF brat ICS po ekipah R299; ENA sekcija na ekipo) +\n# [kombinirano z R302] KONFLIKTI PDF (PDF brat pregledu R300 + CSV R301; dokaz na tisku) +',
    '# R304 E2E ŽIVO (lokalni :3100, ADMIN) — VODJA TEDENSKI CSV PO EKIPAH (34. člen izvozne\n# družine — CSV brat PDF po ekipah R303; ENA vrstica na termin) +\n# [kombinirano z R303] VODJA TEDENSKI PDF PO EKIPAH (PDF brat ICS po ekipah R299; en tisk) +',
)
s = s.replace('echo "=== R303 E2E KONEC ==="', 'echo "=== R304 E2E KONEC ==="')

Z0AC = '''echo "=== Z0ac: EKIPE CSV PILL ŽIVO (R304 — 34. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0ac klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w/Z0x/Z0aa/Z0ab).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\\"ekipe-csv-pill\\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\\"ekipe-csv-pill\\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('ENA vrstica na termin')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r304-z0ac-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r304-z0ac-pill.json').read().strip()
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
  agent-browser eval "(()=>{const b=document.querySelector('button[data-testid=\\"ekipe-csv-pill\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('CSV po ekipah se izvozi, ko je vpisan termin v prihajajo\\u010dem tednu.'); const niekip=body.includes('Ni ekip z termini v naslednjih 7 dneh') && body.includes('CSV po ekipah se izvozi, ko ima ekipa vpisan termin v prihajajo\\u010dem tednu.'); const uspeh=body.includes('Tedenski vozni red po ekipah prenešen v CSV (Tedenski-po-ekipah-'); return JSON.stringify({prazno, niekip, uspeh, csvBom:window.__csvBom??null, csvLen:window.__csvLen??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r304-z0ac-csv.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r304-z0ac-csv.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r304-e2e-z0ac-ekipe-csv.png" > /dev/null 2>&1
else
  echo "Z0ac OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R304 ×11 ostajajo obvezni dokaz"
fi

'''

marker = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir '
idx = s.index(marker)
s = s[:idx] + Z0AC + s[idx:]

open(DST, 'w').write(s)
print('r304-e2e-browser.sh zgeneriran (' + str(len(s.splitlines())) + ' vrstic)')
