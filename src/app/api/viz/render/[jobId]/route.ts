// VIZ — GET /api/viz/render/[jobId] — status render joba.
// Spec: docs/VIZ_CONTRACTS.md → { jobId, status, resultPath, error }
import { NextResponse } from 'next/server'
import { authenticate, unauthorized } from '@/lib/auth'
import { getRenderJob } from '@/lib/viz/repository'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { jobId } = await params
    const job = await getRenderJob(jobId)
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
