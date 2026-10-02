#!/usr/bin/env bash
# r368-pins-shift.sh — R368 stale-pin SHIFT v zamrznjenih needle skriptah
# (isti rundi — kanon R365/R366/R367: PRED-scan → shift V ISTI rundi).
# Dve družini pina sta prelomljeni z val 51 (amber pariteta):
#   (1) inventory 'Potrdi premik' CTA: offset-1 → offset-2  [15 pojavitev /
#       15 datotek: r243–r255 build-needles + r244-prod-qa];
#   (2) notification kartica 'dokumentirana izjema': offset-2 dodan (izjema
#       ZAKLJUČENA) [11 pojavitev / 11 datotek: r245–r255 build-needles].
# Vsak opis dobi iskren žig [PIN SHIFT R368 val 51: …]. Fail-closed: vsak
# pattern MORA zadeti točno pričakovano število datotek.
set -eu
cd /home/z/my-project/scripts

# --- (1) inventory CTA offset-1→2 + žig (15 datotek) ---
for f in r243-build-needles.sh r244-build-needles.sh r245-build-needles.sh \
         r246-build-needles.sh r247-build-needles.sh r248-build-needles.sh \
         r249-build-needles.sh r250-build-needles.sh r251-build-needles.sh \
         r252-build-needles.sh r253-build-needles.sh r254-build-needles.sh \
         r255-build-needles.sh r244-prod-qa.sh; do
  perl -pi -e 's/focus-visible:ring-roksal-amber\/50 focus-visible:ring-offset-1 press-scale" "R243 Potrdi premik CTA mikro-pritisk"/focus-visible:ring-roksal-amber\/50 focus-visible:ring-offset-2 press-scale" "R243 Potrdi premik CTA mikro-pritisk [PIN SHIFT R368 val 51: offset-1→2 amber pariteta]"/' "$f"
done
n1=$(rg -l 'ring-roksal-amber/50 focus-visible:ring-offset-1 press-scale' . 2>/dev/null | rg -v 'r368-pins-shift.sh' | wc -l)
[ "$n1" = "0" ] || { echo "FAILOVEDANO: ostalo $n1 datotek s starim inventory pinom"; exit 1; }

# --- (2) notification izjema zaključena + žig (11 datotek) ---
for f in r245-build-needles.sh r246-build-needles.sh r247-build-needles.sh \
         r248-build-needles.sh r249-build-needles.sh r250-build-needles.sh \
         r251-build-needles.sh r252-build-needles.sh r253-build-needles.sh \
         r254-build-needles.sh r255-build-needles.sh; do
  perl -pi -e 's/focus-visible:ring-roksal-amber\/60 dark:focus-visible:ring-roksal-amber\/40 active:scale-\[0\.98\]" "R245 notification kartica \(dokumentirana izjema ostaja\)"/focus-visible:ring-roksal-amber\/60 focus-visible:ring-offset-2 dark:focus-visible:ring-roksal-amber\/40 active:scale-[0.98]" "R245 notification kartica [PIN SHIFT R368 val 51: offset-2 — izjema zaključena]"/' "$f"
done
n2=$(rg -l 'ring-roksal-amber/60 dark:focus-visible:ring-roksal-amber/40' . 2>/dev/null | rg -v 'r368-pins-shift.sh' | wc -l)
[ "$n2" = "0" ] || { echo "FAILOVEDANO: ostalo $n2 datotek s starim notification pinom"; exit 1; }

echo "=== PIN SHIFT R368: 15 + 11 pojavitev shiftanih, 0 ostankov ==="
