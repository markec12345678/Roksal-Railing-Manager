'use client'

// R163:
//  • FAIL-VERBOSE (prej fail-open z LAŽNIMI NIČLAMI!): pri neuspelih klicih je
//    `res.ok ? await res.json() : []` TIHO namestil prazna polja — vodja je
//    videl "0 € prihodka, 0 terminov" čeprav podatki sploh niso bili naloženi
//    (hujše od stale-state: aktivno izmišljanje ničel). Zdaj: če KATERIKOLI
//    od 7 APIjev pade → viden role=alert panel z razlogom + "Poskusi znova",
//    brez prikaza statistike (fail-closed — delni podatki bi izmišljali sliko).
//  • 🆕 IZVOZ DNEVNEGA PREGLEDA v CSV (vodja-csv.ts): KPI + opozorila +
//    današnji termini — točno to, kar je videti na zaslonu (IZVOŽENO = ZASLON).
//  • STIL pass: trdo kodirane svetle barve (bg-green-50, border-red-300,
//    bg-blue-50 …) so v temni temi ostale svetle → dark: variante / semantični
//    žetoni; focus-visible ringi; dekorativne ikone aria-hidden; tabular-nums.

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { generateMonthlyReport } from '@/lib/boss-report-pdf'
import { buildVodjaCsv, vodjaCsvFilename, terminStatusLabel } from '@/lib/vodja-csv'
import { todayStamp } from '@/lib/csv-export'
import {
  TrendingUp, Clock, Users, Package, Euro, CheckCircle2,
  AlertTriangle, Calendar, Truck, Bell, FileDown, Loader2, Download,
} from 'lucide-react'

interface VodjaStats {
  // Dnevno
  danasTermini: number
  danasZakljuceni: number
  danasVpripravi: number
  // Mesečno
  mesecnoProjektov: number
  mesecniPrihodek: number
  mesecnaMarza: number
  mesecnoUr: number
  // Prihodki (računi)
  odprtoZnesek: number
  zapadloZnesek: number
  zapadloSt: number
  // Ekipe
  aktivneEkipe: number
  ekipaZasedene: number
  // CRM
  potekliOpomniki: number
  aktivniOpomniki: number
  // Material
  nizkaZaloga: number
  odprtaNarocila: number
  // Splošno
  skupajProjektov: number
  skupajStrank: number
  skupniLTV: number
}

interface InvLite {
  id: string
  stevilka: string
  status: string
  znesek: number
  datumIzdaje: string
  rokPlacilaDni: number
  placanoAt: string | null
  kupec?: string | null // JSON snapshot { ime, naslov, ... } — za poročilo
  project?: { nazivProjekta: string } | null
}

interface ProjectFull {
  id: string
  nazivProjekta: string
  status: string
  estimatedPrice?: number | null
  createdAt?: string
  customer?: { ime?: string; naslov?: string } | null
}

/** Ime kupca iz JSON snapshot-a (poročilo). */
function kupecIme(json?: string | null): string {
  try {
    return (JSON.parse(json ?? '') as { ime?: string })?.ime ?? ''
  } catch {
    return ''
  }
}

/** Prihodki po mesecih (zadnjih 6) iz plačanih računov — za vrstični graf. */
function prihodkiPoMesecih(invoices: InvLite[]): { label: string; eur: number }[] {
  const now = new Date()
  const months: { key: string; label: string; eur: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('sl-SI', { month: 'short' }).replace('.', ''),
      eur: 0,
    })
  }
  const idx = new Map(months.map((m, i) => [m.key, i]))
  for (const inv of invoices) {
    if (inv.status !== 'PLACAN' || !inv.placanoAt) continue
    const d = new Date(inv.placanoAt)
    const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (i !== undefined) months[i].eur += inv.znesek || 0
  }
  return months
}

interface TerminDanes {
  id: string
  datumZacetka: string
  status: string
  predvideneUre: number
  project: { nazivProjekta: string; customer: { ime: string; naslov: string } }
  crew: { naziv: string; barva: string } | null
}

function formatEUR(eur: number): string {
  return eur.toLocaleString('sl-SI', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

function formatTime(d: string): string {
  return new Date(d).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

export function VodjaDashboard() {
  const { toast } = useToast()
  const [stats, setStats] = useState<VodjaStats | null>(null)
  const [termini, setTermini] = useState<TerminDanes[]>([])
  const [prihodki, setPrihodki] = useState<{ label: string; eur: number }[]>([])
  const [allProjects, setAllProjects] = useState<ProjectFull[]>([])
  const [allInvoices, setAllInvoices] = useState<InvLite[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  // R163: fail-verbose — razlog, zakaj podatkov NI (namesto lažnih ničel).
  const [loadError, setLoadError] = useState<string | null>(null)

  const clearOnFail = useCallback(() => {
    // Fail-closed: brez podatkov NI prikaza — delna statistika bi izmišljala sliko
    // (npr. padli računi → "Prihodek 0 €" je laž, ne nič).
    setStats(null)
    setTermini([])
    setPrihodki([])
    setAllProjects([])
    setAllInvoices([])
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // Pridobi vse podatke vzporedno
      const [projRes, custRes, schedRes, crmRes, invRes, ordRes, invoicesRes] = await Promise.all([
        fetch('/api/projects', { credentials: 'same-origin' }),
        fetch('/api/customers', { credentials: 'same-origin' }),
        fetch('/api/schedules', { credentials: 'same-origin' }),
        fetch('/api/crm', { credentials: 'same-origin' }),
        fetch('/api/inventory', { credentials: 'same-origin' }),
        fetch('/api/material-orders', { credentials: 'same-origin' }),
        fetch('/api/invoices', { credentials: 'same-origin' }),
      ])

      // R163 fail-verbose: NE `res.ok ? json : []` (lažne ničle), ampak jasna
      // napaka z imeni virov, ki niso vrstili podatkov.
      const sources: Array<[string, Response]> = [
        ['projektov', projRes],
        ['strank', custRes],
        ['terminov', schedRes],
        ['CRM', crmRes],
        ['zaloge', invRes],
        ['naročil', ordRes],
        ['računov', invoicesRes],
      ]
      const failed = sources.filter(([, r]) => !r.ok)
      if (failed.length > 0) {
        const st = failed[0][1].status
        setLoadError(
          st === 401
            ? 'Prijava je potekla. Ponovno se prijavite.'
            : `Strežnik ni vrnil podatkov (${failed.map(([n]) => n).join(', ')}; napaka ${st}).`,
        )
        clearOnFail()
        return
      }
      const [projects, customers, schedules, crm, inventory, orders, invoices] = (await Promise.all([
        projRes.json().catch(() => null),
        custRes.json().catch(() => null),
        schedRes.json().catch(() => null),
        crmRes.json().catch(() => null),
        invRes.json().catch(() => null),
        ordRes.json().catch(() => null),
        invoicesRes.json().catch(() => null),
      ])) as unknown[]
      if (!Array.isArray(projects) || !Array.isArray(customers) || !Array.isArray(schedules) ||
        !Array.isArray(inventory) || !Array.isArray(orders) || !Array.isArray(invoices) ||
        crm === null || typeof crm !== 'object' || Array.isArray(crm)) {
        setLoadError('Neveljaven odgovor strežnika.')
        clearOnFail()
        return
      }
      const crmStats = (crm as { stats?: { potekliOpomniki?: number; zOpomniki?: number } }).stats ?? {}

      // Današnji termini
      const danas = new Date()
      danas.setHours(0, 0, 0, 0)
      const jutri = new Date(danas)
      jutri.setDate(jutri.getDate() + 1)

      const danasTermini = schedules.filter((s: TerminDanes) => {
        const d = new Date(s.datumZacetka)
        return d >= danas && d < jutri
      })

      // FIX: prej so se šteli SAMO vnosi iz koledarja (Logistika). Projekt z
      // datumMontaze danes, za katerega še ni termina v koledarju, je izgledal
      // kot "0 terminov" — zdaj ga sintetiziramo iz projekta (brez dvojkov).
      const projectsToday = (Array.isArray(projects) ? projects : []).filter(
        (p: { datumMontaze?: string | null; status: string; nazivProjekta: string }) => {
          if (!p.datumMontaze || p.status === 'ZAKLJUCENO') return false
          const d = new Date(p.datumMontaze)
          return d >= danas && d < jutri
        }
      )
      const scheduledNames = new Set(
        danasTermini.map((s: TerminDanes) => s.project?.nazivProjekta)
      )
      const synthesized: TerminDanes[] = projectsToday
        .filter((p: { nazivProjekta: string }) => !scheduledNames.has(p.nazivProjekta))
        .map((p: { id: string; datumMontaze: string; status: string; nazivProjekta: string; customer?: { ime?: string; naslov?: string } }) => ({
          id: `project-${p.id}`,
          datumZacetka: p.datumMontaze,
          status: p.status,
          predvideneUre: 0,
          project: {
            nazivProjekta: p.nazivProjekta,
            customer: { ime: p.customer?.ime || 'Ni stranke', naslov: p.customer?.naslov || 'Ni naslova' },
          },
          crew: null,
        }))
      const vsiTerminiDanes = [...danasTermini, ...synthesized]

      const danasZakljuceni = vsiTerminiDanes.filter((s: TerminDanes) => s.status === 'ZAKLJUCENO').length
      const danasVpripravi = vsiTerminiDanes.filter((s: TerminDanes) => s.status === 'V_TEKU').length

      // Mesečni projekti
      const mesecZacetek = new Date()
      mesecZacetek.setDate(1)
      mesecZacetek.setHours(0, 0, 0, 0)

      const mesecnoProjektov = projects.filter((p: { createdAt: string }) => new Date(p.createdAt) >= mesecZacetek).length
      // Prihodek = zares PLAČANI računi tega meseca (placanoAt); prej je gledal
      // samo dealLockedAt projektov, zaradi česar je bil plačan račun "neviden"
      // (npr. 2026-001 plačan 22. 9. je pokazal Prihodek 0 €).
      const placaniTaMesec = invoices.filter(
        (inv: InvLite) => inv.status === 'PLACAN' && inv.placanoAt && new Date(inv.placanoAt) >= mesecZacetek
      )
      const mesecniPrihodek = placaniTaMesec.reduce((sum: number, inv: InvLite) => sum + (inv.znesek || 0), 0)

      // Odprti in zapadli računi (IZDAN, rok plačila = datumIzdaje + rokPlacilaDni)
      const izdani = invoices.filter((inv: InvLite) => inv.status === 'IZDAN')
      const odprtoZnesek = izdani.reduce((sum: number, inv: InvLite) => sum + (inv.znesek || 0), 0)
      const danes0 = new Date(); danes0.setHours(0, 0, 0, 0)
      const zapadli = izdani.filter((inv: InvLite) => {
        const rok = new Date(inv.datumIzdaje)
        rok.setDate(rok.getDate() + (inv.rokPlacilaDni || 8))
        return rok < danes0
      })
      const zapadloZnesek = zapadli.reduce((sum: number, inv: InvLite) => sum + (inv.znesek || 0), 0)

      // Mesečne ure
      const mesecnoUr = schedules
        .filter((s: TerminDanes) => new Date(s.datumZacetka) >= mesecZacetek)
        .reduce((sum: number, s: TerminDanes) => sum + (s.predvideneUre || 0), 0)

      // LTV — iz /api/projects (customers API vrača samo _count, ne vrstic
      // s cenami; prej je bil zato LTV vedno 0 €)
      const skupniLTV = projects.reduce(
        (sum: number, p: { estimatedPrice?: number | null }) => sum + (p.estimatedPrice || 0),
        0,
      )

      // Nizka zaloga
      const nizkaZaloga = inventory.filter((i: { kolicinaZaloga: number; minimalnaZaloga: number }) =>
        i.kolicinaZaloga <= i.minimalnaZaloga).length

      // Odprta naročila
      const odprtaNarocila = orders.filter((o: { status: string }) =>
        ['OSNUTEK', 'POSLANO', 'POTRJENO'].includes(o.status)).length

      setStats({
        danasTermini: vsiTerminiDanes.length,
        danasZakljuceni,
        danasVpripravi,
        mesecnoProjektov,
        mesecniPrihodek,
        mesecnaMarza: mesecniPrihodek * 0.25, // 25% marža
        mesecnoUr,
        odprtoZnesek,
        zapadloZnesek,
        zapadloSt: zapadli.length,
        aktivneEkipe: 0, // TODO: iz /api/crews
        ekipaZasedene: danasVpripravi,
        potekliOpomniki: crmStats.potekliOpomniki || 0,
        aktivniOpomniki: crmStats.zOpomniki || 0,
        nizkaZaloga,
        odprtaNarocila,
        skupajProjektov: projects.length,
        skupajStrank: customers.length,
        skupniLTV,
      })
      setTermini(vsiTerminiDanes)
      setPrihodki(prihodkiPoMesecih(invoices as InvLite[]))
      // celotne vhodne podatke si zapomnimo za izvoz PDF poročila (runda M)
      setAllProjects(projects as unknown as ProjectFull[])
      setAllInvoices(invoices as InvLite[])
    } catch {
      // R163: nič tihega ignore — omrežna napaka je vidna z razlogom.
      setLoadError('Ni povezave s strežnikom. Preverite omrežje in poskusite znova.')
      clearOnFail()
    } finally {
      setLoading(false)
    }
  }, [clearOnFail])

  /** Mesečno PDF poročilo — KPI + graf + računi + projekti + opozorila. */
  function downloadReport() {
    if (!stats) return
    setReportLoading(true)
    try {
      const now = new Date()
      const mesecZacetek = new Date(now.getFullYear(), now.getMonth(), 1)
      const row = (inv: InvLite) => ({
        stevilka: inv.stevilka,
        kupec: kupecIme(inv.kupec),
        projekt: inv.project?.nazivProjekta ?? '',
        znesek: inv.znesek,
        datumIzdaje: inv.datumIzdaje,
        rokPlacilaDni: inv.rokPlacilaDni,
        status: inv.status,
        placanoAt: inv.placanoAt,
      })
      const placaniTaMesec = allInvoices
        .filter((inv) => inv.status === 'PLACAN' && inv.placanoAt && new Date(inv.placanoAt) >= mesecZacetek)
        .map(row)
      const izdaniZapadli = allInvoices
        .filter((inv) => {
          if (inv.status !== 'IZDAN') return false
          const rok = new Date(inv.datumIzdaje)
          rok.setDate(rok.getDate() + (inv.rokPlacilaDni || 8))
          return rok < now
        })
        .map(row)

      generateMonthlyReport({
        mesec: { year: now.getFullYear(), month: now.getMonth() },
        generatedAt: now,
        stats: {
          prihodekMesec: stats.mesecniPrihodek,
          marza: stats.mesecnaMarza,
          odprtoZnesek: stats.odprtoZnesek,
          zapadloZnesek: stats.zapadloZnesek,
          zapadloSt: stats.zapadloSt,
          projektovNovih: stats.mesecnoProjektov,
          ureMesec: stats.mesecnoUr,
          skupajProjektov: stats.skupajProjektov,
          skupajStrank: stats.skupajStrank,
          skupniLTV: stats.skupniLTV,
          nizkaZaloga: stats.nizkaZaloga,
          odprtaNarocila: stats.odprtaNarocila,
          potekliOpomniki: stats.potekliOpomniki,
        },
        prihodki6: prihodki,
        placaniTaMesec,
        izdaniZapadli,
        projekti: allProjects.map((p) => ({
          naziv: p.nazivProjekta,
          stranka: p.customer?.ime ?? '',
          status: p.status,
          cena: p.estimatedPrice ?? null,
        })),
      })
      toast({ title: 'Poročilo shranjeno ✓', description: `Mesečno poročilo ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')} PDF` })
    } catch {
      toast({ title: 'Napaka pri generiranju poročila', variant: 'destructive' })
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => { loadData() }, [loadData])

  /** 🆕 R163: izvoz dnevnega pregleda v CSV — točno zaslonski podatki. */
  function exportDailyCsv() {
    if (!stats) return
    try {
      const danesIso = todayStamp()
      const { csv } = buildVodjaCsv({
        kpi: {
          danasTermini: stats.danasTermini,
          danasZakljuceni: stats.danasZakljuceni,
          danasVpripravi: stats.danasVpripravi,
          mesecnoProjektov: stats.mesecnoProjektov,
          mesecniPrihodek: stats.mesecniPrihodek,
          mesecnaMarza: stats.mesecnaMarza,
          mesecnoUr: stats.mesecnoUr,
          odprtoZnesek: stats.odprtoZnesek,
          zapadloZnesek: stats.zapadloZnesek,
          zapadloSt: stats.zapadloSt,
          potekliOpomniki: stats.potekliOpomniki,
          nizkaZaloga: stats.nizkaZaloga,
          odprtaNarocila: stats.odprtaNarocila,
          skupajProjektov: stats.skupajProjektov,
          skupajStrank: stats.skupajStrank,
          skupniLTV: stats.skupniLTV,
        },
        termini: termini.map((t) => ({
          datumZacetka: t.datumZacetka,
          status: t.status,
          project: { nazivProjekta: t.project.nazivProjekta, customer: { ime: t.project.customer?.ime ?? null } },
          crew: t.crew ? { naziv: t.crew.naziv } : null,
        })),
        prihodki,
        danesIso,
      })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = vodjaCsvFilename(danesIso)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Dnevni pregled izvožen ✓', description: vodjaCsvFilename(danesIso) })
    } catch (e) {
      // fail-verbose: razlog vidno, ne tiho
      toast({
        title: 'Izvoz ni uspel',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true" aria-live="polite">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  // R163 fail-verbose: viden panel z razlogom + poskus znova — NE lažne ničle.
  if (loadError) {
    return (
      <div className="space-y-4 p-4">
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
            aria-label="Ponovno naloži pregled za vodjo"
          >
            Poskusi znova
          </Button>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-4 p-4">
      {/* Naslov */}
      <div className="flex flex-wrap items-center gap-2">
        <TrendingUp className="h-5 w-5 text-roksal-amber" />
        <h2 className="text-base font-bold text-roksal-ink">Pregled za vodjo</h2>
        <Badge variant="outline" className="text-[9px] bg-roksal-amber/10 text-roksal-amber">
          {new Date().toLocaleDateString('sl-SI', { weekday: 'long', day: '2-digit', month: 'long' })}
        </Badge>
        {/* 🆕 R163: izvoz dnevnega pregleda v CSV — KPI + opozorila + termini */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-roksal-navy/25 dark:border-roksal-ink/25 text-xs text-roksal-ink transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2"
          onClick={exportDailyCsv}
          aria-label="Izvozi dnevni pregled vodje kot CSV"
          title="Izvozi dnevni pregled (KPI, opozorila in današnji termini) kot CSV za Excel"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Izvozi CSV
        </Button>
        {/* Mesečno poročilo PDF (runda M) — KPI + graf + računi + projekti */}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-8 gap-1.5 border-roksal-navy/25 dark:border-roksal-ink/25 text-xs text-roksal-ink transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2"
          onClick={downloadReport}
          disabled={reportLoading}
          aria-label="Prenesi mesečno PDF poročilo"
        >
          {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileDown className="h-3.5 w-3.5" aria-hidden="true" />}
          Poročilo PDF
        </Button>
      </div>

      {/* Današnji pregled */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Danes</h3>
        <div className="grid grid-cols-3 gap-2">
          <Card className="group border-blue-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-300 dark:border-blue-800/60 dark:hover:border-blue-700">
            <CardContent className="p-3 text-center">
              <Calendar className="h-4 w-4 mx-auto text-blue-600 mb-1 transition-transform duration-200 group-hover:scale-110 dark:text-blue-400" aria-hidden="true" />
              <div className="text-xl font-bold tabular-nums text-roksal-ink">{stats.danasTermini}</div>
              <div className="text-[9px] text-muted-foreground">Termini</div>
            </CardContent>
          </Card>
          <Card className="group border-amber-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-amber-300 dark:border-amber-800/60 dark:hover:border-amber-700">
            <CardContent className="p-3 text-center">
              <Clock className="h-4 w-4 mx-auto text-amber-600 mb-1 transition-transform duration-200 group-hover:scale-110 dark:text-amber-400" aria-hidden="true" />
              <div className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{stats.danasVpripravi}</div>
              <div className="text-[9px] text-muted-foreground">V teku</div>
            </CardContent>
          </Card>
          <Card className="group border-green-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-green-300 dark:border-green-800/60 dark:hover:border-green-700">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1 transition-transform duration-200 group-hover:scale-110 dark:text-green-400" aria-hidden="true" />
              <div className="text-xl font-bold tabular-nums text-green-700 dark:text-green-400">{stats.danasZakljuceni}</div>
              <div className="text-[9px] text-muted-foreground">Zaključeni</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Današnji termini seznam */}
      {termini.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-roksal-amber" aria-hidden="true" />
              Današnji termini
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {termini.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <div className="h-8 w-1 rounded-full" style={{ backgroundColor: t.crew?.barva || '#1d2b3e' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-roksal-ink truncate">{t.project.nazivProjekta}</div>
                  <div className="text-[9px] text-muted-foreground truncate">
                    {formatTime(t.datumZacetka)} · {t.project.customer.ime} · {t.crew?.naziv || 'Brez ekipe'}
                  </div>
                </div>
                <Badge variant="outline" className={`text-[8px] shrink-0 ${
                  t.status === 'ZAKLJUCENO' ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800' :
                  t.status === 'V_TEKU' ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' :
                  'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                }`}>
                  {terminStatusLabel(t.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Mesečni pregled */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Ta mesec</h3>
        <div className="grid grid-cols-2 gap-2">
          <Card className="border-roksal-navy/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Euro className="h-3 w-3 text-roksal-ink" aria-hidden="true" />
                <span className="text-[10px] text-muted-foreground">Prihodek (plačano)</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-roksal-ink">{formatEUR(stats.mesecniPrihodek)}</div>
              <div className="text-[9px] text-muted-foreground">iz plačanih računov</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-green-800/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden="true" />
                <span className="text-[10px] text-muted-foreground">Marža (25%)</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-green-700 dark:text-green-400">{formatEUR(stats.mesecnaMarza)}</div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-purple-800/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Package className="h-3 w-3 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                <span className="text-[10px] text-muted-foreground">Projektov</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-roksal-ink">{stats.mesecnoProjektov}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-amber-800/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span className="text-[10px] text-muted-foreground">Ure</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-roksal-ink">{stats.mesecnoUr}h</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Prihodki — zadnjih 6 mesecev (plačani računi) + stevca odprto/zapadlo.
          Čisti DOM stolpci (brez graf knjižnic), višina sorazmerna max vrednosti;
          mesec z vrednostjo pokaže znesek tudi ob hoveru (title). */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Prihodki — zadnjih 6 mesecev</h3>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-end justify-between gap-1.5" style={{ height: 96 }}>
              {prihodki.map((m) => {
                const max = Math.max(...prihodki.map((x) => x.eur), 1)
                const h = Math.max((m.eur / max) * 76, m.eur > 0 ? 6 : 2)
                const isCurrent = m === prihodki[prihodki.length - 1]
                return (
                  <div
                    key={m.label}
                    className="flex flex-1 flex-col items-center justify-end gap-1 transition-opacity duration-200 hover:opacity-80"
                    title={`${m.label}: ${formatEUR(m.eur)}`}
                  >
                    {m.eur > 0 && (
                      <span className="text-[8px] font-semibold tabular-nums text-roksal-ink">{formatEUR(m.eur)}</span>
                    )}
                    <div
                      className={`w-full max-w-[38px] rounded-t-md transition-all duration-500 ${
                        isCurrent
                          ? 'bg-gradient-to-t from-roksal-amber to-roksal-amber/50'
                          : 'bg-gradient-to-t from-roksal-navy/80 to-roksal-navy/40 dark:from-roksal-ink/45 dark:to-roksal-ink/15'
                      }`}
                      style={{ height: h }}
                      aria-hidden="true"
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-1.5 flex justify-between gap-1.5">
              {prihodki.map((m) => (
                <span key={m.label} className="flex-1 text-center text-[9px] text-muted-foreground">
                  {m.label}
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-roksal-amber" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[9px] text-muted-foreground">Odprto (izdano)</p>
                  <p className="text-xs font-bold text-roksal-ink">{formatEUR(stats.odprtoZnesek)}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                  stats.zapadloSt > 0 ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40' : 'border-border bg-muted/40'
                }`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${stats.zapadloSt > 0 ? 'bg-roksal-red' : 'bg-stone-400 dark:bg-stone-600'}`} aria-hidden />
                <div className="min-w-0">
                  <p className={`text-[9px] ${stats.zapadloSt > 0 ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}`}>Zapadlo</p>
                  <p className={`text-xs font-bold tabular-nums ${stats.zapadloSt > 0 ? 'text-red-700 dark:text-red-300' : 'text-roksal-ink'}`}>
                    {formatEUR(stats.zapadloZnesek)}
                    {stats.zapadloSt > 0 && <span className="ml-1 font-medium">({stats.zapadloSt})</span>}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opozorila */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Opozorila</h3>
        <div className="space-y-2">
          {stats.potekliOpomniki > 0 && (
            <Card className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 dark:text-red-400" aria-hidden="true" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-red-900 dark:text-red-200">{stats.potekliOpomniki} poteklih opomnikov</div>
                  <div className="text-[10px] text-red-700 dark:text-red-300">Preveri v CRM → Stranke</div>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.nizkaZaloga > 0 && (
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
              <CardContent className="p-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-600 shrink-0 dark:text-amber-400" aria-hidden="true" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-amber-900 dark:text-amber-200">{stats.nizkaZaloga} materialov z nizko zalogo</div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-300">Naroči pri dobavitelju</div>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.odprtaNarocila > 0 && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40">
              <CardContent className="p-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600 shrink-0 dark:text-blue-400" aria-hidden="true" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-blue-900 dark:text-blue-200">{stats.odprtaNarocila} odprtih naročil</div>
                  <div className="text-[10px] text-blue-700 dark:text-blue-300">Čaka na dobavo</div>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.potekliOpomniki === 0 && stats.nizkaZaloga === 0 && stats.odprtaNarocila === 0 && (
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40">
              <CardContent className="p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 dark:text-green-400" aria-hidden="true" />
                <div className="text-xs font-medium text-green-900 dark:text-green-200">Vse v redu — ni opozoril</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Skupno stanje */}
      <Separator />
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Skupno</h3>
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-2.5 text-center">
              <div className="text-sm font-bold text-roksal-ink">{stats.skupajProjektov}</div>
              <div className="text-[9px] text-muted-foreground">Projektov</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 text-center">
              <div className="text-sm font-bold text-roksal-ink">{stats.skupajStrank}</div>
              <div className="text-[9px] text-muted-foreground">Strank</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 text-center">
              <div className="text-sm font-bold text-roksal-amber">{formatEUR(stats.skupniLTV)}</div>
              <div className="text-[9px] text-muted-foreground">Skupni LTV</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
