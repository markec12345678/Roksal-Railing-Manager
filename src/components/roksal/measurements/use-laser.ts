// R325 — dekompozicija measurements-tab FAZA 2: laserski BT blok kot custom
// hook (lastniška prioriteta #1). Stanje + GATT povezava + odklop + auto-
// reconnect so VERBATIM iz measurements-tab.tsx (vrstice 982–991, 1310–1347,
// 3803–4000). EDINA semantična sprememba: polnjenje forme
// (setFormLength/setFormLengthUnit/setFormTipMeritve/setFormOpen) poteka
// prek onMeasurement povratnega klica — hook je decoupled od forme
// (kanon: refaktor, ne čist premik — interno sestavljena struktura).
// Brez 'use client' — del client drevesa (kanon R319/R321).

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  isBluetoothSupported,
  LASER_SERVICE_BOSCH,
  LASER_SERVICE_LEICA,
  LASER_NAME_PREFIXES,
  loadLastLaserName,
  parseDistanceFromDataView,
  type BluetoothCharacteristicLike,
  type BluetoothDeviceLike,
  type BluetoothServiceLike,
  type NavigatorWithBluetooth,
} from './laser-bt'

/**
 * useLaserDistance — Web Bluetooth laserski daljinec (Leica DISTO / Bosch GLM).
 *
 * @param onMeasurement povratni klic ob prejeti meri (mm) — kliče TOČNO tam,
 *   kjer je prej stal blok setFormLength/setFormLengthUnit/setFormTipMeritve/
 *   setFormOpen (isti vrstni red: najprej setLaserLastReading, nato klic,
 *   nato toast).
 */
export function useLaserDistance(onMeasurement: (mm: number) => void) {
  // 1. Web Bluetooth laser
  const [laserSupported, setLaserSupported] = useState(false)
  const [laserStatus, setLaserStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [laserDeviceName, setLaserDeviceName] = useState<string | null>(null)
  const [laserLastReading, setLaserLastReading] = useState<number | null>(null)
  const laserDeviceRef = useRef<BluetoothDeviceLike | null>(null)
  const laserCharacteristicRef = useRef<BluetoothCharacteristicLike | null>(null)
  const laserReconnectAttemptsRef = useRef(0)
  const laserReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const laserMeasurementHandlerRef = useRef<((event: unknown) => void) | null>(null)
  const laserDisconnectHandlerRef = useRef<((event: unknown) => void) | null>(null)

  // MERITVE-PRO — zaznaj podporo Web Bluetooth API (zunanje stanje → React;
  // začetno stanje preberemo v mikrotasku — omejitev pravila
  // react-hooks/set-state-in-effect po vzorcu PwaStatus; pravilo je bilo
  // prej skrito z bailoutom compiler analize na 7,6k vrstični datoteki,
  // izluščen hook pa je majhen in se analizira do konca).
  useEffect(() => {
    queueMicrotask(() => {
      setLaserSupported(isBluetoothSupported())
    })
  }, [])

  // MERITVE-PRO — naloži zadnje povezani lasersko ime (prikaz v badge-u)
  // (mikrotask — vzorec PwaStatus, glej zgoraj)
  useEffect(() => {
    queueMicrotask(() => {
      if (!laserDeviceName) {
        const last = loadLastLaserName()
        if (last) setLaserDeviceName(last)
      }
    })
  }, [laserDeviceName])

  // MERITVE-PRO — počisti laser povezavo ob unmountu
  useEffect(() => {
    return () => {
      try {
        if (laserReconnectTimerRef.current) {
          clearTimeout(laserReconnectTimerRef.current)
          laserReconnectTimerRef.current = null
        }
        const ch = laserCharacteristicRef.current
        const dev = laserDeviceRef.current
        const handler = laserMeasurementHandlerRef.current
        const dHandler = laserDisconnectHandlerRef.current
        if (ch && handler) {
          try { ch.removeEventListener('characteristicvaluechanged', handler) } catch { /* ignore */ }
          try { ch.stopNotifications() } catch { /* ignore */ }
        }
        if (dev && dHandler) {
          try { dev.removeEventListener('gattserverdisconnected', dHandler) } catch { /* ignore */ }
        }
        try { dev?.gatt?.disconnect() } catch { /* ignore */ }
      } catch {
        // ignore
      }
    }
  }, [])

  // Obdelaj prejeto mero iz laserja
  const handleLaserMeasurement = useCallback((event: unknown) => {
    try {
      const e = event as { target?: { value?: DataView } }
      const dv = e.target?.value
      if (!dv) return
      const mm = parseDistanceFromDataView(dv)
      if (mm == null) return
      setLaserLastReading(mm)
      // R325: auto-izpolni dolžino v formi (v mm enoti) — prek povratnega
      // klica (prej: neposredni setState v measurements-tab formi).
      onMeasurement(mm)
      toast.success(`Mera iz laserja: ${mm}mm`)
    } catch {
      // ignore
    }
  }, [onMeasurement])

  // Poveži se z laserskim daljincem preko Web Bluetooth
  async function connectLaser() {
    const nav = navigator as NavigatorWithBluetooth
    if (!nav.bluetooth) {
      toast.error('Bluetooth ni podprt v tem brskalniku', {
        description: 'Uporabite Chrome na Androidu ali računalniku.',
      })
      return
    }
    setLaserStatus('connecting')
    try {
      const filters = [
        // Leica DISTO
        { services: [LASER_SERVICE_LEICA] },
        // Bosch GLM
        { services: [LASER_SERVICE_BOSCH] },
        // Generični filter po imenu
        ...LASER_NAME_PREFIXES.map((prefix) => ({ namePrefix: prefix })),
      ]
      const device = await nav.bluetooth.requestDevice({
        filters,
        optionalServices: [LASER_SERVICE_LEICA, LASER_SERVICE_BOSCH],
      })
      laserDeviceRef.current = device
      const name = device.name || 'Laserski daljinec'
      setLaserDeviceName(name)
      try {
        localStorage.setItem('roksal_last_laser', name)
      } catch {
        // ignore
      }

      // Odpri GATT povezavo
      if (!device.gatt) {
        toast.error('Naprava ne podpira GATT strežnika')
        setLaserStatus('disconnected')
        return
      }
      await device.gatt.connect()

      // Poskusi najti znano storitev (Leica → Bosch → katerakoli)
      let service: BluetoothServiceLike | null = null
      let usedServiceUuid: string | null = null
      for (const uuid of [LASER_SERVICE_LEICA, LASER_SERVICE_BOSCH]) {
        try {
          service = await device.gatt.getPrimaryService(uuid)
          usedServiceUuid = uuid
          break
        } catch {
          // ignore — poskusi naslednjo
        }
      }
      if (!service) {
        toast.error('Storitev laserja ni najdena na napravi', {
          description: `${name} — preverite skladnost z Leica DISTO / Bosch GLM.`,
        })
        setLaserStatus('disconnected')
        try { device.gatt.disconnect() } catch { /* ignore */ }
        return
      }

      const characteristics = await service.getCharacteristics()
      if (!characteristics || characteristics.length === 0) {
        toast.error('Karakteristika laserja ni najdena')
        setLaserStatus('disconnected')
        try { device.gatt.disconnect() } catch { /* ignore */ }
        return
      }

      // Prijavi se na obvestila prve karakteristike (običajno je to meritvena)
      const ch = characteristics[0]
      laserCharacteristicRef.current = ch
      // Odstrani stare handlerje če obstajajo
      const oldHandler = laserMeasurementHandlerRef.current
      const oldDisconnect = laserDisconnectHandlerRef.current
      if (oldHandler) {
        try { ch.removeEventListener('characteristicvaluechanged', oldHandler) } catch { /* ignore */ }
      }
      if (oldDisconnect && laserDeviceRef.current) {
        try { laserDeviceRef.current.removeEventListener('gattserverdisconnected', oldDisconnect) } catch { /* ignore */ }
      }
      // Dodaj nove handler
      ch.addEventListener('characteristicvaluechanged', handleLaserMeasurement)
      laserMeasurementHandlerRef.current = handleLaserMeasurement

      const disconnectHandler = () => {
        toast.info(`Laser ${name} je bil odklopljen`, {
          description: 'Poskušam ponovno povezati...',
        })
        setLaserStatus('disconnected')
        // Auto-reconnect (3 poskusi)
        laserReconnectAttemptsRef.current += 1
        if (laserReconnectAttemptsRef.current <= 3) {
          if (laserReconnectTimerRef.current) clearTimeout(laserReconnectTimerRef.current)
          laserReconnectTimerRef.current = setTimeout(() => {
            // Poskusi ponovno povezati brez requestDevice (samo gatt.connect)
            void (async () => {
              try {
                const dev = laserDeviceRef.current
                if (!dev?.gatt) return
                await dev.gatt.connect()
                const svc = await dev.gatt.getPrimaryService(usedServiceUuid || LASER_SERVICE_LEICA)
                const chars = await svc.getCharacteristics()
                if (chars.length > 0) {
                  const newCh = chars[0]
                  laserCharacteristicRef.current = newCh
                  newCh.addEventListener('characteristicvaluechanged', handleLaserMeasurement)
                  await newCh.startNotifications()
                  setLaserStatus('connected')
                  laserReconnectAttemptsRef.current = 0
                  toast.success(`Ponovno povezan: ${name}`)
                }
              } catch {
                toast.error(`Ponovna povezava ni uspela (poskus ${laserReconnectAttemptsRef.current}/3)`)
              }
            })()
          }, 1500)
        } else {
          toast.error('Ponovna povezava po 3 poskusih ni uspela')
          laserReconnectAttemptsRef.current = 0
        }
      }
      device.addEventListener('gattserverdisconnected', disconnectHandler)
      laserDisconnectHandlerRef.current = disconnectHandler

      try {
        await ch.startNotifications()
      } catch {
        // nekatere karakteristike morda ne podpirajo notifikacij — ignoriiramo
      }
      setLaserStatus('connected')
      laserReconnectAttemptsRef.current = 0
      toast.success(`Laser povezan: ${name}`, {
        description: 'Pošljite mero z gumbom na daljincu.',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/User cancelled|User Cancel|cancelled/i.test(msg)) {
        toast.info('Dostop zavrnjen — povezava preklicana')
      } else if (/No devices found|no device/i.test(msg)) {
        toast.error('Nobena naprava ni bila najdena')
      } else {
        toast.error('Napaka pri povezovanju laserja', { description: msg })
      }
      setLaserStatus('disconnected')
    }
  }

  // Prekini povezavo z laserjem
  function disconnectLaser() {
    try {
      const ch = laserCharacteristicRef.current
      const dev = laserDeviceRef.current
      const handler = laserMeasurementHandlerRef.current
      const dHandler = laserDisconnectHandlerRef.current
      if (ch && handler) {
        try { ch.removeEventListener('characteristicvaluechanged', handler) } catch { /* ignore */ }
        try { ch.stopNotifications() } catch { /* ignore */ }
      }
      if (dev && dHandler) {
        try { dev.removeEventListener('gattserverdisconnected', dHandler) } catch { /* ignore */ }
      }
      try { dev?.gatt?.disconnect() } catch { /* ignore */ }
      laserCharacteristicRef.current = null
      laserDeviceRef.current = null
      laserMeasurementHandlerRef.current = null
      laserDisconnectHandlerRef.current = null
      if (laserReconnectTimerRef.current) {
        clearTimeout(laserReconnectTimerRef.current)
        laserReconnectTimerRef.current = null
      }
      laserReconnectAttemptsRef.current = 0
      setLaserStatus('disconnected')
      setLaserLastReading(null)
      toast.info('Povezava z laserjem prekinjena')
    } catch {
      toast.error('Napaka pri prekinjanju povezave')
    }
  }

  return {
    laserSupported,
    laserStatus,
    laserDeviceName,
    laserLastReading,
    connectLaser,
    disconnectLaser,
  }
}
