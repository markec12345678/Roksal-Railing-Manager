// R166 — prikaz termina montaže (InstallationSchedule) na dashboardu.
// ---------------------------------------------------------------------------
// Kartica "Termini — naslednjih 7 dni" bral /api/schedules; ta knjižnica je
// čista (client-safe, brez fetch/prisma) in testirljiva, po vzorcu
// vodja-csv / nagibi-csv / status-options.
//
// Načela:
//  • EN VIR RESNICE za statusna besedila in barve značk — knjižnica je edini
//    vir; komponenta in morebiten prihodnji izvoz bereta isto preslikavo.
//    (vodja-csv.terminStatusLabel je OBSEŽEN na sintetizirane projektne
//    statuse, a NE pozna schedule statusov PREKlicANO/PRELOZENO — tam bi
//    'Preklicano' lažno pokazal kot 'Načrtovano'. Zato ločena, iskrena mapa.)
//  • Fail-closed: neznan status ali neveljaven datum → TypeError. Klicatelj
//    (kartica) vrstico PRESKOČI in število preskočenih VIDNO pokaže —
//    nikoli izmišljenih podatkov, nikoli tihega padca.
//  • Determinizem: vse funkcije sprejmejo `now: Date` kot parameter — brez
//    skrite Date.now() odvisnosti (100 % testabilno, brez utripanja).

/** Statusi prisma polja InstallationSchedule.status (glej schema.prisma). */
export const SCHEDULE_TERMINI_STATUSI = [
  'NAVRTENO',
  'V_TEKU',
  'ZAKLJUCENO',
  'PREKlicANO',
  'PRELOZENO',
] as const

export type ScheduleTerminStatus = (typeof SCHEDULE_TERMINI_STATUSI)[number]

/** Iskrena besedila statusov termina — točno tisto, kar status pomeni. */
export const SCHEDULE_TERMINI_STATUS_LABELS: Readonly<
  Record<ScheduleTerminStatus, string>
> = {
  NAVRTENO: 'Načrtovano',
  V_TEKU: 'V teku',
  ZAKLJUCENO: 'Zaključeno',
  PREKlicANO: 'Preklicano',
  PRELOZENO: 'Preloženo',
}

/** Barve značk (Tailwind razredi) — vzorec deal-pipeline/dashboard statusColors,
 *  vsaka z dark: variantami (temna tema = prvi državljan, nauček R162–R165). */
export const SCHEDULE_TERMINI_STATUS_COLORS: Readonly<
  Record<ScheduleTerminStatus, string>
> = {
  NAVRTENO:
    'bg-roksal-navy/10 text-roksal-ink hover:bg-roksal-navy/15 dark:bg-roksal-ink/15 dark:text-roksal-ink dark:hover:bg-roksal-ink/25',
  V_TEKU:
    'bg-roksal-amber/15 text-roksal-ink hover:bg-roksal-amber/25 dark:bg-roksal-amber/25 dark:text-roksal-amber',
  ZAKLJUCENO:
    'bg-roksal-green/15 text-roksal-green hover:bg-roksal-green/25 dark:bg-roksal-green/25 dark:text-green-300',
  PREKlicANO:
    'bg-roksal-red/15 text-roksal-red hover:bg-roksal-red/25 dark:bg-roksal-red/25 dark:text-red-300',
  PRELOZENO:
    'bg-purple-100 text-purple-800 hover:bg-purple-100/80 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-950/60',
}

function jeZnanStatus(status: unknown): status is ScheduleTerminStatus {
  return (
    typeof status === 'string' &&
    Object.prototype.hasOwnProperty.call(SCHEDULE_TERMINI_STATUS_LABELS, status)
  )
}

/** Neznan status → TypeError (fail-closed); klicatelj pokaže preskočeno števec. */
export function scheduleTerminiStatusLabel(status: string): string {
  if (!jeZnanStatus(status)) {
    throw new TypeError(
      `scheduleTerminiStatusLabel: neznan status termina: ${String(status)}`
    )
  }
  return SCHEDULE_TERMINI_STATUS_LABELS[status]
}

/** Neznan status → TypeError (fail-closed) — enaka strogost kot besedila. */
export function scheduleTerminiStatusColor(status: string): string {
  if (!jeZnanStatus(status)) {
    throw new TypeError(
      `scheduleTerminiStatusColor: neznan status termina: ${String(status)}`
    )
  }
  return SCHEDULE_TERMINI_STATUS_COLORS[status]
}

/** Okno branja: [začetek današnjega dne, konec 6. dneva naprej] — lokalni
 *  koledar uporabnika ("danes" je iskreno DANES za tistega, ki gleda).
 *  `do` je 1 ms pred polnočjo 7. dneva, da API (datumZacetka lte) ne ulove
 *  termina, ki pripada naslednjemu tednu. */
export interface TerminiOkno {
  od: string
  do: string
}

export function terminiOkno(now: Date): TerminiOkno {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('terminiOkno: pričakovan veljaven now: Date')
  }
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const start = new Date(y, m, d)
  const end = new Date(y, m, d + 7).getTime() - 1
  return { od: start.toISOString(), do: new Date(end).toISOString() }
}

/** Vrstica, pripravljena za prikaz — imena so NEPRTIČNA (null → 'Ni …'
 *  v UI, po vzorcu 'Ni naslova'/'Ni stranke' na kartici Naslednja montaža). */
export interface TerminPrikazVnos {
  id: string
  projectId: string
  projektIme: string | null
  strankaIme: string | null
  strankaNaslov: string | null
  lokacija: string | null
  ekipaIme: string | null
  monterId: string | null
  monterIme: string | null
  status: ScheduleTerminStatus
  datumZacetka: string
  /** R168 — predvidene ure dela (schema InstallationSchedule.predvideneUre,
   *  Int @default(8)). Pomožni podatek: manjkajoči/pokvarjen → null (izključen
   *  iz vsote, NIKOLI izmišljen kot 0 — "brez podatka" ≠ "nič ur"); NE
   *  razveljavi sicer veljavne vrstice (jedro = datum/status/id). */
  predvideneUre: number | null
  /** monterId je natanko enak prijavljenemu uporabniku (moja montaža). */
  moja: boolean
}

export interface TerminSkupine {
  danes: TerminPrikazVnos[]
  kasneje: TerminPrikazVnos[]
  /** Vidno prikazano: "n vnosov preskočenih (neveljaven datum/status)". */
  preskoceniNeveljaven: number
  preskoceniNeznanStatus: number
}

function jeIstiLokalniDan(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Normalizira Surovi API vnos → prikazna vrstica. Vrne null z razlogom, kadar
 *  je vnos spodnjen (fail-closed, brez izmišljanja): 'oblika' | 'status'. */
export function normalizirajTermin(
  raw: unknown,
  myUserId: string | null
): { vnos: TerminPrikazVnos } | { napaka: 'oblika' | 'status' } {
  const r = raw as Record<string, unknown> | null
  if (!r || typeof r !== 'object') return { napaka: 'oblika' }
  if (typeof r.id !== 'string' || r.id.length === 0) return { napaka: 'oblika' }
  if (typeof r.datumZacetka !== 'string' || Number.isNaN(new Date(r.datumZacetka).getTime())) {
    return { napaka: 'oblika' }
  }
  if (!jeZnanStatus(r.status)) return { napaka: 'status' }

  const project = (r.project ?? null) as Record<string, unknown> | null
  const projectId = typeof r.projectId === 'string' ? r.projectId : ''
  const monter = (r.monter ?? null) as Record<string, unknown> | null
  const crew = (r.crew ?? null) as Record<string, unknown> | null
  const customer = (project?.customer ?? null) as Record<string, unknown> | null
  const monterId = typeof monter?.id === 'string' ? monter.id : null
  const moja =
    typeof myUserId === 'string' && myUserId.length > 0 && monterId !== null && monterId === myUserId

  // R168 — predvidene ure: samo celo število ≥ 0 je zaupanja vredno. Karkoli
  // drugega (string, decimalno, negativno, manjkajoče) → null (pomožni podatek,
  // ne jedro vrstice — vrstica ostane prikazana, le iz vsote ur je izključena).
  const ure =
    typeof r.predvideneUre === 'number' &&
    Number.isInteger(r.predvideneUre) &&
    r.predvideneUre >= 0
      ? r.predvideneUre
      : null

  return {
    vnos: {
      id: r.id,
      projectId,
      projektIme: typeof project?.nazivProjekta === 'string' ? project.nazivProjekta : null,
      strankaIme: typeof customer?.ime === 'string' ? customer.ime : null,
      strankaNaslov: typeof customer?.naslov === 'string' ? customer.naslov : null,
      lokacija: typeof r.lokacija === 'string' && r.lokacija.trim().length > 0 ? r.lokacija : null,
      ekipaIme: typeof crew?.naziv === 'string' ? crew.naziv : null,
      monterId,
      monterIme: typeof monter?.ime === 'string' ? monter.ime : null,
      status: r.status,
      datumZacetka: r.datumZacetka,
      predvideneUre: ure,
      moja,
    },
  }
}

/** Razdeli surove API vrstice na Danes / Kasneje, NEVELJAVNE pa šteje
 *  (vidno prikazane, ne tiho izgubljene). Sortacija: datumZacetka naraščajoče,
 *  izenačeni čas → id (determinizem). */
export function groupTermini(
  rows: readonly unknown[],
  now: Date,
  myUserId: string | null
): TerminSkupine {
  if (!Array.isArray(rows)) {
    throw new TypeError('groupTermini: pričakovano polje terminov')
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('groupTermini: pričakovan veljaven now: Date')
  }
  const skupine: TerminSkupine = {
    danes: [],
    kasneje: [],
    preskoceniNeveljaven: 0,
    preskoceniNeznanStatus: 0,
  }
  for (const raw of rows) {
    const res = normalizirajTermin(raw, myUserId)
    if ('napaka' in res) {
      if (res.napaka === 'status') skupine.preskoceniNeznanStatus += 1
      else skupine.preskoceniNeveljaven += 1
      continue
    }
    const datum = new Date(res.vnos.datumZacetka)
    if (jeIstiLokalniDan(datum, now)) skupine.danes.push(res.vnos)
    else skupine.kasneje.push(res.vnos)
  }
  const poDatumu = (a: TerminPrikazVnos, b: TerminPrikazVnos) => {
    const diff = new Date(a.datumZacetka).getTime() - new Date(b.datumZacetka).getTime()
    return diff !== 0 ? diff : a.id.localeCompare(b.id)
  }
  skupine.danes.sort(poDatumu)
  skupine.kasneje.sort(poDatumu)
  return skupine
}

/** R167 — filter "samo moje termine": če je vklopljen, ostanejo SAMO vnosi,
 *  katerih monterId je natanko enak prijavljenemu uporabniku. Fail-closed:
 *  vklopljen filter brez znane identitete (myUserId null/prazen) → PRAZEN
 *  seznam (nikoli "vsi" — to bi lažno trdilo, da so vsi termini moji).
 *  Vrne NOVO polje (vnosi ostanejo nespremenjeni — determinizem). */
export function filtrirajTermini(
  vnosi: readonly TerminPrikazVnos[],
  samoMoje: boolean,
  myUserId: string | null
): TerminPrikazVnos[] {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('filtrirajTermini: pričakovano polje prikaznih vrstic')
  }
  if (!samoMoje) return [...vnosi]
  if (typeof myUserId !== 'string' || myUserId.length === 0) return []
  return vnosi.filter((v) => v.monterId !== null && v.monterId === myUserId)
}

/** R168 — vsota predvidenih ur PRIKAZANIH (filtriranih) terminov. Agregat je
 *  bralni izračun nad isto vrstico, ki jo kartica pokaže — "kar vidiš, to se
 *  sešteje". Pravila:
 *   • PREKlicANO → IZKLJUČEN iz vsote (preklicano delo ne porabi ur) in
 *     vidno preštet v preklicanih (nič tihega izginjanja);
 *   • PRELOZENO → ŠTEJE SE (preloženo delo še vedno časa);
 *   • vrstica brez znane ure (predvideneUre null) → ne prispeva h vsoti,
 *     šteje se v brezUre → vsota je samo ŠE VEDNO matematicno resnična
 *     spodnja meja (UI pokaže '≥') — nikoli izmišljenih '0 h';
 *   • čista funkcija: vhod ostane nespremenjen, isti vhod → isti izhod. */
export interface UrAgregat {
  /** Vsota znanih predvidenih ur (ne-preklicanih, z znano uro). */
  ure: number
  /** Št. ne-preklicanih terminov v agregatu (z in brez znane ure). */
  stTerminov: number
  /** Št. ne-preklicanih terminov BREZ znane ure (izključeni iz vsote). */
  brezUre: number
  /** Št. izključenih preklicanih (transparenca, ne tihi popavek). */
  preklicanih: number
}

export function vsotaPredvidenihUr(
  vnosi: readonly TerminPrikazVnos[]
): UrAgregat {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('vsotaPredvidenihUr: pričakovano polje prikaznih vrstic')
  }
  const ag: UrAgregat = { ure: 0, stTerminov: 0, brezUre: 0, preklicanih: 0 }
  for (const v of vnosi) {
    if (
      !v ||
      typeof v !== 'object' ||
      typeof v.id !== 'string' ||
      v.id.length === 0
    ) {
      throw new TypeError('vsotaPredvidenihUr: pričakovan prikazni vnos (TerminPrikazVnos)')
    }
    if (v.status === 'PREKlicANO') {
      ag.preklicanih += 1
      continue
    }
    ag.stTerminov += 1
    if (typeof v.predvideneUre === 'number' && Number.isInteger(v.predvideneUre) && v.predvideneUre >= 0) {
      ag.ure += v.predvideneUre
    } else {
      ag.brezUre += 1
    }
  }
  return ag
}

/** R168 — 'termin' / 'termina' / 'termini' / 'terminov' po slovenskih pravilih
 *  in po obstoječi konvenciji repo (projektiLabel/revizijaLabel): 1 termin;
 *  2 termina (dvojina); 3, 4 termini (množina); 0, 5+ terminov (rodilnik);
 *  izjeme po zadnjih dveh: 11–14 → terminov (11, 12, 113 …), 21 → termin,
 *  22 → termina, 23/24 → termini. */
export function terminBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`terminBeseda: pričakovano ne-negativno celo število, ne ${String(n)}`)
  }
  const enice = n % 10
  const zadnjiDve = n % 100
  if (enice === 1 && zadnjiDve !== 11) return 'termin'
  if (enice === 2 && zadnjiDve !== 12) return 'termina'
  if ((enice === 3 || enice === 4) && zadnjiDve !== 13 && zadnjiDve !== 14) return 'termini'
  return 'terminov'
}

/** R168 — povzetek agregata za kartico; EN VIR RESNICE za besedilo
 *  (ista logika v UI, testih in morebitnem prihodnjem izvozu):
 *   • 'Skupaj 24 h · 3 termini'
 *   • 'Skupaj ≥ 24 h · 3 termini · 1 brez ure' (vsota = spodnja meja)
 *   • 'Skupaj 24 h · 3 termini · brez 2 preklicanih'
 *   • vseh preklicanih, brez veljavnih: 'Samo preklicani termini (2) — brez predvidenih ur'. */
export function terminUrPovzetek(a: UrAgregat): string {
  if (
    !a ||
    typeof a !== 'object' ||
    !Number.isInteger(a.ure) ||
    a.ure < 0 ||
    !Number.isInteger(a.stTerminov) ||
    a.stTerminov < 0 ||
    !Number.isInteger(a.brezUre) ||
    a.brezUre < 0 ||
    !Number.isInteger(a.preklicanih) ||
    a.preklicanih < 0 ||
    a.stTerminov < a.brezUre
  ) {
    throw new TypeError('terminUrPovzetek: pričakovan veljaven UrAgregat')
  }
  if (a.stTerminov === 0 && a.preklicanih > 0) {
    return `Samo preklicani termini (${a.preklicanih}) — brez predvidenih ur`
  }
  const meja = a.brezUre > 0 ? '≥ ' : ''
  let besedilo = `Skupaj ${meja}${a.ure} h · ${a.stTerminov} ${terminBeseda(a.stTerminov)}`
  if (a.brezUre > 0) besedilo += ` · ${a.brezUre} brez ure`
  if (a.preklicanih > 0) {
    besedilo += ` · brez ${a.preklicanih} ${a.preklicanih === 1 ? 'preklicanega' : 'preklicanih'}`
  }
  return besedilo
}

/** R173 — RAZŠIRJEN povzetek: ista EN VIR RESNICE logika kot terminUrPovzetek,
 *  dopolnjena z vidno štetjem preskočenih (pokvarjenih) vnosov — ista oblika
 *  besedila za ZASLON (logistika povzetek vrstica) in IZVOZ (CSV metapodatek
 *  'Povzetek'), tako da je izvoženi povzetek bajtno enak prikazanemu.
 *   • preskoceni = 0 → natanko terminUrPovzetek(a) (nič dodanega)
 *   • preskoceni = 1 → '… · 1 vnos preskočen (neveljaven vnos)'
 *   • preskoceni = 3 → '… · 3 vnosov preskočenih (neveljaven vnos)'
 *  Fail-closed: preskoceni mora biti ne-negativno celo število (TypeError),
 *  agregat gre skozi ISTO strogo validacijo kot terminUrPovzetek. */
export function terminUrPovzetekRazsirjen(a: UrAgregat, preskoceni: number): string {
  if (!Number.isInteger(preskoceni) || preskoceni < 0) {
    throw new TypeError(`terminUrPovzetekRazsirjen: pričakovano ne-negativno celo število preskoceni, ne ${String(preskoceni)}`)
  }
  const osnova = terminUrPovzetek(a)
  if (preskoceni === 0) return osnova
  return `${osnova} · ${preskoceni} ${preskoceni === 1 ? 'vnos preskočen' : 'vnosov preskočenih'} (neveljaven vnos)`
}

/** R167 — deterministično besedilo termina za odložišče (delitev prek
 *  SMS/WhatsApp ali arhiv v zapisniku). EN VIR RESNICE: datum/ura/status so
 *  ISTE funkcije kot na kartici (terminDatumLabel/terminCasLabel/
 *  scheduleTerminiStatusLabel) — deljeno besedilo = prikazano besedilo.
 *  Manjkajoči podatki → vrstica se IZPUSTI (nikoli izmišljenih 'Ni …' nizov
 *  v deljenem besedilu — prejemnik vidi samo resnične podatke). Vrstni red
 *  vrstic je fiksiran = determinizem; ista vhoda (vnos, now) → isti niz. */
export function buildTerminShareText(
  vnos: TerminPrikazVnos,
  now: Date
): string {
  if (!vnos || typeof vnos !== 'object' || typeof vnos.id !== 'string' || vnos.id.length === 0) {
    throw new TypeError(
      'buildTerminShareText: pričakovan prikazni vnos (TerminPrikazVnos)'
    )
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('buildTerminShareText: pričakovan veljaven now: Date')
  }
  // Fail-closed brezplačno: label funkcije vržejo TypeError na neveljaven
  // datum/status — pokvarjen vnos ne more postati zavajajoče besedilo.
  const datum = terminDatumLabel(vnos.datumZacetka, now)
  const ura = terminCasLabel(vnos.datumZacetka)
  const status = scheduleTerminiStatusLabel(vnos.status)

  const vrstice: string[] = []
  vrstice.push(`Termin montaže — ${datum} ob ${ura}`)
  if (vnos.projektIme) vrstice.push(`Projekt: ${vnos.projektIme}`)
  if (vnos.strankaIme) vrstice.push(`Stranka: ${vnos.strankaIme}`)
  if (vnos.strankaNaslov) vrstice.push(`Naslov: ${vnos.strankaNaslov}`)
  if (vnos.lokacija) vrstice.push(`Lokacija: ${vnos.lokacija}`)
  if (vnos.ekipaIme) vrstice.push(`Ekipa: ${vnos.ekipaIme}`)
  if (vnos.monterIme) vrstice.push(`Monter: ${vnos.monterIme}`)
  vrstice.push(`Status: ${status}`)
  return vrstice.join('\n')
}

/** '08:00' — ISTI Intl klic kot nagibi-csv (ura določena z vnosom, ne z now). */
export function terminCasLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`terminCasLabel: neveljaven datum: ${String(iso)}`)
  }
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

/** 'Danes' | 'Jutri' | 'pet, 27. 09.' — lokalni koledar, deterministično
 *  glede na parameter now (nikoli skrite ure). */
export function terminDatumLabel(iso: string, now: Date): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`terminDatumLabel: neveljaven datum: ${String(iso)}`)
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('terminDatumLabel: pričakovan veljaven now: Date')
  }
  if (jeIstiLokalniDan(d, now)) return 'Danes'
  const jutri = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (jeIstiLokalniDan(d, jutri)) return 'Jutri'
  return d.toLocaleDateString('sl-SI', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}
