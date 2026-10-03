#!/usr/bin/env python3
# r402-readme-update.py — R402 README posodobitev (fail-closed, kanon
# r400/r401-readme-update.py): števec 5902/395 → 5945/398 [+43/+3: §19
# plačila — r402-invoice-lifecycle ×20 + r402-payments-api ×12 +
# r402-payments-store ×11]; R402 bullet NAD R401 bulletom (bajtno ohranjen);
# R402 naloga/kandidati vrstici (iz R401 handoverja, izvedene) zamenjani z
# R403 naloga/kandidati.
import pathlib
import sys

REPO = pathlib.Path("/home/z/repo-analysis")
README = REPO / "README.md"

STAR_STEVEC = "| Testi (vitest) | **5902** (395 datotek, vključno z globalSetup embedded PG) |"
NOV_STEVEC = "| Testi (vitest) | **5945** (398 datotek, vključno z globalSetup embedded PG) |"

R401_BULLET_PREF = "- **COLOR-SCHEME PARITETA val 75"

R402_BULLET = ("- **§19 INVOICE → PAYMENT → RECONCILIATION — korak R170 (issue #13; KOLIZIJE #31–#33: NJIHOVE QA runde R400 [6abd7b1 val 74 slovar-raba] + R401 [35e6f12 val 75 color-scheme] + dopolnilo [8275bfe] pristale med mojim delom → MOJA runda preimenovana R400→R402 — register/testi/migraciji/window-scan/žigi preimenovani; ⭐ _prisma_migrations očiščena odvečnih r400 duplikatov v OBEH bazah [roksal_dev + roksal_test — kanon R393/R395 precedens preimenovanja zapisov; 34/34 usklajeno])**: [A] FINANČNI STATUSNI STROJ src/lib/invoice-lifecycle.ts (9 statusov; plačilna pot OSNUTEK→IZDAN→POSLAN→DELNO_PLACAN→PLACAN + izterjevalna IZDAN/POSLAN→ZAPADLO→OPOZORILO→IZTERJAVA; DELNO_PLACAN/PLACAN IZPELJANA strežniško iz plačil — ročni PATCH → 409 z navodilom na /api/payments [»Ni UI-only status rules« §21]; PLACAN terminalen za plačilno pot [odprtje SAMO prek prekinitve plačila — ločena VOID množica]; izpeljava v centih [FP varnost 0,1+0,2]; povratni status po prekinitvi determinističen iz diska [rok/poslanoAt/izdan]) + [B] TRANSAKCIJSKA PLAST src/lib/payments.ts (zabeleziPlaciloVTx — plačilo + allocacije + izpeljava statusov + auditi PAYMENT_RECORDED/INVOICE_STATUS VSE ATOMSKO; vrata: osnutek/storno 409, prečni projekt 409, NADPLACILO 409, vsota allocacij > plačilo 400, valuta EUR-only 400, podvojen par 400; + prekiniPlaciloVTx — PREKINJENO z razlogom, plačilo se NE briše [pravna sled], računi se PONOVNO izpeljejo iz KNJIZENO ostanka, dvojna 409; + uskladiPlacila — samo-bralno poročilo: placiloZnesek/odprto/zapadlo + anomalije STATUS_PREPLACAN/STATUS_NIZJI/STATUS_VISJI/PLACANOAT_BREZ_STATUSA/PLACAN_BREZ_DATUMA/NEPORAZDELEJEN_OSTANEK/STORNO_S_PLACILOM — poroča, NE popravlja [kanon object-reconciliation R399]) + [C] API 3 rute (POST/GET /api/payments [invoices.issue/invoices.read + resource-plast + rate-limit + Idempotency-Key exactly-once — bančni promet se NE podvoji ob retry; API ključ ZAVRNJEN — finančni uradni podatki, kanon R126] + GET/PATCH /api/payments/[id] [prekinitev — discipliniran vnos {action:'prekini',razlog}, kanon R378] + GET /api/payments/reconciliation [GET-samo BREZ rate-limit vrata — kanon catalog/products R390]; GET /api/invoices nosi strežniško izpeljavo placiloZnesek — klient NE šteje plačil sam) + [D] BAZA 2 MIGRACIJI (Payment [tip PLACILO/AVANS/DOBROPIST/POVRACILO, metoda, bankaPodatki allowlist JSON, status KNJIZENO/PREKINJENO, prekinitevRazlog/prekinjenoAt, createdBy NULL=sistemski backfill] + PaymentAllocation [@@unique(paymentId,invoiceId) — delno plačilo/več računov/avans/dobropis/povratilo se izrazijo S TEMI vrsticami] + Invoice.poslanoAt + BACKFILL legacy PLACAN [vsak PLACAN brez allocacij dobi ENO kanonsko plačilo za cel znesek, referenca BACKFILL-R402-LEGACY, createdBy NULL — odkrito sledljivo, spec §33 korak 6] + CHECK invoice_status_allowed razširjen na 9 statusov [ločena migracija — precedens R395]; 34/34 migracij applied) + [E] UI (invoice-manager: 9-statusni STATUS_META žetoni [plavnilna pot zeleno/navy, izterjevalna rdeče naraščajoče], gumb »Plačan« zdaj ZABELEŽI PLAČILO prek /api/payments [odprta razlika iz strežniške izpeljave], nov gumb »Poslan« [IZDAN→POSLAN], »Doplata« za DELNO_PLACAN, povzetek šteje placiloZnesek; prihodki-pdf STATUSI razširjen na 9 + placiloZnesek vrstica + zapadlost VSA neplačena stanja) + testi +43/+3 [PIN shifts ×17 starih datotek — vrata/števci] + register r402.tsv ×3 strežniških needlejev [vsak ×1 v build server čanku — števca IZ BUILDA, LEKCIJA R398 (4); 0 v HEAD d8a76c5; AZ spec izpuščen NAMERNO — false-ŽIVO zaščita R401] + ⭐ LEKCIJA R402 (1): register prekinjene seje zapisan s PRESLEDKI namesto TAB → r402-register-write.py GLASNO rekonstruiral v TAB obliko (Z-STRUCT-REG kanon qa-round FS='\\t'; nič tihega) + window-scan 24. gen (304 okenskih 0 preozkih + 217 needle pinov 0 mrtvih + 150 slice + 0 vrstičnih) + **DEPLOY PRISTAL — stamp-gate LEKCIJA R400 (2)**: /api/version 2026-10-03T14:57:03Z > 13:02 UTC = NOV deploy (Vercel Hobby kvota pretekla; R401 build ŽIV; NOVI .css čanki 34d933785a17edf3 + caab1e523b39b9f6) + **val 73/74/75 POST-deploy MONTIRANI dokazi VSI ZELENI** [r402-val73-75-mounted.sh — CSSOM walk na produ: reduced-motion guard .animate-fade-in-up,.slide-in-right MONTIRAN ×1 + .shimmer/.animate-bounce-subtle MONTIRANA ×3 + badge-pulse zliti ×2 bajtno + korenColorScheme 'light' + :root{color-scheme:light} + .dark{color-scheme:dark} + hibrid false; ZERO-MUTACIJA sonde + screenshot /tmp/r402-val-mounted/] + **era 52. RE-RUN EXIT=0 — 195/195 ŽIVO** [val 73 needle ŽIV v NOVEM .css čanku — r399-era-harvest.sh bajtno] + era 53./54./55. iskreni EXIT=2 [195/198, 196/199, 198/201 — edini PENDING = 3× r399 needleji: AZ spec odločitev z lastnikom; ⭐ dopolnilni AUTH-DOKAZ R402: prijavljen probe GET /api/storage/reconcile → HTTP 403 (NE 401!) + needle N1 'Spravo shrambe urejajo uporabniki z vodstveno vlogo' BESEEDNO v telesu — auth-razločevalen odgovor [R401 lekcija (3)]; ruta DOKAZANO deployana] + prod-qa re-run 401 ZELEN poskus 1 [32. runda zapored; REDNI ZAKON: prod-qa PRVI → +2 ABSOLUTNA .css URL-ja z backupom .bak-r402 — 62 URL-jev] + opažanje korak-številčenja [issue »Priporočen vrstni red« tabela = kanon: R170 = §19 plačila ✓ — R402 oznaka PRAVILNA; starejše runde nosijo drseče oznake (r390.tsv 'R170 iz §14', r399 'R173 iz §18') — pristala resnica bajtno, nič mutirano]. VERIFIKACIJA: tsc 0 · eslint 0 · vitest **5945/5945 (398) FULL GREEN** prek 3 foreground shardov · build svež rm -rf .next EXIT=0 [PRVI — pred registerjem, LEKCIJA R396 (7)] · qa-round 402 needles EXIT=0 [BASH_ENV cd-shim kanon R376/R393(3); UNION r340–r402 + veriga r339→…→R227 — 1095 OK] · smoke EXIT=0 [standalone :3100] · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — ZERO-MUTACIJA] · window-scan 24. gen EXIT=0 · leak-check čist [ghp_/vcp_ ×0]. KONTRAKT: SDK/BOM/pricing/geometry NIČ mutirano; viz/** ZAŠČITENO jedro nič; OgrajaVizija nič; 0 novih hex; brez sheme s strani QA [ZERO-MUTACIJA E2E].**")

R403_NALOGA = ("- R403 prva naloga = **STAMP-GATE najprej** (/api/version > 14:57:03 UTC 3.10. = NOV deploy z R402 plačili [moji r402.tsv ×3 needleji ŽIVI šele po njem]; ⚠️ Vercel Hobby kvota — 24 h okno od pristanka R401 deploya: pričakovano ~14:57 UTC 4.10.; če ŠE rate-limited: iskren PENDING — LEKCIJA R400 (2)) + prod-qa re-run 402 [r359-prod-qa-retry.sh 402; REDNI ZAKON: prod-qa PRVI → +2 ABSOLUTNA .css URL-ja iz živega HTML z backupom .bak-r403 → era — LEKCIJA R400 (1)] + **ŠESTINPETDESETA (56.) era preverba r347–r402** [era-clone.py --src-round 402 --dst-round 403 --expected-total 204; ERA_BESODE 56 ŠESTINPETDESETA GLASNO; pokrije r402.tsv ×3 — ⚠️ strežniški needleji: klient-čank resolucija era žetve NE pokriva strežniške plasti → pričakovan iskren MISS + AUTH-probe vzorec (403 body needle, odkrit R402) kot dopolnilni dokaz ALI kanonizacija — odločitev z lastnikom, AZ precedent r399] + era 53./54./55. RE-RUN [3× r399 PENDING — odkriti, ali so se razrešili; AZ spec ostaja izpuščen do odločitve lastnika] + val 73/74/75 + r399 + r402 needleji POST-deploy verifikacija ob stamp-gate.")

R403_KANDIDATI = ("- R403 kandidati: 1. **AZ spec kanonizacija** — auth-razločevalni probe (403 body needle — prijavljen non-vodja GET) kot DEPLOY-DOKAZ za strežniške needleje [r399 ×3 + r402 ×3; odkrit vzorec R402 — odločitev z lastnikom; |401 ostaja PREPOVEDAN — false-ŽIVO]; 2. merge-chunkurls.py hardening — UNIJA ohrani .css vnose (prod-qa re-run jih briše; kanon: hardening V NOVI skripti, zamrznjen R297 NI mutiran — odločitev z lastnikom); 3. era-clone.py reg_var enotski test (reg_var(347…420) znani nizi vs. izpeljava — prepreči ponovitev LEKCIJE R401 REG_A[); 4. e2e-lib dedup [po kanonu — ni novih ×3]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (93. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. ISSUE #1: ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA].")


def fail(msg: str) -> None:
    print(f"FAILOVEDANO: {msg}")
    sys.exit(1)


def main() -> None:
    t = README.read_text(encoding="utf-8")
    if t.count(STAR_STEVEC) != 1:
        fail(f"števec pin = {t.count(STAR_STEVEC)} (pričakovano točno 1)")
    t = t.replace(STAR_STEVEC, NOV_STEVEC)
    lines = t.splitlines(keepends=True)
    idx = [i for i, l in enumerate(lines) if l.startswith(R401_BULLET_PREF)]
    if len(idx) != 1:
        fail(f"R401 bullet pin = {len(idx)} (pričakovano točno 1)")
    i = idx[0]
    if not lines[i].endswith("\n"):
        fail("R401 bullet ni celotna vrstica")
    lines.insert(i, R402_BULLET + "\n")
    t = "".join(lines)
    naloga_idx = [l for l in t.splitlines() if l.startswith("- R402 prva naloga = ")]
    if len(naloga_idx) != 1:
        fail(f"R402 naloga pin = {len(naloga_idx)} (pričakovano točno 1)")
    t = t.replace(naloga_idx[0], R403_NALOGA)
    kand_idx = [l for l in t.splitlines() if l.startswith("- R402 kandidati: ")]
    if len(kand_idx) != 1:
        fail(f"R402 kandidati pin = {len(kand_idx)} (pričakovano točno 1)")
    t = t.replace(kand_idx[0], R403_KANDIDATI)
    if "**5945** (398 datotek" not in t or t.count("§19 INVOICE → PAYMENT → RECONCILIATION — korak R170") != 1:
        fail("po-verifikacija ni uspela")
    README.write_text(t, encoding="utf-8")
    print(f"OK: {README} posodobljen (števec 5945/398; R402 bullet nad R401; R403 naloga/kandidati)")


if __name__ == "__main__":
    main()
