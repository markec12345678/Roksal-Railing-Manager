#!/usr/bin/env python3
# R335 — derive r335-e2e-browser.sh iz r334 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. /tmp/r334- → /tmp/r335- (vse pojavitve) + qa-r334- → qa-r335-
#   2. Glava: Z0bc opis (62. člen mesečno poročilo CSV ŽIVO — brez seeda,
#      READ-ONLY izvoz; determinizem na podatkovnih bajtih brez 'Izvoženo ob')
#   3. NOV Z0bc blok PO Z0bb (pred ODTIS post-checks)
#   4. Footer R334 → R335
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r334-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r335-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Poti ──
zam('/tmp/r334-', '/tmp/r335-', 164)
zam('qa-r334-', 'qa-r335-', 2)
zam('/tmp/R334-server-e2e.log', '/tmp/R335-server-e2e.log')

# ── 2. Glava: Z0bc opis ──
zam('''#         'Izvoženo ob' sta OBI izvoza BAJTNO enaka, kanon 46./47. člen);
#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO''',
'''#         'Izvoženo ob' sta OBI izvoza BAJTNO enaka, kanon 46./47. člen);
#   Z0bc: MESEČNO POROČILO VODJE CSV ŽIVO (R335 NOVO — 62. člen issue #1,
#         CSV brat Poročilo PDF rundi M): BREZ seeda — READ-ONLY izvoz nad
#         živimi lokalnimi podatki (ZERO-MUTACIJA trivialno — izvoz NIČ ne
#         piše); dispatch vodja → CSV pill [aria-label="Izvozi mesečno
#         poročilo vodje kot CSV"] → blob ujet prek URL.createObjectURL
#         patcha (Z0bb/Z0ba kanon) ×2 klikov → BAJTNI dokaz v brskalniku:
#         UTF-8 BOM (RAW bajti EF BB BF) + MIME text/csv + glava dokumenta
#         ('Mesečno poročilo vodje;<Mesec Leto>' — mesecIme EN VIR iz PDF
#         brata) + 'Izvoženo ob' (PODATKOVNI izvoz — kanon R330–R333) + KPI
#         ('Prihodek (plačano);…' — ISTI naslovi kot PDF kpiBox) + prihodki
#         glava ('Mesec;Prihodki') + glave VERBATIM PDF autoTable head ×3 +
#         Sklep ('Skupno stanje: …' VERBATIM PDF sklepna vrstica) + Vir niz
#         + DETERMINIZEM ŽIVO: vrstice BREZ 'Izvoženo ob' bajtno enake med
#         obema izvozoma (podatkovni izvoz z referenčnim mesecem — kanon
#         R330–R333);
#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO''')

# ── 3. Z0bc blok PO Z0bb (pred ODTIS post-checks) ──
zam('''  agent-browser screenshot "$SS/qa-r335-e2e-z0bb-pill-ni-viden.png" > /dev/null 2>&1
fi

node scripts/r276-db-e2e.cjs fp > /tmp/r335-fp-post-276.json || exit 1''',
'''  agent-browser screenshot "$SS/qa-r335-e2e-z0bb-pill-ni-viden.png" > /dev/null 2>&1
fi

echo "=== Z0bc: MESEČNO POROČILO VODJE CSV ŽIVO (R335 — 62. člen issue #1: CSV brat Poročilo PDF rundi M; brez seeda — READ-ONLY izvoz nad živimi podatki; ZERO-MUTACIJA trivialno) ==="
# EN VIR resnica = živi lokalni podatki (ISTI ReportData kot PDF brat —
# komponentna izpeljava mesecniPregledData, DVA potrošnika) — E2E NE seje
# nič (izvoz je čista projekcija — NIČ DB pisanj); dispatch vodja → CSV
# pill [aria-label="Izvozi mesečno poročilo vodje kot CSV"] → blob ujet
# prek URL.createObjectURL patcha (Z0bb/Z0ba/Z0as kanon) ×2 klikov →
# BAJTNI dokaz v brskalniku: BOM raw + MIME + glava dokumenta + Izvoženo
# ob (PODATKOVNI izvoz — kanon R330–R333) + KPI + glave VERBATIM ×3 +
# prihodki glava + Sklep VERBATIM + Vir niz + DETERMINIZEM ŽIVO: vrstice
# brez 'Izvoženo ob' bajtno enake (oba izvoza iz ISTIH živih podatkov).
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
if eb_pocakaj_na "(()=>{return !![...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi mesečno poročilo vodje kot CSV');})()" 8; then
  agent-browser eval "(()=>{window.__z335mesblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__z335mesblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
  eb_klik_gumb "Izvozi mesečno poročilo vodje kot CSV"
  eb_cakaj 3
  eb_klik_gumb "Izvozi mesečno poročilo vodje kot CSV"
  eb_cakaj 3
  agent-browser eval "((async()=>{try{const blobi=window.__z335mesblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); const t1=new TextDecoder('utf-8').decode(u1); const t2=new TextDecoder('utf-8').decode(u2); const bomRaw=(u1[0]===0xEF&&u1[1]===0xBB&&u1[2]===0xBF); const vr1=t1.replace(/^\\uFEFF/,'').split('\\r\\n').filter(v=>v.length>0); const vr2=t2.replace(/^\\uFEFF/,'').split('\\r\\n').filter(v=>v.length>0); const pod1=vr1.filter(v=>!v.startsWith('Izvoženo ob;')); const pod2=vr2.filter(v=>!v.startsWith('Izvoženo ob;')); return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, bom:bomRaw, mime:blobi[0].type||null, glava:vr1[0]??null, izvozenoOb:(vr1.find(v=>v.startsWith('Izvoženo ob;'))??null), kpiPrihodek:(vr1.find(v=>v.startsWith('Prihodek (plačano);'))??null), kpiZapadlo:(vr1.find(v=>v.startsWith('Zapadlo;'))??null), prihodkiGlava:(vr1.find(v=>v==='Mesec;Prihodki')??null), placaniGlava:(vr1.find(v=>v==='Račun;Kupec;Projekt;Plačano;Znesek')??null), zapadliGlava:(vr1.find(v=>v==='Račun;Kupec;Rok plačila;Dni zapadlo;Znesek')??null), projektiGlava:(vr1.find(v=>v==='Projekt;Stranka;Status;Cena')??null), sklep:(vr1.find(v=>v.startsWith('Sklep;Skupno stanje: '))??null), vir:(vr1.find(v=>v.startsWith('Vir;'))??null), podatkovnaBajtnaEnaka:pod1.join('\\n')===pod2.join('\\n'), vrstic:vr1.length, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r335-z0bc.json
  python3 - <<'PYEOFZ0BC' || exit 1
import json, re
raw = open('/tmp/r335-z0bc.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0bc parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0bc blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['bom'] is True, 'Z0bc BOM FAIL (UTF-8 BOM bajti EF BB BF — formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0bc MIME FAIL: ' + json.dumps(d)
assert d['glava'] is not None and d['glava'].startswith('Mesečno poročilo vodje;'), 'Z0bc glava FAIL (dokumentna glava = naslov + mesec): ' + json.dumps(d.get('glava'))
assert re.search(r';(Januar|Februar|Marec|April|Maj|Junij|Julij|Avgust|September|Oktober|November|December) \\d{4}$', d['glava']), 'Z0bc mesecIme FAIL (EN VIR iz PDF brata): ' + json.dumps(d.get('glava'))
assert d['izvozenoOb'] is not None and d['izvozenoOb'].startswith('Izvoženo ob;'), 'Z0bc Izvoženo ob FAIL (PODATKOVNI izvoz z referenčnim mesecem — kanon R330–R333): ' + json.dumps(d.get('izvozenoOb'))
assert d['kpiPrihodek'] is not None and d['kpiPrihodek'].startswith('Prihodek (plačano);'), 'Z0bc KPI FAIL (ISTI naslov kot PDF kpiBox): ' + json.dumps(d.get('kpiPrihodek'))
assert d['kpiZapadlo'] is not None and d['kpiZapadlo'].startswith('Zapadlo;'), 'Z0bc KPI zapadlo FAIL: ' + json.dumps(d.get('kpiZapadlo'))
assert d['prihodkiGlava'] == 'Mesec;Prihodki', 'Z0bc prihodki glava FAIL: ' + json.dumps(d.get('prihodkiGlava'))
assert d['placaniGlava'] == 'Račun;Kupec;Projekt;Plačano;Znesek', 'Z0bc plačani glava FAIL (VERBATIM PDF autoTable head): ' + json.dumps(d.get('placaniGlava'))
assert d['zapadliGlava'] == 'Račun;Kupec;Rok plačila;Dni zapadlo;Znesek', 'Z0bc zapadli glava FAIL (VERBATIM PDF autoTable head): ' + json.dumps(d.get('zapadliGlava'))
assert d['projektiGlava'] == 'Projekt;Stranka;Status;Cena', 'Z0bc projekti glava FAIL (VERBATIM PDF autoTable head): ' + json.dumps(d.get('projektiGlava'))
assert d['sklep'] is not None and d['sklep'].startswith('Sklep;Skupno stanje: ') and d['sklep'].endswith('.'), 'Z0bc Sklep FAIL (VERBATIM PDF sklepna vrstica): ' + json.dumps(d.get('sklep'))
assert d['vir'] == 'Vir;Mesečno poročilo vodje — ista resnica kot PDF brat (runda M): KPI, prihodki 6 mesecev, plačani in zapadli računi, projekti po statusu', 'Z0bc Vir FAIL: ' + json.dumps(d.get('vir'))
assert d['podatkovnaBajtnaEnaka'] is True, 'Z0bc DETERMINIZEM FAIL — vrstice brez Izvoženo ob niso bajtno enake (kanon R330–R333): ' + json.dumps(d)
assert d['bajtov'] > 500, 'Z0bc prekratek CSV: ' + json.dumps(d)
assert d['vrstic'] >= 28, 'Z0bc vrstic FAIL (glava + Izvoženo ob + KPI ×6 + prihodki 6 + 3 glave + meta ×10): ' + json.dumps(d)
assert d['err'] is None, 'Z0bc err: ' + json.dumps(d)
print('Z0bc OK — mesečno poročilo vodje CSV ŽIVO bajtno: BOM + MIME + glava dokumenta + mesecIme EN VIR + Izvoženo ob + KPI + glave VERBATIM ×3 + prihodki + Sklep + Vir + ' + str(d['bajtov']) + ' bajtov + ' + str(d['vrstic']) + ' vrstic + DETERMINIZEM ŽIVO na podatkovnih bajtih (62. člen)')
PYEOFZ0BC
  agent-browser screenshot "$SS/qa-r335-e2e-z0bc-mesecni-csv.png" > /dev/null 2>&1
else
  echo "Z0bc OPOMBA: Mesečno poročilo CSV pill ni viden na spot seji (RBAC skoping ali iskren gate) — chunk needleji R335 ostajajo obvezni dokaz"
  agent-browser screenshot "$SS/qa-r335-e2e-z0bc-pill-ni-viden.png" > /dev/null 2>&1
fi

node scripts/r276-db-e2e.cjs fp > /tmp/r335-fp-post-276.json || exit 1''')

# ── 4. Footer ──
zam('echo "=== R334 E2E KONEC ==="', 'echo "=== R335 E2E KONEC ==="')

DOL.write_text(text, encoding='utf-8')
print('r335-e2e-browser.sh: OK (derive iz r334)')
