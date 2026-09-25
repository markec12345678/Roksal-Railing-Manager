/**
 * R147 (issue #5 §28 — Structured installation evidence): deterministično
 * jedro montažnega dokazila.
 *
 * §28 zahteva shranjevanje: before/after, location, timestamp, actor,
 * project, GPS po policyju, checklist, measurement evidence, material
 * consumption, defects, handover evidence.
 *
 * Pravila (isti vzorec kot qc-gate.ts R146):
 *   • Predloga checklist je VERSIONIRANA (IEV_TEMPLATE_VERSION) — sprememba
 *     seznama = nova verzija; stare vrstice ostanejo berljive s svojo verzijo.
 *   • checklistJson je strogo validiran: NATANKO ključi predloge, checked =
 *     boolean, opomba OBVEZNA pri neizpolnjeni postavki (napaka brez
 *     korektivnega ukrepa se ne zapiše).
 *   • GPS po policyju: koordinate se sprejmejo IZKLJUČNO skupaj z izrecnim
 *     dovoljenjem (gpsConsent) — brez soglasja je vnos z GPS napaka (ne tiho
 *     odstranjevanje); s soglasjem strežnik zabeleži gpsConsentAt = čas.
 *   • Poraba materiala se NE shrani iz klienta — GET jo izvede s strežnika
 *     iz StockLedger (deterministični agregat po artikel).
 *   • defectsJson je strogo validirana lista { opomba, reseno } (≤ 20).
 *   • Dokaz predaje (handover) zaklene dokazilo — locked je deterministična
 *     funkcija zapisa (handoverAt != null).
 *   • Polnost dokazila (complete) je čista funkcija: pred + po + checklist
 *     brez napak + predaja. Nič ni "skoraj" — ali je polno ali ni.
 */

export const IEV_TEMPLATE_VERSION = 'iev-v1'

export interface IEVTemplateItem {
  key: string
  label: string
}

/**
 * Kontrolni seznam montažnega dokazila (§28 področja, delovni jezik):
 * pred/po fotografije, lokacija, material, meritve, napake, čiščenje, predaja.
 */
export const IEV_TEMPLATE: readonly IEVTemplateItem[] = [
  { key: 'pred_foto', label: 'Fotografija PRED začetkom dela zabeležena' },
  { key: 'po_foto', label: 'Fotografija PO zaključku zabeležena' },
  { key: 'lokacija', label: 'Lokacija montaže zabeležena (naslov/objekt)' },
  { key: 'material', label: 'Porabljen material odštet prek zaloge' },
  { key: 'meritve', label: 'Merilni dokaz povezan ali izrecno ni potreben' },
  { key: 'napake', label: 'Napake / defekti pregledani in zabeleženi' },
  { key: 'ciscenje', label: 'Lokacija očiščena in urejena' },
  { key: 'predaja', label: 'Delo predstavljeno stranki / predano' },
]

const TEMPLATE_KEYS = new Set(IEV_TEMPLATE.map((i) => i.key))
const MAX_NOTE = 500
const MAX_LOCATION = 300
const MAX_DEFECTS = 20
/** §17 vzorec: stropi preprečujejo patološke vnose. */
const MAX_GPS_ABS = 180

export interface IEVItem {
  key: string
  checked: boolean
  note: string | null
}

export interface IEVDefect {
  opomba: string
  reseno: boolean
}

/** Ali sta dve vrstici checklist enakovredni (deterministično za teste). */
export function ievItemsEqual(a: readonly IEVItem[], b: readonly IEVItem[]): boolean {
  if (a.length !== b.length) return false
  return IEV_TEMPLATE.every((t) => {
    const ia = a.find((x) => x.key === t.key)
    const ib = b.find((x) => x.key === t.key)
    return ia && ib && ia.checked === ib.checked && (ia.note ?? null) === (ib.note ?? null)
  })
}

/**
 * Stroga validacija checklist vnosa proti predlogi (fail-closed):
 *   • array, dolžina = dolžina predloge;
 *   • NATANKO en niz na ključ predloge (manjkajoč ALI dodatn → napaka);
 *   • checked = pravi boolean;
 *   • note = null ALI ne-prazen niz ≤ 500 znakov;
 *   • neizpolnjena postavka ZAHTEVA opombo.
 * Vrne NOVO polje v vrstnem redu predloge (totalen red, ne vrstni red vnosov).
 */
export function validateIEVChecklist(raw: unknown): { error: string } | { items: IEVItem[] } {
  if (!Array.isArray(raw)) return { error: 'checklist mora biti seznam' }
  if (raw.length !== IEV_TEMPLATE.length) {
    return { error: `Pričakovano ${IEV_TEMPLATE.length} postavk, prejeto ${raw.length}` }
  }
  const seen = new Set<string>()
  const byKey = new Map<string, { checked: unknown; note: unknown }>()
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) return { error: 'Neveljavna postavka' }
    const e = entry as Record<string, unknown>
    const key = typeof e.key === 'string' ? e.key : null
    if (!key || !TEMPLATE_KEYS.has(key)) return { error: `Neznana postavka: ${String(key)}` }
    if (seen.has(key)) return { error: `Podvojena postavka: ${key}` }
    seen.add(key)
    byKey.set(key, { checked: e.checked, note: e.note })
  }
  if (seen.size !== IEV_TEMPLATE.length) {
    const missing = IEV_TEMPLATE.filter((t) => !seen.has(t.key)).map((t) => t.key)
    return { error: `Manjkajoče postavke: ${missing.join(', ')}` }
  }

  const items: IEVItem[] = []
  for (const t of IEV_TEMPLATE) {
    const entry = byKey.get(t.key)!
    if (typeof entry.checked !== 'boolean') return { error: `Neveljavna vrednost checked pri ${t.key}` }
    let note: string | null = null
    if (entry.note !== null && entry.note !== undefined) {
      if (typeof entry.note !== 'string') return { error: `Neveljavna opomba pri ${t.key}` }
      const trimmed = entry.note.trim()
      if (trimmed.length === 0) return { error: `Prazna opomba pri ${t.key} — odstranite ALI zapišite korektivni ukrep` }
      if (trimmed.length > MAX_NOTE) return { error: `Opomba pri ${t.key} presega ${MAX_NOTE} znakov` }
      note = trimmed
    }
    if (!entry.checked && !note) {
      return { error: `Neizpolnjena postavka »${t.label}« zahteva opombo (napaka brez korektivnega ukrepa se ne zapiše)` }
    }
    items.push({ key: t.key, checked: entry.checked, note })
  }
  return { items }
}

/**
 * Stroga validacija napak (fail-closed): vsaka napaka ima ne-prazno opombo
 * (≤ 500) + reseno boolean. Strop ${MAX_DEFECTS} vrstic. Vrne novo polje v
 * vhodnem redu (napaka je seznam dejstev — red ohranja pripombe terenskega
 * delavca, razlikuje se od checklist, ki je totalen red predloge).
 */
export function validateIEVDefects(raw: unknown): { error: string } | { defects: IEVDefect[] } {
  if (raw === null || raw === undefined) return { defects: [] }
  if (!Array.isArray(raw)) return { error: 'defects mora biti seznam' }
  if (raw.length > MAX_DEFECTS) return { error: `Največ ${MAX_DEFECTS} napak na dokazilo` }
  const defects: IEVDefect[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) return { error: 'Neveljavna napaka' }
    const e = entry as Record<string, unknown>
    const opomba = typeof e.opomba === 'string' ? e.opomba.trim() : ''
    if (opomba.length === 0) return { error: 'Napaka brez opombe se ne zapiše' }
    if (opomba.length > MAX_NOTE) return { error: `Opomba napake presega ${MAX_NOTE} znakov` }
    if (typeof e.reseno !== 'boolean') return { error: 'Napaka zahteva reseno = boolean' }
    defects.push({ opomba, reseno: e.reseno })
  }
  return { defects }
}

/**
 * GPS po policyju (fail-closed, ne tiho):
 *   • soglasje = pravi boolean (obvezen vhod — ni privzetka);
 *   • koordinate brez soglasja → napaka (odstranjevanje bi utihnilo izgubo);
 *   • soglasje brez OBEH koordinat → napaka (prazna obljuba);
 *   • koordinate morajo biti zanesljivi številski obseg (lat ∈ [-90, 90],
 *     lng ∈ [-180, 180]) in ne NaN/Infinity.
 * Vrne determinističen zapis GPS ali null.
 */
export function validateIEVGps(
  raw: { gpsConsent: unknown; gpsLat: unknown; gpsLng: unknown } | null | undefined,
): { error: string } | { gps: { gpsLat: number | null; gpsLng: number | null; withConsent: boolean } } {
  if (!raw) return { gps: { gpsLat: null, gpsLng: null, withConsent: false } }
  const consent = raw.gpsConsent
  if (typeof consent !== 'boolean') {
    return { error: 'gpsConsent je obvezen (izrecno dovoljenje ali izrecna zavrnitev)' }
  }
  const lat = raw.gpsLat
  const lng = raw.gpsLng
  const hasCoords = lat !== null && lat !== undefined && lng !== null && lng !== undefined

  if (!consent) {
    if (hasCoords) {
      return { error: 'GPS koordinate brez izrecnega dovoljenja se ne zapišejo — potrdite soglasje ALI odstranite koordinate' }
    }
    return { gps: { gpsLat: null, gpsLng: null, withConsent: false } }
  }

  if (!hasCoords) {
    return { error: 'Soglasje k GPS brez koordinat ni veljaven zapis' }
  }
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: 'GPS koordinate morajo biti veljavna števila' }
  }
  if (Math.abs(lat) > 90) return { error: 'GPS širina izven obsega [-90, 90]' }
  if (Math.abs(lng) > MAX_GPS_ABS) return { error: 'GPS dolžina izven obsega [-180, 180]' }
  return { gps: { gpsLat: lat, gpsLng: lng, withConsent: true } }
}

/** Lokacija (§28): obvezna, ne-prazna, ≤ 300 znakov. */
export function validateIEVLocation(raw: unknown): { error: string } | { lokacija: string } {
  if (typeof raw !== 'string') return { error: 'lokacija je obvezna' }
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { error: 'lokacija ne sme biti prazna' }
  if (trimmed.length > MAX_LOCATION) return { error: `lokacija presega ${MAX_LOCATION} znakov` }
  return { lokacija: trimmed }
}

export interface IEVDerivedFlags {
  hasBefore: boolean
  hasAfter: boolean
  checklistAllChecked: boolean
  openDefectsCount: number
  defectsCount: number
  handoverDone: boolean
  /** Polno dokazilo = pred + po + checklist brez odprtih postavk + predaja. */
  complete: boolean
  /** Zaklenjeno = potrjena predaja — nič več ni spreminljivo. */
  locked: boolean
}

/**
 * Deterministične izpeljane zastavice (strežnik ne zaupa klientu):
 * checklist JSON je že validiran ob zapisu — tukaj samo branje z iskrenim
 * "neznan red" odpadom (pokvarjen JSON pomeni false, ne ugibanja).
 */
export function computeIEVFlags(input: {
  beforePhotoId: string | null
  afterPhotoId: string | null
  checklistJson: string
  defectsJson: string
  handoverAt: Date | null
  now: Date
}): IEVDerivedFlags {
  let checklistAllChecked = false
  try {
    const parsed = JSON.parse(input.checklistJson) as IEVItem[]
    checklistAllChecked =
      Array.isArray(parsed) && parsed.length === IEV_TEMPLATE.length && parsed.every((i) => i.checked === true)
  } catch {
    checklistAllChecked = false
  }
  let defects: IEVDefect[] = []
  try {
    const parsed = JSON.parse(input.defectsJson) as IEVDefect[]
    if (Array.isArray(parsed)) {
      defects = parsed.filter((d) => d && typeof d.opomba === 'string' && typeof d.reseno === 'boolean')
    }
  } catch {
    defects = []
  }
  const openDefectsCount = defects.filter((d) => !d.reseno).length
  const hasBefore = input.beforePhotoId !== null
  const hasAfter = input.afterPhotoId !== null
  const handoverDone = input.handoverAt !== null
  const complete = hasBefore && hasAfter && checklistAllChecked && handoverDone
  return {
    hasBefore,
    hasAfter,
    checklistAllChecked,
    openDefectsCount,
    defectsCount: defects.length,
    handoverDone,
    complete,
    locked: input.handoverAt !== null,
  }
}
