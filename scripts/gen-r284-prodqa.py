#!/usr/bin/env python3
# R284 — generator r284-prod-qa.sh iz r283-prod-qa.sh:
#   • glava/odtisi preimenovani (/tmp/r284-*);
#   • Z0 build-guard: meja OSTANE > R282 build 2026-09-29T12:51:36.710Z
#     (R283 deploy je ZAMUDIL 40+ min okno — P0 eskalacija lastniku; R284
#     push ponovno sproži pipeline in VSEBUJE R283 — en sam skok z R282 na
#     R284 build dokazuje oboje prek R284+R283 LIVE needlejev);
#   • Z2: dodan R284 LIVE needle blok (zapisni list ×4) nad R283 regresijo;
#   • Z1/Z1b/Z3 ostanejo (spot pogojni / verzije ruta 404 / v99 gate).
SRC = '/home/z/my-project/scripts/r283-prod-qa.sh'
DST = '/home/z/my-project/scripts/r284-prod-qa.sh'

src = open(SRC, encoding='utf-8').read()

src = src.replace('/tmp/r283-', '/tmp/r284-')
src = src.replace('/tmp/r282-', '/tmp/r284-')
src = src.replace('# R283 — PRVA naloga (worklog R283): potrditi R283 na produ',
                  '# R284 — PRVA naloga (worklog R284): potrditi R284 na produ (R283 deploy\n# zamuda > 40 min — P0; R284 vsebuje R283 — en skok z R282 builda)')
src = src.replace('#   Z0  build-guard: health build > R282 build (2026-09-29T12:51:36.710Z) —',
                  '#   Z0  build-guard: health build > R282 build (2026-09-29T12:51:36.710Z,\n#       R283 NI ŠE ŽIVO ob koncu R284 — P0) —')
src = src.replace('=== Z0: prod build-guard — R282 deploy detekcija (EPOCH primerjava) ===',
                  '=== Z0: prod build-guard — R284 deploy detekcija (EPOCH primerjava) ===')
src = src.replace('R283 NI ŠE DEPLOYAN (build ≤ R282 12:51:36.710Z)',
                  'R284 NI ŠE DEPLOYAN (build ≤ R282 12:51:36.710Z)')
src = src.replace('R283 deploy potrjen (build $BUILD > R282 12:51:36.710Z)',
                  'R284 deploy potrjen (build $BUILD > R282 12:51:36.710Z — vsebuje R283)')

r283_block = 'echo "--- R283 MANDATORY (LIVE — PRVA naloga R284) ---"'
r284_block = """echo "--- R284 MANDATORY (LIVE — PRVA naloga R285) ---"
need "TERENSKI ZAPISNI LIST" "R284 PDF naslov — LIVE"
need "Fizična ref. (mm)" "R284 fill-in stolpec — LIVE"
need "Terenska vrata (issue #14 §18)" "R284 protokolna sekcija — LIVE"
need "Izvozi terenski zapisni list kot PDF" "R284 gumb aria — LIVE"
echo "--- R283 MANDATORY (LIVE — regresija) ---\""""
assert r283_block in src
src = src.replace(r283_block, r284_block)

src = src.replace('=== R283 PROD QA — R282+R283 ŽIVO ===', '=== R284 PROD QA — R282+R283+R284 ŽIVO ===')

open(DST, 'w', encoding='utf-8').write(src)
print("OK — r284-prod-qa.sh zapisan (meja > R282 build; R284 ×4 LIVE)")
