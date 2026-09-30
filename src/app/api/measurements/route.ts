// Roksal Field - API: Meritve (AR/LiDAR) — S+9 (issue #4, §3 + §14)
// Resource-level dostop: meritve sme dodati izvajalec projekta ali vodstvo
// (SKLADISCE samo bere). Stranski preskok NACRTOVANO → V_TEKU gre skozi
// statusni stroj (brez prisilnega overwrite-a statusa).
// R128 (issue #5 §4): `Idempotency-Key` (offline vrsta) — rezervacija ključa
// IN snapshot odgovora v ISTI transakciji kot mutacija = exactly-once replay
// (ponovitev istega ključa vrne originalni odgovor, brez dvojnika meritve).
// R274 (issue #17 §A/§B/§D) — AR SKUPNI KONTRAKT gate: arMetadata, ki
// IZRECNO nosi `contractVersion` (diskriminator isArContractPayload), se
// validira skozi kanonično shemo skupnega kontrakta (src/lib/ar-contract.ts)
// PRED transakcijo — napaka payload-a vrne 400 z izrecno kodo in NE
// SPREMENI obstoječega projekta (noben zapis, noben prehod statusa, nobena
// rezervacija Idempotency-Key). Veljaven payload se zapiše v KANONIČNI
// (validated) obliki. Legacy payload brez contractVersion (obstoječi
// balkonar blok) gre po stari poti NESPREMENJEN (nadgrajevljivost, R148
// vzorec 'stari klient obrati naprej'). NI vzporednega sync protokola (§F).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createMeasurementSchema } from '@/lib/validations'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, actorIdOf, principalBindingOf, AccessDeniedError } from '@/lib/access'
import { assertTransition, InvalidTransitionError } from '@/lib/project-state'
import { zapisOmejitev } from '@/lib/rate-limit'
import { auditInTx } from '@/lib/audit'
import {
  MEASUREMENT_STATUS_VALUES,
  isValidMeasurementStatus,
  type MeasurementStatusValue,
} from '@/lib/measurement-status'
import {
  beginIdempotency,
  idempotencyConflictResponse,
  idempotencyReplayResponse,
  IdempotencyRaceError,
  isValidIdempotencyKey,
  reserveIdempotencyIn,
  storeResponseIn,
} from '@/lib/idempotency'
import { ArContractError, isArContractPayload, parseArSessionPayload } from '@/lib/ar-contract'
import {
  izracunajNaslednjoVerzijo,
  izracunajKorenIdNaslednika,
  izracunajDelti,
  ODVISNI_REZULTATI_OPOMBA,
  type MeritevVir,
} from '@/lib/meritev-verzije'
import { preberiJsonTelo } from '@/lib/api-telo'

/**
 * R276 (O4) — napaka pravil verzije z žičnim HTTP statusom (400/409).
 * Vrgena ZNOTRAJ transakcije → rollback (ZERO-MUTACIJA neuspešne verzije);
 * 404 (neznani predhodnik) ostane AccessDeniedError — obstoječi vzorec.
 * AccessDeniedError se NE širi (status 403|404 je njen kontrakt).
 */
class VerzijaNapaka extends Error {
  readonly status: 400 | 409
  constructor(status: 400 | 409, message: string) {
    super(message)
    this.status = status
  }
}

export async function POST(request: Request) {
  // R191 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'measurements')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const actor = actorIdOf(auth)
  // Idempotenca (R128): veljaven klient ključ se rezervira kot PRVI stavek
  // transakcije (atomsko z mutacijo — exactly-once); validacija 400 rezervacije
  // NE pusti (ročni retry ostane čist 400, ne večni 409).
  const idemHeader = request.headers.get('Idempotency-Key')
  const idemKey = idemHeader !== null && isValidIdempotencyKey(idemHeader) ? idemHeader : null
  if (idemHeader !== null && !idemKey) {
    return NextResponse.json({ error: 'Neveljaven Idempotency-Key' }, { status: 400 })
  }
  const idemBinding = idemKey ? principalBindingOf(auth) : null
  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo
    let validated = createMeasurementSchema.parse(body)

    // Dostop do projekta — meritev lahko doda izvajalec/vodja projekta.
    const project = await db.project.findUnique({ where: { id: validated.projectId } })
    if (!project) throw new AccessDeniedError(404, 'Projekt ne obstaja')
    assertProjectAccess(auth, project, 'update')

    // R274 (issue #17 §A/§B/§D) — AR skupni kontrakt gate PRED transakcijo:
    // kontrakt-payload (nosi contractVersion) mora biti kanonično veljaven,
    // drugače 400 + izrecna koda — NIČ zapisov (B: 'napaka payload-a ne
    // spremeni obstoječega projekta'). Legacy (brez contractVersion) = stara
    // pot nespremenjena. parseArSessionPayload je ČIST — vrne kanonično
    // obliko, ki jo zapišemo (strict — neznana polja zavrnjena, §D).
    // R276 (O2) — vir = STREŽNIŠKO izpeljan iz istega kontrakta (klient ga
    // ne more podati): kontrakt → source iz kanonične oblike; brez
    // arMetadata → MANUAL (samo ročni vnosi UI); legacy arMetadata → null
    // (iskrena praznina — stari format NI vir resnice, nikoli ugibanje).
    let vir: MeritevVir | null = 'MANUAL'
    if (validated.arMetadata && isArContractPayload(validated.arMetadata)) {
      const kanonicno = parseArSessionPayload(validated.arMetadata)
      validated = { ...validated, arMetadata: kanonicno }
      vir = kanonicno.source
    } else if (validated.arMetadata) {
      vir = null
    }

    // Meritev + (možen prehod statusa) + audit (+ idempotenca) = ENA transakcija (§13).
    const measurement = await db.$transaction(async (tx) => {
      // R128: rezervacija Idempotency-Key = PRVI stavek — vzporedni poizkus
      // istega ključa povzroči rollback cele transakcije (brez dvojnikov).
      if (idemKey) await reserveIdempotencyIn(tx, idemKey, 'measurements', idemBinding)

      // R276 (O4) — validacija predhodnika INSIDE tx (atomska z zapisom):
      // obstoji (404) + isti projekt (400) + ni arhiviran (409). DB UNIQUE
      // na predhodnikId je zadnja črta proti razvejanju (fork = P2002).
      let predhodnik: {
        id: string
        verzija: number | null
        korenId: string | null
        dolzinaMm: number
        visinaMm: number
      } | null = null
      if (validated.predhodnikId) {
        const p = await tx.measurement.findUnique({ where: { id: validated.predhodnikId } })
        if (!p) {
          throw new AccessDeniedError(404, 'Predhodna meritev ne obstaja')
        }
        if (p.projectId !== validated.projectId) {
          throw new VerzijaNapaka(
            400,
            'Predhodna meritev pripada drugemu projektu — verzija mora ostati znotraj istega projekta'
          )
        }
        if (p.status === 'ARHIVIRANA') {
          throw new VerzijaNapaka(
            409,
            'Arhivirane meritve ni mogoče popraviti z novo verzijo — najprej ponovno odpiranje prek statusa (PATCH z opombo)'
          )
        }
        predhodnik = { id: p.id, verzija: p.verzija, korenId: p.korenId, dolzinaMm: p.dolzinaMm, visinaMm: p.visinaMm }
      }

      const created = await tx.measurement.create({
        data: {
          projectId: validated.projectId,
          dolzinaMm: validated.dolzinaMm,
          visinaMm: validated.visinaMm,
          lidarScanUrl: validated.lidarScanUrl,
          arMetadata: validated.arMetadata ? JSON.stringify(validated.arMetadata) : null,
          gpsLokacija: validated.gpsLokacija ? JSON.stringify(validated.gpsLokacija) : null,
          // R276 (O3): samostojna meritev = verzija 1 (sama je koren,
          // korenId null); naslednik = predhodnik.verzija + 1, koren se
          // prevzame. Null verzija NIKOLI izmišljena (brez backfill, O2/O9).
          verzija: predhodnik ? izracunajNaslednjoVerzijo(predhodnik.verzija) : 1,
          korenId: predhodnik ? izracunajKorenIdNaslednika(predhodnik) : null,
          predhodnikId: predhodnik?.id ?? null,
          vir,
        }
      })

      // Prej: brezpogojen overwrite statusa. Zdaj: veljaven prehod skozi
      // statusni stroj — NACRTOVANO → V_TEKU; druga stanja ostanejo netaknjena.
      if (project.status === 'NACRTOVANO') {
        assertTransition({ from: project.status, to: 'V_TEKU', principal: auth, dealLocked: project.dealLocked })
        await tx.project.update({
          where: { id: validated.projectId },
          data: { status: 'V_TEKU' }
        })
      }

      // R276 (O6/O7): korekcija = audit MEASUREMENT_VERSION z deltami
      // ('kaj se je spremenilo') + IZREČNO iskren zapis odvisnih rezultatov
      // (NIČ lažnega 'recalculated: true'). Samostojna meritev = obstoječi
      // CREATE_MEASUREMENT NESPREMENJEN (regresijska varnost).
      if (predhodnik) {
        const delti = izracunajDelti(predhodnik, created)
        await auditInTx(tx, {
          userId: actor,
          projectId: validated.projectId,
          akcija: 'MEASUREMENT_VERSION',
          oldValue: JSON.stringify({
            id: predhodnik.id,
            verzija: predhodnik.verzija,
            dolzinaMm: predhodnik.dolzinaMm,
            visinaMm: predhodnik.visinaMm,
          }),
          newValue: JSON.stringify({
            id: created.id,
            verzija: created.verzija,
            dolzinaMm: created.dolzinaMm,
            visinaMm: created.visinaMm,
            deltaDolzinaMm: delti.deltaDolzinaMm,
            deltaVisinaMm: delti.deltaVisinaMm,
            vir,
            predhodnikId: predhodnik.id,
            odvisniRezultati: ODVISNI_REZULTATI_OPOMBA,
          }),
        })
      } else {
        await auditInTx(tx, {
          userId: actor,
          projectId: validated.projectId,
          akcija: 'CREATE_MEASUREMENT',
          newValue: JSON.stringify({ dolzinaMm: validated.dolzinaMm, visinaMm: validated.visinaMm }),
        })
      }

      // R128: snapshot odgovora v isti transakciji — retry istega ključa
      // vrne TA odgovor (exactly-once), ne ustvari druge meritve.
      if (idemKey) {
        await storeResponseIn(tx, idemKey, 201, JSON.stringify(created))
      }

      return created
    })

    const response = NextResponse.json(measurement, { status: 201 })
    if (idemKey) response.headers.set('Idempotent-Stored', 'true')
    return response
  } catch (error: unknown) {
    // R128: vzporedni poizkus istega ključa — transakcija rollbackana;
    // vrni shranjen odgovor (replay) ali čist 409 (tudi tuji profil — brez razkritja).
    if (idemKey && error instanceof IdempotencyRaceError) {
      const begun = await beginIdempotency(idemKey, 'measurements', idemBinding)
      if (begun.kind === 'replay') return idempotencyReplayResponse(begun)
      return idempotencyConflictResponse()
    }
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof VerzijaNapaka) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof InvalidTransitionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    // R276 (O4) — razvejanje verige (fork) = P2002 na unique predhodnikId
    // (zadnja obrambna črta, tudi vzporedni race) → čist 409, NIČ zapisano
    // (transakcija rollbackana — ZERO-MUTACIJA neuspešnega fork-a).
    if ((error as { code?: string }).code === 'P2002') {
      const target = (error as { meta?: { target?: unknown } }).meta?.target
      const tarča = Array.isArray(target) ? target.join(',') : String(target ?? '')
      if (tarča.includes('predhodnikId') || tarča.includes('Measurement_predhodnikId_key')) {
        return NextResponse.json(
          { error: 'Predhodnik že ima naslednika — verzija je enojna veriga brez razvejanja' },
          { status: 409 },
        )
      }
    }
    // R274 (issue #17 §B/§D) — neveljaven kontrakt-payload = čist 400 z
    // žično kodo (klient jo lahko obravnava programsko); originalni payload
    // NI na voljo klientu (ne pošiljamo ga nazaj), nič ni zapisano.
    if (error instanceof ArContractError) {
      return NextResponse.json(
        { error: 'Neveljaven AR skupni kontrakt', code: error.code, pot: error.pot, podrobnost: error.message },
        { status: 400 },
      )
    }
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues }, { status: 400 })
    }
    console.error('Measurement POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju meritev' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Manjka projectId' }, { status: 400 })
    }

    // R154: ?status= — strežniški filter po statusu meritve (R153 indeks
    // (projectId, status) dobi dejansko rabo). Stroga validacija: neznana
    // vrednost → 400 z izrecno napako (fail-closed, ne tiho prazen seznam).
    // Brez parametra = nespremenjeno obnašanje (vse meritve projekta).
    const statusParam = searchParams.get('status')
    let statusFilter: MeasurementStatusValue | null = null
    if (statusParam !== null) {
      if (!isValidMeasurementStatus(statusParam)) {
        return NextResponse.json(
          { error: `Neveljaven status: dovoljene vrednosti so ${MEASUREMENT_STATUS_VALUES.join(', ')}` },
          { status: 400 }
        )
      }
      statusFilter = statusParam
    }

    // Dostop do meritev = dostop do projekta (403 na tuj projekt).
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) throw new AccessDeniedError(404, 'Projekt ne obstaja')
    assertProjectAccess(auth, project, 'read')

    const measurements = await db.measurement.findMany({
      where: statusFilter ? { projectId, status: statusFilter } : { projectId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(measurements)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Measurements GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju meritev' }, { status: 500 })
  }
}
