'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  TrendingUp, Clock, Users, Package, Euro, CheckCircle2,
  AlertTriangle, Calendar, Truck, Bell,
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
  const [stats, setStats] = useState<VodjaStats | null>(null)
  const [termini, setTermini] = useState<TerminDanes[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Pridobi vse podatke vzporedno
      const [projRes, custRes, schedRes, crmRes, invRes, ordRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/customers'),
        fetch('/api/schedules'),
        fetch('/api/crm'),
        fetch('/api/inventory'),
        fetch('/api/material-orders'),
      ])

      const projects = projRes.ok ? await projRes.json() : []
      const customers = custRes.ok ? await custRes.json() : []
      const schedules = schedRes.ok ? await schedRes.json() : []
      const crm = crmRes.ok ? await crmRes.json() : { stats: {}, customers: [] }
      const inventory = invRes.ok ? await invRes.json() : []
      const orders = ordRes.ok ? await ordRes.json() : []

      // Današnji termini
      const danas = new Date()
      danas.setHours(0, 0, 0, 0)
      const jutri = new Date(danas)
      jutri.setDate(jutri.getDate() + 1)

      const danasTermini = schedules.filter((s: TerminDanes) => {
        const d = new Date(s.datumZacetka)
        return d >= danas && d < jutri
      })

      const danasZakljuceni = danasTermini.filter((s: TerminDanes) => s.status === 'ZAKLJUCENO').length
      const danasVpripravi = danasTermini.filter((s: TerminDanes) => s.status === 'V_TEKU').length

      // Mesečni projekti
      const mesecZacetek = new Date()
      mesecZacetek.setDate(1)
      mesecZacetek.setHours(0, 0, 0, 0)

      const mesecnoProjektov = projects.filter((p: { createdAt: string }) => new Date(p.createdAt) >= mesecZacetek).length
      const mesecniPrihodek = projects
        .filter((p: { dealLockedAt?: string | null; estimatedPrice?: number | null }) =>
          p.dealLockedAt && new Date(p.dealLockedAt) >= mesecZacetek
        )
        .reduce((sum: number, p: { estimatedPrice?: number | null }) => sum + (p.estimatedPrice || 0), 0)

      // Mesečne ure
      const mesecnoUr = schedules
        .filter((s: TerminDanes) => new Date(s.datumZacetka) >= mesecZacetek)
        .reduce((sum: number, s: TerminDanes) => sum + (s.predvideneUre || 0), 0)

      // LTV
      const skupniLTV = customers.reduce((sum: number, c: { projects?: Array<{ estimatedPrice?: number | null }> }) =>
        sum + (c.projects?.reduce((s: number, p: { estimatedPrice?: number | null }) => s + (p.estimatedPrice || 0), 0) || 0), 0)

      // Nizka zaloga
      const nizkaZaloga = inventory.filter((i: { kolicinaZaloga: number; minimalnaZaloga: number }) =>
        i.kolicinaZaloga <= i.minimalnaZaloga).length

      // Odprta naročila
      const odprtaNarocila = orders.filter((o: { status: string }) =>
        ['OSNUTEK', 'POSLANO', 'POTRJENO'].includes(o.status)).length

      setStats({
        danasTermini: danasTermini.length,
        danasZakljuceni,
        danasVpripravi,
        mesecnoProjektov,
        mesecniPrihodek,
        mesecnaMarza: mesecniPrihodek * 0.25, // 25% marža
        mesecnoUr,
        aktivneEkipe: 0, // TODO: iz /api/crews
        ekipaZasedene: danasVpripravi,
        potekliOpomniki: crm.stats?.potekliOpomniki || 0,
        aktivniOpomniki: crm.stats?.zOpomniki || 0,
        nizkaZaloga,
        odprtaNarocila,
        skupajProjektov: projects.length,
        skupajStrank: customers.length,
        skupniLTV,
      })
      setTermini(danasTermini)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-4 p-4">
      {/* Naslov */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-roksal-amber" />
        <h2 className="text-base font-bold text-roksal-navy">Pregled za vodjo</h2>
        <Badge variant="outline" className="ml-auto text-[9px] bg-roksal-amber/10 text-roksal-amber">
          {new Date().toLocaleDateString('sl-SI', { weekday: 'long', day: '2-digit', month: 'long' })}
        </Badge>
      </div>

      {/* Današnji pregled */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Danes</h3>
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-blue-200">
            <CardContent className="p-3 text-center">
              <Calendar className="h-4 w-4 mx-auto text-blue-600 mb-1" />
              <div className="text-xl font-bold text-roksal-navy">{stats.danasTermini}</div>
              <div className="text-[9px] text-muted-foreground">Termini</div>
            </CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardContent className="p-3 text-center">
              <Clock className="h-4 w-4 mx-auto text-amber-600 mb-1" />
              <div className="text-xl font-bold text-amber-700">{stats.danasVpripravi}</div>
              <div className="text-[9px] text-muted-foreground">V teku</div>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1" />
              <div className="text-xl font-bold text-green-700">{stats.danasZakljuceni}</div>
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
              <Calendar className="h-3.5 w-3.5 text-roksal-amber" />
              Današnji termini
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {termini.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <div className="h-8 w-1 rounded-full" style={{ backgroundColor: t.crew?.barva || '#1d2b3e' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-roksal-navy truncate">{t.project.nazivProjekta}</div>
                  <div className="text-[9px] text-muted-foreground truncate">
                    {formatTime(t.datumZacetka)} · {t.project.customer.ime} · {t.crew?.naziv || 'Brez ekipe'}
                  </div>
                </div>
                <Badge variant="outline" className={`text-[8px] shrink-0 ${
                  t.status === 'ZAKLJUCENO' ? 'bg-green-50 text-green-700 border-green-300' :
                  t.status === 'V_TEKU' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                  'bg-blue-50 text-blue-700 border-blue-300'
                }`}>
                  {t.status === 'ZAKLJUCENO' ? 'Zaključeno' : t.status === 'V_TEKU' ? 'V teku' : 'Načrtovano'}
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
          <Card className="border-roksal-navy/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Euro className="h-3 w-3 text-roksal-navy" />
                <span className="text-[10px] text-muted-foreground">Prihodek</span>
              </div>
              <div className="text-lg font-bold text-roksal-navy">{formatEUR(stats.mesecniPrihodek)}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-[10px] text-muted-foreground">Marža (25%)</span>
              </div>
              <div className="text-lg font-bold text-green-700">{formatEUR(stats.mesecnaMarza)}</div>
            </CardContent>
          </Card>
          <Card className="border-purple-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Package className="h-3 w-3 text-purple-600" />
                <span className="text-[10px] text-muted-foreground">Projektov</span>
              </div>
              <div className="text-lg font-bold text-roksal-navy">{stats.mesecnoProjektov}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3 text-amber-600" />
                <span className="text-[10px] text-muted-foreground">Ure</span>
              </div>
              <div className="text-lg font-bold text-roksal-navy">{stats.mesecnoUr}h</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Opozorila */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Opozorila</h3>
        <div className="space-y-2">
          {stats.potekliOpomniki > 0 && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-red-900">{stats.potekliOpomniki} poteklih opomnikov</div>
                  <div className="text-[10px] text-red-700">Preveri v CRM → Stranke</div>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.nizkaZaloga > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-amber-900">{stats.nizkaZaloga} materialov z nizko zalogo</div>
                  <div className="text-[10px] text-amber-700">Naroči pri dobavitelju</div>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.odprtaNarocila > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-blue-900">{stats.odprtaNarocila} odprtih naročil</div>
                  <div className="text-[10px] text-blue-700">Čaka na dobavo</div>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.potekliOpomniki === 0 && stats.nizkaZaloga === 0 && stats.odprtaNarocila === 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <div className="text-xs font-medium text-green-900">Vse v redu — ni opozoril</div>
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
              <div className="text-sm font-bold text-roksal-navy">{stats.skupajProjektov}</div>
              <div className="text-[9px] text-muted-foreground">Projektov</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 text-center">
              <div className="text-sm font-bold text-roksal-navy">{stats.skupajStrank}</div>
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
