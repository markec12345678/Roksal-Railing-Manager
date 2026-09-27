#!/usr/bin/env python3
"""R203 fail-open inventory: najdi `if (res.ok)` bloke BREZ `} else` veje."""
import re, sys, pathlib

ROOT = pathlib.Path('/home/z/my-project/src')
results = []
for p in sorted(ROOT.rglob('*.ts*')):
    if '__tests__' in str(p) or '.test.' in p.name:
        continue
    lines = p.read_text(encoding='utf-8').splitlines()
    for i, line in enumerate(lines):
        if re.search(r'if \(res\.ok\)', line):
            # grab the block: from this line forward, track brace depth
            depth = 0
            started = False
            has_else = False
            block_lines = []
            for j in range(i, min(i + 60, len(lines))):
                l = lines[j]
                block_lines.append(l)
                depth += l.count('{') - l.count('}')
                if '{' in l:
                    started = True
                if started and re.match(r'^\s*\}\s*else\b', l):
                    has_else = True
                    break
                if started and depth <= 0:
                    break
            if not has_else:
                # false-positive guard: `else` might use different formatting
                joined = '\n'.join(block_lines)
                if 'else' not in joined:
                    results.append((str(p), i + 1, lines[i].strip()[:80]))

print(f"Najdenih fail-open kandidatov: {len(results)}")
for f, ln, src in results:
    print(f"  {f}:{ln}  {src}")
