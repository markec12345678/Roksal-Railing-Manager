'use client'

// R133: lene nalaganje merilnega klienta (ssr:false).
// Leaflet na uvozu zahteva `window` — direkten uvoz iz server komponente bi
// med SSR-om padel (ReferenceError: window is not defined → 500 za VELJAVNE
// povezave; neveljavne poti tega klienta nikoli ne renderirajo, zato napaka
// dolgo skrita). Isti vzorec kot MapMeasure v glavni aplikaciji (page.tsx).
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const MeasureClient = dynamic(() => import('./measure-client').then((m) => m.MeasureClient), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center bg-stone-100">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-roksal-amber" />
        <p className="text-xs text-muted-foreground">Nalagam merilno karto…</p>
      </div>
    </main>
  ),
})

export function MeasureLazy(props: {
  token: string
  nazivProjekta: string
  stranka: string | null
}) {
  return <MeasureClient {...props} />
}
