'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Package, Ruler, Euro, Filter } from 'lucide-react'

interface Profil {
  id: string
  sifra: string
  naziv: string
  material: string
  kategorija: string
  visinaMm: number
  sirinaMm: number
  cenaM: number
  barvaRal: string | null
  slikaUrl: string | null
  aktivna: boolean
}

const KATEGORIJE = ['Vse', 'WPC vodoravno', 'WPC pokončno', 'WPC panel', 'Kombinirano', 'Inox', 'Inox vrvi', 'Alu klasično', 'Alu moderno', 'Steklo']

const MATERIAL_BADGE: Record<string, { label: string; cls: string }> = {
  'WPC + ALU': { label: 'WPC+ALU', cls: 'bg-amber-100 text-amber-800' },
  'WPC Panel': { label: 'WPC Panel', cls: 'bg-amber-100 text-amber-800' },
  'WPC + Steklo': { label: 'WPC+Steklo', cls: 'bg-purple-100 text-purple-800' },
  Inox: { label: 'Inox', cls: 'bg-slate-200 text-slate-800' },
  Aluminij: { label: 'ALU', cls: 'bg-blue-100 text-blue-800' },
  Steklo: { label: 'Steklo', cls: 'bg-cyan-100 text-cyan-800' },
}

export function RoksalCatalog() {
  const [profili, setProfili] = useState<Profil[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kategorija, setKategorija] = useState('Vse')

  const fetchProfili = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profili?aktivne=true')
      if (res.ok) setProfili(await res.json())
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfili()
  }, [fetchProfili])

  const filtered = profili.filter((p) => {
    const matchSearch =
      !search ||
      p.naziv.toLowerCase().includes(search.toLowerCase()) ||
      p.sifra.toLowerCase().includes(search.toLowerCase()) ||
      p.material.toLowerCase().includes(search.toLowerCase())
    const matchKat = kategorija === 'Vse' || p.kategorija === kategorija
    return matchSearch && matchKat
  })

  return (
    <div className="space-y-4">
      {/* Iskanje */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Iskanje profilov, šifer..."
            className="h-10 pl-9"
          />
        </div>

        {/* Filter kategorij */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {KATEGORIJE.map((k) => (
              <Button
                key={k}
                type="button"
                variant={kategorija === k ? 'default' : 'outline'}
                size="sm"
                onClick={() => setKategorija(k)}
                className={`h-7 shrink-0 text-[11px] ${kategorija === k ? 'bg-roksal-navy text-white' : ''}`}
              >
                {k}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Statistika */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Filter className="h-3 w-3" />
        <span>
          {filtered.length} od {profili.length} profilov
        </span>
      </div>

      {/* Seznam profilov */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const badge = MATERIAL_BADGE[p.material] ?? { label: p.material, cls: 'bg-gray-100 text-gray-800' }
            return (
              <Card key={p.id} className="overflow-hidden card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge className={badge.cls} variant="secondary">
                          {badge.label}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">{p.sifra}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-roksal-navy">{p.naziv}</h3>
                      <p className="text-[11px] text-muted-foreground">{p.kategorija}</p>

                      <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Ruler className="h-3 w-3" />
                          <span>
                            {p.visinaMm}×{p.sirinaMm}mm
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Euro className="h-3 w-3" />
                          <span className="font-semibold text-roksal-navy">{p.cenaM.toFixed(0)} €/m</span>
                        </div>
                        {p.barvaRal && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <span
                              className="inline-block h-3 w-3 rounded-sm border border-border"
                              style={{ backgroundColor: ralToHex(p.barvaRal) }}
                            />
                            <span>RAL {p.barvaRal}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vizualni preview profila */}
                    <div className="flex h-24 w-16 shrink-0 flex-col items-center justify-end overflow-hidden rounded border border-border bg-gradient-to-b from-sky-50 to-white">
                      <ProfilPreview profil={p} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Package className="mb-2 h-10 w-10 opacity-30" />
          <p className="text-sm">Ni profilov, ki ustrezajo iskanju.</p>
        </div>
      )}
    </div>
  )
}

// Enostavni vizualni preview profila
function ProfilPreview({ profil }: { profil: Profil }) {
  const isVodoravno = profil.kategorija.includes('vodoravno') || profil.kategorija.includes('panel')
  const isSteklo = profil.material.includes('Steklo')
  const color = profil.material.includes('Inox')
    ? '#c0c4cc'
    : profil.material.includes('Alu')
      ? '#383E42'
      : '#8b5a2b'

  if (isSteklo) {
    return <div className="h-full w-full bg-cyan-200/40" style={{ backdropFilter: 'blur(2px)' }} />
  }

  return (
    <div className="flex h-full w-full flex-col justify-end gap-0.5 p-1">
      {isVodoravno ? (
        <>
          <div className="h-1 w-full rounded-sm" style={{ backgroundColor: color }} />
          <div className="h-1 w-full rounded-sm" style={{ backgroundColor: color }} />
          <div className="h-1 w-full rounded-sm" style={{ backgroundColor: color }} />
          <div className="h-1 w-full rounded-sm" style={{ backgroundColor: color }} />
        </>
      ) : (
        <div className="flex h-full w-full justify-between gap-0.5">
          <div className="w-1 rounded-sm" style={{ backgroundColor: color }} />
          <div className="w-1 rounded-sm" style={{ backgroundColor: color }} />
          <div className="w-1 rounded-sm" style={{ backgroundColor: color }} />
          <div className="w-1 rounded-sm" style={{ backgroundColor: color }} />
          <div className="w-1 rounded-sm" style={{ backgroundColor: color }} />
        </div>
      )}
    </div>
  )
}

// Minimalna RAL → hex za prikaz
function ralToHex(ral: string): string {
  const map: Record<string, string> = {
    '7016': '#383E42',
    '9005': '#121212',
    '9010': '#FFFFFF',
    '9016': '#F6F6F6',
    '7035': '#CBD0CC',
    '7024': '#474A50',
    '6005': '#114232',
    '8003': '#5E4B46',
    EV1: '#B0B4B5',
    EV6: '#5C513F',
  }
  return map[ral] ?? '#888888'
}
