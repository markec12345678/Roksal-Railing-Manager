// R325 — dekompozicija measurements-tab FAZA 2: Web Bluetooth tipi +
// konstante + helper funkcije za laserski daljinec (MERITVE-PRO blok,
// lastniška prioriteta #1 "laserski BT blok").
// ČIST PREMIK iz measurements-tab.tsx (vrstice 283–323 + 704–763) —
// bajtno identično; edina sprememba: `export` predpona (kanon R319/R321
// dekompozicija faza 1). Brez 'use client' — modul je del client drevesa
// (uvožen iz measurements-tab.tsx, ki ima 'use client').

// ============================================
// MERITVE-PRO — Web Bluetooth tipi (laserski daljinec)
// ============================================
export interface BluetoothCharacteristicLike {
  startNotifications: () => Promise<unknown>
  stopNotifications: () => Promise<unknown>
  uuid: string
  value?: DataView
  addEventListener: (type: string, listener: (event: unknown) => void) => void
  removeEventListener: (type: string, listener: (event: unknown) => void) => void
}
export interface BluetoothServiceLike {
  getCharacteristics: () => Promise<BluetoothCharacteristicLike[]>
}
export interface BluetoothDeviceLike {
  name?: string
  id?: string
  gatt?: {
    connected?: boolean
    connect: () => Promise<unknown>
    disconnect: () => void
    getPrimaryService: (uuid: string) => Promise<BluetoothServiceLike>
  }
  addEventListener: (type: string, listener: (event: unknown) => void) => void
  removeEventListener: (type: string, listener: (event: unknown) => void) => void
  watchAdvertisements?: () => Promise<void>
}
export interface BluetoothLike {
  requestDevice: (options: unknown) => Promise<BluetoothDeviceLike>
  getAvailability?: () => Promise<boolean>
}
export interface NavigatorWithBluetooth extends Navigator {
  bluetooth?: BluetoothLike
}

// Leica DISTO service UUID (custom service)
export const LASER_SERVICE_LEICA = '0000feff-0000-1000-8000-00805f9b34fb'
// Bosch GLM service UUID
export const LASER_SERVICE_BOSCH = '0000feaa-0000-1000-8000-00805f9b34fb'
// Laserski proizvajalci — ime prefixi
export const LASER_NAME_PREFIXES = ['GLM', 'DISTO', 'Leica', 'Bosch', 'BOSCH', 'LEICA']

// ============================================
// MERITVE-PRO — Web Bluetooth helper funkcije
// ============================================

// Zadnji povezani laserski daljinec (ime) — beremo iz localStorage
export function loadLastLaserName(): string | null {
  try {
    return localStorage.getItem('roksal_last_laser')
  } catch {
    return null
  }
}

// Preveri ali brskalnik podpira Web Bluetooth
export function isBluetoothSupported(): boolean {
  if (typeof navigator === 'undefined') return false
  return !!(navigator as NavigatorWithBluetooth).bluetooth
}

// Razčleni razdaljo iz DataView (različni proizvajalci pošiljajo različno)
export function parseDistanceFromDataView(dv: DataView): number | null {
  // 1. Poskusi uint32 little-endian kot mm (običajni format za daljince)
  if (dv.byteLength >= 4) {
    try {
      const val = dv.getUint32(0, true) // little-endian
      if (val > 0 && val < 1_000_000) return val // 0-1000m razpon
    } catch {
      // ignore
    }
  }
  // 2. Poskusi uint16 little-endian (starejši daljinci)
  if (dv.byteLength >= 2) {
    try {
      const val = dv.getUint16(0, true)
      if (val > 0 && val < 65_535) return val
    } catch {
      // ignore
    }
  }
  // 3. Poskusi tekstovno razčlenitev (ASCII / UTF-8)
  try {
    const text = new TextDecoder('utf-8').decode(dv).trim()
    // Poišči prvo število (z možno decimalno vejico/piko)
    const match = text.match(/(-?\d+(?:[.,]\d+)?)/)
    if (match) {
      const numStr = match[1].replace(',', '.')
      const num = parseFloat(numStr)
      if (Number.isFinite(num) && num > 0 && num < 1_000_000) {
        // Če vsebuje decimalo, predvidevamo metre → mm
        if (match[1].includes('.') || match[1].includes(',')) {
          return Math.round(num * 1000)
        }
        return Math.round(num)
      }
    }
  } catch {
    // ignore
  }
  return null
}
