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
 *  6. 🛒 aktivna naročila (OSNUTEK/POSLANO/POTRJENO — EN digest, R212):
 *     prej so signalizirala LE na zavihku (R208 badge), Domov (R210 kartica)
 *     in pečatu (R211) — zvonček je ostal slep.
 *
 * Podatki se poberejo le ob odprtju panela + ob dogodku 'roksal:refresh'
 * (ki ga sproži sync v page.tsx) — ni dodatnih intervalov.
 * Klik na obvestilo naviga na pravi zavihek prek 'roksal:navigate'.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Bell, Package, CalendarDays, CloudLightning, CheckCheck,
  ChevronRight, RefreshCw, AlertTriangle, Loader2, FileClock, Receipt,
  UserCog, Inbox, Wrench, History, ShieldCheck, ShoppingCart,
} from 'lucide-react'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { casOznaka } from '@/lib/osvezitev-fokus'
// R216 — tip artikla za deep-link osnutek (samo TIP; lib ostaja nedotaknjen).
import type { ZalogaArtikelZaNarocilo } from '@/lib/zaloga-povzetek'

interface NotificationItem {
  id: string
  kind: 'stock' | 'install' | 'weather' | 'followup' | 'invoice' | 'order'
  title: string
  subtitle: string
  meta?: string
  /** Koliko enakih obvestil je združenih (duplikati projektov z istim imenom) */
  count?: number
  /** R216 — deep-link za 'stock': artikel prek page.tsx centralNavigate
   * (roksal:navigate osnutek polje) → Zaloga + Osnutek dialog z TOČNO TIM
   * artikelom (konvergence signalcev — P1-e). Fail-safe: brez osnutka →
   * navadna navigacija na Zalogo (vedenje pred R216). */
  osnutek?: ZalogaArtikelZaNarocilo
}

/** R197 — varnostne predloge v zvončku dobijo ŠČIT + jantarno barvo (razločevanje
 * varnostnih vrstic od poslovnih: zaloga/montaže/računi). Sinhrono z
 * NOTIFICATION_TEMPLATES (fail-closed seznam v src/lib/notifications.ts). */
const VARNOSTNE_PREDLOGE: ReadonlySet<string> = new Set(['NEW_LOGIN', 'FAILED_LOGINS', 'ACCOUNT_ACTIVATED', 'PASSWORD_CHANGED', 'FAILED_LOGINS_OVERVIEW'])

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
  SENT: { label: 'Poslano', dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300' },
  DELIVERED: { label: 'Dostavljeno', dot: 'bg-roksal-amber', text: 'text-roksal-amber' },
  OPENED: { label: 'Odprto', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-300' },
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
  // R182 — pečat svežine (družina R170): čas zadnjega USPEŠNEGA branja VSEH
  // virov; vsaj EN neuspešen vir → BREZ pečata (nikoli lažne svežine).
  const [obvestilaOsvezitev, setObvestilaOsvezitev] = useState<Date | null>(null)
  // R182 — fail-verbose agregacije: vidna opozorilna vrstica z imeni virov,
  // ki niso bilo naloženi (non-403). Prej je tihi izpad /api/inventory pomenil
  // 'nizka zaloga NEVIDNA' = lažno 'Vse je pod nadzorom' (isti vzorec R162/R174).
  const [viriNapaka, setViriNapaka] = useState<string | null>(null)
  const loadedOnce = useRef(false)
  // R198 — masovno „Označi vse kot prebrano“: zaklep gumba med potekom
  // (dvoklik = dva klica, drugi vrača opened:0 — neškodljivo, ampak grdo).
  const [oznacujemVse, setOznacujemVse] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const out: NotificationItem[] = []
    // R182 — zbiranje NEUSPELIH virov: 403 = pravična meja vloge (R175 vzorec
    // — poštno stanje, NE napaka), vse ostalo (401/5xx/omrežje) gre v vidno
    // opozorilno vrstico + brez pečata.
    const neuspeliViri: string[] = []
    try {
      const [invRes, projRes] = await Promise.all([fetch('/api/inventory'), fetch('/api/projects')])
      const today = new Date()

      // 1) Nizka zaloga
      if (invRes.ok) {
        const inv = (await invRes.json()) as {
          id: string; sifraMateriala: string; naziv: string; kolicinaZaloga: number; minimalnaZaloga: number; enota: string
        }[]
        const low = (inv || []).filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga)
        for (const i of low.slice(0, 8)) {
          out.push({
            id: `stock-${i.id}`,
            kind: 'stock',
            title: i.naziv,
            subtitle: `Zaloga ${i.kolicinaZaloga} ${i.enota} · minimum ${i.minimalnaZaloga}`,
            meta: 'Naroči material',
            // R216 — konvergence signalcev (P1-e): klik → Zaloga + Osnutek
            // dialog z TOČNO TIM artikelom (EN VIR passthrough — isti objekt
            // kot paleta ⌘K R216; brez ponovnega filtra, brez izmišljevanja).
            osnutek: {
              id: i.id,
              sifraMateriala: i.sifraMateriala,
              naziv: i.naziv,
              kolicinaZaloga: i.kolicinaZaloga,
              enota: i.enota,
              minimalnaZaloga: i.minimalnaZaloga,
            },
          })
        }
      } else if (invRes.status !== 403) {
        // R182 — fail-verbose: tihi izpad vira = nizka zaloga NEVIDNA (lažno
        // 'Vse je pod nadzorom'); 403 = meja vloge, tiho (R175).
        neuspeliViri.push('zaloga')
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
      } else if (projRes.status !== 403) {
        neuspeliViri.push('projekti')
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
        } else if (invRes2.status !== 403) {
          // R182 — računi so FINANČNO KRITIČNI: tihi izpad = zapadli račun
          // NEVIDEN ('opcijski vir' NE pomeni tihe degradacije).
          neuspeliViri.push('računi')
        }
      } catch {
        neuspeliViri.push('računi')
      }

      // 6) R212 — aktivna naročila kot EN združen digest (EN vir resnice:
      // ista ruta kot Material → Naročila in R210 Domov kartica — R208/R210/
      // R211 družina). Vidno LE ko aktivnih > 0 (brez lažnega 0). Statusi so
      // dobesedne oznake chipov (R208) — determinizem, brez sklanjatev.
      // Fail-verbose R182: 403 = meja vloge (tiho, R175), ostalo = vidna
      // vrstica 'naročila' + brez pečata (nikoli lažne 'vse pod nadzorom').
      try {
        const oRes = await fetch('/api/material-orders')
        if (oRes.ok) {
          const orders = (await oRes.json()) as { id: string; status: string }[]
          const aktivna = (orders || []).filter(
            (o) => o.status === 'OSNUTEK' || o.status === 'POSLANO' || o.status === 'POTRJENO',
          )
          if (aktivna.length > 0) {
            const deli: string[] = []
            for (const status of ['OSNUTEK', 'POSLANO', 'POTRJENO'] as const) {
              const n = aktivna.filter((o) => o.status === status).length
              if (n > 0) deli.push(`${status} ${n}`)
            }
            out.push({
              id: 'orders-active',
              kind: 'order',
              title: 'Naročila, ki čakajo na dejanje',
              subtitle: `${deli.join(' · ')} — iz zadnjega nalaganja`,
              meta: 'Pregled: Material → Naročila',
            })
          }
        } else if (oRes.status !== 403) {
          neuspeliViri.push('naročila')
        }
      } catch {
        neuspeliViri.push('naročila')
      }

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
        } else if (wRes.status !== 403) {
          // R182 — R152 vzorec: izpad/izpahan vremenski vir = LAŽNA VARNOST
          // (monter bi sklepal, da vreme ne povzroča skrbi, a je sploh ni bran).
          neuspeliViri.push('vreme')
        }
      } catch {
        neuspeliViri.push('vreme')
      }

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

      // R182 — pečat + agregacijska napaka: pečat = zadnje USPEŠNO branje
      // VSEH virov (vsaj EN non-403 neuspešen → BREZ pečata + viden warning);
      // pri podatkih v viru gre za svojo prikazano sporočilo.
      if (neuspeliViri.length > 0) {
        setViriNapaka(`Nekateri viri niso bilo naloženi (${neuspeliViri.join(', ')}) — prikaz je lahko nepopoln.`)
        setObvestilaOsvezitev(null)
      } else {
        setViriNapaka(null)
        setObvestilaOsvezitev(new Date())
      }

      if (out.length > 0 && loadedOnce.current) {
        setPulse(true)
        setTimeout(() => setPulse(false), 1200)
      }
      loadedOnce.current = true
    } catch {
      // R182 — (prej tiho: 'offline — pustimo obstoječe podatke') omrežna
      // napaka je VIDNA; obstoječi podatki ostanejo, a BREZ lažnega pečata.
      setViriNapaka('Obvestila niso bila osvežena (omrežje) — prikaz je lahko zastarel.')
      setObvestilaOsvezitev(null)
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

  // R182 — vrnitev v zavihek → osveži agregacijo (pisarna spreminja zaloge,
  // račune in vreme v drugi seji; zvonek je prižgan STALNO — badge zastari).
  // load je fail-verbose — hook ne požira napak (EN VIR napak = loader).
  useRefetchOnFocus(load)

  function handleClick(item: NotificationItem) {
    setOpen(false)
    if (item.kind === 'stock') {
      // R216 — konvergence signalcev (P1-e): z obstoječim osnutkom → deep-link
      // (Zaloga + Osnutek dialog z artikelom — ISTI protokol kot paleta ⌘K);
      // brez (fail-safe, ne sme se zgoditi) → navadna navigacija (pred-R216).
      window.dispatchEvent(new CustomEvent('roksal:navigate', {
        detail: item.osnutek ? { tab: 'inventory', osnutek: item.osnutek } : { tab: 'inventory' },
      }))
    } else if (item.kind === 'install') {
      window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'dashboard' } }))
      window.dispatchEvent(new CustomEvent('roksal:select-project', { detail: item.id.replace('install-', '') }))
    } else if (item.kind === 'followup' || item.kind === 'invoice') {
      window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'crm' } }))
    } else if (item.kind === 'order') {
      // R212 — Material je za 'Več' sheetom (R206 lekcija): more:'material'
      // je obstoječi MoreTabId (page.tsx handleMoreSelect → MaterialIntelligenceTab).
      // R213 — subTab:'orders' = direktno Naročila podzavihek (digest povedal,
      // DA so aktivna naročila — uporabnik pristane na pravem mestu, ne na BOM).
      window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'material', subTab: 'orders' } }))
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

  /** R200 — varnostna zanka: FAILED_LOGINS_OVERVIEW → 'Odpri Ekipa'.
   *  Pregled pravi “N × napačno geslo po celotni ekipi” — brez akcije je ADMIN
   *  ostal pred praznim zidom (zaklep računa R134 je v Ekipa zavihku).
   *  Navigacija = obstoječi vzorec roksal:navigate { more: 'ekipa' } (kot CRM,
   *  R182); ack = isti openPersisted tok (vrstica postane Odprto).
   *  Vrstica FAILED_LOGINS_OVERVIEW nastaja IZKLJUČNO za ADMIN (r199, vloga
   *  pregrata) — Ekipa zavihek je RBAC-varovan (r190 meja) — akcija ne more
   *  priti v 403. Fail-verbose: napaka ack-a je vidna (persistedError). */
  async function odpriEkipoZaPregled(n: PersistedNotification) {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'ekipa' } }))
    await openPersisted(n)
  }

  /** R198 — masovni open ack: { all: true } → VSE vidne SENT|DELIVERED → OPENED;
   * fail-verbose (isti vzorec kot openPersisted); po uspehu osveži seznam
   * (badge in vrstice konvergirata prek istega load). */
  async function oznaciVsePrebrano() {
    setOznacujemVse(true)
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setPersistedError(`${res.status}: ${err?.error ?? 'označevanje ni uspelo'}`)
        return
      }
      setPersistedError(null)
      void load()
    } catch {
      setPersistedError('Zahteve ni bilo mogoče poslati (omrežje).')
    } finally {
      setOznacujemVse(false)
    }
  }

  const KIND_STYLE: Record<NotificationItem['kind'], { icon: React.ElementType; bg: string; fg: string }> = {
    stock: { icon: Package, bg: 'bg-red-100 dark:bg-red-500/15', fg: 'text-red-600 dark:text-red-400' },
    install: { icon: CalendarDays, bg: 'bg-roksal-amber/15', fg: 'text-roksal-amber' },
    weather: { icon: CloudLightning, bg: 'bg-sky-100 dark:bg-sky-500/15', fg: 'text-sky-700 dark:text-sky-300' },
    followup: { icon: FileClock, bg: 'bg-orange-100 dark:bg-orange-500/15', fg: 'text-orange-700 dark:text-orange-300' },
    invoice: { icon: Receipt, bg: 'bg-red-100 dark:bg-red-500/15', fg: 'text-red-700 dark:text-red-300' },
    order: { icon: ShoppingCart, bg: 'bg-roksal-amber/15', fg: 'text-roksal-amber' },
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
            <SheetTitle className="flex items-center gap-2 text-roksal-ink">
              <Bell className="h-4 w-4 text-roksal-amber" />
              Obvestila
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>Nizka zaloga, današnje montaže, naročila, vreme, računi in poslana obvestila.</span>
              {obvestilaOsvezitev && (
                <span
                  className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
                  title="Čas zadnje uspešne osvežitve podatkov"
                >
                  <History className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Osveženo ob{' '}
                  <span className="tabular-nums">{casOznaka(obvestilaOsvezitev)}</span>
                </span>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto px-3 py-3 scrollbar-thin">
            {viriNapaka && (
              <div
                role="alert"
                className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-roksal-red/30 bg-roksal-red/5 px-3 py-2 text-[11px] font-semibold text-roksal-red"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{viriNapaka}</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  aria-label="Ponovno naloži obvestila"
                  className="rounded px-1 py-0.5 font-bold transition-colors hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40"
                >
                  Poskusi znova
                </button>
              </div>
            )}

            {items.length === 0 && persisted.length === 0 && !loading && !persistedError && !viriNapaka && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
                  <CheckCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-semibold text-roksal-ink">Vse je pod nadzorom</p>
                <p className="max-w-[220px] text-xs text-muted-foreground">
                  Ni nizke zaloge, danes ni montaž, ni aktivnih naročil in vreme ne povzroča skrbi.
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
                      className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-roksal-amber/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/60 dark:focus-visible:ring-roksal-amber/40 active:scale-[0.98]"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.bg}`}>
                        <Icon className={`h-5 w-5 ${style.fg}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold text-roksal-ink">{item.title}</p>
                          {(item.count ?? 1) > 1 && (
                            <span className="shrink-0 rounded-full bg-roksal-amber/15 px-1.5 text-[9px] font-bold text-roksal-amber">
                              ×{item.count}
                            </span>
                          )}
                          {item.kind === 'weather' && (
                            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" />
                          )}
                        </div>
                        {/* R216 stil — stock številke tabular-nums (zaloge in
                            minimumi so primerljivi po širinkah — družina R138
                            števcev; vsebina ostane ista, brez sklanjatev). */}
                        <p className={`truncate text-[11px] text-muted-foreground ${item.kind === 'stock' ? 'tabular-nums' : ''}`}>{item.subtitle}</p>
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
                <div className="mb-2 flex items-center gap-1.5 px-1">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Inbox className="h-3 w-3" aria-hidden="true" />
                    Poslana obvestila ({persisted.length})
                  </p>
                  {/* R198 — masovno označevanje: samo ko je kaj neprebranega;
                    OPENED je terminalen (stroga tabela prehodov), zato gumb
                    po označitvi izgine (neprebrana = 0) — brez mrtvega gumba. */}
                  {(() => {
                    const neprebrana = persisted.filter((n) => !n.isRead).length
                    if (neprebrana === 0) return null
                    return (
                      <button
                        type="button"
                        onClick={() => void oznaciVsePrebrano()}
                        disabled={oznacujemVse}
                        className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-roksal-navy/5 hover:text-roksal-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-muted-foreground dark:hover:bg-roksal-ink/10 dark:hover:text-roksal-ink dark:focus-visible:ring-roksal-ink/40"
                        aria-label={`Označi vse kot prebrano (${neprebrana})`}
                        title={`Označi vse kot prebrano (${neprebrana})`}
                      >
                        {oznacujemVse ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCheck className="h-3 w-3" aria-hidden="true" />
                        )}
                        Označi vse ({neprebrana})
                      </button>
                    )
                  })()}
                </div>
                <ul className="space-y-2" role="list">
                  {persisted.map((n) => {
                    const st = STATUS_STYLE[n.status]
                    // R197 — varnostne vrstice (nova prijava, neuspešni poskusi,
                    // aktivacija) nosijo ščit in jantarno površino, da so na
                    // prvi pogled razločne od poslovnih obvestil.
                    const varnostna = VARNOSTNE_PREDLOGE.has(n.template)
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void openPersisted(n)}
                          className="group flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 dark:focus-visible:ring-roksal-ink/40 active:scale-[0.98]"
                          aria-label={`${n.naslov} — ${st.label}`}
                        >
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${varnostna ? 'bg-roksal-amber/10' : 'bg-roksal-navy/5'}`}>
                            {varnostna ? (
                              <ShieldCheck className="h-4 w-4 text-roksal-amber" aria-hidden="true" />
                            ) : n.entityType === 'jobrun' ? (
                              <Wrench className="h-4 w-4 text-roksal-ink" aria-hidden="true" />
                            ) : (
                              <Bell className="h-4 w-4 text-roksal-ink" aria-hidden="true" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p
                                className={`truncate text-[13px] font-semibold ${
                                  n.isRead ? 'text-muted-foreground' : 'text-roksal-ink'
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
                        {/* R200 — akcija kot SOSED gumba (veljaven HTML, ni
                            gnezdenja gumbov): samo FAILED_LOGINS_OVERVIEW —
                            edina varnostna vrstica z ekipnim obsegom. ml-11
                            poravna z vsebino vrstice (ikona 32px + gap 12px). */}
                        {n.template === 'FAILED_LOGINS_OVERVIEW' && (
                          <button
                            type="button"
                            onClick={() => void odpriEkipoZaPregled(n)}
                            className="ml-11 mt-1.5 inline-flex items-center gap-1 rounded-full bg-roksal-navy/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-roksal-navy transition-colors hover:bg-roksal-navy/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 active:scale-[0.97] dark:bg-roksal-ink/10 dark:text-roksal-ink dark:hover:bg-roksal-ink/20 dark:focus-visible:ring-roksal-ink/40"
                            aria-label="Odpri Ekipa — pregled ekipnih računov"
                            title="Pregled ekipnih računov (zaklep, vloge, aktivnost)"
                          >
                            <UserCog className="h-3 w-3 shrink-0" aria-hidden="true" />
                            Odpri Ekipa
                          </button>
                        )}
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
