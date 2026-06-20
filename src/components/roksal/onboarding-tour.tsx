'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  X, ChevronRight, ChevronLeft, Home, Camera, Sparkles,
  Pen, ShieldCheck, CheckCircle2, Zap, RotateCcw,
} from 'lucide-react'

interface OnboardingStep {
  id: string
  naslov: string
  opis: string
  ikona: React.ElementType
  barva: string
  akcija?: { label: string; tab: string }
}

const KORAKI: OnboardingStep[] = [
  {
    id: 'dobrodosli',
    naslov: 'Dobrodošli v Roksal!',
    opis: 'Profesionalno orodje za monterje balkonskih ograj. Od slike do montirane ograje v 6 korakih.',
    ikona: Zap,
    barva: 'bg-roksal-amber',
  },
  {
    id: 'slikaj',
    naslov: '1. Slikaj balkon',
    opis: 'Odpri AR kamera ali Slike zavihek. Poslikaj balkon z vseh strani. Dodaj opombo in GPS lokacijo.',
    ikona: Camera,
    barva: 'bg-blue-500',
    akcija: { label: 'Odpri AR kamero', tab: 'ar' },
  },
  {
    id: 'ai',
    naslov: '2. AI Material Takeoff',
    opis: 'V Več meni → AI Takeoff. Naloži sliko, AI zazna ograjo, izračuna material in ceno v 5 sekundah.',
    ikona: Sparkles,
    barva: 'bg-purple-500',
    akcija: { label: 'Odpri AI Takeoff', tab: 'ai' },
  },
  {
    id: 'meritve',
    naslov: '3. Izmeri z laserjem',
    opis: 'V Meritve zavihek. Poveži Bluetooth laser (Leica/Bosch) ali uporabi foto merne črte. ±1-2mm natančnost.',
    ikona: ShieldCheck,
    barva: 'bg-green-500',
    akcija: { label: 'Odpri Meritve', tab: 'measurements' },
  },
  {
    id: 'podpis',
    naslov: '4. Podpiši ponudbo',
    opis: 'Več → Ponudba s podpisom. Stranka in monter podpišeta s prstom. PDF je pravno veljaven dokument.',
    ikona: Pen,
    barva: 'bg-roksal-navy',
    akcija: { label: 'Odpri Podpis', tab: 'signature' },
  },
  {
    id: 'deal',
    naslov: '5. Deal se samodejno zaklene',
    opis: 'Po podpisu se deal zaklene (V4.1): status → ZA_MONTAZO, BOM draft generiran, marža zaklenjena. Vse avtomatsko!',
    ikona: CheckCircle2,
    barva: 'bg-green-600',
  },
  {
    id: 'logistika',
    naslov: '6. Načrtuj montažo',
    opis: 'Več → Logistika V6. Dodeli ekipo, nastavi termin, dodaj opremo. Ob zaključku montaže se material samodejno odšteje iz zaloge.',
    ikona: Home,
    barva: 'bg-amber-600',
    akcija: { label: 'Odpri Logistiko', tab: 'logistics' },
  },
  {
    id: 'konec',
    naslov: 'Pripravljen!',
    opis: 'Celoviti delovni tok: Slika → AI → Mere → Ponudba → Podpis → Deal Lock → Material → Logistika → Montaža. Za pomoč klikni ? v zgornji vrstici.',
    ikona: CheckCircle2,
    barva: 'bg-roksal-amber',
  },
]

const STORAGE_KEY = 'roksal_onboarding_done'

export function OnboardingTour({ onClose, onNavigate }: { onClose: () => void; onNavigate: (tab: string) => void }) {
  const [korak, setKorak] = useState(0)
  const current = KORAKI[korak]
  const Icon = current.ikona

  const handleNext = useCallback(() => {
    if (korak < KORAKI.length - 1) {
      setKorak(korak + 1)
    } else {
      localStorage.setItem(STORAGE_KEY, 'true')
      onClose()
    }
  }, [korak, onClose])

  const handlePrev = useCallback(() => {
    if (korak > 0) setKorak(korak - 1)
  }, [korak])

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    onClose()
  }, [onClose])

  const handleAction = useCallback(() => {
    if (current.akcija) {
      localStorage.setItem(STORAGE_KEY, 'true')
      onNavigate(current.akcija.tab)
      onClose()
    }
  }, [current, onNavigate, onClose])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'ArrowLeft') handlePrev()
      else if (e.key === 'Escape') handleSkip()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNext, handlePrev, handleSkip])

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-md border-roksal-amber/30 shadow-2xl">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] bg-roksal-amber/10 text-roksal-amber">
                {korak + 1} / {KORAKI.length}
              </Badge>
              <span className="text-[10px] text-muted-foreground">Onboarding</span>
            </div>
            <button type="button" onClick={handleSkip} className="text-muted-foreground hover:text-foreground p-1">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-roksal-amber transition-all duration-300"
              style={{ width: `${((korak + 1) / KORAKI.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-6 text-center">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${current.barva} mb-4`}>
              <Icon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-lg font-bold text-roksal-navy mb-2">{current.naslov}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.opis}</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30">
            <Button type="button" variant="ghost" size="sm" onClick={handlePrev} disabled={korak === 0} className="text-[11px]">
              <ChevronLeft className="h-4 w-4 mr-1" /> Nazaj
            </Button>

            {/* Dots */}
            <div className="flex items-center gap-1">
              {KORAKI.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setKorak(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === korak ? 'w-4 bg-roksal-amber' : 'w-1.5 bg-muted-foreground/40'
                  }`}
                  aria-label={`Korak ${i + 1}`}
                />
              ))}
            </div>

            {current.akcija ? (
              <Button type="button" size="sm" onClick={handleAction} className="text-[11px] bg-roksal-amber text-white">
                {current.akcija.label} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={handleNext} className="text-[11px] bg-roksal-navy text-white">
                {korak === KORAKI.length - 1 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Zaključi
                  </>
                ) : (
                  <>
                    Naprej <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Wrapper — preveri ali je onboarding že opravljen
export function OnboardingWrapper({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      // Pokaži po 1s delay da se aplikacija naloži
      const timer = setTimeout(() => setShow(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  // Reset onboarding (za testiranje)
  const handleReset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setShow(true)
  }, [])

  if (!show) {
    // Gumb za ponovni prikaz onboardinga (majhen, v kotu)
    return (
      <button
        type="button"
        onClick={handleReset}
        className="fixed bottom-20 right-2 z-40 rounded-full bg-roksal-navy/80 p-2 text-white shadow-lg hover:bg-roksal-navy transition-colors"
        aria-label="Ponovi onboarding"
        title="Ponovi vodič"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    )
  }

  return <OnboardingTour onClose={() => setShow(false)} onNavigate={onNavigate} />
}
