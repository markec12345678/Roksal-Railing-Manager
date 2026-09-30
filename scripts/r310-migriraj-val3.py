#!/usr/bin/env python3
# R310 — 3. val unifikacije I/O meje: 22 handlerjev s .catch(() => null)
# → EN VIR preberiJsonTelo (vzorec R309; R308 calculator izviren).
# IZVEZNO IZVZETI (s komentarjem v testu, ne tiho):
#   /api/sync             — kontrakt NIČ (R309)
#   /api/auth/logout      — zahtevana toleranca (best-effort odjava —
#                           pokvarjen telo NE sme preprečiti odjave)
#   /api/vision/scene     — bespoke 413 size-guard PRED parse (feature)
#   /api/measurement/detect — bespoke 413 size-guard PRED parse (feature)
# Vsak zamenjava je NATANKO ena-na-datoteko (fail-closed: manjkajoča
# točna vrstica → izpisek + exit 1, brez tihe no-op).
import re
import sys
from pathlib import Path

API = Path('/home/z/my-project/src/app/api')
IMPORT = "import { preberiJsonTelo } from '@/lib/api-telo'"

# ── razred Z (zod): telo → preberiJsonTelo, safeParse na telo.telo ──
ZOD = {
    'auth': 'loginSchema',
    'auth/email': 'schema',
    'auth/password': 'schema',
    'auth/register': 'registerSchema',
    'quote': 'quoteSchema',
    'railing-layout': 'railingLayoutSchema',
    'setup': 'schema',
    'users': 'actionsSchema',
    'users/activate': 'activateSchema',
    'measure/photo': 'bodySchema',
    'ar/analyze': 'bodySchema',
    'viz/preview': 'previewSchema',
    'viz/product-preview': 'productPreviewSchema',
    'viz/projects': 'createProjectSchema',
    'viz/projects/[id]': 'renameSchema',
    'viz/render': 'renderSchema',
}

# ── razred M (ročna object/null preverba) — točne zamenjave ──
TOCNE = {
    # measurements/[id] PATCH — 'Manjka telo zahtevka' → EN VIR (isti 400)
    'measurements/[id]': [
        (
            "    const body = await request.json().catch(() => null)\n"
            "    if (body === null || typeof body !== 'object') {\n"
            "      return NextResponse.json({ error: 'Manjka telo zahtevka' }, { status: 400 })\n"
            "    }\n",
            "    const telo = await preberiJsonTelo(request)\n"
            "    if (!telo.ok) return telo.odgovor\n"
            "    const body = telo.telo\n",
        ),
    ],
    # equipment POST — !body mrtvo (telo jamči objekt)
    'equipment': [
        (
            "    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null\n"
            "    const id = typeof body?.id === 'string' ? body.id : null\n"
            "    if (!id || !body) {\n",
            "    const telo = await preberiJsonTelo(request)\n"
            "    if (!telo.ok) return telo.odgovor\n"
            "    const body = telo.telo\n"
            "    const id = typeof body?.id === 'string' ? body.id : null\n"
            "    if (!id) {\n",
        ),
    ],
    # crm POST — ista oblika kot equipment
    'crm': [
        (
            "    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null\n"
            "    const id = typeof body?.id === 'string' ? body.id : null\n"
            "    if (!body || !id) {\n",
            "    const telo = await preberiJsonTelo(request)\n"
            "    if (!telo.ok) return telo.odgovor\n"
            "    const body = telo.telo\n"
            "    const id = typeof body?.id === 'string' ? body.id : null\n"
            "    if (!id) {\n",
        ),
    ],
    # evidence PATCH — enovrstična oblika
    'evidence#patch': [
        (
            "    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null\n"
            "    const id = typeof body?.id === 'string' ? body.id : null\n"
            "    if (!id || !body) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })\n",
            "    const telo = await preberiJsonTelo(request)\n"
            "    if (!telo.ok) return telo.odgovor\n"
            "    const body = telo.telo\n"
            "    const id = typeof body?.id === 'string' ? body.id : null\n"
            "    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })\n",
        ),
    ],
}

# ── razred E (derivacija projectId/scheduleId) — telo najprej, mrtva
#    'Manjka telo zahteve' vrstica odstranjena ──
E_PREJ = (
    "    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null\n"
)
E_PO = (
    "    const telo = await preberiJsonTelo(request)\n"
    "    if (!telo.ok) return telo.odgovor\n"
    "    const body = telo.telo\n"
)
E_MRTVO = [
    'evidence#post',
]
E_MRTVA_VRSTICA = "    if (!body) return NextResponse.json({ error: 'Manjka telo zahteve' }, { status: 400 })\n"

# qc: `if (!body || !('items' in body))` → `if (!('items' in body))`
QC_ITEMS_PREJ = "    if (!body || !('items' in body)) {\n"
QC_ITEMS_PO = "    if (!('items' in body)) {\n"


def vstavi_uvoz(vir: str, pot: str) -> str:
    if IMPORT in vir:
        return vir
    vrstice = vir.split('\n')
    zadnja = -1
    for i, v in enumerate(vrstice):
        # konec uvoznega bloka: vrstica, ki se konča z from '...' (eno-vrstični
        # import ALI zapiralna oklepaja več-vrstičnega — R309 lekcija 5: NIKOLI
        # za vrstico `import {`).
        if re.match(r"^import\s+.*from\s+['\"]", v) or re.match(r"^} from\s+['\"]", v):
            zadnja = i
    if zadnja < 0:
        print(f'FAIL-CLOSED: {pot}: uvoznega bloka ni mogoče najti')
        sys.exit(1)
    vrstice.insert(zadnja + 1, IMPORT)
    return '\n'.join(vrstice)


def pot_za(ime: str) -> Path:
    # 'evidence#patch' → src/app/api/evidence/route.ts (oznaka mesta, ne mapa)
    dir_ime = ime.split('#')[0]
    return API / dir_ime / 'route.ts'


def migriraj(ime: str, zamenjave: list[tuple[str, str]]) -> None:
    pot = pot_za(ime)
    vir = pot.read_text()
    if 'preberiJsonTelo' in vir:
        print(f'PRESKOČEN (že migriran): {ime}')
        return
    for prej, po in zamenjave:
        if vir.count(prej) != 1:
            print(f'FAIL-CLOSED: {ime}: točna zamenjava najdena {vir.count(prej)}× (pričakovano 1):\n{prej}')
            sys.exit(1)
        vir = vir.replace(prej, po)
    vir = vstavi_uvoz(vir, ime)
    pot.write_text(vir)
    print(f'MIGRIRAN: {ime}')


# 1) razred Z (zod)
for ime, shema in ZOD.items():
    pot = API / ime / 'route.ts'
    vir = pot.read_text()
    # eno-vrstična oblika znotraj try (4 presledki) ALI neposredno (2 presledki — setup)
    vzorca = []
    for zamik in ('    ', '  '):
        vzorca.append(
            (
                f"{zamik}const body = await request.json().catch(() => null)\n"
                f"{zamik}const parsed = {shema}.safeParse(body)\n",
                f"{zamik}const telo = await preberiJsonTelo(request)\n"
                f"{zamik}if (!telo.ok) return telo.odgovor\n"
                f"{zamik}const parsed = {shema}.safeParse(telo.telo)\n",
            )
        )
    if 'preberiJsonTelo' in vir:
        print(f'PRESKOČEN (že migriran): {ime}')
        continue
    zadetkov = sum(vir.count(p) for p, _ in vzorca)
    if zadetkov != 1:
        print(f'FAIL-CLOSED: {ime}: zod vzorec najden {zadetkov}× (pričakovano 1)')
        sys.exit(1)
    for prej, po in vzorca:
        vir = vir.replace(prej, po)
    vir = vstavi_uvoz(vir, ime)
    pot.write_text(vir)
    print(f'MIGRIRAN (zod): {ime}')

# 2) razred M (točne zamenjave)
for ime, zamenjave in TOCNE.items():
    migriraj(ime, zamenjave)

# 3) razred E (derivacija): evidence POST + qc + equipment/events
for ime in ('evidence#post', 'qc', 'equipment/events'):
    pot = pot_za(ime)
    vir = pot.read_text()
    if E_PREJ not in vir:
        print(f'PRESKOČEN (E mesto že preseljeno ali manjka): {ime}')
        continue
    stevci = vir.count(E_PREJ)
    if stevci != 1:
        print(f'FAIL-CLOSED: {ime}: E vzorec najden {stevci}× (pričakovano 1)')
        sys.exit(1)
    vir = vir.replace(E_PREJ, E_PO)
    if ime in E_MRTVO:
        if vir.count(E_MRTVA_VRSTICA) != 1:
            print(f'FAIL-CLOSED: {ime}: mrtva vrstica najdena {vir.count(E_MRTVA_VRSTICA)}× (pričakovano 1)')
            sys.exit(1)
        vir = vir.replace(E_MRTVA_VRSTICA, '')
    if ime == 'qc':
        if vir.count(QC_ITEMS_PREJ) != 1:
            print(f'FAIL-CLOSED: qc: items vzorec najden {vir.count(QC_ITEMS_PREJ)}× (pričakovano 1)')
            sys.exit(1)
        vir = vir.replace(QC_ITEMS_PREJ, QC_ITEMS_PO)
    vir = vstavi_uvoz(vir, ime)
    pot.write_text(vir)
    print(f'MIGRIRAN (E): {ime}')

print('VAL 3 MIGRACIJA DOKONČANA')
