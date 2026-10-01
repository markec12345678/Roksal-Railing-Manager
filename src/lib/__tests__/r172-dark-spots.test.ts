// R172 — dark-spot regresijski stražar: 18 popravljenih svetlih žetonov
// (nove barvne družine v r168-dark-scan.py: bg-barvni-svetli, border-barvni,
// text-barvni-temni) MORA imeti dark: ogledalo NA ISTI VRSTICI (nauček
// R165/R167: scopa samo vrstica; celoten surovec vsebuje namerne žetone).
// Vzorec r170 javne strani it.each + idempotentnost pregleda.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const vrstice = (rel: string): string[] =>
  readFileSync(join(root, rel), 'utf8').split('\n')

/** Vrstica (1-based) mora vsebovati SVETLI žeton IN njegovo dark: ogledalo. */
const stražar = (rel: string, st: number, svetli: string, dark: string) => ({
  rel,
  st,
  svetli,
  dark,
  vrsta: () => vrstice(rel)[st - 1],
})

const PRIMERI = [
  // portal/[token]/page.tsx — STATUS_CONFIG (bg/ring/text) + monter notes + 404
  // R180: vrstice +34 (glavni komentar+uvozi +7, osvezitevCas +9, banner +5,
  // pečat +13) — vsa ogledala ŠE VEDNO obstojijo na ISTI vrstici (precedens
  // R179 '+3': pomaknejo se samo številke, ni regresija).
  stražar('src/app/portal/[token]/page.tsx', 59, 'bg-amber-50', 'dark:bg-amber-950/40'),
  stražar('src/app/portal/[token]/page.tsx', 61, 'ring-amber-200', 'dark:ring-amber-800'),
  stražar('src/app/portal/[token]/page.tsx', 66, 'bg-blue-50', 'dark:bg-blue-950/40'),
  stražar('src/app/portal/[token]/page.tsx', 67, 'text-blue-700', 'dark:text-blue-300'),
  stražar('src/app/portal/[token]/page.tsx', 68, 'ring-blue-200', 'dark:ring-blue-800'),
  stražar('src/app/portal/[token]/page.tsx', 73, 'bg-green-50', 'dark:bg-green-950/40'),
  stražar('src/app/portal/[token]/page.tsx', 75, 'ring-green-200', 'dark:ring-green-800'),
  stražar('src/app/portal/[token]/page.tsx', 80, 'bg-red-50', 'dark:bg-red-950/40'),
  stražar('src/app/portal/[token]/page.tsx', 82, 'ring-red-200', 'dark:ring-red-800'),
  stražar('src/app/portal/[token]/page.tsx', 377, 'bg-amber-50', 'dark:bg-amber-950/40'), // R180: vrstica +34
  stražar('src/app/portal/[token]/page.tsx', 511, 'bg-red-50', 'dark:bg-red-950/40'), // R180: vrstica +34
  // portal/[token]/gallery.tsx — PRED/MED/PO značke
  stražar('src/app/portal/[token]/gallery.tsx', 193, 'bg-amber-100', 'dark:bg-amber-500/15'),
  stražar('src/app/portal/[token]/gallery.tsx', 194, 'bg-blue-100', 'dark:bg-blue-500/15'),
  stražar('src/app/portal/[token]/gallery.tsx', 195, 'bg-green-100', 'dark:bg-green-500/15'),
  // calculator-tab — estrih opozorilni Card (obe mesti)
  // R295: 2343→2344, 3802→3803 (komponentna deterministična migracija:
  // +1 vrstica csv-export import — slDatumKratko/slCasDolgo/… EN VIR;
  // precedens R180/R203/R229/R294).
  // R314 PIN SHIFT (izrecno, precedens R309 invoice-manager / R311 r164):
  // obe estrih kartici sta harmonizirani na roksal žetone
  // (border-roksal-amber/40 bg-roksal-amber/10) — žeton je temsko
  // prilagodljiv PO NARAVI, zato raw svetli+dark: par tam ZAKONITO ne
  // obstaja več; vsak raw par, ki bi se vrnil, je regresija (obrnjena
  // regresija v lastnem it() spodaj).
  // material-intelligence-tab — NAJBOLJŠI ponudnik
  // R182: vrstica +65 (uvozi+stanja+fail-verbose loadData +47, pečat+warning
  // vrstica +18) — ogledalo ŠE VEDNO na ISTI vrstici (precedens R180 '+34').
  // R203: 394→403 (fail-verbose handleCreateSupplier/handleAddPrice +9).
  // R206: 403→446 (iskren prehod POSLANO + gumb naročilnice iz naročila +43).
  // R207: 446→491 (chipCls + dialog prejema + alreadyReceived toasti +45).
  // R208: 491→524 (XCircle uvoz + cancel stanja + izpeljanke preklica/števec
  // + PREKlicANO naslovi/description + F2 badge na zavihku +33).
  // R209: 524→602 (ZgodovinaVnos + akcijaOznaka/statusZnackaCls pomožnika
  // + zgodovina stanja + prinesi/odpri + gumb/timeline na kartici +78).
  // R213: 602→624 (tip-only uvoz material-sub-tab +3, initialSubTab prop
  // podpis +8, subTab namig effect +11; aria-pressed/Prikaži Vse za ogledalom).
  // R229: 624→637 (uvozi jeZamujenaDobava+BadgeZamujenaDobava +4, danasZamude
  // useMemo +9; ogledalo ŠE VEDNO na ISTI vsebinski vrstici — precedens R180).
  // R231: 637→647 (downloadOrdersCsv R231 komentar +8 + stolpec 'Pretekel rok'
  // +1, handler komentar +1; ogledalo ŠE VEDNO na ISTI vsebinski vrstici).
  // R232: 647→655 (handleOrdersCsv R232 komentar +4 + fail-closed veji +4;
  // ogledalo ŠE VEDNO na ISTI vsebinski vrstici — precedens R180/R229).
  // R233: 655→698 (downloadSuppliersCsv +28 (vključno String števci komentar
  // +3) + handleSuppliersCsv +9 + komentar +6; ogledalo ŠE VEDNO na ISTI
  // vsebinski vrstici — precedens R180/R229/R232).
  // R234: 698→700 (statusZnackaCls nevtralna veja → žetoni +2 komentar;
  // ogledalo ŠE VEDNO na ISTI vsebinski vrstici — precedens R180/R229/R232).
  // R235: 700→733 (uvoz narocilnica-pdf +7, FileText +1, handler
  // prenesiNarocilnicoPdf +25; ogledalo ŠE VEDNO na ISTI vsebinski vrstici).
  // R236: 733→772 (uvoz dobavitelji-pdf +8, handler handleSuppliersPdf +33,
  // CSV+PDF pill brata +12, Prejem fokus navy/40 ±0; ogledalo ŠE VEDNO na
  // ISTI vsebinski vrstici — precedens R180/R229/R232). Prejem gumb ( isti
  // žeton, druga vsebinska vrstica) ostaja ne-pinana (r234 lekcija 3:
  // istovrstni žetoni na več vrsticah — pin vedno preverjen proti HEAD vsebini).
  stražar('src/components/roksal/material-intelligence-tab.tsx', 1699, 'bg-green-50', 'dark:bg-green-950/40'), // R242: 772→1119; R243: 1119→1131 (wave 5 +12); R244: 1131→1266 (cenik izvoz +135); R245: 1266→1402 (primerjalni cenik +136); R246: 1402→1438 (razponska dimenzija +36: PrimerjalniVrsta +4, CSV 8 stolpcev +7, pridobiPrimerjalni izpeljava +23, primerjalniVnosi najvisjaCena +2); R247: 1438→1442 (% razlika +4: import +1, CSV komentar +2, CSV celica +1 — ogledalo ŠE VEDNO na ISTI vsebinski vrstici, Dobljeno/Prejem gumb); R248: 1442→1445 (povprečni razpon +3: import +1, toast komentar +2 — ogledalo ŠE VEDNO na ISTI vsebinski vrstici, Dobljeno/Prejem gumb); R249: 1445→1449 (največji razpon +4: import +1, toast komentar +3 — ogledalo ŠE VEDNO na ISTI vsebinski vrstici, Dobljeno/Prejem gumb); R257: 1449→1405 (import naročila-pregled +11, handler +44, pill+legenda +30 — ogledalo ŠE VEDNO na ISTI vsebinski vrstici, DOBLJENO značka); R259: 1405→1410 (import rokPovzetek +1, handler komentar +3, const roki +1 — ogledalo ŠE VEDNO na ISTI vsebinski vrstici, DOBLJENO značka); R260: 1410→1435 (import segmentacija +2, CSV nadgradna +11 (komentar R260 +4, seg celici +2, glava +3, podpis +2), handler seg+toast+try +12 — ogledalo ŠE VEDNO na ISTI vsebinski vrstici, DOBLJENO značka); R262: 1435→1553 (import zaloga-osnutek +15, MaterialOrder inventoryId +3, memo vhodi+povzetek+state +19, handler pokritost +50, pill+legenda+mini-vrstica +31 — ogledalo ŠE VEDNO na ISTI vsebinski vrstici, DOBLJENO značka); R264: 1553→1648 (+95: import dobavitelji-pozicija +10, import ponudbaBeseda +1, pridobiPozicijo + handler pozicija +84 — ogledalo ŠE VEDNO na ISTI vsebinski vrstici, DOBLJENO značka); R333: 1648→1699 (+51: import dobavitelji-pozicija-csv +9, import FileSpreadsheet +1, pozicijaCsvVTeku state +3, handlePozicijaCsv +38 — ogledalo ŠE VEDNO na ISTI vsebinski vrstici, DOBLJENO značka)
  // roksal-catalog — steklo tint (vzorec Inox fix R171)
  // R203: 193→228 (fail-verbose fetchProfili + trojna veja +35).
  // R229: 228→232 (Inox chip žetoni komentar +3 — precedens R180/R203).
  // R234: 232→234 (MATERIAL_BADGE fallback → žetoni +2 komentar).
  stražar('src/components/roksal/roksal-catalog.tsx', 234, 'bg-cyan-200/40', 'dark:bg-cyan-500/20'),
  // site-survey-tab — estrih Card + opravljeno opravilo
  // R294: 625→626, 873→874 (prekinjena inkarnacija r294: +1 vrstica 'now: new Date(),'
  // pri generateSurveyPdf klicu :411 — now KOT parameter, issue #1 determinizem;
  // precedens R180/R203/R229 — pinane številke vrstic sledijo vsebinskim vrsticam).
  // R315 PIN SHIFT (izrecno, precedens R314 calculator estrih / R309 invoice-manager):
  // estrih kartica (vrstica 626) je harmonizirana na roksal žetone
  // (border-roksal-amber/40 bg-roksal-amber/10) — žeton je temsko prilagodljiv
  // PO NARAVI, zato raw svetli+dark: par tam ZAKONITO ne obstaja več; vsak raw
  // par, ki bi se vrnil, je regresija (obrnjena regresija v lastnem it() spodaj).
  // POZOR: surovi amber vrstici 641 (PODLAGA kategorija barv p.barva —
  // rdeč brat v isti ternari) sta ZAKLENJENI semantični kategoriji
  // (R308/R311 lekcija) — zaklenjeni v r315-stil-val6 STRAŽARju.
  stražar('src/components/roksal/site-survey-tab.tsx', 874, 'bg-green-50', 'dark:bg-green-950/40'),
  // measurements-tab — AR snapshot hover obroba
  // (R183: +51 vrstic — loadAll refactor + pečat meritveOsvezitev + glavna
  // flex-wrap vrstica; ogledalo na ISTI vsebinski vrstici, precedens R180/R182.
  // R186: +37 vrstic — uvoz izvoza CSV + handler izvoziMeritveCsv + gumb CSV;
  // ogledalo na ISTI vsebinski vrstici, precedens R180/R182/R183)
  // measurements-tab — AR snapshot hover obroba
  stražar('src/components/roksal/measurements-tab.tsx', 6209, 'hover:border-cyan-300', 'dark:hover:border-cyan-700'), // R201: 6452→6510; R203: 6510→6556 (povzetek gumb + handler +46); R234: 6556→6559 (statusColors + filtri čipi nevtralne veje → žetoni +3); R235: 6559→6561 (status števca UI površine gray → žetoni +2); R239: 6561→6565 (vodič korak 1 vlogo-nevtralna resnica + komentar +4); R269: 6565→6755 (teren PDF: lib import +5, FileDown +2, pdfVteku +2, memo terenPovzetek +22, handleTerenPdf +102, pill +22, legenda+mini +35 → +190); R274: 6755→6756 (role="status" a11y komentar +1 nad teren mini); R276: 6756→7082 (verzije: lib import +2, tip+state +34, handlerji +62, submit +22, pill/vir +40, gumba +44, panel +84, pas +36 → +326); R277: 7082→7093 (teren PDF DTO: verzija+vir preverba +9, map +2 → +11); R278: 7093→7102 (vir pill title ×3 + cursor-help +9); R279: 7102→7106 (segmentId Badge title + cursor-help +4); R280: 7106→7126 (tipMeritveTitles map +15, tip badge cursor-help + title +1, kot badge title format +4 → +20); R281: 7126→7198 (ArSyncMeta + sync polji v vmesnikih + normalize +5, sync žig labels/titles/colors map +29, žig render +21 → +72); R282: 7198→7246 (syncPregled memo +18, sync mini-vrstica + akcijski žig +30 → +48); R283: 7246→7294 (virPregled import +2, memo +11, R269 mini hover parity +13, vir mini-vrstica +22 → +48); R284: 7294→7446 (zapisni list: lib uvoz +1, zapisniVteku stanje +2, handleZapisniListPdf +125, ZAPISNI LIST pill +23, bulk toggle title +1, legenda dopolnjena 1:1 → +152); R285: 7446→7595 (zapisni list CSV: lib uvoz +1, zapisniCsvVteku stanje +2, handleZapisniListCsv +121, ZAPISNI LIST CSV pill +26, legenda dopolnjena 1:1 → +149); R295: 7595→7596 (prekinjena inkarnacija r295: komponentna deterministična migracija — slDatumKratko/slCasDolgo import +1); R319: 7596→7427 (dekomp. faza 1: 6 komponent + shared tipi izluščeni v measurements/ mapo + osiroteli uvozi odstranjeni → −1.169 vrstic nad prstom); R325: 7427→6976 (dekomp. faza 2: laserski BT blok — Web Bluetooth tipi/konstante/pomožne v laser-bt.ts, stanje+GATT povezava+reconnect v use-laser.ts, UI v laser-panel.tsx + template localStorage blok v templates.ts → −451 vrstic nad prstom); R338: 6976→6632 (dekomp. faza 3: zbirke oznak/barv/ikon v labels.ts + parse/format pomožne + ArMetadata/AuditEntry/GroundType tipi v format.ts/labels.ts + osiroteli ikonski uvozi odstranjeni → −381 vrstic premik +40 uvozni blok R338 −3 ikonske vrstice −1 komentar → −344 nad prstom); R339: 6632→6640 (STIL val 25: revizijska sled badge dobi title EN VIR auditActionTitles + cursor-help + komentar +7 vrstic nad prstom); R340: 6640→6525 (dekomp. faza 4 [KOLIZIJA #14 — vzporedni R339 odštel izhodišče]: normalizeMeasurements −49 + getQuickSpacing −10 v measurements/normalize.ts + renderRailingDiagram −71 v measurements/railing-diagram.tsx + uvozni blok R340 +8 −1 osiroteli parseArMetadata −1 podvojen komentar → −115 nad prstom); R348: 6525→6475 (FAZA 5: EN VIR measurements/izvoz-csv — 4 stale CSV telesa pod prstom izginila, uvozi +4 + val 31 a11y gumbi +9 → net −50); R349: 6475→6271 (FAZA 6: EN VIR measurements/teren-vnosi — 3 stale fetch+prune telesa (R269/R284/R285) pod prstom izginila −218, FAZA 6 uvozi +4, val 32 a11y gumbi +2×4 +1 +1 → net −204); R350: 6271→6209 (FAZA 7: EN VIR izvoz-csv razširitev — steber + zgodovina vrstična gradnika pod prstom izginila −29 [csvEsc ×5 + header ×2 + roke ×2 ×10 vrstic], NOV pdf-seznam import +4 [85-vrstični inline PDF blok NAD prstom — ne vpliva], val 33 a11y gumbi +2×4 [2 vrstici na gumb ×4] → net −62)
]

describe('R172 dark-spot stražar — vsak svetli barvni žeton ima dark: ogledalo na ISTI vrstici', () => {
  it.each(PRIMERI)('$rel:$st [$svetli → $dark]', ({ rel, st, svetli, dark, vrsta }) => {
    const v = vrsta()
    expect(v, `vrstica ${rel}:${st} naj vsebuje svetli žeton ${svetli}`).toContain(svetli)
    expect(v, `vrstica ${rel}:${st} naj vsebuje dark: ogledalo ${dark}`).toContain(dark)
  })

  it('pregled idempotenten: r168-dark-scan.py (razširjen ×23 družin) poroča NIČ kandidatov', () => {
    // Rustična stražar preverba brez odvisnosti od Pythona: kanditati vzorci
    // treh NOVIH družin, kjer je bil popravek, ne smejo več obstajati brez
    // dark: ogledala (scan sam se poganja v CI ročno — ta test je hitri stražar).
    const sveže = [
      ...vrstice('src/app/portal/[token]/page.tsx'),
      ...vrstice('src/app/portal/[token]/gallery.tsx'),
    ].filter((v) => /bg-(amber|blue|green|red)-(50|100)\b/.test(v) && !v.trim().startsWith('*'))
    for (const v of sveže) {
      expect(v, `svetli bg brez dark: ogledala: ${v.trim()}`).toMatch(/dark:(?:[\w-]+:)*bg-/)
    }
  })

  it('R314 obrnjena regresija: calculator-tab estrih kartici sta na roksal žetonih — raw svetli+dark par se NE sme vrniti', () => {
    const src = vrstice('src/components/roksal/calculator-tab.tsx').join('\n')
    // žetoni živi (obe mesti)
    expect(src.match(/'border-roksal-amber\/40 bg-roksal-amber\/10'/g)?.length).toBe(2)
    // obrnjena regresija: surovi estrih par (bg-amber-50/60 + dark:bg-amber-950/40) prepovedan
    expect(src).not.toContain('bg-amber-50/60')
    expect(src).not.toContain('dark:bg-amber-950/40')
  })

  it('R315 obrnjena regresija: site-survey estrih kartica je na roksal žetonih — raw svetli+dark par se NE sme vrniti', () => {
    const src = vrstice('src/components/roksal/site-survey-tab.tsx').join('\n')
    // žetoni živi (estrih Card 626 + warn orodje element 964 — isti vzorec)
    expect(src.match(/'border-roksal-amber\/40 bg-roksal-amber\/10'/g)?.length).toBe(2)
    // obrnjena regresija: surovi estrih par (bg-amber-50/40 + dark:bg-amber-950/40) prepovedan
    expect(src).not.toContain('bg-amber-50/40')
    expect(src).not.toContain('dark:bg-amber-950/40')
  })
})
