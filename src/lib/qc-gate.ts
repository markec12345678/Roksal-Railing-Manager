/**
 * R146 (issue #5 §27 — Quality control gate): deterministično jedro
 * preverbe kakovosti.
 *
 * §27 zahteva checklist PRED completion/handover: dimensions, anchoring,
 * finish/RAL, components, glass, alignment, safety/compliance, photos,
 * defects, corrective action — + approvedBy/approvedAt. "Completed brez QC
 * samo z explicit audited override" — vrata so v PATCH /api/schedules
 * (ZAKLJUCENO brez prešle preverbe → 409; izrecen qcOverrideReason →
 * revizirano QC_OVERRIDE).
 *
 * Čisto izračunsko jedro (ni baze, ni ure) — isti vzorec kot
 * equipment-lifecycle (R145) in schedule-conflicts (R142). Pravila:
 *   • Predloga je VERSIONIRANA (QC_TEMPLATE_VERSION) — sprememba seznama =
 *     nova verzija; stare vrstice v bazi ostanejo berljive s svojo verzijo.
 *   • itemsJson je strogo validiran: NATANKO ključi predloge (manjkajoč ALI
 *     dodatn ključ → napaka), checked = boolean, opomba OBVEZNA pri
 *     neizpolnjeni postavki (napaka brez korektivnega ukrepa se ne zapiše).
 *   • passed = vse postavke izpolnjene; defectsCount = število
 *     neizpolnjenih — deterministično za iste vhode.
 */

export const QC_TEMPLATE_VERSION = 'qc-v1'

export interface QCTemplateItem {
  key: string
  label: string
}

/**
 * Kontrolni seznam (§27): dimensions → dimenzije, anchoring → sidranje,
 * finish/RAL → zaključek, components → komponente, glass → steklo,
 * alignment → poravnava, safety/compliance → varnost, photos → fotografije,
 * defects → napake, corrective action → korektivni ukrepi.
 */
export const QC_TEMPLATE: readonly QCTemplateItem[] = [
  { key: 'dimenzije', label: 'Dimenzije se ujemajo z merjenjem' },
  { key: 'sidranje', label: 'Sidranje in pritrditve izvedene po navodilih' },
  { key: 'zakljucek_ral', label: 'Zaključek / RAL brez poškodb in prask' },
  { key: 'komponente', label: 'Vse komponente nameščene (ujemanje z BOM)' },
  { key: 'steklo', label: 'Steklo / varovalne plošče pravilno vgrajene' },
  { key: 'poravnava', label: 'Poravnava in razmiki v toleranci' },
  { key: 'varnost', label: 'Varnost / skladnost preverjena' },
  { key: 'fotografije', label: 'Fotografije pred/po zabeležene' },
  { key: 'napake', label: 'Napake / defekti pregledani in zabeleženi' },
  { key: 'korekcija', label: 'Korektivni ukrepi izvedeni ali načrtovani' },
]

const TEMPLATE_KEYS = new Set(QC_TEMPLATE.map((i) => i.key))
const MAX_NOTE = 500

export interface QCItem {
  key: string
  checked: boolean
  note: string | null
}

/** Ali sta dve vrstici QC enakovredni (deterministično za teste/replay). */
export function qcItemsEqual(a: readonly QCItem[], b: readonly QCItem[]): boolean {
  if (a.length !== b.length) return false
  return QC_TEMPLATE.every((t) => {
    const ia = a.find((x) => x.key === t.key)
    const ib = b.find((x) => x.key === t.key)
    return ia && ib && ia.checked === ib.checked && (ia.note ?? null) === (ib.note ?? null)
  })
}

/**
 * Stroga validacija vnosov proti predlogi (fail-closed):
 *   • array, dolžina = dolžina predloge;
 *   • NATANKO en niz na ključ predloge (manjkajoč ALI dodatn → napaka);
 *   • checked = pravi boolean;
 *   • note = null ALI ne-prazen niz ≤ 500 znakov;
 *   • neizpolnjena postavka ZAHTEVA opombo (napaka/korektivni ukrep brez
 *     sledi se ne zapiše — §27 "defects + corrective action").
 * Vrne NOVO polje v vrstnem redu predloge (totalen red, ne vrstni red vnosov).
 */
export function validateQCItems(raw: unknown): { error: string } | { items: QCItem[] } {
  if (!Array.isArray(raw)) return { error: 'items mora biti seznam' }
  if (raw.length !== QC_TEMPLATE.length) {
    return { error: `Pričakovano ${QC_TEMPLATE.length} postavk, prejeto ${raw.length}` }
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
  if (seen.size !== QC_TEMPLATE.length) {
    const missing = QC_TEMPLATE.filter((t) => !seen.has(t.key)).map((t) => t.key)
    return { error: `Manjkajoče postavke: ${missing.join(', ')}` }
  }

  const items: QCItem[] = []
  for (const t of QC_TEMPLATE) {
    const raw = byKey.get(t.key)!
    if (typeof raw.checked !== 'boolean') {
      return { error: `Postavka "${t.label}": checked mora biti boolean` }
    }
    let note: string | null = null
    if (raw.note !== undefined && raw.note !== null && raw.note !== '') {
      if (typeof raw.note !== 'string') {
        return { error: `Opomba pri "${t.label}" ni niz` }
      }
      if (raw.note.trim().length === 0 || raw.note.length > MAX_NOTE) {
        return { error: `Opomba pri "${t.label}" je prazna ali predolga (max ${MAX_NOTE})` }
      }
      note = raw.note.trim()
    }
    if (!raw.checked && note === null) {
      return {
        error: `Postavka "${t.label}" NI izpolnjena — zahteva opombo/korektivni ukrep`,
      }
    }
    items.push({ key: t.key, checked: raw.checked, note })
  }
  return { items }
}

/** Ali je preverba PREŠLA? Deterministično: vse postavke izpolnjene. */
export function computePassed(items: readonly QCItem[]): boolean {
  return items.every((i) => i.checked)
}

/** Število neizpolnjenih postavk (defektov). */
export function countDefects(items: readonly QCItem[]): number {
  return items.filter((i) => !i.checked).length
}

/**
 * Ali je podan veljaven override razlog? (§27: "explicit audited override")
 * Fail-closed: samo ne-prazen niz (po trim), ≤ 500 znakov — prazen/beli
 * prostor ali ne-niz NI razlog.
 */
export function isValidOverrideReason(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim().length > 0 && raw.trim().length <= 500
}
