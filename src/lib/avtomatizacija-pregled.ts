// ---------------------------------------------------------------------------
// R314 — 44. člen issue #1 (Deliverable 4 NA ZASLONU): feature-by-feature
// audit tabela — vsako območje poslovanja (issue §1–§11) IZRECNO klasificirano
// (DETERMINISTICNO / SDK / SKRIPTA / AI_OPCIJSKO / AI_ZAHTEVANO) s
// KONKRETIMA potmi implementacije + dokaza in iskreno opombo.
//
// ČISTA projekcija EN VIR resnice (avtomatizacija-audit.ts:
// AVTOMATIZACIJA_AUDIT + RAZREDI) — NIČ nove resnice. WYSIWYG: prikazna
// imena, vrstice in sklep so verbatim iz tega modula — zaslon, testi in
// prihodnji izvozi berejo ISTE nize (vzorec ai-raba-pregled R311).
//
// Načela:
//  • 100 % determinizem: čista funkcija, nič ure, nič naključja — isti audit
//    = bajtno enak pregled.
//  • Fail-closed: ne-polje / prazen audit / prazno območje / neznani razred /
//    vrstica brez implementacije, dokaza ali opombe → TypeError z imenom
//    graditelja (kanon R299/R302/R306 — niz preživi minifikacijo,
//    identifikatorji ne). Tabela NE SME sanjati: strazar R294 dokazuje, da
//    vse poti DEJANSKO obstajajo na disku; ta modul dokazuje, da vsaka
//    vrstica NOSI poti.
//  • Sklep številčno iz EN VIR: števci so izračunani (nikoli trdo kodirani);
//    'AI-OBVEZNO: 0 — jedro deluje brez AI' drži, SAMO dokler je števec
//    resnično 0 — če se to spremeni, se spremeni tudi sklep (iskrenost).
// ---------------------------------------------------------------------------

import { AVTOMATIZACIJA_AUDIT, RAZREDI } from '@/lib/avtomatizacija-audit'
import type { RazredAudita, VrstaAudita } from '@/lib/avtomatizacija-audit'
import { toCsv, type CsvValue } from '@/lib/csv-export'

/** Prikazno ime razreda (WYSIWYG — verbatim iz tega modula). */
export const RAZRED_PRIKAZNO: Readonly<Record<RazredAudita, string>> = {
  DETERMINISTICNO: 'DETERMINISTIČNO',
  SDK: 'SDK',
  SKRIPTA: 'SKRIPTA',
  AI_OPCIJSKO: 'AI-OPCIJSKO',
  AI_ZAHTEVANO: 'AI-OBVEZNO',
}

/** Ena vrstica audit tabele (števec IZRAČUNANI iz EN VIR poti — ne trdo). */
export interface AvtomatizacijaVrstica {
  /** Območje iz issue #1 (§1–§11) — verbatim. */
  readonly obmocje: string
  /** Klasifikacija — verbatim iz audita. */
  readonly razred: RazredAudita
  /** Prikazno ime razreda (verbatim iz RAZRED_PRIKAZNO). */
  readonly razredPrikazno: string
  /** Število implementacijskih poti (izračunano). */
  readonly stImplementacij: number
  /** Število dokaznih poti (testi — izračunano). */
  readonly stDokazov: number
  /** Iskrena opomba — verbatim (nič lepega prepisovanja). */
  readonly opomba: string
}

/** Pregled audit tabele (44. člen — zaslon + testi + prihodnji izvozi). */
export interface AvtomatizacijaPregled {
  /** Vrstice po območjih (ISTI vrstni red kot audit — nič prerazporejanja). */
  readonly vrstice: readonly AvtomatizacijaVrstica[]
  /** Števci po razredu — vsi 5 razredov prisotni (0, če jih ni). */
  readonly poRazredu: Readonly<Record<RazredAudita, number>>
  readonly stObmocij: number
  /** EN VIR sklep WYSIWYG (številčno nevtralen, izračunani števci). */
  readonly sklep: string
}

/**
 * Zgrodi pregled audit tabele iz EN VIR audita. Privzeti vhod = EN VIR
 * (parametriziran SAMO za teste fail-closed poti — produkcija vedno kliče
 * brez argumenta).
 */
export function avtomatizacijaPregled(
  audit: readonly VrstaAudita[] = AVTOMATIZACIJA_AUDIT,
): AvtomatizacijaPregled {
  if (!Array.isArray(audit)) {
    throw new TypeError('avtomatizacijaPregled: pričakovan audit (seznam vrstic)')
  }
  if (audit.length === 0) {
    throw new TypeError('avtomatizacijaPregled: audit brez vrstic (tabela ne sme biti prazna — issue #1 §1–§11)')
  }
  const znaniRazredi = new Set<string>(RAZREDI)
  const vrstice: AvtomatizacijaVrstica[] = []
  const poRazredu = {
    DETERMINISTICNO: 0,
    SDK: 0,
    SKRIPTA: 0,
    AI_OPCIJSKO: 0,
    AI_ZAHTEVANO: 0,
  } as Record<RazredAudita, number>
  for (const v of audit) {
    if (typeof v.obmocje !== 'string' || v.obmocje.trim().length === 0) {
      throw new TypeError('avtomatizacijaPregled: vrstica brez območja (fail-closed)')
    }
    if (!znaniRazredi.has(v.razred)) {
      throw new TypeError(
        `avtomatizacijaPregled: vrstica ${v.obmocje} z NEZNANIM razredom ${String(v.razred)} (razredi: ${RAZREDI.join('/')})`,
      )
    }
    if (!Array.isArray(v.implementacija) || v.implementacija.length === 0) {
      throw new TypeError(
        `avtomatizacijaPregled: vrstica ${v.obmocje} brez implementacijskih poti (tabela ne sme sanjati)`,
      )
    }
    if (!Array.isArray(v.dokaz) || v.dokaz.length === 0) {
      throw new TypeError(
        `avtomatizacijaPregled: vrstica ${v.obmocje} brez dokaznih poti (vsak zahtevek rabi test)`,
      )
    }
    if (typeof v.opomba !== 'string' || v.opomba.trim().length === 0) {
      throw new TypeError(
        `avtomatizacijaPregled: vrstica ${v.obmocje} brez opombe (iskrena resnica je obvezna)`,
      )
    }
    vrstice.push({
      obmocje: v.obmocje,
      razred: v.razred,
      razredPrikazno: RAZRED_PRIKAZNO[v.razred],
      stImplementacij: v.implementacija.length,
      stDokazov: v.dokaz.length,
      opomba: v.opomba,
    })
    poRazredu[v.razred] += 1
  }
  const stObmocij = vrstice.length
  const sklep =
    `Audit območij: ${stObmocij} (§1–§11) · ` +
    `DETERMINISTIČNO: ${poRazredu.DETERMINISTICNO} · SDK: ${poRazredu.SDK} · ` +
    `SKRIPTA: ${poRazredu.SKRIPTA} · AI-OPCIJSKO: ${poRazredu.AI_OPCIJSKO} · ` +
    `AI-OBVEZNO: ${poRazredu.AI_ZAHTEVANO}` +
    (poRazredu.AI_ZAHTEVANO === 0
      ? ' — jedro deluje brez AI'
      : ' — vsako AI-obvezno območje zahteva izrecno utemeljitev')
  return { vrstice, poRazredu, stObmocij, sklep }
}

// ---------------------------------------------------------------------------
// 47. člen (issue #1 — IZVOZI družina): izvoz avtomatizacijskega audita kot
// DETERMINISTIČNI CSV (Deliverable 4 kot prenosljiv artifact — tabela iz
// R314 na zaslonu, zdaj tudi v pisarniškem orodju). ČISTA projekcija EN VIR
// resnic — AVTOMATIZACIJA_AUDIT je edini vir (zaslon + testi + docs + IZVOZ
// berejo isti niz; NIČ dvojnega sklepa). WYSIWYG: razred = prikazno ime iz
// RAZRED_PRIKAZNO; opomba verbatim. Brez metapodatkov časa/hash (isti HEAD
// → bajtno identična datoteka — kanon koncnaVerifikacijaJson, 46. člen).
// Format: kanon R136 toCsv (BOM + podpičje + CRLF + RFC 4180 citiranje —
// opombe z vejicami/narekovaji so varno citirane). Poti implementacije in
// dokaza združene z ' | ' (podpičje je ločilo — cev je varna, bralna).
// Fail-closed: gradnja gre PREK avtomatizacijaPregled (validacija območij/
// razredov/poti/opomb) — pokvarjen audit ne more postati lažno poročilo;
// propagira TypeError z imenom graditelja (kanon R299/R302/R306).
// ---------------------------------------------------------------------------

/** Glave CSV (WYSIWYG — ISTI niz kot prikazna tabela na vodji).
 *  🆕 R318 (48. člen): IZVOŽEN iz modula — PDF brat (avtomatizacija-audit-pdf)
 *  uvaža ISTI niz → stolpci PDF in CSV NE moreta divergirati po konstrukciji
 *  (vzorec KONFLIKTI_CSV_GLAVA R302: glava EN VIR za celo izvozno družino). */
export const AUDIT_CSV_GLAVE: readonly string[] = [
  'Območje',
  'Razred',
  'Implementacije',
  'Dokazi (testi)',
  'Opomba',
]

/** 🆕 R318 (48. člen): iskren vir niz meta vrstice — EN VIR za OBE meta vrstici
 *  (CSV 'Vir;…' + PDF sklepno vrstico): zaslon, testi, CSV in PDF berejo ISTI
 *  niz (NIČ dvojnega vira). Brez časa/hash — determinizem kanon 46. člen. */
export const AUDIT_VIR_NIZ = 'AVTOMATIZACIJA_AUDIT — isti HEAD = bajtno identičen izvoz'

/**
 * Zgrodi deterministični CSV avtomatizacijskega audita. Privzeti vhod = EN
 * VIR (parametriziran SAMO za teste fail-closed poti — produkcija vedno
 * kliče brez argumenta). Vrstni red vrstic = ISTI vrstni red kot audit
 * (nič prerazporejanja — kanon pregleda).
 */
export function avtomatizacijaAuditCsv(
  audit: readonly VrstaAudita[] = AVTOMATIZACIJA_AUDIT,
): string {
  // Validacija + WYSIWYG preslikava prek EN VIR graditelja (fail-closed
  // brezplačno — ista strogost kot na zaslonu, NIČ podvojenih pravil).
  const pregled = avtomatizacijaPregled(audit)
  // Zip po indeksu: pregled.vrstice ohranja ISTI vrstni red kot audit
  // (dokumentirano v AvtomatizacijaPregled — 'nič prerazporejanja'); poti
  // živijo v auditu, prikazna resnica v pregledu — skupaj = ena vrstica.
  if (pregled.vrstice.length !== audit.length) {
    throw new TypeError(
      'avtomatizacijaAuditCsv: notranja neskladja dolžin (pregled vs audit) — fail-closed',
    )
  }
  const podatkovne: CsvValue[][] = audit.map((v, i) => {
    const p = pregled.vrstice[i]
    if (!p || p.obmocje !== v.obmocje) {
      throw new TypeError(
        `avtomatizacijaAuditCsv: vrstica ${i} ni usklajena z auditom (${String(v?.obmocje)}) — fail-closed`,
      )
    }
    return [
      p.obmocje,
      p.razredPrikazno,
      v.implementacija.join(' | '),
      v.dokaz.join(' | '),
      p.opomba,
    ]
  })
  // Povzetek: EN VIR sklep (isti niz kot na zaslonu — NIČ dvojnega sklepa).
  // Brez 'Izvoženo ob' — čas bi uničil determinizem (isti HEAD = isti CSV).
  const meta: CsvValue[][] = [
    [], // prazna ločilna vrstica pred povzetkom (preglednost v Excelu)
    ['Sklep', pregled.sklep],
    // R318 (48. člen): vir niz = izvožena konstanta AUDIT_VIR_NIZ (EN VIR —
    // PDF brat nosi ISTI niz; izpis bajtno nespremenjen — testi R317 to pinesejo)
    ['Vir', AUDIT_VIR_NIZ],
  ]
  return toCsv([...AUDIT_CSV_GLAVE], [...podatkovne, ...meta])
}

/** Deterministično ime datoteke (brez datuma — veza na HEAD je implicitna;
 *  vzorec koncna-verifikacija.json, 46. člen). */
export function avtomatizacijaAuditCsvFilename(): string {
  return 'avtomatizacija-audit.csv'
}
