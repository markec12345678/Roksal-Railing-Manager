// ---------------------------------------------------------------------------
// R252 (P1-f, 'izvozi' družina — 9. člen) — POTEKLI OPOMNIKI PDF (akcijski
// seznam za pisarno) iz CRM (crm-tab). Vzorec opomnik-pdf R251 / prihodki-pdf
// R250: ROKSAL glava, KPI, autoTable, noge, bajtni determinizem.
//
// LOČEN dokument od per-stranko opomnik PDF (R251 — terenski list): ta
// dokument je AGREGATNA resnica — VSE stranke s poteklim opomnikom na ENEM
// seznamu, najstarejši prvi (akcijski red: koga kontaktirati prej).
// ENA resnica z zaslonom (WYSIWYG — brat iz ISTEGA vira):
//  • vir podatkov = GET /api/crm (odgovor, ki ga CrmTab že izriše) — route
//    NIČ (client+lib only);
//  • izbira = opomnikStatus === 'POTEKEL' (VERBATIM iz API-ja — ISTI izračun
//    kot žig 'Opomnik potekel' na kartici: days < 0 ob fetch-u); lib
//    PREVERI, da je vsak vnos POTEKEL (nepotečen vnos na seznamu = pokvarena
//    izpeljava → TypeError, NIKOLI tiho spregledan);
//  • dni prek = ISTA formula kot API (Math.floor(diff / 86400000)) z `now`
//    KOT PARAMETER. MONOTONIJA: klik je ZGODAJ ob fetch-u — dni prek raste s
//    časom, zato je dni prek ob kliku ≥ 1 (POTEKEL pomeni fetch days < 0 →
//    ≥ 1); NIKOLI 'prek 0 dni' (dokazano v testih);
//  • sort = opomnikDatum ASC (najstarejši prvi — akcijski red), izenačba ime
//    ASC (navadno < primerjanje po UTF-16 kodnih točkah — localeCompare NE,
//    vzorec R245/R250); sort interno PRED vsotami (FP vzorec R248/R250).
//
// Načela (družinska pravila — ISTA kot prihodki R250 / opomnik R251):
//  • Fail-closed: PRAZEN SEZNAM ne nastaja dokumenta (družina: ni prazne
//    datoteke — komponenta pokaže iskren toast); pokvaren vnos → TypeError z
//    indeksom krivca.
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (R121 100×).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0x69–0x6c** (register:
//    prihodki 0x61–64, opomnik 0x65–68, potekli 0x69–6c — ista semena v
//    dveh libih NE smejo dati isti ID).
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

/** Client-safe prerez ENE vrstice poteklih opomnikov (polja iz GET /api/crm —
 *  ISTI odgovor, ki ga CrmTab izriše). ENA stranka = ENA vrstica. */
export interface PotekelOpomnikVnos {
  /** Stranka (ne-prazen niz). */
  ime: string
  /** Naslov (ne-prazen niz — obvezno za akcijo). */
  naslov: string
  /** Kontakt: null ALI ne-prazen niz. */
  telefon: string | null
  kontaktnaOseba: string | null
  /** ISO niz (YYYY-MM-DD…) — MORA biti v preteklosti (POTEKEL). */
  opomnikDatum: string
  /** Opis naloge: null ALI ne-prazen niz ('—' = brez opisa, iskreno). */
  opomnikOpis: string | null
  /** Status VERBATIM iz API-ja — MORA biti 'POTEKEL' (ta seznam = izpeljava
   *  iz statusa; karkoli drugega = pokvaren vir → TypeError). */
  opomnikStatus: 'POTEKEL'
}

export interface PotekliOpomnikiOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime + DNI resnica) —
   *  KOT PARAMETER (determinizem; vzorec R203/R244/R250/R251). */
  now: Date
}

/** Fail-closed preverba vrstice poteklih (obvezna polja + POTEKEL pravica;
 *  indeks krivca je VEDNO v sporočilu — družina R236/R250/R251). */
export function preveriPotekliVnos(p: PotekelOpomnikVnos, i: number): void {
  if (!p || typeof p !== 'object') {
    throw new TypeError(`preveriPotekliVnos (${i}): pričakovana CRM stranka (PotekelOpomnikVnos)`)
  }
  for (const [k, v] of [
    ['ime', p.ime],
    ['naslov', p.naslov],
  ] as const) {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriPotekliVnos (${i}): ${k} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  if (typeof p.opomnikDatum !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(p.opomnikDatum)) {
    throw new TypeError(`preveriPotekliVnos (${i}): opomnikDatum mora biti ISO niz YYYY-MM-DD…, ne ${String(p.opomnikDatum)}`)
  }
  if (p.opomnikStatus !== 'POTEKEL') {
    throw new TypeError(`preveriPotekliVnos (${i}): vnos ni POTEKEL (status ${String(p.opomnikStatus)}) — seznam je izpeljava iz opomnikStatus, nepotečen vnos = pokvaren vir`)
  }
  for (const [k, v] of [
    ['telefon', p.telefon],
    ['kontaktnaOseba', p.kontaktnaOseba],
    ['opomnikOpis', p.opomnikOpis],
  ] as const) {
    if (v !== null && (typeof v !== 'string' || v.trim() === '')) {
      throw new TypeError(`preveriPotekliVnos (${i}): ${k} mora biti null ALI ne-prazen niz, ne ${String(v)}`)
    }
  }
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x69–0x6c: vsak PDF lib družine ima svoje). */
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
    fnv1aHex(seed, 0x69) +
    fnv1aHex(seed, 0x6a) +
    fnv1aHex(seed, 0x6b) +
    fnv1aHex(seed, 0x6c)
  )
}

/** Dni prek — ISTA formula kot API (Math.floor(diff / 86400000)), now KOT
 *  PARAMETER. Za POTEKEL vnos (fetch days < 0) je rezultat ≥ 1: klik je
 *  najkasnejši trenutek od fetch-a, floor je monotona — NIKOLI 'prek 0'. */
export function potekelDniPrek(
  p: Pick<PotekelOpomnikVnos, 'opomnikDatum'>,
  now: Date,
): number {
  const datum = new Date(p.opomnikDatum)
  const diff = Math.floor((datum.getTime() - now.getTime()) / 86400000)
  return -diff
}

/** Sort vrstic V LIBU — opomnikDatum ASC (najstarejši prvi — akcijski red),
 *  izenačba ime ASC (navadno <, localeCompare NE). IZVOŽEN — determinizem =
 *  f(MNOŽICA vhodov), ne f(vrstni red odgovora). */
export function sortirajPotekle(
  vnosi: readonly PotekelOpomnikVnos[],
): PotekelOpomnikVnos[] {
  return [...vnosi].sort((a, b) => {
    if (a.opomnikDatum !== b.opomnikDatum) return a.opomnikDatum < b.opomnikDatum ? -1 : 1
    if (a.ime !== b.ime) return a.ime < b.ime ? -1 : 1
    return 0
  })
}

export interface PotekliPovzetek {
  /** Št. poteklih opomnikov (= sortirane.length). */
  potekliN: number
  /** Največ dni prek (max = urejenostna invarianta — f(množica); prazen
   *  seznam → klicatelj je že zavrnil, tu NIKOLI -Infinity). */
  najstarejsi: number
  /** Povprečje dni prek (vsota po SORTIRANEM redu / n — FP vzorec R248). */
  povprecje: number
  /** Povprečje kot prikazni niz (1 decimalna + vejica — ISTI niz KPI + sklep
   *  + toast; vzorec razlikaOdstotekNiz R247). */
  povprecjeNiz: string
}

/** Agregatna izpeljava poteklih — ENA resnica za PDF KPI, sklep IN toast
 *  (WYSIWYG). Vsota po SORTIRANEM redu — FP seštevanje odvisno od vrstnega
 *  reda; rezultat je f(MNOŽICA), ne f(vrstni red odgovora). */
export function potekliPovzetek(
  vnosi: readonly PotekelOpomnikVnos[],
  now: Date,
): PotekliPovzetek {
  if (vnosi.length === 0) {
    throw new TypeError(
      'potekliPovzetek: prazen seznam nima najstarejšega opomnika — max prazne množice ne obstaja (fail-closed, NIKOLI -Infinity)',
    )
  }
  const sortirane = sortirajPotekle(vnosi)
  let vsota = 0
  let najstarejsi = 0
  for (const p of sortirane) {
    const dni = potekelDniPrek(p, now)
    vsota += dni
    if (dni > najstarejsi) najstarejsi = dni
  }
  const povprecje = vsota / sortirane.length
  return {
    potekliN: sortirane.length,
    najstarejsi,
    povprecje,
    povprecjeNiz: povprecje.toFixed(1).replace('.', ','),
  }
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

/** KPI polje — ISTI vzorec kot prihodki/opomnik družina. */
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

/** Zgradi POTEKLI OPOMNIKI dokument (brez shranjevanja) — vrne jsPDF instanco
 *  (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildPotekliOpomnikiPdfDoc(
  vnosi: readonly PotekelOpomnikVnos[],
  options: PotekliOpomnikiOptions,
): jsPDF {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('buildPotekliOpomnikiPdfDoc: pričakovano polje poteklih (PotekelOpomnikVnos[])')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildPotekliOpomnikiPdfDoc: pričakovane opcije (PotekliOpomnikiOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildPotekliOpomnikiPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni poteklih opomnikov.').
  if (vnosi.length === 0) {
    throw new TypeError(
      'buildPotekliOpomnikiPdfDoc: prazen seznam ne nastaja dokumenta — komponenta pokaže iskren toast (Ni poteklih opomnikov.)',
    )
  }
  vnosi.forEach((p, i) => preveriPotekliVnos(p, i))
  const sortirane = sortirajPotekle(vnosi)
  const pov = potekliPovzetek(sortirane, now)

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
  doc.text('POTEKLI OPOMNIKI', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI trio (Potekli + Najstarejši + Povprečno — ISTI jezik kot
  // (X poteklo) zapis na CRM stats: RED = potekel signal) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Akcija za pisarno')
  const bw = 59
  const bh = 16
  const gap = 2.5
  kpiBox(doc, 14, y, bw, bh, 'Poteklih', String(pov.potekliN), RED)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Najstarejši (dni)', String(pov.najstarejsi), RED)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Povprečno (dni)', pov.povprecjeNiz, AMBER)
  y += bh + 8

  // ---------- tabela (najstarejši prvi — akcijski red) ----------
  y = sectionTitle(doc, y, `Potekli opomniki (${sortirane.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Stranka', 'Naslov', 'Telefon', 'Opomnik', 'Dni prek', 'Opis']],
    body: sortirane.map((p) => [
      p.ime.trim(),
      p.naslov.trim(),
      p.telefon ?? '—',
      cenikDatumIso(p.opomnikDatum),
      String(potekelDniPrek(p, now)),
      p.opomnikOpis ?? '—',
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 16, halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG z zaslonom: 'Dni prek' rdeče bold (ISTI signal kot '(X poteklo)'
      // na CRM stats + žig 'Opomnik potekel' na kartici — denar časa, ki ga
      // ni bilo); '—' v opisu/telefonu sivo (iskrena null resnica).
      if (data.section === 'body' && data.column.index === 4) {
        data.cell.styles.textColor = RED
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.section === 'body' && (data.column.index === 2 || data.column.index === 5)) {
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
    `${pov.potekliN} poteklih opomnikov · najstarejši ${pov.najstarejsi} dni prek · povprečno ${pov.povprecjeNiz} dni prek · akcijski seznam za pisarno (najstarejši prvi) · vir = opomnikStatus iz CRM.`,
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

/** Ime datoteke — `Potekli-opomniki-YYYY-MM-DD.pdf` (ISTI vzorec kot
 *  prihodkiPdfFilename R250 / opomnikPdfFilename R251; EN now za žig IN
 *  ime — lekcija R121/R235). */
export function potekliOpomnikiPdfFilename(now: Date): string {
  return `Potekli-opomniki-${todayStamp(now)}.pdf`
}

/** Zgeneriraj Potekli opomniki PDF (determinističen — enak vhod = bajtno
 *  enak dokument) in ga shrani kot `Potekli-opomniki-YYYY-MM-DD.pdf`. */
export function generatePotekliOpomnikiPdf(
  vnosi: readonly PotekelOpomnikVnos[],
  options: PotekliOpomnikiOptions,
): void {
  const doc = buildPotekliOpomnikiPdfDoc(vnosi, options)
  doc.save(potekliOpomnikiPdfFilename(options.now))
}
