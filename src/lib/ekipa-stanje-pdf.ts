// ---------------------------------------------------------------------------
// R268 (P1-f, 'izvozi' družina — 24. člen) — EKIPA — STANJE EKIPE PDF iz Ekipa
// taba (team-tab.tsx). Vzorec ponudbe-spomniki-pdf R267 / oprema-cikel-pdf
// R266: ROKSAL glava, KPI 5, autoTable, sklep, noge, bajtni determinizem.
//
// EN VIR RESNICE (route NIČ — client+lib only):
//  • /api/users — FRESH fetch ISTEGA endpointa ob kliku (R244/R245/R264–R267
//    precedens: FRESH-podatki ob kliku, nič state-a, nič nove mreže) —
//    dokument = TRENUTNA resnica ob kliku (state kartice je lahko zastarel);
//    resnica pravic: endpoint vrača ekipo po users.read (pisarna vidi
//    celotno ekipo — vir poimenoval v sklepu);
//  • STATUSI EN VIR = EKIPA_STATUSI iz ekipa-csv.ts (R160 — IMPORT, NI
//    zasegane kopije; R263/R267 precedens) — 5 znanih;
//  • STATUS IZPELJAVA EN VIR = ekipaStatusOf iz ekipa-csv.ts (R160 — ISTA
//    prednost deaktiviran > zaklenjen > povabilo (poteklo?) > aktiven kot
//    značka v UI in CSV izvoz — PDF ne more odstopati od zaslona);
//  • VLOGE EN VIR = EKIPA_VLOGE iz ekipa-csv.ts (R160 — isti naslovi kot
//    ROLE_LABEL v UI); neznana vloga = pokvaren vir → TypeError z indeksom
//    krivca;
//  • SKLANJATEV ENA = clanBeseda (toast IN sklep; 1 član / 2 člana / 3-4
//    člani / 5+ članov; 11-14 članov; 101 = 'sto EN član' → '101 član').
//
// AKCIJSKI SORT (izvožen + dokumentiran): povabilo poteklo (0 — akcija:
// pošlji novo aktivacijsko povezavo) → zaklenjen (1 — akcija: varnostni
// pregled) → čaka aktivacijo (2 — akcija: povabilo v zraku) → aktiven (3) →
// deaktiviran (4 — zgodovinska cona na dnu); nato ime ASC (code-unit, brez
// locale) → email ASC → id ASC (identiteta — istonaslovni = RAZLIČNI
// resnici). Referenčni pregled, NE rangiranje.
//
// ENA RESNICA (WYSIWYG):
//  • ISTA izpeljava ekipaStanjePregled poganja PDF KPI, tabelo, sklep, mini-
//    vrstico IN toast — ENA izpeljava (klicatelj jo požene ENKRAT in podaja
//    ISTO resnico naprej, R263/R266/R267 vzorec); mini-vrstica na kartici
//    (state) = ISTA izpeljava čez ISTI prune — dve okni (state vs FRESH
//    fetch), ENA matemtika (obe poimenovani po viru).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (vloga 4
//    znanih, lifecycle 4 točno boolean, ISO nizi, ne-prazne identitete,
//    podvojen id = pokvaren vir). PRAZEN SEZNAM članov ne nastaja dokumenta
//    (družina: ni prazne datoteke; komponenta pokaže iskren toast 'Ni
//    vpisanih članov ekipe.').
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0x9d–0xa0** (register:
//    … ponudbe-spomniki 0x99–0x9c → ekipa-stanje 0x9d–0xa0 — ista semena v
//    dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import {
  ekipaStatusOf,
  EKIPA_VLOGE,
  type EkipaLifecycle,
  type EkipaStatus,
} from './ekipa-csv'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Akcijski red stanj (ISTI 5 znanih iz EKIPA_STATUSI — preverba pokritosti
 *  je tipovna: Record<EkipaStatus, number> se NE prevede, če status manjka).
 *  Povabilo poteklo / Zaklenjen = RED akcija; Čaka aktivacijo = AMBER;
 *  Aktiven = GREEN; Deaktiviran = zgodovinska cona (sivo). */
const AKCIJSKI_RED: Record<EkipaStatus, number> = {
  'Povabilo poteklo': 0,
  Zaklenjen: 1,
  'Čaka aktivacijo': 2,
  Aktiven: 3,
  Deaktiviran: 4,
}

/** Client-safe prerez ENEGA člana ekipe (podmnožica GET /api/users DTO —
 *  ISTA polja kot EkipaCsvRow R160 + id). Polja prihajajo VERBATIM — lib
 *  preverja fail-closed. */
export interface EkipaStanjeVnos {
  /** ID računa (ne-prazen — identiteta/izenačba, podvojen = pokvaren vir). */
  id: string
  /** Ime (ne-prazno — prikazna resnica). */
  ime: string
  /** E-pošta (ne-prazna — identiteta prijave). */
  email: string
  /** Vloga VERBATIM iz API-ja — ključ EKIPA_VLOGE (neznan → TypeError). */
  vloga: string
  /** Življenjski cikl — 4 točno boolean (pokvaren vir → TypeError). */
  lifecycle: EkipaLifecycle
  /** Telefon ALI null ('—' na listu — iskren odpad; CSV R160 pariteta). */
  telefon: string | null
  /** ISO zadnja aktivnost ALI null (nikoli prijavljen — iskreno). */
  lastActive: string | null
  /** ISO ustvarjanja računa (obvezen — življenjski cikl brez začetka = pokvaren vir). */
  createdAt: string
}

export interface EkipaStanjePdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244–R267). */
  now: Date
}

/** Fail-closed preverba ENEGA člana (indeks krivca VEDNO v sporočilu). */
export function preveriEkipaVnos(o: EkipaStanjeVnos, i: number): void {
  if (!o || typeof o !== 'object') {
    throw new TypeError(`preveriEkipaVnos (${i}): pričakovan član ekipe (EkipaStanjeVnos)`)
  }
  if (typeof o.id !== 'string' || o.id.trim() === '') {
    throw new TypeError(`preveriEkipaVnos (${i}): id mora biti ne-prazen niz, ne ${String(o.id)}`)
  }
  if (typeof o.ime !== 'string' || o.ime.trim() === '') {
    throw new TypeError(`preveriEkipaVnos (${i}): ime mora biti ne-prazen niz, ne ${String(o.ime)}`)
  }
  if (typeof o.email !== 'string' || o.email.trim() === '') {
    throw new TypeError(`preveriEkipaVnos (${i}): email mora biti ne-prazen niz, ne ${String(o.email)}`)
  }
  if (typeof o.vloga !== 'string' || !(o.vloga in EKIPA_VLOGE)) {
    throw new TypeError(
      `preveriEkipaVnos (${i}): vloga mora biti eden izmed 4 znanih (${Object.keys(EKIPA_VLOGE).join('/')}), ne ${String(o.vloga)}`,
    )
  }
  if (!o.lifecycle || typeof o.lifecycle !== 'object') {
    throw new TypeError(`preveriEkipaVnos (${i}): manjkajoč lifecycle`)
  }
  for (const [ime, v] of [
    ['deactivated', o.lifecycle.deactivated],
    ['locked', o.lifecycle.locked],
    ['invited', o.lifecycle.invited],
    ['inviteExpired', o.lifecycle.inviteExpired],
  ] as const) {
    if (typeof v !== 'boolean') {
      throw new TypeError(`preveriEkipaVnos (${i}): lifecycle.${ime} mora biti točno boolean, ne ${String(v)}`)
    }
  }
  if (o.telefon !== null && typeof o.telefon !== 'string') {
    throw new TypeError(`preveriEkipaVnos (${i}): telefon mora biti niz ALI null, ne ${String(o.telefon)}`)
  }
  // lastActive = ISO ALI null (nikoli prijavljen — iskreno); createdAt =
  // OBEVEZEN ISO (življenjski cikl brez začetka = pokvaren vir).
  if (o.lastActive !== null && (typeof o.lastActive !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(o.lastActive))) {
    throw new TypeError(`preveriEkipaVnos (${i}): lastActive mora biti ISO niz YYYY-MM-DD… ALI null, ne ${String(o.lastActive)}`)
  }
  if (typeof o.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(o.createdAt)) {
    throw new TypeError(`preveriEkipaVnos (${i}): createdAt mora biti ISO niz YYYY-MM-DD… (obvezen — življenjski cikl brez začetka = pokvaren vir), ne ${String(o.createdAt)}`)
  }
}

export interface EkipaStanjeVrsta {
  /** ID (identiteta). */
  id: string
  /** Ime. */
  ime: string
  /** E-pošta. */
  email: string
  /** Vloga koda (EN VIR — 4 znani). */
  vlogaKoda: string
  /** Vloga oznaka za dokument (EKIPA_VLOGE R160). */
  vloga: string
  /** Status računa (EN VIR ekipaStatusOf — 5 znanih). */
  status: EkipaStatus
  /** Telefon ALI null ('—'). */
  telefon: string | null
  /** Zadnja aktivnost DD.MM.YYYY ALI null ('—'). */
  lastActive: string | null
  /** Ustvarjen DD.MM.YYYY. */
  createdAt: string
  /** Akcijski red (manjša = prej — akcijska cona na vrhu). */
  akcijskiRed: number
}

export interface EkipaStanjePovzetek {
  /** Št. članov (vsi iz /api/users — polna resnica). */
  clanov: number
  /** Št. aktivnih računov (GREEN). */
  aktivnih: number
  /** Št. čakajočih aktivacije (AMBER — povabila v zraku). */
  cakaAktivacijo: number
  /** Št. potečenih povabil (RED — akcija: pošlji novo povezavo). */
  povabiloPoteklo: number
  /** Št. zaklenjenih računov (RED — akcija: varnostni pregled). */
  zaklenjenih: number
  /** Št. deaktiviranih (zgodovinska cona — offboarding zaključen). */
  deaktiviranih: number
  /** Per-vloga številci (vsi 4 znani — referenčna resnica). */
  admini: number
  vodje: number
  monterji: number
  skladisca: number
}

/** Stanje ekipe — ENA resnica za KPI, tabelo, sklep, mini-vrstico IN toast
 *  (WYSIWYG). Fail-verbose preverba VSEH vnosov; podvojen id = pokvaren vir
 *  fail-closed. Vrstica = CELA ekipa (tudi deaktivirani računi). */
export function ekipaStanjePregled(
  clani: readonly EkipaStanjeVnos[],
): { vrste: EkipaStanjeVrsta[]; povzetek: EkipaStanjePovzetek } {
  if (!Array.isArray(clani)) {
    throw new TypeError('ekipaStanjePregled: pričakovano polje članov ekipe (EkipaStanjeVnos[])')
  }
  if (clani.length === 0) {
    throw new TypeError('ekipaStanjePregled: prazen seznam članov ne nastaja dokumenta — pregled se izvozi, ko je vpisan prvi član ekipe (fail-closed)')
  }
  clani.forEach((o, i) => preveriEkipaVnos(o, i))

  // Podvojen id = pokvaren vir (dve vrstici za ISTO identiteto bi lažno
  // podvajali KPI in tabelo — fail-closed, NIKOLI tiho združevanje).
  const videni = new Set<string>()
  for (const o of clani) {
    if (videni.has(o.id)) {
      throw new TypeError(`ekipaStanjePregled: podvojen id člana ${o.id} (pokvaren vir — identiteta mora biti edinstvena)`)
    }
    videni.add(o.id)
  }

  const vrste: EkipaStanjeVrsta[] = clani.map((o) => {
    const status = ekipaStatusOf(o.lifecycle)
    return {
      id: o.id,
      ime: o.ime,
      email: o.email,
      vlogaKoda: o.vloga,
      vloga: EKIPA_VLOGE[o.vloga],
      status,
      telefon: o.telefon,
      lastActive: o.lastActive !== null ? cenikDatumIso(o.lastActive) : null,
      createdAt: cenikDatumIso(o.createdAt),
      akcijskiRed: AKCIJSKI_RED[status],
    }
  })
  sortirajEkipaStanje(vrste)

  const povzetek: EkipaStanjePovzetek = {
    clanov: vrste.length,
    aktivnih: vrste.filter((v) => v.status === 'Aktiven').length,
    cakaAktivacijo: vrste.filter((v) => v.status === 'Čaka aktivacijo').length,
    povabiloPoteklo: vrste.filter((v) => v.status === 'Povabilo poteklo').length,
    zaklenjenih: vrste.filter((v) => v.status === 'Zaklenjen').length,
    deaktiviranih: vrste.filter((v) => v.status === 'Deaktiviran').length,
    admini: vrste.filter((v) => v.vlogaKoda === 'ADMIN').length,
    vodje: vrste.filter((v) => v.vlogaKoda === 'VODJA').length,
    monterji: vrste.filter((v) => v.vlogaKoda === 'MONTER').length,
    skladisca: vrste.filter((v) => v.vlogaKoda === 'SKLADISCE').length,
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — akcijski red: (1) status po akcijski teži (povabilo poteklo
 *  → zaklenjen → čaka aktivacijo → aktiven → deaktiviran — akcijska cona na
 *  vrhu, zgodovinska na dnu), (2) ime ASC (navadno < po UTF-16 kodnih
 *  točkah — brez locale), (3) email ASC (istiponovni = RAZLIČNI resnici),
 *  (4) id ASC (identiteta). IZVOŽEN — determinizem = f(MNOŽICA vhodov).
 *  Referenčni pregled, NE rangiranje. */
export function sortirajEkipaStanje(vrste: EkipaStanjeVrsta[]): EkipaStanjeVrsta[] {
  return vrste.sort((a, b) => {
    if (a.akcijskiRed !== b.akcijskiRed) return a.akcijskiRed - b.akcijskiRed
    if (a.ime !== b.ime) return a.ime < b.ime ? -1 : 1
    if (a.email !== b.email) return a.email < b.email ? -1 : 1
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
}

/** Sklanjatev članov za toast IN sklep (iskrene oznake; 101 = 'sto EN član'
 *  — testi trdijo DEJANSKO vedenje vira, ne kanon po pomnilniku). */
export function clanBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`clanBeseda: pričakovano ne-negativno celo število: ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return `${n} član`
  if (enice === 2 && zadnjiDve !== 12) return `${n} člana`
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) {
    return `${n} člani`
  }
  return `${n} članov`
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0x9d–0xa0. */
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
    fnv1aHex(seed, 0x9d) +
    fnv1aHex(seed, 0x9e) +
    fnv1aHex(seed, 0x9f) +
    fnv1aHex(seed, 0xa0)
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

/** KPI polje — ISTI vzorec kot prihodki/narocila/ponudbe-spomniki družina. */
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

/** Zgradi EKIPA — STANJE EKIPE dokument (brez shranjevanja) — vrne jsPDF
 *  instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildEkipaStanjePdfDoc(
  clani: readonly EkipaStanjeVnos[],
  options: EkipaStanjePdfOptions,
): jsPDF {
  if (!Array.isArray(clani)) {
    throw new TypeError('buildEkipaStanjePdfDoc: pričakovano polje članov ekipe')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildEkipaStanjePdfDoc: pričakovane opcije (EkipaStanjePdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildEkipaStanjePdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM članov ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih članov ekipe.').
  if (clani.length === 0) {
    throw new TypeError(
      'buildEkipaStanjePdfDoc: prazen seznam članov ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih članov ekipe.)',
    )
  }
  const { vrste, povzetek } = ekipaStanjePregled(clani)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (po id identitete), NIKOLI vrstni
  // red odgovora (R248/R262/R264–R267 vzorec). Lifecycle = 4 črke (d/l/i/e).
  const kanonClani = [...clani].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|E:${kanonClani
        .map(
          (o) =>
            `${o.id}/${o.vloga}/${o.lifecycle.deactivated ? 'd' : '-'}${o.lifecycle.locked ? 'l' : '-'}${o.lifecycle.invited ? 'i' : '-'}${o.lifecycle.inviteExpired ? 'e' : '-'}/${o.telefon === null ? 'null' : o.telefon}/${o.lastActive === null ? 'null' : o.lastActive}/${o.createdAt}`,
        )
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot ponudbe-spomniki/oprema-cikel) ----------
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
  doc.text('EKIPA — STANJE EKIPE', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: RED = akcija — potečeno povabilo /
  //  zaklep; AMBER = iskreno čakanje — povabilo v zraku; GREEN = aktivni;
  //  NAVY = obseg; deaktivirani = zgodovina → sklep, NE lažni alarm) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek stanja ekipe')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Članov', String(povzetek.clanov), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Aktivnih', String(povzetek.aktivnih), GREEN)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Povabilo poteklo', String(povzetek.povabiloPoteklo), povzetek.povabiloPoteklo > 0 ? RED : GREEN)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Zaklenjenih', String(povzetek.zaklenjenih), povzetek.zaklenjenih > 0 ? RED : GREEN)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Čaka aktivacijo', String(povzetek.cakaAktivacijo), povzetek.cakaAktivacijo > 0 ? AMBER : GREEN)
  y += bh + 8

  // ---------- tabela članov (akcijski red: potečena povabila in zaklepi
  //  na vrhu — deaktivirani zgodovina na dnu; CELA ekipa) ----------
  y = sectionTitle(doc, y, `Člani ekipe (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Ime', 'E-pošta', 'Vloga', 'Status', 'Telefon', 'Zadnja aktivnost', 'Ustvarjen']],
    body: vrste.map((v) => [
      v.ime,
      v.email,
      v.vloga,
      v.status,
      v.telefon ?? '—',
      v.lastActive ?? '—',
      v.createdAt,
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    didParseCell: (data) => {
      // WYSIWYG: povabilo poteklo + zaklenjen RED bold (akcija); čaka
      // aktivacijo AMBER; aktiven GREEN; deaktiviran sivo (zgodovina);
      // '—' sivo (iskren odpad).
      if (data.section !== 'body') return
      const v = vrste[data.row.index]
      if (!v) return
      const raw = String(data.cell.raw ?? '')
      if (data.column.index === 3) {
        if (v.status === 'Povabilo poteklo' || v.status === 'Zaklenjen') {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = 'bold'
        } else if (v.status === 'Čaka aktivacijo') {
          data.cell.styles.textColor = AMBER
        } else if (v.status === 'Aktiven') {
          data.cell.styles.textColor = GREEN
        } else if (v.status === 'Deaktiviran') {
          data.cell.styles.textColor = GRAY
        }
      }
      if ((data.column.index === 4 || data.column.index === 5) && raw === '—') {
        data.cell.styles.textColor = GRAY
      }
    },
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  // ---------- sklepna vrstica (iskren podpis — cone + akcije poimenovane) ----------
  if (y > 255) {
    doc.addPage()
    y = 20
  }
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...NAVY)
  doc.text(
    `${clanBeseda(povzetek.clanov)} · aktivnih ${povzetek.aktivnih} · čaka aktivacijo ${povzetek.cakaAktivacijo} (akcija — povabila v zraku) · povabilo poteklo ${povzetek.povabiloPoteklo} (akcija — pošlji novo aktivacijsko povezavo) · zaklenjenih ${povzetek.zaklenjenih} (akcija — varnostni pregled) · deaktiviranih ${povzetek.deaktiviranih} (zgodovinska cona — offboarding zaključen) · vloge: ${EKIPA_VLOGE.ADMIN} ${povzetek.admini} / ${EKIPA_VLOGE.VODJA} ${povzetek.vodje} / ${EKIPA_VLOGE.MONTER} ${povzetek.monterji} / ${EKIPA_VLOGE.SKLADISCE} ${povzetek.skladisca} (referenčni pregled — celotna ekipa, tudi deaktivirani računi) · vir = /api/users (resnica pravic users.read).`,
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

/** Ime datoteke — `Ekipa-stanje-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function ekipaStanjePdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('ekipaStanjePdfFilename: pričakovan veljaven now: Date')
  }
  return `Ekipa-stanje-${todayStamp(now)}.pdf`
}

/** Zgeneriraj EKIPA — STANJE EKIPE PDF (determinističen — enak vhod =
 *  bajtno enak dokument) in ga shrani. */
export function generateEkipaStanjePdf(
  clani: readonly EkipaStanjeVnos[],
  options: EkipaStanjePdfOptions,
): void {
  const doc = buildEkipaStanjePdfDoc(clani, options)
  doc.save(ekipaStanjePdfFilename(options.now))
}
