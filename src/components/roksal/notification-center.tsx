'use client'

/**
 * Obvestilni center — zvonek v TopBaru.
 *
 * Združi štiri najpomembnejše signale za monterja, ki so prej raztreseni
 * po zavihkih:
 *  1. ⚠️ nizka zaloga (material pod minimalno stanje)
 *  2. 📅 današnje montaže (kdo, kje, status)
 *  3. 🌩️ vremensko opozorilo (vetrní duši / nevarno za montažo)
 *  4. 📞 zapadli follow-upi ponudb (stranka še ni odgovorila)
 *  5. 💶 zapadli računi (izdan + rok plačila pretekel) — FURS layer
 *
 * Podatki se poberejo le ob odprtju panela + ob dogodku 'roksal:refresh'
 * (ki ga sproži sync v page.tsx) — ni dodatnih intervalov.
 * Klik na obvestilo naviga na pravi zavihek prek 'roksal:navigate'.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Bell, Package, CalendarDays, CloudLightning, CheckCheck,
  ChevronRight, RefreshCw, AlertTriangle, Loader2, FileClock, Receipt,
  Inbox, Wrench,
} from 'lucide-react'

interface NotificationItem {
  id: string
  kind: 'stock' | 'install' | 'weather' | 'followup' | 'invoice'
  title: string
  subtitle: string
  meta?: string
  /** Koliko enakih obvestil je združenih (duplikati projektov z istim imenom) */
  count?: number
}

/** R143 (§29): zapisano obvestilo z življenjskim ciklom (GET /api/notifications). */
interface PersistedNotification {
  id: string
  naslov: string
  sporocilo: string | null
  isRead: boolean
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'OPENED' | 'FAILED'
  template: string
  templateVersion: number
  entityType: string | null
  entityId: string | null
  retryCount: number
  maxRetries: number
  lastError: string | null
  createdAt: string
  sentAt: string | null
  deliveredAt: string | null
  openedAt: string | null
}

interface WeatherSummary {
  riskLevel: 'low' | 'medium' | 'high' | 'dangerous'
  description: string
  speed: number
  gust: number
}

const RISK_LABEL: Record<WeatherSummary['riskLevel'], string> = {
  low: 'Varno',
  medium: 'Previdno',
  high: 'Nevarno',
  dangerous: 'NE montaža',
}

/** R143 (§29): življenjski cikel — berljive oznake + stil (fail-verbose: FAILED pokaže razlog). */
const STATUS_STYLE: Record<
  PersistedNotification['status'],
  { label: string; dot: string; text: string }
> = {
  QUEUED: { label: 'V vrsti', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
  SENT: { label: 'Poslano', dot: 'bg-sky-500', text: 'text-sky-700' },
  DELIVERED: { label: 'Dostavljeno', dot: 'bg-roksal-amber', text: 'text-roksal-amber' },
  OPENED: { label: 'Odprto', dot: 'bg-green-500', text: 'text-green-700' },
  FAILED: { label: 'Napaka', dot: 'bg-roksal-red', text: 'text-roksal-red' },
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [badge, setBadge] = useState(0)
  const [pulse, setPulse] = useState(false)
  const [persisted, setPersisted] = useState<PersistedNotification[]>([])
  const [persistedError, setPersistedError] = useState<string | null>(null)
  const loadedOnce = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    const out: NotificationItem[] = []
    try {
      const [invRes, projRes] = await Promise.all([fetch('/api/inventory'), fetch('/api/projects')])
      const today = new Date()

      // 1) Nizka zaloga
      if (invRes.ok) {
        const inv = (await invRes.json()) as {
          id: string; naziv: string; kolicinaZaloga: number; minimalnaZaloga: number; enota: string
        }[]
        const low = (inv || []).filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga)
        for (const i of low.slice(0, 8)) {
          out.push({
            id: `stock-${i.id}`,
            kind: 'stock',
            title: i.naziv,
            subtitle: `Zaloga ${i.kolicinaZaloga} ${i.enota} · minimum ${i.minimalnaZaloga}`,
            meta: 'Naroči material',
          })
        }
      }

      // 2) Današnje montaže
      if (projRes.ok) {
        const projects = (await projRes.json()) as {
          id: string; nazivProjekta: string; datumMontaze: string | null; status: string;
          dealLocked: boolean; followUpDate: string | null;
          customer?: { ime: string } | null
        }[]
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const todays = (projects || []).filter((p) => p.datumMontaze?.slice(0, 10) === todayStr)
        for (const p of todays.slice(0, 8)) {
          out.push({
            id: `install-${p.id}`,
            kind: 'install',
            title: p.nazivProjekta,
            subtitle: p.customer?.ime ?? 'Stranka ni določena',
            meta: p.status === 'V_TEKU' ? 'V teku' : 'Načrtovana',
          })
        }

        // 2b) Zapadli follow-upi ponudb (ponudba poslana, stranka še ni odgovorila)
        const dueFollowUps = (projects || []).filter(
          (p) =>
            !p.dealLocked &&
            p.followUpDate &&
            p.status !== 'ZAKLJUCENO' &&
            new Date(p.followUpDate).getTime() <= today.getTime(),
        )
        for (const p of dueFollowUps.slice(0, 6)) {
          const d = new Date(p.followUpDate as string)
          const days = Math.floor((today.getTime() - d.getTime()) / 86400000)
          out.push({
            id: `followup-${p.id}`,
            kind: 'followup',
            title: p.nazivProjekta,
            subtitle: `Ponudba čaka odziv · spomnik ${d.toLocaleDateString('sl-SI')}`,
            meta: days > 0 ? `zapadlo ${days} dni` : 'danes',
          })
        }
      }

      // 5) Zapadli računi (izdan + rok plačila pretekel)
      try {
        const invRes2 = await fetch('/api/invoices')
        if (invRes2.ok) {
          const invoices = (await invRes2.json()) as {
            id: string; stevilka: string; status: string; znesek: number;
            datumIzdaje: string; rokPlacilaDni: number;
            project?: { nazivProjekta: string } | null
          }[]
          const dueInvoices = (invoices || []).filter((r) => {
            if (r.status !== 'IZDAN') return false
            const due = new Date(r.datumIzdaje)
            due.setDate(due.getDate() + (r.rokPlacilaDni || 0))
            return due.getTime() <= today.getTime()
          })
          for (const r of dueInvoices.slice(0, 6)) {
            const due = new Date(r.datumIzdaje)
            due.setDate(due.getDate() + (r.rokPlacilaDni || 0))
            const days = Math.floor((today.getTime() - due.getTime()) / 86400000)
            out.push({
              id: `invoice-${r.id}`,
              kind: 'invoice',
              title: `Račun ${r.stevilka}`,
              subtitle: `${r.project?.nazivProjekta ?? '—'} · ${r.znesek.toFixed(2)} € zapadli`,
              meta: days > 0 ? `zapadlo ${days} dni` : 'rok danes',
            })
          }
        }
      } catch { /* računi so opcijski za obvestila */ }

      // 3) Vremensko opozorilo (samo če ni "low")
      try {
        const wRes = await fetch('/api/weather')
        if (wRes.ok) {
          const w = (await wRes.json()) as WeatherSummary
          if (w.riskLevel && w.riskLevel !== 'low') {
            out.push({
              id: 'weather-today',
              kind: 'weather',
              title: `${RISK_LABEL[w.riskLevel]} za montažo`,
              subtitle: `${w.description} · veter ${Math.round(w.speed * 3.6)} km/h (sunki ${Math.round(w.gust * 3.6)} km/h)`,
              meta: 'Preveri pogoje',
            })
          }
        }
      } catch { /* vreme je opcijsko */ }

      // R143 (§29): zapisana obvestila z življenjskim ciklom — fail-verbose
      // napaka se POKAŽE (ni tihe degradacije).
      try {
        const nRes = await fetch('/api/notifications')
        if (nRes.ok) {
          const data = (await nRes.json()) as { notifications: PersistedNotification[] }
          setPersisted(data.notifications ?? [])
          setPersistedError(null)
        } else {
          const err = (await nRes.json().catch(() => null)) as { error?: string } | null
          setPersistedError(`${nRes.status}: ${err?.error ?? 'napaka pri branju obvestil'}`)
        }
      } catch {
        setPersistedError('Obvestil ni bilo mogoče prenesti (omrežje).')
      }

      // Dedup: enaki kartici (isti kind+naslov+podnaslov) se združijo v eno
      // s števcem "×N" — primer: več projektov z istim imenom "Ograja Novak"
      const deduped: NotificationItem[] = []
      const seen = new Map<string, NotificationItem>()
      for (const item of out) {
        const key = `${item.kind}|${item.title}|${item.subtitle}`
        const existing = seen.get(key)
        if (existing) {
          existing.count = (existing.count ?? 1) + 1
        } else {
          seen.set(key, item)
          deduped.push(item)
        }
      }

      setItems(deduped)
      setBadge(deduped.reduce((n, i) => n + (i.count ?? 1), 0))
      if (out.length > 0 && loadedOnce.current) {
        setPulse(true)
        setTimeout(() => setPulse(false), 1200)
      }
      loadedOnce.current = true
    } catch {
      // offline — pustimo obstoječe podatke
    } finally {
      setLoading(false)
    }
  }, [])

  // Badge: ob mountu + ob 'roksal:refresh' (po syncu iz page.tsx)
  useEffect(() => {
    void load()
    const onRefresh = () => void load()
    window.addEventListener('roksal:refresh', onRefresh)
    return () => window.removeEventListener('roksal:refresh', onRefresh)
  }, [load])

  function handleClick(item: NotificationItem) {
    setOpen(false)
    if (item.kind === 'stock') {
      window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'inventory' } }))
    } else if (item.kind === 'install') {
      window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'dashboard' } }))
      window.dispatchEvent(new CustomEvent('roksal:select-project', { detail: item.id.replace('install-', '') }))
    } else if (item.kind === 'followup' || item.kind === 'invoice') {
      window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'crm' } }))
    } else {
      window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'dashboard' } }))
    }
  }

  /** R143 (§29): open ack — SENT|DELIVERED → OPENED; fail-verbose (404/409/500 se pokaže). */
  async function openPersisted(n: PersistedNotification) {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setPersistedError(`${res.status}: ${err?.error ?? 'odpiranje ni uspelo'}`)
        return
      }
      setPersistedError(null)
      void load()
    } catch {
      setPersistedError('Odpiranja ni bilo mogoče poslati (omrežje).')
    }
  }

  const KIND_STYLE: Record<NotificationItem['kind'], { icon: React.ElementType; bg: string; fg: string }> = {
    stock: { icon: Package, bg: 'bg-red-100', fg: 'text-red-600' },
    install: { icon: CalendarDays, bg: 'bg-roksal-amber/15', fg: 'text-roksal-amber' },
    weather: { icon: CloudLightning, bg: 'bg-sky-100', fg: 'text-sky-700' },
    followup: { icon: FileClock, bg: 'bg-orange-100', fg: 'text-orange-700' },
    invoice: { icon: Receipt, bg: 'bg-red-100', fg: 'text-red-700' },
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 text-white/70 hover:bg-white/10 hover:text-white"
        onClick={() => { setOpen(true); void load() }}
        aria-label={`Obvestila${badge > 0 ? ` (${badge} novih)` : ''}`}
        title="Obvestila"
      >
        <Bell className={`h-4 w-4 ${pulse ? 'animate-bounce' : ''}`} />
        {badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-roksal-red px-1 text-[9px] font-bold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-sm rounded-l-3xl">
          <SheetHeader className="border-b border-border/60 px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-roksal-navy">
              <Bell className="h-4 w-4 text-roksal-amber" />
              Obvestila
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </SheetTitle>
          </SheetHeader>

          <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto px-3 py-3 scrollbar-thin">
            {items.length === 0 && persisted.length === 0 && !loading && !persistedError && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCheck className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-roksal-navy">Vse je pod nadzorom</p>
                <p className="max-w-[220px] text-xs text-muted-foreground">
                  Ni nizke zaloge, danes ni montaž in vreme ne povzroča skrbi.
                </p>
                <Button variant="outline" size="sm" className="mt-1 min-h-[40px]" onClick={() => void load()}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Osveži
                </Button>
              </div>
            )}

            {loading && items.length === 0 && (
              <div className="space-y-2 py-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-border/50 p-3">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ul className="space-y-2" role="list">
              {items.map((item) => {
                const style = KIND_STYLE[item.kind]
                const Icon = style.icon
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(item)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-roksal-amber/40 hover:shadow-sm active:scale-[0.98]"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.bg}`}>
                        <Icon className={`h-5 w-5 ${style.fg}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold text-roksal-navy">{item.title}</p>
                          {(item.count ?? 1) > 1 && (
                            <span className="shrink-0 rounded-full bg-roksal-amber/15 px-1.5 text-[9px] font-bold text-roksal-amber">
                              ×{item.count}
                            </span>
                          )}
                          {item.kind === 'weather' && (
                            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                          )}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">{item.subtitle}</p>
                        {item.meta && (
                          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-roksal-amber">
                            {item.meta}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-roksal-amber" />
                    </button>
                  </li>
                )
              })}
            </ul>

            {/* R143 (§29): zapisana obvestila — življenjski cikel
                QUEUED → SENT → DELIVERED → OPENED / FAILED (retry politika). */}
            {persisted.length > 0 && (
              <div className="mt-3 border-t border-border/60 pt-3">
                <p className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Inbox className="h-3 w-3" aria-hidden="true" />
                  Poslana obvestila ({persisted.length})
                </p>
                <ul className="space-y-2" role="list">
                  {persisted.map((n) => {
                    const st = STATUS_STYLE[n.status]
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void openPersisted(n)}
                          className="group flex w-full items-start gap-3 rounded-xl border border-border/60 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-roksal-navy/25 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 active:scale-[0.98]"
                          aria-label={`${n.naslov} — ${st.label}`}
                        >
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-roksal-navy/5">
                            {n.entityType === 'jobrun' ? (
                              <Wrench className="h-4 w-4 text-roksal-navy" aria-hidden="true" />
                            ) : (
                              <Bell className="h-4 w-4 text-roksal-navy" aria-hidden="true" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p
                                className={`truncate text-[13px] font-semibold ${
                                  n.isRead ? 'text-muted-foreground' : 'text-roksal-navy'
                                }`}
                              >
                                {n.naslov}
                              </p>
                              <span
                                className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-border/50 px-1.5 py-0.5"
                                title={`Predloga ${n.template} v${n.templateVersion}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} aria-hidden="true" />
                                <span className={`text-[9px] font-bold tabular-nums ${st.text}`}>{st.label}</span>
                              </span>
                            </div>
                            {n.sporocilo && (
                              <p className="line-clamp-2 text-[11px] text-muted-foreground">{n.sporocilo}</p>
                            )}
                            {n.status === 'FAILED' && (
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-roksal-red">
                                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                                {n.lastError ?? 'Razlog ni znan'} · poskus{' '}
                                <span className="tabular-nums">
                                  {n.retryCount}/{n.maxRetries}
                                </span>
                              </p>
                            )}
                            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground/70">
                              {new Date(n.createdAt).toLocaleString('sl-SI', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {persistedError && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-1.5 rounded-lg border border-roksal-red/30 bg-roksal-red/5 px-3 py-2 text-[11px] font-semibold text-roksal-red"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {persistedError}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
