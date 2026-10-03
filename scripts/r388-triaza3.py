#!/usr/bin/env python3
# r388-triaza3.py — R388 kandidat za MANDATORY STIL val 66: hover-color
# GLADKOST census. Elementi z hover:bg-roksal-* ALI hover:text-roksal-* ALI
# hover:border-roksal-* (materijske roksal hover barve) BREZ transition-
# skladnosti (transition-colors / transition-all / transition / duration-* na
# isti vrstici) — hover skok namesto gladkega prehoda = REALEN vizualni
# polžek (KANON: statistika brez vizualnega učinka NE sme biti delana
# zaradi dela — ta kategorija IMA vizualni učinek).
import pathlib, re, sys

REPO = pathlib.Path("/home/z/my-project")
SRC = REPO / "src"
KOMPLETI = list(SRC.rglob("*.tsx")) + list(SRC.rglob("*.ts"))

gaps = []
for f in KOMPLETI:
    if "__tests__" in str(f):
        continue
    vrstice = f.read_text(encoding="utf-8").splitlines()
    for i, v in enumerate(vrstice, 1):
        if not re.search(r"hover:(bg|text|border)-roksal-", v):
            continue
        if re.search(r"transition-(colors|all)|(?<![-\w])transition(?![\w-])", v):
            continue
        # ui-kit komponente (Button/Badge/Card/Input...) nosijo transition
        # v cva bazi (button.tsx 'transition-all', badge.tsx
        # 'transition-[color,box-shadow]') → className POKONČINENA vrstica
        # z <Button na prejšnjih vrsticah NI lažno pozitivna. Preveri do
        # 8 vrstic NAZAJ: najbližja odpiralna <Tag ali zaključna /> ali <Tag...
        # odloča, kateremu elementu vrstica pripada.
        def pripada_ui_kit(idx, vrst):
            for j in range(idx - 1, max(0, idx - 9) - 1, -1):
                prej = vrst[j - 1]
                if re.search(r"/>\s*$", prej) or re.search(r"</[A-Za-z]+>\s*$", prej):
                    return False
                if re.search(r"<(Button|Badge|Card|Input|DropdownMenuItem|Alert|AlertDialogAction|AlertDialogCancel|Checkbox|Switch|Label|Textarea|SelectTrigger|TabsTrigger|Toggle)\b", prej):
                    return True
                if re.search(r"<[a-z][a-zA-Z]*[\s>]", prej):
                    return False
            return False
        if re.search(r"<(Button|Badge|Card|Input|DropdownMenuItem|Alert|AlertDialogAction|AlertDialogCancel)\b", v) or pripada_ui_kit(i, vrstice):
            continue
        # izključi disabled/static površine brez interakcije? (ostane disk resnica)
        gaps.append((f, i, v.strip()[:170]))

print(f"=== HOVER-ROKSAL brez transition skladnosti — disk resnica ===")
print(f"skupaj: {len(gaps)}")
for f, i, v in gaps:
    print(f"  {f.name}:{i}  {v}")
sys.exit(0)
