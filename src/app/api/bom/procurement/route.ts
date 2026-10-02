// R376 (issue #13, korak R166 iz §11) — API: PROCUREMENT/INVENTORY NAD BOM.
// ---------------------------------------------------------------------------
// GET /api/bom/procurement?projectId=X — po VRSTICI zadnje APPROVED verzije
// BOM projekta (dostop 'read' do projekta):
//   plannedQty   = BOMLine.quantity (neto količina iz verzije — §5 sled);
//   reservedQty  = StockLedger RESERVATION (odhod, −) + RELEASE (prihod, +)
//                  → neto rezervirano = −(Σ rezervacij + Σ sprostitev);
//   orderedQty   = Σ MaterialOrderItem.kolicina postavk NAROČIL PROJEKTA
//                  vezanih na artikel (vsi statusi naročil — vir je postavka
//                  naročila; statusno filtriranje bi bilo izumljena pravila);
//   receivedQty  = Σ StockLedger RECEIPT dogodkov projekta+artikla (prejem
//                  naročila piše projectId projekta naročila);
//   issuedQty    = −Σ StockLedger ISSUE dogodkov projekta+artikla (izdaja);
//   consumedQty  = Σ MaterialUsage.porabljenaKolicina projekta+artikla;
//   returnedQty  = Σ StockLedger RETURN dogodkov projekta+artikla (vračilo);
//   wastedQty    = −Σ StockLedger WASTE dogodkov projekta+artikla (odpis);
//   variance     = planned − consumed − wasted + returned (SAMO vezane).
//
// POŠTEN odnos do virov (§11 »map EXACTLY, no invention«):
//   • reservedQty beremo iz StockLedger, NE iz LotAllocation — sledljiv
//     razlog: LotAllocation nastaja SAMO za ODHODE (recordMovementInTx
//     alokira šarže pri delta < 0), RELEASE (prihod = sprostitev
//     rezervacije) alokacije NE piše → alokacije kot vir bi štele PREVEČ.
//     StockLedger (nespremenljiva knjiga, issue #4 §4) nosi OBA dogodka;
//     LotAllocation ostaja sled ŠARŽ (FIFO), ne rezervacij.
//   • NEpreslikani tipi (§11 nima polja zanje; uganjanje bi bilo izum):
//     DAMAGE (poškodba — ločeno od odpisa), ADJUSTMENT (inventurni popavek),
//     OPENING/PURCHASE (začetno stanje/prihod brez projekta),
//     PROJECT_ALLOCATION (alokacijska semantika brez nasprotnega dogodka v
//     toku R376) — vsi IZRECNO naštetí v odgovoru (preslikava.nePreslikano).
//   • NEVEZANA vrstica (inventoryId = NULL — EXACT sifraMateriala ujemanje
//     ni uspelo): VSE dejanske količine so NULL (NIKOLI ničle — ničla bi
//     bila laž »ni se nič zgodilo«), vezava = 'NEVEZANO' + razlog.
//   • Ni APPROVED verzije → 404 (fail-closed: prazen odgovor bi bil tiha
//     zamenjava za manjkajočo odločitev — najprej odobrite BOM).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'

/** Dogodki, ki se PRESLIKAVO v §11 količine (vsi ostali so nePreslikano). */
const PRESLIKANI_DOGODKI = ['RESERVATION', 'RELEASE', 'RECEIPT', 'ISSUE', 'RETURN', 'WASTE'] as const

interface ProcurementLineDto {
  lineOrder: number
  quoteLineKey: string | null
  internalSku: string
  supplierSku: string | null
  inventoryId: string | null
  category: string
  descriptionSnapshot: string
  unit: string
  /** Neto načrtovana količina iz BOM vrstice — VEDNO znana (kanonski vir). */
  plannedQty: number
  reservedQty: number | null
  orderedQty: number | null
  receivedQty: number | null
  issuedQty: number | null
  consumedQty: number | null
  returnedQty: number | null
  wastedQty: number | null
  /** planned − consumed − wasted + returned; NULL za nevezane vrstice. */
  variance: number | null
  /** VEZANO (EXACT inventarna vezava) | NEVEZANO (razlog spodaj). */
  vezava: 'VEZANO' | 'NEVEZANO'
  vezavaRazlog: string | null
}

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, nazivProjekta: true },
    })
    assertProjectAccess(auth, project, 'read')

    // Zadnja APPROVED verzija BOM projekta (kanonska osnova nabave, §11).
    // DRAFT/SUPERSEDED verzije NISO osnova — osnutek ni odločitev.
    const verzija = await db.bOMVersion.findFirst({
      where: { bom: { projectId }, status: 'APPROVED' },
      orderBy: { versionNumber: 'desc' },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    })
    if (!verzija) {
      return NextResponse.json(
        {
          error:
            'Projekt nima odobrene BOM verzije — najprej jo ustvarite (POST /api/bom) in odobrite (PATCH /api/bom/[id]) ali zaklenite posel.',
        },
        { status: 404 },
      )
    }

    // Vezane vrstice (EXACT inventarna vezava iz generacije) — samo zanje so
    // dejanske količine znane; nevezane ostanejo NULL (NEVEZANO, §11).
    const vezane = verzija.lines.filter((l) => l.inventoryId !== null)
    const inventoryIds = [...new Set(vezane.map((l) => l.inventoryId!))]

    // 1) StockLedger — nespremenljiva knjiga dogodkov projekta + artikelov
    //    (grupirano po artikelu IN dogodku; predznačene delte).
    const ledger = inventoryIds.length > 0
      ? await db.stockLedger.groupBy({
          by: ['inventoryId', 'eventType'],
          where: { projectId, inventoryId: { in: inventoryIds }, eventType: { in: [...PRESLIKANI_DOGODKI] } },
          _sum: { kolicina: true },
        })
      : []
    // vsota[idx_artikla][dogodek] = predznačena delta (RECEIPT/RETURN/RELEASE
    // pozitivni; RESERVATION/ISSUE/WASTE negativni — kanon inventory.ts).
    const poDogodku = new Map<string, Map<string, number>>()
    for (const row of ledger) {
      const inv = row.inventoryId
      let m = poDogodku.get(inv)
      if (!m) { m = new Map<string, number>(); poDogodku.set(inv, m) }
      m.set(row.eventType, (m.get(row.eventType) ?? 0) + (row._sum.kolicina ?? 0))
    }

    // 2) MaterialOrderItem — postavke naročil PROJEKTA po artikelih (vsi
    //    statusi naročil; vir = naročilna postavka, prejem = RECEIPT dogodek).
    const narocila = inventoryIds.length > 0
      ? await db.materialOrderItem.groupBy({
          by: ['inventoryId'],
          where: { inventoryId: { in: inventoryIds }, order: { projectId } },
          _sum: { kolicina: true },
        })
      : []
    const narocenoPoArtiklu = new Map(narocila.map((r) => [r.inventoryId, r._sum.kolicina ?? 0]))

    // 3) MaterialUsage — kanonski zapis porabe materiala na projektu.
    const poraba = inventoryIds.length > 0
      ? await db.materialUsage.groupBy({
          by: ['inventoryId'],
          where: { projectId, inventoryId: { in: inventoryIds } },
          _sum: { porabljenaKolicina: true },
        })
      : []
    const porabaPoArtiklu = new Map(poraba.map((r) => [r.inventoryId, r._sum.porabljenaKolicina ?? 0]))

    const lines: ProcurementLineDto[] = verzija.lines.map((l) => {
      if (l.inventoryId === null) {
        // NEVEZANO: dejanske količine NEZNANE (NULL — nikoli ničle!), ker
        // noben vir (ledger/naročila/poraba) ni vezan na SKU brez artikla.
        return {
          lineOrder: l.lineOrder,
          quoteLineKey: l.quoteLineKey,
          internalSku: l.internalSku,
          supplierSku: l.supplierSku,
          inventoryId: null,
          category: l.category,
          descriptionSnapshot: l.descriptionSnapshot,
          unit: l.unit,
          plannedQty: l.quantity.toNumber(),
          reservedQty: null,
          orderedQty: null,
          receivedQty: null,
          issuedQty: null,
          consumedQty: null,
          returnedQty: null,
          wastedQty: null,
          variance: null,
          vezava: 'NEVEZANO',
          vezavaRazlog: `internalSku '${l.internalSku}' ni v inventarju (EXACT sifraMateriala ujemanje) — količine so NEZNANE, ne nič.`,
        }
      }
      const dogodki = poDogodku.get(l.inventoryId) ?? new Map<string, number>()
      const delta = (tip: string) => dogodki.get(tip) ?? 0
      const reservedQty = -(delta('RESERVATION') + delta('RELEASE'))
      const receivedQty = delta('RECEIPT')
      const issuedQty = -delta('ISSUE')
      const returnedQty = delta('RETURN')
      const wastedQty = -delta('WASTE')
      const plannedQty = l.quantity.toNumber()
      const consumedQty = porabaPoArtiklu.get(l.inventoryId) ?? 0
      return {
        lineOrder: l.lineOrder,
        quoteLineKey: l.quoteLineKey,
        internalSku: l.internalSku,
        supplierSku: l.supplierSku,
        inventoryId: l.inventoryId,
        category: l.category,
        descriptionSnapshot: l.descriptionSnapshot,
        unit: l.unit,
        plannedQty,
        reservedQty: Math.round(reservedQty * 1000) / 1000,
        orderedQty: Math.round((narocenoPoArtiklu.get(l.inventoryId) ?? 0) * 1000) / 1000,
        receivedQty: Math.round(receivedQty * 1000) / 1000,
        issuedQty: Math.round(issuedQty * 1000) / 1000,
        consumedQty: Math.round(consumedQty * 1000) / 1000,
        returnedQty: Math.round(returnedQty * 1000) / 1000,
        wastedQty: Math.round(wastedQty * 1000) / 1000,
        variance: Math.round((plannedQty - consumedQty - wastedQty + returnedQty) * 1000) / 1000,
        vezava: 'VEZANO',
        vezavaRazlog: null,
      }
    })

    return NextResponse.json({
      projectId,
      bomVersion: {
        id: verzija.id,
        versionNumber: verzija.versionNumber,
        status: verzija.status,
        sourceQuoteVersionId: verzija.sourceQuoteVersionId,
        layoutFingerprint: verzija.layoutFingerprint,
        approvedAt: verzija.approvedAt,
      },
      lines,
      // ISKRENA dokumentacija preslikave (§11 — v odgovoru, ne samo v kodi):
      preslikava: {
        viri: {
          plannedQty: 'BOMLine.quantity (neto količina kanonske BOM verzije)',
          reservedQty: 'StockLedger: −(Σ RESERVATION + Σ RELEASE) — neto rezervirano (RELEASE sprosti rezervacijo)',
          orderedQty: 'MaterialOrderItem: Σ kolicina postavk naročil projekta (vsi statusi naročil)',
          receivedQty: 'StockLedger: Σ RECEIPT dogodkov projekta+artikla',
          issuedQty: 'StockLedger: −Σ ISSUE dogodkov projekta+artikla',
          consumedQty: 'MaterialUsage: Σ porabljenaKolicina projekta+artikla',
          returnedQty: 'StockLedger: Σ RETURN dogodkov projekta+artikla',
          wastedQty: 'StockLedger: −Σ WASTE dogodkov projekta+artikla',
          variance: 'plannedQty − consumedQty − wastedQty + returnedQty (samo VEZANE vrstice)',
        },
        nePreslikano: [
          { tip: 'DAMAGE', razlog: 'Poškodba je ločena kategorija od odpisa (WASTE) — §11 nima polja zanjo.' },
          { tip: 'ADJUSTMENT', razlog: 'Inventurni popravki niso naročilo/poraba/odpis — preslikava bi bila ugibanje.' },
          { tip: 'OPENING', razlog: 'Začetno stanje zaloge ni projektna količina.' },
          { tip: 'PURCHASE', razlog: 'Ročni prihod brez naročila — prejem projekta je RECEIPT.' },
          { tip: 'PROJECT_ALLOCATION', razlog: 'Alokacijska semantika brez nasprotnega dogodka v toku R376 — preslikava v rezervacije bi bila izum.' },
        ],
      },
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('BOM procurement GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju procurement pregleda BOM' }, { status: 500 })
  }
}
