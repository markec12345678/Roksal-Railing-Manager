#!/usr/bin/env python3
# r369-trio-identity.py — R369 dedup 9. val kandidat: rdeči števec trio
# (mainRed + mainRedOffset2 + mainRedBrezOffset) v r368-qa-spot.sh A/B/C —
# LEKCIJA R362 (3): preveriti byte-identičnost okna PRED kanonizacijo.
# Metoda (kanon R368: python prek md5 nad okni): izlušči vsako pojavitvijo
# bloka od 'mainRed:' do 'mainRedBrezOffset' (vključno s končno .length),
# normaliziraj presledke NIKOLI (byte resnica), md5 + Set velikost.
import re, hashlib, pathlib

src = pathlib.Path("/home/z/my-project/scripts/r368-qa-spot.sh").read_text(encoding="utf-8")
# PER-BLOK okna (popravek križno-bločnega ulova): poišči vsako vrstico z
# 'mainRed:' in vzemi okno DO vrstice, ki vsebuje 'mainRedBrezOffset' IN se
# konča z '.length' — SAMO če je ta ≤ 3 vrstice naprej (isti blok).
lines = src.splitlines()
windows = []
i = 0
while i < len(lines):
    if "mainRed:" in lines[i] and "mainRedBrezOffset:" not in lines[i]:
        for j in range(i, min(i + 4, len(lines))):
            if "mainRedBrezOffset:" in lines[j]:
                w = "\n".join(lines[i : j + 1])
                windows.append(w)
                i = j
                break
        else:
            i += 1
            continue
    i += 1
print(f"najdenih polnih trioj okien (per-blok): {len(windows)}")
hashes = []
for i, w in enumerate(windows, 1):
    h = hashlib.md5(w.encode()).hexdigest()
    hashes.append(h)
    print(f"  okno {i}: md5={h} bajtov={len(w)}")
print("SET velikost:", len(set(hashes)), "→ BYTE-IDENTIČNI ×" + str(len(windows)) if len(set(hashes)) == 1 else " → RAZLIČNI")

# tudi B (skrajšani 2-poljni) blok — samo dokumentiraj
short = re.findall(r"mainRed:.*?mainRedOffset2:.*?\.length", src, re.S)
print(f"skrajšanih (mainRed+Offset2) okien: {len(short)}")
for i, w in enumerate(short, 1):
    print(f"  kratko okno {i}: md5={hashlib.md5(w.encode()).hexdigest()} bajtov={len(w)}")
