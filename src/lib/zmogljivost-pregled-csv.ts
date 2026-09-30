// ---------------------------------------------------------------------------
// R323 — 51. člen issue #1 (IZVOZI družina): izvoz meritev zmogljivosti kot
// DETERMINISTIČNI CSV (Deliverable 6 kot prenosljiv artifact — tabela iz
// vodje zmogljivost-dokaz bloka, zdaj tudi v pisarniškem orodju; družinska
// simetrija kanon: Deliverable 4 = CSV+PDF [R317/R318], Deliverable 7 =
// JSON+PDF [R316/R320], Deliverable 6 = PDF [R321] + CSV [R322]).
//
// CSV brat zaslona R312 in PDF brata R321 (vzorec R317 audit-csv: LOČEN
// brat, NO jsPDF teža — CSV je lahek, brat merilni lib se NE obremeni).
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE ali
// posredovane):
//  • resnica = ZmogljivostPregled (posredovan OD poklicatelja — meritev se
//    izvede ENKRAT v brskalniku, R312 kontrakt 'izris šele v brskalniku';
//    CSV je ČISTA projekcija že izmerjene resnice, NIKOLI ne meri znova —
//    drugi tek bi izkazal druge čase in lažno dvojno resnico, kanon R321);
//  • sklep = pregled.sklep VERBATIM (ČETRTI potrošnik ENEGA niza — zaslon
//    zmogljivost-sklep + testi + PDF R321 + CSV R322; NIČ dvojnega sklepa);
//  • časi prikazno = formatirajMs (UVOŽEN iz brata — ISTI izraz kot zaslon
//    vrstice IN PDF tabela; zaslon, PDF in CSV ne moreta divergirati po
//    konstrukciji, vzorec AUDIT_CSV_GLAVE R317);
//  • glave = ZMOGLJIVOST_IZVOZ_GLAVE (UVOŽENE iz brata R322 — PDF brat R321
//    nosi ISTI niz → stolpci CSV/PDF NE moreta divergirati po konstrukciji);
//  • validacija = preveriZmogljivostPregledZaIzvoz (UVOŽENA iz brata — EN
//    VIR fail-closed pravila ×7 skupin; sporočila verbatim, kje =
//    'buildZmogljivostCsv').
//
// Format: kanon R136 toCsv (BOM + podpičje + CRLF + RFC 4180 citiranje —
// opisi/sklepi z vejicami/narekovaji so varno citirani). Meta vrstice:
// prazna ločilna + 'Sklep' (EN VIR) + 'Vir' (ZMOGLJIVOST_VIR_NIZ — vzorec
// AUDIT_VIR_NIZ R318). Brez metapodatkov časa/hash (isti HEAD → bajtno
// identična datoteka — determinizem kanon 46.–50. člen).
//
// Obrnjena regresija: CSV funkcij NI v merilnem bratu (cikel in duplikat
// tiran — ena definicija, EN lib; r318 lekcija 1) IN NI v PDF bratu (jsPDF
// teža NE kaže v CSV smer; vsak format = svoj lib).
// ---------------------------------------------------------------------------

import { toCsv } from '@/lib/csv-export'
import type { CsvValue } from '@/lib/csv-export'
import {
  formatirajMs,
  preveriZmogljivostPregledZaIzvoz,
  ZMOGLJIVOST_IZVOZ_GLAVE,
  ZMOGLJIVOST_VIR_NIZ,
} from './zmogljivost-pregled'
import type { ZmogljivostPregled } from './zmogljivost-pregled'

/**
 * Zgrodi deterministični CSV meritev zmogljivosti. Pregled je POSREDOVANA
 * resnica (fail-closed validacija brezplačno prek EN VIR kontrakta brata —
 * pokvarena meritev ne more postati lažno poročilo; kanon R299/R302/R306).
 * Vrstni red vrstic = ISTI vrstni red kot pregled.meritve (nič re-sorta —
 * kanon pregleda; ENA vrstica = ENA operacija, ISTA ravnina kot zaslon).
 */
export function buildZmogljivostCsv(
  pregled: ZmogljivostPregled,
): { csv: string; vrstic: number } {
  preveriZmogljivostPregledZaIzvoz(pregled, 'buildZmogljivostCsv')
  const podatkovne: CsvValue[][] = pregled.meritve.map((m) => [
    m.id,
    m.opis,
    m.modul,
    String(m.iteracij),
    formatirajMs(m.najmanj),
    formatirajMs(m.mediana),
    formatirajMs(m.najvec),
  ])
  // Povzetek: EN VIR sklep (isti niz kot na zaslonu + PDF — NIČ dvojnega).
  // Brez 'Izvoženo ob' — čas bi uničil determinizem (isti HEAD = isti CSV).
  const meta: CsvValue[][] = [
    [], // prazna ločilna vrstica pred povzetkom (preglednost v Excelu)
    ['Sklep', pregled.sklep],
    ['Vir', ZMOGLJIVOST_VIR_NIZ],
  ]
  const csv = toCsv([...ZMOGLJIVOST_IZVOZ_GLAVE], [...podatkovne, ...meta])
  return { csv, vrstic: pregled.meritve.length }
}

/** Deterministično ime datoteke (brez datuma — veza na HEAD je implicitna;
 *  vzorec zmogljivost-pregled.pdf, 50. člen / avtomatizacija-audit.csv,
 *  47. člen). */
export function zmogljivostCsvFilename(): string {
  return 'zmogljivost-pregled.csv'
}
