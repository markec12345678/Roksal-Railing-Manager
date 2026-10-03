// R402 — INTEGRACIJSKI TESTI TRANSAKCIJSKE PLASTI PLAČIL (issue #13 §19).
// ---------------------------------------------------------------------------
// Proti testni bazi roksal_test (globalSetup; vzorec r378-production-store):
//   (1) SREČNA POT: celo plačilo → PLACAN + placanoAt + audita (PAYMENT_RECORDED
//       + INVOICE_STATUS) v ISTI transakciji; delno → DELNO_PLACAN → doplata
//       → PLACAN;
//   (2) PORAZDELITEV: eno plačilo čez DVA računa (multi-invoice allocation);
//       čist AVANS brez cilja (0 allocacij — ostanek poroča uskladitev);
//   (3) VRATA (fail-closed, vsak zavrnjen poskus = ZERO-MUTACIJA): osnutek/
//       storno račun 409; prečni projekt 409; NADPLACILO 409; vsota allocacij
//       > znesek plačila 400; znesek ≤ 0 400; valuta ≠ EUR 400; podvojen
//       invoiceId 400; neznan projekt/račun 404;
//   (4) PREKINITEV: plačilo → PREKINJENO z razlogom (NE briše se — allocacije
//       ostanejo), račun se PONOVNO izpelje (PLACAN → POVRATEK po roku/poslanem/
//       izdanu — determinizem iz diska); dvojna prekinitev 409;
//   (5) USKLANJANJE: poročilo izpeljave (placiloZnesek/odprto/zapadlo) +
//       anomalije (legacy placanoAt brez statusa, neporazdeljen ostanek).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import {
  PaymentStoreError,
  prekiniPlaciloVTx,
  uskladiPlacila,
  zabeleziPlaciloVTx,
  type RevizijaKontekst,
} from '../payments'

const OZNAKA = 'r400-placila'

/** Kontekst revizije za direktne klice plasti (brez HTTP). */
function revizija(userId: string | null): RevizijaKontekst {
  return {
    request: new Request('http://localhost/vitest', { headers: { 'user-agent': 'vitest' } }),
    session: null,
    userId,
  }
}

let vodja: { user: { id: string }; token: string }

/** Stranka + projekt (lastnik = vodja, da 'update' dostop vedno gre skozi). */
async function narediProjekt(tag: string): Promise<string> {
  const customer = await db.customer.create({
    data: { ime: `Stranka ${OZNAKA} ${tag} ${Date.now()}`, naslov: 'Test 1' },
  })
  const project = await db.project.create({
    data: {
      customerId: customer.id,
      nazivProjekta: `Projekt ${OZNAKA} ${tag} ${Date.now()}`,
      vodjaId: vodja.user.id,
    },
  })
  return project.id
}

/** Izdan račun z znanim zneskom (123,00 + DDV 22 % = 150,06). */
async function narediRacun(
  projectId: string,
  tag: string,
  znesek = 150.06,
  status = 'IZDAN',
  datumIzdaje?: Date,
): Promise<string> {
  const racun = await db.invoice.create({
    data: {
      projectId,
      tip: 'RACUN',
      stevilka: `2026-R402-${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      rokPlacilaDni: 8,
      datumIzdaje: datumIzdaje ?? new Date(),
      postavke: '[]',
      kupec: JSON.stringify({ ime: 'K', naslov: 'N' }),
      osnova: Math.round((znesek / 1.22) * 100) / 100,
      ddv: Math.round((znesek - znesek / 1.22) * 100) / 100,
      znesek,
      status,
    },
  })
  return racun.id
}

async function zabelezi(vhod: Parameters<typeof zabeleziPlaciloVTx>[1]) {
  return db.$transaction((tx) => zabeleziPlaciloVTx(tx, vhod))
}

async function prekini(vhod: Parameters<typeof prekiniPlaciloVTx>[1]) {
  return db.$transaction((tx) => prekiniPlaciloVTx(tx, vhod))
}

/** Pričakovana napaka plasti (koda + status) — drugače fail. */
async function pričakujNapako(koda: string, status: number, dejanje: () => Promise<unknown>): Promise<void> {
  try {
    await dejanje()
    expect.unreachable(`moralo bi vreči PaymentStoreError ${koda}`)
  } catch (e) {
    expect(e).toBeInstanceOf(PaymentStoreError)
    const napaka = e as PaymentStoreError
    expect(napaka.code).toBe(koda)
    expect(napaka.status).toBe(status)
  }
}

beforeAll(async () => {
  vodja = await createTestUserWithSession('r400-vodja', 'VODJA')
})

afterAll(async () => {
  // Čiščenje po OZNAKI: plačila/allocacije kaskadajo s projektom; računi
  // RESTRICT na allocacije → najprej plačila (kaskadajo allocacije), nato
  // projekte (kaskadajo računi).
  const projekti = await db.project.findMany({
    where: { nazivProjekta: { contains: OZNAKA } },
    select: { id: true },
  })
  const ids = projekti.map((p) => p.id)
  if (ids.length > 0) {
    await db.payment.deleteMany({ where: { projectId: { in: ids } } })
    await db.auditLog.deleteMany({ where: { projectId: { in: ids } } })
    await db.project.deleteMany({ where: { id: { in: ids } } })
  }
  await db.customer.deleteMany({ where: { ime: { contains: `Stranka ${OZNAKA}` } } })
})

describe('R402 — srečna pot: celo + delno plačilo', () => {
  it('celo plačilo → PLACAN + placanoAt + PAYMENT_RECORDED + INVOICE_STATUS audita (ISTA tx)', async () => {
    const projectId = await narediProjekt('celo')
    const racunId = await narediRacun(projectId, 'celo', 150.06)
    const placanoAt = new Date('2026-10-03T10:00:00Z')

    const izhod = await zabelezi({
      projectId,
      invoiceId: racunId,
      tip: 'PLACILO',
      znesek: 150.06,
      placanoAt,
      referenca: 'SKLIC-1',
      metoda: 'BANKA',
      revizija: revizija(vodja.user.id),
    })

    expect(izhod.payment.status).toBe('KNJIZENO')
    expect(izhod.payment.znesek.toString()).toBe('150.06')
    expect(izhod.payment.createdBy).toBe(vodja.user.id)
    expect(izhod.payment.allocations).toHaveLength(1)
    expect(izhod.payment.allocations[0].invoiceId).toBe(racunId)
    expect(izhod.spremembe).toHaveLength(1)
    expect(izhod.spremembe[0]).toMatchObject({ invoiceId: racunId, from: 'IZDAN', to: 'PLACAN' })

    const racun = await db.invoice.findUniqueOrThrow({ where: { id: racunId } })
    expect(racun.status).toBe('PLACAN')
    expect(racun.placanoAt?.toISOString()).toBe(placanoAt.toISOString())

    const auditi = await db.auditLog.findMany({
      where: { projectId, akcija: { in: ['PAYMENT_RECORDED', 'INVOICE_STATUS'] } },
      orderBy: { timestamp: 'asc' },
    })
    expect(auditi.map((a) => a.akcija).sort()).toEqual(['INVOICE_STATUS', 'PAYMENT_RECORDED'])
    const statusAudit = auditi.find((a) => a.akcija === 'INVOICE_STATUS')
    expect(statusAudit?.oldValue).toBe('IZDAN')
    expect(statusAudit?.newValue).toBe('PLACAN')
  })

  it('delno plačilo → DELNO_PLACAN; doplata → PLACAN (st openstvo < znesek)', async () => {
    const projectId = await narediProjekt('delno')
    const racunId = await narediRacun(projectId, 'delno', 100)

    const prvi = await zabelezi({
      projectId,
      invoiceId: racunId,
      tip: 'PLACILO',
      znesek: 40,
      placanoAt: new Date('2026-10-01T10:00:00Z'),
      revizija: revizija(vodja.user.id),
    })
    expect(prvi.spremembe[0]).toMatchObject({ from: 'IZDAN', to: 'DELNO_PLACAN' })
    expect((await db.invoice.findUniqueOrThrow({ where: { id: racunId } })).status).toBe('DELNO_PLACAN')

    const drugi = await zabelezi({
      projectId,
      invoiceId: racunId,
      tip: 'PLACILO',
      znesek: 60,
      placanoAt: new Date('2026-10-02T10:00:00Z'),
      revizija: revizija(vodja.user.id),
    })
    expect(drugi.spremembe[0]).toMatchObject({ from: 'DELNO_PLACAN', to: 'PLACAN' })
    const racun = await db.invoice.findUniqueOrThrow({ where: { id: racunId } })
    expect(racun.status).toBe('PLACAN')
    expect(racun.placanoAt?.toISOString()).toBe('2026-10-02T10:00:00.000Z')
  })
})

describe('R402 — porazdelitev: več računov + čist avans', () => {
  it('ENO plačilo 150,06 razdeljeno na DVA računa (60 + 90,06) — oba izpeljana', async () => {
    const projectId = await narediProjekt('split')
    const racunA = await narediRacun(projectId, 'split-a', 60)
    const racunB = await narediRacun(projectId, 'split-b', 90.06)

    const izhod = await zabelezi({
      projectId,
      tip: 'PLACILO',
      znesek: 150.06,
      placanoAt: new Date('2026-10-03T10:00:00Z'),
      allocacije: [
        { invoiceId: racunA, znesek: 60 },
        { invoiceId: racunB, znesek: 90.06 },
      ],
      revizija: revizija(vodja.user.id),
    })

    expect(izhod.payment.allocations).toHaveLength(2)
    expect(izhod.spremembe).toHaveLength(2)
    expect((await db.invoice.findUniqueOrThrow({ where: { id: racunA } })).status).toBe('PLACAN')
    expect((await db.invoice.findUniqueOrThrow({ where: { id: racunB } })).status).toBe('PLACAN')
  })

  it('čist AVANS brez cilja: 0 allocacij, brez spremembe statusov (ostanek poroča uskladitev)', async () => {
    const projectId = await narediProjekt('avans')
    await narediRacun(projectId, 'avans', 100)

    const izhod = await zabelezi({
      projectId,
      tip: 'AVANS',
      znesek: 200,
      placanoAt: new Date('2026-10-03T10:00:00Z'),
      revizija: revizija(vodja.user.id),
    })

    expect(izhod.payment.allocations).toHaveLength(0)
    expect(izhod.spremembe).toHaveLength(0)
    expect(izhod.payment.invoiceId).toBeNull()
  })
})

describe('R402 — vrata (fail-closed, ZERO-MUTACIJA zavrnjenih poskusov)', () => {
  it('osnutek/storno račun → 409 RACUN_NI_PLACLJIV; prečni projekt → 409; NADPLACILO → 409', async () => {
    const projectId = await narediProjekt('vrata')
    const osnutek = await narediRacun(projectId, 'vrata-osn', 100, 'OSNUTEK')
    const storno = await narediRacun(projectId, 'vrata-sto', 100, 'STORNIRAN')
    const drugProjekt = await narediProjekt('vrata-tuj')
    const tujRacun = await narediRacun(drugProjekt, 'vrata-tuj-r', 100)
    const racun = await narediRacun(projectId, 'vrata-r', 100)
    await zabelezi({
      projectId,
      invoiceId: racun,
      tip: 'PLACILO',
      znesek: 100,
      placanoAt: new Date(),
      revizija: revizija(vodja.user.id),
    })

    await pričakujNapako('RACUN_NI_PLACLJIV', 409, () =>
      zabelezi({ projectId, invoiceId: osnutek, tip: 'PLACILO', znesek: 50, placanoAt: new Date(), revizija: revizija(vodja.user.id) }),
    )
    await pričakujNapako('RACUN_NI_PLACLJIV', 409, () =>
      zabelezi({ projectId, invoiceId: storno, tip: 'PLACILO', znesek: 50, placanoAt: new Date(), revizija: revizija(vodja.user.id) }),
    )
    await pričakujNapako('RACUN_TUJI_PROJEKT', 409, () =>
      zabelezi({
        projectId,
        tip: 'PLACILO',
        znesek: 50,
        placanoAt: new Date(),
        allocacije: [{ invoiceId: tujRacun, znesek: 50 }],
        revizija: revizija(vodja.user.id),
      }),
    )
    // NADPLACILO: plačen račun (100) + nova allocacija 1 → presega odprto 0
    await pričakujNapako('NADPLACILO', 409, () =>
      zabelezi({ projectId, invoiceId: racun, tip: 'PLACILO', znesek: 1, placanoAt: new Date(), revizija: revizija(vodja.user.id) }),
    )

    // ZERO-MUTACIJA: zavrnjeni poskusi niso pustili plačil niti spremenili statusov
    const placila = await db.payment.findMany({ where: { projectId } })
    expect(placila).toHaveLength(1) // samo uspešno celo plačilo
    expect((await db.invoice.findUniqueOrThrow({ where: { id: osnutek } })).status).toBe('OSNUTEK')
    expect((await db.invoice.findUniqueOrThrow({ where: { id: storno } })).status).toBe('STORNIRAN')
  })

  it('vsota allocacij > znesek plačila → 400; znesek ≤ 0 → 400; valuta ≠ EUR → 400; podvojen invoiceId → 400', async () => {
    const projectId = await narediProjekt('vrata2')
    const racun = await narediRacun(projectId, 'vrata2-r', 100)

    // vsota 40 > znesek 30 (preverba vsote pride PRED podvojenim parom):
    await pričakujNapako('ALLOCACIJE_PRESEGAJO_PLACILO', 400, () =>
      zabelezi({
        projectId,
        tip: 'PLACILO',
        znesek: 30,
        placanoAt: new Date(),
        allocacije: [
          { invoiceId: racun, znesek: 20 },
          { invoiceId: racun, znesek: 20 },
        ],
        revizija: revizija(vodja.user.id),
      }),
    )

    await pričakujNapako('ZNESEK_NI_PozITIVEN', 400, () =>
      zabelezi({ projectId, invoiceId: racun, tip: 'PLACILO', znesek: 0, placanoAt: new Date(), revizija: revizija(vodja.user.id) }),
    )
    await pričakujNapako('VALUTA_NI_EUR', 400, () =>
      zabelezi({ projectId, invoiceId: racun, tip: 'PLACILO', znesek: 10, valuta: 'USD', placanoAt: new Date(), revizija: revizija(vodja.user.id) }),
    )

    // podvojen invoiceId z USTREZNO vsoto (40 ≤ 40) → pride na vrsto podvojen par:
    await pričakujNapako('PODVOJENA_ALLOCACIJA', 400, () =>
      zabelezi({
        projectId,
        tip: 'PLACILO',
        znesek: 40,
        placanoAt: new Date(),
        allocacije: [
          { invoiceId: racun, znesek: 20 },
          { invoiceId: racun, znesek: 20 },
        ],
        revizija: revizija(vodja.user.id),
      }),
    )
  })

  it('neznan projekt → 404; neznan račun → 404; PLACILO brez cilja → 400', async () => {
    const projectId = await narediProjekt('vrata3')
    await pričakujNapako('PROJEKT_NE_OBSTAJA', 404, () =>
      zabelezi({ projectId: 'neobstojeci', tip: 'PLACILO', znesek: 10, placanoAt: new Date(), revizija: revizija(vodja.user.id) }),
    )
    await pričakujNapako('RACUN_NE_OBSTAJA', 404, () =>
      zabelezi({ projectId, invoiceId: 'neobstojeci', tip: 'PLACILO', znesek: 10, placanoAt: new Date(), revizija: revizija(vodja.user.id) }),
    )
    await pričakujNapako('BREZ_CILJA', 400, () =>
      zabelezi({ projectId, tip: 'PLACILO', znesek: 10, placanoAt: new Date(), revizija: revizija(vodja.user.id) }),
    )
  })
})

describe('R402 — prekinitev plačila (pravna sled + deterministična izpeljava)', () => {
  it('void: PLACAN → POVRATEK (rok pretekel → ZAPADLO); plačilo ostane PREKINJENO z razlogom; allocacije NE izginejo', async () => {
    const projectId = await narediProjekt('void')
    // Izdan 1.9. z rokom 8 dni → 9.9.; void ob 3.10. → rok PRETEKEL → ZAPADLO
    const racunId = await narediRacun(projectId, 'void-r', 100, 'IZDAN', new Date('2026-09-01T00:00:00Z'))
    const zabelezeno = await zabelezi({
      projectId,
      invoiceId: racunId,
      tip: 'PLACILO',
      znesek: 100,
      placanoAt: new Date('2026-09-05T10:00:00Z'),
      revizija: revizija(vodja.user.id),
    })
    expect(zabelezeno.spremembe[0].to).toBe('PLACAN')

    const prekinjeno = await prekini({
      paymentId: zabelezeno.payment.id,
      razlog: 'Knjižna napaka — dvojno plačilo',
      now: new Date('2026-10-03T12:00:00Z'),
      revizija: revizija(vodja.user.id),
    })

    expect(prekinjeno.payment.status).toBe('PREKINJENO')
    expect(prekinjeno.payment.prekinitevRazlog).toBe('Knjižna napaka — dvojno plačilo')
    expect(prekinjeno.payment.prekinjenoAt?.toISOString()).toBe('2026-10-03T12:00:00.000Z')
    // Allocacije OSTANEJO (pravna sled) — ne štejejo v izpeljavo:
    expect(prekinjeno.payment.allocations).toHaveLength(1)
    // Deterministični povratek: rok (1.10.) < now (3.10.) → ZAPADLO
    expect(prekinjeno.spremembe[0]).toMatchObject({ from: 'PLACAN', to: 'ZAPADLO' })

    const racun = await db.invoice.findUniqueOrThrow({ where: { id: racunId } })
    expect(racun.status).toBe('ZAPADLO')
    expect(racun.placanoAt).toBeNull() // izpeljava počisti plačilni datum

    // ZERO plačil v izpeljavi — uskladitev poroča placiloZnesek 0:
    const porocilo = await uskladiPlacila(projectId, new Date('2026-10-03T12:00:00Z'))
    expect(porocilo.racuni[0].placiloZnesek).toBe(0)
    expect(porocilo.povzetek.placilPrekinjenih).toBe(1)

    const auditVoid = await db.auditLog.findFirst({
      where: { projectId, akcija: 'PAYMENT_VOIDED' },
    })
    expect(auditVoid).not.toBeNull()
  })

  it('dvojna prekinitev → 409 PLACILO_ZE_PREKINJENO; razlog < 3 znaki → 400', async () => {
    const projectId = await narediProjekt('void2')
    const racunId = await narediRacun(projectId, 'void2-r', 100)
    const zabelezeno = await zabelezi({
      projectId,
      invoiceId: racunId,
      tip: 'PLACILO',
      znesek: 100,
      placanoAt: new Date('2026-10-01T10:00:00Z'),
      revizija: revizija(vodja.user.id),
    })
    const prva = await prekini({
      paymentId: zabelezeno.payment.id,
      razlog: 'Dvojnik',
      now: new Date('2026-10-03T12:00:00Z'),
      revizija: revizija(vodja.user.id),
    })
    // rok (9.10.) > now → POVRATEK POSLAN/IZDAN (ni poslanoAt, rok ni pretekel → IZDAN)
    expect(prva.spremembe[0].to).toBe('IZDAN')

    await pričakujNapako('PLACILO_ZE_PREKINJENO', 409, () =>
      prekini({ paymentId: zabelezeno.payment.id, razlog: 'Še enkrat', now: new Date(), revizija: revizija(vodja.user.id) }),
    )
    // Neznan id (veljaven razlog — vrata existence pridejo na vrsto):
    await pričakujNapako('PLACILO_NE_OBSTAJA', 404, () =>
      prekini({ paymentId: 'neobstojeci', razlog: 'Ukinitev', now: new Date(), revizija: revizija(vodja.user.id) }),
    )
  })

  it('void enega od dveh plačil: PLACAN → DELNO_PLACAN (ostanek KNJIZENO allocacij)', async () => {
    const projectId = await narediProjekt('void3')
    const racunId = await narediRacun(projectId, 'void3-r', 100)
    const prvo = await zabelezi({
      projectId,
      invoiceId: racunId,
      tip: 'PLACILO',
      znesek: 60,
      placanoAt: new Date('2026-10-01T10:00:00Z'),
      revizija: revizija(vodja.user.id),
    })
    await zabelezi({
      projectId,
      invoiceId: racunId,
      tip: 'PLACILO',
      znesek: 40,
      placanoAt: new Date('2026-10-02T10:00:00Z'),
      revizija: revizija(vodja.user.id),
    })
    expect((await db.invoice.findUniqueOrThrow({ where: { id: racunId } })).status).toBe('PLACAN')

    const prekinjeno = await prekini({
      paymentId: prvo.payment.id,
      razlog: 'Povratno breme',
      now: new Date('2026-10-03T12:00:00Z'),
      revizija: revizija(vodja.user.id),
    })
    expect(prekinjeno.spremembe[0]).toMatchObject({ from: 'PLACAN', to: 'DELNO_PLACAN' })
    expect((await db.invoice.findUniqueOrThrow({ where: { id: racunId } })).status).toBe('DELNO_PLACAN')
  })
})

describe('R402 — uskladitev (samo-bralno poročilo)', () => {
  it('poročilo nosi izpeljavo po računu + anomalije (neporazdeljen ostanek, legacy placanoAt)', async () => {
    const projectId = await narediProjekt('uskladi')
    const racun = await narediRacun(projectId, 'uskladi-r', 100)
    // Delno plačilo + neporazdeljen ostanek (plačilo 50, allocirano 30):
    await zabelezi({
      projectId,
      tip: 'PLACILO',
      znesek: 50,
      placanoAt: new Date('2026-10-03T10:00:00Z'),
      allocacije: [{ invoiceId: racun, znesek: 30 }],
      revizija: revizija(vodja.user.id),
    })
    // Legacy neskladje: placanoAt na statusu ≠ PLACAN (ročno, kot pokvarjen vir):
    const legacy = await narediRacun(projectId, 'uskladi-legacy', 80)
    await db.invoice.update({ where: { id: legacy }, data: { placanoAt: new Date('2026-09-01T00:00:00Z') } })

    const porocilo = await uskladiPlacila(projectId, new Date('2026-10-03T12:00:00Z'))

    const vrstica = porocilo.racuni.find((r) => r.invoiceId === racun)
    expect(vrstica).toMatchObject({ znesek: 100, placiloZnesek: 30, odprto: 70, status: 'DELNO_PLACAN' })
    expect(vrstica?.zapadlo).toBe(false) // rok 11.10. > now 3.10.

    const kode = porocilo.anomalije.map((a) => a.koda)
    expect(kode).toContain('NEPORAZDELEJEN_OSTANEK') // plačilo 50, porazdeljeno 30
    expect(kode).toContain('PLACANOAT_BREZ_STATUSA') // legacy vrstica
    expect(porocilo.povzetek).toMatchObject({ racunov: 2, placil: 1, placilPrekinjenih: 0 })
    expect(porocilo.povzetek.skupajPlacilo).toBe(30)
    expect(porocilo.povzetek.skupajOdprto).toBe(150) // 70 + 80
  })
})
