// ---------------------------------------------------------------------------
// R265 (P1-f, 'izvozi' družina — 21. člen) — PROJEKTI — TERMINI PREGLED PDF iz
// Logistika (logistics-tab). Vzorec dobavitelji-pozicija-pdf R264 /
// stranke-pokritost-pdf R263 / zaloga-osnutek-pdf R262: ROKSAL glava, KPI,
// autoTable, noge, bajtni determinizem.
//
// PRESEK DVEH VIROV (route NIČ — client+lib only):
//  • /api/schedules — FRESH fetch VSEH terminov ISTEGA endpointa ob kliku
//    (R244/R245/R264 precedens: FRESH-podatki ob kliku, nič state-a, nič
//    nove mreže) — dokument = PORTFELJSKA resnica, NE glede na projekt-
//    filter taba (auto-izbor projekta NE SME skriti planskih luknij
//    drugih projektov); lib jemlje surove resnice projectId/status/
//    predvideneUre/datumZacetka ×
//    /api/projects (projekti: id/naziv/datumMontaze/customer.ime);
//  • JOIN po IDENTITETI projectId === project.id (v === s — R260–R264
//    lekcija); termin, katerega projectId NI med projekti = pokvaren vir /
//    race → števec poimenovan `sirotTerminov` (NIKOLI tiho, NIKOLI izmišljen
//    projekt — R262/R264 'brez-cene' vzorec);
//  • vrstica = VSAK projekt z vsaj enim UJEMajočim terminom (referenčni
//    pregled — NE rangiranje; sort NAZIV ASC + izenačba id ASC, navadno <
//    — brez locale-odvisnega primerjanja; dva istonaslovna projekta =
//    RAZLIČNI resnici po id, R260–R264 lekcija);
//  • pokritost (iskren jezik): Z termini (≥ 1 ujemajoč termin) ALI brez
//    termina (0 terminov); najostrejša planska luknja = projekt s PLANIRANO
//    montažo (datumMontaze vpisan) a BREZ termina — ločen KPI RED>0
//    (montaža pričakovana, urnik še prazen — akcijska resnica za pisarno);
//  • statusi VERBATIM 5 znanih (SCHEDULE_TERMINI_STATUSI; neznan = pokvaren
//    vir → TypeError z indeksom krivca); per projekt stolpca Načrtovano
//    (NAVRTENO) / V teku (V_TEKU) / Zaključeno (ZAKLJUCENO); PREKlicANO in
//    PRELOZENO sta VIDNA (štejeta v Terminov), poimenovana v sklepu;
//  • predvidene ure: Σ čez NE-preklicane termine z znano uro (preklic ni
//    delovni tok — R257 vzorec: vidni, ampak IZKLJUČENI iz vsote, poimenovani
//    v sklepu); predvideneUre null = 'brez ure' → izključena iz vsote,
//    števec poimenovan (NIKOLI izmišljen 0 — R168 vzorec); vrstica, kjer
//    NIČ ne šteje v vsoto (vsi preklicani ali vsi brez ure) = '—' sivo;
//  • obdobje = prvi → zadnji vidni termin (min/max ISO niz — nizovna
//    primerjava po kodnih točkah = kronološka za YYYY-MM-DDTHH…, brez
//    locale/TZ odvisnosti; ista oblika kot vozni red R255).
//
// ENA RESNICA (WYSIWYG):
//  • ISTA izpeljava projektiTerminiPregled poganja PDF KPI, tabelo, sklep
//    IN toast — ENA izpeljava (klicatelj jo požene ENKRAT in podaja ISTO
//    resnico naprej — podatki iz state-a ob kliku, vzorec R263).
//
// Načela (družinska pravila):
//  • Fail-closed: pokvaren vnos → TypeError z indeksom krivca (status 5
//    znanih, ure končno celo ≥ 0 ALI null, ISO datumi, ne-prazne identitete,
//    podvojen projekt id = pokvaren vir). PRAZEN SEZNAM terminov ne nastaja
//    dokumenta (družina: ni prazne datoteke; komponenta pokaže iskren toast);
//    prazen seznam projektov prav tako; vsi termini tujci → TypeError
//    (prazna tabela bi lažno trdila pregled).
//  • Determinizem: `now` KOT parameter; doc.setCreationDate(now) +
//    doc.setFileId(FNV-1a) — enak vhod = bajtno enak PDF (document-pdf R121).
//  • CLIENT-safe: čista JS FNV-1a; LASTNI soli **0x91–0x94** (register:
//    … dobavitelji-pozicija 0x8d–0x90 → projekti-termini 0x91–0x94 —
//    ista semena v dveh libih NE smejo dati isti ID).
// ---------------------------------------------------------------------------

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerSloPdfFonts } from './pdf-sl-font'
import { todayStamp } from './csv-export'
import { zalogaPovzetekCasOznaka } from './zaloga-povzetek'
import { cenikDatumIso } from './cenik-pdf'
import {
  SCHEDULE_TERMINI_STATUSI,
  terminBeseda,
  type ScheduleTerminStatus,
} from './termini-prikaz'

// ---------- barve (ISTI dokumenti družina — 0 novih hex) ----------
const NAVY: [number, number, number] = [29, 43, 62] // roksal-navy
const AMBER: [number, number, number] = [250, 179, 32] // roksal-amber
const GREEN: [number, number, number] = [22, 163, 74] // roksal-green
const RED: [number, number, number] = [220, 38, 38] // zaloga-pdf R120 red
const GRAY: [number, number, number] = [110, 110, 110]
const LIGHT: [number, number, number] = [243, 244, 246]

/** Client-safe prerez ENEGA vidnega termina (podmnožica GET /api/schedules →
 *  project.id + status + predvideneUre + datumZacetka). */
export interface ProjektiTerminiTerminVnos {
  /** ID projekta (ne-prazen — IDENTITETA joina, fail-closed). */
  projectId: string
  /** Status VERBATIM iz API-ja — eden izmed 5 znanih (neznan → TypeError). */
  status: ScheduleTerminStatus
  /** Predvidene ure: končno celo ≥ 0 ALI null ('brez ure' — izključena iz
   *  vsote, poimenovana; NIKOLI izmišljen 0 — R168 vzorec). */
  predvideneUre: number | null
  /** ISO niz (YYYY-MM-DDTHH…) — začetek termina (obvezujoč: obdobje). */
  datumZacetka: string
}

/** Client-safe prerez ENEGA projekta (podmnožica GET /api/projects). */
export interface ProjektiTerminiProjektVnos {
  /** ID projekta (ne-prazen — identiteta/izenačba). */
  id: string
  /** Naziv projekta (ne-prazen — prikazna resnica). */
  nazivProjekta: string
  /** Planirana montaža (ISO niz) ALI null — planirana montaža BREZ termina =
   *  najostrejša planska luknja (ločen KPI RED>0). */
  datumMontaze: string | null
  /** Stranka (customer.ime) ALI null ('—' na listu — iskren odpad). */
  stranka: string | null
}

export interface ProjektiTerminiPdfOptions {
  /** Referenčni trenutek (žig + CreationDate + fileId + ime) — KOT
   *  PARAMETER (determinizem; vzorec R203/R244/R250–R264). */
  now: Date
}

/** Fail-closed preverba termina (indeks krivca VEDNO v sporočilu). */
export function preveriTerminVnos(t: ProjektiTerminiTerminVnos, i: number): void {
  if (!t || typeof t !== 'object') {
    throw new TypeError(`preveriTerminVnos (${i}): pričakovan termin (ProjektiTerminiTerminVnos)`)
  }
  if (typeof t.projectId !== 'string' || t.projectId.trim() === '') {
    throw new TypeError(`preveriTerminVnos (${i}): projectId mora biti ne-prazen niz, ne ${String(t.projectId)}`)
  }
  if (
    typeof t.status !== 'string' ||
    !(SCHEDULE_TERMINI_STATUSI as readonly string[]).includes(t.status)
  ) {
    throw new TypeError(
      `preveriTerminVnos (${i}): status mora biti eden izmed 5 znanih (${SCHEDULE_TERMINI_STATUSI.join('/')}), ne ${String(t.status)}`,
    )
  }
  if (
    t.predvideneUre !== null &&
    (typeof t.predvideneUre !== 'number' || !Number.isFinite(t.predvideneUre) || !Number.isInteger(t.predvideneUre) || t.predvideneUre < 0)
  ) {
    throw new TypeError(`preveriTerminVnos (${i}): predvideneUre mora biti končno celo ne-negativno število ALI null, ne ${String(t.predvideneUre)}`)
  }
  if (typeof t.datumZacetka !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(t.datumZacetka)) {
    throw new TypeError(`preveriTerminVnos (${i}): datumZacetka mora biti ISO niz YYYY-MM-DD…, ne ${String(t.datumZacetka)}`)
  }
}

/** Fail-closed preverba projekta (indeks krivca). */
export function preveriProjektVnos(p: ProjektiTerminiProjektVnos, i: number): void {
  if (!p || typeof p !== 'object') {
    throw new TypeError(`preveriProjektVnos (${i}): pričakovan projekt (ProjektiTerminiProjektVnos)`)
  }
  if (typeof p.id !== 'string' || p.id.trim() === '') {
    throw new TypeError(`preveriProjektVnos (${i}): id mora biti ne-prazen niz, ne ${String(p.id)}`)
  }
  if (typeof p.nazivProjekta !== 'string' || p.nazivProjekta.trim() === '') {
    throw new TypeError(`preveriProjektVnos (${i}): nazivProjekta mora biti ne-prazen niz, ne ${String(p.nazivProjekta)}`)
  }
  if (p.datumMontaze !== null && (typeof p.datumMontaze !== 'string' || p.datumMontaze.trim() === '')) {
    throw new TypeError(`preveriProjektVnos (${i}): datumMontaze mora biti ne-prazen niz ALI null, ne ${String(p.datumMontaze)}`)
  }
  if (p.stranka !== null && (typeof p.stranka !== 'string' || p.stranka.trim() === '')) {
    throw new TypeError(`preveriProjektVnos (${i}): stranka mora biti ne-prazen niz ALI null, ne ${String(p.stranka)}`)
  }
}

/** Determinističen file-ID (32 hex) — čista JS FNV-1a; LASTNI soli 0x91–0x94. */
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
    fnv1aHex(seed, 0x91) +
    fnv1aHex(seed, 0x92) +
    fnv1aHex(seed, 0x93) +
    fnv1aHex(seed, 0x94)
  )
}

/** Sklanjatev '1 projekt / 2 projekta / 3-4 projekti / 5+ projektov' — ISTI
 *  slovenski razred kot terminBeseda (R168; EN VIR terminov, LASTNI projektov
 *  — nova beseda v TEM libu, duplikata NI: terminBeseda prihaja iz
 *  termini-prikaz). */
export function projektBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(
      `projektBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`,
    )
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return 'projekt'
  if (enice === 2 && zadnjiDve !== 12) return 'projekta'
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) return 'projekti'
  return 'projektov'
}

export interface ProjektTerminiVrsta {
  /** ID projekta (identiteta). */
  id: string
  /** Naziv projekta (vir: /api/projects — EN VIR resnice). */
  naziv: string
  /** Stranka ALI null ('—'). */
  stranka: string | null
  /** Št. vidnih terminov projekta (vsi statusi — tudi preklicani/preloženi).
   *  'Vidni' = vpisani v /api/schedules odgovor (FRESH fetch ob kliku). */
  terminov: number
  /** Št. NAVRTENO. */
  nacrtovano: number
  /** Št. V_TEKU. */
  vTeku: number
  /** Št. ZAKLJUCENO. */
  zakljuceno: number
  /** Σ predvidenih ur NE-preklicanih z znano uro; null = NIČ ne šteje v
   *  vsoto (vsi preklicani ali vsi brez ure) → '—' sivo. */
  ure: number | null
  /** Prvi vpisani termin (ISO — min po kodnih točkah). */
  prvi: string
  /** Zadnji vpisani termin (ISO — max po kodnih točkah). */
  zadnji: string
}

export interface ProjektiTerminiPovzetek {
  /** Št. projektov (vsi iz /api/projects). */
  projektov: number
  /** Št. projektov z vsaj enim ujemajočim terminom (= vrstic). */
  zTermini: number
  /** Št. projektov brez termina. */
  brezTermina: number
  /** Št. projektov s planirano montažo (datumMontaze) a brez termina —
   *  najostrejša planska luknja (montaža pričakovana, urnik prazen). */
  planBrezTermina: number
  /** Št. vpisanih terminov skupaj (vsi statusi). */
  terminov: number
  /** Št. PREKlicANO (vidni; ure izključene iz vsote — poimenovano). */
  preklicanih: number
  /** Št. PRELOZENO (vidni; ure V vsoti — poimenovano). */
  prelozenih: number
  /** Št. terminov brez znane ure (izključeni iz vsote — poimenovani). */
  brezUre: number
  /** Σ predvidenih ur ne-preklicanih z znano uro. */
  ur: number
  /** Št. terminov, katerih projectId NI med projekti (race — poimenovano). */
  sirotTerminov: number
}

/** Presek projektov × terminov — ENA resnica za KPI, tabelo, sklep IN toast
 *  (WYSIWYG). JOIN po IDENTITETI projectId; fail-verbose preverba VSEH
 *  vnosov; tujci poimenovani, dvojiki fail-closed. */
export function projektiTerminiPregled(
  projekti: readonly ProjektiTerminiProjektVnos[],
  termini: readonly ProjektiTerminiTerminVnos[],
): { vrste: ProjektTerminiVrsta[]; povzetek: ProjektiTerminiPovzetek } {
  if (!Array.isArray(projekti)) {
    throw new TypeError('projektiTerminiPregled: pričakovano polje projektov (ProjektiTerminiProjektVnos[])')
  }
  if (!Array.isArray(termini)) {
    throw new TypeError('projektiTerminiPregled: pričakovano polje terminov (ProjektiTerminiTerminVnos[])')
  }
  if (projekti.length === 0) {
    throw new TypeError('projektiTerminiPregled: prazen seznam projektov ne nastaja dokumenta (fail-closed — komponenta pokaže iskren toast)')
  }
  if (termini.length === 0) {
    throw new TypeError('projektiTerminiPregled: prazen seznam terminov ne nastaja dokumenta — pregled se izvozi, ko je vpisan prvi termin (fail-closed)')
  }
  projekti.forEach((p, i) => preveriProjektVnos(p, i))
  termini.forEach((t, i) => preveriTerminVnos(t, i))

  // Podvojen projekt id = pokvaren vir (dve vrstici za ISTO identiteto bi
  // lažno podvajale KPI in tabelo — fail-closed, NIKOLI tiho združevanje).
  const videni = new Set<string>()
  for (const p of projekti) {
    if (videni.has(p.id)) {
      throw new TypeError(`projektiTerminiPregled: podvojen projekt id ${p.id} (pokvaren vir — identiteta mora biti edinstvena)`)
    }
    videni.add(p.id)
  }

  // Per projekt agregat (identiteta = projectId; naziv/stranka iz projekta).
  const poProjektu = new Map<string, { terminov: number; nacrtovano: number; vTeku: number; zakljuceno: number; vsotaUr: number; stevecUr: number; prvi: string; zadnji: string }>()
  let preklicanih = 0
  let prelozenih = 0
  let brezUre = 0
  let ur = 0
  let sirotTerminov = 0
  termini.forEach((t) => {
    if (!videni.has(t.projectId)) {
      // Tujec = projekt NI v /api/projects odgovoru (race/brisanje) —
      // poimenovan števec, NIKOLI izmišljen projekt (R262/R264 vzorec).
      sirotTerminov += 1
      return
    }
    if (t.status === 'PREKlicANO') preklicanih += 1
    if (t.status === 'PRELOZENO') prelozenih += 1
    if (t.predvideneUre === null) brezUre += 1
    const g = poProjektu.get(t.projectId)
    const vrsta = g ?? { terminov: 0, nacrtovano: 0, vTeku: 0, zakljuceno: 0, vsotaUr: 0, stevecUr: 0, prvi: t.datumZacetka, zadnji: t.datumZacetka }
    vrsta.terminov += 1
    if (t.status === 'NAVRTENO') vrsta.nacrtovano += 1
    if (t.status === 'V_TEKU') vrsta.vTeku += 1
    if (t.status === 'ZAKLJUCENO') vrsta.zakljuceno += 1
    if (t.status !== 'PREKlicANO' && t.predvideneUre !== null) {
      vrsta.vsotaUr += t.predvideneUre
      vrsta.stevecUr += 1
      ur += t.predvideneUre
    }
    if (t.datumZacetka < vrsta.prvi) vrsta.prvi = t.datumZacetka
    if (t.datumZacetka > vrsta.zadnji) vrsta.zadnji = t.datumZacetka
    poProjektu.set(t.projectId, vrsta)
  })

  const nazivi = new Map(projekti.map((p) => [p.id, { naziv: p.nazivProjekta, stranka: p.stranka }]))
  const vrste: ProjektTerminiVrsta[] = []
  for (const [id, g] of poProjektu) {
    const n = nazivi.get(id)!
    vrste.push({
      id,
      naziv: n.naziv,
      stranka: n.stranka,
      terminov: g.terminov,
      nacrtovano: g.nacrtovano,
      vTeku: g.vTeku,
      zakljuceno: g.zakljuceno,
      ure: g.stevecUr > 0 ? g.vsotaUr : null,
      prvi: g.prvi,
      zadnji: g.zadnji,
    })
  }
  if (vrste.length === 0) {
    throw new TypeError('projektiTerminiPregled: vsi termini tujci (projectId brez ujemajočega projekta) — prazna tabela bi lažno trdila pregled (fail-closed)')
  }
  sortirajProjekteTermini(vrste)

  const zTermini = vrste.length
  let planBrezTermina = 0
  for (const p of projekti) {
    if (!poProjektu.has(p.id) && p.datumMontaze !== null) planBrezTermina += 1
  }
  return {
    vrste,
    povzetek: {
      projektov: projekti.length,
      zTermini,
      brezTermina: projekti.length - zTermini,
      planBrezTermina,
      terminov: termini.length,
      preklicanih,
      prelozenih,
      brezUre,
      ur,
      sirotTerminov,
    },
  }
}

/** Sort V LIBU — NAZIV ASC (navadno < po UTF-16 kodnih točkah — brez
 *  locale-odvisnega primerjanja), izenačba id ASC (identiteta).
 *  IZVOŽEN — determinizem = f(MNOŽICA vhodov). Referenčni pregled, NE
 *  rangiranje. */
export function sortirajProjekteTermini(
  vrste: ProjektTerminiVrsta[],
): ProjektTerminiVrsta[] {
  return vrste.sort((a, b) => {
    if (a.naziv !== b.naziv) return a.naziv < b.naziv ? -1 : 1
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

/** KPI polje — ISTI vzorec kot prihodki/narocila/dobavitelji-pozicija družina. */
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

/** Zgradi PROJEKTI — TERMINI PREGLED dokument (brez shranjevanja) — vrne
 *  jsPDF instanco (testi berejo doc.output('arraybuffer') → bajtni dokazi). */
export function buildProjektiTerminiPdfDoc(
  projekti: readonly ProjektiTerminiProjektVnos[],
  termini: readonly ProjektiTerminiTerminVnos[],
  options: ProjektiTerminiPdfOptions,
): jsPDF {
  if (!Array.isArray(projekti) || !Array.isArray(termini)) {
    throw new TypeError('buildProjektiTerminiPdfDoc: pričakovani polji projektov in terminov')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildProjektiTerminiPdfDoc: pričakovane opcije (ProjektiTerminiPdfOptions)')
  }
  const { now } = options
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildProjektiTerminiPdfDoc: pričakovan veljaven now: Date')
  }
  // PRAZEN SEZNAM terminov ne nastaja dokumenta (družina: ni prazne datoteke —
  // komponenta pokaže iskren toast 'Ni vpisanih terminov.').
  if (termini.length === 0) {
    throw new TypeError(
      'buildProjektiTerminiPdfDoc: prazen seznam terminov ne nastaja dokumenta — komponenta pokaže iskren toast (Ni vpisanih terminov.)',
    )
  }
  if (projekti.length === 0) {
    throw new TypeError(
      'buildProjektiTerminiPdfDoc: prazen seznam projektov ne nastaja dokumenta (fail-closed)',
    )
  }
  const { vrste, povzetek } = projektiTerminiPregled(projekti, termini)

  const doc = new jsPDF()
  registerSloPdfFonts(doc)

  // ---------- determinizem (vzorec document-pdf R121 / družina) ----------
  doc.setCreationDate(now)
  // Seed = f(MNOŽICA) — kanoniziran red (termini: projectId/datumZacetka/
  // status/ure; projekti: id), NIKOLI vrstni red odgovora (R248/R262/R264
  // vzorec).
  const kanonTermini = [...termini].sort((a, b) => {
    if (a.projectId !== b.projectId) return a.projectId < b.projectId ? -1 : 1
    if (a.datumZacetka !== b.datumZacetka) return a.datumZacetka < b.datumZacetka ? -1 : 1
    if (a.status !== b.status) return a.status < b.status ? -1 : 1
    return (a.predvideneUre ?? -1) - (b.predvideneUre ?? -1)
  })
  const kanonProjekti = [...projekti].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  doc.setFileId(
    deterministichenId(
      `${now.toISOString()}|T:${kanonTermini
        .map((t) => `${t.projectId}/${t.datumZacetka}/${t.status}/${t.predvideneUre === null ? 'null' : t.predvideneUre}`)
        .join(',')}|P:${kanonProjekti
        .map((p) => `${p.id}/${p.datumMontaze === null ? 'null' : p.datumMontaze}`)
        .join(',')}`,
    ),
  )

  // ---------- glava (ISTI vzorec kot prihodki/narocila/dobavitelji-pozicija) ----------
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
  doc.text('PROJEKTI — TERMINI PREGLED', 196, 12, { align: 'right' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`osveženo ${zalogaPovzetekCasOznaka(now)}`, 196, 19, { align: 'right' })

  // ---------- KPI 5 (signalni jezik: RED = planska luknja — brez termina /
  // planirana montaža brez termina; GREEN = pokriti projekti; NAVY = obseg) ----------
  let y = 33
  y = sectionTitle(doc, y, 'Povzetek pokritosti')
  const bw = 33
  const bh = 16
  const gap = 4
  kpiBox(doc, 14, y, bw, bh, 'Projektov', String(povzetek.projektov), NAVY)
  kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Z termini', String(povzetek.zTermini), povzetek.zTermini > 0 ? GREEN : NAVY)
  kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Brez termina', String(povzetek.brezTermina), povzetek.brezTermina > 0 ? RED : NAVY)
  kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh, 'Plan. brez termina', String(povzetek.planBrezTermina), povzetek.planBrezTermina > 0 ? RED : NAVY)
  kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh, 'Predvidenih ur', String(povzetek.ur), NAVY)
  y += bh + 8

  // ---------- tabela projektov (NAZIV ASC — referenčni red) ----------
  y = sectionTitle(doc, y, `Projekti z termini (${vrste.length})`)
  autoTable(doc, {
    startY: y,
    head: [['Projekt', 'Stranka', 'Terminov', 'Načrtovano', 'V teku', 'Zaključeno', 'Ur', 'Obdobje']],
    body: vrste.map((v) => [
      v.naziv,
      v.stranka ?? '—',
      String(v.terminov),
      String(v.nacrtovano),
      String(v.vTeku),
      String(v.zakljuceno),
      v.ure !== null ? String(v.ure) : '—',
      v.prvi === v.zadnji ? cenikDatumIso(v.prvi) : `${cenikDatumIso(v.prvi)} → ${cenikDatumIso(v.zadnji)}`,
    ]),
    styles: { fontSize: 8, cellPadding: 1.8, font: 'Roboto' },
    headStyles: { fillColor: [...NAVY], textColor: 255, fontSize: 8 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    didParseCell: (data) => {
      // WYSIWYG: V teku AMBER bold (delo trenutno poteka); Zaključeno GREEN
      // bold (narejeno); '—' Ur sivo (nič ne šteje v vsoto — iskren odpad).
      if (data.section === 'body' && data.column.index === 4 && data.cell.raw !== '—' && Number(String(data.cell.raw ?? '')) > 0) {
        data.cell.styles.textColor = AMBER
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.section === 'body' && data.column.index === 5 && data.cell.raw !== '—' && Number(String(data.cell.raw ?? '')) > 0) {
        data.cell.styles.textColor = GREEN
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.section === 'body' && data.column.index === 6 && data.cell.raw === '—') {
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
    `${povzetek.zTermini} ${projektBeseda(povzetek.zTermini)} z vpisanimi termini od ${povzetek.projektov} · brez termina ${povzetek.brezTermina} (od tega s planirano montažo ${povzetek.planBrezTermina}) · ${povzetek.terminov} ${terminBeseda(povzetek.terminov)} · predvidenih ur ${povzetek.ur} (brez ure ${povzetek.brezUre} — izključene iz vsote) · preklicanih ${povzetek.preklicanih} (ure preklicanih izključene iz vsote) · preloženih ${povzetek.prelozenih} (ure v vsoti) · obdobje = prvi → zadnji vpisani termin · terminov brez ujemajočega projekta ${povzetek.sirotTerminov} (poimenovano) · vir = /api/schedules (vsi termini) × /api/projects.`,
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

/** Ime datoteke — `Projekti-termini-YYYY-MM-DD.pdf` (družinski vzorec;
 *  deterministično glede na `now`; EN now za žig IN ime — lekcija R121/R235). */
export function projektiTerminiPdfFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('projektiTerminiPdfFilename: pričakovan veljaven now: Date')
  }
  return `Projekti-termini-${todayStamp(now)}.pdf`
}

/** Zgeneriraj PROJEKTI — TERMINI PREGLED PDF (determinističen — enak vhod =
 *  bajtno enak dokument) in ga shrani. */
export function generateProjektiTerminiPdf(
  projekti: readonly ProjektiTerminiProjektVnos[],
  termini: readonly ProjektiTerminiTerminVnos[],
  options: ProjektiTerminiPdfOptions,
): void {
  const doc = buildProjektiTerminiPdfDoc(projekti, termini, options)
  doc.save(projektiTerminiPdfFilename(options.now))
}
