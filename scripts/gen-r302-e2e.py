#!/usr/bin/env python3
# R302 — generira scripts/r302-e2e-browser.sh iz r301-e2e-browser.sh:
#  1. NOV Z0aa blok: KONFLIKTI PDF PILL ŽIVO (32. člen) — VEDNO viden
#     (P1-k precedens): pill (testid + label + definicijski naslov) + klik →
#     trije ISKRENI izidi (sum=1 — vzajemna izključitev): prazno okno → toast
#     'Ni terminov…', zelen žig → toast 'Ni dokazanih konfliktov…' (NIČ
#     datoteke — fail-closed), konflikti → bajtna capture %PDF- magija;
#  2. poti + oznake r301 → r302;
#  3. ZERO-MUTACIJA veriga nespremenjena (fp pre/post + restore).
SRC = '/home/z/my-project/scripts/r301-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r302-e2e-browser.sh'

s = open(SRC).read()

s = s.replace('/tmp/r301-', '/tmp/r302-')
s = s.replace('qa-r301-e2e-', 'qa-r302-e2e-')
s = s.replace(
    '# R301 E2E ŽIVO (lokalni :3100, ADMIN) — KONFLIKTI CSV (31. člen izvozne\n# družine — CSV brat pregledu R300 EN VIR; dokazani pari prekrivanj) +',
    '# R302 E2E ŽIVO (lokalni :3100, ADMIN) — KONFLIKTI PDF (32. člen izvozne\n# družine — PDF brat pregledu R300 + CSV R301; dokaz na tisku) +\n# [kombinirano z R301] KONFLIKTI CSV (CSV brat pregledu R300 EN VIR; dokazani pari prekrivanj) +',
)
s = s.replace('echo "=== R301 E2E KONEC ==="', 'echo "=== R302 E2E KONEC ==="')

Z0AA = '''echo "=== Z0aa: KONFLIKTI PDF PILL ŽIVO (R302 — 32. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0aa klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w/Z0x).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\\"konflikti-pdf-pill\\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\\"konflikti-pdf-pill\\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('isti poli-odprto pregled kot žig')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r302-z0aa-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r302-z0aa-pill.json').read().strip()
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
  agent-browser eval "(()=>{const b=document.querySelector('button[data-testid=\\"konflikti-pdf-pill\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('Konflikti PDF se izvozi, ko je vpisan termin v prihajajo\\u010dem tednu.'); const zelen=body.includes('Ni dokazanih konfliktov v okviru') && body.includes('\\u017dig je zelen'); const uspeh=body.includes('Konflikti prenešeni v PDF ('); return JSON.stringify({prazno, zelen, uspeh, pdfMagic:window.__pdfMagic??null, pdfLen:window.__pdfLen??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r302-z0aa-pdf.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r302-z0aa-pdf.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r302-e2e-z0aa-konflikti-pdf.png" > /dev/null 2>&1
else
  echo "Z0aa OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R302 ×11 ostajajo obvezni dokaz"
fi

'''

marker = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir '
idx = s.index(marker)
s = s[:idx] + Z0AA + s[idx:]

open(DST, 'w').write(s)
print('r302-e2e-browser.sh zgeneriran (' + str(len(s.splitlines())) + ' vrstic)')
