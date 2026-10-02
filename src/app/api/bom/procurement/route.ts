// R376 (issue #13, korak R166 iz §11) — API: PROCUREMENT/INVENTORY NAD BOM.
// R378 (korak R167 iz §9) — razširitev o količinski verigi QUOTE → BOM →
// PRODUCTION → INSTALLATION: po vrstici DODANI polji producedQty (Σ izdelano
// prek proizvodnih nalogov) in installedQty (Σ vgrajeno prek POTRJENIH
// as-installed zapisov) — odgovor je SAMO DODATEN (additiven), vsa obstoječa
// polja R376 ostajajo bajtno združljiva.
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
// R378 §9 VERIGA (DODATNO, additivno — dokumentirano v preslikava.viri):
//   producedQty  = Σ ProductionOrderLine.producedQty VSEH nalogov nad TO
//                  BOM vrstico (BREZ statusnega filtriranja naročil — števec
//                  živi na VRSTICI, ne na statusu naročila; pravilo »štejejo
//                  samo PRODUCED nalogi« bi bila izumljena pravila, ki bi
//                  tiho izbrisala fizično izdelano proti nalogom v
//                  REWORK/REPLACED);
//   installedQty = Σ InstallationRecordLine.installedQty SAMO POTRJENIH
//                  zapisov (status POTRJENO — DRAFT NI resnica: osnutek je
//                  lahko v pisanju/popravku in njegove količine morajo
//                  OSTATI NEVIDNE za verigo, sicer bi osnutek postal
//                  »tretja resnica«, preden ga kdo potrdi).
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
//     bila laž »ni se nič zgodilo«), vezava = 'NEVEZANO' + razlog. To velja
//     tudi za producedQty/installedQty (R378): nevezana vrstica je IZVEN
//     nadzorne verige §9 — količinska veriga nad nevezanim materialom ni
//     DOKAZLJIVA, zato iskreno NULL (konsistentno z družino dejanskih
//     količin, NIKOLI ničle).
//   • Ni APPROVED verzije → 404 (fail-closed: prazen odgovor bi bil tiha
//     zamenjava za manjkajočo odločitev — najprej odobrite BOM).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import { zaokroziKolicino } from '@/lib/decimal-policy'

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
  /** R378 §9: Σ izdelano iz VSEH proizvodnih nalogov nad vrstico (NULL nevezano). */
  producedQty: number | null
  /** R378 §9: Σ vgrajeno iz POTRJENIH as-installed zapisov (NULL nevezano). */
  installedQty: number | null
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
      // R380 (§12): _sum.kolicina je Decimal — prehod v number na tej meji.
      m.set(row.eventType, (m.get(row.eventType) ?? 0) + (row._sum.kolicina?.toNumber() ?? 0))
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
    const narocenoPoArtiklu = new Map(narocila.map((r) => [r.inventoryId, r._sum.kolicina?.toNumber() ?? 0]))

    // 3) MaterialUsage — kanonski zapis porabe materiala na projektu.
    const poraba = inventoryIds.length > 0
      ? await db.materialUsage.groupBy({
          by: ['inventoryId'],
          where: { projectId, inventoryId: { in: inventoryIds } },
          _sum: { porabljenaKolicina: true },
        })
      : []
    const porabaPoArtiklu = new Map(poraba.map((r) => [r.inventoryId, r._sum.porabljenaKolicina?.toNumber() ?? 0]))

    // 4) R378 §9 — PRODUCTION: Σ producedQty VSEH proizvodnih vrstic nad
    //    vrsticami TE verzije (števec živi na VRSTICI — brez statusnega
    //    filtriranja naročil, izumljena pravila so izum). Vezava je EXACT:
    //    bomLineId pripada NATANKO tej verziji (BOMLine → ena verzija).
    const bomLineIds = verzija.lines.map((l) => l.id)
    const izdelano = bomLineIds.length > 0
      ? await db.productionOrderLine.groupBy({
          by: ['bomLineId'],
          where: { bomLineId: { in: bomLineIds } },
          _sum: { producedQty: true },
        })
      : []
    const izdelanoPoVrstici = new Map(izdelano.map((r) => [r.bomLineId, r._sum.producedQty?.toNumber() ?? 0]))

    // 5) R378 §9 — INSTALLATION: Σ installedQty vrstic SAMO POTRJENIH
    //    zapisov (DRAFT NI resnica — ne šteje; test r378-quantity-chain
    //    DOKAZUJE to izključitev). Vezava prav tako EXACT prek bomLineId
    //    (vrstica zapisa pripada vrstici TE verzije — store to zagotavlja).
    const vgrajeno = bomLineIds.length > 0
      ? await db.installationRecordLine.groupBy({
          by: ['bomLineId'],
          where: { bomLineId: { in: bomLineIds }, installationRecord: { status: 'POTRJENO' } },
          _sum: { installedQty: true },
        })
      : []
    const vgrajenoPoVrstici = new Map(vgrajeno.map((r) => [r.bomLineId, r._sum.installedQty?.toNumber() ?? 0]))

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
          // R378: §9 veriga nad nevezanim materialom ni dokazljiva — NULL
          // (konsistentno z družino dejanskih količin, NIKOLI ničle).
          producedQty: null,
          installedQty: null,
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
        // R380 (§12): lokalni Math.round(*1000)/1000 ad-hoc iz float ere
        // ZAMENJAN z centralno politiko (3 decimalke, eksaktno half-up).
        reservedQty: zaokroziKolicino(reservedQty),
        orderedQty: zaokroziKolicino(narocenoPoArtiklu.get(l.inventoryId) ?? 0),
        receivedQty: zaokroziKolicino(receivedQty),
        issuedQty: zaokroziKolicino(issuedQty),
        consumedQty: zaokroziKolicino(consumedQty),
        returnedQty: zaokroziKolicino(returnedQty),
        wastedQty: zaokroziKolicino(wastedQty),
        // R378 §9 veriga: izdelano (VSI nalogi nad vrstico) + vgrajeno
        // (SAMO POTRJENI zapisi — DRAFT ne šteje).
        producedQty: zaokroziKolicino(izdelanoPoVrstici.get(l.id) ?? 0),
        installedQty: zaokroziKolicino(vgrajenoPoVrstici.get(l.id) ?? 0),
        variance: zaokroziKolicino(plannedQty - consumedQty - wastedQty + returnedQty),
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
          // R378 §9 — količinska veriga QUOTE → BOM → PRODUCTION → INSTALLATION:
          producedQty: 'ProductionOrderLine: Σ producedQty VSEH nalogov nad vrstico (brez statusnega filtriranja — števec živi na vrstici)',
          installedQty: 'InstallationRecordLine: Σ installedQty SAMO POTRJENIH zapisov (DRAFT ni resnica — ne šteje)',
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
