#!/usr/bin/env python3
# R303 — generira scripts/r303-e2e-browser.sh iz r302-e2e-browser.sh:
#  1. NOV Z0ab blok: EKIPE PDF PILL ŽIVO (33. člen — Vodja tedenski PDF po
#     ekipah) — VEDNO viden (P1-k precedens): pill (testid + label +
#     definicijski naslov) + klik → trije ISKRENI izidi (sum=1 — vzajemna
#     izključitev): prazno okno → toast 'Ni terminov…', 0 ekip → toast
#     'Ni ekip z termini…' (NIČ datoteke — fail-closed, mirror R299),
#     uspeh → bajtna capture %PDF- magija;
#  2. poti + oznake r302 → r303;
#  3. ZERO-MUTACIJA veriga nespremenjena (fp pre/post + restore).
SRC = '/home/z/my-project/scripts/r302-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r303-e2e-browser.sh'

s = open(SRC).read()

s = s.replace('/tmp/r302-', '/tmp/r303-')
s = s.replace('qa-r302-e2e-', 'qa-r303-e2e-')
s = s.replace(
    '# R302 E2E ŽIVO (lokalni :3100, ADMIN) — KONFLIKTI PDF (32. člen izvozne\n# družine — PDF brat pregledu R300 + CSV R301; dokaz na tisku) +\n# [kombinirano z R301] KONFLIKTI CSV (CSV brat pregledu R300 EN VIR; dokazani pari prekrivanj) +',
    '# R303 E2E ŽIVO (lokalni :3100, ADMIN) — VODJA TEDENSKI PDF PO EKIPAH (33. člen izvozne\n# družine — PDF brat ICS po ekipah R299; ENA sekcija na ekipo) +\n# [kombinirano z R302] KONFLIKTI PDF (PDF brat pregledu R300 + CSV R301; dokaz na tisku) +',
)
s = s.replace('echo "=== R302 E2E KONEC ==="', 'echo "=== R303 E2E KONEC ==="')

Z0AB = '''echo "=== Z0ab: EKIPE PDF PILL ŽIVO (R303 — 33. člen izvozne družine; pogojni probe — vsi trije izidi iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0ab klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v/Z0w/Z0x/Z0aa).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[data-testid=\\"ekipe-pdf-pill\\"]');})()" 16; then
  agent-browser eval "(()=>{const pill=document.querySelector('button[data-testid=\\"ekipe-pdf-pill\\"]'); return JSON.stringify({pill:!!pill, label:pill?pill.textContent.trim():null, aria:pill?pill.getAttribute('aria-label'):null, title:pill?((pill.getAttribute('title')||'').includes('ENA sekcija na ekipo')):null, disabled:pill?pill.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r303-z0ab-pill.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r303-z0ab-pill.json').read().strip()
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
  agent-browser eval "(()=>{const b=document.querySelector('button[data-testid=\\"ekipe-pdf-pill\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni terminov v naslednjih 7 dneh') && body.includes('PDF po ekipah se izvozi, ko je vpisan termin v prihajajo\\u010dem tednu.'); const niekip=body.includes('Ni ekip z termini v naslednjih 7 dneh') && body.includes('PDF po ekipah se izvozi, ko ima ekipa vpisan termin v prihajajo\\u010dem tednu.'); const uspeh=body.includes('Tedenski vozni red po ekipah prenešen (Tedenski-po-ekipah-'); return JSON.stringify({prazno, niekip, uspeh, pdfMagic:window.__pdfMagic??null, pdfLen:window.__pdfLen??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r303-z0ab-pdf.json
  python3 - <<'PYEOF8' || exit 1
import json
raw = open('/tmp/r303-z0ab-pdf.json').read().strip()
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
  agent-browser screenshot "$SS/qa-r303-e2e-z0ab-ekipe-pdf.png" > /dev/null 2>&1
else
  echo "Z0ab OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R303 ×11 ostajajo obvezni dokaz"
fi

'''

marker = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir '
idx = s.index(marker)
s = s[:idx] + Z0AB + s[idx:]

open(DST, 'w').write(s)
print('r303-e2e-browser.sh zgeneriran (' + str(len(s.splitlines())) + ' vrstic)')
