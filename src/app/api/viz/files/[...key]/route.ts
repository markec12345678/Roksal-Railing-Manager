// VIZ — GET /api/viz/files/[...key] — proxy za datoteke (runda S+4, P0 §2).
//
// Ozadje (audit S+4): Vercel Blob javni dostop pomeni HTTP 200 BREZ
// avtentikacije za vse projektne datoteke (fotografije balkonov strank!,
// maske, preview, placement.json, result.json, celo project.json) —
// CORS `access-control-allow-origin: *`. To ni bila namerna varnostna
// odločitev, temveč prikladnost (canvas re-staging). Model je zdaj:
//
//   klient → /api/viz/files/viz/projects/<id>/<ime>  (ista seja, same-origin)
//          → ruta preveri sejo + LASTNIŠTVO projekta
//          → server prebere blob (BLOB_READ_WRITE_TOKEN, nikoli klientu)
//          → stream z Cache-Control: private
//
// Surovi blob URL-ji se ne shranjujejo več v nove metadata zapise (records
// hranijo proxy poti); zapuščinske surove URL-je pretvori clientUrlForPath().
// Rezidualno tveganje (dokumentirano): fizično blob objekt z znanim URL-jem
// je še vedno mogoče prenesti — URL vsebuje 122-bitni naključni UUID in se
// NE pojavlja več v nobenem klientu dosegljivem odgovoru. Za strožje bi bilo
// treba zamenjati storage provider (plačljivo — izven obsega S+4).
//
// Staging (`viz/staging/<token>/<ime>`): dosegljiv vsakemu prijavljenemu
// uporabniku — tok je kratek (GC 24 h), token je 122-bitni naključni UUID.
import { NextResponse } from 'next/server'
import { vizOwner } from '@/lib/viz/ownership'
import { getProjectForOwner } from '@/lib/viz/repository'
import { assertSafeFileName, contentTypeForName, vizGet } from '@/lib/viz/storage'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const { key: segments } = await params
    const key = (segments ?? []).join('/')

    // ── Project datoteka: preveri lastništvo ────────────────────────────────
    if (key.startsWith('viz/projects/')) {
      const rest = key.slice('viz/projects/'.length)
      const slash = rest.indexOf('/')
      const id = slash > 0 ? rest.slice(0, slash) : ''
      const name = slash > 0 ? rest.slice(slash + 1) : ''
      if (!id || !name) {
        return NextResponse.json({ error: 'Neveljavna pot' }, { status: 400 })
      }
      assertSafeFileName(name)
      // Tuj/neobstoječ projekt → 404 (isti politiki kot preostale rute).
      const project = await getProjectForOwner(id, ctx)
      if (!project) {
        return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
      }
    } else if (!key.startsWith('viz/staging/')) {
      // Samo projekti in staging so dosegljivi; render-jobs metadata NE.
      return NextResponse.json({ error: 'Neveljavna pot' }, { status: 400 })
    }

    const data = await vizGet(key)
    if (!data) {
      return NextResponse.json({ error: 'Datoteka ne obstaja' }, { status: 404 })
    }
    const name = key.split('/').pop() ?? ''
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'content-type': contentTypeForName(name),
        'content-length': String(data.byteLength),
        'cache-control': key.startsWith('viz/projects/')
          ? 'private, max-age=300, must-revalidate'
          : 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Viz files GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju datoteke' }, { status: 500 })
  }
}
