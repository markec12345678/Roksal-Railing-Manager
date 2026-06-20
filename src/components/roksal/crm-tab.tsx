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
} from 'lucide-react'

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
  AKTIVEN: 'bg-green-100 text-green-800 border-green-300',
  NEAKTIVEN: 'bg-gray-100 text-gray-700 border-gray-300',
  POTENCIALEN: 'bg-amber-100 text-amber-800 border-amber-300',
  ARHIVIRAN: 'bg-red-100 text-red-700 border-red-300',
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

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm')
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
        setStats(data.stats || null)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

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
      if (res.ok) {
        toast({ title: 'CRM posodobljen' })
        setEditOpen(false)
        loadCustomers()
      } else {
        toast({ title: 'Napaka pri shranjevanju', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Statistike */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card className="border-green-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                <span className="text-[10px] text-muted-foreground">Aktivni</span>
              </div>
              <div className="text-lg font-bold text-roksal-navy">{stats.aktivni}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Bell className="h-3 w-3 text-amber-600" />
                <span className="text-[10px] text-muted-foreground">Opomniki</span>
              </div>
              <div className="text-lg font-bold text-amber-700">
                {stats.zOpomniki}
                {stats.potekliOpomniki > 0 && (
                  <span className="text-[10px] text-red-600 ml-1">({stats.potekliOpomniki} poteklo)</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-roksal-navy/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-roksal-navy" />
                <span className="text-[10px] text-muted-foreground">Skupni LTV</span>
              </div>
              <div className="text-lg font-bold text-roksal-navy">{formatLTV(stats.skupniLTV)}</div>
            </CardContent>
          </Card>
          <Card className="border-purple-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Users className="h-3 w-3 text-purple-600" />
                <span className="text-[10px] text-muted-foreground">Skupno</span>
              </div>
              <div className="text-lg font-bold text-roksal-navy">{stats.skupno}</div>
            </CardContent>
          </Card>
        </div>
      )}

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
                className={`h-7 shrink-0 text-[11px] ${statusFilter === s ? 'bg-roksal-navy text-white' : ''}`}
              >
                {s === 'ALL' ? 'Vsi' : STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Seznam strank */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ni strank ki ustrezajo iskanju.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:border-roksal-amber/40 transition-colors" onClick={() => handleOpenDetail(c)}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-roksal-navy truncate">{c.ime}</span>
                      <Badge variant="outline" className={`text-[8px] shrink-0 ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </Badge>
                      {c.opomnikStatus === 'POTEKEL' && (
                        <Badge variant="outline" className="text-[8px] bg-red-100 text-red-700 border-red-300 shrink-0">
                          <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                          Opomnik potekel
                        </Badge>
                      )}
                      {c.opomnikStatus === 'AKTIVEN' && (
                        <Badge variant="outline" className="text-[8px] bg-amber-100 text-amber-700 border-amber-300 shrink-0">
                          <Bell className="h-2.5 w-2.5 mr-0.5" />
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
                      <span className="flex items-center gap-0.5">
                        <FileText className="h-2.5 w-2.5 text-muted-foreground" />
                        {c.skupajProjektov} projektov
                      </span>
                      {c.ltv > 0 && (
                        <span className="flex items-center gap-0.5 font-medium text-roksal-amber">
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
                    className="shrink-0 h-7"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenEdit(c)
                    }}
                  >
                    <Edit className="h-3.5 w-3.5" />
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
            <SheetTitle className="text-roksal-navy">{selectedCustomer?.ime}</SheetTitle>
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
                    <a href={`tel:${selectedCustomer.telefon}`} className="text-roksal-navy hover:underline">
                      {selectedCustomer.telefon}
                    </a>
                  </div>
                )}
                {selectedCustomer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a href={`mailto:${selectedCustomer.email}`} className="text-roksal-navy hover:underline truncate">
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
                  <div className="text-sm font-bold text-roksal-navy">{formatLTV(selectedCustomer.ltv)}</div>
                </div>
                <div className="rounded-lg bg-roksal-navy/5 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">Projekti</div>
                  <div className="text-sm font-bold text-roksal-navy">{selectedCustomer.skupajProjektov}</div>
                </div>
                <div className="rounded-lg bg-roksal-navy/5 p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">Zaklenjeni</div>
                  <div className="text-sm font-bold text-roksal-navy">{selectedCustomer.zaklenjeni}</div>
                </div>
              </div>

              {/* Opomnik */}
              {selectedCustomer.opomnikDatum && (
                <div className={`rounded-lg border p-2 ${
                  selectedCustomer.opomnikStatus === 'POTEKEL'
                    ? 'border-red-300 bg-red-50'
                    : 'border-amber-300 bg-amber-50'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className={`h-3 w-3 ${selectedCustomer.opomnikStatus === 'POTEKEL' ? 'text-red-600' : 'text-amber-600'}`} />
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
            <DialogTitle className="text-roksal-navy">Uredi CRM — {selectedCustomer?.ime}</DialogTitle>
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
              <Label className="text-xs">Kontaktna oseba</Label>
              <Input value={editKontaktnaOseba} onChange={(e) => setEditKontaktnaOseba(e.target.value)} placeholder="npr. Janez Novak (predsednik uprave)" className="h-9" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Zadnji kontakt</Label>
                <Input type="date" value={editZadnjiKontakt} onChange={(e) => setEditZadnjiKontakt(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Opomnik datum</Label>
                <Input type="date" value={editOpomnikDatum} onChange={(e) => setEditOpomnikDatum(e.target.value)} className="h-9" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Opomnik opis</Label>
              <Input value={editOpomnikOpis} onChange={(e) => setEditOpomnikOpis(e.target.value)} placeholder="npr. Letni pregled balkonov" className="h-9" />
            </div>

            <div>
              <Label className="text-xs">Opombe (interne, ne za stranko)</Label>
              <Textarea value={editOpombe} onChange={(e) => setEditOpombe(e.target.value)} placeholder="Interne opombe..." className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Prekliči</Button>
            <Button type="button" onClick={handleSaveEdit} disabled={saving} className="bg-roksal-navy text-white">
              {saving ? 'Shranjujem...' : 'Shrani'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
