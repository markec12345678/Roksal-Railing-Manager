#!/usr/bin/env python3
# r349-faza6-apply.py — FAZA 6: zamenjaj stale fetch+prune bloka v
# handleZapisniListPdf (R284) IN handleZapisniListCsv (R285) z EN VIR
# fetchMeritveTerenVnosi(selectedProject, { zKotom: true }).
# Exact-match line-boundary replacement; neuspeh = exit 1 (glasno).
import sys

PATH = 'src/components/roksal/measurements-tab.tsx'
src = open(PATH, encoding='utf-8').read()
lines = src.split('\n')

def najdi(sub, od=0):
    for i in range(od, len(lines)):
        if sub in lines[i]:
            return i
    return -1

def zamenjaj_handler(oznaka_komentar, nov_blok, ze_obdelane):
    """Zamenjaj od komentar-oznake do `})` tik pred `if (vnosi.length === 0) {`."""
    start = najdi(oznaka_komentar)
    if start < 0 or start in ze_obdelane:
        print(f'FAIL: oznaka ni najdena (ali podvojen zadetek): {oznaka_komentar}')
        sys.exit(1)
    # prva `if (vnosi.length === 0) {` PO startu
    prazen = najdi('if (vnosi.length === 0) {', start)
    if prazen < 0:
        print(f'FAIL: prazen-guard ni najden za {oznaka_komentar}')
        sys.exit(1)
    # potrdimo `      })` tik pred prazen (konec .map) — med njima je lahko
    # komentar; odstranimo vse od start do prazen-1 (vključno z `})`).
    konec = prazen  # ekskluzivno
    if lines[prazen - 1].strip() != '})':
        print(f'FAIL: pričakovano `}})` tik pred prazen-guard pri {oznaka_komentar}, najdeno: {lines[prazen-1]!r}')
        sys.exit(1)
    novi = nov_blok.split('\n')
    lines[start:konec] = novi
    ze_obdelane.add(start)

OBDELANE = set()

NOV_PDF = '''  // R284 — TERENSKI ZAPISNI LIST PDF (issue #15 §3, worklog i5): FRESH
  // fetch + fail-verbose DTO pruning od R349 FAZA 6 EN VIR
  // fetchMeritveTerenVnosi(selectedProject, { zKotom: true }) — skupno
  // resnico nosi EN VIR modul (prej namerna duplikacija pruningu, da R269
  // handler NIKOLI ne tvega regresije bajtnega kontrakta — zdaj dialektni
  // stikalo zKotom nosi OBA kontrakta EKSPLICITNO, nič tihega). Zapisni
  // list = IZPOLNJEVALNI list (X1): zapisana resnica + PRAZNI fizični
  // stolpci (Fizična ref./Δ/Zapiski) — izpolni jih lastnik na terenu po
  // docs/AR-FIELD-VALIDATION.md §3. PRAZEN seznam → iskren toast; ENA
  // izpeljava povzetka = ISTA resnica kot KPI + sklep (WYSIWYG).
  const handleZapisniListPdf = async () => {
    if (zapisniVteku) return
    if (!selectedProject) {
      toast.error('Ni izbranega projekta', {
        description: 'Terenski zapisni list je projekt-obračunski — najprej izberite projekt.',
      })
      return
    }
    setZapisniVteku(true)
    try {
      const vnosi = await fetchMeritveTerenVnosi(selectedProject, { zKotom: true })
'''

NOV_CSV = '''  // R285 — TERENSKI ZAPISNI LIST CSV (issue #15 §3, worklog i5b): FRESH
  // fetch + fail-verbose DTO pruning od R349 FAZA 6 EN VIR
  // fetchMeritveTerenVnosi — ISTI modul kot R284/R269
  // (prej namerna duplikacija — izolacija družine; stale telesi R284 ≡
  // R285 bajtno identična → zdaj 1 gradnik v ./measurements/teren-vnosi).
  // CSV = DIGITALNO izpolnjevanje v Excelu (Y1): ista zapisana resnica +
  // PRAZNI fizični stolpci (fizicna_ref_mm / delta_mm / zapiski_terena) —
  // izpolni jih lastnik v Excelu. PRAZEN seznam → iskren toast (nič praznih
  // datotek); pariteta stolpcev z R186 arhivom po konstrukciji (Y2 — EN VIR
  // meritevVrstica).
  const handleZapisniListCsv = async () => {
    if (zapisniCsvVteku) return
    if (!selectedProject) {
      toast.error('Ni izbranega projekta', {
        description: 'Terenski zapisni list (CSV) je projekt-obračunski — najprej izberite projekt.',
      })
      return
    }
    setZapisniCsvVteku(true)
    try {
      const vnosi = await fetchMeritveTerenVnosi(selectedProject, { zKotom: true })
'''

zamenjaj_handler('// R284 — TERENSKI ZAPISNI LIST PDF', NOV_PDF, OBDELANE)
zamenjaj_handler('// R285 — TERENSKI ZAPISNI LIST CSV', NOV_CSV, OBDELANE)

open(PATH, 'w', encoding='utf-8').write('\n'.join(lines))
print('OK: 2 handlerja zamenjana (R284 + R285) — EN VIR žičenje')
