// VIZ — GET /api/viz/render/[jobId] — status render joba.
// Spec: docs/VIZ_CONTRACTS.md → { jobId, status, resultPath, error }
import { NextResponse } from 'next/server'
import { vizOwner } from '@/lib/viz/ownership'
import { getRenderJobForOwner } from '@/lib/viz/repository'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // S+4: tuj render job = 404 (ne 403).
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const { jobId } = await params
    const job = await getRenderJobForOwner(jobId, ctx)
    if (!job) {
      return NextResponse.json({ error: 'Render job ne obstaja' }, { status: 404 })
    }
    return NextResponse.json({
      jobId: job.id,
      status: job.status, // queued | processing | completed | failed
      resultPath: job.resultPath,
      error: job.error,
    })
  } catch (error) {
    console.error('Viz render GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju render joba' }, { status: 500 })
  }
}
