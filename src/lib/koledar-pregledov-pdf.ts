// ---------------------------------------------------------------------------
// R253 (P1-f, 'izvozi' družina — 10. člen) — KOLEDAR PREGLEDOV PDF iz CRM
// (crm-tab). Vzorec potekli-opomniki-pdf R252 / opomnik-pdf R251 / prihodki-
// pdf R250: ROKSAL glava, KPI, autoTable, noge, bajtni determinizem.
//
// LOČEN dokument od akcijskega seznama poteklih (R252): ta dokument je
// ČASOVNA VRSTA — VSE stranke z VPISANIM datumom pregleda (AKTIVEN + POTEKEL)
// na ENEM koledarju, najbližji pregled prvi (koledarski red). Evalvacija
// (worklog R253): polni 'koledar' z NI-datum sekcijo = hrup (na produkciji
// bi to bile VSE stranke — NI NI signal, ampak manjkajoči vpis); zato ta
// dokument pokriva SAMO vpisane preglede — brez-datuma stranke NISO izmišljene
// kot vrstice (fail-closed do resnice), njihovo manjkanje pove sklepna
// KPI/tabela resnica prek statusov, ne izmišljenih vrstic.
// ENA resnica z zaslonom (WYSIWYG — brat iz ISTEGA vira):
//  • vir podatkov = GET /api/crm (odgovor, ki ga CrmTab že izriše) — route
//    NIČ (client+lib only);
//  • izbira = opomnikStatus !== 'NI' (VERBATIM iz API-ja — AKTIVEN = do 7 dni
//    'v tem tednu', POTEKEL = prek datuma; ISTI izračun kot žig na kartici);
//    lib PREVERI, da je vsak vnos AKTIVEN ALI POTEKEL (NI vnos na seznamu =
//    pokvarena izpeljava → TypeError, NIKOLI tiho spregledan);
//  • dni do = ISTA formula kot API (Math.floor(diff / 86400000)) z `now` KOT
//    PARAMETER. MONOTONIJA (dokazana v testih): klik ≥ fetch → za AKTIVEN je
//    dni do ≤ 7 (nikoli več — pregled ne odmik), za POTEKEL je dni do ≤ −1
//    (isti dokaz kot R252 'dni prek ≥ 1'). ROB (iskreno dokumentiran): pregled
//    lahko POTEČE med fetchom in klikom — AKTIVEN vrstica (status = fetch
//    resnica VERBATIM) lahko pokaže negativen 'Dni do' (klik resnica) — to je
//    ISKREN signal, NIKOLI izmišljen pozitiven;
//  • sort = opomnikDatum ASC (koledarski red — najbližji pregled prvi),
//    izenačba ime ASC (navadno < — localeCompare NE, vzorec R245/R250/R252);
//    sort interno PRED štetji (FP vzorec R248/R250/R252).
//
// Načela (družinska pravila — ISTA kot potekli R252):
//  • Fail-closed: PRAZEN KOLEDAR ne nastaja dokumenta (družina: ni prazne
//    datoteke — komponenta pokaže iskren toast); pokvaren vnos → TypeError z
//    indeksom krivca.
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (R121 100×).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0x6d–0x70** (register:
//    prihodki 0x61–64, opomnik 0x65–68, potekli 0x69–6c → koledar 0x6d–0x70
//    — ista semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez ENE vrstice koledarja pregledov (polja iz GET /api/crm —
 *  ISTI odgovor, ki ga CrmTab izriše). ENA stranka = ENA pregledana vrstica. */
export interface KoledarPregledVnos {
  /** Stranka (ne-prazen niz). */
  ime: string
  /** Naslov (ne-prazen niz — obvezno za akcijo). */
  naslov: string
  /** Kontakt: null ALI ne-prazen niz. */
  telefon: string | null
  kontaktnaOseba: string | null
  /** ISO niz (YYYY-MM-DD…) — vpisani datum pregleda (obvezujóč: status NI */
  /** na koledarju NIČ). */
  opomnikDatum: string
  /** Opis naloge: null ALI ne-prazen niz ('—' = brez opisa, iskreno). */
  opomnikOpis: string | null
  /** Status VERBATIM iz API-ja — MORA biti 'AKTIVEN' ALI 'POTEKEL' (koledar =
   *  izpeljava iz statusa; 'NI' = brez vpisanega datuma → NIČ na koledarju,
   *  kajti izmišljeni pregled NE obstaja). */
  opomnikStatus: 'AKTIVEN' | 'POTEKEL'
}

export interface KoledarPregledOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime + DNI resnica) —
   *  KOT PARAMETER (determinizem; vzorec R203/R244/R250/R251/R252). */
  now: Date
}

/** Fail-closed preverba vrstice koledarja (obvezna polja + AKTIVEN/POTEKEL
 *  pravica; indeks krivca je VEDNO v sporočilu — družina R236/R250/R251/R252). */
export function preveriKoledarVnos(p: KoledarPregledVnos, i: number): void {
  if (!p || typeof p !== 'object') {
    throw new TypeError(`preveriKoledarVnos (${i}): pričakovana CRM stranka (KoledarPregledVnos)`)
  }
  for (const [k, v] of [
    ['ime', p.ime],
    ['naslov', p.naslov],
  ] as const) {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriKoledarVnos (${i}): ${k} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  if (typeof p.opomnikDatum !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(p.opomnikDatum)) {
    throw new TypeError(`preveriKoledarVnos (${i}): opomnikDatum mora biti ISO niz YYYY-MM-DD…, ne ${String(p.opomnikDatum)}`)
  }
  if (p.opomnikStatus !== 'AKTIVEN' && p.opomnikStatus !== 'POTEKEL') {
    throw new TypeError(`preveriKoledarVnos (${i}): koledar je izpeljava iz opomnikStatus — vnos brez vpisanega datuma (${String(p.opomnikStatus)}) ne nastaja kot pregled, pokvaren vir`)
  }
  for (const [k, v] of [
    ['telefon', p.telefon],
    ['kontaktnaOseba', p.kontaktnaOseba],
    ['opomnikOpis', p.opomnikOpis],
  ] as const) {
    if (v !== null && (typeof v !== 'string' || v.trim() === '')) {
      throw new TypeError(`preveriKoledarVnos (${i}): ${k} mora biti null ALI ne-prazen niz, ne ${String(v)}`)
    }
  }
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x6d–0x70: vsak PDF lib družine ima svoje). */
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
    fnv1aHex(seed, 0x6d) +
    fnv1aHex(seed, 0x6e) +
    fnv1aHex(seed, 0x6f) +
    fnv1aHex(seed, 0x70)
  )
}

/** Dni do pregleda — ISTA formula kot API (Math.floor(diff / 86400000)), now
 *  KOT PARAMETER. Za AKTIVEN vnos je rezultat ob kliku ≤ 7 (monotomija:
 *  pregled ne odmikajo), za POTEKEL ≤ −1 (dni prek ≥ 1 — R252 dokaz). Negativen
 *  'Dni do' na AKTIVEN vrstici = pregled potekel med fetchom in klikom —
 *  ISKREN klik resnica (status ostane fetch resnica VERBATIM). */
export function koledarDniDo(
  p: Pick<KoledarPregledVnos, 'opomnikDatum'>,
  now: Date,
): number {
  const datum = new Date(p.opomnikDatum)
  return Math.floor((datum.getTime() - now.getTime()) / 86400000)
}

/** Sort vrstic V LIBU — opomnikDatum ASC (koledarski red — najbližji pregled
 *  prvi: POTEKEL najstarejši na vrhu časovne vrste, AKTIVEN sledi), izenačba
 *  ime ASC (navadno <, localeCompare NE). IZVOŽEN — determinizem =
 *  f(MNOŽICA vhodov), ne f(vrstni red odgovora). */
export function sortirajKoledar(
  vnosi: readonly KoledarPregledVnos[],
): KoledarPregledVnos[] {
  return [...vnosi].sort((a, b) => {
    if (a.opomnikDatum !== b.opomnikDatum) return a.opomnikDatum < b.opomnikDatum ? -1 : 1
    if (a.ime !== b.ime) return a.ime < b.ime ? -1 : 1
    return 0
  })
}

export interface KoledarPovzetek {
  /** Št. vpisanih pregledov (= sortirane.length). */
  preglediN: number
  /** Št. 'v tem tednu' — AKTIVEN status VERBATIM (do 7 dni ob fetch-u). */
  vTemTednu: number
  /** Št. poteklih — POTEKEL status VERBATIM (prek datuma). */
  poteklih: number
}

/** Agregatna izpeljava koledarja — ENA resnica za PDF KPI, sklep IN toast
 *  (WYSIWYG). Štetja po SORTIRANEM redu — f(MNOŽICA), ne f(vrstni red
 *  odgovora) (FP vzorec R248/R250/R252). */
export function koledarPovzetek(
  vnosi: readonly KoledarPregledVnos[],
): KoledarPovzetek {
  if (vnosi.length === 0) {
    throw new TypeError(
      'koledarPovzetek: prazen koledar nima pregledov — prazna množica ne nastaja dokumenta (fail-closed, NIKOLI izmišljen)',
    )
  }
  const sortirane = sortirajKoledar(vnosi)
  let vTemTednu = 0
  let poteklih = 0
  for (const p of sortirane) {
    if (p.opomnikStatus === 'AKTIVEN') vTemTednu++
    else poteklih++
  }
  return { preglediN: sortirane.length, vTemTednu, poteklih }
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

/** KPI polje — ISTI vzorec kot prihodki/opomnik/potekli družina. */
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

/** Zgradi KOLEDAR PREGLEDOV dokument (brez shranjevanja) — vrne jsPDF instanco
 *  (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildKoledarPregledovPdfDoc(
  vnosi: readonly KoledarPregledVnos[],
  options: KoledarPregledOptions,
): jsPDF {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('buildKoledarPregledovPdfDoc: pričakovano polje pregledov (KoledarPregledVnos[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildKoledarPregledovPdfDoc: pričakovane opcije (KoledarPregledOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildKoledarPregledovPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN KOLEDAR ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih pregledov.').
  if (vnosi.length === 0) {
    throw new TypeError(
      'buildKoledarPregledovPdfDoc: prazen koledar ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih pregledov.)',
    )
  }
  vnosi.forEach((p, i) => preveriKoledarVnos(p, i))
  const sortirane = sortirajKoledar(vnosi)
  const pov = koledarPovzetek(sortirane)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${sortirane
        .map((p) => `${p.ime.trim()}/${p.opomnikDatum}/${p.opomnikStatus}`)
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
  doc.text('KOLEDAR PREGLEDOV', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI trio (Pregledov + V tem tednu + Poteklih — ISTI barvni
  //  jezik kot žigi na karticah: POTEKEL RED / AKTIVEN AMBER / skupaj NAVY) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Časovna vrsta pregledov')
  const bw = 59
  const bh = 16
  const gap = 2.5
  kpiBox(doc, 14, y, bw, bh, 'Pregledov', String(pov.preglediN), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'V tem tednu', String(pov.vTemTednu), AMBER)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Poteklih', String(pov.poteklih), RED)
  y += bh + 8

  // ---------- tabela (koledarski red — najbližji pregled prvi) ----------
  y = sectionTitle(doc, y, `Vpisani pregledi (${sortirane.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Stranka', 'Naslov', 'Telefon', 'Datum', 'Status', 'Dni do', 'Opis']],
    body: sortirane.map((p) => [
      p.ime.trim(),
      p.naslov.trim(),
      p.telefon ?? '—',
      cenikDatumIso(p.opomnikDatum),
      p.opomnikStatus,
      String(koledarDniDo(p, now)),
      p.opomnikOpis ?? '—',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 14, halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG z zaslonom: status POTEKEL rdeče bold / AKTIVEN amber (ISTI
      // signal kot žig na kartici + KPI); 'Dni do' negativen = rdeče bold
      // (pregled potekel med fetchom in klikom — ISKREN klik resnica);
      // '—' v telefonu/opisu sivo (iskrena null resnica).
      if (data.section === 'body' && data.column.index === 4) {
        if (String(data.cell.raw ?? '') === 'POTEKEL') {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        } else if (String(data.cell.raw ?? '') === 'AKTIVEN') {
          data.cell.styles.textColor = AMBER
        }
      }
      if (data.section === 'body' && data.column.index === 5) {
        // raw = ŠTEVILKA dni (String(koledarDniDo(p, now))) — negativna vrednost
        // = prek (iskren klik resnica); Number guard, ker je cell.raw lahko
        // tudi undefined pri praznih celicah (NaN NI < 0 — varno).
        const dni = Number(data.cell.raw)
        if (Number.isFinite(dni) && dni < 0) {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && (data.column.index === 2 || data.column.index === 6)) {
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
    `${pov.preglediN} vpisanih pregledov · ${pov.vTemTednu} v tem tednu (do 7 dni) · ${pov.poteklih} poteklih · koledarski red (najbližji pregled prvi) · vir = opomnikStatus iz CRM.`,
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

/** Ime datoteke — `Koledar-pregledov-YYYY-MM-DD.pdf` (ISTI vzorec kot
 *  potekliOpomnikiPdfFilename R252 / opomnikPdfFilename R251; EN now za žig
 *  IN ime — lekcija R121/R235). */
export function koledarPregledovPdfFilename(now: Date): string {
  return `Koledar-pregledov-${todayStamp(now)}.pdf`
}

/** Zgeneriraj Koledar pregledov PDF (determinističen — enak vhod = bajtno
 *  enak dokument) in ga shrani kot `Koledar-pregledov-YYYY-MM-DD.pdf`. */
export function generateKoledarPregledovPdf(
  vnosi: readonly KoledarPregledVnos[],
  options: KoledarPregledOptions,
): void {
  const doc = buildKoledarPregledovPdfDoc(vnosi, options)
  doc.save(koledarPregledovPdfFilename(options.now))
}
