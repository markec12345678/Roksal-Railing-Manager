'use client'

/**
 * Kontekstualni FAB (Floating Action Button) — en dotik do najpogostejših
 * akcij monterja: AR meritev, slika, nova meritev, skica, kalkulator.
 *
 * • Leži nad BottomNav (desno), ne krije vsebine (pointer-events samo gumb)
 * • Animirano odpiranje (framer-motion, stagger) + backdrop za zunanji klik
 * • Navigacija prek 'roksal:navigate' dogodka (page.tsx posluša)
 * • Skrij se ob odprti ukazni paleti ni treba (z-40 < dialog z-50)
 */

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, ScanLine, ImagePlus, Ruler, PenLine, Calculator, X } from 'lucide-react'

interface FabAction {
  id: string
  label: string
  icon: React.ElementType
  tab: string
  more?: string
}

const ACTIONS: FabAction[] = [
  { id: 'ar', label: 'AR meritev', icon: ScanLine, tab: 'ar' },
  { id: 'photo', label: 'Nova slika', icon: ImagePlus, tab: 'photos' },
  { id: 'measure', label: 'Nova meritev', icon: Ruler, tab: 'measurements' },
  { id: 'sketch', label: 'Skica', icon: PenLine, tab: 'more', more: 'sketches' },
  { id: 'calc', label: 'Kalkulator', icon: Calculator, tab: 'calculator' },
]

export function QuickActionsFab() {
  const [open, setOpen] = useState(false)

  // R160 (stil/a11y pass): FAB meni se zapre tudi z Escape (tipkovnica —
  // doslej je bila zapiranja zavedna samo miška/dotik).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function run(action: FabAction) {
    setOpen(false)
    try { navigator.vibrate?.(20) } catch { /* ignore */ }
    window.dispatchEvent(
      new CustomEvent('roksal:navigate', { detail: { tab: action.tab, more: action.more ?? null } })
    )
  }

  return (
    <>
      {/* Backdrop — zapre meni ob kliku zunaj */}
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Zapri hitre akcije"
            className="fixed inset-0 z-[45] bg-roksal-navy/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-[76px] right-4 z-[46] flex flex-col items-end gap-2.5 md:bottom-[84px] md:right-6">
        {/* Akcije — rastejo navzgor */}
        <AnimatePresence>
          {open && (
            <>
              {ACTIONS.map((action, i) => {
                const Icon = action.icon
                return (
                  <motion.button
                    key={action.id}
                    type="button"
                    onClick={() => run(action)}
                    initial={{ opacity: 0, y: 16, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.85 }}
                    transition={{ duration: 0.18, delay: i * 0.035, ease: 'easeOut' }}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-full border border-roksal-navy/10 bg-white py-2 pl-4 pr-3 shadow-lg transition-colors hover:border-roksal-amber/50 hover:bg-roksal-amber/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                  >
                    <span className="text-[13px] font-semibold text-roksal-navy">{action.label}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-roksal-navy/5">
                      <Icon className="h-4 w-4 text-roksal-amber" aria-hidden="true" />
                    </span>
                  </motion.button>
                )
              })}
            </>
          )}
        </AnimatePresence>

        {/* Glavni gumb */}
        <motion.button
          type="button"
          onClick={() => { setOpen((v) => !v); try { navigator.vibrate?.(15) } catch { /* ignore */ } }}
          whileTap={{ scale: 0.9 }}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/50 focus-visible:ring-offset-2 ${
            open ? 'bg-roksal-navy text-white' : 'bg-roksal-amber text-white'
          }`}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={open ? 'Zapri hitre akcije' : 'Hitre akcije'}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-7 w-7" aria-hidden="true" />}
        </motion.button>
      </div>
    </>
  )
}
