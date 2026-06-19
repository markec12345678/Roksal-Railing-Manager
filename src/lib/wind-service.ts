/**
 * OpenWeather API integracija za real-time vetrne podatke
 */

export interface WindData {
  speed: number
  gust: number
  direction: number
  directionLabel: string
  temperature: number
  humidity: number
  pressure: number
  description: string
  icon: string
  location: string
  timestamp: Date
  isSafeForInstallation: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'dangerous'
  maxRailingHeight: number
}

const WIND_DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

function getWindDirectionLabel(degrees: number): string {
  const index = Math.round(degrees / 22.5) % 16
  return WIND_DIRECTIONS[index]
}

function assessWindRisk(speed: number, gust: number) {
  const effectiveSpeed = Math.max(speed, gust)

  if (effectiveSpeed <= 8) {
    return { isSafe: true, riskLevel: 'low' as const, maxRailingHeight: 1800 }
  } else if (effectiveSpeed <= 14) {
    return { isSafe: true, riskLevel: 'medium' as const, maxRailingHeight: 1000 }
  } else if (effectiveSpeed <= 20) {
    return { isSafe: false, riskLevel: 'high' as const, maxRailingHeight: 600 }
  } else {
    return { isSafe: false, riskLevel: 'dangerous' as const, maxRailingHeight: 0 }
  }
}

export async function getWindData(lat: number, lon: number, apiKey?: string): Promise<WindData> {
  if (!apiKey) {
    return getDemoWindData(lat, lon)
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=sl&appid=${apiKey}`
    )

    if (!response.ok) {
      throw new Error(`OpenWeather API error: ${response.status}`)
    }

    const data = await response.json()
    const windSpeed = data.wind.speed
    const windGust = data.wind.gust || windSpeed * 1.3
    const risk = assessWindRisk(windSpeed, windGust)

    return {
      speed: windSpeed,
      gust: windGust,
      direction: data.wind.deg,
      directionLabel: getWindDirectionLabel(data.wind.deg),
      temperature: Math.round(data.main.temp),
      humidity: data.main.humidity,
      pressure: Math.round(data.main.pressure),
      description: data.weather[0]?.description || 'Ni podatkov',
      icon: data.weather[0]?.icon || '01d',
      location: data.name || 'Neznana lokacija',
      timestamp: new Date(),
      isSafeForInstallation: risk.isSafe,
      riskLevel: risk.riskLevel,
      maxRailingHeight: risk.maxRailingHeight,
    }
  } catch (error) {
    console.error('Wind data fetch failed:', error)
    return getDemoWindData(lat, lon)
  }
}

function getDemoWindData(lat: number, lon: number): WindData {
  const demoSpeed = 6.5 + Math.random() * 4
  const demoGust = demoSpeed * (1.2 + Math.random() * 0.3)
  const risk = assessWindRisk(demoSpeed, demoGust)

  return {
    speed: Math.round(demoSpeed * 10) / 10,
    gust: Math.round(demoGust * 10) / 10,
    direction: Math.round(Math.random() * 360),
    directionLabel: getWindDirectionLabel(Math.random() * 360),
    temperature: Math.round(15 + Math.random() * 15),
    humidity: Math.round(50 + Math.random() * 30),
    pressure: Math.round(1010 + Math.random() * 20),
    description: 'Deloma oblačno',
    icon: '02d',
    location: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
    timestamp: new Date(),
    isSafeForInstallation: risk.isSafe,
    riskLevel: risk.riskLevel,
    maxRailingHeight: risk.maxRailingHeight,
  }
}

export function calculateWindPressure(speedMs: number): number {
  const airDensity = 1.25
  return 0.5 * airDensity * speedMs * speedMs
}

export function calculateWindForceOnRailing(
  speedMs: number,
  railingWidthM: number,
  railingHeightM: number,
  isVertical: boolean = true
): number {
  const pressure = calculateWindPressure(speedMs)
  const forceCoefficient = isVertical ? 1.6 : 1.2
  const area = railingWidthM * railingHeightM
  return pressure * forceCoefficient * area
}
