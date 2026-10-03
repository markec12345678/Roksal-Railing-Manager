#!/usr/bin/env python3
# r394-readme-update.py — R394 README (KOLIZIJA #26 rebase): števec 5816/385
# → 5828/387 [+12/+2: stil val 70 ×5 + OSMI STRAŽAR ×7] + R394 bullet NAD
# njihovim R393 bulletom (bajtno ohranjen). Fail-closed + idempotenten.
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
F = REPO / "README.md"

STARO_STEV = "| Testi (vitest) | **5816** (385 datotek, vključno z globalSetup embedded PG) |"
NOVO_STEV = "| Testi (vitest) | **5828** (387 datotek, vključno z globalSetup embedded PG) |"
MARKER = "- **Issue #13, korak R171 — ENGINEERING / COMPLIANCE VERSIONING (§15):"  # njihov R393 bullet začetek

R394 = (
    "- **FORCED-COLORS FOKUS PARITETA val 70 (105 × REPL in-place — roksal render plast ×24 datotek: "
    "`focus-visible:outline-none` → `focus-visible:outline-hidden`; normal-mode kompilirani CSS IDENTIČNA — "
    "oba outline-style:none — razlika ŠELE v forced-colors mode, kjer ring/box-shadow NE preživi in "
    "outline-hidden obnovi 2px outline = WCAG 2.4.7; družinski precedens viz ×3) + FEATURE OSMI STRAŽAR: "
    "outline/fokus indikator disciplina GENERALIZACIJA (vsak outline-none element nosi nadomestni indikator "
    "v katerikoli focus paradigmi; komplet varuhov r385…r391+r392+r394) + 45. era preverba PETINŠTIRIDESIJNA "
    "184/184 (handover aritmetika 183 GLASNO popravljena na disk resnico) + val 69 needle ŽIVO v prod chunku** "
    "(R394; KOLIZIJA #26 — runda preimenovana R393→R394, njihova R393 [0634c2b engineering rules] = pristala "
    "resnica; vsi moji artefakti preimenovani r393-→r394-, njihovi bajtnato ohranjeni; rebase na zlivenem drevesu): "
    "(1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 392`: **ZELEN ob poskusu 1** (26. runda) + "
    "**PETINŠTIRIDESIJNA era preverba** `r392-era-harvest.sh` [45 registrov r347–r391, **≥184 = 182 + 2** — ⭐ "
    "**LEKCIJA R394 (1): handover aritmetika NI disk resnica** („≥183 = 182 + 1“) — disk resnica r391.tsv nosi "
    "2 need_static; era-clone disk-vsota fail-closed guard bi 183 zavrnil; POPRAVLJENO na 184]: era-clone.py "
    "--src-round 391 --dst-round 392 --expected-total 184 --dst-label \"R391 val 68\" --dst-chain-seg "
    "\"IN r390.tsv ×9 IN r391.tsv val 68 ×2 na\" + 18 spec-ov; ERA_BESODE GLASNO na 45 — PETINŠTIRIDESIJNA; "
    "COMPANION r392-era-ruta-map.py: **EXIT=0 ×3** (pass2 ≡ pass3 bajtno — determinizem) — **184/184 ŽIVO** "
    "[149 direktno + hash + AR katalog server resolucije + 18 server]; must_miss ×45 čisto; era kontrole "
    "R340/R341/R343/R345 ŽIVE; (2) **val 69 POST-deploy verifikacija** `r394-qa-spot.sh` (spot-r184/32; "
    "ZERO-MUTACIJA): material/orders subtab AKTIVEN (aria-pressed=true + bg-roksal-navy) → **DOM 0 + 0 POGOJNA "
    "resnica** („Ni naročil. Pretvori BOM draft v naročilo.“ + „Ni dobaviteljev“ — prazna stanja; ZERO-MUTACIJA "
    "ne fabricira podatkov — kanon R392 spot A) — build-layer dokaz NEODVISNO: **val 69 needle ŽIVO v prod "
    "chunk_036.bin** (transition-[…,box-shadow] + hover par ×2 Card sorojenci); sonde navy 8/8/0 + red 0; "
    "kolektor **0**; (3) **MANDATORY STIL val 70** — triaža `r394-triaza.py` (element-točna; D-check: nadomestilo "
    "= ring/border v KATERIKOLI focus paradigmi focus-visible:/focus:/focus-within: — preozek focus-visible-only "
    "guard lažno zastal 17 vnosnih polj): fv_none ×103 roksal + goli ×14 roksal + ×10 app + ×2 ui + outline-hidden "
    "×3 ui + ×3 viz + brez_nadomestila = 0 (ui/tabs.tsx Radix = FROZEN upstream); ⭐ **REALNA družina: "
    "forced-colors fokus pariteta** — kompilirani CSS disk dokaz (outline-none ≡ outline-hidden normal-mode; "
    "outline-hidden nosi @media(forced-colors:active) 2px outline podaljšek) → **105 × REPL** "
    "`focus-visible:outline-none` → `focus-visible:outline-hidden` (roksal ×24 datotek; 103 className spanov + "
    "2 helper/template žetona); iskrene meje: ui-kit cva baze (shadcn jezik FROZEN), goli outline-none vnosnih "
    "polj (focus: paradigma — outline-hidden bi v forced-colors risal STALNI outline), viz ×3 NESPREMENJENI; "
    "pre-skan `r394-pinscan.py` [RENDER 24×105 + TESTI 27×51 PRESENCE + REGISTRI 32 ŽIVIH]; "
    "`r394-val70-apply.py` fail-closed + IDEMPOTENTEN [1. tek abort: pre-guard kontrakt iz pričakovanj — "
    "popravljen; 2. tek: RENDER 105 × REPL (0 novih vrstic) + TESTI 48 × token-for-token + 3 pričakovane NIČLE "
    "ostale (r368:86, r381:87+88 — .toBe(0) absence discriminatorji) + REGISTRI 32 × NASLEDNICA-2 (×18 datotek — "
    "zgodovina komentirana dobesedno + EVOLVED anotacija; need_static per-register NESPREMENJENI); 3. tek abort — "
    "idempotenca DOKAZANA]; ⭐ **LEKCIJA R394 (2) — pre-skan MORA pokriti legacy needle-skripte**: FULL vitest "
    "tek 1 ujel r370-stil-val53 (C) B236 legacy needle + qa-round ujel 1 MISS v r317 + REGRESIJA kaskada ×7 "
    "(union veriga) → EVOLVED ×15 legacy needlejev [r236 ×2 + r237-prod-core ×1 + r317 ×1 + r245–r255 ×11]; "
    "r368 (C)/r387 (E) exact-label pini na notification vrstici prisilijo žig v TRAILING komentar (notranji "
    "žig bi prelomil bajtno pin) — LEKCIJA R394 (3); `r394-stil-val70.test.ts` **×5 ZELENO** [(A) PARITETA 105 ×24 "
    "(measurements 33/inventory 14/invoice 12), (B) CENZUS fv_none 0 + goli ×14, (C) vsak fv_hidden nosi "
    "indikator, (D) viz ×3 + ui-kit bajtno, (E) NASLEDNICA disk resnica]; (4) **FEATURE OSMI STRAŽAR — "
    "outline/fokus disciplina**: `r394-outline-disciplina.test.ts` **×7 ZELENO** [(A) globalna kršitev = 0 "
    "(>2000 elementov; ui-kit FROZEN), (B) žetoni zamrznjeni, (C) viz kanon ×3 bajtno, (D) ui-kit shadcn bajtno, "
    "(E) fv_hidden VSI nosijo ring/border — ring primaren, outline-hidden = SAMO forced-colors rezerva, (F) "
    "kompilirani CSS dokaz zamrznjen (3 regexa), (G) NASLEDNICE ×32 + zgodovina ×32 + need_static 185]; "
    "(5) e2e-lib dedup 23. val ISKRENO IZPUŠČEN (kanon R368). REGISTER `scripts/qa-needles/r394.tsv` [1 "
    "need_static ŠIVNI needle ×64: focus-visible:outline-hidden focus-visible:ring-2 "
    "focus-visible:ring-roksal-navy/40; 0 v HEAD 0634c2b; TODO-R394] prek `r394-register-write.py` fail-closed; "
    "era veriga: 46. (r347–r392) ≥185; TA needle pokrit v 48. preverbi (r347–r394) ≥189. r394-window-scan.py "
    "**17. generacija** [REG_DO 394 — njihov r393 ×3 + moj r394 ×1 v DEL 2]: **304 okenskih regexov 0 preozkih + "
    "202 needle pinov 0 mrtvih + 150 slice-oknen + 0 vrstičnih odstopanj — EXIT=0**. VERIFIKACIJA (celotna, "
    "FOREGROUND, na ZLIVENEM drevesu): tsc 0 · eslint 0 (FULL) · vitest **5828/5828 (387) FULL GREEN** [njihova "
    "baza 5816/385 + mojih +12/+2; tek na R392 drevesu 5750/5750 (383) + KOLIZIJA popravki] · build svež "
    "rm -rf .next EXIT=0 · qa-round.sh 394 needles EXIT=0 [r394.tsv 1 ŽIVO ×64; UNION r340–r394 + STRAGGLERS + "
    "anchor veriga — po 15 legacy EVOLVED] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post "
    "r276+r281+r283+r287 — ZERO-MUTACIJA] · r392-era-harvest EXIT=0 ×3 [45th — 184/184] · r394-window-scan "
    "EXIT=0 [17. gen] · r359-prod-qa-retry 392 ZELEN poskus 1 · leak-check čist [ghp_ ×0]; + prisma migrate "
    "deploy na njihovi migraciji 20261009080000_r393_engineering_rules (stale client — LEKCIJA R391 (7); "
    ".env DATABASE_URL pokvarjen — eksplicitni URL, .env NI mutiran — LEKCIJA R392). NOVO: "
    "scripts/qa-needles/r394.tsv + skripte [r392-era-harvest.sh (45th) + r392-era-ruta-map.py (COMPANION), "
    "r394-qa-spot.sh, r394-triaza.py, r394-pinscan.py, r394-val70-apply.py, r394-window-scan.py (17. gen), "
    "r394-register-write.py, r394-readme-update.py, r394-worklog-append.py, r394-commit-msg.txt] + "
    "r394-stil-val70.test.ts [×5] + r394-outline-disciplina.test.ts [×7 — FEATURE]; UREJENO: 24 roksal render "
    "datotek [val 70 REPL ×105], 27 testnih datotek [EVOLVED ×48 + 3 ničelni ostali], 18 registrskih datotek "
    "[NASLEDNICA-2 ×32], 14 legacy needle skript, era-clone.py [ERA_BESODE +45], README. Kontrakt NIČ "
    "(/api/sync — probe je samo fail-closed 401 branje); SDK/BOM/pricing/geometry core NIČ; measurement jedro "
    "NIČ [val 70 = render plast className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme "
    "s strani QA [ZERO-MUTACIJA E2E]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~2 tedna) — obvestiti lastnika "
    "(86. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R395 prva naloga = "
    "qa-round.sh 394 prod-qa re-run [prek r359-prod-qa-retry.sh 394] + šestinštirideseta era preverba "
    "r347–r392 [46 registrov, ≥185 = 184 + 1; era-clone.py --src-round 392 --dst-round 393 --expected-total 185 "
    "+ 18 spec-ov; ERA_BESODE 46 ŠESTINŠTIRIDESIJNA GLASNO] + sedeminštirideseta (47.) r347–r393 [47 registrov, "
    "≥188 = 185 + 3 njihovih engineering needlejev — era-clone --src-round 393 --dst-round 394; ERA_BESODE 47] "
    "+ val 70 POST-deploy verifikacija [1 šivni needle r394.tsv ×64; mounted + className LOČENO; "
    "ZERO-MUTACIJA]. R395 kandidati: 1. stil: duration-* konsistenca Card hover družina [verjetno iskren "
    "zaklep — privzeto 150ms]; 2. stil: goli outline-none vnosna polja [focus: paradigma — verjetno iskren "
    "zaklep]; 3. e2e-lib dedup [po kanonu]. ⭐ LEKCIJE R394: (1) handover aritmetika NI disk resnica — "
    "era-clone disk-vsota guard jo ujame; preštej need_static PRED generacijo; (2) pre-skan MORA pokriti legacy "
    "needle-skripte (r2xx–r3xx build-needles + prod-core) — union veriga jih poganja proti svežemu buildu; "
    "(3) exact-label pini (celoten label z zaključnim navedkom) onemogočijo žig znotraj navedka — trailing "
    "komentar ohrani dokumentacijo IN pin; (4) expected-0 pini (.toBe(0) za žetonom) se NE evolvirajo; (5) "
    "apply pre-guard piši IZ disk resnice; (6) triaža D-check: nadomestilo v KATERIKOLI focus paradigmi; (7) "
    "KOLIZIJA rename: untracked artefakti se preimenujejo PRED ff-pull (mv + samoreference), deljene datoteke "
    "(README/worklog) se re-aplicirajo na NJIHOVO postavitev. ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, "
    "owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].\n"
)

def main():
    t = F.read_text(encoding="utf-8")
    if "**FORCED-COLORS FOKUS PARITETA val 70" in t:
        sys.exit("FAILOVEDANO: R394 bullet ŽE obstaja (idempotenca)")
    assert t.count(STARO_STEV) == 1, f"števec: {t.count(STARO_STEV)}"
    t = t.replace(STARO_STEV, NOVO_STEV)
    assert t.count(MARKER) == 1, f"marker: {t.count(MARKER)}"
    t = t.replace(MARKER, R394 + MARKER, 1)
    F.write_text(t, encoding="utf-8")
    print("OK: README — števec 5828/387 + R394 bullet (njihov R393 bullet bajtno ohranjen)")

if __name__ == "__main__":
    main()
