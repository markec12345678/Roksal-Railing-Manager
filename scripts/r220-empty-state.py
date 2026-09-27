#!/usr/bin/env python3
"""R220 — honest empty-state per active chip in inventory-tab.tsx."""
import sys

PATH = "/home/z/my-project/src/components/roksal/inventory-tab.tsx"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

old = """          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ni artiklov za ta filter
            </p>
          )}"""

new = """          ) : podMinOnly ? (
            {/* R220 — iskreno prazno stanje PER čip: pove, KATERI filter je
                prazen (ne generično 'za ta filter' — uporabnik ve, da je
                prazno stanje rezultat čipa, ne manjkajočih podatkov). */}
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ni artiklov pod minimalno zalogo v izbranem tipu
            </p>
          ) : naMinOnly ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ni artiklov točno na minimalni zalogi v izbranem tipu
            </p>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ni artiklov za ta filter
            </p>
          )}"""

if "Ni artiklov pod minimalno zalogo v izbranem tipu" in src:
    print("already applied")
elif old not in src:
    sys.exit("empty-state anchor NOT FOUND")
else:
    src = src.replace(old, new, 1)
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(src)
    print("OK — empty state updated")
