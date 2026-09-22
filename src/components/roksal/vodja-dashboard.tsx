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
  project?: { nazivProjekta: string } | null
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
  const [stats, setStats] = useState<VodjaStats | null>(null)
  const [termini, setTermini] = useState<TerminDanes[]>([])
  const [prihodki, setPrihodki] = useState<{ label: string; eur: number }[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Pridobi vse podatke vzporedno
      const [projRes, custRes, schedRes, crmRes, invRes, ordRes, invoicesRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/customers'),
        fetch('/api/schedules'),
        fetch('/api/crm'),
        fetch('/api/inventory'),
        fetch('/api/material-orders'),
        fetch('/api/invoices'),
      ])

      const projects = projRes.ok ? await projRes.json() : []
      const customers = custRes.ok ? await custRes.json() : []
      const schedules = schedRes.ok ? await schedRes.json() : []
      const crm = crmRes.ok ? await crmRes.json() : { stats: {}, customers: [] }
      const inventory = invRes.ok ? await invRes.json() : []
      const orders = ordRes.ok ? await ordRes.json() : []
      const invoices: InvLite[] = invoicesRes.ok ? await invoicesRes.json() : []

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
        potekliOpomniki: crm.stats?.potekliOpomniki || 0,
        aktivniOpomniki: crm.stats?.zOpomniki || 0,
        nizkaZaloga,
        odprtaNarocila,
        skupajProjektov: projects.length,
        skupajStrank: customers.length,
        skupniLTV,
      })
      setTermini(vsiTerminiDanes)
      setPrihodki(prihodkiPoMesecih(invoices))
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
                <span className="text-[10px] text-muted-foreground">Prihodek (plačano)</span>
              </div>
              <div className="text-lg font-bold text-roksal-navy">{formatEUR(stats.mesecniPrihodek)}</div>
              <div className="text-[9px] text-muted-foreground">iz plačanih računov</div>
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
                  <div key={m.label} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${m.label}: ${formatEUR(m.eur)}`}>
                    {m.eur > 0 && (
                      <span className="text-[8px] font-semibold text-roksal-navy">{formatEUR(m.eur)}</span>
                    )}
                    <div
                      className={`w-full max-w-[38px] rounded-t-md transition-all duration-500 ${
                        isCurrent
                          ? 'bg-gradient-to-t from-roksal-amber to-roksal-amber/50'
                          : 'bg-gradient-to-t from-roksal-navy/80 to-roksal-navy/40'
                      }`}
                      style={{ height: h }}
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
                  <p className="text-xs font-bold text-roksal-navy">{formatEUR(stats.odprtoZnesek)}</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                  stats.zapadloSt > 0 ? 'border-red-300 bg-red-50' : 'border-border bg-muted/40'
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${stats.zapadloSt > 0 ? 'bg-roksal-red' : 'bg-stone-400'}`} aria-hidden />
                <div className="min-w-0">
                  <p className={`text-[9px] ${stats.zapadloSt > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>Zapadlo</p>
                  <p className={`text-xs font-bold ${stats.zapadloSt > 0 ? 'text-red-700' : 'text-roksal-navy'}`}>
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
