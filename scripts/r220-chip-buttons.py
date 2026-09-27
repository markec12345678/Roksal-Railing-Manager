#!/usr/bin/env python3
"""R220 — chip buttons: pod chip mutual exclusivity + new 'na minimumu' chip."""
import sys

PATH = "/home/z/my-project/src/components/roksal/inventory-tab.tsx"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

# --- 1. pod chip onClick: add sibling-off (medsebojna izključnost) ----------
old_click = "            onClick={() => setPodMinOnly((v) => !v)}"
new_click = (
    "            onClick={() => { setPodMinOnly((v) => !v); setNaMinOnly(false) }}\n"
    "            /* R220 — medsebojna izključnost: prižig 'pod' ugasne sorojeni\n"
    "               'na' čip (in obratno spodaj) — vsak čipov iskren števec pove\n"
    "               TOČNO koliko vrstic prikaže; nobena kombinacija ne zmede. */"
)
if new_click.split("\n")[0] in src and "medsebojna izključnost: prižig" in src:
    print("pod onClick already updated")
elif old_click not in src:
    sys.exit("pod onClick anchor NOT FOUND")
else:
    src = src.replace(old_click, new_click, 1)
    print("pod onClick updated")

# --- 2. insert na chip right after the pod chip closing </button> ----------
# Anchor: the pod chip's count span + closing button tag.
anchor = (
    "            Pod minimumom\n"
    "            {podMinOnly && (\n"
    "              <span className=\"ml-1 tabular-nums font-semibold\">{podMinCount}</span>\n"
    "            )}\n"
    "          </button>"
)
if "Na minimumu\n" in src and "naMinOnly && (" in src:
    print("na chip already present")
elif anchor not in src:
    sys.exit("pod chip anchor NOT FOUND")
else:
    na_chip = anchor + "\n" + """          {/* R220 — čip 'na minimumu' (===): ožji sorojeni pogled ISTEGA
              vprašanja nizke zaloge (=== je podmnožica <= — artikli TOČNO na
              tleh; naslednja poraba jih spusti pod). MEDSEBOJNO IZKLJUČEN s
              čipom 'pod' (klik poniža sorojenega — vsak čipov iskren števec
              pove TOČNO koliko vrstic prikaže; deep-link iz palete obljubi
              TOČNO ta pogled). ISTA roksal-red družina (artikli na minimumu
              SO del pod-minimum množice — ista semantika; razliko nosita
              dobeseden tekst + števec, ne drugačna barva — R219 pravilo).
              Tudi ta čip spreminja VSE porabnike 'vidnih artiklov'
              (CSV / Naročilnica / Osnutek / seznam) — WYSIWYG. */}
          <button
            type="button"
            onClick={() => { setNaMinOnly((v) => !v); setPodMinOnly(false) }}
            aria-pressed={naMinOnly}
            aria-label={
              naMinOnly
                ? `Pokaži samo artikle na minimalni zalogi — aktiven (${naMinCount}); klik za izklop`
                : 'Pokaži samo artikle na minimalni zalogi'
            }
            title="Pokaži samo artikle, katerih zaloga je točno na minimumu"
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 ${
              naMinOnly
                ? 'border-roksal-red/30 bg-roksal-red/10 text-roksal-red'
                : 'border-transparent bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            Na minimumu
            {naMinOnly && (
              <span className="ml-1 tabular-nums font-semibold">{naMinCount}</span>
            )}
          </button>"""
    src = src.replace(anchor, na_chip, 1)
    print("na chip inserted")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(src)
print("OK")
