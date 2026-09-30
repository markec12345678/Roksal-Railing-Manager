// R325 — dekompozicija measurements-tab FAZA 2: P1/P3 "template localStorage
// blok" (lastniška prioriteta #2) — PREDLOGE hitrega začetka + stopniške
// predloge (localStorage) + WPC konstante + tipi StairTemplate/StairCalc.
// ČIST PREMIK iz measurements-tab.tsx (vrstice 253–258, 485–523, 673–691) —
// bajtno identično; edine spremembe: `export` predpona + lucide uvoz
// (ikone za PREDLOGE). Brez 'use client' — del client drevesa
// (kanon R319/R321).

import { Layers, Mountain, Plus, Ruler, Triangle } from 'lucide-react'

export interface PredlogaDef {
  id: string
  naziv: string
  opis: string
  ikona: typeof Ruler
}

export const PREDLOGE: PredlogaDef[] = [
  { id: 'balkon3m', naziv: 'Standardni balkon 3m', opis: 'Balkon + 3 meritve', ikona: Ruler },
  { id: 'stopnisce', naziv: 'Stopnišče 12 stopnic', opis: 'Stopnišče + 2 meritevi', ikona: Layers },
  { id: 'loblika', naziv: 'L-oblika 4+2m', opis: '2 segmenta, L tloris', ikona: Triangle },
  { id: 'terasa5m', naziv: 'Terasa 5m', opis: 'Terasa + 1 meritev', ikona: Mountain },
  { id: 'prazen', naziv: 'Prazen začetek', opis: 'Samo nova forma', ikona: Plus },
]

// P3 — konstante za WPC
export const WPC_SIRINE_PALIC = [140, 180] as const
export const WPC_DEBELINA_DEFAULT = 23
export const WPC_RAZMAK_DEFAULT = 110 // standardni Roksal razmik med palicami
export const WPC_KOT_POSEVNIH_DEFAULT = 45

export interface StairTemplate {
  id: string
  naziv: string
  skupnaVisinaMm: number
  stStopnic: number
  globinaStopniceMm: number
  sirinaStopniceMm?: number
  createdAt: string
}

export interface StairCalc {
  visinaPosamezne: number
  kotStopinje: number
  dolzinaKosa: number
  skupnaDolzina: number
  priporocilo: string
  priporociloColor: string
  valid: boolean
}

// P3 — nalaganje/shranjevanje stopniških predlog
export function loadStairTemplates(): StairTemplate[] {
  try {
    const raw = localStorage.getItem('roksal_stair_templates')
    return raw ? (JSON.parse(raw) as StairTemplate[]) : []
  } catch {
    return []
  }
}

export function saveStairTemplates(templates: StairTemplate[]) {
  try {
    localStorage.setItem('roksal_stair_templates', JSON.stringify(templates))
  } catch {
    // ignore
  }
}
