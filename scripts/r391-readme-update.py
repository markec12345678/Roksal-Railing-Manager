#!/usr/bin/env python3
# r391-readme-update.py — R391 README sloj (KOLIZIJA #25 adopcija; fail-closed):
#   - števec 5708 (377 — njihova R390 baza) → 5727 (379) [= +19/+2: stil
#     val 68 ×5 + ŠESTI STRAŽAR ×14];
#   - moj R391 bullet NAD njihovim R390 bulletom (njihov bajtno ohranjen);
#   - idempotenten: abort, če R391 bullet ŽE obstaja.
import pathlib
import sys

REPO = pathlib.Path("/home/z/my-project")
README = REPO / "README.md"

STARA = "| Testi (vitest) | **5708** (377 datotek, vključno z globalSetup embedded PG) |"
NOVA = "| Testi (vitest) | **5727** (379 datotek, vključno z globalSetup embedded PG) |"
ANCHOR = "- **Issue #13, korak R170 — PRODUKTNI KATALOG"

R391_BULLET = (
    "- **PRESS-SCALE DVOJNI MEHANIZEM RESOLUCIJA val 68 (10 × REPL in-place — ko-obstoj custom `.press-scale:active` "
    "{transform: scale(.97)} in Tailwind v4 utility `active:scale-[0.96]` {scale: .96} na ISTEM elementu = MNOŽIČEN "
    "skrček 0.9312 — neodvisni CSS lastnosti!) + FEATURE ŠESTI STRAŽAR: press-scale disciplina GENERALIZACIJA "
    "(EN element = EN press mehanizem; komplet varuhov r385+r386+r387+r388+r389+r391) + era orodje UTRJENO "
    "(era-clone.py idempotentno kloniranje utrjenih virov + KeyError f-string/format popravka) + val 67 POST-deploy "
    "MONTIRANO + TRIINŠTIRIDESIJNA era preverba 173/173** (R391; KOLIZIJA #25 — runda preimenovana R390→R391, "
    "njihov katalog R390 = pristala resnica): (1) **prva naloga** — prod-qa re-run prek `r359-prod-qa-retry.sh 389`: "
    "**ZELEN ob poskusu 1** (24. runda) + **TRIINŠTIRIDESIJNA era preverba** `r391-era-harvest.sh` [43 registrov "
    "r347–r389, ≥173 = 171 + 2; era-clone.py --src-round 389 --dst-round 390 --expected-total 173 + VSEH 12 "
    "server-probe spec-ov IZRECNO; ERA_BESODE GLASNO na 43 — TRIINŠTIRIDESIJNA; COMPANION r391-era-ruta-map.py]: "
    "**EXIT=0 ×2** (determinizem) — **173/173 ŽIVO** [147 direktno + 8 hash + 18 server resolucij; val 67 deploy "
    "POTRJEN]; must_miss ×43 čisto; ⭐ **LEKCIJA R391 (1) — era-clone.py NI zmožen klonirati utrjenega vira**: r389 "
    "harvest ŽE nosi CHECKPOINT GUARD + ODPADNI CENZUS + era-kontrola hash-fallback → vstavljanje = duplikat, rep "
    "sidran na ŽE nadomeščeno enovrstično obliko (FAILOVEDANO 0), **KeyError('http_code')** [f-string %{{http_code}} "
    "pusti literal {http_code}, .format(dst) nad celotno implicitno konkatenacijo — konkatenacija se veže PRED "
    "metodo]; POPRAVEK: idempotentna preverb (vir utrjen = preskoči vstavljanje + SAMO prelabel r389-→r391-kontrola- "
    "×2) + čista f-string sestava + POST check 'Vercel Security Checkpoint' 2→4 + r391-kontrola- ×2; (2) **val 67 "
    "POST-deploy spot** `r391-qa-spot.sh` (spot-r173/30; ZERO-MUTACIJA — obvestilne vrstice samo MERJENE, safety-tab "
    "clipboard gumb NI klikljen): notification L811 ChevronRight **MONTIRANO 10×** — 3 needle žetoni ×10 LOČENO "
    "[⭐ LEKCIJA R391 (3): SVGElement.className = SVGAnimatedString — getAttribute('class')]; safety-tab L254 Button "
    "**MONTIRANO 1×** — 12/12 tokenov LOČENO; kolektor **0**; (3) **MANDATORY STIL val 68** — sveža triaža NOVE "
    "družine [transition/hover IZČRPANA po val 67; ring-offset dark rešeno R168; active:scale + disabled: semantično "
    "— iskreno ZAMRZNJENO]: ⭐ **REALNA družina: press-scale × active:scale ko-obstoj** — `r391-triaza.py` "
    "(element-točna span parser, LEKCIJA R388 (1) kanon) = **TOČNO 10 dual elementov** [calculator L820, dashboard "
    "L2426+L2435, inclinometer L341, inventory L1562, measurements L3496+L5211+L5234+L5258, punch-list L531]; zgrajen "
    "CSS dokaz: `.press-scale:active{transform:scale(.97)}` vs `.active\\:scale-\\[0\\.96\\]:active{scale:.96}` — "
    "neodvisni lastnosti → 0.97 × 0.96 = **0.9312 množičen skrček**; `r391-pinscan.py`: **TOČNO 1 ogrožen register "
    "needle** (r363.tsv:21 — edini vir dual inventory L1562) + 19 kontrolnih ŽIVIH; `r391-val68-apply.py` "
    "fail-closed + IDEMPOTENTEN [10 × REPL ' press-scale' odstranitev, 0 novih vrstic; EVOLVED ×5 testnih pinov + "
    "r363.tsv NASLEDNICA-3 v ENEM atomskem koraku; ⭐ **LEKCIJA R391 (2) — dva lastna buga 1. teka**: (i) PATH bug "
    "[source zapisan v koren repozitorija → tsconfig include **/*.tsx = 34 lažnih TS2307], (ii) akumulacijski bug "
    "[multi-target datoteke ponovno brale disk = izgubljeni bratski uredi 6/10] → per-file grupiranje + EN pomik + "
    "idempotentni preskoki; 2./3. tek dual 4→0, 0→0 ×2 DOKAZANO]; press-scale žetoni 133→123 (−10); "
    "`r391-stil-val68.test.ts` **×5 ZELENO** [(A) PARITETA 10 tarč element-točno, (B) CENZUS dual=0 + žetoni 28 "
    "(prej 38), (C) EVOLVED žigi, (D) r363 NASLEDNICA ŽIVO ×1 + need_static 4, (E) iskrena meja: .press-scale utility "
    "OSTANE (105 non-dual) + cva zamrznjena]; (4) **FEATURE ŠESTI STRAŽAR**: "
    "`r391-press-disciplina-generalizacija.test.ts` **×14 ZELENO** [(A) globalna kršitev = 0 čez VSE roksal tsx "
    "(>2000 elementov); (B) .press-scale:active bajtno; (C) it.each ×10 tarče; (D) števci 123 / ×43; (E) ui-kit cva "
    "bazi bajtno]; (5) e2e-lib dedup 23. val ISKRENO IZPUŠČEN (kanon R368). REGISTER `scripts/qa-needles/r391.tsv` "
    "[2 need_static **ŠIVNA** needleja — sekvenca čez odstranjeni press-scale žeton je NOVA: calculator L820 šiv "
    "duration-150→shrink-0 + inventory L1562 šiv tabular-nums→focus-visible; 0 v HEAD; ⭐ LEKCIJA R391 (4): needle "
    "MORA prečkati šiv — podspan starega spana je 'že v HEAD' (0-v-HEAD pravilno zavrnil); TODO-R391] prek "
    "`r391-register-write.py` fail-closed; naslednja era ≥184 [44. preverba r347–r390 ≥182 = 173 + 9 njihovih "
    "katalog needlejev — KOLIZIJA #25; 45. r347–r391 ≥184]. VERIFIKACIJA (celotna, FOREGROUND): tsc 0 · eslint 0 "
    "(FULL) · vitest **5727/5727 (379) FULL GREEN TEK 1** · build svež rm -rf .next EXIT=0 · qa-round.sh 391 needles "
    "EXIT=0 [r391.tsv 2 ŽIVO; UNION r340–r391 + veriga r339→…→R227] · smoke EXIT=0 · e2e EXIT=0 [ODTIS BAJTNATO "
    "IDENTIČEN — ZERO-MUTACIJA] · r391-era-harvest EXIT=0 ×2 [43rd — 173/173] · r391-window-scan EXIT=0 [14. gen; "
    "REG_DO 391] · r359-prod-qa-retry 389 ZELEN poskus 1 · leak-check čist [ghp_ ×0]. NOVO: "
    "scripts/qa-needles/r391.tsv + skripte [r391-era-harvest.sh (43rd) + r391-era-ruta-map.py, r391-qa-spot.sh, "
    "r391-triaza.py, r391-pinscan.py, r391-val68-apply.py, r391-window-scan.py (14. gen), r391-register-write.py, "
    "r391-readme-update.py, r391-worklog-append.py, r391-kolizija-rename.py] + r391-stil-val68.test.ts [×5] + "
    "r391-press-disciplina-generalizacija.test.ts [×14 — FEATURE]; UREJENO: 6 render datotek [val 68 REPL ×10 — 0 "
    "novih vrstic], 5 testnih datotek [EVOLVED], r363.tsv [NASLEDNICA-3], era-clone.py [idempotenca + KeyError + "
    "POST checks], README. Kontrakt NIČ (/api/sync — probe je samo fail-closed 401 branje); SDK/BOM/pricing/geometry "
    "core NIČ; measurement jedro NIČ [val 68 = render plast className-only]; OgrajaVizija nič; 0 novih hex; NIČ "
    "novih FNV soli; brez sheme s strani QA [ZERO-MUTACIJA E2E; njihova shema = njihova poslovna odločitev]. ⏰ "
    "roksal-fallback-db POTEČE 2026-10-25 (~3 tedne) — obvestiti lastnika (84. zapis). ⚠️ žetona (GitHub + Vercel) "
    "uporabljena — priporočena ROTACIJA. R392 prva naloga = qa-round.sh 391 prod-qa re-run [prek "
    "r359-prod-qa-retry.sh 391] + štiriinštirideseta era preverba r347–r390 [44 registrov, ≥182 = 173 + 9 njihovih "
    "katalog needlejev; era-clone.py --src-round 390 --expected-total 182 + VSEH 12 spec-ov IZRECNO; ERA_BESODE 44 "
    "ŠTIRIDESIJNA ŽE v mapi] + val 68 POST-deploy verifikacija [2 šivna needleja r391.tsv; mounted + className "
    "LOČENO; ZERO-MUTACIJA]. R392 kandidati: 1. stil: disabled: družina triaža [semantika vs pariteta "
    "element-točno; brez paradigme iskren zaklep]; 2. stil: active:scale heterogenost po velikostnih razredih "
    "[samo z objektivnim kriterijem]; 3. e2e-lib dedup 23. val [po kanonu]. ⭐ LEKCIJE R391: (1) orodje MORA "
    "klonirati svoj lastni izhod — idempotenca + f-string/.format konkatenacija past; (2) junk koren datoteke = "
    "tsconfig lažni pozitiv — po abortu preveri git status PRED ponovnim tekom; (3) SVG className = "
    "SVGAnimatedString — getAttribute('class'); (4) needle MORA prečkati šiv — podspan = 'že v HEAD'; (5) "
    "multi-target apply = akumulacija v EN pomik + idempotentni preskoki; (6) **KOLIZIJA rebase: --theirs/--ours "
    "sta OBRNJENA** (v rebase je 'ours' = upstream/njihovo, 'theirs' = tvoj commit) — po rebase preveri, da so "
    "NJIHOVI artefakti (r390.tsv ×9, README bullet, worklog vnos) res na disku. ISSUE #1: vsa sprejemna merila ✓; "
    "ostaja odprt, owner 'Razvoj > QA' [AGENT STARTUP RULE: razvoj > QA]."
)

def main():
    t = README.read_text(encoding="utf-8")
    if "** (R391;" in t:
        sys.exit("FAILOVEDANO: R391 bullet ŽE obstaja (idempotenca)")
    if t.count(STARA) != 1:
        sys.exit(f"FAILOVEDANO: števec = {t.count(STARA)} (pričakovano 1 — njihova 5708/377 baza)")
    vrstice = t.split("\n")
    idx = [i for i, l in enumerate(vrstice) if l.startswith(ANCHOR)]
    if len(idx) != 1:
        sys.exit(f"FAILOVEDANO: R390 bullet anchor = {len(idx)} (pričakovano 1)")
    t = t.replace(STARA, NOVA, 1)
    vrstice = t.split("\n")
    idx = [i for i, l in enumerate(vrstice) if l.startswith(ANCHOR)]
    vrstice.insert(idx[0], R391_BULLET)
    t = "\n".join(vrstice)
    # POST
    if NOVA not in t or STARA in t:
        sys.exit("FAILOVEDANO: števec NI posodobljen")
    if t.count("** (R391;") != 1 or "PRODUKTNI KATALOG" not in t:
        sys.exit("FAILOVEDANO: bullet stanje neveljavno")
    README.write_text(t, encoding="utf-8")
    print(f"OK: README R391 sloj ({len(t)} bajtov)")

if __name__ == "__main__":
    main()
