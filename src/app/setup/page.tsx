// Roksal — JAVNA stran: nastavitvena konzola (/setup, R137)
// Lastnikova varovalka za "zaklenjen ven" scenarij: bootstrap prvega ADMIN
// računa ali obnova izgubljenega gesla. Zaščitena z žetonom iz okolja
// (ROKSAL_SETUP_TOKEN) — če žeton ni nastavljen, stran iskreno pokaže, da
// je konzola izklopljena (nikogar ne zaveda, vrata pa so na strežniku
// vseeno fail-closed zaprta — 404).
import { SetupClient } from './setup-client'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SetupPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const token = typeof sp.token === 'string' ? sp.token : ''
  return <SetupClient initialToken={token} />
}
