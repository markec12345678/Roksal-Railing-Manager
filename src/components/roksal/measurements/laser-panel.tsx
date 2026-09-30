// R325 — dekompozicija measurements-tab FAZA 2: UI blok laserskega daljinca
// (MERITVE-PRO) kot samostojna komponenta. ČIST PREMIK JSX iz
// measurements-tab.tsx (vrstice 4975–5059) — bajtno identično; edine
// spremembe: props namesto closure spremenljivk (laserStatus → istimenski
// prop, connectLaser → onConnect, disconnectLaser → onDisconnect) +
// lasten uvoz ikon/komponent. Ikone ohranjajo aria-hidden="true"
// (r254 stražar — dekosijske ikone izven screen-reader drevesa).
// Brez 'use client' — del client drevesa (kanon R319/R321).

import { AlertCircle, Bluetooth, Loader2, Radio, Unplug } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface LaserPanelProps {
  laserSupported: boolean
  laserStatus: 'disconnected' | 'connecting' | 'connected'
  laserDeviceName: string | null
  laserLastReading: number | null
  onConnect: () => void
  onDisconnect: () => void
}

export function LaserPanel({
  laserSupported,
  laserStatus,
  laserDeviceName,
  laserLastReading,
  onConnect,
  onDisconnect,
}: LaserPanelProps) {
  return (
    <>
          {/* Laser povezava */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                  laserStatus === 'connected'
                    ? 'bg-roksal-green text-white'
                    : laserStatus === 'connecting'
                      ? 'bg-roksal-amber text-white'
                      : 'bg-roksal-navy/10 text-roksal-ink'
                }`}
              >
                {laserStatus === 'connecting' ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Bluetooth aria-hidden="true" className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-roksal-ink">Laserski daljinec</p>
                <p className="text-2xs text-muted-foreground truncate">
                  {laserStatus === 'connected'
                    ? `🟢 Laser povezan: ${laserDeviceName || 'naprava'}`
                    : laserStatus === 'connecting'
                      ? '🟡 Povezujem...'
                      : '🔴 Ni povezan'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {laserLastReading != null && laserStatus === 'connected' && (
                <Badge className="bg-roksal-green/15 text-roksal-green border border-roksal-green/30 text-2xs h-6 px-2">
                  <Radio aria-hidden="true" className="h-3 w-3 mr-1" />
                  {laserLastReading}mm
                </Badge>
              )}
              {laserStatus !== 'connected' ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={onConnect}
                      disabled={!laserSupported || laserStatus === 'connecting'}
                      className="h-8 px-3 text-[11px] bg-roksal-navy text-white hover:bg-roksal-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Bluetooth aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                      Poveži laser
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {laserSupported
                      ? 'Poveži laserski daljinec preko Web Bluetooth'
                      : 'Web Bluetooth ni podprt. Uporabite Chrome na Androidu ali računalniku.'}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDisconnect}
                  className="h-8 px-3 text-[11px] border-roksal-red/30 text-roksal-red hover:bg-roksal-red/10"
                >
                  <Unplug aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                  Prekini
                </Button>
              )}
            </div>
          </div>
          {!laserSupported && (
            <div className="rounded-md bg-roksal-amber/10 border border-roksal-amber/40 p-2 text-2xs text-roksal-ink flex items-start gap-1.5">
              <AlertCircle aria-hidden="true" className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                Web Bluetooth ni podprt v tem brskalniku. Uporabite Chrome na Androidu ali računalniku.
                Ročni vnos še vedno deluje.
              </span>
            </div>
          )}
          {laserStatus === 'connected' && (
            <div className="rounded-md bg-roksal-green/5 border border-roksal-green/20 p-2 text-2xs text-roksal-green/90 flex items-start gap-1.5">
              <Radio aria-hidden="true" className="h-3 w-3 mt-0.5 shrink-0 animate-pulse" />
              <span>
                Poslušam meritve... Pošlji mero z gumbom na daljincu — samodejno se izpolni dolžina v formi.
              </span>
            </div>
          )}
    </>
  )
}
