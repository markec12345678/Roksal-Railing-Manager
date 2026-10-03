#!/usr/bin/env python3
# r389-readme-update.py — R389 fail-closed README posodobitev (kanon
# r388-readme-update.py): (1) števec testov 5619/371 → 5628/373
# [= R388 baza + mojih +9/+2: r389-stil-val67 ×4 + r389-lasta-uzkost ×5
# (A + B + C it.each ×2 + D)]; (2) NOV R389 bullet NAD R388 bulletom
# (njegov R388 bullet ohranjen — kanon nespremenljivosti zgodovine).
import pathlib
import sys

README = pathlib.Path("/home/z/my-project/README.md")

STARI_STEVEC = "| Testi (vitest) | **5619** (371 datotek, vključno z globalSetup embedded PG) |"
NOVI_STEVEC = "| Testi (vitest) | **5628** (373 datotek, vključno z globalSetup embedded PG) |"

R388_GLAVA = "- **HOVER-BARVNA GLADKOST val 66 (21 × INS transition-colors — snap hover → gladak na nativnih interaktivnih elementih + Badge hover:bg družina)"

R389_BULLET = (
    "- **LASTNA-PREHOD GLADKOST val 67 (2 × REPL property-list nadgradnja — konflikt transition-transform + hover barvni žeton; "
    "snap → gladak BREZ aditivnega konflikta) + FEATURE PETI STRAŽAR: lastna-prehod disciplina GENERALIZACIJA (kaskadni "
    "zmagovalec, ne unija — LEKCIJA R389 (3): cva baza pokritost NIČNA, če element sam nosi ožjo transition-* utility) "
    "+ val 66 POST-deploy MONTIRANO + era veriga utrjena (checkpoint guard + odpadni cenZUS + kontrole hash-fallback)** (R389): "
    "(1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 388`: **ZELEN ob poskusu 1** (23. runda) + "
    "**DVAINŠTIRIDESIJNA era preverba** `r389-era-harvest.sh` [42 registrov r347–r388, ≥171 = 167 + 4; generiran prek "
    "era-clone.py --src-round 388 --expected-total 171 + VSEH 12 server-probe spec-ov IZRECNO — LEKCIJA R384 (1); "
    "**era-clone.py GLASNO razširjen: ERA_BESODE na 42 + CHECKPOINT GUARD + ODPADNI CENZUS + era kontrole hash-rezolucijski "
    "fallback]**; COMPANION r389-era-ruta-map.py avtomatsko]: **EXIT=0 ×2** (determinizem) — **171/171 ŽIVO** (val 66 deploy "
    "POTRJEN — 4 needleji r388 razrešeni ob R388 pushu); must_miss ×42 čisto; ⭐ **LEKCIJA R389 (1) — Vercel Security Checkpoint**: "
    "1. tek žetve onesnažen [46/60 čankov = 403 'Vercel Security Checkpoint' strani — qa-harvest uspeh = ne-prazno telo, 403 "
    "stran JE ne-prazna; lažni MISS storm + zavajajoč 'neuspešno razrešeni']; deterministična pavza (~45s) razrešila "
    "(transient infra kategorija, NI code-bug); guard zdaj glasno aborta z diagnozo; ⭐ **LEKCIJA R389 (2) — zamrznjen URL "
    "seznam iz R339 OPADE**: 5/60 čankov = 'Not Found' telesa (Vercel je počistil 43-rundne stare artefakte) → iskren popis "
    "v žetevi + era kontrole R340–R345 dobile ISTI hash-rezolucijski fallback kot need_static (R340 kontrola ŽIV prek "
    "hash rezolucije fd2377174053c378.js); (2) **val 66 POST-deploy spot** `r389-qa-spot.sh` (spot-r171/29; ZERO-MUTACIJA): "
    "dashboard val 66 Badge navy/15 **MONTIRANO 1×** (celoten span per className split) + red/20 **MONTIRANO 1×**; setup "
    "<Link> CTA **iskreno 0** — POGOJNA resnica (CTA renderan SAMO v done stanju po uspešnem bootstrapu — ZERO-MUTACIJA ne "
    "sproži bootstrapa; needle ŽIVO v buildu = era need_static); photo PO anchor L2081 **iskreno 0** — POGOJNA (odprta "
    "fotografija); sonde navy 27/27/0 + red 0; kolektor **0**; (3) **MANDATORY STIL val 67** — sveža triaža disk resnica "
    "`r389-triaza.py` (element-točna, LEKCIJA R388 (1) kanon): handover kandidat 1 (hover-bg na nativnih elementih izven "
    "val 66 obsega: step-*/mask-editor/viz-tab/product-*) = **0 REALnih gapov** [122 že pokritih + 239 ui-kit + vse "
    "iskrene izključitve R388 potrjene na disku: termini-prikaz COLORS brez .tsx potrošnika (PDF liba uvažata SAMO "
    "STATUSI/LABELS — disk preverjeno), material-intelligence L459 baza L457 transition-colors pokritost]; kandidat 2 "
    "(notification L811 transform konflikt) = **konfliktna družina TOČNO 2** [sistematični scan: transition-transform + "
    "(group-)hover barvni žeton na istem elementu] → **2 × REPL in-place**: notification L811 `transition-transform` → "
    "`transition-[transform,color]` (group-hover:text-roksal-amber snap → gladak; aditivni transition-colors bi OVERIL "
    "transform — kaskada .transition-colors @117441 < .transition-transform @118190) + safety-tab L254 `transition-transform` "
    "→ `transition-[transform,background-color,box-shadow]` (ui-kit Button baza transition-all OVERRIDANA s strani elementa "
    "@118190 > @117243 → hover:bg-roksal-navy/90 snap; po buildu arbitrary se vrsti PRED transition-all → zmagovalec baza "
    "→ bg+ring+transform VSI gladki); pre-skan `r389-window-scan.py` (13. generacija; REG_DO 388; notification-center + "
    "safety-tab ŽE v TARGETS) delta +8/+30 ×transition-transform = **304 okenskih regexov 0 preozkih + 184 needle pinov "
    "0 mrtvih + 150 slice-oknen + 0 vrstičnih odstopanj**; `r389-val67-apply.py` fail-closed [kontrakt ×2 polna stara "
    "vrstica bajtno + EVOLVED ×3 v ENEM atomskem koraku (kanon R368); POST 969+759 vrstic bajtno; ponovni tek = abort]; "
    "`r389-stil-val67.test.ts` **×4 ZELENO** [(A) PARITETA 2 tarči nadgrajena lista, (B) CENZUS preostalih 6 "
    "transition-transform vrstic NISO konfliktni, (C) EVOLVED žigi R388 testov, (D) in-place disk resnica]; "
    "(4) **FEATURE PETI STRAŽAR — lastna-prehod disciplina GENERALIZACIJA**: `r389-lasta-uzkost-generalizacija.test.ts` "
    "**×5 ZELENO** [(A) globalna kršitev = 0 čez VSE src z KASKADNO logiko (zmagovalec = najvišji rang med prisotnimi "
    "utilityji — R388 unija je bila lažno pozitivna pri ko-obstoju; kaskadni vrstni red iz zgrajenega CSS: transition < "
    "arbitrary < all < colors < opacity < shadow < transform < none); (B) ui-kit bazi zamrznjeni; (C) it.each ×2 val 67 "
    "tarče preverjene; (D) izjeme ×11 + L811/L254 kaskadno pokriti]; KOMPLET PETIH varuhov: r385 (dark FB) + r386 (O2 "
    "pairing) + r387 (FB-border) + r388 (transition pokritost) + r389 (kaskadna disciplina); (5) e2e-lib dedup 23. val "
    "ISKRENO IZPUŠČEN (kanon R368 — ni novih ×3 ponovitev). REGISTER `scripts/qa-needles/r389.tsv` [2 need_static: "
    "notification L811 + safety-tab L254 najdaljša nova spana; 0 v HEAD 2ccba6c; TODO-R389] prek `r389-register-write.py` "
    "fail-closed. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 (FULL) · vitest **5628/5628 (373) FULL GREEN TEK 1** · "
    "build svež rm -rf .next EXIT=0 · qa-round.sh 389 needles EXIT=0 [r389.tsv 2 ŽIVO + TODO-R389 odsoten; UNION r340–r389 "
    "+ veriga r339→…→R227] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO IDENTIČEN pre==post r276+r281+r283+r287 — "
    "ZERO-MUTACIJA] · r389-era-harvest EXIT=0 ×2 [42nd — 171/171 ŽIVO] · r389-window-scan EXIT=0 [DEL 1–4 čisti] · "
    "r359-prod-qa-retry 388 ZELEN poskus 1 · leak-check čist [ghp_[A-Za-z0-9]{30,} ×0]. NOVO: scripts/qa-needles/r389.tsv "
    "+ skripte [r389-era-harvest.sh (42nd) + r389-era-ruta-map.py (COMPANION), r389-qa-spot.sh, r389-triaza.py, "
    "r389-val67-apply.py, r389-window-scan.py (13. gen), r389-register-write.py, r389-readme-update.py, "
    "r389-worklog-append.py, r389-commit-msg.txt] + r389-stil-val67.test.ts [×4] + r389-lasta-uzkost-generalizacija.test.ts "
    "[×5 — FEATURE]; UREJENO: 2 render datoteki [val 67 REPL ×2: notification-center L811, safety-tab L254], "
    "r388-stil-val66.test.ts [EVOLVED (C) L811 pin], r388-hover-gladkost-generalizacija.test.ts [EVOLVED izjeme ×12→×11], "
    "era-clone.py [ERA_BESODE +42 GLASNO + CHECKPOINT GUARD + ODPADNI CENZUS + kontrole fallback], README. Kontrakt NIČ "
    "(/api/sync — probe je samo fail-closed 401 branje); SDK/BOM/pricing/geometry core NIČ; measurement jedro NIČ [val 67 = "
    "render plast className-only]; OgrajaVizija nič; 0 novih hex; NIČ novih FNV soli; brez sheme s strani QA "
    "[ZERO-MUTACIJA E2E; njihova shema = njihova poslovna odločitev]. ⏰ roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — "
    "obvestiti lastnika (83. zapis). ⚠️ žetona (GitHub + Vercel) uporabljena — priporočena ROTACIJA. R390 prva naloga = "
    "qa-round.sh 389 prod-qa re-run [prek r359-prod-qa-retry.sh 389] + triinštirideseta era preverba r347–r389 [43 "
    "registrov, ≥173 = 171 + 2; prek era-clone.py --src-round 389 --expected-total 173 + VSEH 12 spec-ov IZRECNO — "
    "LEKCIJA R384 (1)]; pričakuj 173/173 ŽIVO [r389 2 needleja razrešena ob TEM pushu] + val 67 POST-deploy verifikacija "
    "[2 needleji r389.tsv; mounted + className LOČENO; NIČ klikov na revoke/odjavo; notification sheet vrstice se samo "
    "MERIJO (ZERO-MUTACIJA kanon); safety-tab 'Kopiraj varnostno poročilo' gumb je mutacija (clipboard) — SAMO className "
    "split MERITEV brez klika]. R390 kandidati: 1. stil družina IZČRPANA za transition/hover-roksal [val 67 disk resnica: "
    "0 realnih gapov preostalih] → sveža triaža nove družine ALI iskreno izpuščeno val [kanon]; 2. L811/L254 POST-deploy "
    "spot + arbitrary kaskadna pozicija v SVEŽEM buildu [disk resnica komentar v r389 feature testu — preveriti vrstni red "
    "na novem CSS]; 3. e2e-lib dedup 23. val [po kanonu — ni novih ×3 ponovitev]. ⭐ LEKCIJE R389: (1) Security Checkpoint "
    "403 onesnaži žetev (ne-prazno telo!) — glasni guard + deterministična pavza; (2) zamrznjen URL seznam odpada — "
    "hash-fallback obvezen POVSEK; (3) cva baza pokritost NIČNA ob ožji elementni utility — kaskadni zmagovalec, ne unija. "
    "ISSUE #1: vsa sprejemna merila ✓; ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA]."
)


def main() -> None:
    vsebina = README.read_text(encoding="utf-8")
    if vsebina.count(STARI_STEVEC) != 1:
        sys.exit("FAILOVEDANO: števec ni enoličen ali manjka")
    if vsebina.count(R388_GLAVA) != 1:
        sys.exit("FAILOVEDANO: R388 bullet glava ni enolična")
    if "R389" in vsebina and "val 67" in vsebina:
        sys.exit("FAILOVEDANO: README ŽE nosi R389 val 67 bullet (idempotenca)")
    vsebina = vsebina.replace(STARI_STEVEC, NOVI_STEVEC, 1)
    vsebina = vsebina.replace(R388_GLAVA, R389_BULLET + "\n" + R388_GLAVA, 1)
    README.write_text(vsebina, encoding="utf-8")
    post = README.read_text(encoding="utf-8")
    if NOVI_STEVEC not in post or R389_BULLET[:80] not in post or R388_GLAVA[:80] not in post:
        sys.exit("FAILOVEDANO: POST preverba README")
    print("OK: README posodobljen (5628/373 + R389 bullet nad R388; R388 bullet ohranjen)")


if __name__ == "__main__":
    main()
