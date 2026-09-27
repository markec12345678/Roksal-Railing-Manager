#!/usr/bin/env python3
"""R220 — surgery for inventory-tab.tsx hint effect (Edit tool matching flaky)."""
import sys

PATH = "/home/z/my-project/src/components/roksal/inventory-tab.tsx"

with open(PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Locate anchor: the line with 'const hintFilterNonce'
anchor = None
for i, ln in enumerate(lines):
    if ln.rstrip("\n") == "  const hintFilterNonce = filterHint?.n ?? 0":
        anchor = i
        break
if anchor is None:
    sys.exit("ANCHOR NOT FOUND: hintFilterNonce line")

# Expect: anchor+1 = '  useEffect(() => {', anchor+2 = old if-line, anchor+3 = deps line
if "useEffect(() => {" not in lines[anchor + 1]:
    sys.exit(f"UNEXPECTED at anchor+1: {lines[anchor + 1]!r}")
if "setPodMinOnly(true)" not in lines[anchor + 2]:
    sys.exit(f"UNEXPECTED at anchor+2: {lines[anchor + 2]!r}")
if "hintFilterNonce]" not in lines[anchor + 3]:
    sys.exit(f"UNEXPECTED at anchor+3: {lines[anchor + 3]!r}")

new_block = [
    "  useEffect(() => {\n",
    "    if (hintFilter === 'na-minimumu') {\n",
    "      setNaMinOnly(true)\n",
    "      setPodMinOnly(false) // medsebojna izključnost — NE počistitev namiga\n",
    "    } else if (hintFilter) {\n",
    "      setPodMinOnly(true)\n",
    "      setNaMinOnly(false)\n",
    "    }\n",
    "  }, [hintFilter, hintFilterNonce])\n",
]

# Idempotence guard: already applied?
if any("na-minimumu') {" in ln for ln in lines[anchor : anchor + 12]):
    print("ALREADY APPLIED — no change")
    sys.exit(0)

lines[anchor + 1 : anchor + 4] = new_block

# Insert R220 doc comment before 'const hintFilter' line (anchor line - 1 is
# '  const hintFilter = filterHint?.filter ?? null'; R220 comment goes right
# after the R219 comment block, i.e. before hintFilter line).
hint_filter_idx = None
for i, ln in enumerate(lines):
    if ln.rstrip("\n") == "  const hintFilter = filterHint?.filter ?? null":
        hint_filter_idx = i
        break
if hint_filter_idx is None:
    sys.exit("hintFilter line not found")

r220_comment = [
    "  // R220 — namig 'na-minimumu' prižge drugi čip in ugasne 'pod' (medsebojna\n",
    "  // izključnost — deep-link iz palete obljubi TOČNO ta pogled, zato ta veja\n",
    "  // namerno vsebuje izklop sorojenega čipa; to NI počistitev namiga —\n",
    "  // počistitev (null) še VEDNO ne ugasne ničesar).\n",
]
if lines[hint_filter_idx - 1].lstrip().startswith("// R220 —"):
    print("comment already present")
else:
    lines[hint_filter_idx:hint_filter_idx] = r220_comment

with open(PATH, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("OK — hint effect replaced + R220 comment inserted")
