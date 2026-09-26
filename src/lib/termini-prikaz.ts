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
