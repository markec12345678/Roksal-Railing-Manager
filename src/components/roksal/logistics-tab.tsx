'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { casOznaka } from '@/lib/osvezitev-fokus'
import { downloadCsv, downloadCsvText, downloadTextFile, todayStamp } from '@/lib/csv-export'
import { icsEscape, icsFold, icsUtc } from '@/lib/ics'
import { allowedTransitions } from '@/lib/equipment-lifecycle'
import {
  normalizirajTermin,
  terminBeseda,
  terminUrPovzetekRazsirjen,
  vsotaPredvidenihUr,
  type TerminPrikazVnos,
} from '@/lib/termini-prikaz'
import {
  generateProjektiTerminiPdf,
  projektiTerminiPregled,
  projektBeseda,
  type ProjektiTerminiProjektVnos,
  type ProjektiTerminiTerminVnos,
} from '@/lib/projekti-termini-pdf'
import {
  generateOpremaCikelPdf,
  opremaCikelPregled,
  kosBeseda,
  type OpremaCikelVnos,
} from '@/lib/oprema-cikel-pdf'
// R297 — oprema cikel CSV (27. člen 'izvozi' družine): CSV brat PDF R266 —
// ISTA cikl resnica (opremaCikelPregled EN VIR, cenikDatumIso EN VIR, Sklep
// VERBATIM) kot ravninska tabela za Excel/revizijo; route NIČ (client+lib only).
import {
  opremaCikelCsv,
  opremaCikelCsvFilename,
} from '@/lib/oprema-cikel-csv'
import {
  generateVozniRedPdf,
  vozniRedPovzetek,
  vozniRedUreKpi,
  type VozniRedTermin,
} from '@/lib/logistika-vozni-red-pdf'
import {
  generateTedenskiVozniRedPdf,
  tedenskiPregledPovzetek,
  tedenskiUreKpi,
} from '@/lib/tedenski-vozni-red-pdf'
// R292 — EN VIR razgled + CSV (23. člen 'izvozi' družine): okno/ime dneva/
// validacija/sort/vsote UVOŽENI iz PDF brata (nič dvojnega — WYSIWYG po
// konstrukciji); razgled = ISTA resnica za zaslon, CSV IN toast.
import {
  tedenskiRazgled,
  tedenskiRazgledSklep,
  tedenskiVozniRedCsv,
  tedenskiVozniRedCsvFilename,
} from '@/lib/tedenski-vozni-red-csv'
// R298 — ICS brat (28. člen 'izvozi' družine): ISTI razgled TRETJI potrošnik
// (strip R292 + CSV R292 + ICS R298 — ENA izpeljava, nič dvojnega); ICS
// mašinerija UVOŽENA iz R296 brata (zavijanje/izpustni znaki/DTSTAMP).
import {
  tedenskiVozniRedIcs,
  tedenskiVozniRedIcsFilename,
} from '@/lib/tedenski-vozni-red-ics'
// R299 — 29. člen 'izvozi' družine: ICS PO EKIPAH — izpeljani brat R298
// (ČETRTI potrošnik ISTEGA tedenskiRazgled: strip + CSV + ICS + ekipa);
// EN VIR ekipa seznam + filtriran ICS + ime (NIČ dvojnega).
import {
  tedenskiEkipaImena,
  tedenskiEkipaIcs,
  tedenskiEkipaIcsFilename,
} from '@/lib/tedenski-vozni-red-ekipa-ics'
// R300 — 30. člen (issue #1 §7 branje): TEDENSKI KONFLIKTNI PREGLED —
// deterministična bralna stran pravil R142 (API 409 je zapisna stran):
// isti poli-odprto pravilo + aktivni statusi, STRAŽAR test uveljavlja
// dobesedno sinhronizacijo zrcala (schedule-conflicts.ts je strežniški —
// @/lib/db — klientski lib ga NE sme uvažati).
import { tedenskiKonflikti } from '@/lib/tedenski-konflikti'
// R301 — 31. člen 'izvozi' družine: KONFLIKTI CSV — CSV brat pregledu R300
// (tedenskiKonflikti EN VIR — ISTO okno, ISTA pravila, ISTI pari f(množica));
// route NIČ (client+lib only).
import {
  konfliktiCsv,
  konfliktiCsvFilename,
  konfliktiSklep,
} from '@/lib/konflikti-csv'
// R302 — 32. člen 'izvozi' družine: KONFLIKTI PDF — PDF brat pregledu R300 +
// CSV R301 (tedenskiKonflikti EN VIR — ISTO okno, ISTA pravila, ISTI pari
// f(množica)); glava tabele + Sklep UVOŽENA iz CSV brata (nič dvojnega);
// route NIČ (client+lib only).
import {
  generateKonfliktiPdf,
  konfliktiPdfFilename,
} from '@/lib/konflikti-pdf'
import { cenikDatumIso } from '@/lib/cenik-pdf'
import { QC_TEMPLATE, computePassed, countDefects } from '@/lib/qc-gate'
import { IEV_TEMPLATE } from '@/lib/installation-evidence'
import {
  Calendar, Download, Users, Wrench, Plus, Clock, MapPin, CheckCircle2, CalendarClock,
  Loader2, AlertTriangle, Truck, Package, ShieldCheck, History, FileCheck2, Lock,
  CalendarRange, ClipboardList, Activity, FileSpreadsheet,
} from 'lucide-react'

interface Schedule {
  id: string
  datumZacetka: string
  datumKonca: string
  status: string
  predvideneUre: number
  dejanskeUre: number | null
  opombe: string | null
  lokacija: string | null
  project: { id: string; nazivProjekta: string; customer: { ime: string; naslov: string } }
  crew: { id: string; naziv: string; barva: string } | null
  monter: { id: string; ime: string } | null
  equipment: Array<{ equipment: { id: string; naziv: string; tip: string } }>
}

interface Crew {
  id: string
  naziv: string
  barva: string
  vodja: { ime: string } | null
  _count: { members: number; schedules: number }
}

/** R147 (§28): montažno dokazilo (§17 minimalni DTO + izpeljane zastavice). */
interface EvidenceRow {
  id: string
  scheduleId: string | null
  templateVersion: string
  lokacija: string
  beforePhotoId: string | null
  afterPhotoId: string | null
  gps: { gpsLat: number; gpsLng: number; consentAt: string } | null
  checklist: Array<{ key: string; checked: boolean; note: string | null }>
  defects: Array<{ opomba: string; reseno: boolean }>
  handoverName: string | null
  handoverAt: string | null
  createdBy: string | null
  createdAt: string
  hasBefore: boolean
  hasAfter: boolean
  checklistAllChecked: boolean
  openDefectsCount: number
  complete: boolean
  locked: boolean
}

/** R147 (§28): fotka projekta (izbor PRED/PO v dokazilu). */
interface PhotoRow {
  id: string
  kategorija: string
  opomba: string | null
  createdAt: string
}

interface Equipment {
  id: string
  naziv: string
  tip: string
  status: string
  lokacija: string | null
  serijskaStevilka: string | null
  lastInspectionAt: string | null
  inspectionIntervalDays: number | null
  nextInspectionAt: string | null
  inspectionDue: boolean
  inspectionUnknown: boolean
  calibrationRequired: boolean
  calibrationDueDate: string | null
  calibrationCertificate: string | null
  calibrationOverdue: boolean
  calibrationMissing: boolean
  zadnjiServis: string | null
  assignmentsCount: number
}

interface EquipmentEventRow {
  id: string
  type: string
  performedAt: string
  result: string
  certificate: string | null
  opomba: string | null
  performedBy: string | null
}

interface Project {
  id: string
  nazivProjekta: string
  customer: { ime: string; naslov: string }
  // R265 — planirana montaža (API jo vrača; podmnožica, ki jo bere presek
  // projekti × termini — planirana montaža brez termina = planska luknja).
  datumMontaze?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  NAVRTENO: 'Načrtovano',
  V_TEKU: 'V teku',
  ZAKLJUCENO: 'Zaključeno',
  PREKlicANO: 'Preklicano',
  PRELOZENO: 'Preloženo',
}

const STATUS_COLORS: Record<string, string> = {
  NAVRTENO: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800',
  V_TEKU: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
  ZAKLJUCENO: 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-200 border-green-300 dark:border-green-800',
  PREKlicANO: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800',
  PRELOZENO: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800',
}

const EQUIPMENT_TYPES: Record<string, string> = {
  MERSKA_OPREMA: 'Merska oprema',
  ROCNO_ORODJE: 'Ročno orodje',
  PREVOZ: 'Prevoz',
  VARNOSTNA_OPREMA: 'Varnostna oprema',
  OSTALO: 'Ostalo',
}

// R145 (§31): oznake statusov opreme (življenjski cikl — UPOKOJENO je novo).
const EQUIPMENT_STATUS_LABELS: Record<string, string> = {
  NA_VOLJO: 'Na voljo',
  V_UPORABI: 'V uporabi',
  V_SERVISU: 'V servisu',
  IZGUBLJENO: 'Izgubljeno',
  UPOKOJENO: 'Upokojeno',
}

const EQUIPMENT_STATUS_COLORS: Record<string, string> = {
  NA_VOLJO: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800',
  V_UPORABI: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800',
  V_SERVISU: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
  IZGUBLJENO: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800',
  // R234 — nevtralna veja → žetoni (R229 Zapadlo vzorec; sorojenci
  // V_SERVISU amber / IZGUBLJENO red ostanejo semantični).
  UPOKOJENO: 'bg-muted text-muted-foreground border-border',
}

const EQUIPMENT_EVENT_LABELS: Record<string, string> = {
  PREGLED: 'Pregled',
  KALIBRACIJA: 'Kalibracija',
  SERVIS: 'Servis',
  POPRAVILO: 'Popravilo',
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(d: string): string {
  return new Date(d).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// ICS izvoz (RFC 5545) — termine montaže v telefonov koledar (Google/Apple/
// Outlook jih vsi uvozijo). Časi v UTC (Z), kar pomeni pravilen prikaz tudi
// po časovnih pasovih; STATUS premeša Preklicano/Preloženo.
// R172 — pomožniki (icsEscape/icsFold/icsUtc) izdvojeni v src/lib/ics.ts
// (EN VIR RESNICE z novim .ics izvozom Termini kartice); vedenje
// BYTE-IDENTIČNO R139 verziji — čist refaktor importa, nič spremembe formata.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// R139 — CSV izvoz terminov (isti deterministični kontrakt kot Zaloga/Računi
// iz R136: BOM, podpičje, decimalna vejica, CRLF — src/lib/csv-export.ts).
// Pisarna dobi termini kot preglednico (mesečna poročila, urni list).
// R173 — metapodatki obsega (konsistentno z R171 Termini kartico CSV):
// IZVOŽENO = ZASLON — povzetek je ISTI terminUrPovzetekRazsirjen niz kot v
// vrstici nad seznamom (EN VIR RESNICE), 'Izvoženo ob' je ISTI casOznaka pečat
// zadnjega uspešnega branja (R170; null → vrstica IZPUŠČENA — nikoli lažne
// svežine) in 'Obseg' je realen obseg poizvedbe (projektni filter ali vsi).
// ---------------------------------------------------------------------------
interface LogistikaCsvMetapodatki {
  povzetek: string
  osvezitev: Date | null
  obseg: string
}

function downloadSchedulesCsv(schedules: Schedule[], metapodatki: LogistikaCsvMetapodatki): number {
  downloadCsv(
    `Termini-${todayStamp()}.csv`,
    ['Datum', 'Od', 'Do', 'Projekt', 'Stranka', 'Ekipa', 'Status', 'Lokacija', 'Ure'],
    [
      ...schedules.map((s) => [
        formatDate(s.datumZacetka),
        formatTime(s.datumZacetka),
        formatTime(s.datumKonca || s.datumZacetka),
        s.project.nazivProjekta,
        s.project.customer.ime,
        s.crew?.naziv ?? '',
        STATUS_LABELS[s.status] || s.status,
        s.lokacija ?? '',
        s.predvideneUre,
      ]),
      // R173 — meta vrstice (ISTA struktura kot R171: prazna ločilna vrstica,
      // obseg, povzetek, pečat) — prejemnik ve TOČNO, kaj in KDAJ je bilo
      // prikazano izvozniku.
      [],
      ['Obseg', metapodatki.obseg],
      ['Povzetek', metapodatki.povzetek],
      ...(metapodatki.osvezitev !== null
        ? [['Izvoženo ob (čas zadnje osvežitve)', casOznaka(metapodatki.osvezitev)] as (string | number)[]]
        : []),
    ],
  )
  return schedules.length
}

export function buildIcs(schedules: Schedule[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Roksal Railing Manager//Logistika//SL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Roksal montaže',
  ]
  const now = icsUtc(new Date())
  for (const s of schedules) {
    const status = s.status === 'PREKlicANO' ? 'CANCELLED' : s.status === 'PRELOZENO' ? 'TENTATIVE' : 'CONFIRMED'
    const opis = [
      `Stranka: ${s.project.customer.ime}`,
      s.crew ? `Ekipa: ${s.crew.naziv}` : null,
      s.monter ? `Monter: ${s.monter.ime}` : null,
      `Predvidene ure: ${s.predvideneUre}`,
      s.opombe ?? null,
    ]
      .filter(Boolean)
      .join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:schedule-${s.id}@roksal`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsUtc(s.datumZacetka)}`,
      `DTEND:${icsUtc(s.datumKonca || s.datumZacetka)}`,
      `SUMMARY:${icsEscape(`Montaža: ${s.project.nazivProjekta}`)}`,
      `LOCATION:${icsEscape(s.lokacija || s.project.customer.naslov || '')}`,
      `DESCRIPTION:${icsEscape(opis)}`,
      `STATUS:${status}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(icsFold).join('\r\n') + '\r\n'
}

export function downloadIcs(schedules: Schedule[]): number {
  if (schedules.length === 0) return 0
  const blob = new Blob([buildIcs(schedules)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `roksal-montaze-${new Date().toISOString().slice(0, 10)}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return schedules.length
}

export function LogisticsTab({ projectId }: { projectId: string | null }) {
  const [subtab, setSubtab] = useState<'calendar' | 'crews' | 'equipment'>('calendar')
  const [schedules, setSchedules] = useState<Schedule[]>([])

  // R169 — povzetek 'Skupaj ur' nad vidnimi termini (EN VIR RESNICE z
  // dashboard Termini kartico: ISTI normalizirajTermin → vsotaPredvidenihUr
  // → terminUrPovzetek). PREKlicano izključen + vidno preštet; '≥' ko ure
  // manjkajo; pokvarjen vnos → vidno preštet kot preskočen (ne tiho izgubljen).
  // R255 — memo VRAČA tudi prikazne vrstice: ISTI normalizirani vir je
  // hkrati vhod za vozni red DTO (ENA resnica — zaslon IN PDF iz ISTEGA
  // izračuna, nič dvojnega štetja).
  const urPovzetek = useMemo(() => {
    let preskoceni = 0
    const prikazne: TerminPrikazVnos[] = []
    for (const raw of schedules) {
      const res = normalizirajTermin(raw, null)
      if ('napaka' in res) {
        preskoceni += 1
        continue
      }
      prikazne.push(res.vnos)
    }
    return { ag: vsotaPredvidenihUr(prikazne), preskoceni, prikazne }
  }, [schedules])

  // R255 — vozni red DTO iz ISTEGA normaliziranega vira (EN VIR RESNICE:
  // prikazne vrstice = TOČNO to, kar seznam izriše; preskočeni ostanejo
  // vidno prešteti na zaslonu; null polja = iskrena '—' resnica na listu,
  // NIKOLI izmišljeni podatki). datumKonca pride iz surove vrstice po id —
  // normalizacija ga ne nosi, vzorec je enak CSV/ICS izvozu ('Do' je
  // prikazan samo, ko je res vpisan).
  const vozniRedVnosi = useMemo<VozniRedTermin[]>(
    () =>
      urPovzetek.prikazne.map((v) => {
        const raw = schedules.find((s) => s.id === v.id)
        const konec =
          raw && typeof raw.datumKonca === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw.datumKonca)
            ? raw.datumKonca
            : null
        return {
          datumZacetka: v.datumZacetka,
          datumKonca: konec,
          status: v.status,
          predvideneUre: v.predvideneUre,
          projekt: v.projektIme,
          stranka: v.strankaIme,
          ekipa: v.ekipaIme,
          lokacija: v.lokacija,
        }
      }),
    [urPovzetek.prikazne, schedules],
  )
  const [crews, setCrews] = useState<Crew[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  // R163 fail-verbose: razlog, zakaj podatkov NI (prej catch ignore + stale state).
  const [loadError, setLoadError] = useState<string | null>(null)
  // R170 — pečat 'Osveženo ob' = čas zadnjega USPEŠNega branja vseh virov.
  // Napaka/invaliden odgovor → null (pečat brez podatkov bi lažno trdil
  // svežino — pečat je viden TOČNO TAKRAT, ko so na zaslonu podatki uspešnega
  // branja, vzorec EN VIR RESNICE s Termini kartico).
  const [zadnjaOsvezitev, setZadnjaOsvezitev] = useState<Date | null>(null)
  const [newScheduleOpen, setNewScheduleOpen] = useState(false)
  const [newCrewOpen, setNewCrewOpen] = useState(false)
  const [newEquipOpen, setNewEquipOpen] = useState(false)
  // R265 — dvoklik guard izvoza (R264 vzorec pozicijaVTeku): med FRESH
  // fetchom /api/schedules je pill onemogočen — nič dvojnih dokumentov.
  const [ptVTeku, setPtVTeku] = useState(false)
  // R266 — izvoz cikla opreme v teku (disabled guard — pariteta ptVTeku R265).
  const [ocVTeku, setOcVTeku] = useState(false)
  // R297 — dvoklik guard oprema cikel CSV (ISTA družina, pariteta brata).
  const [ocCsvVTeku, setOcCsvVTeku] = useState(false)
  // R292 — dvoklik guard tedenskega CSV (pariteta ptVTeku R265/ocVTeku R266).
  const [tedenskiCsvVTeku, setTedenskiCsvVTeku] = useState(false)
  // R298 — dvoklik guard ICS izvoza (pariteta tedenskiCsvVTeku R292).
  const [tedenskiIcsVTeku, setTedenskiIcsVTeku] = useState(false)
  // R299 — dvoklik guard per-ekipa ICS (katera ekipa je v teku — string
  // guard, pariteta tedenskiIcsVTeku R298; null = nič v teku).
  const [tedenskiEkipaIcsVTeku, setTedenskiEkipaIcsVTeku] = useState<string | null>(null)
  // R301 — dvoklik guard konflikti CSV (pariteta tedenskiCsvVTeku R292).
  const [konfliktiCsvVTeku, setKonfliktiCsvVTeku] = useState(false)
  // R302 — dvoklik guard konflikti PDF (pariteta konfliktiCsvVTeku R301).
  const [konfliktiPdfVTeku, setKonfliktiPdfVTeku] = useState(false)

  // R266 — ENA izpeljava vhodov za cikl opreme (WYSIWYG ISTI vir kot PDF
  // KPI, tabela, sklep, F2 mini-vrstica IN toast): DTO pruning iz ISTEGA
  // state-a, ki ga loadData ŽE napolni — NIČ nove mreže. Tip poimenovan z
  // ISTO UI mapo kot badge (EQUIPMENT_TYPES); neznan pade na verbatim niz
  // (prikazna resnica — NI jedra). status VERBATIM — lib fail-closed
  // preveri vseh 5 znanih z indeksom krivca. PRAZEN seznam → null (memo
  // NE sme padeti med nalaganjem; lib fail-closed zavrže prazno — R263
  // vzorec). (Memo sta PRED pogojnimi vračanji — pravila hooks.)
  const opremaCikelVhodi = useMemo<OpremaCikelVnos[]>(() => equipment.map((e) => ({
    id: e.id,
    naziv: e.naziv,
    tip: EQUIPMENT_TYPES[e.tip] || e.tip,
    status: e.status as OpremaCikelVnos['status'],
    lokacija: e.lokacija,
    serijskaStevilka: e.serijskaStevilka,
    lastInspectionAt: e.lastInspectionAt,
    inspectionIntervalDays: e.inspectionIntervalDays,
    nextInspectionAt: e.nextInspectionAt,
    inspectionDue: e.inspectionDue,
    inspectionUnknown: e.inspectionUnknown,
    calibrationRequired: e.calibrationRequired,
    calibrationDueDate: e.calibrationDueDate,
    calibrationCertificate: e.calibrationCertificate,
    calibrationOverdue: e.calibrationOverdue,
    calibrationMissing: e.calibrationMissing,
    zadnjiServis: e.zadnjiServis,
    assignmentsCount: e.assignmentsCount,
  })), [equipment])
  const opremaCikelPovzetek = useMemo(
    () => (equipment.length > 0 ? opremaCikelPregled(opremaCikelVhodi).povzetek : null),
    [equipment.length, opremaCikelVhodi],
  )
  const { toast } = useToast()

  // R292 — TEDENSKI RAZGLED (MANDATORY STIL): 7-dnevni razgled NA ZASLONU
  // (do zdaj samo v PDF R256). EN VIR resnice — tedenskiRazgled uvaža okno/
  // validacijo/sort/vsote iz PDF brata, zato zaslon, CSV (23. člen) IN toast
  // NE morejo divergirati. now = čas izpeljave razgleda (memo per podatkovni
  // snapshot vozniRedVnosi — determinističen red vedenja, vzorec drugih memo).
  const tedenskiRazgledNow = useMemo(() => new Date(), [vozniRedVnosi])
  const razgled = useMemo(
    () => tedenskiRazgled(vozniRedVnosi, tedenskiRazgledNow),
    [vozniRedVnosi, tedenskiRazgledNow],
  )

  // R299 — 29. člen: EKIPA V OKNU (EN VIR tedenskiEkipaImena — ISTI okno/
  // validacija/preverba kot izvoz in razgled; NULL ekipe izključene — '—' na
  // zaslonu NI ekipa z imenom '—'). Memo per podatkovni snapshot (ISTI
  // tedenskiRazgledNow — ena izpeljava časa za celo družino, vzorec R292).
  const ekipaImena = useMemo(
    () => tedenskiEkipaImena(vozniRedVnosi, tedenskiRazgledNow),
    [vozniRedVnosi, tedenskiRazgledNow],
  )

  // R300 — 30. člen: KONFLIKTNI PREGLED OKNA (EN VIR tedenskiKonflikti —
  // ISTO okno + uvožen pregled kot cela tedenska družina; null = iskrena
  // čistost '0 konfliktov'). Memo per podatkovni snapshot (ISTI now).
  const konfliktiPregled = useMemo(
    () => tedenskiKonflikti(vozniRedVnosi, tedenskiRazgledNow),
    [vozniRedVnosi, tedenskiRazgledNow],
  )

  // R292 — 23. člen 'izvozi' družine: TEDENSKI VOZNI RED CSV — CSV brat PDF
  // R256 (vzorec R284→R285/R291): fail-closed PREJ (prazno okno → iskren
  // toast, NIKOLI prazna datoteka — R250/R291 vzorec), potem ENA izpeljava
  // (ISTI now za povzetek + CSV + ime — lekcija R121/R235); agregat v
  // toastu = ISTI lib sklep kot razgled na zaslonu (WYSIWYG, sklanjatev
  // EN VIR terminBeseda); fail-verbose catch (R291 vzorec); dvoklik guard
  // (pariteta ptVTeku R265).
  const handleTedenskiCsv = () => {
    if (tedenskiCsvVTeku) return
    setTedenskiCsvVTeku(true)
    try {
      const now = new Date()
      const pov = tedenskiPregledPovzetek(vozniRedVnosi, now)
      if (pov === null) {
        toast({
          title: 'Ni terminov v naslednjih 7 dneh',
          description: 'CSV se izvozi, ko je vpisan termin v prihajajočem tednu.',
        })
        return
      }
      const { csv } = tedenskiVozniRedCsv(vozniRedVnosi, now)
      const ime = tedenskiVozniRedCsvFilename(now)
      downloadCsvText(ime, csv)
      toast({
        title: `Tedenski pregled prenešen v CSV (${ime})`,
        description: `${tedenskiRazgledSklep(pov)}.`,
      })
    } catch (err) {
      toast({ title: 'Izvoz CSV ni uspel', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
    } finally {
      setTedenskiCsvVTeku(false)
    }
  }

  // R298 — 28. člen 'izvozi' družine (P1-f): TEDENSKI VOZNI RED ICS — ICS
  // brat PDF R256 + CSV R292: naslednjih 7 dni kot RFC 5545 koledar —
  // EKIPA uvozi razpored v telefon (DTSTART/DTEND = resnične ure iz
  // datumZacetka/datumKonca; DTEND izpuščen ko konec ni vpisan — NIKOLI
  // izmišljen iz predvidenih ur). VEDNO viden (P1-k/R232 kanon): prazno
  // okno → iskren fail-closed toast, NIKOLI prazna datoteka; toast = ISTI
  // lib sklep kot razgled/CSV (WYSIWYG); fail-verbose catch (R291/R292
  // vzorec); dvoklik guard (pariteta tedenskiCsvVTeku).
  const handleTedenskiIcs = () => {
    if (tedenskiIcsVTeku) return
    setTedenskiIcsVTeku(true)
    try {
      const now = new Date()
      const pov = tedenskiPregledPovzetek(vozniRedVnosi, now)
      if (pov === null) {
        toast({
          title: 'Ni terminov v naslednjih 7 dneh',
          description: 'ICS se izvozi, ko je vpisan termin v prihajajočem tednu.',
        })
        return
      }
      const { ics, dogodki } = tedenskiVozniRedIcs(vozniRedVnosi, now)
      const ime = tedenskiVozniRedIcsFilename(now)
      downloadTextFile(ime, ics, 'text/calendar;charset=utf-8')
      toast({
        title: `Tedenski vozni red prenešen v ICS (${ime})`,
        description: `${dogodki} dogodkov za koledarsko aplikacijo — ${tedenskiRazgledSklep(pov)}.`,
      })
    } catch (err) {
      toast({ title: 'Izvoz ICS ni uspel', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
    } finally {
      setTedenskiIcsVTeku(false)
    }
  }

  // R299 — 29. člen 'izvozi' družine (P1): TEDENSKI ICS PO EKIPAH — izpeljani
  // brat R298: naslednjih 7 dni FILTRIRANO na eno ekipo (član uvozi SAMO
  // svoje termine). Fail-closed PREJ (0 ekip v oknu → iskren toast, NIKOLI
  // prazna datoteka — R250/R291/R292 vzorec); potem ENA izpeljava (ISTI lib
  // tedenskiEkipaIcs: filter + PRODID/UID predpona + X-ROKSAL-EKIPA; pov
  // FILTRIRANE množice v toastu — WYSIWYG); fail-verbose catch (R291/R292
  // vzorec); dvoklik guard per ekipa (string guard, pariteta bratov).
  const handleTedenskiEkipaIcs = (ekipa: string) => {
    if (tedenskiEkipaIcsVTeku !== null) return
    setTedenskiEkipaIcsVTeku(ekipa)
    try {
      const now = new Date()
      if (ekipaImena.length === 0) {
        toast({
          title: 'Ni ekip z termini v naslednjih 7 dneh',
          description: 'ICS po ekipi se izvozi, ko ima ekipa vpisan termin v prihajajočem tednu.',
        })
        return
      }
      const { ics, dogodki, pov } = tedenskiEkipaIcs(vozniRedVnosi, ekipa, now)
      const ime = tedenskiEkipaIcsFilename(ekipa, now)
      downloadTextFile(ime, ics, 'text/calendar;charset=utf-8')
      toast({
        title: `Tedenski ICS za ekipo ${ekipa} prenešen (${ime})`,
        description: `${dogodki} dogodkov samo za to ekipo — ${tedenskiRazgledSklep(pov)}.`,
      })
    } catch (err) {
      toast({ title: `Izvoz ICS za ekipo ${ekipa} ni uspel`, description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
    } finally {
      setTedenskiEkipaIcsVTeku(null)
    }
  }

  // Form states
  const [schedProject, setSchedProject] = useState('')
  const [schedCrew, setSchedCrew] = useState('')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('08:00')
  const [schedHours, setSchedHours] = useState('8')
  const [schedLocation, setSchedLocation] = useState('')
  const [crewNaziv, setCrewNaziv] = useState('')
  const [equipNaziv, setEquipNaziv] = useState('')
  const [equipTip, setEquipTip] = useState('ROCNO_ORODJE')
  // R142 (§30): preložitev termina — datum/ura/trajanje se PATCH-a, konflikti
  // vira (ekipa/monter) jih javi strežnik (409 z razlogom — fail-verbose).
  const [moveTarget, setMoveTarget] = useState<{ id: string; status: string; project: string } | null>(null)
  const [moveDate, setMoveDate] = useState('')
  const [moveTime, setMoveTime] = useState('08:00')
  const [moveHours, setMoveHours] = useState('8')
  const [moveBusy, setMoveBusy] = useState(false)
  // R145 (§31): oprema pri novem terminu (več-izbira; konflikti opreme 409).
  const [schedEquipment, setSchedEquipment] = useState<string[]>([])
  // R145 (§31): zabeleži pregled/kalibracijo/servis/popravilo + statusne
  // tranzicije (409 z dovoljenimi cilji — fail-verbose).
  const [eventTarget, setEventTarget] = useState<Equipment | null>(null)
  const [eventType, setEventType] = useState('PREGLED')
  const [eventDate, setEventDate] = useState('')
  const [eventResult, setEventResult] = useState('V_REDU')
  const [eventCertificate, setEventCertificate] = useState('')
  const [eventNextDue, setEventNextDue] = useState('')
  const [eventOpomba, setEventOpomba] = useState('')
  const [eventBusy, setEventBusy] = useState(false)
  const [eventHistory, setEventHistory] = useState<EquipmentEventRow[]>([])
  const [eventHistoryFor, setEventHistoryFor] = useState<string | null>(null)
  // R203 — fail-verbose: padec branja zgodovine NI tih — vidna opomba v dialogu
  // (prej: prazen seznam = lažni "ni dogodkov", čeprav so obstajali).
  const [eventHistoryNapaka, setEventHistoryNapaka] = useState<string | null>(null)
  // R146 (§27): preverba kakovosti PRED zaključitvijo — vrata so na strežniku
  // (ZAKLJUCENO brez prešle preverbe → 409; override z razlogom reviziran).
  const [qcTarget, setQcTarget] = useState<{ id: string; projectId: string; project: string } | null>(null)
  const [qcChecked, setQcChecked] = useState<Record<string, boolean>>({})
  const [qcNotes, setQcNotes] = useState<Record<string, string>>({})
  const [qcBusy, setQcBusy] = useState(false)
  const [qcOverrideMode, setQcOverrideMode] = useState(false)
  const [qcOverrideReason, setQcOverrideReason] = useState('')
  // R147 (§28): montažno dokazilo — pred/po + GPS (po policyju) + verzirani
  // checklist + napake + dokaz predaje (predaja zakleni — fail-closed 409).
  const [evTarget, setEvTarget] = useState<{ id: string; projectId: string; project: string } | null>(null)
  const [evExisting, setEvExisting] = useState<EvidenceRow | null>(null)
  const [evLokacija, setEvLokacija] = useState('')
  const [evGpsConsent, setEvGpsConsent] = useState(false)
  const [evGps, setEvGps] = useState<{ lat: number; lng: number } | null>(null)
  const [evChecked, setEvChecked] = useState<Record<string, boolean>>({})
  const [evNotes, setEvNotes] = useState<Record<string, string>>({})
  const [evDefects, setEvDefects] = useState('')
  const [evBeforeId, setEvBeforeId] = useState('')
  const [evAfterId, setEvAfterId] = useState('')
  const [evPhotos, setEvPhotos] = useState<{ pred: PhotoRow[]; po: PhotoRow[] }>({ pred: [], po: [] })
  const [evHandoverName, setEvHandoverName] = useState('')
  const [evBusy, setEvBusy] = useState(false)
  // R244 — wave 6 RBAC ogledalo (TOČNO R239/R241/R242/R243 vzorec): pravice
  // prebere z GET /api/auth (R135 EN VIR RESNICE; fetch on mount z alive
  // guardom, napaka → []) in skrije akcije, ki bi končale s 403. API matrika
  // (TOČNO iz route datotek): POST /api/schedules (termin) → production.manage;
  // POST /api/crews {type:'equipment'} (nova oprema) → production.manage;
  // PATCH /api/equipment (statusni prehodi) → production.manage;
  // POST /api/equipment/events (dogodek) → production.manage. ENA seja
  // pravic, EN fetch — ogledalo samo bere, API route datoteke se NE spreminjajo.
  const [myPermissions, setMyPermissions] = useState<readonly string[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/auth')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.permissions) setMyPermissions(data.permissions as readonly string[])
        else if (alive) setMyPermissions([])
      })
      .catch(() => {
        if (alive) setMyPermissions([])
      })
    return () => {
      alive = false
    }
  }, [])
  // Fail-closed izpeljava (R242/R243 vzorec — izrecno na false, NIKOLI tiha
  // inflacija pravic): med nalaganjem (null) in ob napaki so VSE pisalne
  // akcije skrite — least privilege, nikoli lažni gumb, ki bi končal s 403.
  const lahkoUpravljaProizvodnjo = myPermissions?.includes('production.manage') ?? false

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [schedRes, crewRes, equipRes, projRes] = await Promise.all([
        fetch('/api/schedules' + (projectId ? `?projectId=${projectId}` : ''), { credentials: 'same-origin' }),
        fetch('/api/crews', { credentials: 'same-origin' }),
        // R145 (§31): lifecycle DTO (zastavice kalibracije/pregledov) —
        // /api/equipment, ne starejši /api/crews?type=equipment (brez cikla).
        fetch('/api/equipment', { credentials: 'same-origin' }),
        fetch('/api/projects', { credentials: 'same-origin' }),
      ])
      // R163 fail-verbose: prej `if (res.ok) set…` brez else + `catch ignore` —
      // pri padcu APIja TIHO staro/prazno stanje (pisarna misli, da ni terminov).
      const sources: Array<[string, Response]> = [
        ['terminov', schedRes],
        ['ekip', crewRes],
        ['opreme', equipRes],
        ['projektov', projRes],
      ]
      const failed = sources.filter(([, r]) => !r.ok)
      if (failed.length > 0) {
        const st = failed[0][1].status
        setLoadError(
          st === 401
            ? 'Prijava je potekla. Ponovno se prijavite.'
            : `Strežnik ni vrnil podatkov (${failed.map(([n]) => n).join(', ')}; napaka ${st}).`,
        )
        setSchedules([])
        setCrews([])
        setEquipment([])
        setProjects([])
        setZadnjaOsvezitev(null)
        return
      }
      const [schedJson, crewJson, equipJson, projJson] = (await Promise.all([
        schedRes.json().catch(() => null),
        crewRes.json().catch(() => null),
        equipRes.json().catch(() => null),
        projRes.json().catch(() => null),
      ])) as unknown[]
      if (!Array.isArray(schedJson) || !Array.isArray(crewJson) || !Array.isArray(equipJson) || !Array.isArray(projJson)) {
        setLoadError('Neveljaven odgovor strežnika.')
        setSchedules([])
        setCrews([])
        setEquipment([])
        setProjects([])
        setZadnjaOsvezitev(null)
        return
      }
      setSchedules(schedJson as Schedule[])
      setCrews(crewJson as Crew[])
      setEquipment(equipJson as Equipment[])
      setProjects(projJson as Project[])
      setZadnjaOsvezitev(new Date())
      if (!schedProject && projJson.length > 0) setSchedProject(projectId || (projJson as Project[])[0].id)
    } catch {
      // R163: nič tihega ignore — omrežna napaka je vidna z razlogom.
      setLoadError('Ni povezave s strežnikom. Preverite omrežje in poskusite znova.')
      setSchedules([])
      setCrews([])
      setEquipment([])
      setProjects([])
      setZadnjaOsvezitev(null)
    } finally { setLoading(false) }
  }, [projectId, schedProject])

  useEffect(() => { loadData() }, [loadData])

  // R170 — vrnitev v zavihek/okno → ponovno naloži logistiko (pisarna lahko
  // medtem spremeni termine/ekipe/opremo; okno ostane zastarel do remonta —
  // P1-b iz R169). Odločitev je čista lib funkcija (30 s rate-limit, dedup
  // visibilitychange+focus, skrit dokument nikoli ne fetcha); hook ne požira
  // napak — fail-verbose loadError panel ostane EDINI vir resnice o napakah.
  useRefetchOnFocus(loadData)

  const handleCreateSchedule = async () => {
    // R244 — obrambni AND (R242/R243 vzorec: vrata v vratah): gumb je skrit,
    // ta AND je druga plast (naključni klic ne zažene upehanske toke).
    if (!lahkoUpravljaProizvodnjo) return
    if (!schedProject || !schedDate) return
    const start = new Date(`${schedDate}T${schedTime}`)
    const end = new Date(start.getTime() + parseInt(schedHours) * 3600000)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: schedProject,
          crewId: schedCrew || undefined,
          datumZacetka: start.toISOString(),
          datumKonca: end.toISOString(),
          predvideneUre: parseInt(schedHours),
          lokacija: schedLocation,
          // R145 (§31): dodeljena oprema (prazna lista = brez opreme).
          ...(schedEquipment.length > 0 ? { equipmentIds: schedEquipment } : {}),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: '✓ Termin ustvarjen', description: `${formatDate(start.toISOString())} · ${schedHours}h${schedEquipment.length > 0 ? ` · ${schedEquipment.length} kosov opreme` : ''}` })
        setNewScheduleOpen(false)
        setSchedDate(''); setSchedLocation(''); setSchedEquipment([])
        loadData()
      } else {
        toast({ title: 'Napaka', description: data.error, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
  }

  /** R145 (§31): statusna tranzicija opreme (409 z dovoljenimi cilji). */
  const handleEquipmentStatus = async (e0: Equipment, to: string) => {
    // R244 — obrambni AND (vrata v vratah): PATCH /api/equipment je gated.
    if (!lahkoUpravljaProizvodnjo) return
    try {
      const res = await fetch('/api/equipment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: e0.id, status: to }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: `Status → ${EQUIPMENT_STATUS_LABELS[to] ?? to}`, description: e0.naziv })
        loadData()
      } else {
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
  }

  /** R145 (§31): odpri dialog za dogodek + naloži zgodovino (zadnjih 20). */
  const openEventDialog = async (e0: Equipment) => {
    setEventTarget(e0)
    setEventType(e0.calibrationRequired ? 'KALIBRACIJA' : 'PREGLED')
    setEventResult('V_REDU')
    setEventCertificate('')
    setEventNextDue('')
    setEventOpomba('')
    const now = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    setEventDate(`${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`)
    setEventHistory([])
    setEventHistoryNapaka(null)
    setEventHistoryFor(e0.id)
    try {
      const res = await fetch(`/api/equipment/events?equipmentId=${e0.id}`)
      if (res.ok) {
        setEventHistory(await res.json())
        setEventHistoryNapaka(null)
      } else {
        // R203 — zgodovina je naknadna (dialog ostane uporaben), a prazen
        // seznam brez razlage bi lažno trdil "ni dogodkov" — vidna opomba.
        setEventHistoryNapaka(`Zgodovina ni bila naložena (napaka ${res.status}).`)
      }
    } catch {
      setEventHistoryNapaka('Zgodovina ni bila naložena (omrežna napaka).')
    }
  }

  /** R145 (§31): zabeleži dogodek (fail-verbose — 400/403/404/500 se pokažejo). */
  const handleLogEvent = async () => {
    // R244 — obrambni AND (vrata v vratah): POST /api/equipment/events je gated.
    if (!lahkoUpravljaProizvodnjo) return
    if (!eventTarget || !eventDate) return
    setEventBusy(true)
    try {
      const res = await fetch('/api/equipment/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: eventTarget.id,
          type: eventType,
          performedAt: new Date(eventDate).toISOString(),
          result: eventResult,
          ...(eventType === 'KALIBRACIJA' && eventCertificate ? { certificate: eventCertificate } : {}),
          ...(eventType === 'KALIBRACIJA' && eventNextDue ? { nextDueDate: new Date(`${eventNextDue}T12:00:00`).toISOString() } : {}),
          ...(eventOpomba ? { opomba: eventOpomba } : {}),
        }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: `✓ ${EQUIPMENT_EVENT_LABELS[eventType] ?? eventType} zabeležen`, description: eventTarget.naziv })
        setEventTarget(null)
        loadData()
      } else {
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
    finally { setEventBusy(false) }
  }

  /** R146 (§27): odpri preverbo kakovosti za zaključitev termina. */
  const openQcDialog = (id: string, projectId: string, project: string) => {
    setQcTarget({ id, projectId, project })
    setQcChecked({})
    setQcNotes({})
    setQcOverrideMode(false)
    setQcOverrideReason('')
  }

  /** R147 (§28): odpri montažno dokazilo + naloži obstoječe + fotke PRED/PO. */
  const openEvidenceDialog = async (id: string, projectId: string, project: string) => {
    setEvTarget({ id, projectId, project })
    setEvExisting(null)
    setEvLokacija('')
    setEvGpsConsent(false)
    setEvGps(null)
    setEvChecked({})
    setEvNotes({})
    setEvDefects('')
    setEvBeforeId('')
    setEvAfterId('')
    setEvPhotos({ pred: [], po: [] })
    setEvHandoverName('')
    try {
      const [evRes, phRes] = await Promise.all([
        fetch(`/api/evidence?projectId=${projectId}`),
        fetch(`/api/photos?projectId=${projectId}&limit=100`),
      ])
      if (evRes.ok) {
        const data = (await evRes.json().catch(() => null)) as { evidence?: EvidenceRow[] } | null
        const found = data?.evidence?.find((e) => e.scheduleId === id) ?? null
        if (found) {
          setEvExisting(found)
          setEvLokacija(found.lokacija)
          setEvGpsConsent(found.gps !== null)
          if (found.gps) setEvGps({ lat: found.gps.gpsLat, lng: found.gps.gpsLng })
          setEvChecked(Object.fromEntries(found.checklist.map((c) => [c.key, c.checked])))
          setEvNotes(Object.fromEntries(found.checklist.map((c) => [c.key, c.note ?? ''])))
          setEvDefects(found.defects.map((d) => d.opomba).join('\n'))
          setEvBeforeId(found.beforePhotoId ?? '')
          setEvAfterId(found.afterPhotoId ?? '')
          setEvHandoverName(found.handoverName ?? '')
        }
      }
      if (phRes.ok) {
        const photos = (await phRes.json().catch(() => null)) as PhotoRow[] | null
        if (Array.isArray(photos)) {
          setEvPhotos({
            pred: photos.filter((p) => p.kategorija === 'PRED'),
            po: photos.filter((p) => p.kategorija === 'PO'),
          })
        }
      }
    } catch { /* naknadni podatki — dialog ostane uporaben (fail-verbose ob shranjevanju) */ }
  }

  /** R147 (§28): GPS po policyju — koordinate IZ naprave, samo z izrecnim soglasjem. */
  const handleEvGpsConsent = (checked: boolean) => {
    setEvGpsConsent(checked)
    if (!checked) { setEvGps(null); return }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast({ title: 'GPS ni na voljo', description: 'Naprava ne omogoča geolokacije — dokazilo ostane brez koordinat (iskreno neznano).', variant: 'destructive' })
      setEvGpsConsent(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setEvGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        toast({ title: 'Dostop do GPS zavrnjen', description: 'Brez soglasja naprave se koordinate NE zapišejo (fail-closed, ne tiho).', variant: 'destructive' })
        setEvGpsConsent(false)
      },
      { timeout: 8000 },
    )
  }

  /** R147 (§28): checklist payload (isti fail-closed vzorec kot QC). */
  const evChecklistPayload = IEV_TEMPLATE.map((t) => ({
    key: t.key,
    checked: evChecked[t.key] === true,
    note: evNotes[t.key] || null,
  }))
  const evValid = evChecklistPayload.every((i) => i.checked || (i.note && i.note.trim().length > 0))
  const evAllChecked = evChecklistPayload.every((i) => i.checked)
  /** Napake iz tekstualnega polja (vrstica = napaka; opomba je dejstvo terenskega dela). */
  const evDefectsList = evDefects.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)

  /** R147 (§28): shrani dokazilo (POST ali PATCH) — fail-verbose. */
  const handleEvidenceSave = async () => {
    if (!evTarget || !evValid) return
    setEvBusy(true)
    try {
      const payload = {
        ...(evExisting ? { id: evExisting.id } : { projectId: evTarget.projectId, scheduleId: evTarget.id }),
        lokacija: evLokacija,
        checklist: evChecklistPayload,
        defects: evDefectsList.map((opomba) => ({ opomba, reseno: false })),
        gps: { gpsConsent: evGpsConsent, ...(evGpsConsent && evGps ? { gpsLat: evGps.lat, gpsLng: evGps.lng } : {}) },
        ...(evBeforeId ? { beforePhotoId: evBeforeId } : {}),
        ...(evAfterId ? { afterPhotoId: evAfterId } : {}),
      }
      const res = await fetch('/api/evidence', {
        method: evExisting ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => null)) as { error?: string; id?: string } | null
      if (res.ok) {
        toast({ title: evExisting ? '✓ Dokazilo posodobljeno' : '✓ Montažno dokazilo shranjeno', description: evTarget.project })
        if (evExisting && data?.id) await openEvidenceDialog(evTarget.id, evTarget.projectId, evTarget.project)
        else if (!evExisting) await openEvidenceDialog(evTarget.id, evTarget.projectId, evTarget.project)
        loadData()
      } else {
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setEvBusy(false)
    }
  }

  /** R147 (§28): potrdi predajo — strežnik zavrača brez PRED+PO fotk (409). */
  const handleEvidenceHandover = async () => {
    if (!evExisting || !evHandoverName.trim()) return
    setEvBusy(true)
    try {
      const res = await fetch('/api/evidence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evExisting.id, handoverName: evHandoverName.trim() }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: '✓ Predaja potrjena', description: 'Dokazilo je zaklenjeno — nič več ni spreminljivo.' })
        await openEvidenceDialog(evTarget!.id, evTarget!.projectId, evTarget!.project)
        loadData()
      } else {
        toast({ title: 'Predaja ni mogoča', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setEvBusy(false)
    }
  }

  const qcItemsPayload = QC_TEMPLATE.map((t) => ({
    key: t.key,
    checked: qcChecked[t.key] === true,
    note: qcNotes[t.key] || null,
  }))
  const qcPassed = computePassed(qcItemsPayload)
  const qcDefects = countDefects(qcItemsPayload)
  const qcValid = qcItemsPayload.every((i) => i.checked || (i.note && i.note.trim().length > 0))

  /** R146 (§27): shrani preverbo → če je prešla, zaključi termin (PATCH). */
  const handleQcSubmit = async () => {
    // R244 — obrambni AND (vrata v vratah): glavna pot dialoga zaključi
    // termin (PATCH /api/schedules = production.manage); QC zapis brez
    // zaključitve je sledeč zapis — celoten tok je gated kot finalize vrata.
    if (!lahkoUpravljaProizvodnjo) return
    if (!qcTarget || !qcValid) return
    setQcBusy(true)
    try {
      const qcRes = await fetch('/api/qc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: qcTarget.projectId, scheduleId: qcTarget.id, items: qcItemsPayload }),
      })
      const qcData = (await qcRes.json().catch(() => null)) as { error?: string; passed?: boolean } | null
      if (!qcRes.ok) {
        toast({ title: 'Napaka pri preverbi', description: qcData?.error ?? `HTTP ${qcRes.status}`, variant: 'destructive' })
        return
      }
      if (!qcData?.passed) {
        toast({
          title: `Preverba NE prehaja (${qcDefects} napak)`,
          description: 'Zabeležena je kot napaka — zaključitev ostane zaprta do prehoda ali reviziranega override.',
          variant: 'destructive',
        })
        setQcTarget(null)
        return
      }
      await finalizeSchedule(qcTarget.id)
      setQcTarget(null)
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setQcBusy(false)
    }
  }

  /**
   * R146 (§27): zaključi termin — kot override z razlogom (revizirano
   * QC_OVERRIDE) ali po prešli preverbi (brez override). Fail-verbose.
   */
  const finalizeSchedule = async (id: string, overrideReason?: string) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'ZAKLJUCENO', dejanskeUre: undefined, ...(overrideReason ? { qcOverrideReason: overrideReason } : {}) }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: '✓ Termin zaključen', description: overrideReason ? 'Z reviziranim override preverbe.' : 'Preverba kakovosti prešla.' })
        loadData()
      } else {
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    }
  }

  const handleQcOverride = async () => {
    // R244 — obrambni AND (vrata v vratah): override zaključi termin (PATCH).
    if (!lahkoUpravljaProizvodnjo) return
    if (!qcTarget || !qcOverrideReason.trim()) return
    setQcBusy(true)
    try {
      await finalizeSchedule(qcTarget.id, qcOverrideReason.trim())
      setQcTarget(null)
    } finally {
      setQcBusy(false)
    }
  }

  const handleStatusChange = async (id: string, status: string, dejanskeUre?: number) => {
    // R244 — obrambni AND (vrata v vratah): PATCH /api/schedules je gated.
    if (!lahkoUpravljaProizvodnjo) return
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, ...(dejanskeUre ? { dejanskeUre } : {}) }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: `Status → ${STATUS_LABELS[status] || status}` })
        loadData()
      } else {
        // R142: fail-verbose (R140 vzorec) — 403/409/500 se POKAŽE, ne tiho
        // ugine (prej: MONTER ni videl, zakaj "Zaključi" ne dela).
        toast({ title: 'Napaka', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Napaka', variant: 'destructive' }) }
  }

  /** R142 (§30): preloži termin na nov datum/uro (PATCH z novim intervalom). */
  const handleMoveSchedule = async () => {
    // R244 — obrambni AND (vrata v vratah): PATCH /api/schedules je gated.
    if (!lahkoUpravljaProizvodnjo) return
    if (!moveTarget || !moveDate) return
    const start = new Date(`${moveDate}T${moveTime}`)
    const end = new Date(start.getTime() + parseInt(moveHours) * 3600000)
    setMoveBusy(true)
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: moveTarget.id, status: moveTarget.status, datumZacetka: start.toISOString(), datumKonca: end.toISOString() }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (res.ok) {
        toast({ title: '✓ Termin preložen', description: `${formatDate(start.toISOString())} ob ${moveTime}` })
        setMoveTarget(null)
        loadData()
      } else {
        // 409 z razlogom vira ("Ekipa \"X\" ima že termin …") se pokaže cel.
        toast({ title: 'Prekrivanje', description: data?.error ?? `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
    finally { setMoveBusy(false) }
  }

  // R203 — fail-verbose (vzorec R140/R163): uspeh NI edini možen izid.
  // 409 (podvojeno ime) / 401 / 500 se POKAŽEJO z razlogom iz odgovora —
  // prej tiho: dialog ostane odprt brez razlage, uporabnik misli, da klik
  // ni deloval, in ponavlja (duplikati).
  const handleCreateCrew = async () => {
    if (!crewNaziv) return
    try {
      const res = await fetch('/api/crews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ naziv: crewNaziv }) })
      if (res.ok) { toast({ title: 'Ekipa ustvarjena' }); setNewCrewOpen(false); setCrewNaziv(''); loadData() }
      else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast({ title: 'Ustvarjanje ekipe ni uspelo', description: data?.error?.trim() || `Napaka ${res.status}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
  }

  const handleCreateEquip = async () => {
    // R244 — obrambni AND (vrata v vratah): POST /api/crews je gated
    // (production.manage — isti katalog kot ostale pisalne akcije logistike).
    if (!lahkoUpravljaProizvodnjo) return
    if (!equipNaziv) return
    try {
      const res = await fetch('/api/crews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'equipment', naziv: equipNaziv, tip: equipTip }) })
      if (res.ok) { toast({ title: 'Oprema dodana' }); setNewEquipOpen(false); setEquipNaziv(''); loadData() }
      else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast({ title: 'Dodajanje opreme ni uspelo', description: data?.error?.trim() || `Napaka ${res.status}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
  }

  // R163 fail-verbose: viden panel z razlogom + poskus znova — NE lažnega praznega stanja.
  if (loadError) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />
            <p className="text-sm break-words text-roksal-ink">{loadError}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadData()}
            className="shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            aria-label="Ponovno naloži logistiko"
          >
            Poskusi znova
          </Button>
        </div>
      </div>
    )
  }

  // R265 — FRESH fetch VSEH terminov ISTEGA endpointa ob kliku (R264
  // precedens pridobiPozicijo): dokument = PORTFELJSKA resnica (vsi
  // projekti × vsi termini), NE glede na projekt-filter taba — auto-izbor
  // projekta ne sme skriti planskih luknij drugih projektov. Fail-verbose:
  // HTTP napaka ALI ne-polje odgovora → viden razlog (nič tihe degradacije).
  const handleProjektiTerminiPdf = async () => {
    if (ptVTeku) return
    setPtVTeku(true)
    try {
      const res = await fetch('/api/schedules', { credentials: 'same-origin' })
      if (!res.ok) {
        throw new Error(`GET /api/schedules → HTTP ${res.status}`)
      }
      const data: unknown = await res.json()
      if (!Array.isArray(data)) {
        throw new TypeError('Odgovora /api/schedules ni mogoče prebrati (ni polja).')
      }
      // Fail-verbose DTO pruning (R264 vzorec — nič tihe degradacije):
      // surove resnice projectId/status/predvideneUre/datumZacetka +
      // projekti id/naziv/datumMontaze/stranka. Resnice (status 5 znanih,
      // ISO, identitete) preverja LIB fail-closed.
      const termini: ProjektiTerminiTerminVnos[] = (data as Array<Record<string, unknown>>).map((s, i) => {
        const projekt = s.project as { id?: unknown } | undefined
        if (!projekt || typeof projekt.id !== 'string' || projekt.id === '') {
          throw new TypeError(`termin vrstica ${i}: manjkajoč project.id v odgovoru API-ja`)
        }
        return {
          projectId: projekt.id,
          status: s.status as ProjektiTerminiTerminVnos['status'],
          predvideneUre: typeof s.predvideneUre === 'number' ? s.predvideneUre : null,
          datumZacetka: s.datumZacetka as string,
        }
      })
      const projekti: ProjektiTerminiProjektVnos[] = projects.map((p, i) => {
        if (typeof p.id !== 'string' || p.id === '' || typeof p.nazivProjekta !== 'string' || p.nazivProjekta === '') {
          throw new TypeError(`projekt vrstica ${i}: manjkajoč id/nazivProjekta v odgovoru API-ja`)
        }
        return {
          id: p.id,
          nazivProjekta: p.nazivProjekta,
          datumMontaze: typeof p.datumMontaze === 'string' ? p.datumMontaze : null,
          stranka: p.customer && typeof p.customer.ime === 'string' ? p.customer.ime : null,
        }
      })
      if (termini.length === 0) {
        // Fail-closed jedro: prazen seznam ne nastaja dokumenta — iskren toast.
        toast({ title: 'Ni vpisanih terminov', description: 'Pregled projektov in terminov se izvozi, ko je vpisan prvi termin montaže.' })
        return
      }
      // ENA izpeljava: povzetek za toast = ISTA resnica kot KPI IN sklep na
      // listu (WYSIWYG).
      const { povzetek } = projektiTerminiPregled(projekti, termini)
      generateProjektiTerminiPdf(projekti, termini, { now: new Date() })
      toast({
        title: 'Pregled projektov in terminov prenešen v PDF',
        description: `Projekti-termini-…pdf — ${povzetek.zTermini} ${projektBeseda(povzetek.zTermini)} z termini, ${povzetek.terminov} ${terminBeseda(povzetek.terminov)}, brez termina ${povzetek.brezTermina}.`,
      })
    } catch (err) {
      if (err instanceof TypeError) {
        // fail-closed jedro: pokvaren vnos → viden razlog (nič izmišljenega dokumenta)
        toast({ title: 'Pregled projektov in terminov ni mogoče sestaviti iz teh podatkov', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
      } else {
        toast({ title: `Izvoz PDF ni uspel: ${err instanceof Error ? err.message : String(err)}`, variant: 'destructive' })
      }
    } finally {
      setPtVTeku(false)
    }
  }

  // R266 — OPREMA — ŽIVLJENJSKI CIKL PDF (22. člen 'izvozi' družine, P1-f):
  // FRESH fetch VSE opreme ISTEGA endpointa ob kliku (R244/R245/R264/R265
  // precedens — route NIČ, nič nove mreže) — POLNA resnica, paginacija čez
  // limit 100 (do MAX_OFFSET 10.000) — TIHA REZINA je prepovedana (100
  // zadetkov ≠ 'vsa oprema', nič ne pove, da vir ima več). Fail-verbose:
  // HTTP napaka ALI ne-polje odgovora → viden razlog (nič tihe degradacije);
  // resnice (status 5 znanih, booleans, ISO, identitete) preverja LIB
  // fail-closed z indeksom krivca.
  // R297 — ENA izpeljava vira opreme (PDF brat R266 + CSV brat R297): FRESH
  // paginirani fetch VSE opreme + fail-verbose DTO pruning v ENI funkciji —
  // NIČ dvojnega med bralci (vzorec memo koledarVnosi R295 / memo izpeljava
  // družine); tiha rezina prepovedana, MAX_OFFSET meja poimenovana.
  const pridobiOpremoVnosi = async (): Promise<OpremaCikelVnos[]> => {
    const vnosi: OpremaCikelVnos[] = []
    const limit = 100
    let offset = 0
    for (;;) {
      const res = await fetch(`/api/equipment?limit=${limit}&offset=${offset}`, { credentials: 'same-origin' })
      if (!res.ok) {
        throw new Error(`GET /api/equipment → HTTP ${res.status}`)
      }
      const data: unknown = await res.json()
      if (!Array.isArray(data)) {
        throw new TypeError('Odgovora /api/equipment ni mogoče prebrati (ni polja).')
      }
      const stran = data as Array<Record<string, unknown>>
      for (let i = 0; i < stran.length; i++) {
        const e = stran[i]
        if (typeof e.id !== 'string' || e.id === '' || typeof e.naziv !== 'string' || e.naziv === '') {
          throw new TypeError(`oprema vrstica ${offset + i}: manjkajoč id/naziv v odgovoru API-ja`)
        }
        const tipApi = typeof e.tip === 'string' ? e.tip : ''
        const tip = EQUIPMENT_TYPES[tipApi] ?? (tipApi !== '' ? tipApi : null)
        if (tip === null) {
          throw new TypeError(`oprema vrstica ${offset + i}: manjkajoč tip v odgovoru API-ja`)
        }
        // Fail-verbose DTO pruning (R264/R265 vzorec): identitete + tip tu
        // (imenovan razlog), ostalo VERBATIM — lib preveri z indeksom krivca.
        vnosi.push({
          id: e.id,
          naziv: e.naziv,
          tip,
          status: e.status as OpremaCikelVnos['status'],
          lokacija: (e.lokacija ?? null) as string | null,
          serijskaStevilka: (e.serijskaStevilka ?? null) as string | null,
          lastInspectionAt: (e.lastInspectionAt ?? null) as string | null,
          inspectionIntervalDays: (e.inspectionIntervalDays ?? null) as number | null,
          nextInspectionAt: (e.nextInspectionAt ?? null) as string | null,
          inspectionDue: e.inspectionDue as boolean,
          inspectionUnknown: e.inspectionUnknown as boolean,
          calibrationRequired: e.calibrationRequired as boolean,
          calibrationDueDate: (e.calibrationDueDate ?? null) as string | null,
          calibrationCertificate: (e.calibrationCertificate ?? null) as string | null,
          calibrationOverdue: e.calibrationOverdue as boolean,
          calibrationMissing: e.calibrationMissing as boolean,
          zadnjiServis: (e.zadnjiServis ?? null) as string | null,
          assignmentsCount: e.assignmentsCount as number,
        })
      }
      if (stran.length < limit) break
      offset += limit
      if (offset > 10_000) {
        // Iskrena meja vira (MAX_OFFSET /api/equipment) — NI tihe rezine.
        throw new TypeError('Več kot 10.000 kosov opreme — nad mejo paginacije vira (MAX_OFFSET) — izvoz zavrnjen (ni tihe rezine).')
      }
    }
    return vnosi
  }

  const handleOpremaCikelPdf = async () => {
    if (ocVTeku) return
    setOcVTeku(true)
    try {
      const vnosi = await pridobiOpremoVnosi()
      if (vnosi.length === 0) {
        // Fail-closed jedro: prazen seznam ne nastaja dokumenta — iskren toast.
        toast({ title: 'Ni vpisane opreme', description: 'Pregled življenjskega cikla se izvozi, ko je vpisan prvi kos opreme.' })
        return
      }
      // ENA izpeljava: povzetek za toast = ISTA resnica kot KPI IN sklep na
      // listu (WYSIWYG).
      const { povzetek } = opremaCikelPregled(vnosi)
      generateOpremaCikelPdf(vnosi, { now: new Date() })
      toast({
        title: 'Pregled opreme prenešen v PDF',
        description: `Oprema-cikel-…pdf — ${povzetek.oprem} ${kosBeseda(povzetek.oprem)}, zapadel pregled ${povzetek.pregledZapadel}, potečena kalibracija ${povzetek.kalPotecena}.`,
      })
    } catch (err) {
      if (err instanceof TypeError) {
        // fail-closed jedro: pokvaren vnos → viden razlog (nič izmišljenega dokumenta)
        toast({ title: 'Pregled opreme ni mogoče sestaviti iz teh podatkov', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
      } else {
        toast({ title: `Izvoz PDF ni uspel: ${err instanceof Error ? err.message : String(err)}`, variant: 'destructive' })
      }
    } finally {
      setOcVTeku(false)
    }
  }

  // R297 — OPREMA CIKEL CSV (27. člen 'izvozi' družine): CSV brat PDF R266 —
  // ISTA cikl resnica (opremaCikelPregled EN VIR — preverba + projekcija +
  // NAZIV ASC sort + povzetek, cenikDatumIso EN VIR, Sklep VERBATIM) kot
  // ravninska tabela za Excel/revizijo. Fail-closed: 0 kosov → iskren toast
  // (ISTI gate kot brat); dvoklik guard (pariteta brata); toast pove ISTO
  // agregatno resnico (WYSIWYG).
  const handleOpremaCikelCsv = async () => {
    if (ocCsvVTeku) return
    setOcCsvVTeku(true)
    try {
      const vnosi = await pridobiOpremoVnosi()
      if (vnosi.length === 0) {
        // Fail-closed jedro: prazen seznam ne nastaja datoteke — iskren toast.
        toast({ title: 'Ni vpisane opreme', description: 'CSV se izvozi, ko je vpisan prvi kos opreme.' })
        return
      }
      const now = new Date()
      const { csv } = opremaCikelCsv(vnosi, now)
      const ime = opremaCikelCsvFilename(now)
      downloadCsvText(ime, csv)
      const { povzetek } = opremaCikelPregled(vnosi)
      toast({
        title: `Pregled opreme prenešen v CSV (${ime})`,
        description: `Oprema-cikel-…csv — ${povzetek.oprem} ${kosBeseda(povzetek.oprem)}, zapadel pregled ${povzetek.pregledZapadel}, potečena kalibracija ${povzetek.kalPotecena}.`,
      })
    } catch (err) {
      if (err instanceof TypeError) {
        toast({ title: 'Pregled opreme CSV ni mogoče sestaviti iz teh podatkov', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
      } else {
        toast({ title: `Izvoz CSV ni uspel: ${err instanceof Error ? err.message : String(err)}`, variant: 'destructive' })
      }
    } finally {
      setOcCsvVTeku(false)
    }
  }

  // R301 — 31. člen 'izvozi' družine: KONFLIKTI CSV — CSV brat pregledu R300
  // (vzorec R292/R297): dokazane PARE prekrivanj ekipe namesto števca na
  // zaslonu (WYSIWYG po konstrukciji — tedenskiKonflikti EN VIR; ISTO okno,
  // ISTA pravila, ISTI pari f(množica)). Fail-closed PREJ: prazno okno →
  // iskren toast (ISTI gate kot Tedenski R292), zelen žig (null pregled =
  // iskrena čistost) → iskren toast — NIKOLI prazna datoteka (družina
  // R266/R297). now = tedenskiRazgledNow — ENA izpeljava časa za pregled +
  // CSV + ime (lekcija R121/R235; žig na zaslonu in datoteka STA ISTA
  // resnica po konstrukciji). Sklep v toastu = ISTI konfliktiSklep kot meta
  // vrstica (WYSIWYG); dvoklik guard (pariteta tedenskiCsvVTeku R292);
  // fail-verbose catch (R291 vzorec).
  const handleKonfliktiCsv = () => {
    if (konfliktiCsvVTeku) return
    setKonfliktiCsvVTeku(true)
    try {
      if (razgled.pov === null) {
        toast({
          title: 'Ni terminov v naslednjih 7 dneh',
          description: 'Konflikti CSV se izvozi, ko je vpisan termin v prihajajočem tednu.',
        })
        return
      }
      if (konfliktiPregled === null) {
        // Iskrena čistost (zelen žig) — ni prazne datoteke (družina R266/R297).
        toast({
          title: 'Ni dokazanih konfliktov v okviru',
          description: 'Žig je zelen — CSV se izvozi ob prvem dokazanem prekrivanju (rdeč žig).',
        })
        return
      }
      const now = tedenskiRazgledNow
      const { csv } = konfliktiCsv(vozniRedVnosi, now)
      const ime = konfliktiCsvFilename(now)
      downloadCsvText(ime, csv)
      toast({
        title: `Konflikti prenešeni v CSV (${ime})`,
        description: konfliktiSklep(konfliktiPregled),
      })
    } catch (err) {
      toast({ title: 'Izvoz konfliktov CSV ni uspel', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
    } finally {
      setKonfliktiCsvVTeku(false)
    }
  }

  // R302 — 32. člen 'izvozi' družine: KONFLIKTI PDF — PDF brat pregledu
  // R300 + CSV R301 (vzorec R284→R285/R292/R297): DOKAZ na tisku za
  // pisarno/revizijo (WYSIWYG po konstrukciji — tedenskiKonflikti EN VIR;
  // glava tabele + Sklep UVOŽENA iz CSV brata R301). Fail-closed PREJ:
  // prazno okno → iskren toast (ISTI gate kot CSV R301), zelen žig (null
  // pregled = iskrena čistost) → iskren toast — NIKOLI prazna datoteka
  // (družina R266/R297/R301). now = tedenskiRazgledNow — ENA izpeljava
  // časa za pregled + CSV + PDF + imeni (lekcija R121/R235; žig na zaslonu,
  // CSV in PDF sta ISTA resnica po konstrukciji). Sklep v toastu = ISTI
  // konfliktiSklep kot meta vrstica + rdeč žig (WYSIWYG); dvoklik guard
  // (pariteta konfliktiCsvVTeku R301); fail-verbose catch (R291 vzorec).
  const handleKonfliktiPdf = () => {
    if (konfliktiPdfVTeku) return
    setKonfliktiPdfVTeku(true)
    try {
      if (razgled.pov === null) {
        toast({
          title: 'Ni terminov v naslednjih 7 dneh',
          description: 'Konflikti PDF se izvozi, ko je vpisan termin v prihajajočem tednu.',
        })
        return
      }
      if (konfliktiPregled === null) {
        // Iskrena čistost (zelen žig) — ni prazne datoteke (družina R266/R297/R301).
        toast({
          title: 'Ni dokazanih konfliktov v okviru',
          description: 'Žig je zelen — PDF se izvozi ob prvem dokazanem prekrivanju (rdeč žig).',
        })
        return
      }
      const now = tedenskiRazgledNow
      generateKonfliktiPdf(vozniRedVnosi, { now })
      toast({
        title: `Konflikti prenešeni v PDF (${konfliktiPdfFilename(now)})`,
        description: konfliktiSklep(konfliktiPregled),
      })
    } catch (err) {
      toast({ title: 'Izvoz konfliktov PDF ni uspel', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
    } finally {
      setKonfliktiPdfVTeku(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Subtabs */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        <Button type="button" variant={subtab === 'calendar' ? 'default' : 'ghost'} size="sm" onClick={() => setSubtab('calendar')} className={subtab === 'calendar' ? 'bg-roksal-navy text-white' : ''}>
          <Calendar aria-hidden="true" className="h-3.5 w-3.5 mr-1" /> Koledar
        </Button>
        <Button type="button" variant={subtab === 'crews' ? 'default' : 'ghost'} size="sm" onClick={() => setSubtab('crews')} className={subtab === 'crews' ? 'bg-roksal-navy text-white' : ''}>
          <Users aria-hidden="true" className="h-3.5 w-3.5 mr-1" /> Ekipe
        </Button>
        <Button type="button" variant={subtab === 'equipment' ? 'default' : 'ghost'} size="sm" onClick={() => setSubtab('equipment')} className={subtab === 'equipment' ? 'bg-roksal-navy text-white' : ''}>
          <Wrench aria-hidden="true" className="h-3.5 w-3.5 mr-1" /> Oprema
        </Button>
      </div>

      {/* Calendar tab */}
      {subtab === 'calendar' && (
        <div className="space-y-3">
          {/* R292 — TEDENSKI RAZGLED (MANDATORY STIL) — 7-dnevni razgled NA
              ZASLONU (do zdaj samo v PDF R256): ENA resnica z izvozi — EN VIR
              tedenskiRazgled (ISTI okno/sort/stevec kot PDF IN CSV —
              divergenca nemogoča). PRAZNI dnevi = iskreno 0 (NIKOLI skriti —
              'kateri dnevi prazni' JE resnica razgleda); preklicani = viden
              rdeč števec (iskren odpad — PDF RED bold pariteta); mini tir
              vzorec R291: širina = terminov / najbolj obremenjen dan × 100 —
              ISTO merilo za VSE dni, 0 % iskreno pri praznem oknu,
              aria-hidden (številka nosi resnico), hover title z izrečeno
              izpeljavo. 0 novih hex — samo obstoječi žetoni. */}
          <div
            className="rounded-lg border border-border bg-muted/40 px-3 py-2"
            role="group"
            aria-label="Tedenski razgled — naslednjih 7 dni"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <p className="text-2xs font-medium text-roksal-ink">Tedenski razgled</p>
              <p className="text-2xs text-muted-foreground" data-testid="tedenski-razgled-sklep">
                {razgled.pov === null
                  ? 'Naslednjih 7 dni brez vpisanih terminov.'
                  : `${tedenskiRazgledSklep(razgled.pov)}.`}
              </p>
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1">
              {razgled.dnevi.map((d) => {
                const sirina =
                  razgled.maxTerminov === 0
                    ? 0
                    : Math.min(100, Math.round((d.terminov / razgled.maxTerminov) * 100))
                return (
                  <div
                    key={d.dan}
                    className="min-w-0 text-center"
                    title={`${d.ime} ${cenikDatumIso(d.dan)}: ${d.terminov} ${terminBeseda(d.terminov)} — ${sirina} % najbolj obremenjenega dne${d.preklicani > 0 ? ` · preklicani ${d.preklicani}` : ''}`}
                  >
                    <p className="truncate text-2xs font-medium text-roksal-ink">{d.ime.slice(0, 3)}</p>
                    {/* R298 — definicijski naslov datuma (izrečena resnica:
                        ISO dan okna, ISTI izpis kot PDF/CSV bratje). */}
                    <p
                      className="text-2xs text-muted-foreground tabular-nums"
                      title={`${d.ime} — ${cenikDatumIso(d.dan)} (danes + ${razgled.okno.indexOf(d.dan)} dni, UTC)`}
                    >
                      {cenikDatumIso(d.dan)}
                    </p>
                    {/* R298 — definicijski naslov številčne resnice (izrečena
                        izpeljava: števec = VSI vidni termini dneva, preklicani
                        ŠTETI — viden odpad, PDF pariteta). */}
                    <p
                      className={`text-2xs tabular-nums ${d.preklicani > 0 ? 'font-medium text-roksal-red' : 'text-muted-foreground'}`}
                      title={d.terminov === 0 ? 'Brez terminov — iskreno prazen dan' : `Vsi vidni termini dneva (preklicani ŠTETI — viden odpad)`}
                    >
                      {d.terminov}
                    </p>
                    <div className="mt-0.5 h-1 rounded-full bg-muted" aria-hidden="true">
                      <div className="h-1 rounded-full bg-roksal-navy/30" style={{ width: `${sirina}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            {/* R300 — 30. člen (issue #1 §7 branje): KONFLIKTNA MINI-VRSTICA
                (WYSIWYG — ISTA izpeljava kot celotna tedenska družina):
                null pregled = iskrena čistost '0' (zelen — invarianta
                dokazana); konflikti = rdeč žig z ekipami (viden odpad,
                PDF/razgled pariteta). Vidna SAMO, ko ima okno vsaj 1 termin
                (razgled.pov !== null — brez terminov ni česa pregledati,
                iskrena praznina, R295/R296 vzorec). Definicijski naslov
                izreče PRAVILA (poli-odprto, statusi, null konec) — MANDATORY
                STIL; 0 novih hex — samo obstoječi žetoni. */}
            {razgled.pov !== null && (
              <p
                className={`mt-1 text-2xs font-medium ${konfliktiPregled === null ? 'text-roksal-green' : 'text-roksal-red'}`}
                role="status"
                data-testid="tedenski-konflikti-mini"
                title="Pregled dvojnih rezervacij ekipe v 7-dnevnem okviru (danes + 6 dni, UTC) — isti poli-odprto pravilo kot API 409: konec 12:00 + začetek 12:00 je dovoljen nazaj-na-nazaj; Preklicano/Zaključeno ne zasede; termin brez vpisanega konca NE nosi dokazanega prekrivanja (nikoli izmišljen). Bralni pregled — zapisno stran brani POST/PATCH (409 z razlogom)."
              >
                {konfliktiPregled === null
                  ? 'Konflikti: 0 — brez dvojnih rezervacij ekipe v okviru.'
                  : `Konflikti: ${konfliktiPregled.stPrekrivanj} · ekipe: ${konfliktiPregled.skupine.map((s) => s.ekipa).join(', ')} — dvojne rezervacije v okviru (poli-odprto pravilo).`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {/* R244 — wave 6 RBAC ogledalo: CTA 'Nov termin montaže' je VIDEN
                samo vlogi s pravico production.manage (API POST /api/schedules).
                Med nalaganjem (null) skrit — tišina je iskrena, least privilege
                (R242); bralni CSV izvoz ostaja (odjemalski dokument, P1-k). */}
            {lahkoUpravljaProizvodnjo && (
              <Button type="button" onClick={() => setNewScheduleOpen(true)} className="flex-1 bg-roksal-navy text-white shadow-sm press-scale hover:bg-roksal-navy/90 transition-all">
                <Plus aria-hidden="true" className="h-4 w-4 mr-2" /> Nov termin montaže
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={schedules.length === 0}
              aria-label="Izvozi vidne termine kot CSV"
              title="Termine kot preglednico (Excel)"
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={() => {
                // R173 — EN VIR RESNICE: povzetek = ISTI lib klic kot vrstica
                // nad seznamom; osvezitev = ISTI pečat kot glava; obseg =
                // realen obseg poizvedbe (/api/schedules[?projectId=…]).
                const n = downloadSchedulesCsv(schedules, {
                  povzetek: terminUrPovzetekRazsirjen(urPovzetek.ag, urPovzetek.preskoceni),
                  osvezitev: zadnjaOsvezitev,
                  obseg: projectId ? 'Filtrirano na projekt' : 'Vsi termini',
                })
                if (n > 0) toast({ title: `CSV izvožen (${n} terminov)`, description: 'Datoteka vsebuje vidne termine — odpravite jo v Excelu.' })
              }}
            >
              <Download aria-hidden="true" className="h-4 w-4 mr-1"  /> CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={schedules.length === 0}
              aria-label="Izvozi termine montaže kot koledarsko datoteko (.ics)"
              title="Termine odpri v Google/Apple/Outlook koledarju"
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={() => {
                const n = downloadIcs(schedules)
                if (n > 0) toast({ title: `Koledar izvožen (${n} terminov)`, description: 'Datoteko odpri v telefonu — dogodki se dodajo v koledar.' })
              }}
            >
              <Download aria-hidden="true" className="h-4 w-4 mr-1"  /> .ics
            </Button>
            {/* R255 — 11. člen 'izvozi' družine (P1-f): VOZNI RED MONTAŽ PDF —
                terenski list ekipe (kronološki red, ISTI vir kot seznam:
                normalizirajTermin). VEDNO viden (P1-k precedens R251–R253):
                prazen seznam → iskren fail-closed toast, NIKOLI prazna
                datoteka; agregat v toastu = ISTI lib povzetek kot KPI/sklep
                na listu (WYSIWYG). */}
            <Button
              type="button"
              variant="outline"
              aria-label="Izvozi vozni red montaž kot PDF"
              title="Vozni red montaž kot terenski list (kronološki red)"
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={() => {
                if (vozniRedVnosi.length === 0) {
                  toast({
                    title: 'Ni vidnih terminov montaže',
                    description: 'PDF se izvozi, ko je vpisan prvi termin montaže.',
                  })
                  return
                }
                const pov = vozniRedPovzetek(vozniRedVnosi)
                generateVozniRedPdf(vozniRedVnosi, { now: new Date() })
                toast({
                  title: 'Vozni red prenešen v PDF',
                  description: `${pov.terminovN} terminov, ${vozniRedUreKpi(pov)} h, ${pov.ekipN} ekip.`,
                })
              }}
            >
              <Truck aria-hidden="true" className="h-4 w-4 mr-1" /> PDF
            </Button>
            {/* R256 — 12. člen 'izvozi' družine (P1-f): TEDENSKI VOZNI RED PDF —
                7-dnevni razgled po dnevih za pisarno/vodstvo (kateri dnevi so
                polni, kateri prazni — NA EN POGLED). ISTI vir kot vozni red
                R255 (vozniRedVnosi — normalizirajTermin); okno = danes +
                6 dni UTC (determinizem čez pasove); preklicani VIDNO RED bold.
                VEDNO viden (P1-k precedens R251–R255): prazno okno → iskren
                fail-closed toast, NIKOLI prazna datoteka; agregat v toastu =
                ISTI lib povzetek kot KPI/sklep na listu (WYSIWYG). */}
            <Button
              type="button"
              variant="outline"
              aria-label="Izvozi tedenski pregled montaž kot PDF"
              title="Tedenski pregled montaž — naslednjih 7 dni (razgled po dnevih)"
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={() => {
                const pov = tedenskiPregledPovzetek(vozniRedVnosi, new Date())
                if (pov === null) {
                  toast({
                    title: 'Ni terminov v naslednjih 7 dneh',
                    description: 'Tedenski pregled se izvozi, ko je vpisan termin v prihajajočem tednu.',
                  })
                  return
                }
                generateTedenskiVozniRedPdf(vozniRedVnosi, { now: new Date() })
                toast({
                  title: 'Tedenski pregled prenešen v PDF',
                  description: `${pov.dniN} dni, ${pov.terminovN} terminov, ${tedenskiUreKpi(pov)} h.`,
                })
              }}
            >
              <CalendarRange aria-hidden="true" className="h-4 w-4 mr-1" /> Tedenski
            </Button>
            {/* R292 — 23. člen 'izvozi' družine (P1-f): TEDENSKI VOZNI RED
                CSV — CSV brat PDF R256 (vzorec R284→R285/R291): ISTI okno/
                sort/stevec EN VIR tedenskiRazgled + tedenskiPregledPovzetek —
                WYSIWYG po konstrukciji. VEDNO viden (P1-k/R232 kanon):
                prazno okno → iskren fail-closed toast, NIKOLI prazna
                datoteka (R250/R291 vzorec); toast = ISTI lib sklep kot
                razgled (sklanjatev EN VIR terminBeseda). */}
            <Button
              type="button"
              variant="outline"
              aria-label="Izvozi tedenski pregled montaž kot CSV"
              title="Tedenski pregled montaž kot CSV — ista resnica kot PDF (dnevi · termini · ure)"
              disabled={tedenskiCsvVTeku}
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={handleTedenskiCsv}
            >
              <FileSpreadsheet aria-hidden="true" className="h-4 w-4 mr-1" /> CSV
            </Button>
            {/* R298 — 28. člen 'izvozi' družine (P1-f): TEDENSKI VOZNI RED
                ICS — ICS brat PDF R256 + CSV R292 (ISTI tedenskiRazgled —
                TRETJI potrošnik ISTEGA razgleda): naslednjih 7 dni kot RFC
                5545 koledar za EKIPO (uvozi v telefon; DTSTART/DTEND =
                resnične ure + predvideno trajanje po R139/R172 kanonu;
                STATUS = CANCELLED/TENTATIVE/CONFIRMED preslikava R139/R172;
                X-ROKSAL-STATUS = status VERBATIM). VEDNO viden (P1-k/R232
                kanon): prazno okno → iskren fail-closed toast, NIKOLI
                prazna datoteka; dvoklik guard (pariteta tedenskiCsvVTeku
                R292); ISTI žetoni kot bratje — 0 novih hex. */}
            <Button
              type="button"
              variant="outline"
              aria-label="Izvozi tedenski pregled montaž kot ICS koledar"
              title="Tedenski pregled montaž kot ICS — naslednjih 7 dni v telefonov koledar (ekipa uvozi razpored; ure in statusi iz iste resnice kot PDF/CSV)"
              disabled={tedenskiIcsVTeku}
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={handleTedenskiIcs}
            >
              <Calendar aria-hidden="true" className="h-4 w-4 mr-1" /> Tedenski ICS
            </Button>
            {/* R301 — 31. člen 'izvozi' družine (P1-f): KONFLIKTI CSV — CSV
                brat pregledu R300: dokazani PARI prekrivanj ekipe za
                pisarno/revizijo (mini-vrstica pokaže ŠTEVEC, CSV pokaže
                DOKAZ — vsak par = vrstica z obema članoma, VERBATIM ISO časa
                kot ICS bratje). VEDNO viden (P1-k/R232 kanon): prazno okno
                ALI zelen žig → iskren fail-closed toast, NIKOLI prazna
                datoteka (R250/R291 vzorec); dvoklik guard (pariteta
                tedenskiCsvVTeku R292); ISTI žetoni kot bratje — 0 novih hex
                (FileSpreadsheet import ŽE obstaja — 0 pin premikov ikon).
                Definicijski naslov (MANDATORY STIL): izreče PRAVILA
                (poli-odprto, statusi, null konec) + vidno razliko
                (števec na zaslonu, pari v datoteki). */}
            <Button
              type="button"
              variant="outline"
              aria-label="Izvozi dokazane konflikte tedenskega pregleda kot CSV"
              title="Konflikti tedenskega pregleda kot CSV — dokazani pari prekrivanj ekipe (isti poli-odprto pregled kot žig nad seznamom; konec 12:00 + začetek 12:00 je dovoljen nazaj-na-nazaj; Preklicano/Zaključeno ne zasede; termin brez konca NE nosi prekrivanja). Žig zelen = ni datoteke (iskren toast) — datoteka nastane ob prvem dokazanem prekrivanju"
              data-testid="konflikti-csv-pill"
              disabled={konfliktiCsvVTeku}
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={handleKonfliktiCsv}
            >
              <FileSpreadsheet aria-hidden="true" className="h-4 w-4 mr-1" /> Konflikti CSV
            </Button>
            {/* R302 — 32. člen 'izvozi' družine (P1-f): KONFLIKTI PDF — PDF
                brat pregledu R300 + CSV R301: DOKAZANI PARI prekrivanj ekipe
                na TISKU za pisarno/revizijo (mini-vrstica pokaže ŠTEVEC, CSV
                strojne vrstice, PDF človeški dokaz — isti pari, isti čas,
                isti sklep; glava tabele + Sklep UVOŽENA iz CSV brata).
                VEDNO viden (P1-k/R232 kanon): prazno okno ALI zelen žig →
                iskren fail-closed toast, NIKOLI prazna datoteka (R250/R291
                vzorec); dvoklik guard (pariteta konfliktiCsvVTeku R301);
                ISTI žetoni kot bratje — 0 novih hex (AlertTriangle import
                ŽE obstaja — 0 pin premikov ikon). Definicijski naslov
                (MANDATORY STIL): izreče PRAVILA (poli-odprto, statusi,
                null konec) + vidno razliko medija (CSV = Excel, PDF = tisk). */}
            <Button
              type="button"
              variant="outline"
              aria-label="Izvozi dokazane konflikte tedenskega pregleda kot PDF"
              title="Konflikti tedenskega pregleda kot PDF — dokazani pari prekrivanj ekipe na tisku (isti poli-odprto pregled kot žig in CSV brat; konec 12:00 + začetek 12:00 je dovoljen nazaj-na-nazaj; Preklicano/Zaključeno ne zasede; termin brez konca NE nosi prekrivanja). Žig zelen = ni datoteke (iskren toast) — datoteka nastane ob prvem dokazanem prekrivanju"
              data-testid="konflikti-pdf-pill"
              disabled={konfliktiPdfVTeku}
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={handleKonfliktiPdf}
            >
              <AlertTriangle aria-hidden="true" className="h-4 w-4 mr-1" /> Konflikti PDF
            </Button>
            {/* R265 — 21. člen 'izvozi' družine (P1-f): PROJEKTI — TERMINI
                PREGLED PDF — presek VSEH terminov (/api/schedules — FRESH
                fetch ISTEGA endpointa ob kliku, R244/R245/R264 precedens;
                route NIČ, nič nove mreže) × /api/projects (ŽE v state).
                PORTFELJSKA resnica — ne glede na projekt-filter taba (auto-
                izbor projekta ne skrije planskih luknij drugih projektov).
                Bralni dokument VEDNO viden (P1-k precedens R251–R256):
                prazen seznam terminov → iskren fail-closed toast, NIKOLI
                prazna datoteka; agregat v toastu = ISTI lib povzetek kot
                KPI/sklep na listu (WYSIWYG). ISTI žetoni kot vozni red/
                tedenski pilli — 0 novih hex. */}
            <Button
              type="button"
              variant="outline"
              aria-label="Izvozi pregled projektov in terminov kot PDF"
              title="Pregled projektov in terminov kot pravi PDF — kateri projekti imajo termine in koliko dela je še pred nami"
              disabled={ptVTeku}
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={handleProjektiTerminiPdf}
            >
              <ClipboardList aria-hidden="true" className="h-4 w-4 mr-1" /> Projekti
            </Button>
          </div>

          {/* R299 — 29. člen 'izvozi' družine: ICS PO EKIPAH — čipi za vsako
              ekipo z vsaj enim terminom v oknu (EN VIR tedenskiEkipaImena —
              ISTI seznam kot izvoz; null ekipe NIKOLI čip — '—' ni ekipa).
              Podatkovno-pogojni vidnost (ekipe obstajajo → čipi; 0 ekip =
              iskrena praznina, brez mrtvega gumba — P1-k kanon). ISTI žetoni
              kot bratje — 0 novih hex; Users import ŽE obstaja (0 pin
              premikov ikon). Definicijski naslov (MANDATORY STIL): izrečena
              resnica filtra (ISTO okno + TOČEN filter ISTEGA vira). */}
          {ekipaImena.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tedenski ICS po ekipah">
              <span className="text-2xs text-muted-foreground" title="Ekipa z vsaj enim terminom v naslednjih 7 dneh (danes + 6 dni, UTC) — isti vir kot Tedenski ICS; brez ekipe ('—') NIMA čipa, ker ni ekipa">
                ICS po ekipi:
              </span>
              {ekipaImena.map((ekipa) => (
                <Button
                  key={ekipa}
                  type="button"
                  variant="outline"
                  aria-label={`Izvozi tedenski ICS samo za ekipo ${ekipa}`}
                  title={`Samo termini ekipe ${ekipa} v istem 7-dnevnem okviru (danes + 6 dni, UTC) — točen filter ISTEGA vira kot Tedenski ICS; datoteka nosi X-ROKSAL-EKIPA in lastno UID predpono (ni trkov z osnovnim ICS)`}
                  disabled={tedenskiEkipaIcsVTeku !== null}
                  className="h-7 shrink-0 px-2 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                  onClick={() => handleTedenskiEkipaIcs(ekipa)}
                >
                  <Users aria-hidden="true" className="h-3 w-3 mr-1" /> {ekipa}
                </Button>
              ))}
            </div>
          )}

          {/* R255 — legenda izvozne skupine (ISTI vzorec kot R250–R253
              legende na CRM/računih): vsak izvoz = svoja resnica, ločilnik
              '·' + poimenovana razlika. */}
          {/* R256 — legenda razširjena z tedenskim razgledom (R256 needle je
              dobesedni PREDPONA — R255 resnica ostaja bajtno ISTA). */}
          <p className="text-2xs text-muted-foreground">
            CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki) · Tedenski = naslednjih 7 dni (po dnevih) · Projekti = projekti × termini (pokritost po projektih) · Tedenski CSV = ista resnica kot PDF
            {' · Tedenski ICS = naslednjih 7 dni v telefonov koledar'}
            {' · ICS po ekipi = samo termini te ekipe (isti 7-dnevni okvir)'}
            {' · Konflikti CSV = dokazani pari prekrivanj ekipe (isti pregled kot žig)'}
            {' · Konflikti PDF = isti pregled kot CSV, tisk za pisarno'}
          </p>

          {/* R244 — vlogo-osveščen vodič (R242/R243 recept): viden SAMO, ko
              uporabnik nima production.manage IN je seznam pravic znan.
              Iskren umik na CSV/ICS izvoz (bralni tok ohranjen, P1-k). */}
          {myPermissions !== null && !lahkoUpravljaProizvodnjo && (
            <div
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-2xs text-muted-foreground"
              role="note"
              aria-label="Ustvarjanje terminov zahteva pravico"
            >
              Pregled terminov je samo za branje. Ustvarjanje terminov in
              statusni prehodi (začetek, preložitev, zaključitev) so pravica{' '}
              <span className="font-semibold text-roksal-ink">production.manage</span>{' '}
              — vodstvo ali proizvodnja. Termine lahko še vedno izvozite kot CSV
              ali koledarsko datoteko.
            </div>
          )}

          {/* R170 — pečat 'Osveženo ob HH:MM:SS' = čas zadnjega uspešnega
              branja vseh virov (zadnjaOsvezitev je nastavljen samo v uspešni
              veji loadData; napaka → null). Skrit med nalaganjem — med fetchem
              ni še podatka, ki bi bil 'svež'. Semantični žetoni (temna tema). */}
          {zadnjaOsvezitev && !loading && (
            <p
              className="flex items-center gap-1 text-[11px] text-muted-foreground"
              title="Čas zadnje uspešne osvežitve podatkov logistike"
            >
              <History className="h-3 w-3 shrink-0" aria-hidden="true" />
              Osveženo ob <span className="tabular-nums">{casOznaka(zadnjaOsvezitev)}</span>
            </p>
          )}

          {loading ? (
            <Card><CardContent className="py-8 text-center"><Loader2 aria-hidden="true" className="h-6 w-6 animate-spin mx-auto text-roksal-amber" /></CardContent></Card>
          ) : schedules.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Calendar aria-hidden="true" className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni terminov. Ustvari nov termin montaže.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {/* R169/R173 — povzetek predvidenih ur nad vidnimi termini (EN VIR
                  RESNICE z dashboard Termini kartico — isti lib; R173: ISTI
                  razsirjen niz gre tudi v CSV metapodatek 'Povzetek').
                  PREKlicani so izključeni in vidno omenjeni; preskočeni
                  (pokvarjeni) vnosi so vidno preštet — nikoli tihega izginjanja. */}
              <p
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground"
                title="Vsota predvidenih ur vidnih terminov (preklicani so izključeni)"
              >
                <Clock className="h-3 w-3 shrink-0 text-roksal-amber" aria-hidden="true" />
                <span className="tabular-nums font-medium">{terminUrPovzetekRazsirjen(urPovzetek.ag, urPovzetek.preskoceni)}</span>
              </p>
              {schedules.map((s) => (
              <Card key={s.id} className="overflow-hidden transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm focus-within:border-roksal-navy/25 dark:focus-within:border-roksal-ink/25">
                <div className="flex items-stretch">
                  <div className="w-1.5 shrink-0" style={{ backgroundColor: s.crew?.barva || '#1d2b3e' }} />
                  <CardContent className="p-3 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-roksal-ink truncate">{s.project.nazivProjekta}</span>
                          <Badge variant="outline" className={`text-3xs shrink-0 ${STATUS_COLORS[s.status]}`}>
                            {STATUS_LABELS[s.status] || s.status}
                          </Badge>
                        </div>
                        <div className="text-2xs text-muted-foreground">{s.project.customer.ime}</div>
                        <div className="flex flex-wrap items-center gap-2 text-2xs mt-1 tabular-nums text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Clock aria-hidden="true" className="h-2.5 w-2.5" />{formatDate(s.datumZacetka)} {formatTime(s.datumZacetka)}</span>
                          <span>·</span>
                          <span className="text-roksal-ink">{s.predvideneUre}h{s.dejanskeUre ? ` (dejan. ${s.dejanskeUre}h)` : ''}</span>
                          {s.crew && <><span>·</span><span className="flex items-center gap-0.5"><Users aria-hidden="true" className="h-2.5 w-2.5" />{s.crew.naziv}</span></>}
                          {s.lokacija && <><span>·</span><span className="flex items-center gap-0.5"><MapPin aria-hidden="true" className="h-2.5 w-2.5" />{s.lokacija}</span></>}
                        </div>
                      </div>
                    </div>
                    {/* Status actions — R244: pisalni prehidi (začetek /
                        preložitev / zaključitev = PATCH /api/schedules) so
                        VIDNI samo pravici production.manage; bralni izvozi
                        ostajajo (P1-k). */}
                    {s.status === 'NAVRTENO' && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {lahkoUpravljaProizvodnjo && (
                          <Button type="button" size="sm" variant="outline" className="h-6 text-2xs bg-amber-50 dark:bg-amber-950/40 focus-visible:ring-2 focus-visible:ring-roksal-navy/40" onClick={() => handleStatusChange(s.id, 'V_TEKU')}>
                            Začni montažo
                          </Button>
                        )}
                        {lahkoUpravljaProizvodnjo && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-2xs focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                          aria-label={`Preloži termin za ${s.project.nazivProjekta}`}
                          onClick={() => {
                            const d = new Date(s.datumZacetka)
                            const p = (n: number) => String(n).padStart(2, '0')
                            setMoveTarget({ id: s.id, status: s.status, project: s.project.nazivProjekta })
                            setMoveDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
                            setMoveTime(`${p(d.getHours())}:${p(d.getMinutes())}`)
                            setMoveHours(String(s.predvideneUre ?? 8))
                          }}
                        >
                          <CalendarClock aria-hidden="true" className="h-3 w-3 mr-1" /> Preloži
                        </Button>
                        )}
                      </div>
                    )}
                    {s.status === 'V_TEKU' && (
                      <>
                        {lahkoUpravljaProizvodnjo && (
                          <Button type="button" size="sm" variant="outline" className="h-6 text-2xs bg-green-50 dark:bg-green-950/40 focus-visible:ring-2 focus-visible:ring-roksal-navy/40" aria-label={`Zaključi termin ${s.project.nazivProjekta} s preverbo kakovosti`} onClick={() => openQcDialog(s.id, s.project.id, s.project.nazivProjekta)}>
                            <CheckCircle2 aria-hidden="true" className="h-3 w-3 mr-1" /> Zaključi (preverba + odštej material)
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="outline" className="h-6 text-2xs focus-visible:ring-2 focus-visible:ring-roksal-navy/40" aria-label={`Montažno dokazilo za ${s.project.nazivProjekta} (pred/po, checklist, predaja)`} onClick={() => void openEvidenceDialog(s.id, s.project.id, s.project.nazivProjekta)}>
                          <FileCheck2 aria-hidden="true" className="h-3 w-3 mr-1" /> Montažno dokazilo
                        </Button>
                      </>
                    )}
                    {s.status === 'PRELOZENO' && lahkoUpravljaProizvodnjo && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-2xs focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                        aria-label={`Premakni preloženi termin ${s.project.nazivProjekta}`}
                        onClick={() => {
                          const d = new Date(s.datumZacetka)
                          const p = (n: number) => String(n).padStart(2, '0')
                          setMoveTarget({ id: s.id, status: s.status, project: s.project.nazivProjekta })
                          setMoveDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
                          setMoveTime(`${p(d.getHours())}:${p(d.getMinutes())}`)
                          setMoveHours(String(s.predvideneUre ?? 8))
                        }}
                      >
                        <CalendarClock aria-hidden="true" className="h-3 w-3 mr-1" /> Premakni na nov datum
                      </Button>
                    )}
                  </CardContent>
                </div>
              </Card>
            ))}
            </div>
          )}
        </div>
      )}

      {/* Crews tab */}
      {subtab === 'crews' && (
        <div className="space-y-3">
          <Button type="button" onClick={() => setNewCrewOpen(true)} className="w-full bg-roksal-navy text-white">
            <Plus aria-hidden="true" className="h-4 w-4 mr-2" /> Nova ekipa
          </Button>
          {crews.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Users aria-hidden="true" className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni ekip. Ustvari prvo ekipo.</p>
            </CardContent></Card>
          ) : crews.map((c) => (
            <Card key={c.id} className="transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-4 w-4 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: c.barva }} aria-hidden />
                  <span className="text-sm font-semibold text-roksal-ink">{c.naziv}</span>
                </div>
                <div className="text-2xs tabular-nums text-muted-foreground">
                  {c.vodja ? `Vodja: ${c.vodja.ime}` : 'Brez vodje'} · {c._count.members} članov · {c._count.schedules} terminov
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Equipment tab */}
      {subtab === 'equipment' && (
        <div className="space-y-3">
          {/* R244 — wave 6 RBAC ogledalo: CTA 'Nova oprema' je VIDEN samo
              vlogi s pravico production.manage (API POST /api/crews z
              type:'equipment'). Med nalaganjem (null) skrit — R242. */}
          {lahkoUpravljaProizvodnjo && (
            <Button type="button" onClick={() => setNewEquipOpen(true)} className="w-full bg-roksal-navy text-white shadow-sm press-scale hover:bg-roksal-navy/90 transition-all">
              <Plus aria-hidden="true" className="h-4 w-4 mr-2" /> Nova oprema
            </Button>
          )}
          {myPermissions !== null && !lahkoUpravljaProizvodnjo && (
            <div
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-2xs text-muted-foreground"
              role="note"
              aria-label="Upravljanje opreme zahteva pravico"
            >
              Pregled opreme je samo za branje. Dodajanje opreme in statusni
              prehodi so pravica{' '}
              <span className="font-semibold text-roksal-ink">production.manage</span>.
              Zgodovino dogodkov lahko še vedno odprete z Zabeleži.
            </div>
          )}
          {/* R266 — 22. člen 'izvozi' družine (P1-f): OPREMA — ŽIVLJENJSKI
              CIKL PDF — FRESH fetch VSE opreme (/api/equipment — paginacija
              čez limit 100 do 10.000, tiha rezina prepovedana). Bralni
              dokument VEDNO viden (P1-k precedens R251–R265): prazen seznam
              → iskren fail-closed toast, NIKOLI prazna datoteka; agregat v
              toastu = ISTI lib povzetek kot KPI/sklep na listu (WYSIWYG).
              ISTI žetoni kot projekti/tedenski pilli — 0 novih hex. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              aria-label="Izvozi pregled življenjskega cikla opreme kot PDF"
              title="Življenjski cikl opreme kot pravi PDF — pregledi, kalibracije, statusi (vsa oprema)"
              disabled={ocVTeku}
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={() => void handleOpremaCikelPdf()}
            >
              <Activity aria-hidden="true" className="h-4 w-4 mr-1" /> Cikel PDF
            </Button>
            {/* R297 — oprema cikel CSV (27. člen 'izvozi' družine): CSV brat
                PDF R266 — ISTA cikl resnica kot ravninska tabela za
                Excel/revizijo. Bralna datoteka VEDNO vidna (P1-k precedens);
                fail-closed toast pri 0 kosov. ISTI žetoni kot ostali pilli —
                0 novih hex. */}
            <Button
              type="button"
              variant="outline"
              aria-label="Izvozi pregled življenjskega cikla opreme kot CSV"
              title="Življenjski cikl opreme kot CSV (isti stolpci kot PDF — za Excel/revizijo)"
              disabled={ocCsvVTeku}
              className="shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              onClick={() => void handleOpremaCikelCsv()}
            >
              <FileSpreadsheet aria-hidden="true" className="h-4 w-4 mr-1" /> Cikel CSV
            </Button>
            <p className="text-2xs text-muted-foreground">
              PDF = življenjski cikl VSE opreme (pregledi · kalibracije · statusi — polna resnica, ne samo viden seznam)
            </p>
          </div>
          {/* R266 — F2 ciklov mini-vrstica (WYSIWYG ISTA izpeljava
              opremaCikelPregled kot PDF KPI + sklep + toast — ENA izpeljava);
              state = kar uporabnik vidi, FRESH fetch = polna resnica (dve
              okni, ENA matemtika — obe poimenovani po viru); kondicionalni
              žig = R256 lekcija 4: ŽIVO samo kadar je kaka akcija (zapadel
              pregled / potečena kalibracija), sicer skrit — OBE veji
              iskreni; žetoni roksal-red/green — 0 novih hex. */}
          {/* R274 a11y: role="status" — async mini resnica oznanjena bralniku. */}
          {opremaCikelPovzetek && (
            <div role="status" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${opremaCikelPovzetek.pregledZapadel > 0 || opremaCikelPovzetek.kalPotecena > 0 ? 'bg-roksal-red' : 'bg-roksal-green'}`} />
              <span className="tabular-nums" title="Cikl videnega seznama opreme — polna resnica prihaja s FRESH fetch izvozom (PDF/CSV — VSA oprema)">
                Cikl (viden seznam): {opremaCikelPovzetek.oprem} {kosBeseda(opremaCikelPovzetek.oprem)} · zapadel pregled {opremaCikelPovzetek.pregledZapadel} · potečena kalibracija {opremaCikelPovzetek.kalPotecena} · brez lokacije {opremaCikelPovzetek.brezLokacije}
              </span>
              {opremaCikelPovzetek.pregledZapadel > 0 && (
                <span title="Interval + zadnji pregled znana in rok je pretekel (R145 jedro) — akcija" className="rounded-full border border-roksal-red/40 bg-roksal-red/10 px-2 py-0.5 text-2xs font-medium text-roksal-red">
                  {opremaCikelPovzetek.pregledZapadel} zapadel pregled
                </span>
              )}
              {opremaCikelPovzetek.kalPotecena > 0 && (
                <span title="Merska oprema z kalibracijskim rokom, ki je že pretekel — akcija" className="rounded-full border border-roksal-red/40 bg-roksal-red/10 px-2 py-0.5 text-2xs font-medium text-roksal-red">
                  {opremaCikelPovzetek.kalPotecena} potečena kalibracija
                </span>
              )}
            </div>
          )}
          {equipment.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Wrench aria-hidden="true" className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni opreme. Dodaj prvo.</p>
            </CardContent></Card>
          ) : equipment.map((e) => (
            <Card key={e.id} className="transition-[border-color,box-shadow] duration-150 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-roksal-ink">{e.naziv}</span>
                      <Badge variant="outline" className={`text-3xs shrink-0 ${EQUIPMENT_STATUS_COLORS[e.status] ?? 'bg-muted'}`}>
                        {EQUIPMENT_STATUS_LABELS[e.status] ?? e.status}
                      </Badge>
                    </div>
                    <div className="text-2xs tabular-nums text-muted-foreground">
                      {EQUIPMENT_TYPES[e.tip] || e.tip} · {e.lokacija || 'Brez lokacije'} · {e.assignmentsCount} rezervacij
                      {e.serijskaStevilka && <span className="ml-1"> · SN {e.serijskaStevilka}</span>}
                    </div>
                    {/* R145 (§31): življenjski cikl — kalibracija (fail-closed
                        poudarki: POTEČENA rdeče, manjka potrdilo/rok oramno). */}
                    {e.calibrationRequired && (
                      <div className="mt-1 text-2xs tabular-nums">
                        {e.calibrationOverdue ? (
                          <span className="inline-flex items-center gap-1 rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 font-semibold text-red-700 dark:text-red-300">
                            <AlertTriangle aria-hidden="true" className="h-3 w-3"  /> Kalibracija potečena ({e.calibrationDueDate ? formatDate(e.calibrationDueDate) : '—'})
                          </span>
                        ) : e.calibrationMissing ? (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-amber-800 dark:text-amber-200">
                            <AlertTriangle aria-hidden="true" className="h-3 w-3"  /> Manjka potrdilo/rok kalibracije
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <ShieldCheck aria-hidden="true" className="h-3 w-3 text-green-600 dark:text-green-400"  />
                            Kalibracija do {e.calibrationDueDate ? formatDate(e.calibrationDueDate) : '—'}{e.calibrationCertificate ? ` · ${e.calibrationCertificate}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                    {e.inspectionIntervalDays !== null && (
                      <div className="mt-0.5 text-2xs tabular-nums text-muted-foreground">
                        {e.inspectionDue ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-300">Pregled zadelju{e.nextInspectionAt ? ` (rok ${formatDate(e.nextInspectionAt)})` : ''}</span>
                        ) : e.inspectionUnknown ? (
                          <span className="text-amber-700 dark:text-amber-300">Pregled ni še zabeležen (interval {e.inspectionIntervalDays} dni)</span>
                        ) : (
                          <span>Naslednji pregled: {e.nextInspectionAt ? formatDate(e.nextInspectionAt) : '—'}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* Statusne tranzicije (matrika §31 — samo dovoljeni cilji;
                    UPOKOJENO je izpostavljeno ločeno (terminalno — rdeče) in
                    zahteva zaveden klik). R244 — pisalni prehodi so VIDNI samo
                    pravici production.manage (PATCH /api/equipment); bralni
                    vstop 'Zabeleži' (zgodovina dogodkov) ostaja VSEM (P1-k
                    precedens — gated je samo pisalni submit v dialogu). */}
                {e.status !== 'UPOKOJENO' && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {lahkoUpravljaProizvodnjo && allowedTransitions(e.status).filter((s) => s !== 'UPOKOJENO').map((s) => (
                      <Button
                        key={s}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-2xs focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                        aria-label={`${EQUIPMENT_STATUS_LABELS[s] ?? s}: ${e.naziv}`}
                        onClick={() => void handleEquipmentStatus(e, s)}
                      >
                        {s === 'V_SERVISU' ? 'V servis' : EQUIPMENT_STATUS_LABELS[s] ?? s}
                      </Button>
                    ))}
                    {lahkoUpravljaProizvodnjo && allowedTransitions(e.status).includes('UPOKOJENO') && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-2xs border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 focus-visible:ring-2 focus-visible:ring-red-400/50"
                        aria-label={`Upokoji ${e.naziv} (terminalno — ni mogoče razveljaviti)`}
                        title="Upokojitev je terminalna — ni mogoče razveljaviti"
                        onClick={() => void handleEquipmentStatus(e, 'UPOKOJENO')}
                      >
                        Upokoji
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-2xs bg-roksal-navy/5 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                      aria-label={`Zabeleži dogodek za ${e.naziv}`}
                      onClick={() => void openEventDialog(e)}
                    >
                      <History aria-hidden="true" className="h-3 w-3 mr-1"  /> Zabeleži
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: nov termin */}
      <Dialog open={newScheduleOpen} onOpenChange={setNewScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-roksal-ink">Nov termin montaže</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label className="text-xs">Projekt *</Label>
              <Select value={schedProject} onValueChange={setSchedProject}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.nazivProjekta} — {p.customer.ime}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Ekipa</Label>
              <Select value={schedCrew} onValueChange={setSchedCrew}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Brez ekipe" /></SelectTrigger>
                <SelectContent>{crews.map((c) => <SelectItem key={c.id} value={c.id}>{c.naziv}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Datum *</Label><Input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="h-9" /></div>
              <div><Label className="text-xs">Ura začetka</Label><Input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="h-9" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Predvidene ure</Label><Input type="number" value={schedHours} onChange={(e) => setSchedHours(e.target.value)} className="h-9" /></div>
              <div><Label className="text-xs">Lokacija</Label><Input value={schedLocation} onChange={(e) => setSchedLocation(e.target.value)} placeholder="naslov" className="h-9" /></div>
            </div>
            {/* R145 (§31): dodelitev opreme — samo rezervirljiva (brez
                UPOKOJENO/IZGUBLJENO/V_SERVISU); konflikt javi strežnik (409). */}
            <div>
              <Label className="text-xs">Oprema ({schedEquipment.length} izbranih)</Label>
              {equipment.filter((e0) => !['UPOKOJENO', 'IZGUBLJENO', 'V_SERVISU'].includes(e0.status)).length === 0 ? (
                <p className="text-2xs text-muted-foreground py-1">Ni rezervirljive opreme.</p>
              ) : (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                  {equipment.filter((e0) => !['UPOKOJENO', 'IZGUBLJENO', 'V_SERVISU'].includes(e0.status)).map((e0) => (
                    <label key={e0.id} className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-roksal-navy focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                        checked={schedEquipment.includes(e0.id)}
                        onChange={(ev) => {
                          setSchedEquipment((prev) => ev.target.checked ? [...prev, e0.id] : prev.filter((x) => x !== e0.id))
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{e0.naziv}</span>
                      <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">{e0.assignmentsCount}×</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewScheduleOpen(false)}>Prekliči</Button>
            {/* R244 — pisalni submit viden SAMO s pravico (R243 Osnutek
                precedens); mikro-pritisk = družina ostalih dialogov. */}
            {lahkoUpravljaProizvodnjo && (
              <Button type="button" onClick={handleCreateSchedule} className="bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50">Shrani</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: preloži termin (R142 §30) — nov datum/ura, strežnik javi
          prekrivanja vira s 409 in človeku berljivim razlogom. */}
      <Dialog open={moveTarget !== null} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <CalendarClock aria-hidden="true" className="h-4.5 w-4.5 text-roksal-amber" />
              Preloži termin
            </DialogTitle>
          </DialogHeader>
          {moveTarget && (
            <p className="text-[11px] text-muted-foreground">
              {moveTarget.project} · trenutno status{' '}
              <span className="font-semibold text-roksal-ink">{STATUS_LABELS[moveTarget.status] ?? moveTarget.status}</span>
            </p>
          )}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Nov datum *</Label><Input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} className="h-9" /></div>
              <div><Label className="text-xs">Ura začetka</Label><Input type="time" value={moveTime} onChange={(e) => setMoveTime(e.target.value)} className="h-9" /></div>
            </div>
            <div><Label className="text-xs">Trajanje (ure)</Label><Input type="number" min="1" max="24" value={moveHours} onChange={(e) => setMoveHours(e.target.value)} className="h-9 tabular-nums" /></div>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Če ekipa ali monter v novem oknu ima že drug termin, bo preložitev zavrnjena (409) z razlago — nič ne bo tiho prekrivano.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMoveTarget(null)}>Prekliči</Button>
            {/* R244 — pisalni submit viden SAMO s pravico + mikro-pritisk. */}
            {lahkoUpravljaProizvodnjo && (
            <Button
              type="button"
              onClick={() => void handleMoveSchedule()}
              disabled={moveBusy || !moveDate}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50"
            >
              {moveBusy && <Loader2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Preloži
            </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nova ekipa */}
      <Dialog open={newCrewOpen} onOpenChange={setNewCrewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-roksal-ink">Nova ekipa</DialogTitle></DialogHeader>
          <div><Label className="text-xs">Naziv ekipe</Label><Input value={crewNaziv} onChange={(e) => setCrewNaziv(e.target.value)} placeholder="npr. Ekipa A" className="h-9" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewCrewOpen(false)}>Prekliči</Button>
            <Button type="button" onClick={handleCreateCrew} className="bg-roksal-navy text-white">Shrani</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nova oprema */}
      <Dialog open={newEquipOpen} onOpenChange={setNewEquipOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-roksal-ink">Nova oprema</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label className="text-xs">Naziv</Label><Input value={equipNaziv} onChange={(e) => setEquipNaziv(e.target.value)} placeholder="npr. Laser Bosch GLM 50C" className="h-9" /></div>
            <div><Label className="text-xs">Tip</Label>
              <Select value={equipTip} onValueChange={setEquipTip}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(EQUIPMENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewEquipOpen(false)}>Prekliči</Button>
            {/* R244 — pisalni submit viden SAMO s pravico + mikro-pritisk. */}
            {lahkoUpravljaProizvodnjo && (
              <Button type="button" onClick={handleCreateEquip} className="bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50">Shrani</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: zabeleži pregled/kalibracijo/servis/popravilo (R145 §31).
          Fail-closed pogodba je na strežniku: kalibracija merske opreme BREZ
          potrdila → 400 (toast pokaže razlog — ni tiho ugibanja). */}
      <Dialog open={eventTarget !== null} onOpenChange={(open) => !open && setEventTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <History aria-hidden="true" className="h-4.5 w-4.5 text-roksal-amber" />
              Zabeleži dogodek
            </DialogTitle>
          </DialogHeader>
          {eventTarget && (
            <p className="text-[11px] text-muted-foreground">
              {eventTarget.naziv}
              {eventTarget.serijskaStevilka ? ` · SN ${eventTarget.serijskaStevilka}` : ''}
              {eventTarget.calibrationRequired ? ' · merska oprema' : ''}
            </p>
          )}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Tip dogodka</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EQUIPMENT_EVENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Rezultat</Label>
                <Select value={eventResult} onValueChange={setEventResult}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="V_REDU">V redu</SelectItem>
                    <SelectItem value="NAPAKA">Napaka</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Izvedeno *</Label><Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-9 tabular-nums" /></div>
            {eventType === 'KALIBRACIJA' && (
              <>
                <div><Label className="text-xs">Potrdilo (obvezno za mersko opremo)</Label><Input value={eventCertificate} onChange={(e) => setEventCertificate(e.target.value)} placeholder="npr. CAL-2026-0142 / Siemens" className="h-9" /></div>
                <div><Label className="text-xs">Naslednja kalibracija (rok)</Label><Input type="date" value={eventNextDue} onChange={(e) => setEventNextDue(e.target.value)} className="h-9 tabular-nums" /></div>
              </>
            )}
            <div><Label className="text-xs">Opomba</Label><Input value={eventOpomba} onChange={(e) => setEventOpomba(e.target.value)} placeholder="neobvezno" className="h-9" /></div>
            {/* Zgodovina (zadnjih 20) — deterministični red strežnika. */}
            {eventHistoryFor === eventTarget?.id && eventHistory.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Zadnji dogodki</Label>
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border p-2">
                  {eventHistory.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 text-2xs tabular-nums">
                      <span className="font-semibold text-roksal-ink">{EQUIPMENT_EVENT_LABELS[h.type] ?? h.type}</span>
                      <span className="text-muted-foreground">{formatDate(h.performedAt)}</span>
                      {h.result === 'NAPAKA' && <span className="font-semibold text-red-700 dark:text-red-300">NAPAKA</span>}
                      {h.certificate && <span className="truncate text-muted-foreground">· {h.certificate}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* R203 — fail-verbose opomba: zgodovina ob padcu NI tiho prazna. */}
            {eventHistoryFor === eventTarget?.id && eventHistoryNapaka && (
              <p
                role="note"
                className="rounded-md border border-roksal-amber/40 bg-roksal-amber/10 px-2.5 py-1.5 text-2xs text-roksal-ink dark:text-roksal-amber"
              >
                {eventHistoryNapaka}
              </p>
            )}
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Dogodek v prihodnosti ni mogoč (preverba na strežniku). Kalibracija merske opreme zahteva potrdilo — sicer zavržena (400).
            </p>
          </div>
          {/* R244 — vlogo-osveščen vodič v dialogu (Osnutek precedens):
              zgodovina ostane za branje VSEM; pisalni submit je gated. */}
          {myPermissions !== null && !lahkoUpravljaProizvodnjo && (
            <div
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-2xs text-muted-foreground"
              role="note"
              aria-label="Beleženje dogodkov zahteva pravico"
            >
              Zgodovina dogodkov ostaja za branje. Beleženje pregledov,
              kalibracij in servisov je pravica{' '}
              <span className="font-semibold text-roksal-ink">production.manage</span>.
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEventTarget(null)}>Prekliči</Button>
            {lahkoUpravljaProizvodnjo && (
              <Button
                type="button"
                onClick={() => void handleLogEvent()}
                disabled={eventBusy || !eventDate || (eventType === 'KALIBRACIJA' && eventTarget?.calibrationRequired && !eventCertificate)}
                className="bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50"
              >
                {eventBusy && <Loader2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Zabeleži
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: preverba kakovosti PRED zaključitvijo (R146 §27).
          Deterministična predloga (lib/qc-gate, qc-v1): napaka brez opombe ni
          shranjena; preverba NE prehaja → zaključitev ostane zaprta; override
          z razlogom je ločena, izrecna pot (strežnik ga revizira). */}
      <Dialog open={qcTarget !== null} onOpenChange={(open) => !open && setQcTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <ShieldCheck aria-hidden="true" className="h-4.5 w-4.5 text-roksal-amber" />
              Preverba kakovosti
            </DialogTitle>
          </DialogHeader>
          {qcTarget && (
            <p className="text-[11px] text-muted-foreground">
              {qcTarget.project} · zaključitev odšteje material iz zaloge
            </p>
          )}
          <div className="space-y-2">
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border p-2">
              {QC_TEMPLATE.map((t) => (
                <div key={t.key}>
                  <label className="flex cursor-pointer items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 accent-roksal-navy focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                      checked={qcChecked[t.key] === true}
                      aria-label={t.label}
                      onChange={(e) => setQcChecked((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                    />
                    <span className="flex-1">{t.label}</span>
                  </label>
                  {qcChecked[t.key] !== true && (
                    <Input
                      value={qcNotes[t.key] || ''}
                      onChange={(e) => setQcNotes((prev) => ({ ...prev, [t.key]: e.target.value }))}
                      placeholder="Napaka / korektivni ukrep (obvezno)"
                      className="mt-1 ml-6 h-7 text-[11px]"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[11px] tabular-nums">
              {qcPassed ? (
                <span className="inline-flex items-center gap-1 font-semibold text-green-700 dark:text-green-300">
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> Preverba prehaja — vse izpolnjeno
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /> Napake: {qcDefects} — zaključitev ne bo prehajala
                </span>
              )}
            </div>
            {/* Override — izrecna, ločena pot (razlog gre v revizijo QC_OVERRIDE). */}
            {qcOverrideMode ? (
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-2">
                <Label className="text-xs font-semibold text-red-700 dark:text-red-300">Zaključi brez preverbe (override)</Label>
                <Input
                  value={qcOverrideReason}
                  onChange={(e) => setQcOverrideReason(e.target.value)}
                  placeholder="Razlog (obvezen, reviziran kot QC_OVERRIDE)"
                  className="mt-1 h-8 text-xs"
                />
                <p className="mt-1 text-2xs text-red-700/80 dark:text-red-300/80">Razlog se nespremenljivo zapiše v revizijsko sled skupaj z zaključitvijo.</p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setQcOverrideMode(false)}>Nazaj na preverbo</Button>
                  {/* R244 — override zaključi termin (PATCH) → samo s pravico;
                      mikro-pritisk = družina. Rdeča = destruktivni trenutek
                      (terminalni prehod z revizijo), obstoječa semantika. */}
                  {lahkoUpravljaProizvodnjo && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={qcBusy || !qcOverrideReason.trim()}
                    className="h-7 bg-red-600 text-[11px] text-white hover:bg-red-700 focus-visible:ring-red-400/50 press-scale"
                    onClick={() => void handleQcOverride()}
                  >
                    {qcBusy && <Loader2 aria-hidden="true" className="mr-1 h-3 w-3 animate-spin" />}
                    Zaključi z override
                  </Button>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-left text-2xs text-muted-foreground underline underline-offset-2 hover:text-red-700 dark:hover:text-red-300"
                onClick={() => setQcOverrideMode(true)}
              >
                Preverba ni mogoča — zaključi z izrecnim override (razlog se revizira) →
              </button>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setQcTarget(null)}>Prekliči</Button>
            {/* R244 — pisalni submit viden SAMO s pravico (dialog je vstop
                k zaključitvi termina = PATCH) + mikro-pritisk. */}
            {lahkoUpravljaProizvodnjo && (
            <Button
              type="button"
              onClick={() => void handleQcSubmit()}
              disabled={qcBusy || !qcValid}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50"
            >
              {qcBusy && <Loader2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {qcPassed ? 'Preverba + zaključi' : 'Shrani preverbo (z napakami)'}
            </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: montažno dokazilo (R147 §28) — pred/po fotke, lokacija, GPS
          po policyju (samo s soglasjem, koordinate iz naprave), verzirani
          checklist (iev-v1), napake, dokaz predaje (predaja zakleni). */}
      <Dialog open={evTarget !== null} onOpenChange={(open) => !open && setEvTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <FileCheck2 aria-hidden="true" className="h-4.5 w-4.5 text-roksal-ink" />
              Montažno dokazilo
            </DialogTitle>
          </DialogHeader>
          {evTarget && (
            <p className="text-[11px] text-muted-foreground">
              {evTarget.project}
              {evExisting ? ` · verzija ${evExisting.templateVersion} · ustvaril ${evExisting.createdBy ?? '—'}` : ' · še ni shranjeno'}
            </p>
          )}
          <div className="space-y-3">
            {evExisting?.locked ? (
              <div className="flex items-center gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-2 text-[11px] font-semibold text-green-700 dark:text-green-300">
                <Lock aria-hidden="true" className="h-3.5 w-3.5" /> Zaklenjeno s predajo ({evExisting.handoverName ?? '—'})
              </div>
            ) : null}
            <div>
              <Label className="text-xs font-semibold">Lokacija montaže *</Label>
              <Input
                value={evLokacija}
                onChange={(e) => setEvLokacija(e.target.value)}
                placeholder="Naslov / objekt (obvezno)"
                className="mt-1 h-8 text-xs"
                aria-label="Lokacija montaže"
              />
            </div>
            {/* Fotke PRED/PO (§28 before/after): samo obstoječe fotke projekta. */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Fotka PRED</Label>
                <Select value={evBeforeId || undefined} onValueChange={setEvBeforeId}>
                  <SelectTrigger className="mt-1 h-8 text-xs" aria-label="Izberi fotografijo PRED">
                    <SelectValue placeholder={evPhotos.pred.length === 0 ? 'Ni PRED fotk' : 'Izberi'} />
                  </SelectTrigger>
                  <SelectContent>
                    {evPhotos.pred.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.opomba || `Fotka (${p.createdAt.slice(0, 10)})`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Fotka PO</Label>
                <Select value={evAfterId || undefined} onValueChange={setEvAfterId}>
                  <SelectTrigger className="mt-1 h-8 text-xs" aria-label="Izberi fotografijo PO">
                    <SelectValue placeholder={evPhotos.po.length === 0 ? 'Ni PO fotk' : 'Izberi'} />
                  </SelectTrigger>
                  <SelectContent>
                    {evPhotos.po.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.opomba || `Fotka (${p.createdAt.slice(0, 10)})`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* GPS po policyju: koordinate pridejo IZ naprave, samo z izrecnim
                soglasjem — brez soglasja se nič ne zapiše (fail-closed). */}
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 accent-roksal-navy focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                checked={evGpsConsent}
                aria-label="Z dovoljenjem zabeleži GPS lokacijo"
                onChange={(e) => handleEvGpsConsent(e.target.checked)}
              />
              <span className="flex-1">
                Zabeleži GPS lokacijo <span className="text-muted-foreground">(samo z vašim dovoljenjem)</span>
                {evGpsConsent && evGps && (
                  <span className="ml-1 tabular-nums">· {evGps.lat.toFixed(5)}, {evGps.lng.toFixed(5)}</span>
                )}
              </span>
            </label>
            <div>
              <Label className="text-xs font-semibold">Checklist dokazila *</Label>
              <div className="mt-1 max-h-44 space-y-1.5 overflow-y-auto rounded-md border p-2">
                {IEV_TEMPLATE.map((t) => (
                  <div key={t.key}>
                    <label className="flex cursor-pointer items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 accent-roksal-navy focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                        checked={evChecked[t.key] === true}
                        aria-label={t.label}
                        onChange={(e) => setEvChecked((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                      />
                      <span className="flex-1">{t.label}</span>
                    </label>
                    {evChecked[t.key] !== true && (
                      <Input
                        value={evNotes[t.key] || ''}
                        onChange={(e) => setEvNotes((prev) => ({ ...prev, [t.key]: e.target.value }))}
                        placeholder="Razlog / korektivni ukrep (obvezno)"
                        className="mt-1 ml-6 h-7 text-[11px]"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Napake / defekti</Label>
              <textarea
                value={evDefects}
                onChange={(e) => setEvDefects(e.target.value)}
                placeholder="Ena napaka na vrstico (prazno = brez napak)"
                rows={2}
                aria-label="Napake in defekti (ena na vrstico)"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              />
            </div>
            {/* Dokaz predaje — strežnik zavrača brez PRED+PO fotk (fail-closed 409). */}
            {evExisting && !evExisting.locked && (
              <div className="rounded-md border border-roksal-navy/20 dark:border-roksal-ink/20 bg-roksal-navy/5 p-2">
                <Label className="text-xs font-semibold">Potrditev predaje</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={evHandoverName}
                    onChange={(e) => setEvHandoverName(e.target.value)}
                    placeholder="Predal / predajnik (ime)"
                    className="h-8 flex-1 text-xs"
                    aria-label="Ime predajnika"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={evBusy || !evHandoverName.trim() || !evExisting.hasBefore || !evExisting.hasAfter}
                    className="h-8 bg-roksal-navy text-[11px] text-white hover:bg-roksal-navy/90 focus-visible:ring-roksal-navy/40"
                    onClick={() => void handleEvidenceHandover()}
                  >
                    {evBusy && <Loader2 aria-hidden="true" className="mr-1 h-3 w-3 animate-spin" />}
                    Potrdi predajo
                  </Button>
                </div>
                {(!evExisting.hasBefore || !evExisting.hasAfter) && (
                  <p className="mt-1 text-2xs text-amber-700 dark:text-amber-300">
                    Predaja zahteva PRED in PO fotografijo — {(!evExisting.hasBefore && !evExisting.hasAfter) ? 'manjkata oba' : 'manjka ena'} (shranite dokazilo z izbranimi fotkami).
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] tabular-nums">
              {evValid ? (
                <span className="inline-flex items-center gap-1 font-semibold text-green-700 dark:text-green-300">
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> {evAllChecked ? 'Checklist polno' : `Checklist: ${IEV_TEMPLATE.filter((t) => evChecked[t.key] === true).length}/${IEV_TEMPLATE.length}`} · napake: {evDefectsList.length}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /> Neizpolnjene postavke potrebujejo opombo
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEvTarget(null)}>Zapri</Button>
            <Button
              type="button"
              onClick={() => void handleEvidenceSave()}
              disabled={evBusy || evExisting?.locked === true || !evValid || !evLokacija.trim()}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white focus-visible:ring-roksal-navy/40"
            >
              {evBusy && <Loader2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {evExisting ? 'Posodobi dokazilo' : 'Shrani dokazilo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
