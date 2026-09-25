/**
 * R142 (issue #5 §30 — Scheduler conflicts): deterministično odkrivanje
 * prekrivanja termina za VIRE (ekipa, glavni monter).
 *
 * Semantika intervala: POLI-ODPRTO `[zacetka, konec)` — termin, ki se
 * konča ob 16:00, NE prekriva termina, ki se začne ob 16:00 (nazaj-na-nazaj
 * je dovoljeno; ekipa lahko po končanem poslu takoj na novo lokacijo).
 *
 * IZRECNA sprememba vedenja glede na prejšnjo inline preverbo v POST
 * /api/schedules (R136 obdobje): prej je bil interval ZAPRT (`lte`/`gte`),
 * kar je nazaj-na-nazaj termine napačno označilo za konflikt. Nova semantika
 * je dokumentirana tu in v testih (r142-conflicts.test.ts).
 *
 * Statusi, ki držijo vir zasedenega:
 *   • NAVRTENO  — načrtovano (zasede),
 *   • V_TEKU    — poteka (zasede),
 *   • PRELOZENO — preloženo, a še vedno REZERVIRANO (zasede, dokler ni
 *     premaknjeno/ukinjeno).
 *   • PREKlicANO — ne zasede (odpovedano).
 *   • ZAKLJUCENO — ne zasede (opravljeno; zgodovina ne more prekrivati
 *     načrtovanja v prihodnje, zgodovinski vnosi pa ne smejo blokirati).
 *
 * §30 omenja še: opremo, odsotnost, travel-time/capacity. Oprema ima model
 * EquipmentAssignment, a NIMA API poti za dodeljevanje (ni pisalne rute —
 * konfliktov ne more nastati prek API-ja; zaščita se doda SOZvučno z
 * dodeljevalno ruto). Odsotnost/travel-time zahtevata NOVA modela (shema +
 * upravljanje) — ločena runda, dokumentirano v worklogu kot nadaljevanje.
 */
import { db } from '@/lib/db'

export const SCHEDULE_ACTIVE_STATUSES = ['NAVRTENO', 'V_TEKU', 'PRELOZENO'] as const

/** Poli-odprt interval: `[aStart, aEnd)` ∩ `[bStart, bEnd)` ≠ ∅. */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

/** Ali status termina drži vir zasedenega (zgoraj dokumentirana tabela). */
export function statusHoldsResource(status: string): boolean {
  return (SCHEDULE_ACTIVE_STATUSES as readonly string[]).includes(status)
}

export interface ResourceConflict {
  /** Kateri vir je dvojno rezerviran. */
  resource: 'ekipa' | 'monter'
  /** ID vira (crewId / monterId) — enak kot v zahtevi. */
  resourceId: string
  /** Prikazno ime (ekipa naziv / monter ime) — za UI sporočilo. */
  naziv: string
  /** Nasprotujoči si termin. */
  scheduleId: string
  projectId: string
  nazivProjekta: string
  datumZacetka: string
  datumKonca: string
  status: string
}

export interface ConflictQuery {
  crewId?: string | null
  monterId?: string | null
  datumZacetka: Date
  datumKonca: Date
  /** Pri premiku (PATCH): izključi premikan termin sam. */
  excludeId?: string
}

/**
 * Poišči VSE nasprotujoče si AKTIVNE termine za isti vir (ekipa ALI monter —
 * neodvisni viri: ekipa A in monter X se lahko prekrivata brez konflikta).
 * Vrne človeku berljiv minimalni DTO (§17) — za 409 odgovor in UI.
 *
 * Fail-closed po naravi: če je vir podan, se preverba ZAVEDNO izvede; brez
 * obeh virov je rezultat prazen (termin brez ekipe in monterja ne more imeti
 * dvojne rezervacije vira).
 */
export async function findResourceConflicts(q: ConflictQuery): Promise<ResourceConflict[]> {
  const resources: { kind: 'ekipa' | 'monter'; id: string }[] = []
  if (q.crewId) resources.push({ kind: 'ekipa', id: q.crewId })
  if (q.monterId) resources.push({ kind: 'monter', id: q.monterId })
  if (resources.length === 0) return []

  // En sam stavek: vsi aktivni termini, ki se poljubnemu podanemu viru
  // prekrivajo v času (poli-odprto). Nato filtriramo po viru v JS —
  // (crewId OR monterId) z različnimi ID-ji je berljivejše od dveh stavkov.
  const candidates = await db.installationSchedule.findMany({
    where: {
      status: { in: [...SCHEDULE_ACTIVE_STATUSES] },
      datumZacetka: { lt: q.datumKonca },
      datumKonca: { gt: q.datumZacetka },
      ...(q.excludeId ? { id: { not: q.excludeId } } : {}),
      OR: [
        ...(q.crewId ? [{ crewId: q.crewId }] : []),
        ...(q.monterId ? [{ monterId: q.monterId }] : []),
      ],
    },
    select: {
      id: true,
      projectId: true,
      crewId: true,
      monterId: true,
      datumZacetka: true,
      datumKonca: true,
      status: true,
      project: { select: { nazivProjekta: true } },
      crew: { select: { naziv: true } },
      monter: { select: { ime: true } },
    },
  })

  const out: ResourceConflict[] = []
  for (const c of candidates) {
    // Ponovna (natančna) preverba intervala v JS — DB stavek je grob predmetnik
    // (gt/lt), deterministika pa živi tu: isti rezultat za iste vhode.
    if (!overlaps(q.datumZacetka, q.datumKonca, c.datumZacetka, c.datumKonca)) continue
    if (q.crewId && c.crewId === q.crewId) {
      out.push({
        resource: 'ekipa',
        resourceId: q.crewId,
        naziv: c.crew?.naziv ?? 'ekipa',
        scheduleId: c.id,
        projectId: c.projectId,
        nazivProjekta: c.project?.nazivProjekta ?? '—',
        datumZacetka: c.datumZacetka.toISOString(),
        datumKonca: c.datumKonca.toISOString(),
        status: c.status,
      })
    } else if (q.monterId && c.monterId === q.monterId) {
      out.push({
        resource: 'monter',
        resourceId: q.monterId,
        naziv: c.monter?.ime ?? 'monter',
        scheduleId: c.id,
        projectId: c.projectId,
        nazivProjekta: c.project?.nazivProjekta ?? '—',
        datumZacetka: c.datumZacetka.toISOString(),
        datumKonca: c.datumKonca.toISOString(),
        status: c.status,
      })
    }
  }
  return out
}

/** Človeku berljivo sporočilo za toast/UI (prvi konflikt je dovolj). */
export function conflictMessage(conflicts: ResourceConflict[]): string {
  const c = conflicts[0]!
  const cas = new Date(c.datumZacetka).toLocaleString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${c.resource === 'ekipa' ? 'Ekipa' : 'Monter'} "${c.naziv}" ima že termin (${c.nazivProjekta}) ob ${cas}.`
}
