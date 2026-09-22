// Roksal — ponudba iz razporeda ograje
// ---------------------------------------------------------------------------
// Čista funkcija: `buildQuote(layout, spec, prices)`. Brez baze, brez Next-a,
// brez I/O — zato je enotsko testabilna (src/lib/__tests__/quote.test.ts).
//
// Količine pridejo IZKLJUČNO iz `LayoutResult`, nikoli niso preračunane znova iz
// obsega. To je tisto, kar zagotavlja, da se število panelov v ponudbi, v tlorisu
// in na rezalnem seznamu ne more razhajati: je isti seznam.
//
// Pravilo za odpadek: uporabi se za **rezane profile** (letev, U-profil, palice),
// nikoli za steklo — steklo se naroča po panelih na točno mero, zato je njegov
// "odpadek" že v številu panelov.

import {
  anchorCount,
  cornerCount,
  freeEndCount,
  hasBaseProfile,
  hasGlass,
  hasHandrail,
  hasPosts,
  totalRunMm,
  type CutListRow,
  type LayoutResult,
  type RailingSpec,
  cutList as buildCutList,
} from './railing-layout'

export type BomUnit = 'm' | 'm2' | 'kos' | 'komplet'
export type BomGroup = 'GLASS' | 'PROFILES' | 'POSTS' | 'INFILL' | 'FIXINGS' | 'LABOUR' | 'OTHER'

export const GROUP_LABEL: Record<BomGroup, string> = {
  GLASS: 'Steklo',
  PROFILES: 'Profili in letev',
  POSTS: 'Stebrički in pritrditev',
  INFILL: 'Polnilo',
  FIXINGS: 'Pritrditveni material',
  LABOUR: 'Storitve',
  OTHER: 'Ostalo',
}

export interface QuoteItem {
  code: string
  group: BomGroup
  name: string
  /** Podrobnost pod nazivom: dimenzije, sestava stekla, finish. */
  detail: string
  qty: number
  unit: BomUnit
  unitPrice: number
  total: number
}

export interface Quote {
  items: QuoteItem[]
  materialTotal: number
  labourTotal: number
  smallMaterialTotal: number
  grossTotal: number
  discountAmount: number
  netTotal: number
  vatAmount: number
  total: number
  /** Cena na tekoči meter ograje z DDV — številka, po kateri stranke primerjajo ponudbe. */
  totalPerMetre: number
  currency: string
  cutList: CutListRow[]
  runM: number
}

/**
 * Cenik. Privzete vrednosti so **zgled, ne tržne cene** — zamenjaj jih s cenami
 * svojih dobaviteljev (ali jih beri iz tabele `Profil.cenaM` / `MaterialPrice`).
 */
export interface PriceBook {
  currency: string
  vatPercent: number
  discountPercent: number

  baseProfilePerM: number
  coverRailPerM: number
  roundHandrailPerM: number
  woodHandrailPerM: number

  glassPerM2: number
  polishedEdgePerM: number

  postPerEach: number
  postBasePlatePerEach: number
  postSideBracketPerEach: number
  anchorPerEach: number
  endCapPerEach: number
  cornerElementPerEach: number

  barPerM: number
  meshPerM2: number
  woodPerM2: number
  gasketPerM: number
  siliconeJointPerM: number
  customElementPerEach: number

  demolitionPerM: number
  mountingPerM: number
  transportFlat: number
  surveyFlat: number
  /** Droben montažni material kot odstotek materiala (podložni lističi, čistila, vijaki). */
  smallMaterialPercent: number
}

export function defaultPriceBook(over: Partial<PriceBook> = {}): PriceBook {
  return {
    currency: 'EUR',
    vatPercent: 22,
    discountPercent: 0,

    baseProfilePerM: 46.9,
    coverRailPerM: 19.5,
    roundHandrailPerM: 24.8,
    woodHandrailPerM: 34,

    glassPerM2: 158,
    polishedEdgePerM: 6.5,

    postPerEach: 38.5,
    postBasePlatePerEach: 12.9,
    postSideBracketPerEach: 18.5,
    anchorPerEach: 1.35,
    endCapPerEach: 7.5,
    cornerElementPerEach: 24,

    barPerM: 9.8,
    meshPerM2: 62,
    woodPerM2: 88,
    gasketPerM: 3.4,
    siliconeJointPerM: 2.2,
    customElementPerEach: 95,

    demolitionPerM: 9.5,
    mountingPerM: 38,
    transportFlat: 35,
    surveyFlat: 0,
    smallMaterialPercent: 3,

    ...over,
  }
}

/**
 * Zlije delni cenik s privzetim — samo za znane ključe in samo števila.
 *
 * API ne sme sprejeti poljubnega JSON kot cenik: `{ "vatPercent": "nič" }` ali
 * `{ "total": 1 }` bi sicer prišlo do računanja. Zato beli seznam in preverba
 * tipov; neznani ključi se tiho ignorirajo (starejši klient ne sme podreti rute).
 */
export function mergePriceBook(over: Record<string, unknown> = {}): PriceBook {
  const out: PriceBook = { ...defaultPriceBook() }
  // Beli seznam številskih ključev, izpeljan iz samega cenika — ko dodaš polje,
  // ga ni treba prepisovati še tu.
  const numeric = new Set<string>(
    (Object.keys(out) as Array<keyof PriceBook>).filter((k) => typeof out[k] === 'number') as string[],
  )
  for (const [key, value] of Object.entries(over)) {
    if (key === 'currency') {
      if (typeof value === 'string' && value.length >= 1 && value.length <= 8) out.currency = value
      continue
    }
    if (!numeric.has(key)) continue // neznan ključ: ignoriraj, ne podiraj se
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
    if (Number.isFinite(n) && n >= 0) {
      // Ključ je z belega seznama in vrednost preverjena kot končno nenegativno
      // število, zato je zapis varen. Cast je ozek in na enem mestu.
      ;(out as unknown as Record<string, number>)[key] = n
    }
  }
  return out
}

/** Cena pokrovne letev glede na izbrani tip. */
export function handrailPricePerM(spec: RailingSpec, prices: PriceBook): number {
  switch (spec.handrail.type) {
    case 'WOOD':
      return prices.woodHandrailPerM
    case 'ROUND_42':
    case 'ROUND_48':
      return prices.roundHandrailPerM
    case 'U_COVER_ALU':
    case 'RECT':
      return prices.coverRailPerM
    case 'NONE':
      return 0
  }
}

function handrailName(spec: RailingSpec): string {
  const w = Math.round(spec.handrail.widthMm)
  const h = Math.round(spec.handrail.heightMm)
  switch (spec.handrail.type) {
    case 'NONE':
      return 'Brez letev'
    case 'U_COVER_ALU':
      return `Alu U pokrovna letev ${w} × ${h} mm`
    case 'ROUND_42':
      return 'Pokrovna letev Ø42,4 mm'
    case 'ROUND_48':
      return 'Pokrovna letev Ø48,3 mm'
    case 'RECT':
      return `Pokrovna letev ${w} × ${h} mm`
    case 'WOOD':
      return `Lesena pokrovna letev ${w} × ${h} mm`
  }
}

function money(n: number): number {
  return Math.round(n * 100) / 100
}

/** Zaokroži na mm in združi enake panele v eno postavko — dobavitelj jih tako tudi dela. */
function sizeKey(widthMm: number, heightMm: number): string {
  return `${Math.round(widthMm)}x${Math.round(heightMm)}`
}

/**
 * Sestavi ponudbo.
 *
 * Postopek: najprej zberemo vse postavke, nato **odstranimo tiste z ničelno
 * količino ali ceno**, in šele nato seštevamo. Seštevanje pred filtriranjem bi
 * pomenilo, da je "skupaj" večji od vsote natisnjenih postavk — in to razliko
 * stranka vedno najde.
 */
export function buildQuote(layout: LayoutResult, spec: RailingSpec, prices: PriceBook): Quote {
  const items: QuoteItem[] = []
  const runM = totalRunMm(layout) / 1000
  const waste = 1 + spec.wastePercent / 100

  const push = (
    code: string,
    group: BomGroup,
    name: string,
    detail: string,
    qty: number,
    unit: BomUnit,
    unitPrice: number,
  ) => items.push({ code, group, name, detail, qty, unit, unitPrice, total: money(qty * unitPrice) })

  // ── Steklo ────────────────────────────────────────────────────────────────
  const glass = layout.panels.filter((p) => p.kind === 'GLASS')
  if (glass.length > 0) {
    const groups = new Map<string, typeof glass>()
    for (const p of glass) {
      const key = sizeKey(p.widthMm, p.heightMm)
      const list = groups.get(key)
      if (list) list.push(p)
      else groups.set(key, [p])
    }
    const sorted = [...groups.entries()].sort((a, b) => {
      const [aw, ah] = a[0].split('x').map(Number)
      const [bw, bh] = b[0].split('x').map(Number)
      return bw - aw || bh - ah
    })
    for (const [key, group] of sorted) {
      const [w, h] = key.split('x').map(Number)
      const areaM2 = (w / 1000) * (h / 1000)
      push(
        `STK-${key.replace('x', '-')}`,
        'GLASS',
        `Steklo ${w} × ${h} mm`,
        `${glassComposition(spec)}${spec.glass.type === 'ESG_VSG' || spec.glass.type === 'VSG' ? ', lepljeno' : ''}`,
        group.length,
        'kos',
        money(areaM2 * prices.glassPerM2),
      )
    }
    const perimeterM = glass.reduce((s, p) => s + (2 * (p.widthMm + p.heightMm)) / 1000, 0)
    push(
      'STK-OB',
      'GLASS',
      'Obdelava robov stekla',
      'Brušenje in poliranje po obodu',
      money(perimeterM),
      'm',
      prices.polishedEdgePerM,
    )
  }

  // ── Profili ───────────────────────────────────────────────────────────────
  if (layout.baseProfiles.length > 0) {
    push(
      'U-PROF',
      'PROFILES',
      `Osnovni U-profil ${Math.round(spec.baseProfile.widthMm)} × ${Math.round(spec.baseProfile.heightMm)} mm`,
      `${spec.metalFinishLabel ?? finishLabel(spec)}, s tesnilom in odvodnjavanjem`,
      money(runM * waste),
      'm',
      prices.baseProfilePerM,
    )
  }
  if (hasHandrail(spec) && spec.handrail.type !== 'NONE') {
    const railM = layout.handrails.reduce((s, r) => s + r.lengthMm, 0) / 1000
    push(
      'LETEV',
      'PROFILES',
      handrailName(spec),
      finishLabel(spec),
      money(railM * waste),
      'm',
      handrailPricePerM(spec, prices),
    )
  }

  // ── Stebri ────────────────────────────────────────────────────────────────
  if (hasPosts(spec) && layout.posts.length > 0) {
    push(
      'STEB',
      'POSTS',
      `Stebriček ${postSectionLabel(spec)}`,
      `${finishLabel(spec)}, višina ${Math.round(spec.heightMm)} mm, ${fixingLabel(spec)}`,
      layout.posts.length,
      'kos',
      prices.postPerEach,
    )
    const side = spec.postFixing === 'SIDE_BRACKET'
    push(
      side ? 'NOS-B' : 'NOS-P',
      'POSTS',
      side ? 'Bočni nosilec stebrička' : 'Osnovna plošča stebrička',
      finishLabel(spec),
      layout.posts.length,
      'kos',
      side ? prices.postSideBracketPerEach : prices.postBasePlatePerEach,
    )
  }

  // ── Polnilo ───────────────────────────────────────────────────────────────
  if (layout.bars.length > 0) {
    const barM = layout.bars.reduce((s, r) => s + r.lengthMm, 0) / 1000
    push(
      'PAL',
      'INFILL',
      `Horizontalna palica ${spec.bars.shape === 'ROUND' ? 'Ø' : ''}${spec.bars.diameterMm.toFixed(1)} mm`,
      `${finishLabel(spec)}, ${spec.bars.count} kosov na polje`,
      money(barM * waste),
      'm',
      prices.barPerM,
    )
  }
  const mesh = layout.panels.filter((p) => p.kind === 'MESH')
  if (mesh.length > 0) {
    push(
      'MREZA',
      'INFILL',
      'Mreža / polnilo',
      `${Math.round(mesh[0].widthMm)} × ${Math.round(mesh[0].heightMm)} mm`,
      money(mesh.reduce((s, p) => s + p.areaM2, 0)),
      'm2',
      prices.meshPerM2,
    )
  }
  const wood = layout.panels.filter((p) => p.kind === 'WOOD')
  if (wood.length > 0) {
    push(
      'LES',
      'INFILL',
      'Leseno polnilo',
      `${Math.round(wood[0].widthMm)} × ${Math.round(wood[0].heightMm)} mm`,
      money(wood.reduce((s, p) => s + p.areaM2, 0)),
      'm2',
      prices.woodPerM2,
    )
  }
  const custom = layout.panels.filter((p) => p.kind === 'CUSTOM')
  if (custom.length > 0) {
    push(
      'CUSTOM',
      'INFILL',
      'Element po meri (lasten model)',
      spec.custom.assetName || 'placeholder',
      custom.length,
      'kos',
      prices.customElementPerEach,
    )
  }

  // ── Pritrditveni material ─────────────────────────────────────────────────
  const anchors = anchorCount(layout, spec)
  if (anchors > 0) {
    push(
      'SIDRA',
      'FIXINGS',
      'Sidro / vijak M8–M10',
      spec.mounting === 'SLAB_SIDE' ? 'Bočna montaža, kemijsko sidro' : 'Mehansko sidro v beton',
      anchors,
      'kos',
      prices.anchorPerEach,
    )
  }
  if (glass.length > 0) {
    push(
      'TESNILO',
      'FIXINGS',
      'Tesnilo / podložna letev',
      'EPDM guma za vpenjanje stekla',
      money(runM * waste),
      'm',
      prices.gasketPerM,
    )
    const jointM = Math.max(0, runM - glass.reduce((s, p) => s + p.widthMm / 1000, 0))
    if (jointM > 0.05) {
      push('SILIKON', 'FIXINGS', 'Silikon za steklene fuge', 'Prozoren, UV obstojen', money(jointM), 'm', prices.siliconeJointPerM)
    }
  }
  const corners = cornerCount(layout)
  if (corners > 0 && hasHandrail(spec)) {
    push('KOT', 'FIXINGS', 'Kotni element / varjeni vogal letev', finishLabel(spec), corners, 'kos', prices.cornerElementPerEach)
  }
  const freeEnds = hasHandrail(spec) && spec.handrail.returnsAtEnds ? freeEndCount(layout) : 0
  if (freeEnds > 0) {
    push('KAPICA', 'FIXINGS', 'Zaključna kapica / vračilo letev', finishLabel(spec), freeEnds, 'kos', prices.endCapPerEach)
  }

  // ── Storitve ──────────────────────────────────────────────────────────────
  if (runM > 0.01) {
    if (spec.demolition) {
      push('DEMONT', 'LABOUR', 'Demontaža obstoječe ograje', 'Vključno z odvozom materiala', money(runM), 'm', prices.demolitionPerM)
    }
    if (spec.mountingIncluded) {
      push('MONTAZA', 'LABOUR', 'Montaža in nastavljanje', 'Sidranje, polnilo, letev, čiščenje', money(runM), 'm', prices.mountingPerM)
    }
    if (prices.transportFlat > 0) {
      push('PREVOZ', 'LABOUR', 'Prevoz in logistika', 'Pavšal', 1, 'komplet', prices.transportFlat)
    }
    if (prices.surveyFlat > 0) {
      push('IZMERA', 'LABOUR', 'Izmera na objektu', 'AR izmera in zapisnik', 1, 'komplet', prices.surveyFlat)
    }
  }

  // ── Seštevki ──────────────────────────────────────────────────────────────
  const priced = items.filter((i) => i.qty > 0 && i.total > 0.005)
  const materialTotal = money(priced.filter((i) => i.group !== 'LABOUR' && i.group !== 'OTHER').reduce((s, i) => s + i.total, 0))
  const labourTotal = money(priced.filter((i) => i.group === 'LABOUR').reduce((s, i) => s + i.total, 0))
  const smallMaterialTotal = money((materialTotal * prices.smallMaterialPercent) / 100)

  if (smallMaterialTotal > 0.01) {
    priced.push({
      code: 'DROBNI',
      group: 'OTHER',
      name: 'Droben montažni material',
      detail: `Podložni lističi, čistila, vijaki — ${prices.smallMaterialPercent.toFixed(1)} % materiala`,
      qty: 1,
      unit: 'komplet',
      unitPrice: smallMaterialTotal,
      total: smallMaterialTotal,
    })
  }

  const grossTotal = money(priced.reduce((s, i) => s + i.total, 0))
  const discountAmount = money((grossTotal * prices.discountPercent) / 100)
  const netTotal = money(grossTotal - discountAmount)
  const vatAmount = money((netTotal * prices.vatPercent) / 100)
  const total = money(netTotal + vatAmount)

  return {
    items: priced,
    materialTotal,
    labourTotal,
    smallMaterialTotal,
    grossTotal,
    discountAmount,
    netTotal,
    vatAmount,
    total,
    totalPerMetre: runM > 0.01 ? money(total / runM) : 0,
    currency: prices.currency,
    cutList: buildCutList(layout),
    runM: money(runM),
  }
}

// ── Poimenovanja (slovenska, neodvisna od locale-a) ───────────────────────────

function num(value: number, decimals = 0): string {
  const f = Math.pow(10, decimals)
  const rounded = Math.round(value * f) / f
  const [i, d] = rounded.toFixed(decimals).split('.')
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return d ? `${grouped},${d}` : grouped
}

/** `ESG/VSG 8,0+8,0 (16,76 mm)` — sestava, kot jo dobavitelj stekla prebere. */
export function glassComposition(spec: RailingSpec): string {
  const laminated = spec.glass.type === 'VSG' || spec.glass.type === 'ESG_VSG'
  const single = laminated ? (spec.glass.thicknessMm - 0.76) / 2 : spec.glass.thicknessMm
  const t = num(spec.glass.thicknessMm, 2)
  const s = num(single, 1)
  switch (spec.glass.type) {
    case 'ESG':
      return `ESG ${t} mm`
    case 'VSG':
      return `VSG ${s}+${s} (${t} mm)`
    case 'ESG_VSG':
      return `ESG/VSG ${s}+${s} (${t} mm)`
  }
}

export function postSectionLabel(spec: RailingSpec): string {
  const s = spec.postSection
  return s.shape === 'ROUND' ? `Ø${num(s.widthMm, 1)} mm` : `${num(s.widthMm)} × ${num(s.depthMm)} mm`
}

export function fixingLabel(spec: RailingSpec): string {
  switch (spec.postFixing) {
    case 'BASE_PLATE':
      return 'osnovna plošča + sidra'
    case 'SIDE_BRACKET':
      return 'bočni nosilec'
    case 'CORE_DRILLED':
      return 'vrtano v beton (jedro)'
  }
}

/**
 * Finish kot besedilo. `RailingSpec` v `railing-layout.ts` nima barvnega polja
 * (geometrija je ne potrebuje), zato ponudba sprejme `metalFinishLabel` iz
 * kataloga ali uporabi privzeto besedilo.
 */
export function finishLabel(spec: RailingSpec): string {
  return spec.metalFinishLabel ?? 'po izbiri (alu / inox)'
}

/** Ali je sistem steklen — za prikaz v vmesniku. */
export function isGlassSystem(spec: RailingSpec): boolean {
  return hasGlass(spec)
}

/** Ali sistem potrebuje osnovni profil. */
export function usesBaseProfile(spec: RailingSpec): boolean {
  return hasBaseProfile(spec)
}

/** Povzetek za glavo ponudbe. */
export function quoteSummary(layout: LayoutResult, spec: RailingSpec, quote: Quote) {
  return {
    runM: quote.runM,
    heightMm: spec.heightMm,
    postCount: layout.posts.length,
    panelCount: layout.panels.length,
    glassAreaM2: Math.round(layout.panels.filter((p) => p.kind === 'GLASS').reduce((s, p) => s + p.areaM2, 0) * 100) / 100,
    anchors: anchorCount(layout, spec),
    corners: cornerCount(layout),
    total: quote.total,
    totalPerMetre: quote.totalPerMetre,
    currency: quote.currency,
    lines: quote.items.length,
  }
}
