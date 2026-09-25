// Roksal Field — JAVNA stran: samomeritev stranke (/m/[token])
// Stranka prejme povezavo (SMS/e-pošta/WhatsApp), nariše črto ograje na
// satelitski karti in pošlje povpraševanje — brez prijave, brez namestitve.
// Model: ProFence "Measure Your Fence Line" (raziskava, runda E).
//
// R133 (§8): ENOTNA validacija z /api/public/measure prek resolveMeasureToken
// (scoped measureToken: potek/revokacija/onemogočeno). Vsa neveljavna stanja
// dobijo ISTO javno sporočilo (enumeration protection) + dnevniški poskus.
// Merilni klient se naloži LEN (ssr:false) — Leaflet na uvozu zahteva `window`
// in bi med SSR-om padel (dolgo skrit bug za VELJAVNE povezave: 500).
import { ShieldX } from 'lucide-react'
import { headers } from 'next/headers'
import { clientIpOfHeaders, hashIp, logMeasureEvent, resolveMeasureToken } from '@/lib/measure'
import { MeasureLazy } from './measure-lazy'

const COMPANY = {
  ime: 'Roksal d.o.o. Kranj',
  telefon: '+386 4 237 05 50',
  email: 'info@roksal.si',
}

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function CustomerMeasurePage({ params }: PageProps) {
  const { token } = await params
  const hdrs = await headers()
  const ipHash = hashIp(clientIpOfHeaders(hdrs))
  const userAgent = hdrs.get('user-agent')

  // DB napaka → prijazna zavrnitev (fail-closed); napaka ostane v logu.
  const resolved = await resolveMeasureToken(token).catch((error) => {
    console.error('[measure] preverba žetona NI uspela:', error)
    return { status: 'NOT_FOUND' as const, project: null }
  })

  if (resolved.status !== 'OK') {
    // Dnevnik zavrnjenih poskusov je vzdržljiv, a ne sme porušiti stranke.
    try {
      await logMeasureEvent({
        projectId: null,
        akcija: 'MEASURE_REJECTED',
        ipHash,
        userAgent,
        podrobnosti: JSON.stringify({ reason: resolved.status, surface: 'PAGE' }),
      })
    } catch (error) {
      console.error('[measure] dostopni dnevnik NI zapisan:', error)
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <ShieldX className="h-7 w-7 text-red-500" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-roksal-navy">Povezava ni veljavna</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Ta merilna povezava ne obstaja več ali pa je bila napačno prekopirana.
            Za novo povezavo pokličite {COMPANY.ime}, tel. {COMPANY.telefon}.
          </p>
          <p className="mt-4 text-xs text-stone-400">{COMPANY.email}</p>
        </div>
      </main>
    )
  }

  try {
    await logMeasureEvent({
      projectId: resolved.project.id,
      akcija: 'MEASURE_VIEW',
      ipHash,
      userAgent,
    })
  } catch (error) {
    console.error('[measure] dostopni dnevnik NI zapisan:', error)
  }

  return (
    <MeasureLazy
      token={token}
      nazivProjekta={resolved.project.nazivProjekta}
      stranka={resolved.project.customer?.ime ?? null}
    />
  )
}
