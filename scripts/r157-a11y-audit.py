#!/usr/bin/env python3
"""R157 a11y audit v2: find icon-only <Button> elements without aria-label.

Approach:
- Brace/quote-aware scan of the opening tag (arrow fns contain '>').
- Visible-text detection in child content:
  * raw text nodes outside tags and braces (e.g. `Naprej <Icon/>`)
  * text inside JSX fragments inside expressions (e.g. <> Ustavi </>)
  * quoted strings anywhere (e.g. {saving ? 'Shrani' : 'Pošlji'})
  * property-access heuristics (e.g. {action.label})
"""
import os
import re

ROOTS = ['src/components', 'src/app']
results = []
false_positives = []


def find_opening_tag_end(src, start):
    i = start
    depth = 0
    n = len(src)
    while i < n:
        c = src[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        elif c in '"\'' and depth == 0:
            q = c
            i += 1
            while i < n and src[i] != q:
                if src[i] == '\\':
                    i += 1
                i += 1
        elif c == '>' and depth == 0:
            return i
        i += 1
    return -1


def has_visible_text(child):
    # Single-pass scanner: collect raw text nodes (outside tags/braces) and
    # quoted strings (inside braces, outside tags). Tag-internal strings
    # (className="...") are always skipped.
    n = len(child)
    i = 0
    depth_brace = 0
    in_fragment = False  # inside <> </> fragment within an expression
    pieces = []  # raw text + in-brace quoted strings
    while i < n:
        c = child[i]
        if c == '{':
            depth_brace += 1
            i += 1
            continue
        if c == '}':
            depth_brace -= 1
            in_fragment = False
            i += 1
            continue
        if c == '<':
            # fragment markers: <> (open) and </> (close)
            if i + 1 < n and child[i + 1] == '>' and depth_brace > 0:
                in_fragment = True
                i += 2
                continue
            if i + 2 < n and child[i + 1] == '/' and child[i + 2] == '>' and depth_brace > 0:
                in_fragment = False
                i += 3
                continue
            # skip entire tag (attributes incl. quoted strings)
            i += 1
            while i < n and child[i] != '>':
                if child[i] in '"\'':
                    q = child[i]
                    i += 1
                    while i < n and child[i] != q:
                        i += 1
                i += 1
            i += 1
            continue
        if c in '"\'`' and depth_brace > 0:
            q = c
            i += 1
            buf = []
            while i < n and child[i] != q:
                if child[i] == '\\':
                    i += 1
                    if i < n:
                        buf.append(child[i])
                        i += 1
                    continue
                buf.append(child[i])
                i += 1
            pieces.append(''.join(buf))
            i += 1
            continue
        if depth_brace == 0 or (depth_brace > 0 and in_fragment):
            pieces.append(c)
        i += 1
    text = ''.join(pieces)
    if re.search(r'[A-Za-zžščćđŽŠČĆĐ]', text):
        return True
    # 3) property access that renders text: {action.label}, {k}, {mat}
    stripped = re.sub(r'<[^<>]*>', '', child)
    for m in re.finditer(r'\{\s*([A-Za-z_$][\w.$]*)\s*\}', stripped):
        if not re.match(r'^(true|false|null|undefined)$', m.group(1)):
            return True
    return False


def audit_file(path):
    src = open(path).read()
    idx = 0
    while True:
        start = src.find('<Button', idx)
        if start == -1:
            break
        end_of_word = start + len('<Button')
        if end_of_word < len(src) and (src[end_of_word].isalnum() or src[end_of_word] == '_'):
            idx = start + 1
            continue
        tag_end = find_opening_tag_end(src, start)
        if tag_end == -1:
            idx = start + 1
            continue
        tag = src[start:tag_end + 1]
        line = src[:start].count('\n') + 1
        if ('aria-label' in tag) or ('aria-labelledby' in tag):
            idx = tag_end
            continue
        close = src.find('</Button>', tag_end)
        child = src[tag_end + 1:close] if close != -1 else ''
        if has_visible_text(child):
            false_positives.append((path, line))
        else:
            results.append((path, line, ' '.join(child.split())[:140]))
        idx = tag_end


for root in ROOTS:
    for dirpath, _, files in os.walk(root):
        for f in files:
            if f.endswith('.tsx'):
                audit_file(os.path.join(dirpath, f))

print(f"ICON-ONLY <Button> brez aria-label/aria-labelledby: {len(results)}\n")
for path, line, child in results:
    print(f"{path}:{line}\n    child: {child}")
print(f"\n(z mustganih z besedilom — NE problem: {len(false_positives)})")
