#!/usr/bin/env python3
# R309 migracijski val: 26 throw-style json() route-handlerjev → EN VIR
# 400-guard (src/lib/api-telo.ts, vzorec calculator R308).
# FAIL-CLOSED: vsaka pričakovana zamenjava je izrecno šteta; odstopanje =
# abort brez zapisa. /api/sync IZRECNO IZVZET (kontrakt NIČ).
import pathlib
import re
import sys

KOREN = pathlib.Path('/home/z/my-project')
IMPORT = "import { preberiJsonTelo } from '@/lib/api-telo'"

GUARD_A = (
    "{i}const telo = await preberiJsonTelo(request)\n"
    "{i}if (!telo.ok) return telo.odgovor\n"
    "{i}const body = telo.telo"
)

# (relativna pot, [shape-i]) — shape: (ime, staro_besedilo, novo_besedilo)
SPECIALNI = {
    'deal-lock': [(
        '    const body = (await request.json()) as DealLockRequest',
        '    const telo = await preberiJsonTelo(request)\n'
        '    if (!telo.ok) return telo.odgovor\n'
        '    const body = telo.telo as DealLockRequest',
    )],
    'slopes': [(
        '    const body = (await request.json()) as { projectId?: unknown; kotStopinje?: unknown; smer?: unknown; lokacija?: unknown }',
        '    const telo = await preberiJsonTelo(request)\n'
        '    if (!telo.ok) return telo.odgovor\n'
        '    const body = telo.telo as { projectId?: unknown; kotStopinje?: unknown; smer?: unknown; lokacija?: unknown }',
    )],
    'portal': [(
        '    const body = await request.json() as {',
        '    const telo = await preberiJsonTelo(request)\n'
        '    if (!telo.ok) return telo.odgovor\n'
        '    const body = telo.telo as {',
    )],
    'measurement/confirm': [(
        '  let body: unknown\n'
        '  try {\n'
        '    body = await request.json()\n'
        '  } catch {\n'
        "    return NextResponse.json({ error: 'Neveljaven JSON.' }, { status: 400 })\n"
        '  }',
        '  const telo = await preberiJsonTelo(request)\n'
        '  if (!telo.ok) return telo.odgovor\n'
        '  const body = telo.telo',
    )],
    'vision/placement': [(
        '  let json: unknown\n'
        '  try {\n'
        '    json = await request.json()\n'
        '  } catch {\n'
        "    return NextResponse.json({ error: 'Neveljaven JSON.', code: 'INVALID_JSON' }, { status: 400 })\n"
        '  }',
        '  const telo = await preberiJsonTelo(request)\n'
        '  if (!telo.ok) return telo.odgovor\n'
        '  const json = telo.telo',
    )],
    'notifications/read': [(
        '    const parsed = readSchema.safeParse(await request.json())',
        '    const telo = await preberiJsonTelo(request)\n'
        '    if (!telo.ok) return telo.odgovor\n'
        '    const parsed = readSchema.safeParse(telo.telo)',
    )],
}

DATOTEKE = [
    'ar-snapshots', 'bom-draft', 'bom-refine', 'crews', 'customers', 'deal-lock',
    'documents', 'gallery', 'inventory', 'invoices', 'material-orders',
    'material-prices', 'measurement/confirm', 'measurements', 'notifications/read',
    'photos', 'portal', 'profili', 'projects', 'punch', 'schedules', 'sketches',
    'slopes', 'suppliers', 'surveys', 'vision/placement',
]

def main() -> int:
    skupaj_mest = 0
    porocila = []
    for ime in DATOTEKE:
        pot = KOREN / 'src/app/api' / ime / 'route.ts'
        vir = pot.read_text()
        pred = vir
        if ime in SPECIALNI:
            for staro, novo in SPECIALNI[ime]:
                if vir.count(staro) != 1:
                    print(f'FAIL-CLOSED {ime}: specialni vzorec najden {vir.count(staro)}× (pričakovano 1): {staro[:70]!r}')
                    return 1
                vir = vir.replace(staro, novo)
        # Shape A — vse preostale standardne mete
        vrste = vir.splitlines(keepends=True)
        izhod = []
        stevec = 0
        vzorec = re.compile(r'^([ \t]*)const body = await request\.json\(\)[ \t]*$')
        for vrsta in vrste:
            m = vzorec.match(vrsta.rstrip('\n'))
            if m:
                izhod.append(GUARD_A.format(i=m.group(1)) + '\n')
                stevec += 1
            else:
                izhod.append(vrsta)
        vir = ''.join(izhod)
        # Uvoz — za ZADNJO import vrstico
        if "@/lib/api-telo" not in vir:
            importni = [i for i, l in enumerate(vir.splitlines()) if l.startswith('import ')]
            if not importni:
                print(f'FAIL-CLOSED {ime}: ni import vrstic')
                return 1
            vrste = vir.splitlines(keepends=True)
            vrste.insert(importni[-1] + 1, IMPORT + '\n')
            vir = ''.join(vrste)
        # Zaključne trditve — nič surovega json() klica ostane
        ostanek = re.search(r'await\s+(?:request|req)\.json\(\)', vir)
        if ostanek:
            print(f'FAIL-CLOSED {ime}: surov await request.json() ŠE VEDNO prisoten')
            return 1
        if IMPORT not in vir:
            print(f'FAIL-CLOSED {ime}: uvoz manjka')
            return 1
        if vir == pred:
            print(f'FAIL-CLOSED {ime}: nič se ni spremenilo')
            return 1
        mesta = stevec + len(SPECIALNI.get(ime, []))
        skupaj_mest += mesta
        porocila.append(f'OK {ime}: {mesta} mest')
        pot.write_text(vir)
    for p in porocila:
        print(p)
    print(f'SKUPAJ: {skupaj_mest} klicnih mest prekinjeno na EN VIR guard (pričakovano 32)')
    if skupaj_mest != 32:
        print('FAIL-CLOSED: število mest ≠ 32')
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
