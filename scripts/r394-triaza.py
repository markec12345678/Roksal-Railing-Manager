#!/usr/bin/env python3
"""r394-triaza.py — val 70 TRIAŽA: outline mešanica (element-točna, kanon
LEKCIJA R388 (1): className span parser, NE vrstični census).

Disk vprašanja (R392 handover kandidat 1):
  A) koliko elementov nosi focus-visible:outline-none (roksal render plast)?
  B) koliko nosi outline-hidden (TW v4 ui-kit plast)?
  C) koliko elementov nosi OBOJE (mešanica na ENEM elementu)?
  D) ⭐ JEDRO: ali obstaja element z outline-none BREZ focus-visible:ring-*
     (focus indikator odstranjen BREZ nadomestila = WCAG 2.4.7 vrzel)?
  E) kje ŽIVI outline-hidden (ui-kit baze vs roksal)?

Izhod: JSON statistika + element-first seznam kršitev D (če obstajajo).
"""
import json
import re
import sys
from pathlib import Path

REPO = Path("/home/z/my-project")
KORENI = {
    "roksal": REPO / "src/components/roksal",
    "ui": REPO / "src/components/ui",
    "app": REPO / "src/app",
    "viz": REPO / "src/components/viz",
}

# className span parser (kanon R388/R390/R391 triaža): najdi className="…"
# spane (ali className={cn("…")} / className={clsx("…")}), ne vrstic.
RE_CLASS_SPAN = re.compile(r'className=(?:"([^"]*)"|\{(?:cn|clsx)?\(?)"', re.A)


def class_spans(text: str):
    """Vrni seznam className vsebin (string literali znotraj className=…)."""
    spans = []
    for m in re.finditer(r'className=\{?', text):
        start = m.end()
        # preskoči na prvi narekovaj
        while start < len(text) and text[start] not in '"\'`':
            if text[start] == '\n':
                break
            start += 1
        if start >= len(text) or text[start] == '\n':
            continue
        q = text[start]
        end = text.find(q, start + 1)
        if end == -1:
            continue
        spans.append(text[start + 1:end])
    return spans


def scan(koren: Path):
    stat = {
        "outline_none": 0,        # focus-visible:outline-none
        "outline_none_goli": 0,   # goli outline-none (brez focus-visible:)
        "outline_hidden": 0,      # outline-hidden (TW v4)
        "goli_hidden": 0,         # goli outline-hidden
        "oboje": 0,               # na istem elementu (isti className span)
        "none_brez_ring": [],     # ⭐ WCAG 2.4.7 kandidati (focus-visible + goli)
        "hidden_v_roksal": 0,     # outline-hidden ZUNAJ ui plast (neskladje)
        "datoteke": 0,
    }
    for f in sorted(koren.rglob("*.tsx")):
        text = f.read_text(encoding="utf-8", errors="replace")
        stat["datoteke"] += 1
        for span in class_spans(text):
            toks = set(span.split())
            fv_none = "focus-visible:outline-none" in toks
            goli_none = "outline-none" in toks
            fv_hidden = "focus-visible:outline-hidden" in toks
            goli_hidden = "outline-hidden" in toks
            if fv_none:
                stat["outline_none"] += 1
            if goli_none:
                stat["outline_none_goli"] += 1
            if fv_hidden or goli_hidden:
                stat["outline_hidden"] += 1
                if koren.name != "ui":
                    stat["hidden_v_roksal"] += 1
            if (fv_none or goli_none) and (fv_hidden or goli_hidden):
                stat["oboje"] += 1
            # ⭐ D: outline-none BREZ nadomestnega indikatorja na ISTEM
            # elementu. Nadomestilo = ring/border v KATEREMKOLI focus
            # paradigmi (focus-visible: tipkovnica, focus: vnosna polja,
            # focus-within: roditeljska) ali outline-hidden/outline.
            if fv_none or goli_none:
                ring = any(
                    t.startswith(p)
                    for t in toks
                    for p in ("focus-visible:ring", "focus:ring", "focus-within:ring")
                )
                border = any(
                    t.startswith(p)
                    for t in toks
                    for p in ("focus-visible:border", "focus:border", "focus-within:border")
                )
                out_alt = any(
                    t in toks
                    for t in (
                        "focus-visible:outline-hidden", "focus-visible:outline",
                        "outline-hidden", "outline",
                    )
                )
                if not (ring or border or out_alt):
                    stat["none_brez_ring"].append(
                        {"datoteka": str(f.relative_to(REPO)), "span": span[:160]}
                    )
    return stat


def main():
    rez = {ime: scan(koren) for ime, koren in KORENI.items()}
    sk = {
        "outline_none": sum(r["outline_none"] for r in rez.values()),
        "outline_hidden": sum(r["outline_hidden"] for r in rez.values()),
        "oboje": sum(r["oboje"] for r in rez.values()),
        "none_brez_ring_skupaj": sum(len(r["none_brez_ring"]) for r in rez.values()),
        "hidden_v_roksal": sum(r["hidden_v_roksal"] for r in rez.values()),
    }
    print(json.dumps({"skupaj": sk, "plasti": rez}, ensure_ascii=False, indent=1))
    # kršitve D = REALNA družina (a11y vrzel) — izpiši element-first
    kr = [k for r in rez.values() for k in r["none_brez_ring"]]
    if kr:
        print("KRŠITVE D (outline-none brez nadomestila):", file=sys.stderr)
        for k in kr[:20]:
            print(f"  {k['datoteka']}: {k['span']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
