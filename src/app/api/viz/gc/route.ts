// VIZ — POST/GET /api/viz/gc — staging garbage collection (runda S+4, P1).
//
// Briše zapuščeni staging (viz/staging/<token>/*) starejši od 24 h
// (VIZ_STAGING_TTL_MS preglasi). Nikoli ne prizadeneta shranjenih
// projektov niti render jobov (gcStaging dela list strogega prefixa
// viz/staging/ — glej src/lib/viz/gc.ts).
//
// Dostop (fail-closed, ruta preverja sama — proxy je javen samo zato, da
// Vercel Cron sploh pride do nje):
//   1. CRON_SECRET nastavljen → zahteva `Authorization: Bearer <CRON_SECRET>`
//      (to pošilja Vercel Cron; session piškotkov cron nima).
//   2. CRON_SECRET ni nastavljen → zahteva ADMIN sejo (vizOwner + isAdmin).
//
// Vercel Cron: vercel.json → dnevno ob 04:00 UTC. Brez dodatnih storitev.
import { NextResponse } from 'next/server'
import { gcStaging } from '@/lib/viz/gc'
import { vizOwner } from '@/lib/viz/ownership'

export const runtime = 'nodejs'

async function authorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization')
  if (secret) {
    return header === `Bearer ${secret}`
  }
  // Brez CRON_SECRET: dovoljen samo prijavljen ADMIN (ročni zagon iz UI/API).
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return false
  return ctx.isAdmin
}

async function handle(request: Request): Promise<NextResponse> {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: 'Neavtoriziran dostop do GC' }, { status: 401 })
  }
  try {
    const result = await gcStaging()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Viz GC error:', error)
    return NextResponse.json({ error: 'Napaka pri čiščenju staginga' }, { status: 500 })
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return handle(request)
}

/** Vercel Cron pošilja GET. */
export async function GET(request: Request): Promise<NextResponse> {
  return handle(request)
}
