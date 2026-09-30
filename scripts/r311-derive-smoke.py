#!/usr/bin/env python3
# R311 — derive r311-run-smoke.sh iz r310-run-smoke.sh (generacijski vzorec).
# VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed: napačno število
# zadetkov → izpisek + exit 1).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r310-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r311-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# Glava: R310 kontekst → R311 kontekst (2. vrstica komentarja + NOVO R310 vrstica)
zam('# R310 dimni test (vzorec r273/r296-r309) — standalone :3100 + javni health +',
    '# R311 dimni test (vzorec r273/r296-r310) — standalone :3100 + javni health +')
zam('# Potrjuje, da build z R310 spremembami (3. VAL UNIFIKACIJE I/O MEJE —',
    '# Potrjuje, da build z R311 spremembami (41. člen issue #1: AI raba — iskrena\n# resnica na zaslonu [lib ai-raba-pregled ČISTA projekcija katalog ×\n# AI_KANDIDATI; vodja blok WYSIWYG] + STIL harmonizacija val 2:\n# measurements/material-intelligence/deal spomnik surove amber → žetoni;\n# nadaljevanje 3. VALA UNIFIKACIJE I/O MEJE —')
zam('# vzorec R309; pokvarjen JSON = 400 napaka odjemalca, nikoli 500;\n# izjeme: sync kontrakt, auth/logout toleranca, scene/detect/measure 413)\n# vstane in odgovarja fail-closed.\n# NOVO R310: meja probe tudi na quote (val-3 zod razred) — ISTA ovojnica.',
    '# vzorec R309/R310; pokvarjen JSON = 400 napaka odjemalca, nikoli 500;\n# izjeme: sync kontrakt, auth/logout toleranca, scene/detect/measure 413)\n# vstane in odgovarja fail-closed.\n# NOVO R311: meja probe tudi na evidence (val-3 razred M) — ISTA ovojnica.')

# Sekret + poti + samoidentifikacija
zam('R310-smoke-lokalni-sekret-vsaj-32-znakov!!', 'R311-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!')
zam('/tmp/R310-server-smoke.log', '/tmp/R311-server-smoke.log')
zam('/tmp/r310-smoke-cookies.txt', '/tmp/r311-smoke-cookies.txt')
zam('/tmp/r310-smoke-telo.json', '/tmp/r311-smoke-telo.json', 2)
zam('/tmp/r310-smoke-quote.json', '/tmp/r311-smoke-quote.json', 2)
zam('--- R310 SMOKE KONEC ---', '--- R311 SMOKE KONEC ---')

# NOVO R311: val-3 probe na evidence (razred M — ročna object/null preverba,
# ena-n-datoteko migrirana v R310) — ISTA ovojnica, ZERO-MUTACIJA
zam('''echo "--- meja ŽIVO val-3: quote pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r311-smoke-quote.json -w "quote-pokvarjen=%{http_code}\\n" --max-time 10 -X POST http://127.0.0.1:3100/api/quote -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
grep -qF 'Neveljavno telo zahteve' /tmp/r311-smoke-quote.json && echo "val-3 ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 ovojnica manjka"; exit 1; }''',
'''echo "--- meja ŽIVO val-3: quote pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r311-smoke-quote.json -w "quote-pokvarjen=%{http_code}\\n" --max-time 10 -X POST http://127.0.0.1:3100/api/quote -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
grep -qF 'Neveljavno telo zahteve' /tmp/r311-smoke-quote.json && echo "val-3 ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 ovojnica manjka"; exit 1; }

echo "--- meja ŽIVO val-3 NOVO R311: evidence pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r311-smoke-evidence.json -w "evidence-pokvarjen=%{http_code}\\n" --max-time 10 -X POST http://127.0.0.1:3100/api/evidence -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
grep -qF 'Neveljavno telo zahteve' /tmp/r311-smoke-evidence.json && echo "val-3 evidence ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 evidence ovojnica manjka"; exit 1; }''')

# Ostanki stare generacije
for ostanek in ('R310-smoke', 'r310-smoke', 'R310-server', 'NOVO R310'):
    assert ostanek not in text, f'ostanek stare generacije: {ostanek}'

DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
