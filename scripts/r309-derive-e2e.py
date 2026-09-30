#!/usr/bin/env python3
# R309 — derivacija E2E skripte iz r308-e2e-browser.sh:
#   (1) preimenovalni markerji R308→R309 (poti, zaslonske slike, /tmp, sekret),
#   (2) NOV Z0ah blok (migracijski val ŽIVO — 26 handlerjev × pokvarjen JSON
#       → 400 z ISTO EN VIR ovojnico; dvojni podpis zaveden — token pogojen),
#   (3) fail-closed preverbe: vsak korak štet, ostanki starega imena,
#       blok prisoten, uglašenost zapisov.
# LEKCIJA R306 2 / R307 3: transformacije morajo biti grep-potrjene; razred
# znakov 'R30[8]_PUSH' pri samopreverbi, da preverba ne ujame sebe.
import re
import sys

VIR = '/home/z/my-project/scripts/r308-e2e-browser.sh'
CILJ = '/home/z/my-project/scripts/r309-e2e-browser.sh'

Z0AH = r'''
echo "=== Z0ah: MIGRACIJSKI VAL ŽIVO (R309 — EN VIR I/O meja api-telo; 26 handlerjev; ZERO-MUTACIJA) ==="
# Vseh 26 migriranih handlerjev × pokvarjen JSON → NATANKO 400 z ISTO
# EN VIR ovojnico (prej: throw-style parse → 500 na vseh). Metoda po ruti
# (bom-draft ima SAMO PATCH — 405-lekcija prvega teka). Dvojni podpis
# (R194): brskalniški piškotek roksal_csrf, če obstaja, gre v glavo
# x-csrf-token (isti protokol kot lasten fetch ovojnik aplikacije).
# ZERO-MUTACIJA: guard strelja PRED vsakim db zapisom — odtis ostane.
agent-browser eval "(()=>{window.__val=[]; const ck=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('roksal_csrf=')); const tok=ck?ck.slice(12):null; const h={'Content-Type':'application/json'}; if(tok)h['x-csrf-token']=tok; const rute=[['ar-snapshots','/api/ar-snapshots','POST'],['bom-draft','/api/bom-draft','PATCH'],['bom-refine','/api/bom-refine','POST'],['crews','/api/crews','POST'],['customers','/api/customers','POST'],['deal-lock','/api/deal-lock','POST'],['documents','/api/documents','POST'],['gallery','/api/gallery','POST'],['inventory','/api/inventory','POST'],['invoices','/api/invoices','POST'],['material-orders','/api/material-orders','POST'],['material-prices','/api/material-prices','POST'],['measurement-confirm','/api/measurement/confirm','POST'],['measurements','/api/measurements','POST'],['notifications-read','/api/notifications/read','POST'],['photos','/api/photos','POST'],['portal','/api/portal','POST'],['profili','/api/profili','POST'],['projects','/api/projects','POST'],['punch','/api/punch','POST'],['schedules','/api/schedules','POST'],['sketches','/api/sketches','POST'],['slopes','/api/slopes','POST'],['suppliers','/api/suppliers','POST'],['surveys','/api/surveys','POST'],['vision-placement','/api/vision/placement','POST']]; (async()=>{ for (const [ime,url,metoda] of rute){ try{ const r=await fetch(url,{method:metoda,credentials:'same-origin',headers:h,body:'{pokvarjen'}); let b=null; try{b=await r.json();}catch(e){b=null;} window.__val.push({ime,status:r.status,error:b&&typeof b==='object'?(b.error??null):null}); }catch(e){ window.__val.push({ime,status:0,error:'MREŽA: '+String(e)}); } } })(); return 'poslano '+rute.length;})()" 2>&1 | tail -1
eb_cakaj 8
agent-browser eval "JSON.stringify(window.__val??[])" 2>&1 | tail -1 > /tmp/r309-z0ah.json
python3 - <<'PYEOF13' || exit 1
import json
raw = open('/tmp/r309-z0ah.json').read().strip()
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
agent-browser screenshot "$SS/qa-r309-e2e-z0ah-val.png" > /dev/null 2>&1
'''

def main() -> int:
    vir = open(VIR, encoding='utf-8').read()
    izhod = vir.replace('R308', 'R309').replace('r308', 'r309')
    # Z0ah — vstavi PRED "=== Z1:" (po Z0ag; kronološki red Z0a*)
    sidro = '\necho "=== Z1:'
    if izhod.count(sidro) != 1:
        print(f'FAIL-CLOSED: sidro "=== Z1:" najdeno {izhod.count(sidro)}× (pričakovano 1)')
        return 1
    izhod = izhod.replace(sidro, '\n' + Z0AH + sidro)
    # Preverbe
    for obvezno in ('Z0ah: MIGRACIJSKI VAL ŽIVO', "['ar-snapshots'", 'qa-r309-e2e-z0ah-val.png', 'Z0ag', 'PYEOF13'):
        if obvezno not in izhod:
            print(f'FAIL-CLOSED: obvezni fragment manjka: {obvezno!r}')
            return 1
    ostanki = [l for l in izhod.splitlines() if re.search(r'\br308\b|\bR308\b', l)]
    if ostanki:
        print('FAIL-CLOSED: ostanki R308/r308:')
        for l in ostanki[:5]: print('  ', l[:120])
        return 1
    if izhod.count('PYEOF') < 10:
        print('FAIL-CLOSED: heredoc oznake izgubljene')
        return 1
    open(CILJ, 'w', encoding='utf-8').write(izhod)
    print(f'OK: {CILJ} ({len(izhod.splitlines())} vrstic; Z0ah vstavljen; ostankov R308: 0)')
    return 0

if __name__ == '__main__':
    sys.exit(main())
