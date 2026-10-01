// ---------------------------------------------------------------------------
// R334 — 61. člen issue #1 (IZVOZI družina): izvoz poročila končne
// verifikacije kot DETERMINISTIČNI CSV (Deliverable 7 kot prenosljiv
// artifact — tabela iz R315 na zaslonu, zdaj tudi v pisarniškem orodju).
// CSV brat JSON izvoza R316 + PDF brata R320 (vzorec R317 audit-csv:
// ČISTA projekcija EN VIR resnic — ta modul NOSI NIČ nove resnice).
//
// EN VIR resnice (NIČ podvojenih pravil):
//  • resnica = koncnaVerifikacija (UVOŽENA iz brata R315 — ISTA validacija
//    fail-closed brezplačno: audit/dokazi/kriteriji/plasti; NIČ podvojenih
//    pravil; vrstni red vrstic = ISTI vrstni red kot audit);
//  • glavi = KONCNA_CSV_GLAVE_OBMOCJA + KONCNA_CSV_GLAVE_KRITERIJI —
//    VERBATIM PDF autoTable head T1/T2 (R320) — stolpci CSV in PDF NE
//    moreta divergirati po konstrukciji (testi pinajo glavi PROTI PDF
//    VIRU — anti-divergenca, vzorec R330/R331/R332);
//  • celice = ISTI izpisi kot PDF autoTable body: razred prikazno,
//    plasti pipe-joined (' | ' — podpičje je ločilo, cev je varna,
//    LEKCIJA R317), opomba dokaza verbatim; kriterij/izpeljava/dokaz
//    verbatim;
//  • meta KPI ×4 = ISTI izpisi kot PDF kpiBox (Območij / Z dokazi /
//    Kriterijev / AI-OBVEZNO — IZRAČUNANI iz kv, NIČ trdo kodiranih);
//  • sklep = kv.sklep (UVOŽEN — ISTI niz kot zaslon + JSON meta + PDF
//    sklepna vrstica + testi + docs; ŠESTI potrošnik ENEGA niza).
//
// Format = kanon R136 toCsv (BOM + podpičje + CRLF + RFC 4180 citiranje —
// opombe/kriteriji z vejicami/podpičji so varno citirani; vzorec R317
// audit-csv — ISTA vodja družina). DVE tabeli v ENEM dokumentu: blok A
// (dokazne plasti po območjih) + prazna ločilna vrstica + blok B
// (sprejemni kriteriji) + prazna ločilna vrstica + meta povzetek —
// preglednost v Excelu (vzorec meta kanona R172→R296).
//
// Determinizem (kanon 46./47./49. člen — 'isti HEAD = bajtno identična
// datoteka'): BREZ metapodatkov časa/hash (NIČ 'Izvoženo ob' — čas bi
// uničil determinizem; brat JSON R316 + PDF R320 nosita ISTI kanon).
// Veza na HEAD je implicitna — drevo je byte-določeno s HEAD.
//
// Fail-closed: gradnja gre PREK EN VIR graditelja koncnaVerifikacija —
// ne-polje / prazen audit / pokvaren dokazi / kriteriji brez izpeljave
// → TypeError z imenom graditelja (kanon R299/R302/R306 — niz preživi
// minifikacijo). Zip po indeksu z IZRECNO usklajenostno asercijo (vzorec
// PDF brata R320 / CSV brata R317): vrstici si delata ISTI vrstni red
// (nič prerazporejanja). Obrnjena regresija: CSV funkcij NI v bratu
// koncna-verifikacija libu (cikel in duplikat tiran — ena definicija,
// EN lib; LEKCIJA R318 1).
// ---------------------------------------------------------------------------

import {
  koncnaVerifikacija,
  DOKAZI_AUDITA,
  SPREJEMNI_KRITERIJI,
  type KoncnaVerifikacijaVrstica,
  type SprejemniKriterij,
  type DokazVezava,
} from './koncna-verifikacija'
import type { VrstaAudita } from './avtomatizacija-audit'
import { AVTOMATIZACIJA_AUDIT } from './avtomatizacija-audit'
import { toCsv, type CsvValue } from './csv-export'

/** Glava bloka A — dokazne plasti po območjih (VERBATIM PDF autoTable
 *  head T1 R320 — anti-divergenca po konstrukciji, testi pinajo vir). */
export const KONCNA_CSV_GLAVE_OBMOCJA = ['Območje', 'Razred', 'Plasti', 'Dokaz'] as const

/** Glava bloka B — sprejemni kriteriji (VERBATIM PDF autoTable head T2
 *  R320 — anti-divergenca po konstrukciji, testi pinajo vir). */
export const KONCNA_CSV_GLAVE_KRITERIJI = ['Kriterij', 'Izpeljava', 'Dokaz'] as const

/** Iskren vir niz meta vrstice — vzorec AUDIT_VIR_NIZ R318 (ISTI kanon:
 *  brez časa/hash — determinizem kanon 46. člen). */
export const KONCNA_VIR_NIZ = 'Končna verifikacija — isti HEAD = bajtno identičen izvoz'

/** ENA vrstica bloka A (ISTI celici kot PDF autoTable body T1 R320):
 *  območje, razred prikazno, plasti pipe-joined, opomba dokaza verbatim. */
export function koncnaVerifikacijaCsvVrstica(v: KoncnaVerifikacijaVrstica): CsvValue[] {
  if (!v || typeof v !== 'object') {
    throw new TypeError('koncnaVerifikacijaCsvVrstica: pričakovana vrstica (KoncnaVerifikacijaVrstica)')
  }
  return [v.obmocje, v.razredPrikazno, v.plasti.join(' | '), v.opombaDokaza]
}

/** ENA vrstica bloka B (VERBATIM — ISTI nizi kot PDF autoTable body T2
 *  R320 + JSON kriteriji R316): kriterij, izpeljava, dokaz. */
export function koncnaVerifikacijaCsvKriterijVrstica(k: SprejemniKriterij): CsvValue[] {
  if (!k || typeof k !== 'object') {
    throw new TypeError('koncnaVerifikacijaCsvKriterijVrstica: pričakovan kriterij (SprejemniKriterij)')
  }
  return [k.kriterij, k.izpeljava, k.dokaz]
}

/**
 * Zgrodi deterministični CSV končne verifikacije. Privzeti vhodi = EN
 * VIR (parametrizirani SAMO za teste fail-closed poti — produkcija vedno
 * kliče brez argumenta; null NE undefined — lekcija R317 4). Vrstni red
 * vrstic = ISTI vrstni red kot audit (nič prerazporejanja — kanon).
 */
export function koncnaVerifikacijaCsv(
  audit: readonly VrstaAudita[] = AVTOMATIZACIJA_AUDIT,
  dokazi: Readonly<Record<string, DokazVezava>> = DOKAZI_AUDITA,
  kriteriji: readonly SprejemniKriterij[] = SPREJEMNI_KRITERIJI,
): string {
  // Validacija + WYSIWYG preslikava prek EN VIR graditelja (fail-closed
  // brezplačno — ISTA strogost kot na zaslonu, NIČ podvojenih pravil).
  const kv = koncnaVerifikacija(audit, dokazi, kriteriji)
  // Zip po indeksu z IZRECNO usklajenostno asercijo (vzorec PDF brata
  // R320 / CSV brata R317): vrstici si delata ISTI vrstni red.
  if (kv.vrstice.length !== audit.length) {
    throw new TypeError(
      'koncnaVerifikacijaCsv: notranja neskladja dolžin (resnica vs audit) — fail-closed',
    )
  }
  for (let i = 0; i < audit.length; i++) {
    const v = audit[i]
    const p = kv.vrstice[i]
    if (!p || !v || p.obmocje !== v.obmocje) {
      throw new TypeError(
        `koncnaVerifikacijaCsv: vrstica ${i} ni usklajena z auditom (${String(v?.obmocje)}) — fail-closed`,
      )
    }
  }
  // --- blok A: dokazne plasti po območjih (ISTA ravnina kot zaslon
  //     vrstice + JSON obmocja + PDF tabela 1) ---
  const podatkovne: CsvValue[][] = kv.vrstice.map((v) => koncnaVerifikacijaCsvVrstica(v))
  // --- blok B: sprejemni kriteriji (VERBATIM — ISTI nizi kot zaslon +
  //     JSON + PDF tabela 2) ---
  const kriterijiVrstice: CsvValue[][] = kv.kriteriji.map((k) => koncnaVerifikacijaCsvKriterijVrstica(k))
  // --- meta povzetek: KPI ×4 = ISTI izpisi kot PDF kpiBox (IZRAČUNANI
  //     iz kv — NIČ trdo kodiranih) + EN VIR sklep (ŠESTI potrošnik
  //     ENEGA niza) + vir niz. Brez 'Izvoženo ob' — čas bi uničil
  //     determinizem (isti HEAD = isti CSV; kanon 46./47. člen). ---
  const meta: CsvValue[][] = [
    [], // prazna ločilna vrstica med blokoma (preglednost v Excelu)
    [...KONCNA_CSV_GLAVE_KRITERIJI], // glava bloka B (kot vrstica — dva bloka v enem dokumentu)
    ...kriterijiVrstice,
    [], // prazna ločilna vrstica pred povzetkom (preglednost v Excelu)
    ['Območij', String(kv.stObmocij)],
    ['Z dokazi', String(kv.stObmocijZDokazi)],
    ['Kriterijev', String(kv.stKriterijev)],
    ['AI-OBVEZNO', String(kv.stAiObveznih)],
    ['Sklep', kv.sklep],
    ['Vir', KONCNA_VIR_NIZ],
  ]
  return toCsv([...KONCNA_CSV_GLAVE_OBMOCJA], [...podatkovne, ...meta])
}

/** Deterministično ime datoteke (brez datuma — veza na HEAD je implicitna;
 *  bratska simetrija z JSON R316 'koncna-verifikacija.json' + PDF R320
 *  'koncna-verifikacija.pdf' — vzorec koncnaVerifikacijaJson, 46. člen). */
export function koncnaVerifikacijaCsvFilename(): string {
  return 'koncna-verifikacija.csv'
}
