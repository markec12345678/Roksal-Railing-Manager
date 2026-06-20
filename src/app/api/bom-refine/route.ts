// Roksal Field - API: BOM Refine (V5)
// Iz BOM draft (V4.1) → optimiziran nakup z najboljšimi cenami
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface BomDraftItem {
  kategorija: string
  naziv: string
  kolicina: number
  enota: string
  opomba?: string
}

// GET — pridobi BOM draft z optimizacijo cen
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { bomDraftJson: true, dealLocked: true, nazivProjekta: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }

    if (!project.bomDraftJson) {
      return NextResponse.json({
        bomDraft: null,
        message: 'BOM draft še ni generiran. Zakleni deal po podpisu (V4.1).',
      })
    }

    const bomDraft = JSON.parse(project.bomDraftJson) as { items: BomDraftItem[]; projectName: string; quoteTotal: number }

    // Pridobi vse inventarne artikle
    const inventories = await db.inventory.findMany({
      include: {
        prices: {
          where: { veljavnostDo: null },
          include: { supplier: true },
          orderBy: { cena: 'asc' },
        },
      },
    })

    // Poveži BOM draft artikle z inventarjem + najdi najboljšo ceno
    const refinedItems = bomDraft.items.map((bomItem) => {
      // Poisci inventory po nazivu/kategoriji (fuzzy match)
      const matched = inventories.find(
        (inv) =>
          inv.naziv.toLowerCase().includes(bomItem.naziv.toLowerCase().split(' ')[0]) ||
          inv.tip.toLowerCase().includes(bomItem.kategorija.toLowerCase())
      )

      const bestPrice = matched?.prices[0]
      const allPrices = matched?.prices || []

      return {
        bomItem,
        inventory: matched || null,
        bestPrice: bestPrice ? { cena: bestPrice.cena, supplier: bestPrice.supplier.naziv, supplierId: bestPrice.supplierId } : null,
        allPrices: allPrices.map((p) => ({ cena: p.cena, supplier: p.supplier.naziv, supplierId: p.supplierId })),
        razlikaCen: allPrices.length > 1 ? allPrices[0].cena - allPrices[allPrices.length - 1].cena : 0,
        skupajCena: bestPrice ? bestPrice.cena * bomItem.kolicina : 0,
      }
    })

    // Optimizacija — grupta po dobavitelju za najnižjo skupno ceno
    const bySupplier = new Map<string, { supplierId: string; supplier: string; items: typeof refinedItems; skupaj: number }>()
    for (const item of refinedItems) {
      if (!item.bestPrice) continue
      const key = item.bestPrice.supplierId
      if (!bySupplier.has(key)) {
        bySupplier.set(key, { supplierId: key, supplier: item.bestPrice.supplier, items: [], skupaj: 0 })
      }
      const entry = bySupplier.get(key)!
      entry.items.push(item)
      entry.skupaj += item.skupajCena
    }

    const optimizacija = Array.from(bySupplier.values()).sort((a, b) => a.skupaj - b.skupaj)

    const skupajCena = refinedItems.reduce((sum, i) => sum + i.skupajCena, 0)
    const skupajPrihranek = refinedItems.reduce((sum, i) => sum + i.razlikaCen * i.bomItem.kolicina, 0)

    return NextResponse.json({
      projectId,
      projectName: project.nazivProjekta,
      dealLocked: project.dealLocked,
      bomDraft,
      refinedItems,
      optimizacija,
      skupajCena,
      skupajPrihranek,
      matchedCount: refinedItems.filter((i) => i.inventory).length,
      totalCount: refinedItems.length,
    })
  } catch (error) {
    console.error('BOM Refine GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri optimizaciji BOM' }, { status: 500 })
  }
}

// POST — pretvori BOM draft v naročilo pri najboljšem dobavitelju
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId, supplierId } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    // Pridobi refined BOM
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { bomDraftJson: true },
    })

    if (!project?.bomDraftJson) {
      return NextResponse.json({ error: 'BOM draft ne obstaja' }, { status: 400 })
    }

    const bomDraft = JSON.parse(project.bomDraftJson) as { items: BomDraftItem[] }

    // Pridobi inventory + cene
    const inventories = await db.inventory.findMany({
      include: {
        prices: {
          where: { veljavnostDo: null, ...(supplierId ? { supplierId } : {}) },
          orderBy: { cena: 'asc' },
        },
      },
    })

    // Pripravi postavke naročila
    const orderItems: Array<{ inventoryId: string; kolicina: number; cena: number }> = []
    for (const bomItem of bomDraft.items) {
      const matched = inventories.find(
        (inv) =>
          inv.naziv.toLowerCase().includes(bomItem.naziv.toLowerCase().split(' ')[0]) ||
          inv.tip.toLowerCase().includes(bomItem.kategorija.toLowerCase())
      )
      if (matched && matched.prices[0]) {
        orderItems.push({
          inventoryId: matched.id,
          kolicina: bomItem.kolicina,
          cena: matched.prices[0].cena,
        })
      }
    }

    if (orderItems.length === 0) {
      return NextResponse.json({ error: 'Ni najdenih materialov za naročilo' }, { status: 400 })
    }

    // Določi dobavitelja (najboljši ali izbran)
    const targetSupplierId = supplierId || inventories.find((i) => i.prices[0])?.prices[0]?.supplierId
    if (!targetSupplierId) {
      return NextResponse.json({ error: 'Ni dobavitelja' }, { status: 400 })
    }

    // Ustvari naročilo preko material-orders API-ja
    const orderRes = await fetch(`http://127.0.0.1:3000/api/material-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        supplierId: targetSupplierId,
        items: orderItems,
        opombe: 'Avtomatsko iz BOM draft (V5)',
      }),
    })

    const order = await orderRes.json()

    return NextResponse.json({
      success: true,
      order,
      message: `Naročilo ustvarjeno pri ${order.supplier?.naziv || 'dobavitelju'} · ${orderItems.length} artiklov · ${order.skupajCena?.toFixed(2)} €`,
    })
  } catch (error) {
    console.error('BOM Refine POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri pretvorbi BOM v naročilo' }, { status: 500 })
  }
}
