import { NextResponse } from 'next/server'
import { getWindData, calculateWindPressure, calculateWindForceOnRailing } from '@/lib/wind-service'
import { authenticate, unauthorized } from '@/lib/auth'

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') || '46.2397')
  const lon = parseFloat(searchParams.get('lon') || '14.3556')
  const apiKey = process.env.OPENWEATHER_API_KEY
  const railingWidth = parseFloat(searchParams.get('width') || '2')
  const railingHeight = parseFloat(searchParams.get('height') || '1')

  try {
    const windData = await getWindData(lat, lon, apiKey)
    const windPressure = calculateWindPressure(windData.speed)
    const windForce = calculateWindForceOnRailing(
      windData.speed, railingWidth, railingHeight
    )

    return NextResponse.json({
      ...windData,
      timestamp: windData.timestamp.toISOString(),
      calculations: {
        windPressure: Math.round(windPressure * 10) / 10,
        windForce: Math.round(windForce * 10) / 10,
        railingArea: railingWidth * railingHeight,
        railingWidth,
        railingHeight,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Napaka pri pridobivanju vetrnih podatkov', details: String(error) },
      { status: 500 }
    )
  }
}
