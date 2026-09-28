// ---------------------------------------------------------------------------
// R261 (P1-f, 'izvozi' družina — 17. člen) — RAČUNI PO PROJEKTIH: PONUDBA vs
// REALIZACIJA PDF iz Vodjinega pregleda (vodja-dashboard). Vzorec
// dobičkonost-pdf R258 / prihodki-pdf R250 / narocila-pregled-pdf R257:
// ROKSAL glava, KPI, autoTable, noge, bajtni determinizem.
//
// PRESEK DVEH VIROV (route NIČ — client+lib only; vodja-dashboard ŽE fetcha
// oba: GET /api/invoices + GET /api/projects — R258 precedens 'presek virov,
// ki ju klicatelj že fetcha', NIČ nove mreže):
//  • ponudba = Project.estimatedPrice — SHRANJEN stolpec (zapisan ob podpisu
//    dogovora, deal-lock); ta lib ga SAMO PREBERE — NIČ ponovnega računa,
//    NIČ stika s pricing/geometry jedrom (read-only resnica);
//  • realizirano = Σ znesek računov IZDAN + PLACAN (ISTA definicija 'izdano'
//    kot prihodki R250 / dobičkonost R258 — STATUSI import iz prihodki-pdf,
//    EN VIR, nič dvojnega seznama);
//  • odstopanje = realizirano − ponudba (izpeljana resnica; lahko negativno
//    — pod-realizacija rdeče iskrena, NIKOLI utišana);
//  • % realizacije = realizirano / ponudba × 100 — SAMO pri ponudba > 0;
//    brez ponudbe % NI definiran → '—' sivo (NIKOLI izmišljen 0 %, R258
//    vzorec);
//  • JOIN po IDENTITETI: racun.projectId === projekt.id (v === s — R260
//    lekcija: DVA istonažna projekta z različnim id = RAZLIČNI resnici;
//    naziv je samo prikazna resnica);
//  • vrstica = projekt z vsaj ENIM računom (katerikoli status) ALI z vpisano
//    ponudbo; realizirano 0 na projektu brez računov = poimenovana vsota
//    praznega seznama (R258 'prazna vsota = 0' vzorec — NI izmišljena);
//  • projekt BREZ vpisane ponudbe: ponudba '—', odstopanje '—', % '—' +
//    števec brezPonudbe v KPI IN sklepu (R227 'brez vpisane' jezik — NIKOLI
//    lažna ničla);
//  • račun z projectId, ki ga ni med projekti (npr. vlogsko zožen odgovor
//    /api/projects): NI vrstice — števec + vsota POIMENOVANA v sklepu
//    ('brez projektnega zapisa'); snapshot naziv ostane v DTO resnici;
//  • stornirani + osnutki računov: izključeni iz realizacije, poimenovani v
//    sklepu (R250 vzorec).
//
// ENA RESNICA z zaslonom (WYSIWYG):
//  • ISTA izpeljava racuniProjektiPoProjektih poganja PDF KPI, tabelo, sklep
//    IN zasonsko mini-vrstico 'Ponudbe v izvedbi' + toast — ENA izpeljava,
//    nič dvojnega računa;
//  • sort = NAZIV ASC (navadno < po UTF-16 kodnih točkah — brez
//    locale-odvisnega primerjanja, R245/R250/R257 vzorec), izenačba id ASC
//    (dva istonažna = determinističen tiebreak). Sort INTERNI PRED vsotami
//    — FP seštevanje odvisno od vrstnega reda, rezultat f(MNOŽICA) (R248
//    vzorec).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError (status iz znane množice EN VIR,
//    zneski končno ne-negativni, projectId/id/naziv ne-prazna niza,
//    estimatedPrice null ALI končno ne-negativno — indeks krivca v
//    sporočilu). PRAZEN PRESEK (0 računov IN 0 projektov) ne nastaja
//    dokumenta (družina: ni prazne datoteke; komponenta pokaže iskren
//    toast). EN ne-prazen vir ZADOVOLJI.
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: uvozi ga vodja-dashboard (client) — čista JS FNV-1a
//    (node:crypto NE sme v client bundle — lekcija R234); LASTNI soli
//    **0x81–0x84** (register: zaloga 0x01–04, naročilnica 0x11–14,
//    dobavitelji 0x21–24, osnutek 0x31–34, cenik 0x41–44, primerjalni
//    0x51–54, prihodki 0x61–64, opomnik 0x65–68, potekli 0x69–6c, koledar
//    0x6d–0x70, vozni red 0x71–74, tedenski 0x75–78, naročila pregled
//    0x79–7c, dobičkonost 0x7d–0x80 → računi po projektih 0x81–0x84 — ista
//    semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { STATUSI as STATUSI_RACUNOV } from './prihodki-pdf'

// ---------- barve (ISTI dokumenti družina — usklajeno s prihodki/narocila) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber (pod-realizacija)
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green (realizirano / pozitivno odstopanje)
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red (negativno odstopanje)
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez ENEGA računa (podmnožica GET /api/invoices). projectId
 *  = IDENTITETNI ključ joina (v === s — R260 lekcija); projekt = snapshot
 *  naziv za prikaz, če projektna vrstica manjka (poimenovano v sklepu). */
export interface RacuniProjektiRacun {
  /** Račun 'YYYY-NNN' (ne-prazen — fail-closed). */
  stevilka: string
  /** VERBATIM status iz API-ja (4 znanih — EN VIR STATUSI prihodki-pdf). */
  status: string
  /** Znesek (EUR; končno ne-negativen). */
  znesek: number
  /** ID projekta (ne-prazen — identiteta joina; schema NOT NULL). */
  projectId: string
  /** Snapshot naziv projekta ALI null/undefined (prikazna resnica). */
  projekt?: string | null
}

/** Client-safe prerez ENEGA projekta (podmnožica GET /api/projects).
 *  estimatedPrice = SHRANJEN stolpec (deal-lock) — ta lib ga samo bere. */
export interface RacuniProjektiProjekt {
  /** ID projekta (ne-prazen — identiteta joina). */
  id: string
  /** Naziv projekta (ne-prazen — prikazna + sort resnica). */
  nazivProjekta: string
  /** Vpisana ponudba (EUR) ALI null = brez vpisane ponudbe ('—', poimenovano
   *  — NIKOLI izmišljena ničla). */
  estimatedPrice: number | null
}

export interface RacuniProjektiPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244/R250/R257/R258). */
  now: Date
}

/** Fail-closed preverba računa (indeks krivca VEDNO v sporočilu). */
export function preveriRacuniProjektiRacun(r: RacuniProjektiRacun, i: number): void {
  if (!r || typeof r !== 'object') {
    throw new TypeError(`preveriRacuniProjektiRacun (${i}): pričakovan račun (RacuniProjektiRacun)`)
  }
  if (typeof r.stevilka !== 'string' || r.stevilka.trim() === '') {
    throw new TypeError(`preveriRacuniProjektiRacun (${i}): stevilka mora biti ne-prazen niz, ne ${String(r.stevilka)}`)
  }
  if (typeof r.status !== 'string' || !(STATUSI_RACUNOV as readonly string[]).includes(r.status)) {
    throw new TypeError(`preveriRacuniProjektiRacun (${i}): status mora biti eden iz ${STATUSI_RACUNOV.join('/')}, ne ${String(r.status)}`)
  }
  if (typeof r.znesek !== 'number' || !Number.isFinite(r.znesek) || r.znesek < 0) {
    throw new TypeError(`preveriRacuniProjektiRacun (${i}): znesek mora biti končno ne-negativno število, ne ${String(r.znesek)}`)
  }
  if (typeof r.projectId !== 'string' || r.projectId.trim() === '') {
    throw new TypeError(`preveriRacuniProjektiRacun (${i}): projectId mora biti ne-prazen niz (identiteta joina), ne ${String(r.projectId)}`)
  }
  if (r.projekt !== undefined && r.projekt !== null && (typeof r.projekt !== 'string' || r.projekt.trim() === '')) {
    throw new TypeError(`preveriRacuniProjektiRacun (${i}): projekt mora biti ne-prazen niz ali null, ne ${String(r.projekt)}`)
  }
}

/** Fail-closed preverba projekta (indeks krivca VEDNO v sporočilu). */
export function preveriRacuniProjektiProjekt(p: RacuniProjektiProjekt, i: number): void {
  if (!p || typeof p !== 'object') {
    throw new TypeError(`preveriRacuniProjektiProjekt (${i}): pričakovan projekt (RacuniProjektiProjekt)`)
  }
  if (typeof p.id !== 'string' || p.id.trim() === '') {
    throw new TypeError(`preveriRacuniProjektiProjekt (${i}): id mora biti ne-prazen niz (identiteta joina), ne ${String(p.id)}`)
  }
  if (typeof p.nazivProjekta !== 'string' || p.nazivProjekta.trim() === '') {
    throw new TypeError(`preveriRacuniProjektiProjekt (${i}): nazivProjekta mora biti ne-prazen niz, ne ${String(p.nazivProjekta)}`)
  }
  if (
    p.estimatedPrice !== null &&
    (typeof p.estimatedPrice !== 'number' || !Number.isFinite(p.estimatedPrice) || p.estimatedPrice < 0)
  ) {
    throw new TypeError(
      `preveriRacuniProjektiProjekt (${i}): estimatedPrice mora biti končno ne-negativno število ali null (brez vpisane ponudbe), ne ${String(p.estimatedPrice)}`,
    )
  }
}

/** Znesek kot stabilen niz — 2 decimalni mesti (družinski znesekNiz vzorec). */
function znesekNiz(z: number): string {
  return z.toFixed(2)
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0x81–0x84. */
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
    fnv1aHex(seed, 0x81) +
    fnv1aHex(seed, 0x82) +
    fnv1aHex(seed, 0x83) +
    fnv1aHex(seed, 0x84)
  )
}

export interface RacuniProjektiVrsta {
  /** Naziv projekta (iz projektnega zapisa — prikazna resnica). */
  projekt: string
  /** ID projekta (identiteta — tiebreak izenačbe istonažnih). */
  id: string
  /** Vpisana ponudba ALI null = brez vpisane ('—'). */
  ponudba: number | null
  /** Σ znesek IZDAN + PLACAN (0 = poimenovana prazna vsota). */
  realizirano: number
  /** realizirano − ponudba; null če ponudba null (NI definiran → '—'). */
  odstopanje: number | null
  /** realizirano / ponudba × 100; null če ponudba null ALI = 0. */
  realizacijaOdstotek: number | null
  /** Št. računov IZDAN + PLACAN na projektu (osnutki/stornirani NE štejejo). */
  racunov: number
}

export interface RacuniProjektiPovzetek {
  /** Št. vrstic (= sortirane.length). */
  projektov: number
  /** Σ ponudba čez vrste z vpisano; null če NOBENA nima vpisane ('—'). */
  ponudba: number | null
  /** Št. vrst z vpisano ponudbo. */
  ponudbaZneskov: number
  /** Št. vrst BREZ vpisane ponudbe ('—' + poimenovano v sklepu). */
  brezPonudbe: number
  /** Σ realizirano čez vrste. */
  realizirano: number
  /** Σ odstopanje čez vrste z vpisano ponudbo; null če nobena ('—'). */
  odstopanje: number | null
  /** Št. vrst z odstopanjem < 0 (pod-realizacija — iskren alarm). */
  negativnih: number
  /** Št. računov z projectId brez projektnega zapisa (poimenovano v sklepu). */
  racunovBrezProjekta: number
  /** Σ znesek IZDAN+PLACAN računov brez projektnega zapisa (poimenovano). */
  znesekBrezProjekta: number
  /** Št. STORNIRAN računov (izključeni iz realizacije — poimenovani). */
  storniranih: number
  /** Št. OSNUTEK računov (izključeni iz realizacije — poimenovani). */
  osnutkiRacunov: number
}

/** Presek dveh virov — ENA resnica za KPI, tabelo, sklep, mini-vrstico IN
 *  toast (WYSIWYG). JOIN po IDENTITETI projectId === id (v === s — R260
 *  lekcija); fail-verbose preverba VSEH vnosov (pokvaren vnos = pokvaren
 *  vir — NIKOLI tiho). */
export function racuniProjektiPoProjektih(
  racuni: readonly RacuniProjektiRacun[],
  projekti: readonly RacuniProjektiProjekt[],
): { vrste: RacuniProjektiVrsta[]; povzetek: RacuniProjektiPovzetek } {
  if (!Array.isArray(racuni)) {
    throw new TypeError('racuniProjektiPoProjektih: pričakovano polje računov (RacuniProjektiRacun[])')
  }
  if (!Array.isArray(projekti)) {
    throw new TypeError('racuniProjektiPoProjektih: pričakovano polje projektov (RacuniProjektiProjekt[])')
  }
  racuni.forEach((r, i) => preveriRacuniProjektiRacun(r, i))
  projekti.forEach((p, i) => preveriRacuniProjektiProjekt(p, i))

  const povzetek: RacuniProjektiPovzetek = {
    projektov: 0,
    ponudba: null,
    ponudbaZneskov: 0,
    brezPonudbe: 0,
    realizirano: 0,
    odstopanje: null,
    negativnih: 0,
    racunovBrezProjekta: 0,
    znesekBrezProjekta: 0,
    storniranih: 0,
    osnutkiRacunov: 0,
  }

  // Projektni register po IDENTITETI (id) — naziv je prikazna resnica.
  const register = new Map<string, { naziv: string; ponudba: number | null; realizirano: number; racunov: number; racunovVseh: number }>()
  for (const p of projekti) {
    register.set(p.id, { naziv: p.nazivProjekta.trim(), ponudba: p.estimatedPrice, realizirano: 0, racunov: 0, racunovVseh: 0 })
  }

  for (const r of racuni) {
    // stornirani/osnutki šteje VSE račune (tudi brez zapisa) — sklep poimenuje
    // IZKLJUČENE iz realizacije, ne glede na projektno pripadnost.
    if (r.status === 'STORNIRAN') povzetek.storniranih += 1
    if (r.status === 'OSNUTEK') povzetek.osnutkiRacunov += 1
    const zapis = register.get(r.projectId)
    if (!zapis) {
      // projectId brez projektnega zapisa (vlogsko zožen / race) — NI vrstice,
      // števec + vsota POIMENOVANA v sklepu (nikoli tiho spregledano).
      povzetek.racunovBrezProjekta += 1
      if (r.status === 'IZDAN' || r.status === 'PLACAN') povzetek.znesekBrezProjekta += r.znesek
      continue
    }
    zapis.racunovVseh += 1
    if (r.status !== 'IZDAN' && r.status !== 'PLACAN') continue
    zapis.realizirano += r.znesek
    zapis.racunov += 1
  }

  // Vrstica = projekt z vsaj ENIM računom (katerikoli status) ALI vpisano
  // ponudbo. Ostali (brez obeh resnic) nimajo kaj pokazati — brez vrstice.
  const vrste: RacuniProjektiVrsta[] = []
  for (const [id, z] of register) {
    if (z.racunovVseh === 0 && z.ponudba === null) continue
    vrste.push({
      projekt: z.naziv,
      id,
      ponudba: z.ponudba,
      realizirano: z.realizirano,
      odstopanje: z.ponudba !== null ? z.realizirano - z.ponudba : null,
      realizacijaOdstotek: z.ponudba !== null && z.ponudba > 0 ? (z.realizirano / z.ponudba) * 100 : null,
      racunov: z.racunov,
    })
  }
  sortirajRacuniProjekti(vrste)

  povzetek.projektov = vrste.length
  let ponudbaVsota = 0
  let odstopanjeVsota = 0
  for (const v of vrste) {
    povzetek.realizirano += v.realizirano
    if (v.ponudba !== null) {
      ponudbaVsota += v.ponudba
      povzetek.ponudbaZneskov += 1
      odstopanjeVsota += v.odstopanje ?? 0
    } else {
      povzetek.brezPonudbe += 1
    }
    if (v.odstopanje !== null && v.odstopanje < 0) povzetek.negativnih += 1
  }
  // Σ ponudbe/odstopanja sta DOLGOVANI resnici: Σ prazne množice = '—' (null
  // — ni definiran), Σ ne-prazne = številka (R258 prazna-vsota vzorec).
  if (povzetek.ponudbaZneskov > 0) {
    povzetek.ponudba = ponudbaVsota
    povzetek.odstopanje = odstopanjeVsota
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — NAZIV ASC (navadno < po UTF-16 kodnih točkah — brez
 *  locale-odvisnega primerjanja, R245/R250/R257 vzorec), izenačba id ASC
 *  (dva istonažna projekta = determinističen red). IZVOŽEN — determinizem =
 *  f(MNOŽICA). */
export function sortirajRacuniProjekti(vrste: RacuniProjektiVrsta[]): RacuniProjektiVrsta[] {
  return vrste.sort((a, b) => {
    const pa = a.projekt.trim()
    const pb = b.projekt.trim()
    if (pa !== pb) return pa < pb ? -1 : 1
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
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

/** KPI polje — ISTI vzorec kot prihodki/narocila/dobicikonost (družinski
 *  kpiBox). */
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

/** Zgradi RAČUNI PO PROJEKTIH dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildRacuniProjektiPdfDoc(
  racuni: readonly RacuniProjektiRacun[],
  projekti: readonly RacuniProjektiProjekt[],
  options: RacuniProjektiPdfOptions,
): jsPDF {
  if (!Array.isArray(racuni) || !Array.isArray(projekti)) {
    throw new TypeError('buildRacuniProjektiPdfDoc: pričakovani polji računov in projektov')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildRacuniProjektiPdfDoc: pričakovane opcije (RacuniProjektiPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildRacuniProjektiPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN PRESEK ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni podatkov za račune po projektih.').
  if (racuni.length === 0 && projekti.length === 0) {
    throw new TypeError(
      'buildRacuniProjektiPdfDoc: prazen presek ne nastaja dokumenta — komponenta pokaže iskren toast (Ni podatkov za račune po projektih.)',
    )
  }
  const { vrste, povzetek } = racuniProjektiPoProjektih(racuni, projekti)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / prihodki R250) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (računi: številka/status/znesek/
  // projectId ASC; projekti: naziv/id ASC), NIKOLI vrstni red odgovora
  // (R250/R257/R258 vzorec: sort pred seedom).
  const kanonRacuni = [...racuni].sort((a, b) => {
    if (a.stevilka.trim() !== b.stevilka.trim()) return a.stevilka.trim() < b.stevilka.trim() ? -1 : 1
    if (a.status !== b.status) return a.status < b.status ? -1 : 1
    if (a.znesek !== b.znesek) return a.znesek < b.znesek ? -1 : 1
    if (a.projectId !== b.projectId) return a.projectId < b.projectId ? -1 : 1
    return 0
  })
  const kanonProjekti = [...projekti].sort((a, b) => {
    if (a.nazivProjekta.trim() !== b.nazivProjekta.trim()) return a.nazivProjekta.trim() < b.nazivProjekta.trim() ? -1 : 1
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|R:${kanonRacuni
        .map((r) => `${r.stevilka.trim()}/${r.status}/${znesekNiz(r.znesek)}/${r.projectId}`)
        .join(',')}|P:${kanonProjekti
        .map((p) => `${p.nazivProjekta.trim()}/${p.id}/${p.estimatedPrice === null ? '—' : znesekNiz(p.estimatedPrice)}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot prihodki/narocila/dobicikonost) ----------
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
  doc.text('RAČUNI PO PROJEKTIH', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI povzetek (izračun iz preseka — notranja skladnost) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek ponudbe vs realizacija')
  // 5 polj → 33 mm boxi (ISTI layout kot prihodki R250 / naročila R257 /
  // dobičkonost R258).
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Projektov', String(povzetek.projektov), NAVY)
  kpiBox(
    doc,
    14 + bw + gap,
    y,
    bw,
    bh,
    'Ponudba',
    povzetek.ponudba !== null ? `${znesekNiz(povzetek.ponudba)} €` : '—',
    povzetek.ponudba !== null && povzetek.ponudba > 0 ? GREEN : NAVY,
  )
  kpiBox(
    doc,
    14 + 2 * (bw + gap),
    y,
    bw,
    bh,
    'Realizirano',
    `${znesekNiz(povzetek.realizirano)} €`,
    povzetek.realizirano > 0 ? GREEN : NAVY,
  )
  kpiBox(
    doc,
    14 + 3 * (bw + gap),
    y,
    bw,
    bh,
    'Odstopanje',
    povzetek.odstopanje !== null ? `${znesekNiz(povzetek.odstopanje)} €` : '—',
    povzetek.odstopanje !== null ? (povzetek.odstopanje > 0 ? GREEN : povzetek.odstopanje < 0 ? RED : NAVY) : NAVY,
  )
  kpiBox(
    doc,
    14 + 4 * (bw + gap),
    y,
    bw,
    bh,
    'Brez ponudbe',
    String(povzetek.brezPonudbe),
    povzetek.brezPonudbe > 0 ? RED : NAVY,
  )
  y += bh + 8

  // ---------- tabela projektov (NAZIV ASC — računovodski pregledni red) ----------
  y = sectionTitle(doc, y, `Projekti (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Projekt', 'Ponudba (EUR)', 'Realizirano (EUR)', 'Odstopanje (EUR)', 'Realizacija (%)', 'Računov']],
    body: vrste.map((v) => [
      v.projekt,
      v.ponudba !== null ? znesekNiz(v.ponudba) : '—',
      znesekNiz(v.realizirano),
      v.odstopanje !== null ? znesekNiz(v.odstopanje) : '—',
      v.realizacijaOdstotek !== null ? v.realizacijaOdstotek.toFixed(1) : '—',
      String(v.racunov),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG: negativno odstopanje rdeče bold (iskren alarm — NIKOLI
      // utišan); pozitivno zeleno bold; pod-100 % realizacija AMBER bold;
      // '—' sivo (NI definiran — iskrena null resnica, R258 vzorec).
      if (data.section === 'body' && data.column.index === 3) {
        const v = Number(String(data.cell.raw ?? ''))
        if (Number.isFinite(v) && v < 0) {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        } else if (Number.isFinite(v) && v > 0) {
          data.cell.styles.textColor = GREEN
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && data.column.index === 4 && data.cell.raw !== '—') {
        const v = Number(String(data.cell.raw ?? ''))
        if (Number.isFinite(v) && v < 100) {
          data.cell.styles.textColor = AMBER
          data.cell.styles.fontStyle = 'bold'
        } else if (Number.isFinite(v) && v >= 100) {
          data.cell.styles.textColor = GREEN
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && (data.column.index === 1 || data.column.index === 4) && data.cell.raw === '—') {
        data.cell.styles.textColor = GRAY
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (iskren podpis — izključitve poimenovane) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${povzetek.projektov} projektov · ponudba ${povzetek.ponudba !== null ? znesekNiz(povzetek.ponudba) : '—'} EUR (${povzetek.ponudbaZneskov} vpisanih, ${povzetek.brezPonudbe} brez vpisane ponudbe) · realizirano ${znesekNiz(povzetek.realizirano)} EUR · odstopanje ${povzetek.odstopanje !== null ? znesekNiz(povzetek.odstopanje) : '—'} EUR · negativnih odstopanj ${povzetek.negativnih} · storniranih računov ${povzetek.storniranih} · osnutkov računov ${povzetek.osnutkiRacunov} (izključeni iz realizacije) · računov brez projektnega zapisa ${povzetek.racunovBrezProjekta} (${znesekNiz(povzetek.znesekBrezProjekta)} EUR).`,
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

/** Ime datoteke — `Racuni-po-projektih-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function racuniProjektiPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('racuniProjektiPdfFilename: pričakovan veljaven now: Date')
  }
  return `Racuni-po-projektih-${todayStamp(now)}.pdf`
}

/** Zgeneriraj RAČUNI PO PROJEKTIH PDF (determinističen — enak vhod = bajtno
 *  enak dokument) in ga shrani kot `Racuni-po-projektih-YYYY-MM-DD.pdf`. */
export function generateRacuniProjektiPdf(
  racuni: readonly RacuniProjektiRacun[],
  projekti: readonly RacuniProjektiProjekt[],
  options: RacuniProjektiPdfOptions,
): void {
  const doc = buildRacuniProjektiPdfDoc(racuni, projekti, options)
  doc.save(racuniProjektiPdfFilename(options.now))
}
