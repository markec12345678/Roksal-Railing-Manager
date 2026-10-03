/**
 * R402 (issue #13, korak R170 iz §19) — TRANSAKCIJSKA PLAST PLAČIL:
 * Invoice → Payment → Reconciliation.
 * ---------------------------------------------------------------------------
 * Kanon (isti vzorec kot production-store R378 — čisti stroji + debela
 * transakcija):
 *   • zabeležiPlaciloVTx — ENA transakcija: Payment + PaymentAllocation
 *     vrstice + IZPELJAVA statusa dotičnih računov (DELNO_PLACAN/PLACAN iz
 *     vsote KNJIZENO allocacij — strežniško, klient ne more izmisliti
 *     plačila) + AUDIT (PAYMENT_RECORDED + INVOICE_STATUS) — vse ATOMSKO
 *     (ZERO-MUTACIJA ob napaki: validacija Notranjost transakcije vrže →
 *     rollback);
 *   • prekiniPlaciloVTx — storno knjižne napake/dvojnika: plačilo NE
 *     brišemo (pravna sled), status → PREKINJENO z razlogom; dotični
 *     računi se PONOVNO izpeljejo iz OSTANKA KNJIZENO allocacij
 *     (deterministično iz diska: povratniStatusPoPrekinitvi — nikoli iz
 *     pomnilnika prejšnjega stanja);
 *   • uskladiPlacila — samo-bralno poročilo uskladitve: izpeljava vsote,
 *     odprta razlika, neporazdeljeni ostanki plačil, odkrivanje anomalij
 *     (status ≠ izpeljava, placanoAt brez statusa, storno s plačili) —
 *     poroča, NIKOLI tiho popravlja (isti fail-closed kanon kot
 *     object-reconciliation R399).
 *
 * Denarna politika: R380 — vsi zneski skozi zaokroziDenar (2 decimalki);
 * primerjave v centih (invoice-lifecycle.izpeljiPlacilniStatus).
 * Stena ure (R294 F4): `now` je VEDNO argument, nikoli new Date() v jedru.
 */
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { auditInTx } from '@/lib/audit'
import { zaokroziDenar } from '@/lib/decimal-policy'
import type { SessionPayload } from '@/lib/session'
import {
  assertInvoiceTransition,
  assertInvoiceVoidTransition,
  izpeljiPlacilniStatus,
  isInvoiceStatus,
  povratniStatusPoPrekinitvi,
  type InvoiceStatusValue,
} from '@/lib/invoice-lifecycle'

/** Tip plačila — smer/namen nosi tip, znesek je vedno ≥ 0 (shema §19a). */
export const PLACILO_TIPI = ['PLACILO', 'AVANS', 'DOBROPIST', 'POVRACILO'] as const
export type PlaciloTip = (typeof PLACILO_TIPI)[number]

/** Način prejema — BANKA je privzet (bančni promet je glavni vir). */
export const PLACILO_METODE = ['BANKA', 'GOTOVINA', 'KARTICA', 'DRUGO'] as const
export type PlaciloMetoda = (typeof PLACILO_METODE)[number]

/**
 * Napaka plasti plačil — nosi HTTP status (isti kontrakt kot
 * ProductionStoreError R378 / VerzijaNapaka R276). Vržena ZNOTRAJ
 * transakcije → rollback (ZERO-MUTACIJA).
 */
export class PaymentStoreError extends Error {
  readonly status: number
  readonly code: string
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'PaymentStoreError'
    this.code = code
    this.status = status
  }
}

/** Revizijski kontekst (audit v isti transakciji — kanon §22). */
export interface RevizijaKontekst {
  request?: Request
  session?: SessionPayload | null
  userId: string | null
}

/** Ena eksplicitna allocacija plačila na račun. */
export interface AllocacijaVhod {
  invoiceId: string
  znesek: number
}

export interface ZabeleziPlaciloVhod {
  projectId: string
  /** Primarni ciljni račun (NULL za čist avans brez namena). */
  invoiceId?: string | null
  tip: PlaciloTip
  /** Znesek prometa (≥ 0,01; smer nosi tip). */
  znesek: number
  /** Valuta — izključno EUR (finančna domena Roksal d.o.o. je evrska). */
  valuta?: string
  /** Datum plačanja/knjiženja (NI createdAt — vpis lahko sledi kasneje). */
  placanoAt: Date
  referenca?: string | null
  metoda?: PlaciloMetoda
  /** Banka podatki (JSON allowlist — sestavi ga ruta prek zod). */
  bankaPodatki?: string | null
  /**
   * Eksplicitna porazdelitev (delno plačilo / več računov). IZPUŠČENO =
   * ena allocacija na invoiceId za CEL znesek (privzetek 99 % primera).
   */
  allocacije?: readonly AllocacijaVhod[] | null
  revizija: RevizijaKontekst
}

/** Sprememba izpeljanega statusa računa (za odgovor + audit). */
export interface SpremembaStatusa {
  invoiceId: string
  stevilka: string
  from: InvoiceStatusValue
  to: InvoiceStatusValue
}

export type PaymentWithAllocations = Prisma.PaymentGetPayload<{
  include: { allocations: true }
}>

export interface ZabeleziPlaciloIzhod {
  payment: PaymentWithAllocations
  spremembe: readonly SpremembaStatusa[]
}

/** Vsota KNJIZENO allocacij na račun (exkluzivno PREKINJENIH — kanon §19a). */
async function vsotaAllocacij(tx: Prisma.TransactionClient, invoiceId: string): Promise<number> {
  const agregat = await tx.paymentAllocation.aggregate({
    where: { invoiceId, payment: { status: 'KNJIZENO' } },
    _sum: { znesek: true },
  })
  const znesek = agregat._sum.znesek
  return znesek === null ? 0 : Number(znesek)
}

/** Račun, kot ga potrebuje izpeljava (minimalni projekcija — brez postavk). */
interface RacunZaIzpeljavo {
  id: string
  stevilka: string
  projectId: string
  status: string
  znesek: Prisma.Decimal
  placanoAt: Date | null
  poslanoAt: Date | null
  datumIzdaje: Date
  rokPlacilaDni: number
}

async function naloziRacun(tx: Prisma.TransactionClient, invoiceId: string): Promise<RacunZaIzpeljavo | null> {
  return tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      stevilka: true,
      projectId: true,
      status: true,
      znesek: true,
      placanoAt: true,
      poslanoAt: true,
      datumIzdaje: true,
      rokPlacilaDni: true,
    },
  })
}

/**
 * Zabeleži plačilo + porazdelitev + izpeljava statusov — VSE v eni
 * transakciji (klicatelj odpre db.$transaction in rezervira Idempotency-Key
 * KOT PRVI stavek — vzorec measurements R128).
 *
 * Vrata (fail-closed, vsaka vržena napaka = rollback celotne mutacije):
 *   404 neznan projekt / neznan (ciljni ali allociran) račun;
 *   409 allociran račun iz DRUGEGA projekta;
 *   409 plačilo na OSNUTEK/STORNIRAN račun (osnutek ni pravno-aktiven,
 *        storno nosi dobropis — spec §19 credit note pot);
 *   409 NADPLACILO: obstoječa + nova allocacija > znesek računa
 *        (presežek pusti neporazdeljen na plačilu — uskladitev ga poroča);
 *   400 vsota allocacij > znesek plačila / znesek ≤ 0 / valuta ≠ EUR /
 *        podvojen invoiceId v allocacijah / PLACILO brez cilja;
 *   409 stroj zavrne izpeljani prehod (defenzivno — vrata zgoraj ga
 *        normalno ne morejo sprožiti).
 */
export async function zabeleziPlaciloVTx(
  tx: Prisma.TransactionClient,
  vhod: ZabeleziPlaciloVhod,
): Promise<ZabeleziPlaciloIzhod> {
  const znesek = zaokroziDenar(vhod.znesek)
  if (!(znesek > 0)) {
    throw new PaymentStoreError('ZNESEK_NI_PozITIVEN', 'Znesek plačila mora biti vsaj 0,01 EUR', 400)
  }
  const valuta = vhod.valuta ?? 'EUR'
  if (valuta !== 'EUR') {
    throw new PaymentStoreError('VALUTA_NI_EUR', 'Trenutno se beležijo izključno EUR plačila', 400)
  }
  const tip = vhod.tip
  const metoda = vhod.metoda ?? 'BANKA'

  const projekt = await tx.project.findUnique({ where: { id: vhod.projectId }, select: { id: true } })
  if (!projekt) {
    throw new PaymentStoreError('PROJEKT_NE_OBSTAJA', 'Projekt ne obstaja', 404)
  }

  // ── Resolucija allocacij: eksplicitne ALI privzetek (ciljni račun, cel znesek)
  let allocacije: Array<{ invoiceId: string; znesek: number }>
  if (vhod.allocacije && vhod.allocacije.length > 0) {
    allocacije = vhod.allocacije.map((a) => ({ invoiceId: a.invoiceId, znesek: zaokroziDenar(a.znesek) }))
  } else if (vhod.invoiceId) {
    allocacije = [{ invoiceId: vhod.invoiceId, znesek }]
  } else if (tip === 'AVANS') {
    // Čist avans brez namena — plačilo brez allocacij (ostanek poroča uskladitev).
    allocacije = []
  } else {
    throw new PaymentStoreError(
      'BREZ_CILJA',
      `Plačilo tipa ${tip} potrebuje ciljni račun ali eksplicitne allocacije`,
      400,
    )
  }

  for (const a of allocacije) {
    if (!(a.znesek > 0)) {
      throw new PaymentStoreError('ALLOCACIJA_NI_POZITIVNA', 'Vsaka allocacija mora biti vsaj 0,01 EUR', 400)
    }
  }
  const vsotaAlloc = zaokroziDenar(allocacije.reduce((n, a) => n + a.znesek, 0))
  if (vsotaAlloc > znesek) {
    throw new PaymentStoreError(
      'ALLOCACIJE_PRESEGAJO_PLACILO',
      `Vsota allocacij (${vsotaAlloc.toFixed(2)}) presega znesek plačila (${znesek.toFixed(2)}) — ostanek pusti neporazdeljen`,
      400,
    )
  }
  const podvojeni = allocacije.map((a) => a.invoiceId).filter((id, i, vsi) => vsi.indexOf(id) !== i)
  if (podvojeni.length > 0) {
    throw new PaymentStoreError(
      'PODVOJENA_ALLOCACIJA',
      `Račun ${podvojeni[0]} je naveden večkrat v allocacijah`,
      400,
    )
  }

  // ── Ciljni račun (vir namena iz sklica) — ista vrata kot allocirani računi.
  if (vhod.invoiceId && !allocacije.some((a) => a.invoiceId === vhod.invoiceId)) {
    const ciljni = await naloziRacun(tx, vhod.invoiceId)
    if (!ciljni) throw new PaymentStoreError('RACUN_NE_OBSTAJA', 'Ciljni račun ne obstaja', 404)
    if (ciljni.projectId !== vhod.projectId) {
      throw new PaymentStoreError('RACUN_TUJI_PROJEKT', 'Ciljni račun pripada drugemu projektu', 409)
    }
  }

  // ── Vsa vrata allociranih računov + izpeljava novih statusov.
  const racuni = new Map<string, RacunZaIzpeljavo>()
  const izpeljave: Array<{ racun: RacunZaIzpeljavo; zeAllocirano: number; nova: number }> = []
  for (const a of allocacije) {
    if (!racuni.has(a.invoiceId)) {
      const nalozen = await naloziRacun(tx, a.invoiceId)
      if (!nalozen) throw new PaymentStoreError('RACUN_NE_OBSTAJA', `Račun ${a.invoiceId} ne obstaja`, 404)
      if (nalozen.projectId !== vhod.projectId) {
        throw new PaymentStoreError(
          'RACUN_TUJI_PROJEKT',
          `Račun ${nalozen.stevilka} pripada drugemu projektu — allocacija mora ostati znotraj projekta plačila`,
          409,
        )
      }
      if (nalozen.status === 'OSNUTEK' || nalozen.status === 'STORNIRAN') {
        throw new PaymentStoreError(
          'RACUN_NI_PLACLJIV',
          `Račun ${nalozen.stevilka} je v statusu ${nalozen.status} — plačilo se beleži na izdane (ne stornirane) račune`,
          409,
        )
      }
      if (!isInvoiceStatus(nalozen.status)) {
        throw new PaymentStoreError(
          'RACUN_NEZNAN_STATUS',
          `Račun ${nalozen.stevilka} ima neznan status ${nalozen.status}`,
          409,
        )
      }
      racuni.set(a.invoiceId, nalozen)
      const zeAllocirano = await vsotaAllocacij(tx, a.invoiceId)
      izpeljave.push({ racun: nalozen, zeAllocirano, nova: 0 })
    }
    const vnos = izpeljave.find((i) => i.racun.id === a.invoiceId)!
    vnos.nova = zaokroziDenar(vnos.nova + a.znesek)
  }

  const spremembe: SpremembaStatusa[] = []
  for (const i of izpeljave) {
    const skupaj = zaokroziDenar(i.zeAllocirano + i.nova)
    if (skupaj > Number(i.racun.znesek)) {
      throw new PaymentStoreError(
        'NADPLACILO',
        `Allocacija ${i.nova.toFixed(2)} EUR presega odprto razliko računa ${i.racun.stevilka} (odprto: ${zaokroziDenar(Number(i.racun.znesek) - i.zeAllocirano).toFixed(2)}) — presežek pusti neporazdeljen na plačilu`,
        409,
      )
    }
    const izpeljan = izpeljiPlacilniStatus(skupaj, Number(i.racun.znesek))
    if (izpeljan === null) continue // nemogoče (nova > 0) — defenzivno
    const trenutni = i.racun.status as InvoiceStatusValue
    if (izpeljan === trenutni) continue // dodatek k že delno plačanemu — brez spremembe
    assertInvoiceTransition(trenutni, izpeljan) // 409 InvalidInvoiceTransitionError
    spremembe.push({ invoiceId: i.racun.id, stevilka: i.racun.stevilka, from: trenutni, to: izpeljan })
  }

  // ── Zapis: plačilo + allocacije + izpeljani statusi + auditi — VSE ATOMSKO.
  const payment = await tx.payment.create({
    data: {
      projectId: vhod.projectId,
      invoiceId: vhod.invoiceId ?? null,
      tip,
      znesek,
      valuta,
      placanoAt: vhod.placanoAt,
      referenca: vhod.referenca ?? null,
      metoda,
      bankaPodatki: vhod.bankaPodatki ?? null,
      status: 'KNJIZENO',
      createdBy: vhod.revizija.userId,
    },
  })
  if (allocacije.length > 0) {
    await tx.paymentAllocation.createMany({
      data: allocacije.map((a) => ({
        paymentId: payment.id,
        invoiceId: a.invoiceId,
        projectId: vhod.projectId,
        znesek: a.znesek,
      })),
    })
  }
  for (const s of spremembe) {
    await tx.invoice.update({
      where: { id: s.invoiceId },
      data: {
        status: s.to,
        ...(s.to === 'PLACAN' ? { placanoAt: vhod.placanoAt } : {}),
        ...(s.from === 'PLACAN' && s.to !== 'PLACAN' ? { placanoAt: null } : {}),
      },
    })
    await auditInTx(tx, {
      request: vhod.revizija.request,
      session: vhod.revizija.session,
      userId: vhod.revizija.userId,
      projectId: vhod.projectId,
      akcija: 'INVOICE_STATUS',
      oldValue: s.from,
      newValue: s.to,
    })
  }
  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.revizija.userId,
    projectId: vhod.projectId,
    akcija: 'PAYMENT_RECORDED',
    newValue: {
      paymentId: payment.id,
      tip,
      znesek,
      metoda,
      placanoAt: vhod.placanoAt.toISOString(),
      allocacije: allocacije.map((a) => ({ invoiceId: a.invoiceId, znesek: a.znesek })),
      ...(vhod.invoiceId ? { ciljniRacun: vhod.invoiceId } : {}),
    },
  })

  return {
    payment: await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { allocations: true },
    }),
    spremembe,
  }
}

export interface PrekiniPlaciloVhod {
  paymentId: string
  /** Obvezen razlog (knjižna napaka / dvojnik / povratilo). */
  razlog: string
  now: Date
  revizija: RevizijaKontekst
}

export interface PrekiniPlaciloIzhod {
  payment: PaymentWithAllocations
  spremembe: readonly SpremembaStatusa[]
}

/**
 * Prekini (storniraj vnos) plačila — knjižna napaka/dvojnik/povratilo.
 * Plačilo NE brisemo (pravna sled §19a): status → PREKINJENO z razlogom,
 * allocacije ostanejo vidne, a se NE štejejo v izpeljavo.
 * Dotični računi se PONOVNO izpeljejo iz ostanka KNJIZENO allocacij —
 * deterministično iz diska (povratniStatusPoPrekinitvi), nikoli iz
 * pomnilnika prejšnjega stanja.
 */
export async function prekiniPlaciloVTx(
  tx: Prisma.TransactionClient,
  vhod: PrekiniPlaciloVhod,
): Promise<PrekiniPlaciloIzhod> {
  const razlog = vhod.razlog.trim()
  if (razlog.length < 3) {
    throw new PaymentStoreError('RAZLOG_MANJKA', 'Razlog prekinitve je obvezen (vsaj 3 znaki)', 400)
  }
  const placilo = await tx.payment.findUnique({
    where: { id: vhod.paymentId },
    include: { allocations: true },
  })
  if (!placilo) {
    throw new PaymentStoreError('PLACILO_NE_OBSTAJA', 'Plačilo ne obstaja', 404)
  }
  if (placilo.status !== 'KNJIZENO') {
    throw new PaymentStoreError(
      'PLACILO_ZE_PREKINJENO',
      'Plačilo je že prekinjeno — ponovna prekinitev ni možna',
      409,
    )
  }

  await tx.payment.update({
    where: { id: placilo.id },
    data: { status: 'PREKINJENO', prekinitevRazlog: razlog, prekinjenoAt: vhod.now },
  })

  // Ostarek KNJIZENO allocacij po prekinitvi (vrstica je ŽE PREKINJENA v tej
  // tx — aggregate jo izključi naravno prek payment.status filtra).
  const spremembe: SpremembaStatusa[] = []
  const doticniRacuni = [...new Set(placilo.allocations.map((a) => a.invoiceId))]
  for (const invoiceId of doticniRacuni) {
    const racun = await naloziRacun(tx, invoiceId)
    if (!racun) continue // izgubljen račun (RESTRICT ga varuje — defenzivno)
    const trenutni = racun.status
    if (!isInvoiceStatus(trenutni)) continue
    const ostanek = await vsotaAllocacij(tx, invoiceId)
    const izpeljan = izpeljiPlacilniStatus(ostanek, Number(racun.znesek))
    const cilj: InvoiceStatusValue = izpeljan ?? povratniStatusPoPrekinitvi(racun, vhod.now)
    if (cilj === trenutni) continue
    assertInvoiceVoidTransition(trenutni, cilj) // 409 — samo deterministični povratki
    spremembe.push({ invoiceId, stevilka: racun.stevilka, from: trenutni as InvoiceStatusValue, to: cilj })
  }

  for (const s of spremembe) {
    await tx.invoice.update({
      where: { id: s.invoiceId },
      data: {
        status: s.to,
        ...(s.from === 'PLACAN' && s.to !== 'PLACAN' ? { placanoAt: null } : {}),
      },
    })
    await auditInTx(tx, {
      request: vhod.revizija.request,
      session: vhod.revizija.session,
      userId: vhod.revizija.userId,
      projectId: placilo.projectId,
      akcija: 'INVOICE_STATUS',
      oldValue: s.from,
      newValue: s.to,
    })
  }

  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.revizija.userId,
    projectId: placilo.projectId,
    akcija: 'PAYMENT_VOIDED',
    oldValue: { paymentId: placilo.id, znesek: Number(placilo.znesek), tip: placilo.tip },
    newValue: { razlog, spremembe: spremembe.map((s) => ({ stevilka: s.stevilka, from: s.from, to: s.to })) },
  })

  return {
    payment: await tx.payment.findUniqueOrThrow({
      where: { id: placilo.id },
      include: { allocations: true },
    }),
    spremembe,
  }
}

// ── USKLAJEVANJE (samo-bralno — poroča, nikoli ne popravlja) ───────────────

/** Vrsta anomalije uskladitve (koda za poročilo/UI). */
export type UskladitevAnomalijaKoda =
  | 'STATUS_PREPLACAN' // status PLACAN, a vsota allocacij < znesek
  | 'STATUS_NIZJI' // status predplačilen, a vsota ≥ znesek (mora biti PLACAN)
  | 'STATUS_VISJI' // status DELNO_PLACAN, a vsota ≤ 0 ali ≥ znesek
  | 'PLACANOAT_BREZ_STATUSA' // placanoAt nastavljen, status ≠ PLACAN (legacy)
  | 'PLACAN_BREZ_DATUMA' // status PLACAN, placanoAt NULL
  | 'NEPORAZDELEJEN_OSTANEK' // KNJIZENO plačilo z neporazdeljenim ostankom (info)
  | 'STORNO_S_PLACILOM' // STORNIRAN račun s KNJIZENO allocacijo (info — dobropis)

export interface UskladitevAnomalija {
  koda: UskladitevAnomalijaKoda
  invoiceId?: string
  stevilka?: string
  paymentId?: string
  /** Človeku berljiv opis (poročilo). */
  opis: string
}

export interface UskladitevRačun {
  invoiceId: string
  stevilka: string
  tip: string
  status: string
  znesek: number
  /** Vsota KNJIZENO allocacij (vir resnice o plačilu — §19a). */
  placiloZnesek: number
  /** Znesek − placiloZnesek (odprta razlika). */
  odprto: number
  /** Ali je rok plačila (datumIzdaje + rokPlacilaDni) že pretekel. */
  zapadlo: boolean
}

export interface UskladitevPlacilo {
  paymentId: string
  tip: string
  status: string
  znesek: number
  placanoAt: string
  metoda: string
  /** Vsota allocacij TEGA plačila. */
  porazdeljeno: number
  /** Neporazdeljeni ostanek (znesek − porazdeljeno) — pri KNJIZENO je info. */
  ostanek: number
  prekinitevRazlog: string | null
}

export interface UskladitevPovzetek {
  racunov: number
  placil: number
  placilPrekinjenih: number
  anomalij: number
  /** Skupaj KNJIZENO porazdeljeno na račune projekta. */
  skupajPlacilo: number
  /** Vsota odprtih razlik nezaključenih računov. */
  skupajOdprto: number
}

export interface UskladitevPoročilo {
  projectId: string
  generatedAt: string
  racuni: readonly UskladitevRačun[]
  placila: readonly UskladitevPlacilo[]
  anomalije: readonly UskladitevAnomalija[]
  povzetek: UskladitevPovzetek
}

/**
 * Poročilo uskladitve plačil projekta — čisto branje, izpeljava strežniška.
 * `now` je argument (R294 F4). Poroča NEUSKLAJENOSTI, ne popravlja jih
 * (eksplicitna pot = prekinitev/novo plačilo — vse auditarano).
 */
export async function uskladiPlacila(projectId: string, now: Date = new Date()): Promise<UskladitevPoročilo> {
  const racuniVrstice = await db.invoice.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      stevilka: true,
      tip: true,
      status: true,
      znesek: true,
      placanoAt: true,
      datumIzdaje: true,
      rokPlacilaDni: true,
      allocations: { where: { payment: { status: 'KNJIZENO' } }, select: { znesek: true } },
    },
  })
  const placilaVrstice = await db.payment.findMany({
    where: { projectId },
    orderBy: { placanoAt: 'desc' },
    include: { allocations: { select: { znesek: true } } },
  })

  const anomalije: UskladitevAnomalija[] = []
  const racuni: UskladitevRačun[] = racuniVrstice.map((r) => {
    const znesek = Number(r.znesek)
    const placiloZnesek = zaokroziDenar(r.allocations.reduce((n, a) => n + Number(a.znesek), 0))
    const odprto = zaokroziDenar(znesek - placiloZnesek)
    const rok = new Date(r.datumIzdaje)
    rok.setDate(rok.getDate() + r.rokPlacilaDni)
    const zapadlo = rok.getTime() < now.getTime() && placiloZnesek < znesek

    if (r.status === 'PLACAN' && placiloZnesek < znesek) {
      anomalije.push({
        koda: 'STATUS_PREPLACAN',
        invoiceId: r.id,
        stevilka: r.stevilka,
        opis: `Račun ${r.stevilka} ima status PLACAN, a je plačano le ${placiloZnesek.toFixed(2)} od ${znesek.toFixed(2)} EUR`,
      })
    }
    if (
      ['IZDAN', 'POSLAN', 'ZAPADLO', 'OPOZORILO', 'IZTERJAVA'].includes(r.status) &&
      placiloZnesek >= znesek &&
      znesek > 0
    ) {
      anomalije.push({
        koda: 'STATUS_NIZJI',
        invoiceId: r.id,
        stevilka: r.stevilka,
        opis: `Račun ${r.stevilka} ima status ${r.status}, a je plačeno ${placiloZnesek.toFixed(2)} od ${znesek.toFixed(2)} EUR (mora biti PLACAN)`,
      })
    }
    if (r.status === 'DELNO_PLACAN' && (placiloZnesek <= 0 || placiloZnesek >= znesek)) {
      anomalije.push({
        koda: 'STATUS_VISJI',
        invoiceId: r.id,
        stevilka: r.stevilka,
        opis: `Račun ${r.stevilka} ima status DELNO_PLACAN, a je plačeno ${placiloZnesek.toFixed(2)} od ${znesek.toFixed(2)} EUR`,
      })
    }
    if (r.placanoAt && r.status !== 'PLACAN') {
      anomalije.push({
        koda: 'PLACANOAT_BREZ_STATUSA',
        invoiceId: r.id,
        stevilka: r.stevilka,
        opis: `Račun ${r.stevilka} ima placanoAt, status pa je ${r.status} (legacy neskladje)`,
      })
    }
    if (r.status === 'PLACAN' && !r.placanoAt) {
      anomalije.push({
        koda: 'PLACAN_BREZ_DATUMA',
        invoiceId: r.id,
        stevilka: r.stevilka,
        opis: `Račun ${r.stevilka} ima status PLACAN brez datuma plačila`,
      })
    }
    if (r.status === 'STORNIRAN' && placiloZnesek > 0) {
      anomalije.push({
        koda: 'STORNO_S_PLACILOM',
        invoiceId: r.id,
        stevilka: r.stevilka,
        opis: `Storniran račun ${r.stevilka} ima ${placiloZnesek.toFixed(2)} EUR KNJIZENO plačil — razreši prek dobropisa`,
      })
    }
    return { invoiceId: r.id, stevilka: r.stevilka, tip: r.tip, status: r.status, znesek, placiloZnesek, odprto, zapadlo }
  })

  const placila: UskladitevPlacilo[] = placilaVrstice.map((p) => {
    const znesek = Number(p.znesek)
    const porazdeljeno = zaokroziDenar(p.allocations.reduce((n, a) => n + Number(a.znesek), 0))
    const ostanek = zaokroziDenar(znesek - porazdeljeno)
    if (p.status === 'KNJIZENO' && ostanek > 0) {
      anomalije.push({
        koda: 'NEPORAZDELEJEN_OSTANEK',
        paymentId: p.id,
        opis: `KNJIZENO plačilo ${znesek.toFixed(2)} EUR ima neporazdeljeni ostanek ${ostanek.toFixed(2)} EUR${p.invoiceId ? ' (preveč plačano za ciljni račun)' : ' (avans brez namena)'}`,
      })
    }
    return {
      paymentId: p.id,
      tip: p.tip,
      status: p.status,
      znesek,
      placanoAt: p.placanoAt.toISOString(),
      metoda: p.metoda,
      porazdeljeno,
      ostanek,
      prekinitevRazlog: p.prekinitevRazlog,
    }
  })

  const aktivna = racuni.filter((r) => r.status !== 'STORNIRAN')
  return {
    projectId,
    generatedAt: now.toISOString(),
    racuni,
    placila,
    anomalije,
    povzetek: {
      racunov: racuni.length,
      placil: placila.length,
      placilPrekinjenih: placila.filter((p) => p.status === 'PREKINJENO').length,
      anomalij: anomalije.length,
      skupajPlacilo: zaokroziDenar(aktivna.reduce((n, r) => n + r.placiloZnesek, 0)),
      skupajOdprto: zaokroziDenar(aktivna.reduce((n, r) => n + Math.max(r.odprto, 0), 0)),
    },
  }
}
