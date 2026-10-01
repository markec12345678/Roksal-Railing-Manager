#!/usr/bin/env bash
# R330 — sweep klicatelj: vzpostavi sejo (LEKCIJA R328 5 — sweep NE vsebuje
# prijave; klicatelj mora vzpostaviti sejo) → poženi r330-sweep.sh.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
bash scripts/r330-sweep.sh
RC=$?
agent-browser close --all >/dev/null 2>&1
exit $RC
