// R283 (issue #15 §3) — pokritost virov vidnega seznama meritev.
// EN VIR resnice: filteredMeasurements (ISTI vidni seznam kot R269 mini
// + R282 sync mini — WYSIWYG). Zaprta množica virov = AR_SESSION_SOURCES
// iz skupnega kontrakta (issue #17 B) — ISTA množica kot MERITEV_VIR_LABELS
// (vir = strežniško IZPELJAN izvor, klient ga ne more podati — R276 kanon).
// Fail-closed: vrstice brez prepoznanega viroma se NE štejejo (nikoli
// ugibanje); NULL = nobena vidna vrstica NE nosi prepoznanega viroma →
// klicatelj vrstico NE rendera (iskrena praznina — nikoli izumljen števec).
// ČISTA funkcija — brez stranskih učinkov, vhod NI mutiran (kanon kontrakta).
import { AR_SESSION_SOURCES } from '@/lib/ar-contract'

/** Vrstica, ki lahko nosi strežniško izpeljan vir (null/neznan = ne šteje se). */
export interface MeritveVirVrstica {
  vir?: string | null
}

export interface MeritveVirPregled {
  manual: number
  photoCv: number
  arcoreDepth: number
  /** Število vrstic s PREPOZNANIM virom (neznan/izostanek se ne šteje). */
  skupaj: number
  /** true = vse tri vrste prisotne v vidnem seznamu (issue #15 §3:
   *  isti test prek manual + PHOTO_CV + ARCORE_DEPTH). Delna pokritost
   *  NI napaka — samo opozorilo za terensko validacijo (issue #15). */
  popolnaPokritost: boolean
}

export function izracunajMeritveVirPregled(
  vrstice: readonly MeritveVirVrstica[],
): MeritveVirPregled | null {
  const prepoznane = vrstice.filter(
    (m): m is MeritveVirVrstica & { vir: string } =>
      m.vir != null && (AR_SESSION_SOURCES as readonly string[]).includes(m.vir),
  )
  if (prepoznane.length === 0) return null
  const stevec = (vir: string) => prepoznane.filter((m) => m.vir === vir).length
  const manual = stevec('MANUAL')
  const photoCv = stevec('PHOTO_CV')
  const arcoreDepth = stevec('ARCORE_DEPTH')
  return {
    manual,
    photoCv,
    arcoreDepth,
    skupaj: prepoznane.length,
    popolnaPokritost: manual > 0 && photoCv > 0 && arcoreDepth > 0,
  }
}
