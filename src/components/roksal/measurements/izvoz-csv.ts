// R348 — dekompozicija measurements-tab FAZA 5: EN VIR gradnja starejše
// družine CSV izvozov (vzorec kalkulator FAZA 5–7 / R325 pdf-exports:
// izsek vmesniki + VERBATIM premik; gradniki NESPREMENJENI — izvožene
// datoteke ostanejo bajtno iste).
// ---------------------------------------------------------------------------
// Motiv (LEKCIJA R347 2: stale kopije dihajo tudi v JSX, ne samo function
// telesih — tu so dihale v function telesih): measurements-tab je nosil
// 4 × 8-vrstični inline Blob/prenos blok (handleExportStebriCSV,
// handleExportCSV, handleBulkExportCSV, handleExportAuditCSV), 15 inline
// kopij podvajanja navedkov `(x || '').replace(/"/g, '""')` in 4 inline
// kopije `'\uFEFF' + header + '\n' + rows.join('\n')`. Najhujše: 17-stolpčni
// meritve vrstični gradnik je bil PODVOJEN (handleExportCSV za vse meritve ≡
// handleBulkExportCSV za izbrane — bajtno identični telesi, 2 resnici).
//
// Zdaj: gradniki tu (EN VIR), prenos prek kanona downloadCsvText (R171/R296,
// lib/csv-export) — MIME 'text/csv;charset=utf-8;' izgubi navlečno piko
// (kanon normalizira; VSEBINA datoteke je bajtno ista).
//
// Načela (parity lib/meritve-csv R186):
//  • IZVOŽENO = ZASLON: isti fallbacki kot UI ('Razdalja' privzeti tip,
//    statusLabels[status || 'OSNUTEK'], podlaga || surova vrednost);
//  • determinizem: čista funkcija nad izrecnimi vhodi — brez Date.now() v
//    jedru (datum v IMENU datoteke je klicateljeva resnica — VERBATIM
//    toISOString().slice(0, 10) vzorec, kot ga nosi že R186 klicatelj
//    izvoziMeritveCsv — družinska konsistenznost);
//  • odsotna polja → PRAZNO polje (ne 'n/a', ne ugibanje).
import type { GroundType } from './labels'
import { groundTypeLabels, statusLabels, tipMeritveLabels } from './labels'
import { slDatumKratko } from '@/lib/csv-export'
import type { MeasurementStatus, TipMeritve } from './shared'

/** Izsek client vmesnika Measurement (measurements-tab.tsx / shared.ts) —
 *  samo polja, ki jih 17-stolpčni kontrakt potrebuje. Odprta polja →
 *  pošteno prazno. */
export interface MeritveVrsticaVhod {
  oznaka?: string | null
  tipMeritve?: TipMeritve | null
  status?: MeasurementStatus | null
  lokacija?: string | null
  segmentId?: string | null
  dolzinaMm: number
  visinaMm: number
  steviloStebrov?: number | null
  tipPodlage?: string | null
  kot?: number | null
  opomba?: string | null
  opombe?: string | null
  createdAt: string
}

/** Zaglavje 17-stolpčnega P1 kontrakta (multi-unit mm/cm/m + status) —
 *  EN VIR za vse meritve in izbrane meritve. */
export const MERITVE_CSV_HEADER =
  'Oznaka,Tip,Status,Lokacija,Segment,Dolzina(mm),Dolzina(cm),Dolzina(m),Visina(mm),Visina(cm),Visina(m),Stebri,Podlaga,Kot,Opomba,Opombe,Datum'

/** Podvajanje navedkov (kanon izvozne družine R156–R186): `"` → `""`.
 *  null/undefined → prazno (pošteno prazno polje, brez 'null' literala). */
export function csvEsc(v: string | null | undefined): string {
  return (v || '').replace(/"/g, '""')
}

/** BOM + zaglavje + vrstice (LF) — oblika starejše družine izvozov
 *  (VEJICA + vse besedilne položaje citira klicatelj; za razliko od
 *  toCsv kanona ';'-dialekta tu NI preoblikovanja — bajtna pariteta). */
export function csvDokument(header: string, vrstice: readonly string[]): string {
  return '\uFEFF' + header + '\n' + vrstice.join('\n')
}

/** 17-stolpčne meritve vrstice (P1) — VERBATIM premik iz taba
 *  (handleExportCSV ≡ handleBulkExportCSV stale kopija; zdaj EN VIR —
 *  vhodni seznam je klicateljeva resnica: vse ALI samo izbrane). */
export function zgradiMeritveVrstice(seznam: readonly MeritveVrsticaVhod[]): string[] {
  return seznam.map((m) => {
    const oznaka = csvEsc(m.oznaka)
    const tip = m.tipMeritve ? tipMeritveLabels[m.tipMeritve] : 'Razdalja'
    const status = statusLabels[m.status || 'OSNUTEK']
    const lokacija = csvEsc(m.lokacija)
    const segment = csvEsc(m.segmentId)
    const dMm = String(m.dolzinaMm)
    const dCm = String(Math.round(m.dolzinaMm / 10))
    const dM = (m.dolzinaMm / 1000).toFixed(2)
    const vMm = String(m.visinaMm)
    const vCm = String(Math.round(m.visinaMm / 10))
    const vM = (m.visinaMm / 1000).toFixed(2)
    const stebri = m.steviloStebrov ? String(m.steviloStebrov) : ''
    const podlaga = m.tipPodlage ? (groundTypeLabels[m.tipPodlage as GroundType] || m.tipPodlage) : ''
    const kot = m.kot ? String(m.kot) : ''
    const opomba = csvEsc(m.opomba)
    const opombe = csvEsc(m.opombe)
    const datum = slDatumKratko(new Date(m.createdAt))
    return `"${oznaka}","${tip}","${status}","${lokacija}","${segment}",${dMm},${dCm},${dM},${vMm},${vCm},${vM},"${stebri}","${podlaga}",${kot},"${opomba}","${opombe}",${datum}`
  })
}
