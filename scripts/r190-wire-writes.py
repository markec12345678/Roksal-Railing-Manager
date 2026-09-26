#!/usr/bin/env python3
"""R190 — wiring zapisOmejitev guard v val-1 rute (deterministično)."""
import re, sys

BASE = 'src/app/api/'
# (ruta-file, ruta-key, handlerji)
TARGETS = [
    ('calculator/route.ts', 'calculator', ['POST']),
    ('quote/route.ts', 'quote', ['POST']),
    ('viz/render/route.ts', 'viz/render', ['POST']),
    ('viz/preview/route.ts', 'viz/preview', ['POST']),
    ('viz/product-preview/route.ts', 'viz/product-preview', ['POST']),
    ('viz/stage/route.ts', 'viz/stage', ['POST']),
    ('measurement/detect/route.ts', 'measurement/detect', ['POST']),
    ('measurement/confirm/route.ts', 'measurement/confirm', ['POST']),
    ('sync/route.ts', 'sync', ['POST', 'DELETE']),
]

IMPORT_LINE = "import { zapisOmejitev } from '@/lib/rate-limit'"

for rel, ruta, handlers in TARGETS:
    path = BASE + rel
    src = open(path).read()
    orig = src
    if "zapisOmejitev" in src:
        print(f"SKIP (že vsebuje): {path}")
        continue
    # 1) import — za ZADNJO obstoječo import vrstico
    import_lines = [m.end() for m in re.finditer(r"^import .*?from ['\"].*['\"]\s*$", src, re.M)]
    if not import_lines:
        print(f"NAPAKA: ni importov v {path}"); sys.exit(1)
    pos = import_lines[-1]
    src = src[:pos] + "\n" + IMPORT_LINE + src[pos:]
    # 2) guard kot PRVI stavek handlerja
    for h in handlers:
        pat = re.compile(r"(export async function " + h + r"\(request: Request\) \{\n)")
        m = pat.search(src)
        if not m:
            print(f"NAPAKA: handler {h} ni najden v {path}"); sys.exit(1)
        guard = (f"  // R190 — val 1 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)\n"
                 f"  const zavrnjeno = zapisOmejitev(request, '{ruta}')\n"
                 f"  if (zavrnjeno) return zavrnjeno\n")
        src = src[:m.end()] + guard + src[m.end():]
    open(path, 'w').write(src)
    n = orig.count('\n') - src.count('\n')
    print(f"OK: {path} (+2 vrstice/import + {len(handlers)} guardov)")
print("KONEC")
