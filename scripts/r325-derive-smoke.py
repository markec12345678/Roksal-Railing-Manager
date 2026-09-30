#!/usr/bin/env python3
# R325 — derive r325-run-smoke.sh iz r322-run-smoke.sh (nadaljevanje
# prirojene runde po vzorcu R319/R322 — dekompozicija FAZA 2; KOLIZIJA #5:
# vzporedna seja je vzela R323 [8857d6e CSV] — runda preimenovana R323→R324,
# artefakti r323-*→r324-*).
# NATANKO ena-n-točkovne zamenjave — fail-closed; štetje na POJAVITVE.
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r322-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r325-run-smoke.sh')

s = VIR.read_text(encoding='utf-8')

def zam(staro: str, novo: str, pricakuj: int) -> None:
    global s
    n = s.count(staro)
    if n != pricakuj:
        print(f'FAIL: vzorec {n}× (pričakovano {pricakuj}): {staro[:70]!r}')
        raise SystemExit(1)
    s = s.replace(staro, novo)
    print(f'  OK {pricakuj}× {staro[:56]}')

zam('# R322 dimni test (vzorec r273/r296-r321)', '# R325 dimni test (vzorec r273/r296-r323; DVOJNA KOLIZIJA #5+#6: vzporedni R323 [CSV] + R324 [dnevni PDF] — runda preimenovana R323→R324→R325)', 1)
zam('# Potrjuje, da build z R322 spremembami (DEKOMPOZICIJA calculator-tab\n# FAZA 1 — PRIROJENIŠKA runda po vzorcu R319: 6.074 → 5.372 vrstic [−702];\n# mapa calculator/ ×5 datotek [shared.ts tipi+konstante VERBATIM + export +\n# 4 SVG diagrami ČIST PREMIK bajtno identično — vsebina ŽIVA v čankih\n# r322-build-needles ×5] + R254 SLEPA PEGA ZAPRTA: vejica v uvoznem\n# komentarju je skrila 5 ikon detektorju — trojni popravek [detektor +\n# codemod + vitest stražar: strip // PRED split] + 5 a11y popravkov IN-PLACE\n# [Bluetooth ×2 + Mic ×3 — aria-hidden, r172 vrstični pin varovan]; pokritost\n# 1430 → 1435, 0 manjkajočih) vstane in odgovarja fail-closed.',
    '# Potrjuje, da build z R324 spremembami (DEKOMPOZICIJA FAZA 2 — vzorec\n# R319/R322 prirojena runda: measurements 7.604 → 7.153 [−451; laserski BT\n# blok → laser-bt.ts + use-laser.ts + laser-panel.ts; template localStorage\n# blok → templates.ts; osiroteli Bluetooth/Radio/Unplug uvozi odstranjeni]\n# + calculator 5.372 → 4.846 [−526; 5 PDF izvozov → pdf-exports.ts z args\n# objekti; tipa CncSegment/GlassType preseljena; osirotela jsPDF/autoTable\n# uvoza odstranjena]) vstane in odgovarja fail-closed.', 1)
zam('# NOVO R322: brez nove API površine (dekompozicija = čist premik — R319\n# kanon) — meja probei ostanejo OBVEZNA regresija (49 vezav EN VIR).',
    '# NOVO R324: brez nove API površine (dekompozicija = refaktor internih\n# struktur — R319/R322 kanon) — meja probei ostanejo OBVEZNA regresija\n# (49 vezav EN VIR; calculator meja je ZLASTI pomembna — pdf-exports.ts je\n# sedaj del client drevesa calculator čanka).', 1)
zam('/tmp/r322-', '/tmp/r325-', 7)
zam('R322-smoke-lokalni-sekret', 'R325-smoke-lokalni-sekret', 1)
zam('R322-server-smoke.log', 'R325-server-smoke.log', 1)
zam('--- R322 SMOKE KONEC ---', '--- R325 SMOKE KONEC ---', 1)

# izhodna asercija (LEKCIJA R310 5/6)
assert '/tmp/r322-' not in s, 'ostanki /tmp/r322-'
assert '/tmp/r323-' not in s, 'ostanki /tmp/r323-'
assert 'R325-smoke-lokalni-sekret' in s, 'sekret manjka'
assert 'set -u' in s or '-u' in s, 'strogost manjka'

DOL.write_text(s, encoding='utf-8')
print(f'OK — {DOL.name} zapisan ({len(s.splitlines())} vrstic)')
