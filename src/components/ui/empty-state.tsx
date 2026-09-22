'use client'

// Roksal — prazno stanje (empty state)
// ---------------------------------------------------------------------------
// Enotna kartica za prazne sezname (ni meritev / slik / dokumentov …).
// Oblika: črtkani rob, mehak krog z ikono, jasen poziv k dejanju.
// Tone 'amber' je namenjen mestom, kjer je akcija primarna (npr. dodajanje).

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Lucide ikona (ne element!) — npr. `icon={Ruler}`. */
  icon: React.ElementType
  title: string
  description?: string
  /** Opcijski poziv k dejanju (gumb, min. 44px dotik). */
  action?: { label: string; onClick: () => void }
  tone?: 'default' | 'amber'
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, tone = 'default', className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-white/60 px-4 py-8 text-center dark:bg-white/5',
        className
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
          tone === 'amber' ? 'bg-roksal-amber/10 text-roksal-amber' : 'bg-roksal-navy/5 text-roksal-navy'
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-roksal-navy">{title}</p>
        {description && (
          <p className="mx-auto max-w-[260px] text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Button size="sm" className="min-h-11 px-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
