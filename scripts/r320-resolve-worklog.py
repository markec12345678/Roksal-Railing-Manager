#!/usr/bin/env python3
# R319 kolizija — razreši worklog.md konflikt: obdrži OBĚ sekciji (njihova
# R319 PRODUKCIJSKA ZRELOST + moja preimenovana R320 = 49. člen), z iskreno
# kolizijsko noto. Renaming R319→R320 SAMO znotraj moje sekcije (njihova
# referenca na R319 ostaje verbatim — njihova resnica).
import re
from pathlib import Path

P = Path('/home/z/my-project/worklog.md')
t = P.read_text(encoding='utf-8')

# En konflikt blok: <<<<<<< HEAD ... ======= ... >>>>>>> 2f3b95d (...)
m = re.search(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> 2f3b95d[^\n]*\n', t, re.DOTALL)
assert m, 'konflikt blok NI najden'
njihova = m.group(1)
moja = m.group(2)

# Preimenuj mojo rundó R319 → R320 (celoten besedilni substituciji — v moji
# sekciji NI tujih referenc na njihovo R319, ker je bila pisana pred kolizijo)
moja_nova = moja.replace('R319', 'R320').replace('r319-', 'r320-')
# Kolizija nota na vrhu moje sekcije (iskrenost — kanon R310 lekcija 5)
moja_nova = moja_nova.replace(
    '## R320 — 2026-10-01 (cron tick 202610010202; 49. člen issue #1)',
    '## R320 — 2026-10-01 (cron tick 202610010202; 49. člen issue #1; KOLIZIJA: vzporedna seja je vzela številko R319 [38f5300, PRODUKCIJSKA ZRELOST] — moja runda preimenovana R319→R320 po kanonu LEKCIJA 6 / precedens vzporedne seje)',
)

t = t[:m.start()] + njihova + '\n\n' + moja_nova + '\n' + t[m.end():]

# Izhodna asercija: NIČ markerjev, obe sekciji prisotni
assert '<<<<<<<' not in t and '>>>>>>>' not in t, 'ostanki markerjev'
assert '## R319 — 2026-10-01 (seja: lastniška žetona' in t, 'njihova R319 sekcija manjka'
assert '## R320 — 2026-10-01 (cron tick 202610010202; 49. člen issue #1; KOLIZIJA' in t, 'moja R320 sekcija manjka'
P.write_text(t, encoding='utf-8')
print(f'OK — worklog razrešen ({len(t.splitlines())} vrstic; njihova R319 + moja R320)')
