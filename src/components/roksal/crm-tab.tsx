'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { EmptyState } from '@/components/ui/empty-state'
import { QuoteFollowUp } from '@/components/roksal/quote-followup'
import { InvoiceManager } from '@/components/roksal/invoice-manager'
import { DealPipeline } from '@/components/roksal/deal-pipeline'
import { buildCrmCsv, crmCsvFilename } from '@/lib/crm-csv'
import { todayStamp } from '@/lib/csv-export'
import {
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  Clock,
  Bell,
  Plus,
  Edit,
  Calendar,
  Euro,
  FileText,
  AlertCircle,
  CheckCircle2,
  Building2,
  User,
  Loader2,
  Download,
  History,
} from 'lucide-react'
// R178 — EN VIR RESNICE za pečat 'Osveženo ob' (vzorec R170/R171/R177):
// komponenta NE formatira časa sama.
import { casOznaka } from '@/lib/osvezitev-fokus'

interface CrmCustomer {
  id: string
  ime: string
  naslov: string
  telefon: string | null
  email: string | null
  status: string
  kontaktnaOseba: string | null
  kategorija: string | null
  opomnikDatum: string | null
  opomnikOpis: string | null
  zadnjiKontakt: string | null
  opombeCRM: string | null
  createdAt: string
  ltv: number
  zaklenjeni: number
  skupajProjektov: number
  zadnjiProjekt: string | null
  opomnikStatus: 'NI' | 'AKTIVEN' | 'POTEKEL'
}

interface CrmStats {
  skupno: number
  aktivni: number
  neaktivni: number
  potencialni: number
  zOpomniki: number
  potekliOpomniki: number
  skupniLTV: number
}

const STATUS_LABELS: Record<string, string> = {
  AKTIVEN: 'Aktiven',
  NEAKTIVEN: 'Neaktiven',
  POTENCIALEN: 'Potencialen',
  ARHIVIRAN: 'Arhiviran',
}

const STATUS_COLORS: Record<string, string> = {
  // R162 stil pass — dark: variante (svetla tema NESPREMENJENA, temna dobi
  // berljive polprosojne chipe namesto svetlih 100-barv).
  AKTIVEN: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
  NEAKTIVEN: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-500/30',
  POTENCIALEN: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  ARHIVIRAN: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
}

const KATEGORIJE = ['Stanovanjska skupnost', 'Posameznik', 'Podjetje', 'Drugo']

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatLTV(eur: number): string {
  return eur.toLocaleString('sl-SI', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

export function CrmTab() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([])
  const [stats, setStats] = useState<CrmStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // R178 — pečat 'Osveženo ob' = čas zadnjega USPEŠNEGA branja /api/crm
  // (primarni vir te površine, vzorec R177). Napaka/omrežje → null: pečat
  // brez podatkov bi lažno trdil svežino (fail-closed pečat).
  const [strankeOsvezitev, setStrankeOsvezitev] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Edit form state
  const [editStatus, setEditStatus] = useState('AKTIVEN')
  const [editKontaktnaOseba, setEditKontaktnaOseba] = useState('')
  const [editKategorija, setEditKategorija] = useState('')
  const [editOpomnikDatum, setEditOpomnikDatum] = useState('')
  const [editOpomnikOpis, setEditOpomnikOpis] = useState('')
  const [editZadnjiKontakt, setEditZadnjiKontakt] = useState('')
  const [editOpombe, setEditOpombe] = useState('')

  // R162 — fail-verbose (isti razred kot R161 QuoteFollowUp): GET /api/crm
  // je pri neuspehu TIHO pokazal staro/prazno stanje (if (res.ok) brez else +
  // catch {/* ignore */}) — pisarna je lahko mislila, da strank ni, medtem
  // ko je API padel. Zdaj ločen error state z razlogom + gumb "Poskusi znova".
  const loadCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/crm', { credentials: 'same-origin' })
      const json = (await res.json().catch(() => null)) as ({ customers?: CrmCustomer[]; stats?: CrmStats; error?: string } | null)
      if (!res.ok) {
        setCustomers([])
        setStats(null)
        setStrankeOsvezitev(null)
        setError(
          res.status === 401
            ? 'Prijava je potekla — ponovno se prijavite (napaka 401).'
            : json?.error
              ? `Strežnik ni vrnil strank: ${json.error} (napaka ${res.status}).`
              : `Strežnik ni vrnil strank (napaka ${res.status}).`,
        )
        return
      }
      setCustomers(json?.customers ?? [])
      setStats(json?.stats ?? null)
      setStrankeOsvezitev(new Date())
    } catch {
      setCustomers([])
      setStats(null)
      setStrankeOsvezitev(null)
      setError('Ni povezave s strežnikom — preverite omrežje in poskusite znova.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  // R173 (P1-c iz R172) — vrnitev v zavihek/okno → ponovno naloži CRM
  // (pisarna lahko medtem doda/spremeni stranko v drugi seji; seznam ostane
  // zastarel do remonta). loadCustomers je že fail-verbose (R162) — hook ne
  // požira napak, error panel ostane EDINI vir resnice o napakah. Seznam
  // med osvežitvijo OSTANE viden (render vrata spodaj: loading && prazno —
  // isti vzorec kot termini-card R170), nikoli utrip skeletov.
  useRefetchOnFocus(loadCustomers)

  const filtered = customers.filter((c) => {
    const matchSearch =
      !search ||
      c.ime.toLowerCase().includes(search.toLowerCase()) ||
      c.naslov.toLowerCase().includes(search.toLowerCase()) ||
      (c.kontaktnaOseba || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleOpenEdit = (customer: CrmCustomer) => {
    setSelectedCustomer(customer)
    setEditStatus(customer.status)
    setEditKontaktnaOseba(customer.kontaktnaOseba || '')
    setEditKategorija(customer.kategorija || '')
    setEditOpomnikDatum(customer.opomnikDatum ? new Date(customer.opomnikDatum).toISOString().slice(0, 10) : '')
    setEditOpomnikOpis(customer.opomnikOpis || '')
    setEditZadnjiKontakt(customer.zadnjiKontakt ? new Date(customer.zadnjiKontakt).toISOString().slice(0, 10) : '')
    setEditOpombe(customer.opombeCRM || '')
    setEditOpen(true)
  }

  const handleOpenDetail = (customer: CrmCustomer) => {
    setSelectedCustomer(customer)
    setDetailOpen(true)
  }

  // R159 — CSV izvoz seznama strank (podatkovni izvoz za Excel/mail-merge;
  // logika v src/lib/crm-csv.ts — deterministično, testirljivo, fail-closed).
  // Izvozi točno to, kar uporabnik vidi: upošteva iskanje + statusni filter.
  const handleExportCsv = () => {
    if (filtered.length === 0) return
    try {
      const { csv, vrstic } = buildCrmCsv(
        filtered.map((c) => ({
          ime: c.ime,
          naslov: c.naslov,
          status: c.status,
          kontaktnaOseba: c.kontaktnaOseba,
          telefon: c.telefon,
          email: c.email,
          kategorija: c.kategorija,
          opomnikDatum: c.opomnikDatum,
          opomnikOpis: c.opomnikOpis,
          zadnjiKontakt: c.zadnjiKontakt,
          skupajProjektov: c.skupajProjektov,
          ltv: c.ltv,
          zaklenjeni: c.zaklenjeni,
          opombeCRM: c.opombeCRM,
        })),
      )
      const filename = crmCsvFilename(todayStamp())
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({ title: 'CSV izvožen', description: `${vrstic} strank izvoženih v datoteko ${filename}.` })
    } catch (err) {
      // Fail-verbose: izvoz ne sme tiho spodleteti — razlog gredo v toast.
      toast({
        title: 'Izvoz ni uspel',
        description: err instanceof Error ? err.message : `Neznana napaka (${String(err)}).`,
        variant: 'destructive',
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedCustomer) return
    setSaving(true)
    try {
      const res = await fetch('/api/crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCustomer.id,
          status: editStatus,
          kontaktnaOseba: editKontaktnaOseba || null,
          kategorija: editKategorija || null,
          opomnikDatum: editOpomnikDatum || null,
          opomnikOpis: editOpomnikOpis || null,
          zadnjiKontakt: editZadnjiKontakt || null,
          opombeCRM: editOpombe || null,
        }),
      })
      // R156: fail-verbose — razlog iz odgovora (403 pravica, 400 validacija,
      // 404 neznana stranka; prej generična napaka brez razloga).
      if (res.ok) {
        toast({ title: 'CRM posodobljen' })
        setEditOpen(false)
        loadCustomers()
      } else {
        const reason = await res.json().catch(() => null)
        toast({
          title: 'Napaka pri shranjevanju',
          description:
            reason && typeof reason.error === 'string'
              ? reason.error
              : `Shranjevanje ni uspelo (HTTP ${res.status}).`,
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Omrežna napaka', description: 'Preveri povezavo in poskusi znova.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Prodajna plošča — drag & drop statusi (kanban) */}
      <DealPipeline />

      {/* Sledenje ponudbam (follow-up spomniki) */}
      <QuoteFollowUp />

      {/* Računi — FURS layer (ponudba → račun → plačilo) */}
      <InvoiceManager />

      {/* Statistike */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card className="border-green-200 dark:border-green-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden="true" />
                <span className="text-[10px] text-muted-foreground">Aktivni</span>
              </div>
              <div className="text-lg font-bold text-roksal-ink tabular-nums">{stats.aktivni}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Bell className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span className="text-[10px] text-muted-foreground">Opomniki</span>
              </div>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                {stats.zOpomniki}
                {stats.potekliOpomniki > 0 && (
                  <span className="text-[10px] text-red-600 dark:text-red-400 ml-1">({stats.potekliOpomniki} poteklo)</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-roksal-navy/20 dark:border-roksal-amber/40">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-roksal-ink" aria-hidden="true" />
                <span className="text-[10px] text-muted-foreground">Skupni LTV</span>
              </div>
              <div className="text-lg font-bold text-roksal-ink tabular-nums">{formatLTV(stats.skupniLTV)}</div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 dark:border-purple-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Users className="h-3 w-3 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                <span className="text-[10px] text-muted-foreground">Skupno</span>
              </div>
              <div className="text-lg font-bold text-roksal-ink tabular-nums">{stats.skupno}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* R178 — glava seznama strank s pečatom svežine (družina R170/R171/R177):
          tab 'CRM stranke' je sklad kart — ta naslov jasno loči seznam strank
          od zgornjih kart (plošča/follow-up/računi) in nosi pečat svežine. */}
      <div>
        <h2 className="text-xl font-bold text-roksal-ink">CRM stranke</h2>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-sm text-muted-foreground">
            Seznam strank, opomniki in zgodovina sodelovanja
          </p>
          {strankeOsvezitev && (
            <span
              className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
              title="Čas zadnje uspešne osvežitve podatkov"
            >
              <History className="h-3 w-3 shrink-0" aria-hidden="true" />
              Osveženo ob <span className="tabular-nums">{casOznaka(strankeOsvezitev)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Iskalnik + filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Iskanje strank, naslovov, kontaktnih oseb..."
            className="h-9 pl-9"
          />
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-1">
            {['ALL', 'AKTIVEN', 'NEAKTIVEN', 'POTENCIALEN', 'ARHIVIRAN'].map((s) => (
              <Button
                key={s}
                type="button"
                variant={statusFilter === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className={`h-7 shrink-0 text-[11px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 ${statusFilter === s ? 'bg-roksal-navy text-white' : ''}`}
              >
                {s === 'ALL' ? 'Vsi' : STATUS_LABELS[s]}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="ml-auto h-7 shrink-0 gap-1.5 text-[11px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
              aria-label={`Izvozi CSV (${filtered.length} ${filtered.length === 1 ? 'stranka' : 'strank'})`}
              title="Izvozi prikazani seznam strank v CSV"
            >
              <Download className="h-3 w-3" aria-hidden="true" />
              Izvozi CSV
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Seznam strank */}
      {loading && customers.length === 0 ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadCustomers()}
            className="shrink-0 transition-colors hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            aria-label="Ponovno naloži seznam strank"
          >
            Poskusi znova
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        customers.length === 0 ? (
          <EmptyState icon={Users} title="Ni strank" description="Dodaj prvo stranko v CRM." />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni strank ki ustrezajo iskanju.</p>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`Stranka ${c.ime} — odpri podrobnosti (LTV ${formatLTV(c.ltv)}, ${c.skupajProjektov} projektov)`}
              className="cursor-pointer outline-none transition-[border-color,box-shadow] duration-150 hover:border-roksal-amber/40 hover:shadow-sm focus-visible:border-roksal-amber focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2"
              onClick={() => handleOpenDetail(c)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleOpenDetail(c)
                }
              }}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-roksal-ink truncate">{c.ime}</span>
                      <Badge variant="outline" className={`text-[8px] shrink-0 ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </Badge>
                      {c.opomnikStatus === 'POTEKEL' && (
                        <Badge variant="outline" className="text-[8px] bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30 shrink-0">
                          <AlertCircle className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
                          Opomnik potekel
                        </Badge>
                      )}
                      {c.opomnikStatus === 'AKTIVEN' && (
                        <Badge variant="outline" className="text-[8px] bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 shrink-0">
                          <Bell className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
                          Opomnik
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{c.naslov}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      {c.kategorija && (
                        <span className="flex items-center gap-0.5">
                          <Building2 className="h-2.5 w-2.5 text-muted-foreground" />
                          {c.kategorija}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5 tabular-nums">
                        <FileText className="h-2.5 w-2.5 text-muted-foreground" />
                        {c.skupajProjektov} projektov
                      </span>
                      {c.ltv > 0 && (
                        <span className="flex items-center gap-0.5 font-medium text-roksal-amber tabular-nums">
                          <Euro className="h-2.5 w-2.5" />
                          {formatLTV(c.ltv)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Uredi CRM: ${c.ime}`}
                    className="shrink-0 h-7 outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2 hover:bg-amber-50 hover:text-roksal-navy dark:hover:bg-amber-500/15 dark:hover:text-amber-300"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenEdit(c)
                    }}
                  >
                    <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-roksal-ink">{selectedCustomer?.ime}</SheetTitle>
          </SheetHeader>
          {selectedCustomer && (
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border p-2">
                  <div className="text-[10px] text-muted-foreground">Status</div>
                  <Badge variant="outline" className={`text-[9px] mt-1 ${STATUS_COLORS[selectedCustomer.status]}`}>
                    {STATUS_LABELS[selectedCustomer.status] || selectedCustomer.status}
                  </Badge>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <div className="text-[10px] text-muted-foreground">Kategorija</div>
                  <div className="text-xs font-medium mt-1">{selectedCustomer.kategorija || '—'}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-2 space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span>{selectedCustomer.naslov}</span>
                </div>
                {selectedCustomer.telefon && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a href={`tel:${selectedCustomer.telefon}`} className="text-roksal-ink hover:underline">
                      {selectedCustomer.telefon}
                    </a>
                  </div>
                )}
                {selectedCustomer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a href={`mailto:${selectedCustomer.email}`} className="text-roksal-ink hover:underline truncate">
                      {selectedCustomer.email}
                    </a>
                  </div>
                )}
                {selectedCustomer.kontaktnaOseba && (
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span>{selectedCustomer.kontaktnaOseba}</span>
                  </div>
                )}
              </div>

              {/* LTV + projekti */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-roksal-navy/5 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">LTV</div>
                  <div className="text-sm font-bold text-roksal-ink">{formatLTV(selectedCustomer.ltv)}</div>
                </div>
                <div className="rounded-lg bg-roksal-navy/5 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">Projekti</div>
                  <div className="text-sm font-bold text-roksal-ink">{selectedCustomer.skupajProjektov}</div>
                </div>
                <div className="rounded-lg bg-roksal-navy/5 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">Zaklenjeni</div>
                  <div className="text-sm font-bold text-roksal-ink">{selectedCustomer.zaklenjeni}</div>
                </div>
              </div>

              {/* Opomnik */}
              {selectedCustomer.opomnikDatum && (
                <div className={`rounded-lg border p-2 ${
                  selectedCustomer.opomnikStatus === 'POTEKEL'
                    ? 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
                    : 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className={`h-3 w-3 ${selectedCustomer.opomnikStatus === 'POTEKEL' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} aria-hidden="true" />
                    <span className="text-xs font-semibold">
                      {selectedCustomer.opomnikStatus === 'POTEKEL' ? 'Opomnik potekel' : 'Opomnik'}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {formatDate(selectedCustomer.opomnikDatum)}
                    </span>
                  </div>
                  {selectedCustomer.opomnikOpis && (
                    <p className="text-[11px] text-muted-foreground">{selectedCustomer.opomnikOpis}</p>
                  )}
                </div>
              )}

              {/* Zadnji kontakt */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Zadnji kontakt: {formatDate(selectedCustomer.zadnjiKontakt)}</span>
                <span>Stranka od: {formatDate(selectedCustomer.createdAt)}</span>
              </div>

              {/* Opombe */}
              {selectedCustomer.opombeCRM && (
                <div className="rounded-lg border border-border p-2">
                  <div className="text-[10px] text-muted-foreground mb-1">Opombe (interne)</div>
                  <p className="text-xs">{selectedCustomer.opombeCRM}</p>
                </div>
              )}

              <Button type="button" className="w-full bg-roksal-navy text-white" onClick={() => handleOpenEdit(selectedCustomer)}>
                <Edit className="h-4 w-4 mr-2" />
                Uredi CRM
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-roksal-ink">Uredi CRM — {selectedCustomer?.ime}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Kategorija</Label>
                <Select value={editKategorija} onValueChange={setEditKategorija}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Izberi" />
                  </SelectTrigger>
                  <SelectContent>
                    {KATEGORIJE.map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="crm-kontaktna" className="text-xs">Kontaktna oseba</Label>
              <Input id="crm-kontaktna" value={editKontaktnaOseba} onChange={(e) => setEditKontaktnaOseba(e.target.value)} placeholder="npr. Janez Novak (predsednik uprave)" maxLength={120} className="h-9" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="crm-zadnji-kontakt" className="text-xs">Zadnji kontakt</Label>
                <Input id="crm-zadnji-kontakt" type="date" value={editZadnjiKontakt} onChange={(e) => setEditZadnjiKontakt(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label htmlFor="crm-opomnik-datum" className="text-xs">Opomnik datum</Label>
                <Input id="crm-opomnik-datum" type="date" value={editOpomnikDatum} onChange={(e) => setEditOpomnikDatum(e.target.value)} className="h-9" />
              </div>
            </div>

            <div>
              <Label htmlFor="crm-opomnik-opis" className="text-xs">Opomnik opis</Label>
              <Input id="crm-opomnik-opis" value={editOpomnikOpis} onChange={(e) => setEditOpomnikOpis(e.target.value)} placeholder="npr. Letni pregled balkonov" maxLength={300} className="h-9" />
            </div>

            <div>
              <Label htmlFor="crm-opombe" className="text-xs">Opombe (interne, ne za stranko)</Label>
              <Textarea id="crm-opombe" value={editOpombe} onChange={(e) => setEditOpombe(e.target.value)} placeholder="Interne opombe..." maxLength={2000} className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2"
            >
              Prekliči
            </Button>
            <Button
              type="button"
              onClick={handleSaveEdit}
              disabled={saving}
              aria-busy={saving}
              className="bg-roksal-navy text-white focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                  Shranjujem…
                </>
              ) : (
                'Shrani'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
