// ---------------------------------------------------------------------------
// R266 (P1-f, 'izvozi' družina — 22. člen) — OPREMA — ŽIVLJENJSKI CIKL PDF iz
// Logistika (logistics-tab, subtab Oprema). Vzorec projekti-termini-pdf R265 /
// dobavitelji-pozicija-pdf R264: ROKSAL glava, KPI 5, autoTable, sklep, noge,
// bajtni determinizem.
//
// EN VIR RESNICE (route NIČ — client+lib only):
//  • /api/equipment — FRESH fetch VSE opreme ISTEGA endpointa ob kliku
//    (R244/R245/R264/R265 precedens: FRESH-podatki ob kliku, nič state-a,
//    nič nove mreže) — DOKUMENT = POLNA resnica: paginacija čez limit 100
//    (do MAX_OFFSET 10.000) — TIHA REZINA je prepovedana (100 zadetkov ≠
//    'vsa oprema', nič ne pove, da vir ima več); vir ŽE nosi celotno
//    življenjsko resnico (R145 §31): statusi ×5, pregledi (interval + zadnji
//    + naslednji + due/unknown), kalibracije (required/rok/potrdilo/
//    overdue/missing), lokacije, serijske, rezervacije;
//  • STATUSI EN VIR = EQUIPMENT_STATUSES iz src/lib/equipment-lifecycle.ts
//    (R145 jedro — IMPORT, NI zasegane kopije; neznan status = pokvaren vir
//    → TypeError z indeksom krivca). Oznake za dokument = LASTNA preslikava
//    OPREMA_STATUS_LABELI, tipizirana Record<EquipmentStatus, string> —
//    prevajalnik zagotavlja pokritost VSEH 5 znanih (ni mogoče zamuditi);
//  • TIP = prikazna resnica: handler poimenuje z UI mapo (EQUIPMENT_TYPES,
//    isti prikaz kot badge) — neznan tip API-ja pade na VERBATIM niz
//    (iskren, NI izmišljen; tip NE vodi tranzicijske logike — NI jedro);
//  • vrstica = VSA oprema (referenčni pregled — NE rangiranje; tudi
//    UPOKOJENO/IZGUBLJENO — cikl resnica NI samo aktivna oprema; sort NAZIV
//    ASC + izenačba id ASC, navadno < — brez locale-odvisnega primerjanja;
//    dva istonaslovna kosa = RAZLIČNI resnici po id, R260–R265 lekcija);
//  • iskren jezik pregledov (3 veje, R145 deterministika):
//    zapadel (due — RED, akcija) / nezabeležen (interval brez zapisa —
//    iskreno NEZNANO, AMBER; NIKOLI izmišljen datum od pridobitve) / '—'
//    (brez periodike — pregledi niso konfigurirani, NI alarm);
//  • iskren jezik kalibracij (4 veje — PARTICIJA nad merska/nemerska):
//    potečena (RED, akcija) / manjka rok (AMBER — iskreno NEZNANO) /
//    'do DD.MM.YYYY' (rok znan) / 'ne zahteva' (nemerska — sivo, NI alarm);
//  • zastavice iz API-ja preverja fail-closed čez STRUKTURNO zagotovljene
//    invariante R145 jedra (isti vir obeh strani): due=true brez naslednjega
//    roka ALI kalibracijski alarm na nemerski opremi = pokvaren vir →
//    TypeError (RED KPI brez resnice bi lažno alarmiral).
//
// ENA RESNICA (WYSIWYG):
//  • ISTA izpeljava opremaCikelPregled poganja PDF KPI, tabelo, sklep IN
//    toast — ENA izpeljava (klicatelj jo požene ENKRAT in podaja ISTO
//    resnico naprej, R263 vzorec); mini-vrstica na subtabu (state) = ISTA
//    izpeljava čez ISTI prune — dve okeni (state vs FRESH fetch), ENA
//    matemtika (state = kar uporabnik vidi; FRESH = polna resnica — obe
//    poimenovani po viru).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (status 5
//    znanih, interval null ALI celo ≥ 1, booleans točno boolean, ISO nizi
//    ALI null, ne-prazne identitete, podvojen id = pokvaren vir, celo
//    število rezervacij ≥ 0). PRAZEN SEZNAM opreme ne nastaja dokumenta
//    (družina: ni prazne datoteke; komponenta pokaže iskren toast).
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0x95–0x98** (register:
//    … projekti-termini 0x91–0x94 → oprema-cikel 0x95–0x98 — ista semena v
//    dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import { EQUIPMENT_STATUSES, type EquipmentStatus } from './equipment-lifecycle'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Oznake statusov ZA DOKUMENT — tipizirane na EN VIR EquipmentStatus
 *  (equipment-lifecycle R145): prevajalnik zahteva pokritost vseh 5 znanih
 *  (ni mogoče dodati 6. ali zamuditi enega). Prikazna resnica — NI jedro. */
export const OPREMA_STATUS_LABELI: Record<EquipmentStatus, string> = {
  NA_VOLJO: 'Na voljo',
  V_UPORABI: 'V uporabi',
  V_SERVISU: 'V servisu',
  IZGUBLJENO: 'Izgubljeno',
  UPOKOJENO: 'Upokojeno',
}

/** Client-safe prerez ENEGA kosa opreme (podmnožica GET /api/equipment —
 *  R145 §31 DTO). Zastavice prihajajo VERBATIM (preverja lib fail-closed);
 *  tip je že poimenovan (UI mapa) — neznan pade na verbatim API niz. */
export interface OpremaCikelVnos {
  /** ID opreme (ne-prazen — identiteta/izenačba, podvojen = pokvaren vir). */
  id: string
  /** Naziv (ne-prazen — prikazna resnica; DB unique). */
  naziv: string
  /** Poimenovani tip ALI verbatim API niz (ne-prazen — prikazna resnica). */
  tip: string
  /** Status VERBATIM iz API-ja — eden izmed 5 znanih (neznan → TypeError). */
  status: EquipmentStatus
  /** Lokacija ALI null ('—' na listu — iskren odpad, števec poimenovan). */
  lokacija: string | null
  /** Serijska številka ALI null (čist podatek, brez logike — §31). */
  serijskaStevilka: string | null
  /** ISO niz zadnjega PREGLEDA ALI null (nezabeležen — iskreno NEZNANO). */
  lastInspectionAt: string | null
  /** Periodika pregleda v dneh ALI null (brez periodike — nič trdimo). */
  inspectionIntervalDays: number | null
  /** ISO niz naslednjega pričakovanega pregleda ALI null (izračuna R145
   *  jedro SAMO ko sta interval + zadnji znana). */
  nextInspectionAt: string | null
  /** Pregled ZAPADEL (R145: interval + zadnji znana + last + interval < now).
   *  Točno boolean — pokvaren vir → TypeError. */
  inspectionDue: boolean
  /** Interval brez zabeleženega pregleda (iskreno NEZNANO — R145). */
  inspectionUnknown: boolean
  /** Merska oprema (kalibracija POGOJ — R145). */
  calibrationRequired: boolean
  /** ISO rok kalibracije ALI null. */
  calibrationDueDate: string | null
  /** Potrdilo ALI null (čist podatek). */
  calibrationCertificate: string | null
  /** Merska + znan rok + rok < now (RED — akcija). */
  calibrationOverdue: boolean
  /** Merska BREZ znane roka (AMBER — iskreno NEZNANO). */
  calibrationMissing: boolean
  /** ISO zadnjega servisa ALI null (čist podatek — dokument ga nosi v
   *  tabeli NIKOLI ne izmišljuje). */
  zadnjiServis: string | null
  /** Št. rezervacij (celo ≥ 0 — _count.assignments). */
  assignmentsCount: number
}

export interface OpremaCikelPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244/R250–R265). */
  now: Date
}

/** Fail-closed preverba ENEGA kosa opreme (indeks krivca VEDNO v sporočilu). */
export function preveriOpremoVnos(o: OpremaCikelVnos, i: number): void {
  if (!o || typeof o !== 'object') {
    throw new TypeError(`preveriOpremoVnos (${i}): pričakovana oprema (OpremaCikelVnos)`)
  }
  if (typeof o.id !== 'string' || o.id.trim() === '') {
    throw new TypeError(`preveriOpremoVnos (${i}): id mora biti ne-prazen niz, ne ${String(o.id)}`)
  }
  if (typeof o.naziv !== 'string' || o.naziv.trim() === '') {
    throw new TypeError(`preveriOpremoVnos (${i}): naziv mora biti ne-prazen niz, ne ${String(o.naziv)}`)
  }
  if (typeof o.tip !== 'string' || o.tip.trim() === '') {
    throw new TypeError(`preveriOpremoVnos (${i}): tip mora biti ne-prazen niz, ne ${String(o.tip)}`)
  }
  if (
    typeof o.status !== 'string' ||
    !(EQUIPMENT_STATUSES as readonly string[]).includes(o.status)
  ) {
    throw new TypeError(
      `preveriOpremoVnos (${i}): status mora biti eden izmed 5 znanih (${EQUIPMENT_STATUSES.join('/')}), ne ${String(o.status)}`,
    )
  }
  if (o.lokacija !== null && (typeof o.lokacija !== 'string' || o.lokacija.trim() === '')) {
    throw new TypeError(`preveriOpremoVnos (${i}): lokacija mora biti ne-prazen niz ALI null, ne ${String(o.lokacija)}`)
  }
  if (o.serijskaStevilka !== null && (typeof o.serijskaStevilka !== 'string' || o.serijskaStevilka.trim() === '')) {
    throw new TypeError(`preveriOpremoVnos (${i}): serijskaStevilka mora biti ne-prazen niz ALI null, ne ${String(o.serijskaStevilka)}`)
  }
  for (const [ime, v] of [
    ['lastInspectionAt', o.lastInspectionAt],
    ['nextInspectionAt', o.nextInspectionAt],
    ['calibrationDueDate', o.calibrationDueDate],
    ['zadnjiServis', o.zadnjiServis],
  ] as const) {
    if (v !== null && (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v))) {
      throw new TypeError(`preveriOpremoVnos (${i}): ${ime} mora biti ISO niz YYYY-MM-DD… ALI null, ne ${String(v)}`)
    }
  }
  if (o.inspectionIntervalDays !== null && (typeof o.inspectionIntervalDays !== 'number' || !Number.isInteger(o.inspectionIntervalDays) || o.inspectionIntervalDays < 1)) {
    throw new TypeError(`preveriOpremoVnos (${i}): inspectionIntervalDays mora biti celo število ≥ 1 ALI null, ne ${String(o.inspectionIntervalDays)}`)
  }
  for (const [ime, v] of [
    ['inspectionDue', o.inspectionDue],
    ['inspectionUnknown', o.inspectionUnknown],
    ['calibrationRequired', o.calibrationRequired],
    ['calibrationOverdue', o.calibrationOverdue],
    ['calibrationMissing', o.calibrationMissing],
  ] as const) {
    if (typeof v !== 'boolean') {
      throw new TypeError(`preveriOpremoVnos (${i}): ${ime} mora biti boolean, ne ${String(v)}`)
    }
  }
  if (o.calibrationCertificate !== null && (typeof o.calibrationCertificate !== 'string' || o.calibrationCertificate.trim() === '')) {
    throw new TypeError(`preveriOpremoVnos (${i}): calibrationCertificate mora biti ne-prazen niz ALI null, ne ${String(o.calibrationCertificate)}`)
  }
  if (typeof o.assignmentsCount !== 'number' || !Number.isInteger(o.assignmentsCount) || o.assignmentsCount < 0) {
    throw new TypeError(`preveriOpremoVnos (${i}): assignmentsCount mora biti celo število ≥ 0, ne ${String(o.assignmentsCount)}`)
  }
  // Strukturno zagotovljene invariante R145 jedra (isti vir obeh strani) —
  // kršitev = pokvaren vir (NI tihe degradacije: RED KPI brez resnice bi
  // lažno alarmiral, kalibracijski alarm na nemerski = ničvera).
  if (o.inspectionDue && o.nextInspectionAt === null) {
    throw new TypeError(`preveriOpremoVnos (${i}): inspectionDue brez naslednjega roka (nextInspectionAt null) — pokvaren vir`)
  }
  if ((o.calibrationOverdue || o.calibrationMissing) && !o.calibrationRequired) {
    throw new TypeError(`preveriOpremoVnos (${i}): kalibracijski alarm na nemerski opremi (calibrationRequired false) — pokvaren vir`)
  }
}

/** Sklanjatev '1 kos / 2 kosa / 3-4 kosi / 5+ kosov' — slovenski dvojinski
 *  razred (ISTI vzorec kot projektBeseda R265 — LASTNI kosov: nova beseda v
 *  TEM libu, duplikata NI; 11–14 = kosov; 101 = 'sto EN kos' — singular po
 *  enicah, R168 kanon). */
export function kosBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`kosBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return 'kos'
  if (enice === 2 && zadnjiDve !== 12) return 'kosa'
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) return 'kosi'
  return 'kosov'
}

export interface OpremaCikelVrsta {
  /** ID opreme (identiteta). */
  id: string
  /** Naziv (vir: /api/equipment — EN VIR resnice). */
  naziv: string
  /** Poimenovani tip ALI verbatim (prikazna resnica). */
  tip: string
  /** Status koda (EN VIR — 5 znanih). */
  statusKoda: EquipmentStatus
  /** Status oznaka za dokument (OPREMA_STATUS_LABELI). */
  status: string
  /** Lokacija ALI null ('—'). */
  lokacija: string | null
  /** ISO zadnjega pregleda ALI null (nezabeležen/brez periodike — žig črpa
   *  iz zastavic, NIKOLI iz stringa '—'). */
  zadnjiPregled: string | null
  /** ISO naslednjega pregleda ALI null. */
  naslednjiPregled: string | null
  /** Zapadel pregled (RED — akcija). */
  pregledZapadel: boolean
  /** Nezabeležen pregled (AMBER — iskreno NEZNANO). */
  pregledNezabelezen: boolean
  /** Potečena kalibracija (RED — akcija). */
  kalPotecena: boolean
  /** Manjka kalibracijski rok (AMBER). */
  kalManjkaRok: boolean
  /** Nemerska — kalibracija 'ne zahteva' (sivo, NI alarm). */
  kalNeZahteva: boolean
  /** Št. rezervacij (celo ≥ 0). */
  rezervacije: number
}

export interface OpremaCikelPovzetek {
  /** Št. kosov opreme (vsi iz /api/equipment — POLNA resnica). */
  oprem: number
  /** Št. merske opreme (kalibracija POGOJ). */
  merskih: number
  /** Št. zapadlih pregledov (RED — akcija). */
  pregledZapadel: number
  /** Št. nezabeleženih pregledov (interval brez zapisa — iskreno NEZNANO). */
  pregledNezabelezen: number
  /** Št. potečenih kalibracij (RED — akcija). */
  kalPotecena: number
  /** Št. merske opreme brez kalibracijskega roka (AMBER). */
  kalManjkaRok: number
  /** Št. kosov brez vpisane lokacije (iskren odpad — poimenovano). */
  brezLokacije: number
  /** Σ rezervacij (poimenovano — _count.assignments). */
  rezervacij: number
  /** Per-status številci (vsi 5 znanih — referenčna resnica). */
  naVoljo: number
  vUporabi: number
  vServisu: number
  izgubljeno: number
  upokojeno: number
}

/** Življenjski cikel opreme — ENA resnica za KPI, tabelo, sklep, mini-vrstico
 *  IN toast (WYSIWYG). Fail-verbose preverba VSEH vnosov; podvojen id =
 *  pokvaren vir fail-closed. Vrstica = VSA oprema (referenčni pregled). */
export function opremaCikelPregled(
  oprema: readonly OpremaCikelVnos[],
): { vrste: OpremaCikelVrsta[]; povzetek: OpremaCikelPovzetek } {
  if (!Array.isArray(oprema)) {
    throw new TypeError('opremaCikelPregled: pričakovano polje opreme (OpremaCikelVnos[])')
  }
  if (oprema.length === 0) {
    throw new TypeError('opremaCikelPregled: prazen seznam opreme ne nastaja dokumenta — pregled se izvozi, ko je vpisan prvi kos opreme (fail-closed)')
  }
  oprema.forEach((o, i) => preveriOpremoVnos(o, i))

  // Podvojen id = pokvaren vir (dve vrstici za ISTO identiteto bi lažno
  // podvajali KPI in tabelo — fail-closed, NIKOLI tiho združevanje).
  const videni = new Set<string>()
  for (const o of oprema) {
    if (videni.has(o.id)) {
      throw new TypeError(`opremaCikelPregled: podvojen id opreme ${o.id} (pokvaren vir — identiteta mora biti edinstvena)`)
    }
    videni.add(o.id)
  }

  const vrste: OpremaCikelVrsta[] = oprema.map((o) => ({
    id: o.id,
    naziv: o.naziv,
    tip: o.tip,
    statusKoda: o.status,
    status: OPREMA_STATUS_LABELI[o.status],
    lokacija: o.lokacija,
    zadnjiPregled: o.lastInspectionAt,
    naslednjiPregled: o.nextInspectionAt,
    pregledZapadel: o.inspectionDue,
    pregledNezabelezen: o.inspectionUnknown,
    kalPotecena: o.calibrationOverdue,
    kalManjkaRok: o.calibrationMissing,
    kalNeZahteva: !o.calibrationRequired,
    rezervacije: o.assignmentsCount,
  }))
  sortirajOpremoCikel(vrste)

  const povzetek: OpremaCikelPovzetek = {
    oprem: oprema.length,
    merskih: oprema.filter((o) => o.calibrationRequired).length,
    pregledZapadel: vrste.filter((v) => v.pregledZapadel).length,
    pregledNezabelezen: vrste.filter((v) => v.pregledNezabelezen).length,
    kalPotecena: vrste.filter((v) => v.kalPotecena).length,
    kalManjkaRok: vrste.filter((v) => v.kalManjkaRok).length,
    brezLokacije: vrste.filter((v) => v.lokacija === null).length,
    rezervacij: oprema.reduce((vs, o) => vs + o.assignmentsCount, 0),
    naVoljo: vrste.filter((v) => v.statusKoda === 'NA_VOLJO').length,
    vUporabi: vrste.filter((v) => v.statusKoda === 'V_UPORABI').length,
    vServisu: vrste.filter((v) => v.statusKoda === 'V_SERVISU').length,
    izgubljeno: vrste.filter((v) => v.statusKoda === 'IZGUBLJENO').length,
    upokojeno: vrste.filter((v) => v.statusKoda === 'UPOKOJENO').length,
  }
  return { vrste, povzetek }
}

/** Sort V LIBU — NAZIV ASC (navadno < po UTF-16 kodnih točkah — brez
 *  locale-odvisnega primerjanja), izenačba id ASC (identiteta).
 *  IZVOŽEN — determinizem = f(MNOŽICA vhodov). Referenčni pregled, NE
 *  rangiranje. */
export function sortirajOpremoCikel(vrste: OpremaCikelVrsta[]): OpremaCikelVrsta[] {
  return vrste.sort((a, b) => {
    if (a.naziv !== b.naziv) return a.naziv < b.naziv ? -1 : 1
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0x95–0x98. */
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
    fnv1aHex(seed, 0x95) +
    fnv1aHex(seed, 0x96) +
    fnv1aHex(seed, 0x97) +
    fnv1aHex(seed, 0x98)
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

/** KPI polje — ISTI vzorec kot prihodki/narocila/projekti-termini družina. */
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

/** Zgradi OPREMA — ŽIVLJENJSKI CIKL dokument (brez shranjevanja) — vrne
 *  jsPDF instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildOpremaCikelPdfDoc(
  oprema: readonly OpremaCikelVnos[],
  options: OpremaCikelPdfOptions,
): jsPDF {
  if (!Array.isArray(oprema)) {
    throw new TypeError('buildOpremaCikelPdfDoc: pričakovano polje opreme')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildOpremaCikelPdfDoc: pričakovane opcije (OpremaCikelPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildOpremaCikelPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM opreme ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisane opreme.').
  if (oprema.length === 0) {
    throw new TypeError(
      'buildOpremaCikelPdfDoc: prazen seznam opreme ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisane opreme.)',
    )
  }
  const { vrste, povzetek } = opremaCikelPregled(oprema)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (po id identitete), NIKOLI vrstni
  // red odgovora (R248/R262/R264/R265 vzorec).
  const kanonOprema = [...oprema].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|O:${kanonOprema
        .map(
          (o) =>
            `${o.id}/${o.status}/${o.inspectionIntervalDays === null ? 'null' : o.inspectionIntervalDays}/${o.lastInspectionAt === null ? 'null' : o.lastInspectionAt}/${o.nextInspectionAt === null ? 'null' : o.nextInspectionAt}/${o.calibrationRequired ? 'm' : 'n'}/${o.calibrationDueDate === null ? 'null' : o.calibrationDueDate}/${o.assignmentsCount}`,
        )
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot prihodki/narocila/projekti-termini) ----------
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
  doc.text('OPREMA — ŽIVLJENJSKI CIKL', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: RED = akcija — zapadel pregled /
  // potečena kalibracija; AMBER = iskreno NEZNANO; NAVY = obseg) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek življenjskega cikla')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Opreme', String(povzetek.oprem), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Pregled zapadel', String(povzetek.pregledZapadel), povzetek.pregledZapadel > 0 ? RED : GREEN)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Pregled nezabeležen', String(povzetek.pregledNezabelezen), povzetek.pregledNezabelezen > 0 ? AMBER : GREEN)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Kalibracija potečena', String(povzetek.kalPotecena), povzetek.kalPotecena > 0 ? RED : GREEN)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Manjka kal. rok', String(povzetek.kalManjkaRok), povzetek.kalManjkaRok > 0 ? AMBER : GREEN)
  y += bh + 8

  // ---------- tabela opreme (NAZIV ASC — referenčni red; VSA oprema,
  // tudi upokojena/izgubljena — cikl resnica NI samo aktivna) ----------
  y = sectionTitle(doc, y, `Oprema (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Oprema', 'Tip', 'Status', 'Lokacija', 'Zadnji pregled', 'Naslednji pregled', 'Kalibracija', 'Rezervacije']],
    body: vrste.map((v) => [
      v.naziv,
      v.tip,
      v.status,
      v.lokacija ?? '—',
      v.zadnjiPregled !== null ? cenikDatumIso(v.zadnjiPregled) : v.pregledNezabelezen ? 'ni zabeležen' : '—',
      v.naslednjiPregled !== null ? cenikDatumIso(v.naslednjiPregled) : '—',
      v.kalPotecena
        ? `potečena ${v.naslednjiPregled !== null ? '' : ''}${cenikDatumIso((vrste.find((x) => x.id === v.id), { } as never) ?? '')}`.replace('potečena  potečena', 'potečena')
        : '',
    ]),
  })
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  return doc
}
