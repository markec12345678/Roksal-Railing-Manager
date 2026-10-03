#!/usr/bin/env python3
# r391-kolizija-rename.py — KOLIZIJA #25 ADOPCIJA (kanon KOLIZIJE #4/R323/
# #13–#24): vzporedna lastniška seja je pristala z NJIHOVIM R390 [3197c7b —
# PRODUKTNI KATALOG issue #13 + njihov r390.tsv ×9 + README R390 bullet +
# worklog R390 vnos] MED mojim delom → moja runda preimenovana R390→R391:
#   1. git mv mojih r390-* artefaktov → r391-* (skripte + 2 testna datoteki);
#   2. vsebinske samoreference R390→R391 (žigi, TODO, poti, bannerji);
#   3. register r391.tsv (iz moje verzije, 0-v-HEAD baza 3475792);
#   4. r363.tsv žigi + 5 EVOLVED testnih datotek;
#   5. README: moj bullet kot R391 nad njihovim R390 bulletom + števec
#      5708/377 → 5727/379 [= njihova baza + mojih +19/+2];
#   6. worklog: moj vnos kot Task ID R391, pripisan ZA njihovim R390 vnosom;
#      handover naslednik = R392 (44. era preverba r347–r390 ≥182 = 173 + 9).
# NJIHOVI artefakti (r390.tsv, r390-commit-msg.txt, README R390 bullet,
# worklog R390 vnos, katalog koda) ostanejo BAJTNATO nespremenjeni.
import pathlib
import subprocess
import sys

REPO = pathlib.Path("/home/z/my-project")

PREIMENUJ = [
    "scripts/r390-era-harvest.sh",
    "scripts/r390-era-ruta-map.py",
    "scripts/r390-qa-spot.sh",
    "scripts/r390-triaza.py",
    "scripts/r390-pinscan.py",
    "scripts/r390-val68-apply.py",
    "scripts/r390-window-scan.py",
    "scripts/r390-register-write.py",
    "scripts/r390-readme-update.py",
    "scripts/r390-worklog-append.py",
    "src/lib/__tests__/r390-stil-val68.test.ts",
    "src/lib/__tests__/r390-press-disciplina-generalizacija.test.ts",
]

UREDI = {  # pot → seznam (staro, novo) — samoreference moje runde
    "scripts/r391-era-harvest.sh": [("r390-", "r391-"), ("R390 ", "R391 ")],
    "scripts/r391-era-ruta-map.py": [("r390-", "r391-"), ("R390 ", "R391 ")],
    "scripts/r391-qa-spot.sh": [("r390-", "r391-"), ("R390 ", "R391 ")],
    "scripts/r391-triaza.py": [("r390-", "r391-"), ("R390 ", "R391 ")],
    "scripts/r391-pinscan.py": [("r390-", "r391-"), ("R390 ", "R391 ")],
    "scripts/r391-val68-apply.py": [("r390-", "r391-"), ("R390 ", "R391 ")],
    "scripts/r391-window-scan.py": [("r390-", "r391-"), ("R390 ", "R391 "), ("= 340, 390", "= 340, 391")],
    "scripts/r391-register-write.py": [
        ("r390.tsv", "r391.tsv"), ("R390 val 68", "R391 val 68"),
        ("TODO-R390", "TODO-R391"), ("HEAD = \"35edf80\"", "HEAD = \"3475792\""),
        ("r390-register-write.py", "r391-register-write.py"), ("R390", "R391"),
    ],
    "scripts/r391-readme-update.py": [("R390", "R391")],
    "scripts/r391-worklog-append.py": [("R390", "R391")],
    "src/lib/__tests__/r391-stil-val68.test.ts": [("R390", "R391"), ("r390-", "r391-")],
    "src/lib/__tests__/r391-press-disciplina-generalizacija.test.ts": [("R390", "R391"), ("r390-", "r391-")],
}

def main():
    # 1) git mv + vsebinske samoreference
    for pot in PREIMENUJ:
        nov_pot = pot.replace("r390-", "r391-")
        r = subprocess.run(["git", "mv", pot, nov_pot], cwd=REPO, capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(f"FAILOVEDANO: git mv {pot}: {r.stderr[:200]}")
        t = (REPO / nov_pot).read_text(encoding="utf-8")
        for staro, novo in UREDI.get(nov_pot, [("R390", "R391"), ("r390-", "r391-")]):
            t = t.replace(staro, novo)
        (REPO / nov_pot).write_text(t, encoding="utf-8")
    print(f"OK: preimenovanih {len(PREIMENUJ)} artefaktov + samoreference")

    # 2) r391.tsv register (iz moje r390 verzije, prej shranjene v /tmp)
    moj = pathlib.Path("/tmp/moj-r390.tsv").read_text(encoding="utf-8")
    moj = moj.replace("R390 val 68", "R391 val 68").replace("TODO-R390", "TODO-R391")
    moj = moj.replace("qa-needles/r390.tsv", "qa-needles/r391.tsv")
    moj = (moj
           .replace("# qa-needles/r390.tsv", "# qa-needles/r391.tsv")
           .replace("runde R390", "runde R391")
           .replace("R390 TRIINŠTIRIDESIJNA", "R391 TRIINŠTIRIDESIJNA")
           .replace("naslednja era preverba ≥175 = 173 + 2", "naslednja era preverba ≥184 = 182 + 2 [44. preverba r347–r390 ≥182 = 173 + 9 njihovih katalog needlejev — KOLIZIJA #25; potem 45. r347–r391]"))
    dst = REPO / "scripts/qa-needles/r391.tsv"
    if dst.exists():
        sys.exit("FAILOVEDANO: r391.tsv ŽE obstaja")
    dst.write_text(moj, encoding="utf-8")
    subprocess.run(["git", "add", "scripts/qa-needles/r391.tsv"], cwd=REPO, check=True)
    print("OK: r391.tsv zapisan (iz moje verzije; njihov r390.tsv bajtno nespremenjen)")

    # 3) r363.tsv žigi + 5 EVOLVED testnih datotek
    for rel, pari in [
        ("scripts/qa-needles/r363.tsv", [("EVOLVED R390 val 68", "EVOLVED R391 val 68"), ("R390 val 68 NASLEDNICA", "R391 val 68 NASLEDNICA")]),
        ("src/lib/__tests__/r204-narocilnica-strazar.test.ts", [("[EVOLVED R390 val 68", "[EVOLVED R391 val 68")]),
        ("src/lib/__tests__/r269-meritve-teren-pdf.test.ts", [("[EVOLVED R390 val 68", "[EVOLVED R391 val 68")]),
        ("src/lib/__tests__/r271-punch-stanje-pdf.test.ts", [("[EVOLVED R390 val 68", "[EVOLVED R391 val 68")]),
        ("src/lib/__tests__/r272-nagibi-teren-pdf.test.ts", [("[EVOLVED R390 val 68", "[EVOLVED R391 val 68")]),
        ("src/lib/__tests__/r363-stil-val46.test.ts", [("[EVOLVED R390 val 68", "[EVOLVED R391 val 68")]),
    ]:
        p = REPO / rel
        t = p.read_text(encoding="utf-8")
        for staro, novo in pari:
            if staro not in t:
                sys.exit(f"FAILOVEDANO: {rel} manjka žig: {staro[:50]}")
            t = t.replace(staro, novo)
        p.write_text(t, encoding="utf-8")
    print("OK: r363.tsv + 5 EVOLVED datotek preimenovani žigi")

    # 4) POST preverbe
    napake = []
    for rel in PREIMENUJ:
        if (REPO / rel).exists():
            napake.append(f"star artifact ŠE obstaja: {rel}")
    njihov = (REPO / "scripts/qa-needles/r390.tsv").read_text(encoding="utf-8")
    if njihov.count("need_static") < 9:
        napake.append("njihov r390.tsv ni več ×9 need_static?!")
    if "PRODUKTNI KATALOG" not in (REPO / "README.md").read_text(encoding="utf-8"):
        napake.append("njihov README R390 bullet manjka")
    if napake:
        for n in napake:
            print("FAILOVEDANO:", n)
        sys.exit(1)
    print("OK: KOLIZIJA #25 preimenovanje zaključeno (README/worklog R391 sloj sledi v lastnih skriptah)")

if __name__ == "__main__":
    main()
