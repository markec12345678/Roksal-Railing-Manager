#!/usr/bin/env python3
# R192 — revizijski dnevnik poenotitev: pretvori VSE inline auditLog.create
# klice (13 rut + src/lib/measure.ts) v helperje iz src/lib/audit.ts.
# Vzorec R191 r191-wire-writes.py: brace matching + glasne asercije (nič tigaj).
import re
import sys
from pathlib import Path

ROOT = Path('/home/z/my-project')
changes = []  # (file, description)

def find_matching_brace(src: str, open_idx: int) -> int:
    """Vrni indeks zaklepajočega { } za open_idx (ki kaže na '{').
    Nizi ('...', "...", `...`) so NEPROSOJNI — ${...} znotraj template
    literala se preskoči skupaj z ostalim (vsebujejo uravnotežene izraze)."""
    depth = 0
    in_str = None
    i = open_idx
    while i < len(src):
        c = src[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == in_str:
                in_str = None
        else:
            if c in ("'", '"', '`'):
                in_str = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    raise ValueError('neporaženi oklepaj')

def convert_call(src: str, await_idx: int, helper: str, recv_arg: str) -> tuple[str, int]:
    """Pretvori `await <recv>.auditLog.create({ data: { INNER }, })` v
    `await <helper>(<recv_arg>, { INNER })` (INNER dedentiran)."""
    call_paren = src.index('(', await_idx)
    arg_open = src.index('{', call_paren)
    # pričakujemo 'data:' takoj za { (do drugega { — oklepaji so lahko globoko)
    dm = re.search(r'data:\s*\{', src[arg_open:find_matching_brace(src, arg_open)])
    if not dm:
        raise ValueError(f'pričakovano data: ... pri offsetu {arg_open}')
    data_open = arg_open + dm.start() + dm.group(0).index('{')
    data_close = find_matching_brace(src, data_open)
    call_close_paren = src.index(')', data_close)

    await_line_start = src.rfind('\n', 0, await_idx) + 1
    indent_await = len(src[await_line_start:await_idx]) - len(src[await_line_start:await_idx].lstrip())
    await_indent_str = src[await_line_start:await_line_start + indent_await]

    # notranjost data objekta (brez oklepajev)
    inner = src[data_open + 1:data_close]
    lines = inner.split('\n')
    # določi shift iz prve poljne vrstice
    shift = None
    for ln in lines:
        if ln.strip():
            indent = len(ln) - len(ln.lstrip(' '))
            shift = indent - (indent_await + 2)
            break
    if shift is None or shift < 0:
        shift = 0
    dedented = []
    for ln in lines:
        if ln.strip() == '':
            dedented.append('')
        else:
            cur = len(ln) - len(ln.lstrip(' '))
            take = max(cur - shift, 0)
            dedented.append(' ' * take + ln.lstrip(' '))
    inner_new = '\n'.join(dedented)
    # prva vrstica: { INNER... ; zadnja: } — sestavi nov klic (db = EN argument,
    # tx = (tx, input); zaklep na indentu awaita)
    if recv_arg:
        new_call = f'await {helper}({recv_arg}, {{{inner_new}{await_indent_str}}})'
    else:
        new_call = f'await {helper}({{{inner_new}{await_indent_str}}})'
    return src[:await_idx] + new_call + src[call_close_paren + 1:], 1

def convert_file(path: str, spec: list[dict]) -> None:
    """spec: seznam {recv: 'tx'|'db', helper: 'auditInTx'|'audit'|'auditStrict', count: n, field_renames: {old:new}}"""
    p = ROOT / path
    src = p.read_text()
    for item in spec:
        recv, helper, expected = item['recv'], item['helper'], item['count']
        renames = item.get('renames', {})
        marker = f'await {recv}.auditLog.create('
        n = 0
        while marker in src:
            await_idx = src.index(marker)
            src, _ = convert_call(src, await_idx, helper, 'tx' if recv == 'tx' else '')
            n += 1
        assert n == expected, f'{path}: pričakovano {expected} {marker}, dobljeno {n}'
        if renames:
            for old, new in renames.items():
                cnt = src.count(old)
                assert cnt == expected, f'{path}: rename {old}: pričakovano {expected}, dobljeno {cnt}'
                src = src.replace(old, new)
        changes.append((path, f'{recv}.auditLog.create ×{n} → {helper}()'))

    # import iz '@/lib/audit'
    if "from '@/lib/audit'" in src:
        # razširi obstoječi import z manjkajočimi helperji
        need = set()
        for item in spec:
            h = item['helper']
            if h not in src.split("from '@/lib/audit'")[0]:
                need.add(h)
        if need:
            m = re.search(r"import \{([^}]*)\} from '@/lib/audit'", src)
            names = [x.strip() for x in m.group(1).split(',') if x.strip()]
            names = sorted(set(names) | need)
            src = src[:m.start()] + f"import {{ {', '.join(names)} }} from '@/lib/audit'" + src[m.end():]
            changes.append((path, f"import razširjen: {', '.join(sorted(need))}"))
    else:
        helpers = sorted({item['helper'] for item in spec})
        imp = f"import {{ {', '.join(helpers)} }} from '@/lib/audit'\n"
        # vstavi ZA zadnjim obstoječim importom znotraj zgornjega bloka
        last_imp_end = None
        for m in re.finditer(r"^import .*?\n", src, re.M):
            last_imp_end = m.end()
        assert last_imp_end, f'{path}: ni importov'
        src = src[:last_imp_end] + imp + src[last_imp_end:]
        changes.append((path, f"import dodan: {', '.join(helpers)}"))

    p.write_text(src)

# --- Mehaniške tx pretvorbe (15 mest) --------------------------------------
convert_file('src/app/api/schedules/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 3},
])
convert_file('src/app/api/measurements/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 1},
])
convert_file('src/app/api/measurements/[id]/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 1},
])
convert_file('src/app/api/projects/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 2},
])
convert_file('src/app/api/equipment/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 1},
])
convert_file('src/app/api/equipment/events/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 1},
])
convert_file('src/app/api/qc/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 1},
])
convert_file('src/app/api/customers/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 1},
])
convert_file('src/app/api/evidence/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 2},
])
convert_file('src/app/api/portal/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 1},
])

# --- setup: 2 tx (hash-IP overrides) + 1 db deny (auditStrict, ista semantika)
convert_file('src/app/api/setup/route.ts', [
    {'recv': 'tx', 'helper': 'auditInTx', 'count': 2},
    {'recv': 'db', 'helper': 'auditStrict', 'count': 1},
])
# setup: preimena ip/ua polj — VSI trije vpisi (2 tx + deny), isto štetje
p = ROOT / 'src/app/api/setup/route.ts'
s = p.read_text()
cnt = s.count('ipAddress: ipHash,')
assert cnt == 3, f'setup: pričakovano 3 ipAddress polj, dobljeno {cnt}'
s = s.replace('ipAddress: ipHash,', 'ipOverride: ipHash,')
cnt = s.count('userAgent: userAgent?.slice(0, 255) ?? null,')
assert cnt == 3, f'setup: pričakovano 3 userAgent polj, dobljeno {cnt}'
s = s.replace('userAgent: userAgent?.slice(0, 255) ?? null,', 'uaOverride: userAgent?.slice(0, 255) ?? null,')
p.write_text(s)
changes.append(('src/app/api/setup/route.ts', 'ipAddress/userAgent → ipOverride/uaOverride ×3'))

# --- crm: db (best-effort; prej fail-verbose PO uspešnem updateu — izboljšava)
convert_file('src/app/api/crm/route.ts', [
    {'recv': 'db', 'helper': 'audit', 'count': 1},
])

# --- bom-draft: db + FK BUG FIX ('system' → null, schema S+9) ---------------
convert_file('src/app/api/bom-draft/route.ts', [
    {'recv': 'db', 'helper': 'audit', 'count': 1},
])
p = ROOT / 'src/app/api/bom-draft/route.ts'
s = p.read_text()
old = "userId: 'system',"
assert s.count(old) == 1, "bom-draft: 'system' ni najden"
s = s.replace(old, "userId: null, // R192 FIX: 'system' NI obstajal v Profile (FK constraint, issue #4 §13) — null = sistemski dogodek (schema S+9)")
p.write_text(s)
changes.append(('src/app/api/bom-draft/route.ts', "FK FIX: userId 'system' → null"))

# --- measure.ts: auditStrict (fail-verbose semantika OHRANJENA) -------------
convert_file('src/lib/measure.ts', [
    {'recv': 'db', 'helper': 'auditStrict', 'count': 1,
     'renames': {'ipAddress: entry.ipHash,': 'ipOverride: entry.ipHash,'}},
])
p = ROOT / 'src/lib/measure.ts'
s = p.read_text()
old = 'userAgent: entry.userAgent?.slice(0, 255) ?? null,'
assert s.count(old) == 1, 'measure.ts: userAgent polje ni najdeno'
s = s.replace(old, 'uaOverride: entry.userAgent?.slice(0, 255) ?? null,')
p.write_text(s)
changes.append(('src/lib/measure.ts', 'userAgent → uaOverride'))

# --- Poročilo ---------------------------------------------------------------
print('=== R192 poenotitev opravljena ===')
for f, d in changes:
    print(f'  {f}: {d}')

# Zaključna preverba: auditLog.create je ŠELE v src/lib/audit.ts
offenders = []
for f in list(ROOT.glob('src/**/*.ts')) + list(ROOT.glob('src/**/*.tsx')):
    fs = str(f)
    if '__tests__' in fs or fs.endswith('src/lib/audit.ts'):
        continue
    if fs.endswith('r192-unify-audit.py'):
        continue
    try:
        if 'auditLog.create' in f.read_text():
            offenders.append(fs)
    except Exception:
        pass
if offenders:
    print('❌ OSTALI inline klici:')
    for o in offenders:
        print('  ', o)
    sys.exit(1)
print('✅ Guard: auditLog.create zdaj SAMO v src/lib/audit.ts')
