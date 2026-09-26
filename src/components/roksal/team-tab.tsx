'use client'

// Roksal — Ekipa: življenjski cikl računov (R134, issue #5 §9)
// ---------------------------------------------------------------------------
// Površina za pisarno (ADMIN upravlja, VODJA bere): seznam računov z statusi
// (aktiven / deaktiviran / zaklenjen / povabljen) + akcije:
//   • Povabi       — profil brez gesla + ENKRATNA aktivacijska povezava
//                    (ni e-poštne infrastrukture — admin povezavo posreduje po SMS);
//   • Deaktiviraj  — offboarding: prijava + že izdani žetoni takoj mrtevi;
//   • Zakleni      — varnostni zaklep (sum kompromitacije);
//   • Vloga        — sprememba vloge (seje se revoke → ponovna prijava);
//   • Ponastavi geslo — začasno geslo prikažemo ENKRAT (mustChangePassword).
// Own-guard je tudi na strežniku — tu ga samo ne prikažemo (občutek ≠ varnost).

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  BadgeCheck,
  CalendarClock,
  Copy,
  Loader2,
  Lock,
  LockOpen,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// R141 (§23): register poslov se naloži le na Ekipa površini (code-split).
const JobsPanel = dynamic(
  () => import('@/components/roksal/jobs-panel').then((m) => m.JobsPanel),
  { ssr: false, loading: () => null },
)

interface Lifecycle {
  deactivated: boolean
  locked: boolean
  mustChangePassword: boolean
  invited: boolean
  inviteExpired: boolean
}

interface TeamUser {
  id: string
  ime: string
  email: string
  vloga: string
  telefon: string | null
  lastActive: string | null
  createdAt: string
  lifecycle: Lifecycle
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  VODJA: 'Vodja',
  MONTER: 'Monter',
  SKLADISCE: 'Skladišče',
}

const ROLE_CHIP: Record<string, string> = {
  ADMIN: 'bg-roksal-navy/10 text-roksal-navy ring-1 ring-inset ring-roksal-navy/20',
  VODJA: 'bg-roksal-amber/15 text-amber-700 ring-1 ring-inset ring-roksal-amber/30',
  MONTER: 'bg-secondary text-muted-foreground ring-1 ring-inset ring-border',
  SKLADISCE: 'bg-roksal-green/10 text-roksal-green ring-1 ring-inset ring-roksal-green/25',
}

/**
 * Determinističen avatar (R135 stil): iniciali + ena od 4 blagovnih tint,
 * izbrana po dolžini imena (isto ime = isti ton, brez naključja).
 */
const AVATAR_TINT = [
  'bg-roksal-navy/12 text-roksal-navy',
  'bg-roksal-amber/18 text-amber-700',
  'bg-roksal-green/14 text-roksal-green',
  'bg-stone-200/70 text-stone-600',
] as const

function initialsOf(ime: string): string {
  const parts = ime.trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? '?'
  const b = parts.length > 1 ? parts[parts.length - 1]![0] : ''
  return (a + b).toUpperCase()
}

function avatarTintOf(ime: string): string {
  return AVATAR_TINT[ime.trim().length % AVATAR_TINT.length]!
}

type OneTime =
  | { kind: 'activation'; path: string; email: string }
  | { kind: 'tempPassword'; password: string; email: string }
  | null

export function TeamTab() {
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  // §10 (R135): UI se veže na KONKRETNE pravice (users.read/users.manage),
  // ne na vloge — isti jezik kot strežniška vrata (fail-closed enako).
  const [myPermissions, setMyPermissions] = useState<readonly string[]>([])
  const [users, setUsers] = useState<TeamUser[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteIme, setInviteIme] = useState('')
  const [inviteVloga, setInviteVloga] = useState('MONTER')
  const [oneTime, setOneTime] = useState<OneTime>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const me = await fetch('/api/auth').then((r) => (r.ok ? r.json() : null))
      setMyRole(me?.user?.vloga ?? null)
      setMyId(me?.user?.id ?? null)
      setMyPermissions(Array.isArray(me?.permissions) ? (me.permissions as string[]) : [])
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = (await res.json()) as TeamUser[]
        setUsers(Array.isArray(data) ? data : [])
      } else {
        setUsers([])
      }
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(body: Record<string, unknown>, okMsg: string, busyId: string | null) {
    setBusyId(busyId)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (!res.ok) {
        toast.error((data?.error as string) || 'Napaka pri akciji')
        return null
      }
      toast.success(okMsg)
      await load()
      return data
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
      return null
    } finally {
      setBusyId(null)
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Kopiranje ni uspelo')
    }
  }

  async function submitInvite() {
    setBusyId('invite')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', email: inviteEmail.trim(), ime: inviteIme.trim(), vloga: inviteVloga }),
      })
      const data = (await res.json().catch(() => null)) as { activationPath?: string; error?: string } | null
      if (!res.ok || !data?.activationPath) {
        toast.error(data?.error || 'Povabilo ni uspelo')
        return
      }
      toast.success('Povabilo ustvarjeno — povezavo posredujite po SMS/telefonu')
      setInviteOpen(false)
      setInviteEmail('')
      setInviteIme('')
      setOneTime({ kind: 'activation', path: data.activationPath, email: inviteEmail.trim() })
      await load()
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    } finally {
      setBusyId(null)
    }
  }

  async function resetPassword(u: TeamUser) {
    const ok = window.confirm(
      `Ponastavitev gesla za ${u.ime}:\n• trenutno geslo preneha delovati,\n• vse seje se odjavijo,\n• začasno geslo se prikaže SAMO ENKRAT (posredujte ga po telefonu).\n\nNadaljujem?`,
    )
    if (!ok) return
    const data = await act({ action: 'resetPassword', userId: u.id }, 'Začasno geslo izdano', u.id)
    if (data?.tempPassword) {
      setOneTime({ kind: 'tempPassword', password: String(data.tempPassword), email: u.email })
    }
  }

  // §10 (R135): pravice namesto vlog — users.manage = upravljanje, users.read = pregled
  const canManage = myPermissions.includes('users.manage')
  const canRead = myPermissions.includes('users.read')

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      {/* Glava */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-roksal-navy/10">
            <UserCog className="h-4.5 w-4.5 text-roksal-navy" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-roksal-navy">Ekipa — življenjski cikl računov</h2>
            <p className="text-[11px] text-muted-foreground">
              Povabila, deaktivacija, zaklep, vloge. Vsako dejanje gre v dnevnik.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="ghost" onClick={() => void load()} className="h-8 px-2.5 focus-visible:ring-2 focus-visible:ring-roksal-navy/40" aria-label="Osveži seznam ekipe" aria-busy={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={() => setInviteOpen(true)}
              className="h-8 bg-roksal-navy hover:bg-roksal-navy/90 text-white"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Povabi
            </Button>
          )}
        </div>
      </div>

      {!canManage && canRead && (
        <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
          Pregled je samo za branje — upravljanje računov (pravica users.manage) je za administratorja.
        </div>
      )}

      {/* Seznam */}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-white p-10">
          <Loader2 className="h-6 w-6 animate-spin text-roksal-amber" />
        </div>
      ) : users.length === 0 ? (
        canRead ? (
          <div className="rounded-xl border border-border bg-white p-10 text-center text-sm text-muted-foreground">
            Ni podatkov — povabite prvega člana ekipe.
          </div>
        ) : (
          // §10 (R135): pošteno stanje namesto praznega seznama (strežnik: 403 users.read)
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-amber-800">Ekipa — ureja pisarna</p>
              <p className="text-[11px] text-amber-700/90 leading-relaxed">
                Pregled računov je pravica users.read (pisarna). Za povabilo ali
                spremembo vloge kontaktirajte administratorja.
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const self = u.id === myId
            return (
              <div
                key={u.id}
                className={`rounded-xl border bg-white p-3 shadow-sm transition-all hover:shadow-md ${
                  u.lifecycle.deactivated
                    ? 'border-stone-200 opacity-75'
                    : u.lifecycle.locked
                      ? 'border-roksal-red/40'
                      : 'border-border'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    aria-hidden="true"
                    className={`flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full text-[11px] font-bold ${avatarTintOf(u.ime)}`}
                  >
                    {initialsOf(u.ime)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-roksal-navy">{u.ime}</p>
                      <Badge
                        className={`text-[10px] font-medium ${ROLE_CHIP[u.vloga] ?? 'bg-secondary'}`}
                        title={`Vloga: ${ROLE_LABEL[u.vloga] ?? u.vloga}`}
                      >
                        {ROLE_LABEL[u.vloga] ?? u.vloga}
                      </Badge>
                      {self && (
                        <Badge variant="outline" className="text-[10px]">
                          ti
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                  </div>

                  {/* Statusni chip */}
                  {u.lifecycle.deactivated ? (
                    <Badge variant="secondary" className="text-[10px] bg-stone-100 text-stone-500" title="Offboarding — prijava in že izdani žetoni so takoj mrtvi">
                      <Trash2 className="mr-1 h-3 w-3" />
                      Deaktiviran
                    </Badge>
                  ) : u.lifecycle.locked ? (
                    <Badge variant="secondary" className="text-[10px] bg-roksal-red/10 text-roksal-red" title="Varnostni zaklep — prijava blokirana">
                      <Lock className="mr-1 h-3 w-3" />
                      Zaklenjen
                    </Badge>
                  ) : u.lifecycle.invited ? (
                    <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700" title="Račun še ni aktiviran prek povabila">
                      <CalendarClock className="mr-1 h-3 w-3" />
                      {u.lifecycle.inviteExpired ? 'Povabilo poteklo' : 'Čaka aktivacijo'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] bg-roksal-green/10 text-roksal-green" title="Aktiven račun — prijava deluje">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      Aktiven
                    </Badge>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    Zadnja aktivnost: {u.lastActive ? new Date(u.lastActive).toLocaleDateString('sl-SI') : 'nikoli'}
                  </span>
                  {u.lifecycle.mustChangePassword && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <ShieldAlert className="h-3 w-3" />
                      mora zamenjati geslo
                    </span>
                  )}
                </div>

                {/* Akcije (samo ADMIN, ne na svojem računu za destruktivne) */}
                {canManage && !self && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
                    {u.lifecycle.deactivated ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyId === u.id}
                        onClick={() => void act({ action: 'reactivate', userId: u.id }, `${u.ime} reaktiviran`, u.id)}
                        className="h-7 text-[11px] text-roksal-green hover:bg-roksal-green/10"
                        title="Vrni račun v delo"
                      >
                        {busyId === u.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <UserCheck className="mr-1 h-3 w-3" />}
                        Reaktiviraj
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyId === u.id}
                        onClick={() => {
                          const ok = window.confirm(
                            `Deaktivacija ${u.ime}: prijava ne bo več mogoča, vse seje takoj padejo (že izdani žetoni prenehajo delovati). Podatki ostanejo. Nadaljujem?`,
                          )
                          if (ok) void act({ action: 'deactivate', userId: u.id }, `${u.ime} deaktiviran`, u.id)
                        }}
                        className="h-7 text-[11px] text-stone-500 hover:bg-secondary"
                        title="Offboarding — prijava + žetoni takoj mrtevi"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Deaktiviraj
                      </Button>
                    )}

                    {u.lifecycle.locked ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyId === u.id}
                        onClick={() => void act({ action: 'unlock', userId: u.id }, `${u.ime} odklenjen`, u.id)}
                        className="h-7 text-[11px] text-roksal-navy hover:bg-roksal-navy/10"
                      >
                        <LockOpen className="mr-1 h-3 w-3" />
                        Odkleni
                      </Button>
                    ) : (
                      !u.lifecycle.deactivated && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyId === u.id}
                          onClick={() => void act({ action: 'lock', userId: u.id }, `${u.ime} zaklenjen`, u.id)}
                          className="h-7 text-[11px] text-roksal-red hover:bg-roksal-red/10"
                          title="Varnostni zaklep (npr. sum kompromitacije)"
                        >
                          <Lock className="mr-1 h-3 w-3" />
                          Zakleni
                        </Button>
                      )
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyId === u.id}
                      onClick={() => void resetPassword(u)}
                      className="h-7 text-[11px] text-amber-700 hover:bg-roksal-amber/10"
                      title="Začasno geslo (prikaže se ENKRAT) + prisilna zamenjava"
                    >
                      <ShieldAlert className="mr-1 h-3 w-3" />
                      Ponastavi geslo
                    </Button>

                    <div className="ml-auto">
                      <Select
                        value={u.vloga}
                        onValueChange={(v) => {
                          if (v === u.vloga) return
                          const ok = window.confirm(
                            `Sprememba vloge za ${u.ime}: ${ROLE_LABEL[u.vloga] ?? u.vloga} → ${ROLE_LABEL[v] ?? v}.\nUporabnik bo odjavljen na vseh napravah (nova vloga velja po ponovni prijavi). Nadaljujem?`,
                          )
                          if (ok) void act({ action: 'setRole', userId: u.id, vloga: v }, 'Vloga spremenjena', u.id)
                        }}
                      >
                        <SelectTrigger className="h-7 w-[112px] text-[11px]" aria-label="Vloga">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(ROLE_LABEL).map((r) => (
                            <SelectItem key={r} value={r} className="text-[12px]">
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* R141 (§23): register vzdrževalnih poslov — samo ADMIN (API je ADMIN-only). */}
      {myRole === 'ADMIN' && <JobsPanel />}

      {/* Povabilo dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-roksal-navy">Povabi člana ekipe</DialogTitle>
            <DialogDescription className="text-xs">
              Račun nastane brez gesla. Aktivacijsko povezavo (velja 7 dni) si kopirate in pošljete po
              SMS/telefonu — uporabnik si na njej sam nastavi geslo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-ime" className="text-[11px]">
                Ime in priimek
              </Label>
              <Input
                id="invite-ime"
                value={inviteIme}
                onChange={(e) => setInviteIme(e.target.value)}
                placeholder="npr. Marko Novak"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-[11px]">
                E-pošta
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="marko@roksal.si"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Vloga</Label>
              <Select value={inviteVloga} onValueChange={setInviteVloga}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(ROLE_LABEL).map((r) => (
                    <SelectItem key={r} value={r} className="text-[12px]">
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInviteOpen(false)}>
              Prekliči
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submitInvite()}
              disabled={busyId === 'invite' || !inviteEmail.trim() || !inviteIme.trim()}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white"
            >
              {busyId === 'invite' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}
              Ustvari povabilo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ENKRATNI prikaz: aktivacijska povezava / začasno geslo */}
      <Dialog open={oneTime !== null} onOpenChange={(open) => !open && setOneTime(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-navy">
              <BadgeCheck className="h-4.5 w-4.5 text-roksal-green" />
              {oneTime?.kind === 'activation' ? 'Aktivacijska povezava' : 'Začasno geslo'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {oneTime?.kind === 'activation'
                ? `Za ${oneTime.email}. Pokaže se SAMO zdaj — skopirajte in pošljite po SMS/telefonu. Povezava velja 7 dni.`
                : `Za ${oneTime?.email}. Pokaže se SAMO zdaj — posredujte po telefonu. Ob prijavi uporabnik MORA geslo zamenjati.`}
            </DialogDescription>
          </DialogHeader>
          {oneTime?.kind === 'activation' && (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0 truncate rounded-md border border-border bg-secondary/40 px-2.5 py-2 font-mono text-[11px] text-roksal-navy">
                {typeof window !== 'undefined' ? `${window.location.origin}${oneTime.path}` : oneTime.path}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyText(`${window.location.origin}${oneTime.path}`)} className="h-9 shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40" aria-label="Kopiraj aktivacijsko povezavo">
                <Copy className={`h-3.5 w-3.5 ${copied ? 'text-roksal-green' : ''}`} aria-hidden="true" />
              </Button>
            </div>
          )}
          {oneTime?.kind === 'tempPassword' && (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 rounded-md border border-roksal-amber/40 bg-roksal-amber/10 px-2.5 py-2 font-mono text-sm font-bold tracking-wider text-roksal-navy">
                {oneTime.password}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyText(oneTime.password)} className="h-9 shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40" aria-label="Kopiraj začasno geslo">
                <Copy className={`h-3.5 w-3.5 ${copied ? 'text-roksal-green' : ''}`} aria-hidden="true" />
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              size="sm"
              onClick={() => setOneTime(null)}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white"
            >
              Skopirano — zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
