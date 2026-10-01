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
import type { AuditEntry, GroundType } from './labels'
import { auditActionLabels, groundTypeLabels, statusLabels, tipMeritveLabels } from './labels'
import { slDatumKratko, slCasDolgo } from '@/lib/csv-export'
import type { MaterialStebra, MeasurementStatus, TipMeritve, TipStebra } from './shared'
import { materialStebraLabels, tipStebraLabels } from './shared'

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

// ── R350 FAZA 7 — ostanki starejše družine: steber + zgodovina gradniki ──
// VERBATIM premik iz taba (handleExportStebriCSV vrstice + handleExportAuditCSV
// vrstice; vzorec FAZA 5 — gradniki NESPREMENJENI, izvožene datoteke bajtno
// iste). Vhodni seznam = klicateljeva resnica (per-segment stebri ALI
// projektov audit dnevnik).

/** Izsek client vmesnika Measurement za 8-stolpčni steber kontrakt
 *  (R156 status stolpec; samo polja, ki jih gradnik potrebuje). */
export interface StebriVrsticaVhod {
  steberOznaka?: string | null
  oznaka?: string | null
  tipStebra?: TipStebra | null
  status?: MeasurementStatus | null
  pozicijaMm?: number | null
  razmikMm?: number | null
  visinaStebraMm?: number | null
  materialStebra?: MaterialStebra | null
  opomba?: string | null
}

/** Zaglavje 8-stolpčnega per-segment steber kontrakta (R156) — EN VIR. */
export const STEBRI_CSV_HEADER =
  'Oznaka,Tip,Status,Pozicija(mm),Razmik(mm),Visina(mm),Material,Opomba'

/** 8-stolpčne steber vrstice — VERBATIM premik iz taba (handleExportStebriCSV;
 *  odsotna števila → prazno, razmik brez vrednosti → '—' em-dash VERBATIM). */
export function zgradiStebriVrstice(seznam: readonly StebriVrsticaVhod[]): string[] {
  return seznam.map((m) => {
    const o = csvEsc(m.steberOznaka || m.oznaka)
    const t = m.tipStebra ? tipStebraLabels[m.tipStebra] : ''
    const status = statusLabels[m.status || 'OSNUTEK']
    const poz = m.pozicijaMm ? String(Math.round(m.pozicijaMm)) : ''
    const raz = m.razmikMm ? String(Math.round(m.razmikMm)) : '—'
    const vis = m.visinaStebraMm ? String(Math.round(m.visinaStebraMm)) : ''
    const mat = m.materialStebra ? materialStebraLabels[m.materialStebra] : ''
    const op = csvEsc(m.opomba)
    return `"${o}","${t}","${status}",${poz},${raz},${vis},"${mat}","${op}"`
  })
}

/** Izsek lokalnega AuditEntry (labels.ts) — polja zgodovina kontrakta. */
export type ZgodovinaVrsticaVhod = AuditEntry

/** Zaglavje 6-stolpčnega zgodovina (projektni audit) kontrakta — EN VIR.
 *  NB: to je LOKALNA zgodovina meritev (Cas/Akcija/MeritevId/Opis/Stara/
 *  Nova) — NI kolizija s sistemskim revizijskim sledilnim lib/audit-csv.ts
 *  (R162; user/IP/Vloga kontrakt — druga družina). */
export const ZGODOVINA_CSV_HEADER =
  'Cas,Akcija,MeritevId,Opis,StaraVrednost,NovaVrednost'

/** 6-stolpčne zgodovina vrstice — VERBATIM premik iz taba
 *  (handleExportAuditCSV; čas = slDatumKratko + ', ' + slCasDolgo — ISTI
 *  prikaz kot zaslon). */
export function zgradiZgodovinaVrstice(seznam: readonly ZgodovinaVrsticaVhod[]): string[] {
  return seznam.map((e) => {
    const cas = `${slDatumKratko(new Date(e.timestamp))}, ${slCasDolgo(new Date(e.timestamp))}`
    const akcija = auditActionLabels[e.akcija]
    const opis = csvEsc(e.opis)
    const stara = csvEsc(e.staraVrednost)
    const nova = csvEsc(e.novaVrednost)
    return `"${cas}","${akcija}","${e.meritevId}","${opis}","${stara}","${nova}"`
  })
}
