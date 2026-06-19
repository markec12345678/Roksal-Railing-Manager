'use client'

/**
 * Roksal AR Scanner Launcher
 * -----------------------------------------------------------------------------
 * Simple wrapper component that:
 *   - Shows a big "Odpri AR kamero" button when closed
 *   - Prompts the user to select a project first if `projectId` is null
 *   - Mounts the full-screen `ArScanner` when open (fixed inset-0 z-50)
 *
 * Props:
 *   - projectId: string | null   (null → show "select project" prompt)
 */

import * as React from 'react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, AlertCircle, FolderOpen } from 'lucide-react'
import { ArScanner } from './ar-scanner'

interface ArScannerLauncherProps {
  projectId: string | null
}

export function ArScannerLauncher({ projectId }: ArScannerLauncherProps) {
  const [open, setOpen] = useState(false)

  const handleClick = useCallback(() => {
    if (!projectId) return
    setOpen(true)
  }, [projectId])

  if (open && projectId) {
    return <ArScanner projectId={projectId} onClose={() => setOpen(false)} />
  }

  return (
    <div className="w-full">
      {projectId ? (
        <Button
          type="button"
          onClick={handleClick}
          className="w-full bg-roksal-navy hover:bg-roksal-navy/90 text-white h-12 text-base gap-2 btn-shine"
        >
          <Camera className="h-5 w-5" />
          Odpri AR kamero
        </Button>
      ) : (
        <div className="w-full rounded-lg border border-dashed border-roksal-amber/40 bg-roksal-amber/5 p-4 flex flex-col items-center text-center gap-2">
          <AlertCircle className="h-6 w-6 text-roksal-amber" />
          <p className="text-sm font-medium text-roksal-navy">
            Najprej izberite projekt
          </p>
          <p className="text-xs text-muted-foreground">
            AR kamera je na voljo samo znotraj izbranega projekta.
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" />
            Izberite projekt na nadzorni plošči.
          </div>
        </div>
      )}
    </div>
  )
}
