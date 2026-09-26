// Roksal — JAVNA stran: aktivacija povabljenega računa (/aktivacija/[token])
// R134 (issue #5 §9): ADMIN povabi člana ekipe prek /api/users; aktivacijska
// povezava (velja 7 dni) prinese žeton, katerega hash je v bazi. Uporabnik
// si tu nastavi geslo in se nato prijavi.
//
// Strežnik preveri žeton (hash lookup) in prikaže ALI formo ALI enotno
// zavrnitev (enumeration protection — vzorec §7/§8). Deaktiviran/zaklenjen
// profil se ne more aktivirati.
import { ShieldX } from 'lucide-react'
import { db } from '@/lib/db'
import { hashInviteToken } from '@/lib/user-lifecycle'
import { ActivationClient } from './activation-client'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function AktivacijaPage({ params }: PageProps) {
  const { token } = await params

  const profile = await db.profile
    .findUnique({
      where: { inviteTokenHash: hashInviteToken(token) },
      select: {
        ime: true,
        deactivatedAt: true,
        lockedAt: true,
        inviteExpiresAt: true,
      },
    })
    .catch(() => null)

  const valid =
    profile &&
    !profile.deactivatedAt &&
    !profile.lockedAt &&
    profile.inviteExpiresAt &&
    profile.inviteExpiresAt.getTime() > Date.now()

  if (!valid || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 p-6 dark:bg-background">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-800 dark:bg-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
            <ShieldX className="h-7 w-7 text-red-500 dark:text-red-400" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-roksal-ink">Povezava ni več veljavna</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Aktivacijska povezava je potekla ali pa je bila že uporabljena.
            Za novo povabilo pokličite pisarno Roksal, tel. +386 4 237 05 50.
          </p>
        </div>
      </main>
    )
  }

  return <ActivationClient token={token} ime={profile.ime} />
}
