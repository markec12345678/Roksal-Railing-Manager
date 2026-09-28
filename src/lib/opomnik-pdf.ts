// ---------------------------------------------------------------------------
// R251 (P1-k, 'izvozi' družina — 8. člen) — OPOMNIK PDF (terenski list za
// ponovni kontakt) iz CRM (crm-tab → detail Sheet → opomniški blok). Vzorec
// prihodki-pdf R250 / cenik-pdf R244: ROKSAL glava, KPI, tabela, noge, bajtni
// determinizem.
//
// LOČEN dokument od CRM plošče CSV (R238 — vrstični pregled projektov): opomnik
// PDF je PER-STRANKA terenska resnica — kdo, kje, kdaj, zakaj (opomnikOpis) +
// kontekst sodelovanja. ENA resnica z zaslonom (WYSIWYG — brat iz ISTEGA
// vira):
//  • vir podatkov = GET /api/crm (odgovor, ki ga CrmTab že izriše) — route
//    NIČ (client+lib only — izvoz je potrošnik obstoječe resnice);
//  • opomnikStatus pride VERBATIM iz API-ja (ISTI izračun kot žig na kartici:
//    days < 0 → POTEKEL, days ≤ 7 → AKTIVEN, sicer NI) — lib NE izmišljuje
//    statusa, samo prevede ga v SI + barvo (ISTI jezik kot badge);
//  • dni resnica = ISTA formula kot API (Math.floor(diff / 86400000)), le z
//    `now` KOT PARAMETER (determinizem, vzorec R203/R244/R250). LIB NE
//    prečka statusa in dni (API je izračunal status ob fetch-u — sekundni
//    premik čez polnoč bi dal lažen alarm; ±1 dan je dokumentiran rob, vzorec
//    rokPlacilaDatum R250);
//  • bralni dokument — brez pravice gate (P1-k precedens: vsi, ki vidijo
//    stranko, nosijo CRM branje; pill živi v opomniškem bloku, ki je viden
//    točno takrat, ko opomnikDatum obstaja).
//
// Načela (družinska pravila — ISTA kot prihodki-pdf R250):
//  • Fail-closed: pokvaren vnos → TypeError (ime ne-prazen niz, opomnikDatum
//    ISO, opomnikStatus iz množice, ltv končno ne-negativno, skupajProjektov
//    celo število ≥ 0, kontaktna polja null ALI ne-prazen niz — indeks/vzrok
//    v sporočilu). OPOMNIK BREZ DATUMA ne nastaja dokumenta (družina: ni
//    prazne datoteke — komponenta pokaže pill samo ob nastavljenem opomniku).
//  • Determinizem: `now` pride KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121
//    100× pravilo). Glifni razred minute (R249 doktrina): ura v žigu
//    prispe števke, ki jih podatki ne pokrijejo.
//  • CLIENT-safe: čista JS FNV-1a (node:crypto NE sme v client bundle —
//    lekcija R234); LASTNI soli **0x65–0x68** (register: zaloga 0x01–04,
//    naročilnica 0x11–14, dobavitelji 0x21–24, osnutek 0x31–34, cenik
//    0x41–44, primerjalni 0x51–54, prihodki 0x61–64, opomnik 0x65–68 — ista
//    semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'

// ---------- barve (ISTI dokumenti družina — usklajeno s prihodki/cenik) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

const STATUSI_OPOMNIKA = ['NI', 'AKTIVEN', 'POTEKEL'] as const

/** SI prevod statusa — VERBATIM iz API-ja (žig na kartici), NIČ izpeljano. */
const STATUSI_SI: Record<(typeof STATUSI_OPOMNIKA)[number], string> = {
  NI: 'Nastavljen',
  AKTIVEN: 'Aktiven',
  POTEKEL: 'Potekel',
}

/** Client-safe prerez ENE CRM stranke (polja iz GET /api/crm — ISTI odgovor,
 *  ki ga CrmTab izriše). ENA stranka = EN terenski list. */
export interface OpomnikPdfVnos {
  /** Stranka (ne-prazen niz — naslovnik terenskega lista). */
  ime: string
  /** Naslov (ne-prazen niz — obvezno na terenu). */
  naslov: string
  /** Kontaktna polja: null ALI ne-prazen niz (prazen niz = pokvaren vir). */
  telefon: string | null
  email: string | null
  kontaktnaOseba: string | null
  kategorija: string | null
  /** ISO niz (YYYY-MM-DD…) — obvezen: BREZ DATUMA NI DOKUMENTA. */
  opomnikDatum: string
  /** Opis naloge: null ALI ne-prazen niz ('—' = brez opisa, iskreno). */
  opomnikOpis: string | null
  /** ISO niz ALI null. */
  zadnjiKontakt: string | null
  /** ISO niz (stranka od). */
  createdAt: string
  /** Status VERBATIM iz API-ja (žig na kartici — lib ga NE izračunava). */
  opomnikStatus: (typeof STATUSI_OPOMNIKA)[number]
  /** Σ ocen projektov (EUR; končno ne-negativno — ISTO izpeljava kot LTV box). */
  ltv: number
  /** Št. projektov stranke (celo število ≥ 0). */
  skupajProjektov: number
  /** Št. zaklenjenih poslov (celo število ≥ 0 — ISTO izpeljava kot Zaklenjeni box). */
  zaklenjeni: number
}

export interface OpomnikPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime + DNI resnica) —
   *  KOT PARAMETER (determinizem; vzorec R203/R244/R250). */
  now: Date
}

/** Fail-closed preverba CRM stranke (obvezna polja + kontaktne inkonzistence;
 *  vzrok je VEDNO v sporočilu — družina R236/R244/R250). */
export function preveriOpomnikVnos(p: OpomnikPdfVnos): void {
  if (!p || typeof p !== 'object') {
    throw new TypeError('preveriOpomnikVnos: pričakovana CRM stranka (OpomnikPdfVnos)')
  }
  for (const [k, v] of [
    ['ime', p.ime],
    ['naslov', p.naslov],
  ] as const) {
    if (typeof v !== 'string' || v.trim() === '') {
      throw new TypeError(`preveriOpomnikVnos: ${k} mora biti ne-prazen niz, ne ${String(v)}`)
    }
  }
  if (typeof p.opomnikDatum !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(p.opomnikDatum)) {
    throw new TypeError('preveriOpomnikVnos: opomnik brez datuma ne nastaja dokumenta — komponenta pokaže pill samo ob nastavljenem opomniku (družinsko pravilo praznega seznama)')
  }
  if (!(STATUSI_OPOMNIKA as readonly string[]).includes(p.opomnikStatus)) {
    throw new TypeError(`preveriOpomnikVnos: opomnikStatus mora biti eden iz ${STATUSI_OPOMNIKA.join('/')}, ne ${String(p.opomnikStatus)}`)
  }
  for (const [k, v] of [
    ['telefon', p.telefon],
    ['email', p.email],
    ['kontaktnaOseba', p.kontaktnaOseba],
    ['kategorija', p.kategorija],
    ['opomnikOpis', p.opomnikOpis],
    ['zadnjiKontakt', p.zadnjiKontakt],
  ] as const) {
    if (v !== null && (typeof v !== 'string' || v.trim() === '')) {
      throw new TypeError(`preveriOpomnikVnos: ${k} mora biti null ALI ne-prazen niz, ne ${String(v)}`)
    }
  }
  if (typeof p.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(p.createdAt)) {
    throw new TypeError(`preveriOpomnikVnos: createdAt mora biti ISO niz YYYY-MM-DD…, ne ${String(p.createdAt)}`)
  }
  if (typeof p.ltv !== 'number' || !Number.isFinite(p.ltv) || p.ltv < 0) {
    throw new TypeError(`preveriOpomnikVnos: ltv mora biti končno ne-negativno število, ne ${String(p.ltv)}`)
  }
  for (const [k, v] of [
    ['skupajProjektov', p.skupajProjektov],
    ['zaklenjeni', p.zaklenjeni],
  ] as const) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      throw new TypeError(`preveriOpomnikVnos: ${k} mora biti celo število ≥ 0, ne ${String(v)}`)
    }
  }
}

/** Determinističen file-ID (32 hex) iz semena — čista JS FNV-1a (CLIENT-safe;
 *  LASTNI soli 0x65–0x68: vsak PDF lib družine ima svoje — ista semena v
 *  dveh libih NE smejo dati isti ID). */
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
    fnv1aHex(seed, 0x65) +
    fnv1aHex(seed, 0x66) +
    fnv1aHex(seed, 0x67) +
    fnv1aHex(seed, 0x68)
  )
}

/** Dni resnica — ISTA formula kot API opomnikStatus (Math.floor(diff /
 *  86400000)), le z `now` KOT PARAMETER. Pozitivno = opomnik še prihaja
 *  ('še X dni'), negativno = prek datuma ('prek X dni'), 0 = točno danes.
 *  Lib NE prečka dni in statusa (status je API resnica ob fetch-u ± sekunda
 *  premika — ±1 dan je dokumentiran rob, NIKOLI lažen alarm). */
export function opomnikDniResnica(
  p: Pick<OpomnikPdfVnos, 'opomnikDatum'>,
  now: Date,
): { smer: 'PREK' | 'DO'; dni: number } {
  const datum = new Date(p.opomnikDatum)
  const diff = Math.floor((datum.getTime() - now.getTime()) / 86400000)
  return diff >= 0 ? { smer: 'DO', dni: diff } : { smer: 'PREK', dni: -diff }
}

/** Dni resnica kot prikazni niz — ENA resnica za blok na zaslonu, toast IN
 *  PDF KPI (WYSIWYG; vzorec razlikaOdstotekNiz R247). */
export function opomnikDniNiz(
  p: Pick<OpomnikPdfVnos, 'opomnikDatum'>,
  now: Date,
): string {
  const r = opomnikDniResnica(p, now)
  return r.smer === 'PREK' ? `prek ${r.dni} dni` : `še ${r.dni} dni`
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

/** KPI polje — ISTI vzorec kot prihodki/cenik/zaloga družina. */
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

/** Status barva — ISTI jezik kot badge na kartici (POTEKEL rdeča, AKTIVEN
 *  amber, NI nevtralna navy — 0 novih hex, družinske RGB vrednosti). */
function statusBarva(s: (typeof STATUSI_OPOMNIKA)[number]): [number, number, number] {
  if (s === 'POTEKEL') return RED
  if (s === 'AKTIVEN') return AMBER
  return NAVY
}

/** Zgradi OPOMNIK dokument (brez shranjevanja) — vrne jsPDF instanco (testi
 *  berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildOpomnikPdfDoc(
  vnos: OpomnikPdfVnos,
  options: OpomnikPdfOptions,
): jsPDF {
  if (!vnos || typeof vnos !== 'object') {
    throw new TypeError('buildOpomnikPdfDoc: pričakovana CRM stranka (OpomnikPdfVnos)')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildOpomnikPdfDoc: pričakovane opcije (OpomnikPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildOpomnikPdfDoc: pričakovan veljaven now: Date')
  }
  preveriOpomnikVnos(vnos)
  const dni = opomnikDniResnica(vnos, now)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|${vnos.ime.trim()}/${vnos.opomnikDatum}/${vnos.opomnikStatus}/${vnos.ltv.toFixed(2)}/${vnos.skupajProjektov}/${vnos.zaklenjeni}`,
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
  doc.text('OPOMNIK', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI trio (Status + Datum + Dni — ISTI jezik kot badge) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Opomnik')
  const bw = 59
  const bh = 16
  const gap = 2.5
  kpiBox(doc, 14, y, bw, bh, 'Status', STATUSI_SI[vnos.opomnikStatus], statusBarva(vnos.opomnikStatus))
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Datum opomnika', cenikDatumIso(vnos.opomnikDatum), NAVY)
  kpiBox(
    doc,
    14 + 2 * (bw + gap),
    y,
    bw,
    bh,
    'Dni',
    dni.smer === 'PREK' ? `prek ${dni.dni}` : `še ${dni.dni}`,
    dni.smer === 'PREK' ? RED : NAVY,
  )
  y += bh + 8

  // ---------- stranka (kontaktna resnica — vir istega odgovora) ----------
  y = sectionTitle(doc, y, 'Stranka')
  autoTable(doc, {
    startY: y,
    head: [['Polje', 'Vrednost']],
    body: [
      ['Ime', vnos.ime.trim()],
      ['Naslov', vnos.naslov.trim()],
      ['Telefon', vnos.telefon ?? '—'],
      ['E-pošta', vnos.email ?? '—'],
      ['Kontaktna oseba', vnos.kontaktnaOseba ?? '—'],
      ['Kategorija', vnos.kategorija ?? '—'],
    ],
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: { 0: { cellWidth: 45 } },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- naloga (opomnikOpis — '—' je iskrena resnica brez opisa) ----------
  y = sectionTitle(doc, y, 'Naloga (opomnik)')
  autoTable(doc, {
    startY: y,
    head: [['Opis', 'Zadnji kontakt', 'Stranka od']],
    body: [
      [
        vnos.opomnikOpis ?? '—',
        vnos.zadnjiKontakt ? cenikDatumIso(vnos.zadnjiKontakt) : '—',
        cenikDatumIso(vnos.createdAt),
      ],
    ],
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: { 1: { cellWidth: 32 }, 2: { cellWidth: 32 } },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- kontekst sodelovanja (ISTO izpeljava kot LTV/projekti boxi) ----------
  y = sectionTitle(doc, y, 'Kontekst sodelovanja')
  autoTable(doc, {
    startY: y,
    head: [['LTV (EUR)', 'Projektov', 'Zaklenjenih']],
    body: [[vnos.ltv.toFixed(2), String(vnos.skupajProjektov), String(vnos.zaklenjeni)]],
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
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
    `Opomnik za ponovni kontakt — ${STATUSI_SI[vnos.opomnikStatus].toLowerCase()} (${opomnikDniNiz(vnos, now)}) · ${vnos.skupajProjektov} projektov, LTV ${vnos.ltv.toFixed(2)} EUR · terenski list za obisk, odgovornost kontakta ostaja na timu.`,
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

/** Ime datoteke opomnika — `Opomnik-YYYY-MM-DD.pdf` (ISTI vzorec kot
 *  prihodkiPdfFilename R250; EN now za žig IN ime — lekcija R121/R235). */
export function opomnikPdfFilename(now: Date): string {
  return `Opomnik-${todayStamp(now)}.pdf`
}

/** Zgeneriraj Opomnik PDF (determinističen — enak vhod = bajtno enak
 *  dokument) in ga shrani kot `Opomnik-YYYY-MM-DD.pdf`. */
export function generateOpomnikPdf(
  vnos: OpomnikPdfVnos,
  options: OpomnikPdfOptions,
): void {
  const doc = buildOpomnikPdfDoc(vnos, options)
  doc.save(opomnikPdfFilename(options.now))
}
