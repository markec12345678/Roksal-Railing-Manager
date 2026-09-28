// ---------------------------------------------------------------------------
// R255 (P1-f, 'izvozi' družina — 11. člen) — VOZNI RED MONTAŽ PDF iz
// logistike (logistics-tab). Vzorec koledar-pregledov-pdf R253 / potekli-
// opomniki-pdf R252 / opomnik-pdf R251 / prihodki-pdf R250: ROKSAL glava,
// KPI trio, autoTable, noge, bajtni determinizem.
//
// LOČEN dokument od CSV (vrstična preglednica) in .ics (telefonov koledar):
// ta dokument je TERENSKI LIST — kronološki vozni red VIDNIH terminov montaže
// za ekipe (kateri projekt, katera ekipa, kdaj, koliko ur, kje). Evalvacija
// (worklog R254 kandidat 'logistika izvozi'): logistika je ZADNJI veliki tab
// brez člana 'izvozi' družine PDF — CSV/ICS obstajata od R139/R145, vodstvo
// pa tiska VOZNI RED za montažerske ekipe.
// ENA resnica z zaslonom (WYSIWYG — brat iz ISTEGA vira):
//  • vir podatkov = GET /api/schedules (odgovor, ki ga LogisticsTab že
//    izriše) — route NIČ (client+lib only);
//  • izbira = VIDNI termini (kaj zaslon pokaže, to PDF preneše — projektni
//    filter ostaja resnica obsega); PREKlicANI termini so na vozno redu
//    VIDNO (iskrena resnica — ekipa ve, kaj je odpadlo; vrstica rdeče bold
//    v statusu, NIKOLI tiho izpuščena);
//  • status = VERBATIM iz API-ja (5 znanih statusov — EN VIR RESNICE z
//    SCHEDULE_TERMINI_STATUSI iz termini-prikaz, ISTI labels kot značke na
//    zaslonu); neznan status → TypeError z indeksom krivca (NIKOLI tiho
//    spregledan);
//  • časi Od–Do = UTC del ISO niza (nizovni rez — ISTI vir kot .ics izvoz,
//    R172; deterministično neodvisno od časovnega pasu stroja);
//  • sort = datumZacetka ASC (kronološki red — najbližji termin prvi),
//    izenačba projekt ASC (navadno < — localeCompare NE, vzorec
//    R245/R250/R252/R253); sort interno PRED štetji (FP vzorec R248/R250).
//
// Načela (družinska pravila — ISTA kot koledar R253):
//  • Fail-closed: PRAZEN VOZNI RED ne nastaja dokumenta (družina: ni prazne
//    datoteke — komponenta pokaže iskren toast); pokvaren vnos → TypeError z
//    indeksom krivca.
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (R121 100×).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0x71–0x74** (register:
//    prihodki 0x61–64, opomnik 0x65–68, potekli 0x69–6c, koledar 0x6d–0x70 →
//    vozni red 0x71–0x74 — ista semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import {
  SCHEDULE_TERMINI_STATUSI,
  SCHEDULE_TERMINI_STATUS_LABELS,
  type ScheduleTerminStatus,
} from './termini-prikaz'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green (prihodki R250)
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez ENEGA termina montaže (polja iz GET /api/schedules —
 *  ISTI odgovor, ki ga LogisticsTab izriše, normalizirano z normalizirajTermin
 *  — EN VIR RESNICE z vrstico nad seznamom). EN termin = ENA vrstica vozno
 *  reda. Null polja = iskrena manjkajoča resnica ('—' na listu, NIKOLI
 *  izmišljena) — ISTI signal kot zaslon ('Ni …' besedila R169). */
export interface VozniRedTermin {
  /** ISO niz (YYYY-MM-DDTHH… UTC) — začetek termina (obvezujoč: sort ključ
   *  + rez časa; API vedno izda ISO — oblika je jedro vrstice). */
  datumZacetka: string
  /** ISO niz ALI null — konec termina (null → samo 'Od' v stolpcu Čas). */
  datumKonca: string | null
  /** Status VERBATIM iz API-ja — eden izmed 5 znanih (SCHEDULE_TERMINI_STATUSI;
   *  neznan status = pokvarena izpeljava → TypeError). */
  status: ScheduleTerminStatus
  /** Predvidene ure: ne-negativno celo število ALI null (R168: manjkajoč/
   *  pokvarjen → null = 'brez ure' — izključen iz vsote, NIKOLI izmišljen
   *  kot 0; KPI dobi '≥' mejo, ISTI signal kot povzetek na zaslonu). */
  predvideneUre: number | null
  /** Projekt: ne-prazen niz ALI null (nazivProjekta manjka → '—'). */
  projekt: string | null
  /** Stranka: ne-prazen niz ALI null (customer.ime manjka → '—'). */
  stranka: string | null
  /** Ekipa: ne-prazen niz ALI null (crew.naziv manjka → '—'). */
  ekipa: string | null
  /** Lokacija: ne-prazen niz ALI null (schedule.lokacija → '—'). */
  lokacija: string | null
}

export interface VozniRedOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT PARAMETER
   *  (determinizem; vzorec R203/R244/R250/R251/R252/R253). */
  now: Date
}

/** Fail-closed preverba vrstice vozno reda (obvezna polja + 5 znanih statusov
 *  VERBATIM; indeks krivca je VEDNO v sporočilu — družina R236/R250/R251/R252
 *  /R253). Časi validira kot ISO niz (nizovni rez potrebuje obliko
 *  YYYY-MM-DDTHH:MM). */
export function preveriVozniRedTermin(t: VozniRedTermin, i: number): void {
  if (!t || typeof t !== 'object') {
    throw new TypeError(`preveriVozniRedTermin (${i}): pričakovan termin montaže (VozniRedTermin)`)
  }
  if (typeof t.datumZacetka !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t.datumZacetka)) {
    throw new TypeError(`preveriVozniRedTermin (${i}): datumZacetka mora biti ISO niz YYYY-MM-DDTHH:MM…, ne ${String(t.datumZacetka)}`)
  }
  if (t.datumKonca !== null && (typeof t.datumKonca !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t.datumKonca))) {
    throw new TypeError(`preveriVozniRedTermin (${i}): datumKonca mora biti ISO niz YYYY-MM-DDTHH:MM… ALI null, ne ${String(t.datumKonca)}`)
  }
  if (!(SCHEDULE_TERMINI_STATUSI as readonly string[]).includes(t.status)) {
    throw new TypeError(`preveriVozniRedTermin (${i}): status mora biti VERBATIM iz API-ja (${SCHEDULE_TERMINI_STATUSI.join(' | ')}), ne ${String(t.status)}`)
  }
  if (
    t.predvideneUre !== null &&
    (typeof t.predvideneUre !== 'number' || !Number.isInteger(t.predvideneUre) || t.predvideneUre < 0)
  ) {
    throw new TypeError(`preveriVozniRedTermin (${i}): predvideneUre mora biti ne-negativno celo število ALI null (brez ure — R168), ne ${String(t.predvideneUre)}`)
  }
  for (const [k, v] of [
    ['projekt', t.projekt],
    ['stranka', t.stranka],
    ['ekipa', t.ekipa],
    ['lokacija', t.lokacija],
  ] as const) {
    if (v !== null && (typeof v !== 'string' || v.trim() === '')) {
      throw new TypeError(`preveriVozniRedTermin (${i}): ${k} mora biti null ALI ne-prazen niz (iskrena manjkajoča resnica), ne ${String(v)}`)
    }
  }
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x71–0x74: vsak PDF lib družine ima svoje). */
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
    fnv1aHex(seed, 0x71) +
    fnv1aHex(seed, 0x72) +
    fnv1aHex(seed, 0x73) +
    fnv1aHex(seed, 0x74)
  )
}

/** Čas Od–Do iz ISO niza — UTC del ISO (nizovni rez HH:MM), ISTI vir kot
 *  .ics izvoz (R172). Deterministično: NIKOLI toLocaleTimeString (odvisen od
 *  časovnega pasu stroja — bajtni determinizem družine). */
export function vozniRedCas(d: string): string {
  return `${d.slice(11, 13)}:${d.slice(14, 16)}`
}

/** Stolpec 'Čas' — 'Od–Do' (datumKonca ≠ null) ALI samo 'Od' (null = konec
 *  ni vpisan — iskrena resnica, NIKOLI izmišljen konec). */
export function vozniRedCasOkno(t: Pick<VozniRedTermin, 'datumZacetka' | 'datumKonca'>): string {
  return t.datumKonca === null ? vozniRedCas(t.datumZacetka) : `${vozniRedCas(t.datumZacetka)}–${vozniRedCas(t.datumKonca)}`
}

/** Sort vrstic V LIBU — datumZacetka ASC (kronološki red — najbližji termin
 *  prvi), izenačba projekt ASC (navadno <, localeCompare NE); null projekt
 *  (manjkajoč naziv — iskrena resnica) sortira ZADNJI (imenovani projekti
 *  prvi — uporabnejši red, determinističen). IZVOŽEN — determinizem =
 *  f(MNOŽICA vhodov), ne f(vrstni red odgovora). */
export function sortirajVozniRed(
  vnosi: readonly VozniRedTermin[],
): VozniRedTermin[] {
  return [...vnosi].sort((a, b) => {
    if (a.datumZacetka !== b.datumZacetka) return a.datumZacetka < b.datumZacetka ? -1 : 1
    if (a.projekt !== b.projekt) {
      if (a.projekt === null) return 1
      if (b.projekt === null) return -1
      return a.projekt < b.projekt ? -1 : 1
    }
    return 0
  })
}

export interface VozniRedPovzetek {
  /** Št. terminov na vozno redu (= sortirane.length; preklicani VIDNO). */
  terminovN: number
  /** Vsota predvidenih ur samo po vrsticah Z znano uro (KPI AMBER — delo,
   *  ki ga vozni red pokrije; ISTA izpeljava kot vsotaPredvidenihUr zaslon). */
  nacrtovaneUre: number
  /** Št. vrstic brez znane ure (R168 null — KPI '≥' meja, NIKOLI tiho 0). */
  brezUre: number
  /** Št. različnih ekip (distinct ne-null ekipa; null = NE štet — ekipa ni
   *  še znana, izmišljenih ekip NIČ). */
  ekipN: number
  /** Št. zaključenih (ZAKLJUČENO status — KPI GREEN resnica). */
  zakljucenih: number
}

/** Agregatna izpeljava vozno reda — ENA resnica za PDF KPI, sklep IN toast
 *  (WYSIWYG). Štetja po SORTIRANEM redu — f(MNOŽICA), ne f(vrstni red
 *  odgovora) (FP vzorec R248/R250/R252/R253). */
export function vozniRedPovzetek(
  vnosi: readonly VozniRedTermin[],
): VozniRedPovzetek {
  if (vnosi.length === 0) {
    throw new TypeError(
      'vozniRedPovzetek: prazen vozni red nima terminov — prazna množica ne nastaja dokumenta (fail-closed, NIKOLI izmišljen)',
    )
  }
  const sortirane = sortirajVozniRed(vnosi)
  let nacrtovaneUre = 0
  let brezUre = 0
  let zakljucenih = 0
  const ekipe = new Set<string>()
  for (const t of sortirane) {
    if (t.predvideneUre === null) brezUre++
    else nacrtovaneUre += t.predvideneUre
    if (t.status === 'ZAKLJUCENO') zakljucenih++
    if (t.ekipa !== null) ekipe.add(t.ekipa.trim())
  }
  return { terminovN: sortirane.length, nacrtovaneUre, brezUre, ekipN: ekipe.size, zakljucenih }
}

/** KPI vrednost 'Načrtovane ure' — ISTI '≥' signal kot povzetek na zaslonu
 *  (terminUrPovzetek: '≥' ko ure manjkajo — vsota je spodnja meja, NIKOLI
 *  lažno popolna). */
export function vozniRedUreKpi(pov: VozniRedPovzetek): string {
  return pov.brezUre > 0 ? `≥ ${pov.nacrtovaneUre}` : String(pov.nacrtovaneUre)
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

/** KPI polje — ISTI vzorec kot prihodki/opomnik/potekli/koledar družina. */
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

/** Zgradi VOZNI RED MONTAŽ dokument (brez shranjevanja) — vrne jsPDF instanco
 *  (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildVozniRedPdfDoc(
  vnosi: readonly VozniRedTermin[],
  options: VozniRedOptions,
): jsPDF {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('buildVozniRedPdfDoc: pričakovano polje terminov (VozniRedTermin[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildVozniRedPdfDoc: pričakovane opcije (VozniRedOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildVozniRedPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN VOZNI RED ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vidnih terminov montaže.').
  if (vnosi.length === 0) {
    throw new TypeError(
      'buildVozniRedPdfDoc: prazen vozni red ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vidnih terminov montaže.)',
    )
  }
  vnosi.forEach((t, i) => preveriVozniRedTermin(t, i))
  const sortirane = sortirajVozniRed(vnosi)
  const pov = vozniRedPovzetek(sortirane)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${sortirane
        .map((t) => `${t.datumZacetka}/${t.status}/${t.projekt ?? ''}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot boss-report družina) ----------
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
  doc.text('VOZNI RED MONTAŽ', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI trio (Terminov + Načrtovane ure + Zaključenih — ISTI
  //  barvni jezik kot značke na zaslonu: delo AMBER / zaključeno GREEN /
  //  skupaj NAVY) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Kronološki vozni red')
  const bw = 59
  const bh = 16
  const gap = 2.5
  kpiBox(doc, 14, y, bw, bh, 'Terminov', String(pov.terminovN), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Načrtovane ure', vozniRedUreKpi(pov), AMBER)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Zaključenih', String(pov.zakljucenih), GREEN)
  y += bh + 8

  // ---------- tabela (kronološki red — najbližji termin prvi) ----------
  y = sectionTitle(doc, y, `Termini (${sortirane.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Čas', 'Projekt', 'Stranka', 'Ekipa', 'Status', 'Ure', 'Lokacija']],
    body: sortirane.map((t) => [
      cenikDatumIso(t.datumZacetka),
      vozniRedCasOkno(t),
      t.projekt ?? '—',
      t.stranka ?? '—',
      t.ekipa ?? '—',
      SCHEDULE_TERMINI_STATUS_LABELS[t.status],
      t.predvideneUre === null ? '—' : String(t.predvideneUre),
      t.lokacija ?? '—',
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 18, halign: 'right' },
      1: { cellWidth: 21, halign: 'right' },
      5: { cellWidth: 19, halign: 'center' },
      6: { cellWidth: 11, halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG z zaslonom: status = ISTI signal kot značka na kartici —
      // V_TEKU amber (delo v teku), ZAKLJUČENO green, PREKLIČANO rdeče bold
      // (iskren vidni odpad), PRELOŽENO sivo, NAČRTOVANO navy; '—' v ekipi/
      // lokaciji sivo (iskrena null resnica).
      if (data.section === 'body' && data.column.index === 5) {
        const label = String(data.cell.raw ?? '')
        if (label === SCHEDULE_TERMINI_STATUS_LABELS.V_TEKU) {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        } else if (label === SCHEDULE_TERMINI_STATUS_LABELS.ZAKLJUCENO) {
          data.cell.styles.textColor = GREEN
        } else if (label === SCHEDULE_TERMINI_STATUS_LABELS.PREKlicANO) {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        } else if (label === SCHEDULE_TERMINI_STATUS_LABELS.PRELOZENO) {
          data.cell.styles.textColor = GRAY
        } else if (label === SCHEDULE_TERMINI_STATUS_LABELS.NAVRTENO) {
          data.cell.styles.textColor = NAVY
        }
      }
      if (data.section === 'body' && (data.column.index === 2 || data.column.index === 3 || data.column.index === 4 || data.column.index === 6 || data.column.index === 7)) {
        if (String(data.cell.raw ?? '') === '—') {
          data.cell.styles.textColor = GRAY
        }
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (ISTA sklanjatev družine + iskren podpis) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${pov.terminovN} terminov · ${vozniRedUreKpi(pov)} načrtovanih ur${pov.brezUre > 0 ? ` (${pov.brezUre} brez ure)` : ''} · ${pov.ekipN} ekip · ${pov.zakljucenih} zaključenih · kronološki red (najbližji termin prvi) · vir = vidni termini logistike.`,
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

/** Ime datoteke — `Vozni-red-montaz-YYYY-MM-DD.pdf` (ISTI vzorec kot
 *  koledarPregledovPdfFilename R253 / potekliOpomnikiPdfFilename R252 /
 *  opomnikPdfFilename R251; EN now za žig IN ime — lekcija R121/R235). */
export function vozniRedPdfFilename(now: Date): string {
  return `Vozni-red-montaz-${todayStamp(now)}.pdf`
}

/** Zgeneriraj Vozni red montaž PDF (determinističen — enak vhod = bajtno
 *  enak dokument) in ga shrani kot `Vozni-red-montaz-YYYY-MM-DD.pdf`. */
export function generateVozniRedPdf(
  vnosi: readonly VozniRedTermin[],
  options: VozniRedOptions,
): void {
  const doc = buildVozniRedPdfDoc(vnosi, options)
  doc.save(vozniRedPdfFilename(options.now))
}
