// Roksal Field — JAVNA stran: samomeritev stranke (/m/[token])
// Stranka prejme povezavo (SMS/e-pošta/WhatsApp), nariše črto ograje na
// satelitski karti in pošlje povpraševanje — brez prijave, brez namestitve.
// Model: ProFence "Measure Your Fence Line" (raziskava, runda E).
import { db } from '@/lib/db'
import { MeasureClient } from './measure-client'

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

  const project = await db.project.findUnique({
    where: { clientToken: token },
    select: { nazivProjekta: true, customer: { select: { ime: true } } },
  }).catch(() => null)

  if (!project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-roksal-navy">Povezava ni veljavna</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ta merilna povezava ne obstaja več ali pa je bila napačno prekopirana.
            Za novo povezavo pokličite {COMPANY.ime}, tel. {COMPANY.telefon}.
          </p>
        </div>
      </main>
    )
  }

  return (
    <MeasureClient
      token={token}
      nazivProjekta={project.nazivProjekta}
      stranka={project.customer?.ime ?? null}
    />
  )
}
