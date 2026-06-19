'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Calendar, MessageSquare } from 'lucide-react'

export interface PortalPhoto {
  imageData: string
  opomba: string | null
  createdAt: string
}

interface PhotoSection {
  id: 'PRED' | 'MED' | 'PO'
  label: string
  photos: PortalPhoto[]
}

interface PortalGalleryProps {
  sections: PhotoSection[]
}

export function PortalGallery({ sections }: PortalGalleryProps) {
  const allPhotos = sections.flatMap((s) =>
    s.photos.map((p, i) => ({
      ...p,
      sectionId: s.id,
      sectionLabel: s.label,
      localIndex: i,
    }))
  )
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const prev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? i : (i - 1 + allPhotos.length) % allPhotos.length))
  }, [allPhotos.length])
  const next = useCallback(() => {
    setLightboxIndex((i) => (i === null ? i : (i + 1) % allPhotos.length))
  }, [allPhotos.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [lightboxIndex, closeLightbox, prev, next])

  return (
    <>
      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.id}>
            <div className="flex items-center gap-2 mb-3">
              <SectionBadge id={section.id} />
              <h2 className="text-base font-bold text-roksal-navy">{section.label}</h2>
              <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {section.photos.length} {section.photos.length === 1 ? 'slika' : section.photos.length < 5 ? 'slike' : 'slik'}
              </span>
            </div>
            {section.photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {section.photos.map((photo, i) => {
                  const globalIndex = allPhotos.findIndex(
                    (p) => p.sectionId === section.id && p.localIndex === i
                  )
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxIndex(globalIndex)}
                      className="relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary hover:ring-2 hover:ring-roksal-amber/60 transition-all"
                    >
                      <img
                        src={photo.imageData}
                        alt={photo.opomba || `Slika ${i + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {photo.opomba && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                          <p className="text-[10px] text-white line-clamp-2 leading-tight">
                            {photo.opomba}
                          </p>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">Še ni slik</p>
              </div>
            )}
          </section>
        ))}
      </div>

      {lightboxIndex !== null && allPhotos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Predogled slike"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeLightbox() }}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Zapri"
          >
            <X className="h-5 w-5" />
          </button>

          {allPhotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev() }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Prejšnja"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next() }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Naslednja"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div
            className="max-w-full max-h-[80vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={allPhotos[lightboxIndex].imageData}
              alt={allPhotos[lightboxIndex].opomba || 'Slika'}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>

          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
            {allPhotos[lightboxIndex].opomba && (
              <div className="mb-2 flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-roksal-amber shrink-0 mt-0.5" />
                <p className="text-sm text-white">{allPhotos[lightboxIndex].opomba}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 text-xs text-white/70">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10">
                <span className="w-2 h-2 rounded-full bg-roksal-amber" />
                {allPhotos[lightboxIndex].sectionLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(allPhotos[lightboxIndex].createdAt).toLocaleString('sl-SI', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {allPhotos.length > 1 && (
                <span className="px-2 py-1 rounded-md bg-white/10">
                  {lightboxIndex + 1} / {allPhotos.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SectionBadge({ id }: { id: 'PRED' | 'MED' | 'PO' }) {
  const config = {
    PRED: { label: '1', color: 'bg-amber-100 text-roksal-navy' },
    MED: { label: '2', color: 'bg-blue-100 text-roksal-navy' },
    PO: { label: '3', color: 'bg-green-100 text-roksal-green' },
  }
  const c = config[id]
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${c.color}`}>
      {c.label}
    </span>
  )
}
