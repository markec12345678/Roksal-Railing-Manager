/**
 * R382 (issue #13, korak R169 iz §13) — strežniška (transakcijska) plast
 * CRM lijakov: Lead + Opportunity + ločeni naslovi stranke.
 * ---------------------------------------------------------------------------
 * Problem, ki ga ta plast zapira (issue #13 §13): nad Customer ni bilo
 * SLEADA (kje povpraševanje začne), ne PRiložnosti (prodajna cev z razlogom
 * izgube), ne ločenih naslovov. Rute NE smejo pisati direktno v te tabele —
 * vsa ustvarjanja/prehodi/naslovi živijo SAMO tu.
 *
 * Načela (delovni kanon repozitorija, enako kot production-store R378):
 *   • EN VIR RESNICE — vsa ustvarjanja/prehodi/naslovi živijo SAMO tu (rute
 *     kličejo TE funkcije znotraj SVOJIH transakcij; revizija je ATOMSKA
 *     z dogodkom — auditInTx znotraj iste transakcije);
 *   • fail-closed — neznan vir/tip/stage → JAVNA napaka 400; prehod POZUNAR
 *     matrike → 409 z izpisom dovoljenih; LOST brez razloga → 400 (odmik
 *     brez razloga je tiha mutacija zgodovine); ACCEPTED brez stranke → 409;
 *   • HONEST NULL (§8) — ocena/verjetnost/naslednja akcija NULL, ko neznane;
 *     verjetnost je §13 IZRECNO "CRM polje brez poslovne logike" (int 0–100
 *     mnenje — NIKOLI vhod v izračun; denar/odstotki so domena
 *     decimal-policy R380);
 *   • denarna domena R380: ocenjenaVrednost ≤ 2 decimalki (DENAR_DECIMALKE),
 *     več → 400 GLASNO (ne tiho zaokroževanje);
 *   • terminalna stanja (PRETVORJEN/ZAVRNJEN slead; ACCEPTED/LOST priložnost)
 *     se NE urejajo (409) — zamrznjena zgodovina, kanon R378;
 *   • LEGACY SINHRON naslovov: Customer.naslov (flat, NOT NULL od init —
 *     mobilni klienti/PDF ga berejo, kanon §1 NE rušimo) se posodobi V ISTI
 *     transakciji, kadarkoli se spremeni PRIVZETI KONTAKTNI naslov. Brez
 *     privzetega KONTAKTNI ostane zadnja znana vrednost (dokumentirana
 *     prikazna meja, NE tiha dvojna resnica);
 *   • R294 F4 — stena ure živi v RUTI: `now` je obvezen argument.
 *
 * Plast je STREŽNIŠKA (uvozi db); čisto jedro (matrike + validacije) živi
 * v src/lib/crm-pipeline.ts.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type { SessionPayload } from './session'
import { auditInTx } from './audit'
import { DENAR_DECIMALKE, zaokroziDenar } from './decimal-policy'
import {
  LEAD_ENQUIRY_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  OPPORTUNITY_STAGES,
  checkLeadTransition,
  checkOpportunityStageTransition,
  requiresLossReason,
  requiresProjectConversion,
  validateCustomerAddressType,
  validateVerjetnost,
} from './crm-pipeline'

/** Napaka plasti — sporočilo je JAVNO (slovensko), status določi ruta. */
export class CrmStoreError extends Error {
  /** Predlagani HTTP status (400 validacija; 404 manjka vir; 409 poslovno stanje). */
  readonly suggestedStatus: 400 | 404 | 409
  constructor(message: string, suggestedStatus: 400 | 404 | 409) {
    super(message)
    this.name = 'CrmStoreError'
    this.suggestedStatus = suggestedStatus
  }
}

/** Revizijski kontekst — audit je OBVEZEN del vsake mutacije te plasti (§19). */
export interface RevizijskiKontekst {
  request: Request
  session: SessionPayload | null
  /** Profile.id akterja (ali null za servisni ključ). */
  userId: string | null
}

/**
 * Sestavi revizijski kontekst iz zahteve + seje (rute kličejo to po
 * authenticate — session je null za servisne ključe, userId iz sub).
 */
export function revizijskiKontekst(
  request: Request,
  session: SessionPayload | null,
): RevizijskiKontekst {
  return { request, session, userId: session?.sub ?? null }
}

// ── Denarna validacija ocenjene vrednosti (domena R380 — en vir meje) ───────

/**
 * Fail-closed validacija ocene vrednosti: končno število ≥ 0 z največ
 * DENAR_DECIMALKE decimalkami (preverjeno prek EKSAKTNE zaokrožitve
 * decimal-policy R380 — String(v) reprezentacija, ne dvojični rep).
 * Več decimalk → JAVNA napaka (NE tiho zaokroževanje — 12,345 € ocene bi
 * tiho postalo 12,35 in to JE laž).
 */
export function validirajOcenjenoVrednost(
  v: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, value: null }
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    return { ok: false, error: 'ocenjenaVrednost mora biti končno število ali null' }
  }
  if (v < 0) {
    return { ok: false, error: 'ocenjenaVrednost ne more biti negativna' }
  }
  if (zaokroziDenar(v) !== v) {
    return {
      ok: false,
      error: `ocenjenaVrednost sme imeti največ ${DENAR_DECIMALKE} decimalki (dobili smo ${v})`,
    }
  }
  return { ok: true, value: v }
}

// ── Ustvarjanje SLEADA (§13 Lead) ───────────────────────────────────────────

export interface UstvariLeadVhod {
  source?: string
  ime: string
  telefon?: string | null
  email?: string | null
  tipPovprasevanja?: string
  ownerId?: string | null
  nextActionAt?: Date | null
  opombe?: string | null
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

export interface UstvariLeadIzhod {
  leadId: string
  status: string
  source: string
  tipPovprasevanja: string
}

/**
 * Ustvari slead ZNOTRAJ podane transakcije:
 *   1. validacija: vir/tip iz kanonskih naborov (fail-closed 400, NE tiha
 *      normalizacija); lastnik (če podan) OBSTOJA (404 — tuj ID je napaka,
 *      ne tiha null);
 *   2. status NOV (zacetek lijaka — matrico prehodov nato pelje
 *      prehodLeadaVTx);
 *   3. revizijski vpis LEAD_CREATED atomsko z vrstico.
 */
export async function ustvariLeadVTx(
  tx: Prisma.TransactionClient,
  vhod: UstvariLeadVhod,
): Promise<UstvariLeadIzhod> {
  const source = vhod.source ?? 'DRUGO'
  if (!(LEAD_SOURCES as readonly string[]).includes(source)) {
    throw new CrmStoreError(
      `Neveljaven vir sleada '${source}' (dovoljeni: ${LEAD_SOURCES.join(', ')}).`,
      400,
    )
  }
  const tipPovprasevanja = vhod.tipPovprasevanja ?? 'DRUGO'
  if (!(LEAD_ENQUIRY_TYPES as readonly string[]).includes(tipPovprasevanja)) {
    throw new CrmStoreError(
      `Neveljaven tip povpraševanja '${tipPovprasevanja}' (dovoljeni: ${LEAD_ENQUIRY_TYPES.join(', ')}).`,
      400,
    )
  }

  if (vhod.ownerId) {
    const lastnik = await tx.profile.findUnique({
      where: { id: vhod.ownerId },
      select: { id: true },
    })
    if (!lastnik) {
      throw new CrmStoreError('Lastnik sleada (owner) ne obstaja.', 404)
    }
  }

  const ime = vhod.ime.trim()
  if (ime.length < 2) {
    throw new CrmStoreError('Ime stika sleada je obvezno (min 2 znaka).', 400)
  }

  const lead = await tx.lead.create({
    data: {
      source,
      ime,
      telefon: vhod.telefon?.trim() || null,
      email: vhod.email?.trim() || null,
      tipPovprasevanja,
      status: 'NOV',
      ownerId: vhod.ownerId ?? null,
      nextActionAt: vhod.nextActionAt ?? null,
      opombe: vhod.opombe?.trim() || null,
    },
    select: { id: true, status: true, source: true, tipPovprasevanja: true },
  })

  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.actorId,
    akcija: 'LEAD_CREATED',
    newValue: {
      leadId: lead.id,
      source: lead.source,
      ime,
      tipPovprasevanja: lead.tipPovprasevanja,
      ownerId: vhod.ownerId ?? null,
    },
  })

  return { leadId: lead.id, status: lead.status, source: lead.source, tipPovprasevanja: lead.tipPovprasevanja }
}

// ── Posodobitev SLEADA (samo NETERMINALNA stanja) ───────────────────────────

export interface PosodobiLeadVhod {
  leadId: string
  source?: string
  ime?: string
  telefon?: string | null
  email?: string | null
  tipPovprasevanja?: string
  ownerId?: string | null
  nextActionAt?: Date | null
  opombe?: string | null
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

/**
 * Posodobi kontaktne/administrativne podatke sleada — SAMO v NETERMINALNEM
 * stanju (NOV | KONTAKTIRAN). PRETVORJEN/ZAVRNJEN sta ZAMRZNJENA zgodovina
 * (409): kontakt, ki je pripeljal do posla/odbitve, se ne retroaktivno
 * prelepi (revizijska sled bi lagala o tem, KAJ je bilo takrat).
 * Validacije identične ustvarjanju (EN VIR pravil — isti nabori, isti stroji).
 */
export async function posodobiLeadVTx(
  tx: Prisma.TransactionClient,
  vhod: PosodobiLeadVhod,
): Promise<{ leadId: string; status: string }> {
  const pred = await tx.lead.findUnique({
    where: { id: vhod.leadId },
    select: {
      id: true,
      status: true,
      source: true,
      tipPovprasevanja: true,
      ime: true,
      telefon: true,
      email: true,
      ownerId: true,
      nextActionAt: true,
      opombe: true,
    },
  })
  if (!pred) throw new CrmStoreError('Slead ne obstaja.', 404)
  if (pred.status === 'PRETVORJEN' || pred.status === 'ZAVRNJEN') {
    throw new CrmStoreError(
      `Slead je ${pred.status} — kontaktne podatke zamrznjene zgodovine ni mogoče urejati (kanon terminalnosti R378).`,
      409,
    )
  }

  if (vhod.source !== undefined && !(LEAD_SOURCES as readonly string[]).includes(vhod.source)) {
    throw new CrmStoreError(
      `Neveljaven vir sleada '${vhod.source}' (dovoljeni: ${LEAD_SOURCES.join(', ')}).`,
      400,
    )
  }
  if (
    vhod.tipPovprasevanja !== undefined &&
    !(LEAD_ENQUIRY_TYPES as readonly string[]).includes(vhod.tipPovprasevanja)
  ) {
    throw new CrmStoreError(
      `Neveljaven tip povpraševanja '${vhod.tipPovprasevanja}' (dovoljeni: ${LEAD_ENQUIRY_TYPES.join(', ')}).`,
      400,
    )
  }
  if (vhod.ime !== undefined && vhod.ime.trim().length < 2) {
    throw new CrmStoreError('Ime stika sleada je obvezno (min 2 znaka).', 400)
  }
  if (vhod.ownerId) {
    const lastnik = await tx.profile.findUnique({ where: { id: vhod.ownerId }, select: { id: true } })
    if (!lastnik) throw new CrmStoreError('Lastnik sleada (owner) ne obstaja.', 404)
  }

  const lead = await tx.lead.update({
    where: { id: vhod.leadId },
    data: {
      ...(vhod.source !== undefined ? { source: vhod.source } : {}),
      ...(vhod.ime !== undefined ? { ime: vhod.ime.trim() } : {}),
      ...(vhod.telefon !== undefined ? { telefon: vhod.telefon?.trim() || null } : {}),
      ...(vhod.email !== undefined ? { email: vhod.email?.trim() || null } : {}),
      ...(vhod.tipPovprasevanja !== undefined ? { tipPovprasevanja: vhod.tipPovprasevanja } : {}),
      ...(vhod.ownerId !== undefined ? { ownerId: vhod.ownerId ?? null } : {}),
      ...(vhod.nextActionAt !== undefined ? { nextActionAt: vhod.nextActionAt ?? null } : {}),
      ...(vhod.opombe !== undefined ? { opombe: vhod.opombe?.trim() || null } : {}),
    },
    select: { id: true, status: true },
  })

  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.actorId,
    akcija: 'LEAD_UPDATED',
    oldValue: pred,
    newValue: { leadId: lead.id, spremembe: vhod },
  })

  return { leadId: lead.id, status: lead.status }
}

// ── Prehod statusa SLEADA (matrika crm-pipeline EN VIR) ─────────────────────

export interface PretvorbaPayload {
  /** Naziv poslovne priložnosti, ki iz sleada nastane (obvezen). */
  naziv: string
  /** Stranka, če že obstaja (repeat posel); NULL = še brez stranke. */
  customerId?: string | null
  opis?: string | null
  ocenjenaVrednost?: number | null
  verjetnost?: number | null
}

export interface PrehodLeadaVhod {
  leadId: string
  to: string
  /** Samo za to = PRETVORJEN (transakcijska pretvorba v Opportunity). */
  pretvorba?: PretvorbaPayload
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

export interface PrehodLeadaIzhod {
  leadId: string
  status: string
  /** Nastane pri PRETVORJEN — id nove priložnosti (ista transakcija). */
  opportunityId: string | null
}

/**
 * Prehod statusa sleada PO MATRIKI (crm-pipeline). PRETVORJEN je TRANSAKCIJSKA
 * pretvorba: v ISTI transakciji nastane Opportunity (stage NEW — napredek
 * POSLA se začne na začetku; kontakt se je zgodil na nivoju SLEADA in je že
 * zabeležen tam, dediti stage-a bi bilo izumljanje) + reviziji LEAD_CONVERTED
 * in OPPORTUNITY_CREATED. Stranko (če je še ni) ustvariš PREK obstoječe
 * kanonične poti POST /api/customers — ta plast NE podvaja ustvarjanja strank.
 */
export async function prehodLeadaVTx(
  tx: Prisma.TransactionClient,
  vhod: PrehodLeadaVhod,
): Promise<PrehodLeadaIzhod> {
  const lead = await tx.lead.findUnique({
    where: { id: vhod.leadId },
    select: { id: true, status: true, ime: true },
  })
  if (!lead) throw new CrmStoreError('Slead ne obstaja.', 404)

  if (!(LEAD_STATUSES as readonly string[]).includes(vhod.to)) {
    throw new CrmStoreError(
      `Neznan ciljni status sleada '${vhod.to}' (nabor: ${LEAD_STATUSES.join(', ')}).`,
      400,
    )
  }

  const preverba = checkLeadTransition(lead.status, vhod.to)
  if (!preverba.ok) {
    throw new CrmStoreError(
      `Prehod ${lead.status} → ${vhod.to} ni dovoljen (dovoljeni iz ${lead.status}: ${preverba.allowed.join(', ') || '— terminalen'}).`,
      409,
    )
  }

  let opportunityId: string | null = null

  if (vhod.to === 'PRETVORJEN') {
    const p = vhod.pretvorba
    if (!p || typeof p.naziv !== 'string' || p.naziv.trim().length < 3) {
      throw new CrmStoreError(
        'Pretvorba sleada zahteva naziv poslovne priložnosti (min 3 znaki) — payload { naziv, customerId?, ... }.',
        400,
      )
    }
    const vrednost = validirajOcenjenoVrednost(p.ocenjenaVrednost)
    if (!vrednost.ok) throw new CrmStoreError(vrednost.error, 400)
    const verjetnost = validateVerjetnost(p.verjetnost)
    if (!verjetnost.ok) throw new CrmStoreError(verjetnost.error, 400)

    if (p.customerId) {
      const stranka = await tx.customer.findUnique({
        where: { id: p.customerId },
        select: { id: true },
      })
      if (!stranka) throw new CrmStoreError('Stranka za pretvorbo ne obstaja.', 404)
    }

    const opp = await tx.opportunity.create({
      data: {
        leadId: lead.id,
        customerId: p.customerId ?? null,
        naziv: p.naziv.trim(),
        opis: p.opis?.trim() || null,
        ocenjenaVrednost: vrednost.value,
        stage: 'NEW',
        verjetnost: verjetnost.value,
      },
      select: { id: true },
    })
    opportunityId = opp.id

    await auditInTx(tx, {
      request: vhod.revizija.request,
      session: vhod.revizija.session,
      userId: vhod.actorId,
      akcija: 'OPPORTUNITY_CREATED',
      newValue: {
        opportunityId: opp.id,
        leadId: lead.id,
        naziv: p.naziv.trim(),
        customerId: p.customerId ?? null,
        ocenjenaVrednost: vrednost.value,
        vir: 'pretvorba sleada',
      },
    })
  }

  const posodobljen = await tx.lead.update({
    where: { id: vhod.leadId },
    data: { status: vhod.to },
    select: { id: true, status: true },
  })

  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.actorId,
    akcija: vhod.to === 'PRETVORJEN' ? 'LEAD_CONVERTED' : 'LEAD_STATUS',
    oldValue: { leadId: lead.id, status: lead.status },
    newValue: { leadId: posodobljen.id, status: posodobljen.status, opportunityId },
  })

  return { leadId: posodobljen.id, status: posodobljen.status, opportunityId }
}

// ── Ustvarjanje PRiložnosti (§13 Opportunity) ───────────────────────────────

export interface UstvariOpportunityVhod {
  leadId?: string | null
  customerId?: string | null
  naziv: string
  opis?: string | null
  ocenjenaVrednost?: number | null
  verjetnost?: number | null
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

export interface UstvariOpportunityIzhod {
  opportunityId: string
  stage: string
}

/**
 * Ustvari poslovno priložnost (direktna — leadId NI obvezen: repeat posel
 * obstoječe stranke vstopa tukaj). Stage NEW; ocena/verjetnost honest NULL.
 */
export async function ustvariOpportunityVTx(
  tx: Prisma.TransactionClient,
  vhod: UstvariOpportunityVhod,
): Promise<UstvariOpportunityIzhod> {
  const naziv = vhod.naziv.trim()
  if (naziv.length < 3) {
    throw new CrmStoreError('Naziv priložnosti je obvezen (min 3 znaki).', 400)
  }
  const vrednost = validirajOcenjenoVrednost(vhod.ocenjenaVrednost)
  if (!vrednost.ok) throw new CrmStoreError(vrednost.error, 400)
  const verjetnost = validateVerjetnost(vhod.verjetnost)
  if (!verjetnost.ok) throw new CrmStoreError(verjetnost.error, 400)

  if (vhod.leadId) {
    const lead = await tx.lead.findUnique({ where: { id: vhod.leadId }, select: { id: true, status: true } })
    if (!lead) throw new CrmStoreError('Slead ne obstaja.', 404)
    if (lead.status === 'PRETVORJEN') {
      throw new CrmStoreError(
        'Slead je že PRETVORJEN — nova priložnost istega stika je NOV slead ali direktna priložnost brez sleada.',
        409,
      )
    }
  }
  if (vhod.customerId) {
    const stranka = await tx.customer.findUnique({ where: { id: vhod.customerId }, select: { id: true } })
    if (!stranka) throw new CrmStoreError('Stranka ne obstaja.', 404)
  }

  const opp = await tx.opportunity.create({
    data: {
      leadId: vhod.leadId ?? null,
      customerId: vhod.customerId ?? null,
      naziv,
      opis: vhod.opis?.trim() || null,
      ocenjenaVrednost: vrednost.value,
      stage: 'NEW',
      verjetnost: verjetnost.value,
    },
    select: { id: true, stage: true },
  })

  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.actorId,
    akcija: 'OPPORTUNITY_CREATED',
    newValue: {
      opportunityId: opp.id,
      naziv,
      leadId: vhod.leadId ?? null,
      customerId: vhod.customerId ?? null,
      ocenjenaVrednost: vrednost.value,
      vir: 'direkten vnos',
    },
  })

  return { opportunityId: opp.id, stage: opp.stage }
}

// ── Posodobitev PRiložnosti (samo NETERMINALNA stanja) ──────────────────────

export interface PosodobiOpportunityVhod {
  opportunityId: string
  naziv?: string
  opis?: string | null
  ocenjenaVrednost?: number | null
  verjetnost?: number | null
  customerId?: string | null
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

/**
 * Posodobi CRM podatke priložnosti — SAMO v živih stage-ih (NEW … FOLLOW_UP).
 * ACCEPTED/LOST sta terminalna (409): ocena, ki je pripeljala do posla, in
 * razlog, ki je posel ubil, sta ZGODOVINA (prepis bi lagal o odločitvi,
 * ki je bila takrat sprejeta). Verjetnost je §13 "CRM polje brez poslovne
 * logike" — tu se sme popravljati (mnenje), nikjer se ne računa z njo.
 */
export async function posodobiOpportunityVTx(
  tx: Prisma.TransactionClient,
  vhod: PosodobiOpportunityVhod,
): Promise<{ opportunityId: string; stage: string }> {
  const pred = await tx.opportunity.findUnique({
    where: { id: vhod.opportunityId },
    select: {
      id: true,
      stage: true,
      naziv: true,
      opis: true,
      ocenjenaVrednost: true,
      verjetnost: true,
      customerId: true,
    },
  })
  if (!pred) throw new CrmStoreError('Priložnost ne obstaja.', 404)
  if (pred.stage === 'ACCEPTED' || pred.stage === 'LOST') {
    throw new CrmStoreError(
      `Priložnost je v terminalnem stage-u ${pred.stage} — CRM podatkov zamrznjene zgodovine ni mogoče urejati (kanon terminalnosti R378).`,
      409,
    )
  }

  if (vhod.naziv !== undefined && vhod.naziv.trim().length < 3) {
    throw new CrmStoreError('Naziv priložnosti je obvezen (min 3 znaki).', 400)
  }
  const vrednost = validirajOcenjenoVrednost(vhod.ocenjenaVrednost)
  if (!vrednost.ok) throw new CrmStoreError(vrednost.error, 400)
  const verjetnost = validateVerjetnost(vhod.verjetnost)
  if (!verjetnost.ok) throw new CrmStoreError(verjetnost.error, 400)
  if (vhod.customerId) {
    const stranka = await tx.customer.findUnique({ where: { id: vhod.customerId }, select: { id: true } })
    if (!stranka) throw new CrmStoreError('Stranka ne obstaja.', 404)
  }

  const opp = await tx.opportunity.update({
    where: { id: vhod.opportunityId },
    data: {
      ...(vhod.naziv !== undefined ? { naziv: vhod.naziv.trim() } : {}),
      ...(vhod.opis !== undefined ? { opis: vhod.opis?.trim() || null } : {}),
      ...(vhod.ocenjenaVrednost !== undefined ? { ocenjenaVrednost: vrednost.value } : {}),
      ...(vhod.verjetnost !== undefined ? { verjetnost: verjetnost.value } : {}),
      ...(vhod.customerId !== undefined ? { customerId: vhod.customerId ?? null } : {}),
    },
    select: { id: true, stage: true },
  })

  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.actorId,
    akcija: 'OPPORTUNITY_UPDATED',
    oldValue: pred,
    newValue: { opportunityId: opp.id, spremembe: vhod },
  })

  return { opportunityId: opp.id, stage: opp.stage }
}

// ── Prehod stage-a PRiložnosti (§13 lifecycle, matrika EN VIR) ──────────────

export interface PrehodOpportunityVhod {
  opportunityId: string
  to: string
  /** Obvezen pri to = LOST (§13 loss reason — 400 brez). */
  razlogIzgube?: string | null
  /** Obvezen pri to = ACCEPTED: naziv projekta, ki nastane (pretvorba). */
  nazivProjekta?: string | null
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

export interface PrehodOpportunityIzhod {
  opportunityId: string
  stage: string
  /** Nastane pri ACCEPTED — projekt iz ISTE transakcije (§13 convertedProjectId). */
  convertedProjectId: string | null
}

/**
 * Prehod stage-a priložnosti PO MATRIKI §13 (crm-pipeline EN VIR):
 *   • LOST zahteva RAZLOG (400 brez — tiha izguba je mutacija zgodovine);
 *   • ACCEPTED je TRANSAKCIJSKA PRETVORBA: zahteva stranko (409 brez —
 *     projekt BREZ stranke ne obstaja v tej domeni) in nazivProjekta (400
 *     brez); v ISTI transakciji nastane Project (status NACRTOVANO —
 *     nadaljnja veriga Quote→DealLock→BOM pripada R165+/§3/§6) in se zapiše
 *     convertedProjectId (UNIQUE — pretvorba je ENKRATNA);
 *   • vse ostale naprej-pažne/preskočene prehode matrica že dovoljuje.
 */
export async function prehodOpportunityVTx(
  tx: Prisma.TransactionClient,
  vhod: PrehodOpportunityVhod,
): Promise<PrehodOpportunityIzhod> {
  const opp = await tx.opportunity.findUnique({
    where: { id: vhod.opportunityId },
    select: { id: true, stage: true, customerId: true, naziv: true },
  })
  if (!opp) throw new CrmStoreError('Priložnost ne obstaja.', 404)

  if (!(OPPORTUNITY_STAGES as readonly string[]).includes(vhod.to)) {
    throw new CrmStoreError(
      `Neznan ciljni stage priložnosti '${vhod.to}' (§13 lifecycle: ${OPPORTUNITY_STAGES.join(' → ')}).`,
      400,
    )
  }

  const preverba = checkOpportunityStageTransition(opp.stage, vhod.to)
  if (!preverba.ok) {
    throw new CrmStoreError(
      `Prehod ${opp.stage} → ${vhod.to} ni dovoljen (dovoljeni iz ${opp.stage}: ${preverba.allowed.join(', ') || '— terminalen'}).`,
      409,
    )
  }

  let convertedProjectId: string | null = null

  if (requiresLossReason(vhod.to)) {
    const razlog = vhod.razlogIzgube?.trim()
    if (!razlog || razlog.length < 3) {
      throw new CrmStoreError(
        'Prehod v LOST zahteva razlog izgube (min 3 znaki) — izguba brez razloga je tiha mutacija zgodovine (§13).',
        400,
      )
    }
    if (razlog.length > 500) {
      throw new CrmStoreError('Razlog izgube sme imeti največ 500 znakov.', 400)
    }
  }

  if (requiresProjectConversion(vhod.to)) {
    if (!opp.customerId) {
      throw new CrmStoreError(
        'Priložnost nima stranke — sprejeta poslovna priložnost se pretvarja v PROJEKT, projekt pa brez stranke ne obstaja. Najprej pripni customerId.',
        409,
      )
    }
    const nazivProjekta = vhod.nazivProjekta?.trim()
    if (!nazivProjekta || nazivProjekta.length < 3) {
      throw new CrmStoreError(
        'Pretvorba v ACCEPTED zahteva nazivProjekta (min 3 znaki) — projekt, ki nastane, ga potrebuje.',
        400,
      )
    }
    if (nazivProjekta.length > 200) {
      throw new CrmStoreError('Naziv projekta sme imeti največ 200 znakov.', 400)
    }

    const projekt = await tx.project.create({
      data: {
        customerId: opp.customerId,
        nazivProjekta,
        status: 'NACRTOVANO',
      },
      select: { id: true },
    })
    convertedProjectId = projekt.id
  }

  const posodobljena = await tx.opportunity.update({
    where: { id: vhod.opportunityId },
    data: {
      stage: vhod.to,
      ...(vhod.to === 'LOST' ? { razlogIzgube: vhod.razlogIzgube?.trim() ?? null } : {}),
      ...(vhod.to === 'ACCEPTED' ? { convertedProjectId } : {}),
    },
    select: { id: true, stage: true },
  })

  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.actorId,
    akcija: vhod.to === 'ACCEPTED' ? 'OPPORTUNITY_CONVERTED' : 'OPPORTUNITY_STAGE',
    oldValue: { opportunityId: opp.id, stage: opp.stage, naziv: opp.naziv },
    newValue: {
      opportunityId: posodobljena.id,
      stage: posodobljena.stage,
      razlogIzgube: vhod.to === 'LOST' ? vhod.razlogIzgube?.trim() ?? null : undefined,
      convertedProjectId,
    },
  })

  if (convertedProjectId) {
    await auditInTx(tx, {
      request: vhod.revizija.request,
      session: vhod.revizija.session,
      userId: vhod.actorId,
      akcija: 'PROJECT_CREATED',
      projectId: convertedProjectId,
      newValue: {
        projectId: convertedProjectId,
        customerId: opp.customerId,
        vir: `pretvorba priložnosti ${opp.id} (ACCEPTED, §13)`,
      },
    })
  }

  return { opportunityId: posodobljena.id, stage: posodobljena.stage, convertedProjectId }
}

// ── Naslovi stranke (§13 — ločitev KONTAKTNI/RACUNSKI/MONTAZNI) ─────────────

export interface UstvariNaslovVhod {
  customerId: string
  tip: string
  naslov: string
  kraj?: string | null
  postnaSt?: string | null
  jePrivzet?: boolean
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

/**
 * Ustvari naslov stranke. Privzeti naslov tipa: stari privzeti se DEMOTE-a
 * (jePrivzet → false) v ISTI transakciji (partial UNIQUE index je zadnja
 * linija za vzporedne zapise). PRIVZETI KONTAKTNI sinhronizira legacy
 * Customer.naslov (flat prikazno polje — mobilni klienti/PDF, kanon §1) V
 * ISTI transakciji: ena resnica, dve reprezentaciji, nikoli razhojeni.
 */
export async function ustvariNaslovVTx(
  tx: Prisma.TransactionClient,
  vhod: UstvariNaslovVhod,
): Promise<{ addressId: string; tip: string; jePrivzet: boolean }> {
  const tip = validateCustomerAddressType(vhod.tip)
  if (!tip.ok) throw new CrmStoreError(tip.error, 400)

  const stranka = await tx.customer.findUnique({
    where: { id: vhod.customerId },
    select: { id: true, naslov: true },
  })
  if (!stranka) throw new CrmStoreError('Stranka ne obstaja.', 404)

  const naslov = vhod.naslov.trim()
  if (naslov.length < 3) {
    throw new CrmStoreError('Naslov je obvezen (min 3 znaki).', 400)
  }
  if (naslov.length > 200) {
    throw new CrmStoreError('Naslov sme imeti največ 200 znakov.', 400)
  }

  const jePrivzet = vhod.jePrivzet ?? false

  // DEMOTE PREJ (vrstni red je KLJUČEN): partial UNIQUE (customerId, tip)
  // WHERE jePrivzet bi ob "najprej create, nato demote" sprožil napako —
  // najprej počistimo starega privzetega tega tipa, NATO zapišemo novega.
  if (jePrivzet) {
    await tx.customerAddress.updateMany({
      where: { customerId: vhod.customerId, tip: tip.value, jePrivzet: true },
      data: { jePrivzet: false },
    })
  }

  const naslovVrstica = await tx.customerAddress.create({
    data: {
      customerId: vhod.customerId,
      tip: tip.value,
      naslov,
      kraj: vhod.kraj?.trim() || null,
      postnaSt: vhod.postnaSt?.trim() || null,
      jePrivzet,
    },
    select: { id: true, tip: true, jePrivzet: true },
  })

  // LEGACY SINHRON: flat prikazno polje držimo usklajeno (ista transakcija).
  if (jePrivzet && tip.value === 'KONTAKTNI') {
    await tx.customer.update({ where: { id: vhod.customerId }, data: { naslov } })
  }

  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.actorId,
    akcija: 'CUSTOMER_ADDRESS_CREATED',
    newValue: {
      addressId: naslovVrstica.id,
      customerId: vhod.customerId,
      tip: tip.value,
      naslov,
      jePrivzet,
    },
  })

  return { addressId: naslovVrstica.id, tip: naslovVrstica.tip, jePrivzet: naslovVrstica.jePrivzet }
}

export interface PosodobiNaslovVhod {
  addressId: string
  naslov?: string
  kraj?: string | null
  postnaSt?: string | null
  jePrivzet?: boolean
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

/**
 * Posodobi naslov (ISTO pravilo privzetosti kot ustvarjanje: demote starih,
 * legacy sinhron za KONTAKTNI). Tip se NE spreminja — tip naslova je
 * ZAVEZA (kam pošiljamo/računamo/mondiramo), ne lastnost, ki se prelepi;
 * naslov drugega tipa = NOVA vrstica (redna revizijska sled).
 */
export async function posodobiNaslovVTx(
  tx: Prisma.TransactionClient,
  vhod: PosodobiNaslovVhod,
): Promise<{ addressId: string; jePrivzet: boolean }> {
  const pred = await tx.customerAddress.findUnique({
    where: { id: vhod.addressId },
    select: { id: true, customerId: true, tip: true, naslov: true, kraj: true, postnaSt: true, jePrivzet: true },
  })
  if (!pred) throw new CrmStoreError('Naslov ne obstaja.', 404)

  if (vhod.naslov !== undefined) {
    const naslov = vhod.naslov.trim()
    if (naslov.length < 3) throw new CrmStoreError('Naslov je obvezen (min 3 znaki).', 400)
    if (naslov.length > 200) throw new CrmStoreError('Naslov sme imeti največ 200 znakov.', 400)
  }

  const jePrivzet = vhod.jePrivzet ?? pred.jePrivzet

  // DEMOTE PREJ (isti kanon kot ustvarjanje): če ta postaja privzeti, se
  // stari privzeti tega tipa počisti NAJPREJ — partial UNIQUE sicer sproži.
  if (jePrivzet && pred.jePrivzet !== jePrivzet) {
    await tx.customerAddress.updateMany({
      where: { customerId: pred.customerId, tip: pred.tip, jePrivzet: true, id: { not: vhod.addressId } },
      data: { jePrivzet: false },
    })
  }

  const posodobljen = await tx.customerAddress.update({
    where: { id: vhod.addressId },
    data: {
      ...(vhod.naslov !== undefined ? { naslov: vhod.naslov.trim() } : {}),
      ...(vhod.kraj !== undefined ? { kraj: vhod.kraj?.trim() || null } : {}),
      ...(vhod.postnaSt !== undefined ? { postnaSt: vhod.postnaSt?.trim() || null } : {}),
      ...(vhod.jePrivzet !== undefined ? { jePrivzet } : {}),
    },
    select: { id: true, tip: true, naslov: true, jePrivzet: true },
  })

  if (jePrivzet && posodobljen.tip === 'KONTAKTNI') {
    await tx.customer.update({ where: { id: pred.customerId }, data: { naslov: posodobljen.naslov } })
  }

  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.actorId,
    akcija: 'CUSTOMER_ADDRESS_UPDATED',
    oldValue: pred,
    newValue: { addressId: posodobljen.id, spremembe: vhod },
  })

  return { addressId: posodobljen.id, jePrivzet: posodobljen.jePrivzet }
}

/**
 * Izbriše naslov. Če je bil izbrisan PRIVZETI KONTAKTNI, se legacy
 * Customer.naslov preusmeri na najstarejši preostali KONTAKTNI (če
 * obstaja) — sicer ostane zadnja znana vrednost (flat polje je NOT NULL,
 * izmisliti praznine ne smemo §8).
 */
export async function izbrisiNaslovVTx(
  tx: Prisma.TransactionClient,
  vhod: { addressId: string; actorId: string | null; now: Date; revizija: RevizijskiKontekst },
): Promise<{ addressId: string }> {
  const pred = await tx.customerAddress.findUnique({
    where: { id: vhod.addressId },
    select: { id: true, customerId: true, tip: true, naslov: true, jePrivzet: true },
  })
  if (!pred) throw new CrmStoreError('Naslov ne obstaja.', 404)

  await tx.customerAddress.delete({ where: { id: vhod.addressId } })

  if (pred.jePrivzet && pred.tip === 'KONTAKTNI') {
    const naslednji = await tx.customerAddress.findFirst({
      where: { customerId: pred.customerId, tip: 'KONTAKTNI' },
      orderBy: { createdAt: 'asc' },
      select: { naslov: true },
    })
    if (naslednji) {
      await tx.customer.update({ where: { id: pred.customerId }, data: { naslov: naslednji.naslov } })
    }
  }

  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.actorId,
    akcija: 'CUSTOMER_ADDRESS_DELETED',
    oldValue: pred,
    newValue: { addressId: vhod.addressId, customerId: pred.customerId },
  })

  return { addressId: vhod.addressId }
}

// ── Branja (poizvedbe za rute — ENA točka serializacije Decimal → number) ──

/** Nalozi slead z his opportunities (za GET detajl). */
export async function naloziLead(id: string) {
  return db.lead.findUnique({
    where: { id },
    include: {
      opportunities: {
        select: { id: true, naziv: true, stage: true, customerId: true, ocenjenaVrednost: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

/** Nalozi priložnost s kontekstom (lead, stranka, pretvorjeni projekt). */
export async function naloziOpportunity(id: string) {
  return db.opportunity.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, ime: true, source: true, tipPovprasevanja: true, status: true } },
      customer: { select: { id: true, ime: true, naslov: true, telefon: true, email: true } },
      convertedProject: { select: { id: true, nazivProjekta: true, status: true, dealLocked: true } },
    },
  })
}
