// ---------------------------------------------------------------------------
// R284 (i5 — issue #15 §3 po worklog i4/R283) — TERENSKI ZAPISNI LIST PDF iz
// Meritve taba (measurements-tab.tsx). Vzorec meritve-teren-pdf R269 / nagibi
// R272 / zapisnik R271: ROKSAL glava, KPI, autoTable, sklep, noge, bajtni
// determinizem.
//
// SEMANTIČNE ODLOČITVE X1–X7 (zapisane PRED razvojem — kanon R277–R283):
//
//  X1 RAZMEJITEV (glavna odločitev runde): R269 'MERITVE — TERENSKI PREGLED'
//     = POROČILO zapisane digitalne resnice (read-only). R284 'TERENSKI
//     ZAPISNI LIST' = IZPOLNJEVALNI list za teren (fill-in worksheet za
//     lastniško akcijo po docs/AR-FIELD-VALIDATION.md §3): ISTA zapisana
//     resnica + PRAZNI stolpci (Fizična ref. (mm) / Δ (mm) / Zapiski terena)
//     za zapis s peresom na terenu. Digitalni list NIKOLI ne izmišljuje
//     fizičnih vrednosti — fizični stolpci so VEDNO prazni (tip-null v
//     čisti funkciji; izpolni jih človek). NI konflikta z bajtnimi
//     kontrakti: NOVA PDF družina, lasten FNV salt register (0xb5–0xb8 —
//     meritve-teren 0xa1–0xa4, … 0xb0–0xb4 obstoječe), lasten needle set;
//     R269/R271/R272 PDF-ji, njihovi testi in fingerprinti NISO dotaknjeni.
//
//  X2 EN VIR vrstic: vrste + povzetek = izpljunek ISTEGA meritevTerenPregled
//     (R269 — IMPORT, NI kopije): ISTA R186 validacija fizikalnih mer,
//     ISTI fallbacki (status brez vrednosti = OSNUTEK, tip = RAZDALJA),
//     ISTI akcijski sort (OSNUTEK → POTRJENA → ARHIVIRANA → oznaka → datum
//     → id), ISTA dedup-id preverba. Zapisni list ne more divergirati od
//     R269 poročila: ISTI vrstni red, ISTA resnica, ISTA podlagna vrstica.
//     Kot stolpec EN VIR R186 meritevVrstica (r[5] = kotStopinje, isti
//     fallback '' → null '—' na listu) — join po id (edinstvenost že
//     dokazana znotraj meritevTerenPregled).
//
//  X3 FAIL-CLOSED: ISTI kontrakt kot R269: prazen seznam → TypeError (iskren
//     toast 'Ni vpisanih meritev'); podvojen id → TypeError (pokvaren vir);
//     pokvarena polja → TypeError z indeksom krivca (prek R186/R269
//     validacije — NI lastne tolerancе). Neznana vir/status sta pokvaren
//     vir — NIKOLI tiho na list.
//
//  X4 DETERMINIZEM: now KOT parameter; doc.setCreationDate(now) +
//     doc.setFileId(FNV-1a) s LASTNIMI soli **0xb5–0xb8** — enak vhod =
//     bajtno enak PDF (document-pdf R121 kanon; isti salt v dveh libih NE
//     sme dati isti ID).
//
//  X5 PRAVILA: route NIČ, DB NIČ, shema NIČ, Measurement SDK / geometry /
//     BOM / pricing core NIČ, OgrajaVizija nič, 0 novih hex (ISTI family
//     barvni konstanti kot R269); client+lib only.
//
//  X6 ISKREN SKLEP: sklep poimenuje namen (zapisni list za fizično
//     validacijo — issue #15 §3), vir podatkov (/api/measurements?projectId
//     FRESH ob kliku), pomen Δ (fizična referenca − zapisana vrednost) in
//     PASS kriterij (Δ zapisan za VSAKO vrstico — nič tiho izpuščenih).
//
//  X7 TERENSKA VRATA (issue #14 §18 — statični protokolni seznam, NIKOLI
//     podatki): 9 vrat z ASCII checkboxi '[  ]' (font-varni — brez Unicode
//     rizika) + invariant opomba (issue #14 §19: ar-android AFTER >= BEFORE).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { meritvePovzetekBeseda } from './meritve-povzetek'
import { meritevVrstica } from './meritve-csv'
import {
  meritevTerenPregled,
  type MeritveTerenVnos,
  type MeritveTerenPovzetek,
  type MeritveTerenVrsta,
} from './meritve-teren-pdf'
import { MERITEV_VIR_LABELS } from './meritev-verzije'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

export type TerenskiZapisniVnos = MeritveTerenVnos

export interface TerenskiZapisniPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244–R269). */
  now: Date
  /** Ime projekta — točno to, kar pokaže izbirnik (ali null/izostanek —
   *  list pošteno pokaže 'Brez imena projekta', R203 pariteta). */
  projektIme?: string | null
}

/** Zapisni list vrsta = R269 vrsta (EN VIR — ISTA sort + ISTA validacija)
 *  + kot (R186 r[5]) + PRAZNI fizični stolpci (X1 — VEDNO null v digitalni
 *  resnici; izpolni jih lastnik na terenu). */
export interface TerenskiZapisniVrsta extends MeritveTerenVrsta {
  /** Kot iz R186 vrstice (kotStopinje) ALI null ('—' — iskren odpad). */
  kot: number | null
  /** FIZIČNA referenca (mm) — VEDNO null (X1: izpolni lastnik na terenu;
   *  NIKOLI izmišljena vrednost). */
  fizicnaRefMm: null
  /** Δ = fizična referenca − zapisana vrednost — VEDNO null (X1). */
  deltaMm: null
  /** Zapiski terena — VEDNO null (X1). */
  zapiskiTerena: null
}

/** Terenska vrata (issue #14 §18) — STATIČNI protokolni seznam (X7 —
 *  NIKOLI podatki; ASCII checkboxi font-varni). */
export const TERENSKA_VRATA: readonly string[] = [
  'balkon 3 m + 90 stopinj prelom',
  'stopnice',
  'vrtna ograja 10–20 m',
  'drift (dolg hod po prostoru)',
  're-anchor (2-tap + kalibracijska točka C)',
  'calibration point C',
  'depth confidence',
  'zahtevne/glossy/glass površine',
  'primerjava z dejanskimi meritvami',
] as const

/** Zapisni list vrste — ENA IZPELJAVA (WYSIWYG): ISTI meritevTerenPregled
 *  (R269 IMPORT) poganja KPI, tabelo in sklep; kot EN VIR R186 r[5] join po
 *  id (edinstvenost že dokazana). Fail-closed ISTI kontrakt kot R269 (X3). */
export function zapisniListVrste(
  meritve: readonly MeritveTerenVnos[],
): { vrste: TerenskiZapisniVrsta[]; povzetek: MeritveTerenPovzetek } {
  if (!Array.isArray(meritve)) {
    throw new TypeError('zapisniListVrste: pričakovano polje meritev (MeritveTerenVnos[])')
  }
  if (meritve.length === 0) {
    throw new TypeError(
      'zapisniListVrste: prazen seznam meritev ne nastaja dokumenta — zapisni list se izvozi, ko je vpisana prva meritev projekta (fail-closed)',
    )
  }
  // EN VIR R269: validacija (R186 fizikalne mere + neznani status/vir),
  // dedup id, akcijski sort — NIČ lastne tolerancе (X3).
  const { vrste, povzetek } = meritevTerenPregled(meritve)
  // Kot EN VIR R186 (X2): ISTI graditelj vrstic kot CSV arhiv — r[5] =
  // kotStopinje z ISTIM fallbackom ('' → null '—'). Join po id.
  const kotPoId = new Map<string, number | null>()
  meritve.forEach((o, i) => {
    let r: string[]
    try {
      r = meritevVrstica(o)
    } catch (e) {
      throw new TypeError(`meritev ${i}: ${e instanceof Error ? e.message : String(e)}`)
    }
    kotPoId.set(o.id, r[5] === '' ? null : Number(r[5]))
  })
  const zapisisni: TerenskiZapisniVrsta[] = vrste.map((v) => ({
    ...v,
    kot: kotPoId.get(v.id) ?? null,
    fizicnaRefMm: null,
    deltaMm: null,
    zapiskiTerena: null,
  }))
  return { vrste: zapisisni, povzetek }
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xb5–0xb8
 *  (register: meritve-teren 0xa1–0xa4 … 0xb0–0xb4 obstoječe — isti salt v
 *  dveh libih NE sme dati isti ID). */
function fnv1aHex(seed: string, salt: number): string {
  let h = 0x811c9dc5 ^ salt
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function deterministichenId(seed: string): string {
  return (
    fnv1aHex(seed, 0xb5) +
    fnv1aHex(seed, 0xb6) +
    fnv1aHex(seed, 0xb7) +
    fnv1aHex(seed, 0xb8)
  )
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text(text, 14, y)
  doc.setDrawColor(...AMBER)
  doc.setLineWidth(0.8)
  doc.line(14, y + 1.8, 14 + doc.getTextWidth(text), y + 1.8)
  doc.setLineWidth(0.2)
  return y + 6
}

/** KPI polje — ISTI vzorec kot R269 / ekipa-stanje / narocila družina. */
function kpiBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  color: [number, number, number]
): void {
  doc.setFillColor(...LIGHT)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text(label.toUpperCase(), x + 3, y + 5.5)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...color)
  doc.text(value, x + 3, y + 13)
}

/** Zgradi TERENSKI ZAPISNI LIST dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildTerenskiZapisniPdfDoc(
  meritve: readonly TerenskiZapisniVnos[],
  options: TerenskiZapisniPdfOptions,
): jsPDF {
  if (!Array.isArray(meritve)) {
    throw new TypeError('buildTerenskiZapisniPdfDoc: pričakovano polje meritev')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildTerenskiZapisniPdfDoc: pričakovane opcije (TerenskiZapisniPdfOptions)')
  }
  const { now, projektIme } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildTerenskiZapisniPdfDoc: pričakovan veljaven now: Date')
  }
  if (projektIme !== null && projektIme !== undefined && typeof projektIme !== 'string') {
    throw new TypeError('buildTerenskiZapisniPdfDoc: projektIme mora biti niz ALI null')
  }
  // PRAZEN SEZNAM meritev ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih meritev.') — X3.
  if (meritve.length === 0) {
    throw new TypeError(
      'buildTerenskiZapisniPdfDoc: prazen seznam meritev ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih meritev.)',
    )
  }
  const { vrste, povzetek } = zapisniListVrste(meritve)
  // Ime projekta — točno to, kar pokaže izbirnik; prazno/manjkajoče = iskren
  // 'Brez imena projekta' (R203 pariteta — NIKOLI izmišljenega imena).
  const imeProjekta =
    projektIme !== null && projektIme !== undefined && projektIme.trim() !== ''
      ? projektIme
      : 'Brez imena projekta'

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina — X4) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (po id identitete), NIKOLI vrstni
  // red odgovora (R248/R262/R264–R269 vzorec). Oznaka null-safe.
  const kanonMeritve = [...meritve].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|Z:${imeProjekta}:${kanonMeritve
        .map(
          (o) =>
            `${o.id}/${o.status === null || o.status === undefined ? 'null' : o.status}/${o.tipMeritve === null || o.tipMeritve === undefined ? 'null' : o.tipMeritve}/${o.dolzinaMm}/${o.visinaMm}/${o.oznaka === null || o.oznaka === undefined ? 'null' : o.oznaka}/${o.createdAt}`,
        )
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot R269 družina) ----------
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, 210, 26, 'F')
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...AMBER)
  doc.text('ROKSAL', 14, 12)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('Roksal d.o.o. — ograje in balustrade', 14, 17.5)
  doc.text('Cesta Republike 14, 4000 Kranj', 14, 22.5)

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(15)
  doc.text('TERENSKI ZAPISNI LIST', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('FIZIČNA VALIDACIJA — issue #15 §3', 196, 17.5, { align: 'right' })
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 22.5, { align: 'right' })
  doc.setFontSize(9)
  doc.text(`projekt: ${imeProjekta}`, 196, 27, { align: 'right' })

  // ---------- navodilo (X1/X6 — namen in neodvisni postopek) ----------
  let y = 34
  y = sectionTitle(doc, y, 'Navodilo')
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    'Izpolnjevalni list za fizično validacijo AR meritev (issue #15 §3 — docs/AR-FIELD-VALIDATION.md). Digitalni vpisi so ZAPISANA resnica sistema (vir: /api/measurements, FRESH ob kliku).',
    14,
    y + 3,
  )
  doc.text(
    'Fizične mere zapiši z neodvisnim merilnim postopkom (laserni merilnik + nivojnica/inklinometer). Δ = fizična referenca − zapisana vrednost. PASS: Δ zapisan za VSAKO vrstico.',
    14,
    y + 8,
  )
  y += 14

  // ---------- KPI 4 (signalni jezik: AMBER = akcija — osnutki čakajo
  //  potrditev; GREEN = potrjene; NAVY = obseg) ----------
  y = sectionTitle(doc, y, 'Povzetek zapisane resnice')
  const bw = 42
  const bh = 16
  const gap = 5
  kpiBox(doc, 14, y, bw, bh, 'Meritev', String(povzetek.meritev), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Osnutki', String(povzetek.osnutkov), povzetek.osnutkov > 0 ? AMBER : GREEN)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Potrjenih', String(povzetek.potrjenih), GREEN)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Skupna dolžina', `${(povzetek.skupnaDolzinaMm / 1000).toFixed(2)} m`, NAVY)
  y += bh + 8

  // ---------- zapisni list tabela (X1: zapisana resnica + PRAZNI stolpci;
  //  ISTI sort kot R269 — akcijski red, EN VIR) ----------
  y = sectionTitle(doc, y, `Meritve — zapisni list (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Oznaka', 'Tip', 'Dolžina (mm)', 'Višina (mm)', 'Kot', 'Status', 'Verzija', 'Vir', 'Fizična ref. (mm)', 'Δ (mm)', 'Zapiski terena']],
    body: vrste.map((v) => [
      v.datum,
      v.oznaka ?? '—',
      v.tip,
      String(v.dolzinaMm),
      String(v.visinaMm),
      v.kot === null ? '—' : String(v.kot),
      v.status,
      v.verzija === null ? '—' : `v${v.verzija}`,
      v.vir === null ? '—' : MERITEV_VIR_LABELS[v.vir],
      '', // FIZIČNA ref. — izpolni lastnik na terenu (X1 — VEDNO prazno)
      '', // Δ — izpolni lastnik na terenu (X1 — VEDNO prazno)
      '', // Zapiski terena — izpolni lastnik (X1 — VEDNO prazno)
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.8, font: 'Roboto', minCellWidth: 9 },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 7 },
    didParseCell: (data) => {
      // WYSIWYG: OSNUTEK AMBER bold (akcija); POTRJENA GREEN; ARHIVIRANA
      // sivo; '—' sivo (iskren odpad); PRAZNI fizični stolpci (10–12) =
      // LIGHT polnilo (izpolnjevalna cona — ISTA family barva, 0 novih hex).
      if (data.section !== 'body') return
      const v = vrste[data.row.index]
      if (!v) return
      const raw = String(data.cell.raw ?? '')
      if (data.column.index >= 10) {
        data.cell.styles.fillColor = [...LIGHT]
        data.cell.styles.minCellWidth = 16
      }
      if (data.column.index === 6) {
        if (v.status === 'OSNUTEK') {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        } else if (v.status === 'POTRJENA') {
          data.cell.styles.textColor = GREEN
        } else if (v.status === 'ARHIVIRANA') {
          data.cell.styles.textColor = GRAY
        }
      }
      if ((data.column.index === 1 || data.column.index === 4 || data.column.index === 5 || data.column.index === 7 || data.column.index === 8 || data.column.index === 9) && raw === '—') {
        data.cell.styles.textColor = GRAY
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- terenska vrata (X7 — statični protokolni seznam, issue #14 §18) ----------
  if (y > 230) {
    doc.addPage()
    y = 20
  }
  y = sectionTitle(doc, y, 'Terenska vrata (issue #14 §18)')
  autoTable(doc, {
    startY: y,
    head: [['Dejanski test — rezultate zapisati PRED trditvijo o terenski natančnosti']],
    body: TERENSKA_VRATA.map((t) => [`[  ] ${t}`]),
    styles: { fontSize: 8, cellPadding: 1.6, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 4
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(
    'Invariant (issue #14 §19): ar-android AFTER >= ar-android BEFORE — noben integracijski korak ne sme poslabšati native AR resnice.',
    14,
    y + 3,
  )
  y += 8

  // ---------- sklepna vrstica (X6 — iskren podpis: namen, Δ, PASS, vir) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `TERENSKI ZAPISNI LIST = izpolnjevalni dokument za fizično validacijo (issue #15 §3; protokol docs/AR-FIELD-VALIDATION.md) — digitalna resnica je ZAPISANA (vir podatkov = /api/measurements?projectId, FRESH ob kliku); stolpci Fizična ref./Δ/Zapiski ostajajo PRAZNI — izpolni jih lastnik na terenu z neodvisnim merilnim postopkom (laserni merilnik + nivojnica/inklinometer); Δ = fizična referenca − zapisana vrednost; PASS kriterij: Δ zapisan za VSAKO vrstico — nič tiho izpuščenih meritev · ${meritvePovzetekBeseda(povzetek.meritev)} · osnutki ${povzetek.osnutkov} (akcija — pregled in potrditev) · potrjenih ${povzetek.potrjenih} · skupna dolžina ${(povzetek.skupnaDolzinaMm / 1000).toFixed(2)} m · statusi/tipi/viri = kode VERBATIM (ista resnica kot R269 pregled IN CSV arhiv — EN VIR meritevVrstica R186).`,
    14,
    y + 4,
  )

  // ---------- noge na vseh straneh (ISTI vzorec kot boss-report družina) ----------
  const strani = doc.getNumberOfPages()
  const genStr = `Generirano ${zalogaPovzetekCasOznaka(now)}`
  for (let i = 1; i <= strani; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(14, 284, 196, 284)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text(`${genStr} · Roksal Field Manager v2.5`, 14, 289)
    doc.text(`Stran ${i}/${strani}`, 196, 289, { align: 'right' })
  }

  return doc
}

/** Ime datoteke — `Terenski-zapisni-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function terenskiZapisniPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('terenskiZapisniPdfFilename: pričakovan veljaven now: Date')
  }
  return `Terenski-zapisni-${todayStamp(now)}.pdf`
}

/** Zgeneriraj TERENSKI ZAPISNI LIST PDF (determinističen — enak vhod =
 *  bajtno enak dokument) in ga shrani. */
export function generateTerenskiZapisniPdf(
  meritve: readonly TerenskiZapisniVnos[],
  options: TerenskiZapisniPdfOptions,
): void {
  const doc = buildTerenskiZapisniPdfDoc(meritve, options)
  doc.save(terenskiZapisniPdfFilename(options.now))
}
