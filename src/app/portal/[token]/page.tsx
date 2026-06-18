// Roksal Field - Javni portal stranke (server component)
// Stran /portal/[token] — prikaz statusa, slik, cene in kontakta za stranko
import { db } from '@/lib/db'
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  Wrench,
  Pause,
  MessageSquare,
  History,
  ChevronRight,
  Euro,
  Camera,
} from 'lucide-react'
import { PortalGallery, type PortalPhoto } from './gallery'

const COMPANY = {
  ime: 'Roksal d.o.o. Kranj',
  telefon: '+386 4 237 05 50',
  telefonRaw: '+38642370550',
  email: 'info@roksal.si',
  naslov: 'Struževo 65, 4000 Kranj',
  website: 'www.roksal.si',
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; ring: string; icon: typeof Wrench }
> = {
  NACRTOVANO: {
    label: 'Načrtovano',
    bg: 'bg-amber-50',
    text: 'text-roksal-navy',
    ring: 'ring-amber-200',
    icon: Clock,
  },
  V_TEKU: {
    label: 'V teku',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
    icon: Wrench,
  },
  ZAKLJUCENO: {
    label: 'Zaključeno',
    bg: 'bg-green-50',
    text: 'text-roksal-green',
    ring: 'ring-green-200',
    icon: CheckCircle2,
  },
  USTAVLJENO: {
    label: 'Ustavljeno',
    bg: 'bg-red-50',
    text: 'text-roksal-red',
    ring: 'ring-red-200',
    icon: Pause,
  },
}

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PortalPage({ params }: PageProps) {
  const { token } = await params

  if (!token || token.length < 8) {
    return <NotFoundPage />
  }

  const project = await db.project.findUnique({
    where: { clientToken: token },
    include: {
      customer: true,
      photos: { orderBy: { createdAt: 'desc' } },
      auditLogs: {
        orderBy: { timestamp: 'asc' },
        take: 50,
      },
    },
  })

  if (!project || !project.clientPortalEnabled) {
    return <NotFoundPage />
  }

  const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.NACRTOVANO
  const StatusIcon = statusCfg.icon

  const photosByCategory = {
    PRED: project.photos.filter((p) => p.kategorija === 'PRED'),
    MED: project.photos.filter((p) => p.kategorija === 'MED'),
    PO: project.photos.filter((p) => p.kategorija === 'PO'),
  }

  const gallerySections = [
    {
      id: 'PRED' as const,
      label: 'Pred montažo',
      photos: photosByCategory.PRED.map((p) => ({
        imageData: p.imageData,
        opomba: p.opomba,
        createdAt: p.createdAt.toISOString(),
      })) satisfies PortalPhoto[],
    },
    {
      id: 'MED' as const,
      label: 'Med montažo',
      photos: photosByCategory.MED.map((p) => ({
        imageData: p.imageData,
        opomba: p.opomba,
        createdAt: p.createdAt.toISOString(),
      })) satisfies PortalPhoto[],
    },
    {
      id: 'PO' as const,
      label: 'Po montaži',
      photos: photosByCategory.PO.map((p) => ({
        imageData: p.imageData,
        opomba: p.opomba,
        createdAt: p.createdAt.toISOString(),
      })) satisfies PortalPhoto[],
    },
  ]

  // Timeline iz AuditLog
  const relevantLogs = project.auditLogs.filter((a) =>
    ['CREATE_PROJECT', 'STATUS_CHANGE', 'PORTAL_ENABLE', 'PORTAL_REGENERATE'].includes(a.akcija)
  )
  const timeline = relevantLogs
    .map((a) => {
      let title = a.akcija
      let description = ''
      try {
        if (a.akcija === 'CREATE_PROJECT' && a.newValue) {
          const v = JSON.parse(a.newValue)
          title = 'Projekt ustvarjen'
          description = v.nazivProjekta ?? ''
        } else if (a.akcija === 'STATUS_CHANGE') {
          title = 'Sprememba statusa'
          if (a.oldValue && a.newValue) {
            description = `${statusLabel(a.oldValue)} → ${statusLabel(a.newValue)}`
          } else if (a.newValue) {
            description = statusLabel(a.newValue)
          }
        } else if (a.akcija === 'PORTAL_ENABLE') {
          title = 'Portal omogočen'
          description = 'Ste prejeli povezavo za sledenje'
        } else if (a.akcija === 'PORTAL_REGENERATE') {
          title = 'Povezava obnovljena'
        }
      } catch {
        // ignore
      }
      return {
        title,
        description,
        timestamp: a.timestamp.toISOString(),
      }
    })
    .filter((t) => t.title)

  const totalPhotos =
    photosByCategory.PRED.length + photosByCategory.MED.length + photosByCategory.PO.length

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9ff]">
      {/* HEADER */}
      <header className="bg-roksal-navy text-white shadow-lg">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-roksal-amber text-roksal-navy font-bold text-lg shadow-md">
                R
              </div>
              <div>
                <p className="font-bold text-sm leading-tight tracking-wide">ROKSAL d.o.o.</p>
                <p className="text-[11px] text-white/70 leading-tight">Kranj · Slovenija</p>
              </div>
            </div>
            <a
              href={`tel:${COMPANY.telefonRaw}`}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              Pokliči
            </a>
          </div>
          <div className="border-t border-white/10 pt-3">
            <p className="text-[11px] text-white/60 uppercase tracking-wider mb-1">
              Vaš projekt
            </p>
            <h1 className="text-xl font-bold leading-tight">{project.nazivProjekta}</h1>
            {project.customer && (
              <p className="text-sm text-white/80 mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {project.customer.ime}
                {project.customer.naslov ? ` · ${project.customer.naslov}` : ''}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-2xl w-full px-4 py-5 space-y-5">
        {/* STATUS CARD */}
        <section
          className={`rounded-xl border ${statusCfg.ring} ring-1 ${statusCfg.bg} p-4 shadow-sm`}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm`}>
                <StatusIcon className={`h-5 w-5 ${statusCfg.text}`} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Status</p>
                <p className={`text-lg font-bold ${statusCfg.text} leading-tight`}>
                  {statusCfg.label}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {project.datumMontaze && (
              <div className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2">
                <Calendar className="h-4 w-4 text-roksal-amber shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground leading-tight">Datum montaže</p>
                  <p className="text-sm font-semibold text-roksal-navy truncate">
                    {new Date(project.datumMontaze).toLocaleDateString('sl-SI', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            )}
            {project.estimatedPrice !== null && project.estimatedPrice !== undefined && (
              <div className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2">
                <Euro className="h-4 w-4 text-roksal-green shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground leading-tight">Predvidena cena</p>
                  <p className="text-sm font-semibold text-roksal-navy truncate">
                    {formatPrice(project.estimatedPrice)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* MONTER NOTES */}
        {project.clientNotes && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-roksal-amber">
                <MessageSquare className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-sm font-bold text-roksal-navy">Sporočilo monterja</p>
            </div>
            <p className="text-sm text-roksal-navy leading-relaxed whitespace-pre-wrap">
              {project.clientNotes}
            </p>
          </section>
        )}

        {/* PHOTO TIMELINE */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Camera className="h-4 w-4 text-roksal-navy" />
            <h2 className="text-base font-bold text-roksal-navy">Slike montaže</h2>
            {totalPhotos > 0 && (
              <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {totalPhotos} {totalPhotos === 1 ? 'slika' : totalPhotos < 5 ? 'slike' : 'slik'}
              </span>
            )}
          </div>
          <PortalGallery sections={gallerySections} />
        </section>

        {/* TIMELINE / STATUS HISTORY */}
        {timeline.length > 0 && (
          <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-roksal-navy" />
              <h2 className="text-base font-bold text-roksal-navy">Zgodovina projekta</h2>
            </div>
            <div className="relative space-y-0">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
              {timeline.map((event, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-2 animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-roksal-amber/15 ring-2 ring-white">
                    <div className="h-2 w-2 rounded-full bg-roksal-amber" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-roksal-navy">{event.title}</p>
                      <time className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(event.timestamp).toLocaleDateString('sl-SI', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </time>
                    </div>
                    {event.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{event.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CONTACT CTA */}
        <section className="rounded-xl border border-roksal-navy/15 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-roksal-navy mb-1">Imate vprašanja?</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Naša ekipa je na voljo za vse informacije o vašem projektu.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${COMPANY.telefonRaw}`}
              className="flex items-center justify-center gap-2 rounded-lg bg-roksal-green text-white px-3 py-3 text-sm font-semibold hover:bg-roksal-green/90 active:scale-[0.98] transition-all"
            >
              <Phone className="h-4 w-4" />
              Pokliči
            </a>
            <a
              href={`mailto:${COMPANY.email}?subject=${encodeURIComponent(
                `Povpraševanje: ${project.nazivProjekta}`
              )}`}
              className="flex items-center justify-center gap-2 rounded-lg bg-roksal-navy text-white px-3 py-3 text-sm font-semibold hover:bg-roksal-navy/90 active:scale-[0.98] transition-all"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
          </div>
          <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-roksal-amber" />
              {COMPANY.telefon}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-roksal-amber" />
              {COMPANY.email}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-roksal-amber" />
              {COMPANY.naslov}
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-roksal-navy text-white/80 mt-auto">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-roksal-amber text-roksal-navy font-bold text-sm">
                R
              </div>
              <div>
                <p className="text-xs font-semibold text-white leading-tight">{COMPANY.ime}</p>
                <p className="text-[10px] text-white/60 leading-tight">{COMPANY.website}</p>
              </div>
            </div>
            <p className="text-[10px] text-white/50">
              Portal stranke · {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff] p-4">
      <div className="max-w-md w-full rounded-xl border border-border bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <ChevronRight className="h-7 w-7 text-roksal-red" />
        </div>
        <h1 className="text-lg font-bold text-roksal-navy mb-2">Stran ni na voljo</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Ta povezava ni veljavna ali pa je portal onemogočen. Za več informacij kontaktirajte
          ekipo Roksal.
        </p>
        <div className="space-y-2 text-xs text-muted-foreground border-t border-border pt-4">
          <p className="flex items-center justify-center gap-2">
            <Phone className="h-3.5 w-3.5 text-roksal-amber" />
            {COMPANY.telefon}
          </p>
          <p className="flex items-center justify-center gap-2">
            <Mail className="h-3.5 w-3.5 text-roksal-amber" />
            {COMPANY.email}
          </p>
        </div>
      </div>
    </div>
  )
}

function formatPrice(price: number): string {
  return (
    new Intl.NumberFormat('sl-SI', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price) + ''
  )
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    NACRTOVANO: 'Načrtovano',
    V_TEKU: 'V teku',
    ZAKLJUCENO: 'Zaključeno',
    USTAVLJENO: 'Ustavljeno',
  }
  return map[s] || s
}

export const metadata = {
  title: 'Portal stranke — Roksal d.o.o.',
  description: 'Sledite napredku vašega projekta montaže ograje.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
