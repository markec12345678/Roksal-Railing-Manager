// R340 — dekompozicija measurements-tab FAZA 4 (KOLIZIJA #14: delta prenesena s R339): izluščeno iz
// measurements-tab.tsx BREZ spremembe obnašanja (čist premik, vzorec
// R319/R325/R338). Telo funkcije je premaknjeno VERBATIM z originalnimi
// komentarji (R-številke = institucionalni spomin); edini spremembi sta
// izrecni `export` in dvig import vrstic na vrh datoteke (struktura,
// ne vsebina).
//
// normalizeMeasurements — normalizacija surovih API vrstic v Measurement
// (spoji arMetadata fallback po poljih; strežnik ostaja vir resnice za
// status — glej komentar R153 v telesu).
// getQuickSpacing — hiter izračun razmika letvic za diagram (čista
// funkcija, brez stanja).

import { parseArMetadata } from './format'
import type { Measurement } from './shared'

export function normalizeMeasurements(raw: unknown[]): Measurement[] {
  return raw.map((item) => {
    const m = item as Measurement
    const ar = parseArMetadata(m.arMetadata)
    return {
      ...m,
      lokacija: m.lokacija ?? ar.lokacija ?? null,
      steviloStebrov: m.steviloStebrov ?? ar.steviloStebrov ?? null,
      tipPodlage: m.tipPodlage ?? ar.tipPodlage ?? null,
      kot: m.kot ?? ar.kot ?? null,
      opombe: m.opombe ?? ar.opombe ?? null,
      tipMeritve: ar.tipMeritve,
      oznaka: ar.oznaka,
      segmentId: ar.segmentId,
      opomba: ar.opomba,
      // R153: status pride iz baze (stolpec status) — strežnik je vir
      // resnice; arMetadata.status samo za star vnose brez stolpca.
      status: m.status ?? ar.status ?? 'OSNUTEK',
      kotStopinje: m.kotStopinje ?? ar.kotStopinje ?? null,
      // P3 — enote
      enota: ar.enota ?? m.enota,
      originalnaVrednost: ar.originalnaVrednost ?? m.originalnaVrednost,
      // P3 — kotomer
      notranjiKot: ar.notranjiKot ?? m.notranjiKot ?? null,
      zunanjiKot: ar.zunanjiKot ?? m.zunanjiKot ?? null,
      // P3 — štebricki
      tipStebra: ar.tipStebra ?? m.tipStebra,
      materialStebra: ar.materialStebra ?? m.materialStebra,
      visinaStebraMm: ar.visinaStebraMm ?? m.visinaStebraMm ?? null,
      pozicijaMm: ar.pozicijaMm ?? m.pozicijaMm ?? null,
      razmikMm: ar.razmikMm ?? m.razmikMm ?? null,
      steberOznaka: ar.steberOznaka ?? m.steberOznaka,
      // P3 — WPC palice
      orientacijaPalic: ar.orientacijaPalic ?? m.orientacijaPalic,
      sirinaPalice: ar.sirinaPalice ?? m.sirinaPalice,
      debelinaPalice: ar.debelinaPalice ?? m.debelinaPalice,
      razmikPalic: ar.razmikPalic ?? m.razmikPalic,
      kotPosevnih: ar.kotPosevnih ?? m.kotPosevnih,
      stPalic: ar.stPalic ?? m.stPalic,
      // MERITVE-PRO — vir meritve + povezave
      source: ar.source ?? m.source,
      photoId: ar.photoId ?? m.photoId,
      snapshotId: ar.snapshotId ?? m.snapshotId,
      // R281 (issue #16 §10) — sync metadata (provenance; iskrena
      // praznina, če je klient NI poročal)
      sync: ar.sync,
    }
  })
}

export function getQuickSpacing(dolzinaMm: number, visinaMm: number, slatWidth = 80, maxGap = 100) {
  const n = Math.ceil((dolzinaMm - maxGap) / (maxGap + slatWidth))
  const actualGap = (dolzinaMm - n * slatWidth) / (n + 1)
  return {
    slatCount: n,
    gap: Math.round(actualGap * 10) / 10,
    compliant: actualGap <= 100,
    postSpacing: dolzinaMm / Math.max(1, n > 5 ? Math.ceil(n / 5) : 2),
  }
}
