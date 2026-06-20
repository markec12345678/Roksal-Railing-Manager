'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  Calendar, Users, Wrench, Plus, Clock, MapPin, CheckCircle2,
  Loader2, AlertTriangle, Truck, Package,
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

interface Equipment {
  id: string
  naziv: string
  tip: string
  status: string
  lokacija: string | null
  _count: { assignments: number }
}

interface Project {
  id: string
  nazivProjekta: string
  customer: { ime: string; naslov: string }
}

const STATUS_LABELS: Record<string, string> = {
  NAVRTENO: 'Načrtovano',
  V_TEKU: 'V teku',
  ZAKLJUCENO: 'Zaključeno',
  PREKlicANO: 'Preklicano',
  PRELOZENO: 'Preloženo',
}

const STATUS_COLORS: Record<string, string> = {
  NAVRTENO: 'bg-blue-100 text-blue-800 border-blue-300',
  V_TEKU: 'bg-amber-100 text-amber-800 border-amber-300',
  ZAKLJUCENO: 'bg-green-100 text-green-800 border-green-300',
  PREKlicANO: 'bg-red-100 text-red-700 border-red-300',
  PRELOZENO: 'bg-purple-100 text-purple-700 border-purple-300',
}

const EQUIPMENT_TYPES: Record<string, string> = {
  MERSKA_OPREMA: 'Merska oprema',
  ROCNO_ORODJE: 'Ročno orodje',
  PREVOZ: 'Prevoz',
  VARNOSTNA_OPREMA: 'Varnostna oprema',
  OSTALO: 'Ostalo',
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(d: string): string {
  return new Date(d).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

export function LogisticsTab({ projectId }: { projectId: string | null }) {
  const [subtab, setSubtab] = useState<'calendar' | 'crews' | 'equipment'>('calendar')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [newScheduleOpen, setNewScheduleOpen] = useState(false)
  const [newCrewOpen, setNewCrewOpen] = useState(false)
  const [newEquipOpen, setNewEquipOpen] = useState(false)
  const { toast } = useToast()

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

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [schedRes, crewRes, equipRes, projRes] = await Promise.all([
        fetch('/api/schedules' + (projectId ? `?projectId=${projectId}` : '')),
        fetch('/api/crews'),
        fetch('/api/crews?type=equipment'),
        fetch('/api/projects'),
      ])
      if (schedRes.ok) setSchedules(await schedRes.json())
      if (crewRes.ok) setCrews(await crewRes.json())
      if (equipRes.ok) setEquipment(await equipRes.json())
      if (projRes.ok) {
        const p = await projRes.json()
        setProjects(p)
        if (!schedProject && p.length > 0) setSchedProject(projectId || p[0].id)
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [projectId, schedProject])

  useEffect(() => { loadData() }, [loadData])

  const handleCreateSchedule = async () => {
    if (!schedProject || !schedDate) return
    const start = new Date(`${schedDate}T${schedTime}`)
    const end = new Date(start.getTime() + parseInt(schedHours) * 3600000)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: schedProject, crewId: schedCrew || undefined, datumZacetka: start.toISOString(), datumKonca: end.toISOString(), predvideneUre: parseInt(schedHours), lokacija: schedLocation }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: '✓ Termin ustvarjen', description: `${formatDate(start.toISOString())} · ${schedHours}h` })
        setNewScheduleOpen(false)
        setSchedDate(''); setSchedLocation('')
        loadData()
      } else {
        toast({ title: 'Napaka', description: data.error, variant: 'destructive' })
      }
    } catch { toast({ title: 'Omrežna napaka', variant: 'destructive' }) }
  }

  const handleStatusChange = async (id: string, status: string, dejanskeUre?: number) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, ...(dejanskeUre ? { dejanskeUre } : {}) }),
      })
      if (res.ok) {
        toast({ title: `Status → ${STATUS_LABELS[status] || status}` })
        loadData()
      }
    } catch { toast({ title: 'Napaka', variant: 'destructive' }) }
  }

  const handleCreateCrew = async () => {
    if (!crewNaziv) return
    try {
      const res = await fetch('/api/crews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ naziv: crewNaziv }) })
      if (res.ok) { toast({ title: 'Ekipa ustvarjena' }); setNewCrewOpen(false); setCrewNaziv(''); loadData() }
    } catch { toast({ title: 'Napaka', variant: 'destructive' }) }
  }

  const handleCreateEquip = async () => {
    if (!equipNaziv) return
    try {
      const res = await fetch('/api/crews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'equipment', naziv: equipNaziv, tip: equipTip }) })
      if (res.ok) { toast({ title: 'Oprema dodana' }); setNewEquipOpen(false); setEquipNaziv(''); loadData() }
    } catch { toast({ title: 'Napaka', variant: 'destructive' }) }
  }

  return (
    <div className="space-y-4">
      {/* Subtabs */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        <Button type="button" variant={subtab === 'calendar' ? 'default' : 'ghost'} size="sm" onClick={() => setSubtab('calendar')} className={subtab === 'calendar' ? 'bg-roksal-navy text-white' : ''}>
          <Calendar className="h-3.5 w-3.5 mr-1" /> Koledar
        </Button>
        <Button type="button" variant={subtab === 'crews' ? 'default' : 'ghost'} size="sm" onClick={() => setSubtab('crews')} className={subtab === 'crews' ? 'bg-roksal-navy text-white' : ''}>
          <Users className="h-3.5 w-3.5 mr-1" /> Ekipe
        </Button>
        <Button type="button" variant={subtab === 'equipment' ? 'default' : 'ghost'} size="sm" onClick={() => setSubtab('equipment')} className={subtab === 'equipment' ? 'bg-roksal-navy text-white' : ''}>
          <Wrench className="h-3.5 w-3.5 mr-1" /> Oprema
        </Button>
      </div>

      {/* Calendar tab */}
      {subtab === 'calendar' && (
        <div className="space-y-3">
          <Button type="button" onClick={() => setNewScheduleOpen(true)} className="w-full bg-roksal-navy text-white">
            <Plus className="h-4 w-4 mr-2" /> Nov termin montaže
          </Button>

          {loading ? (
            <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-roksal-amber" /></CardContent></Card>
          ) : schedules.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni terminov. Ustvari nov termin montaže.</p>
            </CardContent></Card>
          ) : (
            schedules.map((s) => (
              <Card key={s.id} className="overflow-hidden">
                <div className="flex items-stretch">
                  <div className="w-1.5 shrink-0" style={{ backgroundColor: s.crew?.barva || '#1d2b3e' }} />
                  <CardContent className="p-3 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-roksal-navy truncate">{s.project.nazivProjekta}</span>
                          <Badge variant="outline" className={`text-[8px] shrink-0 ${STATUS_COLORS[s.status]}`}>
                            {STATUS_LABELS[s.status] || s.status}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{s.project.customer.ime}</div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] mt-1">
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{formatDate(s.datumZacetka)} {formatTime(s.datumZacetka)}</span>
                          <span>·</span>
                          <span>{s.predvideneUre}h{s.dejanskeUre ? ` (dejan. ${s.dejanskeUre}h)` : ''}</span>
                          {s.crew && <><span>·</span><span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{s.crew.naziv}</span></>}
                          {s.lokacija && <><span>·</span><span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{s.lokacija}</span></>}
                        </div>
                      </div>
                    </div>
                    {/* Status actions */}
                    {s.status === 'NAVRTENO' && (
                      <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] bg-amber-50" onClick={() => handleStatusChange(s.id, 'V_TEKU')}>
                        Začni montažo
                      </Button>
                    )}
                    {s.status === 'V_TEKU' && (
                      <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] bg-green-50" onClick={() => handleStatusChange(s.id, 'ZAKLJUCENO', s.predvideneUre)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Zaključi (odštej material)
                      </Button>
                    )}
                  </CardContent>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Crews tab */}
      {subtab === 'crews' && (
        <div className="space-y-3">
          <Button type="button" onClick={() => setNewCrewOpen(true)} className="w-full bg-roksal-navy text-white">
            <Plus className="h-4 w-4 mr-2" /> Nova ekipa
          </Button>
          {crews.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni ekip. Ustvari prvo ekipo.</p>
            </CardContent></Card>
          ) : crews.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.barva }} />
                  <span className="text-sm font-semibold text-roksal-navy">{c.naziv}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
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
          <Button type="button" onClick={() => setNewEquipOpen(true)} className="w-full bg-roksal-navy text-white">
            <Plus className="h-4 w-4 mr-2" /> Nova oprema
          </Button>
          {equipment.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni opreme. Dodaj prvo.</p>
            </CardContent></Card>
          ) : equipment.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-roksal-navy">{e.naziv}</span>
                      <Badge variant="outline" className={`text-[8px] ${e.status === 'NA_VOLJO' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {e.status === 'NA_VOLJO' ? 'Na voljo' : e.status}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {EQUIPMENT_TYPES[e.tip] || e.tip} · {e.lokacija || 'Brez lokacije'} · {e._count.assignments} rezervacij
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: nov termin */}
      <Dialog open={newScheduleOpen} onOpenChange={setNewScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-roksal-navy">Nov termin montaže</DialogTitle></DialogHeader>
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewScheduleOpen(false)}>Prekliči</Button>
            <Button type="button" onClick={handleCreateSchedule} className="bg-roksal-navy text-white">Shrani</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nova ekipa */}
      <Dialog open={newCrewOpen} onOpenChange={setNewCrewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-roksal-navy">Nova ekipa</DialogTitle></DialogHeader>
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
          <DialogHeader><DialogTitle className="text-roksal-navy">Nova oprema</DialogTitle></DialogHeader>
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
            <Button type="button" onClick={handleCreateEquip} className="bg-roksal-navy text-white">Shrani</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
