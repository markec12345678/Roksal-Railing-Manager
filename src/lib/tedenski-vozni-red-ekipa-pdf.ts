// ---------------------------------------------------------------------------
// R303 (P1, 'izvozi' družina — 33. člen) — VODJA TEDENSKI VOZNI RED PO EKIPAH
// PDF iz logistike (logistics-tab). IZPELJANI BRAT ICS po ekipah R299 (ki je
// izpeljani brat ICS R298 — brat PDF R256 + CSV R292): naslednjih 7 dni,
// ENA SEKCIJA NA EKIPO — vodja dobi EN tisk z vsemi ekipami (per-ekipa ICS
// R299 je za posameznega člana — telefon uvozi samo svoje; ta dokument je za
// VODJO, ki razporeja delo po ekipah NA EN POGLED). ISTA koledarska resnica
// kot R256/R299 — WYSIWYG po konstrukciji (isti razgled, isti sort, isti
// status prikaz).
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • okno = tedenskiOknoDnevi (UVOŽENO iz R256 — ISTA UTC aritmetika
//    danes..danes+6 kot cela tedenska družina R256/R292/R298/R299/R300);
//  • ekipa seznam = tedenskiEkipaImena (UVOŽEN iz R299 — UNIQUE, ASC UTF-16
//    po kanonu R245/R250, null IZKLJUČENE, f(množica); ISTA preverba
//    preveriVozniRedTermin z indeksom krivca — ENA preverba za cel lib);
//  • filter na ekipo = ISTI TOČEN nizovni primerjava princip kot R299
//    (NIKOLI trim/normalizacija — vir VERBATIM, izmišljena ujemanja ne
//    obstajajo);
//  • per-ekipa povzetek = tedenskiPregledPovzetek (UVOŽEN iz R256 — ISTI
//    KPI agregat + '≥' resnica) + tedenskiUreKpi (UVOŽEN — ISTI javni
//    kontrakt 'brez ure = spodnja meja, NIKOLI lažno popolna');
//  • sort znotraj ekipe = sortirajVozniRed (UVOŽEN iz R255 — čas ASC,
//    izenačba projekt ASC, null ZADNJI — NIČ dvojnega sortiranja);
//  • status prikaz = SCHEDULE_TERMINI_STATUS_LABELS (UVOŽENI — ISTI VERBATIM
//    prikazi kot R256/R292/R301 bratje);
//  • žig = zalogaPovzetekCasOznaka (UVOŽEN — ISTI 'osveženo/Generirano' kot
//    PDF bratje R250/R256/R257/R263/R302) + cenikDatumIso (UVOŽEN — ISTI
//    izpis DD. MM. YYYY okna kot meta bratje).
//
// DOMAIN pravilo (mirror R299 ekipa vrata; družina R266/R297/R301/R302):
//  • izvoz OBSTAJA samo, če okno vsebuje vsaj EKIPO z vsaj enim terminom —
//    0 ekip (prazno okno ALI samo termini brez ekipe) → TypeError (iskrena
//    vrata; komponenta pokaže iskren toast ŠE PRED klicem — lib dvakrat
//    brani; NIKOLI prazna datoteka);
//  • termini BREZ ekipe ('—') NISO sekcije (ekipa '—' ne obstaja — ISTI
//    princip kot R299 čipi), ampak NISO tiho izgubljeni: sklep vrstica
//    izreče ISKREN števec 'brez ekipe: N' (vidni odpad — vzorec R256
//    preklicanih: NIKOLI utišan).
//
// Načela (družinska pravila):
//  • Fail-closed: ne-polje / pokvaren vnos (uvožen pregled — indeks krivca
//    VEDNO v sporočilu) / pokvaren now / 0 ekip → TypeError (nikoli tiho
//    spregledano).
//  • Determinizem: `now` KOT parameter (F4 — jedro ne bere ure);
//    doc.setCreationDate(now) + doc.setFileId(FNV-1a) — enak vhod = bajtno
//    enak PDF (document-pdf R121); skupine ASC UTF-16 f(množica) + vrstice
//    sortirajVozniRed — premešan vhod = bajtno ISTI dokument; seed =
//    kanonizirana serijalizacija pregleda (NIKOLI vrstni red odgovora).
//  • CLIENT-safe: čisti klientski lib (uvozi ga logistics-tab) — čista JS
//    FNV-1a; LASTNI soli **0xbd–0xc0** (register: tedenski 0x75–0x78,
//    terenski-zapisni 0xb5–0xb8, konflikti 0xb9–0xbc → ekipe 0xbd–0xc0 —
//    ista semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import {
  tedenskiOknoDnevi,
  tedenskiPregledPovzetek,
  tedenskiUreKpi,
  tedenskiDanIme,
  type TedenskiPregledPovzetek,
} from './tedenski-vozni-red-pdf'
import { tedenskiEkipaImena } from './tedenski-vozni-red-ekipa-ics'
import {
  sortirajVozniRed,
  type VozniRedTermin,
} from './logistika-vozni-red-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from './termini-prikaz'
import { cenikDatumIso } from './cenik-pdf'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'

// ---------- barve (ISTI dokumenti družina — usklajeno z R256/R302) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green (prihodki R250)
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

export interface TedenskiEkipaSkupina {
  /** Ekipa VERBATIM (isto ime kot vir — NIČ pretvorbe). */
  ekipa: string
  /** Termini te ekipe V OKNU — sortirajVozniRed (čas ASC, projekt ASC,
   *  null ZADNJI). */
  termini: VozniRedTermin[]
  /** Povzetek FILTRIRANE množice (uvožen tedenskiPregledPovzetek — ISTI
   *  agregat kot R256 KPI). */
  pov: TedenskiPregledPovzetek
}

export interface TedenskiEkipaPregled {
  /** 7 ISO datumov ASC (danes..danes+6, UTC) — UVOŽENO okno. */
  okno: string[]
  /** Sekcije po ekipah — ASC UTF-16 (EN VIR tedenskiEkipaImena f(množica)). */
  skupine: TedenskiEkipaSkupina[]
  /** Vsota terminov po ekipa sekcijah (= pov.terminovN vsota). */
  terminovVEkipah: number
  /** Vsota načrtovanih ur po ekipa sekcijah (samo vrstice z znano uro). */
  nacrtovaneUre: number
  /** Vsota vrstic brez znane ure po ekipa sekcijah ('≥' meja — NIKOLI tiho 0). */
  brezUre: number
  /** Vsota preklicanih po ekipa sekcijah (iskren odpad — VIDNO RED bold). */
  preklicanih: number
  /** Iskren števec terminov v oknu BREZ ekipe (null) — NISO sekcije (ekipa
   *  '—' ne obstaja, ISTI princip kot R299), ampak NISO tiho izgubljeni. */
  brezEkipe: number
  /** Vseh terminov v oknu (= terminovVEkipah + brezEkipe — ISTO resnica
   *  obsega kot R256 KPI 'Terminov'). */
  terminovSkupaj: number
}

/** Agregatna izpeljava razgleda PO EKIPAH — ENA resnica za KPI, sekcije,
 *  sklep IN toast (WYSIWYG). Okno = danes..danes+6 (UTC, uvoženo). Vrne
 *  null, ko je št. ekip v oknu 0 (iskrena praznina — komponenta pokaže
 *  toast, NIKOLI prazna datoteka; mirror R299 ekipa vrata); pokvaren vnos →
 *  TypeError z indeksom krivca (uvožen pregled — ENA preverba). Štetja po
 *  SORTIRANEM redu — f(množica), ne f(vrstni red odgovora) (FP vzorec
 *  R248/R250/R252/R253). */
export function tedenskiEkipaPregled(
  vnosi: readonly VozniRedTermin[],
  now: Date,
): TedenskiEkipaPregled | null {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiEkipaPregled: pričakovan veljaven now: Date')
  }
  if (!Array.isArray(vnosi)) {
    throw new TypeError('tedenskiEkipaPregled: pričakovano polje terminov (VozniRedTermin[])')
  }
  // EN VIR ekipa seznam (uvožen R299 — preveri VSE vhode z indeksom krivca,
  // UNIQUE ASC UTF-16, null izključeni).
  const imena = tedenskiEkipaImena(vnosi, now)
  if (imena.length === 0) return null
  const okno = tedenskiOknoDnevi(now)
  const vOknu = new Set(okno)
  const skupine: TedenskiEkipaSkupina[] = []
  let terminovVEkipah = 0
  let nacrtovaneUre = 0
  let brezUre = 0
  let preklicanih = 0
  for (const ekipa of imena) {
    const filtrirani = sortirajVozniRed(
      vnosi.filter((t) => t.ekipa === ekipa && vOknu.has(t.datumZacetka.slice(0, 10))),
    )
    const pov = tedenskiPregledPovzetek(filtrirani, now)
    if (pov === null) {
      // Nedosegljivo po preverbi uvoženega seznama (ekipa je v seznamu
      // SAMO z ≥ 1 terminom v oknu — domain pravilo R299); fail-closed
      // obramba, ne tiho prazna sekcija.
      throw new TypeError(
        `tedenskiEkipaPregled: ekipa ${ekipa} ima 0 terminov v oknu (neusklajena preverba — abort)`,
      )
    }
    skupine.push({ ekipa, termini: filtrirani, pov })
    terminovVEkipah += pov.terminovN
    nacrtovaneUre += pov.nacrtovaneUre
    brezUre += pov.brezUre
    preklicanih += pov.preklicanih
  }
  let brezEkipe = 0
  let terminovSkupaj = 0
  for (const t of vnosi) {
    if (!vOknu.has(t.datumZacetka.slice(0, 10))) continue
    terminovSkupaj++
    if (t.ekipa === null) brezEkipe++
  }
  if (terminovSkupaj !== terminovVEkipah + brezEkipe) {
    // Nedosegljivo po konstrukciji (particija okna: ekipa !== null ↔ null);
    // fail-closed obramba — iskren abort, ne lažna resnica obsega.
    throw new TypeError(
      'tedenskiEkipaPregled: neusklajena particija okna (ekipe + brez ekipe ≠ skupaj — abort)',
    )
  }
  return { okno, skupine, terminovVEkipah, nacrtovaneUre, brezUre, preklicanih, brezEkipe, terminovSkupaj }
}

/** Sklep pregleda — ENA resnica za PDF sklepno vrstico IN toast komponente
 *  (WYSIWYG po konstrukciji — vzorec konfliktiSklep R301). Iskren '≥' za
 *  ure (uvožen tedenskiUreKpi — NIKOLI lažno popolna vsota) + iskren
 *  brez-ekipe števec (vidni odpad — NIKOLI utišan). */
export function tedenskiEkipaPdfSklep(pregled: TedenskiEkipaPregled): string {
  const brezUreDel = pregled.brezUre > 0 ? ` (${pregled.brezUre} brez ure)` : ''
  const brezEkipeDel =
    pregled.brezEkipe > 0
      ? ` · brez ekipe: ${pregled.brezEkipe} (brez sekcije)`
      : ''
  return (
    `Ekip: ${pregled.skupine.length} · terminov po ekipah: ${pregled.terminovVEkipah} · ` +
    `${tedenskiUreKpi({ nacrtovaneUre: pregled.nacrtovaneUre, brezUre: pregled.brezUre })} načrtovanih ur${brezUreDel} · ` +
    `preklicanih ${pregled.preklicanih}${brezEkipeDel}`
  )
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0xbd–0xc0. */
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
    fnv1aHex(seed, 0xbd) +
    fnv1aHex(seed, 0xbe) +
    fnv1aHex(seed, 0xbf) +
    fnv1aHex(seed, 0xc0)
  )
}

/** Kanoniziran seed pregleda — pregled je ŽE kanon f(množica) (skupine ASC
 *  UTF-16, vrstice sortirajVozniRed po konstrukciji), serijalizacija =
 *  določevalna funkcija vsebine (premešan vhod → ISTI pregled → ISTI seed). */
function pregledSeed(pregled: TedenskiEkipaPregled): string {
  return `G:${pregled.skupine
    .map(
      (s) =>
        `${s.ekipa}#${s.termini
          .map((t) => `${t.datumZacetka}/${t.status}/${t.projekt ?? ''}`)
          .join(',')}`,
    )
    .join(';')}|BE:${pregled.brezEkipe}`
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

/** KPI polje — ISTI vzorec kot R256/R263/R302 (družinski kpiBox). */
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

export interface TedenskiEkipaPdfOptions {
  /** Referenčni trenutek (žig + okno + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R121/R203/R250/R256/R299/R302). */
  now: Date
}

/** Zgradi TEDENSKI VOZNI RED PO EKIPAH dokument (brez shranjevanja) — vrne
 *  jsPDF instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi).
 *  DOMAIN pravilo: 0 ekip v oknu → TypeError (mirror R299 — ni prazne
 *  datoteke; komponenta pokaže iskren toast ŠE PRED klicem — lib dvakrat
 *  brani). */
export function buildTedenskiEkipaPdfDoc(
  vnosi: readonly VozniRedTermin[],
  options: TedenskiEkipaPdfOptions,
): jsPDF {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('buildTedenskiEkipaPdfDoc: pričakovano polje terminov (VozniRedTermin[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildTedenskiEkipaPdfDoc: pričakovane opcije (TedenskiEkipaPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildTedenskiEkipaPdfDoc: pričakovan veljaven now: Date')
  }
  const pregled = tedenskiEkipaPregled(vnosi, now)
  if (pregled === null) {
    throw new TypeError(
      'buildTedenskiEkipaPdfDoc: ni ekip z termini v 7-dnevnem oknu — datoteka se izvozi, ko ima ekipa vpisan termin (mirror R299; ni prazne datoteke — družina R266/R297/R301/R302)',
    )
  }
  // Sekundarna obramba: vsaka sekcija ima vsaj 1 termin (domain pravilo
  // R299 uvoženo — nedosegljivo po preverbi; abort ne tiha prazna sekcija).
  pregled.skupine.forEach((s, i) => {
    if (s.termini.length === 0) {
      throw new TypeError(
        `buildTedenskiEkipaPdfDoc: sekcija ${i} (${s.ekipa}) brez terminov (neusklajena preverba — abort)`,
      )
    }
  })

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / R256/R302) ----------
  doc.setCreationDate(now)
  doc.setFileId(deterministichenId(`${now.toISOString()}|${pregledSeed(pregled)}`))

  // ---------- glava (ISTI vzorec kot R256/R302) ----------
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
  doc.text('TEDENSKI VOZNI RED PO EKIPAH', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI ×4 (Ekip + Terminov po ekipah + Načrtovane ure + Okvir —
  //  ISTI barvni jezik kot R256: skupaj NAVY / delo AMBER / razgled GREEN) ----------
  let y = 33
  y = sectionTitle(doc, y, `Naslednjih 7 dni: ${cenikDatumIso(pregled.okno[0])} – ${cenikDatumIso(pregled.okno[6])}`)
  const bw = 44
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Ekip', String(pregled.skupine.length), GREEN)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Terminov po ekipah', String(pregled.terminovVEkipah), NAVY)
  kpiBox(
    doc,
    14 + 2 * (bw + gap),
    y,
    bw,
    bh,
    'Načrtovane ure',
    tedenskiUreKpi({ nacrtovaneUre: pregled.nacrtovaneUre, brezUre: pregled.brezUre }),
    AMBER,
  )
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Okvir 7 dni', `${cenikDatumIso(pregled.okno[0])} – ${cenikDatumIso(pregled.okno[6])}`, NAVY)
  y += bh + 8

  // ---------- sekcije po ekipah (ENA sekcija na ekipo — ASC UTF-16 EN VIR
  //  tedenskiEkipaImena; znotraj ekipe sortirajVozniRed: čas ASC, izenačba
  //  projekt ASC, null ZADNJI) ----------
  for (const skupina of pregled.skupine) {
    if (y > 240) {
      doc.addPage()
      y = 20
    }
    y = sectionTitle(doc, y, `${skupina.ekipa} · ${skupina.pov.terminovN} terminov`)
    autoTable(doc, {
      startY: y,
      head: [['Dan', 'Čas', 'Projekt', 'Stranka', 'Status', 'Ure', 'Lokacija']],
      body: skupina.termini.map((t) => {
        const danIso = t.datumZacetka.slice(0, 10)
        return [
          // Dan EN VIR tedenskiDanIme (UVOŽEN iz R256 — ISTI fiksni slovenski
          // seznam, getUTCDay čista UTC aritmetika — NIKOLI locale izpis).
          `${tedenskiDanIme(danIso)} ${danIso.slice(8, 10)}.${danIso.slice(5, 7)}.`,
          t.datumKonca === null
            ? `${t.datumZacetka.slice(11, 13)}:${t.datumZacetka.slice(14, 16)}`
            : `${t.datumZacetka.slice(11, 13)}:${t.datumZacetka.slice(14, 16)}–${t.datumKonca.slice(11, 13)}:${t.datumKonca.slice(14, 16)}`,
          t.projekt ?? '—',
          t.stranka ?? '—',
          SCHEDULE_TERMINI_STATUS_LABELS[t.status],
          t.predvideneUre === null ? '—' : String(t.predvideneUre),
          t.lokacija ?? '—',
        ]
      }),
      styles: { fontSize: 7.5, cellPadding: 1.6, font: 'Roboto' },
      headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 19, halign: 'center' },
        5: { cellWidth: 11, halign: 'right' },
      },
      didParseCell: (data) => {
        // WYSIWYG z zaslonom: ISTI signal kot R256 — V_TEKU amber, ZAKLJUČENO
        // green, PREKLIČANO rdeče bold (iskren vidni odpad), PRELOŽENO sivo,
        // NAVRTENO navy; '—' sivo (iskrena null resnica — R227 strogost).
        if (data.section === 'body' && data.column.index === 4) {
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
        if (data.section === 'body' && (data.column.index === 2 || data.column.index === 3 || data.column.index === 5 || data.column.index === 6)) {
          if (String(data.cell.raw ?? '') === '—') {
            data.cell.styles.textColor = GRAY
          }
        }
      },
    })
    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
    y += 6
  }

  // ---------- sklepna vrstica (EN VIR tedenskiEkipaPdfSklep — ISTO besedilo
  //  kot toast; iskren brez-ekipe števec — vidni odpad NIKOLI utišan) ----------
  if (y > 248) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(tedenskiEkipaPdfSklep(pregled), 14, y + 4)
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text(
    `Obseg okna: ${cenikDatumIso(pregled.okno[0])} – ${cenikDatumIso(pregled.okno[6])} (danes + 6 dni, UTC) · Terminov skupaj v oknu: ${pregled.terminovSkupaj} · Izvoženo ob ${now.toISOString()}`,
    14,
    y + 9,
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

/** Ime datoteke — `Tedenski-po-ekipah-YYYY-MM-DD.pdf` (družinski vzorec;
 *  ISTA dnevna resnica kot bratje R256/R292/R298/R299; deterministično
 *  glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function tedenskiEkipaPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('tedenskiEkipaPdfFilename: pričakovan veljaven now: Date')
  }
  return `Tedenski-po-ekipah-${todayStamp(now)}.pdf`
}

/** Zgeneriraj VODJA TEDENSKI PDF PO EKIPAH (determinističen — enak vhod =
 *  bajtno enak dokument) in ga shrani kot `Tedenski-po-ekipah-YYYY-MM-DD.pdf`. */
export function generateTedenskiEkipaPdf(
  vnosi: readonly VozniRedTermin[],
  options: TedenskiEkipaPdfOptions,
): void {
  const doc = buildTedenskiEkipaPdfDoc(vnosi, options)
  doc.save(tedenskiEkipaPdfFilename(options.now))
}
