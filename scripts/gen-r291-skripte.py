#!/usr/bin/env python3
# R291 — zgeneriraj r291 E2E/needles/smoke iz r290 vzorcev + vstavi Z0n blok
# (PRIHODKI MESECI CSV ŽIVO — pogojni probe: toast pri 0 ALI bajtna capture;
# ZERO-MUTACIJA) in R291 needle blok ×8 + TODO-R291 must_miss.

# ---------- 1) E2E: r290-e2e-browser.sh → r291-e2e-browser.sh ----------
src = open('/home/z/my-project/scripts/r290-e2e-browser.sh', encoding='utf-8').read()
src = src.replace('r290', 'r291').replace('R290', 'R291')

z0n = '''echo "=== Z0n: PRIHODKI MESECI CSV ŽIVO (R291 — 8. člen izvozne družine; pogojni probe; ZERO-MUTACIJA) ==="
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\\"Izvozi prihodke po mesecih kot CSV\\"]');})()" 16; then
  eb_csv_capture prihodkiMeseci
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\\"Izvozi prihodke po mesecih kot CSV\\"]'); if(!b) return 'BREZ-GUMBA'; b.click(); return 'kliknuto';})()" 2>&1 | tail -1
  eb_cakaj 2
  agent-browser eval "(()=>{const body=document.body.textContent; const prazno=body.includes('Ni plačanih računov') && body.includes('CSV se izvozi ob prvem plačilu.'); const uspeh=body.includes('Prihodki po mesecih prenešeni v CSV ('); const c=window.__prihodkiMeseci ?? null; const niz=(typeof c==='string'); return JSON.stringify({prazno, uspeh, csvNiz:niz, bajti:niz?c.length:0, bom:niz?c.charCodeAt(0)===0xFEFF:false, glava:niz?c.split('\\n')[0].slice(0,40):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r291-z0n.json
  python3 - <<'PYEOF3' || exit 1
import json
raw = open('/tmp/r291-z0n.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0n err: ' + json.dumps(d)
if d['prazno']:
    assert not d['csvNiz'], 'Z0n: toast pri 0 A VSEENO datoteka (kršitev fail-closed): ' + json.dumps(d)
    print('Z0n OK — CSV gumb ŽIVO, fail-closed toast pri 0 mesecih (spot iskrena praznina — R250 vzorec; NIČ datoteke)')
elif d['csvNiz']:
    assert d['bajti'] > 0 and d['bom'], 'Z0n: datoteka brez BOM/vsebine: ' + json.dumps(d)
    print('Z0n OK — CSV ŽIVO bajtno (' + str(d['bajti']) + ' B, BOM efbbbf, glava: ' + str(d['glava']) + ')')
else:
    raise AssertionError('Z0n: niti toast niti datoteka — fail-verbose kršitev: ' + json.dumps(d))
PYEOF3
  eb_csv_reset prihodkiMeseci
  agent-browser screenshot "$SS/qa-r291-e2e-z0n-meseci-csv.png" > /dev/null 2>&1
else
  echo "Z0n OPOMBA: CSV gumb ni dosegljiv na spot seji (CRM skoping RBAC?) — chunk needleji R291 ×8 ostajajo obvezni dokaz"
fi

'''
marker = 'echo "=== Z1:'
assert marker in src, 'marker Z1 ni najden (r291 e2e)'
src = src.replace(marker, z0n + marker, 1)
open('/home/z/my-project/scripts/r291-e2e-browser.sh', 'w', encoding='utf-8').write(src)
print('written r291-e2e-browser.sh')

# ---------- 2) needles: r290-build-needles.sh → r291-build-needles.sh ----------
src = open('/home/z/my-project/scripts/r290-build-needles.sh', encoding='utf-8').read()
src = src.replace('r290', 'r291').replace('R290', 'R291')
r291block = '''echo "--- R291 MANDATORY — PRIHODKI MESECI CSV (8. člen izvozne družine — LIVE) ---"
need_static "Izvozi prihodke po mesecih kot CSV" "R291 gumb aria (JSX attr literal) — LIVE"
need_static "Prihodki po mesecih kot CSV — ista resnica kot sekcija (skupaj + v teku + stornirani)" "R291 gumb title (JSX attr literal) — LIVE"
need_static "CSV se izvozi ob prvem plačilu." "R291 fail-closed toast pri 0 (R250 vzorec) — LIVE"
need_static "Prihodki po mesecih prenešeni v CSV (" "R291 uspešni toast (WYSIWYG povzetek) — LIVE"
need_static "CSV ni mogoče sestaviti iz teh podatkov" "R291 fail-verbose toast (pokvaren vir) — LIVE"
need_static "% največjega meseca" "R291 MANDATORY STIL — mini stolpc hover title (deterministična širina) — LIVE"
need_static "Plačani računi" "R291 CSV glava literal (lib čanek) — LIVE"
need_static "Vsi plačani računi po mesecih (iz seznama računov)" "R291 meta Obseg vrstica literal (lib čanek) — LIVE"
echo "--- R290 MANDATORY — PRIHODKI PO MESECIH (LIVE — regresija) ---"'''
marker2 = 'echo "--- R291 MANDATORY — PRIHODKI PO MESECIH (plačila dimenzija — R250 predal) ---"'
assert marker2 in src, 'marker R291 ni najden (r291 needles po preimenovanju)'
src = src.replace(marker2, r291block.replace('R290', 'R291'), 1)
src = src.replace('must_miss "TODO-R290" "R290 — brez razvojnih ostankov"', 'must_miss "TODO-R290" "R290 — brez razvojnih ostankov"\nmust_miss "TODO-R291" "R291 — brez razvojnih ostankov"', 1)
open('/home/z/my-project/scripts/r291-build-needles.sh', 'w', encoding='utf-8').write(src)
print('written r291-build-needles.sh')

# ---------- 3) smoke: r290-run-smoke.sh → r291-run-smoke.sh ----------
src = open('/home/z/my-project/scripts/r290-run-smoke.sh', encoding='utf-8').read()
src = src.replace('R290', 'R291')
open('/home/z/my-project/scripts/r291-run-smoke.sh', 'w', encoding='utf-8').write(src)
print('written r291-run-smoke.sh')
