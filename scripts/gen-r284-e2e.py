#!/usr/bin/env python3
# R284 — generator r284-e2e-browser.sh iz r283-e2e-browser.sh:
#   • preimenovanja: /tmp/r283-* → /tmp/r284-*, qa-r283-* → qa-r284-*,
#     server log + sekret + echo glave;
#   • SEED skripti OSTANEJO (r276/r281/r283-referencni — isti odtis kanon);
#   • Z2z NOV blok: TERENSKI ZAPISNI LIST PDF ŽIVO (fill-in resnica —
#     issue #15 §3): klik gumba → toast → %PDF- magija + bajti;
#   • Z2b ostaja (terenski PDF regresija — R269/R277 bajtni kontrakt ŽIVO).
SRC = '/home/z/my-project/scripts/r283-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r284-e2e-browser.sh'

src = open(SRC, encoding='utf-8').read()

# 1) varna preimenovanja (poti/logi/screenshot/sekret/echo glave — NE seed
#    skripti: r283-referencni-projekt.cjs OSTANE, ker je to vir resnice).
src = src.replace('/tmp/r283-', '/tmp/r284-')
src = src.replace('qa-r283-e2e-', 'qa-r284-e2e-')
src = src.replace('R283-server-e2e.log', 'R284-server-e2e.log')
src = src.replace('r283-e2e-lokalni-sekret', 'r284-e2e-lokalni-sekret')
src = src.replace('# R283 E2E ŽIVO', '# R284 E2E ŽIVO')
src = src.replace('=== R283 E2E KONEC ===', '=== R284 E2E KONEC ===')
src = src.replace('#   Z2b: TERENSKI PDF ŽIVO — eb_zajem_pdf + izvoz → toast + %PDF- magija;',
                  '#   Z2b: TERENSKI PDF ŽIVO — eb_zajem_pdf + izvoz → toast + %PDF- magija (R269 regresija);\n'
                  '#   Z2z: ZAPISNI LIST PDF ŽIVO — fill-in resnica (issue #15 §3): gumb →\n'
                  '#        toast \'Zapisni list prenešen v PDF\' + %PDF- magija (NOVA družina R284);')

# 2) Z2z blok — vstavi TAKOJ po Z2b zaključku (screenshot vrstica Z2b).
z2b_konec = "agent-browser screenshot \"$SS/qa-r284-e2e-teren-pdf.png\" > /dev/null 2>&1\n"
z2z = z2b_konec + """
echo "=== Z2z: TERENSKI ZAPISNI LIST PDF ŽIVO — fill-in resnica (issue #15 §3) ==="
eb_zajem_pdf val284
eb_klik_gumb "Izvozi terenski zapisni list kot PDF"
eb_pocakaj_tekst "Zapisni list prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val284; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r284-z2z.json
python3 -c "import json; r=json.load(open('/tmp/r284-z2z.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-', 'Z2z PDF FAIL: '+json.dumps(d); assert d['bajtov']>10000, 'Z2z prekratek PDF: '+json.dumps(d); assert d['err'] is None, 'Z2z err: '+json.dumps(d); print('Z2z OK — zapisni list PDF ŽIVO (' + str(d['bajtov']) + ' bajtov, %PDF- magija — fill-in resnica)')" || exit 1
agent-browser screenshot "$SS/qa-r284-e2e-zapisni-pdf.png" > /dev/null 2>&1
"""
assert z2b_konec in src
src = src.replace(z2b_konec, z2z)

open(DST, 'w', encoding='utf-8').write(src)
print("OK — r284-e2e-browser.sh zapisan (Z2z + varna preimenovanja)")
