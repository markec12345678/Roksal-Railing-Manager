#!/usr/bin/env python3
# R310 — derivacija E2E skripte iz r309-e2e-browser.sh:
#   (1) preimenovalni markerji R309→R310 (poti, zaslonske slike, /tmp, sekret),
#   (2) NOV Z0ai blok (3. val unifikacije ŽIVO — 10 val-3 handlerjev ×
#       pokvarjen JSON → 400 z ISTO EN VIR ovojnico; metode PO RUTI —
#       crm/equipment/measurements/[id] PATCH, ostali POST; dvojni podpis),
#   (3) fail-closed preverbe: vsak korak štet, ostanki starega imena (razred
#       znakov, brez samozadetka), blok prisoten, uglašenost zapisov.
# LEKCIJA R306 2 / R307 3 / R309: transformacije morajo biti grep-potrjene.
import sys

VIR = '/home/z/my-project/scripts/r309-e2e-browser.sh'
CILJ = '/home/z/my-project/scripts/r310-e2e-browser.sh'

# Metode PO RUTI (lekcija R309 6: wire probei berejo metodo iz rute —
# crm@218 PATCH, equipment@137 PATCH, measurements/[id]@53 PATCH, ostali POST).
# measurements/[id] uporablja ne-obstojeci id — razčlenjevalnik strelja PRED
# db iskanjem (vrstni red v kodi: params → telo → db). ar/analyze ima
# rate-limit 20/10min — EN probe je varen.
Z0AI = r'''
echo "=== Z0ai: 3. VAL UNIFIKACIJE ŽIVO (R310 — EN VIR I/O meja val-3; 10 handlerjev; ZERO-MUTACIJA) ==="
# Val-3 handlerji (iz .catch(() => null) migrirani na preberiJsonTelo —
# vzorec R309) × pokvarjen JSON → NATANKO 400 z ISTO EN VIR ovojnico.
# Metoda po ruti (crm + equipment + measurements/[id] PATCH — lekcija R309 6).
# Dvojni podpis (R194/R309): roksal_csrf iz document.cookie → x-csrf-token.
# ZERO-MUTACIJA: guard strelja PRED vsakim db zapisom — odtis ostane.
agent-browser eval "(()=>{window.__val3=[]; const ck=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('roksal_csrf=')); const tok=ck?ck.slice(12):null; const h={'Content-Type':'application/json'}; if(tok)h['x-csrf-token']=tok; const rute=[['quote','/api/quote','POST'],['railing-layout','/api/railing-layout','POST'],['users','/api/users','POST'],['crm','/api/crm','PATCH'],['equipment','/api/equipment','PATCH'],['qc','/api/qc','POST'],['evidence','/api/evidence','POST'],['viz-render','/api/viz/render','POST'],['measurements-id','/api/measurements/e2e-r310-ne-obstojeci-id','PATCH'],['ar-analyze','/api/ar/analyze','POST']]; (async()=>{ for (const [ime,url,metoda] of rute){ try{ const r=await fetch(url,{method:metoda,credentials:'same-origin',headers:h,body:'{pokvarjen'}); let b=null; try{b=await r.json();}catch(e){b=null;} window.__val3.push({ime,status:r.status,error:b&&typeof b==='object'?(b.error??null):null}); }catch(e){ window.__val3.push({ime,status:0,error:'MREŽA: '+String(e)}); } } })(); return 'poslano '+rute.length;})()" 2>&1 | tail -1
eb_cakaj 8
agent-browser eval "JSON.stringify(window.__val3??[])" 2>&1 | tail -1 > /tmp/r310-z0ai.json
python3 - <<'PYEOFZ0AI' || exit 1
import json
raw = open('/tmp/r310-z0ai.json').read().strip()
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

'''

def main() -> None:
    vir = open(VIR, encoding='utf-8').read()

    # (1) preimenovanja (vrstni red: specifično → splošno)
    c1 = vir.count('r309-e2e-lokalni-sekret')
    vir = vir.replace('r309-e2e-lokalni-sekret', 'r310-e2e-lokalni-sekret')
    c2 = vir.count('r309-')
    vir = vir.replace('r309-', 'r310-')
    c3 = vir.count('R309')
    vir = vir.replace('R309', 'R310')

    # (3) fail-closed preverbe nad PREIMENOVANO bazo (PRED vstavitvijo —
    # Z0ai blok sme omenjati R309/R308 kot zgodovinske lekcije)
    for vzorec, ime in (
        ('r309-e2e-lokalni-sekret', 'star sekret'),
        ("sed -e 's/r309", 'sed ostanki'),
        ('r309-', 'star r309- marker'),
        ('R309', 'star R309 marker'),
    ):
        if vzorec in vir:
            print(f'FAIL-CLOSED: ostanek "{ime}" v preimenovani bazi ({vir.count(vzorec)}×)')
            sys.exit(1)
    # razred znakov (brez samozadetka — lekcija R307 3)
    import re
    if re.search(r'r30[9]-e2e|R309', vir):
        print('FAIL-CLOSED: ostanek starega imena (razred znakov)')
        sys.exit(1)

    marker = 'echo "=== Z0ah:'
    if vir.count(marker) != 1:
        print(f'FAIL-CLOSED: Z0ah marker najden {vir.count(marker)}× (pričakovano 1)')
        sys.exit(1)
    vir = vir.replace(marker, Z0AI + marker, 1)

    for obvezno in ('Z0ai', 'Z0ah', 'Z0ag', '__val3', 'PYEOFZ0AI'):
        if obvezno not in vir:
            print(f'FAIL-CLOSED: obvežen del "{obvezno}" manjka')
            sys.exit(1)
    if vir.count('=== Z0ai:') != 1 or vir.count('=== Z0ah:') != 1:
        print('FAIL-CLOSED: blokovski markerji niso natanko 1×')
        sys.exit(1)

    open(CILJ, 'w', encoding='utf-8').write(vir)
    print(f'OK: {CILJ} zgrajen (sekret ×{c1}, r309- ×{c2}, R309 ×{c3}; Z0ai vstavljen pred Z0ah)')

if __name__ == '__main__':
    main()
