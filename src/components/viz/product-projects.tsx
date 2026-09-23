'use client'

/**
 * S+5 — MOJI PROJEKTI (minimalna stran, spec §16).
 * Seznam: [sličica] ime + datum; akcije: odpri (nadaljuj), podvoji, izbriši.
 * Brez CMS-a — kartica + dve diskretni akciji ob odpiranju.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { Copy, Loader2, Trash2, Wand2 } from 'lucide-react'
import type { VizProjectSummary } from '@/lib/viz/types'
import { deleteProject, duplicateProject, listProjects } from './api'
import { useVizStore } from './viz-store'

function slDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
}

export function ProductProjects() {
  const setStep = useVizStore((s) => s.setStep)
  const resetAll = useVizStore((s) => s.resetAll)
  const reloadKey = useVizStore((s) => s.projectsReloadKey)
  const [projects, setProjects] = useState<VizProjectSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null) // dupliciranje v teku
  const [armedDelete, setArmedDelete] = useState<string | null>(null)
  const armedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setProjects(await listProjects())
    } catch {
      // §22: prijazno sporočilo namesto tehnike
      setProjects([])
      toast({
        title: 'Projektov trenutno ni mogoče prikazati',
        description: 'Preverite povezavo in poskusite ponovno.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => {
      if (armedTimer.current) clearTimeout(armedTimer.current)
    }
  }, [refresh, reloadKey])

  return (
    <ProjectList
      projects={projects}
      loading={loading}
      busyId={busyId}
      armedDelete={armedDelete}
      onRefresh={() => void refresh()}
      onOpen={(id) => {
        // navigacija na čarovnik poteka prek skupnega odpiralnika v viz-tab
        window.dispatchEvent(new CustomEvent('roksal:viz-open-project', { detail: id }))
      }}
      onDuplicate={(id) => {
        setBusyId(id)
        duplicateProject(id)
          .then((res) => {
            toast({ title: 'Projekt podvojen ✓', description: res.project.name })
            void refresh()
          })
          .catch(() => {
            toast({
              title: 'Podvajanje ni uspelo',
              description: 'Projekta trenutno ni mogoče podvojiti. Poskusite ponovno.',
              variant: 'destructive',
            })
          })
          .finally(() => setBusyId(null))
      }}
      onDelete={(id) => {
        if (armedDelete !== id) {
          setArmedDelete(id)
          if (armedTimer.current) clearTimeout(armedTimer.current)
          armedTimer.current = setTimeout(() => setArmedDelete((cur) => (cur === id ? null : cur)), 3000)
          return
        }
        setArmedDelete(null)
        deleteProject(id)
          .then(() => {
            toast({ title: 'Projekt izbrisan' })
            void refresh()
          })
          .catch(() => {
            toast({
              title: 'Brisanje ni uspelo',
              description: 'Projekta trenutno ni mogoče izbrisati. Poskusite ponovno.',
              variant: 'destructive',
            })
          })
      }}
      onNew={() => {
        resetAll()
        setStep(1)
      }}
    />
  )
}

export interface ProjectListProps {
  projects: VizProjectSummary[] | null
  loading: boolean
  busyId: string | null
  armedDelete: string | null
  onRefresh: () => void
  onOpen: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
}

/** Izvlečen izris seznama (t teste prijazna komponenta). */
export function ProjectList({
  projects,
  loading,
  busyId,
  armedDelete,
  onOpen,
  onDuplicate,
  onDelete,
  onNew,
}: ProjectListProps) {
  if (loading && projects === null) {
    return (
      <div className="space-y-2 p-4" aria-busy="true">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-4/5 rounded-xl" />
      </div>
    )
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 pt-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-roksal-navy/5" aria-hidden="true">
          <Wand2 className="h-6 w-6 text-roksal-navy/40" />
        </div>
        <div>
          <p className="text-sm font-semibold text-roksal-navy">Ni še shranjenih projektov</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ustvari prvo vizualizacijo — traja manj kot dve minuti.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 bg-roksal-amber px-6 font-bold text-white hover:bg-roksal-amber/90"
          onClick={onNew}
        >
          Začni z vizualizacijo
        </Button>
      </div>
    )
  }

  return (
    <ul className="space-y-2.5 p-4" aria-label="Seznam projektov">
      {projects.map((p) => (
        <li key={p.id}>
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-3">
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                aria-label={`Odpri projekt ${p.name}`}
              >
                {p.previewPath ? (
                  <img
                    src={p.previewPath}
                    alt={`Predogled projekta ${p.name}`}
                    className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                    <Wand2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-roksal-navy">{p.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{slDate(p.createdAt)}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(p.id)}
                disabled={busyId === p.id}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-roksal-navy/10 hover:text-roksal-navy disabled:opacity-50"
                aria-label={`Podvoji projekt ${p.name}`}
              >
                {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  armedDelete === p.id
                    ? 'bg-red-600 text-white'
                    : 'text-muted-foreground hover:bg-red-600/10 hover:text-red-600'
                }`}
                aria-label={armedDelete === p.id ? `Potrdi brisanje projekta ${p.name}` : `Izbriši projekt ${p.name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
