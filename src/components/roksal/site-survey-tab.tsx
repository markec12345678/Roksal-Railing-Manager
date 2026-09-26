'use client'

/**
 * Terenski pregled — zapisnik monterja pred montažo (runda Q, "v koži monterja")
 * -----------------------------------------------------------------------------
 * Monter pride na objekt (balkon/stopnišče) in mora VEDETI:
 *   1. Kaj je objekt + oblika (ravno / L / U / krog) → kotni spoji, transport
 *   2. Kam in NA KAJ se pritrjuje (obrobna / tloris / stena) + PODLAGA
 *      → podlaga določa moznike: beton = ekspanzija, estrih+folija = KEMIJA
 *      (NE sme se vrtati skozi hidroizolacijo brez tesnila!), les/kovina/ploščice
 *   3. Ovire (cevi, vtičnice, podstavki, okna) → detektor + zaščita
 *   4. Dostop (dvigalo?) → plan dviga materiala
 *   5. Foto kontrolni seznam — 6 obveznih posnetkov
 * Iz odgovorov se ŽIVO generira seznam "S seboj prinesti" (orodje + pritrdilni
 * material + opozorila) — zmanjša vračanje po pozabljeno (najdražji "dogodek" na
 * terenu = odhod z objekta, ko je že razstavljen).
 *
 * Runda R: ① RAL barva prahu — stranka izbere barvo NA TERENU, izbira se takoj
 *             sinhronizira z 3D/AR predogledom (isti localStorage ključ kot
 *             Fence3dViewer) — pokažeš ograjo v njeni barvi.
 *           ② Orientacijski montažni izračun — segmenti / stebri / kotni spoji
 *             iz mere (skupna dolžina ÷ najdaljši razpon).
 *           ③ PDF zapisnik — en klik: uradni "Zapisnik o terenskem pregledu"
 *             (glava, tabele, foto seznam, seznam orodja, podpisi) za vodjo/
 *             arhiv — glej lib/survey-pdf.ts.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Building2, Footprints, Sun, DoorOpen, DoorClosed, RectangleHorizontal,
  Ruler, Wrench, Package, AlertTriangle, Camera, CheckCircle2, Loader2,
  Save, ClipboardList, Copy, TriangleAlert, MapPinned, FileDown, Palette,
  Calculator, Share2,
} from 'lucide-react'
import type { Project } from '@/lib/types'

// ── Konstante ────────────────────────────────────────────────────────────────

type TipObjekta = 'balkon' | 'stopnice' | 'terasa' | 'loggia' | 'friz' | 'prehod'
type Oblika = 'ravno' | 'L' | 'U' | 'krog'
type Pritrditev = 'obrobna' | 'tloris' | 'stena' | 'mesano'
type Podlaga = 'beton' | 'estrih' | 'les' | 'kovina' | 'plocice' | 'neznan'

const TIP_OBJEKTA: { id: TipObjekta; label: string; icon: typeof Building2; opis: string }[] = [
  { id: 'balkon', label: 'Balkon', icon: Building2, opis: 'plošča z robom' },
  { id: 'stopnice', label: 'Stopnišče', icon: Footprints, opis: 'postrani letvi po kotu' },
  { id: 'terasa', label: 'Terasa', icon: Sun, opis: 'na tloris / obrobljenje' },
  { id: 'loggia', label: 'Loža', icon: DoorOpen, opis: 'med stranskimi zidovi' },
  { id: 'friz', label: 'Friz', icon: RectangleHorizontal, opis: 'ravni strehi / glede' },
  { id: 'prehod', label: 'Nad prehodom', icon: DoorClosed, opis: '⚠ zaščita spodaj!' },
]

const OBLIKE: { id: Oblika; label: string; opis: string }[] = [
  { id: 'ravno', label: 'Ravno', opis: '1 segment' },
  { id: 'L', label: 'L', opis: '1 kot 90°' },
  { id: 'U', label: 'U', opis: '2 kota' },
  { id: 'krog', label: 'Krožno', opis: 'pod koti / lok' },
]

const PRITRDITVE: { id: Pritrditev; label: string; opis: string }[] = [
  { id: 'obrobna', label: 'Obrobna', opis: 'na rob plošče' },
  { id: 'tloris', label: 'Na tloris', opis: 'čez ploščo' },
  { id: 'stena', label: 'V steno', opis: 'med zidove' },
  { id: 'mesano', label: 'Mešano', opis: 'rob + stena' },
]

const PODLAGA: { id: Podlaga; label: string; barva: string }[] = [
  { id: 'beton', label: 'Beton', barva: 'emerald' },
  { id: 'estrih', label: 'Estrih + folija', barva: 'amber' },
  { id: 'les', label: 'Les', barva: 'navy' },
  { id: 'kovina', label: 'Kovina', barva: 'navy' },
  { id: 'plocice', label: 'Ploščice', barva: 'amber' },
  { id: 'neznan', label: 'Neznana', barva: 'red' },
]

const OVIRE: { id: string; label: string }[] = [
  { id: 'cevi', label: 'Cevi / hidrant' },
  { id: 'vticnice', label: 'Vtičnice / kabli' },
  { id: 'podstavki', label: 'Podstavki / obrobljenje' },
  { id: 'osvetlitev', label: 'Osvetlitev' },
  { id: 'okna', label: 'Okna se odpirajo' },
  { id: 'locnik', label: 'Ločnik / preklop' },
  { id: 'vlaga', label: 'Vlaga / poškodbe' },
  { id: 'druge', label: 'Druge' },
]

// RAL klasik prahobarve (iste kode/hex kot generator modelov + Fence3dViewer)
const RAL_BARVE: { code: string; ime: string; hex: string }[] = [
  { code: '7016', ime: 'Antracit', hex: '#383E42' },
  { code: '9005', ime: 'Črna', hex: '#0A0A0C' },
  { code: '9016', ime: 'Bela', hex: '#F1F0EA' },
  { code: '6005', ime: 'Zelena', hex: '#114232' },
  { code: '8017', ime: 'Rjava', hex: '#45322E' },
]
// Ista ključa kot v Fence3dViewer — izbira na terenu = ista barva v 3D/AR predogledu
const RAL_3D_STORAGE_KEY = 'roksal-ar-ral'

// Podlaga določa moznike — en sam vir resnice za seznam + PDF zapisnik
const PODLAGA_MOZNIKI: Record<Podlaga, string> = {
  beton: 'Ekspanzijski mozniki 8×60 / 10×80',
  estrih: 'KEMIJSKI mozniki + tesnilna masa (ekspanzija NE pride v poštev)',
  les: 'Vijaki za les + podložke',
  kovina: 'Bimetal self-drilling vijaki',
  plocice: 'Karbid vrti za ploščice + kemija',
  neznan: 'VZOREC obojega: ekspanzija + kemija',
}

const FOTO_CHECKLIST: { id: string; label: string; opis: string }[] = [
  { id: 'tip1', label: 'Celoten pogled', opis: 'širši kader — vsi segmenti objekta' },
  { id: 'meritve', label: 'Razpon s trakom', opis: 'merilni trak V kadiru (dokazljivo)' },
  { id: 'podlaga', label: 'Detajl podlage', opis: 'kje vrtamo — makro posnetek' },
  { id: 'pritrditev', label: 'Rob plošče / stena', opis: 'mesto pritrditve od zunaj' },
  { id: 'ovire', label: 'Ovire', opis: 'cevi, vtičnice, podstavki' },
  { id: 'celota', label: 'Kontekst', opis: 'pogled navzdol / nadstopnic, dostop' },
]

// ── Podatkovni tip ───────────────────────────────────────────────────────────

interface SurveyData {
  tipObjekta: TipObjekta
  oblika: Oblika
  pritrditev: Pritrditev
  podlaga: Podlaga
  razponNajdaljsiMm: number | null
  skupnaDolzinaMm: number | null
  visinaMm: number | null
  steviloStopnic: number | null
  razhodMm: number | null
  ovire: string[]
  dvigalo: boolean
  dostopOpomba: string
  fotoPosneto: string[]
  ralCode: string | null
  opombe: string
  zakljuceno: boolean
}

const DEFAULTS: SurveyData = {
  tipObjekta: 'balkon',
  oblika: 'ravno',
  pritrditev: 'obrobna',
  podlaga: 'neznan',
  razponNajdaljsiMm: null,
  skupnaDolzinaMm: null,
  visinaMm: null,
  steviloStopnic: null,
  razhodMm: null,
  ovire: [],
  dvigalo: false,
  dostopOpomba: '',
  fotoPosneto: [],
  ralCode: null,
  opombe: '',
  zakljuceno: false,
}

// ── Pametni seznam "s seboj prinesti" ────────────────────────────────────────

interface BringItem {
  id: string
  text: string
  reason: string
  /** 'base' | 'material' | 'warn' */
  kind: 'base' | 'material' | 'warn'
}

function buildBringList(s: SurveyData): BringItem[] {
  const items: BringItem[] = [
    { id: 'meter', text: 'Merilni trak + laser', reason: 'meritve razponov', kind: 'base' },
    { id: 'plumb', text: 'Svintljak / vodna tehtnica', reason: 'stebri navpično', kind: 'base' },
    { id: 'drill', text: 'Vrtalnik + biti PZ/Hex + vrti 6–12 mm', reason: 'pritrditev', kind: 'base' },
    { id: 'ppe', text: 'PPE: rokavice, očala, čelada', reason: 'delo na višini', kind: 'base' },
    { id: 'phone', text: 'Telefon (Field Manager) + powerbank', reason: 'zapisnik + AR meritve', kind: 'base' },
  ]

  items.push({
    id: `anchor-${s.podlaga}`,
    text: PODLAGA_MOZNIKI[s.podlaga],
    reason: `podlaga: ${PODLAGA.find((p) => p.id === s.podlaga)?.label ?? s.podlaga}`,
    kind: 'material',
  })

  if (s.pritrditev === 'obrobna' || s.pritrditev === 'mesano') {
    items.push({ id: 'fascia', text: 'Obrobni nosilci + tesnilni trak', reason: 'pritrditev na rob plošče', kind: 'material' })
  }
  if (s.pritrditev === 'stena' || s.pritrditev === 'mesano') {
    items.push({ id: 'wall', text: 'Stenska sidra + preveri material stene', reason: 'pritrditev v steno', kind: 'material' })
  }
  if (s.oblika !== 'ravno') {
    items.push({ id: 'kotniki', text: `Kotni spoji za obliko ${s.oblika} (transport po kosih!)`, reason: `oblika ${s.oblika} — predizmerjaj kote`, kind: 'material' })
  }
  if (s.tipObjekta === 'stopnice') {
    items.push({ id: 'stair-gauge', text: 'Merilnik razhoda + kotomer', reason: 'letvi po kotu stopnic (30–42°)', kind: 'material' })
  }

  if (s.ovire.includes('cevi') || s.ovire.includes('vticnice')) {
    items.push({ id: 'detector', text: 'Detektor cevi/kablov — OBVEZNO pred vrtanjem', reason: 'ovire: instalacije v podlagi', kind: 'warn' })
  }
  if (s.ovire.includes('vlaga')) {
    items.push({ id: 'moist', text: 'Preveri poškodbe podlage — vlaga slabi kemijo', reason: 'ovire: vlaga', kind: 'warn' })
  }
  if (s.ovire.includes('okna')) {
    items.push({ id: 'okna', text: 'Zaščitna folija/trak za okna', reason: 'okna se odpirajo — preveri višino', kind: 'warn' })
  }
  if (!s.dvigalo) {
    items.push({ id: 'lift', text: 'Plan ročnega dviga: fasadni dvigalnik / kolotek / več par rok', reason: 'dvigalo ni na voljo', kind: 'warn' })
  }
  if (s.tipObjekta === 'prehod') {
    items.push({ id: 'barricade', text: 'Zaščita spodaj (poslopje pod prehodom!)', reason: 'montaža nad prehodom', kind: 'warn' })
  }
  if (s.podlaga === 'estrih') {
    items.push({ id: 'estrih-warn', text: 'NE vrtaj skozi hidroizolacijo brez tesnila — vlaga uniči ploščo', reason: 'estrih + folija', kind: 'warn' })
  }
  return items
}

// ── Pomožne ──────────────────────────────────────────────────────────────────

const mm = (v: number | null) => (v ? `${(v / 1000).toLocaleString('sl-SI')} m` : '—')

// ── Komponenta ───────────────────────────────────────────────────────────────

interface SiteSurveyTabProps {
  projectId: string | null
  project?: Project | null
}

export function SiteSurveyTab({ projectId, project }: SiteSurveyTabProps) {
  const { toast } = useToast()
  const [data, setData] = useState<SurveyData>(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tools, setTools] = useState<Record<string, boolean>>({})
  // R155: fail-verbose — 403/404 pri nalaganju je VIDEN (prej tiho prazen
  // zapisnik = utvara "ni podatkov").
  const [loadError, setLoadError] = useState<string | null>(null)

  const set = useCallback(<K extends keyof SurveyData>(key: K, value: SurveyData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Nalaganje obstoječega zapisnika
  useEffect(() => {
    if (!projectId) return
    let alive = true
    setLoading(true)
    setLoadError(null)
    fetch(`/api/surveys?projectId=${encodeURIComponent(projectId)}`)
      .then(async (r) => {
        // R155: neuspeh (403 tuj projekt / 404 neznan) → vidna napaka z razlogom.
        if (!r.ok) {
          const reason = await r.json().catch(() => null)
          throw new Error(
            reason && typeof reason.error === 'string'
              ? reason.error
              : `Nalaganje ni uspelo (HTTP ${r.status}).`,
          )
        }
        return r.json()
      })
      .then((s) => {
        if (!alive || !s) return
        setData({
          tipObjekta: s.tipObjekta ?? 'balkon',
          oblika: s.oblika ?? 'ravno',
          pritrditev: s.pritrditev ?? 'obrobna',
          podlaga: s.podlaga ?? 'neznan',
          razponNajdaljsiMm: s.razponNajdaljsiMm ?? null,
          skupnaDolzinaMm: s.skupnaDolzinaMm ?? null,
          visinaMm: s.visinaMm ?? null,
          steviloStopnic: s.steviloStopnic ?? null,
          razhodMm: s.razhodMm ?? null,
          ovire: s.ovire ? s.ovire.split('|').filter(Boolean) : [],
          dvigalo: !!s.dvigalo,
          dostopOpomba: s.dostopOpomba ?? '',
          fotoPosneto: s.fotoPosneto ? s.fotoPosneto.split('|').filter(Boolean) : [],
          ralCode: s.ralCode ?? null,
          opombe: s.opombe ?? '',
          zakljuceno: !!s.zakljuceno,
        })
      })
      .catch((err: unknown) => {
        if (alive) {
          setLoadError(err instanceof Error ? err.message : 'Nalaganje zapisnika ni uspelo.')
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [projectId])

  const bringList = useMemo(() => buildBringList(data), [data])

  // Orientacijski montažni izračun — segmenti/stebri/koti iz mere (runda R)
  const izracun = useMemo(() => {
    const raz = data.razponNajdaljsiMm
    const sku = data.skupnaDolzinaMm
    if (!sku || !raz || raz <= 0) return null
    const segmentov = Math.ceil(sku / raz)
    const koti = data.oblika === 'L' ? '1 (L)' : data.oblika === 'U' ? '2 (U)' : data.oblika === 'krog' ? 'po meri (lok)' : '0'
    return { segmentov, stebri: segmentov + 1, koti }
  }, [data.oblika, data.razponNajdaljsiMm, data.skupnaDolzinaMm])

  const completion = useMemo(() => {
    let total = 0
    let filled = 0
    const add = (cond: boolean) => { total++; if (cond) filled++ }
    add(data.razponNajdaljsiMm != null)
    add(data.skupnaDolzinaMm != null)
    add(data.visinaMm != null)
    if (data.tipObjekta === 'stopnice') {
      add(data.steviloStopnic != null)
      add(data.razhodMm != null)
    }
    add(data.dvigalo || data.dostopOpomba.length > 0)
    total += FOTO_CHECKLIST.length
    filled += FOTO_CHECKLIST.filter((f) => data.fotoPosneto.includes(f.id)).length
    return total === 0 ? 0 : Math.round((filled / total) * 100)
  }, [data])

  const save = useCallback(async (finish: boolean) => {
    if (!projectId) return
    setSaving(true)
    try {
      const payload = {
        projectId,
        tipObjekta: data.tipObjekta,
        oblika: data.oblika,
        pritrditev: data.pritrditev,
        podlaga: data.podlaga,
        razponNajdaljsiMm: data.razponNajdaljsiMm,
        skupnaDolzinaMm: data.skupnaDolzinaMm,
        visinaMm: data.visinaMm,
        steviloStopnic: data.tipObjekta === 'stopnice' ? data.steviloStopnic : null,
        razhodMm: data.tipObjekta === 'stopnice' ? data.razhodMm : null,
        ovire: data.ovire.join('|'),
        dvigalo: data.dvigalo,
        dostopOpomba: data.dostopOpomba || null,
        fotoPosneto: data.fotoPosneto.join('|'),
        ralCode: data.ralCode,
        opombe: data.opombe || null,
        zakljuceno: finish || data.zakljuceno,
      }
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      // R155: fail-verbose — razlog iz odgovora (403 dostop, 400 validacija).
      if (!res.ok) {
        const reason = await res.json().catch(() => null)
        throw new Error(
          reason && typeof reason.error === 'string'
            ? reason.error
            : `Shranjevanje ni uspelo (HTTP ${res.status}).`,
        )
      }
      setData((prev) => ({ ...prev, zakljuceno: finish || prev.zakljuceno }))
      toast({
        title: finish ? 'Pregled zaključen ✓' : 'Zapisnik shranjen',
        description: finish ? 'Terenski pregled je zaključen — vidi ga vodja.' : 'Podatki o objektu so shranjeni.',
      })
    } catch (err) {
      toast({
        title: 'Napaka pri shranjevanju',
        description: err instanceof Error && err.message !== 'Failed to fetch'
          ? err.message
          : 'Preveri povezavo in poskusi znova.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }, [projectId, data, toast])

  const toggleOvira = (id: string) =>
    set('ovire', data.ovire.includes(id) ? data.ovire.filter((o) => o !== id) : [...data.ovire, id])

  const toggleFoto = (id: string) =>
    set('fotoPosneto', data.fotoPosneto.includes(id) ? data.fotoPosneto.filter((f) => f !== id) : [...data.fotoPosneto, id])

  // RAL izbira na terenu — ista ključa kot Fence3dViewer → 3D/AR predogled takoj
  // pokaže ograjo v barvi, ki jo je stranka izbrala. Ponoven klik = odizbor.
  const pickRal = useCallback((code: string) => {
    set('ralCode', data.ralCode === code ? null : code)
    try { window.localStorage.setItem(RAL_3D_STORAGE_KEY, code) } catch { /* tiho */ }
  }, [data.ralCode, set])

  // PDF zapisnik — dinamični import (jspdf ne gre v začetni chunk zavihka)
  const exportPdf = useCallback(async () => {
    setGenerating(true)
    try {
      const { generateSurveyPdf } = await import('@/lib/survey-pdf')
      const mere: { label: string; value: string }[] = [
        { label: 'Najdaljši razpon', value: data.razponNajdaljsiMm != null ? `${data.razponNajdaljsiMm} mm` : '—' },
        { label: 'Skupna dolžina', value: data.skupnaDolzinaMm != null ? `${data.skupnaDolzinaMm} mm` : '—' },
        { label: 'Višina', value: data.visinaMm != null ? `${data.visinaMm} mm` : '—' },
      ]
      if (data.tipObjekta === 'stopnice') {
        mere.push({ label: 'Št. stopnic', value: data.steviloStopnic != null ? String(data.steviloStopnic) : '—' })
        mere.push({ label: 'Razhod', value: data.razhodMm != null ? `${data.razhodMm} mm` : '—' })
      }
      generateSurveyPdf({
        projectNaziv: project?.nazivProjekta ?? 'Projekt',
        customerName: project?.customer?.ime ?? null,
        monterName: project?.monter?.ime ?? null,
        datumMontaze: project?.datumMontaze ?? null,
        tipObjekta: TIP_OBJEKTA.find((t) => t.id === data.tipObjekta)?.label ?? data.tipObjekta,
        oblika: OBLIKE.find((o) => o.id === data.oblika)?.label ?? data.oblika,
        pritrditev: PRITRDITVE.find((p) => p.id === data.pritrditev)?.label ?? data.pritrditev,
        podlaga: PODLAGA.find((p) => p.id === data.podlaga)?.label ?? data.podlaga,
        anchorText: PODLAGA_MOZNIKI[data.podlaga],
        ralLabel: data.ralCode ? `RAL ${data.ralCode} (${RAL_BARVE.find((r) => r.code === data.ralCode)?.ime ?? ''})`.trim() : null,
        mere,
        izracun: izracun ? `~ ${izracun.segmentov} segmentov · ${izracun.stebri} stebrov · kotni spoji: ${izracun.koti}` : null,
        ovireLabel: data.ovire.length > 0 ? data.ovire.map((o) => OVIRE.find((x) => x.id === o)?.label ?? o).join(', ') : 'Ni zaznanih ovir',
        dvigalo: data.dvigalo,
        dostopOpomba: data.dostopOpomba || null,
        foto: FOTO_CHECKLIST.map((f) => ({ label: f.label, opis: f.opis, posneto: data.fotoPosneto.includes(f.id) })),
        bringList,
        opombe: data.opombe || null,
        zakljuceno: data.zakljuceno,
        completion,
      })
      toast({ title: 'PDF zapisnik shranjen', description: 'Zapisnik je pripravljen za pošiljanje vodji (WhatsApp/e-pošta).' })
    } catch (err) {
      console.error('PDF zapisnik export failed:', err)
      toast({ title: 'Napaka pri izvozu PDF', description: 'Poskusi znova.', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }, [project, data, izracun, bringList, completion, toast])

  // Mere → kalkulator (runda S): isti kanal kot AR WebXR 'roksal:calc-import' —
  // dolžina/višina se uvozita, podlaga/RAL potujeta sparam za priporočilo moznikov
  const sendToCalculator = useCallback(() => {
    if (!data.skupnaDolzinaMm || !data.visinaMm) return
    window.dispatchEvent(new CustomEvent('roksal:calc-import', {
      detail: {
        dolzinaMm: data.skupnaDolzinaMm,
        visinaMm: data.visinaMm,
        locationName: `Terenski pregled — ${TIP_OBJEKTA.find((t) => t.id === data.tipObjekta)?.label ?? 'objekt'}`,
        podlaga: data.podlaga,
        ralCode: data.ralCode,
        tipObjekta: data.tipObjekta,
      },
    }))
    toast({
      title: 'Mere poslane v kalkulator',
      description: 'Dolžina in višina uvoženi — priporočilo moznikov te čaka v zavihku Sidranje.',
    })
  }, [data.skupnaDolzinaMm, data.visinaMm, data.tipObjekta, data.podlaga, data.ralCode, toast])

  // Ekipna delitev (runda S): Web Share API, fallback = kopiraj
  const shareBringList = useCallback(async () => {
    const text = ['S SEBOJ PRINESTI — Roksal montaža', ...bringList.map((i) => `☐ ${i.text} (${i.reason})`)].join('\n')
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'S seboj prinesti — Roksal montaža', text })
        return
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return // uporabnik prekinil
        // share ni uspel → kopiraj spodaj
      }
    }
    void navigator.clipboard?.writeText(text)
    toast({ title: 'Seznam kopiran', description: 'Deljenje ni na voljo — seznam je kopiran za ekipo.' })
  }, [bringList, toast])

  const copyBringList = () => {
    const text = ['S SEBOJ PRINESTI — Roksal montaža', ...bringList.map((i) => `☐ ${i.text} (${i.reason})`)].join('\n')
    void navigator.clipboard?.writeText(text)
    toast({ title: 'Seznam kopiran', description: 'Prilepi v sporočilo ekipi.' })
  }

  if (!projectId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
          <MapPinned className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">Izberi projekt za terenski pregled</p>
          <p className="text-xs text-muted-foreground/70">Zapisnik se shranjuje na projekt (en pregled na objekt).</p>
        </CardContent>
      </Card>
    )
  }

  const isStairs = data.tipObjekta === 'stopnice'
  const warnings = bringList.filter((i) => i.kind === 'warn')

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      {/* ── LEVO: obrazec ─────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* R155: vidna napaka nalaganja (fail-verbose; vzorec R152/R154). */}
        {loadError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-900">Zapisnika ni bilo mogoče naložiti</p>
              <p className="mt-0.5 break-words text-xs text-amber-800">{loadError}</p>
            </div>
          </div>
        )}
        {/* Status */}
        <Card className="overflow-hidden border-roksal-navy/15">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-roksal-amber" />
                <h3 className="text-sm font-bold text-roksal-ink">Terenski pregled</h3>
                {data.zakljuceno && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="mr-1 h-3 w-3" /> zaključen</Badge>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] font-bold text-roksal-ink">{completion}%</span>
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={() => void exportPdf()}
                  disabled={generating}
                  className="h-8 gap-1.5 rounded-lg border-roksal-navy/20 px-2.5 text-[11px] font-bold text-roksal-ink hover:bg-roksal-amber/10 hover:text-roksal-ink"
                  aria-label="Izvozi PDF zapisnik"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 text-roksal-amber" />}
                  PDF
                </Button>
              </div>
            </div>
            <Progress value={completion} className="h-2" />
            {warnings.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <p className="text-[11px] leading-relaxed text-amber-800">
                  <strong>{warnings.length} opozorilo(i):</strong> {warnings.map((w) => w.text.toLowerCase()).slice(0, 2).join(' · ')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 1. Tip objekta */}
        <Card className="border-roksal-navy/10">
          <CardContent className="p-4">
            <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">1 · Kaj je objekt?</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {TIP_OBJEKTA.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set('tipObjekta', t.id)}
                  aria-pressed={data.tipObjekta === t.id}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition-all ${
                    data.tipObjekta === t.id
                      ? 'border-roksal-amber bg-roksal-amber/10 shadow-sm'
                      : 'border-roksal-navy/10 bg-white dark:border-roksal-ink/15 dark:bg-card hover:border-roksal-navy/30 dark:hover:border-roksal-ink/30'
                  }`}
                >
                  <t.icon className={`h-4 w-4 ${data.tipObjekta === t.id ? 'text-roksal-amber' : 'text-roksal-ink/60'}`} />
                  <span className={`text-[10px] font-bold leading-tight ${data.tipObjekta === t.id ? 'text-roksal-amber' : 'text-roksal-ink'}`}>{t.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">{TIP_OBJEKTA.find((t) => t.id === data.tipObjekta)?.opis}</p>
          </CardContent>
        </Card>

        {/* 2. Oblika + pritrditev */}
        <Card className="border-roksal-navy/10">
          <CardContent className="space-y-3 p-4">
            <div>
              <Label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">2 · Oblika tlorisa</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {OBLIKE.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => set('oblika', o.id)}
                    aria-pressed={data.oblika === o.id}
                    className={`min-h-[44px] rounded-lg border px-2 py-1.5 text-center transition-all ${
                      data.oblika === o.id ? 'border-roksal-amber bg-roksal-amber/10' : 'border-roksal-navy/10 hover:border-roksal-navy/30'
                    }`}
                  >
                    <span className={`block text-[11px] font-bold ${data.oblika === o.id ? 'text-roksal-amber' : 'text-roksal-ink'}`}>{o.label}</span>
                    <span className="block text-[8px] text-muted-foreground">{o.opis}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Kje se pritrjuje?</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {PRITRDITVE.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set('pritrditev', p.id)}
                    aria-pressed={data.pritrditev === p.id}
                    className={`min-h-[44px] rounded-lg border px-2 py-1.5 text-center transition-all ${
                      data.pritrditev === p.id ? 'border-roksal-amber bg-roksal-amber/10' : 'border-roksal-navy/10 hover:border-roksal-navy/30'
                    }`}
                  >
                    <span className={`block text-[11px] font-bold ${data.pritrditev === p.id ? 'text-roksal-amber' : 'text-roksal-ink'}`}>{p.label}</span>
                    <span className="block text-[8px] text-muted-foreground">{p.opis}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Podlaga — najpomembneje */}
        <Card className={`border ${data.podlaga === 'estrih' ? 'border-amber-300 bg-amber-50/40' : 'border-roksal-navy/10'}`}>
          <CardContent className="p-4">
            <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              3 · Podlaga (določa moznike!) 
            </Label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {PODLAGA.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set('podlaga', p.id)}
                  aria-pressed={data.podlaga === p.id}
                  className={`min-h-[44px] rounded-lg border px-1 py-1.5 text-[10px] font-bold transition-all ${
                    data.podlaga === p.id
                      ? p.barva === 'amber'
                        ? 'border-amber-400 bg-amber-100 text-amber-800'
                        : p.barva === 'red'
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-roksal-amber bg-roksal-amber/10 text-roksal-amber'
                      : 'border-roksal-navy/10 text-roksal-ink/70 hover:border-roksal-navy/30'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {data.podlaga === 'estrih' && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-100 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-amber-900">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                Estrih + folija = hidroizolacija. Ekspanzijski moznik je VDRA do folije →
                kemija + tesnilna masa, sicer vlaga uniči ploščo (reklamacija!).
              </p>
            )}
          </CardContent>
        </Card>

        {/* 4. Mere */}
        <Card className="border-roksal-navy/10">
          <CardContent className="p-4">
            <Label className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <Ruler className="h-3 w-3" /> 4 · Mere (mm — iz AR skenerja ali traku)
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[9px] text-muted-foreground">Najdaljši razpon</Label>
                <Input
                  type="number" inputMode="numeric" min={0} placeholder="np. 2400"
                  value={data.razponNajdaljsiMm ?? ''}
                  onChange={(e) => set('razponNajdaljsiMm', e.target.value ? Number(e.target.value) : null)}
                  className="h-11 text-sm"
                />
              </div>
              <div>
                <Label className="text-[9px] text-muted-foreground">Skupna dolžina</Label>
                <Input
                  type="number" inputMode="numeric" min={0} placeholder="np. 8600"
                  value={data.skupnaDolzinaMm ?? ''}
                  onChange={(e) => set('skupnaDolzinaMm', e.target.value ? Number(e.target.value) : null)}
                  className="h-11 text-sm"
                />
              </div>
              <div>
                <Label className="text-[9px] text-muted-foreground">Višina</Label>
                <Input
                  type="number" inputMode="numeric" min={0} placeholder="np. 1100"
                  value={data.visinaMm ?? ''}
                  onChange={(e) => set('visinaMm', e.target.value ? Number(e.target.value) : null)}
                  className="h-11 text-sm"
                />
              </div>
            </div>
            {isStairs && (
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-roksal-navy/[0.04] p-3">
                <div>
                  <Label className="text-[9px] text-muted-foreground">Št. stopnic</Label>
                  <Input
                    type="number" inputMode="numeric" min={0} placeholder="np. 14"
                    value={data.steviloStopnic ?? ''}
                    onChange={(e) => set('steviloStopnic', e.target.value ? Number(e.target.value) : null)}
                    className="h-11 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Razhod (višina stopnice, mm)</Label>
                  <Input
                    type="number" inputMode="numeric" min={0} max={500} placeholder="np. 170"
                    value={data.razhodMm ?? ''}
                    onChange={(e) => set('razhodMm', e.target.value ? Number(e.target.value) : null)}
                    className="h-11 text-sm"
                  />
                </div>
                <p className="col-span-2 text-[9px] text-muted-foreground">
                  Standardni razhod 150–190 mm · nagib 30–42°. Klikni <strong>Nagib</strong> zavihek za izmero kota.
                </p>
              </div>
            )}
            {(data.razponNajdaljsiMm != null || data.skupnaDolzinaMm != null) && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground">
                  Najdaljši razpon: <strong className="text-roksal-ink">{mm(data.razponNajdaljsiMm)}</strong>
                  {data.skupnaDolzinaMm != null && <> · skupaj: <strong className="text-roksal-ink">{mm(data.skupnaDolzinaMm)}</strong></>}
                </p>
                {izracun && (
                  <>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <div className="rounded-lg bg-roksal-navy/[0.04] px-2 py-1.5 text-center ring-1 ring-roksal-navy/5">
                        <span className="block text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Segmenti</span>
                        <span className="block text-sm font-bold text-roksal-ink">~{izracun.segmentov}</span>
                      </div>
                      <div className="rounded-lg bg-roksal-navy/[0.04] px-2 py-1.5 text-center ring-1 ring-roksal-navy/5">
                        <span className="block text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Stebri</span>
                        <span className="block text-sm font-bold text-roksal-ink">~{izracun.stebri}</span>
                      </div>
                      <div className="rounded-lg bg-roksal-navy/[0.04] px-2 py-1.5 text-center ring-1 ring-roksal-navy/5">
                        <span className="block text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Kotni spoji</span>
                        <span className="block text-sm font-bold text-roksal-ink">{izracun.koti}</span>
                      </div>
                    </div>
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      Orientacijsko (stebri = segmenti + 1) — končni izračun materiala v zavihku <strong>Kalkulator</strong>.
                    </p>
                    {data.skupnaDolzinaMm != null && data.visinaMm != null && (
                      <Button
                        type="button" size="sm"
                        onClick={sendToCalculator}
                        className="mt-2 h-9 w-full gap-1.5 rounded-lg bg-roksal-navy text-[11px] font-bold text-white hover:bg-roksal-navy/90 active:scale-[0.98] transition-all"
                      >
                        <Calculator className="h-3.5 w-3.5 text-roksal-amber" />
                        Uporabi mere v kalkulatorju
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Ovire */}
        <Card className="border-roksal-navy/10">
          <CardContent className="p-4">
            <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">5 · Ovire na objektu</Label>
            <div className="flex flex-wrap gap-1.5">
              {OVIRE.map((o) => {
                const on = data.ovire.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleOvira(o.id)}
                    aria-pressed={on}
                    className={`min-h-[36px] rounded-full border px-3 text-[11px] font-semibold transition-all ${
                      on
                        ? o.id === 'cevi' || o.id === 'vticnice'
                          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
                          : 'border-roksal-amber bg-roksal-amber/10 text-roksal-amber'
                        : 'border-roksal-navy/10 bg-white text-roksal-navy/60 dark:border-roksal-ink/15 dark:bg-card dark:text-roksal-ink/60 hover:border-roksal-navy/30 dark:hover:border-roksal-ink/30'
                    }`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 6. Dostop */}
        <Card className="border-roksal-navy/10">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-[11px] font-bold text-roksal-ink">Dvigalo na voljo?</Label>
                <p className="text-[10px] text-muted-foreground">Brez dvigala = plan ročnega dviga materiala</p>
              </div>
              <Switch checked={data.dvigalo} onCheckedChange={(v) => set('dvigalo', v)} aria-label="Dvigalo na voljo" />
            </div>
            <div>
              <Label className="text-[9px] text-muted-foreground">Dostop / parkiranje / dvig materiala (opomba)</Label>
              <Textarea
                rows={2}
                placeholder="np. 3. nadstropje brez dvigala, fasadni dvigalnik po dogovoru, parkiranje v dvorišču…"
                value={data.dostopOpomba}
                onChange={(e) => set('dostopOpomba', e.target.value)}
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* 6 · RAL barva — izbira stranke na terenu (runda R) */}
        <Card className="border-roksal-navy/10">
          <CardContent className="p-4">
            <Label className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <Palette className="h-3 w-3" /> 6 · RAL barva prahu (izbira stranke)
            </Label>
            <div className="flex flex-wrap gap-2">
              {RAL_BARVE.map((r) => {
                const on = data.ralCode === r.code
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => pickRal(r.code)}
                    aria-pressed={on}
                    aria-label={`RAL ${r.code} ${r.ime}`}
                    className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 transition-all ${
                      on ? 'border-roksal-amber bg-roksal-amber/10 shadow-sm' : 'border-roksal-navy/10 bg-white dark:border-roksal-ink/15 dark:bg-card hover:border-roksal-navy/30 dark:hover:border-roksal-ink/30'
                    }`}
                  >
                    <span
                      className="h-7 w-7 rounded-full border border-black/10 shadow-inner"
                      style={{ backgroundColor: r.hex }}
                    />
                    <span>
                      <span className={`block text-[10px] font-bold leading-none ${on ? 'text-roksal-amber' : 'text-roksal-ink'}`}>RAL {r.code}</span>
                      <span className="block text-[8px] text-muted-foreground">{r.ime}</span>
                    </span>
                    {on && <CheckCircle2 className="h-3.5 w-3.5 text-roksal-amber" />}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
              Izbira se takoj sinhronizira z <strong>3D/AR predogledom</strong> (zavihek AR) — pokaži stranki ograjo v njeni barvi, še pred montažo.
            </p>
          </CardContent>
        </Card>

        {/* 7. Foto kontrolni seznam */}
        <Card className="border-roksal-navy/10">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <Camera className="h-3 w-3" /> 7 · Foto kontrolni seznam (slikat MORAŠ)
              </Label>
              <Badge variant="secondary" className="text-[10px]">{data.fotoPosneto.length}/{FOTO_CHECKLIST.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {FOTO_CHECKLIST.map((f, i) => {
                const done = data.fotoPosneto.includes(f.id)
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFoto(f.id)}
                    aria-pressed={done}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all ${
                      done ? 'border-green-200 bg-green-50' : 'border-roksal-navy/10 hover:border-roksal-navy/25'
                    }`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      done ? 'bg-green-500 text-white' : 'bg-roksal-navy/10 text-roksal-ink/60'
                    }`}>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[11px] font-bold ${done ? 'text-green-700' : 'text-roksal-ink'}`}>{f.label}</span>
                      <span className="block text-[9px] text-muted-foreground">{f.opis}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
              <Camera className="h-3 w-3" /> Posnetke z GPS + anotacijami zajemi v zavihku <strong>Slike</strong>.
            </p>
          </CardContent>
        </Card>

        {/* 8. Opombe + shrani */}
        <Card className="border-roksal-navy/10">
          <CardContent className="space-y-3 p-4">
            <div>
              <Label className="text-[9px] text-muted-foreground">Opombe (nič ne pozabi…)</Label>
              <Textarea
                rows={2}
                placeholder="np. stranka želi RAL 9016, pes na dvorišču, ključi pri sosedi…"
                value={data.opombe}
                onChange={(e) => set('opombe', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void save(false)} disabled={saving} className="h-11 flex-1 bg-roksal-navy text-white hover:bg-roksal-navy/90">
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Shrani
              </Button>
              <Button onClick={() => void save(true)} disabled={saving || data.zakljuceno} className="h-11 flex-1 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                <CheckCircle2 className="mr-1 h-4 w-4" /> {data.zakljuceno ? 'Zaključen ✓' : 'Zaključi pregled'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── DESNO: S seboj prinesti (sticky na desktopu) ──────────── */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card className="overflow-hidden border-roksal-navy/20 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-roksal-navy/10 bg-gradient-to-r from-roksal-navy to-roksal-navy/80 p-3.5">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-roksal-amber" />
              <div>
                <h3 className="text-[13px] font-bold text-white">S seboj prinesti</h3>
                <p className="text-[9px] text-white/60">živo iz zapisnika — {bringList.length} točk</p>
              </div>
            </div>
            <Button
              type="button" size="sm" variant="ghost"
              onClick={() => void shareBringList()}
              className="h-8 px-2 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Deli seznam z ekipo"
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button" size="sm" variant="ghost"
              onClick={copyBringList}
              className="h-8 px-2 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Kopiraj seznam"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <CardContent className="max-h-[70vh] space-y-1.5 overflow-y-auto p-3">
            {(['base', 'material', 'warn'] as const).map((kind) => {
              const group = bringList.filter((i) => i.kind === kind)
              if (group.length === 0) return null
              const labels: Record<string, string> = {
                base: 'Orodje (vedno)', material: 'Pritrdilni material', warn: '⚠ Opozorila',
              }
              return (
                <div key={kind}>
                  <p className="mb-1 mt-2 text-[9px] font-bold uppercase tracking-wide text-muted-foreground first:mt-0">{labels[kind]}</p>
                  {group.map((item) => (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition-all ${
                        item.kind === 'warn'
                          ? 'border-amber-200 bg-amber-50'
                          : item.kind === 'material'
                            ? 'border-roksal-navy/10 bg-roksal-navy/[0.03]'
                            : 'border-roksal-navy/10'
                      } ${tools[item.id] ? 'opacity-45' : ''} hover:border-roksal-navy/30`}
                    >
                      <input
                        type="checkbox"
                        checked={!!tools[item.id]}
                        onChange={() => setTools((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className="mt-0.5 h-4 w-4 accent-[#f59e0b]"
                      />
                      <span className="min-w-0">
                        <span className={`block text-[11px] font-bold leading-snug ${item.kind === 'warn' ? 'text-amber-800' : 'text-roksal-ink'}`}>{item.text}</span>
                        <span className="block text-[9px] text-muted-foreground">{item.reason}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SiteSurveyTab
