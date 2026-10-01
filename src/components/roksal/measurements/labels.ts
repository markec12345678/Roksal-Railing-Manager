// R338 — dekompozicija measurements-tab FAZA 3: zbirke oznak/barv/ikon
// (GroundType/AuditEntry tipa + 17 Record zbirk) izluščene iz
// measurements-tab.tsx (čist premik — kanon R319 faza 1 / R325 faza 2).
// Vse definicije so premaknjene VERBATIM z originalnimi komentarji
// (R-številke = institucionalni spomin); edina sprememba je izrecni
// `export`. Brez 'use client' — čisti podatkovni modul (del client drevesa).

import {
  Columns3,
  CornerDownRight,
  Crosshair,
  Gauge,
  Layers,
  Layers2,
  Mountain,
  Plus,
  RefreshCw,
  RotateCcw,
  Ruler,
  Trash2,
  Triangle,
} from 'lucide-react'
import type {
  ArSyncMeta,
  EnotaTip,
  MeasurementStatus,
  Segment,
  TipMeritve,
} from './shared'

export type GroundType = 'beton' | 'les' | 'plosca' | 'gramoz' | 'metal'

export interface AuditEntry {
  timestamp: string
  akcija: 'ADD' | 'EDIT' | 'DELETE' | 'STATUS'
  meritevId: string
  opis: string
  staraVrednost?: string
  novaVrednost?: string
}

export const tipMeritveLabels: Record<TipMeritve, string> = {
  RAZDALJA: 'Razdalja',
  VISINA: 'Višina',
  KOT: 'Kot',
  NAGIB: 'Nagib',
  GLOBINA: 'Globina',
  PREMER: 'Premer',
  SEGMENT: 'Segment',
  // P3 — novi tipi
  KOT_VOGAL: 'Vogal',
  KOT_STOPNISCE: 'Kot stopnice',
  STEBR: 'Stebriček/Palica',
}

// R280 MANDATORY STIL — hover parity za tip badge (isti vzorec kot R278 vir
// pill + R279 segmentId Badge: cursor-help + title razložljivost; 0 novih hex).
export const tipMeritveTitles: Record<TipMeritve, string> = {
  RAZDALJA: 'Vrsta meritve: Razdalja — vodoravna dolžina; določa širino segmenta.',
  VISINA: 'Vrsta meritve: Višina — navpična dimenzija; določa višino ograje.',
  KOT: 'Vrsta meritve: Kot — izmerjen kot v stopinjah (vrednost = resnica, verbatim).',
  NAGIB: 'Vrsta meritve: Nagib — naklon tal/plošče; znak je del resnice.',
  GLOBINA: 'Vrsta meritve: Globina — globinska meritev (npr. stopnice).',
  PREMER: 'Vrsta meritve: Premer — premer objekta (npr. droga).',
  SEGMENT: 'Vrsta meritve: Segment — meritev pripisana segmentu (stabilen segmentId — identiteta preživi re-anchor, issue #16 §1).',
  KOT_VOGAL: 'Vrsta meritve: Vogal — notranji/zunanji kot vogala.',
  KOT_STOPNISCE: 'Vrsta meritve: Kot stopnice — naklon stopniščnega kosa (rake).',
  STEBR: 'Vrsta meritve: Stebriček/Palica — samostojen steber s pozicijo v segmentu (avto-številčenje S1, S2 …).',
}

export const tipMeritveIcons: Record<TipMeritve, typeof Ruler> = {
  RAZDALJA: Ruler,
  VISINA: Gauge,
  KOT: Triangle,
  NAGIB: Mountain,
  GLOBINA: Crosshair,
  PREMER: Crosshair,
  SEGMENT: Layers,
  // P3 — novi tipi
  KOT_VOGAL: CornerDownRight,
  KOT_STOPNISCE: Layers2,
  STEBR: Columns3,
}

export const tipMeritveColors: Record<TipMeritve, string> = {
  RAZDALJA: 'bg-roksal-navy/10 text-roksal-ink border-roksal-navy/20 dark:border-roksal-ink/20',
  VISINA: 'bg-roksal-amber/10 text-roksal-amber border-roksal-amber/30',
  KOT: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  NAGIB: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  GLOBINA: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  PREMER: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  SEGMENT: 'bg-gray-50 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800',
  // P3 — novi tipi
  KOT_VOGAL: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  KOT_STOPNISCE: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  STEBR: 'bg-roksal-navy/10 text-roksal-ink border-roksal-navy/20 dark:border-roksal-ink/20',
}

// R281 MANDATORY STIL (issue #16 §10) — hover parity za sync žig (isti
// vzorec kot R280 tip badge + R278 vir pill: cursor-help + title
// razložljivost; 0 novih hex — vse barvne ulomke že obstoječe v datoteki).
export const syncStanjeLabels: Record<NonNullable<ArSyncMeta['syncState']>, string> = {
  synced: 'Sinhronizirano',
  pending: 'V čakalni vrsti',
  conflict: 'Konflikt',
  error: 'Napaka sync',
}

export const syncStanjeTitles: Record<NonNullable<ArSyncMeta['syncState']>, string> = {
  synced:
    'Sinhronizacijsko stanje: Sinhronizirano — opazovano stanje klienta (provenance), NI sync resnica; revizije in konflikti ostanejo v obstoječem /api/sync (issue #16 §10).',
  pending:
    'Sinhronizacijsko stanje: V čakalni vrsti — odjavno delo (issue #16 §13) še ni poslano; opazovano stanje klienta, NI sync resnica (issue #16 §10).',
  conflict:
    'Sinhronizacijsko stanje: Konflikt — obstoječi /api/sync je zaznal odstopanje baseRevision (strežnik ne zaupa klientu); nobena sprememba se ne izgubi tiho, obe verziji ohranjeni (issue #16 §10).',
  error:
    'Sinhronizacijsko stanje: Napaka — zadnji poskus sync ni uspel; opazovano stanje klienta, NI sync resnica (issue #16 §10).',
}

// 0 novih hex — ulomki povzeti iz obstoječih žigov v tej datoteki
// (R234 nevtralni / R280 amber / obstoječa semantična rdeča).
export const syncStanjeColors: Record<NonNullable<ArSyncMeta['syncState']>, string> = {
  synced: 'bg-muted text-muted-foreground border-border',
  pending: 'bg-roksal-amber/10 text-roksal-amber border-roksal-amber/30',
  conflict: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800',
  error: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800',
}

export const groundTypeLabels: Record<GroundType, string> = {
  beton: 'Beton',
  les: 'Lesena podlaga',
  plosca: 'Plošča (kompozit)',
  gramoz: 'Gramoz',
  metal: 'Kovinska podlaga',
}

export const groundTypeColors: Record<GroundType, string> = {
  beton: 'bg-gray-100 dark:bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-800',
  les: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  plosca: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800',
  gramoz: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800',
  metal: 'bg-slate-100 dark:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800',
}

export const segmentTypeLabels: Record<Segment['type'], string> = {
  ravni: 'Ravni odsek',
  kotni: 'Kotni odsek',
  stopniscje: 'Stopnišče',
  lokan: 'Lokan / ukrivljen',
  // P3 — WPC orientacije
  WPC_POKOCNE: 'WPC pokončne palice',
  WPC_VODORAVNE: 'WPC vodoravne palice',
  WPC_POSEVNE: 'WPC poševne palice',
}

export const statusLabels: Record<MeasurementStatus, string> = {
  OSNUTEK: 'Osnutek',
  POTRJENA: 'Potrjena',
  ARHIVIRANA: 'Arhivirana',
}

export const statusColors: Record<MeasurementStatus, string> = {
  // R234 — nevtralni statusi → žetoni (R229 OSNUTEK/Zapadlo vzorec: en razred
  // obe temi; ARHIVIRANA obdrži line-through — prečrtanost je SEMANTIKA
  // arhiva, ne barva; POTRJENA ostane semantična zeleni sorojenec).
  OSNUTEK: 'bg-muted text-muted-foreground border-border',
  POTRJENA: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800',
  ARHIVIRANA: 'bg-muted text-muted-foreground border-border line-through',
}

export const statusCycle: Record<MeasurementStatus, MeasurementStatus> = {
  OSNUTEK: 'POTRJENA',
  POTRJENA: 'ARHIVIRANA',
  ARHIVIRANA: 'OSNUTEK',
}

export const auditActionLabels: Record<AuditEntry['akcija'], string> = {
  ADD: 'Dodano',
  EDIT: 'Spremenjeno',
  DELETE: 'Izbrisano',
  STATUS: 'Status',
}

export const auditIcons: Record<AuditEntry['akcija'], typeof Ruler> = {
  ADD: Plus,
  EDIT: RefreshCw,
  DELETE: Trash2,
  STATUS: RotateCcw,
}

export const auditColors: Record<AuditEntry['akcija'], string> = {
  ADD: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300',
  EDIT: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  DELETE: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
  STATUS: 'bg-roksal-amber/10 text-roksal-ink', // R311 — žetoni (družina ADD/EDIT/DELETE ostaja semantična)
}

// R339 STIL val 25 — hover parity za revizijsko sled (isti vzorec kot
// R280 tip badge + R281 sync žig: title razložljivost; EN VIR niz — badge
// in testi bereta ISTO mapo; 0 novih hex).
export const auditActionTitles: Record<AuditEntry['akcija'], string> = {
  ADD: 'Revizija: Dodano — nova meritev vnesena v ta projekt (vrstica v zgodovini sprememb).',
  EDIT: 'Revizija: Spremenjeno — obstoječa meritev popravljena (shranjevanje ustvari novo verzijo; stara ostane v zgodovini).',
  DELETE: 'Revizija: Izbrisano — meritev odstranjena iz projekta (iskrena praznina — vnosa ni več).',
  STATUS: 'Revizija: Status — cikel OSNUTEK → POTRJENA → ARHIVIRANA (perzistentno, z revizijsko sledjo).',
}

export const enotaLabels: Record<EnotaTip, string> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
}
